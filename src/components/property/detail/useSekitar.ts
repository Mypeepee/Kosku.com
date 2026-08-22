"use client";

/**
 * Satu sumber data "apa yang ada di sekitar aset ini" untuk seluruh halaman
 * detail (/Jual, /Lelang, /Sewa).
 *
 * KENAPA HOOK, BUKAN FETCH DI DALAM PETA. Daftar di bawah peta dan pin di atas
 * peta harus menampilkan hal yang sama persis. Ketika masing-masing mengambil
 * datanya sendiri, keduanya bisa berselisih (server publik menjawab satu
 * permintaan dan menolak yang lain) — dan biaya jaringannya dua kali lipat
 * untuk jawaban yang identik. Sekarang: halaman mengambil sekali lewat hook
 * ini, peta menerimanya sebagai prop.
 *
 * PERMINTAAN NOL. Aset yang sudah pernah dipindai datang lengkap dari server
 * saat halaman dirender (`awal`), jadi hook ini tidak menyentuh jaringan sama
 * sekali — tidak ada spinner, tidak ada kedipan, dan tidak ada permintaan ke
 * Overpass maupun Google. Fetch hanya terjadi untuk aset yang memang belum
 * pernah dipindai.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { PresisiTitik } from "@/lib/nearbyPlaces";

import { RADIUS_POI_METER, type TempatTerdekat } from "@/lib/nearbyPlaces";

export type SumberTitik = "LISTING" | "GEOCODE";

export type { PresisiTitik };

export interface TitikAset {
  lat: number;
  lng: number;
  sumber: SumberTitik;
  /**
   * Seberapa kasar titiknya — TITIK | ALAMAT | KELURAHAN | KECAMATAN | KOTA.
   *
   * `sumber` hanya membedakan pin agent dari hasil geocode; ini membedakan
   * geocode yang menemukan nama jalan dari yang menyerah di tingkat kota. Peta
   * memakainya untuk menyebut selisihnya apa adanya, bukan sekadar berkata
   * "perkiraan" — lihat CATATAN_PRESISI.
   *
   * Opsional karena baris pindaian LAMA tidak punya nilainya.
   */
  presisi?: PresisiTitik;
}

/** Bentuk yang dikirim server saat render halaman (lihat bacaSekitarTersimpan). */
export interface SekitarAwal {
  titik: TitikAset | null;
  radius: number;
  tempat: TempatTerdekat[];
  lengkap: boolean;
  dipindaiPada: string | null;
}

export interface SekitarView {
  titik: TitikAset | null;
  radius: number;
  tempat: TempatTerdekat[];
  lengkap: boolean;
  memuat: boolean;
  gagal: boolean;
  /** Pindai ulang (hanya berefek untuk agent — dijaga di server). */
  ulangi: () => void;
}

/** Jeda sebelum percobaan otomatis kedua saat permintaan pertama gagal. */
const JEDA_COBA_LAGI_MS = 2_500;

export function useSekitar(
  idProperty?: string | number | null,
  awal?: SekitarAwal | null,
): SekitarView {
  const punyaAwal = !!awal?.lengkap;

  const [titik, setTitik] = useState<TitikAset | null>(awal?.titik ?? null);
  const [radius, setRadius] = useState<number>(awal?.radius || RADIUS_POI_METER);
  const [tempat, setTempat] = useState<TempatTerdekat[]>(awal?.tempat ?? []);
  const [lengkap, setLengkap] = useState<boolean>(punyaAwal);
  // Aset yang datanya sudah ikut di HTML tidak pernah berstatus "memuat":
  // menyalakan skeleton untuk data yang sudah ada di layar adalah kedipan
  // tanpa alasan.
  const [memuat, setMemuat] = useState<boolean>(!punyaAwal && !!idProperty);
  const [gagal, setGagal] = useState(false);
  /** Dinaikkan untuk memicu pengambilan ulang. */
  const [putaran, setPutaran] = useState(0);
  const paksaRef = useRef(false);
  /** Percobaan otomatis hanya sekali; sisanya keputusan pembaca. */
  const sudahCobaLagi = useRef(false);

  useEffect(() => {
    if (!idProperty) {
      setMemuat(false);
      return;
    }
    // Data lengkap dari server sudah final — jangan pernah menembak jaringan
    // untuk mengonfirmasi apa yang sudah pasti.
    if (punyaAwal && putaran === 0) return;

    const ac = new AbortController();
    const paksa = paksaRef.current;
    paksaRef.current = false;

    let batal = false;
    setMemuat(true);
    setGagal(false);

    (async () => {
      try {
        const res = await fetch(
          `/api/listing/${idProperty}/sekitar${paksa ? "?ulang=1" : ""}`,
          { signal: ac.signal },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (batal) return;

        setTitik(json?.titik ?? null);
        setRadius(Number(json?.radius) || RADIUS_POI_METER);
        setTempat(Array.isArray(json?.tempat) ? json.tempat : []);
        setLengkap(!!json?.lengkap);

        const bermasalah = json?.status === "gagal";
        setGagal(bermasalah);

        // Satu percobaan ulang otomatis: kegagalan Overpass hampir selalu
        // sesaat (429/504 karena antre), dan meminta pembaca menekan tombol
        // untuk sesuatu yang bisa diperbaiki sendiri adalah pekerjaan yang
        // dilempar ke orang yang salah.
        if (bermasalah && !sudahCobaLagi.current) {
          sudahCobaLagi.current = true;
          setTimeout(() => {
            if (!batal) setPutaran((n) => n + 1);
          }, JEDA_COBA_LAGI_MS);
        }
      } catch (e: any) {
        if (batal || e?.name === "AbortError") return;
        setGagal(true);
      } finally {
        if (!batal) setMemuat(false);
      }
    })();

    return () => {
      batal = true;
      ac.abort();
    };
  }, [idProperty, putaran, punyaAwal]);

  const ulangi = useCallback(() => {
    paksaRef.current = true;
    sudahCobaLagi.current = true; // percobaan manual mematikan yang otomatis
    setPutaran((n) => n + 1);
  }, []);

  return { titik, radius, tempat, lengkap, memuat, gagal, ulangi };
}

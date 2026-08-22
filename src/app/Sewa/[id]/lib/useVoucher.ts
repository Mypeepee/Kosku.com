"use client";

/**
 * State voucher panel pemesanan.
 *
 * Dipisah dari useBooking karena keduanya menjawab pertanyaan yang berbeda:
 * useBooking menjawab "kamar apa, kapan, berapa lama" — semuanya bisa dihitung
 * seketika di browser. Voucher menjawab "berapa potongannya", dan jawabannya
 * datang dari jaringan, punya keadaan memuat & gagal, dan bisa BASI ketika
 * pilihan di useBooking berubah.
 *
 * KEPUTUSAN TERPENTING DI FILE INI: voucher yang jadi tidak berlaku TIDAK
 * dilepas diam-diam.
 *
 * Bayangkan penyewa memilih "Potongan Rp 500rb sewa 6 bulan", lalu menurunkan
 * lama sewa jadi 3 bulan. Kalau vouchernya langsung terlepas, yang dia lihat
 * hanyalah total yang naik Rp 500.000 tanpa sebab — dan tersangkanya jadi
 * harga sewanya, bukan syarat vouchernya. Karena itu pilihannya dipertahankan,
 * potongannya menjadi 0, dan `gugur` menyalakan kalimat sebabnya di panel.
 * Penyewa yang mengembalikan lama sewa ke 6 bulan langsung mendapatkan
 * potongannya lagi tanpa perlu memilih ulang.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  evaluasiVoucher,
  urutkanVoucher,
  voucherTerbaik,
  type HasilVoucher,
  type KonteksVoucher,
  type Voucher,
} from "@/lib/voucher";

export type StatusKode = "diam" | "memeriksa" | "galat";

export interface VoucherState {
  /** Katalog publik, sudah diurutkan untuk ditampilkan. */
  daftar: Voucher[];
  memuat: boolean;
  /** Katalog gagal dimuat — panel menyembunyikan barisnya, bukan menampilkan error. */
  gagalMuat: boolean;

  dipilih: Voucher | null;
  pilih: (v: Voucher | null) => void;

  /** Penilaian voucher terpilih terhadap keadaan pemesanan saat ini. */
  hasil: HasilVoucher | null;
  /** Rupiah yang benar-benar dipotong. 0 bila tidak ada / tidak berlaku. */
  potongan: number;
  /** Ada voucher terpilih, tapi syaratnya tidak lagi terpenuhi. */
  gugur: boolean;

  /** Penilaian sembarang voucher — dipakai daftar di sheet. */
  nilai: (v: Voucher) => HasilVoucher;
  /** Voucher berlaku dengan potongan terbesar, untuk penanda rekomendasi. */
  terbaik: { voucher: Voucher; potongan: number } | null;

  // ── Penebusan kode manual ──
  tebusKode: (kode: string) => Promise<boolean>;
  statusKode: StatusKode;
  galatKode: string | null;
  resetGalatKode: () => void;

  /**
   * Muat ulang katalog. Dipanggil sesudah pemilik menyunting vouchernya
   * sendiri lewat panel kelola, supaya panel di belakang drawer tidak
   * menampilkan promo yang baru saja dia hapus.
   */
  muatUlang: () => void;
}

/**
 * @param versiLuar Token muat-ulang dari luar. Dinaikkan halaman ketika
 *   pemilik menyunting vouchernya sendiri lewat drawer kelola — tanpa itu,
 *   panel di belakang drawer tetap menawarkan promo yang baru saja dihapus
 *   sampai halaman dimuat ulang.
 */
export function useVoucher(
  idProperty: string,
  ctx: KonteksVoucher,
  versiLuar = 0,
): VoucherState {
  const [katalog, setKatalog] = useState<Voucher[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [gagalMuat, setGagalMuat] = useState(false);
  const [dipilih, setDipilih] = useState<Voucher | null>(null);
  const [statusKode, setStatusKode] = useState<StatusKode>("diam");
  const [galatKode, setGalatKode] = useState<string | null>(null);

  /**
   * "Sekarang" dibekukan sekali per kunjungan.
   *
   * Kalau `new Date()` dipanggil di tiap render, hasil evaluasi berubah-ubah
   * pada nilai yang sama dan tidak ada satu pun useMemo di bawah yang bisa
   * dipercaya. Voucher yang mati di tengah kunjungan adalah kasus yang
   * ditangani server saat pengajuan dikirim, bukan yang perlu dikejar panel.
   */
  const sekarang = useRef(new Date()).current;

  /** Dinaikkan untuk memaksa efek pemuatan berjalan lagi. */
  const [tandaMuat, setTandaMuat] = useState(0);

  useEffect(() => {
    let batal = false;
    setMemuat(true);
    fetch(`/api/listings/${idProperty}/voucher`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        if (batal) return;
        const daftar: Voucher[] = Array.isArray(j?.vouchers) ? j.vouchers : [];
        setGagalMuat(false);

        // Voucher RAHASIA yang sudah ditebus dipertahankan. Ia memang tidak
        // pernah ikut di daftar publik, jadi memuat ulang tidak boleh
        // menghapusnya — kalau tidak, kode yang barusan diketik penyewa
        // lenyap sendiri begitu katalog disegarkan.
        setKatalog((prev) => [
          ...daftar,
          ...prev.filter((p) => p.rahasia && !daftar.some((d) => d.kode === p.kode)),
        ]);

        // Sebaliknya, voucher publik yang sedang dipakai bisa saja baru
        // DIHAPUS atau dimatikan pemiliknya. Membiarkannya terpilih akan
        // memotong total di layar dengan voucher yang sudah tidak ada — angka
        // yang lalu ditolak saat pengajuan dikirim.
        setDipilih((prev) =>
          prev && !prev.rahasia && !daftar.some((v) => v.kode === prev.kode)
            ? null
            : prev,
        );
      })
      .catch(() => {
        if (!batal) setGagalMuat(true);
      })
      .finally(() => {
        if (!batal) setMemuat(false);
      });
    return () => {
      batal = true;
    };
  }, [idProperty, tandaMuat, versiLuar]);

  const nilai = useCallback(
    (v: Voucher) => evaluasiVoucher(v, ctx, sekarang),
    [ctx, sekarang],
  );

  const daftar = useMemo(
    () => urutkanVoucher(katalog, ctx, sekarang),
    [katalog, ctx, sekarang],
  );

  const terbaik = useMemo(
    () => voucherTerbaik(katalog, ctx, sekarang),
    [katalog, ctx, sekarang],
  );

  const hasil = useMemo(
    () => (dipilih ? evaluasiVoucher(dipilih, ctx, sekarang) : null),
    [dipilih, ctx, sekarang],
  );

  const tebusKode = useCallback(
    async (kodeMentah: string): Promise<boolean> => {
      const kode = kodeMentah.trim().toUpperCase();
      if (!kode) return false;

      // Kode yang sudah ada di katalog tidak perlu perjalanan ke server —
      // dan lebih penting: penyewa yang mengetik kode voucher yang memang
      // sudah tampil di daftar harus mendapat hasil yang sama, bukan pesan
      // "tidak ditemukan" karena rutenya kebetulan hanya mencari yang rahasia.
      const lokal = katalog.find((v) => v.kode === kode);
      if (lokal) {
        setDipilih(lokal);
        setStatusKode("diam");
        setGalatKode(null);
        return true;
      }

      setStatusKode("memeriksa");
      setGalatKode(null);
      try {
        const res = await fetch(
          `/api/listings/${idProperty}/voucher?kode=${encodeURIComponent(kode)}`,
        );
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.voucher) {
          setStatusKode("galat");
          setGalatKode(json?.error || "Kode voucher tidak ditemukan");
          return false;
        }
        const v = json.voucher as Voucher;
        // Voucher rahasia ikut masuk katalog supaya kartunya bisa dirender di
        // daftar (dengan syarat & sisa waktunya) — bukan sekadar jadi angka
        // potongan tanpa keterangan apa pun.
        setKatalog((prev) => (prev.some((p) => p.kode === v.kode) ? prev : [...prev, v]));
        setDipilih(v);
        setStatusKode("diam");
        return true;
      } catch {
        setStatusKode("galat");
        setGalatKode("Koneksi gagal. Coba lagi.");
        return false;
      }
    },
    [katalog, idProperty],
  );

  return {
    daftar,
    memuat,
    gagalMuat,
    dipilih,
    pilih: setDipilih,
    hasil,
    potongan: hasil?.berlaku ? hasil.potongan : 0,
    gugur: Boolean(dipilih && hasil && !hasil.berlaku),
    nilai,
    terbaik,
    tebusKode,
    statusKode,
    galatKode,
    resetGalatKode: () => {
      setStatusKode("diam");
      setGalatKode(null);
    },
    muatUlang: () => setTandaMuat((n) => n + 1),
  };
}

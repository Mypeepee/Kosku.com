"use client";

/**
 * Daftar "Yang ada di sekitar" — jawaban otomatis atas pertanyaan "dekat apa?".
 *
 * KENAPA KOMPONEN SENDIRI. Blok ini dulu hidup di dalam SekitarLokasi, yang
 * dipakai /Jual & /Lelang. Halaman /Sewa punya bagian lokasi sendiri (judul,
 * kartu, dan urutan section yang khas kos), jadi ia memakai peta yang sama
 * tapi tidak bisa memakai SekitarLokasi utuh — akibatnya pin fasilitas muncul
 * di petanya, tapi daftarnya tidak pernah dirender: pembaca melihat 60 pin
 * berwarna tanpa satu pun nama yang bisa dibaca tanpa mengklik.
 *
 * Sekarang daftarnya satu komponen yang bisa ditempel di bagian lokasi mana
 * pun, sementara pembungkusnya (judul & tata letak section) tetap milik
 * masing-masing halaman.
 *
 * DATANYA TIDAK DICARI DI SINI. Komponen ini hanya menggambar `SekitarView`
 * yang dihasilkan useSekitar — satu pemindaian per aset, dilakukan & disimpan
 * di server (src/lib/nearbyPlaces.server.ts). Peta di atas dan daftar ini
 * memakai objek yang sama persis, jadi mustahil keduanya berselisih isi.
 *
 * Warna tiap kategori sengaja sama persis dengan warna pin & chip filter di
 * peta — pembaca yang melihat "Kuliner" oranye di daftar langsung tahu pin
 * oranye mana yang dimaksud, tanpa legenda.
 */

import React, { useMemo, useState } from "react";
import { Icon } from "@iconify/react";

import {
  CATATAN_PRESISI,
  KATEGORI_POI,
  URUTAN_KATEGORI,
  formatJarak,
  type KategoriPOI,
  type TempatTerdekat,
} from "@/lib/nearbyPlaces";

import type { SekitarView } from "./useSekitar";

/** Berapa tempat per kategori yang ditampilkan — yang terdekat lebih dulu. */
const MAKS_PER_KATEGORI = 3;
/** Kategori yang tampil sebelum tombol "Tampilkan semua" ditekan. */
const KATEGORI_AWAL = 4;

/** "800 m" / "1,5 km" — radius pemindaian tidak selalu 800 m lagi. */
export const labelRadius = (m: number) =>
  m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : `${m} m`;

interface FasilitasSekitarProps {
  /** Hasil useSekitar — dipakai bersama peta di atasnya. */
  sekitar: SekitarView;
  /** Titik aset hasil geocode alamat, bukan koordinat asli listing. */
  titikPerkiraan?: boolean;
  className?: string;
}

export default function FasilitasSekitar({
  sekitar,
  titikPerkiraan = false,
  className,
}: FasilitasSekitarProps) {
  const [semuaKategori, setSemuaKategori] = useState(false);

  /**
   * Seberapa kasar titiknya. Baris pindaian LAMA (ditulis sebelum kolom
   * presisi ada) tidak punya nilainya — untuk itu dipakai kalimat umum lama,
   * bukan tebakan: menebak "tingkat alamat" persis kesalahan yang kolom ini
   * ada untuk mencegah.
   */
  const presisi = sekitar.titik?.presisi;
  const catatanPresisi =
    (presisi && CATATAN_PRESISI[presisi]) ||
    "Titik properti ini hasil pencarian alamat, jadi posisinya perkiraan.";

  const poiGrup = useMemo(() => {
    const acc = new Map<KategoriPOI, TempatTerdekat[]>();
    for (const p of sekitar.tempat) {
      const list = acc.get(p.kategori) ?? [];
      list.push(p);
      acc.set(p.kategori, list);
    }
    // Urut kategori mengikuti URUTAN_KATEGORI (makan → belanja → kesehatan…),
    // bukan jumlah hasil: yang paling sering ditanyakan tetap di atas walau
    // hanya ketemu satu.
    return URUTAN_KATEGORI.filter((k) => acc.has(k)).map(
      (k) => [k, (acc.get(k) as TempatTerdekat[]).slice()] as const,
    );
  }, [sekitar.tempat]);

  const poiTampil = semuaKategori ? poiGrup : poiGrup.slice(0, KATEGORI_AWAL);

  return (
    <div className={className}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h4 className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">
          Yang ada di sekitar
        </h4>
        <p className="text-[11px] text-white/30">
          Radius {labelRadius(sekitar.radius)}
          {sekitar.tempat.length > 0 && ` · ${sekitar.tempat.length} tempat`}
        </p>
      </div>

      {sekitar.memuat ? (
        <div className="grid grid-cols-1 gap-x-10 gap-y-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-white/[0.06]" />
              <div className="h-3 flex-1 animate-pulse rounded bg-white/[0.06]" />
            </div>
          ))}
        </div>
      ) : sekitar.gagal && poiGrup.length === 0 ? (
        /* Dibedakan dengan tegas dari "hasilnya nol". Menampilkan "tidak ada
           apa-apa di sekitar sini" saat yang terjadi sebenarnya server peta
           tidak menjawab adalah kebohongan yang meyakinkan — pembaca
           menyimpulkan properti ini terpencil. */
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-white/40">
          <span className="flex items-center gap-2">
            <Icon
              icon="solar:danger-triangle-bold-duotone"
              className="text-base text-amber-300"
            />
            Data sekitar belum berhasil diambil — bukan berarti kosong.
          </span>
          <button
            onClick={sekitar.ulangi}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-white/[0.06]"
          >
            Coba lagi
          </button>
        </div>
      ) : poiGrup.length === 0 ? (
        <p className="text-xs text-white/35">
          Tidak ada fasilitas umum yang terdata dalam radius{" "}
          {labelRadius(sekitar.radius)} dari titik ini.
        </p>
      ) : (
        <>
          {/* Multi-column, BUKAN grid. Di grid, tinggi satu baris ditentukan sel
              tertinggi di baris itu — kategori dengan 2 hasil yang bersebelahan
              dengan kategori 3 hasil + baris "+N lain" meninggalkan ruang kosong
              yang tidak bisa diisi kategori berikutnya, karena kategori itu
              wajib mulai di baris grid berikutnya. Kolom tidak punya baris:
              tiap kategori mengalir mengisi sisa ruang kolomnya. */}
          <div className="-mb-6 columns-1 gap-x-8 md:columns-2">
            {poiTampil.map(([kategori, list]) => {
              const cfg = KATEGORI_POI[kategori];
              const sisa = list.length - MAKS_PER_KATEGORI;
              return (
                <div key={kategori} className="mb-6 break-inside-avoid">
                  <h5
                    className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em]"
                    style={{ color: cfg.warna }}
                  >
                    <Icon icon={cfg.icon} className="text-sm" />
                    {cfg.label}
                    <span className="text-white/25">{list.length}</span>
                  </h5>
                  {list.slice(0, MAKS_PER_KATEGORI).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-2 last:border-0"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[13px]"
                          style={{
                            color: cfg.warna,
                            borderColor: `${cfg.warna}40`,
                            background: `${cfg.warna}14`,
                          }}
                        >
                          <Icon icon={cfg.icon} />
                        </span>
                        <span className="truncate text-[13px] text-white/75">
                          {p.nama}
                        </span>
                      </div>
                      <span className="shrink-0 rounded-lg bg-white/[0.06] px-2 py-0.5 text-[11px] font-bold tabular-nums text-white">
                        {formatJarak(p.jarak)}
                      </span>
                    </div>
                  ))}
                  {sisa > 0 && (
                    <p className="pt-1.5 text-[11px] font-semibold text-white/30">
                      +{sisa} {cfg.label.toLowerCase()} lain di radius ini
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {poiGrup.length > KATEGORI_AWAL && (
            <button
              onClick={() => setSemuaKategori((v) => !v)}
              className="mt-6 w-full rounded-xl border border-white/15 px-8 py-3 text-sm font-bold text-white transition-all hover:bg-white/[0.06] active:scale-[0.98] md:w-auto"
            >
              {semuaKategori
                ? "Tampilkan lebih sedikit"
                : `Tampilkan semua ${poiGrup.length} kategori`}
            </button>
          )}
        </>
      )}

      {/* Catatan presisi — MENYEBUT ANGKA MELESETNYA, bukan sekadar
          "perkiraan". "Posisinya perkiraan" adalah peringatan yang tidak bisa
          dipakai: pembacanya tidak tahu apakah artinya meleset 50 m (tidak
          apa-apa) atau 8 km (asetnya bahkan bukan di kecamatan yang ia kira).
          Yang berguna adalah SEBERAPA, dan dari mana angka itu berasal. */}

    </div>
  );
}

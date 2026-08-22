"use client";

/**
 * Potongan-potongan halaman detail aset (/Jual & /Lelang).
 *
 * Sebelum ini, kedua halaman merakit sendiri setiap kartu dengan class yang
 * disalin bolak-balik (`bg-gradient-to-br from-slate-800/40 to-slate-900/40
 * border border-slate-700/30 rounded-xl p-5` muncul belasan kali di satu file).
 * Akibatnya bukan cuma berulang: setiap blok informasi jadi KARTU, sehingga
 * halaman terbaca sebagai tumpukan kotak abu setinggi layar tanpa satu pun
 * yang lebih penting daripada yang lain.
 *
 * Yang dipakai di sini mengikuti halaman /Sewa yang sudah tertata:
 *  - satu SECTION = satu pertanyaan pembaca, dipisah garis tipis (bukan kartu),
 *  - kartu hanya untuk data yang memang berbentuk tabel/daftar,
 *  - ikon berwarna per arti (lihat src/lib/detailTheme.ts), bukan satu hijau
 *    untuk semuanya.
 *
 * CATATAN: `<section>` WAJIB diberi `bg-transparent` — globals.css memaksa
 * semua <section> jadi #000510, dan tanpa itu bagian ini akan tampil sebagai
 * balok biru gelap di atas kanvas halaman.
 */

import React, { useState } from "react";
import { Icon } from "@iconify/react";

import { AKSEN, KILAU_KARTU, LINE, SURFACE, type Aksen } from "@/lib/detailTheme";

// ─────────────────────────────────────────────────────────────────────────────
// KERANGKA
// ─────────────────────────────────────────────────────────────────────────────

/** Satu bagian halaman. Dipisah garis tipis, bukan kartu di dalam kartu. */
export function Bagian({
  children,
  akhir = false,
  className = "",
}: {
  children: React.ReactNode;
  /** Bagian terakhir tidak diberi garis bawah — garis menggantung itu sampah. */
  akhir?: boolean;
  className?: string;
}) {
  return (
    <section
      className={`bg-transparent ${akhir ? "" : `border-b pb-7 ${LINE.section}`} ${className}`}
    >
      {children}
    </section>
  );
}

/**
 * Judul section. Ikonnya diberi warna per section: saat di-scroll, deretan
 * kotak ikon jadi penanda posisi — "aku sudah lewat yang kuning (jadwal
 * lelang)" — yang tidak mungkin terjadi kalau semuanya hijau.
 */
export function Judul({
  children,
  ikon,
  aksen = AKSEN.netral,
  keterangan,
  aksi,
}: {
  children: React.ReactNode;
  ikon?: string;
  aksen?: Aksen;
  /** Baris kecil di bawah judul (mis. alamat lengkap). */
  keterangan?: React.ReactNode;
  /** Tautan/tombol di ujung kanan baris judul. */
  aksi?: React.ReactNode;
}) {
  return (
    <div className={`flex items-start justify-between gap-4 ${keterangan ? "mb-5" : "mb-4"}`}>
      <div className="min-w-0">
        <h3 className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-white">
          {ikon && (
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${aksen.kotak}`}
            >
              <Icon icon={ikon} className="text-base" />
            </span>
          )}
          {children}
        </h3>
        {keterangan && (
          <div className="mt-2 text-xs leading-relaxed text-white/45">{keterangan}</div>
        )}
      </div>
      {aksi && <div className="shrink-0">{aksi}</div>}
    </div>
  );
}

/** Permukaan kartu standar — satu-satunya tempat radius & kilau ditentukan. */
export function Kartu({
  children,
  className = "",
  padat = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Tanpa padding dalam — untuk kartu yang isinya baris penuh lebar. */
  padat?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[1.5rem] border ${LINE.card} ${padat ? "" : "p-5"} ${className}`}
      style={{ background: SURFACE.card, boxShadow: KILAU_KARTU }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RINGKASAN SATU BARIS
// ─────────────────────────────────────────────────────────────────────────────

export interface ItemStat {
  ikon: string;
  label: string;
  nilai: string;
  aksen?: Aksen;
  /** Baris kecil di bawah nilai (mis. nomor sertifikat). */
  catatan?: string;
  /**
   * Sel jadi tombol bila diisi (mis. legalitas multi-bidang → daftar nomor
   * sertifikat). Sel tanpa ini tetap teks biasa: yang bisa diketuk harus
   * kelihatan berbeda, jadi jangan diisi hanya supaya "ada interaksinya".
   */
  onKlik?: () => void;
  /** Judul/aria untuk sel yang bisa diketuk. */
  petunjuk?: string;
}

/**
 * Ringkasan properti sebagai SATU BARIS, bukan lima kartu besar.
 *
 * Lima kotak 120px yang masing-masing berisi satu angka memakan hampir satu
 * layar penuh di ponsel hanya untuk menyampaikan "60/77 m², 2 KT, 2 KM, 2
 * lantai" — kalimat yang muat dalam satu tarikan mata. Di sini semuanya tetap
 * sebaris di semua lebar layar; yang mengecil ukuran teks & padding-nya, bukan
 * jumlah kolomnya, supaya urutan bacanya tidak pernah patah jadi 2×3.
 *
 * Sel kosong disaring di pemanggil, jadi listing tanah tidak menampilkan
 * "— kamar tidur" empat kali.
 */
export function StatStrip({ items }: { items: ItemStat[] }) {
  if (items.length === 0) return null;

  return (
    <Kartu padat>
      <div className="flex divide-x divide-white/[0.06]">
        {items.map((s) => {
          const bisaKlik = typeof s.onKlik === "function";
          const isi = (
            <>
              <Icon
                icon={s.ikon}
                className={`text-lg transition-transform duration-300 sm:text-xl ${
                  s.aksen ? s.aksen.ikon : "text-white/40"
                } ${bisaKlik ? "group-hover:scale-110" : ""}`}
              />
              <p className="flex w-full items-center justify-center gap-1 break-words text-[12px] font-extrabold leading-tight text-white sm:text-[15px]">
                {s.nilai}
                {bisaKlik && (
                  <Icon
                    icon="solar:alt-arrow-right-linear"
                    aria-hidden
                    className="shrink-0 text-[11px] text-white/35 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-white/70 sm:text-xs"
                  />
                )}
              </p>
              <p className="text-[8px] font-black uppercase leading-tight tracking-[0.06em] text-white/30 sm:text-[9px] sm:tracking-[0.12em]">
                {s.label}
              </p>
              {s.catatan && (
                <p
                  className={`w-full truncate text-[9px] font-semibold transition-colors ${
                    bisaKlik
                      ? `${s.aksen ? s.aksen.teks : "text-white/60"} opacity-80 group-hover:opacity-100`
                      : "text-white/45"
                  }`}
                >
                  {s.catatan}
                </p>
              )}
            </>
          );

          const kelasSel =
            "group flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-3 text-center sm:px-3 sm:py-3.5";

          return bisaKlik ? (
            <button
              key={s.label}
              type="button"
              onClick={s.onKlik}
              title={s.petunjuk}
              aria-label={s.petunjuk}
              className={`${kelasSel} relative transition-all duration-200 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/30 active:scale-[0.97] active:bg-white/[0.09]`}
            >
              {isi}
            </button>
          ) : (
            <div
              key={s.label}
              className={`${kelasSel} transition-colors hover:bg-white/[0.03]`}
            >
              {isi}
            </div>
          );
        })}
      </div>
    </Kartu>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FAKTA
// ─────────────────────────────────────────────────────────────────────────────

export interface ItemFakta {
  ikon: string;
  label: string;
  nilai: React.ReactNode;
  aksen?: Aksen;
  catatan?: string;
}

/** Kisi fakta: ikon berwarna, label kecil, nilai tebal. Sama seperti /Sewa. */
export function FaktaGrid({
  items,
  kolom = 3,
  aksen,
}: {
  items: ItemFakta[];
  kolom?: 2 | 3 | 4;
  /** Aksen bawaan untuk item yang tidak menentukan sendiri. */
  aksen?: Aksen;
}) {
  if (items.length === 0) return null;

  const kolomKelas =
    kolom === 4 ? "md:grid-cols-4" : kolom === 3 ? "sm:grid-cols-3" : "";

  return (
    <div className={`grid grid-cols-2 gap-x-6 gap-y-4 ${kolomKelas}`}>

      {items.map((f) => (
        <div key={f.label} className="flex min-w-0 items-start gap-3">
          <Icon
            icon={f.ikon}
            className={`mt-0.5 shrink-0 text-lg ${(f.aksen ?? aksen ?? AKSEN.netral).ikon}`}
          />
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/30">
              {f.label}
            </p>
            <p className="mt-0.5 break-words text-sm font-bold text-white">{f.nilai}</p>
            {f.catatan && (
              <p className="mt-0.5 break-words text-[11px] text-white/35">{f.catatan}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Satu baris label-kiri / nilai-kanan di dalam kartu.
 *
 * Bisa dijadikan tombol lewat `onKlik` (mis. legalitas multi-bidang yang
 * membuka daftar nomor sertifikat). Barisnya lalu diberi tanda panah + latar
 * yang menyala saat disentuh — baris yang bisa diketuk tanpa penanda apa pun
 * hanya ditemukan orang secara kebetulan.
 */
export function BarisFakta({
  ikon,
  label,
  nilai,
  catatan,
  aksen,
  onKlik,
  petunjuk,
}: {
  ikon: string;
  label: string;
  nilai: React.ReactNode;
  catatan?: React.ReactNode;
  aksen?: Aksen;
  onKlik?: () => void;
  petunjuk?: string;
}) {
  const bisaKlik = typeof onKlik === "function";

  const isi = (
    <>
      <div className="flex min-w-0 items-start gap-3">
        <Icon
          icon={ikon}
          className={`mt-0.5 shrink-0 text-lg transition-transform duration-300 ${
            aksen ? aksen.ikon : "text-white/35"
          } ${bisaKlik ? "group-hover:scale-110" : ""}`}
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white/75">{label}</p>
          {catatan && <div className="mt-0.5 text-[11px] text-white/35">{catatan}</div>}
        </div>
      </div>
      <span className="flex shrink-0 items-center gap-1.5 text-right text-sm font-bold text-white">
        {nilai}
        {bisaKlik && (
          <Icon
            icon="solar:alt-arrow-right-linear"
            aria-hidden
            className="text-xs text-white/35 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-white/70"
          />
        )}
      </span>
    </>
  );

  const kelas = `flex items-start justify-between gap-4 border-b py-3 last:border-0 ${LINE.row}`;

  if (!bisaKlik) return <div className={kelas}>{isi}</div>;

  return (
    <button
      type="button"
      onClick={onKlik}
      title={petunjuk}
      aria-label={petunjuk}
      // Kotaknya sengaja PERSIS sama dengan baris biasa (tanpa margin negatif):
      // garis pemisah antar baris harus tetap sejajar, kalau tidak baris yang
      // bisa diketuk terlihat seperti salah render.
      className={`${kelas} group w-full text-left transition-all duration-200 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/25 active:bg-white/[0.07]`}
    >
      {isi}
    </button>
  );
}

/** Pill berteks + ikon. */
export function Chip({
  ikon,
  children,
  aksen = AKSEN.netral,
  className = "",
}: {
  ikon?: string;
  children: React.ReactNode;
  aksen?: Aksen;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold ${aksen.chip} ${className}`}
    >
      {ikon && <Icon icon={ikon} className="text-sm" />}
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DESKRIPSI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deskripsi listing dengan lipatan.
 *
 * Deskripsi hasil scrape lelang bisa belasan paragraf berisi kalimat hukum yang
 * sama di setiap aset. Ditampilkan utuh, ia mendorong peta & jadwal lelang ke
 * luar layar; padahal dua hal itulah yang menentukan orang jadi menawar atau
 * tidak. Enam baris pertama sudah cukup untuk menilai apakah sisanya perlu
 * dibaca.
 */
export function Deskripsi({ teks }: { teks: string }) {
  const [penuh, setPenuh] = useState(false);
  const panjang = teks.trim().length > 320;

  return (
    <>
      <p
        className={`whitespace-pre-line text-sm leading-[1.85] text-white/60 ${
          penuh ? "" : "line-clamp-6"
        }`}
      >
        {teks}
      </p>
      {panjang && (
        <button
          onClick={() => setPenuh((v) => !v)}
          className="mt-3 flex items-center gap-1.5 text-sm font-bold text-white underline underline-offset-4 transition-colors hover:text-white/60"
        >
          {penuh ? "Tutup deskripsi" : "Baca selengkapnya"}
          <Icon
            icon="solar:alt-arrow-down-linear"
            className={`transition-transform ${penuh ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SPANDUK STATUS
// ─────────────────────────────────────────────────────────────────────────────

/** Spanduk "sudah terjual/tersewa" — satu-satunya blok merah di halaman. */
export function SpandukTerjual({ label }: { label: string }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-rose-400/25 px-4 py-3.5 ${AKSEN.rose.wash}`}
    >
      <Icon
        icon="solar:lock-keyhole-minimalistic-bold-duotone"
        className="shrink-0 text-2xl text-rose-300"
      />
      <p className="text-sm font-bold uppercase tracking-wide text-rose-200">
        Properti ini sudah {label}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOMBOL BAGIKAN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tombol bagikan di kepala halaman.
 *
 * Versi lama memakai cincin `animate-ping` + dua lapis glow yang berdenyut
 * terus-menerus. Di halaman yang tugasnya menjual properti, satu-satunya
 * elemen yang bergerak sebaiknya bukan tombol sekunder — mata tertarik ke
 * sana, bukan ke harga. Sekarang diam, dan hanya menyala saat disentuh.
 */
export function TombolBagikan({
  onClick,
  tersalin,
}: {
  onClick: () => void;
  tersalin: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title="Bagikan properti ini"
      aria-label="Bagikan properti ini"
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-all active:scale-95 ${
        tersalin
          ? "border-[#86efac]/40 bg-[#86efac]/15 text-[#86efac]"
          : "border-white/10 bg-white/[0.04] text-white/70 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
      }`}
    >
      <Icon
        icon={tersalin ? "solar:check-circle-bold-duotone" : "solar:share-bold"}
        className={`text-lg transition-transform ${tersalin ? "scale-110" : ""}`}
      />
    </button>
  );
}

"use client";

/**
 * Potongan UI kecil yang dipakai bersama oleh seluruh layar Kelola Voucher.
 *
 * Ditaruh terpisah bukan demi kerapian berkas, melainkan karena tiga layar
 * (daftar, galeri preset, form) harus terasa sebagai SATU benda. Begitu setiap
 * layar menulis input & sakelarnya sendiri, tinggi baris dan jarak label mulai
 * berbeda beberapa piksel, dan perpindahan antar layar terasa seperti berpindah
 * aplikasi — hal yang tidak pernah bisa ditunjuk penggunanya, tapi selalu
 * terasa.
 *
 * Semua warna & permukaan datang dari @/lib/detailTheme lewat ../sewaTheme.
 * Tidak ada hex yang ditulis di sini kecuali aksen aksi (#86efac), yang memang
 * satu-satunya warna "tekan ini" di seluruh halaman detail sewa.
 */

import React from "react";
import { Icon } from "@iconify/react";

import { AKSEN, SURFACE, type Aksen } from "../sewaTheme";

// ─────────────────────────────────────────────────────────────────────────────
// ANGKA
// ─────────────────────────────────────────────────────────────────────────────

/** "1500000" → "1.500.000". Nol-nya jadi bisa dihitung mata, bukan dieja. */
export const pisahRibuan = (s: string): string =>
  s.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Teks berisi angka apa pun → number, atau null bila memang kosong. */
export const keAngka = (s: string): number | null => {
  const bersih = s.replace(/\D/g, "");
  return bersih === "" ? null : Number(bersih);
};

// ─────────────────────────────────────────────────────────────────────────────
// LABEL & SECTION
// ─────────────────────────────────────────────────────────────────────────────

export function Label({
  children,
  opsional,
}: {
  children: React.ReactNode;
  /** Ditulis sebagai kata, bukan tanda bintang: bintang menuntut legenda yang
   *  tidak ada di mana pun, dan pemilik harus menebak arahnya. */
  opsional?: boolean;
}) {
  return (
    <span className="mb-1.5 flex items-baseline gap-1.5">
      <span className="text-[9.5px] font-black uppercase tracking-[0.14em] text-white/70">
        {children}
      </span>
      {opsional && (
        <span className="text-[9px] font-bold normal-case tracking-normal text-white/40">
          opsional
        </span>
      )}
    </span>
  );
}

/** Kalimat bantu di bawah isian. Selalu menjelaskan AKIBAT, bukan mengulang nama isian. */
export function Bantuan({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 text-[10.5px] leading-relaxed text-white/55">{children}</p>
  );
}

/**
 * Satu blok bertema di dalam form.
 *
 * Judul section memakai kotak ikon berwarna — pola yang sama dengan section
 * halaman detail, supaya pemilik yang sudah terbiasa membaca halamannya
 * langsung tahu di mana satu topik berakhir dan topik lain dimulai.
 */
export function Bagian({
  ikon,
  aksen,
  judul,
  catatan,
  children,
}: {
  ikon: string;
  aksen: Aksen;
  judul: string;
  catatan?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-transparent">
      <div className="mb-3 flex items-start gap-2.5">
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${aksen.kotak}`}
        >
          <Icon icon={ikon} className="text-sm" />
        </span>
        <span className="min-w-0 flex-1 pt-px">
          <span className="block text-[12.5px] font-extrabold leading-tight text-white">
            {judul}
          </span>
          {catatan && (
            <span className="mt-0.5 block text-[10.5px] leading-relaxed text-white/55">
              {catatan}
            </span>
          )}
        </span>
      </div>
      {children}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ISIAN
// ─────────────────────────────────────────────────────────────────────────────

export function Kolom({
  nilai,
  onUbah,
  placeholder,
  awalan,
  akhiran,
  inputMode = "text",
  besar,
  autoFocus,
  maxLength,
  aksi,
}: {
  nilai: string;
  onUbah: (v: string) => void;
  placeholder?: string;
  awalan?: string;
  akhiran?: string;
  inputMode?: "text" | "numeric";
  /** Untuk angka pokok (besar potongan) — ukurannya menyatakan kepentingannya. */
  besar?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  /** Tombol kecil di ujung kanan, mis. "Buatkan" pada isian kode. */
  aksi?: { ikon: string; label: string; onKlik: () => void };
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl border border-white/[0.08] px-3.5 transition-colors focus-within:border-[#86efac]/50"
      style={{ background: SURFACE.raised }}
    >
      {awalan && (
        <span
          className={`shrink-0 font-bold text-white/60 ${besar ? "text-sm" : "text-xs"}`}
        >
          {awalan}
        </span>
      )}
      <input
        value={nilai}
        onChange={(e) => onUbah(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoFocus={autoFocus}
        maxLength={maxLength}
        className={`w-full min-w-0 bg-transparent text-white outline-none placeholder:font-normal placeholder:text-white/35 ${
          besar
            ? "py-3 text-[1.35rem] font-black tracking-[-0.02em] tabular-nums"
            : "py-2.5 text-sm font-semibold"
        }`}
      />
      {akhiran && (
        <span
          className={`shrink-0 font-bold text-white/60 ${besar ? "text-base" : "text-xs"}`}
        >
          {akhiran}
        </span>
      )}
      {aksi && (
        <button
          type="button"
          onClick={aksi.onKlik}
          title={aksi.label}
          aria-label={aksi.label}
          className="-mr-1 shrink-0 rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <Icon icon={aksi.ikon} className="text-base" />
        </button>
      )}
    </div>
  );
}

export function AreaTeks({
  nilai,
  onUbah,
  placeholder,
  maxLength,
  rows = 2,
}: {
  nilai: string;
  onUbah: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
}) {
  return (
    <div className="relative">
      <textarea
        value={nilai}
        onChange={(e) => onUbah(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full resize-none rounded-xl border border-white/[0.08] px-3.5 py-2.5 pb-6 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus:border-[#86efac]/50"
        style={{ background: SURFACE.raised }}
      />
      {maxLength != null && (
        // Penghitung karakter hanya menyala saat MENDEKATI batas. Angka yang
        // selalu terlihat mengubah kolom deskripsi jadi ujian mengarang
        // sependek mungkin, padahal batasnya jarang tersentuh.
        <span
          className={`pointer-events-none absolute bottom-2 right-3 text-[9px] font-bold tabular-nums transition-opacity ${
            nilai.length > maxLength * 0.8
              ? "text-white/40 opacity-100"
              : "opacity-0"
          }`}
        >
          {nilai.length}/{maxLength}
        </span>
      )}
    </div>
  );
}

/*
 * Isian tanggal TIDAK ada di berkas ini.
 *
 * Dulu ada, berupa `<input type="date">` — satu-satunya elemen di panel ini
 * yang bentuk, format, dan placeholder-nya ditentukan sistem operasi pembaca,
 * bukan halaman ini. Penggantinya ada di ./PilihTanggal.tsx beserta alasan
 * lengkapnya.
 */

// ─────────────────────────────────────────────────────────────────────────────
// PILIHAN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chip pilihan cepat — "7 hari", "50 pemakaian", "Tanpa batas".
 *
 * Ini yang membedakan form yang bisa diisi 20 detik dari form yang bisa diisi
 * 3 menit. Pemilik hampir tidak pernah butuh tanggal atau kuota yang aneh; dia
 * butuh "sekitar sebulan" dan "sekitar lima puluh". Isian bebasnya tetap ada
 * di sebelahnya untuk yang memang punya angka sendiri.
 */
export function ChipCepat({
  pilihan,
  aktif,
  onPilih,
}: {
  pilihan: { label: string; nilai: string | number | null }[];
  aktif: (nilai: string | number | null) => boolean;
  onPilih: (nilai: string | number | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {pilihan.map((p) => {
        const nyala = aktif(p.nilai);
        return (
          <button
            key={p.label}
            type="button"
            onClick={() => onPilih(p.nilai)}
            aria-pressed={nyala}
            className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors motion-reduce:transition-none ${
              nyala
                ? AKSEN.mint.chip
                : "border-white/[0.08] text-white/65 hover:border-white/30 hover:text-white"
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

/** Segmented control dua pilihan dengan penanda meluncur. */
export function Segmen<T extends string>({
  pilihan,
  nilai,
  onUbah,
}: {
  pilihan: { nilai: T; label: string }[];
  nilai: T;
  onUbah: (v: T) => void;
}) {
  const indeks = Math.max(
    0,
    pilihan.findIndex((p) => p.nilai === nilai),
  );

  return (
    <div
      className="relative flex rounded-xl border border-white/[0.06] p-1"
      style={{ background: SURFACE.raised }}
    >
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-lg bg-[#86efac] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{
          width: `calc((100% - 0.5rem) / ${pilihan.length})`,
          transform: `translateX(${indeks * 100}%)`,
        }}
      />
      {pilihan.map((p) => (
        <button
          key={p.nilai}
          type="button"
          onClick={() => onUbah(p.nilai)}
          className={`relative z-10 flex-1 rounded-lg py-2 text-[11.5px] font-bold transition-colors motion-reduce:transition-none ${
            nilai === p.nilai ? "text-black" : "text-white/65 hover:text-white"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function Sakelar({
  nyala,
  onUbah,
  judul,
  catatan,
  aksen,
}: {
  nyala: boolean;
  onUbah: (v: boolean) => void;
  judul: string;
  catatan: string;
  /** Kelas latar saat menyala, mis. "bg-[#86efac]". */
  aksen: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onUbah(!nyala)}
      role="switch"
      aria-checked={nyala}
      className="flex w-full items-center gap-3 rounded-xl border border-white/[0.08] p-3 text-left transition-colors hover:border-white/20 motion-reduce:transition-none"
      style={{ background: SURFACE.raised }}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold text-white">{judul}</span>
        <span className="mt-0.5 block text-[10.5px] leading-relaxed text-white/60">
          {catatan}
        </span>
      </span>
      <span
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200 motion-reduce:transition-none ${
          nyala ? aksen : "bg-white/10"
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 motion-reduce:transition-none ${
            nyala ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAMPILAN KEADAAN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Meteran kuota.
 *
 * Warnanya berubah hanya di dua titik yang berarti: menipis (amber) dan habis
 * (rose). Gradasi bertahap terlihat pintar tapi tidak bisa dibaca — pemilik
 * ingin tahu "masih aman / segera habis / habis", bukan menaksir warna.
 */
export function MeterKuota({
  terpakai,
  total,
  aksen,
}: {
  terpakai: number;
  total: number;
  aksen: string;
}) {
  const persen = Math.max(0, Math.min(100, Math.round((terpakai / total) * 100)));
  return (
    <div className={`h-1 w-full overflow-hidden rounded-full bg-white/[0.07] ${aksen}`}>
      <div
        className="h-full rounded-full bg-current transition-[width] duration-500 ease-out motion-reduce:transition-none"
        style={{ width: `${persen}%` }}
      />
    </div>
  );
}

/** Pesan galat yang seragam — satu bentuk, di mana pun ia muncul. */
export function Galat({ pesan }: { pesan: string }) {
  return (
    <p
      role="alert"
      className={`flex items-start gap-2 rounded-xl border border-rose-500/20 p-3 text-xs font-semibold ${AKSEN.rose.wash} ${AKSEN.rose.teks}`}
    >
      <Icon icon="solar:danger-triangle-bold" className="mt-px shrink-0 text-base" />
      {pesan}
    </p>
  );
}

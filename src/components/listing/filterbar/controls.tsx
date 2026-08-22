"use client";

import React, { useId } from "react";
import { Icon } from "@iconify/react";
import { AKSEN_TEKS, CHIP_IDLE, CHIP_ISI, INPUT, INPUT_FOKUS, RING_FOKUS } from "./tokens";

/**
 * Kontrol isi panel filter.
 *
 * Semuanya bekerja pada NILAI PARAM URL berupa string, bukan pada bentuk state
 * tersendiri. Alasannya: URL sudah jadi satu-satunya sumber kebenaran halaman
 * ini, dan bentuk kedua (state form) selalu berakhir sebagai dua kebenaran yang
 * harus disinkronkan — sumber bug paling umum di sistem filter.
 */

/* ───────────────────────────── Label seksi ───────────────────────────── */

export function LabelSeksi({
  children,
  ikon,
}: {
  children: React.ReactNode;
  ikon?: string;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      {ikon && (
        <Icon
          icon={ikon}
          className="text-base"
          style={{ color: "rgba(255,255,255,0.3)" }}
          aria-hidden
        />
      )}
      <span
        className="text-[11px] font-bold uppercase tracking-[0.08em]"
        style={{ color: "rgba(255,255,255,0.4)" }}
      >
        {children}
      </span>
    </div>
  );
}

/* ───────────────────────────── Chip pilihan ──────────────────────────── */

export interface OpsiChip {
  value: string;
  label: string;
  hint?: string;
}

/**
 * Daftar chip pilih-satu. Menekan chip yang sedang aktif MEMBATALKANNYA —
 * itulah cara membatalkan pilihan tunggal tanpa perlu baris "Semua" tersendiri,
 * dan keadaan aktifnya tetap terlihat jelas (beda dengan pill urutan lama yang
 * juga toggle tapi jatuh ke default tak terlihat).
 */
export function ChipPilihan({
  opsi,
  nilai,
  onChange,
  kolom = 2,
  label,
}: {
  opsi: OpsiChip[];
  nilai: string;
  onChange: (v: string) => void;
  kolom?: 1 | 2 | 3;
  label: string;
}) {
  const grid =
    kolom === 1 ? "grid-cols-1" : kolom === 3 ? "grid-cols-3" : "grid-cols-2";
  return (
    <div className={`grid ${grid} gap-2`} role="group" aria-label={label}>
      {opsi.map((o) => {
        const aktif = nilai === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={aktif}
            onClick={() => onChange(aktif ? "" : o.value)}
            className={`flex min-h-[44px] items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition-colors ${RING_FOKUS}`}
            style={aktif ? CHIP_ISI : CHIP_IDLE}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate leading-tight">{o.label}</span>
              {o.hint && (
                <span
                  className="mt-0.5 block truncate text-[11px] font-normal leading-snug"
                  style={{ color: aktif ? "rgba(199,210,254,0.7)" : "rgba(255,255,255,0.3)" }}
                >
                  {o.hint}
                </span>
              )}
            </span>
            {aktif && (
              <Icon icon="solar:check-circle-bold" className="shrink-0 text-base" aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Versi pilih-banyak (kategori). Nilainya daftar dipisah koma. */
export function ChipBanyak({
  opsi,
  nilai,
  onChange,
  kolom = 2,
  label,
}: {
  opsi: OpsiChip[];
  nilai: string[];
  onChange: (v: string[]) => void;
  kolom?: 1 | 2 | 3;
  label: string;
}) {
  const grid =
    kolom === 1 ? "grid-cols-1" : kolom === 3 ? "grid-cols-3" : "grid-cols-2";
  return (
    <div className={`grid ${grid} gap-2`} role="group" aria-label={label}>
      {opsi.map((o) => {
        const aktif = nilai.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={aktif}
            onClick={() =>
              onChange(
                aktif ? nilai.filter((v) => v !== o.value) : [...nilai, o.value]
              )
            }
            className={`flex min-h-[44px] items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition-colors ${RING_FOKUS}`}
            style={aktif ? CHIP_ISI : CHIP_IDLE}
          >
            <span className="min-w-0 flex-1 truncate leading-tight">{o.label}</span>
            {aktif && (
              <Icon icon="solar:check-circle-bold" className="shrink-0 text-base" aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ──────────────────────────── Rentang min–max ────────────────────────── */

const formatId = (raw: string) => {
  const digit = raw.replace(/\D/g, "");
  return digit ? Number(digit).toLocaleString("id-ID") : "";
};

const keDigit = (v: string) => v.replace(/\D/g, "");

/**
 * Sepasang kolom min–max.
 *
 * Angka diformat gaya Indonesia selagi diketik ("500.000.000") karena tanpa
 * pemisah ribuan, satu nol berlebih pada harga properti mustahil dilihat. Yang
 * dikirim keluar selalu digit polos.
 *
 * Min yang lebih besar dari max TIDAK diblokir di sini — mesin filter menukarnya
 * (lihat `rentang()` di listingFilters.ts). Yang ditampilkan hanya catatan
 * bahwa keduanya akan ditukar, supaya pemakai tidak merasa salah ketiknya
 * diabaikan diam-diam.
 */
export function RentangInput({
  min,
  max,
  onMin,
  onMax,
  satuan,
  awalan,
  placeholderMin = "Min",
  placeholderMax = "Maks",
  label,
}: {
  min: string;
  max: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
  satuan?: string;
  awalan?: string;
  placeholderMin?: string;
  placeholderMax?: string;
  label: string;
}) {
  const idMin = useId();
  const idMaks = useId();
  const tertukar =
    min !== "" && max !== "" && Number(keDigit(min)) > Number(keDigit(max));

  const kolom = (
    id: string,
    nilai: string,
    set: (v: string) => void,
    placeholder: string,
    aria: string
  ) => (
    <div className="relative flex-1">
      {awalan && (
        <span
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold"
          style={{ color: "rgba(255,255,255,0.3)" }}
        >
          {awalan}
        </span>
      )}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={nilai}
        aria-label={aria}
        placeholder={placeholder}
        onChange={(e) => set(formatId(e.target.value))}
        className={`h-11 w-full rounded-xl text-[13px] font-semibold outline-none transition-colors placeholder:font-medium ${RING_FOKUS}`}
        style={{
          ...INPUT,
          paddingLeft: awalan ? 34 : 12,
          paddingRight: satuan ? 34 : 12,
        }}
        onFocus={(e) => Object.assign(e.currentTarget.style, INPUT_FOKUS)}
        onBlur={(e) => Object.assign(e.currentTarget.style, INPUT)}
      />
      {satuan && (
        <span
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold"
          style={{ color: "rgba(255,255,255,0.3)" }}
        >
          {satuan}
        </span>
      )}
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-2">
        {kolom(idMin, min, onMin, placeholderMin, `${label} minimum`)}
        <span
          className="shrink-0 text-xs font-medium"
          style={{ color: "rgba(255,255,255,0.25)" }}
          aria-hidden
        >
          s/d
        </span>
        {kolom(idMaks, max, onMax, placeholderMax, `${label} maksimum`)}
      </div>
      {tertukar && (
        <p
          className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug"
          style={{ color: "rgba(252,211,77,0.8)" }}
        >
          <Icon icon="solar:info-circle-linear" className="mt-px shrink-0 text-xs" aria-hidden />
          Nilai minimum lebih besar dari maksimum — keduanya akan ditukar otomatis.
        </p>
      )}
    </div>
  );
}

/** Pintasan rentang siap pakai ("Di bawah Rp 500 jt", dst). */
export function PintasanRentang({
  opsi,
  min,
  max,
  onPilih,
}: {
  opsi: { label: string; min?: number; max?: number }[];
  min: string;
  max: string;
  onPilih: (min: string, max: string) => void;
}) {
  const sama = (a: string, b?: number) =>
    b === undefined ? a === "" : keDigit(a) === String(b);
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {opsi.map((o) => {
        const aktif = sama(min, o.min) && sama(max, o.max);
        return (
          <button
            key={o.label}
            type="button"
            aria-pressed={aktif}
            onClick={() =>
              onPilih(
                o.min === undefined ? "" : o.min.toLocaleString("id-ID"),
                o.max === undefined ? "" : o.max.toLocaleString("id-ID")
              )
            }
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${RING_FOKUS}`}
            style={aktif ? CHIP_ISI : CHIP_IDLE}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ────────────────────────────── Minimal N+ ───────────────────────────── */

/** Baris "1+ 2+ 3+ 4+ 5+" untuk kamar tidur/mandi/lantai. */
export function MinimalN({
  nilai,
  onChange,
  pilihan,
  label,
}: {
  nilai: string;
  onChange: (v: string) => void;
  pilihan: number[];
  label: string;
}) {
  return (
    <div className="flex gap-1.5" role="group" aria-label={label}>
      {pilihan.map((n) => {
        const aktif = nilai === String(n);
        return (
          <button
            key={n}
            type="button"
            aria-pressed={aktif}
            aria-label={`${label} minimal ${n}`}
            onClick={() => onChange(aktif ? "" : String(n))}
            className={`h-11 flex-1 rounded-xl text-[13px] font-bold transition-colors ${RING_FOKUS}`}
            style={aktif ? CHIP_ISI : CHIP_IDLE}
          >
            {n}+
          </button>
        );
      })}
    </div>
  );
}

/* ───────────────────────────────── Sakelar ───────────────────────────── */

export function Sakelar({
  aktif,
  onChange,
  judul,
  keterangan,
  ikon,
}: {
  aktif: boolean;
  onChange: (v: boolean) => void;
  judul: string;
  keterangan?: string;
  ikon?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={aktif}
      onClick={() => onChange(!aktif)}
      className={`flex w-full min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${RING_FOKUS}`}
      style={aktif ? CHIP_ISI : CHIP_IDLE}
    >
      {ikon && <Icon icon={ikon} className="shrink-0 text-lg" aria-hidden />}
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold leading-tight">{judul}</span>
        {keterangan && (
          <span
            className="mt-0.5 block text-[11px] leading-snug"
            style={{ color: aktif ? "rgba(199,210,254,0.7)" : "rgba(255,255,255,0.3)" }}
          >
            {keterangan}
          </span>
        )}
      </span>
      <span
        className="relative h-5 w-9 shrink-0 rounded-full transition-colors"
        style={{
          background: aktif ? AKSEN_TEKS : "rgba(255,255,255,0.15)",
        }}
        aria-hidden
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full transition-all"
          style={{
            left: aktif ? 18 : 2,
            background: aktif ? "#1e1b4b" : "rgba(255,255,255,0.6)",
          }}
        />
      </span>
    </button>
  );
}

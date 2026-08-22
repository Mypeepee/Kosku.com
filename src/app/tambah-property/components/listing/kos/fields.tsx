'use client';

/**
 * Primitif isian kos + token permukaannya.
 *
 * Masalah versi sebelumnya: semua elemen memakai abu-abu di tingkat yang sama
 * (slate-800 untuk border, slate-900 untuk kartu, slate-900 juga untuk input),
 * jadi mata tidak punya petunjuk mana wadah, mana yang bisa diisi, dan mana
 * yang sedang aktif. Hasilnya form terasa seperti dinding abu-abu.
 *
 * Aturannya sekarang cuma tiga tingkat, dan dipakai konsisten:
 *
 *   1. LATAR   — panel step (paling gelap, sudah dari halaman).
 *   2. PANEL   — sedikit LEBIH TERANG dari latar (`bg-white/[0.03]`): ini
 *                "meja kerja", tempat isian dikelompokkan.
 *   3. INPUT   — paling GELAP (`bg-black/40`) + border lebih terang: kontras
 *                berlawanan arah dengan panel, jadi kotak yang bisa diketik
 *                langsung kelihatan tanpa perlu dibaca.
 *
 * Teks: judul putih, label isian slate-200 (bukan slate-500 yang nyaris tidak
 * terbaca), keterangan slate-400. Aksen emerald HANYA untuk keadaan aktif /
 * terpilih, amber HANYA untuk "yang tampil di card listing". Di luar itu tidak
 * ada warna, supaya dua penanda itu benar-benar menonjol.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bath, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  KAMAR_MANDI_TIPE_OPTIONS,
  type KamarMandiTipe,
} from '@/app/tambah-property/types/listing';

// ---------------------------------------------------------------------------
// Token tampilan — dipakai semua komponen kos supaya mustahil menyimpang
// ---------------------------------------------------------------------------

/** Wadah pengelompokan isian: lebih terang dari latar step. */
export const PANEL =
  'rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';

/** Wadah aktif/terpilih. */
export const PANEL_AKTIF =
  'rounded-2xl border border-emerald-400/40 bg-emerald-400/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]';

/** Kotak yang bisa diketik: paling gelap, bordernya paling terang. */
export const INPUT_BASE =
  'w-full rounded-xl border border-white/[0.12] bg-black/40 font-bold text-white transition-colors placeholder:font-medium placeholder:text-slate-500 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/20';

export const INPUT_ERROR =
  'border-red-400/70 focus:border-red-400/70 focus:ring-red-400/20';

/**
 * Tinggi seragam seluruh isian kos.
 *
 * Diturunkan dari 48px ke 44px: kartu tipe kamar memuat sampai tujuh isian,
 * dan pada layar HP tinggi ekstra itu berubah jadi scroll — bukan jadi
 * keterbacaan. 44px masih tepat di ambang target sentuh yang nyaman (44pt),
 * jadi yang hilang cuma ruang kosongnya.
 */
export const INPUT_H = 'h-11';

// ---------------------------------------------------------------------------
// Format & parse
// ---------------------------------------------------------------------------

export const formatRibuan = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  return Math.round(n).toLocaleString('id-ID');
};

export const parseRibuan = (raw: string): number | null => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isNaN(n) || n <= 0 ? null : n;
};

/** Angka bulat tanpa leading zero. `null` = kosong (bukan 0). */
export const parseBulat = (raw: string, izinkanNol = false): number | null => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  if (Number.isNaN(n)) return null;
  if (n === 0 && !izinkanNol) return null;
  return n;
};

/** "1,2 jt" — untuk ringkasan, bukan untuk input. */
export const formatRupiahSingkat = (n: number): string => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace('.0', '')} M`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')} jt`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} rb`;
  return String(n);
};

// ---------------------------------------------------------------------------
// Komponen kecil
// ---------------------------------------------------------------------------

/** Label isian. Sengaja bukan UPPERCASE mikro: 16 label kapital berjejer
 *  membuat semuanya berteriak, dan yang berteriak bersamaan tidak memandu. */
export function Label({
  children,
  htmlFor,
  className,
  wajib,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
  wajib?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        'mb-1.5 block text-[11px] font-semibold tracking-wide text-slate-200',
        className,
      )}
    >
      {children}
      {wajib && <span className="ml-1 text-emerald-400">*</span>}
    </label>
  );
}

/** Alias lama supaya pemakaian yang sudah ada tidak perlu diubah semua. */
export const MicroLabel = Label;

export function Keterangan({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{children}</p>;
}

export function PesanError({ pesan }: { pesan?: string }) {
  return (
    <AnimatePresence>
      {pesan && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="mt-1.5 text-[11px] font-semibold text-red-300"
        >
          {pesan}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

/** Input angka + satuan (luas, kapasitas, jumlah kamar). */
export function AngkaField({
  id,
  label,
  value,
  onChange,
  satuan,
  placeholder,
  icon,
  izinkanNol,
  error,
  hint,
}: {
  id: string;
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  satuan?: string;
  placeholder?: string;
  icon?: React.ReactNode;
  izinkanNol?: boolean;
  error?: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400">
            {icon}
          </span>
        )}
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={value ?? ''}
          onChange={(e) => onChange(parseBulat(e.target.value, izinkanNol))}
          placeholder={placeholder}
          className={cn(
            INPUT_BASE,
            INPUT_H,
            'text-sm',
            icon ? 'pl-9' : 'pl-3.5',
            satuan ? 'pr-11' : 'pr-3.5',
            error && INPUT_ERROR,
          )}
        />
        {satuan && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400">
            {satuan}
          </span>
        )}
      </div>
      {hint && !error && <Keterangan>{hint}</Keterangan>}
      <PesanError pesan={error} />
    </div>
  );
}

/**
 * Input teks pendek + ikon. Dipakai untuk nilai yang TERLIHAT seperti angka
 * tapi bukan angka — lantai & nomor kamar. Di lapangan isinya "A1, A2",
 * "Lt. 2 & 3", "GF"; memaksanya lewat AngkaField akan membuang isian yang
 * sebenarnya benar.
 */
export function TeksField({
  id,
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  icon,
  error,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  icon?: React.ReactNode;
  error?: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400">
            {icon}
          </span>
        )}
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className={cn(
            INPUT_BASE,
            INPUT_H,
            'text-sm',
            icon ? 'pl-9' : 'pl-3.5',
            'pr-3.5',
            error && INPUT_ERROR,
          )}
        />
      </div>
      {hint && !error && <Keterangan>{hint}</Keterangan>}
      <PesanError pesan={error} />
    </div>
  );
}

/**
 * Angka dengan tombol −/+. Dipakai "kamar kosong": angka inilah yang paling
 * sering diubah (tiap penghuni masuk/keluar), dan di HP mengetik ulang angka
 * itu jauh lebih mahal daripada menekan satu tombol. Nilainya di-clamp ke
 * `maks` supaya keadaan mustahil ("sisa 12 dari 8") tidak pernah terbentuk.
 */
export function StepperField({
  id,
  label,
  value,
  onChange,
  maks,
  satuan,
  error,
}: {
  id: string;
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  maks?: number | null;
  satuan?: string;
  error?: string;
}) {
  const angka = Number(value ?? 0);
  const batas = maks && maks > 0 ? maks : null;

  const tombol =
    'grid w-9 shrink-0 place-items-center text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-emerald-300 disabled:text-slate-600 disabled:hover:bg-transparent';

  return (
    <div className="min-w-0">
      <Label htmlFor={id}>{label}</Label>
      <div
        className={cn(
          'flex items-stretch overflow-hidden rounded-xl border border-white/[0.12] bg-black/40 transition-colors focus-within:border-emerald-400/70 focus-within:ring-2 focus-within:ring-emerald-400/20',
          INPUT_H,
          error && 'border-red-400/70',
        )}
      >
        <button
          type="button"
          aria-label={`Kurangi ${label.toLowerCase()}`}
          onClick={() => onChange(Math.max(0, angka - 1))}
          disabled={angka <= 0}
          className={cn(tombol, 'border-r border-white/[0.08]')}
        >
          <Minus className="h-4 w-4" strokeWidth={3} />
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={value ?? ''}
          onChange={(e) => {
            const v = parseBulat(e.target.value, true);
            onChange(v != null && batas ? Math.min(v, batas) : v);
          }}
          placeholder="0"
          className="min-w-0 flex-1 bg-transparent text-center text-sm font-black text-white placeholder:font-medium placeholder:text-slate-500 focus:outline-none"
        />
        {satuan && (
          <span className="grid shrink-0 place-items-center pr-1 text-xs font-semibold text-slate-400">
            {satuan}
          </span>
        )}
        <button
          type="button"
          aria-label={`Tambah ${label.toLowerCase()}`}
          onClick={() => onChange(batas ? Math.min(batas, angka + 1) : angka + 1)}
          disabled={!!batas && angka >= batas}
          className={cn(tombol, 'border-l border-white/[0.08]')}
        >
          <Plus className="h-4 w-4" strokeWidth={3} />
        </button>
      </div>
      <PesanError pesan={error} />
    </div>
  );
}

/** Dalam / Luar. Tekan pilihan yang sama = batalkan (boleh tidak dijawab). */
export function PilihKamarMandi({
  value,
  onChange,
  label = 'Kamar mandi',
}: {
  value?: KamarMandiTipe | null;
  onChange: (v: KamarMandiTipe | null) => void;
  label?: string;
}) {
  return (
    <div className="min-w-0">
      <Label>{label}</Label>
      <div className="flex gap-2">
        {KAMAR_MANDI_TIPE_OPTIONS.map((o) => {
          const aktif = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={aktif}
              onClick={() => onChange(aktif ? null : (o.value as KamarMandiTipe))}
              className={cn(
                'flex-1 rounded-xl border text-xs font-bold transition-all sm:text-sm',
                INPUT_H,
                aktif
                  ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-200'
                  : 'border-white/[0.12] bg-black/40 text-slate-300 hover:border-emerald-400/30 hover:bg-white/[0.04] hover:text-white',
              )}
            >
              <span className="inline-flex items-center gap-2">
                <Bath className={cn('h-4 w-4', aktif ? 'text-emerald-300' : 'text-slate-400')} />
                {o.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Bar hunian — menerjemahkan dua angka (jumlah & kosong) jadi satu kalimat
 * yang langsung terbaca: "5 dari 8 terisi · 3 kamar kosong".
 */
export function BarHunian({
  jumlah,
  tersedia,
}: {
  jumlah: number;
  tersedia: number;
}) {
  if (!jumlah || jumlah <= 0) return null;
  const terisi = Math.max(0, jumlah - tersedia);
  const persen = Math.min(100, (terisi / jumlah) * 100);

  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-black/50">
        <motion.div
          className={cn(
            'h-full rounded-full',
            persen >= 100
              ? 'bg-gradient-to-r from-slate-500 to-slate-400'
              : 'bg-gradient-to-r from-emerald-400 to-teal-400',
          )}
          initial={false}
          animate={{ width: `${persen}%` }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        />
      </div>
      <p className="mt-2 text-xs font-medium text-slate-300">
        {terisi} dari {jumlah} terisi ·{' '}
        <span
          className={cn(
            'font-bold',
            tersedia > 0 ? 'text-emerald-300' : 'text-slate-400',
          )}
        >
          {tersedia > 0 ? `${tersedia} kamar kosong` : 'penuh'}
        </span>
      </p>
    </div>
  );
}

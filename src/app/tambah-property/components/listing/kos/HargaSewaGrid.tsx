'use client';

/**
 * HargaSewaGrid — SEMUA harga sewa di satu tempat.
 *
 * Kenapa satu grid, bukan input harga di dalam tiap kartu tipe kamar: harga
 * adalah hal yang paling sering dibandingkan pemilik ("tipe dalam lebih mahal
 * berapa dari tipe luar?"). Kalau angkanya tersebar di kartu-kartu yang harus
 * di-scroll, perbandingan itu mustahil dilakukan sambil mengisi — dan yang
 * lebih buruk, tidak ada satu tempat pun yang bisa dijawab "jadi harga kos ini
 * berapa?".
 *
 * Susunannya: durasi = kolom (kebijakan satu kos), tipe kamar = baris. Urutan
 * pengisiannya searah cara pemilik berpikir: pilih durasi yang ditawarkan →
 * isi harga tiap tipe → tentukan angka mana yang tampil di card.
 *
 * Tiap input tetap membawa label durasinya sendiri (bukan hanya mengandalkan
 * header kolom), supaya di layar sempit — saat kolom melipat jadi dua-dua —
 * tidak ada input harga yang kehilangan konteks.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  Lock,
  Sun,
  TriangleAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DURASI_SEWA_OPTIONS,
  type DurasiSewa,
} from '@/app/tambah-property/types/listing';
import {
  INPUT_BASE,
  INPUT_H,
  Label,
  PANEL,
  formatRibuan,
  parseRibuan,
} from './fields';

const DURASI_ICON: Record<DurasiSewa, React.ReactNode> = {
  HARIAN: <Sun className="h-3.5 w-3.5" />,
  MINGGUAN: <CalendarDays className="h-3.5 w-3.5" />,
  BULANAN: <Calendar className="h-3.5 w-3.5" />,
  TAHUNAN: <CalendarRange className="h-3.5 w-3.5" />,
};

const labelDurasi = (d: DurasiSewa) =>
  DURASI_SEWA_OPTIONS.find((o) => o.value === d)?.label ?? d;

const suffixDurasi = (d: DurasiSewa) =>
  DURASI_SEWA_OPTIONS.find((o) => o.value === d)?.suffix ?? '';

/** Satu baris harga: satu tipe kamar, atau "semua kamar" saat mode seragam. */
export interface BarisHarga {
  key: string;
  label: string;
  /** Konteks singkat, mis. "8 kamar · 3 kosong · KM Luar". */
  meta?: string;
  harga: Partial<Record<DurasiSewa, number | null | undefined>>;
  onHarga: (durasi: DurasiSewa, nilai: number | null) => void;
}

interface Props {
  baris: BarisHarga[];
  /**
   * Durasi yang SAH untuk kategori listing ini (lihat @/lib/sewaKapabilitas).
   *
   * Bukan sekadar penyaring tampilan: chip di luar daftar ini tidak dirender
   * sama sekali, jadi tidak ada jalan bagi agent untuk mengetik tarif harian
   * pada sebuah gudang. Durasi yang salah lebih baik tidak pernah ada di layar
   * daripada ditolak setelah diketik — pesan error yang muncul setelah usaha
   * selalu terbaca sebagai "aplikasinya rewel", bukan sebagai aturan.
   */
  durasiTersedia: DurasiSewa[];
  /** Durasi yang menyala (ditawarkan kos ini). */
  durasiAktif: DurasiSewa[];
  /** Dikunci oleh minimal sewa — mustahil ditawarkan. */
  durasiTerkunci: DurasiSewa[];
  onToggleDurasi: (d: DurasiSewa) => void;
  /** Durasi yang harganya tampil di card listing. */
  durasiUtama?: DurasiSewa | null;
  onPilihUtama: (d: DurasiSewa) => void;
  /** Durasi yang sudah ada isinya di minimal satu baris. */
  durasiTerisi: DurasiSewa[];
  /** Angka yang nanti tampil di card + apakah berupa "mulai dari". */
  hargaTampil?: { nominal: number; durasi: DurasiSewa; mulaiDari: boolean } | null;
  error?: string;
}

export function HargaSewaGrid({
  baris,
  durasiTersedia,
  durasiAktif,
  durasiTerkunci,
  onToggleDurasi,
  durasiUtama,
  onPilihUtama,
  durasiTerisi,
  hargaTampil,
  error,
}: Props) {
  // Urutan kanonik (harian → tahunan) dipertahankan, hanya isinya yang disaring
  // oleh kategori. Menyusun ulang dari `durasiTersedia` langsung akan membuat
  // urutan kolom mengikuti urutan penulisan tabel kapabilitas, bukan urutan
  // waktu yang dibaca orang.
  const semuaDurasi = DURASI_SEWA_OPTIONS.map((o) => o.value).filter((d) =>
    durasiTersedia.includes(d),
  );

  // Durasi yang sudah terisi harus tetap tampil walau togglenya mati: kalau
  // tidak, angkanya tersimpan tapi tidak terlihat & tidak bisa dihapus.
  const kolom = semuaDurasi.filter(
    (d) => durasiAktif.includes(d) || durasiTerisi.includes(d),
  );

  return (
    <div className="space-y-4">
      {/* --- Pilih durasi yang ditawarkan ------------------------------- */}
      <div>
        <Label>Durasi sewa yang ditawarkan</Label>
        {/* Di HP: grid 2×2 yang rapi. Wrap bebas membuat baris kedua cuma
            berisi satu chip dan terlihat seperti kesalahan render. */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {semuaDurasi.map((d) => {
            const terkunci = durasiTerkunci.includes(d);
            const aktif = !terkunci && (durasiAktif.includes(d) || durasiTerisi.includes(d));

            return (
              <button
                key={d}
                type="button"
                role="switch"
                aria-checked={aktif}
                disabled={terkunci}
                onClick={() => onToggleDurasi(d)}
                title={
                  terkunci
                    ? 'Dikunci oleh minimal sewa — durasi ini lebih pendek dari komitmen minimal'
                    : aktif
                    ? `Berhenti menawarkan harga ${labelDurasi(d).toLowerCase()}`
                    : `Tawarkan harga ${labelDurasi(d).toLowerCase()}`
                }
                className={cn(
                  'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold transition-all sm:justify-start sm:px-4',
                  terkunci
                    ? 'cursor-not-allowed border-white/[0.06] bg-black/30 text-slate-600'
                    : aktif
                    ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-200'
                    : 'border-white/[0.12] bg-black/40 text-slate-300 hover:border-emerald-400/30 hover:bg-white/[0.04] hover:text-white',
                )}
              >
                {terkunci ? <Lock className="h-3.5 w-3.5" /> : DURASI_ICON[d]}
                {labelDurasi(d)}
              </button>
            );
          })}
        </div>
      </div>

      {/* --- Grid harga -------------------------------------------------- */}
      {kolom.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.02] px-4 py-7 text-center">
          <p className="text-sm font-bold text-slate-200">
            Pilih dulu durasi sewanya di atas
          </p>
          <p className="mt-1.5 text-xs text-slate-400">
            Kolom harga muncul mengikuti durasi yang Anda nyalakan.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {baris.map((row) => {
            const adaIsi = kolom.some((d) => {
              const v = row.harga[d];
              return v != null && Number(v) > 0;
            });

            return (
              <div
                key={row.key}
                className={cn(
                  PANEL,
                  'p-4 transition-colors',
                  !adaIsi && 'border-amber-400/30',
                )}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
                  {/* Identitas baris — dari lg baru sejajar dengan inputnya;
                      di bawah itu label di atas supaya input harga tidak
                      terhimpit di layar tablet/HP. */}
                  <div className="min-w-0 lg:w-48 lg:shrink-0">
                    <p className="truncate text-base font-bold text-white">
                      {row.label}
                    </p>
                    {row.meta && (
                      <p className="mt-1 truncate text-xs text-slate-400">
                        {row.meta}
                      </p>
                    )}
                    {!adaIsi && (
                      <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-amber-400/10 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                        Belum ada harga
                      </p>
                    )}
                  </div>

                  {/* Harga per durasi */}
                  <div
                    className={cn(
                      'grid flex-1 gap-2.5',
                      kolom.length === 1
                        ? 'grid-cols-1'
                        : kolom.length === 2
                        ? 'grid-cols-1 sm:grid-cols-2'
                        : 'grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4',
                    )}
                  >
                    {kolom.map((d) => {
                      const id = `harga-${row.key}-${d.toLowerCase()}`;
                      const nilai = row.harga[d];
                      const utama = durasiUtama === d;

                      return (
                        <div key={d} className="min-w-0">
                          <label
                            htmlFor={id}
                            className={cn(
                              'mb-2 flex items-center gap-1.5 text-xs font-semibold',
                              utama ? 'text-amber-300' : 'text-slate-200',
                            )}
                          >
                            {labelDurasi(d)}
                            {utama && (
                              <span
                                className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300"
                                title="Harga ini yang tampil di card listing"
                              >
                                ★ di card
                              </span>
                            )}
                          </label>
                          <div className="relative">
                            <span
                              className={cn(
                                'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold',
                                nilai ? 'text-emerald-400' : 'text-slate-500',
                              )}
                            >
                              Rp
                            </span>
                            <input
                              id={id}
                              type="text"
                              inputMode="numeric"
                              value={formatRibuan(nilai)}
                              onChange={(e) =>
                                row.onHarga(d, parseRibuan(e.target.value))
                              }
                              placeholder="0"
                              aria-label={`Harga ${labelDurasi(d)} untuk ${row.label}`}
                              className={cn(
                                INPUT_BASE,
                                INPUT_H,
                                'pl-11 pr-16 text-base',
                                utama && nilai && 'border-amber-400/50',
                              )}
                            />
                            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                              {suffixDurasi(d)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
          <p className="text-xs font-semibold leading-relaxed text-red-200">
            {error}
          </p>
        </div>
      )}

      {/* --- Harga yang tampil di card ----------------------------------- */}
      <AnimatePresence initial={false}>
        {durasiTerisi.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-400/[0.12] via-emerald-400/[0.05] to-transparent p-4"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-emerald-300/90">
                  Yang dilihat pencari kos
                </p>
                {hargaTampil ? (
                  <p className="mt-1.5 text-2xl font-black leading-none tracking-tight text-white">
                    {hargaTampil.mulaiDari && (
                      <span className="mr-1.5 align-middle text-xs font-bold uppercase tracking-wider text-slate-400">
                        mulai
                      </span>
                    )}
                    Rp {hargaTampil.nominal.toLocaleString('id-ID')}
                    <span className="ml-1 text-sm font-semibold text-slate-400">
                      {suffixDurasi(hargaTampil.durasi)}
                    </span>
                  </p>
                ) : (
                  <p className="mt-1.5 text-2xl font-black text-slate-600">—</p>
                )}
              </div>

              {/* Pemilih durasi utama hanya muncul kalau memang ada pilihan.
                  Satu durasi terisi = tidak ada yang perlu dipilih. */}
              {durasiTerisi.length > 1 && (
                <div className="min-w-0">
                  <Label className="mb-1.5">Pakai harga</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {durasiTerisi.map((d) => {
                      const aktif = durasiUtama === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={aktif}
                          onClick={() => onPilihUtama(d)}
                          className={cn(
                            'min-h-[44px] flex-1 rounded-lg border px-3 py-2 text-xs font-bold transition-colors sm:flex-none',
                            aktif
                              ? 'border-amber-400/50 bg-amber-400/20 text-amber-200'
                              : 'border-white/[0.12] bg-black/30 text-slate-300 hover:bg-white/[0.06] hover:text-white',
                          )}
                        >
                          {labelDurasi(d)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {hargaTampil?.mulaiDari && (
              <p className="mt-3 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-slate-400">
                Tipe kamar Anda harganya berbeda-beda, jadi card menampilkan yang
                termurah dengan awalan “mulai” — pencari tidak akan merasa
                dibohongi saat menanyakan tipe yang lebih mahal.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default HargaSewaGrid;

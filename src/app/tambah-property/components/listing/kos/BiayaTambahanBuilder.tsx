'use client';

/**
 * BiayaTambahanBuilder — daftar biaya di luar harga sewa & deposit.
 *
 * Masalah yang diselesaikan: keluhan paling sering penyewa kos/apartemen
 * adalah angka di iklan bukan angka yang dibayar. Listrik, air, wifi, IPL &
 * kebersihan baru disebut saat survei, dan calon penyewa merasa dikelabui —
 * padahal pemiliknya sering tidak berniat menyembunyikan, cuma tidak ada
 * tempat untuk menuliskannya.
 *
 * Keputusan desain:
 *
 * 1. Terstruktur (nama + nominal + periode), bukan satu kotak teks bebas.
 *    Hanya bentuk ini yang bisa dijumlahkan jadi estimasi tagihan bulan
 *    pertama di halaman detail — dan angka itulah gunanya.
 * 2. Preset di depan. Delapan nama yang menutup hampir semua kasus nyata;
 *    menekan satu preset langsung membuat barisnya dengan periode yang benar,
 *    jadi jalur tercepat tidak butuh mengetik sama sekali.
 * 3. Nominal boleh kosong. "Listrik: bayar sesuai pemakaian" adalah keadaan
 *    yang sangat umum di kos, dan memaksa angka di situ akan membuat pemilik
 *    mengarang nominal. Baris tanpa nominal tampil sebagai "sesuai pemakaian".
 * 4. Baris tanpa NAMA yang dibuang saat submit — bukan baris tanpa nominal.
 * 5. SATU BARIS BERSEGMEN, bukan tiga isian bertumpuk. Versi sebelumnya baru
 *    menyatu jadi satu baris di layar ≥640px; di HP tiap biaya memakan enam
 *    baris (tiga label + tiga kotak) sehingga daftar lima biaya berarti 30
 *    baris scroll untuk 15 kata. Sekarang nama mengambil satu baris penuh
 *    (itu satu-satunya yang panjangnya tidak terduga), sedangkan nominal &
 *    periode berbagi baris di bawahnya — dua isian pendek yang memang selalu
 *    dibaca bersamaan.
 * 6. Periode pakai tiga tombol, bukan `<select>` bawaan. Pilihannya hanya
 *    tiga dan semuanya pendek; membuka lembar pilihan sistem untuk itu adalah
 *    tiga ketukan untuk pekerjaan satu ketukan — selain wujudnya yang selalu
 *    keluar dari bahasa visual form ini.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { Plus, Receipt, Trash2, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BIAYA_PERIODE_OPTIONS,
  BIAYA_TAMBAHAN_PRESET,
  MAKS_BIAYA_TAMBAHAN,
  type BiayaPeriode,
  type BiayaTambahan,
} from '@/app/tambah-property/types/listing';
import {
  formatRibuan,
  formatRupiahSingkat,
  INPUT_BASE,
  INPUT_H,
  PANEL,
  parseRibuan,
} from './fields';

/**
 * Kolom nominal. "Rp" jadi awalan di dalam kotak, bukan label di atasnya —
 * satu-satunya hal yang perlu diketahui tentang kotak ini adalah mata uangnya,
 * dan itu sudah terjawab tanpa memakan baris.
 */
function NominalBiaya({
  id,
  nilai,
  onChange,
}: {
  id: string;
  nilai: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-emerald-400">
        Rp
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={formatRibuan(nilai)}
        onChange={(e) => onChange(parseRibuan(e.target.value))}
        placeholder="Sesuai pemakaian"
        aria-label="Nominal biaya"
        className={cn(
          INPUT_BASE,
          INPUT_H,
          'w-full pl-9 pr-3 text-sm placeholder:text-xs',
        )}
      />
    </div>
  );
}

/**
 * Periode tagihan sebagai tiga tombol.
 *
 * Labelnya dipendekkan ("Bulan" alih-alih "Per bulan") karena konteksnya sudah
 * dijawab oleh judul bagian ini — dan pemendekan itulah yang membuat ketiganya
 * muat berdampingan di layar 360px, bukan berganti jadi dropdown.
 */
const PERIODE_PENDEK: Record<BiayaPeriode, string> = {
  BULANAN: 'Bulan',
  TAHUNAN: 'Tahun',
  SEKALI: 'Sekali',
};

function PeriodeBiaya({
  nilai,
  onChange,
}: {
  nilai: BiayaPeriode;
  onChange: (v: BiayaPeriode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Periode tagihan"
      className={cn(
        'flex shrink-0 items-center gap-0.5 rounded-xl border border-white/[0.12] bg-black/40 p-1',
        INPUT_H,
      )}
    >
      {BIAYA_PERIODE_OPTIONS.map((p) => {
        const aktif = nilai === p.value;
        return (
          <button
            key={p.value}
            type="button"
            aria-pressed={aktif}
            onClick={() => onChange(p.value)}
            title={p.label}
            className={cn(
              'h-full rounded-lg px-2 text-[11px] font-bold transition-colors sm:px-2.5 sm:text-xs',
              aktif
                ? 'bg-emerald-400/20 text-emerald-200'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
            )}
          >
            {PERIODE_PENDEK[p.value]}
          </button>
        );
      })}
    </div>
  );
}

interface BiayaTambahanBuilderProps {
  value: BiayaTambahan[];
  onChange: (next: BiayaTambahan[]) => void;
  /** Harga sewa utama — dipakai menghitung estimasi bulan pertama. */
  hargaUtama?: number | null;
}

export function BiayaTambahanBuilder({
  value,
  onChange,
  hargaUtama,
}: BiayaTambahanBuilderProps) {
  const rows = value ?? [];
  const penuh = rows.length >= MAKS_BIAYA_TAMBAHAN;

  const patch = (i: number, next: Partial<BiayaTambahan>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...next } : r)));

  const hapus = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  const tambah = (isi?: Partial<BiayaTambahan>) => {
    if (penuh) return;
    onChange([...rows, { nama: '', nominal: null, periode: 'BULANAN', ...isi }]);
  };

  // Preset yang namanya sudah dipakai tidak ditawarkan lagi — menekannya cuma
  // akan membuat dua baris "Listrik" yang saling bertentangan.
  const presetTersisa = BIAYA_TAMBAHAN_PRESET.filter(
    (p) => !rows.some((r) => r.nama.trim().toLowerCase() === p.nama.toLowerCase()),
  );

  // Estimasi bulan pertama: harga sewa + seluruh biaya bulanan + biaya sekali
  // bayar. Biaya tahunan sengaja TIDAK dibagi 12 — yang ditagih di bulan
  // pertama adalah nominal utuhnya, dan estimasi yang lebih kecil dari tagihan
  // sebenarnya persis kesalahan yang sedang dihindari komponen ini.
  const totalBulanan = rows
    .filter((r) => r.periode === 'BULANAN')
    .reduce((a, r) => a + (Number(r.nominal) || 0), 0);
  const totalSekali = rows
    .filter((r) => r.periode !== 'BULANAN')
    .reduce((a, r) => a + (Number(r.nominal) || 0), 0);
  const adaNominal = totalBulanan + totalSekali > 0;
  const estimasiAwal = (Number(hargaUtama) || 0) + totalBulanan + totalSekali;

  return (
    <div className="space-y-3">
      {rows.length > 0 && (
        <div className={cn(PANEL, 'divide-y divide-white/[0.08] overflow-hidden')}>
          <AnimatePresence initial={false}>
            {rows.map((row, i) => (
              <motion.div
                key={i}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6, transition: { duration: 0.14 } }}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-2.5 sm:p-3.5"
              >
                {/* `sm:contents` melarutkan kedua pembungkus ini di layar lebar
                    sehingga keempat bagian jadi anak langsung dari baris flex —
                    satu markup untuk dua tata letak, tanpa merender isian yang
                    sama dua kali (dua input terkendali untuk satu nilai adalah
                    sumber bug fokus & kursor yang tidak sepadan dengan
                    hematannya). */}
                <div className="flex items-center gap-2 sm:contents">
                  <input
                    id={`biaya-nama-${i}`}
                    type="text"
                    value={row.nama}
                    onChange={(e) => patch(i, { nama: e.target.value })}
                    placeholder="Nama biaya — mis. Listrik"
                    aria-label={`Nama biaya ${i + 1}`}
                    maxLength={60}
                    className={cn(
                      INPUT_BASE,
                      INPUT_H,
                      'min-w-0 flex-1 px-3.5 text-sm placeholder:text-xs sm:max-w-[220px] sm:placeholder:text-sm',
                    )}
                  />

                  <button
                    type="button"
                    onClick={() => hapus(i)}
                    aria-label={`Hapus biaya ${row.nama || i + 1}`}
                    className={cn(
                      'grid shrink-0 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-red-400/10 hover:text-red-300',
                      INPUT_H,
                      'w-9 sm:order-3',
                    )}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 sm:contents">
                  <NominalBiaya
                    id={`biaya-nominal-${i}`}
                    nilai={row.nominal ?? null}
                    onChange={(v) => patch(i, { nominal: v })}
                  />
                  <PeriodeBiaya
                    nilai={row.periode}
                    onChange={(v) => patch(i, { periode: v })}
                  />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Preset — jalur tercepat, tidak perlu mengetik nama sama sekali */}
      {!penuh && presetTersisa.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {presetTersisa.slice(0, 5).map((p) => (
            <button
              key={p.nama}
              type="button"
              onClick={() => tambah({ nama: p.nama, periode: p.periode })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-black/40 px-2.5 py-1.5 text-xs font-bold text-slate-200 transition-colors hover:border-emerald-400/50 hover:bg-emerald-400/[0.12] hover:text-emerald-200 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm"
            >
              <Icon icon={p.icon} className="h-3.5 w-3.5 text-emerald-400 sm:h-4 sm:w-4" />
              {p.nama}
              <Plus className="h-3 w-3 opacity-60" strokeWidth={3} />
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => tambah()}
        disabled={penuh}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed py-2.5 text-sm font-bold transition-all',
          penuh
            ? 'cursor-not-allowed border-white/[0.08] text-slate-600'
            : 'border-emerald-400/40 bg-emerald-400/[0.08] text-emerald-300 hover:border-emerald-400/70 hover:bg-emerald-400/[0.16] hover:text-emerald-200',
        )}
      >
        <span
          className={cn(
            'grid h-6 w-6 place-items-center rounded-lg transition-colors',
            penuh ? 'bg-white/[0.06]' : 'bg-emerald-400/25',
          )}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        {penuh ? `Maksimal ${MAKS_BIAYA_TAMBAHAN} biaya` : 'Tambah biaya lain'}
      </button>

      {/* Estimasi bulan pertama — inilah alasan biaya disimpan terstruktur:
          angka yang benar-benar dibayar penyewa di awal, bukan harga sewanya
          saja. Ditampilkan ke agent supaya dia melihat lebih dulu apa yang
          nanti dilihat calon penyewa di halaman detail. */}
      <AnimatePresence>
        {adaNominal && Number(hargaUtama) > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3"
          >
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Receipt className="h-4 w-4 shrink-0 text-amber-300" />
              Estimasi bayaran pertama penyewa
            </span>
            <span className="text-sm font-black text-amber-200">
              Rp {estimasiAwal.toLocaleString('id-ID')}
              <span className="ml-1.5 text-[11px] font-semibold text-amber-300/70">
                (sewa + {formatRupiahSingkat(totalBulanan + totalSekali)} biaya)
              </span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {rows.length === 0 && (
        <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
          <Wallet className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-400" />
          Kosongkan kalau harga sewa sudah mencakup semuanya. Kalau ada yang
          ditagih terpisah, sebutkan di sini — penyewa paling sering kecewa
          karena biaya yang baru diketahui saat survei.
        </p>
      )}
    </div>
  );
}

export default BiayaTambahanBuilder;

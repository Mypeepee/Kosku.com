'use client';

/**
 * TermasukBiaya — "harga ini sudah termasuk listrik & air, atau belum?".
 *
 * Ditempatkan menempel dengan harga (bukan di step spesifikasi) karena ia
 * MENGUBAH ARTI angka harga: Rp 900rb termasuk listrik & air itu tawaran yang
 * sama sekali berbeda dari Rp 900rb + tagihan sendiri. Pertanyaan nomor dua
 * tiap pencari kos setelah melihat harga, dan penyebab paling umum salah
 * paham saat survei.
 *
 * Tiga keadaan, bukan dua: Ya / Tidak / belum dijawab. "Belum dijawab" tidak
 * boleh disamakan dengan "Tidak" — halaman publik harus bisa membedakan
 * "listrik dibayar sendiri" dari "pemilik belum memberi tahu".
 */

import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Droplets, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ListingFormData } from '@/lib/validations/listing';
import { PANEL } from './fields';

interface Props {
  form: UseFormReturn<ListingFormData>;
}

type Tagihan = {
  field: 'termasuk_listrik' | 'termasuk_air';
  label: string;
  icon: React.ReactNode;
  contoh: string;
};

const TAGIHAN: Tagihan[] = [
  {
    field: 'termasuk_listrik',
    label: 'Listrik',
    icon: <Zap className="h-4 w-4" />,
    contoh: 'token/tagihan PLN',
  },
  {
    field: 'termasuk_air',
    label: 'Air',
    icon: <Droplets className="h-4 w-4" />,
    contoh: 'PDAM / pompa',
  },
];

export function TermasukBiaya({ form }: Props) {
  const { watch, setValue } = form;

  const nilai = (f: Tagihan['field']) => watch(f) as boolean | null | undefined;

  const set = (f: Tagihan['field'], v: boolean) =>
    setValue(f, v, { shouldValidate: true, shouldDirty: true });

  const listrik = nilai('termasuk_listrik');
  const air = nilai('termasuk_air');

  // Kalimat kesimpulan — dua toggle jadi satu pernyataan yang dibaca penyewa.
  const kesimpulan = (() => {
    if (listrik == null && air == null) return null;
    if (listrik === true && air === true) return 'Harga sudah termasuk listrik & air';
    if (listrik === false && air === false)
      return 'Listrik & air dibayar penghuni terpisah';
    const termasuk = [listrik === true && 'listrik', air === true && 'air'].filter(
      Boolean,
    );
    const luar = [listrik === false && 'listrik', air === false && 'air'].filter(
      Boolean,
    );
    if (termasuk.length && luar.length)
      return `Termasuk ${termasuk.join(' & ')}; ${luar.join(' & ')} dibayar terpisah`;
    return `Termasuk ${termasuk.join(' & ')}`;
  })();

  return (
    <div className={cn(PANEL, 'p-5')}>
      <div className="mb-4">
        <h4 className="text-base font-bold text-white">Termasuk dalam harga?</h4>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          Ini yang paling sering ditanyakan setelah harga — dan paling sering jadi
          salah paham saat survei.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {TAGIHAN.map((t) => {
          const v = nilai(t.field);
          return (
            <div
              key={t.field}
              className="rounded-xl border border-white/[0.10] bg-black/30 p-3.5"
            >
              <div className="mb-3 flex items-center gap-2.5">
                <span
                  className={cn(
                    'grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors',
                    v === true
                      ? 'border-emerald-400/40 bg-emerald-400/20 text-emerald-300'
                      : 'border-white/[0.10] bg-white/[0.04] text-slate-300',
                  )}
                >
                  {t.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">{t.label}</p>
                  <p className="truncate text-[11px] text-slate-400">{t.contoh}</p>
                </div>
              </div>

              <div className="flex gap-2">
                {[
                  { v: true, label: 'Termasuk' },
                  { v: false, label: 'Bayar sendiri' },
                ].map((o) => {
                  const aktif = v === o.v;
                  return (
                    <button
                      key={o.label}
                      type="button"
                      aria-pressed={aktif}
                      onClick={() => set(t.field, o.v)}
                      className={cn(
                        'h-11 flex-1 rounded-xl border text-xs font-bold transition-all',
                        aktif && o.v
                          ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-200'
                          : aktif
                          ? 'border-white/25 bg-white/[0.10] text-white'
                          : 'border-white/[0.12] bg-black/40 text-slate-300 hover:border-white/25 hover:bg-white/[0.06] hover:text-white',
                      )}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {kesimpulan && (
        <p className="mt-3.5 border-t border-white/10 pt-3.5 text-xs font-semibold text-slate-200">
          {kesimpulan}
        </p>
      )}
    </div>
  );
}

export default TermasukBiaya;

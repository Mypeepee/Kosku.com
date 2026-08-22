'use client';

/**
 * KamarSeragamFields — isian kamar untuk kos yang semua kamarnya sama.
 *
 * Field-field ini sebelumnya ada di step Spesifikasi, terpisah dari harga.
 * Akibatnya pemilik ditanya "berapa harganya" sebelum pernah ditanya "kamarnya
 * seperti apa dan ada berapa" — padahal itu urutan berpikir yang sebenarnya,
 * dan justru jumlah/tipe kamar itulah yang menentukan harganya beda atau tidak.
 * Sekarang keduanya satu tempat dengan penyusun tipe kamar, jadi lokasi isian
 * "kamar" tidak berpindah-pindah tergantung mode.
 */

import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Ruler, Users } from 'lucide-react';
import { ListingFormData } from '@/lib/validations/listing';
import {
  AngkaField,
  BarHunian,
  PANEL,
  PilihKamarMandi,
  StepperField,
} from './fields';

interface Props {
  form: UseFormReturn<ListingFormData>;
  /**
   * Mode sunting — "kamar kosong sekarang" dikunci.
   *
   * Sejak ada kalender ketersediaan, angka itu TURUNAN dari
   * `listing_ketersediaan` dan dihitung ulang server setiap penyimpanan.
   * Membiarkannya bisa diketik berarti menjanjikan kendali yang tidak ada:
   * apa pun yang diisi agent akan ditimpa, dan dia menyimpulkan tombolnya
   * rusak. Saat membuat listing baru belum ada kalender apa pun, jadi di sana
   * angkanya justru masih jadi titik awal yang sah.
   */
  isEditMode?: boolean;
}

export function KamarSeragamFields({ form, isEditMode = false }: Props) {
  const { watch, setValue, formState: { errors } } = form;

  const totalKamar = watch('total_kamar');
  const kamarTersedia = watch('kamar_tersedia');
  const luasKamar = watch('luas_kamar');
  const kapasitas = watch('kapasitas_penghuni');
  const kamarMandiTipe = watch('kamar_mandi_tipe');

  // Cast: PathValue-nya react-hook-form tidak bisa disempitkan lewat generic
  // `keyof` sederhana, dan seluruh wizard ini memang sudah memakai pola yang
  // sama untuk setValue bernilai opsional.
  const set = (key: keyof ListingFormData, value: unknown) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setValue(key as any, value as any, {
      shouldValidate: true,
      shouldDirty: true,
    });

  const jumlah = Number(totalKamar ?? 0);
  const tersedia = Number(kamarTersedia ?? 0);

  return (
    <div className={`${PANEL} space-y-5 p-5`}>
      {/* Ketersediaan — bagian yang di-update rutin, jadi ditaruh paling atas */}
      <div className="grid gap-4 sm:grid-cols-2">
        <AngkaField
          id="kos-total-kamar"
          label="Jumlah kamar di kos ini"
          value={(totalKamar as number | null) ?? null}
          onChange={(v) => {
            set('total_kamar', v ?? undefined);
            // Sisa kamar mengikuti supaya tidak pernah melebihi jumlahnya.
            if (v != null && tersedia > v) set('kamar_tersedia', v);
          }}
          satuan="kamar"
          placeholder="10"
          error={errors.total_kamar?.message}
        />

        {isEditMode ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[11px] font-semibold text-white/40">
              Kamar kosong sekarang
            </p>
            <p className="mt-1 text-lg font-extrabold tabular-nums text-white/70">
              {tersedia}
              <span className="ml-1 text-xs font-semibold text-white/30">
                kamar
              </span>
            </p>
            <p className="mt-1.5 text-[10.5px] leading-snug text-white/35">
              Dihitung otomatis dari kalender ketersediaan. Ubah lewat{' '}
              <span className="font-semibold text-white/55">
                Kelola Ketersediaan
              </span>{' '}
              di halaman detail listing.
            </p>
          </div>
        ) : (
          <StepperField
            id="kos-kamar-tersedia"
            label="Kamar kosong sekarang"
            value={(kamarTersedia as number | null) ?? null}
            onChange={(v) => set('kamar_tersedia', v ?? undefined)}
            maks={jumlah > 0 ? jumlah : null}
            error={errors.kamar_tersedia?.message}
          />
        )}
      </div>

      <BarHunian jumlah={jumlah} tersedia={tersedia} />

      {/* Spesifikasi kamar — sekali isi */}
      <div className="grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-2 xl:grid-cols-4">
        {/* Kamar mandi = dua tombol, jadi butuh dua kolom sampai layar lebar. */}
        <div className="sm:col-span-2">
        <PilihKamarMandi
          value={(kamarMandiTipe as 'DALAM' | 'LUAR' | null) ?? null}
          onChange={(v) => set('kamar_mandi_tipe', v ?? undefined)}
        />
        </div>

        <AngkaField
          id="kos-luas-kamar"
          label="Luas kamar"
          value={(luasKamar as number | null) ?? null}
          onChange={(v) => set('luas_kamar', v ?? undefined)}
          satuan="m²"
          placeholder="12"
          icon={<Ruler className="h-3.5 w-3.5" />}
        />

        <AngkaField
          id="kos-kapasitas"
          label="Maks penghuni"
          value={(kapasitas as number | null) ?? null}
          onChange={(v) => set('kapasitas_penghuni', v ?? undefined)}
          satuan="org"
          placeholder="1"
          icon={<Users className="h-3.5 w-3.5" />}
          error={errors.kapasitas_penghuni?.message}
        />
      </div>
    </div>
  );
}

export default KamarSeragamFields;

'use client';

/**
 * FasilitasSection — fasilitas kos, dipisah berdasarkan CAKUPANNYA.
 *
 * Ini pertanyaan pertama tiap pencari kos: "apa yang saya dapat sendiri di
 * kamar, dan apa yang dipakai bareng-bareng?". Karena itu keduanya tidak boleh
 * jadi satu daftar panjang — pemisahannya justru informasi.
 *
 * Cakupannya beda, dan itu yang menentukan tempatnya:
 *
 *   • Fasilitas kamar  → milik KAMAR. Kalau kosnya punya beberapa tipe, isian
 *     di sini adalah yang berlaku di SEMUA tipe (mis. kasur & lemari selalu
 *     ada); yang hanya ada di tipe tertentu (mis. AC) diisi di kartu tipe itu.
 *     Tanpa daftar "berlaku semua" ini, pemilik harus mencentang kasur+lemari
 *     berulang di tiap tipe — dan sekali lupa, satu tipe terlihat lebih miskin
 *     dari kenyataannya.
 *   • Fasilitas bersama → milik GEDUNG. Satu set untuk seluruh kos, apa pun
 *     tipe kamarnya. Dapur, WiFi, parkir, mesin cuci tidak berubah per kamar.
 *
 * Ditempatkan menempel dengan isian kamar (bukan di step spesifikasi) karena
 * pemilik memikirkan fasilitas justru saat sedang membayangkan kamarnya.
 */

import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';
import { ListingFormData } from '@/lib/validations/listing';
import { FacilityMultiSelect } from '../FacilityMultiSelect';
import {
  FASILITAS_BERSAMA_OPTIONS,
  FASILITAS_KAMAR_OPTIONS,
} from '@/app/tambah-property/types/listing';
import { PANEL } from './fields';

interface Props {
  form: UseFormReturn<ListingFormData>;
  /** Mode beberapa tipe kamar — mengubah arti "fasilitas kamar" jadi "semua tipe". */
  adaTipe: boolean;
}

const parseChips = (raw?: string | null) =>
  raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];

/** Kepala blok fasilitas: ikon + judul + badge cakupan + keterangan. */
function KepalaFasilitas({
  icon,
  judul,
  cakupan,
  keterangan,
}: {
  icon: string;
  judul: string;
  cakupan: string;
  keterangan: string;
}) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-emerald-400/30 bg-emerald-400/15">
        <Icon icon={icon} className="h-4 w-4 text-emerald-300" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h4 className="text-base font-bold text-white">{judul}</h4>
          {/* Badge cakupan — penanda paling ringkas untuk membedakan "punya
              sendiri" vs "dipakai bareng" tanpa harus membaca keterangan. */}
          <span className="rounded-full border border-white/[0.12] bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
            {cakupan}
          </span>
        </div>
        {/* Tinggi keterangan dipatok dua baris: kalau satu kartu membungkus 1
            baris dan satu lagi 2 baris, dropdown di bawahnya langsung tidak
            sejajar — dan itu terjadi di lebar layar yang berbeda-beda. */}
        <p className="mt-1 max-w-[38ch] text-xs leading-relaxed text-slate-400 sm:min-h-[2.5rem]">
          {keterangan}
        </p>
      </div>
    </div>
  );
}

export function FasilitasSection({ form, adaTipe }: Props) {
  const { watch, setValue } = form;

  const fasilitasKamar = parseChips(watch('fasilitas_kamar'));
  const fasilitasBersama = parseChips(watch('fasilitas_bersama'));

  const set = (field: 'fasilitas_kamar' | 'fasilitas_bersama', next: string[]) =>
    setValue(field, next.length ? next.join(',') : null, {
      shouldValidate: true,
      shouldDirty: true,
    });

  return (
    <div
      className={cn(
        'grid items-stretch gap-3',
        // Mode beberapa tipe: fasilitas kamar sudah melekat pada tiap tipe di
        // kartunya sendiri, jadi di sini tinggal fasilitas gedung — satu panel
        // lebar penuh, tanpa kolom kosong di sebelahnya.
        !adaTipe && 'lg:grid-cols-2',
      )}
    >
      {/* --- Milik kamar: hanya saat semua kamar sama --- */}
      {!adaTipe && (
      <div className={cn(PANEL, 'p-5')}>
        <KepalaFasilitas
          icon="solar:bed-bold-duotone"
          judul="Fasilitas Kamar"
          cakupan="per kamar"
          keterangan="Yang didapat penghuni di dalam kamarnya sendiri."
        />
        {/* Dropdown menempel langsung di bawah kepala yang tingginya sudah
            dipatok sama — TIDAK dipaku ke dasar kartu. FacilityMultiSelect
            merender trigger + chip terpilih sebagai satu blok, jadi mendorong
            blok itu ke dasar justru menurunkan trigger pada kartu yang chipnya
            lebih sedikit: kebalikan dari yang diinginkan. */}
        <FacilityMultiSelect
          options={FASILITAS_KAMAR_OPTIONS}
          value={fasilitasKamar}
          onChange={(next) => set('fasilitas_kamar', next)}
          placeholder="Pilih fasilitas kamar…"
          searchPlaceholder="Cari: AC, kasur, lemari…"
          ariaLabel="Fasilitas Kamar"
        />
      </div>
      )}

      {/* --- Milik gedung: selalu ada, apa pun modenya --- */}
      <div className={cn(PANEL, 'p-5')}>
        <KepalaFasilitas
          icon="solar:buildings-2-bold-duotone"
          judul="Fasilitas Bersama"
          cakupan="1 gedung"
          keterangan="Dipakai bergantian seluruh penghuni, sama untuk semua kamar."
        />
        <FacilityMultiSelect
          options={FASILITAS_BERSAMA_OPTIONS}
          value={fasilitasBersama}
          onChange={(next) => set('fasilitas_bersama', next)}
          placeholder="Pilih fasilitas bersama…"
          searchPlaceholder="Cari: wifi, dapur, parkir…"
          ariaLabel="Fasilitas Bersama"
        />
      </div>
    </div>
  );
}

export default FasilitasSection;

'use client';

import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { ListingFormData } from '@/lib/validations/listing';
import { FormField } from '../FormField';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HADAP_OPTIONS,
  SUMBER_AIR_OPTIONS,
  KONDISI_INTERIOR_OPTIONS as RAW_KONDISI_INTERIOR_OPTIONS,
} from '@/app/tambah-property/types/listing';
import {
  Square,
  Home,
  Bed,
  Bath,
  Layers,
  Zap,
  Droplets,
  Compass,
  Sofa,
  FileText,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step4Props {
  form: UseFormReturn<ListingFormData>;
}

// Sertifikat enum sesuai DB
const SERTIFIKAT_ENUM = [
  { value: 'SHM', label: 'SHM (Sertifikat Hak Milik)' },
  { value: 'HGB', label: 'HGB (Hak Guna Bangunan)' },
  { value: 'HGU', label: 'HGU (Hak Guna Usaha)' },
  { value: 'HP', label: 'HP (Hak Pakai)' },
  { value: 'STRATA_TITLE', label: 'Strata Title' },
  { value: 'PPJB', label: 'PPJB' },
  { value: 'AJB', label: 'AJB' },
  { value: 'LAINNYA', label: 'Lainnya' },
];

// Ganti label "Bare" => "Kosongan"
const KONDISI_INTERIOR_OPTIONS = RAW_KONDISI_INTERIOR_OPTIONS.map((k) =>
  k.toLowerCase() === 'bare' ? 'Kosongan' : k,
);

// Konversi ke number, undefined kalau kosong/0
const toNumericOrUndefined = (v: unknown): number | undefined => {
  if (v === '' || v === null || v === undefined) return undefined;
  const asString = String(v);
  const numeric = Number(asString);
  return Number.isNaN(numeric) || numeric === 0 ? undefined : numeric;
};

// Filter hanya angka dan hilangkan leading zero (0023 -> 23, 0 -> kosong)
const stripNonDigitAndLeadingZeros = (raw: string): string => {
  const onlyDigits = raw.replace(/\D/g, '');
  if (onlyDigits === '') return '';
  const noLeading = onlyDigits.replace(/^0+/, '');
  return noLeading === '' ? '' : noLeading;
};

// Handler untuk semua input angka (kecuali nomor sertifikat)
const handleNumericInputNoLeadingZero = (
  e: React.ChangeEvent<HTMLInputElement>,
) => {
  const cleaned = stripNonDigitAndLeadingZeros(e.target.value);
  e.target.value = cleaned;
};

export function Step4Specifications({ form }: Step4Props) {
  const {
    watch,
    formState: { errors },
    register,
  } = form;

  const luasTanah = watch('luas_tanah');
  const luasBangunan = watch('luas_bangunan');
  const jumlahLantai = watch('jumlah_lantai');
  const kamarTidur = watch('kamar_tidur');
  const kamarMandi = watch('kamar_mandi');
  const dayaListrik = watch('daya_listrik');
  const hadapBangunan = watch('hadap_bangunan');
  const sumberAir = watch('sumber_air');
  const kondisiInterior = watch('kondisi_interior');
  const legalitas = watch('legalitas');
  const nomorLegalitas = watch('nomor_legalitas');

  const buildingRatio =
    luasTanah && luasBangunan && luasTanah > 0
      ? (luasBangunan / luasTanah) * 100
      : 0;

  const totalFields = 11;
  const filledFields = [
    luasTanah,
    luasBangunan,
    jumlahLantai,
    kamarTidur,
    kamarMandi,
    dayaListrik,
    hadapBangunan,
    sumberAir,
    kondisiInterior,
    legalitas,
    nomorLegalitas,
  ].filter((val) => val !== undefined && val !== null && val !== '').length;

  const completionPercentage = Math.round((filledFields / totalFields) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Dimensi */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Square className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">Dimensi Property</h3>
            <p className="text-xs text-slate-500">Ukuran tanah dan bangunan</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Luas Tanah */}
          <FormField label="Luas Tanah" error={errors.luas_tanah?.message}>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex items-center">
                <div className="absolute left-4 flex items-center gap-2">
                  <Square className="h-4 w-4 text-emerald-400" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="200"
                  {...register('luas_tanah', {
                    setValueAs: toNumericOrUndefined,
                  })}
                  onInput={handleNumericInputNoLeadingZero}
                  className={cn(
                    'w-full h-14 pl-12 pr-12 rounded-xl text-base font-semibold text-slate-100',
                    'bg-slate-900/50 border-2 border-slate-800',
                    'focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
                    'transition-all duration-300',
                    'placeholder:text-slate-600',
                  )}
                />
                <div className="absolute right-4 text-slate-400 text-sm font-semibold">
                  m²
                </div>
                {luasTanah && luasTanah > 0 && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="absolute right-14"
                  >
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </motion.div>
                )}
              </div>
            </div>
          </FormField>

          {/* Luas Bangunan */}
          <FormField
            label="Luas Bangunan"
            error={errors.luas_bangunan?.message}
          >
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-teal-500/20 to-cyan-500/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex items-center">
                <div className="absolute left-4 flex items-center gap-2">
                  <Home className="h-4 w-4 text-teal-400" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="150"
                  {...register('luas_bangunan', {
                    setValueAs: toNumericOrUndefined,
                  })}
                  onInput={handleNumericInputNoLeadingZero}
                  className={cn(
                    'w-full h-14 pl-12 pr-12 rounded-xl text-base font-semibold text-slate-100',
                    'bg-slate-900/50 border-2 border-slate-800',
                    'focus:border-teal-500/50 focus:outline-none focus:ring-2 focus:ring-teal-500/20',
                    'transition-all duration-300',
                    'placeholder:text-slate-600',
                  )}
                />
                <div className="absolute right-4 text-slate-400 text-sm font-semibold">
                  m²
                </div>
                {luasBangunan && luasBangunan > 0 && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="absolute right-14"
                  >
                    <CheckCircle2 className="h-5 w-5 text-teal-500" />
                  </motion.div>
                )}
              </div>
            </div>
          </FormField>

          {/* Jumlah Lantai */}
          <FormField
            label="Jumlah Lantai"
            error={errors.jumlah_lantai?.message}
          >
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex items-center">
                <div className="absolute left-4 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-cyan-400" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="2"
                  {...register('jumlah_lantai', {
                    setValueAs: toNumericOrUndefined,
                  })}
                  onInput={handleNumericInputNoLeadingZero}
                  className={cn(
                    'w-full h-14 pl-12 pr-12 rounded-xl text-base font-semibold text-slate-100',
                    'bg-slate-900/50 border-2 border-slate-800',
                    'focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20',
                    'transition-all duration-300',
                    'placeholder:text-slate-600',
                  )}
                />
                <div className="absolute right-4 text-slate-400 text-sm font-semibold">
                  Lantai
                </div>
                {jumlahLantai && jumlahLantai > 0 && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="absolute right-14"
                  >
                    <CheckCircle2 className="h-5 w-5 text-cyan-500" />
                  </motion.div>
                )}
              </div>
            </div>
          </FormField>
        </div>

        {/* Building Ratio */}
        <AnimatePresence>
          {luasTanah && luasBangunan && buildingRatio > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 to-black border border-emerald-500/20 p-5"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                      Rasio Bangunan/Tanah
                    </p>
                    <p className="text-2xl font-black text-emerald-400">
                      {buildingRatio.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="w-40 h-3 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(buildingRatio, 100)}%` }}
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    {buildingRatio < 50
                      ? 'Ruang terbuka luas'
                      : buildingRatio < 80
                      ? 'Proporsional'
                      : 'Maksimal coverage'}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Struktur Bangunan */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
            <Bed className="h-5 w-5 text-teal-400" />
          </div>
        <div>
          <h3 className="text-lg font-bold text-slate-100">
            Struktur Bangunan
          </h3>
          <p className="text-xs text-slate-500">
            Fasilitas dan utilitas property
          </p>
        </div>
      </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Kamar Tidur */}
          <FormField label="Kamar Tidur" error={errors.kamar_tidur?.message}>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex items-center">
                <div className="absolute left-4">
                  <Bed className="h-4 w-4 text-purple-400" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="4"
                  {...register('kamar_tidur', {
                    setValueAs: toNumericOrUndefined,
                  })}
                  onInput={handleNumericInputNoLeadingZero}
                  className={cn(
                    'w-full h-14 pl-12 pr-4 rounded-xl text-base font-semibold text-slate-100',
                    'bg-slate-900/50 border-2 border-slate-800',
                    'focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20',
                    'transition-all duration-300',
                    'placeholder:text-slate-600',
                  )}
                />
                {kamarTidur !== undefined && kamarTidur !== null && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-4"
                  >
                    <CheckCircle2 className="h-5 w-5 text-purple-500" />
                  </motion.div>
                )}
              </div>
            </div>
          </FormField>

          {/* Kamar Mandi */}
          <FormField label="Kamar Mandi" error={errors.kamar_mandi?.message}>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex items-center">
                <div className="absolute left-4">
                  <Bath className="h-4 w-4 text-blue-400" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="3"
                  {...register('kamar_mandi', {
                    setValueAs: toNumericOrUndefined,
                  })}
                  onInput={handleNumericInputNoLeadingZero}
                  className={cn(
                    'w-full h-14 pl-12 pr-4 rounded-xl text-base font-semibold text-slate-100',
                    'bg-slate-900/50 border-2 border-slate-800',
                    'focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                    'transition-all duration-300',
                    'placeholder:text-slate-600',
                  )}
                />
                {kamarMandi !== undefined && kamarMandi !== null && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-4"
                  >
                    <CheckCircle2 className="h-5 w-5 text-blue-500" />
                  </motion.div>
                )}
              </div>
            </div>
          </FormField>

          {/* Daya Listrik */}
          <FormField label="Daya Listrik" error={errors.daya_listrik?.message}>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex items-center">
                <div className="absolute left-4">
                  <Zap className="h-4 w-4 text-yellow-400" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="2200"
                  {...register('daya_listrik', {
                    setValueAs: toNumericOrUndefined,
                  })}
                  onInput={handleNumericInputNoLeadingZero}
                  className={cn(
                    'w-full h-14 pl-12 pr-12 rounded-xl text-base font-semibold text-slate-100',
                    'bg-slate-900/50 border-2 border-slate-800',
                    'focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20',
                    'transition-all duration-300',
                    'placeholder:text-slate-600',
                  )}
                />
                <div className="absolute right-4 text-slate-400 text-sm font-semibold">
                  VA
                </div>
                {dayaListrik && dayaListrik > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-14"
                  >
                    <CheckCircle2 className="h-5 w-5 text-yellow-500" />
                  </motion.div>
                )}
              </div>
            </div>
          </FormField>

          {/* Sumber Air */}
          <FormField label="Sumber Air" error={errors.sumber_air?.message}>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex items-center">
                <div className="absolute left-4">
                  <Droplets className="h-4 w-4 text-cyan-400" />
                </div>
                <select
                  {...register('sumber_air')}
                  className={cn(
                    'w-full h-14 pl-12 pr-8 rounded-xl text-base font-semibold text-slate-100 appearance-none',
                    'bg-slate-900/50 border-2 border-slate-800',
                    'focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20',
                    'transition-all duration-300',
                  )}
                >
                  <option value="">Pilih Sumber Air</option>
                  {SUMBER_AIR_OPTIONS.map((air) => (
                    <option key={air} value={air}>
                      {air}
                    </option>
                  ))}
                </select>
                {sumberAir && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-3"
                  >
                    <CheckCircle2 className="h-5 w-5 text-cyan-500" />
                  </motion.div>
                )}
              </div>
            </div>
          </FormField>
        </div>
      </div>

      {/* Detail Tambahan */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
            <Compass className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">
              Detail Tambahan
            </h3>
            <p className="text-xs text-slate-500">
              Informasi pelengkap property
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Hadap Bangunan */}
          <FormField
            label="Hadap Bangunan"
            error={errors.hadap_bangunan?.message}
          >
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex items-center">
                <div className="absolute left-4">
                  <Compass className="h-4 w-4 text-indigo-400" />
                </div>
                <select
                  {...register('hadap_bangunan')}
                  className={cn(
                    'w-full h-14 pl-12 pr-8 rounded-xl text-base font-semibold text-slate-100 appearance-none',
                    'bg-slate-900/50 border-2 border-slate-800',
                    'focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20',
                    'transition-all duration-300',
                  )}
                >
                  <option value="">Pilih Arah</option>
                  {HADAP_OPTIONS.map((hadap) => (
                    <option key={hadap} value={hadap}>
                      {hadap}
                    </option>
                  ))}
                </select>
                {hadapBangunan && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-3"
                  >
                    <CheckCircle2 className="h-5 w-5 text-indigo-500" />
                  </motion.div>
                )}
              </div>
            </div>
          </FormField>

          {/* Kondisi Interior */}
          <FormField
            label="Kondisi Interior"
            error={errors.kondisi_interior?.message}
          >
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 to-rose-500/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex items-center">
                <div className="absolute left-4">
                  <Sofa className="h-4 w-4 text-pink-400" />
                </div>
                <select
                  {...register('kondisi_interior')}
                  className={cn(
                    'w-full h-14 pl-12 pr-8 rounded-xl text-base font-semibold text-slate-100 appearance-none',
                    'bg-slate-900/50 border-2 border-slate-800',
                    'focus:border-pink-500/50 focus:outline-none focus:ring-2 focus:ring-pink-500/20',
                    'transition-all duration-300',
                  )}
                >
                  <option value="">Pilih Kondisi</option>
                  {KONDISI_INTERIOR_OPTIONS.map((kondisi) => (
                    <option key={kondisi} value={kondisi}>
                      {kondisi}
                    </option>
                  ))}
                </select>
                {kondisiInterior && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-3"
                  >
                    <CheckCircle2 className="h-5 w-5 text-pink-500" />
                  </motion.div>
                )}
              </div>
            </div>
          </FormField>
        </div>
      </div>

      {/* Legalitas */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <Shield className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">
              Legalitas Property
            </h3>
            <p className="text-xs text-slate-500">
              Dokumen dan sertifikat resmi
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 items-start">
          {/* Jenis Sertifikat */}
          <FormField
            label="Jenis Sertifikat"
            error={errors.legalitas?.message}
          >
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex items-center">
                <div className="absolute left-4">
                  <FileText className="h-4 w-4 text-amber-400" />
                </div>
                <select
                  {...register('legalitas')}
                  className={cn(
                    'w-full h-14 pl-12 pr-8 rounded-xl text-base font-semibold text-slate-100 appearance-none',
                    'bg-slate-900/50 border-2 border-slate-800',
                    'focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20',
                    'transition-all duration-300',
                  )}
                >
                  <option value="">Pilih Sertifikat</option>
                  {SERTIFIKAT_ENUM.map((sert) => (
                    <option key={sert.value} value={sert.value}>
                      {sert.label}
                    </option>
                  ))}
                </select>
                {legalitas && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-3"
                  >
                    <CheckCircle2 className="h-5 w-5 text-amber-500" />
                  </motion.div>
                )}
              </div>
            </div>
          </FormField>

          {/* Nomor Sertifikat (boleh leading zero) */}
          <FormField
            label="Nomor Sertifikat"
            error={errors.nomor_legalitas?.message}
          >
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex items-center">
                <input
                  {...register('nomor_legalitas')}
                  placeholder="001234/2023"
                  className={cn(
                    'w-full h-14 pl-4 pr-10 rounded-xl text-base font-semibold text-slate-100',
                    'bg-slate-900/50 border-2 border-slate-800',
                    'focus:border-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20',
                    'transition-all duration-300',
                    'placeholder:text-slate-600',
                  )}
                />
                {nomorLegalitas && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-3"
                  >
                    <CheckCircle2 className="h-5 w-5 text-orange-500" />
                  </motion.div>
                )}
              </div>
            </div>
          </FormField>
        </div>
      </div>

      {/* Success Indicator */}
      {completionPercentage === 100 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 p-4"
        >
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            </motion.div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-400">
                ✨ Semua spesifikasi sudah lengkap!
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Property Anda siap untuk tahap berikutnya
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

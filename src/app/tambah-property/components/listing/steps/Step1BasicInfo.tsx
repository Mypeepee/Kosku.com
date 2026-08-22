'use client';

import React, { useEffect } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { ListingFormData } from '@/lib/validations/listing';
import { FormField } from '../FormField';
import { RadioGroup } from '../RadioGroup';
import { motion, AnimatePresence } from 'framer-motion';
import {
  JENIS_TRANSAKSI_OPTIONS,
  kategoriMasihValid,
  kategoriUntukTransaksi,
} from '@/app/tambah-property/types/listing';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AuctionDatePicker } from '../AuctionDatePicker';

interface Step1Props {
  form: UseFormReturn<ListingFormData>;
}

export function Step1BasicInfo({ form }: Step1Props) {
  const {
    watch,
    setValue,
    formState: { errors },
  } = form;

  const jenisTransaksi = watch('jenis_transaksi');
  const kategori = watch('kategori');
  const tanggalLelang = watch('tanggal_lelang');

  // Kategori yang boleh dipilih ikut jenis transaksinya — Kos hanya ada di
  // Sewa. Daftarnya dihitung ulang tiap render (bukan disimpan di state)
  // supaya mustahil ada kartu kategori yang tertinggal dari pilihan lama.
  const kategoriOptions = kategoriUntukTransaksi(jenisTransaksi);

  /**
   * Pindah jenis transaksi saat kategori yang terpilih sudah tidak berlaku
   * (mis. sudah pilih Kos lalu ganti ke Primary) harus MENGOSONGKAN kategori,
   * bukan sekadar menyembunyikan kartunya. Tanpa ini, `kategori` tetap 'KOS'
   * di form state padahal tidak ada kartu yang menyala — agent melihat step
   * seolah belum diisi, menekan Lanjut, dan tertahan error dari field yang
   * tidak kelihatan.
   */
  useEffect(() => {
    if (!kategoriMasihValid(kategori, jenisTransaksi)) {
      setValue('kategori', undefined as never, { shouldValidate: false });
    }
  }, [jenisTransaksi, kategori, setValue]);

  const handleDateChange = (date: Date | undefined) => {
    setValue('tanggal_lelang', date ?? (undefined as any), { shouldValidate: true });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Judul sengaja TIDAK ada di sini. Di posisi ini belum ada satu pun
          fakta yang bisa masuk ke dalamnya — lokasi, harga & spesifikasi baru
          diisi di langkah berikutnya — jadi yang keluar selalu judul karangan
          seperti "Rumah Dijual Murah". Judulnya dirangkai otomatis di langkah
          terakhir, saat seluruh datanya sudah ada. */}
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-emerald-500/30 bg-emerald-500/15">
          <Sparkles className="h-4 w-4 text-emerald-400" />
        </span>
        <p className="text-xs leading-relaxed text-slate-300">
          <span className="font-bold text-emerald-300">Judul tidak perlu Anda tulis.</span>{' '}
          Isi saja datanya sampai langkah terakhir — sistem akan merangkai judul
          yang tepat, sesuai fakta, dan optimal untuk pencarian Google. Anda
          tinggal memilih atau mengubahnya.
        </p>
      </div>

      <FormField
        label="Jenis Transaksi"
        required
        error={errors.jenis_transaksi?.message}
        description="Pilih tipe transaksi sesuai dengan property Anda"
      >
        <RadioGroup
          options={JENIS_TRANSAKSI_OPTIONS}
          value={watch('jenis_transaksi') || ''}
          onChange={(value) => setValue('jenis_transaksi', value as any)}
          name="jenis_transaksi"
        />
      </FormField>

      <FormField
        label="Kategori Property"
        required
        error={errors.kategori?.message}
        description={
          jenisTransaksi === 'SEWA'
            ? 'Pilih Kos kalau yang disewakan adalah kamar di dalam satu gedung kos, atau Apartemen kalau yang disewakan satu unit'
            : 'Tentukan jenis property yang akan Anda jual. Kategori Kos muncul setelah jenis transaksi Sewa dipilih'
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kategoriOptions.map((option) => {
            const isSelected = kategori === option.value;

            return (
              <motion.button
                key={option.value}
                type="button"
                onClick={() => setValue('kategori', option.value)}
                className={cn(
                  'group relative overflow-hidden rounded-xl border-2 p-4 transition-all duration-300',
                  isSelected
                    ? 'border-emerald-500/60 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent shadow-lg shadow-emerald-500/10'
                    : 'border-slate-800 bg-slate-900/30 hover:border-emerald-500/30 hover:bg-slate-900/50'
                )}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                {isSelected && (
                  <motion.div
                    className="absolute -inset-1 -z-10 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 blur-lg"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  />
                )}

                <motion.div
                  className="mb-2 text-4xl"
                  animate={isSelected ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  {option.icon}
                </motion.div>

                <div
                  className={cn(
                    'text-xs font-semibold transition-colors',
                    isSelected
                      ? 'text-slate-100'
                      : 'text-slate-400 group-hover:text-slate-300'
                  )}
                >
                  {option.label}
                </div>

                {isSelected && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500"
                  >
                    <svg
                      className="h-3 w-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </motion.div>
                )}

                <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-emerald-500/5 to-transparent transition-transform duration-700 group-hover:translate-x-[100%]" />
              </motion.button>
            );
          })}
        </div>
      </FormField>

      <AnimatePresence>
        {jenisTransaksi === 'LELANG' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent p-6 backdrop-blur-sm">
              <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-amber-500/10 blur-3xl" />

              <div className="relative z-10">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500">
                    <span className="text-xl">⚖️</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-amber-400">
                      Informasi Lelang
                    </h3>
                    <p className="text-xs text-slate-400">
                      Tentukan jadwal lelang property Anda
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-slate-200">
                      Tanggal &amp; Waktu Lelang
                      <span className="ml-1 text-red-400">*</span>
                    </span>
                  </div>
                  <AuctionDatePicker
                    value={tanggalLelang instanceof Date ? tanggalLelang : tanggalLelang ? new Date(tanggalLelang) : undefined}
                    onChange={handleDateChange}
                    error={errors.tanggal_lelang?.message}
                  />
                  {!errors.tanggal_lelang && (
                    <p className="mt-1.5 text-xs text-slate-500">
                      Bisa pilih tanggal lampau maupun masa depan
                    </p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
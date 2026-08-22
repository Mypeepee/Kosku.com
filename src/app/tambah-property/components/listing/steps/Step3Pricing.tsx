'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { ListingFormData } from '@/lib/validations/listing';
import { FormField } from '../FormField';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Percent,
  Shield,
  Wallet,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Zap,
  Calculator,
  RefreshCw,
  Sun,
  CalendarDays,
  Calendar,
  CalendarRange,
  Info,
  Clock,
  Ban,
  Bed,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DURASI_SEWA_OPTIONS,
  DURASI_SEWA_FIELD_MAP,
  DURASI_PRIORITY,
  DURASI_RANK,
  DURASI_SATUAN_LABEL,
  type BiayaTambahan,
  type DurasiSewa,
} from '@/app/tambah-property/types/listing';
import { PremiumSelect, type PremiumSelectOption } from '../PremiumSelect';
import { KamarTipeBuilder, type KamarTipeRowError } from '../KamarTipeBuilder';
import { KamarSeragamFields } from '../kos/KamarSeragamFields';
import { HargaSewaGrid, type BarisHarga } from '../kos/HargaSewaGrid';
import { PANEL } from '../kos/fields';
import { FasilitasSection } from '../kos/FasilitasSection';
import { TermasukBiaya } from '../kos/TermasukBiaya';
import { BiayaTambahanBuilder } from '../kos/BiayaTambahanBuilder';
import {
  agregatSewaDariTipe,
  fasilitasKamarSeragam,
  ringkasKamarTipe,
  type KamarTipe,
} from '@/lib/kosRoomTypes';
import { KAMAR_MANDI_TIPE_LABEL } from '@/lib/kosCard';
import {
  LABEL_DURASI,
  durasiSewaDiizinkan,
  pesanDurasiTidakSah,
} from '@/lib/sewaKapabilitas';

/** Keempat durasi, tanpa penyaringan kategori — dipakai hanya untuk mencari
 *  angka yang tertinggal dari kategori sebelumnya. */
const DURASI_SEMUA = DURASI_SEWA_OPTIONS.map((d) => d.value);

interface Step3Props {
  form: UseFormReturn<ListingFormData>;
  /**
   * Mode sunting. Diteruskan ke isian kamar karena di mode ini "kamar kosong
   * sekarang" bukan lagi angka yang ditulis form — lihat KamarSeragamFields.
   */
  isEditMode?: boolean;
}

// Helper: Format number with thousand separator (no leading zeros, no bare "0")
const formatThousand = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  const raw = typeof value === 'number' ? value.toString() : value;
  const numbers = raw.replace(/\D/g, '');
  if (!numbers) return '';
  const parsed = parseInt(numbers, 10);
  if (!parsed) return ''; // Prevent showing just "0"
  return parsed.toLocaleString('id-ID');
};

// Helper: Parse formatted number
const parseThousand = (value: string): number => {
  const parsed = parseInt(value.replace(/\D/g, ''), 10);
  return isNaN(parsed) ? 0 : parsed;
};

// Helper: Format currency display
const formatCurrency = (value: number): string => {
  if (!value || value === 0) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const DURASI_ICON: Record<DurasiSewa, React.ReactNode> = {
  HARIAN: <Sun className="h-4 w-4" />,
  MINGGUAN: <CalendarDays className="h-4 w-4" />,
  BULANAN: <Calendar className="h-4 w-4" />,
  TAHUNAN: <CalendarRange className="h-4 w-4" />,
};

// Opsi satuan minimal sewa. Di dalam durasi yang SAH untuk kategorinya, pilihan
// inilah yang menentukan durasi mana yang boleh ditawarkan — karena itu daftar
// mentahnya lengkap di sini, lalu disaring per kategori di dalam komponen.
const MINIMAL_SATUAN_OPTIONS: PremiumSelectOption[] = [
  // Opsi kosong wajib ada — tanpa ini pemilik yang berubah pikiran tidak punya
  // jalan kembali setelah terlanjur memilih satuan.
  {
    value: '',
    label: 'Tanpa minimal',
    desc: 'Semua durasi bebas ditawarkan',
    icon: <Ban className="h-4 w-4" />,
  },
  ...DURASI_SEWA_OPTIONS.map((d) => ({
    value: d.value,
    label: DURASI_SATUAN_LABEL[d.value],
    desc:
      d.value === 'TAHUNAN'
        ? 'Hanya harga tahunan yang bisa ditawarkan'
        : d.value === 'BULANAN'
        ? 'Harian & mingguan dinonaktifkan'
        : d.value === 'MINGGUAN'
        ? 'Harian dinonaktifkan'
        : 'Semua durasi tetap bisa ditawarkan',
    icon: DURASI_ICON[d.value],
  })),
];

export function Step3Pricing({ form, isEditMode = false }: Step3Props) {
  const {
    watch,
    setValue,
    clearErrors,
    formState: { errors },
  } = form;

  const jenisTransaksi = watch('jenis_transaksi');

  const isLelang = jenisTransaksi === 'LELANG';
  const isSewa = jenisTransaksi === 'SEWA';

  const harga = watch('harga');
  const hargaPromo = watch('harga_promo');
  const nilaiLimit = watch('nilai_limit_lelang');
  const uangJaminan = watch('uang_jaminan');

  // Local display state (formatted strings)
  const [hargaFormatted, setHargaFormatted] = useState('');
  const [hargaPromoFormatted, setHargaPromoFormatted] = useState('');
  const [nilaiLimitFormatted, setNilaiLimitFormatted] = useState('');
  const [uangJaminanFormatted, setUangJaminanFormatted] = useState('');

  const [discount, setDiscount] = useState<number>(0);
  const [savings, setSavings] = useState<number>(0);
  const [isAutoCalculating, setIsAutoCalculating] = useState(false);

  const hasPromo = typeof hargaPromo === 'number' && hargaPromo > 0;

  // INIT: sinkronisasi state format dengan nilai form
  useEffect(() => {
    setHargaFormatted(formatThousand(harga));
    setHargaPromoFormatted(formatThousand(hargaPromo));
    setNilaiLimitFormatted(formatThousand(nilaiLimit));
    setUangJaminanFormatted(formatThousand(uangJaminan));
  }, []);

  // ✅ FIX 1: Clear harga saat mode LELANG, set dummy value untuk validasi
  useEffect(() => {
    if (isLelang) {
      // Set harga ke 0 atau undefined untuk LELANG (tidak wajib)
      setValue('harga', undefined as any);
      clearErrors('harga');
      setHargaFormatted('');
      setHargaPromoFormatted('');
      setValue('harga_promo', undefined as any);
      clearErrors('harga_promo');
    } else {
      // Reset nilai lelang saat non-LELANG
      setValue('nilai_limit_lelang', undefined as any);
      setValue('uang_jaminan', undefined as any);
      setNilaiLimitFormatted('');
      setUangJaminanFormatted('');
      clearErrors('nilai_limit_lelang');
      clearErrors('uang_jaminan');
    }
  }, [isLelang, setValue, clearErrors]);

  // ✅ FIX 2: Auto-calculate uang jaminan LANGSUNG saat nilaiLimit berubah
  useEffect(() => {
    if (isLelang && nilaiLimit && nilaiLimit > 0) {
      const autoJaminan = Math.round(Number(nilaiLimit) * 0.2);
      setValue('uang_jaminan', autoJaminan);
      setUangJaminanFormatted(formatThousand(autoJaminan));
      setIsAutoCalculating(true);
      const timer = setTimeout(() => setIsAutoCalculating(false), 800);
      return () => clearTimeout(timer);
    }
  }, [isLelang, nilaiLimit, setValue]);

  // Sync formatted values with form values
  useEffect(() => {
    if (!isLelang && !isSewa) {
      setHargaFormatted(formatThousand(harga));
    }
  }, [harga, isLelang, isSewa]);

  useEffect(() => {
    if (!isLelang) {
      setHargaPromoFormatted(formatThousand(hargaPromo));
    }
  }, [hargaPromo, isLelang]);

  useEffect(() => {
    if (isLelang) {
      setNilaiLimitFormatted(formatThousand(nilaiLimit));
    }
  }, [nilaiLimit, isLelang]);

  useEffect(() => {
    if (isLelang) {
      setUangJaminanFormatted(formatThousand(uangJaminan));
    }
  }, [uangJaminan, isLelang]);

  // Calculate discount for non-lelang
  useEffect(() => {
    if (!isLelang && harga && hargaPromo && hargaPromo < harga && hargaPromo > 0) {
      const save = Number(harga) - Number(hargaPromo);
      const disc = (save / Number(harga)) * 100;
      setSavings(save);
      setDiscount(disc);
    } else {
      setSavings(0);
      setDiscount(0);
    }
  }, [harga, hargaPromo, isLelang]);

  // Handle input changes
  const handleHargaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatThousand(e.target.value);
    setHargaFormatted(formatted);
    const parsed = parseThousand(formatted);
    setValue('harga', parsed > 0 ? parsed : undefined as any);
  };

  const handleHargaPromoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatThousand(e.target.value);
    setHargaPromoFormatted(formatted);
    const parsed = parseThousand(formatted);
    setValue('harga_promo', parsed > 0 ? parsed : undefined as any);
  };

  const handleNilaiLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatThousand(e.target.value);
    setNilaiLimitFormatted(formatted);
    const parsed = parseThousand(formatted);
    setValue('nilai_limit_lelang', parsed > 0 ? parsed : undefined as any);
  };

  const handleUangJaminanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatThousand(e.target.value);
    setUangJaminanFormatted(formatted);
    const parsed = parseThousand(formatted);
    setValue('uang_jaminan', parsed > 0 ? parsed : undefined as any);
  };

  // Reset to auto-calculate
  const resetToAutoCalculate = () => {
    if (nilaiLimit && nilaiLimit > 0) {
      const autoJaminan = Math.round(Number(nilaiLimit) * 0.2);
      setValue('uang_jaminan', autoJaminan);
      setUangJaminanFormatted(formatThousand(autoJaminan));
      setIsAutoCalculating(true);
      setTimeout(() => setIsAutoCalculating(false), 800);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <AnimatePresence mode="wait">
        {isLelang ? (
          /* ========== LELANG MODE ========== */
          <motion.div
            key="lelang"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-6"
          >
            {/* Lelang Alert */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border border-emerald-500/20 p-4"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
              <div className="relative flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-400 mb-1">
                    Mode Lelang Aktif
                  </h3>
                  <p className="text-xs text-slate-400">
                    Masukkan nilai limit lelang. Uang jaminan akan otomatis dihitung 20% dari nilai limit.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Nilai Limit Lelang */}
            <FormField
              label="Nilai Limit Lelang"
              required
              error={errors.nilai_limit_lelang?.message}
              description="Batas harga minimum yang harus dicapai agar lelang berhasil"
            >
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
                <div className="relative flex items-center">
                  <div className="absolute left-4 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-400 font-bold text-sm">Rp</span>
                  </div>
                  <input
                    type="text"
                    value={nilaiLimitFormatted}
                    onChange={handleNilaiLimitChange}
                    placeholder="1.200.000.000"
                    className={cn(
                      'w-full h-14 pl-20 pr-12 rounded-xl text-base font-semibold text-slate-100',
                      'bg-slate-900/50 border-2 border-slate-800',
                      'focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
                      'transition-all duration-300',
                      'placeholder:text-slate-600',
                    )}
                  />
                  {nilaiLimit && nilaiLimit > 0 && (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="absolute right-4"
                    >
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    </motion.div>
                  )}
                </div>
              </div>
            </FormField>

            {/* Display Nilai Limit */}
            {nilaiLimit && nilaiLimit > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 to-black border border-emerald-500/20 p-5"
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Nilai Limit
                    </span>
                  </div>
                  <p className="text-3xl font-black text-emerald-400 mb-1">
                    {formatCurrency(Number(nilaiLimit))}
                  </p>
                  <p className="text-xs text-slate-500">
                    Harga minimum untuk lelang berhasil
                  </p>
                </div>
              </motion.div>
            )}

            {/* Uang Jaminan */}
            <FormField
              label="Uang Jaminan"
              required
              error={errors.uang_jaminan?.message}
              description="Deposit yang harus dibayar oleh peserta lelang (auto-calculate 20%)"
            >
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-teal-500/20 to-cyan-500/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
                <div className="relative flex items-center">
                  <div className="absolute left-4 flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-teal-400" />
                    <span className="text-teal-400 font-bold text-sm">Rp</span>
                  </div>
                  <input
                    type="text"
                    value={uangJaminanFormatted}
                    onChange={handleUangJaminanChange}
                    placeholder="Auto-calculated 20%..."
                    className={cn(
                      'w-full h-14 pl-20 pr-28 rounded-xl text-base font-semibold text-slate-100',
                      'bg-slate-900/50 border-2',
                      isAutoCalculating
                        ? 'border-teal-500/50 ring-2 ring-teal-500/20'
                        : 'border-slate-800',
                      'focus:border-teal-500/50 focus:outline-none focus:ring-2 focus:ring-teal-500/20',
                      'transition-all duration-300',
                      'placeholder:text-slate-600',
                    )}
                  />

                  {nilaiLimit && nilaiLimit > 0 && (
                    <motion.button
                      type="button"
                      onClick={resetToAutoCalculate}
                      className="absolute right-12 p-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20 hover:bg-teal-500/20 transition-colors group"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      title="Reset ke 20%"
                    >
                      <RefreshCw className="h-3.5 w-3.5 text-teal-400 group-hover:rotate-180 transition-transform duration-500" />
                    </motion.button>
                  )}

                  {uangJaminan && uangJaminan > 0 && (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="absolute right-4"
                    >
                      <CheckCircle2 className="h-5 w-5 text-teal-500" />
                    </motion.div>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {isAutoCalculating && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="mt-2 flex items-center gap-2 text-xs text-teal-400"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Calculator className="h-3 w-3" />
                    </motion.div>
                    <span>Auto-calculated 20% dari nilai limit</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </FormField>

            {/* Display Uang Jaminan */}
            {uangJaminan && uangJaminan > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 to-black border border-teal-500/20 p-5"
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-teal-500/5 rounded-full blur-3xl" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="h-4 w-4 text-teal-400" />
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Uang Jaminan
                    </span>
                  </div>
                  <p className="text-3xl font-black text-teal-400 mb-1">
                    {formatCurrency(Number(uangJaminan))}
                  </p>
                  <p className="text-xs text-slate-500">Deposit wajib peserta lelang</p>
                </div>
              </motion.div>
            )}

            {/* Summary Lelang */}
            {nilaiLimit && nilaiLimit > 0 && uangJaminan && uangJaminan > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 to-black border border-slate-800 p-6"
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl" />
                <div className="relative">
                  <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-emerald-400" />
                    Ringkasan Lelang
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                          <Shield className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wider">
                            Nilai Limit
                          </p>
                          <p className="text-base font-bold text-slate-200">
                            {formatCurrency(Number(nilaiLimit))}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                          <Wallet className="h-5 w-5 text-teal-400" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wider">
                            Uang Jaminan
                          </p>
                          <p className="text-base font-bold text-slate-200">
                            {formatCurrency(Number(uangJaminan))}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 font-semibold">
                        {((Number(uangJaminan) / Number(nilaiLimit)) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        ) : isSewa ? (
          /* ========== SEWA MODE — harga per durasi ========== */
          <SewaPricingBlock form={form} isEditMode={isEditMode} />
        ) : (
          /* ========== JUAL MODE (PRIMARY/SECONDARY) ========== */
          <motion.div
            key="jual"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-6"
          >
            {/* Harga Utama */}
            <FormField
              label="Harga Jual"
              required
              error={errors.harga?.message}
              description="Harga jual property"
            >
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
                <div className="relative flex items-center">
                  <div className="absolute left-4 flex items-center gap-2 z-10">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-400 font-bold text-sm">Rp</span>
                  </div>
                  <input
                    type="text"
                    value={hargaFormatted}
                    onChange={handleHargaChange}
                    placeholder="2.500.000.000"
                    className={cn(
                      'w-full h-14 pl-20 pr-10 rounded-xl text-base font-semibold text-slate-100',
                      'bg-slate-900/50 border-2 border-slate-800',
                      'focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
                      'transition-all duration-300',
                      'placeholder:text-slate-600',
                    )}
                  />
                  {harga && harga > 0 && (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    </motion.div>
                  )}
                </div>
              </div>
            </FormField>

            {/* Display Harga */}
            {harga && harga > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 to-black border border-emerald-500/20 p-6"
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Harga Jual
                    </span>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <p className="text-2xl sm:text-3xl font-black text-emerald-400 break-all">
                      {formatCurrency(Number(harga))}
                    </p>
                  </div>
                  <p className="text-sm text-slate-500 mt-2">
                    {Number(harga).toLocaleString('id-ID')} Rupiah
                  </p>
                </div>
              </motion.div>
            )}

            {/* Harga Promo */}
            <FormField
              label="Harga Promo (Opsional)"
              error={errors.harga_promo?.message}
              description="Berikan diskon khusus untuk menarik lebih banyak buyer"
              badge="Optional"
            >
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
                <div className="relative flex items-center">
                  <div className="absolute left-4 flex items-center gap-2 z-10">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    <span className="text-amber-400 font-bold text-sm">Rp</span>
                  </div>
                  <input
                    type="text"
                    value={hargaPromoFormatted}
                    onChange={handleHargaPromoChange}
                    placeholder="2.350.000.000"
                    className={cn(
                      'w-full h-14 pl-20 pr-10 rounded-xl text-base font-semibold text-slate-100',
                      'bg-slate-900/50 border-2 border-slate-800',
                      'focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20',
                      'transition-all duration-300',
                      'placeholder:text-slate-600',
                    )}
                  />
                  {hasPromo && (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <Sparkles className="h-5 w-5 text-amber-500" />
                    </motion.div>
                  )}
                </div>
              </div>
            </FormField>

            {/* Discount Calculator */}
            <AnimatePresence>
              {savings > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 to-black border border-emerald-500/20 p-6">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl animate-pulse" />
                    <div className="relative">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                            <TrendingDown className="h-6 w-6 text-emerald-400" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-emerald-400">
                              Penghematan Buyer
                            </h3>
                            <p className="text-xs text-slate-500">Potensi inquiry +40%</p>
                          </div>
                        </div>
                        <motion.div
                          className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full"
                          animate={{ scale: [1, 1.05, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <div className="flex items-center gap-1">
                            <Percent className="h-4 w-4 text-emerald-400" />
                            <span className="text-lg font-black text-emerald-400">
                              {discount.toFixed(1)}%
                            </span>
                          </div>
                        </motion.div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                          <span className="text-sm text-slate-400">Harga Normal</span>
                          <span className="text-base font-semibold text-slate-400 line-through">
                            {formatCurrency(Number(harga))}
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <span className="text-sm font-semibold text-emerald-400">
                            Harga Promo
                          </span>
                          <span className="text-lg font-bold text-emerald-400">
                            {formatCurrency(Number(hargaPromo))}
                          </span>
                        </div>

                        <div className="pt-4 border-t border-slate-800">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Zap className="h-5 w-5 text-emerald-400" />
                              <span className="text-base font-bold text-emerald-400">
                                Total Hemat
                              </span>
                            </div>
                            <span className="text-2xl font-black text-emerald-400">
                              {formatCurrency(Number(savings))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Indicator — tidak untuk SEWA: grid harga sudah punya kartu
          "Yang dilihat pencari kos" yang menyatakan hal yang sama dengan lebih
          konkret (angka + durasinya), jadi baris ini cuma jadi kebisingan. */}
      {((isLelang && nilaiLimit && nilaiLimit > 0 && uangJaminan && uangJaminan > 0) ||
        (!isLelang && !isSewa && harga && harga > 0)) && (
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
                ✨ Penetapan harga sudah lengkap dan siap!
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Lanjut ke step berikutnya untuk melengkapi detail property
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}


// --------------------------------------------------------------------------
// SEWA — alurnya sengaja: KAMAR dulu, baru DURASI & HARGA, baru biaya lain.
//
// Sebelumnya harga ditanya lebih dulu, padahal justru jumlah & tipe kamar yang
// menentukan harganya seragam atau tidak — pemilik dipaksa menjawab "berapa
// harganya" sebelum pernah ditanya "kamarnya seperti apa dan ada berapa".
//
// Tiga bagian bernomor, satu keputusan per bagian:
//   1. Kamar    — seragam atau beberapa tipe, jumlah & spesifikasinya.
//   2. Harga    — minimal sewa → durasi yang ditawarkan → grid harga.
//   3. Biaya    — deposit & promo, semuanya opsional.
// --------------------------------------------------------------------------

/** Bingkai bagian bernomor: nomor besar + garis penghubung ala timeline. */
function Bagian({
  nomor,
  judul,
  desc,
  badge,
  children,
}: {
  nomor: number;
  judul: string;
  desc?: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative sm:pl-16">
      {/* Rel nomor — hanya di layar lebar; di HP nomor pindah ke judul supaya
          tidak memakan lebar yang dibutuhkan input. */}
      <div className="pointer-events-none absolute bottom-0 left-0 top-0 hidden w-11 flex-col items-center sm:flex">
        <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-emerald-400/50 bg-gradient-to-br from-emerald-400/30 via-emerald-400/10 to-transparent text-base font-black text-emerald-200">
          <div className="absolute inset-0 rounded-2xl bg-emerald-400/15 blur-md" />
          <span className="relative">{nomor}</span>
        </div>
        <div className="mt-2 w-px flex-1 bg-gradient-to-b from-emerald-400/30 via-white/10 to-transparent" />
      </div>

      <header className="mb-3.5 flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-emerald-400/40 bg-emerald-400/20 text-sm font-black text-emerald-200 sm:hidden">
          {nomor}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold tracking-tight text-white">{judul}</h3>
            {badge && (
              <span className="rounded-full border border-white/[0.12] bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                {badge}
              </span>
            )}
          </div>
          {desc && (
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{desc}</p>
          )}
        </div>
      </header>

      <div className="space-y-4 pb-2">{children}</div>

      {/* Pemisah antar bagian — hanya di HP, karena di layar lebar rel nomor
          di kiri sudah cukup menandai batasnya. */}
      <div className="mt-6 h-px bg-gradient-to-r from-white/10 to-transparent sm:hidden" />
    </section>
  );
}

function SewaPricingBlock({ form, isEditMode = false }: Step3Props) {
  const {
    watch,
    setValue,
    getValues,
    clearErrors,
    formState: { errors },
  } = form;

  // True kalau agent sudah pilih "harga utama" sendiri — begitu true,
  // auto-priority berhenti menimpa pilihan itu tiap kali durasi lain diisi.
  const manualPrimaryRef = useRef(false);

  const durasiSewa = watch('durasi_sewa');
  const hargaPromo = watch('harga_promo');

  // Biaya di luar harga sewa & deposit (listrik, air, wifi, IPL…).
  const biayaTambahan = (watch('biaya_tambahan') ?? []) as BiayaTambahan[];
  const setBiayaTambahan = (next: BiayaTambahan[]) =>
    setValue('biaya_tambahan', next as ListingFormData['biaya_tambahan'], {
      shouldValidate: true,
      shouldDirty: true,
    });

  // --- Tipe kamar (khusus KOS) --------------------------------------------
  // Mode multi-tipe = daftar tipe tidak kosong. Tidak ada flag boolean
  // terpisah supaya mode & data mustahil bertentangan.
  const kategori = watch('kategori');
  const isKos = kategori === 'KOS';
  const kamarTipe = (watch('kamar_tipe') ?? []) as KamarTipe[];
  const adaTipe = isKos && kamarTipe.length > 0;

  // Sidik jari isi daftar, bukan identitas arraynya: effect di bawah menulis
  // kolom agregat ke form, dan kalau dependensinya identitas array, satu clone
  // dari watch() saja cukup membuat effect → setValue → render berputar.
  const tipeSignature = JSON.stringify(kamarTipe);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ringkasanTipe = useMemo(() => ringkasKamarTipe(kamarTipe), [tipeSignature]);

  const setKamarTipe = (next: KamarTipe[]) =>
    setValue('kamar_tipe', next as ListingFormData['kamar_tipe'], {
      shouldValidate: true,
      shouldDirty: true,
    });

  // Daftar tipe yang sempat dibuat lalu mode dikembalikan ke "semua kamar
  // sama" — disimpan supaya menekan tombol mode dua kali tidak menghapus
  // pekerjaan yang sudah diisi.
  const simpananTipeRef = useRef<KamarTipe[]>([]);

  const hargaListingByDurasi: Record<DurasiSewa, number | null | undefined> = {
    HARIAN: watch('harga_sewa_harian'),
    MINGGUAN: watch('harga_sewa_mingguan'),
    BULANAN: watch('harga_sewa_bulanan'),
    TAHUNAN: watch('harga_sewa_tahunan'),
  };

  // Saat pakai tipe kamar, harga per durasi di level listing adalah harga
  // TERMURAH antar tipe ("mulai dari"), bukan angka yang diketik langsung.
  const hargaByDurasi: Record<DurasiSewa, number | null | undefined> = adaTipe
    ? {
        HARIAN: ringkasanTipe.hargaMin.HARIAN ?? null,
        MINGGUAN: ringkasanTipe.hargaMin.MINGGUAN ?? null,
        BULANAN: ringkasanTipe.hargaMin.BULANAN ?? null,
        TAHUNAN: ringkasanTipe.hargaMin.TAHUNAN ?? null,
      }
    : hargaListingByDurasi;

  /**
   * Durasi yang boleh ditawarkan kategori ini — sumbernya @/lib/sewaKapabilitas,
   * tabel yang sama yang dipakai validator & server.
   *
   * Mulai dari sini, `semuaDurasi` berarti "semua durasi yang MASUK AKAL untuk
   * kategori ini", bukan keempat-empatnya. Seluruh turunan di bawah — chip yang
   * dirender, durasi yang dianggap terisi, pilihan satuan minimal sewa —
   * otomatis ikut menyempit, dan tidak ada satu pun tempat yang perlu tahu
   * kategori apa yang sedang dipilih.
   */
  const durasiDiizinkan = useMemo(
    () => durasiSewaDiizinkan(kategori) as DurasiSewa[],
    [kategori],
  );
  const semuaDurasi = durasiDiizinkan;

  const filledDurations = semuaDurasi.filter(
    (d) => hargaByDurasi[d] != null && Number(hargaByDurasi[d]) > 0,
  );

  // Satuan minimal sewa tidak boleh menawarkan durasi yang harganya sendiri
  // tidak boleh diisi — "minimal 2 minggu" pada gudang adalah syarat yang tak
  // punya tarif pasangannya.
  const minimalSatuanOptions = useMemo(
    () =>
      MINIMAL_SATUAN_OPTIONS.filter(
        (o) => o.value === '' || durasiDiizinkan.includes(o.value as DurasiSewa),
      ),
    [durasiDiizinkan],
  );

  // Durasi yang dinyalakan tapi belum diisi harganya. Disimpan lokal karena
  // "ditawarkan" dan "sudah ada angkanya" itu dua keadaan berbeda: kolom
  // harganya harus muncul dulu sebelum ada angka yang bisa disimpan.
  const [activeDurations, setActiveDurations] = useState<Set<DurasiSewa>>(
    () => new Set(filledDurations),
  );

  /**
   * Durasi yang SUDAH punya angka harga wajib selalu punya kolomnya sendiri.
   *
   * `activeDurations` hanya dihitung sekali saat mount. Begitu daftar harga
   * berubah dari sumber lain — paling sering saat agent berpindah dari "semua
   * kamar sama" ke tipe kamar, yang memindahkan harga ke dalam tipe — kolomnya
   * bisa hilang sementara angkanya tetap tersimpan. Yang terlihat oleh agent:
   * harga yang sudah diisi lenyap dari layar, dan "Lanjut" menolak karena
   * harga yang menurutnya belum ada. Efek ini menutup celah itu.
   */
  useEffect(() => {
    setActiveDurations((prev) => {
      const next = new Set(prev);
      let berubah = false;
      for (const d of filledDurations) {
        if (!next.has(d)) {
          next.add(d);
          berubah = true;
        }
      }
      return berubah ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filledDurations.join(',')]);

  // Angka yang sempat dikosongkan karena durasinya dimatikan. Mematikan durasi
  // tidak boleh terasa seperti menghapus pekerjaan — menyalakannya kembali
  // memulihkan angka terakhir. Kuncinya nomor baris ('listing' / index tipe).
  const stashHargaRef = useRef<Partial<Record<DurasiSewa, Record<string, number>>>>({});

  const [hargaPromoFormatted, setHargaPromoFormatted] = useState(formatThousand(hargaPromo));
  useEffect(() => setHargaPromoFormatted(formatThousand(hargaPromo)), [hargaPromo]);

  const minimalSewaJumlah = watch('minimal_sewa_jumlah');
  const minimalSewaSatuan = watch('minimal_sewa_satuan');

  // Minimal sewa jadi "lantai" durasi: kalau minimal 1 Tahun, menawarkan harga
  // harian/mingguan/bulanan tidak masuk akal — durasi di bawahnya dikunci.
  const floorRank = minimalSewaSatuan ? DURASI_RANK[minimalSewaSatuan] : 0;
  const isDurasiLocked = (d: DurasiSewa) => DURASI_RANK[d] < floorRank;
  const durasiTerkunci = semuaDurasi.filter(isDurasiLocked);

  /** Kosongkan satu durasi di semua baris harga (dipakai saat durasi dimatikan/dikunci). */
  const bersihkanDurasi = (d: DurasiSewa) => {
    const field = DURASI_SEWA_FIELD_MAP[d];
    const simpan: Record<string, number> = {};

    if (adaTipe) {
      let berubah = false;
      const next = kamarTipe.map((t, i) => {
        const nilai = Number(t[field] ?? 0);
        if (nilai > 0) {
          simpan[String(i)] = nilai;
          berubah = true;
          return { ...t, [field]: null };
        }
        return t;
      });
      if (berubah) setKamarTipe(next);
    } else {
      const nilai = Number(getValues(field) ?? 0);
      if (nilai > 0) simpan.listing = nilai;
      if (getValues(field) != null) {
        setValue(field, undefined as any, { shouldValidate: true });
      }
    }

    if (Object.keys(simpan).length > 0) stashHargaRef.current[d] = simpan;
  };

  // Begitu lantai minimal sewa naik, durasi di bawahnya otomatis dimatikan &
  // angkanya dibersihkan (tersimpan di stash, bisa kembali kalau lantainya
  // diturunkan lagi).
  useEffect(() => {
    if (durasiTerkunci.length === 0) return;

    setActiveDurations((prev) => {
      const next = new Set(prev);
      let berubah = false;
      for (const d of durasiTerkunci) {
        if (next.has(d)) {
          next.delete(d);
          berubah = true;
        }
      }
      return berubah ? next : prev;
    });

    for (const d of durasiTerkunci) bersihkanDurasi(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorRank]);

  /**
   * Kategori berubah → durasi yang tidak lagi sah dibersihkan, DENGAN kabar.
   *
   * Ini menutup satu-satunya celah yang tersisa di sisi form: isi wizard
   * disimpan sebagai draft, jadi agent bisa mengisi harga harian & mingguan
   * saat kategorinya masih Kos, lalu mengubahnya jadi Gudang di langkah
   * sebelumnya. Angka lama tidak akan terlihat lagi (chipnya sudah tidak
   * dirender) tapi tetap ikut terkirim — persis jenis kesalahan yang mustahil
   * ditemukan sendiri oleh yang mengalaminya.
   *
   * Yang penting: pembersihannya DIUMUMKAN. Menghapus angka yang sudah diketik
   * tanpa memberi tahu adalah cara tercepat membuat orang berhenti percaya pada
   * formulir — ia akan mengira dirinya sendiri yang lupa mengisi.
   *
   * Catatan aman: daftar terlarang hanya mungkin tidak kosong untuk kategori
   * non-Kos, dan tipe kamar hanya ada pada Kos. Jadi `bersihkanDurasi` di sini
   * selalu menempuh cabang setValue (satu field per panggilan), bukan cabang
   * setKamarTipe yang tidak aman dipanggil berulang dalam satu putaran.
   */
  const [durasiDibuang, setDurasiDibuang] = useState<DurasiSewa[]>([]);

  useEffect(() => {
    const terlarang = DURASI_SEMUA.filter((d) => !durasiDiizinkan.includes(d));

    const adaIsinya = terlarang.filter((d) => {
      const field = DURASI_SEWA_FIELD_MAP[d];
      if (Number(getValues(field) ?? 0) > 0) return true;
      return ((getValues('kamar_tipe') ?? []) as KamarTipe[]).some(
        (t) => Number(t[field] ?? 0) > 0,
      );
    });

    if (adaIsinya.length > 0) {
      for (const d of adaIsinya) bersihkanDurasi(d);
      setDurasiDibuang(adaIsinya);
    }

    setActiveDurations((prev) => {
      const next = new Set(prev);
      let berubah = false;
      for (const d of terlarang) {
        if (next.has(d)) {
          next.delete(d);
          berubah = true;
        }
      }
      return berubah ? next : prev;
    });

    // Satuan minimal sewa & durasi utama ikut dibetulkan — keduanya menunjuk
    // durasi, dan durasi yang ditunjuknya bisa saja barusan hilang.
    const satuan = getValues('minimal_sewa_satuan');
    if (satuan && !durasiDiizinkan.includes(satuan as DurasiSewa)) {
      setValue('minimal_sewa_satuan', undefined as any, { shouldValidate: true });
      setValue('minimal_sewa_jumlah', undefined as any, { shouldValidate: true });
    }

    const utama = getValues('durasi_sewa');
    if (utama && !durasiDiizinkan.includes(utama as DurasiSewa)) {
      // Dikosongkan saja, tidak ditebak di sini: effect auto-pilih di bawah
      // yang memilih penggantinya dari durasi yang benar-benar terisi.
      manualPrimaryRef.current = false;
      setValue('durasi_sewa', undefined as any, { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durasiDiizinkan.join(',')]);

  // Hidrasi toggle dari nilai yang sudah ada (draft dipulihkan / edit listing):
  // komponen ini sudah ter-mount sebelum reset() membawa datanya.
  useEffect(() => {
    if (filledDurations.length === 0) return;
    setActiveDurations((prev) => {
      const next = new Set(prev);
      let berubah = false;
      for (const d of filledDurations) {
        if (!next.has(d)) {
          next.add(d);
          berubah = true;
        }
      }
      return berubah ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filledDurations.join(',')]);

  // Kolom agregat listing selalu turunan dari tipe kamar — ditulis ke form
  // supaya payload submit, live preview & validasi memakai angka yang sama
  // dengan yang nanti dihitung ulang server.
  useEffect(() => {
    if (!adaTipe) return;
    const agregat = agregatSewaDariTipe(kamarTipe);

    for (const d of semuaDurasi) {
      const field = DURASI_SEWA_FIELD_MAP[d];
      const nilai = agregat[field];
      if ((getValues(field) ?? null) !== (nilai ?? null)) {
        setValue(field, (nilai ?? undefined) as any, { shouldValidate: true });
      }
    }

    // Fasilitas kamar level listing (dipakai chip di card & filter) = irisan
    // antar tipe. Diisi di sini, bukan oleh agent: di mode tipe kamar ia hanya
    // mengisi fasilitas per tipe.
    const irisanFasilitas = fasilitasKamarSeragam(kamarTipe);
    if ((getValues('fasilitas_kamar') || null) !== irisanFasilitas) {
      setValue('fasilitas_kamar', irisanFasilitas as any);
    }

    if (getValues('total_kamar') !== agregat.total_kamar) {
      setValue('total_kamar', (agregat.total_kamar || undefined) as any);
    }
    if (getValues('kamar_tersedia') !== agregat.kamar_tersedia) {
      setValue('kamar_tersedia', agregat.kamar_tersedia as any);
    }
    // Promo pada harga "mulai dari" tidak bisa ditafsirkan (promo untuk tipe
    // yang mana?) — dibersihkan, dan inputnya disembunyikan di Bagian 3.
    if (getValues('harga_promo') != null) {
      setValue('harga_promo', undefined as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adaTipe, tipeSignature]);

  // Auto-pilih "harga utama" dari durasi yang terisi (prioritas Bulanan >
  // Tahunan > Mingguan > Harian) SETIAP durasi baru diisi — kecuali agent
  // sudah memilih manual & pilihannya masih terisi.
  useEffect(() => {
    const stillValid = !!durasiSewa && filledDurations.includes(durasiSewa);
    if (stillValid && manualPrimaryRef.current) return;
    if (!stillValid) manualPrimaryRef.current = false;

    const auto = DURASI_PRIORITY.find((d) => filledDurations.includes(d));
    if (auto !== durasiSewa) {
      setValue('durasi_sewa', auto as any, { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filledDurations.join(',')]);

  const setPrimaryManually = (d: DurasiSewa) => {
    manualPrimaryRef.current = true;
    setValue('durasi_sewa', d, { shouldValidate: true });
  };

  // Jaga field generik `harga` sinkron dengan harga durasi utama — dipakai
  // sort/filter & validasi. Promo lama yang sudah >= harga baru dibersihkan
  // supaya tidak nyangkut sebagai "promo" yang justru lebih mahal.
  useEffect(() => {
    const primaryValue = durasiSewa ? hargaByDurasi[durasiSewa] : undefined;
    const newHarga = primaryValue && Number(primaryValue) > 0 ? Number(primaryValue) : undefined;
    setValue('harga', newHarga as any);
    if (newHarga) clearErrors('harga');

    const currentPromo = getValues('harga_promo');
    if (currentPromo && newHarga && Number(currentPromo) >= newHarga) {
      setValue('harga_promo', undefined as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    durasiSewa,
    hargaByDurasi.HARIAN,
    hargaByDurasi.MINGGUAN,
    hargaByDurasi.BULANAN,
    hargaByDurasi.TAHUNAN,
  ]);

  /** Nyalakan/matikan durasi. Mematikan = angkanya disimpan lalu dikosongkan. */
  const toggleDurasi = (d: DurasiSewa) => {
    if (isDurasiLocked(d)) return;

    const sedangAktif = activeDurations.has(d) || filledDurations.includes(d);

    if (sedangAktif) {
      bersihkanDurasi(d);
      setActiveDurations((prev) => {
        const next = new Set(prev);
        next.delete(d);
        return next;
      });
      return;
    }

    const simpan = stashHargaRef.current[d];
    if (simpan) {
      const field = DURASI_SEWA_FIELD_MAP[d];
      if (adaTipe) {
        setKamarTipe(
          kamarTipe.map((t, i) =>
            simpan[String(i)] ? { ...t, [field]: simpan[String(i)] } : t,
          ),
        );
      } else if (simpan.listing) {
        setValue(field, simpan.listing as any, { shouldValidate: true });
      }
    }
    setActiveDurations((prev) => new Set(prev).add(d));
  };

  // --- Baris grid harga ----------------------------------------------------
  // Satu baris = satu hal yang harganya bisa berbeda. Mode seragam punya satu
  // baris; mode tipe kamar punya satu baris per tipe.
  const barisHarga: BarisHarga[] = adaTipe
    ? kamarTipe.map((t, i) => ({
        key: String(i),
        label: t.nama?.trim() || `Tipe ${i + 1}`,
        meta: [
          `${Number(t.jumlah_kamar ?? 0)} kamar`,
          `${Number(t.kamar_tersedia ?? 0)} kosong`,
          t.kamar_mandi_tipe ? KAMAR_MANDI_TIPE_LABEL[t.kamar_mandi_tipe] : null,
          t.luas_kamar ? `${t.luas_kamar} m²` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        harga: {
          HARIAN: t.harga_sewa_harian,
          MINGGUAN: t.harga_sewa_mingguan,
          BULANAN: t.harga_sewa_bulanan,
          TAHUNAN: t.harga_sewa_tahunan,
        },
        onHarga: (d, v) =>
          setKamarTipe(
            kamarTipe.map((x, idx) =>
              idx === i ? { ...x, [DURASI_SEWA_FIELD_MAP[d]]: v } : x,
            ),
          ),
      }))
    : [
        {
          key: 'listing',
          label: isKos ? 'Semua kamar' : 'Harga sewa',
          meta: isKos
            ? [
                watch('total_kamar') ? `${watch('total_kamar')} kamar` : null,
                watch('kamar_tersedia') != null
                  ? `${watch('kamar_tersedia')} kosong`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ') || undefined
            : undefined,
          harga: hargaListingByDurasi,
          onHarga: (d, v) =>
            setValue(DURASI_SEWA_FIELD_MAP[d], (v ?? undefined) as any, {
              shouldValidate: true,
            }),
        },
      ];

  // --- Perpindahan mode struktur kamar ------------------------------------

  /**
   * Menyalakan mode tipe kamar. Tipe pertama DIISI dari data kamar yang sudah
   * diketik (luas, kamar mandi, kapasitas, jumlah & harga) — bukan kartu
   * kosong. Agent yang baru sadar kosnya tidak seragam tidak perlu mengetik
   * ulang apa pun; ia cuma menambah tipe kedua.
   */
  const aktifkanTipeKamar = () => {
    if (kamarTipe.length > 0) return;

    /**
     * Pastikan ADA kolom harga yang bisa diketik begitu mode tipe menyala.
     *
     * Tanpa ini, agent yang menyalakan tipe kamar sebelum mengisi harga apa pun
     * masuk ke jalan buntu: grid harga tidak menampilkan satu kolom pun (tidak
     * ada durasi yang aktif), jadi tidak ada tempat mengetik — sementara
     * "Lanjut" menolak dengan alasan harga belum diisi. Kos di Indonesia
     * praktis selalu bulanan, jadi itu yang dinyalakan; kalau minimal sewa
     * mengunci bulanan, dipilih durasi terpendek yang masih boleh.
     */
    setActiveDurations((prev) => {
      if (prev.size > 0) return prev;
      const pertama = DURASI_PRIORITY.find((d) => !isDurasiLocked(d));
      return pertama ? new Set<DurasiSewa>([pertama]) : prev;
    });

    if (simpananTipeRef.current.length > 0) {
      setKamarTipe(simpananTipeRef.current);
      return;
    }

    const kmTipe = getValues('kamar_mandi_tipe');
    const totalKamar = Number(getValues('total_kamar') ?? 0) || 1;
    const tersediaRaw = getValues('kamar_tersedia');
    const tersedia =
      tersediaRaw != null ? Math.min(Number(tersediaRaw), totalKamar) : totalKamar;

    setKamarTipe([
      {
        // Nama menyebut pembedanya kalau sudah diketahui — "Tipe A" tidak
        // memberi tahu calon penghuni apa pun.
        nama:
          kmTipe === 'DALAM'
            ? 'Kamar Mandi Dalam'
            : kmTipe === 'LUAR'
            ? 'Kamar Mandi Luar'
            : 'Tipe A',
        jumlah_kamar: totalKamar,
        kamar_tersedia: tersedia,
        luas_kamar: (getValues('luas_kamar') as number | null) ?? null,
        kamar_mandi_tipe: kmTipe ?? null,
        kapasitas_penghuni: (getValues('kapasitas_penghuni') as number | null) ?? null,
        harga_sewa_harian: (getValues('harga_sewa_harian') as number | null) ?? null,
        harga_sewa_mingguan: (getValues('harga_sewa_mingguan') as number | null) ?? null,
        harga_sewa_bulanan: (getValues('harga_sewa_bulanan') as number | null) ?? null,
        harga_sewa_tahunan: (getValues('harga_sewa_tahunan') as number | null) ?? null,
        // Fasilitas yang sudah dicentang saat mode seragam ikut pindah ke tipe
        // pertama — berpindah mode tidak boleh terasa seperti kehilangan isian.
        fasilitas_kamar: getValues('fasilitas_kamar') || null,
        catatan: null,
      },
    ]);
  };

  /** Kembali ke "semua kamar sama" — daftar tipe disimpan dulu, tidak dibuang. */
  const matikanTipeKamar = () => {
    if (kamarTipe.length > 0) simpananTipeRef.current = kamarTipe;
    setKamarTipe([]);
  };

  // Error per baris tipe dari RHF. Dicast karena path kustom hasil superRefine
  // (pesan yang menempel ke barisnya) tidak ada di tipe FieldErrors bawaan.
  const errorTipeRaw = errors.kamar_tipe as unknown as
    | { message?: string; root?: { message?: string } }
    | (KamarTipeRowError | undefined)[]
    | undefined;
  const rowErrorsTipe = Array.isArray(errorTipeRaw) ? errorTipeRaw : undefined;
  const groupErrorTipe = Array.isArray(errorTipeRaw)
    ? undefined
    : errorTipeRaw?.message ?? errorTipeRaw?.root?.message;

  // --- Deposit & promo ----------------------------------------------------
  const deposit = watch('deposit');
  const [depositFormatted, setDepositFormatted] = useState(formatThousand(deposit));
  useEffect(() => setDepositFormatted(formatThousand(deposit)), [deposit]);

  const handleDepositChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fmt = formatThousand(e.target.value);
    setDepositFormatted(fmt);
    const parsed = parseThousand(fmt);
    setValue('deposit', parsed > 0 ? parsed : (undefined as any));
  };

  const setDepositToPrimaryPrice = () => {
    if (durasiSewa && hargaByDurasi[durasiSewa]) {
      const val = Number(hargaByDurasi[durasiSewa]);
      setValue('deposit', val, { shouldValidate: true });
      setDepositFormatted(formatThousand(val));
    }
  };

  const handleHargaPromoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fmt = formatThousand(e.target.value);
    setHargaPromoFormatted(fmt);
    const parsed = parseThousand(fmt);
    setValue('harga_promo', parsed > 0 ? parsed : (undefined as any));
  };

  const setMinimalSatuan = (v: string) => {
    setValue('minimal_sewa_satuan', (v || undefined) as any, { shouldValidate: true });
    // Pilih satuan tanpa isi jumlah itu tidak bermakna — default-kan ke 1.
    if (v && !getValues('minimal_sewa_jumlah')) {
      setValue('minimal_sewa_jumlah', 1, { shouldValidate: true });
    }
    if (!v) setValue('minimal_sewa_jumlah', undefined as any, { shouldValidate: true });
  };

  const primaryPrice = durasiSewa ? Number(hargaByDurasi[durasiSewa] ?? 0) : 0;
  const promoValue = Number(hargaPromo ?? 0);
  const promoHemat =
    primaryPrice > 0 && promoValue > 0 && promoValue < primaryPrice
      ? primaryPrice - promoValue
      : 0;
  const promoPersen = promoHemat > 0 ? (promoHemat / primaryPrice) * 100 : 0;
  const primaryOption = DURASI_SEWA_OPTIONS.find((d) => d.value === durasiSewa);
  // Dipakai tombol saran deposit: kalau nilainya sudah sama, tombolnya berubah
  // jadi penanda (tercentang) alih-alih ajakan menekan lagi.
  const depositSamaDenganHarga =
    primaryPrice > 0 && Number(deposit ?? 0) === primaryPrice;

  // "Mulai dari" hanya dipakai kalau tipe-tipenya memang beda harga; kalau
  // semua tipe harganya sama, kata "mulai" cuma menambah keraguan.
  const hargaTampil =
    durasiSewa && primaryPrice > 0
      ? {
          nominal: primaryPrice,
          durasi: durasiSewa,
          mulaiDari:
            adaTipe &&
            (ringkasanTipe.hargaMax[durasiSewa] ?? 0) >
              (ringkasanTipe.hargaMin[durasiSewa] ?? 0),
        }
      : null;

  const nomorHarga = isKos ? 2 : 1;

  return (
    <motion.div
      key="sewa"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="space-y-8"
    >
      {/* ================= 1. KAMAR (khusus KOS) ================= */}
      {isKos && (
        <Bagian
          nomor={1}
          judul="Kamar & Fasilitas"
          desc="Isi kamarnya dulu — jumlah & tipe kamar inilah yang menentukan harganya seragam atau tidak."
        >
          <StrukturKamarSwitch
            adaTipe={adaTipe}
            onPilihSeragam={matikanTipeKamar}
            onPilihMultiTipe={aktifkanTipeKamar}
          />

          <AnimatePresence mode="wait" initial={false}>
            {adaTipe ? (
              <motion.div
                key="multi"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
              >
                <KamarTipeBuilder
                  value={kamarTipe}
                  onChange={setKamarTipe}
                  rowErrors={rowErrorsTipe}
                  groupError={groupErrorTipe}
                  isEditMode={isEditMode}
                  kota={watch('kota')}
                  alamat={watch('alamat_lengkap')}
                />
              </motion.div>
            ) : (
              <motion.div
                key="seragam"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
              >
                <KamarSeragamFields form={form} isEditMode={isEditMode} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Fasilitas menempel dengan kamarnya — dipisah berdasarkan
              cakupan: milik kamar vs milik gedung. Sebelumnya keduanya ada di
              step Spesifikasi, jadi hilang dari pandangan justru saat pemilik
              sedang membayangkan kamarnya. */}
          <FasilitasSection form={form} adaTipe={adaTipe} />
        </Bagian>
      )}

      {/* ================= 2. DURASI & HARGA ================= */}
      <Bagian
        nomor={nomorHarga}
        judul={adaTipe ? 'Harga per Tipe Kamar' : 'Durasi & Harga Sewa'}
        desc={
          adaTipe
            ? 'Semua harga dikumpulkan di sini supaya perbedaan antar tipe langsung terbaca.'
            : 'Tentukan komitmen minimal, lalu harga untuk tiap durasi yang Anda tawarkan.'
        }
      >
        {/* Minimal sewa lebih dulu: pilihan ini yang menentukan durasi mana
            yang masuk akal untuk ditawarkan di bawahnya. */}
        <div className={cn(PANEL, 'p-5')}>
          <div className="mb-4 flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-emerald-400/30 bg-emerald-400/15">
              <Clock className="h-4 w-4 text-emerald-300" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base font-bold text-white">Minimal Sewa</h4>
                <span className="rounded-full border border-white/[0.12] bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                  Opsional
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Komitmen minimal penyewa. Kosongkan kalau bebas.
              </p>
            </div>
          </div>

          <div className="flex items-stretch gap-3">
            <div className="w-20 shrink-0 sm:w-24">
              {/* Angka tanpa satuan tidak bermakna — dinonaktifkan sampai
                  satuannya dipilih, jadi tidak ada state "3" tanpa satuan. */}
              <input
                type="text"
                inputMode="numeric"
                disabled={!minimalSewaSatuan}
                value={minimalSewaJumlah ?? ''}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
                  setValue(
                    'minimal_sewa_jumlah',
                    digits ? Number(digits) : (undefined as any),
                    { shouldValidate: true },
                  );
                }}
                placeholder={minimalSewaSatuan ? '1' : '—'}
                aria-label="Jumlah minimal sewa"
                className={cn(
                  'h-12 w-full rounded-xl border text-center text-base font-bold transition-all',
                  'placeholder:text-slate-500 focus:outline-none',
                  minimalSewaSatuan
                    ? 'border-white/[0.12] bg-black/40 text-white focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20'
                    : 'cursor-not-allowed border-white/[0.06] bg-black/20 text-slate-600',
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <PremiumSelect
                value={minimalSewaSatuan ?? ''}
                onChange={setMinimalSatuan}
                options={minimalSatuanOptions}
                placeholder="Pilih satuan…"
                accent="emerald"
                ariaLabel="Satuan minimal sewa"
                leadingIcon={<CalendarRange className="h-4 w-4" />}
              />
            </div>
          </div>

          <AnimatePresence>
            {floorRank > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <p className="mt-4 flex items-start gap-2 border-t border-white/10 pt-4 text-xs text-slate-300">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <span>
                    Minimal{' '}
                    <strong className="text-white">
                      {minimalSewaJumlah || 1} {DURASI_SATUAN_LABEL[minimalSewaSatuan!]}
                    </strong>{' '}
                    — durasi yang lebih pendek otomatis dikunci karena tidak mungkin
                    ditawarkan.
                  </span>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Kabar bahwa harga durasi tertentu dibersihkan karena kategori
            berubah. Muncul TEPAT di atas grid harga — di tempat angka itu
            dulu terlihat, bukan di ujung halaman sebagai toast yang keburu
            hilang sebelum sempat dibaca. */}
        <AnimatePresence>
          {durasiDibuang.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/[0.07] p-4"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-amber-200">
                  Harga{' '}
                  {durasiDibuang.map((d) => LABEL_DURASI[d]).join(' & ')} dihapus
                </p>
                <p className="mt-1 text-xs text-amber-100/70">
                  {pesanDurasiTidakSah(kategori)} Isi ulang harganya pada durasi
                  yang tersedia di bawah.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDurasiDibuang([])}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-amber-200/70 transition-colors hover:bg-amber-400/10 hover:text-amber-100"
              >
                Mengerti
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <HargaSewaGrid
          baris={barisHarga}
          durasiTersedia={durasiDiizinkan}
          durasiAktif={Array.from(activeDurations).filter((d) => !isDurasiLocked(d))}
          durasiTerkunci={durasiTerkunci}
          onToggleDurasi={toggleDurasi}
          durasiUtama={durasiSewa ?? null}
          onPilihUtama={setPrimaryManually}
          durasiTerisi={filledDurations}
          hargaTampil={hargaTampil}
          error={errors.durasi_sewa?.message}
        />

        {/* Listrik & air menempel dengan harga karena keduanya mengubah ARTI
            angka harga, bukan sekadar informasi tambahan. */}
        {isKos && <TermasukBiaya form={form} />}
      </Bagian>

      {/* ================= 3. BIAYA LAIN ================= */}
      <AnimatePresence initial={false}>
        {filledDurations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Bagian
              nomor={nomorHarga + 1}
              judul="Biaya Lain"
              badge="Opsional"
              desc="Boleh dilewati — bisa dilengkapi kapan saja setelah listing tayang."
            >
              <div
                className={cn(
                  'grid gap-4',
                  // Promo hanya ada di mode kamar seragam; saat mode tipe kamar
                  // kolom kedua kosong, jadi deposit tidak dibiarkan melebar
                  // sendirian selebar form.
                  adaTipe ? 'max-w-xl' : 'lg:grid-cols-2',
                )}
              >
                {/* Deposit — selalu dikembalikan, jadi tidak perlu opsi
                    refundable/hangus. */}
                <FormField
                  label="Deposit"
                  description="Uang jaminan di awal, dikembalikan saat penyewa keluar"
                >
                  <div>
                    <div className="relative">
                      <div className="pointer-events-none absolute left-4 top-1/2 z-10 flex -translate-y-1/2 items-center gap-2">
                        <Shield className="h-4 w-4 text-emerald-400" />
                        <span className="text-sm font-bold text-emerald-400">Rp</span>
                      </div>
                      <input
                        type="text"
                        value={depositFormatted}
                        onChange={handleDepositChange}
                        placeholder="0"
                        className={cn(
                          'h-14 w-full rounded-xl pl-20 pr-4 text-base font-semibold text-slate-100',
                          'border-2 border-slate-800 bg-slate-900/50',
                          'focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
                          'transition-all duration-300 placeholder:text-slate-600',
                        )}
                      />
                    </div>

                    {/* Tombol saran DI BAWAH input, bukan mengapung di dalamnya:
                        labelnya ikut panjang-pendek isi form (nama durasi,
                        "termurah"), jadi versi absolut pasti menimpa angka yang
                        diketik di lebar tertentu. Nominalnya ikut ditulis supaya
                        pemilik tahu yang akan diisi sebelum menekannya. */}
                    {primaryPrice > 0 && (
                      <button
                        type="button"
                        onClick={setDepositToPrimaryPrice}
                        aria-label={`Isi deposit sebesar ${formatCurrency(primaryPrice)}`}
                        className={cn(
                          'mt-2.5 inline-flex max-w-full items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors',
                          depositSamaDenganHarga
                            ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-200'
                            : 'border-white/[0.12] bg-black/30 text-slate-200 hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-emerald-200',
                        )}
                      >
                        {depositSamaDenganHarga ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        )}
                        <span className="truncate">
                          1× harga {adaTipe ? 'termurah' : primaryOption?.label.toLowerCase()}
                          <span className="ml-1 font-black text-white">
                            {formatCurrency(primaryPrice)}
                          </span>
                        </span>
                      </button>
                    )}
                  </div>
                </FormField>

                {/* Harga promo hanya untuk mode seragam: pada mode tipe kamar,
                    harga listing adalah "mulai dari" sehingga promo terhadapnya
                    tidak bisa ditafsirkan (promo untuk tipe yang mana?). */}
                {!adaTipe && primaryPrice > 0 && primaryOption ? (
                  <FormField
                    label={`Harga Promo — ${primaryOption.label}`}
                    error={errors.harga_promo?.message}
                    description={`Diskon dari ${formatCurrency(primaryPrice)}${primaryOption.suffix}. Durasi lain tidak terpengaruh.`}
                  >
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 z-10 flex -translate-y-1/2 items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-400" />
                        <span className="text-sm font-bold text-amber-400">Rp</span>
                      </div>
                      <input
                        type="text"
                        value={hargaPromoFormatted}
                        onChange={handleHargaPromoChange}
                        placeholder="0"
                        className={cn(
                          'h-14 w-full rounded-xl pl-20 pr-20 text-base font-semibold text-slate-100',
                          'border-2 border-slate-800 bg-slate-900/50',
                          'focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20',
                          'transition-all duration-300 placeholder:text-slate-600',
                        )}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
                        {primaryOption.suffix}
                      </span>
                    </div>

                    <AnimatePresence>
                      {promoHemat > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          className="mt-2 flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5"
                        >
                          <span className="flex items-center gap-1.5 text-xs text-slate-400">
                            <TrendingDown className="h-3.5 w-3.5 text-amber-400" />
                            Penyewa hemat
                          </span>
                          <span className="text-sm font-bold text-amber-300">
                            {formatCurrency(promoHemat)}
                            <span className="ml-1.5 text-[11px] font-semibold text-amber-400/80">
                              ({promoPersen.toFixed(0)}%)
                            </span>
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </FormField>
                ) : null}
              </div>

              {/* Biaya di luar harga sewa & deposit. Ditaruh menempel dengan
                  harga karena inilah yang membuat angka harga jadi tidak utuh:
                  penyewa yang membaca "Rp 1,2 jt/bulan" lalu ditagih listrik &
                  wifi terpisah merasa dikelabui. Sekali diisi di sini, halaman
                  detail bisa menampilkan estimasi bayaran pertama. */}
              <div className="mt-6 border-t border-white/10 pt-6">
                <FormField
                  label="Biaya Tambahan"
                  description="Yang ditagih terpisah dari harga sewa — listrik, air, wifi, IPL, kebersihan"
                >
                  <BiayaTambahanBuilder
                    value={biayaTambahan}
                    onChange={setBiayaTambahan}
                    hargaUtama={primaryPrice}
                  />
                </FormField>
              </div>
            </Bagian>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --------------------------------------------------------------------------
// Struktur kamar kos — satu harga untuk semua kamar, atau harga per tipe.
//
// Dua kartu pilihan (bukan checkbox "kos saya punya beberapa tipe kamar")
// karena keduanya jalur yang sama sahnya: mayoritas kos kecil memang seragam,
// dan pilihan itu harus terasa lengkap — bukan mode lanjutan yang tersembunyi.
// Tiap kartu menyebut konsekuensinya, jadi agent memilih sekali dan tidak
// perlu mencoba dua-duanya untuk tahu bedanya.
// --------------------------------------------------------------------------
function StrukturKamarSwitch({
  adaTipe,
  onPilihSeragam,
  onPilihMultiTipe,
}: {
  adaTipe: boolean;
  onPilihSeragam: () => void;
  onPilihMultiTipe: () => void;
}) {
  const opsi = [
    {
      aktif: !adaTipe,
      pilih: onPilihSeragam,
      icon: <Bed className="h-4 w-4" />,
      judul: 'Semua kamar sama',
      desc: 'Satu ukuran, satu jenis kamar mandi, satu harga untuk seluruh kos.',
    },
    {
      aktif: adaTipe,
      pilih: onPilihMultiTipe,
      icon: <Layers className="h-4 w-4" />,
      judul: 'Ada beberapa tipe kamar',
      desc: 'Mis. 8 kamar mandi luar + 2 kamar mandi dalam yang lebih luas & mahal.',
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {opsi.map((o) => (
        <button
          key={o.judul}
          type="button"
          aria-pressed={o.aktif}
          onClick={o.pilih}
          className={cn(
            'group relative flex flex-col gap-2 overflow-hidden rounded-2xl border-2 p-5 text-left transition-all',
            o.aktif
              ? 'border-emerald-400/70 bg-emerald-400/[0.12] shadow-[0_0_0_1px_rgba(52,211,153,0.15),0_8px_30px_-12px_rgba(16,185,129,0.5)]'
              : 'border-white/[0.10] bg-white/[0.03] hover:border-emerald-400/40 hover:bg-white/[0.06]',
          )}
        >
          {o.aktif && (
            <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-400/20 blur-2xl" />
          )}
          <span className="relative flex items-center gap-2">
            <span
              className={cn(
                'grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-colors',
                o.aktif
                  ? 'border-emerald-400/40 bg-emerald-400/20 text-emerald-200'
                  : 'border-white/[0.10] bg-black/30 text-slate-300 group-hover:text-white',
              )}
            >
              {o.icon}
            </span>
            <span
              className={cn(
                'text-base font-bold',
                o.aktif ? 'text-emerald-200' : 'text-white',
              )}
            >
              {o.judul}
            </span>
            {o.aktif && (
              <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-emerald-300" />
            )}
          </span>
          <span className="relative text-xs leading-relaxed text-slate-400">
            {o.desc}
          </span>
        </button>
      ))}
    </div>
  );
}

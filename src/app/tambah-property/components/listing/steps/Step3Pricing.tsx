'use client';

import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step3Props {
  form: UseFormReturn<ListingFormData>;
}

// Helper: Format number with thousand separator
const formatThousand = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  const raw = typeof value === 'number' ? value.toString() : value;
  const numbers = raw.replace(/\D/g, '');
  if (!numbers) return '';
  return parseInt(numbers, 10).toLocaleString('id-ID');
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

export function Step3Pricing({ form }: Step3Props) {
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
    if (!isLelang) {
      setHargaFormatted(formatThousand(harga));
    }
  }, [harga, isLelang]);

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
        ) : (
          /* ========== NON-LELANG MODE ========== */
          <motion.div
            key="non-lelang"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-6"
          >
            {/* Harga Utama */}
            <FormField
              label={isSewa ? 'Harga Sewa' : 'Harga Jual'}
              required
              error={errors.harga?.message}
              description={isSewa ? 'Harga sewa property per tahun' : 'Harga jual property'}
            >
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
                <div className="relative flex items-center">
                  <div className="absolute left-4 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-400 font-bold text-sm">Rp</span>
                  </div>
                  <input
                    type="text"
                    value={hargaFormatted}
                    onChange={handleHargaChange}
                    placeholder="2.500.000.000"
                    className={cn(
                      'w-full h-14 pl-20 rounded-xl text-base font-semibold text-slate-100',
                      isSewa ? 'pr-28' : 'pr-12',
                      'bg-slate-900/50 border-2 border-slate-800',
                      'focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
                      'transition-all duration-300',
                      'placeholder:text-slate-600',
                    )}
                  />
                  {isSewa && harga && harga > 0 && (
                    <div className="absolute right-12 text-slate-400 text-sm font-semibold">
                      / tahun
                    </div>
                  )}
                  {harga && harga > 0 && (
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
                      {isSewa ? 'Harga Sewa' : 'Harga Jual'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-black text-emerald-400">
                      {formatCurrency(Number(harga))}
                    </p>
                    {isSewa && (
                      <span className="text-lg text-slate-500 font-semibold">/ tahun</span>
                    )}
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
                  <div className="absolute left-4 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    <span className="text-amber-400 font-bold text-sm">Rp</span>
                  </div>
                  <input
                    type="text"
                    value={hargaPromoFormatted}
                    onChange={handleHargaPromoChange}
                    placeholder="2.350.000.000"
                    className={cn(
                      'w-full h-14 pl-20 rounded-xl text-base font-semibold text-slate-100',
                      isSewa ? 'pr-28' : 'pr-12',
                      'bg-slate-900/50 border-2 border-slate-800',
                      'focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20',
                      'transition-all duration-300',
                      'placeholder:text-slate-600',
                    )}
                  />
                  {isSewa && hasPromo && (
                    <div className="absolute right-12 text-slate-400 text-sm font-semibold">
                      / tahun
                    </div>
                  )}
                  {hasPromo && (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="absolute right-4"
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

      {/* Success Indicator */}
      {((isLelang && nilaiLimit && nilaiLimit > 0 && uangJaminan && uangJaminan > 0) ||
        (!isLelang && harga && harga > 0)) && (
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

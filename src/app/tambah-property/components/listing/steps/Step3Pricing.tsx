'use client';

import React, { useEffect, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { ListingFormData } from '@/lib/validations/listing';
import { FormField } from '../FormField';
import { Input } from '@/components/ui/input';
import { RadioGroup } from '../RadioGroup';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { TrendingUp, TrendingDown, Percent } from 'lucide-react';

interface Step3Props {
  form: UseFormReturn<ListingFormData>;
}

export function Step3Pricing({ form }: Step3Props) {
  const { watch, setValue, formState: { errors } } = form;
  const harga = watch('harga');
  const hargaPromo = watch('harga_promo');
  const [discount, setDiscount] = useState<number>(0);
  const [savings, setSavings] = useState<number>(0);

  // Calculate discount
  useEffect(() => {
    if (harga && hargaPromo && hargaPromo < harga) {
      const save = harga - hargaPromo;
      const disc = (save / harga) * 100;
      setSavings(save);
      setDiscount(disc);
    } else {
      setSavings(0);
      setDiscount(0);
    }
  }, [harga, hargaPromo]);

  const statusOptions = [
    { value: 'TERSEDIA', label: 'Tersedia', icon: '✅' },
    { value: 'TERJUAL', label: 'Terjual', icon: '🔒' },
    { value: 'TARIK_LISTING', label: 'Tarik Listing', icon: '📤' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-100 mb-2">
          Harga & Partner
        </h2>
        <p className="text-slate-400">
          Tentukan harga yang kompetitif untuk menarik pembeli
        </p>
      </div>

      {/* Harga Utama */}
      <FormField
        label="Harga Utama (Rp)"
        required
        error={errors.harga?.message}
        hint="Masukkan harga tanpa titik atau koma"
      >
        <div className="relative">
          <Input
            type="number"
            {...form.register('harga', { valueAsNumber: true })}
            placeholder="2500000000"
            className="pl-12"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
            Rp
          </span>
        </div>
      </FormField>

      {/* Price Display */}
      {harga && harga > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-xl"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-indigo-400" />
            <span className="text-sm text-slate-400">Harga Display</span>
          </div>
          <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
            {formatCurrency(harga)}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {formatNumber(harga)}
          </p>
        </motion.div>
      )}

      {/* Harga Promo */}
      <FormField
        label="Harga Promo (Opsional)"
        error={errors.harga_promo?.message}
        hint="Berikan harga spesial untuk menarik lebih banyak buyer"
      >
        <div className="relative">
          <Input
            type="number"
            {...form.register('harga_promo', { valueAsNumber: true })}
            placeholder="2350000000"
            className="pl-12"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
            Rp
          </span>
        </div>
      </FormField>

      {/* Discount Calculator */}
      <AnimatePresence>
        {savings > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-green-400" />
                <span className="text-sm font-medium text-green-400">
                  Hemat untuk Pembeli
                </span>
              </div>
              <div className="flex items-center gap-1 px-3 py-1 bg-green-500/20 rounded-full">
                <Percent className="h-4 w-4 text-green-400" />
                <span className="text-sm font-bold text-green-400">
                  {discount.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300 text-sm">Harga Normal</span>
              <span className="text-slate-400 line-through">
                {formatCurrency(harga)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300 text-sm font-medium">Harga Promo</span>
              <span className="text-green-400 text-lg font-bold">
                {formatCurrency(hargaPromo || 0)}
              </span>
            </div>
            <div className="pt-3 border-t border-green-500/30">
              <div className="flex items-center justify-between">
                <span className="text-green-400 text-sm font-semibold">
                  Total Penghematan
                </span>
                <span className="text-green-400 text-xl font-bold">
                  {formatCurrency(savings)}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vendor */}
      <FormField
        label="Vendor / Developer"
        error={errors.vendor?.message}
        hint="Nama perusahaan atau developer yang mengembangkan property"
      >
        <Input
          {...form.register('vendor')}
          placeholder="Contoh: PT Ciputra Development"
        />
      </FormField>

      {/* Link Referensi */}
      <FormField
        label="Link Referensi"
        error={errors.link?.message}
        hint="Link website developer atau marketplace lain (opsional)"
      >
        <Input
          {...form.register('link')}
          placeholder="https://developer.com/property/abc"
          type="url"
        />
      </FormField>

      {/* Status Tayang */}
      <FormField
        label="Status Tayang"
        required
        error={errors.status_tayang?.message}
      >
        <RadioGroup
          options={statusOptions}
          value={watch('status_tayang') || 'TERSEDIA'}
          onChange={(value) => setValue('status_tayang', value as any)}
          name="status_tayang"
        />
      </FormField>

      {/* Info Tips */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg"
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <h4 className="text-sm font-semibold text-amber-400 mb-1">
              Tips Pricing Strategy
            </h4>
            <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
              <li>Riset harga kompetitor di area yang sama</li>
              <li>Harga promo bisa meningkatkan inquiry hingga 40%</li>
              <li>Pertimbangkan nilai tanah, bangunan, dan lokasi strategis</li>
            </ul>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

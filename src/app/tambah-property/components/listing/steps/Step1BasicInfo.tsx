'use client';

import React, { useEffect, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { ListingFormData } from '@/lib/validations/listing';
import { FormField } from '../FormField';
import { Input } from '@/components/ui/input';
import { RadioGroup } from '../RadioGroup';
import { motion, AnimatePresence } from 'framer-motion';
import { JENIS_TRANSAKSI_OPTIONS, KATEGORI_OPTIONS } from '@/app/tambah-property/types/listing';
import { Calendar, TrendingUp, Eye, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step1Props {
  form: UseFormReturn<ListingFormData>;
}

// Helper: Generate slug from title only (no kota)
const generateSlugFromTitle = (title: string): string => {
  if (!title) return '';
  
  return title
    .toLowerCase()
    .trim()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80)
    .replace(/-+$/, '');
};

export function Step1BasicInfo({ form }: Step1Props) {
  const { watch, setValue, formState: { errors } } = form;
  const jenisTransaksi = watch('jenis_transaksi');
  const judul = watch('judul');
  const tanggalLelang = watch('tanggal_lelang');
  
  const [titleScore, setTitleScore] = useState(0);
  const [titleTips, setTitleTips] = useState<string[]>([]);
  
  // ✅ Local state untuk datetime-local input (format: "YYYY-MM-DDTHH:MM")
  const [dateTimeValue, setDateTimeValue] = useState('');
  
  // ✅ Auto-generate slug from judul only
  useEffect(() => {
    if (judul) {
      const slug = generateSlugFromTitle(judul);
      setValue('slug', slug);
    }
  }, [judul, setValue]);

  // ✅ Initialize datetime input dari form value (saat load atau kembali ke step 1)
  useEffect(() => {
    if (tanggalLelang) {
      const date = tanggalLelang instanceof Date ? tanggalLelang : new Date(tanggalLelang);
      if (!isNaN(date.getTime())) {
        // Convert to local datetime string format
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const formatted = `${year}-${month}-${day}T${hours}:${minutes}`;
        setDateTimeValue(formatted);
      }
    }
  }, [tanggalLelang]);

  // ✅ Handle datetime change
  const handleDateTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDateTimeValue(value);
    
    if (value) {
      const date = new Date(value);
      setValue('tanggal_lelang', date);
    } else {
      setValue('tanggal_lelang', undefined as any);
    }
  };

  // Calculate title SEO score
  useEffect(() => {
    if (judul) {
      let score = 0;
      const tips: string[] = [];
      
      if (judul.length >= 40 && judul.length <= 70) {
        score += 25;
      } else if (judul.length < 40) {
        tips.push('Tambahkan detail lokasi atau fitur khusus (min. 40 karakter)');
      } else {
        tips.push('Persingkat judul agar lebih mudah dibaca (max. 70 karakter)');
      }
      
      const locationKeywords = ['jakarta', 'surabaya', 'bandung', 'bali', 'medan', 'semarang', 'yogyakarta', 'malang', 'solo', 'denpasar'];
      if (locationKeywords.some(loc => judul.toLowerCase().includes(loc))) {
        score += 25;
      } else {
        tips.push('Tambahkan nama kota untuk SEO lokal yang lebih baik');
      }
      
      const propertyTypes = ['rumah', 'apartemen', 'ruko', 'villa', 'tanah', 'gudang', 'pabrik', 'toko', 'hotel'];
      if (propertyTypes.some(type => judul.toLowerCase().includes(type))) {
        score += 25;
      } else {
        tips.push('Sertakan jenis properti (rumah/apartemen/dll)');
      }
      
      const attractiveWords = ['mewah', 'strategis', 'modern', 'premium', 'eksklusif', 'view', 'minimalis', 'luas', 'nyaman', 'siap huni'];
      if (attractiveWords.some(word => judul.toLowerCase().includes(word))) {
        score += 25;
      } else {
        tips.push('Gunakan kata menarik: mewah, strategis, modern, premium, dll');
      }
      
      setTitleScore(score);
      setTitleTips(tips);
    } else {
      setTitleScore(0);
      setTitleTips([]);
    }
  }, [judul]);

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'from-green-500 to-emerald-500';
    if (score >= 50) return 'from-amber-500 to-orange-500';
    return 'from-red-500 to-rose-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 75) return 'Excellent';
    if (score >= 50) return 'Good';
    if (score >= 25) return 'Fair';
    return 'Needs Work';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Judul with SEO Score */}
      <div className="space-y-4">
        <FormField
          label="Judul Listing"
          required
          error={errors.judul?.message}
          description="Judul yang SEO-friendly akan membantu property Anda lebih mudah ditemukan di Google"
          icon={<TrendingUp className="h-3 w-3 text-emerald-400" />}
        >
          <Input
            {...form.register('judul')}
            placeholder="Contoh: Rumah Mewah 3 Kamar Modern Strategis di Surabaya Timur"
            maxLength={100}
          />
        </FormField>

        {/* SEO Score Card */}
        <AnimatePresence>
          {judul && judul.length >= 10 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 rounded-xl bg-slate-900/50 backdrop-blur-sm border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
                      <Eye className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-200">SEO Score</h4>
                      <p className="text-xs text-slate-500">Search Engine Optimization</p>
                    </div>
                  </div>
                  
                  <motion.div
                    key={titleScore}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-2"
                  >
                    <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${getScoreColor(titleScore)} bg-opacity-20 border border-current`}>
                      <span className={`text-xs font-bold bg-gradient-to-r ${getScoreColor(titleScore)} bg-clip-text text-transparent`}>
                        {getScoreLabel(titleScore)}
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-slate-200">{titleScore}%</span>
                  </motion.div>
                </div>

                <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden mb-4">
                  <motion.div
                    className={`h-full bg-gradient-to-r ${getScoreColor(titleScore)}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${titleScore}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  />
                </div>

                {titleTips.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Eye className="h-3 w-3" />
                      Suggestions to Improve
                    </p>
                    {titleTips.map((tip, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start gap-2 text-xs text-slate-400 p-2 rounded-lg bg-slate-800/50 border border-slate-700/50"
                      >
                        <span className="text-amber-400 mt-0.5">💡</span>
                        <span className="flex-1">{tip}</span>
                      </motion.div>
                    ))}
                  </div>
                )}

                {titleScore === 100 && (
                  <motion.div
                    initial={{ scale: 0, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="flex items-center gap-2 p-3 mt-3 rounded-lg bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30"
                  >
                    <Award className="h-5 w-5 text-green-400" />
                    <p className="text-sm font-semibold text-green-300">
                      Perfect! Judul Anda sudah optimal untuk SEO 🎉
                    </p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Jenis Transaksi */}
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

      {/* Kategori Property */}
      <FormField
        label="Kategori Property"
        required
        error={errors.kategori?.message}
        description="Tentukan jenis property yang akan Anda jual atau sewakan"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {KATEGORI_OPTIONS.map((option) => {
            const isSelected = watch('kategori') === option.value;
            
            return (
              <motion.button
                key={option.value}
                type="button"
                onClick={() => setValue('kategori', option.value)}
                className={cn(
                  "relative p-4 rounded-xl border-2 transition-all duration-300 group overflow-hidden",
                  isSelected 
                    ? 'border-emerald-500/60 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent shadow-lg shadow-emerald-500/10' 
                    : 'border-slate-800 bg-slate-900/30 hover:border-emerald-500/30 hover:bg-slate-900/50'
                )}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                {isSelected && (
                  <motion.div
                    className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-xl blur-lg -z-10"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  />
                )}

                <motion.div 
                  className="text-4xl mb-2"
                  animate={isSelected ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  {option.icon}
                </motion.div>

                <div className={cn(
                  "text-xs font-semibold transition-colors",
                  isSelected ? 'text-slate-100' : 'text-slate-400 group-hover:text-slate-300'
                )}>
                  {option.label}
                </div>

                {isSelected && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="absolute top-2 right-2 w-5 h-5 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center"
                  >
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                )}

                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              </motion.button>
            );
          })}
        </div>
      </FormField>

      {/* Conditional: Lelang Date Picker */}
      <AnimatePresence>
        {jenisTransaksi === 'LELANG' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="relative p-6 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border-2 border-amber-500/30 rounded-2xl backdrop-blur-sm overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl"></div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
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

                {/* ✅ Date Picker with persisted value */}
                <FormField
                  label="Tanggal & Waktu Lelang"
                  required
                  error={errors.tanggal_lelang?.message}
                  hint="Pilih tanggal dan waktu pelaksanaan lelang"
                  icon={<Calendar className="h-3 w-3 text-amber-400" />}
                >
                  <div className="relative group">
                    <input
                      type="datetime-local"
                      value={dateTimeValue}
                      onChange={handleDateTimeChange}
                      min={new Date().toISOString().slice(0, 16)}
                      className="w-full h-12 px-4 pr-12 rounded-xl bg-slate-900/50 border-2 border-slate-800 focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-100 transition-all duration-300"
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-amber-400 pointer-events-none group-focus-within:scale-110 transition-transform" />
                  </div>
                </FormField>

                {/* Date Preview */}
                {tanggalLelang && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20"
                  >
                    <p className="text-xs text-amber-400 font-semibold mb-1">Preview Jadwal:</p>
                    <p className="text-sm text-slate-200">
                      {new Date(tanggalLelang).toLocaleDateString('id-ID', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })} WIB
                    </p>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

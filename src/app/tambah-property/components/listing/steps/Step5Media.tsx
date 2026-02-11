'use client';

import React, { useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { ListingFormData } from '@/lib/validations/listing';
import { FormField } from '../FormField';
import { Textarea } from '@/components/ui/textarea';
import { ImageUploader } from '../ImageUploader';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ImageIcon,
  Sparkles,
  Wand2,
  Zap,
  TrendingUp,
  Star,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageFile {
  id: string;
  file: File;
  preview: string;
}

interface Step5Props {
  form: UseFormReturn<ListingFormData>;
  images: ImageFile[];
  onImagesChange: (images: ImageFile[]) => void;
}

export function Step5Media({ form, images, onImagesChange }: Step5Props) {
  const { watch, setValue, formState: { errors } } = form;
  const [isGenerating, setIsGenerating] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const deskripsi = watch('deskripsi') || '';
  const judulProperty = watch('judul') || '';
  const tipeProperty = watch('tipe_property') || '';
  const kategori = watch('kategori') || '';
  const jenisTransaksi = watch('jenis_transaksi') || '';
  const luasTanah = watch('luas_tanah');
  const luasBangunan = watch('luas_bangunan');
  const jumlahLantai = watch('jumlah_lantai');
  const kamarTidur = watch('kamar_tidur');
  const kamarMandi = watch('kamar_mandi');
  const dayaListrik = watch('daya_listrik');
  const sumberAir = watch('sumber_air');
  const hadapBangunan = watch('hadap_bangunan');
  const kondisiInterior = watch('kondisi_interior');
  const legalitas = watch('legalitas');
  const nomorLegalitas = watch('nomor_legalitas');
  const harga = watch('harga');
  const alamat = watch('alamat');

  // Calculate completion status
  const hasEnoughImages = images.length >= 3;
  const hasGoodDescription = deskripsi.length >= 100;
  const hasTitle = judulProperty.length > 0;
  const completionScore = [hasEnoughImages, hasGoodDescription, hasTitle].filter(Boolean).length;

  // Format harga untuk template
  const formatHarga = (harga?: number) => {
    if (!harga) return '';
    if (harga >= 1000000000) {
      return `${(harga / 1000000000).toFixed(1)} Miliar`;
    } else if (harga >= 1000000) {
      return `${(harga / 1000000).toFixed(0)} Juta`;
    }
    return harga.toLocaleString('id-ID');
  };

  // Get action text based on jenis_transaksi
  const getActionText = () => {
    if (jenisTransaksi === 'SEWA') return 'DISEWAKAN';
    if (jenisTransaksi === 'LELANG') return 'DILELANG';
    // PRIMARY atau SECONDARY
    return 'DIJUAL';
  };

  // Get current month and year
  const getCurrentMonthYear = () => {
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const now = new Date();
    return `${months[now.getMonth()]} ${now.getFullYear()}`;
  };

  // AI Description Templates REAL - hanya berdasarkan data input
  const generateSmartDescription = (template: 'professional' | 'detailed' | 'concise' | 'family') => {
    setIsGenerating(true);
    
    setTimeout(() => {
      let description = '';
      const actionText = getActionText();
      const isLelang = jenisTransaksi === 'LELANG';
      
      // Build specs array
      const specs = [];
      if (luasTanah) specs.push(`Luas Tanah: ${luasTanah} m²`);
      if (luasBangunan) specs.push(`Luas Bangunan: ${luasBangunan} m²`);
      if (jumlahLantai) specs.push(`${jumlahLantai} Lantai`);
      if (kamarTidur) specs.push(`${kamarTidur} Kamar Tidur`);
      if (kamarMandi) specs.push(`${kamarMandi} Kamar Mandi`);
      if (dayaListrik) specs.push(`Listrik ${dayaListrik} VA`);
      if (sumberAir) specs.push(`Sumber Air: ${sumberAir}`);
      if (hadapBangunan) specs.push(`Menghadap: ${hadapBangunan}`);
      if (kondisiInterior) specs.push(`Kondisi: ${kondisiInterior}`);
      if (legalitas) specs.push(`Sertifikat: ${legalitas}`);

      // TEMPLATE KHUSUS LELANG
      if (isLelang) {
        switch (template) {
          case 'professional':
            description = `🔨 SEGERA ${actionText.toUpperCase()}, ${getCurrentMonthYear()} 🔨

📍 ${tipeProperty || 'Property'} ${legalitas || 'Bersertifikat'}${alamat ? ` di ${alamat}` : ''}

SPESIFIKASI:
${specs.map(s => `• ${s}`).join('\n')}

${legalitas && nomorLegalitas ? `LEGALITAS:\n• Sertifikat ${legalitas}\n• No. ${nomorLegalitas}\n\n` : ''}${harga ? `💰 Harga Lelang: Rp ${formatHarga(harga)}\n\n` : ''}🎯 Kenapa Beli Lelang Lebih Menarik?

✓ Harga jauh di bawah pasar → lebih murah dibanding property primary & second
✓ Potensi capital gain tinggi → bisa dijual kembali sesuai harga pasar
✓ Cara paling aman untuk beli property
✓ Pilihan tepat untuk investasi cerdas

Hubungi kami untuk informasi lengkap & proses lelang!`;
            break;

          case 'detailed':
            description = `🔨 ${actionText.toUpperCase()} - ${tipeProperty || 'Property'} ${getCurrentMonthYear()} 🔨

📍 LOKASI:
${alamat || 'Lokasi strategis'}

📋 DETAIL PROPERTY:

Dimensi & Struktur:
${luasTanah ? `- Luas Tanah: ${luasTanah} m²` : ''}
${luasBangunan ? `- Luas Bangunan: ${luasBangunan} m²` : ''}
${jumlahLantai ? `- Jumlah Lantai: ${jumlahLantai}` : ''}

Fasilitas:
${kamarTidur !== undefined && kamarTidur !== null ? `- Kamar Tidur: ${kamarTidur}` : ''}
${kamarMandi !== undefined && kamarMandi !== null ? `- Kamar Mandi: ${kamarMandi}` : ''}
${dayaListrik ? `- Daya Listrik: ${dayaListrik} VA` : ''}
${sumberAir ? `- Sumber Air: ${sumberAir}` : ''}

${hadapBangunan ? `Orientasi: ${hadapBangunan}\n` : ''}${kondisiInterior ? `Kondisi: ${kondisiInterior}\n` : ''}
${legalitas ? `📜 LEGALITAS:\n- Tipe Hak: ${legalitas}${nomorLegalitas ? `\n- Nomor: ${nomorLegalitas}` : ''}\n` : ''}
${harga ? `💰 HARGA LELANG: Rp ${formatHarga(harga)}\n` : ''}
🎯 KEUNGGULAN LELANG:

✅ Harga Di Bawah Pasar
Dapatkan property dengan harga jauh lebih murah dibanding harga market. Hemat hingga 20-30% dari harga normal!

✅ Potensi Untung Besar
Beli dengan harga lelang, jual dengan harga pasar. Capital gain yang menguntungkan untuk investasi Anda.

✅ Proses Legal & Aman
Semua dokumen dijamin legal dan proses lelang diawasi resmi. Investasi property paling aman!

✅ Cocok untuk Investasi
Baik untuk hunian maupun investasi jangka panjang dengan ROI yang menarik.

Hubungi sekarang untuk detail lengkap dan panduan proses lelang!`;
            break;

          case 'concise':
            description = `🔨 ${actionText} ${tipeProperty || 'Property'} - ${getCurrentMonthYear()}

📍 ${alamat || 'Lokasi strategis'}

SPESIFIKASI:
${specs.slice(0, 6).map(s => `✓ ${s}`).join('\n')}
${legalitas ? `✓ ${legalitas}` : ''}

${harga ? `💰 Harga Lelang: Rp ${formatHarga(harga)}\n` : ''}
🎯 KENAPA LELANG?
✓ Harga di bawah pasar
✓ Legal & aman
✓ Potensi profit tinggi
✓ Investasi cerdas

Info lengkap hubungi kami!`;
            break;

          case 'family':
            description = `🔨 ${tipeProperty || 'Property'} ${actionText} - ${getCurrentMonthYear()} 🔨

${alamat ? `📍 Berlokasi di ${alamat}\n` : ''}
SPESIFIKASI PROPERTY:
${specs.map(s => `• ${s}`).join('\n')}

${legalitas ? `Dilengkapi dengan sertifikat ${legalitas} yang legal dan aman.\n` : ''}
${harga ? `💰 Harga Lelang: Rp ${formatHarga(harga)}\n` : ''}
🏡 COCOK UNTUK KELUARGA
${kamarTidur && kamarTidur >= 3 ? `Dengan ${kamarTidur} kamar tidur, property ini ideal untuk keluarga dengan ruang yang cukup untuk seluruh anggota keluarga.\n` : ''}
🎯 MENGAPA BELI LEWAT LELANG?

Beli property lewat lelang adalah cara paling cerdas untuk mendapatkan hunian impian dengan harga terjangkau!

✅ Harga Lebih Murah
Dapatkan property dengan harga jauh di bawah pasaran. Hemat budget untuk renovasi atau kebutuhan lainnya.

✅ Legal & Terpercaya
Proses lelang dijamin legal dan aman. Semua dokumen lengkap dan sah secara hukum.

✅ Investasi Menguntungkan
Beli dengan harga lelang, nilai property tetap sesuai harga pasar. Keuntungan langsung untuk keluarga Anda!

Hubungi kami untuk informasi detail dan panduan lengkap proses lelang!`;
            break;
        }
      } 
      // TEMPLATE NORMAL (NON-LELANG)
      else {
        switch (template) {
          case 'professional':
            description = `${actionText} - ${tipeProperty || 'Property'}

SPESIFIKASI:
${specs.map(s => `• ${s}`).join('\n')}

${legalitas && nomorLegalitas ? `LEGALITAS:\n• Sertifikat ${legalitas}\n• No. ${nomorLegalitas}\n\n` : ''}${harga ? `HARGA: Rp ${formatHarga(harga)}\n\n` : ''}Informasi lebih lanjut hubungi kami.`;
            break;

          case 'detailed':
            description = `${actionText} ${tipeProperty || 'Property'}${harga ? ` - Rp ${formatHarga(harga)}` : ''}

DETAIL PROPERTY:

Dimensi & Struktur:
${luasTanah ? `- Luas Tanah: ${luasTanah} m²` : ''}
${luasBangunan ? `- Luas Bangunan: ${luasBangunan} m²` : ''}
${jumlahLantai ? `- Jumlah Lantai: ${jumlahLantai}` : ''}

Fasilitas:
${kamarTidur !== undefined && kamarTidur !== null ? `- Kamar Tidur: ${kamarTidur}` : ''}
${kamarMandi !== undefined && kamarMandi !== null ? `- Kamar Mandi: ${kamarMandi}` : ''}
${dayaListrik ? `- Daya Listrik: ${dayaListrik} VA` : ''}
${sumberAir ? `- Sumber Air: ${sumberAir}` : ''}

${hadapBangunan ? `Orientasi Bangunan: ${hadapBangunan}\n` : ''}${kondisiInterior ? `Kondisi Interior: ${kondisiInterior}\n` : ''}
${legalitas ? `LEGALITAS:\n- Sertifikat: ${legalitas}${nomorLegalitas ? `\n- Nomor: ${nomorLegalitas}` : ''}\n` : ''}
Untuk informasi lebih detail dan jadwal survey, silakan hubungi kami.`;
            break;

          case 'concise':
            description = `${actionText} ${tipeProperty || 'Property'}

${specs.slice(0, 6).map(s => `✓ ${s}`).join('\n')}
${legalitas ? `✓ ${legalitas}` : ''}

${harga ? `💰 Harga: Rp ${formatHarga(harga)}` : ''}

Hubungi untuk info lengkap.`;
            break;

          case 'family':
            description = `${tipeProperty || 'Property'} ${actionText}${harga ? ` - Rp ${formatHarga(harga)}` : ''}

Property ini menawarkan:
${specs.map(s => `• ${s}`).join('\n')}

${kondisiInterior ? `Interior dalam kondisi ${kondisiInterior.toLowerCase()}, ` : ''}${legalitas ? `dengan sertifikat ${legalitas} yang lengkap dan legal` : 'dengan legalitas yang jelas'}.

${kamarTidur && kamarTidur >= 3 ? 'Cocok untuk keluarga dengan ruang yang cukup untuk seluruh anggota keluarga.' : ''}

Silakan hubungi untuk informasi lebih lanjut dan jadwal kunjungan.`;
            break;
        }
      }

      setValue('deskripsi', description.trim());
      setIsGenerating(false);
      setShowTemplates(false);
    }, 1500);
  };

  const templates = [
    {
      id: 'professional',
      name: 'Professional',
      icon: '🎯',
      color: 'emerald',
      description: 'Format bisnis, to the point, jelas',
    },
    {
      id: 'detailed',
      name: 'Detailed',
      icon: '📋',
      color: 'blue',
      description: 'Lengkap dengan kategorisasi rapi',
    },
    {
      id: 'concise',
      name: 'Concise',
      icon: '⚡',
      color: 'orange',
      description: 'Singkat, padat, mudah dibaca',
    },
    {
      id: 'family',
      name: 'Family Friendly',
      icon: '🏡',
      color: 'purple',
      description: 'Hangat, untuk target keluarga',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Image Upload Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/50">
            <ImageIcon className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-100">Upload Foto Property</h3>
            <p className="text-xs text-slate-500">Foto pertama = thumbnail utama listing</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/30">
            <LayoutGrid className="h-3 w-3 text-purple-400" />
            <span className="text-xs font-bold text-purple-400">{images.length}/10</span>
          </div>
        </div>

        <ImageUploader value={images} onChange={onImagesChange} maxFiles={10} />

        {errors.gambar && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
          >
            <AlertCircle className="h-4 w-4 text-red-400" />
            <p className="text-red-400 text-sm">{errors.gambar.message}</p>
          </motion.div>
        )}

        {/* Photo Quality Tips */}
        <div className="grid md:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 to-black border border-purple-500/20 p-5"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">✨</span>
                <h4 className="text-sm font-bold text-purple-400">Tips Foto Pro</h4>
              </div>
              <ul className="text-xs text-slate-400 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 mt-0.5">•</span>
                  <span>Pencahayaan alami pagi/sore = hasil terbaik</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 mt-0.5">•</span>
                  <span>Sudut lebar (wide angle) untuk ruangan</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 mt-0.5">•</span>
                  <span>Pastikan ruangan rapi & bersih</span>
                </li>
              </ul>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 to-black border border-pink-500/20 p-5"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">📸</span>
                <h4 className="text-sm font-bold text-pink-400">Area Wajib</h4>
              </div>
              <ul className="text-xs text-slate-400 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-pink-400 mt-0.5">•</span>
                  <span>Tampak depan & samping bangunan</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pink-400 mt-0.5">•</span>
                  <span>Ruang tamu, kamar tidur utama, dapur</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pink-400 mt-0.5">•</span>
                  <span>Kamar mandi, taman/halaman (jika ada)</span>
                </li>
              </ul>
            </div>
          </motion.div>
        </div>
      </div>

      {/* AI Description Generator */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/50">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-100">Deskripsi Property</h3>
            <p className="text-xs text-slate-500">Buat deskripsi otomatis dari data yang sudah diisi</p>
          </div>
        </div>

        {/* AI Template Selector */}
        <AnimatePresence mode="wait">
          {!showTemplates ? (
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              type="button"
              onClick={() => setShowTemplates(true)}
              className="w-full relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 p-6 group hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-center justify-center gap-3">
                <Wand2 className="h-6 w-6 text-white animate-pulse" />
                <div className="text-left">
                  <p className="text-white font-bold text-lg">Generate Deskripsi Otomatis</p>
                  <p className="text-indigo-200 text-sm">Pilih format template sesuai kebutuhan</p>
                </div>
                <Sparkles className="h-5 w-5 text-yellow-300 animate-spin" />
              </div>
            </motion.button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-300">Pilih Format Template:</p>
                <button
                  type="button"
                  onClick={() => setShowTemplates(false)}
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  Tutup
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {templates.map((template, index) => (
                  <motion.button
                    key={template.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    type="button"
                    onClick={() => generateSmartDescription(template.id as any)}
                    disabled={isGenerating}
                    className={cn(
                      'relative overflow-hidden rounded-xl p-5 text-left transition-all duration-300 group',
                      'bg-slate-900/50 border-2 border-slate-800',
                      'hover:border-' + template.color + '-500/50 hover:bg-slate-900',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    <div className={cn(
                      'absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity',
                      'bg-' + template.color + '-500/20'
                    )} />
                    
                    <div className="relative">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={cn(
                          'w-12 h-12 rounded-xl flex items-center justify-center text-2xl',
                          'bg-' + template.color + '-500/20 border border-' + template.color + '-500/30',
                          'group-hover:scale-110 transition-transform'
                        )}>
                          {template.icon}
                        </div>
                        <div className="flex-1">
                          <h4 className={cn(
                            'text-base font-bold',
                            'text-' + template.color + '-400'
                          )}>
                            {template.name}
                          </h4>
                          <p className="text-xs text-slate-500">{template.description}</p>
                        </div>
                        {isGenerating && (
                          <Zap className="h-5 w-5 text-yellow-400 animate-pulse" />
                        )}
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>

              {isGenerating && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center gap-3 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg"
                >
                  <Sparkles className="h-5 w-5 text-purple-400 animate-spin" />
                  <p className="text-sm text-purple-400 font-medium">
                    Generating deskripsi dari data property...
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Textarea Deskripsi */}
        <FormField
          label="Deskripsi Lengkap"
          error={errors.deskripsi?.message}
        >
          <div className="relative">
            <Textarea
              {...form.register('deskripsi')}
              placeholder="Tulis deskripsi property atau gunakan Generator di atas untuk template otomatis berdasarkan data yang sudah diisi..."
              rows={12}
              className={cn(
                'resize-none',
                'bg-slate-900/50 border-2 border-slate-800',
                'focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20',
                'text-slate-100 placeholder:text-slate-600',
                'rounded-xl p-4'
              )}
            />
            
            {/* Character Counter Floating */}
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <div className={cn(
                'px-3 py-1 rounded-full text-xs font-semibold',
                deskripsi.length >= 100
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-800/80 text-slate-400 border border-slate-700'
              )}>
                {deskripsi.length} / 100+
              </div>
              {deskripsi.length >= 100 && (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              )}
            </div>
          </div>
        </FormField>

        {/* Quick Tips saat belum ada deskripsi */}
        {deskripsi.length < 50 && !showTemplates && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg"
          >
            <Sparkles className="h-5 w-5 text-amber-400 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-400 mb-1">
                Gunakan Generator untuk deskripsi instan!
              </p>
              <p className="text-xs text-slate-400">
                Template otomatis menggunakan semua data property yang sudah Anda isi.
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Hot Deal Toggle */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-lg shadow-red-500/50">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">Opsi Promosi Premium</h3>
            <p className="text-xs text-slate-500">Tingkatkan visibility listing Anda</p>
          </div>
        </div>

        <label className="relative overflow-hidden flex items-center justify-between p-5 bg-gradient-to-r from-slate-900 to-slate-800 border-2 border-slate-700 hover:border-red-500/50 rounded-xl cursor-pointer transition-all duration-300 group">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="text-3xl animate-pulse">🔥</span>
            </div>
            <div>
              <p className="text-base font-bold text-slate-100 mb-1">
                Hot Deal Badge
              </p>
              <p className="text-xs text-slate-400">
                Tampil di homepage + badge eksklusif + prioritas pencarian
              </p>
            </div>
          </div>

          <div className="relative">
            <input
              type="checkbox"
              {...form.register('is_hot_deal')}
              className="w-6 h-6 rounded-lg border-2 border-slate-600 text-red-500 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-900 cursor-pointer"
            />
          </div>
        </label>

        <AnimatePresence>
          {watch('is_hot_deal') && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="relative overflow-hidden rounded-xl bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 p-5"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-red-500/20 rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-5 w-5 text-red-400" />
                  <p className="text-sm font-bold text-red-400">Hot Deal Activated! 🎉</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                  <div className="flex items-start gap-2">
                    <span className="text-red-400">✓</span>
                    <span>Priority di homepage</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-red-400">✓</span>
                    <span>Badge eksklusif 🔥</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-red-400">✓</span>
                    <span>Top di hasil pencarian</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-red-400">✓</span>
                    <span>3x lebih banyak views</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Final Checklist */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 to-black border border-emerald-500/20 p-6"
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />
        
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h4 className="text-base font-bold text-emerald-400">Quality Checklist</h4>
              <p className="text-xs text-slate-500">Pastikan listing Anda maksimal</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="flex items-center gap-3">
                {hasEnoughImages ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-600" />
                )}
                <span className="text-sm text-slate-300">Minimal 3 foto berkualitas</span>
              </div>
              <span className="text-xs font-semibold text-slate-400">{images.length}/3</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="flex items-center gap-3">
                {hasGoodDescription ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-600" />
                )}
                <span className="text-sm text-slate-300">Deskripsi lengkap & menarik</span>
              </div>
              <span className="text-xs font-semibold text-slate-400">{deskripsi.length}/100</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="flex items-center gap-3">
                {hasTitle ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-600" />
                )}
                <span className="text-sm text-slate-300">Judul property jelas</span>
              </div>
              {hasTitle && <span className="text-xs font-semibold text-emerald-400">Ready</span>}
            </div>
          </div>

          {completionScore === 3 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg"
            >
              <Star className="h-5 w-5 text-emerald-400" />
              <p className="text-sm font-semibold text-emerald-400">
                Perfect! Listing Anda siap untuk go live 🚀
              </p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

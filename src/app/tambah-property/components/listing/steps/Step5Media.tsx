'use client';

import React, { useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { ListingFormData } from '@/lib/validations/listing';
import { FormField } from '../FormField';
import { Textarea } from '@/components/ui/textarea';
import { ImageUploader } from '../ImageUploader';
import { motion } from 'framer-motion';
import { ImageIcon, FileText, Sparkles, Upload } from 'lucide-react';

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
  const [lampiran, setLampiran] = useState<File | null>(null);

  const handleLampiranUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setLampiran(file);
      // In real implementation, upload to server and get URL
      setValue('lampiran', file.name);
    } else {
      alert('Hanya file PDF yang diperbolehkan');
    }
  };

  const aiSuggestions = [
    'Rumah strategis dekat dengan pusat kota dan akses tol',
    'Lingkungan aman dengan keamanan 24 jam',
    'Dekat dengan sekolah, rumah sakit, dan pusat perbelanjaan',
    'Akses transportasi mudah dengan berbagai pilihan',
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
          Media & Deskripsi
        </h2>
        <p className="text-slate-400">
          Foto berkualitas dan deskripsi menarik adalah kunci kesuksesan listing
        </p>
      </div>

      {/* Image Upload Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-indigo-400" />
            <h3 className="text-lg font-semibold text-slate-100">
              Upload Gambar Property
            </h3>
          </div>
          <span className="text-sm text-slate-400">
            {images.length}/10 foto
          </span>
        </div>

        <ImageUploader
          value={images}
          onChange={onImagesChange}
          maxFiles={10}
        />

        {errors.gambar && (
          <p className="text-red-400 text-sm flex items-center gap-2">
            <span>⚠️</span>
            <span>{errors.gambar.message}</span>
          </p>
        )}

        {/* Tips for Photos */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-lg"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">📸</span>
            <div>
              <h4 className="text-sm font-semibold text-indigo-400 mb-2">
                Tips Foto Berkualitas
              </h4>
              <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                <li>Foto pertama akan menjadi thumbnail utama</li>
                <li>Gunakan pencahayaan alami untuk hasil terbaik</li>
                <li>Ambil foto dari berbagai sudut (ruang tamu, kamar, dapur, dll)</li>
                <li>Pastikan ruangan terlihat rapi dan bersih</li>
                <li>Resolusi minimal 1280x720px untuk kualitas optimal</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Document Upload Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-400" />
          <h3 className="text-lg font-semibold text-slate-100">
            Lampiran Dokumen (Opsional)
          </h3>
        </div>

        <div className="relative">
          <input
            type="file"
            id="lampiran"
            accept=".pdf"
            onChange={handleLampiranUpload}
            className="sr-only"
          />
          <label
            htmlFor="lampiran"
            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-700 rounded-lg cursor-pointer bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
          >
            <Upload className="h-8 w-8 text-slate-400 mb-2" />
            <p className="text-sm text-slate-300">
              {lampiran ? lampiran.name : 'Upload Dokumen PDF'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              IMB, Sertifikat, atau dokumen pendukung lainnya
            </p>
          </label>
        </div>

        {lampiran && (
          <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm text-slate-200 font-medium">{lampiran.name}</p>
                <p className="text-xs text-slate-400">
                  {(lampiran.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setLampiran(null);
                setValue('lampiran', '');
              }}
              className="text-red-400 hover:text-red-300 text-sm"
            >
              Hapus
            </button>
          </div>
        )}
      </div>

      {/* Description Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-400" />
            <h3 className="text-lg font-semibold text-slate-100">
              Deskripsi Property
            </h3>
          </div>
          <button
            type="button"
            className="flex items-center gap-2 px-3 py-1.5 bg-purple-600/20 border border-purple-500/30 rounded-lg text-purple-400 text-xs font-medium hover:bg-purple-600/30 transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            <span>AI Assist</span>
          </button>
        </div>

        <FormField
          label="Deskripsi Lengkap"
          error={errors.deskripsi?.message}
          hint="Jelaskan keunggulan property, fasilitas sekitar, dan alasan mengapa property ini menarik"
        >
          <Textarea
            {...form.register('deskripsi')}
            placeholder="Contoh: Rumah mewah 2 lantai dengan desain modern minimalis. Terletak di lokasi strategis dengan akses mudah ke berbagai fasilitas umum..."
            rows={8}
            className="resize-none"
          />
        </FormField>

        {/* Character Counter */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">
            {watch('deskripsi')?.length || 0} karakter
          </span>
          <span className="text-slate-500">
            Minimal 50 karakter untuk deskripsi yang baik
          </span>
        </div>

        {/* AI Suggestions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-2"
        >
          <p className="text-sm text-slate-400 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-400" />
            <span>Saran AI untuk deskripsi Anda:</span>
          </p>
          <div className="space-y-2">
            {aiSuggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  const currentDesc = watch('deskripsi') || '';
                  setValue('deskripsi', currentDesc + (currentDesc ? '\n\n' : '') + suggestion);
                }}
                className="w-full text-left p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-purple-500/50 rounded-lg text-sm text-slate-300 transition-all group"
              >
                <span className="text-purple-400 group-hover:text-purple-300 mr-2">+</span>
                {suggestion}
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Hot Deal Toggle */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔥</span>
          <h3 className="text-lg font-semibold text-slate-100">
            Opsi Promosi
          </h3>
        </div>

        <label className="flex items-center justify-between p-4 bg-slate-800/50 border-2 border-slate-700 hover:border-red-500/50 rounded-lg cursor-pointer transition-all group">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center group-hover:bg-red-500/30 transition-colors">
              <span className="text-2xl">🔥</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">
                Tandai sebagai Hot Deal
              </p>
              <p className="text-xs text-slate-400">
                Property akan ditampilkan di section Hot Deal dengan badge khusus
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            {...form.register('is_hot_deal')}
            className="w-5 h-5 rounded border-slate-600 text-red-500 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          />
        </label>

        {watch('is_hot_deal') && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg"
          >
            <div className="flex items-center gap-2 text-red-400 text-sm font-medium mb-2">
              <span>🎯</span>
              <span>Property akan dipromosikan sebagai Hot Deal!</span>
            </div>
            <p className="text-xs text-slate-300">
              Hot Deal mendapat prioritas tampilan dan badge khusus yang menarik perhatian buyer.
              Listing ini akan muncul di halaman utama dan mendapat exposure maksimal.
            </p>
          </motion.div>
        )}
      </div>

      {/* Final Tips */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg"
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl">✨</span>
          <div>
            <h4 className="text-sm font-semibold text-green-400 mb-2">
              Checklist Sebelum Publish
            </h4>
            <ul className="text-xs text-slate-300 space-y-1.5">
              <li className="flex items-center gap-2">
                <span className={images.length > 0 ? "text-green-400" : "text-slate-500"}>
                  {images.length > 0 ? "✓" : "○"}
                </span>
                <span>Minimal 3 foto berkualitas tinggi</span>
              </li>
              <li className="flex items-center gap-2">
                <span className={(watch('deskripsi')?.length || 0) >= 50 ? "text-green-400" : "text-slate-500"}>
                  {(watch('deskripsi')?.length || 0) >= 50 ? "✓" : "○"}
                </span>
                <span>Deskripsi minimal 50 karakter</span>
              </li>
              <li className="flex items-center gap-2">
                <span className={watch('judul') ? "text-green-400" : "text-slate-500"}>
                  {watch('judul') ? "✓" : "○"}
                </span>
                <span>Judul yang menarik dan deskriptif</span>
              </li>
            </ul>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

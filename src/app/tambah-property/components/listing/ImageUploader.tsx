'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Image as ImageIconLucide } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface ImageFile {
  id: string;
  file?: File | null;        // ⬅️ dibuat optional
  preview: string;
  // kalau dari backend kamu punya field lain (url, title, dsb) bisa tambahkan di sini
}

interface ImageUploaderProps {
  value: ImageFile[];
  onChange: (files: ImageFile[]) => void;
  maxFiles?: number;
}

export function ImageUploader({ value = [], onChange, maxFiles = 10 }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles: ImageFile[] = acceptedFiles
        .slice(0, maxFiles - value.length)
        .map((file) => ({
          id: Math.random().toString(36).substring(7),
          file,
          preview: URL.createObjectURL(file),
        }));

      onChange([...value, ...newFiles]);
      setIsDragging(false);
    },
    [value, onChange, maxFiles]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
    },
    maxFiles: maxFiles - value.length,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    disabled: value.length >= maxFiles,
  });

  const removeImage = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();

    const imageToRemove = value.find((img) => img.id === id);
    if (imageToRemove?.preview && imageToRemove.preview.startsWith('blob:')) {
      // hanya revoke preview lokal (hasil URL.createObjectURL)
      URL.revokeObjectURL(imageToRemove.preview);
    }

    onChange(value.filter((img) => img.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      {value.length < maxFiles && (
        <div
          {...getRootProps()}
          className={cn(
            'relative overflow-hidden border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300',
            isDragging
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-slate-700 bg-slate-900/50 hover:border-purple-500/50 hover:bg-slate-900'
          )}
        >
          <input {...getInputProps()} />
          <motion.div
            animate={isDragging ? { scale: 1.05 } : { scale: 1 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
              <Upload className="h-8 w-8 text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200 mb-1">
                {isDragging ? 'Drop foto di sini' : 'Upload Foto Property'}
              </p>
              <p className="text-xs text-slate-500">
                Drag & drop atau click untuk browse • Max {maxFiles} foto
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span>JPG</span>
              <span>•</span>
              <span>PNG</span>
              <span>•</span>
              <span>WEBP</span>
              <span>•</span>
              <span>Max 5MB</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* Preview Grid */}
      {value.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <AnimatePresence>
              {value.map((img, index) => {
                const hasFile = !!img.file;

                return (
                  <motion.div
                    key={img.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="relative aspect-square rounded-xl overflow-hidden bg-slate-900 border-2 border-slate-800 group"
                  >
                    <Image
                      src={img.preview}
                      alt={`Preview ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />

                    {/* Overlay gradient - hanya desktop */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 md:group-hover:opacity-100 transition-opacity" />

                    {/* Badge urutan - selalu tampil */}
                    <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/70 backdrop-blur-sm border border-white/20 z-10">
                      <span className="text-xs font-bold text-white">
                        #{index + 1}
                      </span>
                    </div>

                    {/* Thumbnail badge untuk foto pertama */}
                    {index === 0 && (
                      <div className="absolute bottom-2 left-2 right-2 px-2 py-1 rounded-lg bg-purple-500/90 backdrop-blur-sm border border-purple-400/30 z-10">
                        <span className="text-xs font-bold text-white text-center block">
                          📌 Thumbnail Utama
                        </span>
                      </div>
                    )}

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={(e) => removeImage(e, img.id)}
                      className={cn(
                        'absolute top-2 right-2 z-20',
                        'w-8 h-8 rounded-lg',
                        'bg-red-500 hover:bg-red-600 active:bg-red-700',
                        'flex items-center justify-center',
                        'transition-all duration-200',
                        'shadow-lg shadow-red-500/50',
                        'border-2 border-white/20',
                        // Desktop: tampil saat hover
                        'md:opacity-0 md:group-hover:opacity-100 md:scale-0 md:group-hover:scale-100',
                        // Mobile/Tablet: selalu tampil
                        'opacity-100 scale-100'
                      )}
                      aria-label="Hapus foto"
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>

                    {/* Info overlay - hanya di desktop saat hover */}
                    <div className="hidden md:block absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <p className="text-xs text-white font-medium truncate">
                        {hasFile ? img.file!.name : 'Foto terupload'}
                      </p>
                      <p className="text-xs text-slate-300">
                        {hasFile
                          ? `${(img.file!.size / 1024 / 1024).toFixed(2)} MB`
                          : ''}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Info footer */}
          <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-800">
            <div className="flex items-center gap-2">
              <ImageIconLucide className="h-4 w-4 text-purple-400" />
              <span className="text-sm text-slate-300">
                {value.length} foto terupload
              </span>
            </div>
            <span className="text-xs text-slate-500">
              {maxFiles - value.length} slot tersisa
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

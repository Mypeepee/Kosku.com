'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface ImageFile {
  id: string;
  file: File;
  preview: string;
}

interface ImageUploaderProps {
  value: ImageFile[];
  onChange: (files: ImageFile[]) => void;
  maxFiles?: number;
}

export function ImageUploader({ value = [], onChange, maxFiles = 10 }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.slice(0, maxFiles - value.length).map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      preview: URL.createObjectURL(file)
    }));
    
    onChange([...value, ...newFiles]);
    setIsDragging(false);
  }, [value, onChange, maxFiles]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: maxFiles - value.length,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
  });

  const removeImage = (id: string) => {
    onChange(value.filter(img => img.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-300",
          {
            'border-indigo-500 bg-indigo-500/10': isDragging,
            'border-slate-700 bg-slate-800/30 hover:border-slate-600': !isDragging,
          }
        )}
      >
        <input {...getInputProps()} />
        <motion.div
          animate={isDragging ? { scale: 1.05 } : { scale: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center">
            <Upload className="h-8 w-8 text-slate-400" />
          </div>
          <div>
            <p className="text-slate-200 font-medium">
              Drag & Drop atau Klik untuk Upload
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Format: JPG, PNG, WebP • Max 5MB per foto • Max {maxFiles} foto
            </p>
          </div>
        </motion.div>
      </div>

      {/* Preview Grid */}
      {value.length > 0 && (
        <div className="grid grid-cols-5 gap-4">
          <AnimatePresence>
            {value.map((img, index) => (
              <motion.div
                key={img.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="relative aspect-square rounded-lg overflow-hidden bg-slate-800 group"
              >
                <Image
                  src={img.preview}
                  alt={`Preview ${index + 1}`}
                  fill
                  className="object-cover"
                />
                
                {/* Thumbnail Badge */}
                {index === 0 && (
                  <div className="absolute top-2 left-2 bg-indigo-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                    📌 Utama
                  </div>
                )}
                
                {/* Remove Button */}
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

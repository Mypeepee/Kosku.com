'use client';

import React, { useState } from 'react';
import { ListingFormData } from '@/lib/validations/listing';
import { formatCurrency } from '@/lib/utils';
import { Icon } from '@iconify/react';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface ImageFile {
  id: string;
  file: File | null;
  preview: string;
}

interface LivePreviewProps {
  data: Partial<ListingFormData>;
  images: ImageFile[];
}

// Helper: format date untuk lelang
const formatDateShort = (date?: Date | null) => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

// Helper: hitung hari sampai lelang
const daysUntil = (date?: Date | null) => {
  if (!date) return null;
  const target = new Date(date);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days;
};

// Helper: Get property icon
const getPropertyIcon = (kategori?: string): string => {
  const ICONS: Record<string, string> = {
    'RUMAH': 'solar:home-2-bold-duotone',
    'APARTEMEN': 'solar:buildings-2-bold-duotone',
    'GUDANG': 'solar:box-minimalistic-bold-duotone',
    'TANAH': 'solar:map-point-wave-bold-duotone',
    'PABRIK': 'solar:garage-bold-duotone',
    'RUKO': 'solar:shop-2-bold-duotone',
    'TOKO': 'solar:shop-bold-duotone',
    'HOTEL': 'solar:bed-bold-duotone',
    'VILLA': 'solar:star-fall-bold-duotone',
  };
  return ICONS[kategori?.toUpperCase() || ''] || 'solar:home-2-bold-duotone';
};

export function LivePreview({ data, images }: LivePreviewProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  const isLelang = data.jenis_transaksi === 'LELANG';
  const isPrimarySecondary = data.jenis_transaksi === 'PRIMARY' || data.jenis_transaksi === 'SECONDARY';
  
  const days = daysUntil(data.tanggal_lelang);

  // Navigate images
  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Badge untuk lelang
  const renderLelangBadge = () => {
    if (days === null) return null;

    if (days <= 0) {
      return (
        <div className="absolute top-4 right-4 z-10">
          <span className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.14em] text-amber-50">
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 opacity-80 blur-[3px]" />
            <span className="absolute inset-[1px] rounded-full bg-gradient-to-r from-[#18181b] via-[#030712] to-[#111827] border border-amber-300/80 shadow-[0_0_22px_rgba(250,204,21,0.75)]" />
            <span className="relative inline-flex items-center gap-1.5 px-1">
              <Icon icon="solar:cup-star-bold-duotone" className="text-sm text-amber-200" />
              <span className="text-[10px] tracking-[0.24em]">PELUANG EMAS</span>
            </span>
          </span>
        </div>
      );
    } else if (days > 20) {
      return (
        <div className="absolute top-4 right-4 z-10">
          <span className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-50">
            {/* ✅ REVISED: Hijau gradient */}
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 opacity-70 blur-[3px]" />
            <span className="absolute inset-[1px] rounded-full bg-gradient-to-r from-[#020617] via-[#020617] to-[#022c22] border border-emerald-300/70 shadow-[0_0_18px_rgba(52,211,153,0.7)]" />
            <span className="relative inline-flex items-center gap-1.5 px-1">
              <Icon icon="solar:eye-bold-duotone" className="text-sm text-emerald-200" />
              <span className="text-[10px] tracking-[0.22em]">JANGAN LEWATKAN</span>
            </span>
          </span>
        </div>
      );
    } else if (days > 10 && days <= 20) {
      return (
        <div className="absolute top-4 right-4 z-10">
          <span className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.12em] text-white">
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 opacity-80 blur-[2px]" />
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 animate-pulse opacity-70" />
            <span className="relative inline-flex items-center gap-1.5 px-1">
              <Icon icon="solar:fire-bold-duotone" className="text-sm text-yellow-100" />
              {days} hari lagi
            </span>
          </span>
        </div>
      );
    } else if (days > 0 && days <= 10) {
      return (
        <div className="absolute top-4 right-4 z-10">
          <span className="relative inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.16em] text-white">
            <span className="absolute inset-0 rounded-full bg-[conic-gradient(at_top,_#22c55e,_#f97316,_#ef4444,_#22c55e)] opacity-90 blur-[3px]" />
            <span className="absolute inset-[1px] rounded-full bg-gradient-to-r from-black/80 via-black/70 to-black/80 border border-red-400/80 shadow-[0_0_26px_rgba(248,113,113,0.8)]" />
            <span className="relative inline-flex items-center gap-1.5 px-1">
              <Icon icon="solar:fire-bold-duotone" className="text-sm text-yellow-100" />
              <span className="flex items-center gap-1 text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                {days} hari lagi
              </span>
            </span>
          </span>
        </div>
      );
    }
    return null;
  };

  // ✅ REVISED: Badge color - HIJAU THEME
  const getBadgeColor = (type?: string) => {
    if (type === 'PRIMARY') return 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300';
    if (type === 'SECONDARY') return 'bg-teal-500/20 border-teal-400/60 text-teal-300';
    return 'bg-gray-500/20 border-gray-400/60 text-gray-300';
  };

  return (
    <div className="bg-[#050608] border border-white/10 rounded-3xl overflow-hidden shadow-[0_18px_60px_rgba(0,0,0,0.9)]">
      {/* ✅ REVISED: Header - EMERALD GRADIENT */}
      <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-600">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Icon icon="solar:eye-bold-duotone" className="text-lg" />
          <span>Live Preview</span>
        </h3>
      </div>

      {/* Image Section */}
      <div className="relative h-60 md:h-64 w-full overflow-hidden">
        {images.length > 0 ? (
          <>
            <div className="relative w-full h-full">
              <Image
                key={images[currentImageIndex].id}
                src={images[currentImageIndex].preview}
                alt={data.judul || 'Preview'}
                fill
                className="object-cover transition-opacity duration-200"
              />
            </div>

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-70" />

            {/* Navigation buttons */}
            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/70 hover:bg-emerald-500 hover:text-black text-white rounded-full flex items-center justify-center z-20 transition-all"
                >
                  <Icon icon="solar:alt-arrow-left-linear" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/70 hover:bg-emerald-500 hover:text-black text-white rounded-full flex items-center justify-center z-20 transition-all"
                >
                  <Icon icon="solar:alt-arrow-right-linear" />
                </button>

                {/* Dots indicator */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 z-20">
                  {images.map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        idx === currentImageIndex ? 'bg-emerald-400 w-3' : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Badge kiri: kategori */}
            <div className="absolute top-4 left-4 z-10">
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-black/80 text-emerald-300 text-[11px] font-semibold border border-emerald-400/40 backdrop-blur-sm">
                <Icon icon={getPropertyIcon(data.kategori)} className="text-base" />
                {data.kategori || 'KATEGORI'}
              </span>
            </div>

            {/* Badge kanan: conditional based on jenis_transaksi */}
            {isLelang ? (
              renderLelangBadge()
            ) : isPrimarySecondary ? (
              <div className="absolute top-4 right-4 z-10">
                <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold border backdrop-blur-sm ${getBadgeColor(data.jenis_transaksi)}`}>
                  <Icon icon="solar:star-bold-duotone" className="text-xs" />
                  {data.jenis_transaksi}
                </span>
              </div>
            ) : null}

          </>
        ) : (
          <div className="w-full h-full bg-slate-800 flex items-center justify-center">
            <div className="text-center">
              <Icon icon="solar:camera-add-bold-duotone" className="text-5xl text-slate-600 mx-auto mb-2" />
              <span className="text-slate-500 text-sm">Belum ada gambar</span>
            </div>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-5 bg-gradient-to-b from-slate-900/80 via-slate-950/90 to-black">
        {/* Harga */}
        <div className="mb-2">
          <h3 className="text-white text-xl font-extrabold tracking-tight">
            {data.harga ? formatCurrency(Number(data.harga)) : 'Rp -'}
          </h3>
          {data.harga_promo && (
            <p className="text-sm text-slate-400 line-through">
              {formatCurrency(Number(data.harga_promo))}
            </p>
          )}
        </div>

        {/* Judul */}
        <h4 className="text-gray-200 text-lg font-bold line-clamp-2 mb-2">
          {data.judul || 'Judul Property'}
        </h4>

        {/* Lokasi */}
        <div className="flex items-start gap-2 mb-4">
          <Icon icon="solar:map-point-wave-bold" className="text-emerald-400 text-lg shrink-0 mt-0.5" />
          <span className="text-gray-400 font-medium text-sm line-clamp-2">
            {data.alamat_lengkap || data.kota || 'Lokasi belum diisi'}
          </span>
        </div>

        {/* Conditional Content: Lelang vs Primary/Secondary */}
        {isLelang ? (
          /* LELANG: Box Info Lelang */
          <div className="bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-950/90 rounded-2xl p-3 mb-5 border border-slate-700 shadow-[0_12px_35px_rgba(0,0,0,0.8)]">
            <div className="flex justify-between items-center px-1">
              <div className="flex items-center gap-2">
                <Icon icon="solar:ruler-angular-bold" className="text-gray-400" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 uppercase">Luas Tanah</span>
                  <span className="text-white text-xs font-bold">
                    {data.luas_tanah ? `${data.luas_tanah}m²` : '-'}
                  </span>
                </div>
              </div>

              <div className="w-[1px] h-8 bg-white/10" />

              <div className="flex items-center gap-2">
                <Icon icon="solar:calendar-date-bold" className="text-red-400" />
                <div className="flex flex-col items-start">
                  <span className="flex items-center gap-1 text-[10px] text-gray-500 uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Lelang
                  </span>
                  <span className="text-white text-xs font-bold">
                    {formatDateShort(data.tanggal_lelang)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* PRIMARY/SECONDARY: Specs Grid */
          <div className="bg-white/5 rounded-xl p-3 mb-4 border border-white/5">
            <div className="grid grid-cols-4 divide-x divide-white/10 text-center">
              <div>
                <span className="text-[9px] text-gray-500 block mb-1">KT</span>
                <span className="text-white text-xs font-bold flex justify-center items-center gap-1">
                  <Icon icon="solar:bed-bold" className="text-xs text-gray-400" />
                  {data.kamar_tidur || '-'}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-gray-500 block mb-1">KM</span>
                <span className="text-white text-xs font-bold flex justify-center items-center gap-1">
                  <Icon icon="solar:bath-bold" className="text-xs text-gray-400" />
                  {data.kamar_mandi || '-'}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-gray-500 block mb-1">LT</span>
                <span className="text-white text-xs font-bold">
                  {data.luas_tanah || '-'}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-gray-500 block mb-1">LB</span>
                <span className="text-white text-xs font-bold">
                  {data.luas_bangunan || '-'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Hot Deal Badge (Optional) */}
        {data.is_hot_deal && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center gap-1 px-3 py-1 bg-red-500/20 border border-red-500 rounded-full text-red-400 text-xs font-medium mb-4"
          >
            <Icon icon="solar:fire-bold-duotone" className="text-sm" />
            <span>Hot Deal</span>
          </motion.div>
        )}

        {/* Footer: Agent Info (Placeholder) */}
        <div className="mt-auto pt-3 border-t border-dashed border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative w-8 h-8 rounded-full overflow-hidden border border-white/20 bg-slate-800">
              <Icon icon="solar:user-bold" className="text-slate-600 text-xl absolute inset-0 m-auto" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-200 leading-tight">
                {data.vendor || 'Agent Name'}
              </span>
              <span className="text-[9px] text-gray-500 leading-tight">
                Premier Asset
              </span>
            </div>
          </div>
          <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
            Preview <Icon icon="solar:eye-linear" />
          </span>
        </div>
      </div>
    </div>
  );
}

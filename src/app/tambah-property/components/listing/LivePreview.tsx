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
    RUMAH: 'solar:home-2-bold-duotone',
    APARTEMEN: 'solar:buildings-2-bold-duotone',
    GUDANG: 'solar:box-minimalistic-bold-duotone',
    TANAH: 'solar:map-point-wave-bold-duotone',
    PABRIK: 'solar:garage-bold-duotone',
    RUKO: 'solar:shop-2-bold-duotone',
    TOKO: 'solar:shop-bold-duotone',
    HOTEL_DAN_VILLA: 'solar:bed-bold-duotone',
  };
  return ICONS[kategori?.toUpperCase() || ''] || 'solar:home-2-bold-duotone';
};

// Helper: Get display address based on privacy mode
const getDisplayAddress = (data: Partial<ListingFormData>) => {
  const isPrivacyMode =
    data.jenis_transaksi === 'SECONDARY' || data.jenis_transaksi === 'SEWA';

  if (isPrivacyMode) {
    const parts = [
      data.kelurahan,
      data.kecamatan,
      data.kota,
      data.provinsi,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : 'Lokasi belum diisi';
  }

  return data.alamat_lengkap || data.kota || 'Lokasi belum diisi';
};

// Helper: aman convert ke number (string -> number)
const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
};

export function LivePreview({ data, images }: LivePreviewProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const isLelang = data.jenis_transaksi === 'LELANG';
  const isPrimary = data.jenis_transaksi === 'PRIMARY';
  const isSecondary = data.jenis_transaksi === 'SECONDARY';
  const isSewa = data.jenis_transaksi === 'SEWA';
  const isPrivacyMode = isSecondary || isSewa;

  const days = daysUntil(data.tanggal_lelang);

  // Normalisasi nilai numeric dari form/API (string/number)
  const nilaiLimit = toNumber(data.nilai_limit_lelang);
  const hargaPromo = toNumber(data.harga_promo);
  const hargaNormal = toNumber(data.harga);
  const hasPromo = hargaPromo !== null && hargaPromo > 0;

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
              <Icon
                icon="solar:cup-star-bold-duotone"
                className="text-sm text-amber-200"
              />
              <span className="text-[10px] tracking-[0.24em]">PELUANG EMAS</span>
            </span>
          </span>
        </div>
      );
    } else if (days > 20) {
      return (
        <div className="absolute top-4 right-4 z-10">
          <span className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-50">
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 opacity-70 blur-[3px]" />
            <span className="absolute inset-[1px] rounded-full bg-gradient-to-r from-[#020617] via-[#020617] to-[#022c22] border border-emerald-300/70 shadow-[0_0_18px_rgba(52,211,153,0.7)]" />
            <span className="relative inline-flex items-center gap-1.5 px-1">
              <Icon
                icon="solar:eye-bold-duotone"
                className="text-sm text-emerald-200"
              />
              <span className="text-[10px] tracking-[0.22em]">
                JANGAN LEWATKAN
              </span>
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
              <Icon
                icon="solar:fire-bold-duotone"
                className="text-sm text-yellow-100"
              />
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
              <Icon
                icon="solar:fire-bold-duotone"
                className="text-sm text-yellow-100"
              />
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

  // Badge untuk jenis transaksi
  const renderTransaksiBadge = () => {
    if (isPrimary) {
      return (
        <div className="absolute top-4 right-4 z-10">
          <span className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold border backdrop-blur-xl bg-emerald-500/20 border-emerald-400/60 text-emerald-300">
            <Icon icon="solar:star-bold-duotone" className="text-xs" />
            <span>PRIMARY</span>
          </span>
        </div>
      );
    }

    if (isSecondary) {
      return (
        <div className="absolute top-4 right-4 z-10">
          <span className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold border backdrop-blur-xl bg-teal-500/20 border-teal-400/60 text-teal-300">
            <Icon icon="solar:home-smile-bold-duotone" className="text-xs" />
            <span>SECONDARY</span>
          </span>
        </div>
      );
    }

    if (isSewa) {
      return (
        <div className="absolute top-4 right-4 z-10">
          <span className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold border backdrop-blur-xl bg-blue-500/20 border-blue-400/60 text-blue-300">
            <Icon icon="solar:key-bold-duotone" className="text-xs" />
            <span>SEWA</span>
          </span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="bg-[#050608] border border-white/10 rounded-3xl overflow-hidden shadow-[0_18px_60px_rgba(0,0,0,0.9)] transition-all duration-300 hover:shadow-[0_20px_70px_rgba(16,185,129,0.15)]">
      {/* Header */}
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

            {/* Navigation buttons */}
            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/60 hover:bg-emerald-500 hover:text-black text-white rounded-full flex items-center justify-center z-20 transition-all backdrop-blur-sm"
                >
                  <Icon
                    icon="solar:alt-arrow-left-bold"
                    className="text-lg"
                  />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/60 hover:bg-emerald-500 hover:text-black text-white rounded-full flex items-center justify-center z-20 transition-all backdrop-blur-sm"
                >
                  <Icon
                    icon="solar:alt-arrow-right-bold"
                    className="text-lg"
                  />
                </button>

                {/* Dots indicator */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`transition-all rounded-full ${
                        idx === currentImageIndex
                          ? 'bg-emerald-400 w-6 h-2'
                          : 'bg-white/50 hover:bg-white/80 w-2 h-2'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Badge kiri: kategori */}
            <div className="absolute top-4 left-4 z-10">
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-black/70 backdrop-blur-md text-emerald-300 text-[11px] font-semibold border border-emerald-400/40 shadow-lg">
                <Icon
                  icon={getPropertyIcon(data.kategori)}
                  className="text-base"
                />
                <span className="tracking-wide">
                  {data.kategori || 'KATEGORI'}
                </span>
              </span>
            </div>

            {/* Badge kanan */}
            {isLelang ? renderLelangBadge() : renderTransaksiBadge()}
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center">
            <div className="text-center">
              <Icon
                icon="solar:camera-add-bold-duotone"
                className="text-6xl text-slate-700 mx-auto mb-3"
              />
              <span className="text-slate-500 text-sm font-medium">
                Belum ada gambar
              </span>
              <p className="text-slate-600 text-xs mt-1">
                Upload foto property di Step 5
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-5 bg-gradient-to-b from-slate-900/90 via-slate-950/95 to-black">
        {/* Harga */}
        <div className="mb-3">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block mb-1">
            {isLelang
              ? 'Nilai Limit Lelang'
              : isSewa
              ? 'Harga Sewa'
              : 'Harga'}
          </span>

          {isLelang ? (
            // ✅ Mode LELANG: tampilkan nilai_limit_lelang
            <div className="flex items-baseline gap-2">
              <h3 className="text-white text-2xl font-extrabold tracking-tight">
                {nilaiLimit !== null && nilaiLimit > 0
                  ? formatCurrency(nilaiLimit)
                  : 'Rp -'}
              </h3>
            </div>
          ) : hasPromo ? (
            // PRIMARY / SECONDARY / SEWA dengan promo
            <>
              <div className="flex items-baseline gap-2">
                <h3 className="text-white text-2xl font-extrabold tracking-tight">
                  {formatCurrency(hargaPromo!)}
                </h3>
                {isSewa && (
                  <span className="text-sm text-slate-400 font-medium">
                    /tahun
                  </span>
                )}
              </div>
              {hargaNormal !== null && hargaNormal > 0 && (
                <p className="text-sm text-slate-500 line-through mt-1">
                  {formatCurrency(hargaNormal)}
                </p>
              )}
            </>
          ) : (
            // PRIMARY / SECONDARY / SEWA tanpa promo
            <div className="flex items-baseline gap-2">
              <h3 className="text-white text-2xl font-extrabold tracking-tight">
                {hargaNormal !== null && hargaNormal > 0
                  ? formatCurrency(hargaNormal)
                  : 'Rp -'}
              </h3>
              {isSewa && (
                <span className="text-sm text-slate-400 font-medium">
                  /tahun
                </span>
              )}
            </div>
          )}
        </div>

        {/* Judul */}
        <h4 className="text-gray-200 text-lg font-bold line-clamp-2 mb-3 leading-tight">
          {data.judul || 'Judul Property Akan Tampil Di Sini'}
        </h4>

        {/* Lokasi */}
        <div className="flex items-start gap-2 mb-4 group">
          <Icon
            icon={
              isPrivacyMode
                ? 'solar:map-point-bold'
                : 'solar:map-point-wave-bold'
            }
            className="text-emerald-400 text-lg shrink-0 mt-0.5 group-hover:scale-110 transition-transform"
          />
          <div className="flex-1">
            <span className="text-gray-400 font-medium text-sm line-clamp-2">
              {getDisplayAddress(data)}
            </span>
            {isPrivacyMode && data.kelurahan && (
              <div className="flex items-center gap-1 mt-1">
                <Icon
                  icon="solar:shield-check-bold-duotone"
                  className="text-[10px] text-amber-500"
                />
                <span className="text-[9px] text-amber-500/80 font-medium">
                  Alamat lengkap disembunyikan
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Conditional Content: Lelang vs lainnya */}
        {isLelang ? (
          /* ✅ Mode LELANG: Luas Tanah + Tanggal Lelang */
          <div className="bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-950/90 rounded-2xl p-4 mb-4 border border-slate-700/50 shadow-[0_12px_35px_rgba(0,0,0,0.8)]">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Icon
                    icon="solar:ruler-angular-bold-duotone"
                    className="text-emerald-400 text-xl"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                    Luas Tanah
                  </span>
                  <span className="text-white text-base font-bold">
                    {data.luas_tanah ? `${data.luas_tanah} m²` : '-'}
                  </span>
                </div>
              </div>

              <div className="w-[1px] h-10 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <Icon
                    icon="solar:calendar-date-bold-duotone"
                    className="text-red-400 text-xl"
                  />
                </div>
                <div className="flex flex-col items-start">
                  <span className="flex items-center gap-1 text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Lelang
                  </span>
                  <span className="text-white text-base font-bold">
                    {formatDateShort(data.tanggal_lelang as Date | null)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* PRIMARY / SECONDARY / SEWA: grid KT/KM/LT/LB */
          <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl p-4 mb-0 border border-white/10 shadow-inner">
            <div className="grid grid-cols-4 divide-x divide-white/10">
              <div className="px-2 text-center">
                <div className="flex items-center justify-center gap-1 mb-1.5">
                  <Icon
                    icon="solar:bed-bold-duotone"
                    className="text-sm text-emerald-400"
                  />
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                    KT
                  </span>
                </div>
                <span className="text-white text-base font-bold">
                  {data.kamar_tidur || '0'}
                </span>
              </div>

              <div className="px-2 text-center">
                <div className="flex items-center justify-center gap-1 mb-1.5">
                  <Icon
                    icon="solar:bath-bold-duotone"
                    className="text-sm text-blue-400"
                  />
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                    KM
                  </span>
                </div>
                <span className="text-white text-base font-bold">
                  {data.kamar_mandi || '0'}
                </span>
              </div>

              <div className="px-2 text-center">
                <div className="flex items-center justify-center gap-1 mb-1.5">
                  <Icon
                    icon="solar:map-bold-duotone"
                    className="text-sm text-teal-400"
                  />
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                    LT
                  </span>
                </div>
                <span className="text-white text-base font-bold">
                  {data.luas_tanah || '-'}
                </span>
              </div>

              <div className="px-2 text-center">
                <div className="flex items-center justify-center gap-1 mb-1.5">
                  <Icon
                    icon="solar:home-2-bold-duotone"
                    className="text-sm text-purple-400"
                  />
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                    LB
                  </span>
                </div>
                <span className="text-white text-base font-bold">
                  {data.luas_bangunan || '-'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Hot Deal Badge */}
        {data.is_hot_deal && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 10 }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/50 rounded-full text-red-400 text-xs font-bold mt-4"
          >
            <Icon
              icon="solar:fire-bold-duotone"
              className="text-sm animate-pulse"
            />
            <span>Hot Deal</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}

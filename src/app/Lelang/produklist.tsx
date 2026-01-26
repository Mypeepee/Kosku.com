"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";

interface PropertyDB {
  id_property: number | string;
  slug: string;
  judul: string;
  kota: string;
  alamat_lengkap: string;
  harga: number;
  jenis_transaksi: string;
  kategori: string;

  gambar: string;
  foto_list: string[];

  luas_tanah: number;
  luas_bangunan: number;
  kamar_tidur: number;
  kamar_mandi: number;
  agent_name: string;
  agent_photo: string;
  agent_office: string;
  tanggal_lelang?: string | null;
}

interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

interface ProductListProps {
  initialData: PropertyDB[];
  pagination: PaginationData;
}

// --- UTILS ---
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

const formatDateShort = (date?: string | null) => {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const daysUntil = (date?: string | null) => {
  if (!date) return null;
  const target = new Date(date);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days;
};

// --- URL DETAIL LELANG ---
const getPropertyUrl = (property: PropertyDB): string => {
  const baseSlug = property.slug || "property";
  const id = String(property.id_property);
  const slugWithId = `${baseSlug}-${id}`;
  return `/Lelang/${slugWithId}`;
};

// --- CARD LELANG ---
const PropertyCard = ({ item }: { item: PropertyDB }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const images =
    item.foto_list && item.foto_list.length > 0
      ? item.foto_list
      : [item.gambar || "/images/hero/banner.jpg"];

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const days = daysUntil(item.tanggal_lelang);

  let badgeContent: React.ReactNode | null = null;

  if (days !== null) {
    if (days <= 0) {
      badgeContent = (
        <div className="absolute top-4 right-4 z-10">
          <span className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.14em] text-amber-50">
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 opacity-80 blur-[3px]" />
            <span className="absolute inset-[1px] rounded-full bg-gradient-to-r from-[#18181b] via-[#030712] to-[#111827] border border-amber-300/80 shadow-[0_0_22px_rgba(250,204,21,0.75)]" />
            <span className="relative inline-flex items-center gap-1.5 px-1">
              <Icon
                icon="solar:cup-star-bold-duotone"
                className="text-sm text-amber-200"
              />
              <span className="text-[10px] tracking-[0.24em]">
                PELUANG EMAS
              </span>
            </span>
          </span>
        </div>
      );
    } else if (days > 20) {
      badgeContent = (
        <div className="absolute top-4 right-4 z-10">
          <span className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.14em] text-sky-50">
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 opacity-70 blur-[3px]" />
            <span className="absolute inset-[1px] rounded-full bg-gradient-to-r from-[#020617] via-[#020617] to-[#022c22] border border-sky-300/70 shadow-[0_0_18px_rgba(56,189,248,0.7)]" />
            <span className="relative inline-flex items-center gap-1.5 px-1">
              <Icon
                icon="solar:eye-bold-duotone"
                className="text-sm text-sky-200"
              />
              <span className="text-[10px] tracking-[0.22em]">
                JANGAN LEWATKAN
              </span>
            </span>
          </span>
        </div>
      );
    } else if (days > 10 && days <= 20) {
      const daysLabel = `${days} hari lagi`;
      badgeContent = (
        <div className="absolute top-4 right-4 z-10">
          <span className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.12em] text-white">
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 opacity-80 blur-[2px]" />
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 animate-pulse opacity-70" />
            <span className="relative inline-flex items-center gap-1.5 px-1">
              <Icon
                icon="solar:fire-bold-duotone"
                className="text-sm text-yellow-100"
              />
              {daysLabel}
            </span>
          </span>
        </div>
      );
    } else if (days > 0 && days <= 10) {
      const daysLabel = `${days} hari lagi`;
      badgeContent = (
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
                {daysLabel}
              </span>
            </span>
          </span>
        </div>
      );
    }
  }

  return (
    <div
      className="bg-[#050608] border border-white/10 rounded-3xl overflow-hidden group
                 relative flex flex-col h-full mx-1.5
                 shadow-[0_18px_60px_rgba(0,0,0,0.9)]
                 before:content-[''] before:absolute before:inset-px before:rounded-[22px]
                 before:border before:border-white/5 before:pointer-events-none
                 hover:border-emerald-400/60 hover:shadow-[0_22px_70px_rgba(34,197,94,0.3)]
                 transition-all duration-300"
    >
      {/* IMAGE SECTION */}
      <div
        className="relative h-60 md:h-64 w-full overflow-hidden
                   after:content-[''] after:absolute after:inset-x-6 after:bottom-0
                   after:h-px after:bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent
                   after:opacity-70"
      >
        <div className="relative w-full h-full">
          <Image
            key={images[currentImageIndex]}
            src={images[currentImageIndex]}
            alt={item.judul}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            priority={currentImageIndex === 0}
            className="object-cover transition-opacity duration-200 ease-out"
          />
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-70" />

        {/* Slider controls */}
        {images.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/70 hover:bg-primary hover:text-black text-white rounded-full flex items-center justify-center z-20 transition-all lg:opacity-0 lg:group-hover:opacity-100"
            >
              <Icon icon="solar:alt-arrow-left-linear" />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/70 hover:bg-primary hover:text-black text-white rounded-full flex items-center justify-center z-20 transition-all lg:opacity-0 lg:group-hover:opacity-100"
            >
              <Icon icon="solar:alt-arrow-right-linear" />
            </button>

            {/* Indicator bullets */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 z-20">
              {images.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    idx === currentImageIndex ? "bg-primary w-3" : "bg-white/50"
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {/* Badge kiri: kategori */}
        <div className="absolute top-4 left-4 z-10">
          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-black/80 text-emerald-300 text-[11px] font-semibold border border-emerald-400/40 backdrop-blur-sm">
            <Icon
              icon={
                item.kategori.toUpperCase() === "GUDANG"
                  ? "solar:box-bold-duotone"
                  : "solar:home-2-bold-duotone"
              }
              className="text-base"
            />
            {item.kategori}
          </span>
        </div>

        {/* Badge kanan: dinamis */}
        {badgeContent}
      </div>

      {/* CONTENT SECTION */}
      <div
        className="p-5 flex flex-col flex-grow 
                   bg-gradient-to-b from-slate-900/80 via-slate-950/90 to-black
                   border-t border-slate-800
                   backdrop-blur-sm"
      >
        {/* Harga */}
        <div className="mb-2">
          <div className="flex items-baseline gap-1">
            <h3 className="text-white text-xl font-extrabold tracking-tight truncate">
              {formatCurrency(item.harga)}
            </h3>
          </div>
        </div>

        {/* Judul */}
        <h4
          className="text-gray-200 text-lg font-bold truncate mb-2 group-hover:text-primary transition-colors cursor-pointer"
          title={item.judul}
        >
          {item.judul}
        </h4>

        {/* Lokasi */}
        <div className="flex items-start gap-2 mb-4">
          <Icon
            icon="solar:map-point-wave-bold"
            className="text-primary text-lg shrink-0 mt-0.5"
          />
          <span
            className="text-gray-400 font-medium text-sm line-clamp-1"
            title={item.alamat_lengkap}
          >
            {item.alamat_lengkap}
          </span>
        </div>

        {/* Box Lelang */}
        <div
          className="bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-950/90
                     rounded-2xl p-3 mb-5
                     border border-slate-700
                     shadow-[0_12px_35px_rgba(0,0,0,0.8)]"
        >
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-2">
              <Icon icon="solar:ruler-angular-bold" className="text-gray-400" />
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 uppercase">
                  Luas Tanah
                </span>
                <span className="text-white text-xs font-bold">
                  {item.luas_tanah ? `${item.luas_tanah}m²` : "-"}
                </span>
              </div>
            </div>

            <div className="w-[1px] h-8 bg-white/10" />

            <div className="flex items-center gap-2">
              <Icon
                icon="solar:calendar-date-bold"
                className="text-red-400"
              />
              <div className="flex flex-col items-start">
                <span className="flex items-center gap-1 text-[10px] text-gray-500 uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Lelang
                </span>
                <span className="text-white text-xs font-bold">
                  {formatDateShort(item.tanggal_lelang)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Agent + CTA Detail */}
        <div
          className="mt-auto pt-4 flex items-center justify-between
                     border-t border-slate-800
                     bg-gradient-to-r from-transparent via-slate-900/70 to-transparent
                     -mx-5 px-5 pb-3 rounded-b-3xl"
        >
          <div className="flex items-center gap-3 group/agent cursor-pointer">
            <div className="relative w-9 h-9 rounded-full p-[1px] bg-gradient-to-tr from-primary to-transparent">
              <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#151515] relative">
                <Image
                  src={item.agent_photo || "/images/user/user-01.png"}
                  alt={item.agent_name}
                  fill
                  className="object-cover"
                />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white group-hover/agent:text-primary transition-colors">
                {item.agent_name}
              </span>
              <span className="text-[10px] text-gray-500">
                {item.agent_office}
              </span>
            </div>
          </div>

          <span
            className="bg-emerald-400/5 hover:bg-emerald-400
                       text-emerald-200 hover:text-black
                       border border-emerald-400/60
                       shadow-[0_0_18px_rgba(34,197,94,0.6)]
                       text-xs font-bold px-4 py-2 rounded-full
                       flex items-center gap-2 transition-all active:scale-95"
          >
            Detail
            <Icon
              icon="solar:arrow-right-up-bold-duotone"
              className="text-sm"
            />
          </span>
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
const ProductList = ({ initialData, pagination }: ProductListProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productListRef = useRef<HTMLDivElement>(null);

  const BASE_URL = "/Lelang";

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`${BASE_URL}?${params.toString()}`, { scroll: false });

    if (productListRef.current) {
      productListRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  return (
    <div className="w-full" ref={productListRef}>
      {initialData && initialData.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence mode="wait">
            {initialData.map((item) => (
              <motion.div
                key={item.id_property}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                <Link href={getPropertyUrl(item)} className="block h-full">
                  <PropertyCard item={item} />
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/5 mt-6">
          <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon
              icon="solar:sad-square-bold-duotone"
              className="text-4xl text-gray-500"
            />
          </div>
          <h3 className="text-white font-bold text-xl mb-2">
            Belum Ada Properti
          </h3>
          <p className="text-gray-400">
            Belum ada listing lelang yang sesuai kriteria ini.
          </p>
          <button
            onClick={() => router.push(BASE_URL)}
            className="mt-6 px-6 py-2 bg-primary text-black font-bold rounded-full hover:bg-green-400 transition"
          >
            Lihat Semua
          </button>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="mt-16 flex justify-center">
          <nav className="flex items-center gap-2 bg-[#1A1A1A] p-2 rounded-full border border-white/10 shadow-2xl">
            <button
              onClick={() =>
                handlePageChange(Math.max(1, pagination.currentPage - 1))
              }
              disabled={pagination.currentPage === 1}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            >
              <Icon icon="solar:alt-arrow-left-linear" className="text-xl" />
            </button>

            {Array.from({ length: pagination.totalPages }).map((_, idx) => {
              const pageNum = idx + 1;
              const isActive = pagination.currentPage === pageNum;

              if (
                pagination.totalPages > 7 &&
                Math.abs(pagination.currentPage - pageNum) > 2 &&
                pageNum !== 1 &&
                pageNum !== pagination.totalPages
              ) {
                if (Math.abs(pagination.currentPage - pageNum) === 3)
                  return (
                    <span key={pageNum} className="text-gray-600 px-1">
                      ...
                    </span>
                  );
                return null;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`w-10 h-10 rounded-full font-bold text-sm transition-all duration-300 ${
                    isActive
                      ? "bg-primary text-black shadow-[0_0_15px_rgba(74,222,128,0.4)] scale-110"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() =>
                handlePageChange(
                  Math.min(
                    pagination.totalPages,
                    pagination.currentPage + 1
                  )
                )
              }
              disabled={pagination.currentPage === pagination.totalPages}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            >
              <Icon icon="solar:alt-arrow-right-linear" className="text-xl" />
            </button>
          </nav>
        </div>
      )}
    </div>
  );
};

export default ProductList;

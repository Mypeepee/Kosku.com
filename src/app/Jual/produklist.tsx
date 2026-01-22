"use client";
import React, { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import Sidebar from "./sidebar";

// --- TIPE DATA ---
interface PropertyDB {
  id_property: string;
  slug: string;
  judul: string;
  kota: string;
  harga: number;
  jenis_transaksi: string; // PRIMARY / SECONDARY / LELANG / SEWA
  kategori: string;        // Rumah, Apartemen, dll
  gambar: string;          // gambar pertama (fallback)
  foto_list: string[];     // hasil split kolom gambar
  luas_tanah: number;
  luas_bangunan: number;
  kamar_tidur: number;
  kamar_mandi: number;
  agent_name: string;
  agent_photo: string;
  agent_office: string;
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

// --- CONSTANTS ---
const PROPERTY_ICONS: Record<string, string> = {
  RUMAH: "solar:home-2-bold-duotone",
  APARTEMEN: "solar:buildings-2-bold-duotone",
  GUDANG: "solar:box-minimalistic-bold-duotone",
  TANAH: "solar:map-point-wave-bold-duotone",
  PABRIK: "solar:garage-bold-duotone",
  RUKO: "solar:shop-2-bold-duotone",
  TOKO: "solar:shop-bold-duotone",
  HOTEL: "solar:bed-bold-duotone",
  VILLA: "solar:star-fall-bold-duotone",
};

// --- UTILS ---
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

const getBadgeColor = (type: string) => {
  const t = type?.toUpperCase();
  if (t === "PRIMARY") return "bg-blue-500 shadow-blue-500/20";
  if (t === "SECONDARY") return "bg-violet-500 shadow-violet-500/20";
  if (t === "LELANG") return "bg-amber-500 shadow-amber-500/20";
  if (t === "SEWA") return "bg-emerald-500 shadow-emerald-500/20";
  return "bg-gray-500 shadow-gray-500/20";
};

const getPropertyIcon = (kategori: string): string => {
  const key = kategori?.trim().toUpperCase();
  return PROPERTY_ICONS[key] || "solar:home-2-bold-duotone";
};

// ✅ URL detail: /Jual/slug/id atau /Sewa/slug/id
const getPropertyUrl = (property: PropertyDB): string => {
  const transactionType = property.jenis_transaksi?.toUpperCase();
  const urlPath = transactionType === "SEWA" ? "Sewa" : "Jual";
  const slug = property.slug || "property";
  return `/${urlPath}/${slug}/${property.id_property}`;
};

// --- CARD ---
const PropertyCard = ({ item }: { item: PropertyDB }) => {
  const kategoriUpper = item.kategori?.trim().toUpperCase() || "";

  // slider dari foto_list, fallback ke gambar pertama atau placeholder
  const images =
    item.foto_list && item.foto_list.length > 0
      ? item.foto_list
      : [item.gambar || "/images/hero/banner.jpg"];

  return (
    <div className="bg-[#1A1A1A] border border-white/5 rounded-3xl overflow-hidden group hover:border-primary/50 transition-all duration-300 relative flex flex-col h-full hover:shadow-[0_10px_40px_-10px_rgba(74,222,128,0.1)]">
      {/* IMAGE SECTION – tinggi besar + horizontal slide */}
      <div className="relative w-full h-72 md:h-80 overflow-hidden">
        <div className="w-full h-full overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent snap-x snap-mandatory">
          <div className="flex h-full w-max">
            {images.map((src, idx) => (
              <div
                key={idx}
                className="relative w-full h-72 md:h-80 flex-shrink-0 snap-center"
                style={{ minWidth: "100%" }}
              >
                <Image
                  src={src}
                  alt={item.judul}
                  fill
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1A1A1A] via-transparent to-transparent opacity-60" />

        {/* BADGE BAR */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center gap-3 pointer-events-none">
          <span
            className={`${getBadgeColor(
              item.jenis_transaksi
            )} text-white text-[10px] font-bold px-4 py-1.5 rounded-full shadow-lg uppercase tracking-wide inline-flex items-center gap-1`}
          >
            <Icon
              icon="solar:star-bold-duotone"
              className="text-xs opacity-90"
            />
            {item.jenis_transaksi}
          </span>

          <span className="ml-auto bg-black/80 backdrop-blur-md border border-white/20 text-white text-[10px] font-semibold px-4 py-1.5 rounded-full inline-flex items-center gap-1.5">
            <Icon
              icon={getPropertyIcon(item.kategori)}
              className="text-sm opacity-90"
            />
            {kategoriUpper}
          </span>
        </div>

        {/* indikator dot */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-none">
            {images.map((_, idx) => (
              <span
                key={idx}
                className="w-1.5 h-1.5 rounded-full bg-white/40"
              />
            ))}
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div className="p-5 flex flex-col flex-grow">
        <div className="mb-2">
          <div className="flex items-baseline gap-1">
            <h3 className="text-white text-lg font-extrabold tracking-tight truncate">
              {formatCurrency(item.harga)}
            </h3>
          </div>
        </div>

        <h4
          className="text-gray-200 text-base font-bold truncate mb-2 group-hover:text-primary transition-colors cursor-pointer"
          title={item.judul}
        >
          {item.judul}
        </h4>

        <div className="flex items-start gap-2 mb-4">
          <Icon
            icon="solar:map-point-wave-bold"
            className="text-primary text-base shrink-0 mt-0.5"
          />
          <span
            className="text-gray-400 font-medium text-xs line-clamp-1"
            title={item.kota}
          >
            {item.kota}
          </span>
        </div>

        {/* Specs */}
        <div className="bg-white/5 rounded-xl p-3 mb-4 border border-white/5">
          <div className="grid grid-cols-4 divide-x divide-white/10 text-center">
            <div>
              <span className="text-[9px] text-gray-500 block mb-1">KT</span>
              <span className="text-white text-xs font-bold flex justify-center items-center gap-1">
                <Icon
                  icon="solar:bed-bold"
                  className="text-xs text-gray-400"
                />
                {item.kamar_tidur || "-"}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-gray-500 block mb-1">KM</span>
              <span className="text-white text-xs font-bold flex justify-center items-center gap-1">
                <Icon
                  icon="solar:bath-bold"
                  className="text-xs text-gray-400"
                />
                {item.kamar_mandi || "-"}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-gray-500 block mb-1">LT</span>
              <span className="text-white text-xs font-bold">
                {item.luas_tanah}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-gray-500 block mb-1">LB</span>
              <span className="text-white text-xs font-bold">
                {item.luas_bangunan || "-"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-3 border-t border-dashed border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative w-8 h-8 rounded-full overflow-hidden border border-white/20 shrink-0">
              <Image
                src={item.agent_photo || "/images/user/user-01.png"}
                alt="Agent"
                fill
                className="object-cover"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-200 leading-tight">
                {item.agent_name}
              </span>
              <span className="text-[9px] text-gray-500 leading-tight">
                {item.agent_office}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-bold text-primary flex items-center gap-1 shrink-0">
            Detail <Icon icon="solar:arrow-right-linear" />
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

  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const filterKota = searchParams.get("kota") || "";
  const BASE_URL = "/Jual";

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
    <div className="container mx-auto px-4 mt-12 mb-24" ref={productListRef}>
      {/* MOBILE FILTER DRAWER */}
      <AnimatePresence>
        {isMobileFilterOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileFilterOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] lg:hidden"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-[85%] max-w-[320px] bg-[#121212] z-[70] border-l border-white/10 shadow-2xl lg:hidden overflow-y-auto"
            >
              <div className="p-5">
                <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                  <h3 className="text-white font-bold text-lg flex items-center gap-2">
                    <Icon
                      icon="solar:filter-bold-duotone"
                      className="text-primary"
                    />{" "}
                    Filter
                  </h3>
                  <button
                    onClick={() => setIsMobileFilterOpen(false)}
                    className="p-2 bg_WHITE/5 hover:bg_WHITE/10 rounded-full text-white transition-colors"
                  >
                    <Icon
                      icon="solar:close-circle-bold"
                      className="text-xl"
                    />
                  </button>
                </div>
                <div className="pb-20">
                  <Sidebar />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* AREA PRODUK */}
        <div className="w-full lg:w-3/4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-white font-bold text-lg md:text-xl leading-tight">
                {filterKota
                  ? `Properti di "${filterKota}"`
                  : "Listing Primary & Secondary"}
              </h2>
              <span className="text-xs md:text-sm font-normal text-gray-400 mt-1 block">
                ({pagination.totalItems} ditemukan)
              </span>
            </div>

            <button
              onClick={() => setIsMobileFilterOpen(true)}
              className="lg:hidden shrink-0 flex items-center gap-2 text-white bg-white/5 border border-white/20 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-white/10 hover:border-primary/50 transition-all active:scale-95 ml-4"
            >
              <Icon icon="solar:filter-bold" className="text-primary" /> Filter
            </button>
          </div>

          {initialData && initialData.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              <AnimatePresence mode="wait">
                {initialData.map((item) => (
                  <motion.div
                    key={item.id_property}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Link href={getPropertyUrl(item)} className="block h-full">
                      <PropertyCard item={item} />
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-center py-20 bg-white/5 rounded-3xl border border_WHITE/5">
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
                Belum ada listing Primary/Secondary yang sesuai kriteria ini.
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
              <nav className="flex items_center gap-2 bg-[#1A1A1A] p-2 rounded-full border border_WHITE/10 shadow-2xl">
                <button
                  onClick={() =>
                    handlePageChange(
                      Math.max(1, pagination.currentPage - 1)
                    )
                  }
                  disabled={pagination.currentPage === 1}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                >
                  <Icon
                    icon="solar:alt-arrow-left-linear"
                    className="text-xl"
                  />
                </button>

                {Array.from({ length: pagination.totalPages }).map(
                  (_, idx) => {
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
                  }
                )}

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
                  <Icon
                    icon="solar:alt-arrow-right-linear"
                    className="text-xl"
                  />
                </button>
              </nav>
            </div>
          )}
        </div>

        {/* SIDEBAR DESKTOP */}
        <div className="hidden lg:block w-full lg:w-1/4 sticky top-32">
          <Sidebar />
        </div>
      </div>
    </div>
  );
};

export default ProductList;

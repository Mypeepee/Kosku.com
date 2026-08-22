"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useSwipe } from "@/hooks/useSwipe";
import { smoothScrollToElement } from "@/lib/pagination";
import Pagination from "@/components/Pagination";
import { HotDealBadge, HOT_DEAL_CARD_CLASS } from "@/components/HotDeal/HotDealBadge";
import { SliderDots } from "@/components/SliderDots";

import { PropertyCard, type PropertyDB } from "@/components/property/PropertyCard";

// Kartu lelang TIDAK lagi digambar di file ini. Bentuknya (hitung mundur di
// atas foto + baris Luas Tanah/Tanggal Lelang) sekarang jadi salah satu cabang
// di dalam PropertyCard bersama, jadi listing lelang tampil sama persis di
// /Lelang, halaman "Semua", dan carousel home.
//
// Yang TETAP milik halaman ini: getPropertyUrl di bawah, karena hanya /Lelang
// yang punya varian URL beragent (`/Lelang/<slug-id>/<idAgent>`) untuk
// presentasi co-broke.

interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

interface ProductListProps {
  initialData: PropertyDB[];
  pagination: PaginationData;
  /**
   * Kode agent perujuk untuk klien referral (monopoli Lelang).
   * Bila ada, link tiap kartu mengarah ke /Lelang/<slug>/<presentingAgentId>.
   */
  presentingAgentId?: string | null;
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
const getPropertyUrl = (
  property: PropertyDB,
  presentingAgentId?: string | null,
): string => {
  const baseSlug = property.slug || "property";
  const id = String(property.id_property);
  const slugWithId = `${baseSlug}-${id}`;
  return presentingAgentId
    ? `/Lelang/${slugWithId}/${presentingAgentId}`
    : `/Lelang/${slugWithId}`;
};

// --- MAIN COMPONENT ---
const ProductList = ({ initialData, pagination, presentingAgentId }: ProductListProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productListRef = useRef<HTMLDivElement>(null);
  const prevPageRef = useRef<number>(pagination.currentPage);

  const BASE_URL = "/Lelang";

  const handlePageChange = (newPage: number) => {
    if (newPage === pagination.currentPage) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`${BASE_URL}?${params.toString()}`, { scroll: false });
  };

  // Smooth-scroll to the first card row once the new page has rendered.
  useEffect(() => {
    if (prevPageRef.current === pagination.currentPage) return;
    prevPageRef.current = pagination.currentPage;
    requestAnimationFrame(() => {
      if (productListRef.current) smoothScrollToElement(productListRef.current);
    });
  }, [pagination.currentPage]);

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
                <Link href={getPropertyUrl(item, presentingAgentId)} className="block h-full">
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

      <Pagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        onPage={handlePageChange}
      />
    </div>
  );
};

export default ProductList;

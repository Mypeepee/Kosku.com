"use client";
import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import FilterCommandBar from "@/components/listing/filterbar/FilterCommandBar";
import type { TabTransaksi } from "@/components/listing/filterbar/TransactionSegments";
import type { KonteksListing } from "@/lib/listingSort";
import { smoothScrollToElement } from "@/lib/pagination";
import Pagination from "@/components/Pagination";
import {
  PropertyCard,
  getPropertyUrl,
  type PropertyDB,
} from "@/components/property/PropertyCard";

// PropertyDB, PropertyCard & helper URL-nya sekarang tinggal di
// @/components/property/PropertyCard supaya blok "Kos serupa" di halaman detail
// sewa memakai kartu yang SAMA PERSIS, bukan tiruannya.

interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

interface ProductListProps {
  initialData: PropertyDB[];
  pagination: PaginationData;
  /** URL dasar untuk pagination & reset filter (mis. "/Jual" atau "/Sewa"). */
  baseUrl?: string;
  /** Judul di atas grid (mis. "Listing Primary & Secondary" atau "Listing Sewa"). */
  heading?: string;
  /** Menentukan katalog "Urutkan" yang dipakai halaman ini. */
  konteks?: KonteksListing;
  /** Nama tempat yang sedang disaring ("dekat UNESA") — untuk label urutan. */
  namaTempat?: string | null;
}


// --- MAIN COMPONENT ---
const ProductList = ({
  initialData,
  pagination,
  baseUrl = "/Jual",
  heading = "Listing Primary & Secondary",
  konteks = "JUAL",
  namaTempat = null,
}: ProductListProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productListRef = useRef<HTMLDivElement>(null);
  const prevPageRef = useRef<number>(pagination.currentPage);

  const filterKota = searchParams.get("kota") || "";
  const BASE_URL = baseUrl;

  // `konteks` sudah dipakai untuk katalog Urutkan; sekarang juga menentukan
  // trigger & isi laci `FilterCommandBar` (Jual dapat Kamar/Luas/Legalitas,
  // Sewa dapat Durasi/Gender/Tipe Unit — lihat BIDANG_PER_KONTEKS).
  const tabAktif: TabTransaksi = konteks === "SEWA" ? "sewa" : "jual";

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
    <>
      {/* Bar filter+urutkan lengket. `showSegments` mati: /Jual dan /Sewa
          adalah route terpisah, bukan tab dari satu halaman seperti
          /properti/[slug] — bar ini murni kontrol filter di sini. */}
      <FilterCommandBar
        konteks={konteks}
        tabAktif={tabAktif}
        totalHasil={pagination.totalItems}
        namaTempat={namaTempat}
        showSegments={false}
      />

      <div className="container mx-auto px-4 mt-8 mb-24" ref={productListRef}>
        <div className="mb-6">
          <h2 className="text-white font-bold text-lg md:text-xl leading-tight">
            {filterKota ? `Properti di "${filterKota}"` : heading}
          </h2>
          <span className="text-xs md:text-sm font-normal text-gray-400 mt-1 block">
            ({pagination.totalItems} ditemukan)
          </span>
        </div>

        {initialData && initialData.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {initialData.map((item) => (
              <motion.div
                key={item.id_property}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Link href={getPropertyUrl(item)} className="block h-full">
                  <PropertyCard item={item} />
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/5">
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

        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPage={handlePageChange}
        />
      </div>

      {/* keyframes untuk animasi wiggle */}
      <style jsx global>{`
        @keyframes wiggle {
          0%,
          100% {
            transform: translateY(0) rotate(0deg);
          }
          25% {
            transform: translateY(-1px) rotate(-1deg);
          }
          75% {
            transform: translateY(1px) rotate(1deg);
          }
        }
      `}</style>
    </>
  );
};

export default ProductList;

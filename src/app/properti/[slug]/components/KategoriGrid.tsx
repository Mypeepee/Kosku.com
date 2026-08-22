"use client";

import React from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PropertyCard,
  getPropertyUrl,
} from "@/components/property/PropertyCard";
import KategoriPagination from "./KategoriPagination";
import type { PropertyItem, PaginationData } from "../types";

interface KategoriGridProps {
  items: PropertyItem[];
  pagination: PaginationData;
  activeTipe: string;
  onPage: (page: number) => void;
  onResetTipe: () => void;
}

const TIPE_LABELS: Record<string, string> = {
  jual:   "Dijual",
  lelang: "Lelang",
  sewa:   "Disewa",
};

export default function KategoriGrid({
  items,
  pagination,
  activeTipe,
  onPage,
  onResetTipe,
}: KategoriGridProps) {
  const tipeLabel = TIPE_LABELS[activeTipe];

  return (
    <div>
      {/* Jumlah hasil. Disembunyikan mulai xl karena di lebar itu bar filter
          sudah memuat angka yang sama tepat di sebelah tombol Filter — dua
          angka identik di satu layar terbaca seperti dua ukuran yang berbeda. */}
      <p className="text-white/25 text-xs mb-6 xl:hidden">
        Menampilkan{" "}
        <span className="text-white/50 font-semibold">
          {pagination.totalItems.toLocaleString("id-ID")}
        </span>{" "}
        properti
        {tipeLabel && ` · ${tipeLabel}`}
      </p>

      {/* Empty state */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(52,211,153,0.08)]">
            <Icon
              icon="solar:buildings-bold-duotone"
              className="text-5xl text-white/15"
            />
          </div>
          <h3 className="text-white/50 text-xl font-bold mb-2">
            Belum ada listing
          </h3>
          <p className="text-white/25 text-sm">
            Coba tab lain atau kunjungi kembali nanti
          </p>
          <button
            onClick={onResetTipe}
            className="mt-8 px-8 py-3 bg-primary text-black font-bold rounded-full hover:bg-green-400 transition-all shadow-[0_0_24px_rgba(74,222,128,0.3)]"
          >
            Lihat Semua
          </button>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeTipe}-${pagination.currentPage}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            // items-stretch + h-full berantai sampai ke kartunya: PropertyCard
            // memakai `flex flex-col h-full` supaya footer agent menempel di
            // dasar. Tanpa rantai tinggi ini tiap kartu setinggi isinya sendiri
            // dan judul dua baris membuat satu kartu lebih jangkung dari
            // tetangganya — persis ketidakrapian yang diminta hilang.
            className="grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 xl:grid-cols-3"
          >
            {items.map((item, idx) => (
              <motion.div
                key={item.id_property}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.3 }}
                className="h-full"
              >
                <Link href={getPropertyUrl(item)} className="block h-full">
                  <PropertyCard item={item} />
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      <KategoriPagination pagination={pagination} onPage={onPage} />
    </div>
  );
}

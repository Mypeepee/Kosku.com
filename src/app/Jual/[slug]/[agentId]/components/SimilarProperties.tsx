"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import {
  PropertyCard,
  getPropertyUrl,
} from "@/components/property/PropertyCard";
import type { PropertyItem } from "@/app/properti/[slug]/types";

/**
 * Blok "Properti Serupa" di halaman detail Jual — dan Lelang, yang me-re-export
 * komponen ini (lihat SimilarPropertiesLelang.tsx).
 *
 * Kartunya kartu BERSAMA, sama dengan /Jual, /Lelang, halaman "Semua" dan
 * beranda. Sebelumnya blok ini memakai kartu lama milik halaman kategori, jadi
 * listing lelang di sini tampil tanpa hitung mundur maupun penanda turun harga
 * — persis listing yang sama, tampil berbeda hanya karena pengunjung sampai ke
 * situ lewat halaman detail.
 */

interface SimilarPropertiesProps {
  items?: PropertyItem[];
}

export default function SimilarProperties({ items = [] }: SimilarPropertiesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Tidak ada properti relevan → jangan render apa pun.
  if (!items.length) return null;

  const scrollByCard = (dir: number) =>
    scrollRef.current?.scrollBy({ left: dir * 312, behavior: "smooth" });

  return (
    <section className="container mx-auto px-4 mt-6 pt-6 border-t border-white/5 mb-8">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-white">
            <Icon
              icon="solar:magnifer-zoom-in-bold-duotone"
              className="text-[#86efac]"
            />
            Properti Serupa
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Pilihan paling relevan berdasarkan lokasi, tipe &amp; harga
          </p>
        </div>

        {/* Scroll controls (desktop) */}
        <div className="hidden sm:flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollByCard(-1)}
            aria-label="Sebelumnya"
            className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-gray-300 transition-all hover:border-[#86efac]/50 hover:bg-[#86efac]/10 hover:text-[#86efac]"
          >
            <Icon icon="solar:alt-arrow-left-linear" className="text-sm" />
          </button>
          <button
            type="button"
            onClick={() => scrollByCard(1)}
            aria-label="Berikutnya"
            className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-gray-300 transition-all hover:border-[#86efac]/50 hover:bg-[#86efac]/10 hover:text-[#86efac]"
          >
            <Icon icon="solar:alt-arrow-right-linear" className="text-sm" />
          </button>
        </div>
      </div>

      {/* SCROLLABLE CARDS */}
      {/* items-stretch + rantai h-full sampai ke kartunya: PropertyCard memakai
          `flex flex-col h-full` supaya footer agent menempel di dasar. Tanpa
          rantai itu tiap kartu setinggi isinya sendiri, dan judul dua baris
          membuat satu kartu lebih jangkung dari tetangganya. */}
      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory items-stretch gap-3 overflow-x-auto scrollbar-hide pb-3 px-0.5 scroll-pl-0.5"
      >
        {items.map((item) => (
          <div
            key={item.id_property}
            className="w-[270px] shrink-0 snap-start sm:w-[300px]"
          >
            <Link href={getPropertyUrl(item)} className="block h-full">
              <PropertyCard item={item} />
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

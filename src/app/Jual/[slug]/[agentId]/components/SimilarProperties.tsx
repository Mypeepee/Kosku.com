"use client";

import React, { useRef } from "react";
import { Icon } from "@iconify/react";
import PropertyCard from "@/app/properti/[slug]/components/PropertyCard";
import type { PropertyItem } from "@/app/properti/[slug]/types";

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
      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scrollbar-hide pb-3 px-0.5 scroll-pl-0.5"
      >
        {items.map((item) => (
          <div
            key={item.id_property}
            className="w-[270px] shrink-0 snap-start sm:w-[300px]"
          >
            <PropertyCard item={item} compact idBadge={item.id_property} />
          </div>
        ))}
      </div>
    </section>
  );
}

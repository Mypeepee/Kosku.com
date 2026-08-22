"use client";

/**
 * "Kos serupa" — jalan keluar ketika kos yang dibuka ternyata tidak cocok.
 *
 * Kartunya BUKAN buatan file ini: yang dipakai adalah PropertyCard yang sama
 * persis dengan kartu di halaman daftar /Sewa, /Jual, /Lelang & /Carikos.
 *
 * Dulu file ini menggambar kartunya sendiri — lebih ramping, tanpa slider foto,
 * tanpa badge ID, tanpa Hot Deal, tanpa footer agent. Hasilnya pencari kos yang
 * berpindah dari halaman daftar ke halaman detail merasa masuk ke situs lain,
 * dan setiap perbaikan pada kartu daftar harus dikerjakan dua kali (dan pasti
 * terlupa sekali). Sekarang file ini hanya mengurus PEMBUNGKUSnya: judul
 * bagian, geser kiri/kanan, dan pintu keluar "Lihat semua".
 *
 * Lebar kartu dikunci lewat pembungkus di sini karena PropertyCard dirancang
 * untuk grid (mengisi kolomnya), sedangkan di sini ia hidup di dalam baris yang
 * bisa digeser mendatar.
 */

import React, { useRef } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import {
  PropertyCard,
  getPropertyUrl,
} from "@/components/property/PropertyCard";
import type { SewaSimilarItem } from "../types";

export default function SimilarProperties({
  items,
  kota,
}: {
  items: SewaSimilarItem[];
  kota: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) return null;

  const geser = (arah: "kiri" | "kanan") => {
    scrollRef.current?.scrollBy({
      left: arah === "kiri" ? -340 : 340,
      behavior: "smooth",
    });
  };

  return (
    <section className="bg-transparent mt-12 border-t border-white/[0.07] py-10">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h3 className="text-xl font-extrabold tracking-tight text-white md:text-2xl">
            Kos serupa di sekitar
          </h3>
          <p className="mt-1 text-xs text-white/40 md:text-sm">
            Pilihan lain dengan lokasi &amp; kisaran harga yang mirip
          </p>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <button
            onClick={() => geser("kiri")}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-white transition-all hover:bg-white hover:text-black active:scale-95"
            aria-label="Geser kiri"
          >
            <Icon icon="solar:alt-arrow-left-linear" className="text-xl" />
          </button>
          <button
            onClick={() => geser("kanan")}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-white transition-all hover:bg-white hover:text-black active:scale-95"
            aria-label="Geser kanan"
          >
            <Icon icon="solar:alt-arrow-right-linear" className="text-xl" />
          </button>
        </div>
      </div>

      {/* items-stretch + h-full pada tiap kartu: PropertyCard memakai
          `flex flex-col h-full` supaya footer agentnya menempel ke bawah, dan
          itu hanya bekerja kalau pembungkusnya punya tinggi yang sama. */}
      <div
        ref={scrollRef}
        className="hide-scrollbar -mx-4 flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0"
      >
        {items.map((item) => (
          <Link
            key={item.id_property}
            href={getPropertyUrl(item)}
            // `block h-full` sama dengan pembungkus di ProductList — tanpa itu
            // `h-full` milik kartu tidak punya acuan tinggi dan footer agentnya
            // berhenti menempel di dasar kartu.
            className="block h-full w-[300px] shrink-0 snap-center md:w-[340px]"
          >
            <PropertyCard item={item} />
          </Link>
        ))}

        <Link
          href={`/Sewa?kota=${encodeURIComponent(kota)}`}
          className="group flex w-[180px] shrink-0 snap-center items-center justify-center"
        >
          <div className="flex flex-col items-center gap-3 text-white/40 transition-colors group-hover:text-white">
            <span className="grid h-14 w-14 place-items-center rounded-full border border-white/10 transition-all group-hover:border-sky-300 group-hover:bg-sky-300 group-hover:text-black">
              <Icon icon="solar:arrow-right-linear" className="text-2xl" />
            </span>
            <span className="text-sm font-bold">Lihat semua</span>
          </div>
        </Link>
      </div>
    </section>
  );
}

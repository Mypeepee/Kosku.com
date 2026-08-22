"use client";

import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { TX_TABS, type TxTab } from "@/lib/searchTabs";

export type { TxTab };

/**
 * Pill transaksi di atas SEMUA search bar (Home, Jual, Lelang, Sewa, kategori).
 *
 * Komponen ini TERKONTROL penuh: klik pill hanya mengubah pilihan, tidak
 * pindah halaman. Inputan form tetap utuh dan kolom kriteria ikut menyesuaikan
 * (Sewa → Durasi Sewa + Harga Sewa); navigasi baru terjadi saat user menekan
 * tombol Cari. Sengaja tanpa `useSearchParams()`/`useRouter()` supaya bisa
 * dipakai di halaman statis (Home) tanpa memaksa Suspense boundary.
 */
export default function TransactionTabs({
  active,
  onChange,
  className = "mb-4",
  pillId = "txTabPill",
}: {
  active: TxTab;
  onChange: (tab: TxTab) => void;
  className?: string;
  /** `layoutId` pil aktif. WAJIB dibedakan kalau dua TransactionTabs bisa
   *  ter-mount bersamaan (mis. satu di halaman + satu di dalam sheet filter):
   *  layoutId kembar membuat pilnya "terbang" antar-instance. */
  pillId?: string;
}) {
  return (
    <div className={`flex justify-center ${className}`}>
      <div
        role="tablist"
        aria-label="Jenis transaksi"
        className="bg-[#1A1A1A]/90 backdrop-blur-md border border-white/15 px-3 py-2 rounded-full flex w-full max-w-md sm:max-w-none sm:w-auto sm:inline-flex shadow-xl"
      >
        {TX_TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <motion.button
              key={tab.id}
              type="button"
              role="tab"
              onClick={() => onChange(tab.id)}
              aria-selected={isActive}
              whileTap={{ scale: 0.94 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className={`relative flex flex-1 sm:flex-initial items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
                isActive ? "text-darkmode" : "text-gray-400 hover:text-white"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId={pillId}
                  className="absolute inset-0 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-1px_2px_rgba(0,0,0,0.18)]"
                  style={{ background: "linear-gradient(180deg,#9af7b5 0%,#4ade80 55%,#37d06d 100%)" }}
                  transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.8 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
                <motion.span
                  initial={false}
                  animate={isActive ? { scale: [1, 1.28, 1] } : { scale: 1 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="flex"
                >
                  <Icon icon={tab.icon} className="text-base sm:text-lg shrink-0" />
                </motion.span>
                {tab.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

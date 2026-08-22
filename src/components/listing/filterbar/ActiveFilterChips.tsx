"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ChipFilter } from "@/lib/listingFilters";
import { AKSEN_TEKS, RING_FOKUS } from "./tokens";

/**
 * Baris chip filter aktif.
 *
 * KENAPA WAJIB ADA
 * Tanpa baris ini, satu-satunya cara mengetahui kenapa hasil menyempit adalah
 * membuka satu per satu panel filter dan memeriksanya. Chip yang bisa dihapus
 * satuan membuat keadaan filter terbaca sekali lihat DAN bisa dibongkar
 * bertahap — bukan hanya "reset semua atau tidak sama sekali".
 *
 * Barisnya menghilang total saat tidak ada filter aktif, jadi ia tidak pernah
 * memakan tinggi bar untuk hal kosong.
 */

export default function ActiveFilterChips({
  chips,
  tersembunyi,
  onHapus,
  onHapusSemua,
}: {
  chips: ChipFilter[];
  /** Jumlah filter yang tersimpan di URL tapi tidak berlaku di tab ini. */
  tersembunyi: number;
  onHapus: (chip: ChipFilter) => void;
  onHapusSemua: () => void;
}) {
  const kurangiGerak = useReducedMotion();
  if (chips.length === 0 && tersembunyi === 0) return null;

  return (
    <motion.div
      initial={kurangiGerak ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div className="container mx-auto flex max-w-screen-xl items-center gap-2 px-5 py-2 sm:px-8 md:px-10">
        <div
          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto scrollbar-none"
          style={{ scrollbarWidth: "none" }}
        >
          <AnimatePresence initial={false}>
            {chips.map((chip) => (
              <motion.button
                key={chip.id}
                layout={!kurangiGerak}
                initial={kurangiGerak ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                type="button"
                onClick={() => onHapus(chip)}
                aria-label={`Hapus filter ${chip.label}`}
                className={`group flex h-7 shrink-0 items-center gap-1.5 rounded-full pl-3 pr-2 text-[12px] font-semibold transition-colors ${RING_FOKUS}`}
                style={{
                  background: "rgba(99,102,241,0.14)",
                  border: "1px solid rgba(99,102,241,0.4)",
                  color: AKSEN_TEKS,
                }}
              >
                <span className="whitespace-nowrap">{chip.label}</span>
                <Icon
                  icon="solar:close-circle-bold"
                  className="shrink-0 text-sm transition-colors group-hover:text-red-400"
                  aria-hidden
                />
              </motion.button>
            ))}
          </AnimatePresence>

          {/* Filter yang disimpan untuk tab lain. Disebutkan, bukan dibuang:
              pemakai yang menyaring kos putri lalu mengintip tab Jual sebentar
              tidak boleh kehilangan pekerjaannya saat kembali — tapi juga tidak
              boleh mengira filternya sedang berlaku di sini. */}
          {tersembunyi > 0 && (
            <span
              className="flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-medium"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px dashed rgba(255,255,255,0.14)",
                color: "rgba(255,255,255,0.4)",
              }}
              title="Filter ini hanya berlaku di tab lain dan akan aktif lagi saat kamu kembali ke sana"
            >
              <Icon icon="solar:eye-closed-linear" className="text-xs" aria-hidden />
              {tersembunyi} filter tab lain
            </span>
          )}
        </div>

        {chips.length > 0 && (
          <button
            type="button"
            onClick={onHapusSemua}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold transition-colors hover:text-red-400 ${RING_FOKUS}`}
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            Hapus semua
          </button>
        )}
      </div>
    </motion.div>
  );
}

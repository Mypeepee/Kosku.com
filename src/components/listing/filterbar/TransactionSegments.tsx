"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AKSEN_TEKS, RING_FOKUS, ringkasAngka } from "./tokens";

/**
 * Pemilih jenis transaksi. Segmented control, bukan deretan chip: keempat nilai
 * saling meniadakan, dan satu latar yang bergeser antar segmen menyatakan itu
 * jauh lebih jelas daripada empat pill yang bisa terlihat "semua mati".
 *
 * Angka di tiap segmen mengikuti filter yang sedang aktif, jadi ia menjawab
 * "kalau saya pindah ke Lelang, ada berapa?" — bukan total isi database.
 */

export type TabTransaksi = "semua" | "jual" | "lelang" | "sewa";

const TABS: { key: TabTransaksi; label: string }[] = [
  { key: "semua", label: "Semua" },
  { key: "jual", label: "Jual" },
  { key: "lelang", label: "Lelang" },
  { key: "sewa", label: "Sewa" },
];

export default function TransactionSegments({
  aktif,
  counts,
  onChange,
  padat = false,
}: {
  aktif: TabTransaksi;
  counts: Record<TabTransaksi, number>;
  onChange: (tab: TabTransaksi) => void;
  /** Versi tanpa angka, untuk layar sempit. */
  padat?: boolean;
}) {
  const kurangiGerak = useReducedMotion();

  return (
    <div
      role="tablist"
      aria-label="Jenis transaksi"
      className="flex shrink-0 items-center gap-0.5 rounded-xl p-0.5"
      style={{ background: "rgba(255,255,255,0.04)" }}
    >
      {TABS.map((tab) => {
        const isAktif = aktif === tab.key;
        const jumlah = counts[tab.key] ?? 0;
        // Tab tanpa hasil tetap bisa diklik: menghalanginya menyembunyikan
        // informasi berguna ("Jual memang kosong untuk filter ini") dan membuat
        // pemakai mengira barnya rusak.
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isAktif}
            onClick={() => onChange(tab.key)}
            className={`relative flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-bold transition-colors ${RING_FOKUS}`}
            style={{ color: isAktif ? "#fff" : "rgba(255,255,255,0.42)" }}
          >
            {isAktif && (
              <motion.span
                layoutId="segmen-transaksi"
                className="absolute inset-0 rounded-[10px]"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
                transition={
                  kurangiGerak
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 520, damping: 38 }
                }
              />
            )}
            <span className="relative z-10 whitespace-nowrap">{tab.label}</span>
            {!padat && (
              <span
                className="relative z-10 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
                style={
                  isAktif
                    ? { background: "rgba(99,102,241,0.25)", color: AKSEN_TEKS }
                    : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.28)" }
                }
              >
                {ringkasAngka(jumlah)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

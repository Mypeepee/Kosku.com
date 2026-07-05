"use client";

import React from "react";
import Image from "next/image";

export type HotDealSize = "sm" | "md";

/**
 * Pill "Hot Deal" — dipakai seragam di semua kartu properti
 * (Home, Jual, Lelang, Sewa, Properti Serupa, dashboard).
 * Halo gradient berdenyut + sheen bergerak untuk efek FOMO.
 */
export function HotDealBadge({ size = "md" }: { size?: HotDealSize }) {
  const sm = size === "sm";
  const pad = sm ? "px-2 py-0.5" : "px-3 py-1.5";
  const txt = sm ? "text-[9px]" : "text-[10px]";
  const fire = sm ? "h-3 w-3" : "h-4 w-4";

  return (
    <span className={`relative inline-flex items-center rounded-full font-black uppercase tracking-[0.16em] text-white ${pad} ${txt}`}>
      {/* halo gradient berdenyut — bikin mata langsung ketarik */}
      <span className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-amber-400 via-red-500 to-rose-600 opacity-80 blur-[5px] animate-pulse" />
      {/* body gelap dengan border menyala */}
      <span className="absolute inset-0 rounded-full bg-gradient-to-r from-[#1a0a02] via-[#2a0606] to-[#1a0202] border border-orange-400/80 shadow-[0_0_24px_rgba(249,115,22,0.85)]" />
      {/* sheen bergerak */}
      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
        <span className="absolute inset-y-0 -left-full w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent blur-sm animate-[hotdeal-sheen_2.4s_ease-in-out_infinite]" />
      </span>
      <span className="relative inline-flex items-center gap-1.5 px-0.5">
        <Image
          src="/images/icons/fire.gif"
          alt=""
          width={16}
          height={16}
          unoptimized
          className={`${fire} shrink-0 object-contain drop-shadow-[0_0_6px_rgba(251,146,60,0.9)]`}
        />
        <span className="bg-gradient-to-r from-amber-200 via-white to-amber-200 bg-clip-text text-transparent">
          Hot Deal
        </span>
      </span>
    </span>
  );
}

/**
 * Kelas outline + glow untuk kartu Hot Deal.
 * Dipakai lewat ternary di wrapper kartu supaya menggantikan
 * border/shadow default (bukan menumpuk), jadi tidak ada konflik warna.
 * Hover mengintensifkan tone ámbar yang sama (bukan lompat ke esmeralda).
 */
export const HOT_DEAL_CARD_CLASS =
  "border border-amber-400/60 shadow-[0_18px_60px_rgba(0,0,0,0.9),0_0_22px_rgba(251,146,60,0.28)] before:border-amber-300/25 hover:border-amber-300/90 hover:shadow-[0_22px_70px_rgba(0,0,0,0.9),0_0_34px_rgba(251,146,60,0.55)]";

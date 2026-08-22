"use client";

/**
 * Pill pojok kanan atas card kos.
 *
 * Satu komponen dipakai card publik & Live Preview supaya keduanya mustahil
 * berbeda — agent memutuskan isian berdasarkan preview.
 */

import React from "react";
import { Icon } from "@iconify/react";
import { buildKosPill } from "@/lib/kosCard";
import { PILL_DASAR, PILL_WARNA } from "./kosCardStyle";

export function KosPillBadge({
  kamarTersedia,
  gender,
  className = "",
}: {
  kamarTersedia?: number | null;
  gender?: string | null;
  className?: string;
}) {
  const pill = buildKosPill(kamarTersedia, gender);
  if (!pill) return null;

  return (
    <span className={`${PILL_DASAR} ${PILL_WARNA[pill.varian]} ${className}`}>
      <Icon icon={pill.icon} className="shrink-0 text-sm" />
      {pill.label}
    </span>
  );
}

"use client";

import { motion } from "framer-motion";
import { Icon } from "@iconify/react";

/** Goyangan saat form ditolak — dipisah jadi konstanta supaya sama di semua hero. */
const SHAKE = {
  x: [0, -16, 16, -16, 16, -16, 16, -12, 12, -8, 8, 0],
  rotate: [0, -3, 3, -3, 3, -3, 3, -2, 2, -1, 1, 0],
};

export default function SearchSubmitButton({
  searching,
  shaking,
  onClick,
  mobileLabel = "Cari",
  width = "lg:w-[10%]",
}: {
  searching: boolean;
  shaking: boolean;
  onClick: () => void;
  mobileLabel?: string;
  width?: string;
}) {
  return (
    <div className={`w-full ${width} p-4 lg:p-1.5 shrink-0 flex items-center justify-center`}>
      <motion.button
        type="button"
        onClick={onClick}
        disabled={searching}
        aria-label={searching ? "Mencari" : "Cari"}
        animate={shaking ? SHAKE : {}}
        transition={{ duration: 0.7, ease: "easeInOut" }}
        className="w-full lg:w-12 h-12 bg-primary hover:bg-[#6ee7b7] text-darkmode rounded-2xl lg:rounded-full font-bold text-lg flex items-center justify-center shadow-lg shadow-primary/30 transition-all transform active:scale-95 disabled:opacity-80 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      >
        {searching ? (
          <span className="w-5 h-5 rounded-full border-2 border-darkmode border-t-transparent animate-spin" />
        ) : (
          <Icon icon="solar:magnifer-linear" className="text-xl stroke-2" />
        )}
        <span className="lg:hidden ml-2">{searching ? "Mencari..." : mobileLabel}</span>
      </motion.button>
    </div>
  );
}

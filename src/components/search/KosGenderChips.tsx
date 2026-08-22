"use client";

/**
 * Baris pilihan gender kos — hanya muncul saat pill Sewa aktif DAN tipe "Kos"
 * dipilih, karena `gender` cuma dipakai oleh listing kos. Dipasang di semua
 * search bar supaya perilakunya sama dari halaman mana pun user mulai.
 */

import { AnimatePresence, motion } from "framer-motion";
import { GENDER_OPTIONS } from "@/lib/searchTabs";

type Theme = "light" | "dark";

const THEMES: Record<Theme, { border: string; label: string; idle: string }> = {
  light: {
    border: "border-gray-100",
    label: "text-gray-400",
    idle: "bg-gray-100 text-gray-500 hover:text-gray-800",
  },
  dark: {
    border: "border-white/5",
    label: "text-gray-500",
    idle: "bg-white/5 text-gray-400 hover:text-white",
  },
};

export default function KosGenderChips({
  show,
  value,
  onChange,
  theme = "dark",
}: {
  show: boolean;
  value: string;
  onChange: (next: string) => void;
  theme?: Theme;
}) {
  const t = THEMES[theme];

  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          <div
            className={`px-4 lg:px-5 pb-3 pt-3 flex items-center gap-2 flex-wrap border-t mt-1 ${t.border}`}
          >
            <span
              className={`text-[10px] font-extrabold tracking-wider uppercase mr-1 ${t.label}`}
            >
              Gender Kos:
            </span>
            <button
              type="button"
              onClick={() => onChange("")}
              aria-pressed={value === ""}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                value === "" ? "bg-primary text-darkmode" : t.idle
              }`}
            >
              Semua
            </button>
            {GENDER_OPTIONS.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => onChange(g.value)}
                aria-pressed={value === g.value}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  value === g.value ? "bg-primary text-darkmode" : t.idle
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import React, { useRef, useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { SORT_OPTIONS } from "../constants";
import type { TabCounts } from "../types";

interface KategoriFilterBarProps {
  activeTipe: string;
  activeSort: string;
  tabCounts: TabCounts;
  onTipeChange: (tipe: string | undefined) => void;
  onSortChange: (sort: string | undefined) => void;
}

const TABS = [
  { key: "semua",  label: "Semua"  },
  { key: "jual",   label: "Jual"   },
  { key: "lelang", label: "Lelang" },
  { key: "sewa",   label: "Sewa"   },
] as const;

const BAR_STYLE: React.CSSProperties = {
  background: "rgba(15,15,15,0.92)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
};

const PANEL_STYLE: React.CSSProperties = {
  background: "rgba(12,12,18,0.98)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
};

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}rb`;
  return n.toLocaleString("id-ID");
}

// ─── DESKTOP BAR ─────────────────────────────────────────────────────────────
function DesktopBar({ activeTipe, activeSort, tabCounts, onTipeChange, onSortChange }: KategoriFilterBarProps) {
  return (
    <div className="container mx-auto max-w-screen-xl flex items-center gap-1 px-5 sm:px-8 md:px-10" style={{ height: 52 }}>

      {/* TIPE TABS */}
      {TABS.map((tab) => {
        const isActive = activeTipe === tab.key || (tab.key === "semua" && (activeTipe === "semua" || !activeTipe));
        return (
          <button
            key={tab.key}
            onClick={() => onTipeChange(tab.key === "semua" ? undefined : tab.key)}
            className="relative flex items-center gap-1.5 shrink-0 px-3.5 h-8 rounded-xl text-xs font-bold transition-colors duration-150 select-none"
            style={{ color: isActive ? "#fff" : "rgba(255,255,255,0.38)" }}
          >
            {isActive && (
              <motion.span
                layoutId="tipe-pill-desktop"
                className="absolute inset-0 rounded-xl"
                style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.14)" }}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10 whitespace-nowrap">{tab.label}</span>
            <span
              className="relative z-10 tabular-nums text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={isActive
                ? { background: "rgba(52,211,153,0.2)", color: "#34d399" }
                : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.22)" }}
            >
              {formatCount(tabCounts[tab.key])}
            </span>
          </button>
        );
      })}

      {/* DIVIDER */}
      <div className="w-px h-5 shrink-0 mx-2" style={{ background: "rgba(255,255,255,0.1)" }} />

      {/* SORT PILLS — klik pill aktif (atau tombol silang) untuk menonaktifkan */}
      {SORT_OPTIONS.map((opt) => {
        const isActive = activeSort === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onSortChange(isActive ? undefined : opt.value)}
            title={isActive ? `Nonaktifkan urutan ${opt.label}` : `Urutkan: ${opt.label}`}
            className="group relative flex items-center gap-1.5 shrink-0 h-8 rounded-full text-xs font-semibold transition-all duration-150 select-none"
            style={isActive ? {
              paddingLeft: 12,
              paddingRight: 6,
              background: "rgba(99,102,241,0.18)",
              border: "1px solid rgba(99,102,241,0.4)",
              color: "#a5b4fc",
            } : {
              paddingLeft: 12,
              paddingRight: 12,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.35)",
            }}
          >
            <Icon icon={opt.icon} className="text-sm shrink-0" />
            <span className="whitespace-nowrap">{opt.label}</span>
            {isActive && (
              <span
                aria-hidden
                className="flex items-center justify-center rounded-full shrink-0 transition-transform duration-150 group-hover:scale-110"
                style={{
                  width: 18,
                  height: 18,
                  background: "#ef4444",
                  boxShadow: "0 1px 4px rgba(239,68,68,0.5)",
                }}
              >
                <Icon icon="mdi:close" className="text-white" style={{ fontSize: 12 }} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── MOBILE BAR ──────────────────────────────────────────────────────────────
function MobileBar({ activeTipe, activeSort, tabCounts, onTipeChange, onSortChange }: KategoriFilterBarProps) {
  const [openPanel, setOpenPanel] = useState<"tipe" | "sort" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const currentSort = SORT_OPTIONS.find(o => o.value === activeSort) ?? null;
  const currentTipe = TABS.find(t => t.key === (activeTipe || "semua")) ?? TABS[0];

  const toggle = (panel: "tipe" | "sort") =>
    setOpenPanel(prev => prev === panel ? null : panel);

  // Tutup jika klik di luar
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenPanel(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative">

      {/* ── TRIGGER ROW ── */}
      <div className="container mx-auto max-w-screen-xl px-5 sm:px-8 md:px-10 flex" style={{ height: 52 }}>

        {/* TIPE trigger */}
        <button
          onClick={() => toggle("tipe")}
          className="flex-1 flex items-center gap-2.5 transition-colors duration-150 select-none min-w-0"
          style={{ color: openPanel === "tipe" ? "#fff" : "rgba(255,255,255,0.6)" }}
        >
          <Icon
            icon="solar:filter-bold-duotone"
            className="text-base shrink-0"
            style={{ color: openPanel === "tipe" ? "#a5b4fc" : "rgba(255,255,255,0.28)" }}
          />
          <div className="min-w-0 text-left flex-1">
            <p className="text-[9px] font-extrabold uppercase tracking-widest leading-none mb-0.5"
              style={{ color: "rgba(255,255,255,0.28)" }}>Kategori</p>
            <p className="text-sm font-bold truncate leading-tight">{currentTipe.label}</p>
          </div>
          <motion.div animate={{ rotate: openPanel === "tipe" ? 180 : 0 }} transition={{ duration: 0.18 }}>
            <Icon icon="solar:alt-arrow-down-bold" className="text-xs shrink-0"
              style={{ color: "rgba(255,255,255,0.25)" }} />
          </motion.div>
        </button>

        {/* Divider */}
        <div className="shrink-0 mx-2 my-3" style={{ width: 1, background: "rgba(255,255,255,0.08)" }} />

        {/* SORT trigger */}
        <button
          onClick={() => toggle("sort")}
          className="flex-1 flex items-center gap-2.5 transition-colors duration-150 select-none min-w-0"
          style={{ color: openPanel === "sort" ? "#fff" : "rgba(255,255,255,0.6)" }}
        >
          <Icon
            icon={currentSort?.icon ?? "solar:sort-by-time-bold-duotone"}
            className="text-base shrink-0"
            style={{ color: openPanel === "sort" ? "#a5b4fc" : "rgba(255,255,255,0.28)" }}
          />
          <div className="min-w-0 text-left flex-1">
            <p className="text-[9px] font-extrabold uppercase tracking-widest leading-none mb-0.5"
              style={{ color: "rgba(255,255,255,0.28)" }}>Urutkan</p>
            <p className="text-sm font-bold truncate leading-tight"
              style={{ color: currentSort ? "#fff" : "rgba(255,255,255,0.4)" }}>
              {currentSort?.label ?? "Pilih urutan"}
            </p>
          </div>
          {currentSort ? (
            /* Tombol silang merah: nonaktifkan urutan tanpa buka panel.
               role=button (bukan <button>) karena berada di dalam <button>. */
            <span
              role="button"
              aria-label={`Nonaktifkan urutan ${currentSort.label}`}
              onClick={(e) => { e.stopPropagation(); onSortChange(undefined); setOpenPanel(null); }}
              className="flex items-center justify-center rounded-full shrink-0 active:scale-90 transition-transform"
              style={{ width: 20, height: 20, background: "#ef4444", boxShadow: "0 1px 4px rgba(239,68,68,0.5)" }}
            >
              <Icon icon="mdi:close" className="text-white" style={{ fontSize: 13 }} />
            </span>
          ) : (
            <motion.div animate={{ rotate: openPanel === "sort" ? 180 : 0 }} transition={{ duration: 0.18 }}>
              <Icon icon="solar:alt-arrow-down-bold" className="text-xs shrink-0"
                style={{ color: "rgba(255,255,255,0.25)" }} />
            </motion.div>
          )}
        </button>
      </div>

      {/* ── FLOATING DROPDOWN PANELS ── */}
      <AnimatePresence>
        {openPanel && (
          <motion.div
            key={openPanel}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 right-0 z-50"
            style={{
              top: "100%",
              background: "rgba(10,11,18,0.98)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
            }}
          >
            {/* TIPE PANEL */}
            {openPanel === "tipe" && (
              <div className="container mx-auto max-w-screen-xl px-5 sm:px-8 md:px-10 py-4 grid grid-cols-2 gap-2">
                {TABS.map((tab) => {
                  const isActive = activeTipe === tab.key
                    || (tab.key === "semua" && (activeTipe === "semua" || !activeTipe));
                  return (
                    <button
                      key={tab.key}
                      onClick={() => { onTipeChange(tab.key === "semua" ? undefined : tab.key); setOpenPanel(null); }}
                      className="flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all active:scale-[0.97]"
                      style={isActive ? {
                        background: "rgba(255,255,255,0.09)",
                        border: "1px solid rgba(255,255,255,0.16)",
                      } : {
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <span className="text-sm font-bold"
                        style={{ color: isActive ? "#fff" : "rgba(255,255,255,0.45)" }}>
                        {tab.label}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums"
                        style={isActive
                          ? { background: "rgba(52,211,153,0.2)", color: "#34d399" }
                          : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.22)" }}>
                        {formatCount(tabCounts[tab.key])}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* SORT PANEL */}
            {openPanel === "sort" && (
              <div className="container mx-auto max-w-screen-xl px-5 sm:px-8 md:px-10 py-4 grid grid-cols-2 gap-2">
                {SORT_OPTIONS.map((opt) => {
                  const isActive = activeSort === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => { onSortChange(isActive ? undefined : opt.value); setOpenPanel(null); }}
                      className="flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all active:scale-[0.97]"
                      style={isActive ? {
                        background: "rgba(99,102,241,0.14)",
                        border: "1px solid rgba(99,102,241,0.3)",
                      } : {
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <Icon icon={opt.icon} className="text-base shrink-0"
                        style={{ color: isActive ? "#a5b4fc" : "rgba(255,255,255,0.28)" }} />
                      <span className="text-sm font-semibold text-left flex-1"
                        style={{ color: isActive ? "#a5b4fc" : "rgba(255,255,255,0.5)" }}>
                        {opt.label}
                      </span>
                      {isActive && (
                        /* Silang merah = tekan lagi untuk menonaktifkan urutan */
                        <span
                          aria-hidden
                          className="flex items-center justify-center rounded-full shrink-0"
                          style={{ width: 20, height: 20, background: "#ef4444", boxShadow: "0 1px 4px rgba(239,68,68,0.5)" }}
                        >
                          <Icon icon="mdi:close" className="text-white" style={{ fontSize: 13 }} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────
export default function KategoriFilterBar(props: KategoriFilterBarProps) {
  return (
    <div className="sticky top-0 lg:top-[72px] z-40" style={BAR_STYLE}>
      {/* Desktop: horizontal pill bar */}
      <div className="hidden lg:block">
        <DesktopBar {...props} />
      </div>

      {/* Mobile/tablet: dropdown */}
      <div className="lg:hidden">
        <MobileBar {...props} />
      </div>
    </div>
  );
}

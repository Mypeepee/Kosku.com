"use client";

import React, { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  AnnualSalesChart,
  AreaCompareChart,
  EMERALD,
  GroupedBarChart,
  MultiLineChart,
  StackedBarChart,
  TargetRealityBars,
} from "./charts";
import { useAgentKpiCards } from "@/app/dashboard/hooks/useAgentKpiCards";
import LeadDetailSheet from "./LeadDetailSheet";
import {
  useTitipFeed,
  TitipRow,
  ClaimedFollowupRow,
  LockedRow,
  ClaimedTitipModal,
  TitipToast,
} from "./titipLeads";
import { AgentCalendar } from "@/app/dashboard/components/agent/AgentCalendar";
import { UpcomingEventsCard } from "./UpcomingEventsCard";
import { ListingPerformanceCard } from "./ListingPerformanceCard";
import { NetworkReferralCard } from "./NetworkReferralCard";

/* ────────────────────────────────────────────────────────────────────
   Shared card shell — dark glass, emerald accents, premium hairlines.
   ──────────────────────────────────────────────────────────────────── */

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-b from-[#0a0f10] to-[#070a0b] ${className}`}
    >
      {/* top hairline glow */}
      <div className="pointer-events-none absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-emerald-400/25 to-transparent" />
      {children}
    </div>
  );
}

function CardHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-3">
      <div className="min-w-0">
        <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {right ? <div className="flex-shrink-0">{right}</div> : null}
    </div>
  );
}

function ExportBtn() {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-emerald-500/10 hover:border-emerald-400/25 hover:text-emerald-200 transition"
    >
      <Icon icon="solar:download-minimalistic-bold-duotone" className="text-base" />
      Export
    </button>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────────── */

function formatIDRCompact(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function deltaLabel(delta: number | null) {
  if (delta === null) return "Pertama kali bulan ini";
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta}% vs bulan lalu`;
}

function deltaColor(delta: number | null) {
  if (delta === null) return "text-slate-500";
  return delta >= 0 ? "text-emerald-400" : "text-rose-400";
}

/* ────────────────────────────────────────────────────────────────────
   Pendapatan History Modal
   ──────────────────────────────────────────────────────────────────── */

type HistoriItem = {
  id: string;
  role: string;
  pendapatan: number;
  kode: string;
  status: string;
  tanggal: string;
  alamat: string;
  foto: string;
};

function roleLabel(raw: string): string {
  const key = raw.toUpperCase().replace(/[\s-]/g, "_");
  const map: Record<string, string> = {
    MGMT_FUND1: "Management Fund 1",
    MGMT_FUND2: "Management Fund 2",
    MGMT_FUND3: "Management Fund 3",
    MGMT: "Management",
    PRINC: "Principal",
    PRINCIPAL: "Principal",
    INV: "Investor",
    INVESTOR: "Investor",
    CONS: "Consultant",
    CONSULTANT: "Consultant",
    PROMO: "Promotion",
    PROMOTION: "Promotion",
    UP_1: "Upline 1",
    UP_2: "Upline 2",
    UPLINE_1: "Upline 1",
    UPLINE_2: "Upline 2",
    THC: "Take Home Pay",
    THC_AGENT: "Take Home Pay",
    EMP: "Employee Incentive",
    EMPLOYEE: "Employee Incentive",
    AGENT: "Agent",
    COBROKE: "Co-Broke",
  };
  return map[key] ?? raw;
}

const STATUS_LABEL: Record<string, string> = {
  SELESAI: "Selesai",
  CLOSING: "Closing",
  AJB: "AJB",
  VERIFIKASI_DOKUMEN: "Verif. Dok",
  PENGURUSAN_DOKUMEN: "Urus Dok",
  EKSEKUSI_PENGOSONGAN: "Pengosongan",
  BATAL: "Batal",
};

const STATUS_COLOR: Record<string, string> = {
  SELESAI: "bg-emerald-500/15 text-emerald-300 border-emerald-400/25",
  CLOSING: "bg-violet-500/15 text-violet-300 border-violet-400/25",
  BATAL: "bg-rose-500/15 text-rose-300 border-rose-400/25",
  AJB: "bg-sky-500/15 text-sky-300 border-sky-400/25",
};

function PendapatanModal({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<HistoriItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/agent/pendapatan-histori")
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok && json.data) {
          setItems(json.data);
          setTotal(json.totalPendapatan ?? 0);
        } else {
          setError(json?.message ?? "Gagal memuat data");
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Gagal terhubung ke server");
        setLoading(false);
      });
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-[#0d1a14] to-[#070a0b] shadow-[0_0_0_1px_rgba(52,211,153,0.12),0_40px_120px_rgba(0,0,0,0.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* top hairline glow */}
        <div className="pointer-events-none absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

        {/* header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Histori Pendapatan</h2>
            {!loading && !error && (
              <p className="text-[11px] text-slate-500 mt-0.5">
                {items.length} transaksi · Total {formatIDRCompact(total)}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            type="button"
            aria-label="Tutup"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.05] text-slate-300 transition hover:border-rose-400/30 hover:bg-rose-500/15 hover:text-rose-200"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M1 1 L13 13 M13 1 L1 13" />
            </svg>
          </button>
        </div>

        {/* total strip */}
        {!loading && !error && items.length > 0 && (
          <div className="mx-4 mb-3 flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.07] px-4 py-2.5">
            <Icon icon="solar:wallet-money-bold-duotone" className="text-xl text-emerald-300 flex-shrink-0" />
            <div className="flex-1 leading-tight">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Total Pendapatanmu</p>
              <p className="text-sm font-extrabold text-emerald-200">{formatIDRCompact(total)}</p>
            </div>
          </div>
        )}

        {/* list */}
        <div className="max-h-[380px] overflow-y-auto px-4 pb-5 space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded-xl bg-white/[0.04] animate-pulse" />
            ))
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-10 text-rose-400">
              <Icon icon="solar:danger-bold-duotone" className="text-4xl mb-2" />
              <p className="text-sm">{error}</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-500">
              <Icon icon="solar:inbox-bold-duotone" className="text-4xl mb-2 text-slate-600" />
              <p className="text-sm">Belum ada data pendapatan</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 hover:bg-white/[0.05] transition"
              >
                {/* foto properti */}
                <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.04]">
                  {item.foto ? (
                    <img src={item.foto} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Icon icon="solar:home-2-bold-duotone" className="text-base text-slate-600" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white">{roleLabel(item.role)}</p>
                  <p className="truncate text-[11px] text-slate-500">{item.alamat || item.kode}</p>
                </div>

                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-bold text-emerald-300">{formatIDRCompact(item.pendapatan)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   1. KPI STRIP — 4 uniform premium tiles (futuristic)
   ──────────────────────────────────────────────────────────────────── */

type KpiAccent = "emerald" | "violet" | "sky" | "amber";

const KPI_ACCENT: Record<
  KpiAccent,
  {
    base: string;
    orb: string;
    hairline: string;
    iconGrad: string;
    iconRing: string;
    iconShadow: string;
    valueGrad: string;
    chipBg: string;
    chipBorder: string;
    chipText: string;
    glow: string;
    primary: string;
    bottomGlow: string;
    hoverText: string;
  }
> = {
  emerald: {
    base: "linear-gradient(135deg, rgba(6,95,70,0.28) 0%, rgba(7,14,12,0.92) 55%, rgba(7,10,11,1) 100%)",
    orb: "radial-gradient(circle, rgba(52,211,153,0.38) 0%, transparent 65%)",
    hairline: "via-emerald-400/50",
    iconGrad: "linear-gradient(135deg, #34d399, #059669)",
    iconRing: "ring-emerald-300/25",
    iconShadow: "shadow-[0_10px_28px_-10px_rgba(16,185,129,0.65)]",
    valueGrad: "from-white via-white to-emerald-100",
    chipBg: "bg-emerald-500/15",
    chipBorder: "border-emerald-400/30",
    chipText: "text-emerald-300",
    glow: "rgba(52,211,153,0.28)",
    primary: "#34d399",
    bottomGlow: "via-emerald-400/25",
    hoverText: "group-hover:text-emerald-300",
  },
  violet: {
    base: "linear-gradient(135deg, rgba(76,29,149,0.30) 0%, rgba(11,9,22,0.92) 55%, rgba(7,10,11,1) 100%)",
    orb: "radial-gradient(circle, rgba(167,139,250,0.38) 0%, transparent 65%)",
    hairline: "via-violet-400/50",
    iconGrad: "linear-gradient(135deg, #a78bfa, #7c3aed)",
    iconRing: "ring-violet-300/25",
    iconShadow: "shadow-[0_10px_28px_-10px_rgba(139,92,246,0.65)]",
    valueGrad: "from-white via-white to-violet-100",
    chipBg: "bg-violet-500/15",
    chipBorder: "border-violet-400/30",
    chipText: "text-violet-300",
    glow: "rgba(167,139,250,0.28)",
    primary: "#a78bfa",
    bottomGlow: "via-violet-400/25",
    hoverText: "group-hover:text-violet-300",
  },
  sky: {
    base: "linear-gradient(135deg, rgba(7,89,133,0.30) 0%, rgba(8,14,22,0.92) 55%, rgba(7,10,11,1) 100%)",
    orb: "radial-gradient(circle, rgba(56,189,248,0.38) 0%, transparent 65%)",
    hairline: "via-sky-400/50",
    iconGrad: "linear-gradient(135deg, #38bdf8, #0284c7)",
    iconRing: "ring-sky-300/25",
    iconShadow: "shadow-[0_10px_28px_-10px_rgba(14,165,233,0.65)]",
    valueGrad: "from-white via-white to-sky-100",
    chipBg: "bg-sky-500/15",
    chipBorder: "border-sky-400/30",
    chipText: "text-sky-300",
    glow: "rgba(56,189,248,0.28)",
    primary: "#38bdf8",
    bottomGlow: "via-sky-400/25",
    hoverText: "group-hover:text-sky-300",
  },
  amber: {
    base: "linear-gradient(135deg, rgba(146,64,14,0.30) 0%, rgba(22,14,8,0.92) 55%, rgba(7,10,11,1) 100%)",
    orb: "radial-gradient(circle, rgba(251,191,36,0.38) 0%, transparent 65%)",
    hairline: "via-amber-400/50",
    iconGrad: "linear-gradient(135deg, #fbbf24, #d97706)",
    iconRing: "ring-amber-300/25",
    iconShadow: "shadow-[0_10px_28px_-10px_rgba(245,158,11,0.65)]",
    valueGrad: "from-white via-white to-amber-100",
    chipBg: "bg-amber-500/15",
    chipBorder: "border-amber-400/30",
    chipText: "text-amber-300",
    glow: "rgba(251,191,36,0.28)",
    primary: "#fbbf24",
    bottomGlow: "via-amber-400/25",
    hoverText: "group-hover:text-amber-300",
  },
};

/* — Smooth count-up animation for numeric values.
   Re-animates from previous target to new target whenever target changes. */
function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const lastTargetRef = useRef(0);

  useEffect(() => {
    const from = lastTargetRef.current;
    const to = target;
    lastTargetRef.current = target;
    if (from === to) {
      setValue(to);
      return;
    }
    const startTime = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const p = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setValue(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

/* — Animated delta pill with 3 mutually-exclusive variants for the top-right slot:
     1. delta != null    → count-up percentage (YoY/MoM trend)
     2. achievement      → celebratory pill (e.g. YTD total, never zero)
     3. firstLabel       → "BARU" badge for first-period cases (no comparison yet)
   Priority is delta > achievement > firstLabel. */
function AnimatedDeltaPill({
  delta,
  accent,
  firstLabel,
  achievement,
}: {
  delta: number | null;
  accent: KpiAccent;
  firstLabel?: string;
  achievement?: { icon?: string; label: string };
}) {
  const A = KPI_ACCENT[accent];
  const target = delta === null ? 0 : Math.abs(delta);
  const animated = useCountUp(target);

  // Nothing to render
  if (delta === null && !firstLabel && !achievement) return null;

  // ── Variant 2: achievement (celebratory, e.g. "3 di 2026") ──
  if (delta === null && achievement) {
    return (
      <span
        className={`relative inline-flex items-center gap-1 overflow-hidden rounded-xl border px-2.5 py-1 text-[10px] font-extrabold tabular-nums backdrop-blur-sm ${A.chipBg} ${A.chipBorder} ${A.chipText}`}
        style={{ boxShadow: `0 0 18px -4px ${A.glow}` }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-1 rounded-2xl blur-md animate-kpi-halo"
          style={{ background: A.glow }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent animate-kpi-shine"
        />
        <Icon
          icon={achievement.icon ?? "solar:cup-star-bold-duotone"}
          className="relative z-10 text-[11px] animate-kpi-arrow"
        />
        <span className="relative z-10">{achievement.label}</span>
      </span>
    );
  }

  // ── Variant 3: first-period badge (no comparison possible yet) ──
  if (delta === null && firstLabel) {
    return (
      <span
        className={`relative inline-flex items-center gap-1 overflow-hidden rounded-xl border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider backdrop-blur-sm ${A.chipBg} ${A.chipBorder} ${A.chipText}`}
        style={{ boxShadow: `0 0 18px -4px ${A.glow}` }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-1 rounded-2xl blur-md animate-kpi-halo"
          style={{ background: A.glow }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent animate-kpi-shine"
        />
        <Icon
          icon="solar:stars-bold-duotone"
          className="relative z-10 text-[11px] animate-kpi-arrow"
        />
        <span className="relative z-10">{firstLabel}</span>
      </span>
    );
  }

  // ── Variant 2: YoY/MoM delta with count-up ──
  const isUp = (delta as number) >= 0;
  const palette = isUp
    ? {
        border: A.chipBorder,
        bg: A.chipBg,
        text: A.chipText,
        glow: A.glow,
      }
    : {
        border: "border-rose-400/30",
        bg: "bg-rose-500/15",
        text: "text-rose-300",
        glow: "rgba(244, 63, 94, 0.32)",
      };

  return (
    <span
      className={`relative inline-flex items-center gap-1 overflow-hidden rounded-xl border px-2.5 py-1 text-[10px] font-extrabold tabular-nums backdrop-blur-sm ${palette.bg} ${palette.border} ${palette.text}`}
      style={{ boxShadow: `0 0 18px -4px ${palette.glow}` }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-1 rounded-2xl blur-md animate-kpi-halo"
        style={{ background: palette.glow }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent animate-kpi-shine"
      />
      <Icon
        icon={isUp ? "solar:arrow-up-bold" : "solar:arrow-down-bold"}
        className="relative z-10 text-[10px] animate-kpi-arrow"
      />
      <span className="relative z-10">{animated.toFixed(1)}%</span>
    </span>
  );
}

type PremiumKpiTileProps = {
  accent: KpiAccent;
  icon: string;
  label: string;
  value: string | null;
  sublabel?: string | null;
  delta?: number | null;
  /** Shown in the pill area when delta is null (first-period case) */
  firstLabel?: string;
  /** Achievement chip rendered just below sublabel — celebratory context
   *  (e.g. YTD total) that should never be used as a comparison or
   *  show demotivating zeros. */
  achievement?: { icon?: string; label: string };
  onClick?: () => void;
  clickHint?: string;
  loading?: boolean;
};

function PremiumKpiTile({
  accent,
  icon,
  label,
  value,
  sublabel,
  delta,
  firstLabel,
  achievement,
  onClick,
  clickHint,
  loading,
}: PremiumKpiTileProps) {
  const A = KPI_ACCENT[accent];
  const interactive = !!onClick;

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick!();
              }
            }
          : undefined
      }
      style={
        {
          background: A.base,
          "--kpi-glow": A.glow,
          // Aktifkan container query agar font value di body bisa fluid
          // ngikuti lebar tile actual (mencegah crop angka panjang).
          containerType: "inline-size",
        } as React.CSSProperties
      }
      className={[
        "group relative flex h-full min-h-[160px] flex-col overflow-hidden rounded-3xl border border-white/[0.08] p-3 backdrop-blur-xl transition-all duration-500 sm:min-h-[180px] sm:p-6",
        interactive
          ? "cursor-pointer select-none hover:-translate-y-1 hover:border-white/[0.2] hover:shadow-[0_24px_60px_-20px_var(--kpi-glow)] active:translate-y-0 active:scale-[0.99]"
          : "hover:border-white/[0.14]",
      ].join(" ")}
    >
      {/* Top hairline */}
      <div
        className={`pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent ${A.hairline} to-transparent`}
      />

      {/* Ambient orb */}
      <div
        className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full blur-2xl transition-all duration-700 group-hover:scale-125 group-hover:blur-3xl"
        style={{ background: A.orb }}
      />

      {/* Subtle grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Diagonal scan-line shimmer on hover */}
      <div className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent opacity-0 transition-all duration-1000 ease-out group-hover:left-[120%] group-hover:opacity-100" />

      {/* HEADER — icon + delta chip */}
      <div className="relative flex items-start justify-between gap-2">
        <div
          className={`relative flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${A.iconRing} ${A.iconShadow} transition-transform duration-500 group-hover:scale-110 group-hover:rotate-[4deg]`}
          style={{ background: A.iconGrad }}
        >
          <Icon icon={icon} className="relative z-10 text-xl text-white drop-shadow" />
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/30 to-transparent opacity-60" />
          <div className="pointer-events-none absolute inset-1 rounded-xl ring-1 ring-white/15" />
        </div>

        {!loading && (delta != null || firstLabel || achievement) && (
          <AnimatedDeltaPill
            delta={delta ?? null}
            accent={accent}
            firstLabel={firstLabel}
            achievement={achievement}
          />
        )}
      </div>

      {/* BODY */}
      <div className="relative mt-5 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
          {label}
        </p>

        {loading ? (
          <>
            <div className="mt-3 h-9 w-3/4 animate-pulse rounded-lg bg-white/[0.08]" />
            <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-white/[0.05]" />
          </>
        ) : (
          <>
            <p
              className={`mt-2 whitespace-nowrap bg-gradient-to-br ${A.valueGrad} bg-clip-text font-extrabold leading-none tracking-tight text-transparent tabular-nums`}
              style={{
                // Fluid sizing: 9% lebar tile, clamp di 16px–32px.
                // Untuk tile ~280px → ~25px; untuk angka panjang
                // (Rp 252.106.800), tetap fit tanpa crop. Tile sempit
                // di mobile pakai floor 16px supaya tetap readable.
                fontSize: "clamp(1rem, 9cqw, 2rem)",
              }}
            >
              {value}
            </p>
            {sublabel && (
              <p className="mt-2 line-clamp-1 text-[11px] font-medium text-slate-500">
                {sublabel}
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex-1" />

      {/* BOTTOM CTA hint + decorative dashed arc */}
      {interactive && clickHint && (
        <div className="relative mt-5 flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 transition-colors duration-300 ${A.hoverText}`}
          >
            {clickHint}
            <Icon
              icon="solar:alt-arrow-right-bold"
              className="text-[10px] transition-transform duration-300 group-hover:translate-x-1"
            />
          </span>
          <svg
            width="46"
            height="14"
            viewBox="0 0 46 14"
            className="opacity-40 transition-opacity duration-500 group-hover:opacity-100"
          >
            <path
              d="M0 13 Q 23 0, 46 13"
              stroke={A.primary}
              strokeWidth="1"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="2 3"
            />
          </svg>
        </div>
      )}

      {/* Bottom hairline */}
      <div
        className={`pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent ${A.bottomGlow} to-transparent opacity-50`}
      />
    </div>
  );
}

/* — Specialized tiles — */

type KpiProps = { loading: boolean; data: ReturnType<typeof useAgentKpiCards>["data"] };

function PendapatanTile({ loading, data }: KpiProps) {
  const [showModal, setShowModal] = useState(false);

  const value = loading ? null : formatIDRCompact(data?.totalPendapatan ?? 0);
  const delta = loading ? null : data?.pendapatanDelta ?? null;
  const tahunIni = data?.pendapatanTahunIni ?? 0;
  const tahunLalu = data?.pendapatanTahunLalu ?? 0;
  const currentYear = new Date().getFullYear();

  // YoY context sublabel — kasih referensi absolut tahun lalu supaya pill % bermakna
  const sublabel = loading
    ? null
    : tahunLalu > 0
    ? `Tahun lalu ${formatIDRCompact(tahunLalu)}`
    : tahunIni > 0
    ? `Pertama kali di ${currentYear}`
    : "Belum ada pendapatan";

  // Belum ada data tahun lalu untuk dibandingkan → tampilkan badge "TAHUN BARU"
  const firstLabel =
    !loading && delta === null && tahunIni > 0 ? "Tahun Baru" : undefined;

  return (
    <>
      {showModal && <PendapatanModal onClose={() => setShowModal(false)} />}
      <PremiumKpiTile
        accent="emerald"
        icon="solar:wallet-money-bold-duotone"
        label="Total Pendapatan"
        value={value}
        sublabel={sublabel}
        delta={delta}
        firstLabel={firstLabel}
        onClick={() => setShowModal(true)}
        clickHint="Lihat Histori"
        loading={loading}
      />
    </>
  );
}

function TransaksiTile({ loading, data }: KpiProps) {
  const router = useRouter();
  const bulanIni = data?.transaksiBulanIni ?? 0;
  const bulanLalu = data?.transaksiBulanLalu ?? 0;
  const ytd = data?.transaksiTahunIni ?? 0;
  const currentYear = new Date().getFullYear();
  const delta =
    bulanLalu > 0 ? ((bulanIni - bulanLalu) / bulanLalu) * 100 : null;

  // YTD achievement chip — di slot kanan-atas, menggantikan "BULAN BARU".
  // Hanya muncul kalau > 0 supaya gak demotivasi (no "0 di 2026").
  // Label dibuat ringkas supaya muat di tile sempit mobile.
  const achievement =
    !loading && ytd > 0 ? { label: `${ytd} di ${currentYear}` } : undefined;

  return (
    <PremiumKpiTile
      accent="violet"
      icon="solar:medal-star-bold-duotone"
      label="Total Transaksi"
      value={loading ? null : (data?.totalTransaksi ?? 0).toLocaleString("id-ID")}
      sublabel={loading ? null : `${bulanIni} bln ini · ${bulanLalu} bln lalu`}
      delta={loading ? null : delta}
      achievement={achievement}
      onClick={() => router.push("/dashboard/transaksi?tab=progress")}
      clickHint="Lihat Progress"
      loading={loading}
    />
  );
}

function ListingTile({ loading, data }: KpiProps) {
  const router = useRouter();
  return (
    <PremiumKpiTile
      accent="sky"
      icon="solar:home-2-bold-duotone"
      label="Total Listing"
      value={loading ? null : (data?.totalListing ?? 0).toLocaleString("id-ID")}
      sublabel={loading ? null : "Properti aktif kamu"}
      onClick={() => router.push("/dashboard/listings")}
      clickHint="Kelola Listing"
      loading={loading}
    />
  );
}

/** Smoothly scrolls the user from anywhere on the dashboard to the Hot Leads
 *  card and triggers a brief "arrival" pulse on it. Uses scrollIntoView so
 *  the right scroll container is picked automatically (the dashboard layout
 *  has its own overflow-y-auto wrapper, so window.scrollTo would be a no-op).
 *  Breathing room above the card is handled via `scroll-mt-24` on the target.
 *  A short sonner toast confirms what just happened in words for novice users
 *  ("kenapa halaman ini mendadak geser?"). */
function scrollToHotLeads() {
  if (typeof window === "undefined") return;
  const el = document.getElementById("hot-leads-card");
  if (!el) return;

  // scrollIntoView walks up the DOM and scrolls whatever ancestor is the
  // actual scroller — works inside the dashboard's flex/overflow layout.
  el.scrollIntoView({ behavior: "smooth", block: "start" });

  // Brief textual confirmation — auto-dismisses, non-blocking.
  toast("Menampilkan Hot Leads kamu", {
    description: "Antrian follow-up yang perlu kamu hubungi.",
    duration: 2200,
  });

  // Pulse highlight on arrival (roughly when smooth scroll settles).
  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent("hot-leads:focus"));
  }, 600);
}

function LeadsTile({ loading, data }: KpiProps) {
  const bulanIni = data?.leadBulanIni ?? 0;
  const bulanLalu = data?.leadBulanLalu ?? 0;
  const rawDelta = loading ? null : data?.leadDelta ?? null;

  // Convention "growth from zero" — kalau bulan lalu 0 tapi bulan ini > 0,
  // pakai +100% sebagai placeholder (konvensi industri analitik).
  // Selain itu, raw delta dari API langsung dipakai.
  const delta =
    rawDelta === null && bulanIni > 0 && bulanLalu === 0 ? 100 : rawDelta;

  return (
    <PremiumKpiTile
      accent="amber"
      icon="solar:users-group-rounded-bold-duotone"
      label="Total Leads"
      value={loading ? null : (data?.totalLeads ?? 0).toLocaleString("id-ID")}
      sublabel={loading ? null : `${bulanIni} bln ini · ${bulanLalu} bln lalu`}
      delta={delta}
      onClick={scrollToHotLeads}
      clickHint="Lihat Hot Leads"
      loading={loading}
    />
  );
}

/* — Standalone Penjualan card (was nested in CombinedRevenueCard) — */

function PenjualanCard() {
  // Card sengaja natural-height (TANPA h-full) supaya:
  //   1. Tidak ada blank space di bawah section ketika content lebih
  //      pendek dari row height.
  //   2. Penjualan jadi penentu row height grid (= intrinsic-nya).
  //      Performa Listing yang menyesuaikan ke tinggi ini via h-full
  //      chain — list internal-nya scroll kalau content overflow.
  // Supaya skenario ini bekerja, list di ListingPerformanceCard
  // di-render dengan absolute positioning supaya intrinsic Listing
  // kecil dan tidak ngalahin Penjualan di grid row sizing.
  return (
    <Card>
      <TotalPenjualanSection />
    </Card>
  );
}


/* ────────────────────────────────────────────────────────────────────
   2. TOTAL PENJUALAN TAHUNAN (premium, interactive)
   ──────────────────────────────────────────────────────────────────── */

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
const MONTH_LONG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const EMPTY_YEAR: number[] = Array(12).fill(0);

/* ────────────────────────────────────────────────────────────────────
   Hook: ambil data total penjualan agent dari
   /api/dashboard/agent/total-penjualan.
   Kontrak response disinkronkan dengan handler API. Nilai per bulan
   sudah dalam satuan JUTA Rupiah, jadi langsung bisa dipakai oleh
   formatJutaCurrency / formatJutaShort yang sudah ada.
   ──────────────────────────────────────────────────────────────────── */
type TotalPenjualanData = {
  ok: true;
  current_year: number;
  available_years: number[];
  monthly_by_year: Record<string, number[]>;
};

type TotalPenjualanState = {
  loading: boolean;
  error: string | null;
  data: TotalPenjualanData | null;
};

function useTotalPenjualan(): TotalPenjualanState {
  const [state, setState] = useState<TotalPenjualanState>({
    loading: true,
    error: null,
    data: null,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/dashboard/agent/total-penjualan", {
          cache: "no-store",
        });
        const json = await res.json();
        if (!alive) return;
        if (!res.ok || !json?.ok) {
          throw new Error(json?.message || `HTTP ${res.status}`);
        }
        setState({ loading: false, error: null, data: json });
      } catch (e) {
        if (!alive) return;
        setState({
          loading: false,
          error: e instanceof Error ? e.message : "Gagal memuat data",
          data: null,
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return state;
}

/* ────────────────────────────────────────────────────────────────────
   Formatters — semua input dalam satuan JUTA Rupiah.
   ── Kontrak:
      • v >= 1000     → render dalam Miliar ("1,5 M" / "Rp 1,52 M")
      • v >= 10       → render integer juta ("520 jt" / "Rp 520 Jt")
      • 1 <= v < 10   → render desimal 1 angka ("1,5 jt") supaya angka
                        kecil tidak dibuang oleh Math.round (1.5→2 dulu)
      • 0 < v < 1     → render dalam Ribu ("500 rb" / "Rp 500 Rb"),
                        karena nampilin "0,5 jt" awkward & nyaring kecil.
                        Sangat penting buat agent yang baru pertama dapat
                        komisi 500rb–900rb — angkanya tetap kelihatan
                        substansial di chart & stat tile.
      • v <= 0        → render "0" / "Rp 0"
   ── Pakai toLocaleString("id-ID") supaya separator pakai titik-koma ID.
   ──────────────────────────────────────────────────────────────────── */

function formatJutaShort(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "0";
  if (v >= 1000) {
    return `${(v / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
  }
  if (v >= 10) return `${Math.round(v).toLocaleString("id-ID")} jt`;
  if (v >= 1) {
    return `${v.toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  }
  // 0 < v < 1 juta → konversi ke ribu (v×1000), bulatin
  return `${Math.round(v * 1000).toLocaleString("id-ID")} rb`;
}

function formatJutaCurrency(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "Rp 0";
  if (v >= 1000) {
    return `Rp ${(v / 1000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`;
  }
  if (v >= 10) {
    return `Rp ${Math.round(v).toLocaleString("id-ID")} Jt`;
  }
  if (v >= 1) {
    return `Rp ${v.toLocaleString("id-ID", { maximumFractionDigits: 1 })} Jt`;
  }
  return `Rp ${Math.round(v * 1000).toLocaleString("id-ID")} Rb`;
}

function YearPicker({
  value,
  options,
  onChange,
}: {
  value: number;
  options: number[];
  onChange: (y: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // pos = anchor untuk panel di koordinat viewport. Pakai posisi fixed
  // via portal ke document.body supaya escape dari overflow-hidden Card.
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const idx = options.indexOf(value);
  const canPrev = idx < options.length - 1;
  const canNext = idx > 0;

  // Portal butuh document — SSR guard. Mount setelah hydration supaya
  // tidak mismatch.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Hitung posisi panel relatif ke trigger setiap kali dibuka. Pakai
  // useLayoutEffect supaya measurement terjadi sebelum browser paint,
  // jadi panel langsung muncul di posisi benar tanpa flicker.
  useLayoutEffect(() => {
    if (!open) return;
    const el = triggerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    };
    measure();
    // Reposisi kalau viewport berubah saat panel terbuka.
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  return (
    <div className="relative flex items-center gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1 backdrop-blur-md">
      <button
        type="button"
        disabled={!canPrev}
        onClick={() => canPrev && onChange(options[idx + 1])}
        className="flex h-7 w-7 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/[0.06] hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
        aria-label="Tahun sebelumnya"
      >
        <Icon icon="solar:alt-arrow-left-bold" className="text-base" />
      </button>

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold tracking-wide text-white transition hover:bg-emerald-500/10 hover:text-emerald-200"
      >
        <Icon icon="solar:calendar-bold-duotone" className="text-sm text-emerald-300" />
        <span className="tabular-nums">{value}</span>
        <Icon
          icon="solar:alt-arrow-down-bold"
          className={`text-[10px] text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <button
        type="button"
        disabled={!canNext}
        onClick={() => canNext && onChange(options[idx - 1])}
        className="flex h-7 w-7 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/[0.06] hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
        aria-label="Tahun berikutnya"
      >
        <Icon icon="solar:alt-arrow-right-bold" className="text-base" />
      </button>

      {/* Dropdown panel — di-portal ke <body> supaya escape dari
          overflow-hidden + stacking context Card. Tanpa portal, panel
          ke-clip secara visual dan area klik-nya bisa ke-block oleh
          ancestor element. */}
      {open && mounted && pos &&
        createPortal(
          <>
            {/* Scrim full-viewport — buat catch click di luar panel. */}
            <div
              className="fixed inset-0 z-[1000]"
              onClick={() => setOpen(false)}
            />

            {/* iOS-style frosted glass panel:
                • Solid dark base (#0c1217) di-overlay backdrop-blur +
                  saturate biar tetap kebaca tanpa transparansi yang
                  bocor.
                • Inner highlight + ring putih halus = edge "kaca" yang
                  nangkep cahaya.
                • Outer shadow gelap = kesan ngambang.
                • position fixed dengan koordinat dari trigger ref. */}
            <div
              className="fixed z-[1001] w-44 overflow-hidden rounded-2xl border border-white/[0.14] p-1 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.05),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-2xl backdrop-saturate-150"
              style={{
                top: pos.top,
                right: pos.right,
                // Background pakai inline-style supaya bisa stack
                // gradient overlay di atas warna dasar. /92 cukup
                // solid biar konten di belakang gak bocor terbaca.
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 40%), rgba(12,18,23,0.92)",
              }}
            >
              <div className="px-2.5 pt-1.5 pb-1 text-[9.5px] font-bold uppercase tracking-[0.22em] text-slate-500">
                Pilih Tahun
              </div>
              <div className="my-1 h-px bg-white/[0.06]" />
              {options.map((y) => {
                const active = y === value;
                return (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      onChange(y);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-[12px] font-bold tracking-wide transition ${
                      active
                        ? "bg-gradient-to-r from-emerald-500/25 to-emerald-500/[0.1] text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_18px_-6px_rgba(52,211,153,0.5)]"
                        : "text-slate-200 hover:bg-white/[0.07] hover:text-white"
                    }`}
                  >
                    <span className="tabular-nums">{y}</span>
                    {active && (
                      <Icon
                        icon="solar:check-circle-bold"
                        className="text-[14px] text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   TotalPenjualanSection — modern futuristic dashboard untuk total komisi
   tahun aktif. Info yang di-deliver ke agent (top→bottom):
     • Hero: angka besar dengan count-up animation + delta YoY chip,
       baris kecil delta absolut & nilai pembanding (auto = tahun n-1).
     • Stat duo: Puncak (bulan terbaik) + Avg/Bulan, dengan delta YoY
       per metrik di chip sudut kanan.
     • Quarter breakdown: Q1–Q4 horizontal dual-bar (current emerald
       glow + previous slate underline) + delta pill per kuartal.
     • Chart line (smooth area) selalu tampil — current solid emerald,
       previous dashed slate, tap di mobile membuat tooltip nempel.
   Comparison di-fix ke n-1 (tahun lalu) supaya hierarchy info clear,
   tidak ada toggle / mode switcher.
   ──────────────────────────────────────────────────────────────────── */

const QUARTER_LABELS: [string, [number, number, number]][] = [
  ["Q1", [0, 1, 2]],
  ["Q2", [3, 4, 5]],
  ["Q3", [6, 7, 8]],
  ["Q4", [9, 10, 11]],
];

function deltaPct(cur: number, prev: number): number | null {
  if (prev <= 0) return cur > 0 ? 100 : null;
  return ((cur - prev) / prev) * 100;
}

/** Crypto-style mini delta pill (▲/▼ + %). Pakai accent emerald untuk
 *  positif, rose untuk negatif, slate untuk null/zero — meniru pola
 *  Binance/Stockbit yang konsisten warna delta di seluruh UI. */
function DeltaPill({
  pct,
  size = "sm",
}: {
  pct: number | null;
  size?: "xs" | "sm";
}) {
  if (pct === null) {
    return (
      <span
        className={`inline-flex items-center gap-0.5 rounded-md border border-white/[0.06] bg-white/[0.03] text-slate-500 tabular-nums ${
          size === "xs" ? "px-1 py-0 text-[9px]" : "px-1.5 py-0.5 text-[10px]"
        }`}
      >
        —
      </span>
    );
  }
  const positive = pct >= 0;
  const cls = positive
    ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
    : "border-rose-400/25 bg-rose-500/10 text-rose-300";
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md border tabular-nums font-bold ${cls} ${
        size === "xs" ? "px-1 py-0 text-[9px]" : "px-1.5 py-0.5 text-[10px]"
      }`}
    >
      <Icon
        icon={positive ? "solar:arrow-up-bold" : "solar:arrow-down-bold"}
        className={size === "xs" ? "text-[9px]" : "text-[10px]"}
      />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

/** Stat tile premium: gradient ring outline, hex-grid bg texture,
 *  ambient orb pinggir. Dipakai untuk Puncak + Avg/Bulan. Tidak
 *  pakai container query agar layout konsisten di kolom 2/3 width. */
function PremiumStat({
  icon,
  iconGrad,
  iconRing,
  iconShadow,
  label,
  value,
  subLabel,
  delta,
  orb,
}: {
  icon: string;
  iconGrad: string;
  iconRing: string;
  iconShadow: string;
  label: string;
  value: string;
  subLabel?: string;
  delta?: number | null;
  orb: string;
}) {
  return (
    <div className="group relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.045] via-white/[0.01] to-transparent px-3 py-2.5 transition hover:border-white/[0.14] hover:-translate-y-[1px]">
      {/* Ambient orb */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-2xl opacity-70 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: orb }}
      />
      {/* hex-style faint grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      />
      {/* shimmer on hover */}
      <div className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent opacity-0 transition-all duration-1000 ease-out group-hover:left-[120%] group-hover:opacity-100" />

      {/* Layout horizontal: icon besar di kiri, kolom teks di kanan
          dengan label / value+pill / sub. Delta pill sekarang INLINE
          di samping value — supaya label sepanjang apapun
          ("RATA-RATA PER BULAN") tidak akan pernah nabrak pill, dan
          pill selalu sejajar dengan angka biar mata langsung ngerti
          "850 jt naik 31.9%". */}
      <div className="relative flex items-center gap-3">
        <div
          className={`relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl ring-1 ${iconRing} ${iconShadow} transition-transform duration-500 group-hover:scale-110`}
          style={{ background: iconGrad }}
        >
          <Icon icon={icon} className="text-2xl text-white drop-shadow" />
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/30 to-transparent opacity-50" />
          <div className="pointer-events-none absolute inset-1 rounded-xl ring-1 ring-white/15" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[9.5px] font-bold uppercase tracking-[0.22em] text-slate-500">
            {label}
          </p>
          <div className="mt-0.5 flex items-baseline gap-2">
            <p className="truncate bg-gradient-to-br from-white to-emerald-100/80 bg-clip-text text-[20px] font-extrabold leading-tight tracking-tight text-transparent tabular-nums">
              {value}
            </p>
            {delta !== undefined && (
              <span className="flex-shrink-0">
                <DeltaPill pct={delta} size="xs" />
              </span>
            )}
          </div>
          {subLabel && (
            <p className="truncate text-[10px] font-medium text-slate-500 tabular-nums">
              {subLabel}
            </p>
          )}
        </div>
      </div>

      {/* bottom hairline glow */}
      <div className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </div>
  );
}

function TotalPenjualanSection() {
  const { loading, error, data } = useTotalPenjualan();

  // Daftar tahun yang punya data + fallback ke current_year supaya
  // YearPicker tetap fungsional saat agent belum punya transaksi sama
  // sekali (kondisi "first-time", agent baru join).
  const availableYears = useMemo(() => {
    if (!data) return [];
    if (data.available_years.length > 0) return data.available_years;
    return [data.current_year];
  }, [data]);

  const defaultYear = availableYears[0] ?? new Date().getFullYear();
  const [year, setYear] = useState<number>(defaultYear);

  // Sync ulang `year` ke tahun terbaru saat data baru selesai loading.
  // Kalau user sebelumnya pilih tahun X yang ternyata tidak ada di data
  // (race condition), fall-back ke tahun terbaru. Pakai effect supaya
  // tidak nge-fight dengan user input setelah data settled.
  useEffect(() => {
    if (!data) return;
    if (!availableYears.includes(year)) {
      setYear(availableYears[0] ?? data.current_year);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Comparison fix ke tahun n-1. Kalau n-1 tidak punya data, kita
  // tetap tampilkan label `year-1` tapi array-nya nol — supaya garis
  // putus pembanding tetap ada (di y=0) dan delta pill nampilin "—"
  // (deltaPct null saat prev<=0). Ini lebih jujur daripada misleading
  // user dengan "membandingkan ke tahun lain yang random".
  const compareYear = year - 1;

  const getYearArr = (y: number): number[] =>
    data?.monthly_by_year[String(y)] ?? EMPTY_YEAR;

  const cur = getYearArr(year);
  const prev = getYearArr(compareYear);

  const totalCur = useMemo(() => cur.reduce((a, b) => a + b, 0), [cur]);
  const totalPrev = useMemo(() => prev.reduce((a, b) => a + b, 0), [prev]);
  const animatedTotal = useCountUp(totalCur);

  const deltaAbs = totalCur - totalPrev;
  const delta = deltaPct(totalCur, totalPrev);
  const positive = (delta ?? 0) >= 0;

  // Peak month untuk tahun aktif + tahun pembanding (untuk YoY peak)
  const peakIdx = cur.indexOf(Math.max(...cur));
  const peakValCur = cur[peakIdx] ?? 0;
  const peakValPrev = prev[peakIdx] ?? 0;
  const peakDelta = deltaPct(peakValCur, peakValPrev);

  const activeMonths = cur.filter((v) => v > 0).length;
  const activePrev = prev.filter((v) => v > 0).length;
  const avgPerMonth = activeMonths > 0 ? totalCur / activeMonths : 0;
  const avgPrev = activePrev > 0 ? totalPrev / activePrev : 0;
  const avgDelta = deltaPct(avgPerMonth, avgPrev);

  // Quarter breakdown — 4 kuartal × (cur, prev, delta)
  const quarters = useMemo(
    () =>
      QUARTER_LABELS.map(([label, idxs]) => {
        const c = idxs.reduce((a, i) => a + (cur[i] ?? 0), 0);
        const p = idxs.reduce((a, i) => a + (prev[i] ?? 0), 0);
        return { label, cur: c, prev: p, delta: deltaPct(c, p) };
      }),
    [cur, prev],
  );
  const maxQuarter = Math.max(...quarters.map((q) => Math.max(q.cur, q.prev)), 1);

  // ── State branches: loading / error / empty (sebelum render normal) ──
  if (loading) return <TotalPenjualanSkeleton />;
  if (error) return <TotalPenjualanError message={error} />;
  if (data && data.available_years.length === 0) {
    return <TotalPenjualanEmpty currentYear={data.current_year} />;
  }

  return (
    // NB: container ini sengaja TIDAK pakai h-full + flex column. Card di
    // luar punya overflow-hidden untuk rounded corners; kalau chart SVG
    // (aspect-ratio fix W:H) dipaksa fit ke flex slot yang lebih pendek,
    // sebagian SVG akan ke-clip. Dengan natural stacking, section tumbuh
    // sesuai tinggi konten dan grid row stretch ngikutin.
    <div className="relative px-5 pt-4 pb-4 sm:px-6">
      {/* Decorative ambient glow di pojok atas — bikin section terasa
          futuristik kayak panel di trading view crypto. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-12 h-56 w-56 rounded-full bg-emerald-400/[0.08] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-8 left-1/4 h-32 w-32 rounded-full bg-sky-400/[0.04] blur-3xl"
      />

      {/* ─── Header — title + year picker ─── */}
      <div className="relative flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-700 ring-1 ring-emerald-300/30 shadow-[0_10px_28px_-10px_rgba(16,185,129,0.7)]">
            <Icon icon="solar:graph-up-bold-duotone" className="text-lg text-white drop-shadow" />
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/30 to-transparent opacity-50" />
            <div className="pointer-events-none absolute inset-1 rounded-xl ring-1 ring-white/15" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold tracking-tight text-white">
              Total Penjualan
            </h3>
            <p className="truncate text-[10px] text-slate-500">
              Komisi tahunan · YoY vs {compareYear}
            </p>
          </div>
        </div>
        <YearPicker value={year} options={availableYears} onChange={setYear} />
      </div>

      {/* ─── Hero metric ─── */}
      <div className="relative mt-4">
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Total {year}
          </p>
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/15 bg-emerald-500/[0.06] px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider text-emerald-300/85">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Live
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
          <span className="bg-gradient-to-br from-white via-white to-emerald-100/70 bg-clip-text text-[32px] font-extrabold leading-none tracking-tight text-transparent tabular-nums xl:text-[36px]">
            {formatJutaCurrency(animatedTotal)}
          </span>
          <DeltaPill pct={delta} />
        </div>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Icon
              icon={positive ? "solar:arrow-up-bold" : "solar:arrow-down-bold"}
              className={`text-[10px] ${positive ? "text-emerald-400" : "text-rose-400"}`}
            />
            <span className={`font-bold tabular-nums ${positive ? "text-emerald-300" : "text-rose-300"}`}>
              {positive ? "+" : "−"}
              {formatJutaCurrency(Math.abs(deltaAbs))}
            </span>
          </span>
          <span className="text-slate-600">·</span>
          <span className="tabular-nums">
            vs <span className="font-semibold text-slate-400">{formatJutaCurrency(totalPrev)}</span>{" "}
            di {compareYear}
          </span>
        </p>
      </div>

      {/* ─── Stat duo: Puncak + Avg/Bulan ─── */}
      <div className="relative mt-4 grid grid-cols-2 gap-2">
        <PremiumStat
          icon="solar:cup-star-bold-duotone"
          iconGrad="linear-gradient(135deg, #fbbf24, #d97706)"
          iconRing="ring-amber-300/25"
          iconShadow="shadow-[0_10px_28px_-10px_rgba(245,158,11,0.6)]"
          orb="radial-gradient(circle, rgba(251,191,36,0.28) 0%, transparent 65%)"
          label="Puncak"
          value={formatJutaShort(peakValCur)}
          subLabel={`${MONTH_LONG[peakIdx]?.slice(0, 3) ?? "—"} ${year}`}
          delta={peakDelta}
        />
        <PremiumStat
          icon="solar:chart-square-bold-duotone"
          iconGrad="linear-gradient(135deg, #38bdf8, #0284c7)"
          iconRing="ring-sky-300/25"
          iconShadow="shadow-[0_10px_28px_-10px_rgba(14,165,233,0.6)]"
          orb="radial-gradient(circle, rgba(56,189,248,0.26) 0%, transparent 65%)"
          label="Rata-rata per Bulan"
          value={formatJutaShort(avgPerMonth)}
          subLabel={`dari ${activeMonths} bulan aktif`}
          delta={avgDelta}
        />
      </div>

      {/* ─── Per Kuartal ─── */}
      <div className="relative mt-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.035] via-white/[0.005] to-transparent p-3">
        {/* top hairline */}
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />

        <div className="mb-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            <Icon icon="solar:widget-2-bold-duotone" className="text-[13px] text-emerald-400/80" />
            Per Kuartal
          </span>
          <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold tabular-nums">
            <span className="flex items-center gap-1 rounded-md border border-emerald-400/20 bg-emerald-500/[0.08] px-1.5 py-0.5 text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {year}
            </span>
            <span className="text-slate-600">vs</span>
            <span className="flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
              {compareYear}
            </span>
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2.5">
          {quarters.map((q) => {
            const curWidth = (q.cur / maxQuarter) * 100;
            const prevWidth = (q.prev / maxQuarter) * 100;
            return (
              <div
                key={q.label}
                className="group/q min-w-0 rounded-xl border border-white/[0.05] bg-white/[0.015] px-2 py-1.5 transition hover:border-emerald-400/20 hover:bg-emerald-500/[0.04]"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-extrabold tracking-wider text-white">
                    {q.label}
                  </span>
                  <DeltaPill pct={q.delta} size="xs" />
                </div>
                <p className="mt-1 truncate text-[11px] font-extrabold text-emerald-300 tabular-nums">
                  {formatJutaShort(q.cur)}
                </p>
                {/* current bar */}
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-emerald-400 to-emerald-600 shadow-[0_0_10px_rgba(52,211,153,0.5)] transition-[width] duration-700"
                    style={{ width: `${curWidth}%` }}
                  />
                </div>
                {/* prev underline bar */}
                <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.03]">
                  <div
                    className="h-full rounded-full bg-slate-500/70 transition-[width] duration-700"
                    style={{ width: `${prevWidth}%` }}
                  />
                </div>
                <p className="mt-0.5 truncate text-[8.5px] text-slate-500 tabular-nums">
                  {formatJutaShort(q.prev)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Chart line — tap di bulan untuk hold tooltip (mobile/tablet) ─── */}
      <div className="relative mt-3 min-w-0">
        {/* Hint kecil supaya user tahu tooltip bisa ditahan via tap.
            Tetap subtle — tidak nge-block area chart. Posisi inline (di
            atas chart, bukan absolute) supaya tidak overlap dengan SVG
            di breakpoint sempit dan tetap kebaca. */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            <Icon
              icon="solar:chart-bold-duotone"
              className="text-[12px] text-emerald-400/80"
            />
            Trajektori Bulanan
          </span>
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-widest text-slate-600">
            <Icon
              icon="solar:cursor-bold-duotone"
              className="-mt-0.5 text-[10px] sm:inline hidden"
            />
            <Icon
              icon="solar:hand-tap-bold-duotone"
              className="-mt-0.5 text-[10px] sm:hidden"
            />
            <span className="hidden sm:inline">Hover untuk detail</span>
            <span className="sm:hidden">Tap untuk detail</span>
          </span>
        </div>

        {/* Chart SVG — sizing-nya: SVG punya viewBox W×H, ditampilkan
            w-full h-auto, jadi tingginya = container_width × (H/W).
            Aspect ratio sengaja dibuat lebar (W=600 H=170 → 3.5:1)
            biar chart terasa "horizontal & compact" kayak panel trading
            view — tidak nge-dominasi vertikal section. Di kolom 2/3
            desktop ~700px lebar, tinggi natural chart jadi ~200px. */}
        <div className="-mx-1 mt-2">
          <AnnualSalesChart
            current={cur}
            previous={prev}
            labels={MONTH_LABELS}
            height={170}
            currentYearLabel={`${year}`}
            previousYearLabel={`${compareYear}`}
            formatValue={(v) => formatJutaCurrency(v)}
            yTickFormat={(v) => formatJutaShort(v)}
          />
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Loading skeleton — preserve hierarchy layout supaya tidak terjadi
   layout shift saat data datang. Pakai `animate-pulse` Tailwind di
   block-block kosong dengan ukuran setara element aslinya.
   ──────────────────────────────────────────────────────────────────── */
function TotalPenjualanSkeleton() {
  return (
    <div className="relative px-5 pt-4 pb-4 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-12 h-56 w-56 rounded-full bg-emerald-400/[0.06] blur-3xl"
      />
      {/* Header skeleton */}
      <div className="relative flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <div className="h-10 w-10 animate-pulse rounded-2xl bg-white/[0.06]" />
          <div className="space-y-2 pt-1">
            <div className="h-3 w-32 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-2.5 w-44 animate-pulse rounded bg-white/[0.04]" />
          </div>
        </div>
        <div className="h-9 w-28 animate-pulse rounded-2xl bg-white/[0.05]" />
      </div>

      {/* Hero skeleton */}
      <div className="mt-4 space-y-2">
        <div className="h-2.5 w-24 animate-pulse rounded bg-white/[0.05]" />
        <div className="h-9 w-56 animate-pulse rounded-xl bg-white/[0.07]" />
        <div className="h-2.5 w-72 animate-pulse rounded bg-white/[0.04]" />
      </div>

      {/* Stat tiles skeleton */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.015] px-3 py-2.5"
          >
            <div className="h-14 w-14 flex-shrink-0 animate-pulse rounded-2xl bg-white/[0.06]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-2.5 w-1/2 animate-pulse rounded bg-white/[0.05]" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-2.5 w-1/2 animate-pulse rounded bg-white/[0.04]" />
            </div>
          </div>
        ))}
      </div>

      {/* Quarter strip skeleton */}
      <div className="mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="grid grid-cols-4 gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-2.5 w-1/2 animate-pulse rounded bg-white/[0.05]" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-1.5 w-full animate-pulse rounded-full bg-white/[0.04]" />
              <div className="h-1 w-2/3 animate-pulse rounded-full bg-white/[0.03]" />
            </div>
          ))}
        </div>
      </div>

      {/* Chart skeleton */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="h-2.5 w-32 animate-pulse rounded bg-white/[0.05]" />
          <div className="h-2.5 w-24 animate-pulse rounded bg-white/[0.04]" />
        </div>
        <div className="relative h-[170px] overflow-hidden rounded-xl border border-white/[0.04] bg-white/[0.015]">
          {/* faux grid lines */}
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="absolute inset-x-0 h-px bg-white/[0.04]"
              style={{ top: `${20 + i * 25}%` }}
            />
          ))}
          <div className="absolute inset-x-0 bottom-1/3 h-12 animate-pulse rounded bg-gradient-to-r from-transparent via-emerald-400/[0.08] to-transparent" />
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Error state — selalu menonjolkan apa yang user bisa lakukan (refresh)
   instead of jargon teknis. Tetap kasih hint message asli buat
   debugging via title attribute.
   ──────────────────────────────────────────────────────────────────── */
function TotalPenjualanError({ message }: { message: string }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center px-6 py-10 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl border border-rose-400/20 bg-rose-500/10 shadow-[0_0_28px_-6px_rgba(244,63,94,0.4)]">
        <Icon
          icon="solar:danger-triangle-bold-duotone"
          className="text-3xl text-rose-300"
        />
      </div>
      <p className="mt-4 text-sm font-bold text-rose-200">
        Gagal memuat total penjualan
      </p>
      <p
        title={message}
        className="mt-1 max-w-[280px] text-[11px] text-slate-500"
      >
        Coba refresh halaman. Kalau masih bermasalah, hubungi admin.
      </p>
      <button
        type="button"
        onClick={() => location.reload()}
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.08] px-3 py-1.5 text-[11px] font-bold text-emerald-200 transition hover:bg-emerald-500/[0.15]"
      >
        <Icon icon="solar:refresh-bold-duotone" className="text-[13px]" />
        Muat Ulang
      </button>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Empty state — agent belum punya closing sama sekali. Tone-nya
   encouraging, bukan menyalahkan, dengan ilustrasi visual + CTA
   eksplisit ("dari mana penjualan tercatat") supaya agent tau langkah
   selanjutnya.
   ──────────────────────────────────────────────────────────────────── */
function TotalPenjualanEmpty({ currentYear }: { currentYear: number }) {
  const router = useRouter();
  return (
    <div className="relative flex min-h-[320px] flex-col items-center justify-center px-6 py-12 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-12 h-44 w-44 rounded-full bg-emerald-400/[0.08] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-12 -left-12 h-44 w-44 rounded-full bg-sky-400/[0.05] blur-3xl"
      />

      <div className="relative grid h-20 w-20 place-items-center rounded-3xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/[0.12] to-transparent shadow-[0_18px_44px_-12px_rgba(16,185,129,0.45)]">
        <span className="pointer-events-none absolute inset-0 rounded-3xl bg-emerald-500/[0.08] blur-md" />
        <Icon
          icon="solar:rocket-bold-duotone"
          className="relative text-[44px] text-emerald-300"
        />
      </div>

      <p className="relative mt-5 text-base font-bold tracking-tight text-white">
        Belum ada penjualan di {currentYear}
      </p>
      <p className="relative mt-1.5 max-w-[300px] text-[11.5px] leading-relaxed text-slate-500">
        Total penjualan otomatis muncul di sini setiap kali closing
        ter-input dan kamu masuk sebagai PIC1/PIC2 atau co-broke.
      </p>

      <div className="relative mt-5 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => router.push("/dashboard/transaksi?tab=progress")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 px-3.5 py-2 text-[11.5px] font-extrabold tracking-wide text-[#05070D] shadow-[0_8px_22px_-6px_rgba(52,211,153,0.6)] transition hover:shadow-[0_10px_28px_-6px_rgba(52,211,153,0.85)] active:scale-[0.97]"
        >
          <Icon icon="solar:document-text-bold-duotone" className="text-[14px]" />
          Lihat Progress Transaksi
        </button>
        <button
          type="button"
          onClick={() => router.push("/dashboard/listings")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-[11.5px] font-bold tracking-wide text-slate-200 transition hover:border-white/[0.18] hover:bg-white/[0.07]"
        >
          <Icon icon="solar:home-add-bold-duotone" className="text-[14px]" />
          Kelola Listing
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   3a. HOT LEADS / FOLLOW-UP QUEUE  (real API data)
   ──────────────────────────────────────────────────────────────────── */

type LeadStatus = "new" | "contacted" | "hot" | "closing" | "cold";

interface HotLead {
  id: string;
  idProperty: string | null;
  address: string;
  image: string | null;
  source: string;
  sourceIcon: string;
  sourceRaw: "whatsapp" | "telepon" | "survei" | "titip_jual" | "form_inquiry" | "penawaran" | "cobroke";
  listing: string;
  ageMinutes: number;
  status: LeadStatus;
  budget?: string;
  phone?: string | null;
  clientName?: string | null;
  bookingSurveiStatus?: "PENDING" | "CONFIRMED" | "CANCELLED" | null;
  offerAmount?: string | null;
  notes?: string | null;
  verified?: boolean;
  statusPenawaran?: "pending" | "diterima" | "ditolak" | null;
  catatanAgent?: string | null;
  tanggalKeputusan?: string | null;
  cobrokeAgent?: { id_agent: string; nama: string; kantor: string; whatsapp: string } | null;
}

interface ApiLead {
  id_lead: string;
  source: "whatsapp" | "telepon" | "survei" | "titip_jual" | "form_inquiry" | "penawaran" | "cobroke";
  status: LeadStatus;
  client_name: string | null;
  client_phone: string | null;
  offer_amount: number | null;
  notes: string | null;
  status_penawaran?: "pending" | "diterima" | "ditolak" | null;
  catatan_agent?: string | null;
  tanggal_keputusan?: string | null;
  verified: boolean;
  booking_survei_status: "PENDING" | "CONFIRMED" | "CANCELLED" | null;
  device_type: string | null;
  last_activity: string | null;
  created_at: string;
  cobroke_agent?: { id_agent: string; nama: string; kantor: string; whatsapp: string } | null;
  listing: {
    id_property: string;
    judul: string;
    slug: string;
    kota: string;
    kecamatan: string | null;
    alamat_lengkap: string | null;
    harga: number;
    gambar_utama: string | null;
    kategori: string;
    jenis_transaksi: string;
  } | null;
}

const SOURCE_META: Record<
  ApiLead["source"],
  { label: string; icon: string }
> = {
  whatsapp:     { label: "WhatsApp",   icon: "ic:baseline-whatsapp" },
  telepon:      { label: "Telepon",    icon: "solar:phone-bold" },
  survei:       { label: "Survei",     icon: "solar:calendar-date-bold" },
  titip_jual:   { label: "Titip Jual", icon: "solar:home-add-bold" },
  form_inquiry: { label: "Form",       icon: "solar:document-text-bold" },
  penawaran:    { label: "Penawaran",  icon: "solar:tag-price-bold-duotone" },
  cobroke:      { label: "Co-Broke",   icon: "solar:users-group-two-rounded-bold-duotone" },
};

function compactPrice(n: number): string {
  if (!n || n <= 0) return "";
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)} M`;
  if (n >= 1_000_000)     return `Rp ${Math.round(n / 1_000_000)} Jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function formatAddress(l: ApiLead["listing"]): string {
  if (!l) return "Properti dihapus";
  if (l.alamat_lengkap && l.alamat_lengkap.trim()) return l.alamat_lengkap;
  if (l.kecamatan && l.kota) return `${l.kecamatan}, ${l.kota}`;
  return l.kota || "Lokasi tidak diketahui";
}

function mapApiToHotLead(api: ApiLead): HotLead {
  const baseTime = api.last_activity
    ? new Date(api.last_activity).getTime()
    : new Date(api.created_at).getTime();
  const ageMinutes = Math.max(0, Math.floor((Date.now() - baseTime) / 60000));

  const meta = SOURCE_META[api.source] || SOURCE_META.whatsapp;

  return {
    id: api.id_lead,
    idProperty: api.listing?.id_property ?? null,
    address: formatAddress(api.listing),
    image: api.listing?.gambar_utama ?? null,
    source: meta.label,
    sourceIcon: meta.icon,
    sourceRaw: api.source,
    listing: api.listing?.judul || "Properti dihapus",
    ageMinutes,
    status: api.status,
    budget: api.listing ? compactPrice(api.listing.harga) : undefined,
    phone: api.client_phone,
    clientName: api.client_name,
    bookingSurveiStatus: api.booking_survei_status,
    offerAmount: api.offer_amount != null ? rupiahFormatter.format(api.offer_amount) : null,
    notes: api.notes,
    verified: api.verified,
    statusPenawaran: api.status_penawaran ?? null,
    catatanAgent: api.catatan_agent ?? null,
    tanggalKeputusan: api.tanggal_keputusan ?? null,
    cobrokeAgent: api.cobroke_agent ?? null,
  };
}

function humanTime(min: number) {
  if (min < 1) return "Baru saja";
  if (min < 60) return `${min} menit lalu`;
  if (min < 24 * 60) {
    const h = Math.floor(min / 60);
    return `${h} jam lalu`;
  }
  const d = Math.floor(min / (60 * 24));
  return d === 1 ? "Kemarin" : `${d} hari lalu`;
}

type StatusVisual = {
  label: string;
  icon: string;
  // card-level styling
  card: string;
  bar: string;
  // banner row (under content)
  bannerBg: string;
  bannerText: string;
  // pulsing dot top-right
  showDot: boolean;
};

function statusVisual(status: LeadStatus, ageMinutes: number): StatusVisual {
  if (status === "new") {
    const overdue = ageMinutes >= 60;
    return {
      label: overdue ? "Lewat SLA — Segera Hubungi!" : "Lead Baru — Mohon Follow Up",
      icon: overdue ? "solar:danger-triangle-bold-duotone" : "solar:bell-bing-bold-duotone",
      card: "border-rose-400/25 bg-gradient-to-br from-rose-500/[0.06] via-transparent to-transparent shadow-[0_8px_24px_-16px_rgba(244,63,94,0.5)]",
      bar:  "bg-gradient-to-b from-rose-300 via-rose-500 to-rose-600",
      bannerBg:   "bg-rose-500/[0.08] border-rose-400/15",
      bannerText: "text-rose-200",
      showDot: true,
    };
  }
  if (status === "hot") {
    return {
      label: "Hot Buyer — Prioritas Tinggi",
      icon: "solar:fire-bold-duotone",
      card: "border-amber-400/25 bg-gradient-to-br from-amber-500/[0.06] via-transparent to-transparent",
      bar:  "bg-gradient-to-b from-amber-300 via-orange-500 to-rose-500",
      bannerBg:   "bg-amber-500/[0.08] border-amber-400/15",
      bannerText: "text-amber-200",
      showDot: false,
    };
  }
  if (status === "contacted") {
    const stale = ageMinutes > 24 * 60;
    return {
      label: stale ? "Sudah Dikontak · Perlu Pengingat" : "Sudah Dikontak",
      icon: "solar:phone-calling-bold-duotone",
      card: "border-white/[0.06] bg-white/[0.015]",
      bar:  "bg-gradient-to-b from-sky-400 to-sky-600",
      bannerBg:   "bg-sky-500/[0.06] border-sky-400/15",
      bannerText: "text-sky-200",
      showDot: false,
    };
  }
  if (status === "closing") {
    return {
      label: "Menuju Closing",
      icon: "solar:document-text-bold-duotone",
      card: "border-emerald-400/20 bg-emerald-500/[0.03]",
      bar:  "bg-gradient-to-b from-emerald-300 to-emerald-600",
      bannerBg:   "bg-emerald-500/[0.07] border-emerald-400/15",
      bannerText: "text-emerald-200",
      showDot: false,
    };
  }
  return {
    label: "Lost — Tidak Lanjut",
    icon: "solar:close-circle-bold-duotone",
    card: "border-white/[0.04] bg-white/[0.01] opacity-65",
    bar:  "bg-slate-700",
    bannerBg:   "bg-white/[0.02] border-white/[0.05]",
    bannerText: "text-slate-400",
    showDot: false,
  };
}

const CHANNEL_BG: Record<HotLead["sourceRaw"], string> = {
  whatsapp:     "bg-emerald-500",
  telepon:      "bg-sky-500",
  survei:       "bg-violet-500",
  titip_jual:   "bg-amber-500",
  form_inquiry: "bg-slate-500",
  penawaran:    "bg-teal-500",
  cobroke:      "bg-fuchsia-500",
};

type LeadFilter = "action" | "all" | "new" | "followup" | "hot" | "closing" | "archive";

// Lebar panel aksi yang muncul saat lead card di-swipe ke kiri.
const SWIPE_ACTION_WIDTH = 84;

/* Bungkus tiap lead card dengan gesture swipe-left → reveal panel aksi
   (Arsip / Pulihkan). Tidak ada penghapusan permanen — sekadar memindahkan
   lead ke/dari pill "Arsip" agar list utama tetap rapi tanpa risiko data hilang. */
function SwipeableLeadRow({
  archived,
  highlighted,
  onOpen,
  onArchive,
  onRestore,
  children,
}: {
  archived: boolean;
  highlighted: boolean;
  onOpen: () => void;
  onArchive: () => void;
  onRestore: () => void;
  children: React.ReactNode;
}) {
  const [revealed, setRevealed] = useState(false);
  // Lacak jarak drag horizontal terkini — dipakai untuk membedakan
  // "swipe" (jangan buka modal) dari "tap" murni (buka modal).
  const dragDistanceRef = useRef(0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="relative overflow-hidden rounded-2xl">
        {/* Panel aksi — terbuka saat swipe ke kiri, dengan entrance animation */}
        <div className="absolute inset-y-0 right-0 flex w-[84px] items-center justify-center">
          <motion.div
            className={`absolute inset-0 ${
              archived
                ? "bg-gradient-to-br from-emerald-500 to-emerald-600"
                : "bg-gradient-to-br from-rose-500 to-rose-600"
            }`}
            initial={false}
            animate={{
              opacity: revealed ? 1 : 0,
              clipPath: revealed ? "circle(100% at 100% 50%)" : "circle(0% at 100% 50%)",
            }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          />
          <motion.button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setRevealed(false);
              if (archived) onRestore();
              else onArchive();
            }}
            initial={false}
            animate={
              revealed
                ? { opacity: 1, scale: 1, rotate: 0 }
                : { opacity: 0, scale: 0.4, rotate: archived ? 90 : -90 }
            }
            whileTap={{ scale: 0.88 }}
            transition={{ type: "spring", stiffness: 420, damping: 22, delay: revealed ? 0.08 : 0 }}
            className="relative z-10 flex w-full flex-col items-center justify-center gap-1 text-[10px] font-bold text-white"
          >
            <motion.span
              animate={revealed ? { y: [0, -3, 0] } : { y: 0 }}
              transition={{ duration: 0.6, ease: "easeInOut", delay: 0.2 }}
              className="drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
            >
              <Icon
                icon={archived ? "solar:restart-bold-duotone" : "solar:trash-bin-trash-bold-duotone"}
                className="text-lg"
              />
            </motion.span>
            {archived ? "Pulihkan" : "Arsip"}
          </motion.button>
        </div>

        <motion.div
          drag="x"
          dragConstraints={{ left: -SWIPE_ACTION_WIDTH, right: 0 }}
          dragElastic={0.04}
          dragMomentum={false}
          animate={{ x: revealed ? -SWIPE_ACTION_WIDTH : 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 38 }}
          onDragStart={() => {
            dragDistanceRef.current = 0;
          }}
          onDrag={(_, info) => {
            dragDistanceRef.current = Math.max(dragDistanceRef.current, Math.abs(info.offset.x));
          }}
          onDragEnd={(_, info) => setRevealed(info.offset.x < -SWIPE_ACTION_WIDTH / 2)}
          onClick={() => {
            // Swipe (gerakan > 8px) tidak boleh ikut membuka modal detail.
            if (dragDistanceRef.current > 8) {
              dragDistanceRef.current = 0;
              return;
            }
            if (revealed) {
              setRevealed(false);
              return;
            }
            onOpen();
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (revealed) setRevealed(false);
              else onOpen();
            }
          }}
          className={`relative cursor-pointer rounded-2xl bg-[#0a0f10] outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 ${
            highlighted ? "ring-2 ring-amber-400/70 shadow-[0_0_0_4px_rgba(251,191,36,0.15)]" : ""
          }`}
        >
          {children}
        </motion.div>
    </motion.div>
  );
}

function HotLeadsCard() {
  const [filter, setFilter] = useState<LeadFilter>("all");
  const [allLeads, setAllLeads] = useState<HotLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<HotLead | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Titip-jual feed: row terpisah, selalu tampil di paling atas list
  const titip = useTitipFeed();
  // When `Total Leads` tile is clicked, the dashboard scrolls here and fires
  // a window event. We flash a soft emerald halo + ring around the card so
  // the user immediately sees "ini tujuannya" instead of being confused why
  // the page jumped.
  const [focusPulse, setFocusPulse] = useState(false);
  // Highlight item lead tertentu — dipicu dari notifikasi survei di bell
  const [focusLeadId, setFocusLeadId] = useState<string | null>(null);

  useEffect(() => {
    const onFocus = () => {
      setFocusPulse(true);
      // Hold the highlight long enough to be noticed but not annoying.
      const t = window.setTimeout(() => setFocusPulse(false), 1400);
      return () => window.clearTimeout(t);
    };
    window.addEventListener("hot-leads:focus", onFocus);
    return () => window.removeEventListener("hot-leads:focus", onFocus);
  }, []);

  // Scroll + highlight ke item lead tertentu (klik notif survei di bell)
  const focusLeadItem = useCallback((idLead: string | null | undefined) => {
    if (!idLead) return;
    const el = document.getElementById(`hot-lead-${idLead}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFocusLeadId(idLead);
    const t = window.setTimeout(() => setFocusLeadId(null), 2200);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const onFocusItem = (e: Event) => {
      const detail = (e as CustomEvent<{ id_lead?: string | null }>).detail;
      focusLeadItem(detail?.id_lead);
    };
    window.addEventListener("hot-leads:focus-item", onFocusItem);

    // Cross-page navigation: id disimpan via sessionStorage sebelum redirect
    const pending = sessionStorage.getItem("hot-leads:focus-item");
    if (pending) {
      sessionStorage.removeItem("hot-leads:focus-item");
      window.setTimeout(() => focusLeadItem(pending), 600);
    }

    return () => window.removeEventListener("hot-leads:focus-item", onFocusItem);
  }, [focusLeadItem]);

  // Refetch leads saat ada perubahan dari luar (mis. Terima/Tolak survei di bell)
  useEffect(() => {
    const onRefresh = () => setRefreshTick((t) => t + 1);
    window.addEventListener("hot-leads:refresh", onRefresh);
    return () => window.removeEventListener("hot-leads:refresh", onRefresh);
  }, []);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const res = await fetch("/api/leads?limit=50", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!alive) return;
        const mapped: HotLead[] = (json.leads as ApiLead[]).map(mapApiToHotLead);
        setAllLeads(mapped);
        setError(null);
      } catch (e) {
        if (!alive) return;
        setError(String(e));
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    // refresh tiap 60 detik
    const intv = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(intv);
    };
  }, [refreshTick]);

  // "Perlu Aksi" — lead baru yang sudah lewat SLA (>= 60 menit belum
  // ditindak) atau booking survei yang masih menunggu Terima/Tolak.
  // Pill ini jadi prioritas paling atas, terlepas dari status lead-nya.
  const isActionNeeded = useCallback(
    (l: HotLead) =>
      (l.status === "new" && l.ageMinutes >= 60) ||
      l.bookingSurveiStatus === "PENDING",
    [],
  );

  // Lead "cold" (lost/tidak lanjut) tidak ikut menumpuk di pill "Semua" —
  // dipindah ke pill "Arsip" tersendiri agar dashboard tetap rapi tanpa
  // kehilangan data (tetap bisa dibuka/dipulihkan lewat pill Arsip).
  const activeLeads = useMemo(
    () => allLeads.filter((l) => l.status !== "cold"),
    [allLeads],
  );

  const counts = useMemo(
    () => ({
      action: allLeads.filter(isActionNeeded).length,
      all: activeLeads.length,
      new: allLeads.filter((l) => l.status === "new").length,
      followup: allLeads.filter((l) => l.status === "contacted").length,
      hot: allLeads.filter((l) => l.status === "hot").length,
      closing: allLeads.filter((l) => l.status === "closing").length,
      archive: allLeads.filter((l) => l.status === "cold").length,
    }),
    [allLeads, activeLeads, isActionNeeded],
  );

  const leads = useMemo(() => {
    if (filter === "action") return allLeads.filter(isActionNeeded);
    if (filter === "new") return allLeads.filter((l) => l.status === "new");
    if (filter === "followup") return allLeads.filter((l) => l.status === "contacted");
    if (filter === "hot") return allLeads.filter((l) => l.status === "hot");
    if (filter === "closing") return allLeads.filter((l) => l.status === "closing");
    if (filter === "archive") return allLeads.filter((l) => l.status === "cold");
    return activeLeads;
  }, [filter, allLeads, activeLeads, isActionNeeded]);

  // Arsipkan / pulihkan lead — update optimistic + sinkron ke backend.
  // Diarsipkan = status "cold" (sudah ada di VALID_STATUS, dipakai juga
  // untuk hasil "ditolak" pada penawaran/cobroke). Dipulihkan = "contacted"
  // (kembali ke pill Followup, posisi netral karena status sebelumnya tidak disimpan).
  const archiveLead = useCallback(async (id: string) => {
    setAllLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: "cold" } : l)));
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cold" }),
      });
      if (!res.ok) throw new Error();
      toast.success("Lead diarsipkan", { description: "Bisa dipulihkan lagi lewat pill Arsip." });
    } catch {
      toast.error("Gagal mengarsipkan lead");
      setRefreshTick((t) => t + 1);
    }
  }, []);

  const restoreLead = useCallback(async (id: string) => {
    setAllLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: "contacted" } : l)));
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "contacted" }),
      });
      if (!res.ok) throw new Error();
      toast.success("Lead dipulihkan", { description: "Lead kembali aktif di pill Followup." });
    } catch {
      toast.error("Gagal memulihkan lead");
      setRefreshTick((t) => t + 1);
    }
  }, []);

  // Titip jual yang sudah diterima agent ini juga dihitung sebagai hot lead
  // (sumber lead bukan cuma WA — titip jual yang diklaim juga = lead aktif).
  const titipCount = titip.items.length + titip.claimedItems.length;
  const titipActionCount = titip.items.length + titip.claimedItems.length;
  const newCount = counts.new + titipCount;

  // Baris titip-jual (claimed/baru/locked) hanya relevan untuk pill "Semua"
  // dan "Perlu Aksi" — di pill status lain (Baru/Followup/Hot/Closing) lead
  // titip-jual tidak ikut campur supaya pemetaan per-status tetap akurat.
  const showTitipRows = filter === "all" || filter === "action";

  const filterPills: { key: LeadFilter; label: string; count: number; icon: string }[] = [
    { key: "action",   label: "Perlu Aksi", count: counts.action + titipActionCount, icon: "solar:bolt-bold-duotone" },
    { key: "all",      label: "Semua",      count: counts.all + titipCount,          icon: "solar:inbox-bold-duotone" },
    { key: "new",      label: "Baru",       count: counts.new,                       icon: "solar:bell-bing-bold-duotone" },
    { key: "followup", label: "Followup",   count: counts.followup,                  icon: "solar:phone-calling-bold-duotone" },
    { key: "hot",      label: "Hot",        count: counts.hot,                       icon: "solar:fire-bold-duotone" },
    { key: "closing",  label: "Closing",    count: counts.closing,                   icon: "solar:document-text-bold-duotone" },
    { key: "archive",  label: "Arsip",      count: counts.archive,                   icon: "solar:archive-bold-duotone" },
  ];

  return (
    <div
      id="hot-leads-card"
      className={`relative h-full scroll-mt-24 transition-transform duration-700 ease-out ${
        focusPulse ? "scale-[1.012]" : ""
      }`}
    >
      {/* Soft emerald halo bloom that fades in/out around the card when
          focused via the Total Leads tile. Pointer-events none so it never
          blocks the leads list underneath. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -inset-3 rounded-[28px] bg-emerald-400/20 blur-2xl transition-opacity duration-700 ease-out ${
          focusPulse ? "opacity-100" : "opacity-0"
        }`}
      />
      <Card
        className={`relative h-full transition-shadow duration-700 ease-out ${
          focusPulse
            ? "shadow-[0_0_0_2px_rgba(52,211,153,0.7),inset_0_0_0_1px_rgba(52,211,153,0.45),0_30px_80px_-20px_rgba(52,211,153,0.55)]"
            : ""
        }`}
      >
      <div className="flex h-full flex-col">
        {/* ─── Header ─── */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 sm:px-6 sm:pt-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="relative grid h-10 w-10 place-items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/icons/fire.gif"
                  alt="Hot Leads"
                  className="h-9 w-9 object-contain drop-shadow-[0_2px_8px_rgba(244,114,63,0.45)]"
                />
                {newCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-extrabold text-white ring-2 ring-[#070a0b]">
                    {newCount}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold tracking-tight text-white">Hot Leads</h3>
                <p className="mt-0.5 text-[11px] leading-tight text-slate-500">
                  {newCount > 0
                    ? `${newCount} lead baru menunggu follow up`
                    : counts.all > 0
                    ? `${counts.all} lead aktif`
                    : "Antrian follow-up"}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="hidden shrink-0 items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300 transition hover:border-emerald-400/25 hover:bg-emerald-500/10 hover:text-emerald-200 sm:inline-flex"
          >
            Lihat semua
            <Icon icon="solar:alt-arrow-right-bold" className="text-[10px]" />
          </button>
        </div>

        {/* ─── Filter pills (scrollable, snap + sliding active indicator) ─── */}
        <div className="relative">
          <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-5 pb-3 sm:px-6 [scrollbar-width:none] snap-x snap-proximity scroll-px-5 [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)] sm:[mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)]">
            {filterPills.map((p) => {
              const active = filter === p.key;
              // Pill "Perlu Aksi" pakai aksen rose (urgensi), "Arsip" pakai slate, lainnya emerald.
              const isAction = p.key === "action";
              const isArchive = p.key === "archive";
              const urgent = isAction && p.count > 0;
              const accentText = isAction ? "text-rose-300" : isArchive ? "text-slate-300" : "text-emerald-300";
              const accentBorder = isAction ? "border-rose-400/40" : isArchive ? "border-slate-400/35" : "border-emerald-400/40";
              const accentTextStrong = isAction ? "text-rose-100" : isArchive ? "text-slate-100" : "text-emerald-100";
              const accentGlow = isAction
                ? "shadow-[0_0_16px_rgba(244,63,94,0.2)]"
                : isArchive
                ? "shadow-[0_0_16px_rgba(148,163,184,0.16)]"
                : "shadow-[0_0_16px_rgba(52,211,153,0.18)]";
              const accentBg = isAction ? "bg-rose-500/15" : isArchive ? "bg-slate-400/15" : "bg-emerald-500/15";
              const accentCount = isAction ? "bg-rose-500/25 text-rose-100" : isArchive ? "bg-slate-400/25 text-slate-100" : "bg-emerald-500/25 text-emerald-100";

              return (
                <motion.button
                  key={p.key}
                  type="button"
                  onClick={() => setFilter(p.key)}
                  whileTap={{ scale: 0.94 }}
                  className={`relative flex shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-colors duration-300 ${
                    active
                      ? `${accentBorder} ${accentTextStrong}`
                      : urgent
                      ? "border-rose-400/25 bg-rose-500/[0.06] text-rose-200 hover:border-rose-400/40 hover:bg-rose-500/15"
                      : "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="hot-leads-pill-active-bg"
                      className={`absolute inset-0 rounded-full ${accentBg} ${accentGlow}`}
                      transition={{ type: "spring", stiffness: 500, damping: 34 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <Icon
                      icon={p.icon}
                      className={`text-[12px] ${active ? accentText : urgent ? "text-rose-300" : ""}`}
                    />
                    <span>{p.label}</span>
                    <span
                      className={`tabular-nums rounded-md px-1.5 py-0.5 text-[9px] font-extrabold transition-colors duration-300 ${
                        active
                          ? accentCount
                          : urgent
                          ? "bg-rose-500/20 text-rose-200"
                          : "bg-white/[0.05] text-slate-500"
                      }`}
                    >
                      {p.count}
                    </span>
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* ─── List ─── */}
        <div className="flex-1 min-w-0 min-h-[220px] space-y-2.5 overflow-x-hidden overflow-y-auto px-3 pb-4 sm:px-4 lg:min-h-0">
          {/* Baris titip-jual hanya tampil di pill "Semua" / "Perlu Aksi" —
              di pill status lain (Baru/Followup/Hot/Closing) disembunyikan
              supaya pemetaan per-status tetap akurat. */}
          {showTitipRows && (
            <>
              {/* (1) Lead yang sudah dimenangkan agent ini — paling atas
                      supaya selalu kelihatan untuk follow-up. */}
              <AnimatePresence initial={false}>
                {titip.claimedItems.map((it) => (
                  <ClaimedFollowupRow
                    key={`claimed-${it.id_titip}`}
                    item={it}
                    onOpenPlaybook={titip.reopenPlaybook}
                  />
                ))}
              </AnimatePresence>

              {/* (2) Titip-jual baru yang masih bisa diklaim */}
              <AnimatePresence initial={false}>
                {titip.items.map((it) => (
                  <TitipRow
                    key={`titip-${it.id_titip}`}
                    item={it}
                    pendingAction={titip.pendingAction}
                    conflictId={titip.conflictId}
                    removalId={titip.removalId}
                    onAccept={titip.accept}
                    onReject={titip.reject}
                  />
                ))}
              </AnimatePresence>

              {/* (3) Closure card untuk lead yang sudah diambil agent lain —
                      hanya relevan di pill "Semua", bukan "Perlu Aksi". */}
              {filter === "all" && (
                <AnimatePresence initial={false}>
                  {titip.lockedItems.map((it) => (
                    <LockedRow
                      key={`locked-${it.id_titip}`}
                      item={it}
                      onDismiss={titip.dismissLocked}
                    />
                  ))}
                </AnimatePresence>
              )}
            </>
          )}

          {loading ? (
            // skeleton (3 rows)
            <div className="space-y-2.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.015] p-3"
                >
                  <div className="h-14 w-14 shrink-0 animate-pulse rounded-xl bg-white/[0.05]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-white/[0.06]" />
                    <div className="h-2 w-1/2 animate-pulse rounded bg-white/[0.04]" />
                    <div className="h-2 w-1/3 animate-pulse rounded bg-white/[0.04]" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl border border-rose-400/20 bg-rose-500/10">
                <Icon icon="solar:danger-triangle-bold-duotone" className="text-2xl text-rose-300" />
              </div>
              <p className="mt-3 text-sm font-semibold text-rose-200">Gagal memuat leads</p>
              <p className="mt-1 text-[11px] text-slate-500">Coba refresh halaman</p>
            </div>
          ) : leads.length === 0 &&
            (!showTitipRows ||
              (titip.items.length === 0 &&
                titip.lockedItems.length === 0 &&
                titip.claimedItems.length === 0)) ? (
            <div className="flex h-full flex-col items-center justify-center py-12 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.05]">
                <Icon
                  icon={filter === "archive" ? "solar:archive-bold-duotone" : "solar:check-circle-bold-duotone"}
                  className="text-3xl text-emerald-400/60"
                />
              </div>
              <p className="mt-3 text-sm font-semibold text-white">
                {filter === "archive" ? "Belum ada lead yang diarsipkan" : "Semua lead sudah ditangani"}
              </p>
              <p className="mt-1 max-w-[220px] text-[11px] text-slate-500">
                {filter === "archive"
                  ? "Swipe ke kiri pada lead yang sudah selesai/tidak lanjut untuk memindahkannya ke sini."
                  : "Belum ada lead di kategori ini. Lead baru akan otomatis muncul di sini."}
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false} mode="popLayout">
            {leads.map((lead) => {
              const v = statusVisual(lead.status, lead.ageMinutes);
              const phoneDigits = lead.phone ? lead.phone.replace(/\D/g, "") : "";
              return (
                <SwipeableLeadRow
                  key={lead.id}
                  archived={lead.status === "cold"}
                  highlighted={focusLeadId === lead.id}
                  onOpen={() => setSelectedLead(lead)}
                  onArchive={() => archiveLead(lead.id)}
                  onRestore={() => restoreLead(lead.id)}
                >
                <article
                  id={`hot-lead-${lead.id}`}
                  className={`group relative overflow-hidden rounded-2xl border backdrop-blur-sm transition hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] ${v.card}`}
                >
                  {/* Left accent bar — status color */}
                  <span className={`absolute inset-y-0 left-0 w-[3px] ${v.bar}`} />

                  {/* Pulsing notification dot (only for "new") */}
                  {v.showDot && (
                    <span className="absolute right-2.5 top-2.5 flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                    </span>
                  )}

                  {/* ─── Top: thumbnail + content ─── */}
                  <div className="flex gap-3 p-3 pl-4 pr-4">
                    {/* Thumbnail with source channel chip */}
                    <div className="relative shrink-0">
                      {lead.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={lead.image}
                          alt={lead.listing}
                          className="h-16 w-16 rounded-xl object-cover ring-1 ring-white/[0.08]"
                        />
                      ) : (
                        <div className="grid h-16 w-16 place-items-center rounded-xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] ring-1 ring-white/[0.06]">
                          <Icon
                            icon="solar:home-bold-duotone"
                            className="text-2xl text-slate-500"
                          />
                        </div>
                      )}
                      <span
                        title={lead.source}
                        className={`absolute -bottom-1.5 -right-1.5 grid h-6 w-6 place-items-center rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.5)] ring-2 ring-[#070a0b] ${CHANNEL_BG[lead.sourceRaw]}`}
                      >
                        <Icon icon={lead.sourceIcon} className="text-[12px] text-white" />
                      </span>
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 pr-4 text-[13px] font-bold leading-snug text-white">
                        {lead.address}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <p
                          className={`flex min-w-0 flex-1 items-center gap-1 truncate text-[11px] ${
                            lead.sourceRaw === "cobroke"
                              ? "font-semibold text-fuchsia-300/85"
                              : lead.clientName
                              ? "font-semibold text-emerald-300/90"
                              : lead.phone
                              ? "text-slate-400"
                              : "italic text-amber-300/85"
                          }`}
                        >
                          {lead.sourceRaw === "cobroke" ? (
                            <Icon
                              icon="solar:shield-keyhole-bold-duotone"
                              className="shrink-0 text-[12px]"
                            />
                          ) : lead.clientName ? (
                            <Icon
                              icon="solar:user-bold-duotone"
                              className="shrink-0 text-[12px]"
                            />
                          ) : !lead.phone ? (
                            <Icon
                              icon="solar:hourglass-line-bold-duotone"
                              className="shrink-0 text-[12px]"
                            />
                          ) : null}
                          <span className="truncate">
                            {lead.sourceRaw === "cobroke"
                              ? "Identitas klien dirahasiakan"
                              : lead.clientName
                              ? lead.clientName
                              : lead.phone
                              ? lead.listing
                              : "Menunggu balasan WhatsApp…"}
                          </span>
                        </p>
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                          Detail
                          <Icon icon="solar:alt-arrow-right-bold" className="text-[9px]" />
                        </span>
                      </div>

                      {lead.sourceRaw === "survei" &&
                        lead.bookingSurveiStatus === "PENDING" && (
                          <p className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-amber-400/25 bg-amber-500/[0.08] px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                            <Icon icon="solar:bell-bing-bold-duotone" className="text-[11px]" />
                            Menunggu Terima/Tolak survei
                          </p>
                        )}

                      {lead.sourceRaw === "cobroke" && lead.cobrokeAgent && (
                        <p className="mt-1.5 flex min-w-0 w-full items-center gap-1 truncate rounded-md border border-fuchsia-400/25 bg-fuchsia-500/[0.08] px-1.5 py-0.5 text-[10px] font-bold text-fuchsia-300">
                          <Icon icon="solar:users-group-two-rounded-bold-duotone" className="shrink-0 text-[11px]" />
                          <span className="truncate">
                            Diajukan oleh {lead.cobrokeAgent.nama} ({lead.cobrokeAgent.kantor})
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ─── Bottom banner: status + waktu + CTA ─── */}
                  <div
                    className={`flex items-center justify-between gap-2 border-t px-3 py-2 sm:px-4 ${v.bannerBg}`}
                  >
                    <span
                      className={`flex min-w-0 flex-1 items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide ${v.bannerText}`}
                    >
                      <Icon icon={v.icon} className="shrink-0 text-[13px]" />
                      <span className="truncate">{v.label}</span>
                    </span>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400">
                        <Icon icon="solar:clock-circle-linear" className="text-[11px]" />
                        {humanTime(lead.ageMinutes)}
                      </span>

                      {/* Persistent CTA — hanya muncul kalau ada nomor */}
                      {lead.phone && (
                        <div className="flex items-center gap-1.5 border-l border-white/[0.08] pl-2">
                          <a
                            href={`tel:${lead.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Telepon"
                            className="grid h-7 w-7 place-items-center rounded-lg border border-white/[0.1] bg-white/[0.05] text-slate-200 transition hover:border-sky-400/40 hover:bg-sky-500/15 hover:text-sky-200"
                          >
                            <Icon icon="solar:phone-bold" className="text-[13px]" />
                          </a>
                          <a
                            href={`https://wa.me/${phoneDigits}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-2.5 text-[10px] font-bold text-emerald-100 shadow-[0_2px_8px_-2px_rgba(16,185,129,0.4)] transition hover:bg-emerald-500/30"
                          >
                            <Icon icon="ic:baseline-whatsapp" className="text-[13px]" />
                            Chat
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
                </SwipeableLeadRow>
              );
            })}
            </AnimatePresence>
          )}
        </div>
      </div>

      <ClaimedTitipModal data={titip.claimed} onClose={titip.closeClaimed} />
      <TitipToast toast={titip.toast} />

      <LeadDetailSheet
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onSaved={(updates) => {
          // Optimistic update: langsung patch lead di list supaya UI sinkron
          // walau refetch backend belum selesai
          const targetId = selectedLead?.id;
          if (targetId) {
            setAllLeads((prev) =>
              prev.map((l) =>
                l.id === targetId
                  ? {
                      ...l,
                      status: updates.status,
                      clientName: updates.clientName,
                      phone: updates.phone,
                      ageMinutes: 0,
                    }
                  : l,
              ),
            );
          }
          // Tetap trigger refetch supaya data 100% selaras dgn DB
          setRefreshTick((t) => t + 1);
        }}
      />
      </Card>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   3. TOTAL REVENUE  (grouped bars per day)
   ──────────────────────────────────────────────────────────────────── */

function TotalRevenueCard() {
  const days = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  const groups = [
    { name: "Online",  color: EMERALD.primary, data: [13, 16, 6, 15, 11, 16, 19] },
    { name: "Offline", color: EMERALD.pale,    data: [12, 13, 22, 7, 11, 13, 12] },
  ];

  return (
    <Card className="h-full">
      <CardHeader title="Total Revenue" subtitle="Komisi mingguan (Jt)" />
      <div className="px-6">
        <GroupedBarChart categories={days} groups={groups} height={220} />
      </div>
      <div className="flex items-center justify-center gap-6 px-6 pb-6 pt-1">
        {groups.map((g) => (
          <div key={g.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} />
            <span className="text-[11px] text-slate-400">{g.name}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────
   4. CUSTOMER SATISFACTION → KONVERSI LEAD  (area)
   ──────────────────────────────────────────────────────────────────── */

function ConversionCard() {
  const labels = ["W1", "W2", "W3", "W4"];
  const previous = [42, 55, 48, 60];
  const current  = [55, 68, 64, 78];

  const sumCur  = current.reduce((a, b) => a + b, 0);
  const sumPrev = previous.reduce((a, b) => a + b, 0);

  return (
    <Card className="h-full">
      <CardHeader title="Konversi Lead" subtitle="Persentase lead → closing" />
      <div className="px-4">
        <AreaCompareChart current={current} previous={previous} labels={labels} height={220} />
      </div>
      <div className="grid grid-cols-2 gap-3 px-6 pb-6 pt-1">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-700" />
            <span className="text-[10px] text-slate-500">Bulan Lalu</span>
          </div>
          <p className="mt-1 text-base font-bold text-white">${sumPrev.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/[0.06] px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-[10px] text-slate-500">Bulan Ini</span>
          </div>
          <p className="mt-1 text-base font-bold text-emerald-300">${sumCur.toLocaleString()}</p>
        </div>
      </div>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────
   5. TARGET vs REALISASI
   ────────────────────────────────────────────────────────────────────
   Data nyata dari /api/dashboard/agent/target:
   - 7 bulan terakhir (incl. bulan ini)
   - target_komisi disimpan di tabel target_agent (per agent per bulan)
   - aktual dihitung dari sum(detail_transaksi.pendapatan) join transaksi
   - Card menampilkan: bar chart (Jt rupiah), achievement % bulan ini,
     dan tombol "Kelola Target" (modal input per bulan)
   ──────────────────────────────────────────────────────────────────── */

interface TargetApi {
  ok: boolean;
  agent_id: string;
  can_edit: boolean;
  months: { year: number; month: number; label: string }[];
  target: number[];
  actual: number[];
  summary: {
    target_window: number;
    actual_window: number;
    achievement_pct: number | null;
  };
}

function formatJt(n: number): string {
  // Convert rupiah ke juta dengan 1 desimal kalau perlu
  const jt = n / 1_000_000;
  if (jt === 0) return "0";
  if (jt >= 100) return jt.toFixed(0);
  if (jt >= 10) return jt.toFixed(1).replace(/\.0$/, "");
  return jt.toFixed(2).replace(/\.?0+$/, "");
}

function TargetRealityCard() {
  const [data, setData] = useState<TargetApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dashboard/agent/target", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      setData(json as TargetApi);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Bulan ini = item terakhir di window
  const currentIdx = data ? data.months.length - 1 : -1;
  const targetNow = currentIdx >= 0 ? data!.target[currentIdx] ?? 0 : 0;
  const actualNow = currentIdx >= 0 ? data!.actual[currentIdx] ?? 0 : 0;
  const pctNow =
    targetNow > 0 ? Math.min(999, Math.round((actualNow / targetNow) * 100)) : null;
  const ach = data?.summary.achievement_pct ?? null;

  // Untuk chart — convert ke juta untuk readability
  const chartMonths = data?.months.map((m) => m.label) ?? [];
  const chartReality = data?.actual.map((n) => Math.round((n / 1_000_000) * 100) / 100) ?? [];
  const chartTarget = data?.target.map((n) => Math.round((n / 1_000_000) * 100) / 100) ?? [];

  return (
    <Card className="h-full">
      <div className="flex items-start justify-between px-6 pb-3 pt-6">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">
            Target vs Realisasi
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Komisi bulanan dalam juta (Jt) — 7 bulan terakhir
          </p>
        </div>
        {data?.can_edit && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/25 bg-emerald-500/[0.08] px-2.5 py-1 text-[10px] font-bold text-emerald-200 hover:bg-emerald-500/[0.15] transition"
          >
            <Icon icon="solar:settings-bold-duotone" className="text-[12px]" />
            Kelola Target
          </button>
        )}
      </div>

      {loading ? (
        <div className="px-6 pb-6 space-y-2">
          <div className="h-[200px] animate-pulse rounded-xl bg-white/[0.03]" />
          <div className="h-12 animate-pulse rounded-xl bg-white/[0.025]" />
          <div className="h-12 animate-pulse rounded-xl bg-white/[0.025]" />
        </div>
      ) : error ? (
        <div className="flex h-[200px] flex-col items-center justify-center px-6 text-center">
          <Icon
            icon="solar:danger-triangle-bold-duotone"
            className="text-3xl text-rose-300 mb-2"
          />
          <p className="text-[12px] font-semibold text-rose-200">Gagal memuat target</p>
          <p className="mt-1 text-[11px] text-slate-500">{error}</p>
        </div>
      ) : !data || (data.target.every((t) => t === 0) && data.actual.every((a) => a === 0)) ? (
        <div className="flex h-[280px] flex-col items-center justify-center px-6 text-center">
          <div className="relative grid h-14 w-14 place-items-center rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.06]">
            <span className="pointer-events-none absolute inset-0 rounded-2xl bg-emerald-500/[0.08] blur-md" />
            <Icon
              icon="solar:target-bold-duotone"
              className="relative text-3xl text-emerald-300"
            />
          </div>
          <p className="mt-3 text-sm font-semibold text-white">Belum ada target</p>
          <p className="mt-1 max-w-[260px] text-[11px] text-slate-500">
            Set target komisi bulanan untuk lihat progress aktual vs target Anda.
          </p>
          {data?.can_edit && (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-400 to-teal-400 px-3.5 py-2 text-[11px] font-extrabold tracking-wide text-[#05070D] shadow-[0_6px_18px_-4px_rgba(52,211,153,0.65)] hover:shadow-[0_10px_26px_-6px_rgba(52,211,153,0.9)] active:scale-[0.97] transition"
            >
              <Icon icon="solar:add-circle-bold" className="text-[13px]" />
              Atur Target Pertama
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="px-4">
            <TargetRealityBars
              categories={chartMonths}
              reality={chartReality}
              target={chartTarget}
              height={200}
            />
          </div>
          <div className="space-y-2 px-6 pb-6 pt-1">
            {/* Bulan ini */}
            <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/[0.05] px-3 py-2.5">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/20 border border-emerald-400/25 flex items-center justify-center">
                  <Icon icon="solar:cup-star-bold-duotone" className="text-base text-emerald-300" />
                </div>
                <div className="flex-1 leading-tight">
                  <p className="text-[11px] font-semibold text-white">
                    Realisasi bulan ini
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Rp {actualNow.toLocaleString("id-ID")}
                  </p>
                </div>
                {pctNow !== null && (
                  <p
                    className={`text-sm font-extrabold tabular-nums ${
                      pctNow >= 100
                        ? "text-emerald-300"
                        : pctNow >= 70
                        ? "text-emerald-200/85"
                        : "text-amber-300"
                    }`}
                  >
                    {pctNow}%
                  </p>
                )}
              </div>
              {pctNow !== null && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className={`h-full rounded-full ${
                      pctNow >= 100
                        ? "bg-gradient-to-r from-emerald-300 to-teal-400"
                        : pctNow >= 70
                        ? "bg-gradient-to-r from-emerald-400 to-emerald-300"
                        : "bg-gradient-to-r from-amber-400 to-amber-300"
                    } shadow-[0_0_10px_rgba(52,211,153,0.45)] transition-[width] duration-700`}
                    style={{ width: `${Math.min(100, pctNow)}%` }}
                  />
                </div>
              )}
            </div>

            {/* Target bulan ini */}
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              <div className="h-8 w-8 rounded-lg bg-emerald-200/10 border border-emerald-200/20 flex items-center justify-center">
                <Icon icon="solar:target-bold-duotone" className="text-base text-emerald-100" />
              </div>
              <div className="flex-1 leading-tight">
                <p className="text-[11px] font-semibold text-white">Target bulan ini</p>
                <p className="text-[10px] text-slate-500">
                  {targetNow > 0
                    ? `Rp ${targetNow.toLocaleString("id-ID")}`
                    : "Belum di-set"}
                </p>
              </div>
              <p className="text-sm font-bold text-emerald-100 tabular-nums">
                {formatJt(targetNow)} Jt
              </p>
            </div>

            {/* Ringkasan window */}
            {ach !== null && (
              <div className="text-center text-[10.5px] text-slate-500">
                Pencapaian 7 bulan:{" "}
                <span
                  className={`font-bold ${
                    ach >= 100 ? "text-emerald-300" : "text-emerald-200/70"
                  }`}
                >
                  {ach}%
                </span>{" "}
                · Rp {data.summary.actual_window.toLocaleString("id-ID")} dari Rp{" "}
                {data.summary.target_window.toLocaleString("id-ID")}
              </div>
            )}
          </div>
        </>
      )}

      {showModal && data && (
        <KelolaTargetModal
          data={data}
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────
   KelolaTargetModal — edit target komisi bulanan
   ──────────────────────────────────────────────────────────────────── */

function KelolaTargetModal({
  data,
  onClose,
  onSaved,
}: {
  data: TargetApi;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Editable copy — sebagai rupiah penuh (bukan juta)
  const [values, setValues] = useState<number[]>(() => [...data.target]);
  const [saving, setSaving] = useState(false);
  const [savedIdx, setSavedIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const setValue = (idx: number, raw: string) => {
    // Strip non-digit
    const digits = raw.replace(/\D/g, "");
    const n = digits ? Number(digits) : 0;
    setValues((curr) => {
      const next = [...curr];
      next[idx] = n;
      return next;
    });
  };

  const formatRpInput = (n: number) =>
    n === 0 ? "" : n.toLocaleString("id-ID");

  const saveOne = async (idx: number) => {
    const m = data.months[idx]!;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/agent/target", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tahun: m.year,
          bulan: m.month,
          target_komisi: values[idx],
          id_agent: data.agent_id,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      setSavedIdx(idx);
      window.setTimeout(() => setSavedIdx(null), 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const saveAll = async () => {
    setSaving(true);
    setError(null);
    try {
      // Sequential biar mudah debug + tidak hammer DB
      for (let i = 0; i < data.months.length; i++) {
        const m = data.months[i]!;
        if (values[i] === data.target[i]) continue; // unchanged
        const res = await fetch("/api/dashboard/agent/target", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            tahun: m.year,
            bulan: m.month,
            target_komisi: values[i],
            id_agent: data.agent_id,
          }),
        });
        const j = await res.json();
        if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const copyToAll = () => {
    // Ambil nilai pertama yang > 0, copy ke semua slot kosong (== 0)
    const seed = values.find((v) => v > 0) ?? 0;
    if (seed === 0) return;
    setValues((curr) => curr.map((v) => (v === 0 ? seed : v)));
  };

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg max-h-[92vh] rounded-[24px] p-[1px] bg-[linear-gradient(140deg,rgba(110,231,183,0.6)_0%,rgba(45,212,191,0.2)_50%,rgba(110,231,183,0.55)_100%)] shadow-[0_40px_120px_rgba(0,0,0,0.75)]"
      >
        <div className="relative flex max-h-[calc(92vh-2px)] flex-col overflow-hidden rounded-[23px] bg-gradient-to-br from-[#0B0F17] via-[#070A11] to-[#0B0F17]">
          {/* Aurora */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-20 -left-12 h-56 w-56 rounded-full bg-emerald-400/15 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-16 -right-12 h-56 w-56 rounded-full bg-teal-400/10 blur-3xl"
          />

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="absolute top-4 right-4 z-10 h-9 w-9 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition"
          >
            <Icon icon="solar:close-circle-bold" className="text-white/55 text-lg" />
          </button>

          {/* Header */}
          <div className="relative px-6 pt-6 pb-3">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl border border-emerald-400/35 bg-gradient-to-br from-emerald-300/20 to-teal-500/5 shadow-[0_0_28px_rgba(52,211,153,0.3)]">
                <Icon
                  icon="solar:target-bold-duotone"
                  className="text-emerald-300 text-2xl"
                />
              </div>
              <div>
                <h3 className="text-white font-black text-[18px] tracking-tight">
                  Kelola Target Komisi
                </h3>
                <p className="text-[11.5px] text-white/55">
                  Atur target bulanan Anda. Aktual diisi otomatis dari transaksi.
                </p>
              </div>
            </div>
          </div>

          {/* List */}
          <div className="relative flex-1 min-h-0 overflow-y-auto px-6 py-3 space-y-2">
            {data.months.map((m, idx) => {
              const actual = data.actual[idx] ?? 0;
              const isCurrent = idx === data.months.length - 1;
              return (
                <div
                  key={`${m.year}-${m.month}`}
                  className={`rounded-xl border p-3 transition-colors ${
                    isCurrent
                      ? "border-emerald-400/30 bg-emerald-500/[0.05]"
                      : "border-white/[0.06] bg-white/[0.015]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[11px] font-extrabold uppercase tracking-[0.16em] ${
                          isCurrent ? "text-emerald-200" : "text-white/65"
                        }`}
                      >
                        {m.label} {m.year}
                      </span>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/20 px-1.5 py-[1px] text-[8.5px] font-bold uppercase tracking-wider text-emerald-200 ring-1 ring-emerald-400/30">
                          Bulan Ini
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-white/40">
                      Aktual:{" "}
                      <span className="font-bold text-emerald-300/85 tabular-nums">
                        Rp {actual.toLocaleString("id-ID")}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold text-white/45 shrink-0">Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatRpInput(values[idx] ?? 0)}
                      onChange={(e) => setValue(idx, e.target.value)}
                      placeholder="0"
                      className="flex-1 min-w-0 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[14px] font-bold tabular-nums text-white placeholder-white/20 focus:border-emerald-400/40 focus:bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-400/15 transition"
                    />
                    <button
                      type="button"
                      onClick={() => saveOne(idx)}
                      disabled={saving || values[idx] === data.target[idx]}
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition ${
                        savedIdx === idx
                          ? "border-emerald-400/55 bg-emerald-400/15 text-emerald-200"
                          : saving || values[idx] === data.target[idx]
                          ? "border-white/5 bg-white/[0.02] text-white/25 cursor-not-allowed"
                          : "border-emerald-400/30 bg-emerald-500/[0.08] text-emerald-200 hover:bg-emerald-500/[0.15]"
                      }`}
                      aria-label="Simpan bulan ini"
                    >
                      <Icon
                        icon={
                          savedIdx === idx
                            ? "solar:check-circle-bold"
                            : "solar:diskette-bold-duotone"
                        }
                        className="text-[15px]"
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="relative border-t border-white/[0.06] bg-white/[0.015] px-6 py-3">
            {error && (
              <p className="mb-2 text-[11px] text-rose-300">
                <Icon
                  icon="solar:danger-triangle-bold-duotone"
                  className="inline text-[13px] -mt-0.5 mr-1"
                />
                {error}
              </p>
            )}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={copyToAll}
                disabled={saving}
                className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-300/80 hover:text-emerald-200 transition disabled:opacity-50"
                title="Salin nilai pertama ke semua bulan yang masih kosong"
              >
                <Icon icon="solar:copy-bold-duotone" className="text-[13px]" />
                Salin ke bulan kosong
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] font-bold text-white/65 hover:bg-white/[0.06] transition disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={saveAll}
                  disabled={saving}
                  className="relative inline-flex items-center gap-1.5 overflow-hidden rounded-lg bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 px-4 py-2 text-[11.5px] font-extrabold tracking-wide text-[#05070D] shadow-[0_6px_18px_-4px_rgba(52,211,153,0.65)] hover:shadow-[0_10px_26px_-6px_rgba(52,211,153,0.9)] active:scale-[0.97] transition disabled:opacity-60"
                >
                  {saving ? (
                    <Icon icon="line-md:loading-loop" className="text-[14px]" />
                  ) : (
                    <Icon icon="solar:diskette-bold" className="text-[13px]" />
                  )}
                  {saving ? "Menyimpan…" : "Simpan Semua"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   6. TOP LISTINGS
   ──────────────────────────────────────────────────────────────────── */

function TopListingsCard() {
  const rows = [
    { name: "Rumah Minimalis Citraland",   pop: 88, color: EMERALD.bright },
    { name: "Apartemen 2BR View Kota",     pop: 72, color: EMERALD.primary },
    { name: "Ruko Strategis Jalan Utama",  pop: 56, color: EMERALD.deep },
    { name: "Villa Modern Bali View",      pop: 44, color: EMERALD.pale },
  ];

  return (
    <Card className="h-full">
      <CardHeader title="Top Listings" subtitle="Listing paling diminati" />
      <div className="px-6 pb-6">
        <div className="grid grid-cols-[20px_1fr_90px_50px] items-center gap-3 border-b border-white/[0.05] pb-2 text-[10px] uppercase tracking-widest text-slate-600">
          <span>#</span>
          <span>Nama</span>
          <span>Popularitas</span>
          <span className="text-right">Sales</span>
        </div>
        <div className="mt-2 space-y-3">
          {rows.map((r, i) => (
            <div key={r.name} className="grid grid-cols-[20px_1fr_90px_50px] items-center gap-3">
              <span className="text-xs text-slate-500">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-xs font-medium text-slate-200 truncate">{r.name}</span>
              <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${r.pop}%`, background: r.color }}
                />
              </div>
              <span
                className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300 text-center"
                style={{ borderColor: r.color + "40", color: r.color }}
              >
                {r.pop}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────
   7. SALES MAPPING (regions)
   ──────────────────────────────────────────────────────────────────── */

/* ── kota name → approximate [x, y] on SVG viewBox 0 0 200 80
   (Indonesia lon 95–141°E, lat 6°N–11°S mapped linearly) ── */
const KOTA_COORDS: Record<string, [number, number]> = {
  // Jawa
  jakarta: [51, 54], "jakarta pusat": [51, 54], "jakarta selatan": [51, 55],
  "jakarta utara": [51, 52], "jakarta barat": [50, 54], "jakarta timur": [52, 54],
  "kota jakarta": [51, 54],
  bandung: [55, 56], semarang: [67, 53], surabaya: [78, 54],
  yogyakarta: [67, 56], malang: [79, 56], bogor: [52, 55],
  bekasi: [53, 54], depok: [52, 55], tangerang: [50, 54],
  "tangerang selatan": [50, 55], cirebon: [59, 54], solo: [72, 54],
  // Bali & Nusa Tenggara
  denpasar: [89, 57], bali: [89, 57], mataram: [94, 58],
  // Sumatera
  medan: [22, 32], palembang: [44, 48], pekanbaru: [31, 42],
  padang: [27, 46], batam: [37, 44], bandar_lampung: [48, 53],
  "bandar lampung": [48, 53], jambi: [38, 47], bengkulu: [33, 49],
  banda_aceh: [12, 28], "banda aceh": [12, 28],
  // Kalimantan
  pontianak: [63, 36], balikpapan: [94, 38], samarinda: [96, 35],
  banjarmasin: [86, 44], palangkaraya: [79, 38], "palangka raya": [79, 38],
  // Sulawesi
  makassar: [107, 53], manado: [130, 23], palu: [119, 38],
  kendari: [118, 53], gorontalo: [128, 28],
  // Maluku & Papua
  ambon: [144, 48], jayapura: [197, 38], sorong: [162, 33],
  // NTB/NTT
  kupang: [106, 62],
};

function cityToSvgCoords(name: string): [number, number] | null {
  const key = name.toLowerCase().trim();
  if (KOTA_COORDS[key]) return KOTA_COORDS[key];
  // partial match
  for (const [k, v] of Object.entries(KOTA_COORDS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
}

const PIN_COLORS = [EMERALD.bright, EMERALD.primary, EMERALD.deep, "#38bdf8", "#a78bfa"];

type SalesRegion = { name: string; count: number; pct: number };

function SalesMappingCard() {
  const [regions, setRegions] = useState<SalesRegion[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/agent/sales-distribution", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok) {
          setRegions(json.regions ?? []);
          setTotal(json.total ?? 0);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const pins = regions
    .map((r, i) => ({ ...r, coords: cityToSvgCoords(r.name), color: PIN_COLORS[i] ?? "#475569" }))
    .filter((r) => r.coords !== null);

  return (
    <Card className="h-full">
      <CardHeader
        title="Sebaran Penjualan"
        subtitle={loading ? "Memuat data…" : total > 0 ? `${total} listing aktif` : "Per wilayah Indonesia"}
      />
      <div className="px-6 pb-6">
        {/* Peta Indonesia SVG */}
        <div className="relative h-36 rounded-2xl border border-white/[0.06] bg-gradient-to-br from-emerald-500/[0.04] to-transparent overflow-hidden">
          <svg viewBox="0 0 200 80" className="absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id="idn-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={EMERALD.bright} stopOpacity="0.45" />
                <stop offset="100%" stopColor={EMERALD.deep} stopOpacity="0.12" />
              </linearGradient>
              <filter id="pin-glow">
                <feGaussianBlur stdDeviation="1.2" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* ── Sumatera ── */}
            <path
              d="M8,27 Q11,19 17,20 Q22,21 28,26 Q34,32 38,40 Q42,48 44,54 Q40,58 35,57 Q30,55 24,49 Q17,42 12,35 Q8,31 8,27 Z"
              fill="url(#idn-grad)" stroke={EMERALD.primary} strokeWidth="0.4" opacity="0.85"
            />
            {/* ── Jawa ── */}
            <path
              d="M48,52 Q58,49 70,50 Q82,50 92,52 Q100,54 104,57 L102,61 Q92,63 78,62 Q64,60 54,58 Q48,56 48,52 Z"
              fill="url(#idn-grad)" stroke={EMERALD.primary} strokeWidth="0.4" opacity="0.85"
            />
            {/* ── Bali ── */}
            <ellipse cx="107" cy="59" rx="3.5" ry="2" fill="url(#idn-grad)" stroke={EMERALD.primary} strokeWidth="0.4" opacity="0.85" />
            {/* ── Lombok & Sumbawa ── */}
            <ellipse cx="113" cy="60" rx="2.5" ry="1.5" fill="url(#idn-grad)" stroke={EMERALD.primary} strokeWidth="0.3" opacity="0.7" />
            <ellipse cx="120" cy="61" rx="4" ry="1.8" fill="url(#idn-grad)" stroke={EMERALD.primary} strokeWidth="0.3" opacity="0.7" />
            {/* ── Flores + Timor ── */}
            <path d="M128,62 Q136,60 144,62 L143,65 Q135,66 128,65 Z" fill="url(#idn-grad)" stroke={EMERALD.primary} strokeWidth="0.3" opacity="0.65" />
            <path d="M148,63 Q156,61 162,63 L161,66 Q154,67 148,66 Z" fill="url(#idn-grad)" stroke={EMERALD.primary} strokeWidth="0.3" opacity="0.55" />
            {/* ── Kalimantan ── */}
            <path
              d="M62,14 Q72,10 85,11 Q98,12 108,17 Q116,22 118,30 Q119,40 114,47 Q108,52 98,54 Q87,55 76,52 Q66,48 61,40 Q57,32 62,14 Z"
              fill="url(#idn-grad)" stroke={EMERALD.primary} strokeWidth="0.4" opacity="0.85"
            />
            {/* ── Sulawesi ── (simplified K-shape) */}
            <path
              d="M120,22 Q124,19 128,22 L127,35 Q131,31 136,26 Q141,24 144,28 L140,34 Q135,40 130,44 L133,54 Q130,58 127,56 L125,44 Q121,40 120,35 Z"
              fill="url(#idn-grad)" stroke={EMERALD.primary} strokeWidth="0.4" opacity="0.85"
            />
            {/* ── Maluku (Halmahera + Ambon area) ── */}
            <path d="M147,23 Q150,20 153,22 L152,32 Q155,28 158,24 Q161,22 163,25 L160,32 Q157,37 155,40 L153,44 Q150,46 148,44 L148,34 Q146,30 147,23 Z"
              fill="url(#idn-grad)" stroke={EMERALD.primary} strokeWidth="0.3" opacity="0.7" />
            <ellipse cx="143" cy="47" rx="3" ry="2.5" fill="url(#idn-grad)" stroke={EMERALD.primary} strokeWidth="0.3" opacity="0.65" />
            {/* ── Papua ── */}
            <path
              d="M160,28 Q170,22 182,22 Q194,22 200,28 Q200,36 197,42 Q193,48 184,50 Q172,52 163,48 Q158,44 158,36 Q158,30 160,28 Z"
              fill="url(#idn-grad)" stroke={EMERALD.primary} strokeWidth="0.4" opacity="0.85"
            />

            {/* ── Hot pins untuk top-5 kota ── */}
            {pins.map((r, i) => {
              const [cx, cy] = r.coords!;
              const isPrimary = i === 0;
              return (
                <g key={r.name} filter="url(#pin-glow)">
                  {isPrimary && (
                    <circle cx={cx} cy={cy} r="5" fill={r.color} opacity="0.25">
                      <animate attributeName="r" values="4;7;4" dur="2.2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.25;0.08;0.25" dur="2.2s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <circle cx={cx} cy={cy} r={isPrimary ? 3 : 2} fill={r.color} opacity="0.95" />
                  <circle cx={cx} cy={cy} r={isPrimary ? 1.2 : 0.8} fill="white" opacity="0.9" />
                </g>
              );
            })}
          </svg>
        </div>

        <div className="mt-4 space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-5 rounded-lg bg-white/[0.04] animate-pulse" />
            ))
          ) : regions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-4 text-slate-500">
              <Icon icon="solar:map-point-bold-duotone" className="text-3xl mb-1 text-slate-600" />
              <p className="text-xs">Belum ada data listing</p>
            </div>
          ) : (
            regions.map((r, i) => {
              const color = PIN_COLORS[i] ?? "#475569";
              return (
                <div key={r.name} className="flex items-center gap-3">
                  <span className="w-4 text-[10px] font-bold tabular-nums text-slate-500">#{i + 1}</span>
                  <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: color }} />
                  <span className="flex-1 truncate text-xs text-slate-300">{r.name}</span>
                  <div className="h-1 w-20 flex-shrink-0 overflow-hidden rounded-full bg-white/[0.05]">
                    <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${r.pct}%`, background: color }} />
                  </div>
                  <span className="w-10 text-right text-[10px] font-semibold tabular-nums text-slate-400">
                    {r.count} <span className="text-slate-600">({r.pct}%)</span>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────
   8. VOLUME vs SERVICE LEVEL
   ──────────────────────────────────────────────────────────────────── */

function VolumeServiceCard() {
  const labels = ["W1", "W2", "W3", "W4", "W5", "W6"];
  const bottom = [22, 35, 28, 40, 30, 25];   // volume
  const top    = [12, 18, 14, 20, 16, 13];   // service

  return (
    <Card className="h-full">
      <CardHeader title="Volume vs Layanan" subtitle="Inquiry & response per minggu" />
      <div className="px-4">
        <StackedBarChart
          categories={labels}
          bottom={bottom}
          top={top}
          bottomColor={EMERALD.primary}
          topColor={EMERALD.deep}
          height={200}
        />
      </div>
      <div className="flex items-center justify-around px-6 pb-6 pt-1">
        <div className="text-center">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-[11px] text-slate-400">Volume</span>
          </div>
          <p className="mt-1 text-sm font-bold text-white">{bottom.reduce((a, b) => a + b, 0)}</p>
        </div>
        <div className="h-8 w-px bg-white/10" />
        <div className="text-center">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-700" />
            <span className="text-[11px] text-slate-400">Layanan</span>
          </div>
          <p className="mt-1 text-sm font-bold text-white">{top.reduce((a, b) => a + b, 0)}</p>
        </div>
      </div>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────
   PUBLIC: Premium Agent Dashboard layout (3 rows, emerald dark)
   ──────────────────────────────────────────────────────────────────── */

export function PremiumAgentDashboard() {
  // Dipanggil sekali di sini lalu di-pass sebagai props ke 4 tile.
  // Sebelumnya setiap tile memanggil hook sendiri → 4 request paralel ke
  // /api/dashboard/agent/kpi-cards. Sekarang cukup 1 request.
  const kpi = useAgentKpiCards();

  // Auto-scroll ke kalender bila dibuka lewat link email pengingat acara
  // (mis. /dashboard#kalender). Dashboard di-load async (dynamic import +
  // data), jadi hash-scroll native browser tidak jalan — kita polling
  // elemennya lalu scroll manual begitu muncul.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#kalender") return;
    let tries = 0;
    const timer = setInterval(() => {
      const el = document.getElementById("kalender");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        clearInterval(timer);
      } else if (++tries > 40) {
        clearInterval(timer); // menyerah setelah ~10 detik
      }
    }, 250);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      {/* ROW 1 — KPI STRIP: 4 uniform premium tiles
         Mobile: 2 kolom (2x2 grid, bukan vertikal)
         Desktop: 4 kolom sebaris */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <PendapatanTile loading={kpi.loading} data={kpi.data} />
        <TransaksiTile loading={kpi.loading} data={kpi.data} />
        <ListingTile loading={kpi.loading} data={kpi.data} />
        <LeadsTile loading={kpi.loading} data={kpi.data} />
      </div>


      {/* ROW 2 — Calendar (wide) + right column = Upcoming Events (top)
         + Hot Leads (bottom). On desktop the right column is locked to
         the calendar's height: the inner stack is absolutely positioned
         inside an empty grid item that gets stretched by `items-stretch`,
         so the calendar's natural height defines the row and the right
         cards scroll internally when content overflows. On mobile/tablet
         the column reverts to a natural vertical stack. */}
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-3 lg:items-stretch">
        <div id="kalender" className="lg:col-span-2 min-w-0 scroll-mt-24">
          <AgentCalendar compact />
        </div>

        <div className="relative lg:col-span-1 min-w-0">
          {/* NOTE: no `overflow-hidden` on these wrappers — clipping would
             eat the emerald halo + outer glow that pulses when the user
             scrolls here from the Total Leads tile. The cards themselves
             already self-contain their content via Card's own overflow. */}
          <div className="flex flex-col gap-3 sm:gap-4 lg:absolute lg:inset-0">
            <div className="min-w-0 lg:basis-[42%] lg:shrink-0 lg:grow-0 lg:min-h-0">
              <UpcomingEventsCard />
            </div>
            <div className="min-w-0 lg:flex-1 lg:min-h-0">
              <HotLeadsCard />
            </div>
          </div>
        </div>
      </div>

      {/* ROW 3 — Performa: Performa Listing (1/3, kiri, sejajar lebar Hot
         Leads di row sebelumnya) + Total Penjualan (2/3, kanan).
         Listing card kasih "kerjaan saya hari ini apa" (top performers +
         listings perlu di-boost) supaya agent langsung tahu listing mana
         yang harus difokuskan untuk closing. Keduanya sejajar tinggi via
         items-stretch + h-full. */}
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-3 lg:items-stretch">
        {/* Listing wrapper sengaja di-flex column di lg+ supaya h-full di
            ListingPerformanceCard reliably resolves ke row height yang
            di-set oleh items-stretch (di kondisi tertentu, h-full child
            di block-wrapper biasa tidak propagate kalau intrinsic height
            child < row height). Dengan flex col wrapper, child explicitly
            ngambil 100% tinggi container. List internal sudah punya
            `flex-1 min-h-0 overflow-y-auto` jadi konten yang melebihi
            tinggi card auto-scroll. */}
        <div className="min-w-0 lg:col-span-1 lg:flex lg:flex-col">
          <ListingPerformanceCard />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <PenjualanCard />
        </div>
      </div>

      {/* ROW 4 — Jaringan Referral: full-width, semua downline tree */}
      <NetworkReferralCard />
    </div>
  );
}

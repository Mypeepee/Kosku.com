"use client";

import { useMemo, useRef, useState, type FocusEvent, type MouseEvent } from "react";
import { Layers3 } from "lucide-react";
import type { ProjectDetailViewModel } from "./types";
import { cn, formatIDR, formatPercent, safeDivide, toNumber } from "./utils";
import { EmptyState, SectionCard } from "./shared";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type Tone = {
  dot: string;
  bar: string;
  text: string;
  border: string;
  soft: string;
  ring: string;
};

type BaseItem = {
  id: string;
  label: string;
  labelShort: string;
  value: number;
  description: string;
};

type AllocationItem = BaseItem & {
  ratioToTarget: number;
  shareOfAllocated: number;
  displayRatio: number;
  tone: Tone;
};

type HoveredState = { item: AllocationItem; x: number };

/* ─── Constants ──────────────────────────────────────────────────────────── */

const TOOLTIP_WIDTH = 268;
const TOOLTIP_HALF = TOOLTIP_WIDTH / 2;

const TONES: Tone[] = [
  {
    dot: "bg-[#d9b46b]",
    bar: "from-[#b88b43] via-[#cfab67] to-[#e2c68f]",
    text: "text-[#e7cb98]",
    border: "border-[#d9b46b]/20",
    soft: "bg-[#d9b46b]/[0.07]",
    ring: "shadow-[0_0_24px_rgba(217,180,107,0.15)]",
  },
  {
    dot: "bg-[#83a7c2]",
    bar: "from-[#5f7f98] via-[#7f9db5] to-[#abc4d6]",
    text: "text-[#b7cfde]",
    border: "border-[#83a7c2]/20",
    soft: "bg-[#83a7c2]/[0.07]",
    ring: "shadow-[0_0_24px_rgba(131,167,194,0.12)]",
  },
  {
    dot: "bg-[#88aa97]",
    bar: "from-[#5f7d6a] via-[#7ea18c] to-[#a8c1b2]",
    text: "text-[#bad2c1]",
    border: "border-[#88aa97]/20",
    soft: "bg-[#88aa97]/[0.07]",
    ring: "shadow-[0_0_24px_rgba(136,170,151,0.12)]",
  },
  {
    dot: "bg-[#9a8ab3]",
    bar: "from-[#6e638a] via-[#8a7aa8] to-[#b3a5c9]",
    text: "text-[#c7bdd8]",
    border: "border-[#9a8ab3]/20",
    soft: "bg-[#9a8ab3]/[0.07]",
    ring: "shadow-[0_0_24px_rgba(154,138,179,0.12)]",
  },
  {
    dot: "bg-[#b58d87]",
    bar: "from-[#8a6761] via-[#a9817a] to-[#cfaaa2]",
    text: "text-[#dcc0bb]",
    border: "border-[#b58d87]/20",
    soft: "bg-[#b58d87]/[0.07]",
    ring: "shadow-[0_0_24px_rgba(181,141,135,0.10)]",
  },
  {
    dot: "bg-[#8f98a6]",
    bar: "from-[#65707f] via-[#8590a1] to-[#b5bfcb]",
    text: "text-[#c6cfda]",
    border: "border-[#8f98a6]/20",
    soft: "bg-[#8f98a6]/[0.07]",
    ring: "shadow-[0_0_22px_rgba(143,152,166,0.10)]",
  },
];

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function compactMoney(value: number) {
  const safe = value || 0;
  const abs = Math.abs(safe);
  if (abs >= 1_000_000_000)
    return `Rp ${(safe / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`;
  if (abs >= 1_000_000)
    return `Rp ${(safe / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} Jt`;
  if (abs >= 1_000)
    return `Rp ${(safe / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} Rb`;
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(safe);
}

function clampTooltipX(center: number, cw: number) {
  if (cw <= TOOLTIP_WIDTH) return cw / 2;
  return Math.min(Math.max(center, TOOLTIP_HALF), cw - TOOLTIP_HALF);
}

/* ─── Tooltip ────────────────────────────────────────────────────────────── */

function Tooltip({ hovered }: { hovered: HoveredState | null }) {
  if (!hovered) return null;
  const { item, x } = hovered;

  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-[999] -translate-x-1/2 -translate-y-[calc(100%+14px)]"
      style={{ left: x, width: TOOLTIP_WIDTH }}
    >
      <div className="relative overflow-hidden rounded-[20px] border border-white/12 bg-[#090e18] p-4 shadow-[0_28px_64px_rgba(0,0,0,0.76)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />

        <div className="relative space-y-3">
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full flex-shrink-0", item.tone.dot)} />
            <span className="text-sm font-semibold text-white">{item.label}</span>
          </div>

          <div>
            <p className={cn("text-xl font-bold leading-none tracking-[-0.04em]", item.tone.text)}>
              {compactMoney(item.value)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">{formatIDR(item.value)}</p>
          </div>

          <div className="flex items-center gap-2.5 text-[11px]">
            <span className={cn("font-semibold", item.tone.text)}>
              {formatPercent(item.ratioToTarget)} dari target
            </span>
            <span className="h-1 w-1 flex-shrink-0 rounded-full bg-slate-700" />
            <span className="text-slate-500">
              {formatPercent(item.shareOfAllocated)} dari total
            </span>
          </div>

          <div className="border-t border-white/[0.07] pt-2.5 text-[11px] leading-relaxed text-slate-400">
            {item.description}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Segmented Bar Strip ────────────────────────────────────────────────── */

function AllocationStrip({
  items,
  allocatedRatio,
  targetLineRatio,
  isOver,
  onEnter,
  onLeave,
}: {
  items: AllocationItem[];
  allocatedRatio: number;
  targetLineRatio: number | null;
  isOver: boolean;
  onEnter: (item: AllocationItem, e: MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>) => void;
  onLeave: () => void;
}) {
  const pct = Math.round(allocatedRatio * 100);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#091018]/90 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      {/* Bar */}
      <div className="relative h-7 overflow-hidden rounded-[14px] border border-white/[0.06] bg-[#0c131c]">
        {/* Grid lines */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.025)_0,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[length:25%_100%]" />
        {/* Shimmer */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,transparent_50%,rgba(255,255,255,0.015)_100%)]" />

        {/* Segments */}
        <div className="flex h-full w-full">
          {items.map((item) => {
            const w = Math.max(item.displayRatio * 100, item.displayRatio > 0 ? 1.5 : 0);
            return (
              <button
                key={item.id}
                type="button"
                onMouseEnter={(e) => onEnter(item, e)}
                onMouseMove={(e) => onEnter(item, e)}
                onFocus={(e) => onEnter(item, e)}
                onBlur={onLeave}
                onMouseLeave={onLeave}
                className={cn(
                  "relative h-full bg-gradient-to-r transition-all duration-200 hover:brightness-110 focus:outline-none",
                  item.tone.bar
                )}
                style={{ width: `${w}%` }}
                aria-label={`${item.label}: ${formatIDR(item.value)}, ${formatPercent(item.ratioToTarget)} dari target`}
              >
                <span className="absolute inset-y-0 right-0 w-px bg-black/25" />
              </button>
            );
          })}
        </div>

        {/* Target line (only rendered when over-allocated) */}
        {targetLineRatio !== null && (
          <div
            className="pointer-events-none absolute inset-y-0 z-10"
            style={{ left: `${targetLineRatio * 100}%` }}
          >
            <div className="h-full w-[2px] bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.7)]" />
            <div className="absolute -top-[26px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-400/30 bg-amber-500/15 px-2 py-0.5 text-[8px] font-bold tracking-widest text-amber-300">
              TARGET
            </div>
          </div>
        )}
      </div>

      {/* Scale row */}
      <div className="mt-2 flex items-center justify-between px-0.5 text-[9px] uppercase tracking-[0.2em]">
        <span className="text-slate-600">0%</span>
        <span className={isOver ? "font-bold text-amber-500" : "text-slate-500"}>
          {pct}% dialokasikan{isOver ? " — melebihi target" : ""}
        </span>
        <span className={isOver ? "text-amber-500" : "text-slate-600"}>
          {isOver ? `+${pct - 100}%` : "100%"}
        </span>
      </div>
    </div>
  );
}

/* ─── Summary Stats Block ────────────────────────────────────────────────── */

function SummaryBlock({
  allocated,
  target,
  isOver,
  overAmount,
  underAmount,
}: {
  allocated: number;
  target: number;
  isOver: boolean;
  overAmount: number;
  underAmount: number;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border",
        isOver
          ? "border-amber-500/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.08)_0%,rgba(245,158,11,0.04)_60%,rgba(120,53,15,0.03)_100%)]"
          : "border-white/10 bg-white/[0.03]"
      )}
    >
      {/*
        Layout:
        - Mobile  : 2-col top (Dialokasikan | Target) + full-width bottom (Selisih)
        - sm+     : 3-col single row
        Prevents label collision and amount wrapping on narrow screens.
      */}
      <div className="grid grid-cols-2 sm:grid-cols-3">

        {/* ── Stat 1: Dialokasikan ─────────────────── */}
        <div className="px-4 py-3 sm:py-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
            Dialokasikan
          </p>
          <p className="mt-1.5 text-xl font-bold leading-none tracking-[-0.04em] text-white">
            {compactMoney(allocated)}
          </p>
          <p className="mt-1 truncate text-[10px] text-slate-600">{formatIDR(allocated)}</p>
        </div>

        {/* ── Stat 2: Target Dana ──────────────────── */}
        <div className="border-l border-white/[0.07] px-4 py-3 sm:py-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
            Target Dana
          </p>
          <p className="mt-1.5 text-xl font-bold leading-none tracking-[-0.04em] text-white">
            {compactMoney(target)}
          </p>
          <p className="mt-1 truncate text-[10px] text-slate-600">{formatIDR(target)}</p>
        </div>

        {/* ── Stat 3: Delta (full-width on mobile, 1-col on sm+) ── */}
        <div
          className={cn(
            "col-span-2 border-t border-white/[0.07] sm:col-span-1 sm:border-l sm:border-t-0",
            isOver ? "bg-amber-500/[0.04]" : ""
          )}
        >
          {isOver ? (
            /* Mobile: label-left / value-right row | sm+: stacked */
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:block sm:py-4">
              <p className="flex-shrink-0 text-[9px] font-bold uppercase tracking-[0.2em] text-amber-600/90">
                Kelebihan
              </p>
              <div className="min-w-0 text-right sm:text-left sm:mt-1.5">
                <p className="text-xl font-bold leading-none tracking-[-0.04em] text-amber-400">
                  +{compactMoney(overAmount)}
                </p>
                <p className="mt-1 hidden truncate text-[10px] text-amber-700 sm:block">
                  {formatIDR(overAmount)}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:block sm:py-4">
              <p className="flex-shrink-0 text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-600/80">
                Tersedia
              </p>
              <div className="min-w-0 text-right sm:text-left sm:mt-1.5">
                <p className="text-xl font-bold leading-none tracking-[-0.04em] text-emerald-400">
                  {compactMoney(underAmount)}
                </p>
                <p className="mt-1 hidden truncate text-[10px] text-slate-600 sm:block">
                  {formatIDR(underAmount)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Over-allocation warning banner */}
      {isOver && (
        <div className="flex items-start gap-3 border-t border-amber-500/15 bg-amber-500/[0.06] px-4 py-3">
          <svg
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
          <p className="text-[11px] leading-relaxed text-amber-300/90">
            Total alokasi melebihi target pendanaan sebesar{" "}
            <strong className="text-amber-200">{compactMoney(overAmount)}</strong>. Sesuaikan
            salah satu komponen atau naikkan target pendanaan.
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Allocation Row ─────────────────────────────────────────────────────── */

function AllocationRow({
  item,
  index,
  active,
  onEnter,
  onLeave,
}: {
  item: AllocationItem;
  index: number;
  active: boolean;
  onEnter: (item: AllocationItem) => void;
  onLeave: () => void;
}) {
  const barWidthPct = Math.min(item.shareOfAllocated * 100, 100);

  return (
    <div
      onMouseEnter={() => onEnter(item)}
      onMouseLeave={onLeave}
      className={cn(
        "group rounded-2xl border px-4 py-4 transition-all duration-200",
        active
          ? `${item.tone.border} ${item.tone.soft} ${item.tone.ring}`
          : "border-white/[0.07] bg-[#0a1017]/80 hover:border-white/10 hover:bg-white/[0.025]"
      )}
    >
      {/* Top row: index + label + % of target */}
      <div className="flex items-start justify-between gap-3">
        {/* Left */}
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[9px] font-bold text-slate-500">
            {index + 1}
          </span>
          <div className="min-w-0">
            <div className="flex items-start gap-2">
              <span className={cn("mt-0.5 h-2 w-2 flex-shrink-0 rounded-full", item.tone.dot)} />
              <span className="line-clamp-2 text-sm font-medium leading-snug text-slate-100">{item.label}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-600">
              {item.description}
            </p>
          </div>
        </div>

        {/* Right: % of target */}
        <div className="flex-shrink-0 text-right">
          <p className={cn("text-base font-bold leading-none tracking-[-0.04em]", item.tone.text)}>
            {formatPercent(item.ratioToTarget)}
          </p>
          <p className="mt-0.5 text-[9px] uppercase tracking-[0.18em] text-slate-600">
            dari target
          </p>
        </div>
      </div>

      {/* Bottom: amount + bar */}
      <div className="mt-3">
        {/* Amount row */}
        <div className="mb-2 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className={cn("text-base font-bold leading-none tracking-[-0.04em]", item.tone.text)}>
              {compactMoney(item.value)}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-slate-600">{formatIDR(item.value)}</p>
          </div>
          <p className="flex-shrink-0 text-[10px] text-slate-600">
            {formatPercent(item.shareOfAllocated)} dari total
          </p>
        </div>

        {/* Mini progress bar — proportion of total allocation, always sums to 100% */}
        <div className="h-[5px] overflow-hidden rounded-full bg-white/[0.05]">
          <div
            className={cn("h-full rounded-full bg-gradient-to-r", item.tone.bar)}
            style={{ width: `${barWidthPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Legend ─────────────────────────────────────────────────────────────── */

function Legend({ items }: { items: AllocationItem[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-1">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", item.tone.dot)} />
          <span className="text-[9px] uppercase tracking-[0.15em] text-slate-600">
            {item.labelShort}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

export default function CapitalDeploymentCard({
  project,
}: {
  project: ProjectDetailViewModel;
}) {
  const fundingTarget = toNumber(project.fundingTarget);
  const tooltipAnchorRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<HoveredState | null>(null);

  const baseItems = useMemo<BaseItem[]>(
    () =>
      [
        {
          id: "auction-limit",
          label: "Nilai limit lelang",
          labelShort: "Limit lelang",
          value: toNumber(project.auctionLimitValue),
          description: "Porsi utama untuk membeli aset di harga limit lelang yang ditetapkan.",
        },
        {
          id: "spare-bidding",
          label: "Spare bidding",
          labelShort: "Spare bid",
          value: toNumber(project.spareBidding),
          description: "Ruang taktis untuk mengantisipasi kenaikan harga saat proses bidding.",
        },
        {
          id: "execution-cost",
          label: "Biaya eksekusi",
          labelShort: "Eksekusi",
          value: toNumber(project.executionCost),
          description: "Biaya legal, administratif, dan operasional saat eksekusi transaksi.",
        },
        {
          id: "renovation-cost",
          label: "Biaya renovasi",
          labelShort: "Renovasi",
          value: toNumber(project.renovationCost),
          description: "Modal perbaikan aset agar siap dipasarkan kembali dengan harga lebih tinggi.",
        },
        {
          id: "transfer-cost",
          label: "Biaya balik nama",
          labelShort: "Balik nama",
          value: toNumber(project.transferCost),
          description: "Biaya perpindahan hak kepemilikan dan kelengkapan dokumen aset.",
        },
        {
          id: "reserve-fund",
          label: "Dana cadangan",
          labelShort: "Cadangan",
          value: toNumber(project.reserveFund),
          description: "Buffer kas untuk kebutuhan tak terduga di luar komponen utama.",
        },
      ].filter((item) => item.value > 0),
    [
      project.auctionLimitValue,
      project.spareBidding,
      project.executionCost,
      project.renovationCost,
      project.transferCost,
      project.reserveFund,
    ]
  );

  const allocated = baseItems.reduce((sum, item) => sum + item.value, 0);

  /* Over-allocation detection: >0.5% tolerance */
  const isOver = fundingTarget > 0 && allocated > fundingTarget * 1.005;
  const overAmount = Math.max(0, allocated - fundingTarget);
  const underAmount = Math.max(0, fundingTarget - allocated);

  /* Scale bases */
  const ratioBase = fundingTarget > 0 ? fundingTarget : Math.max(allocated, 1);
  const displayBase = Math.max(fundingTarget, allocated, 1);
  const allocatedRatio = safeDivide(allocated, ratioBase);

  /* Target line position on the strip (null = not over-allocated) */
  const targetLineRatio = isOver ? safeDivide(fundingTarget, displayBase) : null;

  const items = useMemo<AllocationItem[]>(
    () =>
      baseItems.map((item, i) => ({
        ...item,
        ratioToTarget: safeDivide(item.value, ratioBase),
        shareOfAllocated: safeDivide(item.value, Math.max(allocated, 1)),
        displayRatio: safeDivide(item.value, displayBase),
        tone: TONES[i % TONES.length],
      })),
    [baseItems, ratioBase, displayBase, allocated]
  );

  /* Hover handlers */
  const handleStripHover = (
    item: AllocationItem,
    e: MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>
  ) => {
    const container = tooltipAnchorRef.current;
    const btn = e.currentTarget;
    if (!container || !btn) {
      setHovered({ item, x: TOOLTIP_HALF });
      return;
    }
    const cr = container.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    const center = br.left - cr.left + br.width / 2;
    setHovered({ item, x: clampTooltipX(center, cr.width) });
  };

  const handleRowHover = (item: AllocationItem) => {
    const cw = tooltipAnchorRef.current?.getBoundingClientRect().width ?? TOOLTIP_WIDTH;
    setHovered({ item, x: clampTooltipX(cw / 2, cw) });
  };

  /* Empty state */
  if (items.length === 0) {
    return (
      <SectionCard
        eyebrow="Capital Allocation"
        title="Alokasi Dana"
        icon={<Layers3 className="h-5 w-5" />}
      >
        <EmptyState text="Alokasi dana belum diisi. Investor belum bisa melihat distribusi penggunaan modal." />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      eyebrow="Capital Allocation"
      title="Alokasi Dana"
      icon={<Layers3 className="h-5 w-5" />}
    >
      <div className="space-y-3">

        {/* 1 ─ Summary stats (only when we have a target) */}
        {fundingTarget > 0 && (
          <SummaryBlock
            allocated={allocated}
            target={fundingTarget}
            isOver={isOver}
            overAmount={overAmount}
            underAmount={underAmount}
          />
        )}

        {/* 2 ─ Segmented distribution bar (+ tooltip on hover) */}
        <div
          ref={tooltipAnchorRef}
          className="relative overflow-visible"
          onMouseLeave={() => setHovered(null)}
        >
          <Tooltip hovered={hovered} />
          <AllocationStrip
            items={items}
            allocatedRatio={allocatedRatio}
            targetLineRatio={targetLineRatio}
            isOver={isOver}
            onEnter={handleStripHover}
            onLeave={() => setHovered(null)}
          />
        </div>

        {/* 3 ─ Allocation rows */}
        <div className="space-y-2">
          {items.map((item, index) => (
            <AllocationRow
              key={item.id}
              item={item}
              index={index}
              active={hovered?.item.id === item.id}
              onEnter={handleRowHover}
              onLeave={() => setHovered(null)}
            />
          ))}
        </div>

        {/* 4 ─ Color legend */}
        <Legend items={items} />

      </div>
    </SectionCard>
  );
}

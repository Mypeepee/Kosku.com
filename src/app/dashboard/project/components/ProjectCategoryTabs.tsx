"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  CheckCircle2,
  ChevronDown,
  Clock3,
  LayoutGrid,
} from "lucide-react";

type TabKey = "semua" | "berjalan" | "selesai";
type SortKey = "termurah" | "termahal" | "terlama" | "tercepat";

type Props = {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  totalSemua?: number;
  totalBerjalan?: number;
  totalSelesai?: number;
};

const tabs: Array<{
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "berjalan", label: "Sedang Berjalan", icon: Clock3 },
  { key: "selesai", label: "Sudah Selesai", icon: CheckCircle2 },
  { key: "semua", label: "Semua", icon: LayoutGrid },
];

const sortOptions: Array<{
  key: SortKey;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    key: "termurah",
    label: "Harga Paling Murah",
    shortLabel: "Termurah",
    icon: ArrowDownWideNarrow,
  },
  {
    key: "termahal",
    label: "Harga Paling Mahal",
    shortLabel: "Termahal",
    icon: ArrowUpWideNarrow,
  },
  {
    key: "terlama",
    label: "Durasi Paling Lama",
    shortLabel: "Terlama",
    icon: ArrowUpWideNarrow,
  },
  {
    key: "tercepat",
    label: "Durasi Paling Sebentar",
    shortLabel: "Tercepat",
    icon: ArrowDownWideNarrow,
  },
];

function getSortMeta(sort: SortKey) {
  return (
    sortOptions.find((item) => item.key === sort) ?? {
      key: "termurah" as SortKey,
      label: "Harga Paling Murah",
      shortLabel: "Termurah",
      icon: ArrowDownWideNarrow,
    }
  );
}

function CountBadge({
  active,
  value,
}: {
  active: boolean;
  value?: number;
}) {
  if (typeof value !== "number") return null;

  return (
    <span
      className={[
        "ml-0.5 inline-flex min-w-[24px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold transition",
        active
          ? "bg-black/8 text-[#07110b]"
          : "bg-white/[0.06] text-slate-400 group-hover:text-white",
      ].join(" ")}
    >
      {value}
    </span>
  );
}

function DropdownMenu({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "absolute top-[calc(100%+10px)] z-50 overflow-hidden rounded-[20px] border border-white/10 bg-[#0a1320]/96 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.34)] backdrop-blur-2xl",
        className ?? "",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.08),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0)_28%)]" />
      <div className="relative">{children}</div>
    </div>
  );
}

function DropdownItem({
  active,
  onClick,
  icon: Icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition",
        active ? "bg-emerald-400/12 text-emerald-200" : "text-slate-200 hover:bg-white/[0.06]",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          active ? "bg-emerald-400/14" : "bg-white/[0.05]",
        ].join(" ")}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 truncate font-semibold">{label}</span>
      {badge}
    </button>
  );
}

export default function ProjectCategoryTabs({
  activeTab,
  onTabChange,
  sort,
  onSortChange,
  totalSemua,
  totalBerjalan,
  totalSelesai,
}: Props) {
  const [openSortMenu, setOpenSortMenu] = useState(false);
  const [openTabMenu, setOpenTabMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const tabMenuRef = useRef<HTMLDivElement | null>(null);

  const activeSort = useMemo(() => getSortMeta(sort), [sort]);
  const ActiveSortIcon = activeSort.icon;
  const activeTabMeta = useMemo(() => tabs.find((t) => t.key === activeTab) ?? tabs[0], [activeTab]);
  const ActiveTabIcon = activeTabMeta.icon;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setOpenSortMenu(false);
      }
      if (tabMenuRef.current && !tabMenuRef.current.contains(event.target as Node)) {
        setOpenTabMenu(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenSortMenu(false);
        setOpenTabMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function getCount(tabKey: TabKey) {
    if (tabKey === "berjalan") return totalBerjalan;
    if (tabKey === "selesai") return totalSelesai;
    return totalSemua;
  }

  const dropdownButtonBase =
    "inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold backdrop-blur-xl transition duration-200 active:scale-[0.99]";
  const dropdownButtonIdle =
    "border-white/10 bg-white/[0.045] text-slate-200 hover:border-white/15 hover:bg-white/[0.07]";
  const dropdownButtonOpen =
    "border-white/15 bg-white/[0.07] text-white shadow-[0_10px_30px_rgba(0,0,0,0.16)]";

  return (
    <div className="flex min-w-0 items-center gap-2">
      {/* ── Mobile: tab dropdown ── */}
      <div className="relative min-w-0 flex-1 sm:hidden" ref={tabMenuRef}>
        <button
          type="button"
          onClick={() => setOpenTabMenu((prev) => !prev)}
          className={[
            "w-full",
            dropdownButtonBase,
            openTabMenu ? dropdownButtonOpen : dropdownButtonIdle,
          ].join(" ")}
          aria-haspopup="menu"
          aria-expanded={openTabMenu}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
            <ActiveTabIcon className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1 truncate text-left">{activeTabMeta.label}</span>
          {typeof getCount(activeTab) === "number" && (
            <span className="inline-flex shrink-0 min-w-[22px] items-center justify-center rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[11px] font-bold text-slate-300">
              {getCount(activeTab)}
            </span>
          )}
          <ChevronDown
            className={[
              "h-4 w-4 shrink-0 text-slate-400 transition duration-200",
              openTabMenu ? "rotate-180" : "",
            ].join(" ")}
          />
        </button>

        {openTabMenu && (
          <DropdownMenu className="left-0 w-[220px]">
            {tabs.map((tab) => {
              const count = getCount(tab.key);
              return (
                <DropdownItem
                  key={tab.key}
                  active={activeTab === tab.key}
                  onClick={() => {
                    onTabChange(tab.key);
                    setOpenTabMenu(false);
                  }}
                  icon={tab.icon}
                  label={tab.label}
                  badge={
                    typeof count === "number" ? (
                      <span
                        className={[
                          "inline-flex min-w-[22px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold",
                          activeTab === tab.key
                            ? "bg-emerald-400/20 text-emerald-200"
                            : "bg-white/[0.06] text-slate-400",
                        ].join(" ")}
                      >
                        {count}
                      </span>
                    ) : undefined
                  }
                />
              );
            })}
          </DropdownMenu>
        )}
      </div>

      {/* ── Desktop: pill tabs ── */}
      <div className="hidden min-w-0 flex-1 sm:block">
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto scroll-smooth pb-1 pr-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={[
                  "group inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold backdrop-blur-xl transition duration-200 active:scale-[0.99]",
                  active
                    ? "border-emerald-300/20 bg-[linear-gradient(135deg,#34d399_0%,#4ade80_100%)] text-[#07110b] shadow-[0_10px_24px_rgba(52,211,153,0.18)]"
                    : "border-white/10 bg-white/[0.045] text-slate-300 shadow-[0_6px_18px_rgba(0,0,0,0.10)] hover:border-white/15 hover:bg-white/[0.07] hover:text-white",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-6 w-6 items-center justify-center rounded-full transition",
                    active ? "bg-black/10" : "bg-white/[0.06]",
                  ].join(" ")}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="whitespace-nowrap">{tab.label}</span>
                <CountBadge active={active} value={getCount(tab.key)} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Sort dropdown (always visible) ── */}
      <div className="relative shrink-0" ref={sortMenuRef}>
        <button
          type="button"
          onClick={() => setOpenSortMenu((prev) => !prev)}
          className={[
            dropdownButtonBase,
            openSortMenu ? dropdownButtonOpen : dropdownButtonIdle,
          ].join(" ")}
          aria-haspopup="menu"
          aria-expanded={openSortMenu}
        >
          <span className="hidden text-slate-400 sm:inline">Urutkan</span>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
            <ActiveSortIcon className="h-3.5 w-3.5" />
          </span>
          <span className="hidden max-w-[120px] truncate sm:inline">
            {activeSort.shortLabel}
          </span>
          <ChevronDown
            className={[
              "h-4 w-4 shrink-0 text-slate-400 transition duration-200",
              openSortMenu ? "rotate-180" : "",
            ].join(" ")}
          />
        </button>

        {openSortMenu && (
          <DropdownMenu className="right-0 w-[240px]">
            {sortOptions.map((item) => {
              const active = item.key === sort;
              return (
                <DropdownItem
                  key={item.key}
                  active={active}
                  onClick={() => {
                    onSortChange(item.key);
                    setOpenSortMenu(false);
                  }}
                  icon={item.icon}
                  label={item.label}
                />
              );
            })}
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
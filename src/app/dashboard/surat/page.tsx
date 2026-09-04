"use client";

import { Suspense, useState, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Icon } from "@iconify/react";
import { suratTemplates, type SuratTemplate } from "./components/data";

/**
 * Template yang punya modalnya sendiri. Wizard generik `SuratTemplateModal`
 * harus melewatkan semuanya — kalau satu id lupa didaftarkan di sini, DUA
 * modal terbuka bertumpuk untuk template yang sama.
 */
const MODAL_KHUSUS = [
  "invoice-solusindo",
  "kuitansi-solusindo",
  "tanda-terima-dokumen",
  "akta-kesepakatan-bersama",
  "debitur-care",
];

const SuratTemplateModal = dynamic(
  () => import("./components/SuratTemplateModal").then(m => ({ default: m.SuratTemplateModal })),
  { ssr: false }
);
const InvoiceModal = dynamic(
  () => import("./components/InvoiceModal").then(m => ({ default: m.InvoiceModal })),
  { ssr: false }
);
const KuitansiModal = dynamic(
  () => import("./components/KuitansiModal").then(m => ({ default: m.KuitansiModal })),
  { ssr: false }
);
const TandaTerimaModal = dynamic(
  () => import("./components/TandaTerimaModal").then(m => ({ default: m.TandaTerimaModal })),
  { ssr: false }
);
const DebiturCareModal = dynamic(
  () => import("./components/DebiturCareModal").then(m => ({ default: m.DebiturCareModal })),
  { ssr: false },
);
const AktaKesepakatanModal = dynamic(
  () => import("./components/AktaKesepakatanModal").then(m => ({ default: m.AktaKesepakatanModal })),
  { ssr: false }
);

// ── Folder definitions ────────────────────────────────────────────────────────

type FolderColor = "emerald" | "blue" | "amber";

type FolderDef = {
  id: string;
  name: string;
  desc: string;
  icon: string;
  color: FolderColor;
  categoryKeys: string[];
};

const FOLDERS: FolderDef[] = [
  {
    id: "transaksi",
    name: "Transaksi",
    desc: "MoU, perjanjian jual-beli, dan dokumen closing",
    icon: "solar:card-transfer-bold-duotone",   // ikon transaksi
    color: "emerald",
    categoryKeys: ["transaksi", "mou", "closing", "jual beli", "perjanjian"],
  },
  {
    id: "pengurusan",
    name: "Pengurusan Dokumen",
    desc: "Permohonan notaris, PPAT, dan legalitas properti",
    icon: "solar:notes-bold-duotone",
    color: "blue",
    categoryKeys: ["notaris", "ppat", "pengurusan", "legalitas"],
  },
  {
    id: "eksekusi",
    name: "Eksekusi Pengosongan",
    desc: "Surat PN, eksekusi, dan pengosongan aset lelang",
    icon: "solar:document-text-bold-duotone",
    color: "amber",
    categoryKeys: ["litigasi", "eksekusi", "pengosongan", "pengadilan"],
  },
];

// ── Color tokens per folder ───────────────────────────────────────────────────

const FOLDER_COLORS: Record<FolderColor, {
  gradient: string;
  ring: string;
  iconBg: string;
  iconText: string;
  glow: string;
  badgeBg: string;
  badgeText: string;
  topLine: string;
  cardActiveBg: string;
  cardHoverShadow: string;
  btnBg: string;
  btnHover: string;
  btnText: string;
  activeFolderRing: string;
}> = {
  emerald: {
    gradient:        "from-emerald-500/[0.18] via-zinc-900/70 to-zinc-950",
    ring:            "ring-1 ring-emerald-500/20",
    iconBg:          "bg-emerald-500/20 ring-1 ring-emerald-400/25",
    iconText:        "text-emerald-300",
    glow:            "bg-emerald-400/22",
    badgeBg:         "bg-emerald-500/12 ring-1 ring-emerald-500/25",
    badgeText:       "text-emerald-200",
    topLine:         "bg-gradient-to-r from-transparent via-emerald-500/55 to-transparent",
    cardActiveBg:    "bg-emerald-500/[0.05]",
    cardHoverShadow: "hover:shadow-[0_12px_40px_rgba(0,0,0,0.50),inset_0_0_0_1px_rgba(52,211,153,0.10)]",
    btnBg:           "bg-emerald-500/15 ring-1 ring-emerald-500/25",
    btnHover:        "hover:bg-emerald-500/25",
    btnText:         "text-emerald-200",
    activeFolderRing: "ring-2 ring-emerald-400/50 shadow-[0_0_0_4px_rgba(52,211,153,0.08)]",
  },
  blue: {
    gradient:        "from-blue-500/[0.18] via-zinc-900/70 to-zinc-950",
    ring:            "ring-1 ring-blue-500/20",
    iconBg:          "bg-blue-500/20 ring-1 ring-blue-400/25",
    iconText:        "text-blue-300",
    glow:            "bg-blue-400/20",
    badgeBg:         "bg-blue-500/12 ring-1 ring-blue-500/25",
    badgeText:       "text-blue-200",
    topLine:         "bg-gradient-to-r from-transparent via-blue-500/55 to-transparent",
    cardActiveBg:    "bg-blue-500/[0.05]",
    cardHoverShadow: "hover:shadow-[0_12px_40px_rgba(0,0,0,0.50),inset_0_0_0_1px_rgba(59,130,246,0.10)]",
    btnBg:           "bg-blue-500/15 ring-1 ring-blue-500/25",
    btnHover:        "hover:bg-blue-500/25",
    btnText:         "text-blue-200",
    activeFolderRing: "ring-2 ring-blue-400/50 shadow-[0_0_0_4px_rgba(59,130,246,0.08)]",
  },
  amber: {
    gradient:        "from-amber-500/[0.16] via-zinc-900/70 to-zinc-950",
    ring:            "ring-1 ring-amber-500/20",
    iconBg:          "bg-amber-500/20 ring-1 ring-amber-400/25",
    iconText:        "text-amber-300",
    glow:            "bg-amber-400/18",
    badgeBg:         "bg-amber-500/12 ring-1 ring-amber-500/25",
    badgeText:       "text-amber-200",
    topLine:         "bg-gradient-to-r from-transparent via-amber-500/50 to-transparent",
    cardActiveBg:    "bg-amber-500/[0.05]",
    cardHoverShadow: "hover:shadow-[0_12px_40px_rgba(0,0,0,0.50),inset_0_0_0_1px_rgba(245,158,11,0.10)]",
    btnBg:           "bg-amber-500/15 ring-1 ring-amber-500/25",
    btnHover:        "hover:bg-amber-500/25",
    btnText:         "text-amber-200",
    activeFolderRing: "ring-2 ring-amber-400/50 shadow-[0_0_0_4px_rgba(245,158,11,0.08)]",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFolderForTemplate(t: SuratTemplate): string {
  const cat = t.category.toLowerCase();
  for (const folder of FOLDERS) {
    if (folder.categoryKeys.some((k) => cat.includes(k))) return folder.id;
  }
  return "transaksi";
}

function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SuratTemplate["status"] }) {
  const cls =
    status === "Populer" ? "bg-emerald-500/12 text-emerald-300 ring-emerald-500/25" :
    status === "Baru"    ? "bg-cyan-500/12 text-cyan-300 ring-cyan-500/25" :
                           "bg-zinc-700/40 text-zinc-400 ring-zinc-700/40";
  return (
    <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black ring-1", cls)}>
      {status}
    </span>
  );
}

// ── Folder Card ───────────────────────────────────────────────────────────────

function FolderCard({
  folder,
  count,
  isActive,
  onClick,
}: {
  folder: FolderDef;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const c = FOLDER_COLORS[folder.color];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "group relative w-full overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-left transition-all duration-300",
        "hover:-translate-y-0.5",
        c.gradient,
        isActive ? c.activeFolderRing : c.ring,
        "hover:shadow-[0_20px_60px_rgba(0,0,0,0.45)]",
      )}
    >
      {/* Glow */}
      <div className={cx(
        "pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full blur-3xl transition-opacity duration-300",
        c.glow,
        isActive ? "opacity-80" : "opacity-50 group-hover:opacity-75",
      )} />

      {/* Grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.045]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.4) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.4) 1px,transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Active indicator */}
      {isActive && (
        <div className="absolute right-3 top-3">
          <div className={cx("flex h-5 w-5 items-center justify-center rounded-full", c.iconBg)}>
            <Icon icon="solar:check-bold" className={cx("text-[10px]", c.iconText)} />
          </div>
        </div>
      )}

      <div className="relative">
        {/* Icon + count */}
        <div className="flex items-start justify-between gap-3">
          <div className={cx("grid h-14 w-14 place-items-center rounded-2xl", c.iconBg)}>
            <Icon icon={folder.icon} className={cx("text-3xl", c.iconText)} />
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={cx("rounded-xl px-2.5 py-1 text-xl font-black leading-none", c.badgeBg, c.badgeText)}>
              {count}
            </span>
            <span className="text-[10px] font-bold text-zinc-500">template</span>
          </div>
        </div>

        {/* Text */}
        <div className="mt-4">
          <h3 className="text-[15px] font-black leading-tight text-white">{folder.name}</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">{folder.desc}</p>
        </div>

        {/* CTA */}
        <div className="mt-4 flex items-center gap-1.5">
          <span className={cx("text-[11px] font-black", c.badgeText)}>
            {isActive ? "Aktif · klik untuk reset" : "Lihat template"}
          </span>
          <Icon
            icon={isActive ? "solar:close-circle-linear" : "solar:alt-arrow-down-bold"}
            className={cx("text-xs transition-transform duration-200", c.iconText)}
          />
        </div>
      </div>
    </button>
  );
}

// ── File card — grid view ─────────────────────────────────────────────────────

function FileCardGrid({
  template,
  folderColor,
  onUse,
}: {
  template: SuratTemplate;
  folderColor: FolderColor;
  onUse: () => void;
}) {
  const c = FOLDER_COLORS[folderColor];

  return (
    <div
      className={cx(
        "group relative flex flex-col overflow-hidden rounded-2xl p-4 transition-all duration-200",
        "bg-zinc-900/50 hover:bg-zinc-900/75",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_1px_3px_rgba(0,0,0,0.25)]",
        c.cardHoverShadow,
      )}
    >
      {/* Top accent line */}
      <div className={cx("absolute inset-x-0 top-0 h-px", c.topLine)} />

      {/* Icon + status */}
      <div className="flex items-start justify-between gap-2">
        <div className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-xl", c.iconBg)}>
          <Icon icon="solar:document-text-bold-duotone" className={cx("text-2xl", c.iconText)} />
        </div>
        <StatusBadge status={template.status} />
      </div>

      {/* Code */}
      <span className="mt-3 font-mono text-[10px] text-zinc-600">{template.code}</span>

      {/* Title */}
      <h4 className="mt-0.5 text-[13px] font-black leading-snug text-white">{template.title}</h4>

      {/* Description */}
      <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
        {template.description}
      </p>

      <div className="flex-1" />

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.04] pt-3">
        <div className="flex items-center gap-1 text-[10px] text-zinc-600">
          <Icon icon="solar:calendar-linear" className="text-[11px]" />
          {template.updatedAt}
        </div>
        <button
          type="button"
          onClick={onUse}
          className={cx(
            "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-black transition-all",
            c.btnBg, c.btnHover, c.btnText,
          )}
        >
          <Icon icon="solar:export-bold-duotone" className="text-sm" />
          Gunakan
        </button>
      </div>
    </div>
  );
}

// ── Sort dropdown (custom premium) ───────────────────────────────────────────

type SortKey = "date" | "name-asc" | "name-desc" | "usage";

const SORT_OPTS: { key: SortKey; label: string; icon: string; iconBg: string; iconText: string }[] = [
  { key: "date",      label: "Terbaru",                 icon: "solar:clock-circle-bold-duotone",             iconBg: "bg-cyan-500/20 ring-1 ring-cyan-400/25",   iconText: "text-cyan-300" },
  { key: "name-asc",  label: "A → Z",                   icon: "solar:sort-from-top-to-bottom-bold-duotone",  iconBg: "bg-blue-500/20 ring-1 ring-blue-400/25",   iconText: "text-blue-300" },
  { key: "name-desc", label: "Z → A",                   icon: "solar:sort-from-bottom-to-top-bold-duotone",  iconBg: "bg-violet-500/20 ring-1 ring-violet-400/25", iconText: "text-violet-300" },
  { key: "usage",     label: "Paling Sering Digunakan", icon: "solar:fire-bold-duotone",                     iconBg: "bg-amber-500/20 ring-1 ring-amber-400/25", iconText: "text-amber-300" },
];

function SortDropdown({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (v: SortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = SORT_OPTS.find((o) => o.key === value) ?? SORT_OPTS[0];

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={cx(
          "flex h-[38px] items-center gap-2 rounded-xl border px-3 text-sm font-black transition-all focus:outline-none",
          open
            ? "border-zinc-700 bg-zinc-800/80 text-white"
            : "border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-700 hover:text-white",
        )}
      >
        <Icon icon={current.icon} className={cx("shrink-0 text-base", current.iconText)} />
        <span className="hidden sm:inline">{current.label}</span>
        <Icon
          icon="solar:alt-arrow-down-bold"
          className={cx("shrink-0 text-[10px] transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-[0_24px_60px_rgba(0,0,0,0.72)] ring-1 ring-white/5"
            style={{ width: "min(220px, calc(100vw - 24px))" }}
          >
            <div className="border-b border-zinc-800/60 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Urutkan</p>
            </div>
            <div className="p-1.5">
              {SORT_OPTS.map((opt) => {
                const active = value === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => { onChange(opt.key); setOpen(false); }}
                    className={cx(
                      "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all",
                      active
                        ? "bg-emerald-500/12 ring-1 ring-emerald-500/20"
                        : "hover:bg-zinc-800/60",
                    )}
                  >
                    <div className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-lg", opt.iconBg)}>
                      <Icon icon={opt.icon} className={cx("text-sm", opt.iconText)} />
                    </div>
                    <span className={cx("text-[12px] font-black", active ? "text-emerald-200" : "text-zinc-200")}>
                      {opt.label}
                    </span>
                    {active && (
                      <Icon icon="solar:check-bold" className="ml-auto shrink-0 text-xs text-emerald-300" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyFolder({ folder }: { folder: FolderDef }) {
  const c = FOLDER_COLORS[folder.color];
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800/60 bg-zinc-950/20 py-20 text-center">
      <div className={cx("grid h-16 w-16 place-items-center rounded-2xl", c.iconBg)}>
        <Icon icon={folder.icon} className={cx("text-4xl", c.iconText)} />
      </div>
      <p className="mt-4 text-sm font-black text-white">Belum ada template</p>
      <p className="mt-1 max-w-[260px] text-[12px] text-zinc-500">
        Template <span className={c.badgeText}>"{folder.name}"</span> akan muncul di sini setelah ditambahkan.
      </p>
    </div>
  );
}

// ── Main content ──────────────────────────────────────────────────────────────

function SuratContent() {
  const searchParams = useSearchParams();
  const urlTemplateId = searchParams.get("template");

  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [search, setSearch]             = useState("");
  const [sortBy, setSortBy]             = useState<SortKey>("date");
  const [selectedTemplate, setSelectedTemplate] = useState<SuratTemplate | null>(
    urlTemplateId ? (suratTemplates.find((t) => t.id === urlTemplateId) ?? null) : null,
  );

  // Ref for auto-scroll to template section
  const templatesSectionRef = useRef<HTMLDivElement>(null);

  // Map templates to folders
  const byFolder = useMemo(() => {
    const map: Record<string, SuratTemplate[]> = { transaksi: [], pengurusan: [], eksekusi: [] };
    for (const t of suratTemplates) {
      const fid = getFolderForTemplate(t);
      (map[fid] = map[fid] ?? []).push(t);
    }
    return map;
  }, []);

  const currentFolder = FOLDERS.find((f) => f.id === activeFolder) ?? null;

  // Handle folder card click: toggle filter + scroll to templates
  function handleFolderClick(folderId: string) {
    if (activeFolder === folderId) {
      // Toggle off → reset
      setActiveFolder(null);
    } else {
      setActiveFolder(folderId);
      setTimeout(() => {
        templatesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  }

  // Filtered + sorted templates
  const displayedTemplates = useMemo(() => {
    const base = activeFolder ? (byFolder[activeFolder] ?? []) : suratTemplates;
    let result = base;
    if (search) {
      const q = search.toLowerCase();
      result = base.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.code.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q),
      );
    }
    // Urutan folder: Transaksi → Pengurusan Dokumen → Eksekusi Pengosongan
    const folderRank = (t: SuratTemplate) => {
      const idx = FOLDERS.findIndex((f) => f.id === getFolderForTemplate(t));
      return idx === -1 ? FOLDERS.length : idx;
    };
    return [...result].sort((a, b) => {
      if (sortBy === "name-asc")  return a.title.localeCompare(b.title);
      if (sortBy === "name-desc") return b.title.localeCompare(a.title);
      if (sortBy === "usage")     return b.usedCount - a.usedCount;
      return folderRank(a) - folderRank(b); // default: urut sesuai folder
    });
  }, [activeFolder, byFolder, search, sortBy]);

  const totalTemplates = suratTemplates.length;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 px-4 py-6 lg:px-8">

      {/* ── Page hero ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[28px] border border-emerald-400/16 bg-gradient-to-b from-emerald-400/[0.14] via-zinc-950/60 to-zinc-950/35 p-6 shadow-[0_0_0_1px_rgba(16,185,129,0.08),0_28px_80px_rgba(0,0,0,0.60)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: "linear-gradient(rgba(134,239,172,0.18) 1px,transparent 1px),linear-gradient(90deg,rgba(134,239,172,0.12) 1px,transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div className="pointer-events-none absolute -top-20 left-10 h-52 w-52 rounded-full bg-emerald-400/16 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-12 h-64 w-64 rounded-full bg-blue-400/8 blur-3xl" />

        <div className="relative">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 font-black text-emerald-200 ring-1 ring-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              Dashboard • Surat
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5">
                <Icon icon="solar:folder-with-files-bold-duotone" className="text-2xl text-emerald-200" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white">Surat & Dokumen</h1>
                <p className="mt-0.5 text-sm text-zinc-400">
                  File manager template surat dan dokumen legal properti.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-center">
                <p className="text-lg font-black leading-none text-white">{FOLDERS.length}</p>
                <p className="mt-0.5 text-[10px] font-bold text-zinc-500">Folder</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-center">
                <p className="text-lg font-black leading-none text-white">{totalTemplates}</p>
                <p className="mt-0.5 text-[10px] font-bold text-zinc-500">Template</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Folder grid — always visible ────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-zinc-500">Folder</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FOLDERS.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              count={byFolder[folder.id]?.length ?? 0}
              isActive={activeFolder === folder.id}
              onClick={() => handleFolderClick(folder.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Toolbar — satu baris di semua ukuran ──────────────────────────── */}
      <div
        ref={templatesSectionRef}
        className="flex scroll-mt-6 items-center gap-2"
      >
        {/* Search — flex-1 */}
        <div className="relative min-w-0 flex-1">
          <Icon
            icon="solar:magnifer-linear"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari template…"
            className="h-[38px] w-full rounded-xl border border-zinc-800 bg-zinc-950/60 pl-8 pr-8 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200">
              <Icon icon="solar:close-circle-linear" className="text-sm" />
            </button>
          )}
        </div>

        {/* Sort dropdown — custom premium, right-anchored */}
        <SortDropdown value={sortBy} onChange={setSortBy} />
      </div>

      {/* ── Active folder filter chip + reset ───────────────────────────────── */}
      {currentFolder && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3">
          <Icon icon="solar:filter-bold-duotone" className="shrink-0 text-base text-zinc-500" />
          <span className="text-[12px] text-zinc-400">Menampilkan folder:</span>

          {/* Active folder pill */}
          <span className={cx(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black",
            FOLDER_COLORS[currentFolder.color].badgeBg,
            FOLDER_COLORS[currentFolder.color].badgeText,
          )}>
            <Icon icon={currentFolder.icon} className="text-sm" />
            {currentFolder.name}
          </span>

          <div className="flex-1" />

          {/* Reset button */}
          <button
            type="button"
            onClick={() => setActiveFolder(null)}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-700/60 bg-zinc-800/50 px-3 py-1.5 text-[11px] font-black text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
          >
            <Icon icon="solar:restart-bold" className="text-sm" />
            Tampilkan semua
          </button>
        </div>
      )}

      {/* ── Template display ─────────────────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">
            {currentFolder ? currentFolder.name : "Semua Template"}
          </h2>
          <span className="text-[11px] text-zinc-600">
            {displayedTemplates.length} template
          </span>
        </div>

        {displayedTemplates.length === 0 ? (
          search ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800/60 bg-zinc-950/20 py-16 text-center">
              <Icon icon="solar:magnifer-bold-duotone" className="text-4xl text-zinc-700" />
              <p className="mt-3 text-sm font-black text-white">Tidak ditemukan</p>
              <p className="mt-1 text-[12px] text-zinc-500">
                Tidak ada template yang cocok dengan &ldquo;{search}&rdquo;
              </p>
            </div>
          ) : currentFolder ? (
            <EmptyFolder folder={currentFolder} />
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800/60 bg-zinc-950/20 py-16 text-center">
              <Icon icon="solar:folder-with-files-bold-duotone" className="text-5xl text-zinc-800" />
              <p className="mt-3 text-sm font-black text-white">Belum ada template</p>
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayedTemplates.map((t) => {
              const fid = getFolderForTemplate(t);
              const folder = FOLDERS.find((f) => f.id === fid)!;
              return (
                <FileCardGrid
                  key={t.id}
                  template={t}
                  folderColor={folder.color}
                  onUse={() => setSelectedTemplate(t)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Kuitansi modal ─────────────────────────────────────────────────── */}
      <KuitansiModal
        open={selectedTemplate?.id === "kuitansi-solusindo"}
        template={selectedTemplate?.id === "kuitansi-solusindo" ? selectedTemplate : null}
        onClose={() => setSelectedTemplate(null)}
      />

      {/* ── Invoice modal ─────────────────────────────────────────────────── */}
      <InvoiceModal
        open={selectedTemplate?.id === "invoice-solusindo"}
        template={selectedTemplate?.id === "invoice-solusindo" ? selectedTemplate : null}
        onClose={() => setSelectedTemplate(null)}
        onSubmit={async ({ values }) => {
          const res = await fetch("/api/surat/generate-invoice", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(values),
          });

          if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as { detail?: string };
            alert(err.detail ?? "Gagal generate invoice. Coba lagi.");
            return;
          }

          const disposition = res.headers.get("Content-Disposition") ?? "";
          const nameMatch   = disposition.match(/filename="([^"]+)"/);
          const filename    = nameMatch?.[1] ?? "Invoice.docx";

          const blob = await res.blob();
          const url  = URL.createObjectURL(blob);
          const a    = document.createElement("a");
          a.href     = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);

          setSelectedTemplate(null);
        }}
      />

      {/* ── Tanda Terima modal ─────────────────────────────────────────────── */}
      <TandaTerimaModal
        open={selectedTemplate?.id === "tanda-terima-dokumen"}
        template={selectedTemplate?.id === "tanda-terima-dokumen" ? selectedTemplate : null}
        onClose={() => setSelectedTemplate(null)}
      />

      {/* ── Akta Kesepakatan modal ─────────────────────────────────────────── */}
      <AktaKesepakatanModal
        open={selectedTemplate?.id === "akta-kesepakatan-bersama"}
        template={selectedTemplate?.id === "akta-kesepakatan-bersama" ? selectedTemplate : null}
        onClose={() => setSelectedTemplate(null)}
      />

      {/* ── Debitur Care modal ─────────────────────────────────────────────── */}
      <DebiturCareModal
        open={selectedTemplate?.id === "debitur-care"}
        template={selectedTemplate?.id === "debitur-care" ? selectedTemplate : null}
        onClose={() => setSelectedTemplate(null)}
      />

      {/* ── Template wizard modal ─────────────────────────────────────────── */}
      <SuratTemplateModal
        open={Boolean(selectedTemplate) && !MODAL_KHUSUS.includes(selectedTemplate?.id ?? "")}
        template={!MODAL_KHUSUS.includes(selectedTemplate?.id ?? "") ? selectedTemplate : null}
        onClose={() => setSelectedTemplate(null)}
        onSubmit={async ({ template, values }) => {
          // Saat ini hanya template Akte Grosse yang punya generate PDF
          if (template.id !== "permohonan-akte-grosse") {
            setSelectedTemplate(null);
            return;
          }

          try {
            const res = await fetch("/api/surat/generate-akta-grosse", {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify(values),
            });

            if (!res.ok) {
              const err = (await res.json().catch(() => ({}))) as { detail?: string };
              alert(err.detail ?? "Gagal generate surat. Coba lagi.");
              return;
            }

            // Ambil nama file dari Content-Disposition header
            const disposition = res.headers.get("Content-Disposition") ?? "";
            const nameMatch   = disposition.match(/filename="([^"]+)"/);
            const filename    = nameMatch?.[1] ?? "Permohonan_AktaGrosse.pdf";

            // Trigger download di browser
            const blob = await res.blob();
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement("a");
            a.href     = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);

            setSelectedTemplate(null);
          } catch (e) {
            console.error(e);
            alert("Gagal menghubungi server. Pastikan dev server berjalan.");
          }
        }}
      />
    </div>
  );
}

export default function SuratPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <SuratContent />
    </Suspense>
  );
}

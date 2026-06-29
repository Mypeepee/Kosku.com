"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type {
  NullableDate,
  ProjectDetailViewModel,
  ProjectStatus,
} from "./types";
import {
  STATUS_LABEL,
  STATUS_ORDER,
  cn,
  compactIDR,
  formatDate,
  formatMultiple,
  formatPercent,
  getInitials,
  getLocation,
  normalizeImage,
  safeDivide,
  toNumber,
} from "./utils";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Eye,
  Loader2,
  MapPin,
  ReceiptText,
} from "lucide-react";
import ModalTerjual from "../components/ModalTerjual";

type Tone = "amber" | "emerald" | "cyan" | "fuchsia" | "rose" | "slate";
type PaymentStatus = "lunas" | "menunggu_pembayaran";

type Investor = {
  id_agent?: string;
  nama?: string;
  avatar?: string | null;
  gambar?: string | null;
  foto?: string | null;
  image?: string | null;
  nominal_komitmen?: number | string;
  persentase_kepemilikan?: number | string;
  status?: string;
};

type ModalProjectData = {
  id_project?: string;
  nama_project?: string;
  investors?: Investor[];
  total_biaya_akuisisi?: number | string;
  estimasi_harga_jual?: number | string;
  mulai_tanggal?: string | null;

  tanggal_terjual?: string | null;
  harga_jual?: number | string;
  pph_percent?: number | string;
  ajb_percent?: number | string;
  agent_fee_percent?: number | string;
  total_biaya_transaksi?: number | string;
  profit_kotor?: number | string;
  profit_bersih?: number | string;
  roi_kotor_percent?: number | string;
  roi_bersih_percent?: number | string;
};

type SubmitPayload = {
  id_project?: string;
  tanggal_terjual: string | null;
  durasi_hari: number;
  durasi_bulan: number;
  roi_kotor_percent: number;
  roi_bersih_percent: number;
  harga_jual: number;
  total_biaya_akuisisi: number;
  pph_percent: number;
  ajb_percent: number;
  agent_fee_percent: number;
  pph_nominal: number;
  ajb_nominal: number;
  agent_fee_nominal: number;
  total_biaya_transaksi: number;
  profit_kotor: number;
  profit_bersih: number;
  distribusi_investor: Array<{
    id_agent: string;
    nama: string;
    modal: number;
    porsi_percent: number;
    profit: number;
    total_diterima: number;
  }>;
};

const TONE_STYLES: Record<
  Tone,
  {
    text: string;
    border: string;
    softBg: string;
    glow: string;
    dot: string;
    progress: string;
    line: string;
  }
> = {
  amber: {
    text: "text-amber-200",
    border: "border-amber-300/20",
    softBg: "bg-amber-400/10",
    glow: "bg-amber-300/18",
    dot: "bg-amber-300",
    progress: "from-amber-400 via-amber-300 to-lime-300",
    line: "from-amber-300/80 via-amber-200/30 to-transparent",
  },
  emerald: {
    text: "text-emerald-200",
    border: "border-emerald-300/20",
    softBg: "bg-emerald-400/10",
    glow: "bg-emerald-300/18",
    dot: "bg-emerald-300",
    progress: "from-emerald-400 via-emerald-300 to-cyan-300",
    line: "from-emerald-300/80 via-emerald-200/30 to-transparent",
  },
  cyan: {
    text: "text-cyan-200",
    border: "border-cyan-300/20",
    softBg: "bg-cyan-400/10",
    glow: "bg-cyan-300/18",
    dot: "bg-cyan-300",
    progress: "from-sky-400 via-cyan-300 to-indigo-300",
    line: "from-cyan-300/80 via-cyan-200/30 to-transparent",
  },
  fuchsia: {
    text: "text-fuchsia-200",
    border: "border-fuchsia-300/20",
    softBg: "bg-fuchsia-400/10",
    glow: "bg-fuchsia-300/18",
    dot: "bg-fuchsia-300",
    progress: "from-fuchsia-400 via-violet-300 to-pink-300",
    line: "from-fuchsia-300/80 via-fuchsia-200/30 to-transparent",
  },
  rose: {
    text: "text-rose-200",
    border: "border-rose-300/20",
    softBg: "bg-rose-400/10",
    glow: "bg-rose-300/18",
    dot: "bg-rose-300",
    progress: "from-rose-400 via-rose-300 to-orange-300",
    line: "from-rose-300/80 via-rose-200/30 to-transparent",
  },
  slate: {
    text: "text-slate-200",
    border: "border-white/10",
    softBg: "bg-white/[0.06]",
    glow: "bg-white/10",
    dot: "bg-slate-300",
    progress: "from-slate-300 via-slate-200 to-white",
    line: "from-slate-300/80 via-slate-200/30 to-transparent",
  },
};

const STATUS_BADGE_STYLES: Record<
  ProjectStatus,
  {
    text: string;
    border: string;
    softBg: string;
    dot: string;
    optionBorder: string;
    optionBg: string;
    optionText: string;
  }
> = {
  pendanaan_terbuka: {
    text: "text-amber-200",
    border: "border-amber-300/20",
    softBg: "bg-amber-400/10",
    dot: "bg-amber-300",
    optionBorder: "border-amber-300/20",
    optionBg: "bg-amber-400/10",
    optionText: "text-amber-100",
  },
  pendanaan_penuh: {
    text: "text-violet-200",
    border: "border-violet-300/20",
    softBg: "bg-violet-400/10",
    dot: "bg-violet-300",
    optionBorder: "border-violet-300/20",
    optionBg: "bg-violet-400/10",
    optionText: "text-violet-100",
  },
  pengurusan_dokumen: {
    text: "text-sky-200",
    border: "border-sky-300/20",
    softBg: "bg-sky-400/10",
    dot: "bg-sky-300",
    optionBorder: "border-sky-300/20",
    optionBg: "bg-sky-400/10",
    optionText: "text-sky-100",
  },
  eksekusi_pengosongan: {
    text: "text-orange-200",
    border: "border-orange-300/20",
    softBg: "bg-orange-400/10",
    dot: "bg-orange-300",
    optionBorder: "border-orange-300/20",
    optionBg: "bg-orange-400/10",
    optionText: "text-orange-100",
  },
  renovasi: {
    text: "text-cyan-200",
    border: "border-cyan-300/20",
    softBg: "bg-cyan-400/10",
    dot: "bg-cyan-300",
    optionBorder: "border-cyan-300/20",
    optionBg: "bg-cyan-400/10",
    optionText: "text-cyan-100",
  },
  sedang_dijual: {
    text: "text-emerald-200",
    border: "border-emerald-300/20",
    softBg: "bg-emerald-400/10",
    dot: "bg-emerald-300",
    optionBorder: "border-emerald-300/20",
    optionBg: "bg-emerald-400/10",
    optionText: "text-emerald-100",
  },
  terjual: {
    text: "text-lime-200",
    border: "border-lime-300/20",
    softBg: "bg-lime-400/10",
    dot: "bg-lime-300",
    optionBorder: "border-lime-300/20",
    optionBg: "bg-lime-400/10",
    optionText: "text-lime-100",
  },
  dibatalkan: {
    text: "text-rose-200",
    border: "border-rose-300/20",
    softBg: "bg-rose-400/10",
    dot: "bg-rose-300",
    optionBorder: "border-rose-300/20",
    optionBg: "bg-rose-400/10",
    optionText: "text-rose-100",
  },
};

const STATUS_OPTIONS: ProjectStatus[] = [
  "pendanaan_terbuka",
  "pendanaan_penuh",
  "pengurusan_dokumen",
  "eksekusi_pengosongan",
  "renovasi",
  "sedang_dijual",
  "terjual",
  "dibatalkan",
];

const STATUS_LABEL_OVERRIDES: Partial<Record<ProjectStatus, string>> = {
  eksekusi_pengosongan: "Eksekusi",
};

function getDisplayStatusLabel(status: ProjectStatus) {
  return STATUS_LABEL_OVERRIDES[status] ?? STATUS_LABEL[status];
}

function normalizePaymentStatus(value: unknown): PaymentStatus {
  return String(value ?? "").toLowerCase() === "lunas"
    ? "lunas"
    : "menunggu_pembayaran";
}

function getInvestorCommittedAmount(item: any) {
  return toNumber(
    item?.committed ??
      item?.nominal_komitmen ??
      item?.nominalKomitmen ??
      item?.nominal_terbayar ??
      item?.nominalTerbayar ??
      0
  );
}

function resolveDate(value?: NullableDate) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMonthsSafe(date: Date, months: number) {
  const next = new Date(date);
  const originalDay = next.getDate();

  next.setDate(1);
  next.setMonth(next.getMonth() + months);

  const lastDayOfTargetMonth = new Date(
    next.getFullYear(),
    next.getMonth() + 1,
    0
  ).getDate();

  next.setDate(Math.min(originalDay, lastDayOfTargetMonth));
  return next;
}

function formatRelativeDays(days: number) {
  const safeDays = Math.max(0, days);
  const months = Math.floor(safeDays / 30);
  const remainderDays = safeDays % 30;

  if (months > 0 && remainderDays > 0) {
    return `${months} bulan ${remainderDays} hari`;
  }

  if (months > 0) {
    return `${months} bulan`;
  }

  return `${remainderDays} hari`;
}

function getTimelineMeta(
  startDate?: NullableDate,
  purchaseDate?: NullableDate,
  estimatedMonths?: number | string | null
) {
  const baseDate = resolveDate(startDate) ?? resolveDate(purchaseDate);
  const months = Math.max(0, Math.round(toNumber(estimatedMonths)));

  if (!baseDate || !months) {
    return {
      headline: "Belum diatur",
      subline: "Timeline belum lengkap",
      deadlineLabel: "—",
      progress: undefined as number | undefined,
      tone: "slate" as Tone,
    };
  }

  const deadline = addMonthsSafe(baseDate, months);
  const now = new Date();

  const totalMs = deadline.getTime() - baseDate.getTime();
  const elapsedMs = now.getTime() - baseDate.getTime();
  const progress =
    totalMs > 0 ? Math.max(0, Math.min(1, elapsedMs / totalMs)) : undefined;

  const diffMs = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays >= 0) {
    return {
      headline: `${formatRelativeDays(diffDays)} lagi`,
      subline: `Target ${formatDate(deadline)}`,
      deadlineLabel: formatDate(deadline),
      progress,
      tone: diffDays <= 45 ? ("amber" as Tone) : ("emerald" as Tone),
    };
  }

  const overdueDays = Math.abs(diffDays);

  return {
    headline: `Lewat ${formatRelativeDays(overdueDays)}`,
    subline: `Target ${formatDate(deadline)}`,
    deadlineLabel: formatDate(deadline),
    progress: 1,
    tone: "rose" as Tone,
  };
}

function resolveBackHref(backHref?: string | null) {
  const value = typeof backHref === "string" ? backHref.trim() : "";
  return value.length > 0 ? value : "/dashboard/project";
}

function buildGoogleDriveThumbnail(value: unknown, size = 200) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) {
    if (raw.includes("drive.google.com")) {
      const fileIdFromQuery = raw.match(/[?&]id=([^&]+)/)?.[1];
      const fileIdFromFile = raw.match(/\/file\/d\/([^/]+)/)?.[1];
      const fileId = fileIdFromQuery || fileIdFromFile;

      if (fileId) {
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
      }
    }

    return raw;
  }

  return `https://drive.google.com/thumbnail?id=${raw}&sz=w${size}`;
}

function pickInvestorAvatar(item: any) {
  const rawAvatar =
    item?.agent?.foto_profil_url ??
    item?.agent?.fotoProfilUrl ??
    item?.foto_profil_url ??
    item?.fotoProfilUrl ??
    item?.avatar ??
    item?.profile_photo ??
    item?.profilePhoto ??
    item?.photo_url ??
    item?.photoUrl ??
    item?.foto ??
    item?.image ??
    item?.gambar ??
    item?.agent?.avatar ??
    item?.agent?.profile_photo ??
    item?.agent?.profilePhoto ??
    item?.agent?.photo_url ??
    item?.agent?.photoUrl ??
    item?.agent?.foto ??
    item?.agent?.image ??
    item?.agent?.gambar ??
    null;

  return buildGoogleDriveThumbnail(rawAvatar, 200);
}

function resolveProjectSelesai(raw: any) {
  return (
    raw?.project_selesai ??
    raw?.projectSelesai ??
    raw?.project_done ??
    raw?.projectDone ??
    raw?.sale ??
    raw?.realizedSale ??
    null
  );
}

function HeroTopBar({
  backHref,
  label,
}: {
  backHref?: string | null;
  label: string;
}) {
  const href = resolveBackHref(backHref);

  return (
    <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 md:p-6 lg:p-7">
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/35 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-2xl transition hover:border-white/20 hover:bg-black/45 md:gap-2 md:px-3 md:py-2 md:text-sm"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] md:h-7 md:w-7">
          <ArrowLeft className="h-3 w-3 md:h-3.5 md:w-3.5" />
        </span>
        <span className="pr-0.5 md:pr-1">Kembali</span>
      </Link>

      <div className="inline-flex items-center rounded-full bg-white/90 px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-950 shadow-[0_10px_30px_rgba(255,255,255,0.12)] backdrop-blur-xl md:px-4 md:py-2 md:text-[11px] md:tracking-[0.28em]">
        {label}
      </div>
    </div>
  );
}

function StatusBadge({
  projectId,
  createdByAgentId,
  status,
  onStatusChanged,
}: {
  projectId?: string | null;
  createdByAgentId?: string | null;
  status: ProjectStatus;
  onStatusChanged?: (next: ProjectStatus) => void;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<ProjectStatus | null>(null);
  const [error, setError] = useState("");

  const sessionAgentId = ((session?.user as any)?.agentId ?? null) as
    | string
    | null;

  const canEdit =
    Boolean(projectId) &&
    Boolean(createdByAgentId) &&
    Boolean(sessionAgentId) &&
    createdByAgentId === sessionAgentId;

  const badgeStyles = STATUS_BADGE_STYLES[status];

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  async function handleChangeStatus(nextStatus: ProjectStatus) {
    if (!projectId) return;

    if (nextStatus === status) {
      setOpen(false);
      return;
    }

    try {
      setPending(nextStatus);
      setError("");

      const response = await fetch(
        `/api/project/catat_arus_kas/${projectId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: nextStatus,
          }),
        }
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload?.message || "Gagal memperbarui status project."
        );
      }

      onStatusChanged?.(nextStatus);
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Terjadi kesalahan saat memperbarui status.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div ref={wrapperRef} className="relative inline-flex z-[80]">
      <button
        type="button"
        onClick={() => {
          if (!canEdit || pending) return;
          setError("");
          setOpen((prev) => !prev);
        }}
        disabled={!canEdit || Boolean(pending)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium backdrop-blur-xl transition",
          badgeStyles.border,
          badgeStyles.softBg,
          badgeStyles.text,
          canEdit && "cursor-pointer hover:border-white/20 hover:bg-white/[0.08]",
          pending && "cursor-wait opacity-85"
        )}
      >
        <span className={cn("h-2.5 w-2.5 rounded-full", badgeStyles.dot)} />
        <span>{getDisplayStatusLabel(status)}</span>

        {canEdit ? (
          <ChevronDown
            className={cn(
              "ml-0.5 h-4 w-4 shrink-0 transition-all duration-200",
              open ? "rotate-180 opacity-100" : "opacity-70"
            )}
          />
        ) : null}

        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      </button>

      {canEdit && open ? (
        <div className="absolute left-0 top-[calc(100%+12px)] z-[999] w-[360px] max-w-[88vw] overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,11,17,0.98),rgba(4,6,10,0.98))] shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-white/70 via-white/20 to-transparent" />
          <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-3xl" />

          <div className="relative p-3">
            <div className="px-2 pb-2">
              <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                Ubah live status
              </div>
            </div>

            <div className="space-y-1">
              {STATUS_OPTIONS.map((item) => {
                const itemStyles = STATUS_BADGE_STYLES[item];
                const isActive = item === status;
                const isLoading = item === pending;

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleChangeStatus(item)}
                    disabled={Boolean(pending)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-[18px] border px-3 py-3 text-left transition",
                      isActive
                        ? cn(
                            itemStyles.optionBorder,
                            itemStyles.optionBg,
                            itemStyles.optionText
                          )
                        : "border-transparent bg-white/[0.02] text-slate-200 hover:border-white/10 hover:bg-white/[0.04]"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          itemStyles.dot
                        )}
                      />
                      <span className="text-sm font-medium">
                        {getDisplayStatusLabel(item)}
                      </span>
                    </div>

                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    ) : isActive ? (
                      <Check className="h-4 w-4 text-white" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            {error ? (
              <div className="px-2 pt-3 text-xs text-rose-300">{error}</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ManagerChip({
  name,
  avatar,
}: {
  name: string;
  avatar?: string | null;
}) {
  const src = normalizeImage(avatar);

  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-black/30 py-2 pl-2 pr-4 backdrop-blur-xl">
      {src ? (
        <img
          src={src}
          alt={name}
          className="h-10 w-10 rounded-full border border-white/15 object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-xs font-semibold text-white">
          {getInitials(name)}
        </div>
      )}

      <div className="leading-tight">
        <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
          Dikelola oleh
        </p>
        <p className="mt-0.5 text-sm font-medium text-white">{name}</p>
      </div>
    </div>
  );
}

function LifecycleRail({ status }: { status: ProjectStatus }) {
  const currentIndex = STATUS_ORDER.indexOf(status);

  if (status === "dibatalkan") {
    return (
      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
            Lifecycle
          </span>
          <span className="text-sm font-medium text-rose-200">
            Proyek dibatalkan
          </span>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-white/10">
          <div className="h-full w-full rounded-full bg-gradient-to-r from-rose-400 via-rose-300 to-orange-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
          Lifecycle
        </span>
        <span className="text-sm font-medium text-white">
          Tahap {currentIndex + 1} / {STATUS_ORDER.length}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {STATUS_ORDER.map((item, index) => {
          const isDone = index < currentIndex;
          const isActive = index === currentIndex;

          return (
            <div
              key={item}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                isDone &&
                  "bg-gradient-to-r from-emerald-400 to-cyan-300 opacity-95",
                isActive &&
                  "bg-white shadow-[0_0_18px_rgba(255,255,255,0.45)]",
                !isDone && !isActive && "bg-white/10"
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

function InfoPanel({
  label,
  value,
  helper,
  helperSub,
  tone,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  helperSub?: string;
  tone: Tone;
  icon?: React.ReactNode;
}) {
  const styles = TONE_STYLES[tone];

  return (
    <div className="relative min-w-0 overflow-hidden rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,15,23,0.96),rgba(7,10,16,0.9))] p-4 backdrop-blur-xl">
      <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r", styles.line)} />
      <div className={cn("absolute -right-8 -top-8 h-24 w-24 rounded-full blur-3xl", styles.glow)} />

      <div className="relative min-w-0">
        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
          {label}
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          {icon ? (
            <span className={cn("shrink-0", styles.text)}>{icon}</span>
          ) : null}
          <span className={cn("break-words text-[26px] font-semibold leading-none tracking-[-0.04em]", styles.text)}>
            {value}
          </span>
        </div>

        <div className="mt-2.5 text-xs font-medium text-slate-300">
          {helper}
        </div>
        {helperSub ? (
          <div className="mt-0.5 text-[10px] text-slate-500">{helperSub}</div>
        ) : null}
      </div>
    </div>
  );
}

function FundingTerminal({
  totalFunded,
  fundingTarget,
  fundedFromInvestorBook,
}: {
  totalFunded: number;
  fundingTarget: number;
  fundedFromInvestorBook: boolean;
}) {
  const clampedFunded =
    fundingTarget > 0 ? Math.min(totalFunded, fundingTarget) : totalFunded;

  const rawProgress = safeDivide(totalFunded, fundingTarget);
  const fundingProgress = Math.max(0, Math.min(1, rawProgress));
  const remainingFunding = Math.max(0, fundingTarget - totalFunded);
  const excessFunding = Math.max(0, totalFunded - fundingTarget);

  const progressWidth =
    totalFunded > 0 ? Math.max(6, Math.min(100, fundingProgress * 100)) : 0;

  const headlineHelper =
    fundingTarget <= 0
      ? "Target pendanaan belum diatur"
      : excessFunding > 0
      ? `Target terpenuhi • +${compactIDR(excessFunding)} di atas target`
      : `${formatPercent(fundingProgress)} dari target pendanaan`;

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,13,21,0.98),rgba(6,8,12,0.96))] p-4 md:p-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-sky-300/70 via-white/20 to-transparent" />
      <div className="absolute -right-10 -top-4 h-32 w-32 rounded-full bg-sky-300/10 blur-3xl" />

      <div className="relative">
        {/* ── Row 1: amount + target side by side ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
              Dana terhimpun
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[28px] font-semibold leading-none tracking-[-0.05em] text-white sm:text-[34px]">
                {compactIDR(clampedFunded)}
              </span>
              {excessFunding > 0 ? (
                <span className="inline-flex items-center rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                  +{compactIDR(excessFunding)}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">{headlineHelper}</p>
            {fundedFromInvestorBook ? (
              <p className="mt-0.5 text-[10px] text-slate-600">
                Investor Book · lunas saja
              </p>
            ) : null}
          </div>

          <div className="shrink-0 rounded-[14px] border border-white/8 bg-white/[0.04] px-3 py-2.5 text-right">
            <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">Target</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {compactIDR(fundingTarget)}
            </p>
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div className="mt-4 relative h-[7px] rounded-full bg-white/[0.08]">
          {progressWidth > 0 ? (
            <div
              className="relative h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-300 shadow-[0_0_16px_rgba(56,189,248,0.28)]"
              style={{ width: `${progressWidth}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2">
                <div className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/30 blur-sm" />
                <div className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/40 animate-ping" />
                <div className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.7)]" />
              </div>
            </div>
          ) : null}
        </div>

        {/* ── Bottom stats: 2 cols ── */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-[14px] border border-white/8 bg-white/[0.03] px-3 py-2.5">
            <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">Sisa kebutuhan</p>
            <p className="mt-1.5 text-sm font-semibold tracking-[-0.02em] text-white">
              {remainingFunding > 0 ? compactIDR(remainingFunding) : "Terpenuhi ✓"}
            </p>
          </div>
          <div className="rounded-[14px] border border-white/8 bg-white/[0.03] px-3 py-2.5">
            <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">
              {excessFunding > 0 ? "Kelebihan dana" : "Progres"}
            </p>
            <p className="mt-1.5 text-sm font-semibold tracking-[-0.02em] text-white">
              {excessFunding > 0
                ? `+${compactIDR(excessFunding)}`
                : formatPercent(fundingProgress)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SaleFloatingButton({
  mode,
  onClick,
}: {
  mode: "input" | "view" | null;
  onClick: () => void;
}) {
  if (!mode) return null;

  const isView = mode === "view";

  return (
    <div className="fixed bottom-5 right-5 z-[120] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      <div
        className={cn(
          "rounded-full px-3 py-1.5 text-[11px] font-medium backdrop-blur-xl border",
          isView
            ? "border-cyan-300/18 bg-cyan-400/10 text-cyan-100"
            : "border-amber-300/18 bg-amber-400/10 text-amber-100"
        )}
      >
        {isView ? "Data realisasi sudah tersimpan" : "Data penjualan belum diisi"}
      </div>

      <button
        type="button"
        onClick={onClick}
        aria-label={isView ? "Buka detail realisasi" : "Buka input penjualan"}
        className={cn(
          "group inline-flex items-center gap-3 rounded-full border px-4 py-3 text-white shadow-[0_16px_40px_rgba(16,185,129,0.14)] backdrop-blur-2xl transition duration-300 active:scale-[0.99]",
          isView
            ? "border-cyan-300/20 bg-[linear-gradient(180deg,rgba(8,14,22,0.96),rgba(7,18,30,0.92))] hover:border-cyan-300/30 hover:bg-[linear-gradient(180deg,rgba(10,18,28,0.98),rgba(8,22,34,0.96))]"
            : "border-emerald-300/20 bg-[linear-gradient(180deg,rgba(8,16,18,0.96),rgba(7,22,20,0.92))] hover:border-emerald-300/30 hover:bg-[linear-gradient(180deg,rgba(10,20,22,0.98),rgba(8,26,23,0.96))]"
        )}
      >
        <span
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full border",
            isView
              ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-100"
              : "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
          )}
        >
          {isView ? (
            <Eye className="h-5 w-5" strokeWidth={2.2} />
          ) : (
            <ReceiptText className="h-5 w-5" strokeWidth={2.2} />
          )}
        </span>

        <span className="flex flex-col items-start text-left">
          <span
            className={cn(
              "text-[10px] uppercase tracking-[0.28em]",
              isView ? "text-cyan-200/65" : "text-emerald-200/65"
            )}
          >
            {isView ? "History" : "Exit"}
          </span>
          <span className="mt-0.5 text-sm font-semibold text-white">
            {isView ? "Lihat Realisasi" : "Input Penjualan"}
          </span>
        </span>
      </button>
    </div>
  );
}

export default function BloombergHeroCard({
  project,
  backHref,
  topBarLabel = "Detail transaksi",
}: {
  project: ProjectDetailViewModel;
  backHref?: string;
  topBarLabel?: string;
}) {
  const { data: session } = useSession();
  const router = useRouter();

  const projectId = useMemo(
    () =>
      String(
        (project as any)?.idProject ??
          (project as any)?.id_project ??
          (project as any)?.id ??
          ""
      ),
    [project]
  );

  const createdByAgentId = useMemo(
    () =>
      ((project as any)?.createdByAgentId ??
        (project as any)?.createdById ??
        (project as any)?.dibuat_oleh ??
        null) as string | null,
    [project]
  );

  const [liveStatus, setLiveStatus] = useState<ProjectStatus>(project.status);
  const [openModalTerjual, setOpenModalTerjual] = useState(false);
  const [saleSubmitting, setSaleSubmitting] = useState(false);

  useEffect(() => {
    setLiveStatus(project.status);
  }, [project.status]);

  const sessionAgentId = ((session?.user as any)?.agentId ?? null) as
    | string
    | null;

  const canManageSale =
    Boolean(projectId) &&
    Boolean(createdByAgentId) &&
    Boolean(sessionAgentId) &&
    createdByAgentId === sessionAgentId;

  const investors = useMemo(() => {
    const raw = (project as any)?.investors;
    if (!Array.isArray(raw)) return [];

    return raw.map((item: any, index: number) => ({
      id_agent:
        item?.id_agent ??
        item?.idAgent ??
        item?.agent_id ??
        item?.agentId ??
        item?.agent?.id_agent ??
        item?.agent?.idAgent ??
        `INV-${index + 1}`,

      nama:
        item?.nama ??
        item?.nama_agent ??
        item?.namaAgent ??
        item?.full_name ??
        item?.name ??
        item?.agent?.nama ??
        item?.agent?.name ??
        `Investor ${index + 1}`,

      avatar: pickInvestorAvatar(item),
      gambar: pickInvestorAvatar(item),
      foto: pickInvestorAvatar(item),
      image: pickInvestorAvatar(item),

      nominal_komitmen:
        item?.nominal_komitmen ??
        item?.nominalKomitmen ??
        item?.committed ??
        item?.nominal_terbayar ??
        item?.nominalTerbayar ??
        0,

      persentase_kepemilikan:
        item?.persentase_kepemilikan ??
        item?.persentaseKepemilikan ??
        item?.ownership_percentage ??
        0,

      status:
        item?.status ??
        item?.status_pembayaran ??
        item?.payment_status ??
        "menunggu_pembayaran",
    }));
  }, [project]);

  const fundedFromInvestorBook = investors.length > 0;

  const totalFunded = useMemo(() => {
    if (!fundedFromInvestorBook) {
      return toNumber(project.totalFunded);
    }

    return investors.reduce((sum: number, item: any) => {
      const status = normalizePaymentStatus(item?.status);
      if (status !== "lunas") return sum;
      return sum + getInvestorCommittedAmount(item);
    }, 0);
  }, [fundedFromInvestorBook, investors, project.totalFunded]);

  const fundingTarget = toNumber(project.fundingTarget);
  const estimatedNetProfit = toNumber(project.estimatedNetProfit);
  const estimatedSellPrice = toNumber(project.estimatedSellPrice);

  const roi = safeDivide(estimatedNetProfit, fundingTarget);
  const multiple =
    fundingTarget > 0
      ? (fundingTarget + estimatedNetProfit) / fundingTarget
      : 0;

  const heroImage = normalizeImage(project.image);
  const locationFull = getLocation(project);
  const timeline = getTimelineMeta(
    project.startDate,
    project.purchaseDate,
    project.estimatedMonths
  );

  const managerName = project.createdByName?.trim() || "";
  const shouldShowManager = Boolean(managerName || project.createdByAvatar);

  const fundingTypeLabel =
    project.fundingType === "terbuka"
      ? "Pendanaan terbuka"
      : "Pendanaan tertutup";

  const rawProject = project as any;
  const rawProjectSelesai = useMemo(
    () => resolveProjectSelesai(rawProject),
    [rawProject]
  );

  const hasSaleData = useMemo(() => {
    const sale = rawProjectSelesai;

    return (
      toNumber(rawProject?.harga_jual) > 0 ||
      toNumber(rawProject?.salePrice) > 0 ||
      toNumber(rawProject?.realizedSellPrice) > 0 ||
      toNumber(rawProject?.profit_bersih_realisasi) > 0 ||
      toNumber(rawProject?.profit_bersih) > 0 ||
      toNumber(rawProject?.total_biaya_transaksi) > 0 ||
      Boolean(rawProject?.tanggal_terjual) ||
      toNumber(sale?.harga_jual) > 0 ||
      toNumber(sale?.profit_bersih) > 0 ||
      toNumber(sale?.profit_kotor) > 0 ||
      toNumber(sale?.total_biaya_transaksi) > 0 ||
      Boolean(sale?.tanggal_terjual)
    );
  }, [rawProject, rawProjectSelesai]);

  const modalProject = useMemo<ModalProjectData>(() => {
    const sale = rawProjectSelesai;

    return {
      id_project: projectId,
      nama_project:
        rawProject?.name ??
        rawProject?.nama_project ??
        rawProject?.namaProject ??
        "",
      estimasi_harga_jual:
        rawProject?.estimatedSellPrice ??
        rawProject?.estimasi_harga_jual ??
        0,
      total_biaya_akuisisi:
        sale?.total_biaya_akuisisi ??
        rawProject?.totalAcquisitionCost ??
        rawProject?.total_biaya_akuisisi ??
        rawProject?.acquisitionCost ??
        0,
      mulai_tanggal:
        rawProject?.startDate ??
        rawProject?.mulai_tanggal ??
        rawProject?.mulaiTanggal ??
        sale?.tanggal_pembelian ??
        null,
      investors,

      tanggal_terjual:
        sale?.tanggal_terjual ??
        rawProject?.tanggal_terjual ??
        rawProject?.tanggalTerjual ??
        rawProject?.soldDate ??
        null,
      harga_jual:
        sale?.harga_jual ??
        rawProject?.harga_jual ??
        rawProject?.salePrice ??
        rawProject?.realizedSellPrice ??
        0,
      pph_percent:
        sale?.pph_percent ??
        rawProject?.pph_percent ??
        rawProject?.pphPercent ??
        2.5,
      ajb_percent:
        sale?.ajb_percent ??
        rawProject?.ajb_percent ??
        rawProject?.ajbPercent ??
        0.5,
      agent_fee_percent:
        sale?.agent_fee_percent ??
        rawProject?.agent_fee_percent ??
        rawProject?.agentFeePercent ??
        2,
      total_biaya_transaksi:
        sale?.total_biaya_transaksi ??
        rawProject?.total_biaya_transaksi ??
        rawProject?.totalBiayaTransaksi ??
        0,
      profit_kotor:
        sale?.profit_kotor ??
        rawProject?.profit_kotor ??
        rawProject?.profitKotor ??
        0,
      profit_bersih:
        sale?.profit_bersih ??
        rawProject?.profit_bersih ??
        rawProject?.profit_bersih_realisasi ??
        rawProject?.profitBersih ??
        0,
      roi_kotor_percent:
        rawProject?.roi_kotor_percent ??
        rawProject?.roiKotorPercent ??
        0,
      roi_bersih_percent:
        sale?.roi_bersih ??
        rawProject?.roi_bersih_percent ??
        rawProject?.roiBersihPercent ??
        0,
    };
  }, [projectId, rawProject, rawProjectSelesai, investors]);

  const saleButtonMode = useMemo<"input" | "view" | null>(() => {
    if (liveStatus !== "terjual") return null;
    if (!canManageSale) return null;
    return hasSaleData ? "view" : "input";
  }, [liveStatus, canManageSale, hasSaleData]);

  const isSaleModalReadOnly = saleButtonMode === "view";

  useEffect(() => {
    if (!saleButtonMode) {
      setOpenModalTerjual(false);
    }
  }, [saleButtonMode]);

  async function handleSubmitSale(payload: SubmitPayload) {
    try {
      setSaleSubmitting(true);

      const response = await fetch(`/api/project/${projectId}/simpan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.message || "Gagal menyimpan data penjualan.");
      }

      setOpenModalTerjual(false);
      router.refresh();
    } catch (error: any) {
      alert(error?.message || "Terjadi kesalahan saat menyimpan penjualan.");
      throw error;
    } finally {
      setSaleSubmitting(false);
    }
  }

  return (
    <>
      <section className="relative overflow-hidden rounded-[38px] border border-white/10 bg-[#06080d] shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_26%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.1),transparent_22%)]" />

        <div className="relative grid min-h-[760px] lg:min-h-[620px] lg:grid-cols-[1.08fr_0.92fr]">
          <div className="relative min-h-[360px] lg:min-h-[620px]">
            {heroImage ? (
              <img
                src={heroImage}
                alt={project.name}
                className="absolute inset-0 h-full w-full object-cover object-center"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="absolute inset-0 bg-[linear-gradient(135deg,#111827,#0b1220,#05070b)]" />
            )}

            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,11,0.05)_0%,rgba(5,7,11,0.10)_26%,rgba(5,7,11,0.58)_72%,rgba(5,7,11,0.96)_100%)] lg:bg-[linear-gradient(180deg,rgba(5,7,11,0.01)_0%,rgba(5,7,11,0.03)_48%,rgba(5,7,11,0.18)_66%,rgba(5,7,11,0.96)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(56,189,248,0.18),transparent_22%),radial-gradient(circle_at_82%_10%,rgba(168,85,247,0.14),transparent_20%)]" />

            <HeroTopBar backHref={backHref} label={topBarLabel} />

            <div className="relative flex h-full flex-col justify-end px-6 pb-6 pt-28 md:px-8 md:pb-8 md:pt-32 lg:p-10">
              <div className="max-w-3xl">
                <h1 className="max-w-4xl text-4xl font-semibold leading-[0.92] tracking-[-0.06em] text-white md:text-6xl xl:text-7xl">
                  {project.name}
                </h1>

                <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-200/88 md:text-[15px]">
                  {project.description?.trim()
                    ? project.description
                    : "Aset dengan struktur pendanaan yang dirancang untuk memberi visibilitas tajam terhadap progres, timeline, dan potensi nilai exit."}
                </p>

                <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-slate-200/90">
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    {project.address || locationFull || "Lokasi belum diisi"}
                  </span>

                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-slate-400" />
                    Akuisisi {formatDate(project.purchaseDate)}
                  </span>

                  <span className="inline-flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-slate-400" />
                    {fundingTypeLabel}
                  </span>
                </div>

                {shouldShowManager ? (
                  <div className="mt-7">
                    <ManagerChip
                      name={managerName || "Manager proyek"}
                      avatar={project.createdByAvatar}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="relative border-t border-white/10 bg-[linear-gradient(180deg,rgba(8,11,17,0.96),rgba(4,6,10,0.99))] lg:border-l lg:border-t-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.08),transparent_24%)]" />

            <div className="relative flex h-full flex-col p-5 md:p-7 lg:p-8">
              <div className="relative z-[30] overflow-visible rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4 backdrop-blur-2xl md:rounded-[30px] md:p-5">
                {/* rounded inner glow — follows border-radius unlike inset-x-0 h-px */}
                <div className="pointer-events-none absolute inset-0 rounded-[25px] bg-[linear-gradient(180deg,rgba(255,255,255,0.07),transparent_35%)] md:rounded-[29px]" />
                <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-3xl" />

                <div className="relative z-0">
                  {/* Mobile: stacked / md+: side-by-side (card is wide enough at md) */}
                  <div className="flex flex-col gap-3 md:grid md:grid-cols-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                        Live status
                      </div>
                      <div className="mt-2.5">
                        <StatusBadge
                          projectId={projectId}
                          createdByAgentId={createdByAgentId}
                          status={liveStatus}
                          onStatusChanged={setLiveStatus}
                        />
                      </div>
                    </div>

                    <div className="md:text-right">
                      <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                        Timeline
                      </div>
                      <div className="mt-2 text-base font-semibold leading-tight text-white md:text-lg">
                        {timeline.headline}
                      </div>
                      <div className="mt-1 text-xs text-slate-400 md:text-sm">
                        {timeline.deadlineLabel}
                      </div>
                    </div>
                  </div>

                  <LifecycleRail status={liveStatus} />
                </div>
              </div>

              <div className="mt-4">
                <FundingTerminal
                  totalFunded={totalFunded}
                  fundingTarget={fundingTarget}
                  fundedFromInvestorBook={fundedFromInvestorBook}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <InfoPanel
                  label="ROI proyeksi"
                  value={formatPercent(roi)}
                  helper={`${formatMultiple(multiple)} return`}
                  helperSub={multiple > 0 ? `Tiap Rp 1 modal kembali Rp ${multiple.toFixed(2)}` : undefined}
                  tone="emerald"
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4">
                      <path fill="currentColor" d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12" opacity=".4"/>
                      <path fill="currentColor" d="M14.5 10.75a.75.75 0 0 1 0-1.5H17a.75.75 0 0 1 .75.75v2.5a.75.75 0 0 1-1.5 0v-.69l-2.013 2.013a1.75 1.75 0 0 1-2.474 0l-1.586-1.586a.25.25 0 0 0-.354 0L7.53 14.53a.75.75 0 0 1-1.06-1.06l2.293-2.293a1.75 1.75 0 0 1 2.474 0l1.586 1.586a.25.25 0 0 0 .354 0l2.012-2.013z"/>
                    </svg>
                  }
                />

                <InfoPanel
                  label="Pendapatan"
                  value={compactIDR(estimatedSellPrice)}
                  helper="Estimasi nilai exit"
                  tone="fuchsia"
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4">
                      <path fill="currentColor" d="m17.967 6.558l-1.83-1.83c-1.546-1.545-2.318-2.318-3.321-2.605c-1.003-.288-2.068-.042-4.197.45l-1.228.283c-1.792.413-2.688.62-3.302 1.233S3.27 5.6 2.856 7.391l-.284 1.228c-.491 2.13-.737 3.194-.45 4.197c.288 1.003 1.061 1.775 2.606 3.32l1.83 1.83C9.248 20.657 10.592 22 12.262 22c1.671 0 3.015-1.344 5.704-4.033c2.69-2.69 4.034-4.034 4.034-5.705c0-1.67-1.344-3.015-4.033-5.704" opacity=".5"/>
                      <path fill="currentColor" d="M11.147 14.328c-.673-.672-.667-1.638-.265-2.403a.75.75 0 0 1 1.04-1.046c.34-.18.713-.276 1.085-.272a.75.75 0 0 1-.014 1.5a.88.88 0 0 0-.609.277c-.387.387-.285.775-.177.884c.11.109.497.21.884-.177c.784-.784 2.138-1.044 3.006-.177c.673.673.667 1.639.264 2.404a.75.75 0 0 1-1.04 1.045a2.2 2.2 0 0 1-1.472.232a.75.75 0 1 1 .302-1.47c.177.037.463-.021.708-.266c.388-.388.286-.775.177-.884s-.496-.21-.884.177c-.784.784-2.138 1.044-3.005.176m-1.126-4.035a2 2 0 1 0-2.828-2.828a2 2 0 0 0 2.828 2.828"/>
                    </svg>
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <SaleFloatingButton
        mode={!saleSubmitting ? saleButtonMode : null}
        onClick={() => setOpenModalTerjual(true)}
      />

      <ModalTerjual
        open={openModalTerjual}
        onClose={() => setOpenModalTerjual(false)}
        project={modalProject}
        onSubmit={handleSubmitSale}
        readOnly={isSaleModalReadOnly}
      />
    </>
  );
}
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type UserInvestment = {
  nominalKomitmen: number;
  persentaseKepemilikan?: number | null;
  status: "lunas" | "menunggu_pembayaran" | string;
  updatedAt?: string | null;
} | null;

type ProjectSelesai = {
  id_project: string;
  id_listing: number | string;
  tanggal_pembelian?: string | Date | null;
  tanggal_terjual: string | Date;
  durasi_hari: number;
  harga_jual: number;
  total_biaya_akuisisi: number;
  profit_kotor: number;
  pph_percent: number;
  ajb_percent: number;
  agent_fee_percent: number;
  total_biaya_transaksi: number;
  profit_bersih: number;
  roi_bersih: number;
  dibuat_tanggal?: string | Date;
  diupdate_tanggal?: string | Date;
};

export type ProjectCampaign = {
  id: string;
  nama: string;
  lokasi: string;
  status: string;
  jenisPendanaan: "terbuka" | "tertutup";
  thumbnail: string;
  targetPendanaan: number;
  totalPendanaan: number;
  estimasiHargaJual: number;
  estimasiProfit: number;
  hariTersisa: number;
  investor: number;
  avatarInvestor?: string[];
  estimasiExit?: string;
  estimasiSelesaiBulan?: number;
  createdById?: string | null;
  userInvestment?: UserInvestment;
  projectSelesai?: ProjectSelesai | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(toNumber(value))
    .replace(/\s/g, " ");
}

function formatCompactIDR(value: number) {
  const safe = toNumber(value);
  const abs = Math.abs(safe);

  if (abs >= 1_000_000_000) {
    return `Rp ${(safe / 1_000_000_000).toLocaleString("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })} M`;
  }

  if (abs >= 1_000_000) {
    return `Rp ${(safe / 1_000_000).toLocaleString("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })} Jt`;
  }

  return formatCurrency(safe);
}

function formatPercent(value: number, max = 1) {
  const safe = toNumber(value);
  return `${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: safe % 1 === 0 ? 0 : Math.min(max, 1),
    maximumFractionDigits: max,
  }).format(safe)}%`;
}

function formatDurationDetailedParts(days: number) {
  const safe = Math.max(0, Math.round(toNumber(days)));
  const months = Math.floor(safe / 30);
  const remainingDays = safe % 30;
  return { months, days: remainingDays };
}

function isLikelyGoogleDriveId(value: string) {
  return /^[A-Za-z0-9_-]{20,}$/.test(value);
}

function extractGoogleDriveId(rawUrl: string) {
  const patterns = [
    /[?&]id=([^&#]+)/i,
    /\/file\/d\/([^/]+)/i,
    /\/d\/([^/]+)/i,
    /\/thumbnail\?id=([^&#]+)/i,
    /\/uc\?(?:[^#]*&)?id=([^&#]+)/i,
  ];

  for (const pattern of patterns) {
    const match = rawUrl.match(pattern);
    if (match?.[1]) return match[1];
  }

  if (isLikelyGoogleDriveId(rawUrl)) return rawUrl;
  return null;
}

function getImageCandidates(url?: string | null, size = 800): string[] {
  if (!url) return [];

  const trimmed = String(url).trim();
  if (!trimmed) return [];

  const driveId = extractGoogleDriveId(trimmed);

  if (driveId) {
    return [`/api/drive-image?id=${driveId}&sz=w${size}`];
  }

  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    return [trimmed];
  }

  if (trimmed.startsWith("//")) return [`https:${trimmed}`];
  if (trimmed.startsWith("/")) return [trimmed];

  return [];
}

function resolveEstimasiSelesaiBulan(project: ProjectCampaign) {
  if (
    typeof project.estimasiSelesaiBulan === "number" &&
    Number.isFinite(project.estimasiSelesaiBulan) &&
    project.estimasiSelesaiBulan > 0
  ) {
    return project.estimasiSelesaiBulan;
  }

  if (project.estimasiExit) {
    const matched = project.estimasiExit.match(/\d+/);
    if (matched) return Number(matched[0]);
  }

  return Math.max(1, Math.ceil(project.hariTersisa / 30) || 1);
}

function getProgress(project: ProjectCampaign) {
  if (toNumber(project.targetPendanaan) <= 0) return 0;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (toNumber(project.totalPendanaan) / toNumber(project.targetPendanaan)) *
          100
      )
    )
  );
}

function getProjectedROI(project: ProjectCampaign) {
  if (toNumber(project.targetPendanaan) <= 0) return 0;

  return Math.max(
    0,
    Number(
      (
        (toNumber(project.estimasiProfit) / toNumber(project.targetPendanaan)) *
        100
      ).toFixed(1)
    )
  );
}

function getStatusTone(status: string, isSold?: boolean) {
  if (isSold) {
    return {
      pill: "border-violet-400/30 bg-violet-500/15 text-violet-200",
      dot: "bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,1)]",
    };
  }

  const value = status.toLowerCase();

  if (value.includes("tertutup")) {
    return {
      pill: "border-sky-400/30 bg-sky-500/12 text-sky-200",
      dot: "bg-sky-400 shadow-[0_0_10px_rgba(125,211,252,1)]",
    };
  }

  if (value.includes("pendanaan")) {
    return {
      pill: "border-emerald-400/30 bg-emerald-500/12 text-emerald-200",
      dot: "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,1)]",
    };
  }

  if (value.includes("renovasi")) {
    return {
      pill: "border-amber-400/30 bg-amber-500/12 text-amber-200",
      dot: "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,1)]",
    };
  }

  if (value.includes("jual")) {
    return {
      pill: "border-violet-400/30 bg-violet-500/12 text-violet-200",
      dot: "bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,1)]",
    };
  }

  return {
    pill: "border-white/20 bg-white/[0.07] text-white/90",
    dot: "bg-white/85 shadow-[0_0_8px_rgba(255,255,255,0.6)]",
  };
}

function getPaymentTone(status?: string | null, isSold?: boolean) {
  const value = String(status || "").toLowerCase();

  if (isSold) {
    return {
      wrap: "border-violet-400/20 bg-[linear-gradient(135deg,rgba(109,40,217,0.15)_0%,rgba(91,33,182,0.08)_60%,rgba(15,23,42,0.04)_100%)]",
      amount: "text-violet-200",
      statusBadge: "border-violet-400/25 bg-violet-500/12 text-violet-200",
      ownershipBadge: "border-white/15 bg-white/[0.06] text-white/80",
      glow: "from-violet-500/10 via-fuchsia-500/0 to-transparent",
    };
  }

  if (value === "lunas") {
    return {
      wrap: "border-emerald-400/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.14)_0%,rgba(16,185,129,0.06)_55%,rgba(6,78,59,0.04)_100%)]",
      amount: "text-emerald-200",
      statusBadge: "border-emerald-400/25 bg-emerald-500/12 text-emerald-200",
      ownershipBadge: "border-white/15 bg-white/[0.06] text-white/80",
      glow: "from-emerald-500/10 via-emerald-400/0 to-transparent",
    };
  }

  if (value.includes("menunggu")) {
    return {
      wrap: "border-amber-400/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.14)_0%,rgba(245,158,11,0.06)_55%,rgba(120,53,15,0.04)_100%)]",
      amount: "text-amber-200",
      statusBadge: "border-amber-400/25 bg-amber-500/12 text-amber-200",
      ownershipBadge: "border-white/15 bg-white/[0.06] text-white/80",
      glow: "from-amber-500/10 via-amber-400/0 to-transparent",
    };
  }

  return {
    wrap: "border-white/12 bg-[linear-gradient(135deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)]",
    amount: "text-white",
    statusBadge: "border-white/18 bg-white/[0.07] text-white/85",
    ownershipBadge: "border-white/15 bg-white/[0.06] text-white/80",
    glow: "from-white/8 via-white/0 to-transparent",
  };
}

function getGrowthTone(percent: number) {
  if (percent < 0) {
    return { wrap: "border-rose-400/25 bg-rose-500/12 text-rose-200", down: true };
  }
  if (percent <= 20) {
    return { wrap: "border-amber-400/25 bg-amber-500/12 text-amber-200", down: false };
  }
  if (percent <= 45) {
    return { wrap: "border-sky-400/25 bg-sky-500/12 text-sky-200", down: false };
  }
  return { wrap: "border-emerald-400/25 bg-emerald-500/12 text-emerald-200", down: false };
}

function SmartImage({
  src,
  alt,
  className,
  size = 800,
}: {
  src?: string | null;
  alt: string;
  className: string;
  size?: number;
}) {
  const candidates = useMemo(() => getImageCandidates(src, size), [src, size]);
  const [index, setIndex] = useState(0);

  const currentSrc = candidates[index] || "";

  if (!currentSrc) {
    return (
      <div
        className={cn(
          className,
          "flex items-center justify-center bg-[linear-gradient(135deg,#0d1f35_0%,#071525_60%,#050e1a_100%)]"
        )}
      >
        <div className="h-28 w-28 rounded-full bg-emerald-500/8 blur-3xl" />
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => {
        if (index < candidates.length - 1) {
          setIndex((prev) => prev + 1);
        } else {
          setIndex(candidates.length);
        }
      }}
    />
  );
}

function SmartAvatar({
  src,
  alt,
  fallbackText,
  className,
  size = 120,
}: {
  src?: string | null;
  alt: string;
  fallbackText: string;
  className: string;
  size?: number;
}) {
  const candidates = useMemo(() => getImageCandidates(src, size), [src, size]);
  const [index, setIndex] = useState(0);

  const currentSrc = candidates[index] || "";
  const initial = (fallbackText || "?").slice(0, 1).toUpperCase();

  if (!currentSrc) {
    return (
      <div
        className={cn(
          className,
          "flex items-center justify-center bg-white/10 text-[10px] font-bold text-white backdrop-blur-md"
        )}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => {
        if (index < candidates.length - 1) {
          setIndex((prev) => prev + 1);
        } else {
          setIndex(candidates.length);
        }
      }}
    />
  );
}

function InvestorStack({
  totalInvestor,
  avatars = [],
}: {
  totalInvestor: number;
  avatars?: string[];
}) {
  if (totalInvestor <= 0) return null;

  const safeAvatars = avatars.filter(Boolean);
  const visible = totalInvestor > 4 ? safeAvatars.slice(0, 3) : safeAvatars.slice(0, 4);
  const overflow = totalInvestor > 4 ? totalInvestor - 3 : 0;

  return (
    <div className="flex flex-shrink-0 items-center">
      {visible.map((src, index) => (
        <SmartAvatar
          key={`${src}-${index}`}
          src={src}
          alt={`Investor ${index + 1}`}
          fallbackText={`I${index + 1}`}
          className={cn(
            "h-8 w-8 rounded-full border border-white/25 object-cover shadow-[0_4px_14px_rgba(0,0,0,0.5)] ring-[1.5px] ring-black/30",
            index !== 0 && "-ml-2"
          )}
        />
      ))}
      {overflow > 0 && (
        <div className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/12 text-[9px] font-bold text-white backdrop-blur-md">
          +{overflow}
        </div>
      )}
    </div>
  );
}

/* ─── Pill Badge ────────────────────────────────────── */
function Pill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[9px] font-bold tracking-[0.14em] backdrop-blur-md",
        className
      )}
    >
      {children}
    </span>
  );
}

/* ─── Metric Card (2-col grid) ──────────────────────── */
function MetricCard({
  label,
  value,
  sub,
  accent = "default",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: "default" | "emerald" | "sky" | "violet" | "amber";
}) {
  const bg: Record<string, string> = {
    default: "border-white/10 bg-white/[0.04]",
    emerald: "border-emerald-500/20 bg-emerald-500/[0.08]",
    sky: "border-sky-500/20 bg-sky-500/[0.08]",
    violet: "border-violet-500/20 bg-violet-500/[0.08]",
    amber: "border-amber-500/20 bg-amber-500/[0.08]",
  };

  const label_: Record<string, string> = {
    default: "text-slate-500",
    emerald: "text-emerald-600/80",
    sky: "text-sky-600/80",
    violet: "text-violet-600/80",
    amber: "text-amber-600/80",
  };

  const val_: Record<string, string> = {
    default: "text-white",
    emerald: "text-emerald-200",
    sky: "text-sky-200",
    violet: "text-violet-200",
    amber: "text-amber-200",
  };

  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-2xl border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        bg[accent]
      )}
    >
      <p className={cn("text-[9px] font-bold uppercase tracking-[0.2em]", label_[accent])}>
        {label}
      </p>
      <div
        className={cn(
          "mt-2 text-[clamp(20px,3.5vw,28px)] font-bold leading-none tracking-[-0.04em]",
          val_[accent]
        )}
      >
        {value}
      </div>
      {sub && (
        <p className="mt-2 line-clamp-2 text-[11px] leading-[1.4] text-slate-500">
          {sub}
        </p>
      )}
    </div>
  );
}

/* ─── Funding Progress Panel ────────────────────────── */
function FundingPanel({
  progress,
  totalPendanaan,
  targetPendanaan,
  sisaPendanaan,
  investor,
}: {
  progress: number;
  totalPendanaan: number;
  targetPendanaan: number;
  sisaPendanaan: number;
  investor: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      {/* Progress header */}
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
            Funding Progress
          </p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-[28px] font-bold leading-none tracking-[-0.04em] text-white">
              {progress}%
            </span>
            <Pill className="border-emerald-400/25 bg-emerald-500/12 text-emerald-300">
              ACTIVE
            </Pill>
          </div>
        </div>

        <div
          className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-right"
          title={formatCurrency(sisaPendanaan)}
        >
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Sisa Target
          </p>
          <p className="mt-1 text-sm font-bold text-emerald-300">
            {formatCompactIDR(sisaPendanaan)}
          </p>
        </div>
      </div>

      {/* Bar */}
      <div className="mx-4 mt-3 h-[6px] overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#059669_0%,#34d399_55%,#7dd3fc_100%)] shadow-[0_0_12px_rgba(52,211,153,0.5)] transition-all duration-700"
          style={{ width: `${Math.max(1, progress)}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="mt-3 grid grid-cols-3 divide-x divide-white/[0.06] border-t border-white/[0.06] px-0">
        <div className="px-4 py-3" title={formatCurrency(totalPendanaan)}>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Raised
          </p>
          <p className="mt-1 text-sm font-bold text-white">
            {formatCompactIDR(totalPendanaan)}
          </p>
        </div>

        <div className="px-4 py-3 text-center">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Investor
          </p>
          <p className="mt-1 text-sm font-bold text-white">{investor}</p>
        </div>

        <div className="px-4 py-3 text-right" title={formatCurrency(targetPendanaan)}>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Target
          </p>
          <p className="mt-1 text-sm font-bold text-white">
            {formatCompactIDR(targetPendanaan)}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Sold Funding Panel ────────────────────────────── */
function SoldFundingPanel({ projectSelesai }: { projectSelesai: ProjectSelesai }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-violet-500/20 bg-violet-500/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
            Profit Bersih
          </p>
          <p className="mt-1.5 text-[28px] font-bold leading-none tracking-[-0.04em] text-white">
            {formatCompactIDR(projectSelesai.profit_bersih)}
          </p>
          <p className="mt-1 text-[10px] text-slate-600">
            {formatCurrency(projectSelesai.profit_bersih)}
          </p>
        </div>
        <Pill className="border-violet-400/25 bg-violet-500/15 text-violet-300">
          REALIZED
        </Pill>
      </div>

      {/* Full bar */}
      <div className="mx-4 mt-3 h-[6px] overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full w-full rounded-full bg-[linear-gradient(90deg,#7c3aed_0%,#a78bfa_55%,#c4b5fd_100%)] shadow-[0_0_12px_rgba(139,92,246,0.45)]" />
      </div>

      {/* Stats */}
      <div className="mt-3 grid grid-cols-3 divide-x divide-white/[0.06] border-t border-white/[0.06]">
        <div className="px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Akuisisi
          </p>
          <p className="mt-1 text-sm font-bold text-white">
            {formatCompactIDR(projectSelesai.total_biaya_akuisisi)}
          </p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Transaksi
          </p>
          <p className="mt-1 text-sm font-bold text-white">
            {formatCompactIDR(projectSelesai.total_biaya_transaksi)}
          </p>
        </div>
        <div className="px-4 py-3 text-right">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
            ROI
          </p>
          <p className="mt-1 text-sm font-bold text-violet-200">
            {formatPercent(projectSelesai.roi_bersih)}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── User Investment Panel ─────────────────────────── */
function getActualInvestorProfit(
  investment: UserInvestment,
  projectSelesai?: ProjectSelesai | null
) {
  if (!investment || !projectSelesai) return 0;
  const modal = toNumber(investment.nominalKomitmen);
  const roiAktual = toNumber(projectSelesai.roi_bersih);
  const porsi = toNumber(investment.persentaseKepemilikan);
  if (porsi > 0) {
    return Number(((toNumber(projectSelesai.profit_bersih) * porsi) / 100).toFixed(0));
  }
  return Number(((modal * roiAktual) / 100).toFixed(0));
}

function UserInvestmentPanel({
  investment,
  projectSelesai,
}: {
  investment?: UserInvestment;
  projectSelesai?: ProjectSelesai | null;
}) {
  const isSold = !!projectSelesai;

  if (!investment) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-4">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">
            Komitmen Investasi
          </p>
          <p className="mt-2 text-xl font-bold text-slate-700">Belum Ada</p>
        </div>
        <div className="h-8 w-8 rounded-full border border-white/[0.06] bg-white/[0.03]" />
      </div>
    );
  }

  const tone = getPaymentTone(investment.status, isSold);

  const ownership =
    typeof investment.persentaseKepemilikan === "number" &&
    Number.isFinite(investment.persentaseKepemilikan)
      ? formatPercent(investment.persentaseKepemilikan, 2)
      : null;

  /* ── SOLD MODE ───────────────────────────────────── */
  if (isSold && projectSelesai) {
    const modalAwal = toNumber(investment.nominalKomitmen);
    const profitInvestor = getActualInvestorProfit(investment, projectSelesai);
    const modalAkhir = modalAwal + profitInvestor;
    const growthPercent =
      modalAwal > 0 ? Number(((profitInvestor / modalAwal) * 100).toFixed(1)) : 0;
    const growthTone = getGrowthTone(growthPercent);

    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
          tone.wrap
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-r",
            tone.glow
          )}
        />
        <div className="relative space-y-3">
          {/* Badge row — uses shrink-0 so badges never stretch */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill className={tone.statusBadge}>INVESTASI SAYA</Pill>
            {ownership && (
              <Pill className={tone.ownershipBadge}>PORSI {ownership}</Pill>
            )}
            <Pill
              className={cn(
                "inline-flex items-center gap-1",
                growthTone.wrap
              )}
            >
              {growthTone.down ? (
                <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14m0 0-5-5m5 5 5-5" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 19V5m0 0-5 5m5-5 5 5" />
                </svg>
              )}
              {formatPercent(Math.abs(growthPercent), 1)}
            </Pill>
          </div>

          {/* Modal flow: before → after */}
          <div className="grid grid-cols-[1fr_28px_1fr] items-center gap-2">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Modal
              </p>
              <p className="mt-1 truncate text-[clamp(18px,4vw,26px)] font-bold leading-none tracking-[-0.04em] text-white/85">
                {formatCompactIDR(modalAwal)}
              </p>
            </div>

            <div className="flex items-center justify-center text-white/25">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </div>

            <div className="min-w-0 text-right">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Nilai Akhir
              </p>
              <p
                className={cn(
                  "mt-1 truncate text-[clamp(18px,4vw,26px)] font-bold leading-none tracking-[-0.04em]",
                  tone.amount
                )}
              >
                {formatCompactIDR(modalAkhir)}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── ACTIVE MODE ─────────────────────────────────── */
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        tone.wrap
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-r",
          tone.glow
        )}
      />

      <div className="relative">
        {/* Badge row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill className={tone.statusBadge}>
            {String(investment.status).replace(/_/g, " ").toUpperCase()}
          </Pill>
          {ownership && (
            <Pill className={tone.ownershipBadge}>PORSI {ownership}</Pill>
          )}
        </div>

        {/* Amount — compact format fixes overflow for large numbers */}
        <p
          className={cn(
            "mt-3 text-[clamp(22px,5vw,32px)] font-bold leading-none tracking-[-0.04em]",
            tone.amount
          )}
        >
          {formatCompactIDR(investment.nominalKomitmen)}
        </p>

        {/* Full amount as subtle reference */}
        <p className="mt-1 text-[10px] text-slate-600">
          {formatCurrency(investment.nominalKomitmen)}
        </p>
      </div>
    </div>
  );
}

/* ─── Asset Value Panel ─────────────────────────────── */
function AssetValuePanel({
  label,
  amount,
  badgeLabel,
  accent = "default",
}: {
  label: string;
  amount: number;
  badgeLabel: string;
  accent?: "default" | "violet";
}) {
  const styles = {
    default: {
      wrap: "border-white/10 bg-white/[0.03]",
      amount: "text-white",
      badge: "border-white/12 bg-white/[0.05] text-white/65",
    },
    violet: {
      wrap: "border-violet-500/20 bg-violet-500/[0.08]",
      amount: "text-violet-200",
      badge: "border-violet-400/25 bg-violet-500/12 text-violet-300",
    },
  }[accent];

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 overflow-hidden rounded-2xl border px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        styles.wrap
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
          {label}
        </p>
        <p
          className={cn(
            "mt-1.5 truncate text-[clamp(18px,4.5vw,26px)] font-bold leading-none tracking-[-0.04em]",
            styles.amount
          )}
        >
          {formatCompactIDR(amount)}
        </p>
        <p className="mt-0.5 truncate text-[10px] text-slate-600">
          {formatCurrency(amount)}
        </p>
      </div>

      <Pill className={cn("shrink-0", styles.badge)}>{badgeLabel}</Pill>
    </div>
  );
}

/* ─── Main Card Component ───────────────────────────── */
export default function ProjectFundraisingCard({
  project,
  adminMode = false,
  isDeleting = false,
  onDelete,
}: {
  project: ProjectCampaign;
  adminMode?: boolean;
  isDeleting?: boolean;
  onDelete?: (project: ProjectCampaign) => void | Promise<void>;
}) {
  const isSold = !!project.projectSelesai;
  const progress = getProgress(project);
  const projectedRoi = getProjectedROI(project);
  const exitMonths = resolveEstimasiSelesaiBulan(project);
  const sisaPendanaan = Math.max(
    0,
    toNumber(project.targetPendanaan) - toNumber(project.totalPendanaan)
  );
  const statusTone = getStatusTone(project.status, isSold);

  const detailHref = `/dashboard/project/detail_transaksi/${encodeURIComponent(project.id)}`;
  const manageFundHref = `${detailHref}/arus_kas`;

  const handleDeleteClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDeleting || !onDelete) return;
    void onDelete(project);
  };

  const durasiParts = project.projectSelesai
    ? formatDurationDetailedParts(project.projectSelesai.durasi_hari)
    : null;

  return (
    <article className="group relative self-start overflow-hidden rounded-[30px] border border-white/[0.09] bg-[linear-gradient(180deg,#070d18_0%,#04080f_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-300 will-change-transform hover:-translate-y-0.5 hover:shadow-[0_30px_100px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.05)]">

      {/* Ambient glow layer */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0",
          isSold
            ? "bg-[radial-gradient(ellipse_60%_40%_at_80%_0%,rgba(109,40,217,0.14),transparent),radial-gradient(ellipse_50%_35%_at_10%_100%,rgba(16,185,129,0.07),transparent)]"
            : "bg-[radial-gradient(ellipse_60%_40%_at_80%_0%,rgba(16,185,129,0.10),transparent),radial-gradient(ellipse_50%_35%_at_10%_100%,rgba(56,189,248,0.08),transparent)]"
        )}
      />

      {/* ── HERO IMAGE ─────────────────────────────────── */}
      {/* Outer: positions all overlays; no overflow-hidden so avatars never clip */}
      <div className="relative h-[272px]">
        {/* Image + gradients clipped to the container */}
        <div className="absolute inset-0 overflow-hidden">
          <SmartImage
            src={project.thumbnail}
            alt={project.nama}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,15,0.05)_0%,rgba(4,8,15,0.12)_25%,rgba(4,8,15,0.55)_65%,rgba(4,8,15,0.96)_100%)]" />
          <div className="absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,transparent_100%)]" />
        </div>

        {/* Top badge row — outside overflow-hidden */}
        <div className="absolute left-4 right-4 top-4 z-10 flex items-start justify-between gap-2">
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[9px] font-bold tracking-[0.16em] backdrop-blur-xl",
              statusTone.pill
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", statusTone.dot)} />
            {isSold ? "SUDAH TERJUAL" : project.status.toUpperCase()}
          </span>

          {adminMode ? (
            <button
              type="button"
              onClick={handleDeleteClick}
              disabled={isDeleting || !onDelete}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-rose-400/25 bg-rose-500/12 px-3 py-1.5 text-[9px] font-bold tracking-[0.16em] text-rose-200 backdrop-blur-xl transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M8 6V4.75A1.75 1.75 0 0 1 9.75 3h4.5A1.75 1.75 0 0 1 16 4.75V6M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
              {isDeleting ? "DELETING…" : "DELETE"}
            </button>
          ) : (
            <Pill
              className={
                isSold
                  ? "border-violet-400/25 bg-violet-500/12 text-violet-300"
                  : project.jenisPendanaan === "tertutup"
                  ? "border-sky-400/25 bg-sky-500/12 text-sky-200"
                  : "border-white/15 bg-black/30 text-white/80"
              }
            >
              {isSold
                ? "REALIZED ASSET"
                : project.jenisPendanaan === "tertutup"
                ? "PRIVATE ACCESS"
                : `${project.hariTersisa} HARI LAGI`}
            </Pill>
          )}
        </div>

        {/* Bottom info + investor avatars — outside overflow-hidden so nothing clips */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pb-5">
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.28em] text-white/35">
            {project.id}
          </p>
          <div className="flex items-end justify-between gap-3">
            <h3 className="min-w-0 flex-1 line-clamp-2 text-[22px] font-bold leading-[1.1] tracking-[-0.04em] text-white">
              {project.nama}
            </h3>
            <InvestorStack
              totalInvestor={project.investor}
              avatars={project.avatarInvestor}
            />
          </div>
          <p className="mt-2 truncate text-sm text-white/55">{project.lokasi}</p>
        </div>
      </div>

      {/* ── CONTENT SECTION ────────────────────────────── */}
      <div className="space-y-3 p-4">

        {/* 1. My Investment */}
        <UserInvestmentPanel
          investment={project.userInvestment}
          projectSelesai={project.projectSelesai}
        />

        {/* 2. Key Metrics */}
        {isSold && project.projectSelesai ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                label="ROI Aktual"
                value={formatPercent(project.projectSelesai.roi_bersih, 1)}
                sub="Return bersih terealisasi"
                accent="emerald"
              />
              <MetricCard
                label="Durasi Aktual"
                value={
                  <span className="inline-flex items-baseline gap-1">
                    <span>{durasiParts?.months ?? 0}</span>
                    <span className="text-[0.55em] font-medium opacity-80">bln</span>
                    {(durasiParts?.days ?? 0) > 0 && (
                      <>
                        <span>{durasiParts?.days}</span>
                        <span className="text-[0.55em] font-medium opacity-80">hr</span>
                      </>
                    )}
                  </span>
                }
                sub="Waktu real hingga terjual"
                accent="sky"
              />
            </div>

            {/* 3. Sold funding result */}
            <SoldFundingPanel projectSelesai={project.projectSelesai} />

            {/* 4. Asset sell price */}
            <AssetValuePanel
              label="Harga Jual Aktual"
              amount={project.projectSelesai.harga_jual}
              badgeLabel="CLOSED DEAL"
              accent="violet"
            />
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                label="Estimasi ROI"
                value={formatPercent(projectedRoi, 1)}
                sub={`Est. laba ${formatCompactIDR(project.estimasiProfit)}`}
                accent="emerald"
              />
              <MetricCard
                label="Estimasi Exit"
                value={
                  <span className="inline-flex items-baseline gap-1">
                    <span>{exitMonths}</span>
                    <span className="text-[0.55em] font-medium opacity-80">bln</span>
                  </span>
                }
                sub={project.estimasiExit || "Horizon exit terukur"}
                accent="sky"
              />
            </div>

            {/* 3. Funding progress */}
            <FundingPanel
              progress={progress}
              totalPendanaan={toNumber(project.totalPendanaan)}
              targetPendanaan={toNumber(project.targetPendanaan)}
              sisaPendanaan={sisaPendanaan}
              investor={project.investor}
            />

            {/* 4. Asset value */}
            <AssetValuePanel
              label="Estimasi Harga Jual"
              amount={project.estimasiHargaJual}
              badgeLabel="PREMIUM ASSET"
            />
          </>
        )}

        {/* ── ACTION BUTTONS ───────────────────────────── */}
        <div className="flex flex-col gap-2.5 pt-1">
          <Link
            href={detailHref}
            className={cn(
              "relative overflow-hidden rounded-2xl px-5 py-3.5 text-center text-sm font-bold tracking-[0.02em] transition-all duration-200 active:scale-[0.99]",
              isSold
                ? "bg-[linear-gradient(135deg,#7c3aed_0%,#6d28d9_50%,#4c1d95_100%)] text-white shadow-[0_12px_28px_rgba(109,40,217,0.35)] hover:shadow-[0_16px_36px_rgba(109,40,217,0.45)]"
                : "bg-[linear-gradient(135deg,#059669_0%,#10b981_50%,#34d399_100%)] text-white shadow-[0_12px_28px_rgba(16,185,129,0.32)] hover:shadow-[0_16px_36px_rgba(16,185,129,0.42)]"
            )}
          >
            {/* Shine effect */}
            <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_25%,rgba(255,255,255,0.15)_50%,transparent_75%)] translate-x-[-100%] transition-transform duration-500 group-hover:translate-x-[100%]" />
            <span className="relative">{isSold ? "Lihat Hasil Aktual" : "Lihat Detail"}</span>
          </Link>

          {adminMode && (
            <Link
              href={manageFundHref}
              className="rounded-2xl border border-white/12 bg-white/[0.04] px-5 py-3.5 text-center text-sm font-bold tracking-[0.02em] text-white/80 backdrop-blur-md transition-all duration-200 hover:bg-white/[0.07] hover:text-white active:scale-[0.99]"
            >
              {isSold ? "Lihat Arus Kas" : "Kelola Dana"}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

"use client";

import { useState } from "react";
import {
  Crown,
  Gem,
  Rocket,
  Shield,
} from "lucide-react";


import { toast } from "sonner";
import AddProjectModal, {
  type CreateProjectFormValues,
  type ModalTierTheme,
} from "./modal/AddProjectModal";
import type { CreateProjectSubmitResponse } from "./modal/types";
import { buildCreateProjectPayload } from "./modal/utils";

type Props = {
  totalDana: number;
  totalDanaLunas?: number;
  totalDanaPending?: number;
  projectAktif: number;
  jumlahPropertyDidanai: number;
  pendingPaymentCount?: number;
  pendingProjectCount?: number;
  hasPendingPayment?: boolean;
  realizedProfit?: number;
  jabatan?: string | null;
  createdById?: string;
  onCreateProject?: (values: CreateProjectFormValues) => void | Promise<void>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

type TierTheme = ModalTierTheme & {
  deskripsi: string;
  shortcut: string;
  shortcutHover: string;
};

function getTierTheme(totalDana: number): TierTheme {
  if (totalDana < 20_000_000) {
    return {
      nama: "Power Investor",
      deskripsi:
        "Tier awal untuk investor yang baru mulai membangun portofolio pendanaan.",
      shell:
        "border-emerald-400/15 bg-[linear-gradient(135deg,#06110d_0%,#0a1914_30%,#0e241c_65%,#123126_100%)]",
      overlay:
        "bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.20),transparent_24%),radial-gradient(circle_at_85%_18%,rgba(52,211,153,0.14),transparent_18%),radial-gradient(circle_at_50%_120%,rgba(45,212,191,0.10),transparent_28%)]",
      edgeGlow: "shadow-[0_30px_120px_rgba(16,185,129,0.12)]",
      orbA: "bg-emerald-400/18",
      orbB: "bg-teal-300/14",
      orbC: "bg-lime-200/8",
      badge: "border-emerald-400/20 bg-emerald-500/12 text-emerald-300",
      shortcut: "border-white/10 bg-white/[0.05]",
      shortcutHover: "hover:border-emerald-400/24 hover:bg-white/[0.07]",
      actionButton:
        "bg-[linear-gradient(135deg,#34d399_0%,#4ade80_55%,#86efac_100%)] text-[#07110b] hover:brightness-110",
      accentText: "text-emerald-300",
      modalField: "border-white/10 bg-white/[0.05]",
      modalFieldFocus:
        "focus:border-emerald-400/40 focus:bg-white/[0.07] focus:ring-2 focus:ring-emerald-400/10",
      modalMutedButton: "border-white/10 bg-white/[0.04]",
      modalMutedButtonHover:
        "hover:bg-white/[0.08] hover:border-emerald-400/24",
      icon: Rocket,
    };
  }

  if (totalDana < 100_000_000) {
    return {
      nama: "Crown Investor",
      deskripsi:
        "Tier menengah untuk investor dengan nominal pendanaan yang sudah semakin serius.",
      shell:
        "border-rose-400/15 bg-[linear-gradient(135deg,#12070c_0%,#1b0b12_28%,#27101a_62%,#341320_100%)]",
      overlay:
        "bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.20),transparent_24%),radial-gradient(circle_at_84%_18%,rgba(251,113,133,0.14),transparent_18%),radial-gradient(circle_at_50%_120%,rgba(217,70,239,0.10),transparent_28%)]",
      edgeGlow: "shadow-[0_30px_120px_rgba(244,63,94,0.12)]",
      orbA: "bg-rose-400/18",
      orbB: "bg-fuchsia-300/14",
      orbC: "bg-pink-200/8",
      badge: "border-rose-400/20 bg-rose-500/12 text-rose-300",
      shortcut: "border-white/10 bg-white/[0.05]",
      shortcutHover: "hover:border-rose-400/24 hover:bg-white/[0.07]",
      actionButton:
        "bg-[linear-gradient(135deg,#fb7185_0%,#f43f5e_60%,#e11d48_100%)] text-white hover:brightness-110",
      accentText: "text-rose-300",
      modalField: "border-white/10 bg-white/[0.05]",
      modalFieldFocus:
        "focus:border-rose-400/40 focus:bg-white/[0.07] focus:ring-2 focus:ring-rose-400/10",
      modalMutedButton: "border-white/10 bg-white/[0.04]",
      modalMutedButtonHover: "hover:bg-white/[0.08] hover:border-rose-400/24",
      icon: Crown,
    };
  }

  if (totalDana < 500_000_000) {
    return {
      nama: "Royal Investor",
      deskripsi:
        "Tier tinggi untuk investor dengan posisi pendanaan besar dan portofolio yang matang.",
      shell:
        "border-amber-300/15 bg-[linear-gradient(135deg,#140f06_0%,#1d1508_28%,#2a1e0b_62%,#38280e_100%)]",
      overlay:
        "bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.20),transparent_24%),radial-gradient(circle_at_84%_18%,rgba(253,224,71,0.14),transparent_18%),radial-gradient(circle_at_50%_120%,rgba(245,158,11,0.10),transparent_28%)]",
      edgeGlow: "shadow-[0_30px_120px_rgba(251,191,36,0.12)]",
      orbA: "bg-amber-300/18",
      orbB: "bg-yellow-200/14",
      orbC: "bg-orange-200/8",
      badge: "border-amber-300/22 bg-amber-400/12 text-amber-200",
      shortcut: "border-white/10 bg-white/[0.05]",
      shortcutHover: "hover:border-amber-300/24 hover:bg-white/[0.07]",
      actionButton:
        "bg-[linear-gradient(135deg,#fbbf24_0%,#f59e0b_58%,#fcd34d_100%)] text-[#1b1205] hover:brightness-110",
      accentText: "text-amber-200",
      modalField: "border-white/10 bg-white/[0.05]",
      modalFieldFocus:
        "focus:border-amber-300/40 focus:bg-white/[0.07] focus:ring-2 focus:ring-amber-300/10",
      modalMutedButton: "border-white/10 bg-white/[0.04]",
      modalMutedButtonHover:
        "hover:bg-white/[0.08] hover:border-amber-300/24",
      icon: Gem,
    };
  }

  return {
    nama: "Elite Investor",
    deskripsi:
      "Tier tertinggi untuk investor dengan akumulasi modal besar dan eksposur pendanaan premium.",
    shell:
      "border-slate-300/16 bg-[linear-gradient(135deg,#090c11_0%,#10151d_28%,#171e28_62%,#202734_100%)]",
    overlay:
      "bg-[radial-gradient(circle_at_top_left,rgba(203,213,225,0.18),transparent_24%),radial-gradient(circle_at_84%_18%,rgba(148,163,184,0.14),transparent_18%),radial-gradient(circle_at_50%_120%,rgba(244,244,245,0.08),transparent_28%)]",
    edgeGlow: "shadow-[0_30px_120px_rgba(148,163,184,0.12)]",
    orbA: "bg-slate-300/16",
    orbB: "bg-zinc-200/12",
    orbC: "bg-white/8",
    badge: "border-slate-300/22 bg-slate-400/12 text-slate-100",
    shortcut: "border-white/10 bg-white/[0.05]",
    shortcutHover: "hover:border-slate-300/24 hover:bg-white/[0.07]",
    actionButton:
      "bg-[linear-gradient(135deg,#e2e8f0_0%,#94a3b8_58%,#cbd5e1_100%)] text-[#090c10] hover:brightness-110",
    accentText: "text-slate-200",
    modalField: "border-white/10 bg-white/[0.05]",
    modalFieldFocus:
      "focus:border-slate-300/40 focus:bg-white/[0.07] focus:ring-2 focus:ring-slate-300/10",
    modalMutedButton: "border-white/10 bg-white/[0.04]",
    modalMutedButtonHover:
      "hover:bg-white/[0.08] hover:border-slate-300/24",
    icon: Shield,
  };
}

function StatCard({
  className,
  label,
  value,
  sub,
  accentValue,
  theme,
}: {
  className?: string;
  label: string;
  value: React.ReactNode;
  sub: string;
  accentValue?: boolean;
  theme: TierTheme;
}) {
  return (
    <a
      href="#daftar-project"
      className={[
        "group flex flex-col gap-1.5 rounded-[16px] sm:rounded-[24px] border p-3 sm:p-4 backdrop-blur-md transition duration-300 hover:-translate-y-0.5",
        theme.shortcut,
        theme.shortcutHover,
        className ?? "",
      ].join(" ")}
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400 sm:text-[10px]">
        {label}
      </p>
      <p className={["text-2xl font-black tracking-tight sm:text-3xl", accentValue ? theme.accentText : "text-white"].join(" ")}>
        {value}
      </p>
      <p className="text-[10px] text-slate-500 sm:text-xs">{sub}</p>
    </a>
  );
}

export default function ProjectWalletCard({
  totalDana,
  totalDanaPending = 0,
  jumlahPropertyDidanai,
  pendingPaymentCount = 0,
  pendingProjectCount = 0,
  hasPendingPayment = false,
  realizedProfit = 0,
  jabatan,
  createdById,
  onCreateProject,
}: Props) {
  const isOwner = jabatan === "OWNER";
  const theme = getTierTheme(totalDana);
  const TierIcon = theme.icon;
  const [openAddModal, setOpenAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreateProject(values: CreateProjectFormValues) {
    try {
      setSubmitting(true);

      const payload = buildCreateProjectPayload(values);

      const response = await fetch("/api/project/modal/simpan_project", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as CreateProjectSubmitResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal menyimpan project.");
      }

      await onCreateProject?.(values);

      setOpenAddModal(false);
      toast.success("Project Berhasil Disimpan!");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat menyimpan project."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const pendingHelper =
    pendingProjectCount > 0
      ? `${pendingProjectCount} project masih menunggu pembayaran sebesar ${formatCurrency(
          totalDanaPending
        )}.`
      : `${pendingPaymentCount} komitmen masih menunggu pembayaran sebesar ${formatCurrency(
          totalDanaPending
        )}.`;

  return (
    <>
      <section
        className={`relative overflow-hidden rounded-[24px] border p-4 sm:rounded-[34px] sm:p-7 ${theme.shell} ${theme.edgeGlow}`}
      >
        <div className={`absolute inset-0 ${theme.overlay}`} />
        <div className="absolute inset-[1px] rounded-[33px] border border-white/[0.04]" />
        <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_100%)]" />

        <div
          className={`absolute -right-16 -top-10 h-44 w-44 rounded-full blur-3xl ${theme.orbA}`}
        />
        <div
          className={`absolute left-[8%] bottom-[-70px] h-40 w-40 rounded-full blur-3xl ${theme.orbB}`}
        />
        <div
          className={`absolute right-[28%] bottom-[-88px] h-36 w-36 rounded-full blur-3xl ${theme.orbC}`}
        />

        <div className="relative space-y-4 sm:space-y-6">
          {/* ── Main header row ── */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/50 sm:text-[11px] sm:tracking-[0.24em]">
                Dana saya yang telah diinvestasikan
              </p>

              <h1 className="mt-2 text-[26px] font-black tracking-tight text-white sm:mt-3 sm:text-5xl">
                {formatCurrency(totalDana)}
              </h1>

              <div
                className={`mt-2.5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur-md sm:mt-4 sm:gap-3 sm:px-4 sm:py-2 sm:text-sm ${theme.badge}`}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/15 sm:h-7 sm:w-7">
                  <TierIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                </span>
                <span>{theme.nama}</span>
              </div>

              {/* Description — hidden on mobile */}
              <p className="mt-4 hidden max-w-2xl text-sm leading-7 text-slate-300 sm:block">
                {theme.deskripsi}
              </p>
            </div>

            {isOwner && (
              <button
                type="button"
                onClick={() => setOpenAddModal(true)}
                className={`mt-0.5 inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-bold shadow-[0_16px_40px_rgba(0,0,0,0.22)] transition active:scale-[0.99] sm:mt-0 sm:h-12 sm:rounded-2xl sm:px-5 sm:text-sm ${theme.actionButton}`}
              >
                <span className="sm:hidden">+</span>
                <span className="hidden sm:inline">Tambah Project</span>
                <span className="sm:hidden text-[11px] font-semibold">Project</span>
              </button>
            )}
          </div>

          {/* ── Stats: property (1/3) + profit (2/3) ── */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <StatCard
              theme={theme}
              accentValue
              label="Property"
              value={jumlahPropertyDidanai ?? 0}
              sub="didanai"
            />
            <StatCard
              className="col-span-2"
              theme={theme}
              label="Profit Terealisasi"
              value={formatCurrency(realizedProfit)}
              sub="total profit"
              accentValue={realizedProfit > 0}
            />
          </div>
        </div>
      </section>

      {openAddModal ? (
        <AddProjectModal
          open={openAddModal}
          onClose={() => setOpenAddModal(false)}
          onSubmit={handleCreateProject}
          loading={submitting}
          theme={theme}
          createdById={createdById}
        />
      ) : null}
    </>
  );
}
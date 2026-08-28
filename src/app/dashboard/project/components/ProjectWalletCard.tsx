"use client";

import { useState } from "react";

import { toast } from "sonner";
import AddProjectModal, {
  type CreateProjectFormValues,
} from "./modal/AddProjectModal";
import type { CreateProjectSubmitResponse } from "./modal/types";
import { buildCreateProjectPayload } from "./modal/utils";
import { getTierTheme, type TierTheme } from "./modal/tierTheme";

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
  totalDanaLunas,
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
  // "Telah diinvestasikan" = uang yang BENAR-BENAR sudah disetor. Komitmen yang
  // belum dibayar bukan investasi, jadi tidak boleh masuk angka utama maupun
  // menentukan tier. `totalDanaLunas` undefined = data lama → jatuh ke komitmen.
  const danaDisetor = totalDanaLunas ?? totalDana;
  const theme = getTierTheme(danaDisetor);
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
                {formatCurrency(danaDisetor)}
              </h1>

              {totalDanaPending > 0 ? (
                <p className="mt-1.5 text-[11px] font-medium text-amber-200/80 sm:text-xs">
                  + {formatCurrency(totalDanaPending)} sudah dikomitmenkan,
                  menunggu pembayaran
                </p>
              ) : null}

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
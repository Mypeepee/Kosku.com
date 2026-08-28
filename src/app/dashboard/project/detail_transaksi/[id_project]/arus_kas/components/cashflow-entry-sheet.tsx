"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, X } from "lucide-react";
import type { FundState } from "@/lib/project-kas";
import type {
  DbCashflow,
  InvestorSummary,
  WalletKey,
  WalletSummary,
} from "../types";
import CashflowQuickForm from "./cashflow-quick-form";

type CashflowEntrySheetProps = {
  open: boolean;
  onClose: () => void;
  idProject: string;
  fund: FundState;
  wallets: WalletSummary[];
  investors: InvestorSummary[];
  defaultWallet?: WalletKey;
  editingTransaction?: DbCashflow | null;
  onSubmitted?: () => void;
  onCancelEdit?: () => void;
};

export default function CashflowEntrySheet({
  open,
  onClose,
  idProject,
  fund,
  wallets,
  investors,
  defaultWallet,
  editingTransaction = null,
  onSubmitted,
}: CashflowEntrySheetProps) {
  const formId = useId();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = Boolean(editingTransaction?.id_project_arus_kas);

  const title = useMemo(() => {
    return isEditing ? "Edit transaksi" : "Catat transaksi";
  }, [isEditing]);

  const subtitle = useMemo(() => {
    if (isEditing) {
      return editingTransaction?.judul_transaksi?.trim()
        ? `Perbarui data transaksi "${editingTransaction.judul_transaksi}".`
        : "Perbarui data transaksi yang sudah tercatat.";
    }

    return "Catat uang keluar atau masuk pada dompet proyek.";
  }, [isEditing, editingTransaction]);

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, isSubmitting]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        aria-label="Tutup form"
        onClick={() => {
          if (isSubmitting) return;
          onClose();
        }}
        className="absolute inset-0 bg-slate-950/72 backdrop-blur-md"
      />

      <div className="absolute inset-0 flex items-end justify-center p-0 sm:p-4 md:items-center md:p-6">
        <section
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="relative flex h-[94dvh] w-full flex-col overflow-hidden rounded-t-[30px] border border-white/10 bg-[#07111c]/96 shadow-[0_30px_120px_rgba(2,8,23,0.7)] backdrop-blur-2xl sm:h-[90dvh] sm:max-w-[760px] sm:rounded-[32px] xl:max-w-[880px]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_18%)]" />

          <div className="relative border-b border-white/8 px-5 pb-4 pt-3 sm:px-6 sm:pb-5 sm:pt-4">
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/12 sm:hidden" />

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-white">{title}</h3>

                  <span
                    className={[
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em]",
                      isEditing
                        ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-100"
                        : "border-emerald-300/20 bg-emerald-400/10 text-emerald-100",
                    ].join(" ")}
                  >
                    {isEditing ? (
                      <>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        Baru
                      </>
                    )}
                  </span>
                </div>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  {subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (isSubmitting) return;
                  onClose();
                }}
                disabled={isSubmitting}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Tutup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6">
            <CashflowQuickForm
              formId={formId}
              idProject={idProject}
              fund={fund}
              wallets={wallets}
              investors={investors}
              defaultWallet={defaultWallet}
              editingTransaction={editingTransaction}
              onSubmitted={onSubmitted ?? onClose}
              onPendingChange={setIsSubmitting}
              submitUrl="/api/project/catat_arus_kas"
            />
          </div>

          <div className="relative border-t border-white/8 bg-[#07111c]/98 px-5 py-4 backdrop-blur-xl sm:px-6">
            <button
              type="submit"
              form={formId}
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/12 px-5 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/16 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isEditing ? "Memperbarui..." : "Menyimpan..."}
                </>
              ) : isEditing ? (
                "Update transaksi"
              ) : (
                "Simpan transaksi"
              )}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
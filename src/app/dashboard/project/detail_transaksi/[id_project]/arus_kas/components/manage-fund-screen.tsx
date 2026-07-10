"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Plus,
} from "lucide-react";
import type { DbCashflow, ManageFundData, WalletKey } from "../types";
import WalletGrid from "./wallet-grid";
import CashflowTable from "./cashflow-table";
import CashflowEntrySheet from "./cashflow-entry-sheet";
import WalletDropdown from "./wallet-dropdown";

// ─── helpers ────────────────────────────────────────────────────────────────

function getRowTimestamp(row: unknown) {
  if (!row || typeof row !== "object") return 0;

  const record = row as Record<string, unknown>;
  const candidates = [
    record.tanggal_transaksi,
    record.transaction_date,
    record.tanggal,
    record.created_at,
    record.createdAt,
    record.dibuat_tanggal,
  ];

  for (const value of candidates) {
    if (value instanceof Date) {
      const time = value.getTime();
      if (Number.isFinite(time)) return time;
    }

    if (typeof value === "string" && value.trim()) {
      const time = new Date(value).getTime();
      if (Number.isFinite(time)) return time;
    }
  }

  return 0;
}


export default function ManageFundScreen({
  data,
  isCreator = false,
}: {
  data: ManageFundData;
  isCreator?: boolean;
}) {
  const router = useRouter();
  const [selectedWallet, setSelectedWallet] = useState<WalletKey | "all">("all");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<DbCashflow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const idProject = data.project.id_project;

  const latestRows = useMemo(() => {
    const source = Array.isArray(data.transactions) ? data.transactions : [];

    return [...source]
      .filter((row) => {
        return selectedWallet === "all"
          ? true
          : row.wallet_key === selectedWallet;
      })
      .sort((a, b) => getRowTimestamp(b) - getRowTimestamp(a));
  }, [data.transactions, selectedWallet]);

  const defaultWallet =
    editingTransaction?.wallet_key
      ? (editingTransaction.wallet_key as WalletKey)
      : selectedWallet === "all"
        ? data.wallets?.[0]?.walletKey
        : selectedWallet;

  function handleOpenCreate() {
    setEditingTransaction(null);
    setIsComposerOpen(true);
  }

  function handleEditTransaction(row: DbCashflow) {
    setEditingTransaction(row);
    setIsComposerOpen(true);
  }

  async function handleDeleteTransaction(row: DbCashflow) {
    const transactionId = String(row.id_project_arus_kas ?? "");

    if (!transactionId) {
      window.alert("ID transaksi tidak ditemukan.");
      return;
    }

    const confirmed = window.confirm(
      `Hapus transaksi "${row.judul_transaksi || "Tanpa judul"}"?`
    );

    if (!confirmed) return;

    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/project/catat_arus_kas/${transactionId}`,
        {
          method: "DELETE",
        }
      );

      let responseJson: { message?: string } | null = null;

      try {
        responseJson = await response.json();
      } catch {
        responseJson = null;
      }

      if (!response.ok) {
        throw new Error(
          responseJson?.message || "Gagal menghapus transaksi."
        );
      }

      if (
        editingTransaction &&
        String(editingTransaction.id_project_arus_kas) === transactionId
      ) {
        setEditingTransaction(null);
        setIsComposerOpen(false);
      }

      window.location.reload();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat menghapus transaksi."
      );
    } finally {
      setIsDeleting(false);
    }
  }

  function handleCloseComposer() {
    setIsComposerOpen(false);
    setEditingTransaction(null);
  }

  function handleSubmitted() {
    setIsComposerOpen(false);
    setEditingTransaction(null);
    window.location.reload();
  }

  function handleExport() {
    setIsExporting(true);
    const link = document.createElement("a");
    link.href = `/api/project/${idProject}/export-arus-kas`;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setIsExporting(false), 2000);
  }

  return (
    <>
      <div className="space-y-8">
        <WalletGrid
          wallets={data.wallets}
          selectedWallet={selectedWallet}
          onSelectWallet={setSelectedWallet}
          onBack={() => router.back()}
          danaMasuk={data.danaMasuk}
          danaKeluar={data.danaKeluar}
          sisaKas={data.sisaKas}
        />

        <section className="space-y-5 rounded-[30px] border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-white/38">
                History of transaction
              </div>

              <h2 className="mt-3 text-[clamp(1.4rem,2vw,1.9rem)] font-semibold text-white">
                Riwayat transaksi
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                {isCreator
                  ? "Riwayat transaksi terbaru dari dompet yang sedang dipilih."
                  : "Seluruh transaksi proyek yang sudah dicatat oleh pengelola."}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 flex-wrap xl:flex-nowrap xl:justify-end">
              <WalletDropdown value={selectedWallet} onChange={setSelectedWallet} />

              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-400 whitespace-nowrap">
                {latestRows.length} transaksi
              </div>

              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-400/16 disabled:opacity-50 whitespace-nowrap"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                {isExporting ? "Mengekspor..." : "Export Excel"}
              </button>

              {isCreator && (
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-400/16 whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  Catat transaksi
                </button>
              )}

            </div>
          </div>

          <CashflowTable
            rows={latestRows}
            onCreateTransaction={isCreator ? handleOpenCreate : undefined}
            onEditTransaction={isCreator ? handleEditTransaction : undefined}
            onDeleteTransaction={isCreator ? handleDeleteTransaction : undefined}
          />

          {isDeleting ? (
            <div className="rounded-[18px] border border-rose-300/15 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              Sedang menghapus transaksi...
            </div>
          ) : null}
        </section>
      </div>

      {/* FAB hanya untuk creator */}
      {isCreator && (
        <button
          type="button"
          onClick={handleOpenCreate}
          className="fixed bottom-6 right-6 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-400/15 text-cyan-100 shadow-[0_20px_50px_rgba(34,211,238,0.18)] backdrop-blur-xl transition hover:bg-cyan-400/20 lg:hidden"
          aria-label="Catat transaksi"
        >
          <Plus className="h-5 w-5" />
        </button>
      )}

      {isCreator && (
        <CashflowEntrySheet
          open={isComposerOpen}
          onClose={handleCloseComposer}
          idProject={data.project.id_project}
          wallets={data.wallets}
          sisaKas={data.sisaKas}
          defaultWallet={defaultWallet}
          editingTransaction={editingTransaction}
          onSubmitted={handleSubmitted}
        />
      )}

    </>
  );
}

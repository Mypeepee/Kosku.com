"use client";

import { useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  CircleDollarSign,
  FileCheck2,
  FileText,
  Hammer,
  Lock,
  Pencil,
  PiggyBank,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  Wallet2,
} from "lucide-react";
import { WALLET_LABELS } from "@/lib/project-kas";
import { formatCurrency } from "../lib/format-currency";
import type { DbCashflow } from "../types";
import { walletTheme } from "./wallet-theme";
import { kategoriLabel } from "./cashflow-categories";

const SWIPE_ACTION_WIDTH = 108;
const SWIPE_OPEN_THRESHOLD = 46;

const AMOUNT_TONE: Record<string, string> = {
  utama: "text-emerald-100",
  dokumen: "text-cyan-100",
  eksekusi: "text-amber-100",
  renovasi: "text-violet-100",
  cadangan: "text-rose-100",
};

function formatDate(value?: string | Date | null) {
  if (!value) return "-";

  const normalized =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T00:00:00Z`
      : value;

  const date = normalized instanceof Date ? normalized : new Date(normalized);
  if (Number.isNaN(date.getTime())) return "-";

  // tanggal_transaksi disimpan sebagai tanggal murni (UTC midnight, @db.Date).
  // Tampilkan dalam timezone Indonesia (WIB) agar konsisten untuk semua user.
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function formatLabel(value?: string | null) {
  if (!value) return "Tanpa label";

  return value
    .replaceAll("_", " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStatusTone(status?: string | null) {
  switch (status) {
    case "berhasil":
    case "success":
    case "selesai":
      return "border-emerald-300/20 bg-emerald-400/10 text-emerald-100";
    case "pending":
    case "menunggu":
      return "border-amber-300/20 bg-amber-400/10 text-amber-100";
    case "gagal":
    case "dibatalkan":
    case "failed":
      return "border-rose-300/20 bg-rose-400/10 text-rose-100";
    case "tercatat":
      return "border-white/10 bg-white/[0.06] text-white/75";
    default:
      return "border-white/10 bg-white/[0.05] text-white/70";
  }
}

function isExpense(kind?: string | null) {
  return kind === "keluar" || kind === "pengeluaran";
}

function getEmptyCopy() {
  return {
    title: "Belum ada transaksi",
    description:
      "Belum ada riwayat transaksi pada dompet atau filter yang sedang dipilih. Tambahkan transaksi pertama untuk mulai mencatat arus kas.",
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type CashflowTableProps = {
  rows: DbCashflow[];
  onCreateTransaction?: () => void;
  onEditTransaction?: (row: DbCashflow) => void;
  onDeleteTransaction?: (row: DbCashflow) => void;
};

type SwipeRowProps = {
  item: DbCashflow;
  onEditTransaction?: (row: DbCashflow) => void;
  onDeleteTransaction?: (row: DbCashflow) => void;
};

function SwipeableCashflowCard({
  item,
  onEditTransaction,
  onDeleteTransaction,
}: SwipeRowProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const dragStartXRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const movedRef = useRef(false);

  // Baris talangan/setoran dibuat otomatis sistem: mengeditnya akan membuat
  // modal disetor & porsi kepemilikan investor tidak sinkron.
  const locked = Boolean(item.dikunci);
  const canEdit = Boolean(onEditTransaction) && !locked;
  const canDelete = Boolean(onDeleteTransaction) && !locked;

  const minOffset = canDelete ? -SWIPE_ACTION_WIDTH : 0;
  const maxOffset = canEdit ? SWIPE_ACTION_WIDTH : 0;

  const theme = walletTheme(item.wallet_key);
  const Icon = theme.icon;
  const expense = isExpense(item.jenis_transaksi);
  const amountTone = AMOUNT_TONE[item.wallet_key] ?? AMOUNT_TONE.utama;

  function closeActions() {
    setOffsetX(0);
  }

  function snapToClosest(nextOffset: number) {
    if (nextOffset <= -SWIPE_OPEN_THRESHOLD && canDelete) {
      setOffsetX(-SWIPE_ACTION_WIDTH);
      return;
    }

    if (nextOffset >= SWIPE_OPEN_THRESHOLD && canEdit) {
      setOffsetX(SWIPE_ACTION_WIDTH);
      return;
    }

    setOffsetX(0);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    pointerIdRef.current = event.pointerId;
    dragStartXRef.current = event.clientX;
    dragStartOffsetRef.current = offsetX;
    movedRef.current = false;
    setIsDragging(true);

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== event.pointerId) return;

    const deltaX = event.clientX - dragStartXRef.current;
    if (Math.abs(deltaX) > 6) movedRef.current = true;

    const nextOffset = clamp(
      dragStartOffsetRef.current + deltaX,
      minOffset,
      maxOffset
    );

    setOffsetX(nextOffset);
  }

  function finishGesture(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== event.pointerId) return;

    pointerIdRef.current = null;
    setIsDragging(false);
    snapToClosest(offsetX);

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {}
  }

  return (
    <div className="relative overflow-hidden rounded-[28px]">
      {canEdit ? (
        <div className="absolute inset-y-0 left-0 flex w-[108px] items-center justify-start pl-2">
          <button
            type="button"
            onClick={() => {
              closeActions();
              onEditTransaction?.(item);
            }}
            className="flex h-[calc(100%-12px)] w-[96px] items-center justify-center gap-2 rounded-[24px] border border-cyan-300/20 bg-cyan-400/12 text-cyan-100 transition hover:bg-cyan-400/18"
          >
            <Pencil className="h-4 w-4" />
            <span className="text-sm font-medium">Edit</span>
          </button>
        </div>
      ) : null}

      {canDelete ? (
        <div className="absolute inset-y-0 right-0 flex w-[108px] items-center justify-end pr-2">
          <button
            type="button"
            onClick={() => {
              closeActions();
              onDeleteTransaction?.(item);
            }}
            className="flex h-[calc(100%-12px)] w-[96px] items-center justify-center gap-2 rounded-[24px] border border-rose-300/20 bg-rose-400/12 text-rose-100 transition hover:bg-rose-400/18"
          >
            <Trash2 className="h-4 w-4" />
            <span className="text-sm font-medium">Hapus</span>
          </button>
        </div>
      ) : null}

      <div
        className={[
          "will-change-transform",
          isDragging ? "" : "transition-transform duration-200 ease-out",
        ].join(" ")}
        style={{
          transform: `translateX(${offsetX}px)`,
          touchAction: "pan-y",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishGesture}
        onPointerCancel={finishGesture}
        onClick={() => {
          if (movedRef.current) return;
          if (offsetX !== 0) closeActions();
        }}
      >
        <article
          className={[
            "group relative overflow-hidden rounded-[28px] border px-5 py-4 transition-all duration-200 sm:px-6 sm:py-5",
            "hover:-translate-y-[1px] hover:border-white/20",
            theme.shell,
            theme.glow,
            theme.border,
          ].join(" ")}
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_28%,transparent_74%,rgba(255,255,255,0.02))]" />
          <div className="pointer-events-none absolute -right-10 top-0 h-32 w-32 rounded-full bg-white/6 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/10" />

          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-3">
                <div
                  className={[
                    "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border backdrop-blur-md",
                    theme.iconWrap,
                  ].join(" ")}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-[15px] font-semibold text-white sm:text-[17px]">
                      {item.judul_transaksi || "Transaksi"}
                    </h3>

                    <span
                      className={[
                        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em]",
                        theme.badgeClass,
                      ].join(" ")}
                    >
                      <Icon className="mr-1.5 h-3.5 w-3.5" />
                      {WALLET_LABELS[item.wallet_key] ?? "Dompet Utama"}
                    </span>

                    {locked ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/25 bg-amber-400/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-amber-200">
                        <Lock className="h-3 w-3" />
                        {item.kategori_transaksi === "talangan_investor"
                          ? "Talangan"
                          : "Setoran"}
                      </span>
                    ) : null}
                  </div>

                  {item.catatan ? (
                    <div className="mt-2 flex items-start gap-2 text-sm leading-6 text-slate-300/90">
                      <FileText className="mt-1 h-4 w-4 shrink-0 text-white/30" />
                      <p className="line-clamp-2">{item.catatan}</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-white/45">
                      {kategoriLabel(item.kategori_transaksi)}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/42">
                    <div className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      <span>{formatDate(item.tanggal_transaksi)}</span>
                    </div>

                    <div className="inline-flex items-center gap-1.5">
                      <CircleDollarSign className="h-3.5 w-3.5" />
                      <span>{kategoriLabel(item.kategori_transaksi)}</span>
                    </div>

                    {item.investor_nama ? (
                      <div className="inline-flex items-center gap-1.5 text-amber-200/80">
                        <UserRound className="h-3.5 w-3.5" />
                        <span>oleh {item.investor_nama}</span>
                      </div>
                    ) : null}
                  </div>

                  {locked ? (
                    <div className="mt-3 text-[11px] leading-5 text-amber-200/60">
                      Dicatat otomatis sistem — ikut terhapus kalau transaksi
                      yang ditalangi dihapus.
                    </div>
                  ) : canEdit || canDelete ? (
                    <div className="mt-3 text-[11px] text-white/30 sm:hidden">
                      Geser kanan untuk edit • geser kiri untuk hapus
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex items-end justify-between gap-4 border-t border-white/8 pt-4 lg:min-w-[240px] lg:block lg:border-t-0 lg:pt-0 lg:text-right">
              <div className="space-y-1">
                <div
                  className={[
                    "text-[11px] uppercase tracking-[0.22em]",
                    expense ? "text-rose-200/80" : "text-white/38",
                  ].join(" ")}
                >
                  {expense ? "Pengeluaran" : "Pemasukan"}
                </div>

                <div
                  className={[
                    "text-lg font-semibold sm:text-[28px] sm:leading-none",
                    expense ? "text-rose-100" : amountTone,
                  ].join(" ")}
                >
                  {expense ? "-" : "+"}
                  {formatCurrency(Number(item.nominal ?? 0))}
                </div>
              </div>

              <div className="mt-0 lg:mt-3">
                <span
                  className={[
                    "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em]",
                    getStatusTone(item.status_transaksi),
                  ].join(" ")}
                >
                  {formatLabel(item.status_transaksi)}
                </span>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

export default function CashflowTable({
  rows,
  onCreateTransaction,
  onEditTransaction,
  onDeleteTransaction,
}: CashflowTableProps) {
  if (!rows?.length) {
    const emptyCopy = getEmptyCopy();

    return (
      <div className="rounded-[30px] border border-dashed border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] px-6 py-14 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.04] text-white/50">
          <CircleDollarSign className="h-7 w-7" />
        </div>

        <h3 className="mt-5 text-xl font-semibold text-white">
          {emptyCopy.title}
        </h3>

        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
          {emptyCopy.description}
        </p>

        {onCreateTransaction ? (
          <button
            type="button"
            onClick={onCreateTransaction}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/12 px-4 py-2.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/16"
          >
            <Plus className="h-4 w-4" />
            Catat transaksi pertama
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {(onEditTransaction || onDeleteTransaction) && (
        <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-400">
          Geser{" "}
          {onEditTransaction ? (
            <span className="text-cyan-200">kanan untuk edit</span>
          ) : null}
          {onEditTransaction && onDeleteTransaction ? " • " : null}
          {onDeleteTransaction ? (
            <span className="text-rose-200">kiri untuk hapus</span>
          ) : null}
        </div>
      )}

      {rows.map((item) => (
        <SwipeableCashflowCard
          key={String(item.id_project_arus_kas)}
          item={item}
          onEditTransaction={onEditTransaction}
          onDeleteTransaction={onDeleteTransaction}
        />
      ))}
    </div>
  );
}
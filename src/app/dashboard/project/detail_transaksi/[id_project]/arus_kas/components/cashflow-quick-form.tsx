"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  Users,
  X,
} from "lucide-react";
import type {
  DbCashflow,
  ProjectInvestorOption,
  ProjectInvestorResponse,
  WalletKey,
  WalletSummary,
} from "../types";

type FormErrors = Partial<
  Record<
    "wallet" | "nominal" | "judul" | "tanggal" | "investor_penanggung",
    string
  >
>;

type CashflowQuickFormProps = {
  idProject: string;
  wallets: WalletSummary[];
  /** Kas riil proyek (Σ modal disetor + pemasukan non-modal − pengeluaran). */
  sisaKas: number;
  defaultWallet?: WalletKey;
  editingTransaction?: DbCashflow | null;
  onSubmitted?: () => void;
  onPendingChange?: (pending: boolean) => void;
  submitUrl?: string;
  formId?: string;
};

const MONTH_LABELS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const WEEKDAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(
    now.getDate()
  )}`;
}

function safeNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function parseIsoDate(value?: string | null) {
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`;
}

function normalizeDateValue(value?: string | Date | null) {
  if (!value) return todayIso();

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return todayIso();

  // tanggal_transaksi dari DB adalah UTC midnight (@db.Date). Baca komponen
  // tanggalnya dalam UTC supaya picker menampilkan hari yang benar.
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate()
  )}`;
}

function normalizeJenisValue(value?: string | null) {
  if (value === "masuk") return "pemasukan";
  if (value === "keluar") return "pengeluaran";
  if (value === "pemasukan") return "pemasukan";
  return "pengeluaran";
}

function isExpenseTransaction(value?: string | null) {
  return normalizeJenisValue(value) === "pengeluaran";
}

function formatDateDisplay(value?: string | null) {
  const date = parseIsoDate(value);
  if (!date) return "Pilih tanggal";

  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatDatePretty(value?: string | null) {
  const date = parseIsoDate(value);
  if (!date) return "-";

  return `${date.getDate()} ${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
}

function isSameDate(a: Date | null, b: Date | null) {
  if (!a || !b) return false;

  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatDigitsId(value: string) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  return new Intl.NumberFormat("id-ID").format(numeric);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function normalizeImageUrl(value?: string | null) {
  if (!value) return null;
  return value.trim() || null;
}

function getWalletHint(walletKey?: string) {
  switch (walletKey) {
    case "utama":
      return "Biaya inti proyek";
    case "dokumen":
      return "Legal & administrasi";
    case "eksekusi":
      return "Operasional lapangan";
    case "renovasi":
      return "Perbaikan & finishing";
    case "cadangan":
      return "Buffer pengeluaran";
    default:
      return "Dompet proyek";
  }
}

function getWalletTone(walletKey?: string) {
  switch (walletKey) {
    case "utama":
      return "border-emerald-300/20 bg-emerald-400/10 text-emerald-200";
    case "dokumen":
      return "border-cyan-300/20 bg-cyan-400/10 text-cyan-200";
    case "eksekusi":
      return "border-amber-300/20 bg-amber-400/10 text-amber-200";
    case "renovasi":
      return "border-violet-300/20 bg-violet-400/10 text-violet-200";
    case "cadangan":
      return "border-rose-300/20 bg-rose-400/10 text-rose-200";
    default:
      return "border-white/10 bg-white/[0.05] text-white/70";
  }
}

function getMonthMatrix(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const startWeekDay = (firstDayOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startWeekDay);

  return Array.from({ length: 42 }).map((_, index) => {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index
    );

    return {
      date,
      inCurrentMonth: date.getMonth() === month,
    };
  });
}

function buildErrors(params: {
  wallet?: WalletKey;
  nominal: number;
  judul: string;
  tanggal: string;
  needCoverInvestor: boolean;
  coverInvestorId?: string | null;
}) {
  const errors: FormErrors = {};

  if (!params.wallet) {
    errors.wallet = "Pilih dompet terlebih dahulu.";
  }

  if (!Number.isFinite(params.nominal) || params.nominal <= 0) {
    errors.nominal = "Masukkan nominal yang valid.";
  }

  if (!params.judul.trim()) {
    errors.judul = "Judul transaksi wajib diisi.";
  }

  if (!params.tanggal) {
    errors.tanggal = "Tanggal transaksi wajib diisi.";
  }

  if (params.needCoverInvestor && !params.coverInvestorId) {
    errors.investor_penanggung =
      "Pilih investor penanggung untuk menutup kekurangan dana.";
  }

  return errors;
}

function CalendarPickerModal({
  open,
  value,
  disabled,
  onClose,
  onChange,
}: {
  open: boolean;
  value: string;
  disabled?: boolean;
  onClose: () => void;
  onChange: (value: string) => void;
}) {
  const selectedDate = useMemo(() => parseIsoDate(value), [value]);
  const today = useMemo(() => parseIsoDate(todayIso()) ?? new Date(), []);

  const [viewDate, setViewDate] = useState<Date>(() => {
    const baseDate = selectedDate ?? today;
    return new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  });

  useEffect(() => {
    if (!open) return;

    const baseDate = selectedDate ?? today;
    setViewDate(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
  }, [open, selectedDate, today]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const cells = getMonthMatrix(viewDate);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#020817]/80 px-4 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative z-[1] w-full max-w-md overflow-hidden rounded-[30px] border border-cyan-400/15 bg-[radial-gradient(circle_at_top,rgba(8,145,178,0.12),transparent_42%),linear-gradient(180deg,rgba(10,18,30,0.98),rgba(3,8,18,0.98))] shadow-[0_30px_80px_rgba(0,0,0,0.65)]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-white/38">
              Pilih tanggal
            </div>
            <div className="mt-1 text-sm text-white/78">
              {formatDatePretty(value)}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.07] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setViewDate(
                  (prev) =>
                    new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                )
              }
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/80 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.08]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="text-center">
              <div className="text-base font-semibold text-white">
                {MONTH_LABELS[viewDate.getMonth()]}
              </div>
              <div className="text-sm text-slate-400">
                {viewDate.getFullYear()}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setViewDate(
                  (prev) =>
                    new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                )
              }
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/80 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.08]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="pb-1 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-white/32"
              >
                {label}
              </div>
            ))}

            {cells.map(({ date, inCurrentMonth }) => {
              const isSelected = isSameDate(date, selectedDate);
              const isToday = isSameDate(date, today);

              return (
                <button
                  key={toIsoDate(date)}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onChange(toIsoDate(date));
                    onClose();
                  }}
                  className={[
                    "relative aspect-square rounded-2xl border text-sm font-medium transition",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    isSelected
                      ? "border-cyan-300/45 bg-cyan-400/[0.16] text-white shadow-[0_0_0_1px_rgba(34,211,238,0.12)_inset]"
                      : isToday
                        ? "border-violet-300/25 bg-violet-400/[0.10] text-white/92"
                        : inCurrentMonth
                          ? "border-white/8 bg-white/[0.03] text-white/80 hover:border-cyan-300/20 hover:bg-cyan-400/[0.06]"
                          : "border-transparent bg-transparent text-white/22 hover:border-white/8 hover:bg-white/[0.02]",
                  ].join(" ")}
                >
                  {date.getDate()}
                  {isToday && !isSelected ? (
                    <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-violet-300" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                onChange(todayIso());
                onClose();
              }}
              className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/78 transition hover:bg-white/[0.07] hover:text-white"
            >
              Hari ini
            </button>

            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/30">
                Tanggal terpilih
              </div>
              <div className="mt-1 text-sm font-medium text-white/88">
                {formatDatePretty(value)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InvestorAvatar({
  name,
  src,
}: {
  name: string;
  src?: string | null;
}) {
  const normalized = normalizeImageUrl(src);

  if (normalized) {
    return (
      <img
        src={normalized}
        alt={name}
        className="h-11 w-11 rounded-[16px] object-cover ring-1 ring-white/10"
      />
    );
  }

  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.05] text-sm font-bold text-white">
      {(name || "?").slice(0, 1).toUpperCase()}
    </div>
  );
}

function ProjectInvestorCombobox({
  idProject,
  value,
  selected,
  onSelect,
  disabled,
  helperText,
}: {
  idProject: string;
  value?: string | null;
  selected?: ProjectInvestorOption | null;
  onSelect: (option: ProjectInvestorOption) => void;
  disabled?: boolean;
  helperText?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ProjectInvestorOption[]>([]);

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    if (!open || !idProject) return;

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      setLoading(true);

      try {
        const params = new URLSearchParams({
          id_project: idProject,
          q: query,
        });

        const response = await fetch(
          `/api/project/investor_options?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error("Gagal mengambil investor project.");
        }

        const payload: ProjectInvestorResponse = await response.json();
        setOptions(Array.isArray(payload.investors) ? payload.investors : []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setOptions([]);
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query, idProject]);

  const displayLabel =
    selected?.nama?.trim() ||
    selected?.id_agent?.trim() ||
    String(value || "").trim();

  return (
    <div ref={rootRef} className="relative z-[90]">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={`flex h-16 w-full items-center justify-between rounded-[22px] border border-white/10 bg-white/[0.04] px-3 text-left transition hover:border-white/15 hover:bg-white/[0.055] ${
          open ? "border-white/20 bg-white/[0.06]" : ""
        } disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <div className="flex min-w-0 items-center gap-3">
          {displayLabel ? (
            <>
              <InvestorAvatar
                name={displayLabel}
                src={selected?.foto_profil_url}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {displayLabel}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {selected?.nama_kantor || selected?.id_agent || "Investor project"}
                  {selected?.kota_area ? ` • ${selected.kota_area}` : ""}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-dashed border-white/10 bg-white/[0.03] text-slate-400">
                <Users className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  Pilih investor penanggung
                </p>
                <p className="text-xs text-slate-500">
                  {helperText || "Investor project yang tersedia"}
                </p>
              </div>
            </>
          )}
        </div>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-[100] mt-2 rounded-[24px] border border-white/10 bg-[#09111d]/95 p-3 shadow-[0_32px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <div className="flex items-center gap-2 rounded-[18px] border border-white/10 bg-white/[0.04] px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari investor project..."
              className="h-12 w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <div className="flex h-24 items-center justify-center rounded-[18px] border border-white/8 bg-white/[0.02] text-slate-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memuat investor...
              </div>
            ) : options.length ? (
              options.map((option) => {
                const optionName = option.nama || option.id_agent;

                return (
                  <button
                    key={`${option.id_project_investor}-${option.id_agent}`}
                    type="button"
                    onClick={() => {
                      onSelect(option);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full items-start gap-3 rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-3 text-left transition hover:border-white/15 hover:bg-white/[0.05]"
                  >
                    <InvestorAvatar
                      name={optionName}
                      src={option.foto_profil_url}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-white">
                          {optionName}
                        </p>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-400">
                          {option.id_agent}
                        </span>
                      </div>

                      <p className="mt-1 truncate text-xs text-slate-400">
                        {option.nama_kantor || "Tanpa kantor"}
                        {option.kota_area ? ` • ${option.kota_area}` : ""}
                      </p>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-[18px] border border-white/8 bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-400">
                Investor project tidak ditemukan.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function CashflowQuickForm({
  idProject,
  wallets,
  sisaKas,
  defaultWallet,
  editingTransaction,
  onSubmitted,
  onPendingChange,
  submitUrl,
  formId = "cashflow-entry-form",
}: CashflowQuickFormProps) {
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const [walletKey, setWalletKey] = useState<WalletKey>(
    defaultWallet ?? wallets?.[0]?.walletKey ?? "utama"
  );
  const [nominalInput, setNominalInput] = useState("");
  const [judulTransaksi, setJudulTransaksi] = useState("");
  const [tanggalTransaksi, setTanggalTransaksi] = useState(todayIso());
  const [catatan, setCatatan] = useState("");

  const [investorSourceLabel, setInvestorSourceLabel] = useState(
    "Investor project yang tersedia"
  );
  const [selectedCoverInvestor, setSelectedCoverInvestor] =
    useState<ProjectInvestorOption | null>(null);

  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const editingId = String(editingTransaction?.id_project_arus_kas ?? "").trim();
  const isEditing = Boolean(editingId);

  const jenisTransaksi = normalizeJenisValue(editingTransaction?.jenis_transaksi);
  const isExpense = isExpenseTransaction(jenisTransaksi);

  useEffect(() => {
    onPendingChange?.(isSubmitting);
  }, [isSubmitting, onPendingChange]);

  useEffect(() => {
    let ignore = false;

    async function fetchInvestorSourceInfo() {
      try {
        const params = new URLSearchParams({
          id_project: idProject,
        });

        const response = await fetch(
          `/api/project/investor_options?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error("Gagal memuat investor project.");
        }

        const payload: ProjectInvestorResponse = await response.json();

        if (ignore) return;

        setInvestorSourceLabel(
          payload.source_label?.trim() || "Investor project yang tersedia"
        );
      } catch {
        if (ignore) return;
        setInvestorSourceLabel("Investor project yang tersedia");
      }
    }

    if (idProject) {
      fetchInvestorSourceInfo();
    }

    return () => {
      ignore = true;
    };
  }, [idProject]);

  useEffect(() => {
    if (editingTransaction) {
      setWalletKey(
        (editingTransaction.wallet_key as WalletKey) ??
          defaultWallet ??
          wallets?.[0]?.walletKey ??
          "utama"
      );
      setNominalInput(
        onlyDigits(String(Number(editingTransaction.nominal ?? 0)))
      );
      setJudulTransaksi(editingTransaction.judul_transaksi ?? "");
      setTanggalTransaksi(
        normalizeDateValue(editingTransaction.tanggal_transaksi)
      );
      setCatatan(editingTransaction.catatan ?? "");
    } else {
      setWalletKey(defaultWallet ?? wallets?.[0]?.walletKey ?? "utama");
      setNominalInput("");
      setJudulTransaksi("");
      setTanggalTransaksi(todayIso());
      setCatatan("");
    }

    setErrors({});
    setServerError("");
    setSuccessMessage("");
    setSelectedCoverInvestor(null);
  }, [editingTransaction, defaultWallet, wallets]);

  const nominalValue = useMemo(
    () => Number(onlyDigits(nominalInput) || 0),
    [nominalInput]
  );

  const selectedWallet =
    wallets.find((item) => item.walletKey === walletKey) ?? wallets?.[0];

  // Defisit dihitung terhadap KAS RIIL proyek (bukan anggaran pos). Server
  // menghitung ulang & menegakkan aturan ini; ini hanya UI hint.
  const currentBalance = safeNumber(sisaKas);

  const balanceAfterTransaction = isExpense
    ? currentBalance - nominalValue
    : currentBalance + nominalValue;

  const deficitAmount =
    !isEditing && isExpense ? Math.max(0, 0 - balanceAfterTransaction) : 0;

  const needsInvestorCover = !isEditing && deficitAmount > 0;

  const finalBalanceAfterCover = needsInvestorCover
    ? balanceAfterTransaction + deficitAmount
    : balanceAfterTransaction;

  const sectionClass =
    "rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(8,145,178,0.08),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.02))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-5";

  function applyEditingValues() {
    setWalletKey(
      (editingTransaction?.wallet_key as WalletKey) ??
        defaultWallet ??
        wallets?.[0]?.walletKey ??
        "utama"
    );
    setNominalInput(onlyDigits(String(Number(editingTransaction?.nominal ?? 0))));
    setJudulTransaksi(editingTransaction?.judul_transaksi ?? "");
    setTanggalTransaksi(
      normalizeDateValue(editingTransaction?.tanggal_transaksi)
    );
    setCatatan(editingTransaction?.catatan ?? "");
    setSelectedCoverInvestor(null);
  }

  function applyCreateValues() {
    setWalletKey(defaultWallet ?? wallets?.[0]?.walletKey ?? "utama");
    setNominalInput("");
    setJudulTransaksi("");
    setTanggalTransaksi(todayIso());
    setCatatan("");
    setSelectedCoverInvestor(null);
  }

  function resetForm() {
    if (isSubmitting) return;

    if (editingTransaction) {
      applyEditingValues();
    } else {
      applyCreateValues();
    }

    setErrors({});
    setServerError("");
    setSuccessMessage("");
  }

  function handleNominalChange(value: string) {
    setNominalInput(onlyDigits(value));
    setErrors((prev) => ({
      ...prev,
      nominal: undefined,
      investor_penanggung: undefined,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    setServerError("");
    setSuccessMessage("");

    const nextErrors = buildErrors({
      wallet: walletKey,
      nominal: nominalValue,
      judul: judulTransaksi,
      tanggal: tanggalTransaksi,
      needCoverInvestor: needsInvestorCover,
      coverInvestorId: selectedCoverInvestor
        ? String(selectedCoverInvestor.id_project_investor)
        : null,
    });

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const requestUrl = isEditing
      ? `/api/project/catat_arus_kas/${editingId}`
      : submitUrl;

    if (!requestUrl) {
      setServerError(
        "Form sudah siap dipakai, tapi endpoint submit belum dihubungkan."
      );
      return;
    }

    const payload = {
      id_project: idProject,
      wallet_key: walletKey,
      jenis_transaksi: jenisTransaksi,
      kategori_transaksi: editingTransaction?.kategori_transaksi ?? undefined,
      nominal: nominalValue,
      judul_transaksi: judulTransaksi.trim(),
      tanggal_transaksi: tanggalTransaksi,
      catatan: catatan.trim() || null,
      status_transaksi: editingTransaction?.status_transaksi ?? "tercatat",

      auto_cover_deficit: needsInvestorCover,
      deficit_nominal: needsInvestorCover ? deficitAmount : 0,
      investor_penanggung: needsInvestorCover
        ? {
            id_project_investor: String(
              selectedCoverInvestor?.id_project_investor ?? ""
            ),
            id_agent: String(selectedCoverInvestor?.id_agent ?? ""),
            nama: selectedCoverInvestor?.nama ?? null,
          }
        : null,
    };

    setIsSubmitting(true);

    try {
      const response = await fetch(requestUrl, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let responseJson: { message?: string } | null = null;

      try {
        responseJson = await response.json();
      } catch {
        responseJson = null;
      }

      if (!response.ok) {
        throw new Error(
          responseJson?.message ||
            (isEditing
              ? "Gagal memperbarui transaksi."
              : "Gagal menyimpan transaksi.")
        );
      }

      setSuccessMessage(
        isEditing
          ? "Transaksi berhasil diperbarui."
          : "Transaksi berhasil dicatat."
      );
      setErrors({});
      setServerError("");

      if (!isEditing) {
        applyCreateValues();
      }

      router.refresh();
      onSubmitted?.();
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : isEditing
            ? "Terjadi kesalahan saat memperbarui transaksi."
            : "Terjadi kesalahan saat menyimpan transaksi."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <form
        id={formId}
        onSubmit={handleSubmit}
        onReset={(event) => {
          event.preventDefault();
          resetForm();
        }}
        className="space-y-5 overflow-visible"
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/38">
            {isEditing ? "Mode edit transaksi" : "Tambah transaksi baru"}
          </div>

          <div
            className={[
              "inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em]",
              isEditing
                ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-100"
                : "border-emerald-300/20 bg-emerald-400/10 text-emerald-100",
            ].join(" ")}
          >
            {isEditing ? "Editing" : "Create"}
          </div>
        </div>

        <div className="grid gap-5 overflow-visible xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
          <div className="space-y-5 overflow-visible">
            <section className={sectionClass}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-white/38">
                  {isExpense ? "Nominal pengeluaran" : "Nominal pemasukan"}
                </div>

                <div
                  className={[
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em]",
                    isExpense
                      ? "border-rose-300/20 bg-rose-400/10 text-rose-200"
                      : "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
                  ].join(" ")}
                >
                  {isExpense ? "Keluar" : "Masuk"}
                </div>
              </div>

              <div className="mt-4 rounded-[24px] border border-white/10 bg-[#07111d] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-5">
                <label className="block">
                  <div className="flex items-center gap-3">
                    <div className="text-xl font-semibold text-white/90 sm:text-2xl">
                      Rp
                    </div>
                    <input
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="0"
                      value={formatDigitsId(nominalInput)}
                      onChange={(e) => handleNominalChange(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full bg-transparent text-3xl font-semibold tracking-tight text-white outline-none placeholder:text-white/20 disabled:cursor-not-allowed disabled:opacity-60 sm:text-4xl"
                    />
                  </div>
                </label>

                <div className="mt-3 text-sm leading-6 text-slate-400">
                  {nominalValue > 0
                    ? `${
                        isExpense ? "Transaksi keluar" : "Transaksi masuk"
                      } akan dicatat sebesar ${formatCurrency(nominalValue)}.`
                    : "Masukkan nominal transaksi."}
                </div>
              </div>

              {errors.nominal ? (
                <div className="mt-3 text-sm text-rose-300">
                  {errors.nominal}
                </div>
              ) : null}
            </section>

            {needsInvestorCover ? (
              <section className="relative rounded-[30px] border border-amber-300/15 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),transparent_34%),linear-gradient(180deg,rgba(251,191,36,0.08),rgba(255,255,255,0.02))] p-4 shadow-[0_24px_80px_rgba(245,158,11,0.08)] sm:p-5">
                <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_30%,transparent_74%,rgba(255,255,255,0.02))]" />

                <div className="relative z-[1]">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-amber-300/20 bg-amber-400/10 text-amber-200">
                      <AlertTriangle className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-amber-100/60">
                        Saldo dompet perlu ditutup investor
                      </div>

                      <h3 className="mt-1 text-xl font-semibold text-white">
                        Total cover dibutuhkan {formatCurrency(deficitAmount)}
                      </h3>

                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                        Cover ini akan menutup saldo minus yang sudah ada
                        ditambah transaksi baru pada dompet ini.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-[22px] border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                    <div className="flex items-center justify-between gap-3 py-1">
                      <span>Saldo dompet saat ini</span>
                      <span className="font-medium text-white">
                        {formatCurrency(currentBalance)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 py-1">
                      <span>Setelah transaksi ini</span>
                      <span
                        className={[
                          "font-medium",
                          balanceAfterTransaction < 0
                            ? "text-rose-200"
                            : "text-white",
                        ].join(" ")}
                      >
                        {formatCurrency(balanceAfterTransaction)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 py-1">
                      <span>Cover investor yang dibutuhkan</span>
                      <span className="font-medium text-amber-200">
                        {formatCurrency(deficitAmount)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3 overflow-visible">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-white/38">
                      Investor penanggung
                    </div>

                    <ProjectInvestorCombobox
                      idProject={idProject}
                      value={
                        selectedCoverInvestor
                          ? String(selectedCoverInvestor.id_project_investor)
                          : null
                      }
                      selected={selectedCoverInvestor}
                      onSelect={(option) => {
                        setSelectedCoverInvestor(option);
                        setErrors((prev) => ({
                          ...prev,
                          investor_penanggung: undefined,
                        }));
                      }}
                      disabled={isSubmitting}
                      helperText={investorSourceLabel}
                    />

                    {errors.investor_penanggung ? (
                      <div className="text-sm text-rose-300">
                        {errors.investor_penanggung}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-400">
                        {investorSourceLabel}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            <section className="grid gap-5">
              <div className={sectionClass}>
                <label className="text-[11px] uppercase tracking-[0.22em] text-white/38">
                  Judul transaksi
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Bayar dokumen balik nama"
                  value={judulTransaksi}
                  onChange={(e) => {
                    setJudulTransaksi(e.target.value);
                    setErrors((prev) => ({ ...prev, judul: undefined }));
                  }}
                  disabled={isSubmitting}
                  className="mt-3 h-16 w-full rounded-[20px] border border-white/10 bg-white/[0.03] px-5 text-base text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/35 focus:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60 md:text-lg xl:text-[1.15rem]"
                />
                {errors.judul ? (
                  <div className="mt-2 text-sm text-rose-300">
                    {errors.judul}
                  </div>
                ) : null}
              </div>

              <div className={sectionClass}>
                <label className="text-[11px] uppercase tracking-[0.22em] text-white/38">
                  Tanggal
                </label>

                <button
                  type="button"
                  onClick={() => !isSubmitting && setIsCalendarOpen(true)}
                  disabled={isSubmitting}
                  className="mt-3 flex h-16 w-full items-center justify-between rounded-[20px] border border-cyan-300/30 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(255,255,255,0.03))] px-4 text-left text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-cyan-300/45 hover:bg-cyan-400/[0.09] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="inline-flex items-center gap-3">
                    <CalendarDays className="h-5 w-5 text-white/55" />
                    <span className="text-base font-medium tracking-[0.02em] text-white md:text-lg">
                      {formatDateDisplay(tanggalTransaksi)}
                    </span>
                  </span>

                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/50">
                    Ubah
                  </span>
                </button>

                {errors.tanggal ? (
                  <div className="mt-2 text-sm text-rose-300">
                    {errors.tanggal}
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-slate-400">
                    Ketuk untuk memilih tanggal transaksi.
                  </div>
                )}
              </div>
            </section>

            <section className={sectionClass}>
              <label className="text-[11px] uppercase tracking-[0.22em] text-white/38">
                Catatan
              </label>
              <textarea
                rows={4}
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                disabled={isSubmitting}
                placeholder="Tambahkan konteks singkat agar histori transaksi lebih mudah dipahami."
                className="mt-3 w-full rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3 text-base text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/35 focus:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
              />
            </section>
          </div>

          <div className="space-y-5">
            <section className={sectionClass}>
              <div className="text-[11px] uppercase tracking-[0.22em] text-white/38">
                Pilih dompet
              </div>

              <div className="mt-3 grid gap-3">
                {wallets.map((option) => {
                  const active = walletKey === option.walletKey;

                  return (
                    <button
                      key={option.walletKey}
                      type="button"
                      onClick={() => {
                        if (isSubmitting) return;
                        setWalletKey(option.walletKey);
                        setErrors((prev) => ({
                          ...prev,
                          wallet: undefined,
                          investor_penanggung: undefined,
                        }));
                      }}
                      disabled={isSubmitting}
                      className={[
                        "rounded-[22px] border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
                        active
                          ? "border-cyan-300/35 bg-[linear-gradient(180deg,rgba(34,211,238,0.10),rgba(255,255,255,0.03))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div
                            className={[
                              "inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em]",
                              getWalletTone(option.walletKey),
                            ].join(" ")}
                          >
                            {option.title}
                          </div>

                          <div className="mt-2 text-base text-slate-300">
                            {getWalletHint(option.walletKey)}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                            Saldo
                          </div>
                          <div className="mt-2 text-sm font-semibold text-white/90">
                            {formatCurrency(safeNumber(option.balance))}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {errors.wallet ? (
                <div className="mt-3 text-sm text-rose-300">{errors.wallet}</div>
              ) : null}
            </section>

            <section className={sectionClass}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-white/38">
                    Proyeksi saldo dompet
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    Minus lama dan transaksi baru akan dihitung penuh
                  </div>
                </div>

                <div
                  className={[
                    "inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em]",
                    getWalletTone(selectedWallet?.walletKey),
                  ].join(" ")}
                >
                  {selectedWallet?.title ?? "Dompet"}
                </div>
              </div>

              <div className="mt-4 rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-4 py-2">
                  <span className="text-sm text-slate-400">Saldo saat ini</span>
                  <span
                    className={[
                      "text-sm font-medium",
                      currentBalance < 0 ? "text-rose-200" : "text-white/90",
                    ].join(" ")}
                  >
                    {formatCurrency(currentBalance)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-white/8 py-2">
                  <span className="text-sm text-slate-400">Transaksi ini</span>
                  <span
                    className={[
                      "text-sm font-medium",
                      isExpense ? "text-rose-200" : "text-emerald-200",
                    ].join(" ")}
                  >
                    {nominalValue > 0
                      ? `${isExpense ? "-" : "+"}${formatCurrency(nominalValue)}`
                      : "-"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-white/8 py-2">
                  <span className="text-sm text-slate-400">
                    Saldo setelah transaksi
                  </span>
                  <span
                    className={[
                      "text-sm font-medium",
                      balanceAfterTransaction < 0
                        ? "text-rose-200"
                        : "text-white/90",
                    ].join(" ")}
                  >
                    {formatCurrency(balanceAfterTransaction)}
                  </span>
                </div>

                {needsInvestorCover ? (
                  <>
                    <div className="flex items-center justify-between gap-4 border-t border-white/8 py-2">
                      <span className="text-sm text-slate-400">
                        Cover investor
                      </span>
                      <span className="text-sm font-medium text-amber-200">
                        +{formatCurrency(deficitAmount)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 border-t border-white/8 py-2">
                      <span className="text-sm text-slate-300">
                        Saldo akhir setelah cover
                      </span>
                      <span className="text-sm font-semibold text-white">
                        {formatCurrency(finalBalanceAfterCover)}
                      </span>
                    </div>
                  </>
                ) : null}
              </div>

              {needsInvestorCover ? (
                <div className="mt-3 rounded-[20px] border border-amber-300/15 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100">
                  Investor penanggung akan menutup seluruh minus dompet setelah
                  transaksi ini disimpan.
                </div>
              ) : null}
            </section>
          </div>
        </div>

        {serverError ? (
          <div className="rounded-[18px] border border-rose-300/15 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {serverError}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-[18px] border border-emerald-300/15 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            <div className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {successMessage}
            </div>
          </div>
        ) : null}
      </form>

      <CalendarPickerModal
        open={isCalendarOpen}
        value={tanggalTransaksi}
        disabled={isSubmitting}
        onClose={() => setIsCalendarOpen(false)}
        onChange={(value) => {
          setTanggalTransaksi(value);
          setErrors((prev) => ({ ...prev, tanggal: undefined }));
        }}
      />
    </>
  );
}
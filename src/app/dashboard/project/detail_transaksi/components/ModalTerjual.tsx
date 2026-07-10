"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Home,
  Loader2,
  Lock,
  Percent,
  Plus,
  RefreshCcw,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";

type Investor = {
  id_agent?: string;
  nama?: string;
  avatar?: string | null;
  gambar?: string | null;
  foto?: string | null;
  image?: string | null;
  nominal_komitmen?: number | string;
  nominal_terbayar?: number | string;
  persentase_kepemilikan?: number | string;
};

type ProjectData = {
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
  id_project_unit?: string | null;
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

type UnitDistribusi = {
  id_agent: string;
  nama?: string | null;
  avatar_url?: string | null;
  modal: number;
  porsi_percent: number;
  profit: number;
  total_diterima: number;
};

type UnitSale = {
  id_project_selesai: string;
  tanggal_pembelian: string | null;
  tanggal_terjual: string;
  durasi_hari: number;
  harga_jual: number;
  total_biaya_akuisisi: number;
  profit_kotor: number;
  pph_percent: number;
  ajb_percent: number;
  agent_fee_percent: number;
  pph_nominal?: number;
  ajb_nominal?: number;
  agent_fee_nominal?: number;
  total_biaya_transaksi: number;
  profit_bersih: number;
  roi_bersih: number;
};

type FeeMode = "percent" | "nominal";

type UnitInfo = {
  id_project_unit: string;
  nama_unit: string;
  bobot_persen: number;
  urutan: number;
  terjual: boolean;
  biaya_unit: number;
  estimasi_harga_unit: number;
  sale: UnitSale | null;
  distribusi: UnitDistribusi[];
};

type ServerInvestor = {
  id_agent: string;
  nama: string | null;
  avatar_url: string | null;
  nominal_komitmen: number;
  nominal_terbayar: number;
};

type UnitsData = {
  id_project: string;
  status: string;
  mulai_tanggal: string | null;
  has_units: boolean;
  unit_count: number;
  sold_count: number;
  semua_terjual: boolean;
  locked: boolean;
  total_biaya_project: number;
  estimasi_harga_jual: number;
  investors?: ServerInvestor[];
  units: UnitInfo[];
  legacy_sale: (UnitSale & { distribusi: UnitDistribusi[] }) | null;
  aggregate: {
    jumlah_penjualan: number;
    harga_jual: number;
    total_biaya_akuisisi: number;
    total_biaya_transaksi: number;
    profit_kotor: number;
    profit_bersih: number;
    tanggal_terjual_terakhir?: string;
  } | null;
};

type Phase = "loading" | "error" | "decide" | "setup" | "units" | "form";

type DraftUnit = { nama: string; bobot: string };

type Props = {
  open: boolean;
  onClose: () => void;
  project: ProjectData;
  onSubmit?: (payload: SubmitPayload) => Promise<void> | void;
  readOnly?: boolean;
};

function toSafeNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const cleaned = value
      .replace(/[^\d,.-]/g, "")
      .replace(/\.(?=\d{3,})/g, "")
      .replace(",", ".");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (value && typeof value === "object") {
    const asString =
      typeof (value as any).toString === "function"
        ? (value as any).toString()
        : "";
    const parsed = Number(asString);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatIDR(value: unknown) {
  const num = toSafeNumber(value);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num);
}

function formatPercent(value: number) {
  return `${value.toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function parseFormattedNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function toInputCurrency(value: number) {
  if (!value) return "";
  return value.toLocaleString("id-ID");
}

function normalizePercent(raw: unknown): number {
  const num = toSafeNumber(raw);
  if (num <= 0) return 0;
  return num > 1 ? num / 100 : num;
}

function getInvestorAvatar(inv: Investor) {
  return inv?.avatar ?? inv?.gambar ?? inv?.foto ?? inv?.image ?? null;
}

/** Normalisasi URL foto (dukung raw Google Drive id/url) → thumbnail. */
function resolveAvatarUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  if (/^[A-Za-z0-9_-]{20,}$/.test(trimmed)) {
    return `https://drive.google.com/thumbnail?id=${trimmed}&sz=w200`;
  }

  const match = trimmed.match(/(?:id=|\/d\/)([A-Za-z0-9_-]{20,})/);
  if (match?.[1]) {
    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w200`;
  }

  if (/^(https?:\/\/|\/|data:)/.test(trimmed)) return trimmed;
  return null;
}

function getInitials(name: string) {
  const clean = String(name || "").trim();
  if (!clean) return "IN";

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function normalizeDateInput(value?: string | null) {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";

  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";

  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseLocalDate(value?: string | null) {
  const normalized = normalizeDateInput(value);
  if (!normalized) return null;
  const [y, m, d] = normalized.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toYmd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(value?: string | null) {
  const date = parseLocalDate(value);
  if (!date) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function diffDays(start?: string | null, end?: string | null) {
  const startDate = parseLocalDate(start);
  const endDate = parseLocalDate(end);
  if (!startDate || !endDate) return 0;

  const ms = endDate.getTime() - startDate.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function formatDurationDetailed(daysTotal: number) {
  const safeDays = Math.max(0, daysTotal);
  const months = Math.floor(safeDays / 30);
  const days = safeDays % 30;

  if (months > 0 && days > 0) return `${months} bulan ${days} hari`;
  if (months > 0) return `${months} bulan`;
  if (days > 0) return `${days} hari`;
  return "-";
}

function buildCalendarDays(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(year, month, 1 - startWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return date;
  });
}

function CalendarPicker({
  value,
  minDate,
  onChange,
  disabled = false,
}: {
  value: string;
  minDate?: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const selectedDate = parseLocalDate(value) ?? new Date();
  const minDateObj = parseLocalDate(minDate);
  const [viewDate, setViewDate] = useState<Date>(
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

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

  useEffect(() => {
    const base = parseLocalDate(value);
    if (!base) return;
    setViewDate(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [value]);

  const days = useMemo(() => buildCalendarDays(viewDate), [viewDate]);

  const today = toYmd(new Date());
  const selectedYmd = normalizeDateInput(value);
  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();

  const weekLabels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        className={`group w-full rounded-[22px] border px-4 py-3 text-left transition ${
          disabled
            ? "cursor-default border-white/8 bg-slate-950/25 opacity-90"
            : "border-white/10 bg-slate-950/50 hover:bg-slate-950 focus:border-emerald-400/40"
        }`}
      >
        <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
          Tanggal realisasi penjualan
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-300/15 bg-emerald-400/10 text-emerald-300">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div>
              <div className="text-base font-semibold text-white">
                {formatDisplayDate(value)}
              </div>
              <div className="text-xs text-slate-400">
                {disabled ? "Tanggal realisasi tersimpan" : "Pilih tanggal penjualan"}
              </div>
            </div>
          </div>

          {!disabled ? (
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300">
              Ubah
            </div>
          ) : null}
        </div>
      </button>

      {open && !disabled ? (
        <div className="absolute left-0 top-[calc(100%+12px)] z-[120] w-full min-w-[300px] overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,11,17,0.98),rgba(4,6,10,0.98))] shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-white/70 via-white/20 to-transparent" />
          <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-300/10 blur-3xl" />

          <div className="relative p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setViewDate(new Date(currentYear, currentMonth - 1, 1))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-slate-200 transition hover:bg-white/[0.08]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="text-center">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  Kalender
                </div>
                <div className="mt-1 text-base font-semibold text-white">
                  {formatMonthYear(viewDate)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewDate(new Date(currentYear, currentMonth + 1, 1))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-slate-200 transition hover:bg-white/[0.08]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-3 grid grid-cols-7 gap-2">
              {weekLabels.map((label) => (
                <div
                  key={label}
                  className="py-1 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {days.map((date) => {
                const ymd = toYmd(date);
                const isCurrentMonth = date.getMonth() === currentMonth;
                const isSelected = ymd === selectedYmd;
                const isToday = ymd === today;
                const isDisabled = !!minDateObj && date < minDateObj;

                return (
                  <button
                    key={ymd}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      onChange(ymd);
                      setOpen(false);
                    }}
                    className={[
                      "relative flex h-11 items-center justify-center rounded-2xl text-sm font-medium transition",
                      isSelected
                        ? "border border-emerald-300/20 bg-emerald-400/15 text-emerald-200 shadow-[0_0_0_1px_rgba(16,185,129,0.12)]"
                        : isCurrentMonth
                        ? "border border-transparent bg-white/[0.03] text-white hover:border-white/10 hover:bg-white/[0.07]"
                        : "border border-transparent bg-transparent text-slate-600 hover:bg-white/[0.03]",
                      isDisabled
                        ? "cursor-not-allowed opacity-35 hover:bg-transparent"
                        : "",
                    ].join(" ")}
                  >
                    <span>{date.getDate()}</span>
                    {isToday && !isSelected ? (
                      <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-cyan-300" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-white/[0.03] px-3 py-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Tanggal dipilih
                </div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {formatDisplayDate(value)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onChange(toYmd(new Date()));
                  setOpen(false);
                }}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08]"
              >
                Hari ini
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  tone = "default",
  helper,
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "warning" | "negative" | "cyan";
  helper?: string;
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-300"
      : tone === "warning"
      ? "text-amber-300"
      : tone === "negative"
      ? "text-rose-300"
      : tone === "cyan"
      ? "text-cyan-300"
      : "text-white";

  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-950/40 p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className={`mt-2 text-[28px] font-semibold leading-none ${toneClass}`}>
        {value}
      </div>
      {helper ? (
        <div className="mt-2 text-xs leading-5 text-slate-400">{helper}</div>
      ) : null}
    </div>
  );
}

export default function ModalTerjual({
  open,
  onClose,
  project,
  onSubmit,
  readOnly = false,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [hargaJualInput, setHargaJualInput] = useState("");
  const [totalBiayaAkuisisiInput, setTotalBiayaAkuisisiInput] = useState("");
  const [tanggalTerjual, setTanggalTerjual] = useState("");

  const [pphInput, setPphInput] = useState("2.5");
  const [ajbInput, setAjbInput] = useState("0.5");
  const [agentFeeInput, setAgentFeeInput] = useState("2");

  // Override nominal fee — dipakai bila dasar pajak (nilai akta) ≠ harga riil.
  // mode "percent" → nominal mengikuti % × harga; "nominal" → angka manual.
  const [pphMode, setPphMode] = useState<FeeMode>("percent");
  const [ajbMode, setAjbMode] = useState<FeeMode>("percent");
  const [agentFeeMode, setAgentFeeMode] = useState<FeeMode>("percent");
  const [pphNominalInput, setPphNominalInput] = useState("");
  const [ajbNominalInput, setAjbNominalInput] = useState("");
  const [agentFeeNominalInput, setAgentFeeNominalInput] = useState("");

  // Mode koreksi: penjualan tersimpan dibuka kembali untuk diedit.
  const [isEditing, setIsEditing] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  // ── Wizard multi-unit ──
  const [phase, setPhase] = useState<Phase>("loading");
  const [unitsData, setUnitsData] = useState<UnitsData | null>(null);
  const [unitsError, setUnitsError] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<UnitInfo | null>(null);
  const [draftUnits, setDraftUnits] = useState<DraftUnit[]>([
    { nama: "Unit 1", bobot: "50" },
    { nama: "Unit 2", bobot: "50" },
  ]);
  const [setupSaving, setSetupSaving] = useState(false);
  const [setupError, setSetupError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const resetFormInputs = useCallback(() => {
    const hargaJualValue = readOnly
      ? toSafeNumber(project?.harga_jual ?? project?.estimasi_harga_jual)
      : toSafeNumber(project?.estimasi_harga_jual);

    const biayaAkuisisiValue = toSafeNumber(project?.total_biaya_akuisisi);
    const tanggalReal = normalizeDateInput(
      readOnly ? project?.tanggal_terjual : null
    );

    setHargaJualInput(toInputCurrency(hargaJualValue));
    setTotalBiayaAkuisisiInput(toInputCurrency(biayaAkuisisiValue));
    setTanggalTerjual(tanggalReal || new Date().toISOString().slice(0, 10));

    setPphInput(String(toSafeNumber(project?.pph_percent || 2.5)));
    setAjbInput(String(toSafeNumber(project?.ajb_percent || 0.5)));
    setAgentFeeInput(String(toSafeNumber(project?.agent_fee_percent || 2)));

    setPphMode("percent");
    setAjbMode("percent");
    setAgentFeeMode("percent");
    setPphNominalInput("");
    setAjbNominalInput("");
    setAgentFeeNominalInput("");
  }, [project, readOnly]);

  /** Prefill fee dari penjualan tersimpan. Nominal yang menyimpang dari
   *  % × harga (> Rp 1) berarti dulu di-override manual → mode nominal. */
  const applyFeeFromSale = useCallback((sale: UnitSale) => {
    setPphInput(String(sale.pph_percent));
    setAjbInput(String(sale.ajb_percent));
    setAgentFeeInput(String(sale.agent_fee_percent));

    const applyOne = (
      nominal: number | undefined,
      percent: number,
      setMode: (mode: FeeMode) => void,
      setNomInput: (value: string) => void
    ) => {
      const computed = (percent / 100) * sale.harga_jual;
      if (
        typeof nominal === "number" &&
        nominal > 0 &&
        Math.abs(nominal - computed) > 1
      ) {
        setMode("nominal");
        setNomInput(toInputCurrency(Math.round(nominal)));
      } else {
        setMode("percent");
        setNomInput("");
      }
    };

    applyOne(sale.pph_nominal, sale.pph_percent, setPphMode, setPphNominalInput);
    applyOne(sale.ajb_nominal, sale.ajb_percent, setAjbMode, setAjbNominalInput);
    applyOne(
      sale.agent_fee_nominal,
      sale.agent_fee_percent,
      setAgentFeeMode,
      setAgentFeeNominalInput
    );
  }, []);

  const loadUnits = useCallback(async () => {
    const projectId = String(project?.id_project ?? "").trim();
    if (!projectId) {
      setPhase("form");
      return;
    }

    setPhase("loading");
    setUnitsError("");

    try {
      const res = await fetch(`/api/project/${projectId}/units`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success || !json?.data) {
        throw new Error(json?.message || "Gagal memuat data unit.");
      }

      const data = json.data as UnitsData;
      setUnitsData(data);

      if (data.has_units) {
        setPhase("units");
      } else if (data.legacy_sale || readOnly) {
        // Penjualan utuh sudah/akan dilihat — langsung form (perilaku lama).
        // Prefill dari baris tersimpan agar nominal fee eksak (bisa manual).
        if (data.legacy_sale) {
          setHargaJualInput(toInputCurrency(data.legacy_sale.harga_jual));
          setTotalBiayaAkuisisiInput(
            toInputCurrency(data.legacy_sale.total_biaya_akuisisi)
          );
          setTanggalTerjual(normalizeDateInput(data.legacy_sale.tanggal_terjual));
          applyFeeFromSale(data.legacy_sale);
        }
        setPhase("form");
      } else {
        setPhase("decide");
      }
    } catch (error) {
      console.error("Gagal memuat unit:", error);
      setUnitsError(
        error instanceof Error ? error.message : "Gagal memuat data unit."
      );
      setPhase("error");
    }
  }, [project?.id_project, readOnly, applyFeeFromSale]);

  useEffect(() => {
    if (!open) return;

    resetFormInputs();
    setIsSaving(false);
    setSelectedUnit(null);
    setIsEditing(false);
    setSetupError("");
    setDraftUnits([
      { nama: "Unit 1", bobot: "50" },
      { nama: "Unit 2", bobot: "50" },
    ]);
    void loadUnits();
  }, [open, resetFormInputs, loadUnits]);

  useEffect(() => {
    if (!open) return;

    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
    };
  }, [open]);

  const mulaiTanggal = useMemo(
    () =>
      normalizeDateInput(unitsData?.mulai_tanggal ?? project?.mulai_tanggal),
    [unitsData?.mulai_tanggal, project?.mulai_tanggal]
  );

  // Form terkunci: mode legacy read-only ATAU unit terjual — kecuali sedang
  // dikoreksi (isEditing).
  const formReadOnly =
    (selectedUnit ? selectedUnit.terjual : readOnly) && !isEditing;

  // Unit "final" memakai SISA (biaya & modal kembali) agar total genap —
  // mengikuti server. Saat MENGEDIT unit terjual, unit itu dianggap belum
  // terjual dulu: final iff tidak ada unit lain yang masih tersedia.
  const isFinalUnit = useMemo(() => {
    if (!selectedUnit || !unitsData) return false;
    const otherUnsold =
      unitsData.unit_count -
      unitsData.sold_count -
      (selectedUnit.terjual ? 0 : 1);
    return otherUnsold === 0;
  }, [selectedUnit, unitsData]);

  // Σ modal yang sudah dikembalikan ke tiap investor pada unit terjual
  // LAIN — pratinjau modal kembali unit final. Unit yang sedang dikoreksi
  // dikeluarkan (distribusinya akan ditulis ulang).
  const priorReturnedByAgent = useMemo(() => {
    const map = new Map<string, number>();
    if (!unitsData) return map;
    for (const unit of unitsData.units) {
      if (!unit.terjual) continue;
      if (
        selectedUnit &&
        unit.id_project_unit === selectedUnit.id_project_unit
      ) {
        continue;
      }
      for (const row of unit.distribusi) {
        map.set(row.id_agent, (map.get(row.id_agent) ?? 0) + toSafeNumber(row.modal));
      }
    }
    return map;
  }, [unitsData, selectedUnit]);

  function pickUnit(unit: UnitInfo) {
    // Viewer read-only hanya boleh membuka unit yang SUDAH terjual (detail).
    if (!unit.terjual && readOnly) return;

    setSelectedUnit(unit);
    setIsEditing(false);

    if (unit.sale) {
      setHargaJualInput(toInputCurrency(unit.sale.harga_jual));
      setTotalBiayaAkuisisiInput(toInputCurrency(unit.sale.total_biaya_akuisisi));
      setTanggalTerjual(normalizeDateInput(unit.sale.tanggal_terjual));
      applyFeeFromSale(unit.sale);
    } else {
      setHargaJualInput(
        unit.estimasi_harga_unit > 0
          ? toInputCurrency(Math.round(unit.estimasi_harga_unit))
          : ""
      );
      setTotalBiayaAkuisisiInput(toInputCurrency(Math.round(unit.biaya_unit)));
      setTanggalTerjual(new Date().toISOString().slice(0, 10));
      setPphInput(String(toSafeNumber(project?.pph_percent || 2.5)));
      setAjbInput(String(toSafeNumber(project?.ajb_percent || 0.5)));
      setAgentFeeInput(String(toSafeNumber(project?.agent_fee_percent || 2)));
      setPphMode("percent");
      setAjbMode("percent");
      setAgentFeeMode("percent");
      setPphNominalInput("");
      setAjbNominalInput("");
      setAgentFeeNominalInput("");
    }

    setPhase("form");
  }

  const hargaJual = useMemo(
    () => parseFormattedNumber(hargaJualInput),
    [hargaJualInput]
  );

  const totalBiayaAkuisisi = useMemo(
    () => parseFormattedNumber(totalBiayaAkuisisiInput),
    [totalBiayaAkuisisiInput]
  );

  const pph = useMemo(() => toSafeNumber(pphInput), [pphInput]);
  const ajb = useMemo(() => toSafeNumber(ajbInput), [ajbInput]);
  const agentFee = useMemo(() => toSafeNumber(agentFeeInput), [agentFeeInput]);

  // Nominal efektif: mode "nominal" = angka manual (nilai akta bisa ≠ harga
  // riil); mode "percent" = % × harga jual. Server memakai nominal ini sebagai
  // sumber kebenaran dan menyimpan % turunannya sebagai referensi.
  const pphNominal = useMemo(
    () =>
      pphMode === "nominal"
        ? parseFormattedNumber(pphNominalInput)
        : hargaJual * (pph / 100),
    [pphMode, pphNominalInput, hargaJual, pph]
  );
  const ajbNominal = useMemo(
    () =>
      ajbMode === "nominal"
        ? parseFormattedNumber(ajbNominalInput)
        : hargaJual * (ajb / 100),
    [ajbMode, ajbNominalInput, hargaJual, ajb]
  );
  const agentFeeNominal = useMemo(
    () =>
      agentFeeMode === "nominal"
        ? parseFormattedNumber(agentFeeNominalInput)
        : hargaJual * (agentFee / 100),
    [agentFeeMode, agentFeeNominalInput, hargaJual, agentFee]
  );

  const totalBiayaTransaksi = pphNominal + ajbNominal + agentFeeNominal;
  const profitKotor = hargaJual - totalBiayaAkuisisi;
  const profitBersih = profitKotor - totalBiayaTransaksi;

  const durasiHari = useMemo(
    () => diffDays(mulaiTanggal, tanggalTerjual),
    [mulaiTanggal, tanggalTerjual]
  );

  const durasiBulan = useMemo(() => {
    if (durasiHari <= 0) return 0;
    return Number((durasiHari / 30).toFixed(1));
  }, [durasiHari]);

  const durasiLabel = useMemo(
    () => formatDurationDetailed(durasiHari),
    [durasiHari]
  );

  const roiKotor = useMemo(() => {
    if (totalBiayaAkuisisi <= 0) return 0;
    return (profitKotor / totalBiayaAkuisisi) * 100;
  }, [profitKotor, totalBiayaAkuisisi]);

  const roiBersih = useMemo(() => {
    if (totalBiayaAkuisisi <= 0) return 0;
    return (profitBersih / totalBiayaAkuisisi) * 100;
  }, [profitBersih, totalBiayaAkuisisi]);

  const invalidTanggal =
    !!mulaiTanggal &&
    !!tanggalTerjual &&
    diffDays(mulaiTanggal, tanggalTerjual) < 0;

  const investors = Array.isArray(project?.investors) ? project.investors : [];

  const investorIdentityMap = useMemo(() => {
    const map = new Map<string, { nama: string; avatar: string | null }>();
    for (const inv of investors) {
      const id = String(inv?.id_agent ?? "").trim();
      if (!id) continue;
      map.set(id, {
        nama: String(inv?.nama ?? id),
        avatar: getInvestorAvatar(inv),
      });
    }
    return map;
  }, [investors]);

  const distributions = useMemo(() => {
    // Unit TERJUAL (dan tidak sedang dikoreksi) → tampilkan distribusi
    // TERSIMPAN (snapshot server), bukan hitung ulang — data investor bisa
    // berubah setelah penjualan. Identitas: prop client → fallback server.
    if (selectedUnit?.terjual && !isEditing) {
      return selectedUnit.distribusi.map((row) => {
        const identity = investorIdentityMap.get(row.id_agent);
        return {
          id_agent: row.id_agent,
          nama: identity?.nama ?? row.nama ?? row.id_agent,
          avatar: identity?.avatar ?? resolveAvatarUrl(row.avatar_url),
          modal: toSafeNumber(row.modal),
          porsiPercent: toSafeNumber(row.porsi_percent),
          profit: toSafeNumber(row.profit),
          totalDiterima: toSafeNumber(row.total_diterima),
        };
      });
    }

    // SUMBER KEBENARAN basis kalkulasi = daftar investor dari SERVER (GET
    // units): id_agent, setoran, identitas dijamin cocok dengan distribusi
    // tersimpan. Prop halaman hanya fallback (mis. legacy tanpa fetch) —
    // id_agent prop yang tak cocok pernah bikin lookup "prior returned"
    // gagal → modal kembali unit final tampil FULL, bukan sisa.
    const serverInvestors = unitsData?.investors;

    const investorBase = (
      serverInvestors && serverInvestors.length
        ? serverInvestors.map((inv) => {
            const identity = investorIdentityMap.get(inv.id_agent);
            const terbayar = toSafeNumber(inv.nominal_terbayar);
            return {
              id_agent: inv.id_agent,
              nama: identity?.nama ?? inv.nama ?? inv.id_agent,
              avatar: identity?.avatar ?? resolveAvatarUrl(inv.avatar_url),
              modal:
                terbayar > 0
                  ? terbayar
                  : toSafeNumber(inv.nominal_komitmen),
              percentRaw: 0,
            };
          })
        : investors
            .map((inv, index) => {
              // Basis distribusi = modal DISETOR (nominal_terbayar). Fallback
              // ke komitmen utk data lama.
              const terbayar = toSafeNumber(inv?.nominal_terbayar);
              const modal =
                terbayar > 0 ? terbayar : toSafeNumber(inv?.nominal_komitmen);
              const percentRaw = normalizePercent(inv?.persentase_kepemilikan);
              const id_agent = String(inv?.id_agent ?? "").trim();

              return {
                id_agent,
                nama: inv?.nama ?? id_agent ?? `Investor ${index + 1}`,
                avatar: getInvestorAvatar(inv),
                modal,
                percentRaw,
              };
            })
            .filter((item) => item.id_agent.length > 0)
    );

    if (!investorBase.length) return [];

    const totalModal = investorBase.reduce((sum, item) => sum + item.modal, 0);

    const totalExplicitPercent = investorBase.reduce(
      (sum, item) => sum + item.percentRaw,
      0
    );

    const finalWeights = investorBase.map((item) => {
      let weight = 0;

      // Weight dinormalisasi sehingga Σ weight = 1 (distribusi pasti 100%).
      // Lihat src/lib/investor-ownership.ts & _lib/sale-units.ts (server).
      if (totalModal > 0) {
        weight = item.modal / totalModal;
      } else if (totalExplicitPercent > 0) {
        // Fallback legacy: hanya dipakai bila komitmen tak tersedia.
        weight = item.percentRaw / totalExplicitPercent;
      }

      return {
        ...item,
        weight,
      };
    });

    return finalWeights.map((item) => {
      // Modal kembali: unit biasa = bobot% × setoran; unit terakhir = sisa
      // setoran yang belum dikembalikan; penjualan utuh = setoran penuh.
      // Pratinjau — server menghitung ulang dengan aturan yang sama.
      let modalKembali = item.modal;
      if (selectedUnit) {
        if (isFinalUnit) {
          const prior = priorReturnedByAgent.get(item.id_agent) ?? 0;
          modalKembali = Math.max(0, item.modal - prior);
        } else {
          modalKembali = (selectedUnit.bobot_persen / 100) * item.modal;
        }
      }

      const profit = profitBersih * item.weight;
      const totalDiterima = modalKembali + profit;

      return {
        id_agent: item.id_agent,
        nama: item.nama,
        avatar: item.avatar,
        modal: modalKembali,
        porsiPercent: item.weight * 100,
        profit,
        totalDiterima,
      };
    });
  }, [
    investors,
    unitsData?.investors,
    profitBersih,
    selectedUnit,
    isEditing,
    isFinalUnit,
    priorReturnedByAgent,
    investorIdentityMap,
  ]);

  const totalDistribusiPercent = distributions.reduce(
    (sum, item) => sum + item.porsiPercent,
    0
  );

  const totalDistribusiProfit = distributions.reduce(
    (sum, item) => sum + item.profit,
    0
  );

  async function submitToApi(payload: SubmitPayload) {
    const projectId = payload.id_project || project?.id_project;

    if (!projectId) {
      throw new Error("ID project tidak ditemukan.");
    }

    const res = await fetch(`/api/project/${projectId}/simpan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(json?.message || "Gagal menyimpan penjualan.");
    }

    return json;
  }

  async function handleSubmit() {
    if (formReadOnly || invalidTanggal || isSaving) return;

    const payload: SubmitPayload = {
      id_project: project?.id_project,
      id_project_unit: selectedUnit?.id_project_unit ?? null,
      tanggal_terjual: tanggalTerjual || null,
      durasi_hari: durasiHari,
      durasi_bulan: durasiBulan,
      roi_kotor_percent: roiKotor,
      roi_bersih_percent: roiBersih,
      harga_jual: hargaJual,
      total_biaya_akuisisi: totalBiayaAkuisisi,
      pph_percent: pph,
      ajb_percent: ajb,
      agent_fee_percent: agentFee,
      pph_nominal: pphNominal,
      ajb_nominal: ajbNominal,
      agent_fee_nominal: agentFeeNominal,
      total_biaya_transaksi: totalBiayaTransaksi,
      profit_kotor: profitKotor,
      profit_bersih: profitBersih,
      distribusi_investor: distributions.map((item) => ({
        id_agent: item.id_agent,
        nama: item.nama,
        modal: item.modal,
        porsi_percent: item.porsiPercent,
        profit: item.profit,
        total_diterima: item.totalDiterima,
      })),
    };

    try {
      setIsSaving(true);

      if (onSubmit) {
        await onSubmit(payload);
      } else {
        await submitToApi(payload);
      }

      onClose();
    } catch (error) {
      console.error("Gagal menyimpan penjualan:", error);
      alert(error instanceof Error ? error.message : "Gagal menyimpan penjualan.");
    } finally {
      setIsSaving(false);
    }
  }

  // ── Setup pembagian unit ──
  const draftTotalBobot = useMemo(
    () =>
      draftUnits.reduce((sum, unit) => sum + toSafeNumber(unit.bobot), 0),
    [draftUnits]
  );

  const draftValid =
    draftUnits.length >= 2 &&
    draftUnits.every(
      (unit) => unit.nama.trim().length > 0 && toSafeNumber(unit.bobot) > 0
    ) &&
    Math.abs(draftTotalBobot - 100) <= 0.05 &&
    new Set(draftUnits.map((u) => u.nama.trim().toLowerCase())).size ===
      draftUnits.length;

  function splitEvenly(count: number) {
    const safeCount = Math.max(2, Math.min(12, count));
    const even = Math.floor((100 / safeCount) * 100) / 100;
    const last = Math.round((100 - even * (safeCount - 1)) * 100) / 100;

    setDraftUnits(
      Array.from({ length: safeCount }, (_, index) => ({
        nama:
          draftUnits[index]?.nama?.trim() || `Unit ${index + 1}`,
        bobot: String(index === safeCount - 1 ? last : even),
      }))
    );
  }

  async function handleSaveSetup() {
    if (!draftValid || setupSaving) return;

    const projectId = String(project?.id_project ?? "").trim();
    if (!projectId) return;

    try {
      setSetupSaving(true);
      setSetupError("");

      const res = await fetch(`/api/project/${projectId}/units`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          units: draftUnits.map((unit) => ({
            nama_unit: unit.nama.trim(),
            bobot_persen: toSafeNumber(unit.bobot),
          })),
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Gagal menyimpan pembagian unit.");
      }

      await loadUnits();
    } catch (error) {
      setSetupError(
        error instanceof Error ? error.message : "Gagal menyimpan pembagian unit."
      );
    } finally {
      setSetupSaving(false);
    }
  }

  if (!mounted || !open) return null;

  const isProfitPositive = profitBersih >= 0;

  const headerBadge =
    phase === "setup"
      ? "Setup Unit"
      : phase === "units"
      ? "Portofolio Unit"
      : phase === "decide"
      ? "Mulai Penjualan"
      : formReadOnly
      ? "Detail Realisasi"
      : "Realisasi Penjualan";

  const headerTitle =
    phase === "setup"
      ? "Bagi Project Menjadi Unit"
      : phase === "units"
      ? "Penjualan per Unit"
      : phase === "decide"
      ? "Catat Penjualan Properti"
      : phase === "loading" || phase === "error"
      ? "Penjualan Properti"
      : selectedUnit
      ? formReadOnly
        ? `Detail Penjualan — ${selectedUnit.nama_unit}`
        : isEditing
        ? `Edit Penjualan — ${selectedUnit.nama_unit}`
        : `Input Penjualan — ${selectedUnit.nama_unit}`
      : formReadOnly
      ? "Detail Penjualan Properti"
      : isEditing
      ? "Edit Penjualan Properti"
      : "Input Penjualan Properti";

  const unitsRemaining = unitsData
    ? unitsData.unit_count - unitsData.sold_count
    : 0;

  const modalNode = (
    <div className="fixed inset-0 z-[9999] bg-slate-950/78 backdrop-blur-md">
      <div className="flex h-screen w-screen items-center justify-center p-3 sm:p-4 lg:p-6">
        <div className="relative flex w-full max-w-7xl flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top,#101826_0%,#0b1220_34%,#060b14_100%)] text-white shadow-[0_24px_90px_rgba(0,0,0,0.5)] max-h-[calc(100vh-24px)] sm:max-h-[calc(100vh-32px)] lg:max-h-[calc(100vh-48px)] sm:rounded-[34px]">
          <div className="border-b border-white/10 bg-white/[0.03] px-5 py-4 sm:px-6 lg:px-8">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  <div className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
                    {headerBadge}
                  </div>

                  {unitsData?.has_units ? (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium text-cyan-200">
                      <Building2 className="h-3 w-3" />
                      {unitsData.sold_count}/{unitsData.unit_count} unit terjual
                    </div>
                  ) : null}

                  <div className="min-w-0 truncate text-sm font-medium text-slate-300 sm:text-base">
                    {project?.nama_project || "Project"}
                  </div>
                </div>

                <h2 className="mt-3 text-[28px] font-semibold leading-none tracking-tight sm:text-[30px]">
                  {headerTitle}
                </h2>
              </div>

              <button
                onClick={onClose}
                type="button"
                disabled={isSaving}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8">
            {phase === "loading" ? (
              <div className="flex min-h-[340px] items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-300" />
                  <span className="text-sm">Memuat data penjualan…</span>
                </div>
              </div>
            ) : phase === "error" ? (
              <div className="flex min-h-[340px] items-center justify-center">
                <div className="w-full max-w-md rounded-[28px] border border-rose-400/20 bg-rose-500/10 p-6 text-center">
                  <div className="text-sm leading-6 text-rose-200">
                    {unitsError || "Gagal memuat data unit."}
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadUnits()}
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Coba lagi
                  </button>
                </div>
              </div>
            ) : phase === "decide" ? (
              <div className="mx-auto max-w-3xl py-6">
                <div className="mb-8 text-center">
                  <div className="text-[11px] uppercase tracking-[0.26em] text-slate-500">
                    Langkah pertama
                  </div>
                  <h3 className="mt-3 text-2xl font-semibold text-white">
                    Properti ini dijual sebagai apa?
                  </h3>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
                    Pilihan ini menentukan cara pencatatan penjualan dan
                    distribusi ke investor. Pembagian unit terkunci setelah
                    penjualan pertama tercatat.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUnit(null);
                      setPhase("form");
                    }}
                    className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-6 text-left transition hover:border-emerald-300/30 hover:bg-emerald-400/[0.06]"
                  >
                    <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-emerald-400/10 blur-3xl" />
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-300">
                      <Home className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-lg font-semibold text-white">
                      Satu kesatuan
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Seluruh project terjual dalam satu transaksi. Modal dan
                      profit langsung dibagikan penuh ke investor.
                    </p>
                    <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-300">
                      Langsung input penjualan
                      <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPhase("setup")}
                    className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-6 text-left transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.06]"
                  >
                    <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl" />
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-300">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-lg font-semibold text-white">
                      Beberapa unit
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Misal 2 rumah jejer — tiap unit punya bobot biaya dan
                      dicatat terjual satu per satu, kapan pun lakunya.
                    </p>
                    <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-cyan-300">
                      Atur pembagian unit
                      <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </div>
                  </button>
                </div>
              </div>
            ) : phase === "setup" ? (
              <div className="mx-auto max-w-3xl py-2">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white">
                    Pembagian Unit Jual
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Bobot menentukan porsi biaya project yang dibebankan ke tiap
                    unit — total wajib 100%. Basis biaya dihitung otomatis dari
                    total biaya project.
                  </p>
                </div>

                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-slate-950/40 px-4 py-3.5">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      Total biaya project
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      {formatIDR(unitsData?.total_biaya_project ?? 0)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => splitEvenly(draftUnits.length)}
                      className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08]"
                    >
                      Bagi rata
                    </button>
                    <button
                      type="button"
                      disabled={draftUnits.length >= 12}
                      onClick={() =>
                        setDraftUnits((prev) => [
                          ...prev,
                          { nama: `Unit ${prev.length + 1}`, bobot: "0" },
                        ])
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Tambah unit
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {draftUnits.map((unit, index) => {
                    const bobotNum = toSafeNumber(unit.bobot);
                    const biayaPreview =
                      (bobotNum / 100) *
                      toSafeNumber(unitsData?.total_biaya_project);

                    return (
                      <div
                        key={index}
                        className="flex flex-wrap items-center gap-3 rounded-[22px] border border-white/10 bg-slate-950/40 p-3.5"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-semibold text-slate-300">
                          {index + 1}
                        </div>

                        <div className="min-w-[160px] flex-1">
                          <div className="mb-1 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                            Nama unit
                          </div>
                          <input
                            value={unit.nama}
                            onChange={(e) =>
                              setDraftUnits((prev) =>
                                prev.map((u, i) =>
                                  i === index ? { ...u, nama: e.target.value } : u
                                )
                              )
                            }
                            placeholder={`Unit ${index + 1}`}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400/40"
                          />
                        </div>

                        <div className="w-[110px]">
                          <div className="mb-1 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                            Bobot %
                          </div>
                          <input
                            inputMode="decimal"
                            value={unit.bobot}
                            onChange={(e) =>
                              setDraftUnits((prev) =>
                                prev.map((u, i) =>
                                  i === index
                                    ? { ...u, bobot: e.target.value }
                                    : u
                                )
                              )
                            }
                            placeholder="0"
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/40"
                          />
                        </div>

                        <div className="w-[150px] text-right">
                          <div className="mb-1 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                            Basis biaya
                          </div>
                          <div className="text-sm font-semibold text-white">
                            {formatIDR(biayaPreview)}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={draftUnits.length <= 2}
                          onClick={() =>
                            setDraftUnits((prev) =>
                              prev.filter((_, i) => i !== index)
                            )
                          }
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-400 transition hover:border-rose-300/25 hover:bg-rose-400/10 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div
                  className={`mt-5 flex items-center justify-between gap-4 rounded-[22px] border px-4 py-3.5 ${
                    Math.abs(draftTotalBobot - 100) <= 0.05
                      ? "border-emerald-300/20 bg-emerald-400/10"
                      : "border-amber-300/20 bg-amber-400/10"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {Math.abs(draftTotalBobot - 100) <= 0.05 ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                        <span className="text-emerald-200">
                          Total bobot pas 100%
                        </span>
                      </>
                    ) : (
                      <span className="text-amber-200">
                        Total bobot harus 100%
                      </span>
                    )}
                  </div>
                  <div
                    className={`text-lg font-semibold ${
                      Math.abs(draftTotalBobot - 100) <= 0.05
                        ? "text-emerald-300"
                        : "text-amber-300"
                    }`}
                  >
                    {draftTotalBobot.toLocaleString("id-ID", {
                      maximumFractionDigits: 2,
                    })}
                    %
                  </div>
                </div>

                {setupError ? (
                  <div className="mt-4 rounded-[20px] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {setupError}
                  </div>
                ) : null}
              </div>
            ) : phase === "units" ? (
              <div className="space-y-5">
                <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                        Progres penjualan
                      </div>
                      <div className="mt-1.5 text-2xl font-semibold text-white">
                        {unitsData?.sold_count ?? 0}
                        <span className="text-slate-500">
                          {" "}
                          / {unitsData?.unit_count ?? 0} unit terjual
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="rounded-[20px] border border-white/10 bg-slate-950/40 px-4 py-3 text-right">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                          Total biaya project
                        </div>
                        <div className="mt-1 text-sm font-semibold text-white">
                          {formatIDR(unitsData?.total_biaya_project ?? 0)}
                        </div>
                      </div>

                      {unitsData?.aggregate ? (
                        <>
                          <div className="rounded-[20px] border border-white/10 bg-slate-950/40 px-4 py-3 text-right">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                              Σ Harga jual
                            </div>
                            <div className="mt-1 text-sm font-semibold text-white">
                              {formatIDR(unitsData.aggregate.harga_jual)}
                            </div>
                          </div>
                          <div
                            className={`rounded-[20px] border px-4 py-3 text-right ${
                              unitsData.aggregate.profit_bersih >= 0
                                ? "border-emerald-300/20 bg-emerald-400/10"
                                : "border-rose-300/20 bg-rose-400/10"
                            }`}
                          >
                            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                              Σ Profit bersih
                            </div>
                            <div
                              className={`mt-1 text-sm font-semibold ${
                                unitsData.aggregate.profit_bersih >= 0
                                  ? "text-emerald-300"
                                  : "text-rose-300"
                              }`}
                            >
                              {formatIDR(unitsData.aggregate.profit_bersih)}
                            </div>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-300 transition-all duration-500"
                      style={{
                        width: `${
                          unitsData && unitsData.unit_count > 0
                            ? Math.min(
                                100,
                                (unitsData.sold_count / unitsData.unit_count) *
                                  100
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>

                  {unitsData && unitsData.sold_count === 0 && !readOnly ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDraftUnits(
                          unitsData.units.map((unit) => ({
                            nama: unit.nama_unit,
                            bobot: String(unit.bobot_persen),
                          }))
                        );
                        setSetupError("");
                        setPhase("setup");
                      }}
                      className="mt-4 text-xs font-medium text-cyan-300 transition hover:text-cyan-200"
                    >
                      Ubah pembagian unit →
                    </button>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {(unitsData?.units ?? []).map((unit) => (
                    <button
                      key={unit.id_project_unit}
                      type="button"
                      onClick={() => pickUnit(unit)}
                      className={`group relative overflow-hidden rounded-[28px] border p-5 text-left transition ${
                        unit.terjual
                          ? "border-emerald-300/20 bg-[linear-gradient(135deg,rgba(6,20,16,0.9),rgba(7,26,20,0.85))] hover:border-emerald-300/35"
                          : "border-white/10 bg-white/[0.04] hover:border-cyan-300/30 hover:bg-cyan-400/[0.05]"
                      }`}
                    >
                      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/6 blur-3xl" />

                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
                              unit.terjual
                                ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-300"
                                : "border-cyan-300/15 bg-cyan-400/10 text-cyan-300"
                            }`}
                          >
                            <Home className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-base font-semibold text-white">
                              {unit.nama_unit}
                            </div>
                            <div className="text-xs text-slate-400">
                              Bobot {unit.bobot_persen.toLocaleString("id-ID")}%
                              biaya project
                            </div>
                          </div>
                        </div>

                        <div
                          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                            unit.terjual
                              ? "border-emerald-300/25 bg-emerald-400/15 text-emerald-200"
                              : "border-white/10 bg-white/[0.05] text-slate-300"
                          }`}
                        >
                          {unit.terjual ? (
                            <>
                              <CheckCircle2 className="h-3 w-3" /> Terjual
                            </>
                          ) : (
                            "Tersedia"
                          )}
                        </div>
                      </div>

                      {unit.terjual && unit.sale ? (
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-white/[0.04] p-3">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                              Harga jual
                            </div>
                            <div className="mt-1 text-sm font-semibold text-white">
                              {formatIDR(unit.sale.harga_jual)}
                            </div>
                          </div>
                          <div className="rounded-xl bg-white/[0.04] p-3">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                              Profit bersih
                            </div>
                            <div
                              className={`mt-1 text-sm font-semibold ${
                                unit.sale.profit_bersih >= 0
                                  ? "text-emerald-300"
                                  : "text-rose-300"
                              }`}
                            >
                              {formatIDR(unit.sale.profit_bersih)}
                            </div>
                          </div>
                          <div className="col-span-2 flex items-center justify-between text-xs text-slate-400">
                            <span>
                              Terjual {formatDisplayDate(unit.sale.tanggal_terjual)}
                            </span>
                            <span className="inline-flex items-center gap-1 font-medium text-emerald-300">
                              Lihat detail
                              <ChevronRight className="h-3.5 w-3.5" />
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-white/[0.04] p-3">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                              Basis biaya
                            </div>
                            <div className="mt-1 text-sm font-semibold text-white">
                              {formatIDR(unit.biaya_unit)}
                            </div>
                          </div>
                          <div className="rounded-xl bg-white/[0.04] p-3">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                              Estimasi harga
                            </div>
                            <div className="mt-1 text-sm font-semibold text-white">
                              {unit.estimasi_harga_unit > 0
                                ? formatIDR(unit.estimasi_harga_unit)
                                : "—"}
                            </div>
                          </div>
                          {!readOnly ? (
                            <div className="col-span-2 flex items-center justify-end text-xs">
                              <span className="inline-flex items-center gap-1 font-medium text-cyan-300">
                                Catat penjualan
                                <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                              </span>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {selectedUnit ? (
                  <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[24px] border border-emerald-300/15 bg-emerald-400/[0.06] px-4 py-3.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-300">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white">
                        {selectedUnit.nama_unit}
                      </div>
                      <div className="text-xs text-slate-400">
                        Bobot {selectedUnit.bobot_persen.toLocaleString("id-ID")}
                        % · Basis biaya{" "}
                        {formatIDR(
                          selectedUnit.sale?.total_biaya_akuisisi ??
                            selectedUnit.biaya_unit
                        )}
                        {isFinalUnit
                          ? " · unit terakhir (menyerap sisa biaya)"
                          : ""}
                      </div>
                    </div>
                    {selectedUnit.terjual ? (
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/15 px-3 py-1 text-[11px] font-semibold text-emerald-200">
                        <CheckCircle2 className="h-3 w-3" />
                        Terjual
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.08fr_0.92fr]">
              <div className="space-y-6">
                <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                  <div className="mb-5">
                    <h3 className="text-lg font-semibold text-white">
                      Nilai Transaksi
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {formReadOnly
                        ? "Angka realisasi penjualan yang sudah tersimpan."
                        : "Tanggal jual dan nominal final akan langsung memengaruhi durasi, profit, dan ROI."}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300">
                        Mulai Project
                      </label>
                      <div className="rounded-[22px] border border-white/10 bg-slate-950/40 px-4 py-4">
                        <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                          Dari project.mulai_tanggal
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-400/10 text-cyan-300">
                            <CalendarDays className="h-4 w-4" />
                          </div>
                          <div className="text-base font-semibold text-white">
                            {formatDisplayDate(mulaiTanggal)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300">
                        Tanggal Terjual
                      </label>
                      <CalendarPicker
                        value={tanggalTerjual}
                        minDate={mulaiTanggal}
                        onChange={setTanggalTerjual}
                        disabled={formReadOnly}
                      />
                      {invalidTanggal ? (
                        <p className="mt-2 text-xs text-rose-300">
                          Tanggal terjual tidak boleh lebih awal dari mulai project.
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300">
                        Harga Jual Final
                      </label>
                      <div
                        className={`group rounded-[22px] border px-4 py-4 transition ${
                          formReadOnly
                            ? "border-white/8 bg-slate-950/25"
                            : "border-white/10 bg-slate-950/50 focus-within:border-emerald-400/40 focus-within:bg-slate-950"
                        }`}
                      >
                        <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                          Nilai penjualan
                        </div>
                        <input
                          inputMode="numeric"
                          disabled={formReadOnly}
                          value={hargaJualInput}
                          onChange={(e) =>
                            setHargaJualInput(
                              toInputCurrency(parseFormattedNumber(e.target.value))
                            )
                          }
                          placeholder="0"
                          className="w-full bg-transparent text-[28px] font-semibold leading-none text-white outline-none placeholder:text-slate-600 disabled:cursor-default"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300">
                        {selectedUnit ? "Biaya Akuisisi Unit" : "Total Biaya Akuisisi"}
                      </label>
                      <div
                        className={`group rounded-[22px] border px-4 py-4 transition ${
                          formReadOnly || selectedUnit
                            ? "border-white/8 bg-slate-950/25"
                            : "border-white/10 bg-slate-950/50 focus-within:border-cyan-400/40 focus-within:bg-slate-950"
                        }`}
                      >
                        <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                          {selectedUnit ? (
                            <>
                              <Lock className="h-3 w-3" />
                              Dihitung sistem — bobot × total biaya
                            </>
                          ) : (
                            "Modal proyek"
                          )}
                        </div>
                        <input
                          inputMode="numeric"
                          disabled={formReadOnly || Boolean(selectedUnit)}
                          value={totalBiayaAkuisisiInput}
                          onChange={(e) =>
                            setTotalBiayaAkuisisiInput(
                              toInputCurrency(parseFormattedNumber(e.target.value))
                            )
                          }
                          placeholder="0"
                          className="w-full bg-transparent text-[28px] font-semibold leading-none text-white outline-none placeholder:text-slate-600 disabled:cursor-default"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                  <div className="mb-5">
                    <h3 className="text-lg font-semibold text-white">
                      Komponen Biaya Penjualan
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {formReadOnly
                        ? "Komponen biaya saat realisasi penjualan disimpan."
                        : "Isi % untuk hitung otomatis dari harga jual — atau ketik nominal langsung bila dasar pajaknya (nilai akta) berbeda dari harga jual."}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {(
                      [
                        {
                          key: "pph",
                          label: "PPh",
                          icon: <Percent className="h-4 w-4 text-emerald-300" />,
                          focus: "focus:border-emerald-400/40",
                          pctValue: pphInput,
                          setPct: setPphInput,
                          nomValue: pphNominalInput,
                          setNom: setPphNominalInput,
                          mode: pphMode,
                          setMode: setPphMode,
                          nominal: pphNominal,
                        },
                        {
                          key: "ajb",
                          label: "AJB",
                          icon: <Percent className="h-4 w-4 text-cyan-300" />,
                          focus: "focus:border-cyan-400/40",
                          pctValue: ajbInput,
                          setPct: setAjbInput,
                          nomValue: ajbNominalInput,
                          setNom: setAjbNominalInput,
                          mode: ajbMode,
                          setMode: setAjbMode,
                          nominal: ajbNominal,
                        },
                        {
                          key: "agent_fee",
                          label: "Agent Fee",
                          icon: <Wallet className="h-4 w-4 text-violet-300" />,
                          focus: "focus:border-violet-400/40",
                          pctValue: agentFeeInput,
                          setPct: setAgentFeeInput,
                          nomValue: agentFeeNominalInput,
                          setNom: setAgentFeeNominalInput,
                          mode: agentFeeMode,
                          setMode: setAgentFeeMode,
                          nominal: agentFeeNominal,
                        },
                      ] as const
                    ).map((fee) => {
                      const isManual = fee.mode === "nominal";
                      const derivedPercent =
                        hargaJual > 0 ? (fee.nominal / hargaJual) * 100 : 0;

                      return (
                        <div
                          key={fee.key}
                          className={`rounded-[22px] border p-4 transition ${
                            isManual
                              ? "border-amber-300/25 bg-amber-400/[0.06]"
                              : "border-white/10 bg-slate-950/40"
                          }`}
                        >
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm text-slate-300">
                              {fee.icon}
                              {fee.label}
                            </div>
                            {isManual ? (
                              <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200">
                                Manual
                              </span>
                            ) : null}
                          </div>

                          <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                            Persen (%)
                          </div>
                          <input
                            type="text"
                            inputMode="decimal"
                            disabled={formReadOnly}
                            value={
                              isManual
                                ? derivedPercent.toLocaleString("id-ID", {
                                    maximumFractionDigits: 3,
                                  })
                                : fee.pctValue
                            }
                            onChange={(e) => {
                              // Mengetik % → kembali ke mode otomatis.
                              fee.setMode("percent");
                              fee.setNom("");
                              fee.setPct(e.target.value);
                            }}
                            placeholder="0"
                            className={`mb-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none transition placeholder:text-slate-500 disabled:cursor-default disabled:opacity-90 ${fee.focus} ${
                              isManual ? "opacity-70" : ""
                            } [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                          />

                          <div className="mb-1 flex items-center justify-between gap-2">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                              Nominal (Rp)
                            </div>
                            {isManual && !formReadOnly ? (
                              <button
                                type="button"
                                onClick={() => {
                                  fee.setMode("percent");
                                  fee.setNom("");
                                }}
                                className="text-[10px] font-medium text-cyan-300 transition hover:text-cyan-200"
                              >
                                Ikuti % lagi
                              </button>
                            ) : null}
                          </div>
                          <input
                            inputMode="numeric"
                            disabled={formReadOnly}
                            value={
                              isManual
                                ? fee.nomValue
                                : toInputCurrency(Math.round(fee.nominal))
                            }
                            onChange={(e) => {
                              // Mengetik nominal → override manual.
                              fee.setMode("nominal");
                              fee.setNom(
                                toInputCurrency(
                                  parseFormattedNumber(e.target.value)
                                )
                              );
                            }}
                            placeholder="0"
                            className={`w-full rounded-xl border px-3 py-2.5 text-lg font-semibold text-white outline-none transition placeholder:text-slate-500 disabled:cursor-default disabled:opacity-90 ${
                              isManual
                                ? "border-amber-300/30 bg-amber-400/[0.08] focus:border-amber-300/50"
                                : `border-white/10 bg-white/5 ${fee.focus}`
                            }`}
                          />

                          <div className="mt-2 text-[11px] leading-4 text-slate-500">
                            {isManual
                              ? `≈ ${derivedPercent.toLocaleString("id-ID", {
                                  maximumFractionDigits: 2,
                                })}% dari harga jual`
                              : "Otomatis: % × harga jual"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Distribusi Investor
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        {selectedUnit?.terjual && !isEditing
                          ? "Distribusi tersimpan saat unit ini terjual (snapshot)."
                          : selectedUnit
                          ? `Modal kembali ${
                              isFinalUnit
                                ? "= sisa setoran yang belum dikembalikan"
                                : `${selectedUnit.bobot_persen.toLocaleString(
                                    "id-ID"
                                  )}% dari setoran`
                            } + profit unit ini.`
                          : "Distribusi profit mengikuti proporsi modal disetor tiap investor."}
                      </p>
                    </div>

                    <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-right">
                      <div className="text-xs text-slate-400">Total Porsi</div>
                      <div className="text-sm font-semibold text-white">
                        {formatPercent(totalDistribusiPercent)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {distributions.length > 0 ? (
                      distributions.map((inv) => (
                        <div
                          key={inv.id_agent}
                          className="rounded-[22px] border border-white/10 bg-slate-950/40 p-4"
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              {inv.avatar ? (
                                <img
                                  src={inv.avatar}
                                  alt={inv.nama}
                                  className="h-11 w-11 rounded-full border border-white/10 object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-white">
                                  {getInitials(inv.nama)}
                                </div>
                              )}

                              <div className="min-w-0">
                                <div className="truncate text-base font-semibold text-white">
                                  {inv.nama}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {inv.id_agent}
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                              Porsi {formatPercent(inv.porsiPercent)}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div className="rounded-xl bg-white/[0.04] p-3">
                              <div className="text-xs text-slate-400">Modal</div>
                              <div className="mt-1 text-sm font-semibold text-white">
                                {formatIDR(inv.modal)}
                              </div>
                            </div>

                            <div className="rounded-xl bg-white/[0.04] p-3">
                              <div className="text-xs text-slate-400">
                                {profitBersih >= 0 ? "Profit" : "Porsi Kerugian"}
                              </div>
                              <div
                                className={`mt-1 text-sm font-semibold ${
                                  profitBersih >= 0 ? "text-emerald-300" : "text-rose-300"
                                }`}
                              >
                                {formatIDR(inv.profit)}
                              </div>
                            </div>

                            <div className="rounded-xl bg-white/[0.04] p-3">
                              <div className="text-xs text-slate-400">
                                Total Diterima
                              </div>
                              <div className="mt-1 text-sm font-semibold text-cyan-300">
                                {formatIDR(inv.totalDiterima)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[22px] border border-dashed border-white/10 bg-slate-950/30 p-5 text-sm text-slate-400">
                        Belum ada data investor pada project ini.
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                  <div className="mb-5">
                    <h3 className="text-lg font-semibold text-white">
                      Ringkasan Finansial
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Fokus hanya pada angka inti yang paling penting.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <SummaryMetric
                      label="Durasi Holding"
                      value={durasiLabel}
                      tone="cyan"
                      helper={`Dari ${formatDisplayDate(mulaiTanggal)} sampai ${formatDisplayDate(
                        tanggalTerjual
                      )}`}
                    />

                    <SummaryMetric
                      label="Profit Kotor"
                      value={formatIDR(profitKotor)}
                      tone={profitKotor >= 0 ? "default" : "negative"}
                    />

                    <SummaryMetric
                      label="Total Biaya Transaksi"
                      value={formatIDR(totalBiayaTransaksi)}
                      tone="warning"
                    />

                    <div
                      className={`rounded-[26px] border p-5 ${
                        isProfitPositive
                          ? "border-emerald-500/20 bg-emerald-500/10"
                          : "border-rose-500/20 bg-rose-500/10"
                      }`}
                    >
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">
                        Profit Bersih
                      </div>
                      <div
                        className={`mt-2 text-[34px] font-semibold leading-none tracking-tight ${
                          isProfitPositive ? "text-emerald-300" : "text-rose-300"
                        }`}
                      >
                        {formatIDR(profitBersih)}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        Hasil akhir setelah seluruh biaya transaksi dikurangkan dari
                        profit kotor.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-400/10 p-4">
                        <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-emerald-200/80">
                          <TrendingUp className="h-4 w-4" />
                          ROI Kotor
                        </div>
                        <div className="text-2xl font-semibold text-emerald-300">
                          {formatPercent(roiKotor)}
                        </div>
                        <p className="mt-2 text-xs leading-5 text-emerald-100/70">
                          Profit kotor dibanding total biaya akuisisi
                        </p>
                      </div>

                      <div className="rounded-[24px] border border-cyan-400/15 bg-cyan-400/10 p-4">
                        <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-cyan-200/80">
                          <TrendingUp className="h-4 w-4" />
                          ROI Bersih
                        </div>
                        <div className="text-2xl font-semibold text-cyan-300">
                          {formatPercent(roiBersih)}
                        </div>
                        <p className="mt-2 text-xs leading-5 text-cyan-100/70">
                          Profit bersih dibanding total biaya akuisisi
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                      <div className="mb-3 text-sm font-medium text-white">
                        Validasi Cepat
                      </div>
                      <div className="space-y-2 text-sm text-slate-400">
                        <div className="flex items-center justify-between gap-4">
                          <span>Total distribusi profit</span>
                          <span className="font-medium text-slate-200">
                            {formatIDR(totalDistribusiProfit)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Total porsi investor</span>
                          <span className="font-medium text-slate-200">
                            {formatPercent(totalDistribusiPercent)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Durasi (hari)</span>
                          <span className="font-medium text-slate-200">
                            {durasiHari > 0 ? `${durasiHari} hari` : "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
              </>
            )}
          </div>

          <div className="border-t border-white/10 bg-slate-950/80 px-5 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                {phase === "form" && unitsData?.has_units ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUnit(null);
                      setIsEditing(false);
                      setPhase("units");
                    }}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Pilih Unit
                  </button>
                ) : phase === "setup" ? (
                  <button
                    type="button"
                    onClick={() => setPhase(unitsData?.has_units ? "units" : "decide")}
                    disabled={setupSaving}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Kembali
                  </button>
                ) : null}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving || setupSaving}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {phase === "form" && !formReadOnly ? "Batal" : "Tutup"}
                </button>

                {phase === "setup" ? (
                  <button
                    type="button"
                    onClick={handleSaveSetup}
                    disabled={!draftValid || setupSaving}
                    className="inline-flex min-w-[190px] items-center justify-center rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {setupSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      `Simpan ${draftUnits.length} Unit`
                    )}
                  </button>
                ) : null}

                {phase === "form" && formReadOnly ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="inline-flex min-w-[150px] items-center justify-center gap-2 rounded-2xl border border-amber-300/25 bg-amber-400/10 px-5 py-3 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/20"
                  >
                    Edit Data Penjualan
                  </button>
                ) : null}

                {phase === "form" && !formReadOnly ? (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSaving || invalidTanggal}
                    className="inline-flex min-w-[170px] items-center justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isEditing ? (
                      "Simpan Perubahan"
                    ) : selectedUnit ? (
                      `Simpan Penjualan ${selectedUnit.nama_unit}`
                    ) : (
                      "Simpan Penjualan"
                    )}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
}
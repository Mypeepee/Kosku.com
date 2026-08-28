"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Info,
  Minus,
  NotebookPen,
  Plus,
} from "lucide-react";
import {
  planExpense,
  stateWithoutRow,
  type FundState,
} from "@/lib/project-kas";
import type {
  DbCashflow,
  InvestorSummary,
  WalletKey,
  WalletSummary,
} from "../types";
import { formatCurrency } from "../lib/format-currency";
import WalletDropdown from "./wallet-dropdown";
import DatePickerModal, {
  formatDatePretty,
  normalizeDateValue,
  shiftIso,
  todayIso,
} from "./date-picker-modal";
import {
  defaultKategori,
  kategoriLabel,
  kategoriOptions,
} from "./cashflow-categories";

type Jenis = "pemasukan" | "pengeluaran";

type FormErrors = Partial<
  Record<"nominal" | "judul" | "tanggal" | "investor", string>
>;

type CashflowQuickFormProps = {
  idProject: string;
  /** Seluruh angka kas & anggaran — dari mesin `@/lib/project-kas`. */
  fund: FundState;
  wallets: WalletSummary[];
  investors: InvestorSummary[];
  defaultWallet?: WalletKey;
  editingTransaction?: DbCashflow | null;
  onSubmitted?: () => void;
  onPendingChange?: (pending: boolean) => void;
  submitUrl?: string;
  formId?: string;
};

const QUICK_AMOUNTS = [
  { label: "+50rb", value: 50_000 },
  { label: "+100rb", value: 100_000 },
  { label: "+500rb", value: 500_000 },
  { label: "+1jt", value: 1_000_000 },
  { label: "+10jt", value: 10_000_000 },
];

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatDigitsId(value: string) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  return new Intl.NumberFormat("id-ID").format(numeric);
}

function normalizeJenis(value?: string | null): Jenis {
  if (value === "masuk" || value === "pemasukan") return "pemasukan";
  return "pengeluaran";
}

/** Dropdown ringkas untuk kategori. */
function KategoriDropdown({
  jenis,
  value,
  onChange,
  disabled,
}: {
  jenis: Jenis;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const options = kategoriOptions(jenis);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={[
          "flex h-14 w-full items-center justify-between gap-3 rounded-[18px] border px-4 text-left transition",
          "disabled:cursor-not-allowed disabled:opacity-60",
          open
            ? "border-cyan-300/40 bg-cyan-400/[0.07]"
            : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]",
        ].join(" ")}
      >
        <span className="truncate text-sm text-white">
          {kategoriLabel(value)}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div className="absolute inset-x-0 top-full z-[110] mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#0a1120] shadow-[0_24px_64px_rgba(0,0,0,0.6)]">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={[
                "flex w-full items-center justify-between gap-3 px-4 py-3 text-sm transition",
                option.value === value
                  ? "bg-white/[0.07] text-white"
                  : "text-slate-300 hover:bg-white/[0.04]",
              ].join(" ")}
            >
              <span className="text-left">{option.label}</span>
              {option.value === value ? (
                <Check className="h-4 w-4 shrink-0 text-cyan-300" />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function CashflowQuickForm({
  idProject,
  fund,
  wallets,
  investors,
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
  const [showCatatan, setShowCatatan] = useState(false);

  const editingId = String(editingTransaction?.id_project_arus_kas ?? "").trim();
  const isEditing = Boolean(editingId);

  const [jenis, setJenis] = useState<Jenis>(() =>
    normalizeJenis(editingTransaction?.jenis_transaksi)
  );
  const [walletKey, setWalletKey] = useState<WalletKey>(
    () =>
      (editingTransaction?.wallet_key as WalletKey) ??
      defaultWallet ??
      wallets?.[0]?.walletKey ??
      "utama"
  );
  const [kategori, setKategori] = useState(
    () =>
      editingTransaction?.kategori_transaksi ??
      defaultKategori(
        (editingTransaction?.wallet_key as WalletKey) ??
          defaultWallet ??
          "utama",
        normalizeJenis(editingTransaction?.jenis_transaksi)
      )
  );
  const [nominalInput, setNominalInput] = useState(() =>
    editingTransaction ? onlyDigits(String(Number(editingTransaction.nominal ?? 0))) : ""
  );
  const [judulTransaksi, setJudulTransaksi] = useState(
    () => editingTransaction?.judul_transaksi ?? ""
  );
  const [tanggalTransaksi, setTanggalTransaksi] = useState(() =>
    editingTransaction
      ? normalizeDateValue(editingTransaction.tanggal_transaksi)
      : todayIso()
  );
  const [catatan, setCatatan] = useState(
    () => editingTransaction?.catatan ?? ""
  );

  const [selectedInvestorId, setSelectedInvestorId] = useState<string | null>(
    () => (investors.length === 1 ? investors[0].id_project_investor : null)
  );

  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    onPendingChange?.(isSubmitting);
  }, [isSubmitting, onPendingChange]);

  // Sinkronkan form saat transaksi yang diedit berganti.
  useEffect(() => {
    const nextJenis = normalizeJenis(editingTransaction?.jenis_transaksi);
    const nextWallet =
      (editingTransaction?.wallet_key as WalletKey) ??
      defaultWallet ??
      wallets?.[0]?.walletKey ??
      "utama";

    setJenis(nextJenis);
    setWalletKey(nextWallet);
    setKategori(
      editingTransaction?.kategori_transaksi ??
        defaultKategori(nextWallet, nextJenis)
    );
    setNominalInput(
      editingTransaction
        ? onlyDigits(String(Number(editingTransaction.nominal ?? 0)))
        : ""
    );
    setJudulTransaksi(editingTransaction?.judul_transaksi ?? "");
    setTanggalTransaksi(
      editingTransaction
        ? normalizeDateValue(editingTransaction.tanggal_transaksi)
        : todayIso()
    );
    setCatatan(editingTransaction?.catatan ?? "");
    setShowCatatan(Boolean(editingTransaction?.catatan));
    setSelectedInvestorId(
      investors.length === 1 ? investors[0].id_project_investor : null
    );
    setErrors({});
    setServerError("");
    setSuccessMessage("");
  }, [editingTransaction, defaultWallet, wallets, investors]);

  const nominalValue = useMemo(
    () => Number(onlyDigits(nominalInput) || 0),
    [nominalInput]
  );

  const isExpense = jenis === "pengeluaran";

  // Saat mengedit, efek baris lama dilepas dulu supaya pratinjau menghitung
  // "seolah transaksi ini belum pernah ada" — sama seperti yang dilakukan
  // server sebelum memvalidasi.
  const baseState = useMemo(
    () => (isEditing ? stateWithoutRow(fund, editingTransaction ?? null) : fund),
    [fund, isEditing, editingTransaction]
  );

  const selectedWallet =
    baseState.pos.find((item) => item.walletKey === walletKey) ??
    baseState.pos[0];

  // Rumus yang sama persis dipakai server (@/lib/project-kas).
  const plan = useMemo(
    () =>
      planExpense({
        state: baseState,
        walletKey,
        nominal: isExpense ? nominalValue : 0,
      }),
    [baseState, walletKey, nominalValue, isExpense]
  );

  const needsCover = isExpense && plan.butuhTalangan && nominalValue > 0;
  // Edit tidak menyediakan talangan otomatis — server menolaknya.
  const coverBlockedByEdit = needsCover && isEditing;

  const selectedInvestor =
    investors.find(
      (item) => item.id_project_investor === selectedInvestorId
    ) ?? null;

  const sisaAnggaranSetelah = isExpense
    ? plan.sisaAnggaranPosSetelah
    : selectedWallet
      ? selectedWallet.sisaAnggaran + (kategori === "refund" ? nominalValue : 0)
      : 0;

  function handleJenisChange(next: Jenis) {
    if (isSubmitting || next === jenis) return;
    setJenis(next);
    setKategori(defaultKategori(walletKey, next));
    setErrors({});
    setServerError("");
  }

  function handleWalletChange(next: WalletKey) {
    if (isSubmitting) return;
    setWalletKey(next);
    // Kategori mengikuti pos supaya user tak perlu memilih dua kali.
    setKategori(defaultKategori(next, jenis));
    setErrors((prev) => ({ ...prev, investor: undefined }));
    setServerError("");
  }

  function addAmount(amount: number) {
    if (isSubmitting) return;
    setNominalInput(String(nominalValue + amount));
    setErrors((prev) => ({ ...prev, nominal: undefined }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    setServerError("");
    setSuccessMessage("");

    const nextErrors: FormErrors = {};

    if (!Number.isFinite(nominalValue) || nominalValue <= 0) {
      nextErrors.nominal = "Masukkan nominal transaksi.";
    }

    if (!judulTransaksi.trim()) {
      nextErrors.judul = "Judul transaksi wajib diisi.";
    }

    if (!tanggalTransaksi) {
      nextErrors.tanggal = "Tanggal transaksi wajib diisi.";
    }

    if (needsCover && !isEditing && !selectedInvestorId) {
      nextErrors.investor = "Pilih investor yang menanggung kekurangan ini.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    if (coverBlockedByEdit) {
      setServerError(
        "Nominal ini melebihi dana yang tersedia. Hapus transaksi ini lalu catat ulang supaya kekurangannya bisa ditalangi investor."
      );
      return;
    }

    const requestUrl = isEditing
      ? `/api/project/catat_arus_kas/${editingId}`
      : submitUrl;

    if (!requestUrl) {
      setServerError("Endpoint penyimpanan belum dihubungkan.");
      return;
    }

    const payload = {
      id_project: idProject,
      wallet_key: walletKey,
      jenis_transaksi: jenis,
      kategori_transaksi: kategori,
      nominal: nominalValue,
      judul_transaksi: judulTransaksi.trim(),
      tanggal_transaksi: tanggalTransaksi,
      catatan: catatan.trim() || null,
      status_transaksi: editingTransaction?.status_transaksi ?? "tercatat",

      // Server menghitung ulang besaran talangannya; ini hanya menyatakan
      // siapa penanggungnya.
      auto_cover_deficit: needsCover && !isEditing,
      investor_penanggung: selectedInvestor
        ? {
            id_project_investor: selectedInvestor.id_project_investor,
            id_agent: selectedInvestor.id_agent,
            nama: selectedInvestor.nama,
          }
        : null,
    };

    setIsSubmitting(true);

    try {
      const response = await fetch(requestUrl, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
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
      router.refresh();
      onSubmitted?.();
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat menyimpan transaksi."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const fieldLabel =
    "text-[11px] font-medium uppercase tracking-[0.18em] text-white/40";

  return (
    <>
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        {/* 1 ── Dompet: keputusan pertama, dropdown supaya hemat ruang */}
        <div className="space-y-2">
          <label className={fieldLabel}>Dompet</label>
          <WalletDropdown
            value={walletKey}
            onChange={(next) => handleWalletChange(next as WalletKey)}
            wallets={wallets}
            includeAll={false}
            variant="field"
            disabled={isSubmitting}
          />
        </div>

        {/* 2 ── Arah uang: keluar atau masuk */}
        <div className="grid grid-cols-2 gap-2 rounded-[20px] border border-white/10 bg-white/[0.03] p-1.5">
          {(
            [
              {
                key: "pengeluaran" as const,
                label: "Uang keluar",
                Icon: Minus,
                active:
                  "border-rose-300/35 bg-rose-400/[0.12] text-rose-100",
              },
              {
                key: "pemasukan" as const,
                label: "Uang masuk",
                Icon: Plus,
                active:
                  "border-emerald-300/35 bg-emerald-400/[0.12] text-emerald-100",
              },
            ] as const
          ).map(({ key, label, Icon, active }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleJenisChange(key)}
              disabled={isSubmitting}
              className={[
                "flex h-12 items-center justify-center gap-2 rounded-[15px] border text-sm font-medium transition",
                "disabled:cursor-not-allowed disabled:opacity-60",
                jenis === key
                  ? active
                  : "border-transparent text-slate-400 hover:bg-white/[0.04]",
              ].join(" ")}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>

        {/* 3 ── Nominal */}
        <div className="space-y-2">
          <label className={fieldLabel}>Nominal</label>

          <div
            className={[
              "rounded-[22px] border bg-[#07111d] p-4 transition sm:p-5",
              errors.nominal ? "border-rose-400/40" : "border-white/10",
            ].join(" ")}
          >
            <div className="flex items-center gap-3">
              <span
                className={[
                  "text-2xl font-semibold",
                  isExpense ? "text-rose-300/80" : "text-emerald-300/80",
                ].join(" ")}
              >
                {isExpense ? "−" : "+"}
              </span>
              <span className="text-xl font-semibold text-white/60 sm:text-2xl">
                Rp
              </span>
              <input
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                value={formatDigitsId(nominalInput)}
                onChange={(event) => {
                  setNominalInput(onlyDigits(event.target.value));
                  setErrors((prev) => ({ ...prev, nominal: undefined }));
                }}
                disabled={isSubmitting}
                className="w-full bg-transparent text-3xl font-semibold tabular-nums tracking-tight text-white outline-none placeholder:text-white/20 disabled:cursor-not-allowed disabled:opacity-60 sm:text-4xl"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => addAmount(item.value)}
                  disabled={isSubmitting}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-50"
                >
                  {item.label}
                </button>
              ))}

              {nominalValue > 0 ? (
                <button
                  type="button"
                  onClick={() => setNominalInput("")}
                  disabled={isSubmitting}
                  className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs text-slate-400 transition hover:bg-white/[0.06] disabled:opacity-50"
                >
                  Hapus
                </button>
              ) : null}

              {isExpense &&
              selectedWallet &&
              selectedWallet.sisaAnggaran > 0 &&
              nominalValue !== Math.round(selectedWallet.sisaAnggaran) ? (
                <button
                  type="button"
                  onClick={() =>
                    setNominalInput(
                      String(Math.round(selectedWallet.sisaAnggaran))
                    )
                  }
                  disabled={isSubmitting}
                  className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-400/15 disabled:opacity-50"
                >
                  Pakai seluruh saldo
                </button>
              ) : null}
            </div>
          </div>

          {errors.nominal ? (
            <div className="text-sm text-rose-300">{errors.nominal}</div>
          ) : null}
        </div>

        {/* 4 ── Dampak ke saldo dompet: satu baris, tak perlu buka layar lain */}
        {nominalValue > 0 ? (
          <div className="flex items-center justify-between gap-4 rounded-[20px] border border-white/[0.08] bg-white/[0.02] px-4 py-3">
            <span className="text-sm text-slate-400">
              Saldo {selectedWallet?.title ?? "dompet"} setelah ini
            </span>
            <span
              className={[
                "text-sm font-semibold tabular-nums",
                sisaAnggaranSetelah < 0 ? "text-amber-300" : "text-white/85",
              ].join(" ")}
            >
              {formatCurrency(sisaAnggaranSetelah)}
            </span>
          </div>
        ) : null}

        {/* 5 ── Talangan investor saat dana kurang */}
        {needsCover ? (
          <section className="rounded-[24px] border border-amber-300/20 bg-[linear-gradient(180deg,rgba(251,191,36,0.09),rgba(255,255,255,0.02))] p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-amber-300/20 bg-amber-400/10 text-amber-200">
                <AlertTriangle className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <h3 className="text-base font-semibold text-white">
                  Dana kurang {formatCurrency(plan.totalDibebankan)}
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  {plan.tambahanAnggaran > 0
                    ? `Saldo ${selectedWallet?.title} tinggal ${formatCurrency(
                        plan.sisaAnggaranPos
                      )}.`
                    : `Saldo ${selectedWallet?.title} masih cukup, tapi modal investor yang masuk baru ${formatCurrency(
                        plan.sisaKas
                      )}.`}{" "}
                  Kekurangannya dibebankan ke investor dan otomatis menambah
                  modal disetor serta porsi kepemilikannya.
                </p>

                {plan.tambahanAnggaran > 0 && plan.tambahanKas > 0 ? (
                  <div className="mt-3 space-y-1 rounded-[14px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs leading-5 text-slate-400">
                    <div className="flex items-center justify-between gap-3">
                      <span>Tambah saldo {selectedWallet?.title}</span>
                      <span className="tabular-nums text-amber-200">
                        {formatCurrency(plan.tambahanAnggaran)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Setoran modal investor</span>
                      <span className="tabular-nums text-amber-200">
                        {formatCurrency(plan.tambahanKas)}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {coverBlockedByEdit ? (
              <div className="mt-4 rounded-[16px] border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-100">
                Talangan tidak bisa dibuat lewat edit. Hapus transaksi ini lalu
                catat ulang.
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                <div className={fieldLabel}>
                  {investors.length === 1
                    ? "Ditanggung oleh"
                    : "Pilih investor penanggung"}
                </div>

                {investors.length === 0 ? (
                  <div className="rounded-[16px] border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-100">
                    Project ini belum punya investor, jadi kekurangan dana belum
                    bisa ditalangi.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {investors.map((investor) => {
                      const active =
                        investor.id_project_investor === selectedInvestorId;
                      const modalSetelah =
                        investor.disetor + plan.totalDibebankan;

                      return (
                        <button
                          key={investor.id_project_investor}
                          type="button"
                          onClick={() => {
                            setSelectedInvestorId(
                              investor.id_project_investor
                            );
                            setErrors((prev) => ({
                              ...prev,
                              investor: undefined,
                            }));
                          }}
                          disabled={isSubmitting}
                          className={[
                            "flex w-full items-center gap-3 rounded-[18px] border p-3 text-left transition",
                            "disabled:cursor-not-allowed disabled:opacity-60",
                            active
                              ? "border-amber-300/40 bg-amber-400/[0.10]"
                              : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]",
                          ].join(" ")}
                        >
                          {investor.foto_profil_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={investor.foto_profil_url}
                              alt={investor.nama}
                              className="h-10 w-10 shrink-0 rounded-[14px] object-cover ring-1 ring-white/10"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.05] text-sm font-bold text-white">
                              {investor.nama.slice(0, 1).toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-white">
                              {investor.nama}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-slate-400">
                              Modal {formatCurrency(investor.disetor)} →{" "}
                              <span className="text-amber-200">
                                {formatCurrency(modalSetelah)}
                              </span>
                            </div>
                          </div>

                          {active ? (
                            <Check className="h-4 w-4 shrink-0 text-amber-300" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}

                {errors.investor ? (
                  <div className="text-sm text-rose-300">{errors.investor}</div>
                ) : null}
              </div>
            )}
          </section>
        ) : null}

        {/* 6 ── Detail transaksi */}
        <div className="space-y-2">
          <label className={fieldLabel}>Judul transaksi</label>
          <input
            type="text"
            placeholder={
              isExpense ? "Contoh: Bayar balik nama" : "Contoh: Refund notaris"
            }
            value={judulTransaksi}
            onChange={(event) => {
              setJudulTransaksi(event.target.value);
              setErrors((prev) => ({ ...prev, judul: undefined }));
            }}
            disabled={isSubmitting}
            className={[
              "h-14 w-full rounded-[18px] border bg-white/[0.03] px-4 text-base text-white outline-none transition",
              "placeholder:text-white/25 focus:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60",
              errors.judul
                ? "border-rose-400/40"
                : "border-white/10 focus:border-cyan-300/35",
            ].join(" ")}
          />
          {errors.judul ? (
            <div className="text-sm text-rose-300">{errors.judul}</div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className={fieldLabel}>Kategori</label>
            <KategoriDropdown
              jenis={jenis}
              value={kategori}
              onChange={setKategori}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <label className={fieldLabel}>Tanggal</label>
            <button
              type="button"
              onClick={() => !isSubmitting && setIsCalendarOpen(true)}
              disabled={isSubmitting}
              className="flex h-14 w-full items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.03] px-4 text-left transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex min-w-0 items-center gap-3">
                <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="truncate text-sm text-white">
                  {formatDatePretty(tanggalTransaksi)}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
            </button>

            <div className="flex gap-2">
              {[
                { label: "Hari ini", value: todayIso() },
                { label: "Kemarin", value: shiftIso(-1) },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setTanggalTransaksi(item.value)}
                  disabled={isSubmitting}
                  className={[
                    "rounded-full border px-3 py-1 text-xs transition disabled:opacity-50",
                    tanggalTransaksi === item.value
                      ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-200"
                      : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]",
                  ].join(" ")}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 7 ── Catatan: disembunyikan supaya form tidak terasa panjang */}
        {showCatatan ? (
          <div className="space-y-2">
            <label className={fieldLabel}>Catatan</label>
            <textarea
              rows={3}
              value={catatan}
              onChange={(event) => setCatatan(event.target.value)}
              disabled={isSubmitting}
              autoFocus
              placeholder="Konteks singkat supaya riwayat mudah dipahami."
              className="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/35 focus:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowCatatan(true)}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/[0.06] disabled:opacity-50"
          >
            <NotebookPen className="h-3.5 w-3.5 shrink-0" />
            Tambah catatan
          </button>
        )}

        {jenis === "pemasukan" && kategori === "refund" ? (
          <div className="flex items-start gap-2 rounded-[18px] border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-xs leading-5 text-slate-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Refund mengembalikan saldo {selectedWallet?.title}, jadi dompet
              ini bisa dipakai belanja lagi.
            </span>
          </div>
        ) : null}

        {serverError ? (
          <div className="rounded-[18px] border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-100">
            {serverError}
          </div>
        ) : null}

        {successMessage ? (
          <div className="inline-flex items-center gap-2 rounded-[18px] border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {successMessage}
          </div>
        ) : null}
      </form>

      <DatePickerModal
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

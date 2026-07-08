"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Loader2, X } from "lucide-react";
import type {
  CreateProjectFormValues,
  ListingApiResponse,
  ListingOption,
  ModalTierTheme,
  WizardStep,
} from "./types";
import { getInitialForm, getListingIdForProject } from "./utils";

export type AddProjectModalMode = "create" | "edit";
import StepOneProperty from "./components/step1/StepOneProperty";
import PropertyValueStep from "./components/step2/PropertyValueStep";
import FundingInvestorStep from "./components/step3/FundingInvestorStep";
import SummaryPanel from "./components/step1/SummaryPanel";

export type {
  CreateProjectFormValues,
  ListingOption,
  ModalTierTheme,
} from "./types";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CreateProjectFormValues) => void | Promise<void>;
  loading?: boolean;
  theme: ModalTierTheme;
  createdById?: string;
  mode?: AddProjectModalMode;
  initialValues?: CreateProjectFormValues | null;
  initialListingSnapshot?: ListingOption | null;
};

const LISTING_PAGE_SIZE = 8;

export default function AddProjectModal({
  open,
  onClose,
  onSubmit,
  loading = false,
  theme,
  createdById,
  mode = "create",
  initialValues = null,
  initialListingSnapshot = null,
}: Props) {
  const isEdit = mode === "edit";

  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [form, setForm] = useState<CreateProjectFormValues>(() =>
    isEdit && initialValues ? initialValues : getInitialForm(createdById)
  );

  const [listingQuery, setListingQuery] = useState("");
  const [listingResults, setListingResults] = useState<ListingOption[]>([]);
  const [selectedListingSnapshot, setSelectedListingSnapshot] =
    useState<ListingOption | null>(
      isEdit ? initialListingSnapshot ?? null : null
    );
  const [listingLoading, setListingLoading] = useState(false);
  const [listingError, setListingError] = useState("");
  const [listingLimit, setListingLimit] = useState(LISTING_PAGE_SIZE);

  const contentScrollRef = useRef<HTMLDivElement | null>(null);

  // Keep the latest seed values in refs so the "reset on open" effect can read
  // them without re-running (and wiping the user's edits) when they change.
  const seedRef = useRef({ isEdit, initialValues, initialListingSnapshot });
  seedRef.current = { isEdit, initialValues, initialListingSnapshot };

  useEffect(() => {
    setMounted(true);
  }, []);

  // reset form hanya saat modal dibuka
  useEffect(() => {
    if (!open) return;

    const seed = seedRef.current;

    setStep(1);
    setForm(
      seed.isEdit && seed.initialValues
        ? seed.initialValues
        : getInitialForm(createdById)
    );
    setListingQuery("");
    setListingResults([]);
    setSelectedListingSnapshot(
      seed.isEdit ? seed.initialListingSnapshot ?? null : null
    );
    setListingError("");
    setListingLimit(LISTING_PAGE_SIZE);
  }, [open, createdById]);

  // paksa scroll ke atas setiap pindah step
  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      contentScrollRef.current?.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [step, open]);

  // lock body scroll saat modal open
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // escape handler dipisah, jadi tidak reset form
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, loading, onClose]);

  useEffect(() => {
    if (!open || step !== 1) return;
    setListingLimit(LISTING_PAGE_SIZE);
  }, [listingQuery, open, step]);

  useEffect(() => {
    if (!open || step !== 1) return;

    const controller = new AbortController();

    const timeout = setTimeout(async () => {
      try {
        setListingLoading(true);
        setListingError("");

        const params = new URLSearchParams();
        if (listingQuery.trim()) params.set("q", listingQuery.trim());
        params.set("limit", String(listingLimit));

        const response = await fetch(`/api/project/modal?${params.toString()}`, {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
        });

        const result: ListingApiResponse = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Gagal mengambil data listing.");
        }

        setListingResults(Array.isArray(result.data) ? result.data : []);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;

        setListingResults([]);
        setListingError(
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat mengambil listing."
        );
      } finally {
        setListingLoading(false);
      }
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [open, step, listingQuery, listingLimit]);

  const selectedListing = useMemo(() => {
    const selectedId = String(form.id_listing ?? "");

    if (
      selectedListingSnapshot &&
      getListingIdForProject(selectedListingSnapshot) === selectedId
    ) {
      return selectedListingSnapshot;
    }

    return (
      listingResults.find(
        (item) => getListingIdForProject(item) === selectedId
      ) ?? null
    );
  }, [listingResults, selectedListingSnapshot, form.id_listing]);

  const hasMoreListings = listingResults.length >= listingLimit;

  const hargaPembelianComputed =
    Number(form.nilai_limit_lelang || 0) +
    Number(form.spare_bidding || 0) +
    Number(form.biaya_balik_nama || 0) +
    Number(form.biaya_eksekusi || 0) +
    Number(form.biaya_renov || 0);

  const profitComputed =
    Number(form.estimasi_harga_jual || 0) - Number(hargaPembelianComputed || 0);

  const roiPercent =
    hargaPembelianComputed > 0
      ? (profitComputed / hargaPembelianComputed) * 100
      : 0;

  const trimmedTitle = (form.nama_project || "").trim();
  const trimmedDescription = (form.deskripsi_project || "").trim();

  const stepOneIssues = useMemo(() => {
    const issues: string[] = [];

    if (!form.id_listing) issues.push("Pilih property terlebih dahulu.");
    if (!form.tanggal_pembelian) {
      issues.push("Tanggal pembelian project wajib dipilih.");
    }
    if (trimmedTitle.length <= 4) issues.push("Judul project minimal 5 karakter.");
    if (trimmedDescription.length <= 10) {
      issues.push("Deskripsi project minimal 11 karakter.");
    }

    return issues;
  }, [
    form.id_listing,
    form.tanggal_pembelian,
    trimmedTitle,
    trimmedDescription,
  ]);

  const stepOneValid = stepOneIssues.length === 0;

  const stepTwoIssues = useMemo(() => {
    const issues: string[] = [];

    if (Number(form.nilai_limit_lelang || 0) <= 0) {
      issues.push("Nilai property belum valid.");
    }

    if (Number(form.target_pendanaan || 0) <= 0) {
      issues.push("Target pendanaan belum diisi.");
    }

    if (Number(form.estimasi_harga_jual || 0) <= 0) {
      issues.push("Estimasi harga jual belum diisi.");
    }

    if (Number(form.estimasi_bulan || 0) <= 0) {
      issues.push("Estimasi bulan belum diisi.");
    }

    return issues;
  }, [
    form.nilai_limit_lelang,
    form.target_pendanaan,
    form.estimasi_harga_jual,
    form.estimasi_bulan,
  ]);

  const stepTwoValid = stepTwoIssues.length === 0;

  const stepThreeIssues = useMemo(() => {
    const issues: string[] = [];
    const cleanInvestorIds = (form.invitedInvestorIds || []).filter((id) =>
      String(id || "").trim()
    );

    if (form.jenis_pendanaan === "tertutup" && cleanInvestorIds.length === 0) {
      issues.push("Pendanaan tertutup wajib memilih minimal 1 investor.");
    }

    return issues;
  }, [form.jenis_pendanaan, form.invitedInvestorIds]);

  const stepThreeValid = stepThreeIssues.length === 0;
  const canSubmit = stepOneValid && stepTwoValid && stepThreeValid;

  const inputClassName = `h-12 w-full rounded-2xl border px-4 text-sm text-white outline-none transition placeholder:text-slate-500 ${theme.modalField} ${theme.modalFieldFocus}`;
  const textareaClassName = `w-full rounded-2xl border px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 ${theme.modalField} ${theme.modalFieldFocus}`;

  function updateField<K extends keyof CreateProjectFormValues>(
    key: K,
    value: CreateProjectFormValues[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function selectListing(item: ListingOption) {
    const autoAddress =
      item.alamat_property ||
      item.alamat_lengkap ||
      `Property #${item.id_listing}`;

    const baseValue =
      item.jenis_transaksi === "LELANG"
        ? Number(item.nilai_limit_lelang ?? 0)
        : Number(
            item.harga_promo && Number(item.harga_promo) > 0
              ? item.harga_promo
              : item.harga ?? 0
          );

    setSelectedListingSnapshot(item);

    setForm((prev) => ({
      ...prev,
      id_listing: getListingIdForProject(item),
      alamat_property: autoAddress,
      provinsi: item.provinsi ?? "",
      kota: item.kota ?? "",
      kecamatan: item.kecamatan ?? "",
      kelurahan: item.kelurahan ?? "",
      gambar_thumbnail: item.gambar_thumbnail || item.gambar || "",
      nilai_limit_lelang: baseValue,
      spare_bidding:
        item.jenis_transaksi === "LELANG" ? prev.spare_bidding || 0 : 0,
      dibuat_oleh: prev.dibuat_oleh || createdById || "",
    }));
  }

  function handleLoadMore() {
    if (listingLoading || !hasMoreListings) return;
    setListingLimit((prev) => prev + LISTING_PAGE_SIZE);
  }

  function handleNext(event?: React.MouseEvent<HTMLButtonElement>) {
    event?.preventDefault();
    event?.stopPropagation();

    if (loading) return;

    if (step === 1 && stepOneValid) {
      setStep(2);
      return;
    }

    if (step === 2 && stepTwoValid) {
      setStep(3);
    }
  }

  function handleBack(event?: React.MouseEvent<HTMLButtonElement>) {
    event?.preventDefault();
    event?.stopPropagation();

    if (loading) return;

    if (step === 3) {
      setStep(2);
      return;
    }

    if (step === 2) {
      setStep(1);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (!canSubmit || loading) return;

    await onSubmit({
      ...form,
      harga_pembelian: hargaPembelianComputed,
      estimasi_profit_bersih: profitComputed,
      dibuat_oleh: form.dibuat_oleh || createdById || "",
    });
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-slate-950/80 p-3 backdrop-blur-md sm:items-center sm:p-5"
      onMouseDown={(event) => {
        event.stopPropagation();
        if (loading) return;
        if (event.target === event.currentTarget) onClose();
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        className={`relative w-full max-w-[calc(100vw-24px)] overflow-hidden rounded-[34px] border shadow-[0_30px_120px_rgba(0,0,0,0.45)] sm:max-w-[calc(100vw-40px)] 2xl:max-w-7xl ${theme.shell} ${theme.edgeGlow}`}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`absolute inset-0 ${theme.overlay}`} />
        <div className="absolute inset-[1px] rounded-[33px] border border-white/[0.05]" />

        <div
          className={`absolute -right-16 -top-10 h-44 w-44 rounded-full blur-3xl ${theme.orbA}`}
        />
        <div
          className={`absolute bottom-[-70px] left-[8%] h-40 w-40 rounded-full blur-3xl ${theme.orbB}`}
        />
        <div
          className={`absolute bottom-[-88px] right-[28%] h-36 w-36 rounded-full blur-3xl ${theme.orbC}`}
        />

        <div className="relative flex max-h-[94dvh] min-w-0 flex-col">
          <div className="border-b border-white/10 px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="min-w-0 truncate text-xl font-black tracking-tight text-white sm:text-2xl">
                  {isEdit ? "Edit Project Pendanaan" : "Tambahkan Project Pendanaan"}
                </h2>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                      step === 1
                        ? "border-white/20 bg-white/[0.10] text-white"
                        : "border-white/10 bg-white/[0.04] text-slate-400"
                    }`}
                  >
                    01 Property
                  </span>

                  <span className="text-slate-600">—</span>

                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                      step === 2
                        ? "border-white/20 bg-white/[0.10] text-white"
                        : "border-white/10 bg-white/[0.04] text-slate-400"
                    }`}
                  >
                    02 Financial
                  </span>

                  <span className="text-slate-600">—</span>

                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                      step === 3
                        ? "border-white/20 bg-white/[0.10] text-white"
                        : "border-white/10 bg-white/[0.04] text-slate-400"
                    }`}
                  >
                    03 Funding
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (loading) return;
                  onClose();
                }}
                disabled={loading}
                className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-slate-200 transition disabled:cursor-not-allowed disabled:opacity-60 ${theme.modalMutedButton} ${theme.modalMutedButtonHover}`}
                aria-label="Tutup modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 min-w-0 flex-1 flex-col"
          >
            <div
              ref={contentScrollRef}
              className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6"
            >
              <div
                className={`grid min-w-0 gap-6 ${
                  step === 1
                    ? "xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]"
                    : "grid-cols-1"
                }`}
              >
                <div className="min-w-0 space-y-5">
                  {step === 1 ? (
                    <StepOneProperty
                      form={form}
                      selectedListing={selectedListing}
                      theme={theme}
                      updateField={updateField}
                      listingQuery={listingQuery}
                      setListingQuery={setListingQuery}
                      listingLoading={listingLoading}
                      listingError={listingError}
                      listingResults={listingResults}
                      onSelectListing={selectListing}
                      onLoadMore={handleLoadMore}
                      hasMore={hasMoreListings}
                      inputClassName={inputClassName}
                      textareaClassName={textareaClassName}
                    />
                  ) : step === 2 ? (
                    <PropertyValueStep
                      form={form}
                      selectedListing={selectedListing}
                      updateField={updateField}
                      inputClassName={inputClassName}
                      theme={theme}
                      hargaPembelianComputed={hargaPembelianComputed}
                      profitComputed={profitComputed}
                      roiPercent={roiPercent}
                    />
                  ) : (
                    <FundingInvestorStep
                      form={form}
                      updateField={updateField}
                      theme={theme}
                    />
                  )}
                </div>

                {step === 1 ? (
                  <div className="min-w-0">
                    <SummaryPanel
                      selectedListing={selectedListing}
                      form={form}
                      theme={theme}
                      hargaPembelianComputed={hargaPembelianComputed}
                      profitComputed={profitComputed}
                      roiPercent={roiPercent}
                      onTanggalPembelianChange={(value) =>
                        updateField("tanggal_pembelian", value)
                      }
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="border-t border-white/10 px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-2 text-xs leading-5 text-slate-400">
                  {step === 1 ? (
                    <>
                      <div>
                        Pilih property, isi judul project, tanggal pembelian, dan
                        deskripsi project.
                      </div>

                      <div className="space-y-1">
                        <div className="text-slate-500">
                          Status: property{" "}
                          <span
                            className={
                              form.id_listing ? "text-emerald-300" : "text-rose-300"
                            }
                          >
                            {form.id_listing ? "siap" : "belum"}
                          </span>
                          , tanggal pembelian{" "}
                          <span
                            className={
                              form.tanggal_pembelian
                                ? "text-emerald-300"
                                : "text-rose-300"
                            }
                          >
                            {form.tanggal_pembelian ? "siap" : "belum"}
                          </span>
                          , judul{" "}
                          <span
                            className={
                              trimmedTitle.length > 4
                                ? "text-emerald-300"
                                : "text-rose-300"
                            }
                          >
                            {trimmedTitle.length}/5+
                          </span>
                          , deskripsi{" "}
                          <span
                            className={
                              trimmedDescription.length > 10
                                ? "text-emerald-300"
                                : "text-rose-300"
                            }
                          >
                            {trimmedDescription.length}/11+
                          </span>
                        </div>

                        {!stepOneValid ? (
                          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                            {stepOneIssues.join(" ")}
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : step === 2 ? (
                    <>
                      <div>
                        Finalisasi acquisition, CMA, target pendanaan, dan estimasi
                        harga jual.
                      </div>

                      {!stepTwoValid ? (
                        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                          {stepTwoIssues.join(" ")}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
                          Step 2 siap lanjut ke pendanaan.
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div>
                        Tentukan project ini terbuka untuk semua investor atau
                        hanya investor terpilih.
                      </div>

                      {!stepThreeValid ? (
                        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                          {stepThreeIssues.join(" ")}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
                          Struktur pendanaan siap disimpan.
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="flex w-full items-center gap-3 sm:w-auto sm:justify-end">
                  <button
                    type="button"
                    onClick={(event) => {
                      if (loading) return;

                      if (step === 1) {
                        event.preventDefault();
                        event.stopPropagation();
                        onClose();
                        return;
                      }

                      handleBack(event);
                    }}
                    disabled={loading}
                    className={`inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold text-slate-200 transition disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none sm:px-5 ${theme.modalMutedButton} ${theme.modalMutedButtonHover}`}
                  >
                    {step === 1 ? (
                      "Batal"
                    ) : (
                      <>
                        <ArrowLeft className="h-4 w-4 shrink-0" />
                        <span className="truncate">Kembali</span>
                      </>
                    )}
                  </button>

                  {step === 1 ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={!stepOneValid || loading}
                      className={`inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold shadow-[0_18px_40px_rgba(0,0,0,0.22)] transition disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none sm:px-5 ${theme.actionButton}`}
                    >
                      <span className="truncate">Lanjut ke Financial</span>
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </button>
                  ) : step === 2 ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={!stepTwoValid || loading}
                      className={`inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold shadow-[0_18px_40px_rgba(0,0,0,0.22)] transition disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none sm:px-5 ${theme.actionButton}`}
                    >
                      <span className="truncate">Lanjut ke Pendanaan</span>
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!canSubmit || loading}
                      className={`inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold shadow-[0_18px_40px_rgba(0,0,0,0.22)] transition disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none sm:px-5 ${theme.actionButton}`}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                          <span className="truncate">Menyimpan...</span>
                        </>
                      ) : (
                        <span className="truncate">
                          {isEdit ? "Simpan Perubahan" : "Simpan Project"}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
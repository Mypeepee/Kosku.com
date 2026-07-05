"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  Loader2,
  X,
} from "lucide-react";

type EditProjectSheetProps = {
  open: boolean;
  onClose: () => void;
  idProject: string;
  namaProject: string;
  onSubmitted: () => void;
};

type ProjectEditForm = {
  nama_project: string;
  deskripsi_project: string;
  status: string;
  mulai_tanggal: string;
  estimasi_selesai: string;
  estimasi_bulan: string;
  harga_pembelian: string;
  estimasi_harga_jual: string;
  target_pendanaan: string;
  nilai_limit_lelang: string;
  spare_bidding: string;
  biaya_eksekusi: string;
  biaya_renov: string;
  biaya_balik_nama: string;
  dana_cadangan: string;
};

type ProjectDetailResponse = {
  success: boolean;
  data?: Partial<Record<keyof ProjectEditForm, string | number | null>>;
  message?: string;
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "pendanaan_terbuka", label: "Pendanaan Terbuka" },
  { value: "pendanaan_penuh", label: "Pendanaan Penuh" },
  { value: "pengurusan_dokumen", label: "Pengurusan Dokumen" },
  { value: "eksekusi_pengosongan", label: "Eksekusi / Pengosongan" },
  { value: "renovasi", label: "Renovasi" },
  { value: "sedang_dijual", label: "Sedang Dijual" },
  { value: "terjual", label: "Terjual" },
  { value: "dibatalkan", label: "Dibatalkan" },
];

function toInputNum(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? String(n) : "";
}

function toDateInput(value: unknown): string {
  if (!value) return "";
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] uppercase tracking-[0.22em] text-white/45">
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none focus:ring-1 focus:ring-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-40 transition"
    />
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
  disabled,
  prefix,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  prefix?: string;
}) {
  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-white/35">
          {prefix}
        </span>
      )}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={[
          "w-full rounded-[16px] border border-white/10 bg-white/[0.04] py-3 text-sm text-white placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none focus:ring-1 focus:ring-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-40 transition",
          prefix ? "pl-10 pr-4" : "px-4",
        ].join(" ")}
      />
    </div>
  );
}

function DateInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-[16px] border border-white/10 bg-white/[0.04] py-3 pl-10 pr-4 text-sm text-white focus:border-cyan-300/40 focus:outline-none focus:ring-1 focus:ring-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-40 transition [color-scheme:dark]"
      />
    </div>
  );
}

function StatusSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white focus:border-cyan-300/40 focus:outline-none focus:ring-1 focus:ring-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-40 transition"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#07111f] text-white">
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
    </div>
  );
}

function TextareaInput({
  value,
  onChange,
  placeholder,
  disabled,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      className="w-full resize-none rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none focus:ring-1 focus:ring-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-40 transition"
    />
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="h-px flex-1 bg-white/8" />
      <span className="text-[10px] uppercase tracking-[0.28em] text-white/28">
        {label}
      </span>
      <div className="h-px flex-1 bg-white/8" />
    </div>
  );
}

const EMPTY_FORM: ProjectEditForm = {
  nama_project: "",
  deskripsi_project: "",
  status: "pendanaan_terbuka",
  mulai_tanggal: "",
  estimasi_selesai: "",
  estimasi_bulan: "",
  harga_pembelian: "",
  estimasi_harga_jual: "",
  target_pendanaan: "",
  nilai_limit_lelang: "",
  spare_bidding: "",
  biaya_eksekusi: "",
  biaya_renov: "",
  biaya_balik_nama: "",
  dana_cadangan: "",
};

export default function EditProjectSheet({
  open,
  onClose,
  idProject,
  namaProject,
  onSubmitted,
}: EditProjectSheetProps) {
  const [form, setForm] = useState<ProjectEditForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  function set(field: keyof ProjectEditForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  useEffect(() => {
    if (!open) return;

    setFetching(true);
    setError("");

    fetch(`/api/project/${idProject}/detail`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Gagal mengambil data project.");
        return res.json() as Promise<ProjectDetailResponse>;
      })
      .then((json) => {
        if (!json.success || !json.data) throw new Error(json.message ?? "Gagal.");
        const d = json.data;
        setForm({
          nama_project: String(d.nama_project ?? ""),
          deskripsi_project: String(d.deskripsi_project ?? ""),
          status: String(d.status ?? "pendanaan_terbuka"),
          mulai_tanggal: toDateInput(d.mulai_tanggal),
          estimasi_selesai: toDateInput(d.estimasi_selesai),
          estimasi_bulan: toInputNum(d.estimasi_bulan),
          harga_pembelian: toInputNum(d.harga_pembelian),
          estimasi_harga_jual: toInputNum(d.estimasi_harga_jual),
          target_pendanaan: toInputNum(d.target_pendanaan),
          nilai_limit_lelang: toInputNum(d.nilai_limit_lelang),
          spare_bidding: toInputNum(d.spare_bidding),
          biaya_eksekusi: toInputNum(d.biaya_eksekusi),
          biaya_renov: toInputNum(d.biaya_renov),
          biaya_balik_nama: toInputNum(d.biaya_balik_nama),
          dana_cadangan: toInputNum(d.dana_cadangan),
        });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Gagal mengambil data.");
      })
      .finally(() => setFetching(false));
  }, [open, idProject]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload: Record<string, unknown> = {
        nama_project: form.nama_project.trim() || undefined,
        deskripsi_project: form.deskripsi_project || null,
        status: form.status || undefined,
        mulai_tanggal: form.mulai_tanggal || null,
        estimasi_selesai: form.estimasi_selesai || null,
        estimasi_bulan: form.estimasi_bulan ? Number(form.estimasi_bulan) : null,
        harga_pembelian: form.harga_pembelian ? Number(form.harga_pembelian) : undefined,
        estimasi_harga_jual: form.estimasi_harga_jual ? Number(form.estimasi_harga_jual) : undefined,
        target_pendanaan: form.target_pendanaan ? Number(form.target_pendanaan) : undefined,
        nilai_limit_lelang: form.nilai_limit_lelang ? Number(form.nilai_limit_lelang) : undefined,
        spare_bidding: form.spare_bidding ? Number(form.spare_bidding) : undefined,
        biaya_eksekusi: form.biaya_eksekusi ? Number(form.biaya_eksekusi) : undefined,
        biaya_renov: form.biaya_renov ? Number(form.biaya_renov) : undefined,
        biaya_balik_nama: form.biaya_balik_nama ? Number(form.biaya_balik_nama) : undefined,
        dana_cadangan: form.dana_cadangan ? Number(form.dana_cadangan) : undefined,
      };

      const res = await fetch(`/api/project/${idProject}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "Gagal menyimpan.");
      }

      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/65 backdrop-blur-[3px]"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative ml-auto flex h-full w-full max-w-[560px] flex-col bg-[linear-gradient(180deg,#07111f_0%,#050c18_100%)] shadow-[-30px_0_80px_rgba(0,0,0,0.5)]">
        {/* Top accent */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/40 to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-violet-500/6 blur-3xl" />

        {/* Header */}
        <div className="relative flex shrink-0 items-start justify-between border-b border-white/8 px-6 py-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-violet-300/55">
              Edit Project
            </div>
            <h2 className="mt-1 text-lg font-semibold leading-tight text-white">
              {namaProject || idProject}
            </h2>
            <p className="mt-0.5 text-xs text-white/35">{idProject}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/60 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="relative flex-1 overflow-y-auto px-6 py-6">
          {fetching ? (
            <div className="flex h-40 items-center justify-center gap-3 text-sm text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Mengambil data project...
            </div>
          ) : (
            <form id="edit-project-form" onSubmit={handleSubmit} className="space-y-5">

              {/* Nama project */}
              <div className="space-y-2">
                <FieldLabel>Nama Project</FieldLabel>
                <TextInput
                  value={form.nama_project}
                  onChange={(v) => set("nama_project", v)}
                  placeholder="Nama project"
                  disabled={loading}
                />
              </div>

              {/* Status */}
              <div className="space-y-2">
                <FieldLabel>Status</FieldLabel>
                <StatusSelect
                  value={form.status}
                  onChange={(v) => set("status", v)}
                  disabled={loading}
                />
              </div>

              {/* Deskripsi */}
              <div className="space-y-2">
                <FieldLabel>Deskripsi</FieldLabel>
                <TextareaInput
                  value={form.deskripsi_project}
                  onChange={(v) => set("deskripsi_project", v)}
                  placeholder="Deskripsi singkat project..."
                  disabled={loading}
                  rows={3}
                />
              </div>

              <SectionDivider label="Timeline" />

              {/* Mulai & Estimasi Selesai */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <FieldLabel>Tanggal Mulai</FieldLabel>
                  <DateInput
                    value={form.mulai_tanggal}
                    onChange={(v) => set("mulai_tanggal", v)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Estimasi Selesai</FieldLabel>
                  <DateInput
                    value={form.estimasi_selesai}
                    onChange={(v) => set("estimasi_selesai", v)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel>Estimasi Durasi (bulan)</FieldLabel>
                <NumberInput
                  value={form.estimasi_bulan}
                  onChange={(v) => set("estimasi_bulan", v)}
                  placeholder="Misal: 6"
                  disabled={loading}
                />
              </div>

              <SectionDivider label="Nilai Properti" />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <FieldLabel>Harga Pembelian</FieldLabel>
                  <NumberInput
                    value={form.harga_pembelian}
                    onChange={(v) => set("harga_pembelian", v)}
                    placeholder="0"
                    prefix="Rp"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Estimasi Harga Jual</FieldLabel>
                  <NumberInput
                    value={form.estimasi_harga_jual}
                    onChange={(v) => set("estimasi_harga_jual", v)}
                    placeholder="0"
                    prefix="Rp"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel>Target Pendanaan</FieldLabel>
                <NumberInput
                  value={form.target_pendanaan}
                  onChange={(v) => set("target_pendanaan", v)}
                  placeholder="0"
                  prefix="Rp"
                  disabled={loading}
                />
              </div>

              <SectionDivider label="Alokasi Dana (Dompet)" />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <FieldLabel>Nilai Limit Lelang</FieldLabel>
                  <NumberInput
                    value={form.nilai_limit_lelang}
                    onChange={(v) => set("nilai_limit_lelang", v)}
                    placeholder="0"
                    prefix="Rp"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Spare Bidding</FieldLabel>
                  <NumberInput
                    value={form.spare_bidding}
                    onChange={(v) => set("spare_bidding", v)}
                    placeholder="0"
                    prefix="Rp"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Biaya Eksekusi</FieldLabel>
                  <NumberInput
                    value={form.biaya_eksekusi}
                    onChange={(v) => set("biaya_eksekusi", v)}
                    placeholder="0"
                    prefix="Rp"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Biaya Renovasi</FieldLabel>
                  <NumberInput
                    value={form.biaya_renov}
                    onChange={(v) => set("biaya_renov", v)}
                    placeholder="0"
                    prefix="Rp"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Biaya Balik Nama</FieldLabel>
                  <NumberInput
                    value={form.biaya_balik_nama}
                    onChange={(v) => set("biaya_balik_nama", v)}
                    placeholder="0"
                    prefix="Rp"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Dana Cadangan</FieldLabel>
                  <NumberInput
                    value={form.dana_cadangan}
                    onChange={(v) => set("dana_cadangan", v)}
                    placeholder="0"
                    prefix="Rp"
                    disabled={loading}
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-3 rounded-[16px] border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="relative shrink-0 border-t border-white/8 px-6 py-4">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-[16px] border border-white/10 bg-white/[0.04] py-3 text-sm font-medium text-white/70 transition hover:bg-white/[0.07] disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              form="edit-project-form"
              disabled={loading || fetching}
              className="flex-1 rounded-[16px] border border-violet-300/30 bg-[linear-gradient(135deg,rgba(139,92,246,0.25),rgba(124,58,237,0.2))] py-3 text-sm font-semibold text-violet-100 shadow-[0_8px_30px_rgba(139,92,246,0.18)] transition hover:border-violet-300/40 hover:shadow-[0_8px_30px_rgba(139,92,246,0.24)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </span>
              ) : (
                "Simpan Perubahan"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

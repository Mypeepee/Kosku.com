"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Hash,
  Loader2,
  MapPin,
  PencilLine,
  ScanLine,
  Search,
  Sparkles,
  UserCheck,
  UserRound,
  X,
} from "lucide-react";
import { ocrKTP } from "@/lib/ocrKtp";
import type { SuratTemplate } from "./data";

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = { open: boolean; template: SuratTemplate | null; onClose: () => void };

type ScanStatus = "idle" | "valid" | "review" | "invalid";
type OcrParsed = { nama?: string; nik?: string; alamat_lengkap?: string };
type OcrResult = { parsed?: OcrParsed; status?: ScanStatus; confidence?: number; score?: number; warnings?: string[] };

type PropertyItem = {
  id: string;
  kode_transaksi: string;
  tanggal_transaksi: string;
  judul_property: string;
  alamat_property: string;
  foto_url: string;
};

type FormValues = {
  nama_pemilik: string;
  nik_pemilik: string;
  alamat_pemilik: string;
  tanggal_ttd: string; // YYYY-MM-DD
  alamat_properti: string;
  nama_agent: string;
  no_agent: string;
  id_tanda_terima: string;
};

// ── Utils ─────────────────────────────────────────────────────────────────────

function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

const ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function suggestNomor(): string {
  const d = new Date();
  return `001/TT/SP-SBY/${ROMAWI[d.getMonth()]}/${d.getFullYear()}`;
}
function fmtIndo(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}`;
}
function fmtTanggal(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

const EMPTY: FormValues = {
  nama_pemilik: "", nik_pemilik: "", alamat_pemilik: "", tanggal_ttd: "",
  alamat_properti: "", nama_agent: "", no_agent: "", id_tanda_terima: "",
};

// ── Step meta ─────────────────────────────────────────────────────────────────

type Accent = "cyan" | "emerald" | "violet";
const STEPS: { key: string; label: string; sub: string; icon: React.ElementType; accent: Accent }[] = [
  { key: "penerima", label: "Penerima", sub: "Scan KTP", icon: ScanLine, accent: "cyan" },
  { key: "properti", label: "Properti", sub: "Aset closing", icon: Building2, accent: "emerald" },
  { key: "konfirmasi", label: "Konfirmasi", sub: "Cek & buat", icon: Sparkles, accent: "violet" },
];

const ACCENT: Record<Accent, { text: string; ring: string; bg: string; grad: string; glow: string; solid: string }> = {
  cyan:    { text: "text-cyan-300",    ring: "ring-cyan-400/30",    bg: "bg-cyan-500/12",    grad: "from-cyan-500/70",    glow: "shadow-[0_0_24px_rgba(6,182,212,0.35)]",   solid: "bg-cyan-400" },
  emerald: { text: "text-emerald-300", ring: "ring-emerald-400/30", bg: "bg-emerald-500/12", grad: "from-emerald-500/70", glow: "shadow-[0_0_24px_rgba(16,185,129,0.35)]",  solid: "bg-emerald-400" },
  violet:  { text: "text-violet-300",  ring: "ring-violet-400/30",  bg: "bg-violet-500/12",  grad: "from-violet-500/70",  glow: "shadow-[0_0_24px_rgba(139,92,246,0.35)]",  solid: "bg-violet-400" },
};

// ── Small field primitives ─────────────────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, icon: Icon,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; icon?: React.ElementType }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500">{label}</span>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />}
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cx(
            "w-full rounded-xl border border-white/[0.07] bg-white/[0.03] py-2.5 text-[13.5px] text-white placeholder:text-zinc-600 outline-none transition-all focus:border-emerald-400/50 focus:bg-white/[0.05] focus:ring-2 focus:ring-emerald-500/10",
            Icon ? "pl-9 pr-3" : "px-3.5",
          )}
        />
      </div>
    </label>
  );
}

function AreaField({
  label, value, onChange, placeholder, rows = 2, hint,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500">
        {label}
        {hint && <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-1.5 py-px text-[9px] font-semibold normal-case tracking-normal text-zinc-400"><PencilLine className="h-2.5 w-2.5" />{hint}</span>}
      </span>
      <textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-none rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white placeholder:text-zinc-600 outline-none transition-all focus:border-emerald-400/50 focus:bg-white/[0.05] focus:ring-2 focus:ring-emerald-500/10"
      />
    </label>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function TandaTerimaModal({ open, template, onClose }: Props) {
  const { data: sessionData } = useSession();

  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [errorMsg, setErrorMsg] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // KTP / OCR
  const [manualMode, setManualMode] = useState(false);
  const [ktpImg, setKtpImg] = useState("");
  const [ktpFilename, setKtpFilename] = useState("");
  const [ktpLoading, setKtpLoading] = useState(false);
  const [ktpStatus, setKtpStatus] = useState<ScanStatus>("idle");
  const [ktpConf, setKtpConf] = useState(0);
  const [ktpWarns, setKtpWarns] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Property
  const [props, setProps] = useState<PropertyItem[]>([]);
  const [propFetching, setPropFetching] = useState(false);
  const [selectedProp, setSelectedProp] = useState<PropertyItem | null>(null);
  const [propSearch, setPropSearch] = useState("");
  const [propOpen, setPropOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const upd = <K extends keyof FormValues>(k: K, v: FormValues[K]) => setValues((p) => ({ ...p, [k]: v }));

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setStep(0); setDir(1);
    setValues({ ...EMPTY, tanggal_ttd: todayISO(), id_tanda_terima: suggestNomor(), nama_agent: sessionData?.user?.name ?? "" });
    setErrorMsg(""); setIsGenerating(false);
    setManualMode(false);
    setKtpImg(""); setKtpFilename(""); setKtpLoading(false); setKtpStatus("idle"); setKtpConf(0); setKtpWarns([]);
    setSelectedProp(null); setPropSearch(""); setPropOpen(false);
  }, [open, sessionData?.user?.name]);

  useEffect(() => {
    if (open) { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }
  }, [open]);

  // Revoke object URL on change/unmount
  useEffect(() => () => { if (ktpImg) URL.revokeObjectURL(ktpImg); }, [ktpImg]);

  const fetchAgent = useCallback(async () => {
    try {
      const res = await fetch("/api/surat/agent-me");
      if (!res.ok) return;
      const d = (await res.json()) as { nama_agent?: string; no_agent?: string };
      setValues((p) => ({ ...p, nama_agent: p.nama_agent || (d.nama_agent ?? ""), no_agent: p.no_agent || (d.no_agent ?? "") }));
    } catch { /* silent */ }
  }, []);

  const fetchProps = useCallback(async () => {
    setPropFetching(true);
    try {
      const res = await fetch("/api/surat/transaksi-list");
      if (res.ok) setProps((await res.json()) as PropertyItem[]);
    } finally { setPropFetching(false); }
  }, []);

  useEffect(() => { if (open) { void fetchAgent(); void fetchProps(); } }, [open, fetchAgent, fetchProps]);

  // OCR
  const runOcr = async (file?: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("Ukuran file maksimal 10 MB."); return; }
    if (ktpImg) URL.revokeObjectURL(ktpImg);
    setKtpImg(URL.createObjectURL(file));
    setKtpFilename(file.name);
    setManualMode(true);
    setErrorMsg(""); setKtpLoading(true);
    setKtpStatus("idle"); setKtpConf(0); setKtpWarns([]);
    try {
      const ocr = (await ocrKTP(file)) as unknown as OcrResult;
      const p = ocr.parsed ?? {};
      upd("nama_pemilik", p.nama ?? "");
      upd("nik_pemilik", p.nik ?? "");
      upd("alamat_pemilik", p.alamat_lengkap ?? "");
      setKtpStatus(ocr.status ?? "invalid");
      setKtpConf(Number(ocr.confidence ?? 0));
      setKtpWarns(ocr.warnings ?? []);
    } catch {
      setKtpStatus("invalid");
      setErrorMsg("Gagal membaca KTP. Pastikan gambar jelas dan terang.");
    } finally { setKtpLoading(false); }
  };

  const pickProperty = (item: PropertyItem) => {
    setSelectedProp(item); setPropOpen(false); setPropSearch("");
    upd("alamat_properti", item.alamat_property ?? "");
  };

  const filteredProps = useMemo(() => {
    if (!propSearch) return props;
    const q = propSearch.toLowerCase();
    return props.filter((p) =>
      p.judul_property?.toLowerCase().includes(q) ||
      p.alamat_property?.toLowerCase().includes(q) ||
      p.kode_transaksi?.toLowerCase().includes(q));
  }, [props, propSearch]);

  // Validation
  const step0ok = Boolean(values.nama_pemilik.trim()) && !ktpLoading;
  const step1ok = Boolean(values.alamat_properti.trim());
  const canGenerate = step0ok && step1ok;
  const stepOk = step === 0 ? step0ok : step === 1 ? step1ok : canGenerate;

  const goTo = (next: number) => {
    if (next === step) return;
    setDir(next > step ? 1 : -1);
    setStep(next);
    setErrorMsg("");
  };
  const goNext = () => { if (step < 2 && stepOk) goTo(step + 1); };
  const goBack = () => { if (step > 0) goTo(step - 1); };

  const handleGenerate = async () => {
    if (!canGenerate || isGenerating) return;
    setIsGenerating(true); setErrorMsg("");
    try {
      const res = await fetch("/api/surat/generate-tanda-terima", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { detail?: string };
        setErrorMsg(err.detail ?? "Gagal generate tanda terima. Coba lagi.");
        return;
      }
      const disp = res.headers.get("Content-Disposition") ?? "";
      const filename = disp.match(/filename="([^"]+)"/)?.[1] ?? "TandaTerima.pdf";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      console.error(e);
      setErrorMsg("Gagal menghubungi server. Coba lagi.");
    } finally { setIsGenerating(false); }
  };

  if (!open || !template || !mounted) return null;

  const statusBadge = (s: ScanStatus) =>
    s === "valid" ? { t: "Terbaca Jelas", c: "text-emerald-300 bg-emerald-500/12 ring-emerald-500/25", I: CheckCircle2 }
    : s === "review" ? { t: "Perlu Dicek", c: "text-amber-300 bg-amber-500/12 ring-amber-500/25", I: AlertTriangle }
    : { t: "Tidak Terbaca", c: "text-red-300 bg-red-500/12 ring-red-500/25", I: AlertTriangle };

  const showFields = manualMode || Boolean(ktpFilename);
  const anim = dir === 1 ? "tt-in-right" : "tt-in-left";

  const modal = (
    <div className="fixed inset-0 z-[9999] grid place-items-end sm:place-items-center p-0 sm:p-6">
      {/* Keyframes */}
      <style>{`
        @keyframes ttInR { from { opacity: 0; transform: translateX(26px) } to { opacity: 1; transform: none } }
        @keyframes ttInL { from { opacity: 0; transform: translateX(-26px) } to { opacity: 1; transform: none } }
        @keyframes ttScan { 0% { transform: translateY(-6%) } 100% { transform: translateY(560%) } }
        @keyframes ttOrb { 0%,100% { transform: translate(0,0) } 50% { transform: translate(14px,-10px) } }
        .tt-in-right { animation: ttInR .34s cubic-bezier(.22,1,.36,1) both }
        .tt-in-left  { animation: ttInL .34s cubic-bezier(.22,1,.36,1) both }
      `}</style>

      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={isGenerating ? undefined : onClose} />

      {/* Shell */}
      <div
        className="relative flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[26px] sm:rounded-[26px] border border-white/[0.08] bg-[#08080d] shadow-[0_40px_120px_rgba(0,0,0,0.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent" />
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-emerald-500/[0.10] blur-3xl" style={{ animation: "ttOrb 9s ease-in-out infinite" }} />
        <div className="pointer-events-none absolute -right-20 top-24 h-52 w-52 rounded-full bg-violet-500/[0.08] blur-3xl" style={{ animation: "ttOrb 11s ease-in-out infinite" }} />
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)", backgroundSize: "44px 44px" }} />

        {/* ── Header ── */}
        <div className="relative flex shrink-0 items-center justify-between gap-4 px-5 pb-3 pt-4 sm:pt-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500/25 to-emerald-600/5 ring-1 ring-emerald-400/30">
              <Sparkles className="h-5 w-5 text-emerald-300" />
              <div className="absolute inset-0 rounded-2xl bg-emerald-400/10 blur-md" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-[16px] font-black tracking-tight text-white">Tanda Terima Dokumen</h2>
              <p className="text-[11px] text-zinc-500">Solusindo Premier · auto-generate PDF</p>
            </div>
          </div>
          <button
            type="button" onClick={isGenerating ? undefined : onClose} disabled={isGenerating}
            className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-xl ring-1 ring-white/[0.08] transition-all",
              isGenerating ? "cursor-not-allowed text-zinc-700" : "text-zinc-400 hover:bg-white/[0.06] hover:text-white")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Stepper ── */}
        <div className="relative z-10 shrink-0 px-5 pb-4">
          <div className="flex items-center">
            {STEPS.map((s, i) => {
              const a = ACCENT[s.accent];
              const done = i < step;
              const active = i === step;
              const reachable = i <= step || (i === step + 1 && stepOk);
              const Icon = s.icon;
              return (
                <div key={s.key} className={cx("flex items-center", i < STEPS.length - 1 && "flex-1")}>
                  <button
                    type="button"
                    onClick={() => reachable && !isGenerating && goTo(i)}
                    className={cx("group flex items-center gap-2.5", reachable ? "cursor-pointer" : "cursor-not-allowed")}
                  >
                    <span className={cx(
                      "relative grid h-9 w-9 shrink-0 place-items-center rounded-2xl ring-1 transition-all duration-300",
                      done ? "bg-emerald-500 text-black ring-emerald-400/40"
                        : active ? cx(a.bg, a.text, a.ring, a.glow)
                        : "bg-white/[0.03] text-zinc-600 ring-white/[0.06]",
                    )}>
                      {done ? <Check className="h-4 w-4" strokeWidth={3} /> : <Icon className="h-4 w-4" />}
                    </span>
                    <span className="hidden text-left sm:block">
                      <span className={cx("block text-[12px] font-bold leading-none transition-colors", active || done ? "text-white" : "text-zinc-500")}>{s.label}</span>
                      <span className="mt-0.5 block text-[10px] leading-none text-zinc-600">{s.sub}</span>
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <span className="mx-2 h-[2px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <span className={cx("block h-full rounded-full bg-gradient-to-r to-emerald-400 transition-all duration-500", ACCENT[s.accent].grad)} style={{ width: i < step ? "100%" : "0%" }} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Generating overlay ── */}
        {isGenerating && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-[#08080d]/92 backdrop-blur-sm">
            <div className="relative grid place-items-center">
              <div className="absolute h-24 w-24 animate-ping rounded-full bg-emerald-500/10" />
              <div className="relative grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-emerald-500/25 to-emerald-600/5 ring-1 ring-emerald-400/30">
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-emerald-400" />
                <Sparkles className="h-6 w-6 text-emerald-300" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-[16px] font-black text-white">Membuat Tanda Terima…</p>
              <p className="mt-1 text-[12.5px] text-zinc-500">Menyusun PDF, jangan tutup halaman ini</p>
            </div>
          </div>
        )}

        {/* ── Body ── */}
        <div className={cx("relative z-[1] flex-1 overflow-y-auto overscroll-contain", isGenerating && "pointer-events-none select-none")}>
          <div key={step} className={cx("px-5 pb-6", anim)}>

            {errorMsg && (
              <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.08] px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <p className="text-[13px] leading-relaxed text-amber-200">{errorMsg}</p>
              </div>
            )}

            {/* ═══ STEP 0 — PENERIMA ═══ */}
            {step === 0 && (
              <div className="space-y-4">
                {/* Scanner dropzone */}
                {!showFields ? (
                  <div
                    className={cx(
                      "group relative cursor-pointer select-none overflow-hidden rounded-3xl border border-dashed transition-all duration-300",
                      dragging ? "border-cyan-400/90 bg-cyan-500/[0.07] shadow-[0_0_60px_rgba(6,182,212,0.22)]"
                        : "border-white/[0.10] bg-white/[0.02] hover:border-cyan-400/60 hover:bg-cyan-500/[0.035]",
                    )}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setDragging(false); void runOcr(e.dataTransfer.files?.[0]); }}
                    onClick={() => fileRef.current?.click()}
                  >
                    {/* laser sweep */}
                    <span className="pointer-events-none absolute inset-x-6 top-0 h-8 bg-gradient-to-b from-cyan-400/40 to-transparent opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100" style={{ animation: dragging ? "ttScan 1.4s linear infinite" : undefined }} />
                    <div className="relative flex flex-col items-center gap-4 px-6 py-11 text-center">
                      <div className={cx("grid h-16 w-16 place-items-center rounded-3xl bg-cyan-500/12 ring-1 ring-cyan-400/30 transition-transform duration-300", dragging ? "scale-110" : "group-hover:scale-105")}>
                        <ScanLine className="h-7 w-7 text-cyan-300" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[15px] font-black text-white">Scan KTP Penerima</p>
                        <p className="mx-auto max-w-[280px] text-[12px] leading-relaxed text-zinc-500">
                          Tarik &amp; lepas foto KTP di sini — <span className="text-cyan-300/90">nama, NIK &amp; alamat</span> terisi otomatis
                        </p>
                      </div>
                      <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-[10px] font-black tracking-wide text-cyan-300 ring-1 ring-cyan-400/25">JPG · PNG · WEBP · maks 10MB</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setManualMode(true); }}
                      className="relative mx-auto mb-4 block text-[11px] font-semibold text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-300 hover:underline"
                    >
                      atau isi manual tanpa scan
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Scanned KTP strip */}
                    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-2.5">
                      <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/[0.06]">
                        {ktpImg ? <img src={ktpImg} alt="KTP" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center"><UserRound className="h-6 w-6 text-zinc-700" /></div>}
                        {ktpLoading && (
                          <>
                            <div className="absolute inset-0 bg-cyan-500/10" />
                            <span className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-cyan-300/70 to-transparent" style={{ animation: "ttScan 1.3s linear infinite" }} />
                          </>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {ktpLoading ? (
                          <p className="flex items-center gap-2 text-[12.5px] font-semibold text-cyan-300"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Membaca KTP…</p>
                        ) : ktpStatus !== "idle" ? (
                          (() => { const b = statusBadge(ktpStatus); const I = b.I; return (
                            <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1", b.c)}><I className="h-3 w-3" />{b.t}{ktpConf > 0 && <span className="opacity-60">· {Math.round(ktpConf * 100)}%</span>}</span>
                          ); })()
                        ) : (
                          <p className="text-[12.5px] font-semibold text-zinc-300">Isi data secara manual</p>
                        )}
                        <p className="mt-1 truncate text-[11px] text-zinc-600">{ktpFilename || "Tanpa foto KTP"}</p>
                      </div>
                      <button type="button" onClick={() => fileRef.current?.click()} className="shrink-0 rounded-xl bg-white/[0.05] px-3 py-2 text-[11px] font-bold text-zinc-300 ring-1 ring-white/[0.08] transition-all hover:bg-white/[0.1] hover:text-white">
                        {ktpFilename ? "Ganti" : "Scan KTP"}
                      </button>
                    </div>

                    {ktpWarns.length > 0 && (
                      <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.07] px-3 py-2">
                        {ktpWarns.map((w, i) => <p key={i} className="text-[11px] text-amber-200">• {w}</p>)}
                      </div>
                    )}

                    {/* Editable fields */}
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
                      <p className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500"><UserRound className="h-3.5 w-3.5 text-cyan-400" /> Data Penerima</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2"><Field label="Nama Penerima" value={values.nama_pemilik} onChange={(v) => upd("nama_pemilik", v)} placeholder="Nama sesuai KTP" /></div>
                        <div className="col-span-2 sm:col-span-1"><Field label="NIK" value={values.nik_pemilik} onChange={(v) => upd("nik_pemilik", v)} placeholder="16 digit" icon={Hash} /></div>
                        <div className="col-span-2"><AreaField label="Alamat" value={values.alamat_pemilik} onChange={(v) => upd("alamat_pemilik", v)} rows={2} placeholder="Alamat sesuai KTP" hint="bisa diedit" /></div>
                      </div>
                    </div>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden" onChange={(e) => { void runOcr(e.target.files?.[0]); e.currentTarget.value = ""; }} />
              </div>
            )}

            {/* ═══ STEP 1 — PROPERTI ═══ */}
            {step === 1 && (
              <div className="space-y-4">
                {selectedProp && !propOpen ? (
                  <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.04]">
                    <div className="relative h-28 w-full bg-zinc-900">
                      {selectedProp.foto_url ? <img src={selectedProp.foto_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center"><Building2 className="h-9 w-9 text-zinc-700" /></div>}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                      <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-black text-white drop-shadow">{selectedProp.judul_property}</p>
                          <p className="font-mono text-[10px] text-emerald-300">{selectedProp.kode_transaksi}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-black text-black"><Check className="h-3 w-3" strokeWidth={3} />Dipilih</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <p className="line-clamp-1 text-[11.5px] text-zinc-400"><MapPin className="mr-1 inline h-3 w-3 text-zinc-500" />{selectedProp.alamat_property}</p>
                      <button type="button" onClick={() => setPropOpen(true)} className="shrink-0 rounded-lg bg-white/[0.05] px-2.5 py-1 text-[11px] font-bold text-zinc-400 ring-1 ring-white/[0.08] transition-all hover:bg-white/[0.1] hover:text-white">Ganti</button>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
                    <div className="border-b border-white/[0.06] bg-white/[0.02] p-2.5">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                        <input value={propSearch} onChange={(e) => setPropSearch(e.target.value)} placeholder="Cari properti / alamat / kode transaksi…" className="w-full rounded-xl bg-white/[0.04] py-2.5 pl-9 pr-3 text-[13px] text-white placeholder:text-zinc-600 outline-none ring-1 ring-white/[0.06] transition-all focus:bg-white/[0.06] focus:ring-emerald-500/30" />
                      </div>
                    </div>
                    <div className="max-h-[248px] divide-y divide-white/[0.04] overflow-y-auto">
                      {propFetching ? (
                        <div className="flex items-center justify-center gap-2.5 py-10 text-[13px] text-zinc-500"><Loader2 className="h-4 w-4 animate-spin text-emerald-500" /> Memuat properti closing…</div>
                      ) : filteredProps.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-10 text-center">
                          <Building2 className="h-7 w-7 text-zinc-700" />
                          <p className="text-[12px] text-zinc-500">{propSearch ? "Tidak ditemukan" : "Belum ada properti closing"}</p>
                          <p className="max-w-[240px] text-[11px] text-zinc-600">Tidak masalah — alamat bisa diketik manual di bawah.</p>
                        </div>
                      ) : (
                        filteredProps.map((p) => {
                          const active = selectedProp?.id === p.id;
                          return (
                            <button key={p.id} type="button" onClick={() => pickProperty(p)} className={cx("flex w-full items-stretch text-left transition-all", active ? "bg-emerald-500/[0.08]" : "hover:bg-white/[0.03]")}>
                              <div className="relative w-[74px] shrink-0 overflow-hidden bg-zinc-900">
                                {p.foto_url ? <img src={p.foto_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center"><Building2 className="h-6 w-6 text-zinc-700" /></div>}
                                {active && <div className="absolute inset-0 grid place-items-center bg-emerald-500/35 backdrop-blur-[1px]"><Check className="h-5 w-5 text-white" strokeWidth={3} /></div>}
                              </div>
                              <div className="min-w-0 flex-1 px-3 py-2.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate text-[13px] font-bold leading-tight text-white">{p.judul_property}</span>
                                  <span className="shrink-0 font-mono text-[10px] text-emerald-400">{p.kode_transaksi}</span>
                                </div>
                                <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-500">{p.alamat_property}</p>
                                <span className="mt-1 block text-[10px] text-zinc-600">{fmtTanggal(p.tanggal_transaksi)}</span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                    {selectedProp && propOpen && (
                      <div className="border-t border-white/[0.06] bg-white/[0.02] p-2">
                        <button type="button" onClick={() => { setPropOpen(false); setPropSearch(""); }} className="w-full rounded-xl py-2 text-[12px] font-bold text-zinc-500 transition-all hover:bg-white/[0.04] hover:text-zinc-300">Batal ganti</button>
                      </div>
                    )}
                  </div>
                )}

                <AreaField label="Alamat Properti" value={values.alamat_properti} onChange={(v) => upd("alamat_properti", v)} rows={2} placeholder="Pilih properti di atas atau ketik alamat manual" hint="bisa diedit" />
              </div>
            )}

            {/* ═══ STEP 2 — KONFIRMASI ═══ */}
            {step === 2 && (
              <div className="space-y-4">
                {/* Detail inputs */}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
                  <p className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500"><Calendar className="h-3.5 w-3.5 text-violet-400" /> Detail &amp; Agent</p>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500">Tanggal Terima</span>
                      <div className="relative">
                        <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
                        <input type="date" value={values.tanggal_ttd} onChange={(e) => upd("tanggal_ttd", e.target.value)} className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] py-2.5 pl-9 pr-3 text-[13.5px] text-white outline-none transition-all focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-500/10 [color-scheme:dark]" />
                      </div>
                    </label>
                    <Field label="Nomor Tanda Terima" value={values.id_tanda_terima} onChange={(v) => upd("id_tanda_terima", v)} icon={Hash} placeholder="Otomatis" />
                    <div className="col-span-2 sm:col-span-1"><Field label="Agent (Menyerahkan)" value={values.nama_agent} onChange={(v) => upd("nama_agent", v)} icon={UserCheck} placeholder="Nama agent" /></div>
                    <div className="col-span-2 sm:col-span-1"><Field label="No. / WhatsApp" value={values.no_agent} onChange={(v) => upd("no_agent", v)} placeholder="Kontak agent" /></div>
                  </div>
                </div>

                {/* Receipt preview */}
                <div>
                  <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500"><Sparkles className="h-3.5 w-3.5 text-emerald-400" /> Pratinjau Dokumen</p>
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-100 to-white text-zinc-900 shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-black/5">
                    {/* header band */}
                    <div className="relative bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2.5 text-white">
                      <p className="text-[8.5px] font-black uppercase tracking-[0.2em] opacity-80">Solusindo Premier</p>
                      <p className="text-[13px] font-black leading-tight">TANDA TERIMA DOKUMEN</p>
                      <p className="mt-0.5 font-mono text-[9.5px] opacity-90">No. {values.id_tanda_terima || "—"}</p>
                      <div className="pointer-events-none absolute -right-4 -top-6 h-20 w-20 rounded-full bg-white/10 blur-xl" />
                    </div>
                    {/* body */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 px-4 py-3.5">
                      <div className="col-span-2">
                        <p className="text-[8px] font-black uppercase tracking-widest text-emerald-700/70">Yang Menerima</p>
                        <p className="text-[12.5px] font-black leading-tight text-zinc-900">{values.nama_pemilik || "—"}</p>
                        {values.nik_pemilik && <p className="font-mono text-[9.5px] text-zinc-500">NIK {values.nik_pemilik}</p>}
                        {values.alamat_pemilik && <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-zinc-600">{values.alamat_pemilik}</p>}
                      </div>
                      <div className="col-span-2 h-px" style={{ backgroundImage: "repeating-linear-gradient(90deg,#d4d4d8 0 6px,transparent 6px 12px)" }} />
                      <div className="col-span-2">
                        <p className="text-[8px] font-black uppercase tracking-widest text-emerald-700/70">Properti</p>
                        <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-zinc-800">{values.alamat_properti || "—"}</p>
                      </div>
                    </div>
                    {/* perforation */}
                    <div className="relative h-4">
                      <div className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[#08080d]" />
                      <div className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[#08080d]" />
                      <div className="mx-3 border-t border-dashed border-zinc-300" />
                    </div>
                    {/* footer */}
                    <div className="flex items-end justify-between gap-3 px-4 pb-3.5 pt-1">
                      <div>
                        <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Menyerahkan</p>
                        <p className="text-[11px] font-black text-zinc-800">{values.nama_agent || "—"}</p>
                        {values.no_agent && <p className="text-[9px] text-zinc-500">{values.no_agent}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Tanggal</p>
                        <p className="text-[11px] font-bold text-zinc-800">{values.tanggal_ttd ? fmtIndo(values.tanggal_ttd) : "—"}</p>
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-center text-[10.5px] text-zinc-600">Daftar dokumen (sertipikat, risalah, dll.) sudah tercetak di template PDF.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="relative z-[1] shrink-0 border-t border-white/[0.06] bg-[#08080d]/90 px-5 py-3.5">
          <div className="flex items-center gap-3">
            {step > 0 ? (
              <button type="button" onClick={goBack} disabled={isGenerating} className="flex items-center gap-1.5 rounded-xl px-3.5 py-3 text-[13px] font-bold text-zinc-400 ring-1 ring-white/[0.08] transition-all hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-40">
                <ArrowLeft className="h-4 w-4" /> Kembali
              </button>
            ) : (
              <button type="button" onClick={onClose} disabled={isGenerating} className="rounded-xl px-3.5 py-3 text-[13px] font-bold text-zinc-500 transition-all hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed">Batal</button>
            )}

            {/* progress dots */}
            <div className="mx-auto hidden items-center gap-1.5 sm:flex">
              {STEPS.map((_, i) => (
                <span key={i} className={cx("h-1.5 rounded-full transition-all duration-300", i === step ? "w-5 bg-emerald-400" : i < step ? "w-1.5 bg-emerald-500/50" : "w-1.5 bg-white/15")} />
              ))}
            </div>

            {step < 2 ? (
              <button type="button" onClick={goNext} disabled={!stepOk} className={cx(
                "relative flex items-center gap-2 overflow-hidden rounded-xl px-5 py-3 text-[13.5px] font-black transition-all duration-200",
                stepOk ? "bg-emerald-500 text-black shadow-[0_6px_24px_rgba(52,211,153,0.3)] hover:bg-emerald-400 active:scale-[0.98]" : "cursor-not-allowed bg-white/[0.05] text-zinc-600 ring-1 ring-white/[0.06]",
              )}>
                Lanjut <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" onClick={handleGenerate} disabled={!canGenerate || isGenerating} className={cx(
                "relative flex items-center gap-2 overflow-hidden rounded-xl px-5 py-3 text-[13.5px] font-black transition-all duration-200",
                canGenerate && !isGenerating ? "bg-emerald-500 text-black shadow-[0_6px_24px_rgba(52,211,153,0.35)] hover:bg-emerald-400 active:scale-[0.98]" : "cursor-not-allowed bg-white/[0.05] text-zinc-600 ring-1 ring-white/[0.06]",
              )}>
                {canGenerate && !isGenerating && <span className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/25 to-transparent" />}
                {isGenerating ? <><Loader2 className="h-4 w-4 animate-spin" /> Membuat…</> : <><Sparkles className="h-4 w-4" /> Generate PDF</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

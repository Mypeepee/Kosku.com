"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { X } from "lucide-react";
import type { SuratTemplate } from "./data";

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = { open: boolean; template: SuratTemplate | null; onClose: () => void };
type ScanStatus = "idle" | "scanning" | "valid" | "review" | "invalid";

type Pihak = {
  nama: string; nik: string; tempat_lahir: string; tgl_lahir: string;
  warga_negara: string; pekerjaan: string; alamat: string;
};
type OcrKtpRaw = {
  parsed?: { nama?: string; nik?: string; tempat_lahir?: string; tanggal_lahir?: string; alamat_lengkap?: string };
  extracted_full?: { pekerjaan?: string; warga_negara?: string };
  confidence?: number; score?: number; status?: string; warnings?: string[];
};
type RisalahData = { nomor: string; tanggal: string; kantor_lelang: string };
type OcrRisalahRaw = {
  parsed?: {
    nomor_risalah?: string; tanggal_risalah?: string; kantor_lelang?: string;
    jenis_hak?: string; nomor_sertifikat?: string; luas?: string;
    alamat_obyek?: string; kelurahan?: string; kecamatan?: string;
    kabupaten?: string; provinsi?: string;
  };
  status?: string; warnings?: string[];
};
type ObjekData = {
  jenis_hak: string; nib: string; luas: string;
  alamat_obyek: string; alamat_obyek_lengkap: string;
  obyek_provinsi: string; obyek_kabupaten: string; obyek_kecamatan: string; obyek_kelurahan: string;
};
type KompData = {
  kompensasi_total: string; tahap1_jumlah: string; batas_tanggal: string;
};
type AktaData = {
  nomor: string; tanggal_akta: string; pukul: string;
  pengadilan: string; kota_ttd: string; tanggal_ttd: string;
};

// ── Defaults ──────────────────────────────────────────────────────────────────

const EMPTY_PIHAK: Pihak = {
  nama: "", nik: "", tempat_lahir: "", tgl_lahir: "",
  warga_negara: "Indonesia", pekerjaan: "", alamat: "",
};
const EMPTY_RISALAH: RisalahData = { nomor: "", tanggal: "", kantor_lelang: "" };
const EMPTY_OBJEK: ObjekData = {
  jenis_hak: "", nib: "", luas: "", alamat_obyek: "", alamat_obyek_lengkap: "",
  obyek_provinsi: "", obyek_kabupaten: "", obyek_kecamatan: "", obyek_kelurahan: "",
};
const EMPTY_KOMP: KompData = {
  kompensasi_total: "", tahap1_jumlah: "", batas_tanggal: "",
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function makeDefaultAkta(): AktaData {
  const today = todayISO();
  const d = new Date();
  const ROMAWI = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
  return {
    nomor: `001/AKB/SP-SBY/${ROMAWI[d.getMonth()]}/${d.getFullYear()}`,
    tanggal_akta: today, pukul: "10.00",
    pengadilan: "Pengadilan Negeri Surabaya",
    kota_ttd: "Surabaya", tanggal_ttd: today,
  };
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function cx(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(" "); }

function fmtRupiah(raw: string): string {
  const n = parseInt(raw.replace(/\D/g, "") || "0", 10);
  return n ? "Rp " + n.toLocaleString("id-ID") : "";
}

function tahap2Val(total: string, t1: string): string {
  const tot = parseInt(total.replace(/\D/g, "") || "0", 10);
  const t1n = parseInt(t1.replace(/\D/g, "") || "0", 10);
  const sisa = tot - t1n;
  return sisa > 0 && tot > 0 ? "Rp " + sisa.toLocaleString("id-ID") : "";
}

function fmtDateDisplay(iso: string): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  return `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}`;
}

function isoFromDMY(raw: string): string {
  const m = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : raw;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

type Accent = "amber" | "cyan" | "violet" | "emerald";
const A: Record<Accent, {
  text: string; ring: string; bg: string; glow: string; grad: string;
  btnBg: string; btnHov: string; border: string; cardBg: string;
  // dropzone
  dropHover: string; dropDrag: string; dragGlow: string;
  sweep: string; iconRing: string; iconText: string; spinner: string;
}> = {
  amber: {
    text: "text-amber-300", ring: "ring-amber-400/35", bg: "bg-amber-500/12",
    glow: "shadow-[0_0_26px_rgba(251,191,36,0.28)]", grad: "from-amber-500/70",
    btnBg: "bg-amber-500/15", btnHov: "hover:bg-amber-500/25", border: "border-amber-500/20",
    cardBg: "bg-amber-500/[0.025]",
    dropHover: "hover:border-amber-400/60 hover:bg-amber-500/[0.035]",
    dropDrag:  "border-amber-400/90 bg-amber-500/[0.07]",
    dragGlow:  "shadow-[0_0_60px_rgba(245,158,11,0.22)]",
    sweep:     "from-amber-400/40",
    iconRing:  "bg-amber-500/12 ring-1 ring-amber-400/30",
    iconText:  "text-amber-300",
    spinner:   "border-t-amber-400",
  },
  cyan: {
    text: "text-cyan-300", ring: "ring-cyan-400/35", bg: "bg-cyan-500/12",
    glow: "shadow-[0_0_26px_rgba(6,182,212,0.28)]", grad: "from-cyan-500/70",
    btnBg: "bg-cyan-500/15", btnHov: "hover:bg-cyan-500/25", border: "border-cyan-500/20",
    cardBg: "bg-cyan-500/[0.025]",
    dropHover: "hover:border-cyan-400/60 hover:bg-cyan-500/[0.035]",
    dropDrag:  "border-cyan-400/90 bg-cyan-500/[0.07]",
    dragGlow:  "shadow-[0_0_60px_rgba(6,182,212,0.22)]",
    sweep:     "from-cyan-400/40",
    iconRing:  "bg-cyan-500/12 ring-1 ring-cyan-400/30",
    iconText:  "text-cyan-300",
    spinner:   "border-t-cyan-400",
  },
  violet: {
    text: "text-violet-300", ring: "ring-violet-400/35", bg: "bg-violet-500/12",
    glow: "shadow-[0_0_26px_rgba(139,92,246,0.28)]", grad: "from-violet-500/70",
    btnBg: "bg-violet-500/15", btnHov: "hover:bg-violet-500/25", border: "border-violet-500/20",
    cardBg: "bg-violet-500/[0.02]",
    dropHover: "hover:border-violet-400/60 hover:bg-violet-500/[0.035]",
    dropDrag:  "border-violet-400/90 bg-violet-500/[0.07]",
    dragGlow:  "shadow-[0_0_60px_rgba(139,92,246,0.22)]",
    sweep:     "from-violet-400/40",
    iconRing:  "bg-violet-500/12 ring-1 ring-violet-400/30",
    iconText:  "text-violet-300",
    spinner:   "border-t-violet-400",
  },
  emerald: {
    text: "text-emerald-300", ring: "ring-emerald-400/35", bg: "bg-emerald-500/12",
    glow: "shadow-[0_0_26px_rgba(16,185,129,0.28)]", grad: "from-emerald-500/70",
    btnBg: "bg-emerald-500/15", btnHov: "hover:bg-emerald-500/25", border: "border-emerald-500/20",
    cardBg: "bg-emerald-500/[0.02]",
    dropHover: "hover:border-emerald-400/60 hover:bg-emerald-500/[0.035]",
    dropDrag:  "border-emerald-400/90 bg-emerald-500/[0.07]",
    dragGlow:  "shadow-[0_0_60px_rgba(16,185,129,0.22)]",
    sweep:     "from-emerald-400/40",
    iconRing:  "bg-emerald-500/12 ring-1 ring-emerald-400/30",
    iconText:  "text-emerald-300",
    spinner:   "border-t-emerald-400",
  },
};

const STEPS: { label: string; sub: string; accent: Accent; icon: string }[] = [
  { label: "KTP Para Pihak",  sub: "Scan identitas",  accent: "cyan",    icon: "solar:users-group-two-rounded-bold-duotone" },
  { label: "Risalah & Objek", sub: "Dokumen lelang",  accent: "amber",   icon: "solar:document-text-bold-duotone" },
  { label: "Kompensasi",      sub: "Nilai & jadwal",  accent: "violet",  icon: "solar:hand-money-bold-duotone" },
  { label: "Review & Buat",   sub: "Generate PDF",    accent: "emerald", icon: "solar:magic-stick-bold-duotone" },
];

// ── Primitive inputs ──────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">{children}</span>;
}

function TextInput({
  value, onChange, placeholder, type = "text", readOnly,
}: {
  value: string; onChange?: (v: string) => void; placeholder?: string; type?: string; readOnly?: boolean;
}) {
  return (
    <input
      type={type} value={value} readOnly={readOnly} placeholder={placeholder}
      onChange={e => onChange?.(e.target.value)}
      className={cx(
        "w-full rounded-xl border border-white/[0.07] bg-white/[0.03]",
        "px-3.5 py-2.5 text-[13px] text-white placeholder:text-zinc-600 outline-none transition-all",
        readOnly
          ? "cursor-default text-zinc-400"
          : "focus:border-amber-400/40 focus:bg-white/[0.05] focus:ring-2 focus:ring-amber-500/10",
      )}
    />
  );
}

function TextareaInput({
  value, onChange, placeholder, rows = 2,
}: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      rows={rows} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className="w-full resize-none rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5 text-[13px] leading-relaxed text-white placeholder:text-zinc-600 outline-none transition-all focus:border-amber-400/40 focus:bg-white/[0.05] focus:ring-2 focus:ring-amber-500/10"
    />
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      {children}
    </label>
  );
}

// ── Modern calendar picker (custom, no native input) ───────────────────────────

function pad2(n: number) { return String(n).padStart(2, "0"); }

const DP_BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const DP_HARI  = ["Sen","Sel","Rab","Kam","Jum","Sab","Min"]; // Monday-first

function DatePicker({
  value, onChange, accent = "violet", time, onTimeChange, placeholder = "Pilih tanggal",
}: {
  value: string;                       // ISO "YYYY-MM-DD"
  onChange: (iso: string) => void;
  accent?: Accent;
  time?: string;                       // "HH.MM" — presence enables the time row
  onTimeChange?: (t: string) => void;
  placeholder?: string;
}) {
  const ac = A[accent];
  const [open, setOpen] = useState(false);

  const sel = (() => {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? { y: +m[1], mo: +m[2] - 1, d: +m[3] } : null;
  })();

  const now = new Date();
  const [viewY, setViewY] = useState(sel?.y ?? now.getFullYear());
  const [viewM, setViewM] = useState(sel?.mo ?? now.getMonth());

  // Sync bulan tampilan ke tanggal terpilih + Esc menutup
  useEffect(() => {
    if (!open) return;
    if (sel) { setViewY(sel.y); setViewM(sel.mo); }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const gridStart = (() => {
    const first = new Date(viewY, viewM, 1);
    const off = (first.getDay() + 6) % 7;            // Monday-first offset
    return new Date(viewY, viewM, 1 - off);
  })();
  const cells = Array.from({ length: 42 }, (_, i) =>
    new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));

  const isSel   = (d: Date) => sel && d.getFullYear() === sel.y && d.getMonth() === sel.mo && d.getDate() === sel.d;
  const isToday = (d: Date) => d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();

  const pick = (d: Date) => {
    onChange(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
    if (d.getMonth() !== viewM) { setViewY(d.getFullYear()); setViewM(d.getMonth()); }
    if (time === undefined) setOpen(false);
  };
  const stepMonth = (n: number) => { const d = new Date(viewY, viewM + n, 1); setViewY(d.getFullYear()); setViewM(d.getMonth()); };

  const [th, tm] = (() => {
    const m = (time ?? "").match(/(\d{1,2})[.:](\d{2})/);
    return m ? [+m[1], +m[2]] : [10, 0];
  })();
  const setTime = (h: number, m: number) => onTimeChange?.(`${pad2((h + 24) % 24)}.${pad2((m + 60) % 60)}`);
  const dotBg = ac.text.replace("text-", "bg-");

  const label = sel
    ? `${sel.d} ${DP_BULAN[sel.mo]} ${sel.y}${time !== undefined ? ` · ${pad2(th)}.${pad2(tm)}` : ""}`
    : placeholder;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cx(
          "flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px] transition-all",
          open ? cx(ac.border, ac.bg) : "border-white/[0.07] bg-white/[0.03] hover:border-white/[0.14]",
        )}
      >
        <Icon icon="solar:calendar-bold-duotone" className={cx("shrink-0 text-base", sel ? ac.text : "text-zinc-500")} />
        <span className={cx("flex-1 text-left font-semibold", sel ? "text-white" : "text-zinc-600")}>{label}</span>
        <Icon icon="solar:alt-arrow-down-bold" className={cx("shrink-0 text-xs text-zinc-500 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm akta-dp-fade" onClick={() => setOpen(false)} />
          <div
            className={cx(
              "relative flex max-h-[88vh] w-full max-w-[340px] flex-col overflow-y-auto overscroll-contain rounded-2xl border bg-[#0b0b12] p-3.5 shadow-[0_28px_90px_rgba(0,0,0,0.85)] akta-dp-pop",
              ac.border,
            )}>
          {/* Header */}
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => stepMonth(-1)}
              className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-white/[0.07] hover:text-white">
              <Icon icon="solar:alt-arrow-left-bold" className="text-sm" />
            </button>
            <p className="text-[12.5px] font-black text-white">{DP_BULAN[viewM]} {viewY}</p>
            <button type="button" onClick={() => stepMonth(1)}
              className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-white/[0.07] hover:text-white">
              <Icon icon="solar:alt-arrow-right-bold" className="text-sm" />
            </button>
          </div>

          {/* Weekday row */}
          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {DP_HARI.map((h, i) => (
              <div key={h} className={cx("py-1 text-center text-[9.5px] font-black uppercase tracking-wide", i >= 5 ? "text-zinc-600" : "text-zinc-500")}>{h}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              const cur = d.getMonth() === viewM;
              const s = isSel(d);
              const t = isToday(d);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(d)}
                  className={cx(
                    "relative grid aspect-square place-items-center rounded-lg text-[12px] transition-all",
                    s
                      ? cx(ac.bg, ac.text, "font-black ring-1", ac.ring)
                      : cur ? "font-semibold text-zinc-200 hover:bg-white/[0.07]" : "text-zinc-600 hover:bg-white/[0.04]",
                  )}
                >
                  {d.getDate()}
                  {t && !s && <span className={cx("absolute bottom-1 h-1 w-1 rounded-full", dotBg)} />}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-2">
            <button type="button" onClick={() => pick(new Date())}
              className={cx("rounded-lg px-2.5 py-1 text-[10.5px] font-bold transition-colors hover:bg-white/[0.06]", ac.text)}>
              Hari ini
            </button>
            {time === undefined && (
              <button type="button" onClick={() => setOpen(false)}
                className="rounded-lg px-2.5 py-1 text-[10.5px] font-bold text-zinc-500 transition-colors hover:text-zinc-300">
                Tutup
              </button>
            )}
          </div>

          {/* Time row */}
          {time !== undefined && (
            <div className="mt-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                  <Icon icon="solar:clock-circle-bold-duotone" className={cx("text-sm", ac.text)} />
                  Pukul
                </span>
                <div className="flex items-center gap-1.5">
                  {([
                    { v: th, up: () => setTime(th + 1, tm), down: () => setTime(th - 1, tm) },
                    { v: tm, up: () => setTime(th, tm + 5), down: () => setTime(th, tm - 5) },
                  ] as const).map((col, ci) => (
                    <React.Fragment key={ci}>
                      {ci === 1 && <span className="pb-1 text-[16px] font-black text-zinc-600">.</span>}
                      <div className="flex flex-col items-center">
                        <button type="button" onClick={col.up}
                          className="grid h-5 w-7 place-items-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.07] hover:text-white">
                          <Icon icon="solar:alt-arrow-up-bold" className="text-[11px]" />
                        </button>
                        <span className="w-8 text-center text-[16px] font-black tabular-nums text-white">{pad2(col.v)}</span>
                        <button type="button" onClick={col.down}
                          className="grid h-5 w-7 place-items-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.07] hover:text-white">
                          <Icon icon="solar:alt-arrow-down-bold" className="text-[11px]" />
                        </button>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {["09.00","10.00","13.00","14.00"].map(p => {
                  const active = `${pad2(th)}.${pad2(tm)}` === p;
                  return (
                    <button key={p} type="button"
                      onClick={() => { const [h, m] = p.split("."); setTime(+h, +m); }}
                      className={cx("rounded-md px-2 py-1 text-[10.5px] font-bold transition-colors",
                        active ? cx(ac.bg, ac.text) : "bg-white/[0.04] text-zinc-400 hover:text-white")}>
                      {p}
                    </button>
                  );
                })}
                <button type="button" onClick={() => setOpen(false)}
                  className={cx("ml-auto rounded-md px-3 py-1 text-[10.5px] font-black transition-colors", ac.btnBg, ac.btnHov, ac.text)}>
                  Selesai
                </button>
              </div>
            </div>
          )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

// ── Scan status badge ─────────────────────────────────────────────────────────

function ScanBadge({ status, warns }: { status: ScanStatus; warns: string[] }) {
  if (status === "idle" || status === "scanning") return null;
  const cfg = {
    valid:   { label: "Terbaca Jelas", icon: "solar:check-circle-bold-duotone",    cls: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/20" },
    review:  { label: "Perlu Dicek",   icon: "solar:danger-triangle-bold-duotone", cls: "text-amber-300 bg-amber-500/10 ring-amber-500/20" },
    invalid: { label: "Tidak Terbaca", icon: "solar:close-circle-bold-duotone",    cls: "text-red-300 bg-red-500/10 ring-red-500/20" },
  }[status];
  return (
    <div className="mt-2 space-y-1">
      <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1", cfg.cls)}>
        <Icon icon={cfg.icon} className="text-xs" />
        {cfg.label}
      </span>
      {warns.map((w, i) => (
        <p key={i} className="flex items-start gap-1 text-[10.5px] text-amber-400/80">
          <Icon icon="solar:point-on-map-bold" className="mt-px shrink-0 text-[9px]" />
          {w}
        </p>
      ))}
    </div>
  );
}

// ── KTP Upload Panel ──────────────────────────────────────────────────────────

function KtpPanel({
  cardAccent, title, subtitle,
  imgUrl, loading, status, warns,
  onFile, pihak, onChange,
}: {
  cardAccent: Accent; title: string; subtitle: string;
  imgUrl: string; loading: boolean; status: ScanStatus; warns: string[];
  onFile: (f: File) => void;
  pihak: Pihak; onChange: (k: keyof Pihak, v: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [drag, setDrag] = useState(false);
  const ac = A[cardAccent];

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };

  // Two-state dropzone: big idle zone → compact strip once image uploaded
  const dropzone = !imgUrl ? (
    // ── State 1: idle / big dropzone ─────────────────────────────────────────
    <div
      className={cx(
        "group relative cursor-pointer select-none overflow-hidden rounded-3xl border border-dashed transition-all duration-300",
        drag
          ? cx(ac.dropDrag, ac.dragGlow)
          : cx("border-white/[0.10] bg-white/[0.02]", ac.dropHover),
      )}
      onClick={() => fileRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
    >
      {/* Laser sweep on hover */}
      <span
        className={cx(
          "pointer-events-none absolute inset-x-6 top-0 h-8 bg-gradient-to-b to-transparent opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100",
          ac.sweep,
        )}
        style={{ animation: drag ? "aktaScan 1.4s linear infinite" : undefined }}
      />

      <div className="relative flex flex-col items-center gap-3.5 px-5 py-9 text-center">
        {/* Icon */}
        <div className={cx(
          "grid h-14 w-14 place-items-center rounded-3xl ring-1 transition-transform duration-300",
          ac.iconRing,
          drag ? "scale-110" : "group-hover:scale-105",
        )}>
          {loading
            ? <Icon icon="solar:refresh-bold-duotone" className={cx("text-2xl animate-spin", ac.iconText)} />
            : <Icon icon="solar:camera-add-bold-duotone" className={cx("text-2xl transition-colors duration-300", drag ? ac.iconText : "text-zinc-500 group-hover:text-zinc-300")} />
          }
        </div>

        {/* Text */}
        <div className="space-y-1">
          <p className="text-[13px] font-black text-white">
            {loading ? "Membaca KTP…" : "Scan KTP"}
          </p>
          {!loading && (
            <p className="text-[11px] leading-relaxed text-zinc-500">
              Tarik &amp; lepas atau klik — <span className={ac.text}>nama, NIK &amp; data</span> terisi otomatis
            </p>
          )}
        </div>

        {/* Format badge */}
        {!loading && (
          <span className={cx("rounded-full px-3 py-1 text-[10px] font-black tracking-wide ring-1", ac.bg, ac.text, ac.ring)}>
            JPG · PNG · WEBP · maks 10 MB
          </span>
        )}
      </div>
    </div>
  ) : (
    // ── State 2: compact strip with thumbnail ─────────────────────────────────
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-2.5">
      {/* Thumbnail */}
      <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/[0.06]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imgUrl} alt="KTP" className="h-full w-full object-cover" />
        {loading && (
          <>
            <div className={cx("absolute inset-0", ac.bg, "opacity-60")} />
            <span
              className={cx("absolute inset-x-0 top-0 h-6 bg-gradient-to-b to-transparent", ac.sweep)}
              style={{ animation: "aktaScan 1.3s linear infinite" }}
            />
          </>
        )}
      </div>

      {/* Status */}
      <div className="min-w-0 flex-1">
        {loading ? (
          <div className="flex items-center gap-2">
            <div className={cx("h-3.5 w-3.5 animate-spin rounded-full border-2 border-transparent", ac.spinner)} />
            <p className={cx("text-[12px] font-semibold", ac.text)}>Membaca KTP…</p>
          </div>
        ) : status !== "idle" && status !== "scanning" ? (
          <ScanBadge status={status} warns={warns} />
        ) : (
          <p className="text-[12px] text-zinc-400">KTP terupload</p>
        )}
      </div>

      {/* Ganti button */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="shrink-0 rounded-xl bg-white/[0.05] px-3 py-2 text-[11px] font-bold text-zinc-300 ring-1 ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white"
      >
        Ganti
      </button>
    </div>
  );

  return (
    <div className={cx("flex flex-col gap-3.5 overflow-hidden rounded-2xl border p-4", ac.border, ac.cardBg)}>
      {/* Panel header */}
      <div className="flex items-center gap-2.5">
        <div className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-xl ring-1", ac.bg, ac.ring)}>
          <Icon icon="solar:card-2-bold-duotone" className={cx("text-base", ac.text)} />
        </div>
        <div>
          <p className="text-[12px] font-black text-white">{title}</p>
          <p className="text-[10px] text-zinc-500">{subtitle}</p>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />

      {dropzone}

      {/* Fields — always visible */}
      <div className="space-y-2.5">
        <F label="Nama Lengkap *">
          <TextInput value={pihak.nama} onChange={v => onChange("nama", v)} placeholder="Sesuai KTP" />
        </F>
        <F label="NIK">
          <TextInput value={pihak.nik} onChange={v => onChange("nik", v)} placeholder="16 digit NIK" />
        </F>
        <div className="grid grid-cols-2 gap-2">
          <F label="Tempat Lahir">
            <TextInput value={pihak.tempat_lahir} onChange={v => onChange("tempat_lahir", v)} placeholder="Kota" />
          </F>
          <F label="Tanggal Lahir">
            <TextInput value={pihak.tgl_lahir} onChange={v => onChange("tgl_lahir", v)} placeholder="25-10-1980" />
          </F>
        </div>
        <F label="Pekerjaan">
          <TextInput value={pihak.pekerjaan} onChange={v => onChange("pekerjaan", v)} placeholder="Wiraswasta / Karyawan / dll" />
        </F>
        <F label="Alamat Lengkap">
          <TextareaInput value={pihak.alamat} onChange={v => onChange("alamat", v)} placeholder="Jl. … No. … RT/RW …/… Kel. … Kec. …" rows={2} />
        </F>
      </div>
    </div>
  );
}

// ── Review helpers ────────────────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.04] py-2 last:border-0">
      <span className="shrink-0 text-[10.5px] text-zinc-500">{label}</span>
      <span className="max-w-[55%] text-right text-[11px] font-semibold text-white">{value || "—"}</span>
    </div>
  );
}

function ReviewSection({ title, icon, rows }: { title: string; icon: string; rows: [string, string][] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.02]">
      <div className="flex items-center gap-2 border-b border-white/[0.05] bg-white/[0.015] px-4 py-2.5">
        <Icon icon={icon} className="shrink-0 text-sm text-zinc-500" />
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{title}</p>
      </div>
      <div className="px-4">
        {rows.map(([l, v]) => <ReviewRow key={l} label={l} value={v} />)}
      </div>
    </div>
  );
}

// ── Section card wrapper ──────────────────────────────────────────────────────

function SectionCard({
  accent, icon, title, subtitle, children,
}: { accent: Accent; icon: string; title: string; subtitle?: string; children: React.ReactNode }) {
  const ac = A[accent];
  return (
    <div className={cx("overflow-hidden rounded-2xl border", ac.border, ac.cardBg)}>
      <div className={cx("flex items-center gap-2.5 border-b px-4 py-3", ac.border, ac.bg)}>
        <div className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-lg ring-1 bg-black/20", ac.ring)}>
          <Icon icon={icon} className={cx("text-sm", ac.text)} />
        </div>
        <div>
          <p className="text-[12px] font-black text-white">{title}</p>
          {subtitle && <p className="text-[10px] text-zinc-500">{subtitle}</p>}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export function AktaKesepakatanModal({ open, template, onClose }: Props) {
  const [mounted, setMounted]     = useState(false);
  const [step, setStep]           = useState(0);
  const [dir, setDir]             = useState<1 | -1>(1);
  const [error, setError]         = useState("");
  const [generating, setGenerating] = useState(false);

  const [p1, setP1] = useState<Pihak>(EMPTY_PIHAK);
  const [p2, setP2] = useState<Pihak>(EMPTY_PIHAK);
  const [p1Img, setP1Img] = useState(""); const [p1Loading, setP1Loading] = useState(false);
  const [p1Status, setP1Status] = useState<ScanStatus>("idle"); const [p1Warns, setP1Warns] = useState<string[]>([]);
  const [p2Img, setP2Img] = useState(""); const [p2Loading, setP2Loading] = useState(false);
  const [p2Status, setP2Status] = useState<ScanStatus>("idle"); const [p2Warns, setP2Warns] = useState<string[]>([]);

  const [risalah, setRisalah] = useState<RisalahData>(EMPTY_RISALAH);
  const [risalahImg, setRisalahImg] = useState("");
  const [risalahName, setRisalahName] = useState("");
  const [risalahLoading, setRisalahLoading] = useState(false);
  const [risalahStatus, setRisalahStatus] = useState<ScanStatus>("idle");
  const [risalahWarns, setRisalahWarns] = useState<string[]>([]);
  const [risalahDrag, setRisalahDrag] = useState(false);
  const risalahRef = useRef<HTMLInputElement | null>(null);

  const [objek, setObjek] = useState<ObjekData>(EMPTY_OBJEK);
  const [komp, setKomp]   = useState<KompData>(EMPTY_KOMP);
  const [akta, setAkta]   = useState<AktaData>(makeDefaultAkta());

  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Tahap 1 bisa diisi sebagai persen dari total atau nominal langsung
  const [tahap1Mode, setTahap1Mode]     = useState<"persen" | "nominal">("nominal");
  const [tahap1Persen, setTahap1Persen] = useState("");
  // Kota penandatanganan diturunkan dari kota/kabupaten alamat aset (kecuali diedit manual)
  const [kotaTtdManual, setKotaTtdManual] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    setStep(0); setDir(1); setError(""); setGenerating(false);
    setP1(EMPTY_PIHAK); setP2(EMPTY_PIHAK);
    setP1Img(""); setP1Loading(false); setP1Status("idle"); setP1Warns([]);
    setP2Img(""); setP2Loading(false); setP2Status("idle"); setP2Warns([]);
    setRisalah(EMPTY_RISALAH); setRisalahImg(""); setRisalahName(""); setRisalahLoading(false);
    setRisalahStatus("idle"); setRisalahWarns([]); setRisalahDrag(false);
    setObjek(EMPTY_OBJEK); setKomp(EMPTY_KOMP); setAkta(makeDefaultAkta());
    setTahap1Mode("nominal"); setTahap1Persen(""); setKotaTtdManual(false);
  }, [open]);

  // Auto-hitung Tahap 1 saat mode persen (persen berubah / total berubah)
  useEffect(() => {
    if (tahap1Mode !== "persen") return;
    const pct = parseFloat(tahap1Persen.replace(",", ".")) || 0;
    const tot = parseInt(komp.kompensasi_total.replace(/\D/g, "") || "0", 10);
    const jml = pct > 0 && tot > 0 ? Math.round((tot * pct) / 100) : 0;
    setKomp(p => (p.tahap1_jumlah === String(jml || "") ? p : { ...p, tahap1_jumlah: jml ? String(jml) : "" }));
  }, [tahap1Mode, tahap1Persen, komp.kompensasi_total]);

  // Kota penandatanganan mengikuti kota/kabupaten alamat aset (pengadilan tetap Surabaya)
  useEffect(() => {
    if (kotaTtdManual) return;
    const kota = objek.obyek_kabupaten.trim().replace(/^(kota|kabupaten|kab\.?)\s+/i, "");
    if (kota) setAkta(p => (p.kota_ttd === kota ? p : { ...p, kota_ttd: kota }));
  }, [objek.obyek_kabupaten, kotaTtdManual]);

  useEffect(() => {
    if (open) { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }
  }, [open]);

  // Scroll ke atas setiap ganti step (Lanjut / Kembali)
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }, [step]);

  useEffect(() => () => { if (p1Img) URL.revokeObjectURL(p1Img); }, [p1Img]);
  useEffect(() => () => { if (p2Img) URL.revokeObjectURL(p2Img); }, [p2Img]);

  // ── KTP OCR ──────────────────────────────────────────────────────────────

  const runKtpOcr = useCallback(async (
    file: File,
    setImg: (s: string) => void,
    setLoading: (b: boolean) => void,
    setStatus: (s: ScanStatus) => void,
    setWarns: (w: string[]) => void,
    setPihak: React.Dispatch<React.SetStateAction<Pihak>>,
  ) => {
    if (file.size > 10 * 1024 * 1024) { alert("Ukuran file maksimal 10 MB."); return; }
    setImg(URL.createObjectURL(file));
    setLoading(true); setStatus("scanning"); setWarns([]);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/surat/ocr-ktp", { method: "POST", body: fd });
      const json: OcrKtpRaw = await res.json();
      const p   = json.parsed ?? {};
      const ext = json.extracted_full ?? {};
      setPihak((prev: Pihak) => ({
        nama:          p.nama           ?? prev.nama,
        nik:           p.nik            ?? prev.nik,
        tempat_lahir:  p.tempat_lahir   ?? prev.tempat_lahir,
        tgl_lahir:     p.tanggal_lahir  ?? prev.tgl_lahir,
        warga_negara:  (ext.warga_negara ?? prev.warga_negara) || "Indonesia",
        pekerjaan:     ext.pekerjaan    ?? prev.pekerjaan,
        alamat:        p.alamat_lengkap ?? prev.alamat,
      }));
      setStatus((json.status as ScanStatus) ?? "review");
      setWarns(json.warnings ?? []);
    } catch {
      setStatus("invalid"); setWarns(["Gagal membaca KTP. Pastikan gambar jelas."]);
    } finally { setLoading(false); }
  }, []);

  const onP1File = useCallback((f: File) =>
    runKtpOcr(f, setP1Img, setP1Loading, setP1Status, setP1Warns, setP1), [runKtpOcr]);
  const onP2File = useCallback((f: File) =>
    runKtpOcr(f, setP2Img, setP2Loading, setP2Status, setP2Warns, setP2), [runKtpOcr]);

  // ── Risalah OCR ───────────────────────────────────────────────────────────

  const onRisalahFile = useCallback(async (file: File) => {
    if (file.size > 20 * 1024 * 1024) { alert("Ukuran file maksimal 20 MB."); return; }
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    setRisalahName(file.name);
    setRisalahImg(isPdf ? "" : URL.createObjectURL(file));
    setRisalahLoading(true); setRisalahStatus("scanning"); setRisalahWarns([]);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/surat/ocr-risalah", { method: "POST", body: fd });
      const json: OcrRisalahRaw = await res.json();
      const p = json.parsed ?? {};
      setRisalah(prev => ({
        ...prev,
        nomor:         p.nomor_risalah ?? prev.nomor,
        tanggal:       p.tanggal_risalah ? isoFromDMY(p.tanggal_risalah) : prev.tanggal,
        kantor_lelang: p.kantor_lelang || prev.kantor_lelang,
      }));
      setObjek(prev => ({
        ...prev,
        jenis_hak:            p.jenis_hak        || prev.jenis_hak,
        nib:                  p.nomor_sertifikat || prev.nib,
        luas:                 p.luas             || prev.luas,
        alamat_obyek:         p.alamat_obyek     || prev.alamat_obyek,
        alamat_obyek_lengkap: p.alamat_obyek     || prev.alamat_obyek_lengkap,
        obyek_kelurahan:      p.kelurahan        || prev.obyek_kelurahan,
        obyek_kecamatan:      p.kecamatan        || prev.obyek_kecamatan,
        obyek_kabupaten:      p.kabupaten        || prev.obyek_kabupaten,
        obyek_provinsi:       p.provinsi         || prev.obyek_provinsi,
      }));
      setRisalahStatus((json.status as ScanStatus) ?? "review");
      setRisalahWarns(json.warnings ?? []);
    } catch {
      setRisalahStatus("invalid"); setRisalahWarns(["Gagal membaca risalah. Isi manual di bawah."]);
    } finally { setRisalahLoading(false); }
  }, []);

  // ── Navigation ────────────────────────────────────────────────────────────

  const step0ok = Boolean(p1.nama.trim()) && !p1Loading && !p2Loading;
  const step1ok = Boolean(risalah.nomor.trim() || objek.alamat_obyek.trim());
  const step2ok = Boolean(komp.kompensasi_total.trim()) && Boolean(komp.batas_tanggal);
  const stepOk  = [step0ok, step1ok, step2ok, true][step] ?? false;

  const goTo   = (n: number) => { setDir(n > step ? 1 : -1); setStep(n); setError(""); };
  const goNext = () => { if (step < 3 && stepOk) goTo(step + 1); };
  const goBack = () => { if (step > 0) goTo(step - 1); };

  // ── Generate ──────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true); setError("");
    try {
      const payload = {
        nomor: akta.nomor, tanggal_akta: akta.tanggal_akta, pukul: akta.pukul,
        pengadilan: akta.pengadilan, kota_ttd: akta.kota_ttd, tanggal_ttd: akta.tanggal_ttd,
        p1_nama: p1.nama, p1_nik: p1.nik, p1_tempat_lahir: p1.tempat_lahir,
        p1_tgl_lahir: p1.tgl_lahir, p1_warga_negara: p1.warga_negara,
        p1_pekerjaan: p1.pekerjaan, p1_alamat: p1.alamat,
        p2_nama: p2.nama, p2_nik: p2.nik, p2_tempat_lahir: p2.tempat_lahir,
        p2_tgl_lahir: p2.tgl_lahir, p2_warga_negara: p2.warga_negara,
        p2_pekerjaan: p2.pekerjaan, p2_alamat: p2.alamat,
        risalah_nomor: risalah.nomor, risalah_tanggal: risalah.tanggal, kantor_lelang: risalah.kantor_lelang,
        ...objek,
        kompensasi_total: komp.kompensasi_total.replace(/\D/g, ""),
        tahap1_jumlah:    komp.tahap1_jumlah.replace(/\D/g, ""),
        // Tahap 1 selalu dibayar saat penandatanganan → tanggalnya = tanggal TTD
        tahap1_tanggal:   akta.tanggal_ttd,
        batas_tanggal:    komp.batas_tanggal,
      };
      const res = await fetch("/api/surat/generate-akta-kesepakatan", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { detail?: string };
        setError(err.detail ?? "Gagal generate dokumen. Coba lagi.");
        return;
      }
      const disp = res.headers.get("Content-Disposition") ?? "";
      const filename = disp.match(/filename="([^"]+)"/)?.[1] ?? "AktaKesepakatan.pdf";
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      console.error(e);
      setError("Gagal menghubungi server.");
    } finally { setGenerating(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (!open || !template || !mounted) return null;

  const anim = dir === 1 ? "akta-slide-r" : "akta-slide-l";

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-4">
      <style>{`
        @keyframes aktaSlideR { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:none} }
        @keyframes aktaSlideL { from{opacity:0;transform:translateX(-24px)} to{opacity:1;transform:none} }
        @keyframes aktaScan   { 0%{top:-2px} 100%{top:calc(100% + 2px)} }
        @keyframes aktaOrb    { 0%,100%{transform:translate(0,0)} 50%{transform:translate(10px,-8px)} }
        @keyframes aktaPop    { from{opacity:0;transform:translateY(6px) scale(.96)} to{opacity:1;transform:none} }
        @keyframes aktaFade   { from{opacity:0} to{opacity:1} }
        .akta-slide-r { animation: aktaSlideR .3s cubic-bezier(.22,1,.36,1) both }
        .akta-slide-l { animation: aktaSlideL .3s cubic-bezier(.22,1,.36,1) both }
        .akta-dp-pop  { animation: aktaPop .18s cubic-bezier(.22,1,.36,1) both; transform-origin: center }
        .akta-dp-fade { animation: aktaFade .18s ease both }
      `}</style>

      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-xl" onClick={generating ? undefined : onClose} />

      {/* Shell */}
      <div
        className="relative flex max-h-[96vh] w-full flex-col overflow-hidden rounded-t-[26px] border border-white/[0.07] bg-[#07070c] shadow-[0_48px_140px_rgba(0,0,0,0.95)] sm:max-w-4xl sm:rounded-[26px]"
        onClick={e => e.stopPropagation()}
      >
        {/* Ambient top line */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
        {/* Ambient orbs */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-amber-500/[0.06] blur-3xl" style={{ animation: "aktaOrb 11s ease-in-out infinite" }} />
        <div className="pointer-events-none absolute -right-28 top-28 h-64 w-64 rounded-full bg-violet-500/[0.05] blur-3xl" style={{ animation: "aktaOrb 14s ease-in-out infinite" }} />
        {/* Dot grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "radial-gradient(circle,rgba(255,255,255,0.8) 1px,transparent 1px)", backgroundSize: "28px 28px" }}
        />

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="relative shrink-0 px-6 pb-4 pt-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-500/25 to-amber-700/5 ring-1 ring-amber-400/25">
                <Icon icon="solar:scale-bold-duotone" className="text-[22px] text-amber-300" />
                <div className="absolute inset-0 rounded-2xl bg-amber-400/8 blur-sm" />
              </div>
              <div>
                <h2 className="text-[16px] font-black tracking-tight text-white">Akta Kesepakatan Bersama</h2>
                <p className="text-[11px] text-zinc-500">Eksekusi Pengosongan · Solusindo Premier · auto-generate PDF</p>
              </div>
            </div>
            <button
              type="button" onClick={generating ? undefined : onClose} disabled={generating}
              className={cx(
                "grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/[0.10] bg-white/[0.06] transition-all",
                generating ? "cursor-not-allowed text-zinc-600" : "text-zinc-300 hover:bg-white/[0.12] hover:text-white hover:border-white/[0.18]",
              )}
            >
              <X className="h-[15px] w-[15px]" />
            </button>
          </div>

          {/* ── Stepper ── */}
          <div className="mt-5 flex items-center">
            {STEPS.map((s, i) => {
              const ac     = A[s.accent];
              const done   = i < step;
              const active = i === step;
              const reach  = i <= step || (i === step + 1 && stepOk);
              return (
                <div key={s.label} className={cx("flex items-center", i < STEPS.length - 1 && "flex-1")}>
                  <button
                    type="button"
                    onClick={() => reach && !generating && goTo(i)}
                    className={cx("group flex items-center gap-2", reach ? "cursor-pointer" : "cursor-not-allowed")}
                  >
                    <span className={cx(
                      "relative grid h-9 w-9 shrink-0 place-items-center rounded-2xl ring-1 transition-all duration-300",
                      done   ? cx(ac.bg, ac.ring)
                      : active ? cx(ac.bg, ac.ring, ac.glow)
                      : "bg-white/[0.03] ring-white/[0.06]",
                    )}>
                      {done
                        ? <Icon icon="solar:check-circle-bold-duotone" className={cx("text-base", ac.text)} />
                        : <Icon icon={s.icon} className={cx("text-sm", active ? ac.text : "text-zinc-600")} />
                      }
                    </span>
                    <span className="hidden text-left lg:block">
                      <span className={cx("block text-[11px] font-black leading-none", active || done ? "text-white" : "text-zinc-600")}>{s.label}</span>
                      <span className="mt-0.5 block text-[9.5px] text-zinc-600">{s.sub}</span>
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <span className="mx-2 h-[2px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500"
                        style={{ width: i < step ? "100%" : "0%" }}
                      />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Generating overlay ── */}
        {generating && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-[#07070c]/95 backdrop-blur-sm">
            <div className="relative grid place-items-center">
              <div className="absolute h-28 w-28 animate-ping rounded-full bg-amber-500/[0.08]" />
              <div className="relative grid h-[72px] w-[72px] place-items-center rounded-full bg-gradient-to-br from-amber-500/25 to-amber-700/5 ring-1 ring-amber-400/30">
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-amber-400" />
                <Icon icon="solar:scale-bold-duotone" className="text-2xl text-amber-300" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-[17px] font-black text-white">Membuat Akta Kesepakatan…</p>
              <p className="mt-1 text-[12px] text-zinc-500">Menyusun dokumen PDF · jangan tutup halaman ini</p>
            </div>
          </div>
        )}

        {/* ── Body ── */}
        <div ref={bodyRef} className={cx("relative flex-1 overflow-y-auto overscroll-contain", generating && "pointer-events-none select-none")}>
          <div key={step} className={cx("px-6 pb-6 pt-2", anim)}>

            {/* Error */}
            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3">
                <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 shrink-0 text-base text-red-400" />
                <p className="text-[13px] leading-relaxed text-red-200">{error}</p>
              </div>
            )}

            {/* ═══ STEP 0 — KTP Para Pihak ═══ */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <KtpPanel
                    cardAccent="cyan"
                    title="Pihak I — Pemenang Lelang"
                    subtitle="Calon pembeli / pemenang lelang"
                    imgUrl={p1Img} loading={p1Loading} status={p1Status} warns={p1Warns}
                    onFile={onP1File}
                    pihak={p1} onChange={(k, v) => setP1(prev => ({ ...prev, [k]: v }))}
                  />
                  <KtpPanel
                    cardAccent="amber"
                    title="Pihak II — Debitur / Penghuni"
                    subtitle="Pemilik lama yang akan dikosongkan"
                    imgUrl={p2Img} loading={p2Loading} status={p2Status} warns={p2Warns}
                    onFile={onP2File}
                    pihak={p2} onChange={(k, v) => setP2(prev => ({ ...prev, [k]: v }))}
                  />
                </div>

                {/* Info bar */}
                <div className="flex items-start gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                  <Icon icon="solar:info-circle-bold-duotone" className="mt-0.5 shrink-0 text-base text-amber-400/70" />
                  <p className="text-[11.5px] leading-relaxed text-zinc-400">
                    Upload foto KTP untuk <span className="font-semibold text-white">auto-isi data</span> via OCR.
                    Semua field bisa diedit manual setelah scan. <span className="text-amber-300/80">Nama Pihak I wajib diisi</span> untuk melanjutkan.
                  </p>
                </div>
              </div>
            )}

            {/* ═══ STEP 1 — Risalah & Objek ═══ */}
            {step === 1 && (
              <div className="space-y-4">
                {/* ── Hero dropzone ── */}
                <SectionCard
                  accent="amber"
                  icon="solar:clipboard-text-bold-duotone"
                  title="Kutipan Risalah Lelang"
                  subtitle="Scan otomatis mengisi seluruh data di bawah"
                >
                  <div className="space-y-4">
                    <input ref={risalahRef} type="file" accept="image/*,application/pdf" className="hidden"
                      onChange={e => e.target.files?.[0] && onRisalahFile(e.target.files[0])} />

                    {!risalahName ? (
                      /* ── State 1: idle dropzone (drag & drop aktif) ── */
                      <div
                        className={cx(
                          "group relative cursor-pointer select-none overflow-hidden rounded-3xl border border-dashed transition-all duration-300",
                          risalahDrag
                            ? cx(A.amber.dropDrag, A.amber.dragGlow)
                            : cx("border-white/[0.10] bg-white/[0.02]", A.amber.dropHover),
                        )}
                        onClick={() => risalahRef.current?.click()}
                        onDragOver={e => { e.preventDefault(); setRisalahDrag(true); }}
                        onDragLeave={() => setRisalahDrag(false)}
                        onDrop={e => { e.preventDefault(); setRisalahDrag(false); const f = e.dataTransfer.files[0]; if (f) onRisalahFile(f); }}
                      >
                        <span
                          className={cx("pointer-events-none absolute inset-x-6 top-0 h-8 bg-gradient-to-b to-transparent opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100", A.amber.sweep)}
                          style={{ animation: risalahDrag ? "aktaScan 1.4s linear infinite" : undefined }}
                        />
                        <div className="relative flex flex-col items-center gap-3.5 px-5 py-10 text-center">
                          <div className={cx(
                            "grid h-16 w-16 place-items-center rounded-3xl ring-1 transition-transform duration-300",
                            A.amber.iconRing,
                            risalahDrag ? "scale-110" : "group-hover:scale-105",
                          )}>
                            <Icon icon="solar:document-add-bold-duotone" className={cx("text-[26px] transition-colors duration-300", risalahDrag ? A.amber.iconText : "text-zinc-500 group-hover:text-zinc-300")} />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[14px] font-black text-white">Tarik &amp; lepas Kutipan Risalah</p>
                            <p className="text-[11.5px] leading-relaxed text-zinc-500">
                              atau klik untuk pilih — <span className={A.amber.text}>jenis hak, luas, lokasi &amp; tanggal</span> terisi otomatis
                            </p>
                          </div>
                          <span className={cx("rounded-full px-3.5 py-1.5 text-[10px] font-black tracking-wide ring-1", A.amber.bg, A.amber.text, A.amber.ring)}>
                            PDF · JPG · PNG · maks 20 MB
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* ── State 2: file strip ── */
                      <div className={cx(
                        "flex items-center gap-3 rounded-2xl border p-2.5 transition-colors",
                        risalahLoading ? "border-amber-500/25 bg-amber-500/[0.05]" : "border-white/[0.07] bg-white/[0.02]",
                      )}>
                        <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/[0.06]">
                          {risalahImg
                            ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={risalahImg} alt="Risalah" className="h-full w-full object-cover" />
                            : <Icon icon="solar:file-text-bold-duotone" className="text-[26px] text-amber-300/80" />}
                          {risalahLoading && (
                            <>
                              <div className="absolute inset-0 bg-amber-500/20" />
                              <span className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-amber-400/50 to-transparent" style={{ animation: "aktaScan 1.3s linear infinite" }} />
                            </>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-bold text-white">{risalahName}</p>
                          {risalahLoading ? (
                            <div className="mt-1.5 flex items-center gap-2">
                              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-transparent border-t-amber-400" />
                              <p className="text-[11px] font-semibold text-amber-300">Membaca risalah…</p>
                            </div>
                          ) : risalahStatus !== "idle" && risalahStatus !== "scanning" ? (
                            <div className="mt-0.5"><ScanBadge status={risalahStatus} warns={[]} /></div>
                          ) : (
                            <p className="mt-1 text-[11px] text-zinc-500">File terupload</p>
                          )}
                        </div>
                        <button type="button" onClick={() => risalahRef.current?.click()}
                          className="shrink-0 rounded-xl bg-white/[0.05] px-3 py-2 text-[11px] font-bold text-zinc-300 ring-1 ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white">
                          Ganti
                        </button>
                      </div>
                    )}

                    {/* Warnings */}
                    {risalahWarns.length > 0 && !risalahLoading && (
                      <div className="space-y-1 rounded-xl border border-amber-500/15 bg-amber-500/[0.04] px-3 py-2.5">
                        {risalahWarns.map((w, i) => (
                          <p key={i} className="flex items-start gap-1.5 text-[10.5px] text-amber-400/80">
                            <Icon icon="solar:info-circle-bold" className="mt-px shrink-0 text-[11px]" />{w}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Risalah fields */}
                    <div className="grid grid-cols-2 gap-3">
                      <F label="Nomor Risalah *">
                        <TextInput value={risalah.nomor} onChange={v => setRisalah(p => ({ ...p, nomor: v }))} placeholder="144/10.01/2026-01" />
                      </F>
                      <F label="Tanggal Lelang">
                        <DatePicker accent="amber" value={risalah.tanggal} onChange={v => setRisalah(p => ({ ...p, tanggal: v }))} />
                      </F>
                    </div>
                    <F label="Kantor Pelayanan Lelang (KPKNL)">
                      <TextInput value={risalah.kantor_lelang} onChange={v => setRisalah(p => ({ ...p, kantor_lelang: v }))} placeholder="KPKNL Surabaya" />
                    </F>
                  </div>
                </SectionCard>

                {/* ── Objek ── */}
                <SectionCard
                  accent="violet"
                  icon="solar:home-2-bold-duotone"
                  title="Data Objek Lelang"
                  subtitle="Identitas sertifikat & lokasi — terisi dari scan"
                >
                  <div className="space-y-3">
                    {/* Spesifikasi sertifikat */}
                    <div className="grid grid-cols-3 gap-3">
                      <F label="Jenis Hak">
                        <TextInput value={objek.jenis_hak} onChange={v => setObjek(p => ({ ...p, jenis_hak: v }))} placeholder="SHM" />
                      </F>
                      <F label="No. Sertifikat">
                        <TextInput value={objek.nib} onChange={v => setObjek(p => ({ ...p, nib: v }))} placeholder="4823" />
                      </F>
                      <F label="Luas (m²)">
                        <TextInput value={objek.luas} onChange={v => setObjek(p => ({ ...p, luas: v }))} placeholder="163" />
                      </F>
                    </div>

                    <F label="Alamat Objek">
                      <TextareaInput value={objek.alamat_obyek} onChange={v => setObjek(p => ({ ...p, alamat_obyek: v, alamat_obyek_lengkap: v }))} placeholder="Kelurahan … Kecamatan … Kota … Provinsi …" rows={2} />
                    </F>

                    <div className="grid grid-cols-2 gap-3">
                      <F label="Kelurahan"><TextInput value={objek.obyek_kelurahan} onChange={v => setObjek(p => ({ ...p, obyek_kelurahan: v }))} placeholder="Babatan" /></F>
                      <F label="Kecamatan"><TextInput value={objek.obyek_kecamatan} onChange={v => setObjek(p => ({ ...p, obyek_kecamatan: v }))} placeholder="Wiyung" /></F>
                      <F label="Kabupaten / Kota"><TextInput value={objek.obyek_kabupaten} onChange={v => setObjek(p => ({ ...p, obyek_kabupaten: v }))} placeholder="Kota Surabaya" /></F>
                      <F label="Provinsi"><TextInput value={objek.obyek_provinsi} onChange={v => setObjek(p => ({ ...p, obyek_provinsi: v }))} placeholder="Jawa Timur" /></F>
                    </div>
                  </div>
                </SectionCard>
              </div>
            )}

            {/* ═══ STEP 2 — Kompensasi ═══ */}
            {step === 2 && (
              <div className="space-y-4">
                {/* Total */}
                <SectionCard
                  accent="violet"
                  icon="solar:hand-money-bold-duotone"
                  title="Nilai Kompensasi"
                  subtitle="Jumlah total dan pembayaran bertahap"
                >
                  <div className="space-y-4">
                    {/* Big rupiah input */}
                    <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.06] p-4">
                      <FieldLabel>Total Kompensasi *</FieldLabel>
                      <input
                        type="text" inputMode="numeric"
                        value={komp.kompensasi_total ? fmtRupiah(komp.kompensasi_total) : ""}
                        placeholder="Rp 0"
                        onChange={e => setKomp(p => ({ ...p, kompensasi_total: e.target.value.replace(/\D/g, "") }))}
                        className="mt-1 w-full bg-transparent text-[22px] font-black text-white placeholder:text-zinc-600 outline-none"
                      />
                    </div>

                    {/* Tahap 1 */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Pembayaran Tahap 1</p>
                        {/* Toggle: persen dari total / nominal langsung */}
                        <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/[0.06]">
                          {(["persen", "nominal"] as const).map(m => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setTahap1Mode(m)}
                              className={cx(
                                "rounded-md px-2.5 py-1 text-[10px] font-black transition-all",
                                tahap1Mode === m ? "bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/30" : "text-zinc-500 hover:text-zinc-300",
                              )}
                            >
                              {m === "persen" ? "% Persen" : "Rp Nominal"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {tahap1Mode === "persen" ? (
                        <div className="grid grid-cols-2 gap-3">
                          <F label="Persen dari Total">
                            <div className="relative">
                              <input
                                type="text" inputMode="decimal"
                                value={tahap1Persen}
                                placeholder="30"
                                onChange={e => setTahap1Persen(e.target.value.replace(/[^0-9.,]/g, ""))}
                                className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5 pr-8 text-[13px] font-bold text-white placeholder:text-zinc-600 outline-none transition-all focus:border-violet-400/40 focus:ring-2 focus:ring-violet-500/10"
                              />
                              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] font-bold text-zinc-500">%</span>
                            </div>
                          </F>
                          <F label="Jumlah Tahap 1 (otomatis)">
                            <div className="flex h-[42px] items-center rounded-xl border border-violet-500/20 bg-violet-500/[0.06] px-3.5 text-[13px] font-black text-violet-200">
                              {komp.tahap1_jumlah ? fmtRupiah(komp.tahap1_jumlah) : "Rp 0"}
                            </div>
                          </F>
                        </div>
                      ) : (
                        <F label="Jumlah Tahap 1">
                          <input
                            type="text" inputMode="numeric"
                            value={komp.tahap1_jumlah ? fmtRupiah(komp.tahap1_jumlah) : ""}
                            placeholder="Rp 0"
                            onChange={e => setKomp(p => ({ ...p, tahap1_jumlah: e.target.value.replace(/\D/g, "") }))}
                            className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5 text-[13px] font-bold text-white placeholder:text-zinc-600 outline-none transition-all focus:border-violet-400/40 focus:ring-2 focus:ring-violet-500/10"
                          />
                        </F>
                      )}
                      <p className="flex items-center gap-1.5 text-[10.5px] text-zinc-500">
                        <Icon icon="solar:info-circle-bold" className="shrink-0 text-[11px] text-violet-400/70" />
                        Tahap 1 dibayar saat penandatanganan akta — tanggalnya otomatis mengikuti tanggal TTD.
                      </p>
                    </div>

                    {/* Tahap 2 auto */}
                    {komp.tahap1_jumlah && komp.kompensasi_total && (
                      <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3">
                        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                          <Icon icon="solar:calculator-bold-duotone" className="text-emerald-400" />
                          Sisa Tahap 2 (otomatis)
                        </div>
                        <span className="text-[14px] font-black text-emerald-300">
                          {tahap2Val(komp.kompensasi_total, komp.tahap1_jumlah)}
                        </span>
                      </div>
                    )}
                  </div>
                </SectionCard>

                {/* Detail akta */}
                <SectionCard
                  accent="emerald"
                  icon="solar:pen-new-square-bold-duotone"
                  title="Detail Akta & Penandatanganan"
                  subtitle="Jadwal penandatanganan dan batas pengosongan"
                >
                  <div className="space-y-3">
                    <F label="Tanggal & Waktu Penandatanganan Akta">
                      <DatePicker
                        accent="emerald"
                        value={akta.tanggal_ttd}
                        onChange={v => setAkta(p => ({ ...p, tanggal_ttd: v, tanggal_akta: v }))}
                        time={akta.pukul}
                        onTimeChange={t => setAkta(p => ({ ...p, pukul: t }))}
                      />
                    </F>
                    <F label="Tanggal Paling Lambat Pengosongan *">
                      <DatePicker
                        accent="emerald"
                        value={komp.batas_tanggal}
                        onChange={v => setKomp(p => ({ ...p, batas_tanggal: v }))}
                      />
                    </F>
                    <p className="flex items-center gap-1.5 text-[10.5px] text-zinc-500">
                      <Icon icon="solar:info-circle-bold" className="shrink-0 text-[11px] text-emerald-400/70" />
                      Nomor akta, pengadilan (Surabaya) & kota penandatanganan terisi otomatis.
                    </p>
                  </div>
                </SectionCard>
              </div>
            )}

            {/* ═══ STEP 3 — Review ═══ */}
            {step === 3 && (
              <div className="space-y-4">
                {/* Hero */}
                <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.07] to-transparent p-5">
                  <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-400/10 blur-2xl" />
                  <div className="relative flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-400/25">
                      <Icon icon="solar:magic-stick-bold-duotone" className="text-lg text-emerald-300" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Siap Generate</p>
                      <p className="mt-0.5 text-[15px] font-black text-white">Akta Kesepakatan Bersama</p>
                      <p className="text-[11.5px] text-zinc-400">{p1.nama || "—"} ↔ {p2.nama || "—"}</p>
                    </div>
                  </div>
                </div>

                <ReviewSection icon="solar:user-bold-duotone" title="Pihak I — Pemenang Lelang" rows={[
                  ["Nama", p1.nama],
                  ["NIK", p1.nik],
                  ["Kewarganegaraan", p1.warga_negara],
                  ["Tempat, Tgl Lahir", [p1.tempat_lahir, p1.tgl_lahir].filter(Boolean).join(", ")],
                  ["Pekerjaan", p1.pekerjaan],
                  ["Alamat", p1.alamat],
                ]} />

                <ReviewSection icon="solar:user-bold-duotone" title="Pihak II — Debitur / Penghuni" rows={[
                  ["Nama", p2.nama],
                  ["NIK", p2.nik],
                  ["Kewarganegaraan", p2.warga_negara],
                  ["Tempat, Tgl Lahir", [p2.tempat_lahir, p2.tgl_lahir].filter(Boolean).join(", ")],
                  ["Pekerjaan", p2.pekerjaan],
                  ["Alamat", p2.alamat],
                ]} />

                <ReviewSection icon="solar:document-text-bold-duotone" title="Risalah & Objek" rows={[
                  ["Nomor Risalah", risalah.nomor],
                  ["Tanggal Lelang", fmtDateDisplay(risalah.tanggal)],
                  ["KPKNL", risalah.kantor_lelang],
                  ["Jenis Hak / NIB", [objek.jenis_hak, objek.nib].filter(Boolean).join(" · ")],
                  ["Luas", objek.luas ? `${objek.luas} m²` : ""],
                  ["Lokasi", [objek.obyek_kelurahan, objek.obyek_kecamatan, objek.obyek_kabupaten].filter(Boolean).join(", ")],
                  ["Alamat Objek", objek.alamat_obyek],
                ]} />

                <ReviewSection icon="solar:hand-money-bold-duotone" title="Kompensasi & Pengosongan" rows={[
                  ["Total Kompensasi", komp.kompensasi_total ? fmtRupiah(komp.kompensasi_total) : "—"],
                  ["Tahap 1 (saat TTD)", komp.tahap1_jumlah ? `${fmtRupiah(komp.tahap1_jumlah)} · ${fmtDateDisplay(akta.tanggal_ttd)}` : "—"],
                  ["Tahap 2 (sisa)", tahap2Val(komp.kompensasi_total, komp.tahap1_jumlah) || "—"],
                  ["Batas Pengosongan", fmtDateDisplay(komp.batas_tanggal)],
                  ["Pengadilan", akta.pengadilan],
                  ["Penandatanganan", `${fmtDateDisplay(akta.tanggal_ttd)}${akta.pukul ? ` · ${akta.pukul}` : ""}`],
                  ["Kota Penandatanganan", akta.kota_ttd],
                ]} />

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating || !p1.nama.trim() || !p2.nama.trim()}
                  className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 py-4 text-[14px] font-black tracking-wide text-black shadow-[0_4px_24px_rgba(251,146,60,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(251,146,60,0.50)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:translate-y-0"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <Icon icon="solar:bolt-bold" className="text-base" />
                    Generate PDF Sekarang
                  </span>
                  <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-[100%]" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer nav ── */}
        {step < 3 && (
          <div className="relative shrink-0 border-t border-white/[0.05] bg-[#07070c]/80 px-6 py-4 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button" onClick={goBack} disabled={step === 0}
                className="flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-[12px] font-bold text-zinc-400 transition-all hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Icon icon="solar:alt-arrow-left-bold" className="text-xs" />
                Kembali
              </button>

              {/* Progress dots */}
              <div className="flex items-center gap-1.5">
                {STEPS.map((_, i) => (
                  <span key={i} className={cx(
                    "h-1.5 rounded-full transition-all duration-300",
                    i === step ? "w-6 bg-gradient-to-r from-amber-400 to-orange-400" : i < step ? "w-1.5 bg-amber-500/60" : "w-1.5 bg-white/10",
                  )} />
                ))}
              </div>

              <button
                type="button" onClick={goNext} disabled={!stepOk}
                className={cx(
                  "flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[12px] font-black ring-1 transition-all duration-200",
                  A.amber.btnBg, A.amber.btnHov, A.amber.text,
                  "ring-amber-500/25 hover:ring-amber-400/35",
                  "disabled:cursor-not-allowed disabled:opacity-30",
                )}
              >
                Lanjut
                <Icon icon="solar:alt-arrow-right-bold" className="text-xs" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

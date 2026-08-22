"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Listing } from "../../page";
import Money from "../ui/Money";
import { Icon } from "@iconify/react";
import { hitungBalikNama } from "@/lib/lelangBiaya";

/* =========================================
  Types
========================================= */
export type SkemaPenjualan = "PERSENTASE" | "SELISIH";

type PersistedState = {
  step: 1 | 2 | 3;
  deal: number;
  bidding: number;
  limitInput: number;
  komisiStr: string;

  balikNamaMode: "AUTO" | "MANUAL";
  balikNama: number;
  eksekusi: number;

  includeBalikNama: boolean;
  includeEksekusi: boolean;

  cobroke: number;

  selisihKotor: number;
  selisihSebelumRoyalty: number;
  selisihFinal: number;
};

type Props = {
  listing: Listing;
  skemaPenjualan: SkemaPenjualan;
  onNextToPembagian?: () => void;
  onBack?: () => void;
  agent: { id_agent: string; isLuar?: boolean; luarNama?: string; luarKantor?: string; luarTelepon?: string } | null;
  klienData: { id_klien: string | null; nama_klien: string; nik_klien: string; alamat_klien: string };
  ktpFile?: File | null;
  statusTransaksi?: string | null;
  onSaveSuccess?: (transaksiId: string) => void;
  prefill?: any;
  isClosingMode?: boolean;
};

/* =========================================
  Utils: formatting & parsing
========================================= */
const fmt = new Intl.NumberFormat("id-ID");

function nonNeg(v: number) {
  return v < 0 ? 0 : v;
}
function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}
function formatInt(v: number) {
  return fmt.format(Number.isFinite(v) ? Math.trunc(v) : 0);
}
function parseDigits(raw: string) {
  let d = (raw ?? "").replace(/[^\d]/g, "");
  d = d.replace(/^0+(?=\d)/, "");
  if (!d) return 0;
  const val = parseInt(d, 10);
  return Number.isFinite(val) ? val : 0;
}

// percent: allow 2,5 or 2.5 (keep display with comma)
function sanitizePercent(raw: string) {
  let s = (raw ?? "").trim();
  s = s.replace(/[^\d.,]/g, "");

  const sep = s.search(/[.,]/);
  if (sep >= 0) {
    const head = s.slice(0, sep);
    let tail = s.slice(sep + 1).replace(/[.,]/g, "");
    tail = tail.slice(0, 2);
    s = head + "," + tail;
  }

  if (s.includes(",")) {
    const [a, b] = s.split(",");
    const a2 = a.replace(/^0+(?=\d)/, "") || "0";
    s = a2 + "," + b;
  } else {
    s = s.replace(/^0+(?=\d)/, "");
    if (!s) s = "0";
  }
  return s;
}
function percentToNumber(s: string) {
  const val = Number((s ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(val) ? val : 0;
}

function pct2(v: number) {
  const s = (v * 100).toFixed(2);
  return s.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function autoBalikNama(base: number) {
  // Tarif tunggal dipegang src/lib/lelangBiaya.ts supaya angka di halaman
  // closing tidak pernah berbeda dengan estimasi di halaman detail lelang.
  return hitungBalikNama(base);
}

function storageKey(listing: Listing) {
  return `closing:transaksi:${String(
    (listing as any)?.id_property ?? listing?.id_property ?? ""
  )}`;
}

/* =========================================
  UI building blocks
========================================= */
function ShellCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-[32px] border border-white/10",
        "bg-white/[0.035] ",
        "shadow-[0_40px_120px_rgba(0,0,0,0.65)]",
        className,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:32px_32px]" />


        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/45" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/30 to-transparent" />
      </div>

      <div className="relative p-5 sm:p-6">{children}</div>
    </div>
  );
}

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const items = [
    { k: 1, t: "Transaksi", d: "Harga & komisi" },
    { k: 2, t: "Biaya", d: "Balik nama & eksekusi" },
    { k: 3, t: "Review", d: "Fee kantor & ringkasan" },
  ] as const;

  const pct = step === 1 ? "w-1/3" : step === 2 ? "w-2/3" : "w-[95%]";

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-3">
        {items.map((it) => {
          const active = it.k === step;
          const done = it.k < step;

          return (
            <div key={it.k} className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <div
                  className={[
                    "grid h-9 w-9 place-items-center rounded-2xl border text-xs font-semibold",
                    done
                      ? "border-emerald-400/25 bg-emerald-400 text-black shadow-[0_0_18px_rgba(16,185,129,0.35)]"
                      : active
                      ? "border-emerald-300/35 bg-emerald-500/10 text-emerald-100"
                      : "border-white/10 bg-white/5 text-zinc-400",
                  ].join(" ")}
                >
                  {done ? (
                    <Icon icon="solar:check-circle-linear" className="text-xl" />
                  ) : (
                    it.k
                  )}
                </div>

                <div className="min-w-0">
                  <div
                    className={
                      active
                        ? "text-white font-semibold"
                        : "text-zinc-300 font-semibold"
                    }
                  >
                    {it.t}
                  </div>
                  <div className="text-[11px] text-zinc-500 truncate">
                    {it.d}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 h-2 rounded-full bg-white/5 border border-white/10 overflow-hidden">
        <div
          className={[
            "h-full rounded-full bg-gradient-to-r from-emerald-300/60 to-emerald-400/30",
            pct,
          ].join(" ")}
        />
      </div>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1 text-[12px] font-semibold text-zinc-200">
      {children}
    </div>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <div className="mt-1 text-[11px] text-zinc-500">{children}</div>;
}

function RpInput({
  value,
  onChange,
  placeholder = "0",
  disabled,
  inputRef,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  disabled?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div
      className={[
        "group relative overflow-hidden rounded-2xl border ",
        disabled
          ? "border-white/8 bg-white/[0.03] opacity-60"
          : "border-white/10 bg-white/[0.04] hover:border-white/15",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/7 via-transparent to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/25 to-transparent opacity-0 transition group-focus-within:opacity-100" />

      <div className="relative flex h-12">
        <div className="flex w-14 items-center justify-center border-r border-white/10 bg-black/25 text-zinc-200">
          Rp
        </div>
        <input
          ref={inputRef as any}
          disabled={disabled}
          inputMode="numeric"
          pattern="[0-9]*"
          value={value ? formatInt(value) : ""}
          onChange={(e) => onChange(parseDigits(e.target.value))}
          placeholder={placeholder}
          className="h-full w-full bg-transparent px-4 text-white outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}

function PercentInput({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={[
        "group relative overflow-hidden rounded-2xl border ",
        disabled
          ? "border-white/8 bg-white/[0.03] opacity-60"
          : "border-white/10 bg-white/[0.04] hover:border-white/15",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/7 via-transparent to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/25 to-transparent opacity-0 transition group-focus-within:opacity-100" />

      <div className="relative flex h-12">
        <input
          disabled={disabled}
          readOnly={disabled}
          value={value}
          onChange={(e) => !disabled && onChange(sanitizePercent(e.target.value))}
          className="h-full w-full bg-transparent px-4 text-white outline-none placeholder:text-zinc-600 disabled:cursor-default"
          placeholder="0"
          inputMode="decimal"
        />
        <div className="flex w-14 items-center justify-center border-l border-white/10 bg-black/25 text-zinc-200">
          %
        </div>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  desc,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc?: string;
  disabled?: boolean;
}) {
  const active = checked && !disabled;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={[
        "group flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition",
        disabled
          ? "cursor-not-allowed border-white/[0.05] bg-white/[0.02] opacity-50"
          : active
          ? "border-emerald-500/20 bg-emerald-500/[0.07] hover:bg-emerald-500/[0.10]"
          : "border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.12]",
      ].join(" ")}
    >
      <div className="min-w-0 flex-1">
        <div className={["text-sm font-semibold", active ? "text-emerald-100" : "text-zinc-200"].join(" ")}>
          {label}
        </div>
        {desc ? (
          <div className="mt-0.5 text-[11px] text-zinc-500">{desc}</div>
        ) : null}
      </div>

      {/* track */}
      <div
        className={[
          "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
          active ? "bg-emerald-500" : "bg-zinc-700/60",
        ].join(" ")}
      >
        {/* thumb */}
        <span
          className={[
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200",
            active ? "left-[22px]" : "left-0.5",
          ].join(" ")}
        />
      </div>
    </button>
  );
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
      <div className="flex items-start gap-2">
        <Icon
          icon="solar:danger-triangle-linear"
          className="mt-[2px] text-lg text-amber-200"
        />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

/* =========================================
  Main Component
========================================= */
export default function TabTransaksi({
  listing,
  skemaPenjualan,
  onNextToPembagian,
  onBack,
  agent,
  klienData,
  ktpFile,
  statusTransaksi,
  onSaveSuccess,
  prefill,
  isClosingMode = false,
}: Props) {
  const router = useRouter();
  const isLelang = listing.jenis_transaksi === "LELANG";
  const isSelisih = isLelang && skemaPenjualan === "SELISIH";
  const isPersen = isLelang && skemaPenjualan === "PERSENTASE";

  const limit = n((listing as any).nilai_limit_lelang);
  const key = storageKey(listing);

  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [deal, setDeal] = useState(0);
  const [bidding, setBidding] = useState(0);
  const [limitInput, setLimitInput] = useState(limit);
  const [komisiStr, setKomisiStr] = useState("5");

  const [balikNamaMode, setBalikNamaMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const [balikNama, setBalikNama] = useState(0);
  const [eksekusi, setEksekusi] = useState(0);

  const [includeBalikNama, setIncludeBalikNama] = useState(true);
  const [includeEksekusi, setIncludeEksekusi] = useState(true);

  const [cobroke, setCobroke] = useState(0);
  const [hargaBidding, setHargaBidding] = useState(0);

  useEffect(() => {
    setHydrated(false);

    try {
      // Closing mode: gunakan localStorage HANYA jika ditulis di sesi ini (ada marker _closing_session),
      // supaya back dari TabPembagian tidak kehilangan input user
      const rawStored = localStorage.getItem(key);
      const isSessionStorage = (() => {
        if (!rawStored) return false;
        try { return !!(JSON.parse(rawStored) as any)._closing_session; } catch { return false; }
      })();
      const raw = isClosingMode ? (isSessionStorage ? rawStored : null) : rawStored;
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedState;

        // step selalu mulai dari 1 (Harga & Komisi) setiap kali tab ini dibuka
        setStep(1);
        setDeal(n(parsed.deal));
        setBidding(n(parsed.bidding));
        setLimitInput(n(parsed.limitInput ?? limit));
        const rawKomisi = typeof parsed.komisiStr === "string" ? parsed.komisiStr : "5";
        const komisiFloat = parseFloat(rawKomisi.replace(",", "."));
        // migrate: if stored as decimal fraction (e.g. "0.05"), convert to percentage ("5")
        setKomisiStr(!isNaN(komisiFloat) && komisiFloat > 0 && komisiFloat < 1
          ? pct2(komisiFloat)
          : (rawKomisi || "5"));

        setBalikNamaMode(parsed.balikNamaMode === "MANUAL" ? "MANUAL" : "AUTO");
        setBalikNama(n(parsed.balikNama));
        setEksekusi(n(parsed.eksekusi));

        setIncludeBalikNama(!!parsed.includeBalikNama);
        setIncludeEksekusi(!!parsed.includeEksekusi);

        setCobroke(n(parsed.cobroke));
        if ((parsed as any).hargaBidding) setHargaBidding(n((parsed as any).hargaBidding));
      } else if (prefill) {
        // Tidak ada data lokal — prefill dari MOU/transaksi
        setStep(1);
        const trx = prefill.trx;

        if (prefill.tipeKomisi?.toUpperCase() === "SELISIH") {
          setDeal(n(prefill.hargaDeal));
        } else {
          // PERSENTASE: bidding dari transaksi (cobroke_fee lebih ke cobroke) atau maksimumBidding MOU
          setBidding(n(trx?.hargaBidding || prefill.maksimumBidding));
        }
        setLimitInput(n(prefill.hargaLimit || limit));

        const komisiDecimal = n(prefill.persentaseKomisi);
        // stored as fraction (0.05 = 5%), convert back to percent for display
        setKomisiStr(komisiDecimal > 0 ? pct2(komisiDecimal) : "5");

        const bnVal = n(trx?.biayaBaliknama || prefill.biayaBaliknama);
        if (bnVal > 0) {
          setBalikNamaMode("MANUAL");
          setBalikNama(bnVal);
        }
        setEksekusi(n(trx?.biayaPengosongan || prefill.biayaPengosongan));
        setIncludeBalikNama(!!(prefill.termasukBaliknama));
        setIncludeEksekusi(!!(prefill.termasukPengosongan));
        setCobroke(n(trx?.cobrokeFee));
        setHargaBidding(n(trx?.hargaBidding));
      }
    } catch {
      // ignore
    } finally {
      setHydrated(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const baseBalikNama = useMemo(
    () => (isSelisih ? deal : bidding),
    [isSelisih, deal, bidding]
  );

  useEffect(() => {
    if (isClosingMode) return;
    if (balikNamaMode === "AUTO") {
      setBalikNama(autoBalikNama(baseBalikNama));
    }
  }, [balikNamaMode, baseBalikNama, isClosingMode]);

  const komisiPct = useMemo(() => percentToNumber(komisiStr), [komisiStr]);

  const biayaIncluded = useMemo(() => {
    if (!isSelisih) return 0;
    return (includeBalikNama ? nonNeg(balikNama) : 0) + (includeEksekusi ? nonNeg(eksekusi) : 0);
  }, [isSelisih, includeBalikNama, includeEksekusi, balikNama, eksekusi]);

  const effectiveLimit = isPersen ? limitInput : limit;
  const warnDealBelowLimit = isSelisih && limit > 0 && deal > 0 && deal < limit;
  const warnBidBelowLimit = isLelang && effectiveLimit > 0 && bidding > 0 && bidding < effectiveLimit;
  const warnHargaBiddingBelowLimit = isClosingMode && isLelang && hargaBidding > 0 && hargaBidding < effectiveLimit;
  const warnHargaBiddingAboveMax = isClosingMode && isPersen && hargaBidding > 0 && bidding > 0 && hargaBidding > bidding;
  const minKomisiPct = 5;
  const warnKomisiTerlalu = isPersen && komisiPct > 0 && komisiPct < minKomisiPct;

  // In closing mode use hargaBidding aktual for both SELISIH and PERSENTASE
  const biddingForCalc = isClosingMode && hargaBidding > 0
    ? hargaBidding
    : isSelisih ? effectiveLimit : bidding;

  const step1Valid = useMemo(() => {
    if (!isLelang) return true;
    if (isSelisih) {
      if (isClosingMode) return deal > 0 && hargaBidding > 0 && !warnHargaBiddingBelowLimit;
      return deal > 0;
    }
    if (isPersen) {
      const base = bidding > 0 && !warnBidBelowLimit && komisiPct >= minKomisiPct;
      if (isClosingMode) return base && hargaBidding > 0 && !warnHargaBiddingBelowLimit && !warnHargaBiddingAboveMax;
      return base;
    }
    return true;
  }, [isLelang, isSelisih, isPersen, deal, bidding, warnBidBelowLimit, komisiPct, isClosingMode, hargaBidding, warnHargaBiddingBelowLimit, warnHargaBiddingAboveMax]);

  // untuk isPersen: pendapatanKotor = biddingForCalc × komisi% (aktual di closing mode)
  const pendapatanKotor = useMemo(() => {
    if (!isPersen) return 0;
    return Math.round(nonNeg(biddingForCalc * komisiPct / 100));
  }, [isPersen, biddingForCalc, komisiPct]);

  const selisihKotor = useMemo(() => {
    if (!isLelang) return 0;
    if (isSelisih) return nonNeg(deal - biddingForCalc);
    if (isPersen) return pendapatanKotor;
    return 0;
  }, [isLelang, isSelisih, isPersen, deal, biddingForCalc, pendapatanKotor]);

  const selisihSebelumRoyalty = useMemo(() => {
    if (!isLelang) return 0;
    if (isSelisih) return nonNeg(selisihKotor - biayaIncluded);
    return selisihKotor;
  }, [isLelang, isSelisih, selisihKotor, biayaIncluded]);

  // No royalty
  const royaltyFee = 0;

  // selisihFinal = selisihSebelumRoyalty (no royalty deduction)
  const selisihFinal = selisihSebelumRoyalty;

  // komisi agent base (sebelum cobroke) — 60/40 split
  const komisiAgentBase = useMemo(() => {
    if (isPersen) return Math.round(nonNeg(pendapatanKotor) * 0.6);
    return Math.round(nonNeg(selisihFinal) * 0.6);
  }, [isPersen, pendapatanKotor, selisihFinal]);

  // komisi agent net = base - cobroke (tidak bisa negatif)
  const komisiAgent = useMemo(() => {
    return nonNeg(komisiAgentBase - nonNeg(cobroke));
  }, [komisiAgentBase, cobroke]);

  // PERSENTASE: 40% of total komisi; SELISIH: remaining after 60% to agent
  const pendapatanBersihKantor = useMemo(() => {
    if (isPersen) return nonNeg(pendapatanKotor * 0.4);
    return nonNeg(selisihFinal - komisiAgent);
  }, [isPersen, pendapatanKotor, komisiAgent, selisihFinal]);

  const kenaikanDariLimit = useMemo(() => {
    if (!isLelang || effectiveLimit <= 0) return 0;
    const pembanding = isSelisih ? deal : biddingForCalc;
    if (pembanding <= 0) return 0;
    return (pembanding - effectiveLimit) / effectiveLimit;
  }, [isLelang, isSelisih, deal, biddingForCalc, effectiveLimit]);

  useEffect(() => {
    if (!hydrated) return;

    const payload: PersistedState = {
      step,
      deal,
      bidding,
      limitInput,
      komisiStr,
      balikNamaMode,
      balikNama,
      eksekusi,
      includeBalikNama,
      includeEksekusi,
      cobroke,
      selisihKotor,
      selisihSebelumRoyalty,
      selisihFinal,
    };

    try {
      if (!isClosingMode) localStorage.setItem(key, JSON.stringify(payload));

      window.dispatchEvent(
        new CustomEvent("closing:transaksi-updated", {
          detail: {
            key,
            payload,
          },
        })
      );
    } catch {
      // ignore
    }
  }, [
    hydrated,
    key,
    step,
    deal,
    bidding,
    limitInput,
    komisiStr,
    balikNamaMode,
    balikNama,
    eksekusi,
    includeBalikNama,
    includeEksekusi,
    cobroke,
    selisihKotor,
    selisihSebelumRoyalty,
    selisihFinal,
  ]);

  async function handleSave() {
    if (!agent) return;
    setSaving(true);
    try {
      const isPersen = skemaPenjualan === "PERSENTASE";
      const isSelisihLocal = skemaPenjualan === "SELISIH";

      // Upload KTP ke Google Drive jika ada file
      let gambar_ktp_klien: string | null = null;
      if (ktpFile) {
        const fd = new FormData();
        fd.append("file", ktpFile);
        fd.append("nama_klien", klienData.nama_klien || "klien");
        const ktpRes = await fetch("/api/closing/upload-ktp", { method: "POST", body: fd });
        const ktpJson = await ktpRes.json();
        if (!ktpRes.ok) throw new Error(ktpJson?.error ?? "Gagal upload KTP");
        gambar_ktp_klien = ktpJson.fileId ?? null;
      }

      const body = {
        skema: skemaPenjualan,
        agentId: agent.id_agent,
        hargaBidding: hargaBidding || undefined,
        // PERSENTASE: harga_deal & harga_bidding di-null, maksimum_bidding = batas bidding
        deal: isSelisihLocal ? deal : 0,
        bidding: isSelisihLocal ? effectiveLimit : 0,
        limit: effectiveLimit,
        komisiPct: komisiPct,
        balikNama: balikNama,
        eksekusi: eksekusi,
        cobroke: cobroke,
        royaltyFee: 0,
        komisiAgent,
        pendapatanBersihKantor: isPersen
          ? nonNeg(pendapatanKotor - komisiAgent)
          : nonNeg(deal - effectiveLimit - (includeBalikNama ? balikNama : 0) - (includeEksekusi ? eksekusi : 0)),
        jenis_transaksi: (listing as any).jenis_transaksi,
        rows: [],
        agentLuarNama: agent.isLuar ? agent.luarNama : undefined,
        agentLuarKantor: agent.isLuar ? agent.luarKantor : undefined,
        agentLuarTelepon: agent.isLuar ? agent.luarTelepon : undefined,
        id_klien: klienData.id_klien,
        nama_lengkap_klien: klienData.nama_klien,
        nik_klien: klienData.nik_klien,
        alamat_klien: klienData.alamat_klien,
        // toggle hanya berlaku untuk SELISIH
        termasuk_balik_nama: isSelisihLocal ? includeBalikNama : false,
        termasuk_biaya_eksekusi: isSelisihLocal ? includeEksekusi : false,
        // hanya PERSENTASE yang isi maksimum_bidding (= batas bidding maksimum)
        maksimum_bidding: isSelisihLocal ? null : bidding,
        gambar_ktp_klien,
      };

      const listingId = String((listing as any).id_property);
      const res = await fetch(`/api/closing/listing/${encodeURIComponent(listingId)}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Gagal simpan");

      const transaksiId = json.id;
      onSaveSuccess?.(transaksiId);
      router.push(`/dashboard/transaksi?tab=progress&open=${transaksiId}`);
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? "Gagal menyimpan transaksi");
    } finally {
      setSaving(false);
    }
  }

  const cardRef = useRef<HTMLDivElement | null>(null);

  const next = () => {
    setStep((s) => (s === 1 ? 2 : s === 2 ? 3 : 3));
    setTimeout(() => cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const back = () => setStep((s) => (s === 3 ? 2 : s === 2 ? 1 : 1));

  const disableNext = step === 1 && !step1Valid;

  const refFirst = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    refFirst.current?.focus?.();
  }, [step]);

  const Breakdown = () => {
    const deductions = [
      {
        label: "Biaya Balik Nama",
        value: balikNama,
        color: "text-amber-300",
        show: isSelisih && includeBalikNama && balikNama > 0,
      },
      {
        label: "Biaya Eksekusi",
        value: eksekusi,
        color: "text-rose-300",
        show: isSelisih && includeEksekusi && eksekusi > 0,
      },
    ];

    return (
      <div className="mt-4 space-y-3">
        {/* Breakdown selisih kantor */}
        <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Breakdown Selisih Kantor
            </div>
            <div className="text-[11px] text-zinc-600">
              {isSelisih ? "Deal − Limit" : `Bidding × ${komisiPct}%`}
            </div>
          </div>

          <div className="mt-3">
            <div className="mt-1 text-2xl font-semibold text-white">
              <Money value={selisihFinal} />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[12px] font-semibold text-zinc-300">
                <span className="text-zinc-500">Base</span>
                <Money value={selisihKotor} />
              </span>
              {deductions.filter((d) => d.show).map((d) => (
                <span
                  key={d.label}
                  className={["inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[12px] font-semibold", d.color].join(" ")}
                >
                  <span className="text-zinc-500">{d.label}</span>
                  −<Money value={d.value} />
                </span>
              ))}
            </div>

            <div className="mt-2 text-[11px] text-zinc-600">
              {isSelisih
                ? `Selisih = (Deal − Limit)${includeBalikNama ? " − Balik Nama" : ""}${includeEksekusi ? " − Eksekusi" : ""}`
                : `Selisih = Bidding × ${komisiPct}%`}
            </div>
          </div>
        </div>

        {/* Cobroke — hanya mengurangi komisi agent */}
        {cobroke > 0 && (
          <div className="flex items-start gap-3 rounded-2xl border border-violet-500/15 bg-violet-500/[0.06] px-4 py-3">
            <Icon icon="solar:users-group-two-rounded-linear" className="mt-0.5 shrink-0 text-base text-violet-400" />
            <div className="min-w-0 text-[12px]">
              <span className="font-semibold text-violet-300">Cobroke Fee </span>
              <span className="text-zinc-400">sebesar </span>
              <span className="font-semibold text-white"><Money value={cobroke} /></span>
              <span className="text-zinc-400"> dikurangi dari komisi agent (bukan dari pendapatan kantor).</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={cardRef} className="grid gap-6 lg:grid-cols-12 min-w-0 w-full">
      <div className="lg:col-span-7 order-1 min-w-0">
        <ShellCard>
          <Stepper step={step} />

          {step === 1 ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-white font-semibold text-lg">Harga & Komisi</div>
                  <div className="mt-1 text-[12px] text-zinc-500">
                    Isi yang inti dulu. Ringkasan & perhitungan selalu update.
                  </div>
                </div>

                {isLelang ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[12px] font-semibold text-emerald-100">
                    <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.45)]" />
                    Skema: {isSelisih ? "Selisih Harga" : "Persentase Komisi"}
                  </span>
                ) : null}
              </div>

              {isSelisih ? (
                <div>
                  <Label>Harga Deal</Label>
                  <RpInput value={deal} onChange={setDeal} inputRef={refFirst} />
                  <Hint>Minimal harus ≥ limit lelang.</Hint>
                  {warnDealBelowLimit ? (
                    <Warning>
                      Harga Deal lebih kecil dari Limit Lelang. Naikkan minimal ke{" "}
                      <span className="font-semibold text-amber-100">
                        <Money value={limit} />
                      </span>
                      .
                    </Warning>
                  ) : null}
                </div>
              ) : null}

              {isSelisih ? (
                <div>
                  <Label>Nilai Limit Lelang</Label>
                  <RpInput value={effectiveLimit} onChange={() => {}} disabled={true} />
                </div>
              ) : null}

              {isPersen ? (
                <div>
                  <Label>Nilai Limit Lelang</Label>
                  <RpInput value={limitInput} onChange={() => {}} disabled={true} />
                </div>
              ) : null}

              {isPersen ? (
                <div>
                  <Label>Batas Bidding Maksimum</Label>
                  <RpInput value={bidding} onChange={setBidding} />
                  <Hint>Batas maksimal penawaran yang diizinkan klien.</Hint>
                  {warnBidBelowLimit ? (
                    <Warning>
                      Batas Bidding lebih kecil dari Limit Lelang. Naikkan minimal ke{" "}
                      <span className="font-semibold text-amber-100">
                        <Money value={effectiveLimit} />
                      </span>
                      .
                    </Warning>
                  ) : null}
                </div>
              ) : null}

              {/* Harga Bidding — hanya di closing mode (harga penawaran aktual di lelang) */}
              {isClosingMode && isLelang ? (
                <div>
                  <Label>Harga Bidding Aktual</Label>
                  <RpInput value={hargaBidding} onChange={setHargaBidding} inputRef={!isSelisih ? refFirst : undefined} />
                  <Hint>Harga penawaran yang benar-benar terjadi saat lelang.</Hint>
                  {warnHargaBiddingBelowLimit ? (
                    <Warning>
                      Harga Bidding Aktual tidak boleh lebih kecil dari Nilai Limit Lelang{" "}
                      <span className="font-semibold text-amber-100">
                        (<Money value={effectiveLimit} />)
                      </span>
                      .
                    </Warning>
                  ) : null}
                  {warnHargaBiddingAboveMax ? (
                    <Warning>
                      Harga Bidding Aktual tidak boleh melebihi Batas Bidding Maksimum{" "}
                      <span className="font-semibold text-amber-100">
                        (<Money value={bidding} />)
                      </span>
                      .
                    </Warning>
                  ) : null}
                </div>
              ) : null}

              {isPersen ? (
                <div>
                  <Label>Komisi (%)</Label>
                  <PercentInput value={komisiStr} onChange={isClosingMode ? () => {} : setKomisiStr} disabled={isClosingMode} />
                  {!isClosingMode && warnKomisiTerlalu ? (
                    <Warning>
                      Persentase komisi terlalu kecil. Minimal {minKomisiPct}% (saat ini {komisiPct}%).
                    </Warning>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-6 sm:mt-8 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onBack}
                  disabled={!onBack}
                  className={[
                    "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition",
                    onBack
                      ? "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
                      : "border-white/10 bg-white/5 text-zinc-600 cursor-not-allowed",
                  ].join(" ")}
                >
                  <Icon icon="solar:arrow-left-linear" className="text-lg" />
                  Pilih Agent
                </button>

                <button
                  type="button"
                  onClick={next}
                  disabled={disableNext}
                  className={[
                    "inline-flex items-center gap-2 rounded-2xl px-5 py-2 text-sm font-semibold transition",
                    disableNext
                      ? "border border-white/10 bg-white/5 text-zinc-500 cursor-not-allowed"
                      : "border border-emerald-400/20 bg-emerald-500/12 text-emerald-100 hover:bg-emerald-500/16",
                  ].join(" ")}
                >
                  Next
                  <Icon icon="solar:arrow-right-linear" className="text-lg" />
                </button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-white font-semibold text-lg">Biaya Transaksi</div>
                  <div className="mt-1 text-[12px] text-zinc-500">
                    Balik nama auto tapi bisa override.
                  </div>
                </div>

                {!isClosingMode && (
                  <button
                    type="button"
                    onClick={() => setBalikNamaMode("AUTO")}
                    className={[
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-semibold transition",
                      balikNamaMode === "AUTO"
                        ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100 cursor-default"
                        : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10",
                    ].join(" ")}
                  >
                    <Icon icon="solar:refresh-linear" className="text-base" />
                    Auto Balik Nama
                  </button>
                )}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label>Biaya Balik Nama</Label>
                  <RpInput
                    value={balikNama}
                    onChange={(v) => {
                      setBalikNamaMode("MANUAL");
                      setBalikNama(v);
                    }}
                    inputRef={refFirst}
                    disabled={isClosingMode && !isSelisih}
                  />
                  {(!isClosingMode || isSelisih) && (
                    <Hint>
                      {balikNamaMode === "AUTO"
                        ? "Auto: 8,5% dari harga + Rp 10.000.000"
                        : "Mode manual — diisi sendiri"}
                    </Hint>
                  )}
                </div>

                <div>
                  <Label>Biaya Eksekusi</Label>
                  <RpInput value={eksekusi} onChange={setEksekusi} disabled={isClosingMode && !isSelisih} />
                  {(!isClosingMode || isSelisih) && <Hint>Biaya pengosongan/eksekusi.</Hint>}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Toggle
                  checked={isSelisih ? includeBalikNama : false}
                  onChange={setIncludeBalikNama}
                  label="Balik Nama termasuk transaksi"
                  desc={
                    isSelisih
                      ? "Jika ON, selisih akan berkurang."
                      : "Tidak berlaku untuk skema persentase."
                  }
                  disabled={!isSelisih}
                />
                <Toggle
                  checked={isSelisih ? includeEksekusi : false}
                  onChange={setIncludeEksekusi}
                  label="Eksekusi termasuk transaksi"
                  desc={
                    isSelisih
                      ? "Jika ON, selisih akan berkurang."
                      : "Tidak berlaku untuk skema persentase."
                  }
                  disabled={!isSelisih}
                />
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={back}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/10 transition"
                >
                  <Icon icon="solar:arrow-left-linear" className="text-lg" />
                  Back
                </button>

                <button
                  type="button"
                  onClick={next}
                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/12 px-5 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/16 transition"
                >
                  Next
                  <Icon icon="solar:arrow-right-linear" className="text-lg" />
                </button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <div>
                <div className="text-white font-semibold text-lg">Review & Fee</div>
                <div className="mt-1 text-[12px] text-zinc-500">
                  Cobroke diinput jika ada.
                </div>
              </div>

              <div>
                <Label>Cobroke Fee</Label>
                <RpInput value={cobroke} onChange={setCobroke} inputRef={refFirst} />
                <Hint>Mengurangi komisi agent, bukan pendapatan kantor.</Hint>
              </div>

              <Breakdown />

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={back}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/10 transition"
                >
                  <Icon icon="solar:arrow-left-linear" className="text-lg" />
                  Back
                </button>

                {isClosingMode ? (
                  <button
                    type="button"
                    onClick={() => {
                      const payload = {
                        _closing_session: true,
                        step: 3,
                        deal,
                        bidding,
                        limitInput,
                        komisiStr,
                        balikNamaMode,
                        balikNama,
                        eksekusi,
                        includeBalikNama,
                        includeEksekusi,
                        cobroke,
                        selisihKotor,
                        selisihSebelumRoyalty,
                        selisihFinal,
                        hargaBidding: hargaBidding || undefined,
                      };
                      try { localStorage.setItem(key, JSON.stringify(payload)); } catch {}
                      onNextToPembagian?.();
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/12 px-5 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/16 transition"
                  >
                    Lanjut ke Pembagian Fee
                    <Icon icon="solar:arrow-right-linear" className="text-lg" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/12 px-5 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/16 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <>
                        <Icon icon="solar:spinner-linear" className="text-lg animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        Simpan Perubahan
                        <Icon icon="solar:diskette-bold-duotone" className="text-lg" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </ShellCard>
      </div>

      <div className="lg:col-span-5 order-2 min-w-0">
        <div className="lg:sticky lg:top-4 space-y-6">
          <ShellCard className="p-0">
            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-white font-semibold text-lg">Ringkasan</div>
                </div>

                <div className="grid place-items-center h-11 w-11 rounded-2xl border border-white/10 bg-white/5 text-emerald-100">
                  <Icon icon="solar:chart-2-linear" className="text-2xl" />
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {/* First card */}
                <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">
                    {isClosingMode
                      ? isPersen ? "Total Komisi" : "Selisih Bersih"
                      : isPersen ? "Perk. Total Komisi" : "Perkiraan Selisih"}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    <Money value={isPersen ? pendapatanKotor : selisihFinal} />
                  </div>
                  <div className="mt-2 text-[12px] text-zinc-500">
                    {isPersen
                      ? `Bidding × ${komisiPct}%`
                      : isClosingMode ? "Deal − Bidding − Biaya" : "Deal − Limit − Biaya"}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">
                    {isClosingMode ? "Kenaikan dari Limit" : "Kenaikan dari Limit"}
                  </div>
                  <div className="mt-2 text-xl font-semibold text-white">
                    {kenaikanDariLimit ? `${pct2(kenaikanDariLimit)}%` : "0%"}
                  </div>
                  <div className="mt-1 text-[12px] text-zinc-500">
                    Basis: {isSelisih ? "Harga Deal" : "Harga Bidding"}
                    {isClosingMode && hargaBidding > 0 ? ` · Bidding Aktual: ` : ""}
                    {isClosingMode && hargaBidding > 0 ? <Money value={hargaBidding} /> : null}
                  </div>
                </div>

                {/* THC Agent — ditampilkan jika closing mode dan ada data */}
                {isClosingMode && prefill?.trx?.thcAgent > 0 && (
                  <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">THC Agent</div>
                    <div className="mt-2 text-xl font-semibold text-white">
                      <Money value={prefill.trx.thcAgent} />
                    </div>
                  </div>
                )}

                {/* Third card - Komisi Agent */}
                <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">
                    {isClosingMode ? "Komisi Agent" : isPersen ? "Perk. Komisi Agent" : "Perkiraan Komisi Agent"}
                  </div>
                  <div className="mt-2 text-xl font-semibold text-white">
                    <Money value={isPersen ? Math.round(nonNeg(pendapatanKotor * 0.6) - nonNeg(cobroke)) : komisiAgent} />
                  </div>
                  <div className="mt-1 text-[12px] text-zinc-500">
                    {isPersen
                      ? `60% × (Bidding × ${komisiPct}%)`
                      : "60% × Selisih Bersih"}
                  </div>
                </div>

                {/* Fourth card - emerald */}
                <div className="rounded-3xl border border-emerald-400/15 bg-gradient-to-br from-emerald-500/10 via-white/5 to-transparent p-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-300/80">
                    {isClosingMode
                      ? "Pendapatan Bersih Kantor"
                      : isPersen ? "Perk. Pendapatan Bersih Kantor" : "Harga Bersih Objek Lelang"}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-emerald-100">
                    <Money value={
                      isClosingMode && prefill?.trx?.pendapatanBersih
                        ? prefill.trx.pendapatanBersih
                        : isPersen
                        ? nonNeg(pendapatanKotor - komisiAgent)
                        : nonNeg(deal - effectiveLimit - (includeBalikNama ? balikNama : 0) - (includeEksekusi ? eksekusi : 0))
                    } />
                  </div>
                  <div className="mt-1 text-[12px] text-zinc-400">
                    {isClosingMode
                      ? "Data dari transaksi"
                      : isPersen
                      ? "Total Komisi − Komisi Agent"
                      : "Deal − Limit" + (includeBalikNama ? " − Balik Nama" : "") + (includeEksekusi ? " − Eksekusi" : "")}
                  </div>
                </div>
              </div>

              {warnDealBelowLimit || warnBidBelowLimit ? (
                <div className="mt-5 rounded-3xl border border-amber-400/20 bg-amber-500/10 p-4">
                  <div className="flex items-start gap-2">
                    <Icon
                      icon="solar:danger-triangle-linear"
                      className="mt-[2px] text-lg text-amber-200"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-amber-100">
                        Perbaiki input limit dulu
                      </div>
                      <div className="mt-1 text-[12px] text-amber-100/80">
                        Deal/Bidding tidak boleh lebih kecil dari limit lelang.
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </ShellCard>
        </div>
      </div>
    </div>
  );
}

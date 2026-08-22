"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import Signin from "@/components/Auth/SignIn";
import SignUp from "@/components/Auth/SignUp";
import type {
  AuctionHistoryItem,
  AuctionHistoryResult,
} from "@/lib/auctionHistory";

/**
 * Blok "Riwayat Lelang Aset" di halaman detail.
 *
 * Aturan tampilan:
 *  • Data utama datang dari server lewat `initialData` — blok ini harus sudah
 *    ada di HTML pertama, tidak boleh bergantung pada fetch browser.
 *  • Kalau `initialData` tidak dikirim (mis. dipakai di layar lain), komponen
 *    mengambil sendiri dengan retry dan menampilkan status gagal + tombol coba
 *    lagi. Blok TIDAK PERNAH hilang diam-diam.
 *  • Semua entri ditampilkan, tanpa batas jumlah.
 */

const formatRupiah = (val: number | null | undefined) => {
  if (val == null || isNaN(val)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val);
};

/** "Rp 1,28 M" — untuk kartu ringkasan yang sempit. */
const formatRupiahSingkat = (val: number | null | undefined) => {
  if (val == null || isNaN(val) || val <= 0) return "-";
  if (val >= 1_000_000_000_000)
    return `Rp ${(val / 1_000_000_000_000).toFixed(2).replace(".", ",")} T`;
  if (val >= 1_000_000_000)
    return `Rp ${(val / 1_000_000_000).toFixed(2).replace(".", ",")} M`;
  if (val >= 1_000_000)
    return `Rp ${(val / 1_000_000).toFixed(0)} Jt`;
  return formatRupiah(val);
};

const formatTanggal = (val: string | null) => {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const STATUS_CFG: Record<
  string,
  { label: string; dot: string; text: string; bg: string; border: string }
> = {
  TERSEDIA: {
    label: "Tersedia",
    dot: "bg-emerald-400",
    text: "text-emerald-300",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  TERJUAL: {
    label: "Terjual",
    dot: "bg-blue-400",
    text: "text-blue-300",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  TARIK_LISTING: {
    label: "Ditarik",
    dot: "bg-slate-500",
    text: "text-slate-400",
    bg: "bg-slate-700/30",
    border: "border-slate-600/20",
  },
};

const getStatus = (s: string) =>
  STATUS_CFG[s] ?? {
    label: s,
    dot: "bg-slate-500",
    text: "text-slate-400",
    bg: "bg-slate-700/30",
    border: "border-slate-600/20",
  };

type FetchState = "idle" | "loading" | "ready" | "error";

/* ──────────────────────────────────────────────────────────────────────────
   Aset dengan banyak nomor sertifikat.

   Satu lot lelang bisa memuat beberapa bidang sekaligus. Kalau susunan
   bidangnya berbeda dari listing yang sedang dibuka, limitnya TIDAK sebanding
   — paket 3 bidang Rp 3 M bukan berarti aset 1 bidang ini pernah Rp 3 M. Entri
   seperti itu tetap ditampilkan (agent tetap perlu tahu lot-nya ada), tapi
   diberi label jelas dan dikeluarkan dari grafik, persentase, dan badge delta.
   ────────────────────────────────────────────────────────────────────────── */
const LABEL_CAKUPAN: Record<
  Exclude<AuctionHistoryItem["cakupan"], "SAMA">,
  { label: string; icon: string; keterangan: string }
> = {
  SEBAGIAN: {
    label: "sebagian bidang",
    icon: "solar:layers-minimalistic-bold-duotone",
    keterangan:
      "Lot ini hanya memuat sebagian bidang dari aset yang sedang dibuka, jadi limitnya tidak dibandingkan.",
  },
  LEBIH_LUAS: {
    label: "paket lebih besar",
    icon: "solar:layers-bold-duotone",
    keterangan:
      "Lot ini adalah paket yang memuat aset ini plus bidang lain, jadi limitnya tidak dibandingkan.",
  },
  BERIRISAN: {
    label: "susunan bidang beda",
    icon: "solar:sort-horizontal-bold-duotone",
    keterangan:
      "Lot ini berbagi sebagian nomor sertifikat tapi susunan bidangnya berbeda, jadi limitnya tidak dibandingkan.",
  },
};

/**
 * Deret nomor sertifikat untuk chip yang sempit: maksimal 3 tampil, sisanya
 * dirangkum. Nomor lengkapnya tetap terbaca lewat `title`.
 */
const ringkasNomor = (daftar: string[], mentah: string | null) => {
  if (daftar.length === 0) return { tampil: mentah ?? "", judul: mentah ?? "" };
  const judul =
    daftar.length > 1
      ? `${daftar.length} bidang — nomor sertifikat: ${daftar.join(", ")}`
      : `Nomor sertifikat: ${daftar[0]}`;
  if (daftar.length <= 3) return { tampil: daftar.join(", "), judul };
  return { tampil: `${daftar.slice(0, 2).join(", ")} +${daftar.length - 2}`, judul };
};

/* ──────────────────────────────────────────────────────────────────────────
   Tangga keparahan penurunan limit.

   Warna DIVALIDASI (bukan dikira-kira) terhadap surface gelap #0f0f0f:
   emerald #34d399 / amber #fbbf24 / red #ef4444 lolos cek separasi CVD,
   normal-vision, dan kontras ≥3:1. Kombinasi orange+red sempat dicoba dan
   gagal — jaraknya terlalu dekat untuk dibedakan bahkan dengan penglihatan
   warna normal. Warna TIDAK PERNAH jadi satu-satunya penanda: tiap tingkat
   selalu punya ikon + label teks.
   ────────────────────────────────────────────────────────────────────────── */
type TierPerubahan = {
  label: string;
  icon: string;
  hex: string;
  teks: string;
  ring: string;
  bg: string;
  glow: string;
  intens: number; // 0–1, dipakai untuk kekuatan glow & meter
};

const tierPerubahan = (delta: number): TierPerubahan => {
  if (delta > 0.5)
    return {
      label: "Limit naik",
      icon: "solar:arrow-right-up-bold",
      hex: "#94a3b8",
      teks: "text-slate-300",
      ring: "ring-slate-500/25",
      bg: "bg-slate-500/10",
      glow: "rgba(148,163,184,0.18)",
      intens: 0.25,
    };
  const turun = Math.abs(delta);
  if (turun >= 35)
    return {
      label: "Turun drastis",
      icon: "solar:fire-bold",
      hex: "#ef4444",
      teks: "text-red-400",
      ring: "ring-red-500/35",
      bg: "bg-red-500/10",
      glow: "rgba(239,68,68,0.30)",
      intens: 1,
    };
  if (turun >= 15)
    return {
      label: "Turun tajam",
      icon: "solar:double-alt-arrow-down-bold",
      hex: "#fbbf24",
      teks: "text-amber-300",
      ring: "ring-amber-500/30",
      bg: "bg-amber-500/10",
      glow: "rgba(251,191,36,0.24)",
      intens: 0.66,
    };
  return {
    label: "Turun tipis",
    icon: "solar:alt-arrow-down-bold",
    hex: "#34d399",
    teks: "text-emerald-300",
    ring: "ring-emerald-500/25",
    bg: "bg-emerald-500/10",
    glow: "rgba(52,211,153,0.20)",
    intens: 0.35,
  };
};

const persen = (v: number) =>
  `${v > 0 ? "+" : v < 0 ? "\u2212" : ""}${Math.abs(v)
    .toFixed(1)
    .replace(".", ",")}%`;

/**
 * Sparkline pergerakan limit — satu seri, jadi tanpa legenda (judul panel yang
 * menamainya). Sumbu-x proporsional terhadap tanggal lelang supaya jeda waktu
 * tidak dipalsukan jadi rata. Titik dirender sebagai elemen HTML di atas SVG
 * supaya tetap bulat sempurna saat SVG diregangkan mengikuti lebar kartu.
 * Daftar lengkap angkanya tetap ada di timeline di bawah (padanan tabel).
 *
 * Tingginya sengaja rendah (40–52px) — ini penunjuk arah, bukan grafik analitik;
 * angka pastinya sudah ada di sebelahnya.
 */
function SparklineLimit({
  titik,
  hexAkhir,
}: {
  titik: { x: number; y: number; label: string; nilai: string; current: boolean }[];
  hexAkhir: string;
}) {
  if (titik.length < 2) return null;
  const garis = titik.map((t) => `${t.x},${t.y}`).join(" ");
  const area = `${titik[0].x},100 ${garis} ${titik[titik.length - 1].x},100`;
  return (
    // Tinggi ikut lebar: di kolom sempit 40px sudah cukup menunjukkan arah,
    // di layar lebar garisnya perlu ruang vertikal supaya tidak jadi garis
    // datar yang menyembunyikan besarnya penurunan.
    <div className="relative w-full h-10 sm:h-[52px] lg:h-[64px]">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="rl-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb923c" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#fb923c" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#rl-area)" />
        <polyline
          points={garis}
          fill="none"
          stroke="#fb923c"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {titik.map((t, i) => (
        <div
          key={i}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${t.x}%`, top: `${t.y}%` }}
          title={`${t.label} — ${t.nilai}`}
        >
          <span
            className="block rounded-full ring-2 ring-[#0f0f0f]"
            style={{
              width: t.current ? 8 : 6,
              height: t.current ? 8 : 6,
              background: t.current ? hexAkhir : "#fb923c",
              boxShadow: t.current ? `0 0 8px ${hexAkhir}` : "none",
            }}
          />
        </div>
      ))}
    </div>
  );
}


export default function RiwayatLelang({
  idProperty,
  initialData = null,
  isLoggedIn: isLoggedInProp,
  /** @deprecated entri "saat ini" sekarang ditandai oleh server. */
  currentIdProperty,
}: {
  idProperty?: string | null;
  initialData?: AuctionHistoryResult | null;
  /**
   * Status login dari server. Dipakai supaya render pertama sudah benar —
   * tanpa ini useSession sempat "loading" dan member bisa melihat kedipan
   * paywall di halaman yang datanya sudah siap dari server.
   */
  isLoggedIn?: boolean;
  currentIdProperty?: string;
}) {
  const { status } = useSession();
  const sesiBelumPasti = isLoggedInProp === undefined && status === "loading";
  const isLoggedIn = isLoggedInProp ?? status === "authenticated";

  const [data, setData] = useState<AuctionHistoryResult | null>(initialData);
  const [fetchState, setFetchState] = useState<FetchState>(
    initialData ? "ready" : "idle"
  );
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const muat = useCallback(
    async (percobaanKe = 0) => {
      if (!idProperty) return;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setFetchState("loading");
      try {
        const res = await fetch(`/api/listing/${idProperty}/riwayat-lelang`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json?.ok || !Array.isArray(json.riwayat)) {
          throw new Error("Respons tidak valid");
        }
        const riwayat = json.riwayat as AuctionHistoryItem[];
        setData({
          ok: true,
          items: riwayat,
          total: json.total ?? riwayat.length,
          total_lain: json.total_lain ?? Math.max(0, riwayat.length - 1),
          // Fallback dihitung dari itemnya sendiri supaya klien lama/baru tidak
          // pernah menampilkan hitungan "0 dilelang" saat field ini absen.
          total_sebidang:
            json.total_sebidang ??
            riwayat.filter((i) => i.cakupan === "SAMA").length,
          total_lot_terkait:
            json.total_lot_terkait ??
            riwayat.filter((i) => i.cakupan !== "SAMA").length,
          match: json.match ?? null,
          alasan_tanpa_riwayat: json.alasan_tanpa_riwayat ?? null,
        });
        setFetchState("ready");
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        // Dua kali retry dengan jeda menaik — gangguan jaringan sesaat tidak
        // boleh menghilangkan blok riwayat.
        if (percobaanKe < 2) {
          setTimeout(() => muat(percobaanKe + 1), 600 * (percobaanKe + 1));
          return;
        }
        setFetchState("error");
      }
    },
    [idProperty]
  );

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setFetchState("ready");
      return;
    }
    muat(0);
    return () => abortRef.current?.abort();
  }, [initialData, muat]);

  const items = data?.items ?? [];
  const total = data?.total ?? items.length;

  /* ── Sedang memuat (hanya terjadi kalau data tidak dari server) ────── */
  if (fetchState === "loading" || fetchState === "idle" || sesiBelumPasti) {
    if (!idProperty) return null;
    return (
      <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-6 space-y-4 animate-pulse">
        <div className="flex gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/5" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 w-40 bg-white/5 rounded-lg" />
            <div className="h-3 w-24 bg-white/5 rounded-lg" />
          </div>
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="h-36 rounded-2xl bg-white/5" />
        ))}
      </div>
    );
  }

  /* ── Gagal memuat — tampilkan jujur + bisa dicoba ulang ───────────── */
  if (fetchState === "error" || !data) {
    return (
      <div className="rounded-3xl border border-white/[0.07] bg-slate-900/50 p-6">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
            <Icon
              icon="solar:danger-triangle-bold-duotone"
              className="text-amber-400 text-xl"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-black text-white tracking-tight">
              Riwayat Lelang Aset
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Data riwayat gagal dimuat. Ini masalah koneksi sesaat, bukan
              berarti asetnya tidak punya riwayat.
            </p>
            <button
              type="button"
              onClick={() => muat(0)}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-xs font-bold text-slate-200 hover:bg-white/10 transition-colors"
            >
              <Icon icon="solar:refresh-bold" className="text-sm" />
              Coba lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  const acuan = items.find((i) => i.is_current) ?? items[0];
  const legalitasLabel = acuan.legalitas ?? "";
  const nomorAcuan = ringkasNomor(
    acuan.nomor_legalitas_list ?? [],
    acuan.nomor_legalitas
  );
  const jumlahBidang = acuan.nomor_legalitas_list?.length ?? 0;
  const lokasiLabel = [acuan.kelurahan, acuan.kecamatan, acuan.kota]
    .filter(Boolean)
    .join(", ");

  // Entri dengan bidang yang sama persis — hanya inilah yang boleh dihitung
  // sebagai "aset ini sudah dilelang N kali" dan masuk analisa pergerakan limit.
  const totalSebidang =
    data.total_sebidang ?? items.filter((i) => i.cakupan === "SAMA").length;
  const totalLotTerkait =
    data.total_lot_terkait ?? items.filter((i) => i.cakupan !== "SAMA").length;

  const punyaRiwayatLain = total > 1;

  /* ── Belum ada lelang lain: jangan pura-pura ada yang disembunyikan ── */
  if (!punyaRiwayatLain) {
    return (
      <div className="rounded-3xl border border-white/[0.07] bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-6">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-700/40 to-slate-800/40 border border-white/10 flex items-center justify-center flex-shrink-0">
            <Icon
              icon="solar:diagram-down-bold-duotone"
              className="text-slate-400 text-xl"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-black text-white tracking-tight">
              Riwayat Lelang Aset
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Ini lelang pertama yang tercatat untuk aset ini. Belum ada
              penawaran periode sebelumnya yang bisa dibandingkan.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {legalitasLabel && (
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20"
                  title={nomorAcuan.judul}
                >
                  <Icon
                    icon="solar:shield-check-bold-duotone"
                    className="text-emerald-400 text-sm"
                  />
                  <span className="text-xs font-bold text-emerald-300">
                    {legalitasLabel}
                  </span>
                  {nomorAcuan.tampil && (
                    <span className="text-[10px] text-emerald-400/50 font-mono">
                      {nomorAcuan.tampil}
                    </span>
                  )}
                  {jumlahBidang > 1 && (
                    <span className="text-[10px] font-bold text-emerald-400/70">
                      · {jumlahBidang} bidang
                    </span>
                  )}
                </span>
              )}
              {lokasiLabel && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                  <Icon
                    icon="solar:map-point-bold-duotone"
                    className="text-slate-400 text-sm"
                  />
                  <span className="text-xs text-slate-300 truncate max-w-[200px]">
                    {lokasiLabel}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Belum login: kunci datanya, tapi jujur soal jumlahnya ────────── */
  if (!isLoggedIn) {
    const terjualCount = items.filter(
      (r) => r.status_tayang === "TERJUAL"
    ).length;
    const tahunTerlama = items[0]?.tanggal_lelang
      ? new Date(items[0].tanggal_lelang).getFullYear()
      : null;

    return (
      <div className="space-y-4">
        {/* Header — tetap terlihat penuh */}
        <div className="flex items-center gap-3.5">
          <div className="relative flex-shrink-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500/25 to-red-600/15 border border-orange-500/30 flex items-center justify-center shadow-lg shadow-orange-500/15">
              <Icon
                icon="solar:diagram-down-bold-duotone"
                className="text-orange-400 text-xl"
              />
            </div>
            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center shadow-md shadow-orange-500/50 ring-2 ring-[#0f0f0f]">
              <Icon
                icon="solar:lock-keyhole-bold-duotone"
                className="text-white text-[9px]"
              />
            </div>
          </div>
          <div>
            <h3 className="text-base font-black text-white tracking-tight">
              Riwayat Lelang Aset
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tercatat dilelang{" "}
              <span className="text-orange-400 font-bold">{total}×</span> —{" "}
              <span className="text-orange-400 font-bold">eksklusif member</span>
            </p>
          </div>
        </div>

        {/* Data asli, diburamkan */}
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{ maxHeight: 220 }}
        >
          <div className="pointer-events-none select-none space-y-3 blur-[5px] brightness-[0.50] saturate-50">
            {items.slice(0, 2).map((item, idx) => {
              const statusCfg = getStatus(item.status_tayang);
              return (
                <div key={item.id_property} className="flex gap-4 items-start">
                  <div className="flex-shrink-0 pt-5">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-xs font-black text-white shadow-lg shadow-orange-500/40">
                      {idx + 1}
                    </div>
                  </div>
                  <div
                    className="flex-1 rounded-2xl overflow-hidden border border-white/6 flex min-h-[110px]"
                    style={{
                      background:
                        "linear-gradient(135deg,rgba(255,255,255,0.03) 0%,rgba(15,23,42,0.90) 100%)",
                    }}
                  >
                    <div className="relative w-36 sm:w-44 shrink-0 overflow-hidden">
                      {item.gambar_utama ? (
                        <Image
                          src={item.gambar_utama}
                          alt={item.judul}
                          fill
                          className="object-cover"
                          sizes="176px"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-800/60">
                          <Icon
                            icon="solar:home-2-bold-duotone"
                            className="text-4xl text-slate-700"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] text-slate-600 font-mono">
                            #{item.id_property}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${statusCfg.bg} ${statusCfg.text} border ${statusCfg.border}`}
                          >
                            <span
                              className={`w-1 h-1 rounded-full ${statusCfg.dot}`}
                            />
                            {statusCfg.label}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-200 line-clamp-2 leading-relaxed mb-3">
                          {item.judul}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-black text-white mb-2">
                          {formatRupiah(item.harga_efektif)}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <Icon
                            icon="solar:calendar-date-bold-duotone"
                            className="text-slate-600 text-xs flex-shrink-0"
                          />
                          <span className="text-[10px] text-slate-400">
                            {formatTanggal(item.tanggal_lelang) ??
                              "Belum dijadwalkan"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="absolute inset-x-0 bottom-0 h-28 pointer-events-none"
            style={{
              background:
                "linear-gradient(to top, #0f0f0f 0%, rgba(15,15,15,0.92) 50%, transparent 100%)",
            }}
          />

          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap"
            style={{
              background: "rgba(15,10,5,0.85)",
              border: "1px solid rgba(249,115,22,0.40)",
              boxShadow: "0 0 20px rgba(249,115,22,0.20)",
              backdropFilter: "blur(12px)",
            }}
          >
            <Icon
              icon="solar:eye-closed-bold-duotone"
              className="text-orange-400 text-base flex-shrink-0"
            />
            <span className="text-xs font-bold text-orange-300">
              {total} riwayat harga tersembunyi
            </span>
          </div>
        </div>

        {/* Chip petunjuk */}
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
            <Icon
              icon="solar:chart-bold-duotone"
              className="text-orange-400 text-sm flex-shrink-0"
            />
            <span className="text-[11px] font-bold text-slate-300">
              {total}× tercatat dilelang
            </span>
          </div>
          {tahunTerlama && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <Icon
                icon="solar:calendar-bold-duotone"
                className="text-blue-400 text-sm flex-shrink-0"
              />
              <span className="text-[11px] font-bold text-slate-300">
                Sejak {tahunTerlama}
              </span>
            </div>
          )}
          {terjualCount > 0 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <Icon
                icon="solar:tag-price-bold-duotone"
                className="text-emerald-400 text-sm flex-shrink-0"
              />
              <span className="text-[11px] font-bold text-slate-300">
                Pernah Terjual
              </span>
            </div>
          )}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/[0.08] border border-orange-500/[0.20]">
            <Icon
              icon="solar:lock-keyhole-bold-duotone"
              className="text-orange-400 text-sm flex-shrink-0"
            />
            <span className="text-[11px] font-bold text-orange-300">
              Eksklusif Member
            </span>
          </div>
        </div>

        {/* Kartu paywall */}
        <div
          className="relative overflow-hidden rounded-3xl"
          style={{
            background:
              "linear-gradient(160deg, rgba(20,10,4,0.98) 0%, rgba(15,8,4,0.98) 50%, rgba(10,10,15,0.98) 100%)",
            border: "1px solid rgba(249,115,22,0.24)",
            boxShadow:
              "0 0 60px rgba(249,115,22,0.08), 0 0 120px rgba(220,38,38,0.04), inset 0 1px 0 rgba(249,115,22,0.14)",
          }}
        >
          <div className="absolute inset-x-[15%] top-0 h-px bg-gradient-to-r from-transparent via-orange-500/55 to-transparent" />
          <div
            className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-40 rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse, rgba(249,115,22,0.10), transparent 70%)",
              filter: "blur(24px)",
            }}
          />
          <div
            className="absolute -right-10 top-10 w-36 h-36 rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse, rgba(220,38,38,0.12), transparent 70%)",
              filter: "blur(20px)",
            }}
          />

          <div className="relative p-6 sm:p-7">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div
                  className="absolute inset-0 rounded-2xl scale-150"
                  style={{
                    background:
                      "radial-gradient(ellipse, rgba(249,115,22,0.30), transparent 65%)",
                    filter: "blur(14px)",
                  }}
                />
                <div
                  className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(249,115,22,0.22) 0%, rgba(220,38,38,0.16) 100%)",
                    border: "1px solid rgba(249,115,22,0.40)",
                    boxShadow:
                      "0 0 28px rgba(249,115,22,0.28), inset 0 1px 0 rgba(255,255,255,0.08)",
                  }}
                >
                  <Icon
                    icon="solar:lock-keyhole-bold-duotone"
                    className="text-3xl text-orange-300"
                  />
                </div>
              </div>
            </div>

            <div className="text-center mb-6">
              <h3 className="text-xl font-black text-white tracking-tight leading-snug mb-2">
                Buka Akses Data Riwayat Lelang
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed max-w-xs mx-auto">
                Daftar gratis dan intai semua historis harga, pola lelang, dan
                analisa mendalam sebelum orang lain.
              </p>
            </div>

            <div className="space-y-2.5 mb-7">
              {[
                {
                  icon: "solar:chart-2-bold-duotone",
                  text: `Akses ${total} riwayat lelang lengkap dengan detail harga tiap periode`,
                  color: "text-orange-400",
                  glow: "rgba(249,115,22,0.12)",
                },
                {
                  icon: "solar:graph-up-bold-duotone",
                  text: "Analisa tren pergerakan harga dan deteksi waktu terbaik untuk menawar",
                  color: "text-amber-400",
                  glow: "rgba(251,191,36,0.10)",
                },
                {
                  icon: "solar:target-bold-duotone",
                  text: "Bandingkan posisi harga saat ini vs historis untuk keputusan investasi lebih tajam",
                  color: "text-red-400",
                  glow: "rgba(239,68,68,0.10)",
                },
              ].map((b) => (
                <div
                  key={b.text}
                  className="flex items-start gap-3 px-4 py-3 rounded-2xl"
                  style={{
                    background: `linear-gradient(135deg, ${b.glow} 0%, rgba(255,255,255,0.02) 100%)`,
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      background: `linear-gradient(135deg, ${b.glow} 0%, rgba(255,255,255,0.02) 100%)`,
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <Icon icon={b.icon} className={`text-base ${b.color}`} />
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {b.text}
                  </p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setIsSignUpOpen(true)}
                className="group/cta relative flex items-center gap-4 w-full py-4 px-5 rounded-2xl overflow-hidden transition-all duration-300 active:scale-[0.98]"
                style={{
                  background:
                    "linear-gradient(160deg, #fb923c 0%, #f97316 25%, #ea580c 65%, #dc2626 100%)",
                  boxShadow:
                    "0 0 40px rgba(249,115,22,0.38), 0 8px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -2px 0 rgba(0,0,0,0.22)",
                }}
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[55%] rounded-t-2xl bg-gradient-to-b from-white/[0.18] to-transparent" />
                <span className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/25 to-transparent group-hover/cta:translate-x-full transition-transform duration-500" />
                <div className="relative flex-shrink-0 w-9 h-9 rounded-xl bg-black/20 flex items-center justify-center border border-white/15 shadow-inner">
                  <Icon
                    icon="solar:user-plus-bold-duotone"
                    className="text-base text-white"
                  />
                </div>
                <div className="relative flex-1 min-w-0">
                  <p className="text-sm font-black text-white leading-tight">
                    Daftar Gratis
                  </p>
                  <p className="text-[10px] text-white/65 leading-tight mt-0.5">
                    Mulai sekarang dan buka akses datanya
                  </p>
                </div>
                <div className="relative flex-shrink-0 w-8 h-8 rounded-xl bg-black/25 flex items-center justify-center border border-white/10 group-hover/cta:bg-black/35 transition-colors duration-200">
                  <Icon
                    icon="solar:alt-arrow-right-bold"
                    className="text-sm text-white/80"
                  />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsSignInOpen(true)}
                className="group/signin flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-sm font-semibold transition-all duration-200 hover:border-white/20 hover:bg-white/[0.06]"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  color: "rgba(148,163,184,1)",
                }}
              >
                <Icon
                  icon="solar:login-bold-duotone"
                  className="text-sm text-slate-500 group-hover/signin:text-slate-300 transition-colors"
                />
                <span>
                  Sudah punya akun?{" "}
                  <span className="text-orange-400 font-bold group-hover/signin:text-orange-300 transition-colors">
                    Masuk di sini
                  </span>
                </span>
              </button>
            </div>

            <p className="text-center text-[10px] text-slate-600 mt-5 leading-relaxed">
              Gratis selamanya · Tidak butuh kartu kredit · Data properti
              terlengkap
            </p>
          </div>
        </div>

        {isSignInOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setIsSignInOpen(false)}
            />
            <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-[#181818] border border-white/10 rounded-2xl p-8 shadow-2xl">
              <button
                onClick={() => setIsSignInOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                <Icon icon="solar:close-circle-bold" className="text-2xl" />
              </button>
              <h3 className="text-2xl font-bold text-white mb-6 text-center">
                Selamat Datang Kembali
              </h3>
              <Signin
                closeModal={() => setIsSignInOpen(false)}
                openSignupModal={() => {
                  setIsSignInOpen(false);
                  setIsSignUpOpen(true);
                }}
              />
            </div>
          </div>
        )}

        {isSignUpOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setIsSignUpOpen(false)}
            />
            <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-[#181818] border border-white/10 rounded-2xl p-8 shadow-2xl">
              <button
                onClick={() => setIsSignUpOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                <Icon icon="solar:close-circle-bold" className="text-2xl" />
              </button>
              <h3 className="text-2xl font-bold text-white mb-6 text-center">
                Buat Akun Baru
              </h3>
              <SignUp
                closeModal={() => setIsSignUpOpen(false)}
                openSigninModal={() => {
                  setIsSignUpOpen(false);
                  setIsSignInOpen(true);
                }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Sudah login: tampilkan SEMUA entri ──────────────────────────── */
  // Analisa harga HANYA memakai entri dengan susunan bidang yang sama persis.
  // Mencampur lot paket/pecahan ke sini akan melahirkan "penurunan" yang tidak
  // pernah terjadi — lihat LABEL_CAKUPAN di atas.
  const berharga = items.filter(
    (i) =>
      i.cakupan === "SAMA" && i.harga_efektif != null && i.harga_efektif > 0
  );
  const limitPertama = berharga[0]?.harga_efektif ?? null;
  const limitTerakhir = berharga[berharga.length - 1]?.harga_efektif ?? null;
  const perubahanTotal =
    limitPertama && limitTerakhir && berharga.length > 1
      ? ((limitTerakhir - limitPertama) / limitPertama) * 100
      : null;
  const selisihRupiah =
    limitPertama && limitTerakhir ? limitPertama - limitTerakhir : 0;
  const tier = perubahanTotal !== null ? tierPerubahan(perubahanTotal) : null;
  // Meter panas: 0–60% penurunan dipetakan ke 0–100% isi bar. Di atas 60%
  // bar penuh — angka pastinya tetap terbaca di hero figure.
  const isiMeter =
    perubahanTotal !== null
      ? Math.max(6, Math.min(100, (Math.abs(perubahanTotal) / 60) * 100))
      : 0;

  // Titik sparkline. Sumbu-x proporsional tanggal kalau semua entri bertanggal;
  // kalau ada yang belum dijadwalkan, jarak dibuat rata supaya tidak menipu.
  const waktuTitik = berharga.map((i) =>
    i.tanggal_lelang ? new Date(i.tanggal_lelang).getTime() : null
  );
  const pakaiWaktu =
    waktuTitik.every((t): t is number => t !== null) &&
    new Set(waktuTitik).size === waktuTitik.length;
  const nilaiMin = Math.min(...berharga.map((i) => i.harga_efektif!));
  const nilaiMaks = Math.max(...berharga.map((i) => i.harga_efektif!));
  const rentangNilai = nilaiMaks - nilaiMin || 1;
  const waktuMin = pakaiWaktu ? Math.min(...(waktuTitik as number[])) : 0;
  const rentangWaktu = pakaiWaktu
    ? Math.max(1, Math.max(...(waktuTitik as number[])) - waktuMin)
    : 1;
  const semuaSama = nilaiMaks === nilaiMin;
  const titikSparkline = berharga.map((i, idx) => ({
    // 3–97 menyisakan margin supaya titik ujung tidak terpotong tepi kartu.
    x:
      3 +
      (pakaiWaktu
        ? ((waktuTitik[idx] as number) - waktuMin) / rentangWaktu
        : idx / Math.max(1, berharga.length - 1)) *
        94,
    // 12–88 menyisakan ruang vertikal; limit yang rata ditaruh di tengah.
    y: semuaSama
      ? 50
      : 88 - ((i.harga_efektif! - nilaiMin) / rentangNilai) * 76,
    label: formatTanggal(i.tanggal_lelang) ?? `Lelang ke-${i.urutan}`,
    nilai: formatRupiah(i.harga_efektif),
    current: i.is_current,
  }));

  return (
    <div className="relative group/section">
      <div className="absolute -inset-6 bg-orange-500/3 rounded-[3rem] blur-3xl pointer-events-none opacity-0 group-hover/section:opacity-100 transition-opacity duration-700" />

      <div className="relative space-y-5">
        {/* ── HEADER ───────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative flex-shrink-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500/25 to-red-600/15 border border-orange-500/30 flex items-center justify-center shadow-lg shadow-orange-500/15">
                <Icon
                  icon="solar:diagram-down-bold-duotone"
                  className="text-orange-400 text-xl"
                />
              </div>
              <div className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center text-[9px] font-black text-white shadow-md shadow-orange-500/50 ring-2 ring-[#0f0f0f]">
                {total}
              </div>
            </div>

            <div>
              <h3 className="flex items-center gap-1.5 text-base font-black text-white tracking-tight">
                Riwayat Lelang Aset
                <span
                  className="cursor-help"
                  title="Dicocokkan dari jenis & nomor sertifikat (satu lot bisa punya banyak bidang — cukup nomornya beririsan), wilayah (kelurahan/kecamatan/kota), dan luas tanah. Listing dengan tanggal, limit, & susunan bidang identik digabung jadi satu baris. Lot dengan susunan bidang berbeda tetap ditampilkan, tapi limitnya tidak ikut dibandingkan."
                >
                  <Icon
                    icon="solar:info-circle-linear"
                    className="text-slate-600 text-sm hover:text-slate-400 transition-colors"
                  />
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tercatat dilelang{" "}
                <span className="text-orange-400 font-bold">
                  {totalSebidang}×
                </span>{" "}
                dengan aset identik
                {totalLotTerkait > 0 && (
                  <>
                    {" "}
                    · {totalLotTerkait} lot terkait dengan susunan bidang
                    berbeda
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {legalitasLabel && (
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/8 border border-emerald-500/20 backdrop-blur-sm"
                title={nomorAcuan.judul}
              >
                <Icon
                  icon="solar:shield-check-bold-duotone"
                  className="text-emerald-400 text-sm flex-shrink-0"
                />
                <span className="text-xs font-bold text-emerald-300">
                  {legalitasLabel}
                </span>
                {nomorAcuan.tampil && (
                  <span className="text-[10px] text-emerald-400/50 font-mono">
                    {nomorAcuan.tampil}
                  </span>
                )}
                {jumlahBidang > 1 && (
                  <span className="text-[10px] font-bold text-emerald-400/70">
                    · {jumlahBidang} bidang
                  </span>
                )}
              </div>
            )}
            {lokasiLabel && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/4 border border-white/8 backdrop-blur-sm">
                <Icon
                  icon="solar:map-point-bold-duotone"
                  className="text-slate-400 text-sm flex-shrink-0"
                />
                <span className="text-xs text-slate-300 truncate max-w-[150px]">
                  {lokasiLabel}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── PANEL ANALISA — ringkas, satu tarikan baca ─────────────
           Tinggi panel dijaga tetap kecil di semua lebar layar: angka
           persentase turun ke ukuran heading (bukan hero), meter jadi garis
           tipis, dan sparkline cuma jadi penunjuk arah. Dari `sm` ke atas
           dua kolom berdampingan; di bawah itu menumpuk tanpa bertambah
           tinggi berlebihan. */}
        {perubahanTotal !== null && tier && (
          <div
            className="relative overflow-hidden rounded-2xl"
            style={{
              background:
                "linear-gradient(150deg, rgba(255,255,255,0.04) 0%, rgba(15,23,42,0.5) 45%, rgba(9,9,11,0.8) 100%)",
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 0 ${
                18 * tier.intens
              }px ${tier.glow}`,
            }}
          >
            {/* Aksen tepi atas — intensitasnya ikut besarnya penurunan */}
            <div
              className="absolute inset-x-0 top-0 h-px"
              style={{
                background: `linear-gradient(to right, transparent, ${tier.hex}${
                  tier.intens >= 1 ? "" : "99"
                }, transparent)`,
              }}
            />

            <div className="relative p-3.5 sm:p-5">
              {/* Ringkasan untuk pembaca layar — grafik & warna tidak terbaca
                  screen reader, jadi kesimpulannya dinyatakan sebagai kalimat. */}
              <p className="sr-only">
                Limit lelang {perubahanTotal < 0 ? "turun" : "naik"}{" "}
                {Math.abs(perubahanTotal).toFixed(1).replace(".", ",")} persen,
                dari {formatRupiah(limitPertama)} pada lelang pertama menjadi{" "}
                {formatRupiah(limitTerakhir)} pada lelang terakhir, tercatat{" "}
                {totalSebidang} kali dilelang.
              </p>

              <div
                className="flex items-center justify-between gap-2 mb-3"
                aria-hidden="true"
              >
                <p className="min-w-0 truncate text-[9px] sm:text-[10px] font-black tracking-[0.12em] text-slate-500 uppercase">
                  {/* Judul dipendekkan di layar sempit supaya pil hitungan di
                      kanan tidak pernah terdesak keluar. */}
                  <span className="sm:hidden">Pergerakan Limit</span>
                  <span className="hidden sm:inline">
                    Analisa Pergerakan Limit
                  </span>
                </p>
                <span className="inline-flex shrink-0 items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-[9px] font-bold text-slate-400 whitespace-nowrap">
                  <Icon
                    icon="solar:history-bold-duotone"
                    className="text-[11px]"
                  />
                  {totalSebidang}× dilelang
                </span>
              </div>

              {/* Dua kolom — besaran | lintasan. Sengaja `grid` dengan kolom
                  fraksional, BUKAN flex yang menumpuk: susunan kiri-kanan
                  dipertahankan sampai layar 320px. Yang menyusut adalah ukuran
                  huruf & jarak, bukan tata letaknya, supaya perbandingan
                  "seberapa turun" vs "bentuk lintasannya" selalu terbaca
                  sekali pandang. `minmax(0,…)` wajib: tanpa itu kolom grid
                  menolak menyusut di bawah lebar kontennya dan angka panjang
                  (mis. −100,0% / Rp 550,00 M) akan melebar keluar kartu. */}
              <div
                className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] sm:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] gap-3 sm:gap-5 items-stretch"
                aria-hidden="true"
              >
                {/* KIRI — seberapa besar perubahannya */}
                <div className="flex min-w-0 flex-col justify-center">
                  <span
                    className="block leading-none font-black tracking-tight tabular-nums"
                    style={{
                      color: tier.hex,
                      // Menyusut mengikuti layar, tapi tidak pernah lebih kecil
                      // dari 22px (masih nyaman dibaca) atau lebih besar dari
                      // 34px (biar tidak mengalahkan harga di timeline).
                      fontSize: "clamp(22px, 7.2vw, 34px)",
                    }}
                  >
                    {persen(perubahanTotal)}
                  </span>

                  <span
                    className={`mt-1.5 inline-flex w-fit max-w-full items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full ring-1 ${tier.bg} ${tier.ring} ${tier.teks} text-[9px] font-bold tracking-wide uppercase`}
                  >
                    <Icon icon={tier.icon} className="shrink-0 text-[11px]" />
                    <span className="truncate">{tier.label}</span>
                  </span>

                  {/* Meter panas — isi = besar penurunan */}
                  <div className="mt-2 h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${isiMeter}%`,
                        background: `linear-gradient(to right, ${tier.hex}66, ${tier.hex})`,
                      }}
                    />
                  </div>

                  {selisihRupiah > 0 && (
                    // `text-pretty` mencegah kata terakhir jatuh sendirian di
                    // baris baru saat kolomnya sempit ("…lebih / murah").
                    <p className="mt-1.5 text-pretty text-[10px] sm:text-[11px] leading-snug text-slate-400">
                      <span className="font-bold text-slate-200 tabular-nums">
                        {formatRupiahSingkat(selisihRupiah)}
                      </span>{" "}
                      <span className="sm:hidden">lebih murah</span>
                      <span className="hidden sm:inline">
                        lebih murah dari limit pertama
                      </span>
                    </p>
                  )}
                </div>

                {/* KANAN — bentuk lintasannya.
                    Awal di ATAS grafik, terakhir di BAWAH: urutannya mengikuti
                    arah garis yang menurun, dan label+nilai jadi baris pendek
                    yang tetap muat di kolom selebar ~130px. */}
                <div className="flex min-w-0 flex-col justify-center border-l border-white/[0.06] pl-3 sm:pl-5">
                  <div className="flex items-baseline justify-between gap-1.5">
                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      Awal
                    </span>
                    <span className="truncate text-[11px] sm:text-[13px] font-bold text-slate-300 tabular-nums">
                      {formatRupiahSingkat(limitPertama)}
                    </span>
                  </div>

                  <div className="my-1.5">
                    <SparklineLimit
                      titik={titikSparkline}
                      hexAkhir={tier.hex}
                    />
                  </div>

                  <div className="flex items-baseline justify-between gap-1.5">
                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      Terakhir
                    </span>
                    <span
                      className="truncate text-[11px] sm:text-[13px] font-bold tabular-nums"
                      style={{ color: tier.hex }}
                    >
                      {formatRupiahSingkat(limitTerakhir)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TIMELINE — semua entri, tanpa dipotong ───────────────── */}
        <div className="relative">
          {items.length > 1 && (
            <div
              className="absolute left-[22px] top-10 bottom-10 w-px pointer-events-none"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(249,115,22,0.5), rgba(249,115,22,0.15), transparent)",
              }}
            />
          )}

          <div className="space-y-4">
            {items.map((item) => {
              const isCurrent = item.is_current;
              const statusCfg = getStatus(item.status_tayang);
              const tanggal = formatTanggal(item.tanggal_lelang);
              const harga = item.harga_efektif;
              const delta = item.delta_persen;
              const cakupanCfg =
                item.cakupan === "SAMA" ? null : LABEL_CAKUPAN[item.cakupan];
              const nomorItem = ringkasNomor(
                item.nomor_legalitas_list ?? [],
                item.nomor_legalitas
              );

              const isi = (
                <div className="flex gap-4 items-start">
                  {/* Node timeline */}
                  <div className="flex-shrink-0 flex flex-col items-center pt-5">
                    <div
                      className={`relative w-11 h-11 rounded-2xl flex items-center justify-center text-xs font-black transition-all duration-300 ${
                        isCurrent
                          ? "bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/40"
                          : "bg-slate-800/80 text-slate-400 border border-slate-700/60 group-hover/card:border-orange-500/30 group-hover/card:text-orange-300"
                      }`}
                    >
                      {isCurrent && (
                        <div className="absolute inset-0 rounded-2xl bg-orange-500/30 animate-ping opacity-75" />
                      )}
                      <span className="relative">{item.urutan}</span>
                    </div>
                  </div>

                  {/* Kartu */}
                  <div
                    className={`relative flex-1 rounded-[20px] overflow-hidden border transition-all duration-300 will-change-transform ${
                      isCurrent
                        ? "border-orange-500/35 shadow-[0_18px_50px_-20px_rgba(249,115,22,0.35)]"
                        : "border-white/[0.07] group-hover/card:border-white/[0.16] group-hover/card:-translate-y-0.5 group-hover/card:shadow-[0_20px_45px_-24px_rgba(0,0,0,0.95)]"
                    }`}
                    style={{
                      background: isCurrent
                        ? "linear-gradient(135deg, rgba(249,115,22,0.06) 0%, rgba(17,24,39,0.95) 50%, rgba(15,23,42,0.98) 100%)"
                        : "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(15,23,42,0.90) 100%)",
                    }}
                  >
                    {isCurrent && (
                      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-orange-500/60 to-transparent" />
                    )}

                    <div className="flex min-h-[130px]">
                      {/* Gambar */}
                      <div className="relative w-36 sm:w-44 shrink-0 overflow-hidden">
                        {item.gambar_utama ? (
                          <>
                            <Image
                              src={item.gambar_utama}
                              alt={item.judul}
                              fill
                              className="object-cover transition-transform duration-700 group-hover/card:scale-105"
                              sizes="(max-width: 640px) 144px, 176px"
                              unoptimized
                            />
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-slate-900/70" />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-800/60">
                            <Icon
                              icon="solar:home-2-bold-duotone"
                              className="text-4xl text-slate-700"
                            />
                          </div>
                        )}

                        {isCurrent && (
                          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500 shadow-md shadow-orange-500/50 backdrop-blur-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            <span className="text-[9px] font-black text-white tracking-wide">
                              SAAT INI
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Konten */}
                      <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-[10px] text-slate-600 font-mono tracking-wider">
                              #{item.id_property}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${statusCfg.bg} ${statusCfg.text} border ${statusCfg.border}`}
                            >
                              <span
                                className={`w-1 h-1 rounded-full ${statusCfg.dot}`}
                              />
                              {statusCfg.label}
                            </span>
                          </div>

                          <p className="text-xs font-semibold text-slate-200 line-clamp-2 leading-relaxed mb-3">
                            {item.judul}
                          </p>
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <p
                              className={`text-base sm:text-lg font-black leading-none ${
                                isCurrent ? "text-orange-300" : "text-white"
                              }`}
                            >
                              {formatRupiah(harga)}
                            </p>
                            {delta !== null &&
                              Math.abs(delta) >= 0.1 &&
                              (() => {
                                // Tangga keparahan yang sama dengan panel atas,
                                // supaya "makin turun makin panas" konsisten.
                                const t = tierPerubahan(delta);
                                return (
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ring-1 text-[10px] font-black ${t.bg} ${t.ring} ${t.teks}`}
                                    title={`${t.label} dibanding lelang sebelumnya`}
                                  >
                                    <Icon icon={t.icon} className="text-[11px]" />
                                    {persen(delta)}
                                  </span>
                                );
                              })()}
                            {cakupanCfg && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ring-1 ring-sky-500/25 bg-sky-500/10 text-[10px] font-black text-sky-300"
                                title={cakupanCfg.keterangan}
                              >
                                <Icon
                                  icon={cakupanCfg.icon}
                                  className="text-[11px]"
                                />
                                {cakupanCfg.label}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            {nomorItem.tampil && (
                              <span
                                className="inline-flex items-center gap-1 text-[9px] text-slate-500 font-mono"
                                title={nomorItem.judul}
                              >
                                <Icon
                                  icon="solar:document-text-linear"
                                  className="text-[11px]"
                                />
                                {nomorItem.tampil}
                              </span>
                            )}
                            <div className="flex items-center gap-1.5">
                              <Icon
                                icon="solar:calendar-date-bold-duotone"
                                className="text-slate-600 text-xs flex-shrink-0"
                              />
                              {tanggal ? (
                                <span className="text-[10px] text-slate-400">
                                  {tanggal}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-600 italic">
                                  Belum dijadwalkan
                                </span>
                              )}
                            </div>

                            {item.confidence === "TINGGI" && !isCurrent && (
                              <span
                                className="inline-flex items-center gap-1 text-[9px] text-slate-500"
                                title={`Dicocokkan dari: ${item.alasan_cocok.join(", ")}`}
                              >
                                <Icon
                                  icon="solar:info-circle-linear"
                                  className="text-[11px]"
                                />
                                kemiripan tinggi
                              </span>
                            )}

                            {item.duplikat_ids.length > 0 && (
                              <span
                                className="inline-flex items-center gap-1 text-[9px] text-slate-500"
                                title={`Listing kembar pada event yang sama: #${item.duplikat_ids.join(", #")}`}
                              >
                                <Icon
                                  icon="solar:copy-linear"
                                  className="text-[11px]"
                                />
                                +{item.duplikat_ids.length} listing kembar
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {!isCurrent && (
                      <div className="absolute right-3 top-3 opacity-0 group-hover/card:opacity-100 transition-all duration-200 translate-x-1 group-hover/card:translate-x-0">
                        <div className="w-6 h-6 rounded-full bg-white/8 flex items-center justify-center">
                          <Icon
                            icon="solar:arrow-right-up-linear"
                            className="text-white text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );

              // Entri "saat ini" tidak perlu link ke dirinya sendiri.
              return isCurrent ? (
                <div key={item.id_property} className="block group/card">
                  {isi}
                </div>
              ) : (
                <Link
                  key={item.id_property}
                  href={`/Lelang/${item.slug}-${item.id_property}`}
                  className="block group/card"
                >
                  {isi}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

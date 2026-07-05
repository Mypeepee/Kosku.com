// src/lib/lelangPoster.ts
// Generator poster katalog lelang (story 1080×1920).
// Sisi klien menyusun payload tampilan, lalu POST ke /api/poster/lelang yang
// merender template HTML (public/templates/katalog_lelang_solusindo.html) menjadi
// JPEG via Puppeteer — sehingga bebas dari masalah CORS foto.

import { downloadPosterImage, safeFileName } from "@/lib/poster/downloadPoster";

export interface LelangPosterPayload {
  heroTitle: string;
  eyebrow: string;
  alamat: string;
  addrSpecs: string;
  calDay: string;
  calMonth: string;
  calTime: string;
  legalMain: string;
  legalSub: string;
  hargaLimit: string;          // sudah diformat: "Rp 317.000.000"
  hargaPasar?: string | null;  // diformat, atau null bila tak ada
  hematPct?: number | null;
  uangJaminan?: string | null; // diformat, atau null bila tak ada
  contactNum: string;
  agentName: string;
  qrUrl: string;
  photos: string[];
}

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const money = (n: number): string =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

const toNum = (v: any): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^0-9.-]/g, ""));
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
};

/** Parse tanggal lelang tanpa pergeseran timezone (ambil bagian tanggal apa adanya). */
function parseLelangDate(raw?: string | null) {
  if (!raw) return null;
  const m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (m) {
    return { d: +m[3], mo: +m[2], y: +m[1], hh: m[4] ? +m[4] : 0, mm: m[5] ? +m[5] : 0 };
  }
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return null;
  return { d: dt.getDate(), mo: dt.getMonth() + 1, y: dt.getFullYear(), hh: dt.getHours(), mm: dt.getMinutes() };
}

/** Rapikan nomor telepon jadi format lokal (0812-3456-7890). */
function formatPhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("62")) d = "0" + d.slice(2);
  else if (!d.startsWith("0")) d = "0" + d;
  const m = d.match(/^(\d{4})(\d{3,4})(\d+)$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : d;
}

const LEGAL_SUB: Record<string, string> = {
  SHM: "Sertifikat Hak Milik",
  HGB: "Hak Guna Bangunan",
  SHGB: "Hak Guna Bangunan",
  HGU: "Hak Guna Usaha",
  AJB: "Akta Jual Beli",
  GIRIK: "Girik / Letter C",
};

interface BuildOpts {
  /** Kode agent yang membagikan — leads masuk ke dia (dipakai di URL/QR). */
  agentCode?: string | null;
  /** Profil agent yang sedang login, untuk kontak di poster. */
  selfAgent?: { nama?: string; whatsapp?: string; telepon?: string } | null;
  /** Origin (default window.location.origin). */
  origin?: string;
}

/** Bangun payload poster dari objek properti lelang. */
export function buildLelangPosterPayload(data: any, opts: BuildOpts = {}): LelangPosterPayload {
  const origin =
    opts.origin || (typeof window !== "undefined" ? window.location.origin : "");
  const agentCode = opts.agentCode || "";

  const judul: string = data?.judul || data?.title || "Aset Lelang";
  const kota: string = data?.kota || data?.area_lokasi || "";

  const luasTanah = toNum(data?.luas_tanah);
  const luasBangunan = toNum(data?.luas_bangunan);
  const addrSpecs =
    [
      luasTanah ? `Luas Tanah ${luasTanah} m²` : "",
      luasBangunan ? `Luas Bangunan ${luasBangunan} m²` : "",
    ]
      .filter(Boolean)
      .join(" · ") || "Luas menyesuaikan dokumen lelang";

  const dt = parseLelangDate(data?.tanggal_lelang);
  const calDay = dt ? String(dt.d).padStart(2, "0") : "—";
  const calMonth = dt ? `${MONTHS[dt.mo - 1]} ${dt.y}` : "Jadwal menyusul";
  const calTime =
    dt && (dt.hh || dt.mm)
      ? `Pukul ${String(dt.hh).padStart(2, "0")}.${String(dt.mm).padStart(2, "0")} WIB`
      : "Pukul 10.00 WIB";

  const legalitas: string = (data?.legalitas || "").toString().trim();
  const nomorLegal: string = (data?.nomor_legalitas || "").toString().trim();
  const legalMain = legalitas
    ? nomorLegal
      ? `${legalitas} No. ${nomorLegal}`
      : legalitas
    : "Cek Dokumen";
  const legalSub = legalitas
    ? LEGAL_SUB[legalitas.toUpperCase()] || "Legalitas Aset"
    : "Legalitas Aset";

  const limitNum = toNum(data?.nilai_limit_lelang) || toNum(data?.harga) || toNum(data?.priceRates?.monthly);
  const hargaLimit = money(limitNum);

  // Hanya tampilkan "harga pasar / hemat" bila ada nilai pasar yang jelas lebih tinggi.
  const pasarNum = toNum(data?.harga);
  let hargaPasar: string | null = null;
  let hematPct: number | null = null;
  if (pasarNum && limitNum && pasarNum > limitNum * 1.02) {
    hargaPasar = money(pasarNum);
    hematPct = Math.round(((pasarNum - limitNum) / pasarNum) * 100);
  }

  const jaminanNum = toNum(data?.uang_jaminan);
  const uangJaminan = jaminanNum > 0 ? money(jaminanNum) : null;

  const agentName: string =
    opts.selfAgent?.nama || data?.agent?.nama || data?.owner?.name || "Agent Premier";
  const rawPhone: string =
    opts.selfAgent?.whatsapp ||
    opts.selfAgent?.telepon ||
    data?.agent?.telepon ||
    data?.agent?.whatsapp ||
    data?.owner?.phone ||
    "";
  const contactNum = formatPhone(rawPhone) || "Hubungi via link";

  const slugId =
    data?.slug && data?.id_property
      ? `${data.slug}-${data.id_property}`
      : String(data?.id_property || data?.id || "");
  const qrUrl = `${origin}/Lelang/${slugId}${agentCode ? `/${agentCode}` : ""}`;

  const photos: string[] = Array.isArray(data?.foto_list)
    ? data.foto_list.filter((u: any) => typeof u === "string" && /^(https?:)?\/\/|^\//.test(u))
    : [];

  return {
    heroTitle: judul,
    eyebrow: `Lelang · Solusindo Premier Property${kota ? ` ${kota}` : ""}`,
    alamat: data?.alamat_lengkap || data?.address || "-",
    addrSpecs,
    calDay,
    calMonth,
    calTime,
    legalMain,
    legalSub,
    hargaLimit,
    hargaPasar,
    hematPct,
    uangJaminan,
    contactNum,
    agentName,
    qrUrl,
    photos,
  };
}

/**
 * Render + unduh poster lelang. Mobile → native share sheet (Simpan Gambar →
 * Galeri), desktop → unduh file.
 */
export async function downloadLelangPoster(
  payload: LelangPosterPayload,
  onStateChange?: (loading: boolean) => void,
): Promise<void> {
  return downloadPosterImage(
    "/api/poster/lelang",
    payload,
    `poster-lelang-${safeFileName(payload.heroTitle)}`,
    onStateChange,
  );
}

// src/lib/jualPoster.ts
// Generator poster katalog Primary/Secondary (story 1080×1920).
// Payload dikirim ke /api/poster/jual yang merender template
// public/templates/katalog-primary-secondary_Solusindo.html via Puppeteer (JPEG).

import { downloadPosterImage, safeFileName } from "@/lib/poster/downloadPoster";

// Kontrak data ini mengikuti persis argumen window.renderKatalog(d) di template.
export interface JualPosterData {
  judul: string;
  kota: string;
  listingType: "Primary" | "Secondary";
  alamat: string;
  luasTanah: number | null;
  luasBangunan: number | null;
  kamarTidur: number | null;
  kamarMandi: number | null;
  lantai: number | null;
  sertifikat: string;
  harga: number;
  hargaPromo: number | null;
  agenNama: string;
  agenTelp: string;
  qrUrl: string;
  photos: string[];
}

const toNum = (v: any): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^0-9.-]/g, ""));
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
};

const toIntOrNull = (v: any): number | null => {
  const n = toNum(v);
  return n > 0 ? Math.round(n) : null;
};

interface BuildOpts {
  /** Kode agent yang membagikan — leads masuk ke dia (dipakai di URL/QR). */
  agentCode?: string | null;
  /** Profil agent yang sedang login, untuk kontak di poster. */
  selfAgent?: { nama?: string; whatsapp?: string; telepon?: string } | null;
  origin?: string;
}

/** Bangun payload poster dari objek properti Primary/Secondary. */
export function buildJualPosterData(data: any, opts: BuildOpts = {}): JualPosterData {
  const origin =
    opts.origin || (typeof window !== "undefined" ? window.location.origin : "");
  const agentCode = opts.agentCode || "";

  const listingType: "Primary" | "Secondary" =
    String(data?.jenis_transaksi).toUpperCase() === "PRIMARY" ? "Primary" : "Secondary";

  const harga = toNum(data?.harga) || toNum(data?.priceRates?.monthly);
  const promoRaw = toNum(data?.harga_promo);
  const hargaPromo = promoRaw > 0 && promoRaw < harga ? promoRaw : null;

  const agenNama: string =
    opts.selfAgent?.nama || data?.agent?.nama || data?.owner?.name || "Agent Premier";
  const agenTelp: string =
    opts.selfAgent?.whatsapp ||
    opts.selfAgent?.telepon ||
    data?.agent?.telepon ||
    data?.agent?.whatsapp ||
    data?.owner?.phone ||
    "0812 12 14017";

  const slugId =
    data?.slug && data?.id_property
      ? `${data.slug}-${data.id_property}`
      : String(data?.id_property || data?.id || "");
  const qrUrl = `${origin}/Jual/${slugId}${agentCode ? `/${agentCode}` : ""}`;

  const photos: string[] = Array.isArray(data?.foto_list)
    ? data.foto_list.filter((u: any) => typeof u === "string" && /^(https?:)?\/\/|^\//.test(u))
    : [];

  return {
    judul: data?.judul || data?.title || "Properti Premium",
    kota: data?.kota || "",
    listingType,
    alamat: data?.alamat_lengkap || data?.address || "-",
    luasTanah: toIntOrNull(data?.luas_tanah),
    luasBangunan: toIntOrNull(data?.luas_bangunan),
    kamarTidur: toIntOrNull(data?.kamar_tidur),
    kamarMandi: toIntOrNull(data?.kamar_mandi),
    lantai: toIntOrNull(data?.jumlah_lantai),
    sertifikat: (data?.legalitas || "-").toString(),
    harga,
    hargaPromo,
    agenNama,
    agenTelp,
    qrUrl,
    photos,
  };
}

/** Render + unduh poster Primary/Secondary. */
export async function downloadJualPoster(
  payload: JualPosterData,
  onStateChange?: (loading: boolean) => void,
): Promise<void> {
  return downloadPosterImage(
    "/api/poster/jual",
    payload,
    `poster-${payload.listingType.toLowerCase()}-${safeFileName(payload.judul)}`,
    onStateChange,
  );
}

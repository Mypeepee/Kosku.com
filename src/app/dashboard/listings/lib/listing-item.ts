// src/app/dashboard/listings/lib/listing-item.ts
import type { PropertyDB } from "@/components/property/PropertyCard";

/**
 * Satu baris listing di dasbor = persis bentuk yang dimakan kartu bersama
 * (@/components/property/PropertyCard), ditambah angka yang hanya ada di
 * dasbor.
 *
 * Sengaja bukan bentuk sendiri. Versi sebelumnya memakai tipe `Listing` khas
 * dasbor lalu menerjemahkannya ke bentuk kartu tepat sebelum render — dan
 * penerjemah itulah yang diam-diam membuang seluruh field kos, apartemen sewa
 * & diskon lelang, sehingga kartu di dasbor tampil beda dari kartu yang sama
 * di halaman publik. Yang tidak ada di tipe ini tidak bisa hilang.
 */
export type DashboardListing = PropertyDB & {
  /** Jumlah kunjungan halaman detail — hanya dipakai baris aksi di dasbor. */
  views: number;
};

/* ───────────────────────────── Normalisasi ───────────────────────────── */

function isValidImageUrl(s: string): boolean {
  return s.startsWith("http://") || s.startsWith("https://") || s.startsWith("/");
}

/**
 * Kolom `gambar` menyimpan daftar dipisah koma yang isinya campuran: URL penuh
 * (hasil scraper) dan id file Drive (unggahan agent). Id disalurkan lewat proxy
 * sendiri, bukan langsung ke Drive — lihat /api/drive-image.
 */
export function normalizeListingImages(raw: string | null | undefined): string[] {
  if (!raw || raw.trim() === "") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => (isValidImageUrl(s) ? s : `/api/drive-image?id=${s}&sz=w400`));
}

export function normalizeAgentPhoto(fileId: string | null | undefined): string {
  if (!fileId || fileId.trim() === "") return "/images/default-profile.png";
  const t = fileId.trim();
  if (t.startsWith("http://") || t.startsWith("https://") || t.startsWith("/")) return t;
  return `/api/drive-image?id=${t}&sz=w64`;
}

/* ─────────────────────────────── Pemetaan ────────────────────────────── */

/**
 * Baris Prisma → bentuk kartu. Satu-satunya tempat pemetaan ini boleh terjadi.
 *
 * Baris yang dikirim WAJIB menyertakan `sewaDetail`, `_count.kamarTipe` dan
 * relasi `agent` — tanpa itu kartu kos/apartemen sewa kehilangan isinya lagi.
 */
export function toDashboardListing(row: any, limitAwal?: number | null): DashboardListing {
  const idStr = String(row.id_property);
  const fotoList = normalizeListingImages(row.gambar);

  return {
    id_property: idStr,
    slug: row.slug,
    judul: row.judul,
    kota: row.kota,
    kecamatan: row.kecamatan,
    kelurahan: row.kelurahan,
    alamat_lengkap: row.alamat_lengkap ?? "",
    // Untuk LELANG angka yang berlaku adalah nilai limitnya, bukan `harga`.
    harga: row.nilai_limit_lelang ? Number(row.nilai_limit_lelang) : Number(row.harga),
    harga_promo: row.harga_promo != null ? Number(row.harga_promo) : null,
    jenis_transaksi: row.jenis_transaksi,
    kategori: row.kategori,
    status_tayang: row.status_tayang ?? "",
    gambar: fotoList[0] || "/images/hero/banner.jpg",
    foto_list: fotoList,
    luas_tanah: Number(row.luas_tanah ?? 0),
    luas_bangunan: Number(row.luas_bangunan ?? 0),
    kamar_tidur: row.kamar_tidur ?? 0,
    kamar_mandi: row.kamar_mandi ?? 0,
    tanggal_lelang: row.tanggal_lelang ? new Date(row.tanggal_lelang).toISOString() : null,
    lelang_limit_awal: limitAwal ?? null,
    // Field sewa (kos & apartemen) — dipakai kartu bersama.
    durasi_sewa: row.sewaDetail?.durasi_sewa ?? null,
    kamar_mandi_tipe: row.sewaDetail?.kamar_mandi_tipe ?? null,
    kos_gender: row.sewaDetail?.kos_gender ?? null,
    kamar_tersedia: row.sewaDetail?.kamar_tersedia ?? null,
    tipe_unit: row.sewaDetail?.tipe_unit ?? null,
    lantai_unit: row.sewaDetail?.lantai_unit ?? null,
    kapasitas_penghuni: row.sewaDetail?.kapasitas_penghuni ?? null,
    kondisi_interior: row.kondisi_interior ?? null,
    jumlah_tipe_kamar: row._count?.kamarTipe ?? 0,
    fasilitas_kamar: row.sewaDetail?.fasilitas_kamar ?? null,
    fasilitas_bersama: row.sewaDetail?.fasilitas_bersama ?? null,
    akses_terdekat: Array.isArray(row.akses_terdekat) ? (row.akses_terdekat as any[]) : [],
    agent_name: row.agent?.pengguna?.nama_lengkap || "Agent Kosku",
    agent_photo: normalizeAgentPhoto(row.agent?.foto_profil_url),
    agent_office: row.agent?.nama_kantor || "Kosku",
    is_hot_deal: !!row.is_hot_deal,
    views: row.dilihat ?? 0,
  };
}

/** Include minimum yang dibutuhkan `toDashboardListing`. */
export const DASHBOARD_LISTING_INCLUDE = {
  agent: {
    select: {
      nama_kantor: true,
      foto_profil_url: true,
      pengguna: { select: { nama_lengkap: true } },
    },
  },
  // Kartu bersama menampilkan sisa kamar, gender, kamar mandi dalam/luar &
  // fasilitas untuk KOS, serta tipe unit/lantai/kapasitas untuk apartemen
  // sewa — semuanya hidup di listing_sewa_detail. Tanpa ini kos di dasbor
  // kembali tampil dengan grid KT/KM/LT/LB yang seluruhnya "-".
  sewaDetail: true,
  _count: { select: { kamarTipe: true } },
} as const;

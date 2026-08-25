// src/app/dashboard/listings/lib/filters.ts
//
// ══════════════════════════════════════════════════════════════════════════
// KONTRAK FILTER DAFTAR LISTING (dasbor) — satu sumber kebenaran
// ══════════════════════════════════════════════════════════════════════════
//
// Dulu aturannya tersebar di tiga tempat yang harus sepakat tapi tidak pernah
// dipaksa sepakat: `page.tsx` memparse URL & menyusun `where`, `ListingFilters`
// (milik halaman transaksi) menyusun UI-nya, dan `ListingCardGrid` menyusun
// ulang URL-nya dari state. Setiap penambahan filter berarti mengubah tiga file
// dan setiap kelupaan berarti filter yang "kelihatan aktif tapi tidak menyaring"
// — persis yang terjadi pada kategori KOS: pilihannya tidak pernah ada di UI,
// dan seandainya ada pun `VALID_KATEGORI` di server akan membuangnya diam-diam.
//
// Sekarang: URL → state → where → URL semuanya lewat modul ini.

import {
  Prisma,
  type jenis_transaksi_enum,
  type kategori_properti_enum,
} from "@prisma/client";
import {
  buildOrderBy,
  buildSortWhere,
  opsiUrut,
  type KonteksListing,
  type OpsiUrut,
  type SortKey,
} from "@/lib/listingSort";
import { normalizeRegionName } from "@/lib/regionSearch";

/* ─────────────────────────────── Katalog ─────────────────────────────── */

export type JenisFilter = "ALL" | "PRIMARY" | "SECONDARY" | "LELANG" | "SEWA";

export type KategoriFilter =
  | "ALL"
  | "RUMAH"
  | "APARTEMEN"
  | "RUKO"
  | "TANAH"
  | "GUDANG"
  | "HOTEL_DAN_VILLA"
  | "TOKO"
  | "PABRIK"
  | "KOS";

export type PilihanFilter<T extends string> = {
  value: T;
  label: string;
  icon: string;
};

export const JENIS_OPTIONS: PilihanFilter<JenisFilter>[] = [
  { value: "ALL", label: "Semua Jenis", icon: "solar:widget-4-bold-duotone" },
  { value: "PRIMARY", label: "Primary", icon: "solar:home-2-bold-duotone" },
  { value: "SECONDARY", label: "Secondary", icon: "solar:buildings-3-bold-duotone" },
  { value: "LELANG", label: "Lelang", icon: "mdi:gavel" },
  { value: "SEWA", label: "Sewa", icon: "solar:key-bold-duotone" },
];

/**
 * KOS sengaja ditandai `hanyaSewa`. Kos tidak pernah dijual per gedung lewat
 * situs ini — kategori itu hanya berarti di dalam jenis transaksi SEWA, dan
 * menampilkannya saat jenisnya "Lelang" cuma menawarkan kombinasi yang pasti
 * nol hasil. Ia tetap TERLIHAT (redup, dengan keterangan), bukan dihilangkan:
 * pilihan yang hilang membuat orang mengira fiturnya tidak ada.
 */
export const KATEGORI_OPTIONS: (PilihanFilter<KategoriFilter> & {
  hanyaSewa?: boolean;
})[] = [
  { value: "ALL", label: "Semua Tipe", icon: "solar:widget-3-bold-duotone" },
  { value: "RUMAH", label: "Rumah", icon: "solar:home-2-bold-duotone" },
  { value: "APARTEMEN", label: "Apartemen", icon: "solar:buildings-2-bold-duotone" },
  { value: "KOS", label: "Kos", icon: "solar:bed-bold-duotone", hanyaSewa: true },
  { value: "RUKO", label: "Ruko", icon: "solar:shop-2-bold-duotone" },
  { value: "TOKO", label: "Toko", icon: "solar:shop-bold-duotone" },
  { value: "TANAH", label: "Tanah", icon: "solar:map-point-wave-bold-duotone" },
  { value: "GUDANG", label: "Gudang", icon: "solar:box-minimalistic-bold-duotone" },
  { value: "PABRIK", label: "Pabrik", icon: "solar:garage-bold-duotone" },
  { value: "HOTEL_DAN_VILLA", label: "Hotel & Villa", icon: "solar:bed-bold-duotone" },
];

const JENIS_VALID = new Set(JENIS_OPTIONS.map((o) => o.value));
const KATEGORI_VALID = new Set(KATEGORI_OPTIONS.map((o) => o.value));

export function labelJenis(v: JenisFilter): string {
  return JENIS_OPTIONS.find((o) => o.value === v)?.label ?? "Semua Jenis";
}
export function iconJenis(v: JenisFilter): string {
  return JENIS_OPTIONS.find((o) => o.value === v)?.icon ?? JENIS_OPTIONS[0].icon;
}
export function labelKategori(v: KategoriFilter): string {
  return KATEGORI_OPTIONS.find((o) => o.value === v)?.label ?? "Semua Tipe";
}
export function iconKategori(v: KategoriFilter): string {
  return KATEGORI_OPTIONS.find((o) => o.value === v)?.icon ?? KATEGORI_OPTIONS[0].icon;
}

/** Apakah kategori ini boleh dipilih pada jenis transaksi yang sedang aktif? */
export function kategoriTersedia(
  kategori: KategoriFilter,
  jenis: JenisFilter
): boolean {
  const opt = KATEGORI_OPTIONS.find((o) => o.value === kategori);
  return !opt?.hanyaSewa || jenis === "SEWA";
}

/* ──────────────────────────────── Urutan ─────────────────────────────── */

export type DashboardSortKey = "diperbarui" | SortKey;

export type OpsiUrutDasbor = Omit<OpsiUrut, "value"> & { value: DashboardSortKey };

/**
 * Urutan bawaan dasbor BUKAN "terbaru" (tanggal dibuat) melainkan tanggal
 * diubah — dan itu memang beda kebutuhan dari halaman publik. Pengunjung
 * mencari listing yang baru tayang; agent mencari listing yang baru saja ia
 * sentuh, karena dari sanalah pekerjaannya dilanjutkan. Ini juga perilaku yang
 * sudah berjalan sebelum kontrol urutan ada, jadi tidak ada yang berubah bagi
 * pemakai yang tidak menyentuh menu ini.
 */
const OPSI_DIPERBARUI: OpsiUrutDasbor = {
  value: "diperbarui",
  label: "Terakhir diperbarui",
  hint: "Urutan bawaan dasbor — listing yang paling baru kamu ubah",
  icon: "solar:refresh-circle-bold-duotone",
  grup: "umum",
};

export const SORT_DEFAULT: DashboardSortKey = "diperbarui";

/**
 * Konteks urut mengikuti jenis transaksi yang sedang disaring. Tanpa ini,
 * "Jadwal terdekat" (yang hanya berarti untuk lelang) akan ditawarkan pada
 * daftar rumah dijual, dan label "terluas" akan menyebut luas tanah pada
 * daftar sewa yang mengurutkan luas bangunan.
 */
export function konteksUrut(jenis: JenisFilter): KonteksListing {
  if (jenis === "LELANG") return "LELANG";
  if (jenis === "SEWA") return "SEWA";
  return "JUAL";
}

export function opsiUrutDasbor(jenis: JenisFilter): OpsiUrutDasbor[] {
  return [OPSI_DIPERBARUI, ...opsiUrut(konteksUrut(jenis))];
}

export function parseSortDasbor(
  raw: string | string[] | undefined,
  jenis: JenisFilter
): DashboardSortKey {
  const teks = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase();
  if (!teks) return SORT_DEFAULT;
  const cocok = opsiUrutDasbor(jenis).find((o) => o.value === teks);
  return cocok?.value ?? SORT_DEFAULT;
}

export function labelSortDasbor(sort: DashboardSortKey, jenis: JenisFilter): string {
  return (
    opsiUrutDasbor(jenis).find((o) => o.value === sort)?.label ??
    OPSI_DIPERBARUI.label
  );
}

export function iconSortDasbor(sort: DashboardSortKey, jenis: JenisFilter): string {
  return (
    opsiUrutDasbor(jenis).find((o) => o.value === sort)?.icon ?? OPSI_DIPERBARUI.icon
  );
}

/**
 * Sebagian opsi urut lelang ("jadwal terdekat") sekaligus MENYARING hasil.
 * UI memakai ini untuk memberi tahu, supaya tidak ada agent yang mengira
 * listingnya hilang.
 */
export function sortIkutMenyaring(sort: DashboardSortKey): boolean {
  return (
    sort === "lelang-terdekat" ||
    sort === "lelang-terjauh" ||
    sort === "lelang-berlalu"
  );
}

export function orderByDasbor(
  sort: DashboardSortKey,
  jenis: JenisFilter
): Prisma.ListingOrderByWithRelationInput[] {
  if (sort === "diperbarui") {
    // Pemecah seri wajib — tanpa `id_property` dua listing yang diubah pada
    // detik yang sama boleh bertukar posisi antar query, dan paginasi
    // LIMIT/OFFSET akan menampilkan listing yang sama dua kali.
    return [{ tanggal_diupdate: "desc" }, { id_property: "desc" }];
  }
  // Murni, tanpa menyentuh database: berkas ini ikut dimuat komponen klien
  // (ListingFilterBar), jadi ia tidak boleh mengimpor Prisma. Penyesuaian
  // kolom harga dilakukan pemanggilnya di server lewat sesuaikanKolomHarga().
  return buildOrderBy(sort, konteksUrut(jenis));
}

/* ───────────────────────────── Bentuk filter ─────────────────────────── */

export type ListingFilters = {
  q: string;
  jenis: JenisFilter;
  kategori: KategoriFilter;
  provinsi: string;
  kota: string;
  kecamatan: string;
  kelurahan: string;
  sort: DashboardSortKey;
};

export const FILTER_KOSONG: ListingFilters = {
  q: "",
  jenis: "ALL",
  kategori: "ALL",
  provinsi: "",
  kota: "",
  kecamatan: "",
  kelurahan: "",
  sort: SORT_DEFAULT,
};

type RawSearchParams = Record<string, string | string[] | undefined>;

const teksParam = (v: string | string[] | undefined): string =>
  (Array.isArray(v) ? v[0] : v ?? "").trim();

export function parseListingFilters(sp: RawSearchParams): ListingFilters {
  const jenisRaw = teksParam(sp.jenis).toUpperCase() as JenisFilter;
  const jenis = JENIS_VALID.has(jenisRaw) ? jenisRaw : "ALL";

  const kategoriRaw = teksParam(sp.kategori).toUpperCase() as KategoriFilter;
  const kategori = KATEGORI_VALID.has(kategoriRaw) ? kategoriRaw : "ALL";

  return {
    q: teksParam(sp.q),
    jenis,
    kategori,
    provinsi: teksParam(sp.provinsi),
    kota: teksParam(sp.kota),
    kecamatan: teksParam(sp.kecamatan),
    kelurahan: teksParam(sp.kelurahan),
    sort: parseSortDasbor(sp.sort, jenis),
  };
}

/**
 * State → query string. Nilai bawaan sengaja TIDAK ditulis: URL yang bersih
 * (`/dashboard/listings`) berarti "tidak ada filter", dan itu yang dilihat
 * pemakai saat menekan reset.
 */
export function buildListingQuery(f: ListingFilters, page: number): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.jenis !== "ALL") p.set("jenis", f.jenis);
  if (f.kategori !== "ALL") p.set("kategori", f.kategori);
  if (f.provinsi) p.set("provinsi", f.provinsi);
  if (f.kota) p.set("kota", f.kota);
  if (f.kecamatan) p.set("kecamatan", f.kecamatan);
  if (f.kelurahan) p.set("kelurahan", f.kelurahan);
  if (f.sort !== SORT_DEFAULT) p.set("sort", f.sort);
  if (page > 1) p.set("page", String(page));
  return p.toString();
}

/** Jumlah filter yang benar-benar menyaring. Urutan tidak dihitung: ia
 *  menyusun ulang daftar, tidak membuang isinya. */
export function jumlahFilterAktif(f: ListingFilters): number {
  let n = 0;
  if (f.q.trim()) n++;
  if (f.jenis !== "ALL") n++;
  if (f.kategori !== "ALL") n++;
  if (f.provinsi) n++;
  if (f.kota) n++;
  if (f.kecamatan) n++;
  if (f.kelurahan) n++;
  return n;
}

/** Ada sesuatu untuk di-reset? Termasuk urutan, karena tombol reset
 *  mengembalikan halaman ke keadaan awal seutuhnya. */
export function adaYangBisaDireset(f: ListingFilters): boolean {
  return jumlahFilterAktif(f) > 0 || f.sort !== SORT_DEFAULT;
}

/* ──────────────────────────── Prisma `where` ─────────────────────────── */

const LEVEL_LOKASI = ["provinsi", "kota", "kecamatan", "kelurahan"] as const;
type LevelLokasi = (typeof LEVEL_LOKASI)[number];

/**
 * `where` untuk daftar & hitungannya.
 *
 * `abaikan` dipakai untuk menghitung facet (angka di sebelah tiap pilihan
 * dropdown): jumlah listing seandainya dimensi ITU diganti, dengan filter lain
 * tetap berlaku. Tanpa itu, angka di sebelah "Lelang" akan selalu 0 ketika
 * "Sewa" sedang dipilih — tidak berguna sebagai panduan.
 */
export function buildListingWhere(opts: {
  filters: ListingFilters;
  scope: Prisma.ListingWhereInput;
  abaikan?: "jenis" | "kategori";
  sekarang?: Date;
}): Prisma.ListingWhereInput {
  const { filters, scope, abaikan, sekarang = new Date() } = opts;

  // Semua syarat masuk ke `AND`, TIDAK di-spread ke objek induk: `scope` milik
  // STOKER berisi kunci `OR`, dan pencarian teks juga memakai `OR`. Dua `OR`
  // dalam satu objek membuat salah satunya hilang tanpa error.
  const and: Prisma.ListingWhereInput[] = [scope];

  // Opsi urut jadwal lelang ikut membatasi hasil (lihat buildSortWhere).
  // Dilewati saat menghitung facet jenis: pertanyaannya "berapa banyak kalau
  // saya pindah ke Primary?", dan batas tanggal lelang tidak berlaku di sana.
  if (abaikan !== "jenis" && filters.sort !== "diperbarui") {
    const sortWhere = buildSortWhere(
      filters.sort,
      konteksUrut(filters.jenis),
      sekarang
    );
    if (sortWhere) and.push(sortWhere);
  }

  // Lokasi: satu jalur menurun (provinsi ∧ kota ∧ kecamatan ∧ kelurahan),
  // bukan gabungan — picker-nya memang memilih satu jalur.
  //
  // Nama kota dinormalisasi dulu ("Kota Surabaya" → "Surabaya"): dataset
  // wilayah menyimpan prefiksnya, kolom `kota` di DB tidak. Tanpa ini filter
  // kota tidak pernah menghasilkan apa pun, dan kelihatan seperti "tidak ada
  // listing di kota saya".
  for (const level of LEVEL_LOKASI) {
    const nilai = normalizeRegionName(filters[level as LevelLokasi], level);
    if (!nilai) continue;
    and.push({ [level]: { contains: nilai, mode: "insensitive" } } as Prisma.ListingWhereInput);
  }

  const q = filters.q.trim();
  if (q) {
    const or: Prisma.ListingWhereInput[] = [
      { judul: { contains: q, mode: "insensitive" } },
      { alamat_lengkap: { contains: q, mode: "insensitive" } },
      { kota: { contains: q, mode: "insensitive" } },
      { kecamatan: { contains: q, mode: "insensitive" } },
      { kelurahan: { contains: q, mode: "insensitive" } },
    ];
    // Batas 18 digit: di atas itu angkanya lewat dari jangkauan bigint Postgres
    // dan query-nya gagal — pencarian tidak boleh bisa dijatuhkan dengan
    // menempelkan angka panjang di kotak cari.
    if (/^\d{1,18}$/.test(q)) or.push({ id_property: { equals: BigInt(q) } });
    and.push({ OR: or });
  }

  return {
    status_tayang: "TERSEDIA",
    ...(abaikan !== "jenis" && filters.jenis !== "ALL"
      ? { jenis_transaksi: filters.jenis as jenis_transaksi_enum }
      : {}),
    ...(abaikan !== "kategori" && filters.kategori !== "ALL"
      ? { kategori: filters.kategori as kategori_properti_enum }
      : {}),
    AND: and,
  };
}

// src/lib/listingFilters.ts
//
// ══════════════════════════════════════════════════════════════════════════
// MESIN "FILTER" — satu sumber kebenaran untuk menyaring daftar listing.
// Pasangan dari src/lib/listingSort.ts (mesin "Urutkan").
// ══════════════════════════════════════════════════════════════════════════
//
// MASALAH YANG DIPECAHKAN
// Halaman kategori (/properti/[slug]) merakit sendiri `where`-nya dan hasilnya
// tidak sejalan dengan halaman lain maupun dengan kartunya sendiri:
//
//  1. Filter harga memakai kolom `harga`, sedangkan kartu mencetak
//     `harga_efektif` (harga promo bila diskonnya sah) dan "Urutkan → harga
//     terendah" juga memakai `harga_efektif`. Satu listing bisa lolos filter
//     "maks 500 jt" sambil memajang angka 1 M di kartunya.
//  2. Delapan parameter yang dikirim search bar & tautan lama — `durasi`,
//     `gender`, `minKT`, `minKM`, `lantai`, `kondisi`, `hadap`, `legalitas` —
//     tidak pernah dibaca halaman itu. Filternya terlihat aktif di URL tapi
//     tidak menyaring apa pun.
//  3. `minHarga` yang lebih besar dari `maxHarga` menghasilkan 0 hasil tanpa
//     penjelasan, bukan hasil yang masuk akal.
//  4. Tidak ada yang tahu filter mana yang RELEVAN untuk tab mana, jadi tab
//     Jual pernah menawarkan "gender kos" dan tab Sewa tidak pernah menawarkan
//     durasi sewa.
//
// PRINSIPNYA
//   • Yang disaring harus SAMA dengan yang diurut dan yang dibaca pemakai.
//   • Katalog bidang bergantung KONTEKS (tab transaksi), sekali didefinisikan.
//   • Nilai di URL adalah kontrak publik: URL lama tetap harus jalan, dan nilai
//     rusak tidak pernah boleh melempar error — hanya diabaikan.

import { Prisma } from "@prisma/client";
import { buildKataKunciWhere } from "@/lib/listingKataKunci";
import { buildLocationWhere } from "./listingLocationFilter";
import { parseCategoryDbList, TYPE_DB_TO_DISPLAY } from "./propertyType";
import {
  parseLocationParams,
  parseRegionValue,
  regionLabel,
  REGION_LEVELS,
  type ParsedLocations,
  type RegionLevel,
} from "./regionSearch";

/* ─────────────────────────────── Konteks ─────────────────────────────── */

/**
 * Konteks = tab transaksi yang sedang dibuka. Ia menentukan bidang mana yang
 * ditawarkan UI DAN bidang mana yang benar-benar dipakai menyusun query.
 * Sengaja senama dengan `KonteksListing` di listingSort.ts supaya satu nilai
 * bisa menyetir filter dan urutan sekaligus.
 */
export type KonteksFilter = "SEMUA" | "JUAL" | "LELANG" | "SEWA";

/** Nilai param `tipe` di /properti/[slug] → konteks. Nilai asing → SEMUA. */
export function konteksDariTab(tipe: string | undefined | null): KonteksFilter {
  switch ((tipe ?? "").trim().toLowerCase()) {
    case "jual":
      return "JUAL";
    case "lelang":
      return "LELANG";
    case "sewa":
      return "SEWA";
    default:
      return "SEMUA";
  }
}

/* ──────────────────────────── Bentuk state ───────────────────────────── */

/** Preset jadwal lelang. Nilainya ikut jadi nilai param `jadwal` di URL. */
export type JadwalLelang = "akan-datang" | "7-hari" | "30-hari" | "sudah-lewat";

export interface FilterState {
  /** Kata kunci alamat/judul. Eksklusif dengan `idProperty`. */
  q?: string;
  /** Pencarian ID eksak — MELEWATI seluruh filter sekunder (lihat buildListingWhere). */
  idProperty?: string;

  lokasi: ParsedLocations;
  /** Enum `kategori_properti_enum` yang sudah divalidasi. */
  kategori: string[];

  minHarga?: number;
  maxHarga?: number;
  minLT?: number;
  maxLT?: number;
  minLB?: number;
  maxLB?: number;

  minKT?: number;
  minKM?: number;
  minLantai?: number;

  kondisi?: string;
  hadap?: string;
  legalitas?: string;

  /** LELANG saja. */
  jadwal?: JadwalLelang;

  /** SEWA saja. */
  durasi?: string;
  gender?: string;
  kamarMandiTipe?: string;
  tipeUnit?: string;

  hotDeal: boolean;
}

/* ──────────────────────── Katalog bidang per konteks ──────────────────── */

/**
 * Nama bidang logis. Satu bidang bisa memakai lebih dari satu param URL
 * (mis. `harga` memakai minHarga+maxHarga) — pemetaannya ada di PARAM_BIDANG.
 */
export type BidangFilter =
  /**
   * Kata kunci / ID properti. Sengaja TIDAK masuk BIDANG_PER_KONTEKS: ia tidak
   * punya trigger sendiri di bar (search bar hero yang mengisinya), tapi tetap
   * butuh identitas bidang supaya bisa muncul & dihapus sebagai chip aktif.
   */
  | "keyword"
  | "lokasi"
  | "kategori"
  | "harga"
  | "luasTanah"
  | "luasBangunan"
  | "kamar"
  | "lantai"
  | "kondisi"
  | "hadap"
  | "legalitas"
  | "jadwal"
  | "durasi"
  | "gender"
  | "kamarMandiTipe"
  | "tipeUnit"
  | "hotDeal";

/**
 * Bidang mana yang berlaku di konteks mana.
 *
 * Ini bukan sekadar urusan tampilan: `buildListingWhere` memakai daftar yang
 * SAMA untuk memutuskan bidang mana yang ikut menyusun query. Jadi `gender`
 * yang tertinggal di URL saat pemakai pindah ke tab Jual tidak akan diam-diam
 * mengosongkan hasilnya — ia hanya tersimpan, tidak diterapkan.
 *
 * Urutan di dalam array = urutan tampil di UI, dari yang paling sering dipakai.
 */
const BIDANG_PER_KONTEKS: Record<KonteksFilter, BidangFilter[]> = {
  SEMUA: [
    "lokasi",
    "kategori",
    "harga",
    "kamar",
    "luasTanah",
    "luasBangunan",
    "lantai",
    "kondisi",
    "hadap",
    "legalitas",
    "hotDeal",
  ],
  JUAL: [
    "lokasi",
    "kategori",
    "harga",
    "kamar",
    "luasTanah",
    "luasBangunan",
    "lantai",
    "legalitas",
    "kondisi",
    "hadap",
    "hotDeal",
  ],
  LELANG: [
    "lokasi",
    "kategori",
    "harga",
    // Jadwal ditaruh tinggi: pertanyaan pertama pemburu lelang adalah "mana
    // yang masih sempat saya ikuti?", bukan berapa kamarnya.
    "jadwal",
    "kamar",
    "luasTanah",
    "luasBangunan",
    "legalitas",
    "hotDeal",
  ],
  SEWA: [
    "lokasi",
    "kategori",
    "harga",
    "durasi",
    "kamar",
    // Luas tanah tidak ditawarkan: yang disewakan adalah unit/kamar, dan
    // `luas_tanah` pada kos & apartemen memang kosong.
    "luasBangunan",
    "tipeUnit",
    "gender",
    "kamarMandiTipe",
    "kondisi",
    "hotDeal",
  ],
};

/** Bidang yang berlaku di konteks ini, urut sesuai tampilan. */
export function bidangUntuk(konteks: KonteksFilter): BidangFilter[] {
  return BIDANG_PER_KONTEKS[konteks];
}

export function bidangBerlaku(
  bidang: BidangFilter,
  konteks: KonteksFilter
): boolean {
  return BIDANG_PER_KONTEKS[konteks].includes(bidang);
}

/** Param URL yang dimiliki tiap bidang — dipakai saat menghapus chip. */
const PARAM_BIDANG: Record<BidangFilter, string[]> = {
  keyword: ["q", "idProperty"],
  lokasi: [...REGION_LEVELS],
  kategori: ["kategori"],
  harga: ["minHarga", "maxHarga"],
  luasTanah: ["minLT", "maxLT"],
  luasBangunan: ["minLB", "maxLB"],
  kamar: ["minKT", "minKM"],
  lantai: ["lantai"],
  kondisi: ["kondisi"],
  hadap: ["hadap"],
  legalitas: ["legalitas"],
  jadwal: ["jadwal"],
  durasi: ["durasi"],
  gender: ["gender"],
  kamarMandiTipe: ["kmTipe"],
  tipeUnit: ["tipeUnit"],
  hotDeal: ["hotDeal"],
};

export function paramBidang(bidang: BidangFilter): string[] {
  return PARAM_BIDANG[bidang];
}

/* ───────────────────────────── Daftar nilai ──────────────────────────── */

export const OPSI_KONDISI = ["Furnished", "Semi Furnished", "Unfurnished"];
export const OPSI_HADAP = ["Utara", "Selatan", "Timur", "Barat"];

export const OPSI_LEGALITAS: { value: string; label: string }[] = [
  { value: "SHM", label: "SHM" },
  { value: "HGB", label: "HGB" },
  { value: "HGU", label: "HGU" },
  { value: "HP", label: "Hak Pakai" },
  { value: "STRATA_TITLE", label: "Strata Title" },
  { value: "PPJB", label: "PPJB" },
  { value: "AJB", label: "AJB" },
  { value: "LAINNYA", label: "Lainnya" },
];

export const OPSI_TIPE_UNIT: { value: string; label: string }[] = [
  { value: "STUDIO", label: "Studio" },
  { value: "SATU_KAMAR", label: "1 Kamar" },
  { value: "DUA_KAMAR", label: "2 Kamar" },
  { value: "TIGA_KAMAR", label: "3 Kamar" },
  { value: "EMPAT_KAMAR_PLUS", label: "4+ Kamar" },
];

export const OPSI_KAMAR_MANDI_TIPE: { value: string; label: string }[] = [
  { value: "DALAM", label: "Dalam kamar" },
  { value: "LUAR", label: "Luar kamar" },
];

export const OPSI_JADWAL: { value: JadwalLelang; label: string; hint: string }[] =
  [
    {
      value: "akan-datang",
      label: "Belum berlangsung",
      hint: "Semua lelang yang jadwalnya belum lewat",
    },
    {
      value: "7-hari",
      label: "7 hari ke depan",
      hint: "Masih sempat disiapkan minggu ini",
    },
    {
      value: "30-hari",
      label: "30 hari ke depan",
      hint: "Sebulan ke depan",
    },
    {
      value: "sudah-lewat",
      label: "Sudah berlalu",
      hint: "Untuk menakar harga pasar dari lelang yang lampau",
    },
  ];

const NILAI_LEGALITAS = new Set(OPSI_LEGALITAS.map((o) => o.value));
const NILAI_TIPE_UNIT = new Set(OPSI_TIPE_UNIT.map((o) => o.value));
const NILAI_KM_TIPE = new Set(OPSI_KAMAR_MANDI_TIPE.map((o) => o.value));
const NILAI_DURASI = new Set(["HARIAN", "MINGGUAN", "BULANAN", "TAHUNAN"]);
const NILAI_GENDER = new Set(["PUTRA", "PUTRI", "CAMPUR"]);
const NILAI_JADWAL = new Set(OPSI_JADWAL.map((o) => o.value));

/* ───────────────────────────────── Parse ─────────────────────────────── */

type ParamMentah = string | string[] | undefined | null;

const teksDari = (v: ParamMentah): string | undefined => {
  const s = (Array.isArray(v) ? v[0] : v)?.trim();
  return s ? s : undefined;
};

/**
 * Angka dari URL, dijinakkan.
 *
 * `Number("abc")` = NaN dan Prisma melempar error kalau NaN sampai ke query —
 * satu URL usil cukup untuk memunculkan layar 500. Nilai negatif, pecahan, dan
 * angka raksasa (yang melebihi jangkauan Decimal(20,2) di skema) juga dibuang
 * di sini supaya tidak ada satu pun pemanggil yang perlu mengulang pemeriksaan.
 */
const BATAS_ATAS = 1e15;

function angkaPositif(v: ParamMentah): number | undefined {
  const teks = teksDari(v);
  if (teks === undefined) return undefined;
  // Titik dibuang, bukan diperlakukan sebagai desimal: setiap penulis param di
  // aplikasi ini mengirim digit polos (lihat parseRawNumber di searchTabs.ts),
  // sedangkan tautan yang ditempel manusia sering membawa format Indonesia
  // ("500.000.000"). Menafsirkannya sebagai desimal akan mengubah 500 juta
  // menjadi 500 — kesalahan yang jauh lebih besar daripada kehilangan pecahan
  // yang tidak pernah dikirim siapa pun.
  const n = Number(teks.replace(/[.\s]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > BATAS_ATAS) return undefined;
  return n;
}

function bilanganBulat(
  v: ParamMentah,
  maks: number
): number | undefined {
  const n = angkaPositif(v);
  if (n === undefined) return undefined;
  const b = Math.floor(n);
  if (b < 1 || b > maks) return undefined;
  return b;
}

/** Nilai enum DB — selalu HURUF BESAR di skema, jadi dinormalkan ke atas. */
function salahSatu(v: ParamMentah, sah: Set<string>): string | undefined {
  const teks = teksDari(v)?.toUpperCase();
  return teks && sah.has(teks) ? teks : undefined;
}

/** Nilai kunci milik aplikasi (bukan enum DB) — huruf kecil-strip. */
function salahSatuKecil(v: ParamMentah, sah: Set<string>): string | undefined {
  const teks = teksDari(v)?.toLowerCase();
  return teks && sah.has(teks) ? teks : undefined;
}

function cocokDaftar(v: ParamMentah, daftar: string[]): string | undefined {
  const teks = teksDari(v);
  if (!teks) return undefined;
  return daftar.find((d) => d.toLowerCase() === teks.toLowerCase());
}

/**
 * Pasangan min/max yang TERBALIK ditukar, bukan dibiarkan menghasilkan 0 hasil.
 *
 * "Rp 900 juta sampai Rp 100 juta" hampir selalu berarti pemakai mengetik di
 * kolom yang tertukar. Mengembalikan daftar kosong menghukumnya untuk salah
 * ketik; menukarnya memberi persis yang ia maksud.
 */
function rentang(
  min: number | undefined,
  max: number | undefined
): [number | undefined, number | undefined] {
  if (min !== undefined && max !== undefined && min > max) return [max, min];
  return [min, max];
}

export type SumberParam = { [key: string]: string | string[] | undefined };

/**
 * searchParams (server) atau URLSearchParams (klien) → state yang sudah bersih.
 * Tidak pernah melempar; nilai rusak diabaikan diam-diam.
 */
export function parseFilters(sp: SumberParam): FilterState {
  const idMentah = teksDari(sp.idProperty);
  const idProperty =
    idMentah && /^\d{1,18}$/.test(idMentah) ? idMentah : undefined;

  const [minHarga, maxHarga] = rentang(
    angkaPositif(sp.minHarga),
    angkaPositif(sp.maxHarga)
  );
  // `minLt`/`minLT` sama-sama pernah dipakai di URL yang beredar.
  const [minLT, maxLT] = rentang(
    angkaPositif(sp.minLT ?? sp.minLt),
    angkaPositif(sp.maxLT ?? sp.maxLt)
  );
  const [minLB, maxLB] = rentang(
    angkaPositif(sp.minLB ?? sp.minLb),
    angkaPositif(sp.maxLB ?? sp.maxLb)
  );

  return {
    q: idProperty ? undefined : teksDari(sp.q),
    idProperty,
    lokasi: parseLocationParams((k) => sp[k]),
    kategori: parseCategoryDbList(sp.kategori),
    minHarga,
    maxHarga,
    minLT,
    maxLT,
    minLB,
    maxLB,
    minKT: bilanganBulat(sp.minKT, 20),
    minKM: bilanganBulat(sp.minKM, 20),
    minLantai: bilanganBulat(sp.lantai, 100),
    kondisi: cocokDaftar(sp.kondisi, OPSI_KONDISI),
    hadap: cocokDaftar(sp.hadap, OPSI_HADAP),
    legalitas: salahSatu(sp.legalitas, NILAI_LEGALITAS),
    jadwal: salahSatuKecil(sp.jadwal, NILAI_JADWAL) as JadwalLelang | undefined,
    durasi: salahSatu(sp.durasi, NILAI_DURASI),
    gender: salahSatu(sp.gender, NILAI_GENDER),
    kamarMandiTipe: salahSatu(sp.kmTipe, NILAI_KM_TIPE),
    tipeUnit: salahSatu(sp.tipeUnit, NILAI_TIPE_UNIT),
    hotDeal: teksDari(sp.hotDeal) === "1",
  };
}

/** Versi praktis untuk klien (URLSearchParams). */
export function parseFiltersDariUrl(sp: URLSearchParams): FilterState {
  const obj: SumberParam = {};
  sp.forEach((v, k) => {
    obj[k] = v;
  });
  return parseFilters(obj);
}

/* ───────────────────── Jadwal lelang → rentang tanggal ───────────────── */

/**
 * `sekarang` dikirim pemanggil (bukan `new Date()` di dalam) supaya `count` dan
 * `findMany` dalam satu permintaan memakai batas waktu yang sama persis —
 * kalau tidak, sebuah lelang yang jadwalnya tepat tengah malam bisa terhitung
 * di satu query dan tidak di query berikutnya.
 */
export function whereJadwal(
  jadwal: JadwalLelang,
  sekarang: Date
): Prisma.ListingWhereInput {
  const awalHari = new Date(sekarang);
  awalHari.setHours(0, 0, 0, 0);

  const plusHari = (n: number) => {
    const d = new Date(awalHari);
    d.setDate(d.getDate() + n);
    return d;
  };

  switch (jadwal) {
    case "akan-datang":
      return { tanggal_lelang: { gte: awalHari } };
    case "7-hari":
      return { tanggal_lelang: { gte: awalHari, lt: plusHari(7) } };
    case "30-hari":
      return { tanggal_lelang: { gte: awalHari, lt: plusHari(30) } };
    case "sudah-lewat":
      return { tanggal_lelang: { lt: awalHari } };
  }
}

/**
 * Apakah filter jadwal sedang aktif di konteks ini?
 *
 * Dipakai halaman untuk MEMBATALKAN batasan implisit dari `buildSortWhere`
 * (listingSort.ts). "Urutkan → jadwal terdekat" diam-diam menyaring
 * `tanggal_lelang >= hari ini`; kalau pemakai juga memilih filter jadwal
 * "sudah berlalu", irisan keduanya kosong dan daftar jadi nol tanpa sebab yang
 * terlihat. Aturannya satu dan tegas: filter yang dipilih pemakai menang,
 * urutannya tetap dipakai.
 */
export function jadwalMenimpaSort(
  state: FilterState,
  konteks: KonteksFilter
): boolean {
  return state.jadwal !== undefined && bidangBerlaku("jadwal", konteks);
}

/* ──────────────────────────────── WHERE ──────────────────────────────── */

/**
 * State → `where` Prisma, hanya memakai bidang yang berlaku di konteks ini.
 *
 * TIDAK menyertakan `jenis_transaksi` maupun `status_tayang`: keduanya urusan
 * halaman pemanggil. Halaman kategori memakai hasil fungsi ini dua kali — sekali
 * ditambah `jenis_transaksi` untuk daftarnya, sekali tanpa itu untuk menghitung
 * angka di tiap tab — jadi memasukkannya ke sini akan membuat angka tab ikut
 * terkunci ke satu tab.
 */
export function buildListingWhere(
  state: FilterState,
  konteks: KonteksFilter,
  sekarang: Date = new Date(),
  /**
   * Kolom yang dipakai filter harga. Bawaannya `harga_efektif` — angka yang
   * tercetak di kartu. Pemanggil di sisi server mengoper hasil
   * `kolomHargaListing()` supaya filter memakai kolom yang SAMA dengan
   * urutannya, termasuk saat database itu belum menjalankan
   * prisma/migration_harga_efektif.sql (kolom turunannya ada tapi NULL, dan
   * filter di atasnya diam-diam nol hasil). Lihat src/lib/listingSortRuntime.ts.
   */
  kolomHarga: "harga_efektif" | "nilai_limit_lelang" | "harga" = "harga_efektif"
): Prisma.ListingWhereInput {
  // Pencarian ID bersifat eksak. Filter sekunder sengaja tidak ikut membatasi:
  // pemakai yang mengetik nomor properti ingin properti ITU, bukan "properti
  // itu kalau kebetulan masuk rentang harga yang tersisa di URL".
  if (state.idProperty) {
    return { id_property: BigInt(state.idProperty) };
  }

  const aktif = (b: BidangFilter) => bidangBerlaku(b, konteks);
  const and: Prisma.ListingWhereInput[] = [];

  if (state.q) {
    // Aturannya hidup di src/lib/listingKataKunci.ts — dipakai bersama oleh
    // filter halaman DAN penghitung "37 properti" di kotak pencarian. Dua
    // definisi yang kurang lebih sama adalah cara paling andal membuat angka
    // di layar meleset dari isi halaman berikutnya.
    const kataKunci = buildKataKunciWhere(state.q);
    if (kataKunci) and.push(kataKunci);
  }

  if (aktif("lokasi")) {
    // Dibangun dari `state.lokasi` yang sudah diparse, lewat pembangun bersama
    // yang juga dipakai /Jual, /Lelang, /Sewa.
    const lokasiParams: SumberParam = {};
    for (const level of REGION_LEVELS) {
      const nilai = state.lokasi[level];
      if (nilai.length) lokasiParams[level] = nilai.join(",");
    }
    const lokasiWhere = buildLocationWhere(lokasiParams);
    if (lokasiWhere) and.push(lokasiWhere);
  }

  if (aktif("kategori") && state.kategori.length > 0) {
    and.push({ kategori: { in: state.kategori as any } });
  }

  // Harga memakai kolom yang SAMA dengan yang diurut (listingSort.ts) dan yang
  // dicetak kartu — lihat parameter `kolomHarga` di atas.
  if (aktif("harga") && (state.minHarga !== undefined || state.maxHarga !== undefined)) {
    and.push({
      [kolomHarga]: {
        ...(state.minHarga !== undefined && { gte: state.minHarga }),
        ...(state.maxHarga !== undefined && { lte: state.maxHarga }),
      },
    } as Prisma.ListingWhereInput);
  }

  if (aktif("luasTanah") && (state.minLT !== undefined || state.maxLT !== undefined)) {
    and.push({
      luas_tanah: {
        ...(state.minLT !== undefined && { gte: state.minLT }),
        ...(state.maxLT !== undefined && { lte: state.maxLT }),
      },
    });
  }

  if (aktif("luasBangunan") && (state.minLB !== undefined || state.maxLB !== undefined)) {
    and.push({
      luas_bangunan: {
        ...(state.minLB !== undefined && { gte: state.minLB }),
        ...(state.maxLB !== undefined && { lte: state.maxLB }),
      },
    });
  }

  if (aktif("kamar")) {
    if (state.minKT !== undefined) and.push({ kamar_tidur: { gte: state.minKT } });
    if (state.minKM !== undefined) and.push({ kamar_mandi: { gte: state.minKM } });
  }

  if (aktif("lantai") && state.minLantai !== undefined) {
    and.push({ jumlah_lantai: { gte: state.minLantai } });
  }

  if (aktif("kondisi") && state.kondisi) {
    and.push({ kondisi_interior: { contains: state.kondisi, mode: "insensitive" } });
  }

  if (aktif("hadap") && state.hadap) {
    and.push({ hadap_bangunan: { contains: state.hadap, mode: "insensitive" } });
  }

  if (aktif("legalitas") && state.legalitas) {
    and.push({ legalitas: { equals: state.legalitas as any } });
  }

  if (aktif("jadwal") && state.jadwal) {
    and.push(whereJadwal(state.jadwal, sekarang));
  }

  if (aktif("hotDeal") && state.hotDeal) {
    and.push({ is_hot_deal: true });
  }

  // Bidang sewa hidup di relasi `listing_sewa_detail`. Prisma hanya menerima
  // SATU kunci `sewaDetail` per objek where, jadi semuanya digabung dulu di
  // sini — menulisnya sebagai beberapa kunci akan membuat yang terakhir
  // menimpa yang sebelumnya tanpa error.
  const sewa: Prisma.ListingSewaDetailWhereInput = {};
  if (aktif("durasi") && state.durasi) sewa.durasi_sewa = state.durasi as any;
  if (aktif("gender") && state.gender) sewa.kos_gender = state.gender as any;
  if (aktif("kamarMandiTipe") && state.kamarMandiTipe) {
    sewa.kamar_mandi_tipe = state.kamarMandiTipe as any;
  }
  if (aktif("tipeUnit") && state.tipeUnit) sewa.tipe_unit = state.tipeUnit as any;
  if (Object.keys(sewa).length > 0) and.push({ sewaDetail: { is: sewa } });

  return and.length > 0 ? { AND: and } : {};
}

/* ─────────────────────────── Chip filter aktif ───────────────────────── */

export interface ChipFilter {
  /** Unik untuk key React & untuk menghapus satu chip. */
  id: string;
  bidang: BidangFilter;
  label: string;
  /**
   * Param yang harus dihapus untuk membatalkan chip INI saja. Untuk bidang
   * bernilai jamak (lokasi, kategori) berisi nilai sisa, bukan penghapusan
   * seluruh param — lihat `hapusChip`.
   */
  hapus: { param: string; sisa?: string }[];
}

const rp = (n: number): string => {
  if (n >= 1_000_000_000) {
    const v = n / 1_000_000_000;
    return `Rp ${Number.isInteger(v) ? v : v.toFixed(1).replace(".", ",")} M`;
  }
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `Rp ${Number.isInteger(v) ? v : v.toFixed(1).replace(".", ",")} jt`;
  }
  if (n >= 1_000) return `Rp ${Math.round(n / 1_000)} rb`;
  return `Rp ${n.toLocaleString("id-ID")}`;
};

const angkaId = (n: number) => n.toLocaleString("id-ID");

/** "Rp 300 jt – Rp 500 jt" / "Mulai Rp 300 jt" / "Maks Rp 500 jt". */
export function labelRentang(
  min: number | undefined,
  max: number | undefined,
  format: (n: number) => string
): string | null {
  if (min !== undefined && max !== undefined) return `${format(min)} – ${format(max)}`;
  if (min !== undefined) return `Mulai ${format(min)}`;
  if (max !== undefined) return `Maks ${format(max)}`;
  return null;
}

const luas = (n: number) => `${angkaId(n)} m²`;

/**
 * Chip untuk SEMUA filter yang aktif DAN berlaku di konteks ini.
 *
 * Filter yang tersimpan di URL tapi tidak berlaku di tab ini sengaja tidak
 * muncul: menampilkannya berarti berbohong soal apa yang sedang membatasi
 * hasil. Jumlahnya dilaporkan terpisah lewat `jumlahTersembunyi` supaya
 * pemakai tetap tahu ada yang disimpan untuk tab lain.
 */
export function chipAktif(
  state: FilterState,
  konteks: KonteksFilter
): ChipFilter[] {
  const chips: ChipFilter[] = [];
  const aktif = (b: BidangFilter) => bidangBerlaku(b, konteks);

  // Kata kunci ikut jadi chip walau ia datang dari search bar hero, bukan dari
  // bar ini. Ia MEMBATASI hasil sama seperti filter lain, dan "Hapus semua"
  // ikut membuangnya — kalau tidak terlihat di sini, pemakai akan melihat
  // hasilnya menyempit tanpa satu chip pun yang menjelaskan kenapa.
  if (state.idProperty) {
    chips.push({
      id: "idProperty",
      bidang: "keyword",
      label: `ID ${state.idProperty}`,
      hapus: [{ param: "idProperty" }],
    });
  } else if (state.q) {
    chips.push({
      id: "q",
      bidang: "keyword",
      label: `"${state.q}"`,
      hapus: [{ param: "q" }],
    });
  }

  if (aktif("lokasi")) {
    for (const level of REGION_LEVELS) {
      const nilai = state.lokasi[level];
      nilai.forEach((nama) => {
        chips.push({
          id: `lokasi:${level}:${nama}`,
          bidang: "lokasi",
          // `nama` masih berbentuk nilai URL ("Taman*Sidoarjo"); chip harus
          // membacanya sebagai kalimat manusia, bukan sintaksnya.
          label: regionLabel(parseRegionValue(nama)),
          hapus: [
            {
              param: level,
              sisa: nilai.filter((n) => n !== nama).join(","),
            },
          ],
        });
      });
    }
  }

  if (aktif("kategori")) {
    state.kategori.forEach((kat) => {
      chips.push({
        id: `kategori:${kat}`,
        bidang: "kategori",
        label: TYPE_DB_TO_DISPLAY[kat] ?? kat,
        hapus: [
          {
            param: "kategori",
            sisa: state.kategori.filter((k) => k !== kat).join(","),
          },
        ],
      });
    });
  }

  const rentangChip = (
    bidang: BidangFilter,
    min: number | undefined,
    max: number | undefined,
    format: (n: number) => string,
    prefiks = ""
  ) => {
    if (!aktif(bidang)) return;
    const label = labelRentang(min, max, format);
    if (!label) return;
    chips.push({
      id: bidang,
      bidang,
      label: prefiks ? `${prefiks} ${label}` : label,
      hapus: PARAM_BIDANG[bidang].map((param) => ({ param })),
    });
  };

  rentangChip("harga", state.minHarga, state.maxHarga, rp);
  rentangChip("luasTanah", state.minLT, state.maxLT, luas, "LT");
  rentangChip("luasBangunan", state.minLB, state.maxLB, luas, "LB");

  if (aktif("kamar")) {
    if (state.minKT !== undefined) {
      chips.push({
        id: "minKT",
        bidang: "kamar",
        label: `${state.minKT}+ kamar tidur`,
        hapus: [{ param: "minKT" }],
      });
    }
    if (state.minKM !== undefined) {
      chips.push({
        id: "minKM",
        bidang: "kamar",
        label: `${state.minKM}+ kamar mandi`,
        hapus: [{ param: "minKM" }],
      });
    }
  }

  const chipTunggal = (
    bidang: BidangFilter,
    nilai: string | undefined,
    label: (v: string) => string
  ) => {
    if (!aktif(bidang) || !nilai) return;
    chips.push({
      id: bidang,
      bidang,
      label: label(nilai),
      hapus: PARAM_BIDANG[bidang].map((param) => ({ param })),
    });
  };

  chipTunggal("lantai", state.minLantai?.toString(), (v) => `${v}+ lantai`);
  chipTunggal("kondisi", state.kondisi, (v) => v);
  chipTunggal("hadap", state.hadap, (v) => `Hadap ${v}`);
  chipTunggal(
    "legalitas",
    state.legalitas,
    (v) => OPSI_LEGALITAS.find((o) => o.value === v)?.label ?? v
  );
  chipTunggal(
    "jadwal",
    state.jadwal,
    (v) => OPSI_JADWAL.find((o) => o.value === v)?.label ?? v
  );
  chipTunggal(
    "durasi",
    state.durasi,
    (v) => `Sewa ${v.charAt(0)}${v.slice(1).toLowerCase()}`
  );
  chipTunggal(
    "gender",
    state.gender,
    (v) => `Kos ${v.charAt(0)}${v.slice(1).toLowerCase()}`
  );
  chipTunggal(
    "kamarMandiTipe",
    state.kamarMandiTipe,
    (v) => OPSI_KAMAR_MANDI_TIPE.find((o) => o.value === v)?.label ?? v
  );
  chipTunggal(
    "tipeUnit",
    state.tipeUnit,
    (v) => OPSI_TIPE_UNIT.find((o) => o.value === v)?.label ?? v
  );

  if (aktif("hotDeal") && state.hotDeal) {
    chips.push({
      id: "hotDeal",
      bidang: "hotDeal",
      label: "Hot deal",
      hapus: [{ param: "hotDeal" }],
    });
  }

  return chips;
}

/** Jumlah filter aktif yang BERLAKU di konteks ini (untuk badge tombol Filter). */
export function jumlahAktif(
  state: FilterState,
  konteks: KonteksFilter
): number {
  return chipAktif(state, konteks).length;
}

/**
 * Berapa filter yang tersimpan di URL tapi tidak berlaku di tab ini.
 *
 * Filternya sengaja TIDAK dihapus saat berpindah tab — pemakai yang menyaring
 * kos putri lalu mengintip tab Jual sebentar tidak boleh kehilangan pekerjaannya
 * saat kembali. Tapi diam-diam menyimpannya juga tidak jujur, jadi angkanya
 * ditampilkan sebagai catatan kecil di bar.
 */
export function jumlahTersembunyi(
  state: FilterState,
  konteks: KonteksFilter
): number {
  const semuaKonteks: KonteksFilter[] = ["SEMUA", "JUAL", "LELANG", "SEWA"];
  const berlakuDiSini = new Set(chipAktif(state, konteks).map((c) => c.id));
  const lain = new Set<string>();
  for (const k of semuaKonteks) {
    if (k === konteks) continue;
    for (const chip of chipAktif(state, k)) {
      if (!berlakuDiSini.has(chip.id)) lain.add(chip.id);
    }
  }
  return lain.size;
}

/* ─────────────────────────── Menulis balik URL ───────────────────────── */

/** Semua param yang dikuasai mesin filter — dipakai "Hapus semua". */
export const SEMUA_PARAM_FILTER: string[] = Array.from(
  new Set(Object.values(PARAM_BIDANG).flat())
);

/**
 * Terapkan penghapusan satu chip ke URLSearchParams.
 * `sisa` kosong berarti param dibuang seluruhnya.
 */
export function hapusChip(params: URLSearchParams, chip: ChipFilter): void {
  for (const { param, sisa } of chip.hapus) {
    if (sisa) params.set(param, sisa);
    else params.delete(param);
  }
}

/**
 * Buang seluruh filter (termasuk kata kunci), sisakan konteks tab & urutan.
 * `SEMUA_PARAM_FILTER` sudah memuat `q` & `idProperty` lewat bidang `keyword`.
 */
export function hapusSemuaFilter(params: URLSearchParams): void {
  for (const param of SEMUA_PARAM_FILTER) params.delete(param);
}

/**
 * Tulis satu bidang ke URLSearchParams. Nilai kosong/undefined menghapus param
 * — supaya URL tidak menumpuk `minHarga=` yang tidak berarti apa-apa.
 */
export function setParam(
  params: URLSearchParams,
  key: string,
  value: string | number | undefined | null
): void {
  const teks = value === undefined || value === null ? "" : String(value).trim();
  if (teks) params.set(key, teks);
  else params.delete(key);
}

/** Level lokasi → label untuk UI. */
export const LABEL_LEVEL: Record<RegionLevel, string> = {
  provinsi: "Provinsi",
  kota: "Kota/Kabupaten",
  kecamatan: "Kecamatan",
  kelurahan: "Kelurahan",
};

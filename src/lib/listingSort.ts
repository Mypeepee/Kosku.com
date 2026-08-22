// src/lib/listingSort.ts
//
// ══════════════════════════════════════════════════════════════════════════
// MESIN "URUTKAN" — satu sumber kebenaran untuk semua halaman daftar
// (/Jual, /Sewa, /Lelang).
// ══════════════════════════════════════════════════════════════════════════
//
// MASALAH YANG DIPECAHKAN
// Sebelumnya tiap halaman punya aturan urut sendiri-sendiri dan tidak ada yang
// benar-benar cocok dengan apa yang dilihat pemakai:
//
//  1. "Termurah" mengurutkan kolom `harga`, padahal kartu menampilkan
//     `harga_promo` kalau ada diskon. Listing berharga Rp 5 M dengan promo
//     Rp 1 M tampil bertuliskan "Rp 1 M" tapi diurutkan sebagai Rp 5 M — jadi
//     daftar "termurah" terlihat acak. Filter harga sudah memakai harga efektif
//     sejak awal, jadi filter dan urutan saling bertentangan.
//  2. Tidak ada pemecah seri. `ORDER BY status_tayang, harga` pada listing yang
//     harganya kembar tidak menghasilkan urutan yang pasti, dan Postgres bebas
//     memberi urutan berbeda di tiap query. Akibatnya listing yang sama bisa
//     muncul dua kali di halaman 1 dan 2 — atau hilang sama sekali.
//  3. Default-nya "termahal". Baris `tanggal_dibuat: desc` di kode lama tidak
//     pernah terpakai karena `sort` sudah di-default ke "desc" sebelum sampai
//     ke sana, dan tidak ada opsi "terbaru" di UI mana pun.
//  4. Kolom yang boleh NULL (luas, tanggal lelang) diurut tanpa aturan NULL.
//     Di Postgres, DESC menaruh NULL di DEPAN — jadi "termahal"/"terluas"
//     justru diawali listing yang datanya kosong.
//  5. Tombol urut di sidebar bersifat toggle: menekan "Termurah" dua kali
//     menghapus parameternya dan diam-diam balik ke "Termahal", tanpa satu pun
//     tombol terlihat aktif.
//  6. Halaman /Lelang punya DUA komponen urut dengan nilai yang sama sekali
//     berbeda (`price_asc` vs `termurah`); yang satu tidak dikenali halamannya.
//
// PRINSIPNYA
//   • Yang diurutkan harus SAMA dengan yang dibaca pemakai di kartu.
//   • Urutan wajib total (deterministik) supaya paginasi tidak pernah bocor.
//   • Nilai `sort` di URL adalah kontrak publik: URL lama tetap harus jalan.

import { Prisma } from "@prisma/client";

/* ─────────────────────────────── Katalog ─────────────────────────────── */

/**
 * `SEMUA` adalah halaman kategori (/properti/[slug]) pada tab "Semua": satu
 * daftar yang MENCAMPUR jual, lelang, dan sewa. Ia sengaja jadi konteks
 * tersendiri, bukan alias JUAL, karena dua hal berperilaku beda di sana —
 * lihat `CATATAN_KONTEKS` dan `LABEL_LUAS`.
 */
export type KonteksListing = "JUAL" | "SEWA" | "LELANG" | "SEMUA";

export type SortKey =
  | "terbaru"
  /**
   * Hanya ada ketika sebuah tempat sedang dipilih (`?dekat=…`). Di luar itu
   * "terdekat" tidak punya arti — dekat dari mana? — jadi ia tidak pernah
   * ditawarkan, dan `parseSort` menolaknya.
   */
  | "terdekat"
  | "termurah"
  | "termahal"
  | "terluas"
  | "terkecil"
  | "terpopuler"
  | "lelang-terdekat"
  | "lelang-terjauh"
  | "lelang-berlalu";

export type GrupUrut = "umum" | "harga" | "luas" | "jadwal" | "jarak";

export type OpsiUrut = {
  value: SortKey;
  label: string;
  /** Kalimat penjelas di bawah label — supaya tidak ada opsi yang ambigu. */
  hint: string;
  icon: string;
  grup: GrupUrut;
};

const LABEL_LUAS: Record<KonteksListing, { besar: string; kecil: string }> = {
  // Tanah adalah penggerak nilai pada jual-beli & lelang; penyewa memikirkan
  // ruang yang ia tempati. Label harus menyebut kolom yang benar-benar diurut,
  // kalau tidak "terluas" pada unit apartemen terbaca seperti bug.
  JUAL: { besar: "Luas tanah terbesar", kecil: "Luas tanah terkecil" },
  LELANG: { besar: "Luas tanah terbesar", kecil: "Luas tanah terkecil" },
  SEWA: { besar: "Luas bangunan terbesar", kecil: "Luas bangunan terkecil" },
  // Daftar campuran tetap diurut memakai `luas_tanah` — satu kolom, karena
  // `orderBy` Prisma tidak bisa berpindah kolom per baris. Labelnya menyebut
  // kolom itu terang-terangan supaya apartemen & kos yang melorot ke bawah
  // (luas tanahnya NULL) terbaca sebagai konsekuensi pilihan, bukan bug.
  SEMUA: { besar: "Luas tanah terbesar", kecil: "Luas tanah terkecil" },
};

/**
 * Peringatan jujur yang ditempel di bawah pilihan urut tertentu.
 *
 * Di tab "Semua", satu daftar memuat harga jual (miliaran) dan harga sewa
 * (jutaan per bulan) sekaligus. Keduanya diurut sebagai angka rupiah polos,
 * jadi "harga terendah" praktis selalu diawali kos dan "harga tertinggi" selalu
 * diawali properti dijual. Itu bukan kerusakan yang bisa diperbaiki dengan
 * mengurutkan lebih pintar — satuannya memang berbeda — jadi yang benar adalah
 * mengatakannya, bukan menyembunyikan opsinya.
 */
export function catatanUrut(
  sort: SortKey,
  konteks: KonteksListing
): string | null {
  if (konteks !== "SEMUA") return null;
  if (sort === "termurah" || sort === "termahal") {
    return "Harga sewa (per durasi) dan harga jual dibandingkan apa adanya. Pilih tab Jual, Lelang, atau Sewa untuk perbandingan yang setara.";
  }
  if (sort === "terluas" || sort === "terkecil") {
    return "Diurut menurut luas tanah. Apartemen & kos yang tidak punya luas tanah ditaruh paling belakang.";
  }
  return null;
}

function opsiUmum(konteks: KonteksListing): OpsiUrut[] {
  return [
    {
      value: "terbaru",
      label: "Terbaru",
      hint: "Listing yang paling baru ditayangkan",
      icon: "solar:clock-circle-bold-duotone",
      grup: "umum",
    },
    {
      value: "termurah",
      label: "Harga terendah",
      hint: "Memakai harga yang tampil di kartu, termasuk harga promo",
      icon: "solar:sort-from-bottom-to-top-bold-duotone",
      grup: "harga",
    },
    {
      value: "termahal",
      label: "Harga tertinggi",
      hint: "Memakai harga yang tampil di kartu, termasuk harga promo",
      icon: "solar:sort-from-top-to-bottom-bold-duotone",
      grup: "harga",
    },
    {
      value: "terluas",
      label: LABEL_LUAS[konteks].besar,
      hint: "Listing tanpa data luas ditaruh paling belakang",
      icon: "solar:maximize-square-3-bold-duotone",
      grup: "luas",
    },
    {
      value: "terkecil",
      label: LABEL_LUAS[konteks].kecil,
      hint: "Listing tanpa data luas ditaruh paling belakang",
      icon: "solar:minimize-square-3-bold-duotone",
      grup: "luas",
    },
    {
      value: "terpopuler",
      label: "Paling banyak dilihat",
      hint: "Berdasarkan jumlah kunjungan halaman detail",
      icon: "solar:eye-bold-duotone",
      grup: "umum",
    },
  ];
}

const OPSI_JADWAL_LELANG: OpsiUrut[] = [
  {
    value: "lelang-terdekat",
    label: "Jadwal terdekat",
    hint: "Hanya lelang yang belum berlangsung",
    icon: "solar:alarm-bold-duotone",
    grup: "jadwal",
  },
  {
    value: "lelang-terjauh",
    label: "Jadwal terjauh",
    hint: "Hanya lelang yang belum berlangsung",
    icon: "solar:alarm-sleep-bold-duotone",
    grup: "jadwal",
  },
  {
    value: "lelang-berlalu",
    label: "Sudah berlalu",
    hint: "Hanya lelang yang jadwalnya sudah lewat",
    icon: "solar:history-bold-duotone",
    grup: "jadwal",
  },
];

/**
 * Opsi "terdekat" hanya hidup saat sebuah tempat dipilih.
 *
 * Ia sengaja BUKAN bagian dari `opsiUmum`: di halaman tanpa `?dekat=…`,
 * "terdekat" adalah pilihan yang tidak bisa dijawab (dekat dari mana?), dan
 * pilihan yang tidak bisa dijawab lebih buruk daripada pilihan yang tidak ada
 * — pemakainya menekannya, tidak terjadi apa-apa, dan ia menyimpulkan
 * situsnya rusak.
 */
function opsiJarak(namaTempat: string | true): OpsiUrut {
  return {
    value: "terdekat",
    // Nama tempatnya dipakai bila diketahui. Kalau tidak (komponen yang cuma
    // melihat `?dekat=` di URL tanpa tahu nama tampilnya), label pendek tetap
    // benar — yang penting opsinya ADA, karena opsi yang hilang berarti fitur
    // yang tidak bisa dijangkau sama sekali.
    label: namaTempat === true ? "Terdekat" : `Terdekat dari ${namaTempat}`,
    hint: "Jarak garis lurus dari titik aset",
    icon: "solar:map-arrow-square-bold-duotone",
    grup: "jarak",
  };
}

/**
 * Opsi yang boleh muncul di UI, urut sesuai tampilannya.
 *
 * `namaTempat` diisi hanya bila halaman sedang menyaring "dekat X" — lihat
 * `opsiJarak`.
 */
export function opsiUrut(
  konteks: KonteksListing,
  /** Nama tempat yang sedang disaring, `true` bila tahu ada tapi tidak tahu
   *  namanya, atau kosong bila tidak ada. */
  namaTempat?: string | true | null
): OpsiUrut[] {
  const umum = opsiUmum(konteks);
  const dasar =
    konteks !== "LELANG"
      ? umum
      : // Di lelang, jadwal adalah pertanyaan pertama pemburu lelang ("mana
        // yang masih sempat saya ikuti?"), jadi grup itu ditaruh paling atas.
        [...OPSI_JADWAL_LELANG, ...umum];

  // Saat sebuah tempat dipilih, jarak jadi pertanyaan pertama — ia yang baru
  // saja diketik pemakainya.
  return namaTempat ? [opsiJarak(namaTempat), ...dasar] : dasar;
}

export const URUT_DEFAULT: Record<KonteksListing, SortKey> = {
  JUAL: "terbaru",
  SEWA: "terbaru",
  LELANG: "terbaru",
  SEMUA: "terbaru",
};

/**
 * Nilai `sort` lama yang pernah dipakai/di-bookmark/terindeks mesin pencari.
 * Nilai di URL adalah kontrak publik: menghapusnya diam-diam berarti tautan
 * lama mendarat di urutan default tanpa penjelasan.
 *   asc, desc                        → sidebar /Jual & /Sewa versi lama
 *   price_asc, auction_asc, land_asc → sortcontrol.tsx /Lelang yang kini dihapus
 *   relevansi, rating                → sidebar /Sewa yang dulu tidak ke URL
 *   luas-asc, luas-desc              → KategoriFilterBar /properti/[slug] yang
 *                                      kini dihapus; halaman itu ter-index mesin
 *                                      pencari, jadi nilainya masih beredar
 */
const ALIAS: Record<string, SortKey> = {
  asc: "termurah",
  desc: "termahal",
  price_asc: "termurah",
  price_desc: "termahal",
  auction_asc: "lelang-terdekat",
  auction_desc: "lelang-terjauh",
  land_desc: "terluas",
  land_asc: "terkecil",
  "luas-desc": "terluas",
  "luas-asc": "terkecil",
  relevansi: "terbaru",
  rating: "terpopuler",
  populer: "terpopuler",
};

/**
 * Nilai `sort` mentah dari URL → kunci kanonik yang pasti didukung konteks ini.
 * Nilai asing, salah konteks (mis. `lelang-terdekat` di /Jual), atau kosong
 * selalu jatuh ke default — tidak pernah melempar error dan tidak pernah
 * menghasilkan `orderBy` kosong.
 */
export function parseSort(
  raw: string | string[] | undefined,
  konteks: KonteksListing,
  /**
   * Nama tempat yang sedang disaring, bila ada. Tanpa ini "terdekat" ditolak
   * dan jatuh ke urutan default — perlindungan yang nyata, bukan formalitas:
   * URL "?sort=terdekat" tanpa "?dekat=…" tetap harus mendarat di halaman yang
   * masuk akal, bukan di pengurutan yang tidak punya titik acuan.
   */
  namaTempat?: string | true | null
): SortKey {
  const teks = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase();
  if (!teks) return namaTempat ? "terdekat" : URUT_DEFAULT[konteks];
  const kanonik = (ALIAS[teks] ?? teks) as SortKey;
  const didukung = opsiUrut(konteks, namaTempat).some((o) => o.value === kanonik);
  return didukung ? kanonik : URUT_DEFAULT[konteks];
}

/** Label untuk tombol/ringkasan. Selalu ada, apa pun isi URL-nya. */
export function labelSort(
  sort: SortKey,
  konteks: KonteksListing,
  namaTempat?: string | true | null
): string {
  const opsi = opsiUrut(konteks, namaTempat);
  return opsi.find((o) => o.value === sort)?.label ?? opsi[0].label;
}

/* ──────────────────────────────── ORDER BY ───────────────────────────── */

/**
 * Pemecah seri. WAJIB ada di akhir setiap urutan.
 *
 * Tanpa ini, dua listing dengan harga (atau luas, atau tanggal) yang sama
 * boleh muncul dalam urutan apa pun, dan Postgres tidak menjamin urutan itu
 * konsisten antar query. Karena paginasi memakai LIMIT/OFFSET, satu listing
 * bisa terlihat di halaman 1 lalu muncul lagi di halaman 2 sementara listing
 * lain tidak pernah tampil sama sekali. `id_property` unik, jadi menambahkannya
 * membuat urutannya TOTAL — hasilnya sama persis di setiap permintaan.
 */
const PEMECAH_SERI: Prisma.ListingOrderByWithRelationInput = {
  id_property: "desc",
};

/**
 * Listing TERJUAL/tersewa selalu di belakang, tanpa dihilangkan dari daftar
 * (enum: TERSEDIA < TERJUAL). Ini sengaja mendahului kunci urut yang dipilih
 * pemakai: daftar "termurah" yang diselingi listing terjual bukan daftar yang
 * bisa dipakai belanja.
 */
const STATUS_DULU: Prisma.ListingOrderByWithRelationInput = {
  status_tayang: "asc",
};

/**
 * NULL di belakang, di kedua arah — dipakai HANYA untuk kolom yang memang bisa
 * kosong (luas & tanggal lelang). Di Postgres, DESC menaruh NULL di DEPAN, jadi
 * tanpa ini "terluas" justru diawali listing yang luasnya tidak diisi.
 *
 * Sengaja TIDAK dipakai pada `harga_efektif` dan `tanggal_dibuat`. Keduanya
 * tidak pernah NULL (harga_efektif dijamin trigger; tanggal_dibuat punya
 * DEFAULT CURRENT_TIMESTAMP — keduanya 0 baris NULL dari 121.825 baris), jadi
 * klausanya tidak mengubah hasil sedikit pun — TAPI ia mengubah rencana query:
 * `DESC NULLS LAST` tidak cocok dengan index `DESC` (yang berarti NULLS FIRST),
 * sehingga Postgres berhenti memakai index dan menyortir seluruh tabel. Terukur
 * pada 121.825 baris: 0,3 ms (pakai index) vs 32 ms (sortir penuh).
 */
const nullsLast = (sort: "asc" | "desc") =>
  ({ sort, nulls: "last" }) satisfies Prisma.SortOrderInput;

/**
 * Kunci urut → `orderBy` Prisma yang lengkap (status → kunci → pemecah seri).
 *
 * Harga memakai kolom `harga_efektif`, BUKAN `harga`: itulah angka yang
 * dicetak di kartu (harga promo bila ada, kalau tidak harga biasa) dan yang
 * dipakai filter min/max. Kolom itu dijaga trigger di Postgres — lihat
 * prisma/migration_harga_efektif.sql, WAJIB dijalankan di tiap environment.
 */
export function buildOrderBy(
  sort: SortKey,
  konteks: KonteksListing
): Prisma.ListingOrderByWithRelationInput[] {
  const kolomLuas = konteks === "SEWA" ? "luas_bangunan" : "luas_tanah";

  const inti: Prisma.ListingOrderByWithRelationInput[] = (() => {
    switch (sort) {
      case "termurah":
        return [{ harga_efektif: "asc" }];
      case "termahal":
        // Tanpa klausa NULLS (lihat nullsLast di atas) supaya cocok dengan
        // idx_listing_urut_harga_desc. Arah turun punya index sendiri: ORDER BY
        // ini bercampur arah (status naik, harga turun), dan membaca satu index
        // secara mundur membalik semua kolomnya sekaligus.
        return [{ harga_efektif: "desc" }];
      case "terluas":
        return [{ [kolomLuas]: nullsLast("desc") }];
      case "terkecil":
        return [{ [kolomLuas]: nullsLast("asc") }];
      case "terpopuler":
        // `dilihat` NOT NULL. Listing sepopuler apa pun tetap butuh urutan
        // kedua yang stabil — banyak listing baru sama-sama 0 kali dilihat.
        return [{ dilihat: "desc" }, { tanggal_dibuat: "desc" }];
      case "lelang-terdekat":
        return [{ tanggal_lelang: nullsLast("asc") }];
      case "lelang-terjauh":
        return [{ tanggal_lelang: nullsLast("desc") }];
      case "lelang-berlalu":
        // Yang baru saja lewat lebih relevan daripada lelang tahun lalu.
        return [{ tanggal_lelang: nullsLast("desc") }];
      case "terdekat":
        // Diurut di luar `orderBy` — jaraknya ada di relasi to-many dan
        // berbeda untuk setiap tempat yang dicari, jadi tidak ada kolom yang
        // bisa diurut di sini. Lihat urutkanTerdekat() di
        // src/lib/listingTempatFilter.ts. Nilai di bawah cuma cadangan supaya
        // halaman tetap masuk akal bila jalur itu gagal.
        return [{ tanggal_dibuat: "desc" }];
      case "terbaru":
      default:
        return [{ tanggal_dibuat: "desc" }];
    }
  })();

  return [STATUS_DULU, ...inti, PEMECAH_SERI];
}

/**
 * Sebagian pilihan urut di /Lelang sekaligus MEMBATASI hasil: "jadwal
 * terdekat" tidak masuk akal kalau lelang tahun lalu ikut tampil. Fungsi ini
 * memisahkan bagian filter itu supaya halaman tidak perlu tahu detailnya, dan
 * supaya konteks lain tidak ikut kena.
 *
 * `sekarang` dipakai apa adanya (dibulatkan ke awal hari) — dikirim dari
 * pemanggil supaya `count` dan `findMany` memakai batas waktu yang sama persis.
 */
export function buildSortWhere(
  sort: SortKey,
  konteks: KonteksListing,
  sekarang: Date
): Prisma.ListingWhereInput | undefined {
  if (konteks !== "LELANG") return undefined;
  const awalHari = new Date(sekarang);
  awalHari.setHours(0, 0, 0, 0);

  switch (sort) {
    case "lelang-terdekat":
    case "lelang-terjauh":
      return { tanggal_lelang: { gte: awalHari } };
    case "lelang-berlalu":
      return { tanggal_lelang: { lt: awalHari } };
    default:
      return undefined;
  }
}

/** Apakah pilihan urut ini juga menyaring hasil? Dipakai UI untuk memberi tahu. */
export function sortMenyaring(sort: SortKey): boolean {
  return (
    sort === "lelang-terdekat" ||
    sort === "lelang-terjauh" ||
    sort === "lelang-berlalu"
  );
}

/* ─────────────────────────────── Paginasi ────────────────────────────── */

/** Batas atas halaman. OFFSET raksasa hanya membebani DB tanpa hasil berguna. */
export const MAKS_HALAMAN = 5000;

/**
 * Nomor halaman dari URL → bilangan bulat ≥ 1.
 *
 * `Number("abc")` menghasilkan NaN dan `skip: NaN` membuat Prisma melempar
 * error — satu URL usil sudah cukup untuk memunculkan layar 500. Nilai
 * pecahan, negatif, dan angka raksasa juga dijinakkan di sini.
 */
export function parseHalaman(raw: string | string[] | undefined): number {
  const teks = Array.isArray(raw) ? raw[0] : raw;
  if (typeof teks !== "string") return 1;
  const n = Number.parseInt(teks, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAKS_HALAMAN);
}

/**
 * Halaman yang diminta melebihi jumlah halaman yang ada → kembalikan URL
 * halaman terakhir supaya pemakai melihat data, bukan grid kosong dengan
 * tulisan "Halaman 9 dari 3". Mengembalikan `null` kalau tidak perlu pindah.
 */
export function urlHalamanTerakhir(
  baseUrl: string,
  searchParams: Record<string, string | string[] | undefined>,
  halamanDiminta: number,
  totalPages: number
): string | null {
  if (totalPages < 1 || halamanDiminta <= totalPages) return null;
  const params = new URLSearchParams();
  for (const [key, nilai] of Object.entries(searchParams)) {
    if (nilai === undefined) continue;
    if (Array.isArray(nilai)) nilai.forEach((v) => params.append(key, v));
    else params.set(key, nilai);
  }
  params.set("page", String(totalPages));
  return `${baseUrl}?${params.toString()}`;
}

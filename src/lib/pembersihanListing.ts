// src/lib/pembersihanListing.ts
//
// ══════════════════════════════════════════════════════════════════════════
// KATALOG ATURAN PEMBERSIHAN DATA LISTING
// ══════════════════════════════════════════════════════════════════════════
//
// MASALAHNYA. Tabel `listing` berisi 121 ribu baris hasil scraping lelang, dan
// sebagiannya bukan properti sama sekali: sepeda motor, mobil, forklift, sapi
// potong, batubara, kain, bilik suara eks pemilu, hak piutang. Semuanya
// tercatat ber-`kategori = 'RUMAH'` bukan karena scraper-nya salah membaca,
// melainkan karena `kategori` pada baris hasil scraping adalah EMBER TEMPAT
// LOT ITU DIAMBIL — scraper dijalankan `--kategori Rumah` dan seluruh lot di
// putaran itu ditulis RUMAH.
//
// Situs ini situs properti. Barang bergerak tidak akan pernah jadi listing yang
// sah, jadi ia tidak "ditarik dari tayang" — ia dihapus.
//
// ── KENAPA BUKAN KATA DI JUDUL YANG JADI HAKIMNYA ─────────────────────────
// Godaan pertamanya selalu sama: buang apa pun yang judulnya memuat "barang
// bergerak". Itu SALAH, dan datanya membuktikan — ada 139 baris seperti
//
//     "3 bidang tanah dengan total luas 174460 m2 berikut bangunan
//      dan barang bergerak"
//
// yaitu pabrik 17 hektar yang dijual berikut isinya, aset paling bernilai di
// seluruh basis data ini. Maka LUAS yang jadi hakim utamanya, dan itu sudah
// dikerjakan kolom `listing.bukan_properti` (diisi trigger; aturannya di
// prisma/migration_listing_bukan_properti.sql). Aturan di bawah tidak
// mengarang logika baru — ia membaca kolom itu, supaya tidak ada dua definisi
// "bukan properti" yang bisa saling menyimpang.
//
// ── TIGA KERANJANG, DAN KENAPA HARUS TIGA ─────────────────────────────────
// Kolom `bukan_properti` dibuat untuk menyingkirkan lot dari REKOMENDASI.
// Menghapus permanen taruhannya lain, jadi 1.327 baris yang ditandainya
// dibelah dua lebih dulu:
//
//   1. BENDA_BERGERAK — ditandai database DAN judulnya tidak menyebut properti
//      dari sisi mana pun. Sapi potong, surat suara, hak piutang, forklift.
//      Ini satu-satunya keranjang yang boleh dieksekusi massal.
//   2. PERLU_TINJAU — ditandai database TAPI judulnya menyebut properti.
//      144 baris, dan di dalamnya ada "Ruko di Kota Manado" Rp 3,5 M yang
//      luasnya semata-mata tidak terbawa scraper. Tanpa tombol hapus-semua.
//   3. JUDUL_BARANG — kebalikannya: TIDAK ditandai database (kolom luasnya
//      kebetulan terisi) padahal judulnya jelas barang bergerak. Karena ia
//      memakai kata kunci, ia diberi penjaga: judul yang menyebut bidang/
//      persil/kavling/luas tidak pernah ikut tertangkap.
//
// Berkas ini bebas Prisma & bebas server: ia ikut dimuat komponen dasbor
// supaya label, penjelasan, dan daftar kata kuncinya yang tampil di layar
// benar-benar kata kunci yang dipakai query. Terjemahan ke `where` Prisma ada
// di src/app/api/listings/pembersihan/_lib/query.ts.
// ══════════════════════════════════════════════════════════════════════════

/** Id aturan. `MANUAL` bukan aturan — ia dipakai saat Owner memilih sendiri. */
export type IdAturan = "BENDA_BERGERAK" | "PERLU_TINJAU" | "JUDUL_BARANG";

export interface AturanPembersihan {
  id: IdAturan;
  label: string;
  /** Satu baris di kartu aturan. */
  ringkas: string;
  /** Kenapa aturan ini boleh dipercaya — dibaca sebelum menekan Hapus. */
  penjelasan: string;
  ikon: string;
  /** Ikut tercentang saat dialog dibuka. */
  bawaan: boolean;
  /**
   * TRUE = tidak boleh dieksekusi massal. Aturan seperti ini mengumpulkan
   * baris yang MUNGKIN sampah; tombol "hapus semua" sengaja tidak disediakan
   * dan Owner harus mencentang satu per satu.
   */
  tinjauManual?: boolean;
}

/**
 * Kata kunci barang bergerak. Dipakai HANYA oleh aturan kedua, dan hanya pada
 * baris yang tidak ditandai `bukan_properti`.
 */
export const KATA_BARANG_BERGERAK = [
  "barang bergerak",
  "sepeda motor",
  "kendaraan bermotor",
  "unit mobil",
  "excavator",
  "forklift",
  "genset",
  "alat berat",
  "barang inventaris",
  "inventaris kantor",
  "peralatan dan mesin",
  "mesin fotocopy",
  "hak piutang",
  "batubara",
  "besi tua",
  "bahan bakar minyak",
  "bilik suara",
  "kotak suara",
  "sapi potong",
  "hewan ternak",
] as const;

/**
 * PENJAGA aturan JUDUL_BARANG. Judul yang memuat salah satu kata ini tidak
 * pernah ikut tertangkap, betapapun banyak kata barang bergerak di dalamnya —
 * inilah yang menyelamatkan "3 bidang tanah dengan total luas 174460 m2
 * berikut bangunan dan barang bergerak".
 */
export const KATA_PELINDUNG_PROPERTI = [
  "bidang",
  "persil",
  "kavling",
  "kapling",
  "luas",
] as const;

/**
 * Kata benda properti. Dipakai untuk MEMBELAH DUA baris yang ditandai
 * `bukan_properti` oleh database, dan ini pembelahan yang paling penting di
 * seluruh berkas ini.
 *
 * Trigger `bukan_properti` menilai dari luas, dan ia benar untuk tugas
 * aslinya: menyingkirkan lot dari rekomendasi. Tapi menyingkirkan dari
 * rekomendasi dan MENGHAPUS PERMANEN bukan taruhan yang sama. Di antara 1.327
 * baris yang ditandainya, 144 judulnya menyebut properti — dan sebagiannya
 * memang properti asli yang luasnya saja tidak terbawa scraper:
 *
 *     "Ruko di Kota Manado"                     Rp 3,5 M
 *     "Apartemen di Kota Surabaya"              Rp 100 jt
 *     "1 (satu) unit apartemen Bogor Icon Tower Bravia Unit B12"
 *
 * Menghapusnya berarti kehilangan persediaan nyata karena satu kolom kosong.
 * Maka baris seperti itu dipisahkan ke aturan PERLU_TINJAU yang TIDAK punya
 * tombol hapus-semua, dan tombol massal hanya pernah menyentuh baris yang
 * judulnya tidak menyebut properti sama sekali.
 *
 * Daftarnya sengaja rakus (cocok sebagai POTONGAN kata, jadi "fotokopi" ikut
 * tertangkap lewat "toko"): salah masuk ke keranjang tinjau hanya berarti
 * satu baris harus dilihat manusia, sedangkan salah masuk ke keranjang
 * hapus-massal berarti aset hilang.
 */
export const KATA_PROPERTI = [
  "rumah",
  "ruko",
  "apartemen",
  "kios",
  "villa",
  "vila",
  "gudang",
  "pabrik",
  "kavling",
  "kaveling",
  "toko",
  "tanah",
  "hotel",
  "sarusun",
  "rusun",
] as const;

export const ATURAN_PEMBERSIHAN: AturanPembersihan[] = [
  {
    id: "BENDA_BERGERAK",
    label: "Bukan properti — aman dihapus massal",
    ringkas:
      "Lot lelang tanpa luas tanah maupun luas bangunan, DAN judulnya tidak menyebut properti sama sekali: kendaraan, mesin, hewan, komoditas, inventaris kantor, logistik pemilu.",
    penjelasan:
      "Dua saringan bertumpuk. Pertama kolom listing.bukan_properti yang diisi " +
      "trigger database — hakimnya LUAS, bukan judul, jadi baris yang punya luas " +
      "tanah atau luas bangunan tidak pernah masuk ke sini (itulah yang " +
      "menyelamatkan pabrik 17 hektar yang dijual berikut barang bergeraknya). " +
      "Kedua, judul yang menyebut rumah/ruko/apartemen/tanah/gudang dikeluarkan " +
      "ke keranjang Perlu Ditinjau. Yang tersisa di sini tidak menyebut properti " +
      "dari sisi mana pun.",
    ikon: "solar:tram-bold-duotone",
    bawaan: true,
  },
  {
    id: "PERLU_TINJAU",
    label: "Perlu ditinjau satu per satu",
    ringkas:
      "Database menandainya bukan properti (luasnya kosong), TAPI judulnya menyebut properti. Sebagian di sini properti asli yang luasnya tidak terbawa scraper.",
    penjelasan:
      'Contoh nyata di data Anda: "Ruko di Kota Manado" Rp 3,5 M, "Apartemen di ' +
      'Kota Surabaya", "1 (satu) unit apartemen Bogor Icon Tower". Ketiganya ' +
      "tidak punya angka luas, jadi trigger menandainya bukan properti — untuk " +
      "menyingkirkannya dari rekomendasi itu keputusan yang benar, untuk " +
      "menghapusnya permanen jelas tidak. Keranjang ini sengaja TIDAK punya " +
      'tombol "hapus semua": centang sendiri baris yang memang sampah, dan yang ' +
      "properti asli lebih baik dilengkapi luasnya lewat Edit.",
    ikon: "solar:eye-scan-bold-duotone",
    bawaan: false,
    tinjauManual: true,
  },
  {
    id: "JUDUL_BARANG",
    label: "Judul barang bergerak, walau punya angka luas",
    ringkas:
      "Menambal celah aturan pertama: judulnya jelas barang, tapi kolom luasnya kebetulan terisi sehingga trigger membiarkannya lewat.",
    penjelasan:
      "Hanya berlaku untuk baris yang BELUM tertangkap kolom bukan_properti, dan " +
      "judul yang menyebut bidang/persil/kavling/luas dikecualikan — jadi aset " +
      'besar yang dijual "berikut bangunan dan barang bergerak" tetap aman. ' +
      "Jumlahnya memang kecil; ia ada supaya scraping berikutnya tidak " +
      "menyelundupkan barang lewat kolom luas yang salah isi.",
    ikon: "solar:magnifer-bug-bold-duotone",
    bawaan: true,
  },
];

export function aturanById(id: string): AturanPembersihan | undefined {
  return ATURAN_PEMBERSIHAN.find((a) => a.id === id);
}

export function isIdAturan(v: unknown): v is IdAturan {
  return typeof v === "string" && ATURAN_PEMBERSIHAN.some((a) => a.id === v);
}

/* ─────────────────────────── Bentuk data API ─────────────────────────── */

export type AksiPembersihan = "HAPUS" | "TARIK";

/** Kata yang harus diketik Owner sebelum penghapusan permanen dijalankan. */
export const KATA_KONFIRMASI = "HAPUS PERMANEN";

export interface RingkasanAturan {
  id: IdAturan;
  jumlah: number;
}

export interface RingkasanPembersihan {
  aturan: RingkasanAturan[];
  /**
   * Baris yang boleh dieksekusi massal — keranjang `tinjauManual` TIDAK ikut.
   * Angka inilah yang dipajang di pita dasbor: menjumlahkan keranjang tinjau
   * ke sini membuat pita menjanjikan pembersihan yang memang sengaja tidak
   * disediakan tombolnya.
   */
  total: number;
  /** Baris yang menunggu dilihat manusia satu per satu. */
  totalTinjau: number;
  totalListing: number;
  /** FALSE = migrasi bukan_properti belum jalan di database ini. */
  siap: boolean;
  pesan?: string;
}

export interface KandidatListing {
  id: string;
  judul: string;
  kategori: string;
  jenisTransaksi: string;
  kota: string | null;
  harga: string | null;
  luasTanah: number | null;
  luasBangunan: number | null;
  gambar: string | null;
  /** Alasan baris ini TIDAK bisa dihapus; null = aman dihapus. */
  terkunci: string | null;
  /** Peringatan lunak, mis. "punya luas tanah 50 m²" pada hasil pencarian. */
  catatan: string | null;
}

export interface HalamanKandidat {
  items: KandidatListing[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DilewatiPembersihan {
  id: string;
  judul: string;
  alasan: string;
}

export interface HasilPembersihan {
  aksi: AksiPembersihan;
  /** Berapa baris benar-benar dihapus / ditarik pada panggilan ini. */
  diproses: number;
  dilewati: DilewatiPembersihan[];
  /** Sisa baris yang masih cocok sesudah panggilan ini — untuk lanjut bertahap. */
  sisa: number;
}

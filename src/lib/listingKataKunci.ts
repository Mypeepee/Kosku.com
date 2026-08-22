/**
 * Kata kunci bebas ("dukuh kupang", "wiyung", "sudirman") — SATU aturan yang
 * dipakai bersama oleh filter halaman dan penghitung di kotak pencarian.
 *
 * ── KENAPA HARUS SATU ───────────────────────────────────────────────────────
 * Kotak pencarian sekarang menuliskan "37 properti" di sebelah tawaran "cari
 * sebagai alamat". Angka itu hanya berguna kalau ia benar-benar angka yang
 * akan didapat setelah diklik. Dua definisi yang "kurang lebih sama" — satu
 * untuk menghitung, satu untuk menyaring — adalah cara paling andal membuat
 * janji di layar meleset dari kenyataan di halaman berikutnya.
 *
 * ── KENAPA LINTAS KOLOM ─────────────────────────────────────────────────────
 * /Jual, /Sewa, dan /Lelang dulu hanya mencari di `alamat_lengkap`. Itu gagal
 * persis pada cara orang menyebut lokasi di Indonesia: "Dukuh Kupang" adalah
 * KELURAHAN, "Wiyung" adalah KECAMATAN, dan keduanya sering tidak tertulis
 * ulang di dalam alamat. Orang mengetik nama yang benar, mendapat nol hasil,
 * lalu menyimpulkan asetnya tidak ada. Halaman kategori (/properti/[slug])
 * sudah mencari lintas kolom sejak awal — inilah aturan itu, dipindahkan ke
 * satu tempat supaya semua halaman berperilaku sama.
 *
 * Butuh index trigram pada `alamat_lengkap`, `judul`, & `provinsi` (lihat
 * prisma/migration_tempat_landmark.sql). Tanpa itu penghitungnya 750 ms per
 * ketukan, bukan 19 ms.
 *
 * ── KENAPA BERKAS INI TIDAK `server-only` ───────────────────────────────────
 * `buildKataKunciWhere` dipakai `listingFilters.ts`, dan berkas ITU juga
 * dipakai FilterCommandBar — sebuah client component yang butuh daftar param
 * & label chip. Menandai berkas ini server-only berarti seluruh rantai itu
 * gagal dikompilasi. Yang benar-benar butuh koneksi database (penghitungnya)
 * tinggal di listingKataKunci.server.ts, mengikuti pola yang sudah dipakai
 * nearbyPlaces.ts / nearbyPlaces.server.ts.
 */

import { Prisma } from "@prisma/client";

/** Kolom yang ikut dicari. Urutan tidak berpengaruh — ini gabungan OR. */
const KOLOM: Array<keyof Prisma.ListingWhereInput> = [
  "alamat_lengkap",
  "kota",
  "kecamatan",
  "kelurahan",
  "provinsi",
  "judul",
];

export function buildKataKunciWhere(
  q: string | null | undefined,
): Prisma.ListingWhereInput | undefined {
  const teks = String(q ?? "").trim();
  if (!teks) return undefined;
  return {
    OR: KOLOM.map(
      (kolom) =>
        ({ [kolom]: { contains: teks, mode: "insensitive" } }) as Prisma.ListingWhereInput,
    ),
  };
}

/** Konteks transaksi halaman — menentukan aset mana yang ikut dihitung. */
export type KonteksTransaksi = "semua" | "beli" | "sewa" | "lelang";

/**
 * Konteks transaksi → potongan `where`. Diekspor karena penghitung di
 * listingKataKunci.server.ts memakai peta yang SAMA — kalau ia menyalinnya,
 * angka di kotak pencarian dan isi halaman bisa memakai definisi "sewa" yang
 * berbeda tanpa ada yang menyadari.
 */
export const TRANSAKSI: Record<KonteksTransaksi, Prisma.ListingWhereInput> = {
  semua: {},
  beli: { jenis_transaksi: { in: ["PRIMARY", "SECONDARY"] } },
  sewa: { jenis_transaksi: "SEWA" },
  lelang: { jenis_transaksi: "LELANG" },
};

export const adalahKonteksTransaksi = (v: unknown): v is KonteksTransaksi =>
  typeof v === "string" && v in TRANSAKSI;

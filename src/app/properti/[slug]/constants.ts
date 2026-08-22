export const KATEGORI_ICONS: Record<string, string> = {
  RUMAH:           "solar:home-smile-bold-duotone",
  APARTEMEN:       "solar:city-bold-duotone",
  RUKO:            "solar:shop-bold-duotone",
  TANAH:           "solar:map-point-wave-bold-duotone",
  GUDANG:          "solar:box-bold-duotone",
  HOTEL_DAN_VILLA: "solar:bed-bold-duotone",
  TOKO:            "solar:bag-heart-bold-duotone",
  PABRIK:          "solar:garage-bold-duotone",
};

// Katalog urutan halaman ini DIHAPUS dan digantikan mesin bersama
// `opsiUrut()` di @/lib/listingSort. Daftar lama ("luas-asc", "luas-desc", …)
// mengurutkan kolom `harga` mentah tanpa aturan NULL, sehingga bertentangan
// dengan angka yang dicetak kartu dan menaruh listing tanpa luas di paling
// depan. Nilai-nilai lamanya tetap dikenali lewat tabel ALIAS di listingSort.ts,
// jadi tautan & bookmark yang sudah beredar tidak mati.

export const TAB_KEYS = ["semua", "jual", "lelang", "sewa"] as const;
export type TabKey = typeof TAB_KEYS[number];

/**
 * Slug URL ↔ enum kategori. Tinggal di sini (bukan di page.tsx) karena
 * DIPERLUKAN DUA SISI: server memakainya untuk menentukan kategori halaman,
 * klien memakainya untuk memindahkan path saat pemakai mengganti tipe aset di
 * bar filter. Dua salinan peta ini pernah berarti satu kategori baru harus
 * didaftarkan di dua tempat — dan yang terlupa akan gagal diam-diam
 * (`notFound()` di satu sisi, filter yang tak pernah cocok di sisi lain).
 */
export const SLUG_TO_KATEGORI: Record<string, string> = {
  "rumah":           "RUMAH",
  "apartemen":       "APARTEMEN",
  "ruko":            "RUKO",
  "tanah":           "TANAH",
  "gudang":          "GUDANG",
  "hotel-dan-villa": "HOTEL_DAN_VILLA",
  "toko":            "TOKO",
  "pabrik":          "PABRIK",
};

export const KATEGORI_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(SLUG_TO_KATEGORI).map(([slug, kategori]) => [kategori, slug])
);

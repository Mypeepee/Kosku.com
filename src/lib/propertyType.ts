/**
 * propertyType — utilitas bersama untuk multi-select Tipe Aset (kategori
 * properti). Menjembatani nama tampilan ("Rumah", "Hotel & Villa") dengan
 * nilai enum di DB ("RUMAH", "HOTEL_DAN_VILLA").
 *
 * Catatan penting soal nama param URL:
 *  - Di halaman Jual & Lelang, param `tipe` BERARTI kategori properti.
 *  - Di halaman kategori (/properti/[slug]), `tipe` dipakai untuk TAB transaksi
 *    (jual/lelang/sewa) dan kategori ditentukan oleh slug. Untuk multi-kategori
 *    di sana dipakai param terpisah `kategori`.
 * Keduanya sama-sama berupa daftar enum dipisah koma, dan modul ini menangani
 * serialize/parse-nya.
 */

export const TYPE_DISPLAY_TO_DB: Record<string, string> = {
  Rumah: "RUMAH",
  Tanah: "TANAH",
  Gudang: "GUDANG",
  Apartemen: "APARTEMEN",
  Pabrik: "PABRIK",
  Ruko: "RUKO",
  Toko: "TOKO",
  "Hotel & Villa": "HOTEL_DAN_VILLA",
  Kos: "KOS",
};

export const TYPE_DB_TO_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(TYPE_DISPLAY_TO_DB).map(([display, db]) => [db, display])
);

export const ALLOWED_CATEGORIES = Object.values(TYPE_DISPLAY_TO_DB);

/** Nama tampilan → enum DB (fallback: UPPER + spasi→underscore). */
export function typeDisplayToDb(display: string): string {
  return (
    TYPE_DISPLAY_TO_DB[display] ??
    display.trim().toUpperCase().replace(/\s+/g, "_")
  );
}

/** Daftar nama tampilan → string param (enum dipisah koma, dedupe). */
export function serializeTypes(displays: string[]): string {
  const out: string[] = [];
  for (const d of displays) {
    const db = typeDisplayToDb(d);
    if (db && !out.includes(db)) out.push(db);
  }
  return out.join(",");
}

/** Param URL (enum koma) → daftar nama tampilan (untuk menghidrasi picker). */
export function parseTypeParamToDisplays(
  param: string | string[] | undefined | null
): string[] {
  if (param == null) return [];
  const raw = Array.isArray(param) ? param.join(",") : param;
  const out: string[] = [];
  for (const tok of raw.split(",").map((s) => s.trim().toUpperCase())) {
    const display = TYPE_DB_TO_DISPLAY[tok];
    if (display && !out.includes(display)) out.push(display);
  }
  return out;
}

/**
 * Param URL (enum koma) → daftar enum kategori VALID untuk query Prisma
 * (`kategori: { in: [...] }`). Hanya kategori yang dikenal yang lolos.
 */
export function parseCategoryDbList(
  param: string | string[] | undefined | null
): string[] {
  if (param == null) return [];
  const raw = Array.isArray(param) ? param.join(",") : param;
  const out: string[] = [];
  for (const tok of raw.split(",").map((s) => s.trim().toUpperCase())) {
    if (ALLOWED_CATEGORIES.includes(tok) && !out.includes(tok)) out.push(tok);
  }
  return out;
}

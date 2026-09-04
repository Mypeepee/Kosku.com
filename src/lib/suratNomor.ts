// src/lib/suratNomor.ts
// ---------------------------------------------------------------------------
// Perakit nomor surat: NNN/PJH-[inisial]/[romawi bulan]/[tahun].
//
// Berkas terpisah karena dua alasan. Pertama, `route.ts` di App Router hanya
// boleh mengekspor handler HTTP & konfigurasinya — aturan penamaan nomor tidak
// punya tempat di sana. Kedua, penurunan inisial punya cukup banyak kasus tepi
// (gelar, "bin", nama satu kata) sehingga layak diuji sendiri tanpa harus
// menembak route.
// ---------------------------------------------------------------------------

export const ROMAWI_BULAN = ["I", "II", "III", "IV", "V", "VI",
  "VII", "VIII", "IX", "X", "XI", "XII"] as const;

/**
 * Gelar, sapaan, dan partikel penghubung nasab. Semuanya dibuang sebelum
 * inisial diambil: nomor surat menandai ORANGNYA, dan "H." bukan bagian dari
 * orangnya — "H. AHMAD BIN SALIM" harus jadi "AS", bukan "HABS".
 */
const BUKAN_NAMA = new Set([
  "H", "HJ", "HAJI", "HJI", "DRS", "DRA", "IR", "DR", "PROF", "KH",
  "SH", "SE", "ST", "SPD", "SKOM", "SSOS", "SPSI", "MM", "MH", "MKN", "MSI",
  "BIN", "BINTI", "BT", "BTE", "ALM", "ALMH", "VAN", "DER",
]);

/**
 * "IMELDA MONIKA KASE" → "IMK"; "RITA PANCAWATI" → "RP"; "SUKIRMAN" → "SUK".
 *
 * Nama satu kata sengaja jatuh ke tiga huruf pertama, bukan satu huruf: nomor
 * berinisial "S" tidak membedakan apa pun di register yang berisi ratusan baris.
 * Empat kata adalah batas atas — lebih dari itu nomornya berhenti terbaca
 * sebagai nomor.
 */
export function inisialNama(nama: string): string {
  const kata = (nama ?? "")
    // Di Indonesia gelar akademik selalu menyusul KOMA — "Bambang Sutrisno,
    // S.H., M.Kn.". Membuang ekor setelah koma lebih dapat diandalkan daripada
    // mendaftar semua gelar yang mungkin, karena "S.H." pecah jadi token "S"
    // dan "H" begitu tanda bacanya dibersihkan, dan "S" tidak akan pernah ada
    // di daftar mana pun.
    .split(",")[0]
    .toUpperCase()
    .replace(/[^A-Z\s]/g, " ")
    .split(/\s+/)
    .filter((k) => k.length > 0 && !BUKAN_NAMA.has(k));

  if (kata.length === 0) return "XX";
  if (kata.length === 1) return kata[0].slice(0, 3);
  return kata.slice(0, 4).map((k) => k[0]).join("");
}

/** NNN/PJH-INISIAL/ROMAWI/TAHUN — padding 3 digit mengikuti contoh 001. */
export function rakitNomorPjh(urut: number, inisial: string, bulan: number, tahun: number): string {
  return `${String(urut).padStart(3, "0")}/PJH-${inisial}/${ROMAWI_BULAN[bulan - 1]}/${tahun}`;
}

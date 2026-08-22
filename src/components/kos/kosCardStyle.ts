/**
 * Warna untuk card kos — SATU-SATUNYA tempat string class-nya ditulis.
 *
 * Kenapa di `src/components` dan bukan di `src/lib/kosCard.ts` bersama
 * logikanya: Tailwind menemukan class dengan memindai teks file, dan daftar
 * `content`-nya tidak mencakup `src/lib`. Class yang HANYA muncul di sana
 * tidak pernah digenerate — tanpa error, tanpa peringatan; elemennya sekadar
 * tampil tanpa warna. `src/components/**` sudah pasti dipindai, jadi menaruh
 * literalnya di sini membuat warnanya tidak bergantung pada konfigurasi.
 *
 * Dua konteks, dua tingkat kepekatan:
 *
 * - `pill` menempel di ATAS FOTO. Butuh latar pekat + tepi terang, karena foto
 *   di belakangnya bisa apa saja — tembok putih, langit siang — dan tint
 *   transparan akan lenyap di situ.
 * - `chip` ada di area konten yang selalu gelap, jadi cukup tint tipis. Kalau
 *   dibuat sepekat pill, ia menang ramai melawan harga yang justru informasi
 *   utamanya.
 */

import type { KosGenderKey, KosPillVarian } from "@/lib/kosCard";

/** Class yang sama untuk semua pill, tanpa warna. */
export const PILL_DASAR =
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold";

/**
 * Warna per varian pill.
 *
 * Gender memakai biru/pink/ungu sebagai kode visual supaya pencari kos bisa
 * menyaring sekilas. Tingkat 500 dipilih karena cukup jenuh untuk terbaca di
 * atas foto terang tanpa jadi neon, dan teks putih di atasnya lolos ambang
 * kontras untuk ukuran kecil.
 */
export const PILL_WARNA: Record<KosPillVarian, string> = {
  PUTRA: "bg-blue-500 border-blue-300/50 text-white shadow-lg",
  PUTRI: "bg-pink-500 border-pink-300/50 text-white shadow-lg",
  CAMPUR: "bg-violet-500 border-violet-300/50 text-white shadow-lg",
  // Kamar penuh sengaja netral gelap — ini satu-satunya keadaan yang tidak
  // ingin kita tonjolkan.
  PENUH: "bg-black/70 border-white/10 text-gray-300 backdrop-blur-sm",
  MENIPIS: "bg-rose-500 border-rose-300/50 text-white shadow-lg animate-pulse",
  TERSEDIA: "bg-emerald-500 border-emerald-300/50 text-white shadow-lg",
};

/** Chip berteks di area konten. */
export const CHIP_NETRAL =
  "border-white/10 bg-white/5 text-gray-300";

export const CHIP_GENDER: Record<KosGenderKey, string> = {
  PUTRA: "border-blue-400/30 bg-blue-500/15 text-blue-300",
  PUTRI: "border-pink-400/30 bg-pink-500/15 text-pink-300",
  CAMPUR: "border-violet-400/30 bg-violet-500/15 text-violet-300",
};

export const chipWarna = (gender?: KosGenderKey) =>
  gender ? CHIP_GENDER[gender] : CHIP_NETRAL;

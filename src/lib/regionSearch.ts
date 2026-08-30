/**
 * regionSearch — utilitas bersama untuk pencarian lokasi multi-wilayah.
 *
 * Dipakai oleh seluruh search bar (Home, Jual, Lelang, halaman kategori) dan
 * builder filter Prisma di server. Menjembatani dua sumber data yang formatnya
 * berbeda:
 *
 *   - Dropdown wilayah  : dataset ibnux/data-indonesia → kota DENGAN prefix,
 *                         mis. "Kota Surabaya", "Kabupaten Gresik".
 *   - Data listing (DB) : hasil Google Geocoding yang prefix-nya sudah dibuang
 *                         (lihat tambah-property/.../Step2Location.tsx) →
 *                         mis. "Surabaya", "Gresik".
 *
 * Maka nama kota dinormalisasi (buang prefix administratif) sebelum dipakai
 * untuk membangun URL maupun query, supaya pencocokan ke DB konsisten.
 *
 * ── WILAYAH MEMBAWA INDUKNYA ────────────────────────────────────────────────
 * Sebuah nama kecamatan tidak unik se-Indonesia. Ada "Taman" di Sidoarjo, di
 * Madiun, dan di Pemalang. Selama URL hanya menyimpan `kecamatan=Taman`,
 * pertanyaan "kecamatan Taman yang mana" TIDAK PERNAH terjawab — dan halaman
 * hasil terpaksa menampilkan ketiganya sekaligus, padahal pemakainya barusan
 * menelusuri Kabupaten Sidoarjo untuk sampai ke sana.
 *
 * Maka setiap wilayah terpilih membawa rantai induknya (`ancestors`, dari yang
 * terdekat), dan rantai itu ikut tertulis ke URL:
 *
 *     kecamatan=Taman*Sidoarjo
 *     kelurahan=Bringinbendo*Taman*Sidoarjo
 *
 * Tanda `*` dipilih karena tidak pernah muncul di nama wilayah Indonesia DAN
 * tidak ikut di-escape oleh URLSearchParams — tautan yang dibagikan lewat
 * WhatsApp tetap terbaca sebagai teks, bukan deretan %2A.
 *
 * Nilai TANPA `*` tetap sah dan diartikan "tanpa batas induk", jadi seluruh
 * tautan lama yang sudah beredar tetap berfungsi apa adanya.
 */

import { intiNamaKota } from "./regionMatch";

export type RegionLevel = "provinsi" | "kota" | "kecamatan" | "kelurahan";

export interface SelectedRegion {
  /** id wilayah (ibnux) saat dipilih langsung, atau id sintetis "level:name" saat dihidrasi dari URL. */
  id: string;
  name: string;
  level: RegionLevel;
  /** opsional: konteks induk untuk tampilan, mis. provinsi dari sebuah kota. */
  parent?: string;
  /**
   * Rantai induk yang MEMBATASI wilayah ini, dari yang terdekat ke yang
   * terjauh, nama sudah dinormalisasi per levelnya. Untuk sebuah kecamatan
   * isinya `["Sidoarjo"]` (kota); untuk kelurahan `["Taman", "Sidoarjo"]`.
   *
   * Kosong = tidak dibatasi (dipakai provinsi/kota, dan tautan lama).
   */
  ancestors?: string[];
}

/** Pemisah antara nama wilayah dan rantai induknya di dalam satu nilai URL. */
export const REGION_SCOPE_SEP = "*";

export const REGION_LEVELS: RegionLevel[] = [
  "provinsi",
  "kota",
  "kecamatan",
  "kelurahan",
];

/**
 * Normalisasi nama wilayah ke "nama inti" yang cocok dengan nilai tersimpan di
 * DB. Untuk kota, prefix "Kota/Kabupaten/…" dibuang; level lain cukup di-trim
 * karena formatnya sudah selaras dengan data geocoder.
 *
 * Daftar prefiksnya tinggal di regionMatch.ts, satu-satunya tempat yang tahu
 * bentuk-bentuk penulisannya. Dua salinan daftar itu adalah cara terpasti
 * membuat nama yang ditulis ke URL berbeda dari nama yang dicari di DB.
 */
export function normalizeRegionName(name: string, level: RegionLevel): string {
  const trimmed = (name || "").trim();
  return level === "kota" ? intiNamaKota(trimmed) : trimmed;
}

/**
 * Level induk sebuah wilayah, dari yang terdekat ke yang terjauh.
 * kecamatan → ["kota", "provinsi"]. Dipakai untuk memasangkan tiap nama di
 * `ancestors` dengan kolom DB yang benar.
 */
export function ancestorLevels(level: RegionLevel): RegionLevel[] {
  const i = REGION_LEVELS.indexOf(level);
  return i <= 0 ? [] : REGION_LEVELS.slice(0, i).reverse();
}

/** Bersihkan nama dari karakter yang dipakai sebagai pemisah di URL. */
const bersihkanNama = (name: string) =>
  (name || "").split(REGION_SCOPE_SEP).join(" ").replace(/,/g, " ").trim();

/**
 * Identitas pemilihan di picker — pakai nama LENGKAP (dengan prefix) agar
 * "Kota X" dan "Kabupaten X" tetap DIBEDAKAN (mereka wilayah berbeda dengan id
 * ibnux berbeda). Jangan dinormalisasi di sini: normalizeRegionName khusus
 * untuk serialisasi URL / pencocokan DB (di mana data memang sudah strip
 * prefix sehingga tak bisa dibedakan).
 *
 * Rantai induk ikut masuk kunci: "Taman di Sidoarjo" dan "Taman di Madiun"
 * adalah dua pilihan berbeda, dan tanpa ini mencentang yang satu akan terlihat
 * seolah mencentang yang lain.
 */
export function regionKey(r: {
  name: string;
  level: RegionLevel;
  ancestors?: string[];
}): string {
  const induk = (r.ancestors ?? [])
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean)
    .join(REGION_SCOPE_SEP);
  return `${r.level}|${r.name.trim().toLowerCase()}${induk ? `@${induk}` : ""}`;
}

/** Apakah dua wilayah merujuk lokasi yang sama (berdasarkan level + nama inti). */
export function isSameRegion(
  a: { name: string; level: RegionLevel; ancestors?: string[] },
  b: { name: string; level: RegionLevel; ancestors?: string[] }
): boolean {
  return regionKey(a) === regionKey(b);
}

/**
 * Satu wilayah terpilih → satu nilai URL, lengkap dengan rantai induknya.
 * "Taman" di Kabupaten Sidoarjo → `Taman*Sidoarjo`.
 */
export function serializeRegionValue(r: SelectedRegion): string {
  const name = bersihkanNama(normalizeRegionName(r.name, r.level));
  if (!name) return "";
  const levels = ancestorLevels(r.level);
  const induk = (r.ancestors ?? [])
    .slice(0, levels.length)
    .map((a, i) => bersihkanNama(normalizeRegionName(a, levels[i])))
    .filter(Boolean);
  return [name, ...induk].join(REGION_SCOPE_SEP);
}

/** Kebalikan `serializeRegionValue` — juga menerima nilai lama tanpa induk. */
export function parseRegionValue(raw: string): {
  name: string;
  ancestors: string[];
} {
  const bagian = (raw || "")
    .split(REGION_SCOPE_SEP)
    .map((s) => s.trim())
    .filter(Boolean);
  return { name: bagian[0] ?? "", ancestors: bagian.slice(1) };
}

/**
 * Kelompokkan wilayah terpilih per level → nilai param URL (nama dinormalisasi,
 * dedupe, dipisah koma). Mengembalikan hanya level yang terisi.
 */
export function serializeLocations(
  regions: SelectedRegion[]
): Partial<Record<RegionLevel, string>> {
  const byLevel: Record<RegionLevel, string[]> = {
    provinsi: [],
    kota: [],
    kecamatan: [],
    kelurahan: [],
  };

  for (const r of regions) {
    const value = serializeRegionValue(r);
    if (!value) continue;
    const bucket = byLevel[r.level];
    if (!bucket.some((n) => n.toLowerCase() === value.toLowerCase())) {
      bucket.push(value);
    }
  }

  const out: Partial<Record<RegionLevel, string>> = {};
  for (const level of REGION_LEVELS) {
    if (byLevel[level].length) out[level] = byLevel[level].join(",");
  }
  return out;
}

/**
 * Tuangkan wilayah terpilih ke URLSearchParams. Selalu hapus 4 key lokasi lebih
 * dulu (membersihkan nilai lama) lalu set yang terisi — aman untuk params baru
 * maupun yang dipakai ulang.
 */
export function setLocationParams(
  params: URLSearchParams,
  regions: SelectedRegion[]
): void {
  const serialized = serializeLocations(regions);
  for (const level of REGION_LEVELS) {
    params.delete(level);
    const val = serialized[level];
    if (val) params.set(level, val);
  }
}

export interface ParsedLocations {
  provinsi: string[];
  kota: string[];
  kecamatan: string[];
  kelurahan: string[];
}

function splitCsv(v: string | string[] | undefined | null): string[] {
  if (v == null) return [];
  const raw = Array.isArray(v) ? v.join(",") : v;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Baca param lokasi multi-level dari sumber apa pun. `get` mengembalikan nilai
 * mentah untuk sebuah key:
 *   - server (Next searchParams): (k) => searchParams[k]
 *   - client (URLSearchParams)  : (k) => sp.get(k)
 */
export function parseLocationParams(
  get: (key: string) => string | string[] | undefined | null
): ParsedLocations {
  return {
    provinsi: splitCsv(get("provinsi")),
    kota: splitCsv(get("kota")),
    kecamatan: splitCsv(get("kecamatan")),
    kelurahan: splitCsv(get("kelurahan")),
  };
}

/** Versi praktis untuk objek searchParams server-component. */
export function parseLocationsFromSearchParams(searchParams: {
  [key: string]: string | string[] | undefined;
}): ParsedLocations {
  return parseLocationParams((k) => searchParams[k]);
}

/**
 * Ubah hasil parse menjadi SelectedRegion[] untuk menghidrasi UI picker dari
 * URL. Memakai id sintetis "level:nilai" — nilai UTUH beserta rantai induknya,
 * supaya dua kecamatan senama dari kota berbeda tidak berbagi id React.
 */
export function locationsToSelectedRegions(
  parsed: ParsedLocations
): SelectedRegion[] {
  const out: SelectedRegion[] = [];
  for (const level of REGION_LEVELS) {
    for (const raw of parsed[level]) {
      const { name, ancestors } = parseRegionValue(raw);
      if (!name) continue;
      out.push({
        id: `${level}:${raw}`,
        name,
        level,
        ancestors,
        // Induk terdekat dipakai sebagai baris keterangan di daftar & chip.
        parent: ancestors[0],
      });
    }
  }
  return out;
}

/**
 * Label yang dibaca manusia: "Taman, Sidoarjo".
 *
 * Chip filter yang hanya bertuliskan "Taman" menyembunyikan justru bagian yang
 * baru saja dipilih pemakainya lewat penelusuran, dan membuat dua chip dari
 * kota berbeda terlihat kembar.
 */
export function regionLabel(r: {
  name: string;
  ancestors?: string[];
}): string {
  const induk = (r.ancestors ?? []).filter(Boolean);
  // Cukup induk terdekat: "Bringinbendo, Taman" sudah menjawab "yang mana",
  // sementara menambah kota lagi membuat chip terpotong di layar 320px.
  return induk.length ? `${r.name}, ${induk[0]}` : r.name;
}

/** True bila ada minimal satu wilayah terpilih di URL. */
export function hasAnyLocation(parsed: ParsedLocations): boolean {
  return (
    parsed.provinsi.length > 0 ||
    parsed.kota.length > 0 ||
    parsed.kecamatan.length > 0 ||
    parsed.kelurahan.length > 0
  );
}

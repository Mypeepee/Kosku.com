import { Prisma } from "@prisma/client";
import {
  ancestorLevels,
  parseLocationsFromSearchParams,
  parseRegionValue,
  REGION_LEVELS,
  type RegionLevel,
} from "./regionSearch";
import { regionValueVariants } from "./regionMatch";

/**
 * Builder filter lokasi multi-wilayah untuk query Listing.
 *
 * Membaca param `provinsi`, `kota`, `kecamatan`, `kelurahan` (masing-masing
 * boleh berisi banyak nilai dipisah koma, dan tiap nilai boleh membawa rantai
 * induknya — lihat regionSearch.ts).
 *
 * ── DUA PERBAIKAN DIBANDING VERSI LAMA ──────────────────────────────────────
 *
 * 1. PENCOCOKAN EKSAK, BUKAN `contains`.
 *    Dulu tiap nama dicocokkan `contains`, jadi memilih Kecamatan "Taman"
 *    ikut menarik "Taman Sari", "Tamansari", bahkan "Ataman Taman" — 763 aset
 *    untuk sebuah kecamatan yang isinya 241. Sekarang nama dicocokkan sama
 *    persis terhadap daftar varian ejaannya (regionMatch.ts), yang tetap
 *    memaafkan selisih huruf besar/kecil, prefix "Kab./Kabupaten", spasi di
 *    tengah nama, dan spasi nyasar di pinggir nilai DB.
 *
 * 2. WILAYAH BERINDUK DIIRIS, BUKAN DIGABUNG.
 *    Dulu SEMUA nama dari SEMUA level disatukan dalam satu OR datar, sehingga
 *    "Kecamatan Taman di Sidoarjo" berarti "kecamatan mana pun bernama Taman,
 *    di kota mana pun di Indonesia". Sekarang tiap wilayah yang membawa induk
 *    menjadi satu cabang AND sendiri (kota Sidoarjo DAN kecamatan Taman), dan
 *    cabang-cabang itulah yang di-OR-kan.
 *
 * Sifat OR antar pilihan tetap dipertahankan — memilih "Kota Surabaya" dan
 * "Kecamatan Taman (Sidoarjo)" sekaligus tetap berarti keduanya, bukan irisan
 * yang pasti kosong.
 */

const LEVEL_TO_FIELD: Record<RegionLevel, keyof Prisma.ListingWhereInput> = {
  provinsi: "provinsi",
  kota: "kota",
  kecamatan: "kecamatan",
  kelurahan: "kelurahan",
};

/** Satu nama → satu syarat kolom, toleran terhadap ejaan tapi tidak terhadap tetangga. */
function cocokNama(
  level: RegionLevel,
  name: string
): Prisma.ListingWhereInput | null {
  const varian = regionValueVariants(name, level);
  if (varian.length === 0) return null;
  return {
    [LEVEL_TO_FIELD[level]]: { in: varian, mode: "insensitive" },
  } as Prisma.ListingWhereInput;
}

export function buildLocationWhere(searchParams: {
  [key: string]: string | string[] | undefined;
}): Prisma.ListingWhereInput | undefined {
  const parsed = parseLocationsFromSearchParams(searchParams);

  /** Cabang-cabang yang akan di-OR-kan di akhir. */
  const or: Prisma.ListingWhereInput[] = [];
  /**
   * Nilai TANPA induk, dikumpulkan per level lalu di-OR-kan datar — persis
   * perilaku lama. Ini yang menjaga tautan lama (`?kecamatan=Taman`) tetap
   * menjawab sesuatu, dan menjaga multi-pilih se-level ("Surabaya" +
   * "Gresik") tetap berarti gabungan, bukan irisan.
   */
  const datar: Prisma.ListingWhereInput[] = [];

  for (const level of REGION_LEVELS) {
    const levelInduk = ancestorLevels(level);

    for (const raw of parsed[level]) {
      const { name, ancestors } = parseRegionValue(raw);
      const syaratNama = cocokNama(level, name);
      if (!syaratNama) continue;

      // Induk yang tidak punya pasangan level (nilai URL cacat / terlalu
      // panjang) dibuang diam-diam: lebih baik hasilnya lebih luas daripada
      // sebuah kolom salah ikut disaring.
      const syaratInduk = ancestors
        .slice(0, levelInduk.length)
        .map((nama, i) => cocokNama(levelInduk[i], nama))
        .filter((w): w is Prisma.ListingWhereInput => w !== null);

      if (syaratInduk.length === 0) {
        datar.push(syaratNama);
        continue;
      }
      or.push({ AND: [syaratNama, ...syaratInduk] });
    }
  }

  if (datar.length > 0) or.push(...datar);
  if (or.length === 0) return undefined;
  return or.length === 1 ? or[0] : { OR: or };
}

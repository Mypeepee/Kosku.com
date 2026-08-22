// src/lib/auctionMatch.ts
//
// ⚠️ Modul ini HANYA dipakai jalur tulis "tandai TERJUAL" di
// /api/closing/listing/[id]/save. Pencocokannya sengaja jauh lebih sempit
// daripada mesin riwayat, karena salah cocok di sini berarti listing orang
// lain ikut ditandai terjual dan hilang dari etalase.
//
// Untuk MENAMPILKAN riwayat lelang, pakai @/lib/auctionHistory: pencocokannya
// mentoleransi kelurahan kosong/typo, cakupan bidang yang berbeda, dan
// menggabungkan listing kembar. Jangan tambahkan pemakai baru di modul ini.
//
// BEDANYA DENGAN VERSI LAMA
// Dulu nomor sertifikat dibandingkan sebagai STRING MENTAH
// (`nomor_legalitas = '123,456'`). Untuk aset multi-bidang itu rapuh: sumber
// menulis nomor bidang dengan urutan yang tidak stabil dan padding nol yang
// tidak konsisten, sehingga "123,456" vs "0456,123" — aset yang sama persis —
// gagal cocok dan listing kembarnya tetap tayang setelah closing.
// Sekarang yang dibandingkan adalah HIMPUNAN nomor kanonik, dan harus SAMA
// PERSIS (bukan sekadar beririsan): paket 3 bidang tidak boleh menandai
// terjual lot 1 bidang di dalamnya.

import { Prisma, type sertifikat_enum } from "@prisma/client";
import { CERT_KEYS_EXPR, certNumbers } from "@/lib/auctionHistory";

export type AssetMatchInput = {
  kelurahan?: string | null;
  kecamatan?: string | null;
  kota?: string | null;
  legalitas?: sertifikat_enum | null;
  nomor_legalitas?: string | null;
};

export type WilayahLevel = "kelurahan" | "kecamatan" | "kota";

/** Cukup `$queryRaw` — supaya bisa dipanggil dengan `prisma` maupun `tx`. */
type PenjalanQuery = Pick<Prisma.TransactionClient, "$queryRaw">;

const clean = (v?: string | null) => {
  const t = v?.trim();
  return t ? t : null;
};

/**
 * Level wilayah administratif terdalam yang tersedia pada aset.
 * Dipakai untuk menentukan seberapa spesifik pencocokan dilakukan.
 */
export function deepestWilayahLevel(current: AssetMatchInput): WilayahLevel {
  if (clean(current.kelurahan)) return "kelurahan";
  if (clean(current.kecamatan)) return "kecamatan";
  return "kota";
}

/**
 * Cari `id_property` listing lain yang merupakan **aset yang sama persis**.
 *
 * Dua aset dianggap identik bila jenis sertifikat sama, HIMPUNAN nomor
 * sertifikatnya sama persis, dan berada di wilayah administratif yang sama.
 * Nomor sertifikat di Indonesia hanya unik dalam satu kelurahan/desa — jadi
 * pencocokan WAJIB menyertakan kelurahan. Bila kelurahan tidak tersedia pada
 * aset ini, pencocokan turun ke kecamatan, lalu ke kota/kabupaten. Kota selalu
 * ikut dibatasi (bila ada) supaya kelurahan/kecamatan bernama sama di kota
 * berbeda tidak ikut tercocok.
 *
 * Mengembalikan array kosong bila aset tidak punya jenis + nomor sertifikat
 * (tidak bisa diidentifikasi sebagai aset unik), termasuk `id_property` acuan
 * itu sendiri kalau ikut memenuhi syarat — pemanggil boleh memakainya apa adanya.
 *
 * Catatan performa: query ini sengaja TIDAK menyaring `jenis_transaksi`, supaya
 * listing JUAL/SEWA atas aset yang sama ikut ditandai terjual seperti perilaku
 * sebelumnya. Konsekuensinya index parsial riwayat lelang tidak terpakai dan
 * ini jadi seq scan (±65 ms pada 122rb baris) — tidak masalah untuk jalur tulis
 * yang dijalankan beberapa kali sehari saat closing.
 */
export async function cariIdAsetSama(
  db: PenjalanQuery,
  current: AssetMatchInput,
): Promise<bigint[]> {
  const legalitas = current.legalitas ?? null;
  const nomor = certNumbers(current.nomor_legalitas);
  if (!legalitas || nomor.length === 0) return [];

  const kota = clean(current.kota);
  const kelurahan = clean(current.kelurahan);
  const kecamatan = clean(current.kecamatan);

  const syarat: Prisma.Sql[] = [
    Prisma.sql`legalitas = ${legalitas}::sertifikat_enum`,
    // `@>` + `<@` = kesetaraan himpunan: lolos apa pun urutan & padding nol
    // bidangnya, tapi menolak paket yang bidangnya lebih banyak/sedikit.
    Prisma.sql`${CERT_KEYS_EXPR} @> ARRAY[${Prisma.join(nomor)}]::text[]`,
    Prisma.sql`${CERT_KEYS_EXPR} <@ ARRAY[${Prisma.join(nomor)}]::text[]`,
  ];
  if (kota) syarat.push(Prisma.sql`upper(btrim(kota)) = upper(btrim(${kota}))`);
  if (kelurahan) {
    syarat.push(
      Prisma.sql`upper(btrim(kelurahan)) = upper(btrim(${kelurahan}))`,
    );
  } else if (kecamatan) {
    syarat.push(
      Prisma.sql`upper(btrim(kecamatan)) = upper(btrim(${kecamatan}))`,
    );
  }

  const baris = await db.$queryRaw<Array<{ id_property: bigint }>>(
    Prisma.sql`SELECT id_property FROM listing WHERE ${Prisma.join(syarat, " AND ")}`,
  );
  return baris.map((b) => b.id_property);
}

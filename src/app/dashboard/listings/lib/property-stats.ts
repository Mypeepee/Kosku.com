// src/app/dashboard/listings/lib/property-stats.ts
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type KategoriEnum =
  | "RUMAH"
  | "APARTEMEN"
  | "RUKO"
  | "TANAH"
  | "GUDANG"
  | "HOTEL_DAN_VILLA"
  | "TOKO"
  | "PABRIK";

export type ListingTypeCounts = Partial<Record<KategoriEnum, number>>;

export type ListingHeaderStats = {
  total: number;
  totalForSale: number;
  totalForRent: number;
  totalHotDeal: number;
  totalViewed: number;
  countsByCategory: ListingTypeCounts;
};

/**
 * Angka di kepala halaman HARUS memakai cakupan yang sama persis dengan daftar
 * di bawahnya. Dulu fungsi ini menghitung cakupannya sendiri dari `userRole` —
 * yang isinya `peran_enum` (USER|AGENT), sehingga `userRole === "OWNER"` tidak
 * pernah benar dan owner melihat "12 listing" di kartu statistik sementara
 * daftarnya menampilkan ratusan. Sekarang cakupannya dikirim dari pemanggil,
 * hasil `listingScopeWhere()` — satu perhitungan untuk keduanya.
 */
export async function fetchListingHeaderStats(
  scope: Record<string, unknown>,
): Promise<ListingHeaderStats> {
  const baseWhere = {
    status_tayang: "TERSEDIA" as const,
    // `AND`, bukan spread: scope milik STOKER berisi kunci `OR`, dan menyatukan
    // dua `OR` dalam satu objek membuat salah satunya hilang diam-diam.
    AND: [scope as Prisma.ListingWhereInput],
  } satisfies Prisma.ListingWhereInput;

  // Semua query dijalankan paralel — dari 6 sequential (~180ms) → 1 batch (~30ms)
  const [
    total,
    totalForSale,
    totalForRent,
    totalHotDeal,
    byCategory,
    viewedAgg,
  ] = await Promise.all([
    prisma.listing.count({ where: baseWhere }),

    prisma.listing.count({
      where: { ...baseWhere, jenis_transaksi: { in: ["PRIMARY", "SECONDARY"] } },
    }),

    prisma.listing.count({
      where: { ...baseWhere, jenis_transaksi: "SEWA" },
    }),

    prisma.listing.count({
      where: { ...baseWhere, is_hot_deal: true },
    }),

    prisma.listing.groupBy({
      by: ["kategori"],
      _count: { _all: true },
      where: baseWhere,
    }),

    prisma.listing.aggregate({
      where: baseWhere,
      _sum: { dilihat: true },
    }),
  ]);

  const countsByCategory: ListingTypeCounts = {};
  byCategory.forEach((row) => {
    countsByCategory[row.kategori as KategoriEnum] = row._count._all;
  });

  return {
    total,
    totalForSale,
    totalForRent,
    totalHotDeal,
    totalViewed: viewedAgg._sum.dilihat ?? 0,
    countsByCategory,
  };
}

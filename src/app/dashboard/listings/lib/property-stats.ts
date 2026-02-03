// src/app/dashboard/listings/lib/property-stats.ts
import prisma from "@/lib/prisma";

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

export async function fetchListingHeaderStats(
  userRole: string,
  idAgent?: string,
): Promise<ListingHeaderStats> {
  // Conditional where clause berdasarkan role [web:20][web:23]
  const baseWhere = userRole === "OWNER"
    ? { status_tayang: "TERSEDIA" as const }
    : { 
        id_agent: idAgent!,
        status_tayang: "TERSEDIA" as const 
      };

  // Total semua listing tersedia
  const total = await prisma.listing.count({
    where: baseWhere,
  });

  // Listing untuk dijual (PRIMARY + SECONDARY)
  const totalForSale = await prisma.listing.count({
    where: {
      ...baseWhere,
      jenis_transaksi: {
        in: ["PRIMARY", "SECONDARY"],
      },
    },
  });

  // Listing untuk disewa (SEWA)
  const totalForRent = await prisma.listing.count({
    where: {
      ...baseWhere,
      jenis_transaksi: "SEWA",
    },
  });

  // Hot deal
  const totalHotDeal = await prisma.listing.count({
    where: {
      ...baseWhere,
      is_hot_deal: true,
    },
  });

  // Group by kategori
  const byCategory = await prisma.listing.groupBy({
    by: ["kategori"],
    _count: { _all: true },
    where: baseWhere,
  });

  const countsByCategory: ListingTypeCounts = {};
  byCategory.forEach((row) => {
    const key = row.kategori as KategoriEnum;
    countsByCategory[key] = row._count._all;
  });

  // Total viewed
  const viewedAgg = await prisma.listing.aggregate({
    where: baseWhere,
    _sum: {
      dilihat: true,
    },
  });

  const totalViewed = viewedAgg._sum.dilihat ?? 0;

  return {
    total,
    totalForSale,
    totalForRent,
    totalHotDeal,
    totalViewed,
    countsByCategory,
  };
}

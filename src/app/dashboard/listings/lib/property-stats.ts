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
  totalForSale: number;     // PRIMARY + SECONDARY
  totalForRent: number;     // SEWA
  totalHotDeal: number;     // is_hot_deal = true
  totalViewed: number;      // SUM(dilihat) semua listing agent
  countsByCategory: ListingTypeCounts;
};

export async function fetchListingHeaderStats(
  idAgent: string,
): Promise<ListingHeaderStats> {
  // Total semua listing tersedia milik agent
  const total = await prisma.listing.count({
    where: {
      id_agent: idAgent,
      status_tayang: "TERSEDIA",
    },
  });

  // Listing untuk dijual (PRIMARY + SECONDARY)
  const totalForSale = await prisma.listing.count({
    where: {
      id_agent: idAgent,
      status_tayang: "TERSEDIA",
      jenis_transaksi: {
        in: ["PRIMARY", "SECONDARY"], // jenis_transaksi_enum
      },
    },
  });

  // Listing untuk disewa (SEWA)
  const totalForRent = await prisma.listing.count({
    where: {
      id_agent: idAgent,
      status_tayang: "TERSEDIA",
      jenis_transaksi: "SEWA",
    },
  });

  // Hot deal
  const totalHotDeal = await prisma.listing.count({
    where: {
      id_agent: idAgent,
      status_tayang: "TERSEDIA",
      is_hot_deal: true,
    },
  });

  // Group by kategori
  const byCategory = await prisma.listing.groupBy({
    by: ["kategori"],
    _count: { _all: true },
    where: {
      id_agent: idAgent,
      status_tayang: "TERSEDIA",
    },
  });

  const countsByCategory: ListingTypeCounts = {};
  byCategory.forEach((row) => {
    const key = row.kategori as KategoriEnum;
    countsByCategory[key] = row._count._all;
  });

  // Total viewed: sum kolom dilihat untuk semua listing agent ini
  const viewedAgg = await prisma.listing.aggregate({
    where: {
      id_agent: idAgent,
      status_tayang: "TERSEDIA",
    },
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

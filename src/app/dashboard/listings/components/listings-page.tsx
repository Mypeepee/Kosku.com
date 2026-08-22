// app/dashboard/listings/components/listings-page.tsx
"use client";

import type { ListingHeaderStats } from "../lib/property-stats";
import { MetricCard } from "./metric-card";
import { AddListingCard } from "./AddListingCard";
import ListingCardGrid from "./ListingCardGrid";
import type { DashboardListing } from "../lib/listing-item";
import type { ListingFilters } from "../lib/filters";

type ListingsPageProps = {
  headerStats: ListingHeaderStats & {
    totalPriority?: number;
  };
  listings: DashboardListing[];
  currentAgentId?: string;
  userRole?: string;
  /** jabatan_agent_enum — penentu wewenang OWNER/STOKER (bukan `userRole`). */
  currentJabatan?: string;
  currentPage: number;
  totalItems: number;
  pageSize: number;
  initialFilters: ListingFilters;
  /** Jumlah hasil per jenis transaksi & per tipe aset untuk angka di dropdown. */
  jenisCounts?: Record<string, number>;
  kategoriCounts?: Record<string, number>;
};

export default function ListingsPage({
  headerStats,
  listings,
  currentAgentId,
  userRole,
  currentJabatan,
  currentPage,
  totalItems,
  pageSize,
  initialFilters,
  jenisCounts,
  kategoriCounts,
}: ListingsPageProps) {
  const { total, totalHotDeal, totalViewed, totalPriority } = headerStats;

  const safeTotalViewed = totalViewed ?? 0;
  const priorityCount = totalPriority ?? totalHotDeal;
  const safeTotal = total || 1;
  const priorityPercent = Math.min(
    100,
    Math.round((priorityCount / safeTotal) * 100)
  );

  return (
    <div className="relative min-h-screen px-4 py-8 sm:px-6 sm:py-10 space-y-6">
      {/* BACKGROUND */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#020617] via-[#020c1a] to-[#020617]" />
        <div className="absolute -right-32 -top-32 h-72 w-72 rounded-full bg-emerald-500/25 blur-3xl" />
        <div className="absolute -left-32 bottom-0 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,#22c55e_1px,transparent_1px),linear-gradient(to_bottom,#22c55e_1px,transparent_1px)] [background-size:80px_80px]" />
      </div>

      {/* GRID CARD */}
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
        <MetricCard
          label="Total Listings"
          icon="solar:buildings-3-bold-duotone"
          main={total}
          suffix="aktif"
          description="Properti kelolaan Anda."
          variant="primary"
        />

        <MetricCard
          label="Prioritas"
          icon="solar:rocket-2-bold-duotone"
          main={priorityCount}
          description="Listing posisi atas."
          variant="accent"
          percent={priorityPercent}
        />

        <MetricCard
          label="Dilihat"
          icon="solar:eye-bold-duotone"
          main={safeTotalViewed}
          suffix="views"
          description="Total semua listing dibuka."
          variant="soft"
        />

        <AddListingCard />
      </div>

      {/* CARD GRID */}
      <div className="mx-auto max-w-6xl">
        <ListingCardGrid
          listings={listings}
          currentAgentId={currentAgentId}
          userRole={userRole}
          currentJabatan={currentJabatan}
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={pageSize}
          initialFilters={initialFilters}
          jenisCounts={jenisCounts}
          kategoriCounts={kategoriCounts}
        />
      </div>
    </div>
  );
}

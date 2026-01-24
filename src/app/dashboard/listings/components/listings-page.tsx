// app/dashboard/listings/components/listings-page.tsx
"use client";

import { Icon } from "@iconify/react";
import ListingsTable, { Listing } from "./listings-table";
import ListingTypeStats from "./listing-type";
import type { ListingHeaderStats } from "../lib/property-stats";

// Sementara: data tabel masih dummy.
// Nanti bisa diganti hasil query Prisma juga.
const MOCK_LISTINGS: Listing[] = [
  {
    id: "PRM-001",
    title: "Rumah Mewah Cluster Emerald",
    status: "For Sale",
    type: "Rumah",
    city: "Surabaya",
    area: "Citraland",
    price: "Rp 3.250.000.000",
    beds: 4,
    baths: 3,
    size: "220 m²",
    updatedAt: "2 hari lalu",
    views30d: 124,
    inquiries: 5,
  },
  {
    id: "PRM-002",
    title: "Apartemen Modern Tunjungan City",
    status: "For Rent",
    type: "Apartemen",
    city: "Surabaya",
    area: "Tunjungan",
    price: "Rp 9.500.000 / bulan",
    beds: 2,
    baths: 1,
    size: "65 m²",
    updatedAt: "5 jam lalu",
    views30d: 89,
    inquiries: 3,
  },
  {
    id: "PRM-003",
    title: "Ruko Strategis di Raya Jemursari",
    status: "Pending",
    type: "Ruko",
    city: "Surabaya",
    area: "Jemursari",
    price: "Rp 2.100.000.000",
    beds: 0,
    baths: 2,
    size: "180 m²",
    updatedAt: "1 hari lalu",
    views30d: 47,
    inquiries: 1,
  },
  {
    id: "PRM-004",
    title: "Tanah Hook Siap Bangun",
    status: "Draft",
    type: "Tanah",
    city: "Sidoarjo",
    area: "Waru",
    price: "Rp 980.000.000",
    beds: 0,
    baths: 0,
    size: "300 m²",
    updatedAt: "3 hari lalu",
    views30d: 15,
    inquiries: 0,
  },
];

type ListingsPageProps = {
  headerStats: ListingHeaderStats;
};

export default function ListingsPage({ headerStats }: ListingsPageProps) {
  const { total, totalForSale, totalForRent, totalHotDeal, countsByCategory } =
    headerStats;

  // Data summary untuk kartu lama bisa pakai kombinasi baru
  const activeCount = totalForSale + totalForRent;
  const draftCount = 0; // nanti kalau sudah ada status Draft di DB, bisa dihitung
  const pendingCount = 0; // sama: bisa dihitung dari status lain jika ada

  return (
    <div className="space-y-6">
      {/* HEADER ATAS */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs text-slate-400 mb-1">Property Management</p>
          <h1 className="text-2xl font-bold text-white">Listings</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Kelola seluruh property yang Anda pasarkan: update status, harga,
            dan lihat performa tiap listing secara real time.
          </p>
        </div>

        {/* ACTIONS */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-white/10 bg-[#050608] p-1 text-[11px] text-slate-300">
            <button className="px-3 py-1.5 rounded-full bg-[#0b0d11] text-emerald-300 flex items-center gap-1">
              <Icon icon="solar:rows-3-linear" className="text-xs" />
              Table
            </button>
            <button className="px-3 py-1.5 rounded-full hover:bg-white/5 flex items-center gap-1">
              <Icon icon="solar:gallery-wide-linear" className="text-xs" />
              Cards
            </button>
          </div>

          <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/20">
            <Icon icon="solar:add-circle-linear" className="text-sm" />
            Tambah Property
          </button>
        </div>
      </div>

      {/* RINGKASAN KARTU (pakai headerStats) */}
      <div className="grid gap-3 sm:grid-cols-4">
        <SummaryCard
          icon="solar:buildings-3-bold"
          label="Total Listings"
          value={total.toString()}
          sub="status_tayang = TERSEDIA"
          accent="text-emerald-400"
        />
        <SummaryCard
          icon="solar:dollar-minimalistic-bold"
          label="Listing Jual"
          value={totalForSale.toString()}
          sub="jenis_transaksi PRIMARY + SECONDARY"
          accent="text-blue-400"
        />
        <SummaryCard
          icon="solar:bag-4-bold"
          label="Listing Sewa"
          value={totalForRent.toString()}
          sub="jenis_transaksi SEWA"
          accent="text-indigo-400"
        />
        <SummaryCard
          icon="solar:flame-bold"
          label="Hot Deals"
          value={totalHotDeal.toString()}
          sub="is_hot_deal = TRUE"
          accent="text-amber-300"
        />
      </div>

      {/* TIPE PROPERTI DARI DATABASE */}
      <ListingTypeStats counts={countsByCategory} />

      {/* FILTER BAR */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Icon
              icon="solar:magnifer-linear"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"
            />
            <input
              type="text"
              placeholder="Cari judul, ID listing, alamat..."
              className="h-9 w-full rounded-xl border border-white/10 bg-[#050608] pl-8 pr-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400/60"
            />
          </div>

          <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#050608] px-3 py-2 text-[11px] text-slate-200 hover:bg-white/5">
            <Icon icon="solar:slider-vertical-linear" className="text-xs" />
            Status
          </button>

          <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#050608] px-3 py-2 text-[11px] text-slate-200 hover:bg-white/5">
            <Icon icon="solar:home-linear" className="text-xs" />
            Tipe
          </button>

          <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#050608] px-3 py-2 text-[11px] text-slate-200 hover:bg-white/5">
            <Icon icon="solar:map-point-linear" className="text-xs" />
            Lokasi
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden text-[11px] uppercase tracking-[0.18em] text-slate-500 lg:inline">
            Sort by
          </span>
          <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#050608] px-3 py-2 text-[11px] text-slate-200 hover:bg-white/5">
            Terbaru
            <Icon
              icon="solar:alt-arrow-down-linear"
              className="text-xs text-slate-500"
            />
          </button>
        </div>
      </div>

      {/* TABEL LISTING (masih dummy untuk sekarang) */}
      <ListingsTable listings={MOCK_LISTINGS} />
    </div>
  );
}

type SummaryCardProps = {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
};

function SummaryCard({ icon, label, value, sub, accent }: SummaryCardProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-[#05070b] px-4 py-3.5 sm:px-5 sm:py-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-1">
          {label}
        </p>
        <p className="text-xl font-bold text-white">{value}</p>
        {sub && (
          <p className="mt-1 text-[11px] text-slate-500">
            {sub}
          </p>
        )}
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#050608] border border-white/10">
        <Icon icon={icon} className={`${accent ?? ""} text-lg`} />
      </div>
    </div>
  );
}

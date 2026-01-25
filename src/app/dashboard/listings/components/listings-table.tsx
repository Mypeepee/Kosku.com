// app/dashboard/listings/components/listings-table.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";

export type ListingStatus =
  | "For Sale"
  | "For Rent"
  | "Pending"
  | "Draft"
  | "Archived";

export type Listing = {
  id: string;                  // id_property
  slug: string;                // slug-id lengkap untuk detail
  title: string;
  status: ListingStatus | string;
  category: string;
  transactionType: string;     // "LELANG" | "PRIMARY" | "SECONDARY" | "SEWA" dll
  city: string;
  area: string;
  address: string;
  price: string;
  thumbnailUrl?: string;
  views: number;
};

const PAGE_SIZE = 10;

const formatViews = (value: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(
    value || 0
  );

interface ListingsTableProps {
  listings: Listing[];
  currentAgentId?: string | null; // id agent dari session
}

// Helper: tentukan URL publik detail
const getPublicDetailUrl = (item: Listing, currentAgentId?: string | null) => {
  const tx = item.transactionType?.toUpperCase();
  const baseSlug = item.slug; // pastikan sudah slug-id dari server

  const agentSegment = currentAgentId ? `/${currentAgentId}` : "";

  if (tx === "LELANG") {
    return `/Lelang/${baseSlug}${agentSegment}`;
  }

  // PRIMARY / SECONDARY / SEWA → Jual
  return `/Jual/${baseSlug}${agentSegment}`;
};

export default function ListingsTable({
  listings,
  currentAgentId,
}: ListingsTableProps) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  // Filter by address
  const filteredListings = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return listings;
    return listings.filter((item) =>
      item.address.toLowerCase().includes(q)
    );
  }, [listings, search]);

  const totalItems = filteredListings.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const paginatedListings = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return filteredListings.slice(start, end);
  }, [filteredListings, currentPage]);

  const allVisibleIds = useMemo(
    () => paginatedListings.map((l) => l.id),
    [paginatedListings]
  );

  const isAllSelected =
    allVisibleIds.length > 0 &&
    allVisibleIds.every((id) => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !allVisibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...allVisibleIds])));
    }
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  };

  const goPrev = () => goToPage(currentPage - 1);
  const goNext = () => goToPage(currentPage + 1);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#050608]">
      {/* HEADER ATAS */}
      <div className="flex flex-col gap-3 border-b border-white/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1 text-[11px] text-slate-400">
          <span>
            Menampilkan{" "}
            <span className="font-semibold text-emerald-400">
              {totalItems}
            </span>{" "}
            listing.
          </span>
          {totalItems > 0 && (
            <span className="text-[10px] text-slate-500">
              Halaman {currentPage} dari {totalPages} • Menampilkan{" "}
              {paginatedListings.length} listing per halaman.
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {/* Search alamat */}
          <div className="relative w-full sm:w-64">
            <Icon
              icon="solar:magnifer-linear"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500"
            />
            <input
              type="text"
              placeholder="Cari berdasarkan alamat..."
              className="h-8 w-full rounded-xl border border-white/10 bg-[#050608] pl-8 pr-3 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400/60"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            {/* Bulk delete */}
            <button
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-[11px] font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-40"
              disabled={selectedIds.length === 0}
              type="button"
            >
              <Icon
                icon="solar:trash-bin-minimalistic-linear"
                className="text-xs"
              />
              Hapus terpilih ({selectedIds.length})
            </button>

            {/* Add Property */}
            <Link
              href="/dashboard/listings/new"
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-emerald-400/60 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/25 hover:border-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.35)]"
            >
              <Icon
                icon="solar:add-circle-linear"
                className="text-xs text-emerald-200"
              />
              <span className="hidden sm:inline">Tambah property</span>
              <span className="sm:hidden">Tambah</span>
            </Link>
          </div>
        </div>
      </div>

      {/* TABEL */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs text-slate-300">
          <thead className="border-b border-white/5 bg-white/5 text-[11px] uppercase tracking-[0.18em] text-slate-400">
            <tr>
              <th className="w-8 px-4 py-3">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-white/20 bg-transparent text-emerald-400 focus:ring-0"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="w-10 px-2 py-3">Aksi</th>
              <th className="w-32 px-4 py-3">ID Listing</th>
              <th className="w-16 px-2 py-3">Foto</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Transaksi</th>
              <th className="px-4 py-3">Alamat</th>
              <th className="px-4 py-3">Harga</th>
              <th className="px-3 py-3 text-right">Dilihat</th>
              <th className="px-4 py-3 text-right">Edit</th>
            </tr>
          </thead>
          <tbody>
            {paginatedListings.map((item) => {
              const checked = selectedIds.includes(item.id);
              const detailHref = getPublicDetailUrl(item, currentAgentId);

              return (
                <tr
                  key={item.id}
                  className="border-b border-white/5 last:border-0 transition-colors hover:bg-white/5"
                >
                  {/* checkbox */}
                  <td className="px-4 py-3 align-top">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-white/20 bg-transparent text-emerald-400 focus:ring-0"
                      checked={checked}
                      onChange={() => toggleRow(item.id)}
                    />
                  </td>

                  {/* tombol view/detail */}
                  <td className="px-2 py-3 align-top">
                    <Link
                      href={detailHref}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                    >
                      <Icon icon="solar:eye-linear" className="text-sm" />
                    </Link>
                  </td>

                  {/* ID listing */}
                  <td className="px-4 py-3 align-top">
                    <Link
                      href={detailHref}
                      className="font-mono text-[11px] text-slate-200 hover:text-emerald-300"
                    >
                      {item.id}
                    </Link>
                  </td>

                  {/* thumbnail */}
                  <td className="px-2 py-3 align-top">
                    {item.thumbnailUrl ? (
                      <Link href={detailHref}>
                        <div className="h-10 w-14 overflow-hidden rounded-md border border-white/10 bg-black/40">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.thumbnailUrl}
                            alt={item.title}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </Link>
                    ) : (
                      <div className="flex h-10 w-14 items-center justify-center rounded-md border border-dashed border-slate-600 bg-black/40 text-[10px] text-slate-500">
                        No img
                      </div>
                    )}
                  </td>

                  {/* kategori */}
                  <td className="px-4 py-3 align-top text-xs text-slate-200">
                    {item.category}
                  </td>

                  {/* jenis transaksi */}
                  <td className="px-4 py-3 align-top text-xs text-slate-200">
                    {item.transactionType}
                  </td>

                  {/* alamat */}
                  <td className="px-4 py-3 align-top text-xs text-slate-300">
                    <Link href={detailHref} className="flex flex-col gap-0.5">
                      <span className="line-clamp-1 hover:text-emerald-300">
                        {item.address}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {item.area && `${item.area}, `}
                        {item.city}
                      </span>
                    </Link>
                  </td>

                  {/* harga */}
                  <td className="px-4 py-3 align-top text-xs text-emerald-200">
                    {item.price}
                  </td>

                  {/* dilihat */}
                  <td className="px-3 py-3 align-top text-right text-[11px] text-slate-300">
                    {formatViews(item.views)}
                  </td>

                  {/* tombol edit (dashboard) */}
                  <td className="px-4 py-3 align-top text-right">
                    <Link
                      href={`/dashboard/listings/${item.id}`}
                      className="inline-flex h-8 items-center justify-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 text-[11px] text-slate-100 hover:bg-white/10"
                    >
                      <Icon
                        icon="solar:pen-new-square-linear"
                        className="text-xs"
                      />
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}

            {paginatedListings.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-10 text-center text-xs text-slate-500"
                >
                  Tidak ada property yang cocok dengan pencarian.{" "}
                  <Link
                    href="/dashboard/listings/new"
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
                  >
                    <Icon
                      icon="solar:add-circle-linear"
                      className="text-xs"
                    />
                    Tambah Property
                  </Link>
                  .
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION BAR */}
      {totalPages > 1 && (
        <nav
          className="flex flex-col gap-2 border-t border-white/5 px-4 py-3 text-[11px] text-slate-300 sm:flex-row sm:items-center sm:justify-between"
          aria-label="Pagination"
        >
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>
              Halaman{" "}
              <span className="font-semibold text-slate-200">
                {currentPage}
              </span>{" "}
              dari{" "}
              <span className="font-semibold text-slate-200">
                {totalPages}
              </span>
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <button
              type="button"
              onClick={goPrev}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon icon="solar:alt-arrow-left-linear" className="text-xs" />
              <span className="hidden sm:inline">Sebelumnya</span>
            </button>

            <ol className="flex items-center gap-1">
              {Array.from({ length: totalPages }).map((_, index) => {
                const pageNumber = index + 1;
                const isActive = pageNumber === currentPage;
                return (
                  <li key={pageNumber}>
                    <button
                      type="button"
                      onClick={() => goToPage(pageNumber)}
                      className={`h-7 min-w-[1.75rem] rounded-full px-2 text-[11px] ${
                        isActive
                          ? "bg-emerald-500 text-black"
                          : "bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {pageNumber}
                    </button>
                  </li>
                );
              })}
            </ol>

            <button
              type="button"
              onClick={goNext}
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="hidden sm:inline">Berikutnya</span>
              <Icon icon="solar:alt-arrow-right-linear" className="text-xs" />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

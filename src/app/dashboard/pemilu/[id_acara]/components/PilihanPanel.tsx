// src/app/dashboard/pemilu/[id_acara]/components/PilihanPanel.tsx
"use client";

import { Icon } from "@iconify/react";
import type { Pilihan, Listing } from "../PemiluClient";
import { useMemo, useState } from "react";

interface Props {
  pilihan: Pilihan[];
  availableListings: Listing[];
  onPilih?: (id_listing: string) => void;
  currentAgentId: string;
  activeAgentId: string | null;
}

const ITEMS_PER_PAGE = 15;

const formatHarga = (harga?: string | null) => {
  if (!harga) return "-";
  const num = Number(harga);
  if (Number.isNaN(num)) return harga;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num);
};

const formatLuas = (luas?: string | null) => {
  if (!luas) return "-";
  const num = Number(luas);
  if (Number.isNaN(num)) return luas;
  return `${num.toLocaleString("id-ID")} m²`;
};

const getFirstImageUrl = (gambarString?: string | null): string | null => {
  if (!gambarString) return null;
  const urls = gambarString.split(",").map((url) => url.trim());
  return urls[0] || null;
};

export default function PilihanPanel({
  pilihan,
  availableListings,
  onPilih,
  currentAgentId,
  activeAgentId,
}: Props) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKategori, setFilterKategori] = useState<string>("all");

  const selectedIds = useMemo(
    () => new Set(pilihan.map((p) => p.id_listing)),
    [pilihan]
  );

  const uniqueKategori = useMemo(
    () => Array.from(new Set(availableListings.map((l) => l.kategori))),
    [availableListings]
  );

  const isCurrentAgentTurn = activeAgentId != null && activeAgentId === currentAgentId;

  const filteredListings = useMemo(() => {
    let result = [...availableListings];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.judul.toLowerCase().includes(query) ||
          l.alamat_lengkap?.toLowerCase().includes(query) ||
          l.kota?.toLowerCase().includes(query) ||
          l.provinsi?.toLowerCase().includes(query) ||
          l.kecamatan?.toLowerCase().includes(query) ||
          l.kelurahan?.toLowerCase().includes(query) ||
          l.id_property.toLowerCase().includes(query)
      );
    }

    if (filterKategori !== "all") {
      result = result.filter((l) => l.kategori === filterKategori);
    }

    return result;
  }, [availableListings, searchQuery, filterKategori]);

  const totalPages = Math.ceil(filteredListings.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentListings = filteredListings.slice(startIndex, endIndex);

  // Reset page ketika filter berubah
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery, filterKategori]);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setFilterKategori("all");
    setCurrentPage(1);
  };

  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-3 md:p-4 shadow-[0_0_40px_rgba(15,23,42,0.9)]">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-sky-500/20 border border-sky-500/40">
            <Icon
              icon="solar:home-2-bold-duotone"
              className="text-base text-sky-300"
            />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">Pilihan Unit</p>
            <p className="text-[10px] text-slate-400">
              {filteredListings.length} unit tersedia · {pilihan.length} sudah dipilih
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-1 border border-sky-500/30">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-300 animate-pulse" />
          <span className="text-[10px] font-medium text-sky-100">
            Update realtime
          </span>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Icon
            icon="solar:magnifer-linear"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400"
          />
          <input
            type="text"
            placeholder="Cari alamat, kota, provinsi, ID listing..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-900/60 py-2 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:border-sky-500/40 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
        </div>

        <select
          value={filterKategori}
          onChange={(e) => setFilterKategori(e.target.value)}
          className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-200 focus:border-sky-500/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
        >
          <option value="all">Semua Tipe</option>
          {uniqueKategori.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>

        {(searchQuery || filterKategori !== "all") && (
          <button
            onClick={handleResetFilters}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-900/60 text-slate-300 transition-all hover:bg-slate-800 hover:border-white/20"
            title="Reset filter"
          >
            <Icon icon="solar:restart-bold" className="text-sm" />
          </button>
        )}
      </div>

      {/* Tabel */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {filteredListings.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-6 text-center">
            <Icon
              icon="solar:clipboard-remove-bold-duotone"
              className="mb-3 text-3xl text-slate-600"
            />
            <p className="text-xs font-semibold text-slate-300">
              Tidak ada unit yang sesuai pencarian.
            </p>
            <p className="text-[10px] text-slate-500">
              Coba ubah kata kunci atau filter tipe properti.
            </p>
          </div>
        ) : (
          <table className="w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm">
              <tr>
                <th className="border-b border-white/10 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Gambar
                </th>
                <th className="border-b border-white/10 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Alamat
                </th>
                <th className="border-b border-white/10 px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Limit Lelang
                </th>
                <th className="border-b border-white/10 px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Luas Tanah
                </th>
                <th className="border-b border-white/10 px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {currentListings.map((listing) => {
                const isSelected = selectedIds.has(listing.id_property);
                const pilihanData = pilihan.find(
                  (p) => p.id_listing === listing.id_property
                );
                const imageUrl = getFirstImageUrl(listing.gambar);

                return (
                  <tr
                    key={listing.id_property}
                    className={`group transition-all duration-150 ${
                      isSelected
                        ? "bg-emerald-500/10"
                        : "hover:bg-slate-900/60"
                    }`}
                  >
                    {/* Gambar */}
                    <td className="border-b border-white/5 px-3 py-2">
                      <div className="relative h-16 w-20 overflow-hidden rounded-lg border border-white/10 bg-slate-800">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={listing.judul}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                parent.innerHTML = `
                                  <div class="flex h-full w-full items-center justify-center bg-slate-800">
                                    <svg class="h-6 w-6 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                `;
                              }
                            }}
                            className="h-full w-full object-cover transition-transform group-hover:scale-110"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-slate-800">
                            <Icon
                              icon="solar:gallery-linear"
                              className="text-xl text-slate-600"
                            />
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/80 backdrop-blur-sm">
                            <Icon
                              icon="solar:check-circle-bold"
                              className="text-2xl text-white drop-shadow-lg"
                            />
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Alamat */}
                    <td className="border-b border-white/5 px-3 py-2">
                      <div className="max-w-xs">
                        <p
                          className={`line-clamp-2 text-xs font-medium ${
                            isSelected ? "text-emerald-50" : "text-slate-100"
                          }`}
                        >
                          {listing.alamat_lengkap || listing.judul}
                        </p>
                        {isSelected && pilihanData && (
                          <div className="mt-1 flex items-center gap-1">
                            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[8px] font-semibold text-emerald-200">
                              {pilihanData.nama_agent
                                .split(" ")
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((s) => s[0])
                                .join("")
                                .toUpperCase()}
                            </div>
                            <span className="text-[9px] font-medium text-emerald-200">
                              {pilihanData.nama_agent}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Limit Lelang */}
                    <td className="border-b border-white/5 px-3 py-2 text-right">
                      <p
                        className={`text-xs font-semibold ${
                          isSelected ? "text-emerald-300" : "text-sky-300"
                        }`}
                      >
                        {formatHarga(listing.nilai_limit_lelang)}
                      </p>
                    </td>

                    {/* Luas Tanah */}
                    <td className="border-b border-white/5 px-3 py-2 text-right">
                      <p className="text-xs text-slate-300">
                        {formatLuas(listing.luas_tanah)}
                      </p>
                    </td>

                    {/* Aksi */}
                    <td className="border-b border-white/5 px-3 py-2 text-center">
                      {isSelected ? (
                        <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-semibold text-emerald-200 border border-emerald-500/40">
                          <Icon icon="solar:check-circle-bold" />
                          Terpilih
                        </div>
                      ) : isCurrentAgentTurn ? (
                        <button
                          onClick={() => onPilih?.(listing.id_property)}
                          className="inline-flex items-center gap-1 rounded-lg bg-sky-500/20 px-3 py-1.5 text-[10px] font-semibold text-sky-200 border border-sky-500/40 transition-all hover:bg-sky-500/30 hover:border-sky-500/60 hover:shadow-[0_0_12px_rgba(56,189,248,0.4)]"
                        >
                          <Icon icon="solar:add-circle-bold" />
                          Pilih
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-800/60 px-3 py-1.5 text-[10px] font-semibold text-slate-500 border border-slate-700/60">
                          <Icon icon="solar:lock-bold" />
                          Bukan giliran Anda
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {filteredListings.length > ITEMS_PER_PAGE && (
        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
          <div className="text-[10px] text-slate-400">
            Halaman {currentPage} dari {totalPages} · Menampilkan{" "}
            {startIndex + 1}-{Math.min(endIndex, filteredListings.length)} dari{" "}
            {filteredListings.length} unit
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-slate-900/60 text-slate-300 transition-all hover:bg-slate-800 hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Icon icon="solar:alt-arrow-left-linear" className="text-sm" />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => {
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`flex h-7 min-w-[28px] items-center justify-center rounded-lg border px-2 text-[10px] font-semibold transition-all ${
                          page === currentPage
                            ? "border-sky-500/60 bg-sky-500/20 text-sky-200"
                            : "border-white/10 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:border-white/20"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  } else if (
                    page === currentPage - 2 ||
                    page === currentPage + 2
                  ) {
                    return (
                      <span
                        key={page}
                        className="text-[10px] text-slate-600 px-1"
                      >
                        ...
                      </span>
                    );
                  }
                  return null;
                }
              )}
            </div>

            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-slate-900/60 text-slate-300 transition-all hover:bg-slate-800 hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Icon icon="solar:alt-arrow-right-linear" className="text-sm" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

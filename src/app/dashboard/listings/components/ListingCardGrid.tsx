"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { toast } from "sonner";
import PropertyCard from "@/app/properti/[slug]/components/PropertyCard";
import ListingFilters, {
  ListingFilterState,
} from "@/app/dashboard/transaksi/components/ListingFilters";
import MarkSoldDialog from "./MarkSoldDialog";
import type { Listing } from "./listings-table";
import type { PropertyItem } from "@/app/properti/[slug]/types";
import {
  getPaginationPages,
  getPaginationPagesCompact,
  smoothScrollToElement,
} from "@/lib/pagination";

const formatViews = (n: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n || 0);

function toPropertyItem(l: Listing): PropertyItem {
  return {
    id_property: l.id,
    slug: l.rawSlug,
    judul: l.title,
    kota: l.city,
    alamat_lengkap: l.address,
    harga: l.priceRaw,
    harga_promo: l.pricePromo,
    jenis_transaksi: l.transactionType,
    kategori: l.category,
    gambar: l.thumbnailUrl || "/images/hero/banner.jpg",
    foto_list: l.photos,
    luas_tanah: l.luasTanah,
    luas_bangunan: l.luasBangunan,
    kamar_tidur: l.kamarTidur,
    kamar_mandi: l.kamarMandi,
    tanggal_lelang: l.tanggalLelang,
    agent_name: l.agentName,
    agent_photo: l.agentPhoto,
    agent_office: l.agentOffice,
    is_hot_deal: !!l.isHotDeal,
  };
}

interface ListingCardGridProps {
  listings: Listing[];
  currentAgentId?: string | null;
  userRole?: string;
  currentPage: number;
  totalItems: number;
  pageSize: number;
  initialFilters: ListingFilterState;
}

function buildSearchParams(
  filters: ListingFilterState,
  page: number
): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.jenis !== "ALL") params.set("jenis", filters.jenis);
  if (filters.kategori !== "ALL") params.set("kategori", filters.kategori);
  if (filters.provinsi) params.set("provinsi", filters.provinsi);
  if (filters.kota) params.set("kota", filters.kota);
  if (filters.kecamatan) params.set("kecamatan", filters.kecamatan);
  if (filters.kelurahan) params.set("kelurahan", filters.kelurahan);
  if (page > 1) params.set("page", String(page));
  return params.toString();
}

export default function ListingCardGrid({
  listings,
  userRole,
  currentPage,
  totalItems,
  pageSize,
  initialFilters,
}: ListingCardGridProps) {
  const canManageAll = userRole === "OWNER" || userRole === "STOKER";
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [filters, setFilters] = useState<ListingFilterState>(initialFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  const [takedownOpen, setTakedownOpen] = useState(false);
  const [takingDown, setTakingDown] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);
  const prevPageRef = useRef<number>(currentPage);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // ── Debounced URL sync for text input (q field) ──
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  const pushUrl = (
    nextFilters: ListingFilterState,
    page: number,
    opts?: { manageScroll?: boolean }
  ) => {
    const qs = buildSearchParams(nextFilters, page);
    const url = qs ? `${pathname}?${qs}` : pathname;
    startTransition(() => {
      // When manageScroll = true, we handle scrolling ourselves and disable
      // Next.js's auto-scroll-to-top (which causes the "snap to top" jank).
      router.push(url, opts?.manageScroll ? { scroll: false } : undefined);
    });
  };

  const handleFilterChange = (next: ListingFilterState) => {
    setFilters(next);

    const qChanged = next.q !== filters.q;
    const otherChanged =
      next.jenis !== filters.jenis ||
      next.kategori !== filters.kategori ||
      next.provinsi !== filters.provinsi ||
      next.kota !== filters.kota ||
      next.kecamatan !== filters.kecamatan ||
      next.kelurahan !== filters.kelurahan;

    if (otherChanged) {
      // Immediate URL update for dropdown / pill changes
      if (debounceRef.current) clearTimeout(debounceRef.current);
      pushUrl(next, 1);
      return;
    }

    if (qChanged) {
      // Debounce text input
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => pushUrl(next, 1), 350);
    }
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Sync local filter state if server-provided initialFilters change
  // (e.g. back/forward navigation)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setFilters(initialFilters);
  }, [
    initialFilters.q,
    initialFilters.jenis,
    initialFilters.kategori,
    initialFilters.provinsi,
    initialFilters.kota,
    initialFilters.kecamatan,
    initialFilters.kelurahan,
  ]);

  // ── Selection (only current page ids) ──
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const visibleIds = listings.map((l) => l.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // Preview untuk dialog: ambil judul listing yang sedang terlihat di halaman ini.
  const selectedPreview = useMemo(
    () =>
      listings
        .filter((l) => selectedIds.includes(l.id))
        .slice(0, 6)
        .map((l) => ({ id: l.id, title: l.title })),
    [listings, selectedIds]
  );

  const handleConfirmSold = async () => {
    if (!selectedIds.length || marking) return;
    setMarking(true);
    try {
      const res = await fetch("/api/listings/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, status: "TERJUAL" }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Gagal memperbarui status listing.");
      }

      const count = data?.count ?? selectedIds.length;
      toast.success(`${count} properti ditandai Terjual 🎉`, {
        description: "Listing dipindahkan dari daftar aktif. Data tetap tersimpan.",
      });
      setSelectedIds([]);
      setConfirmOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Terjadi kesalahan, coba lagi."
      );
    } finally {
      setMarking(false);
    }
  };

  const handleConfirmTakedown = async () => {
    if (!selectedIds.length || takingDown) return;
    setTakingDown(true);
    try {
      const res = await fetch("/api/listings/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, status: "TARIK_LISTING" }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Gagal menarik listing.");
      }

      const count = data?.count ?? selectedIds.length;
      toast.success(`${count} listing berhasil ditarik dari penayangan.`, {
        description: "Data tetap tersimpan dan bisa diaktifkan kembali.",
      });
      setSelectedIds([]);
      setTakedownOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Terjadi kesalahan, coba lagi."
      );
    } finally {
      setTakingDown(false);
    }
  };

  // Scroll to the first card row whenever the page actually changes.
  // Runs AFTER new data has rendered, so the smooth scroll lands correctly.
  useEffect(() => {
    if (prevPageRef.current === currentPage) return;
    prevPageRef.current = currentPage;
    requestAnimationFrame(() => {
      if (gridRef.current) smoothScrollToElement(gridRef.current);
    });
  }, [currentPage]);

  // ── Pagination ──
  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === currentPage) return;
    // Disable Next.js auto-scroll. The useEffect above will smooth-scroll once
    // currentPage changes (i.e. once the new page's data has actually rendered).
    pushUrl(filters, p, { manageScroll: true });
  };

  const pageNumbers = useMemo(
    () => getPaginationPages(currentPage, totalPages),
    [currentPage, totalPages]
  );

  const pageNumbersCompact = useMemo(
    () => getPaginationPagesCompact(currentPage, totalPages),
    [currentPage, totalPages]
  );

  return (
    <div className="space-y-5">
      {/* ── Filter bar ── */}
      <ListingFilters
        value={filters}
        onChange={handleFilterChange}
        total={totalItems}
        loading={isPending}
        hideVendor
      />

      {/* ── Action bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAll}
              className="h-3.5 w-3.5 rounded border-white/20 bg-transparent text-emerald-400 focus:ring-0 accent-emerald-400 cursor-pointer"
            />
            <span>Pilih semua di halaman ini</span>
          </label>
          <span className="text-zinc-600">|</span>
          <span>
            <span className="text-emerald-400 font-semibold">{totalItems}</span> listing
            {selectedIds.length > 0 && (
              <span className="ml-1.5 text-zinc-500">· {selectedIds.length} dipilih</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => selectedIds.length > 0 && setConfirmOpen(true)}
            disabled={selectedIds.length === 0}
            className="group inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 transition-all hover:border-emerald-300/70 hover:bg-emerald-500/20 hover:shadow-[0_0_16px_rgba(16,185,129,0.35)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none"
          >
            <Icon icon="solar:verified-check-bold-duotone" className="text-sm text-emerald-300" />
            Tandai Terjual ({selectedIds.length})
          </button>

          {canManageAll && (
            <button
              onClick={() => selectedIds.length > 0 && setTakedownOpen(true)}
              disabled={selectedIds.length === 0}
              className="group inline-flex items-center gap-1.5 rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-200 transition-all hover:border-red-300/70 hover:bg-red-500/20 hover:shadow-[0_0_16px_rgba(239,68,68,0.35)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none"
            >
              <Icon icon="solar:eye-closed-bold-duotone" className="text-sm text-red-300" />
              Takedown ({selectedIds.length})
            </button>
          )}

          <Link
            href="/tambah-property"
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/60 bg-emerald-500/15 px-4 py-1.5 text-[11px] font-bold text-emerald-100 shadow-[0_0_16px_rgba(16,185,129,0.3)] transition-all hover:border-emerald-300 hover:bg-emerald-500/25 hover:shadow-[0_0_20px_rgba(16,185,129,0.5)]"
          >
            <Icon icon="solar:add-circle-bold-duotone" className="text-sm text-emerald-300" />
            Tambah property
          </Link>
        </div>
      </div>

      {/* ── Grid ── */}
      {listings.length === 0 ? (
        <EmptyState isFiltered={totalItems === 0 && initialFilters.q !== ""} />
      ) : (
        <div ref={gridRef} className="relative scroll-mt-6">
          {/* Top progress bar — appears only while transitioning */}
          <div
            className={`pointer-events-none absolute -top-2 left-0 right-0 h-[2px] overflow-hidden rounded-full bg-emerald-400/10 transition-opacity duration-200 ${
              isPending ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden
          >
            <div className="lcg-progress h-full w-2/5 rounded-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
          </div>

        <div
          key={currentPage}
          className={`lcg-page-enter grid grid-cols-1 gap-y-2 gap-x-6 sm:grid-cols-2 xl:grid-cols-3 transition-opacity duration-200 ${
            isPending ? "opacity-90" : "opacity-100"
          }`}
        >
          {listings.map((listing) => {
            const isSelected = selectedIds.includes(listing.id);
            const editUrl = `/tambah-property?id=${listing.id}&mode=edit`;

            return (
              <div key={listing.id} className="flex flex-col">
                <div
                  className={`relative z-10 transition-all duration-200 ${
                    isSelected ? "drop-shadow-[0_0_18px_rgba(52,211,153,0.45)]" : ""
                  }`}
                >
                  <PropertyCard
                    item={toPropertyItem(listing)}
                    forceAlamatLengkap
                    idBadge={listing.id}
                    onIdBadgeClick={(e, id) => {
                      navigator.clipboard.writeText(id);
                      toast.success(`ID #${id} disalin`, {
                        duration: 1500,
                        description: "ID properti tersalin ke clipboard",
                      });
                    }}
                  />
                </div>

                <div
                  className={`-mt-4 flex items-center justify-between rounded-b-2xl border-x border-b px-4 pb-3 pt-6 transition-all duration-200 ${
                    isSelected
                      ? "border-emerald-400/40 bg-[#020d08]"
                      : "border-white/8 bg-zinc-950/95"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleSelect(listing.id)}
                      aria-label={isSelected ? "Batalkan pilih" : "Pilih listing"}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-all duration-150 ${
                        isSelected
                          ? "border-emerald-400 bg-emerald-500 shadow-[0_0_10px_rgba(52,211,153,0.6)]"
                          : "border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10"
                      }`}
                    >
                      {isSelected && (
                        <svg viewBox="0 0 12 10" fill="none" className="h-2.5 w-2.5 shrink-0">
                          <path
                            d="M1 5l3.5 3.5L11 1"
                            stroke="white"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>

                    <div className="h-3 w-px bg-white/10" />

                    <div className="flex items-center gap-1.5">
                      <Icon icon="solar:eye-bold-duotone" className="text-sm text-sky-400/80" />
                      <span className="text-xs font-semibold text-zinc-300">
                        {formatViews(listing.views)}
                      </span>
                    </div>

                  </div>

                  <Link
                    href={editUrl}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold transition-all duration-150 ${
                      isSelected
                        ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
                        : "border-white/12 bg-white/5 text-zinc-300 hover:border-white/25 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon icon="solar:pen-new-square-linear" className="text-xs" />
                    Edit
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <nav
          className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-between"
          aria-label="Pagination"
        >
          <span className="text-[11px] text-zinc-500">
            Halaman{" "}
            <span className="font-semibold text-zinc-200">{currentPage}</span> dari{" "}
            <span className="font-semibold text-zinc-200">{totalPages}</span>
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1 || isPending}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon icon="solar:alt-arrow-left-linear" className="text-sm" />
            </button>

            {/* Desktop: nomor lengkap */}
            <div className="hidden items-center gap-1.5 sm:flex">
              {pageNumbers.map((n, i) =>
                n === "..." ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-xs text-zinc-500">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    onClick={() => goToPage(Number(n))}
                    disabled={isPending}
                    className={`h-8 min-w-[2rem] rounded-full px-2 text-xs font-bold transition-all disabled:cursor-wait ${
                      n === currentPage
                        ? "bg-emerald-500 text-black shadow-[0_0_12px_rgba(52,211,153,0.6)]"
                        : "bg-white/5 text-zinc-300 hover:bg-white/10"
                    }`}
                  >
                    {n}
                  </button>
                )
              )}
            </div>

            {/* Mobile: nomor ringkas — tetap muat di layar kecil */}
            <div className="flex items-center gap-1 sm:hidden">
              {pageNumbersCompact.map((n, i) =>
                n === "..." ? (
                  <span key={`m-ellipsis-${i}`} className="px-0.5 text-xs text-zinc-500">
                    …
                  </span>
                ) : (
                  <button
                    key={`m-${n}`}
                    onClick={() => goToPage(Number(n))}
                    disabled={isPending}
                    className={`h-8 min-w-[2rem] rounded-full px-2 text-xs font-bold transition-all disabled:cursor-wait ${
                      n === currentPage
                        ? "bg-emerald-500 text-black shadow-[0_0_12px_rgba(52,211,153,0.6)]"
                        : "bg-white/5 text-zinc-300 hover:bg-white/10"
                    }`}
                  >
                    {n}
                  </button>
                )
              )}
            </div>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages || isPending}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon icon="solar:alt-arrow-right-linear" className="text-sm" />
            </button>
          </div>
        </nav>
      )}

      {/* ── Premium confirm: tandai Terjual ── */}
      <MarkSoldDialog
        open={confirmOpen}
        count={selectedIds.length}
        preview={selectedPreview}
        loading={marking}
        onConfirm={handleConfirmSold}
        onCancel={() => !marking && setConfirmOpen(false)}
      />

      {/* ── Takedown confirm (OWNER / STOKER only) ── */}
      <MarkSoldDialog
        open={takedownOpen}
        count={selectedIds.length}
        preview={selectedPreview}
        loading={takingDown}
        onConfirm={handleConfirmTakedown}
        onCancel={() => !takingDown && setTakedownOpen(false)}
        variant="takedown"
      />
    </div>
  );
}

function EmptyState({ isFiltered }: { isFiltered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-white/5 bg-white/[0.02] py-24 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 shadow-[0_0_40px_rgba(52,211,153,0.08)]">
        <Icon icon="solar:buildings-bold-duotone" className="text-4xl text-white/20" />
      </div>
      <h3 className="mb-2 text-base font-bold text-white/40">
        {isFiltered ? "Tidak ada listing yang cocok" : "Belum ada listing"}
      </h3>
      <p className="mb-8 text-sm text-white/20">
        {isFiltered ? "Coba ubah filter pencarian" : "Mulai dengan menambah listing pertama"}
      </p>
      <Link
        href="/tambah-property"
        className="inline-flex items-center gap-2 rounded-full border border-emerald-400/60 bg-emerald-500/15 px-6 py-2.5 text-sm font-bold text-emerald-200 shadow-[0_0_20px_rgba(52,211,153,0.3)] transition-all hover:bg-emerald-500/25"
      >
        <Icon icon="solar:add-circle-bold-duotone" className="text-base" />
        Tambah Property
      </Link>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { toast } from "sonner";
/**
 * Kartu yang dipakai di sini adalah kartu YANG SAMA dengan halaman publik
 * (/properti, /Jual, /Lelang, /Sewa). Sebelumnya dasbor memanggil kartu lama
 * yang tinggal di dalam folder halaman kategori, dan dua kartu untuk benda yang
 * sama pasti menyimpang: kos tampil dengan grid KT/KM/LT/LB yang seluruhnya
 * "-", apartemen sewa kehilangan tipe unit & kondisi interior, dan aset lelang
 * tidak menunjukkan penurunan limit. Agent jadi menilai listingnya dari
 * tampilan yang tidak pernah dilihat calon pembeli.
 */
import { PropertyCard, getPropertyUrl } from "@/components/property/PropertyCard";
import ListingFilterBar from "./ListingFilterBar";
import MarkSoldDialog from "./MarkSoldDialog";
import type { DashboardListing } from "../lib/listing-item";
import {
  buildListingQuery,
  FILTER_KOSONG,
  jumlahFilterAktif,
  type ListingFilters,
} from "../lib/filters";
import {
  getPaginationPages,
  getPaginationPagesCompact,
  smoothScrollToElement,
} from "@/lib/pagination";

const formatViews = (n: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n || 0);

/** Sidik jari isi filter — dua state dianggap sama bila hasilnya sama. */
const sidikFilter = (f: ListingFilters) =>
  [f.q, f.jenis, f.kategori, f.provinsi, f.kota, f.kecamatan, f.kelurahan, f.sort].join("|");

interface ListingCardGridProps {
  listings: DashboardListing[];
  currentAgentId?: string | null;
  userRole?: string;
  /** jabatan_agent_enum — sumber wewenang OWNER/STOKER. */
  currentJabatan?: string;
  currentPage: number;
  totalItems: number;
  pageSize: number;
  initialFilters: ListingFilters;
  jenisCounts?: Record<string, number>;
  kategoriCounts?: Record<string, number>;
}

export default function ListingCardGrid({
  listings,
  currentJabatan,
  currentPage,
  totalItems,
  pageSize,
  initialFilters,
  jenisCounts,
  kategoriCounts,
}: ListingCardGridProps) {
  // Takedown tetap aksi manajemen (Owner & Stoker), bukan aksi agent biasa.
  // Yang diperbaiki: penilaiannya dari `jabatan`, bukan dari `userRole` yang
  // isinya USER|AGENT sehingga perbandingannya tidak pernah benar dan tombol
  // ini tidak pernah muncul untuk siapa pun.
  const jabatan = (currentJabatan || "").toUpperCase();
  const canManageAll = jabatan === "OWNER" || jabatan === "STOKER";
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [filters, setFilters] = useState<ListingFilters>(initialFilters);
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
  /**
   * Sidik jari filter yang terakhir KITA dorong ke URL.
   *
   * Dipakai untuk membedakan dua hal yang sama-sama mengubah `initialFilters`:
   * gema dari navigasi kita sendiri (harus diabaikan) dan navigasi dari luar —
   * tombol back/forward (harus diikuti). Tanpa pembeda ini, gema yang datang
   * ~350ms setelah ketikan terakhir menimpa huruf yang diketik selama
   * perjalanan itu, dan kotak cari terlihat "memuntahkan" ketikan pemakai.
   */
  const sidikTerakhir = useRef<string>(sidikFilter(initialFilters));

  const pushUrl = (
    nextFilters: ListingFilters,
    page: number,
    opts?: { manageScroll?: boolean }
  ) => {
    sidikTerakhir.current = sidikFilter(nextFilters);
    const qs = buildListingQuery(nextFilters, page);
    const url = qs ? `${pathname}?${qs}` : pathname;
    startTransition(() => {
      // When manageScroll = true, we handle scrolling ourselves and disable
      // Next.js's auto-scroll-to-top (which causes the "snap to top" jank).
      router.push(url, opts?.manageScroll ? { scroll: false } : undefined);
    });
  };

  const handleFilterChange = (next: ListingFilters) => {
    setFilters(next);

    const qChanged = next.q !== filters.q;
    const otherChanged =
      next.jenis !== filters.jenis ||
      next.kategori !== filters.kategori ||
      next.provinsi !== filters.provinsi ||
      next.kota !== filters.kota ||
      next.kecamatan !== filters.kecamatan ||
      next.kelurahan !== filters.kelurahan ||
      next.sort !== filters.sort;

    if (otherChanged) {
      // Immediate URL update for dropdown changes
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

  // Ikuti filter dari server HANYA kalau perubahannya datang dari luar
  // (back/forward, atau tautan langsung) — bukan gema dorongan kita sendiri.
  useEffect(() => {
    const sidik = sidikFilter(initialFilters);
    if (sidik === sidikTerakhir.current) return;
    sidikTerakhir.current = sidik;
    setFilters(initialFilters);
  }, [
    initialFilters.q,
    initialFilters.jenis,
    initialFilters.kategori,
    initialFilters.provinsi,
    initialFilters.kota,
    initialFilters.kecamatan,
    initialFilters.kelurahan,
    initialFilters.sort,
  ]);

  // ── Selection (only current page ids) ──
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const visibleIds = listings.map((l) => String(l.id_property));
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
        .filter((l) => selectedIds.includes(String(l.id_property)))
        .slice(0, 6)
        .map((l) => ({ id: String(l.id_property), title: l.judul })),
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
    <div
      // Ruang cadangan di dasar halaman saat toolbar mengambang tampil, supaya
      // ia tidak menutupi baris paginasi persis ketika pemakai men-scroll
      // sampai ujung daftar.
      className={`space-y-4 transition-[padding] duration-300 ${
        selectedIds.length > 0 ? "pb-20" : "pb-0"
      }`}
    >
      {/* ── Filter bar ── */}
      <ListingFilterBar
        value={filters}
        onChange={handleFilterChange}
        total={totalItems}
        loading={isPending}
        jenisCounts={jenisCounts}
        kategoriCounts={kategoriCounts}
      />

      {/* ── Action bar ──
          Aksi bulk (Tandai Terjual/Takedown) SENGAJA tidak ditaruh di sini
          lagi. Kartu yang dipilih ada di tengah/bawah daftar, baris ini di
          paling atas — memilih lalu menekan aksinya berarti scroll balik ke
          puncak halaman setiap kali. Sekarang keduanya hidup di toolbar
          mengambang (di bawah) yang ikut kemanapun pemakai men-scroll. */}
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
          {selectedIds.length > 0 && (
            <>
              <span className="text-zinc-600">|</span>
              <span className="text-emerald-400 font-semibold">
                {selectedIds.length} dipilih
              </span>
            </>
          )}
        </div>

        <Link
          href="/tambah-property"
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/60 bg-emerald-500/15 px-4 py-1.5 text-[11px] font-bold text-emerald-100 shadow-[0_0_16px_rgba(16,185,129,0.3)] transition-all hover:border-emerald-300 hover:bg-emerald-500/25 hover:shadow-[0_0_20px_rgba(16,185,129,0.5)]"
        >
          <Icon icon="solar:add-circle-bold-duotone" className="text-sm text-emerald-300" />
          Tambah property
        </Link>
      </div>

      {/* ── Grid ── */}
      {listings.length === 0 ? (
        <EmptyState
          isFiltered={jumlahFilterAktif(filters) > 0}
          onReset={() => handleFilterChange({ ...FILTER_KOSONG })}
        />
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

          {/* items-stretch + h-full berantai sampai ke kartunya: PropertyCard
              memakai `flex flex-col h-full` supaya footer agent menempel di
              dasar. Tanpa rantai tinggi ini, kartu dengan judul dua baris jadi
              lebih jangkung dari tetangganya dan baris grid terlihat gompal. */}
          <div
            key={currentPage}
            className={`lcg-page-enter grid grid-cols-1 items-stretch gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3 transition-opacity duration-200 ${
              isPending ? "opacity-90" : "opacity-100"
            }`}
          >
            {listings.map((listing) => {
              const id = String(listing.id_property);
              const isSelected = selectedIds.includes(id);
              const editUrl = `/tambah-property?id=${id}&mode=edit`;

              return (
                <div key={id} className="flex h-full flex-col">
                  {/* Kartu = tautan ke halaman detail publik, sama seperti yang
                      dilihat calon pembeli. Aksi dasbor (pilih & edit) sengaja
                      berada di BAWAH tautan, bukan di dalamnya: tombol di dalam
                      anchor berarti setiap klik salah sasaran akan pindah
                      halaman dan membatalkan pilihan yang sedang disusun. */}
                  <Link
                    href={getPropertyUrl(listing)}
                    className={`relative z-10 block flex-1 rounded-3xl transition-all duration-200 ${
                      isSelected ? "drop-shadow-[0_0_18px_rgba(52,211,153,0.45)]" : ""
                    }`}
                  >
                    <PropertyCard item={listing} />
                  </Link>

                  <div
                    className={`-mt-4 flex items-center justify-between rounded-b-3xl border-x border-b px-4 pb-3 pt-6 transition-all duration-200 ${
                      isSelected
                        ? "border-emerald-400/40 bg-[#020d08]"
                        : "border-white/5 bg-zinc-950/95"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleSelect(id)}
                        aria-label={isSelected ? "Batalkan pilih" : "Pilih listing"}
                        aria-pressed={isSelected}
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

                      <div className="flex items-center gap-1.5" title="Jumlah dilihat">
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
                          : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/25 hover:bg-white/10 hover:text-white"
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

      {/* ── Toolbar mengambang ──
          Menempel di BAWAH LAYAR (bukan di dalam alur halaman), muncul begitu
          ada kartu yang dicentang dan ikut kemanapun pemakai men-scroll. Ini
          yang membuat aksinya reachable dari kartu manapun tanpa harus
          scroll balik ke atas — beda dengan baris aksi lama yang diam di
          puncak halaman padahal kartunya bisa saja tiga layar ke bawah. */}
      <div
        className={`fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 transition-all duration-300 ${
          selectedIds.length > 0
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0"
        }`}
      >
        <div
          role="toolbar"
          aria-label="Aksi untuk listing terpilih"
          className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-white/10 bg-[#0a0f0d]/95 p-1.5 pl-3 shadow-[0_20px_60px_-8px_rgba(0,0,0,0.75)] backdrop-blur-xl"
        >
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            aria-label="Batalkan semua pilihan"
            title="Batalkan pilihan"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Icon icon="mdi:close" className="text-sm" />
          </button>

          <span className="pr-1 text-xs font-bold text-emerald-300">
            {selectedIds.length} dipilih
          </span>

          <span className="h-5 w-px shrink-0 bg-white/10" />

          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 transition-all hover:border-emerald-300/70 hover:bg-emerald-500/20 hover:shadow-[0_0_16px_rgba(16,185,129,0.35)]"
          >
            <Icon icon="solar:verified-check-bold-duotone" className="text-sm text-emerald-300" />
            Tandai Terjual
          </button>

          {canManageAll && (
            <button
              type="button"
              onClick={() => setTakedownOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-200 transition-all hover:border-red-300/70 hover:bg-red-500/20 hover:shadow-[0_0_16px_rgba(239,68,68,0.35)]"
            >
              <Icon icon="solar:eye-closed-bold-duotone" className="text-sm text-red-300" />
              Takedown
            </button>
          )}
        </div>
      </div>

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

function EmptyState({
  isFiltered,
  onReset,
}: {
  isFiltered: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-white/5 bg-white/5 py-24 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 shadow-[0_0_40px_rgba(52,211,153,0.08)]">
        <Icon icon="solar:buildings-bold-duotone" className="text-4xl text-white/20" />
      </div>
      <h3 className="mb-2 text-base font-bold text-white/40">
        {isFiltered ? "Tidak ada listing yang cocok" : "Belum ada listing"}
      </h3>
      <p className="mb-8 text-sm text-white/20">
        {isFiltered
          ? "Filter yang aktif menyaring semuanya. Longgarkan salah satunya."
          : "Mulai dengan menambah listing pertama"}
      </p>

      {/* Jalan keluar yang benar berbeda menurut sebabnya: daftar kosong
          karena filter butuh tombol hapus filter, bukan ajakan menambah
          properti yang tidak menyelesaikan apa pun. */}
      {isFiltered ? (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-400/60 bg-emerald-500/15 px-6 py-2.5 text-sm font-bold text-emerald-200 shadow-[0_0_20px_rgba(52,211,153,0.3)] transition-all hover:bg-emerald-500/25"
        >
          <Icon icon="solar:restart-bold" className="text-base" />
          Hapus semua filter
        </button>
      ) : (
        <Link
          href="/tambah-property"
          className="inline-flex items-center gap-2 rounded-full border border-emerald-400/60 bg-emerald-500/15 px-6 py-2.5 text-sm font-bold text-emerald-200 shadow-[0_0_20px_rgba(52,211,153,0.3)] transition-all hover:bg-emerald-500/25"
        >
          <Icon icon="solar:add-circle-bold-duotone" className="text-base" />
          Tambah Property
        </Link>
      )}
    </div>
  );
}

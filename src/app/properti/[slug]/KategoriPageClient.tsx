"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import KategoriHero from "./components/KategoriHero";
import KategoriGrid from "./components/KategoriGrid";
import FilterCommandBar from "@/components/listing/filterbar/FilterCommandBar";
import TempatAktifBar from "@/components/listing/TempatAktifBar";
import type { TabTransaksi } from "@/components/listing/filterbar/TransactionSegments";
import { parseCategoryDbList } from "@/lib/propertyType";
import type { KategoriPageProps } from "./types";
import { smoothScrollToElement } from "@/lib/pagination";
import { KATEGORI_TO_SLUG } from "./constants";

export default function KategoriPageClient({
  slug,
  label,
  initialData,
  pagination,
  activeTipe,
  konteks,
  tabCounts,
  tempat = null,
  radiusTempat = null,
  tempatDitebak = false,
  kueriAsli = null,
  catatanTempat = null,
}: KategoriPageProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const sp       = useSearchParams();
  const gridRef  = useRef<HTMLDivElement>(null);
  const prevPageRef = useRef<number>(pagination.currentPage);

  const navigate = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(sp.toString());
    Object.entries(updates).forEach(([k, v]) => {
      if (v === undefined) params.delete(k);
      else params.set(k, v);
    });
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  /**
   * Kategori properti hidup di PATH (`/properti/rumah`), bukan hanya di query.
   * Jadi saat pemakai mengganti tipe aset di bar filter, path-nya ikut pindah —
   * kalau tidak, memilih "Apartemen" di `/properti/rumah` menampilkan apartemen
   * di halaman yang judulnya masih "Rumah".
   *
   * Aturannya sama persis dengan tombol Cari di hero, supaya dua jalan menuju
   * hasil yang sama menghasilkan URL yang sama:
   *   tepat 1 tipe  → pindah ke slug tipe itu, param `kategori` dibuang (URL rapi)
   *   lebih dari 1  → `/properti/semua` + param `kategori`
   *   tidak ada     → tetap di slug sekarang
   */
  const resolvePath = useCallback(
    (paramsBaru: URLSearchParams): string | null => {
      const dipilih = parseCategoryDbList(paramsBaru.get("kategori"));

      if (dipilih.length === 0) return null;

      if (dipilih.length === 1) {
        const tujuan = KATEGORI_TO_SLUG[dipilih[0]];
        // Kategori tanpa halaman sendiri (mis. KOS) tetap dilayani lewat param
        // di /properti/semua — bukan diarahkan ke slug yang tidak ada.
        if (!tujuan) return `/properti/semua`;
        paramsBaru.delete("kategori");
        return `/properti/${tujuan}`;
      }

      return "/properti/semua";
    },
    []
  );

  // Smooth-scroll to the first card row whenever the page/tipe/sort changes
  // (i.e. once the new data has rendered).
  useEffect(() => {
    if (prevPageRef.current === pagination.currentPage) return;
    prevPageRef.current = pagination.currentPage;
    requestAnimationFrame(() => {
      if (gridRef.current) smoothScrollToElement(gridRef.current);
    });
  }, [pagination.currentPage]);

  return (
    <main className="bg-[#0F0F0F] min-h-screen pb-24">
      {/* Hero = pintu masuk pencarian (sekali pakai, lalu ter-scroll pergi).
          Bar di bawahnya = lapisan menyaring yang ikut menempel selama menelusuri
          hasil. Keduanya membaca & menulis param URL yang sama, jadi apa pun
          yang diisi di hero langsung tercermin sebagai chip di bar. */}
      <KategoriHero
        slug={slug}
        label={label}
        tabCounts={tabCounts}
        tempatAwal={tempat}
      />

      <FilterCommandBar
        konteks={konteks}
        tabAktif={(activeTipe || "semua") as TabTransaksi}
        tabCounts={tabCounts}
        totalHasil={pagination.totalItems}
        namaTempat={tempat?.nama ?? null}
        resolvePath={resolvePath}
      />

      {(tempat || catatanTempat) && (
        <div className="container mx-auto max-w-screen-xl px-5 sm:px-8 md:px-10 mt-5">
          <TempatAktifBar
            tempat={tempat}
            radius={radiusTempat ?? undefined}
            jumlah={pagination.totalItems}
            ditebak={tempatDitebak}
            kueriAsli={kueriAsli ?? undefined}
            catatan={catatanTempat}
          />
        </div>
      )}

      <div
        className="container mx-auto max-w-screen-xl px-5 sm:px-8 md:px-10 mt-5"
        ref={gridRef}
      >
        <KategoriGrid
          items={initialData}
          pagination={pagination}
          activeTipe={activeTipe}
          onPage={(p) => navigate({ page: String(p) })}
          onResetTipe={() => navigate({ tipe: undefined, page: undefined })}
        />
      </div>

      <style jsx global>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </main>
  );
}

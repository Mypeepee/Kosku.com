"use client";

import { Icon } from "@iconify/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  catatanUrut,
  labelSort,
  opsiUrut,
  parseSort,
  sortMenyaring,
  type KonteksListing,
  type SortKey,
} from "@/lib/listingSort";

/**
 * Kontrol "Urutkan" bersama untuk semua halaman daftar.
 *
 * Perilaku yang sengaja dipilih, karena versi lamanya menyalahi semuanya:
 *
 *  • TIDAK toggle. Menekan opsi yang sedang aktif tidak menghapusnya. Versi
 *    lama menghapus parameternya, dan karena default-nya "termahal", menekan
 *    "Termurah" dua kali diam-diam membalik daftar jadi termahal tanpa satu
 *    tombol pun terlihat aktif.
 *  • Selalu ada yang aktif. Urutan default ikut ditandai, jadi pemakai tahu
 *    daftar ini sedang diurutkan berdasarkan apa — bukan menebak.
 *  • Menulis ke URL, bukan state lokal. Urutan jadi bisa di-bookmark, dibagikan,
 *    dan tahan tombol back. (Sidebar /Sewa versi lama memakai useState, jadi
 *    tombolnya tidak melakukan apa pun.)
 *  • Reset ke halaman 1. Tanpa ini, mengganti urutan sambil berada di halaman 4
 *    mendarat di tengah daftar yang isinya sudah lain sama sekali.
 *  • Parameter lain dipertahankan apa adanya — mengurutkan tidak boleh
 *    menghapus filter yang sudah susah payah dipasang pemakai.
 */
export default function SortSelect({
  konteks,
  baseUrl,
  /** "penuh" untuk sidebar (daftar radio), "ringkas" untuk header (dropdown). */
  varian = "ringkas",
  className = "",
  namaTempat = null,
}: {
  konteks: KonteksListing;
  baseUrl: string;
  varian?: "ringkas" | "penuh";
  className?: string;
  /**
   * Nama tempat yang sedang disaring. Opsional: keberadaan filternya dibaca
   * sendiri dari `?dekat=` di URL, jadi opsi "Terdekat" tetap muncul walau
   * pemanggilnya tidak sempat mengoper nama — hanya labelnya yang lebih
   * pendek.
   */
  namaTempat?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [buka, setBuka] = useState(false);
  const wadahRef = useRef<HTMLDivElement>(null);
  const tombolRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  // "Terdekat" hanya ada artinya ketika sebuah tempat sedang dipilih —
  // dekat dari mana? Keberadaannya dibaca dari URL supaya komponen ini tidak
  // bergantung pada rantai prop yang panjang.
  const tempatAktif: string | true | null = searchParams.get("dekat")
    ? namaTempat || true
    : null;

  const opsi = opsiUrut(konteks, tempatAktif);
  const aktif = parseSort(searchParams.get("sort") ?? undefined, konteks, tempatAktif);
  const labelAktif = labelSort(aktif, konteks, tempatAktif);
  // Di daftar campuran (tab "Semua"), sebagian urutan membandingkan hal yang
  // satuannya memang berbeda. Peringatannya ikut ditampilkan supaya hasil yang
  // terlihat aneh terbaca sebagai konsekuensi, bukan kerusakan.
  const catatan = catatanUrut(aktif, konteks);

  const pilih = useCallback(
    (nilai: SortKey) => {
      setBuka(false);
      // Sudah aktif → tidak perlu navigasi sama sekali. Mendorong URL yang
      // identik tetap memicu render ulang server dan bikin daftar berkedip.
      if (nilai === aktif) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("sort", nilai);
      params.set("page", "1");
      router.push(`${baseUrl}?${params.toString()}`, { scroll: false });
    },
    [aktif, baseUrl, router, searchParams],
  );

  // Esc menutup, dan fokus dikembalikan ke tombolnya — kalau tidak, fokus
  // hilang ke <body> dan navigasi keyboard harus mulai dari awal halaman.
  useEffect(() => {
    if (!buka) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setBuka(false);
      tombolRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!wadahRef.current?.contains(e.target as Node)) setBuka(false);
    };
    document.addEventListener("keydown", onKey);
    // `pointerdown` (bukan click) supaya menu tertutup begitu jari menyentuh
    // luar area, bukan setelah jari diangkat.
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [buka]);

  /* ── Varian PENUH: daftar radio, dipakai di sidebar & laci filter mobile ── */
  if (varian === "penuh") {
    return (
      <div className={className} role="radiogroup" aria-label="Urutkan daftar">
        <div className="space-y-1">
          {opsi.map((o) => {
            const dipilih = o.value === aktif;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={dipilih}
                onClick={() => pilih(o.value)}
                className={`w-full flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  dipilih
                    ? "border-primary/40 bg-primary/10"
                    : "border-transparent hover:border-white/10 hover:bg-white/5"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    dipilih ? "border-primary" : "border-gray-600"
                  }`}
                  aria-hidden="true"
                >
                  {dipilih && (
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-sm leading-tight ${
                      dipilih ? "font-bold text-white" : "text-gray-300"
                    }`}
                  >
                    {o.label}
                  </span>
                  {/* Penjelas selalu tampil, bukan cuma saat hover: di layar
                      sentuh hover tidak ada, dan "Sudah berlalu" tanpa
                      penjelasan terbaca seperti filter yang rusak. */}
                  <span className="mt-0.5 block text-[11px] leading-snug text-gray-500">
                    {o.hint}
                  </span>
                </span>
                <Icon
                  icon={o.icon}
                  className={`ml-auto shrink-0 text-base ${
                    dipilih ? "text-primary" : "text-gray-600"
                  }`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── Varian RINGKAS: dropdown, dipakai di header hasil ─────────────────── */
  return (
    <div ref={wadahRef} className={`relative ${className}`}>
      <button
        ref={tombolRef}
        type="button"
        onClick={() => setBuka((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={buka}
        aria-controls={buka ? menuId : undefined}
        className="flex w-full items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm font-bold text-white transition-colors hover:border-primary/40 hover:bg-white/10 sm:w-auto"
      >
        <Icon
          icon="solar:sort-vertical-bold-duotone"
          className="shrink-0 text-base text-primary"
          aria-hidden="true"
        />
        {/* Kata "Urutkan:" disembunyikan di layar sempit — ikonnya sudah
            menyatakan hal yang sama, dan di bar filter lengket ruang itu
            dibutuhkan segmen tab di sebelahnya. */}
        <span className="hidden font-medium text-gray-400 sm:inline">Urutkan:</span>
        <span className="truncate">{labelAktif}</span>
        <Icon
          icon="solar:alt-arrow-down-linear"
          className={`ml-auto shrink-0 text-gray-400 transition-transform ${
            buka ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {buka && (
        <div
          id={menuId}
          role="listbox"
          aria-label="Urutkan daftar"
          // `right-0` di layar kecil supaya menu tidak keluar tepi kanan saat
          // tombolnya berada di ujung baris header.
          className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#161616] shadow-2xl sm:left-0 sm:right-auto"
        >
          {opsi.map((o) => {
            const dipilih = o.value === aktif;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={dipilih}
                onClick={() => pilih(o.value)}
                className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                  dipilih
                    ? "bg-primary/10"
                    : "hover:bg-white/5"
                }`}
              >
                <Icon
                  icon={o.icon}
                  className={`mt-0.5 shrink-0 text-lg ${
                    dipilih ? "text-primary" : "text-gray-500"
                  }`}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm leading-tight ${
                      dipilih ? "font-bold text-primary" : "text-gray-200"
                    }`}
                  >
                    {o.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-gray-500">
                    {o.hint}
                  </span>
                </span>
                {dipilih && (
                  <Icon
                    icon="solar:check-circle-bold"
                    className="mt-0.5 shrink-0 text-base text-primary"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}

          {/* Catatan ditaruh DI DALAM menu, bukan sebagai paragraf di bawah
              tombol. Dua alasan: pemakai membacanya tepat saat memilih, dan
              kontrol ringkas ini dipakai di dalam baris bertinggi tetap (header
              hasil & bar filter lengket) — paragraf di luar menu akan
              merenggangkan baris itu setiap kali urutan tertentu aktif.

              Isinya: sebagian pilihan urut di /Lelang sekaligus mempersempit
              hasil (menyembunyikan itu membuat jumlah hasil terlihat "hilang"
              tanpa sebab), dan sebagian urutan di tab campuran membandingkan
              satuan yang memang berbeda. */}
          {(sortMenyaring(aktif) || catatan) && (
            <p className="flex items-start gap-1.5 border-t border-white/10 bg-white/5 px-4 py-2.5 text-[11px] leading-snug text-amber-300/80">
              <Icon
                icon="solar:info-circle-linear"
                className="mt-px shrink-0 text-xs"
                aria-hidden="true"
              />
              <span>
                {sortMenyaring(aktif)
                  ? "Urutan ini juga menyaring jadwal lelang."
                  : catatan}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

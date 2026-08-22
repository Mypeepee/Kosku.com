"use client";

import { useEffect, useRef, useState } from "react";

export interface HasilHitung {
  total: number | null;
  tabs: Record<"semua" | "jual" | "lelang" | "sewa", number> | null;
}

/**
 * Pratinjau jumlah hasil untuk kriteria yang BELUM diterapkan.
 *
 * Dipakai tombol "Lihat N properti" di laci filter, supaya pemakai tahu
 * kombinasinya menghasilkan nol SEBELUM menutup panel dan menemukan grid
 * kosong.
 *
 * Dua hal yang membuat ini tidak menjadi sumber bug:
 *  • DEBOUNCE — mengetik "500000000" di kolom harga akan memicu sembilan
 *    permintaan tanpa jeda ini.
 *  • ABORT — respons yang berangkat lebih dulu bisa tiba belakangan (jaringan
 *    tidak berurutan). Tanpa membatalkan yang lama, angka di tombol bisa
 *    "mundur" ke hasil kriteria sebelumnya dan menetap di sana.
 */
export function useResultCount(
  query: string,
  aktif: boolean,
  jeda = 250
): { data: HasilHitung; memuat: boolean } {
  const [data, setData] = useState<HasilHitung>({ total: null, tabs: null });
  const [memuat, setMemuat] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!aktif) {
      abortRef.current?.abort();
      setMemuat(false);
      return;
    }

    const timer = window.setTimeout(() => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setMemuat(true);

      fetch(`/api/listings/count?${query}`, { signal: ac.signal })
        .then((r) => (r.ok ? r.json() : { total: null, tabs: null }))
        .then((json: HasilHitung) => {
          if (ac.signal.aborted) return;
          setData({ total: json?.total ?? null, tabs: json?.tabs ?? null });
          setMemuat(false);
        })
        .catch(() => {
          // AbortError termasuk di sini dan memang tidak perlu ditangani:
          // permintaan penggantinya sudah berjalan dan akan mengisi state.
          if (!ac.signal.aborted) setMemuat(false);
        });
    }, jeda);

    return () => window.clearTimeout(timer);
  }, [query, aktif, jeda]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { data, memuat };
}

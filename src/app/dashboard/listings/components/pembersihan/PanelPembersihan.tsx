"use client";

/**
 * Pita "Pembersihan Data" di /dashboard/listings — hanya dirender untuk OWNER
 * (penilaian jabatannya di listings-page.tsx, dan diperiksa ULANG di server
 * pada setiap panggilan API — pita yang tidak dirender bukan pengaman).
 *
 * Kenapa pita, bukan kartu kelima di baris metrik: baris itu sudah pas empat
 * kolom, dan menyelipkan aksi merusak-data di sebelah "Total Listings" membuat
 * ia terbaca seperti angka biasa yang boleh diklik sambil lalu.
 *
 * Angkanya diambil dari browser sesudah halaman tampil, bukan ikut render
 * server: menghitung dua aturan atas 121 ribu baris menambah waktu tunggu
 * SETIAP kali dasbor dibuka, demi angka yang hanya dipakai kalau pitanya
 * benar-benar ditekan.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import type { RingkasanPembersihan } from "@/lib/pembersihanListing";
import DialogPembersihan from "./DialogPembersihan";

const angka = (n: number) => new Intl.NumberFormat("id-ID").format(n);

export default function PanelPembersihan() {
  const router = useRouter();
  const [ringkasan, setRingkasan] = useState<RingkasanPembersihan | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const muat = useCallback(async () => {
    try {
      const res = await fetch("/api/listings/pembersihan");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memuat ringkasan.");
      setRingkasan(data as RingkasanPembersihan);
      setGalat(null);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal memuat ringkasan.");
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  const total = ringkasan?.total ?? 0;
  const tinjau = ringkasan?.totalTinjau ?? 0;
  const bersih = !!ringkasan?.siap && total === 0 && tinjau === 0;

  return (
    <>
      <div
        className={`mx-auto flex max-w-6xl flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${
          bersih
            ? "border-emerald-400/20 bg-emerald-500/5"
            : "border-amber-400/25 bg-amber-500/[0.07]"
        }`}
      >
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${
            bersih
              ? "border-emerald-400/30 bg-emerald-500/10"
              : "border-amber-400/30 bg-amber-500/10"
          }`}
        >
          <Icon
            icon={bersih ? "solar:check-circle-bold-duotone" : "solar:broom-bold-duotone"}
            className={`text-lg ${bersih ? "text-emerald-300" : "text-amber-300"}`}
          />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-[12px] font-bold text-white">
            Pembersihan data
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-zinc-400">
              Owner
            </span>
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">
            {galat ? (
              <span className="text-red-300">{galat}</span>
            ) : !ringkasan ? (
              "Memeriksa listing yang bukan properti…"
            ) : !ringkasan.siap ? (
              <span className="text-amber-200">
                Migrasi database belum dijalankan — buka untuk melihat
                perintahnya.
              </span>
            ) : bersih ? (
              "Tidak ada baris bukan-properti yang terdeteksi. Cari manual kalau ada yang lolos."
            ) : (
              <>
                <b className="text-amber-200">{angka(total)} baris</b> siap
                dibersihkan — kendaraan, mesin, hewan, komoditas, inventaris —
                dari {angka(ringkasan.totalListing)} listing.
                {tinjau > 0 && (
                  <>
                    {" "}
                    <b className="text-sky-200">{angka(tinjau)} baris</b> lagi
                    perlu ditinjau sendiri: judulnya menyebut properti, tapi
                    luasnya kosong.
                  </>
                )}
              </>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-[11px] font-bold transition-all ${
            bersih
              ? "border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10"
              : "border-amber-400/60 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25"
          }`}
        >
          <Icon icon="solar:tuning-square-2-bold-duotone" className="text-sm" />
          {bersih ? "Tinjau data" : "Tinjau & bersihkan"}
        </button>
      </div>

      <DialogPembersihan
        open={open}
        ringkasan={ringkasan}
        onClose={() => setOpen(false)}
        onSelesai={() => {
          void muat();
          // Daftar kartu di belakang dialog dirender server — tanpa ini, baris
          // yang baru saja dihapus masih terpampang di sana.
          router.refresh();
        }}
      />
    </>
  );
}

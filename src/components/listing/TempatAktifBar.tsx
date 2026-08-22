"use client";

/**
 * Bilah "sedang mencari di sekitar X" — dirender di atas daftar hasil.
 *
 * ── EMPAT HAL YANG WAJIB IA SAMPAIKAN ───────────────────────────────────────
 *   1. TEMPAT APA yang dipakai. Terutama saat servernya yang MENEBAK: orang
 *      mengetik "deket unesa", dan diam-diam kami mengubah pertanyaannya jadi
 *      "dalam radius 5 km dari Universitas Negeri Surabaya". Tebakan yang tidak
 *      diberitahukan adalah tebakan yang tidak bisa dikoreksi.
 *   2. RADIUSNYA BERAPA, dan bisa diubah. "Dekat" berarti hal yang berbeda bagi
 *      pejalan kaki dan pengendara motor, dan kami tidak tahu yang mana pembacanya.
 *   3. CARA MEMBATALKANNYA, dalam satu ketukan.
 *   4. JALAN KELUAR saat hasilnya kosong — pintu buntu tanpa pintu adalah
 *      kerusakan, bukan jawaban.
 *
 * ── CATATAN TATA LETAK ──────────────────────────────────────────────────────
 * Versi pertama memakai satu baris `flex-wrap`: ikon, teks `flex-1 min-w-0`,
 * lalu tombol-tombol. Hasilnya rusak di layar sempit dengan cara yang khas —
 * kelompok tombol punya lebar minimum yang besar (isinya lima tombol berlebar
 * tetap) sementara blok teks boleh menyusut sampai NOL, jadi seluruh tekanan
 * jatuh ke teksnya: judul terpecah satu kata per baris menjadi kolom setinggi
 * layar, dan tombolnya tetap utuh di sebelahnya.
 *
 * Sekarang tata letaknya EKSPLISIT per ukuran layar, bukan hasil tawar-menawar
 * antar-anak flex:
 *   < sm : dua baris. Identitas di atas (dengan tombol tutup di kanan),
 *          pengatur radius di baris sendiri yang boleh digeser.
 *   ≥ sm : satu baris. Teks memegang ruang sisa dan DIPOTONG (`truncate`)
 *          alih-alih membungkus — judul dua baris membuat tinggi bilah
 *          melompat setiap kali nama tempatnya berganti.
 */

import { useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import type { TempatDipilih } from "@/lib/searchTabs";

export interface AksiCatatanBar {
  label: string;
  set?: Record<string, string>;
  hapus?: string[];
  utama?: boolean;
}

export interface CatatanBar {
  teks: string;
  aksi: AksiCatatanBar[];
}

/** Sinkron dengan RADIUS_PILIHAN di src/lib/listingTempatFilter.ts. */
const RADIUS = [
  { nilai: 1_000, label: "1 km" },
  { nilai: 3_000, label: "3 km" },
  { nilai: 5_000, label: "5 km" },
  { nilai: 10_000, label: "10 km" },
] as const;

export default function TempatAktifBar({
  tempat,
  radius,
  jumlah,
  ditebak = false,
  /** Teks yang tadi diketik user — hanya dipakai saat `ditebak`. */
  kueriAsli,
  catatan,
  theme = "dark",
}: {
  tempat?: TempatDipilih | null;
  radius?: number;
  jumlah?: number;
  ditebak?: boolean;
  kueriAsli?: string;
  catatan?: CatatanBar | null;
  theme?: "light" | "dark";
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, mulai] = useTransition();

  const gelap = theme === "dark";

  const navigasi = useCallback(
    (ubah: (p: URLSearchParams) => void) => {
      const p = new URLSearchParams(sp?.toString() ?? "");
      ubah(p);
      p.set("page", "1");
      mulai(() => router.push(`?${p.toString()}`, { scroll: false }));
    },
    [router, sp],
  );

  const jalankanAksi = (a: AksiCatatanBar) =>
    navigasi((p) => {
      for (const k of a.hapus ?? []) p.delete(k);
      for (const [k, v] of Object.entries(a.set ?? {})) p.set(k, v);
    });

  // ───────────────────────────────────────────────────────────────────────────
  // Varian A — hanya catatan (tidak ada tempat yang sedang menyaring)
  // ───────────────────────────────────────────────────────────────────────────
  if (!tempat) {
    if (!catatan) return null;
    return (
      <div
        className={`mb-4 rounded-2xl border p-3.5 sm:p-4 ${
          gelap
            ? "border-amber-400/20 bg-amber-400/[0.055]"
            : "border-amber-200 bg-amber-50"
        } ${pending ? "pointer-events-none opacity-60" : ""}`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
              gelap ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-600"
            }`}
          >
            <Icon icon="solar:info-circle-bold-duotone" className="text-xl" />
          </span>
          <p
            className={`min-w-0 flex-1 pt-1 text-[13px] font-semibold leading-snug ${
              gelap ? "text-amber-50" : "text-amber-900"
            }`}
          >
            {catatan.teks}
          </p>
        </div>

        {/* Tombol turun ke barisnya sendiri, bukan berebut ruang dengan teks —
            label seperti "Lihat properti di Sidoarjo" tidak muat bersebelahan
            dengan kalimat penjelas di layar 360px. */}
        <div className="mt-3 flex flex-wrap gap-2 pl-0 sm:pl-12">
          {catatan.aksi.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => jalankanAksi(a)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                a.utama
                  ? "bg-amber-400 text-black hover:bg-amber-300"
                  : gelap
                    ? "border border-amber-400/25 text-amber-100 hover:bg-amber-400/10"
                    : "border border-amber-300 text-amber-800 hover:bg-amber-100"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Varian B — tempat aktif
  // ───────────────────────────────────────────────────────────────────────────
  const radiusAktif = radius ?? tempat.radius;
  const total = jumlah ?? 0;

  const gantiRadius = (nilai: number) =>
    navigasi((p) => {
      // Radius bawaan tidak ditulis ke URL — tautan yang dibagikan jadi lebih
      // pendek, dan bawaan yang diperbaiki nanti tetap berlaku untuk tautan lama.
      if (nilai === tempat.radius) p.delete("radius");
      else p.set("radius", String(nilai));
    });

  const hapus = () =>
    navigasi((p) => {
      p.delete("dekat");
      p.delete("radius");
      // Tebakan berasal dari `q`; membiarkannya berarti tombol "hapus" tidak
      // menghapus apa pun — halaman langsung menebak lagi dari teks yang sama.
      if (ditebak) p.delete("q");
      // "Terdekat" tanpa titik acuan bukan urutan apa pun.
      if (p.get("sort") === "terdekat") p.delete("sort");
    });

  /**
   * Judul. Nama jenis sudah berbentuk kalimat ("Semua kampus di Malang"), jadi
   * huruf besarnya diturunkan agar menyambung dengan "Di sekitar" — bukan dua
   * kalimat yang ditempel.
   */
  const judul = tempat.kelasSemua
    ? tempat.nama.charAt(0).toLowerCase() + tempat.nama.slice(1)
    : tempat.nama;

  const meta: string[] = [];
  if (total > 0) meta.push(`${total.toLocaleString("id-ID")} properti`);
  if (tempat.kelasSemua && tempat.cabang) {
    meta.push(`dari ${tempat.cabang.toLocaleString("id-ID")} ${tempat.label.toLowerCase()}`);
  } else if (tempat.cabang && tempat.cabang > 1) {
    meta.push(`${tempat.cabang} cabang`);
  } else if (tempat.kota) {
    meta.push(tempat.kota);
  }
  if (ditebak && kueriAsli) meta.push(`ditafsirkan dari “${kueriAsli}”`);

  const pengaturRadius = (
    <div
      className={`flex items-center gap-0.5 rounded-xl p-0.5 ${
        gelap ? "border border-white/10 bg-black/30" : "border border-gray-200 bg-gray-50"
      }`}
      role="group"
      aria-label="Radius pencarian"
    >
      {RADIUS.map((r) => {
        const aktif = r.nilai === radiusAktif;
        return (
          <button
            key={r.nilai}
            type="button"
            onClick={() => gantiRadius(r.nilai)}
            aria-pressed={aktif}
            className={`shrink-0 rounded-[10px] px-2.5 py-1.5 text-[11px] font-bold leading-none transition-all sm:text-xs ${
              aktif
                ? "bg-primary text-black shadow-[0_2px_10px_-2px_rgba(153,227,158,0.6)]"
                : gelap
                  ? "text-gray-400 hover:bg-white/5 hover:text-white"
                  : "text-gray-500 hover:bg-white hover:text-gray-900"
            }`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      className={`mb-4 overflow-hidden rounded-2xl border transition-opacity ${
        gelap
          ? "border-white/10 bg-gradient-to-r from-primary/[0.07] to-transparent"
          : "border-gray-200 bg-white"
      } ${pending ? "pointer-events-none opacity-60" : ""}`}
    >
      <div className="flex items-center gap-3 p-3 sm:gap-4 sm:p-3.5">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl sm:h-11 sm:w-11"
          style={{ backgroundColor: `${tempat.warna}1f`, color: tempat.warna }}
        >
          <Icon icon={tempat.icon} className="text-xl sm:text-2xl" />
        </span>

        {/* min-w-0 WAJIB di sini: tanpanya anak flex memakai lebar
            min-content-nya, dan `truncate` di dalamnya tidak pernah aktif. */}
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-[13px] font-extrabold leading-tight sm:text-sm ${
              gelap ? "text-white" : "text-gray-900"
            }`}
            title={`Di sekitar ${judul}`}
          >
            <span className={gelap ? "text-gray-400" : "text-gray-500"}>Di sekitar </span>
            {judul}
          </p>
          <p
            className={`mt-0.5 truncate text-[11px] leading-tight ${
              gelap ? "text-gray-400" : "text-gray-500"
            }`}
            title={meta.join(" · ")}
          >
            {total === 0 ? (
              <span className="text-amber-400">
                Belum ada properti di radius ini — coba perbesar
              </span>
            ) : (
              meta.join(" · ")
            )}
          </p>
        </div>

        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          {pengaturRadius}
          <button
            type="button"
            onClick={hapus}
            aria-label="Hapus filter tempat"
            className={`grid h-9 w-9 place-items-center rounded-xl border transition-colors ${
              gelap
                ? "border-white/10 text-gray-400 hover:border-red-500/40 hover:text-red-300"
                : "border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-500"
            }`}
          >
            <Icon icon="solar:close-circle-bold" className="text-lg" />
          </button>
        </div>

        {/* Mobile: tutup tetap di baris identitas — ia aksi paling sering
            dicari saat filternya salah, jadi tidak boleh ikut tergeser
            bersama pengatur radius. */}
        <button
          type="button"
          onClick={hapus}
          aria-label="Hapus filter tempat"
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border sm:hidden ${
            gelap ? "border-white/10 text-gray-400" : "border-gray-200 text-gray-500"
          }`}
        >
          <Icon icon="solar:close-circle-bold" className="text-lg" />
        </button>
      </div>

      <div
        className={`flex items-center gap-2 border-t px-3 py-2 sm:hidden ${
          gelap ? "border-white/[0.07]" : "border-gray-100"
        }`}
      >
        <span
          className={`shrink-0 text-[10px] font-bold uppercase tracking-wider ${
            gelap ? "text-gray-500" : "text-gray-400"
          }`}
        >
          Radius
        </span>
        {/* Digeser, bukan dibungkus: empat tombol yang membungkus jadi dua
            baris membuat tinggi bilah berubah-ubah di layar tersempit. */}
        <div className="scrollbar-none -mx-1 flex-1 overflow-x-auto px-1">
          {pengaturRadius}
        </div>
      </div>
    </div>
  );
}

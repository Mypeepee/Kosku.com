"use client";

/**
 * Baris patokan terdekat pada card kos, berjalan sendiri ke kiri.
 *
 * Kenapa marquee: nama tempat itu panjang ("Universitas Ciputra Surabaya"),
 * jadi kalau di-wrap, dua patokan saja sudah memakan dua baris dan card jadi
 * penuh. Kalau dipotong jadi satu, patokan lain hilang padahal justru itu yang
 * dicari sebagian orang. Berjalan dalam satu baris = semuanya kebaca, tinggi
 * card tetap.
 *
 * Animasi murni CSS (transform, compositor-only) — tidak ada pekerjaan per
 * frame di JS. JS cuma dipakai sekali untuk mengukur: kalau isinya sudah muat,
 * marquee tidak dijalankan sama sekali. Kos dengan satu patokan pendek yang
 * bergerak tanpa alasan itu mengganggu, bukan informatif.
 */

import React, { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { AKSES_ICON, formatAkses, type AksesTerdekat } from "@/lib/kosCard";

/**
 * Kecepatan jalan dalam piksel/detik.
 *
 * Sengaja pelan — baris ini dibaca sambil mata menyapu daftar listing, bukan
 * ditonton. Terlalu cepat justru tidak terbaca sama sekali.
 */
const KECEPATAN_PX_PER_DETIK = 22;

function ChipAkses({ akses }: { akses: AksesTerdekat }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-medium text-emerald-300">
      <Icon
        icon={AKSES_ICON[akses.tipe] || "solar:map-point-bold-duotone"}
        className="shrink-0 text-xs"
      />
      <span className="whitespace-nowrap">{formatAkses(akses)}</span>
    </span>
  );
}

/**
 * Cangkang marquee yang bisa dipakai baris chip mana pun.
 *
 * Dipisah dari `AksesMarquee` saat baris kedua lahir (jarak ke tempat yang
 * sedang dicari): kedua baris butuh perilaku yang persis sama — ukur dulu,
 * jalan hanya bila memang tidak muat — dan menyalin logikanya berarti dua
 * aturan yang perlahan berbeda. Yang berbeda hanya isi chipnya, dan itu
 * diserahkan ke pemanggil lewat `children`.
 */
export function Marquee({ children }: { children: React.ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const salinanRef = useRef<HTMLDivElement>(null);
  // 0 = muat tanpa digeser, jadi tidak usah jalan.
  const [durasiDetik, setDurasiDetik] = useState(0);

  useEffect(() => {
    const viewport = viewportRef.current;
    const salinan = salinanRef.current;
    if (!viewport || !salinan) return;

    const ukur = () => {
      // scrollWidth salinan PERTAMA — tidak terpengaruh salinan kedua yang
      // baru ditambahkan setelah state berubah, jadi pengukurannya tidak
      // saling memicu ulang.
      const lebar = salinan.scrollWidth;
      const muat = lebar <= viewport.clientWidth + 1;
      setDurasiDetik(muat ? 0 : lebar / KECEPATAN_PX_PER_DETIK);
    };

    ukur();

    // Ikon Iconify diambil dari jaringan, jadi lebar chip masih berubah
    // setelah render pertama — tanpa observer, hasil ukur awal bisa salah.
    const observer = new ResizeObserver(ukur);
    observer.observe(viewport);
    observer.observe(salinan);
    return () => observer.disconnect();
  }, [children]);

  const berjalan = durasiDetik > 0;

  const salinanChip = (
    ref?: React.Ref<HTMLDivElement>,
    tersembunyiDariPembacaLayar?: boolean
  ) => (
    <div
      ref={ref}
      aria-hidden={tersembunyiDariPembacaLayar}
      // pr-1.5 = jarak antar-chip, supaya lebar kedua salinan identik dan
      // sambungan loop tidak kelihatan.
      className="flex shrink-0 items-center gap-1.5 pr-1.5"
    >
      {children}
    </div>
  );

  return (
    <div
      ref={viewportRef}
      className={`akses-marquee-viewport w-full overflow-hidden ${
        berjalan ? "akses-marquee-fade" : ""
      }`}
    >
      <div
        className={`flex w-max ${berjalan ? "animate-akses-marquee" : ""}`}
        style={berjalan ? { animationDuration: `${durasiDetik}s` } : undefined}
      >
        {salinanChip(salinanRef)}
        {berjalan && salinanChip(undefined, true)}
      </div>
    </div>
  );
}

export function AksesMarquee({ items }: { items: AksesTerdekat[] }) {
  if (items.length === 0) return null;
  return (
    <Marquee>
      {items.map((akses, i) => (
        <ChipAkses key={`${akses.tipe}-${akses.nama}-${i}`} akses={akses} />
      ))}
    </Marquee>
  );
}

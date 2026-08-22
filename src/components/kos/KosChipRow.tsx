"use client";

/**
 * Baris identitas + fasilitas pada card kos, satu baris, mengisi ruang.
 *
 * Masalah yang diselesaikan: jatah ikon yang dipatok angka tetap selalu salah
 * di salah satu ujung. Dipatok 5, card lebar di desktop menyisakan ruang kosong
 * tapi tetap menulis "+19"; dinaikkan, card sempit di HP jadi melimpah dan
 * membungkus. Jumlah yang benar cuma bisa diketahui dari lebar sebenarnya.
 *
 * Jadi: render semua, ukur, lalu tampilkan sebanyak yang muat. "+N" hanya
 * muncul kalau memang ada yang tidak kebagian tempat — dan angkanya jujur,
 * karena dihitung dari sisa yang tidak ditampilkan.
 *
 * Pengukuran memakai satuan nyata dari DOM (lebar chip label, lebar satu ikon,
 * lebar "+N"), bukan angka tebakan, supaya tetap benar kalau ukuran chip-nya
 * nanti diubah.
 */

import React, { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import type { FasilitasIkon, LabelChip } from "@/lib/kosCard";
import { chipWarna } from "./kosCardStyle";

/** Sama dengan gap-1.5 pada baris ini. Dipakai untuk berhitung. */
const GAP = 6;

export function KosChipRow({
  labelChips,
  iconChips,
}: {
  labelChips: LabelChip[];
  iconChips: FasilitasIkon[];
}) {
  const barisRef = useRef<HTMLDivElement>(null);
  const labelGroupRef = useRef<HTMLDivElement>(null);
  const ikonRef = useRef<HTMLSpanElement>(null);
  const plusRef = useRef<HTMLSpanElement>(null);

  // Mulai dari "semua tampil": kalau memang muat, tidak ada perubahan sama
  // sekali setelah pengukuran. Baris ini overflow-hidden, jadi kelebihannya
  // terpotong rapi selama satu frame, bukan merusak tata letak.
  const [tampil, setTampil] = useState(iconChips.length);

  useEffect(() => {
    const baris = barisRef.current;
    if (!baris) return;

    const hitung = () => {
      const total = iconChips.length;
      if (total === 0) return;

      const lebarBaris = baris.clientWidth;
      const lebarLabel = labelGroupRef.current?.offsetWidth ?? 0;
      const lebarIkon = ikonRef.current?.offsetWidth || 24;
      const lebarPlus = plusRef.current?.offsetWidth || 24;

      // Ruang tersisa setelah chip label (yang selalu wajib tampil).
      const tersisa = lebarBaris - lebarLabel - (lebarLabel > 0 ? GAP : 0);

      // n ikon memakan n*lebar + (n-1)*gap  →  n = (tersisa + gap) / (ikon + gap)
      const muat = Math.floor((tersisa + GAP) / (lebarIkon + GAP));
      if (muat >= total) {
        setTampil(total);
        return;
      }

      // Tidak semua muat: "+N" ikut memakan tempat.
      //   n*ikon + (n-1)*gap + gap + plus <= tersisa
      //   → n <= (tersisa - plus) / (ikon + gap)
      const muatDenganPlus = Math.floor(
        (tersisa - lebarPlus) / (lebarIkon + GAP)
      );
      setTampil(Math.max(0, Math.min(total, muatDenganPlus)));
    };

    hitung();

    // Lebar baris berubah saat viewport/kolom grid berubah; lebar chip label
    // berubah setelah ikon Iconify selesai diambil dari jaringan.
    const observer = new ResizeObserver(hitung);
    observer.observe(baris);
    if (labelGroupRef.current) observer.observe(labelGroupRef.current);
    return () => observer.disconnect();
    // Sengaja bergantung pada JUMLAHNYA, bukan array-nya: pemanggil membuat
    // array baru tiap render, jadi memakai array sebagai dependency akan
    // membongkar-pasang ResizeObserver di 30 card setiap kali halaman render.
    // Perubahan lebar akibat isi yang berubah sudah ditangkap observer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iconChips.length, labelChips.length]);

  if (labelChips.length === 0 && iconChips.length === 0) return null;

  const sisa = iconChips.length - tampil;

  return (
    <div
      ref={barisRef}
      className="relative flex w-full items-center gap-1.5 overflow-hidden"
    >
      {labelChips.length > 0 && (
        <div ref={labelGroupRef} className="flex shrink-0 items-center gap-1.5">
          {labelChips.map((chip) => (
            <span
              key={chip.label}
              className={`inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-medium ${chipWarna(
                chip.gender
              )}`}
            >
              {chip.label}
            </span>
          ))}
        </div>
      )}

      {iconChips.slice(0, tampil).map((f, i) => (
        <span
          key={f.label}
          ref={i === 0 ? ikonRef : undefined}
          title={f.label}
          aria-label={f.label}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-gray-400"
        >
          <Icon icon={f.icon} className="text-[13px]" />
        </span>
      ))}

      {sisa > 0 && (
        <span
          title={iconChips
            .slice(tampil)
            .map((f) => f.label)
            .join(", ")}
          className="shrink-0 text-[10px] text-gray-500"
        >
          +{sisa}
        </span>
      )}

      {/* Pengukur "+N": selalu ada di DOM supaya lebarnya bisa dibaca sebelum
          diputuskan apakah "+N" jadi ditampilkan. Diletakkan di luar layar,
          jadi tidak memengaruhi tata letak maupun pembaca layar. */}
      <span
        ref={plusRef}
        aria-hidden
        className="pointer-events-none absolute -left-[9999px] top-0 text-[10px]"
      >
        +{iconChips.length}
      </span>
    </div>
  );
}

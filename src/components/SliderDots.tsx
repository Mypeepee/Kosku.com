import React from "react";

/**
 * Indikator titik untuk slider foto — gaya "Instagram".
 *
 * Kenapa: kalau foto banyak (mis. 10) dan titiknya ditampilkan semua,
 * barisnya jadi lebar dan nabrak pill ID / tombol panah.
 *
 * Solusi: batasi jumlah titik yang tampil (`max`). Titik aktif selalu
 * di tengah window; titik di ujung window mengecil sebagai sinyal
 * "masih ada foto lain di arah itu".
 *
 * Contoh (max=5, total=10):
 *   foto 1  → ● · · · ·        (aktif di kiri, ujung kanan mengecil)
 *   foto 5  → ˑ · ● · ˑ        (aktif di tengah, dua ujung mengecil)
 *   foto 10 → · · · · ●        (aktif di kanan, ujung kiri mengecil)
 */
export function SliderDots({
  total,
  index,
  max = 5,
  className = "",
}: {
  total: number;
  index: number;
  max?: number;
  className?: string;
}) {
  if (total <= 1) return null;

  const windowSize = Math.min(max, total);

  // Tentukan rentang [start, end] sepanjang windowSize, aktif diusahakan di tengah.
  let start = 0;
  let end = total - 1;
  if (total > windowSize) {
    const half = Math.floor(windowSize / 2);
    start = index - half;
    end = start + windowSize - 1;
    if (start < 0) {
      start = 0;
      end = windowSize - 1;
    }
    if (end > total - 1) {
      end = total - 1;
      start = total - windowSize;
    }
  }

  const dots = [];
  for (let i = start; i <= end; i++) {
    const isActive = i === index;
    const isEdgeWithMore =
      (i === start && start > 0) || (i === end && end < total - 1);

    let size = "w-1.5 bg-white/50"; // titik normal
    if (isActive) size = "w-4 bg-white"; // titik aktif — memanjang
    else if (isEdgeWithMore) size = "w-1 bg-white/30"; // ujung window — mengecil

    dots.push(
      <span
        key={i}
        className={`h-1.5 rounded-full transition-all duration-300 ease-out ${size}`}
      />,
    );
  }

  return <div className={`flex items-center gap-1 ${className}`}>{dots}</div>;
}

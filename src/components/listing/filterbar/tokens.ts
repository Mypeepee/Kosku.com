import type { CSSProperties } from "react";

/**
 * Token visual bar filter.
 *
 * KENAPA INLINE STYLE, BUKAN KELAS TAILWIND
 * Di proyek ini kelas opacity yang bukan kelipatan 5 (`bg-white/8`, `/12`,
 * `/98`) TIDAK menghasilkan CSS apa pun — kelasnya tertulis tapi tidak berefek.
 * Palet bar ini hidup di antara nilai-nilai itu (0.04, 0.08, 0.14), jadi
 * warnanya ditulis sebagai `rgba` supaya yang tampil sama dengan yang tertulis.
 *
 * ATURAN WARNA
 * Bar lama memakai tiga aksen sekaligus dalam satu baris — emerald untuk angka,
 * indigo untuk urutan, merah untuk tombol batal — sehingga tidak ada satu pun
 * yang berarti "ini yang sedang aktif". Di sini aksen HANYA SATU (indigo) dan
 * artinya tunggal: bidang ini sedang berisi nilai. Membatalkan filter tidak
 * punya warna sendiri; tempatnya di baris chip aktif.
 */

export const AKSEN = "#6366f1";
export const AKSEN_TEKS = "#c7d2fe";

export const BAR: CSSProperties = {
  background: "rgba(12,13,18,0.92)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

export const PANEL: CSSProperties = {
  background: "rgba(14,15,21,0.98)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.1)",
  boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
};

/** Chip/tombol netral. */
export const CHIP_IDLE: CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.65)",
};

/** Chip yang sedang berisi nilai. */
export const CHIP_ISI: CSSProperties = {
  background: "rgba(99,102,241,0.14)",
  border: `1px solid rgba(99,102,241,0.45)`,
  color: AKSEN_TEKS,
};

export const INPUT: CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "rgba(255,255,255,0.9)",
};

export const INPUT_FOKUS: CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  border: `1px solid rgba(99,102,241,0.55)`,
  color: "rgba(255,255,255,0.95)",
};

/** Tinggi bar. Dipakai juga sebagai offset `top` panel yang menempel. */
export const TINGGI_BAR = 56;

/** Kurva keluar cepat-melambat; sama dengan yang dipakai hero halaman ini. */
export const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Cincin fokus yang benar-benar terlihat di atas latar gelap. Bar lama tidak
 * punya satu pun, jadi navigasi keyboard berjalan buta.
 */
export const RING_FOKUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0e13]";

/** Angka ringkas untuk badge tab: 1.325 → "1,3rb". */
export function ringkasAngka(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${(Number.isInteger(v) ? v : v.toFixed(1)).toString().replace(".", ",")}jt`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `${(Number.isInteger(v) ? v : v.toFixed(1)).toString().replace(".", ",")}rb`;
  }
  return n.toLocaleString("id-ID");
}

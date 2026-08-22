"use client";

/**
 * Seret-ke-bawah untuk menutup bottom sheet.
 *
 * ── KENAPA GESTUR INI WAJIB, BUKAN TAMBAHAN ───────────────────────────────
 * Di ponsel, sheet yang muncul dari bawah SELALU bisa ditutup dengan
 * menyeretnya kembali ke bawah — itu perilaku bawaan iOS & Android, dan setiap
 * aplikasi yang dipakai orang setiap hari mengikutinya. Pegangan putih kecil di
 * puncak sheet adalah janji visual bahwa gestur itu ada; sheet yang menampilkan
 * pegangan tapi tidak bisa diseret adalah janji yang diingkari, dan pengguna
 * yang mencobanya menyimpulkan halamannya macet — bukan bahwa fiturnya tidak
 * ada. Tombol × tetap ada dan tidak berubah: gestur untuk ibu jari, tombol
 * untuk yang menjangkaunya dengan mata.
 *
 * ── CARA PAKAI ────────────────────────────────────────────────────────────
 *   const seret = useSeretTutup(onTutup);
 *   <div style={seret.gaya}>            ← elemen sheet-nya
 *     <div {...seret.pegangan}>…</div>  ← daerah yang bisa diseret
 *
 * `pegangan` sengaja dipasang pada AREA PEGANGAN + KEPALA, bukan pada seluruh
 * sheet. Isi sheet hampir selalu bisa digulir, dan sheet yang ikut tertarik
 * saat pengguna menggulir daftarnya adalah gestur yang saling berebut — persis
 * yang membuat sheet terasa "licin" dan tidak bisa dipercaya.
 *
 * Tetikus sengaja DIABAIKAN (`pointerType === "mouse"` dilewati). Di layar
 * besar sheet-nya memang tidak muncul, dan menyeret modal dengan tetikus bukan
 * kebiasaan siapa pun — sementara pointer capture pada klik tetikus biasa
 * berisiko menelan klik tombol di dalam kepala.
 */

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from "react";

/** Seret sejauh ini (px) sudah cukup untuk menutup, seberapa pun pelannya. */
const AMBANG_JARAK = 110;
/** Lemparan cepat: jarak lebih pendek pun menutup kalau kecepatannya di atas
 *  ini (px/ms). Angkanya diambil dari perilaku sheet iOS — cukup rendah untuk
 *  terasa ringan, cukup tinggi untuk tidak menutup karena jempol bergeser. */
const AMBANG_KECEPATAN = 0.55;
/** Seret ke ATAS diperlambat, tidak dilarang: perlawanan yang terasa memberi
 *  tahu ujung sheet sudah tercapai, sementara elemen yang diam terbaca rusak. */
const REDAM_KE_ATAS = 0.22;

export interface SeretTutup {
  /** Ditempel pada area pegangan/kepala sheet. */
  pegangan: {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: PointerEvent<HTMLElement>) => void;
    onPointerUp: (e: PointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: PointerEvent<HTMLElement>) => void;
    onClickCapture: (e: MouseEvent<HTMLElement>) => void;
    style: CSSProperties;
  };
  /** Ditempel pada elemen sheet-nya. */
  gaya: CSSProperties;
  /** Sedang diseret — dipakai mematikan animasi lain yang bisa bertabrakan. */
  menyeret: boolean;
}

export function useSeretTutup(onTutup: () => void): SeretTutup {
  const [geser, setGeser] = useState(0);
  const [menyeret, setMenyeret] = useState(false);
  /**
   * Sedang memantul kembali ke tempatnya sesudah seret yang batal.
   *
   * Ada demi satu hal: SELAMA TIDAK diseret, hook ini tidak boleh menulis
   * `transform` maupun `transition` sama sekali. Animasi masuk setiap sheet
   * ditulis dengan kelas Tailwind di komponennya masing-masing (geser naik +
   * pudar + skala), dan gaya sebaris apa pun dari sini akan menimpanya diam-
   * diam — sheet-nya jadi muncul begitu saja tanpa animasi, kerusakan yang
   * mustahil dilacak balik ke berkas ini.
   */
  const [memantul, setMemantul] = useState(false);

  const awal = useRef<{ y: number; t: number } | null>(null);
  /** Simpangan terjauh selama satu seret — dipakai membedakan seret dari ketukan. */
  const jauh = useRef(0);
  const jamPantul = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (jamPantul.current) clearTimeout(jamPantul.current);
    },
    [],
  );

  const selesai = (e: PointerEvent<HTMLElement>) => {
    if (!awal.current) return;
    const jarak = e.clientY - awal.current.y;
    const lama = Math.max(1, performance.now() - awal.current.t);
    const kecepatan = jarak / lama;

    awal.current = null;
    setMenyeret(false);

    if (jarak > AMBANG_JARAK || (kecepatan > AMBANG_KECEPATAN && jarak > 40)) {
      // Posisi seret TIDAK direset di sini. Sheet ditutup dari posisi tangan
      // pengguna terakhir; mereset ke nol lebih dulu membuatnya melompat balik
      // ke atas sepersekian detik sebelum menghilang.
      onTutup();
      // Disetel nol pada frame berikutnya supaya sheet yang sama siap dibuka
      // lagi dalam keadaan bersih.
      requestAnimationFrame(() => setGeser(0));
      return;
    }

    setGeser(0);
    setMemantul(true);
    if (jamPantul.current) clearTimeout(jamPantul.current);
    jamPantul.current = setTimeout(() => setMemantul(false), 340);
  };

  return {
    pegangan: {
      onPointerDown: (e) => {
        if (e.pointerType === "mouse") return;
        awal.current = { y: e.clientY, t: performance.now() };
        jauh.current = 0;
        setMenyeret(true);
        // TIDAK memanggil setPointerCapture. Sentuhan sudah punya "implicit
        // pointer capture" ke elemen asalnya, jadi pointermove/up tetap sampai
        // ke sini tanpa bantuan — sementara capture yang dipasang sendiri
        // membuat sebagian peramban mengalihkan event `click` ke elemen
        // penangkap, dan tombol × di dalam kepala berhenti bisa ditekan.
      },
      onPointerMove: (e) => {
        if (!awal.current) return;
        const d = e.clientY - awal.current.y;
        jauh.current = Math.max(jauh.current, Math.abs(d));
        setGeser(d > 0 ? d : d * REDAM_KE_ATAS);
      },
      onPointerUp: selesai,
      onPointerCancel: selesai,
      /**
       * Seret yang berakhir di atas sebuah tombol tidak boleh menekan tombol
       * itu. Tanpa penjaga ini, jempol yang kebetulan mulai menyeret dari atas
       * tombol × akan menutup sheet meski seretnya sengaja dibatalkan — dan
       * pada tombol "Kembali" di drawer voucher, akibatnya bahkan membuang
       * layar form yang sedang diisi.
       */
      onClickCapture: (e) => {
        if (jauh.current > 8) {
          e.preventDefault();
          e.stopPropagation();
          jauh.current = 0;
        }
      },
      // `touch-action: none` — tanpa ini peramban menganggap gerakan vertikal
      // sebagai gulir halaman dan membatalkan gestur di tengah jalan.
      style: { touchAction: "none" },
    },
    gaya: {
      transform: geser ? `translateY(${geser}px)` : undefined,
      transition: menyeret
        ? "none"
        : memantul
          ? "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)"
          : undefined,
    },
    menyeret,
  };
}

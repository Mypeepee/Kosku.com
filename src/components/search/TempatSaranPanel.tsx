"use client";

/**
 * Panel saran tempat — daftar yang muncul di bawah kotak pencarian saat orang
 * mengetik "deket unesa".
 *
 * ── DUA MODE, DUA MASALAH YANG BERBEDA ─────────────────────────────────────
 *
 * MELAYANG (bawaan, dipakai search bar desktop). Search bar dibungkus kartu
 * ber-`overflow-hidden` dan berlapis-lapis `rounded`; panel yang dirender di
 * dalamnya akan terpotong persis di tepi kartu. Maka ia di-portal ke body dan
 * diposisikan `fixed` di bawah kotaknya. Polanya sama dengan LocationPicker &
 * TypePicker (`data-search-portal` dikenali penutup-dropdown di useSearchForm,
 * supaya mengklik panel tidak dianggap "klik di luar").
 *
 * MENYATU (`inline`, dipakai bottom sheet di layar kecil). Di dalam sheet,
 * panel melayang justru MERUSAK: kotak kata kunci ada di paling atas, jadi
 * daftar saran menimpa Lokasi, Tipe, dan Harga sekaligus. Yang terlihat oleh
 * pemakai bukan "ada saran", melainkan "filter saya hilang" — dan yang belum
 * hafal isinya tidak punya cara tahu bahwa di balik daftar itu ada kolom lain.
 * Dalam mode ini panel dirender di dalam alur dokumen: ia MENDORONG kolom di
 * bawahnya, tidak menutupinya, jadi tidak ada yang pernah tersembunyi.
 *
 * SETIAP SARAN MEMBAWA JUMLAH ASETNYA. Itu bukan hiasan: kamus tempat hanya
 * memuat tempat yang memang punya aset di dekatnya, dan menuliskan angkanya
 * membuat janji itu terlihat. Orang jadi tahu sebelum mengklik bahwa "UNESA ·
 * 12 properti" akan memberi 12, bukan halaman kosong.
 */

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { AnimatePresence, motion } from "framer-motion";
import type { TempatDipilih } from "@/lib/searchTabs";

export interface SaranTempatUi extends TempatDipilih {
  jumlah: number;
  /** Satuan `jumlah` — "properti" (bawaan) atau nama kelas ("kampus"). */
  satuan?: string;
  /** Saran ini mengabaikan wilayah yang diminta — lihat catatan di cari.ts. */
  gantiWilayah?: boolean;
}

type Theme = "light" | "dark";

const THEMES: Record<
  Theme,
  { panel: string; row: string; nama: string; sub: string; kosong: string; kbd: string }
> = {
  light: {
    panel: "bg-white border-gray-100",
    row: "hover:bg-gray-50",
    nama: "text-gray-800",
    sub: "text-gray-400",
    kosong: "text-gray-400",
    kbd: "bg-gray-100 text-gray-500 border-gray-200",
  },
  dark: {
    panel: "bg-[#0b1220] border-white/10",
    row: "hover:bg-white/5",
    nama: "text-white",
    sub: "text-gray-500",
    kosong: "text-gray-500",
    kbd: "bg-white/5 text-gray-400 border-white/10",
  },
};

interface Props {
  anchorRef: React.RefObject<HTMLElement>;
  open: boolean;
  items: SaranTempatUi[];
  memuat: boolean;
  /** Kueri yang sedang diketik — dipakai untuk pesan "tidak ditemukan". */
  kueri: string;
  /**
   * true = panel sedang menampilkan tawaran pembuka (belum ada yang diketik).
   * Mengubah judul bagian dan memunculkan satu baris petunjuk di atas — itulah
   * yang mengubah kotak pencarian dari "isi sendiri" jadi "ini yang bisa".
   */
  populer?: boolean;
  /**
   * Tawaran "cari teks ini sebagai alamat", berikut jumlah propertinya.
   *
   * INI YANG MEMPERBAIKI KEBINGUNGAN TERBESAR. Sebelumnya, mengetik nama jalan
   * atau kelurahan ("Dukuh Kupang") menghasilkan pesan "Tidak ada tempat
   * bernama … di sekitar aset kami" — kalimat yang secara harfiah benar
   * (memang tak ada LANDMARK bernama itu) tapi terbaca sebagai "tidak ada
   * properti di sana", padahal ada puluhan. Orang yang mengetik nama yang
   * BENAR disodori pesan yang membuatnya mengira situsnya kosong.
   *
   * Sekarang teks itu selalu punya barisnya sendiri, dengan angka nyata, dan
   * panelnya tidak pernah lagi melaporkan kegagalan.
   */
  alamat?: { teks: string; jumlah: number | null } | null;
  /** Jalankan pencarian alamat (sama dengan menekan Enter). */
  onPilihAlamat?: () => void;
  /** Isi kotak dengan sebuah contoh — dipakai chip "deket kampus". */
  onContoh?: (teks: string) => void;
  aktif: number;
  onHover: (i: number) => void;
  onPilih: (t: SaranTempatUi) => void;
  theme?: Theme;
  /**
   * Render menyatu dengan alur dokumen alih-alih melayang di atasnya.
   * Dipakai di bottom sheet mobile — lihat catatan di kepala berkas.
   */
  inline?: boolean;
}

export default function TempatSaranPanel({
  anchorRef,
  open,
  items,
  memuat,
  kueri,
  populer = false,
  alamat = null,
  onPilihAlamat,
  onContoh,
  aktif,
  onHover,
  onPilih,
  theme = "dark",
  inline = false,
}: Props) {
  const t = THEMES[theme];
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const daftarRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Posisi diikuti selama panel terbuka: kotak pencarian ikut bergerak saat
  // halaman di-scroll, dan panel yang tertinggal di tempat lamanya terlihat
  // seperti kerusakan.
  useLayoutEffect(() => {
    if (!open) return;
    const ukur = () => {
      if (anchorRef.current) setRect(anchorRef.current.getBoundingClientRect());
    };
    ukur();
    window.addEventListener("scroll", ukur, true);
    window.addEventListener("resize", ukur);
    return () => {
      window.removeEventListener("scroll", ukur, true);
      window.removeEventListener("resize", ukur);
    };
  }, [open, anchorRef]);

  // Baris terpilih lewat papan ketik harus ikut terlihat.
  useEffect(() => {
    const el = daftarRef.current?.querySelector<HTMLElement>(`[data-i="${aktif}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [aktif]);

  if (!mounted || !open) return null;
  // Mode melayang butuh ukuran kotak jangkarnya lebih dulu; mode menyatu tidak
  // pernah menghitung koordinat apa pun.
  if (!inline && !rect) return null;

  /**
   * Geometri panel melayang.
   *
   * Lebar dijepit ke viewport SEBELUM dipakai menghitung posisi kiri. Dihitung
   * sesudahnya, panel yang lebih lebar dari layar membuat `left` jadi negatif
   * lalu dijepit ke 8 — dan sisi kanannya menggantung di luar layar. Di ponsel
   * sempit itu berarti kolom "12 properti" tidak pernah terlihat, dan panelnya
   * menyeret halaman ke samping.
   */
  const geo =
    !inline && rect
      ? (() => {
          const lebarMaks = window.innerWidth - 16;
          const lebar = Math.min(Math.max(rect.width, 300), lebarMaks);
          const ruangBawah = window.innerHeight - rect.bottom - 12;
          const keAtas = ruangBawah < 220 && rect.top > ruangBawah;
          return {
            lebar,
            keAtas,
            kiri: Math.max(8, Math.min(rect.left, window.innerWidth - lebar - 8)),
            atas: rect.bottom + 8,
            bawah: window.innerHeight - rect.top + 8,
            tinggiMaks: Math.max(
              180,
              Math.min(400, keAtas ? rect.top - 16 : ruangBawah)
            ),
          };
        })()
      : null;

  /**
   * Batas antara saran JENIS dan saran NAMA. Keduanya menjawab pertanyaan yang
   * berbeda ("kawasan mana" vs "tempat mana"), dan tanpa pemisah visual
   * daftarnya terbaca sebagai satu antrean seragam — pembacanya lalu memilih
   * baris kedua karena namanya lebih spesifik, padahal yang ia maksud kawasan.
   */
  const jumlahKelas = items.filter((i) => i.kelasSemua).length;

  const isi = (
    <>
        {populer && items.length > 0 && (
          <p
            className={`border-b px-3.5 py-2.5 text-[11px] font-semibold leading-snug ${
              theme === "dark" ? "border-white/10 text-gray-400" : "border-gray-100 text-gray-500"
            }`}
          >
            Ketik nama tempat —{" "}
            <span className={theme === "dark" ? "text-white" : "text-gray-800"}>
              “deket UNESA”
            </span>{" "}
            — atau pilih kawasan di bawah.
          </p>
        )}

        {/* `min-h-0` wajib: tanpa itu anak flex tidak boleh menyusut di bawah
            tinggi isinya, jadi daftar panjang menembus batas panel alih-alih
            menggulir di dalamnya. */}
        <div ref={daftarRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {memuat && items.length === 0 && (
            <div className={`px-4 py-5 text-xs ${t.kosong}`}>Mencari tempat…</div>
          )}

          {jumlahKelas > 0 && (
            <p
              className={`px-3.5 pb-1 pt-2.5 text-[10px] font-extrabold uppercase tracking-wider ${t.sub}`}
            >
              {populer ? "Cari per kawasan" : "Cari per kawasan"}
            </p>
          )}

          {items.map((s, i) => (
            <Fragment key={s.nilai}>
            {i === jumlahKelas && jumlahKelas > 0 && (
              <p
                className={`px-3.5 pb-1 pt-3 text-[10px] font-extrabold uppercase tracking-wider ${t.sub}`}
              >
                {populer ? "Tempat terpopuler" : "Tempat tertentu"}
              </p>
            )}
            <button
              type="button"
              data-i={i}
              onMouseEnter={() => onHover(i)}
              onClick={() => onPilih(s)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${
                i === aktif ? (theme === "dark" ? "bg-white/5" : "bg-gray-50") : t.row
              }`}
            >
              <span
                className="shrink-0 w-8 h-8 rounded-xl grid place-items-center"
                style={{ backgroundColor: `${s.warna}22`, color: s.warna }}
              >
                <Icon icon={s.icon} className="text-lg" />
              </span>

              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-bold truncate ${t.nama}`}>
                  {s.nama}
                </span>
                <span className={`block text-[11px] truncate ${t.sub}`}>
                  {/* Baris jenis menjelaskan MAKSUDNYA, bukan mengulang
                      kategori yang sudah tertulis di judulnya. Tanpa kalimat
                      ini, "Semua kampus di Malang" dan "Universitas Negeri
                      Malang" terlihat seperti dua baris yang setara — padahal
                      yang satu kawasan dan yang satu titik. */}
                  {s.kelasSemua ? (
                    s.gantiWilayah ? (
                      // Wilayah yang diminta belum ada isinya. Dikatakan
                      // terus terang, karena "tidak ditemukan" akan salah
                      // dibaca sebagai "salah ketik" — padahal ejaannya benar,
                      // yang belum ada justru asetnya.
                      <span className="text-amber-400/80">
                        Wilayah itu belum ada di kamus — ini se-Indonesia
                      </span>
                    ) : (
                      <>Cari di kawasannya — tidak terikat satu tempat</>
                    )
                  ) : (
                    <>
                      {s.label}
                      {s.kota ? ` · ${s.kota}` : ""}
                      {s.cabang && s.cabang > 1 ? ` · ${s.cabang} cabang` : ""}
                    </>
                  )}
                </span>
              </span>

              <span
                className={`shrink-0 text-[11px] font-bold ${
                  s.kelasSemua ? "text-emerald-400/80" : t.sub
                }`}
              >
                {s.jumlah.toLocaleString("id-ID")} {s.satuan ?? "properti"}
              </span>
            </button>
            </Fragment>
          ))}

          {/* ── ALAMAT & KAWASAN ────────────────────────────────────────────
              Selalu ada selama ada yang diketik, dan ditaruh SETELAH tempat:
              yang mengetik "unesa" memang memaksudkan kampusnya, dan baris ini
              tidak boleh merebut sorotan darinya. Tapi ia tidak pernah absen —
              karena inilah yang sebenarnya terjadi kalau Enter ditekan, dan
              satu-satunya jawaban yang benar untuk nama jalan & kelurahan. */}
          {alamat && (
            <>
              <p
                className={`px-3.5 pb-1 pt-3 text-[10px] font-extrabold uppercase tracking-wider ${t.sub}`}
              >
                Alamat &amp; kawasan
              </p>
              <button
                type="button"
                data-i={items.length}
                onMouseEnter={() => onHover(items.length)}
                onClick={() => onPilihAlamat?.()}
                className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${
                  items.length === aktif
                    ? theme === "dark"
                      ? "bg-white/5"
                      : "bg-gray-50"
                    : t.row
                }`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
                    theme === "dark"
                      ? "bg-sky-400/15 text-sky-300"
                      : "bg-sky-50 text-sky-600"
                  }`}
                >
                  <Icon icon="solar:magnifer-bold-duotone" className="text-lg" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-bold ${t.nama}`}>
                    “{alamat.teks}”
                  </span>
                  <span className={`block truncate text-[11px] ${t.sub}`}>
                    Cari di alamat, kelurahan, kecamatan &amp; judul
                  </span>
                </span>
                <span
                  className={`shrink-0 text-[11px] font-bold ${
                    alamat.jumlah && alamat.jumlah > 0 ? "text-sky-300" : t.sub
                  }`}
                >
                  {alamat.jumlah === null
                    ? "cari"
                    : `${alamat.jumlah.toLocaleString("id-ID")} properti`}
                </span>
              </button>
            </>
          )}

          {/* Ajakan mencoba pencarian per kawasan — ditampilkan HANYA saat tak
              ada tempat yang cocok, dan dirumuskan sebagai kemampuan tambahan,
              bukan sebagai laporan kegagalan. Chipnya bisa diketuk: cara
              tercepat mempelajari sebuah fitur adalah memakainya sekali. */}
          {!memuat && items.length === 0 && onContoh && (
            <div
              className={`border-t px-3.5 py-3 ${
                theme === "dark" ? "border-white/10" : "border-gray-100"
              }`}
            >
              <p className={`text-[11px] font-semibold ${t.sub}`}>
                Cari juga berdasarkan tempat
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["deket kampus", "deket sekolah", "deket rumah sakit", "deket mall"].map(
                  (c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onContoh(c)}
                      className={`rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors ${
                        theme === "dark"
                          ? "border-white/10 bg-white/5 text-gray-300 hover:border-primary/40 hover:text-white"
                          : "border-gray-200 bg-gray-50 text-gray-600 hover:border-primary/40 hover:text-gray-900"
                      }`}
                    >
                      {c}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}
        </div>

        {/* Petunjuk papan ketik — hanya di mode melayang. Di layar sentuh
            tidak ada tombol panah, jadi baris ini cuma memakan tinggi yang
            justru sedang diperebutkan dengan keyboard virtual. */}
        {!inline && (items.length > 0 || alamat) && (
          <div
            className={`px-3.5 py-2 border-t text-[10px] flex items-center gap-2 ${t.panel} ${t.sub}`}
          >
            <kbd className={`px-1.5 py-0.5 rounded border ${t.kbd}`}>↑↓</kbd>
            pilih
            <kbd className={`px-1.5 py-0.5 rounded border ${t.kbd}`}>Enter</kbd>
            {/* Petunjuk harus menyebut apa yang benar-benar akan terjadi pada
                baris yang SEDANG tersorot. "cari di sekitarnya" saat sorotan
                ada di baris alamat adalah janji yang salah. */}
            {populer
              ? "pilih"
              : alamat && aktif >= items.length
                ? "cari alamat"
                : "cari di sekitarnya"}
          </div>
        )}
    </>
  );

  /**
   * MENYATU. Tidak di-portal, tidak `fixed`, tidak ber-z-index: panel ini
   * memang harus ikut mengalir supaya kolom di bawahnya bergeser turun, bukan
   * tertutup. Tingginya tetap dibatasi — daftar sepanjang layar akan mendorong
   * tombol "Cari Sekarang" sejauh dua kali gulir dari tempatnya.
   */
  if (inline) {
    return (
      <motion.div
        data-search-portal="true"
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        onMouseDown={(e) => e.preventDefault()}
        className={`mt-2 flex max-h-[min(46vh,320px)] flex-col overflow-hidden rounded-2xl border ${t.panel}`}
      >
        {isi}
      </motion.div>
    );
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        data-search-portal="true"
        initial={{ opacity: 0, y: geo!.keAtas ? 6 : -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: geo!.keAtas ? 6 : -6 }}
        transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
        onMouseDown={(e) => e.preventDefault()}
        style={{
          position: "fixed",
          top: geo!.keAtas ? undefined : geo!.atas,
          bottom: geo!.keAtas ? geo!.bawah : undefined,
          left: geo!.kiri,
          width: geo!.lebar,
          maxHeight: geo!.tinggiMaks,
          zIndex: 99999,
        }}
        className={`rounded-2xl shadow-2xl border overflow-hidden flex flex-col ${t.panel}`}
      >
        {isi}
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

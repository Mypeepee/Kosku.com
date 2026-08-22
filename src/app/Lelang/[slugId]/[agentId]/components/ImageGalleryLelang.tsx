"use client";

/**
 * Galeri foto listing lelang — SALINAN PERSIS galeri Sewa
 * (`src/app/Sewa/[id]/components/ImageGallery.tsx`). Tata letak, transisi, dan
 * lightbox-nya sengaja tidak dibedakan sedikit pun: pembeli yang pindah dari
 * halaman Sewa ke Lelang tidak boleh merasa sedang memakai aplikasi lain.
 *
 * Bedanya cuma isi kepala lightbox. Judul listing lelang datang dari sumber
 * lelang dan sering tidak menyebut lokasi ("Sebidang tanah berikut bangunan
 * SHM No. 1234") — jadi yang dipajang alamat lengkapnya, bukan judulnya.
 * Pemanggil yang menentukan lewat prop `judul`.
 *
 * Jumlah foto di luar kendali kita — bisa 1 sampai 20. Karena itu grid desktop
 * TIDAK memakai jumlah tetap lalu menambal kekurangannya dengan mengulang foto
 * terakhir (cara lama): foto yang sama muncul dua kali terbaca sebagai aset
 * yang malas didokumentasikan. Yang dilakukan di sini, bentuk gridnya yang
 * menyesuaikan jumlah foto.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Icon } from "@iconify/react";

interface Props {
  images: string[];
  /** Kepala lightbox — untuk lelang diisi alamat lengkap, bukan judul listing. */
  judul: string;
  isSold?: boolean;
  soldLabel?: string;
}

const PLACEHOLDER = "/images/hero/banner.jpg";

/**
 * Span tiap sel pada grid 4 kolom × 2 baris, per jumlah foto. Kelas ditulis
 * utuh (bukan dirakit dari template string) supaya Tailwind bisa memindainya.
 */
const TATA_LETAK: Record<number, string[]> = {
  1: ["col-span-4 row-span-2"],
  2: ["col-span-2 row-span-2", "col-span-2 row-span-2"],
  3: ["col-span-2 row-span-2", "col-span-2 row-span-1", "col-span-2 row-span-1"],
  4: [
    "col-span-2 row-span-2",
    "col-span-2 row-span-1",
    "col-span-1 row-span-1",
    "col-span-1 row-span-1",
  ],
  5: [
    "col-span-2 row-span-2",
    "col-span-1 row-span-1",
    "col-span-1 row-span-1",
    "col-span-1 row-span-1",
    "col-span-1 row-span-1",
  ],
};

function isValidImageUrl(url: string): boolean {
  if (!url || url.trim() === "") return false;
  const trimmed = url.trim().toLowerCase();

  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/")
  );
}

function normalizeImages(rawImages: string[] | undefined | null): string[] {
  if (!rawImages || rawImages.length === 0) return [];

  return rawImages
    .map((s) => (s || "").trim())
    .filter((s) => s.length > 0)
    .map((s) =>
      // Selain URL utuh, anggap fileId Google Drive.
      isValidImageUrl(s) ? s : `https://drive.google.com/thumbnail?id=${s}`,
    );
}

export default function ImageGalleryLelang({
  images,
  judul,
  isSold = false,
  soldLabel = "Terjual",
}: Props) {
  const normalized = normalizeImages(images);
  const foto = normalized.length > 0 ? normalized : [PLACEHOLDER];
  const grid = foto.slice(0, 5);
  const tataLetak = TATA_LETAK[grid.length] ?? TATA_LETAK[5];

  const [terbuka, setTerbuka] = useState(false);
  const [indeks, setIndeks] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [slideAktif, setSlideAktif] = useState(0);
  /** Dipisah dari `terbuka` supaya transisi masuk sempat berjalan satu frame. */
  const [tampil, setTampil] = useState(false);
  const [arah, setArah] = useState<1 | -1>(1);
  /** Indeks foto yang sudah selesai dimuat — penentu tampil/tidaknya spinner. */
  const [dimuat, setDimuat] = useState<Record<number, boolean>>({});
  const sliderRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const tutupRef = useRef<HTMLButtonElement>(null);
  const sentuhX = useRef<number | null>(null);

  useEffect(() => setMounted(true), []);

  const buka = (i: number) => {
    setIndeks(i);
    setArah(1);
    setTerbuka(true);
  };

  const tutup = useCallback(() => {
    setTampil(false);
    // Tunggu transisi keluar selesai sebelum melepas DOM-nya; kalau langsung
    // di-unmount, lightbox terlihat "hilang" mendadak dan mata kehilangan
    // jejak posisi foto yang tadi dilihat.
    setTimeout(() => setTerbuka(false), 220);
  }, []);

  const berikutnya = useCallback(() => {
    setArah(1);
    setIndeks((p) => (p + 1) % foto.length);
  }, [foto.length]);

  const sebelumnya = useCallback(() => {
    setArah(-1);
    setIndeks((p) => (p - 1 + foto.length) % foto.length);
  }, [foto.length]);

  const keFoto = useCallback(
    (i: number) => {
      setArah(i > indeks ? 1 : -1);
      setIndeks(i);
    },
    [indeks],
  );

  const tandaiDimuat = useCallback(
    (i: number) => setDimuat((d) => (d[i] ? d : { ...d, [i]: true })),
    [],
  );

  /**
   * Foto sebelum & sesudah yang ikut dirender diam-diam. Hanya dua — cukup
   * untuk menutupi kecepatan jari, dan tidak membuat browser mengunduh seluruh
   * album beresolusi penuh sekaligus di koneksi seluler.
   */
  const tetangga = React.useMemo(() => {
    if (foto.length < 2) return [];
    const maju = (indeks + 1) % foto.length;
    const mundur = (indeks - 1 + foto.length) % foto.length;
    return Array.from(new Set([maju, mundur])).filter((i) => i !== indeks);
  }, [indeks, foto.length]);

  useEffect(() => {
    if (!terbuka) return;

    // Scrollbar hilang saat body dikunci → lebar viewport bertambah dan header
    // di belakang bergeser. Lebarnya diganti padding supaya tidak ada lompatan.
    const asalOverflow = document.body.style.overflow;
    const asalPad = document.body.style.paddingRight;
    const lebarScrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (lebarScrollbar > 0) document.body.style.paddingRight = `${lebarScrollbar}px`;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") tutup();
      else if (e.key === "ArrowRight") berikutnya();
      else if (e.key === "ArrowLeft") sebelumnya();
      else if (e.key === "Home") keFoto(0);
      else if (e.key === "End") keFoto(foto.length - 1);
    };
    window.addEventListener("keydown", onKey);

    const id = requestAnimationFrame(() => {
      setTampil(true);
      tutupRef.current?.focus();
    });

    return () => {
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(id);
      document.body.style.overflow = asalOverflow;
      document.body.style.paddingRight = asalPad;
    };
  }, [terbuka, berikutnya, sebelumnya, keFoto, tutup, foto.length]);

  // Thumbnail aktif selalu ditarik ke dalam pandangan — tanpa ini, setelah
  // beberapa kali panah kanan, penanda aktif berada di luar rail dan pengguna
  // kehilangan orientasi "saya di foto ke berapa".
  useEffect(() => {
    if (!terbuka) return;
    railRef.current
      ?.querySelector<HTMLElement>(`[data-thumb="${indeks}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [indeks, terbuka]);

  const geserMobile = (arah: "kiri" | "kanan") => {
    const el = sliderRef.current;
    if (!el) return;
    const target = Math.max(
      0,
      Math.min(
        Math.round(el.scrollLeft / el.clientWidth) + (arah === "kiri" ? -1 : 1),
        foto.length - 1,
      ),
    );
    el.scrollTo({ left: target * el.clientWidth, behavior: "smooth" });
    setSlideAktif(target);
  };

  const OverlayTerjual = () =>
    isSold ? (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 backdrop-blur-[1px] pointer-events-none">
        <span className="rounded-2xl border border-rose-400/30 bg-black/70 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-rose-300 shadow-2xl">
          {soldLabel}
        </span>
      </div>
    ) : null;

  return (
    <div className="relative w-full">
      {/* ── DESKTOP ── */}
      <div className="relative hidden lg:block">
        <div className="grid grid-cols-4 grid-rows-2 gap-2.5 h-[460px] rounded-[1.75rem] overflow-hidden">
          {grid.map((src, i) => (
            <button
              key={`${src}-${i}`}
              onClick={() => buka(i)}
              className={`group relative overflow-hidden bg-[#151515] ${tataLetak[i]}`}
              aria-label={`Buka foto ${i + 1}`}
            >
              <Image
                src={src}
                alt={`${judul} — foto ${i + 1}`}
                fill
                priority={i === 0}
                sizes={i === 0 ? "50vw" : "25vw"}
                className={`object-cover transition-transform duration-700 group-hover:scale-[1.07] ${
                  isSold ? "grayscale" : ""
                }`}
              />
              <div className="absolute inset-0 bg-black/0 transition-colors duration-500 group-hover:bg-black/25" />
            </button>
          ))}
        </div>

        <OverlayTerjual />

        {foto.length > 1 && (
          <button
            onClick={() => buka(0)}
            className="absolute bottom-5 right-5 z-30 flex items-center gap-2 rounded-xl border border-white/15 bg-black/70 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md transition-all hover:bg-white hover:text-black active:scale-95"
          >
            <Icon icon="solar:gallery-wide-bold-duotone" className="text-base" />
            Lihat semua {foto.length} foto
          </button>
        )}
      </div>

      {/* ── MOBILE / TABLET ── */}
      {/* Tingginya ikut lebar layar lewat clamp, bukan lompat-lompat per
          breakpoint: di HP sempit (320–390px) tinggi tetap 300px bikin foto
          landscape kelihatan terpotong parah, sedangkan di tablet 380px terlalu
          pendek. Batas bawah 240px menjaga foto tetap terbaca di layar terkecil. */}
      <div className="relative h-[clamp(240px,66vw,400px)] w-full overflow-hidden rounded-2xl sm:rounded-3xl lg:hidden">
        <div
          ref={sliderRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            setSlideAktif(Math.round(el.scrollLeft / el.clientWidth));
          }}
          className="flex h-full w-full snap-x snap-mandatory overflow-x-auto hide-scrollbar touch-pan-x"
        >
          {foto.map((src, i) => (
            <div
              key={`${src}-${i}`}
              onClick={() => buka(i)}
              className="relative h-full min-w-full snap-center bg-[#151515]"
            >
              <Image
                src={src}
                alt={`${judul} — foto ${i + 1}`}
                fill
                priority={i === 0}
                sizes="100vw"
                className={`object-cover ${isSold ? "grayscale" : ""}`}
              />
            </div>
          ))}
        </div>

        <OverlayTerjual />

        {slideAktif > 0 && (
          <button
            onClick={() => geserMobile("kiri")}
            className="absolute left-3 top-1/2 z-30 -translate-y-1/2 rounded-full border border-white/10 bg-black/60 p-2.5 text-white backdrop-blur-md active:scale-95"
            aria-label="Foto sebelumnya"
          >
            <Icon icon="solar:alt-arrow-left-linear" className="text-lg" />
          </button>
        )}
        {slideAktif < foto.length - 1 && (
          <button
            onClick={() => geserMobile("kanan")}
            className="absolute right-3 top-1/2 z-30 -translate-y-1/2 rounded-full border border-white/10 bg-black/60 p-2.5 text-white backdrop-blur-md active:scale-95"
            aria-label="Foto berikutnya"
          >
            <Icon icon="solar:alt-arrow-right-linear" className="text-lg" />
          </button>
        )}

        <div className="pointer-events-none absolute bottom-4 right-4 z-30 rounded-lg border border-white/10 bg-black/70 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-md">
          {slideAktif + 1} / {foto.length}
        </div>

        {foto.length > 1 && (
          <div className="pointer-events-none absolute bottom-4 left-4 z-30 flex gap-1.5">
            {foto.slice(0, 6).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === slideAktif ? "w-5 bg-white" : "w-1.5 bg-white/40"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── LIGHTBOX ──
          Latar TIDAK memakai class opacity Tailwind. `bg-black/98` sempat
          dipakai di sini dan hasilnya lightbox tembus pandang: 98 bukan langkah
          yang ada di skala opacity bawaan, jadi class-nya tidak pernah
          digenerate — tanpa error, tanpa peringatan. Warna latar sekarang
          ditulis eksplisit lewat `style` supaya tidak bisa gagal diam-diam. */}
      {mounted &&
        terbuka &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Galeri foto ${judul}`}
            // Kolom flex, BUKAN grid. Versi grid sebelumnya melebar melewati
            // layar HP: item grid punya `min-width: auto`, jadi baris rail
            // thumbnail menolak menyusut di bawah lebar min-content-nya
            // (8 thumbnail ≈ 530px) dan menyeret SELURUH dialog jadi lebih
            // lebar dari viewport. Akibatnya semua yang ditambatkan ke tepi
            // kanan — tombol ✕ dan panah kanan — terdorong keluar layar, dan
            // fotonya kelihatan terpotong. Di flex kolom lebar anak ditentukan
            // `stretch` ke lebar wadah, jadi isi yang kepanjangan meluber di
            // dalam kotaknya sendiri (rail-nya yang scroll), bukan membesarkan
            // kotaknya. `min-w-0` di rail menutup celah yang sama dari sisi
            // flex item.
            //
            // `h-[100dvh]` ditulis bersama `inset-0`, bukan menggantikannya:
            // dvh mengikuti viewport VISUAL sehingga rail tidak tersembunyi di
            // balik toolbar browser mobile, dan kalau browser tidak mengenal
            // satuannya deklarasi itu diabaikan lalu `bottom: 0` dari inset-0
            // yang mengambil alih — tingginya tetap benar.
            className="fixed inset-0 z-[100000] flex h-[100dvh] flex-col overflow-hidden overscroll-contain"
            style={{
              background:
                "radial-gradient(120% 90% at 50% 0%, #131316 0%, #08080A 55%, #050506 100%)",
              opacity: tampil ? 1 : 0,
              transition: "opacity 220ms ease",
            }}
            onTouchStart={(e) => (sentuhX.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (sentuhX.current === null) return;
              const delta = e.changedTouches[0].clientX - sentuhX.current;
              if (Math.abs(delta) > 55) delta < 0 ? berikutnya() : sebelumnya();
              sentuhX.current = null;
            }}
          >
            {/* ── Bar atas ── */}
            <div className="flex shrink-0 items-center justify-between gap-3 px-3 pb-2 pt-[max(0.6rem,env(safe-area-inset-top))] sm:gap-4 sm:px-7 sm:pb-3 sm:pt-6">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-extrabold tracking-tight text-white sm:text-[15px]">
                  {judul}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-white/35">
                  Foto {indeks + 1} dari {foto.length}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {/* Pintasan papan ketik (← → Esc) tetap aktif, cuma tidak
                    dipajang — petunjuknya makan tempat di bar atas. */}
                {/* Satu-satunya jalan keluar yang terlihat setelah petunjuk
                    keyboard dilepas — jadi dibuat mencolok, bukan abu-abu yang
                    menyatu dengan latar. */}
                <button
                  ref={tutupRef}
                  onClick={tutup}
                  className="group grid h-10 w-10 shrink-0 place-items-center rounded-full border border-red-400/50 bg-red-500/20 text-red-300 shadow-[0_0_18px_rgba(239,68,68,0.45)] outline-none backdrop-blur-md transition-all duration-200 hover:border-red-400 hover:bg-red-500 hover:text-white hover:shadow-[0_0_28px_rgba(239,68,68,0.7)] focus-visible:ring-2 focus-visible:ring-red-400 active:scale-95"
                  aria-label="Tutup galeri"
                >
                  <Icon
                    icon="solar:close-circle-bold"
                    className="text-xl transition-transform duration-200 group-hover:rotate-90"
                  />
                </button>
              </div>
            </div>

            {/* ── Panggung foto ──
                Tidak ada klik-di-luar-untuk-menutup. Dengan object-contain,
                area kosong di kiri/kanan foto potret itu LUAS, dan di sanalah
                jempol biasanya mendarat saat orang menggeser — galeri yang
                menutup sendiri di tengah pengamatan terasa seperti kesalahan
                aplikasi. Penutup tetap eksplisit: tombol ✕ dan Esc. */}
            <div className="relative min-h-0 flex-1 px-3 py-1 sm:px-6 sm:py-2">
              {/* Foto tetangga ikut dirender penuh (transparan) — inilah yang
                  membuat panah terasa instan. Versi sebelumnya "meng-preload"
                  dengan width={16}: itu URL optimizer yang BERBEDA dari yang
                  dipakai foto besar, jadi tidak pernah menghangatkan cache yang
                  benar. Ukuran & sizes-nya harus persis sama seperti di bawah. */}
              {tetangga.map((i) => (
                <div
                  key={`pra-${i}`}
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-0"
                >
                  <Image
                    src={foto[i]}
                    alt=""
                    fill
                    quality={92}
                    sizes="100vw"
                    className="object-contain"
                    onLoad={() => tandaiDimuat(i)}
                  />
                </div>
              ))}

              <div
                key={indeks}
                className="animate-lightbox-masuk relative h-full w-full"
                style={{
                  ["--lightbox-arah" as string]: arah === 1 ? "28px" : "-28px",
                }}
              >
                <Image
                  src={foto[indeks]}
                  alt={`${judul} — foto ${indeks + 1}`}
                  fill
                  quality={92}
                  priority
                  sizes="100vw"
                  className="object-contain"
                  onLoad={() => tandaiDimuat(indeks)}
                />
              </div>

              {/* Foto besar diambil ulang lewat optimizer saat pertama dibuka,
                  dan itu bisa lebih dari satu detik. Tanpa penanda, layar hitam
                  kosong terbaca sebagai galeri yang rusak — bukan sebagai
                  "sedang memuat". Hanya muncul untuk foto yang memang belum
                  pernah selesai dimuat, jadi navigasi bolak-balik tetap mulus. */}
              {!dimuat[indeks] && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div className="flex flex-col items-center gap-3">
                    <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[#86efac]" />
                    <span className="text-[11px] font-semibold tracking-wide text-white/30">
                      Memuat foto…
                    </span>
                  </div>
                </div>
              )}

              {/* Panah melayang HANYA dari sm ke atas. Di layar lebar, foto
                  potret menyisakan area kosong lebar di kiri/kanan, jadi panah
                  di sana tidak menutupi apa pun. Di HP sebaliknya: foto potret
                  memenuhi hampir seluruh lebar layar, dan panah melayang pasti
                  mendarat di atas fotonya. Versi mobile-nya pindah ke bar bawah
                  bersama rail — lihat di bawah. */}
              {foto.length > 1 && (
                <>
                  <button
                    onClick={sebelumnya}
                    className="absolute left-6 top-1/2 z-30 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-white/[0.08] bg-black/50 text-white backdrop-blur-md transition-all hover:bg-white hover:text-black active:scale-95 sm:grid"
                    aria-label="Foto sebelumnya"
                  >
                    <Icon icon="solar:alt-arrow-left-linear" className="text-2xl" />
                  </button>
                  <button
                    onClick={berikutnya}
                    className="absolute right-6 top-1/2 z-30 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-white/[0.08] bg-black/50 text-white backdrop-blur-md transition-all hover:bg-white hover:text-black active:scale-95 sm:grid"
                    aria-label="Foto berikutnya"
                  >
                    <Icon icon="solar:alt-arrow-right-linear" className="text-2xl" />
                  </button>
                </>
              )}
            </div>

            {/* ── Bar bawah: panah (mobile) + rail thumbnail ──
                Penanda aktif digambar DI DALAM thumbnail (ring-inset di atas
                foto), bukan sebagai ring+offset di luar kotak. Rail ini
                `overflow-x-auto`, dan CSS memaksa sumbu-y ikut jadi `auto` —
                apa pun yang melewati tepi atas/bawah kotak ikut terpotong.
                Itu sebabnya versi sebelumnya cuma kelihatan hijau di kiri dan
                kanan. `py-1.5` di rail menyisakan ruang untuk skala & glow. */}
            {foto.length > 1 ? (
              <div className="shrink-0 pb-[max(0.55rem,env(safe-area-inset-bottom))] pt-1.5 sm:pt-2">
                <div className="flex items-center gap-2 px-2 sm:px-7">
                  {/* Panah versi mobile. Ditaruh mengapit rail, bukan melayang
                      di tepi foto: selain tidak menutupi foto, tepi tengah
                      layar 6 inci itu jauh dari jempol sementara area bawah
                      justru yang paling gampang dijangkau. */}
                  <button
                    onClick={sebelumnya}
                    aria-label="Foto sebelumnya"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/85 backdrop-blur-md transition-all active:scale-95 sm:hidden"
                  >
                    <Icon icon="solar:alt-arrow-left-linear" className="text-lg" />
                  </button>

                  <div
                    ref={railRef}
                    className="hide-scrollbar flex min-w-0 flex-1 justify-start gap-2 overflow-x-auto py-1.5 sm:justify-center sm:gap-2.5 sm:py-2"
                  >
                    {foto.map((src, i) => {
                      const aktif = i === indeks;
                      return (
                        <button
                          key={`${src}-thumb-${i}`}
                          data-thumb={i}
                          onClick={() => keFoto(i)}
                          aria-label={`Lihat foto ${i + 1}`}
                          aria-current={aktif}
                          className={`relative h-11 w-14 shrink-0 overflow-hidden rounded-lg outline-none transition-all duration-300 sm:h-16 sm:w-24 sm:rounded-xl ${
                            aktif
                              ? "scale-105 opacity-100 shadow-[0_6px_20px_-6px_rgba(134,239,172,0.55)]"
                              : "opacity-40 grayscale hover:scale-105 hover:opacity-90 hover:grayscale-0"
                          }`}
                        >
                          <Image
                            src={src}
                            alt=""
                            fill
                            sizes="96px"
                            className="object-cover"
                          />

                          {/* Bingkai penanda — mengelilingi keempat sisi karena
                              berada di dalam kotak yang di-clip, bukan di luarnya. */}
                          <span
                            className={`pointer-events-none absolute inset-0 rounded-lg ring-inset transition-all duration-300 sm:rounded-xl ${
                              aktif
                                ? "ring-2 ring-[#86efac]"
                                : "ring-1 ring-white/10"
                            }`}
                          />
                          {aktif && (
                            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 rounded-b-lg bg-gradient-to-t from-[#86efac]/25 to-transparent sm:rounded-b-xl" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={berikutnya}
                    aria-label="Foto berikutnya"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/85 backdrop-blur-md transition-all active:scale-95 sm:hidden"
                  >
                    <Icon icon="solar:alt-arrow-right-linear" className="text-lg" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]" />
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

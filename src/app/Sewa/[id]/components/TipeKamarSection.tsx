"use client";

/**
 * Daftar tipe kamar — bagian paling menentukan di halaman detail kos.
 *
 * Satu listing kos mewakili satu gedung, dan gedung itu hampir tidak pernah
 * seragam: dari 16 kamar bisa ada 2 yang kamar mandi dalam + AC dan jauh lebih
 * mahal. Kalau halaman ini hanya menampilkan satu harga "mulai dari", calon
 * penghuni datang survei dengan ekspektasi yang salah — persis masalah yang
 * bikin tabel listing_kamar_tipe dibuat.
 *
 * ── BENTUK KARTUNYA ─────────────────────────────────────────────────────────
 *
 * Foto di kiri, isi di kanan, harga & tombol di baris paling bawah. Ini pola
 * pemilihan kamar yang sudah dipakai Booking/Agoda/Traveloka, dan dipilih bukan
 * karena umum, melainkan karena kartunya tetap SATU KOLOM ke bawah: harga semua
 * tipe berada di garis vertikal yang sama, jadi membandingkannya cukup dengan
 * menggerakkan mata lurus — bukan melompat kiri-kanan seperti pada grid.
 *
 * Foto mendapat porsi besar dengan sengaja. Yang sebenarnya ingin diketahui
 * pencari kos ("kamarnya seperti apa?") tidak pernah terjawab oleh daftar
 * fasilitas; satu foto menjawabnya sebelum sebaris teks pun dibaca. Kalau tipe
 * ini belum punya foto, slotnya tetap ada sebagai penampung bergaris putus —
 * bentuk yang jujur ("belum diisi") dan bukan gambar rusak.
 *
 * ── YANG SENGAJA TIDAK ADA DI SINI ──────────────────────────────────────────
 *
 * Versi sebelumnya menaruh semuanya di kartu yang sama: chip berbingkai untuk
 * tiap spesifikasi, 12 chip fasilitas, meter + angka persen, badge status,
 * daftar harga semua durasi, plus kolom harga tersendiri. Semua benar, semua
 * berguna, dan justru karena itu tidak ada yang menonjol. Yang dipangkas:
 *
 *   • Spesifikasi jadi satu baris teks bertitik ("9 m² · Kamar mandi dalam"),
 *     bukan tiga chip berbingkai — ini kalimat, bukan tombol.
 *   • Fasilitas dibatasi 4 chip + "+N", selebihnya dibuka atas permintaan.
 *   • Angka persen di meter ketersediaan dibuang; barnya sendiri sudah
 *     menyampaikan proporsi, angkanya cuma mengulang.
 *   • Harga durasi lain diringkas jadi SATU chip hemat ("Tahunan −12%"), bukan
 *     daftar bergaris.
 *   • Badge "Termurah"/"Penuh"/"Dipilih" pindah ke atas foto — tempat yang
 *     memang biasa dipakai badge, dan tidak lagi mengambil baris di kolom teks.
 *
 * ── SOAL KERAPATAN ─────────────────────────────────────────────────────────
 *
 * Satu listing bisa punya 5–6 tipe. Kalau tiap kartu boros satu layar, tidak
 * ada dua tipe yang muat bersamaan — padahal seluruh alasan halaman ini ada
 * adalah supaya tipe bisa DIBANDINGKAN. Jadi ruang di kartu ini diperlakukan
 * sebagai barang langka:
 *
 *   • Foto mengikuti tinggi baris grid, tidak dikunci rasio. Rasio tetap
 *     membuat tinggi foto ditentukan lebarnya sendiri, dan selisih terhadap
 *     teks di sebelahnya jatuh jadi ruang kosong yang tidak bisa diisi apa pun.
 *   • Yang dipangkas adalah jarak, bukan ukuran huruf. Ukuran teks tetap
 *     (judul 17px, harga 1.5rem, chip 11px) — kartu rapat yang tidak terbaca
 *     bukan perbaikan.
 *   • "+N lainnya" bisa dibalik jadi "Ringkas". Membuka 14 fasilitas tetap
 *     menambah tiga baris, jadi harus ada jalan pulang.
 *
 * Kedalamannya datang dari lapisan, bukan garis: permukaan kartu bergradasi
 * (terang di atas, seolah cahaya dari langit-langit), foto mengambang dengan
 * bayangannya sendiri di atas permukaan itu, dan sorot halus mengikuti kursor.
 */

import React, { useRef, useState } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import {
  DURASI_META,
  KAMAR_MANDI,
  formatRupiah,
  formatRupiahSingkat,
  tipeTermurah,
  type DurasiKey,
  type TipeKamarView,
} from "@/lib/kosDetail";
import { AMBANG_KAMAR_MENIPIS } from "@/lib/kosCard";
import {
  AKSEN,
  AKSEN_SECTION,
  KILAU_KARTU,
  LINE,
  SURFACE,
  aksenSisaKamar,
} from "./sewaTheme";
import type { BookingState } from "../lib/useBooking";
import type { SewaDetailData } from "../types";

const MAKS_FASILITAS_TAMPIL = 4;

/**
 * Panjang satu satuan durasi dalam hari — dipakai HANYA untuk menghitung persen
 * hemat antar durasi ("tahunan 12% lebih murah per harinya"), bukan untuk
 * tagihan. Tagihan tetap dihitung kalender penuh di useBooking/tambahDurasi.
 */
const HARI_PER_DURASI: Record<DurasiKey, number> = {
  HARIAN: 1,
  MINGGUAN: 7,
  BULANAN: 30.4375,
  TAHUNAN: 365.25,
};

/** Hemat durasi `d` dibanding durasi acuan, dalam persen bulat. 0 = tidak hemat. */
function persenHemat(
  harga: Partial<Record<DurasiKey, number>>,
  acuan: DurasiKey,
  d: DurasiKey,
): number {
  const a = harga[acuan];
  const b = harga[d];
  if (!a || !b) return 0;
  const perHariAcuan = a / HARI_PER_DURASI[acuan];
  const perHariD = b / HARI_PER_DURASI[d];
  if (perHariD >= perHariAcuan) return 0;
  return Math.round((1 - perHariD / perHariAcuan) * 100);
}

/**
 * Gradasi bar ketersediaan. Ambangnya SAMA dengan aksenSisaKamar (yang mewarnai
 * teksnya) — keduanya harus selalu sepakat, jadi ambangnya diambil dari
 * konstanta yang sama dengan card listing, bukan angka 3 yang ditulis ulang.
 */
function barSisa(sisa: number): string {
  if (sisa <= 0) return "bg-gradient-to-r from-rose-500/50 to-rose-400";
  return sisa <= AMBANG_KAMAR_MENIPIS
    ? "bg-gradient-to-r from-amber-500/50 to-amber-300"
    : "bg-gradient-to-r from-emerald-500/40 to-emerald-300";
}

/** Badge kecil di atas foto — dibuat kabur di belakangnya supaya tetap terbaca
 *  di atas foto terang maupun gelap. */
function BadgeFoto({
  icon,
  label,
  className,
}: {
  icon: string;
  label: string;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-widest backdrop-blur-md ${className}`}
    >
      <Icon icon={icon} className="text-[11px]" />
      {label}
    </span>
  );
}

/**
 * Slot foto satu tipe kamar.
 *
 * Kolom `gambar` di listing_kamar_tipe belum diisi form tambah properti, jadi
 * untuk sementara hampir semua tipe masuk ke cabang "belum ada foto". Bentuk
 * kosongnya dirancang (garis putus + ikon), bukan kotak abu: yang dilihat agent
 * saat mengelola listing-nya adalah undangan untuk mengisi, dan yang dilihat
 * pencari kos adalah "memang belum ada", bukan "gambarnya gagal dimuat".
 */
function FotoTipe({
  foto,
  nama,
  penuh,
  terpilih,
  termurah,
  className = "",
}: {
  foto: string[];
  nama: string;
  penuh: boolean;
  terpilih: boolean;
  termurah: boolean;
  /** Penempatan di grid kartu — lihat KartuTipe. */
  className?: string;
}) {
  const [indeks, setIndeks] = useState(0);
  const ada = foto.length > 0;
  const banyak = foto.length > 1;

  // stopPropagation: kartunya sendiri bisa diklik untuk memilih tipe, dan
  // menggeser foto bukan berarti ingin memilih.
  const geser = (e: React.MouseEvent, arah: 1 | -1) => {
    e.stopPropagation();
    setIndeks((p) => (p + arah + foto.length) % foto.length);
  };

  return (
    // Tingginya TIDAK dikunci rasio, melainkan mengikuti tinggi baris grid —
    // artinya foto selalu berhenti persis di garis bawah teks di sebelahnya.
    // Versi sebelumnya memakai aspect-[4/5] di HP: kalau teksnya lebih pendek
    // dari fotonya, selisihnya jadi ruang kosong di kolom kanan yang tidak bisa
    // diisi apa pun. min-h hanya menjaga foto tetap layak dilihat saat tipenya
    // nyaris tanpa spesifikasi.
    <div
      className={`relative min-h-[7rem] overflow-hidden rounded-[1.35rem] shadow-[0_14px_34px_-22px_rgba(0,0,0,0.95)] ring-1 sm:min-h-[10.5rem] ${
        ada
          ? "bg-black/40 ring-white/10"
          : "border border-dashed border-violet-300/20 ring-transparent"
      } ${className}`}
      style={
        ada
          ? undefined
          : {
              background: `linear-gradient(150deg, rgba(167,139,250,0.12), ${SURFACE.raised} 55%)`,
            }
      }
    >
      {ada ? (
        <>
          <Image
            src={foto[indeks]}
            alt={`Kamar ${nama} — foto ${indeks + 1}`}
            fill
            sizes="(max-width: 640px) 112px, 224px"
            className={`object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06] ${
              penuh ? "grayscale" : ""
            }`}
          />
          {/* Gelap di bawah supaya badge & penghitung foto tetap terbaca. */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/20" />

          {banyak && (
            <>
              <button
                aria-label="Foto sebelumnya"
                onClick={(e) => geser(e, -1)}
                className="absolute left-1 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-md transition-opacity duration-200 hover:bg-black/70 sm:left-2 sm:h-7 sm:w-7 sm:opacity-0 sm:group-hover:opacity-100"
              >
                <Icon icon="solar:alt-arrow-left-linear" className="text-sm" />
              </button>
              <button
                aria-label="Foto berikutnya"
                onClick={(e) => geser(e, 1)}
                className="absolute right-1 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-md transition-opacity duration-200 hover:bg-black/70 sm:right-2 sm:h-7 sm:w-7 sm:opacity-0 sm:group-hover:opacity-100"
              >
                <Icon icon="solar:alt-arrow-right-linear" className="text-sm" />
              </button>
              <span className="absolute bottom-2.5 right-2.5 rounded-full border border-white/15 bg-black/55 px-2 py-0.5 text-[10px] font-bold tabular-nums text-white/90 backdrop-blur-md">
                {indeks + 1}/{foto.length}
              </span>
            </>
          )}
        </>
      ) : (
        <>
          {/* Dua bulatan kabur — satu violet (hue "orang & ruang", warna
              section ini), satu cyan. Slot foto adalah bidang kosong terbesar
              di kartu; membiarkannya abu membuat seluruh daftar terbaca sebagai
              deretan kotak kelabu sampai agent mengunggah fotonya. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -left-8 -top-10 h-28 w-28 rounded-full bg-violet-500/25 blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-12 -right-8 h-28 w-28 rounded-full bg-cyan-400/20 blur-2xl"
          />
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <Icon
                icon="solar:gallery-wide-bold-duotone"
                className="text-[26px] text-violet-200/45"
              />
              <p className="mt-1.5 px-2 text-[9px] font-black uppercase leading-tight tracking-[0.12em] text-violet-100/35">
                Foto kamar belum ada
              </p>
            </div>
          </div>
        </>
      )}

      {/* Badge status. Semuanya di atas foto, tidak satu pun mengambil baris di
          kolom teks — itulah gunanya foto sebagai kanvas. */}
      <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
        {termurah && !penuh && (
          <BadgeFoto
            icon="solar:tag-price-bold"
            label="Termurah"
            className="border-[#86efac]/30 bg-[#86efac]/20 text-[#86efac]"
          />
        )}
        {/* Di HP fotonya cuma ±112px; "Dipilih" disembunyikan di sana karena
            cincin mint + tombol sudah menyatakan hal yang sama. */}
        {terpilih && (
          <span className="hidden sm:contents">
            <BadgeFoto
              icon="solar:check-circle-bold"
              label="Dipilih"
              className="border-[#86efac]/30 bg-[#86efac]/20 text-[#86efac]"
            />
          </span>
        )}
      </div>

      {penuh && (
        <div className="absolute inset-0 grid place-items-center bg-black/45 backdrop-blur-[1px]">
          <span className="rounded-full border border-rose-300/30 bg-black/60 px-2 py-1 text-center text-[9px] font-black uppercase leading-tight tracking-[0.1em] text-rose-200 sm:px-3 sm:py-1.5 sm:text-[10px] sm:tracking-[0.18em]">
            Kamar penuh
          </span>
        </div>
      )}
    </div>
  );
}

/** Pengalih durasi dengan penanda yang menggeser, bukan warna yang melompat. */
function PengalihDurasi({
  opsi,
  aktif,
  onPilih,
}: {
  opsi: DurasiKey[];
  aktif: DurasiKey;
  onPilih: (d: DurasiKey) => void;
}) {
  const idx = Math.max(0, opsi.indexOf(aktif));
  return (
    <div
      role="tablist"
      aria-label="Durasi sewa"
      className={`relative flex rounded-2xl border p-1 ${LINE.card}`}
      style={{ background: SURFACE.raised, boxShadow: KILAU_KARTU }}
    >
      {/* Penanda tunggal yang bergeser: mata mengikuti satu benda berpindah,
          jadi hubungan "tab lama → tab baru" terbaca tanpa harus dihafal. */}
      <span
        aria-hidden
        className="absolute bottom-1 left-1 top-1 rounded-xl bg-[#86efac] shadow-[0_6px_18px_-8px_rgba(134,239,172,0.8)] transition-transform duration-300 ease-out"
        style={{
          width: `calc((100% - 0.5rem) / ${opsi.length})`,
          transform: `translateX(${idx * 100}%)`,
        }}
      />
      {opsi.map((d) => {
        const terpilih = d === aktif;
        return (
          <button
            key={d}
            role="tab"
            aria-selected={terpilih}
            onClick={() => onPilih(d)}
            className={`relative z-10 flex-1 whitespace-nowrap rounded-xl px-4 py-1.5 text-[11px] font-bold transition-colors duration-200 ${
              terpilih ? "text-black" : "text-white/45 hover:text-white"
            }`}
          >
            {DURASI_META[d].label}
          </button>
        );
      })}
    </div>
  );
}

function KartuTipe({
  tipe,
  durasi,
  terpilih,
  termurah,
  onPilih,
}: {
  tipe: TipeKamarView;
  durasi: DurasiKey;
  terpilih: boolean;
  termurah: boolean;
  onPilih: () => void;
}) {
  const [semuaFasilitas, setSemuaFasilitas] = useState(false);
  const kartuRef = useRef<HTMLDivElement>(null);

  const harga = tipe.harga[durasi] ?? 0;
  const tersediaDurasi = harga > 0;
  const penuh = tipe.kamarTersedia <= 0;
  const km = tipe.kamarMandiTipe ? KAMAR_MANDI[tipe.kamarMandiTipe] : null;
  const aksenSisa = aksenSisaKamar(tipe.kamarTersedia);
  const menipis = !penuh && tipe.kamarTersedia <= AMBANG_KAMAR_MENIPIS;
  const persenSisa = tipe.jumlahKamar
    ? Math.round((tipe.kamarTersedia / tipe.jumlahKamar) * 100)
    : 0;

  // Spesifikasi sebagai satu kalimat bertitik. Lantai & nomor kamar ikut karena
  // dua itu yang ditanyakan sebelum survei ("kamarnya di lantai berapa?") dan
  // yang dipakai agent menunjuk kamar saat calon penghuni datang.
  const spek = [
    tipe.luasKamar ? `${tipe.luasKamar} m²` : null,
    km ? km.label : null,
    tipe.kapasitasPenghuni ? `Maks ${tipe.kapasitasPenghuni} orang` : null,
    tipe.lantaiKamar ? `Lantai ${tipe.lantaiKamar}` : null,
    tipe.nomorKamar ? `No. ${tipe.nomorKamar}` : null,
  ].filter(Boolean) as string[];

  const fasilitasTampil = semuaFasilitas
    ? tipe.fasilitas
    : tipe.fasilitas.slice(0, MAKS_FASILITAS_TAMPIL);
  const sisaFasilitas = tipe.fasilitas.length - fasilitasTampil.length;

  // Dari semua durasi lain yang ditawarkan tipe ini, cukup tampilkan SATU yang
  // paling menguntungkan. Tujuannya memberi tahu "ada opsi lebih hemat", bukan
  // menyalin seluruh daftar harga ke dalam kartu.
  const hematTerbaik = (Object.keys(tipe.harga) as DurasiKey[])
    .filter((d) => d !== durasi && (tipe.harga[d] ?? 0) > 0)
    .map((d) => ({ d, persen: persenHemat(tipe.harga, durasi, d) }))
    .filter((x) => x.persen >= 5)
    .sort((a, b) => b.persen - a.persen)[0];

  // Sorot mengikuti kursor. Ditulis langsung ke CSS variable lewat ref, BUKAN
  // lewat state: mousemove menyala puluhan kali per detik, dan setState di
  // setiap gerakan akan me-render ulang seluruh daftar tipe.
  const sorot = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = kartuRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--sorot-x", `${e.clientX - r.left}px`);
    el.style.setProperty("--sorot-y", `${e.clientY - r.top}px`);
  };

  return (
    // Kartunya bisa diklik di mana saja (kebiasaan yang sudah dibawa pengunjung
    // dari daftar kos), tapi TIDAK diberi role/tabIndex: kontrol resminya tetap
    // tombol di dalam. Memberi role="radio" pada pembungkus yang berisi tombol
    // justru bikin pembaca layar mengumumkan dua kontrol untuk satu keputusan.
    <div
      ref={kartuRef}
      onMouseMove={sorot}
      onClick={penuh ? undefined : onPilih}
      className={`group relative isolate overflow-hidden rounded-[1.75rem] border transition-[transform,border-color,box-shadow] duration-300 motion-safe:hover:-translate-y-1 ${
        penuh ? "opacity-[0.75]" : "cursor-pointer"
      } ${terpilih ? "border-[#86efac]/40" : `${LINE.card} ${LINE.cardHover}`}`}
      style={{
        // Tiga lapis: sapuan violet di pojok kiri atas (hue section ini),
        // sapuan cyan tipis di kanan bawah (hue fasilitas — blok yang memang
        // ada di sana), lalu tangga permukaan terang→gelap dari atas ke bawah
        // seolah cahaya datang dari langit-langit. Tanpa dua sapuan pertama,
        // kartunya kembali jadi kotak abu — persis keluhan "terlalu monoton".
        background: terpilih
          ? `radial-gradient(600px 240px at 0% 0%, rgba(134,239,172,0.10), transparent 62%), linear-gradient(180deg, ${SURFACE.raised} 0%, ${SURFACE.card} 62%)`
          : `radial-gradient(600px 240px at 0% 0%, rgba(167,139,250,0.13), transparent 62%), radial-gradient(520px 260px at 100% 100%, rgba(34,211,238,0.07), transparent 70%), linear-gradient(180deg, ${SURFACE.raised} 0%, ${SURFACE.card} 62%)`,
        boxShadow: terpilih
          ? "inset 0 1px 0 rgba(255,255,255,0.07), 0 0 0 1px rgba(134,239,172,0.18), 0 30px 70px -42px rgba(134,239,172,0.5)"
          : "inset 0 1px 0 rgba(255,255,255,0.05), 0 20px 46px -34px rgba(0,0,0,0.95)",
      }}
    >
      {/* Lapisan cahaya, semuanya di belakang isi (-z-10) supaya tidak pernah
          menghalangi klik. */}
      {terpilih && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-[#86efac]/[0.07] via-transparent to-transparent"
        />
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(420px circle at var(--sorot-x, 50%) var(--sorot-y, 0%), rgba(255,255,255,0.05), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent to-transparent ${
          terpilih ? "via-[#86efac]/60" : "via-white/10"
        }`}
      />
      {/* Rail warna di tepi kiri — SELALU ada, bukan hanya saat terpilih.
          Inilah penanda warna yang paling murah: satu garis 3px sudah cukup
          membuat deretan kartu tidak terbaca sebagai tumpukan kotak abu. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-6 left-0 z-20 w-[3px] rounded-r-full ${
          terpilih
            ? "bg-gradient-to-b from-[#86efac]/0 via-[#86efac] to-[#86efac]/0"
            : "bg-gradient-to-b from-violet-400/0 via-violet-400/70 to-cyan-400/0"
        }`}
      />

      {/* Grid, bukan flex, supaya susunannya berubah bentuk (bukan cuma
          mengecil) di layar kecil:
            HP   → foto (112px) di kolom 1 baris 1 berdampingan dengan judul;
                   fasilitas + harga turun ke baris 2 selebar kartu.
            ≥sm  → foto 15rem menjulur dua baris di kolom 1, seluruh isi di
                   kolom 2.
          Satu markup untuk keduanya — tidak ada blok yang digandakan lalu
          disembunyikan bergantian. */}
      <div className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2.5 p-3 sm:grid-cols-[13.5rem_1fr] sm:gap-x-4 sm:gap-y-3 sm:p-3.5">
        <FotoTipe
          foto={tipe.foto}
          nama={tipe.nama}
          penuh={penuh}
          terpilih={terpilih}
          termurah={termurah}
          className="self-stretch sm:row-span-2"
        />

        <div className="min-w-0">
          <h4 className="bg-gradient-to-br from-white via-white to-violet-200 bg-clip-text text-[17px] font-extrabold leading-tight tracking-tight text-transparent">
            {tipe.nama}
          </h4>

          {spek.length > 0 && (
            <p className="mt-1 text-[12px] leading-snug text-violet-100/50">
              {spek.join(" · ")}
            </p>
          )}

          {/* Ketersediaan: bar pendek + kalimat, tanpa angka persen. Panjang bar
              sudah menyampaikan proporsinya, dan angkanya cuma mengulang. */}
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="h-[3px] w-11 shrink-0 overflow-hidden rounded-full bg-white/[0.08]">
              <span
                className={`block h-full rounded-full transition-[width] duration-500 ease-out ${barSisa(
                  tipe.kamarTersedia,
                )}`}
                style={{ width: `${Math.max(penuh ? 0 : 8, persenSisa)}%` }}
              />
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-[0.06em] ${aksenSisa.teks}`}
            >
              {menipis && (
                <Icon icon="solar:fire-bold-duotone" className="text-xs" />
              )}
              {penuh
                ? "Semua kamar terisi"
                : `Sisa ${tipe.kamarTersedia} dari ${tipe.jumlahKamar} kamar`}
            </span>
          </div>
        </div>

        {/* Sel kedua: fasilitas, catatan, harga & tombol. Di HP turun ke bawah
            foto selebar kartu (col-span-2) — di sanalah ruang lega ada. */}
        <div className="col-span-2 flex min-w-0 flex-col sm:col-span-1 sm:col-start-2">
          {tipe.fasilitas.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {fasilitasTampil.map((f) => (
                <span
                  key={f.label}
                  className="inline-flex items-center gap-1 rounded-lg bg-cyan-400/[0.05] px-2 py-1 text-[11px] font-medium leading-tight text-white/65 transition-colors duration-300 group-hover:bg-cyan-400/[0.09] group-hover:text-white/85"
                >
                  {/* Ikonnya cyan — hue "fasilitas & layanan" di sistem warna
                      halaman ini. Ini satu-satunya blok berulang di kartu, jadi
                      di sinilah warna paling terasa tanpa perlu ditambah
                      elemen baru. */}
                  <Icon
                    icon={f.icon}
                    className="text-[13px] text-cyan-300/75 transition-colors duration-300 group-hover:text-cyan-200"
                  />
                  {f.label}
                </span>
              ))}
              {/* Dua arah: begitu chip-nya jadi rapat, membuka 14 fasilitas
                  sekaligus tetap menambah 3 baris — jadi harus ada jalan
                  pulang, bukan hanya jalan buka. */}
              {(sisaFasilitas > 0 || semuaFasilitas) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSemuaFasilitas((p) => !p);
                  }}
                  className="rounded-lg border border-cyan-400/20 px-2 py-1 text-[11px] font-bold leading-tight text-cyan-200/70 transition-colors hover:border-cyan-300/50 hover:text-cyan-100"
                >
                  {semuaFasilitas ? "Ringkas" : `+${sisaFasilitas} lainnya`}
                </button>
              )}
            </div>
          )}

          {tipe.catatan && (
            <p className="mt-2 flex items-start gap-2 text-[11px] leading-snug text-white/40">
              <Icon
                icon="solar:info-circle-bold-duotone"
                className="mt-px shrink-0 text-sm"
              />
              {tipe.catatan}
            </p>
          )}

          {/* ── Harga & aksi ──
              mt-auto: berapa pun tinggi isi di atasnya, baris ini selalu duduk
              di dasar kartu, sejajar dengan tepi bawah foto. */}
          <div className="mt-auto flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-t border-white/[0.06] pt-2.5 sm:mt-4">
            {tersediaDurasi ? (
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-200/45">
                    {DURASI_META[durasi].label}
                  </span>
                  {/* Satu chip hemat menggantikan seluruh daftar harga durasi
                      lain. Mint karena ini pernyataan tentang uang — satu-
                      satunya arti mint di halaman ini. */}
                  {hematTerbaik && (
                    <span
                      className={`rounded-md border px-1.5 py-px text-[9px] font-black tabular-nums ${AKSEN.mint.chip}`}
                    >
                      {DURASI_META[hematTerbaik.d].label} −{hematTerbaik.persen}%
                      · {formatRupiahSingkat(tipe.harga[hematTerbaik.d] as number)}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-[1.5rem] font-black leading-none tracking-tight text-white tabular-nums">
                    {formatRupiah(harga)}
                  </span>
                  <span className="text-[11px] font-semibold text-white/35">
                    {DURASI_META[durasi].suffix.replace("/", "/ ")}
                  </span>
                </p>
              </div>
            ) : (
              <p className="min-w-0 text-[11px] font-semibold leading-relaxed text-white/40">
                Tipe ini tidak disewakan{" "}
                <span className="text-white/70">
                  {DURASI_META[durasi].label.toLowerCase()}
                </span>
                .
              </p>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                onPilih();
              }}
              disabled={penuh}
              aria-pressed={terpilih}
              className={`shrink-0 rounded-xl px-4 py-2 text-xs font-extrabold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86efac]/50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${
                terpilih
                  ? "bg-[#86efac] text-black shadow-[0_12px_32px_-14px_rgba(134,239,172,0.75)]"
                  : "border border-white/15 bg-white/[0.03] text-white hover:border-[#86efac]/45 hover:bg-[#86efac]/[0.08] hover:text-[#86efac]"
              }`}
            >
              {penuh ? (
                "Kamar penuh"
              ) : terpilih ? (
                <span className="inline-flex items-center justify-center gap-1.5">
                  <Icon icon="solar:check-circle-bold" className="text-sm" />
                  Tipe dipilih
                </span>
              ) : (
                "Pilih tipe ini"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TipeKamarSection({
  data,
  booking,
}: {
  data: SewaDetailData;
  booking: BookingState;
}) {
  const { tipeList, durasi, durasiOpsi, pilihDurasi, tipe, pilihTipe } = booking;
  const termurah = tipeTermurah(tipeList, durasi);

  const totalKamar = tipeList.reduce((s, t) => s + t.jumlahKamar, 0);
  const totalSisa = tipeList.reduce((s, t) => s + t.kamarTersedia, 0);

  return (
    <section
      id="tipe-kamar"
      className={`bg-transparent border-b pb-9 ${LINE.section}`}
    >
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-white">
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${AKSEN_SECTION.tipeKamar.kotak}`}
            >
              <Icon icon="solar:bed-bold-duotone" className="text-base" />
            </span>
            Tipe kamar tersedia
          </h3>
          <p className="mt-1 text-xs text-white/40">
            {tipeList.length} tipe · {totalSisa} dari {totalKamar} kamar masih
            kosong
          </p>
        </div>

        {/* Pengalih durasi ikut ditaruh di sini: di mobile panel booking
            tersembunyi di bottom sheet, jadi tanpa ini harga tiap tipe tidak
            bisa dibandingkan untuk durasi lain tanpa membuka sheet dulu. */}
        {durasiOpsi.length > 1 && (
          <PengalihDurasi
            opsi={durasiOpsi}
            aktif={durasi}
            onPilih={pilihDurasi}
          />
        )}
      </div>

      <div className="space-y-3">
        {tipeList.map((t) => (
          <KartuTipe
            key={t.id}
            tipe={t}
            durasi={durasi}
            terpilih={tipe?.id === t.id}
            termurah={termurah?.id === t.id && tipeList.length > 1}
            onPilih={() => pilihTipe(t.id)}
          />
        ))}
      </div>

      {data.fasilitasKamar.length > 0 && (
        <p
          className={`mt-4 flex items-start gap-2 rounded-xl border p-3.5 text-[11px] leading-relaxed text-white/45 ${LINE.row} ${AKSEN.cyan.wash}`}
        >
          <Icon
            icon="solar:check-circle-bold-duotone"
            className={`mt-px shrink-0 text-sm ${AKSEN.cyan.ikon}`}
          />
          <span>
            <span className="font-bold text-white/70">
              Berlaku di semua tipe:
            </span>{" "}
            {data.fasilitasKamar.map((f) => f.label).join(", ")} — sudah termasuk
            pada daftar fasilitas tiap kartu di atas.
          </span>
        </p>
      )}
    </section>
  );
}

"use client";

/**
 * CANGKANG TIKET — satu bentuk, dipakai penyewa DAN pemilik.
 *
 * Dulu bentuk ini ditulis dua kali: sekali di VoucherSheet (yang dilihat calon
 * penyewa) dan sekali di KartuKelola (yang dilihat pemilik). Dua salinan bentuk
 * yang "harusnya sama" selalu berakhir berbeda beberapa piksel, dan justru di
 * sinilah selisih itu paling mahal: seluruh gunanya kartu kelola adalah membuat
 * pemilik mengenali BENDA YANG SAMA dengan yang muncul di panel pemesanan.
 *
 * ── KENAPA TAKIKNYA DILUBANGI, BUKAN DITEMPEL ─────────────────────────────
 * Versi sebelumnya menempelkan dua lingkaran berwarna sama dengan latar wadah
 * untuk meniru takik. Trik itu hanya bekerja kalau wadahnya kebetulan berwarna
 * rata dan warnanya diketahui pemanggil — dan gagal di atas gradien, di atas
 * kartu terpilih yang latarnya mint, dan di tumpukan contoh yang saling
 * menimpa. Sekarang takiknya LUBANG betulan: `mask-image` memotong badan tiket
 * beserta garis tepinya, jadi apa pun yang ada di belakangnya tembus — persis
 * seperti kertas yang dilubangi.
 *
 * Bentuk tiketnya lengkap: rel kiri berwarna (bonggol), dua takik yang benar-
 * benar berlubang di garis perforasi, dan garis putus-putus di antaranya.
 */

import React from "react";

import { SURFACE } from "../sewaTheme";
import { Icon } from "@iconify/react";

/** Lebar rel kiri. Cukup untuk "Rp 250rb" dalam SATU baris — angka yang patah
 *  jadi dua baris terbaca sebagai dua angka. */
const LEBAR_REL = 96;
/** Jari-jari takik. Titik potongnya = tengah garis perforasi (rel + ½px). */
const JARI_TAKIK = 7;
const X_TAKIK = LEBAR_REL + 0.5;

const TAKIK = [
  `radial-gradient(circle ${JARI_TAKIK}px at ${X_TAKIK}px 0px, transparent ${JARI_TAKIK}px, #000 ${JARI_TAKIK + 0.5}px)`,
  `radial-gradient(circle ${JARI_TAKIK}px at ${X_TAKIK}px 100%, transparent ${JARI_TAKIK}px, #000 ${JARI_TAKIK + 0.5}px)`,
].join(", ");

/**
 * Dua lapis mask harus DIIRIS (intersect), bukan ditumpuk. Peramban yang belum
 * mengenal `mask-composite` mengabaikan seluruh baris ini dan menampilkan tiket
 * tanpa takik — bentuk lama, yang tetap benar. Itu kemunduran yang tidak
 * merusak apa pun.
 */
const GAYA_TAKIK: React.CSSProperties = {
  WebkitMaskImage: TAKIK,
  maskImage: TAKIK,
  WebkitMaskComposite: "source-in",
  maskComposite: "intersect",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskSize: "100% 100%",
  maskSize: "100% 100%",
};

export interface AksenTiket {
  wash: string;
  ikon: string;
  teks: string;
}

export default function Tiket({
  ikon,
  nilai,
  labelJenis,
  aksenRel,
  padam,
  terpilih,
  pojok,
  children,
}: {
  ikon: string;
  /** Angka besar di rel kiri: "Rp 250rb" atau "15%". Selalu satu baris. */
  nilai: string;
  labelJenis: string;
  aksenRel: AksenTiket;
  /** Voucher yang tidak sedang berjalan — relnya kehilangan warna. */
  padam?: boolean;
  /** Sedang dipilih penyewa. */
  terpilih?: boolean;
  /** Tempelan di pojok kanan atas, mis. pita "Hemat terbanyak". */
  pojok?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative flex w-full overflow-hidden rounded-2xl border text-left ${
        terpilih
          ? "border-[#86efac]/60 bg-[#86efac]/[0.06]"
          : padam
            ? "border-white/[0.08]"
            : "border-white/[0.12]"
      }`}
      style={{
        ...GAYA_TAKIK,
        ...(terpilih ? null : { background: SURFACE.raised }),
      }}
    >
      {/* ── Bonggol ──
          Ikon, angka, satu kata jenis. Angkanya `whitespace-nowrap`: rel yang
          melar sedikit jauh lebih murah daripada "Rp 250" / "rb" bertumpuk. */}
      <div
        className={`relative flex shrink-0 flex-col items-center justify-center gap-1 px-2 py-4 ${aksenRel.wash} ${
          padam ? "grayscale" : ""
        }`}
        style={{ width: LEBAR_REL }}
      >
        <Icon icon={ikon} className={`text-2xl ${aksenRel.ikon}`} />
        <span
          className={`whitespace-nowrap text-[15px] font-black leading-none tracking-[-0.02em] ${aksenRel.teks}`}
        >
          {nilai}
        </span>
        <span className="text-[8px] font-black uppercase tracking-[0.1em] text-white/40">
          {labelJenis}
        </span>
      </div>

      {/* ── Perforasi ──
          Garis putus-putusnya berhenti tepat di bibir takik (inset-y-2.5),
          supaya lubang tidak tertusuk garis. */}
      <span aria-hidden className="relative w-px shrink-0">
        <span
          className="absolute inset-y-2.5 left-0 w-px"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, rgba(255,255,255,0.28) 0 4px, transparent 4px 8px)",
          }}
        />
      </span>

      <div className="min-w-0 flex-1 px-3.5 py-3">{children}</div>

      {pojok}
    </div>
  );
}

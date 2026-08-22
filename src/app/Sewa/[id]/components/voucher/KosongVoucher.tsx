"use client";

/**
 * Keadaan kosong panel Kelola Voucher.
 *
 * ── APA YANG SALAH DENGAN VERSI SEBELUMNYA ────────────────────────────────
 * Sebuah kotak besar bergaris, satu ikon tiket redup di tengahnya, dan empat
 * baris paragraf rata tengah. Tiga masalahnya menumpuk:
 *
 * 1. Ikon tidak mengajarkan apa pun. Ia hanya menandai "di sini kosong" —
 *    sesuatu yang sudah jelas dari kekosongannya sendiri.
 * 2. Paragraf empat baris rata tengah adalah bentuk teks yang paling lambat
 *    dibaca, dan ditaruh persis di tempat orang paling tidak sabar membaca.
 * 3. Kotak besar yang isinya sedikit membuat panel terasa rusak, bukan baru.
 *
 * ── YANG DIPAKAI SEBAGAI GANTINYA ─────────────────────────────────────────
 * Praktik yang berulang di kajian empty state (Pencil & Paper, UXPin): ganti
 * ikon dengan CONTOH KONKRET dari benda yang akan dibuat pengguna. Jadi yang
 * tampil di sini adalah dua kartu voucher betulan — komponen `Tiket` yang sama
 * persis dengan yang nanti dilihat calon penyewa — ditumpuk miring dan meredup
 * ke bawah. Sekali lihat, pemilik sudah tahu ia akan membuat apa: bentuknya,
 * isinya, bahkan letak angka potongannya.
 *
 * Contohnya diberi label "contoh" secara eksplisit dan `aria-hidden`. Kartu
 * yang terlihat seperti data betulan pada panel yang datanya kosong adalah
 * kebohongan kecil yang mahal: pemilik akan mencari-cari di mana voucher
 * "HEMAT250" itu tersimpan.
 *
 * Di bawahnya, tiga pintasan preset. Ini yang mengubah keadaan kosong dari
 * pengumuman jadi tempat kerja — tindakan pertama jadi satu ketukan, bukan
 * dua (tombol besar → galeri → preset).
 */

import React from "react";
import { Icon } from "@iconify/react";

import { AKSEN, SURFACE } from "../sewaTheme";
import Tiket from "./Tiket";
import type { PresetVoucher } from "@/lib/voucher";

/** Dua contoh yang sengaja BERBEDA BENTUK — satu nominal, satu persen
 *  bersyarat — supaya yang tersampaikan bukan "voucher itu begini", melainkan
 *  "voucher bisa bermacam-macam". */
const CONTOH = [
  {
    ikon: "solar:ticket-sale-bold-duotone",
    nilai: "Rp 250rb",
    label: "Promo",
    aksen: AKSEN.mint,
    nama: "Potongan langsung",
    kode: "HEMAT250",
    syarat: ["Bulanan"],
  },
  {
    ikon: "solar:sale-square-bold-duotone",
    nilai: "15%",
    label: "Promo",
    aksen: AKSEN.violet,
    nama: "Diskon sewa 6 bulan",
    kode: "PANJANG15",
    syarat: ["Min. 6×", "Maks. Rp 500rb"],
  },
];

export default function KosongVoucher({
  preset,
  onPilihPreset,
  onLihatSemua,
}: {
  /** Preset yang ditawarkan sebagai pintasan — sudah dipilih pemanggilnya. */
  preset: PresetVoucher[];
  onPilihPreset: (p: PresetVoucher) => void;
  onLihatSemua: () => void;
}) {
  return (
    <div className="pb-1">
      {/* ── Tumpukan contoh ──
          Miring sedikit & saling menimpa supaya terbaca sebagai TUMPUKAN, bukan
          daftar yang kebetulan cuma dua. Selubung gradien di bawah memotongnya
          menjadi latar, bukan konten yang bisa disentuh. */}
      <div
        aria-hidden
        className="pointer-events-none relative select-none px-2 pt-1"
        style={{
          maskImage: "linear-gradient(to bottom, #000 55%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, #000 55%, transparent 100%)",
        }}
      >
        {CONTOH.map((c, i) => (
          <div
            key={c.kode}
            className="transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{
              transform: `rotate(${i === 0 ? -2.2 : 1.6}deg) scale(${1 - i * 0.04})`,
              marginTop: i === 0 ? 0 : -18,
              opacity: 1 - i * 0.45,
              zIndex: CONTOH.length - i,
              position: "relative",
            }}
          >
            <Tiket
              ikon={c.ikon}
              nilai={c.nilai}
              labelJenis={c.label}
              aksenRel={c.aksen}
            >
              <p className="truncate text-[13px] font-extrabold leading-snug text-white/85">
                {c.nama}
              </p>
              <p className="mt-0.5 truncate text-[10px] font-bold tracking-[0.08em] text-white/45">
                {c.kode}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {c.syarat.map((s) => (
                  <span
                    key={s}
                    className="rounded-md border border-white/[0.07] bg-white/[0.02] px-1.5 py-0.5 text-[9px] font-bold text-white/45"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </Tiket>
          </div>
        ))}
      </div>

      {/* ── Judul & satu kalimat ──
          Rata KIRI, bukan tengah. Teks rata tengah lebih dari satu baris
          memaksa mata mencari awal baris berikutnya setiap kali, dan di sini
          tidak ada satu pun alasan estetis yang sepadan dengan biaya itu. */}
      <div className="-mt-3 px-1">
        <h4 className="text-[15px] font-extrabold tracking-[-0.01em] text-white">
          Belum ada voucher di listing ini
        </h4>
        <p className="mt-1 text-[11.5px] leading-relaxed text-white/60">
          Promo yang Anda pasang hanya berlaku di sini, dan potongannya Anda yang
          tanggung — jadi Anda pula yang menentukan batasnya.
        </p>
      </div>

      {/* ── Pintasan ── */}
      {preset.length > 0 && (
        <div className="mt-4 px-1">
          <p className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-white/50">
            Mulai cepat
          </p>

          <div className="space-y-1.5">
            {preset.map((p) => {
              const aksen = AKSEN[p.aksen];
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPilihPreset(p)}
                  className="group flex w-full items-center gap-2.5 rounded-xl border border-white/[0.08] p-2.5 text-left transition-all duration-200 hover:border-white/25 hover:bg-white/[0.02] active:scale-[0.99] motion-reduce:transition-none"
                  style={{ background: SURFACE.raised }}
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${aksen.kotak}`}
                  >
                    <Icon icon={p.ikon} className="text-base" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-white">
                    {p.judul}
                  </span>
                  <Icon
                    icon="solar:alt-arrow-right-linear"
                    className="shrink-0 text-sm text-white/40 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-white/70 motion-reduce:transition-none"
                  />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onLihatSemua}
            className="mt-2 w-full rounded-xl py-2 text-[11px] font-bold text-white/60 transition-colors hover:text-white motion-reduce:transition-none"
          >
            Lihat semua bentuk promo
          </button>
        </div>
      )}
    </div>
  );
}

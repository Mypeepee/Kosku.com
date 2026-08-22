"use client";

/**
 * Patokan lokasi yang diisi agent (kolom `akses_terdekat`).
 *
 * KENAPA KOMPONEN SENDIRI. Markup ini dulu ada dua kali dengan isi identik —
 * satu di SekitarLokasi (/Jual & /Lelang), satu lagi disalin ke DetailInfo
 * /Sewa. Dua salinan berarti setiap perbaikan tampilan harus diingat dua kali,
 * dan yang terjadi persis itu: perbaikan hanya masuk ke salah satunya.
 *
 * ── SOAL "BANYAK RUANG BOGANG" ──────────────────────────────────────────────
 *
 * Versi lama memakai `grid md:grid-cols-2`. Di grid, tinggi satu baris = tinggi
 * sel TERTINGGI di baris itu. Kategori di sini panjangnya jauh berbeda: halte
 * bisa 14 entri sementara rumah sakit cuma 4 — jadi di sebelah rumah sakit
 * menganga ruang kosong setinggi 10 baris yang tidak bisa diisi apa pun, karena
 * kategori berikutnya wajib mulai di baris grid berikutnya.
 *
 * Ganti ke CSS multi-column (`columns-2`). Kolom TIDAK punya konsep baris: tiap
 * grup mengalir mengisi sisa ruang kolom, dan browser sendiri yang menyeimbang-
 * kan tinggi kedua kolom. `break-inside-avoid` menjaga satu kategori tidak
 * terbelah di tengah antar kolom — itu satu-satunya aturan yang perlu ditulis.
 *
 * ── SOAL PANJANG DAFTAR ─────────────────────────────────────────────────────
 *
 * Sejak patokan bisa diisi otomatis dari hasil pindai sekitar, satu kategori
 * gampang berisi 14 halte yang namanya nyaris sama ("Wisma Lidah Kulon A/B",
 * "SDN Lidah Kulon 1A/1B"). Menampilkan semuanya bukan kelengkapan, melainkan
 * mengubur kategori lain di bawah gulungan. Jadi tiap grup dipotong di
 * MAKS_PER_GRUP dan sisanya dibuka atas permintaan — yang ditampilkan adalah
 * yang TERDEKAT, karena itu yang menentukan keputusan.
 */

import React, { useMemo, useState } from "react";
import { Icon } from "@iconify/react";

import { IKON_AKSES, LABEL_AKSES, type AksesTerdekat } from "@/lib/kosDetail";
import { AKSES_TIPE_OPTIONS } from "@/app/tambah-property/types/listing";
import { aksenAkses } from "@/lib/detailTheme";

/** Entri per kategori sebelum "+N lainnya" ditekan. */
const MAKS_PER_GRUP = 5;

/** Urutan kategori mengikuti daftar pilihan di form — deterministik antar
 *  listing, jadi pembaca yang membandingkan dua kos menemukan "Halte" di
 *  tempat yang sama, bukan di posisi acak sesuai urutan input agent. */
const URUTAN_TIPE = AKSES_TIPE_OPTIONS.map((o) => o.value as string);

function GrupPatokan({ tipe, list }: { tipe: string; list: AksesTerdekat[] }) {
  const [semua, setSemua] = useState(false);
  const aksen = aksenAkses(tipe);

  const tampil = semua ? list : list.slice(0, MAKS_PER_GRUP);
  const sisa = list.length - tampil.length;

  return (
    // break-inside-avoid: tanpa ini kolom bisa memotong kategori di tengah,
    // menyisakan judul "HALTE / TERMINAL" sendirian di dasar kolom kiri.
    <div className="mb-6 break-inside-avoid">
      <h4
        className={`mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] ${aksen.teks}`}
      >
        <Icon
          icon={IKON_AKSES[tipe] || "solar:map-point-bold-duotone"}
          className="text-sm"
        />
        {LABEL_AKSES[tipe] || "Lainnya"}
        <span className="text-white/25">{list.length}</span>
      </h4>

      {tampil.map((a, i) => (
        <div
          key={`${a.nama}-${i}`}
          className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-2 last:border-0"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[13px] ${aksen.kotak}`}
            >
              <Icon icon={IKON_AKSES[a.tipe] || "solar:map-point-bold-duotone"} />
            </span>
            <span className="truncate text-[13px] text-white/75">{a.nama}</span>
          </div>
          {a.jarak != null && (
            <span className="shrink-0 rounded-lg bg-white/[0.06] px-2 py-0.5 text-[11px] font-bold tabular-nums text-white">
              {a.jarak} {a.satuan === "KM" ? "km" : "mnt"}
            </span>
          )}
        </div>
      ))}

      {(sisa > 0 || semua) && (
        <button
          onClick={() => setSemua((v) => !v)}
          className="pt-1.5 text-[11px] font-bold text-white/35 transition-colors hover:text-white/70"
        >
          {semua
            ? "Ringkas"
            : `+${sisa} ${(LABEL_AKSES[tipe] || "tempat").toLowerCase()} lainnya`}
        </button>
      )}
    </div>
  );
}

export default function PatokanAgent({
  akses,
  className = "",
}: {
  akses: AksesTerdekat[];
  className?: string;
}) {
  const grup = useMemo(() => {
    const acc = new Map<string, AksesTerdekat[]>();
    for (const a of akses) {
      if (!a?.nama) continue;
      const key = a.tipe || "LAINNYA";
      acc.set(key, [...(acc.get(key) ?? []), a]);
    }

    // Diurutkan terdekat lebih dulu HANYA kalau seluruh entri di grup itu
    // memakai satuan yang sama. "3 km" dan "5 menit" tidak bisa dibandingkan,
    // dan mengurutkannya seolah-olah bisa menghasilkan daftar yang tampak rapi
    // tapi salah — lebih baik dibiarkan pada urutan yang diisi agent.
    for (const [k, list] of acc) {
      const satuanSama = list.every((a) => a.satuan === list[0].satuan);
      if (!satuanSama) continue;
      acc.set(
        k,
        [...list].sort(
          (a, b) => (a.jarak ?? Infinity) - (b.jarak ?? Infinity),
        ),
      );
    }

    const kunci = [...acc.keys()].sort((a, b) => {
      const ia = URUTAN_TIPE.indexOf(a);
      const ib = URUTAN_TIPE.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return kunci.map((k) => [k, acc.get(k) as AksesTerdekat[]] as const);
  }, [akses]);

  if (grup.length === 0) return null;

  return (
    // Dua lapis dengan sengaja: margin luar milik pemanggil, sedangkan -mb-6 di
    // dalam mengimbangi mb-6 grup terakhir tiap kolom. Digabung jadi satu div,
    // keduanya menulis margin-bottom yang sama dan salah satunya diam-diam
    // kalah tergantung urutan CSS.
    <div className={className}>
      <div className="-mb-6 columns-1 gap-x-8 md:columns-2">
        {grup.map(([tipe, list]) => (
          <GrupPatokan key={tipe} tipe={tipe} list={list} />
        ))}
      </div>
    </div>
  );
}

"use client";

/**
 * Layar pertama saat pemilik menekan "Buat voucher".
 *
 * ── KENAPA BUKAN LANGSUNG FORM ────────────────────────────────────────────
 * Form voucher punya sebelas isian, dan tiga di antaranya — "potongan
 * maksimal", "minimal lama sewa", "kuota" — tidak berarti apa-apa bagi pemilik
 * kos yang baru pertama membuat promo. Yang dia tahu bukan isian, melainkan
 * tujuan: kamar sisa harus cepat terisi, atau penghuni tahunan harus mau bayar
 * di muka.
 *
 * Galeri ini menerjemahkan tujuan menjadi kombinasi isian yang sudah benar —
 * termasuk pasangan yang paling sering terlupa, seperti persen TANPA batas
 * atas. Sesudah dipilih, semuanya tetap bisa diubah: preset menyiapkan titik
 * berangkat, bukan mengunci hasil.
 *
 * "Mulai dari kosong" sengaja ditaruh sebagai pilihan TERAKHIR dan tetap ada.
 * Menghilangkannya akan memaksa pemilik berpengalaman menghapus isian preset
 * satu per satu — jalan yang lebih lambat daripada mengetik dari nol.
 */

import React from "react";
import { Icon } from "@iconify/react";

import { AKSEN, SURFACE } from "../sewaTheme";
import type { PresetVoucher } from "@/lib/voucher";

export default function GaleriPreset({
  daftar,
  onPilih,
}: {
  daftar: PresetVoucher[];
  onPilih: (p: PresetVoucher) => void;
}) {
  return (
    <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto px-5 pb-5">
      <p className="pb-1 text-[11.5px] leading-relaxed text-white/60">
        Pilih bentuk promonya. Semua isian sudah disiapkan dan tetap bisa Anda
        ubah di langkah berikutnya.
      </p>

      {daftar.map((p) => {
        const aksen = AKSEN[p.aksen];
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onPilih(p)}
            className="group flex w-full items-start gap-3 rounded-2xl border border-white/[0.08] p-3.5 text-left transition-all duration-200 hover:border-white/25 hover:bg-white/[0.02] active:scale-[0.99] motion-reduce:transition-none"
            style={{ background: SURFACE.raised }}
          >
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${aksen.kotak}`}
            >
              <Icon icon={p.ikon} className="text-lg" />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-extrabold leading-tight text-white">
                {p.judul}
              </span>
              <span className="mt-1 block text-[11px] leading-relaxed text-white/60">
                {p.ringkas}
              </span>
            </span>

            <Icon
              icon="solar:alt-arrow-right-linear"
              className="mt-2 shrink-0 text-base text-white/40 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-white motion-reduce:transition-none"
            />
          </button>
        );
      })}
    </div>
  );
}

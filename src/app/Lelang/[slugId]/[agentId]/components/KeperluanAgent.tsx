"use client";

import React, { useState } from "react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { buildLelangPosterPayload, downloadLelangPoster } from "@/lib/lelangPoster";

interface SelfAgentLite {
  nama?: string;
  whatsapp?: string;
  telepon?: string;
}

interface KeperluanAgentProps {
  data: any;
  currentAgentId?: string | null;
  currentJabatan?: string | null;
  stokerPhone?: string | null;
  canEdit?: boolean;
  /** Profil agent yang sedang login — dipakai sebagai kontak di poster. */
  selfAgent?: SelfAgentLite | null;
  /** Dipanggil saat tombol Bagikan ditekan — modal dirender di level atas (DetailClient). */
  onShareOpen?: () => void;
}

const formatMoney = (value: number): string => {
  if (!value || isNaN(value)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
};

const calcPengosongan = (limit: number): number => {
  if (!limit || isNaN(limit)) return 0;

  if (limit < 500_000_000) {
    return 100_000_000 + 25_000_000;
  }
  if (limit >= 500_000_000 && limit <= 1_500_000_000) {
    return 125_000_000 + 25_000_000;
  }
  if (limit > 1_500_000_000 && limit <= 2_500_000_000) {
    return 175_000_000 + 25_000_000;
  }
  if (limit >= 2_500_000_000 && limit <= 5_000_000_000) {
    return 275_000_000 + 25_000_000;
  }
  if (limit > 5_000_000_000 && limit <= 10_000_000_000) {
    return 525_000_000 + 50_000_000;
  }
  if (limit > 10_000_000_000 && limit <= 100_000_000_000) {
    return 775_000_000 + 50_000_000;
  }
  return 1_250_000_000 + 50_000_000;
};

const formatTanggalLelang = (val?: string | null): string => {
  if (!val) return "-";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

export default function KeperluanAgent({ data, currentAgentId, currentJabatan, stokerPhone, selfAgent, onShareOpen }: KeperluanAgentProps) {
  const rawLimit =
    data?.nilai_limit_lelang || data?.harga || data?.priceRates?.monthly || 0;

  const limit =
    typeof rawLimit === "number"
      ? rawLimit
      : parseFloat(String(rawLimit).replace(/[^0-9.-]/g, "")) || 0;

  const biayaDokumen = limit * 0.085 + 7_000_000;
  const biayaPengosongan = calcPengosongan(limit);

  // ✅ Check Ownership
  const ownerId: string = data?.owner?.id || data?.id_agent || "";
  const isOwner = !!currentAgentId && !!ownerId && currentAgentId === ownerId;

  // ✅ Get property ID for edit
  const propertyId = data?.id_property || data?.id || "";

  const [isBuildingPoster, setIsBuildingPoster] = useState(false);

  const canShare = !!onShareOpen;

  // ✅ STOKER sendiri -> pilih kontak PIC manual (nomor PIC rahasia, tak ada di DB).
  //    Role lain (Owner, Agent, Admin, Principal, dst) -> pesan dikirim ke nomor STOKER.
  const isStoker = currentJabatan === "STOKER";

  const handleDownloadPoster = async () => {
    const payload = buildLelangPosterPayload(data, { agentCode: currentAgentId, selfAgent });
    await downloadLelangPoster(payload, setIsBuildingPoster);
  };

  const handleAskStock = () => {
    const kodeProperti =
      data?.kode_properti && data.kode_properti !== "-"
        ? data.kode_properti
        : data?.id_property || "-";
    const alamat = data?.alamat_lengkap || data?.address || "-";
    const tanggalLelang = formatTanggalLelang(data?.tanggal_lelang);
    const slugId = data?.slug && data?.id_property
      ? `${data.slug}-${data.id_property}`
      : String(data?.id_property || kodeProperti);
    const propertyUrl = `${window.location.origin}/Lelang/${slugId}`;

    const text =
      `🔍 *Konfirmasi Stok Properti*\n\n` +
      `🆔 *ID:* ${kodeProperti}\n` +
      `📍 *Lokasi:* ${alamat}\n` +
      `📅 *Tanggal Lelang:* ${tanggalLelang}\n\n` +
      `❓ Apakah aset ini masih *TERSEDIA* atau sudah *TERJUAL*?\n\n` +
      `Ada respon dari klien kami yang sedang menanyakan. Mohon konfirmasi segera. 🙏\n\n` +
      `🔗 *Lihat detail properti:*\n` +
      `${propertyUrl}`;

    // Stoker/Owner -> pilih kontak PIC manual (nomor PIC rahasia, tak ada di DB).
    // Role lain -> langsung ke nomor stoker dari DB.
    const stokerNum = (stokerPhone || "").replace(/^0/, "62").replace(/\D/g, "");
    const waUrl =
      !isStoker && stokerNum
        ? `https://wa.me/${stokerNum}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(waUrl, "_blank");
  };

  return (
    <>
      {/* DESKTOP */}
      <div
        className="hidden lg:flex flex-col w-[380px] shrink-0 sticky top-[6.5rem] h-fit
        max-h-[calc(100vh-8rem)] overflow-hidden
        bg-slate-950/95 border border-white/10 rounded-3xl
        shadow-[0_24px_80px_rgba(0,0,0,0.75)] backdrop-blur"
      >
        {/* HEADER: Estimasi Biaya */}
        <div className="px-6 pt-4 pb-3 border-b border-white/10 bg-gradient-to-br from-emerald-500/20 via-emerald-500/5 to-transparent">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-semibold text-emerald-100 tracking-[0.16em] uppercase">
                Estimasi Biaya
              </span>
            </div>
            <span className="text-[10px] text-slate-300">
              Berdasarkan harga limit saat ini
            </span>
          </div>

          {/* LIMIT UTAMA */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
              Harga Limit
            </p>
            <p className="mt-1 text-[20px] font-bold text-white leading-tight">
              {formatMoney(limit)}
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              Nilai ini akan menyesuaikan dengan harga menang lelang.
            </p>
          </div>
        </div>

        {/* RINCIAN ESTIMASI */}
        <div className="px-6 py-3 space-y-2.5 bg-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-200">
              Rincian Estimasi
            </span>
            <span className="text-[10px] text-slate-400">
              Belum termasuk pajak & biaya lain
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col rounded-2xl bg-emerald-500/5 border border-emerald-400/30 px-3 py-2">
              <span className="text-[9px] uppercase tracking-[0.16em] text-emerald-200/80">
                Biaya Dokumen
              </span>
              <span className="mt-1 text-[14px] font-semibold text-emerald-50">
                {formatMoney(biayaDokumen)}
              </span>
              <span className="mt-1 text-[9px] text-emerald-100/80 leading-snug">
                {`≈ ${formatMoney(limit * 0.085)} + Rp 7 jt`}
              </span>
            </div>

            <div className="flex flex-col rounded-2xl bg-rose-500/5 border border-rose-400/40 px-3 py-2">
              <span className="text-[9px] uppercase tracking-[0.16em] text-rose-200/80">
                Biaya Pengosongan
              </span>
              <span className="mt-1 text-[14px] font-semibold text-rose-50">
                {formatMoney(biayaPengosongan)}
              </span>
              <span className="mt-1 text-[9px] text-rose-100/80 leading-snug">
                Mengacu tabel estimasi pengosongan.
              </span>
            </div>
          </div>

          <div className="mt-1 rounded-2xl bg-white/[0.02] border border-white/5 px-3 py-2">
            <p className="text-[9px] text-slate-400 leading-relaxed">
              Dokumen: limit × 8,5% + Rp 7.000.000. Pengosongan: mengikuti range
              harga limit (lihat detail di deskripsi atau dokumen lelang).
            </p>
          </div>
        </div>

        {/* TOMBOL AKSI */}
        <div className="px-5 pb-3 pt-2 bg-slate-950/95 border-t border-white/5">
          <div className="flex flex-col gap-1.5">
            {/* TOMBOL BAGIKAN — CTA utama: link membawa kode agent ini */}
            {canShare && (
              <button
                onClick={() => onShareOpen?.()}
                className="group w-full flex items-center justify-between px-4 py-3 rounded-2xl
                  bg-gradient-to-r from-[#86efac] to-[#34d399] text-black
                  shadow-[0_8px_28px_rgba(52,211,153,0.28)] hover:shadow-[0_10px_34px_rgba(52,211,153,0.4)]
                  transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-black/10 flex items-center justify-center">
                    <Icon icon="solar:share-bold-duotone" className="text-black text-lg" />
                  </div>
                  <div className="text-left">
                    <p className="text-[12px] font-extrabold">Bagikan Listing</p>
                    <p className="text-[10px] font-semibold text-black/55">
                      Lead masuk ke nomor &amp; profil kamu
                    </p>
                  </div>
                </div>
                <Icon
                  icon="solar:arrow-right-linear"
                  className="text-black/60 text-base group-hover:translate-x-1 transition-transform"
                />
              </button>
            )}

            {/* ✅ TOMBOL EDIT - HANYA UNTUK OWNER - UPDATED LINK */}
            {isOwner && propertyId && (
              <Link
                href={`/tambah-property?id=${propertyId}&mode=edit`}
                className="group relative w-full overflow-hidden rounded-2xl
                  bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600
                  p-[1px] shadow-[0_0_30px_rgba(168,85,247,0.5)]
                  hover:shadow-[0_0_40px_rgba(168,85,247,0.7)]
                  transition-all duration-300 active:scale-[0.98]"
              >
                <div className="relative w-full h-full bg-slate-950 rounded-2xl px-4 py-3
                  flex items-center justify-center gap-2.5
                  group-hover:bg-gradient-to-r group-hover:from-violet-600/10 group-hover:via-fuchsia-600/10 group-hover:to-pink-600/10
                  transition-all duration-300">
                  
                  {/* Animated Background Glow */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute top-0 left-0 w-20 h-20 bg-violet-500/30 rounded-full blur-2xl animate-pulse" />
                    <div className="absolute bottom-0 right-0 w-20 h-20 bg-pink-500/30 rounded-full blur-2xl animate-pulse delay-75" />
                  </div>

                  {/* Icon with Glow */}
                  <div className="relative flex items-center justify-center w-8 h-8 rounded-xl
                    bg-gradient-to-br from-violet-500/20 to-pink-500/20
                    border border-violet-400/40
                    group-hover:border-violet-300/70
                    transition-all duration-300">
                    <Icon
                      icon="solar:pen-new-square-bold-duotone"
                      className="text-violet-200 text-lg group-hover:text-white group-hover:scale-110 transition-all duration-300"
                    />
                  </div>

                  {/* Text */}
                  <div className="relative text-left flex-1">
                    <p className="text-[12px] font-bold bg-gradient-to-r from-violet-200 via-fuchsia-200 to-pink-200 bg-clip-text text-transparent
                      group-hover:from-white group-hover:via-violet-100 group-hover:to-pink-100
                      transition-all duration-300">
                      Edit Properti Saya
                    </p>
                    <p className="text-[9px] text-slate-400 group-hover:text-slate-300 transition-colors duration-300">
                      Kelola listing & data properti
                    </p>
                  </div>

                  {/* Arrow Icon */}
                  <Icon
                    icon="solar:arrow-right-linear"
                    className="relative text-violet-300 text-base opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300"
                  />
                </div>
              </Link>
            )}

            <button
              onClick={handleDownloadPoster}
              disabled={isBuildingPoster}
              className="btn-lux btn-lux--poster w-full flex items-center justify-between px-4 py-2.5 rounded-2xl disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2.5">
                <span className="btn-lux__chip w-8 h-8">
                  <Icon icon={isBuildingPoster ? "solar:spinner-bold" : "solar:gallery-wide-bold-duotone"} className={`lux-ico text-sky-100 text-lg ${isBuildingPoster ? "animate-spin" : ""}`} />
                </span>
                <div className="text-left">
                  <p className="text-[11px] font-bold text-white">
                    {isBuildingPoster ? "Membuat poster…" : "Download Poster"}
                  </p>
                  <p className="text-[10px] text-sky-100/60">
                    {isBuildingPoster ? "Merender katalog aset…" : "Katalog story 1080×1920 siap dibagikan"}
                  </p>
                </div>
              </div>
              {!isBuildingPoster && (
                <Icon icon="solar:download-minimalistic-bold" className="lux-ico text-sky-300 text-sm" />
              )}
            </button>

            <button
              onClick={handleAskStock}
              className="w-full flex items-center justify-between px-4 py-2 rounded-2xl
                bg-emerald-500/14 border border-emerald-400/70 hover:bg-emerald-500/24
                transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/25 border border-emerald-100/70 flex items-center justify-center">
                  <Icon
                    icon="ic:baseline-whatsapp"
                    className="text-emerald-50 text-lg"
                  />
                </div>
                <div className="text-left">
                  <p className="text-[11px] font-semibold text-emerald-50">
                    {isStoker ? "Tanya PIC" : "Tanyakan Stok"}
                  </p>
                  <p className="text-[10px] text-emerald-100/80">
                    {isStoker
                      ? "Buka WA, pilih kontak PIC, lalu kirim."
                      : "Kirim detail aset ke stoker via WA."}
                  </p>
                </div>
              </div>
              <Icon
                icon="solar:arrow-right-up-linear"
                className="text-emerald-50 text-sm"
              />
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE / MID */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#020617] border-t border-white/10 shadow-[0_-12px_40px_rgba(0,0,0,0.85)]">
        <div className="px-4 pt-2 pb-2 border-b border-white/5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-emerald-200">
              Ringkasan Finansial
            </span>
            <span className="text-[9px] text-slate-400">
              Estimasi biaya utama
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-400 uppercase">
                Limit
              </span>
              <span className="text-[11px] font-semibold text-white">
                {formatMoney(limit)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-400 uppercase">
                Dokumen
              </span>
              <span className="text-[11px] font-semibold text-emerald-200">
                {formatMoney(biayaDokumen)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-400 uppercase">
                Pengosongan
              </span>
              <span className="text-[11px] font-semibold text-rose-200">
                {formatMoney(biayaPengosongan)}
              </span>
            </div>
          </div>
        </div>

        {canShare && (
          <div className="px-4 pt-2.5">
            <button
              onClick={() => onShareOpen?.()}
              className="w-full flex items-center justify-center gap-2 rounded-xl
                bg-gradient-to-r from-[#86efac] to-[#34d399] text-black font-extrabold text-[12px] py-2.5
                shadow-[0_6px_20px_rgba(52,211,153,0.3)] active:scale-[0.98] transition-all"
            >
              <Icon icon="solar:share-bold-duotone" className="text-base" />
              Bagikan — lead ke nomor kamu
            </button>
          </div>
        )}

        <div className="px-4 py-2.5 flex gap-2">
          {/* ✅ TOMBOL EDIT DI MOBILE - UPDATED LINK */}
          {isOwner && propertyId && (
            <Link
              href={`/tambah-property?id=${propertyId}&mode=edit`}
              className="flex-1 relative overflow-hidden rounded-xl
                bg-gradient-to-r from-violet-600 to-pink-600
                shadow-[0_0_20px_rgba(168,85,247,0.4)]
                hover:shadow-[0_0_30px_rgba(168,85,247,0.6)]
                transition-all active:scale-[0.97]
                flex justify-center items-center gap-1.5 py-2.5"
            >
              <Icon
                icon="solar:pen-new-square-bold-duotone"
                className="text-white text-base drop-shadow-lg"
              />
              <span className="font-bold text-[11px] text-white drop-shadow-lg">
                Edit
              </span>
              
              {/* Shine Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent
                translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
            </Link>
          )}

          <button
            onClick={handleDownloadPoster}
            disabled={isBuildingPoster}
            className="btn-lux btn-lux--poster flex-1 text-sky-50 font-bold text-[11px] py-2.5 rounded-xl flex justify-center items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Icon
              icon={isBuildingPoster ? "solar:spinner-bold" : "solar:gallery-wide-bold-duotone"}
              className={`lux-ico text-sky-100 text-base${isBuildingPoster ? " animate-spin" : ""}`}
            />
            {isBuildingPoster ? "..." : "Poster"}
          </button>

          <button
            onClick={handleAskStock}
            className="flex-1 bg-emerald-500 text-black font-semibold text-[11px] py-2.5 rounded-xl hover:bg-emerald-400 transition-all active:scale-[0.97] flex justify-center items-center gap-1.5"
          >
            <Icon icon="ic:baseline-whatsapp" className="text-base" />
            {isStoker ? "Tanya PIC" : "Tanya Stok"}
          </button>
        </div>
      </div>

    </>
  );
}

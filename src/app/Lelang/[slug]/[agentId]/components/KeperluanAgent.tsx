// app/Jual/[slug]/[agentId]/components/KeperluanAgent.tsx
"use client";

import React from "react";
import { Icon } from "@iconify/react";

interface KeperluanAgentProps {
  data: any;
}

const formatMoney = (value: number): string => {
  if (!value || isNaN(value)) return "Rp 0";
  if (value >= 1_000_000_000) {
    const milyar = value / 1_000_000_000;
    return `Rp ${milyar.toFixed(1)} M`;
  }
  if (value >= 1_000_000) {
    const juta = value / 1_000_000;
    return `Rp ${Math.round(juta)} Jt`;
  }
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

export default function KeperluanAgent({ data }: KeperluanAgentProps) {
  const rawLimit =
    data?.nilai_limit_lelang || data?.harga || data?.priceRates?.monthly || 0;

  const limit =
    typeof rawLimit === "number"
      ? rawLimit
      : parseFloat(String(rawLimit).replace(/[^0-9.-]/g, "")) || 0;

  const biayaDokumen = limit * 0.085 + 7_000_000;
  const biayaPengosongan = calcPengosongan(limit);

  // Versi simple: buka gambar utama (foto pertama) di tab baru
  const handleDownloadImages = () => {
    const urls: string[] = data?.foto_list || [];
    if (!urls.length) {
      alert("Belum ada foto untuk diunduh.");
      return;
    }
    // buka gambar utama; user bisa save image
    window.open(urls[0], "_blank", "noopener,noreferrer");
  };

  const handleDownloadVideos = () => {
    if (!data?.id_property) return;
    window.open(`/api/property/${data.id_property}/download-videos`, "_blank");
  };

  const handleAskStock = () => {
    const rawPhone =
      data?.agent?.whatsapp ||
      data?.owner?.phone ||
      data?.agent?.telepon ||
      "";
    const phone = rawPhone.replace(/^0/, "62").replace(/\D/g, "");
    if (!phone) return;

    const text = encodeURIComponent(
      `Halo, saya ingin mengkonfirmasi stok / status terbaru untuk properti dengan detail berikut:\n\n` +
        `• Harga Limit: *${formatMoney(limit)}*\n` +
        `• Perkiraan Biaya Dokumen: *${formatMoney(biayaDokumen)}*\n` +
        `• Perkiraan Biaya Pengosongan: *${formatMoney(biayaPengosongan)}*\n\n` +
        `Mohon update: masih tersedia, sudah booking, atau sudah terjual?`
    );

    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  };

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden lg:flex flex-col w-[360px] sticky top-28 h-fit bg-[#020617] border border-white/10 rounded-3xl shadow-[0_18px_60px_rgba(0,0,0,0.65)] overflow-hidden">
        {/* HEADER: Estimasi Biaya */}
        <div className="px-5 pt-4 pb-3 border-b border-white/10 bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-transparent">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-semibold text-emerald-100">
                Estimasi Biaya
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase text-slate-400 tracking-[0.14em]">
                Harga Limit
              </span>
              <span className="mt-1 text-[13px] font-bold text-white leading-tight">
                {formatMoney(limit)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] uppercase text-slate-400 tracking-[0.14em]">
                Biaya Dokumen
              </span>
              <span className="mt-1 text-[13px] font-bold text-emerald-200 leading-tight">
                {formatMoney(biayaDokumen)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] uppercase text-slate-400 tracking-[0.14em]">
                Biaya Pengosongan
              </span>
              <span className="mt-1 text-[13px] font-bold text-rose-200 leading-tight">
                {formatMoney(biayaPengosongan)}
              </span>
            </div>
          </div>
        </div>

        {/* TOMBOL AKSI */}
        <div className="px-5 py-4 space-y-3 bg-[#020617]">
          <button
            onClick={handleDownloadImages}
            className="w-full group flex items-center justify-between px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-sky-400/60 hover:bg-sky-500/5 transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-400/40 flex items-center justify-center">
                <Icon
                  icon="solar:gallery-download-bold-duotone"
                  className="text-sky-300 text-xl"
                />
              </div>
              <div className="text-left">
                <p className="text-[11px] font-semibold text-white">
                  Download Gambar
                </p>
                <p className="text-[10px] text-gray-400">
                  Buka foto utama untuk disimpan.
                </p>
              </div>
            </div>
            <Icon
              icon="solar:arrow-right-up-linear"
              className="text-gray-500 text-sm group-hover:text-sky-300"
            />
          </button>

          <button
            onClick={handleDownloadVideos}
            className="w-full group flex items-center justify-between px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-purple-400/60 hover:bg-purple-500/5 transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-400/40 flex items-center justify-center">
                <Icon
                  icon="solar:videocamera-record-bold-duotone"
                  className="text-purple-300 text-xl"
                />
              </div>
              <div className="text-left">
                <p className="text-[11px] font-semibold text-white">
                  Download Video
                </p>
                <p className="text-[10px] text-gray-400">
                  Video tur untuk sosial media.
                </p>
              </div>
            </div>
            <Icon
              icon="solar:arrow-right-up-linear"
              className="text-gray-500 text-sm group-hover:text-purple-300"
            />
          </button>

          <button
            onClick={handleAskStock}
            className="w-full group flex items-center justify-between px-4 py-3 rounded-2xl bg-emerald-500/12 border border-emerald-400/70 hover:bg-emerald-500/22 transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/25 border border-emerald-200/80 flex items-center justify-center">
                <Icon
                  icon="solar:clipboard-list-bold-duotone"
                  className="text-emerald-50 text-xl"
                />
              </div>
              <div className="text-left">
                <p className="text-[11px] font-semibold text-emerald-50">
                  Tanyakan Stok
                </p>
                <p className="text-[10px] text-emerald-100/80">
                  Kirim detail estimasi ke admin / tim.
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

        <div className="px-4 py-2.5 flex gap-2">
          <button
            onClick={handleDownloadImages}
            className="flex-1 bg-sky-500/20 border border-sky-400/60 text-sky-50 font-semibold text-[11px] py-2.5 rounded-xl hover:bg-sky-500/30 transition-all active:scale-[0.97] flex justify-center items-center gap-1.5"
          >
            <Icon
              icon="solar:gallery-download-bold-duotone"
              className="text-base"
            />
            Gambar
          </button>

          <button
            onClick={handleDownloadVideos}
            className="flex-1 bg-purple-500/20 border border-purple-400/60 text-purple-50 font-semibold text-[11px] py-2.5 rounded-xl hover:bg-purple-500/30 transition-all active:scale-[0.97] flex justify-center items-center gap-1.5"
          >
            <Icon
              icon="solar:videocamera-record-bold-duotone"
              className="text-base"
            />
            Video
          </button>

          <button
            onClick={handleAskStock}
            className="flex-1 bg-emerald-500 text-black font-semibold text-[11px] py-2.5 rounded-xl hover:bg-emerald-400 transition-all active:scale-[0.97] flex justify-center items-center gap-1.5"
          >
            <Icon
              icon="solar:clipboard-list-bold-duotone"
              className="text-base"
            />
            Stok
          </button>
        </div>
      </div>
    </>
  );
}

"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { KATEGORI_ICONS } from "../constants";
import { formatCurrency, formatDateShort, daysUntil, getPropertyUrl } from "../utils";
import type { PropertyItem } from "../types";
import { useSwipe } from "@/hooks/useSwipe";
import { HotDealBadge, HOT_DEAL_CARD_CLASS } from "@/components/HotDeal/HotDealBadge";
import { SliderDots } from "@/components/SliderDots";

// ─── BADGES ──────────────────────────────────────────────────────────────────

type BadgeSize = "sm" | "md";

function TransaksiBadge({ type, size = "md" }: { type: string; size?: BadgeSize }) {
  const map: Record<string, { label: string; icon: string; cls: string }> = {
    PRIMARY:   { label: "Primary",   icon: "solar:home-2-bold-duotone",      cls: "text-blue-200 bg-blue-500/20 border-blue-400/40" },
    SECONDARY: { label: "Secondary", icon: "solar:buildings-2-bold-duotone", cls: "text-violet-200 bg-violet-500/20 border-violet-400/40" },
    SEWA:      { label: "Sewa",      icon: "solar:key-bold-duotone",         cls: "text-emerald-200 bg-emerald-500/20 border-emerald-400/40" },
    LELANG:    { label: "Lelang",    icon: "mdi:gavel",               cls: "text-amber-100 bg-amber-500/25 border-amber-400/50" },
  };
  const b = map[type?.toUpperCase()];
  if (!b) return null;

  const sm = size === "sm";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-[0.12em] border backdrop-blur-sm ${b.cls} ${
        sm ? "px-2 py-0.5 text-[9px]" : "px-3 py-1.5 text-[10px] gap-1.5"
      }`}
    >
      <Icon icon={b.icon} className={sm ? "text-[10px]" : "text-xs"} />
      {b.label}
    </span>
  );
}

function LelangBadge({ tanggal_lelang, size = "md" }: { tanggal_lelang: string | null; size?: BadgeSize }) {
  const days = daysUntil(tanggal_lelang);
  if (days === null) return null;

  const sm = size === "sm";
  const pad = sm ? "px-2.5 py-1" : "px-4 py-2";
  const txt = sm ? "text-[9px]" : "text-[10px]";
  const ic = sm ? "text-xs" : "text-sm";

  if (days <= 0)
    return (
      <span className={`relative inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-[0.14em] text-amber-50 ${pad} ${txt}`}>
        <span className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 opacity-80 blur-[3px]" />
        <span className="absolute inset-[1px] rounded-full bg-gradient-to-r from-[#18181b] via-[#030712] to-[#111827] border border-amber-300/80 shadow-[0_0_22px_rgba(250,204,21,0.75)]" />
        <span className="relative inline-flex items-center gap-1.5 px-0.5">
          <Icon icon="solar:cup-star-bold-duotone" className={`${ic} text-amber-200`} />
          <span className={sm ? "tracking-[0.14em]" : "tracking-[0.24em]"}>PELUANG EMAS</span>
        </span>
      </span>
    );

  if (days <= 10)
    return (
      <span className={`relative inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-[0.14em] text-white ${pad} ${txt}`}>
        <span className="absolute inset-0 rounded-full bg-[conic-gradient(at_top,_#22c55e,_#f97316,_#ef4444,_#22c55e)] opacity-90 blur-[3px]" />
        <span className="absolute inset-[1px] rounded-full bg-gradient-to-r from-black/80 via-black/70 to-black/80 border border-red-400/80 shadow-[0_0_26px_rgba(248,113,113,0.8)]" />
        <span className="relative inline-flex items-center gap-1 px-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
          <Icon icon="solar:fire-bold-duotone" className={`${ic} text-yellow-200`} />
          {days} hari lagi
        </span>
      </span>
    );

  if (days <= 20)
    return (
      <span className={`relative inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-[0.12em] text-white ${pad} ${txt}`}>
        <span className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 opacity-80 blur-[2px]" />
        <span className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 animate-pulse opacity-70" />
        <span className="relative inline-flex items-center gap-1.5 px-0.5">
          <Icon icon="solar:fire-bold-duotone" className={`${ic} text-yellow-100`} />
          {days} hari lagi
        </span>
      </span>
    );

  return (
    <span className={`relative inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-[0.14em] text-sky-50 ${pad} ${txt}`}>
      <span className="absolute inset-0 rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 opacity-70 blur-[3px]" />
      <span className="absolute inset-[1px] rounded-full bg-gradient-to-r from-[#020617] via-[#020617] to-[#022c22] border border-sky-300/70 shadow-[0_0_18px_rgba(56,189,248,0.7)]" />
      <span className="relative inline-flex items-center gap-1.5 px-0.5">
        <Icon icon="solar:calendar-bold-duotone" className={`${ic} text-sky-200`} />
        {formatDateShort(tanggal_lelang!)}
      </span>
    </span>
  );
}

// ─── CARD ─────────────────────────────────────────────────────────────────────

interface PropertyCardProps {
  item: PropertyItem;
  /** Kalau true, selalu tampilkan alamat_lengkap tanpa lihat jenis_transaksi. */
  forceAlamatLengkap?: boolean;
  /** Mode kompak untuk tampilan "Properti Serupa" — image lebih pendek, padding lebih kecil. */
  compact?: boolean;
  /** ID properti untuk badge di pojok kiri bawah gambar (dashboard only). */
  idBadge?: string;
  /** Handler saat ID badge diklik (copy ke clipboard, toast, dll). */
  onIdBadgeClick?: (e: React.MouseEvent, id: string) => void;
}

export default function PropertyCard({ item, forceAlamatLengkap = false, compact = false, idBadge, onIdBadgeClick }: PropertyCardProps) {
  const [imgIdx, setImgIdx] = useState(0);
  const [idCopied, setIdCopied] = useState(false);
  const images =
    item.foto_list.length > 0
      ? item.foto_list
      : [item.gambar || "/images/hero/banner.jpg"];

  const nextImage = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setImgIdx((p) => (p + 1) % images.length);
  };
  const prevImage = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setImgIdx((p) => (p - 1 + images.length) % images.length);
  };

  const swipe = useSwipe(nextImage, prevImage);

  const isLelang    = item.jenis_transaksi?.toUpperCase() === "LELANG";
  const hasDiscount =
    !isLelang &&
    item.harga_promo != null &&
    item.harga_promo > 0 &&
    item.harga_promo < item.harga;
  const discountPct = hasDiscount
    ? Math.round(((item.harga - item.harga_promo!) / item.harga) * 100)
    : 0;
  const mainPrice = hasDiscount ? item.harga_promo! : item.harga;
  const icon =
    KATEGORI_ICONS[item.kategori?.toUpperCase()] ||
    "solar:home-2-bold-duotone";

  return (
    <Link href={getPropertyUrl(item)} className="block h-full group">
      <div
        className={`
          bg-[#050608] rounded-3xl overflow-hidden
          relative flex flex-col h-full
          before:content-[''] before:absolute before:inset-px before:rounded-[22px]
          before:border before:pointer-events-none
          transition-all duration-300
          ${
            item.is_hot_deal
              ? HOT_DEAL_CARD_CLASS
              : // Default → netral, hover esmeralda (brand)
                "border border-white/10 shadow-[0_18px_60px_rgba(0,0,0,0.9)] before:border-white/5 hover:border-emerald-400/60 hover:shadow-[0_22px_70px_rgba(34,197,94,0.3)]"
          }
        `}
      >
        {/* ── IMAGE ── */}
        <div
          className={`relative w-full overflow-hidden ${compact ? "h-52" : "h-64"}`}
          {...(images.length > 1 ? swipe : {})}
        >
          <Image
            key={images[imgIdx]}
            src={images[imgIdx]}
            alt={item.judul}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/images/hero/banner.jpg";
            }}
          />

          {/* gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/0 pointer-events-none" />

          {/* shimmer line futuristik */}
          <div className="absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent opacity-60 pointer-events-none" />

          {/* slider controls */}
          {images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/70 hover:bg-primary hover:text-black text-white flex items-center justify-center z-20 transition-all lg:opacity-0 lg:group-hover:opacity-100"
              >
                <Icon icon="solar:alt-arrow-left-linear" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/70 hover:bg-primary hover:text-black text-white flex items-center justify-center z-20 transition-all lg:opacity-0 lg:group-hover:opacity-100"
              >
                <Icon icon="solar:alt-arrow-right-linear" />
              </button>
              <SliderDots
                total={images.length}
                index={imgIdx}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20"
              />
            </>
          )}

          {/* badge kiri: hot deal (bikin FOMO) + kategori */}
          <div className={`absolute z-10 flex flex-col items-start gap-1.5 ${compact ? "top-3 left-3" : "top-4 left-4"}`}>
            {item.is_hot_deal && <HotDealBadge size={compact ? "sm" : "md"} />}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full bg-black/80 text-emerald-300 font-semibold border border-emerald-400/40 backdrop-blur-sm ${
                compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1.5 text-[11px]"
              }`}
            >
              <Icon icon={icon} className={compact ? "text-xs" : "text-sm"} />
              {item.kategori.replace(/_/g, " ")}
            </span>
          </div>

          {/* badge kanan: tipe transaksi (selalu tampil, termasuk LELANG) */}
          <div className={`absolute z-10 flex flex-col items-end gap-1.5 ${compact ? "top-3 right-3" : "top-4 right-4"}`}>
            {isLelang ? (
              <>
                <TransaksiBadge type="LELANG" size={compact ? "sm" : "md"} />
                <LelangBadge tanggal_lelang={item.tanggal_lelang} size={compact ? "sm" : "md"} />
              </>
            ) : (
              <TransaksiBadge type={item.jenis_transaksi} size={compact ? "sm" : "md"} />
            )}
          </div>

          {/* ID badge — pojok kiri bawah gambar, gaya sobekan tiket */}
          {idBadge && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onIdBadgeClick) {
                  onIdBadgeClick(e, idBadge);
                } else {
                  navigator.clipboard.writeText(idBadge);
                  setIdCopied(true);
                  setTimeout(() => setIdCopied(false), 2000);
                }
              }}
              title="Salin ID properti"
              className="group/id absolute bottom-3 left-3 z-30 inline-flex items-stretch overflow-hidden rounded-md font-mono text-[11px] shadow-md ring-1 ring-white/10 transition-transform duration-200 hover:scale-[1.03]"
            >
              <span className="flex items-center bg-emerald-500 px-1.5 text-[9px] font-bold uppercase tracking-wider text-black">ID</span>
              <span className="flex items-center gap-1.5 bg-black px-2 py-1 tracking-wide text-white">
                {idBadge}
                <Icon
                  icon={idCopied ? "solar:check-circle-bold-duotone" : "solar:copy-line-duotone"}
                  className={`text-[11px] transition-all duration-200 ${
                    idCopied
                      ? "text-emerald-400 opacity-100"
                      : "text-white/40 opacity-0 group-hover/id:opacity-100"
                  }`}
                />
              </span>
            </button>
          )}

        </div>

        {/* ── CONTENT ── */}
        <div className={`flex flex-col flex-grow bg-gradient-to-b from-slate-900/80 via-slate-950/90 to-black border-t border-slate-800 ${compact ? "p-3" : "p-5"}`}>
          {/* Harga */}
          <div className={compact ? "mb-1" : "mb-2"}>
            {hasDiscount ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs line-through">
                    {formatCurrency(item.harga)}
                  </span>
                  <span className="rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-400">
                    -{discountPct}%
                  </span>
                </div>
                <h3 className="text-white text-xl font-black tracking-tight">
                  {formatCurrency(mainPrice)}
                </h3>
              </>
            ) : (
              <h3 className="text-white text-xl font-black tracking-tight">
                {formatCurrency(mainPrice)}
              </h3>
            )}
            {item.jenis_transaksi?.toUpperCase() === "SEWA" && (
              <span className="text-gray-500 text-[11px]"> / bulan</span>
            )}
          </div>

          {/* Judul */}
          <h4
            className={`text-gray-100 font-bold line-clamp-2 group-hover:text-primary transition-colors ${compact ? "text-sm mb-1" : "text-base mb-2"}`}
            title={item.judul}
          >
            {item.judul}
          </h4>

          {/* Lokasi */}
          <div className={`flex items-start gap-2 ${compact ? "mb-2" : "mb-4"}`}>
            <Icon
              icon="solar:map-point-wave-bold"
              className="text-primary text-base shrink-0 mt-0.5"
            />
            <span className="text-gray-400 text-sm line-clamp-1">
              {forceAlamatLengkap
                ? item.alamat_lengkap
                : (item.jenis_transaksi?.toUpperCase() === "SECONDARY" || item.jenis_transaksi?.toUpperCase() === "SEWA")
                  ? item.kota
                  : item.alamat_lengkap}
            </span>
          </div>

          {/* Specs box */}
          <div className={`bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-950/90 rounded-xl border border-slate-700/80 shadow-[0_12px_35px_rgba(0,0,0,0.8)] ${compact ? "p-2 mb-2" : "p-3 mb-4 rounded-2xl"}`}>
            {isLelang ? (
              <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:ruler-angular-bold" className="text-gray-400" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 uppercase">Luas Tanah</span>
                    <span className="text-white text-xs font-bold">
                      {item.luas_tanah ? `${item.luas_tanah} m²` : "-"}
                    </span>
                  </div>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="flex items-center gap-2">
                  <Icon icon="solar:calendar-date-bold" className="text-red-400" />
                  <div className="flex flex-col">
                    <span className="flex items-center gap-1 text-[10px] text-gray-500 uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Lelang
                    </span>
                    <span className="text-white text-xs font-bold">
                      {item.tanggal_lelang
                        ? formatDateShort(item.tanggal_lelang)
                        : "-"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                {[
                  { label: "KT", value: item.kamar_tidur || "-", icon: "solar:bed-bold" },
                  { label: "KM", value: item.kamar_mandi || "-", icon: "solar:bath-bold" },
                  { label: "LT", value: item.luas_tanah ? `${item.luas_tanah}` : "-", icon: "solar:maximize-square-2-linear" },
                  { label: "LB", value: item.luas_bangunan ? `${item.luas_bangunan}` : "-", icon: "solar:buildings-linear" },
                ].map(({ label, value, icon: specIcon }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-gray-500">{label}</span>
                    <span className="text-white font-semibold inline-flex justify-center items-center gap-1">
                      <Icon icon={specIcon} className="text-xs text-gray-400" />
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agent + CTA */}
          <div className={`mt-auto flex items-center justify-between border-t border-slate-800 pb-1 ${compact ? "pt-2 -mx-3 px-3" : "pt-4 -mx-5 px-5"}`}>
            <div className="flex items-center gap-2.5">
              <div className="relative w-9 h-9 rounded-full p-[1px] bg-gradient-to-tr from-primary to-transparent shrink-0">
                <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#151515] relative">
                  <Image
                    src={item.agent_photo}
                    alt={item.agent_name}
                    fill
                    className="object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "/images/default-profile.png";
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-white leading-tight">
                  {item.agent_name}
                </span>
                <span className="text-[10px] text-gray-500 leading-tight truncate max-w-[110px]">
                  {item.agent_office}
                </span>
              </div>
            </div>

            <span className="bg-emerald-400/5 hover:bg-emerald-400 text-emerald-200 hover:text-black border border-emerald-400/60 shadow-[0_0_18px_rgba(34,197,94,0.4)] hover:shadow-[0_0_24px_rgba(34,197,94,0.8)] text-xs font-bold px-4 py-2 rounded-full flex items-center gap-1.5 transition-all duration-200 shrink-0">
              Detail
              <Icon icon="solar:arrow-right-up-bold-duotone" className="text-sm" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

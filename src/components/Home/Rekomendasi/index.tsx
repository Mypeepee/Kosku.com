"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { HotDealBadge, HOT_DEAL_CARD_CLASS } from "@/components/HotDeal/HotDealBadge";
import { SliderDots } from "@/components/SliderDots";
import {
  PropertyCard,
  type PropertyDB,
} from "@/components/property/PropertyCard";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Bentuknya sengaja PropertyDB + dua field khas carousel ini. Dengan begitu
 * listing SEWA bisa langsung diserahkan ke kartu bersama tanpa cast — kalau
 * suatu saat kartu itu menuntut field baru, TypeScript akan menunjuk API
 * /api/property/populer yang harus mengisinya, bukan diam lalu tampil kosong.
 */
interface ListingItem extends PropertyDB {
  alamat_lengkap: string;
  tanggal_lelang: string | null;
}

// ─── Utils ────────────────────────────────────────────────────────────────────

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(v);

const formatDateShort = (date?: string | null) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const daysUntil = (date?: string | null) => {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const PROPERTY_ICONS: Record<string, string> = {
  RUMAH: "solar:home-2-bold-duotone",
  APARTEMEN: "solar:buildings-2-bold-duotone",
  GUDANG: "solar:box-minimalistic-bold-duotone",
  TANAH: "solar:map-point-wave-bold-duotone",
  PABRIK: "solar:garage-bold-duotone",
  RUKO: "solar:shop-2-bold-duotone",
  TOKO: "solar:shop-bold-duotone",
  HOTEL_DAN_VILLA: "solar:bed-bold-duotone",
};

const getPropertyIcon = (k: string) =>
  PROPERTY_ICONS[k?.trim().toUpperCase()] ?? "solar:home-2-bold-duotone";

const getBadgeColor = (type: string) => {
  const t = type?.toUpperCase();
  if (t === "PRIMARY") return "bg-blue-500 shadow-blue-500/20";
  if (t === "SECONDARY") return "bg-violet-500 shadow-violet-500/20";
  if (t === "LELANG") return "bg-amber-500 shadow-amber-500/20";
  if (t === "SEWA") return "bg-emerald-500 shadow-emerald-500/20";
  return "bg-gray-500";
};

const getDetailUrl = (item: ListingItem) => {
  const t = item.jenis_transaksi?.toUpperCase();
  if (t === "LELANG") return `/Lelang/${item.slug}-${item.id_property}`;
  if (t === "SEWA") return `/Sewa/${item.slug}-${item.id_property}`;
  return `/Jual/${item.slug}-${item.id_property}`;
};

// ─── Image gallery mini ───────────────────────────────────────────────────────

function MiniGallery({
  images,
  alt,
  height = "h-64",
}: {
  images: string[];
  alt: string;
  height?: string;
}) {
  const [idx, setIdx] = useState(0);
  const next = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIdx((p) => (p + 1) % images.length);
  };
  const prev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIdx((p) => (p - 1 + images.length) % images.length);
  };

  return (
    <div className={`relative w-full ${height} overflow-hidden`}>
      <Image
        key={images[idx]}
        src={images[idx]}
        alt={alt}
        fill
        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      />
      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-black/90 text-white rounded-full flex items-center justify-center z-20 opacity-0 group-hover:opacity-100 transition-all"
          >
            <Icon icon="solar:alt-arrow-left-linear" className="text-lg" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-black/90 text-white rounded-full flex items-center justify-center z-20 opacity-0 group-hover:opacity-100 transition-all"
          >
            <Icon icon="solar:alt-arrow-right-linear" className="text-lg" />
          </button>
          <SliderDots
            total={images.length}
            index={idx}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20"
          />
        </>
      )}
    </div>
  );
}

// ─── Card: Jual (PRIMARY / SECONDARY / SEWA) ──────────────────────────────────

function JualCard({ item }: { item: ListingItem }) {
  const images =
    item.foto_list?.length > 0
      ? item.foto_list
      : [item.gambar || "/images/hero/banner.jpg"];

  const hasDiscount =
    item.harga_promo != null &&
    item.harga_promo > 0 &&
    item.harga_promo < item.harga;
  const discountPct = hasDiscount
    ? Math.round(((item.harga - item.harga_promo!) / item.harga) * 100)
    : 0;
  const mainPrice = hasDiscount ? item.harga_promo! : item.harga;
  const [idCopied, setIdCopied] = useState(false);

  return (
    <div className={`bg-[#111111] rounded-3xl overflow-hidden group transition-all duration-300 flex flex-col h-full ${item.is_hot_deal ? HOT_DEAL_CARD_CLASS : "border border-white/5 hover:border-emerald-400/70 hover:shadow-[0_24px_70px_-30px_rgba(16,185,129,0.7)]"}`}>
      <div className="relative">
        <MiniGallery images={images} alt={item.judul} height="h-64 md:h-72" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/0 pointer-events-none" />

        {/* Kategori — pojok kanan atas, posisi TETAP baik ada/tidak Hot Deal */}
        <span className="absolute top-3 right-3 z-20 bg-black/70 backdrop-blur-sm border border-white/10 text-white text-[10px] font-semibold px-3 py-1.5 rounded-full inline-flex items-center gap-1.5">
          <Icon icon={getPropertyIcon(item.kategori)} className="text-sm opacity-90" />
          {item.kategori}
        </span>

        {/* Badge kiri — Hot Deal paling atas (bikin FOMO) + tipe transaksi */}
        <div className="absolute top-3 left-3 z-20 flex flex-col items-start gap-2 max-w-[calc(100%-6.5rem)]">
          {item.is_hot_deal && <HotDealBadge />}
          <span
            className={`${getBadgeColor(item.jenis_transaksi)} text-white text-[10px] font-semibold px-3 py-1.5 rounded-full shadow-md uppercase tracking-wide inline-flex items-center gap-1`}
          >
            <Icon icon="solar:star-bold-duotone" className="text-xs opacity-90" />
            {item.jenis_transaksi}
          </span>
        </div>

        {/* ID pill — pojok kiri bawah */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            navigator.clipboard.writeText(String(item.id_property));
            setIdCopied(true);
            setTimeout(() => setIdCopied(false), 2000);
          }}
          title="Salin ID properti"
          className="group/id absolute bottom-3 left-3 z-30 inline-flex items-stretch overflow-hidden rounded-md font-mono text-[11px] shadow-md ring-1 ring-white/10 transition-transform duration-200 hover:scale-[1.03]"
        >
          <span className="flex items-center bg-emerald-500 px-1.5 text-[9px] font-bold uppercase tracking-wider text-black">ID</span>
          <span className="flex items-center gap-1.5 bg-black px-2 py-1 tracking-wide text-white">
            {item.id_property}
            <Icon
              icon={idCopied ? "solar:check-circle-bold-duotone" : "solar:copy-line-duotone"}
              className={`text-[11px] transition-all duration-200 ${idCopied ? "text-emerald-400 opacity-100" : "text-white/40 opacity-0 group-hover/id:opacity-100"}`}
            />
          </span>
        </button>
      </div>

      <div className="p-5 md:p-6 flex flex-col flex-grow gap-3">
        <div className="space-y-1">
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
        </div>

        <h4
          className="text-gray-100 text-sm md:text-base font-semibold line-clamp-2 group-hover:text-primary transition-colors"
          title={item.judul}
        >
          {item.judul}
        </h4>

        <div className="flex items-start gap-2 text-xs text-gray-400">
          <Icon icon="solar:map-point-wave-bold" className="text-primary text-base shrink-0 mt-0.5" />
          <span className="line-clamp-1">{item.kota}</span>
        </div>

        <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
          <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
            <div className="flex flex-col gap-0.5">
              <span className="text-gray-500">KT</span>
              <span className="text-white font-semibold inline-flex justify-center items-center gap-1">
                <Icon icon="solar:bed-bold" className="text-xs text-gray-400" />
                {item.kamar_tidur || "-"}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-gray-500">KM</span>
              <span className="text-white font-semibold inline-flex justify-center items-center gap-1">
                <Icon icon="solar:bath-bold" className="text-xs text-gray-400" />
                {item.kamar_mandi || "-"}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-gray-500">LT</span>
              <span className="text-white font-semibold">
                {item.luas_tanah ? `${item.luas_tanah}m²` : "-"}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-gray-500">LB</span>
              <span className="text-white font-semibold">
                {item.luas_bangunan ? `${item.luas_bangunan}m²` : "-"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-3 flex items-center justify-between gap-3 border-t border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="relative w-8 h-8 rounded-full overflow-hidden border border-white/15 shrink-0">
              <Image src={item.agent_photo} alt="Agent" fill sizes="32px" className="object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-gray-100 leading-tight">{item.agent_name}</span>
              <span className="text-[10px] text-gray-500 leading-tight">{item.agent_office}</span>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-primary flex items-center gap-1 shrink-0">
            Lihat detail
            <Icon icon="solar:arrow-right-linear" className="text-sm" />
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Badge countdown for LELANG ───────────────────────────────────────────────

function LelangCountdownBadge({ tanggal_lelang }: { tanggal_lelang?: string | null }) {
  const days = daysUntil(tanggal_lelang);
  if (days === null) return null;

  if (days <= 0) {
    return (
      <span className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.14em] text-amber-50">
        <span className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 opacity-80 blur-[3px]" />
        <span className="absolute inset-[1px] rounded-full bg-gradient-to-r from-[#18181b] via-[#030712] to-[#111827] border border-amber-300/80 shadow-[0_0_22px_rgba(250,204,21,0.75)]" />
        <span className="relative inline-flex items-center gap-1.5 px-1">
          <Icon icon="solar:cup-star-bold-duotone" className="text-sm text-amber-200" />
          <span className="text-[10px] tracking-[0.24em]">PELUANG EMAS</span>
        </span>
      </span>
    );
  }
  if (days > 20) {
    return (
      <span className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.14em] text-sky-50">
        <span className="absolute inset-0 rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 opacity-70 blur-[3px]" />
        <span className="absolute inset-[1px] rounded-full bg-gradient-to-r from-[#020617] via-[#020617] to-[#022c22] border border-sky-300/70 shadow-[0_0_18px_rgba(56,189,248,0.7)]" />
        <span className="relative inline-flex items-center gap-1.5 px-1">
          <Icon icon="solar:eye-bold-duotone" className="text-sm text-sky-200" />
          <span className="text-[10px] tracking-[0.22em]">JANGAN LEWATKAN</span>
        </span>
      </span>
    );
  }
  if (days > 10) {
    return (
      <span className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.12em] text-white">
        <span className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 opacity-80 blur-[2px]" />
        <span className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 animate-pulse opacity-70" />
        <span className="relative inline-flex items-center gap-1.5 px-1">
          <Icon icon="solar:fire-bold-duotone" className="text-sm text-yellow-100" />
          {days} hari lagi
        </span>
      </span>
    );
  }
  return (
    <span className="relative inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.16em] text-white">
      <span className="absolute inset-0 rounded-full bg-[conic-gradient(at_top,_#22c55e,_#f97316,_#ef4444,_#22c55e)] opacity-90 blur-[3px]" />
      <span className="absolute inset-[1px] rounded-full bg-gradient-to-r from-black/80 via-black/70 to-black/80 border border-red-400/80 shadow-[0_0_26px_rgba(248,113,113,0.8)]" />
      <span className="relative inline-flex items-center gap-1.5 px-1">
        <Icon icon="solar:fire-bold-duotone" className="text-sm text-yellow-100" />
        <span className="flex items-center gap-1 text-[10px]">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
          {days} hari lagi
        </span>
      </span>
    </span>
  );
}

// ─── Card: Lelang ─────────────────────────────────────────────────────────────

function LelangCard({ item }: { item: ListingItem }) {
  const images =
    item.foto_list?.length > 0
      ? item.foto_list
      : [item.gambar || "/images/hero/banner.jpg"];
  const [idCopied, setIdCopied] = useState(false);

  return (
    <div className={`bg-[#050608] rounded-3xl overflow-hidden group relative flex flex-col h-full before:content-[''] before:absolute before:inset-px before:rounded-[22px] before:border before:pointer-events-none transition-all duration-300 ${item.is_hot_deal ? HOT_DEAL_CARD_CLASS : "border border-white/10 shadow-[0_18px_60px_rgba(0,0,0,0.9)] before:border-white/5 hover:border-emerald-400/60 hover:shadow-[0_22px_70px_rgba(34,197,94,0.3)]"}`}>
      <div className="relative after:content-[''] after:absolute after:inset-x-6 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-emerald-400/40 after:to-transparent after:opacity-70">
        <MiniGallery images={images} alt={item.judul} height="h-64" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-70 pointer-events-none" />

        {/* Badge kiri: Hot Deal paling atas (bikin FOMO) + kategori */}
        <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-2">
          {item.is_hot_deal && <HotDealBadge />}
          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-black/80 text-emerald-300 text-[11px] font-semibold border border-emerald-400/40 backdrop-blur-sm">
            <Icon icon={getPropertyIcon(item.kategori)} className="text-base" />
            {item.kategori}
          </span>
        </div>

        <div className="absolute top-4 right-4 z-10">
          <LelangCountdownBadge tanggal_lelang={item.tanggal_lelang} />
        </div>

        {/* ID pill — pojok kiri bawah */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            navigator.clipboard.writeText(String(item.id_property));
            setIdCopied(true);
            setTimeout(() => setIdCopied(false), 2000);
          }}
          title="Salin ID properti"
          className="group/id absolute bottom-3 left-3 z-30 inline-flex items-stretch overflow-hidden rounded-md font-mono text-[11px] shadow-md ring-1 ring-white/10 transition-transform duration-200 hover:scale-[1.03]"
        >
          <span className="flex items-center bg-emerald-500 px-1.5 text-[9px] font-bold uppercase tracking-wider text-black">ID</span>
          <span className="flex items-center gap-1.5 bg-black px-2 py-1 tracking-wide text-white">
            {item.id_property}
            <Icon
              icon={idCopied ? "solar:check-circle-bold-duotone" : "solar:copy-line-duotone"}
              className={`text-[11px] transition-all duration-200 ${idCopied ? "text-emerald-400 opacity-100" : "text-white/40 opacity-0 group-hover/id:opacity-100"}`}
            />
          </span>
        </button>
      </div>

      <div className="p-5 flex flex-col flex-grow bg-gradient-to-b from-slate-900/80 via-slate-950/90 to-black border-t border-slate-800 backdrop-blur-sm">
        <div className="mb-2">
          <h3 className="text-white text-xl font-extrabold tracking-tight truncate">
            {formatCurrency(item.harga)}
          </h3>
        </div>

        <h4
          className="text-gray-200 text-base font-bold line-clamp-2 mb-2 group-hover:text-primary transition-colors cursor-pointer"
          title={item.judul}
        >
          {item.judul}
        </h4>

        <div className="flex items-start gap-2 mb-4">
          <Icon icon="solar:map-point-wave-bold" className="text-primary text-lg shrink-0 mt-0.5" />
          <span className="text-gray-400 font-medium text-sm line-clamp-1" title={item.alamat_lengkap}>
            {item.alamat_lengkap}
          </span>
        </div>

        <div className="bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-950/90 rounded-2xl p-3 mb-5 border border-slate-700 shadow-[0_12px_35px_rgba(0,0,0,0.8)]">
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-2">
              <Icon icon="solar:ruler-angular-bold" className="text-gray-400" />
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 uppercase">Luas Tanah</span>
                <span className="text-white text-xs font-bold">
                  {item.luas_tanah ? `${item.luas_tanah}m²` : "-"}
                </span>
              </div>
            </div>
            <div className="w-[1px] h-8 bg-white/10" />
            <div className="flex items-center gap-2">
              <Icon icon="solar:calendar-date-bold" className="text-red-400" />
              <div className="flex flex-col items-start">
                <span className="flex items-center gap-1 text-[10px] text-gray-500 uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Lelang
                </span>
                <span className="text-white text-xs font-bold">
                  {formatDateShort(item.tanggal_lelang)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-800 bg-gradient-to-r from-transparent via-slate-900/70 to-transparent -mx-5 px-5 pb-3 rounded-b-3xl">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-full p-[1px] bg-gradient-to-tr from-primary to-transparent">
              <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#151515] relative">
                <Image src={item.agent_photo} alt={item.agent_name} fill sizes="36px" className="object-cover" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white group-hover:text-primary transition-colors">
                {item.agent_name}
              </span>
              <span className="text-[10px] text-gray-500">{item.agent_office}</span>
            </div>
          </div>

          <span className="bg-emerald-400/5 hover:bg-emerald-400 text-emerald-200 hover:text-black border border-emerald-400/60 shadow-[0_0_18px_rgba(34,197,94,0.6)] text-xs font-bold px-4 py-2 rounded-full flex items-center gap-2 transition-all active:scale-95">
            Detail
            <Icon icon="solar:arrow-right-up-bold-duotone" className="text-sm" />
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-[#111111] rounded-3xl border border-white/5 overflow-hidden animate-pulse shrink-0 w-[calc(100vw-3rem)] sm:w-[340px] lg:w-[380px]">
      <div className="h-64 bg-white/5" />
      <div className="p-5 space-y-3">
        <div className="h-6 bg-white/10 rounded w-2/3" />
        <div className="h-4 bg-white/5 rounded w-3/4" />
        <div className="h-4 bg-white/5 rounded w-1/2" />
        <div className="h-14 bg-white/5 rounded-2xl mt-2" />
        <div className="h-8 bg-white/5 rounded-2xl mt-4" />
      </div>
    </div>
  );
}

// ─── Native scroll carousel ───────────────────────────────────────────────────

function PropertyCarousel({ listings }: { listings: ListingItem[] }) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = useCallback((dir: "prev" | "next") => {
    const el = trackRef.current;
    if (!el) return;
    const cardWidth = el.firstElementChild
      ? (el.firstElementChild as HTMLElement).offsetWidth + 24
      : 380;
    el.scrollBy({ left: dir === "next" ? cardWidth : -cardWidth, behavior: "smooth" });
  }, []);

  return (
    <div className="relative">
      {/* nav buttons */}
      <button
        onClick={() => scroll("prev")}
        aria-label="Sebelumnya"
        className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-5 z-20 w-10 h-10 lg:w-14 lg:h-14 rounded-full bg-[#1A1A1A] border border-white/20 text-white hover:bg-primary hover:text-black hover:border-primary transition-all items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.5)] active:scale-90"
      >
        <Icon icon="solar:arrow-left-linear" className="text-xl lg:text-2xl" />
      </button>
      <button
        onClick={() => scroll("next")}
        aria-label="Berikutnya"
        className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-5 z-20 w-10 h-10 lg:w-14 lg:h-14 rounded-full bg-[#1A1A1A] border border-white/20 text-white hover:bg-primary hover:text-black hover:border-primary transition-all items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.5)] active:scale-90"
      >
        <Icon icon="solar:arrow-right-linear" className="text-xl lg:text-2xl" />
      </button>

      {/* scrollable track */}
      <div
        ref={trackRef}
        className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4 hide-scrollbar scroll-smooth"
      >
        {listings.map((item) => (
          <div
            key={item.id_property}
            className="snap-start shrink-0 w-[calc(100vw-3rem)] sm:w-[340px] lg:w-[380px] py-4"
          >
            {/* SATU kartu untuk semua jenis transaksi — kartu yang sama persis
                dengan halaman daftar (/Sewa, /Lelang, /properti). Kartu itu
                sendiri yang bercabang menurut jenisnya: hitung mundur + luas
                tanah untuk lelang, chip tipe unit & fasilitas untuk sewa, grid
                KT/KM/LT/LB untuk properti dijual. Percabangan di DALAM kartu,
                bukan di pemanggilnya — itu yang menjamin listing yang sama
                tidak pernah tampil berbeda antar halaman. */}
            <Link href={getDetailUrl(item)} className="block h-full">
              <PropertyCard item={item} />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Section ─────────────────────────────────────────────────────────────

const Recommendation = () => {
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/property/populer")
      .then((r) => r.json())
      .then((data) => {
        setListings(Array.isArray(data) ? data : []);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  return (
    <section className="py-10 bg-[#0F0F0F] relative overflow-hidden">
      <div className="container mx-auto px-4 lg:max-w-screen-xl relative z-10">

        {/* Header */}
        <div className="mb-10" data-aos="fade-up">
          <span className="inline-block py-1 px-3 rounded-full bg-white/5 border border-white/10 text-primary text-[10px] font-bold tracking-widest mb-3 uppercase">
            Pilihan Editor
          </span>

          <h2 className="text-white text-3xl md:text-4xl font-extrabold">
            Properti{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-green-300">
              Populer
            </span>
          </h2>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex gap-6 overflow-hidden">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            Belum ada hot deal tersedia.
          </div>
        ) : listings.length <= 3 ? (
          // Jalur "sedikit listing": grid, bukan carousel. Kartunya harus kartu
          // yang SAMA — cabang ini pernah terlewat saat carousel diperbarui,
          // dan akibatnya listing yang sama tampil beda hanya karena kebetulan
          // jumlah hot deal-nya ≤3.
          <div className="grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((item) => (
              <div key={item.id_property} className="h-full py-4">
                <Link href={getDetailUrl(item)} className="block h-full">
                  <PropertyCard item={item} />
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <PropertyCarousel listings={listings} />
        )}

      </div>
    </section>
  );
};

export default Recommendation;

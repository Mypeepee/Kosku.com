"use client";
import { Icon } from "@iconify/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const SortBar = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const BASE_URL = "/Lelang";

  const [showPriceMenu, setShowPriceMenu] = useState(false);
  const [showLandMenu, setShowLandMenu] = useState(false);

  const updateSort = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    params.set("page", "1");
    router.push(`${BASE_URL}?${params.toString()}`, { scroll: false });
  };

  const currentSort = searchParams.get("sort") || "auction_asc";
  const parts = currentSort.split("_");

  const isAuctionAsc = parts.includes("auction") && parts.includes("asc");
  const hasPrice = parts.includes("price");
  const isPriceAsc = hasPrice && parts.includes("asc");
  const hasLand = parts.includes("land");
  const isLandDesc = hasLand && parts.includes("desc");

  // ✅ Unified height untuk semua chip
  const chipHeight = "h-9 md:h-10"; // fixed height
  const buttonPadding = "px-3 md:px-4"; // horizontal padding sama
  const fontSize = "text-[11px] md:text-xs";

  return (
    <div className="flex flex-wrap items-center gap-2 md:gap-3">
      {/* 1. TOGGLE LELANG */}
      <div className={`inline-flex items-center bg-[#1A1A1A] border border-white/10 rounded-full gap-1 ${chipHeight}`}>
        <span className={`pl-2.5 pr-1 ${fontSize} text-slate-400 uppercase tracking-[0.18em] flex items-center gap-1.5`}>
          <Icon
            icon="solar:calendar-minimalistic-bold-duotone"
            className="text-emerald-400 text-sm"
          />
          <span className="hidden md:inline">Lelang</span>
        </span>
        <button
          onClick={() => updateSort("auction_asc")}
          className={`${buttonPadding} h-full rounded-full ${fontSize} font-bold transition-all whitespace-nowrap ${
            isAuctionAsc
              ? "bg-emerald-400 text-black shadow-lg shadow-emerald-400/30"
              : "text-slate-300 hover:text-white"
          }`}
        >
          Terdekat
        </button>
        <button
          onClick={() => updateSort("auction_desc")}
          className={`${buttonPadding} h-full rounded-full ${fontSize} font-bold transition-all whitespace-nowrap mr-1 ${
            !isAuctionAsc
              ? "bg-emerald-400 text-black shadow-lg shadow-emerald-400/30"
              : "text-slate-300 hover:text-white"
          }`}
        >
          Terjauh
        </button>
      </div>

      {/* 2. DROPDOWN HARGA */}
      <div className="relative">
        <button
          onClick={() => {
            setShowPriceMenu(!showPriceMenu);
            setShowLandMenu(false);
          }}
          className={`inline-flex items-center gap-2 ${buttonPadding} ${chipHeight} rounded-full border ${fontSize} font-medium transition-all whitespace-nowrap ${
            hasPrice
              ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
              : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/30"
          }`}
        >
          <Icon icon="solar:wallet-money-bold-duotone" className="text-sm" />
          <span>{hasPrice ? (isPriceAsc ? "Termurah" : "Tertinggi") : "Harga"}</span>
          <Icon
            icon="solar:alt-arrow-down-linear"
            className={`text-xs transition-transform ${showPriceMenu ? "rotate-180" : ""}`}
          />
        </button>

        {showPriceMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowPriceMenu(false)}
            />
            <div className="absolute top-full right-0 mt-2 w-44 bg-[#111111] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
              <button
                onClick={() => {
                  updateSort("auction_asc_price_asc");
                  setShowPriceMenu(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-200 hover:bg-white/5 transition-colors"
              >
                <Icon icon="solar:sort-by-time-bold" className="text-sm" />
                Harga Termurah
              </button>
              <button
                onClick={() => {
                  updateSort("auction_asc_price_desc");
                  setShowPriceMenu(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-200 hover:bg-white/5 transition-colors"
              >
                <Icon
                  icon="solar:sort-by-time-bold"
                  className="text-sm rotate-180"
                />
                Harga Tertinggi
              </button>
              <button
                onClick={() => {
                  updateSort("auction_asc");
                  setShowPriceMenu(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors border-t border-white/5"
              >
                <Icon icon="solar:close-circle-bold" className="text-sm" />
                Reset Harga
              </button>
            </div>
          </>
        )}
      </div>

      {/* 3. DROPDOWN LUAS TANAH */}
      <div className="relative">
        <button
          onClick={() => {
            setShowLandMenu(!showLandMenu);
            setShowPriceMenu(false);
          }}
          className={`inline-flex items-center gap-2 ${buttonPadding} ${chipHeight} rounded-full border ${fontSize} font-medium transition-all whitespace-nowrap ${
            hasLand
              ? "bg-purple-500/10 border-purple-500/30 text-purple-300"
              : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/30"
          }`}
        >
          <Icon icon="solar:ruler-angular-bold-duotone" className="text-sm" />
          <span>{hasLand ? (isLandDesc ? "Luas Terbesar" : "Luas Terkecil") : "Luas Tanah"}</span>
          <Icon
            icon="solar:alt-arrow-down-linear"
            className={`text-xs transition-transform ${showLandMenu ? "rotate-180" : ""}`}
          />
        </button>

        {showLandMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowLandMenu(false)}
            />
            <div className="absolute top-full right-0 mt-2 w-44 bg-[#111111] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
              <button
                onClick={() => {
                  updateSort("auction_asc_land_desc");
                  setShowLandMenu(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-200 hover:bg-white/5 transition-colors"
              >
                <Icon icon="solar:maximize-square-3-bold" className="text-sm" />
                Luas Terbesar
              </button>
              <button
                onClick={() => {
                  updateSort("auction_asc_land_asc");
                  setShowLandMenu(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-200 hover:bg-white/5 transition-colors"
              >
                <Icon icon="solar:minimize-square-3-bold" className="text-sm" />
                Luas Terkecil
              </button>
              <button
                onClick={() => {
                  updateSort("auction_asc");
                  setShowLandMenu(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors border-t border-white/5"
              >
                <Icon icon="solar:close-circle-bold" className="text-sm" />
                Reset Luas
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SortBar;

"use client";
import { Icon } from "@iconify/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";

const SortBar = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const BASE_URL = "/Lelang";

  const [showPriceMenu, setShowPriceMenu] = useState(false);
  const [showLandMenu, setShowLandMenu] = useState(false);

  const priceMenuRef = useRef<HTMLDivElement>(null);
  const landMenuRef = useRef<HTMLDivElement>(null);

  // ✅ Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        priceMenuRef.current &&
        !priceMenuRef.current.contains(event.target as Node)
      ) {
        setShowPriceMenu(false);
      }
      if (
        landMenuRef.current &&
        !landMenuRef.current.contains(event.target as Node)
      ) {
        setShowLandMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // ✅ Update sort parameter
  const updateSort = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    params.set("page", "1");
    router.push(`${BASE_URL}?${params.toString()}`, { scroll: false });
  };

  const currentSort = searchParams.get("sort") || "lelang-terdekat";

  // ✅ Deteksi sorting aktif
  const isAuctionTerdekat = currentSort === "lelang-terdekat";
  const isAuctionTerjauh = currentSort === "lelang-terjauh";
  const isAuctionBerlalu = currentSort === "lelang-berlalu";
  const isPriceAsc = currentSort === "termurah";
  const isPriceDesc = currentSort === "termahal";
  const isLandAsc = currentSort === "terkecil";
  const isLandDesc = currentSort === "terluas";

  const hasPrice = isPriceAsc || isPriceDesc;
  const hasLand = isLandAsc || isLandDesc;

  // ✅ Unified styling constants
  const chipHeight = "h-9 md:h-10";
  const buttonPadding = "px-3 md:px-4";
  const fontSize = "text-[11px] md:text-xs";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        {/* 1. TOGGLE WAKTU LELANG (3 opsi + reset inline) */}
        <div className="shrink-0">
          <div
            className={`inline-flex items-center bg-[#1A1A1A] border border-white/10 rounded-full gap-1 ${chipHeight}`}
          >
            <span
              className={`pl-2.5 pr-1 ${fontSize} text-slate-400 uppercase tracking-[0.18em] flex items-center gap-1.5`}
            >
              <Icon
                icon="solar:calendar-minimalistic-bold-duotone"
                className={`text-sm ${
                  isAuctionBerlalu
                    ? "text-red-400"
                    : isAuctionTerdekat || isAuctionTerjauh
                    ? "text-emerald-400"
                    : "text-slate-400"
                }`}
              />
              <span className="hidden md:inline">Lelang</span>
            </span>

            <button
              onClick={() => updateSort("lelang-terdekat")}
              className={`${buttonPadding} h-full rounded-full ${fontSize} font-bold transition-all whitespace-nowrap ${
                isAuctionTerdekat
                  ? "bg-emerald-400 text-black shadow-lg shadow-emerald-400/30"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Terdekat
            </button>

            <button
              onClick={() => updateSort("lelang-terjauh")}
              className={`${buttonPadding} h-full rounded-full ${fontSize} font-bold transition-all whitespace-nowrap ${
                isAuctionTerjauh
                  ? "bg-emerald-400 text-black shadow-lg shadow-emerald-400/30"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Terjauh
            </button>

            <button
              onClick={() => updateSort("lelang-berlalu")}
              className={`${buttonPadding} h-full rounded-full ${fontSize} font-bold transition-all whitespace-nowrap ${
                isAuctionBerlalu
                  ? "bg-red-400 text-black shadow-lg shadow-red-400/30"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Berlalu
            </button>

            {/* Reset Button (hanya muncul jika ada filter aktif) */}
            {(isAuctionTerdekat || isAuctionTerjauh || isAuctionBerlalu) && (
              <button
                onClick={() => updateSort("terbaru")}
                className="pr-2.5 pl-1 h-full text-slate-400 hover:text-red-400 transition-colors"
                title="Reset Filter"
              >
                <Icon icon="solar:close-circle-bold" className="text-base" />
              </button>
            )}
          </div>
        </div>

        {/* 2. DROPDOWN HARGA */}
        <div className="relative shrink-0" ref={priceMenuRef}>
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
            <span>
              {hasPrice ? (isPriceAsc ? "Termurah" : "Termahal") : "Harga"}
            </span>
            <Icon
              icon="solar:alt-arrow-down-linear"
              className={`text-xs transition-transform ${
                showPriceMenu ? "rotate-180" : ""
              }`}
            />
          </button>

          {showPriceMenu && (
            <div className="absolute top-full right-0 mt-2 w-44 bg-[#111111] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
              <button
                onClick={() => {
                  updateSort("termurah");
                  setShowPriceMenu(false);
                }}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs transition-colors ${
                  isPriceAsc
                    ? "bg-blue-500/10 text-blue-300 font-semibold"
                    : "text-slate-200 hover:bg-white/5"
                }`}
              >
                <Icon icon="solar:sort-by-time-bold" className="text-sm" />
                Harga Termurah
              </button>
              <button
                onClick={() => {
                  updateSort("termahal");
                  setShowPriceMenu(false);
                }}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs transition-colors ${
                  isPriceDesc
                    ? "bg-blue-500/10 text-blue-300 font-semibold"
                    : "text-slate-200 hover:bg-white/5"
                }`}
              >
                <Icon
                  icon="solar:sort-by-time-bold"
                  className="text-sm rotate-180"
                />
                Harga Termahal
              </button>
              <button
                onClick={() => {
                  updateSort("terbaru");
                  setShowPriceMenu(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors border-t border-white/5"
              >
                <Icon icon="solar:close-circle-bold" className="text-sm" />
                Reset Harga
              </button>
            </div>
          )}
        </div>

        {/* 3. DROPDOWN LUAS TANAH */}
        <div className="relative shrink-0" ref={landMenuRef}>
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
            <span>
              {hasLand ? (isLandDesc ? "Terluas" : "Terkecil") : "Luas Tanah"}
            </span>
            <Icon
              icon="solar:alt-arrow-down-linear"
              className={`text-xs transition-transform ${
                showLandMenu ? "rotate-180" : ""
              }`}
            />
          </button>

          {showLandMenu && (
            <div className="absolute top-full right-0 mt-2 w-44 bg-[#111111] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
              <button
                onClick={() => {
                  updateSort("terluas");
                  setShowLandMenu(false);
                }}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs transition-colors ${
                  isLandDesc
                    ? "bg-purple-500/10 text-purple-300 font-semibold"
                    : "text-slate-200 hover:bg-white/5"
                }`}
              >
                <Icon icon="solar:maximize-square-3-bold" className="text-sm" />
                Luas Terbesar
              </button>
              <button
                onClick={() => {
                  updateSort("terkecil");
                  setShowLandMenu(false);
                }}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs transition-colors ${
                  isLandAsc
                    ? "bg-purple-500/10 text-purple-300 font-semibold"
                    : "text-slate-200 hover:bg-white/5"
                }`}
              >
                <Icon icon="solar:minimize-square-3-bold" className="text-sm" />
                Luas Terkecil
              </button>
              <button
                onClick={() => {
                  updateSort("terbaru");
                  setShowLandMenu(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors border-t border-white/5"
              >
                <Icon icon="solar:close-circle-bold" className="text-sm" />
                Reset Luas
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SortBar;

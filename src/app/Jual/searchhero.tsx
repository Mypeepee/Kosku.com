"use client";
import React, { useState, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import TransactionTabs, { type TxTab } from "@/components/search/TransactionTabs";
import LocationPicker from "@/components/search/LocationPicker";
import {
  setLocationParams,
  parseLocationParams,
  locationsToSelectedRegions,
  type SelectedRegion,
} from "@/lib/regionSearch";
import TypePicker from "@/components/search/TypePicker";
import { serializeTypes, parseTypeParamToDisplays } from "@/lib/propertyType";

// --- 1. CONFIGURATION & TYPES ---

const sortAlpha = (arr: string[]) => arr.sort((a, b) => a.localeCompare(b));

const PROPERTY_ICONS: Record<string, string> = {
  "Rumah": "solar:home-2-bold-duotone",
  "Apartemen": "solar:buildings-2-bold-duotone",
  "Gudang": "solar:box-minimalistic-bold-duotone",
  "Tanah": "solar:map-point-wave-bold-duotone",
  "Pabrik": "solar:garage-bold-duotone",
  "Ruko": "solar:shop-2-bold-duotone",
  "Toko": "solar:shop-bold-duotone",
  "Hotel & Villa": "solar:bed-bold-duotone",
};

// Daftar Tipe Properti Khusus BELI
const BUY_TYPES = sortAlpha([
  "Rumah", "Tanah", "Gudang", "Apartemen", "Pabrik", "Ruko", "Toko", "Hotel & Villa"
]);

interface SearchState {
  keyword: string;
  locations: SelectedRegion[];
  types: string[];
  minPrice: string;
  maxPrice: string;
  minLt: string;
  maxLt: string;
  minLb: string;
  maxLb: string;
}

const isNumericOnly = (val: string) => /^\d+$/.test(val.trim());

// --- 2. COMPONENT ---

const parseRawNumber = (val: string) =>
  val.replace(/\./g, "").replace(/[^0-9]/g, "");

const formatIdNumber = (raw: string) =>
  raw ? new Intl.NumberFormat("id-ID").format(Number(raw)) : "";

const DB_TYPE_TO_DISPLAY: Record<string, string> = {
  RUMAH: "Rumah",
  TANAH: "Tanah",
  GUDANG: "Gudang",
  APARTEMEN: "Apartemen",
  PABRIK: "Pabrik",
  RUKO: "Ruko",
  TOKO: "Toko",
  HOTEL_DAN_VILLA: "Hotel & Villa",
};

export interface SearchHeroInitial {
  q?: string;
  idProperty?: string;
  kota?: string;
  tipe?: string;
  minHarga?: number;
  maxHarga?: number;
  minLT?: number;
  maxLT?: number;
  minLB?: number;
  maxLB?: number;
}

const buildFormData = (
  init: SearchHeroInitial,
  locations: SelectedRegion[]
): SearchState => ({
  keyword: init.idProperty || init.q || "",
  locations,
  types: parseTypeParamToDisplays(init.tipe),
  minPrice: init.minHarga ? formatIdNumber(String(init.minHarga)) : "",
  maxPrice: init.maxHarga ? formatIdNumber(String(init.maxHarga)) : "",
  minLt: init.minLT ? formatIdNumber(String(init.minLT)) : "",
  maxLt: init.maxLT ? formatIdNumber(String(init.maxLT)) : "",
  minLb: init.minLB ? formatIdNumber(String(init.minLB)) : "",
  maxLb: init.maxLB ? formatIdNumber(String(init.maxLB)) : "",
});

const SearchHero = ({
  initial = {},
  initialTab = "beli",
}: {
  initial?: SearchHeroInitial;
  initialTab?: TxTab;
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<TxTab>(initialTab);

  const [rangeErrors, setRangeErrors] = useState<{ price?: string; lt?: string; lb?: string }>({});
  const [shaking, setShaking] = useState(false);

  // Wilayah terpilih dihidrasi dari URL (multi-level: provinsi/kota/kecamatan/kelurahan).
  const hydratedLocations = useMemo(
    () => locationsToSelectedRegions(parseLocationParams((k) => searchParams.get(k))),
    [searchParams]
  );

  const [formData, setFormData] = useState<SearchState>(() =>
    buildFormData(initial, hydratedLocations)
  );

  useEffect(() => {
    setFormData(buildFormData(initial, hydratedLocations));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.q, initial.idProperty, initial.tipe, initial.minHarga, initial.maxHarga, initial.minLT, initial.maxLT, initial.minLB, initial.maxLB, hydratedLocations]);

  // Hasil baru sudah ter-render (query berubah) → lepas state "Mencari...".
  useEffect(() => { setSearching(false); }, [searchParams]);
  // Failsafe: kalau navigasi menggantung, tombol pulih sendiri.
  useEffect(() => {
    if (!searching) return;
    const t = setTimeout(() => setSearching(false), 8000);
    return () => clearTimeout(t);
  }, [searching]);

  const keywordTrimmed = formData.keyword.trim();
  const keywordMode: "id" | "alamat" | null =
    keywordTrimmed === "" ? null : isNumericOnly(keywordTrimmed) ? "id" : "alamat";

  const wrapperRef = useRef<HTMLDivElement>(null);
  const keywordInputRef = useRef<HTMLInputElement>(null);

  // Utils
  const toggleDropdown = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element;
      if (target?.closest?.("[data-search-portal]")) return;
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const n = (val: string) => Number(parseRawNumber(val)) || 0;

  const handleFormattedInput = (e: React.ChangeEvent<HTMLInputElement>, field: keyof SearchState) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    const formatted = rawValue ? new Intl.NumberFormat("id-ID").format(Number(rawValue)) : "";
    const num = Number(rawValue) || 0;
    setFormData(prev => {
      if (field === 'minPrice') setRangeErrors(p => ({ ...p, price: formatted && prev.maxPrice && num > n(prev.maxPrice) ? "Min melebihi Max" : undefined }));
      if (field === 'maxPrice') setRangeErrors(p => ({ ...p, price: formatted && prev.minPrice && num < n(prev.minPrice) ? `Harus ≥ ${prev.minPrice}` : undefined }));
      if (field === 'minLt')    setRangeErrors(p => ({ ...p, lt:    formatted && prev.maxLt    && num > n(prev.maxLt)    ? "Min melebihi Max" : undefined }));
      if (field === 'maxLt')    setRangeErrors(p => ({ ...p, lt:    formatted && prev.minLt    && num < n(prev.minLt)    ? `Harus ≥ ${prev.minLt} m²` : undefined }));
      if (field === 'minLb')    setRangeErrors(p => ({ ...p, lb:    formatted && prev.maxLb    && num > n(prev.maxLb)    ? "Min melebihi Max" : undefined }));
      if (field === 'maxLb')    setRangeErrors(p => ({ ...p, lb:    formatted && prev.minLb    && num < n(prev.minLb)    ? `Harus ≥ ${prev.minLb} m²` : undefined }));
      return { ...prev, [field]: formatted };
    });
  };

  const handleRangeBlur = (field: 'minPrice' | 'maxPrice' | 'minLt' | 'maxLt' | 'minLb' | 'maxLb') => {
    if ((field === 'minPrice' || field === 'maxPrice') && formData.minPrice && formData.maxPrice && n(formData.minPrice) > n(formData.maxPrice))
      setRangeErrors(p => ({ ...p, price: `Max harus ≥ ${formData.minPrice}` }));
    if ((field === 'minLt' || field === 'maxLt') && formData.minLt && formData.maxLt && n(formData.minLt) > n(formData.maxLt))
      setRangeErrors(p => ({ ...p, lt: `Max harus ≥ ${formData.minLt} m²` }));
    if ((field === 'minLb' || field === 'maxLb') && formData.minLb && formData.maxLb && n(formData.minLb) > n(formData.maxLb))
      setRangeErrors(p => ({ ...p, lb: `Max harus ≥ ${formData.minLb} m²` }));
  };

  const hasRangeError = () => !!(rangeErrors.price || rangeErrors.lt || rangeErrors.lb);

  const getLabel = (min: string, max: string, defaultText: string, prefix = "") => {
    if (min && max) return `${prefix}${min} - ${prefix}${max}`;
    if (min) return `Mulai ${prefix}${min}`;
    if (max) return `Hingga ${prefix}${max}`;
    return defaultText;
  };

  const handleSearch = () => {
    if (searching) return;
    if (hasRangeError()) {
      toast.error("Perbaiki range nilai sebelum mencari", { icon: "⚠️" });
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      return;
    }

    const params = new URLSearchParams();

    if (keywordTrimmed) {
      if (keywordMode === "id") params.set("idProperty", keywordTrimmed);
      else params.set("q", keywordTrimmed);
    }

    setLocationParams(params, formData.locations);

    const typeParam = serializeTypes(formData.types);
    if (typeParam) params.set(activeTab === "semua" ? "kategori" : "tipe", typeParam);

    const minPrice = parseRawNumber(formData.minPrice);
    const maxPrice = parseRawNumber(formData.maxPrice);
    if (minPrice) params.set("minHarga", minPrice);
    if (maxPrice) params.set("maxHarga", maxPrice);

    const minLt = parseRawNumber(formData.minLt);
    const maxLt = parseRawNumber(formData.maxLt);
    if (minLt) params.set("minLT", minLt);
    if (maxLt) params.set("maxLT", maxLt);

    const minLb = parseRawNumber(formData.minLb);
    const maxLb = parseRawNumber(formData.maxLb);
    if (minLb) params.set("minLB", minLb);
    if (maxLb) params.set("maxLB", maxLb);

    params.set("page", "1");
    const destination =
      activeTab === "semua"  ? "/properti/semua" :
      activeTab === "beli"   ? "/Jual" :
      activeTab === "sewa"   ? "/Sewa" : "/Lelang";
    setSearching(true);
    router.push(`${destination}?${params.toString()}`);
  };

  return (
    <>
      {/* === BAGIAN 1: BANNER BACKGROUND === */}
      <section className="relative h-[400px] flex items-center justify-center">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/hero/banner2.jpg"
            alt="Search Banner"
            fill
            className="object-cover opacity-60"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-darkmode via-darkmode/50 to-transparent"></div>
        </div>
        <div className="relative z-10 text-center px-4 mb-20">
        <span className="inline-flex items-center gap-2 text-emerald-400 font-black tracking-[0.20em] text-[10px] uppercase">
        <Icon
            icon="solar:home-smile-bold-duotone"
            className="text-base md:text-lg text-emerald-400"
        />
        <span>Hunian Baru Berkualitas</span>
        </span>
          <h1 className="text-white font-bold text-3xl md:text-5xl leading-relaxed drop-shadow-2xl">
            Temukan Properti Impian <br />
            Primary & Secondary
          </h1>
        </div>
      </section>

      {/* === BAGIAN 2: FILTER FORM (Integrated CardSlider) === */}
      <div className="container mx-auto px-4 relative z-30 -mt-24 mb-10 zoom-safe" ref={wrapperRef}>

        <TransactionTabs active={activeTab} onChange={setActiveTab} />

        {/* SEARCH CONTAINER (Dark Theme) */}
        <div className="bg-[#1A1A1A] rounded-[2rem] shadow-2xl shadow-black/50 p-2 lg:p-3 border border-white/10 backdrop-blur-md">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center divide-y lg:divide-y-0 lg:divide-x divide-white/10">

            {/* === A. KEYWORD / ID PROPERTI === */}
            <div
              className="w-full lg:w-[24%] px-3 lg:px-4 py-4 lg:py-2.5 relative group min-w-0"
              onClick={() => { setOpenDropdown(null); keywordInputRef.current?.focus(); }}
            >
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="jual-search-keyword"
                  className="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase block group-focus-within:text-primary transition-colors cursor-pointer"
                >
                  Cari Properti
                </label>
                {keywordMode && (
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-[1px] rounded-full leading-none ${
                      keywordMode === "id"
                        ? "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                        : "bg-primary/15 text-primary border border-primary/30"
                    }`}
                    title={keywordMode === "id" ? "Akan dicari sebagai ID Properti" : "Akan dicari sebagai Alamat / kata kunci"}
                  >
                    {keywordMode === "id" ? "ID" : "Alamat"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Icon
                  icon={keywordMode === "id" ? "solar:hashtag-square-bold-duotone" : "solar:magnifer-bold-duotone"}
                  className="text-xl text-gray-400 group-focus-within:text-primary transition-colors shrink-0"
                />
                <input
                  id="jual-search-keyword"
                  ref={keywordInputRef}
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  value={formData.keyword}
                  placeholder="Alamat / ID, ex: 12345"
                  onChange={(e) => setFormData(prev => ({ ...prev, keyword: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-transparent outline-none font-bold text-white text-sm placeholder:font-medium placeholder:text-gray-600 truncate"
                />
                {formData.keyword && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFormData(prev => ({ ...prev, keyword: "" })); keywordInputRef.current?.focus(); }}
                    className="shrink-0 p-1 -m-1 rounded-full text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    aria-label="Hapus pencarian"
                  >
                    <Icon icon="solar:close-circle-bold" className="text-base" />
                  </button>
                )}
              </div>
            </div>

            {/* === B. LOKASI === */}
            <div className="w-full lg:w-[20%] px-3 lg:px-4 py-4 lg:py-2.5 relative min-w-0">
                <LocationPicker
                  theme="dark"
                  value={formData.locations}
                  onChange={(locs) => setFormData((prev) => ({ ...prev, locations: locs }))}
                  open={openDropdown === "location"}
                  onOpenChange={(o) => setOpenDropdown(o ? "location" : null)}
                />
            </div>

            {/* === C. TIPE ASET === */}
            <div className="w-full lg:w-[13%] px-3 lg:px-4 py-4 lg:py-2.5 relative min-w-0">
                <TypePicker
                  theme="dark"
                  value={formData.types}
                  onChange={(ts) => setFormData((prev) => ({ ...prev, types: ts }))}
                  options={BUY_TYPES}
                  icons={PROPERTY_ICONS}
                  open={openDropdown === "type"}
                  onOpenChange={(o) => setOpenDropdown(o ? "type" : null)}
                />
            </div>

            {/* === D. HARGA === */}
            <div className="w-full lg:w-[16%] px-3 lg:px-4 py-4 lg:py-2.5 relative group min-w-0">
                <div 
                className="cursor-pointer"
                onClick={() => toggleDropdown("price")}
                >
                <label className="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase mb-1 block group-hover:text-primary transition-colors">Harga</label>
                <div className="flex items-center gap-2">
                    <Icon icon="solar:wallet-money-bold-duotone" className="text-xl text-gray-400 group-hover:text-primary transition-colors shrink-0" />
                    <div className="w-full overflow-hidden">
                        <p className="font-bold text-white text-sm truncate">
                        {getLabel(formData.minPrice, formData.maxPrice, "Range Harga")}
                        </p>
                    </div>
                    <Icon icon="solar:alt-arrow-down-linear" className={`text-gray-400 transition-transform shrink-0 ${openDropdown === "price" ? "rotate-180" : ""}`} />
                </div>
                </div>

                {openDropdown === "price" && (
                <div className="absolute top-full left-0 w-full lg:w-[320px] bg-[#222] rounded-2xl shadow-2xl border border-white/10 mt-4 p-5 z-50 animate-fade-in-up">
                    <h4 className="font-bold text-white mb-3 text-sm">Range Budget (Rp)</h4>
                    <div className="flex items-center gap-2">
                        <div className="relative w-1/2">
                        <input type="text" placeholder="Min" value={formData.minPrice} onChange={(e) => handleFormattedInput(e, 'minPrice')} onBlur={() => handleRangeBlur('minPrice')} className={`w-full bg-[#1A1A1A] border rounded-xl px-3 py-2.5 text-sm focus:border-primary outline-none text-white font-medium placeholder:text-gray-600 ${rangeErrors.price ? "border-red-500/70" : "border-white/10"}`} />
                        </div>
                        <span className="text-gray-500 font-medium">s/d</span>
                        <div className="relative w-1/2">
                        <input type="text" placeholder="Max" value={formData.maxPrice} onChange={(e) => handleFormattedInput(e, 'maxPrice')} onBlur={() => handleRangeBlur('maxPrice')} className={`w-full bg-[#1A1A1A] border rounded-xl px-3 py-2.5 text-sm focus:border-primary outline-none text-white font-medium placeholder:text-gray-600 ${rangeErrors.price ? "border-red-500/70" : "border-white/10"}`} />
                        </div>
                    </div>
                    {rangeErrors.price && <p className="text-red-400 text-[11px] mt-1.5 flex items-center gap-1"><Icon icon="solar:danger-triangle-bold-duotone" className="shrink-0 text-sm"/>{rangeErrors.price}</p>}
                </div>
                )}
            </div>

            {/* === E. DIMENSI === */}
            <div className="w-full lg:w-[17%] px-3 lg:px-4 py-4 lg:py-2.5 relative group min-w-0">
                <div 
                className="cursor-pointer"
                onClick={() => toggleDropdown("dimensions")}
                >
                <label className="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase mb-1 block group-hover:text-primary transition-colors">Dimensi</label>
                <div className="flex items-center gap-2">
                    <Icon icon="solar:ruler-angular-bold-duotone" className="text-xl text-gray-400 group-hover:text-primary transition-colors shrink-0" />
                    <div className="w-full overflow-hidden">
                        <p className="font-bold text-white text-sm truncate">
                            {formData.minLt || formData.maxLt
                            ? getLabel(formData.minLt, formData.maxLt, "", "") + " m²"
                            : "Luas Tanah/Bangunan"}
                        </p>
                    </div>
                    <Icon icon="solar:alt-arrow-down-linear" className={`text-gray-400 transition-transform shrink-0 ${openDropdown === "dimensions" ? "rotate-180" : ""}`} />
                </div>
                </div>

                {openDropdown === "dimensions" && (
                <div className="absolute top-full right-0 lg:left-auto left-0 w-full lg:w-[320px] bg-[#222] rounded-2xl shadow-2xl border border-white/10 mt-4 p-5 z-50 animate-fade-in-up">
                    <div className="mb-4">
                        <h4 className="font-bold text-white mb-2 text-sm flex items-center gap-2"><Icon icon="solar:map-bold" className="text-gray-400"/> Luas Tanah (m²)</h4>
                        <div className="flex items-center gap-2">
                        <input type="text" placeholder="Min" value={formData.minLt} onChange={(e) => handleFormattedInput(e, 'minLt')} onBlur={() => handleRangeBlur('minLt')} className={`w-1/2 bg-[#1A1A1A] border rounded-xl px-3 py-2.5 text-sm focus:border-primary outline-none font-medium placeholder:text-gray-600 text-white ${rangeErrors.lt ? "border-red-500/70" : "border-white/10"}`} />
                        <span className="text-gray-500">-</span>
                        <input type="text" placeholder="Max" value={formData.maxLt} onChange={(e) => handleFormattedInput(e, 'maxLt')} onBlur={() => handleRangeBlur('maxLt')} className={`w-1/2 bg-[#1A1A1A] border rounded-xl px-3 py-2.5 text-sm focus:border-primary outline-none font-medium placeholder:text-gray-600 text-white ${rangeErrors.lt ? "border-red-500/70" : "border-white/10"}`} />
                        </div>
                        {rangeErrors.lt && <p className="text-red-400 text-[11px] mt-1.5 flex items-center gap-1"><Icon icon="solar:danger-triangle-bold-duotone" className="shrink-0 text-sm"/>{rangeErrors.lt}</p>}
                    </div>
                    <div>
                        <h4 className="font-bold text-white mb-2 text-sm flex items-center gap-2"><Icon icon="solar:home-bold" className="text-gray-400"/> Luas Bangunan (m²)</h4>
                        <div className="flex items-center gap-2">
                            <input type="text" placeholder="Min" value={formData.minLb} onChange={(e) => handleFormattedInput(e, 'minLb')} onBlur={() => handleRangeBlur('minLb')} className={`w-1/2 bg-[#1A1A1A] border rounded-xl px-3 py-2.5 text-sm focus:border-primary outline-none font-medium placeholder:text-gray-600 text-white ${rangeErrors.lb ? "border-red-500/70" : "border-white/10"}`} />
                            <span className="text-gray-500">-</span>
                            <input type="text" placeholder="Max" value={formData.maxLb} onChange={(e) => handleFormattedInput(e, 'maxLb')} onBlur={() => handleRangeBlur('maxLb')} className={`w-1/2 bg-[#1A1A1A] border rounded-xl px-3 py-2.5 text-sm focus:border-primary outline-none font-medium placeholder:text-gray-600 text-white ${rangeErrors.lb ? "border-red-500/70" : "border-white/10"}`} />
                        </div>
                        {rangeErrors.lb && <p className="text-red-400 text-[11px] mt-1.5 flex items-center gap-1"><Icon icon="solar:danger-triangle-bold-duotone" className="shrink-0 text-sm"/>{rangeErrors.lb}</p>}
                    </div>
                </div>
                )}
            </div>

            {/* === F. TOMBOL CARI === */}
            <div className="w-full lg:w-[10%] p-4 lg:p-1.5 shrink-0 flex items-center justify-center">
                <motion.button
                  onClick={handleSearch}
                  disabled={searching}
                  animate={shaking ? { x: [0, -16, 16, -16, 16, -16, 16, -12, 12, -8, 8, 0], rotate: [0, -3, 3, -3, 3, -3, 3, -2, 2, -1, 1, 0] } : {}}
                  transition={{ duration: 0.7, ease: "easeInOut" }}
                  className="w-full lg:w-12 h-12 bg-primary hover:bg-[#6ee7b7] text-darkmode rounded-2xl lg:rounded-full font-bold text-lg flex items-center justify-center shadow-lg shadow-primary/30 transition-all transform active:scale-95 disabled:opacity-80 disabled:cursor-not-allowed"
                >
                {searching ? (
                  <span className="w-5 h-5 rounded-full border-2 border-darkmode border-t-transparent animate-spin" />
                ) : (
                  <Icon icon="solar:magnifer-linear" className="text-xl stroke-2" />
                )}
                <span className="lg:hidden ml-2">{searching ? "Mencari..." : "Cari"}</span>
                </motion.button>
            </div>

            </div>
        </div>
      </div>
    </>
  );
};

export default SearchHero;
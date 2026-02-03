"use client";
import React, { useState, useRef, useEffect } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { useRouter, useSearchParams } from "next/navigation";

// --- 1. CONFIGURATION & TYPES ---

const sortAlpha = (arr: string[]) => arr.sort((a, b) => a.localeCompare(b));

const PROPERTY_ICONS: Record<string, string> = {
  Rumah: "solar:home-2-bold-duotone",
  Apartemen: "solar:buildings-2-bold-duotone",
  Gudang: "solar:box-minimalistic-bold-duotone",
  Tanah: "solar:map-point-wave-bold-duotone",
  Pabrik: "solar:garage-bold-duotone",
  Ruko: "solar:shop-2-bold-duotone",
  Toko: "solar:shop-bold-duotone",
  "Hotel & Villa": "solar:bed-bold-duotone", // ✅ Digabung
};

// ✅ Hotel dan Villa dijadikan satu
const BUY_TYPES = sortAlpha([
  "Rumah",
  "Tanah",
  "Gudang",
  "Apartemen",
  "Pabrik",
  "Ruko",
  "Toko",
  "Hotel & Villa", // ✅ Satu item
]);

interface Region {
  id: string;
  name: string;
  level: "provinsi" | "kota" | "kecamatan" | "kelurahan";
}

interface ApiRegion {
  id: string;
  nama: string;
}

interface SearchState {
  locations: Region[];
  type: string;
  minPrice: string;
  maxPrice: string;
  minLt: string;
  maxLt: string;
}

// --- 2. COMPONENT ---

const SearchHero = () => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [viewLevel, setViewLevel] = useState<Region["level"]>("provinsi");
  const [currentList, setCurrentList] = useState<Region[]>([]);
  const [parentRegion, setParentRegion] = useState<Region | null>(null);
  const [loadingWilayah, setLoadingWilayah] = useState(false);

  const [formData, setFormData] = useState<SearchState>({
    locations: [],
    type: "",
    minPrice: "",
    maxPrice: "",
    minLt: "",
    maxLt: "",
  });

  // ✅ Parse angka Indonesia (hapus titik pemisah ribuan)
  const parseIdNumber = (val: string): number | undefined => {
    if (!val) return undefined;
    const cleaned = val.replace(/\./g, "").replace(/[^0-9]/g, "");
    if (!cleaned) return undefined;
    return Number(cleaned);
  };

  const wrapperRef = useRef<HTMLDivElement>(null);
  const BASE_API = "https://ibnux.github.io/data-indonesia";

  const router = useRouter();
  const searchParams = useSearchParams();

  // Mouse parallax
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setMouse({
        x: (e.clientX / window.innerWidth - 0.5) * 15,
        y: (e.clientY / window.innerHeight - 0.5) * 15,
      });
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  // --- Helper functions ---

  const mapData = (data: ApiRegion[], level: Region["level"]): Region[] =>
    data
      .map((item) => ({ id: item.id, name: item.nama, level }))
      .sort((a, b) => a.name.localeCompare(b.name));

  const getRegionIcon = (level: Region["level"]) => {
    switch (level) {
      case "provinsi":
        return "solar:globus-bold-duotone";
      case "kota":
        return "solar:buildings-2-bold-duotone";
      case "kecamatan":
        return "solar:buildings-bold-duotone";
      case "kelurahan":
        return "solar:map-point-wave-bold-duotone";
      default:
        return "solar:map-point-bold-duotone";
    }
  };

  const fetchRegions = async (level: Region["level"], parentId?: string) => {
    setLoadingWilayah(true);
    try {
      let url = "";
      if (level === "provinsi") url = `${BASE_API}/propinsi.json`;
      if (level === "kota" && parentId)
        url = `${BASE_API}/kabupaten/${parentId}.json`;
      if (level === "kecamatan" && parentId)
        url = `${BASE_API}/kecamatan/${parentId}.json`;
      if (level === "kelurahan" && parentId)
        url = `${BASE_API}/kelurahan/${parentId}.json`;

      if (url) {
        const res = await fetch(url);
        const data = await res.json();
        setCurrentList(mapData(data, level));
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat data wilayah");
    } finally {
      setLoadingWilayah(false);
    }
  };

  useEffect(() => {
    if (openDropdown === "location" && viewLevel === "provinsi") {
      fetchRegions("provinsi");
    }
  }, [openDropdown]);

  const toggleLocation = (item: Region) => {
    const already = formData.locations.some((loc) => loc.id === item.id);
    if (!already) {
      toast.success(`${item.name} ditambahkan`, {
        icon: "📍",
        style: {
          borderRadius: "10px",
          background: "#333",
          color: "#fff",
          fontSize: "12px",
        },
      });
    }
    setFormData((prev) => {
      const exists = prev.locations.find((loc) => loc.id === item.id);
      let newLocations = [...prev.locations];
      if (exists) {
        newLocations = newLocations.filter((loc) => loc.id !== item.id);
      } else {
        newLocations = newLocations.filter(
          (loc) => !item.id.startsWith(loc.id)
        );
        newLocations = newLocations.filter(
          (loc) => !loc.id.startsWith(item.id)
        );
        newLocations.push(item);
      }
      return { ...prev, locations: newLocations };
    });
  };

  const handleRowClick = (item: Region) => {
    if (item.level !== "kelurahan") {
      setParentRegion(item);
      let nextLevel: Region["level"] = "kota";
      if (item.level === "kota") nextLevel = "kecamatan";
      if (item.level === "kecamatan") nextLevel = "kelurahan";
      setViewLevel(nextLevel);
      fetchRegions(nextLevel, item.id);
    } else {
      toggleLocation(item);
    }
  };

  const handleBack = () => {
    setViewLevel("provinsi");
    setParentRegion(null);
    fetchRegions("provinsi");
  };

  const toggleDropdown = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const handleFormattedInput = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: keyof SearchState
  ) => {
    const raw = e.target.value.replace(/\D/g, "");
    const formatted = raw
      ? new Intl.NumberFormat("id-ID").format(Number(raw))
      : "";
    setFormData((prev) => ({ ...prev, [field]: formatted }));
  };

  const getLabel = (min: string, max: string, def: string, prefix = "") => {
    if (min && max) return `${prefix}${min} - ${prefix}${max}`;
    if (min) return `Mulai ${prefix}${min}`;
    if (max) return `Hingga ${prefix}${max}`;
    return def;
  };

  // ✅ Fungsi search yang sudah diperbaiki
  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString());

    // Lokasi
    if (formData.locations.length > 0) {
      params.set("kota", formData.locations[0].name);
    } else {
      params.delete("kota");
    }

    // ✅ Tipe: map "Hotel & Villa" → "HOTEL_DAN_VILLA"
    if (formData.type) {
      let dbType = formData.type.toUpperCase().replace(/\s+/g, "_");
      if (formData.type === "Hotel & Villa") {
        dbType = "HOTEL_DAN_VILLA";
      }
      params.set("tipe", dbType);
    } else {
      params.delete("tipe");
    }

    // ✅ Harga (nilai limit lelang)
    const minPriceNum = parseIdNumber(formData.minPrice);
    const maxPriceNum = parseIdNumber(formData.maxPrice);
    if (minPriceNum !== undefined)
      params.set("minHarga", String(minPriceNum));
    else params.delete("minHarga");
    if (maxPriceNum !== undefined)
      params.set("maxHarga", String(maxPriceNum));
    else params.delete("maxHarga");

    // ✅ Luas Tanah
    const minLtNum = parseIdNumber(formData.minLt);
    const maxLtNum = parseIdNumber(formData.maxLt);
    if (minLtNum !== undefined) params.set("minLT", String(minLtNum));
    else params.delete("minLT");
    if (maxLtNum !== undefined) params.set("maxLT", String(maxLtNum));
    else params.delete("maxLT");

    params.set("page", "1");

    router.push(`/Lelang?${params.toString()}`);
  };

  return (
    <>
      {/* 🎨 HERO dengan Animated Icons Background */}
      <section className="relative min-h-[450px] flex items-center justify-center overflow-hidden bg-gradient-to-br from-darkmode via-[#1A1A1A] to-darkmode">
        {/* Animated Background Grid */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(rgba(134, 239, 172, 0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(134, 239, 172, 0.1) 1px, transparent 1px)
              `,
              backgroundSize: "50px 50px",
              transform: `translate(${mouse.x * 0.5}px, ${mouse.y * 0.5}px)`,
              transition: "transform 0.1s ease-out",
            }}
          />
        </div>

        {/* Gradient Orbs */}
        <div
          className="absolute top-20 left-20 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl animate-pulse"
          style={{
            transform: `translate(${mouse.x * 2}px, ${mouse.y * 2}px)`,
            transition: "transform 0.3s ease-out",
          }}
        />
        <div
          className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"
          style={{
            animationDelay: "700ms",
            transform: `translate(${-mouse.x * 1.5}px, ${-mouse.y * 1.5}px)`,
            transition: "transform 0.3s ease-out",
          }}
        />

        {/* 🎯 FLOATING ICONS */}
        <div className="absolute inset-0 pointer-events-none">
          <Icon
            icon="solar:home-smile-bold-duotone"
            className="absolute top-24 left-[15%] text-emerald-400/30 text-6xl animate-bounce"
            style={{
              animationDelay: "0s",
              animationDuration: "3s",
              transform: `translate(${mouse.x * 0.8}px, ${mouse.y * 0.8}px)`,
            }}
          />
          <Icon
            icon="solar:buildings-2-bold-duotone"
            className="absolute top-32 right-[20%] text-blue-400/30 text-5xl animate-bounce"
            style={{
              animationDelay: "1s",
              animationDuration: "4s",
              transform: `translate(${-mouse.x * 0.6}px, ${mouse.y * 0.6}px)`,
            }}
          />
          <Icon
            icon="solar:map-point-wave-bold-duotone"
            className="absolute bottom-32 left-[25%] text-emerald-400/30 text-7xl animate-pulse"
            style={{
              animationDelay: "0.5s",
              transform: `translate(${mouse.x * 0.4}px, ${-mouse.y * 0.4}px)`,
            }}
          />
          <Icon
            icon="solar:medal-star-bold-duotone"
            className="absolute bottom-40 right-[15%] text-yellow-400/20 text-6xl animate-bounce"
            style={{
              animationDelay: "1.5s",
              animationDuration: "3.5s",
              transform: `translate(${-mouse.x * 0.7}px, ${-mouse.y * 0.7}px)`,
            }}
          />
          <Icon
            icon="solar:shop-2-bold-duotone"
            className="absolute top-1/2 left-[10%] text-emerald-400/25 text-5xl animate-pulse"
            style={{
              animationDelay: "2s",
              transform: `translate(${mouse.x * 0.5}px, ${mouse.y * 0.5}px)`,
            }}
          />
          <Icon
            icon="solar:verified-check-bold-duotone"
            className="absolute top-1/3 right-[12%] text-emerald-400/30 text-6xl animate-bounce"
            style={{
              animationDelay: "0.8s",
              animationDuration: "4.5s",
              transform: `translate(${-mouse.x * 0.9}px, ${mouse.y * 0.9}px)`,
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 pt-16 pb-28 text-center">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/50 backdrop-blur-xl border border-emerald-500/30 mb-5"
            style={{
              transform: `translate(${mouse.x * 0.2}px, ${mouse.y * 0.2}px)`,
              transition: "transform 0.2s ease-out",
            }}
          >
            <span className="flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-emerald-400 font-black tracking-[0.28em] text-[10px] uppercase">
              Peluang Investasi Yang Tenang
            </span>
          </div>

          {/* Heading */}
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight mb-4"
            style={{
              transform: `translate(${mouse.x * 0.3}px, ${mouse.y * 0.3}px)`,
              transition: "transform 0.2s ease-out",
              textShadow: "0 0 60px rgba(134, 239, 172, 0.2)",
            }}
          >
            Temukan{" "}
            <span className="text-emerald-400 drop-shadow-[0_0_20px_rgba(134,239,172,0.4)]">
              Properti Lelang Terbaik
            </span>
          </h1>

          <p
            className="text-slate-300 text-base md:text-lg max-w-2xl mx-auto leading-relaxed mb-6"
            style={{
              transform: `translate(${mouse.x * 0.15}px, ${mouse.y * 0.15}px)`,
              transition: "transform 0.2s ease-out",
            }}
          >
            Dapatkan rumah, tanah, dan aset komersial dengan{" "}
            <span className="text-emerald-400 font-bold">
              harga di bawah pasaran
            </span>
            . Proses transparan, legal, dan didampingi tim profesional.
          </p>

          {/* Value Props */}
          <div className="flex flex-wrap justify-center gap-3 text-xs md:text-sm">
            <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-slate-200 hover:border-emerald-500/50 transition-colors">
              <Icon
                icon="solar:shield-check-bold-duotone"
                className="text-emerald-400 text-lg"
              />
              <span>Legal & Aman</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-slate-200 hover:border-emerald-500/50 transition-colors">
              <Icon
                icon="solar:medal-star-bold-duotone"
                className="text-emerald-400 text-lg"
              />
              <span>Diskon 20–40%</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-slate-200 hover:border-emerald-500/50 transition-colors">
              <Icon
                icon="solar:ranking-bold-duotone"
                className="text-emerald-400 text-lg"
              />
              <span>Bank Terpercaya</span>
            </div>
          </div>
        </div>

        {/* Bottom Glow */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-darkmode to-transparent pointer-events-none" />
      </section>

      {/* 🔍 FLOATING SEARCH CARD */}
      <div className="relative z-20 -mt-20 mb-10" ref={wrapperRef}>
        <div className="container mx-auto px-4">
          <div className="bg-[#1A1A1A] rounded-[2rem] shadow-2xl shadow-black/50 p-2 lg:p-4 border border-white/10 backdrop-blur-md">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center divide-y lg:divide-y-0 lg:divide-x divide-white/10">
              {/* A. LOKASI */}
              <div className="w-full lg:w-[30%] px-4 lg:px-5 py-4 lg:py-3 relative group min-w-0">
                <div
                  className="cursor-pointer h-full flex flex-col justify-center"
                  onClick={() => toggleDropdown("location")}
                >
                  <label className="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase mb-1 block group-hover:text-primary transition-colors">
                    Lokasi
                  </label>

                  <div className="flex items-center gap-2 w-full">
                    <Icon
                      icon="solar:map-point-bold-duotone"
                      className="text-2xl text-gray-400 group-hover:text-primary transition-colors shrink-0"
                    />

                    <div className="w-full overflow-x-auto no-scrollbar flex items-center gap-1.5 h-7">
                      {formData.locations.length === 0 ? (
                        <div className="w-full">
                          <p className="font-bold text-white text-sm truncate">
                            Semua Lokasi
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            Pilih Provinsi, Kota...
                          </p>
                        </div>
                      ) : (
                        formData.locations.map((loc) => (
                          <span
                            key={loc.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLocation(loc);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-white text-[10px] font-bold whitespace-nowrap hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 transition-colors cursor-pointer"
                          >
                            {loc.name}
                            <Icon
                              icon="solar:close-circle-bold"
                              className="text-primary hover:text-red-400 text-xs"
                            />
                          </span>
                        ))
                      )}
                    </div>

                    <Icon
                      icon="solar:alt-arrow-down-linear"
                      className={`text-gray-400 transition-transform shrink-0 ${
                        openDropdown === "location" ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </div>

                {/* Dropdown Lokasi */}
                {openDropdown === "location" && (
                  <div className="absolute top-full left-0 w-full lg:w-[400px] bg-[#222] rounded-2xl shadow-2xl border border-white/10 mt-4 p-0 z-50 overflow-hidden flex flex-col max-h-[400px]">
                    <div className="p-4 border-b border-white/10 bg-[#2A2A2A] flex items-center justify-between sticky top-0 z-10">
                      <div className="flex items-center gap-2">
                        {viewLevel !== "provinsi" && (
                          <button
                            onClick={handleBack}
                            className="p-1.5 hover:bg-white/10 rounded-full transition-colors group"
                          >
                            <Icon
                              icon="solar:arrow-left-linear"
                              className="text-lg text-gray-400 group-hover:text-white"
                            />
                          </button>
                        )}
                        <h4 className="font-bold text-white text-sm flex items-center gap-2">
                          <Icon
                            icon={getRegionIcon(viewLevel)}
                            className="text-primary text-lg"
                          />
                          {viewLevel === "provinsi" ? (
                            <span>Pilih Wilayah</span>
                          ) : (
                            <span className="text-primary truncate max-w-[200px] block">
                              {parentRegion?.name}
                            </span>
                          )}
                        </h4>
                      </div>
                      {loadingWilayah && (
                        <Icon
                          icon="line-md:loading-loop"
                          className="text-primary text-lg"
                        />
                      )}
                    </div>

                    <div className="overflow-y-auto custom-scrollbar flex-1 bg-[#1A1A1A]">
                      {viewLevel !== "provinsi" && parentRegion && (
                        <button
                          onClick={() => toggleLocation(parentRegion)}
                          className="w-full text-left px-4 py-3 bg-primary/5 hover:bg-primary/10 border-b border-white/5 flex items-center gap-3 transition-colors"
                        >
                          <div
                            className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                              formData.locations.some(
                                (l) => l.id === parentRegion.id
                              )
                                ? "bg-primary border-primary"
                                : "border-gray-600 bg-transparent"
                            }`}
                          >
                            {formData.locations.some(
                              (l) => l.id === parentRegion.id
                            ) && (
                              <Icon
                                icon="solar:check-read-linear"
                                className="text-white text-sm"
                              />
                            )}
                          </div>
                          <span className="text-sm font-bold text-white">
                            Pilih Semua di {parentRegion.name}
                          </span>
                        </button>
                      )}

                      {currentList.map((item) => {
                        const isSelected = formData.locations.some(
                          (l) => l.id === item.id
                        );
                        const hasChild = item.level !== "kelurahan";
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between group hover:bg-white/5 border-b border-white/5 last:border-0 pr-2"
                          >
                            <button
                              onClick={() => handleRowClick(item)}
                              className="flex-1 flex items-center gap-3 px-4 py-3 text-left"
                            >
                              <Icon
                                icon={getRegionIcon(item.level)}
                                className={`text-lg shrink-0 ${
                                  isSelected
                                    ? "text-primary"
                                    : "text-gray-500 group-hover:text-primary"
                                }`}
                              />
                              <div className="flex-1 overflow-hidden">
                                <span
                                  className={`text-sm block truncate ${
                                    isSelected
                                      ? "font-bold text-primary"
                                      : "font-medium text-gray-300"
                                  }`}
                                >
                                  {item.name}
                                </span>
                                {hasChild && (
                                  <span className="text-[10px] text-gray-500 group-hover:text-primary transition-colors">
                                    Lihat{" "}
                                    {item.level === "provinsi"
                                      ? "Kota"
                                      : item.level === "kota"
                                      ? "Kecamatan"
                                      : "Kelurahan"}
                                  </span>
                                )}
                              </div>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLocation(item);
                              }}
                              className="p-3 hover:bg-white/10 rounded-lg transition-colors"
                            >
                              <div
                                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                  isSelected
                                    ? "bg-primary border-primary"
                                    : "border-gray-600 bg-transparent"
                                }`}
                              >
                                {isSelected && (
                                  <Icon
                                    icon="solar:check-read-linear"
                                    className="text-white text-sm"
                                  />
                                )}
                              </div>
                            </button>
                            {hasChild && (
                              <button
                                onClick={() => handleRowClick(item)}
                                className="p-2 text-gray-500 hover:text-primary"
                              >
                                <Icon icon="solar:alt-arrow-right-linear" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* B. TIPE ASET */}
              <div className="w-full lg:w-[20%] px-4 lg:px-5 py-4 lg:py-3 relative group min-w-0">
                <div
                  className="cursor-pointer"
                  onClick={() => toggleDropdown("type")}
                >
                  <label className="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase mb-1 block group-hover:text-primary transition-colors">
                    Tipe Aset
                  </label>
                  <div className="flex items-center gap-2">
                    <Icon
                      icon="solar:buildings-bold-duotone"
                      className="text-2xl text-gray-400 group-hover:text-primary transition-colors shrink-0"
                    />
                    <p className="font-bold text-white text-sm truncate flex-1">
                      {formData.type || "Semua Tipe"}
                    </p>
                    <Icon
                      icon="solar:alt-arrow-down-linear"
                      className={`text-gray-400 transition-transform ${
                        openDropdown === "type" ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </div>

                {openDropdown === "type" && (
                  <div className="absolute top-full left-0 w-full lg:w-[280px] bg-[#222] rounded-2xl shadow-2xl border border-white/10 mt-4 p-2 z-50 max-h-[300px] overflow-y-auto custom-scrollbar">
                    <button
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, type: "" }));
                        setOpenDropdown(null);
                      }}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors flex items-center gap-3 ${
                        formData.type === ""
                          ? "bg-primary/10 text-primary"
                          : "text-gray-300 hover:bg-white/5"
                      }`}
                    >
                      <Icon
                        icon="solar:apps-bold-duotone"
                        className="text-lg opacity-70"
                      />
                      Semua Tipe
                    </button>
                    {BUY_TYPES.map((item) => (
                      <button
                        key={item}
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, type: item }));
                          setOpenDropdown(null);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors flex items-center gap-3 ${
                          formData.type === item
                            ? "bg-primary/10 text-primary"
                            : "text-gray-300 hover:bg-white/5"
                        }`}
                      >
                        <Icon
                          icon={
                            PROPERTY_ICONS[item] || "solar:home-bold-duotone"
                          }
                          className="text-lg opacity-70"
                        />
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* C. HARGA */}
              <div className="w-full lg:w-[25%] px-4 lg:px-5 py-4 lg:py-3 relative group min-w-0">
                <div
                  className="cursor-pointer"
                  onClick={() => toggleDropdown("price")}
                >
                  <label className="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase mb-1 block group-hover:text-primary transition-colors">
                    Harga Limit
                  </label>
                  <div className="flex items-center gap-2">
                    <Icon
                      icon="solar:wallet-money-bold-duotone"
                      className="text-2xl text-gray-400 group-hover:text-primary transition-colors shrink-0"
                    />
                    <p className="font-bold text-white text-sm truncate flex-1">
                      {getLabel(
                        formData.minPrice,
                        formData.maxPrice,
                        "Range Harga"
                      )}
                    </p>
                    <Icon
                      icon="solar:alt-arrow-down-linear"
                      className={`text-gray-400 transition-transform ${
                        openDropdown === "price" ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </div>

                {openDropdown === "price" && (
                  <div className="absolute top-full left-0 w-full lg:w-[320px] bg-[#222] rounded-2xl shadow-2xl border border-white/10 mt-4 p-5 z-50">
                    <h4 className="font-bold text-white mb-3 text-sm">
                      Nilai Limit Lelang (Rp)
                    </h4>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Min"
                        value={formData.minPrice}
                        onChange={(e) => handleFormattedInput(e, "minPrice")}
                        className="w-1/2 bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:border-primary outline-none text-white font-medium placeholder:text-gray-600"
                      />
                      <span className="text-gray-500 font-medium">s/d</span>
                      <input
                        type="text"
                        placeholder="Max"
                        value={formData.maxPrice}
                        onChange={(e) => handleFormattedInput(e, "maxPrice")}
                        className="w-1/2 bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:border-primary outline-none text-white font-medium placeholder:text-gray-600"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* D. LUAS TANAH */}
              <div className="w-full lg:w-[20%] px-4 lg:px-5 py-4 lg:py-3 relative group min-w-0">
                <div
                  className="cursor-pointer"
                  onClick={() => toggleDropdown("dimensions")}
                >
                  <label className="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase mb-1 block group-hover:text-primary transition-colors">
                    Luas Tanah
                  </label>
                  <div className="flex items-center gap-2">
                    <Icon
                      icon="solar:map-bold-duotone"
                      className="text-2xl text-gray-400 group-hover:text-primary transition-colors shrink-0"
                    />
                    <p className="font-bold text-white text-sm truncate flex-1">
                      {formData.minLt || formData.maxLt
                        ? getLabel(formData.minLt, formData.maxLt, "", "") +
                          " m²"
                        : "Semua Ukuran"}
                    </p>
                    <Icon
                      icon="solar:alt-arrow-down-linear"
                      className={`text-gray-400 transition-transform ${
                        openDropdown === "dimensions" ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </div>

                {openDropdown === "dimensions" && (
                  <div className="absolute top-full right-0 lg:left-auto left-0 w-full lg:w-[300px] bg-[#222] rounded-2xl shadow-2xl border border-white/10 mt-4 p-5 z-50">
                    <h4 className="font-bold text-white mb-3 text-sm flex items-center gap-2">
                      <Icon
                        icon="solar:ruler-angular-bold-duotone"
                        className="text-primary"
                      />
                      Luas Tanah (m²)
                    </h4>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Min"
                        value={formData.minLt}
                        onChange={(e) => handleFormattedInput(e, "minLt")}
                        className="w-1/2 bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:border-primary outline-none font-medium placeholder:text-gray-600 text-white"
                      />
                      <span className="text-gray-500">—</span>
                      <input
                        type="text"
                        placeholder="Max"
                        value={formData.maxLt}
                        onChange={(e) => handleFormattedInput(e, "maxLt")}
                        className="w-1/2 bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:border-primary outline-none font-medium placeholder:text-gray-600 text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* E. TOMBOL CARI */}
              <div className="w-full lg:w-[5%] p-4 lg:p-2 shrink-0 flex items-center justify-center">
                <button
                  onClick={handleSearch}
                  className="w-full lg:w-14 h-14 bg-primary hover:bg-[#6ee7b7] text-darkmode rounded-2xl lg:rounded-full font-bold text-lg flex items-center justify-center shadow-lg shadow-primary/30 transition-all transform active:scale-95"
                >
                  <Icon
                    icon="solar:magnifer-linear"
                    className="text-2xl stroke-2"
                  />
                  <span className="lg:hidden ml-2">Cari</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(134, 239, 172, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(134, 239, 172, 0.5);
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  );
};

export default SearchHero;

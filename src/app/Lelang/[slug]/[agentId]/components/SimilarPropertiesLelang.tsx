"use client";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";

// --- TYPES ---
interface Property {
  id_property: string;
  slug: string;
  judul: string;
  kategori: string;
  jenis_transaksi: string;
  harga: number;

  kota: string;
  kecamatan: string | null;
  kelurahan: string | null;
  alamat_lengkap: string;

  gambar: string;
  foto_list: string[];
  luas_tanah: number | null;
  luas_bangunan: number | null;
  kamar_tidur: number | null;
  kamar_mandi: number | null;
  tanggal_lelang?: string | null;

  agent_name: string;
  agent_photo: string;
  dilihat: number;
  is_hot_deal: boolean;
}

interface SimilarPropertiesProps {
  currentProperty: Property;
  allProperties: Property[];
}

// --- UTILS ---
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

const formatDateShort = (date?: string | null) => {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getCategoryIcon = (kategori: string) => {
  const map: Record<string, string> = {
    RUMAH: "solar:home-2-bold-duotone",
    RUKO: "solar:shop-2-bold-duotone",
    APARTEMEN: "solar:buildings-3-bold-duotone",
    TANAH: "solar:map-bold-duotone",
    GUDANG: "solar:box-bold-duotone",
    VILLA: "solar:castle-bold-duotone",
  };
  return map[kategori.toUpperCase()] || "solar:home-smile-bold-duotone";
};

const getPropertyUrl = (property: Property) => {
  const baseUrl = property.jenis_transaksi === "LELANG" ? "/Lelang" : "/Jual";
  return `${baseUrl}/${property.slug}/${property.id_property}`;
};

// --- ALGORITMA LOKASI 3 LEVEL + HOT DEAL ---

const calculateSimilarityScore = (
  current: Property,
  candidate: Property
): { score: number; reasons: string[]; locationLevel: number } => {
  let score = 0;
  const reasons: string[] = [];
  let locationLevel = 0; // 1 = kelurahan, 2 = kecamatan, 3 = kota

  // LEVEL 1: Kelurahan sama
  if (
    current.kelurahan &&
    candidate.kelurahan &&
    current.kelurahan === candidate.kelurahan
  ) {
    score += 70;
    locationLevel = 1;
    reasons.push(`Kelurahan ${candidate.kelurahan}`);
  }
  // LEVEL 2: Kecamatan sama
  else if (
    current.kecamatan &&
    candidate.kecamatan &&
    current.kecamatan === candidate.kecamatan
  ) {
    score += 50;
    locationLevel = 2;
    reasons.push(`Kecamatan ${candidate.kecamatan}`);
  }
  // LEVEL 3: Kota sama
  else if (current.kota === candidate.kota) {
    score += 30;
    locationLevel = 3;
    reasons.push(candidate.kota);
  }

  // Kategori sama
  if (current.kategori === candidate.kategori) {
    score += 15;
    reasons.push(`${candidate.kategori}`);
  }

  // Range harga ±30%
  const priceDiff = Math.abs(current.harga - candidate.harga) / current.harga;
  if (priceDiff <= 0.3) {
    score += 10;
    reasons.push("Harga serupa");
  }

  // Hot deal sangat diprioritaskan
  if (candidate.is_hot_deal) {
    score += 20;
    reasons.push("Hot Deal");
  }

  // Popularitas kecil sebagai tie-breaker
  if (candidate.dilihat > 0) {
    score += Math.min(5, Math.floor(candidate.dilihat / 50));
    if (candidate.dilihat > 100) reasons.push("Populer");
  }

  return { score, reasons, locationLevel };
};

const getSimilarProperties = (
  current: Property,
  allProperties: Property[],
  minTotal: number = 8
): Array<Property & { score: number; reasons: string[]; locationLevel: number }> => {
  // Exclude property yang sedang dibuka
  const candidates = allProperties.filter(
    (p) => p.id_property !== current.id_property
  );

  // Hitung skor & locationLevel untuk semua
  const scored = candidates.map((p) => {
    const { score, reasons, locationLevel } = calculateSimilarityScore(
      current,
      p
    );
    return { ...p, score, reasons, locationLevel };
  });

  // Bagi berdasarkan level lokasi
  const kelurahanItems = scored.filter((p) => p.locationLevel === 1);
  const kecamatanItems = scored.filter((p) => p.locationLevel === 2);
  const kotaItems = scored.filter((p) => p.locationLevel === 3);

  // Prioritas: kelurahan → kecamatan → kota
  let bucket: Array<Property & { score: number; reasons: string[]; locationLevel: number }> =
    [];

  if (kelurahanItems.length >= minTotal) {
    bucket = kelurahanItems;
  } else {
    bucket = [...kelurahanItems, ...kecamatanItems];
    if (bucket.length < minTotal) {
      bucket = [...bucket, ...kotaItems];
    }
  }

  // Sort dalam bucket:
  // 1) locationLevel (1 terdekat), 2) is_hot_deal, 3) score
  bucket.sort((a, b) => {
    if (a.locationLevel !== b.locationLevel) {
      return a.locationLevel - b.locationLevel;
    }
    if (a.is_hot_deal !== b.is_hot_deal) {
      return a.is_hot_deal ? -1 : 1;
    }
    return b.score - a.score;
  });

  return bucket.slice(0, minTotal);
};

// --- PROPERTY CARD COMPONENT ---
const PropertyCard = ({
  item,
}: {
  item: Property & { score: number; reasons: string[]; locationLevel: number };
}) => {
  const [imageIndex, setImageIndex] = useState(0);
  const [showReasons, setShowReasons] = useState(false);

  const images =
    item.foto_list && item.foto_list.length > 0
      ? item.foto_list
      : [item.gambar || "/images/hero/banner.jpg"];

  const nextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const getLocationBadgeColor = (level: number) => {
    switch (level) {
      case 1:
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"; // kelurahan
      case 2:
        return "bg-blue-500/20 text-blue-300 border-blue-500/40"; // kecamatan
      case 3:
        return "bg-purple-500/20 text-purple-300 border-purple-500/40"; // kota
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/40";
    }
  };

  const getLocationLabel = (level: number) => {
    switch (level) {
      case 1:
        return "Dekat Sekali";
      case 2:
        return "Dekat";
      case 3:
        return "Area Sama";
      default:
        return "";
    }
  };

  return (
    <Link
      href={getPropertyUrl(item)}
      className="flex-shrink-0 w-[340px] snap-start block h-full group"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ y: -6 }}
        transition={{ duration: 0.25 }}
        className="bg-[#151515] rounded-3xl border border-white/5 overflow-hidden h-full flex flex-col hover:border-emerald-500/50 hover:shadow-[0_18px_50px_-16px_rgba(16,185,129,0.35)] transition-all duration-500 relative"
      >
        {/* IMAGE SECTION */}
        <div className="relative h-56 w-full overflow-hidden group/img">
          <Image
            src={images[imageIndex]}
            alt={item.judul}
            fill
            className="object-cover transition-transform duration-700 group-hover/img:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/55 hover:bg-emerald-500 text-white hover:text-black rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-all backdrop-blur-sm z-20"
              >
                <Icon icon="solar:alt-arrow-left-linear" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/55 hover:bg-emerald-500 text-white hover:text-black rounded-full flex itemsCenter justify-center opacity-0 group-hover/img:opacity-100 transition-all backdrop-blur-sm z-20"
              >
                <Icon icon="solar:alt-arrow-right-linear" />
              </button>

              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 z-20">
                {images.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === imageIndex
                        ? "bg-emerald-400 w-4"
                        : "bg-white/40 w-1.5"
                    }`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Category Badge */}
          <div className="absolute top-4 left-4 z-10 space-y-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 text-emerald-300 text-[10px] font-bold border border-emerald-400/40 backdrop-blur-sm uppercase tracking-wider">
              <Icon icon={getCategoryIcon(item.kategori)} className="text-sm" />
              {item.kategori}
            </span>

            {/* Location level badge */}
            {item.locationLevel > 0 && (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold backdrop-blur-sm border uppercase tracking-wider ${getLocationBadgeColor(
                  item.locationLevel
                )}`}
              >
                <Icon icon="solar:map-point-bold" className="text-xs" />
                {getLocationLabel(item.locationLevel)}
              </span>
            )}
          </div>

          {/* Hot Deal Badge */}
          {item.is_hot_deal && (
            <div className="absolute top-4 right-4 z-10">
              <span className="relative inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold text-white uppercase">
                <span className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 opacity-80 blur-[2px]" />
                <span className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 animate-pulse opacity-90" />
                <span className="relative flex items-center gap-1">
                  <Icon icon="solar:fire-bold-duotone" className="text-xs" />
                  HOT
                </span>
              </span>
            </div>
          )}

          {/* Why Similar Badge */}
          <div
            className="absolute bottom-4 right-4 z-10"
            onMouseEnter={() => setShowReasons(true)}
            onMouseLeave={() => setShowReasons(false)}
          >
            <div className="relative">
              <div className="w-8 h-8 bg-blue-500/20 backdrop-blur-md border border-blue-400/40 rounded-full flex items-center justify-center cursor-help">
                <Icon
                  icon="solar:question-circle-bold-duotone"
                  className="text-blue-300 text-lg"
                />
              </div>

              <AnimatePresence>
                {showReasons && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    className="absolute bottom-full right-0 mb-2 w-52 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl"
                  >
                    <p className="text-[10px] text-gray-400 mb-2 font-bold uppercase tracking-wider">
                      Kenapa direkomendasikan?
                    </p>
                    <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                      {item.reasons.map((reason, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 text-[10px] text-emerald-300"
                        >
                          <Icon
                            icon="solar:check-circle-bold"
                            className="text-emerald-400 text-xs shrink-0"
                          />
                          {reason}
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-white/10">
                      <p className="text-[9px] text-gray-500">
                        Skor kecocokan{" "}
                        <span className="text-emerald-400 font-bold">
                          {item.score}/100
                        </span>
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* CONTENT SECTION */}
        <div className="p-5 flex flex-col flex-grow">
          <div className="mb-2">
            <h3 className="text-white text-xl font-extrabold tracking-tight">
              {formatCurrency(item.harga)}
            </h3>
          </div>

          <h4
            className="text-gray-200 text-base font-bold line-clamp-2 mb-3 group-hover:text-emerald-400 transition-colors min-h-[48px]"
            title={item.judul}
          >
            {item.judul}
          </h4>

          <div className="flex items-start gap-2 mb-4">
            <Icon
              icon="solar:map-point-wave-bold"
              className="text-emerald-400 text-base shrink-0 mt-0.5"
            />
            <span
              className="text-gray-400 text-xs line-clamp-1 font-medium"
              title={item.alamat_lengkap}
            >
              {item.alamat_lengkap}
            </span>
          </div>

          {/* Luas tanah & tanggal lelang */}
          <div className="bg-white/5 rounded-xl p-3 mb-4 border border-white/5">
            <div className="flex justify-between items-center px-1">
              <div className="flex items-center gap-2">
                <Icon
                  icon="solar:ruler-angular-bold"
                  className="text-gray-400"
                />
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 uppercase">
                    Luas Tanah
                  </span>
                  <span className="text-white text-xs font-bold">
                    {item.luas_tanah ? `${item.luas_tanah}m²` : "-"}
                  </span>
                </div>
              </div>

              <div className="w-[1px] h-8 bg-white/10" />

              <div className="flex items-center gap-2">
                <Icon
                  icon="solar:calendar-date-bold"
                  className="text-red-400"
                />
                <div className="flex flex-col items-start">
                  <span className="text-[10px] text-gray-500 uppercase">
                    Tanggal Lelang
                  </span>
                  <span className="text-white text-xs font-bold">
                    {formatDateShort(item.tanggal_lelang)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Agent + Views */}
          <div className="mt-auto pt-3 border-t border-dashed border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-emerald-500/30">
                <Image
                  src={item.agent_photo || "/images/user/user-01.png"}
                  alt={item.agent_name}
                  fill
                  className="object-cover"
                />
              </div>
              <span className="text-[10px] text-gray-400 font-medium truncate max-w-[130px]">
                {item.agent_name}
              </span>
            </div>

            <div className="flex items-center gap-1 text-gray-500 text-[10px]">
              <Icon icon="solar:eye-bold" className="text-xs" />
              {item.dilihat}
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

// --- MAIN COMPONENT ---
export default function SimilarProperties({
  currentProperty,
  allProperties,
}: SimilarPropertiesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const similarItems = getSimilarProperties(currentProperty, allProperties, 12);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    el?.addEventListener("scroll", checkScroll);
    return () => el?.removeEventListener("scroll", checkScroll);
  }, [similarItems.length]);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 360;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  if (similarItems.length === 0) return null;

  return (
    <div className="container mx-auto px-4 mt-12 pt-12 border-t border-white/5 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Properti Serupa di Sekitar
          </h2>
          <p className="text-sm text-gray-500">
            Rekomendasi berdasarkan kelurahan, kecamatan, dan Hot Deal terdekat
          </p>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-emerald-500 text-white hover:text-black flex items-center justify-center transition-all disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:text-white border border-white/10"
          >
            <Icon icon="solar:alt-arrow-left-linear" className="text-xl" />
          </button>
          <button
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-emerald-500 textWhite hover:text-black flex items-center justify-center transition-all disabled:opacity-30 disabled:hover:bgWhite/5 disabled:hover:textWhite border borderWhite/10"
          >
            <Icon icon="solar:alt-arrow-right-linear" className="text-xl" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex overflow-x-auto pb-6 gap-5 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0"
      >
        {similarItems.map((item) => (
          <PropertyCard key={item.id_property} item={item} />
        ))}
      </div>

      <div className="flex md:hidden justify-center mt-3 gap-1.5">
        <div
          className={`h-1 w-10 rounded-full transition-all ${
            canScrollLeft ? "bg-emerald-400" : "bg-white/20"
          }`}
        />
        <div
          className={`h-1 w-10 rounded-full transition-all ${
            canScrollRight ? "bg-emerald-400" : "bg-white/20"
          }`}
        />
      </div>
    </div>
  );
}

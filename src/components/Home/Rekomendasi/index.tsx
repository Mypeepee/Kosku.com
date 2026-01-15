"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import Slider, { Settings } from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";

// --- TIPE DATA ---
type ListingType = "Primary" | "Secondary" | "Sewa" | "Lelang";

interface Property {
  id: number;
  title: string;
  location: string;
  price: number;
  period?: string;
  listingType: ListingType;
  propertyType: string;
  images: string[];
  specs: {
    lt: string;
    lb?: string;
    kt?: number;
    km?: number;
    date?: string;
  };
  agent: {
    name: string;
    photo: string;
  };
}

// --- DATA DUMMY ---
const properties: Property[] = [
  {
    id: 1,
    title: "Rumah Mewah Modern Classic",
    location: "Jl. Metro Pondok Indah, Kebayoran Lama, Jakarta Selatan",
    price: 12500000000,
    listingType: "Secondary",
    propertyType: "Rumah",
    images: [
      "/images/hero/banner-image.png",
      "/images/hero/banner.jpg",
      "/images/hero/banner-image.png"
    ],
    specs: { lt: "300m²", lb: "450m²", kt: 5, km: 4 },
    agent: { name: "Budi Santoso", photo: "/images/user/user-01.png" }
  },
  {
    id: 2,
    title: "Gudang Logistik Cikupa",
    location: "Kawasan Industri Cikupa Mas, Jl. Raya Serang Km 12, Tangerang",
    price: 2100000000,
    listingType: "Lelang",
    propertyType: "Gudang",
    images: ["/images/hero/banner-image.png", "/images/hero/banner.jpg"],
    specs: { lt: "1.200m²", date: "25 Jan 2026" },
    agent: { name: "Sari Wulandari", photo: "/images/user/user-02.png" }
  },
  {
    id: 3,
    title: "CitraGarden Serpong",
    location: "Jl. Raya Cisauk, Serpong, Tangerang Selatan",
    price: 980000000,
    listingType: "Primary",
    propertyType: "Rumah",
    images: ["/images/hero/banner-image.png", "/images/hero/banner.jpg"],
    specs: { lt: "72m²", lb: "60m²", kt: 3, km: 2 },
    agent: { name: "Rian Pratama", photo: "/images/user/user-03.png" }
  },
  {
    id: 4,
    title: "Kost Eksklusif SCBD",
    location: "Jl. Tulodong Atas, Senopati, Kebayoran Baru, Jakarta Selatan",
    price: 4500000,
    period: "bln",
    listingType: "Sewa",
    propertyType: "Kost",
    images: ["/images/hero/banner-image.png"],
    specs: { lt: "24m²", lb: "24m²", kt: 1, km: 1 },
    agent: { name: "Admin Kosku", photo: "/images/user/user-01.png" }
  },
  {
    id: 5,
    title: "Tanah Kavling Ubud View",
    location: "Jl. Raya Andong, Ubud, Gianyar, Bali",
    price: 850000000,
    listingType: "Lelang",
    propertyType: "Tanah",
    images: ["/images/hero/banner-image.png", "/images/hero/banner.jpg"],
    specs: { lt: "500m²", date: "10 Feb 2026" },
    agent: { name: "Wayan Gede", photo: "/images/user/user-02.png" }
  },
];

// --- UTILS ---
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
};

const getBadgeColor = (type: ListingType) => {
  switch (type) {
    case "Lelang": return "bg-rose-500 shadow-rose-500/20";
    case "Sewa": return "bg-emerald-500 shadow-emerald-500/20";
    case "Primary": return "bg-blue-500 shadow-blue-500/20";
    default: return "bg-violet-500 shadow-violet-500/20";
  }
};

// --- CUSTOM ARROWS (Panah Samping Utama) ---
// Note: z-index ditingkatkan agar selalu di atas konten
const CustomPrevArrow = (props: any) => {
  const { onClick } = props;
  return (
    <button
      onClick={onClick}
      className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 md:-translate-x-6 z-30 w-10 h-10 lg:w-14 lg:h-14 rounded-full bg-[#1A1A1A] border border-white/20 text-white hover:bg-primary hover:text-black hover:border-primary transition-all flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.5)] active:scale-90"
      aria-label="Previous Slide"
    >
      <Icon icon="solar:arrow-left-linear" className="text-xl lg:text-2xl" />
    </button>
  );
};

const CustomNextArrow = (props: any) => {
  const { onClick } = props;
  return (
    <button
      onClick={onClick}
      className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 md:translate-x-6 z-30 w-10 h-10 lg:w-14 lg:h-14 rounded-full bg-[#1A1A1A] border border-white/20 text-white hover:bg-primary hover:text-black hover:border-primary transition-all flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.5)] active:scale-90"
      aria-label="Next Slide"
    >
      <Icon icon="solar:arrow-right-linear" className="text-xl lg:text-2xl" />
    </button>
  );
};


// --- SUB-COMPONENT: PROPERTY CARD ---
const PropertyCard = ({ item }: { item: Property }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % item.images.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + item.images.length) % item.images.length);
  };

  return (
    <div className="bg-[#151515] border border-white/5 rounded-3xl overflow-hidden group hover:border-primary/50 transition-all duration-300 relative flex flex-col h-full hover:shadow-[0_10px_40px_-10px_rgba(74,222,128,0.15)] mx-2">

      {/* IMAGE SECTION */}
      <div className="relative h-60 md:h-64 w-full overflow-hidden group/image">
        <Image
          src={item.images[currentImageIndex]}
          alt={item.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#151515] via-transparent to-transparent opacity-60"></div>

        {/* Mini Gallery Arrows (Internal) */}
        {item.images.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-primary hover:text-black text-white rounded-full flex items-center justify-center opacity-0 group-hover/image:opacity-100 transition-all z-20"
            >
              <Icon icon="solar:alt-arrow-left-linear" />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-primary hover:text-black text-white rounded-full flex items-center justify-center opacity-0 group-hover/image:opacity-100 transition-all z-20"
            >
              <Icon icon="solar:alt-arrow-right-linear" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 z-20">
              {item.images.map((_, idx) => (
                <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentImageIndex ? 'bg-primary w-3' : 'bg-white/50'}`}></div>
              ))}
            </div>
          </>
        )}

        <div className="absolute top-4 left-4 z-10">
            <span className={`${getBadgeColor(item.listingType)} text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg uppercase tracking-wide flex items-center gap-1`}>
                {item.listingType === 'Lelang' && <Icon icon="solar:hammer-bold"/>}
                {item.listingType}
            </span>
        </div>

        <div className="absolute top-4 right-4 z-10">
            <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5">
                <Icon icon={item.propertyType === 'Gudang' ? "solar:box-bold" : "solar:home-bold"} className="text-primary"/>
                {item.propertyType}
            </span>
        </div>
      </div>

      {/* CONTENT SECTION */}
      <div className="p-5 flex flex-col flex-grow">
        <div className="mb-2">
            <div className="flex items-baseline gap-1">
                <h3 className="text-white text-xl font-extrabold tracking-tight truncate">
                    {formatCurrency(item.price)}
                </h3>
                {item.period && (
                    <span className="text-gray-400 text-xs font-medium">/{item.period}</span>
                )}
            </div>
        </div>

        <h4 className="text-gray-200 text-lg font-bold truncate mb-2 group-hover:text-primary transition-colors cursor-pointer" title={item.title}>
            {item.title}
        </h4>

        <div className="flex items-start gap-2 mb-4">
            <Icon icon="solar:map-point-wave-bold" className="text-primary text-lg shrink-0 mt-0.5" />
            <span className="text-gray-400 font-medium text-sm line-clamp-1" title={item.location}>
              {item.location}
            </span>
        </div>

        <div className="bg-white/5 rounded-xl p-3 mb-5 border border-white/5">
            {item.listingType === 'Lelang' ? (
                <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-2">
                        <Icon icon="solar:ruler-angular-bold" className="text-gray-400"/>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase">Luas Tanah</span>
                            <span className="text-white text-xs font-bold">{item.specs.lt}</span>
                        </div>
                    </div>
                    <div className="w-[1px] h-8 bg-white/10"></div>
                    <div className="flex items-center gap-2">
                        <Icon icon="solar:calendar-date-bold" className="text-red-400"/>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase">Lelang</span>
                            <span className="text-white text-xs font-bold">{item.specs.date}</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-4 divide-x divide-white/10 text-center">
                    <div>
                        <span className="text-[10px] text-gray-500 block mb-1">KT</span>
                        <span className="text-white text-xs font-bold flex justify-center items-center gap-1">
                            <Icon icon="solar:bed-bold" className="text-xs text-gray-400"/> {item.specs.kt}
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] text-gray-500 block mb-1">KM</span>
                        <span className="text-white text-xs font-bold flex justify-center items-center gap-1">
                            <Icon icon="solar:bath-bold" className="text-xs text-gray-400"/> {item.specs.km}
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] text-gray-500 block mb-1">LT</span>
                        <span className="text-white text-xs font-bold">{item.specs.lt}</span>
                    </div>
                    <div>
                        <span className="text-[10px] text-gray-500 block mb-1">LB</span>
                        <span className="text-white text-xs font-bold">{item.specs.lb}</span>
                    </div>
                </div>
            )}
        </div>

        <div className="mt-auto pt-4 border-t border-dashed border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3 group/agent cursor-pointer">
                <div className="relative w-9 h-9 rounded-full p-[1px] bg-gradient-to-tr from-primary to-transparent">
                    <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#151515] relative">
                        <Image src={item.agent.photo} alt={item.agent.name} fill className="object-cover" />
                    </div>
                </div>
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-white group-hover/agent:text-primary transition-colors">{item.agent.name}</span>
                    <span className="text-[10px] text-gray-500">Brighton Agent</span>
                </div>
            </div>

            <button className="bg-[#25D366] hover:bg-[#20bd70] text-white text-xs font-bold px-4 py-2 rounded-full flex items-center gap-2 transition-all shadow-lg shadow-green-500/20 active:scale-95">
                <Icon icon="logos:whatsapp-icon" className="text-sm bg-white rounded-full p-[1px]"/>
                Hubungi
            </button>
        </div>

      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
const Recommendation = () => {
  const sliderRef = useRef<Slider>(null);

  const settings: Settings = {
    dots: true,
    infinite: false,
    speed: 500,
    // DESKTOP: Cukup 3 saja sesuai request
    slidesToShow: 3, 
    slidesToScroll: 1,
    arrows: true, 
    nextArrow: <CustomNextArrow />,
    prevArrow: <CustomPrevArrow />,
    cssEase: "cubic-bezier(0.87, 0, 0.13, 1)",
    responsive: [
      {
        breakpoint: 1280, 
        settings: {
          slidesToShow: 3,
        }
      },
      {
        breakpoint: 1024, 
        settings: {
          slidesToShow: 2,
        }
      },
      {
        // MOBILE VIEW ( < 640px )
        breakpoint: 640,
        settings: {
          slidesToShow: 1,
          dots: true,
          arrows: true, // WAJIB TRUE agar panah muncul di mobile
          // Pastikan panah custom tetap dirender
          nextArrow: <CustomNextArrow />,
          prevArrow: <CustomPrevArrow />,
        }
      }
    ]
  };

  return (
    // PADDING: py-16 (Standar Compact) | BG: #0F0F0F
    <section className="py-16 bg-[#0F0F0F] relative overflow-hidden group/slider-container">
      <div className="container mx-auto px-4 lg:max-w-screen-xl relative z-10">

        {/* HEADER */}
        <div className="mb-10">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block py-1 px-3 rounded-full bg-white/5 border border-white/10 text-primary text-[10px] font-bold tracking-widest mb-3 uppercase"
          >
            Pilihan Editor
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="text-white text-3xl md:text-4xl font-extrabold"
          >
            Properti <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-green-300">Populer</span>
          </motion.h2>
        </div>

        {/* SLIDER WRAPPER */}
        {/* Padding horizontal ditambah (px-8) agar panah tidak menutupi konten di mobile */}
        <div className="relative px-4 md:px-8 -mx-4">
          <Slider ref={sliderRef} {...settings} className="property-slider">
            {properties.map((item) => (
              <div key={item.id} className="px-2 md:px-4 h-full py-6">
                <PropertyCard item={item} />
              </div>
            ))}
          </Slider>
        </div>
      </div>
    </section>
  );
};

export default Recommendation;
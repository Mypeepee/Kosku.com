"use client";
import React, { useRef } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import Link from "next/link";

// DUMMY DATA (Diperbanyak jadi 6 untuk tes scroll)
const SIMILAR_PROPERTIES = [
  {
    id: 1,
    title: "Bassura City",
    location: "Jatinegara, Jaktim",
    image: "/images/hero/banner.jpg",
    price: 4200000,
    rating: 4.6,
    type: "2BR",
    tags: ["Semi Furnished", "Direct Owner"],
    isVerified: true,
  },
  {
    id: 2,
    title: "Kalibata City Green Palace",
    location: "Pancoran, Jaksel",
    image: "/images/hero/banner.jpg",
    price: 5500000,
    rating: 4.8,
    type: "Studio",
    tags: ["Full Furnished", "Pro Managed"],
    isVerified: true,
  },
  {
    id: 3,
    title: "Podomoro Golf View",
    location: "Cimanggis, Depok",
    image: "/images/hero/banner.jpg",
    price: 3800000,
    rating: 4.5,
    type: "2BR",
    tags: ["Unfurnished", "Nego"],
    isVerified: false,
  },
  {
    id: 4,
    title: "Apartemen Margonda Residence",
    location: "Beji, Depok",
    image: "/images/hero/banner.jpg",
    price: 2500000,
    rating: 4.3,
    type: "Studio",
    tags: ["Student Friendly", "Wifi"],
    isVerified: true,
  },
  {
    id: 5,
    title: "Green Pramuka City",
    location: "Cempaka Putih, Jakpus",
    image: "/images/hero/banner.jpg",
    price: 4800000,
    rating: 4.7,
    type: "2BR",
    tags: ["Mall Access", "Strategic"],
    isVerified: true,
  },
];

export default function SimilarProperties() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const formatRupiah = (val: number) => 
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);

  // Logic Scroll Button
  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
        const { current } = scrollRef.current;
        const scrollAmount = 340; // Geser sejauh 1 kartu + gap
        current.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth'
        });
    }
  };

  return (
    <div className="w-full py-8 border-t border-white/10 mt-10">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
        <div>
           <h3 className="text-xl md:text-2xl font-bold text-white mb-1">Properti Serupa</h3>
           <p className="text-gray-400 text-xs md:text-sm">Rekomendasi hunian lain di sekitar area ini</p>
        </div>
        
        {/* Navigation Buttons */}
        <div className="flex items-center gap-3">
            <button 
                onClick={() => scroll('left')}
                className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all active:scale-95"
            >
                <Icon icon="solar:alt-arrow-left-linear" className="text-xl"/>
            </button>
            <button 
                onClick={() => scroll('right')}
                className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all active:scale-95"
            >
                <Icon icon="solar:alt-arrow-right-linear" className="text-xl"/>
            </button>
        </div>
      </div>

      {/* SLIDER CONTAINER */}
      <div 
        ref={scrollRef}
        className="flex gap-5 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4 -mx-4 px-4 md:mx-0 md:px-0"
      >
        {SIMILAR_PROPERTIES.map((item) => (
          <Link 
            href={`/apartemen/${item.id}`} 
            key={item.id} 
            className="group min-w-[300px] md:min-w-[340px] snap-center" // FIX WIDTH DISINI
          >
            <div className="bg-[#1A1A1A] border border-white/10 rounded-3xl p-3 hover:border-white/30 transition-all duration-300 h-full flex flex-col relative">
              
              {/* IMAGE (Aspect Ratio 4:3 Standard Real Estate) */}
              <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden mb-4">
                <Image 
                    src={item.image} 
                    alt={item.title} 
                    fill 
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />

                {/* Badge Type (Top Left) */}
                <div className="absolute top-3 left-3">
                    <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-lg border border-white/10">
                        {item.type}
                    </span>
                </div>

                {/* Love Button (Top Right) */}
                <button className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-white hover:text-red-500 transition-colors border border-white/10">
                    <Icon icon="solar:heart-linear" />
                </button>

                {/* Rating (Bottom Left Image) */}
                <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10">
                    <Icon icon="solar:star-bold" className="text-yellow-500 text-xs"/>
                    <span className="text-xs font-bold text-white">{item.rating}</span>
                </div>
              </div>

              {/* CONTENT */}
              <div className="flex-1 flex flex-col px-1">
                  <div className="flex justify-between items-start mb-1">
                      <h4 className="text-base font-bold text-white group-hover:text-[#86efac] transition-colors line-clamp-1 w-full">{item.title}</h4>
                      {item.isVerified && (
                        <Icon icon="solar:verified-check-bold" className="text-blue-400 text-lg shrink-0 ml-2" title="Verified"/>
                      )}
                  </div>

                  <div className="flex items-center gap-1 text-gray-400 text-xs mb-3">
                      <Icon icon="solar:map-point-linear"/>
                      {item.location}
                  </div>

                  {/* Tags Row */}
                  <div className="flex flex-wrap gap-2 mb-4">
                      {item.tags.slice(0, 2).map((tag, idx) => (
                          <span key={idx} className="text-[10px] font-medium text-gray-400 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                              {tag}
                          </span>
                      ))}
                  </div>

                  {/* Price & Action */}
                  <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between">
                      <div>
                          <p className="text-[10px] text-gray-500">Mulai dari</p>
                          <p className="text-base font-extrabold text-[#86efac]">
                              {formatRupiah(item.price)}
                              <span className="text-[10px] font-normal text-gray-400 ml-1">/bln</span>
                          </p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Icon icon="solar:arrow-right-up-linear" className="text-lg"/>
                      </div>
                  </div>
              </div>

            </div>
          </Link>
        ))}
        
        {/* CTA CARD (Jika scroll mentok kanan, ajak user lihat semua) */}
        <Link href="/CariApartemen" className="group min-w-[200px] snap-center flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-gray-400 group-hover:text-white transition-colors">
                <div className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-[#86efac] group-hover:text-black group-hover:border-[#86efac] transition-all">
                    <Icon icon="solar:arrow-right-linear" className="text-2xl"/>
                </div>
                <span className="text-sm font-bold">Lihat Semua</span>
            </div>
        </Link>

      </div>
    </div>
  );
}
"use client";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";

// --- HELPER FUNCTIONS ---
// 1. Format Rupiah
const formatRupiah = (val: number) => 
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);

// 2. Warna Badge Tipe Kos
const getTypeColor = (type: string) => {
  switch (type.toLowerCase()) {
    case 'putri': return 'bg-pink-500/20 text-pink-300 border border-pink-500/30';
    case 'putra': return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
    case 'campur': return 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
    default: return 'bg-gray-500/20 text-gray-300 border border-gray-500/30';
  }
};

// 3. Ikon Fasilitas
const getFacilityIcon = (fac: string) => {
  const map: Record<string, string> = {
    wifi: "solar:wi-fi-square-bold",
    ac: "solar:snowflake-bold",
    tv: "solar:tv-bold",
    "k.mandi": "solar:bath-bold", // <--- PERBAIKAN: Ditambahkan tanda kutip agar tidak error
    parkir: "solar:parking-bold",
    pool: "solar:swimming-bold",
    gym: "solar:dumbbell-large-bold",
  };
  return map[fac.toLowerCase()] || "solar:star-bold";
};

// --- MOCK DATA SIMILAR PROPERTIES ---
const similarKos = [
  {
    id: 101,
    name: "Kost Putri Melati",
    loc: "Kukusan, Depok",
    image: "/images/hero/banner.jpg", // Ganti path gambar sesuai project Anda
    type: "Putri",
    price: 1200000,
    rating: 4.5,
    facilities: ["Wifi", "K.Mandi"],
    isVerified: true,
    sisaKamar: 2
  },
  {
    id: 102,
    name: "Residence 88",
    loc: "Pogung, Jogja",
    image: "/images/hero/banner.jpg",
    type: "Campur",
    price: 2100000,
    rating: 4.7,
    typeColor: "campur",
    facilities: ["Wifi", "AC", "TV"],
    isVerified: true,
    sisaKamar: 5
  },
  {
    id: 103,
    name: "Dago Asri Living",
    loc: "Dago, Bandung",
    image: "/images/hero/banner.jpg",
    type: "Putra",
    price: 1850000,
    rating: 4.6,
    facilities: ["Wifi", "Parkir", "AC"],
    isVerified: false,
    sisaKamar: 1
  },
  {
    id: 104,
    name: "Apartemen Margonda",
    loc: "Margonda, Depok",
    image: "/images/hero/banner.jpg",
    type: "Campur",
    price: 3500000,
    rating: 4.9,
    facilities: ["Wifi", "AC", "Pool"],
    isVerified: true,
    sisaKamar: 0 // Kos Penuh -> Grayscale
  },
  {
    id: 105,
    name: "Kosku Exclusive",
    loc: "Setiabudi, Jaksel",
    image: "/images/hero/banner.jpg",
    type: "Putri",
    price: 4500000,
    rating: 5.0,
    facilities: ["AC", "Gym", "Wifi"],
    isVerified: true,
    sisaKamar: 3
  }
];

export default function SimilarProperties() {
  return (
      <div className="container mx-auto px-4 mt-8 pt-8 border-t border-white/5 mb-8">
         {/* HEADER SECTION */}
         <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Mungkin Kamu Suka</h2>
            <Link href="/Carikos" className="text-sm text-[#86efac] font-bold hover:underline flex items-center gap-1 transition-all">
               Lihat Lainnya <Icon icon="solar:arrow-right-linear" />
            </Link>
         </div>
         
         {/* SCROLLABLE CARD CONTAINER */}
         <div className="flex overflow-x-auto pb-6 gap-4 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
            {similarKos.map((item) => (
                <Link 
                   href={`/Carikos/${item.id}`} 
                   key={item.id} 
                   className="flex-shrink-0 w-72 snap-center block h-full group"
                >
                  <div className={`group bg-[#151515] rounded-3xl border border-white/5 shadow-lg hover:border-[#86efac]/50 hover:shadow-[0_0_30px_rgba(134,239,172,0.1)] transition-all duration-500 overflow-hidden flex flex-col cursor-pointer hover:-translate-y-2 relative h-full ${item.sisaKamar === 0 ? 'opacity-70' : ''}`}>
                    
                    {/* IMAGE AREA */}
                    <div className="relative h-48 w-full overflow-hidden">
                      <Image 
                        src={item.image} 
                        alt={item.name} 
                        fill 
                        className={`object-cover transition-transform duration-700 group-hover:scale-110 ${item.sisaKamar === 0 ? 'grayscale' : ''}`} 
                      />
                      
                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80"></div>

                      {/* Badge Type (Putra/Putri/Campur) */}
                      <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-sm z-10 ${getTypeColor(item.type)}`}>
                        {item.type}
                      </div>

                      {/* Verified Badge */}
                      {item.isVerified && (
                        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur text-[#86efac] p-1.5 rounded-full shadow-sm z-10 border border-white/10" title="Verified Kos">
                          <Icon icon="solar:verified-check-bold" width="14" />
                        </div>
                      )}

                      {/* Sold Out Overlay */}
                      {item.sisaKamar === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20 backdrop-blur-[2px]">
                              <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full border border-white/20 transform -rotate-6 shadow-xl">
                                  KAMAR PENUH
                              </span>
                          </div>
                      )}

                      {/* Title & Location (Overlay Bottom) */}
                      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end z-10">
                          <div className="w-full">
                              <p className="text-white font-bold text-lg leading-tight truncate mb-1">{item.name}</p>
                              <p className="text-gray-300 text-xs flex items-center gap-1 truncate">
                                <Icon icon="solar:map-point-bold" className="text-gray-400 shrink-0"/> {item.loc}
                              </p>
                          </div>
                      </div>
                    </div>

                    {/* CONTENT AREA */}
                    <div className="p-5 flex flex-col flex-grow">
                      {/* Facilities Row */}
                      <div className="flex items-center gap-2 mb-4 flex-wrap">
                        {item.facilities.slice(0, 3).map((fac, idx) => (
                          <div key={idx} className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md text-[10px] text-gray-400 border border-white/5">
                            <Icon icon={getFacilityIcon(fac)} /> <span className="capitalize">{fac}</span>
                          </div>
                        ))}
                        {item.facilities.length > 3 && (
                            <span className="text-[10px] text-gray-500">+{item.facilities.length - 3}</span>
                        )}
                      </div>

                      {/* Dashed Divider */}
                      <div className="border-t border-dashed border-white/10 my-auto"></div>

                      {/* Price & Rating Row */}
                      <div className="flex items-center justify-between pt-4 mt-auto">
                        <div>
                            <p className="text-[10px] text-gray-500 mb-0.5 font-medium">Mulai dari</p>
                            <div className="flex items-baseline gap-1">
                                <span className={`font-extrabold text-lg ${item.sisaKamar === 0 ? 'text-gray-500 line-through decoration-red-500' : 'text-[#86efac]'}`}>
                                    {formatRupiah(item.price)}
                                </span>
                                <span className="text-gray-500 text-[10px]">/bln</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 text-yellow-500 font-bold text-sm bg-yellow-500/10 px-2 py-1 rounded-lg border border-yellow-500/20">
                           <Icon icon="solar:star-bold" /> {item.rating}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
            ))}
            
            {/* View More Card (Last Item) */}
            <Link href="/Carikos" className="flex-shrink-0 w-40 snap-center flex items-center justify-center group">
                 <div className="flex flex-col items-center gap-3">
                     <div className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center text-gray-400 group-hover:bg-[#86efac] group-hover:text-black group-hover:border-[#86efac] transition-all duration-300">
                         <Icon icon="solar:arrow-right-linear" className="text-2xl"/>
                     </div>
                     <span className="text-xs font-bold text-gray-500 group-hover:text-white transition-colors">Lihat Semua</span>
                 </div>
            </Link>
         </div>
      </div>
  );
}
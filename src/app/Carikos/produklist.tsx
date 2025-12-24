"use client";
import React from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import Sidebar from "./sidebar"; // Pastikan import sidebar sesuai nama file Anda
import Link from "next/link"; // PENTING: Untuk navigasi


// --- DATA DUMMY ---
const kosList = [
  {
    id: 1,
    name: "Kosku Executive Residence",
    type: "Campur",
    location: "Setiabudi, Jaksel",
    price: "2.500.000",
    period: "bulan",
    rating: 4.8,
    reviews: 120,
    facilities: ["wifi", "ac", "bathroom", "parking", "tv"],
    image: "/images/hero/banner.jpg", 
    sisaKamar: 2,
    isVerified: true,
  },
  {
    id: 2,
    name: "Wisma Putri Melati",
    type: "Putri",
    location: "Kukusan, Depok",
    price: "850.000",
    period: "bulan",
    rating: 4.5,
    reviews: 45,
    facilities: ["wifi", "bathroom"],
    image: "/images/hero/banner.jpg", 
    sisaKamar: 5,
    isVerified: true,
  },
  {
    id: 3,
    name: "Pavilion 88 Exclusive",
    type: "Putra",
    location: "Gejayan, Jogja",
    price: "1.800.000",
    period: "bulan",
    rating: 4.9,
    reviews: 210,
    facilities: ["wifi", "ac", "bathroom", "tv", "kitchen"],
    image: "/images/hero/banner.jpg", 
    sisaKamar: 1,
    isVerified: true,
  },
  {
    id: 4,
    name: "Kost Singgah Sini",
    type: "Campur",
    location: "Dago, Bandung",
    price: "150.000",
    period: "hari",
    rating: 4.6,
    reviews: 88,
    facilities: ["wifi", "ac", "parking"],
    image: "/images/hero/banner.jpg", 
    sisaKamar: 10,
    isVerified: false,
  },
  {
    id: 5,
    name: "Apartemen Kalibata City",
    type: "Campur",
    location: "Pancoran, Jaksel",
    price: "4.000.000",
    period: "bulan",
    rating: 4.7,
    reviews: 300,
    facilities: ["wifi", "ac", "kitchen", "pool", "gym"],
    image: "/images/hero/banner.jpg", 
    sisaKamar: 3,
    isVerified: true,
  },
  {
    id: 6,
    name: "Kos Harian Backpacker",
    type: "Putra",
    location: "Malioboro, Jogja",
    price: "75.000",
    period: "hari",
    rating: 4.3,
    reviews: 50,
    facilities: ["wifi", "bathroom"],
    image: "/images/hero/banner.jpg", 
    sisaKamar: 0,
    isVerified: false,
  },
];

// --- HELPERS ---
const getFacilityIcon = (fac: string) => {
  switch (fac) {
    case "wifi": return "solar:wi-fi-router-bold";
    case "ac": return "solar:snowflake-bold";
    case "bathroom": return "solar:bath-bold";
    case "parking": return "solar:wheel-bold";
    case "tv": return "solar:tv-bold";
    case "kitchen": return "solar:chef-hat-bold";
    case "pool": return "solar:waterdrops-bold";
    case "gym": return "solar:dumbbell-large-bold";
    default: return "solar:box-bold";
  }
};

const getTypeColor = (type: string) => {
  if (type === "Putri") return "bg-pink-500/20 text-pink-300 border-pink-500/30";
  if (type === "Putra") return "bg-blue-500/20 text-blue-300 border-blue-500/30";
  return "bg-purple-500/20 text-purple-300 border-purple-500/30"; 
};

const ProductList = () => {
  return (
    <div className="container mx-auto px-4 mt-12">
      
      {/* LAYOUT GRID: KIRI PRODUK (9), KANAN SIDEBAR (3) */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        
        {/* === AREA PRODUK (KIRI) === */}
        <div className="w-full lg:w-3/4">
           
           {/* Header Sort Kecil di atas Produk */}
           <div className="flex justify-between items-center mb-6">
              <h2 className="text-white font-bold text-lg">
                <span className="text-primary">{kosList.length}</span> Kos ditemukan
              </h2>
              <button className="lg:hidden flex items-center gap-2 text-white border border-white/20 px-4 py-2 rounded-lg text-sm">
                 <Icon icon="solar:filter-bold" /> Filter
              </button>
           </div>

           {/* Grid Produk */}
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {kosList.map((item) => (
                // REVISI LINK: Mengarah ke /Carikos/[id] sesuai nama folder Anda
                <Link href={`/Carikos/${item.id}`} key={item.id} className="block h-full group">
                  <div className="group bg-[#1A1A1A] rounded-2xl border border-white/5 shadow-lg hover:border-primary/50 hover:shadow-[0_0_30px_rgba(34,197,94,0.1)] transition-all duration-300 overflow-hidden flex flex-col cursor-pointer hover:-translate-y-1 relative h-full">
                    {/* Gambar */}
                    <div className="relative h-48 w-full overflow-hidden">
                      <Image src={item.image} alt={item.name} fill className={`object-cover transition-transform duration-700 group-hover:scale-110 ${item.sisaKamar === 0 ? 'grayscale opacity-50' : ''}`} />
                      
                      {item.sisaKamar === 0 && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                          <span className="text-white font-bold text-lg uppercase border-2 border-white/50 px-4 py-1 rounded backdrop-blur-sm">Penuh</span>
                        </div>
                      )}

                      <div className={`absolute top-3 left-3 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider border backdrop-blur-md shadow-sm ${getTypeColor(item.type)}`}>
                        {item.type}
                      </div>

                      {item.isVerified && (
                        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur text-primary p-1 rounded-full shadow-sm z-10 border border-white/10">
                          <Icon icon="solar:verified-check-bold" width="14" />
                        </div>
                      )}

                      {item.sisaKamar > 0 && item.sisaKamar <= 3 && (
                        <div className="absolute bottom-3 left-3 bg-red-600/90 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-1 rounded shadow-lg animate-pulse flex items-center gap-1 border border-red-400/30">
                          <Icon icon="solar:fire-bold" width="10" />
                          Sisa {item.sisaKamar}
                        </div>
                      )}
                    </div>

                    {/* Konten */}
                    <div className="p-4 flex flex-col flex-grow">
                      <div className="flex items-center gap-2 mb-2">
                        {item.facilities.slice(0, 4).map((fac, idx) => (
                          <div key={idx} className="text-gray-500 group-hover:text-gray-300 transition-colors">
                            <Icon icon={getFacilityIcon(fac)} width="16" />
                          </div>
                        ))}
                      </div>

                      <div className="mb-1">
                        <h3 className="text-white font-bold text-base leading-snug line-clamp-1 group-hover:text-primary transition-colors">{item.name}</h3>
                      </div>

                      <div className="flex items-center gap-1 mb-3">
                        <Icon icon="solar:map-point-bold" className="text-gray-500 flex-shrink-0" width="12" />
                        <p className="text-gray-400 text-xs line-clamp-1">{item.location}</p>
                      </div>

                      <div className="border-t border-dashed border-white/10 my-auto"></div>

                      <div className="flex items-center justify-between pt-3 mt-auto">
                        <div className="flex flex-col">
                          <div className="flex items-end gap-1">
                            <span className="text-primary font-bold text-base">Rp {item.price}</span>
                            <span className="text-gray-500 text-[9px] mb-1 font-medium">/{item.period}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded border border-white/5">
                          <Icon icon="solar:star-bold" className="text-yellow-500" width="10" />
                          <span className="text-[10px] font-bold text-white">{item.rating}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
           </div>
           
           {/* Pagination */}
           <div className="mt-12 text-center">
              <button className="px-8 py-3 rounded-full border border-white/20 text-white font-bold hover:bg-white hover:text-darkmode transition-all duration-300">
                Muat Lebih Banyak
              </button>
           </div>
        </div>

        {/* === AREA SIDEBAR (KANAN) === */}
        <div className="hidden lg:block w-1/4">
           <Sidebar />
        </div>

      </div>
    </div>
  );
};

export default ProductList;
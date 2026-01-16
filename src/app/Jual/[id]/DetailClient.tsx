"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";

// --- IMPORT COMPONENTS ---
import MobileNav from "./components/MobileNav";
import ImageGallery from "./components/ImageGallery";
import DetailInfo from "./components/DetailInfo";
import BookingSidebar from "./components/BookingSidebar";
import SimilarProperties from "./components/SimilarProperties";

// --- MOCK DATA DETAIL KOS (Updated Structure for UI) ---
const kosDetailData = {
  id: 101,
  title: "Kosku Executive Residence Setiabudi",
  location: "Kawasan Setiabudi Tengah, Jakarta Selatan",
  // Harga Sewa & Deposit
  priceRates: { 
    monthly: 2500000, 
    daily: 150000 
  },
  deposit: 500000,
  
  images: [
    "/images/hero/banner.jpg", 
    "/images/hero/banner.jpg",
    "/images/hero/banner.jpg",
    "/images/hero/banner.jpg",
    "/images/hero/banner.jpg"
  ],
  
  type: "Putri",
  address: "Jl. Setiabudi Tengah No. 18, Jakarta Selatan",
  rating: 4.8,
  reviews: 124,
  description: "Hunian kos premium khusus putri dengan konsep Scandinavian modern. Lokasi sangat strategis, hanya 5 menit jalan kaki ke stasiun MRT Setiabudi. Lingkungan tenang, aman, dan bebas banjir.",
  
  owner: { 
    name: "Ibu Hajjah Rina", 
    join: "2021", 
    response: "Hitungan Menit",
    avatar: "R"
  },
  
  specs: { laundry: "Gratis (20kg)", security: "24 Jam + CCTV" },

  // --- DATA KAMAR YANG DISESUAIKAN UI ---
  roomTypes: [
    { 
        id: 1, 
        name: "Economy Room", 
        price: 1800000, 
        size: "3x3 m", 
        bedType: "Single Bed (100x200)", 
        image: "/images/hero/banner.jpg", 
        isPromo: true,
        // Data untuk Grid Fasilitas (Icon + Label)
        amenities: [
            { icon: "solar:bath-linear", label: "KM Luar" },
            { icon: "solar:fan-linear", label: "Kipas Angin" },
            { icon: "solar:bolt-linear", label: "Listrik Token" },
            { icon: "solar:user-linear", label: "Max 1 Orang" }
        ],
        // Badge Fasilitas Bawah
        tags: ["WiFi", "Meja Belajar", "Lemari"]
    },
    { 
        id: 2, 
        name: "Standard AC", 
        price: 2500000, 
        size: "3x4 m", 
        bedType: "Double Bed (120x200)", 
        image: "/images/hero/banner.jpg", 
        isPromo: false,
        amenities: [
            { icon: "solar:bath-bold", label: "KM Dalam" },
            { icon: "solar:snowflake-bold", label: "AC Standard" },
            { icon: "solar:bolt-linear", label: "Listrik Token" },
            { icon: "solar:user-linear", label: "Max 1 Orang" }
        ],
        tags: ["WiFi", "Meja Kerja", "Lemari Besar", "Cermin"]
    },
    { 
        id: 3, 
        name: "VIP Suite", 
        price: 3500000, 
        size: "4x5 m", 
        bedType: "Queen Bed (160x200)", 
        image: "/images/hero/banner.jpg", 
        isPromo: false,
        amenities: [
            { icon: "solar:bath-bold", label: "KM Dalam + Heater" },
            { icon: "solar:snowflake-bold", label: "AC Inverter" },
            { icon: "solar:bolt-circle-bold", label: "Free Listrik" },
            { icon: "solar:users-group-rounded-bold", label: "Bisa Pasutri (Max 2)", highlight: true } // Highlight pink
        ],
        tags: ["Smart TV", "Kulkas Pribadi", "Sofa", "Balcony"]
    },
  ],

  facilities: { public: ["Dapur Bersama", "Kulkas Umum", "Dispenser", "Ruang Tamu", "Parkir Motor"] },
  rules: ["Tamu Pria dilarang masuk kamar", "Akses 24 Jam", "Dilarang Merokok di kamar"],
  depositInfo: { amount: 500000, notes: "Dikembalikan utuh saat check-out jika tidak ada kerusakan." },
  accessibility: ["Dekat MRT", "Dekat Mall", "Banyak Makanan"],
  ratingDetail: { clean: 4.9, comfort: 4.8, location: 5.0, service: 4.7, value: 4.8 },
};

export default function DetailClient({ id }: { id: number }) {
  // 1. LIFTING STATE UP: State ada di Parent agar bisa dishare
  const [selectedRoom, setSelectedRoom] = useState(kosDetailData.roomTypes[0]);

  return (
    <div className="text-white font-sans bg-[#0F0F0F]">
      
      <MobileNav />
      <div className="hidden lg:block h-24 w-full"></div>

      <div className="hidden lg:block container mx-auto px-4 mb-6">
         <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            <Link href="/" className="hover:text-[#86efac] transition-colors">Home</Link> 
            <Icon icon="solar:alt-arrow-right-linear" />
            <Link href="/Carikos" className="hover:text-[#86efac] transition-colors">Cari Kos</Link> 
            <Icon icon="solar:alt-arrow-right-linear" />
            <span className="text-white truncate max-w-xs">{kosDetailData.title}</span>
         </div>
      </div>

      <div className="container mx-auto lg:px-4 mb-8">
         <ImageGallery images={kosDetailData.images} />
      </div>

      <div className="container mx-auto px-4 relative">
         <div className="flex flex-col lg:flex-row gap-10 items-start">
            
            {/* 2. PASS STATE KE DETAIL INFO */}
            <DetailInfo 
                data={kosDetailData} 
                selectedRoom={selectedRoom} 
                setSelectedRoom={setSelectedRoom} 
            />

            {/* 3. PASS STATE KE BOOKING SIDEBAR */}
            <BookingSidebar 
                data={kosDetailData} 
                selectedRoom={selectedRoom} 
            />
            
         </div>
      </div>

      <SimilarProperties />

    </div>
  );
}
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";

// --- IMPORT KOMPONEN ---
import DetailInfo from "./components/DetailInfo"; 
import BookingSidebar from "./components/BookingSidebar";
import ImageGallery from "./components/ImageGallery";
import MobileNav from "./components/MobileNav"; 
// 1. Import Component SimilarProperties
import SimilarProperties from "./components/SimilarProperties"; 

// --- MOCK DATA ---
const detailData = {
  id: 1,
  title: "Kosku Executive Residence Setiabudi",
  location: "Jl. Setiabudi Tengah No. 18, Jakarta Selatan",
  priceRates: { daily: 450000, monthly: 4500000, yearly: 50000000 },
  deposit: 2000000,
  images: ["/images/hero/banner.jpg", "/images/hero/banner.jpg", "/images/hero/banner.jpg", "/images/hero/banner.jpg", "/images/hero/banner.jpg"],
  type: "2BR Premium", furnish: "Full Furnished", sqm: 52, 
  facilities: { unit: ["AC", "TV"], building: ["Pool", "Gym"] },
  owner: { name: "Kosku Mgmt", joined: "2023", response: "100%", avatar: "K" },
  rating: 4.8, reviews: 124, description: "Nikmati hunian premium..."
};

export default function DetailClient({ id }: { id: number }) {
  const [isSaved, setIsSaved] = useState(false);

  return (
    <main className="bg-[#0F0F0F] min-h-screen text-white font-sans">
      
      {/* 1. MOBILE NAV */}
      <MobileNav />

      {/* 2. SPACER DESKTOP */}
      <div className="fixed top-0 left-0 w-full h-20 bg-[#0F0F0F] z-30 hidden lg:block"></div>
      
      {/* 3. CONTAINER UTAMA */}
      <div className="flex flex-col pt-0 lg:pt-28 pb-20"> 

        {/* --- A. BREADCRUMB (Desktop Only) --- */}
        <div className="hidden lg:block container mx-auto px-4 mb-6 relative z-10 lg:order-1">
           <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              <Link href="/" className="hover:text-primary transition-colors">Home</Link> 
              <Icon icon="solar:alt-arrow-right-linear" />
              <Link href="/CariApartemen" className="hover:text-primary transition-colors">Jakarta</Link> 
              <Icon icon="solar:alt-arrow-right-linear" />
              <span className="text-white truncate max-w-[200px] md:max-w-md">{detailData.title}</span>
           </div>
        </div>

        {/* --- B. HEADER SECTION (JUDUL & INFO) --- */}
        <div className="container mx-auto px-4 mb-8 relative z-10 order-2 lg:order-2 mt-6 lg:mt-0">
            {/* Judul Besar */}
            <h1 className="text-2xl md:text-4xl font-extrabold text-white mb-4 tracking-tight leading-tight">
                {detailData.title}
            </h1>

            {/* Meta Info */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="bg-[#1A1A1A] border border-white/10 rounded-lg pl-2 pr-4 py-1.5 flex items-center gap-2 transition-colors hover:border-white/30 cursor-pointer">
                        <Icon icon="solar:map-point-bold" className="text-green-500 text-lg" />
                        <span className="text-xs font-bold text-gray-300">{detailData.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5 ml-1">
                        <div className="flex">
                           {[1,2,3,4,5].map(i => (
                               <Icon key={i} icon="solar:star-bold" className={`text-sm ${i <= Math.round(detailData.rating) ? 'text-yellow-500' : 'text-gray-700'}`}/>
                           ))}
                        </div>
                        <span className="text-sm font-bold text-white">{detailData.rating}</span>
                        <span className="text-xs text-gray-500 underline decoration-dotted">({detailData.reviews} ulasan)</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/20 hover:bg-white/10 hover:border-white transition-all text-[11px] font-bold uppercase tracking-wider text-white group">
                        <Icon icon="solar:share-bold" className="text-lg group-hover:text-primary transition-colors"/> 
                        Share
                    </button>
                    <button 
                        onClick={() => setIsSaved(!isSaved)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all text-[11px] font-bold uppercase tracking-wider group ${isSaved ? 'bg-white text-black border-white' : 'border-white/20 hover:bg-white/10 hover:border-white text-white'}`}
                    >
                        <Icon icon={isSaved ? "solar:heart-bold" : "solar:heart-linear"} className={`text-lg ${isSaved ? 'text-red-500' : 'group-hover:text-red-500'}`}/> 
                        {isSaved ? "Tersimpan" : "Simpan"}
                    </button>
                </div>
            </div>
        </div>

        {/* --- C. GALLERY SECTION --- */}
        <div className="container mx-auto lg:px-4 mb-10 relative z-10 order-1 lg:order-3">
           <ImageGallery images={detailData.images} />
        </div>

        {/* --- D. CONTENT SPLIT & SIMILAR PROPERTIES --- */}
        <div className="container mx-auto px-4 relative z-10 order-3 lg:order-4">
           
           {/* Detail & Sidebar */}
           <div className="flex flex-col lg:flex-row gap-12 items-start">
              <DetailInfo data={detailData} />
              <BookingSidebar data={detailData} />
           </div>

           {/* 2. PASANG SECTION PROPERTI SERUPA DISINI */}
           <div className="mt-4">
             <SimilarProperties />
           </div>
           
        </div>

      </div>
    </main>
  );
}
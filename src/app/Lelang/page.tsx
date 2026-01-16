"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";

// Pastikan nama file sudah di-rename jadi huruf besar depannya
import HeroFilter from "./SearchHero"; 
import Sidebar from "./Sidebar";
import ProductList from "./ProductList"; // Import harus sama dengan nama file

export default function CariApartemenPage() {
  return (
    <main className="bg-[#0F0F0F] min-h-screen font-sans selection:bg-primary/30 pb-20">
      
      {/* 1. HERO BANNER BACKGROUND */}
      <div className="relative h-[380px] w-full bg-gray-900 overflow-hidden">
         <Image src="/images/hero/banner.jpg" alt="Apartemen" fill className="object-cover opacity-50" />
         <div className="absolute inset-0 bg-gradient-to-b from-[#0F0F0F]/30 via-[#0F0F0F]/60 to-[#0F0F0F]"></div>
         <div className="absolute inset-0 flex flex-col items-center justify-center -mt-16 text-center px-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
               <span className="text-primary font-bold tracking-[0.2em] text-[10px] uppercase mb-3 block bg-black/40 px-4 py-1.5 rounded-full backdrop-blur-md border border-white/5 inline-block">The Best Living Experience</span>
               <h1 className="text-4xl md:text-6xl font-black text-white leading-tight drop-shadow-2xl">
                  Sewa Apartemen <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-300">Tanpa Ribet</span>
               </h1>
            </motion.div>
         </div>
      </div>

      {/* 2. HERO FILTER */}
      <HeroFilter />

      {/* 3. CONTENT AREA */}
      <div className="container mx-auto px-4 mt-12">
         <div className="flex flex-col lg:flex-row gap-8 items-start">
            
            {/* KIRI: PRODUCT LIST */}
            {/* Perbaikan: Panggil component sesuai nama importnya */}
            <ProductList /> 

            {/* KANAN: SIDEBAR FILTER */}
            <div className="hidden lg:block w-1/4 min-w-[280px]">
               <Sidebar />
            </div>

         </div>
      </div>

    </main>
  );
}
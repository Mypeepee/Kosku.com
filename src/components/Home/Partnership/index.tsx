"use client";

import React from "react";
import Image from "next/image"; 
import { motion } from "framer-motion";
import { Icon } from "@iconify/react"; 

// ============================================================================
// DATA PARTNERS
// ============================================================================
const partners = [
  { name: "Era Ventura", icon: "solar:buildings-bold-duotone" },
  { name: "Brighton Real Estate", icon: "solar:home-bold-duotone" },
  { name: "Bank BCA", icon: "logos:google-icon" },
  { name: "Bank Mandiri", icon: "logos:netflix-icon" },
  { name: "Ray White", icon: "logos:vercel-icon" },
  { name: "Xmarks Property", icon: "logos:stripe" },
];

// Duplikasi agar infinite loop seamless (Infinite Marquee)
const infinitePartners = [...partners, ...partners, ...partners, ...partners];

const Partnership = () => {
  return (
    // REVISI PADDING & BG:
    // pt-4 (Jarak atas diperkecil drastis biar nempel sama section atas)
    // pb-20 (Jarak bawah diperbesar biar lega)
    // bg-[#0F0F0F] (Sesuai request)
    <section className="pt-4 pb-20 bg-[#0F0F0F] overflow-hidden relative border-t border-white/5 z-20">
      
      {/* Container Header */}
      {/* mb-12: Memberi jarak antara judul "Dipercaya oleh" dengan Logo Brand dibawahnya */}
      <div className="container mx-auto px-4 mb-12 text-center">
        <motion.span 
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-block py-1 px-3 rounded-full bg-white/5 border border-white/10 text-[#86efac] text-[10px] font-bold tracking-widest mb-2"
        >
          EKOSISTEM KAMI
        </motion.span>
        
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-xl md:text-2xl font-bold text-white"
        >
          Dipercaya oleh <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#86efac] to-teal-500">Pemimpin Industri</span>
        </motion.h2>
      </div>

      {/* === MARQUEE CONTAINER === */}
      <div className="relative w-full max-w-[100vw]">
        
        {/* Gradient Masking (Kiri & Kanan) */}
        {/* PENTING: Warna gradient diganti ke 'from-[#0F0F0F]' agar menyatu dengan background */}
        <div className="absolute top-0 left-0 z-10 w-24 md:w-40 h-full bg-gradient-to-r from-[#0F0F0F] to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 z-10 w-24 md:w-40 h-full bg-gradient-to-l from-[#0F0F0F] to-transparent pointer-events-none" />

        {/* Moving Track */}
        <div className="flex">
          <motion.div
            // Gap antar logo diperlebar (gap-16 md:gap-32) karena ukuran logo membesar
            className="flex items-center gap-16 md:gap-32 pl-16 md:pl-32"
            animate={{ x: ["0%", "-50%"] }} 
            transition={{
              ease: "linear",
              duration: 35, // Speed disesuaikan agar smooth untuk logo besar
              repeat: Infinity,
            }}
          >
            {infinitePartners.map((partner, index) => (
              <div 
                key={index} 
                className="group relative flex flex-col items-center justify-center shrink-0 cursor-pointer"
              >
                {/* Logo Area - Diperbesar */}
                <div className="
                  relative w-auto h-16 md:h-20 
                  grayscale opacity-50 
                  group-hover:grayscale-0 group-hover:opacity-100 
                  transition-all duration-500 ease-out
                  flex items-center gap-4
                ">
                  {/* Icon Logo: Diperbesar jadi text-5xl (Mobile) / text-6xl (Desktop) */}
                  <Icon icon={partner.icon} className="text-5xl md:text-6xl text-white group-hover:scale-110 transition-transform duration-500 drop-shadow-lg" />
                  
                  {/* Nama Brand: Diperbesar jadi text-xl / text-2xl */}
                  <span className="text-xl md:text-2xl font-bold text-white hidden md:block tracking-tight">
                    {partner.name}
                  </span>
                </div>

                {/* Glow Effect saat Hover */}
                <div className="absolute -inset-6 bg-[#86efac]/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Partnership;
"use client";
import Image from "next/image";
import { motion } from "framer-motion";
import SearchForm from "./buy-form"; 
import OwnerForm from "./sell-form"; 
import CardSlider from "./search";
import { useEffect, useRef, useState, useCallback } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";

const Hero = () => {
  const [isSearching, setIsSearchingOpen] = useState(false);
  const [isOwnerReg, setIsOwnerRegOpen] = useState(false);
  
  const SearchRef = useRef<HTMLDivElement>(null);
  const OwnerRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (SearchRef.current && !SearchRef.current.contains(event.target as Node)) {
        setIsSearchingOpen(false);
      }
      if (OwnerRef.current && !OwnerRef.current.contains(event.target as Node)) {
        setIsOwnerRegOpen(false);
      }
    },
    [SearchRef, OwnerRef]
  );

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [handleClickOutside]);

  useEffect(() => {
    document.body.style.overflow = isSearching || isOwnerReg ? "hidden" : "";
  }, [isSearching, isOwnerReg]);

  return (
    <div className="relative w-full bg-darkmode">
      
      {/* --- BAGIAN 1: BANNER UTAMA (CENTERED) --- */}
      <section className="relative w-full h-[85vh] min-h-[600px] flex items-center justify-center overflow-hidden" id="main-banner">
        
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <Image
            // Menggunakan path gambar yang Anda minta
            src="/images/hero/banner.jpg" 
            alt="Kosku Banner"
            fill
            priority
            className="object-cover"
          />
          {/* Dark Overlay (Supaya teks terbaca jelas) */}
          <div className="absolute inset-0 bg-black/60"></div>
          {/* Gradient Bawah (Supaya transisi ke search bar mulus) */}
          <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-darkmode/90 to-transparent"></div>
        </div>

        {/* Konten Teks (Tengah) */}
        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.div 
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl mx-auto flex flex-col items-center"
          >
            {/* Badge Kecil */}
            <div className="inline-flex items-center gap-2 mb-4 bg-white/10 backdrop-blur-md border border-white/20 px-5 py-1.5 rounded-full shadow-lg hover:bg-white/15 transition-all cursor-default">
               <Icon icon="solar:crown-star-bold" className="text-[#86efac] text-lg" />
               <span className="text-white font-bold text-xs md:text-sm tracking-widest uppercase">
                 Platform Properti No.1 Terlengkap
               </span>
            </div>
            
            {/* Judul Besar */}
            <h1 className="text-white font-extrabold lg:text-7xl md:text-6xl text-4xl leading-tight mb-6 drop-shadow-2xl">
                Satu Akses, <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-green-300 to-primary">
                Ribuan Aset.
              </span>
            </h1>
            
            {/* Deskripsi */}
            <p className="text-gray-200 text-lg md:text-xl mb-10 leading-relaxed max-w-2xl drop-shadow-md">
            Temukan <b className="text-white">Hunian Sewa</b>, beli <b className="text-white">Rumah Baru & Second</b>, hingga investasi <b className="text-white">Aset Lelang</b>. Semua kebutuhan properti Anda ada di sini.
            </p>

            {/* Tombol CTA */}
            {/* <div className="flex flex-wrap justify-center items-center gap-4">
              <button
                className="bg-primary hover:bg-primary/90 text-darkmode font-bold py-4 px-10 rounded-full transition-all transform hover:scale-105 hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] flex items-center gap-2 text-lg"
                onClick={() => setIsSearchingOpen(true)}
              >
                <span>Cari Kos Sekarang</span>
                <Icon icon="solar:magnifer-linear" className="text-xl" />
              </button>
              
              <button
                className="bg-white/10 hover:bg-white/20 text-white border border-white/30 font-bold py-4 px-10 rounded-full backdrop-blur-sm transition-all flex items-center gap-2 text-lg"
                onClick={() => setIsOwnerRegOpen(true)}
              >
                <Icon icon="solar:shop-linear" className="text-xl" />
                <span>Sewakan Properti</span>
              </button>
            </div> */}
          </motion.div>
        </div>
      </section>

      {/* --- BAGIAN 2: FILTER PENCARIAN (FLOATING / OVERLAP) --- */}
      {/* Margin negatif (-mt-32) membuat elemen ini naik ke atas menutupi banner */}
      <div className="container mx-auto px-4 relative z-20 -mt-32 mb-20">
        <CardSlider />
      </div>


      {/* --- MODAL POPUPS --- */}
      {isSearching && (
        <div className="fixed top-0 left-0 w-full h-full bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div ref={SearchRef} className="relative w-full max-w-md overflow-hidden rounded-3xl p-8 z-999 bg-[#1A1A1A] border border-white/10 shadow-2xl">
            <button onClick={() => setIsSearchingOpen(false)} className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 transition text-white"><Icon icon="tabler:x" width={24}/></button>
            <h3 className="text-2xl text-white font-bold mb-6 text-center">Mau cari kos di mana?</h3>
            <SearchForm /> 
          </div>
        </div>
      )}
      {isOwnerReg && (
        <div className="fixed top-0 left-0 w-full h-full bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div ref={OwnerRef} className="relative w-full max-w-md overflow-hidden rounded-3xl p-8 z-999 bg-[#1A1A1A] border border-white/10 shadow-2xl">
            <button onClick={() => setIsOwnerRegOpen(false)} className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 transition text-white"><Icon icon="tabler:x" width={24}/></button>
            <h3 className="text-2xl text-white font-bold mb-6 text-center">Gabung Jadi Juragan Kos</h3>
            <OwnerForm />
          </div>
        </div>
      )}
    </div>
  );
};

export default Hero;
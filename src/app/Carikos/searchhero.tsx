"use client";
import React from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";

const SearchHero = () => {
  return (
    <>
      {/* === BAGIAN 1: BANNER BACKGROUND === */}
      <section className="relative h-[400px] flex items-center justify-center">
        <div className="absolute inset-0 z-0">
          <Image
            src="images/hero/banner2.jpg"
            alt="Search Banner"
            fill
            className="object-cover opacity-60"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-darkmode via-darkmode/50 to-transparent"></div>
        </div>
        <div className="relative z-10 text-center px-4 mb-10">
          <span className="text-primary font-bold tracking-[0.2em] text-[10px] uppercase mb-3 block bg-black/40 px-4 py-1.5 rounded-full backdrop-blur-md border border-white/5 inline-block">The Best Living Experience</span>
          <h1 className="text-white font-bold text-3xl md:text-4xl leading-relaxed drop-shadow-2xl">
            Mudah cari kostnya, Mudah <br />
            bookingnya, Mudah bayarnya.
          </h1>
        </div>
      </section>

      {/* === BAGIAN 2: FILTER FORM === */}
      <div className="container mx-auto px-4 relative z-20 -mt-20">
        <div className="bg-[#1A1A1A] rounded-xl shadow-2xl shadow-black/50 p-6 md:p-8 border border-white/10 backdrop-blur-md">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            
            {/* Input Kota */}
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Kota</label>
              <div className="relative">
                <select className="w-full bg-darkmode border border-white/10 rounded-lg px-4 py-3 text-white font-bold focus:outline-none focus:border-primary appearance-none cursor-pointer hover:border-white/30 transition-colors">
                  <option className="bg-darkmode">Semua Kota</option>
                  <option className="bg-darkmode">Jakarta</option>
                  <option className="bg-darkmode">Surabaya</option>
                  <option className="bg-darkmode">Yogyakarta</option>
                  <option className="bg-darkmode">Bandung</option>
                </select>
                <Icon icon="solar:alt-arrow-down-linear" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Input Tipe */}
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Tipe Kos</label>
              <div className="relative">
                <select className="w-full bg-darkmode border border-white/10 rounded-lg px-4 py-3 text-white font-bold focus:outline-none focus:border-primary appearance-none cursor-pointer hover:border-white/30 transition-colors">
                  <option className="bg-darkmode">Semua</option>
                  <option className="bg-darkmode">Putra</option>
                  <option className="bg-darkmode">Putri</option>
                  <option className="bg-darkmode">Campur</option>
                </select>
                <Icon icon="solar:alt-arrow-down-linear" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Input Durasi */}
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Durasi</label>
              <div className="relative">
                <select className="w-full bg-darkmode border border-white/10 rounded-lg px-4 py-3 text-white font-bold focus:outline-none focus:border-primary appearance-none cursor-pointer hover:border-white/30 transition-colors">
                  <option className="bg-darkmode">Bulanan</option>
                  <option className="bg-darkmode">Harian</option>
                  <option className="bg-darkmode">Tahunan</option>
                </select>
                <Icon icon="solar:alt-arrow-down-linear" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Input Harga */}
            <div className="md:col-span-4">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Rentang Harga</label>
              <div className="flex items-center gap-2">
                <div className="relative w-full">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold">Rp</span>
                  <input type="number" placeholder="0" className="w-full bg-darkmode border border-white/10 rounded-lg pl-8 pr-3 py-3 text-white font-bold focus:outline-none focus:border-primary placeholder:text-gray-600 transition-colors" />
                </div>
                <span className="text-gray-500">-</span>
                <div className="relative w-full">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold">Rp</span>
                  <input type="number" placeholder="Max" className="w-full bg-darkmode border border-white/10 rounded-lg pl-8 pr-3 py-3 text-white font-bold focus:outline-none focus:border-primary placeholder:text-gray-600 transition-colors" />
                </div>
              </div>
            </div>

            {/* Tombol Cari */}
            <div className="md:col-span-2">
              <button className="w-full bg-primary hover:bg-primary/90 text-darkmode font-bold py-3 rounded-lg transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] flex items-center justify-center gap-2">
                <Icon icon="solar:magnifer-linear" className="text-xl" />
                Cari Kos
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default SearchHero;
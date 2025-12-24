"use client";
import { Icon } from "@iconify/react";
import { useState } from "react";

const Sidebar = () => {
  const [priceRange, setPriceRange] = useState("all");

  return (
    <div className="bg-[#1A1A1A] rounded-2xl border border-white/10 p-6 sticky top-24 h-fit">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-white font-bold text-lg">Filter Lanjutan</h3>
        <button className="text-primary text-xs font-bold hover:underline">Reset</button>
      </div>

      {/* 1. Urutkan Harga */}
      <div className="mb-8">
        <h4 className="text-gray-400 text-sm font-bold mb-3 uppercase tracking-wider">Urutkan Harga</h4>
        <div className="flex gap-2">
          <button className="flex-1 py-2 px-3 rounded-lg border border-white/10 text-white text-xs font-bold hover:bg-primary hover:text-darkmode hover:border-primary transition-all">
            Terendah
          </button>
          <button className="flex-1 py-2 px-3 rounded-lg border border-white/10 text-white text-xs font-bold hover:bg-primary hover:text-darkmode hover:border-primary transition-all">
            Tertinggi
          </button>
        </div>
      </div>

      <hr className="border-white/10 mb-8" />

      {/* 2. Kisaran Harga (Radio) */}
      <div className="mb-8">
        <h4 className="text-gray-400 text-sm font-bold mb-3 uppercase tracking-wider">Budget Populer</h4>
        <div className="space-y-3">
          {["< 1 Juta", "1 - 2 Juta", "2 - 4 Juta", "> 4 Juta"].map((range, idx) => (
            <label key={idx} className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input 
                  type="radio" 
                  name="price_range" 
                  className="peer sr-only" 
                />
                <div className="w-5 h-5 rounded-full border-2 border-gray-600 peer-checked:border-primary peer-checked:bg-primary transition-all"></div>
              </div>
              <span className="text-gray-300 text-sm font-medium group-hover:text-white transition-colors">{range}</span>
            </label>
          ))}
        </div>
      </div>

      <hr className="border-white/10 mb-8" />

      {/* 3. Fasilitas (Checkbox) */}
      <div className="mb-8">
        <h4 className="text-gray-400 text-sm font-bold mb-3 uppercase tracking-wider">Fasilitas Wajib</h4>
        <div className="space-y-3">
          {["AC", "WiFi Kencang", "Kamar Mandi Dalam", "Parkir Mobil", "Kasur King Size"].map((item, idx) => (
            <label key={idx} className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input type="checkbox" className="peer sr-only" />
                <div className="w-5 h-5 rounded border-2 border-gray-600 peer-checked:bg-primary peer-checked:border-primary flex items-center justify-center transition-all">
                  <Icon icon="solar:check-read-linear" className="text-darkmode opacity-0 peer-checked:opacity-100 text-xs" />
                </div>
              </div>
              <span className="text-gray-300 text-sm font-medium group-hover:text-white transition-colors">{item}</span>
            </label>
          ))}
        </div>
      </div>

      <hr className="border-white/10 mb-8" />

      {/* 4. Tipe Penyedia */}
      <div>
        <h4 className="text-gray-400 text-sm font-bold mb-3 uppercase tracking-wider">Dikelola Oleh</h4>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer group">
             <input type="radio" name="provider" defaultChecked className="hidden peer" />
             <span className="w-4 h-4 rounded-full border border-gray-500 peer-checked:border-primary peer-checked:bg-primary"></span>
             <span className="text-gray-300 text-sm group-hover:text-white">Semua</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group">
             <input type="radio" name="provider" className="hidden peer" />
             <span className="w-4 h-4 rounded-full border border-gray-500 peer-checked:border-primary peer-checked:bg-primary"></span>
             <span className="text-gray-300 text-sm group-hover:text-white">Dikelola Kosku (Official)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group">
             <input type="radio" name="provider" className="hidden peer" />
             <span className="w-4 h-4 rounded-full border border-gray-500 peer-checked:border-primary peer-checked:bg-primary"></span>
             <span className="text-gray-300 text-sm group-hover:text-white">Pemilik Langsung</span>
          </label>
        </div>
      </div>

    </div>
  );
};

export default Sidebar;
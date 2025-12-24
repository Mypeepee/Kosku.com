"use client";

import React, { useState } from "react";
import { Icon } from "@iconify/react";

const Sidebar = () => {
  // State Management
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selectedSort, setSelectedSort] = useState("relevansi");
  
  // Format Currency Input
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'min' | 'max') => {
    const value = e.target.value.replace(/\D/g, ""); // Hanya angka
    if (type === 'min') setMinPrice(value);
    else setMaxPrice(value);
  };

  // Helper untuk format tampilan Rp
  const formatDisplay = (val: string) => {
    if (!val) return "";
    return new Intl.NumberFormat("id-ID").format(Number(val));
  };

  return (
    // LOGIKA STICKY:
    // 'sticky' membuat elemen menempel. 
    // 'top-28' memberi jarak dari header agar tidak tertutup.
    // 'max-h-[calc(100vh-120px)]' membatasi tinggi sidebar agar tidak melebihi layar, 
    // sehingga scrollbar internal (overflow-y-auto) bisa aktif.
    <aside className="w-full sticky top-28 self-start h-fit max-h-[calc(100vh-140px)] overflow-y-auto custom-scrollbar pr-1">
       
       <div className="bg-[#1A1A1A] border border-white/5 rounded-3xl p-6 shadow-xl">
          
          {/* HEADER FILTER */}
          <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/5">
             <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <Icon icon="solar:tuning-2-bold" className="text-primary"/> Filter
             </h3>
             <button 
                onClick={() => { setMinPrice(""); setMaxPrice(""); setSelectedSort("relevansi"); }}
                className="text-xs text-gray-500 hover:text-white font-bold transition-colors flex items-center gap-1"
             >
                <Icon icon="solar:refresh-linear" /> Reset
             </button>
          </div>

          {/* 1. URUTKAN (SORTING) */}
          <div className="mb-8">
             <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block flex items-center gap-2">
                <Icon icon="solar:sort-vertical-bold" /> Urutkan
             </label>
             <div className="space-y-1">
                {[
                   { id: "relevansi", label: "Paling Sesuai" },
                   { id: "termurah", label: "Harga Terendah" },
                   { id: "rating", label: "Rating Terbaik" }
                ].map((opt) => (
                   <label 
                      key={opt.id}
                      className={`flex items-center justify-between cursor-pointer group p-3 rounded-xl transition-all border ${selectedSort === opt.id ? 'bg-primary/10 border-primary/30' : 'border-transparent hover:bg-white/5'}`}
                   >
                      <div className="flex items-center gap-3">
                         <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedSort === opt.id ? 'border-primary' : 'border-gray-600'}`}>
                            {selectedSort === opt.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                         </div>
                         <span className={`text-sm ${selectedSort === opt.id ? 'text-white font-bold' : 'text-gray-400 group-hover:text-white'}`}>
                            {opt.label}
                         </span>
                      </div>
                      <input 
                         type="radio" 
                         name="sort" 
                         className="hidden" 
                         checked={selectedSort === opt.id} 
                         onChange={() => setSelectedSort(opt.id)} 
                      />
                   </label>
                ))}
             </div>
          </div>

          {/* 2. BUDGET RANGE (INPUT FIELD - NO SLIDER) */}
          <div className="mb-8">
             <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 block flex justify-between items-center">
                <span>Range Harga (Bulanan)</span>
                <Icon icon="solar:wallet-bold" />
             </label>
             
             {/* Dual Input */}
             <div className="flex items-center gap-2 mb-3">
                <div className="relative w-full group">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold group-focus-within:text-primary transition-colors">Rp</span>
                   <input 
                      type="text" 
                      value={formatDisplay(minPrice)}
                      onChange={(e) => handlePriceChange(e, 'min')}
                      placeholder="Min" 
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-8 pr-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-all placeholder:text-gray-600 font-bold"
                   />
                </div>
                <span className="text-gray-500">-</span>
                <div className="relative w-full group">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold group-focus-within:text-primary transition-colors">Rp</span>
                   <input 
                      type="text" 
                      value={formatDisplay(maxPrice)}
                      onChange={(e) => handlePriceChange(e, 'max')}
                      placeholder="Max" 
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-8 pr-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-all placeholder:text-gray-600 font-bold"
                   />
                </div>
             </div>

             {/* Quick Select Chips */}
             <div className="flex flex-wrap gap-2">
                {[
                   { label: "< 3 Juta", min: "", max: "3000000" },
                   { label: "3 - 5 Juta", min: "3000000", max: "5000000" },
                   { label: "> 10 Juta", min: "10000000", max: "" },
                ].map((chip, idx) => (
                   <button 
                      key={idx}
                      onClick={() => { setMinPrice(chip.min); setMaxPrice(chip.max); }}
                      className="text-[10px] px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all"
                   >
                      {chip.label}
                   </button>
                ))}
             </div>
          </div>

          {/* 3. KONDISI UNIT (CHIPS) */}
          <div className="mb-8">
             <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block flex items-center gap-2">
                <Icon icon="solar:armchair-bold" /> Furnishing
             </label>
             <div className="grid grid-cols-2 gap-2">
                {["Full Furnished", "Semi Furnished", "Unfurnished"].map((tag, i) => (
                   <button key={i} className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-[11px] font-medium text-gray-400 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all text-center">
                      {tag}
                   </button>
                ))}
             </div>
          </div>

          {/* 4. PENYEDIA (CHECKBOX LIST) */}
          <div className="mb-8">
             <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">Penyedia</label>
             <div className="space-y-3 bg-black/20 p-3 rounded-2xl border border-white/5">
                <label className="flex items-center gap-3 cursor-pointer group">
                   <div className="relative flex items-center justify-center w-5 h-5 rounded-md border border-white/20 bg-white/5 group-hover:border-primary transition-all">
                      <input type="checkbox" className="peer appearance-none w-full h-full cursor-pointer checked:bg-primary rounded-md transition-all" defaultChecked />
                      <Icon icon="solar:check-read-bold" className="text-darkmode text-xs absolute opacity-0 peer-checked:opacity-100 pointer-events-none scale-0 peer-checked:scale-100 transition-transform"/>
                   </div>
                   <div className="flex flex-col">
                      <span className="text-sm text-white group-hover:text-primary transition-colors font-bold">Dikelola Kosku</span>
                      <span className="text-[10px] text-gray-500">Terverifikasi & Layanan Standar</span>
                   </div>
                </label>
                
                <div className="h-px bg-white/5 w-full"></div>

                <label className="flex items-center gap-3 cursor-pointer group">
                   <div className="relative flex items-center justify-center w-5 h-5 rounded-md border border-white/20 bg-white/5 group-hover:border-primary transition-all">
                      <input type="checkbox" className="peer appearance-none w-full h-full cursor-pointer checked:bg-primary rounded-md transition-all" />
                      <Icon icon="solar:check-read-bold" className="text-darkmode text-xs absolute opacity-0 peer-checked:opacity-100 pointer-events-none scale-0 peer-checked:scale-100 transition-transform"/>
                   </div>
                   <div className="flex flex-col">
                      <span className="text-sm text-gray-400 group-hover:text-white transition-colors">Pemilik Langsung</span>
                      <span className="text-[10px] text-gray-600">Negosiasi langsung ke owner</span>
                   </div>
                </label>
             </div>
          </div>

          {/* ACTION BUTTON */}
          <button className="w-full py-4 rounded-2xl bg-primary text-darkmode font-extrabold hover:bg-green-400 transition-all text-sm shadow-[0_4px_20px_rgba(34,197,94,0.3)] transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2">
             <Icon icon="solar:filter-bold" /> Terapkan Filter
          </button>

       </div>
    </aside>
  );
};

export default Sidebar;
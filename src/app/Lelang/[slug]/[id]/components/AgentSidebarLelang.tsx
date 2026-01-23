"use client";

import React from "react";
import { Icon } from "@iconify/react";
import Image from "next/image";

interface AgentSidebarProps {
  data: any;
}

export default function AgentSidebar({ data }: AgentSidebarProps) {
  
  // 1. DATA MAPPING
  const agentData = {
    name: data.owner.name,
    avatar: data.owner.avatar,
    phone: data.owner.phone || "628123456789",
    office: data.owner.office,
    rating: data.owner.rating,
    area: data.owner.area,
  };

  // 2. SMART PRICE FORMATTING
  const formatMobilePrice = (price: number): string => {
    if (price >= 1000000000) {
      // Miliar - 1 decimal untuk akurasi
      const milyar = price / 1000000000;
      return `Rp ${milyar.toFixed(1)} M`;
    } else if (price >= 1000000) {
      // Juta - no decimal jika >= 100 juta
      const juta = price / 1000000;
      return `Rp ${Math.round(juta)} Jt`;
    }
    return new Intl.NumberFormat("id-ID", { 
      style: "currency", 
      currency: "IDR", 
      maximumFractionDigits: 0 
    }).format(price);
  };

  // 3. WHATSAPP LOGIC
  const handleContact = (type: "wa" | "call" | "schedule") => {
    const phone = agentData.phone.replace(/^0/, "62").replace(/\D/g, ""); 
    
    if (type === "wa") {
        const text = encodeURIComponent(`Halo ${agentData.name}, saya tertarik dengan properti: *${data.title}*. Apakah masih tersedia?`);
        window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
    } else if (type === "call") {
        window.open(`tel:${phone}`);
    } else if (type === "schedule") {
        const text = encodeURIComponent(`Halo ${agentData.name}, saya ingin menjadwalkan *Survei Lokasi* untuk properti: *${data.title}*.`);
        window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
    }
  };

  // Logic Avatar Check
  const avatarSrc = agentData.avatar;
  const isValidImage = avatarSrc && (avatarSrc.startsWith("/") || avatarSrc.startsWith("http"));

  return (
    <>
      {/* ========================================
          DESKTOP VERSION - Sidebar (lg and up)
      ========================================= */}
      <div className="hidden lg:flex flex-col w-[380px] sticky top-28 h-fit bg-[#1A1A1A] border border-white/10 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden">
        
        {/* --- HEADER HARGA --- */}
        <div className="p-6 pb-2 shrink-0 z-10 bg-[#1A1A1A]">
            <div className="flex justify-between items-start">
              <div className="flex-1 pr-4">
                  <span className="text-xs font-bold text-[#86efac] uppercase tracking-wider mb-1 block truncate">Harga Limit</span>
                  <div className="flex items-end gap-1">
                      <span className="text-2xl font-extrabold text-white">
                          {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(data.priceRates.monthly)}
                      </span>
                      {data.type === "Sewa" && <span className="text-xs text-gray-400 font-medium mb-1">/ bulan</span>}
                  </div>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shrink-0 h-fit">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"/>
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">Available</span>
              </div>
            </div>
        </div>

        {/* --- CONTENT --- */}
        <div className="flex-1 overflow-y-auto px-6 py-2 custom-scrollbar space-y-4">
           
           {/* KOTAK 1: PROFIL AGENT */}
           <div className="bg-[#0F0F0F] border border-white/10 rounded-xl p-4 flex items-center gap-4">
               <div className="relative w-16 h-16 shrink-0">
                  <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#86efac] p-0.5">
                      <div className="w-full h-full rounded-full overflow-hidden relative bg-gray-700 flex items-center justify-center">
                          {isValidImage ? (
                              <Image src={avatarSrc} alt={agentData.name} fill className="object-cover" />
                          ) : (
                              <span className="text-xl font-extrabold text-white">
                                  {agentData.name ? agentData.name.charAt(0).toUpperCase() : "A"}
                              </span>
                          )}
                      </div>
                  </div>
                  <div className="absolute bottom-0 right-0 bg-[#1A1A1A] rounded-full p-0.5">
                      <Icon icon="solar:verified-check-bold" className="text-blue-500 text-lg"/>
                  </div>
               </div>
               
               <div className="flex-1 min-w-0">
                   <h4 className="text-white font-bold text-base truncate">{agentData.name}</h4>
                   <div className="flex items-center gap-1 mt-1 text-gray-400">
                      <Icon icon="solar:buildings-2-bold" className="text-xs"/>
                      <p className="text-xs truncate">{agentData.office}</p>
                   </div>
                   <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full border border-green-500/20 font-bold">Official Agent</span>
                   </div>
               </div>
           </div>

           {/* KOTAK 2: STATISTIK */}
           <div className="flex justify-between items-start bg-[#0F0F0F] border border-white/10 rounded-xl p-3 px-2">
              
              <div className="flex flex-col items-center justify-center gap-1 flex-1 border-r border-white/10 px-1">
                  <div className="flex items-center gap-1">
                      <Icon icon="solar:star-bold" className="text-yellow-400 text-sm shrink-0"/>
                      <span className="text-sm font-bold text-white">{Number(agentData.rating).toFixed(1)}</span>
                  </div>
                  <span className="text-[9px] text-gray-500 font-medium">Rating</span>
              </div>

              <div className="flex flex-col items-center justify-center gap-1 flex-1 border-r border-white/10 px-1">
                  <div className="flex items-center gap-1">
                      <Icon icon="solar:chat-round-line-linear" className="text-[#86efac] text-sm shrink-0"/>
                      <span className="text-sm font-bold text-white">Fast</span>
                  </div>
                  <span className="text-[9px] text-gray-500 font-medium">Respon</span>
              </div>

              <div className="flex flex-col items-center justify-center gap-1 flex-[1.2] px-1">
                  <div className="flex items-center justify-center gap-1 w-full text-center">
                      <Icon icon="solar:map-point-bold" className="text-red-400 text-sm shrink-0"/>
                      <span className="text-sm font-bold text-white leading-tight break-words">
                          {agentData.area || "Indonesia"}
                      </span>
                  </div>
                  <span className="text-[9px] text-gray-500 font-medium">Area</span>
              </div>

           </div>

           {/* KOTAK 3: INFO SAFETY */}
           <div className="relative w-full rounded-xl p-3 flex items-start gap-3 border border-dashed border-gray-600 bg-[#252525]">
               <div className="bg-white/10 p-1.5 rounded-lg text-white">
                  <Icon icon="solar:shield-check-bold" className="text-lg"/>
               </div>
               <div>
                  <p className="text-xs font-bold text-white mb-0.5">Transaksi Aman</p>
                  <p className="text-[10px] text-gray-400 leading-tight">
                      Hati-hati penipuan. Jangan transfer uang ke rekening pribadi agent.
                  </p>
               </div>
           </div>

        </div>

        {/* --- FOOTER --- */}
        <div className="p-6 pt-4 border-t border-white/10 bg-[#1A1A1A] z-20 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
           <div className="space-y-3">
                <button 
                  onClick={() => handleContact("wa")}
                  className="w-full bg-[#25D366] hover:bg-[#1ebc57] text-black font-extrabold text-sm py-3.5 rounded-xl shadow-[0_0_20px_rgba(37,211,102,0.15)] hover:shadow-[0_0_25px_rgba(37,211,102,0.3)] transition-all active:scale-[0.98] flex justify-center items-center gap-2"
                >
                  <Icon icon="ic:baseline-whatsapp" className="text-xl"/>
                  Chat WhatsApp
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                      onClick={() => handleContact("call")}
                      className="w-full bg-transparent border border-white/20 hover:bg-white/10 text-white font-bold text-sm py-3 rounded-xl transition-all flex justify-center items-center gap-2"
                  >
                      <Icon icon="solar:phone-calling-bold" className="text-lg"/>
                      Telepon
                  </button>
                  <button 
                      onClick={() => handleContact("schedule")}
                      className="w-full bg-transparent border border-white/20 hover:bg-white/10 text-white font-bold text-sm py-3 rounded-xl transition-all flex justify-center items-center gap-2"
                  >
                      <Icon icon="solar:calendar-date-bold" className="text-lg"/>
                      Survei
                  </button>
                </div>
           </div>
        </div>

      </div>

      {/* ========================================
          MOBILE/TABLET VERSION - Bottom Sticky Bar
      ========================================= */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#1A1A1A] border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.7)]">
        
        {/* Compact Agent Info + Price Row */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
          {/* Agent Avatar + Name */}
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 shrink-0">
              <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#86efac] p-0.5">
                <div className="w-full h-full rounded-full overflow-hidden relative bg-gray-700 flex items-center justify-center">
                  {isValidImage ? (
                    <Image src={avatarSrc} alt={agentData.name} fill className="object-cover" />
                  ) : (
                    <span className="text-base font-extrabold text-white">
                      {agentData.name ? agentData.name.charAt(0).toUpperCase() : "A"}
                    </span>
                  )}
                </div>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 bg-[#1A1A1A] rounded-full p-0.5">
                <Icon icon="solar:verified-check-bold" className="text-blue-500 text-sm"/>
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="text-white font-bold text-sm truncate">{agentData.name}</h4>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex items-center gap-0.5">
                  <Icon icon="solar:star-bold" className="text-yellow-400 text-xs"/>
                  <span className="text-xs font-bold text-white">{Number(agentData.rating).toFixed(1)}</span>
                </div>
                <span className="text-gray-500">•</span>
                <span className="text-xs text-gray-400 truncate">{agentData.area}</span>
              </div>
            </div>
          </div>

          {/* Price Badge - SMART FORMATTING */}
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-[#86efac] uppercase">Harga</span>
            <span className="text-base font-black text-white whitespace-nowrap">
              {formatMobilePrice(data.priceRates.monthly)}
            </span>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="px-4 py-3 flex gap-2">
          <button 
            onClick={() => handleContact("wa")}
            className="flex-1 bg-[#25D366] hover:bg-[#1ebc57] text-black font-bold text-sm py-3 rounded-xl shadow-lg transition-all active:scale-[0.98] flex justify-center items-center gap-2"
          >
            <Icon icon="ic:baseline-whatsapp" className="text-xl"/>
            WhatsApp
          </button>

          <button 
            onClick={() => handleContact("call")}
            className="bg-transparent border border-white/20 hover:bg-white/10 text-white font-bold text-sm py-3 px-4 rounded-xl transition-all flex justify-center items-center"
          >
            <Icon icon="solar:phone-calling-bold" className="text-xl"/>
          </button>

          <button 
            onClick={() => handleContact("schedule")}
            className="bg-transparent border border-white/20 hover:bg-white/10 text-white font-bold text-sm py-3 px-4 rounded-xl transition-all flex justify-center items-center"
          >
            <Icon icon="solar:calendar-date-bold" className="text-xl"/>
          </button>
        </div>

      </div>
    </>
  );
}

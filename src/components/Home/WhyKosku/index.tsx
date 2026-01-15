"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";

const WhyKosku = () => {
  return (
    // PADDING: py-16 (Standar Compact & Rapi)
    // BG: #0F0F0F (Menyatu dengan section Recommendation sebelumnya)
    <section className="py-16 bg-[#0F0F0F] relative overflow-hidden">
      
      <div className="container mx-auto px-4 max-w-screen-xl relative z-10">
        
        {/* HEADER SECTION */}
        <div className="text-center mb-12 max-w-3xl mx-auto">
          <motion.span 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block py-1 px-3 rounded-full bg-white/5 border border-white/10 text-[#86efac] text-[10px] font-bold tracking-widest mb-3 uppercase"
          >
            Kenapa Memilih Premier?
          </motion.span>
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-4xl font-extrabold text-white mb-4"
          >
            Lebih Dari Sekadar <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#86efac] to-teal-500">Marketplace.</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-white/50 text-sm md:text-base leading-relaxed"
          >
            Kami mengintegrasikan pasar Properti Baru (Primary), Bekas (Secondary), Sewa, dan Lelang dalam satu ekosistem cerdas yang aman dan transparan.
          </motion.p>
        </div>

        {/* BENTO GRID LAYOUT */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* CARD 1: DATABASE 360 (Large - Span 2 Col) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="md:col-span-2 bg-[#151515] border border-white/10 rounded-3xl p-8 relative overflow-hidden group hover:border-[#86efac]/30 transition-all duration-500"
          >
             {/* Background Effect */}
             <div className="absolute top-0 right-0 w-64 h-64 bg-[#86efac]/5 rounded-full blur-[80px] -mr-16 -mt-16 transition-all group-hover:bg-[#86efac]/10" />
             
             <div className="relative z-10 flex flex-col md:flex-row items-start gap-6">
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10 group-hover:scale-110 transition-transform duration-500">
                   <Icon icon="solar:layers-minimalistic-bold-duotone" className="text-3xl text-[#86efac]" />
                </div>
                <div>
                   <h3 className="text-xl font-bold text-white mb-2">Ekosistem Aset 360°</h3>
                   <p className="text-white/50 text-sm leading-relaxed mb-4">
                      Tidak perlu berpindah platform. Temukan <strong>Rumah Developer</strong>, <strong>Rumah Second</strong>, hingga <strong>Aset Lelang Bank</strong> dengan harga miring di satu tempat.
                   </p>
                   {/* Mini Chips */}
                   <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-gray-300">Primary</span>
                      <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-gray-300">Secondary</span>
                      <span className="px-3 py-1 rounded-full bg-[#86efac]/10 border border-[#86efac]/20 text-[10px] text-[#86efac] font-bold">Lelang & Sewa</span>
                   </div>
                </div>
             </div>
          </motion.div>

          {/* CARD 2: ANTI FAKE (Square) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="bg-[#151515] border border-white/10 rounded-3xl p-8 relative overflow-hidden group hover:border-blue-400/30 transition-all duration-500"
          >
             <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 rounded-full blur-[60px] -mr-10 -mt-10 group-hover:bg-blue-500/10 transition-all" />
             
             <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6 border border-white/10">
                <Icon icon="solar:shield-check-bold-duotone" className="text-2xl text-blue-400" />
             </div>
             <h3 className="text-lg font-bold text-white mb-2">Anti-Fake Listing</h3>
             <p className="text-white/50 text-sm leading-relaxed">
                Setiap properti melewati proses kurasi ketat. Tidak ada harga pancingan atau data palsu.
             </p>
          </motion.div>

          {/* CARD 3: AGENT NETWORK (Square) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="bg-[#151515] border border-white/10 rounded-3xl p-8 relative overflow-hidden group hover:border-orange-400/30 transition-all duration-500"
          >
             <div className="absolute bottom-0 left-0 w-40 h-40 bg-orange-500/5 rounded-full blur-[60px] -ml-10 -mb-10 group-hover:bg-orange-500/10 transition-all" />
             
             <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6 border border-white/10">
                <Icon icon="solar:users-group-rounded-bold-duotone" className="text-2xl text-orange-400" />
             </div>
             <h3 className="text-lg font-bold text-white mb-2">Jaringan Agen Luas</h3>
             <p className="text-white/50 text-sm leading-relaxed">
                Didukung ratusan agen profesional di berbagai kota yang siap mendampingi survei hingga akad.
             </p>
          </motion.div>

          {/* CARD 4: RAJA LELANG (Large - Span 2 Col) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="md:col-span-2 bg-[#151515] border border-white/10 rounded-3xl p-8 relative overflow-hidden group hover:border-purple-400/30 transition-all duration-500"
          >
             <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-[80px] -mr-16 -mb-16 transition-all group-hover:bg-purple-500/10" />
             
             <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1">
                   <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                         <Icon icon="solar:gavel-bold-duotone" className="text-xl text-purple-400" />
                      </div>
                      <h3 className="text-xl font-bold text-white">Spesialis Aset Lelang</h3>
                   </div>
                   <p className="text-white/50 text-sm leading-relaxed mb-6">
                      Investasi properti murah (bawah harga pasar) kini aman. Kami urus pengecekan legalitas, proses bidding, hingga pengosongan unit.
                   </p>
                   <button className="flex items-center gap-2 text-sm font-bold text-white group-hover:text-[#86efac] transition-colors">
                      Pelajari Cara Lelang <Icon icon="solar:arrow-right-linear" />
                   </button>
                </div>
                
                {/* Visual Illustration (Simple Graph) */}
                <div className="hidden md:block w-1/3 bg-black/40 rounded-xl p-4 border border-white/5">
                    <div className="flex justify-between mb-2">
                        <span className="text-[10px] text-gray-400">Harga Pasar</span>
                        <span className="text-[10px] text-red-400 line-through">Rp 2.5 M</span>
                    </div>
                    <div className="w-full bg-white/10 h-1.5 rounded-full mb-4">
                        <div className="w-full h-full bg-red-400/50 rounded-full"></div>
                    </div>
                    
                    <div className="flex justify-between mb-2">
                        <span className="text-[10px] text-gray-400">Harga Lelang</span>
                        <span className="text-[10px] text-[#86efac] font-bold">Rp 1.4 M</span>
                    </div>
                    <div className="w-full bg-white/10 h-1.5 rounded-full">
                        <div className="w-[60%] h-full bg-[#86efac] rounded-full relative">
                             <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-[0_0_10px_#86efac]"></div>
                        </div>
                    </div>
                </div>
             </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};

export default WhyKosku;
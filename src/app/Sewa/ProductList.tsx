"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Apartment } from "./types";
import { apartmentsData } from "./data";
import { formatRupiah, getFacilityIcon, getTypeColor } from "./utils";

const ApartmentCard = ({ item }: { item: Apartment }) => {
  return (
   <Link href={`/apartemen/${item.id}`} className="block group h-full">
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="bg-[#1A1A1A] rounded-3xl border border-white/5 overflow-hidden hover:border-primary/50 hover:shadow-[0_10px_40px_-10px_rgba(34,197,94,0.15)] transition-all duration-500 relative h-full flex flex-col"
      >
        <div className="relative h-56 w-full overflow-hidden">
          <Image src={item.image} alt={item.name} fill className="object-cover transition-transform duration-700 group-hover:scale-110" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#151515] via-transparent to-transparent opacity-90" />
          
          <div className="absolute top-4 left-4 flex gap-2">
            {item.isVerified && (
              <div className="bg-black/60 backdrop-blur-md border border-white/10 text-primary px-2.5 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 shadow-sm">
                <Icon icon="solar:verified-check-bold" /> Verified
              </div>
            )}
            {item.isPromo && (
              <div className="bg-red-500/90 backdrop-blur-md text-white px-2.5 py-1 rounded-full text-[10px] font-bold uppercase animate-pulse shadow-sm">
                Promo
              </div>
            )}
          </div>

          <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md p-2 rounded-full text-white hover:bg-red-500/20 hover:text-red-500 transition-all cursor-pointer z-10">
            <Icon icon="solar:heart-linear" className="text-lg" />
          </div>

          <div className={`absolute bottom-3 left-4 px-3 py-1 rounded-lg text-xs font-bold text-white uppercase tracking-wider backdrop-blur-md border ${getTypeColor(item.type)}`}>
             {item.type}
          </div>
        </div>

        <div className="p-5 flex flex-col flex-grow">
          
          <div className="flex justify-between items-start mb-2">
             <div className="flex-1 pr-2">
                <h3 className="text-white font-bold text-lg leading-snug mb-1 group-hover:text-primary transition-colors line-clamp-1">{item.name}</h3>
                <p className="text-gray-400 text-xs flex items-center gap-1 line-clamp-1"><Icon icon="solar:map-point-bold" className="text-gray-500"/> {item.location}</p>
             </div>
             <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg border border-white/5 shrink-0"><Icon icon="solar:star-bold" className="text-yellow-500 text-xs" /><span className="text-white text-xs font-bold">{item.rating}</span></div>
          </div>

          <div className="flex items-center gap-2 mb-4 text-[10px]">
             <span className="bg-white/5 text-gray-300 px-2 py-0.5 rounded border border-white/5">{item.furnish}</span>
             <span className="text-gray-500">•</span>
             <span className="text-primary font-medium">{item.provider}</span>
          </div>

          <div className="flex items-center gap-3 mb-4 border-t border-dashed border-white/10 pt-3">
             {item.facilities.slice(0, 3).map((fac, i) => (
               <div key={i} className="flex items-center gap-1.5 text-[10px] text-gray-400 bg-white/5 px-2 py-1 rounded"><Icon icon={getFacilityIcon(fac)} /> <span className="capitalize">{fac}</span></div>
             ))}
             {item.facilities.length > 3 && <span className="text-[10px] text-gray-500">+{item.facilities.length - 3}</span>}
          </div>

          <div className="mt-auto pt-3 border-t border-white/10 flex items-center justify-between">
             <div>
                <p className="text-[10px] text-gray-500 mb-0.5">Mulai dari</p>
                <div className="flex items-baseline gap-1">
                   <span className="text-primary font-extrabold text-xl">{formatRupiah(item.price)}</span>
                   <span className="text-gray-400 text-xs font-medium">/ {item.period}</span>
                </div>
             </div>
             <button className="bg-white text-darkmode rounded-full p-2.5 hover:bg-primary transition-colors transform group-hover:rotate-45 shadow-lg">
                <Icon icon="solar:arrow-right-up-linear" className="text-lg"/>
             </button>
          </div>

        </div>
      </motion.div>
    </Link>
  );
};

export default function ProductList() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => setIsLoading(false), 1000);
  }, []);

  return (
    <div className="w-full lg:w-3/4">
       <div className="flex justify-between items-center mb-6">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            Menampilkan <span className="bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">{apartmentsData.length}</span> Unit
          </h2>
       </div>

       {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
             {[1,2,3,4,5,6].map(i => (
                <div key={i} className="h-[400px] bg-[#1A1A1A] rounded-2xl animate-pulse border border-white/5">
                   <div className="h-56 bg-white/5 rounded-t-2xl"></div>
                   <div className="p-5 space-y-3">
                      <div className="h-6 bg-white/10 rounded w-3/4"></div>
                      <div className="h-4 bg-white/5 rounded w-1/2"></div>
                      <div className="h-10 bg-white/5 rounded-xl mt-4"></div>
                   </div>
                </div>
             ))}
          </div>
       ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
             <AnimatePresence>
                {apartmentsData.map((item) => (
                   <ApartmentCard key={item.id} item={item} />
                ))}
             </AnimatePresence>
          </div>
       )}

       <div className="mt-16 text-center">
          <button className="px-8 py-3 rounded-full border border-white/20 text-white font-bold hover:bg-white hover:text-darkmode transition-all duration-300 transform hover:-translate-y-1">
             Muat Lebih Banyak
          </button>
       </div>
    </div>
  );
}
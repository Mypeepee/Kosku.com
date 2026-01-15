"use client";

import React from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";

// Definisi Tipe Data sesuai Enum Database
type KategoriEnum = 
  | 'RUMAH' 
  | 'APARTEMEN' 
  | 'RUKO' 
  | 'TANAH' 
  | 'GUDANG' 
  | 'HOTEL_DAN_VILLA' 
  | 'TOKO' 
  | 'PABRIK';

interface CategoryItem {
  id: KategoriEnum;
  label: string;
  icon: string;
  color: string; // Warna unik untuk tiap kategori agar tidak monoton
  desc: string;  // Deskripsi singkat untuk UX yang informatif
}

// Data Kategori (Mapping dari ENUM ke UI)
const categories: CategoryItem[] = [
  {
    id: "RUMAH",
    label: "Rumah Tapak",
    icon: "solar:home-smile-bold-duotone",
    color: "text-emerald-400",
    desc: "Hunian nyaman keluarga",
  },
  {
    id: "APARTEMEN",
    label: "Apartemen",
    icon: "solar:city-bold-duotone",
    color: "text-blue-400",
    desc: "Hunian vertikal modern",
  },
  {
    id: "RUKO",
    label: "Ruko",
    icon: "solar:shop-bold-duotone",
    color: "text-orange-400",
    desc: "Rumah toko & bisnis",
  },
  {
    id: "TANAH",
    label: "Tanah",
    icon: "solar:map-point-wave-bold-duotone",
    color: "text-green-500",
    desc: "Investasi masa depan",
  },
  {
    id: "GUDANG",
    label: "Gudang",
    icon: "solar:box-bold-duotone",
    color: "text-indigo-400",
    desc: "Logistik & penyimpanan",
  },
  {
    id: "HOTEL_DAN_VILLA",
    label: "Hotel & Villa",
    icon: "solar:bed-bold-duotone",
    color: "text-rose-400",
    desc: "Akomodasi wisata",
  },
  {
    id: "TOKO",
    label: "Kios / Toko",
    icon: "solar:bag-heart-bold-duotone",
    color: "text-purple-400",
    desc: "Ruang usaha ritel",
  },
  {
    id: "PABRIK",
    label: "Pabrik",
    icon: "solar:garage-bold-duotone",
    color: "text-yellow-400",
    desc: "Industri & produksi",
  },
];

// Animasi Container (Stagger Effect)
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1, // Muncul satu per satu
    },
  },
};

// Animasi Item
const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

const CategorySection = () => {
  return (
    // REVISI COMPACT: pt-8 (Rapat ke Hero), pb-16 (Jarak normal ke bawah)
    <section className="pt-8 pb-8 bg-[#0F0F0F]"> 
      <div className="container mx-auto px-4 max-w-screen-xl">
        
        {/* Section Header - mb-8 agar lebih dekat dengan grid */}
        <div className="mb-8 text-center">
          <motion.h2 
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-extrabold text-white mb-3"
          >
            Telusuri Berdasarkan <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#86efac] to-emerald-500">Kategori</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-white/50 text-base max-w-2xl mx-auto"
          >
            Temukan properti impian Anda dari berbagai pilihan kategori aset terbaik kami.
          </motion.p>
        </div>

        {/* Grid Container - Gap sedikit dirapatkan (gap-4) agar compact */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
        >
          {categories.map((cat) => (
            <motion.div key={cat.id} variants={itemVariants}>
              <Link href={`/search?category=${cat.id}`} className="block h-full">
                <div 
                  className="
                    group relative h-full p-6 rounded-2xl 
                    bg-white/5 border border-white/10 
                    hover:border-[#86efac]/50 hover:bg-white/10 
                    transition-all duration-300 ease-out
                    flex flex-col items-start justify-between
                    overflow-hidden
                    min-h-[160px] 
                  "
                >
                  {/* Background Glow Effect on Hover */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-150 duration-500" />
                  
                  {/* Icon Wrapper */}
                  <div className={`
                    w-12 h-12 mb-4 rounded-xl 
                    bg-white/5 flex items-center justify-center 
                    group-hover:scale-110 transition-transform duration-300
                    shadow-lg shadow-black/20
                  `}>
                    <Icon 
                      icon={cat.icon} 
                      className={`text-3xl ${cat.color} drop-shadow-md`} 
                    />
                  </div>

                  {/* Text Content */}
                  <div className="relative z-10">
                    <h3 className="text-lg font-bold text-white group-hover:text-[#86efac] transition-colors">
                      {cat.label}
                    </h3>
                    <p className="text-xs text-white/40 mt-1 group-hover:text-white/70 transition-colors">
                      {cat.desc}
                    </p>
                  </div>

                  {/* Arrow Icon (Muncul saat hover) */}
                  <div className="absolute bottom-4 right-4 opacity-0 transform translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                     <Icon icon="solar:arrow-right-up-linear" className="text-white/50 text-xl" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>

      </div>
    </section>
  );
};

export default CategorySection;
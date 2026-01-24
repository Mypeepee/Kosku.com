// app/dashboard/listings/components/listing-type.tsx
"use client";

import React from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";

export type KategoriEnum =
  | "RUMAH"
  | "APARTEMEN"
  | "RUKO"
  | "TANAH"
  | "GUDANG"
  | "HOTEL_DAN_VILLA"
  | "TOKO"
  | "PABRIK";

interface CategoryItem {
  id: KategoriEnum;
  label: string;
  icon: string;
  color: string;
  desc: string;
}

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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const itemVariants = {
  hidden: { y: 16, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 260, damping: 22 },
  },
};

export type ListingTypeCounts = Partial<Record<KategoriEnum, number>>;

type ListingTypeProps = {
  counts: ListingTypeCounts;
};

const ListingTypeStats = ({ counts }: ListingTypeProps) => {
  return (
    <section className="rounded-2xl border border-white/5 bg-[#05070b] px-4 py-4 sm:px-5 sm:py-5">
      {/* Header compact untuk dashboard */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-white">
            Tipe Properti dalam Portofolio
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Lihat sebaran listing Anda berdasarkan kategori aset.
          </p>
        </div>
        <Icon
          icon="solar:pie-chart-3-bold-duotone"
          className="text-emerald-400 text-xl"
        />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        {categories.map((cat) => {
          const count = counts[cat.id] ?? 0;

          return (
            <motion.div key={cat.id} variants={itemVariants}>
              <Link href={`/dashboard/listings?category=${cat.id}`} className="block h-full">
                <div
                  className="
                    group relative h-full p-3.5 sm:p-4 rounded-2xl 
                    bg-white/5 border border-white/10 
                    hover:border-[#86efac]/50 hover:bg-white/10 
                    transition-all duration-300 ease-out
                    flex flex-col items-start justify-between
                    overflow-hidden
                    min-h-[120px]
                  "
                >
                  {/* Glow */}
                  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full -mr-3 -mt-3 transition-transform group-hover:scale-150 duration-500" />

                  {/* Icon + count */}
                  <div className="flex items-center justify-between w-full mb-3 relative z-10">
                    <div
                      className="
                        w-9 h-9 rounded-xl 
                        bg-white/5 flex items-center justify-center 
                        group-hover:scale-110 transition-transform duration-300
                        shadow-lg shadow-black/20
                      "
                    >
                      <Icon
                        icon={cat.icon}
                        className={`text-2xl ${cat.color} drop-shadow-md`}
                      />
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-white leading-none">
                        {count}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        listing
                      </p>
                    </div>
                  </div>

                  {/* Text */}
                  <div className="relative z-10">
                    <h3 className="text-xs font-semibold text-white group-hover:text-[#86efac] transition-colors">
                      {cat.label}
                    </h3>
                    <p className="text-[10px] text-white/40 mt-0.5 group-hover:text-white/70 transition-colors line-clamp-2">
                      {cat.desc}
                    </p>
                  </div>

                  {/* Arrow */}
                  <div className="absolute bottom-3 right-3 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                    <Icon
                      icon="solar:arrow-right-up-linear"
                      className="text-white/50 text-base"
                    />
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
};

export default ListingTypeStats;

import React from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";

// DUMMY DATA HADIAH
const REWARDS = [
  {
    id: 1,
    title: "Voucher Diskon Sewa Rp 50.000",
    points: 500,
    image: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=800&q=80",
    category: "Voucher",
    color: "bg-blue-500",
  },
  {
    id: 2,
    title: "Token Listrik Rp 20.000",
    points: 250,
    image: "https://images.unsplash.com/photo-1550565118-ccd746916d78?auto=format&fit=crop&w=800&q=80",
    category: "Utility",
    color: "bg-yellow-500",
  },
  {
    id: 3,
    title: "Sundul Iklan (Untuk Pemilik)",
    points: 1000,
    image: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80",
    category: "Fitur",
    color: "bg-[#86efac]",
  },
  {
    id: 4,
    title: "Merchandise Kaos Kosku",
    points: 2500,
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80",
    category: "Merch",
    color: "bg-purple-500",
  },
];

const RedeemPoints = ({ userPoints = 0 }: { userPoints: number }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* HEADER SALDO POIN */}
      <div className="bg-gradient-to-r from-[#181818] to-[#222] border border-white/10 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden">
        {/* Hiasan Background */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#86efac]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="flex items-center gap-4 z-10">
          <div className="w-14 h-14 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-500 border border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.3)]">
            <Icon icon="solar:crown-star-bold" className="text-3xl" />
          </div>
          <div>
            <p className="text-sm text-gray-400">Saldo Poin Anda</p>
            <h2 className="text-3xl font-black text-white">{userPoints.toLocaleString()} <span className="text-base font-normal text-yellow-500">XP</span></h2>
          </div>
        </div>
        
        <button className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-sm font-semibold text-white z-10">
          Riwayat Penukaran
        </button>
      </div>

      {/* GRID KATALOG */}
      <div>
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Icon icon="solar:gift-bold" className="text-[#86efac]" />
          Katalog Hadiah
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {REWARDS.map((item) => (
            <div 
              key={item.id} 
              className="group bg-[#181818] rounded-2xl border border-white/5 overflow-hidden hover:border-[#86efac]/30 transition-all flex flex-col"
            >
              {/* Gambar Hadiah */}
              <div className="relative h-32 w-full overflow-hidden">
                 <Image src={item.image} alt={item.title} fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                 <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[10px] font-bold text-white border border-white/10">
                    {item.category}
                 </div>
              </div>

              {/* Konten */}
              <div className="p-4 flex flex-col flex-1 justify-between">
                <div>
                   <h4 className="font-bold text-white mb-1 group-hover:text-[#86efac] transition-colors">{item.title}</h4>
                   <p className="text-xs text-gray-500 mb-4">Tukarkan poin Anda untuk item ini.</p>
                </div>

                <div className="flex items-center justify-between mt-auto">
                  <div className="text-[#86efac] font-bold flex items-center gap-1">
                    <Icon icon="solar:ticket-star-bold" />
                    {item.points} Poin
                  </div>
                  
                  <button 
                    disabled={userPoints < item.points}
                    className={`
                      px-4 py-2 rounded-lg text-xs font-bold transition-all
                      ${userPoints >= item.points 
                        ? "bg-[#86efac] text-black hover:bg-[#6ee7b7] shadow-lg shadow-[#86efac]/20" 
                        : "bg-white/5 text-gray-500 cursor-not-allowed"
                      }
                    `}
                  >
                    {userPoints >= item.points ? "Tukar" : "Kurang"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default RedeemPoints;
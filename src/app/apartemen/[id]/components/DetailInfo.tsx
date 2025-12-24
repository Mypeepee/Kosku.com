"use client";
import React, { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

// =============================================================================
// MOCK DATA TAMBAHAN (Untuk simulasi kelengkapan informasi)
// =============================================================================
const FULL_AMENITIES = [
  {
    category: "Umum",
    items: [
      { icon: "solar:snowflake-linear", label: "AC (Air Conditioner)" },
      { icon: "solar:wifi-router-linear", label: "WiFi Cepat (100 Mbps)" },
      { icon: "solar:tv-linear", label: "Smart TV 55 Inch (Netflix)" },
      { icon: "solar:workspace-linear", label: "Meja Kerja Khusus" },
    ]
  },
  {
    category: "Dapur & Makan",
    items: [
      { icon: "solar:chef-hat-linear", label: "Dapur Lengkap" },
      { icon: "solar:fridge-linear", label: "Kulkas 2 Pintu" },
      { icon: "mdi:microwave", label: "Microwave" },
      { icon: "mdi:stove", label: "Kompor Induksi" },
      { icon: "solar:cup-linear", label: "Alat Makan Dasar" },
    ]
  },
  {
    category: "Kamar Mandi & Laundry",
    items: [
      { icon: "solar:bath-linear", label: "Water Heater" },
      { icon: "solar:washing-machine-linear", label: "Mesin Cuci (Bukaan Depan)" },
      { icon: "mdi:hair-dryer", label: "Hair Dryer" },
      { icon: "solar:towel-linear", label: "Handuk & Sabun Gratis" },
    ]
  },
  {
    category: "Fasilitas Gedung",
    items: [
      { icon: "solar:swimming-linear", label: "Infinity Pool (Lantai 5)" },
      { icon: "solar:dumbbell-large-linear", label: "Gym & Fitness Center" },
      { icon: "solar:elevator-linear", label: "Lift Akses Kartu" },
      { icon: "solar:shield-check-linear", label: "Keamanan 24 Jam" },
      { icon: "solar:shop-linear", label: "Minimarket di Lobby" },
    ]
  }
];

const RATING_BREAKDOWN = [
  { label: "Kebersihan", score: 4.9 },
  { label: "Akurasi", score: 4.8 },
  { label: "Komunikasi", score: 5.0 },
  { label: "Lokasi", score: 4.9 },
  { label: "Check-in", score: 5.0 },
  { label: "Nilai (Value)", score: 4.7 },
];

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

// 1. Amenities Modal (Pop up seperti Airbnb)
const AmenitiesModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = "auto"; };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center">
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} 
        />
        <motion.div 
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            className="relative bg-[#181818] w-full md:max-w-2xl h-[85vh] md:h-[80vh] md:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col border border-white/10"
        >
            <div className="flex justify-between items-center p-5 border-b border-white/10">
                <h3 className="text-xl font-bold text-white">Fasilitas Lengkap</h3>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><Icon icon="solar:close-circle-bold" className="text-2xl text-gray-400 hover:text-white"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                {FULL_AMENITIES.map((section, idx) => (
                    <div key={idx}>
                        <h4 className="text-base font-bold text-white mb-4 sticky top-0 bg-[#181818] py-2 z-10">{section.category}</h4>
                        <div className="space-y-4">
                            {section.items.map((item, i) => (
                                <div key={i} className="flex items-center gap-4 pb-4 border-b border-white/5 last:border-0">
                                    <Icon icon={item.icon} className="text-2xl text-gray-400"/>
                                    <span className="text-sm text-gray-300">{item.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

// 2. Rating Bar
const RatingBar = ({ label, score }: { label: string, score: number }) => (
    <div className="flex items-center justify-between gap-4 mb-3">
        <span className="text-sm text-gray-300 w-28">{label}</span>
        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full" style={{ width: `${(score / 5) * 100}%` }}></div>
        </div>
        <span className="text-xs font-bold text-white w-6 text-right">{score}</span>
    </div>
);

// 3. Landmark Item
const LandmarkItem = ({ name, dist, icon }: { name: string, dist: string, icon: string }) => (
  <div className="flex justify-between items-center py-3 border-b border-white/5 last:border-0 hover:bg-white/5 px-2 rounded-lg transition-colors -mx-2">
    <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#252525] flex items-center justify-center text-gray-400"><Icon icon={icon}/></div>
        <span className="text-sm text-gray-300">{name}</span>
    </div>
    <span className="text-xs font-medium text-white bg-white/10 px-2 py-1 rounded">{dist}</span>
  </div>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function DetailInfo({ data }: { data: any }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAmenities, setShowAmenities] = useState(false);

  // Tampilkan hanya 6 fasilitas pertama sebagai preview
  const previewAmenities = [
    ...FULL_AMENITIES[0].items,
    ...FULL_AMENITIES[1].items.slice(0, 2)
  ].slice(0, 6);

  return (
    <div className="w-full lg:w-2/3 space-y-10 pb-10">
      
      {/* 1. BADGES & QUICK STATS (Updated: Lantai Real) */}
      <div className="border-b border-white/10 pb-8">
        <div className="flex flex-wrap gap-2 mb-6">
            <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide flex items-center gap-1"><Icon icon="solar:verified-check-bold"/> Verified Unit</span>
            <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide">Bisa Cicilan</span>
            <span className="bg-[#86efac]/10 text-[#86efac] border border-[#86efac]/20 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide flex items-center gap-1"><Icon icon="solar:bolt-bold"/> Instan Book</span>
        </div>

        <div className="grid grid-cols-4 gap-3 p-4 bg-[#151515] rounded-2xl border border-white/5">
            {[
                { label: "Tipe Unit", val: data.type, icon: "solar:home-angle-bold" },
                { label: "Luas Unit", val: `${data.sqm} m²`, icon: "solar:ruler-angular-bold" },
                { label: "Furnish", val: "Full", icon: "solar:sofa-bold" },
                // UPDATED: Menampilkan Lantai dari data, bukan 'High Zone'
                { label: "Posisi", val: `Lantai ${data.floor || '12'}`, icon: "solar:buildings-bold" }, 
            ].map((stat, i) => (
                <div key={i} className="flex flex-col items-center justify-center text-center p-2 rounded-xl hover:bg-white/5 transition-colors">
                    <Icon icon={stat.icon} className="text-2xl text-gray-400 mb-2"/>
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{stat.label}</p>
                    <p className="text-xs md:text-sm font-bold text-white mt-0.5">{stat.val}</p>
                </div>
            ))}
        </div>
      </div>

      {/* 2. DESCRIPTION (Expandable) */}
      <div className="border-b border-white/10 pb-8">
        <h3 className="text-lg font-bold text-white mb-3">Tentang tempat ini</h3>
        <div className="relative">
            <p className={`text-gray-300 text-sm leading-relaxed text-justify ${!isExpanded ? 'line-clamp-4' : ''}`}>
                {data.description} 
                <br/><br/>
                Selamat datang di hunian premium kami. Unit ini didesain khusus untuk para profesional dan keluarga kecil yang menginginkan kenyamanan maksimal. 
                Nikmati pagi hari dengan pemandangan kota yang menakjubkan dari balkon pribadi Anda. Interior bergaya Scandinavian modern memberikan nuansa hangat dan tenang.
                <br/><br/>
                Lokasi sangat strategis, hanya selangkah ke Mall dan pusat kuliner. Akses mudah ke transportasi umum dan jalan tol. Keamanan 24 jam dan akses kartu pribadi menjamin privasi Anda.
            </p>
            <button 
                onClick={() => setIsExpanded(!isExpanded)} 
                className="text-white font-bold underline text-sm mt-3 hover:text-primary transition-colors flex items-center gap-1"
            >
                {isExpanded ? "Tutup deskripsi" : "Baca selengkapnya"} <Icon icon="solar:alt-arrow-right-linear"/>
            </button>
        </div>
      </div>

      {/* 3. AMENITIES (Preview + Modal - Style Airbnb) */}
      <div className="border-b border-white/10 pb-8">
        <h3 className="text-lg font-bold text-white mb-6">Fasilitas yang tersedia</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {previewAmenities.map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-gray-300">
                    <Icon icon={item.icon} className="text-xl min-w-[24px]"/>
                    <span className="text-sm">{item.label}</span>
                </div>
            ))}
        </div>
        <button 
            onClick={() => setShowAmenities(true)}
            className="w-full md:w-auto px-8 py-3 rounded-xl border border-white/20 text-white font-bold text-sm hover:bg-white/10 transition-all active:scale-95"
        >
            Tampilkan semua 32 fasilitas
        </button>
        <AmenitiesModal isOpen={showAmenities} onClose={() => setShowAmenities(false)} />
      </div>

      {/* 4. RATINGS & REVIEWS (NEW - Style Airbnb) */}
      <div className="border-b border-white/10 pb-8">
         <div className="flex items-center gap-2 mb-6">
            <Icon icon="solar:star-bold" className="text-yellow-500 text-2xl"/>
            <h3 className="text-2xl font-bold text-white">{data.rating} · {data.reviews} ulasan</h3>
         </div>
         
         {/* Rating Breakdown Grid */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2 mb-8">
            {RATING_BREAKDOWN.map((r, i) => (
                <RatingBar key={i} label={r.label} score={r.score} />
            ))}
         </div>

         {/* Review Cards Scrollable */}
         <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {[1, 2, 3].map((_, i) => (
                <div key={i} className="min-w-[280px] bg-[#151515] p-5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-xs font-bold text-white">JD</div>
                        <div>
                            <h5 className="font-bold text-white text-sm">John Doe</h5>
                            <span className="text-[10px] text-gray-500">Desember 2025</span>
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-3 leading-relaxed">
                        "Tempatnya sangat bersih dan nyaman. Host sangat responsif. View dari balkon luar biasa, pasti akan kembali lagi!"
                    </p>
                </div>
            ))}
         </div>
         <button className="text-white font-bold underline text-sm mt-2 hover:text-primary">Lihat semua {data.reviews} ulasan</button>
      </div>

      {/* 5. LOCATION (Style Booking.com) */}
      <div className="border-b border-white/10 pb-8">
         <h3 className="text-lg font-bold text-white mb-4">Lokasi & Sekitar</h3>
         <p className="text-sm text-gray-400 mb-6 flex items-center gap-2"><Icon icon="solar:map-point-bold"/> {data.location}</p>
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
            <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wider">Transportasi</h4>
                <LandmarkItem icon="solar:train-linear" name="Stasiun LRT Bekasi Barat" dist="5 min" />
                <LandmarkItem icon="solar:bus-linear" name="Halte Busway" dist="2 min" />
                <LandmarkItem icon="solar:plane-linear" name="Bandara Halim (HLP)" dist="25 min" />
            </div>
            <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wider">Lifestyle</h4>
                <LandmarkItem icon="solar:bag-linear" name="Grand Metropolitan Mall" dist="3 min" />
                <LandmarkItem icon="solar:shop-linear" name="Lagoon Avenue" dist="Direct" />
                <LandmarkItem icon="solar:cart-linear" name="Supermarket Hero" dist="5 min" />
            </div>
         </div>
      </div>

      {/* 6. HOST & RULES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         {/* Host */}
         <div>
             <h3 className="text-lg font-bold text-white mb-4">Host Anda</h3>
             <div className="flex items-start gap-4">
                <div className="w-14 h-14 relative">
                    <div className="w-14 h-14 rounded-full bg-[#252525] border border-white/10 flex items-center justify-center text-xl font-bold text-white">{data.owner.avatar}</div>
                    <div className="absolute -bottom-1 -right-1 bg-white text-black p-0.5 rounded-full"><Icon icon="solar:medal-star-bold" className="text-xs"/></div>
                </div>
                <div>
                    <h4 className="font-bold text-white">{data.owner.name}</h4>
                    <p className="text-xs text-gray-400 mb-2">Superhost · Bergabung {data.owner.joined}</p>
                    <p className="text-xs text-gray-400 leading-relaxed mb-3">Host berpengalaman dengan respon cepat. Kami berkomitmen memberikan pengalaman menginap terbaik.</p>
                    <button className="px-4 py-2 rounded-lg border border-white/20 text-xs font-bold text-white hover:bg-white/10">Hubungi Host</button>
                </div>
             </div>
         </div>

         {/* Rules */}
         <div>
             <h3 className="text-lg font-bold text-white mb-4">Hal yang perlu diketahui</h3>
             <div className="bg-[#151515] rounded-xl border border-white/5 p-4 space-y-3">
                <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-xs text-gray-400">Check-in</span>
                    <span className="text-xs font-bold text-white">14:00 - 22:00</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-xs text-gray-400">Check-out</span>
                    <span className="text-xs font-bold text-white">12:00</span>
                </div>
                <div className="flex flex-col gap-1.5 pt-1">
                    <div className="flex items-center gap-2 text-xs text-gray-300"><Icon icon="solar:users-group-rounded-linear"/> Maksimal 2 Tamu</div>
                    <div className="flex items-center gap-2 text-xs text-gray-300"><Icon icon="solar:forbidden-circle-linear"/> Dilarang Merokok</div>
                    <div className="flex items-center gap-2 text-xs text-gray-300"><Icon icon="solar:paw-linear"/> Hewan Peliharaan Diizinkan (S&K)</div>
                </div>
             </div>
         </div>
      </div>

    </div>
  );
}
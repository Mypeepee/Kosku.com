"use client";
import React, { useState } from "react";
import { Icon } from "@iconify/react";
import Image from "next/image";
// 1. IMPORT DYNAMIC (Wajib untuk Peta Leaflet)
import dynamic from "next/dynamic";

// 2. LOAD COMPONENT PETA (Sesuaikan path "../" dengan struktur folder Anda)
// Asumsi path: src/app/Carikos/[id]/components/DetailInfo.tsx
// Target: src/app/components/Maps/KosMap.tsx
const KosMap = dynamic(() => import("../../../../components/Maps/KosMap"), { 
  ssr: false, 
  loading: () => (
    <div className="w-full h-full bg-[#151515] animate-pulse flex flex-col items-center justify-center text-gray-500 gap-2">
      <Icon icon="solar:map-point-bold-duotone" className="text-3xl animate-bounce"/>
      <span className="text-xs font-bold">Memuat Peta...</span>
    </div>
  )
});

// DEFINISI PROPS
interface DetailInfoProps {
  data: any;
  selectedRoom: any;
  setSelectedRoom: (room: any) => void;
}

// DATA MOCK ULASAN
const MOCK_REVIEWS = [
  {
    id: 1,
    name: "Sarah Wijaya",
    avatar: "S",
    date: "2 Hari lalu",
    stayDuration: "6 Bulan",
    rating: 5,
    roomType: "VIP Suite",
    tags: ["Fasilitas Lengkap", "Bersih"],
    comment: "Kos rasa hotel bintang 5! Ibu kos sangat ramah, fasilitas lengkap banget, kolam renang bersih. Worth every penny!",
    helpfulCount: 12,
    hasPhoto: true
  },
  {
    id: 2,
    name: "Budi Santoso",
    avatar: "B",
    date: "1 Minggu lalu",
    stayDuration: "1 Tahun",
    rating: 5,
    roomType: "Standard AC",
    tags: ["Lokasi Strategis"],
    comment: "Lokasi strategis banget dekat MRT. Kamar nyaman dan dingin. Minus parkir mobil agak terbatas kalau malam.",
    helpfulCount: 8,
    hasPhoto: false
  },
  {
    id: 3,
    name: "Jessica Tan",
    avatar: "J",
    date: "2 Minggu lalu",
    stayDuration: "3 Bulan",
    rating: 4,
    roomType: "Economy Room",
    tags: ["Murah", "Bersih"],
    comment: "Untuk harga segini sangat worth it. Bersih dan aman. Cuma kadang wifi agak lemot di jam sibuk.",
    helpfulCount: 5,
    hasPhoto: false
  }
];

// Helper Warna
const getTypeColor = (type: string) => {
    if(type === 'Putri') return 'border-pink-500 text-pink-500 bg-pink-500/10';
    if(type === 'Putra') return 'border-blue-500 text-blue-500 bg-blue-500/10';
    return 'border-purple-500 text-purple-500 bg-purple-500/10';
};
const formatRupiah = (val: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);

export default function DetailInfo({ data, selectedRoom, setSelectedRoom }: DetailInfoProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [reviewFilter, setReviewFilter] = useState("Semua");

  // LOGIC FILTER ULASAN
  const filteredReviews = MOCK_REVIEWS.filter((review) => {
      if (reviewFilter === "Semua") return true;
      if (reviewFilter === "Bintang 5") return review.rating === 5;
      if (reviewFilter === "Dengan Foto") return review.hasPhoto;
      if (reviewFilter === "Terbaru") return true; 
      return true;
  });

  return (
    <div className="w-full lg:w-2/3 space-y-10 pb-10">
        
       {/* 1. MOBILE HEADER */}
       <div className="lg:hidden border-b border-white/5 pb-6">
          <div className="flex justify-between items-start gap-4 mb-3">
              <h1 className="text-2xl font-bold text-white leading-tight flex-1">{data.title}</h1>
              <div className="flex gap-2 shrink-0 pt-1">
                  <button className="bg-[#1A1A1A] w-10 h-10 flex items-center justify-center rounded-full text-white border border-white/10 active:scale-95 transition-transform shadow-lg">
                      <Icon icon="solar:share-bold" className="text-lg"/>
                  </button>
                  <button onClick={() => setIsFavorite(!isFavorite)} className={`w-10 h-10 flex items-center justify-center rounded-full border active:scale-95 transition-transform shadow-lg bg-[#1A1A1A] ${isFavorite ? 'border-red-500/50 text-red-500' : 'border-white/10 text-white'}`}>
                      <Icon icon={isFavorite ? "solar:heart-bold" : "solar:heart-linear"} className="text-lg"/>
                  </button>
              </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
             <Icon icon="solar:map-point-bold" className="text-[#86efac]"/> {data.address}
          </div>
          <div className="flex gap-2">
             <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${getTypeColor(data.type)}`}>{data.type}</span>
             <span className="px-3 py-1 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-full text-[10px] font-bold uppercase flex items-center gap-1">
                <Icon icon="solar:verified-check-bold" /> Verified
             </span>
          </div>
       </div>

       {/* 2. SPESIFIKASI UNIT TERPILIH */}
       <div>
           <div className="flex justify-between items-end mb-4">
                <h3 className="text-lg font-bold text-white">Spesifikasi Unit</h3>
                <span className="text-xs text-[#86efac] font-bold bg-[#86efac]/10 px-2 py-1 rounded border border-[#86efac]/20">{selectedRoom.name}</span>
           </div>
           <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
               <div className="bg-[#151515] border border-white/5 p-4 rounded-xl flex flex-col items-center justify-center text-center gap-1 hover:border-[#86efac]/50 transition-colors group">
                   <Icon icon="solar:ruler-angular-bold" className="text-gray-400 group-hover:text-[#86efac] text-2xl mb-1 transition-colors" />
                   <span className="text-[10px] uppercase font-bold text-gray-500">Luas</span>
                   <span className="text-sm font-bold text-white">{selectedRoom.size.split(' ')[0]}</span>
               </div>
               {selectedRoom.amenities.slice(0, 3).map((am: any, idx: number) => (
                   <div key={idx} className="bg-[#151515] border border-white/5 p-4 rounded-xl flex flex-col items-center justify-center text-center gap-1 hover:border-[#86efac]/50 transition-colors group">
                       <Icon icon={am.icon} className="text-gray-400 group-hover:text-[#86efac] text-2xl mb-1 transition-colors" />
                       <span className="text-[10px] uppercase font-bold text-gray-500 line-clamp-1">{am.label.split(' ')[0]}</span>
                       <span className="text-[10px] font-bold text-white line-clamp-1">{am.label.split(' ').slice(1).join(' ') || 'Ada'}</span>
                   </div>
               ))}
               <div className="bg-[#151515] border border-white/5 p-4 rounded-xl flex flex-col items-center justify-center text-center gap-1 hover:border-[#86efac]/50 transition-colors group">
                   <Icon icon="solar:shield-check-bold" className="text-gray-400 group-hover:text-[#86efac] text-2xl mb-1 transition-colors" />
                   <span className="text-[10px] uppercase font-bold text-gray-500">Aman</span>
                   <span className="text-sm font-bold text-white">24 Jam</span>
               </div>
           </div>
       </div>

       {/* 3. PILIH TIPE KAMAR */}
       <div id="room-types" className="pt-4 border-t border-white/5">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Icon icon="solar:bed-bold" className="text-[#86efac]"/> Pilih Tipe Kamar</h3>
          <div className="space-y-4">
             {data.roomTypes.map((room: any) => {
                const isSelected = selectedRoom.id === room.id;
                return (
                    <div 
                       key={room.id}
                       onClick={() => setSelectedRoom(room)}
                       className={`relative rounded-3xl border p-4 sm:p-5 cursor-pointer transition-all duration-300 flex flex-col sm:flex-row gap-5 ${
                           isSelected 
                           ? 'border-[#86efac] bg-[#86efac]/5 shadow-[0_0_20px_rgba(134,239,172,0.05)]' 
                           : 'border-white/10 bg-[#151515] hover:border-white/30'
                       }`}
                    >
                       <div className="w-full sm:w-48 h-40 sm:h-auto rounded-2xl bg-gray-700 relative overflow-hidden flex-shrink-0">
                            <Image src={room.image} alt={room.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                            {room.isPromo && <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg z-10">PROMO</div>}
                       </div>
                       <div className="flex-1 flex flex-col justify-center">
                            <h4 className={`font-bold text-xl leading-tight mb-1 ${isSelected ? 'text-[#86efac]' : 'text-white'}`}>{room.name}</h4>
                            <p className="text-xs text-gray-400 mb-4">{room.size} • {room.bedType}</p>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-2 mb-4">
                                {room.amenities.map((am: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-2 text-xs">
                                        <Icon icon={am.icon} className={isSelected ? 'text-[#86efac]' : 'text-gray-500'} />
                                        <span className={`${am.highlight ? 'text-pink-400 font-bold' : 'text-gray-300'}`}>{am.label}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-2 mt-auto">
                                {room.tags.map((tag: string, i: number) => (
                                    <span key={i} className="text-[10px] px-2 py-1 rounded bg-[#0F0F0F] text-gray-400 border border-white/10 font-medium">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                       </div>
                       <div className="flex flex-row sm:flex-col justify-between items-center sm:items-end sm:justify-center border-t sm:border-t-0 border-white/5 pt-4 sm:pt-0 gap-1 pl-0 sm:pl-4 sm:border-l border-white/10 min-w-[140px]">
                            <div className="text-left sm:text-right">
                                <p className="text-lg font-bold text-white">{formatRupiah(room.price)}</p>
                                <p className="text-[10px] text-gray-500 text-right">/ bulan</p>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all mt-0 sm:mt-2 ${isSelected ? 'border-[#86efac]' : 'border-gray-600'}`}>
                                {isSelected && <div className="w-3 h-3 rounded-full bg-[#86efac] shadow-[0_0_10px_#86efac]"></div>}
                            </div>
                       </div>
                    </div>
                );
             })}
          </div>
       </div>

       {/* 4. DESKRIPSI & LAINNYA */}
       <div className="pt-4 border-t border-white/5 mt-4">
          <h3 className="text-lg font-bold mb-4">Deskripsi Kos</h3>
          <p className="text-gray-300 text-sm leading-7 text-justify mb-8">{data.description}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                 <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider pb-2 border-b border-white/5">Fasilitas Umum</h4>
                 <ul className="space-y-3">
                    {data.facilities.public.map((fac: string, i: number) => (
                       <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                          <Icon icon="solar:check-circle-linear" className="text-[#86efac]"/> {fac}
                       </li>
                    ))}
                 </ul>
              </div>
              <div>
                 <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider pb-2 border-b border-white/5">Aturan & Deposit</h4>
                 <ul className="space-y-3 mb-4">
                    {data.rules.map((rule: string, i: number) => (
                       <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                          <Icon icon="solar:forbidden-circle-linear" className="text-red-400"/> {rule}
                       </li>
                    ))}
                 </ul>
                 <div className="flex items-start gap-3 text-sm text-gray-300 bg-white/5 p-3 rounded-xl border border-white/5">
                     <Icon icon="solar:wallet-bold" className="text-yellow-500 text-lg mt-0.5"/> 
                     <div>
                        <span className="font-bold text-white block">Deposit: {formatRupiah(data.depositInfo.amount)}</span>
                        <span className="text-xs text-gray-500 leading-tight">{data.depositInfo.notes}</span>
                     </div>
                 </div>
              </div>
          </div>
       </div>

       {/* 5. LOKASI AREA (CLEAN UI) */}
       <div className="pt-8 border-t border-white/5 mt-4">
           <div className="flex justify-between items-end mb-4">
               <div>
                   <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                        <Icon icon="solar:map-point-bold" className="text-[#86efac]"/> Lokasi Area
                   </h3>
                   <p className="text-xs text-gray-400 mt-1 ml-7">Perkiraan lokasi sekitar Menteng Atas</p>
               </div>
               
               {/* Tombol External Link ke Google Maps */}
               <a 
                 href={`https://www.google.com/maps/search/?api=1&query=${-6.2146},${106.8451}`}
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="text-xs font-bold text-[#86efac] hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
               >
                   Lihat Rute <Icon icon="solar:arrow-right-up-linear"/>
               </a>
           </div>
           
           {/* Container Peta */}
           <div className="relative w-full h-[400px] bg-[#151515] rounded-3xl overflow-hidden group mb-6 border border-white/10 shadow-2xl z-0">
               
               {/* MAP COMPONENT */}
               {/* Filter tombol Gym/Mall dll sudah ada di dalam component ini */}
               <KosMap lat={-6.2146} lng={106.8451} />

           </div>
           
           {/* Aksesibilitas Tag */}
           <div className="flex flex-wrap gap-2">
               {data.accessibility?.map((acc: string, i: number) => (
                   <div key={i} className="bg-gradient-to-br from-[#1A1A1A] to-[#0F0F0F] border border-white/5 px-4 py-2 rounded-xl text-xs text-gray-300 flex items-center gap-2 shadow-sm">
                       <Icon icon="solar:walking-bold-duotone" className="text-[#86efac] text-sm"/> 
                       <span className="font-medium">{acc}</span>
                   </div>
               ))}
           </div>
       </div>

       {/* 6. ULASAN & 7. PEMILIK (TETAP SAMA) */}
       <div className="border-t border-white/5 pt-8 mt-4">
           <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Icon icon="solar:chat-square-like-bold" className="text-[#86efac]"/> Ulasan Penghuni
           </h3>
           
           <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
               <div className="lg:col-span-4 bg-[#151515] p-6 rounded-3xl border border-white/5 h-fit lg:sticky lg:top-24">
                   <div className="text-center mb-6">
                       <h4 className="text-6xl font-extrabold text-white mb-2">{data.rating}</h4>
                       <div className="flex justify-center text-yellow-500 mb-2 gap-1 text-lg">
                           {[...Array(5)].map((_,i)=><Icon key={i} icon={i < Math.floor(data.rating) ? "solar:star-bold" : "solar:star-linear"}/>)}
                       </div>
                       <p className="text-sm text-gray-400 font-medium">Berdasarkan {data.reviews} ulasan</p>
                   </div>
                   <div className="space-y-4 mb-6">
                       {[
                           { label: "Kebersihan", val: data.ratingDetail.clean },
                           { label: "Kenyamanan", val: data.ratingDetail.comfort },
                           { label: "Lokasi", val: data.ratingDetail.location },
                           { label: "Pelayanan", val: data.ratingDetail.service },
                           { label: "Harga", val: data.ratingDetail.value },
                       ].map((r, idx) => (
                           <div key={idx}>
                               <div className="flex justify-between text-xs mb-1.5">
                                   <span className="text-gray-300 font-medium">{r.label}</span>
                                   <span className="text-white font-bold">{r.val}</span>
                               </div>
                               <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                                   <div className="bg-[#86efac] h-full rounded-full" style={{width: `${(r.val/5)*100}%`}}></div>
                               </div>
                           </div>
                       ))}
                   </div>
               </div>

               <div className="lg:col-span-8">
                   <div className="flex gap-3 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                       {["Semua", "Dengan Foto", "Bintang 5", "Terbaru"].map((filter) => (
                           <button 
                              key={filter} 
                              onClick={() => setReviewFilter(filter)}
                              className={`px-4 py-2 rounded-full text-xs font-bold border whitespace-nowrap transition-all ${reviewFilter === filter ? 'bg-white text-black border-white' : 'bg-transparent text-gray-400 border-white/10 hover:border-white/30'}`}
                           >
                              {filter}
                           </button>
                       ))}
                   </div>

                   <div className="space-y-6">
                       {filteredReviews.map((review) => (
                           <div key={review.id} className="border-b border-white/5 pb-6 last:border-0">
                               <div className="flex justify-between items-start mb-4">
                                   <div className="flex items-center gap-4">
                                       <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-800 to-gray-700 flex items-center justify-center font-bold text-lg border border-white/10">
                                           {review.avatar}
                                       </div>
                                       <div>
                                           <h5 className="font-bold text-white text-sm">{review.name}</h5>
                                           <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                               <span>{review.date}</span>
                                               <span>•</span>
                                               <span>Huni {review.stayDuration}</span>
                                           </div>
                                       </div>
                                   </div>
                                   <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg">
                                       <Icon icon="solar:star-bold" className="text-yellow-500 text-xs"/>
                                       <span className="text-xs font-bold text-white">{review.rating}.0</span>
                                   </div>
                               </div>
                               {review.tags && (
                                   <div className="flex gap-2 mb-3">
                                       {review.tags.map((tag, i) => (
                                           <span key={i} className="text-[10px] bg-white/5 text-gray-300 px-2 py-1 rounded border border-white/5">
                                               {tag}
                                           </span>
                                       ))}
                                       <span className="text-[10px] bg-[#86efac]/10 text-[#86efac] px-2 py-1 rounded border border-[#86efac]/20">
                                           Tipe: {review.roomType}
                                       </span>
                                   </div>
                               )}
                               <p className="text-sm text-gray-300 leading-relaxed mb-4">"{review.comment}"</p>
                               <div className="flex items-center gap-4">
                                   <button className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors group">
                                       <Icon icon="solar:like-bold" className="group-hover:scale-110 transition-transform"/> 
                                       Membantu ({review.helpfulCount})
                                   </button>
                               </div>
                           </div>
                       ))}
                   </div>
                   <button className="w-full mt-6 border border-white/10 py-3 rounded-xl text-sm font-bold hover:bg-white/5 transition-colors text-gray-300">
                       Tampilkan Semua Ulasan
                   </button>
               </div>
           </div>
       </div>

       <div className="border-t border-white/5 pt-8 mt-8">
           <h3 className="text-lg font-bold mb-4">Dikelola Oleh</h3>
           <div className="bg-[#151515] p-5 rounded-2xl border border-white/5 flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
               <div className="relative">
                   <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-gray-700 to-gray-600 flex items-center justify-center text-2xl font-bold border-2 border-[#1A1A1A]">
                       {data.owner.name.charAt(0)}
                   </div>
                   <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-4 border-[#151515] rounded-full" title="Online"></div>
               </div>
               <div className="flex-1">
                   <h3 className="text-base font-bold text-white mb-1">{data.owner.name}</h3>
                   <div className="flex flex-wrap justify-center sm:justify-start gap-3 text-[10px] text-gray-400 mb-3">
                      <span className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded"><Icon icon="solar:calendar-bold"/> Gabung {data.owner.join}</span>
                      <span className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded"><Icon icon="solar:chat-round-dots-bold"/> Balas {data.owner.response}</span>
                   </div>
                   <button className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-white/10 text-white font-bold text-xs hover:bg-white/10 flex items-center justify-center gap-2 transition-all">
                        <Icon icon="solar:chat-line-linear" className="text-base"/> Chat Pemilik
                   </button>
                   <p className="text-[10px] text-gray-500 mt-3 italic">*Demi keamanan, jangan melakukan transaksi di luar aplikasi.</p>
               </div>
           </div>
       </div>

    </div>
  );
}
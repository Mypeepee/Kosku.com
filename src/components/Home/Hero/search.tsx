"use client";
import { Icon } from "@iconify/react";

const CardSlider = () => {
  return (
    // Shadow diperkuat agar terlihat 'mengambang' di atas perbatasan banner dan background hitam
    <div className="w-full max-w-6xl mx-auto bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col lg:flex-row min-h-[380px] border border-white/10 relative">
      
      {/* BAGIAN KIRI: FORM (Dark Elegance) */}
      <div className="lg:w-[40%] bg-[#0f172a] p-8 lg:p-10 flex flex-col justify-between relative">
        {/* Aksen Hijau Pudar */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/30 rounded-full blur-[60px] pointer-events-none"></div>
        
        <div className="relative z-10">
          <h3 className="text-white text-2xl font-bold mb-6 flex items-center gap-2">
            <Icon icon="solar:filters-bold" className="text-primary" />
            Filter Pencarian
          </h3>
          
          <div className="space-y-4">
            {/* Lokasi */}
            <div>
              <label className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2 block ml-1">Lokasi</label>
              <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3 hover:border-primary/50 transition-colors">
                <Icon icon="solar:map-point-bold" className="text-primary text-xl" />
                <input type="text" placeholder="Ketik lokasi / kampus..." className="bg-transparent border-none p-0 text-white placeholder:text-gray-600 w-full focus:ring-0 text-sm font-medium" />
              </div>
            </div>

            {/* Grid Tipe & Harga */}
            <div className="grid grid-cols-2 gap-3">
               <div>
                  <label className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2 block ml-1">Durasi</label>
                  <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-2">
                    <Icon icon="solar:clock-circle-bold" className="text-primary text-lg" />
                    <select className="bg-transparent border-none p-0 text-white w-full focus:ring-0 text-sm font-medium cursor-pointer [&>option]:text-darkmode">
                      <option>Bulanan</option>
                      <option>Harian</option>
                      <option>Tahunan</option>
                    </select>
                  </div>
               </div>
               <div>
                  <label className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2 block ml-1">Harga Max</label>
                  <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-2">
                    <span className="text-primary font-bold text-sm">Rp</span>
                    <input type="number" placeholder="Budget..." className="bg-transparent border-none p-0 text-white w-full focus:ring-0 text-sm font-medium" />
                  </div>
               </div>
            </div>
          </div>
        </div>

        <button className="w-full bg-primary hover:bg-green-400 text-darkmode text-base font-bold py-4 rounded-xl mt-8 flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20 relative z-10">
          <span>Terapkan Filter</span>
          <Icon icon="solar:arrow-right-linear" className="text-lg" />
        </button>
      </div>

      {/* BAGIAN KANAN: Value Proposition (Clean White) */}
      <div className="lg:w-[60%] bg-white p-8 lg:p-10 flex flex-col justify-center">
        <div className="mb-8">
          <h3 className="text-gray-900 text-2xl font-bold mb-2">Kenapa harus Kosku?</h3>
          <p className="text-gray-500 text-sm">Kami menjamin keamanan dan kenyamanan pencarian properti Anda.</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-2xl text-center hover:bg-green-50 transition-colors cursor-default group">
            <Icon icon="solar:shield-check-bold-duotone" className="text-4xl text-gray-400 group-hover:text-primary mx-auto mb-2 transition-colors" />
            <h4 className="text-gray-900 font-bold text-sm">Terverifikasi</h4>
            <p className="text-xs text-gray-400 mt-1">Data kos valid 100%</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-2xl text-center hover:bg-green-50 transition-colors cursor-default group">
            <Icon icon="solar:chat-round-line-bold-duotone" className="text-4xl text-gray-400 group-hover:text-primary mx-auto mb-2 transition-colors" />
            <h4 className="text-gray-900 font-bold text-sm">Chat Langsung</h4>
            <p className="text-xs text-gray-400 mt-1">Nego dengan pemilik</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-2xl text-center hover:bg-green-50 transition-colors cursor-default group">
            <Icon icon="solar:card-recive-bold-duotone" className="text-4xl text-gray-400 group-hover:text-primary mx-auto mb-2 transition-colors" />
            <h4 className="text-gray-900 font-bold text-sm">Bebas Biaya</h4>
            <p className="text-xs text-gray-400 mt-1">Tanpa admin fee</p>
          </div>
        </div>
      </div>

    </div>
  );
};

export default CardSlider;
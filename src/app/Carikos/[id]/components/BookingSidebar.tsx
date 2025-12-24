"use client";

import React, { useState, useEffect, useRef } from "react";
import { Icon } from "@iconify/react";
import { AnimatePresence, motion } from "framer-motion";


// =============================================================================
// 1. MOCK DATA PROMO
// =============================================================================
const AVAILABLE_COUPONS = [
  { id: 1, code: "ANAKKOSBARU", title: "Diskon Penghuni Baru", discount: 150000, desc: "Min. sewa 1 bulan", color: "bg-green-500" },
  { id: 2, code: "BAYAR3BULAN", title: "Potongan Sewa Jangka Panjang", discount: 500000, desc: "Khusus sewa 3 bulan+", color: "bg-blue-500" },
  { id: 3, code: "KOSKUHEMAT", title: "Cashback Awal Tahun", discount: 150000, desc: "Hemat Rp 150.000", color: "bg-purple-500" },
];

// =============================================================================
// 2. HELPER COMPONENTS (MODAL)
// =============================================================================

const PromoModal = ({ isOpen, onClose, onSelect, selectedId }: any) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-[#121212] border border-white/10 w-full max-w-md rounded-3xl overflow-hidden relative z-10 shadow-2xl flex flex-col max-h-[80vh]">
           <div className="flex justify-between items-center p-5 border-b border-white/10 bg-[#161616]">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Icon icon="solar:ticket-sale-bold" className="text-[#86efac]"/> Pilih Voucher</h3>
              <button onClick={onClose}><Icon icon="solar:close-circle-bold" className="text-xl text-gray-400 hover:text-white"/></button>
           </div>
           <div className="p-5 overflow-y-auto space-y-3 custom-scrollbar">
              {AVAILABLE_COUPONS.map((c) => (
                <div key={c.id} onClick={() => { onSelect(c); onClose(); }} className={`border rounded-2xl p-4 cursor-pointer flex gap-4 transition-all ${selectedId === c.id ? 'border-[#86efac] bg-[#86efac]/10' : 'border-white/10 bg-[#1A1A1A] hover:border-white/30'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${c.color} text-white shadow-lg`}><Icon icon="solar:tag-price-bold"/></div>
                  <div className="flex-1">
                      <h4 className="font-bold text-white text-sm">{c.code}</h4>
                      <p className="text-xs text-gray-400 mt-0.5">{c.desc}</p>
                  </div>
                  {selectedId === c.id && <Icon icon="solar:check-circle-bold" className="text-[#86efac] text-2xl self-center"/>}
                </div>
              ))}
           </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

const DatePickerModal = ({ isOpen, onClose, onSelect }: any) => {
    const [viewDate, setViewDate] = useState(new Date());
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    
    const renderDays = () => {
        const year = viewDate.getFullYear(); const month = viewDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startDay = new Date(year, month, 1).getDay();
        const today = new Date(); today.setHours(0,0,0,0);
        const days = [];
        for (let i = 0; i < startDay; i++) days.push(<div key={`empty-${i}`} className="h-9"/>);
        for (let d = 1; d <= daysInMonth; d++) {
            const current = new Date(year, month, d);
            const isPast = current < today;
            days.push(
                <button key={d} disabled={isPast} onClick={() => { onSelect(current); onClose(); }} 
                className={`h-9 w-9 text-xs rounded-full font-bold transition-all ${isPast ? 'text-gray-600 line-through' : 'text-white hover:bg-[#86efac] hover:text-black'}`}>{d}</button>
            );
        }
        return days;
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
                    <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#121212] border border-white/10 w-full max-w-[320px] rounded-3xl p-4 shadow-2xl relative z-10">
                        <div className="flex justify-between items-center mb-4"><span className="font-bold text-white">Mulai Ngekos Tanggal?</span><button onClick={onClose}><Icon icon="solar:close-circle-bold" className="text-gray-400 hover:text-white"/></button></div>
                        <div className="flex justify-between items-center px-2 mb-4"><button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth()-1))}><Icon icon="solar:alt-arrow-left-linear" className="text-white"/></button><span className="text-white font-bold text-sm">{monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}</span><button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth()+1))}><Icon icon="solar:alt-arrow-right-linear" className="text-white"/></button></div>
                        <div className="grid grid-cols-7 gap-1 place-items-center text-center">{['M','S','S','R','K','J','S'].map(d=><span key={d} className="text-[10px] text-gray-500 font-bold">{d}</span>)}{renderDays()}</div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

// =============================================================================
// 3. MAIN COMPONENT: BookingSidebar
// =============================================================================

interface BookingSidebarProps {
    data: any;
    selectedRoom: any;
}

export default function BookingSidebar({ data, selectedRoom }: BookingSidebarProps) {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [duration, setDuration] = useState(1); 
  const [selectedCoupon, setSelectedCoupon] = useState<any>(null);
  const [isPromoOpen, setIsPromoOpen] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);
  
  const detailsRef = useRef<HTMLDivElement>(null);

  const formatRupiah = (val: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);
  const formatDate = (date: Date | null) => date ? date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "Pilih Tanggal";

  // --- LOGIC HITUNG TANGGAL SELESAI (REVISI) ---
  const getEndDate = () => {
      if (!startDate) return "-";
      
      const endDate = new Date(startDate.getTime());
      
      // Tambahkan bulan
      // Misal: 31 Jan + 1 bulan = 28 Feb (atau 29)
      const currentDay = endDate.getDate();
      endDate.setMonth(endDate.getMonth() + duration);

      // Cek apakah tanggalnya berubah (artinya bulan tujuannya lebih pendek)
      // Contoh: 31 Jan -> setMonth(+1) -> jadi 2 Maret (karena Feb cuma 28).
      // Kita harus balikin ke tanggal terakhir bulan sebelumnya (28 Feb).
      if (endDate.getDate() !== currentDay) {
          endDate.setDate(0); 
      }

      return endDate.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  };

  // --- LOGIC HARGA ---
  const monthlyPrice = selectedRoom.price || 0; 
  const deposit = data.deposit || 500000;
  const serviceFee = 10000;
  const totalRent = monthlyPrice * duration;
  const discount = selectedCoupon ? selectedCoupon.discount : 0;
  const grandTotal = Math.max(0, totalRent + deposit + serviceFee - discount);

  useEffect(() => { setDuration(1); }, [selectedRoom.id]);

  const incrementDuration = () => setDuration(prev => prev + 1);
  const decrementDuration = () => setDuration(prev => Math.max(1, prev - 1));

  // Auto scroll saat rincian dibuka
  useEffect(() => {
    if (isDetailExpanded && detailsRef.current) {
        detailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isDetailExpanded]);

  return (
    <>
      <PromoModal isOpen={isPromoOpen} onClose={() => setIsPromoOpen(false)} onSelect={setSelectedCoupon} selectedId={selectedCoupon?.id} />
      <DatePickerModal isOpen={isDateOpen} onClose={() => setIsDateOpen(false)} onSelect={setStartDate} />

      {/* CONTAINER UTAMA (FIT SCREEN) */}
      <div className="hidden lg:flex flex-col w-[380px] sticky top-24 h-[calc(100vh-120px)] bg-[#1A1A1A] border border-white/10 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden">
          
          {/* --- BAGIAN 1: HEADER (FIXED) --- */}
          <div className="p-6 pb-2 shrink-0 z-10 bg-[#1A1A1A]">
              <div className="flex justify-between items-start">
                <div className="flex-1 pr-4">
                    <span className="text-xs font-bold text-[#86efac] uppercase tracking-wider mb-1 block truncate">
                        {selectedRoom.name}
                    </span>
                    <div className="flex items-end gap-1">
                        <span className="text-2xl font-extrabold text-white">{formatRupiah(monthlyPrice)}</span>
                        <span className="text-xs text-gray-400 font-medium mb-1">/ bulan</span>
                    </div>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shrink-0 h-fit">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/>
                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">Sisa 2 Kamar</span>
                </div>
              </div>
          </div>

          {/* --- BAGIAN 2: SCROLLABLE CONTENT (TENGAH) --- */}
          <div className="flex-1 overflow-y-auto px-6 py-2 custom-scrollbar space-y-4">
             
             {/* 1. TANGGAL MULAI & SELESAI */}
             <div className="bg-[#0F0F0F] border border-white/10 rounded-xl p-4">
                 {/* Mulai */}
                 <div onClick={() => setIsDateOpen(true)} className="flex justify-between items-center cursor-pointer group mb-3">
                    <span className="text-xs font-bold text-gray-400 group-hover:text-white transition-colors">Mulai Ngekos</span>
                    <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${startDate ? 'text-white' : 'text-gray-500'}`}>{formatDate(startDate)}</span>
                        <Icon icon="solar:calendar-date-bold" className="text-[#86efac] text-lg"/>
                    </div>
                 </div>
                 
                 <div className="border-t border-dashed border-white/10 my-3"></div>
                 
                 {/* Selesai (Simbol ditambahkan) */}
                 <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-400">Berakhir Tanggal</span>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{getEndDate()}</span>
                        <Icon icon="solar:calendar-date-bold" className="text-gray-500 text-lg"/>
                    </div>
                 </div>
             </div>

             {/* 2. DURASI SEWA (Counter +/-) */}
             <div className="flex justify-between items-center bg-[#0F0F0F] border border-white/10 rounded-xl p-3 px-4">
                <div className="flex items-center gap-2">
                    <Icon icon="solar:clock-circle-bold" className="text-gray-400 text-lg"/>
                    <span className="text-sm font-bold text-gray-300">Durasi (bulan)</span>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={decrementDuration}
                        className="w-9 h-9 rounded-lg bg-[#252525] flex items-center justify-center text-white hover:bg-white/20 transition-all border border-white/10 active:scale-95 hover:border-white/30"
                    >
                        {/* Ikon Minus Tebal */}
                        <Icon icon="ic:round-minus" className="text-xl"/>
                    </button>
                    
                    <span className="font-bold text-white text-lg w-6 text-center">{duration}</span>
                    
                    <button 
                        onClick={incrementDuration}
                        className="w-9 h-9 rounded-lg bg-[#252525] flex items-center justify-center text-white hover:bg-white/20 transition-all border border-white/10 active:scale-95 hover:border-white/30"
                    >
                        {/* Ikon Plus Tebal */}
                        <Icon icon="ic:round-plus" className="text-xl"/>
                    </button>
                </div>
             </div>

             {/* 3. PROMO SECTION (Revisi UI Hijau Compact) */}
             {selectedCoupon ? (
                 // UI PROMO TERPILIH (Compact Green)
                 <div className="relative w-full rounded-xl p-3 flex items-center justify-between border border-[#86efac]/50 bg-[#86efac]/10">
                     <div className="flex items-center gap-3">
                        <Icon icon="solar:ticket-sale-bold" className="text-[#86efac] text-xl"/>
                        <div>
                            <p className="text-xs font-extrabold text-white uppercase tracking-wide">{selectedCoupon.code}</p>
                            <p className="text-[10px] font-medium text-[#86efac]">{selectedCoupon.desc}</p>
                        </div>
                     </div>
                     {/* Tombol X Kecil */}
                     <button 
                        onClick={() => setSelectedCoupon(null)} 
                        className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-all"
                     >
                        <Icon icon="solar:close-linear" className="text-xs"/>
                     </button>
                 </div>
             ) : (
                 // UI BELUM PILIH PROMO
                 <div onClick={() => setIsPromoOpen(true)} className="relative w-full rounded-xl p-3 px-4 cursor-pointer flex items-center justify-between border border-dashed border-gray-600 bg-[#252525] hover:border-gray-400 transition-all">
                     <div className="flex items-center gap-2.5">
                        <div className="bg-pink-500 p-1 rounded-md text-white"><Icon icon="solar:ticket-sale-bold" className="text-sm"/></div>
                        <span className="text-xs font-bold text-gray-300">Makin hemat pakai promo</span>
                     </div>
                     <Icon icon="solar:alt-arrow-right-linear" className="text-gray-500"/>
                 </div>
             )}

             {/* 4. RINCIAN BIAYA (Didalam Scroll) */}
             <AnimatePresence>
                {isDetailExpanded && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }} 
                        animate={{ height: "auto", opacity: 1 }} 
                        exit={{ height: 0, opacity: 0 }} 
                        className="overflow-hidden bg-[#0F0F0F] rounded-xl border border-white/5 p-4"
                    >
                        <div ref={detailsRef} className="space-y-3 text-xs text-gray-400">
                            <div className="flex justify-between">
                                <span>Sewa {selectedRoom.name} ({duration}x)</span>
                                <span>{formatRupiah(totalRent)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Biaya Layanan</span>
                                <span>{formatRupiah(serviceFee)}</span>
                            </div>
                            <div className="flex justify-between text-white">
                                <span className="underline decoration-dotted cursor-help">Deposit (Dikembalikan)</span>
                                <span>{formatRupiah(deposit)}</span>
                            </div>
                            {selectedCoupon && (
                                <div className="flex justify-between text-[#86efac] font-bold">
                                    <span>Potongan Promo</span>
                                    <span>- {formatRupiah(discount)}</span>
                                </div>
                            )}
                            <div className="border-t border-dashed border-white/10 my-2"></div>
                            <p className="text-[10px] text-gray-500 italic text-center">Biaya belum termasuk listrik (jika token).</p>
                        </div>
                    </motion.div>
                )}
             </AnimatePresence>
          </div>

          {/* --- BAGIAN 3: FOOTER (FIXED) --- */}
          <div className="p-6 pt-4 border-t border-white/10 bg-[#1A1A1A] z-20 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
             
             <div className="flex justify-between items-center cursor-pointer group mb-4" onClick={() => setIsDetailExpanded(!isDetailExpanded)}>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">Total Pembayaran</span>
                    <Icon icon="solar:info-circle-linear" className="text-gray-500 text-sm"/>
                </div>
                <div className="flex items-center gap-1">
                    <span className="text-lg font-extrabold text-[#86efac]">{formatRupiah(grandTotal)}</span>
                    <Icon icon="solar:alt-arrow-down-linear" className={`text-gray-500 transition-transform ${isDetailExpanded ? 'rotate-180' : ''}`}/>
                </div>
             </div>

             <div className="space-y-3">
                  <button disabled={!startDate} className="w-full bg-[#86efac] hover:bg-[#6ee7b7] disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-black font-extrabold text-sm py-3.5 rounded-xl shadow-[0_0_20px_rgba(134,239,172,0.1)] hover:shadow-[0_0_25px_rgba(134,239,172,0.3)] transition-all active:scale-[0.98] flex justify-center items-center gap-2">
                    Ajukan Sewa
                  </button>
                  <button className="w-full bg-transparent border border-white/20 hover:bg-white/10 text-white font-bold text-sm py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 group">
                    <Icon icon="solar:chat-round-dots-linear" className="text-lg group-hover:text-[#86efac] transition-colors"/>
                    Tanya Pemilik
                  </button>
             </div>
          </div>

      </div>
    </>
  );
}
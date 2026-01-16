"use client";

import React, { useState, useRef, useEffect } from "react";
import { Icon } from "@iconify/react";
import { AnimatePresence, motion } from "framer-motion";

// =========================================================================
// 0. DUMMY DATA PROMO
// =========================================================================
const AVAILABLE_COUPONS = [
  { id: 1, code: "BARUGABUNG", title: "Diskon Pengguna Baru", discount: 50000, desc: "Tanpa min. transaksi", color: "bg-blue-500" },
  { id: 2, code: "KOSKUHEMAT", title: "Cashback Akhir Tahun", discount: 150000, desc: "Min. sewa 3 bulan", color: "bg-purple-500" },
  { id: 3, code: "SULTAN", title: "Potongan Sultan", discount: 300000, desc: "Khusus sewa tahunan", color: "bg-orange-500" },
];

// =========================================================================
// 1. HELPER COMPONENTS
// =========================================================================

// --- Promo Modal ---
const PromoModal = ({ isOpen, onClose, onSelect, selectedId }: any) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-[#121212] border border-white/10 w-full max-w-md rounded-3xl overflow-hidden relative z-10 shadow-2xl max-h-[80vh] flex flex-col">
           <div className="flex justify-between items-center p-5 border-b border-white/10 bg-[#161616]">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Icon icon="solar:ticket-sale-bold" className="text-primary"/> Pakai Promo</h3>
              <button onClick={onClose}><Icon icon="solar:close-circle-bold" className="text-xl text-gray-400 hover:text-white"/></button>
           </div>
           <div className="p-5 overflow-y-auto space-y-3">
              {AVAILABLE_COUPONS.map((c) => (
                <div key={c.id} onClick={() => { onSelect(c); onClose(); }} className={`border rounded-2xl p-4 cursor-pointer flex gap-4 ${selectedId === c.id ? 'border-primary bg-primary/10' : 'border-white/10 bg-[#1A1A1A] hover:border-white/30'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${c.color} text-white shadow-lg`}><Icon icon="solar:tag-price-bold"/></div>
                  <div className="flex-1"><h4 className="font-bold text-white text-sm">{c.title}</h4><p className="text-xs text-gray-400">{c.desc}</p></div>
                  {selectedId === c.id && <Icon icon="solar:check-circle-bold" className="text-primary text-xl"/>}
                </div>
              ))}
           </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

// --- Guest Counter ---
const GuestCounter = ({ label, subLabel, value, onChange, max = 10, disableDecrement }: any) => (
  <div className="flex justify-between items-center py-2.5 border-b border-white/10 last:border-0">
    <div className="max-w-[140px]"><p className="text-xs font-bold text-white">{label}</p><p className="text-[9px] text-gray-400">{subLabel}</p></div>
    <div className="flex items-center gap-3">
      <button onClick={(e) => { e.stopPropagation(); onChange(Math.max(0, value - 1)); }} disabled={value === 0 || disableDecrement} className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-white disabled:opacity-20 hover:border-white hover:bg-white/10"><Icon icon="ic:round-minus" width="14" height="14" /></button>
      <span className="text-xs font-bold text-white w-4 text-center">{value}</span>
      <button onClick={(e) => { e.stopPropagation(); onChange(Math.min(max, value + 1)); }} disabled={value === max} className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-white disabled:opacity-20 hover:border-white hover:bg-white/10"><Icon icon="ic:round-plus" width="14" height="14" /></button>
    </div>
  </div>
);

// --- Calendar Modal (Dual Mode: Single & Range) ---
const CalendarModal = ({ isOpen, onClose, onSelect, mode, startDate, endDate }: any) => {
  const [viewDate, setViewDate] = useState(new Date());
  const [tempStart, setTempStart] = useState<Date | null>(startDate);
  const [tempEnd, setTempEnd] = useState<Date | null>(endDate);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];

  // Reset state saat modal dibuka
  useEffect(() => {
    if (isOpen) {
        setTempStart(startDate);
        setTempEnd(endDate);
    }
  }, [isOpen, startDate, endDate]);

  const handleDateClick = (clickedDate: Date) => {
    const today = new Date(); today.setHours(0,0,0,0);
    if (clickedDate < today) return; 

    // LOGIKA SESUAI MODE
    if (mode === "monthly" || mode === "yearly") {
        // Mode Bulan/Tahun: Cukup pilih 1 tanggal (Start Date)
        setTempStart(clickedDate);
        setTempEnd(null); // End date dihitung otomatis di parent
        // Langsung tutup agar cepat
        onSelect(clickedDate, null);
        onClose();
    } else {
        // Mode Harian: Range Picker (Start & End)
        if (!tempStart || (tempStart && tempEnd)) {
            setTempStart(clickedDate);
            setTempEnd(null);
        } else if (clickedDate > tempStart) {
            setTempEnd(clickedDate);
        } else {
            setTempStart(clickedDate);
        }
    }
  };

  const handleSave = () => {
    if (mode !== 'daily' && tempStart) { onSelect(tempStart, null); onClose(); }
    else if (tempStart && tempEnd) { onSelect(tempStart, tempEnd); onClose(); }
  };

  const renderDays = () => {
    const year = viewDate.getFullYear(); const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDay = new Date(year, month, 1).getDay();
    const today = new Date(); today.setHours(0,0,0,0);
    const days = [];
    
    for (let i = 0; i < startDay; i++) days.push(<div key={`empty-${i}`} className="h-9 w-full" />);
    
    for (let d = 1; d <= daysInMonth; d++) {
      const current = new Date(year, month, d);
      const isPast = current < today;
      const isStart = tempStart && current.getTime() === tempStart.getTime();
      
      // Logic Visual Range hanya untuk Daily
      let isEnd = false, isInRange = false;
      if (mode === 'daily') {
          isEnd = tempEnd && current.getTime() === tempEnd.getTime();
          isInRange = tempStart && tempEnd && current > tempStart && current < tempEnd;
      }

      let wrapperClass = "relative h-9 w-full flex items-center justify-center p-0 ";
      if (isInRange) wrapperClass += "bg-[#86efac]/20";
      else if (isStart && isEnd) wrapperClass += "bg-[#86efac]/20 rounded-full"; // Kasus 1 hari (jarang)
      else if (isStart && tempEnd) wrapperClass += "bg-gradient-to-r from-transparent to-[#86efac]/20 rounded-l-full";
      else if (isEnd && tempStart) wrapperClass += "bg-gradient-to-l from-transparent to-[#86efac]/20 rounded-r-full";

      let btnClass = "h-9 w-9 text-xs rounded-full flex items-center justify-center font-bold transition-all relative z-10 ";
      if (isPast) btnClass += "text-gray-600 cursor-not-allowed line-through";
      else if (isStart || isEnd) btnClass += "bg-[#86efac] text-black shadow-lg scale-105";
      else if (isInRange) btnClass += "text-[#86efac]";
      else btnClass += "text-white hover:bg-white/10";

      days.push(<div key={d} className={wrapperClass}><button onClick={() => !isPast && handleDateClick(current)} disabled={isPast} className={btnClass}>{d}</button></div>);
    }
    return days;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#121212] border border-white/10 w-full max-w-[320px] rounded-3xl overflow-hidden relative z-10 shadow-2xl">
             <div className="flex justify-between items-center p-4 border-b border-white/10 bg-[#161616]">
                <h3 className="text-base font-bold text-white">{mode === 'daily' ? 'Pilih Tanggal' : 'Mulai Sewa'}</h3>
                <button onClick={onClose}><Icon icon="solar:close-circle-bold" className="text-lg text-gray-400 hover:text-white"/></button>
             </div>
             <div className="flex justify-between items-center px-4 py-3"><button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}><Icon icon="solar:alt-arrow-left-linear" className="text-white"/></button><span className="font-bold text-white text-sm">{monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}</span><button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}><Icon icon="solar:alt-arrow-right-linear" className="text-white"/></button></div>
             <div className="px-4 pb-4"><div className="grid grid-cols-7 text-center mb-2 text-[10px] text-gray-500 font-bold uppercase">{["Mn","Sn","Sl","Rb","Km","Jm","Sb"].map(d=> <span key={d}>{d}</span>)}</div><div className="grid grid-cols-7 gap-y-1 gap-x-0 place-items-center">{renderDays()}</div></div>
             {mode === 'daily' && (
                 <div className="p-4 border-t border-white/10 bg-[#161616] flex justify-end"><button onClick={handleSave} disabled={!tempStart || !tempEnd} className="bg-[#86efac] text-black font-bold px-5 py-2 rounded-lg text-xs disabled:opacity-50">Simpan</button></div>
             )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// =========================================================================
// 3. MAIN COMPONENT (COMPACT & COLLAPSIBLE)
// =========================================================================

export default function BookingSidebar({ data }: { data: any }) {
  const [bookingPeriod, setBookingPeriod] = useState<"daily" | "monthly" | "yearly">("monthly");
  
  // Date State
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  
  // Duration State (Hanya dipakai untuk Monthly/Yearly)
  const [durationValue, setDurationValue] = useState(1);

  const [guests, setGuests] = useState({ adults: 1, children: 0, infants: 0, pets: 0 });
  const [selectedCoupon, setSelectedCoupon] = useState<any>(null);
  
  // UI States
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isGuestOpen, setIsGuestOpen] = useState(false);
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);
  
  const guestRef = useRef<HTMLDivElement>(null);

  const formatDate = (date: Date | null) => date ? date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "Pilih Tanggal";
  const formatRupiah = (val: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => { if (guestRef.current && !guestRef.current.contains(event.target as Node)) setIsGuestOpen(false); };
    document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- LOGIC PERUBAHAN TANGGAL & DURASI ---
  
  // 1. Hitung End Date Otomatis (Khusus Monthly/Yearly)
  useEffect(() => {
    if (bookingPeriod !== 'daily' && startDate) {
        const newEnd = new Date(startDate);
        if (bookingPeriod === 'monthly') newEnd.setMonth(newEnd.getMonth() + durationValue);
        if (bookingPeriod === 'yearly') newEnd.setFullYear(newEnd.getFullYear() + durationValue);
        setEndDate(newEnd);
    }
  }, [startDate, durationValue, bookingPeriod]);

  // 2. Handler Ganti Tab
  const changePeriod = (type: any) => {
      setBookingPeriod(type);
      setStartDate(null);
      setEndDate(null);
      setDurationValue(1);
      setSelectedCoupon(null);
  };

  // 3. Handler Kalender
  const onCalendarSelect = (start: Date, end: Date | null) => {
      setStartDate(start);
      if (bookingPeriod === 'daily') {
          setEndDate(end); // Daily: End date dari kalender
      }
      // Monthly/Yearly: End date dihitung useEffect di atas
  };

  // CALCULATION
  const currentPrice = data.priceRates[bookingPeriod];
  const totalGuests = guests.adults + guests.children; 
  let finalDuration = durationValue;
  const durationLabel = bookingPeriod === "daily" ? "malam" : bookingPeriod === "monthly" ? "bulan" : "tahun";

  // Hitung durasi real untuk Daily
  if (bookingPeriod === 'daily' && startDate && endDate) {
    const diff = Math.ceil(Math.abs(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    finalDuration = diff;
  }

  const baseTotal = currentPrice * finalDuration;
  const serviceFee = 25000;
  const deposit = bookingPeriod === "daily" ? 0 : data.deposit || 2000000;
  const discountAmount = selectedCoupon ? selectedCoupon.discount : 0;
  const grandTotal = Math.max(0, baseTotal + serviceFee + deposit - discountAmount);

  return (
    <>
      <CalendarModal 
        isOpen={isCalendarOpen} 
        onClose={() => setIsCalendarOpen(false)} 
        onSelect={onCalendarSelect} 
        mode={bookingPeriod}
        startDate={startDate}
        endDate={endDate}
      />
      <PromoModal isOpen={isPromoModalOpen} onClose={() => setIsPromoModalOpen(false)} onSelect={setSelectedCoupon} selectedId={selectedCoupon?.id} />

      <div className="hidden lg:block w-[360px] sticky top-24 self-start">
        <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-5 shadow-2xl relative overflow-visible">
          
          {/* HEADER: HARGA */}
          <div className="mb-5 flex justify-between items-baseline">
            <div>
                <span className="text-2xl font-extrabold text-white">{formatRupiah(currentPrice)}</span>
                <span className="text-xs text-gray-400 font-medium"> / {durationLabel}</span>
            </div>
          </div>

          {/* TABS */}
          <div className="flex bg-[#0F0F0F] p-1 rounded-lg mb-4 border border-white/5">
            {["daily", "monthly", "yearly"].map((type) => (
              <button key={type} onClick={() => changePeriod(type)} className={`flex-1 py-1.5 text-[11px] font-bold rounded-md capitalize transition-all ${bookingPeriod === type ? 'bg-[#86efac] text-black shadow' : 'text-gray-400 hover:text-white'}`}>
                {type === 'daily' ? 'Harian' : type === 'monthly' ? 'Bulanan' : 'Tahunan'}
              </button>
            ))}
          </div>

          {/* INPUTS CONTAINER */}
          <div className="space-y-2 mb-4">
             
             {/* ROW 1: CHECK-IN & CHECK-OUT */}
             <div className="flex border border-white/10 rounded-xl overflow-hidden bg-[#0F0F0F]">
                <div onClick={() => setIsCalendarOpen(true)} className="flex-1 p-2.5 border-r border-white/10 cursor-pointer hover:bg-white/5 transition-colors">
                   <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Check-In</label>
                   <span className={`text-xs font-bold truncate ${startDate ? 'text-white' : 'text-gray-500'}`}>{formatDate(startDate)}</span>
                </div>
                
                {/* Check-Out: Readonly jika Monthly/Yearly, Clickable jika Daily */}
                <div 
                    onClick={() => bookingPeriod === 'daily' && setIsCalendarOpen(true)} 
                    className={`flex-1 p-2.5 transition-colors ${bookingPeriod === 'daily' ? 'cursor-pointer hover:bg-white/5' : 'cursor-default bg-white/5'}`}
                >
                   <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Check-Out</label>
                   <span className={`text-xs font-bold truncate ${endDate ? 'text-white' : 'text-gray-500'}`}>
                       {formatDate(endDate)}
                   </span>
                </div>
             </div>

             {/* ROW 2: DURATION (Only for Monthly/Yearly) */}
             {bookingPeriod !== 'daily' && (
                 <div className="bg-[#0F0F0F] border border-white/10 rounded-xl p-2.5 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Icon icon="solar:clock-circle-linear" className="text-gray-400"/>
                        <span className="text-xs font-bold text-gray-300">Durasi ({durationLabel})</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setDurationValue(Math.max(1, durationValue - 1))} className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"><Icon icon="ic:round-minus" width="14"/></button>
                        <span className="text-xs font-bold text-white w-6 text-center">{durationValue}</span>
                        <button onClick={() => setDurationValue(Math.min(12, durationValue + 1))} className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"><Icon icon="ic:round-plus" width="14"/></button>
                    </div>
                 </div>
             )}
             
             {/* ROW 3: GUEST DROPDOWN */}
             <div className="relative" ref={guestRef}>
                <div onClick={() => setIsGuestOpen(!isGuestOpen)} className={`bg-[#0F0F0F] border rounded-xl p-2.5 cursor-pointer flex justify-between items-center ${isGuestOpen ? 'border-white ring-1 ring-white' : 'border-white/10 hover:border-white/50'}`}>
                   <div>
                      <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Tamu</label>
                      <span className="text-xs text-white font-bold">{totalGuests} Tamu {guests.pets > 0 ? `, ${guests.pets} Hewan` : ''}</span>
                   </div>
                   <Icon icon="solar:alt-arrow-down-linear" className={`text-white text-lg transition-transform ${isGuestOpen ? 'rotate-180' : ''}`}/>
                </div>
                <AnimatePresence>
                   {isGuestOpen && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full left-0 w-full bg-[#1A1A1A] border border-white/20 rounded-xl shadow-2xl p-3 z-50 mt-1">
                         <GuestCounter label="Dewasa" subLabel="Usia 13+" value={guests.adults} onChange={(val: number) => setGuests({...guests, adults: val})} disableDecrement={guests.adults <= 1} />
                         <GuestCounter label="Anak" subLabel="2-12 Thn" value={guests.children} onChange={(val: number) => setGuests({...guests, children: val})} />
                         <GuestCounter label="Bayi" subLabel="< 2 Thn" value={guests.infants} onChange={(val: number) => setGuests({...guests, infants: val})} />
                         <GuestCounter label="Hewan" subLabel="Wajib Lapor" value={guests.pets} onChange={(val: number) => setGuests({...guests, pets: val})} />
                      </motion.div>
                   )}
                </AnimatePresence>
             </div>
          </div>

          {/* PROMO (COMPACT ROW) */}
          <div onClick={() => setIsPromoModalOpen(true)} className={`w-full rounded-xl p-2.5 mb-4 cursor-pointer flex items-center justify-between border transition-all ${selectedCoupon ? 'bg-[#86efac]/10 border-[#86efac]/50' : 'bg-[#2A2A2A] border-dashed border-gray-600 hover:border-white'}`}>
             <div className="flex items-center gap-2.5">
                <Icon icon="solar:ticket-sale-bold" className={selectedCoupon ? "text-[#86efac]" : "text-[#F472B6]"}/>
                <div className="flex flex-col">
                    <span className={`text-xs font-bold ${selectedCoupon ? 'text-white' : 'text-gray-300'}`}>
                        {selectedCoupon ? selectedCoupon.code : "Gunakan Promo / Kupon"}
                    </span>
                    {selectedCoupon && <span className="text-[10px] text-[#86efac]">Hemat {formatRupiah(discountAmount)}</span>}
                </div>
             </div>
             {selectedCoupon ? 
                <button onClick={(e) => {e.stopPropagation(); setSelectedCoupon(null);}}><Icon icon="solar:close-circle-bold" className="text-gray-400 hover:text-white"/></button> : 
                <Icon icon="solar:alt-arrow-right-linear" className="text-gray-500"/>
             }
          </div>

          {/* BOOK BUTTON */}
          <button className="w-full bg-[#86efac] hover:bg-[#6ee7b7] text-black font-extrabold text-sm py-3.5 rounded-xl shadow-lg transition-all active:scale-95 mb-3">
            Pesan Sekarang
          </button>
          
          {/* TOTAL & COLLAPSIBLE BREAKDOWN */}
          <div className="border-t border-white/10 pt-3">
             <div className="flex justify-between items-center cursor-pointer group" onClick={() => setIsDetailExpanded(!isDetailExpanded)}>
                <div className="flex items-center gap-1">
                    <span className="font-extrabold text-white text-lg">Total</span>
                    <Icon icon="solar:alt-arrow-down-linear" className={`text-gray-400 transition-transform duration-300 ${isDetailExpanded ? 'rotate-180' : ''}`}/>
                </div>
                <div className="text-right">
                    <span className="font-extrabold text-white text-lg block">{formatRupiah(grandTotal)}</span>
                    {!isDetailExpanded && <span className="text-[10px] text-gray-400 underline decoration-dotted">Lihat rincian</span>}
                </div>
             </div>

             <AnimatePresence>
                {isDetailExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="space-y-2 pt-3 pb-1">
                            <div className="flex justify-between text-xs text-gray-300">
                                <span>{formatRupiah(currentPrice)} x {finalDuration} {durationLabel}</span>
                                <span>{formatRupiah(baseTotal)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-gray-300">
                                <span>Biaya Layanan</span>
                                <span>{formatRupiah(serviceFee)}</span>
                            </div>
                            {deposit > 0 && (
                                <div className="flex justify-between text-xs text-gray-300">
                                    <span className="underline decoration-dotted cursor-help">Deposit (Refundable)</span>
                                    <span>{formatRupiah(deposit)}</span>
                                </div>
                            )}
                            {selectedCoupon && (
                                <div className="flex justify-between text-xs text-[#86efac] font-bold">
                                    <span>Diskon Promo</span>
                                    <span>- {formatRupiah(discountAmount)}</span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
             </AnimatePresence>
          </div>

        </div>
      </div>
    </>
  );
}
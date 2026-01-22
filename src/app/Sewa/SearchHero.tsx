"use client";

import React, { useState } from "react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { DateRange } from "./types";
import { daysInMonth, firstDayOfMonth, monthNames } from "./utils";

// --- DATE PICKER MODAL ---
const DatePickerModal = ({
  isOpen,
  onClose,
  onApply,
}: {
  isOpen: boolean;
  onClose: () => void;
  onApply: (start: Date, end: Date, nights: number) => void;
}) => {
  const [viewDate, setViewDate] = useState(new Date());
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    const today = new Date();
    const prev = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
    if (prev.getMonth() < today.getMonth() && prev.getFullYear() === today.getFullYear()) return; 
    setViewDate(prev);
  };

  const handleDateClick = (date: Date) => {
    if (!startDate || (startDate && endDate)) {
      setStartDate(date);
      setEndDate(null);
    } else if (startDate && !endDate) {
      if (date > startDate) {
        setEndDate(date);
      } else {
        setStartDate(date);
      }
    }
  };

  const renderCalendar = (baseDate: Date) => {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const totalDays = daysInMonth(month, year);
    const startDay = firstDayOfMonth(month, year);
    
    const daysArray = [];
    
    for (let i = 0; i < startDay; i++) {
      daysArray.push(<div key={`empty-${i}`} className="w-10 h-10"></div>);
    }

    for (let d = 1; d <= totalDays; d++) {
      const currentDate = new Date(year, month, d);
      let isSelected = false;
      let isInRange = false;
      let isToday = new Date().toDateString() === currentDate.toDateString();

      if (startDate && currentDate.toDateString() === startDate.toDateString()) isSelected = true;
      if (endDate && currentDate.toDateString() === endDate.toDateString()) isSelected = true;
      if (startDate && endDate && currentDate > startDate && currentDate < endDate) isInRange = true;

      daysArray.push(
        <button
          key={d}
          onClick={() => handleDateClick(currentDate)}
          className={`
            w-10 h-10 flex items-center justify-center text-sm font-bold rounded-full transition-all relative
            ${isSelected ? 'bg-primary text-darkmode shadow-lg z-10' : ''}
            ${isInRange ? 'bg-primary/20 text-primary rounded-none' : ''}
            ${!isSelected && !isInRange ? 'text-white hover:bg-white/10' : ''}
            ${isToday && !isSelected && !isInRange ? 'border border-primary text-primary' : ''}
          `}
        >
          {d}
        </button>
      );
    }
    return daysArray;
  };

  const getNightCount = () => {
    if (startDate && endDate) {
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      return diffDays;
    }
    return 0;
  };

  const handleApplyClick = () => {
    if (startDate && endDate) {
      onApply(startDate, endDate, getNightCount());
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose}
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            className="relative bg-[#151515] border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#1A1A1A]">
               <div>
                  <h3 className="text-xl font-bold text-white">Pilih Tanggal</h3>
                  <p className="text-xs text-gray-400">Harga & ketersediaan tergantung tanggal.</p>
               </div>
               <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white transition-colors">
                  <Icon icon="solar:close-circle-bold" className="text-2xl"/>
               </button>
            </div>

            <div className="flex items-center justify-between px-6 py-4">
               <button onClick={prevMonth} className="p-2 rounded-full hover:bg-white/10 text-white"><Icon icon="solar:alt-arrow-left-linear" /></button>
               <h4 className="text-lg font-bold text-white">{monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}</h4>
               <button onClick={nextMonth} className="p-2 rounded-full hover:bg-white/10 text-white"><Icon icon="solar:alt-arrow-right-linear" /></button>
            </div>

            <div className="px-6 pb-6 overflow-y-auto">
               <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {["Min","Sen","Sel","Rab","Kam","Jum","Sab"].map(d => <span key={d} className="text-xs text-gray-500 font-bold">{d}</span>)}
               </div>
               <div className="grid grid-cols-7 gap-1 place-items-center">
                  {renderCalendar(viewDate)}
               </div>
            </div>

            <div className="p-6 border-t border-white/10 bg-[#1A1A1A] flex justify-between items-center">
               <div>
                  {startDate && endDate ? (
                     <div>
                        <p className="text-white font-bold text-sm">{startDate.getDate()} {monthNames[startDate.getMonth()]} - {endDate.getDate()} {monthNames[endDate.getMonth()]}</p>
                        <p className="text-primary text-xs font-bold">{getNightCount()} Malam</p>
                     </div>
                  ) : (
                     <p className="text-gray-500 text-sm">Pilih check-in & check-out</p>
                  )}
               </div>
               <button 
                  onClick={handleApplyClick}
                  disabled={!startDate || !endDate}
                  className="bg-primary hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-darkmode font-bold px-6 py-3 rounded-xl transition-all shadow-lg"
               >
                  Simpan Tanggal
               </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// --- HERO FILTER MAIN COMPONENT ---
const HeroFilter = () => {
  const [duration, setDuration] = useState("Bulanan");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRangeString, setSelectedRangeString] = useState("Pilih Tanggal");
  const [nights, setNights] = useState(0);

  const handleDateApplied = (start: Date, end: Date, n: number) => {
     const startStr = `${start.getDate()} ${monthNames[start.getMonth()].substring(0,3)}`;
     const endStr = `${end.getDate()} ${monthNames[end.getMonth()].substring(0,3)}`;
     setSelectedRangeString(`${startStr} - ${endStr}`);
     setNights(n);
  };

  return (
    <>
      <div className="relative z-20 -mt-20 lg:-mt-28 container mx-auto px-4">
        <div className="bg-[#1A1A1A]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>

          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
             <div className="flex items-center gap-3">
                <span className="text-white font-extrabold text-xl tracking-tight">Sewa Apartemen</span>
                <div className="bg-gradient-to-r from-primary/20 to-emerald-500/20 text-primary px-3 py-1 rounded-full text-[10px] font-bold border border-primary/30 uppercase tracking-wider">
                   Langsung Owner
                </div>
             </div>
             
             <div className="bg-black/60 p-1.5 rounded-full flex border border-white/5">
                {["Harian", "Bulanan", "Tahunan"].map((d) => (
                   <button 
                      key={d}
                      onClick={() => setDuration(d)}
                      className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${duration === d ? 'bg-primary text-darkmode shadow-lg' : 'text-gray-400 hover:text-white'}`}
                   >
                      {d}
                   </button>
                ))}
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
             
             <div className="lg:col-span-4 bg-darkmode border border-white/10 rounded-2xl px-5 py-3 flex items-center gap-4 group focus-within:border-primary/50 transition-all">
                <div className="bg-white/5 p-2.5 rounded-xl text-gray-400 group-focus-within:text-primary transition-colors">
                   <Icon icon="solar:map-point-bold" className="text-xl"/>
                </div>
                <div className="flex-1 border-r border-white/10 pr-4">
                   <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">LOKASI / AREA</p>
                   <input type="text" placeholder="Ketik nama apartemen..." className="bg-transparent w-full text-sm font-bold text-white placeholder:text-gray-600 focus:outline-none"/>
                </div>
             </div>

             <div 
                onClick={() => setIsModalOpen(true)}
                className="lg:col-span-3 bg-darkmode border border-white/10 rounded-2xl px-5 py-3 flex items-center gap-4 cursor-pointer hover:border-primary/50 transition-all group hover:bg-white/5"
             >
                <div className="bg-white/5 p-2.5 rounded-xl text-gray-400 group-hover:text-primary transition-colors">
                   <Icon icon="solar:calendar-date-bold" className="text-xl"/>
                </div>
                <div className="flex-1">
                   <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">CHECK-IN & OUT</p>
                   <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold truncate ${nights > 0 ? 'text-white' : 'text-gray-500'}`}>{selectedRangeString}</span>
                      {nights > 0 && (
                         <span className="text-[9px] bg-primary text-darkmode px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
                            {nights} Malam
                         </span>
                      )}
                   </div>
                </div>
             </div>

             <div className="lg:col-span-3 grid grid-cols-2 gap-4">
                <div className="bg-darkmode border border-white/10 rounded-2xl px-3 py-3 relative cursor-pointer hover:border-white/30 transition-all">
                   <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">UNIT</p>
                   <select className="bg-transparent w-full text-sm font-bold text-white appearance-none focus:outline-none cursor-pointer relative z-10">
                      <option>Semua</option><option>Studio</option><option>1 BR</option><option>2 BR</option>
                   </select>
                   <Icon icon="solar:alt-arrow-down-linear" className="text-gray-500 absolute right-3 bottom-3 pointer-events-none"/>
                </div>
                <div className="bg-darkmode border border-white/10 rounded-2xl px-3 py-3 relative cursor-pointer hover:border-white/30 transition-all">
                   <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">FURNISH</p>
                   <select className="bg-transparent w-full text-sm font-bold text-white appearance-none focus:outline-none cursor-pointer relative z-10">
                      <option>Semua</option><option>Full</option><option>Semi</option>
                   </select>
                   <Icon icon="solar:alt-arrow-down-linear" className="text-gray-500 absolute right-3 bottom-3 pointer-events-none"/>
                </div>
             </div>

             <div className="lg:col-span-2">
                <button className="w-full h-full bg-primary hover:bg-green-500 text-darkmode font-extrabold text-base rounded-2xl shadow-[0_0_30px_rgba(34,197,94,0.2)] hover:shadow-[0_0_40px_rgba(34,197,94,0.4)] flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-95">
                   <Icon icon="solar:magnifer-bold-duotone" className="text-xl"/> Cari
                </button>
             </div>

          </div>
        </div>
      </div>

      <DatePickerModal 
         isOpen={isModalOpen} 
         onClose={() => setIsModalOpen(false)}
         onApply={handleDateApplied}
      />
    </>
  );
};

export default HeroFilter;
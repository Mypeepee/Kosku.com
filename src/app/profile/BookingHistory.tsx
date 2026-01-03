import React, { useState } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";

// =============================================================================
// 1. DUMMY DATA (Sama seperti sebelumnya)
// =============================================================================
const DUMMY_BOOKINGS = [
  {
    id: "INV-KOS-20260120",
    kosName: "Kos Eksklusif Menteng Jakarta",
    location: "Menteng, Jakarta Pusat",
    checkIn: "20 Jan 2026",
    checkOut: "20 Feb 2026",
    duration: "1 Bulan",
    price: "Rp 2.500.000",
    status: "pending", 
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?ixlib=rb-4.0.3&auto=format&fit=crop&w=2340&q=80",
  },
  {
    id: "INV-KOS-20251215",
    kosName: "Kos Putri Melati Surabaya",
    location: "Sukolilo, Surabaya",
    checkIn: "15 Des 2025",
    checkOut: "15 Mar 2026",
    duration: "3 Bulan",
    price: "Rp 4.500.000",
    status: "active",
    image: "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?ixlib=rb-4.0.3&auto=format&fit=crop&w=2340&q=80",
  },
  {
    id: "INV-KOS-20251101",
    kosName: "Paviliun Dago Bandung",
    location: "Coblong, Bandung",
    checkIn: "01 Nov 2025",
    checkOut: "01 Des 2025",
    duration: "1 Bulan",
    price: "Rp 1.800.000",
    status: "completed",
    image: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?ixlib=rb-4.0.3&auto=format&fit=crop&w=2340&q=80",
  },
  {
    id: "INV-KOS-20251010",
    kosName: "Wisma Ganesha",
    location: "Malang, Jawa Timur",
    checkIn: "10 Okt 2025",
    checkOut: "10 Nov 2025",
    duration: "1 Bulan",
    price: "Rp 850.000",
    status: "cancelled",
    image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?ixlib=rb-4.0.3&auto=format&fit=crop&w=2340&q=80",
  },
];

// =============================================================================
// 2. HELPER COMPONENTS
// =============================================================================

const StatusBadge = ({ status }: { status: string }) => {
  const styles: any = {
    pending: { bg: "bg-yellow-500/10", text: "text-yellow-500", border: "border-yellow-500/20", label: "Menunggu", icon: "solar:clock-circle-bold" },
    active: { bg: "bg-[#86efac]/10", text: "text-[#86efac]", border: "border-[#86efac]/20", label: "Aktif", icon: "solar:verified-check-bold" },
    completed: { bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/20", label: "Selesai", icon: "solar:clipboard-check-bold" },
    cancelled: { bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/20", label: "Batal", icon: "solar:close-circle-bold" },
  };
  const style = styles[status] || styles.cancelled;
  return (
    <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold border ${style.bg} ${style.text} ${style.border}`}>
      <Icon icon={style.icon} />
      {style.label}
    </span>
  );
};

// =============================================================================
// 3. MAIN COMPONENT (WITH PAGINATION)
// =============================================================================
const BookingHistory = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3; // BATASI HANYA 3 ITEM PER HALAMAN

  // Logic Pagination
  const totalPages = Math.ceil(DUMMY_BOOKINGS.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentData = DUMMY_BOOKINGS.slice(startIndex, startIndex + itemsPerPage);

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handlePrev = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between mb-6">
        <div>
           <h2 className="text-xl font-bold text-white">Riwayat Sewa</h2>
           <p className="text-xs text-gray-500 mt-1">Total {DUMMY_BOOKINGS.length} transaksi</p>
        </div>
        <button className="text-sm text-[#86efac] hover:underline bg-[#86efac]/10 px-4 py-2 rounded-full font-bold">
           Filter
        </button>
      </div>

      {/* LIST BOOKING (Hanya menampilkan data halaman saat ini) */}
      <div className="flex flex-col gap-4">
        {currentData.map((item) => (
          <motion.div 
            key={item.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="group bg-[#181818] rounded-2xl border border-white/5 p-4 hover:border-[#86efac]/30 transition-all flex flex-col sm:flex-row gap-4 sm:gap-6"
          >
            {/* 1. IMAGE THUMBNAIL */}
            <div className="relative w-full sm:w-32 h-32 sm:h-32 rounded-xl overflow-hidden shrink-0">
              <Image 
                src={item.image} 
                alt={item.kosName} 
                fill 
                className="object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent sm:hidden"></div>
            </div>

            {/* 2. DETAIL INFO */}
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] text-gray-500 font-mono tracking-widest">{item.id}</span>
                  <StatusBadge status={item.status} />
                </div>
                
                <h3 className="text-lg font-bold text-white leading-tight mb-1 group-hover:text-[#86efac] transition-colors">
                  {item.kosName}
                </h3>
                
                <div className="flex items-center gap-1 text-sm text-gray-400 mb-4">
                  <Icon icon="solar:map-point-bold" className="text-gray-500" />
                  {item.location}
                </div>

                {/* INFO GRID */}
                <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-gray-400 bg-white/5 p-2.5 rounded-xl w-fit border border-white/5">
                  <div className="flex items-center gap-1.5">
                    <Icon icon="solar:login-2-bold" className="text-[#86efac]" />
                    <div className="flex flex-col leading-none">
                      <span className="text-[10px] text-gray-500">Masuk</span>
                      <b className="text-white">{item.checkIn}</b>
                    </div>
                  </div>
                  <div className="w-px h-6 bg-white/10 hidden sm:block"></div>
                  <div className="flex items-center gap-1.5">
                    <Icon icon="solar:logout-2-bold" className="text-orange-400" />
                    <div className="flex flex-col leading-none">
                      <span className="text-[10px] text-gray-500">Keluar</span>
                      <b className="text-white">{item.checkOut}</b>
                    </div>
                  </div>
                  <div className="w-px h-6 bg-white/10 hidden sm:block"></div>
                   <div className="flex items-center gap-1.5">
                    <Icon icon="solar:hourglass-line-bold" className="text-blue-400" />
                    <div className="flex flex-col leading-none">
                      <span className="text-[10px] text-gray-500">Durasi</span>
                      <b className="text-white">{item.duration}</b>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. PRICE & ACTION */}
            <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 sm:border-l sm:border-white/5 sm:pl-6">
              <div className="text-left sm:text-right">
                <p className="text-xs text-gray-500 mb-1">Total Biaya</p>
                <p className="text-lg font-bold text-[#86efac]">{item.price}</p>
              </div>

              {item.status === "pending" ? (
                <button className="px-5 py-2 rounded-lg bg-[#86efac] text-black text-sm font-bold hover:bg-[#6ee7b7] shadow-lg shadow-[#86efac]/20 transition-all w-fit">
                  Bayar
                </button>
              ) : (
                <button className="px-5 py-2 rounded-lg border border-white/10 text-white text-sm font-semibold hover:bg-white/5 transition-all w-fit">
                  Detail
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
      
      {/* EMPTY STATE */}
      {DUMMY_BOOKINGS.length === 0 && (
         <div className="flex flex-col items-center justify-center py-20 bg-[#181818] rounded-2xl border border-white/5 min-h-[400px]">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4">
              <Icon icon="solar:clipboard-list-bold" className="text-4xl text-gray-600" />
            </div>
            <h3 className="text-lg font-bold text-white text-center px-4">Belum ada riwayat booking</h3>
         </div>
      )}

      {/* --- PAGINATION CONTROLS (Hanya muncul jika halaman > 1) --- */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6 border-t border-white/5 mt-4">
          <button 
            onClick={handlePrev} 
            disabled={currentPage === 1}
            className="p-2 rounded-lg bg-white/5 text-white disabled:opacity-30 hover:bg-[#86efac] hover:text-black transition-all"
          >
            <Icon icon="solar:alt-arrow-left-bold" />
          </button>
          
          <span className="text-sm font-bold text-gray-400 px-4">
            Halaman <span className="text-white">{currentPage}</span> dari {totalPages}
          </span>

          <button 
            onClick={handleNext} 
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg bg-white/5 text-white disabled:opacity-30 hover:bg-[#86efac] hover:text-black transition-all"
          >
            <Icon icon="solar:alt-arrow-right-bold" />
          </button>
        </div>
      )}

    </motion.div>
  );
};

export default BookingHistory;
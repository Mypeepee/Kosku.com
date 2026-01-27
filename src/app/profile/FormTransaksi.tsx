"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";

// =============================================================================
// 1. DUMMY DATA
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
    image:
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?ixlib=rb-4.0.3&auto=format&fit=crop&w=2340&q=80",
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
    image:
      "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?ixlib=rb-4.0.3&auto=format&fit=crop&w=2340&q=80",
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
    image:
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb?ixlib=rb-4.0.3&auto=format&fit=crop&w=2340&q=80",
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
    image:
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?ixlib=rb-4.0.3&auto=format&fit=crop&w=2340&q=80",
  },
];

// =============================================================================
// 2. HELPER COMPONENTS
// =============================================================================

const StatusBadge = ({ status }: { status: string }) => {
  const styles: any = {
    pending: {
      bg: "bg-yellow-500/10",
      text: "text-yellow-400",
      border: "border-yellow-500/30",
      label: "Menunggu Pembayaran",
      icon: "solar:clock-circle-bold",
    },
    active: {
      bg: "bg-[#86efac]/10",
      text: "text-[#86efac]",
      border: "border-[#86efac]/30",
      label: "Sedang Berjalan",
      icon: "solar:verified-check-bold",
    },
    completed: {
      bg: "bg-sky-500/10",
      text: "text-sky-400",
      border: "border-sky-500/30",
      label: "Selesai",
      icon: "solar:clipboard-check-bold",
    },
    cancelled: {
      bg: "bg-red-500/10",
      text: "text-red-400",
      border: "border-red-500/30",
      label: "Dibatalkan",
      icon: "solar:close-circle-bold",
    },
  };
  const style = styles[status] || styles.cancelled;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold border ${style.bg} ${style.text} ${style.border}`}
    >
      <Icon icon={style.icon} className="text-xs" />
      {style.label}
    </span>
  );
};

const FilterChip = ({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: string;
  active: boolean;
  onClick: (v: string) => void;
}) => (
  <button
    type="button"
    onClick={() => onClick(value)}
    className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${
      active
        ? "bg-[#86efac] text-black border-transparent shadow-[0_0_15px_rgba(134,239,172,0.25)]"
        : "bg-transparent text-gray-400 border-white/10 hover:border-[#86efac]/40 hover:text-[#86efac]"
    }`}
  >
    {label}
  </button>
);

// =============================================================================
// 3. MAIN COMPONENT
// =============================================================================

const BookingHistory = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "active" | "completed" | "cancelled">("all");

  const itemsPerPage = 3;

  const filteredBookings =
    statusFilter === "all"
      ? DUMMY_BOOKINGS
      : DUMMY_BOOKINGS.filter((b) => b.status === statusFilter);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const currentData = filteredBookings.slice(startIndex, startIndex + itemsPerPage);

  const handleNext = () => {
    if (safePage < totalPages) setCurrentPage(safePage + 1);
  };

  const handlePrev = () => {
    if (safePage > 1) setCurrentPage(safePage - 1);
  };

  const handleChangeFilter = (value: any) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const totalAmountText = `${filteredBookings.length} transaksi`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">Riwayat Transaksi</h2>
          <p className="text-xs text-gray-500 mt-1">
            Lihat semua kos yang pernah kamu pesan dan status pembayarannya.
          </p>
          <p className="text-[11px] text-gray-500 mt-1 font-mono">
            Total {totalAmountText}
          </p>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <FilterChip
            label="Semua"
            value="all"
            active={statusFilter === "all"}
            onClick={handleChangeFilter}
          />
          <FilterChip
            label="Pending"
            value="pending"
            active={statusFilter === "pending"}
            onClick={handleChangeFilter}
          />
          <FilterChip
            label="Aktif"
            value="active"
            active={statusFilter === "active"}
            onClick={handleChangeFilter}
          />
          <FilterChip
            label="Selesai"
            value="completed"
            active={statusFilter === "completed"}
            onClick={handleChangeFilter}
          />
          <FilterChip
            label="Batal"
            value="cancelled"
            active={statusFilter === "cancelled"}
            onClick={handleChangeFilter}
          />
        </div>
      </div>

      {/* LIST BOOKING */}
      {currentData.length > 0 && (
        <div className="flex flex-col gap-4">
          {currentData.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{
                borderColor: "rgba(134,239,172,0.5)",
                y: -2,
              }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="group bg-[#181818] rounded-2xl border border-white/5 p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:gap-6 relative overflow-hidden"
            >
              {/* Accent gradient */}
              <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-r from-[#86efac]/5 via-transparent to-transparent transition-opacity duration-300" />

              {/* 1. IMAGE THUMBNAIL */}
              <div className="relative w-full sm:w-32 h-32 sm:h-32 rounded-xl overflow-hidden shrink-0">
                <Image
                  src={item.image}
                  alt={item.kosName}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-black/60 border border-white/10 text-[9px] font-mono text-gray-200">
                  {item.id}
                </div>
              </div>

              {/* 2. DETAIL INFO */}
              <div className="flex-1 flex flex-col justify-between min-w-0">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <h3 className="text-base sm:text-lg font-bold text-white leading-tight group-hover:text-[#86efac] transition-colors truncate">
                      {item.kosName}
                    </h3>
                    <StatusBadge status={item.status} />
                  </div>

                  <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-400 mb-3">
                    <Icon
                      icon="solar:map-point-bold"
                      className="text-gray-500"
                    />
                    <span className="truncate">{item.location}</span>
                  </div>

                  {/* INFO GRID */}
                  <div className="inline-flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-gray-400 bg-white/5 px-3 py-2.5 rounded-xl border border-white/5">
                    <div className="flex items-center gap-1.5">
                      <Icon
                        icon="solar:login-2-bold"
                        className="text-[#86efac]"
                      />
                      <div className="flex flex-col leading-none">
                        <span className="text-[10px] text-gray-500">
                          Masuk
                        </span>
                        <span className="text-[11px] text-white font-semibold">
                          {item.checkIn}
                        </span>
                      </div>
                    </div>
                    <span className="hidden sm:inline w-px h-6 bg-white/10" />
                    <div className="flex items-center gap-1.5">
                      <Icon
                        icon="solar:logout-2-bold"
                        className="text-orange-400"
                      />
                      <div className="flex flex-col leading-none">
                        <span className="text-[10px] text-gray-500">
                          Keluar
                        </span>
                        <span className="text-[11px] text-white font-semibold">
                          {item.checkOut}
                        </span>
                      </div>
                    </div>
                    <span className="hidden sm:inline w-px h-6 bg-white/10" />
                    <div className="flex items-center gap-1.5">
                      <Icon
                        icon="solar:hourglass-line-bold"
                        className="text-sky-400"
                      />
                      <div className="flex flex-col leading-none">
                        <span className="text-[10px] text-gray-500">
                          Durasi
                        </span>
                        <span className="text-[11px] text-white font-semibold">
                          {item.duration}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. PRICE & ACTION */}
              <div className="flex flex-row sm:flex-col items-end justify-between sm:justify-center gap-3 sm:border-l sm:border-white/5 sm:pl-5">
                <div className="text-right">
                  <p className="text-[10px] text-gray-500 mb-0.5">
                    Total Biaya
                  </p>
                  <p className="text-lg font-extrabold text-[#86efac] tracking-tight">
                    {item.price}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    Termasuk biaya layanan
                  </p>
                </div>

                {item.status === "pending" ? (
                  <button className="px-5 py-2.5 rounded-lg bg-[#86efac] text-black text-xs sm:text-sm font-bold hover:bg-[#6ee7b7] shadow-lg shadow-[#86efac]/20 transition-all w-fit inline-flex items-center gap-1.5">
                    <Icon
                      icon="solar:card-bold"
                      className="text-sm"
                    />
                    <span>Bayar Sekarang</span>
                  </button>
                ) : (
                  <button className="px-5 py-2.5 rounded-lg border border-white/10 text-xs sm:text-sm text-white font-semibold hover:bg-white/5 transition-all w-fit inline-flex items-center gap-1.5">
                    <Icon
                      icon="solar:document-text-bold"
                      className="text-sm"
                    />
                    <span>Lihat Detail</span>
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* EMPTY STATE */}
      {filteredBookings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-[#181818] rounded-2xl border border-white/5 min-h-[260px] text-center px-6">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
            <Icon
              icon="solar:clipboard-list-bold"
              className="text-3xl text-gray-600"
            />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">
            Belum ada transaksi untuk filter ini
          </h3>
          <p className="text-xs text-gray-400 max-w-xs">
            Semua riwayat sewa kos akan muncul di sini setelah kamu melakukan
            pemesanan.
          </p>
        </div>
      )}

      {/* PAGINATION */}
      {filteredBookings.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6 border-t border-white/5 mt-2">
          <button
            onClick={handlePrev}
            disabled={safePage === 1}
            className="p-2 rounded-lg bg-white/5 text-white disabled:opacity-30 hover:bg-[#86efac] hover:text-black transition-all"
          >
            <Icon icon="solar:alt-arrow-left-bold" />
          </button>

          <span className="text-sm font-bold text-gray-400 px-4">
            Halaman{" "}
            <span className="text-white">{safePage}</span> dari {totalPages}
          </span>

          <button
            onClick={handleNext}
            disabled={safePage === totalPages}
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

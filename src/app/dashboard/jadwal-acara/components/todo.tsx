"use client";

import { useMemo, useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";

interface EventData {
  id_acara: string;
  judul_acara: string;
  deskripsi?: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  waktu_mulai?: string;
  waktu_selesai?: string;
  tipe_acara: string;
  lokasi?: string;
  status_acara: string;
  agent?: {
    id_agent: string;
    pengguna: {
      nama_lengkap: string;
    };
  };
}

interface TodoProps {
  events: EventData[];
  onEventClick?: (event: EventData) => void;
}

// Icon & color config
const eventConfig: Record<string, { icon: string; color: string; bgColor: string; label: string }> = {
  BUYER_MEETING: {
    icon: "solar:users-group-rounded-bold",
    color: "#3b82f6",
    bgColor: "bg-blue-500/10",
    label: "Meeting"
  },
  SITE_VISIT: {
    icon: "solar:home-2-bold",
    color: "#a855f7",
    bgColor: "bg-purple-500/10",
    label: "Site Visit"
  },
  CLOSING: {
    icon: "solar:check-circle-bold",
    color: "#22c55e",
    bgColor: "bg-green-500/10",
    label: "Closing"
  },
  FOLLOW_UP: {
    icon: "solar:phone-calling-bold",
    color: "#eab308",
    bgColor: "bg-yellow-500/10",
    label: "Follow Up"
  },
  OPEN_HOUSE: {
    icon: "solar:buildings-3-bold",
    color: "#ec4899",
    bgColor: "bg-pink-500/10",
    label: "Open House"
  },
  INTERNAL_MEETING: {
    icon: "solar:case-round-bold",
    color: "#6366f1",
    bgColor: "bg-indigo-500/10",
    label: "Internal"
  },
  TRAINING: {
    icon: "solar:book-bold",
    color: "#f97316",
    bgColor: "bg-orange-500/10",
    label: "Training"
  },
  PEMILU: {
    icon: "solar:flag-bold",
    color: "#ef4444",
    bgColor: "bg-red-500/10",
    label: "PEMILU"
  },
  LAINNYA: {
    icon: "solar:star-bold",
    color: "#6b7280",
    bgColor: "bg-gray-500/10",
    label: "Lainnya"
  },
};

// ✅ Helper untuk format date ke YYYY-MM-DD
const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Todo({ events, onEventClick }: TodoProps) {
  const { data: session } = useSession();
  const [currentTime, setCurrentTime] = useState(new Date());

  // ✅ Update current time setiap 30 detik
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // ✅ Check if user can edit event (creator atau OWNER)
  const canEditEvent = (event: EventData): boolean => {
    if (!session?.user) return false;

    const currentAgentId = (session.user as any).agentId;
    const eventCreatorId = event.agent?.id_agent;
    const userRole = (session.user as any).role;

    // OWNER bisa edit semua
    if (userRole === "OWNER") return true;

    // Creator bisa edit eventnya sendiri
    if (currentAgentId && eventCreatorId && currentAgentId === eventCreatorId) {
      return true;
    }

    return false;
  };

  // ✅ CORRECT: Check if join button should be shown for PEMILU
  const canJoinPemilu = (event: EventData): boolean => {
    if (event.tipe_acara !== "PEMILU") return false;

    // Ambil tanggal dan waktu event
    const eventDateStr = event.tanggal_mulai.substring(0, 10);
    const eventTime = event.waktu_mulai || "00:00";
    const [hours, minutes] = eventTime.split(':').map(Number);

    // Buat Date object untuk event start time
    const [year, month, day] = eventDateStr.split('-').map(Number);
    const eventStartTime = new Date(year, month - 1, day, hours, minutes, 0, 0);

    const now = currentTime;

    // ✅ Tombol JOIN muncul selama event BELUM dimulai
    // Hilang begitu event SUDAH dimulai (>= waktu mulai)
    return now < eventStartTime;
  };

  // ✅ Get upcoming 7 days events
  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(today.getDate() + 7);
    sevenDaysLater.setHours(23, 59, 59, 999);

    const filteredEvents = events.filter((event) => {
      const eventDateStr = event.tanggal_mulai.substring(0, 10);
      const eventDate = new Date(eventDateStr + 'T00:00:00');
      
      const todayStr = toLocalDateString(today);
      const sevenDaysStr = toLocalDateString(sevenDaysLater);
      
      return eventDateStr >= todayStr && eventDateStr <= sevenDaysStr;
    });

    // Sort by date
    return filteredEvents.sort((a, b) => {
      return new Date(a.tanggal_mulai).getTime() - new Date(b.tanggal_mulai).getTime();
    });
  }, [events]);

  // ✅ Group events by date
  const groupedEvents = useMemo(() => {
    const groups: Record<string, EventData[]> = {};
    upcomingEvents.forEach((event) => {
      const dateKey = event.tanggal_mulai.substring(0, 10);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
    });
    return groups;
  }, [upcomingEvents]);

  // Format date
  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dateOnly = new Date(year, month - 1, day);
    dateOnly.setHours(0, 0, 0, 0);

    const todayTime = today.getTime();
    const tomorrowTime = tomorrow.getTime();
    const dateTime = dateOnly.getTime();

    if (dateTime === todayTime) return "Hari Ini";
    if (dateTime === tomorrowTime) return "Besok";

    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
  };

  const formatTime = (time?: string) => {
    if (!time) return "";
    return time.substring(0, 5); // HH:MM
  };

  const getRelativeTime = (dateStr: string, timeStr?: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const eventDate = new Date(year, month - 1, day);
    
    if (timeStr) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      eventDate.setHours(hours, minutes, 0, 0);
    }
    
    const now = currentTime;
    const diffMs = eventDate.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffMs < 0) return "Sudah lewat";
    if (diffHours < 1) return "Segera";
    if (diffHours < 24) return `${diffHours}j lagi`;
    if (diffDays === 1) return "Besok";
    return `${diffDays}h lagi`;
  };

  // ✅ Handle join PEMILU
  const handleJoinPemilu = async (event: EventData, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    
    console.log("Join PEMILU:", event);
    window.location.href = `/dashboard/pemilu/${event.id_acara}`;
  };

  const todayCount = upcomingEvents.filter((e) => {
    const today = new Date();
    const todayStr = toLocalDateString(today);
    const eventDateStr = e.tanggal_mulai.substring(0, 10);
    return eventDateStr === todayStr;
  }).length;

  const tomorrowCount = upcomingEvents.filter((e) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = toLocalDateString(tomorrow);
    const eventDateStr = e.tanggal_mulai.substring(0, 10);
    return eventDateStr === tomorrowStr;
  }).length;

  return (
    <div className="flex h-full max-h-[calc(100vh-200px)] flex-col rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-xl shadow-2xl">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/10 bg-white/5 px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30">
              <Icon icon="solar:calendar-mark-bold" className="text-lg text-emerald-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Agenda</h3>
              <p className="text-[10px] text-slate-400">7 hari</p>
            </div>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <span className="text-xs font-bold text-emerald-300">{upcomingEvents.length}</span>
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 custom-scrollbar">
        {Object.keys(groupedEvents).length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-8">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10">
              <Icon icon="solar:inbox-line-bold-duotone" className="text-3xl text-slate-600" />
            </div>
            <p className="text-xs font-semibold text-slate-500">Tidak ada acara</p>
            <p className="text-[10px] text-slate-600">7 hari ke depan kosong</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedEvents).map(([date, dateEvents]) => (
              <div key={date}>
                {/* Date Header */}
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {formatDate(date)}
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-l from-white/10 to-transparent" />
                </div>

                {/* Events for this date */}
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {dateEvents.map((event, idx) => {
                      const config = eventConfig[event.tipe_acara] || eventConfig.LAINNYA;
                      const canEdit = canEditEvent(event);
                      const showJoinButton = canJoinPemilu(event);

                      return (
                        <motion.div
                          key={event.id_acara}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -50 }}
                          transition={{ delay: idx * 0.03 }}
                          className="
                            group relative overflow-hidden
                            rounded-xl bg-gradient-to-br from-white/10 to-white/5
                            border border-white/10
                            transition-all duration-200
                            hover:from-white/15 hover:to-white/10
                            hover:border-white/20
                            hover:shadow-lg hover:shadow-black/10
                          "
                        >
                          {/* 3D Shadow */}
                          <div className="absolute inset-0 bg-gradient-to-b from-white/0 to-black/5 opacity-50" />

                          <div className="relative p-3">
                            <div className="flex items-start gap-2">
                              {/* Icon */}
                              <div
                                className={`
                                  flex h-9 w-9 flex-shrink-0 items-center justify-center
                                  rounded-lg ${config.bgColor} border
                                  shadow-md
                                `}
                                style={{
                                  borderColor: `${config.color}30`,
                                  boxShadow: `0 2px 8px ${config.color}15`,
                                }}
                              >
                                <Icon
                                  icon={config.icon}
                                  className="text-base"
                                  style={{ color: config.color }}
                                />
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                {/* Title */}
                                <h4 className="text-xs font-semibold text-white line-clamp-1 mb-1">
                                  {event.judul_acara}
                                </h4>

                                {/* Meta Info */}
                                <div className="flex flex-col gap-0.5">
                                  {/* Time */}
                                  {event.waktu_mulai && (
                                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                      <Icon icon="solar:clock-circle-bold" className="text-xs" />
                                      <span>
                                        {formatTime(event.waktu_mulai)}
                                        {event.waktu_selesai && ` - ${formatTime(event.waktu_selesai)}`}
                                      </span>
                                    </div>
                                  )}

                                  {/* Location */}
                                  {event.lokasi && (
                                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                      <Icon icon="solar:map-point-bold" className="text-xs" />
                                      <span className="truncate">{event.lokasi}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Right Side: Badge */}
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                {/* Relative Time */}
                                <span className="text-[9px] font-bold text-emerald-400">
                                  {getRelativeTime(event.tanggal_mulai, event.waktu_mulai)}
                                </span>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="mt-2 flex items-center gap-2">
                              {/* ✅ Tombol Join PEMILU (Muncul sampai event dimulai) */}
                              {showJoinButton && (
                                <motion.button
                                  initial={{ scale: 0.8, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  onClick={(e) => handleJoinPemilu(event, e)}
                                  className="
                                    flex-1 flex items-center justify-center gap-1.5
                                    rounded-lg bg-gradient-to-r from-red-500 to-red-600
                                    px-3 py-2 text-xs font-bold text-white
                                    shadow-lg shadow-red-500/50
                                    transition-all duration-200
                                    hover:shadow-xl hover:shadow-red-500/60
                                    hover:scale-105
                                    active:scale-95
                                  "
                                >
                                  <Icon icon="solar:login-3-bold" className="text-sm" />
                                  Join PEMILU
                                </motion.button>
                              )}

                              {/* ✅ Tombol Edit (Owner atau Creator) */}
                              {canEdit && (
                                <button
                                  onClick={() => onEventClick?.(event)}
                                  className={`
                                    flex items-center justify-center gap-1.5
                                    rounded-lg bg-gradient-to-r from-blue-500/20 to-blue-600/10
                                    border border-blue-500/30
                                    text-xs font-semibold text-blue-300
                                    transition-all duration-200
                                    hover:from-blue-500/30 hover:to-blue-600/20
                                    hover:border-blue-500/50
                                    hover:scale-105
                                    active:scale-95
                                    ${showJoinButton 
                                      ? "flex-shrink-0 w-10 h-10 px-0" 
                                      : "flex-1 px-3 py-2"
                                    }
                                  `}
                                >
                                  <Icon icon="solar:pen-bold" className="text-base" />
                                  {!showJoinButton && <span>Edit</span>}
                                </button>
                              )}

                              {/* ✅ Tombol View (Jika tidak bisa edit dan bukan PEMILU yang bisa di-join) */}
                              {!canEdit && !showJoinButton && (
                                <button
                                  onClick={() => onEventClick?.(event)}
                                  className="
                                    flex-1 flex items-center justify-center gap-1.5
                                    rounded-lg bg-gradient-to-r from-slate-500/20 to-slate-600/10
                                    border border-slate-500/30
                                    px-3 py-2 text-xs font-semibold text-slate-300
                                    transition-all duration-200
                                    hover:from-slate-500/30 hover:to-slate-600/20
                                    hover:border-slate-500/50
                                    hover:scale-105
                                    active:scale-95
                                  "
                                >
                                  <Icon icon="solar:eye-bold" className="text-sm" />
                                  Lihat Detail
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Hover Shine */}
                          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="flex-shrink-0 border-t border-white/10 bg-white/5 px-4 py-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <p className="text-[9px] text-slate-500 mb-0.5">Total</p>
            <p className="text-sm font-bold text-white">{upcomingEvents.length}</p>
          </div>
          <div className="text-center border-x border-white/10">
            <p className="text-[9px] text-slate-500 mb-0.5">Hari Ini</p>
            <p className="text-sm font-bold text-emerald-300">{todayCount}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-slate-500 mb-0.5">Besok</p>
            <p className="text-sm font-bold text-blue-300">{tomorrowCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

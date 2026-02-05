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

const eventConfig: Record<
  string,
  { icon: string; color: string; bgColor: string; label: string }
> = {
  BUYER_MEETING: {
    icon: "solar:users-group-rounded-bold",
    color: "#3b82f6",
    bgColor: "bg-blue-500/10",
    label: "Meeting",
  },
  SITE_VISIT: {
    icon: "solar:home-2-bold",
    color: "#a855f7",
    bgColor: "bg-purple-500/10",
    label: "Site Visit",
  },
  CLOSING: {
    icon: "solar:check-circle-bold",
    color: "#22c55e",
    bgColor: "bg-green-500/10",
    label: "Closing",
  },
  FOLLOW_UP: {
    icon: "solar:phone-calling-bold",
    color: "#eab308",
    bgColor: "bg-yellow-500/10",
    label: "Follow Up",
  },
  OPEN_HOUSE: {
    icon: "solar:buildings-3-bold",
    color: "#ec4899",
    bgColor: "bg-pink-500/10",
    label: "Open House",
  },
  INTERNAL_MEETING: {
    icon: "solar:case-round-bold",
    color: "#6366f1",
    bgColor: "bg-indigo-500/10",
    label: "Internal",
  },
  TRAINING: {
    icon: "solar:book-bold",
    color: "#f97316",
    bgColor: "bg-orange-500/10",
    label: "Training",
  },
  PEMILU: {
    icon: "solar:flag-bold",
    color: "#ef4444",
    bgColor: "bg-red-500/10",
    label: "PEMILU",
  },
  LAINNYA: {
    icon: "solar:star-bold",
    color: "#6b7280",
    bgColor: "bg-gray-500/10",
    label: "Lainnya",
  },
};

const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatTimeFromDateTime = (dateTimeStr?: string) => {
  if (!dateTimeStr) return "";
  const d = new Date(dateTimeStr);
  if (Number.isNaN(d.getTime())) return "";
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
};

export default function Todo({ events, onEventClick }: TodoProps) {
  const { data: session } = useSession();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [registeredEvents, setRegisteredEvents] = useState<Set<string>>(new Set());
  const [loadingRegistrations, setLoadingRegistrations] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch apakah user sudah terdaftar di PEMILU-PEMILU yang ada
  useEffect(() => {
    const fetchRegistrations = async () => {
      if (!session?.user) {
        setLoadingRegistrations(false);
        return;
      }

      const pemiluEvents = events.filter((e) => e.tipe_acara === "PEMILU");
      if (pemiluEvents.length === 0) {
        setLoadingRegistrations(false);
        return;
      }

      try {
        // Hit API untuk cek status registrasi semua pemilu
        const checks = await Promise.all(
          pemiluEvents.map(async (event) => {
            try {
              const res = await fetch(`/api/pemilu/${event.id_acara}/check-registration`);
              if (!res.ok) return { id_acara: event.id_acara, registered: false };
              const data = await res.json();
              return { id_acara: event.id_acara, registered: data.registered || false };
            } catch {
              return { id_acara: event.id_acara, registered: false };
            }
          })
        );

        const registeredSet = new Set<string>();
        checks.forEach((c) => {
          if (c.registered) registeredSet.add(c.id_acara);
        });

        setRegisteredEvents(registeredSet);
      } catch (error) {
        console.error("Error fetching registrations:", error);
      } finally {
        setLoadingRegistrations(false);
      }
    };

    fetchRegistrations();
  }, [events, session]);

  const canEditEvent = (event: EventData): boolean => {
    if (!session?.user) return false;
    const currentAgentId = (session.user as any).agentId;
    const eventCreatorId = event.agent?.id_agent;
    const userRole = (session.user as any).role;
    if (userRole === "OWNER") return true;
    if (currentAgentId && eventCreatorId && currentAgentId === eventCreatorId) {
      return true;
    }
    return false;
  };

  const canAccessPemilu = (event: EventData): boolean => {
    if (event.tipe_acara !== "PEMILU") return false;

    const eventStart = new Date(event.tanggal_mulai);
    const eventEnd = new Date(event.tanggal_selesai);
    const now = currentTime;

    const isRegistered = registeredEvents.has(event.id_acara);

    // Sebelum event mulai: siapa saja bisa join (daftar)
    if (now < eventStart) return true;

    // Setelah event mulai sampai selesai: hanya yang sudah terdaftar bisa masuk
    if (now >= eventStart && now <= eventEnd) {
      return isRegistered;
    }

    // Setelah event selesai: tidak bisa akses lagi
    return false;
  };

  const getPemiluButtonLabel = (event: EventData): string => {
    const eventStart = new Date(event.tanggal_mulai);
    const now = currentTime;
    const isRegistered = registeredEvents.has(event.id_acara);

    if (now < eventStart) {
      return isRegistered ? "Masuk PEMILU" : "Join PEMILU";
    }

    // Setelah mulai, hanya yang registered bisa masuk
    return "Masuk PEMILU";
  };

  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(today.getDate() + 7);
    sevenDaysLater.setHours(23, 59, 59, 999);

    const todayStr = toLocalDateString(today);
    const sevenDaysStr = toLocalDateString(sevenDaysLater);

    const filteredEvents = events.filter((event) => {
      const eventDateStr = event.tanggal_mulai.substring(0, 10);
      return eventDateStr >= todayStr && eventDateStr <= sevenDaysStr;
    });

    return filteredEvents.sort(
      (a, b) =>
        new Date(a.tanggal_mulai).getTime() -
        new Date(b.tanggal_mulai).getTime()
    );
  }, [events]);

  const groupedEvents = useMemo(() => {
    const groups: Record<string, EventData[]> = {};
    upcomingEvents.forEach((event) => {
      const dateKey = event.tanggal_mulai.substring(0, 10);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(event);
    });
    return groups;
  }, [upcomingEvents]);

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-").map(Number);
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

  const getRelativeTime = (dateTimeStr: string) => {
    const eventDate = new Date(dateTimeStr);
    if (Number.isNaN(eventDate.getTime())) return "";
    const now = currentTime;
    const diffMs = eventDate.getTime() - now.getTime();
    if (diffMs < 0) return "Berlangsung";

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Segera";
    if (diffHours < 24) return `${diffHours}j lagi`;
    if (diffDays === 1) return "Besok";
    return `${diffDays}h lagi`;
  };

  const handleJoinPemilu = async (event: EventData, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!session?.user) {
      alert("Silakan login terlebih dahulu.");
      return;
    }

    const idAcaraNum = Number(event.id_acara);
    if (Number.isNaN(idAcaraNum)) {
      console.error("id_acara bukan number:", event.id_acara);
      alert("ID acara tidak valid.");
      return;
    }

    const isRegistered = registeredEvents.has(event.id_acara);
    const eventStart = new Date(event.tanggal_mulai);
    const now = currentTime;

    // Kalau sudah registered, langsung redirect (tidak perlu hit API join lagi)
    if (isRegistered || now >= eventStart) {
      window.location.href = `/dashboard/pemilu/${event.id_acara}`;
      return;
    }

    // Kalau belum registered dan masih sebelum event mulai, hit API join
    try {
      setJoiningId(event.id_acara);

      const response = await fetch(`/api/pemilu/${idAcaraNum}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Gagal join PEMILU");
      }

      // Update state registered
      setRegisteredEvents((prev) => new Set(prev).add(event.id_acara));

      // Redirect
      window.location.href = `/dashboard/pemilu/${event.id_acara}`;
    } catch (err: any) {
      console.error("Error join PEMILU:", err);
      alert(`Gagal join PEMILU: ${err.message}`);
      setJoiningId(null);
    }
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
            <span className="text-xs font-bold text-emerald-300">
              {upcomingEvents.length}
            </span>
          </div>
        </div>
      </div>

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
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {formatDate(date)}
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-l from-white/10 to-transparent" />
                </div>

                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {dateEvents.map((event, idx) => {
                      const config = eventConfig[event.tipe_acara] || eventConfig.LAINNYA;
                      const canEdit = canEditEvent(event);
                      const showPemiluButton = canAccessPemilu(event);
                      const isJoining = joiningId === event.id_acara;
                      const pemiluLabel = getPemiluButtonLabel(event);

                      return (
                        <motion.div
                          key={event.id_acara}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -50 }}
                          transition={{ delay: idx * 0.03 }}
                          className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 transition-all duration-200 hover:from-white/15 hover:to-white/10 hover:border-white/20 hover:shadow-lg hover:shadow-black/10"
                        >
                          <div className="absolute inset-0 bg-gradient-to-b from-white/0 to-black/5 opacity-50" />

                          <div className="relative p-3">
                            <div className="flex items-start gap-2">
                              <div
                                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${config.bgColor} border shadow-md`}
                                style={{
                                  borderColor: `${config.color}30`,
                                  boxShadow: `0 2px 8px ${config.color}15`,
                                }}
                              >
                                <Icon icon={config.icon} className="text-base" style={{ color: config.color }} />
                              </div>

                              <div className="flex-1 min-w-0">
                                <h4 className="mb-1 line-clamp-1 text-xs font-semibold text-white">
                                  {event.judul_acara}
                                </h4>

                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                    <Icon icon="solar:clock-circle-bold" className="text-xs" />
                                    <span>
                                      {formatTimeFromDateTime(event.tanggal_mulai)}
                                      {event.tanggal_selesai && ` - ${formatTimeFromDateTime(event.tanggal_selesai)}`}
                                    </span>
                                  </div>

                                  {event.lokasi && (
                                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                      <Icon icon="solar:map-point-bold" className="text-xs" />
                                      <span className="truncate">{event.lokasi}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <span className="text-[9px] font-bold text-emerald-400">
                                  {getRelativeTime(event.tanggal_mulai)}
                                </span>
                              </div>
                            </div>

                            <div className="mt-2 flex items-center gap-2">
                              {showPemiluButton && (
                                <motion.button
                                  initial={{ scale: 0.8, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  onClick={(e) => handleJoinPemilu(event, e)}
                                  disabled={isJoining || loadingRegistrations}
                                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-red-500 to-red-600 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-red-500/50 transition-all duration-200 hover:shadow-xl hover:shadow-red-500/60 hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                  <Icon
                                    icon={isJoining ? "solar:loading-3-bold" : "solar:login-3-bold"}
                                    className={`text-sm ${isJoining ? "animate-spin" : ""}`}
                                  />
                                  {isJoining ? "Loading..." : pemiluLabel}
                                </motion.button>
                              )}

                              {canEdit && (
                                <button
                                  onClick={() => onEventClick?.(event)}
                                  className={`flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-500/20 to-blue-600/10 border border-blue-500/30 text-xs font-semibold text-blue-300 transition-all duration-200 hover:from-blue-500/30 hover:to-blue-600/20 hover:border-blue-500/50 hover:scale-105 active:scale-95 ${
                                    showPemiluButton ? "flex-shrink-0 w-10 h-10 px-0" : "flex-1 px-3 py-2"
                                  }`}
                                >
                                  <Icon icon="solar:pen-bold" className="text-base" />
                                  {!showPemiluButton && <span>Edit</span>}
                                </button>
                              )}

                              {!canEdit && !showPemiluButton && (
                                <button
                                  onClick={() => onEventClick?.(event)}
                                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-slate-500/20 to-slate-600/10 border border-slate-500/30 px-3 py-2 text-xs font-semibold text-slate-300 transition-all duration-200 hover:from-slate-500/30 hover:to-slate-600/20 hover:border-slate-500/50 hover:scale-105 active:scale-95"
                                >
                                  <Icon icon="solar:eye-bold" className="text-sm" />
                                  Lihat Detail
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 transition-opacity group-hover:opacity-100" />
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

      <div className="flex-shrink-0 border-t border-white/10 bg-white/5 px-4 py-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <p className="mb-0.5 text-[9px] text-slate-500">Total</p>
            <p className="text-sm font-bold text-white">{upcomingEvents.length}</p>
          </div>
          <div className="text-center border-x border-white/10">
            <p className="mb-0.5 text-[9px] text-slate-500">Hari Ini</p>
            <p className="text-sm font-bold text-emerald-300">{todayCount}</p>
          </div>
          <div className="text-center">
            <p className="mb-0.5 text-[9px] text-slate-500">Besok</p>
            <p className="text-sm font-bold text-blue-300">{tomorrowCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

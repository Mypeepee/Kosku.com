"use client";

import { useState, useEffect, useMemo } from "react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";

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
    label: "Meeting Buyer"
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
    label: "Meeting Internal"
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
    label: "Event PEMILU"
  },
  LAINNYA: {
    icon: "solar:star-bold",
    color: "#6b7280",
    bgColor: "bg-gray-500/10",
    label: "Lainnya"
  },
};

export default function Todo({ events, onEventClick }: TodoProps) {
  const [filter, setFilter] = useState<"all" | "today" | "upcoming">("upcoming");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Get upcoming 7 days events
  const upcomingEvents = useMemo(() => {
    const today = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(today.getDate() + 7);

    let filteredEvents = events.filter((event) => {
      const eventDate = new Date(event.tanggal_mulai);
      return eventDate >= today && eventDate <= sevenDaysLater;
    });

    // Apply filter
    if (filter === "today") {
      const todayStr = today.toISOString().split("T")[0];
      filteredEvents = filteredEvents.filter((event) => {
        const eventStart = new Date(event.tanggal_mulai).toISOString().split("T")[0];
        return eventStart === todayStr;
      });
    }

    // Sort by date
    return filteredEvents.sort((a, b) => {
      return new Date(a.tanggal_mulai).getTime() - new Date(b.tanggal_mulai).getTime();
    });
  }, [events, filter]);

  // Group events by date
  const groupedEvents = useMemo(() => {
    const groups: Record<string, EventData[]> = {};
    upcomingEvents.forEach((event) => {
      const dateKey = new Date(event.tanggal_mulai).toISOString().split("T")[0];
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
    });
    return groups;
  }, [upcomingEvents]);

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const dateOnly = date.toISOString().split("T")[0];
    const todayOnly = today.toISOString().split("T")[0];
    const tomorrowOnly = tomorrow.toISOString().split("T")[0];

    if (dateOnly === todayOnly) return "Hari Ini";
    if (dateOnly === tomorrowOnly) return "Besok";

    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
  };

  const formatTime = (time?: string) => {
    if (!time) return "";
    return time.substring(0, 5); // HH:MM
  };

  const getRelativeTime = (dateStr: string) => {
    const eventDate = new Date(dateStr);
    const now = new Date();
    const diffMs = eventDate.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Segera dimulai";
    if (diffHours < 24) return `${diffHours} jam lagi`;
    if (diffDays === 1) return "Besok";
    return `${diffDays} hari lagi`;
  };

  return (
    <div className="flex h-full flex-col rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-xl shadow-2xl">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/5 px-6 py-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30">
              <Icon icon="solar:calendar-mark-bold" className="text-xl text-emerald-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Agenda Mendatang</h3>
              <p className="text-xs text-slate-400">7 hari ke depan</p>
            </div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <span className="text-sm font-bold text-emerald-300">{upcomingEvents.length}</span>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 rounded-xl bg-white/5 p-1.5 border border-white/10">
          {[
            { value: "all", label: "Semua", icon: "solar:list-bold" },
            { value: "today", label: "Hari Ini", icon: "solar:calendar-bold" },
            { value: "upcoming", label: "Mendatang", icon: "solar:clock-circle-bold" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value as any)}
              className={`
                flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2
                text-xs font-semibold transition-all duration-200
                ${
                  filter === tab.value
                    ? "bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 text-emerald-300 shadow-lg shadow-emerald-500/20"
                    : "text-slate-400 hover:text-slate-300 hover:bg-white/5"
                }
              `}
            >
              <Icon icon={tab.icon} className="text-base" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
        {Object.keys(groupedEvents).length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-12">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10">
              <Icon icon="solar:inbox-line-bold-duotone" className="text-4xl text-slate-600" />
            </div>
            <p className="text-sm font-semibold text-slate-500">Tidak ada acara</p>
            <p className="text-xs text-slate-600">Belum ada acara untuk 7 hari ke depan</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedEvents).map(([date, dateEvents]) => (
              <div key={date}>
                {/* Date Header */}
                <div className="mb-3 flex items-center gap-2 px-2">
                  <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {formatDate(date)}
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-l from-white/10 to-transparent" />
                </div>

                {/* Events for this date */}
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {dateEvents.map((event, idx) => {
                      const config = eventConfig[event.tipe_acara] || eventConfig.LAINNYA;
                      return (
                        <motion.button
                          key={event.id_acara}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -100 }}
                          transition={{ delay: idx * 0.05 }}
                          onClick={() => onEventClick?.(event)}
                          className="
                            group relative w-full overflow-hidden
                            rounded-2xl bg-gradient-to-br from-white/10 to-white/5
                            border border-white/10 p-4
                            transition-all duration-300
                            hover:from-white/15 hover:to-white/10
                            hover:border-white/20
                            hover:shadow-xl hover:shadow-black/20
                            hover:-translate-y-1
                            active:scale-[0.98]
                          "
                        >
                          {/* 3D Shadow */}
                          <div className="absolute inset-0 bg-gradient-to-b from-white/0 to-black/10 opacity-50" />

                          <div className="relative flex items-start gap-3">
                            {/* Icon */}
                            <div
                              className={`
                                flex h-11 w-11 flex-shrink-0 items-center justify-center
                                rounded-xl ${config.bgColor} border
                                shadow-lg
                              `}
                              style={{
                                borderColor: `${config.color}40`,
                                boxShadow: `0 4px 12px ${config.color}20`,
                              }}
                            >
                              <Icon
                                icon={config.icon}
                                className="text-xl"
                                style={{ color: config.color }}
                              />
                            </div>

                            {/* Content */}
                            <div className="flex-1 text-left">
                              {/* Title */}
                              <h4 className="mb-1 font-semibold text-white line-clamp-1 group-hover:text-emerald-300 transition-colors">
                                {event.judul_acara}
                              </h4>

                              {/* Meta Info */}
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                {/* Time */}
                                {event.waktu_mulai && (
                                  <div className="flex items-center gap-1">
                                    <Icon icon="solar:clock-circle-bold" className="text-sm" />
                                    <span>
                                      {formatTime(event.waktu_mulai)}
                                      {event.waktu_selesai && ` - ${formatTime(event.waktu_selesai)}`}
                                    </span>
                                  </div>
                                )}

                                {/* Location */}
                                {event.lokasi && (
                                  <>
                                    <span className="text-slate-600">•</span>
                                    <div className="flex items-center gap-1">
                                      <Icon icon="solar:map-point-bold" className="text-sm" />
                                      <span className="line-clamp-1">{event.lokasi}</span>
                                    </div>
                                  </>
                                )}
                              </div>

                              {/* Description */}
                              {event.deskripsi && (
                                <p className="mt-2 text-xs text-slate-500 line-clamp-2">
                                  {event.deskripsi}
                                </p>
                              )}
                            </div>

                            {/* Badge */}
                            <div className="flex flex-col items-end gap-2">
                              {/* Type Badge */}
                              <span
                                className="rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
                                style={{
                                  backgroundColor: `${config.color}15`,
                                  color: config.color,
                                }}
                              >
                                {config.label}
                              </span>

                              {/* Relative Time */}
                              <span className="text-[10px] font-semibold text-emerald-400">
                                {getRelativeTime(event.tanggal_mulai)}
                              </span>
                            </div>
                          </div>

                          {/* Hover Shine */}
                          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 transition-opacity group-hover:opacity-100" />

                          {/* Arrow Icon */}
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0 translate-x-2">
                            <Icon icon="solar:alt-arrow-right-bold" className="text-emerald-400" />
                          </div>
                        </motion.button>
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
      <div className="border-t border-white/10 bg-white/5 px-6 py-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xs text-slate-500 mb-1">Total</p>
            <p className="text-lg font-bold text-white">{upcomingEvents.length}</p>
          </div>
          <div className="text-center border-x border-white/10">
            <p className="text-xs text-slate-500 mb-1">Hari Ini</p>
            <p className="text-lg font-bold text-emerald-300">
              {upcomingEvents.filter((e) => {
                const today = new Date().toISOString().split("T")[0];
                const eventDate = new Date(e.tanggal_mulai).toISOString().split("T")[0];
                return eventDate === today;
              }).length}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500 mb-1">Besok</p>
            <p className="text-lg font-bold text-blue-300">
              {upcomingEvents.filter((e) => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowStr = tomorrow.toISOString().split("T")[0];
                const eventDate = new Date(e.tanggal_mulai).toISOString().split("T")[0];
                return eventDate === tomorrowStr;
              }).length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

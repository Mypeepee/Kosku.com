"use client";

import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";

interface HolidayData {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  counties: string[] | null;
  launchYear: number | null;
  types: string[];
}

interface EventData {
  id_acara: string;
  judul_acara: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  tipe_acara: string;
}

interface KalendarProps {
  currentDate: Date;
  events: EventData[];
  onDateClick: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onAddEvent: () => void;
}

const monthNames = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

// Icon mapping untuk setiap tipe acara
const eventIcons: Record<string, { icon: string; color: string; gradient: string }> = {
  BUYER_MEETING: {
    icon: "solar:users-group-rounded-bold",
    color: "#3b82f6",
    gradient: "from-blue-500 to-blue-600"
  },
  SITE_VISIT: {
    icon: "solar:home-2-bold",
    color: "#a855f7",
    gradient: "from-purple-500 to-purple-600"
  },
  CLOSING: {
    icon: "solar:check-circle-bold",
    color: "#22c55e",
    gradient: "from-green-500 to-green-600"
  },
  FOLLOW_UP: {
    icon: "solar:phone-calling-bold",
    color: "#eab308",
    gradient: "from-yellow-500 to-yellow-600"
  },
  OPEN_HOUSE: {
    icon: "solar:buildings-3-bold",
    color: "#ec4899",
    gradient: "from-pink-500 to-pink-600"
  },
  INTERNAL_MEETING: {
    icon: "solar:case-round-bold",
    color: "#6366f1",
    gradient: "from-indigo-500 to-indigo-600"
  },
  TRAINING: {
    icon: "solar:book-bold",
    color: "#f97316",
    gradient: "from-orange-500 to-orange-600"
  },
  PEMILU: {
    icon: "solar:flag-bold",
    color: "#ef4444",
    gradient: "from-red-500 to-red-600"
  },
  LAINNYA: {
    icon: "solar:star-bold",
    color: "#6b7280",
    gradient: "from-gray-500 to-gray-600"
  },
};

export default function Kalendar({
  currentDate,
  events,
  onDateClick,
  onPrevMonth,
  onNextMonth,
  onToday,
  onAddEvent,
}: KalendarProps) {
  const [holidays, setHolidays] = useState<HolidayData[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch holidays from Nager.Date API (Accurate & Free)
  useEffect(() => {
    const fetchHolidays = async () => {
      setLoading(true);
      try {
        const year = currentDate.getFullYear();
        
        console.log(`Fetching holidays for ${year}...`);
        
        // Use Nager.Date API - More accurate and reliable
        const response = await fetch(
          `https://date.nager.at/api/v3/PublicHolidays/${year}/ID`,
          {
            headers: {
              'Accept': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Holidays data:', data);
        
        setHolidays(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error fetching holidays:", error);
        setHolidays([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHolidays();
  }, [currentDate]);

  // Generate calendar days
  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Actual days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const isWeekend = (date: Date | null) => {
    if (!date) return false;
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const isHoliday = (date: Date | null) => {
    if (!date) return false;
    const dateStr = date.toISOString().split("T")[0];
    return holidays.some((h) => h.date === dateStr);
  };

  const getHolidayName = (date: Date | null) => {
    if (!date) return null;
    const dateStr = date.toISOString().split("T")[0];
    const holiday = holidays.find((h) => h.date === dateStr);
    return holiday?.localName || holiday?.name;
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const getEventsForDate = (date: Date | null) => {
    if (!date) return [];
    const dateStr = date.toISOString().split("T")[0];

    return events.filter((event) => {
      const eventStart = new Date(event.tanggal_mulai).toISOString().split("T")[0];
      const eventEnd = new Date(event.tanggal_selesai).toISOString().split("T")[0];
      return dateStr >= eventStart && dateStr <= eventEnd;
    });
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Navigation Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={onPrevMonth}
            className="
              group flex h-11 w-11 items-center justify-center
              rounded-xl bg-gradient-to-br from-white/10 to-white/5
              border border-white/10 backdrop-blur-sm
              text-slate-300 transition-all duration-300
              hover:from-emerald-500/20 hover:to-emerald-600/10
              hover:border-emerald-500/50 hover:text-emerald-300
              hover:shadow-lg hover:shadow-emerald-500/20
              active:scale-95
            "
          >
            <Icon icon="solar:alt-arrow-left-bold" className="text-xl" />
          </button>

          <button
            onClick={onToday}
            className="
              rounded-xl bg-gradient-to-br from-white/10 to-white/5
              border border-white/10 backdrop-blur-sm
              px-5 py-2.5 text-sm font-semibold text-slate-300
              transition-all duration-300
              hover:from-emerald-500/20 hover:to-emerald-600/10
              hover:border-emerald-500/50 hover:text-emerald-300
              hover:shadow-lg hover:shadow-emerald-500/20
              active:scale-95
            "
          >
            Hari Ini
          </button>

          <button
            onClick={onNextMonth}
            className="
              group flex h-11 w-11 items-center justify-center
              rounded-xl bg-gradient-to-br from-white/10 to-white/5
              border border-white/10 backdrop-blur-sm
              text-slate-300 transition-all duration-300
              hover:from-emerald-500/20 hover:to-emerald-600/10
              hover:border-emerald-500/50 hover:text-emerald-300
              hover:shadow-lg hover:shadow-emerald-500/20
              active:scale-95
            "
          >
            <Icon icon="solar:alt-arrow-right-bold" className="text-xl" />
          </button>
        </div>

        {/* Month/Year Display + Add Button */}
        <div className="flex items-center gap-4">
          <div className="text-2xl font-bold text-white">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </div>

          {/* Button Tambah Acara */}
          <button
            onClick={onAddEvent}
            className="
              group relative overflow-hidden
              rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600
              px-4 py-2.5 text-sm font-semibold text-white
              shadow-lg shadow-emerald-500/50
              transition-all duration-300
              hover:shadow-xl hover:shadow-emerald-500/60
              hover:scale-105
              active:scale-95
            "
          >
            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex items-center gap-2">
              <Icon icon="solar:add-circle-bold" className="text-lg" />
              <span className="hidden sm:inline">Tambah Acara</span>
              <span className="sm:hidden">Tambah</span>
            </div>
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 p-6 backdrop-blur-xl shadow-2xl relative">
        {/* Day Headers */}
        <div className="mb-4 grid grid-cols-7 gap-3">
          {dayNames.map((day, idx) => (
            <div
              key={day}
              className={`
                py-3 text-center text-xs font-bold uppercase tracking-widest
                ${idx === 0 || idx === 6 ? "text-red-400" : "text-slate-400"}
              `}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-3">
          {getDaysInMonth().map((date, idx) => {
            const isCurrentDay = isToday(date);
            const isWeekendDay = isWeekend(date);
            const isHolidayDay = isHoliday(date);
            const holidayName = getHolidayName(date);
            const dayEvents = getEventsForDate(date);

            return (
              <motion.button
                key={idx}
                onClick={() => date && onDateClick(date)}
                whileHover={date ? { scale: 1.05, y: -2 } : {}}
                whileTap={date ? { scale: 0.95 } : {}}
                disabled={!date}
                className={`
                  group relative aspect-square rounded-2xl
                  transition-all duration-300
                  ${!date ? "cursor-default opacity-0" : ""}
                  ${
                    isCurrentDay
                      ? `
                        bg-gradient-to-br from-emerald-500/30 to-emerald-600/20
                        border-2 border-emerald-400/60
                        shadow-lg shadow-emerald-500/30
                      `
                      : isHolidayDay
                      ? `
                        bg-gradient-to-br from-red-500/20 to-red-600/10
                        border border-red-400/40
                        hover:border-red-400/60
                        hover:shadow-lg hover:shadow-red-500/20
                      `
                      : `
                        bg-gradient-to-br from-white/10 to-white/5
                        border border-white/10
                        hover:from-white/20 hover:to-white/10
                        hover:border-white/20
                        hover:shadow-xl hover:shadow-black/20
                      `
                  }
                `}
              >
                {date && (
                  <>
                    {/* 3D Shadow Effect */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/0 to-black/10 opacity-50" />

                    {/* Date Number */}
                    <div className="absolute top-2 left-2 z-10">
                      <span
                        className={`
                          text-sm font-bold drop-shadow-lg
                          ${isCurrentDay ? "text-emerald-300" : ""}
                          ${isWeekendDay || isHolidayDay ? "text-red-400" : "text-slate-200"}
                        `}
                      >
                        {date.getDate()}
                      </span>
                    </div>

                    {/* Holiday Flag Indicator */}
                    {isHolidayDay && (
                      <div className="absolute top-2 right-2 z-10">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/30 backdrop-blur-sm">
                          <Icon
                            icon="solar:flag-bold"
                            className="text-xs text-red-300 drop-shadow-lg"
                          />
                        </div>
                      </div>
                    )}

                    {/* Holiday Name Text - Positioned in Middle */}
                    {isHolidayDay && holidayName && (
                      <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 z-10 text-center">
                        <p className="text-[9px] font-bold text-red-300 leading-tight line-clamp-2 drop-shadow-lg">
                          {holidayName}
                        </p>
                      </div>
                    )}

                    {/* Event Icons - Show up to 2 */}
                    {dayEvents.length > 0 && (
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex gap-1">
                        {dayEvents.slice(0, 2).map((event) => {
                          const eventConfig = eventIcons[event.tipe_acara] || eventIcons.LAINNYA;
                          return (
                            <div
                              key={event.id_acara}
                              className={`
                                flex h-6 w-6 items-center justify-center
                                rounded-lg bg-gradient-to-br ${eventConfig.gradient}
                                shadow-lg backdrop-blur-sm
                                transform transition-transform
                                group-hover:scale-110
                              `}
                              style={{
                                boxShadow: `0 2px 8px ${eventConfig.color}40`,
                              }}
                            >
                              <Icon
                                icon={eventConfig.icon}
                                className="text-xs text-white drop-shadow-md"
                              />
                            </div>
                          );
                        })}
                        {dayEvents.length > 2 && (
                          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 shadow-lg">
                            <span className="text-[10px] font-bold text-white">
                              +{dayEvents.length - 2}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tooltip on Hover - FIXED Z-INDEX */}
                    {(holidayName || dayEvents.length > 0) && (
                      <div
                        className="
                          pointer-events-none absolute -top-24 left-1/2 z-[9999]
                          -translate-x-1/2 whitespace-nowrap
                          rounded-xl bg-gradient-to-br from-slate-900 to-slate-800
                          border border-white/10 px-4 py-2.5
                          opacity-0 shadow-2xl transition-all duration-200
                          group-hover:opacity-100 group-hover:-top-28
                          max-w-xs backdrop-blur-xl
                        "
                        style={{ zIndex: 9999 }}
                      >
                        {holidayName && (
                          <div className="mb-1.5 flex items-center gap-2">
                            <Icon icon="solar:flag-bold" className="text-sm text-red-400" />
                            <span className="text-xs font-semibold text-red-300">
                              {holidayName}
                            </span>
                          </div>
                        )}
                        {dayEvents.slice(0, 3).map((event) => {
                          const eventConfig = eventIcons[event.tipe_acara] || eventIcons.LAINNYA;
                          return (
                            <div key={event.id_acara} className="flex items-center gap-2 py-0.5">
                              <Icon
                                icon={eventConfig.icon}
                                className="text-sm"
                                style={{ color: eventConfig.color }}
                              />
                              <span className="text-xs text-slate-300">
                                {event.judul_acara}
                              </span>
                            </div>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <div className="mt-1 text-xs text-slate-400">
                            +{dayEvents.length - 3} acara lainnya
                          </div>
                        )}
                        {/* Tooltip Arrow */}
                        <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-gradient-to-br from-slate-900 to-slate-800 border-r border-b border-white/10" />
                      </div>
                    )}

                    {/* Shine Effect on Hover */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 transition-opacity group-hover:opacity-100" />
                  </>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-3xl z-30">
            <Icon icon="solar:settings-linear" className="text-4xl text-emerald-400 animate-spin" />
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 p-4 backdrop-blur-xl">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-lg border-2 border-emerald-400 bg-emerald-500/20 shadow-lg shadow-emerald-500/20" />
            <span className="text-xs text-slate-400">Hari Ini</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-4 w-4 items-center justify-center rounded-lg bg-red-400 shadow-lg">
              <Icon icon="solar:flag-bold" className="text-[8px] text-white" />
            </div>
            <span className="text-xs text-slate-400">Hari Libur</span>
          </div>
          {Object.entries(eventIcons).slice(0, 3).map(([key, config]) => (
            <div key={key} className="flex items-center gap-2">
              <div className={`flex h-4 w-4 items-center justify-center rounded-lg bg-gradient-to-br ${config.gradient} shadow-lg`}>
                <Icon icon={config.icon} className="text-[8px] text-white" />
              </div>
              <span className="text-xs text-slate-400 capitalize">
                {key.replace("_", " ").toLowerCase()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

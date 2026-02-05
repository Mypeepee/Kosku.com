"use client";

import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";

interface HolidayData {
  tanggal: string;
  tanggal_display: string;
  keterangan: string;
  is_cuti: boolean;
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

const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showMobileInfo, setShowMobileInfo] = useState(false);

  useEffect(() => {
    const fetchHolidays = async () => {
      setLoading(true);
      try {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        const response = await fetch(
          `https://dayoffapi.vercel.app/api?month=${month}&year=${year}`,
          { headers: { 'Accept': 'application/json' } }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
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

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

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
    const dateStr = toLocalDateString(date);
    return holidays.some((h) => h.tanggal === dateStr);
  };

  const getHolidayName = (date: Date | null) => {
    if (!date) return null;
    const dateStr = toLocalDateString(date);
    const holiday = holidays.find((h) => h.tanggal === dateStr);
    return holiday?.keterangan;
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
    
    const dateStr = toLocalDateString(date);

    return events.filter((event) => {
      const eventStart = event.tanggal_mulai.substring(0, 10);
      const eventEnd = event.tanggal_selesai.substring(0, 10);
      
      return dateStr >= eventStart && dateStr <= eventEnd;
    });
  };

  const handleDateClick = (date: Date) => {
    const holidayName = getHolidayName(date);
    const dayEvents = getEventsForDate(date);
    
    // Mobile: Show info modal if there's holiday or events
    if (window.innerWidth < 768 && (holidayName || dayEvents.length > 0)) {
      setSelectedDate(date);
      setShowMobileInfo(true);
    } else {
      // Desktop or no info: trigger parent callback
      onDateClick(date);
    }
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between gap-2">
        {/* Navigation Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevMonth}
            className="
              group flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center
              rounded-xl bg-gradient-to-br from-white/10 to-white/5
              border border-white/10 backdrop-blur-sm
              text-slate-300 transition-all duration-300
              hover:from-emerald-500/20 hover:to-emerald-600/10
              hover:border-emerald-500/50 hover:text-emerald-300
              hover:shadow-lg hover:shadow-emerald-500/20
              active:scale-95
            "
          >
            <Icon icon="solar:alt-arrow-left-bold" className="text-lg sm:text-xl" />
          </button>

          <button
            onClick={onToday}
            className="
              rounded-xl bg-gradient-to-br from-white/10 to-white/5
              border border-white/10 backdrop-blur-sm
              px-3 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold text-slate-300
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
              group flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center
              rounded-xl bg-gradient-to-br from-white/10 to-white/5
              border border-white/10 backdrop-blur-sm
              text-slate-300 transition-all duration-300
              hover:from-emerald-500/20 hover:to-emerald-600/10
              hover:border-emerald-500/50 hover:text-emerald-300
              hover:shadow-lg hover:shadow-emerald-500/20
              active:scale-95
            "
          >
            <Icon icon="solar:alt-arrow-right-bold" className="text-lg sm:text-xl" />
          </button>
        </div>

        {/* Month/Year Display + Add Button */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="text-base sm:text-2xl font-bold text-white whitespace-nowrap">
            {monthNames[currentDate.getMonth()].substring(0, 3)} {currentDate.getFullYear()}
          </div>

          <button
            onClick={onAddEvent}
            className="
              group relative overflow-hidden
              rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600
              px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-semibold text-white
              shadow-lg shadow-emerald-500/50
              transition-all duration-300
              hover:shadow-xl hover:shadow-emerald-500/60
              hover:scale-105
              active:scale-95
            "
          >
            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex items-center gap-1.5 sm:gap-2">
              <Icon icon="solar:add-circle-bold" className="text-base sm:text-lg" />
              <span className="hidden sm:inline">Tambah</span>
              <span className="sm:hidden">+</span>
            </div>
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 p-2 sm:p-6 backdrop-blur-xl shadow-2xl relative isolate">
        {/* Day Headers */}
        <div className="mb-2 sm:mb-4 grid grid-cols-7 gap-1 sm:gap-3">
          {dayNames.map((day, idx) => (
            <div
              key={day}
              className={`
                py-1.5 sm:py-3 text-center text-[9px] sm:text-xs font-bold uppercase tracking-widest
                ${idx === 0 || idx === 6 ? "text-red-400" : "text-slate-400"}
              `}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-1 sm:gap-3">
          {getDaysInMonth().map((date, idx) => {
            const isCurrentDay = isToday(date);
            const isWeekendDay = isWeekend(date);
            const isHolidayDay = isHoliday(date);
            const holidayName = getHolidayName(date);
            const dayEvents = getEventsForDate(date);

            return (
              <motion.button
                key={idx}
                onClick={() => date && handleDateClick(date)}
                whileHover={date ? { scale: 1.03, y: -1 } : {}}
                whileTap={date ? { scale: 0.97 } : {}}
                disabled={!date}
                className={`
                  group relative aspect-square rounded-lg sm:rounded-2xl
                  transition-all duration-300 isolate overflow-hidden
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
                    <div className="absolute inset-0 rounded-lg sm:rounded-2xl bg-gradient-to-b from-white/0 to-black/10 opacity-50 z-0" />

                    {/* Date Number */}
                    <div className="absolute top-0.5 left-0.5 sm:top-2 sm:left-2 z-10">
                      <span
                        className={`
                          text-[10px] sm:text-sm font-bold drop-shadow-lg
                          ${isCurrentDay ? "text-emerald-300" : ""}
                          ${isWeekendDay || isHolidayDay ? "text-red-400" : "text-slate-200"}
                        `}
                      >
                        {date.getDate()}
                      </span>
                    </div>

                    {/* Holiday Flag */}
                    {isHolidayDay && (
                      <div className="absolute top-0.5 right-0.5 sm:top-2 sm:right-2 z-10">
                        <div className="flex h-3 w-3 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-red-500/30 backdrop-blur-sm">
                          <Icon
                            icon="solar:flag-bold"
                            className="text-[6px] sm:text-xs text-red-300 drop-shadow-lg"
                          />
                        </div>
                      </div>
                    )}

                    {/* Holiday Name - Desktop Only */}
                    {isHolidayDay && holidayName && (
                      <div className="hidden sm:block absolute inset-x-2 top-1/2 -translate-y-1/2 z-10 text-center">
                        <p className="text-[9px] font-bold text-red-300 leading-tight line-clamp-2 drop-shadow-lg px-0.5">
                          {holidayName}
                        </p>
                      </div>
                    )}

                    {/* Event Icons */}
                    {dayEvents.length > 0 && (
                      <div className="absolute bottom-0.5 sm:bottom-2 left-1/2 -translate-x-1/2 z-10 flex gap-0.5 sm:gap-1">
                        {/* Mobile */}
                        <div className="sm:hidden flex gap-0.5">
                          {dayEvents.slice(0, 1).map((event) => {
                            const eventConfig = eventIcons[event.tipe_acara] || eventIcons.LAINNYA;
                            return (
                              <div
                                key={event.id_acara}
                                className={`
                                  flex h-4 w-4 items-center justify-center
                                  rounded bg-gradient-to-br ${eventConfig.gradient}
                                  shadow-md backdrop-blur-sm
                                `}
                                style={{ boxShadow: `0 1px 4px ${eventConfig.color}40` }}
                              >
                                <Icon
                                  icon={eventConfig.icon}
                                  className="text-[8px] text-white drop-shadow-md"
                                />
                              </div>
                            );
                          })}
                          {dayEvents.length > 1 && (
                            <div className="flex h-4 w-4 items-center justify-center rounded bg-gradient-to-br from-slate-700 to-slate-800 shadow-md">
                              <span className="text-[7px] font-bold text-white">
                                +{dayEvents.length - 1}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Desktop */}
                        <div className="hidden sm:flex gap-1">
                          {dayEvents.slice(0, 2).map((event) => {
                            const eventConfig = eventIcons[event.tipe_acara] || eventIcons.LAINNYA;
                            return (
                              <div
                                key={event.id_acara}
                                className={`
                                  flex h-5 w-5 items-center justify-center
                                  rounded-md bg-gradient-to-br ${eventConfig.gradient}
                                  shadow-lg backdrop-blur-sm
                                  transform transition-transform
                                  group-hover:scale-110
                                `}
                                style={{ boxShadow: `0 2px 6px ${eventConfig.color}40` }}
                              >
                                <Icon
                                  icon={eventConfig.icon}
                                  className="text-[9px] text-white drop-shadow-md"
                                />
                              </div>
                            );
                          })}
                          {dayEvents.length > 2 && (
                            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-slate-700 to-slate-800 shadow-lg">
                              <span className="text-[8px] font-bold text-white">
                                +{dayEvents.length - 2}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tooltip - Desktop Only */}
                    {(holidayName || dayEvents.length > 0) && (
                      <div
                        className="
                          hidden sm:block
                          pointer-events-none absolute -top-20 left-1/2
                          -translate-x-1/2 whitespace-nowrap
                          rounded-xl bg-gradient-to-br from-slate-900 to-slate-800
                          border border-white/10 px-3 py-2
                          opacity-0 shadow-2xl transition-all duration-200
                          group-hover:opacity-100 group-hover:-top-24
                          max-w-[200px] backdrop-blur-xl
                        "
                        style={{ zIndex: 999999 }}
                      >
                        {holidayName && (
                          <div className="mb-1 flex items-center gap-1.5">
                            <Icon icon="solar:flag-bold" className="text-xs text-red-400 flex-shrink-0" />
                            <span className="text-[10px] font-semibold text-red-300 truncate">
                              {holidayName}
                            </span>
                          </div>
                        )}
                        {dayEvents.slice(0, 3).map((event) => {
                          const eventConfig = eventIcons[event.tipe_acara] || eventIcons.LAINNYA;
                          return (
                            <div key={event.id_acara} className="flex items-center gap-1.5 py-0.5">
                              <Icon
                                icon={eventConfig.icon}
                                className="text-xs flex-shrink-0"
                                style={{ color: eventConfig.color }}
                              />
                              <span className="text-[10px] text-slate-300 truncate">
                                {event.judul_acara}
                              </span>
                            </div>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <div className="mt-0.5 text-[9px] text-slate-400">
                            +{dayEvents.length - 3} lagi
                          </div>
                        )}
                        <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-gradient-to-br from-slate-900 to-slate-800 border-r border-b border-white/10" />
                      </div>
                    )}

                    {/* Shine Effect */}
                    <div className="absolute inset-0 rounded-lg sm:rounded-2xl bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 transition-opacity group-hover:opacity-100 z-0" />
                  </>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-3xl z-[100]">
            <Icon icon="solar:settings-linear" className="text-4xl text-emerald-400 animate-spin" />
          </div>
        )}
      </div>

      {/* Mobile Info Modal */}
      <AnimatePresence>
        {showMobileInfo && selectedDate && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileInfo(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] sm:hidden"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed bottom-4 left-4 right-4 z-[9999] sm:hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 p-4 backdrop-blur-xl shadow-2xl max-h-[60vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-bold text-white">
                  {selectedDate.getDate()} {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                </div>
                <button
                  onClick={() => setShowMobileInfo(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-slate-300 transition-colors hover:bg-white/20"
                >
                  <Icon icon="solar:close-circle-bold" className="text-lg" />
                </button>
              </div>

              {/* Holiday Info */}
              {getHolidayName(selectedDate) && (
                <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-500/20 border border-red-400/30 p-3">
                  <Icon icon="solar:flag-bold" className="text-lg text-red-400 flex-shrink-0" />
                  <span className="text-sm font-semibold text-red-300">
                    {getHolidayName(selectedDate)}
                  </span>
                </div>
              )}

              {/* Events List */}
              {getEventsForDate(selectedDate).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Acara</p>
                  {getEventsForDate(selectedDate).map((event) => {
                    const eventConfig = eventIcons[event.tipe_acara] || eventIcons.LAINNYA;
                    return (
                      <div
                        key={event.id_acara}
                        className="flex items-center gap-3 rounded-lg bg-white/5 border border-white/10 p-3"
                      >
                        <div
                          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${eventConfig.gradient} shadow-lg`}
                          style={{ boxShadow: `0 2px 8px ${eventConfig.color}40` }}
                        >
                          <Icon icon={eventConfig.icon} className="text-base text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{event.judul_acara}</p>
                          <p className="text-xs text-slate-400 capitalize">
                            {event.tipe_acara.replace("_", " ").toLowerCase()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 p-3 sm:p-4 backdrop-blur-xl">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="h-3 w-3 sm:h-4 sm:w-4 rounded-lg border-2 border-emerald-400 bg-emerald-500/20 shadow-lg shadow-emerald-500/20 flex-shrink-0" />
            <span className="text-[10px] sm:text-xs text-slate-400">Hari Ini</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex h-3 w-3 sm:h-4 sm:w-4 items-center justify-center rounded-lg bg-red-400 shadow-lg flex-shrink-0">
              <Icon icon="solar:flag-bold" className="text-[6px] sm:text-[8px] text-white" />
            </div>
            <span className="text-[10px] sm:text-xs text-slate-400">Libur</span>
          </div>
          {Object.entries(eventIcons).slice(0, 3).map(([key, config]) => (
            <div key={key} className="flex items-center gap-1.5 sm:gap-2">
              <div className={`flex h-3 w-3 sm:h-4 sm:w-4 items-center justify-center rounded-lg bg-gradient-to-br ${config.gradient} shadow-lg flex-shrink-0`}>
                <Icon icon={config.icon} className="text-[6px] sm:text-[8px] text-white" />
              </div>
              <span className="text-[10px] sm:text-xs text-slate-400 capitalize truncate">
                {key.replace("_", " ").toLowerCase()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

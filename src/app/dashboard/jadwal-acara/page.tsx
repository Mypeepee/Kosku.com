"use client";

import { useState, useEffect } from "react";
import Kalendar from "./components/kalendar";
import Todo from "./components/todo";
import ModalAcara from "./components/modal-acara";
import { Icon } from "@iconify/react";

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
  id_property?: string;
}

export default function JadwalAcaraPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch events from database
  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      
      const response = await fetch(
        `/api/dashboard/acara?year=${year}&month=${month}`
      );
      
      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }
      
      const data = await response.json();
      console.log("Fetched events:", data);
      setEvents(data);
    } catch (error) {
      console.error("Error fetching events:", error);
      setError("Gagal memuat data acara");
    } finally {
      setLoading(false);
    }
  };

  // Fetch events ketika bulan berubah
  useEffect(() => {
    fetchEvents();
  }, [currentDate]);

  const prevMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    );
  };

  const nextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    );
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const handleModalSuccess = () => {
    fetchEvents(); // Refresh data
    handleCloseModal();
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedDate(null);
    setSelectedEvent(null);
  };

  // Handle klik tanggal di kalendar
  const handleDateClick = (date: Date) => {
    console.log("Date clicked:", date);
    setSelectedDate(date);
    setSelectedEvent(null); // Reset selected event
    setShowModal(true);
  };

  // Handle klik event di todo list
  const handleEventClick = (event: EventData) => {
    console.log("Event clicked:", event);
    setSelectedEvent(event);
    setSelectedDate(null); // Reset selected date
    setShowModal(true);
  };

  // Handle tombol tambah acara
  const handleAddEvent = () => {
    setSelectedDate(new Date()); // Default hari ini
    setSelectedEvent(null);
    setShowModal(true);
  };

  return (
    <div className="min-h-screen bg-[#040608] p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
              Jadwal & Acara
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Kelola jadwal meeting, site visit, dan event PEMILU
            </p>
          </div>

          {/* Stats Badge */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="px-4 py-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30">
              <div className="flex items-center gap-2">
                <Icon icon="solar:calendar-mark-bold" className="text-emerald-400" />
                <span className="text-xs font-bold text-emerald-300">
                  {events.length} Acara
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <div className="flex items-center gap-2">
            <Icon icon="solar:danger-circle-bold" className="text-red-400" />
            <span className="text-sm text-red-300">{error}</span>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Icon
              icon="solar:settings-linear"
              className="text-5xl text-emerald-400 animate-spin"
            />
            <span className="text-sm text-slate-300">Memuat data...</span>
          </div>
        </div>
      )}

      {/* Main Layout: Calendar (3/4) + Todo List (1/4) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Calendar Section - 3/4 width on large screens */}
        <div className="lg:col-span-3">
          <Kalendar
            currentDate={currentDate}
            events={events}
            onDateClick={handleDateClick}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
            onToday={goToToday}
            onAddEvent={handleAddEvent}
          />
        </div>

        {/* Todo List Section - 1/4 width on large screens */}
        <div className="lg:col-span-1">
          <Todo events={events} onEventClick={handleEventClick} />
        </div>
      </div>

      {/* Modal Acara */}
      <ModalAcara
        open={showModal}
        onClose={handleCloseModal}
        selectedDate={selectedDate}
        selectedEvent={selectedEvent}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}

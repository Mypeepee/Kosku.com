"use client";

import { useState, useEffect } from "react";
import Kalendar from "./components/kalendar";
import Todo from "./components/todo";
import ModalAcara from "./components/modal-acara";

interface EventData {
  id_acara: string;
  judul_acara: string;
  deskripsi?: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  waktu_mulai: string;
  waktu_selesai: string;
  tipe_acara: string;
  lokasi: string;
  status_acara: string;
}

export default function JadwalAcaraPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch events from database
  const fetchEvents = async () => {
    try {
      const response = await fetch("/api/dashboard/acara");
      if (!response.ok) throw new Error("Failed to fetch events");
      const data = await response.json();
      setEvents(data);
    } catch (error) {
      console.error("Error fetching events:", error);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [refreshTrigger]);

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
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const handleModalSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowAddModal(true);
  };

  const handleEventClick = (event: EventData) => {
    // TODO: Open detail modal atau edit modal
    console.log("Event clicked:", event);
  };

  const handleAddEvent = () => {
    setSelectedDate(new Date());
    setShowAddModal(true);
  };

  return (
    <div className="min-h-screen bg-[#040608] p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-1">
          Jadwal & Acara
        </h1>
        <p className="text-sm text-slate-400">
          Kelola jadwal meeting, site visit, dan event PEMILU
        </p>
      </div>

      {/* Main Layout: Calendar (3/4) + Todo List (1/4) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
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
          <Todo 
            events={events} 
            onEventClick={handleEventClick}
          />
        </div>
      </div>

      {/* Modal Acara */}
      <ModalAcara
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setSelectedDate(null);
        }}
        selectedDate={selectedDate}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}

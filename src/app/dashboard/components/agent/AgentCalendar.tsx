"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { isOwnerAtauPemilik } from "@/lib/sessionJabatan";
import Kalendar from "@/app/dashboard/jadwal-acara/components/kalendar";
import Todo from "@/app/dashboard/jadwal-acara/components/todo";
import ModalAcara from "@/app/dashboard/jadwal-acara/components/modal-acara";
import type { EventData } from "@/app/dashboard/jadwal-acara/lib/acara-types";


type ModalMode = "create" | "edit" | "view";

export function AgentCalendar({ compact = false }: { compact?: boolean } = {}) {
  const { data: session } = useSession();
  const [currentDate, setCurrentDate]     = useState(new Date());
  const [selectedDate, setSelectedDate]   = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<(EventData & { canEdit?: boolean }) | null>(null);
  const [events, setEvents]               = useState<EventData[]>([]);
  const [showModal, setShowModal]         = useState(false);
  const [modalMode, setModalMode]         = useState<ModalMode>("create");
  const [loading, setLoading]             = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const y = currentDate.getFullYear();
      const m = currentDate.getMonth() + 1;
      const res = await fetch(`/api/dashboard/acara?year=${y}&month=${m}`);
      if (res.ok) setEvents(await res.json());
    } catch {
      // silent — calendar still usable without events
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, [currentDate]);

  // Cross-component sync: if any other card (e.g. UpcomingEventsCard) opens
  // ModalAcara and saves, it dispatches `acara:changed` on window. Refetch
  // so the calendar dots reflect the new/edited event without a reload.
  useEffect(() => {
    const onChanged = () => fetchEvents();
    window.addEventListener("acara:changed", onChanged);
    return () => window.removeEventListener("acara:changed", onChanged);
    // fetchEvents closes over currentDate but we want fresh values each fire,
    // so we re-bind whenever currentDate changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  const handleModalSuccess = () => { fetchEvents(); handleCloseModal(); };
  const handleCloseModal   = () => {
    setShowModal(false);
    setSelectedDate(null);
    setSelectedEvent(null);
    setModalMode("create");
  };

  const handleDateClick  = (date: Date) => {
    setSelectedDate(date);
    setSelectedEvent(null);
    setModalMode("create");
    setShowModal(true);
  };

  const handleEventClick = (event: EventData & { canEdit: boolean }) => {
    setSelectedEvent(event);
    setSelectedDate(null);
    setModalMode(event.canEdit ? "edit" : "view");
    setShowModal(true);
  };

  const handleCalendarEventClick = (event: EventData) => {
    // Prefer hint dari backend (`_isOwner`) yang sudah ngecek
    // ownership berbasis session — paling akurat. Fallback ke
    // perbandingan client kalau hint absent (mis. event dari sumber
    // lain seperti MOU yang belum dapet flag).
    // Wewenang dibaca dari `jabatan` (@/lib/sessionJabatan) — dulu dari
    // `session.user.role` yang isinya USER|AGENT, jadi cabang OWNER-nya tidak
    // pernah aktif dan owner selalu jatuh ke mode "lihat saja".
    const canEdit =
      event._isOwner === true ||
      isOwnerAtauPemilik(session?.user, event.agent?.id_agent);
    handleEventClick({ ...event, canEdit });
  };

  const handleAddEvent = () => {
    setSelectedDate(new Date());
    setSelectedEvent(null);
    setModalMode("create");
    setShowModal(true);
  };

  return (
    <div className="relative h-full overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-b from-[#0a0f10] to-[#070a0b]">
      {/* top hairline */}
      <div className="pointer-events-none absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-emerald-400/25 to-transparent" />

      {/* body: single-row header (inside Kalendar) + grid (+ todo when not compact) */}
      <div className={`grid grid-cols-1 gap-4 px-4 pt-5 pb-5 sm:px-6 sm:pt-6 sm:pb-6 ${compact ? "" : "lg:grid-cols-4"}`}>
        <div className={compact ? "" : "lg:col-span-3"}>
          <Kalendar
            currentDate={currentDate}
            events={events}
            onDateClick={handleDateClick}
            onEventClick={handleCalendarEventClick}
            onPrevMonth={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
            onNextMonth={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
            onToday={() => { const t = new Date(); setCurrentDate(t); setSelectedDate(t); }}
            onAddEvent={handleAddEvent}
            headerTitle={compact ? "Jadwal & Acara" : undefined}
          />
        </div>
        {!compact && (
          <div className="lg:col-span-1">
            <Todo events={events} onEventClick={handleEventClick} />
          </div>
        )}
      </div>

      <ModalAcara
        open={showModal}
        onClose={handleCloseModal}
        selectedDate={selectedDate}
        selectedEvent={selectedEvent || undefined}
        onSuccess={handleModalSuccess}
        mode={modalMode}
      />
    </div>
  );
}

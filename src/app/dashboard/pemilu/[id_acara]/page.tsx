// src/app/dashboard/pemilu/[id_acara]/page.tsx
"use client";

import PemiluHeader from "./components/PemiluHeader";
import PemiluStats from "./components/PemiluStats";
import ParticipantsList from "./components/ParticipantsList";
import PropertyGrid from "./components/PropertyGrid";
import SelectionsTimeline from "./components/SelectionsTimeline";
import ControlPanel from "./components/ControlPanel";
import { usePemiluRealtime } from "./hooks/usePemiluRealtime";
import { usePemiluTimer } from "./hooks/usePemiluTimer";

interface PemiluPageProps {
  params: { id_acara: string };
}

export default function PemiluPage({ params }: PemiluPageProps) {
  const { id_acara } = params;

  const {
    acara,
    participants,
    properties,
    selections,
    notifications,
    currentUser,
    currentTurn,
    nextTurn,
    handleSelectProperty,
    handleJoinRoom,
  } = usePemiluRealtime(id_acara);

  // LOG DEBUG - lihat apa yang dikirim ke timer
  console.log("🔍 DEBUG acara:", {
    acara,
    waktu_mulai: acara?.waktu_mulai,
    waktu_selesai: acara?.waktu_selesai,
  });

  const { timeRemaining, phase } = usePemiluTimer(
    acara?.tanggal_mulai,
    acara?.tanggal_selesai
  );

  // LOG DEBUG - lihat hasil dari timer
  console.log("⏱️ DEBUG timer:", { timeRemaining, phase });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-4 sm:p-6">
      <div className="mx-auto max-w-[1920px] space-y-4">
        <PemiluHeader
          acara={acara}
          timeRemaining={timeRemaining}
          phase={phase}
          currentTurn={currentTurn}
          nextTurn={nextTurn}
        />

        <PemiluStats
          totalProperties={properties.length}
          selectedCount={selections.length}
          participantsCount={participants.length}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-3">
            <ParticipantsList
              participants={participants}
              currentUserId={currentUser?.id_agent}
            />
          </div>

          <div className="lg:col-span-6">
            <PropertyGrid
              properties={properties}
              selections={selections}
              currentUser={currentUser}
              onSelectProperty={handleSelectProperty}
              isActive={phase === "RUNNING"}
            />
          </div>

          <div className="lg:col-span-3">
            <SelectionsTimeline notifications={notifications} />
          </div>
        </div>

        <ControlPanel
          currentUser={currentUser}
          onJoinRoom={handleJoinRoom}
          isActive={phase === "RUNNING"}
        />
      </div>
    </div>
  );
}

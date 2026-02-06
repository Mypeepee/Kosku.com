// src/app/dashboard/pemilu/[id_acara]/components/PemiluLayout.tsx
"use client";

import type { Peserta, Pilihan, Listing } from "../PemiluClient";
import PesertaPanel from "./PesertaPanel";
import GiliranPanel from "./GiliranPanel";
import PilihanPanel from "./PilihanPanel";
import MobileGiliranBar from "./MobileGiliranBar";

interface Props {
  peserta: (Peserta & { online: boolean; isActive: boolean })[];
  pilihan: Pilihan[];
  countdown: number;
  availableListings: Listing[];
  onPilih: (id_listing: string) => void;
  currentAgentId: string;
  activeAgentId: string | null;
}

export default function PemiluLayout({
  peserta,
  pilihan,
  countdown,
  availableListings,
  onPilih,
  currentAgentId,
  activeAgentId,
}: Props) {
  return (
    <>
      {/* Desktop/Tablet Layout */}
      <div className="grid h-full gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)]">
        <div className="flex flex-col gap-4">
          {/* Hidden pada mobile, tampil di tablet+ */}
          <div className="hidden md:flex md:flex-col md:gap-4">
            <PesertaPanel peserta={peserta} countdown={countdown} />
            <GiliranPanel pilihan={pilihan} />
          </div>

          {/* Tampil di mobile, hidden di tablet+ */}
          <div className="md:hidden">
            <GiliranPanel pilihan={pilihan} />
          </div>
        </div>
        
        <div className="pb-20 md:pb-0">
          <PilihanPanel
            pilihan={pilihan}
            availableListings={availableListings}
            onPilih={onPilih}
            currentAgentId={currentAgentId}
            activeAgentId={activeAgentId}
          />
        </div>
      </div>

      {/* Mobile Bottom Bar - Fixed di bawah */}
      <MobileGiliranBar
        peserta={peserta}
        countdown={countdown}
        currentAgentId={currentAgentId}
      />
    </>
  );
}

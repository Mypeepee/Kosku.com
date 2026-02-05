// src/app/dashboard/pemilu/[id_acara]/components/PemiluLayout.tsx
"use client";

import type { Peserta, Pilihan, Listing } from "../PemiluClient";
import PesertaPanel from "./PesertaPanel";
import GiliranPanel from "./GiliranPanel";
import PilihanPanel from "./PilihanPanel";

interface Props {
  peserta: (Peserta & { online: boolean; isActive: boolean })[];
  pilihan: Pilihan[];
  countdown: number;
  availableListings: Listing[];
  onPilih: (id_listing: string) => void;
}

export default function PemiluLayout({
  peserta,
  pilihan,
  countdown,
  availableListings,
  onPilih,
}: Props) {
  return (
    <div className="grid h-full gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)]">
      <div className="flex flex-col gap-4">
        <PesertaPanel peserta={peserta} countdown={countdown} />
        <GiliranPanel pilihan={pilihan} />
      </div>
      <div>
        <PilihanPanel
          pilihan={pilihan}
          availableListings={availableListings}
          onPilih={onPilih}
        />
      </div>
    </div>
  );
}

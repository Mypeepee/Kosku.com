// src/app/dashboard/pemilu/[id_acara]/PemiluClient.tsx
"use client";

import { useMemo, useState } from "react";
import PemiluHeader from "./components/PemiluHeader";
import PemiluLayout from "./components/PemiluLayout";
import { usePemiluPresence } from "./hooks/usePemiluPresence";
import { usePemiluGiliran } from "./hooks/usePemiluGiliran";
import { usePemiluPilihan } from "./hooks/usePemiluPilihan";

export interface Peserta {
  id_acara: string;
  id_agent: string;
  nomor_urut: number | null;
  status_peserta: string;
  nama_agent: string;
  avatar_url: string | null;
}

export interface Pilihan {
  id_acara: string;
  id_pilihan: number;
  id_agent: string;
  nama_agent: string;
  id_listing: string;
  judul_listing: string;
  harga: string | null;
  alamat: string | null;
}

export interface Listing {
  id_property: string;
  judul: string;
  slug: string;
  harga: string;
  nilai_limit_lelang: string | null;
  alamat_lengkap: string | null;
  kota: string | null;
  provinsi: string | null;
  kecamatan: string | null;
  kelurahan: string | null;
  kategori: string;
  jenis_transaksi: string;
  luas_tanah: string | null;
  luas_bangunan: string | null;
  kamar_tidur: number | null;
  kamar_mandi: number | null;
  gambar: string | null;
}

export interface PemiluInitialData {
  id_acara: string;
  judul_acara: string;
  tipe_acara: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  durasi_pilih: number | null;
  peserta: Peserta[];
  pilihan: Pilihan[];
  availableListings: Listing[];

  activeAgentId: string | null;
  activeRemainingSeconds: number | null;
}

interface PemiluClientProps {
  initialData: PemiluInitialData;

  // ID agent user yang sedang login (harus sama dengan kolom id_agent di DB pesertaAcara)
  currentAgentId: string;
}

export default function PemiluClient({
  initialData,
  currentAgentId,
}: PemiluClientProps) {
  const [peserta, setPeserta] = useState<Peserta[]>(initialData.peserta);
  const [pilihan, setPilihan] = useState<Pilihan[]>(initialData.pilihan);
  const [availableListings] = useState<Listing[]>(initialData.availableListings);

  const { onlineMap } = usePemiluPresence(initialData.id_acara);

  const { activeAgentId, countdown } = usePemiluGiliran(
    initialData.id_acara,
    initialData.activeAgentId,
    initialData.activeRemainingSeconds
  );

  usePemiluPilihan(initialData.id_acara, setPilihan);

  const extendedPeserta = useMemo(
    () =>
      peserta.map((p) => ({
        ...p,
        online: !!onlineMap[p.id_agent],
        isActive: p.id_agent === activeAgentId,
      })),
    [peserta, onlineMap, activeAgentId]
  );

  // LOG: cek apakah id agent login sama dengan id agent aktif dari server
  console.log("👤 currentAgentId (login):", currentAgentId);
  console.log("🔥 activeAgentId (giliran):", activeAgentId);

  const handlePilih = async (id_listing: string) => {
    try {
      const res = await fetch(`/api/pemilu/${initialData.id_acara}/pilih`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_listing }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Gagal memilih unit");
        return;
      }

      const data = await res.json();
      console.log("Pilihan berhasil:", data);
    } catch (error) {
      console.error("Error pilih unit:", error);
      alert("Terjadi kesalahan, coba lagi.");
    }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col gap-4 p-4 md:p-6">
      <PemiluHeader
        judul={initialData.judul_acara}
        tipe={initialData.tipe_acara}
        tanggal_mulai={initialData.tanggal_mulai}
        tanggal_selesai={initialData.tanggal_selesai}
        durasi_pilih={initialData.durasi_pilih}
        totalPeserta={peserta.length}
        totalPilihan={pilihan.length}
      />

      <PemiluLayout
        peserta={extendedPeserta}
        pilihan={pilihan}
        countdown={countdown}
        availableListings={availableListings}
        onPilih={handlePilih}
        currentAgentId={currentAgentId}
        activeAgentId={activeAgentId}
      />
    </div>
  );
}

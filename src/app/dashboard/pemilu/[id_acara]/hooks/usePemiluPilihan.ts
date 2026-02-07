// src/app/dashboard/pemilu/[id_acara]/hooks/usePemiluPilihan.ts
"use client";

import { useEffect } from "react";
import Pusher from "pusher-js";
import type { Pilihan } from "../PemiluClient";

export function usePemiluPilihan(
  id_acara: string,
  setPilihan: React.Dispatch<React.SetStateAction<Pilihan[]>>
) {
  useEffect(() => {
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });

    const channelName = `pemilu-${id_acara}`;
    const channel = pusher.subscribe(channelName);

    // ✅ Event name harus sama dengan yang di API: "pilihan-update"
    channel.bind(
      "pilihan-update",
      (data: {
        id_pilihan: number;
        id_acara: string;
        id_agent: string;
        nama_agent: string;
        id_listing: string;
        judul_listing: string;
        harga: string | null;
        alamat: string | null;
      }) => {
        console.log("📡 Pusher pilihan-update received:", data);

        setPilihan((prev) => {
          // Cek apakah pilihan ini sudah ada (avoid duplicate)
          const exists = prev.some(
            (p) =>
              p.id_acara === data.id_acara &&
              p.id_pilihan === data.id_pilihan
          );

          if (exists) {
            console.log("⚠️ Pilihan sudah ada, skip");
            return prev;
          }

          console.log("✅ Menambahkan pilihan baru ke state");
          return [
            ...prev,
            {
              id_acara: data.id_acara,
              id_pilihan: data.id_pilihan,
              id_agent: data.id_agent,
              nama_agent: data.nama_agent,
              id_listing: data.id_listing,
              judul_listing: data.judul_listing,
              harga: data.harga,
              alamat: data.alamat,
            },
          ];
        });
      }
    );

    console.log(`🔌 Subscribed to ${channelName} for pilihan updates`);

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
      console.log(`🔌 Unsubscribed from ${channelName}`);
    };
  }, [id_acara, setPilihan]);
}

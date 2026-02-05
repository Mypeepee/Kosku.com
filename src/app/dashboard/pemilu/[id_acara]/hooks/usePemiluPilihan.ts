// src/app/dashboard/pemilu/[id_acara]/hooks/usePemiluPilihan.ts
"use client";

import { useEffect } from "react";
import { pusherClient } from "@/lib/pusher-client";
import type { Pilihan } from "../PemiluClient";

export function usePemiluPilihan(
  id_acara: string,
  setPilihan: React.Dispatch<React.SetStateAction<Pilihan[]>>
) {
  useEffect(() => {
    const channelName = `pemilu-${id_acara}`;
    const channel = pusherClient.subscribe(channelName);

    channel.bind("pilihan:created", (data: Pilihan) => {
      setPilihan((prev) => {
        const exists = prev.some(
          (p) =>
            p.id_acara === data.id_acara &&
            p.id_pilihan === data.id_pilihan
        );
        if (exists) return prev;
        return [...prev, data];
      });
    });

    return () => {
      pusherClient.unsubscribe(channelName);
    };
  }, [id_acara, setPilihan]);
}

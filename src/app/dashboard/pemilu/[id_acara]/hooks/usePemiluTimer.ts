// src/app/dashboard/pemilu/[id_acara]/hooks/usePemiluTimer.ts
"use client";

import { useEffect, useState } from "react";

export type PemiluPhase = "BEFORE" | "RUNNING" | "AFTER";

export const usePemiluTimer = (
  waktu_mulai?: string,
  waktu_selesai?: string
) => {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [phase, setPhase] = useState<PemiluPhase>("BEFORE");

  useEffect(() => {
    if (!waktu_mulai || !waktu_selesai) return;

    const interval = setInterval(() => {
      const now = new Date();
      const start = new Date(waktu_mulai);
      const end = new Date(waktu_selesai);

      if (now < start) {
        setPhase("BEFORE");
        setTimeRemaining(
          Math.max(0, Math.floor((start.getTime() - now.getTime()) / 1000))
        );
      } else if (now >= start && now < end) {
        setPhase("RUNNING");
        setTimeRemaining(
          Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000))
        );
      } else {
        setPhase("AFTER");
        setTimeRemaining(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [waktu_mulai, waktu_selesai]);

  return { timeRemaining, phase };
};

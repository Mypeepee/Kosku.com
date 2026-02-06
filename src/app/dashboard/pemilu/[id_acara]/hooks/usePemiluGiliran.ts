// src/app/dashboard/pemilu/[id_acara]/hooks/usePemiluGiliran.ts
import { useEffect, useState, useRef } from "react";
import Pusher from "pusher-js";

export function usePemiluGiliran(
  id_acara: string,
  initialActiveAgentId: string | null,
  initialRemainingSeconds: number | null
) {
  const [activeAgentId, setActiveAgentId] = useState<string | null>(
    initialActiveAgentId
  );
  const [countdown, setCountdown] = useState<number>(
    initialRemainingSeconds ?? 0
  );

  // ⏱ deadline absolut (timestamp ms) kapan giliran ini berakhir
  const deadlineRef = useRef<number | null>(
    initialRemainingSeconds != null
      ? Date.now() + initialRemainingSeconds * 1000
      : null
  );

  const isTransitioning = useRef(false);

  // Helper untuk update countdown dari deadline (supaya bisa dipakai di beberapa tempat)
  const recomputeCountdownFromDeadline = () => {
    if (!deadlineRef.current || !activeAgentId) {
      setCountdown(0);
      return;
    }
    const now = Date.now();
    const diffMs = deadlineRef.current - now;
    const sec = Math.max(0, Math.floor(diffMs / 1000));
    setCountdown(sec);
  };

  // Polling status kalau activeAgentId null
  useEffect(() => {
    if (activeAgentId !== null) return;

    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/pemilu/${id_acara}/status`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.activeAgentId) {
          setActiveAgentId(data.activeAgentId);
          const remaining = data.remainingSeconds ?? 0;
          deadlineRef.current = Date.now() + remaining * 1000;
          setCountdown(remaining);
        }
      } catch (err) {
        console.error("Error polling status:", err);
      }
    }, 5000);

    return () => clearInterval(poll);
  }, [activeAgentId, id_acara]);

  // Countdown lokal, tapi hitung ulang dari deadline, bukan prev - 1
  useEffect(() => {
    if (!activeAgentId || !deadlineRef.current) return;

    recomputeCountdownFromDeadline(); // sync sekali saat effect jalan

    const timer = setInterval(() => {
      recomputeCountdownFromDeadline();
    }, 1000);

    return () => clearInterval(timer);
    // pakai activeAgentId & deadlineRef sebagai dependensi “logis”; ref tidak memicu rerun
  }, [activeAgentId]);

  // Kalau countdown hampir habis (<=1 detik) DAN ada activeAgentId, minta server pindah giliran
  useEffect(() => {
    if (countdown > 1 || !activeAgentId || isTransitioning.current) return;

    isTransitioning.current = true;

    fetch(`/api/pemilu/${id_acara}/giliran/next`, {
      method: "POST",
    })
      .then(async (res) => {
        const data = await res.json();
        console.log("✅ Next giliran response:", data);

        if (!res.ok) {
          console.warn("⚠️ Server tolak /next:", data);
          setActiveAgentId(null);
          setCountdown(0);
          deadlineRef.current = null;
          isTransitioning.current = false;
        }
        // Kalau sukses, kita tunggu update dari Pusher
      })
      .catch((err) => {
        console.error("❌ Error next giliran:", err);
        isTransitioning.current = false;
      });
  }, [countdown, activeAgentId, id_acara]);

  // Subscribe Pusher: setiap giliran berubah, server kirim remainingSeconds baru
  useEffect(() => {
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });

    const channel = pusher.subscribe(`pemilu-${id_acara}`);

    channel.bind(
      "giliran-update",
      (data: { id_agent: string | null; remainingSeconds: number | null }) => {
        console.log("📡 Pusher event received:", data);

        setActiveAgentId(data.id_agent);

        if (data.id_agent && data.remainingSeconds != null) {
          const remaining = data.remainingSeconds;
          deadlineRef.current = Date.now() + remaining * 1000;
          setCountdown(remaining);
        } else {
          deadlineRef.current = null;
          setCountdown(0);
        }

        isTransitioning.current = false;
      }
    );

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
    };
  }, [id_acara]);

  return { activeAgentId, countdown };
}

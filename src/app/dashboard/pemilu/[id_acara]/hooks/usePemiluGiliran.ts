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

  const isTransitioning = useRef(false);

  // Polling status kalau activeAgentId null (event belum mulai / sudah selesai)
  useEffect(() => {
    if (activeAgentId !== null) return;

    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/pemilu/${id_acara}/status`);
        if (!res.ok) return;
        const data = await res.json();

        // Hanya set kalau ada activeAgentId yang valid dari server
        if (data.activeAgentId) {
          setActiveAgentId(data.activeAgentId);
          setCountdown(data.remainingSeconds ?? 0);
        }
      } catch (err) {
        console.error("Error polling status:", err);
      }
    }, 5000);

    return () => clearInterval(poll);
  }, [activeAgentId, id_acara]);

  // Countdown lokal
  useEffect(() => {
    if (!activeAgentId || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [activeAgentId, countdown]);

  // Kalau countdown habis DAN ada activeAgentId, minta server pindah giliran
  useEffect(() => {
    // ✅ Guard: jangan panggil /next kalau countdown masih jalan atau sudah transisi
    if (countdown !== 0 || !activeAgentId || isTransitioning.current) return;

    isTransitioning.current = true;

    fetch(`/api/pemilu/${id_acara}/giliran/next`, {
      method: "POST",
    })
      .then(async (res) => {
        const data = await res.json();
        console.log("✅ Next giliran response:", data);

        // Kalau server balikin error (acara belum mulai / sudah selesai), reset state
        if (!res.ok) {
          console.warn("⚠️ Server tolak /next:", data);
          setActiveAgentId(null);
          setCountdown(0);
          isTransitioning.current = false;
        }
        // Kalau sukses, tunggu event Pusher untuk update state
      })
      .catch((err) => {
        console.error("❌ Error next giliran:", err);
        isTransitioning.current = false;
      });
  }, [countdown, activeAgentId, id_acara]);

  // Subscribe Pusher
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
        setCountdown(data.remainingSeconds ?? 0);
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

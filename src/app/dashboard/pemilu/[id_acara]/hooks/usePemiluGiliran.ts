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

  // 🔥 TAMBAHAN: polling status kalau activeAgentId null
  useEffect(() => {
    if (activeAgentId !== null) return;

    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/pemilu/${id_acara}/status`);
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.activeAgentId) {
          setActiveAgentId(data.activeAgentId);
          setCountdown(data.remainingSeconds ?? 0);
        }
      } catch (err) {
        console.error("Error polling status:", err);
      }
    }, 5000); // poll setiap 5 detik

    return () => clearInterval(poll);
  }, [activeAgentId, id_acara]);

  // countdown lokal
  useEffect(() => {
    if (!activeAgentId || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [activeAgentId, countdown]);

  // kalau countdown habis, minta server pindah giliran
  useEffect(() => {
    if (countdown === 0 && activeAgentId && !isTransitioning.current) {
      isTransitioning.current = true;

      fetch(`/api/pemilu/${id_acara}/giliran/next`, {
        method: "POST",
      })
        .then((res) => res.json())
        .then((data) => {
          console.log("✅ Next giliran response:", data);
        })
        .catch((err) => {
          console.error("❌ Error next giliran:", err);
          isTransitioning.current = false;
        });
    }
  }, [countdown, activeAgentId, id_acara]);

  // subscribe ke Pusher
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

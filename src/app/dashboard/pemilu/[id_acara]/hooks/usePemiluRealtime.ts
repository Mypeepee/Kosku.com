"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { supabase } from "@/lib/supabaseClient";
import {
  Acara,
  Participant,
  Property,
  Selection,
  Notification,
} from "../types/pemilu.types";

export const usePemiluRealtime = (id_acara: string) => {
  const { data: session } = useSession();
  const [acara, setAcara] = useState<Acara | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentUser, setCurrentUser] = useState<Participant | null>(null);

  // giliran sekarang & berikutnya
  const [currentTurn, setCurrentTurn] = useState<Participant | null>(null);
  const [nextTurn, setNextTurn] = useState<Participant | null>(null);

  const idAcaraNum = Number(id_acara);

  const recomputeTurns = (list: Participant[]) => {
    const sorted = [...list].sort(
      (a, b) => (a.nomor_urut || 0) - (b.nomor_urut || 0)
    );

    const current =
      sorted.find((p) => p.status_peserta === "AKTIF") || null;

    let next: Participant | null = null;
    if (current) {
      next =
        sorted.find(
          (p) =>
            (p.nomor_urut || 0) > (current.nomor_urut || 0) &&
            p.status_peserta !== "SELESAI"
        ) || null;
    } else {
      next = sorted.find((p) => p.status_peserta !== "SELESAI") || null;
    }

    setCurrentTurn(current);
    setNextTurn(next);
  };

  // Ambil peserta
  const refreshParticipants = async () => {
    const { data, error } = await supabase
      .from("peserta_acara")
      .select("*")
      .eq("id_acara", idAcaraNum)
      .order("nomor_urut", { ascending: true });

    console.log("👥 refresh participants result:", { data, error });

    if (!error && data) {
      const list = data as Participant[];
      setParticipants(list);
      recomputeTurns(list);

      if (session?.user) {
        const agentId = (session.user as any).agentId;
        const userParticipant = list.find((p) => p.id_agent === agentId);
        setCurrentUser((userParticipant as Participant) || null);
      }
    }
  };

  // Fetch initial data
  useEffect(() => {
    const fetchInitial = async () => {
      if (Number.isNaN(idAcaraNum)) return;

      // 1) acara
      const { data: acaraData, error: acaraError } = await supabase
        .from("acara")
        .select("*")
        .eq("id_acara", idAcaraNum)
        .single();

      console.log("📅 Acara:", { acaraData, acaraError });
      setAcara(acaraData as Acara);

      // 2) participants
      await refreshParticipants();

      // 3) properties (unit_pemilu + listing minimal)
      const { data: unitData, error: unitError } = await supabase
        .from("unit_pemilu")
        .select("*")
        .eq("id_acara", idAcaraNum);

      console.log("🏠 Unit_pemilu:", { unitData, unitError });

      if (!unitError && unitData) {
        const propertyIds = Array.from(
          new Set(unitData.map((u: any) => u.id_property))
        );

        const { data: listingData, error: listingError } = await supabase
          .from("listing")
          .select("*")
          .in("id_property", propertyIds);

        console.log("🧱 Listing:", { listingData, listingError });

        setProperties(unitData as any);
      }

      // 4) selections
      const { data: selectionsData, error: selectionsError } = await supabase
        .from("pilihan_pemilu")
        .select("*")
        .eq("id_acara", idAcaraNum)
        .order("waktu_memilih", { ascending: true });

      console.log("✅ Selections:", { selectionsData, selectionsError });
      setSelections((selectionsData || []) as Selection[]);
    };

    fetchInitial();
  }, [idAcaraNum, session]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: peserta_acara
  useEffect(() => {
    if (Number.isNaN(idAcaraNum)) return;

    const channel = supabase
      .channel(`peserta-${idAcaraNum}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "peserta_acara",
          filter: `id_acara=eq.${idAcaraNum}`,
        },
        async (payload) => {
          console.log("📡 Realtime peserta payload:", payload);

          if (payload.eventType === "INSERT") {
            const raw = payload.new as any;

            await refreshParticipants();

            setNotifications((prev) => [
              {
                id: Date.now().toString(),
                message: "bergabung ke room",
                timestamp: new Date().toISOString(),
                type: "join",
                agentName: raw.id_agent,
              },
              ...prev,
            ]);
          }

          if (payload.eventType === "UPDATE") {
            const updated = payload.new as Participant;
            setParticipants((prev) => {
              const nextList = prev.map((p) =>
                p.id_agent === updated.id_agent &&
                String(p.id_acara) === String(updated.id_acara)
                  ? { ...p, ...updated }
                  : p
              );
              recomputeTurns(nextList);
              return nextList;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [idAcaraNum, session]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: pilihan_pemilu
  useEffect(() => {
    if (Number.isNaN(idAcaraNum)) return;

    const channel = supabase
      .channel(`pilihan-${idAcaraNum}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pilihan_pemilu",
          filter: `id_acara=eq.${idAcaraNum}`,
        },
        (payload) => {
          console.log("📡 Realtime pilihan payload:", payload);
          const newSelection = payload.new as Selection;
          setSelections((prev) => [...prev, newSelection]);
          setNotifications((prev) => [
            {
              id: Date.now().toString(),
              message: `memilih Unit #${newSelection.id_unit}`,
              timestamp: newSelection.waktu_memilih,
              type: "select",
              agentName: newSelection.id_agent,
            },
            ...prev,
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [idAcaraNum]);

  // Actions
  const handleSelectProperty = async (propertyId: string) => {
    const res = await fetch("/api/pemilu/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id_acara,
        id_agent: (session?.user as any)?.agentId,
        id_unit: propertyId,
      }),
    });

    if (!res.ok) {
      const json = await res.json();
      alert(json.error || "Gagal memilih property");
    }
  };

  const handleJoinRoom = async () => {
    const res = await fetch("/api/pemilu/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id_acara,
        id_agent: (session?.user as any)?.agentId,
      }),
    });

    if (!res.ok) {
      const json = await res.json();
      alert(json.error || "Gagal join room");
    }
  };

  return {
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
  };
};

// src/app/dashboard/pemilu/[id_acara]/hooks/usePemiluPresence.ts
"use client";

import { useEffect, useState } from "react";
import { pusherClient } from "@/lib/pusher-client"; // asumsi sudah ada

interface MembersMap {
  [id_agent: string]: {
    nama: string;
    avatar_url?: string | null;
  };
}

export function usePemiluPresence(id_acara: string) {
  const [onlineMap, setOnlineMap] = useState<MembersMap>({});

  useEffect(() => {
    const channelName = `presence-pemilu-${id_acara}`;
    const channel = pusherClient.subscribe(channelName);

    channel.bind("pusher:subscription_succeeded", (members: any) => {
      const map: MembersMap = {};
      members.each((member: any) => {
        map[member.id] = member.info;
      });
      setOnlineMap(map);
    });

    channel.bind("pusher:member_added", (member: any) => {
      setOnlineMap((prev) => ({
        ...prev,
        [member.id]: member.info,
      }));
    });

    channel.bind("pusher:member_removed", (member: any) => {
      setOnlineMap((prev) => {
        const copy = { ...prev };
        delete copy[member.id];
        return copy;
      });
    });

    return () => {
      pusherClient.unsubscribe(channelName);
      setOnlineMap({});
    };
  }, [id_acara]);

  return { onlineMap };
}

"use client";

import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { Participant } from "../types/pemilu.types";

interface ParticipantsListProps {
  participants: Participant[];
  currentUserId?: string;
}

export default function ParticipantsList({
  participants,
  currentUserId,
}: ParticipantsListProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl">
      <div className="border-b border-white/10 bg-white/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 border border-purple-500/30">
              <Icon
                icon="solar:users-group-rounded-bold"
                className="text-lg text-purple-400"
              />
            </div>
            <h3 className="text-sm font-bold text-white">Peserta</h3>
          </div>
          <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-bold text-purple-300">
            {participants.length}
          </span>
        </div>
      </div>

      <div className="max-h-[600px] overflow-y-auto p-3 space-y-2 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {participants.map((p, idx) => {
            const nama = p.id_agent;
            const initial = nama ? nama.charAt(0) : "?";

            return (
              <motion.div
                key={`${p.id_acara}-${p.id_agent}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: idx * 0.03 }}
                className={`
                  group relative overflow-hidden rounded-xl border p-3
                  transition-all duration-200
                  ${
                    p.id_agent === currentUserId
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-sm font-bold text-white">
                      {initial}
                    </div>

                    {p.nomor_urut && (
                      <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white ring-2 ring-slate-900">
                        {p.nomor_urut}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {nama}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={`
                          rounded-full px-2 py-0.5 text-[10px] font-bold
                          ${
                            p.status_peserta === "AKTIF"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : p.status_peserta === "SELESAI"
                              ? "bg-blue-500/20 text-blue-300"
                              : "bg-slate-500/20 text-slate-300"
                          }
                        `}
                      >
                        {p.status_peserta}
                      </span>
                    </div>
                  </div>

                  {p.status_peserta === "AKTIF" && (
                    <div className="flex items-center gap-1">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {participants.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Icon
              icon="solar:user-cross-rounded-bold"
              className="text-5xl text-slate-600 mb-2"
            />
            <p className="text-xs text-slate-500">Belum ada peserta</p>
          </div>
        )}
      </div>
    </div>
  );
}

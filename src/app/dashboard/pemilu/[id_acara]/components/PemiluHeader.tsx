"use client";

import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { Acara, Participant } from "../types/pemilu.types";

type PemiluPhase = "BEFORE" | "RUNNING" | "AFTER";

interface PemiluHeaderProps {
  acara: Acara | null;
  timeRemaining: number;
  phase: PemiluPhase;
  currentTurn: Participant | null;
  nextTurn: Participant | null;
}

export default function PemiluHeader({
  acara,
  timeRemaining,
  phase,
  currentTurn,
  nextTurn,
}: PemiluHeaderProps) {
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const statusLabel =
    phase === "BEFORE"
      ? "Mulai dalam"
      : phase === "RUNNING"
      ? "Waktu Tersisa"
      : "Sesi Selesai";

  const isActive = phase === "RUNNING";

  const currentName = currentTurn?.id_agent;
  const nextName = nextTurn?.id_agent;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-slate-900/80 to-slate-900/80 p-6 backdrop-blur-xl"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-blue-500/5 animate-pulse" />

      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left: Title + turn info */}
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/50">
            <Icon icon="solar:flag-bold" className="text-3xl text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {acara?.judul_acara || "PEMILU Session"}
            </h1>

            {phase === "RUNNING" && currentName ? (
              <p className="text-sm text-slate-300">
                Giliran: <span className="font-semibold">{currentName}</span>
                {currentTurn?.nomor_urut
                  ? ` (No. ${currentTurn.nomor_urut})`
                  : ""}
                {nextName && (
                  <>
                    {" • "}
                    Next:{" "}
                    <span className="font-semibold">{nextName}</span>
                  </>
                )}
              </p>
            ) : phase === "BEFORE" ? (
              <p className="text-sm text-slate-400">
                Sesi belum dimulai, tunggu sampai waktunya.
              </p>
            ) : (
              <p className="text-sm text-slate-400">
                Sesi sudah selesai. Terima kasih.
              </p>
            )}
          </div>
        </div>

        {/* Right: Timer */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {statusLabel}
            </span>
            <div className="font-mono text-3xl font-bold text-white">
              {formatTime(timeRemaining)}
            </div>
          </div>
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl ${
              isActive ? "bg-emerald-500/20 animate-pulse" : "bg-slate-500/20"
            }`}
          >
            <Icon
              icon={
                phase === "BEFORE"
                  ? "solar:clock-circle-bold"
                  : phase === "RUNNING"
                  ? "solar:play-circle-bold"
                  : "solar:pause-circle-bold"
              }
              className={`text-2xl ${
                isActive ? "text-emerald-400" : "text-slate-400"
              }`}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

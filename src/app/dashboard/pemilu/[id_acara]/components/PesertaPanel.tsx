// src/app/dashboard/pemilu/[id_acara]/components/PesertaPanel.tsx
"use client";

import { Icon } from "@iconify/react";
import type { Peserta } from "../PemiluClient";
import { useEffect, useState } from "react";

interface Props {
  peserta: (Peserta & { online: boolean; isActive: boolean })[];
  countdown?: number; // countdown dalam detik untuk giliran aktif
}

export default function PesertaPanel({ peserta, countdown = 0 }: Props) {
  const [progress, setProgress] = useState(100);
  const activePeserta = peserta.find((p) => p.isActive);
  const durasiPilih = 60; // default, bisa ambil dari props kalau perlu

  useEffect(() => {
    if (countdown > 0 && durasiPilih > 0) {
      const percentage = (countdown / durasiPilih) * 100;
      setProgress(Math.max(0, Math.min(100, percentage)));
    } else {
      setProgress(0);
    }
  }, [countdown, durasiPilih]);

  // Hitung berapa orang yang sudah selesai (sudah punya pilihan)
  const selesaiCount = peserta.filter((p) => p.status_peserta === "SELESAI").length;
  const menungguCount = peserta.filter((p) => !p.isActive && p.status_peserta !== "SELESAI").length;

  return (
    <div className="flex h-1/2 min-h-[220px] flex-col rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-3 md:p-4 shadow-[0_0_40px_rgba(15,23,42,0.9)]">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/40">
            <Icon
              icon="solar:users-group-rounded-bold"
              className="text-sm text-emerald-300"
            />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">Peserta</p>
            <p className="text-[10px] text-slate-400">
              {peserta.length} agent · {selesaiCount} selesai · {menungguCount} menunggu
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 border border-emerald-500/30">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-medium text-emerald-200">
            Realtime
          </span>
        </div>
      </div>

      {/* Giliran Aktif Banner */}
      {activePeserta && (
        <div className="mb-3 relative overflow-hidden rounded-2xl border border-sky-500/40 bg-gradient-to-r from-sky-500/20 via-blue-500/20 to-purple-500/20 p-3 shadow-[0_0_30px_rgba(56,189,248,0.4)]">
          {/* Animated shimmer background */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
          
          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900/50">
            <div
              className="h-full bg-gradient-to-r from-sky-400 via-blue-400 to-purple-400 transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Avatar dengan pulse animation */}
              <div className="relative">
                <span className="absolute inset-0 h-10 w-10 rounded-full bg-sky-400 opacity-75 animate-ping" />
                <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-500 border-2 border-white/20 text-xs font-bold text-white shadow-lg">
                  {activePeserta.nama_agent
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((s) => s[0])
                    .join("")
                    .toUpperCase()}
                </div>
                {activePeserta.nomor_urut != null && (
                  <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 border-2 border-slate-900 text-[9px] font-bold text-white shadow-lg">
                    {activePeserta.nomor_urut}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Icon
                    icon="solar:play-circle-bold"
                    className="text-sm text-sky-300"
                  />
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-sky-200">
                    Giliran Sekarang
                  </p>
                </div>
                <p className="mt-0.5 truncate text-sm font-bold text-white">
                  {activePeserta.nama_agent}
                </p>
              </div>
            </div>

            {/* Countdown timer */}
            {countdown > 0 && (
              <div className="flex flex-col items-center">
                <div className="relative flex h-12 w-12 items-center justify-center">
                  {/* Circular progress */}
                  <svg className="absolute inset-0 -rotate-90 transform" viewBox="0 0 48 48">
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="none"
                      className="text-slate-800"
                    />
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 20}`}
                      strokeDashoffset={`${2 * Math.PI * 20 * (1 - progress / 100)}`}
                      className="text-sky-400 transition-all duration-1000 ease-linear"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="relative text-lg font-bold tabular-nums text-white">
                    {countdown}
                  </span>
                </div>
                <span className="mt-0.5 text-[8px] text-sky-200">detik</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* List Peserta */}
      <div className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
        {peserta.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-4 text-center">
            <Icon
              icon="solar:inbox-line-duotone"
              className="mb-2 text-2xl text-slate-600"
            />
            <p className="text-[11px] text-slate-500">
              Belum ada peserta terdaftar.
            </p>
          </div>
        ) : (
          peserta.map((p) => {
            const isSelesai = p.status_peserta === "SELESAI";
            const isMenunggu = !p.isActive && !isSelesai;

            return (
              <div
                key={p.id_agent}
                className={`
                  group relative flex items-center justify-between gap-2 rounded-2xl border px-2.5 py-2
                  transition-all duration-300
                  ${
                    p.isActive
                      ? "border-sky-500/60 bg-gradient-to-r from-sky-500/20 to-blue-500/20 shadow-[0_0_20px_rgba(56,189,248,0.3)] scale-[1.02]"
                      : isSelesai
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }
                `}
              >
                {/* Glowing border untuk giliran aktif */}
                {p.isActive && (
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-sky-500/20 via-blue-500/20 to-purple-500/20 blur-xl" />
                )}

                <div className="relative flex items-center gap-2 min-w-0 flex-1">
                  <div className="relative flex-shrink-0">
                    <div
                      className={`
                      flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-semibold
                      ${
                        p.isActive
                          ? "bg-gradient-to-br from-sky-400 to-blue-500 border-white/30 text-white"
                          : isSelesai
                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                          : "bg-slate-800 border-white/10 text-slate-200"
                      }
                    `}
                    >
                      {isSelesai ? (
                        <Icon icon="solar:check-circle-bold" className="text-sm" />
                      ) : (
                        p.nama_agent
                          .split(" ")
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((s) => s[0])
                          .join("")
                          .toUpperCase()
                      )}
                    </div>
                    {/* Online indicator */}
                    {!isSelesai && (
                      <span
                        className={`
                          absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900
                          ${p.online ? "bg-emerald-400" : "bg-slate-500"}
                          ${p.online && p.isActive ? "animate-pulse" : ""}
                        `}
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {p.nomor_urut != null && (
                        <span
                          className={`
                            flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold
                            ${
                              p.isActive
                                ? "bg-sky-400 text-white"
                                : isSelesai
                                ? "bg-emerald-500/30 text-emerald-300"
                                : "bg-slate-900 text-slate-300"
                            }
                          `}
                        >
                          {p.nomor_urut}
                        </span>
                      )}
                      <p
                        className={`
                          truncate text-xs font-medium
                          ${
                            p.isActive
                              ? "text-white font-semibold"
                              : isSelesai
                              ? "text-emerald-100"
                              : "text-slate-100"
                          }
                        `}
                      >
                        {p.nama_agent}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p
                        className={`text-[9px] ${
                          p.isActive
                            ? "text-sky-200"
                            : isSelesai
                            ? "text-emerald-300"
                            : "text-slate-500"
                        }`}
                      >
                        {isSelesai
                          ? "Selesai memilih"
                          : p.isActive
                          ? "Sedang memilih"
                          : p.online
                          ? "Menunggu giliran"
                          : "Offline"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status badge */}
                {p.isActive && (
                  <div className="relative flex items-center gap-1 rounded-full bg-sky-500/20 px-2 py-0.5 border border-sky-400/40">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-sky-200">
                      Aktif
                    </span>
                  </div>
                )}

                {isSelesai && (
                  <Icon
                    icon="solar:check-circle-bold"
                    className="text-base text-emerald-400"
                  />
                )}

                {isMenunggu && p.nomor_urut && (
                  <div className="flex items-center gap-1 rounded-full bg-slate-800/60 px-2 py-0.5 border border-white/10">
                    <Icon
                      icon="solar:clock-circle-linear"
                      className="text-[10px] text-slate-400"
                    />
                    <span className="text-[9px] text-slate-400">Menunggu</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

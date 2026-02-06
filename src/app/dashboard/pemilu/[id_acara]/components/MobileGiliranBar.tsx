// src/app/dashboard/pemilu/[id_acara]/components/MobileGiliranBar.tsx
"use client";

import { Icon } from "@iconify/react";
import type { Peserta } from "../PemiluClient";
import { useEffect, useState } from "react";

interface Props {
  peserta: (Peserta & { online: boolean; isActive: boolean })[];
  countdown: number;
  currentAgentId: string;
}

export default function MobileGiliranBar({ peserta, countdown, currentAgentId }: Props) {
  const [progress, setProgress] = useState(100);
  const activePeserta = peserta.find((p) => p.isActive);
  const currentPeserta = peserta.find((p) => p.id_agent === currentAgentId);
  const durasiPilih = 60;

  useEffect(() => {
    if (countdown > 0 && durasiPilih > 0) {
      const percentage = (countdown / durasiPilih) * 100;
      setProgress(Math.max(0, Math.min(100, percentage)));
    } else {
      setProgress(0);
    }
  }, [countdown, durasiPilih]);

  const isMyTurn = activePeserta?.id_agent === currentAgentId;
  const isFinished = currentPeserta?.status_peserta === "SUDAH_MEMILIH";

  const pesertaDalamAntrian = peserta
    .filter((p) => 
      p.status_peserta !== "SUDAH_MEMILIH" && 
      p.nomor_urut != null
    )
    .sort((a, b) => (a.nomor_urut || 0) - (b.nomor_urut || 0));

  const activeIndex = pesertaDalamAntrian.findIndex((p) => p.isActive);
  const myIndex = pesertaDalamAntrian.findIndex((p) => p.id_agent === currentAgentId);
  
  let peopleBeforeMe = 0;
  
  if (activeIndex !== -1 && myIndex !== -1 && myIndex > activeIndex) {
    peopleBeforeMe = myIndex - activeIndex;
  }

  const myNomorUrut = currentPeserta?.nomor_urut;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden safe-area-bottom">
      <div className="h-1 bg-slate-900">
        <div
          className="h-full bg-gradient-to-r from-sky-400 via-blue-400 to-purple-400 transition-all duration-1000 ease-linear shadow-lg shadow-sky-400/50"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 backdrop-blur-xl border-t border-white/10">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />

        <div className="relative px-3 py-2.5">
          {activePeserta ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="relative flex-shrink-0">
                  {isMyTurn && (
                    <>
                      <span className="absolute inset-0 h-11 w-11 rounded-xl bg-sky-400/30 animate-ping" />
                      <span className="absolute inset-0 h-11 w-11 rounded-xl bg-sky-400/20 animate-pulse" />
                    </>
                  )}
                  <div
                    className={`
                    relative flex h-11 w-11 items-center justify-center rounded-xl border-2 text-sm font-bold shadow-lg
                    ${
                      isMyTurn
                        ? "bg-gradient-to-br from-sky-400 via-blue-500 to-purple-500 border-white/30 text-white"
                        : "bg-gradient-to-br from-slate-700 to-slate-800 border-white/20 text-slate-200"
                    }
                  `}
                  >
                    {activePeserta.nama_agent
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((s) => s[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                  {activePeserta.nomor_urut != null && (
                    <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 border-2 border-slate-900 text-[9px] font-black text-white shadow-lg">
                      {activePeserta.nomor_urut}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  {isMyTurn ? (
                    <>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Icon
                          icon="solar:bolt-circle-bold"
                          className="text-sm text-sky-300 animate-pulse flex-shrink-0"
                        />
                        <p className="text-[10px] font-bold uppercase tracking-wider text-sky-200">
                          Giliran Anda Sekarang!
                        </p>
                      </div>
                      <p className="text-xs font-semibold text-white truncate">
                        Silakan pilih sekarang
                      </p>
                    </>
                  ) : isFinished ? (
                    <>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Icon
                          icon="solar:check-circle-bold"
                          className="text-sm text-emerald-400 flex-shrink-0"
                        />
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                          Anda Sudah Selesai
                        </p>
                      </div>
                      <p className="text-xs font-medium text-slate-300 truncate">
                        Giliran #{activePeserta.nomor_urut}: {activePeserta.nama_agent}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <p className="text-[10px] font-medium text-slate-400">
                          Giliran #{activePeserta.nomor_urut}
                        </p>
                        {peopleBeforeMe > 0 ? (
                          <>
                            <span className="text-slate-600">•</span>
                            <div className="flex items-center gap-1">
                              <Icon
                                icon="solar:hourglass-bold"
                                className="text-[10px] text-amber-400 flex-shrink-0"
                              />
                              <p className="text-[10px] font-semibold text-amber-300">
                                {peopleBeforeMe === 1 
                                  ? "Giliran Anda berikutnya" 
                                  : `Tinggal ${peopleBeforeMe} orang lagi`}
                              </p>
                            </div>
                          </>
                        ) : myNomorUrut != null ? (
                          <>
                            <span className="text-slate-600">•</span>
                            <p className="text-[10px] font-medium text-slate-500">
                              Anda urutan #{myNomorUrut}
                            </p>
                          </>
                        ) : null}
                      </div>
                      <p className="truncate text-xs font-semibold text-white">
                        {activePeserta.nama_agent}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {countdown > 0 && (
                <div className="flex-shrink-0 flex flex-col items-center">
                  <div className="relative flex h-11 w-11 items-center justify-center">
                    <svg className="absolute inset-0 -rotate-90 transform" viewBox="0 0 44 44">
                      <circle
                        cx="22"
                        cy="22"
                        r="18"
                        stroke="currentColor"
                        strokeWidth="3"
                        fill="none"
                        className="text-slate-800"
                      />
                      <circle
                        cx="22"
                        cy="22"
                        r="18"
                        stroke="url(#mobileGradient)"
                        strokeWidth="3"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 18}`}
                        strokeDashoffset={`${2 * Math.PI * 18 * (1 - progress / 100)}`}
                        className="transition-all duration-1000 ease-linear drop-shadow-[0_0_6px_rgba(56,189,248,0.6)]"
                        strokeLinecap="round"
                      />
                      <defs>
                        <linearGradient id="mobileGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#38bdf8" />
                          <stop offset="50%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#a855f7" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <span
                      className={`relative text-base font-black tabular-nums ${
                        isMyTurn ? "text-sky-300" : "text-white"
                      }`}
                    >
                      {countdown}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-1">
              <Icon
                icon="solar:clock-circle-bold"
                className="text-lg text-slate-500"
              />
              <p className="text-xs font-medium text-slate-400">
                Menunggu pemilihan dimulai...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

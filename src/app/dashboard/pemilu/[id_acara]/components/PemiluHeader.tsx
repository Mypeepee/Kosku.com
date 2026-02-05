// components/PemiluHeader.tsx
"use client";

import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

interface Props {
  judul: string;
  tipe: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  durasi_pilih: number | null;
  totalPeserta: number;
  totalPilihan: number;
}

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

type AcaraStatus = "BELUM_MULAI" | "SEDANG_BERLANGSUNG" | "SELESAI";

interface CountdownData {
  status: AcaraStatus;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
}

export default function PemiluHeader(props: Props) {
  const {
    judul,
    tipe,
    tanggal_mulai,
    tanggal_selesai,
    durasi_pilih,
    totalPeserta,
    totalPilihan,
  } = props;

  const [countdown, setCountdown] = useState<CountdownData>({
    status: "BELUM_MULAI",
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    totalSeconds: 0,
  });

  useEffect(() => {
    const calculateCountdown = () => {
      const now = new Date().getTime();
      const mulai = new Date(tanggal_mulai).getTime();
      const selesai = new Date(tanggal_selesai).getTime();

      let status: AcaraStatus;
      let targetTime: number;

      if (now < mulai) {
        status = "BELUM_MULAI";
        targetTime = mulai;
      } else if (now >= mulai && now < selesai) {
        status = "SEDANG_BERLANGSUNG";
        targetTime = selesai;
      } else {
        status = "SELESAI";
        targetTime = selesai;
      }

      const diff = Math.max(0, targetTime - now);
      const totalSeconds = Math.floor(diff / 1000);

      const days = Math.floor(totalSeconds / (3600 * 24));
      const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      setCountdown({
        status,
        days,
        hours,
        minutes,
        seconds,
        totalSeconds,
      });
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);

    return () => clearInterval(interval);
  }, [tanggal_mulai, tanggal_selesai]);

  const getStatusConfig = () => {
    switch (countdown.status) {
      case "BELUM_MULAI":
        return {
          label: "Dimulai dalam",
          icon: "solar:clock-circle-bold",
          gradient: "from-amber-500/20 to-orange-500/20",
          border: "border-amber-500/40",
          textColor: "text-amber-200",
          labelColor: "text-amber-200",
          bgGlow: "shadow-[0_0_30px_rgba(245,158,11,0.3)]",
          pulseColor: "bg-amber-400",
        };
      case "SEDANG_BERLANGSUNG":
        return {
          label: "Berakhir dalam",
          icon: "solar:play-circle-bold",
          gradient: "from-emerald-500/20 to-green-500/20",
          border: "border-emerald-500/40",
          textColor: "text-emerald-200",
          labelColor: "text-emerald-200",
          bgGlow: "shadow-[0_0_30px_rgba(16,185,129,0.4)]",
          pulseColor: "bg-emerald-400",
        };
      case "SELESAI":
        return {
          label: "PEMILU Selesai",
          icon: "solar:check-circle-bold",
          gradient: "from-slate-500/20 to-slate-600/20",
          border: "border-slate-500/40",
          textColor: "text-slate-300",
          labelColor: "text-slate-300",
          bgGlow: "shadow-[0_0_20px_rgba(71,85,105,0.3)]",
          pulseColor: "bg-slate-500",
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-slate-900 to-slate-950 px-4 py-3 md:px-6 md:py-4 shadow-[0_0_40px_rgba(16,185,129,0.3)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Left: Judul & Info */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-400/60">
            <Icon icon="solar:flag-bold" className="text-xl text-emerald-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-semibold text-white">
                {judul}
              </h1>
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">
                {tipe}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-emerald-100/70">
              {formatDateTime(tanggal_mulai)} – {formatDateTime(tanggal_selesai)}{" "}
              · {durasi_pilih ? `${durasi_pilih}s / giliran` : "Durasi default"}
            </p>
          </div>
        </div>

        {/* Right: Stats & Countdown */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-slate-900/70 border border-white/10 px-3 py-2 text-center">
              <p className="text-[10px] text-slate-400">Peserta</p>
              <p className="text-sm font-semibold text-emerald-300">
                {totalPeserta}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-900/70 border border-white/10 px-3 py-2 text-center">
              <p className="text-[10px] text-slate-400">Pilihan</p>
              <p className="text-sm font-semibold text-emerald-300">
                {totalPilihan}
              </p>
            </div>
          </div>

          {/* Countdown Card */}
          <div
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${config.gradient} border ${config.border} px-4 py-3 ${config.bgGlow} min-w-[240px]`}
          >
            {/* Animated Background */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />

            <div className="relative flex items-center gap-3">
              {/* Icon dengan Pulse */}
              <div className="relative flex h-10 w-10 items-center justify-center">
                <span
                  className={`absolute h-10 w-10 rounded-full ${config.pulseColor} opacity-75 ${
                    countdown.status !== "SELESAI" ? "animate-ping" : ""
                  }`}
                />
                <div
                  className={`relative flex h-10 w-10 items-center justify-center rounded-full ${config.gradient} border ${config.border}`}
                >
                  <Icon
                    icon={config.icon}
                    className={`text-xl ${config.textColor}`}
                  />
                </div>
              </div>

              {/* Countdown Content */}
              <div className="flex-1">
                <p className={`text-[10px] font-medium ${config.labelColor}`}>
                  {config.label}
                </p>

                {countdown.status === "SELESAI" ? (
                  <div className="mt-1 flex items-center gap-1">
                    <Icon
                      icon="solar:confetti-bold"
                      className="text-sm text-slate-400"
                    />
                    <p className="text-xs font-semibold text-slate-200">
                      Event telah berakhir
                    </p>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-1.5">
                    {countdown.days > 0 && (
                      <div className="flex flex-col items-center">
                        <span
                          className={`text-lg font-bold tabular-nums leading-none ${config.textColor}`}
                        >
                          {countdown.days}
                        </span>
                        <span className="text-[8px] text-slate-400">hari</span>
                      </div>
                    )}
                    {(countdown.days > 0 || countdown.hours > 0) && (
                      <>
                        {countdown.days > 0 && (
                          <span className="text-slate-600">:</span>
                        )}
                        <div className="flex flex-col items-center">
                          <span
                            className={`text-lg font-bold tabular-nums leading-none ${config.textColor}`}
                          >
                            {String(countdown.hours).padStart(2, "0")}
                          </span>
                          <span className="text-[8px] text-slate-400">jam</span>
                        </div>
                      </>
                    )}
                    <span className="text-slate-600">:</span>
                    <div className="flex flex-col items-center">
                      <span
                        className={`text-lg font-bold tabular-nums leading-none ${config.textColor}`}
                      >
                        {String(countdown.minutes).padStart(2, "0")}
                      </span>
                      <span className="text-[8px] text-slate-400">menit</span>
                    </div>
                    <span className="text-slate-600">:</span>
                    <div className="flex flex-col items-center">
                      <span
                        className={`text-lg font-bold tabular-nums leading-none ${config.textColor}`}
                      >
                        {String(countdown.seconds).padStart(2, "0")}
                      </span>
                      <span className="text-[8px] text-slate-400">detik</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

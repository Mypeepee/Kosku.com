// src/app/dashboard/pemilu/[id_acara]/components/GiliranPanel.tsx
"use client";

import { Icon } from "@iconify/react";
import type { Pilihan } from "../PemiluClient";
import { useEffect, useRef } from "react";

interface Props {
  pilihan: Pilihan[];
}

export default function GiliranPanel({ pilihan }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll ke bawah ketika ada pilihan baru
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [pilihan.length]);

  // Group pilihan berdasarkan waktu (bisa tambahkan timestamp di model nanti)
  const sortedPilihan = [...pilihan].reverse(); // Terbaru di atas

  const getTimeAgo = (index: number) => {
    // Simulasi "baru saja", "1 menit lalu", dll
    // Nanti bisa pakai timestamp real dari data
    const minutesAgo = Math.floor(index / 2);
    if (minutesAgo === 0) return "Baru saja";
    if (minutesAgo === 1) return "1 menit lalu";
    return `${minutesAgo} menit lalu`;
  };

  return (
    <div className="flex h-1/2 min-h-[220px] flex-col rounded-3xl border border-purple-500/30 bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950/30 p-3 md:p-4 shadow-[0_0_40px_rgba(168,85,247,0.3)]">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative flex h-7 w-7 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-500/40">
            <Icon
              icon="solar:bell-bing-bold-duotone"
              className="text-base text-purple-300"
            />
            {pilihan.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-[8px] font-bold text-white border border-slate-900">
                {pilihan.length}
              </span>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-white">
              Aktivitas Realtime
            </p>
            <p className="text-[10px] text-purple-100/80">
              Notifikasi pilihan unit terbaru
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-1 border border-purple-500/30">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
          <span className="text-[10px] font-medium text-purple-200">Live</span>
        </div>
      </div>

      {/* Activity Feed */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar"
      >
        {pilihan.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-6 text-center">
            <div className="relative mb-3">
              <div className="absolute inset-0 animate-ping">
                <Icon
                  icon="solar:bell-off-bold-duotone"
                  className="text-3xl text-slate-700"
                />
              </div>
              <Icon
                icon="solar:bell-off-bold-duotone"
                className="relative text-3xl text-slate-600"
              />
            </div>
            <p className="text-xs font-semibold text-slate-300">
              Belum ada aktivitas
            </p>
            <p className="text-[10px] text-slate-500">
              Pilihan agent akan muncul di sini secara realtime
            </p>
          </div>
        ) : (
          sortedPilihan.map((p, idx) => (
            <div
              key={`${p.id_acara}-${p.id_pilihan}`}
              className="group relative animate-slideInFromTop"
              style={{
                animationDelay: `${idx * 50}ms`,
              }}
            >
              {/* Timeline connector */}
              {idx < sortedPilihan.length - 1 && (
                <div className="absolute left-4 top-10 bottom-0 w-px bg-gradient-to-b from-purple-500/40 to-transparent" />
              )}

              <div className="relative flex gap-3 rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-slate-900/50 p-3 transition-all duration-300 hover:border-purple-500/40 hover:shadow-[0_0_20px_rgba(168,85,247,0.2)]">
                {/* Icon/Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 border-2 border-slate-900 text-[10px] font-bold text-white shadow-lg">
                    {p.nama_agent
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((s) => s[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                  {/* Pulse effect untuk item terbaru */}
                  {idx === 0 && (
                    <span className="absolute inset-0 rounded-full bg-purple-500 opacity-75 animate-ping" />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-white">
                        {p.nama_agent}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        Memilih unit properti
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-[9px] text-purple-300">
                      {getTimeAgo(idx)}
                    </span>
                  </div>

                  {/* Property info card */}
                  <div className="mt-2 rounded-xl border border-white/10 bg-slate-950/60 p-2">
                    <div className="flex items-start gap-2">
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-purple-500/20 border border-purple-500/40">
                        <Icon
                          icon="solar:home-2-bold"
                          className="text-[11px] text-purple-300"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-[11px] font-medium text-slate-100">
                          {p.judul_listing}
                        </p>
                        {p.alamat && (
                          <p className="mt-0.5 line-clamp-1 text-[9px] text-slate-500">
                            {p.alamat}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Price & ID */}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {p.harga && (
                        <span className="text-[10px] font-semibold text-emerald-300">
                          {new Intl.NumberFormat("id-ID", {
                            style: "currency",
                            currency: "IDR",
                            maximumFractionDigits: 0,
                          }).format(Number(p.harga))}
                        </span>
                      )}
                      <span className="rounded-full bg-slate-900/80 px-2 py-0.5 text-[8px] text-slate-400 border border-white/5">
                        ID: {p.id_listing}
                      </span>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/30">
                      <Icon
                        icon="solar:check-circle-bold"
                        className="text-[9px] text-emerald-400"
                      />
                      <span className="text-[9px] font-medium text-emerald-300">
                        Berhasil dipilih
                      </span>
                    </div>
                    <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[9px] text-purple-300 border border-purple-500/30">
                      #{p.id_pilihan}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer indicator */}
      {pilihan.length > 0 && (
        <div className="mt-2 flex items-center justify-center gap-2 text-[9px] text-slate-500">
          <Icon icon="solar:arrow-down-linear" className="text-xs animate-bounce" />
          <span>Scroll untuk melihat lebih banyak</span>
        </div>
      )}
    </div>
  );
}

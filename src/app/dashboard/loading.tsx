// src/app/dashboard/loading.tsx
"use client";

import { Icon } from "@iconify/react";

export default function DashboardSegmentLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="inline-flex flex-col items-center gap-3">
        {/* Lingkaran glow + spinner */}
        <div className="relative">
          <div className="h-14 w-14 rounded-full bg-emerald-500/10 blur-xl" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-10 w-10 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon
              icon="solar:widget-5-linear"
              className="text-emerald-300 text-xl"
            />
          </div>
        </div>

        {/* Teks kecil */}
        <div className="text-center">
          <p className="text-xs font-medium text-slate-100">
            Memuat dashboard Anda...
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Menyiapkan data listing, leads, dan analytics.
          </p>
        </div>
      </div>
    </div>
  );
}

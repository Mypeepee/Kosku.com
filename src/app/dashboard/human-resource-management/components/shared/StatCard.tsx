// app/dashboard/hrm/components/shared/StatCard.tsx
"use client";

import { Icon } from "@iconify/react";

interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  change?: number; // % perubahan
  trend?: "up" | "down" | "neutral";
  subtitle?: string;
  colorScheme?: "emerald" | "amber" | "sky" | "violet" | "rose";
}

export function StatCard({
  icon,
  label,
  value,
  change,
  trend = "neutral",
  subtitle,
  colorScheme = "emerald",
}: StatCardProps) {
  const colorClasses = {
    emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
    amber: "from-amber-500/20 to-amber-500/5 border-amber-500/30",
    sky: "from-sky-500/20 to-sky-500/5 border-sky-500/30",
    violet: "from-violet-500/20 to-violet-500/5 border-violet-500/30",
    rose: "from-rose-500/20 to-rose-500/5 border-rose-500/30",
  };

  const trendIcon = {
    up: "solar:graph-up-bold",
    down: "solar:graph-down-bold",
    neutral: "solar:minus-circle-bold",
  };

  const trendColor = {
    up: "text-emerald-400",
    down: "text-rose-400",
    neutral: "text-slate-400",
  };

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl border
        bg-gradient-to-br ${colorClasses[colorScheme]}
        p-4 transition-all hover:scale-[1.02]
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-9 w-9 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center">
              <Icon icon={icon} className="text-lg text-white/90" />
            </div>
            <span className="text-xs text-slate-300">{label}</span>
          </div>
          
          <div className="space-y-1">
            <p className="text-2xl font-bold text-white">{value}</p>
            {subtitle && (
              <p className="text-xs text-slate-400">{subtitle}</p>
            )}
          </div>
        </div>

        {change !== undefined && (
          <div className={`flex items-center gap-1 ${trendColor[trend]}`}>
            <Icon icon={trendIcon[trend]} className="text-sm" />
            <span className="text-xs font-medium">{Math.abs(change)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

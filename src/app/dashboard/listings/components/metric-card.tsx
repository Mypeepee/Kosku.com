// app/dashboard/listings/components/metric-card.tsx
"use client";

import { Icon } from "@iconify/react";

export type Variant = "primary" | "accent" | "soft";

const variantStyles: Record<
  Variant,
  {
    iconBg: string;
    iconColor: string;
  }
> = {
  primary: {
    iconBg: "bg-emerald-500/15 text-emerald-300",
    iconColor: "text-emerald-300",
  },
  accent: {
    iconBg: "bg-emerald-400/20 text-emerald-200",
    iconColor: "text-emerald-200",
  },
  soft: {
    iconBg: "bg-cyan-500/15 text-cyan-200",
    iconColor: "text-cyan-200",
  },
};

export type MetricCardProps = {
  label: string;
  icon: string;
  main: number;
  suffix?: string;
  description: string;
  variant: Variant;
  percent?: number;
};

export function MetricCard({
  label,
  icon,
  main,
  suffix,
  description,
  variant,
  percent,
}: MetricCardProps) {
  const s = variantStyles[variant];

  return (
    <div
      className="
        group relative flex h-full flex-col justify-between overflow-hidden
        rounded-2xl sm:rounded-3xl 
        border border-emerald-500/25 bg-[#020617]/70
        px-3 py-4 sm:px-5 sm:py-5 
        shadow-[0_0_20px_rgba(15,118,110,0.2)] sm:shadow-[0_0_40px_rgba(15,118,110,0.4)]
        backdrop-blur-xl transition-transform duration-200 hover:-translate-y-1
      "
    >
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <div className="absolute -right-10 -top-10 h-16 w-16 sm:h-24 sm:w-24 rounded-full bg-emerald-500/25 blur-2xl" />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        <div className="mb-3 flex items-start justify-between sm:mb-4">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-xl sm:h-11 sm:w-11 sm:rounded-2xl ${s.iconBg}`}
          >
            <Icon
              icon={icon}
              className={`text-lg sm:text-2xl ${s.iconColor}`}
            />
          </div>

          {typeof percent === "number" && (
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-100 sm:px-2.5 sm:py-1 sm:text-xs">
              {percent}%
            </span>
          )}
        </div>

        <div className="flex-1">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-100 sm:text-xs sm:tracking-[0.18em]">
            {label}
          </h3>

          <div className="mt-1 flex flex-wrap items-baseline gap-1 sm:mt-2 sm:gap-2">
            <span className="text-xl font-bold text-white sm:text-3xl">
              {main.toLocaleString("id-ID")}
            </span>
            {suffix && (
              <span className="text-[10px] font-medium text-slate-300 sm:text-xs sm:text-slate-200">
                {suffix}
              </span>
            )}
          </div>
        </div>

        <p className="mt-3 text-[10px] leading-tight text-slate-400 sm:mt-4 sm:text-[11px] sm:leading-relaxed sm:text-slate-200">
          {description}
        </p>
      </div>
    </div>
  );
}

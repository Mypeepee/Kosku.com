"use client";

import { useSession, signOut } from "next-auth/react";
import { Icon } from "@iconify/react";
import DashboardShell from "./dashboard-shell";
import DashboardTopbar from "./topbar";

export default function DashboardOwnerPage() {
  const { data: session } = useSession();
  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <DashboardShell>
      <DashboardTopbar />

      <div className="px-5 py-6 space-y-6">
        {/* Salam + tanggal */}
        <div>
          <p className="text-xs text-slate-400 mb-1">{today}</p>
          <h1 className="text-2xl font-bold text-white">
            Good morning,{" "}
            <span className="text-emerald-400">
              {session?.user?.name || "Owner"}
            </span>
            !
          </h1>
        </div>

        {/* 3 kartu metrik utama */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: "solar:users-group-rounded-bold",
              label: "Visitors",
              value: "2,110",
              color: "text-blue-400",
              bg: "bg-blue-500/10",
            },
            {
              icon: "solar:dollar-minimalistic-bold",
              label: "Earnings",
              value: "$8.2M",
              color: "text-emerald-400",
              bg: "bg-emerald-500/10",
            },
            {
              icon: "solar:cart-large-bold",
              label: "Orders",
              value: "1,124",
              color: "text-purple-400",
              bg: "bg-purple-500/10",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-2xl border border-white/5 bg-[#0a0c10] p-5 hover:border-white/10 transition-all"
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${item.bg}`}
              >
                <Icon icon={item.icon} className={`text-2xl ${item.color}`} />
              </div>
              <div>
                <p className="text-xs text-slate-400">{item.label}</p>
                <p className="text-2xl font-bold text-white">{item.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Layout utama: kiri orders, tengah earnings, kanan visitor */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)]">
          {/* Kiri: summary & orders */}
          <div className="rounded-2xl border border-white/5 bg-[#05070b] p-6">
            <p className="mb-1 text-xs text-slate-400">
              Updates from yesterday.
            </p>

            <div className="mt-4 space-y-4">
              {[
                {
                  icon: "solar:users-group-rounded-bold",
                  value: "2,110",
                  suffix: "Visitors",
                },
                {
                  icon: "solar:dollar-minimalistic-bold",
                  value: "$8.2M",
                  suffix: "Earnings",
                },
                {
                  icon: "solar:cart-large-bold",
                  value: "1,124",
                  suffix: "Orders",
                },
              ].map((m, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-slate-400">
                    <Icon icon={m.icon} className="text-lg" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-xl font-semibold text-white">
                      {m.value}
                    </p>
                    <p className="text-xs text-slate-400">{m.suffix}</p>
                  </div>
                </div>
              ))}

              <div className="my-4 h-px w-full bg-white/10" />

              <p className="mb-3 text-xs text-slate-400">
                You have{" "}
                <span className="font-semibold text-white">16 orders</span>{" "}
                today.
              </p>

              <div className="space-y-3">
                {[
                  { name: "Advanced Soft Couch", price: "$427" },
                  { name: "Handmade Cotton Chair", price: "$472" },
                  { name: "Rustic Rubber Chair", price: "$389" },
                ].map((order, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#050608] p-3 hover:border-emerald-400/40 transition-all"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/5 text-slate-500">
                      <Icon icon="solar:box-linear" className="text-2xl" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {order.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {order.price}
                      </p>
                    </div>
                    <button className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 hover:bg-emerald-500/10 hover:border-emerald-400/40 transition-all">
                      <Icon
                        icon="solar:arrow-right-linear"
                        className="text-sm text-slate-400"
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tengah: Monthly earnings chart */}
          <div className="rounded-2xl border border-white/5 bg-[#0a0c10] p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">Monthly Earnings</p>
                <p className="text-sm text-slate-300 mb-2">
                  Total profit gained
                </p>
                <p className="text-3xl font-bold text-white">$25,049</p>
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400">
                  <Icon icon="solar:arrow-up-linear" className="text-sm" />
                  +4.33%
                  <span className="ml-1 text-slate-400">vs last month</span>
                </div>
              </div>
              <button className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 hover:bg-white/5">
                <Icon
                  icon="solar:menu-dots-linear"
                  className="text-slate-400"
                />
              </button>
            </div>

            <div className="relative h-32 w-full rounded-xl bg-[#050608] border border-white/5 flex items-end justify-around px-4 pb-4">
              {[40, 60, 50, 80, 70, 90, 85].map((h, i) => (
                <div
                  key={i}
                  className="w-2 rounded-t-full bg-gradient-to-t from-blue-500 to-blue-300"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>

          {/* Kanan: Visitor */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/5 bg-[#0a0c10] p-6">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Visitor Value</p>
                  <p className="text-sm text-slate-300 mb-2">
                    Avg. income per site visit
                  </p>
                  <p className="text-3xl font-bold text-white">$63.02</p>
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400">
                    <Icon
                      icon="solar:arrow-down-linear"
                      className="text-sm"
                    />
                    -1.03%
                    <span className="ml-1 text-slate-400">
                      vs last month
                    </span>
                  </div>
                </div>
                <button className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 hover:bg-white/5">
                  <Icon
                    icon="solar:menu-dots-linear"
                    className="text-slate-400"
                  />
                </button>
              </div>

              <div className="relative h-24 w-full rounded-xl bg-[#050608] border border-white/5 flex items-end justify-around px-2 pb-2">
                {[50, 70, 80, 65, 90, 75, 85, 95, 70].map((h, i) => (
                  <div
                    key={i}
                    className="w-1.5 rounded-t-sm bg-gradient-to-t from-blue-500 to-blue-300"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Revenue Generated section (full width bawah) */}
        <div className="rounded-2xl border border-white/5 bg-[#0a0c10] p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Revenue Generated
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Amount of revenue in this month comparing to last year
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <button className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#050608] px-3 py-2 text-xs text-slate-200 hover:bg-white/5">
                  Last month
                  <Icon
                    icon="solar:alt-arrow-down-linear"
                    className="text-xs text-slate-400"
                  />
                </button>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1 text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  Last year
                </div>
                <div className="flex items-center gap-1 text-blue-400">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  This year
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-400 font-medium">
                  +6.19%
                </div>
              </div>
            </div>
          </div>

          {/* Line chart placeholder (2 garis) */}
          <div className="relative h-40 w-full rounded-xl bg-[#050608] border border-white/5 px-4 pb-6 pt-4">
            {/* grid garis vertikal */}
            <div className="absolute inset-4 flex justify-between">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="h-full w-px bg-white/5"
                />
              ))}
            </div>

            <div className="relative h-full w-full">
              {/* Last year */}
              <svg className="absolute inset-0 h-full w-full">
                <polyline
                  fill="none"
                  stroke="#9CA3AF"
                  strokeWidth="2"
                  points="5,60 40,50 75,55 110,53 145,52 180,48 215,45"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              {/* This year */}
              <svg className="absolute inset-0 h-full w-full">
                <polyline
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="2.5"
                  points="5,40 40,60 75,35 110,45 145,42 180,55 215,50"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* labels bawah (tanggal) */}
            <div className="absolute bottom-1 left-0 right-0 px-4 flex justify-between text-[10px] text-slate-500">
              <span>Jan 09</span>
              <span>Jan 11</span>
              <span>Jan 13</span>
              <span>Jan 15</span>
              <span>Jan 17</span>
              <span>Jan 19</span>
              <span>Jan 23</span>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

"use client";

import { Icon } from "@iconify/react";
import { motion } from "framer-motion";

interface PemiluStatsProps {
  totalProperties: number;
  selectedCount: number;
  participantsCount: number;
}

export default function PemiluStats({
  totalProperties,
  selectedCount,
  participantsCount,
}: PemiluStatsProps) {
  const stats = [
    {
      icon: "solar:buildings-3-bold",
      label: "Total Property",
      value: totalProperties,
      color: "blue",
    },
    {
      icon: "solar:check-circle-bold",
      label: "Terpilih",
      value: selectedCount,
      color: "emerald",
    },
    {
      icon: "solar:home-2-bold",
      label: "Tersedia",
      value: totalProperties - selectedCount,
      color: "purple",
    },
    {
      icon: "solar:users-group-rounded-bold",
      label: "Peserta",
      value: participantsCount,
      color: "orange",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat, idx) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: idx * 0.05 }}
          className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-4 backdrop-blur-xl transition-all hover:scale-105"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/5 opacity-0 transition-opacity group-hover:opacity-100" />
          
          <div className="relative flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl bg-${stat.color}-500/20 border border-${stat.color}-500/30`}
            >
              <Icon icon={stat.icon} className={`text-2xl text-${stat.color}-400`} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">{stat.label}</p>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

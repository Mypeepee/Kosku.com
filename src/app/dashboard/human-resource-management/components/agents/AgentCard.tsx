// app/dashboard/hrm/components/agents/AgentCard.tsx
"use client";

import { Icon } from "@iconify/react";
import { Agent } from "../../types/agent.types";
import { Avatar } from "../shared/Avatar";
import { StatusBadge, RoleBadge } from "../shared/Badge";

interface AgentCardProps {
  agent: Agent;
  onClick: () => void;
  isSelected?: boolean;
}

export function AgentCard({ agent, onClick, isSelected }: AgentCardProps) {
  const baseBg =
    "bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-900/40";
  const hoverBg =
    "hover:from-slate-900/90 hover:via-slate-900/70 hover:to-slate-900/50";

  const selectedBg =
    "bg-gradient-to-br from-emerald-500/20 via-slate-900/60 to-slate-900/40";
  const selectedBorder =
    "border-emerald-400/60 shadow-lg shadow-emerald-500/20";
  const normalBorder = "border-white/10 shadow-sm shadow-black/40";

  // Normalisasi rating supaya aman dipakai toFixed
  const numericRating = Number(agent.rating || 0);

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left p-4 rounded-2xl border transition-all duration-200
        ${isSelected ? selectedBg : baseBg}
        ${isSelected ? selectedBorder : normalBorder}
        ${!isSelected ? hoverBg : ""}
      `}
    >
      <div className="flex items-start gap-3 mb-3">
        <Avatar
          src={agent.foto_profil_url}
          name={agent.nama_lengkap}
          size="md"
        />

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-white truncate">
            {agent.nama_lengkap}
          </h4>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <RoleBadge role={agent.jabatan} />
            <StatusBadge status={agent.status_keanggotaan} />
          </div>
        </div>
      </div>

      <div className="space-y-2 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <Icon
            icon="solar:buildings-3-bold"
            className="text-slate-400"
          />
          <span className="truncate">{agent.nama_kantor}</span>
        </div>

        <div className="flex items-center gap-2">
          <Icon icon="solar:map-point-bold" className="text-slate-400" />
          <span>{agent.kota_area}</span>
        </div>
      </div>

      {/* Rating */}
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="flex items-center justify-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15 border border-amber-400/40">
            <Icon
              icon="solar:star-bold"
              className="text-amber-300 text-sm"
            />
          </div>
          <p className="text-sm font-semibold text-white">
            {numericRating.toFixed(1)}
          </p>
          <p className="text-[11px] text-slate-400">Rating</p>
        </div>
      </div>
    </button>
  );
}

// app/dashboard/hrm/components/agents/AgentFilters.tsx
"use client";

import { Icon } from "@iconify/react";
import { AgentFilters } from "../../types/agent.types";

interface AgentFiltersProps {
  filters: AgentFilters;
  onFilterChange: (filters: AgentFilters) => void;
}

export function AgentFiltersComponent({
  filters,
  onFilterChange,
}: AgentFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {/* Search: nama, kantor, kota, WA */}
      <div className="relative flex-1 min-w-[240px]">
        <Icon
          icon="solar:magnifer-bold"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none"
        />
        <input
          value={filters.search}
          onChange={(e) =>
            onFilterChange({ ...filters, search: e.target.value })
          }
          placeholder="Cari nama, kantor, kota, atau nomor WA..."
          className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50"
        />
      </div>

      {/* Status akun */}
      <select
        value={filters.status}
        onChange={(e) =>
          onFilterChange({ ...filters, status: e.target.value as any })
        }
        className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 min-w-[160px]"
      >
        <option value="">Status: Semua</option>
        <option value="AKTIF">Aktif</option>
        <option value="PENDING">Pending</option>
        <option value="SUSPEND">Suspend</option>
      </select>

      {/* Jabatan agent */}
      <select
        value={filters.jabatan}
        onChange={(e) =>
          onFilterChange({ ...filters, jabatan: e.target.value as any })
        }
        className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 min-w-[180px]"
      >
        <option value="">Jabatan: Semua</option>
        <option value="PRINCIPAL">Principal</option>
        <option value="STOKER">Stoker</option>
        <option value="ADMIN">Admin</option>
        <option value="OWNER">Owner</option>
        <option value="AGENT">Agent</option>
        <option value="TEAMLEADER">Team Leader</option>
      </select>
    </div>
  );
}

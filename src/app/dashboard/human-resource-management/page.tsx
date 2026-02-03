// app/dashboard/hrm/page.tsx
"use client";

import { useState } from "react";
import { useAgents } from "./hooks/useAgents";
import { useAgentFilters } from "./hooks/useAgentFilters";
import { MetricsGrid } from "./components/overview/MetricsGrid";
import { AgentFiltersComponent } from "./components/agents/AgentFilters";
import { AgentTable } from "./components/agents/AgentTable";
import { AgentDetailPanel } from "./components/agents/AgentDetailPanel";
import { Agent } from "./types/agent.types";
import { Icon } from "@iconify/react";

export default function HRMPage() {
  const {
    agents,
    loading,
    metrics,
    updateAgentStatus,
    updateAgentOffice,
  } = useAgents();
  const { filters, setFilters, filteredAgents } = useAgentFilters(agents);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Memuat data HRM...</p>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
          Human Resource Management
        </h1>
        <p className="text-sm text-slate-400">
          Kelola agent, pantau performa, dan buat keputusan berbasis data real-time
        </p>
      </div>

      {/* Metrics Overview */}
      <MetricsGrid metrics={metrics} />

      {/* Agent List & Detail */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-5">
        {/* List */}
        <div className="bg-[#05060A] border border-white/5 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Daftar Agent</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Menampilkan {filteredAgents.length} dari {agents.length} agent
              </p>
            </div>
          </div>

          <AgentFiltersComponent filters={filters} onFilterChange={setFilters} />
          <AgentTable
            agents={filteredAgents}
            onSelectAgent={setSelectedAgent}
            selectedId={selectedAgent?.id_agent}
          />
        </div>

        {/* Detail Panel */}
        <div className="bg-[#05060A] border border-white/5 rounded-2xl p-5 sticky top-6 max-h-[calc(100vh-120px)] overflow-y-auto">
          <AgentDetailPanel
            agent={selectedAgent}
            onUpdateStatus={updateAgentStatus}
            onUpdateOffice={updateAgentOffice}
          />
        </div>
      </div>
    </div>
  );
}

// Optional: kalau masih mau quick actions, bisa dipakai di section lain
function ActionButton({
  icon,
  label,
  onClick,
  variant = "primary",
}: {
  icon: string;
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
}) {
  const styles =
    variant === "primary"
      ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/50 hover:bg-emerald-500/25"
      : "bg-white/5 text-slate-200 border-white/10 hover:bg-white/10";

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${styles}`}
    >
      <Icon icon={icon} className="text-lg" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

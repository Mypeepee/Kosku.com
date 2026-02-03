// app/dashboard/hrm/components/agents/AgentTable.tsx
"use client";

import { Agent } from "../../types/agent.types";
import { AgentCard } from "./AgentCard";

interface AgentTableProps {
  agents: Agent[];
  onSelectAgent: (agent: Agent) => void;
  selectedId?: string;
}

export function AgentTable({ agents, onSelectAgent, selectedId }: AgentTableProps) {
  if (agents.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        <p>Tidak ada agent yang cocok dengan filter</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {agents.map((agent) => (
        <AgentCard
          key={agent.id_agent}
          agent={agent}
          onClick={() => onSelectAgent(agent)}
          isSelected={selectedId === agent.id_agent}
        />
      ))}
    </div>
  );
}

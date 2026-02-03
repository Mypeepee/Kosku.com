// app/dashboard/hrm/components/overview/MetricsGrid.tsx
"use client";

import { AgentMetrics } from "../../types/agent.types";
import { StatCard } from "../shared/StatCard";

interface MetricsGridProps {
  metrics: AgentMetrics;
}

export function MetricsGrid({ metrics }: MetricsGridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon="solar:users-group-rounded-bold"
        label="Total Agent"
        value={metrics.totalAgents}
        change={metrics.growthRate}
        trend="up"
        subtitle={`${metrics.activeAgents} aktif`}
        colorScheme="emerald"
      />

      <StatCard
        icon="solar:shield-check-bold"
        label="Agent Aktif"
        value={metrics.activeAgents}
        subtitle={
          metrics.totalAgents
            ? `${(
                (metrics.activeAgents / metrics.totalAgents) *
                100
              ).toFixed(1)}% dari total`
            : "0% dari total"
        }
        colorScheme="sky"
      />

      <StatCard
        icon="solar:clock-circle-bold"
        label="Pending Review"
        value={metrics.pendingAgents}
        subtitle="Perlu verifikasi"
        colorScheme="amber"
      />

      <StatCard
        icon="solar:star-bold"
        label="Avg Rating"
        value={metrics.avgRating.toFixed(2)}
        subtitle="Performa tim"
        colorScheme="amber"
      />
    </div>
  );
}

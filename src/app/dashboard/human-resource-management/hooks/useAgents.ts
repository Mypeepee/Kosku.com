// app/dashboard/hrm/hooks/useAgents.ts
"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Agent, AgentMetrics, AgentStatus } from "../types/agent.types";

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const res = await fetch("/api/dashboard/hrm");
      if (!res.ok) throw new Error("Gagal mengambil data");
      const json = await res.json();
      const list = (json.agents || []) as Agent[];
      setAgents(list);
      calculateMetrics(list);
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat data HRM.");
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = (agentList: Agent[]) => {
    const active = agentList.filter((a) => a.status_keanggotaan === "AKTIF");
    const pending = agentList.filter((a) => a.status_keanggotaan === "PENDING");
    const totalClosing = agentList.reduce(
      (sum, a) => sum + a.jumlah_closing,
      0
    );
    const totalOmset = agentList.reduce(
      (sum, a) => sum + Number(a.total_omset || 0),
      0
    );
    const avgRating = agentList.length
      ? agentList.reduce((s, a) => s + Number(a.rating || 0), 0) /
        agentList.length
      : 0;
    const topPerformer =
      agentList.slice().sort((a, b) => b.jumlah_closing - a.jumlah_closing)[0] ||
      null;

    setMetrics({
      totalAgents: agentList.length,
      activeAgents: active.length,
      pendingAgents: pending.length,
      totalClosing,
      totalOmset,
      avgRating,
      growthRate: 12.5,
      topPerformer,
    });
  };

  const updateAgentStatus = async (
    id_agent: string,
    status: AgentStatus
  ): Promise<boolean> => {
    try {
      // SESUAIKAN PATH DENGAN ROUTE KAMU
      const res = await fetch("/api/HRM/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_agent, status_keanggotaan: status }),
      });
      if (!res.ok) throw new Error("Gagal update status");
      const json = await res.json();
      const updated = json.agent as Agent;

      setAgents((prev) =>
        prev.map((a) => (a.id_agent === updated.id_agent ? updated : a))
      );
      toast.success("Status agent diperbarui.");
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Gagal memperbarui status agent.");
      return false;
    }
  };

  const updateAgentOffice = async (
    id_agent: string,
    nama_kantor: string
  ): Promise<boolean> => {
    try {
      // SESUAIKAN PATH DENGAN ROUTE KAMU
      const res = await fetch("/api/HRM/agent-office", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_agent, nama_kantor }),
      });
      if (!res.ok) throw new Error("Gagal update kantor");
      const json = await res.json();
      const updated = json.agent as Agent;

      setAgents((prev) =>
        prev.map((a) => (a.id_agent === updated.id_agent ? updated : a))
      );
      toast.success("Nama kantor agent diperbarui.");
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Gagal memperbarui nama kantor.");
      return false;
    }
  };

  return {
    agents,
    loading,
    metrics,
    updateAgentStatus,
    updateAgentOffice,
    refetch: loadAgents,
  };
}

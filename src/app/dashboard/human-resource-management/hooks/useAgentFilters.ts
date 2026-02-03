// app/dashboard/hrm/hooks/useAgentFilters.ts
import { useState, useMemo } from "react";
import { Agent, AgentFilters } from "../types/agent.types";

export function useAgentFilters(agents: Agent[]) {
  const [filters, setFilters] = useState<AgentFilters>({
    search: "",
    status: "",
    jabatan: "",
    kota: "", // boleh dibiarkan atau hapus dari type, tapi tidak dipakai lagi
  });

  const filteredAgents = useMemo(() => {
    return agents.filter((a) => {
      const term = filters.search.toLowerCase().trim();

      const matchSearch =
        !term ||
        a.nama_lengkap.toLowerCase().includes(term) ||
        a.nama_kantor.toLowerCase().includes(term) ||
        a.kota_area.toLowerCase().includes(term) ||
        a.nomor_whatsapp.toLowerCase().includes(term);

      const matchStatus =
        !filters.status || a.status_keanggotaan === filters.status;
      const matchJabatan =
        !filters.jabatan || a.jabatan === filters.jabatan;

      return matchSearch && matchStatus && matchJabatan;
    });
  }, [agents, filters]);

  return { filters, setFilters, filteredAgents };
}

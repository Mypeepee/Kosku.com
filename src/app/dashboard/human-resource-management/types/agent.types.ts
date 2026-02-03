// app/dashboard/hrm/types/agent.types.ts
export type AgentStatus = "AKTIF" | "PENDING" | "NONAKTIF";
export type AgentRole = "MANAGER" | "SALES LEAD" | "AGENT";

export interface Agent {
  id_agent: string;
  id_pengguna: string;
  nama_lengkap: string;
  nama_kantor: string;
  kota_area: string;
  jabatan: AgentRole;
  id_upline: string | null;
  nama_upline?: string | null;
  rating: number;
  jumlah_closing: number;
  total_omset: number;
  nomor_whatsapp: string;
  foto_profil_url: string | null;
  status_keanggotaan: AgentStatus;
  tanggal_gabung: string | null;
}

export interface AgentMetrics {
  totalAgents: number;
  activeAgents: number;
  pendingAgents: number;
  totalClosing: number;
  totalOmset: number;
  avgRating: number;
  growthRate: number; // % pertumbuhan agent bulan ini
  topPerformer: Agent | null;
}

export interface AgentFilters {
  search: string;
  status: AgentStatus | "";
  jabatan: AgentRole | "";
  kota: string;
}

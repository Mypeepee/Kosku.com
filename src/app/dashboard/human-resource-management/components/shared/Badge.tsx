// app/dashboard/hrm/components/shared/Badge.tsx
import { AgentStatus, AgentRole } from "../../types/agent.types";

export function StatusBadge({ status }: { status: AgentStatus }) {
  const styles = {
    AKTIF: "bg-emerald-500/15 text-emerald-300 border-emerald-400/50",
    PENDING: "bg-amber-500/15 text-amber-300 border-amber-400/50",
    NONAKTIF: "bg-rose-500/15 text-rose-300 border-rose-400/50",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border ${styles[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      {status}
    </span>
  );
}

export function RoleBadge({ role }: { role: AgentRole }) {
  const styles = {
    MANAGER: "bg-violet-500/15 text-violet-300 border-violet-400/50",
    "SALES LEAD": "bg-sky-500/15 text-sky-300 border-sky-400/50",
    AGENT: "bg-slate-700/60 text-slate-200 border-slate-500/50",
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${styles[role]}`}>
      {role}
    </span>
  );
}

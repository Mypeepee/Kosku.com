// app/dashboard/hrm/components/agents/AgentDetailPanel.tsx
"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { Agent, AgentStatus } from "../../types/agent.types";
import { Avatar } from "../shared/Avatar";
import { StatusBadge, RoleBadge } from "../shared/Badge";

interface AgentDetailPanelProps {
  agent: Agent | null;
  onUpdateStatus: (id: string, status: AgentStatus) => Promise<boolean>;
  onUpdateOffice?: (id: string, nama_kantor: string) => Promise<boolean>;
}

export function AgentDetailPanel({
  agent,
  onUpdateStatus,
  onUpdateOffice,
}: AgentDetailPanelProps) {
  const [updating, setUpdating] = useState(false);
  const [officeEditing, setOfficeEditing] = useState(false);
  const [officeName, setOfficeName] = useState(agent?.nama_kantor ?? "");
  const [savingOffice, setSavingOffice] = useState(false);

  // ✅ Sinkronkan officeName hanya ketika agent berubah, bukan saat user ngetik
  useEffect(() => {
    if (agent) {
      setOfficeName(agent.nama_kantor ?? "");
      setOfficeEditing(false);
      setSavingOffice(false);
    }
  }, [agent]);

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4">
        <Icon
          icon="solar:user-hand-up-bold-duotone"
          className="text-5xl text-slate-600 mb-4"
        />
        <h3 className="text-sm font-medium text-slate-300 mb-1">
          Pilih Agent
        </h3>
        <p className="text-xs text-slate-500">
          Klik salah satu agent untuk melihat detail dan mengelola status
        </p>
      </div>
    );
  }

  const handleStatusChange = async (status: AgentStatus) => {
    setUpdating(true);
    await onUpdateStatus(agent.id_agent, status);
    setUpdating(false);
  };

  const handleSaveOffice = async () => {
    if (!onUpdateOffice) {
      setOfficeEditing(false);
      return;
    }
    // boleh simpan kosong, jadi jangan return saat kosong
    const trimmed = officeName.trim();
    setSavingOffice(true);
    const ok = await onUpdateOffice(agent.id_agent, trimmed);
    setSavingOffice(false);
    if (ok) {
      setOfficeEditing(false);
    }
  };

  const numericRating = Number(agent.rating || 0);
  const numericOmset = Number(agent.total_omset || 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar
          src={agent.foto_profil_url}
          name={agent.nama_lengkap}
          size="lg"
          status="online"
        />

        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-white mb-1">
            {agent.nama_lengkap}
          </h3>
          <div className="flex flex-wrap gap-2">
            <RoleBadge role={agent.jabatan} />
            <StatusBadge status={agent.status_keanggotaan} />
          </div>
        </div>
      </div>

      {/* Info Cards (nama kantor editable) */}
      <div className="grid grid-cols-2 gap-3">
        <OfficeCard
          icon="solar:buildings-3-bold"
          label="Kantor"
          value={officeName}
          editing={officeEditing}
          onChange={(v) => setOfficeName(v)}
          onEdit={() => setOfficeEditing(true)}
          onCancel={() => {
            setOfficeEditing(false);
            setOfficeName(agent.nama_kantor ?? "");
          }}
          onSave={handleSaveOffice}
          saving={savingOffice}
        />

        <InfoCard
          icon="solar:map-point-bold"
          label="Area"
          value={agent.kota_area}
        />
        <InfoCard
          icon="solar:phone-calling-rounded-bold"
          label="WhatsApp"
          value={agent.nomor_whatsapp}
          href={`https://wa.me/${agent.nomor_whatsapp.replace(/[^0-9]/g, "")}`}
        />
        <InfoCard
          icon="solar:calendar-bold"
          label="Bergabung"
          value={
            agent.tanggal_gabung
              ? new Date(agent.tanggal_gabung).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "-"
          }
        />
      </div>

      {agent.nama_upline && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/5 px-3 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center">
            <Icon
              icon="solar:hierarchy-bold"
              className="text-emerald-300 text-lg"
            />
          </div>
          <div>
            <p className="text-[10px] text-emerald-200/80 uppercase tracking-wide">
              Upline
            </p>
            <p className="text-xs font-medium text-white">
              {agent.nama_upline}
            </p>
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      <div className="rounded-2xl border border-emerald-400/40 bg-gradient-to-br from-emerald-500/15 via-slate-900/60 to-sky-500/10 p-4 space-y-3 shadow-[0_18px_40px_-24px_rgba(16,185,129,0.8)]">
        <h4 className="text-xs font-semibold text-emerald-100 uppercase tracking-[0.2em]">
          Performance Overview
        </h4>

        <div className="grid grid-cols-3 gap-3">
          <MetricBox
            icon="solar:star-bold"
            label="Rating"
            value={numericRating.toFixed(2)}
            color="amber"
          />
          <MetricBox
            icon="solar:cup-star-bold"
            label="Closing"
            value={agent.jumlah_closing}
            color="emerald"
          />
          <MetricBox
            icon="solar:wallet-money-bold"
            label="Omset"
            value={`Rp ${(numericOmset / 1_000_000).toFixed(1)}M`}
            color="sky"
          />
        </div>
      </div>

      {/* Status Actions (AKTIF / PENDING / SUSPEND) */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-black/60 to-emerald-500/10 p-4 space-y-3">
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-[0.2em] mb-1">
          Kelola Status Akun
        </h4>

        <p className="text-[11px] text-slate-400 mb-2">
          Atur status akun agent: Aktif untuk agent yang bisa bertransaksi,
          Pending untuk menunggu verifikasi, Suspend untuk membekukan akses.
        </p>

        <div className="grid grid-cols-3 gap-2">
          <StatusButton
            label="Aktif"
            icon="solar:shield-check-bold"
            active={agent.status_keanggotaan === "AKTIF"}
            color="emerald"
            disabled={updating}
            onClick={() => handleStatusChange("AKTIF")}
          />

          <StatusButton
            label="Pending"
            icon="solar:clock-circle-bold"
            active={agent.status_keanggotaan === "PENDING"}
            color="amber"
            disabled={updating}
            onClick={() => handleStatusChange("PENDING")}
          />

          <StatusButton
            label="Suspend"
            icon="solar:shield-cross-bold"
            active={agent.status_keanggotaan === "SUSPEND"}
            color="rose"
            disabled={updating}
            onClick={() => handleStatusChange("SUSPEND")}
          />
        </div>
      </div>
    </div>
  );
}

/* === Sub components === */

function OfficeCard(props: {
  icon: string;
  label: string;
  value: string;
  editing: boolean;
  saving: boolean;
  onChange: (v: string) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const {
    icon,
    label,
    value,
    editing,
    saving,
    onChange,
    onEdit,
    onCancel,
    onSave,
  } = props;

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl border border-white/10 bg-gradient-to-br from-white/5 via-black/50 to-slate-900/80">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-400/40 flex items-center justify-center">
          <Icon icon={icon} className="text-emerald-300 text-base" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wide">
            {label}
          </p>
          {editing ? (
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full bg-black/40 border border-emerald-400/60 rounded-lg px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              placeholder="Nama kantor"
            />
          ) : (
            <p className="text-xs font-medium text-white truncate">
              {value || "—"}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {editing ? (
          <>
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="px-2.5 py-1 rounded-lg text-[10px] text-slate-300 border border-white/15 bg-black/40 hover:bg-white/5 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="px-2.5 py-1 rounded-lg text-[10px] text-emerald-200 border border-emerald-400/60 bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-50"
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onEdit}
            className="px-2.5 py-1 rounded-lg text-[10px] text-slate-200 border border-white/15 bg-black/40 hover:bg-white/5"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
  href,
}: {
  icon: string;
  label: string;
  value: string;
  href?: string;
}) {
  const Content = () => (
    <>
      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-400/40 flex items-center justify-center">
        <Icon icon={icon} className="text-emerald-300 text-base" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-xs font-medium text-white truncate">{value}</p>
      </div>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2.5 p-3 rounded-xl border border-white/10 bg-gradient-to-br from-white/5 via-black/50 to-emerald-500/10 hover:border-emerald-400/60 hover:bg-emerald-500/15 transition-colors"
    >
        <Content />
        <Icon
          icon="solar:link-minimalistic-bold"
          className="text-slate-400 text-xs"
        />
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2.5 p-3 rounded-xl border border-white/10 bg-gradient-to-br from-white/5 via-black/50 to-slate-900/80">
      <Content />
    </div>
  );
}

function MetricBox({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string | number;
  color: "amber" | "emerald" | "sky";
}) {
  const colors = {
    amber: "text-amber-300 bg-amber-500/10 border-amber-400/40",
    emerald: "text-emerald-300 bg-emerald-500/10 border-emerald-400/40",
    sky: "text-sky-300 bg-sky-500/10 border-sky-400/40",
  };

  return (
    <div
      className={`text-center p-3 rounded-xl border ${colors[color]} bg-opacity-60`}
    >
      <Icon icon={icon} className="text-xl mx-auto mb-2" />
      <p className="text-lg font-bold text-white mb-0.5">{value}</p>
      <p className="text-[10px] text-slate-200">{label}</p>
    </div>
  );
}

function StatusButton({
  label,
  icon,
  active,
  color,
  disabled,
  onClick,
}: {
  label: string;
  icon: string;
  active: boolean;
  color: "emerald" | "amber" | "rose";
  disabled?: boolean;
  onClick: () => void;
}) {
  const colorBase = {
    emerald: "bg-emerald-500/15 text-emerald-200 border-emerald-400/60",
    amber: "bg-amber-500/15 text-amber-200 border-amber-400/60",
    rose: "bg-rose-500/15 text-rose-200 border-rose-400/60",
  };
  const colorActive = {
    emerald: "bg-emerald-500/30",
    amber: "bg-amber-500/30",
    rose: "bg-rose-500/30",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        px-3 py-2 rounded-xl text-[11px] font-medium border flex items-center justify-center gap-1.5
        ${colorBase[color]}
        ${active ? colorActive[color] + " ring-1 ring-white/40" : ""}
        disabled:opacity-40 disabled:cursor-not-allowed
      `}
    >
      <Icon icon={icon} className="text-xs" />
      <span>{label}</span>
    </button>
  );
}

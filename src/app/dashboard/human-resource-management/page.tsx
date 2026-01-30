// src/app/dashboard/hrm/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";

type Agent = {
  id_agent: string;
  id_pengguna: string;
  nama_lengkap: string;
  nama_kantor: string;
  kota_area: string;
  jabatan: string;
  id_upline: string | null;
  nama_upline?: string | null;
  rating: number;
  jumlah_closing: number;
  total_omset: number;
  nomor_whatsapp: string;
  foto_profil_url: string | null;
  status_keanggotaan: string;
  tanggal_gabung: string | null;
};

const statusBadgeClass: Record<string, string> = {
  AKTIF:
    "bg-emerald-500/10 text-emerald-300 border border-emerald-400/40",
  PENDING: "bg-amber-500/10 text-amber-300 border border-amber-400/40",
  NONAKTIF: "bg-rose-500/10 text-rose-300 border border-rose-400/40",
};

const jabatanColor: Record<string, string> = {
  MANAGER: "bg-violet-500/10 text-violet-300 border border-violet-400/40",
  "SALES LEAD":
    "bg-sky-500/10 text-sky-300 border border-sky-400/40",
  AGENT: "bg-slate-700/60 text-slate-100 border border-slate-500/40",
};

function buildDriveImageUrl(idOrUrl?: string | null) {
  if (!idOrUrl) return null;
  if (!idOrUrl.includes("http")) {
    return `https://drive.google.com/uc?export=view&id=${idOrUrl}`;
  }
  try {
    const url = new URL(idOrUrl);
    const idFromQuery = url.searchParams.get("id");
    if (idFromQuery) {
      return `https://drive.google.com/uc?export=view&id=${idFromQuery}`;
    }
    const match = url.pathname.match(/\/d\/([^/]+)/);
    if (match?.[1]) {
      return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
  } catch {
    // ignore
  }
  return null;
}

export default function HRMPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | string>("");
  const [filterJabatan, setFilterJabatan] = useState<"" | string>("");
  const [filterKota, setFilterKota] = useState<"" | string>("");

  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // metrics
  const totalAgents = agents.length;
  const activeAgents = agents.filter(
    (a) => a.status_keanggotaan === "AKTIF"
  ).length;
  const pendingAgents = agents.filter(
    (a) => a.status_keanggotaan === "PENDING"
  ).length;
  const totalClosing = agents.reduce(
    (sum, a) => sum + a.jumlah_closing,
    0
  );
  const totalOmset = agents.reduce(
    (sum, a) => sum + Number(a.total_omset || 0),
    0
  );

  useEffect(() => {
    const loadAgents = async () => {
      try {
        // endpoint disesuaikan dengan route.ts: GET /api/dashboard/hrm
        const res = await fetch("/api/dashboard/hrm");
        if (!res.ok) throw new Error("Gagal mengambil data agent");
        const json = await res.json();
        setAgents(json.agents || []);
      } catch (err) {
        console.error(err);
        toast.error("Gagal memuat data HRM.");
      } finally {
        setLoading(false);
      }
    };
    loadAgents();
  }, []);

  const filteredAgents = agents.filter((a) => {
    const term = search.toLowerCase();
    const matchSearch =
      !term ||
      a.nama_lengkap.toLowerCase().includes(term) ||
      a.nama_kantor.toLowerCase().includes(term) ||
      a.kota_area.toLowerCase().includes(term) ||
      a.nomor_whatsapp.toLowerCase().includes(term);
    const matchStatus =
      !filterStatus || a.status_keanggotaan === filterStatus;
    const matchJabatan = !filterJabatan || a.jabatan === filterJabatan;
    const matchKota =
      !filterKota || a.kota_area.toLowerCase() === filterKota.toLowerCase();
    return matchSearch && matchStatus && matchJabatan && matchKota;
  });

  const handleChangeStatus = async (status: "AKTIF" | "NONAKTIF") => {
    if (!selectedAgent) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch("/api/dashboard/hrm/agent-status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_agent: selectedAgent.id_agent,
          status_keanggotaan: status,
        }),
      });
      if (!res.ok) throw new Error("Gagal mengubah status");
      const json = await res.json();
      const updated = json.agent as Agent;

      setAgents((prev) =>
        prev.map((a) =>
          a.id_agent === updated.id_agent ? { ...a, ...updated } : a
        )
      );
      setSelectedAgent((prev) =>
        prev ? { ...prev, status_keanggotaan: updated.status_keanggotaan } : prev
      );
      toast.success("Status keanggotaan diperbarui.");
    } catch (err) {
      console.error(err);
      toast.error("Gagal memperbarui status.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-300 gap-3">
        <div className="w-9 h-9 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">
          Memuat data Human Resource Management...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white">
            Human Resource Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Kelola agent, pantau performa, dan lakukan keputusan tim dalam satu layar.
          </p>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
        <StatCard
          icon="solar:users-group-rounded-bold"
          label="Total Agent"
          value={totalAgents.toString()}
          chip={`${activeAgents} aktif`}
        />
        <StatCard
          icon="solar:shield-user-bold"
          label="Pending Verifikasi"
          value={pendingAgents.toString()}
          chip="Perlu review"
          tone="amber"
        />
        <StatCard
          icon="solar:ranking-bold"
          label="Total Closing"
          value={totalClosing.toString()}
          chip="12 bulan terakhir"
          tone="sky"
        />
        <StatCard
          icon="solar:wallet-money-bold"
          label="Total Omset"
          value={`Rp ${totalOmset.toLocaleString("id-ID")}`}
          chip="Akumulasi agent"
          tone="emerald"
        />
        <StatCard
          icon="solar:star-bold"
          label="Rating Rata-rata"
          value={
            totalAgents
              ? (
                  agents.reduce((s, a) => s + Number(a.rating || 0), 0) /
                  totalAgents
                ).toFixed(2)
              : "0.00"
          }
          chip="Kinerja tim"
          tone="violet"
        />
      </div>

      {/* Filter & list */}
      <div className="grid grid-cols-1 xl:grid-cols-[ minmax(0,2fr)_minmax(0,1.2fr) ] gap-5">
        <div className="bg-[#05060A] border border-white/5 rounded-2xl p-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[180px] max-w-md">
              <Icon
                icon="solar:magnifer-bold"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama agent, kantor, kota atau WA..."
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-400/70"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 min-w-[130px]"
            >
              <option value="">Status: Semua</option>
              <option value="AKTIF">Aktif</option>
              <option value="PENDING">Pending</option>
              <option value="NONAKTIF">Nonaktif</option>
            </select>

            <select
              value={filterJabatan}
              onChange={(e) => setFilterJabatan(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 min-w-[130px]"
            >
              <option value="">Jabatan: Semua</option>
              <option value="MANAGER">Manager</option>
              <option value="SALES LEAD">Sales Lead</option>
              <option value="AGENT">Agent</option>
            </select>

            <input
              value={filterKota}
              onChange={(e) => setFilterKota(e.target.value)}
              placeholder="Filter kota"
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 min-w-[130px]"
            />
          </div>

          {/* Table */}
          <div className="mt-2 rounded-2xl border border-white/5 bg-black/30 overflow-hidden">
            <div className="hidden md:grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.7fr)] px-4 py-2.5 text-[11px] uppercase tracking-[0.18em] text-slate-500 bg-white/3 border-b border-white/5">
              <div>Agent</div>
              <div>Kantor & Area</div>
              <div>Performa</div>
              <div>Status</div>
            </div>

            <div className="divide-y divide-white/5">
              {filteredAgents.length === 0 && (
                <div className="px-4 py-6 text-xs text-slate-400">
                  Tidak ada agent yang cocok dengan filter.
                </div>
              )}

              {filteredAgents.map((a) => {
                const photo = buildDriveImageUrl(a.foto_profil_url);
                return (
                  <button
                    key={a.id_agent}
                    type="button"
                    onClick={() => setSelectedAgent(a)}
                    className="w-full text-left px-3.5 py-3 hover:bg-white/3 transition-colors flex flex-col md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.7fr)] gap-2 items-center md:items-stretch"
                  >
                    {/* Agent */}
                    <div className="flex items-center gap-3 w-full">
                      <div className="relative">
                        <div className="h-9 w-9 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center overflow-hidden">
                          {photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photo}
                              alt={a.nama_lengkap}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Icon
                              icon="solar:user-circle-bold-duotone"
                              className="text-slate-500 text-xl"
                            />
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs sm:text-sm font-medium text-slate-100 truncate">
                          {a.nama_lengkap}
                        </span>
                        <span
                          className={`
                            mt-0.5 inline-flex items-center gap-1 px-2 py-[2px] rounded-full text-[10px]
                            ${
                              jabatanColor[a.jabatan] ||
                              "bg-slate-700/60 text-slate-100 border border-slate-500/40"
                            }
                          `}
                        >
                          <Icon
                            icon="solar:medal-ribbons-star-bold"
                            className="text-[11px]"
                          />
                          {a.jabatan}
                        </span>
                      </div>
                    </div>

                    {/* Kantor & area */}
                    <div className="w-full text-xs text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Icon
                          icon="solar:buildings-3-bold"
                          className="text-[13px] text-slate-400"
                        />
                        <span className="truncate">{a.nama_kantor}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400">
                        <Icon
                          icon="solar:map-point-bold"
                          className="text-[12px]"
                        />
                        <span>{a.kota_area}</span>
                      </div>
                    </div>

                    {/* Performa */}
                    <div className="w-full flex items-center md:block text-xs text-slate-300">
                      <div className="flex items-center gap-1.5 mr-3">
                        <Icon
                          icon="solar:star-bold"
                          className="text-[13px] text-amber-300"
                        />
                        <span>{Number(a.rating || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Icon
                          icon="solar:cup-star-bold"
                          className="text-[13px] text-emerald-300"
                        />
                        <span>
                          {a.jumlah_closing} closing · Rp{" "}
                          {Number(a.total_omset || 0).toLocaleString("id-ID")}
                        </span>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="w-full flex items-center justify-between md:justify-end gap-2">
                      <span
                        className={`
                          inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[10px]
                          ${
                            statusBadgeClass[a.status_keanggotaan] ||
                            "bg-slate-700/60 text-slate-100 border border-slate-500/40"
                          }
                        `}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {a.status_keanggotaan}
                      </span>
                      <Icon
                        icon="solar:alt-arrow-right-bold"
                        className="text-[16px] text-slate-500"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Detail panel */}
        <div className="bg-[#05060A] border border-white/5 rounded-2xl p-4">
          {!selectedAgent ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 text-xs gap-2">
              <Icon
                icon="solar:user-hand-up-bold-duotone"
                className="text-2xl text-slate-500"
              />
              <p>Pilih salah satu agent di daftar untuk melihat detail HRM.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header agent detail */}
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center overflow-hidden">
                  {buildDriveImageUrl(selectedAgent.foto_profil_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={buildDriveImageUrl(
                        selectedAgent.foto_profil_url
                      )!}
                      alt={selectedAgent.nama_lengkap}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Icon
                      icon="solar:user-circle-bold-duotone"
                      className="text-2xl text-slate-500"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-semibold text-white truncate">
                      {selectedAgent.nama_lengkap}
                    </h2>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                    <span
                      className={`
                        inline-flex items-center gap-1 px-2 py-[2px] rounded-full
                        ${
                          jabatanColor[selectedAgent.jabatan] ||
                          "bg-slate-700/60 text-slate-100 border border-slate-500/40"
                        }
                      `}
                    >
                      <Icon
                        icon="solar:medal-ribbons-star-bold"
                        className="text-[11px]"
                      />
                      {selectedAgent.jabatan}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full bg-slate-800 text-slate-300 border border-slate-600/60">
                      <Icon
                        icon="solar:calendar-bold"
                        className="text-[11px]"
                      />
                      Gabung{" "}
                      {selectedAgent.tanggal_gabung
                        ? new Date(
                            selectedAgent.tanggal_gabung
                          ).toLocaleDateString("id-ID")
                        : "-"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Kontak & struktur */}
              <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2 text-[11px] text-slate-200">
                <div className="flex items-center gap-2">
                  <Icon
                    icon="solar:buildings-3-bold"
                    className="text-[14px] text-slate-400"
                  />
                  <span className="truncate">
                    {selectedAgent.nama_kantor} · {selectedAgent.kota_area}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon
                    icon="solar:phone-calling-rounded-bold"
                    className="text-[13px] text-emerald-400"
                  />
                  <a
                    href={`https://wa.me/${selectedAgent.nomor_whatsapp.replace(
                      /[^0-9]/g,
                      ""
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-emerald-300 hover:underline"
                  >
                    {selectedAgent.nomor_whatsapp}
                  </a>
                </div>
                {selectedAgent.nama_upline && (
                  <div className="flex items-center gap-2">
                    <Icon
                      icon="solar:hierarchy-bold"
                      className="text-[13px] text-sky-300"
                    />
                    <span className="truncate">
                      Upline: {selectedAgent.nama_upline}
                    </span>
                  </div>
                )}
              </div>

              {/* Performa ringkas */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <smallCard
                  icon="solar:star-bold"
                  label="Rating"
                  value={Number(selectedAgent.rating || 0).toFixed(2)}
                />
                <smallCard
                  icon="solar:cup-star-bold"
                  label="Closing"
                  value={selectedAgent.jumlah_closing.toString()}
                />
                <smallCard
                  icon="solar:wallet-money-bold"
                  label="Omset"
                  value={`Rp ${Number(
                    selectedAgent.total_omset || 0
                  ).toLocaleString("id-ID")}`}
                />
              </div>

              {/* Aksi status */}
              <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">
                    Status keanggotaan
                  </span>
                  <span
                    className={`
                      inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[10px]
                      ${
                        statusBadgeClass[selectedAgent.status_keanggotaan] ||
                        "bg-slate-700/60 text-slate-100 border border-slate-500/40"
                      }
                    `}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {selectedAgent.status_keanggotaan}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={updatingStatus}
                    onClick={() => handleChangeStatus("AKTIF")}
                    className="px-3 py-1.5 rounded-full text-[11px] bg-emerald-500/15 text-emerald-200 border border-emerald-400/50 hover:bg-emerald-500/25 transition-colors disabled:opacity-60"
                  >
                    Set Aktif
                  </button>
                  <button
                    type="button"
                    disabled={updatingStatus}
                    onClick={() => handleChangeStatus("NONAKTIF")}
                    className="px-3 py-1.5 rounded-full text-[11px] bg-rose-500/10 text-rose-300 border border-rose-400/50 hover:bg-rose-500/20 transition-colors disabled:opacity-60"
                  >
                    Set Nonaktif
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  chip,
  tone = "slate",
}: {
  icon: string;
  label: string;
  value: string;
  chip?: string;
  tone?: "slate" | "emerald" | "amber" | "sky" | "violet";
}) {
  const toneClass: Record<string, string> = {
    slate: "bg-slate-900/60 border-slate-700/60",
    emerald: "bg-emerald-500/10 border-emerald-400/40",
    amber: "bg-amber-500/10 border-amber-400/40",
    sky: "bg-sky-500/10 border-sky-400/40",
    violet: "bg-violet-500/10 border-violet-400/40",
  };
  return (
    <div
      className={`
        rounded-2xl border ${toneClass[tone]}
        bg-gradient-to-br from-white/5 via-transparent to-black/60
        px-3.5 py-3 flex flex-col gap-1.5
      `}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-xl bg-black/40 border border-white/15 flex items-center justify-center">
            <Icon icon={icon} className="text-[15px] text-emerald-200" />
          </div>
          <span className="text-[11px] text-slate-300">{label}</span>
        </div>
        {chip && (
          <span className="hidden sm:inline-flex items-center px-2 py-[2px] rounded-full bg-black/40 border border-white/10 text-[10px] text-slate-400">
            {chip}
          </span>
        )}
      </div>
      <p className="text-sm sm:text-base font-semibold text-white">
        {value}
      </p>
    </div>
  );
}

function smallCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 px-2.5 py-2 flex flex-col items-center gap-1">
      <Icon icon={icon} className="text-[15px] text-emerald-300" />
      <span className="text-[10px] text-slate-400">{label}</span>
      <span className="text-[11px] font-medium text-white text-center">
        {value}
      </span>
    </div>
  );
}

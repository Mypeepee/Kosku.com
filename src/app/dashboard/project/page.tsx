"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

import ProjectWalletCard from "./components/ProjectWalletCard";
import ProjectCategoryTabs from "./components/ProjectCategoryTabs";
import ProjectCampaignCard, {
  type ProjectCampaign,
} from "./components/ProjectCampaignCard";
import type { CreateProjectFormValues } from "./components/modal/AddProjectModal";

type InvestorWalletSummary = {
  idAgent?: string;
  totalDana: number;
  totalDanaLunas: number;
  totalDanaPending: number;
  projectAktif: number;
  jumlahPropertyDidanai: number;
  pendingPaymentCount: number;
  pendingProjectCount: number;
  hasPendingPayment: boolean;
  realizedProfit: number;
};

type ProjectListResponse = {
  success: boolean;
  data?: ProjectCampaign[];
  wallet?: InvestorWalletSummary;
  message?: string;
};

type DeleteProjectResponse = {
  success: boolean;
  message?: string;
};

type TabKey = "semua" | "berjalan" | "selesai";
type SortKey = "termurah" | "termahal" | "terlama" | "tercepat";

const EMPTY_WALLET_SUMMARY: InvestorWalletSummary = {
  idAgent: undefined,
  totalDana: 0,
  totalDanaLunas: 0,
  totalDanaPending: 0,
  projectAktif: 0,
  jumlahPropertyDidanai: 0,
  pendingPaymentCount: 0,
  pendingProjectCount: 0,
  hasPendingPayment: false,
  realizedProfit: 0,
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function pickNumber(...values: unknown[]) {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return 0;
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      typeof item === "object" && item !== null
  );
}

function getProjectStatus(project: ProjectCampaign) {
  const p = project as Record<string, unknown>;

  return normalizeText(
    p.status ??
      p.statusProject ??
      p.status_project ??
      p.kategoriStatus ??
      p.categoryStatus
  );
}

function extractProjectSelesai(project: ProjectCampaign) {
  const p = project as Record<string, unknown>;

  const direct =
    typeof p.projectSelesai === "object" && p.projectSelesai !== null
      ? (p.projectSelesai as Record<string, unknown>)
      : typeof p.project_selesai === "object" && p.project_selesai !== null
      ? (p.project_selesai as Record<string, unknown>)
      : null;

  const fromArray =
    asArray(p.projectSelesai).find(Boolean) ??
    asArray(p.project_selesai).find(Boolean) ??
    asArray(p.projectDone).find(Boolean) ??
    asArray(p.project_done).find(Boolean) ??
    null;

  const raw = direct ?? fromArray;

  if (!raw) return null;

  const idProject = pickString(raw.id_project, raw.idProject, project.id);
  const tanggalTerjual = raw.tanggal_terjual ?? raw.tanggalTerjual ?? null;
  const hargaJual = pickNumber(raw.harga_jual, raw.hargaJual);
  const durasiHari = pickNumber(raw.durasi_hari, raw.durasiHari);
  const totalBiayaAkuisisi = pickNumber(
    raw.total_biaya_akuisisi,
    raw.totalBiayaAkuisisi
  );
  const profitKotor = pickNumber(raw.profit_kotor, raw.profitKotor);
  const totalBiayaTransaksi = pickNumber(
    raw.total_biaya_transaksi,
    raw.totalBiayaTransaksi
  );
  const profitBersih = pickNumber(raw.profit_bersih, raw.profitBersih);
  const roiBersih = pickNumber(raw.roi_bersih, raw.roiBersih);

  if (!idProject || !tanggalTerjual) return null;

  return {
    id_project: idProject,
    id_listing: pickNumber(raw.id_listing, raw.idListing),
    tanggal_pembelian: raw.tanggal_pembelian ?? raw.tanggalPembelian ?? null,
    tanggal_terjual: tanggalTerjual,
    durasi_hari: durasiHari,
    harga_jual: hargaJual,
    total_biaya_akuisisi: totalBiayaAkuisisi,
    profit_kotor: profitKotor,
    pph_percent: pickNumber(raw.pph_percent, raw.pphPercent),
    ajb_percent: pickNumber(raw.ajb_percent, raw.ajbPercent),
    agent_fee_percent: pickNumber(raw.agent_fee_percent, raw.agentFeePercent),
    total_biaya_transaksi: totalBiayaTransaksi,
    profit_bersih: profitBersih,
    roi_bersih: roiBersih,
    dibuat_tanggal: raw.dibuat_tanggal ?? raw.dibuatTanggal ?? null,
    diupdate_tanggal: raw.diupdate_tanggal ?? raw.diupdateTanggal ?? null,
  };
}

function getProjectPrice(project: ProjectCampaign) {
  const p = project as Record<string, unknown>;
  const projectSelesai = extractProjectSelesai(project);

  if (projectSelesai) {
    return pickNumber(projectSelesai.harga_jual, projectSelesai.total_biaya_akuisisi);
  }

  return pickNumber(
    p.hargaJual,
    p.harga_jual,
    p.hargaBeli,
    p.harga_beli,
    p.totalHargaJual,
    p.total_harga_jual,
    p.targetPendanaan,
    p.target_pendanaan,
    p.nominalPendanaan
  );
}

function getProjectDuration(project: ProjectCampaign) {
  const p = project as Record<string, unknown>;
  const projectSelesai = extractProjectSelesai(project);

  if (projectSelesai?.durasi_hari) {
    return pickNumber(projectSelesai.durasi_hari);
  }

  return pickNumber(
    p.durasiHari,
    p.durasi_hari,
    p.durationDays,
    p.duration_days,
    p.estimasiDurasi,
    p.estimasi_durasi,
    p.lamaHari,
    p.lama_hari
  );
}

function isProjectSold(project: ProjectCampaign) {
  const projectSelesai = extractProjectSelesai(project);
  if (projectSelesai) return true;

  const status = getProjectStatus(project);

  return (
    status === "terjual" ||
    status === "sold" ||
    status === "selesai" ||
    status === "sudah_selesai"
  );
}

function findUserInvestmentFromProject(
  project: ProjectCampaign,
  currentAgentId: string | null
) {
  if (!currentAgentId) return null;

  const p = project as Record<string, unknown>;

  const directUserInvestment =
    typeof p.userInvestment === "object" && p.userInvestment !== null
      ? (p.userInvestment as Record<string, unknown>)
      : null;

  if (directUserInvestment) {
    const nominalKomitmen = pickNumber(
      directUserInvestment.nominalKomitmen,
      directUserInvestment.nominal_komitmen,
      directUserInvestment.nominal,
      directUserInvestment.komitmen
    );

    const persentaseKepemilikanRaw =
      directUserInvestment.persentaseKepemilikan ??
      directUserInvestment.persentase_kepemilikan ??
      null;

    const persentaseKepemilikan =
      persentaseKepemilikanRaw === null || persentaseKepemilikanRaw === undefined
        ? null
        : Number(persentaseKepemilikanRaw);

    return {
      nominalKomitmen,
      persentaseKepemilikan: Number.isFinite(persentaseKepemilikan as number)
        ? persentaseKepemilikan
        : null,
      status: pickString(
        directUserInvestment.status,
        directUserInvestment.statusPembayaran,
        directUserInvestment.status_pembayaran,
        "menunggu_pembayaran"
      ),
      updatedAt: pickString(
        directUserInvestment.updatedAt,
        directUserInvestment.diupdate_tanggal,
        directUserInvestment.updated_at
      ) || null,
    };
  }

  const possibleCollections = [
    ...asArray(p.projectInvestor),
    ...asArray(p.projectInvestors),
    ...asArray(p.project_investor),
    ...asArray(p.investors),
    ...asArray(p.investasi),
    ...asArray(p.investments),
  ];

  const matched = possibleCollections.find((item) => {
    const agentId = pickString(
      item.id_agent,
      item.idAgent,
      item.agent_id,
      item.agentId
    );
    return agentId === currentAgentId;
  });

  if (!matched) return null;

  const nominalKomitmen = pickNumber(
    matched.nominal_komitmen,
    matched.nominalKomitmen,
    matched.nominal,
    matched.komitmen
  );

  const persentaseRaw =
    matched.persentase_kepemilikan ??
    matched.persentaseKepemilikan ??
    matched.percent ??
    null;

  const persentaseKepemilikan =
    persentaseRaw === null || persentaseRaw === undefined
      ? null
      : Number(persentaseRaw);

  return {
    nominalKomitmen,
    persentaseKepemilikan: Number.isFinite(persentaseKepemilikan as number)
      ? persentaseKepemilikan
      : null,
    status: pickString(
      matched.status,
      matched.statusPembayaran,
      matched.status_pembayaran,
      "menunggu_pembayaran"
    ),
    updatedAt: pickString(
      matched.diupdate_tanggal,
      matched.updatedAt,
      matched.updated_at
    ) || null,
  };
}

function enrichProjectsWithUserInvestment(
  projects: ProjectCampaign[],
  currentAgentId: string | null
): ProjectCampaign[] {
  return projects.map((project) => {
    const userInvestment = findUserInvestmentFromProject(project, currentAgentId);
    const projectSelesai = extractProjectSelesai(project);

    return {
      ...project,
      projectSelesai,
      userInvestment,
      status: projectSelesai
        ? "Sudah Terjual"
        : pickString(project.status, "Project"),
    };
  }) as ProjectCampaign[];
}

export default function ProjectPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const scrollToId = searchParams.get("scrollTo");
  const didAutoScroll = useRef(false);

  const [campaigns, setCampaigns] = useState<ProjectCampaign[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectError, setProjectError] = useState("");
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(
    null
  );
  const [projectToDelete, setProjectToDelete] =
    useState<ProjectCampaign | null>(null);
  const [walletSummary, setWalletSummary] =
    useState<InvestorWalletSummary>(EMPTY_WALLET_SUMMARY);

  const [activeTab, setActiveTab] = useState<TabKey>("berjalan");
  const [sort, setSort] = useState<SortKey>("termurah");

  const currentAgentId = (session?.user as any)?.agentId ?? null;
  const jabatan = (session?.user as any)?.jabatan ?? null;

  const fetchProjects = useCallback(async () => {
    try {
      setLoadingProjects(true);
      setProjectError("");

      const response = await fetch("/api/project", {
        method: "GET",
        cache: "no-store",
      });

      const result = (await response.json()) as ProjectListResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal mengambil daftar project.");
      }

      const rawProjects = Array.isArray(result.data) ? result.data : [];
      const enrichedProjects = enrichProjectsWithUserInvestment(
        rawProjects,
        currentAgentId
      );

      setCampaigns(enrichedProjects);

      if (result.wallet) {
        setWalletSummary({ ...EMPTY_WALLET_SUMMARY, ...result.wallet });
      }
    } catch (error) {
      setCampaigns([]);
      setProjectError(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat mengambil project."
      );
    } finally {
      setLoadingProjects(false);
    }
  }, [currentAgentId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Auto-scroll ke project card saat halaman pertama kali load dengan ?scrollTo=ID
  useEffect(() => {
    if (!scrollToId || loadingProjects || didAutoScroll.current) return;
    const el = document.getElementById(`project-card-${scrollToId}`);
    if (!el) return;
    didAutoScroll.current = true;
    window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-violet-400/70", "transition-all");
      window.setTimeout(() => el.classList.remove("ring-2", "ring-violet-400/70"), 2500);
    }, 300);
  }, [scrollToId, loadingProjects, campaigns]);

  async function handleProjectCreated(_values: CreateProjectFormValues) {
    await fetchProjects();
  }

  const handleAskDeleteProject = useCallback((project: ProjectCampaign) => {
    setProjectError("");
    setProjectToDelete(project);
  }, []);

  const handleCloseDeleteModal = useCallback(() => {
    if (deletingProjectId) return;
    setProjectToDelete(null);
  }, [deletingProjectId]);

  const handleConfirmDeleteProject = useCallback(async () => {
    if (!projectToDelete) return;

    try {
      setDeletingProjectId(projectToDelete.id);
      setProjectError("");

      const response = await fetch(
        `/api/project/${encodeURIComponent(projectToDelete.id)}`,
        {
          method: "DELETE",
        }
      );

      let result: DeleteProjectResponse | null = null;

      try {
        result = (await response.json()) as DeleteProjectResponse;
      } catch {
        result = null;
      }

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Gagal menghapus project.");
      }

      setCampaigns((prev) =>
        prev.filter((item) => item.id !== projectToDelete.id)
      );
      setProjectToDelete(null);

      await fetchProjects();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat menghapus project.";

      setProjectError(message);
      window.alert(message);
    } finally {
      setDeletingProjectId(null);
    }
  }, [projectToDelete, fetchProjects]);

  const totalBerjalan = useMemo(
    () => campaigns.filter((item) => !isProjectSold(item)).length,
    [campaigns]
  );

  const totalSelesai = useMemo(
    () => campaigns.filter((item) => isProjectSold(item)).length,
    [campaigns]
  );

  const filteredCampaigns = useMemo(() => {
    const items = [...campaigns].filter((project) => {
      if (activeTab === "berjalan") {
        return !isProjectSold(project);
      }

      if (activeTab === "selesai") {
        return isProjectSold(project);
      }

      return true;
    });

    items.sort((a, b) => {
      const priceA = getProjectPrice(a);
      const priceB = getProjectPrice(b);
      const durationA = getProjectDuration(a);
      const durationB = getProjectDuration(b);

      switch (sort) {
        case "termurah":
          return priceA - priceB;
        case "termahal":
          return priceB - priceA;
        case "terlama":
          return durationB - durationA;
        case "tercepat":
          return durationA - durationB;
        default:
          return 0;
      }
    });

    return items;
  }, [campaigns, activeTab, sort]);

  return (
    <main className="min-h-screen bg-transparent text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <ProjectWalletCard
          totalDana={walletSummary.totalDana}
          totalDanaLunas={walletSummary.totalDanaLunas}
          totalDanaPending={walletSummary.totalDanaPending}
          projectAktif={walletSummary.projectAktif}
          jumlahPropertyDidanai={walletSummary.jumlahPropertyDidanai}
          pendingPaymentCount={walletSummary.pendingPaymentCount}
          pendingProjectCount={walletSummary.pendingProjectCount}
          hasPendingPayment={walletSummary.hasPendingPayment}
          realizedProfit={walletSummary.realizedProfit}
          jabatan={jabatan}
          createdById={currentAgentId ?? undefined}
          onCreateProject={handleProjectCreated}
        />

        <section id="status-project" className="space-y-5">
          <ProjectCategoryTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            sort={sort}
            onSortChange={setSort}
            totalSemua={campaigns.length}
            totalBerjalan={totalBerjalan}
            totalSelesai={totalSelesai}
          />

          {loadingProjects ? (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] px-5 py-6 text-sm text-slate-300">
              Mengambil data project...
            </div>
          ) : projectError ? (
            <div className="rounded-[28px] border border-rose-400/20 bg-rose-500/10 px-5 py-6 text-sm text-rose-200">
              {projectError}
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] px-5 py-6 text-sm text-slate-300">
              {campaigns.length === 0
                ? "Belum ada project di database."
                : activeTab === "berjalan"
                ? "Belum ada project yang sedang berjalan."
                : activeTab === "selesai"
                ? "Belum ada project yang sudah selesai."
                : "Tidak ada project yang cocok dengan filter saat ini."}
            </div>
          ) : (
            <div
              id="daftar-project"
              className="grid grid-cols-1 gap-5 lg:grid-cols-2"
            >
              {filteredCampaigns.map((project) => {
                const canManage =
                  Boolean(currentAgentId) &&
                  project.createdById === currentAgentId;

                return (
                  <div key={project.id} id={`project-card-${project.id}`} className="rounded-[28px] transition-shadow duration-300">
                    <ProjectCampaignCard
                      project={project}
                      adminMode={canManage}
                      isDeleting={deletingProjectId === project.id}
                      onDelete={canManage ? handleAskDeleteProject : undefined}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {projectToDelete ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Tutup modal"
            onClick={handleCloseDeleteModal}
            className="absolute inset-0 bg-black/70 backdrop-blur-[3px]"
          />

          <div className="relative z-[201] w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#08111d_0%,#050a12_100%)] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0)_24%)]" />

            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-500/10 text-rose-200">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4.75A1.75 1.75 0 0 1 9.75 3h4.5A1.75 1.75 0 0 1 16 4.75V6" />
                  <path d="M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </div>

              <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-white">
                Hapus project?
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-300">
                Project ini akan dihapus total dari database beserta data
                turunannya.
              </p>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Project
                </p>
                <p className="mt-2 text-base font-semibold text-white">
                  {projectToDelete.nama}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {projectToDelete.id}
                </p>
              </div>

              <p className="mt-4 text-xs leading-5 text-rose-200/90">
                Tindakan ini tidak bisa dibatalkan.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleCloseDeleteModal}
                  disabled={Boolean(deletingProjectId)}
                  className="rounded-[18px] border border-white/12 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={handleConfirmDeleteProject}
                  disabled={Boolean(deletingProjectId)}
                  className="rounded-[18px] border border-rose-400/20 bg-rose-500/15 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingProjectId ? "Menghapus..." : "Ya, Hapus"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
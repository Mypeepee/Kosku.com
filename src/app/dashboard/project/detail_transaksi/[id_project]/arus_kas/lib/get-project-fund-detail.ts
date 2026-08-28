import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ownershipPercent } from "@/lib/investor-ownership";
import {
  computeFundState,
  normalizeWalletKey,
  type WalletKey,
} from "@/lib/project-kas";
import type {
  CurrentInvestorInfo,
  DbCashflow,
  InvestorSummary,
  ManageFundData,
} from "../types";

/** Baris yang dibuat otomatis sistem — tak boleh diedit/dihapus manual. */
const SYSTEM_CATEGORIES = new Set(["setoran_modal", "talangan_investor"]);

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  const numeric =
    value instanceof Prisma.Decimal ? value.toNumber() : Number(value ?? 0);

  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizePhotoUrl(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return null;

  const driveId =
    raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i)?.[1] ??
    raw.match(/[?&]id=([a-zA-Z0-9_-]+)/i)?.[1] ??
    null;

  if (driveId) return `https://drive.google.com/thumbnail?id=${driveId}&sz=w300`;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;

  return null;
}

export async function getProjectFundDetail(
  idProject: string,
  currentAgentId?: string | null
): Promise<ManageFundData | null> {
  const [project, cashflowRows, investorRows] = await Promise.all([
    prisma.project.findUnique({
      where: { id_project: idProject },
      select: {
        id_project: true,
        nama_project: true,
        dibuat_oleh: true,
        status: true,
        jenis_pendanaan: true,
        target_pendanaan: true,
        total_pendanaan: true,
        nilai_limit_lelang: true,
        spare_bidding: true,
        biaya_balik_nama: true,
        biaya_eksekusi: true,
        biaya_renov: true,
        dana_cadangan: true,
        dibuat_tanggal: true,
      },
    }),
    prisma.projectArusKas.findMany({
      where: {
        id_project: idProject,
        status_transaksi: { not: "dibatalkan" },
      },
      orderBy: [{ tanggal_transaksi: "desc" }, { id_project_arus_kas: "desc" }],
      select: {
        id_project_arus_kas: true,
        id_project: true,
        wallet_key: true,
        tanggal_transaksi: true,
        jenis_transaksi: true,
        kategori_transaksi: true,
        judul_transaksi: true,
        nominal: true,
        status_transaksi: true,
        catatan: true,
        dibuat_tanggal: true,
        diupdate_tanggal: true,
        id_project_investor: true,
      },
    }),
    prisma.projectInvestor.findMany({
      where: { id_project: idProject },
      orderBy: [{ nominal_terbayar: "desc" }, { dibuat_tanggal: "asc" }],
      select: {
        id_project_investor: true,
        id_agent: true,
        nominal_komitmen: true,
        nominal_terbayar: true,
        status: true,
        agent: {
          select: {
            foto_profil_url: true,
            pengguna: { select: { nama_lengkap: true } },
          },
        },
      },
    }),
  ]);

  if (!project) {
    return null;
  }

  // ── Seluruh angka kas & anggaran dari satu mesin ────────────────────────
  // Server penegak aturan memakai mesin yang sama (@/lib/project-kas-server),
  // jadi angka di layar mustahil beda dengan angka yang divalidasi API.
  const fund = computeFundState({
    project,
    rows: cashflowRows,
    investors: investorRows,
  });

  // ── Riwayat transaksi ────────────────────────────────────────────────────
  const investorNamaById = new Map<string, string | null>();
  for (const inv of investorRows) {
    investorNamaById.set(
      inv.id_project_investor.toString(),
      inv.agent?.pengguna?.nama_lengkap ?? null
    );
  }

  const transactions: DbCashflow[] = cashflowRows.map((row) => {
    const investorKey =
      row.id_project_investor != null
        ? row.id_project_investor.toString()
        : null;

    return {
      id_project_arus_kas: row.id_project_arus_kas.toString(),
      id_project: row.id_project,
      wallet_key: normalizeWalletKey(row.wallet_key) as WalletKey,
      tanggal_transaksi: row.tanggal_transaksi,
      jenis_transaksi: row.jenis_transaksi,
      kategori_transaksi: row.kategori_transaksi,
      judul_transaksi: row.judul_transaksi,
      nominal: toNumber(row.nominal),
      status_transaksi: row.status_transaksi,
      catatan: row.catatan,
      dibuat_tanggal: row.dibuat_tanggal,
      diupdate_tanggal: row.diupdate_tanggal,
      id_project_investor: investorKey,
      investor_nama: investorKey
        ? investorNamaById.get(investorKey) ?? null
        : null,
      dikunci: SYSTEM_CATEGORIES.has(row.kategori_transaksi),
    };
  });

  // ── Daftar investor ──────────────────────────────────────────────────────
  // Dipakai form pencatatan & panel tutup kekurangan untuk memilih penanggung.
  // Papan kepemilikan sendiri TIDAK ditampilkan di layar arus kas — tempatnya
  // di halaman detail project (InvestorBookCard).
  const investors: InvestorSummary[] = investorRows.map((inv) => {
    const komitmen = toNumber(inv.nominal_komitmen);
    const disetor = toNumber(inv.nominal_terbayar);

    return {
      id_project_investor: inv.id_project_investor.toString(),
      id_agent: inv.id_agent,
      nama: inv.agent?.pengguna?.nama_lengkap?.trim() || inv.id_agent,
      foto_profil_url: normalizePhotoUrl(inv.agent?.foto_profil_url),
      komitmen,
      disetor,
      belumSetor: Math.max(0, komitmen - disetor),
      status: String(inv.status ?? ""),
      isCurrentUser: Boolean(currentAgentId && inv.id_agent === currentAgentId),
    };
  });

  // ── Info untuk investor yang sedang melihat (bukan penyelenggara) ────────
  let currentInvestorInfo: CurrentInvestorInfo | null = null;

  if (currentAgentId && currentAgentId !== project.dibuat_oleh) {
    const investorRow = investorRows.find(
      (inv) => inv.id_agent === currentAgentId
    );

    if (investorRow) {
      currentInvestorInfo = {
        nama: investorRow.agent?.pengguna?.nama_lengkap ?? null,
        nominal_komitmen: toNumber(investorRow.nominal_komitmen),
        nominal_terbayar: toNumber(investorRow.nominal_terbayar),
        persentase_kepemilikan: ownershipPercent(
          toNumber(investorRow.nominal_terbayar),
          fund.denominator
        ),
        status: String(investorRow.status ?? ""),
      };
    }
  }

  return {
    project: {
      id_project: project.id_project,
      nama_project: project.nama_project,
      dibuat_oleh: project.dibuat_oleh,
      status: String(project.status ?? ""),
      jenis_pendanaan: String(project.jenis_pendanaan ?? ""),
      target_pendanaan: fund.targetPendanaan,
      total_pendanaan: toNumber(project.total_pendanaan),
      dibuat_tanggal: project.dibuat_tanggal,
    },
    fund,
    wallets: fund.pos,
    transactions,
    investors,
    currentInvestorInfo,
  };
}

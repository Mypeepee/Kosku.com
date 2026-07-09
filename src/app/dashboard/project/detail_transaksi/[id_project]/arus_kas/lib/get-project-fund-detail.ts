import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ownershipDenominator, ownershipPercent } from "@/lib/investor-ownership";
import type {
  CurrentInvestorInfo,
  DbCashflow,
  ManageFundData,
  WalletKey,
  WalletSummary,
} from "../types";

type ProjectFundSource = {
  id_project: string;
  nama_project: string;
  dibuat_oleh: string;
  target_pendanaan: Prisma.Decimal | number | null;
  nilai_limit_lelang: Prisma.Decimal | number | null;
  spare_bidding: Prisma.Decimal | number | null;
  biaya_balik_nama: Prisma.Decimal | number | null;
  biaya_eksekusi: Prisma.Decimal | number | null;
  biaya_renov: Prisma.Decimal | number | null;
  dana_cadangan: Prisma.Decimal | number | null;
};

/** Kategori pemasukan yang merepresentasikan modal investor (setoran/talangan).
 *  Dikecualikan dari danaMasuk berbasis-ledger karena SUDAH dihitung lewat
 *  nominal_terbayar — mencegah dobel hitung. */
const MODAL_INCOME_CATEGORIES = new Set(["setoran_modal", "talangan_investor"]);

const WALLET_META: Array<{
  key: WalletKey;
  title: string;
  getBudget: (project: ProjectFundSource) => number;
}> = [
  {
    key: "utama",
    title: "Dompet Utama",
    getBudget: (project) =>
      toNumber(project.nilai_limit_lelang) + toNumber(project.spare_bidding),
  },
  {
    key: "dokumen",
    title: "Dokumen",
    getBudget: (project) => toNumber(project.biaya_balik_nama),
  },
  {
    key: "eksekusi",
    title: "Eksekusi",
    getBudget: (project) => toNumber(project.biaya_eksekusi),
  },
  {
    key: "renovasi",
    title: "Renovasi",
    getBudget: (project) => toNumber(project.biaya_renov),
  },
  {
    key: "cadangan",
    title: "Cadangan",
    getBudget: (project) => toNumber(project.dana_cadangan),
  },
];

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  const numeric =
    value instanceof Prisma.Decimal ? value.toNumber() : Number(value ?? 0);

  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeWalletKey(value: unknown): WalletKey {
  if (
    value === "utama" ||
    value === "dokumen" ||
    value === "eksekusi" ||
    value === "renovasi" ||
    value === "cadangan"
  ) {
    return value;
  }

  return "utama";
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
        target_pendanaan: true,
        nilai_limit_lelang: true,
        spare_bidding: true,
        biaya_balik_nama: true,
        biaya_eksekusi: true,
        biaya_renov: true,
        dana_cadangan: true,
      },
    }),
    prisma.projectArusKas.findMany({
      where: {
        id_project: idProject,
        status_transaksi: {
          not: "dibatalkan",
        },
      },
      orderBy: [{ tanggal_transaksi: "desc" }, { id_project_arus_kas: "desc" }],
      take: 500,
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
      select: {
        id_project_investor: true,
        id_agent: true,
        nominal_komitmen: true,
        nominal_terbayar: true,
        persentase_kepemilikan: true,
        status: true,
        agent: {
          select: { pengguna: { select: { nama_lengkap: true } } },
        },
      },
    }),
  ]);

  if (!project) {
    return null;
  }

  // ── Modal disetor & denominator kepemilikan ──────────────────────────────
  const totalSetor = investorRows.reduce(
    (sum, inv) => sum + toNumber(inv.nominal_terbayar),
    0
  );
  const targetPendanaan = toNumber(project.target_pendanaan);
  const denominator = ownershipDenominator(targetPendanaan, totalSetor);

  const investorNamaById = new Map<string, string | null>();
  for (const inv of investorRows) {
    investorNamaById.set(
      inv.id_project_investor.toString(),
      inv.agent?.pengguna?.nama_lengkap ?? null
    );
  }

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
        // Kepemilikan live = setor / max(target, Σsetor). Lihat investor-ownership.ts.
        persentase_kepemilikan: ownershipPercent(
          toNumber(investorRow.nominal_terbayar),
          denominator
        ),
        status: String(investorRow.status ?? ""),
      };
    }
  }

  const transactions: DbCashflow[] = cashflowRows.map((row) => {
    const investorKey =
      row.id_project_investor != null
        ? row.id_project_investor.toString()
        : null;
    return {
      id_project_arus_kas: row.id_project_arus_kas,
      id_project: row.id_project,
      wallet_key: normalizeWalletKey(row.wallet_key),
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
    };
  });

  const summaryMap = new Map<
    WalletKey,
    { income: number; expense: number }
  >();

  for (const wallet of WALLET_META) {
    summaryMap.set(wallet.key, { income: 0, expense: 0 });
  }

  for (const row of transactions) {
    const walletKey = normalizeWalletKey(row.wallet_key);
    const current = summaryMap.get(walletKey) ?? { income: 0, expense: 0 };
    const nominal = Number(row.nominal);

    if (row.jenis_transaksi === "pemasukan") {
      current.income += nominal;
    } else {
      current.expense += nominal;
    }

    summaryMap.set(walletKey, current);
  }

  const wallets: WalletSummary[] = WALLET_META.map((meta) => {
    const budget = meta.getBudget(project);
    const summary = summaryMap.get(meta.key) ?? { income: 0, expense: 0 };
    // Per pos = anggaran vs realisasi. sisaAnggaran boleh negatif (over-budget),
    // itu penanda visual — BUKAN kas minus (kas riil dijaga di level total).
    const terpakai = summary.expense;
    const sisaAnggaran = budget - terpakai;

    return {
      walletKey: meta.key,
      title: meta.title,
      budget,
      income: summary.income,
      expense: summary.expense,
      terpakai,
      sisaAnggaran,
      overBudget: terpakai > budget,
      usedBudget: terpakai,
      remainingBudget: sisaAnggaran,
      balance: sisaAnggaran,
      visible: true,
    };
  });

  // ── Kas riil (uang yang benar-benar ada) ──────────────────────────────────
  // danaMasuk = modal disetor (via nominal_terbayar) + pemasukan non-modal dari
  // ledger. Kategori setoran/talangan dikecualikan agar tak dobel dengan setor.
  const pemasukanNonModal = transactions.reduce((sum, row) => {
    if (
      row.jenis_transaksi === "pemasukan" &&
      !MODAL_INCOME_CATEGORIES.has(row.kategori_transaksi)
    ) {
      return sum + Number(row.nominal);
    }
    return sum;
  }, 0);

  const danaKeluar = transactions.reduce(
    (sum, row) =>
      row.jenis_transaksi === "pengeluaran" ? sum + Number(row.nominal) : sum,
    0
  );

  const danaMasuk = totalSetor + pemasukanNonModal;
  const sisaKas = danaMasuk - danaKeluar;

  const totalIncome = wallets.reduce((sum, wallet) => sum + wallet.income, 0);
  const totalExpense = wallets.reduce((sum, wallet) => sum + wallet.expense, 0);
  const totalRemainingBudget = wallets.reduce(
    (sum, wallet) => sum + wallet.remainingBudget,
    0
  );

  return {
    project: {
      id_project: project.id_project,
      nama_project: project.nama_project,
      dibuat_oleh: project.dibuat_oleh,
      target_pendanaan: targetPendanaan,
    },
    wallets,
    transactions,
    totalIncome,
    totalExpense,
    totalBalance: sisaKas,
    totalRemainingBudget,
    danaMasuk,
    danaKeluar,
    sisaKas,
    totalSetor,
    denominator,
    currentInvestorInfo,
  };
}
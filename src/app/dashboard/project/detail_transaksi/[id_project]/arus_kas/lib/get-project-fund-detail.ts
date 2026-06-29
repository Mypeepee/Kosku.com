import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  DbCashflow,
  ManageFundData,
  WalletKey,
  WalletSummary,
} from "../types";

type ProjectFundSource = {
  id_project: string;
  nama_project: string;
  nilai_limit_lelang: Prisma.Decimal | number | null;
  spare_bidding: Prisma.Decimal | number | null;
  biaya_balik_nama: Prisma.Decimal | number | null;
  biaya_eksekusi: Prisma.Decimal | number | null;
  biaya_renov: Prisma.Decimal | number | null;
  dana_cadangan: Prisma.Decimal | number | null;
};

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
  idProject: string
): Promise<ManageFundData | null> {
  const [project, cashflowRows] = await Promise.all([
    prisma.project.findUnique({
      where: { id_project: idProject },
      select: {
        id_project: true,
        nama_project: true,
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
      },
    }),
  ]);

  if (!project) {
    return null;
  }

  const transactions: DbCashflow[] = cashflowRows.map((row) => ({
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
  }));

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
    const nominal = toNumber(row.nominal);

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
    const balance = budget + summary.income - summary.expense;

    return {
      walletKey: meta.key,
      title: meta.title,
      budget,
      income: summary.income,
      expense: summary.expense,
      usedBudget: summary.expense,
      remainingBudget: balance,
      balance,
    };
  });

  const totalIncome = wallets.reduce((sum, wallet) => sum + wallet.income, 0);
  const totalExpense = wallets.reduce((sum, wallet) => sum + wallet.expense, 0);
  const totalBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
  const totalRemainingBudget = wallets.reduce(
    (sum, wallet) => sum + wallet.remainingBudget,
    0
  );

  return {
    project: {
      id_project: project.id_project,
      nama_project: project.nama_project,
    },
    wallets,
    transactions,
    totalIncome,
    totalExpense,
    totalBalance,
    totalRemainingBudget,
  };
}
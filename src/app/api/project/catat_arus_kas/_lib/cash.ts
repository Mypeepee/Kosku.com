import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * ── Kas riil proyek: satu sumber kebenaran ──────────────────────────────────
 * sisaKas = Σ modal disetor (nominal_terbayar) + pemasukan non-modal − pengeluaran.
 * Dijaga ≥ 0 (anti-minus) oleh guard talangan di catat_arus_kas.
 * Lihat juga lib tampilan di arus_kas/lib/get-project-fund-detail.ts.
 */

/** Kategori pemasukan yang = modal investor. Dikecualikan dari sum ledger karena
 *  sudah dihitung via nominal_terbayar (hindari dobel hitung). */
export const MODAL_INCOME_CATEGORIES = [
  "setoran_modal",
  "talangan_investor",
] as const;

type DbClient = Prisma.TransactionClient | typeof prisma;

function toDecimal(value: unknown) {
  if (value instanceof Prisma.Decimal) return value;
  if (typeof value === "number" || typeof value === "string") {
    return new Prisma.Decimal(value);
  }
  return new Prisma.Decimal(0);
}

/** Kontribusi satu baris arus kas terhadap kas riil (bertanda). */
export function cashEffect(row: {
  jenis_transaksi: string;
  kategori_transaksi: string;
  status_transaksi: string;
  nominal: Prisma.Decimal | number | string;
}): Prisma.Decimal {
  if (row.status_transaksi === "dibatalkan") return new Prisma.Decimal(0);
  const nominal = toDecimal(row.nominal);

  if (row.jenis_transaksi === "pemasukan") {
    // Modal (setoran/talangan) dihitung via nominal_terbayar, bukan di sini.
    if (
      (MODAL_INCOME_CATEGORIES as readonly string[]).includes(
        row.kategori_transaksi
      )
    ) {
      return new Prisma.Decimal(0);
    }
    return nominal;
  }

  if (row.jenis_transaksi === "pengeluaran") {
    return nominal.negated();
  }

  return new Prisma.Decimal(0);
}

/** Kas riil proyek saat ini. */
export async function computeSisaKas(
  client: DbClient,
  idProject: string
): Promise<Prisma.Decimal> {
  const [paidAgg, incomeAgg, expenseAgg] = await Promise.all([
    client.projectInvestor.aggregate({
      where: { id_project: idProject },
      _sum: { nominal_terbayar: true },
    }),
    client.projectArusKas.aggregate({
      where: {
        id_project: idProject,
        status_transaksi: { not: "dibatalkan" },
        jenis_transaksi: "pemasukan",
        kategori_transaksi: {
          notIn: [...MODAL_INCOME_CATEGORIES],
        },
      },
      _sum: { nominal: true },
    }),
    client.projectArusKas.aggregate({
      where: {
        id_project: idProject,
        status_transaksi: { not: "dibatalkan" },
        jenis_transaksi: "pengeluaran",
      },
      _sum: { nominal: true },
    }),
  ]);

  const totalSetor = toDecimal(paidAgg._sum.nominal_terbayar ?? 0);
  const pemasukanNonModal = toDecimal(incomeAgg._sum.nominal ?? 0);
  const pengeluaran = toDecimal(expenseAgg._sum.nominal ?? 0);

  return totalSetor.plus(pemasukanNonModal).minus(pengeluaran);
}

/**
 * Refresh cache `persentase_kepemilikan = modal_disetor / max(target, Σsetor)`
 * untuk seluruh investor project. Kepemilikan ditampilkan live; cache dijaga
 * konsisten. Lihat src/lib/investor-ownership.ts. Kembalikan Σ modal disetor.
 */
export async function refreshOwnershipCache(
  tx: Prisma.TransactionClient,
  idProject: string,
  targetPendanaan: Prisma.Decimal
): Promise<Prisma.Decimal> {
  const investors = await tx.projectInvestor.findMany({
    where: { id_project: idProject },
    select: { id_project_investor: true, nominal_terbayar: true },
  });

  const totalPaid = investors.reduce(
    (sum, i) => sum.plus(toDecimal(i.nominal_terbayar)),
    new Prisma.Decimal(0)
  );
  const denom = totalPaid.gt(targetPendanaan) ? totalPaid : targetPendanaan;

  if (investors.length > 0) {
    if (denom.gt(0)) {
      const cases = investors.map((i) => {
        const percent = toDecimal(i.nominal_terbayar)
          .div(denom)
          .mul(100)
          .toDecimalPlaces(6);
        return Prisma.sql`WHEN id_project_investor = ${i.id_project_investor} THEN ${percent}::numeric`;
      });
      await tx.$executeRaw(Prisma.sql`
        UPDATE project_investor
        SET persentase_kepemilikan = CASE ${Prisma.join(cases, " ")} ELSE persentase_kepemilikan END
        WHERE id_project = ${idProject}
      `);
    } else {
      await tx.$executeRaw(Prisma.sql`
        UPDATE project_investor SET persentase_kepemilikan = 0 WHERE id_project = ${idProject}
      `);
    }
  }

  return totalPaid;
}

/** Σ pengeluaran tercatat (biaya akuisisi aktual/realisasi). */
export async function computeRealizedExpense(
  client: DbClient,
  idProject: string
): Promise<Prisma.Decimal> {
  const agg = await client.projectArusKas.aggregate({
    where: {
      id_project: idProject,
      status_transaksi: { not: "dibatalkan" },
      jenis_transaksi: "pengeluaran",
    },
    _sum: { nominal: true },
  });
  return toDecimal(agg._sum.nominal ?? 0);
}

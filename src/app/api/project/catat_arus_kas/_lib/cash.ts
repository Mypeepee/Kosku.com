import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * ── Helper database untuk arus kas project ─────────────────────────────────
 *
 * PERHATIAN: rumus kas & anggaran TIDAK tinggal di sini. Sumber tunggalnya
 * adalah `@/lib/project-kas` (rumus murni) dan `@/lib/project-kas-server`
 * (pemuat dari database). Berkas ini hanya menyimpan operasi tulis yang
 * berhubungan dengan kepemilikan investor.
 */

type DbClient = Prisma.TransactionClient | typeof prisma;

function toDecimal(value: unknown) {
  if (value instanceof Prisma.Decimal) return value;
  if (typeof value === "number" || typeof value === "string") {
    return new Prisma.Decimal(value);
  }
  return new Prisma.Decimal(0);
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

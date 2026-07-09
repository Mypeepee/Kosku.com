import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeRealizedExpense } from "../../catat_arus_kas/_lib/cash";

/**
 * ── Penjualan per unit: satu sumber kebenaran ───────────────────────────────
 * Project bisa terdiri dari beberapa unit jual (mis. 2 rumah jejer). Tiap unit
 * punya bobot_persen (Σ = 100). "Terjual" diturunkan dari keberadaan baris
 * ProjectSelesai yang menunjuk unit — tidak ada kolom status yang bisa desync.
 *
 * Aturan uang (server-authoritative, jangan percaya client):
 * - totalBiaya project = max(rencana total_biaya_akuisisi, Σ realisasi pengeluaran).
 * - biaya unit  = bobot% × totalBiaya; unit TERAKHIR = sisa (totalBiaya − Σ biaya
 *   unit terjual) → Σ biaya semua unit = totalBiaya persis, pertumbuhan biaya
 *   setelah unit awal laku terserap unit terakhir.
 * - modal kembali investor per unit = bobot% × modal disetor; unit TERAKHIR =
 *   modal disetor − Σ modal yang sudah dikembalikan → tiap investor menerima
 *   kembali persis 100% modalnya sepanjang umur project.
 * - Residual pembulatan selalu dibebankan ke porsi terbesar → Σ pasti utuh.
 */

export function round2(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function round6(value: number): number {
  return (
    Math.round((Number.isFinite(value) ? value : 0) * 1_000_000) / 1_000_000
  );
}

export function toNum(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value.trim().replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === "object") {
    const parsed = Number((value as { toString(): string }).toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

type DbClient = Prisma.TransactionClient | typeof prisma;

export type SaleRecord = {
  id_project_selesai: bigint;
  id_project_unit: bigint | null;
  tanggal_pembelian: Date | null;
  tanggal_terjual: Date;
  durasi_hari: number;
  harga_jual: number;
  total_biaya_akuisisi: number;
  profit_kotor: number;
  pph_percent: number;
  ajb_percent: number;
  agent_fee_percent: number;
  total_biaya_transaksi: number;
  profit_bersih: number;
  roi_bersih: number;
};

export type UnitWithSale = {
  id_project_unit: bigint;
  nama_unit: string;
  bobot_persen: number;
  urutan: number;
  sale: SaleRecord | null;
};

export type SaleContext = {
  project: {
    id_project: string;
    id_listing: bigint;
    mulai_tanggal: Date | null;
    status: string;
    target_pendanaan: number;
    estimasi_harga_jual: number;
    total_biaya_akuisisi_rencana: number;
  };
  /** Basis biaya project = max(rencana, Σ realisasi pengeluaran). */
  totalBiaya: number;
  units: UnitWithSale[];
  /** Baris penjualan project utuh (id_project_unit NULL) — mode legacy/1 unit. */
  legacySale: SaleRecord | null;
  soldCount: number;
};

function mapSaleRow(row: {
  id_project_selesai: bigint;
  id_project_unit: bigint | null;
  tanggal_pembelian: Date | null;
  tanggal_terjual: Date;
  durasi_hari: number;
  harga_jual: Prisma.Decimal;
  total_biaya_akuisisi: Prisma.Decimal;
  profit_kotor: Prisma.Decimal;
  pph_percent: Prisma.Decimal;
  ajb_percent: Prisma.Decimal;
  agent_fee_percent: Prisma.Decimal;
  total_biaya_transaksi: Prisma.Decimal;
  profit_bersih: Prisma.Decimal;
  roi_bersih: Prisma.Decimal;
}): SaleRecord {
  return {
    id_project_selesai: row.id_project_selesai,
    id_project_unit: row.id_project_unit,
    tanggal_pembelian: row.tanggal_pembelian,
    tanggal_terjual: row.tanggal_terjual,
    durasi_hari: row.durasi_hari,
    harga_jual: toNum(row.harga_jual),
    total_biaya_akuisisi: toNum(row.total_biaya_akuisisi),
    profit_kotor: toNum(row.profit_kotor),
    pph_percent: toNum(row.pph_percent),
    ajb_percent: toNum(row.ajb_percent),
    agent_fee_percent: toNum(row.agent_fee_percent),
    total_biaya_transaksi: toNum(row.total_biaya_transaksi),
    profit_bersih: toNum(row.profit_bersih),
    roi_bersih: toNum(row.roi_bersih),
  };
}

export async function getSaleContext(
  client: DbClient,
  idProject: string
): Promise<SaleContext | null> {
  const [project, unitRows, saleRows, realisasi] = await Promise.all([
    client.project.findUnique({
      where: { id_project: idProject },
      select: {
        id_project: true,
        id_listing: true,
        mulai_tanggal: true,
        status: true,
        target_pendanaan: true,
        estimasi_harga_jual: true,
        total_biaya_akuisisi: true,
      },
    }),
    client.projectUnit.findMany({
      where: { id_project: idProject },
      orderBy: [{ urutan: "asc" }, { id_project_unit: "asc" }],
    }),
    client.projectSelesai.findMany({
      where: { id_project: idProject },
      orderBy: { id_project_selesai: "asc" },
    }),
    computeRealizedExpense(client, idProject),
  ]);

  if (!project) return null;

  const rencana = toNum(project.total_biaya_akuisisi);
  const totalBiaya = round2(Math.max(rencana, toNum(realisasi)));

  const saleByUnit = new Map<string, SaleRecord>();
  let legacySale: SaleRecord | null = null;

  for (const row of saleRows) {
    const sale = mapSaleRow(row);
    if (row.id_project_unit != null) {
      saleByUnit.set(String(row.id_project_unit), sale);
    } else {
      legacySale = sale;
    }
  }

  const units: UnitWithSale[] = unitRows.map((unit) => ({
    id_project_unit: unit.id_project_unit,
    nama_unit: unit.nama_unit,
    bobot_persen: toNum(unit.bobot_persen),
    urutan: unit.urutan,
    sale: saleByUnit.get(String(unit.id_project_unit)) ?? null,
  }));

  return {
    project: {
      id_project: project.id_project,
      id_listing: project.id_listing,
      mulai_tanggal: project.mulai_tanggal,
      status: String(project.status),
      target_pendanaan: toNum(project.target_pendanaan),
      estimasi_harga_jual: toNum(project.estimasi_harga_jual),
      total_biaya_akuisisi_rencana: rencana,
    },
    totalBiaya,
    units,
    legacySale,
    soldCount: units.filter((u) => u.sale).length,
  };
}

/**
 * Biaya akuisisi sebuah unit BELUM terjual jika dijual sekarang.
 * Unit terjual memakai angka tersimpan (historis, tidak berubah).
 */
export function computeUnitCost(ctx: SaleContext, unitId: bigint): number {
  const unit = ctx.units.find((u) => u.id_project_unit === unitId);
  if (!unit) return 0;
  if (unit.sale) return unit.sale.total_biaya_akuisisi;

  const unsold = ctx.units.filter((u) => !u.sale);
  const biayaTerjual = ctx.units.reduce(
    (sum, u) => sum + (u.sale ? u.sale.total_biaya_akuisisi : 0),
    0
  );

  if (unsold.length === 1) {
    // Unit terakhir menyerap sisa — Σ biaya seluruh unit = totalBiaya persis.
    return round2(Math.max(0, ctx.totalBiaya - biayaTerjual));
  }

  return round2((unit.bobot_persen / 100) * ctx.totalBiaya);
}

export type InvestorPaidRow = {
  id_agent: string;
  nominal_komitmen: number;
  nominal_terbayar: number;
};

export type DistributionRow = {
  id_agent: string;
  modal: number;
  porsi_percent: number;
  profit: number;
  total_diterima: number;
};

/**
 * Distribusi hasil penjualan satu unit ke investor.
 * - weight_i = modal disetor_i / Σ disetor (dinormalisasi, Σ weight = 1).
 * - modalPool = pool modal yang dikembalikan pada penjualan ini
 *   (unit: bobot%×Σsetor atau sisa; legacy: Σsetor penuh).
 * - profitBersih dibagi menurut weight, residual pembulatan ke porsi terbesar.
 * - modal per investor: proporsi weight terhadap modalPool; jika isFinal,
 *   dikoreksi agar tiap investor genap menerima kembali seluruh setorannya
 *   (dikurangi yang sudah dikembalikan pada penjualan unit sebelumnya).
 */
export function buildDistribution(options: {
  investors: InvestorPaidRow[];
  profitBersih: number;
  bobotPersen: number;
  isFinal: boolean;
  /** Σ modal yang SUDAH dikembalikan per agent pada penjualan sebelumnya. */
  priorReturnedByAgent: Map<string, number>;
}): DistributionRow[] {
  const { investors, profitBersih, bobotPersen, isFinal, priorReturnedByAgent } =
    options;

  const base = investors
    .map((inv) => {
      const terbayar = round2(Math.max(0, toNum(inv.nominal_terbayar)));
      const modalBasis =
        terbayar > 0 ? terbayar : round2(Math.max(0, toNum(inv.nominal_komitmen)));
      return { id_agent: String(inv.id_agent || "").trim(), modalBasis };
    })
    .filter((item) => item.id_agent.length > 0);

  const totalModal = base.reduce((sum, item) => sum + item.modalBasis, 0);
  if (!base.length || totalModal <= 0) return [];

  const rows = base.map((item) => {
    const weight = item.modalBasis / totalModal;

    let modal: number;
    if (isFinal) {
      const prior = priorReturnedByAgent.get(item.id_agent) ?? 0;
      modal = round2(Math.max(0, item.modalBasis - prior));
    } else {
      modal = round2((bobotPersen / 100) * item.modalBasis);
    }

    return {
      id_agent: item.id_agent,
      weight,
      modal,
      profit: round2(profitBersih * weight),
    };
  });

  // Residual profit (akibat pembulatan) dibebankan ke porsi terbesar
  // supaya Σ profit investor = profit bersih unit, persis.
  const profitSum = round2(rows.reduce((sum, row) => sum + row.profit, 0));
  const residual = round2(profitBersih - profitSum);
  if (residual !== 0 && rows.length > 0) {
    const largest = rows.reduce((acc, row) =>
      row.weight > acc.weight ? row : acc
    );
    largest.profit = round2(largest.profit + residual);
  }

  return rows.map((row) => ({
    id_agent: row.id_agent,
    modal: row.modal,
    porsi_percent: round6(row.weight * 100),
    profit: row.profit,
    total_diterima: round2(row.modal + row.profit),
  }));
}

/** Σ modal yang sudah dikembalikan per agent dari penjualan sebelumnya. */
export async function getPriorReturnedByAgent(
  client: DbClient,
  idProject: string
): Promise<Map<string, number>> {
  const rows = await client.projectSelesaiInvestor.groupBy({
    by: ["id_agent"],
    where: { id_project: idProject },
    _sum: { modal: true },
  });

  return new Map(
    rows.map((row) => [row.id_agent, toNum(row._sum.modal ?? 0)])
  );
}

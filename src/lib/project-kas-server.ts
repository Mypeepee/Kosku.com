import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  computeFundState,
  type FundState,
  type WalletKey,
} from "@/lib/project-kas";

export type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * Muat keadaan dana project (kas + anggaran pos) dari database memakai mesin
 * hitung tunggal di `@/lib/project-kas`. Dipakai server (penegak aturan) dan
 * halaman dashboard (penampil angka) supaya angkanya mustahil berbeda.
 */
export async function loadFundState(
  client: DbClient,
  idProject: string
): Promise<FundState | null> {
  const [project, rows, investors] = await Promise.all([
    client.project.findUnique({
      where: { id_project: idProject },
      select: {
        target_pendanaan: true,
        nilai_limit_lelang: true,
        spare_bidding: true,
        biaya_balik_nama: true,
        biaya_eksekusi: true,
        biaya_renov: true,
        dana_cadangan: true,
      },
    }),
    client.projectArusKas.findMany({
      where: {
        id_project: idProject,
        status_transaksi: { not: "dibatalkan" },
      },
      select: {
        wallet_key: true,
        jenis_transaksi: true,
        kategori_transaksi: true,
        status_transaksi: true,
        nominal: true,
      },
    }),
    client.projectInvestor.findMany({
      where: { id_project: idProject },
      select: { nominal_komitmen: true, nominal_terbayar: true },
    }),
  ]);

  if (!project) return null;

  return computeFundState({ project, rows, investors });
}

/**
 * Keadaan dana SEOLAH satu baris arus kas tertentu tidak ada. Dipakai saat
 * edit/hapus supaya efek baris lama dilepas dulu sebelum diuji ulang.
 */
export async function loadFundStateExcluding(
  client: DbClient,
  idProject: string,
  excludeId: bigint
): Promise<FundState | null> {
  const [project, rows, investors] = await Promise.all([
    client.project.findUnique({
      where: { id_project: idProject },
      select: {
        target_pendanaan: true,
        nilai_limit_lelang: true,
        spare_bidding: true,
        biaya_balik_nama: true,
        biaya_eksekusi: true,
        biaya_renov: true,
        dana_cadangan: true,
      },
    }),
    client.projectArusKas.findMany({
      where: {
        id_project: idProject,
        status_transaksi: { not: "dibatalkan" },
        id_project_arus_kas: { not: excludeId },
      },
      select: {
        wallet_key: true,
        jenis_transaksi: true,
        kategori_transaksi: true,
        status_transaksi: true,
        nominal: true,
      },
    }),
    client.projectInvestor.findMany({
      where: { id_project: idProject },
      select: { nominal_komitmen: true, nominal_terbayar: true },
    }),
  ]);

  if (!project) return null;

  return computeFundState({ project, rows, investors });
}

export function formatIDR(value: number) {
  return `Rp ${Math.round(Math.abs(value)).toLocaleString("id-ID")}`;
}

export type { WalletKey };

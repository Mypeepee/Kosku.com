import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import {
  ownershipDenominator,
  ownershipPercent,
  summarizeFunding,
} from "@/lib/investor-ownership";

type ProjectSelesaiItem = {
  id_project: string;
  id_listing: number;
  tanggal_pembelian: string | null;
  tanggal_terjual: string;
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
  dibuat_tanggal: string | null;
  diupdate_tanggal: string | null;
};

type ProjectListItem = {
  id: string;
  nama: string;
  lokasi: string;
  status: string;
  jenisPendanaan: "terbuka" | "tertutup";
  thumbnail: string;
  targetPendanaan: number;
  /** Σ komitmen. BUKAN dasar progres pendanaan. */
  totalPendanaan: number;
  /** Σ modal disetor — dasar progres pendanaan. */
  danaTerkumpul: number;
  /** Σ komitmen seluruh investor. */
  danaKomitmen: number;
  /** Dijanjikan tapi belum disetor. */
  danaBelumSetor: number;
  /** Jumlah investor yang modalnya sudah masuk penuh. */
  investorLunas: number;
  estimasiHargaJual: number;
  estimasiProfit: number;
  hariTersisa: number;
  investor: number;
  avatarInvestor: string[];
  estimasiSelesaiBulan?: number;
  createdById?: string | null;
  projectSelesai?: ProjectSelesaiItem | null;
  userInvestment?: {
    nominalKomitmen: number;
    /** Modal yang sudah disetor. */
    nominalTerbayar: number;
    persentaseKepemilikan: number | null;
    status: string;
    updatedAt?: string | null;
  } | null;
};

type WalletData = {
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

type WalletRow = {
  total_dana: string;
  total_lunas: string;
  total_pending: string;
  project_aktif: number;
  pending_payment_count: number;
  pending_project_count: number;
  realized_profit: string;
};

type ProjectListResponse = {
  success: boolean;
  data?: ProjectListItem[];
  wallet?: WalletData;
  message?: string;
};

type RawProjectSelesaiRow = {
  id_project: string;
  id_listing: bigint | number;
  tanggal_pembelian: Date | null;
  tanggal_terjual: Date;
  durasi_hari: number;
  harga_jual: Prisma.Decimal | number | string;
  total_biaya_akuisisi: Prisma.Decimal | number | string;
  profit_kotor: Prisma.Decimal | number | string;
  pph_percent: Prisma.Decimal | number | string;
  ajb_percent: Prisma.Decimal | number | string;
  agent_fee_percent: Prisma.Decimal | number | string;
  total_biaya_transaksi: Prisma.Decimal | number | string;
  profit_bersih: Prisma.Decimal | number | string;
  roi_bersih: Prisma.Decimal | number | string;
  dibuat_tanggal: Date | null;
  diupdate_tanggal: Date | null;
};

function toNumber(
  value:
    | { toString(): string }
    | number
    | bigint
    | string
    | null
    | undefined
) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);

  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractDriveId(raw: string): string | null {
  const patterns = [
    /[?&]id=([^&#]+)/i,
    /\/file\/d\/([^/]+)/i,
    /\/d\/([^/]+)/i,
    /\/thumbnail\?id=([^&#]+)/i,
  ];
  for (const p of patterns) {
    const m = raw.match(p);
    if (m?.[1]) return m[1];
  }
  if (/^[A-Za-z0-9_-]{20,}$/.test(raw)) return raw;
  return null;
}

function resolveDriveUrl(raw: string | null | undefined, sz: string): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  if ((t.startsWith("https://") || t.startsWith("http://")) && !t.includes("drive.google.com")) return t;
  const id = extractDriveId(t);
  if (id) return `/api/drive-image?id=${id}&sz=${sz}`;
  if (t.startsWith("/")) return t;
  return null;
}

function toTitleCaseStatus(value?: string | null) {
  if (!value) return "-";

  return String(value)
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getLokasi(kota?: string | null, provinsi?: string | null) {
  const parts = [kota, provinsi].filter(Boolean);
  return parts.length ? parts.join(", ") : "-";
}

function getHariTersisa(
  jenisPendanaan: "terbuka" | "tertutup",
  pendanaanDitutupPada?: Date | null
) {
  if (jenisPendanaan === "tertutup") return 0;
  if (!pendanaanDitutupPada) return 0;

  const now = new Date();
  const diffMs = pendanaanDitutupPada.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : 0;
}

function mapFinishedRow(row: RawProjectSelesaiRow): ProjectSelesaiItem {
  return {
    id_project: row.id_project,
    id_listing: toNumber(row.id_listing),
    tanggal_pembelian: row.tanggal_pembelian
      ? row.tanggal_pembelian.toISOString()
      : null,
    tanggal_terjual: row.tanggal_terjual.toISOString(),
    durasi_hari: toNumber(row.durasi_hari),
    harga_jual: toNumber(row.harga_jual),
    total_biaya_akuisisi: toNumber(row.total_biaya_akuisisi),
    profit_kotor: toNumber(row.profit_kotor),
    pph_percent: toNumber(row.pph_percent),
    ajb_percent: toNumber(row.ajb_percent),
    agent_fee_percent: toNumber(row.agent_fee_percent),
    total_biaya_transaksi: toNumber(row.total_biaya_transaksi),
    profit_bersih: toNumber(row.profit_bersih),
    roi_bersih: toNumber(row.roi_bersih),
    dibuat_tanggal: row.dibuat_tanggal
      ? row.dibuat_tanggal.toISOString()
      : null,
    diupdate_tanggal: row.diupdate_tanggal
      ? row.diupdate_tanggal.toISOString()
      : null,
  };
}

export async function GET() {
  try {
    const session = (await getServerSession(authOptions as any)) as any;
    const agentId = String(session?.user?.agentId || "").trim();

    const orConditions: Prisma.ProjectWhereInput[] = [
      { jenis_pendanaan: "terbuka" },
    ];
    if (agentId) {
      orConditions.push({ pembuat: { is: { id_agent: agentId } } });
      orConditions.push({
        jenis_pendanaan: "tertutup",
        investorProject: { some: { id_agent: agentId } },
      });
    }

    const projects = await prisma.project.findMany({
      where: { OR: orConditions },
      orderBy: [{ dibuat_tanggal: "desc" }],
      select: {
        id_project: true,
        nama_project: true,
        kota: true,
        provinsi: true,
        status: true,
        jenis_pendanaan: true,
        gambar_thumbnail: true,
        target_pendanaan: true,
        total_pendanaan: true,
        estimasi_harga_jual: true,
        estimasi_profit_bersih: true,
        pendanaan_ditutup_pada: true,
        estimasi_bulan: true,
        pembuat: {
          select: {
            id_agent: true,
          },
        },
        investorProject: {
          orderBy: {
            nominal_komitmen: "desc",
          },
          select: {
            id_agent: true,
            nominal_komitmen: true,
            nominal_terbayar: true,
            persentase_kepemilikan: true,
            status: true,
            diupdate_tanggal: true,
            agent: {
              select: {
                foto_profil_url: true,
              },
            },
          },
        },
      },
    });

    const projectIds = projects.map((item) => item.id_project);

    // Fire wallet query concurrently with finishedRows — both are independent
    const walletPromise = agentId
      ? prisma.$queryRaw<WalletRow[]>(
          Prisma.sql`
            SELECT
              COALESCE(SUM(pi.nominal_komitmen), 0)::text AS total_dana,
              COALESCE(SUM(CASE WHEN pi.status = 'lunas' THEN pi.nominal_komitmen ELSE 0 END), 0)::text AS total_lunas,
              COALESCE(SUM(CASE WHEN pi.status = 'menunggu_pembayaran' THEN pi.nominal_komitmen ELSE 0 END), 0)::text AS total_pending,
              COUNT(DISTINCT pi.id_project)::int AS project_aktif,
              COUNT(*) FILTER (WHERE pi.status = 'menunggu_pembayaran')::int AS pending_payment_count,
              COUNT(DISTINCT CASE WHEN pi.status = 'menunggu_pembayaran' THEN pi.id_project END)::int AS pending_project_count,
              (
                SELECT COALESCE(SUM(psi.profit), 0)
                FROM project_selesai_investor psi
                WHERE psi.id_agent = ${agentId}
              )::text AS realized_profit
            FROM project_investor pi
            WHERE pi.id_agent = ${agentId}
          `
        )
      : Promise.resolve(null);

    let finishedMap = new Map<string, ProjectSelesaiItem>();

    if (projectIds.length > 0) {
      // Satu project bisa punya BANYAK baris penjualan (jual per unit) —
      // diagregasi jadi satu ringkasan; ROI = Σ profit / Σ biaya (tertimbang).
      const finishedRows = await prisma.$queryRaw<RawProjectSelesaiRow[]>(
        Prisma.sql`
          SELECT
            id_project,
            MAX(id_listing) AS id_listing,
            MIN(tanggal_pembelian) AS tanggal_pembelian,
            MAX(tanggal_terjual) AS tanggal_terjual,
            MAX(durasi_hari) AS durasi_hari,
            SUM(harga_jual) AS harga_jual,
            SUM(total_biaya_akuisisi) AS total_biaya_akuisisi,
            SUM(profit_kotor) AS profit_kotor,
            MAX(pph_percent) AS pph_percent,
            MAX(ajb_percent) AS ajb_percent,
            MAX(agent_fee_percent) AS agent_fee_percent,
            SUM(total_biaya_transaksi) AS total_biaya_transaksi,
            SUM(profit_bersih) AS profit_bersih,
            CASE
              WHEN SUM(total_biaya_akuisisi) > 0
              THEN ROUND(SUM(profit_bersih) / SUM(total_biaya_akuisisi) * 100, 2)
              ELSE 0
            END AS roi_bersih,
            MIN(dibuat_tanggal) AS dibuat_tanggal,
            MAX(diupdate_tanggal) AS diupdate_tanggal
          FROM public.project_selesai
          WHERE id_project IN (${Prisma.join(projectIds)})
          GROUP BY id_project
        `
      );

      finishedMap = new Map(
        finishedRows.map((row) => [row.id_project, mapFinishedRow(row)])
      );
    }

    const walletRows = await walletPromise;

    const data: ProjectListItem[] = projects.map((project) => {
      const jenisPendanaan = project.jenis_pendanaan as "terbuka" | "tertutup";

      const sortedInvestorAvatars = project.investorProject
        .map((item) => resolveDriveUrl(item.agent?.foto_profil_url, "w96") || "")
        .filter(Boolean);

      const myInvestment = agentId
        ? project.investorProject.find((item) => item.id_agent === agentId)
        : null;

      // Kepemilikan = modal DISETOR / max(target, Σ setor). Porsi stabil saat
      // underfunded; talangan (Σ>target) mendilusi proporsional. Dihitung live.
      // Lihat src/lib/investor-ownership.ts.
      // Progres pendanaan = uang yang SUDAH masuk, bukan komitmen. Kolom
      // `project.total_pendanaan` (Σ komitmen) sengaja tidak dipakai untuk
      // progres — lihat summarizeFunding di src/lib/investor-ownership.ts.
      const funding = summarizeFunding(
        project.investorProject.map((item) => ({
          committed: item.nominal_komitmen,
          paid: item.nominal_terbayar,
          status: item.status,
        })),
        project.target_pendanaan
      );

      const totalSetorProject = funding.terkumpul;
      const ownershipDenomProject = ownershipDenominator(
        toNumber(project.target_pendanaan),
        totalSetorProject
      );

      // Ringkasan penjualan hanya ditampilkan bila project SUDAH terjual
      // penuh (status terjual). Terjual sebagian (unit) → tetap status asli.
      const projectSelesai =
        String(project.status) === "terjual"
          ? finishedMap.get(project.id_project) ?? null
          : null;

      const displayStatus = projectSelesai
        ? "Sudah Terjual"
        : jenisPendanaan === "tertutup" &&
          String(project.status).toLowerCase().includes("pendanaan")
        ? "Pendanaan Tertutup"
        : toTitleCaseStatus(project.status);

      return {
        id: project.id_project,
        nama: project.nama_project,
        lokasi: getLokasi(project.kota, project.provinsi),
        status: displayStatus,
        jenisPendanaan,
        thumbnail:
          resolveDriveUrl(project.gambar_thumbnail, "w800") ||
          "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80",
        targetPendanaan: toNumber(project.target_pendanaan),
        // Σ komitmen — dipertahankan untuk kompatibilitas, TAPI bukan dasar
        // progres pendanaan.
        totalPendanaan: toNumber(project.total_pendanaan),
        /** Modal yang benar-benar sudah masuk — dasar progres pendanaan. */
        danaTerkumpul: funding.terkumpul,
        /** Σ komitmen seluruh investor (termasuk yang belum bayar). */
        danaKomitmen: funding.komitmen,
        /** Dijanjikan tapi belum disetor. */
        danaBelumSetor: funding.belumSetor,
        investorLunas: funding.jumlahLunas,
        estimasiHargaJual: toNumber(project.estimasi_harga_jual),
        estimasiProfit: toNumber(project.estimasi_profit_bersih),
        hariTersisa: projectSelesai
          ? 0
          : getHariTersisa(jenisPendanaan, project.pendanaan_ditutup_pada),
        investor: project.investorProject.length,
        avatarInvestor: sortedInvestorAvatars,
        estimasiSelesaiBulan: project.estimasi_bulan ?? 0,
        createdById: project.pembuat?.id_agent ?? null,
        projectSelesai,
        userInvestment: myInvestment
          ? {
              nominalKomitmen: toNumber(myInvestment.nominal_komitmen),
              /** Modal yang benar-benar sudah disetor — dasar hitung profit. */
              nominalTerbayar: toNumber(myInvestment.nominal_terbayar),
              persentaseKepemilikan: ownershipPercent(
                myInvestment.nominal_terbayar,
                ownershipDenomProject
              ),
              status: String(myInvestment.status || "menunggu_pembayaran"),
              updatedAt: myInvestment.diupdate_tanggal
                ? myInvestment.diupdate_tanggal.toISOString()
                : null,
            }
          : null,
      };
    });

    let wallet: WalletData | undefined;
    if (walletRows && walletRows.length > 0) {
      const w = walletRows[0];
      const totalDana = Number(w.total_dana ?? 0);
      const totalDanaLunas = Number(w.total_lunas ?? 0);
      const totalDanaPending = Number(w.total_pending ?? 0);
      const projectAktif = Number(w.project_aktif ?? 0);
      const pendingPaymentCount = Number(w.pending_payment_count ?? 0);
      const pendingProjectCount = Number(w.pending_project_count ?? 0);
      const realizedProfit = Number(w.realized_profit ?? 0);
      wallet = {
        totalDana,
        totalDanaLunas,
        totalDanaPending,
        projectAktif,
        jumlahPropertyDidanai: projectAktif,
        pendingPaymentCount,
        pendingProjectCount,
        hasPendingPayment: pendingPaymentCount > 0,
        realizedProfit,
      };
    }

    return NextResponse.json<ProjectListResponse>({
      success: true,
      data,
      wallet,
    });
  } catch (error) {
    console.error("[GET_PROJECT_LIST_ERROR]", error);

    return NextResponse.json<ProjectListResponse>(
      {
        success: false,
        message: "Gagal mengambil daftar project.",
      },
      { status: 500 }
    );
  }
}
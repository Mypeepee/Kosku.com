import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const WALLET_KEYS = [
  "utama",
  "dokumen",
  "eksekusi",
  "renovasi",
  "cadangan",
] as const;

const JENIS_ARUS_KAS = ["pemasukan", "pengeluaran"] as const;

const KATEGORI_ARUS_KAS = [
  "setoran_modal",
  "hasil_penjualan",
  "refund",
  "pemasukan_lain",
  "pembelian_aset",
  "biaya_spare_bidding",
  "biaya_dokumen_balik_nama",
  "biaya_eksekusi_pengosongan",
  "biaya_renovasi",
  "penggunaan_dana_cadangan",
  "pengeluaran_lain",
] as const;

const STATUS_ARUS_KAS = ["tercatat", "dibatalkan"] as const;

const PROJECT_STATUSES = [
  "pendanaan_terbuka",
  "pendanaan_penuh",
  "pengurusan_dokumen",
  "eksekusi_pengosongan",
  "renovasi",
  "sedang_dijual",
  "terjual",
  "dibatalkan",
] as const;

const AUTO_UPDATE_ALLOWED_TARGETS = [
  "pengurusan_dokumen",
  "eksekusi_pengosongan",
  "renovasi",
  "sedang_dijual",
] as const;

type WalletKey = (typeof WALLET_KEYS)[number];
type JenisArusKas = (typeof JENIS_ARUS_KAS)[number];
type KategoriArusKas = (typeof KATEGORI_ARUS_KAS)[number];
type StatusArusKas = (typeof STATUS_ARUS_KAS)[number];
type ProjectStatus = (typeof PROJECT_STATUSES)[number];
type AutoUpdateAllowedTarget =
  (typeof AUTO_UPDATE_ALLOWED_TARGETS)[number];

class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function isWalletKey(value: unknown): value is WalletKey {
  return typeof value === "string" && WALLET_KEYS.includes(value as WalletKey);
}

function isJenisArusKas(value: unknown): value is JenisArusKas {
  return (
    typeof value === "string" && JENIS_ARUS_KAS.includes(value as JenisArusKas)
  );
}

function isKategoriArusKas(value: unknown): value is KategoriArusKas {
  return (
    typeof value === "string" &&
    KATEGORI_ARUS_KAS.includes(value as KategoriArusKas)
  );
}

function isStatusArusKas(value: unknown): value is StatusArusKas {
  return (
    typeof value === "string" &&
    STATUS_ARUS_KAS.includes(value as StatusArusKas)
  );
}

function isProjectStatus(value: unknown): value is ProjectStatus {
  return (
    typeof value === "string" &&
    PROJECT_STATUSES.includes(value as ProjectStatus)
  );
}

function isAutoUpdateAllowedTarget(
  value: unknown
): value is AutoUpdateAllowedTarget {
  return (
    typeof value === "string" &&
    AUTO_UPDATE_ALLOWED_TARGETS.includes(value as AutoUpdateAllowedTarget)
  );
}

function normalizeJenis(value: unknown): JenisArusKas {
  if (value === "masuk") return "pemasukan";
  if (value === "keluar") return "pengeluaran";
  if (isJenisArusKas(value)) return value;
  return "pengeluaran";
}

function normalizeStatusArusKas(value: unknown): StatusArusKas {
  if (isStatusArusKas(value)) return value;

  if (
    value === "berhasil" ||
    value === "dibayar" ||
    value === "lunas" ||
    value === "selesai" ||
    value === "success" ||
    value === "pending"
  ) {
    return "tercatat";
  }

  return "tercatat";
}

function inferKategori(
  walletKey: WalletKey,
  jenisTransaksi: JenisArusKas,
  requested?: unknown
): KategoriArusKas {
  if (isKategoriArusKas(requested)) {
    return requested;
  }

  if (jenisTransaksi === "pemasukan") {
    return "pemasukan_lain";
  }

  switch (walletKey) {
    case "dokumen":
      return "biaya_dokumen_balik_nama";
    case "eksekusi":
      return "biaya_eksekusi_pengosongan";
    case "renovasi":
      return "biaya_renovasi";
    case "cadangan":
      return "penggunaan_dana_cadangan";
    case "utama":
    default:
      return "pengeluaran_lain";
  }
}

function normalizeTanggal(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const raw = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseNominal(value: unknown): Prisma.Decimal | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    return new Prisma.Decimal(value);
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]/g, "");
    if (!cleaned) return null;

    try {
      const decimal = new Prisma.Decimal(cleaned);
      if (decimal.lte(0)) return null;
      return decimal;
    } catch {
      return null;
    }
  }

  return null;
}

function parseRouteBigInt(value: unknown): bigint | null {
  if (value === null || value === undefined) return null;

  const normalized = String(value).trim();

  if (!/^\d+$/.test(normalized)) return null;

  try {
    return BigInt(normalized);
  } catch {
    return null;
  }
}

function toDecimal(value: unknown) {
  if (value instanceof Prisma.Decimal) return value;
  if (typeof value === "number" || typeof value === "string") {
    return new Prisma.Decimal(value);
  }
  return new Prisma.Decimal(0);
}

function toNumber(value: unknown) {
  if (value instanceof Prisma.Decimal) {
    return Number(value.toString());
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeProjectStatus(value: unknown): ProjectStatus {
  if (isProjectStatus(value)) return value;
  return "pendanaan_terbuka";
}

function getProjectStatusRank(status: ProjectStatus) {
  return PROJECT_STATUSES.indexOf(status);
}

function resolveNextProjectStatus(params: {
  currentStatus: ProjectStatus;
  statusTransaksi: StatusArusKas;
  impactStatusProject: boolean;
  requestedTarget?: unknown;
}): ProjectStatus {
  const {
    currentStatus,
    statusTransaksi,
    impactStatusProject,
    requestedTarget,
  } = params;

  if (statusTransaksi !== "tercatat") {
    return currentStatus;
  }

  if (!impactStatusProject) {
    return currentStatus;
  }

  if (!isAutoUpdateAllowedTarget(requestedTarget)) {
    return currentStatus;
  }

  if (currentStatus === "terjual" || currentStatus === "dibatalkan") {
    return currentStatus;
  }

  const currentRank = getProjectStatusRank(currentStatus);
  const targetRank = getProjectStatusRank(requestedTarget);

  if (targetRank < currentRank) {
    return currentStatus;
  }

  return requestedTarget;
}

function serializeArusKasRecord(
  record: Record<string, unknown> | null | undefined
) {
  if (!record) return null;

  return {
    ...record,
    id_project_arus_kas:
      typeof record.id_project_arus_kas === "bigint"
        ? record.id_project_arus_kas.toString()
        : record.id_project_arus_kas,
    nominal:
      record.nominal instanceof Prisma.Decimal
        ? Number(record.nominal.toString())
        : record.nominal,
    tanggal_transaksi:
      record.tanggal_transaksi instanceof Date
        ? record.tanggal_transaksi.toISOString()
        : record.tanggal_transaksi,
    dibuat_tanggal:
      record.dibuat_tanggal instanceof Date
        ? record.dibuat_tanggal.toISOString()
        : record.dibuat_tanggal,
    diupdate_tanggal:
      record.diupdate_tanggal instanceof Date
        ? record.diupdate_tanggal.toISOString()
        : record.diupdate_tanggal,
  };
}

function buildProjectIncrementData(
  walletKey: WalletKey,
  deficitNominal: Prisma.Decimal
): Prisma.ProjectUpdateInput {
  switch (walletKey) {
    case "dokumen":
      return {
        biaya_balik_nama: { increment: deficitNominal },
        total_biaya_akuisisi: { increment: deficitNominal },
      };
    case "eksekusi":
      return {
        biaya_eksekusi: { increment: deficitNominal },
        total_biaya_akuisisi: { increment: deficitNominal },
      };
    case "renovasi":
      return {
        biaya_renov: { increment: deficitNominal },
        total_biaya_akuisisi: { increment: deficitNominal },
      };
    case "cadangan":
      return {
        dana_cadangan: { increment: deficitNominal },
      };
    case "utama":
    default:
      return {
        total_biaya_akuisisi: { increment: deficitNominal },
      };
  }
}

async function recalculateInvestorOwnership(
  tx: Prisma.TransactionClient,
  idProject: string
) {
  const investors = await tx.projectInvestor.findMany({
    where: { id_project: idProject },
    select: {
      id_project_investor: true,
      nominal_komitmen: true,
    },
  });

  const totalCommitment = investors.reduce(
    (sum, item) => sum.plus(toDecimal(item.nominal_komitmen)),
    new Prisma.Decimal(0)
  );

  if (investors.length > 0) {
    if (totalCommitment.gt(0)) {
      // Satu UPDATE dengan CASE WHEN — menggantikan N update serial (N+1 fix)
      const cases = investors.map((investor) => {
        const nominal = toDecimal(investor.nominal_komitmen);
        const percent = nominal
          .div(totalCommitment)
          .mul(100)
          .toDecimalPlaces(6);
        return Prisma.sql`WHEN id_project_investor = ${investor.id_project_investor} THEN ${percent}::numeric`;
      });

      await tx.$executeRaw(Prisma.sql`
        UPDATE project_investor
        SET persentase_kepemilikan = CASE ${Prisma.join(cases, " ")} ELSE persentase_kepemilikan END
        WHERE id_project = ${idProject}
      `);
    } else {
      await tx.$executeRaw(Prisma.sql`
        UPDATE project_investor
        SET persentase_kepemilikan = 0
        WHERE id_project = ${idProject}
      `);
    }
  }

  return totalCommitment;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const idProject =
      typeof body.id_project === "string" ? body.id_project.trim() : "";

    const walletKey = body.wallet_key;

    const judulTransaksi =
      typeof body.judul_transaksi === "string"
        ? body.judul_transaksi.trim()
        : "";

    const catatan =
      typeof body.catatan === "string" && body.catatan.trim()
        ? body.catatan.trim()
        : null;

    const impactStatusProject = body.impact_status_project === true;
    const statusProjectTarget = body.status_project_target;

    const autoCoverDeficit = body.auto_cover_deficit === true;
    const deficitNominal = autoCoverDeficit
      ? parseNominal(body.deficit_nominal)
      : null;

    const investorPenanggungId = autoCoverDeficit
      ? parseRouteBigInt(body?.investor_penanggung?.id_project_investor)
      : null;

    const investorPenanggungNama =
      autoCoverDeficit &&
      typeof body?.investor_penanggung?.nama === "string" &&
      body.investor_penanggung.nama.trim()
        ? body.investor_penanggung.nama.trim()
        : null;

    if (!idProject) {
      return NextResponse.json(
        { message: "id_project wajib diisi." },
        { status: 400 }
      );
    }

    if (!isWalletKey(walletKey)) {
      return NextResponse.json(
        { message: "wallet_key tidak valid." },
        { status: 400 }
      );
    }

    if (!judulTransaksi) {
      return NextResponse.json(
        { message: "judul_transaksi wajib diisi." },
        { status: 400 }
      );
    }

    if (
      impactStatusProject &&
      !isAutoUpdateAllowedTarget(statusProjectTarget)
    ) {
      return NextResponse.json(
        {
          message:
            "status_project_target tidak valid. Gunakan: pengurusan_dokumen, eksekusi_pengosongan, renovasi, atau sedang_dijual.",
        },
        { status: 400 }
      );
    }

    const tanggalTransaksi = normalizeTanggal(body.tanggal_transaksi);
    if (!tanggalTransaksi) {
      return NextResponse.json(
        { message: "tanggal_transaksi tidak valid." },
        { status: 400 }
      );
    }

    const nominal = parseNominal(body.nominal);
    if (!nominal) {
      return NextResponse.json(
        { message: "nominal harus lebih besar dari 0." },
        { status: 400 }
      );
    }

    const jenisTransaksi = normalizeJenis(body.jenis_transaksi);
    const statusTransaksi = normalizeStatusArusKas(body.status_transaksi);
    const kategoriTransaksi = inferKategori(
      walletKey,
      jenisTransaksi,
      body.kategori_transaksi
    );

    if (autoCoverDeficit) {
      if (jenisTransaksi !== "pengeluaran") {
        return NextResponse.json(
          {
            message:
              "Auto cover defisit hanya bisa dipakai untuk transaksi pengeluaran.",
          },
          { status: 400 }
        );
      }

      if (!deficitNominal || deficitNominal.lte(0)) {
        return NextResponse.json(
          { message: "deficit_nominal harus lebih besar dari 0." },
          { status: 400 }
        );
      }

      if (!investorPenanggungId) {
        return NextResponse.json(
          { message: "Investor penanggung defisit wajib dipilih." },
          { status: 400 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: { id_project: idProject },
        select: {
          id_project: true,
          status: true,
          total_pendanaan: true,
        },
      });

      if (!project) {
        throw new HttpError("Project tidak ditemukan.", 404);
      }

      const currentStatus = normalizeProjectStatus(project.status);

      const created = await tx.projectArusKas.create({
        data: {
          id_project: idProject,
          wallet_key: walletKey,
          tanggal_transaksi: tanggalTransaksi,
          jenis_transaksi: jenisTransaksi,
          kategori_transaksi: kategoriTransaksi,
          judul_transaksi: judulTransaksi,
          nominal,
          status_transaksi: statusTransaksi,
          catatan,
        },
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
      });

      const nextStatus = resolveNextProjectStatus({
        currentStatus,
        statusTransaksi,
        impactStatusProject,
        requestedTarget: statusProjectTarget,
      });

      const statusUpdated = nextStatus !== currentStatus;

      let coverSummary: Record<string, unknown> | null = null;

      if (autoCoverDeficit && deficitNominal && investorPenanggungId) {
        const investor = await tx.projectInvestor.findFirst({
          where: {
            id_project_investor: investorPenanggungId,
            id_project: idProject,
          },
          select: {
            id_project_investor: true,
            id_agent: true,
            nominal_komitmen: true,
            persentase_kepemilikan: true,
          },
        });

        if (!investor) {
          throw new HttpError(
            "Investor penanggung tidak ditemukan di project ini.",
            404
          );
        }

        const nominalSebelum = toDecimal(investor.nominal_komitmen);
        const nominalSesudah = nominalSebelum.plus(deficitNominal);

        await tx.projectInvestor.update({
          where: {
            id_project_investor: investorPenanggungId,
          },
          data: {
            nominal_komitmen: nominalSesudah,
          },
        });

        const totalCommitmentAfter = await recalculateInvestorOwnership(
          tx,
          idProject
        );

        const projectUpdateData: Prisma.ProjectUpdateInput = {
          ...buildProjectIncrementData(walletKey, deficitNominal),
          total_pendanaan: totalCommitmentAfter,
          ...(statusUpdated ? { status: nextStatus } : {}),
        };

        await tx.project.update({
          where: {
            id_project: idProject,
          },
          data: projectUpdateData,
        });

        const persenSebelum = toNumber(investor.persentase_kepemilikan);
        const persenSesudah = totalCommitmentAfter.gt(0)
          ? Number(
              nominalSesudah
                .div(totalCommitmentAfter)
                .mul(100)
                .toDecimalPlaces(6)
                .toString()
            )
          : 0;

        coverSummary = {
          id_project_investor: investor.id_project_investor.toString(),
          id_agent: investor.id_agent,
          nama: investorPenanggungNama,
          nominal_sebelum: Number(nominalSebelum.toString()),
          nominal_tambahan: Number(deficitNominal.toString()),
          nominal_sesudah: Number(nominalSesudah.toString()),
          persentase_sebelum: persenSebelum,
          persentase_sesudah: persenSesudah,
          total_pendanaan_sebelum: toNumber(project.total_pendanaan),
          total_pendanaan_sesudah: Number(totalCommitmentAfter.toString()),
        };
      } else if (statusUpdated) {
        await tx.project.update({
          where: { id_project: idProject },
          data: {
            status: nextStatus,
          },
        });
      }

      return {
        created,
        currentStatus,
        nextStatus,
        statusUpdated,
        coverSummary,
      };
    });

    const serialized = serializeArusKasRecord(
      result.created as unknown as Record<string, unknown>
    );

    return NextResponse.json(
      {
        message: "Arus kas berhasil dicatat.",
        data: serialized,
        project_status: {
          before: result.currentStatus,
          current: result.nextStatus,
          updated: result.statusUpdated,
        },
        deficit_cover: result.coverSummary,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status }
      );
    }

    console.error("[CATAT_ARUS_KAS_POST_ERROR]", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan saat menyimpan arus kas." },
      { status: 500 }
    );
  }
}
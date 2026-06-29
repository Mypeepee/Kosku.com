import { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

import BloombergHeroCard from "../components/BloombergHeroCard";
import ReturnFrameworkCard from "../components/ReturnFrameworkCard";
import CapitalDeploymentCard from "../components/CapitalDeploymentCard";
import CmaCard from "../components/CmaCard";
import InvestorBookCard from "../components/InvestorBookCard";

import type { ProjectDetailViewModel } from "../components/types";

function toNumeric(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getRecordValue(
  record: Record<string, unknown> | null | undefined,
  keys: string[]
) {
  if (!record) return undefined;

  for (const key of keys) {
    if (key in record && record[key] != null) {
      return record[key];
    }
  }

  const lowered = Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key.toLowerCase(), value])
  );

  for (const key of keys) {
    const value = lowered[key.toLowerCase()];
    if (value != null) return value;
  }

  return undefined;
}


function pickDisplayName(
  record: Record<string, unknown> | null | undefined,
  fallback: string
) {
  const name = toText(
    getRecordValue(record, [
      "nama_lengkap",
      "full_name",
      "fullName",
      "namaLengkap",
      "nama_agent",
      "display_name",
      "displayName",
      "nama",
      "name",
    ])
  );

  return name || fallback;
}

function pickAvatar(record: Record<string, unknown> | null | undefined) {
  const avatar = getRecordValue(record, [
    "foto_profil_url",
    "foto_profil",
    "fotoProfil",
    "avatar",
    "profile_picture",
    "profilePicture",
    "profile_image",
    "profileImage",
    "gambar_profil",
    "gambarProfil",
    "gambar_thumbnail",
    "thumbnail",
    "image",
    "image_url",
    "imageUrl",
    "photo",
    "photo_url",
    "photoUrl",
    "foto",
  ]);

  return typeof avatar === "string" && avatar.trim() ? avatar.trim() : null;
}

export default async function DetailTransaksiPage({
  params,
}: {
  params: { id_project: string };
}) {
  // Query 1: project data — semua query berikutnya bergantung padanya
  const project = await prisma.project.findUnique({
    where: { id_project: params.id_project },
    select: {
      id_project: true,
      dibuat_oleh: true,
      id_listing: true,
      nama_project: true,
      alamat_property: true,
      provinsi: true,
      kota: true,
      kecamatan: true,
      kelurahan: true,
      gambar_thumbnail: true,
      tanggal_pembelian: true,
      harga_pembelian: true,
      estimasi_harga_jual: true,
      estimasi_profit_bersih: true,
      target_pendanaan: true,
      total_pendanaan: true,
      jenis_pendanaan: true,
      status: true,
      mulai_tanggal: true,
      estimasi_selesai: true,
      estimasi_bulan: true,
      pendanaan_ditutup_pada: true,
      deskripsi_project: true,
      nilai_limit_lelang: true,
      spare_bidding: true,
      biaya_eksekusi: true,
      biaya_renov: true,
      biaya_balik_nama: true,
      total_biaya_akuisisi: true,
      dana_cadangan: true,
      dibuat_tanggal: true,
      diupdate_tanggal: true,
      investorProject: {
        select: {
          id_project_investor: true,
          id_agent: true,
          nominal_komitmen: true,
          persentase_kepemilikan: true,
          status: true,
          agent: {
            select: { foto_profil_url: true },
          },
        },
      },
      cmaEntries: {
        select: {
          id_project_cma: true,
          nama: true,
          luas_tanah: true,
          harga: true,
          catatan: true,
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const relatedAgentIds = Array.from(
    new Set(
      [project.dibuat_oleh, ...project.investorProject.map((item) => item.id_agent)]
        .filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0
        )
    )
  );

  // Queries 2-4 dijalankan paralel — dari 5 round-trip serial menjadi 2
  const [agentIdentityRows, listing, projectSelesaiRows] = await Promise.all([
    // Identitas semua agent (creator + investor) dalam satu query
    relatedAgentIds.length > 0
      ? prisma.$queryRaw<
          Array<{
            id_agent: string;
            nama_lengkap: string | null;
            foto_profil_url: string | null;
          }>
        >(Prisma.sql`
          SELECT
            a.id_agent,
            a.foto_profil_url,
            p.nama_lengkap
          FROM public.agent a
          LEFT JOIN public.pengguna p
            ON p.id_pengguna = a.id_pengguna
          WHERE a.id_agent IN (${Prisma.join(relatedAgentIds)})
        `)
      : Promise.resolve(
          [] as Array<{ id_agent: string; nama_lengkap: string | null; foto_profil_url: string | null }>
        ),

    // Data listing via Prisma — menggantikan information_schema + $queryRawUnsafe
    project.id_listing != null
      ? prisma.listing.findUnique({
          where: { id_property: project.id_listing },
          select: { luas_tanah: true, luas_bangunan: true, jenis_transaksi: true },
        })
      : Promise.resolve(null),

    // Data project selesai
    prisma.$queryRaw<
      Array<{
        id_project: string;
        id_listing: number | null;
        tanggal_pembelian: Date | string | null;
        tanggal_terjual: Date | string | null;
        durasi_hari: number | null;
        harga_jual: Prisma.Decimal | number | string | null;
        total_biaya_akuisisi: Prisma.Decimal | number | string | null;
        profit_kotor: Prisma.Decimal | number | string | null;
        pph_percent: Prisma.Decimal | number | string | null;
        ajb_percent: Prisma.Decimal | number | string | null;
        agent_fee_percent: Prisma.Decimal | number | string | null;
        total_biaya_transaksi: Prisma.Decimal | number | string | null;
        profit_bersih: Prisma.Decimal | number | string | null;
        roi_bersih: Prisma.Decimal | number | string | null;
        dibuat_tanggal: Date | string | null;
        diupdate_tanggal: Date | string | null;
      }>
    >(Prisma.sql`
      SELECT
        id_project,
        id_listing,
        tanggal_pembelian,
        tanggal_terjual,
        durasi_hari,
        harga_jual,
        total_biaya_akuisisi,
        profit_kotor,
        pph_percent,
        ajb_percent,
        agent_fee_percent,
        total_biaya_transaksi,
        profit_bersih,
        roi_bersih,
        dibuat_tanggal,
        diupdate_tanggal
      FROM public.project_selesai
      WHERE id_project = ${params.id_project}
      LIMIT 1
    `),
  ]);

  const agentIdentityMap = new Map(
    agentIdentityRows.map((row) => [
      row.id_agent,
      {
        name: toText(row.nama_lengkap),
        avatar: toText(row.foto_profil_url),
      },
    ])
  );

  // Akses field listing langsung — tidak perlu getRecordValue lagi
  const listingLandArea = toNumeric(listing?.luas_tanah);
  const listingBuildingArea = toNumeric(listing?.luas_bangunan);
  const isSecondary = listing?.jenis_transaksi === "SECONDARY";

  const assetArea =
    isSecondary && listingBuildingArea > 0
      ? listingBuildingArea
      : listingLandArea > 0
      ? listingLandArea
      : listingBuildingArea;

  const creatorIdentity = agentIdentityMap.get(project.dibuat_oleh);

  const projectSelesai = projectSelesaiRows[0] ?? null;

  const viewModel = {
    id: project.id_project,
    listingId: project.id_listing != null ? Number(project.id_listing) : undefined,
    name: project.nama_project,
    address: project.alamat_property,
    province: project.provinsi,
    city: project.kota,
    district: project.kecamatan,
    village: project.kelurahan,
    image: project.gambar_thumbnail,
    purchaseDate: project.tanggal_pembelian,

    landArea: assetArea,

    purchasePrice: toNumeric(project.harga_pembelian),
    estimatedSellPrice: toNumeric(project.estimasi_harga_jual),
    estimatedNetProfit: toNumeric(project.estimasi_profit_bersih),
    fundingTarget: toNumeric(project.target_pendanaan),
    totalFunded: toNumeric(project.total_pendanaan),

    fundingType: project.jenis_pendanaan,
    status: project.status,

    startDate: project.mulai_tanggal,
    estimatedFinish: project.estimasi_selesai,
    estimatedMonths:
      project.estimasi_bulan != null ? toNumeric(project.estimasi_bulan) : null,
    fundingClosedAt: project.pendanaan_ditutup_pada,

    description: project.deskripsi_project,

    createdById: project.dibuat_oleh,
    createdByName: creatorIdentity?.name || project.dibuat_oleh,
    createdByAvatar: creatorIdentity?.avatar || null,

    auctionLimitValue: toNumeric(project.nilai_limit_lelang),
    spareBidding: toNumeric(project.spare_bidding),
    executionCost: toNumeric(project.biaya_eksekusi),
    renovationCost: toNumeric(project.biaya_renov),
    transferCost: toNumeric(project.biaya_balik_nama),
    totalAcquisitionCost: toNumeric(project.total_biaya_akuisisi),
    reserveFund: toNumeric(project.dana_cadangan),

    createdAt: project.dibuat_tanggal,
    updatedAt: project.diupdate_tanggal,

    investors: project.investorProject.map((item) => {
      const agent = item.agent as Record<string, unknown> | null;
      const identity = agentIdentityMap.get(item.id_agent);

      return {
        id: String(item.id_project_investor),
        name: identity?.name || pickDisplayName(agent, item.id_agent),
        avatar: identity?.avatar || pickAvatar(agent),
        committed: toNumeric(item.nominal_komitmen),
        ownership:
          item.persentase_kepemilikan != null
            ? toNumeric(item.persentase_kepemilikan)
            : null,
        status: item.status,
        note: null,
      };
    }),

    cma: project.cmaEntries.map((item) => ({
      id: item.id_project_cma,
      name: item.nama,
      landArea: toNumeric(item.luas_tanah),
      price: toNumeric(item.harga),
      note: item.catatan,
    })),

    // flatten ke root biar BloombergHeroCard lama/baru sama-sama bisa baca
    tanggal_terjual: projectSelesai?.tanggal_terjual ?? null,
    harga_jual: toNumeric(projectSelesai?.harga_jual),
    total_biaya_transaksi: toNumeric(projectSelesai?.total_biaya_transaksi),
    profit_kotor: toNumeric(projectSelesai?.profit_kotor),
    profit_bersih: toNumeric(projectSelesai?.profit_bersih),
    pph_percent: toNumeric(projectSelesai?.pph_percent),
    ajb_percent: toNumeric(projectSelesai?.ajb_percent),
    agent_fee_percent: toNumeric(projectSelesai?.agent_fee_percent),
    roi_bersih_percent: toNumeric(projectSelesai?.roi_bersih),

    // nested relation-style object untuk debug/compatibility
    projectSelesai: projectSelesai
      ? {
          id_project: projectSelesai.id_project,
          id_listing: projectSelesai.id_listing,
          tanggal_pembelian: projectSelesai.tanggal_pembelian,
          tanggal_terjual: projectSelesai.tanggal_terjual,
          durasi_hari: projectSelesai.durasi_hari,
          harga_jual: toNumeric(projectSelesai.harga_jual),
          total_biaya_akuisisi: toNumeric(projectSelesai.total_biaya_akuisisi),
          profit_kotor: toNumeric(projectSelesai.profit_kotor),
          pph_percent: toNumeric(projectSelesai.pph_percent),
          ajb_percent: toNumeric(projectSelesai.ajb_percent),
          agent_fee_percent: toNumeric(projectSelesai.agent_fee_percent),
          total_biaya_transaksi: toNumeric(projectSelesai.total_biaya_transaksi),
          profit_bersih: toNumeric(projectSelesai.profit_bersih),
          roi_bersih: toNumeric(projectSelesai.roi_bersih),
          dibuat_tanggal: projectSelesai.dibuat_tanggal,
          diupdate_tanggal: projectSelesai.diupdate_tanggal,
        }
      : null,
  } as unknown as ProjectDetailViewModel & {
    tanggal_terjual?: Date | string | null;
    harga_jual?: number;
    total_biaya_transaksi?: number;
    profit_kotor?: number;
    profit_bersih?: number;
    pph_percent?: number;
    ajb_percent?: number;
    agent_fee_percent?: number;
    roi_bersih_percent?: number;
    projectSelesai?: {
      id_project: string;
      id_listing: number | null;
      tanggal_pembelian: Date | string | null;
      tanggal_terjual: Date | string | null;
      durasi_hari: number | null;
      harga_jual: number;
      total_biaya_akuisisi: number;
      profit_kotor: number;
      pph_percent: number;
      ajb_percent: number;
      agent_fee_percent: number;
      total_biaya_transaksi: number;
      profit_bersih: number;
      roi_bersih: number;
      dibuat_tanggal: Date | string | null;
      diupdate_tanggal: Date | string | null;
    } | null;
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070b] px-4 py-5 text-white md:px-6 md:py-6 xl:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.08),transparent_20%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_18%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.08),transparent_22%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0)_20%,rgba(255,255,255,0)_80%,rgba(255,255,255,0.02)_100%)]" />

      <div className="relative mx-auto max-w-[1600px] space-y-6">
        <BloombergHeroCard
          project={viewModel}
          backHref="/dashboard/project"
          topBarLabel="Detail transaksi"
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            <CapitalDeploymentCard project={viewModel} />
            <CmaCard project={viewModel} />
            <InvestorBookCard project={viewModel} />
          </div>

          <div className="space-y-6 xl:col-span-4">
            <div className="xl:sticky xl:top-6 xl:space-y-6">
              <ReturnFrameworkCard project={viewModel} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
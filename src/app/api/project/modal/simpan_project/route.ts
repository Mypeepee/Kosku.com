import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import {
  getDerivedProjectDates,
  getProjectAcquisitionFinancials,
  normalizeCmaEntries,
  normalizeInvestorAllocations,
  normalizeJenisPendanaan,
  normalizeStatusProject,
  parseBigIntId,
  toDbPaymentStatus,
  toDecimal,
  toNonNegativeNumber,
  toNullableDate,
  toSafeString,
  type ProjectWritePayload,
} from "../../_lib/project-write";

type CreateProjectSubmitResponse = {
  success: boolean;
  message: string;
  data?: {
    id_project: string;
  };
  errors?: string[];
};

export async function POST(request: Request) {
  try {
    const session = (await getServerSession(authOptions as any)) as any;

    if (!session?.user) {
      return NextResponse.json<CreateProjectSubmitResponse>(
        {
          success: false,
          message: "Sesi login tidak ditemukan. Silakan login ulang.",
        },
        { status: 401 }
      );
    }

    const body = (await request.json()) as ProjectWritePayload;

    const idListingRaw = toSafeString(body.id_listing);
    const namaProject = toSafeString(body.nama_project);

    const sessionAgentId = toSafeString(session?.user?.agentId);
    const bodyDibuatOleh = toSafeString(body.dibuat_oleh);
    const dibuatOleh = sessionAgentId || bodyDibuatOleh;

    const jenisPendanaan = normalizeJenisPendanaan(body.jenis_pendanaan);
    const statusProject = normalizeStatusProject(body.status);

    if (!idListingRaw) {
      return NextResponse.json<CreateProjectSubmitResponse>(
        {
          success: false,
          message: "Property wajib dipilih.",
        },
        { status: 400 }
      );
    }

    const idListing = parseBigIntId(idListingRaw);

    if (!idListing) {
      return NextResponse.json<CreateProjectSubmitResponse>(
        {
          success: false,
          message: "ID property tidak valid.",
        },
        { status: 400 }
      );
    }

    if (!namaProject) {
      return NextResponse.json<CreateProjectSubmitResponse>(
        {
          success: false,
          message: "Nama project wajib diisi.",
        },
        { status: 400 }
      );
    }

    if (!dibuatOleh) {
      return NextResponse.json<CreateProjectSubmitResponse>(
        {
          success: false,
          message:
            "Akun ini tidak terhubung ke data agent. session.user.agentId tidak ditemukan.",
        },
        { status: 400 }
      );
    }

    const investorAllocations = normalizeInvestorAllocations(
      body.investor_allocations ?? []
    );

    if (jenisPendanaan === "tertutup" && investorAllocations.length === 0) {
      return NextResponse.json<CreateProjectSubmitResponse>(
        {
          success: false,
          message: "Pendanaan tertutup wajib memiliki minimal 1 investor.",
        },
        { status: 400 }
      );
    }

    const cmaEntries = normalizeCmaEntries(body.cma_entries ?? []);
    const financials = getProjectAcquisitionFinancials(body);

    const derivedDates = getDerivedProjectDates(body);
    const pendanaanDitutupPada =
      jenisPendanaan === "terbuka"
        ? toNullableDate(body.pendanaan_ditutup_pada)
        : null;

    if (!derivedDates.tanggal_pembelian) {
      return NextResponse.json<CreateProjectSubmitResponse>(
        {
          success: false,
          message: "Tanggal pembelian wajib dipilih.",
        },
        { status: 400 }
      );
    }

    if (jenisPendanaan === "terbuka" && !pendanaanDitutupPada) {
      return NextResponse.json<CreateProjectSubmitResponse>(
        {
          success: false,
          message:
            "Tanggal penutupan pendanaan wajib dipilih untuk pendanaan terbuka.",
        },
        { status: 400 }
      );
    }

    const targetPendanaan = toNonNegativeNumber(body.target_pendanaan);
    const totalPendanaanInput = toNonNegativeNumber(body.total_pendanaan);
    const totalPendanaanDerived =
      totalPendanaanInput > 0
        ? totalPendanaanInput
        : investorAllocations.reduce(
            (sum, item) => sum + toNonNegativeNumber(item.nominal_komitmen),
            0
          );

    const estimasiHargaJual = toNonNegativeNumber(body.estimasi_harga_jual);
    const estimasiProfitBersih =
      estimasiHargaJual - financials.total_biaya_akuisisi;

    const project = await prisma.$transaction(async (tx) => {
      const [listing, agent] = await Promise.all([
        tx.listing.findUnique({
          where: { id_property: idListing },
          select: { id_property: true },
        }),
        tx.agent.findUnique({
          where: { id_agent: dibuatOleh },
          select: { id_agent: true, id_pengguna: true },
        }),
      ]);

      if (!listing) {
        throw new Error("LISTING_NOT_FOUND");
      }

      if (!agent) {
        throw new Error("AGENT_NOT_FOUND");
      }

      const createdProject = await tx.project.create({
        data: {
          id_listing: idListing,
          nama_project: namaProject,
          alamat_property: toSafeString(body.alamat_property) || null,
          provinsi: toSafeString(body.provinsi) || null,
          kota: toSafeString(body.kota) || null,
          kecamatan: toSafeString(body.kecamatan) || null,
          kelurahan: toSafeString(body.kelurahan) || null,
          gambar_thumbnail: toSafeString(body.gambar_thumbnail) || null,

          tanggal_pembelian: derivedDates.tanggal_pembelian,

          harga_pembelian: toDecimal(financials.total_biaya_akuisisi),
          estimasi_harga_jual: toDecimal(estimasiHargaJual),
          estimasi_profit_bersih: toDecimal(estimasiProfitBersih),
          target_pendanaan: toDecimal(targetPendanaan),
          total_pendanaan: toDecimal(totalPendanaanDerived),

          jenis_pendanaan: jenisPendanaan,
          status: statusProject,

          mulai_tanggal: derivedDates.mulai_tanggal,
          estimasi_selesai: derivedDates.estimasi_selesai,
          estimasi_bulan: derivedDates.estimasi_bulan,
          pendanaan_ditutup_pada: pendanaanDitutupPada,

          deskripsi_project: toSafeString(body.deskripsi_project) || null,
          dibuat_oleh: dibuatOleh,

          nilai_limit_lelang: toDecimal(financials.acquisition_base),
          spare_bidding: toDecimal(financials.spare_bidding),
          biaya_balik_nama: toDecimal(financials.biaya_balik_nama_total),
          biaya_eksekusi: toDecimal(financials.biaya_eksekusi),
          biaya_renov: toDecimal(financials.biaya_renov),
          total_biaya_akuisisi: toDecimal(financials.total_biaya_akuisisi),
          dana_cadangan: toDecimal(financials.dana_cadangan),

          investorProject:
            investorAllocations.length > 0
              ? {
                  create: investorAllocations.map((item) => ({
                    id_agent: item.id_agent,
                    nominal_komitmen: toDecimal(item.nominal_komitmen),
                    persentase_kepemilikan:
                      item.persentase_kepemilikan === null
                        ? null
                        : toDecimal(item.persentase_kepemilikan),
                    status: toDbPaymentStatus(item.status),
                  })),
                }
              : undefined,

          cmaEntries:
            cmaEntries.length > 0
              ? {
                  create: cmaEntries.map((item) => ({
                    nama: item.nama || "-",
                    luas_tanah: toDecimal(item.luas_tanah),
                    harga: toDecimal(item.harga),
                    catatan: item.catatan,
                  })),
                }
              : undefined,
        },
        select: {
          id_project: true,
        },
      });

      await tx.listing.update({
        where: { id_property: idListing },
        data: { status_tayang: "TERJUAL" },
      });

      return createdProject;
    });

    return NextResponse.json<CreateProjectSubmitResponse>(
      {
        success: true,
        message: "Project Berhasil Disimpan!",
        data: {
          id_project: project.id_project,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST_PROJECT_ERROR]", error);

    if (error instanceof Error) {
      if (error.message === "LISTING_NOT_FOUND") {
        return NextResponse.json<CreateProjectSubmitResponse>(
          {
            success: false,
            message: "Listing/property tidak ditemukan.",
          },
          { status: 404 }
        );
      }

      if (error.message === "AGENT_NOT_FOUND") {
        return NextResponse.json<CreateProjectSubmitResponse>(
          {
            success: false,
            message:
              "Data agent pembuat project tidak ditemukan. Pastikan akun login sudah punya relasi ke tabel agent.",
          },
          { status: 404 }
        );
      }
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json<CreateProjectSubmitResponse>(
          {
            success: false,
            message: "Data project duplikat atau melanggar unique constraint.",
          },
          { status: 409 }
        );
      }

      if (error.code === "P2003") {
        return NextResponse.json<CreateProjectSubmitResponse>(
          {
            success: false,
            message:
              "Relasi data tidak valid. Pastikan listing, agent, dan investor benar.",
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json<CreateProjectSubmitResponse>(
      {
        success: false,
        message:
          error instanceof Error && error.message
            ? error.message
            : "Gagal menyimpan project.",
      },
      { status: 500 }
    );
  }
}

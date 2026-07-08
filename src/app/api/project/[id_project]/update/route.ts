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

type UpdateProjectResponse = {
  success: boolean;
  message: string;
  data?: {
    id_project: string;
  };
};

export async function PUT(
  request: Request,
  { params }: { params: { id_project: string } }
) {
  const idProject = params?.id_project?.trim();

  if (!idProject) {
    return NextResponse.json<UpdateProjectResponse>(
      { success: false, message: "ID project tidak valid." },
      { status: 400 }
    );
  }

  try {
    const session = (await getServerSession(authOptions as any)) as any;

    if (!session?.user) {
      return NextResponse.json<UpdateProjectResponse>(
        {
          success: false,
          message: "Sesi login tidak ditemukan. Silakan login ulang.",
        },
        { status: 401 }
      );
    }

    const sessionAgentId = toSafeString(session?.user?.agentId);
    const isOwner = toSafeString(session?.user?.jabatan).toUpperCase() === "OWNER";

    const existing = await prisma.project.findUnique({
      where: { id_project: idProject },
      select: {
        id_project: true,
        id_listing: true,
        dibuat_oleh: true,
        projectSelesai: { select: { id_project: true } },
      },
    });

    if (!existing) {
      return NextResponse.json<UpdateProjectResponse>(
        { success: false, message: "Project tidak ditemukan." },
        { status: 404 }
      );
    }

    const isCreator = Boolean(sessionAgentId) && existing.dibuat_oleh === sessionAgentId;

    if (!isCreator && !isOwner) {
      return NextResponse.json<UpdateProjectResponse>(
        {
          success: false,
          message: "Anda tidak punya akses untuk mengubah project ini.",
        },
        { status: 403 }
      );
    }

    if (existing.projectSelesai) {
      return NextResponse.json<UpdateProjectResponse>(
        {
          success: false,
          message:
            "Project ini sudah ditandai terjual dan tidak bisa diedit dari sini.",
        },
        { status: 409 }
      );
    }

    const body = (await request.json()) as ProjectWritePayload;

    const idListingRaw = toSafeString(body.id_listing);
    const namaProject = toSafeString(body.nama_project);

    const jenisPendanaan = normalizeJenisPendanaan(body.jenis_pendanaan);
    const statusProject = normalizeStatusProject(body.status);

    if (!idListingRaw) {
      return NextResponse.json<UpdateProjectResponse>(
        { success: false, message: "Property wajib dipilih." },
        { status: 400 }
      );
    }

    const idListing = parseBigIntId(idListingRaw);

    if (!idListing) {
      return NextResponse.json<UpdateProjectResponse>(
        { success: false, message: "ID property tidak valid." },
        { status: 400 }
      );
    }

    if (!namaProject) {
      return NextResponse.json<UpdateProjectResponse>(
        { success: false, message: "Nama project wajib diisi." },
        { status: 400 }
      );
    }

    const investorAllocations = normalizeInvestorAllocations(
      body.investor_allocations ?? []
    );

    if (jenisPendanaan === "tertutup" && investorAllocations.length === 0) {
      return NextResponse.json<UpdateProjectResponse>(
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
      return NextResponse.json<UpdateProjectResponse>(
        { success: false, message: "Tanggal pembelian wajib dipilih." },
        { status: 400 }
      );
    }

    if (jenisPendanaan === "terbuka" && !pendanaanDitutupPada) {
      return NextResponse.json<UpdateProjectResponse>(
        {
          success: false,
          message:
            "Tanggal penutupan pendanaan wajib dipilih untuk pendanaan terbuka.",
        },
        { status: 400 }
      );
    }

    const targetPendanaan = toNonNegativeNumber(body.target_pendanaan);
    const estimasiHargaJual = toNonNegativeNumber(body.estimasi_harga_jual);
    const estimasiProfitBersih =
      estimasiHargaJual - financials.total_biaya_akuisisi;

    // For a closed round the investor list is authoritative, so total_pendanaan
    // is recomputed from the allocations. For an open round we never touch the
    // investors here, so total_pendanaan is left as-is (`undefined` skips it).
    const totalPendanaanForUpdate =
      jenisPendanaan === "tertutup"
        ? investorAllocations.reduce(
            (sum, item) => sum + toNonNegativeNumber(item.nominal_komitmen),
            0
          )
        : undefined;

    const listingChanged = existing.id_listing !== idListing;

    await prisma.$transaction(async (tx) => {
      const [listing, agent] = await Promise.all([
        tx.listing.findUnique({
          where: { id_property: idListing },
          select: { id_property: true },
        }),
        tx.agent.findUnique({
          where: { id_agent: existing.dibuat_oleh },
          select: { id_agent: true },
        }),
      ]);

      if (!listing) {
        throw new Error("LISTING_NOT_FOUND");
      }

      if (!agent) {
        throw new Error("AGENT_NOT_FOUND");
      }

      await tx.project.update({
        where: { id_project: idProject },
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
          total_pendanaan:
            totalPendanaanForUpdate === undefined
              ? undefined
              : toDecimal(totalPendanaanForUpdate),

          jenis_pendanaan: jenisPendanaan,
          status: statusProject,

          mulai_tanggal: derivedDates.mulai_tanggal,
          estimasi_selesai: derivedDates.estimasi_selesai,
          estimasi_bulan: derivedDates.estimasi_bulan,
          pendanaan_ditutup_pada: pendanaanDitutupPada,

          deskripsi_project: toSafeString(body.deskripsi_project) || null,

          nilai_limit_lelang: toDecimal(financials.acquisition_base),
          spare_bidding: toDecimal(financials.spare_bidding),
          biaya_balik_nama: toDecimal(financials.biaya_balik_nama_total),
          biaya_eksekusi: toDecimal(financials.biaya_eksekusi),
          biaya_renov: toDecimal(financials.biaya_renov),
          total_biaya_akuisisi: toDecimal(financials.total_biaya_akuisisi),
          dana_cadangan: toDecimal(financials.dana_cadangan),

          diupdate_tanggal: new Date(),
        },
      });

      // Swap listing occupancy when the source property changed.
      if (listingChanged) {
        await tx.listing.update({
          where: { id_property: idListing },
          data: { status_tayang: "TERJUAL" },
        });
        await tx.listing.update({
          where: { id_property: existing.id_listing },
          data: { status_tayang: "TERSEDIA" },
        });
      }

      // Reconcile investors ONLY for a closed round. In an open round the
      // committed investors are managed elsewhere, so we must never wipe them
      // just because the edit form doesn't carry an allocation list.
      if (jenisPendanaan === "tertutup") {
        const existingRows = await tx.projectInvestor.findMany({
          where: { id_project: idProject },
          select: { id_agent: true },
        });
        const existingAgents = new Set(existingRows.map((r) => r.id_agent));
        const incomingAgents = investorAllocations.map((item) => item.id_agent);

        await tx.projectInvestor.deleteMany({
          where: { id_project: idProject, id_agent: { notIn: incomingAgents } },
        });

        for (const item of investorAllocations) {
          const persentase =
            item.persentase_kepemilikan === null
              ? null
              : toDecimal(item.persentase_kepemilikan);

          if (existingAgents.has(item.id_agent)) {
            // Keep the existing payment status; only refresh the numbers.
            await tx.projectInvestor.update({
              where: {
                id_project_id_agent: {
                  id_project: idProject,
                  id_agent: item.id_agent,
                },
              },
              data: {
                nominal_komitmen: toDecimal(item.nominal_komitmen),
                persentase_kepemilikan: persentase,
              },
            });
          } else {
            await tx.projectInvestor.create({
              data: {
                id_project: idProject,
                id_agent: item.id_agent,
                nominal_komitmen: toDecimal(item.nominal_komitmen),
                persentase_kepemilikan: persentase,
                status: toDbPaymentStatus(item.status),
              },
            });
          }
        }
      }

      // CMA has no downstream references — clean replace keeps it simple and correct.
      await tx.projectCma.deleteMany({ where: { id_project: idProject } });

      if (cmaEntries.length > 0) {
        await tx.projectCma.createMany({
          data: cmaEntries.map((item) => ({
            id_project: idProject,
            nama: item.nama || "-",
            luas_tanah: toDecimal(item.luas_tanah),
            harga: toDecimal(item.harga),
            catatan: item.catatan,
          })),
        });
      }
    });

    return NextResponse.json<UpdateProjectResponse>({
      success: true,
      message: "Perubahan project berhasil disimpan!",
      data: { id_project: idProject },
    });
  } catch (error) {
    console.error("[PUT_PROJECT_UPDATE_ERROR]", error);

    if (error instanceof Error) {
      if (error.message === "LISTING_NOT_FOUND") {
        return NextResponse.json<UpdateProjectResponse>(
          { success: false, message: "Listing/property tidak ditemukan." },
          { status: 404 }
        );
      }
      if (error.message === "AGENT_NOT_FOUND") {
        return NextResponse.json<UpdateProjectResponse>(
          {
            success: false,
            message: "Data agent pembuat project tidak ditemukan.",
          },
          { status: 404 }
        );
      }
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json<UpdateProjectResponse>(
          {
            success: false,
            message: "Data project duplikat atau melanggar unique constraint.",
          },
          { status: 409 }
        );
      }
      if (error.code === "P2003") {
        return NextResponse.json<UpdateProjectResponse>(
          {
            success: false,
            message:
              "Relasi data tidak valid. Pastikan listing, agent, dan investor benar.",
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json<UpdateProjectResponse>(
      {
        success: false,
        message:
          error instanceof Error && error.message
            ? error.message
            : "Gagal menyimpan perubahan project.",
      },
      { status: 500 }
    );
  }
}

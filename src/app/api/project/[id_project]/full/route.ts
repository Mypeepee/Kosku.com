import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";

/**
 * GET /api/project/[id_project]/full
 *
 * Returns everything the edit wizard needs to reconstruct the full
 * "create project" form: project scalars, the source listing snapshot,
 * investor allocations (with agent display info), and CMA entries.
 */

function toNum(value: Prisma.Decimal | number | string | bigint | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateString(value: Date | null | undefined): string | null {
  if (!value) return null;
  const time = value.getTime();
  if (Number.isNaN(time)) return null;
  return value.toISOString().slice(0, 10);
}

function pickFirstImage(raw?: string | null): string {
  if (!raw) return "";

  const trimmed = raw.trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      const first = parsed.find(
        (item) => typeof item === "string" && item.trim().length > 0
      );
      return typeof first === "string" ? first : "";
    }
  } catch {
    // not JSON — fall through to plain string handling
  }

  if (trimmed.includes(",")) {
    return trimmed.split(",").map((item) => item.trim()).find(Boolean) ?? "";
  }

  if (trimmed.includes("\n")) {
    return trimmed.split("\n").map((item) => item.trim()).find(Boolean) ?? "";
  }

  return trimmed;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id_project: string } }
) {
  const idProject = params?.id_project?.trim();

  if (!idProject) {
    return NextResponse.json(
      { success: false, message: "ID project tidak valid." },
      { status: 400 }
    );
  }

  try {
    const session = (await getServerSession(authOptions as any)) as any;

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Sesi login tidak ditemukan." },
        { status: 401 }
      );
    }

    const sessionAgentId = String(session?.user?.agentId ?? "").trim();
    const isOwner =
      String(session?.user?.jabatan ?? "").toUpperCase() === "OWNER";

    const project = await prisma.project.findUnique({
      where: { id_project: idProject },
      include: {
        projectSelesai: { select: { id_project: true } },
        cmaEntries: {
          orderBy: { id_project_cma: "asc" },
          select: {
            nama: true,
            luas_tanah: true,
            harga: true,
            catatan: true,
          },
        },
        investorProject: {
          orderBy: { id_project_investor: "asc" },
          select: {
            id_agent: true,
            nominal_komitmen: true,
            persentase_kepemilikan: true,
            status: true,
            agent: {
              select: {
                nama_kantor: true,
                kota_area: true,
                foto_profil_url: true,
                pengguna: { select: { nama_lengkap: true } },
              },
            },
          },
        },
        listing: {
          select: {
            id_property: true,
            judul: true,
            slug: true,
            jenis_transaksi: true,
            kategori: true,
            harga: true,
            harga_promo: true,
            nilai_limit_lelang: true,
            uang_jaminan: true,
            alamat_lengkap: true,
            provinsi: true,
            kota: true,
            kecamatan: true,
            kelurahan: true,
            luas_tanah: true,
            luas_bangunan: true,
            legalitas: true,
            vendor: true,
            tanggal_lelang: true,
            gambar: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, message: "Project tidak ditemukan." },
        { status: 404 }
      );
    }

    const isCreator =
      Boolean(sessionAgentId) && project.dibuat_oleh === sessionAgentId;

    // This endpoint exposes investor names + full financials, so it is limited
    // to the exact same audience that is allowed to edit the project.
    if (!isCreator && !isOwner) {
      return NextResponse.json(
        {
          success: false,
          message: "Anda tidak punya akses untuk melihat detail project ini.",
        },
        { status: 403 }
      );
    }

    const idListing = project.id_listing.toString();

    const listing = project.listing
      ? {
          id_listing: idListing,
          id_property: idListing,
          judul: project.listing.judul,
          slug: project.listing.slug,
          jenis_transaksi: project.listing.jenis_transaksi,
          kategori: project.listing.kategori,
          harga: toNum(project.listing.harga),
          harga_promo:
            project.listing.harga_promo == null
              ? null
              : toNum(project.listing.harga_promo),
          nilai_limit_lelang:
            project.listing.nilai_limit_lelang == null
              ? null
              : toNum(project.listing.nilai_limit_lelang),
          uang_jaminan:
            project.listing.uang_jaminan == null
              ? null
              : toNum(project.listing.uang_jaminan),
          alamat_property: project.listing.alamat_lengkap ?? "",
          alamat_lengkap: project.listing.alamat_lengkap ?? "",
          provinsi: project.listing.provinsi ?? "",
          kota: project.listing.kota ?? "",
          kecamatan: project.listing.kecamatan ?? "",
          kelurahan: project.listing.kelurahan ?? "",
          luas_tanah:
            project.listing.luas_tanah == null
              ? null
              : toNum(project.listing.luas_tanah),
          luas_bangunan:
            project.listing.luas_bangunan == null
              ? null
              : toNum(project.listing.luas_bangunan),
          legalitas: project.listing.legalitas ?? null,
          vendor: project.listing.vendor ?? "",
          tanggal_lelang: project.listing.tanggal_lelang
            ? project.listing.tanggal_lelang.toISOString()
            : null,
          gambar_thumbnail: pickFirstImage(project.listing.gambar),
          gambar: pickFirstImage(project.listing.gambar),
        }
      : null;

    const investor_allocations = project.investorProject.map((item) => {
      const namaLengkap = item.agent?.pengguna?.nama_lengkap ?? "";
      const nama = namaLengkap || item.id_agent;

      return {
        id_agent: item.id_agent,
        nominal_komitmen: toNum(item.nominal_komitmen),
        persentase_kepemilikan:
          item.persentase_kepemilikan == null
            ? null
            : toNum(item.persentase_kepemilikan),
        status: item.status,
        nama,
        label: namaLengkap ? `${namaLengkap} • ${item.id_agent}` : item.id_agent,
        nama_kantor: item.agent?.nama_kantor ?? "",
        kota_area: item.agent?.kota_area ?? "",
        foto_profil_url: item.agent?.foto_profil_url ?? "",
      };
    });

    const cma_entries = project.cmaEntries.map((item) => ({
      nama: item.nama ?? "",
      luas_tanah: toNum(item.luas_tanah),
      harga: toNum(item.harga),
      catatan: item.catatan ?? "",
    }));

    return NextResponse.json({
      success: true,
      data: {
        id_project: project.id_project,
        id_listing: idListing,

        nama_project: project.nama_project ?? "",
        deskripsi_project: project.deskripsi_project ?? "",
        alamat_property: project.alamat_property ?? "",
        provinsi: project.provinsi ?? "",
        kota: project.kota ?? "",
        kecamatan: project.kecamatan ?? "",
        kelurahan: project.kelurahan ?? "",
        gambar_thumbnail: project.gambar_thumbnail ?? "",

        tanggal_pembelian: toDateString(project.tanggal_pembelian),
        mulai_tanggal: toDateString(project.mulai_tanggal),
        estimasi_selesai: toDateString(project.estimasi_selesai),
        pendanaan_ditutup_pada: toDateString(project.pendanaan_ditutup_pada),
        estimasi_bulan: project.estimasi_bulan ?? 0,

        harga_pembelian: toNum(project.harga_pembelian),
        estimasi_harga_jual: toNum(project.estimasi_harga_jual),
        estimasi_profit_bersih: toNum(project.estimasi_profit_bersih),
        target_pendanaan: toNum(project.target_pendanaan),
        total_pendanaan: toNum(project.total_pendanaan),

        jenis_pendanaan: project.jenis_pendanaan,
        status: project.status,

        nilai_limit_lelang: toNum(project.nilai_limit_lelang),
        spare_bidding: toNum(project.spare_bidding),
        biaya_eksekusi: toNum(project.biaya_eksekusi),
        biaya_renov: toNum(project.biaya_renov),
        biaya_balik_nama: toNum(project.biaya_balik_nama),
        total_biaya_akuisisi: toNum(project.total_biaya_akuisisi),
        dana_cadangan: toNum(project.dana_cadangan),

        dibuat_oleh: project.dibuat_oleh,
        is_sold: Boolean(project.projectSelesai),

        investor_allocations,
        cma_entries,
        listing,
      },
    });
  } catch (error) {
    console.error("[GET_PROJECT_FULL_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil data project." },
      { status: 500 }
    );
  }
}

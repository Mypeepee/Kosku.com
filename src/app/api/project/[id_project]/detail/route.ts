import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    const project = await prisma.project.findUnique({
      where: { id_project: idProject },
      select: {
        id_project: true,
        nama_project: true,
        deskripsi_project: true,
        status: true,
        mulai_tanggal: true,
        estimasi_selesai: true,
        estimasi_bulan: true,
        harga_pembelian: true,
        estimasi_harga_jual: true,
        estimasi_profit_bersih: true,
        target_pendanaan: true,
        nilai_limit_lelang: true,
        spare_bidding: true,
        biaya_eksekusi: true,
        biaya_renov: true,
        biaya_balik_nama: true,
        dana_cadangan: true,
        total_biaya_akuisisi: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, message: "Project tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: project });
  } catch (error) {
    console.error("[GET_PROJECT_DETAIL_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil data project." },
      { status: 500 }
    );
  }
}

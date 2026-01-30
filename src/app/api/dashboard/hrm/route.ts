// src/app/api/dashboard/hrm/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "../../auth/[...nextauth]/route";

const prisma = new PrismaClient();

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: kalau mau batasi hanya OWNER/Admin, cek role di sini

  try {
    const agents = await prisma.agent.findMany({
      orderBy: { dibuat_pada: "desc" },
      include: {
        pengguna: {
          select: {
            nama_lengkap: true,
          },
        },
        upline: {
          select: {
            id_agent: true,
            pengguna: {
              select: { nama_lengkap: true },
            },
          },
        },
      },
    });

    const mapped = agents.map((a) => ({
      id_agent: a.id_agent,
      id_pengguna: a.id_pengguna,
      nama_lengkap: a.pengguna?.nama_lengkap || "Tanpa nama",
      nama_kantor: a.nama_kantor,
      kota_area: a.kota_area,
      jabatan: a.jabatan,
      id_upline: a.id_upline,
      nama_upline: a.upline?.pengguna?.nama_lengkap ?? null,
      rating: Number(a.rating || 0),
      jumlah_closing: a.jumlah_closing,
      total_omset: Number(a.total_omset || 0),
      nomor_whatsapp: a.nomor_whatsapp,
      foto_profil_url: a.foto_profil_url,
      status_keanggotaan: a.status_keanggotaan,
      tanggal_gabung: a.tanggal_gabung
        ? a.tanggal_gabung.toISOString()
        : null,
    }));

    return NextResponse.json({ agents: mapped });
  } catch (err) {
    console.error("Error fetch HRM agents:", err);
    return NextResponse.json(
      { error: "Gagal mengambil data agent" },
      { status: 500 }
    );
  }
}

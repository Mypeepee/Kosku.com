// src/app/api/dashboard/hrm/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "../../auth/[...nextauth]/authOptions";


export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Tentukan scope akses berdasarkan jabatan agent si pemohon.
  // - OWNER     : lihat semua agent (lintas kantor)
  // - PRINCIPAL : hanya agent di kantor yang sama
  // - lainnya   : tidak boleh mengakses data HRM
  const requesterAgentId = (session.user as any)?.agentId ?? null;
  const me = requesterAgentId
    ? await prisma.agent.findUnique({
        where: { id_agent: String(requesterAgentId) },
        select: { jabatan: true, nama_kantor: true },
      })
    : null;

  if (!me || (me.jabatan !== "OWNER" && me.jabatan !== "PRINCIPAL")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // OWNER lihat semua; PRINCIPAL dibatasi ke kantornya sendiri.
  const where: { nama_kantor?: string } =
    me.jabatan === "OWNER" ? {} : { nama_kantor: me.nama_kantor };

  try {
    const agents = await prisma.agent.findMany({
      where,
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

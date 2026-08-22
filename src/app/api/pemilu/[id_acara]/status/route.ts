// src/app/api/pemilu/[id_acara]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { status_peserta_enum } from "@prisma/client";
import prisma from "@/lib/prisma";


interface RouteContext {
  params: { id_acara: string };
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const id_acara = BigInt(params.id_acara);
    const now = new Date();

    const acara = await prisma.acara.findUnique({
      where: { id_acara },
    });

    if (!acara) {
      return NextResponse.json(
        { error: "Acara tidak ditemukan" },
        { status: 404 }
      );
    }

    // 🚫 Acara belum mulai → tidak ada yang aktif
    if (acara.tanggal_mulai && now < acara.tanggal_mulai) {
      return NextResponse.json({
        activeAgentId: null,
        remainingSeconds: null,
      });
    }

    // 🚫 Acara sudah selesai → tidak ada yang aktif
    if (acara.tanggal_selesai && now >= acara.tanggal_selesai) {
      return NextResponse.json({
        activeAgentId: null,
        remainingSeconds: null,
      });
    }

    // ✅ Cari peserta yang SEDANG_MEMILIH (bukan AKTIF)
    const pesertaAktif = await prisma.pesertaAcara.findFirst({
      where: {
        id_acara,
        status_peserta: status_peserta_enum.SEDANG_MEMILIH,
      },
      include: {
        agent: {
          include: {
            pengguna: true,
          },
        },
      },
    });

    if (!pesertaAktif) {
      return NextResponse.json({
        activeAgentId: null,
        remainingSeconds: null,
      });
    }

    const remainingSeconds = pesertaAktif.waktu_selesai_pilih
      ? Math.max(
          0,
          Math.floor(
            (pesertaAktif.waktu_selesai_pilih.getTime() - now.getTime()) /
              1000
          )
        )
      : 0;

    return NextResponse.json({
      activeAgentId: pesertaAktif.id_agent,
      remainingSeconds,
    });
  } catch (error) {
    console.error("Error get status:", error);
    return NextResponse.json(
      { error: "Failed to get status" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

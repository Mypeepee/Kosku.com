// src/app/api/pemilu/[id_acara]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, status_peserta_enum } from "@prisma/client";

const prisma = new PrismaClient();

interface RouteContext {
  params: { id_acara: string };
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const id_acara = BigInt(params.id_acara);
    const now = new Date();

    const pesertaAktif = await prisma.pesertaAcara.findFirst({
      where: {
        id_acara,
        status_peserta: status_peserta_enum.AKTIF,
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
      ? Math.max(0, Math.floor((pesertaAktif.waktu_selesai_pilih.getTime() - now.getTime()) / 1000))
      : 0;

    return NextResponse.json({
      activeAgentId: pesertaAktif.id_agent,
      remainingSeconds,
    });
  } catch (error) {
    console.error("Error get status:", error);
    return NextResponse.json({ error: "Failed to get status" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

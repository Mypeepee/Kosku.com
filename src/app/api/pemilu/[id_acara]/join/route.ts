// src/app/api/pemilu/[id_acara]/join/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

interface RouteContext {
  params: { id_acara: string }; // ← sama dengan nama folder
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id_acara } = context.params; // ← ambil dari URL /api/pemilu/[id_acara]/join

    if (!id_acara) {
      return NextResponse.json(
        { error: "ID acara wajib diisi." },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const agent = await prisma.agent.findFirst({
      where: { id_pengguna: session.user.id },
      select: { id_agent: true },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Akun ini belum terdaftar sebagai agent." },
        { status: 404 }
      );
    }

    const acaraId = BigInt(id_acara);

    // cek sudah terdaftar
    const existing = await prisma.pesertaAcara.findFirst({
      where: {
        id_acara: acaraId,
        id_agent: agent.id_agent,
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          message: "Anda sudah terdaftar di PEMILU ini.",
          already_joined: true,
        },
        { status: 200 }
      );
    }

    // nomor urut terakhir
    const lastPeserta = await prisma.pesertaAcara.findFirst({
      where: { id_acara: acaraId },
      orderBy: { nomor_urut: "desc" },
      select: { nomor_urut: true },
    });

    const nextOrder = lastPeserta ? (lastPeserta.nomor_urut ?? 0) + 1 : 1;

    const newPeserta = await prisma.pesertaAcara.create({
      data: {
        id_acara: acaraId,
        id_agent: agent.id_agent,
        nomor_urut: nextOrder,
        // status_peserta default TERDAFTAR
      },
    });

    return NextResponse.json(
      {
        message: "Berhasil join PEMILU!",
        data: {
          id_acara: newPeserta.id_acara.toString(),
          id_agent: newPeserta.id_agent,
          nomor_urut: newPeserta.nomor_urut,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error join PEMILU:", error);
    return NextResponse.json(
      { error: "Gagal join PEMILU. Silakan coba lagi." },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// src/app/api/pemilu/[id_acara]/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, status_peserta_enum } from "@prisma/client";
import Pusher from "pusher";

const prisma = new PrismaClient();

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

interface RouteContext {
  params: { id_acara: string };
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const id_acara = BigInt(params.id_acara);
    const now = new Date();

    const acara = await prisma.acara.findUnique({
      where: { id_acara },
      include: {
        pesertaAcara: {
          orderBy: {
            nomor_urut: "asc",
          },
        },
      },
    });

    if (!acara) {
      return NextResponse.json(
        { error: "Acara tidak ditemukan" },
        { status: 404 }
      );
    }

    // Sudah ada yang SEDANG_MEMILIH? jangan start lagi
    const sudahAktif = acara.pesertaAcara.find(
      (p) => p.status_peserta === status_peserta_enum.SEDANG_MEMILIH
    );

    if (sudahAktif) {
      return NextResponse.json(
        { error: "Pemilu sudah dimulai" },
        { status: 400 }
      );
    }

    // Peserta pertama yang TERDAFTAR & punya nomor_urut
    const firstPeserta = acara.pesertaAcara.find(
      (p) =>
        p.nomor_urut != null &&
        p.status_peserta === status_peserta_enum.TERDAFTAR
    );

    if (!firstPeserta) {
      return NextResponse.json(
        { error: "Tidak ada peserta terdaftar" },
        { status: 400 }
      );
    }

    // Opsional: tandai acara sudah dimulai
    await prisma.acara.update({
      where: { id_acara },
      data: { sudah_dimulai: true },
    });

    // Semua TERDAFTAR -> MENUNGGU_GILIRAN
    await prisma.pesertaAcara.updateMany({
      where: {
        id_acara,
        status_peserta: status_peserta_enum.TERDAFTAR,
      },
      data: {
        status_peserta: status_peserta_enum.MENUNGGU_GILIRAN,
      },
    });

    // Peserta pertama -> SEDANG_MEMILIH
    const durasi = acara.durasi_pilih ?? 60;
    const start = now;
    const end = new Date(start.getTime() + durasi * 1000);

    const activated = await prisma.pesertaAcara.update({
      where: { id_peserta: firstPeserta.id_peserta },
      data: {
        status_peserta: status_peserta_enum.SEDANG_MEMILIH,
        waktu_mulai_pilih: start,
        waktu_selesai_pilih: end,
      },
    });

    const remainingSeconds = Math.max(
      0,
      Math.floor((end.getTime() - Date.now()) / 1000)
    );

    console.log(
      `🚀 Manual start pemilu ${id_acara}: ${activated.id_agent}, remaining=${remainingSeconds}s`
    );

    await pusher.trigger(`pemilu-${id_acara}`, "giliran-update", {
      id_agent: activated.id_agent,
      remainingSeconds,
    });

    return NextResponse.json(
      {
        message: "Pemilu dimulai",
        activeAgentId: activated.id_agent,
        remainingSeconds,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error start pemilu:", error);
    return NextResponse.json(
      { error: "Gagal memulai pemilu" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

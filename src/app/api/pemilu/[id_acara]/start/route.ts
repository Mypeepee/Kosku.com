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
      include: { pesertaAcara: true },
    });

    if (!acara) {
      return NextResponse.json({ error: "Acara tidak ditemukan" }, { status: 404 });
    }

    const sudahAktif = acara.pesertaAcara.find(
      (p) => p.status_peserta === status_peserta_enum.AKTIF
    );

    if (sudahAktif) {
      return NextResponse.json(
        { error: "Pemilu sudah dimulai" },
        { status: 400 }
      );
    }

    const firstPeserta = [...acara.pesertaAcara]
      .filter((p) => p.nomor_urut != null)
      .sort((a, b) => (a.nomor_urut ?? 0) - (b.nomor_urut ?? 0))[0];

    if (!firstPeserta) {
      return NextResponse.json(
        { error: "Tidak ada peserta terdaftar" },
        { status: 400 }
      );
    }

    const durasi = acara.durasi_pilih ?? 60;
    const start = now;
    const end = new Date(start.getTime() + durasi * 1000);

    const activated = await prisma.pesertaAcara.update({
      where: { id_peserta: firstPeserta.id_peserta },
      data: {
        status_peserta: status_peserta_enum.AKTIF,
        waktu_mulai_pilih: start,
        waktu_selesai_pilih: end,
      },
    });

    const remainingSeconds = Math.floor((end.getTime() - Date.now()) / 1000);

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
    console.error("Error start pemilu:", error);
    return NextResponse.json(
      { error: "Gagal memulai pemilu" },
      { status: 500 }
    );
  }
}

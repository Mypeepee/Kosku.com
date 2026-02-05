// src/app/api/pemilu/[id_acara]/giliran/next/route.ts
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

    console.log(`🔄 [${now.toISOString()}] giliran/next called for acara ${id_acara}`);

    const acara = await prisma.acara.findUnique({
      where: { id_acara },
      include: { pesertaAcara: true },
    });

    if (!acara) {
      console.error(`❌ Acara ${id_acara} tidak ditemukan`);
      return NextResponse.json({ error: "Acara tidak ditemukan" }, { status: 404 });
    }

    const durasi = acara.durasi_pilih ?? 60;

    const pesertaAktif = acara.pesertaAcara.find(
      (p) => p.status_peserta === status_peserta_enum.AKTIF
    );

    if (!pesertaAktif) {
      console.error(`❌ Tidak ada peserta AKTIF di acara ${id_acara}`);
      console.log("Peserta list:", acara.pesertaAcara.map(p => ({
        id: p.id_peserta,
        agent: p.id_agent,
        nomor: p.nomor_urut,
        status: p.status_peserta
      })));
      return NextResponse.json(
        { error: "Tidak ada peserta aktif" },
        { status: 400 }
      );
    }

    console.log(`✅ Peserta aktif: ${pesertaAktif.id_agent} (nomor ${pesertaAktif.nomor_urut})`);

    // Tandai peserta aktif selesai
    await prisma.pesertaAcara.update({
      where: { id_peserta: pesertaAktif.id_peserta },
      data: {
        status_peserta: status_peserta_enum.SELESAI,
        waktu_selesai_pilih: pesertaAktif.waktu_selesai_pilih ?? now,
      },
    });

    console.log(`✅ Peserta ${pesertaAktif.id_agent} ditandai SELESAI`);

    // Cari peserta berikutnya
    const nextPeserta = acara.pesertaAcara
      .filter(
        (p) =>
          p.nomor_urut != null &&
          p.nomor_urut > (pesertaAktif.nomor_urut ?? 0) &&
          p.status_peserta === status_peserta_enum.TERDAFTAR
      )
      .sort((a, b) => (a.nomor_urut ?? 0) - (b.nomor_urut ?? 0))[0];

    if (!nextPeserta) {
      console.log(`🏁 Pemilu ${id_acara} selesai, tidak ada peserta berikutnya`);
      
      await pusher.trigger(`pemilu-${id_acara}`, "giliran-update", {
        id_agent: null,
        remainingSeconds: null,
      });

      return NextResponse.json(
        {
          message: "Pemilu selesai",
          activeAgentId: null,
          remainingSeconds: null,
        },
        { status: 200 }
      );
    }

    console.log(`➡️ Next peserta: ${nextPeserta.id_agent} (nomor ${nextPeserta.nomor_urut})`);

    const start = now;
    const end = new Date(start.getTime() + durasi * 1000);

    const newAktif = await prisma.pesertaAcara.update({
      where: { id_peserta: nextPeserta.id_peserta },
      data: {
        status_peserta: status_peserta_enum.AKTIF,
        waktu_mulai_pilih: start,
        waktu_selesai_pilih: end,
      },
    });

    const remainingSeconds = Math.floor((end.getTime() - Date.now()) / 1000);

    console.log(`✅ Giliran pindah ke ${newAktif.id_agent}, remaining: ${remainingSeconds}s`);

    await pusher.trigger(`pemilu-${id_acara}`, "giliran-update", {
      id_agent: newAktif.id_agent,
      remainingSeconds,
    });

    return NextResponse.json(
      {
        message: "Giliran pindah",
        activeAgentId: newAktif.id_agent,
        remainingSeconds,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error next giliran:", error);
    return NextResponse.json(
      { error: "Gagal pindah giliran" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

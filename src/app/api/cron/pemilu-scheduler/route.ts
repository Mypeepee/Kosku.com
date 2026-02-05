// src/app/api/cron/pemilu-scheduler/route.ts
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

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    console.log(`\n⏰ [${now.toISOString()}] Running pemilu scheduler...`);

    const started: any[] = [];
    const transitioned: any[] = [];

    // STEP 1: Mulai pemilu yang belum pernah di-start
    const acarasBelumMulai = await prisma.acara.findMany({
      where: {
        tipe_acara: "PEMILU",
        tanggal_mulai: { lte: now },
        tanggal_selesai: { gt: now },
        pesertaAcara: {
          none: {
            status_peserta: {
              in: [
                status_peserta_enum.SEDANG_MEMILIH,
                status_peserta_enum.MENUNGGU_GILIRAN,
                status_peserta_enum.SUDAH_MEMILIH,
              ],
            },
          },
        },
      },
      include: {
        pesertaAcara: {
          where: {
            status_peserta: status_peserta_enum.TERDAFTAR,
          },
          orderBy: { nomor_urut: "asc" },
        },
      },
    });

    for (const acara of acarasBelumMulai) {
      const first = acara.pesertaAcara[0];

      if (!first || first.nomor_urut == null) {
        console.log(`⚠️ Acara ${acara.id_acara}: tidak ada peserta TERDAFTAR`);
        continue;
      }

      // semua peserta TERDAFTAR → MENUNGGU_GILIRAN
      await prisma.pesertaAcara.updateMany({
        where: {
          id_acara: acara.id_acara,
          status_peserta: status_peserta_enum.TERDAFTAR,
        },
        data: {
          status_peserta: status_peserta_enum.MENUNGGU_GILIRAN,
        },
      });

      // peserta pertama → SEDANG_MEMILIH
      const durasi = acara.durasi_pilih ?? 60;
      const start = now;
      const end = new Date(start.getTime() + durasi * 1000);

      const updated = await prisma.pesertaAcara.updateMany({
        where: {
          id_peserta: first.id_peserta,
          status_peserta: status_peserta_enum.MENUNGGU_GILIRAN,
        },
        data: {
          status_peserta: status_peserta_enum.SEDANG_MEMILIH,
          waktu_mulai_pilih: start,
          waktu_selesai_pilih: end,
        },
      });

      if (updated.count === 0) {
        console.log(
          `⚠️ Acara ${acara.id_acara}: peserta ${first.id_agent} sudah diubah`
        );
        continue;
      }

      const remainingSeconds = Math.max(
        0,
        Math.floor((end.getTime() - Date.now()) / 1000)
      );

      await pusher.trigger(`pemilu-${acara.id_acara}`, "giliran-update", {
        id_agent: first.id_agent,
        remainingSeconds,
      });

      started.push({
        id_acara: acara.id_acara.toString(),
        judul: acara.judul_acara,
        agent: first.id_agent,
      });

      console.log(
        `🚀 Start pemilu ${acara.id_acara}: ${first.id_agent} (nomor ${first.nomor_urut})`
      );
    }

    // OPTIONAL: kalau kamu mau scheduler juga yang auto-rotasi giliran
    // kamu bisa adaptasikan Step 2 dari route /giliran/next (lihat bawah)
    // atau cukup gunakan /giliran/next saja (tanpa auto-rotate di cron).

    if (!started.length && !transitioned.length) {
      console.log("ℹ️ No action needed");
    }

    return NextResponse.json(
      {
        message: "Scheduler OK",
        started,
        transitioned,
        timestamp: now.toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Scheduler error:", error);
    return NextResponse.json({ error: "Scheduler gagal" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

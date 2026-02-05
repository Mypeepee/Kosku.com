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

    console.log(
      `🔄 [${now.toISOString()}] giliran/next called for acara ${id_acara}`
    );

    const acara = await prisma.acara.findUnique({
      where: { id_acara },
      include: {
        pesertaAcara: {
          orderBy: { nomor_urut: "asc" },
        },
      },
    });

    if (!acara) {
      return NextResponse.json(
        { error: "Acara tidak ditemukan" },
        { status: 404 }
      );
    }

    // ✅ CEK BATAS WAKTU ACARA
    if (acara.tanggal_selesai && now >= acara.tanggal_selesai) {
      console.log(
        `🏁 Acara ${id_acara} sudah lewat tanggal_selesai (${acara.tanggal_selesai.toISOString()})`
      );
      await pusher.trigger(`pemilu-${id_acara}`, "giliran-update", {
        id_agent: null,
        remainingSeconds: null,
      });
      return NextResponse.json(
        {
          message: "Acara sudah selesai (lewat tanggal_selesai)",
          activeAgentId: null,
          remainingSeconds: null,
        },
        { status: 200 }
      );
    }

    const durasi = acara.durasi_pilih ?? 60;

    const pesertaAktif = acara.pesertaAcara.find(
      (p) => p.status_peserta === status_peserta_enum.SEDANG_MEMILIH
    );

    if (!pesertaAktif) {
      console.error(`❌ Tidak ada peserta SEDANG_MEMILIH di acara ${id_acara}`);
      console.log(
        "Peserta list:",
        acara.pesertaAcara.map((p) => ({
          id: p.id_peserta,
          agent: p.id_agent,
          nomor: p.nomor_urut,
          status: p.status_peserta,
        }))
      );
      return NextResponse.json(
        { error: "Tidak ada peserta aktif" },
        { status: 400 }
      );
    }

    console.log(
      `✅ Peserta aktif: ${pesertaAktif.id_agent} (nomor ${pesertaAktif.nomor_urut})`
    );

    // 1) tandai aktif → SUDAH_MEMILIH
    const selesai = await prisma.pesertaAcara.updateMany({
      where: {
        id_peserta: pesertaAktif.id_peserta,
        status_peserta: status_peserta_enum.SEDANG_MEMILIH,
      },
      data: {
        status_peserta: status_peserta_enum.SUDAH_MEMILIH,
        waktu_selesai_pilih: pesertaAktif.waktu_selesai_pilih ?? now,
      },
    });

    if (selesai.count === 0) {
      return NextResponse.json(
        { error: "Giliran sudah diproses" },
        { status: 409 }
      );
    }

    // 2) peserta valid = punya nomor_urut, tidak DQ, tidak SKIP
    const pesertaValid = acara.pesertaAcara.filter(
      (p) =>
        p.nomor_urut != null &&
        p.status_peserta !== status_peserta_enum.DISKUALIFIKASI &&
        p.status_peserta !== status_peserta_enum.SKIP
    );

    if (pesertaValid.length === 0) {
      console.log(`🏁 Tidak ada peserta valid di acara ${id_acara}`);
      await pusher.trigger(`pemilu-${id_acara}`, "giliran-update", {
        id_agent: null,
        remainingSeconds: null,
      });
      return NextResponse.json(
        {
          message: "Tidak ada peserta valid",
          activeAgentId: null,
          remainingSeconds: null,
        },
        { status: 200 }
      );
    }

    // 3) cari yang nomor_urut > aktif (TANPA cek SUDAH_MEMILIH)
    let nextPeserta =
      pesertaValid.find(
        (p) => p.nomor_urut! > (pesertaAktif.nomor_urut ?? 0)
      ) ?? null;

    if (!nextPeserta) {
      // aktif tadi adalah urutan terakhir valid → wrap ke nomor paling kecil
      nextPeserta =
        pesertaValid.sort(
          (a, b) => (a.nomor_urut ?? 0) - (b.nomor_urut ?? 0)
        )[0] ?? null;
    }

    if (!nextPeserta) {
      console.log(
        `🏁 Tidak ada peserta berikutnya yang valid di acara ${id_acara}`
      );
      await pusher.trigger(`pemilu-${id_acara}`, "giliran-update", {
        id_agent: null,
        remainingSeconds: null,
      });
      return NextResponse.json(
        {
          message: "Tidak ada peserta berikutnya",
          activeAgentId: null,
          remainingSeconds: null,
        },
        { status: 200 }
      );
    }

    // 4) set semua peserta lain → MENUNGGU_GILIRAN
    await prisma.pesertaAcara.updateMany({
      where: {
        id_acara,
        status_peserta: {
          in: [
            status_peserta_enum.MENUNGGU_GILIRAN,
            status_peserta_enum.SEDANG_MEMILIH,
          ],
        },
        id_peserta: {
          not: nextPeserta.id_peserta,
        },
      },
      data: {
        status_peserta: status_peserta_enum.MENUNGGU_GILIRAN,
      },
    });

    // 5) aktifkan nextPeserta → SEDANG_MEMILIH
    const start = now;
    const end = new Date(start.getTime() + durasi * 1000);

    const newAktif = await prisma.pesertaAcara.updateMany({
      where: {
        id_peserta: nextPeserta.id_peserta,
        status_peserta: {
          in: [
            status_peserta_enum.MENUNGGU_GILIRAN,
            status_peserta_enum.TERDAFTAR,
            status_peserta_enum.SUDAH_MEMILIH,
          ],
        },
      },
      data: {
        status_peserta: status_peserta_enum.SEDANG_MEMILIH,
        waktu_mulai_pilih: start,
        waktu_selesai_pilih: end,
      },
    });

    if (newAktif.count === 0) {
      return NextResponse.json(
        { error: "Peserta berikutnya sudah diproses" },
        { status: 409 }
      );
    }

    const remainingSeconds = Math.max(
      0,
      Math.floor((end.getTime() - Date.now()) / 1000)
    );

    console.log(
      `➡️ Giliran pindah ke ${nextPeserta.id_agent} (nomor ${nextPeserta.nomor_urut}), remaining: ${remainingSeconds}s`
    );

    await pusher.trigger(`pemilu-${id_acara}`, "giliran-update", {
      id_agent: nextPeserta.id_agent,
      remainingSeconds,
    });

    return NextResponse.json(
      {
        message: "Giliran pindah",
        activeAgentId: nextPeserta.id_agent,
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

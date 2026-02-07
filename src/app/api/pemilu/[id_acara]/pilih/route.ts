// src/app/api/pemilu/[id_acara]/pilih/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
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
    const body = await req.json();
    const { id_agent, id_listing } = body;

    if (!id_agent || !id_listing) {
      return NextResponse.json(
        { error: "id_agent dan id_listing wajib diisi" },
        { status: 400 }
      );
    }

    console.log(`🎯 Agent ${id_agent} memilih listing ${id_listing} di acara ${id_acara}`);

    // ❌ HAPUS validasi "agent sudah pilih sebelumnya"
    // Agent boleh pilih berkali-kali dalam 1 giliran

    // Cek apakah listing sudah dipilih (oleh siapa pun)
    const existingPilihan = await prisma.pilihanPemilu.findFirst({
      where: {
        id_acara,
        id_listing: BigInt(id_listing),
      },
    });

    if (existingPilihan) {
      return NextResponse.json(
        { error: "Listing ini sudah dipilih oleh agent lain" },
        { status: 409 }
      );
    }

    // Cek apakah ini giliran agent yang bersangkutan
    const peserta = await prisma.pesertaAcara.findFirst({
      where: {
        id_acara,
        id_agent,
        status_peserta: "SEDANG_MEMILIH",
      },
    });

    if (!peserta) {
      return NextResponse.json(
        { error: "Bukan giliran Anda untuk memilih" },
        { status: 403 }
      );
    }

    // Transaction: Insert ke pilihan_pemilu dan update listing
    const result = await prisma.$transaction(async (tx) => {
      // 1. Insert pilihan baru
      const newPilihan = await tx.pilihanPemilu.create({
        data: {
          id_acara,
          id_agent,
          id_listing: BigInt(id_listing),
        },
        include: {
          agent: {
            select: {
              id_agent: true,
              pengguna: { select: { nama_lengkap: true } },
            },
          },
          listing: {
            select: {
              id_property: true,
              judul: true,
              harga: true,
              alamat_lengkap: true,
            },
          },
        },
      });

      // 2. Update listing id_agent
      await tx.listing.update({
        where: { id_property: BigInt(id_listing) },
        data: { id_agent },
      });

      return newPilihan;
    });

    console.log(`✅ Pilihan berhasil: ${id_agent} → ${id_listing}`);

    // Trigger Pusher event untuk update realtime
    await pusher.trigger(`pemilu-${id_acara}`, "pilihan-update", {
      id_pilihan: result.id_pilihan,
      id_acara: id_acara.toString(),
      id_agent: result.id_agent,
      nama_agent: result.agent?.pengguna?.nama_lengkap ?? result.id_agent,
      id_listing: result.id_listing.toString(),
      judul_listing: result.listing.judul,
      harga: result.listing.harga?.toString() ?? null,
      alamat: result.listing.alamat_lengkap,
    });

    return NextResponse.json(
      {
        message: "Pilihan berhasil disimpan",
        data: {
          id_pilihan: result.id_pilihan,
          id_agent: result.id_agent,
          nama_agent: result.agent?.pengguna?.nama_lengkap ?? result.id_agent,
          id_listing: result.id_listing.toString(),
          judul_listing: result.listing.judul,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("❌ Error saat pilih:", error);
    return NextResponse.json(
      { error: "Gagal menyimpan pilihan" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

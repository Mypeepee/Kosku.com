import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";


export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.pengguna.findUnique({
    where: { id_pengguna: session.user.id },
    include: {
      agent: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { agent, ...penggunaRaw } = user;

  const pengguna = {
    ...penggunaRaw,
    tanggal_lahir: penggunaRaw.tanggal_lahir
      ? new Date(penggunaRaw.tanggal_lahir).toISOString().split("T")[0]
      : "",
  };

  let stats: Record<string, number> = {};

  if (agent) {
    const [listingAktif, transaksiBerhasil] = await Promise.all([
      prisma.listing.count({
        where: { id_agent: agent.id_agent, status_tayang: "TERSEDIA" },
      }),
      prisma.transaksi.count({
        where: { mou: { id_agent: agent.id_agent } },
      }),
    ]);

    stats = {
      premierPoin: agent.poin,
      listingAktif,
      transaksiBerhasil,
    };
  }

  return NextResponse.json({
    pengguna,
    agent: agent ?? null,
    stats,
  });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  try {
    const updatedUser = await prisma.pengguna.update({
      where: { 
        id_pengguna: session.user.id // <--- Update juga pakai ID
      },
      data: {
        nama_lengkap: body.nama_lengkap,
        kota_asal: body.kota_asal,
        pekerjaan: body.pekerjaan,
        jenis_kelamin: body.jenis_kelamin,
        tanggal_lahir: body.tanggal_lahir ? new Date(body.tanggal_lahir) : null,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    return NextResponse.json({ error: "Gagal update profile" }, { status: 500 });
  }
}
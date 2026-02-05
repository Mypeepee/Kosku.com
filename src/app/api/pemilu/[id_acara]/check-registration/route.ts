// src/app/api/pemilu/[id_acara]/check-registration/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

interface RouteContext {
  params: { id_acara: string };
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { id_acara } = params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ registered: false }, { status: 200 });
    }

    const agent = await prisma.agent.findFirst({
      where: { id_pengguna: session.user.id },
      select: { id_agent: true },
    });

    if (!agent) {
      return NextResponse.json({ registered: false }, { status: 200 });
    }

    const acaraId = BigInt(id_acara);

    const peserta = await prisma.pesertaAcara.findFirst({
      where: {
        id_acara: acaraId,
        id_agent: agent.id_agent,
      },
    });

    return NextResponse.json(
      {
        registered: !!peserta,
        nomor_urut: peserta?.nomor_urut ?? null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error check registration:", error);
    return NextResponse.json({ registered: false }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

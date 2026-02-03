// app/api/HRM/status/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id_agent, status_keanggotaan } = body as {
      id_agent: string;
      status_keanggotaan: "AKTIF" | "PENDING" | "SUSPEND";
    };

    if (!id_agent || !status_keanggotaan) {
      return NextResponse.json(
        { error: "id_agent dan status_keanggotaan wajib diisi" },
        { status: 400 }
      );
    }

    const agent = await prisma.agent.update({
      where: { id_agent },
      data: { status_keanggotaan },
    });

    return NextResponse.json({ agent }, { status: 200 });
  } catch (err) {
    console.error("Error updating agent status:", err);
    return NextResponse.json(
      { error: "Gagal mengubah status agent" },
      { status: 500 }
    );
  }
}

// app/api/HRM/agent-office/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id_agent, nama_kantor } = body as {
      id_agent: string;
      nama_kantor: string;
    };

    if (!id_agent || !nama_kantor?.trim()) {
      return NextResponse.json(
        { error: "id_agent dan nama_kantor wajib diisi" },
        { status: 400 }
      );
    }

    const agent = await prisma.agent.update({
      where: { id_agent },
      data: { nama_kantor: nama_kantor.trim() },
    });

    return NextResponse.json({ agent }, { status: 200 });
  } catch (err) {
    console.error("Error updating agent office:", err);
    return NextResponse.json(
      { error: "Gagal mengubah nama kantor" },
      { status: 500 }
    );
  }
}

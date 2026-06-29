import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";

export async function GET() {
  try {
    const session = (await getServerSession(authOptions as any)) as any;
    const agentId = String(session?.user?.agentId || "").trim();
    if (!agentId) return NextResponse.json({ ok: true, items: [] });

    const rows = await prisma.projectInvestor.findMany({
      where: {
        id_agent: agentId,
        status: "menunggu_pembayaran",
      },
      select: {
        nominal_komitmen: true,
        project: {
          select: {
            id_project: true,
            nama_project: true,
            kota: true,
            provinsi: true,
            status: true,
          },
        },
      },
    });

    const items = rows.map((r) => ({
      id_project: r.project.id_project,
      nama_project: r.project.nama_project,
      lokasi: [r.project.kota, r.project.provinsi].filter(Boolean).join(", ") || "-",
      status_project: r.project.status,
      nominal_komitmen: Number(r.nominal_komitmen),
    }));

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error("[pembayaran-pending]", err);
    return NextResponse.json({ ok: false, items: [] }, { status: 500 });
  }
}

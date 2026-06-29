import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher-server";

const ALLOWED_STATUSES = new Set(["menunggu_pembayaran", "lunas"]);

export async function PATCH(request: NextRequest) {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    const currentAgentId =
      typeof token?.agentId === "string"
        ? token.agentId
        : typeof token?.id_agent === "string"
        ? token.id_agent
        : null;

    if (!currentAgentId) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized. Agent tidak ditemukan di session.",
        },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);

    const investorIdRaw = body?.id_project_investor;
    const nextStatus = String(body?.status ?? "").trim();

    if (investorIdRaw == null || investorIdRaw === "") {
      return NextResponse.json(
        {
          success: false,
          message: "id_project_investor wajib diisi.",
        },
        { status: 400 }
      );
    }

    let investorId: bigint;

    try {
      investorId = BigInt(investorIdRaw);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "id_project_investor tidak valid.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_STATUSES.has(nextStatus)) {
      return NextResponse.json(
        {
          success: false,
          message: "Status pembayaran tidak valid.",
        },
        { status: 400 }
      );
    }

    const investor = await prisma.projectInvestor.findUnique({
      where: {
        id_project_investor: investorId,
      },
      select: {
        id_project_investor: true,
        id_agent: true,
        status: true,
        project: {
          select: {
            id_project: true,
            dibuat_oleh: true,
          },
        },
      },
    });

    if (!investor) {
      return NextResponse.json(
        {
          success: false,
          message: "Data investor project tidak ditemukan.",
        },
        { status: 404 }
      );
    }

    if (investor.project.dibuat_oleh !== currentAgentId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Hanya penyelenggara project yang boleh mengubah status pembayaran.",
        },
        { status: 403 }
      );
    }

    const updated = await prisma.projectInvestor.update({
      where: {
        id_project_investor: investorId,
      },
      data: {
        status: nextStatus as "menunggu_pembayaran" | "lunas",
      },
      select: {
        id_project_investor: true,
        status: true,
        diupdate_tanggal: true,
      },
    });

    // Real-time: beri tahu investor langsung jika statusnya berubah ke lunas
    if (nextStatus === "lunas" && investor.id_agent) {
      pusherServer
        .trigger(`project-investor-${investor.id_agent}`, "pembayaran:lunas", {
          id_project: investor.project.id_project,
        })
        .catch(() => {});
    }

    return NextResponse.json({
      success: true,
      message: "Status pembayaran berhasil diperbarui.",
      data: {
        id_project_investor: updated.id_project_investor.toString(),
        status: updated.status,
        diupdate_tanggal: updated.diupdate_tanggal.toISOString(),
      },
    });
  } catch (error) {
    console.error("[UPDATE_STATUS_PEMBAYARAN_ERROR]", error);

    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan server.",
      },
      { status: 500 }
    );
  }
}
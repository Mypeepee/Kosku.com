import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = [
  "pendanaan_terbuka",
  "pendanaan_penuh",
  "pengurusan_dokumen",
  "eksekusi_pengosongan",
  "renovasi",
  "sedang_dijual",
  "terjual",
  "dibatalkan",
] as const;

type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

function isAllowedStatus(value: unknown): value is AllowedStatus {
  return (
    typeof value === "string" &&
    (ALLOWED_STATUSES as readonly string[]).includes(value)
  );
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const sessionAgentId = ((session?.user as any)?.agentId ?? null) as
      | string
      | null;

    if (!sessionAgentId) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized. Agent tidak ditemukan pada session.",
        },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const nextStatus = body?.status;

    if (!isAllowedStatus(nextStatus)) {
      return NextResponse.json(
        {
          success: false,
          message: "Status project tidak valid.",
        },
        { status: 400 }
      );
    }

    const existingProject = await prisma.project.findUnique({
      where: {
        id_project: id,
      },
      select: {
        id_project: true,
        dibuat_oleh: true,
        status: true,
      },
    });

    if (!existingProject) {
      return NextResponse.json(
        {
          success: false,
          message: "Project tidak ditemukan.",
        },
        { status: 404 }
      );
    }

    if (existingProject.dibuat_oleh !== sessionAgentId) {
      return NextResponse.json(
        {
          success: false,
          message: "Hanya pembuat project yang dapat mengubah status.",
        },
        { status: 403 }
      );
    }

    const updatedProject = await prisma.project.update({
      where: {
        id_project: id,
      },
      data: {
        status: nextStatus,
        diupdate_tanggal: new Date(),
      },
      select: {
        id_project: true,
        status: true,
        diupdate_tanggal: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Status project berhasil diperbarui.",
      data: updatedProject,
    });
  } catch (error) {
    console.error("[UPDATE_PROJECT_STATUS_ERROR]", error);

    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan saat memperbarui status project.",
      },
      { status: 500 }
    );
  }
}
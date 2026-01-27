// src/app/api/profile/photo/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "../../auth/[...nextauth]/route";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ambil file dari FormData
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
  }

  // TODO: upload ke storage kamu (Google Drive / S3 / dll)
  // misal setelah upload, kamu dapat fileId:
  const fakeFileId = "GOOGLE_DRIVE_FILE_ID"; // ganti dengan ID asli dari proses upload

  // pastikan user ini agent dulu
  const agent = await prisma.agent.findUnique({
    where: { id_pengguna: session.user.id },
  });

  if (!agent) {
    return NextResponse.json(
      { error: "Akun agent tidak ditemukan" },
      { status: 404 }
    );
  }

  const updated = await prisma.agent.update({
    where: { id_agent: agent.id_agent },
    data: {
      foto_profil_url: fakeFileId,
    },
  });

  return NextResponse.json({
    success: true,
    agent: updated,
  });
}

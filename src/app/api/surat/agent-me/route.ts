import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/surat/agent-me
 * Kembalikan identitas agent yang sedang login untuk prefill Tanda Terima:
 * - nama_agent  : nama lengkap agent (yang menyerahkan dokumen)
 * - no_agent    : nomor WhatsApp agent (identitas kontak), fallback ke id_agent
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { agentId?: string | null; name?: string | null };
  const agentId = user.agentId;

  if (!agentId) {
    // Bukan agent — tetap kirim nama dari session agar form bisa diisi manual
    return NextResponse.json({
      nama_agent: user.name ?? "",
      no_agent: "",
      id_agent: "",
    });
  }

  const agent = await prisma.agent.findUnique({
    where: { id_agent: agentId },
    select: {
      id_agent: true,
      nomor_whatsapp: true,
      pengguna: { select: { nama_lengkap: true } },
    },
  });

  return NextResponse.json({
    nama_agent: agent?.pengguna.nama_lengkap ?? user.name ?? "",
    no_agent: agent?.nomor_whatsapp ?? agent?.id_agent ?? "",
    id_agent: agent?.id_agent ?? agentId,
  });
}

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";


function normalizeAgentCode(raw: string) {
  const s = (raw || "").trim();
  if (!s) return "";

  if (/^\d+$/.test(s)) return `AG${s.replace(/^0+/, "") || "0"}`;

  const m = s.toUpperCase().match(/^AG\s*0*(\d+)$/);
  if (m) return `AG${m[1]}`;

  return s.toUpperCase();
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const codeRaw = url.searchParams.get("code") || "";
    const code = normalizeAgentCode(codeRaw);

    if (!code) {
      return NextResponse.json(
        { ok: false, message: "Parameter code wajib diisi." },
        { status: 400 }
      );
    }

    // Cari agent by id_agent
    const agent = await prisma.agent.findUnique({
      where: { id_agent: code },
      select: {
        id_agent: true,
        id_pengguna: true,
        nama_kantor: true,
        kota_area: true,
        status_keanggotaan: true,
        pengguna: {
          select: {
            nama_lengkap: true,
          },
        },
      },
    });

    if (!agent) {
      return NextResponse.json(
        { ok: false, message: "Kode referral tidak ditemukan." },
        { status: 404 }
      );
    }

    if (agent.status_keanggotaan !== "AKTIF") {
      return NextResponse.json(
        { ok: false, message: "Agent upline belum AKTIF, referral belum bisa dipakai." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      id_agent: agent.id_agent,
      id_pengguna: agent.id_pengguna,
      nama_lengkap: agent.pengguna?.nama_lengkap ?? "Agent",
      nama_kantor: agent.nama_kantor ?? null,
      kota_area: agent.kota_area ?? null,
    });
  } catch (e: any) {
    console.error("GET /api/agent/referral error:", e);
    return NextResponse.json(
      { ok: false, message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}

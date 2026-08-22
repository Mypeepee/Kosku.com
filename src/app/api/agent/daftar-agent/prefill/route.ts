import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errJson(message: string, status = 400, extra?: any) {
  return NextResponse.json({ ok: false, message, ...extra }, { status });
}

function okJson(data: any, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

function normalizePhoneDigits(raw: string) {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("62")) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");
  return digits;
}

function toE164Id(raw: string) {
  const d = normalizePhoneDigits(raw);
  return d ? `+62${d}` : null;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!session || !user?.id) {
      return errJson("Unauthorized", 401);
    }

    const id_pengguna = String(user.id);

    // ✅ RAW SQL ke tabel yang kamu punya (public.pengguna & public.agent)
    const penggunaRows = await prisma.$queryRaw<
      Array<{
        id_pengguna: string;
        nama_lengkap: string;
        email: string | null;
        nomor_telepon: string | null;
      }>
    >`
      SELECT id_pengguna, nama_lengkap, email, nomor_telepon
      FROM public.pengguna
      WHERE id_pengguna = ${id_pengguna}
      LIMIT 1
    `;

    const pengguna = penggunaRows?.[0] ?? null;

    // agent row (kalau sudah pernah daftar -> akan ada record)
    const agentRows = await prisma.$queryRaw<
      Array<{
        id_agent: string;
        id_pengguna: string;
        status_keanggotaan: string;
        nama_kantor: string;
        kota_area: string;
        nomor_whatsapp: string;
        id_upline: string | null;
        link_instagram: string | null;
        link_facebook: string | null;
        link_tiktok: string | null;
        foto_ktp_url: string | null;
        foto_npwp_url: string | null;
        foto_profil_url: string | null;
        dibuat_pada: Date | null;
        diperbarui_pada: Date | null;
      }>
    >`
      SELECT
        id_agent,
        id_pengguna,
        status_keanggotaan::text as status_keanggotaan,
        nama_kantor,
        kota_area,
        nomor_whatsapp,
        id_upline,
        link_instagram,
        link_facebook,
        link_tiktok,
        foto_ktp_url,
        foto_npwp_url,
        foto_profil_url,
        dibuat_pada,
        diperbarui_pada
      FROM public.agent
      WHERE id_pengguna = ${id_pengguna}
      ORDER BY diperbarui_pada DESC NULLS LAST
      LIMIT 1
    `;

    const agent = agentRows?.[0] ?? null;

    // fallback nomor_telepon dari session kalau db kosong
    const nomorTeleponFinal =
      pengguna?.nomor_telepon ||
      (user?.phone as string | null) ||
      (user?.nomor_telepon as string | null) ||
      null;

    const penggunaOut = pengguna
      ? {
          ...pengguna,
          nomor_telepon: nomorTeleponFinal ? toE164Id(nomorTeleponFinal) : null,
        }
      : {
          id_pengguna,
          nama_lengkap: (user?.name as string) ?? "",
          email: (user?.email as string) ?? null,
          nomor_telepon: nomorTeleponFinal ? toE164Id(nomorTeleponFinal) : null,
        };

    return okJson({
      pengguna: penggunaOut,
      agent,
      alreadyApplied: Boolean(agent),
    });
  } catch (e: any) {
    console.error("prefill/route.ts error:", e);
    return errJson(e?.message || "Internal Server Error", 500);
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string; prefId: string } };

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const agentId = (session.user as any).agentId as string | undefined;
  if (!agentId) return NextResponse.json({ ok: false }, { status: 403 });

  const owned = await prisma.klien.findFirst({
    where: { id_klien: params.id, id_agent: agentId },
    select: { id_klien: true },
  });
  if (!owned) return NextResponse.json({ ok: false }, { status: 404 });

  let id: bigint;
  try { id = BigInt(params.prefId); }
  catch { return NextResponse.json({ ok: false, message: "Id preferensi tidak sah" }, { status: 400 }); }

  /* deleteMany, BUKAN delete, dan disaring ke id_klien.
     Dua alasan, keduanya nyata:

       1. `delete` melempar bila barisnya sudah tidak ada, dan itu keluar
          sebagai 500 tanpa pesan. Menghapus sesuatu yang memang sudah hilang
          BUKAN kegagalan — ketukan ganda, atau permintaan yang diulang setelah
          koneksi putus, harus berakhir dengan keadaan yang sama.
       2. Versi sebelumnya cuma memeriksa kepemilikan KLIEN, lalu menghapus id
          preferensi apa pun. Id milik klien lain yang diselipkan ke URL akan
          terhapus selama penyerang punya satu klien sendiri. */
  const { count } = await prisma.preferensiKlien.deleteMany({
    where: { id_preferensi: id, id_klien: params.id },
  });

  return NextResponse.json({ ok: true, terhapus: count });
}

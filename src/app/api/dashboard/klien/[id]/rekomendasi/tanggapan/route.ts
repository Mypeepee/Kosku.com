// PATCH /api/dashboard/klien/[id]/rekomendasi/tanggapan
// ---------------------------------------------------------------------------
// Catat reaksi klien atas sebuah aset yang dikirim, atau tutup sebuah kabar
// perubahan (diteruskan / sengaja dilewati).
//
// KENAPA TANGGAPAN PENTING. Ia satu-satunya jalan mesin ini belajar. "Tidak
// cocok — kemahalan" pada empat aset berturut-turut adalah bukti bahwa plafon
// budget di preferensinya salah, dan itu terbaca jauh sebelum kliennya sendiri
// mengatakannya. Tanpa kolom ini, sistem selamanya mengirim tanpa pernah tahu
// apakah kirimannya berguna.
//
// Body salah satu dari:
//   { id_kiriman, tanggapan: "SUKA"|"TIDAK_COCOK"|"MINTA_SURVEI"|"DEAL", alasan? }
//   { id_perubahan, aksi: "TERUSKAN" | "ABAIKAN" }
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";
import { tanggapan_kiriman_enum } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

const TANGGAPAN_SAH: tanggapan_kiriman_enum[] = ["MENUNGGU", "SUKA", "TIDAK_COCOK", "MINTA_SURVEI", "DEAL"];

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const agentId = (session.user as any).agentId as string | undefined;
  if (!agentId) return NextResponse.json({ ok: false }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const sekarang = new Date();

  /* ── Menutup sebuah kabar perubahan ── */
  if (body?.id_perubahan) {
    const aksi = body.aksi === "ABAIKAN" ? "ABAIKAN" : "TERUSKAN";

    /* Kepemilikan diperiksa lewat rantai relasi, bukan lewat id_agent di baris
       perubahan (yang memang tidak ada). Perubahan → kiriman → klien → agent. */
    const p = await prisma.perubahanKiriman.findFirst({
      where: {
        id: BigInt(String(body.id_perubahan)),
        kiriman: { id_klien: params.id, klien: { id_agent: agentId } },
      },
      include: { kiriman: { select: { id_kiriman: true } } },
    });
    if (!p) return NextResponse.json({ ok: false }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.perubahanKiriman.update({
        where: { id: p.id },
        data: aksi === "TERUSKAN" ? { diteruskan_pada: sekarang } : { diabaikan_pada: sekarang },
      });

      /* Hanya kabar yang BENAR-BENAR diteruskan yang menggeser harga_diketahui.
         Kalau abaikan ikut menggesernya, kenaikan 1% yang sengaja dilewati
         akan diam-diam jadi patokan baru — dan penurunan berikutnya dihitung
         dari angka yang tidak pernah diketahui klien. */
      if (aksi === "TERUSKAN" && p.harga_baru) {
        await tx.kirimanRekomendasi.update({
          where: { id_kiriman: p.id_kiriman },
          data: { harga_diketahui: p.harga_baru },
        });
        await tx.klien.update({
          where: { id_klien: params.id },
          data: { tanggal_kontak_terakhir: sekarang },
        });
      }
    });

    return NextResponse.json({ ok: true });
  }

  /* ── Mencatat tanggapan klien atas sebuah aset ── */
  if (!body?.id_kiriman) return NextResponse.json({ ok: false, message: "id_kiriman wajib" }, { status: 400 });

  const tanggapan = String(body.tanggapan || "") as tanggapan_kiriman_enum;
  if (!TANGGAPAN_SAH.includes(tanggapan))
    return NextResponse.json({ ok: false, message: "Tanggapan tidak dikenal" }, { status: 400 });

  const kiriman = await prisma.kirimanRekomendasi.findFirst({
    where: {
      id_kiriman: BigInt(String(body.id_kiriman)),
      id_klien: params.id,
      klien: { id_agent: agentId },
    },
    select: { id_kiriman: true },
  });
  if (!kiriman) return NextResponse.json({ ok: false }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.kirimanRekomendasi.update({
      where: { id_kiriman: kiriman.id_kiriman },
      data: {
        tanggapan,
        tanggapan_pada: tanggapan === "MENUNGGU" ? null : sekarang,
        alasan_tanggapan: body.alasan ? String(body.alasan).slice(0, 500) : null,
      },
    });

    /* Klien yang memberi tanggapan berarti baru saja berbicara dengan agent.
       Mencatatnya di sini berarti agent tidak perlu memperbarui dua tempat
       untuk satu percakapan yang sama. */
    if (tanggapan !== "MENUNGGU") {
      await tx.klien.update({
        where: { id_klien: params.id },
        data: {
          tanggal_kontak_terakhir: sekarang,
          /* MINTA_SURVEI dan DEAL adalah sinyal terkuat yang bisa diberikan
             seorang pembeli. Menaikkan tahapnya otomatis menghemat satu
             langkah yang toh pasti dilakukan agent — dan mencegah pipeline
             berbohong karena ada yang lupa menggesernya. */
          ...(tanggapan === "MINTA_SURVEI" ? { status: "hot_buyer" as const } : {}),
          ...(tanggapan === "DEAL" ? { status: "closing" as const } : {}),
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}

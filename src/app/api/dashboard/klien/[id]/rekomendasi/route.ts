// GET /api/dashboard/klien/[id]/rekomendasi
// ---------------------------------------------------------------------------
// Riwayat aset yang pernah dikirim ke seorang klien, berikut perubahan yang
// belum diteruskan. Inilah layar "apa yang sudah saya kirim ke Budi, dan mana
// yang perlu dikabari lagi".
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";
import { fotoPertama, hargaEfektif } from "@/lib/klienMatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const agentId = (session.user as any).agentId as string | undefined;
  if (!agentId) return NextResponse.json({ ok: false }, { status: 403 });

  const klien = await prisma.klien.findFirst({
    where: { id_klien: params.id, id_agent: agentId },
    select: { id_klien: true },
  });
  if (!klien) return NextResponse.json({ ok: false }, { status: 404 });

  const kiriman = await prisma.kirimanRekomendasi.findMany({
    where: { id_klien: params.id },
    orderBy: { terakhir_dikirim: "desc" },
    take: 100,
    include: {
      listing: {
        select: {
          id_property: true, slug: true, judul: true, kota: true, kecamatan: true,
          jenis_transaksi: true, kategori: true, gambar: true,
          harga: true, harga_promo: true, harga_efektif: true, nilai_limit_lelang: true,
          status_tayang: true, tanggal_lelang: true,
        },
      },
      /* Hanya perubahan yang belum diapa-apakan. Riwayat lengkap tiap
         pergerakan harga tidak dibutuhkan di layar ini dan akan menggandakan
         beban query untuk sesuatu yang tak seorang pun baca. */
      perubahan: {
        where: { diteruskan_pada: null, diabaikan_pada: null },
        orderBy: { terdeteksi_pada: "desc" },
      },
    },
  });

  const items = kiriman.map(k => ({
    id_kiriman: k.id_kiriman.toString(),
    id_property: k.id_property.toString(),
    slug: k.listing.slug,
    judul: k.listing.judul,
    kota: k.listing.kota ?? "",
    kecamatan: k.listing.kecamatan ?? "",
    jenis_transaksi: k.listing.jenis_transaksi,
    kategori: k.listing.kategori,
    gambar: fotoPertama(k.listing.gambar),
    status_tayang: k.listing.status_tayang,
    harga_sekarang: hargaEfektif(k.listing),
    harga_saat_kirim: Number(k.harga_saat_kirim),
    harga_diketahui: Number(k.harga_diketahui),
    jumlah_kirim: k.jumlah_kirim,
    pertama_dikirim: k.pertama_dikirim.toISOString(),
    terakhir_dikirim: k.terakhir_dikirim.toISOString(),
    tanggapan: k.tanggapan,
    tanggapan_pada: k.tanggapan_pada?.toISOString() ?? null,
    alasan_tanggapan: k.alasan_tanggapan,
    perubahan: k.perubahan.map(p => ({
      id: p.id.toString(),
      jenis: p.jenis,
      harga_lama: p.harga_lama ? Number(p.harga_lama) : null,
      harga_baru: p.harga_baru ? Number(p.harga_baru) : null,
      selisih_persen: p.selisih_persen ? Number(p.selisih_persen) : null,
      terdeteksi_pada: p.terdeteksi_pada.toISOString(),
    })),
  }));

  return NextResponse.json({
    ok: true,
    items,
    total: items.length,
    perluDikabari: items.filter(i => i.perubahan.length > 0).length,
  });
}

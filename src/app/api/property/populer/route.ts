import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const revalidate = 120;

function isValidImageUrl(url: string): boolean {
  if (!url || url.trim() === '') return false;
  const t = url.trim().toLowerCase();
  return t.startsWith('http://') || t.startsWith('https://') || t.startsWith('/');
}

function normalizeImages(raw: string | null | undefined): string[] {
  if (!raw || raw.trim() === '') return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) =>
      isValidImageUrl(s) ? s : `https://drive.google.com/thumbnail?id=${s}`
    );
}

function normalizeAgentPhoto(fileId: string | null | undefined): string {
  if (!fileId || fileId.trim() === '') return '/images/default-profile.png';
  const t = fileId.trim();
  if (t.startsWith('http://') || t.startsWith('https://') || t.startsWith('/')) return t;
  return `https://drive.google.com/thumbnail?id=${t}&sz=w64`;
}

const INCLUDE_AGENT = {
  agent: {
    select: {
      nama_kantor: true,
      foto_profil_url: true,
      pengguna: { select: { nama_lengkap: true } },
    },
  },
} as const;

function formatRow(item: any) {
  const foto_list = normalizeImages(item.gambar);
  return {
    id_property: String(item.id_property),
    slug: item.slug ?? '',
    judul: item.judul,
    kota: item.kota,
    alamat_lengkap: item.alamat_lengkap ?? item.kota,
    harga: Number(item.harga),
    harga_promo: item.harga_promo != null ? Number(item.harga_promo) : null,
    jenis_transaksi: item.jenis_transaksi,
    kategori: item.kategori,
    gambar: foto_list[0] ?? '/images/hero/banner.jpg',
    foto_list,
    luas_tanah: item.luas_tanah ? Number(item.luas_tanah) : 0,
    luas_bangunan: item.luas_bangunan ? Number(item.luas_bangunan) : 0,
    kamar_tidur: item.kamar_tidur ?? 0,
    kamar_mandi: item.kamar_mandi ?? 0,
    tanggal_lelang: item.tanggal_lelang
      ? item.tanggal_lelang.toISOString()
      : null,
    agent_name: item.agent?.pengguna?.nama_lengkap ?? 'Agent Premier',
    agent_photo: normalizeAgentPhoto(item.agent?.foto_profil_url),
    agent_office: item.agent?.nama_kantor ?? 'Solusindo Aset',
    is_hot_deal: !!item.is_hot_deal,
  };
}

export async function GET() {
  try {
    const [secondary, lelang] = await Promise.all([
      prisma.listing.findMany({
        where: { status_tayang: 'TERSEDIA', is_hot_deal: true, jenis_transaksi: { in: ['PRIMARY', 'SECONDARY', 'SEWA'] } },
        take: 4,
        orderBy: { tanggal_dibuat: 'desc' },
        include: INCLUDE_AGENT,
      }),
      prisma.listing.findMany({
        where: { status_tayang: 'TERSEDIA', is_hot_deal: true, jenis_transaksi: 'LELANG' },
        take: 6,
        orderBy: { tanggal_dibuat: 'desc' },
        include: INCLUDE_AGENT,
      }),
    ]);

    // interleave: satu secondary di antara lelang agar variatif
    const all = [...secondary, ...lelang];

    return NextResponse.json(all.map(formatRow), {
      headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=60' },
    });
  } catch (e) {
    console.error('[populer]', e);
    return NextResponse.json([], { status: 500 });
  }
}

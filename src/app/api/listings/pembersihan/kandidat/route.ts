/**
 * GET /api/listings/pembersihan/kandidat — daftar baris yang akan kena.
 *
 * Ada supaya "Hapus 1.327 baris" tidak pernah jadi tombol yang ditekan tanpa
 * melihat isinya. Dua mode:
 *   • ?aturan=BENDA_BERGERAK  → isi satu aturan, berhalaman;
 *   • ?q=sapi                 → pencarian manual, untuk sampah bentuk baru
 *                               yang belum punya aturan.
 *
 * OWNER ONLY, sama dengan jalur eksekusinya.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isIdAturan, type HalamanKandidat } from '@/lib/pembersihanListing';
import {
  SELECT_KANDIDAT,
  keKandidat,
  pastikanOwner,
  pesanErrorPembersihan,
  whereAturan,
  whereManual,
} from '../_lib/query';

const PAGE_SIZE_BAWAAN = 20;
const PAGE_SIZE_MAKS = 100;

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const izin = await pastikanOwner();
  if (!izin.ok) return izin.response;

  const sp = request.nextUrl.searchParams;
  const q = (sp.get('q') ?? '').trim();
  const aturan = sp.get('aturan') ?? '';

  const page = Math.max(1, Number(sp.get('page')) || 1);
  const pageSize = Math.min(
    PAGE_SIZE_MAKS,
    Math.max(1, Number(sp.get('pageSize')) || PAGE_SIZE_BAWAAN),
  );

  let where;
  if (isIdAturan(aturan)) {
    where = whereAturan(aturan);
  } else if (q.length >= 2) {
    where = whereManual(q);
  } else {
    return NextResponse.json(
      { error: 'Pilih aturan, atau ketik minimal 2 huruf untuk mencari.' },
      { status: 400 },
    );
  }

  try {
    const [total, baris] = await Promise.all([
      prisma.listing.count({ where }),
      prisma.listing.findMany({
        where,
        select: SELECT_KANDIDAT,
        // Urutan stabil & sama dengan jalur eksekusi (id_property asc): dengan
        // urutan yang berpindah-pindah, halaman 2 bisa memuat baris yang sudah
        // terlihat di halaman 1 dan pemakai mencentang benda yang salah.
        orderBy: { id_property: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const hasil: HalamanKandidat = {
      items: baris.map(keKandidat),
      total,
      page,
      pageSize,
    };
    return NextResponse.json(hasil);
  } catch (error) {
    console.error('[pembersihan] gagal memuat kandidat:', error);
    return NextResponse.json(
      { error: pesanErrorPembersihan(error) },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';

const ALLOWED_STATUS = ['TERSEDIA', 'TERJUAL', 'TARIK_LISTING'] as const;
type StatusEnum = (typeof ALLOWED_STATUS)[number];

/**
 * PATCH /api/listings/status
 * Body: { ids: (number|string)[]; status?: 'TERSEDIA' | 'TERJUAL' | 'TARIK_LISTING' }
 *
 * Memperbarui status_tayang banyak listing sekaligus. Default TERJUAL.
 * Bukan hard-delete: data listing tetap tersimpan (untuk riwayat closing/analitik).
 * Non-OWNER hanya bisa mengubah listing miliknya sendiri.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any).role as string | undefined;
    const agentId = (session.user as any).agentId as string | undefined;

    const body = await request.json().catch(() => null);
    const rawIds: unknown = body?.ids;
    const statusInput = String(body?.status ?? 'TERJUAL');

    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return NextResponse.json(
        { error: 'Parameter "ids" wajib diisi dan tidak boleh kosong.' },
        { status: 400 }
      );
    }

    if (!ALLOWED_STATUS.includes(statusInput as StatusEnum)) {
      return NextResponse.json(
        { error: `Status tidak valid: ${statusInput}` },
        { status: 400 }
      );
    }
    const status = statusInput as StatusEnum;

    // Konversi id ke BigInt (id_property bertipe BigInt), buang yang tidak valid.
    let ids: bigint[];
    try {
      ids = rawIds
        .map((v) => String(v).trim())
        .filter((v) => /^\d+$/.test(v))
        .map((v) => BigInt(v));
    } catch {
      ids = [];
    }

    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada id listing yang valid.' },
        { status: 400 }
      );
    }

    const isPrivileged = role === 'OWNER' || role === 'STOKER';

    if (!isPrivileged && !agentId) {
      return NextResponse.json(
        { error: 'Akun ini belum terhubung sebagai agent.' },
        { status: 403 }
      );
    }

    const where = {
      id_property: { in: ids },
      // OWNER dan STOKER bisa ubah listing siapapun; agent hanya miliknya sendiri.
      ...(!isPrivileged ? { id_agent: agentId } : {}),
    };

    const result = await prisma.listing.updateMany({
      where,
      data: { status_tayang: status, tanggal_diupdate: new Date() },
    });

    return NextResponse.json({ success: true, count: result.count, status });
  } catch (error) {
    console.error('Error updating listing status:', error);
    return NextResponse.json(
      { error: 'Gagal memperbarui status listing.' },
      { status: 500 }
    );
  }
}

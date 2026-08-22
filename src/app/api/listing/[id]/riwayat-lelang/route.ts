import { NextResponse } from "next/server";
import { getAuctionHistory } from "@/lib/auctionHistory";

export const dynamic = "force-dynamic";

/**
 * Riwayat lelang satu aset. Logika pencocokan aset ada di
 * @/lib/auctionHistory (dipakai bersama halaman detail & modul closing).
 *
 * Kontrak penting: endpoint ini TIDAK PERNAH memakai array kosong sebagai cara
 * melaporkan kegagalan. Versi lama mengembalikan `{ riwayat: [] }` saat error,
 * sehingga blok riwayat di halaman detail hilang diam-diam dan terlihat
 * "kadang muncul kadang tidak". Sekarang kegagalan dibalas status 5xx + `ok:
 * false` supaya klien bisa retry dan menampilkan status yang jujur.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const hasil = await getAuctionHistory(params.id);

    if (!hasil) {
      return NextResponse.json(
        { ok: false, error: "LISTING_TIDAK_DITEMUKAN", riwayat: [] },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        riwayat: hasil.items,
        total: hasil.total,
        total_lain: hasil.total_lain,
        total_sebidang: hasil.total_sebidang,
        total_lot_terkait: hasil.total_lot_terkait,
        match: hasil.match,
        alasan_tanpa_riwayat: hasil.alasan_tanpa_riwayat,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
        },
      }
    );
  } catch (error) {
    console.error("❌ Gagal mengambil riwayat lelang:", error);
    return NextResponse.json(
      { ok: false, error: "GAGAL_MEMUAT_RIWAYAT", riwayat: [] },
      { status: 500 }
    );
  }
}

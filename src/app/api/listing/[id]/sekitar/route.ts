/**
 * GET /api/listing/{id}/sekitar
 *
 * Satu-satunya pintu bagi browser untuk mendapat daftar "apa yang ada di
 * sekitar aset ini". Browser TIDAK LAGI memanggil Overpass sendiri: mesinnya
 * ada di server (lihat src/lib/nearbyPlaces.server.ts), hasilnya disimpan di
 * tabel `listing_sekitar`, dan kunjungan berikutnya untuk aset yang sama tidak
 * menghasilkan satu pun permintaan keluar.
 *
 * Jawaban aset yang sudah dipindai praktis gratis (satu SELECT), jadi respons
 * lengkap boleh di-cache agresif di sisi klien & CDN. Yang belum lengkap tidak
 * di-cache sama sekali — kalau tidak, jawaban sementara "belum ketemu" akan
 * menempel di browser pengunjung selama berjam-jam.
 *
 * `?ulang=1` memaksa pemindaian ulang. Hanya untuk agent yang login (tombol
 * "Pindai ulang"), dan tetap dijaga jeda di lapisan mesin — parameter di URL
 * bukan izin untuk membanjiri Overpass.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { ambilSekitar } from "@/lib/nearbyPlaces.server";

export const dynamic = "force-dynamic";
/** Pemindaian penuh (4 anak tangga radius × 2 ronde) bisa memakan waktu. */
export const maxDuration = 60;

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  let id: bigint;
  try {
    id = BigInt(params.id);
  } catch {
    return NextResponse.json({ ok: false, pesan: "id tidak sah" }, { status: 400 });
  }

  const minta = new URL(req.url).searchParams.get("ulang") === "1";
  let paksa = false;
  if (minta) {
    try {
      const sesi = await getServerSession(authOptions);
      paksa = (sesi?.user as any)?.role === "AGENT";
    } catch {
      paksa = false;
    }
  }

  const hasil = await ambilSekitar(id, { paksa });

  const res = NextResponse.json({ ok: true, ...hasil });
  res.headers.set(
    "Cache-Control",
    hasil.lengkap
      ? // Jawaban final: warung tidak pindah. Sehari di browser, seminggu boleh
        // disajikan basi sambil diperbarui di latar.
        "public, max-age=86400, stale-while-revalidate=604800"
      : "no-store",
  );
  return res;
}

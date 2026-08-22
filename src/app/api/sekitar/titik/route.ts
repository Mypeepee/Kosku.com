/**
 * GET /api/sekitar/titik?lat=&lng=
 *
 * "Apa yang ada di sekitar KOORDINAT ini" — untuk form tambah/edit properti,
 * yang butuh jawabannya sebelum listing-nya ada (jadi /api/listing/{id}/sekitar
 * belum bisa dipakai).
 *
 * KENAPA INI TIDAK MENAMBAH BEBAN. Hasilnya disimpan di tabel `sekitar_titik`
 * (lihat CACHE PER TITIK di src/lib/nearbyPlaces.server.ts), dan jalur halaman
 * detail membaca tabel yang sama sebelum memindai. Jadi pemindaian yang
 * dilakukan agent di form BUKAN pemindaian tambahan — ia justru pemindaian yang
 * seharusnya terjadi nanti, dimajukan ke saat koordinatnya sudah pasti dan
 * geocoding tidak diperlukan sama sekali.
 *
 * HANYA AGENT YANG LOGIN. Endpoint ini memanggil server publik pihak ketiga
 * (Overpass/Photon) untuk titik sembarang yang dikirim pemanggil — satu-satunya
 * di aplikasi ini yang begitu. Dibiarkan terbuka, ia jadi alat orang lain
 * membanjiri OSM atas nama domain kita.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { ambilSekitarTitik } from "@/lib/nearbyPlaces.server";

export const dynamic = "force-dynamic";
/** Pemindaian penuh (4 anak tangga radius × 2 ronde) bisa memakan waktu. */
export const maxDuration = 60;

export async function GET(req: Request) {
  const sesi = await getServerSession(authOptions).catch(() => null);
  if ((sesi?.user as any)?.role !== "AGENT") {
    return NextResponse.json(
      { ok: false, pesan: "khusus agent" },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { ok: false, pesan: "lat & lng wajib" },
      { status: 400 },
    );
  }

  // `ulang=1` memaksa pemindaian ulang titik yang sama — untuk agent yang
  // hasilnya terasa kurang. Jedanya tetap dijaga di lapisan mesin.
  const paksa = url.searchParams.get("ulang") === "1";

  const hasil = await ambilSekitarTitik(lat, lng, { paksa });

  const res = NextResponse.json({ ok: true, ...hasil });
  // Jawabannya sudah di-cache di tabel; men-cache-nya lagi di browser hanya
  // menyembunyikan hasil yang membaik saat agent menekan "pindai ulang".
  res.headers.set("Cache-Control", "no-store");
  return res;
}

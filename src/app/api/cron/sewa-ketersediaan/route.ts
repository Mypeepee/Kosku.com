// src/app/api/cron/sewa-ketersediaan/route.ts
// ---------------------------------------------------------------------------
// CRON: SINKRONISASI SISA KAMAR (harian, sesudah tengah malam)
//
// `listing_sewa_detail.kamar_tersedia` & `listing_kamar_tipe.kamar_tersedia`
// adalah kolom TURUNAN: sisa kamar HARI INI menurut `listing_ketersediaan`.
// Setiap mutasi blok sudah menghitungnya ulang — tapi ada satu perubahan yang
// tidak dipicu siapa pun: pergantian hari. Blok yang mulai berlaku hari ini,
// dan blok yang berakhir hari ini, mengubah jawabannya tanpa ada satu tombol
// pun ditekan.
//
// Tanpa cron ini, sebuah kos yang penghuninya keluar 1 September akan tetap
// menampilkan "penuh" di kartu daftar sampai ada yang kebetulan menyunting
// listingnya. Halaman detail tidak terpengaruh — ia selalu menghitung langsung
// dari tabel blok — jadi kegagalan cron ini menurunkan mutu, bukan mematahkan.
//
// Jadwal yang disarankan: sekali sehari pukul 00:05 WIB.
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//        "https://solusindoaset.com/api/cron/sewa-ketersediaan"
//
// Opsi query:
//   ?secret=XXX   → alternatif Authorization header (memudahkan tes manual)
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { hitungUlangSeluruhListingSewa } from '@/app/api/listings/_lib/sewa-availability-write';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Sengaja disamakan persis dengan /api/cron/acara-reminder: dua cron dengan
// aturan otentikasi berbeda adalah cara tercepat membuat salah satunya
// terpasang salah di cPanel dan diam-diam menolak setiap panggilan.
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Kalau CRON_SECRET belum di-set (dev), izinkan supaya mudah dites lokal.
  if (!secret) return true;
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const qs = new URL(req.url).searchParams.get('secret') || '';
  return bearer === secret || qs === secret;
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const mulai = Date.now();
    const { diperiksa, gagal } = await hitungUlangSeluruhListingSewa();
    const durasiMs = Date.now() - mulai;

    console.info(
      `[cron sewa-ketersediaan] ${diperiksa} listing diperiksa, ${gagal} gagal, ${durasiMs}ms`,
    );

    return NextResponse.json({ success: true, diperiksa, gagal, durasiMs });
  } catch (error) {
    console.error('❌ Cron sewa-ketersediaan gagal:', error);
    return NextResponse.json(
      { error: 'Gagal menyinkronkan sisa kamar.' },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;

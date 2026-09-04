// src/app/api/diagnostik/soffice/route.ts
// ---------------------------------------------------------------------------
// "Kenapa surat bisa dibuat di laptop tapi tidak di website?" — dijawab dari
// server yang bermasalah, bukan dari tebakan di laptop.
//
// Pembuatan surat memanggil biner LibreOffice (soffice) untuk mengubah .docx
// hasil template menjadi PDF. Biner itu bukan bagian dari repo dan tidak ikut
// ter-deploy: ada di macOS pengembang, tidak ada di shared cPanel. Endpoint ini
// memperlihatkan kandidat lokasi apa saja yang terlihat DARI PROSES NODE yang
// sedang melayani website — termasuk HOME dan PATH yang dilihatnya, yang sering
// berbeda dari yang dilihat sesi SSH/Terminal cPanel.
//
// PAKAI:
//   curl "https://solusindoaset.com/api/diagnostik/soffice?secret=$CRON_SECRET"
//   curl -H "Authorization: Bearer $CRON_SECRET" https://…/api/diagnostik/soffice
//
// Read-only: hanya membaca direktori dan menjalankan `soffice --version`.
//
// CATATAN: kalau endpoint ini menjawab 404 di produksi, itu SUDAH jawabannya —
// build yang sedang berjalan lebih tua daripada kode ini.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { periksaSoffice } from "@/lib/server/docxToPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function boleh(req: NextRequest): boolean {
  const rahasia = process.env.CRON_SECRET;
  // Tanpa CRON_SECRET, endpoint ini hanya hidup di luar produksi. Laporannya
  // memuat path absolut di server — bukan rahasia besar, tapi tidak perlu
  // dibuka ke publik.
  if (!rahasia) return process.env.NODE_ENV !== "production";
  if (req.nextUrl.searchParams.get("secret") === rahasia) return true;
  return req.headers.get("authorization") === `Bearer ${rahasia}`;
}

export async function GET(req: NextRequest) {
  if (!boleh(req)) {
    return NextResponse.json(
      { ok: false, message: "Butuh ?secret= atau header Authorization: Bearer <CRON_SECRET>." },
      { status: 401 },
    );
  }

  const laporan = await periksaSoffice();
  return NextResponse.json(laporan, { status: laporan.ok ? 200 : 503 });
}

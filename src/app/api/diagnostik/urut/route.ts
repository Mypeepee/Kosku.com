// src/app/api/diagnostik/urut/route.ts
// ---------------------------------------------------------------------------
// "Kenapa urutannya tidak berubah di server ini?" — dijawab dari server itu
// sendiri, bukan dari tebakan di laptop.
//
// KENAPA PERLU ENDPOINT, BUKAN CUKUP SCRIPT
// Bug yang dicari hanya muncul di database TERTENTU: urutan harga bertumpu
// pada kolom turunan `listing.harga_efektif`, yang diisi trigger + backfill
// dari prisma/migration_harga_efektif.sql — SQL manual per environment. Kalau
// langkah itu terlewat di produksi, kolomnya ada tapi kosong, dan hasilnya
// bukan error melainkan diam: "termurah" dan "termahal" mengembalikan daftar
// yang sama. Menjalankan pemeriksa di laptop (yang databasenya sehat) tidak
// akan pernah menunjukkannya.
//
// Endpoint ini menjalankan urutan yang sama persis dengan halaman daftar, lalu
// memperlihatkan tiga id teratas versi termurah & termahal. Kalau sama, kolom
// itulah tersangkanya — dan laporannya menyebutkan perintah perbaikannya.
//
// PAKAI:
//   curl "https://solusindoaset.com/api/diagnostik/urut?secret=$CRON_SECRET"
//   curl -H "Authorization: Bearer $CRON_SECRET" https://…/api/diagnostik/urut
//
// Read-only: tidak menulis apa pun. Perbaikannya dijalankan terpisah lewat
// `node scripts/periksa-urut.mjs --perbaiki` di server yang bersangkutan.
//
// CATATAN: kalau endpoint ini menjawab 404 di produksi, itu SUDAH jawabannya —
// build yang sedang berjalan lebih tua daripada kode ini, dan yang perlu
// diperbaiki adalah deploy-nya, bukan databasenya.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
// @ts-ignore — modul .mjs polos (tanpa deklarasi tipe), sengaja begitu supaya
// berkas yang sama bisa dimuat langsung oleh scripts/periksa-urut.mjs.
import { periksaUrut } from "@/lib/listingSortDiagnostik.mjs";
import { kolomHargaListing } from "@/lib/listingSortRuntime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function boleh(req: NextRequest): boolean {
  const rahasia = process.env.CRON_SECRET;
  // Tanpa CRON_SECRET, endpoint ini hanya hidup di luar produksi. Laporannya
  // memuat id listing & sebaran harga — bukan rahasia besar, tapi juga bukan
  // sesuatu yang perlu dibuka ke publik.
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

  try {
    const laporan = await periksaUrut(prisma);

    // Kolom yang SEDANG dipakai proses ini — belum tentu sama dengan yang
    // seharusnya. Kalau di sini tertulis "harga" sementara laporannya sudah
    // sehat, artinya migrasinya baru saja dijalankan dan cache per-proses
    // belum kedaluwarsa (lihat BERLAKU_* di listingSortRuntime.ts).
    const kolomDipakai = Object.fromEntries(
      await Promise.all(
        (["JUAL", "LELANG", "SEWA", "SEMUA"] as const).map(async (k) => [
          k,
          await kolomHargaListing(k),
        ]),
      ),
    );

    return NextResponse.json(
      { ...laporan, kolomDipakai, waktu: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

// src/app/api/cron/pindai-sekitar/route.ts
// ---------------------------------------------------------------------------
// CRON: PEMINDAI "DEKAT APA" OTOMATIS
//
// MASALAH YANG DIPECAHKAN. Aset hasil scraper lelang masuk tanpa data landmark
// sama sekali, dan sebelum ini satu-satunya yang memicunya adalah SESEORANG
// MEMBUKA halaman aset itu. Pemindaian pertama makan puluhan detik — jadi yang
// menanggung tunggunya adalah pengunjung pertama, yang justru sering kali klien
// yang baru saja dikirimi tautan oleh agent. Scrape 500 aset, dan 500 klien
// pertama yang menunggu.
//
// Sekarang pemindaiannya dikerjakan di latar, sebelum ada yang membukanya.
// Tidak ada tombol, tidak ada yang perlu diingat.
//
// ── KENAPA BERJATAH WAKTU, BUKAN BERJATAH JUMLAH ─────────────────────────
// Satu aset bisa selesai dalam 2 detik (titiknya sudah pernah dipindai) atau
// 70 detik (harus geocoding + seluruh tangga radius). Batas "20 aset per
// putaran" karena itu tidak berarti apa-apa: kadang 40 detik, kadang 20 menit.
// Yang dijaga di sini WAKTU — putaran berhenti begitu anggarannya habis, di
// tengah antrean sekalipun. Sisanya dikerjakan putaran berikutnya; tidak ada
// yang hilang karena kemajuannya tersimpan di tabel.
//
// ── URUTAN ANTREAN = PERMINTAAN, BUKAN ID ────────────────────────────────
// Yang didahulukan bukan aset terbaru, melainkan aset di wilayah yang KLIEN
// ANDA benar-benar cari. Scrape yang menarik 5.000 aset se-Indonesia tidak
// boleh membuat Wiyung — satu-satunya kecamatan yang dicari klien hari ini —
// mengantre di belakang Papua dan Aceh.
//
// Otomatisasi: scheduler in-process di server.js. Bisa juga manual:
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//        "https://solusindoaset.com/api/cron/pindai-sekitar"
//
// Opsi: ?detik=240 (anggaran waktu) · ?maks=40 (batas aset) · ?secret=XXX
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ambilSekitar } from "@/lib/nearbyPlaces.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Anggaran waktu satu putaran. Empat menit: cukup untuk beberapa aset yang
 *  butuh geocoding penuh, dan tetap jauh di bawah batas waktu proses mana pun. */
const ANGGARAN_DETIK = 240;

/** Rem terakhir kalau semua asetnya kebetulan cepat (titiknya sudah ada).
 *  Tanpa ini satu putaran bisa menembak Overpass ratusan kali beruntun. */
const MAKS_ASET = 40;

/** Jeda antar aset. Overpass dan Nominatim keduanya milik komunitas dan
 *  membatasi kuota; memindai tanpa jeda adalah cara tercepat untuk diblokir,
 *  dan blokirnya mengenai seluruh aplikasi, bukan cuma cron ini. */
const JEDA_MS = 1_200;

const tidur = (ms: number) => new Promise(r => setTimeout(r, ms));

function sahkan(req: NextRequest): boolean {
  const rahasia = process.env.CRON_SECRET;
  if (!rahasia) return process.env.NODE_ENV !== "production";
  const url = new URL(req.url);
  if (url.searchParams.get("secret") === rahasia) return true;
  return req.headers.get("authorization") === `Bearer ${rahasia}`;
}

type Baris = { id_property: bigint; kota: string | null; prioritas: number };

/**
 * Antrean pemindaian, diurutkan menurut PERMINTAAN.
 *
 * Prioritas 1 — kecamatan yang tertulis di preferensi klien aktif. Inilah aset
 *   yang benar-benar akan dikirim agent minggu ini.
 * Prioritas 2 — kota tempat klien mencari, meski kecamatannya berbeda.
 * Prioritas 3 — sisanya, terbaru dulu.
 *
 * Aset yang sudah punya baris `listing_sekitar` dilewati sepenuhnya: mesin
 * pemindainya sendiri yang memutuskan kapan sebuah hasil layak diulang
 * (lengkap = tidak pernah, sebagian = 7 hari), dan menduplikasi aturan itu di
 * sini akan membuat keduanya menyimpang.
 */
async function ambilAntrean(limit: number): Promise<Baris[]> {
  return prisma.$queryRaw<Baris[]>`
    WITH minat AS (
      SELECT DISTINCT
        lower(regexp_replace(coalesce(p.loc_kecamatan,''), '^(kec\\.?|kecamatan)\\s+', '', 'i')) AS kec,
        lower(regexp_replace(coalesce(p.loc_kota,''),      '^(kota|kab\\.?|kabupaten)\\s+', '', 'i')) AS kot
      FROM preferensi_klien p
      JOIN klien k ON k.id_klien = p.id_klien
      WHERE k.status NOT IN ('closing', 'lost_iseng')
    )
    SELECT l.id_property, l.kota,
      CASE
        WHEN EXISTS (SELECT 1 FROM minat m WHERE m.kec <> ''
                     AND lower(regexp_replace(coalesce(l.kecamatan,''), '^(kec\\.?|kecamatan)\\s+', '', 'i')) = m.kec) THEN 1
        WHEN EXISTS (SELECT 1 FROM minat m WHERE m.kot <> ''
                     AND lower(regexp_replace(coalesce(l.kota,''), '^(kota|kab\\.?|kabupaten)\\s+', '', 'i')) = m.kot) THEN 2
        ELSE 3
      END AS prioritas
    FROM listing l
    LEFT JOIN listing_sekitar s ON s.id_property = l.id_property
    WHERE s.id_property IS NULL
      AND l.status_tayang = 'TERSEDIA'
      AND l.bukan_properti = FALSE
    ORDER BY prioritas ASC, l.tanggal_dibuat DESC NULLS LAST
    LIMIT ${limit}
  `;
}

export async function GET(req: NextRequest) {
  if (!sahkan(req)) {
    return NextResponse.json({ ok: false, message: "Tidak diizinkan" }, { status: 401 });
  }

  const url = new URL(req.url);
  const anggaranMs = Math.min(Math.max(Number(url.searchParams.get("detik")) || ANGGARAN_DETIK, 10), 600) * 1000;
  const maks = Math.min(Math.max(Number(url.searchParams.get("maks")) || MAKS_ASET, 1), 200);

  const mulai = Date.now();
  const antrean = await ambilAntrean(maks);

  if (antrean.length === 0) {
    return NextResponse.json({ ok: true, antrean: 0, catatan: "Semua aset sudah pernah dipindai." });
  }

  let lengkap = 0, sebagian = 0, gagal = 0, diproses = 0;

  for (const b of antrean) {
    if (Date.now() - mulai > anggaranMs) break;
    diproses++;
    try {
      /* Dipanggil sebagai fungsi, bukan lewat HTTP ke diri sendiri. Panggilan
         HTTP ke localhost menambah satu lapis yang bisa gagal sendiri (port
         berubah, TLS, timeout proxy) untuk pekerjaan yang seluruhnya ada di
         proses ini. Sekaligus ikut memakai penjaga anti-dobel di dalamnya:
         kalau halaman detail kebetulan sedang memindai aset yang sama, cron
         ini menumpang hasilnya alih-alih menembak dua kali. */
      const hasil = await ambilSekitar(b.id_property);
      if (hasil.lengkap) lengkap++;
      else if ((hasil.tempat?.length ?? 0) > 0) sebagian++;
      else gagal++;
    } catch (e: any) {
      gagal++;
      console.error(`[pindai-sekitar] ${b.id_property} gagal:`, e?.message || e);
    }
    await tidur(JEDA_MS);
  }

  const sisa = await prisma.$queryRaw<[{ n: bigint }]>`
    SELECT count(*) AS n FROM listing l
    LEFT JOIN listing_sekitar s ON s.id_property = l.id_property
    WHERE s.id_property IS NULL AND l.status_tayang = 'TERSEDIA' AND l.bukan_properti = FALSE
  `;

  return NextResponse.json({
    ok: true,
    diproses,
    lengkap,
    sebagian,
    gagal,
    sisaAntrean: Number(sisa[0]?.n ?? 0),
    durasiMs: Date.now() - mulai,
  });
}

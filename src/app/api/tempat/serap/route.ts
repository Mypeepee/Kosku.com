import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { bacaTempatJson } from "@/lib/nearbyPlaces";
import { bacaLandmarkJson } from "@/lib/tempat/landmark";
import {
  bersihkanKamus,
  serapKamusDariPatokan,
  serapKamusDariPindaian,
} from "@/lib/tempat/serap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/tempat/serap — isi kamus tempat dari data yang SUDAH ada.
 *
 * Dipanggil `scripts/kamus-tempat.mjs`, tidak pernah oleh browser. Polanya
 * mengikuti `scripts/pindai-sekitar.mjs`: skripnya sengaja bodoh dan hanya
 * memanggil API aplikasi sendiri, supaya seluruh aturan kamus (kanonikalisasi
 * nama, alias, presisi, batas per kelas) tetap hidup di SATU tempat —
 * src/lib/tempat/. Skrip yang menyalin aturan itu akan perlahan berbeda darinya
 * tanpa ada yang menyadari.
 *
 * TIDAK ADA PERMINTAAN KELUAR di sini: yang dibaca adalah hasil pemindaian
 * yang tersimpan dan patokan yang diketik agent. Aman dijalankan kapan saja,
 * dan aman diulang.
 */

function berwenang(req: Request): boolean {
  const rahasia = process.env.CRON_SECRET;
  // Tanpa CRON_SECRET, endpoint hanya boleh dipakai dari mesin pengembang.
  // Membiarkannya terbuka di produksi berarti siapa pun bisa memaksa server
  // menulis puluhan ribu baris kamus.
  if (!rahasia) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${rahasia}`;
}

interface BarisPindai {
  id_property: bigint;
  latitude: unknown;
  longitude: unknown;
  sumber_titik: string | null;
  presisi_titik: string | null;
  tempat: unknown;
  landmark: unknown;
  kota: string;
  provinsi: string | null;
}

export async function POST(req: Request) {
  if (!berwenang(req)) {
    return NextResponse.json({ ok: false, message: "tidak berwenang" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const mode = String(body?.mode ?? "semua");
  const batas = Math.min(Math.max(Number(body?.limit) || 200, 1), 1000);
  const lewati = Math.max(Number(body?.offset) || 0, 0);

  const ringkas = {
    patokan: 0,
    pindai: 0,
    /** Baris pindai lama yang presisinya tidak diketahui — lihat catatan. */
    tanpaPresisi: 0,
  };

  try {
    if (mode === "patokan" || mode === "semua") {
      /**
       * SQL mentah, bukan filter Prisma.
       *
       * Kolom `akses_terdekat` bertipe Json nullable, dan di Prisma "bukan
       * NULL" untuk kolom seperti itu punya tiga arti berbeda (DbNull /
       * JsonNull / AnyNull) yang mudah tertukar — sementara yang benar-benar
       * dibutuhkan di sini bukan itu, melainkan "array yang ADA ISINYA".
       * Baris ber-`[]` lolos semua varian filter null tadi lalu diserap
       * sebagai nol patokan: kerja sia-sia untuk puluhan ribu baris.
       */
      const baris = await prisma.$queryRaw<
        Array<{
          id_property: bigint;
          akses_terdekat: unknown;
          kota: string;
          provinsi: string | null;
        }>
      >`
        SELECT id_property, akses_terdekat, kota, provinsi
        FROM listing
        WHERE akses_terdekat IS NOT NULL
          AND jsonb_typeof(akses_terdekat::jsonb) = 'array'
          AND jsonb_array_length(akses_terdekat::jsonb) > 0
        ORDER BY id_property ASC
        OFFSET ${lewati} LIMIT ${batas}
      `;

      for (const l of baris) {
        await serapKamusDariPatokan(l.id_property, l.akses_terdekat, {
          kota: l.kota,
          provinsi: l.provinsi,
        });
        ringkas.patokan++;
      }
    }

    if (mode === "pindai" || mode === "semua") {
      const baris = await prisma.$queryRaw<BarisPindai[]>`
        SELECT s.id_property, s.latitude, s.longitude, s.sumber_titik,
               s.presisi_titik, s.tempat, s.landmark, l.kota, l.provinsi
        FROM listing_sekitar s
        JOIN listing l ON l.id_property = s.id_property
        WHERE s.lengkap = TRUE
        ORDER BY s.id_property ASC
        OFFSET ${lewati} LIMIT ${batas}
      `;

      for (const b of baris) {
        const lat = Number(b.latitude);
        const lng = Number(b.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        /**
         * Presisi baris lama.
         *
         * Titik ber-sumber LISTING selalu berarti agent menandainya sendiri di
         * peta — itu bisa disimpulkan dengan aman. Titik hasil GEOCODE tidak:
         * ia bisa setepat nomor rumah atau sekasar tengah kota, dan kolom yang
         * mencatatnya baru ada sekarang. Menebaknya "ALAMAT" persis kesalahan
         * yang kolom itu ada untuk mencegah, jadi barisnya DILEWATI dan
         * dihitung — pemindaian ulang akan mengisinya dengan benar.
         */
        const presisi =
          b.presisi_titik ?? (b.sumber_titik === "LISTING" ? "TITIK" : null);
        if (!presisi) {
          ringkas.tanpaPresisi++;
          continue;
        }

        await serapKamusDariPindaian(
          b.id_property,
          { lat, lng, presisi },
          bacaLandmarkJson(b.landmark),
          bacaTempatJson(b.tempat),
          { kota: b.kota, provinsi: b.provinsi },
        );
        ringkas.pindai++;
      }
    }

    /**
     * Perawatan dijalankan sebagai mode TERSENDIRI, bukan di ujung setiap
     * batch: ia menyentuh seluruh tabel, dan mengulanginya setiap 200 baris
     * berarti membayar biaya penuh berkali-kali untuk hasil yang sama.
     */
    if (mode === "bersihkan") {
      const hasil = await bersihkanKamus();
      return NextResponse.json({ ok: true, ...ringkas, ...hasil });
    }

    return NextResponse.json({ ok: true, ...ringkas });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: err?.message ?? "Server error" },
      { status: 500 },
    );
  }
}

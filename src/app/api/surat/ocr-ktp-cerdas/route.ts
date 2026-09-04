/**
 * POST /api/surat/ocr-ktp-cerdas — baca foto KTP jadi field terstruktur.
 *
 * Bedanya dengan `/api/surat/ocr-ktp` yang lama: route ini memakai mesin dua
 * lajur di `src/lib/server/ktpReader.ts` (model penglihatan + OCR, lalu NIK
 * sebagai hakim), sehingga field tidak lagi ditentukan semata oleh posisi
 * titik dua di tiap baris. Route lama sengaja DIBIARKAN utuh: empat modal
 * surat lain masih memanggilnya, dan tidak ada alasan mengganggunya di sini.
 *
 * Balasannya sengaja "datar" (data + status + peringatan) supaya modal cukup
 * menyalin ke form; keputusan benar/salah tetap di tangan manusia yang
 * melihat hasilnya, bukan di route ini.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { bacaKtp } from "@/lib/server/ktpReader";

export const runtime = "nodejs";
export const maxDuration = 60;

const MIME_SAH = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAKS_BYTE = 15 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ detail: "File KTP wajib diunggah." }, { status: 400 });
    }
    if (!MIME_SAH.includes(file.type.toLowerCase())) {
      return NextResponse.json(
        { detail: "Format harus gambar (JPG, PNG, WEBP, atau HEIC)." },
        { status: 400 },
      );
    }
    if (file.size > MAKS_BYTE) {
      return NextResponse.json({ detail: "Ukuran file maksimal 15 MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const hasil = await bacaKtp(buffer, file.type.toLowerCase());

    // Blok diagnostik memuat SALINAN PENUH KTP orang (transkrip mentah + hasil
    // tiap lajur). Ia tidak pernah ikut ke browser dalam pemakaian biasa;
    // `?debug=1` hanya untuk menala mesin pembacaan di data sungguhan, dan
    // tetap menuntut sesi login seperti permintaan lainnya.
    const debug = new URL(req.url).searchParams.get("debug") === "1";
    if (debug) return NextResponse.json(hasil);

    const { diagnostik: _rahasia, ...bersih } = hasil;
    void _rahasia;
    return NextResponse.json(bersih);
  } catch (err) {
    console.error("[ocr-ktp-cerdas]", err);
    const pesan = (err as Error)?.message ?? "";
    if (pesan.includes("GOOGLE_APPLICATION_CREDENTIALS") || pesan.includes("GEMINI_API_KEY")) {
      return NextResponse.json(
        { detail: "Mesin pembaca KTP belum dikonfigurasi di server ini." },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { detail: "Gagal membaca KTP — coba unggah ulang dengan foto yang lebih terang dan tidak terpotong." },
      { status: 500 },
    );
  }
}

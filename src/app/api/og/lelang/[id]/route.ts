// src/app/api/og/lelang/[id]/route.ts
// Sajikan gambar Open Graph untuk listing Lelang dari domain sendiri.
//
// Kenapa perlu: crawler WhatsApp/Facebook mengambil `og:image` dari server Meta
// (luar negeri) dengan timeout beberapa detik saja. Foto listing tersimpan di
// host pihak ketiga — Google Drive atau file.lelang.go.id — yang lambat, pakai
// proteksi hotlink, atau menolak koneksi dari luar Indonesia. Akibatnya preview
// WA muncul tanpa gambar. Route ini mengambil foto server-side (server kita bisa
// menjangkau host tsb), menormalkannya jadi JPEG 1200×630 yang ringan, lalu
// menyajikannya dari solusindoaset.com dengan cache — sehingga crawler selalu
// dapat gambar yang cepat & valid.
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import prisma from "@/lib/prisma";
/* Teknik pengambilannya dipakai bersama dengan /api/foto/[id] (proxy foto
   untuk email). Disatukan dengan sengaja: keduanya menghadapi proteksi hotlink
   file.lelang.go.id yang sama, dan salinan kedua akan tertinggal saat aturan
   host itu berubah — lalu gambar menghilang di satu permukaan saja. */
import { resolveFetchableImage, fetchImageBytes } from "@/lib/fotoListing";

export const runtime = "nodejs";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
let fallbackCache: Buffer | null = null;
async function loadFallback(): Promise<Buffer> {
  if (!fallbackCache) {
    fallbackCache = await readFile(
      path.join(process.cwd(), "public", "images", "hero", "banner.jpg"),
    );
  }
  return fallbackCache;
}

function toBigIntId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

async function toOgJpeg(source: Buffer): Promise<Buffer> {
  return sharp(source)
    .resize(OG_WIDTH, OG_HEIGHT, { fit: "cover", position: "attention" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = toBigIntId(params.id);

  let source: Buffer | null = null;
  if (id != null) {
    const listing = await prisma.listing.findUnique({
      where: { id_property: id },
      select: { gambar: true },
    });
    const src = resolveFetchableImage(listing?.gambar, OG_WIDTH);
    if (src) source = await fetchImageBytes(src);
  }
  if (!source) source = await loadFallback();

  let out: Buffer;
  try {
    out = await toOgJpeg(source);
  } catch {
    // Sumber korup/format tak didukung → jamin tetap balas gambar valid.
    out = await toOgJpeg(await loadFallback());
  }

  return new NextResponse(out as any, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(out.length),
      // WA meng-cache preview per-URL cukup lama; izinkan CDN/browser cache juga.
      "Cache-Control":
        "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
    },
  });
}

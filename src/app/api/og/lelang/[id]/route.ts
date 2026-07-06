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

export const runtime = "nodejs";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const FETCH_TIMEOUT_MS = 8000;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Ubah nilai kolom `gambar` (URL penuh, atau Google Drive file-id, dipisah koma)
// menjadi URL yang bisa di-fetch server-side. null → pakai fallback banner.
function resolveFetchableImage(gambar: string | null | undefined): string | null {
  if (!gambar) return null;
  const first = gambar
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)[0];
  if (!first) return null;
  if (first.startsWith("http://") || first.startsWith("https://")) return first;
  if (first.startsWith("/")) return null; // aset lokal → fallback banner
  // Selain itu anggap Google Drive file-id.
  return `https://drive.google.com/thumbnail?id=${first}&sz=w1200`;
}

async function fetchImageBytes(src: string): Promise<Buffer | null> {
  const headers: Record<string, string> = { "User-Agent": BROWSER_UA };
  try {
    // Sebagian host (mis. file.lelang.go.id) memblokir hotlink → kirim Referer
    // seakan-akan permintaan datang dari host itu sendiri.
    const u = new URL(src);
    headers["Referer"] = `${u.protocol}//${u.host}/`;
  } catch {}
  try {
    const res = await fetch(src, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (ct && !ct.startsWith("image/")) return null; // halaman error HTML, dll.
    const ab = await res.arrayBuffer();
    if (ab.byteLength === 0) return null;
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

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
    const src = resolveFetchableImage(listing?.gambar);
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

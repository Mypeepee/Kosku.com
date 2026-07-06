import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import type { JualPosterData } from "@/lib/jualPoster";
import { renderStoryPoster } from "@/lib/server/posterRender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "public",
  "templates",
  "katalog-primary-secondary_Solusindo.html",
);

let templateCache: string | null = null;
async function getTemplate(): Promise<string> {
  if (!templateCache) templateCache = await readFile(TEMPLATE_PATH, "utf8");
  return templateCache;
}

export async function POST(req: NextRequest) {
  let data: JualPosterData;
  try {
    data = (await req.json()) as JualPosterData;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!data || typeof data.judul !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const html = await getTemplate();

    // Template ini mengisi datanya sendiri lewat window.renderKatalog(d).
    // Tunggu library QR siap, lalu render ulang dengan data asli.
    const buffer = await renderStoryPoster(html, async (page) => {
      try {
        await page.waitForFunction("typeof window.qrcode !== 'undefined'", {
          timeout: 8000,
        });
      } catch {
        // QR gagal dimuat → poster tetap dibuat tanpa QR.
      }
      await page.evaluate((d: JualPosterData) => {
        (window as any).renderKatalog(d);
      }, data);
    });

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": 'attachment; filename="poster-properti.jpg"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[poster/jual] gagal render:", err);
    return NextResponse.json({ error: "Gagal membuat poster" }, { status: 500 });
  }
}

// src/lib/server/posterRender.ts
// Render satu "story poster" 1080×1920 dari HTML menjadi JPEG via Puppeteer.
// Dipakai bersama oleh /api/poster/lelang & /api/poster/jual.
// SERVER-ONLY — jangan diimpor dari komponen klien (menarik puppeteer).

// Kualitas JPEG: seimbang antara jelas & ukuran file.
// (JPEG q82 @2160×3840 ≈ 600KB, vs PNG ≈ 3MB — jauh lebih ringan untuk agent.)
export const POSTER_JPEG_QUALITY = 82;

// Skala 2× dari 1080×1920 → 2160×3840 (retina, teks & QR tajam).
const DEVICE_SCALE_FACTOR = 2;

const LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
];

// Dijalankan di dalam halaman: tunggu font & semua gambar, dengan batas per-resource
// supaya satu foto lambat/rusak tidak menggantung proses.
async function waitAssets(): Promise<void> {
  const cap = (p: Promise<unknown>, ms: number) =>
    Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
  const imgs = Array.from(document.images).map((img) =>
    img.complete && img.naturalWidth > 0
      ? Promise.resolve()
      : cap(
          new Promise<void>((res) => {
            img.addEventListener("load", () => res(), { once: true });
            img.addEventListener("error", () => res(), { once: true });
          }),
          9000,
        ),
  );
  await Promise.all([
    cap((document as any).fonts?.ready ?? Promise.resolve(), 5000),
    ...imgs,
  ]);
}

/**
 * Render HTML poster jadi buffer JPEG.
 * @param html  HTML lengkap (sudah berisi data).
 * @param prepare  opsional — dipanggil setelah DOM siap, sebelum menunggu aset.
 *                 Berguna untuk template yang mengisi datanya via JS (mis. Jual:
 *                 `window.renderKatalog(data)`).
 */
export async function renderStoryPoster(
  html: string,
  prepare?: (page: any) => Promise<void>,
): Promise<Buffer> {
  const puppeteer = await import("puppeteer");
  let browser: any;
  try {
    browser = await puppeteer.default.launch({ headless: true, args: LAUNCH_ARGS });
    const page = await browser.newPage();
    await page.setViewport({
      width: 1080,
      height: 1920,
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
    });
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30_000 });

    if (prepare) await prepare(page);

    try {
      await page.evaluate(waitAssets);
    } catch {}

    const el = await page.$(".story-frame");
    const buffer: Buffer = el
      ? ((await el.screenshot({ type: "jpeg", quality: POSTER_JPEG_QUALITY })) as Buffer)
      : ((await page.screenshot({
          type: "jpeg",
          quality: POSTER_JPEG_QUALITY,
          clip: { x: 0, y: 0, width: 1080, height: 1920 },
        })) as Buffer);

    return buffer;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
  }
}

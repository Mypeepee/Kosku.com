import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import prisma from "@/lib/prisma";
import { GoogleDriveService } from "@/lib/services/google-drive.service";
import { scrapeJobManager, type LogEvent } from "@/lib/scrape-job";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Folder Drive khusus lampiran PDF lelang
const LAMPIRAN_FOLDER_ID = "1yMtRi1DbiINlGSFzHzGj-MT8f7C-UANJ";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 200);
}

function mapKategori(tipe: string): string {
  const map: Record<string, string> = {
    rumah: "RUMAH", apartemen: "APARTEMEN", ruko: "RUKO", tanah: "TANAH",
    gudang: "GUDANG", "hotel dan villa": "HOTEL_DAN_VILLA", toko: "TOKO",
    pabrik: "PABRIK", "lain-lain": "RUMAH",
  };
  return map[tipe.toLowerCase()] ?? "RUMAH";
}

function mapLegalitas(s: string | null): string | null {
  if (!s) return null;
  const u = s.toUpperCase();
  if (u.includes("SHM")) return "SHM";
  if (u.includes("HGB")) return "HGB";
  if (u.includes("HGU")) return "HGU";
  if (u.includes("STRATA")) return "STRATA_TITLE";
  if (u.includes("PPJB")) return "PPJB";
  if (u.includes("AJB")) return "AJB";
  if (u.includes("HP") || u.includes("HAK PAKAI")) return "HP";
  return "LAINNYA";
}

function parseTanggal(raw: string | null): Date | null {
  if (!raw) return null;
  try {
    const bulan: Record<string, number> = {
      januari: 1, februari: 2, pebruari: 2, maret: 3, april: 4, mei: 5,
      juni: 6, juli: 7, agustus: 8, september: 9, oktober: 10,
      nopember: 11, november: 11, desember: 12,
    };
    let s = raw.replace(/\b(pukul|jam|wib|wita|wit)\b\.?:?/gi, "").replace(/,/g, " ").replace(/\s+/g, " ").trim();
    const m = s.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    if (m) {
      const bl = bulan[m[2].toLowerCase()];
      if (bl) {
        const t = s.match(/(\d{1,2})[.:](\d{2})/);
        return new Date(+m[3], bl - 1, +m[1], t ? +t[1] : 23, t ? +t[2] : 59);
      }
    }
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}

function extractKota(judul: string, alamat: string): string {
  const jm = judul.match(/\bdi\s+(Kota(?:\s+Adm(?:inistrasi)?\.?)?|Kab(?:\.|upaten)?)\s+([A-Za-z.\s]+?)(?=[,;.]|$)/i);
  if (jm) {
    const lbl = jm[1].toLowerCase();
    const nama = jm[2].trim().replace(/\s+\b(Prov|Prop|Kec|Kab|Kota)\b.*/i, "").trim();
    if (lbl.includes("adm")) return `Kota Adm. ${nama}`;
    if (lbl.includes("kota")) return `Kota ${nama}`;
    return `Kab. ${nama}`;
  }
  const am = alamat.match(/\b(Kota|Kabupaten|Kab\.?)\s+([A-Za-z\s]+?)(?=,|\.|Kec|Prov|$)/i);
  if (am) return `${am[1]} ${am[2].trim()}`;
  // Ambil KAB dari alamat teks: "KEC KABAT KAB BANYUWANGI"
  const kabM = alamat.match(/\bKAB\s+([A-Z][A-Za-z\s]+?)(?:\s+PROV|\s*$)/i);
  if (kabM) return `Kab. ${kabM[1].trim()}`;
  return "Tidak Diketahui";
}

interface WilayahParsed {
  provinsi: string | null;
  kecamatan: string | null;
  kelurahan: string | null;
}

function parseWilayahFromAlamat(alamat: string): WilayahParsed {
  if (!alamat) return { provinsi: null, kecamatan: null, kelurahan: null };

  const s = alamat.replace(/\s+/g, " ").trim();

  const clean = (v: string | undefined): string | null => {
    if (!v) return null;
    return v
      .trim()
      .replace(/\s*\([^)]*\)/g, "")   // hilangkan "(dahulu ...)" dll
      .replace(/\s+/g, " ")
      .replace(/\s*\d{5}\s*$/, "")     // hilangkan kode pos di akhir
      .replace(/[,.\s]+$/, "")
      .trim() || null;
  };

  // Stop boundary: koma/titik/kurung, kode pos 5 digit, atau keyword admin berikutnya
  const KW_STOP =
    "(?=\\s*[,.(]|\\s*\\d{5}|\\s+(?:Kec(?:amatan)?|Kab(?:upaten)?|Kota\\b|Prov(?:insi)?|Propinsi|Prop\\b)|\\s*$)";

  // ── Provinsi ──
  const provRe = new RegExp(
    `(?:Provinsi|Propinsi|Prov\\.?|Prop\\.?)\\s+([A-Za-z][A-Za-z\\s]+?)${KW_STOP}`,
    "i"
  );
  const provinsi = clean(s.match(provRe)?.[1]);

  // ── Kecamatan ──
  const kecRe = new RegExp(
    `(?:Kecamatan|Kec\\.?)\\s+([A-Za-z0-9][A-Za-z0-9\\s]+?)${KW_STOP}`,
    "i"
  );
  const kecamatan = clean(s.match(kecRe)?.[1]);

  // ── Kelurahan / Desa ──
  const kelRe = new RegExp(
    `(?:Desa\\/Kelurahan|Desa\\/Kel\\.|Kelurahan|Kel\\.?|Desa|DS\\.?)\\s+([A-Za-z0-9][A-Za-z0-9\\s]+?)${KW_STOP}`,
    "i"
  );
  const kelurahan = clean(s.match(kelRe)?.[1]);

  return { provinsi, kecamatan, kelurahan };
}

function extractLuas(teks: string): number | null {
  // Dari "Luas: 3270 M²" atau judul "105 m2"
  const m = teks.match(/(?:Luas[:\s]+)?(\d+(?:[.,]\d+)?)\s*[Mm](?:2|²)/);
  if (!m) return null;
  return Math.floor(parseFloat(m[1].replace(",", ".")));
}

function sseMsg(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

// ─── Main route ───────────────────────────────────────────────────────────────

// ─── Scrape worker ───────────────────────────────────────────────────────────
// Dijalankan di background (tidak terikat ke koneksi HTTP). Cancel cuma lewat
// scrapeJobManager.cancel() → diset oleh endpoint /stop. Disconnect client
// (navigate away) TIDAK pernah mencancel — itulah inti perbaikan.
async function runScrapeJob(
  agentId: string,
  kategori: string,
  startPage: number,
) {
  const push = (data: LogEvent) => scrapeJobManager.push(data);
  const isCancelled = () =>
    scrapeJobManager.current?.cancelled === true;

  let browser: any = null;

  try {
    const puppeteer = await import("puppeteer");
    push({ type: "log", msg: "Membuka browser..." });

      browser = await puppeteer.default.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
      });

      const baseUrl = "https://lelang.go.id";
      let page = startPage;
      let totalSaved = 0;
      let totalSkipped = 0;

      const existingLinks = await prisma.listing.findMany({
        where: { link: { not: null } },
        select: { link: true },
      });
      const existingSet = new Set(existingLinks.map((l) => l.link!.trim()));
      push({ type: "log", msg: `${existingSet.size} listing sudah ada di DB.` });

      while (true) {
        if (isCancelled()) { console.log("[scrape] cancelled by user, stop page loop"); break; }
        const listUrl = `${baseUrl}/lot-lelang/katalog-lot-lelang?kategori=${encodeURIComponent(kategori)}&page=${page}`;
        push({ type: "log", msg: `Halaman ${page}: ${listUrl}` });

        const tab = await browser.newPage();
        await tab.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36");

        let pageLinks: string[] = [];
        try {
          await tab.goto(listUrl, { waitUntil: "networkidle2", timeout: 60000 });
          await tab.waitForFunction(
            `document.querySelectorAll('a[href*="/detail-auction/"]').length > 0`,
            { timeout: 20000 }
          ).catch(() => {});

          pageLinks = await tab.evaluate((base: string) => {
            const links = Array.from(document.querySelectorAll('a[href*="/detail-auction/"]'));
            return [...new Set(links.map((a: any) => (base + a.getAttribute("href")).replace(/\/+$/, "")))];
          }, baseUrl);
        } catch {
          push({ type: "log", msg: `Halaman ${page}: tidak ada data. Stop.` });
          break;
        } finally {
          await tab.close();
        }

        if (pageLinks.length === 0) {
          push({ type: "log", msg: `Halaman ${page}: tidak ada link, selesai.` });
          break;
        }

        push({ type: "log", msg: `Halaman ${page}: ${pageLinks.length} listing.` });

        const newLinks = pageLinks.filter((u) => !existingSet.has(u));
        const skipped = pageLinks.length - newLinks.length;
        if (skipped > 0) {
          push({ type: "log", msg: `  ↳ ${skipped} sudah ada, skip.` });
          totalSkipped += skipped;
        }

        if (newLinks.length === 0) {
          page++;
          continue;
        }

        for (const detailUrl of newLinks) {
          if (isCancelled()) { console.log("[scrape] cancelled by user, stop detail loop"); break; }
          push({ type: "log", msg: `  Scraping: ${detailUrl}` });

          const detailTab = await browser.newPage();
          await detailTab.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36");

          try {
            await detailTab.goto(detailUrl, { waitUntil: "networkidle2", timeout: 90000 });

            // Tunggu judul muncul
            await detailTab.waitForFunction(
              `document.querySelector("h3") !== null && document.body.textContent.trim().length > 500`,
              { timeout: 25000 }
            ).catch(() => {});

            // Tunggu section "Bukti Kepemilikan" — STRICT: label + sibling non-empty
            // (Tidak boleh exit cuma karena teks "SHM" muncul di breadcrumb/dropdown.)
            await detailTab.waitForFunction(
              `(() => {
                const labels = Array.from(document.querySelectorAll('div')).filter(el =>
                  el.children.length === 0 &&
                  /^Bukti\\s*Kepemilikan$/i.test((el.textContent || '').trim())
                );
                if (labels.length === 0) return false;
                return labels.some(lbl => {
                  const parent = lbl.parentElement;
                  if (!parent) return false;
                  const kids = Array.from(parent.children);
                  const idx = kids.indexOf(lbl);
                  for (let i = idx + 1; i < kids.length; i++) {
                    const t = (kids[i].textContent || '').trim();
                    if (t.length > 2) return true;
                  }
                  return false;
                });
              })()`,
              { timeout: 30000 }
            ).catch(() => {});

            // Extra wait agar konten lazy / client-side render selesai
            await new Promise((r) => setTimeout(r, 1500));

            // Scroll halaman + galeri agar lazy-load gambar ter-trigger
            await detailTab.evaluate(async () => {
              // Scroll seluruh halaman dulu
              window.scrollTo(0, Math.floor(document.body.scrollHeight * 0.4));
              await new Promise((r) => setTimeout(r, 300));
              window.scrollTo(0, document.body.scrollHeight);
              await new Promise((r) => setTimeout(r, 400));
              window.scrollTo(0, 0);
              await new Promise((r) => setTimeout(r, 200));

              // Scroll galeri horizontal
              const el = document.querySelector("div.scrollbar-hide");
              if (el) {
                for (let x = 0; x <= (el as HTMLElement).scrollWidth; x += 200) {
                  (el as HTMLElement).scrollLeft = x;
                  await new Promise((r) => setTimeout(r, 100));
                }
              }

              // Force-load gambar yang lazy (data-src / data-lazy / data-original)
              document.querySelectorAll<HTMLImageElement>("img[data-src]").forEach((img) => {
                if (!img.src || img.src === window.location.href) img.src = img.dataset.src!;
              });
              document.querySelectorAll<HTMLImageElement>("img[data-lazy]").forEach((img) => {
                if (!img.src || img.src === window.location.href) img.src = img.dataset.lazy!;
              });
              document.querySelectorAll<HTMLImageElement>("img[data-original]").forEach((img) => {
                if (!img.src || img.src === window.location.href) img.src = img.dataset.original!;
              });
            });
            await new Promise((r) => setTimeout(r, 1200));

            // ── Ambil semua data detail ──────────────────────────────────────
            const data = await detailTab.evaluate(() => {
              // ── Judul ──
              const judul =
                document.querySelector("h3.mb-5.text-2xl")?.textContent?.trim() ||
                document.querySelector("h3.text-2xl")?.textContent?.trim() ||
                document.querySelector("h3")?.textContent?.trim() ||
                null;

              // ── Gambar (dengan fallback lazy-load attributes) ──
              const imgs = (() => {
                const seen = new Set<string>();
                const tryAdd = (url: string | null | undefined) => {
                  const u = url?.trim();
                  if (u && u.startsWith("https://file.lelang.go.id/") && !seen.has(u)) seen.add(u);
                };
                // Primary: gallery container
                document.querySelectorAll<HTMLImageElement>("div.scrollbar-hide img").forEach((img) => {
                  tryAdd(img.src);
                  tryAdd(img.dataset?.src);
                  tryAdd(img.getAttribute("data-src"));
                  tryAdd(img.getAttribute("data-lazy"));
                  tryAdd(img.getAttribute("data-original"));
                });
                // Fallback: semua img di halaman
                if (seen.size === 0) {
                  document.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
                    tryAdd(img.src);
                    tryAdd(img.dataset?.src);
                    tryAdd(img.getAttribute("data-src"));
                    tryAdd(img.getAttribute("data-lazy"));
                  });
                }
                return [...seen].slice(0, 7);
              })();

              // ── Harga (nilai limit & jaminan) ──
              const priceEls = document.querySelectorAll("h6.text-primary-500");
              const parseRp = (el: Element | null) =>
                el ? parseInt(el.textContent!.replace(/[^\d]/g, "")) || 0 : 0;
              const nilaiLimit = parseRp(priceEls[0] ?? null);
              const uangJaminan = parseRp(priceEls[1] ?? null);

              // ── Info teks (penjual, tanggal) ──
              const infoEls = Array.from(document.querySelectorAll("h6.text-ternary-gray-200"));
              const getText = (i: number) => infoEls[i]?.textContent?.trim() ?? null;
              const penjual = getText(0);
              const batasPenawaran = getText(1);
              const batasJaminan = (() => {
                const labels = Array.from(document.querySelectorAll("p, span, div, h6, label"))
                  .filter((el) => /batas.*(jaminan|setor)/i.test(el.textContent ?? ""));
                for (const lbl of labels) {
                  const sib = lbl.nextElementSibling ?? lbl.parentElement?.nextElementSibling;
                  const txt = sib?.textContent?.trim();
                  if (txt && /\d{4}/.test(txt)) return txt;
                }
                return getText(4) ?? getText(3) ?? null;
              })();

              // ── Sertifikat & Nomor Legalitas ────────────────────────────────
              const { sertifikat: detectedType, nomorLegalitas } = (() => {
                const CERT_TYPE_RE = /\b(SHM|SHGB|HGB|HPL|HP|HAK\s*PAKAI|HAK\s*MILIK)\b/i;
                let primaryType: string | null = null;
                const allNumbers: string[] = [];
                const seenNums = new Set<string>();
                const addNum = (n: string) => {
                  let c = n.trim().replace(/[.,;:]+$/, "");
                  // Strip suffix kode kelurahan/desa setelah "/" — user hanya minta nomor.
                  // Contoh: "09/WGb" → "09", "590/W.Gb" → "590", "00254/Belimbing" → "00254"
                  const slashIdx = c.indexOf("/");
                  if (slashIdx >= 0) c = c.substring(0, slashIdx).trim();
                  if (c && !seenNums.has(c)) { allNumbers.push(c); seenNums.add(c); }
                };

                // Parse satu blok teks → ekstrak tipe sertifikat & nomornya.
                // Pola valid: "SHM No: 09/WGb", "HGB No.: 1234", "SHGB No 05", "SHM 09/WGb",
                //   plus variasi: "Sertifikat Hak Milik", "Sertipikat" (ejaan lama),
                //   "S.H.M" (dotted), "Hak Milik Atas Satuan Rumah Susun" (strata).
                const parseCertText = (raw: string): boolean => {
                  if (!raw) return false;

                  // Normalisasi: collapse semua variasi penulisan tipe ke token kanonik
                  // sebelum di-regex. Urutan penting: yang lebih panjang dulu.
                  const text = raw
                    .replace(/\bHak\s+Milik\s+Atas\s+Satuan\s+Rumah\s+Susun\b/gi, "STRATA")
                    .replace(/\bSerti[fp]ikat\s+Hak\s+Milik\b/gi, "SHM")
                    .replace(/\bSerti[fp]ikat\s+Hak\s+Guna\s+Bangunan\b/gi, "SHGB")
                    .replace(/\bSerti[fp]ikat\s+Hak\s+Pakai\b/gi, "HP")
                    .replace(/\bS\.?\s*H\.?\s*G\.?\s*B\.?\b/gi, "SHGB")
                    .replace(/\bS\.?\s*H\.?\s*M\.?\b/gi, "SHM");

                  // Pattern A: <TYPE> [No/Nomor][./:]? <NUMBER>
                  const m1 = text.match(
                    /\b(SHM|SHGB|HGB|HPL|HP|STRATA|HAK\s*PAKAI|HAK\s*MILIK)\b\s*(?:No\.?|Nomor)\s*[:.]?\s*([0-9]+(?:\/[A-Za-z0-9.\-]+)?)/i
                  );
                  if (m1) {
                    if (!primaryType) primaryType = m1[1].replace(/\s+/g, "").toUpperCase();
                    addNum(m1[2]);
                    return true;
                  }
                  // Pattern B: <TYPE> <NUMBER> (space, tanpa No/Nomor)
                  const m2 = text.match(
                    /\b(SHM|SHGB|HGB|HPL|HP|STRATA)\b\s+([0-9]+(?:\/[A-Za-z0-9.\-]+)?)\b/i
                  );
                  if (m2) {
                    if (!primaryType) primaryType = m2[1].replace(/\s+/g, "").toUpperCase();
                    addNum(m2[2]);
                    return true;
                  }
                  // Pattern C: type-only (kalau tipe muncul tanpa nomor di string ini)
                  if (!primaryType) {
                    const tm = text.match(
                      /\b(SHM|SHGB|HGB|HPL|HP|STRATA|HAK\s*PAKAI|HAK\s*MILIK)\b/i
                    );
                    if (tm) {
                      primaryType = tm[1].replace(/\s+/g, "").toUpperCase();
                      return true;
                    }
                  }
                  return false;
                };

                // ── Strategi 0 (PRIMARY): Label "Bukti Kepemilikan" → siblings ──
                // Struktur eksplisit yang dipakai lelang.go.id:
                //   div.grid.grid-cols-1.gap-5.md:grid-cols-3.md:grid-cols-4
                //     └ div.flex.w-full.flex-col           ← kolom Bukti Kepemilikan
                //         ├ div.mb-3.text-sm.font-bold    "Bukti Kepemilikan"
                //         ├ div.text-xs                   "SHM No. 02007 No:"  ← tipe + nomor
                //         └ div.text-xs                   "26 Jan 1998"        ← tanggal
                // Scope sempit (cuma siblings label) → aman parse lenient,
                // dan iterasi semua text-xs (tanpa break) → support multi-bidang.
                const buktiLabels = Array.from(
                  document.querySelectorAll<HTMLElement>("div")
                ).filter(
                  (el) =>
                    el.children.length === 0 &&
                    /^Bukti\s*Kepemilikan$/i.test((el.textContent || "").trim())
                );

                for (const lbl of buktiLabels) {
                  const parent = lbl.parentElement; // div.flex.w-full.flex-col
                  if (!parent) continue;

                  // (a) Query semua text-xs di kolom ini (handle nested bidang)
                  const textXs = Array.from(
                    parent.querySelectorAll<HTMLElement>("div.text-xs, div[class*='text-xs']")
                  );
                  const textXsRaws = textXs
                    .map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim())
                    .filter(Boolean);
                  for (const raw of textXsRaws) parseCertText(raw);

                  // (b) Combined parse — handle type & number split across siblings
                  //     contoh: div 1 = "SHM", div 2 = "No. 02007"
                  //     Trigger kapanpun salah satu masih kosong (bukan hanya kedua-duanya).
                  if ((!primaryType || allNumbers.length === 0) && textXsRaws.length > 1) {
                    parseCertText(textXsRaws.join(" "));
                  }

                  // (c) Direct children fallback (untuk struktur yang tidak pakai text-xs)
                  if (!primaryType || allNumbers.length === 0) {
                    const kids = Array.from(parent.children);
                    const idx = kids.indexOf(lbl);
                    const sibTexts: string[] = [];
                    for (let i = idx + 1; i < kids.length; i++) {
                      const t = (kids[i] as HTMLElement).textContent
                        ?.replace(/\s+/g, " ")
                        .trim() ?? "";
                      if (t) sibTexts.push(t);
                    }
                    for (const t of sibTexts) parseCertText(t);
                    if ((!primaryType || allNumbers.length === 0) && sibTexts.length > 0) {
                      parseCertText(sibTexts.join(" "));
                    }
                  }

                  // (d) Last resort: parent textContent (include label, full)
                  if (!primaryType || allNumbers.length === 0) {
                    const full = (parent.textContent ?? "").replace(/\s+/g, " ").trim();
                    if (full) parseCertText(full);
                  }

                  // (e) Type ada tapi nomor null → scan standalone number,
                  //     skip teks yang tampak tanggal (e.g., "26 Jan 1998")
                  if (primaryType && allNumbers.length === 0) {
                    const DATE_RE =
                      /\b\d{1,2}\s+(jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des)[a-z]*\.?\s*\d{0,4}\b/i;
                    for (const t of textXsRaws) {
                      if (DATE_RE.test(t)) continue;
                      const cleaned = t.replace(DATE_RE, " ");
                      const nm = cleaned.match(/\b(\d{2,7}(?:\/[A-Za-z0-9.\-]+)?)\b/);
                      if (nm) { addNum(nm[1]); break; }
                    }
                  }
                }

                if (primaryType || allNumbers.length > 0) {
                  return {
                    sertifikat: primaryType,
                    nomorLegalitas: allNumbers.length ? allNumbers.join(",") : null,
                  };
                }

                // ── Strategi 1 (FALLBACK): container bg-primary-100/5 ──
                // Target: div.h-auto.overflow-auto.rounded-lg.bg-primary-100/5
                // Setiap bidang tanah punya div.text-xs sendiri berisi "SHM No: 09/WGb"
                const containers = Array.from(
                  document.querySelectorAll<HTMLElement>("div")
                ).filter((el) => {
                  const cls = String(el.className || "");
                  return (
                    cls.includes("overflow-auto") &&
                    cls.includes("rounded-lg") &&
                    cls.includes("bg-primary-100/5")
                  );
                });

                const certContainer =
                  containers.find((c) => /Bukti\s*Kepemilikan/i.test(c.textContent ?? "")) ?? null;

                if (certContainer) {
                  const certEls = Array.from(
                    certContainer.querySelectorAll<HTMLElement>("div.text-xs")
                  );
                  for (const el of certEls) {
                    const raw = (el.textContent ?? "").replace(/\s+/g, " ").trim();
                    parseCertText(raw);
                  }
                  if (primaryType || allNumbers.length > 0) {
                    return {
                      sertifikat: primaryType,
                      nomorLegalitas: allNumbers.length ? allNumbers.join(",") : null,
                    };
                  }
                }

                // ── Strategi 2 (FALLBACK): semua grid rows (border-t + first row) ──
                const dataRows = Array.from(
                  document.querySelectorAll<HTMLElement>("div[class*='grid-cols']")
                ).filter((el) => {
                  const cls = String(el.className || "");
                  return cls.includes("grid") && /Bukti\s*Kepemilikan|SHM|HGB|SHGB|HPL/i.test(el.textContent ?? "");
                });

                for (const row of dataRows) {
                  // Coba per kolom dulu, lalu fallback ke seluruh row
                  const cols = Array.from(row.children) as HTMLElement[];
                  let matched = false;
                  for (const col of cols) {
                    const raw = (col.textContent ?? "").replace(/\s+/g, " ").trim();
                    if (parseCertText(raw)) { matched = true; break; }
                  }
                  if (!matched) {
                    const raw = (row.textContent ?? "").replace(/\s+/g, " ").trim();
                    parseCertText(raw);
                  }
                }

                if (primaryType || allNumbers.length > 0) {
                  return {
                    sertifikat: primaryType,
                    nomorLegalitas: allNumbers.length ? allNumbers.join(",") : null,
                  };
                }

                // ── Strategi 3 (FALLBACK): label "Bukti Kepemilikan" → sibling ──
                const kepLabels = Array.from(
                  document.querySelectorAll<HTMLElement>("div, span, p, td, th")
                ).filter(
                  (el) =>
                    el.children.length === 0 &&
                    /^Bukti\s*Kepemilikan$/i.test(el.textContent?.trim() ?? "")
                );

                for (const lbl of kepLabels) {
                  const parent = lbl.parentElement;
                  if (!parent) continue;
                  const kids = Array.from(parent.children);
                  const idx = kids.indexOf(lbl);
                  for (let i = idx + 1; i < kids.length; i++) {
                    const raw = (kids[i] as HTMLElement).textContent?.replace(/\s+/g, " ").trim() ?? "";
                    if (raw && parseCertText(raw)) break;
                  }
                }

                if (primaryType || allNumbers.length > 0) {
                  return {
                    sertifikat: primaryType,
                    nomorLegalitas: allNumbers.length ? allNumbers.join(",") : null,
                  };
                }

                // ── Strategi 4 (FALLBACK): label alternatif ──
                for (const labelTxt of ["Sertifikat", "Jenis Hak", "Jenis Sertifikat", "Bukti Hak"]) {
                  const el = Array.from(
                    document.querySelectorAll<HTMLElement>("div, span, td, th, p")
                  ).find(
                    (e) =>
                      e.children.length === 0 &&
                      new RegExp(`^${labelTxt}$`, "i").test(e.textContent?.trim() ?? "")
                  );
                  if (el) {
                    const sib = el.nextElementSibling ?? el.parentElement?.nextElementSibling;
                    const raw = (sib as HTMLElement | null)?.textContent?.replace(/\s+/g, " ").trim() ?? "";
                    if (parseCertText(raw)) break;
                  }
                }

                if (primaryType || allNumbers.length > 0) {
                  return {
                    sertifikat: primaryType,
                    nomorLegalitas: allNumbers.length ? allNumbers.join(",") : null,
                  };
                }

                // ── Strategi 5 (FALLBACK): regex pada seluruh bodyText ──
                const bodyText = document.body.textContent ?? "";
                const CERT_RE =
                  /\b(SHM|SHGB|HGB|HPL|Hak\s+Pakai)\s*(?:No\.?\s*|Nomor\s*)?[:\s]*([0-9]+(?:\/[A-Za-z0-9.\-]+)?)/gi;
                let cm: RegExpExecArray | null;
                while ((cm = CERT_RE.exec(bodyText)) !== null) {
                  if (!primaryType) primaryType = cm[1].replace(/\s+/g, "").toUpperCase();
                  addNum(cm[2]);
                }
                if (!primaryType) {
                  const typeOnly = bodyText.match(CERT_TYPE_RE);
                  if (typeOnly) primaryType = typeOnly[1].replace(/\s+/g, "").toUpperCase();
                }
                return {
                  sertifikat: primaryType,
                  nomorLegalitas: allNumbers.length ? allNumbers.join(",") : null,
                };
              })();

              // ── Alamat ──────────────────────────────────────────────────────
              // Struktur halaman lelang.go.id: di tab "Uraian" (panel pertama)
              // ada <div class="text-xs"> yang berisi text "Alamat: <value>".
              // Cukup scan panel Uraian, ambil elemen text-xs yang diawali "Alamat:".
              const alamat = (() => {
                const scope =
                  document.querySelector<HTMLElement>(".p-tabview-panel") ||
                  document.body;

                const els = scope.querySelectorAll<HTMLElement>("div.text-xs");
                for (let i = 0; i < els.length; i++) {
                  const text = (els[i].textContent || "").replace(/\s+/g, " ").trim();
                  if (/^Alamat\s*:/i.test(text)) {
                    const value = text
                      .replace(/^Alamat\s*:\s*/i, "")
                      .replace(/\s*Lihat\s+Lokasi.*$/i, "")
                      .trim();
                    if (value.length > 5) return value;
                  }
                }
                return null;
              })();

              // ── Luas ──
              const luasEl = Array.from(document.querySelectorAll<HTMLElement>("div.text-xs, td, p"))
                .find((el) => /Luas\s*:/i.test(el.textContent ?? ""));
              const luasText = luasEl?.textContent ?? judul ?? "";

              // ── Lampiran (dikosongkan sementara) ──
              const lampiran: string | null = null;

              // ── Debug: dump teks section Bukti Kepemilikan (untuk audit NULL cases) ──
              const buktiDebug = (() => {
                const labels = Array.from(
                  document.querySelectorAll<HTMLElement>("div")
                ).filter(
                  (el) =>
                    el.children.length === 0 &&
                    /^Bukti\s*Kepemilikan$/i.test((el.textContent || "").trim())
                );
                if (labels.length === 0) return "[label 'Bukti Kepemilikan' tidak ditemukan di DOM]";
                return labels
                  .slice(0, 3)
                  .map((lbl) => {
                    const parent = lbl.parentElement;
                    if (!parent) return "[no parent]";
                    return (parent.textContent ?? "")
                      .replace(/\s+/g, " ")
                      .trim()
                      .substring(0, 250);
                  })
                  .join(" || ");
              })();

              return {
                judul,
                nilai_limit: nilaiLimit,
                uang_jaminan: uangJaminan,
                penjual,
                batas_penawaran: batasPenawaran,
                batas_jaminan: batasJaminan,
                sertifikat: detectedType,
                nomor_legalitas: nomorLegalitas,
                alamat,
                luas_text: luasText,
                gambar: imgs,
                lampiran,
                bukti_debug: buktiDebug,
              };
            });

            if (!data.judul) {
              push({ type: "log", msg: `    ⚠️ Judul tidak ditemukan, skip.` });
              continue;
            }

            // Log field-field yang null agar mudah debug
            const nullFields = (["sertifikat", "nomor_legalitas", "alamat", "batas_penawaran"] as const)
              .filter((f) => !data[f as keyof typeof data]);
            if (nullFields.length > 0)
              push({ type: "log", msg: `    ℹ️ Null: ${nullFields.join(", ")}` });

            // Dump teks Bukti Kepemilikan kalau sertifikat/nomor null — audit 3 kasus NULL
            if (!data.sertifikat || !data.nomor_legalitas) {
              push({
                type: "log",
                msg: `    🔍 Bukti section: "${(data.bukti_debug ?? "?").substring(0, 200)}"`,
              });
            }

            // Parsing wilayah
            const alamat = data.alamat ?? "";
            const kota = extractKota(data.judul, alamat);
            const { provinsi, kecamatan, kelurahan } = parseWilayahFromAlamat(alamat);
            const luas = extractLuas(data.luas_text ?? data.judul ?? "");
            const tanggalLelang = parseTanggal(data.batas_penawaran);
            const legalitas = mapLegalitas(data.sertifikat) as any;
            const kategoriEnum = mapKategori(kategori) as any;

            const slugFinal = `${slugify(data.judul)}-${Date.now()}`;
            const em: Record<string, string> = {
              rumah: "🏡", apartemen: "🏢", gudang: "📦", pabrik: "🏭",
              toko: "🏬", tanah: "🌱", "hotel dan villa": "🏨", ruko: "🏢",
            };
            const deskripsi = `${em[kategori.toLowerCase()] ?? "✨"} Lelang ${kategori} – LT ${luas ?? "?"} m² – ${kota}`;

            // ── Download Lampiran (PDF) → Upload ke Google Drive ─────────────
            // Target struktur (confirmed):
            //   div.p-tabview-panel[aria-labelledby="pr_id_X_header_Y"]
            //     └ div.bg-primary-100/5
            //         └ div.cursor-pointer.text-xs.underline (× N — tiap link PDF)
            //
            // Strategi:
            //   1. Cari panel via aria-labelledby (header ID) — relasi panel↔header
            //   2. Aktifkan tiap panel pakai Puppeteer REAL click (#headerId), bukan
            //      synthetic .click() — Vue/React event handler lebih konsisten
            //   3. Re-query link PDF di panel aktif, klik via ElementHandle real click
            //   4. Capture response PDF dari main tab + popup (kalau buka new tab)
            const lampiranUrls: string[] = [];
            let tmpDir: string | null = null;
            try {
              const fsp = await import("fs/promises");
              const pathMod = await import("path");
              const os = await import("os");

              // Buat tmp dir unik per listing — semua PDF download masuk sini
              tmpDir = await fsp.mkdtemp(pathMod.join(os.tmpdir(), "lelang-pdf-"));

              // Izinkan Chromium download PDF ke disk (bukan deny / response capture)
              try {
                const cdp = await detailTab.target().createCDPSession();
                await cdp.send("Page.setDownloadBehavior", {
                  behavior: "allow",
                  downloadPath: tmpDir,
                });
              } catch {}

              // Popup → set download behavior yang sama (kalau link buka new window)
              const popupHandler = async (popup: any) => {
                try {
                  const pcdp = await popup.target().createCDPSession();
                  await pcdp.send("Page.setDownloadBehavior", {
                    behavior: "allow",
                    downloadPath: tmpDir!,
                  });
                } catch {}
              };
              detailTab.on("popup", popupHandler);

              // ── DIAGNOSTIC: dump apa yang ada di DOM dulu ──
              const diag = await detailTab.evaluate(() => {
                const filterClass = (selector: string, ...needed: string[]) =>
                  Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(
                    (el) => {
                      const c = String(el.className || "");
                      return needed.every((n) => c.includes(n));
                    }
                  ).length;
                return {
                  tabPanels: document.querySelectorAll(
                    ".p-tabview-panel, [role='tabpanel']"
                  ).length,
                  tabNavItems: document.querySelectorAll(
                    ".p-tabview-nav li, .p-tabview-nav-link, [role='tab']"
                  ).length,
                  bgPrimaryContainers: filterClass("div", "bg-primary-100/5"),
                  underlineLinks: filterClass(
                    "div",
                    "cursor-pointer",
                    "text-xs",
                    "underline"
                  ),
                };
              });
              push({
                type: "log",
                msg: `    🔬 DOM: panels=${diag.tabPanels} navItems=${diag.tabNavItems} bgPrimary=${diag.bgPrimaryContainers} underlineLinks=${diag.underlineLinks}`,
              });

              // ── Phase 1: Cari tab NAV items (li/anchor) — selalu ada di DOM ──
              // walaupun panelnya lazy-load. Klik nav → trigger render panel.
              // Prefer [role="tab"] (anchor/button), fallback ke li, dedup by text.
              type Nav = { idx: number; text: string };
              const navItems: Nav[] = await detailTab.evaluate(() => {
                // Strategi: prioritaskan [role="tab"] (clickable target Vue handler)
                let candidates = Array.from(
                  document.querySelectorAll<HTMLElement>('[role="tab"]')
                );
                if (candidates.length === 0) {
                  candidates = Array.from(
                    document.querySelectorAll<HTMLElement>(".p-tabview-nav-link")
                  );
                }
                if (candidates.length === 0) {
                  candidates = Array.from(
                    document.querySelectorAll<HTMLElement>(
                      ".p-tabview-nav li, .p-tabview-header"
                    )
                  );
                }
                // Dedup by text content (collapses duplikat li+a)
                const seenText = new Set<string>();
                const dedup: HTMLElement[] = [];
                for (const c of candidates) {
                  const txt = (c.textContent ?? "").replace(/\s+/g, " ").trim();
                  if (!txt) continue;
                  if (seenText.has(txt)) continue;
                  seenText.add(txt);
                  dedup.push(c);
                }
                (window as any).__navItems = dedup;
                return dedup.map((h, i) => ({
                  idx: i,
                  text: (h.textContent ?? "").replace(/\s+/g, " ").trim().substring(0, 60),
                }));
              });

              push({
                type: "log",
                msg: `    🧭 Tab nav: ${navItems.length} [${navItems.map((t) => `"${t.text}"`).join(", ")}]`,
              });

              // Filter — visit semua jika ada >1 nav item, atau yang match keyword
              const KW = /lampiran|pengumuman|dokumen|berkas/i;
              let itemsToVisit = navItems.filter((n) => KW.test(n.text));
              if (itemsToVisit.length === 0) itemsToVisit = navItems; // visit ALL

              // Helper: global scan untuk link lampiran (dalam bg-primary-100/5)
              const scanLinks = async (): Promise<number> => {
                return detailTab.evaluate(() => {
                  const containers = Array.from(
                    document.querySelectorAll<HTMLElement>("div")
                  ).filter((el) =>
                    String(el.className || "").includes("bg-primary-100/5")
                  );
                  const links: HTMLElement[] = [];
                  const seenL = new Set<HTMLElement>();
                  for (const c of containers) {
                    Array.from(c.querySelectorAll<HTMLElement>("div")).forEach((el) => {
                      const cls = String(el.className || "");
                      if (
                        cls.includes("cursor-pointer") &&
                        cls.includes("text-xs") &&
                        cls.includes("underline") &&
                        !seenL.has(el)
                      ) {
                        seenL.add(el);
                        links.push(el);
                      }
                    });
                  }
                  // Fallback: jika tidak ada container bg-primary-100/5, scan global
                  if (links.length === 0) {
                    Array.from(
                      document.querySelectorAll<HTMLElement>("div")
                    ).forEach((el) => {
                      const cls = String(el.className || "");
                      if (
                        cls.includes("cursor-pointer") &&
                        cls.includes("text-xs") &&
                        cls.includes("underline") &&
                        !seenL.has(el)
                      ) {
                        seenL.add(el);
                        links.push(el);
                      }
                    });
                  }
                  (window as any).__currentLinks = links;
                  return links.length;
                });
              };

              // ── Phase 2: Klik tiap tab nav → wait render → scan → klik PDF links ──
              const visitedPanels = new Set<string>();
              for (const item of itemsToVisit) {
                try {
                  // Snapshot DOM SEBELUM klik (untuk wait-for-change)
                  const prePanels: number = await detailTab.evaluate(
                    () =>
                      document.querySelectorAll(".p-tabview-panel, [role='tabpanel']")
                        .length
                  );

                  // (a) Aktifkan tab dengan multi-strategy click
                  await detailTab.evaluate((idx: number) => {
                    const items = ((window as any).__navItems ?? []) as HTMLElement[];
                    const el = items[idx];
                    if (!el) return;
                    el.scrollIntoView({ block: "center" });
                    // Cari target click paling spesifik
                    const target =
                      el.matches('[role="tab"]') || el.tagName === "A" || el.tagName === "BUTTON"
                        ? el
                        : el.querySelector<HTMLElement>('a[role="tab"], a, button, [role="tab"]') ?? el;
                    // Dispatch full mouse sequence — Vue/React lebih reliabel respon
                    const opts = { bubbles: true, cancelable: true, view: window, button: 0 };
                    target.dispatchEvent(new MouseEvent("pointerdown", opts as any));
                    target.dispatchEvent(new MouseEvent("mousedown", opts));
                    target.dispatchEvent(new MouseEvent("pointerup", opts as any));
                    target.dispatchEvent(new MouseEvent("mouseup", opts));
                    target.dispatchEvent(new MouseEvent("click", opts));
                    // Fallback native .click() untuk handler attribute-style
                    try {
                      target.click();
                    } catch {}
                  }, item.idx);

                  // (b) Wait sampai panel baru ter-render ATAU underlineLinks muncul
                  await detailTab
                    .waitForFunction(
                      `(() => {
                        const p = document.querySelectorAll('.p-tabview-panel, [role="tabpanel"]').length;
                        const l = Array.from(document.querySelectorAll('div')).filter(el => {
                          const c = String(el.className || '');
                          return c.includes('cursor-pointer') && c.includes('text-xs') && c.includes('underline');
                        }).length;
                        return p > ${prePanels} || l > 0;
                      })()`,
                      { timeout: 8000 }
                    )
                    .catch(() => {});
                  await new Promise((r) => setTimeout(r, 1200));

                  // Diagnostic post-click: kelihatan apa yang ada di panel aktif
                  const postDiag: { panels: number; underlineLinks: number; preview: string } =
                    await detailTab.evaluate(() => {
                      const panels = Array.from(
                        document.querySelectorAll<HTMLElement>(
                          ".p-tabview-panel, [role='tabpanel']"
                        )
                      );
                      const active =
                        panels.find((p) => {
                          const ah = p.getAttribute("aria-hidden");
                          return ah === null || ah === "false";
                        }) ?? panels[panels.length - 1];
                      const underlineLinks = Array.from(
                        document.querySelectorAll<HTMLElement>("div")
                      ).filter((el) => {
                        const c = String(el.className || "");
                        return (
                          c.includes("cursor-pointer") &&
                          c.includes("text-xs") &&
                          c.includes("underline")
                        );
                      }).length;
                      const preview = (active?.textContent ?? "")
                        .replace(/\s+/g, " ")
                        .trim()
                        .substring(0, 120);
                      return { panels: panels.length, underlineLinks, preview };
                    });
                  push({
                    type: "log",
                    msg: `      🔬 Post-klik "${item.text}": panels=${postDiag.panels} ulinks=${postDiag.underlineLinks} preview="${postDiag.preview.substring(0, 80)}..."`,
                  });

                  // (c) Scan link lampiran setelah tab aktif
                  const linkCount = await scanLinks();
                  push({
                    type: "log",
                    msg: `      · Tab "${item.text}": ${linkCount} link`,
                  });

                  if (linkCount === 0) continue;

                  // Dedup: cek jika sama dengan tab sebelumnya (link reference sama)
                  const fingerprint: string = await detailTab.evaluate(() => {
                    const links = ((window as any).__currentLinks ?? []) as HTMLElement[];
                    return links
                      .map((el) => (el.textContent ?? "").trim())
                      .join("|");
                  });
                  if (visitedPanels.has(fingerprint)) {
                    push({ type: "log", msg: `        (link sama dgn tab sebelumnya, skip)` });
                    continue;
                  }
                  visitedPanels.add(fingerprint);

                  // (c) Klik tiap link via ElementHandle real click
                  for (let i = 0; i < linkCount; i++) {
                    try {
                      const handle = await detailTab.evaluateHandle((idx: number) => {
                        const links =
                          ((window as any).__currentLinks ?? []) as HTMLElement[];
                        const el = links[idx];
                        if (el) el.scrollIntoView({ block: "center" });
                        return el ?? null;
                      }, i);

                      const el = handle.asElement();
                      if (el) {
                        await el.click().catch(async () => {
                          await detailTab.evaluate((idx: number) => {
                            const links =
                              ((window as any).__currentLinks ?? []) as HTMLElement[];
                            links[idx]?.click();
                          }, i);
                        });
                      }
                      await handle.dispose().catch(() => {});

                      await new Promise((r) => setTimeout(r, 3500));
                    } catch (cerr: any) {
                      push({
                        type: "log",
                        msg: `      ⚠️ Click link ${i + 1}: ${cerr.message?.substring(0, 80)}`,
                      });
                    }
                  }
                  await new Promise((r) => setTimeout(r, 1500));
                } catch (terr: any) {
                  push({
                    type: "log",
                    msg: `      ⚠️ Nav "${item.text}": ${terr.message?.substring(0, 80)}`,
                  });
                }
              }

              // Fallback: jika tidak ada nav items SAMA SEKALI, scan global
              if (navItems.length === 0) {
                const linkCount = await scanLinks();
                if (linkCount > 0) {
                  push({ type: "log", msg: `    📎 Fallback scan global: ${linkCount} link` });
                  for (let i = 0; i < linkCount; i++) {
                    try {
                      const handle = await detailTab.evaluateHandle((idx: number) => {
                        const links =
                          ((window as any).__currentLinks ?? []) as HTMLElement[];
                        const el = links[idx];
                        if (el) el.scrollIntoView({ block: "center" });
                        return el ?? null;
                      }, i);
                      const el = handle.asElement();
                      if (el) {
                        await el.click().catch(async () => {
                          await detailTab.evaluate((idx: number) => {
                            const links =
                              ((window as any).__currentLinks ?? []) as HTMLElement[];
                            links[idx]?.click();
                          }, i);
                        });
                      }
                      await handle.dispose().catch(() => {});
                      await new Promise((r) => setTimeout(r, 3500));
                    } catch {}
                  }
                  await new Promise((r) => setTimeout(r, 1500));
                }
              }

              detailTab.off("popup", popupHandler);

              // ── Phase 3: Tunggu download selesai, baca dari disk ──
              // Klik link tadi men-trigger Chromium download ke `tmpDir`. File
              // sementara berakhiran `.crdownload` selama in-progress. Polling
              // sampai tidak ada partial file lagi atau timeout 30s.
              const isPartial = (n: string) =>
                /\.(crdownload|tmp|part)$/i.test(n);
              await new Promise((r) => setTimeout(r, 2000));
              for (let attempt = 0; attempt < 15; attempt++) {
                const files = await fsp.readdir(tmpDir);
                if (files.length === 0) {
                  // belum ada file sama sekali → coba tunggu lagi
                  await new Promise((r) => setTimeout(r, 2000));
                  continue;
                }
                if (!files.some(isPartial)) break;
                await new Promise((r) => setTimeout(r, 2000));
              }

              const allFiles = await fsp.readdir(tmpDir);
              const pdfFiles = allFiles.filter((f) => !isPartial(f));
              push({
                type: "log",
                msg: `    📊 Total PDF terdownload: ${pdfFiles.length}`,
              });

              // ── Phase 4: Upload PDF ke Google Drive ──
              if (pdfFiles.length > 0) {
                try {
                  const drive = new GoogleDriveService();
                  const slugBase = slugify(data.judul ?? "lelang").substring(0, 60);
                  for (let i = 0; i < pdfFiles.length; i++) {
                    const filename = pdfFiles[i];
                    const filePath = pathMod.join(tmpDir, filename);
                    try {
                      const buffer = await fsp.readFile(filePath);
                      if (buffer.length < 1024) {
                        push({
                          type: "log",
                          msg: `      ⚠️ Skip ${filename}: terlalu kecil (${buffer.length}B)`,
                        });
                        continue;
                      }
                      if (buffer.slice(0, 4).toString() !== "%PDF") {
                        push({
                          type: "log",
                          msg: `      ⚠️ Skip ${filename}: bukan PDF (magic header salah)`,
                        });
                        continue;
                      }
                      const ts = Date.now();
                      const driveName = `${slugBase}_${ts}_${i + 1}_${filename}`.substring(0, 200);
                      const rawUrl = await drive.uploadFile(
                        buffer,
                        driveName,
                        "application/pdf",
                        LAMPIRAN_FOLDER_ID
                      );
                      const idM = rawUrl.match(/id=([^&]+)/);
                      const fileId = idM?.[1];
                      lampiranUrls.push(
                        fileId
                          ? `https://drive.google.com/file/d/${fileId}/view`
                          : rawUrl
                      );
                      push({
                        type: "log",
                        msg: `      ⬆️ Uploaded: ${filename} (${(buffer.length / 1024).toFixed(0)} KB)`,
                      });
                    } catch (uerr: any) {
                      push({
                        type: "log",
                        msg: `      ⚠️ Upload lampiran ${i + 1}: ${uerr.message?.substring(0, 80)}`,
                      });
                    }
                  }
                  push({
                    type: "log",
                    msg: `    ✅ ${lampiranUrls.length}/${pdfFiles.length} lampiran tersimpan di Drive`,
                  });
                } catch (derr: any) {
                  push({
                    type: "log",
                    msg: `      ⚠️ Drive service: ${derr.message?.substring(0, 80)}`,
                  });
                }
              }
            } catch (lerr: any) {
              push({
                type: "log",
                msg: `    ⚠️ Lampiran extraction: ${lerr.message?.substring(0, 80)}`,
              });
            } finally {
              if (tmpDir) {
                try {
                  const fsp = await import("fs/promises");
                  await fsp.rm(tmpDir, { recursive: true, force: true });
                } catch {}
              }
            }

            // Guard final: jangan tulis ke DB kalau user sudah cancel
            // (puppeteer evaluate sudah berjalan, tapi data masih boleh di-discard)
            if (isCancelled()) {
              console.log("[scrape] cancelled — skip DB write untuk", detailUrl);
              continue;
            }

            await prisma.listing.create({
              data: {
                id_agent: agentId,
                vendor: data.penjual ?? `Balai Lelang - ${kategori}`,
                judul: data.judul,
                slug: slugFinal,
                deskripsi,
                jenis_transaksi: "LELANG",
                kategori: kategoriEnum,
                status_tayang: "TERSEDIA",
                // Harga = nilai_limit_lelang supaya kolom `harga` menyimpan
                // harga efektif (dipakai untuk sort termurah/termahal & filter
                // harga). Tampilan tetap membaca nilai_limit_lelang.
                harga: data.nilai_limit || 0,
                // Harga per meter = nilai limit lelang / luas tanah
                harga_per_meter:
                  data.nilai_limit && luas && luas > 0
                    ? Math.round(data.nilai_limit / luas)
                    : null,
                nilai_limit_lelang: data.nilai_limit || 0,
                uang_jaminan: data.uang_jaminan || null,
                tanggal_lelang: tanggalLelang ?? new Date(Date.now() + 30 * 86400000),
                link: detailUrl,
                alamat_lengkap: alamat.substring(0, 500) || null,
                provinsi,
                kota,
                kecamatan: kecamatan ?? null,
                kelurahan: kelurahan ?? null,
                luas_tanah: luas,
                legalitas,
                nomor_legalitas: data.nomor_legalitas
                  ? data.nomor_legalitas.substring(0, 250)
                  : null,
                gambar: data.gambar.length > 0 ? data.gambar.join(",") : null,
                lampiran: lampiranUrls.length > 0 ? lampiranUrls.join(",") : null,
              },
            });

            existingSet.add(detailUrl);
            totalSaved++;
            push({
              type: "saved",
              msg: `    ✅ ${data.judul}`,
              judul: data.judul,
              alamat_lengkap: alamat.substring(0, 500) || null,
              kota,
              harga: data.nilai_limit,
              gambar: data.gambar[0] ?? null,
              totalSaved,
            });
          } catch (err: any) {
            push({ type: "log", msg: `    ⚠️ Gagal: ${err.message?.substring(0, 120)}` });
          } finally {
            await detailTab.close().catch(() => {});
          }
        }

        if (isCancelled()) break;
        page++;
        push({ type: "progress", page, totalSaved, totalSkipped });
      }

      push({
        type: isCancelled() ? "cancelled" : "done",
        totalSaved,
        totalSkipped,
        page: page - 1,
      });
    } catch (err: any) {
      push({ type: "error", msg: err.message });
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
}

// ─── SSE stream builder ──────────────────────────────────────────────────────
// Setiap koneksi client dapat stream baru: replay log buffer + subscribe live.
// stream.cancel() (client disconnect) HANYA unsubscribe — tidak cancel job.
function buildSseStream(): Response {
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(c) {
      const job = scrapeJobManager.current;

      // Replay buffered logs (kalau ada job)
      if (job) {
        for (const ev of job.logs) {
          try { c.enqueue(sseMsg(ev)); } catch {}
        }
        // Job sudah finished → langsung close
        if (job.status !== "running") {
          try { c.close(); } catch {}
          return;
        }
      } else {
        // Tidak ada job sama sekali → close immediately
        try { c.close(); } catch {}
        return;
      }

      // Subscribe untuk live updates
      unsubscribe = scrapeJobManager.subscribe((event) => {
        try { c.enqueue(sseMsg(event)); } catch {}
        if (
          event.type === "done" ||
          event.type === "cancelled" ||
          event.type === "error"
        ) {
          try { c.close(); } catch {}
          unsubscribe?.();
          unsubscribe = null;
        }
      });
    },
    cancel() {
      // Client disconnect (navigate away, close tab) — JANGAN cancel job,
      // hanya lepas subscription. Job tetap jalan di background.
      unsubscribe?.();
      unsubscribe = null;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ─── POST handler ────────────────────────────────────────────────────────────
// Body: { kategori, startPage }
//   - Kalau belum ada job running → start baru, return SSE stream.
//   - Kalau sudah ada job running → ABAIKAN body, return SSE replay+live job lama.
// Disconnect tidak pernah mencancel — pakai POST /api/scrape/lelang/stop.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });

  const agentId = (session.user as any).agentId as string | null;
  if (!agentId)
    return new Response(
      JSON.stringify({ error: "Hanya agent yang bisa scrape" }),
      { status: 403 },
    );

  const existing = scrapeJobManager.current;
  const isReconnect = existing && existing.status === "running";
  console.log(
    `[scrape:POST] ${isReconnect ? "RECONNECT" : "START"} — existing job:`,
    existing
      ? { id: existing.id, status: existing.status, currentPage: existing.currentPage }
      : null,
  );

  if (!isReconnect) {
    // Start job baru
    const body = await req.json().catch(() => ({}));
    const kategori: string = body.kategori ?? "Rumah";
    const startPage: number = body.startPage ?? 1;

    const job = scrapeJobManager.start({ kategori, startPage, agentId });
    if (!job) {
      return new Response(
        JSON.stringify({ error: "Job sudah berjalan" }),
        { status: 409 },
      );
    }
    console.log("[scrape:POST] started new job", job.id);
    // Kick off background work — DO NOT await (must return stream first)
    runScrapeJob(agentId, kategori, startPage).catch((e) => {
      console.error("[scrape] worker error:", e);
      scrapeJobManager.push({
        type: "error",
        msg: e?.message ?? "Worker crash",
      });
    });
  }

  return buildSseStream();
}

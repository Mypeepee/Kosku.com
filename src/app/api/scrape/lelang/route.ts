import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import prisma from "@/lib/prisma";
import { GoogleDriveService } from "@/lib/services/google-drive.service";
import { scrapeJobManager, type LogEvent } from "@/lib/scrape-job";
import {
  bacaBukti,
  extractKota,
  extractLuas,
  gabungBukti,
  parseTanggalId,
  parseWilayahFromAlamat,
  provinsiDariKota,
} from "@/lib/lelang/parse.mjs";
import {
  idsDariUrlLelang,
  kumpulanLampiran,
  namaDariUrl,
  tampakPdf,
  unduhBuffer,
  urlLampiranDariApi,
} from "@/lib/lelang/lampiran.mjs";

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

function sseMsg(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

/** Kelas yang menandai satu tautan lampiran di halaman detail lot. */
const KELAS_TAUTAN_LAMPIRAN = ["cursor-pointer", "text-xs", "underline"];
const KATA_KUNCI_TAB = /lampiran|pengumuman|dokumen|berkas|salinan|risalah/i;

/**
 * Klik setiap tautan lampiran di halaman detail lot, dan kembalikan berapa yang
 * benar-benar terklik.
 *
 * Tautannya bukan `<a href>`: teksnya menyerupai URL tapi kosong saat di-inspect,
 * dan berkasnya baru lahir dari handler JS setelah elemen ditekan. Jadi tidak ada
 * URL yang bisa dibaca duluan — satu-satunya jalan lewat DOM memang menekannya.
 *
 * Panelnya lazy-render, jadi tab nav diklik lebih dulu; tab yang namanya
 * menyebut lampiran/pengumuman didahulukan supaya kasus normal selesai di
 * putaran pertama, tapi tab lain tetap dikunjungi karena penamaannya tidak
 * seragam antar-KPKNL. Sidik teks tiap panel mencegah panel yang isinya sama
 * (nav ganda `li` + `a`) diklik dua kali.
 */
async function klikSemuaLampiran(
  tab: any,
  push: (event: LogEvent) => void,
): Promise<number> {
  const navTeks: string[] = await tab.evaluate(() => {
    let kandidat = Array.from(document.querySelectorAll<HTMLElement>('[role="tab"]'));
    if (kandidat.length === 0) {
      kandidat = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".p-tabview-nav-link, .p-tabview-nav li, .p-tabview-header",
        ),
      );
    }
    const terlihat = new Set<string>();
    const unik: HTMLElement[] = [];
    for (const k of kandidat) {
      const teks = (k.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!teks || terlihat.has(teks)) continue;
      terlihat.add(teks);
      unik.push(k);
    }
    (window as any).__navLampiran = unik;
    return unik.map((k) => (k.textContent ?? "").replace(/\s+/g, " ").trim().substring(0, 60));
  });

  const urutan = navTeks
    .map((teks, idx) => ({ idx, teks }))
    .sort((a, b) => Number(KATA_KUNCI_TAB.test(b.teks)) - Number(KATA_KUNCI_TAB.test(a.teks)));
  // Tanpa tab sama sekali (layout lama): tetap sekali jalan, scan langsung.
  const kunjungan = urutan.length > 0 ? urutan : [{ idx: -1, teks: "" }];

  let diklik = 0;
  const sidikPanel = new Set<string>();

  for (const nav of kunjungan) {
    try {
      if (nav.idx >= 0) {
        await tab.evaluate((idx: number) => {
          const el = ((window as any).__navLampiran ?? [])[idx] as HTMLElement | undefined;
          if (!el) return;
          el.scrollIntoView({ block: "center" });
          const target =
            el.matches('[role="tab"]') || el.tagName === "A" || el.tagName === "BUTTON"
              ? el
              : el.querySelector<HTMLElement>('a[role="tab"], a, button, [role="tab"]') ?? el;
          // Urutan event penuh — handler Vue/React sering mengabaikan `click` polos.
          const opts = { bubbles: true, cancelable: true, view: window, button: 0 };
          for (const jenis of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
            target.dispatchEvent(new MouseEvent(jenis, opts as any));
          }
          try {
            target.click();
          } catch {}
        }, nav.idx);
        await tab
          .waitForFunction(
            `Array.from(document.querySelectorAll('div')).some(el => {
              const c = String(el.className || '');
              return ${JSON.stringify(KELAS_TAUTAN_LAMPIRAN)}.every(k => c.includes(k));
            })`,
            { timeout: 6000 },
          )
          .catch(() => {});
        await new Promise((r) => setTimeout(r, 900));
      }

      const jumlah: number = await tab.evaluate((kelas: string[]) => {
        const cocok = (el: Element) => {
          const c = String((el as HTMLElement).className || "");
          return kelas.every((k) => c.includes(k));
        };
        const wadah = Array.from(document.querySelectorAll<HTMLElement>("div")).filter((el) =>
          String(el.className || "").includes("bg-primary-100/5"),
        );
        const sumber: HTMLElement[] = wadah.length > 0 ? wadah : [document.body];
        const terlihat = new Set<HTMLElement>();
        const hasil: HTMLElement[] = [];
        for (const w of sumber) {
          for (const el of Array.from(w.querySelectorAll<HTMLElement>("div, a, span"))) {
            if (!cocok(el) || terlihat.has(el)) continue;
            terlihat.add(el);
            hasil.push(el);
          }
        }
        (window as any).__tautanLampiran = hasil;
        return hasil.length;
      }, KELAS_TAUTAN_LAMPIRAN);

      if (jumlah === 0) continue;

      const sidik: string = await tab.evaluate(() =>
        (((window as any).__tautanLampiran ?? []) as HTMLElement[])
          .map((el) => (el.textContent ?? "").trim())
          .join("|"),
      );
      if (sidikPanel.has(sidik)) continue;
      sidikPanel.add(sidik);

      for (let i = 0; i < jumlah; i++) {
        try {
          const pegangan = await tab.evaluateHandle((idx: number) => {
            const el = ((window as any).__tautanLampiran ?? [])[idx] as HTMLElement | undefined;
            el?.scrollIntoView({ block: "center" });
            return el ?? null;
          }, i);
          const el = pegangan.asElement();
          if (el) {
            // Klik asli Puppeteer (event tepercaya) dulu; `.click()` sintetis
            // hanya cadangan kalau elemennya tertutup elemen lain.
            await el.click({ delay: 30 }).catch(async () => {
              await tab.evaluate((idx: number) => {
                (((window as any).__tautanLampiran ?? [])[idx] as HTMLElement | undefined)?.click();
              }, i);
            });
            diklik++;
          }
          await pegangan.dispose().catch(() => {});
          await new Promise((r) => setTimeout(r, 1200));
        } catch {}
      }
    } catch (err: any) {
      push({
        type: "log",
        msg: `      ⚠️ Tab "${nav.teks}": ${String(err?.message ?? err).substring(0, 80)}`,
      });
    }
  }

  return diklik;
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

          // Sadap URL PDF apa pun yang lewat — dipasang SEBELUM goto supaya
          // pengumuman yang di-request saat halaman dimuat ikut tertangkap,
          // bukan cuma yang muncul setelah tautannya diklik.
          const urlPdfTersadap: string[] = [];
          const sadapPdf = (res: any) => {
            try {
              const u = res.url();
              if (!tampakPdf(u, res.headers?.()?.["content-type"] ?? "")) return;
              if (!urlPdfTersadap.includes(u)) urlPdfTersadap.push(u);
            } catch {}
          };
          detailTab.on("response", sadapPdf);
          detailTab.on("request", (req: any) => {
            try {
              const u = req.url();
              if (tampakPdf(u) && !urlPdfTersadap.includes(u)) urlPdfTersadap.push(u);
            } catch {}
          });

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

              // ── Bukti kepemilikan: KUMPULKAN TEKS, jangan menafsir di sini ──
              //
              // Versi lama menafsirkan sertifikat langsung di dalam browser
              // lewat enam strategi DOM bertingkat, dan setiap strategi
              // `return` begitu dapat SATU hasil. Itu sebabnya lot 10 bidang
              // hanya pernah menyimpan satu nomor: strategi pertama menemukan
              // bidang ke-1, lalu lima sumber sisanya tidak pernah dibaca.
              // Ditambah `String.match` tanpa /g yang memang hanya bisa cocok
              // sekali per blok teks.
              //
              // Sekarang halaman hanya menyetor TEKS MENTAH dari semua sudut
              // yang mungkin memuat bukti kepemilikan — tanpa memilih, tanpa
              // berhenti — dan penafsirannya dilakukan di Node oleh
              // src/lib/lelang/parse.mjs yang punya uji sendiri
              // (scripts/test-lelang-parse.mjs). Logika parsing yang bisa diuji
              // offline jauh lebih murah diperbaiki daripada regex yang hanya
              // hidup di dalam page.evaluate.
              const buktiTexts = (() => {
                const keluar: string[] = [];
                const lihat = new Set<string>();
                const tambah = (v: string | null | undefined) => {
                  const t = (v ?? "").replace(/\s+/g, " ").trim();
                  if (t.length > 1 && t.length < 4000 && !lihat.has(t)) {
                    lihat.add(t);
                    keluar.push(t);
                  }
                };

                // (a) Kolom yang berlabel "Bukti Kepemilikan" — struktur utama
                //     lelang.go.id: satu div.flex.flex-col berisi label + satu
                //     baris teks PER BIDANG.
                const labels = Array.from(document.querySelectorAll<HTMLElement>("div, span, p, td, th"))
                  .filter(
                    (el) =>
                      el.children.length === 0 &&
                      /^Bukti\s*Kepemilikan$/i.test((el.textContent || "").trim()),
                  );
                for (const lbl of labels) {
                  const parent = lbl.parentElement;
                  if (!parent) continue;
                  // Semua turunan teks kecil di kolom itu — SEMUA, bukan yang pertama.
                  parent
                    .querySelectorAll<HTMLElement>("div, span, p, td")
                    .forEach((el) => {
                      if (el.children.length === 0) tambah(el.textContent);
                    });
                  // Saudara langsung, untuk struktur tabel yang labelnya <th>.
                  const kids = Array.from(parent.children) as HTMLElement[];
                  const idx = kids.indexOf(lbl);
                  for (let i = idx + 1; i < kids.length; i++) tambah(kids[i].textContent);
                  tambah(parent.textContent);
                }

                // (b) Baris tabel/grid mana pun yang menyebut jenis sertifikat.
                const PUNYA_TIPE =
                  /\b(SHM|SHGB|HGB|HGU|HPL|HP|SHMSRS|Serti[fp]ikat|Hak\s+(Milik|Guna|Pakai|Pengelolaan)|Girik|Letter\s*C)\b/i;
                document
                  .querySelectorAll<HTMLElement>("tr, div[class*='grid'], div[class*='flex']")
                  .forEach((row) => {
                    if (row.children.length === 0) return;
                    const teks = row.textContent ?? "";
                    if (teks.length > 4000 || !PUNYA_TIPE.test(teks)) return;
                    // Per sel supaya bidang tidak saling menempel.
                    Array.from(row.children).forEach((sel) =>
                      tambah((sel as HTMLElement).textContent),
                    );
                  });

                // (c) Seluruh teks halaman sebagai jaring terakhir — dipakai
                //     hanya kalau (a) & (b) tidak menghasilkan apa pun, tapi
                //     tetap dikirim supaya keputusan itu diambil di Node.
                tambah(document.body?.textContent?.slice(0, 20000));

                return keluar;
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

              return {
                judul,
                nilai_limit: nilaiLimit,
                uang_jaminan: uangJaminan,
                penjual,
                batas_penawaran: batasPenawaran,
                batas_jaminan: batasJaminan,
                bukti_texts: buktiTexts,
                alamat,
                luas_text: luasText,
                gambar: imgs,
              };
            });

            if (!data.judul) {
              push({ type: "log", msg: `    ⚠️ Judul tidak ditemukan, skip.` });
              continue;
            }

            // ── Bukti kepemilikan: tafsirkan SEMUA teks yang dipanen ──
            // Union dari seluruh sumber, bukan "sumber pertama yang berhasil".
            // Satu lot bisa menaruh bidang ke-1 di kolom tabel dan bidang ke-2
            // di baris berikutnya; membaca keduanya adalah bedanya antara
            // "SHM 427" dan "SHM 427,382".
            const bukti = gabungBukti((data.bukti_texts ?? []).map(bacaBukti));

            // Parsing wilayah
            const alamat = data.alamat ?? "";
            // Kolom `kota` NOT NULL — "Tidak Diketahui" adalah nilai sengaja,
            // bukan kelalaian: listing tanpa kota tetap harus bisa disimpan
            // dan kelihatan di audit sebagai yang perlu dilengkapi.
            const kota = extractKota(data.judul, alamat) ?? "Tidak Diketahui";
            const wilayah = parseWilayahFromAlamat(alamat);
            const { kecamatan, kelurahan } = wilayah;
            // Provinsi punya tiga sumber. Yang ketiga (peta kota) menutup
            // sebagian besar kekosongan: alamat lelang sering menyebut kota
            // dengan jelas tapi tidak pernah menulis provinsinya.
            const provinsi = wilayah.provinsi ?? provinsiDariKota(kota);
            // Luas: teks "Luas: ..." lebih dipercaya, judul sebagai cadangan —
            // judul lot multi-bidang menyebut TOTAL luas, jadi tetap masuk akal.
            const luas = extractLuas(data.luas_text ?? "") ?? extractLuas(data.judul ?? "");
            const tanggalLelang = parseTanggalId(data.batas_penawaran);
            const legalitas = bukti.legalitas as any;
            const kategoriEnum = mapKategori(kategori) as any;

            // Lapor kolom yang masih kosong + tunjukkan bahan mentahnya, supaya
            // penyebabnya bisa dilihat saat itu juga alih-alih ditemukan
            // berbulan-bulan kemudian di halaman detail.
            const kosong: string[] = [];
            if (!legalitas) kosong.push("legalitas");
            if (!bukti.nomorGabungan) kosong.push("nomor_legalitas");
            if (!alamat) kosong.push("alamat");
            if (!data.batas_penawaran) kosong.push("tanggal_lelang");
            if (!luas) kosong.push("luas_tanah");
            // `kota` tidak pernah falsy (ada nilai cadangan), jadi yang dihitung
            // kosong adalah nilai cadangannya itu sendiri.
            if (kota === "Tidak Diketahui") kosong.push("kota");
            if (!provinsi) kosong.push("provinsi");
            if (kosong.length > 0) {
              push({ type: "log", msg: `    ℹ️ Kosong: ${kosong.join(", ")}` });
              if (!bukti.nomorGabungan) {
                const contoh = (data.bukti_texts ?? []).slice(0, 3).join(" || ").slice(0, 220);
                push({ type: "log", msg: `    🔍 Teks bukti: "${contoh || "(tidak ada)"}"` });
              }
            } else if (bukti.jumlahBidang > 1) {
              push({
                type: "log",
                msg: `    📄 ${bukti.jumlahBidang} bidang: ${bukti.nomorGabungan}`,
              });
            }

            const slugFinal = `${slugify(data.judul)}-${Date.now()}`;
            const em: Record<string, string> = {
              rumah: "🏡", apartemen: "🏢", gudang: "📦", pabrik: "🏭",
              toko: "🏬", tanah: "🌱", "hotel dan villa": "🏨", ruko: "🏢",
            };
            const deskripsi = `${em[kategori.toLowerCase()] ?? "✨"} Lelang ${kategori} – LT ${luas ?? "?"} m² – ${kota}`;

            // ── Lampiran (PDF pengumuman) → Google Drive ─────────────────────
            //
            // Tautan lampiran di halaman ini bukan `<a href>`: teksnya terlihat
            // seperti URL tapi di-inspect isinya kosong, dan berkasnya baru
            // lahir setelah elemen diklik. Karena itu pengambilannya berlapis,
            // dari yang paling deterministik ke yang paling rapuh, dan berhenti
            // di lapis pertama yang menghasilkan PDF:
            //
            //   1. API publik (permohonan → pengumumans) — tanpa DOM, tanpa klik
            //   2. Klik di browser + unduhan asli Chromium (jalur yang dijelaskan
            //      user); selesainya dipastikan lewat event CDP, bukan menebak
            //      kapan berkas `.crdownload` berhenti berubah
            //   3. URL PDF yang tersadap dari lalu lintas halaman — menangkap
            //      kasus klik yang membuka PDF di tab baru alih-alih mengunduh
            //
            // Versi lama hanya punya lapis 2 dan menganggap "tidak ada berkas di
            // folder" sebagai "lot ini memang tidak punya lampiran". Itu sebabnya
            // kolom `lampiran` kosong 100% di seluruh tabel.
            const kumpulan = kumpulanLampiran();
            const lampiranUrls: string[] = [];
            let tmpDir: string | null = null;
            const fsp = await import("fs/promises");
            const pathMod = await import("path");
            const os = await import("os");

            // ── Lapis 1: API publik ──
            try {
              const { lotLelangId } = idsDariUrlLelang(detailUrl);
              const urlApi = await urlLampiranDariApi({ lotLelangId });
              for (const u of urlApi) {
                const buf = await unduhBuffer(u, { referer: detailUrl });
                kumpulan.tambah(buf, namaDariUrl(u), "api");
              }
            } catch (aerr: any) {
              push({
                type: "log",
                msg: `    ⚠️ Lampiran (API): ${String(aerr?.message ?? aerr).substring(0, 80)}`,
              });
            }

            // ── Lapis 2: klik di browser → unduhan asli Chromium ──
            if (kumpulan.jumlah === 0) {
              try {
                tmpDir = await fsp.mkdtemp(pathMod.join(os.tmpdir(), "lelang-pdf-"));

                // Sesi CDP di level BROWSER, bukan per-page: unduhan yang
                // dipicu popup/tab baru ikut terkena aturan yang sama tanpa
                // perlu memasang handler `popup` sendiri.
                const cdp = await browser.target().createCDPSession();
                const unduhan = new Map<string, "aktif" | "selesai" | "gagal">();
                cdp.on("Browser.downloadWillBegin", (e: any) => {
                  unduhan.set(e.guid, "aktif");
                });
                cdp.on("Browser.downloadProgress", (e: any) => {
                  if (e.state === "completed") unduhan.set(e.guid, "selesai");
                  else if (e.state === "canceled") unduhan.set(e.guid, "gagal");
                });
                // `allowAndName` menamai berkas dengan GUID unduhannya, jadi
                // event dan berkas di disk berpasangan persis — tidak ada lagi
                // tebak-tebakan nama atau polling `.crdownload`.
                await cdp.send("Browser.setDownloadBehavior", {
                  behavior: "allowAndName",
                  downloadPath: tmpDir,
                  eventsEnabled: true,
                });

                const diklik = await klikSemuaLampiran(detailTab, push);

                if (diklik > 0) {
                  // Tunggu sampai tidak ada unduhan yang masih berjalan. Batas
                  // 60 detik; pengumuman lelang kadang puluhan MB.
                  const batas = Date.now() + 60000;
                  while (Date.now() < batas) {
                    const keadaan = [...unduhan.values()];
                    if (keadaan.length > 0 && !keadaan.includes("aktif")) break;
                    await new Promise((r) => setTimeout(r, 1000));
                  }

                  for (const [guid, keadaan] of unduhan) {
                    if (keadaan !== "selesai") continue;
                    const buf = await fsp
                      .readFile(pathMod.join(tmpDir, guid))
                      .catch(() => null);
                    kumpulan.tambah(buf, `${slugify(data.judul ?? "lelang")}-${guid.slice(0, 8)}.pdf`, "klik");
                  }
                }

                await cdp.detach().catch(() => {});
              } catch (kerr: any) {
                push({
                  type: "log",
                  msg: `    ⚠️ Lampiran (klik): ${String(kerr?.message ?? kerr).substring(0, 80)}`,
                });
              } finally {
                if (tmpDir) {
                  await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
                  tmpDir = null;
                }
              }
            }

            // ── Lapis 3: URL PDF hasil sadapan jaringan ──
            if (kumpulan.jumlah === 0 && urlPdfTersadap.length > 0) {
              for (const u of urlPdfTersadap) {
                const buf = await unduhBuffer(u, { referer: detailUrl });
                kumpulan.tambah(buf, namaDariUrl(u), "sadap");
              }
            }

            detailTab.off("response", sadapPdf);

            // ── Unggah ke Google Drive ──
            if (kumpulan.jumlah > 0) {
              try {
                const drive = new GoogleDriveService();
                const slugBase = slugify(data.judul ?? "lelang").substring(0, 60);
                for (let i = 0; i < kumpulan.daftar.length; i++) {
                  const berkas = kumpulan.daftar[i];
                  try {
                    const namaDrive = `${slugBase}_${Date.now()}_${i + 1}_${berkas.nama}`.substring(0, 200);
                    const rawUrl = await drive.uploadFile(
                      berkas.buffer,
                      namaDrive,
                      "application/pdf",
                      LAMPIRAN_FOLDER_ID
                    );
                    const fileId = rawUrl.match(/id=([^&]+)/)?.[1];
                    lampiranUrls.push(
                      fileId ? `https://drive.google.com/file/d/${fileId}/view` : rawUrl
                    );
                  } catch (uerr: any) {
                    push({
                      type: "log",
                      msg: `      ⚠️ Upload lampiran ${i + 1}: ${String(uerr?.message ?? uerr).substring(0, 80)}`,
                    });
                  }
                }
                push({
                  type: "log",
                  msg: `    📎 ${lampiranUrls.length}/${kumpulan.jumlah} lampiran ke Drive (${kumpulan.ringkasAsal()})`,
                });
              } catch (derr: any) {
                push({
                  type: "log",
                  msg: `    ⚠️ Drive service: ${String(derr?.message ?? derr).substring(0, 80)}`,
                });
              }
            } else {
              push({ type: "log", msg: `    📎 lampiran: tidak ditemukan` });
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
                // Sudah dipotong di batas koma oleh potongNomorLegalitas() —
                // `substring(250)` polos bisa memenggal nomor terakhir jadi
                // nomor lain yang valid tapi SALAH.
                nomor_legalitas: bukti.nomorGabungan,
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

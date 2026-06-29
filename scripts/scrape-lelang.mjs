// scripts/scrape-lelang.mjs
// ───────────────────────────────────────────────────────────────────────────────
// Scraper lelang.go.id — versi TERMINAL (mandiri, tanpa dashboard / Next.js).
//
// Menyalin PERSIS logika ekstraksi dari src/app/api/scrape/lelang/route.ts
// (6 strategi sertifikat, parsing alamat/wilayah, harga, gambar, lampiran PDF),
// jadi akurasinya sama — hanya dijalankan langsung di terminal + dioptimasi:
//   • Blokir gambar/font/media di level network (CDP setBlockedURLs) → load ringan.
//     Tidak mengganggu download PDF lampiran (pola URL beda).
//   • Proses beberapa listing detail PARALEL (pool, default 4).
//   • Wait berbasis kondisi (waitForFunction) + domcontentloaded, bukan networkidle2.
//
// Cara pakai:
//   node scripts/scrape-lelang.mjs --kategori Rumah
//   node scripts/scrape-lelang.mjs --kategori Tanah --max-pages 3 --concurrency 5
//   node scripts/scrape-lelang.mjs --kategori Ruko --dry-run        (uji, tanpa tulis DB / Drive)
//   node scripts/scrape-lelang.mjs --kategori Rumah --no-lampiran   (lebih cepat, tanpa PDF)
//
// Flag:
//   --kategori <nama>     default "Rumah"  (Rumah|Apartemen|Ruko|Tanah|Gudang|Hotel dan Villa|Toko|Pabrik)
//   --start-page <n>      default 1
//   --max-pages <n>       default 0 (= sampai habis)
//   --concurrency <n>     default 4  (jumlah tab detail paralel)
//   --agent <id>          id_agent pemilik listing (default: agent pertama di DB)
//   --no-lampiran         matikan download PDF lampiran (jauh lebih cepat)
//   --dry-run             scrape + tampilkan hasil TANPA menulis DB & tanpa upload Drive
// ───────────────────────────────────────────────────────────────────────────────

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import puppeteer from "puppeteer";
import { google } from "googleapis";
import { mkdtemp, readdir, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { Readable } from "stream";

const prisma = new PrismaClient();

const LAMPIRAN_FOLDER_ID = "1yMtRi1DbiINlGSFzHzGj-MT8f7C-UANJ";
const BASE_URL = "https://lelang.go.id";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t2 = () => new Date().toLocaleTimeString("id-ID");
const log = (msg) => console.log(`[${t2()}] ${msg}`);

// ─── CLI ────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--no-lampiran") out.lampiran = false;
    else if (a === "--lampiran") out.lampiran = true;
    else if (a === "--kategori") out.kategori = argv[++i];
    else if (a === "--start-page") out.startPage = parseInt(argv[++i], 10);
    else if (a === "--max-pages") out.maxPages = parseInt(argv[++i], 10);
    else if (a === "--concurrency") out.concurrency = parseInt(argv[++i], 10);
    else if (a === "--agent") out.agent = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

// ─── Helpers (disalin dari route.ts) ─────────────────────────────────────────
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 200);
}

function mapKategori(tipe) {
  const map = {
    rumah: "RUMAH", apartemen: "APARTEMEN", ruko: "RUKO", tanah: "TANAH",
    gudang: "GUDANG", "hotel dan villa": "HOTEL_DAN_VILLA", toko: "TOKO",
    pabrik: "PABRIK", "lain-lain": "RUMAH",
  };
  return map[tipe.toLowerCase()] ?? "RUMAH";
}

function mapLegalitas(s) {
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

function parseTanggal(raw) {
  if (!raw) return null;
  try {
    const bulan = {
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

function extractKota(judul, alamat) {
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
  const kabM = alamat.match(/\bKAB\s+([A-Z][A-Za-z\s]+?)(?:\s+PROV|\s*$)/i);
  if (kabM) return `Kab. ${kabM[1].trim()}`;
  return "Tidak Diketahui";
}

function parseWilayahFromAlamat(alamat) {
  if (!alamat) return { provinsi: null, kecamatan: null, kelurahan: null };
  const s = alamat.replace(/\s+/g, " ").trim();
  const clean = (v) => {
    if (!v) return null;
    return v
      .trim()
      .replace(/\s*\([^)]*\)/g, "")
      .replace(/\s+/g, " ")
      .replace(/\s*\d{5}\s*$/, "")
      .replace(/[,.\s]+$/, "")
      .trim() || null;
  };
  const KW_STOP =
    "(?=\\s*[,.(]|\\s*\\d{5}|\\s+(?:Kec(?:amatan)?|Kab(?:upaten)?|Kota\\b|Prov(?:insi)?|Propinsi|Prop\\b)|\\s*$)";
  const provRe = new RegExp(`(?:Provinsi|Propinsi|Prov\\.?|Prop\\.?)\\s+([A-Za-z][A-Za-z\\s]+?)${KW_STOP}`, "i");
  const provinsi = clean(s.match(provRe)?.[1]);
  const kecRe = new RegExp(`(?:Kecamatan|Kec\\.?)\\s+([A-Za-z0-9][A-Za-z0-9\\s]+?)${KW_STOP}`, "i");
  const kecamatan = clean(s.match(kecRe)?.[1]);
  const kelRe = new RegExp(`(?:Desa\\/Kelurahan|Desa\\/Kel\\.|Kelurahan|Kel\\.?|Desa|DS\\.?)\\s+([A-Za-z0-9][A-Za-z0-9\\s]+?)${KW_STOP}`, "i");
  const kelurahan = clean(s.match(kelRe)?.[1]);
  return { provinsi, kecamatan, kelurahan };
}

function extractLuas(teks) {
  const m = teks.match(/(?:Luas[:\s]+)?(\d+(?:[.,]\d+)?)\s*[Mm](?:2|²)/);
  if (!m) return null;
  return Math.floor(parseFloat(m[1].replace(",", ".")));
}

// ─── Google Drive (replika GoogleDriveService, OAuth2 dari .env) ──────────────
function getDrive() {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;
  const oauth2 = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "https://developers.google.com/oauthplayground"
  );
  oauth2.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: "v3", auth: oauth2 });
}

async function uploadPdfToDrive(drive, buffer, name) {
  const safeName = name.replace(/[<>:"/\\|?*]/g, "-");
  const res = await drive.files.create({
    requestBody: { name: safeName, parents: [LAMPIRAN_FOLDER_ID] },
    media: { mimeType: "application/pdf", body: Readable.from(buffer) },
    fields: "id",
  });
  const fileId = res.data.id;
  try {
    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    });
  } catch {}
  return fileId;
}

// ─── Browser-side extractor (disalin PERSIS dari route.ts, di-strip ke JS) ────
// Dijalankan via page.evaluate — harus self-contained (tanpa referensi luar).
function extractListingData() {
  const judul =
    document.querySelector("h3.mb-5.text-2xl")?.textContent?.trim() ||
    document.querySelector("h3.text-2xl")?.textContent?.trim() ||
    document.querySelector("h3")?.textContent?.trim() ||
    null;

  const imgs = (() => {
    const seen = new Set();
    const tryAdd = (url) => {
      const u = url?.trim();
      if (u && u.startsWith("https://file.lelang.go.id/") && !seen.has(u)) seen.add(u);
    };
    document.querySelectorAll("div.scrollbar-hide img").forEach((img) => {
      tryAdd(img.src);
      tryAdd(img.dataset?.src);
      tryAdd(img.getAttribute("data-src"));
      tryAdd(img.getAttribute("data-lazy"));
      tryAdd(img.getAttribute("data-original"));
    });
    if (seen.size === 0) {
      document.querySelectorAll("img").forEach((img) => {
        tryAdd(img.src);
        tryAdd(img.dataset?.src);
        tryAdd(img.getAttribute("data-src"));
        tryAdd(img.getAttribute("data-lazy"));
      });
    }
    return [...seen].slice(0, 7);
  })();

  const priceEls = document.querySelectorAll("h6.text-primary-500");
  const parseRp = (el) => (el ? parseInt(el.textContent.replace(/[^\d]/g, "")) || 0 : 0);
  const nilaiLimit = parseRp(priceEls[0] ?? null);
  const uangJaminan = parseRp(priceEls[1] ?? null);

  const infoEls = Array.from(document.querySelectorAll("h6.text-ternary-gray-200"));
  const getText = (i) => infoEls[i]?.textContent?.trim() ?? null;
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

  const cert = (() => {
    const CERT_TYPE_RE = /\b(SHM|SHGB|HGB|HPL|HP|HAK\s*PAKAI|HAK\s*MILIK)\b/i;
    let primaryType = null;
    const allNumbers = [];
    const seenNums = new Set();
    const addNum = (n) => {
      let c = n.trim().replace(/[.,;:]+$/, "");
      const slashIdx = c.indexOf("/");
      if (slashIdx >= 0) c = c.substring(0, slashIdx).trim();
      if (c && !seenNums.has(c)) { allNumbers.push(c); seenNums.add(c); }
    };
    const parseCertText = (raw) => {
      if (!raw) return false;
      const text = raw
        .replace(/\bHak\s+Milik\s+Atas\s+Satuan\s+Rumah\s+Susun\b/gi, "STRATA")
        .replace(/\bSerti[fp]ikat\s+Hak\s+Milik\b/gi, "SHM")
        .replace(/\bSerti[fp]ikat\s+Hak\s+Guna\s+Bangunan\b/gi, "SHGB")
        .replace(/\bSerti[fp]ikat\s+Hak\s+Pakai\b/gi, "HP")
        .replace(/\bS\.?\s*H\.?\s*G\.?\s*B\.?\b/gi, "SHGB")
        .replace(/\bS\.?\s*H\.?\s*M\.?\b/gi, "SHM");
      const m1 = text.match(/\b(SHM|SHGB|HGB|HPL|HP|STRATA|HAK\s*PAKAI|HAK\s*MILIK)\b\s*(?:No\.?|Nomor)\s*[:.]?\s*([0-9]+(?:\/[A-Za-z0-9.\-]+)?)/i);
      if (m1) { if (!primaryType) primaryType = m1[1].replace(/\s+/g, "").toUpperCase(); addNum(m1[2]); return true; }
      const m2 = text.match(/\b(SHM|SHGB|HGB|HPL|HP|STRATA)\b\s+([0-9]+(?:\/[A-Za-z0-9.\-]+)?)\b/i);
      if (m2) { if (!primaryType) primaryType = m2[1].replace(/\s+/g, "").toUpperCase(); addNum(m2[2]); return true; }
      if (!primaryType) {
        const tm = text.match(/\b(SHM|SHGB|HGB|HPL|HP|STRATA|HAK\s*PAKAI|HAK\s*MILIK)\b/i);
        if (tm) { primaryType = tm[1].replace(/\s+/g, "").toUpperCase(); return true; }
      }
      return false;
    };

    // Strategi 0 (PRIMARY): label "Bukti Kepemilikan" → siblings
    const buktiLabels = Array.from(document.querySelectorAll("div")).filter(
      (el) => el.children.length === 0 && /^Bukti\s*Kepemilikan$/i.test((el.textContent || "").trim())
    );
    for (const lbl of buktiLabels) {
      const parent = lbl.parentElement;
      if (!parent) continue;
      const textXs = Array.from(parent.querySelectorAll("div.text-xs, div[class*='text-xs']"));
      const textXsRaws = textXs.map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim()).filter(Boolean);
      for (const raw of textXsRaws) parseCertText(raw);
      if ((!primaryType || allNumbers.length === 0) && textXsRaws.length > 1) parseCertText(textXsRaws.join(" "));
      if (!primaryType || allNumbers.length === 0) {
        const kids = Array.from(parent.children);
        const idx = kids.indexOf(lbl);
        const sibTexts = [];
        for (let i = idx + 1; i < kids.length; i++) {
          const t = kids[i].textContent?.replace(/\s+/g, " ").trim() ?? "";
          if (t) sibTexts.push(t);
        }
        for (const t of sibTexts) parseCertText(t);
        if ((!primaryType || allNumbers.length === 0) && sibTexts.length > 0) parseCertText(sibTexts.join(" "));
      }
      if (!primaryType || allNumbers.length === 0) {
        const full = (parent.textContent ?? "").replace(/\s+/g, " ").trim();
        if (full) parseCertText(full);
      }
      if (primaryType && allNumbers.length === 0) {
        const DATE_RE = /\b\d{1,2}\s+(jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des)[a-z]*\.?\s*\d{0,4}\b/i;
        for (const t of textXsRaws) {
          if (DATE_RE.test(t)) continue;
          const cleaned = t.replace(DATE_RE, " ");
          const nm = cleaned.match(/\b(\d{2,7}(?:\/[A-Za-z0-9.\-]+)?)\b/);
          if (nm) { addNum(nm[1]); break; }
        }
      }
    }
    if (primaryType || allNumbers.length > 0)
      return { sertifikat: primaryType, nomorLegalitas: allNumbers.length ? allNumbers.join(",") : null };

    // Strategi 1: container bg-primary-100/5
    const containers = Array.from(document.querySelectorAll("div")).filter((el) => {
      const cls = String(el.className || "");
      return cls.includes("overflow-auto") && cls.includes("rounded-lg") && cls.includes("bg-primary-100/5");
    });
    const certContainer = containers.find((c) => /Bukti\s*Kepemilikan/i.test(c.textContent ?? "")) ?? null;
    if (certContainer) {
      const certEls = Array.from(certContainer.querySelectorAll("div.text-xs"));
      for (const el of certEls) parseCertText((el.textContent ?? "").replace(/\s+/g, " ").trim());
      if (primaryType || allNumbers.length > 0)
        return { sertifikat: primaryType, nomorLegalitas: allNumbers.length ? allNumbers.join(",") : null };
    }

    // Strategi 2: grid rows
    const dataRows = Array.from(document.querySelectorAll("div[class*='grid-cols']")).filter((el) => {
      const cls = String(el.className || "");
      return cls.includes("grid") && /Bukti\s*Kepemilikan|SHM|HGB|SHGB|HPL/i.test(el.textContent ?? "");
    });
    for (const row of dataRows) {
      const cols = Array.from(row.children);
      let matched = false;
      for (const col of cols) {
        if (parseCertText((col.textContent ?? "").replace(/\s+/g, " ").trim())) { matched = true; break; }
      }
      if (!matched) parseCertText((row.textContent ?? "").replace(/\s+/g, " ").trim());
    }
    if (primaryType || allNumbers.length > 0)
      return { sertifikat: primaryType, nomorLegalitas: allNumbers.length ? allNumbers.join(",") : null };

    // Strategi 3: label → sibling
    const kepLabels = Array.from(document.querySelectorAll("div, span, p, td, th")).filter(
      (el) => el.children.length === 0 && /^Bukti\s*Kepemilikan$/i.test(el.textContent?.trim() ?? "")
    );
    for (const lbl of kepLabels) {
      const parent = lbl.parentElement;
      if (!parent) continue;
      const kids = Array.from(parent.children);
      const idx = kids.indexOf(lbl);
      for (let i = idx + 1; i < kids.length; i++) {
        const raw = kids[i].textContent?.replace(/\s+/g, " ").trim() ?? "";
        if (raw && parseCertText(raw)) break;
      }
    }
    if (primaryType || allNumbers.length > 0)
      return { sertifikat: primaryType, nomorLegalitas: allNumbers.length ? allNumbers.join(",") : null };

    // Strategi 4: label alternatif
    for (const labelTxt of ["Sertifikat", "Jenis Hak", "Jenis Sertifikat", "Bukti Hak"]) {
      const el = Array.from(document.querySelectorAll("div, span, td, th, p")).find(
        (e) => e.children.length === 0 && new RegExp("^" + labelTxt + "$", "i").test(e.textContent?.trim() ?? "")
      );
      if (el) {
        const sib = el.nextElementSibling ?? el.parentElement?.nextElementSibling;
        const raw = sib?.textContent?.replace(/\s+/g, " ").trim() ?? "";
        if (parseCertText(raw)) break;
      }
    }
    if (primaryType || allNumbers.length > 0)
      return { sertifikat: primaryType, nomorLegalitas: allNumbers.length ? allNumbers.join(",") : null };

    // Strategi 5: regex bodyText
    const bodyText = document.body.textContent ?? "";
    const CERT_RE = /\b(SHM|SHGB|HGB|HPL|Hak\s+Pakai)\s*(?:No\.?\s*|Nomor\s*)?[:\s]*([0-9]+(?:\/[A-Za-z0-9.\-]+)?)/gi;
    let cm;
    while ((cm = CERT_RE.exec(bodyText)) !== null) {
      if (!primaryType) primaryType = cm[1].replace(/\s+/g, "").toUpperCase();
      addNum(cm[2]);
    }
    if (!primaryType) {
      const typeOnly = bodyText.match(CERT_TYPE_RE);
      if (typeOnly) primaryType = typeOnly[1].replace(/\s+/g, "").toUpperCase();
    }
    return { sertifikat: primaryType, nomorLegalitas: allNumbers.length ? allNumbers.join(",") : null };
  })();

  const alamat = (() => {
    const scope = document.querySelector(".p-tabview-panel") || document.body;
    const els = scope.querySelectorAll("div.text-xs");
    for (let i = 0; i < els.length; i++) {
      const text = (els[i].textContent || "").replace(/\s+/g, " ").trim();
      if (/^Alamat\s*:/i.test(text)) {
        const value = text.replace(/^Alamat\s*:\s*/i, "").replace(/\s*Lihat\s+Lokasi.*$/i, "").trim();
        if (value.length > 5) return value;
      }
    }
    return null;
  })();

  const luasEl = Array.from(document.querySelectorAll("div.text-xs, td, p")).find((el) => /Luas\s*:/i.test(el.textContent ?? ""));
  const luasText = luasEl?.textContent ?? judul ?? "";

  return {
    judul,
    nilai_limit: nilaiLimit,
    uang_jaminan: uangJaminan,
    penjual,
    batas_penawaran: batasPenawaran,
    batas_jaminan: batasJaminan,
    sertifikat: cert.sertifikat,
    nomor_legalitas: cert.nomorLegalitas,
    alamat,
    luas_text: luasText,
    gambar: imgs,
  };
}

// ─── Lampiran: klik tab → download PDF → upload Drive (disalin dari route.ts) ─
async function downloadLampiran(detailTab, judul, drive) {
  const lampiranUrls = [];
  let tmpDir = null;
  try {
    tmpDir = await mkdtemp(join(tmpdir(), "lelang-pdf-"));

    try {
      const cdp = await detailTab.target().createCDPSession();
      await cdp.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: tmpDir });
    } catch {}

    const popupHandler = async (popup) => {
      try {
        const pcdp = await popup.target().createCDPSession();
        await pcdp.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: tmpDir });
      } catch {}
    };
    detailTab.on("popup", popupHandler);

    const navItems = await detailTab.evaluate(() => {
      let candidates = Array.from(document.querySelectorAll('[role="tab"]'));
      if (candidates.length === 0) candidates = Array.from(document.querySelectorAll(".p-tabview-nav-link"));
      if (candidates.length === 0) candidates = Array.from(document.querySelectorAll(".p-tabview-nav li, .p-tabview-header"));
      const seenText = new Set();
      const dedup = [];
      for (const c of candidates) {
        const txt = (c.textContent ?? "").replace(/\s+/g, " ").trim();
        if (!txt || seenText.has(txt)) continue;
        seenText.add(txt);
        dedup.push(c);
      }
      window.__navItems = dedup;
      return dedup.map((h, i) => ({ idx: i, text: (h.textContent ?? "").replace(/\s+/g, " ").trim().substring(0, 60) }));
    });

    const KW = /lampiran|pengumuman|dokumen|berkas/i;
    let itemsToVisit = navItems.filter((n) => KW.test(n.text));
    if (itemsToVisit.length === 0) itemsToVisit = navItems;

    const scanLinks = async () =>
      detailTab.evaluate(() => {
        const containers = Array.from(document.querySelectorAll("div")).filter((el) =>
          String(el.className || "").includes("bg-primary-100/5")
        );
        const links = [];
        const seenL = new Set();
        const addIf = (el) => {
          const cls = String(el.className || "");
          if (cls.includes("cursor-pointer") && cls.includes("text-xs") && cls.includes("underline") && !seenL.has(el)) {
            seenL.add(el);
            links.push(el);
          }
        };
        for (const c of containers) Array.from(c.querySelectorAll("div")).forEach(addIf);
        if (links.length === 0) Array.from(document.querySelectorAll("div")).forEach(addIf);
        window.__currentLinks = links;
        return links.length;
      });

    const clickLinks = async (linkCount) => {
      for (let i = 0; i < linkCount; i++) {
        try {
          const handle = await detailTab.evaluateHandle((idx) => {
            const links = window.__currentLinks ?? [];
            const el = links[idx];
            if (el) el.scrollIntoView({ block: "center" });
            return el ?? null;
          }, i);
          const el = handle.asElement();
          if (el) {
            await el.click().catch(async () => {
              await detailTab.evaluate((idx) => { (window.__currentLinks ?? [])[idx]?.click(); }, i);
            });
          }
          await handle.dispose().catch(() => {});
          await sleep(3000);
        } catch {}
      }
    };

    const visitedPanels = new Set();
    for (const item of itemsToVisit) {
      try {
        const prePanels = await detailTab.evaluate(
          () => document.querySelectorAll(".p-tabview-panel, [role='tabpanel']").length
        );

        await detailTab.evaluate((idx) => {
          const items = window.__navItems ?? [];
          const el = items[idx];
          if (!el) return;
          el.scrollIntoView({ block: "center" });
          const target =
            el.matches('[role="tab"]') || el.tagName === "A" || el.tagName === "BUTTON"
              ? el
              : el.querySelector('a[role="tab"], a, button, [role="tab"]') ?? el;
          const opts = { bubbles: true, cancelable: true, view: window, button: 0 };
          target.dispatchEvent(new MouseEvent("pointerdown", opts));
          target.dispatchEvent(new MouseEvent("mousedown", opts));
          target.dispatchEvent(new MouseEvent("pointerup", opts));
          target.dispatchEvent(new MouseEvent("mouseup", opts));
          target.dispatchEvent(new MouseEvent("click", opts));
          try { target.click(); } catch {}
        }, item.idx);

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
        await sleep(1000);

        const linkCount = await scanLinks();
        if (linkCount === 0) continue;

        const fingerprint = await detailTab.evaluate(() =>
          (window.__currentLinks ?? []).map((el) => (el.textContent ?? "").trim()).join("|")
        );
        if (visitedPanels.has(fingerprint)) continue;
        visitedPanels.add(fingerprint);

        await clickLinks(linkCount);
        await sleep(1200);
      } catch {}
    }

    if (navItems.length === 0) {
      const linkCount = await scanLinks();
      if (linkCount > 0) await clickLinks(linkCount);
    }

    detailTab.off("popup", popupHandler);

    // Tunggu download selesai
    const isPartial = (n) => /\.(crdownload|tmp|part)$/i.test(n);
    await sleep(1500);
    for (let attempt = 0; attempt < 15; attempt++) {
      const files = await readdir(tmpDir);
      if (files.length === 0) { await sleep(1500); continue; }
      if (!files.some(isPartial)) break;
      await sleep(1500);
    }

    const allFiles = await readdir(tmpDir);
    const pdfFiles = allFiles.filter((f) => !isPartial(f));

    if (pdfFiles.length > 0 && drive) {
      const slugBase = slugify(judul ?? "lelang").substring(0, 60);
      for (let i = 0; i < pdfFiles.length; i++) {
        const filename = pdfFiles[i];
        try {
          const buffer = await readFile(join(tmpDir, filename));
          if (buffer.length < 1024) continue;
          if (buffer.slice(0, 4).toString() !== "%PDF") continue;
          const driveName = `${slugBase}_${Date.now()}_${i + 1}_${filename}`.substring(0, 200);
          const fileId = await uploadPdfToDrive(drive, buffer, driveName);
          if (fileId) lampiranUrls.push(`https://drive.google.com/file/d/${fileId}/view`);
        } catch {}
      }
    }
  } catch {
    /* lampiran best-effort */
  } finally {
    if (tmpDir) { try { await rm(tmpDir, { recursive: true, force: true }); } catch {} }
  }
  return lampiranUrls;
}

// ─── Page setup: blokir gambar/font/media via CDP (tidak ganggu download PDF) ─
async function setupPage(browser) {
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  try {
    const client = await page.target().createCDPSession();
    await client.send("Network.enable");
    await client.send("Network.setBlockedURLs", {
      urls: [
        "*.jpg", "*.jpeg", "*.png", "*.gif", "*.webp", "*.svg", "*.ico",
        "*.woff", "*.woff2", "*.ttf", "*.otf",
        "*.mp4", "*.webm", "*.avi", "*.mov",
      ],
    });
  } catch {}
  return page;
}

async function collectPageLinks(browser, kategori, page) {
  const tab = await setupPage(browser);
  try {
    const listUrl = `${BASE_URL}/lot-lelang/katalog-lot-lelang?kategori=${encodeURIComponent(kategori)}&page=${page}`;
    await tab.goto(listUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await tab
      .waitForFunction(`document.querySelectorAll('a[href*="/detail-auction/"]').length > 0`, { timeout: 20000 })
      .catch(() => {});
    const links = await tab.evaluate((base) => {
      const a = Array.from(document.querySelectorAll('a[href*="/detail-auction/"]'));
      return [...new Set(a.map((x) => (base + x.getAttribute("href")).replace(/\/+$/, "")))];
    }, BASE_URL);
    return { listUrl, links };
  } finally {
    await tab.close().catch(() => {});
  }
}

async function scrapeDetail(browser, detailUrl, doLampiran, drive) {
  const detailTab = await setupPage(browser);
  try {
    await detailTab.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 90000 });

    await detailTab
      .waitForFunction(`document.querySelector("h3") !== null && document.body.textContent.trim().length > 500`, { timeout: 25000 })
      .catch(() => {});

    // Tunggu section "Bukti Kepemilikan" — STRICT (krusial untuk akurasi sertifikat)
    await detailTab
      .waitForFunction(
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
      )
      .catch(() => {});

    await sleep(800);

    // Scroll + force lazy-load supaya atribut src/data-src gambar terisi
    await detailTab.evaluate(async () => {
      window.scrollTo(0, Math.floor(document.body.scrollHeight * 0.4));
      await new Promise((r) => setTimeout(r, 250));
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise((r) => setTimeout(r, 300));
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 150));
      const el = document.querySelector("div.scrollbar-hide");
      if (el) {
        for (let x = 0; x <= el.scrollWidth; x += 200) {
          el.scrollLeft = x;
          await new Promise((r) => setTimeout(r, 80));
        }
      }
      document.querySelectorAll("img[data-src]").forEach((img) => { if (!img.src || img.src === window.location.href) img.src = img.dataset.src; });
      document.querySelectorAll("img[data-lazy]").forEach((img) => { if (!img.src || img.src === window.location.href) img.src = img.dataset.lazy; });
      document.querySelectorAll("img[data-original]").forEach((img) => { if (!img.src || img.src === window.location.href) img.src = img.dataset.original; });
    });
    await sleep(600);

    const data = await detailTab.evaluate(extractListingData);
    if (!data || !data.judul) return null;

    let lampiranUrls = [];
    if (doLampiran && drive) {
      lampiranUrls = await downloadLampiran(detailTab, data.judul, drive);
    }
    return { data, lampiranUrls };
  } finally {
    await detailTab.close().catch(() => {});
  }
}

// ─── Pool paralel sederhana ──────────────────────────────────────────────────
async function runPool(items, limit, worker) {
  let idx = 0;
  const n = Math.max(1, Math.min(limit, items.length));
  const runners = Array.from({ length: n }, async () => {
    while (idx < items.length) {
      const i = idx++;
      await worker(items[i]);
    }
  });
  await Promise.all(runners);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Lihat komentar di atas file untuk daftar flag. Contoh:\n  node scripts/scrape-lelang.mjs --kategori Rumah --max-pages 3");
    return;
  }

  const kategori = args.kategori || "Rumah";
  let page = args.startPage || 1;
  const maxPages = args.maxPages || 0;
  const concurrency = args.concurrency || 4;
  const dryRun = !!args.dryRun;
  const wantLampiran = args.lampiran !== false; // default true

  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL tidak ada di .env");
    process.exit(1);
  }

  // Tentukan agent pemilik listing
  let agentId = args.agent;
  if (!agentId) {
    const ag = await prisma.agent.findFirst({ select: { id_agent: true } });
    agentId = ag?.id_agent;
  }
  if (!agentId) {
    console.error("❌ Tidak ada agent di DB. Jalankan ulang dengan --agent <id_agent>.");
    process.exit(1);
  }

  // Drive hanya disiapkan kalau butuh lampiran & bukan dry-run
  const drive = wantLampiran && !dryRun ? getDrive() : null;
  const effectiveLampiran = wantLampiran && !dryRun && !!drive;
  if (wantLampiran && !dryRun && !drive)
    log("⚠️ Kredensial Google Drive tidak lengkap di .env → lampiran dilewati.");
  if (wantLampiran && dryRun)
    log("ℹ️ dry-run aktif → lampiran (download/upload Drive) dilewati.");

  log(
    `Mulai — kategori=${kategori} startPage=${page} maxPages=${maxPages || "∞"} ` +
    `concurrency=${concurrency} lampiran=${effectiveLampiran} dryRun=${dryRun} agent=${agentId}`
  );

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  let totalSaved = 0;
  let totalSkipped = 0;
  let pagesDone = 0;
  const startedAt = Date.now();

  try {
    const existing = await prisma.listing.findMany({ where: { link: { not: null } }, select: { link: true } });
    const existingSet = new Set(existing.map((l) => l.link.trim()));
    log(`${existingSet.size} listing sudah ada di DB.`);

    while (true) {
      if (maxPages && pagesDone >= maxPages) { log(`Mencapai max-pages (${maxPages}).`); break; }

      let listUrl, links;
      try {
        ({ listUrl, links } = await collectPageLinks(browser, kategori, page));
      } catch (e) {
        log(`Halaman ${page}: gagal load (${String(e.message).substring(0, 60)}). Stop.`);
        break;
      }

      log(`Halaman ${page}: ${links.length} listing — ${listUrl}`);
      if (links.length === 0) { log(`Halaman ${page}: kosong, selesai.`); break; }

      const newLinks = links.filter((u) => !existingSet.has(u));
      const skipped = links.length - newLinks.length;
      totalSkipped += skipped;
      if (skipped) log(`  ↳ ${skipped} sudah ada, skip.`);

      if (newLinks.length === 0) { page++; pagesDone++; continue; }
      newLinks.forEach((u) => existingSet.add(u)); // klaim agar tak diproses dobel antar worker

      await runPool(newLinks, concurrency, async (detailUrl) => {
        const t0 = Date.now();
        try {
          const res = await scrapeDetail(browser, detailUrl, effectiveLampiran, drive);
          if (!res) { log(`  ⚠️ skip (judul kosong): ${detailUrl}`); return; }
          const { data, lampiranUrls } = res;

          const alamat = data.alamat ?? "";
          const kota = extractKota(data.judul, alamat);
          const { provinsi, kecamatan, kelurahan } = parseWilayahFromAlamat(alamat);
          const luas = extractLuas(data.luas_text ?? data.judul ?? "");
          const tanggalLelang = parseTanggal(data.batas_penawaran);
          const legalitas = mapLegalitas(data.sertifikat);
          const kategoriEnum = mapKategori(kategori);
          const slugFinal = `${slugify(data.judul)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const em = { rumah: "🏡", apartemen: "🏢", gudang: "📦", pabrik: "🏭", toko: "🏬", tanah: "🌱", "hotel dan villa": "🏨", ruko: "🏢" };
          const deskripsi = `${em[kategori.toLowerCase()] ?? "✨"} Lelang ${kategori} – LT ${luas ?? "?"} m² – ${kota}`;
          const secs = ((Date.now() - t0) / 1000).toFixed(1);

          if (dryRun) {
            totalSaved++;
            log(`  [dry] ${data.judul} | ${kota} | ${data.sertifikat ?? "-"} ${data.nomor_legalitas ?? ""} | Rp${data.nilai_limit} | img:${data.gambar.length} (${secs}s)`);
            return;
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
              harga: 0,
              harga_per_meter: data.nilai_limit && luas && luas > 0 ? Math.round(data.nilai_limit / luas) : null,
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
              nomor_legalitas: data.nomor_legalitas ? data.nomor_legalitas.substring(0, 250) : null,
              gambar: data.gambar.length > 0 ? data.gambar.join(",") : null,
              lampiran: lampiranUrls.length > 0 ? lampiranUrls.join(",") : null,
            },
          });

          totalSaved++;
          log(`  ✅ ${data.judul} | ${kota} | pdf:${lampiranUrls.length} img:${data.gambar.length} (${secs}s) [total:${totalSaved}]`);
        } catch (e) {
          log(`  ⚠️ gagal ${detailUrl}: ${String(e.message).substring(0, 100)}`);
        }
      });

      page++;
      pagesDone++;
      log(`— Halaman selesai. tersimpan=${totalSaved}, skip=${totalSkipped}`);
    }
  } finally {
    await browser.close().catch(() => {});
    await prisma.$disconnect();
  }

  const mins = ((Date.now() - startedAt) / 60000).toFixed(1);
  log(`SELESAI. Tersimpan=${totalSaved}, Skip=${totalSkipped}, Halaman=${pagesDone}, Durasi=${mins} menit`);
}

main().catch(async (e) => {
  console.error("FATAL:", e);
  try { await prisma.$disconnect(); } catch {}
  process.exit(1);
});

// scripts/scrape-lelang.mjs
// ───────────────────────────────────────────────────────────────────────────────
// Scraper lelang.go.id — versi TERMINAL v2 (API-BASED, tanpa Puppeteer/Chrome).
//
// Terobosan: lelang.go.id hanyalah SPA tipis di atas API JSON publik
// (api.lelang.go.id). Alih-alih membuka browser dan mengorek carousel/tab yang
// rapuh (penyebab cuma 2 gambar & lampiran suka bolong), kita baca langsung
// sumber datanya. Hasilnya:
//   • Gambar LENGKAP  → semua foto (bukan cuma 2) dari field `photos[]`.
//   • Lampiran LENGKAP → semua PDF pengumuman dari endpoint `pengumumans`.
//   • Data akurat      → alamat/luas/sertifikat/tanggal langsung terstruktur
//     (tak perlu 6 strategi regex DOM lagi).
//   • Efisien & ringan → murni fetch HTTP, tanpa Chrome (hemat RAM), konkuren.
//   • Tahu kapan berhenti → API kasih `totalPage`/`totalItem`, jadi menjelajah
//     SEMUA halaman sampai habis (tidak lagi berhenti dini di 3 halaman skip).
//
// Endpoint yang dipakai (v1):
//   GET /landing-page/kategori                                  → daftar kategori
//   GET /landing-page/katalog-lot-lelang?limit&dcp&namakategori[]&page → daftar lot
//   GET /landing-page/info/{lotLelangId}                        → detail + photos
//   GET /public/permohonan/{permohonanId}/pengumumans          → PDF lampiran
//   GET /koordinat/frontoffice/get-fo/{barangId}               → lat/long (bonus)
// File publik: https://file.lelang.go.id/lelang/{folder}/{fileName}
//
// Cara pakai:
//   node scripts/scrape-lelang.mjs --kategori Rumah
//   node scripts/scrape-lelang.mjs --kategori Tanah --max-pages 3 --concurrency 8
//   node scripts/scrape-lelang.mjs --kategori Ruko --dry-run       (uji, tanpa DB/Drive)
//   node scripts/scrape-lelang.mjs --kategori Rumah --lampiran-url  (simpan URL PDF langsung, tanpa Drive)
//   node scripts/scrape-lelang.mjs --kategori Rumah --refresh       (backfill: update gambar/lampiran listing lama)
//
// Flag:
//   --kategori <nama>     default "Rumah" (Rumah|Apartemen|Ruko|Tanah|Gudang|Hotel dan Villa|Toko|Pabrik)
//   --start-page <n>      default 1
//   --max-pages <n>       default 0 (= sampai halaman terakhir)
//   --limit <n>           item per halaman katalog, default 100 (makin besar makin sedikit request)
//   --concurrency <n>     default 6 (jumlah detail listing diproses paralel)
//   --agent <id>          id_agent pemilik listing (default: agent pertama di DB)
//   --stop-after-skip <n> berhenti setelah N halaman beruntun yang semua listing-nya sudah ada
//                         (mode inkremental cepat). default 0 = JANGAN berhenti dini (jelajah semua).
//   --refresh             proses juga listing yang sudah ada → UPDATE gambar/lampiran/koordinatnya
//                         (backfill data lama yang cuma punya 2 gambar). default: skip yang sudah ada.
//   --lampiran-url        simpan URL PDF langsung dari file.lelang.go.id (cepat, tanpa upload Drive)
//   --no-lampiran         jangan ambil lampiran sama sekali (paling cepat)
//   --no-coords           jangan ambil koordinat lat/long
//   --dry-run             scrape + tampilkan hasil TANPA menulis DB & tanpa Drive
// ───────────────────────────────────────────────────────────────────────────────

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { google } from "googleapis";
import { Readable } from "stream";

const prisma = new PrismaClient();

const API = "https://api.lelang.go.id/api/v1";
const FILE_BASE = "https://file.lelang.go.id/lelang";
const SITE = "https://lelang.go.id";
const LAMPIRAN_FOLDER_ID = "1yMtRi1DbiINlGSFzHzGj-MT8f7C-UANJ";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const JSON_HEADERS = {
  "User-Agent": UA,
  Accept: "application/json",
  Origin: SITE,
  Referer: SITE + "/",
};

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
    else if (a === "--lampiran-url") out.lampiranUrl = true;
    else if (a === "--no-coords") out.coords = false;
    else if (a === "--refresh") out.refresh = true;
    else if (a === "--kategori") out.kategori = argv[++i];
    else if (a === "--start-page") out.startPage = parseInt(argv[++i], 10);
    else if (a === "--max-pages") out.maxPages = parseInt(argv[++i], 10);
    else if (a === "--limit") out.limit = parseInt(argv[++i], 10);
    else if (a === "--concurrency") out.concurrency = parseInt(argv[++i], 10);
    else if (a === "--stop-after-skip") out.stopAfterSkip = parseInt(argv[++i], 10);
    else if (a === "--agent") out.agent = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

// ─── HTTP helpers (retry + backoff + timeout) ────────────────────────────────
async function fetchJson(url, { retries = 4, timeoutMs = 30000, label = "" } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new Error("timeout")), timeoutMs);
    try {
      const res = await fetch(url, { headers: JSON_HEADERS, signal: ctrl.signal });
      clearTimeout(timer);
      if (res.status === 404) return null; // tidak ada data → bukan error fatal
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (attempt < retries) await sleep(800 * attempt * attempt); // 0.8s,3.2s,7.2s
    }
  }
  throw new Error(`${label || "fetchJson"} gagal: ${String(lastErr?.message || lastErr)}`);
}

async function fetchBuffer(url, { retries = 3, timeoutMs = 60000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new Error("timeout")), timeoutMs);
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
        return null;
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      clearTimeout(timer);
      if (attempt >= retries) return null;
      await sleep(1000 * attempt);
    }
  }
  return null;
}

// ─── Helpers domain (disalin/diselaraskan dari route.ts) ─────────────────────
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
  if (u.includes("HGB") || u.includes("SHGB")) return "HGB";
  if (u.includes("HGU")) return "HGU";
  if (u.includes("STRATA")) return "STRATA_TITLE";
  if (u.includes("PPJB")) return "PPJB";
  if (u.includes("AJB")) return "AJB";
  if (u.includes("HP") || u.includes("HAK PAKAI")) return "HP";
  return "LAINNYA";
}

function parseDateIso(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
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
  return null;
}

// Title-case "KOTA SORONG" → "Kota Sorong" (fallback kota dari namaLokasi)
function titleCase(s) {
  if (!s) return null;
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, " ").trim();
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

// namaLotLelang mengandung HTML (mis. "335 m<sup>2</sup>") → bersihkan.
function cleanJudul(s) {
  return (s || "")
    .replace(/<sup>\s*2\s*<\/sup>/gi, "²")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim() || null;
}

// ─── Ekstraksi dari struktur API (pengganti scraping DOM) ────────────────────
function buildLink(unitKerjaId, lotLelangId) {
  return `${SITE}/kpknl/${unitKerjaId}/detail-auction/${lotLelangId}`;
}

// Semua URL gambar dari photos[] — cover didahulukan, dedup, tanpa batas jumlah.
function imageUrlsFromPhotos(photos) {
  if (!Array.isArray(photos)) return [];
  const ordered = [...photos].sort((a, b) => (b?.iscover === true) - (a?.iscover === true));
  const seen = new Set();
  const urls = [];
  for (const p of ordered) {
    const f = p?.file;
    if (!f || p?.deletedAt) continue;
    const folder = String(f.folder || "").replace(/^\/+|\/+$/g, "");
    const name = String(f.fileName || "").trim();
    if (!folder || !name) continue;
    const u = `${FILE_BASE}/${folder}/${name}`;
    if (!seen.has(u)) { seen.add(u); urls.push(u); }
  }
  return urls;
}

// Sertifikat & nomor legalitas dari content.barangs[] (bisa banyak bidang).
function certFromBarangs(barangs) {
  const CERT_RE = /\b(SHM|SHGB|HGB|HGU|HPL|STRATA|AJB|PPJB|HP|HAK\s*PAKAI|HAK\s*MILIK)\b/i;
  let tipeRaw = null;
  const nums = [];
  const seen = new Set();
  for (const b of barangs || []) {
    const raw = String(b?.buktiKepemilikan || "").trim();
    if (!tipeRaw && raw) {
      const m = raw.match(CERT_RE);
      if (m) tipeRaw = m[1];
    }
    const no = String(b?.buktiKepemilikanNo || "").trim().replace(/[.,;:]+$/, "");
    if (no && !seen.has(no)) { seen.add(no); nums.push(no); }
  }
  return { sertifikatRaw: tipeRaw, nomor: nums.length ? nums.join(",") : null };
}

function totalLuas(barangs) {
  let sum = 0;
  let found = false;
  for (const b of barangs || []) {
    const n = parseFloat(String(b?.luas ?? "").replace(",", "."));
    if (!isNaN(n) && n > 0) { sum += n; found = true; }
  }
  return found ? Math.floor(sum) : null;
}

function firstAlamat(barangs) {
  for (const b of barangs || []) {
    const a = String(b?.alamat || "").replace(/\s+/g, " ").trim();
    if (a.length > 5) return a;
  }
  return "";
}

// ─── Google Drive (replika dari route.ts, OAuth2 dari .env) ───────────────────
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

// ─── Ambil daftar URL PDF lampiran (pengumuman) ──────────────────────────────
async function fetchLampiranPdfUrls(permohonanId) {
  if (!permohonanId) return [];
  const j = await fetchJson(`${API}/public/permohonan/${permohonanId}/pengumumans`, {
    label: "pengumumans",
  }).catch(() => null);
  const docs = j?.data ?? [];
  const seen = new Set();
  const urls = [];
  for (const d of docs) {
    const fileUrl = String(d?.file?.fileUrl || "").replace(/^\/+/, "");
    if (!fileUrl) continue;
    const u = `${FILE_BASE}/${fileUrl}`;
    if (!seen.has(u)) { seen.add(u); urls.push(u); }
  }
  return urls;
}

// ─── Koordinat (bonus, best-effort) ──────────────────────────────────────────
async function fetchCoords(barangId) {
  if (!barangId) return { latitude: null, longitude: null };
  try {
    const j = await fetchJson(`${API}/koordinat/frontoffice/get-fo/${barangId}`, {
      retries: 2, label: "koordinat",
    });
    const lat = parseFloat(j?.data?.latitude);
    const lng = parseFloat(j?.data?.longitude);
    return {
      latitude: isNaN(lat) ? null : lat,
      longitude: isNaN(lng) ? null : lng,
    };
  } catch {
    return { latitude: null, longitude: null };
  }
}

// ─── Resolusi nama kategori ke nama kanonik yang dikenal API ─────────────────
async function resolveKategori(input) {
  try {
    const j = await fetchJson(`${API}/landing-page/kategori`, { label: "kategori" });
    const list = j?.data ?? [];
    const found = list.find(
      (k) => String(k?.nama || "").toLowerCase() === input.toLowerCase()
    );
    if (found) return found.nama;
    log(`⚠️ Kategori "${input}" tidak persis cocok. Tersedia: ${list.map((k) => k.nama).join(", ")}`);
  } catch (e) {
    log(`⚠️ Gagal ambil daftar kategori (${String(e.message).slice(0, 60)}). Pakai apa adanya.`);
  }
  return input;
}

// ─── Ambil satu halaman katalog ──────────────────────────────────────────────
async function fetchCatalogPage(kategori, page, limit) {
  const url =
    `${API}/landing-page/katalog-lot-lelang?limit=${limit}&dcp=true` +
    `&namakategori[]=${encodeURIComponent(kategori)}&page=${page}`;
  const j = await fetchJson(url, { label: `katalog p${page}` });
  const items = (j?.data ?? []).map((it) => ({
    lotLelangId: it.lotLelangId,
    unitKerjaId: it.unitKerjaId,
    link: buildLink(it.unitKerjaId, it.lotLelangId),
  }));
  return { items, totalPage: j?.totalPage ?? 0, totalItem: j?.totalItem ?? 0, url };
}

// ─── Ambil & rakit satu listing detail dari API ──────────────────────────────
async function buildListingRecord(item, { kategori, agentId, wantLampiran, lampiranUrlMode, wantCoords, drive, dryRun }) {
  const info = await fetchJson(`${API}/landing-page/info/${item.lotLelangId}`, {
    label: "info",
  });
  const d = info?.data;
  if (!d) return null;

  const judul = cleanJudul(d.namaLotLelang);
  if (!judul) return null;

  const barangs = d.content?.barangs ?? [];
  const seller = d.content?.seller ?? {};
  const gambar = imageUrlsFromPhotos(d.photos);
  const alamat = firstAlamat(barangs);
  const kota = extractKota(judul, alamat) || titleCase(d.namaLokasi) || "Tidak Diketahui";
  const { provinsi, kecamatan, kelurahan } = parseWilayahFromAlamat(alamat);
  const luas = totalLuas(barangs) ?? extractLuas(judul);
  const { sertifikatRaw, nomor } = certFromBarangs(barangs);
  const legalitas = mapLegalitas(sertifikatRaw);
  const tanggalLelang =
    parseDateIso(d.tglSelesaiLelang) ||
    parseDateIso(d.tanggalBatasJaminan) ||
    new Date(Date.now() + 30 * 86400000);
  const nilaiLimit = Number(d.nilaiLimit) || 0;
  const uangJaminan = Number(d.uangJaminan) || null;
  const penjual =
    seller.namaOrganisasiPenjual || seller.namaPenjual || d.namaUnitKerja || null;

  // Koordinat (best-effort) dari barang pertama
  let latitude = null, longitude = null;
  if (wantCoords && barangs[0]?.id) {
    ({ latitude, longitude } = await fetchCoords(barangs[0].id));
  }

  // Lampiran PDF
  let lampiranUrls = [];
  if (wantLampiran) {
    const pdfUrls = await fetchLampiranPdfUrls(d.permohonanId);
    if (lampiranUrlMode || dryRun || !drive) {
      // Simpan URL langsung (tanpa download / upload Drive)
      lampiranUrls = pdfUrls;
    } else {
      // Download tiap PDF → validasi → upload ke Drive
      const slugBase = slugify(judul).substring(0, 60);
      for (let i = 0; i < pdfUrls.length; i++) {
        const buffer = await fetchBuffer(pdfUrls[i]);
        if (!buffer || buffer.length < 1024) continue;
        if (buffer.slice(0, 4).toString() !== "%PDF") continue;
        try {
          const driveName = `${slugBase}_${Date.now()}_${i + 1}.pdf`.substring(0, 200);
          const fileId = await uploadPdfToDrive(drive, buffer, driveName);
          if (fileId) lampiranUrls.push(`https://drive.google.com/file/d/${fileId}/view`);
        } catch {}
      }
    }
  }

  const em = { rumah: "🏡", apartemen: "🏢", gudang: "📦", pabrik: "🏭", toko: "🏬", tanah: "🌱", "hotel dan villa": "🏨", ruko: "🏢" };
  const deskripsi = `${em[kategori.toLowerCase()] ?? "✨"} Lelang ${kategori} – LT ${luas ?? "?"} m² – ${kota}`;

  return {
    // untuk create():
    create: {
      id_agent: agentId,
      vendor: penjual ?? `Balai Lelang - ${kategori}`,
      judul,
      slug: `${slugify(judul)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      deskripsi,
      jenis_transaksi: "LELANG",
      kategori: mapKategori(kategori),
      status_tayang: "TERSEDIA",
      harga: 0,
      harga_per_meter: nilaiLimit && luas && luas > 0 ? Math.round(nilaiLimit / luas) : null,
      nilai_limit_lelang: nilaiLimit,
      uang_jaminan: uangJaminan,
      tanggal_lelang: tanggalLelang,
      link: item.link,
      alamat_lengkap: alamat.substring(0, 500) || null,
      provinsi,
      kota,
      kecamatan: kecamatan ?? null,
      kelurahan: kelurahan ?? null,
      latitude,
      longitude,
      luas_tanah: luas,
      legalitas,
      nomor_legalitas: nomor ? nomor.substring(0, 250) : null,
      gambar: gambar.length > 0 ? gambar.join(",") : null,
      lampiran: lampiranUrls.length > 0 ? lampiranUrls.join(",") : null,
    },
    // untuk update() (refresh/backfill — hanya field pengayaan):
    enrich: {
      alamat_lengkap: alamat.substring(0, 500) || undefined,
      provinsi: provinsi ?? undefined,
      kecamatan: kecamatan ?? undefined,
      kelurahan: kelurahan ?? undefined,
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
      luas_tanah: luas ?? undefined,
      legalitas: legalitas ?? undefined,
      nomor_legalitas: nomor ? nomor.substring(0, 250) : undefined,
      gambar: gambar.length > 0 ? gambar.join(",") : undefined,
      lampiran: lampiranUrls.length > 0 ? lampiranUrls.join(",") : undefined,
      tanggal_diupdate: new Date(),
    },
    stats: { judul, kota, img: gambar.length, pdf: lampiranUrls.length },
  };
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
    console.log("Lihat komentar di atas file untuk daftar flag. Contoh:\n  node scripts/scrape-lelang.mjs --kategori Rumah");
    return;
  }

  const kategoriInput = args.kategori || "Rumah";
  let page = args.startPage || 1;
  const maxPages = args.maxPages || 0;
  const limit = args.limit || 100;
  const concurrency = args.concurrency || 6;
  const dryRun = !!args.dryRun;
  const refresh = !!args.refresh;
  const wantLampiran = args.lampiran !== false; // default true
  const lampiranUrlMode = !!args.lampiranUrl;
  const wantCoords = args.coords !== false; // default true
  const stopAfterSkip = args.stopAfterSkip ?? 0; // default 0 = jelajah SEMUA halaman

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

  // Drive hanya disiapkan kalau butuh lampiran (mode Drive) & bukan dry-run
  const needDrive = wantLampiran && !lampiranUrlMode && !dryRun;
  const drive = needDrive ? getDrive() : null;
  if (needDrive && !drive)
    log("⚠️ Kredensial Google Drive tidak lengkap di .env → lampiran disimpan sebagai URL langsung.");

  const kategori = await resolveKategori(kategoriInput);

  const lampiranMode = !wantLampiran
    ? "off"
    : lampiranUrlMode || (needDrive && !drive)
    ? "url-langsung"
    : "drive";

  log(
    `Mulai — kategori=${kategori} startPage=${page} maxPages=${maxPages || "∞"} limit=${limit} ` +
    `concurrency=${concurrency} lampiran=${lampiranMode} coords=${wantCoords} ` +
    `refresh=${refresh} dryRun=${dryRun} agent=${agentId}`
  );

  // Shutdown rapi saat CTRL+C
  const shutdown = async () => {
    try { await prisma.$disconnect(); } catch {}
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  let totalSaved = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  let pagesDone = 0;
  let consecutiveAllSkip = 0;
  let knownTotalPage = 0;
  const startedAt = Date.now();

  try {
    const existing = await prisma.listing.findMany({ where: { link: { not: null } }, select: { link: true } });
    const existingSet = new Set(existing.map((l) => l.link.trim()));
    log(`${existingSet.size} listing sudah ada di DB.`);

    const opts = { kategori, agentId, wantLampiran, lampiranUrlMode, wantCoords, drive, dryRun };

    while (true) {
      if (maxPages && pagesDone >= maxPages) { log(`Mencapai max-pages (${maxPages}).`); break; }

      // Ambil halaman katalog (fetchJson sudah retry internal)
      let cat;
      try {
        cat = await fetchCatalogPage(kategori, page, limit);
      } catch (e) {
        log(`Halaman ${page}: gagal ambil katalog (${String(e.message).slice(0, 80)}). Stop.`);
        break;
      }
      knownTotalPage = cat.totalPage || knownTotalPage;

      if (cat.items.length === 0) { log(`Halaman ${page}: kosong → selesai (semua halaman terjelajah).`); break; }

      const totalTxt = knownTotalPage ? `/${knownTotalPage}` : "";
      log(`Halaman ${page}${totalTxt}: ${cat.items.length} listing (total katalog: ${cat.totalItem}).`);

      // Tentukan mana yang diproses
      const toProcess = refresh
        ? cat.items // refresh: proses semua (existing→update, baru→create)
        : cat.items.filter((it) => !existingSet.has(it.link));
      const skipped = cat.items.length - toProcess.length;
      totalSkipped += skipped;
      if (skipped) log(`  ↳ ${skipped} sudah ada, skip.`);

      // Mode inkremental cepat (opt-in): stop kalau N halaman beruntun full-skip
      if (!refresh && toProcess.length === 0) {
        consecutiveAllSkip++;
        if (stopAfterSkip > 0 && consecutiveAllSkip >= stopAfterSkip) {
          log(`${consecutiveAllSkip} halaman beruntun sudah ada semua → stop (mode inkremental).`);
          break;
        }
      } else {
        consecutiveAllSkip = 0;
      }

      // Klaim link baru agar tak dobel antar worker
      if (!refresh) toProcess.forEach((it) => existingSet.add(it.link));

      await runPool(toProcess, concurrency, async (item) => {
        const t0 = Date.now();
        try {
          const rec = await buildListingRecord(item, opts);
          if (!rec) { totalFailed++; log(`  ⚠️ skip (data kosong): ${item.link}`); return; }
          const secs = ((Date.now() - t0) / 1000).toFixed(1);

          if (dryRun) {
            totalSaved++;
            log(`  [dry] ${rec.stats.judul} | ${rec.stats.kota} | img:${rec.stats.img} pdf:${rec.stats.pdf} (${secs}s)`);
            return;
          }

          if (refresh) {
            const res = await prisma.listing.updateMany({ where: { link: item.link }, data: rec.enrich });
            if (res.count > 0) {
              totalUpdated++;
              log(`  🔄 ${rec.stats.judul} | ${rec.stats.kota} | img:${rec.stats.img} pdf:${rec.stats.pdf} (${secs}s) [upd:${totalUpdated}]`);
            } else {
              await prisma.listing.create({ data: rec.create });
              totalSaved++;
              log(`  ✅ ${rec.stats.judul} | ${rec.stats.kota} | img:${rec.stats.img} pdf:${rec.stats.pdf} (${secs}s) [baru:${totalSaved}]`);
            }
          } else {
            await prisma.listing.create({ data: rec.create });
            totalSaved++;
            log(`  ✅ ${rec.stats.judul} | ${rec.stats.kota} | img:${rec.stats.img} pdf:${rec.stats.pdf} (${secs}s) [total:${totalSaved}]`);
          }
        } catch (e) {
          totalFailed++;
          log(`  ⚠️ gagal ${item.link}: ${String(e.message).slice(0, 100)}`);
        }
      });

      page++;
      pagesDone++;
      if (knownTotalPage && page > knownTotalPage) { log(`Halaman terakhir (${knownTotalPage}) tercapai → selesai.`); break; }
      await sleep(300); // jeda kecil antar halaman, ramah server
    }
  } finally {
    await prisma.$disconnect();
  }

  const mins = ((Date.now() - startedAt) / 60000).toFixed(1);
  log(
    `SELESAI. Baru=${totalSaved}, Update=${totalUpdated}, Skip=${totalSkipped}, ` +
    `Gagal=${totalFailed}, Halaman=${pagesDone}, Durasi=${mins} menit`
  );
}

// Auto-run hanya bila dipanggil langsung (bukan saat di-import untuk test).
const invokedDirectly =
  process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("scripts/scrape-lelang.mjs");
if (invokedDirectly) {
  main().catch(async (e) => {
    console.error("FATAL:", e);
    try { await prisma.$disconnect(); } catch {}
    process.exit(1);
  });
}

export { prisma, buildListingRecord, fetchCatalogPage, resolveKategori };

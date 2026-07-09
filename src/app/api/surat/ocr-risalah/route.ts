import { NextResponse } from "next/server";
import { createSign } from "crypto";
import { readFileSync } from "fs";

export const runtime = "nodejs";
export const maxDuration = 60;

// ════════════════════════════════════════════════════════════════════════════
// Service Account JWT (shared with ocr-ktp)
// ════════════════════════════════════════════════════════════════════════════

type ServiceAccount = { client_email: string; private_key: string };
let tokenCache: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 120_000) return tokenCache.value;

  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!path) throw new Error("GOOGLE_APPLICATION_CREDENTIALS belum diset di .env");
  const sa = JSON.parse(readFileSync(path, "utf-8")) as ServiceAccount;

  const iat = Math.floor(now / 1000);
  const exp = iat + 3600;
  const header  = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-vision",
    aud: "https://oauth2.googleapis.com/token",
    exp, iat,
  })).toString("base64url");

  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const sig = sign.sign(sa.private_key, "base64url");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${payload}.${sig}`,
    }),
  });
  const data = (await res.json()) as { access_token: string };
  tokenCache = { value: data.access_token, expiresAt: now + 3500_000 };
  return data.access_token;
}

// ════════════════════════════════════════════════════════════════════════════
// Text extraction: PDF → pdf-parse, Image → Vision API
// ════════════════════════════════════════════════════════════════════════════

/**
 * OCR PDF hasil scan langsung lewat Google Vision `files:annotate` — tanpa
 * Ghostscript / binari eksternal apa pun. Vision me-render tiap halaman secara
 * internal lalu menjalankan DOCUMENT_TEXT_DETECTION (mesin OCR paling akurat
 * untuk dokumen padat). `languageHints: ["id","en"]` menaikkan akurasi teks
 * Indonesia. Batas sinkron files:annotate = 5 halaman/panggilan; teks tiap
 * halaman digabung (konsisten dengan jalur pdf-parse yang juga multi-halaman).
 */
async function extractFromPdfScan(buffer: Buffer): Promise<string> {
  const token  = await getAccessToken();
  const base64 = buffer.toString("base64");

  const res = await fetch("https://vision.googleapis.com/v1/files:annotate", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({
      requests: [{
        inputConfig: { mimeType: "application/pdf", content: base64 },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
        imageContext: { languageHints: ["id", "en"] },
        pages: [1, 2, 3, 4, 5],
      }],
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: { message?: string } })?.error?.message ?? res.statusText);
  }

  const data = (await res.json()) as {
    responses?: Array<{
      responses?: Array<{ fullTextAnnotation?: { text?: string } }>;
      error?: { message?: string };
    }>;
  };

  const file = data?.responses?.[0];
  if (file?.error?.message) throw new Error(file.error.message);

  return (file?.responses ?? [])
    .map(p => p.fullTextAnnotation?.text ?? "")
    .join("\n")
    .trim();
}

async function extractFromPDF(buffer: Buffer): Promise<string> {
  // Coba ekstrak teks langsung dulu (untuk PDF digital/text-based)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod      = require("pdf-parse");
    const pdfParse = (typeof mod === "function" ? mod : mod.default) as
      (buf: Buffer) => Promise<{ text: string }>;
    const result   = await pdfParse(buffer);
    const text     = result.text?.trim() ?? "";
    // Kalau ada teks yang cukup, langsung pakai (PDF digital)
    if (text.length > 80) return text;
  } catch {
    // Lanjut ke OCR Vision
  }

  // Fallback: PDF hasil scan → OCR langsung via Vision files:annotate (tanpa Ghostscript)
  return await extractFromPdfScan(buffer);
}

async function extractFromImage(buffer: Buffer): Promise<string> {
  const token  = await getAccessToken();
  const base64 = buffer.toString("base64");

  const res = await fetch("https://vision.googleapis.com/v1/images:annotate", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({
      requests: [{
        image: { content: base64 },
        features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
        imageContext: { languageHints: ["id", "en"] },
      }],
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: { message?: string } })?.error?.message ?? res.statusText);
  }

  const data = (await res.json()) as {
    responses?: Array<{ fullTextAnnotation?: { text?: string } }>;
  };
  return data?.responses?.[0]?.fullTextAnnotation?.text ?? "";
}

// ════════════════════════════════════════════════════════════════════════════
// Indonesian date helpers
// ════════════════════════════════════════════════════════════════════════════

const BULAN: Record<string, string> = {
  januari: "01", februari: "02", maret: "03", april: "04",
  mei: "05", juni: "06", juli: "07", agustus: "08",
  september: "09", oktober: "10", november: "11", desember: "12",
};

function parseIndonesianDate(raw: string): string {
  // "18 Desember 2025" → "18-12-2025"
  const m = raw.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return raw.trim();
  const dd    = m[1].padStart(2, "0");
  const mm    = BULAN[m[2].toLowerCase()] ?? "??";
  const yyyy  = m[3];
  return `${dd}-${mm}-${yyyy}`;
}

// ════════════════════════════════════════════════════════════════════════════
// Gelar akademik → singkatan KBBI
// ════════════════════════════════════════════════════════════════════════════

const GELAR: Record<string, string> = {
  // Sarjana (S1)
  "sarjana hukum":            "S.H.",
  "sarjana ekonomi":          "S.E.",
  "sarjana teknik":           "S.T.",
  "sarjana manajemen":        "S.M.",
  "sarjana pendidikan":       "S.Pd.",
  "sarjana komputer":         "S.Kom.",
  "sarjana ilmu komputer":    "S.Kom.",
  "sarjana akuntansi":        "S.Ak.",
  "sarjana sosial":           "S.Sos.",
  "sarjana administrasi":     "S.Sos.",
  "sarjana pertanian":        "S.P.",
  "sarjana kehutanan":        "S.Hut.",
  "sarjana peternakan":       "S.Pt.",
  "sarjana kesehatan":        "S.K.M.",
  "sarjana komunikasi":       "S.I.Kom.",
  "sarjana psikologi":        "S.Psi.",
  // Magister (S2)
  "magister hukum":           "M.H.",
  "magister manajemen":       "M.M.",
  "magister ekonomi":         "M.E.",
  "magister pendidikan":      "M.Pd.",
  "magister sains":           "M.Si.",
  "magister teknik":          "M.T.",
  "magister akuntansi":       "M.Ak.",
  "magister komputer":        "M.Kom.",
  "magister bisnis administrasi": "M.B.A.",
  // Doktor (S3)
  "doktor hukum":             "Dr.",
  "doktor":                   "Dr.",
  // Profesi
  "insinyur":                 "Ir.",
  "dokter":                   "dr.",
  "apoteker":                 "Apt.",
};

function singkatGelar(gelar: string): string {
  const key = gelar.toLowerCase().trim().replace(/\s+/g, " ");
  return GELAR[key] ?? gelar;
}

/** Normalisasi nama pejabat: ganti "Nama, Sarjana Hukum" → "Nama, S.H." */
function normalizePejabat(raw: string): string {
  // Potong kalau ada artefak baris sebelumnya (e.g., "SurabayaNama")
  // Nama valid dimulai dengan huruf kapital dan diikuti huruf kecil
  const clean = raw.replace(/^[A-Z][a-z]+[A-Z]/, (m) => m.slice(-1)); // strip prefix

  const commaIdx = clean.indexOf(",");
  if (commaIdx === -1) return clean.trim();

  const nama   = clean.slice(0, commaIdx).trim();
  const gelar  = clean.slice(commaIdx + 1).trim();
  return `${nama}, ${singkatGelar(gelar)}`;
}

// Helper: deteksi apakah baris adalah field label dokumen
function isKTPLabel(line: string): boolean {
  return /^(NIP|Nomor|Tanggal|Pukul|Tempat|Pejabat|Jenis|Nama|Surat|Dilakukan|Kementerian|Kantor|Direktorat|Harga|Uraian|Alamat|Saksi|Ttd)/i.test(line.trim());
}

// ════════════════════════════════════════════════════════════════════════════
// Text-normalisasi helpers untuk parsing objek
// ════════════════════════════════════════════════════════════════════════════

/** Bersihkan spasi ganda + hapus tanda baca menggantung di ujung. */
function tidy(s: string): string {
  return s.replace(/\s{2,}/g, " ").replace(/^[\s:.,;]+|[\s.,;]+$/g, "").trim();
}

/**
 * Title-case cerdas: kalau input ALL-CAPS ("SURABAYA") → "Surabaya",
 * tapi token singkat all-caps (DKI, RT) dipertahankan. Kalau sudah mixed-case,
 * biarkan apa adanya ("Jawa Timur", "Babatan").
 */
function smartCase(s: string): string {
  const t = tidy(s);
  if (!t) return "";
  if (t !== t.toUpperCase()) return t; // sudah mixed-case → jangan diutak-atik
  return t
    .split(/\s+/)
    .map((w) => (w.length <= 3 && /^[A-Z]+$/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(" ");
}

/** Normalisasi jenis hak → bentuk baku (SHM / SHGB / SHGU / Hak Pakai). */
function normJenisHak(raw: string): string {
  const k = raw.toLowerCase().replace(/[.\s()]/g, "");
  if (/^(sertip?ikat)?(hakmilik|shm|hm)$/.test(k)) return "SHM";
  if (/^(sertip?ikat)?(hakgunabangunan|shgb|hgb)$/.test(k)) return "SHGB";
  if (/^(sertip?ikat)?(hakgunausaha|shgu|hgu)$/.test(k)) return "SHGU";
  if (/^(sertip?ikat)?(hakpakai|shp|hp)$/.test(k)) return "Hak Pakai";
  if (/^(sertip?ikat)?(hakmilikatassatuanrumahsusun|hmsrs|sarusun)$/.test(k)) return "HMSRS";
  return raw.toUpperCase();
}

/** Normalisasi tipe wilayah kota: Kodya/Kotamadya → Kota, Kab. → Kabupaten. */
function normKotaType(raw: string): string {
  const k = raw.toLowerCase().replace(/\./g, "");
  if (/^(kotamadya|kodya|kotamadia)$/.test(k)) return "Kota";
  if (/^(kabupaten|kab)$/.test(k)) return "Kabupaten";
  return "Kota";
}

// ════════════════════════════════════════════════════════════════════════════
// Objek Lelang Parser — jenis hak, sertifikat, luas, lokasi, alamat
// ════════════════════════════════════════════════════════════════════════════

type ParsedObjek = {
  jenis_hak:        string;
  nomor_sertifikat: string; // dipetakan ke field NIB di modal
  luas:             string; // integer m²
  alamat_obyek:     string; // teks setelah "terletak di"
  kelurahan:        string;
  kecamatan:        string;
  kabupaten:        string; // sudah termasuk prefix "Kota"/"Kabupaten"
  provinsi:         string;
};

const EMPTY_OBJEK: ParsedObjek = {
  jenis_hak: "", nomor_sertifikat: "", luas: "",
  alamat_obyek: "", kelurahan: "", kecamatan: "", kabupaten: "", provinsi: "",
};

/**
 * Isolasi paragraf "Uraian Objek Lelang" lalu diratakan jadi satu baris.
 * Blok dimulai dari kata "Sebidang" (atau label "Uraian") dan berhenti sebelum
 * data pembeli / harga — supaya alamat/provinsi pemohon di atas tidak ikut terbaca.
 */
function extractObjekBlock(clean: string): string {
  let start = clean.search(/\bSebidang\b/i);
  if (start < 0) {
    const uM = clean.match(/\bUraian\b\s*[:.]?/i);
    if (uM && uM.index != null) start = uM.index + uM[0].length;
  }
  if (start < 0) return "";

  let block = clean.slice(start);
  const endM = block.match(
    /(Nama\s+Pembeli|Harga\s+Pembelian|Nomor\s+KTP|Nomor\s+SIM|Nomor\s+Surat\s+Permohonan|Pejabat\s+Penjual\s*\n)/i,
  );
  if (endM && endM.index != null && endM.index > 20) block = block.slice(0, endM.index);

  return block.replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim();
}

function parseObjek(clean: string): ParsedObjek {
  const flat = extractObjekBlock(clean);
  if (!flat) return { ...EMPTY_OBJEK };

  const out: ParsedObjek = { ...EMPTY_OBJEK };

  // ── Jenis hak + nomor sertifikat ────────────────────────────────────────
  // "sesuai dengan SHM No. 4823" / "Sertifikat Hak Milik (SHM) No. 4823"
  const hakM = flat.match(
    /\b(Sertip?ikat\s+Hak\s+Milik|Hak\s+Milik|Hak\s+Guna\s+Bangunan|Hak\s+Guna\s+Usaha|Hak\s+Pakai|SHGB|SHGU|SHM|HGB|HGU|HP|HM)\b\s*(?:\([A-Za-z]+\))?\s*(?:No\.?|Nomor|Nomer)?\s*[:.]?\s*(\d{1,7})/i,
  );
  if (hakM) {
    out.jenis_hak        = normJenisHak(hakM[1]);
    out.nomor_sertifikat = hakM[2];
  }

  // ── Luas ────────────────────────────────────────────────────────────────
  // "Lt. 163 m2" / "Luas 163 m²" / "seluas 163 m2"
  const luasM =
    flat.match(/(?:Lt\.?|LT|Luas(?:\s+Tanah)?|seluas)\s*[:.±]?\s*([\d.]+(?:,\d+)?)\s*(?:m2|m²|m\s?2|meter\s*persegi)/i) ||
    flat.match(/([\d.]+(?:,\d+)?)\s*(?:m2|m²|M2)\b/i);
  if (luasM) {
    out.luas = luasM[1].replace(/\./g, "").replace(/,\d+$/, "");
  }

  // ── Alamat objek (teks setelah "terletak di", berhenti di provinsi) ─────
  // Label kolom (Nama Pembeli, dll) di risalah sering terbaca terpisah oleh
  // OCR, jadi kita potong tepat pada nama provinsi — elemen terakhir alamat.
  const alM =
    flat.match(/terletak\s+di\s+(.+?(?:Provinsi|Propinsi|Prop\.?|Prov\.?)\s+[A-Za-zÀ-ÿ'’.\-]+(?:\s+[A-Za-zÀ-ÿ'’.\-]+)?)\s*\.?/i) ||
    flat.match(/terletak\s+di\s+(.+?)(?:\.\s|$)/i);
  if (alM) out.alamat_obyek = tidy(alM[1]);

  // ── Rincian wilayah administratif ───────────────────────────────────────
  const kelM = flat.match(/(?:Kelurahan|Kel\.?|Desa)\s+([A-Za-zÀ-ÿ'’.\-]+)/i);
  if (kelM) out.kelurahan = smartCase(kelM[1]);

  const kecM = flat.match(/(?:Kecamatan|Kec\.?)\s+([A-Za-zÀ-ÿ'’.\-]+)/i);
  if (kecM) out.kecamatan = smartCase(kecM[1]);

  const kabM = flat.match(
    /\b(Kota|Kabupaten|Kab\.?|Kotamadya|Kodya|Kotamadia)(?:\s+Administrasi|\s+Adm\.?)?\s+([A-Za-zÀ-ÿ'’.\-]+)/i,
  );
  if (kabM) out.kabupaten = `${normKotaType(kabM[1])} ${smartCase(kabM[2])}`;

  const provM = flat.match(/(?:Provinsi|Propinsi|Prop\.?|Prov\.?)\s+([A-Za-zÀ-ÿ'’.\-]+(?:\s+[A-Za-zÀ-ÿ'’.\-]+)?)(?=[.,)]|$)/i);
  if (provM) out.provinsi = smartCase(provM[1]);

  return out;
}

/** Kantor Pelayanan Lelang (KPKNL). */
function extractKantorLelang(clean: string): string {
  const m = clean.match(/KPKNL\s+([A-Za-zÀ-ÿ]+(?:\s+(?:I{1,3}|IV|VI{0,3}|IX|X|Satu|Dua|Tiga|Empat))?)/i);
  if (m) return `KPKNL ${smartCase(m[1])}`;
  const m2 = clean.match(/Kantor\s+Pelayanan\s+Kekayaan\s+Negara\s+dan\s+Lelang\s+([A-Za-z]+)/i);
  if (m2) return `KPKNL ${smartCase(m2[1])}`;
  return "";
}

// ════════════════════════════════════════════════════════════════════════════
// Risalah Lelang Parser
// ════════════════════════════════════════════════════════════════════════════

type ParsedRisalah = {
  nomor_risalah:  string;
  pejabat_lelang: string;
  tanggal:        string; // DD-MM-YYYY
  pukul:          string; // HH:MM
  nip:            string;
  kantor_lelang:  string;
  objek:          ParsedObjek;
};

function parseRisalah(text: string): ParsedRisalah {
  const clean = text.replace(/\r\n/g, "\n").replace(/\t/g, " ");
  const lines = clean.split("\n").map((l) => l.trim()).filter(Boolean);

  // ── 1. Nomor Risalah ─────────────────────────────────────────────────
  let nomor_risalah = "";
  const nomorM = clean.match(/NOMOR\s*[:\s]+([A-Z0-9\/\.\-]+)/i);
  if (nomorM) nomor_risalah = nomorM[1].trim();
  if (!nomor_risalah) {
    const fallback = clean.match(/\b(\d{3,4}\/[\d.]+\/\d{4}-\d{2})\b/);
    if (fallback) nomor_risalah = fallback[1];
  }

  // ── 2. Tanggal ────────────────────────────────────────────────────────
  // Vision sering baca label dulu semua lalu nilai semua (2-kolom).
  // Nilai Tanggal biasanya ada di baris yang dimulai dengan ":" + tanggal Indonesia,
  // ATAU baris "DD Month YYYY" tanpa ":" (tergantung kualitas scan).
  let tanggal = "";

  // Strategi A: baris dimulai dengan ":" + tanggal — paling spesifik
  const tglColonM = clean.match(
    /^:\s*(\d{1,2})\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+(\d{4})/im
  );
  if (tglColonM) {
    const dd = tglColonM[1].padStart(2, "0");
    const mm = BULAN[tglColonM[2].toLowerCase()] ?? "??";
    tanggal  = `${dd}-${mm}-${tglColonM[3]}`;
  }

  // Strategi B: "Tanggal : DD Month YYYY" atau "Tanggal    DD Month YYYY" pada baris yang sama
  if (!tanggal) {
    const tglSameLineM = clean.match(
      /Tanggal\s*:?\s*(\d{1,2})\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+(\d{4})/i
    );
    if (tglSameLineM) {
      const dd = tglSameLineM[1].padStart(2, "0");
      const mm = BULAN[tglSameLineM[2].toLowerCase()] ?? "??";
      tanggal  = `${dd}-${mm}-${tglSameLineM[3]}`;
    }
  }

  // Strategi C: cari baris dengan tanggal yang bukan dari Nomor SK / Surat Tugas
  if (!tanggal) {
    for (const line of lines) {
      // Lewati baris yang mengandung nomor surat/SK
      if (/nomor|sk|tugas|tanggal\s+\d{2}/i.test(line)) continue;
      const m = line.match(
        /\b(\d{1,2})\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+(\d{4})\b/i
      );
      if (m) {
        const dd = m[1].padStart(2, "0");
        const mm = BULAN[m[2].toLowerCase()] ?? "??";
        tanggal  = `${dd}-${mm}-${m[3]}`;
        break;
      }
    }
  }

  // ── 3. Pukul ─────────────────────────────────────────────────────────
  let pukul = "";

  // Strategi A: "Pukul : HH:MM" pada baris yang sama
  const pukulSameM = clean.match(/Pukul\s*[:\s]+(\d{1,2}:\d{2})/i);
  if (pukulSameM) {
    pukul = pukulSameM[1];
  }

  // Strategi B: cari baris yang DIMULAI dengan waktu HH:MM (nilai Pukul di 2-kolom OCR)
  // Baris seperti "10:00 (sepuluh) Waktu..." dimulai dengan angka jam
  if (!pukul) {
    for (const line of lines) {
      const m = line.match(/^(\d{1,2}:\d{2})(?:\s|$)/);
      if (m) { pukul = m[1]; break; }
    }
  }

  // Strategi C: cari HH:MM manapun yang masuk akal (06:00–20:00)
  if (!pukul) {
    const timeM = clean.match(/\b([0-1]?\d|2[0-3]):([0-5]\d)\b/);
    if (timeM) pukul = timeM[0];
  }

  // ── 4. Pejabat Lelang ─────────────────────────────────────────────────
  // KRITIS: gunakan [ \t]+ bukan \s+ agar TIDAK lintas baris (cegah concat "SurabayaNama")
  let pejabat_lelang = "";

  // Strategi A: "Pejabat Lelang : Nama, Gelar" satu baris (PDF digital/baris tunggal)
  const pejSameM = clean.match(/Pejabat[ \t]+Lelang[ \t]*:[ \t]*([^\n:]+)/i);
  if (pejSameM) {
    pejabat_lelang = normalizePejabat(pejSameM[1].trim());
  }

  // Strategi B: nama + gelar dalam satu baris ([ \t]+ = NO newline crossing)
  if (!pejabat_lelang) {
    // Pattern: "Kapital kata, Gelar" — hanya dalam satu baris ([ \t]+, bukan \s+)
    const gelarPat = /([A-Z][a-zA-Z.]+(?:[ \t]+[A-Z][a-zA-Z.]+)+),[ \t]*((?:Sarjana|Magister|Doktor|Insinyur|Ir\.|Dr\.|S\.|M\.)[ \t]*\w+(?:[ \t]+\w+)*)/;
    for (const line of lines) {
      const m = line.match(gelarPat);
      if (m) {
        pejabat_lelang = normalizePejabat(m[0].trim());
        break;
      }
    }
  }

  // Strategi C: posisional — nilai Pejabat = baris setelah nilai Tempat Lelang (Surabaya/KPKNL)
  // Hanya ambil baris yang ada tanda koma (nama orang biasanya ada koma + gelar)
  if (!pejabat_lelang) {
    for (let i = 0; i < lines.length - 1; i++) {
      if (/(?:KPKNL|Jl\.|Jalan|Surabaya).*$/i.test(lines[i]) && lines[i].length < 80) {
        const candidate = lines[i + 1]?.trim() ?? "";
        if (
          candidate.includes(",") &&
          !isKTPLabel(candidate) &&
          !/^(NIP|Nomor|Tanggal|Pukul|Tempat|Pejabat|Dilakukan|Kementerian)/i.test(candidate) &&
          /[A-Z][a-z]/.test(candidate)
        ) {
          pejabat_lelang = normalizePejabat(candidate);
          break;
        }
      }
    }
  }

  // ── 5. NIP ────────────────────────────────────────────────────────────
  // Ambil NIP dari section header (antara label "NIP" dan "Nomor SK" / "Dilakukan")
  // agar tidak ambil NIP Saksi/Kepala Kantor dari bagian bawah dokumen
  let nip = "";

  // Isolasi section header NIP (sebelum "Nomor SK" atau "Dilakukan penjualan")
  const nipSectionM = clean.match(/\bNIP\b([\s\S]*?)(?:Nomor\s+SK|Dilakukan\s+penjualan|$)/i);
  const nipSection  = nipSectionM?.[1] ?? clean;

  // Cari NIP dalam section tersebut: format DD/MM/YYYY spasi YYYYYY spasi G spasi NNN
  const nipInSection = nipSection.match(/(\d{8}[ ]\d{6}[ ]\d[ ]\d{3})/);
  if (nipInSection) {
    nip = nipInSection[1].trim();
  }

  // Fallback: pattern NIP dengan tanda baca berbeda (titik/spasi berbeda)
  if (!nip) {
    const nipM = clean.match(/\bNIP\s*[:\s]+(\d{8}[\s.]\d{6}[\s.]\d[\s.]\d{3})/i);
    if (nipM) nip = nipM[1].replace(/[.\s]+/g, " ").trim();
  }

  // Fallback 2: 18 digit berurutan (tanpa spasi)
  if (!nip) {
    const nipCompact = nipSection.match(/\b(1[5-9]\d{16})\b/);
    if (nipCompact) {
      const d = nipCompact[1];
      nip = `${d.slice(0,8)} ${d.slice(8,14)} ${d.slice(14,15)} ${d.slice(15)}`;
    }
  }

  // ── 6. Objek lelang + kantor lelang ───────────────────────────────────
  const objek         = parseObjek(clean);
  const kantor_lelang = extractKantorLelang(clean);

  return { nomor_risalah, pejabat_lelang, tanggal, pukul, nip, kantor_lelang, objek };
}

// ════════════════════════════════════════════════════════════════════════════
// Scoring
// ════════════════════════════════════════════════════════════════════════════

function scoreRisalah(parsed: ParsedRisalah): {
  score: number;
  confidence: number;
  status: "valid" | "review" | "invalid";
  warnings: string[];
} {
  const warnings: string[] = [];
  const o = parsed.objek;

  if (!parsed.nomor_risalah) warnings.push("Nomor risalah tidak terdeteksi");
  if (!parsed.tanggal)       warnings.push("Tanggal lelang tidak terdeteksi");
  if (!parsed.kantor_lelang) warnings.push("Kantor lelang (KPKNL) tidak terdeteksi");
  if (!o.jenis_hak)          warnings.push("Jenis hak / nomor sertifikat tidak terdeteksi");
  if (!o.luas)               warnings.push("Luas objek tidak terdeteksi");
  if (!o.alamat_obyek)       warnings.push("Alamat objek (setelah \"terletak di\") tidak terdeteksi");
  if (!o.kelurahan && !o.kecamatan && !o.kabupaten && !o.provinsi)
    warnings.push("Rincian wilayah (kelurahan/kecamatan/kota/provinsi) tidak terdeteksi");

  // Bobot: fokus pada field yang benar-benar dipakai akta (bukan pukul/NIP)
  const fields = [
    parsed.nomor_risalah, parsed.tanggal, parsed.kantor_lelang,
    o.jenis_hak, o.nomor_sertifikat, o.luas, o.alamat_obyek,
    o.kelurahan, o.kecamatan, o.kabupaten, o.provinsi,
  ];
  const filled     = fields.filter(Boolean).length;
  const score      = Math.round((filled / fields.length) * 100);
  const confidence = score / 100;
  const status: "valid" | "review" | "invalid" =
    score >= 75 ? "valid" : score >= 40 ? "review" : "invalid";

  return { score, confidence, status, warnings };
}

// ════════════════════════════════════════════════════════════════════════════
// Route Handler
// ════════════════════════════════════════════════════════════════════════════

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ detail: "File risalah wajib diupload" }, { status: 400 });
    }

    const isPDF  = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImage = file.type.startsWith("image/");

    if (!isPDF && !isImage) {
      return NextResponse.json(
        { detail: "Format file harus PDF atau gambar (JPG/PNG/WEBP)" },
        { status: 400 },
      );
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ detail: "Ukuran file maksimal 20MB" }, { status: 400 });
    }

    const buffer  = Buffer.from(await file.arrayBuffer());
    let   rawText = "";

    if (isPDF) {
      // PDF digital → ekstrak teks langsung (tidak perlu OCR)
      rawText = await extractFromPDF(buffer);
    } else {
      // Gambar → Vision API
      rawText = await extractFromImage(buffer);
    }

    console.log("=== RISALAH RAW TEXT ===\n" + rawText.slice(0, 800) + "\n========================");

    if (!rawText.trim()) {
      return NextResponse.json({
        raw_text: "", confidence: 0, score: 0, status: "invalid",
        warnings: ["Tidak ada teks terdeteksi — pastikan file jelas"],
        parsed: emptyParsed(),
      });
    }

    const parsed = parseRisalah(rawText);
    const { score, confidence, status, warnings } = scoreRisalah(parsed);

    return NextResponse.json({
      raw_text:   rawText.slice(0, 2000), // limit agar tidak terlalu besar
      confidence,
      score,
      status,
      warnings,
      parsed: {
        nomor_risalah:   parsed.nomor_risalah,
        tanggal_risalah: parsed.tanggal,
        pejabat_lelang:  parsed.pejabat_lelang,
        pukul:           parsed.pukul,
        nip:             parsed.nip,
        kantor_lelang:   parsed.kantor_lelang,
        // Objek lelang
        jenis_hak:        parsed.objek.jenis_hak,
        nomor_sertifikat: parsed.objek.nomor_sertifikat,
        luas:             parsed.objek.luas,
        alamat_obyek:     parsed.objek.alamat_obyek,
        kelurahan:        parsed.objek.kelurahan,
        kecamatan:        parsed.objek.kecamatan,
        kabupaten:        parsed.objek.kabupaten,
        provinsi:         parsed.objek.provinsi,
        // Backward compat
        uraian: parsed.objek.alamat_obyek,
      },
    });
  } catch (err) {
    const e   = err as { status?: number; message?: string };
    const msg = e?.message ?? "";
    console.error("OCR Risalah error:", err);

    if (e?.status === 403) {
      return NextResponse.json(
        { detail: "Service account tidak punya akses Vision API." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { detail: `OCR risalah gagal: ${msg || "coba upload ulang"}` },
      { status: 500 },
    );
  }
}

function emptyParsed() {
  return {
    nomor_risalah: "", tanggal_risalah: "", pejabat_lelang: "", pukul: "", nip: "",
    kantor_lelang: "", jenis_hak: "", nomor_sertifikat: "", luas: "",
    alamat_obyek: "", kelurahan: "", kecamatan: "", kabupaten: "", provinsi: "",
    uraian: "",
  };
}

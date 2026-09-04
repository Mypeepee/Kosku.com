// src/lib/server/ktpReader.ts
// ---------------------------------------------------------------------------
// SERVER-ONLY. Membaca foto KTP menjadi field terstruktur.
//
// ── PELAJARAN YANG SUDAH DIBAYAR MAHAL, JANGAN DIULANG ────────────────────
// Versi pertama berkas ini memakai `fullTextAnnotation.text` — teks mentah
// Google Vision. Hasilnya JAUH lebih buruk daripada `/api/surat/ocr-ktp` yang
// sudah ada, dan sempat dikira "model AI-nya kurang pintar". Bukan itu sebabnya.
//
// Vision mengembalikan teks mentah PER BLOK, bukan per baris visual. Pada KTP
// yang label dan nilainya berjauhan secara horizontal, blok-blok itu membuat
// "Nama", "Alamat", "Pekerjaan" berkumpul di satu tempat dan nilai-nilainya di
// tempat lain — label dan isinya tercerai. Penguraian apa pun di atas teks
// seperti itu hanya menebak.
//
// Yang membuat route lama akurat adalah REKONSTRUKSI GEOMETRIS di bawah:
// ambil setiap KATA beserta kotak koordinatnya, kelompokkan jadi baris dengan
// ambang adaptif (toleran terhadap foto miring), lalu potong di KOLOM titik
// dua. Itu mengembalikan baris "LABEL : NILAI" yang benar-benar rapi.
// Algoritma itu diboyong utuh ke sini. Jangan pernah menggantinya dengan
// `fullTextAnnotation.text` lagi.
//
// ── SUSUNAN DUA LAJUR ─────────────────────────────────────────────────────
// 1. Vision + rekonstruksi geometris + penguraian berlabel  → LANTAI.
//    Inilah jalur yang sudah terbukti akurat di lapangan.
// 2. Gemini melihat GAMBAR sekaligus transkrip hasil lajur 1 → PENGISI.
//    Ia HANYA boleh mengisi field yang lajur 1 tinggalkan kosong; ia tidak
//    pernah menimpa nilai yang sudah berhasil dibaca. Dengan begitu mesin ini
//    secara struktural tidak mungkin lebih buruk daripada route lama — Gemini
//    hanya menambah, tidak pernah mengurangi.
// 3. NIK jadi hakim untuk tanggal lahir, jenis kelamin, dan provinsi:
//    ketiganya tersimpan DI DALAM NIK, jadi bisa dibuktikan, bukan dipercaya.
//
// Ketidaksepakatan antar lajur tidak disembunyikan — ia dicatat di
// `catatan_silang` supaya orang yang menandatangani surat bisa melihatnya.
// ---------------------------------------------------------------------------

import { createSign } from "crypto";
import { readFileSync } from "fs";

// ── Bentuk hasil ───────────────────────────────────────────────────────────

export type DataKtp = {
  nama: string;
  nik: string;
  tempat_lahir: string;
  tanggal_lahir: string;          // DD-MM-YYYY
  tempat_tanggal_lahir: string;   // "Malang, 22-12-1967"
  jenis_kelamin: string;          // "Laki-Laki" | "Perempuan"
  gol_darah: string;
  alamat: string;                 // baris jalan saja, tanpa RT/RW
  rt: string;
  rw: string;
  rt_rw: string;                  // "003/008"
  kelurahan: string;
  kecamatan: string;
  kota: string;                   // tanpa awalan "KOTA"/"KABUPATEN"
  jenis_kota: string;             // "Kota" | "Kabupaten"
  provinsi: string;
  agama: string;
  status_kawin: string;
  pekerjaan: string;
  warga_negara: string;
  berlaku_hingga: string;
  alamat_lengkap: string;         // alamat, Kel. X, Kec. Y, Kota Z, Provinsi
};

/** Bacaan mentah satu lajur, sebelum dirapikan & digabung. */
type Bacaan = Partial<Record<keyof DataKtp, string>>;

export type HasilBacaKtp = {
  data: DataKtp;
  sumber: "gemini" | "vision" | "gabungan" | "kosong";
  skor: number;                   // 0-100
  status: "valid" | "review" | "invalid";
  peringatan: string[];
  /** Apa yang diperbaiki/dibuktikan oleh silang-uji. Untuk ditampilkan. */
  catatan_silang: string[];
  /**
   * Untuk menala mesin ini di data sungguhan. JANGAN dikirim ke browser
   * secara default — isinya salinan penuh KTP orang.
   */
  diagnostik: {
    transkrip: string;
    mentah: string;
    vision: Bacaan;
    gemini: Bacaan | null;
    galat_gemini: string | null;
    diisi_gemini: string[];
    beda: string[];
  };
};

const KOSONG: DataKtp = {
  nama: "", nik: "", tempat_lahir: "", tanggal_lahir: "", tempat_tanggal_lahir: "",
  jenis_kelamin: "", gol_darah: "", alamat: "", rt: "", rw: "", rt_rw: "",
  kelurahan: "", kecamatan: "", kota: "", jenis_kota: "", provinsi: "",
  agama: "", status_kawin: "", pekerjaan: "", warga_negara: "Indonesia",
  berlaku_hingga: "", alamat_lengkap: "",
};

const DIAG_KOSONG: HasilBacaKtp["diagnostik"] = {
  transkrip: "", mentah: "", vision: {}, gemini: null,
  galat_gemini: null, diisi_gemini: [], beda: [],
};

// ── Kode wilayah NIK ───────────────────────────────────────────────────────
// Dua digit pertama NIK adalah kode provinsi. Dipakai untuk MEMBUKTIKAN
// provinsi hasil bacaan — kop KTP ("PROVINSI JAWA TIMUR") sering jadi bagian
// gambar yang paling silau dan paling sering gagal terbaca.

const PROVINSI_NIK: Record<string, string> = {
  "11": "Aceh", "12": "Sumatera Utara", "13": "Sumatera Barat", "14": "Riau",
  "15": "Jambi", "16": "Sumatera Selatan", "17": "Bengkulu", "18": "Lampung",
  "19": "Kepulauan Bangka Belitung", "21": "Kepulauan Riau",
  "31": "DKI Jakarta", "32": "Jawa Barat", "33": "Jawa Tengah",
  "34": "DI Yogyakarta", "35": "Jawa Timur", "36": "Banten",
  "51": "Bali", "52": "Nusa Tenggara Barat", "53": "Nusa Tenggara Timur",
  "61": "Kalimantan Barat", "62": "Kalimantan Tengah", "63": "Kalimantan Selatan",
  "64": "Kalimantan Timur", "65": "Kalimantan Utara",
  "71": "Sulawesi Utara", "72": "Sulawesi Tengah", "73": "Sulawesi Selatan",
  "74": "Sulawesi Tenggara", "75": "Gorontalo", "76": "Sulawesi Barat",
  "81": "Maluku", "82": "Maluku Utara",
  "91": "Papua Barat", "92": "Papua Barat Daya", "94": "Papua",
  "95": "Papua Selatan", "96": "Papua Tengah", "97": "Papua Pegunungan",
};

// ── Perapian teks ──────────────────────────────────────────────────────────

const TETAP_KAPITAL = new Set(["RT", "RW", "DKI", "DI", "KM", "PJKA", "TNI", "POLRI", "UD", "PT", "CV"]);
const TETAP_KECIL = new Set(["dan", "di", "ke", "dari", "yang"]);

/**
 * "SAMBI KEREP" → "Sambi Kerep", tapi "44-Q/11" tetap "44-Q/11" dan
 * "JL." → "Jl.". Token bercampur angka tidak pernah diubah — nomor rumah
 * seperti "44-Q/11" rusak kalau dilewatkan title-case naif.
 */
function judulkan(raw: string): string {
  const t = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  return t
    .split(" ")
    .map((kata, i) => {
      if (/\d/.test(kata)) return kata;
      const polos = kata.replace(/[^A-Za-z]/g, "");
      if (!polos) return kata;
      if (TETAP_KAPITAL.has(polos.toUpperCase())) return kata.toUpperCase();
      if (i > 0 && TETAP_KECIL.has(polos.toLowerCase())) return kata.toLowerCase();
      return kata.replace(/[A-Za-z]+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
    })
    .join(" ");
}

/** KTP kerap mencetak "JL.CANDI" tanpa spasi; dibiarkan jadi "Jl.Candi". */
function renggangkanSingkatan(raw: string): string {
  return (raw ?? "").replace(/\b(JL|JLN|GG|BLOK|KOMP|PERUM|DS|DSN)\.(?=\S)/gi, "$1. ");
}

/** Nama orang di dokumen hukum tetap KAPITAL seperti tercetak di KTP. */
function namakan(raw: string): string {
  return (raw ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

function rapikanNik(raw: string): string {
  return (raw ?? "").replace(/\D/g, "");
}

function nikSah(nik: string): boolean {
  return /^\d{16}$/.test(nik);
}

/**
 * Huruf yang sering tertukar angka di NIK, dipetakan sebelum non-digit dibuang.
 * Diboyong dari route lama — pola latar hologram KTP membuat kekeliruan ini
 * berulang dan khas.
 */
function normalkanNikOcr(raw: string): string {
  const peta: Record<string, string> = {
    O: "0", o: "0", Q: "0", D: "0", U: "0", u: "0",
    I: "1", i: "1", l: "1", L: "1", "|": "1",
    Z: "2", z: "2", E: "3", e: "3", A: "4",
    S: "5", s: "5", G: "6", b: "6", T: "7", B: "8", g: "9", q: "9",
  };
  return (raw ?? "").split("").map((c) => peta[c] ?? c).join("").replace(/\D/g, "");
}

/** Normalisasi tanggal apa pun bentuknya → DD-MM-YYYY. */
function rapikanTanggal(raw: string): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  const m = t.match(/(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{2,4})/);
  if (!m) return "";
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  let yy = m[3];
  if (yy.length === 2) yy = Number(yy) < 30 ? `20${yy}` : `19${yy}`;
  if (Number(dd) < 1 || Number(dd) > 31 || Number(mm) < 1 || Number(mm) > 12) return "";
  return `${dd}-${mm}-${yy}`;
}

/**
 * Tanggal lahir & jenis kelamin TERSIMPAN DI DALAM NIK: digit 7-12 adalah
 * DDMMYY, dan tanggal perempuan ditambah 40. Inilah satu-satunya bagian KTP
 * yang bisa dibuktikan tanpa membaca ulang gambarnya.
 */
function dariNik(nik: string): { tanggal: string; kelamin: string; provinsi: string } | null {
  if (!nikSah(nik)) return null;
  const ddRaw = Number(nik.slice(6, 8));
  const mm = nik.slice(8, 10);
  const yy = Number(nik.slice(10, 12));
  const perempuan = ddRaw > 40;
  const dd = perempuan ? ddRaw - 40 : ddRaw;
  if (dd < 1 || dd > 31) return null;
  if (Number(mm) < 1 || Number(mm) > 12) return null;
  const tahun = yy < 30 ? 2000 + yy : 1900 + yy;
  return {
    tanggal: `${String(dd).padStart(2, "0")}-${mm}-${tahun}`,
    kelamin: perempuan ? "Perempuan" : "Laki-Laki",
    provinsi: PROVINSI_NIK[nik.slice(0, 2)] ?? "",
  };
}

// ════════════════════════════════════════════════════════════════════════════
// LAJUR 1 — Google Vision + rekonstruksi geometris
// ════════════════════════════════════════════════════════════════════════════

type Vertex = { x?: number; y?: number };
type SimbolMentah = { text?: string };
type KataMentah = { symbols?: SimbolMentah[]; boundingBox?: { vertices?: Vertex[] } };
type ParagrafMentah = { words?: KataMentah[] };
type BlokMentah = { paragraphs?: ParagrafMentah[] };
type Halaman = { width?: number; height?: number; blocks?: BlokMentah[] };

type Token = { text: string; x: number; cx: number; cy: number; h: number };

/** Setiap KATA beserta kotak koordinatnya. */
function ambilToken(hal: Halaman): Token[] {
  const token: Token[] = [];
  for (const blok of hal.blocks ?? []) {
    for (const par of blok.paragraphs ?? []) {
      for (const kata of par.words ?? []) {
        const text = (kata.symbols ?? []).map((s) => s.text ?? "").join("").trim();
        if (!text) continue;
        const v = kata.boundingBox?.vertices ?? [];
        if (v.length < 2) continue;
        const xs = v.map((p) => p.x ?? 0);
        const ys = v.map((p) => p.y ?? 0);
        const x = Math.min(...xs);
        const y = Math.min(...ys);
        const w = Math.max(...xs) - x;
        const h = Math.max(...ys) - y;
        token.push({ text, x, cx: x + w / 2, cy: y + h / 2, h });
      }
    }
  }
  return token;
}

/**
 * Kelompokkan token jadi baris. Ambangnya diturunkan dari tinggi huruf median,
 * bukan angka tetap: foto KTP datang dalam resolusi apa saja, dan hampir selalu
 * sedikit miring.
 */
function kelompokkanBaris(token: Token[]): Token[][] {
  if (!token.length) return [];
  const tinggi = token.map((t) => t.h).sort((a, b) => a - b);
  const median = tinggi[Math.floor(tinggi.length / 2)] || 15;
  const ambang = median * 0.55;

  const urut = [...token].sort((a, b) => a.cy - b.cy);
  const baris: Token[][] = [];
  for (const t of urut) {
    const akhir = baris[baris.length - 1];
    if (!akhir) { baris.push([t]); continue; }
    // Rata-rata cy baris berjalan, supaya kemiringan tidak menumpuk.
    const rata = akhir.reduce((s, k) => s + k.cy, 0) / akhir.length;
    if (Math.abs(t.cy - rata) <= ambang) akhir.push(t);
    else baris.push([t]);
  }
  return baris;
}

/** Posisi x kolom titik dua — median dari semua ":" yang ditemukan. */
function batasTitikDua(token: Token[]): number | null {
  const titik = token.filter((t) => t.text === ":" || t.text === ";");
  if (titik.length < 3) return null;
  const xs = titik.map((c) => c.x).sort((a, b) => a - b);
  return xs[Math.floor(xs.length / 2)];
}

/**
 * Susun ulang jadi baris "LABEL : NILAI".
 * INILAH bagian yang membuat pembacaan akurat — lihat catatan di kepala berkas.
 */
function rekonstruksi(hal: Halaman): string {
  const token = ambilToken(hal);
  if (!token.length) return "";

  const baris = kelompokkanBaris(token);
  const kolonX = batasTitikDua(token);
  const hasil: string[] = [];

  for (const b of baris) {
    const urut = [...b].sort((p, q) => p.x - q.x);

    const idx = urut.findIndex(
      (t) => t.text === ":" || t.text === ";" || t.text.endsWith(":") || t.text.startsWith(":"),
    );

    if (idx !== -1) {
      const tok = urut[idx];
      let label: string, nilai: string;
      if (tok.text === ":" || tok.text === ";") {
        label = urut.slice(0, idx).map((t) => t.text).join(" ");
        nilai = urut.slice(idx + 1).map((t) => t.text).join(" ");
      } else if (tok.text.endsWith(":")) {
        // "Status:" → label "Status", sisanya nilai
        label = (urut.slice(0, idx).map((t) => t.text).join(" ") + " " + tok.text.slice(0, -1)).trim();
        nilai = urut.slice(idx + 1).map((t) => t.text).join(" ");
      } else {
        // ":NILAI" → titik dua menempel di depan nilai
        label = urut.slice(0, idx).map((t) => t.text).join(" ");
        nilai = (tok.text.slice(1) + " " + urut.slice(idx + 1).map((t) => t.text).join(" ")).trim();
      }
      hasil.push(`${label.trim()} : ${nilai.trim()}`);
      continue;
    }

    // Tidak ada titik dua di baris ini — pakai kolom titik dua global.
    if (kolonX !== null) {
      const label = urut.filter((t) => t.cx < kolonX).map((t) => t.text).join(" ").trim();
      const nilai = urut.filter((t) => t.cx >= kolonX).map((t) => t.text).join(" ").trim();
      if (label && nilai) { hasil.push(`${label} : ${nilai}`); continue; }
    }

    hasil.push(urut.map((t) => t.text).join(" "));
  }

  return hasil.join("\n");
}

// ── Panggilan Vision ───────────────────────────────────────────────────────

type AkunLayanan = { client_email: string; private_key: string };
let cacheToken: { nilai: string; kedaluwarsa: number } | null = null;

function muatAkunLayanan(): AkunLayanan {
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!path) throw new Error("GOOGLE_APPLICATION_CREDENTIALS belum diset");
  return JSON.parse(readFileSync(path, "utf-8")) as AkunLayanan;
}

async function tokenAkses(): Promise<string> {
  const kini = Date.now();
  if (cacheToken && cacheToken.kedaluwarsa > kini + 120_000) return cacheToken.nilai;

  const sa = muatAkunLayanan();
  const iat = Math.floor(kini / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-vision",
    aud: "https://oauth2.googleapis.com/token",
    exp: iat + 3600, iat,
  })).toString("base64url");

  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const jwt = `${header}.${payload}.${sign.sign(sa.private_key, "base64url")}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error("Gagal mendapatkan access token Vision");
  const data = (await res.json()) as { access_token: string };
  cacheToken = { nilai: data.access_token, kedaluwarsa: kini + 3_500_000 };
  return data.access_token;
}

/** Transkrip hasil rekonstruksi + teks mentah (mentah hanya untuk diagnostik). */
async function bacaVision(buffer: Buffer): Promise<{ teks: string; mentah: string }> {
  const token = await tokenAkses();
  const res = await fetch("https://vision.googleapis.com/v1/images:annotate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      requests: [{
        image: { content: buffer.toString("base64") },
        features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
        imageContext: { languageHints: ["id", "en"] },
      }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Vision ${res.status}: ${detail.slice(0, 120)}`);
  }
  const data = (await res.json()) as {
    responses?: Array<{ fullTextAnnotation?: { text?: string; pages?: Halaman[] } }>;
  };
  const ann = data?.responses?.[0]?.fullTextAnnotation;
  const mentah = ann?.text ?? "";
  const hal = ann?.pages ?? [];
  const disusun = hal.length ? rekonstruksi(hal[0]) : "";
  return { teks: disusun.trim() ? disusun : mentah, mentah };
}

// ── Penguraian transkrip berlabel ──────────────────────────────────────────

const LABEL_KTP: Array<{ re: RegExp; kunci: string }> = [
  { re: /^TEMPAT\s*[/\s]\s*(TGL|IGL|TGI|TANGGAL)\s*LAHIR\b/i, kunci: "TEMPAT/TGL LAHIR" },
  { re: /^STATUS\s*PERKAWINAN\b/i, kunci: "STATUS PERKAWINAN" },
  { re: /^BERLAKU\s*HINGGA\b/i, kunci: "BERLAKU HINGGA" },
  { re: /^JENIS\s*KELAMIN\b/i, kunci: "JENIS KELAMIN" },
  { re: /^KEWARGANEGARAAN\b/i, kunci: "KEWARGANEGARAAN" },
  { re: /^KECAMATAN\b/i, kunci: "KECAMATAN" },
  { re: /^KEL\s*[/\s]\s*DESA\b/i, kunci: "KEL/DESA" },
  { re: /^GOL\s*\.?\s*DARAH\b/i, kunci: "GOL DARAH" },
  { re: /^PEKERJAAN\b/i, kunci: "PEKERJAAN" },
  { re: /^ALAMAT\b/i, kunci: "ALAMAT" },
  { re: /^AGAMA\b/i, kunci: "AGAMA" },
  { re: /^NAMA\b/i, kunci: "NAMA" },
  { re: /^NIK\b/i, kunci: "NIK" },
  { re: /^RT\s*[/\s]\s*RW\b/i, kunci: "RT/RW" },
];

function normalkanLabel(raw: string): string {
  const atas = raw.trim().toUpperCase();
  for (const { re, kunci } of LABEL_KTP) if (re.test(atas)) return kunci;
  return atas.replace(/\s+/g, " ");
}

/** Peta "LABEL" → "nilai" dari transkrip. */
function petaField(teks: string): Record<string, string> {
  const field: Record<string, string> = {};
  for (const mentah of teks.split(/\r?\n/)) {
    const baris = mentah.trim();
    if (!baris) continue;
    if (/^(PROVINSI|KOTA|KABUPATEN)\s/i.test(baris)) continue;

    const idx = baris.indexOf(":");
    if (idx > 0 && idx < baris.length - 1) {
      const label = baris.slice(0, idx).trim();
      const nilai = baris.slice(idx + 1).replace(/^[:\s]+/, "").trim();
      if (label && nilai) {
        const k = normalkanLabel(label);
        if (!field[k]) field[k] = nilai;
        continue;
      }
    }
    // Tanpa titik dua — cocokkan awalan barisnya dengan label KTP yang dikenal.
    for (const { re, kunci } of LABEL_KTP) {
      const m = baris.match(re);
      if (!m) continue;
      const nilai = baris.slice(m[0].length).replace(/^[\s:]+/, "").trim();
      if (nilai && !field[kunci]) field[kunci] = nilai;
      break;
    }
  }
  return field;
}

function cariField(field: Record<string, string>, ...kunci: string[]): string {
  for (const k of kunci) {
    if (field[k]) return field[k];
    for (const ada of Object.keys(field)) {
      if (ada.includes(k.toUpperCase()) || k.toUpperCase().includes(ada)) return field[ada];
    }
  }
  return "";
}

/**
 * Cari NIK **satu baris pada satu waktu**, tidak pernah lintas baris.
 *
 * KENAPA BEGINI, DAN JANGAN DIKEMBALIKAN. Cara lama membuang semua non-digit
 * dari SELURUH teks lalu mengambil 16 angka pertama. Selama NIK-nya terbaca
 * utuh itu benar — tapi begitu satu angka luput terbaca, deret 15 digit itu
 * bersambung dengan angka tanggal lahir di baris berikutnya dan menghasilkan
 * NIK 16 digit yang SAH BENTUKNYA tapi bukan milik siapa pun:
 *
 *   "NIK : 357831621267001" + "22-12-1967" → 3578316212670012
 *
 * Nomor karangan itu lolos setiap pemeriksaan, ikut tercetak di surat kuasa,
 * dan tersimpan di register. Lebih baik NIK dilaporkan tidak terbaca lalu
 * diketik manusia daripada diisi tebakan yang terlihat meyakinkan.
 *
 * Karena itu satu baris hanya diterima kalau angkanya PAS 16, atau memuat
 * deret 16 yang tidak bersambung dengan angka lain.
 */
function nikDariBaris(baris: string, bolehNormalkan: boolean): string {
  // Labelnya dibuang lebih dulu. Pemetaan huruf→angka tidak tahu mana label
  // dan mana nomor: huruf "I" pada kata "NIK" SENDIRI menjadi angka 1 lalu
  // menempel di depan nomornya — "NIK : 357…001" (15 digit) berubah jadi
  // "1357…001" yang panjangnya pas 16 dan lolos begitu saja.
  const nilai = (baris.includes(":") ? baris.slice(baris.lastIndexOf(":") + 1) : baris)
    .replace(/^\s*(NIK|N\.?\s*I\.?\s*K|NO\.?\s*KTP|NOMOR\s+INDUK\s+(KTP|KEPENDUDUKAN))\s*[:.]?\s*/i, "");

  // Pemetaan huruf→angka dipagari DUA lapis, dan keduanya perlu.
  //
  // Lapis 1 — hanya baris BERLABEL NIK yang boleh dinormalkan. Dilepas ke
  // sembarang baris, ia mengarang nomor dari teks biasa: alamat
  // "JL.CANDI LONTAR KULON 44-Q/11" berubah menjadi "1401107401044011",
  // enam belas digit yang terlihat seperti NIK sempurna.
  //
  // Lapis 2 — untaiannya harus sudah didominasi angka, kalau-kalau baris
  // berlabel NIK itu sendiri salah terpotong dan berisi teks lain.
  const inti = nilai.replace(/[\s.\-/]/g, "");
  const jumlahDigit = (inti.match(/\d/g) ?? []).length;
  const layakDinormalkan = bolehNormalkan && inti.length > 0 && jumlahDigit / inti.length >= 0.5;

  const kandidat = layakDinormalkan
    ? [nilai.replace(/\D/g, ""), normalkanNikOcr(nilai)]
    : [nilai.replace(/\D/g, "")];

  for (const k of kandidat) {
    if (nikSah(k)) return k;
    // Deret 16 yang tidak bersambung dengan angka lain. Pada untaian yang
    // lebih panjang ini sengaja TIDAK cocok: itu tandanya dua field tersambung.
    const terikat = k.match(/(?<!\d)(\d{16})(?!\d)/);
    if (terikat) return terikat[1];
  }
  return "";
}

function cariNik(teks: string, field: Record<string, string>): string {
  // Baris berlabel "NIK" lebih dulu — di situlah tempatnya seharusnya.
  const dariLabel = nikDariBaris(cariField(field, "NIK"), true);
  if (dariLabel) return dariLabel;
  // Baru menyapu baris lain — label "NIK" termasuk yang paling sering tertimpa
  // pola latar hologram kartu. Di sini pemulihan huruf→angka DIMATIKAN: kita
  // tidak tahu baris apa yang sedang dilihat, jadi hanya angka asli yang dihitung.
  for (const b of teks.split(/\r?\n/)) {
    const n = nikDariBaris(b, false);
    if (n) return n;
  }
  return "";
}

/** "MALANG, 22-12-1967" → { tempat, tgl } */
function pisahTtl(raw: string): { tempat: string; tgl: string } {
  const m = raw.match(/(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{4})/);
  if (!m) return { tempat: raw.trim(), tgl: "" };
  const tgl = `${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}-${m[3]}`;
  const depan = raw.slice(0, m.index).replace(/[,\s]+$/, "").trim();
  const bagian = depan.split(/\s{2,}|,/).map((s) => s.trim()).filter(Boolean);
  return { tempat: bagian.at(-1) ?? depan, tgl };
}

/** Buang RT/RW yang ikut nyangkut di ekor baris alamat. */
function bersihkanAlamat(alamat: string): string {
  return (alamat ?? "")
    .replace(/[,\s]*RT\s*[./]?\s*RW\s*[:.]?\s*\d{1,3}\s*[/\\]\s*\d{1,3}\s*$/i, "")
    .replace(/\s*[:\s]+\d{2,3}\s*[/\\]\s*\d{2,3}\s*$/, "")
    .replace(/\s+RT\s*[/\\]?\s*RW\s*$/i, "")
    .replace(/[,\s]+$/, "")
    .trim();
}

/**
 * Urai transkrip berlabel jadi bacaan. Ini penerus langsung `parseKTP` route
 * lama — jalur yang sudah terbukti akurat di lapangan.
 */
function uraiTranskrip(teks: string): Bacaan {
  const baris = teks.split(/\r?\n/).map((b) => b.trim()).filter(Boolean);
  const field = petaField(teks);
  const out: Bacaan = {};

  // ── NIK ────────────────────────────────────────────────────────────────
  const nik = cariNik(teks, field);
  if (nik) out.nik = nik;

  // ── Kop: provinsi & kota ───────────────────────────────────────────────
  for (const b of baris.slice(0, 6)) {
    const kop = b.match(/^PROVINSI\s+([A-Za-z][A-Za-z .'-]*)$/i);
    if (kop) { out.provinsi = kop[1].trim(); break; }
  }
  for (const b of baris.slice(0, 6)) {
    const m = b.match(/^(KOTA|KABUPATEN)\s+([A-Za-z][A-Za-z .'-]*?)\s*$/i);
    if (m && !/\d/.test(m[2])) {
      out.jenis_kota = m[1];
      out.kota = m[2].trim();
      break;
    }
  }

  // ── Nama ───────────────────────────────────────────────────────────────
  const nama = cariField(field, "NAMA");
  if (nama && !/\d{2}[-/]\d{2}/.test(nama) && nama.length >= 2) out.nama = nama;

  // ── Tempat & tanggal lahir ─────────────────────────────────────────────
  const ttl = cariField(field, "TEMPAT/TGL LAHIR", "TEMPAT", "TGL LAHIR", "TANGGAL LAHIR");
  const { tempat, tgl } = pisahTtl(ttl);
  if (tempat) out.tempat_lahir = tempat;
  if (tgl) out.tanggal_lahir = tgl;
  if (!out.tempat_lahir || !out.tanggal_lahir) {
    for (const b of baris) {
      const m = b.match(/([A-Z][A-Z]+),?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{4})/);
      if (!m) continue;
      out.tempat_lahir ||= m[1];
      out.tanggal_lahir ||= m[2].replace(/\//g, "-");
      break;
    }
  }

  // ── Jenis kelamin & gol darah ──────────────────────────────────────────
  for (const b of baris) {
    if (/\bLAKI[-\s]?LAKI\b/i.test(b)) { out.jenis_kelamin = "Laki-Laki"; break; }
    if (/\bPEREMPUAN\b/i.test(b)) { out.jenis_kelamin = "Perempuan"; break; }
  }
  const gol = teks.match(/GOL\.?\s*DARAH\s*[:.]?\s*(AB|[ABO])\b/i)
    ?? cariField(field, "GOL DARAH").match(/^(AB|[ABO])\b/i);
  if (gol) out.gol_darah = gol[1].toUpperCase();

  // ── RT/RW ──────────────────────────────────────────────────────────────
  const rtrwField = cariField(field, "RT/RW", "RTRW", "RT RW");
  let rt = "", rw = "";
  const m1 = rtrwField.match(/(\d{1,3})\s*[/\\]\s*(\d{1,3})/);
  if (m1) { rt = m1[1]; rw = m1[2]; }
  if (!rt) {
    for (const b of baris) {
      const m = b.match(/\b(\d{2,3})\s*[/\\]\s*(\d{2,3})\b/);
      if (m) { rt = m[1]; rw = m[2]; break; }
    }
  }
  if (rt) { out.rt = rt; out.rw = rw; }

  // ── Alamat & wilayah ───────────────────────────────────────────────────
  let alamat = bersihkanAlamat(cariField(field, "ALAMAT"));
  if (!alamat) {
    for (const b of baris) {
      if (/^JL[N]?[.\s]/i.test(b) || /^JALAN\s/i.test(b)) { alamat = bersihkanAlamat(b); break; }
    }
  }
  if (alamat) out.alamat = alamat;

  const kel = cariField(field, "KEL/DESA", "KEL DESA", "KELURAHAN", "DESA").replace(/^[/\\\s]+/, "").trim();
  if (kel) out.kelurahan = kel;
  const kec = cariField(field, "KECAMATAN");
  if (kec) out.kecamatan = kec;

  // ── Sisanya ────────────────────────────────────────────────────────────
  const agama = cariField(field, "AGAMA");
  if (agama) out.agama = agama;
  const kawin = cariField(field, "STATUS PERKAWINAN", "STATUS KAWIN");
  if (kawin) out.status_kawin = kawin;
  const kerja = cariField(field, "PEKERJAAN");
  if (kerja) out.pekerjaan = kerja;
  const wn = cariField(field, "KEWARGANEGARAAN");
  if (wn) out.warga_negara = wn;
  const berlaku = cariField(field, "BERLAKU HINGGA", "BERLAKU");
  if (berlaku) out.berlaku_hingga = berlaku;

  return out;
}

// ════════════════════════════════════════════════════════════════════════════
// LAJUR 2 — Gemini sebagai pengisi kekosongan
// ════════════════════════════════════════════════════════════════════════════

const RANTAI_MODEL = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : ["gemini-2.5-flash", "gemini-flash-latest"];

const PROMPT = `Kamu pembaca KTP (Kartu Tanda Penduduk) Indonesia yang sangat teliti.
Baca GAMBAR KTP di bawah dan keluarkan datanya sebagai JSON.

TATA LETAK KTP INDONESIA — pakai ini untuk tahu field mana milik nilai mana:
- Dua baris paling atas: "PROVINSI <nama provinsi>" lalu "KOTA <x>" atau "KABUPATEN <x>".
- Lalu berturut-turut: NIK, Nama, Tempat/Tgl Lahir, Jenis Kelamin (+ Gol Darah di
  kanan baris yang SAMA), Alamat, RT/RW, Kel/Desa, Kecamatan, Agama,
  Status Perkawinan, Pekerjaan, Kewarganegaraan, Berlaku Hingga.
- Di kanan bawah ada nama kota penerbit + tanggal terbit + tanda tangan. ABAIKAN
  blok itu: tanggal di situ BUKAN tanggal lahir, kota di situ bukan tempat lahir.

JEBAKAN YANG HARUS KAMU HINDARI:
- "Tempat/Tgl Lahir" berisi KOTA KELAHIRAN, bukan kota tempat tinggal. Kota
  tempat tinggal ada di kop atas. Keduanya sering berbeda — jangan disamakan.
- "Alamat" hanya baris jalannya saja. RT/RW, Kel/Desa, dan Kecamatan punya
  barisnya sendiri; jangan diseret masuk ke alamat.
- Jangan pernah menaruh nilai pekerjaan (mis. "MENGURUS RUMAH TANGGA",
  "KARYAWAN SWASTA", "PELAJAR/MAHASISWA") di field alamat atau nama.
- Nama kecamatan/kelurahan (mis. "SAMBI KEREP", "LONTAR") BUKAN nama orang.
- Gol Darah adalah satu huruf (A/B/AB/O), kadang "-". Jangan tertukar dengan
  huruf lain di baris jenis kelamin.
- NIK selalu TEPAT 16 digit angka. Kalau bacaanmu bukan 16 digit, baca ulang
  angka per angka; jangan menebak atau memotong.
- Salin ejaan persis seperti tercetak. Jangan memperbaiki atau menyingkat nama.

Kalau sebuah field benar-benar tidak terbaca, isi string kosong "" — JANGAN mengarang.

Balas HANYA objek JSON ini, tanpa teks lain:
{"nik":"","nama":"","tempat_lahir":"","tanggal_lahir":"DD-MM-YYYY","jenis_kelamin":"Laki-Laki atau Perempuan","gol_darah":"","alamat":"","rt":"","rw":"","kelurahan":"","kecamatan":"","kota":"","jenis_kota":"Kota atau Kabupaten","provinsi":"","agama":"","status_kawin":"","pekerjaan":"","warga_negara":"","berlaku_hingga":""}`;

async function panggilGemini(
  model: string, base64: string, mime: string, transkrip: string, budgetPikir: number,
): Promise<Bacaan> {
  const kunci = process.env.GEMINI_API_KEY!;

  // Transkrip hasil rekonstruksi disertakan sebagai PEMBANDING. Ia setia pada
  // karakter (terutama digit) tetapi tidak selalu benar soal field mana milik
  // nilai mana; gambar tetap yang menentukan penempatan.
  const teksPrompt = transkrip.trim()
    ? `${PROMPT}\n\nIni hasil OCR baris-per-baris dari gambar yang sama. Pakai untuk memastikan EJAAN & ANGKA (khususnya NIK); percayai GAMBAR untuk menentukan field mana milik nilai mana:\n"""\n${transkrip.slice(0, 2500)}\n"""`
    : PROMPT;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": kunci },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{ inline_data: { mime_type: mime, data: base64 } }, { text: teksPrompt }],
        }],
        generationConfig: {
          temperature: 0,          // menyalin dokumen, bukan mengarang
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: budgetPikir },
        },
      }),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw Object.assign(new Error(`Gemini ${model} ${res.status}: ${detail.slice(0, 140)}`), {
      bolehGantiModel: res.status === 404 || res.status === 429 || res.status >= 500,
    });
  }

  const json = await res.json();
  const alasanSelesai = json?.candidates?.[0]?.finishReason;
  const teks: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (alasanSelesai === "MAX_TOKENS" || !teks) {
    // Jebakan lama: penalaran internal menghabiskan jatah token dan JSON-nya
    // terpotong di tengah. Ditandai supaya pemanggil mengulang tanpa penalaran.
    throw Object.assign(new Error(`Balasan Gemini terpotong (${alasanSelesai ?? "kosong"})`), {
      cobaTanpaPikir: budgetPikir > 0,
    });
  }
  const bersih = teks.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(bersih);
  if (!parsed || typeof parsed !== "object") throw new Error("Balasan Gemini bukan objek");
  return parsed as Bacaan;
}

async function bacaDenganGemini(base64: string, mime: string, transkrip: string): Promise<Bacaan> {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY belum diset");

  let terakhir: unknown;
  for (const model of RANTAI_MODEL) {
    // Membaca angka di foto buram memang menuntut sedikit penalaran, jadi
    // budget-nya TIDAK nol. Tapi kalau jawabannya jadi terpotong, jatuh ke nol.
    for (const budget of [256, 0]) {
      try {
        return await panggilGemini(model, base64, mime, transkrip, budget);
      } catch (e) {
        terakhir = e;
        const err = e as { cobaTanpaPikir?: boolean; bolehGantiModel?: boolean };
        if (err?.cobaTanpaPikir) continue;      // ulangi model ini tanpa penalaran
        if (err?.bolehGantiModel) break;        // coba model berikutnya
        throw e;
      }
    }
  }
  throw terakhir instanceof Error ? terakhir : new Error("Semua model Gemini gagal");
}

// ════════════════════════════════════════════════════════════════════════════
// Perakitan & silang-uji
// ════════════════════════════════════════════════════════════════════════════

function rakit(baca: Bacaan, catatan: string[]): DataKtp {
  const d: DataKtp = { ...KOSONG };

  d.nik = rapikanNik(baca.nik ?? "");
  d.nama = namakan(baca.nama ?? "");

  // Tempat & tanggal lahir bisa datang menyatu dari lajur mana pun.
  const ttlMentah = (baca.tempat_lahir ?? "").trim();
  const tglDiTtl = ttlMentah.match(/(\d{1,2}\s*[-/.]\s*\d{1,2}\s*[-/.]\s*\d{2,4})/);
  d.tempat_lahir = judulkan(
    tglDiTtl ? ttlMentah.slice(0, tglDiTtl.index).replace(/[,\s]+$/, "") : ttlMentah,
  );
  d.tanggal_lahir = rapikanTanggal(baca.tanggal_lahir ?? "") || rapikanTanggal(tglDiTtl?.[1] ?? "");

  d.gol_darah = (baca.gol_darah ?? "").trim().toUpperCase().replace(/[^ABO-]/g, "");
  d.alamat = judulkan(renggangkanSingkatan(bersihkanAlamat(baca.alamat ?? "")));
  d.rt = (baca.rt ?? "").replace(/\D/g, "");
  d.rw = (baca.rw ?? "").replace(/\D/g, "");
  d.kelurahan = judulkan(baca.kelurahan ?? "");
  d.kecamatan = judulkan(baca.kecamatan ?? "");
  d.kota = judulkan((baca.kota ?? "").replace(/^(KOTA|KABUPATEN)\s+/i, ""));
  d.provinsi = judulkan(baca.provinsi ?? "");
  d.agama = judulkan(baca.agama ?? "");
  d.status_kawin = judulkan(baca.status_kawin ?? "");
  d.pekerjaan = judulkan(baca.pekerjaan ?? "");
  d.berlaku_hingga = /seumur\s*hidup/i.test(baca.berlaku_hingga ?? "")
    ? "Seumur Hidup"
    : rapikanTanggal(baca.berlaku_hingga ?? "");

  const jk = (baca.jenis_kelamin ?? "").toUpperCase();
  d.jenis_kelamin = /PEREMPUAN|WANITA/.test(jk) ? "Perempuan" : /LAKI/.test(jk) ? "Laki-Laki" : "";

  const jkota = (baca.jenis_kota ?? "").toUpperCase();
  d.jenis_kota = jkota.includes("KABUPATEN") ? "Kabupaten" : jkota.includes("KOTA") ? "Kota" : "";

  const wn = (baca.warga_negara ?? "").trim();
  d.warga_negara = !wn || /^WNI$/i.test(wn) ? "Indonesia" : judulkan(wn);

  // ── NIK sebagai hakim ────────────────────────────────────────────────────
  const bukti = dariNik(d.nik);
  if (bukti) {
    if (!d.tanggal_lahir) {
      d.tanggal_lahir = bukti.tanggal;
      catatan.push(`Tanggal lahir diambil dari NIK: ${bukti.tanggal}`);
    } else if (d.tanggal_lahir !== bukti.tanggal) {
      catatan.push(`Tanggal lahir hasil bacaan (${d.tanggal_lahir}) berbeda dengan yang tersimpan di NIK (${bukti.tanggal}) — dipakai versi NIK.`);
      d.tanggal_lahir = bukti.tanggal;
    }
    if (!d.jenis_kelamin) {
      d.jenis_kelamin = bukti.kelamin;
      catatan.push(`Jenis kelamin diambil dari NIK: ${bukti.kelamin}`);
    } else if (d.jenis_kelamin !== bukti.kelamin) {
      catatan.push(`Jenis kelamin hasil bacaan (${d.jenis_kelamin}) tidak cocok dengan NIK (${bukti.kelamin}) — dipakai versi NIK.`);
      d.jenis_kelamin = bukti.kelamin;
    }
    if (!d.provinsi && bukti.provinsi) {
      d.provinsi = bukti.provinsi;
      catatan.push(`Provinsi diambil dari kode wilayah NIK: ${bukti.provinsi}`);
    }
  }

  d.rt_rw = d.rt && d.rw ? `${d.rt.padStart(3, "0")}/${d.rw.padStart(3, "0")}` : "";
  d.tempat_tanggal_lahir = [d.tempat_lahir, d.tanggal_lahir].filter(Boolean).join(", ");

  const bagian: string[] = [];
  if (d.alamat) bagian.push(d.alamat);
  if (d.kelurahan) bagian.push(`Kel. ${d.kelurahan}`);
  if (d.kecamatan) bagian.push(`Kec. ${d.kecamatan}`);
  if (d.kota) bagian.push(`${d.jenis_kota || "Kota"} ${d.kota}`);
  // Diawali kata "Provinsi" supaya bagian terakhir terbaca sebagai wilayah,
  // bukan sebagai nama kota kedua — "Kota Surabaya, Jawa Timur" ambigu di mata
  // pembaca surat, "Kota Surabaya, Provinsi Jawa Timur" tidak.
  if (d.provinsi) {
    bagian.push(/^provinsi\b/i.test(d.provinsi) ? d.provinsi : `Provinsi ${d.provinsi}`);
  }
  d.alamat_lengkap = bagian.join(", ");

  return d;
}

function nilai(d: DataKtp): { skor: number; status: HasilBacaKtp["status"]; peringatan: string[] } {
  const peringatan: string[] = [];
  const inti: Array<[string, number, string]> = [
    // NIK dinilai dari BENTUKNYA: 15 digit yang terbaca penuh percaya diri
    // lebih berbahaya daripada field kosong.
    [nikSah(d.nik) ? d.nik : "", 3, d.nik ? "" : "NIK tidak terbaca"],
    [d.nama, 3, "Nama tidak terbaca"],
    [d.alamat, 2, "Alamat tidak terbaca"],
    [d.tempat_lahir, 1, "Tempat lahir tidak terbaca"],
    [d.tanggal_lahir, 1, "Tanggal lahir tidak terbaca"],
    [d.kelurahan, 1, "Kelurahan tidak terbaca"],
    [d.kecamatan, 1, "Kecamatan tidak terbaca"],
    [d.kota, 1, "Kota/Kabupaten tidak terbaca"],
  ];
  let dapat = 0, total = 0;
  for (const [v, bobot, pesan] of inti) {
    total += bobot;
    if (v) dapat += bobot;
    else if (pesan) peringatan.push(pesan);
  }
  if (d.nik && !nikSah(d.nik)) peringatan.push(`NIK ${d.nik.length} digit — seharusnya 16. Periksa manual.`);
  if (!d.provinsi) peringatan.push("Provinsi tidak terbaca — lengkapi manual.");

  const skor = Math.round((dapat / total) * 100);
  return {
    skor,
    status: skor >= 80 && nikSah(d.nik) ? "valid" : skor >= 45 ? "review" : "invalid",
    peringatan,
  };
}

const FIELD_BACAAN: (keyof DataKtp)[] = [
  "nik", "nama", "tempat_lahir", "tanggal_lahir", "jenis_kelamin", "gol_darah",
  "alamat", "rt", "rw", "kelurahan", "kecamatan", "kota", "jenis_kota",
  "provinsi", "agama", "status_kawin", "pekerjaan", "warga_negara", "berlaku_hingga",
];

/**
 * Gabungkan: lajur Vision jadi LANTAI, Gemini hanya mengisi yang kosong.
 *
 * Ini keputusan sadar, bukan kompromi malas. Lajur Vision inilah yang sudah
 * dipakai dan dipercaya di route lama; membiarkan model menimpanya berarti
 * mempertaruhkan akurasi yang sudah ada demi akurasi yang belum terbukti.
 * Ketidaksepakatan tidak dibuang — ia dicatat supaya bisa dilihat manusia.
 */
function gabung(vision: Bacaan, gemini: Bacaan | null, catatan: string[]) {
  const hasil: Bacaan = { ...vision };
  const diisi: string[] = [];
  const beda: string[] = [];
  if (!gemini) return { hasil, diisi, beda };

  for (const k of FIELD_BACAAN) {
    const v = (vision[k] ?? "").trim();
    const g = (gemini[k] ?? "").trim();
    if (!g) continue;
    if (!v) { hasil[k] = g; diisi.push(k); continue; }
    if (v.toUpperCase().replace(/\s+/g, " ") !== g.toUpperCase().replace(/\s+/g, " ")) {
      beda.push(`${k}: OCR "${v}" vs AI "${g}"`);
    }
  }

  // NIK adalah satu-satunya pengecualian: bentuknya bisa diverifikasi, jadi
  // yang sah mengalahkan yang tidak, dari lajur mana pun ia datang.
  const nikV = rapikanNik(vision.nik ?? "");
  const nikG = rapikanNik(gemini.nik ?? "");
  if (!nikSah(nikV) && nikSah(nikG)) {
    hasil.nik = nikG;
    catatan.push(`NIK dari OCR tidak berbentuk 16 digit — dipakai hasil pembacaan AI: ${nikG}.`);
  } else if (nikSah(nikV) && nikSah(nikG) && nikV !== nikG) {
    catatan.push(`Dua mesin membaca NIK berbeda (OCR ${nikV} vs AI ${nikG}) — dipakai OCR, mohon periksa manual.`);
  }

  return { hasil, diisi, beda };
}

// ── Pintu masuk ────────────────────────────────────────────────────────────

/**
 * Rakit hasil dari transkrip OCR saja, tanpa memanggil model apa pun.
 * Berdiri sendiri supaya perakitan + silang-uji NIK bisa diuji tanpa kunci API
 * dan tanpa jaringan.
 */
export function bacaKtpDariTeks(teks: string): HasilBacaKtp {
  const catatan: string[] = [];
  if (!teks.trim()) {
    return {
      data: KOSONG, sumber: "kosong", skor: 0, status: "invalid",
      peringatan: ["Tidak ada teks terdeteksi — pastikan foto KTP jelas, terang, dan tidak terpotong."],
      catatan_silang: catatan, diagnostik: DIAG_KOSONG,
    };
  }
  const vision = uraiTranskrip(teks);
  const data = rakit(vision, catatan);
  const { skor, status, peringatan } = nilai(data);
  return {
    data, sumber: "vision", skor, status, peringatan, catatan_silang: catatan,
    diagnostik: { ...DIAG_KOSONG, transkrip: teks, vision },
  };
}

export async function bacaKtp(buffer: Buffer, mime: string): Promise<HasilBacaKtp> {
  const base64 = buffer.toString("base64");
  const catatan: string[] = [];

  // Vision jalan DULUAN, bukan paralel: transkrip hasil rekonstruksinya ikut
  // disuapkan ke Gemini sebagai pembanding ejaan & angka. Menjalankan keduanya
  // bersamaan memang lebih cepat beberapa detik — dan itulah persis kesalahan
  // versi pertama: kecepatan ditukar dengan ketelitian pada dokumen hukum.
  let transkrip = "", mentah = "";
  try {
    const v = await bacaVision(buffer);
    transkrip = v.teks;
    mentah = v.mentah;
  } catch (e) {
    catatan.push(`OCR utama tidak tersedia (${(e as Error).message.slice(0, 70)}).`);
  }

  let gemini: Bacaan | null = null;
  let galatGemini: string | null = null;
  try {
    gemini = await bacaDenganGemini(base64, mime, transkrip);
  } catch (e) {
    galatGemini = (e as Error).message.slice(0, 140);
    if (!transkrip) catatan.push(`Pembacaan AI juga gagal (${galatGemini}).`);
  }

  if (!transkrip.trim() && !gemini) {
    return {
      data: KOSONG, sumber: "kosong", skor: 0, status: "invalid",
      peringatan: ["Tidak ada teks terdeteksi — pastikan foto KTP jelas, terang, dan tidak terpotong."],
      catatan_silang: catatan,
      diagnostik: { ...DIAG_KOSONG, mentah, galat_gemini: galatGemini },
    };
  }

  const vision = transkrip ? uraiTranskrip(transkrip) : {};
  const { hasil, diisi, beda } = gabung(vision, gemini, catatan);

  if (diisi.length) catatan.push(`Dilengkapi pembacaan AI: ${diisi.join(", ")}.`);
  for (const b of beda) catatan.push(`Perlu dicek — ${b}`);

  const data = rakit(hasil, catatan);
  const { skor, status, peringatan } = nilai(data);

  const sumber: HasilBacaKtp["sumber"] =
    transkrip && gemini ? "gabungan" : gemini ? "gemini" : "vision";

  return {
    data, sumber, skor, status, peringatan, catatan_silang: catatan,
    diagnostik: { transkrip, mentah, vision, gemini, galat_gemini: galatGemini, diisi_gemini: diisi, beda },
  };
}

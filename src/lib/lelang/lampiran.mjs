// src/lib/lelang/lampiran.mjs
//
// Pengambilan lampiran (PDF pengumuman lelang) — dipakai bersama oleh
// `scripts/scrape-lelang.mjs` (jalur API) dan `src/app/api/scrape/lelang/route.ts`
// (jalur browser). Isinya sengaja bebas Prisma & bebas puppeteer supaya bisa
// diuji tanpa keduanya.
//
// Kenapa berlapis: di halaman detail lot, tautan lampiran BUKAN `<a href>`.
// Teksnya terlihat seperti URL, tapi di-inspect isinya kosong — berkasnya baru
// muncul setelah elemen diklik dan handler JS-nya menembakkan unduhan. Jadi
// membaca DOM saja tidak akan pernah cukup, dan mengandalkan klik saja rapuh.
// Urutan yang dipakai, dari yang paling deterministik:
//
//   1. API publik (permohonan → pengumumans) — tidak menyentuh DOM sama sekali
//   2. Unduhan asli browser hasil klik (khusus route.ts)
//   3. URL PDF yang tersadap dari lalu lintas jaringan halaman
//
// Berapa pun lapis yang dipakai, hasilnya masuk ke `kumpulanLampiran()` yang
// membuang berkas rusak dan berkas kembar (sidik SHA-1), sehingga satu PDF yang
// tertangkap dua lapis sekaligus tidak terunggah dua kali ke Drive.

import { createHash } from "crypto";

export const API_LELANG = "https://api.lelang.go.id/api/v1";
export const FILE_LELANG = "https://file.lelang.go.id/lelang";

const SITUS = "https://lelang.go.id";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** PDF di bawah ukuran ini praktis pasti halaman error yang menyamar. */
export const UKURAN_MINIMAL_PDF = 1024;

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Identitas lot dari URL halaman detail ───────────────────────────────────

/**
 * Bongkar `https://lelang.go.id/kpknl/{unitKerjaId}/detail-auction/{lotLelangId}`.
 * Dipakai scraper DOM untuk melompat ke jalur API tanpa perlu membaca halaman.
 * @param {string} url
 * @returns {{ unitKerjaId: string | null, lotLelangId: string | null }}
 */
export function idsDariUrlLelang(url) {
  const s = String(url ?? "");
  return {
    unitKerjaId: s.match(new RegExp(`/kpknl/(${UUID})`, "i"))?.[1] ?? null,
    lotLelangId: s.match(new RegExp(`detail-auction/(${UUID})`, "i"))?.[1] ?? null,
  };
}

// ─── HTTP (retry + backoff + timeout) ────────────────────────────────────────

async function ambilJson(url, { retries = 3, timeoutMs = 25000 } = {}) {
  for (let percobaan = 1; percobaan <= retries; percobaan++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "application/json",
          Origin: SITUS,
          Referer: `${SITUS}/`,
        },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.status === 404) return null;
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      clearTimeout(timer);
      if (percobaan < retries) await tidur(700 * percobaan * percobaan);
    }
  }
  return null;
}

/**
 * Unduh satu berkas jadi Buffer. Mengembalikan null (bukan melempar) supaya
 * satu PDF yang mati tidak menjatuhkan seluruh listing.
 * @returns {Promise<Buffer | null>}
 */
export async function unduhBuffer(
  url,
  { retries = 4, timeoutMs = 60000, referer = `${SITUS}/` } = {},
) {
  if (!url) return null;
  for (let percobaan = 1; percobaan <= retries; percobaan++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/pdf,*/*", Referer: referer },
        signal: ctrl.signal,
        redirect: "follow",
      });
      clearTimeout(timer);
      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
        return null;
      }
      return Buffer.from(await res.arrayBuffer());
    } catch {
      clearTimeout(timer);
      if (percobaan >= retries) return null;
      await tidur(900 * percobaan * percobaan);
    }
  }
  return null;
}

// ─── Validasi & penamaan ─────────────────────────────────────────────────────

/**
 * Benarkah ini PDF? Header `%PDF` dicari di 1 KB pertama, bukan dipaksa berada
 * tepat di offset 0: sebagian berkas hasil pemindaian menyisipkan byte sampah
 * di depan, dan pemeriksaan `slice(0, 4)` yang lama membuang PDF yang sah.
 * @param {Buffer | null | undefined} buffer
 */
export function adalahPdf(buffer) {
  if (!buffer || buffer.length < UKURAN_MINIMAL_PDF) return false;
  return buffer.subarray(0, UKURAN_MINIMAL_PDF).includes("%PDF");
}

/** Nama berkas yang aman untuk Drive (Drive menolak `/ \ : * ? " < > |`). */
export function bersihkanNamaBerkas(nama, maks = 120) {
  const bersih = String(nama ?? "")
    .replace(/[<>:"\/\\|?*]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return (bersih || "lampiran.pdf").substring(0, maks);
}

/** Tebak nama berkas dari URL-nya; jatuh ke `lampiran.pdf` kalau tak terbaca. */
export function namaDariUrl(url) {
  try {
    const potong = decodeURIComponent(new URL(String(url)).pathname.split("/").pop() ?? "");
    return bersihkanNamaBerkas(/\.pdf$/i.test(potong) ? potong : `${potong || "lampiran"}.pdf`);
  } catch {
    return "lampiran.pdf";
  }
}

// ─── Sumber lapis 1: API publik ──────────────────────────────────────────────

/**
 * Susun URL berkas dari objek `file` milik API. Bentuknya tidak seragam:
 * lot lama memakai `fileUrl` relatif, lot baru memecahnya jadi `folder` +
 * `fileName`, dan segelintir sudah menyimpan URL absolut.
 */
export function urlDariFile(f) {
  if (!f || typeof f !== "object") return null;
  const langsung = String(f.fileUrl ?? "").trim();
  if (langsung) {
    return /^https?:\/\//i.test(langsung)
      ? langsung
      : `${FILE_LELANG}/${langsung.replace(/^\/+/, "")}`;
  }
  const folder = String(f.folder ?? "").replace(/^\/+|\/+$/g, "");
  const nama = String(f.fileName ?? "").trim();
  if (!folder || !nama) return null;
  return `${FILE_LELANG}/${folder}/${nama}`;
}

const KUNCI_DOKUMEN = ["pengumumans", "dokumens", "documents", "lampirans", "files"];

/**
 * Daftar URL PDF lampiran sebuah lot.
 *
 * `permohonanId` adalah kuncinya — satu pengumuman menaungi banyak lot, dan
 * endpoint `pengumumans` hanya mengenal permohonan, bukan lot. Kalau pemanggil
 * sudah memegang payload `landing-page/info` (skrip API), oper lewat `info`
 * supaya tidak ada permintaan HTTP kedua yang percuma.
 *
 * @param {{ lotLelangId?: string | null, permohonanId?: string | null, info?: any }} opsi
 * @returns {Promise<string[]>}
 */
export async function urlLampiranDariApi({
  lotLelangId = null,
  permohonanId = null,
  info = null,
} = {}) {
  const hasil = [];
  const tambah = (u) => {
    if (u && !hasil.includes(u)) hasil.push(u);
  };

  let d = info;
  if (!d && lotLelangId) {
    d = (await ambilJson(`${API_LELANG}/landing-page/info/${lotLelangId}`))?.data ?? null;
  }

  const idPermohonan = permohonanId ?? d?.permohonanId ?? null;
  if (idPermohonan) {
    const j = await ambilJson(`${API_LELANG}/public/permohonan/${idPermohonan}/pengumumans`);
    for (const doc of Array.isArray(j?.data) ? j.data : []) {
      if (doc?.deletedAt) continue;
      tambah(urlDariFile(doc?.file));
    }
  }

  // Cadangan: sebagian lot menempelkan dokumennya langsung di payload sendiri.
  for (const kunci of KUNCI_DOKUMEN) {
    for (const wadah of [d?.[kunci], d?.content?.[kunci]]) {
      for (const doc of Array.isArray(wadah) ? wadah : []) {
        if (doc?.deletedAt) continue;
        tambah(urlDariFile(doc?.file ?? doc));
      }
    }
  }

  // Buang yang jelas-jelas gambar; sisanya biar validasi `%PDF` yang memutus.
  return hasil.filter((u) => !/\.(jpe?g|png|webp|gif|svg)($|\?)/i.test(u));
}

/** Apakah URL/tipe konten ini layak dicoba sebagai lampiran PDF? */
export function tampakPdf(url, contentType = "") {
  return (
    /\.pdf($|\?)/i.test(String(url ?? "")) ||
    String(contentType ?? "").toLowerCase().includes("application/pdf")
  );
}

// ─── Penampung hasil ─────────────────────────────────────────────────────────

/**
 * Penampung lampiran yang menolak berkas rusak dan berkas kembar.
 *
 * Dedup pakai SHA-1 isi berkas, bukan URL: pengumuman yang sama sering muncul
 * dengan URL berbeda (lewat API vs lewat unduhan browser), dan tanpa ini satu
 * PDF bisa terunggah dua kali ke Drive lalu tersimpan dua kali di kolom
 * `lampiran`.
 */
export function kumpulanLampiran() {
  const sidik = new Set();
  const isi = [];
  return {
    /**
     * @param {Buffer | null | undefined} buffer
     * @param {string} nama
     * @param {string} asal  lapis yang menghasilkannya (untuk log)
     * @returns {boolean} true kalau benar-benar masuk
     */
    tambah(buffer, nama, asal = "?") {
      if (!adalahPdf(buffer)) return false;
      const h = createHash("sha1").update(buffer).digest("hex");
      if (sidik.has(h)) return false;
      sidik.add(h);
      isi.push({ buffer, nama: bersihkanNamaBerkas(nama), asal });
      return true;
    },
    get daftar() {
      return isi;
    },
    get jumlah() {
      return isi.length;
    },
    /** Ringkasan asal berkas, mis. "api×2, klik×1" — untuk baris log. */
    ringkasAsal() {
      const n = new Map();
      for (const x of isi) n.set(x.asal, (n.get(x.asal) ?? 0) + 1);
      return [...n.entries()].map(([k, v]) => `${k}×${v}`).join(", ");
    },
  };
}

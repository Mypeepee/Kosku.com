// src/lib/auctionHistory.ts
//
// ══════════════════════════════════════════════════════════════════════════
// MESIN RIWAYAT LELANG — satu sumber kebenaran untuk "aset ini sudah pernah
// dilelang berapa kali, kapan, dan berapa limitnya".
// ══════════════════════════════════════════════════════════════════════════
//
// MASALAH YANG DIPECAHKAN
// Satu aset fisik dilelang berkali-kali → setiap event lelang di-scrape jadi
// baris `listing` BARU (id_property beda, link beda). Tidak ada kolom "id aset"
// dari sumber (lelang.go.id), jadi identitas aset harus DITURUNKAN dari data.
//
// Implementasi lama mencocokkan dengan kesetaraan string mentah
// (legalitas + nomor_legalitas + kelurahan), sehingga riwayat sering hilang:
//   1. Nomor sertifikat di-pad nol: "3729" vs "00003729" vs "0000000003729".
//      Nyata: 35.609 dari 121.821 baris lelang punya leading zero, dan 1.824
//      pasangan aset yang sama gagal cocok hanya karena ini.
//   2. Kelurahan di-parse regex dari alamat bebas → sering NULL di salah satu
//      baris (8.871 baris tanpa kelurahan). Pencocokan lama menuntut kelurahan
//      sama persis, jadi pasangan "ada vs NULL" pasti gagal.
//   3. Typo/varian ejaan kelurahan ("Klumpang Kebon" vs "Klumpang Kebun",
//      "Bonto Biraeng" vs "Bontobiraeng").
//   4. Satu event lelang kadang ter-scrape jadi beberapa baris kembar
//      (tanggal + limit identik) → riwayat menampilkan baris dobel.
//
// ── ASET DENGAN BANYAK NOMOR SERTIFIKAT ───────────────────────────────────
// Satu lot lelang sering berisi BEBERAPA bidang sekaligus. Scraper menyimpan
// semua nomornya dalam satu kolom, dipisah koma ("123,456"), dan `luas_tanah`
// diisi TOTAL luas semua bidang (lihat totalLuas() di scripts/scrape-lelang.mjs).
// Versi sebelumnya memperlakukan nomor sertifikat sebagai satu skalar — hanya
// nomor PERTAMA yang dinormalkan dan dicocokkan (split_part(...,',',1)). Akibatnya
// riwayat aset multi-sertifikat praktis mati:
//   • urutan bidang dari sumber tidak stabil → "123,456" vs "456,123" tidak
//     pernah bertemu, padahal aset yang sama persis;
//   • paket yang dilelang ulang dengan bidang tambahan/berkurang
//     ("123,456" vs "789,123") tidak pernah bertemu;
//   • pagar "luas tanah beda >10% = tolak" ikut membunuh pasangan paket-vs-satuan,
//     padahal luasnya memang HARUS beda (total 3 bidang vs 1 bidang).
//
// Sekarang nomor sertifikat diperlakukan sebagai HIMPUNAN:
//   • dua listing jadi kandidat bila himpunan nomornya BERIRISAN (operator `&&`
//     Postgres di atas index GIN — lihat prisma/migration_riwayat_lelang_index.sql);
//   • hubungan cakupan bidangnya dicatat (SAMA / SEBAGIAN / LEBIH_LUAS /
//     BERIRISAN) dan dipakai untuk menentukan aturan luas, tingkat keyakinan,
//     serta entri mana yang boleh masuk rantai perbandingan harga. Perbandingan
//     harga antar cakupan berbeda itu MENYESATKAN (paket 3 bidang Rp 3 M vs 1
//     bidang Rp 1 M bukan "turun 66%"), jadi delta-nya sengaja tidak dihitung.
//
// PENDEKATAN
// Dua tahap: KANDIDAT (murah, terindeks) lalu PENILAIAN (di aplikasi).
//   Tahap 1 — ambil semua listing LELANG yang himpunan nomor sertifikatnya
//   beririsan dengan milik acuan, lewat index GIN ekspresi.
//   Tahap 2 — skor tiap kandidat memakai bukti wilayah + fisik, lalu terima
//   yang melewati ambang. Nomor sertifikat hanya unik di dalam satu
//   kelurahan/desa, jadi bukti wilayah wajib; tanpa itu "SHM 12" di kota yang
//   sama bisa saja dua aset berbeda.
//
// Aturan skor sengaja konservatif ke arah "jangan mengarang riwayat":
// kelurahan yang JELAS berbeda memberi penalti besar sehingga aset berbeda
// dengan nomor sertifikat kebetulan sama tidak pernah digabung.

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

/* ───────────────────────────── Normalisasi ───────────────────────────── */

/** Uppercase, buang tanda baca, rapatkan spasi. "Kab. Bogor " → "KAB BOGOR". */
export function normText(v?: string | null): string | null {
  if (!v) return null;
  const s = v
    .toUpperCase()
    .replace(/[^0-9A-Z]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s || null;
}

/**
 * Pemecahan nomor sertifikat tinggal di modul terpisah yang BEBAS PRISMA
 * (src/lib/nomorLegalitas.ts) — halaman detail perlu aturan yang sama persis
 * di browser, dan file ini tidak bisa diimpor dari sana. Di-reexport supaya
 * pemanggil lama (auctionMatch, auctionDiscount) tidak perlu ikut berubah.
 *
 * Kelas pemisahnya HARUS identik dengan yang dipakai `certKeysSql()` di bawah.
 */
export { certNumbers } from "@/lib/nomorLegalitas";
import { certNumbers } from "@/lib/nomorLegalitas";

/** Buang awalan administratif supaya "Kel. Sawahan" == "SAWAHAN". */
export function normWilayah(v?: string | null): string | null {
  const s = normText(v);
  if (!s) return null;
  return (
    s
      .replace(/^(KELURAHAN|KEL|DESA KELURAHAN|DESA|DS)\s+/, "")
      .replace(/^(KECAMATAN|KEC)\s+/, "")
      .trim() || null
  );
}

export type KotaKey = { tipe: "KOTA" | "KAB" | null; core: string | null };

/**
 * Pisah kota jadi tipe + nama inti. "Kota Adm. Jakarta Selatan" →
 * {KOTA, "JAKARTA SELATAN"}. Tipe TIDAK dibuang: "Kota Bogor" dan "Kab. Bogor"
 * adalah dua daerah berbeda.
 */
export function parseKota(v?: string | null): KotaKey {
  const s = normText(v);
  if (!s) return { tipe: null, core: null };
  let m = s.match(/^KOTA\s+ADM(?:INISTRASI|INISTRATIF|INISTRATIP)?\s+(.+)$/);
  if (m) return { tipe: "KOTA", core: m[1] };
  m = s.match(/^KOTA\s+(.+)$/);
  if (m) return { tipe: "KOTA", core: m[1] };
  m = s.match(/^(?:KABUPATEN|KAB)\s+(.+)$/);
  if (m) return { tipe: "KAB", core: m[1] };
  return { tipe: null, core: s };
}

/** Jarak edit dengan batas atas — cukup untuk mendeteksi typo satu huruf. */
function editDistanceAtMost(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1);
  const cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let best = cur[0];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

/** Nama wilayah "hampir sama": beda spasi saja, atau typo ≤1 huruf. */
function nearlySameWilayah(a: string, b: string): boolean {
  if (a === b) return true;
  const ca = a.replace(/\s/g, "");
  const cb = b.replace(/\s/g, "");
  if (ca === cb) return true;
  if (Math.min(ca.length, cb.length) < 5) return false;
  return editDistanceAtMost(ca, cb, 1) <= 1;
}

/* ───────────────────────────── Tipe data ─────────────────────────────── */

/** Kolom minimum yang dibutuhkan mesin pencocokan. */
export type AssetFingerprint = {
  id_property: bigint | string;
  legalitas?: string | null;
  nomor_legalitas?: string | null;
  kelurahan?: string | null;
  kecamatan?: string | null;
  kota?: string | null;
  luas_tanah?: unknown;
  luas_bangunan?: unknown;
  alamat_lengkap?: string | null;
  latitude?: unknown;
  longitude?: unknown;
};

/** PASTI = kelurahan cocok / bukti berlapis. TINGGI = bukti pendukung cukup. */
export type MatchConfidence = "PASTI" | "TINGGI";

/**
 * Hubungan himpunan bidang kandidat terhadap acuan.
 *   SAMA       — persis bidang yang sama (satu-satunya yang boleh dibandingkan
 *                harganya secara langsung).
 *   SEBAGIAN   — kandidat memuat sebagian bidang acuan (paket acuan dipecah).
 *   LEBIH_LUAS — kandidat memuat acuan plus bidang lain (acuan bagian dari paket).
 *   BERIRISAN  — sebagian sama, sebagian beda di kedua arah.
 */
export type Cakupan = "SAMA" | "SEBAGIAN" | "LEBIH_LUAS" | "BERIRISAN";

export type MatchVerdict = {
  cocok: boolean;
  skor: number;
  confidence: MatchConfidence;
  alasan: string[];
  /** Nomor sertifikat yang dimiliki kedua listing. */
  nomor_cocok: string[];
  cakupan: Cakupan;
};

export type AuctionHistoryItem = {
  id_property: string;
  urutan: number;
  is_current: boolean;
  judul: string;
  slug: string;
  harga: number;
  nilai_limit_lelang: number | null;
  /** Harga yang dipakai UI: limit lelang bila ada, kalau tidak kolom harga. */
  harga_efektif: number | null;
  uang_jaminan: number | null;
  tanggal_lelang: string | null;
  tanggal_dibuat: string | null;
  gambar_utama: string | null;
  gambar_list: string[];
  status_tayang: string;
  jenis_transaksi: string;
  kelurahan: string | null;
  kecamatan: string | null;
  kota: string | null;
  provinsi: string | null;
  legalitas: string | null;
  nomor_legalitas: string | null;
  /** Nomor sertifikat ternormalisasi milik entri ini — untuk ditampilkan. */
  nomor_legalitas_list: string[];
  /** Irisan nomor sertifikat dengan listing yang sedang dibuka. */
  nomor_cocok: string[];
  cakupan: Cakupan;
  alamat_lengkap: string | null;
  luas_tanah: number | null;
  luas_bangunan: number | null;
  link: string | null;
  id_agent: string | null;
  confidence: MatchConfidence;
  alasan_cocok: string[];
  /** Baris lain dengan event lelang identik (tanggal + limit) yang digabung. */
  duplikat_ids: string[];
  /**
   * Perubahan harga_efektif terhadap entri `cakupan: "SAMA"` sebelumnya, persen.
   * Selalu null untuk entri dengan cakupan bidang berbeda — angkanya tidak
   * sebanding, dan menampilkannya sama saja dengan mengarang penurunan harga.
   */
  delta_persen: number | null;
};

export type AuctionHistoryResult = {
  ok: boolean;
  items: AuctionHistoryItem[];
  total: number;
  /** Entri selain listing yang sedang dibuka. */
  total_lain: number;
  /** Entri dengan bidang yang persis sama (termasuk listing ini sendiri). */
  total_sebidang: number;
  /** Entri yang cakupan bidangnya berbeda (paket dipecah / digabung). */
  total_lot_terkait: number;
  match: {
    legalitas: string | null;
    nomor_legalitas: string | null;
    nomor_normal: string[];
    kelurahan: string | null;
    kecamatan: string | null;
    kota: string | null;
    wilayah_level: "kelurahan" | "kecamatan" | "kota";
  } | null;
  /** Kenapa riwayat cuma berisi listing ini sendiri. */
  alasan_tanpa_riwayat: "TANPA_SERTIFIKAT" | "TIDAK_ADA_KECOCOKAN" | null;
};

/* ─────────────────────────── Penilaian kandidat ───────────────────────── */

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v as any);
  return Number.isFinite(n) ? n : null;
};

const SKOR_MINIMUM = 2;

/**
 * Seberapa yakin `kandidat` adalah aset fisik yang sama dengan `acuan`.
 * Irisan nomor sertifikat dihitung sendiri di sini, jadi fungsi ini aman
 * dipanggil untuk kandidat apa pun (bukan hanya hasil query terindeks).
 */
export function scoreAssetMatch(
  acuan: AssetFingerprint,
  kandidat: AssetFingerprint
): MatchVerdict {
  const nomorA = certNumbers(acuan.nomor_legalitas);
  const nomorB = certNumbers(kandidat.nomor_legalitas);
  const punyaB = new Set(nomorB);
  const irisan = nomorA.filter((n) => punyaB.has(n));

  // Tanpa satu pun nomor sertifikat yang sama, tidak ada dasar apa pun untuk
  // menyebut ini aset yang sama — kesamaan wilayah/luas saja tidak cukup.
  if (irisan.length === 0) {
    return {
      cocok: false,
      skor: -99,
      confidence: "TINGGI",
      alasan: ["nomor sertifikat tidak beririsan"],
      nomor_cocok: [],
      cakupan: "BERIRISAN",
    };
  }

  const cakupan: Cakupan =
    irisan.length === nomorA.length && irisan.length === nomorB.length
      ? "SAMA"
      : irisan.length === nomorB.length
      ? "SEBAGIAN"
      : irisan.length === nomorA.length
      ? "LEBIH_LUAS"
      : "BERIRISAN";

  const tolak = (sebab: string): MatchVerdict => ({
    cocok: false,
    skor: -99,
    confidence: "TINGGI",
    alasan: [sebab],
    nomor_cocok: irisan,
    cakupan,
  });

  const alasan: string[] = [];

  /* ── Bukti mentah, dikumpulkan dulu supaya pagar keras bisa memakainya ── */

  const kotaA = parseKota(acuan.kota);
  const kotaB = parseKota(kandidat.kota);

  const almA = normText(acuan.alamat_lengkap);
  const almB = normText(kandidat.alamat_lengkap);
  const alamatIdentik = Boolean(almA && almB && almA === almB);

  const latA = toNum(acuan.latitude);
  const lngA = toNum(acuan.longitude);
  const latB = toNum(kandidat.latitude);
  const lngB = toNum(kandidat.longitude);
  // ±0,0005° ≈ 55 m — cukup ketat untuk membedakan bidang bertetangga.
  const koordinatIdentik = Boolean(
    latA &&
      lngA &&
      latB &&
      lngB &&
      Math.abs(latA - latB) <= 0.0005 &&
      Math.abs(lngA - lngB) <= 0.0005
  );

  const kelA = normWilayah(acuan.kelurahan);
  const kelB = normWilayah(kandidat.kelurahan);
  const kelurahanIdentik = Boolean(kelA && kelB && kelA === kelB);
  const kelurahanMirip =
    !kelurahanIdentik && Boolean(kelA && kelB && nearlySameWilayah(kelA, kelB));
  const kelurahanBerbeda = Boolean(kelA && kelB) && !kelurahanIdentik && !kelurahanMirip;

  const legA = normText(acuan.legalitas);
  const legB = normText(kandidat.legalitas);
  const legalitasBerbeda = Boolean(legA && legB && legA !== legB);

  const ltA = toNum(acuan.luas_tanah);
  const ltB = toNum(kandidat.luas_tanah);
  const adaLuas = ltA !== null && ltB !== null && ltA > 0 && ltB > 0;
  const selisihLuas = adaLuas
    ? Math.abs((ltA as number) - (ltB as number)) /
      Math.max(ltA as number, ltB as number)
    : null;

  /* ── Pagar keras ─────────────────────────────────────────────────────── */

  // 1. Kota: beda kota = beda aset, tanpa kecuali.
  if (kotaA.core && kotaB.core) {
    if (kotaA.core !== kotaB.core) return tolak("kota berbeda");
    if (kotaA.tipe && kotaB.tipe && kotaA.tipe !== kotaB.tipe)
      return tolak("kota/kabupaten berbeda");
    alasan.push("kota sama");
  }

  // 2. Jenis sertifikat. Normalnya harus sama. Pengecualiannya paket campuran:
  // scraper hanya menyimpan jenis dari bidang PERTAMA (certFromBarangs di
  // scripts/scrape-lelang.mjs), jadi paket "SHM 12 + SHGB 34" bisa tercatat SHM
  // di satu event dan SHGB di event lain hanya karena urutan bidang berubah.
  // Dua nomor yang sama-sama beririsan sudah cukup mustahil untuk kebetulan.
  if (legalitasBerbeda && irisan.length < 2)
    return tolak("jenis sertifikat berbeda");

  // 3. Luas tanah.
  if (cakupan === "SAMA") {
    // Bidang yang diklaim sama persis harus punya luas yang sama. Satu nomor
    // sertifikat kadang dipakai untuk beberapa bidang berbeda dalam satu paket
    // lelang (mis. 8 lot "HP 26" di Kelurahan Entrop: ada yang 3 m², ada yang
    // 19 m²). Tanpa aturan ini, bidang-bidang itu tampil sebagai "riwayat harga"
    // yang menyesatkan. Toleransi 10% menampung selisih pembulatan sumber.
    // Aturan ini tanpa pengecualian: lot-lot begitu biasanya berbagi alamat dan
    // titik koordinat yang sama persis (satu blok ruko/kompleks), jadi alamat &
    // koordinat tidak boleh dipakai untuk menganulirnya.
    if (selisihLuas !== null && selisihLuas > 0.1)
      return tolak("luas tanah jauh berbeda (bidang lain)");
  } else if (
    adaLuas &&
    (cakupan === "SEBAGIAN" || cakupan === "LEBIH_LUAS")
  ) {
    // Salah satu sisi memuat seluruh bidang sisi lain plus tambahan, jadi
    // luasnya WAJIB boleh beda — yang tidak masuk akal justru kalau sisi
    // dengan bidang lebih banyak malah jauh lebih sempit. Toleransi 10% untuk
    // pembulatan sumber. Cakupan BERIRISAN tidak diuji di sini: tidak ada sisi
    // yang memuat sisi lainnya, jadi luas mana pun bisa lebih besar — yang
    // menjaganya adalah pagar bukti lokasi di bawah.
    const [luasBanyak, luasSedikit] =
      cakupan === "SEBAGIAN"
        ? [ltA as number, ltB as number]
        : [ltB as number, ltA as number];
    if (luasBanyak < luasSedikit * 0.9)
      return tolak("luas tanah tidak konsisten dengan jumlah bidang");
  }

  // 4. Cakupan bidang berbeda perlu bukti lokasi yang keras. Tanpa ini, satu
  // nomor pendek yang kebetulan sama sudah cukup untuk menempelkan paket
  // asing ke riwayat aset ini.
  if (
    cakupan !== "SAMA" &&
    !(kelurahanIdentik || alamatIdentik || koordinatIdentik)
  )
    return tolak("cakupan bidang berbeda tanpa bukti lokasi yang cukup");

  /* ── Skor ────────────────────────────────────────────────────────────── */

  let skor = 0;

  // Nomor sertifikat panjang jauh lebih jarang bertabrakan daripada "SHM 12".
  // Yang dinilai adalah nomor yang BERIRISAN, bukan nomor pertama acuan.
  const nomorTerpanjang = irisan.reduce((m, n) => Math.max(m, n.length), 0);
  if (nomorTerpanjang >= 5) skor += 2;
  else if (nomorTerpanjang === 4) skor += 1;

  // Dua nomor sertifikat yang sama-sama cocok pada dua listing berbeda praktis
  // tidak mungkin kebetulan — ini bukti terkuat yang dipunyai aset multi-bidang.
  if (irisan.length >= 2) {
    skor += 3;
    alasan.push(`${irisan.length} nomor sertifikat sama`);
  }
  if (irisan.length >= 3) skor += 1;

  // Kelurahan — bukti terkuat berikutnya, karena nomor sertifikat unik per
  // kelurahan.
  if (kelurahanIdentik) {
    skor += 4;
    alasan.push("kelurahan sama");
  } else if (kelurahanMirip) {
    skor += 2;
    alasan.push("kelurahan mirip (beda ejaan)");
  } else if (kelurahanBerbeda) {
    skor -= 4;
    alasan.push("kelurahan berbeda");
  }

  // Kecamatan — bukti pendukung, penting saat kelurahan tidak ter-parse.
  const kecA = normWilayah(acuan.kecamatan);
  const kecB = normWilayah(kandidat.kecamatan);
  if (kecA && kecB) {
    if (kecA === kecB || nearlySameWilayah(kecA, kecB)) {
      skor += 2;
      alasan.push("kecamatan sama");
    } else {
      skor -= 2;
      alasan.push("kecamatan berbeda");
    }
  }

  // Luas tanah — atribut fisik paling stabil antar event lelang, tapi hanya
  // bermakna kalau bidang yang dicakup memang sama.
  if (cakupan === "SAMA" && selisihLuas !== null) {
    if (selisihLuas <= 0.01) {
      skor += 2;
      alasan.push("luas tanah sama");
    } else {
      alasan.push("luas tanah hampir sama");
    }
  }

  if (alamatIdentik) {
    skor += 2;
    alasan.push("alamat sama");
  }
  if (koordinatIdentik) {
    skor += 2;
    alasan.push("titik koordinat sama");
  }

  if (cakupan === "SEBAGIAN") alasan.push("sebagian bidang dari listing ini");
  else if (cakupan === "LEBIH_LUAS") alasan.push("paket yang memuat aset ini");
  else if (cakupan === "BERIRISAN") alasan.push("paket dengan bidang beririsan");

  // Kelurahan yang jelas berbeda masih bisa lolos kalau bukti lain menumpuk
  // (alamat + luas + kecamatan sama persis = kemungkinan besar kelurahan salah
  // parse), tapi tidak pernah boleh diklaim "PASTI".
  const cocok = kelurahanIdentik || skor >= SKOR_MINIMUM;
  const confidence: MatchConfidence =
    !kelurahanBerbeda &&
    !legalitasBerbeda &&
    cakupan === "SAMA" &&
    (kelurahanIdentik || skor >= 4)
      ? "PASTI"
      : "TINGGI";

  return { cocok, skor, confidence, alasan, nomor_cocok: irisan, cakupan };
}

/* ────────────────────────── Pengambilan riwayat ───────────────────────── */

type ListingRow = {
  id_property: bigint;
  judul: string;
  slug: string;
  harga: Prisma.Decimal | null;
  nilai_limit_lelang: Prisma.Decimal | null;
  uang_jaminan: Prisma.Decimal | null;
  tanggal_lelang: Date | null;
  tanggal_dibuat: Date | null;
  gambar: string | null;
  status_tayang: string;
  jenis_transaksi: string;
  kelurahan: string | null;
  kecamatan: string | null;
  kota: string | null;
  provinsi: string | null;
  legalitas: string | null;
  nomor_legalitas: string | null;
  alamat_lengkap: string | null;
  luas_tanah: Prisma.Decimal | null;
  luas_bangunan: Prisma.Decimal | null;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
  link: string | null;
  id_agent: string | null;
};

const KOLOM = Prisma.sql`
  id_property, judul, slug, harga, nilai_limit_lelang, uang_jaminan,
  tanggal_lelang, tanggal_dibuat, gambar, status_tayang, jenis_transaksi,
  kelurahan, kecamatan, kota, provinsi, legalitas, nomor_legalitas,
  alamat_lengkap, luas_tanah, luas_bangunan, latitude, longitude, link, id_agent
`;

/**
 * Ekspresi Postgres: kolom nomor sertifikat → `text[]` berisi nomor kanonik.
 * Cerminan SQL dari `certNumbers()`.
 *
 * ⚠️ HARUS sama persis dengan definisi index di
 * prisma/migration_riwayat_lelang_index.sql. Postgres membandingkan POHON
 * ekspresi (spasi & baris baru bebas), tapi urutan fungsi, pola regex, dan
 * argumennya harus identik — beda satu karakter di dalam pola regex saja sudah
 * bikin index GIN berhenti terpakai (seq scan ±122 ribu baris tiap membuka
 * halaman detail).
 *
 * Sengaja ditulis sebagai ekspresi murni, bukan fungsi PL/pgSQL: kalau
 * migrasi index belum dijalankan di suatu environment, fitur ini tetap BENAR
 * (hanya lebih lambat) — bukan error "function does not exist".
 *
 * Bedanya dengan `certNumbers()`: sisi SQL sengaja TIDAK membuang potongan
 * tanpa angka (mis. "DESASUKAJADI"). Itu aman karena hasil SQL cuma dipakai
 * sebagai penyaring kandidat, dan himpunannya selalu SUPERSET dari hasil JS —
 * jadi tidak ada pasangan benar yang hilang, sementara penyaringan presisi
 * tetap dilakukan `scoreAssetMatch()` di aplikasi.
 */
export function certKeysSql(kolom: string): string {
  return `string_to_array(NULLIF(btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(',' || upper(COALESCE(${kolom}, '')) || ',', '[,;/|+&]|\\mDAN\\M', ',', 'g'), '[^0-9A-Z,]', '', 'g'), ',0+', ',', 'g'), ',+', ',', 'g'), ','), ''), ',')`;
}

/** Himpunan nomor sertifikat kanonik dari kolom `listing.nomor_legalitas`. */
export const CERT_KEYS_EXPR = Prisma.raw(certKeysSql("nomor_legalitas"));

/**
 * Saringan kota di sisi SQL — bukan optimasi kosmetik, tapi pengaman ketepatan.
 *
 * Aset multi-bidang bisa membawa belasan nomor sertifikat, dan nomor pendek
 * ("1", "12") dipakai ratusan listing. Probe berisi 20 nomor pendek menarik
 * 2.361 baris pada data sekarang, jauh di atas batas MAKS_KANDIDAT — pasangan
 * yang benar bisa ikut terpotong dan riwayatnya hilang lagi. Menyaring kota
 * lebih dulu memangkasnya jadi 25 baris.
 *
 * Aman karena kota SUDAH jadi pagar keras di `scoreAssetMatch()`: baris yang
 * disaring di sini toh pasti ditolak. Sengaja dibuat PERMISIF (`LIKE %core%`,
 * bukan kesetaraan) supaya tetap lolos apa pun awalannya —
 * "Kota Adm. Jakarta Selatan", "KAB BOGOR", "Bogor" — dan baris tanpa kota
 * juga dibiarkan lewat, persis seperti perlakuan scoreAssetMatch.
 *
 * `core` berasal dari `parseKota()` yang hanya menghasilkan [0-9A-Z ], jadi
 * tidak ada metakarakter LIKE (%, _) yang bisa lolos.
 */
export function filterKotaSql(cores: Array<string | null>): Prisma.Sql {
  // Satu saja acuan tanpa kota → tidak ada dasar menyaring apa pun. Diperiksa
  // SEBELUM dedup: dua acuan di kota yang sama menyusut jadi satu pola, dan
  // membandingkan panjang sesudah dedup akan salah mematikan saringan ini.
  if (cores.length === 0 || cores.some((c) => !c)) return Prisma.sql`TRUE`;
  const pola = Array.from(new Set(cores as string[])).map((c) => `%${c}%`);
  return Prisma.sql`(
    upper(regexp_replace(kota, '[^0-9A-Za-z]+', ' ', 'g')) LIKE ANY (ARRAY[${Prisma.join(pola)}]::text[])
    OR regexp_replace(kota, '[^0-9A-Za-z]+', '', 'g') = ''
  )`;
}

/**
 * Batas pengaman terakhir, setelah saringan kota (lihat `filterKotaSql`).
 * Grup terbesar per satu nomor pada data produksi: 202 baris (nomor "1"), dan
 * itu tersebar ke seluruh Indonesia — sesudah disaring per kota, satu aset
 * realistis tidak pernah mendekati angka ini. Diurutkan `id_property` supaya,
 * kalau batas ini benar-benar tersentuh, hasilnya tetap sama tiap kali dimuat
 * (bukan riwayat yang "kadang muncul kadang tidak").
 */
const MAKS_KANDIDAT = 1000;

const splitGambar = (g: string | null): string[] =>
  (g ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const dec = (v: Prisma.Decimal | null): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Kunci event lelang: tanggal + nilai limit + himpunan bidang. Dipakai untuk
 * membuang baris kembar hasil scrape berulang. Himpunan bidang ikut jadi kunci
 * supaya dua LOT BERBEDA pada satu tanggal dengan limit kebetulan sama (lazim
 * pada paket yang dipecah rata) tidak ikut dilebur jadi satu baris.
 */
function eventKey(r: ListingRow): string {
  const tgl = r.tanggal_lelang
    ? new Date(r.tanggal_lelang).toISOString().slice(0, 10)
    : "";
  const limit = r.nilai_limit_lelang ? String(dec(r.nilai_limit_lelang)) : "";
  // Tanpa tanggal maupun limit tidak ada dasar menyatakan kembar → unik per baris.
  if (!tgl && !limit) return `id:${r.id_property.toString()}`;
  return `${tgl}|${limit}|${certNumbers(r.nomor_legalitas).join("-")}`;
}

function waktuUrut(r: ListingRow): number {
  const t = r.tanggal_lelang ?? r.tanggal_dibuat;
  return t ? new Date(t).getTime() : Number.MAX_SAFE_INTEGER;
}

/**
 * Riwayat lelang lengkap untuk satu listing — SELALU menyertakan listing itu
 * sendiri, meskipun tidak ada aset lain yang cocok atau data sertifikatnya
 * kosong. Hasil sudah urut kronologis dan bebas duplikat.
 */
export async function getAuctionHistory(
  idProperty: bigint | string | number
): Promise<AuctionHistoryResult | null> {
  let id: bigint;
  try {
    id = BigInt(idProperty as any);
  } catch {
    return null;
  }

  const acuanRows = await prisma.$queryRaw<ListingRow[]>`
    SELECT ${KOLOM} FROM listing WHERE id_property = ${id} LIMIT 1
  `;
  const acuan = acuanRows[0];
  if (!acuan) return null;

  const nomorSet = certNumbers(acuan.nomor_legalitas);
  const bisaCocok = nomorSet.length > 0;

  let kandidat: ListingRow[] = [];
  if (bisaCocok) {
    // Kandidat = irisan himpunan nomor sertifikat (`&&`), bukan kesamaan nomor
    // pertama. Jenis sertifikat sengaja TIDAK disaring di SQL — paket campuran
    // bisa tercatat dengan jenis berbeda antar event; keputusannya diserahkan
    // ke scoreAssetMatch() yang punya konteks jumlah nomor yang beririsan.
    kandidat = await prisma.$queryRaw<ListingRow[]>`
      SELECT ${KOLOM}
      FROM listing
      WHERE jenis_transaksi = 'LELANG'
        AND status_tayang <> 'TARIK_LISTING'
        AND ${CERT_KEYS_EXPR} && ARRAY[${Prisma.join(nomorSet)}]::text[]
        AND ${filterKotaSql([parseKota(acuan.kota).core])}
        AND id_property <> ${id}
      ORDER BY id_property
      LIMIT ${MAKS_KANDIDAT}
    `;
  }

  // Terima kandidat yang lolos penilaian; simpan alasannya untuk transparansi.
  const diterima: Array<{ row: ListingRow; verdict: MatchVerdict }> = [];
  for (const k of kandidat) {
    const verdict = scoreAssetMatch(acuan, k);
    if (verdict.cocok) diterima.push({ row: k, verdict });
  }

  const semua: Array<{ row: ListingRow; verdict: MatchVerdict }> = [
    {
      row: acuan,
      verdict: {
        cocok: true,
        skor: 999,
        confidence: "PASTI",
        alasan: ["listing yang sedang dibuka"],
        nomor_cocok: nomorSet,
        cakupan: "SAMA",
      },
    },
    ...diterima,
  ];

  // Gabungkan baris kembar (satu event lelang ter-scrape berkali-kali).
  const perEvent = new Map<
    string,
    { row: ListingRow; verdict: MatchVerdict; duplikat: string[] }
  >();
  for (const entri of semua) {
    const key = eventKey(entri.row);
    const ada = perEvent.get(key);
    if (!ada) {
      perEvent.set(key, { ...entri, duplikat: [] });
      continue;
    }
    // Listing yang sedang dibuka selalu jadi wakil event-nya.
    const wakilBaru =
      entri.row.id_property === id ||
      (ada.row.id_property !== id && entri.row.id_property < ada.row.id_property);
    if (wakilBaru) {
      perEvent.set(key, {
        row: entri.row,
        verdict: entri.verdict,
        duplikat: [...ada.duplikat, ada.row.id_property.toString()],
      });
    } else {
      ada.duplikat.push(entri.row.id_property.toString());
    }
  }

  const urut = Array.from(perEvent.values()).sort((a, b) => {
    const da = waktuUrut(a.row);
    const db = waktuUrut(b.row);
    if (da !== db) return da - db;
    return Number(a.row.id_property - b.row.id_property);
  });

  const hargaEfektif = (r: ListingRow): number | null => {
    const limit = dec(r.nilai_limit_lelang);
    if (limit && limit > 0) return limit;
    const harga = dec(r.harga) ?? 0;
    return harga > 0 ? harga : null;
  };

  // Rantai perbandingan harga hanya menyusuri entri dengan bidang yang sama
  // persis; entri paket/pecahan dilewati supaya tidak melahirkan "diskon" palsu.
  let efektifSebelumnya: number | null = null;

  const items: AuctionHistoryItem[] = urut.map((entri, idx) => {
    const r = entri.row;
    const limit = dec(r.nilai_limit_lelang);
    const harga = dec(r.harga) ?? 0;
    const efektif = hargaEfektif(r);
    const sebidang = entri.verdict.cakupan === "SAMA";

    let delta: number | null = null;
    if (sebidang) {
      if (efektif && efektifSebelumnya) {
        delta = ((efektif - efektifSebelumnya) / efektifSebelumnya) * 100;
      }
      if (efektif) efektifSebelumnya = efektif;
    }

    const gambarList = splitGambar(r.gambar);

    return {
      id_property: r.id_property.toString(),
      urutan: idx + 1,
      is_current: r.id_property === id,
      judul: r.judul,
      slug: r.slug,
      harga,
      nilai_limit_lelang: limit,
      harga_efektif: efektif,
      uang_jaminan: dec(r.uang_jaminan),
      tanggal_lelang: r.tanggal_lelang
        ? new Date(r.tanggal_lelang).toISOString()
        : null,
      tanggal_dibuat: r.tanggal_dibuat
        ? new Date(r.tanggal_dibuat).toISOString()
        : null,
      gambar_utama: gambarList[0] ?? null,
      gambar_list: gambarList,
      status_tayang: r.status_tayang,
      jenis_transaksi: r.jenis_transaksi,
      kelurahan: r.kelurahan,
      kecamatan: r.kecamatan,
      kota: r.kota,
      provinsi: r.provinsi,
      legalitas: r.legalitas,
      nomor_legalitas: r.nomor_legalitas,
      nomor_legalitas_list: certNumbers(r.nomor_legalitas),
      nomor_cocok: entri.verdict.nomor_cocok,
      cakupan: entri.verdict.cakupan,
      alamat_lengkap: r.alamat_lengkap,
      luas_tanah: dec(r.luas_tanah),
      luas_bangunan: dec(r.luas_bangunan),
      link: r.link,
      id_agent: r.id_agent,
      confidence: entri.verdict.confidence,
      alasan_cocok: entri.verdict.alasan,
      duplikat_ids: entri.duplikat,
      delta_persen: delta,
    };
  });

  const totalSebidang = items.filter((i) => i.cakupan === "SAMA").length;

  return {
    ok: true,
    items,
    total: items.length,
    total_lain: items.length - 1,
    total_sebidang: totalSebidang,
    total_lot_terkait: items.length - totalSebidang,
    match: bisaCocok
      ? {
          legalitas: acuan.legalitas,
          nomor_legalitas: acuan.nomor_legalitas,
          nomor_normal: nomorSet,
          kelurahan: acuan.kelurahan,
          kecamatan: acuan.kecamatan,
          kota: acuan.kota,
          wilayah_level: normWilayah(acuan.kelurahan)
            ? "kelurahan"
            : normWilayah(acuan.kecamatan)
            ? "kecamatan"
            : "kota",
        }
      : null,
    alasan_tanpa_riwayat:
      items.length > 1
        ? null
        : bisaCocok
        ? "TIDAK_ADA_KECOCOKAN"
        : "TANPA_SERTIFIKAT",
  };
}

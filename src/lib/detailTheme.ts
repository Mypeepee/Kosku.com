/**
 * Sistem warna & permukaan halaman DETAIL ASET — dipakai bersama oleh
 * /Sewa, /Jual, dan /Lelang. SATU-SATUNYA tempat warnanya ditentukan.
 *
 * Dulu file ini hanya milik halaman sewa (sewaTheme.ts). Dinaikkan ke sini
 * karena masalah yang diperbaikinya sama persis di tiga halaman: aksen yang
 * dipakai untuk segalanya (emerald di Jual/Lelang, mint di Sewa) tidak
 * menandai apa pun, dan permukaan abu netral di atas latar navy terbaca
 * seperti tempelan yang belum diselesaikan. Halaman Jual & Lelang bahkan masih
 * memakai `slate-800/40 → slate-900/40` sebagai latar SETIAP kartu, sehingga
 * seluruh halaman jadi satu bidang abu tanpa hierarki.
 *
 * Tiga aturan yang menggantikannya:
 *
 * 1. MINT HANYA UNTUK UANG & AKSI. Harga, total, simulasi KPR, tombol utama.
 *    Begitu mint dipakai untuk hiasan, harga kehilangan penanda satu-satunya.
 *
 * 2. SETIAP HUE PUNYA SATU ARTI, dan artinya berlaku di seluruh halaman:
 *      sky    → tempat & fakta (lokasi, peta, identitas unit, transport)
 *      violet → orang & ruang (tipe kamar, kapasitas, agent, kampus)
 *      cyan   → fasilitas, utilitas & layanan
 *      amber  → aturan, biaya tambahan, jadwal lelang, stok menipis
 *      rose   → tidak tersedia & larangan
 *      emerald→ ketersediaan positif & legalitas terverifikasi
 *    Empat aksen + mint + tiga warna status. Lebih dari itu jadi norak; kurang
 *    dari itu balik jadi monoton.
 *
 * 3. GENDER KOS MEMAKAI WARNA YANG SAMA DENGAN CARD DI HALAMAN /Sewa
 *    (biru/pink/ungu, lihat src/components/kos/kosCardStyle.ts). Pengunjung
 *    baru saja mengklik pill berwarna itu; kalau di halaman detail berubah jadi
 *    hijau, penanda yang sudah dia pelajari hilang.
 *
 * Permukaannya diberi rona dingin (bukan abu netral) supaya menyatu dengan latar
 * halaman #000510 yang memang kebiruan — abu netral R=G=B di atas latar navy
 * terlihat seperti tempelan yang belum diselesaikan.
 *
 * CATATAN TEKNIS — jangan menyusun nama class dari potongan string
 * (`text-${hue}-300`). Tailwind mencari class dengan memindai teks file, jadi
 * class hasil rakitan runtime tidak pernah digenerate: elemennya tampil tanpa
 * warna, tanpa error apa pun. Karena itu semua di bawah ditulis sebagai literal
 * utuh, sama seperti alasan kosCardStyle.ts dibuat.
 *
 * Opacity slash hanya boleh kelipatan 5 (`/20`, `/25`); nilai lain WAJIB bentuk
 * arbitrary (`/[0.07]`) — `border-white/8` tidak menghasilkan CSS sama sekali.
 */

// ─────────────────────────────────────────────────────────────────────────────
// PERMUKAAN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tangga kedalaman, urut dari paling gelap ke paling terang. Urutannya WAJIB
 * monoton: makin dekat ke mata, makin terang.
 *
 * Dua hal yang membuat susunan lama terbaca datar. Pertama, jarak kanvas→kartu
 * (#0F0F0F → #131313) hanya 1,7‰ luminance — ada, tapi di bawah batas yang bisa
 * dilihat mata, jadi tepi kartu adalah satu-satunya petunjuk bahwa itu kartu.
 * Sekarang 3,8‰. Kedua, panel harga (#0C0C0C) justru LEBIH GELAP daripada
 * kanvasnya, sehingga elemen terpenting di halaman terbaca sebagai lubang, bukan
 * sebagai panel yang mengapung.
 *
 * Semuanya berona navy (hue ±220°), bukan abu netral: rona dingin menahan
 * kesan "wireframe belum jadi" yang muncul kalau R=G=B, dan menyatu dengan
 * #000510 yang dipakai section global.
 */
export const SURFACE = {
  /** Kanvas halaman (<main>). Paling gelap — semua hal lain naik di atasnya. */
  canvas: "#070A11",
  /** Panel harga & bottom sheet. */
  panel: "#0C1017",
  /** Kartu di atas kanvas. */
  card: "#0F141C",
  /** Isi modal — mengapung di atas overlay gelap. */
  modal: "#121824",
  /** Kontrol di DALAM kartu: input, dropdown, sel tanggal. Paling terang. */
  raised: "#161D28",
} as const;

/** Garis & pemisah. Dipakai lewat class, bukan style. */
export const LINE = {
  /** Tepi kartu. */
  card: "border-white/[0.07]",
  /** Tepi kartu saat hover — naik jelas, bukan 1% samar. */
  cardHover: "hover:border-white/[0.16]",
  /** Pemisah antar baris di dalam kartu. */
  row: "border-white/[0.06]",
  /** Pembatas antar section. */
  section: "border-white/[0.07]",
} as const;

/**
 * Sorotan tipis di tepi atas kartu — cahaya seolah datang dari atas.
 * Satu detail kecil yang membedakan "kotak abu" dengan permukaan yang terasa
 * punya bahan; dipasang lewat `style` karena butuh inset shadow berlapis.
 */
export const KILAU_KARTU =
  "inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.4)";

/** Kilau + angkat untuk panel harga yang mengapung. */
export const KILAU_PANEL =
  "inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(255,255,255,0.06), 0 32px 80px rgba(0,0,0,0.7)";

// ─────────────────────────────────────────────────────────────────────────────
// AKSEN
// ─────────────────────────────────────────────────────────────────────────────

export type AksenKey =
  | "mint"
  | "sky"
  | "violet"
  | "cyan"
  | "amber"
  | "rose"
  | "emerald"
  | "pink"
  | "netral";

export interface Aksen {
  /** Warna ikon lepas (tanpa kotak). */
  ikon: string;
  /** Kotak ikon judul section: border + latar + warna ikon. */
  kotak: string;
  /** Pill/chip berteks: border + latar + warna teks. */
  chip: string;
  /** Warna teks & tautan. */
  teks: string;
  /** Latar sangat tipis untuk kartu bernuansa (mis. blok biaya tambahan). */
  wash: string;
}

/**
 * Tingkat yang dipakai konsisten: teks/ikon di 300 (cukup terang untuk kontras
 * di latar gelap tanpa jadi neon — masalah klasik warna jenuh di dark mode),
 * tepi di 400/20, latar di 400/[0.07].
 */
export const AKSEN: Record<AksenKey, Aksen> = {
  // Uang & aksi. Satu-satunya hijau muda di halaman ini.
  mint: {
    ikon: "text-[#86efac]",
    kotak: "border-[#86efac]/20 bg-[#86efac]/[0.07] text-[#86efac]",
    chip: "border-[#86efac]/25 bg-[#86efac]/[0.08] text-[#86efac]",
    teks: "text-[#86efac]",
    wash: "bg-[#86efac]/[0.04]",
  },
  // Tempat & fakta.
  sky: {
    ikon: "text-sky-300",
    kotak: "border-sky-400/20 bg-sky-400/[0.07] text-sky-300",
    chip: "border-sky-400/25 bg-sky-400/[0.08] text-sky-200",
    teks: "text-sky-300",
    wash: "bg-sky-400/[0.04]",
  },
  // Orang & ruang.
  violet: {
    ikon: "text-violet-300",
    kotak: "border-violet-400/20 bg-violet-400/[0.07] text-violet-300",
    chip: "border-violet-400/25 bg-violet-400/[0.08] text-violet-200",
    teks: "text-violet-300",
    wash: "bg-violet-400/[0.04]",
  },
  // Fasilitas, utilitas & layanan.
  cyan: {
    ikon: "text-cyan-300",
    kotak: "border-cyan-400/20 bg-cyan-400/[0.07] text-cyan-300",
    chip: "border-cyan-400/25 bg-cyan-400/[0.08] text-cyan-200",
    teks: "text-cyan-300",
    wash: "bg-cyan-400/[0.04]",
  },
  // Aturan, biaya tambahan, jadwal lelang, stok menipis.
  amber: {
    ikon: "text-amber-300",
    kotak: "border-amber-400/20 bg-amber-400/[0.07] text-amber-300",
    chip: "border-amber-400/25 bg-amber-400/[0.08] text-amber-200",
    teks: "text-amber-300",
    wash: "bg-amber-400/[0.04]",
  },
  // Tidak tersedia & larangan.
  rose: {
    ikon: "text-rose-300",
    kotak: "border-rose-400/20 bg-rose-400/[0.07] text-rose-300",
    chip: "border-rose-400/25 bg-rose-400/[0.08] text-rose-200",
    teks: "text-rose-300",
    wash: "bg-rose-400/[0.04]",
  },
  // Ketersediaan positif & legalitas terverifikasi.
  emerald: {
    ikon: "text-emerald-300",
    kotak: "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300",
    chip: "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-200",
    teks: "text-emerald-300",
    wash: "bg-emerald-400/[0.04]",
  },
  // Hanya untuk kos putri — melanjutkan kode warna card listing.
  pink: {
    ikon: "text-pink-300",
    kotak: "border-pink-400/20 bg-pink-400/[0.07] text-pink-300",
    chip: "border-pink-400/25 bg-pink-400/[0.08] text-pink-200",
    teks: "text-pink-300",
    wash: "bg-pink-400/[0.04]",
  },
  // Untuk hal yang memang tidak perlu ditandai (prosa, meta).
  netral: {
    ikon: "text-white/45",
    kotak: "border-white/10 bg-white/[0.04] text-white/60",
    chip: "border-white/10 bg-white/[0.04] text-white/70",
    teks: "text-white/70",
    wash: "bg-white/[0.02]",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PEMETAAN ARTI → AKSEN
// ─────────────────────────────────────────────────────────────────────────────

/** Aksen per section halaman SEWA, urut seperti di halaman. */
export const AKSEN_SECTION = {
  ringkasan: AKSEN.sky,
  deskripsi: AKSEN.netral,
  tipeKamar: AKSEN.violet,
  fasilitas: AKSEN.cyan,
  ketentuan: AKSEN.amber,
  lokasi: AKSEN.sky,
  agent: AKSEN.violet,
} as const;

/**
 * Aksen per section halaman JUAL & LELANG.
 *
 * Sengaja memakai hue yang sama untuk arti yang sama seperti di /Sewa: ikon
 * biru selalu berarti "tempat & fakta", cyan selalu "yang terpasang di
 * bangunan", mint selalu "uang". Pengunjung yang membandingkan satu rumah
 * dijual dengan satu kos tidak perlu mempelajari dua kode warna.
 */
export const AKSEN_SECTION_ASET = {
  ringkasan: AKSEN.sky,
  deskripsi: AKSEN.netral,
  spesifikasi: AKSEN.violet,
  utilitas: AKSEN.cyan,
  legal: AKSEN.emerald,
  jadwal: AKSEN.amber,
  lokasi: AKSEN.sky,
  simulasi: AKSEN.mint,
  riwayat: AKSEN.amber,
  agent: AKSEN.violet,
  internal: AKSEN.amber,
} as const;

/**
 * Gender kos — biru/pink/ungu, melanjutkan kode warna pill card di /Sewa.
 *
 * PUTRA memakai `sky`, bukan `blue-500` seperti di kosCardStyle.ts. Bedanya
 * disengaja: halaman ini sudah memakai sky sebagai hue "tempat & fakta" (peta,
 * tanggal, identitas unit), dan menaruh blue-500 di sebelahnya menghasilkan dua
 * biru berbeda arti yang sulit dibedakan — cacat yang lebih mahal daripada
 * pergeseran satu langkah hue. Keduanya tetap terbaca "biru = putra", yang itulah
 * ingatan yang perlu dijaga dari card ke halaman detail.
 */
export const AKSEN_GENDER: Record<string, Aksen> = {
  PUTRA: AKSEN.sky,
  PUTRI: AKSEN.pink,
  CAMPUR: AKSEN.violet,
};

/**
 * Patokan lokasi. Dipetakan ke empat aksen yang sudah ada, bukan satu warna per
 * tipe: dua belas hue di satu daftar membuat bagian ini jadi pelangi dan
 * mengalahkan harga sebagai pusat perhatian.
 */
export const AKSEN_AKSES: Record<string, Aksen> = {
  KAMPUS: AKSEN.violet,
  SEKOLAH: AKSEN.violet,
  STASIUN: AKSEN.sky,
  HALTE: AKSEN.sky,
  BANDARA: AKSEN.sky,
  TOL: AKSEN.sky,
  MALL: AKSEN.amber,
  PASAR: AKSEN.amber,
  MINIMARKET: AKSEN.amber,
  RUMAH_SAKIT: AKSEN.rose,
  PERKANTORAN: AKSEN.cyan,
  MASJID: AKSEN.emerald,
  LAINNYA: AKSEN.netral,
};

export const aksenAkses = (tipe?: string | null): Aksen =>
  (tipe && AKSEN_AKSES[tipe]) || AKSEN.netral;

/** Ketersediaan kamar → emerald / amber / rose. Ambang 3 sama dengan card. */
export const aksenSisaKamar = (sisa: number | null | undefined): Aksen => {
  if (sisa == null) return AKSEN.netral;
  if (sisa <= 0) return AKSEN.rose;
  return sisa <= 3 ? AKSEN.amber : AKSEN.emerald;
};

// ─────────────────────────────────────────────────────────────────────────────
// CAHAYA LATAR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dua sapuan radial samar di belakang isi halaman: sedikit sky di kiri atas,
 * mint di kanan (arah panel harga). Alpha-nya sengaja sangat rendah — tugasnya
 * membuat latar tidak terbaca sebagai satu lembar hitam mati, bukan terlihat
 * sebagai gradasi.
 */
export const CAHAYA_HALAMAN =
  "radial-gradient(760px 420px at 12% 0%, rgba(56,189,248,0.055), transparent 70%)," +
  "radial-gradient(680px 380px at 92% 6%, rgba(134,239,172,0.045), transparent 70%)";

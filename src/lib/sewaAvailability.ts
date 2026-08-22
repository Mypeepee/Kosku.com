/**
 * Mesin ketersediaan sewa — satu-satunya tempat yang tahu cara mengubah daftar
 * blok (`listing_ketersediaan`) menjadi jawaban "berapa kamar sisa".
 *
 * Dipakai TIGA tempat yang wajib sepakat sampai angka terakhir:
 *   1. API tulis — memvalidasi blok baru tidak melewati kapasitas,
 *   2. panel booking penyewa — mencoret tanggal & menampilkan "sisa N kamar",
 *   3. drawer Kelola Ketersediaan milik pengelola.
 * Kalau ketiganya menghitung sendiri-sendiri, pengelola akan melihat "sisa 2"
 * sementara penyewa melihat "penuh" — dan tidak ada yang tahu mana yang benar.
 *
 * Berkas ini sengaja bebas dari `prisma`, `next/server`, dan session: murni
 * fungsi tanpa efek samping supaya aman ikut ke bundel browser. Disiplin yang
 * sama dengan @/lib/listingStatusPermission.
 *
 * ── DUA KEPUTUSAN YANG MENYETIR SELURUH BERKAS ────────────────────────────
 *
 * 1. Tanggal diwakili STRING "YYYY-MM-DD", bukan `Date`.
 *    Perbandingan leksikografis string ISO otomatis sama dengan perbandingan
 *    kronologis ("2026-08-09" < "2026-08-12"), jadi seluruh logika di bawah
 *    memakai `<` dan `>=` biasa — tanpa satu pun aritmetika `Date`, tanpa jam,
 *    tanpa zona waktu, tanpa DST. Yang tersisa hanya satu titik rawan: cara
 *    MEMBUAT kunci itu (lihat #2).
 *
 * 2. Rentang selalu SETENGAH TERBUKA: [mulai, selesai).
 *    Hari `selesai` sudah kosong lagi. Ini konvensi yang sama dengan
 *    `useBooking` (12 Agu + 8 hari = 20 Agu, ditampilkan "8 hari"), dan ia
 *    yang membuat kamar bisa langsung disewakan pada hari penghuni sebelumnya
 *    keluar. Konversi ke rentang tertutup ("sampai 19 Agu") hanya boleh
 *    terjadi di lapisan tampilan, tidak pernah di data.
 */

import { kategoriDenganMode, punyaPanelPemesanan } from "./sewaKapabilitas";

// ─────────────────────────────────────────────────────────────────────────────
// KUNCI TANGGAL
// ─────────────────────────────────────────────────────────────────────────────

/** Tanggal kalender polos, "YYYY-MM-DD". Tanpa jam, tanpa zona waktu. */
export type KunciTanggal = string;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * `Date` yang dibangun di sisi UI → kunci.
 *
 * Dipakai untuk Date yang lahir dari `new Date(y, m, d)` atau `new Date()`,
 * yaitu semua yang datang dari Kalender.tsx dan dari jam pengguna. Memakai
 * getter LOKAL karena itulah tanggal yang dilihat pengguna di layarnya.
 *
 * JANGAN pernah menggantinya dengan `toISOString().slice(0, 10)`: tengah malam
 * WIB adalah 17:00 UTC HARI SEBELUMNYA, jadi setiap tanggal akan mundur satu
 * hari. Pola itu sudah tersebar di belasan berkas repo ini — di jalur
 * ketersediaan ia tidak boleh masuk.
 */
export function kunciDariKalender(d: Date): KunciTanggal {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * `Date` hasil baca kolom `@db.Date` Prisma → kunci.
 *
 * Postgres `date` tidak punya jam; Prisma mengembalikannya sebagai Date pada
 * tengah malam UTC. Getter yang benar untuk itu adalah getter UTC — dan HARUS
 * begitu, bukan kebetulan: dengan getter lokal, server yang berjalan di zona
 * waktu barat (mis. UTC−5) akan membaca '2026-09-01' sebagai 31 Agustus.
 *
 * Dua fungsi terpisah dengan nama yang tidak mungkin tertukar adalah seluruh
 * pertahanan modul ini terhadap kelas bug geser-satu-hari. Di luar keduanya,
 * tidak boleh ada kode yang merangkai "YYYY-MM-DD" sendiri.
 */
export function kunciDariDbDate(d: Date): KunciTanggal {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Kunci → `Date` lokal tengah malam, bentuk yang dimakan Kalender.tsx. */
export function dariKunci(k: KunciTanggal): Date {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Kunci hari ini menurut jam pemanggil. */
export function kunciHariIni(): KunciTanggal {
  return kunciDariKalender(new Date());
}

/** Geser kunci n hari (boleh negatif). Lewat `Date` supaya akhir bulan & tahun
 *  kabisat ditangani runtime, bukan oleh aritmetika buatan sendiri. */
export function tambahHari(k: KunciTanggal, n: number): KunciTanggal {
  const d = dariKunci(k);
  d.setDate(d.getDate() + n);
  return kunciDariKalender(d);
}

/** Selisih hari `b − a`. Dihitung dari UTC supaya pergantian DST — yang tidak
 *  ada di Indonesia tapi ada di mesin CI/pengembang — tidak pernah
 *  menghasilkan 23 atau 25 jam. */
export function selisihHariKunci(a: KunciTanggal, b: KunciTanggal): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(ms / 86_400_000);
}


// ─────────────────────────────────────────────────────────────────────────────
// CAKUPAN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kategori sewa yang punya kalender ketersediaan.
 *
 * TURUNAN, bukan daftar tersendiri: kalender berlaku persis untuk kategori
 * bermode BOOKING di @/lib/sewaKapabilitas. Kos, apartemen & villa disewa
 * berulang dengan tanggal masuk–keluar yang berganti sepanjang tahun; di
 * sanalah pertanyaan "kosong tanggal berapa?" muncul tiap minggu dan kalender
 * ini terbayar. Ruko, gudang, dan rumah sewa tahunan dinegosiasikan sekali lalu
 * diam — memberi mereka kalender berarti menambah satu tombol yang tidak pernah
 * ditekan, dan satu kotak yang harus dipahami agent sebelum menyadari ia tak
 * berlaku baginya.
 *
 * Dulu daftar ini ditulis tangan di sini. Masalahnya bukan panjangnya,
 * melainkan bahwa ia adalah jawaban KEDUA atas pertanyaan yang sama — begitu
 * satu kategori pindah mode, dua daftar harus diubah bersamaan dan tidak ada
 * yang mengingatkan kalau salah satunya terlewat.
 */
export const KATEGORI_BERKALENDER: readonly string[] =
  kategoriDenganMode("BOOKING");

export function punyaKalenderKetersediaan(
  kategori: string | null | undefined,
): boolean {
  return punyaPanelPemesanan(kategori);
}

// ─────────────────────────────────────────────────────────────────────────────
// BENTUK DATA
// ─────────────────────────────────────────────────────────────────────────────

export const ALASAN_BLOKIR = [
  "DISEWA",
  "RENOVASI",
  "DIPAKAI_SENDIRI",
  "TUTUP",
] as const;
export type AlasanBlokir = (typeof ALASAN_BLOKIR)[number];

export function isAlasanBlokir(v: unknown): v is AlasanBlokir {
  return (ALASAN_BLOKIR as readonly string[]).includes(String(v));
}

/** Label untuk pengelola. Tidak pernah tampil ke pengunjung publik. */
export const ALASAN_META: Record<
  AlasanBlokir,
  { label: string; ikon: string; keterangan: string }
> = {
  DISEWA: {
    label: "Disewa",
    ikon: "solar:user-check-rounded-bold-duotone",
    keterangan: "Sudah ada penghuni pada periode ini",
  },
  RENOVASI: {
    label: "Renovasi",
    ikon: "solar:hammer-bold-duotone",
    keterangan: "Sedang diperbaiki, belum bisa dihuni",
  },
  DIPAKAI_SENDIRI: {
    label: "Dipakai sendiri",
    ikon: "solar:home-smile-bold-duotone",
    keterangan: "Dipakai pemilik/keluarga",
  },
  TUTUP: {
    label: "Ditutup",
    ikon: "solar:lock-keyhole-bold-duotone",
    keterangan: "Ditutup sementara oleh pengelola",
  },
};

/**
 * Satu periode tidak tersedia. `idTipe` null berarti blok tingkat listing —
 * perhatikan aturan khususnya di `sisaPadaTanggal`.
 */
export interface BlokirView {
  id?: string;
  idTipe: string | null;
  mulai: KunciTanggal;
  /** null = terbuka, berlaku sampai dibuka lagi. */
  selesai: KunciTanggal | null;
  jumlahKamar: number;
  alasan?: AlasanBlokir;
  catatan?: string | null;
}

/**
 * Kapasitas satu "kantong" inventaris.
 *
 * `idTipe` null punya DUA arti yang dibedakan oleh ada/tidaknya tipe lain:
 *   • listing tanpa tipe kamar sama sekali → ini kantong satu-satunya
 *     (kos seragam, atau unit tunggal dengan totalKamar 1);
 *   • listing dengan tipe kamar → kantong null tidak pernah dipakai sebagai
 *     inventaris; blok ber-idTipe null pada listing seperti itu berarti
 *     "tutup seluruh gedung" (lihat `sisaPadaTanggal`).
 */
export interface InventarisView {
  idTipe: string | null;
  totalKamar: number;
}

const clamp = (n: number, min: number, maks: number) =>
  Math.min(Math.max(n, min), maks);

/** Blok berlaku pada tanggal `t`? Setengah terbuka: `selesai` sudah kosong. */
export function blokAktifPada(b: BlokirView, t: KunciTanggal): boolean {
  if (t < b.mulai) return false;
  if (b.selesai === null) return true; // terbuka — berlaku selamanya ke depan
  return t < b.selesai;
}


// ─────────────────────────────────────────────────────────────────────────────
// PERHITUNGAN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sisa kamar pada satu tanggal untuk satu kantong inventaris.
 *
 * Aturan blok tingkat listing (`idTipe === null`) pada listing YANG PUNYA tipe
 * kamar: ia berarti "seluruh gedung tutup", jadi sisanya 0 — bukan pengurangan
 * sebanyak `jumlahKamar`. Alasannya aritmetis, bukan selera: kalau gedung
 * 3-tipe diblokir 5 kamar di tingkat listing, tidak ada jawaban yang benar
 * untuk "5 kamar itu diambil dari tipe mana". Menutup semuanya adalah satu-
 * satunya tafsir yang tidak ambigu — dan memang itu yang dimaksud pengelola
 * saat menekan "Tandai penuh" di tingkat gedung.
 */
export function sisaPadaTanggal(
  inv: InventarisView,
  blok: BlokirView[],
  t: KunciTanggal,
): number {
  // Blok tingkat listing pada gedung bertipe = tutup seluruhnya.
  if (inv.idTipe !== null) {
    for (const b of blok) {
      if (b.idTipe === null && blokAktifPada(b, t)) return 0;
    }
  }
  return clamp(inv.totalKamar - terpakaiPada(inv, blok, t), 0, inv.totalKamar);
}

/**
 * Kamar terpakai pada `t` untuk satu kantong — TANPA clamp.
 *
 * Terpisah dari `sisaPadaTanggal` karena keduanya menjawab pertanyaan yang
 * berbeda. Tampilan harus menyembunyikan angka mustahil ("sisa −2 kamar" tidak
 * berarti apa-apa bagi penyewa), tapi validator justru HARUS melihatnya —
 * kalau ia memanggil versi yang sudah di-clamp, kapasitas yang sudah penuh
 * terbaca sebagai "pas", dan blok berikutnya lolos.
 */
function terpakaiPada(
  inv: InventarisView,
  blok: BlokirView[],
  t: KunciTanggal,
): number {
  let terpakai = 0;
  for (const b of blok) {
    if (b.idTipe !== inv.idTipe) continue;
    if (!blokAktifPada(b, t)) continue;
    terpakai += b.jumlahKamar;
  }
  return terpakai;
}

/**
 * Sisa TERKECIL sepanjang [mulai, selesai).
 *
 * Ini — bukan sisa di hari pertama — angka yang menentukan apakah satu masa
 * sewa utuh bisa dipesan. Kamar yang kosong hari ini tapi terisi minggu depan
 * tidak bisa disewa sebulan, dan menampilkan "sisa 3" untuk rentang itu adalah
 * janji yang akan dibantah agent di WhatsApp.
 *
 * Rentang kosong/terbalik jatuh ke sisa pada `mulai` — pemanggil di UI kadang
 * belum punya tanggal keluar.
 */
export function sisaMinimumRentang(
  inv: InventarisView,
  blok: BlokirView[],
  mulai: KunciTanggal,
  selesai: KunciTanggal | null,
): number {
  if (selesai === null || selesai <= mulai) {
    return sisaPadaTanggal(inv, blok, mulai);
  }

  let min = inv.totalKamar;
  for (let k = mulai; k < selesai; k = tambahHari(k, 1)) {
    min = Math.min(min, sisaPadaTanggal(inv, blok, k));
    if (min === 0) break; // tidak bisa lebih kecil lagi
  }
  return min;
}


/**
 * Kapasitas terpakai pada [mulai, selesai) di luar satu blok tertentu.
 *
 * Dipakai API tulis untuk menjawab "kalau blok ini disimpan, apakah kapasitas
 * terlampaui?". `abaikanId` ada supaya PATCH tidak menghitung blok yang sedang
 * disunting sebagai saingan dirinya sendiri — tanpa itu, memperkecil sebuah
 * blok pun akan ditolak.
 */
export function puncakTerpakai(
  inv: InventarisView,
  blok: BlokirView[],
  mulai: KunciTanggal,
  selesai: KunciTanggal | null,
  horizon: KunciTanggal,
  abaikanId?: string | null,
): number {
  const relevan = abaikanId ? blok.filter((b) => b.id !== abaikanId) : blok;

  // Blok terbuka diperiksa sampai batas horizon. Aman: di luar horizon tidak
  // ada blok yang bisa MULAI (API menolaknya), jadi puncak sudah pasti
  // tercapai di dalamnya. Batas atas minimal satu hari supaya blok yang mulai
  // tepat di ujung horizon tetap diperiksa sekali.
  const akhir = selesai ?? (horizon > mulai ? horizon : tambahHari(mulai, 1));
  let puncak = 0;
  for (let k = mulai; k < akhir; k = tambahHari(k, 1)) {
    puncak = Math.max(puncak, terpakaiPada(inv, relevan, k));
  }
  return puncak;
}

// ─────────────────────────────────────────────────────────────────────────────
// HORIZON
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Berapa jauh ke depan ketersediaan dihitung & dikirim ke browser.
 *
 * 12 bulan menyamai `maksBulanKeDepan` bawaan Kalender.tsx. Menyamakan keduanya
 * penting: horizon data yang lebih pendek daripada horizon kalender akan
 * menampilkan bulan yang bisa dibuka tapi selalu terlihat kosong — pengguna
 * membacanya sebagai "semua tersedia", padahal artinya "tidak tahu".
 */
export const HORIZON_BULAN = 12;

/** Batas [dari, sampai) perhitungan ketersediaan, mulai hari ini. */
export function horizonKetersediaan(dari: KunciTanggal = kunciHariIni()): {
  dari: KunciTanggal;
  sampai: KunciTanggal;
} {
  const d = dariKunci(dari);
  d.setMonth(d.getMonth() + HORIZON_BULAN);
  return { dari, sampai: kunciDariKalender(d) };
}

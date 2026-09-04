/**
 * Sisi-server fitur Pembersihan Data: terjemahan aturan → `where` Prisma,
 * penjaga wewenang, dan penjaga keterkaitan.
 *
 * Katalog aturannya (label, penjelasan, kata kunci) ada di
 * @/lib/pembersihanListing — berkas itu ikut dimuat browser. Yang di sini
 * hanya bagian yang menyentuh database.
 */

import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import prisma, { petunjukClientBasi } from '@/lib/prisma';
import {
  KATA_BARANG_BERGERAK,
  KATA_PELINDUNG_PROPERTI,
  KATA_PROPERTI,
  type IdAturan,
  type KandidatListing,
} from '@/lib/pembersihanListing';
import {
  resolveStatusActor,
  type StatusActorLengkap,
} from '../../_lib/status-guard';

/* ────────────────────────────── Wewenang ─────────────────────────────── */

export type ResolvedOwner =
  | { ok: true; actor: StatusActorLengkap }
  | { ok: false; response: NextResponse };

/**
 * Hanya OWNER. Jabatannya dibaca ULANG dari tabel agent (lewat
 * resolveStatusActor), bukan dari session: JWT disegarkan tiap 5 menit, dan
 * "boleh menghapus 1.300 baris selama lima menit sesudah jabatannya dicabut"
 * bukan risiko yang layak diambil untuk aksi yang tidak bisa dibatalkan.
 *
 * STOKER sengaja TIDAK ikut walaupun ia berwenang atas seluruh aset LELANG:
 * wewenangnya di sana adalah mengubah STATUS, dan status bisa dikembalikan.
 * Ini menghapus baris.
 */
export async function pastikanOwner(): Promise<ResolvedOwner> {
  const resolved = await resolveStatusActor();
  if (!resolved.ok) return resolved;

  if (resolved.actor.jabatan !== 'OWNER') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Pembersihan data hanya untuk Owner.' },
        { status: 403 },
      ),
    };
  }
  return { ok: true, actor: resolved.actor };
}

/* ─────────────────────────── Aturan → where ──────────────────────────── */

const beradaDiJudul = (kata: readonly string[]): Prisma.ListingWhereInput[] =>
  kata.map((k) => ({ judul: { contains: k, mode: 'insensitive' } }));

/**
 * `where` untuk satu aturan. Aturannya sengaja TIDAK beririsan (aturan kedua
 * mensyaratkan `bukan_properti: false`) supaya jumlah di kartu bisa dijumlahkan
 * begitu saja tanpa menghitung baris yang sama dua kali.
 */
export function whereAturan(id: IdAturan): Prisma.ListingWhereInput {
  // Kolomnya diisi trigger `trg_listing_bukan_properti`; hakimnya luas, bukan
  // kata di judul. Lihat prisma/migration_listing_bukan_properti.sql.
  const menyebutProperti = { OR: beradaDiJudul(KATA_PROPERTI) };

  switch (id) {
    // Ditandai database, dan judulnya tidak menyebut properti dari sisi mana
    // pun → sampah tanpa keraguan, satu-satunya yang boleh dihapus massal.
    case 'BENDA_BERGERAK':
      return { bukan_properti: true, NOT: menyebutProperti };

    // Ditandai database TAPI judulnya menyebut properti. Belahan yang sama,
    // sisi sebaliknya — jadi keduanya tidak pernah beririsan dan jumlahnya
    // boleh dijumlahkan begitu saja.
    case 'PERLU_TINJAU':
      return { bukan_properti: true, ...menyebutProperti };

    case 'JUDUL_BARANG':
      return {
        bukan_properti: false,
        AND: [
          { OR: beradaDiJudul(KATA_BARANG_BERGERAK) },
          { NOT: { OR: beradaDiJudul(KATA_PELINDUNG_PROPERTI) } },
        ],
      };
  }
}

/**
 * Pencarian manual — jaring terakhir untuk sampah bentuk baru yang belum
 * punya aturan. Sengaja hanya judul + kota: pencarian yang lebih pintar dari
 * ini akan menggoda orang memakainya sebagai aturan, padahal justru di sinilah
 * setiap baris HARUS dilihat satu per satu sebelum dicentang.
 */
export function whereManual(q: string): Prisma.ListingWhereInput {
  const teks = q.trim();
  return {
    OR: [
      { judul: { contains: teks, mode: 'insensitive' } },
      { kota: { contains: teks, mode: 'insensitive' } },
    ],
  };
}

/* ──────────────────────── Penjaga keterkaitan ────────────────────────── */

/**
 * Relasi yang MENGUNCI sebuah listing dari penghapusan.
 *
 * Dua alasan berbeda, sama-sama cukup:
 *   • project / project_selesai / mou / pilihan_pemilu — foreign key-nya
 *     RESTRICT, DELETE-nya akan gagal dan menggagalkan seluruh batch;
 *   • leads / klien / tugas / acara / booking_survei — foreign key-nya CASCADE
 *     atau SET NULL, jadi DELETE-nya justru BERHASIL dan diam-diam ikut
 *     membawa riwayat CRM yang nyata. Ini yang berbahaya, dan ini alasan
 *     pemeriksaannya dilakukan di aplikasi, bukan diserahkan ke database.
 *
 * Sebuah listing yang punya lead atau masuk project jelas bukan sampah
 * scraping, apa pun kata aturannya. Barisnya dilewati dan dilaporkan, bukan
 * dihapus.
 */
export const RELASI_PENGUNCI = {
  project: 'dipakai di project',
  projectSelesai: 'dipakai di project selesai',
  mou: 'punya MoU',
  pilihanPemilu: 'dipakai di pemilu listing',
  acara: 'punya jadwal acara',
  leads: 'punya lead',
  klien: 'jadi properti asal klien',
  tugas: 'punya tugas',
  bookingSurvei: 'punya booking survei',
} as const;

type NamaRelasi = keyof typeof RELASI_PENGUNCI;

/** Kolom + hitungan relasi yang dibutuhkan daftar kandidat & jalur hapus. */
export const SELECT_KANDIDAT = {
  id_property: true,
  judul: true,
  kategori: true,
  jenis_transaksi: true,
  kota: true,
  harga: true,
  luas_tanah: true,
  luas_bangunan: true,
  gambar: true,
  bukan_properti: true,
  status_tayang: true,
  id_agent: true,
  slug: true,
  // Ditulis satu per satu, bukan diturunkan dari RELASI_PENGUNCI lewat
  // Object.fromEntries: bentuk literal inilah yang membuat Prisma menyimpulkan
  // tipe `_count` dengan benar, dan salah satu nama relasi yang salah ketik
  // ketahuan saat kompilasi, bukan saat menghapus 1.300 baris.
  _count: {
    select: {
      project: true,
      projectSelesai: true,
      mou: true,
      pilihanPemilu: true,
      acara: true,
      leads: true,
      klien: true,
      tugas: true,
      bookingSurvei: true,
    },
  },
} satisfies Prisma.ListingSelect;

export type BarisKandidat = Prisma.ListingGetPayload<{
  select: typeof SELECT_KANDIDAT;
}>;

/** Alasan baris ini tidak boleh dihapus; null = aman. */
export function alasanTerkunci(row: BarisKandidat): string | null {
  const kena = (Object.keys(RELASI_PENGUNCI) as NamaRelasi[]).filter(
    (k) => (row._count as Record<NamaRelasi, number>)[k] > 0,
  );
  if (kena.length === 0) return null;
  return kena.map((k) => RELASI_PENGUNCI[k]).join(', ');
}

/**
 * Peringatan lunak — tidak mengunci, hanya membuat baris yang layak dicurigai
 * terlihat sebelum dicentang. Terutama untuk pencarian manual, tempat Owner
 * bisa saja mengetik kata yang juga cocok dengan properti asli.
 */
function catatanKandidat(row: BarisKandidat): string | null {
  const lt = Number(row.luas_tanah ?? 0);
  const lb = Number(row.luas_bangunan ?? 0);
  if (lt > 0 || lb > 0) {
    const bagian = [
      lt > 0 ? `luas tanah ${lt} m²` : null,
      lb > 0 ? `luas bangunan ${lb} m²` : null,
    ].filter(Boolean);
    return `Punya ${bagian.join(' & ')} — periksa dulu, bisa jadi properti asli.`;
  }
  if (!row.bukan_properti) return 'Tidak ditandai bukan-properti oleh database.';
  // Judul yang menyebut properti pada baris tanpa luas: bisa saja properti
  // asli yang luasnya tidak terbawa scraper. Ditandai di sini juga (bukan
  // cuma lewat keranjang PERLU_TINJAU) supaya peringatannya ikut muncul di
  // hasil pencarian manual.
  const judul = row.judul.toLowerCase();
  if (KATA_PROPERTI.some((k) => judul.includes(k))) {
    return 'Judulnya menyebut properti — periksa dulu, luasnya mungkin hanya tidak terbawa scraper.';
  }
  return null;
}

export function keKandidat(row: BarisKandidat): KandidatListing {
  return {
    id: row.id_property.toString(),
    judul: row.judul,
    kategori: String(row.kategori),
    jenisTransaksi: String(row.jenis_transaksi),
    kota: row.kota ?? null,
    harga: row.harga != null ? row.harga.toString() : null,
    luasTanah: row.luas_tanah != null ? Number(row.luas_tanah) : null,
    luasBangunan: row.luas_bangunan != null ? Number(row.luas_bangunan) : null,
    gambar: row.gambar ?? null,
    terkunci: alasanTerkunci(row),
    catatan: catatanKandidat(row),
  };
}

/* ───────────────────────────── Kesehatan ─────────────────────────────── */

/**
 * Apakah kolom `listing.bukan_properti` ada di database INI?
 *
 * Migrasi di proyek ini dijalankan manual per environment, jadi kemungkinan
 * paling nyata di server produksi bukan "fiturnya bug" melainkan "SQL-nya
 * belum dijalankan". Tanpa pemeriksaan ini gejalanya adalah dialog yang
 * melempar error Prisma mentah, dan tidak ada yang tahu perintah apa yang
 * harus dijalankan.
 */
const cacheSehat = new Map<string, { ada: boolean; sampai: number }>();

/**
 * Bungkus satu pemeriksaan kesehatan berikut cache-nya.
 *
 * Sehat 30 menit; rusak 1 menit, supaya begitu migrasinya dijalankan fiturnya
 * langsung hidup tanpa restart proses.
 */
async function periksaSekali(
  kunci: string,
  tanya: () => Promise<boolean>,
): Promise<boolean> {
  const tersimpan = cacheSehat.get(kunci);
  if (tersimpan && tersimpan.sampai > Date.now()) return tersimpan.ada;

  let ada = false;
  try {
    ada = await tanya();
  } catch {
    // Pemeriksaan kesehatan yang gagal tidak boleh mematikan halamannya —
    // anggap ada, biarkan query aslinya yang bicara kalau memang tidak.
    ada = true;
  }

  cacheSehat.set(kunci, { ada, sampai: Date.now() + (ada ? 30 * 60_000 : 60_000) });
  return ada;
}

export function kolomBukanPropertiAda(): Promise<boolean> {
  return periksaSekali('kolom_bukan_properti', async () => {
    const baris = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n
        FROM information_schema.columns
       WHERE table_name = 'listing' AND column_name = 'bukan_properti'`;
    return Number(baris?.[0]?.n ?? 0) > 0;
  });
}

/**
 * Apakah tabel arsip `listing_dibersihkan` ada di database INI?
 *
 * Pemeriksaan terpisah dari kolom `bukan_properti` karena keduanya datang dari
 * migrasi yang berbeda, dan kekurangannya berakibat berbeda pula: tanpa kolom,
 * TIDAK ADA yang bisa dihitung; tanpa tabel arsip, menghitung dan MENARIK
 * masih jalan sempurna — yang mustahil hanya HAPUS.
 *
 * Ini bukan kemungkinan teoretis. INSERT ke tabel arsip ditulis sebagai query
 * MENTAH (supaya `to_jsonb(l)` menyalin seluruh kolom apa adanya), dan Prisma
 * membungkus kegagalan query mentah sebagai P2010 — bukan P2021 "tabel tidak
 * ada" yang punya kalimat penjelasnya sendiri. Jadi di database yang belum
 * dimigrasikan, gejalanya adalah tombol Hapus yang gagal terus dengan kalimat
 * umum "Gagal menjalankan pembersihan data", tanpa satu pun petunjuk bahwa
 * yang kurang hanyalah satu berkas SQL yang belum dijalankan.
 */
export function tabelArsipAda(): Promise<boolean> {
  return periksaSekali('tabel_listing_dibersihkan', async () => {
    const baris = await prisma.$queryRaw<{ ada: boolean }[]>`
      SELECT to_regclass('public.listing_dibersihkan') IS NOT NULL AS ada`;
    return baris?.[0]?.ada === true;
  });
}

export const PESAN_MIGRASI_KURANG =
  'Kolom listing.bukan_properti belum ada di database ini. Jalankan dulu: ' +
  'npx prisma db execute --file prisma/migration_listing_bukan_properti.sql ' +
  '--schema prisma/schema.prisma';

export const PESAN_ARSIP_KURANG =
  'Tabel arsip listing_dibersihkan belum ada di database ini, jadi penghapusan ' +
  'permanen dimatikan — tanpa arsipnya, DELETE tidak punya jalan pulang. ' +
  'Jalankan dulu: npx prisma db execute --file ' +
  'prisma/migration_listing_pembersihan.sql --schema prisma/schema.prisma ' +
  '(aksi "Tarik dari tayang" tetap bisa dipakai sekarang).';

/** Kode SQLSTATE Postgres yang tersembunyi di dalam pesan galat query mentah. */
const sqlstate = (pesan: string, kode: string) =>
  pesan.includes(`Code: \`${kode}\``);

export function pesanErrorPembersihan(error: unknown): string {
  const kode = (error as { code?: string })?.code;
  const asli = String((error as { message?: string })?.message ?? '');

  // P2010 = query MENTAH yang gagal, dan kode sebenarnya ada di dalam teks
  // pesannya, bukan di `error.code`. Cabang ini penting justru karena satu-
  // satunya query mentah di fitur ini adalah INSERT ke tabel arsip: di
  // database yang belum dimigrasikan, tanpa cabang ini gejalanya adalah
  // "Gagal menjalankan pembersihan data" yang berulang tanpa menyebut satu
  // pun berkas SQL yang harus dijalankan.
  if (kode === 'P2010') {
    if (sqlstate(asli, '42P01')) return PESAN_ARSIP_KURANG; // tabel tak ada
    if (sqlstate(asli, '42703')) return PESAN_MIGRASI_KURANG; // kolom tak ada
  }

  if (kode === 'P2021' || kode === 'P2022') {
    return (
      'Tabel/kolom yang dibutuhkan belum ada di database ini. Jalankan ' +
      'prisma/migration_listing_bukan_properti.sql dan ' +
      'prisma/migration_listing_pembersihan.sql lebih dulu.'
    );
  }
  if (kode === 'P2003') {
    return (
      'Ada listing yang masih dipakai tabel lain (project/MoU), jadi tidak ' +
      'bisa dihapus. Coba lagi — baris seperti itu akan dilewati.'
    );
  }
  // Kehabisan koneksi / transaksi kelewat lama. Aman diulang: kerjanya
  // bertahap dan tiap potongan punya transaksinya sendiri, jadi yang sudah
  // terhapus tetap terhapus beserta arsipnya.
  if (kode === 'P2024' || kode === 'P2028') {
    return (
      'Database terlalu lama merespons dan potongan ini dibatalkan utuh. ' +
      'Coba jalankan lagi — yang sudah selesai tidak diulang.'
    );
  }

  // Client Prisma yang lebih tua dari proses yang sedang berjalan melempar
  // galat biasa tanpa `code`; kalimatnya sudah disiapkan di lib/prisma.
  const basi = petunjukClientBasi();
  if (basi && !kode) return basi;

  // Kodenya ikut disebut. Sebaris "(P2010)" di layar Owner adalah selisih
  // antara galat yang bisa dicari penyebabnya dan galat yang hanya bisa
  // dicoba ulang — dan ini satu-satunya layar tempat galatnya muncul.
  return (
    `Gagal menjalankan pembersihan data${kode ? ` (${kode})` : ''}. ` +
    'Galat lengkapnya ada di log server.'
  );
}

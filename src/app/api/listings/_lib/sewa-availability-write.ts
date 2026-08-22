/**
 * Lapisan tulis ketersediaan sewa — semua yang menyentuh `listing_ketersediaan`
 * dan kolom turunannya lewat sini.
 *
 * Dipisah dari route handler karena dua pemanggil yang sangat berbeda memakai
 * isi yang sama: route `ketersediaan` (aksi pengelola) dan cron harian (tanpa
 * pengguna sama sekali). Kalau keduanya menghitung ulang `kamar_tersedia`
 * dengan kodenya masing-masing, angka di card dan angka di panel akan berpisah
 * jalan tepat pada hari sebuah blok mulai berlaku — kasus yang paling jarang
 * diuji dan paling sering dilaporkan sebagai "kadang salah".
 *
 * Aturan perhitungannya sendiri TIDAK ada di sini; semuanya di
 * @/lib/sewaAvailability, yang murni dan ikut dipakai browser.
 */

import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  horizonKetersediaan,
  kunciDariDbDate,
  kunciHariIni,
  puncakTerpakai,
  sisaPadaTanggal,
  type BlokirView,
  type InventarisView,
  type KunciTanggal,
} from '@/lib/sewaAvailability';
import { kapabilitasSewa } from '@/lib/sewaKapabilitas';

/** Prisma client biasa maupun client di dalam `$transaction`. */
type DB = Prisma.TransactionClient | typeof prisma;

/**
 * Bentuk inventaris sebuah listing sewa.
 *   • KAMAR → kos: banyak kamar, boleh berkelompok per tipe.
 *   • UNIT  → apartemen/rumah/ruko: satu unit, kapasitas selalu 1.
 * Bukan dua sistem — UNIT hanyalah KAMAR dengan totalKamar 1 dan tanpa tipe.
 */
export type ModelInventaris = 'KAMAR' | 'UNIT';

export interface KonteksKetersediaan {
  idProperty: bigint;
  idAgent: string;
  slug: string | null;
  jenisTransaksi: string;
  kategori: string;
  modelInventaris: ModelInventaris;
  /** Kantong kapasitas. Untuk UNIT selalu tepat satu, idTipe null. */
  inventaris: InventarisView[];
  blok: (BlokirView & { id: string })[];
}

/**
 * TURUNAN dari tabel kapabilitas — bukan aturan tersendiri. Kategori yang boleh
 * dipecah per tipe kamar adalah kategori yang inventarisnya berbentuk KAMAR;
 * menulis dua aturan untuk satu fakta itulah yang dulu membuat "kos" muncul di
 * satu berkas sebagai `=== 'KOS'` dan di berkas lain sebagai daftar kategori.
 */
export function modelInventarisDari(kategori: string): ModelInventaris {
  return kapabilitasSewa(kategori).inventaris;
}

const KETERSEDIAAN_SELECT = {
  id: true,
  id_tipe: true,
  tanggal_mulai: true,
  tanggal_selesai: true,
  jumlah_kamar: true,
  alasan: true,
  catatan: true,
} as const;

/**
 * Muat semua yang dibutuhkan untuk memutuskan & menghitung, dalam satu query.
 *
 * Seluruh blok listing diambil, bukan hanya yang di dalam horizon: jumlahnya
 * puluhan, sementara memfilter di SQL berarti blok yang MULAI di luar horizon
 * tapi masih aktif hari ini ikut hilang — dan justru blok terbuka semacam itu
 * yang menentukan angka "sisa hari ini".
 */
export async function muatKonteksKetersediaan(
  db: DB,
  idProperty: bigint,
): Promise<KonteksKetersediaan | null> {
  const listing = await db.listing.findUnique({
    where: { id_property: idProperty },
    select: {
      id_property: true,
      id_agent: true,
      slug: true,
      jenis_transaksi: true,
      kategori: true,
      sewaDetail: { select: { total_kamar: true } },
      kamarTipe: {
        select: { id: true, jumlah_kamar: true },
        orderBy: [{ urutan: 'asc' }, { id: 'asc' }],
      },
      ketersediaan: { select: KETERSEDIAAN_SELECT },
    },
  });

  if (!listing) return null;

  const modelInventaris = modelInventarisDari(listing.kategori);

  let inventaris: InventarisView[];
  if (modelInventaris === 'UNIT') {
    // Apartemen/rumah disewakan utuh. Kapasitasnya bukan `total_kamar` (yang
    // untuk listing ini menghitung kamar tidur, bukan unit yang bisa disewa
    // terpisah) melainkan selalu 1.
    inventaris = [{ idTipe: null, totalKamar: 1 }];
  } else if (listing.kamarTipe.length > 0) {
    inventaris = listing.kamarTipe.map((t) => ({
      idTipe: String(t.id),
      totalKamar: t.jumlah_kamar ?? 0,
    }));
  } else {
    // Kapasitas belum diisi → TIDAK ada kantong. Menebaknya (1 atau 0) berarti
    // memutuskan diam-diam apakah kos itu kosong atau penuh; daftar kosong
    // membuat keadaan "belum diketahui" terbawa apa adanya sampai ke validasi,
    // yang lalu bisa memberi pesan jujur alih-alih menolak dengan angka karangan.
    const total = listing.sewaDetail?.total_kamar;
    inventaris = total == null ? [] : [{ idTipe: null, totalKamar: total }];
  }

  return {
    idProperty: listing.id_property,
    idAgent: listing.id_agent,
    slug: listing.slug,
    jenisTransaksi: listing.jenis_transaksi,
    kategori: listing.kategori,
    modelInventaris,
    inventaris,
    blok: listing.ketersediaan.map(toBlokirView),
  };
}

export function toBlokirView(row: {
  id: bigint;
  id_tipe: bigint | null;
  tanggal_mulai: Date;
  tanggal_selesai: Date | null;
  jumlah_kamar: number;
  alasan?: string;
  catatan?: string | null;
}): BlokirView & { id: string } {
  return {
    id: String(row.id),
    idTipe: row.id_tipe === null ? null : String(row.id_tipe),
    // kunciDariDbDate, BUKAN kunciDariKalender: kolomnya `@db.Date` dan Prisma
    // mengembalikannya pada tengah malam UTC.
    mulai: kunciDariDbDate(row.tanggal_mulai),
    selesai: row.tanggal_selesai ? kunciDariDbDate(row.tanggal_selesai) : null,
    jumlahKamar: row.jumlah_kamar,
    alasan: row.alasan as BlokirView['alasan'],
    catatan: row.catatan ?? null,
  };
}

/**
 * Kunci "YYYY-MM-DD" → `Date` yang benar untuk kolom `@db.Date`.
 *
 * Harus tengah malam UTC. `new Date("2026-09-01")` sudah menghasilkan itu
 * (string ISO tanggal-saja dibaca sebagai UTC oleh spesifikasi), sementara
 * `new Date(2026, 8, 1)` menghasilkan tengah malam LOKAL — yang di WIB
 * tersimpan sebagai 31 Agustus. Dibungkus fungsi supaya tidak ada yang
 * tergoda menulis varian kedua.
 */
export function kunciKeDbDate(k: KunciTanggal): Date {
  return new Date(`${k}T00:00:00.000Z`);
}

/** Kantong kapasitas untuk sebuah idTipe, atau null bila tipenya asing. */
export function inventarisUntuk(
  ctx: KonteksKetersediaan,
  idTipe: string | null,
): InventarisView | null {
  return ctx.inventaris.find((i) => i.idTipe === idTipe) ?? null;
}

/** Listing ini memakai tipe kamar? Menentukan arti blok ber-idTipe null. */
export function punyaTipeKamar(ctx: KonteksKetersediaan): boolean {
  return ctx.inventaris.some((i) => i.idTipe !== null);
}

export interface InputBlok {
  idTipe: string | null;
  mulai: KunciTanggal;
  selesai: KunciTanggal | null;
  jumlahKamar: number;
}

export type HasilValidasi =
  | { ok: true }
  | { ok: false; status: 400 | 403 | 409; pesan: string };

/**
 * Apakah blok ini boleh disimpan?
 *
 * Dipanggil DI DALAM transaksi yang sudah mengunci barisnya (lihat
 * `tulisBlokAman`), sesudah konteks dimuat ulang — kalau tidak, dua tab yang
 * sama-sama lolos pemeriksaan bisa sama-sama menulis dan bersama-sama
 * melewati kapasitas.
 */
export function validasiBlok(
  ctx: KonteksKetersediaan,
  input: InputBlok,
  abaikanId?: string | null,
): HasilValidasi {
  const { dari, sampai } = horizonKetersediaan();

  if (ctx.jenisTransaksi !== 'SEWA') {
    return {
      ok: false,
      status: 400,
      pesan: 'Ketersediaan harian hanya berlaku untuk listing sewa.',
    };
  }

  if (input.selesai !== null && input.selesai <= input.mulai) {
    return {
      ok: false,
      status: 400,
      pesan: 'Tanggal selesai harus setelah tanggal mulai.',
    };
  }

  // Blok yang seluruhnya di masa lalu tidak mengubah apa pun yang dilihat
  // penyewa, tapi tetap muncul di daftar pengelola sebagai baris yang
  // membingungkan. Blok yang MASIH berjalan (mulai kemarin, selesai besok)
  // tetap boleh — itu justru kasus paling umum saat penghuni sudah masuk.
  if (input.selesai !== null && input.selesai <= dari) {
    return {
      ok: false,
      status: 400,
      pesan: 'Periode ini sudah lewat, jadi tidak mempengaruhi ketersediaan.',
    };
  }

  if (input.mulai >= sampai) {
    return {
      ok: false,
      status: 400,
      pesan: `Tanggal mulai terlalu jauh — maksimal ${sampai}.`,
    };
  }

  const bertipe = punyaTipeKamar(ctx);

  if (ctx.modelInventaris === 'UNIT') {
    if (input.idTipe !== null) {
      return {
        ok: false,
        status: 400,
        pesan: 'Listing ini disewakan per unit, jadi tidak punya tipe kamar.',
      };
    }
    if (input.jumlahKamar !== 1) {
      return {
        ok: false,
        status: 400,
        pesan: 'Unit tunggal hanya bisa diblokir seluruhnya.',
      };
    }
  }

  if (input.idTipe !== null && !bertipe) {
    return {
      ok: false,
      status: 400,
      pesan: 'Listing ini tidak memakai tipe kamar.',
    };
  }

  if (input.jumlahKamar < 1) {
    return { ok: false, status: 400, pesan: 'Jumlah kamar minimal 1.' };
  }

  // Blok tingkat listing pada gedung bertipe = "tutup seluruhnya". Tidak
  // memakan kapasitas tipe mana pun, jadi tidak ada yang perlu dihitung.
  if (input.idTipe === null && bertipe) return { ok: true };

  const inv = inventarisUntuk(ctx, input.idTipe);
  if (!inv) {
    // Dua sebab yang sangat berbeda, dan pesannya tidak boleh tertukar:
    if (input.idTipe === null) {
      return {
        ok: false,
        status: 409,
        pesan:
          'Jumlah kamar kos ini belum diisi. Lengkapi dulu lewat edit listing.',
      };
    }
    // idTipe menunjuk tipe milik listing LAIN. Ditolak 403, bukan 404, karena
    // pemanggilnya memang berhak atas listing ini — yang tidak berhak adalah
    // tipenya. Inilah penjaga IDOR-nya.
    return {
      ok: false,
      status: 403,
      pesan: 'Tipe kamar ini bukan milik listing tersebut.',
    };
  }

  if (inv.totalKamar <= 0) {
    return {
      ok: false,
      status: 409,
      pesan: 'Kapasitas kamar belum diisi. Lengkapi dulu lewat edit listing.',
    };
  }

  const puncak = puncakTerpakai(
    inv,
    ctx.blok,
    input.mulai,
    input.selesai,
    sampai,
    abaikanId,
  );

  if (puncak + input.jumlahKamar > inv.totalKamar) {
    const sisa = Math.max(0, inv.totalKamar - puncak);
    return {
      ok: false,
      status: 409,
      pesan:
        sisa === 0
          ? 'Semua kamar sudah terblokir pada sebagian periode itu.'
          : `Pada periode itu hanya ${sisa} dari ${inv.totalKamar} kamar yang masih bisa diblokir.`,
    };
  }

  return { ok: true };
}

/**
 * Hitung ulang kolom turunan `kamar_tersedia` untuk satu listing.
 *
 * Definisinya: sisa kamar HARI INI menurut `listing_ketersediaan`. Kolom ini
 * ada semata-mata supaya card & filter daftar listing tidak perlu join —
 * duplikasi yang disengaja, sama alasannya dengan `Listing.harga_efektif`.
 * Halaman detail tidak pernah membacanya.
 *
 * Hanya untuk KOS: `PropertyCard` cuma menampilkan sisa kamar bila
 * `isKos`, dan mengisinya untuk apartemen akan memunculkan pill "Sisa 1 kamar"
 * pada listing yang tidak punya konsep kamar.
 *
 * Wajib dipanggil ulang setelah tipe kamar berubah lewat wizard edit — FK-nya
 * `ON DELETE CASCADE`, jadi menghapus tipe ikut menghapus bloknya tanpa lewat
 * sini.
 */
export async function hitungUlangKamarTersedia(
  db: DB,
  idProperty: bigint,
): Promise<void> {
  const ctx = await muatKonteksKetersediaan(db, idProperty);
  if (!ctx || ctx.modelInventaris !== 'KAMAR') return;

  const hariIni = kunciHariIni();

  if (punyaTipeKamar(ctx)) {
    let totalSemua = 0;
    let sisaSemua = 0;

    for (const inv of ctx.inventaris) {
      if (inv.idTipe === null) continue;
      const sisa = sisaPadaTanggal(inv, ctx.blok, hariIni);
      totalSemua += inv.totalKamar;
      sisaSemua += sisa;

      await db.listingKamarTipe.update({
        where: { id: BigInt(inv.idTipe) },
        data: { kamar_tersedia: sisa },
      });
    }

    // Agregat di listing_sewa_detail = jumlah seluruh tipe, mengikuti aturan
    // yang sudah dipakai @/lib/kosRoomTypes supaya kedua jalur tidak berselisih.
    await simpanAgregat(db, idProperty, totalSemua, sisaSemua);
    return;
  }

  const inv = ctx.inventaris[0];
  // Kapasitas belum diisi → jangan tulis apa pun. Menulis 1/1 di sini akan
  // mengubah "belum dicatat" menjadi "kos berkamar satu" secara diam-diam,
  // pada listing yang bahkan tidak sedang disunting siapa pun.
  if (!inv) return;

  await simpanAgregat(
    db,
    idProperty,
    inv.totalKamar,
    sisaPadaTanggal(inv, ctx.blok, hariIni),
  );
}

/**
 * `updateMany`, bukan `update`: listing sewa lama bisa belum punya baris di
 * `listing_sewa_detail`, dan `update` pada baris yang tidak ada melempar
 * P2025 yang akan menggagalkan seluruh transaksi blok — padahal bloknya
 * sendiri sah. Tidak adanya baris detail berarti tidak ada yang perlu
 * disinkronkan, bukan kesalahan.
 */
async function simpanAgregat(
  db: DB,
  idProperty: bigint,
  totalKamar: number,
  sisa: number,
): Promise<void> {
  await db.listingSewaDetail.updateMany({
    where: { id_property: idProperty },
    data: {
      total_kamar: totalKamar,
      // Clamp wajib: `listing_sewa_detail_kamar_check` menegakkan
      // 0 ≤ kamar_tersedia ≤ total_kamar dan akan membatalkan transaksinya.
      kamar_tersedia: Math.min(Math.max(sisa, 0), Math.max(totalKamar, 0)),
    },
  });
}

/**
 * Terjemahkan "kamar kosong sekarang" dari wizard menjadi blok awal.
 *
 * Dipanggil sekali saat listing sewa dibuat. Tanpa ini, listing baru punya
 * `kamar_tersedia = 3` di kolom cache tapi NOL blok — dan halaman detail, yang
 * menghitung dari blok, akan menyatakan kesepuluh kamarnya kosong. Kartu
 * daftar dan halaman detail langsung berselisih sejak menit pertama.
 *
 * Bentuknya blok terbuka mulai hari ini dengan alasan DISEWA: itulah arti
 * "sudah terisi" yang dimaksud agent saat mengisi angkanya, dan ia bisa
 * dirapikan jadi periode bertanggal lewat drawer kapan saja.
 *
 * Aman dipanggil ulang: listing yang sudah punya blok dilewati.
 */
export async function semaiBlokAwal(
  db: DB,
  idProperty: bigint,
  dibuatOleh: string,
): Promise<void> {
  const ctx = await muatKonteksKetersediaan(db, idProperty);
  if (!ctx || ctx.jenisTransaksi !== 'SEWA') return;
  if (ctx.modelInventaris !== 'KAMAR') return; // unit tunggal mulai dari kosong
  if (ctx.blok.length > 0) return;

  const hariIni = kunciKeDbDate(kunciHariIni());

  if (punyaTipeKamar(ctx)) {
    const tipe = await db.listingKamarTipe.findMany({
      where: { id_property: idProperty },
      select: { id: true, jumlah_kamar: true, kamar_tersedia: true },
    });

    const data = tipe
      .filter((t) => (t.jumlah_kamar ?? 0) > (t.kamar_tersedia ?? 0))
      .map((t) => ({
        id_property: idProperty,
        id_tipe: t.id,
        tanggal_mulai: hariIni,
        tanggal_selesai: null,
        jumlah_kamar: (t.jumlah_kamar ?? 0) - (t.kamar_tersedia ?? 0),
        alasan: 'DISEWA' as const,
        catatan: 'Terisi saat listing dibuat',
        dibuat_oleh: dibuatOleh,
      }));

    if (data.length > 0) {
      await db.listingKetersediaan.createMany({ data });
    }
    return;
  }

  const detail = await db.listingSewaDetail.findUnique({
    where: { id_property: idProperty },
    select: { total_kamar: true, kamar_tersedia: true },
  });

  const total = detail?.total_kamar ?? 0;
  const tersedia = detail?.kamar_tersedia ?? total;
  if (total <= tersedia) return;

  await db.listingKetersediaan.create({
    data: {
      id_property: idProperty,
      id_tipe: null,
      tanggal_mulai: hariIni,
      tanggal_selesai: null,
      jumlah_kamar: total - tersedia,
      alasan: 'DISEWA',
      catatan: 'Terisi saat listing dibuat',
      dibuat_oleh: dibuatOleh,
    },
  });
}

/**
 * Hitung ulang untuk SEMUA listing sewa — dipakai cron harian.
 *
 * Tanpa ini, blok yang mulai atau berakhir hari ini tidak pernah tercermin di
 * card: tidak ada seorang pun yang menekan tombol pada tengah malam. Hanya
 * listing yang punya blok yang disentuh; sisanya angkanya memang tidak bisa
 * berubah.
 */
export async function hitungUlangSeluruhListingSewa(): Promise<{
  diperiksa: number;
  gagal: number;
}> {
  const rows = await prisma.listingKetersediaan.findMany({
    distinct: ['id_property'],
    select: { id_property: true },
  });

  let gagal = 0;
  for (const r of rows) {
    try {
      await hitungUlangKamarTersedia(prisma, r.id_property);
    } catch (e) {
      // Satu listing yang bermasalah (mis. kapasitas diturunkan di bawah blok
      // aktif) tidak boleh menghentikan sinkronisasi listing lain.
      gagal += 1;
      console.error(
        `⚠️ Gagal hitung ulang ketersediaan listing #${r.id_property}:`,
        e,
      );
    }
  }

  return { diperiksa: rows.length, gagal };
}

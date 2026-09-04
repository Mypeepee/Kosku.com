/**
 * GET  /api/listings/pembersihan  — berapa baris yang tertangkap tiap aturan.
 * POST /api/listings/pembersihan  — jalankan pembersihannya.
 *
 * OWNER ONLY (lihat pastikanOwner). Ini satu-satunya jalur di aplikasi yang
 * benar-benar MENGHAPUS baris listing; semua jalur lain hanya mengubah
 * `status_tayang`.
 *
 * ── KENAPA HAPUS, BUKAN DITARIK SAJA ──────────────────────────────────────
 * "Tarik dari tayang" adalah keadaan yang menunggu keputusan — listing yang
 * ditarik masih ikut dihitung, masih muncul di dasbor, masih dilewati setiap
 * query. Sepeda motor dan sapi potong tidak menunggu keputusan apa pun. Tetap
 * begitu, aksi TARIK disediakan sebagai jalan tengah untuk baris yang Owner
 * belum yakin.
 *
 * ── TIGA PENGAMAN ─────────────────────────────────────────────────────────
 * 1. Setiap baris disalin utuh ke `listing_dibersihkan` (to_jsonb) DI DALAM
 *    transaksi yang sama dengan DELETE-nya. Salah sapu masih bisa dipulihkan;
 *    caranya ada di prisma/migration_listing_pembersihan.sql.
 * 2. Baris yang punya lead, klien, project, MoU, tugas, acara, atau booking
 *    survei DILEWATI dan dilaporkan — bukan dihapus. Lihat RELASI_PENGUNCI:
 *    sebagiannya akan menggagalkan DELETE (foreign key RESTRICT), tapi
 *    sebagian lagi justru BERHASIL sambil diam-diam membawa riwayat CRM.
 * 3. Kerjanya BERTAHAP. Satu panggilan memproses paling banyak `BATAS_MAKS`
 *    baris lalu melaporkan sisanya; browser yang memanggil lagi sampai habis.
 *    Satu request yang menghapus 1.300 baris berikut cascade-nya adalah satu
 *    request yang bisa kena timeout di tengah jalan, dan "di tengah jalan"
 *    adalah keadaan yang paling sulit dijelaskan kepada orang yang menekannya.
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  ATURAN_PEMBERSIHAN,
  KATA_KONFIRMASI,
  aturanById,
  isIdAturan,
  type AksiPembersihan,
  type DilewatiPembersihan,
  type HasilPembersihan,
  type IdAturan,
  type RingkasanPembersihan,
} from '@/lib/pembersihanListing';
import {
  PESAN_ARSIP_KURANG,
  PESAN_MIGRASI_KURANG,
  SELECT_KANDIDAT,
  alasanTerkunci,
  kolomBukanPropertiAda,
  pastikanOwner,
  pesanErrorPembersihan,
  tabelArsipAda,
  whereAturan,
  type BarisKandidat,
} from './_lib/query';
import { buildRiwayatStatus } from '../_lib/status-guard';
import type { ListingStatus } from '@/lib/listingStatusPermission';

/** Batas baris per panggilan. Sisanya dilanjutkan panggilan berikutnya. */
const BATAS_BAWAAN = 300;
const BATAS_MAKS = 1000;
/** Ukuran satu transaksi. Kecil disengaja: cascade-nya menyentuh 15 tabel. */
const UKURAN_BATCH = 100;
/** Batas id yang boleh dikirim sekali untuk mode pilihan manual. */
const MAKS_ID_PILIHAN = 500;

export const dynamic = 'force-dynamic';

/* ──────────────────────────────── GET ────────────────────────────────── */

export async function GET() {
  const izin = await pastikanOwner();
  if (!izin.ok) return izin.response;

  try {
    const totalListing = await prisma.listing.count();
    // Kesiapan arsip dilaporkan ke layar, bukan disimpan untuk nanti: Owner
    // harus tahu tombol Hapus mati SEBELUM menekannya, bukan sesudah.
    const arsipSiap = await tabelArsipAda();
    const kesiapanArsip = {
      arsipSiap,
      ...(arsipSiap ? {} : { pesanArsip: PESAN_ARSIP_KURANG }),
    };

    if (!(await kolomBukanPropertiAda())) {
      const kosong: RingkasanPembersihan = {
        aturan: ATURAN_PEMBERSIHAN.map((a) => ({ id: a.id, jumlah: 0 })),
        total: 0,
        totalTinjau: 0,
        totalListing,
        siap: false,
        pesan: PESAN_MIGRASI_KURANG,
        ...kesiapanArsip,
      };
      return NextResponse.json(kosong);
    }

    const jumlah = await Promise.all(
      ATURAN_PEMBERSIHAN.map((a) =>
        prisma.listing.count({ where: whereAturan(a.id) }),
      ),
    );

    // Aturannya tidak pernah beririsan — BENDA_BERGERAK & PERLU_TINJAU adalah
    // dua sisi dari belahan yang sama, dan JUDUL_BARANG mensyaratkan
    // bukan_properti = false. Jadi penjumlahan biasa tidak pernah menghitung
    // satu baris dua kali.
    const ringkasan: RingkasanPembersihan = {
      aturan: ATURAN_PEMBERSIHAN.map((a, i) => ({ id: a.id, jumlah: jumlah[i] })),
      total: ATURAN_PEMBERSIHAN.reduce(
        (n, a, i) => n + (a.tinjauManual ? 0 : jumlah[i]),
        0,
      ),
      totalTinjau: ATURAN_PEMBERSIHAN.reduce(
        (n, a, i) => n + (a.tinjauManual ? jumlah[i] : 0),
        0,
      ),
      totalListing,
      siap: true,
      ...kesiapanArsip,
    };

    return NextResponse.json(ringkasan);
  } catch (error) {
    console.error('[pembersihan] gagal menghitung ringkasan:', error);
    return NextResponse.json(
      { error: pesanErrorPembersihan(error) },
      { status: 500 },
    );
  }
}

/* ─────────────────────────────── POST ────────────────────────────────── */

export async function POST(request: NextRequest) {
  const izin = await pastikanOwner();
  if (!izin.ok) return izin.response;
  const { actor } = izin;

  try {
    const body = await request.json().catch(() => null);

    const aksi = String(body?.aksi ?? '').toUpperCase() as AksiPembersihan;
    if (aksi !== 'HAPUS' && aksi !== 'TARIK') {
      return NextResponse.json(
        { error: 'Aksi harus "HAPUS" atau "TARIK".' },
        { status: 400 },
      );
    }

    // Kata konfirmasi diperiksa DI SERVER, bukan cuma di dialog. Kalau hanya
    // dialog yang menjaganya, satu fetch dari console browser sudah cukup
    // untuk melewatinya — dan penghapusan permanen tidak boleh sesederhana itu.
    if (aksi === 'HAPUS' && String(body?.konfirmasi ?? '') !== KATA_KONFIRMASI) {
      return NextResponse.json(
        { error: `Ketik "${KATA_KONFIRMASI}" untuk mengonfirmasi penghapusan.` },
        { status: 400 },
      );
    }

    // Tanpa tabel arsip, penghapusan ditolak DI SINI — bukan dibiarkan gagal
    // sendiri di dalam transaksi. Transaksinya memang batal utuh sehingga tidak
    // ada baris yang hilang, tapi galat yang muncul adalah galat query mentah
    // (P2010) yang tidak menyebut satu pun berkas SQL, dan penekannya hanya
    // melihat satu kalimat umum yang berulang setiap kali dicoba.
    if (aksi === 'HAPUS' && !(await tabelArsipAda())) {
      return NextResponse.json({ error: PESAN_ARSIP_KURANG }, { status: 409 });
    }

    const batas = Math.min(
      BATAS_MAKS,
      Math.max(1, Number(body?.batas) || BATAS_BAWAAN),
    );

    // ── Target: seluruh baris yang cocok satu aturan, atau id-id pilihan ──
    const sumber = String(body?.sumber ?? 'ATURAN').toUpperCase();
    let where: Prisma.ListingWhereInput;
    let labelArsip: string;

    if (sumber === 'PILIHAN') {
      const ids = Array.from(
        new Set(
          (Array.isArray(body?.ids) ? body.ids : [])
            .map((v: unknown) => String(v).trim())
            .filter((v: string) => /^\d{1,18}$/.test(v)),
        ),
      ).slice(0, MAKS_ID_PILIHAN) as string[];

      if (ids.length === 0) {
        return NextResponse.json(
          { error: 'Tidak ada listing yang dipilih.' },
          { status: 400 },
        );
      }
      where = { id_property: { in: ids.map((v) => BigInt(v)) } };
      // Aturan ikut dicatat kalau pilihannya memang berasal dari daftar aturan;
      // kalau dari pencarian manual, arsipnya jujur menyebut MANUAL supaya
      // baris yang dihapus atas penilaian orang bisa dibedakan dari yang
      // dihapus oleh aturan.
      labelArsip = isIdAturan(body?.aturan) ? body.aturan : 'MANUAL';
    } else {
      const idAturan = body?.aturan;
      if (!isIdAturan(idAturan)) {
        return NextResponse.json(
          { error: 'Aturan pembersihan tidak dikenal.' },
          { status: 400 },
        );
      }
      // Keranjang "perlu ditinjau" tidak punya tombol massal di layar, dan
      // penjaganya diulang DI SINI: tombol yang tidak dirender bukan pengaman,
      // dan satu fetch dari console browser tidak boleh bisa menghapus 144
      // baris yang sebagiannya properti asli.
      const aturan = aturanById(idAturan);
      if (aturan?.tinjauManual) {
        return NextResponse.json(
          {
            error:
              `"${aturan.label}" hanya bisa diproses per baris yang dicentang, ` +
              'bukan sekaligus — sebagian isinya properti asli yang luasnya ' +
              'tidak terbawa scraper.',
          },
          { status: 400 },
        );
      }

      where = whereAturan(idAturan as IdAturan);
      labelArsip = idAturan;
    }

    // Untuk TARIK, baris yang memang sudah ditarik dikeluarkan dari target —
    // kalau tidak, `sisa` tidak akan pernah mengecil dan browser memanggil
    // ulang selamanya.
    const whereTarget: Prisma.ListingWhereInput =
      aksi === 'TARIK'
        ? { AND: [where, { status_tayang: { not: 'TARIK_LISTING' } }] }
        : where;

    const baris = await prisma.listing.findMany({
      where: whereTarget,
      select: SELECT_KANDIDAT,
      orderBy: { id_property: 'asc' },
      take: batas,
    });

    const dilewati: DilewatiPembersihan[] = [];
    const boleh: BarisKandidat[] = [];

    for (const row of baris) {
      const kunci = alasanTerkunci(row);
      if (kunci) {
        dilewati.push({
          id: row.id_property.toString(),
          judul: row.judul,
          alasan: kunci,
        });
      } else {
        boleh.push(row);
      }
    }

    const diproses =
      aksi === 'HAPUS'
        ? await hapusBertahap(boleh, labelArsip, actor)
        : await tarikBertahap(boleh, actor);

    // Sisa dihitung SESUDAH kerjanya, dari `where` yang sama — jadi angka yang
    // dilihat pemakai adalah keadaan database sekarang, bukan hasil kurang-
    // kurangan yang bisa meleset kalau ada yang menulis bersamaan.
    const sisa = await prisma.listing.count({ where: whereTarget });

    console.info(
      `[pembersihan] ${actor.idAgent} (OWNER) ${aksi} ${labelArsip}: ` +
        `${diproses} diproses, ${dilewati.length} dilewati, ${sisa} sisa`,
    );

    if (diproses > 0) segarkanDaftarPublik();

    const hasil: HasilPembersihan = { aksi, diproses, dilewati, sisa };
    return NextResponse.json(hasil);
  } catch (error) {
    console.error('[pembersihan] gagal:', error);
    return NextResponse.json(
      { error: pesanErrorPembersihan(error) },
      { status: 500 },
    );
  }
}

/**
 * Buang cache halaman DAFTAR publik — bukan halaman detail satu per satu.
 *
 * Satu putaran pembersihan menyentuh ribuan baris, dan memanggil
 * revalidatePath untuk tiap-tiapnya berarti ribuan rute dirender ulang demi
 * halaman yang sekarang memang seharusnya 404 (dan sudah 404 dengan
 * sendirinya, karena barisnya tidak ada lagi). Yang benar-benar perlu segar
 * adalah daftarnya, tempat lot yang sudah terhapus masih terpampang sampai
 * jendela ISR berikutnya.
 */
function segarkanDaftarPublik() {
  for (const path of ['/Lelang', '/Jual', '/Sewa', '/properti']) {
    try {
      revalidatePath(path);
    } catch (e) {
      // Cache yang gagal dibersihkan bukan alasan menggagalkan penghapusan
      // yang sudah tersimpan di database.
      console.error('[pembersihan] gagal revalidate', path, e);
    }
  }
}

/* ────────────────────────────── Eksekusi ─────────────────────────────── */

/**
 * Arsipkan lalu hapus, sepotong demi sepotong.
 *
 * INSERT ... SELECT to_jsonb(l) sengaja raw: ia menyalin SELURUH kolom listing
 * apa adanya, termasuk kolom yang ditambahkan sesudah berkas ini ditulis.
 * Versi Prisma-nya harus menyebut tiap kolom satu per satu, dan daftar kolom
 * yang harus diperbarui manual adalah daftar yang pertama kali lupa diperbarui.
 */
async function hapusBertahap(
  baris: BarisKandidat[],
  labelArsip: string,
  actor: { idAgent: string; nama: string | null },
): Promise<number> {
  let total = 0;

  for (let i = 0; i < baris.length; i += UKURAN_BATCH) {
    const potong = baris.slice(i, i + UKURAN_BATCH);
    const ids = potong.map((r) => r.id_property);
    const aturan = aturanById(labelArsip);
    const alasan = aturan
      ? `${aturan.label} — ${aturan.ringkas}`
      : 'Dipilih manual oleh Owner lewat panel pembersihan data.';

    const hasil = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`
          INSERT INTO listing_dibersihkan (
            id_property, judul, jenis_transaksi, kategori, kota, harga,
            id_agent, aturan, alasan, dihapus_oleh, nama_pelaku, data
          )
          SELECT l.id_property, l.judul, l.jenis_transaksi::text,
                 l.kategori::text, l.kota, l.harga, l.id_agent,
                 ${labelArsip}, ${alasan}, ${actor.idAgent}, ${actor.nama},
                 to_jsonb(l)
            FROM listing l
           WHERE l.id_property IN (${Prisma.join(ids)})`;

        return tx.listing.deleteMany({ where: { id_property: { in: ids } } });
      },
      // Cascade-nya menyentuh belasan tabel anak; 5 detik bawaan Prisma terlalu
      // ketat untuk seratus baris sekaligus di server yang sedang sibuk.
      { timeout: 30_000, maxWait: 10_000 },
    );

    total += hasil.count;
  }

  return total;
}

/** Jalan tengah: statusnya jadi TARIK_LISTING, barisnya tetap ada. */
async function tarikBertahap(
  baris: BarisKandidat[],
  actor: { idAgent: string; jabatan: string; nama: string | null },
): Promise<number> {
  let total = 0;

  for (let i = 0; i < baris.length; i += UKURAN_BATCH) {
    const potong = baris.slice(i, i + UKURAN_BATCH);
    const ids = potong.map((r) => r.id_property);

    const hasil = await prisma.$transaction(
      async (tx) => {
        const upd = await tx.listing.updateMany({
          where: {
            id_property: { in: ids },
            status_tayang: { not: 'TARIK_LISTING' },
          },
          data: { status_tayang: 'TARIK_LISTING', tanggal_diupdate: new Date() },
        });

        if (upd.count > 0) {
          // Jejak auditnya memakai penyusun yang sama dengan tombol takedown di
          // dasbor & halaman detail — satu bentuk baris audit untuk semua jalur.
          await tx.riwayatStatusListing.createMany({
            data: potong.map((row) =>
              buildRiwayatStatus({
                idProperty: row.id_property,
                actor: { ...actor, jabatan: 'OWNER' },
                basis: 'OWNER',
                idAgentPemilik: row.id_agent,
                statusLama: row.status_tayang as ListingStatus,
                statusBaru: 'TARIK_LISTING',
                sumber: 'DASHBOARD',
              }),
            ),
          });
        }

        return upd;
      },
      { timeout: 30_000, maxWait: 10_000 },
    );

    total += hasil.count;
  }

  return total;
}

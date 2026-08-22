/**
 * /api/listings/{id}/ketersediaan — kalender ketersediaan satu listing sewa.
 *
 *   GET     daftar blok (bentuk balasan tergantung izin — lihat di bawah)
 *   POST    tambah blok
 *   PATCH   ubah blok            (id di body)
 *   DELETE  hapus blok           (?blok=123)
 *
 * Aturan izin ada di @/lib/listingStatusPermission bersama izin ubah-status,
 * dan identitas pemanggil dibaca ulang dari DB lewat ../../_lib/status-guard —
 * jabatan di JWT boleh basi sampai 5 menit, dan itu terlalu lama untuk aksi
 * yang menulis.
 *
 * ── DUA BENTUK BALASAN GET ────────────────────────────────────────────────
 * Publik hanya menerima RENTANG tanggalnya (itu memang yang digambar kalender
 * penyewa, sama seperti Airbnb/Booking). `alasan` & `catatan` TIDAK ikut:
 * "RENOVASI" dan "kamar A3 bocor, tunggu tukang" adalah informasi operasional
 * pemilik, dan halaman publik bukan tempatnya. Pemanggil yang berizin kelola
 * menerima baris utuh.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { canManageSewaAvailability } from '@/lib/listingStatusPermission';
import {
  horizonKetersediaan,
  isAlasanBlokir,
  punyaKalenderKetersediaan,
  type AlasanBlokir,
  type BlokirView,
  type KunciTanggal,
} from '@/lib/sewaAvailability';
import {
  resolveStatusActor,
  revalidateListingDetail,
} from '../../_lib/status-guard';
import {
  hitungUlangKamarTersedia,
  kunciKeDbDate,
  muatKonteksKetersediaan,
  toBlokirView,
  validasiBlok,
  type KonteksKetersediaan,
} from '../../_lib/sewa-availability-write';

// Selalu dinamis: balasannya bergantung pada sesi pemanggil, dan satu balasan
// pengelola yang ter-cache lalu tersaji ke pengunjung publik adalah kebocoran.
export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// PARSER
// ─────────────────────────────────────────────────────────────────────────────

function parseId(raw: string): bigint | null {
  const trimmed = String(raw ?? '').trim();
  if (!/^\d+$/.test(trimmed)) return null;
  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

/** Terima HANYA "YYYY-MM-DD" persis. Longgar di sini berarti tanggal yang
 *  tergeser satu hari di sana — lihat catatan zona waktu di sewaAvailability. */
function parseKunci(v: unknown): KunciTanggal | null {
  const s = String(v ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  // Tolak tanggal yang tidak ada (31 Februari) — regex saja tidak cukup.
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10) === s ? s : null;
}

function parseJumlah(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 1000) return null;
  return n;
}

/** `id_tipe` dari body: null / "" / undefined semuanya berarti tingkat listing. */
function parseIdTipe(v: unknown): { ok: true; nilai: string | null } | { ok: false } {
  if (v === null || v === undefined || v === '') return { ok: true, nilai: null };
  const s = String(v).trim();
  return /^\d+$/.test(s) ? { ok: true, nilai: s } : { ok: false };
}

function parseCatatan(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return s.length > 0 ? s.slice(0, 255) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PENJAGA BERSAMA
// ─────────────────────────────────────────────────────────────────────────────

type Dijaga =
  | { ok: true; ctx: KonteksKetersediaan; idAgent: string; basis: string }
  | { ok: false; response: NextResponse };

/**
 * Rangkaian pemeriksaan yang dipakai POST/PATCH/DELETE apa adanya.
 *
 * Urutannya disengaja: identitas → keberadaan listing → jenis transaksi →
 * izin. Menaruh pemeriksaan izin paling akhir membuat pesan galatnya spesifik,
 * dan menaruh jenis transaksi sebelum izin mencegah listing JUAL diberi blok
 * yang tidak akan pernah dibaca siapa pun.
 */
async function jagaMutasi(idRaw: string): Promise<Dijaga> {
  const idProperty = parseId(idRaw);
  if (idProperty === null) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Id listing tidak valid.' },
        { status: 400 },
      ),
    };
  }

  const resolved = await resolveStatusActor();
  if (!resolved.ok) return { ok: false, response: resolved.response };

  const ctx = await muatKonteksKetersediaan(prisma, idProperty);
  if (!ctx) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Listing tidak ditemukan.' },
        { status: 404 },
      ),
    };
  }

  if (ctx.jenisTransaksi !== 'SEWA') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Kalender ketersediaan hanya berlaku untuk listing sewa.' },
        { status: 400 },
      ),
    };
  }

  // Tombolnya memang sudah disembunyikan untuk kategori lain, tapi itu cuma
  // tampilan. Di sinilah cakupannya benar-benar ditegakkan.
  if (!punyaKalenderKetersediaan(ctx.kategori)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            'Kalender ketersediaan hanya berlaku untuk kategori yang disewa berulang dengan tanggal masuk–keluar: kos, apartemen, hotel & villa.',
        },
        { status: 400 },
      ),
    };
  }

  const izin = canManageSewaAvailability(resolved.actor, {
    idAgent: ctx.idAgent,
    jenisTransaksi: ctx.jenisTransaksi,
  });

  if (!izin.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: izin.message, reason: izin.reason },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    ctx,
    idAgent: resolved.actor.idAgent,
    basis: izin.basis,
  };
}

/** Sesudah menulis: segarkan turunan + buang cache halaman detail. */
async function sesudahMenulis(ctx: KonteksKetersediaan) {
  await hitungUlangKamarTersedia(prisma, ctx.idProperty);
  revalidateListingDetail('SEWA', ctx.slug, ctx.idProperty.toString());
}

/** Bentuk yang aman dikirim ke pengunjung publik. */
function blokPublik(b: BlokirView & { id: string }) {
  return {
    id: b.id,
    idTipe: b.idTipe,
    mulai: b.mulai,
    selesai: b.selesai,
    jumlahKamar: b.jumlahKamar,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const idProperty = parseId(params.id);
    if (idProperty === null) {
      return NextResponse.json(
        { error: 'Id listing tidak valid.' },
        { status: 400 },
      );
    }

    const ctx = await muatKonteksKetersediaan(prisma, idProperty);
    if (!ctx || ctx.jenisTransaksi !== 'SEWA') {
      return NextResponse.json(
        { error: 'Listing sewa tidak ditemukan.' },
        { status: 404 },
      );
    }

    const { sampai } = horizonKetersediaan();

    // Izin dievaluasi diam-diam: pemanggil tanpa sesi tetap dapat balasan 200,
    // hanya isinya yang menyempit. Membalas 401 di sini akan membuat halaman
    // publik gagal menggambar kalendernya.
    const resolved = await resolveStatusActor();
    const bolehKelola =
      punyaKalenderKetersediaan(ctx.kategori) &&
      resolved.ok &&
      canManageSewaAvailability(resolved.actor, {
        idAgent: ctx.idAgent,
        jenisTransaksi: ctx.jenisTransaksi,
      }).allowed;

    return NextResponse.json({
      idProperty: ctx.idProperty.toString(),
      modelInventaris: ctx.modelInventaris,
      inventaris: ctx.inventaris,
      horizonSampai: sampai,
      bolehKelola,
      blok: bolehKelola ? ctx.blok : ctx.blok.map(blokPublik),
    });
  } catch (error) {
    console.error('❌ Gagal memuat ketersediaan:', error);
    return NextResponse.json(
      { error: 'Gagal memuat ketersediaan.' },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — tambah blok
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const dijaga = await jagaMutasi(params.id);
    if (!dijaga.ok) return dijaga.response;
    const { ctx, idAgent, basis } = dijaga;

    const body = await request.json().catch(() => null);

    const mulai = parseKunci(body?.mulai);
    if (!mulai) {
      return NextResponse.json(
        { error: 'Tanggal mulai tidak valid (format YYYY-MM-DD).' },
        { status: 400 },
      );
    }

    // `selesai` boleh sengaja null — itu bentuk penyimpanan "Tandai penuh".
    // Yang tidak boleh adalah nilai terisi yang tidak bisa dibaca.
    const selesaiRaw = body?.selesai;
    const selesai =
      selesaiRaw === null || selesaiRaw === undefined || selesaiRaw === ''
        ? null
        : parseKunci(selesaiRaw);
    if (selesaiRaw !== null && selesaiRaw !== undefined && selesaiRaw !== '' && !selesai) {
      return NextResponse.json(
        { error: 'Tanggal selesai tidak valid (format YYYY-MM-DD).' },
        { status: 400 },
      );
    }

    const tipe = parseIdTipe(body?.idTipe);
    if (!tipe.ok) {
      return NextResponse.json(
        { error: 'Tipe kamar tidak valid.' },
        { status: 400 },
      );
    }

    const jumlahKamar = parseJumlah(body?.jumlahKamar ?? 1);
    if (jumlahKamar === null) {
      return NextResponse.json(
        { error: 'Jumlah kamar tidak valid.' },
        { status: 400 },
      );
    }

    const alasan: AlasanBlokir = isAlasanBlokir(body?.alasan)
      ? body.alasan
      : 'DISEWA';
    const catatan = parseCatatan(body?.catatan);

    const input = { idTipe: tipe.nilai, mulai, selesai, jumlahKamar };

    const hasil = await prisma.$transaction(async (tx) => {
      // Kunci baris listing lebih dulu, lalu muat ULANG konteksnya di dalam
      // kunci. Tanpa ini dua tab pengelola bisa sama-sama lolos validasi atas
      // gambaran yang sudah usang, lalu sama-sama menulis dan bersama-sama
      // melewati kapasitas.
      await tx.$queryRaw`SELECT id_property FROM listing WHERE id_property = ${ctx.idProperty} FOR UPDATE`;

      const segar = await muatKonteksKetersediaan(tx, ctx.idProperty);
      if (!segar) return { galat: { status: 404, pesan: 'Listing tidak ditemukan.' } };

      const cek = validasiBlok(segar, input);
      if (!cek.ok) return { galat: { status: cek.status, pesan: cek.pesan } };

      const baris = await tx.listingKetersediaan.create({
        data: {
          id_property: segar.idProperty,
          id_tipe: input.idTipe === null ? null : BigInt(input.idTipe),
          tanggal_mulai: kunciKeDbDate(input.mulai),
          tanggal_selesai:
            input.selesai === null ? null : kunciKeDbDate(input.selesai),
          jumlah_kamar: input.jumlahKamar,
          alasan,
          catatan,
          dibuat_oleh: idAgent,
        },
        select: {
          id: true,
          id_tipe: true,
          tanggal_mulai: true,
          tanggal_selesai: true,
          jumlah_kamar: true,
          alasan: true,
          catatan: true,
        },
      });

      return { baris };
    });

    if ('galat' in hasil && hasil.galat) {
      return NextResponse.json(
        { error: hasil.galat.pesan },
        { status: hasil.galat.status },
      );
    }

    await sesudahMenulis(ctx);

    console.info(
      `[ketersediaan] ${idAgent} (${basis}) +blok #${ctx.idProperty} milik ${ctx.idAgent}: ` +
        `${mulai}→${selesai ?? '∞'} ×${jumlahKamar} (${alasan})`,
    );

    return NextResponse.json({
      success: true,
      blok: toBlokirView(hasil.baris!),
    });
  } catch (error) {
    console.error('❌ Gagal menambah blok ketersediaan:', error);
    return NextResponse.json(
      { error: 'Gagal menyimpan ketersediaan.' },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH — ubah blok
// ─────────────────────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const dijaga = await jagaMutasi(params.id);
    if (!dijaga.ok) return dijaga.response;
    const { ctx, idAgent, basis } = dijaga;

    const body = await request.json().catch(() => null);
    const idBlok = String(body?.id ?? '').trim();
    if (!/^\d+$/.test(idBlok)) {
      return NextResponse.json({ error: 'Id blok tidak valid.' }, { status: 400 });
    }

    // Blok harus milik listing yang izinnya sudah diperiksa. Tanpa langkah ini,
    // pemegang listing A bisa menyunting blok listing B hanya dengan mengirim
    // id blok milik B ke endpoint miliknya sendiri.
    const lama = ctx.blok.find((b) => b.id === idBlok);
    if (!lama) {
      return NextResponse.json(
        { error: 'Blok tidak ditemukan pada listing ini.' },
        { status: 404 },
      );
    }

    const mulai = body?.mulai === undefined ? lama.mulai : parseKunci(body.mulai);
    if (!mulai) {
      return NextResponse.json(
        { error: 'Tanggal mulai tidak valid.' },
        { status: 400 },
      );
    }

    let selesai: KunciTanggal | null;
    if (body?.selesai === undefined) {
      selesai = lama.selesai;
    } else if (body.selesai === null || body.selesai === '') {
      selesai = null;
    } else {
      selesai = parseKunci(body.selesai);
      if (!selesai) {
        return NextResponse.json(
          { error: 'Tanggal selesai tidak valid.' },
          { status: 400 },
        );
      }
    }

    const jumlahKamar =
      body?.jumlahKamar === undefined
        ? lama.jumlahKamar
        : parseJumlah(body.jumlahKamar);
    if (jumlahKamar === null) {
      return NextResponse.json(
        { error: 'Jumlah kamar tidak valid.' },
        { status: 400 },
      );
    }

    const alasan: AlasanBlokir = isAlasanBlokir(body?.alasan)
      ? body.alasan
      : (lama.alasan ?? 'DISEWA');
    const catatan =
      body?.catatan === undefined ? (lama.catatan ?? null) : parseCatatan(body.catatan);

    // Tipe kamar sengaja TIDAK bisa dipindah lewat PATCH: memindahkan blok
    // antar tipe berarti melepas kapasitas di satu sisi & mengambil di sisi
    // lain dalam satu langkah, dan setiap penyederhanaan validasinya berakhir
    // dengan salah satu sisi tidak diperiksa. Hapus lalu buat lagi.
    const input = { idTipe: lama.idTipe, mulai, selesai, jumlahKamar };

    const hasil = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id_property FROM listing WHERE id_property = ${ctx.idProperty} FOR UPDATE`;

      const segar = await muatKonteksKetersediaan(tx, ctx.idProperty);
      if (!segar) return { galat: { status: 404, pesan: 'Listing tidak ditemukan.' } };
      if (!segar.blok.some((b) => b.id === idBlok)) {
        return { galat: { status: 404, pesan: 'Blok sudah dihapus.' } };
      }

      const cek = validasiBlok(segar, input, idBlok);
      if (!cek.ok) return { galat: { status: cek.status, pesan: cek.pesan } };

      const baris = await tx.listingKetersediaan.update({
        where: { id: BigInt(idBlok) },
        data: {
          tanggal_mulai: kunciKeDbDate(mulai),
          tanggal_selesai: selesai === null ? null : kunciKeDbDate(selesai),
          jumlah_kamar: jumlahKamar,
          alasan,
          catatan,
          diperbarui_pada: new Date(),
        },
        select: {
          id: true,
          id_tipe: true,
          tanggal_mulai: true,
          tanggal_selesai: true,
          jumlah_kamar: true,
          alasan: true,
          catatan: true,
        },
      });

      return { baris };
    });

    if ('galat' in hasil && hasil.galat) {
      return NextResponse.json(
        { error: hasil.galat.pesan },
        { status: hasil.galat.status },
      );
    }

    await sesudahMenulis(ctx);

    console.info(
      `[ketersediaan] ${idAgent} (${basis}) ~blok ${idBlok} #${ctx.idProperty} milik ${ctx.idAgent}`,
    );

    return NextResponse.json({
      success: true,
      blok: toBlokirView(hasil.baris!),
    });
  } catch (error) {
    console.error('❌ Gagal mengubah blok ketersediaan:', error);
    return NextResponse.json(
      { error: 'Gagal memperbarui ketersediaan.' },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE — hapus blok
// ─────────────────────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const dijaga = await jagaMutasi(params.id);
    if (!dijaga.ok) return dijaga.response;
    const { ctx, idAgent, basis } = dijaga;

    const url = new URL(request.url);
    // `semua=1` = tombol "Buka semua". Disediakan sebagai aksi tersendiri
    // supaya UI tidak perlu mengirim N permintaan hapus yang bisa gagal di
    // tengah jalan dan meninggalkan kalender setengah terbuka.
    const semua = url.searchParams.get('semua') === '1';
    const idBlok = String(url.searchParams.get('blok') ?? '').trim();

    if (!semua && !/^\d+$/.test(idBlok)) {
      return NextResponse.json({ error: 'Id blok tidak valid.' }, { status: 400 });
    }

    if (semua) {
      const { count } = await prisma.listingKetersediaan.deleteMany({
        where: { id_property: ctx.idProperty },
      });
      await sesudahMenulis(ctx);
      console.info(
        `[ketersediaan] ${idAgent} (${basis}) hapus SEMUA (${count}) #${ctx.idProperty} milik ${ctx.idAgent}`,
      );
      return NextResponse.json({ success: true, dihapus: count });
    }

    // `deleteMany` dengan kedua kunci sekaligus: id blok DAN id listing yang
    // izinnya sudah diperiksa. Blok milik listing lain menghasilkan count 0,
    // bukan penghapusan diam-diam.
    const { count } = await prisma.listingKetersediaan.deleteMany({
      where: { id: BigInt(idBlok), id_property: ctx.idProperty },
    });

    if (count === 0) {
      return NextResponse.json(
        { error: 'Blok tidak ditemukan pada listing ini.' },
        { status: 404 },
      );
    }

    await sesudahMenulis(ctx);

    console.info(
      `[ketersediaan] ${idAgent} (${basis}) -blok ${idBlok} #${ctx.idProperty} milik ${ctx.idAgent}`,
    );

    return NextResponse.json({ success: true, dihapus: count });
  } catch (error) {
    console.error('❌ Gagal menghapus blok ketersediaan:', error);
    return NextResponse.json(
      { error: 'Gagal menghapus ketersediaan.' },
      { status: 500 },
    );
  }
}

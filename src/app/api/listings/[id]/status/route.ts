/**
 * PATCH /api/listings/{id}/status  —  ubah status tayang SATU listing.
 *
 * Dibuat supaya agent bisa menutup asetnya langsung dari halaman detail
 * (satu tombol), bukan lewat lima langkah di dashboard: buka dashboard →
 * menu listing → hafal & cari id → centang kotak → tandai terjual. Jalur
 * lama itu membuat aset yang sudah laku dibiarkan tetap tayang.
 *
 * Endpoint ini hanya melayani dua status: TERSEDIA ⇄ TERJUAL.
 * TARIK_LISTING sengaja TIDAK dilayani di sini — halaman publik menolak
 * listing yang ditarik (404), jadi menariknya dari halaman itu sendiri akan
 * membuang penggunanya ke halaman kosong tanpa jalan kembali. Menarik
 * listing tetap lewat dashboard, yang punya konteks daftar.
 *
 * Aturan izin ada di @/lib/listingStatusPermission (dipakai bareng UI), dan
 * identitas pemanggil dibaca ulang dari DB lewat @../../_lib/status-guard.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  canChangeListingStatus,
  soldLabelFor,
  type ListingStatus,
} from '@/lib/listingStatusPermission';
import {
  buildRiwayatStatus,
  LISTING_PERFORMA_SELECT,
  LISTING_STATUS_SELECT,
  pesanErrorStatus,
  resolveStatusActor,
  revalidateListingDetail,
} from '../../_lib/status-guard';

/** Status yang boleh ditulis lewat halaman detail. */
const STATUS_YANG_DILAYANI = ['TERSEDIA', 'TERJUAL'] as const;
type StatusDilayani = (typeof STATUS_YANG_DILAYANI)[number];

function parseId(raw: string): bigint | null {
  const trimmed = String(raw ?? '').trim();
  if (!/^\d+$/.test(trimmed)) return null;
  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

/** BigInt tidak selamat melewati JSON — id dikirim sebagai string. */
function serializeRiwayat(r: {
  id: bigint;
  id_property: bigint;
  id_agent: string;
  nama_pelaku: string | null;
  jabatan_pelaku: string;
  dasar_wewenang: string;
  id_agent_pemilik: string;
  status_lama: string;
  status_baru: string;
  sumber: string;
  dibuat_pada: Date;
}) {
  return {
    id: r.id.toString(),
    idProperty: r.id_property.toString(),
    idAgent: r.id_agent,
    namaPelaku: r.nama_pelaku,
    jabatanPelaku: r.jabatan_pelaku,
    dasarWewenang: r.dasar_wewenang,
    idAgentPemilik: r.id_agent_pemilik,
    statusLama: r.status_lama,
    statusBaru: r.status_baru,
    sumber: r.sumber,
    dibuatPada: r.dibuat_pada.toISOString(),
  };
}

export async function PATCH(
  request: NextRequest,
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

    const body = await request.json().catch(() => null);
    const statusInput = String(body?.status ?? '').toUpperCase();

    if (!(STATUS_YANG_DILAYANI as readonly string[]).includes(statusInput)) {
      return NextResponse.json(
        {
          error:
            'Status tidak dikenal. Dari halaman detail hanya bisa TERSEDIA atau TERJUAL.',
        },
        { status: 400 },
      );
    }
    const status = statusInput as StatusDilayani;

    // 1) Siapa yang menekan tombol (jabatan segar dari DB).
    const resolved = await resolveStatusActor();
    if (!resolved.ok) return resolved.response;
    const { actor } = resolved;

    // 2) Listing-nya.
    const listing = await prisma.listing.findUnique({
      where: { id_property: idProperty },
      select: LISTING_STATUS_SELECT,
    });

    if (!listing) {
      return NextResponse.json(
        { error: 'Listing tidak ditemukan.' },
        { status: 404 },
      );
    }

    // Listing yang sudah ditarik tidak punya halaman publik lagi. Mengubahnya
    // jadi TERJUAL dari sini cuma menyembunyikan fakta bahwa dia sedang ditarik.
    if (listing.status_tayang === 'TARIK_LISTING') {
      return NextResponse.json(
        {
          error:
            'Listing ini sedang ditarik dari penayangan. Aktifkan lagi lewat dashboard sebelum mengubah statusnya.',
        },
        { status: 409 },
      );
    }

    // 3) Izin.
    const izin = canChangeListingStatus(actor, {
      idAgent: listing.id_agent,
      jenisTransaksi: listing.jenis_transaksi,
    });

    if (!izin.allowed) {
      return NextResponse.json(
        { error: izin.message, reason: izin.reason },
        { status: 403 },
      );
    }

    const previousStatus = listing.status_tayang as ListingStatus;
    const label = soldLabelFor(listing.jenis_transaksi);

    // 4) Sudah sesuai → jangan menulis apa pun. Klik ganda / dua tab terbuka
    //    tidak boleh berubah jadi dua tulisan ke DB.
    if (previousStatus === status) {
      return NextResponse.json({
        success: true,
        changed: false,
        id: listing.id_property.toString(),
        status,
        previousStatus,
        basis: izin.basis,
        label,
        message:
          status === 'TERJUAL'
            ? `Listing ini memang sudah bertanda ${label.toUpperCase()}.`
            : 'Listing ini memang sudah aktif tayang.',
      });
    }

    // 5) Tulis dengan penjaga: baris hanya berubah kalau statusnya MASIH sama
    //    dengan yang barusan dibaca. Dua orang yang menekan tombol bersamaan
    //    (agent & stoker) tidak akan saling menimpa diam-diam.
    //
    //    Perubahan status & jejak auditnya ditulis dalam SATU transaksi:
    //    status yang berubah tanpa jejak sama buruknya dengan jejak yang
    //    mencatat perubahan yang sebenarnya gagal.
    const hasil = await prisma.$transaction(async (tx) => {
      const upd = await tx.listing.updateMany({
        where: { id_property: idProperty, status_tayang: previousStatus },
        data: { status_tayang: status, tanggal_diupdate: new Date() },
      });

      if (upd.count === 0) return { count: 0, riwayat: null };

      const riwayat = await tx.riwayatStatusListing.create({
        data: buildRiwayatStatus({
          idProperty,
          actor,
          basis: izin.basis,
          idAgentPemilik: listing.id_agent,
          statusLama: previousStatus,
          statusBaru: status,
          sumber: 'DETAIL',
        }),
      });

      return { count: upd.count, riwayat };
    });

    if (hasil.count === 0) {
      // Kalah balapan. Kalau ternyata orang lain menuliskan status yang sama
      // dengan yang kita mau, hasil akhirnya tetap seperti yang diminta —
      // itu keberhasilan, bukan kegagalan.
      const sekarang = await prisma.listing.findUnique({
        where: { id_property: idProperty },
        select: { status_tayang: true },
      });

      if (sekarang?.status_tayang === status) {
        return NextResponse.json({
          success: true,
          changed: false,
          id: idProperty.toString(),
          status,
          previousStatus,
          basis: izin.basis,
          label,
          message: 'Status ini baru saja disimpan dari perangkat lain.',
        });
      }

      return NextResponse.json(
        {
          error:
            'Status listing baru saja diubah orang lain. Muat ulang halaman untuk melihat status terbaru.',
          status: sekarang?.status_tayang ?? null,
        },
        { status: 409 },
      );
    }

    // 6) Jejak untuk penelusuran: siapa, atas dasar apa, listing siapa.
    //    Penting karena OWNER & STOKER bisa menutup listing agent lain.
    console.info(
      `[listing-status] ${actor.idAgent} (${actor.jabatan}/${izin.basis}) ` +
        `#${idProperty} milik ${listing.id_agent}: ${previousStatus} → ${status}`,
    );

    revalidateListingDetail(
      listing.jenis_transaksi,
      listing.slug,
      idProperty.toString(),
    );

    return NextResponse.json({
      success: true,
      changed: true,
      id: idProperty.toString(),
      status,
      previousStatus,
      basis: izin.basis,
      label,
      message:
        status === 'TERJUAL'
          ? `Listing ditandai ${label.toUpperCase()}.`
          : 'Listing diaktifkan kembali.',
      // Jejak yang barusan dicatat, supaya panel di halaman detail bisa
      // langsung menampilkan "ditandai oleh …" tanpa permintaan kedua.
      riwayat: hasil.riwayat ? serializeRiwayat(hasil.riwayat) : null,
    });
  } catch (error) {
    console.error('❌ Gagal mengubah status listing:', error);
    return NextResponse.json(
      { error: pesanErrorStatus(error) },
      { status: 500 },
    );
  }
}

/** Selisih hari kalender dari `sejak` sampai sekarang (0 = dibuat hari ini). */
function hariSejak(sejak: Date | null): number | null {
  if (!sejak) return null;
  const ms = Date.now() - sejak.getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.floor(ms / 86_400_000);
}

/**
 * GET /api/listings/{id}/status — status terkini, performa aset, dan jejak
 * audit perubahannya.
 *
 * Hanya untuk yang berwenang atas listing tersebut. Jejak audit menyebut nama
 * & jabatan orang dalam; itu urusan internal, bukan konsumsi pengunjung. Dan
 * karena izinnya sama persis dengan izin mengubah, tidak ada aturan kedua yang
 * bisa menyimpang dari yang pertama.
 *
 * `performa` ikut di sini — bukan endpoint sendiri — karena pemakainya sama
 * (panel di halaman detail), izinnya sama, dan memisahkannya hanya menambah
 * satu bolak-balik jaringan untuk menggambar satu kotak yang sama.
 */
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

    const resolved = await resolveStatusActor();
    if (!resolved.ok) return resolved.response;

    const listing = await prisma.listing.findUnique({
      where: { id_property: idProperty },
      select: LISTING_PERFORMA_SELECT,
    });

    if (!listing) {
      return NextResponse.json(
        { error: 'Listing tidak ditemukan.' },
        { status: 404 },
      );
    }

    const izin = canChangeListingStatus(resolved.actor, {
      idAgent: listing.id_agent,
      jenisTransaksi: listing.jenis_transaksi,
    });

    if (!izin.allowed) {
      return NextResponse.json(
        { error: izin.message, reason: izin.reason },
        { status: 403 },
      );
    }

    // Semuanya dihitung berbarengan: empat hitungan kecil yang saling lepas,
    // tidak ada gunanya menunggunya satu per satu.
    //
    // Sepuluh riwayat terakhir sudah lebih dari cukup untuk menjawab "siapa
    // yang mengubah ini, dan sebelumnya apa" — panel hanya menampilkan yang
    // teratas.
    const [riwayat, penawaran, penawaranPending, survei] = await Promise.all([
      // Tabel audit dimigrasikan manual per environment, jadi ia yang paling
      // mungkin belum ada. Kegagalannya tidak boleh ikut menjatuhkan angka
      // performa: jejak yang hilang membuat satu baris tidak tampil, sedangkan
      // performa yang hilang membuat panel memajang empat angka nol yang
      // terbaca sebagai fakta.
      prisma.riwayatStatusListing
        .findMany({
          where: { id_property: idProperty },
          orderBy: { dibuat_pada: 'desc' },
          take: 10,
        })
        .catch((e) => {
          console.error('⚠️ Jejak status listing tidak terbaca:', e);
          return [];
        }),
      prisma.lead.count({
        where: { id_property: idProperty, status_penawaran: { not: null } },
      }),
      prisma.lead.count({
        where: { id_property: idProperty, status_penawaran: 'pending' },
      }),
      // Hanya survei yang BELUM lewat & belum dibatalkan: yang sudah terjadi
      // bukan lagi sesuatu yang perlu disiapkan agent.
      prisma.bookingSurvei.count({
        where: {
          id_property: idProperty,
          tanggal_survei: { gte: new Date() },
          status: { not: 'CANCELLED' },
        },
      }),
    ]);

    const dilihat = listing.dilihat ?? 0;
    const klikWa = listing.wa_click_count ?? 0;

    return NextResponse.json({
      success: true,
      id: listing.id_property.toString(),
      status: listing.status_tayang,
      basis: izin.basis,
      riwayat: riwayat.map(serializeRiwayat),
      performa: {
        hariTayang: hariSejak(listing.tanggal_dibuat ?? null),
        dilihat,
        klikWa,
        penawaran,
        penawaranPending,
        survei,
        // Dihitung di server supaya "1,5%" yang dibaca agent selalu berasal
        // dari pasangan angka yang sama dengan yang dipajang di sebelahnya.
        konversi: dilihat > 0 ? (klikWa / dilihat) * 100 : null,
      },
    });
  } catch (error) {
    console.error('❌ Gagal membaca riwayat status listing:', error);
    return NextResponse.json(
      { error: pesanErrorStatus(error) },
      { status: 500 },
    );
  }
}

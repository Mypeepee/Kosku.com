/**
 * PATCH /api/listings/status  —  ubah status tayang BANYAK listing sekaligus.
 * Body: { ids: (number|string)[]; status?: 'TERSEDIA' | 'TERJUAL' | 'TARIK_LISTING' }
 *
 * Dipakai aksi massal di dashboard (centang beberapa kartu → tandai terjual /
 * tarik listing). Bukan hard-delete: barisnya tetap ada untuk riwayat closing
 * & analitik.
 *
 * Izin memakai mesin yang sama dengan tombol di halaman detail
 * (@/lib/listingStatusPermission) supaya tidak ada dua aturan yang berbeda:
 *   • Agent  → listing miliknya sendiri,
 *   • OWNER  → semua listing,
 *   • STOKER → listing miliknya + semua listing LELANG.
 *
 * Versi sebelumnya menilai jabatan dari `session.user.role`, padahal isinya
 * `peran_enum` (USER|AGENT) — perbandingan `role === 'OWNER'` tidak pernah
 * benar, sehingga OWNER diam-diam kehilangan wewenangnya, sementara niat
 * kodenya justru memberi STOKER akses ke SEMUA listing (bukan lelang saja).
 * Keduanya diperbaiki di sini.
 *
 * Id yang tidak boleh disentuh pemanggil TIDAK menggagalkan seluruh permintaan
 * — sisanya tetap diproses dan yang dilewati dilaporkan lewat `skipped`.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  canChangeListingStatus,
  isListingStatus,
  type ListingStatus,
  type StatusPermissionBasis,
} from '@/lib/listingStatusPermission';
import {
  buildRiwayatStatus,
  LISTING_STATUS_SELECT,
  pesanErrorStatus,
  resolveStatusActor,
  revalidateListingDetail,
} from '../_lib/status-guard';

/** Batas wajar sekali kirim — mencegah permintaan raksasa mengunci tabel. */
const MAX_IDS = 200;

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const rawIds: unknown = body?.ids;
    const statusInput = String(body?.status ?? 'TERJUAL').toUpperCase();

    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return NextResponse.json(
        { error: 'Parameter "ids" wajib diisi dan tidak boleh kosong.' },
        { status: 400 },
      );
    }

    if (!isListingStatus(statusInput)) {
      return NextResponse.json(
        { error: `Status tidak valid: ${statusInput}` },
        { status: 400 },
      );
    }
    const status = statusInput as ListingStatus;

    // id_property bertipe BigInt — buang yang bukan angka, dan hilangkan
    // duplikat supaya hitungan hasilnya jujur.
    const ids = Array.from(
      new Set(
        rawIds
          .map((v) => String(v).trim())
          .filter((v) => /^\d+$/.test(v)),
      ),
    )
      .slice(0, MAX_IDS)
      .map((v) => BigInt(v));

    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada id listing yang valid.' },
        { status: 400 },
      );
    }

    const resolved = await resolveStatusActor();
    if (!resolved.ok) return resolved.response;
    const { actor } = resolved;

    const listings = await prisma.listing.findMany({
      where: { id_property: { in: ids } },
      select: LISTING_STATUS_SELECT,
    });

    if (listings.length === 0) {
      return NextResponse.json(
        { error: 'Listing tidak ditemukan.' },
        { status: 404 },
      );
    }

    // Pisahkan yang boleh & tidak boleh disentuh pemanggil. Dasar izinnya
    // ikut disimpan di sini, bukan dihitung ulang saat menulis audit —
    // menghitung dua kali membuka peluang dua jawaban berbeda untuk baris
    // yang sama.
    const allowed: Array<{
      listing: (typeof listings)[number];
      basis: StatusPermissionBasis;
    }> = [];
    const deniedIds: string[] = [];

    for (const l of listings) {
      const izin = canChangeListingStatus(actor, {
        idAgent: l.id_agent,
        jenisTransaksi: l.jenis_transaksi,
      });
      if (izin.allowed) allowed.push({ listing: l, basis: izin.basis });
      else deniedIds.push(l.id_property.toString());
    }

    if (allowed.length === 0) {
      return NextResponse.json(
        {
          error:
            'Anda tidak berwenang mengubah status listing yang dipilih.',
          skipped: deniedIds.length,
          deniedIds,
        },
        { status: 403 },
      );
    }

    // Yang benar-benar berubah = yang statusnya memang belum seperti yang
    // diminta. Dipakai dua kali: sebagai penyaring UPDATE, dan sebagai daftar
    // baris audit — supaya jejaknya persis mencatat apa yang terjadi, bukan
    // apa yang diminta.
    const berubah = allowed.filter(({ listing }) => listing.status_tayang !== status);

    // Perubahan status & jejaknya satu transaksi: status tanpa jejak sama
    // buruknya dengan jejak atas perubahan yang sebenarnya gagal.
    const result = await prisma.$transaction(async (tx) => {
      const upd = await tx.listing.updateMany({
        where: {
          id_property: { in: allowed.map(({ listing }) => listing.id_property) },
          status_tayang: { not: status },
        },
        data: { status_tayang: status, tanggal_diupdate: new Date() },
      });

      if (upd.count > 0 && berubah.length > 0) {
        await tx.riwayatStatusListing.createMany({
          data: berubah.map(({ listing, basis }) =>
            buildRiwayatStatus({
              idProperty: listing.id_property,
              actor,
              basis,
              idAgentPemilik: listing.id_agent,
              statusLama: listing.status_tayang as ListingStatus,
              statusBaru: status,
              sumber: 'DASHBOARD',
            }),
          ),
        });
      }

      return upd;
    });

    if (result.count > 0) {
      console.info(
        `[listing-status] ${actor.idAgent} (${actor.jabatan}) massal → ${status}: ` +
          `${result.count} berubah, ${deniedIds.length} ditolak`,
      );

      for (const { listing } of berubah) {
        revalidateListingDetail(
          listing.jenis_transaksi,
          listing.slug,
          listing.id_property.toString(),
        );
      }
    }

    return NextResponse.json({
      success: true,
      count: result.count,
      status,
      skipped: deniedIds.length,
      deniedIds,
    });
  } catch (error) {
    console.error('Error updating listing status:', error);
    return NextResponse.json({ error: pesanErrorStatus(error) }, { status: 500 });
  }
}

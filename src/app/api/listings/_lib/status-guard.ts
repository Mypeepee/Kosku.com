/**
 * Penjaga sisi server untuk semua perubahan `status_tayang`.
 *
 * Dua hal yang HARUS lewat sini supaya jalur tunggal (halaman detail) dan
 * jalur massal (dashboard) tidak pernah berbeda aturan:
 *   1. `resolveStatusActor` — siapa yang sedang menekan tombol,
 *   2. `canChangeListingStatus` (lihat @/lib/listingStatusPermission) —
 *      boleh atau tidak dia menyentuh listing tertentu.
 *
 * Kenapa jabatan dibaca ulang dari DB, bukan dari session?
 * `authOptions` menyegarkan JWT tiap 5 menit, jadi `session.user.jabatan`
 * boleh saja tertinggal 5 menit. Untuk tampilan itu tidak masalah; untuk
 * aksi yang MENULIS ke DB itu artinya seorang stoker yang baru dicabut
 * jabatannya masih bisa menutup listing selama lima menit. Satu query
 * ringan (satu baris, lewat unique index `id_pengguna`) menghapus seluruh
 * kelas masalah itu.
 *
 * Catatan: `session.user.role` TIDAK dipakai di sini. Isinya `peran_enum`
 * (USER|AGENT) — bukan jabatan — dan membandingkannya dengan "OWNER"
 * (kesalahan yang sempat ada di beberapa berkas) selalu menghasilkan false.
 */

import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import type { status_properti_enum } from '@prisma/client';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import type {
  ListingStatus,
  StatusActor,
} from '@/lib/listingStatusPermission';

/** Pelaku lengkap: izin + identitas yang di-snapshot ke tabel audit. */
export interface StatusActorLengkap extends StatusActor {
  idAgent: string;
  jabatan: string;
  /** Nama saat kejadian — ikut disimpan di audit karena nama bisa berubah. */
  nama: string | null;
}

export type ResolvedActor =
  | { ok: true; actor: StatusActorLengkap; idPengguna: string }
  | { ok: false; response: NextResponse };

/**
 * Ambil identitas pemanggil: id_agent + jabatan yang masih segar, plus nama
 * untuk di-snapshot ke jejak audit. Mengembalikan `NextResponse` siap-kirim
 * untuk kasus gagal supaya route handler-nya tetap datar (tanpa if berlapis).
 */
export async function resolveStatusActor(): Promise<ResolvedActor> {
  const session = await getServerSession(authOptions);
  const idPengguna = (session?.user as any)?.id as string | undefined;

  if (!session?.user || !idPengguna) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Anda harus login untuk mengubah status listing.' },
        { status: 401 },
      ),
    };
  }

  const agent = await prisma.agent.findUnique({
    where: { id_pengguna: idPengguna },
    select: {
      id_agent: true,
      jabatan: true,
      pengguna: { select: { nama_lengkap: true } },
    },
  });

  if (!agent) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Akun ini belum terhubung sebagai agent.' },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    idPengguna,
    actor: {
      idAgent: agent.id_agent,
      jabatan: agent.jabatan,
      nama: agent.pengguna?.nama_lengkap ?? null,
    },
  };
}

/**
 * Satu baris jejak audit. Bentuknya sengaja lengkap-dan-datar: baris audit
 * harus tetap terbaca sendirian bertahun-tahun kemudian, tanpa bergantung
 * pada tabel lain yang isinya sudah berubah (jabatan pelaku, pemegang
 * listing, bahkan keberadaan akunnya).
 */
export function buildRiwayatStatus(params: {
  idProperty: bigint;
  actor: StatusActorLengkap;
  basis: string;
  idAgentPemilik: string;
  statusLama: ListingStatus;
  statusBaru: ListingStatus;
  sumber: 'DETAIL' | 'DASHBOARD';
}) {
  return {
    id_property: params.idProperty,
    id_agent: params.actor.idAgent,
    nama_pelaku: params.actor.nama,
    jabatan_pelaku: params.actor.jabatan,
    dasar_wewenang: params.basis,
    id_agent_pemilik: params.idAgentPemilik,
    status_lama: params.statusLama as status_properti_enum,
    status_baru: params.statusBaru as status_properti_enum,
    sumber: params.sumber,
  };
}

/**
 * Terjemahkan kegagalan Prisma jadi pesan yang bisa ditindaklanjuti.
 *
 * P2021 = tabel tidak ada. Di proyek ini migrasi dijalankan manual, jadi
 * penyebab paling mungkin adalah kode sudah ter-deploy tapi
 * `prisma/migration_riwayat_status_listing.sql` belum dijalankan di
 * environment itu. Menyebutkannya terang-terangan jauh lebih menolong
 * daripada "Gagal memperbarui status listing" yang membuat orang mengira
 * masalahnya ada di izin.
 */
export function pesanErrorStatus(error: unknown): string {
  const kode = (error as any)?.code;
  if (kode === 'P2021' || kode === 'P2022') {
    return (
      'Tabel jejak audit belum ada di database ini. Jalankan ' +
      'prisma/migration_riwayat_status_listing.sql lebih dulu.'
    );
  }
  return 'Gagal memperbarui status listing.';
}

/**
 * Kolom listing yang dibutuhkan untuk memutuskan izin + menyusun balasan.
 * Sengaja sesempit mungkin: halaman detail memanggil ini dari browser, dan
 * baris listing penuh berisi deskripsi panjang yang tidak ada gunanya di sini.
 */
export const LISTING_STATUS_SELECT = {
  id_property: true,
  id_agent: true,
  jenis_transaksi: true,
  status_tayang: true,
  judul: true,
  slug: true,
} as const;

/**
 * Tambahan kolom untuk panel performa di halaman detail (GET saja).
 *
 * Dipisah dari `LISTING_STATUS_SELECT` karena jalur tulis (PATCH) tidak
 * membutuhkannya sama sekali — memuat angka statistik hanya untuk membuang
 * hasilnya membuat query terpanas di jalur ini ikut melar tanpa alasan.
 */
export const LISTING_PERFORMA_SELECT = {
  ...LISTING_STATUS_SELECT,
  dilihat: true,
  wa_click_count: true,
  tanggal_dibuat: true,
} as const;

/**
 * Buang cache halaman detail yang menampilkan status listing ini.
 *
 * Halaman detail beragent (`/Jual/[slug]/[agentId]`) dirender statis dengan
 * `revalidate = 3600`. Tanpa pembatalan cache, penanda "TERJUAL" baru terlihat
 * pengunjung lain sampai satu jam kemudian — persis jenis keanehan yang
 * membuat agent tidak percaya pada tombolnya sendiri.
 *
 * Varian ber-agentId dibatalkan lewat pola rutenya (bukan path konkret) karena
 * satu listing punya satu halaman per agent yang pernah membagikannya —
 * mustahil didaftar satu per satu. Perubahan status itu jarang (hitungan per
 * hari), jadi merender ulang rute itu jauh lebih murah daripada status salah.
 */
export function revalidateListingDetail(
  jenisTransaksi: string,
  slug: string | null,
  id: string,
) {
  const slugId = slug ? `${slug}-${id}` : id;

  try {
    if (jenisTransaksi === 'SEWA') {
      revalidatePath(`/Sewa/${slugId}`);
      return;
    }
    if (jenisTransaksi === 'LELANG') {
      revalidatePath(`/Lelang/${slugId}`);
      revalidatePath('/Lelang/[slugId]/[agentId]', 'page');
      return;
    }
    revalidatePath(`/Jual/${slugId}`);
    revalidatePath('/Jual/[slug]/[agentId]', 'page');
  } catch (e) {
    // Cache gagal dibersihkan bukan alasan menggagalkan perubahan yang sudah
    // tersimpan di DB — cukup dicatat.
    console.error('⚠️ Gagal revalidate halaman detail listing:', e);
  }
}

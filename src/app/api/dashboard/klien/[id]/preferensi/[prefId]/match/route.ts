// GET /api/dashboard/klien/[id]/preferensi/[prefId]/match
// ---------------------------------------------------------------------------
// Aset yang cocok dengan SATU preferensi klien.
//
// Aturan pencocokannya tidak ada di sini — seluruhnya di src/lib/klienMatch.ts,
// yang juga dipakai cron asisten follow-up. Berkas ini hanya mengurus tiga hal
// yang memang milik lapisan HTTP: siapa yang boleh melihat, aset mana yang
// harus disembunyikan karena sudah pernah dikirim, dan bagaimana angka BigInt
// & Decimal berubah jadi JSON yang aman.
//
// Query:
//   ?limit=24            → jumlah hasil (maks 60)
//   ?termasukTerkirim=1  → ikutkan aset yang SUDAH pernah dikirim ke klien ini,
//                          ditandai `sudah_dikirim`. Dipakai saat agent ingin
//                          melihat "apa saja yang pernah saya kirim ke Budi".
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";
import {
  cariCocok,
  skorListing,
  alasanCocok,
  diagnosaKosong,
  fotoPertama,
  hargaEfektif,
  type KriteriaMatch,
} from "@/lib/klienMatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string; prefId: string } };


export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const agentId = (session.user as any).agentId as string | undefined;
  if (!agentId) return NextResponse.json({ ok: false }, { status: 403 });

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 24, 1), 60);
  const termasukTerkirim = url.searchParams.get("termasukTerkirim") === "1";

  /* Satu query untuk kepemilikan DAN preferensi sekaligus: preferensi hanya
     sah bila klien-nya milik agent yang sedang login. Memisahkannya jadi dua
     query membuka celah tebak-id yang klasik. */
  const pref = await prisma.preferensiKlien.findFirst({
    where: {
      id_preferensi: BigInt(params.prefId),
      id_klien: params.id,
      klien: { id_agent: agentId },
    },
  });
  if (!pref) return NextResponse.json({ ok: false, message: "Preferensi tidak ditemukan" }, { status: 404 });

  const klien = await prisma.klien.findUnique({
    where: { id_klien: params.id },
    select: { id_properti_asal: true, nama: true },
  });

  /* Aset yang disembunyikan:
       1. yang SUDAH pernah dikirim ke klien ini (kecuali diminta sebaliknya),
       2. aset milik klien itu sendiri — menawarkan rumah seseorang kepada
          dirinya sendiri adalah kesalahan yang tidak pernah bisa dijelaskan. */
  const terkirim = await prisma.kirimanRekomendasi.findMany({
    where: { id_klien: params.id },
    select: {
      id_property: true,
      terakhir_dikirim: true,
      tanggapan: true,
      harga_diketahui: true,
    },
  });
  const petaTerkirim = new Map(terkirim.map(t => [t.id_property.toString(), t]));

  const kecuali: bigint[] = [];
  if (!termasukTerkirim) kecuali.push(...terkirim.map(t => t.id_property));
  if (klien?.id_properti_asal) kecuali.push(klien.id_properti_asal);

  const kriteria: KriteriaMatch = {
    id_preferensi: pref.id_preferensi,
    maksud: pref.maksud,
    tipe_properti: pref.tipe_properti,
    jenis_transaksi: pref.jenis_transaksi,
    loc_provinsi: pref.loc_provinsi,
    loc_kota: pref.loc_kota,
    loc_kecamatan: pref.loc_kecamatan,
    loc_kelurahan: pref.loc_kelurahan,
    budget_min: pref.budget_min,
    budget_max: pref.budget_max,
    luas_min: pref.luas_min,
    luas_max: pref.luas_max,
  };

  /* cariCocok() menjalankan DUA tahap: SQL menyempitkan kolam, JavaScript
     menyaringnya secara ketat dengan lokasi yang sudah dinormalisasi.
     Memanggil prisma.listing.findMany() langsung di sini akan melewati tahap
     kedua dan mengembalikan superset — persis bug yang membuat pencarian
     "Kota Surabaya" mengembalikan aset dari kota lain. */
  const kandidat = await cariCocok<any>(prisma, kriteria, {
    kecuali,
    select: {
      id_property: true, slug: true, judul: true,
      kota: true, provinsi: true, kecamatan: true, kelurahan: true, alamat_lengkap: true,
      jenis_transaksi: true, kategori: true,
      harga: true, harga_promo: true, harga_efektif: true, nilai_limit_lelang: true,
      gambar: true, luas_tanah: true, luas_bangunan: true,
      kamar_tidur: true, kamar_mandi: true,
      is_hot_deal: true, tanggal_dibuat: true, tanggal_lelang: true,
      agent: { select: { nama_kantor: true, nomor_whatsapp: true, pengguna: { select: { nama_lengkap: true } } } },
    },
  });

  const items = kandidat
    .map(l => {
      const dikirim = petaTerkirim.get(l.id_property.toString());
      return {
        id_property: l.id_property.toString(),
        slug: l.slug,
        judul: l.judul,
        kota: l.kota ?? "",
        kecamatan: l.kecamatan ?? "",
        kelurahan: l.kelurahan ?? "",
        alamat_lengkap: l.alamat_lengkap ?? "",
        jenis_transaksi: l.jenis_transaksi,
        kategori: l.kategori,
        harga: hargaEfektif(l),
        harga_asli: Number(l.harga),
        harga_promo: l.harga_promo ? Number(l.harga_promo) : null,
        nilai_limit_lelang: l.nilai_limit_lelang ? Number(l.nilai_limit_lelang) : null,
        tanggal_lelang: l.tanggal_lelang?.toISOString() ?? null,
        gambar: fotoPertama(l.gambar),
        luas_tanah: l.luas_tanah ? Number(l.luas_tanah) : 0,
        luas_bangunan: l.luas_bangunan ? Number(l.luas_bangunan) : 0,
        kamar_tidur: l.kamar_tidur ?? 0,
        kamar_mandi: l.kamar_mandi ?? 0,
        agent_name: l.agent?.pengguna?.nama_lengkap ?? "",
        agent_office: l.agent?.nama_kantor ?? "",
        agent_wa: l.agent?.nomor_whatsapp ?? "",
        skor: skorListing(l, kriteria),
        alasan: alasanCocok(l, kriteria),
        sudah_dikirim: dikirim
          ? {
              pada: dikirim.terakhir_dikirim.toISOString(),
              tanggapan: dikirim.tanggapan,
              harga_diketahui: Number(dikirim.harga_diketahui),
            }
          : null,
      };
    })
    /* Peringkat, lalu pemotongan. Aset yang sudah dikirim selalu turun ke
       bawah: yang dicari agent saat membuka layar ini adalah sesuatu yang
       BARU untuk kliennya. */
    .sort((a, b) => {
      if (!!a.sudah_dikirim !== !!b.sudah_dikirim) return a.sudah_dikirim ? 1 : -1;
      return b.skor - a.skor;
    })
    .slice(0, limit);

  /* Diagnosa hanya saat benar-benar kosong — tiga COUNT tambahan tidak pantas
     dibayar pada jalur yang berhasil. */
  const diagnosa = items.length === 0 ? await diagnosaKosong(prisma, kriteria, { kecuali }) : null;

  return NextResponse.json({
    ok: true,
    items,
    total: items.length,
    kandidat: kandidat.length,
    diagnosa,
    klien: { nama: klien?.nama ?? "" },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { Prisma, type jenis_transaksi_enum } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  buildListingWhere,
  jadwalMenimpaSort,
  konteksDariTab,
  parseFilters,
  type SumberParam,
} from "@/lib/listingFilters";
import { buildSortWhere, parseSort } from "@/lib/listingSort";
import { kolomHargaListing } from "@/lib/listingSortRuntime";

/**
 * Pratinjau jumlah hasil untuk kriteria yang BELUM diterapkan.
 *
 * KENAPA ADA
 * Di layar kecil, filter dikumpulkan dulu di bottom sheet lalu diterapkan
 * sekaligus. Tanpa angka pratinjau, pemakai baru tahu kombinasinya menghasilkan
 * nol setelah menekan "Terapkan", menutup sheet, dan melihat grid kosong — lalu
 * harus menebak filter mana yang harus dilepas. Ini keluhan nomor satu pada
 * sistem filter, dan satu-satunya obatnya adalah menghitung lebih dulu.
 *
 * Query-nya SENGAJA memakai `parseFilters` + `buildListingWhere` yang sama
 * persis dengan halaman (src/app/properti/[slug]/page.tsx). Menyalin logika
 * filter ke sini akan membuat angka di tombol perlahan berbeda dari jumlah
 * kartu yang benar-benar muncul — bug yang sangat mahal dilacak.
 *
 * Menerima query string yang identik dengan URL halaman, jadi klien cukup
 * mengirim `?${params}` tanpa memetakan apa pun.
 */

export const dynamic = "force-dynamic";

const JENIS_PER_TAB: Record<string, jenis_transaksi_enum[]> = {
  jual: ["PRIMARY", "SECONDARY"],
  lelang: ["LELANG"],
  sewa: ["SEWA"],
  semua: ["PRIMARY", "SECONDARY", "LELANG", "SEWA"],
};

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const params: SumberParam = {};
    sp.forEach((v, k) => {
      params[k] = v;
    });

    const tipe = typeof params.tipe === "string" ? params.tipe : "semua";
    const konteks = konteksDariTab(tipe);
    const state = parseFilters(params);

    // Satu titik waktu untuk seluruh permintaan — kalau `whereJadwal` dan
    // `buildSortWhere` memanggil `new Date()` masing-masing, lelang yang
    // jadwalnya persis di batas hari bisa terhitung di satu sisi saja.
    const sekarang = new Date();

    // Kolom harga diambil dari lapis yang sama dengan halaman
    // (listingSortRuntime), supaya angka pratinjau di tombol "Terapkan" tidak
    // pernah dihitung dari kolom yang berbeda dengan isi halamannya.
    const filterWhere = buildListingWhere(
      state,
      konteks,
      sekarang,
      await kolomHargaListing(konteks),
    );

    // Sebagian pilihan urut di lelang ikut menyaring jadwal. Kalau pemakai
    // sudah memilih filter jadwal sendiri, filternya yang menang — kalau tidak,
    // irisan "sudah berlalu" × "jadwal terdekat" selalu nol. Aturan yang sama
    // dipakai halaman, lihat jadwalMenimpaSort().
    const sortWhere = jadwalMenimpaSort(state, konteks)
      ? undefined
      : buildSortWhere(parseSort(params.sort, konteks), konteks, sekarang);

    const baseWhere: Prisma.ListingWhereInput = {
      AND: [
        { status_tayang: "TERSEDIA" },
        filterWhere,
        ...(sortWhere ? [sortWhere] : []),
      ],
    };

    const jenis = JENIS_PER_TAB[tipe] ?? JENIS_PER_TAB.semua;

    const total = await prisma.listing.count({
      where: { AND: [baseWhere, { jenis_transaksi: { in: jenis } }] },
    });

    // Angka tiap tab dihitung TANPA batasan jenis_transaksi, supaya segmen tab
    // menunjukkan "berapa hasil kalau saya pindah ke sana" — bukan nol untuk
    // semua tab yang sedang tidak aktif.
    const perJenis = await prisma.listing.groupBy({
      by: ["jenis_transaksi"],
      where: baseWhere,
      _count: { jenis_transaksi: true },
    });

    const per: Record<string, number> = {};
    for (const row of perJenis) {
      per[row.jenis_transaksi] = row._count.jenis_transaksi;
    }
    const jual = (per.PRIMARY ?? 0) + (per.SECONDARY ?? 0);
    const lelang = per.LELANG ?? 0;
    const sewa = per.SEWA ?? 0;

    return NextResponse.json(
      {
        total,
        tabs: { semua: jual + lelang + sewa, jual, lelang, sewa },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[api/listings/count]", err);
    // Angka pratinjau adalah penyempurna, bukan syarat. Kalau gagal, kirim
    // `null` supaya tombol jatuh ke label netral ("Terapkan filter") alih-alih
    // memajang angka basi atau menggagalkan sheet-nya.
    return NextResponse.json({ total: null, tabs: null }, { status: 200 });
  }
}

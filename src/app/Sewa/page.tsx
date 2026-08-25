import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SearchHero from "./SearchHero";
import ProductList from "@/app/Jual/produklist";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { buildLocationWhere } from "@/lib/listingLocationFilter";
import { buildKataKunciWhere } from "@/lib/listingKataKunci";
import {
  ambilJarakKeTempat,
  buildTempatWhere,
  siapkanTempat,
  urutkanTerdekat,
} from "@/lib/listingTempatFilter";
import TempatAktifBar from "@/components/listing/TempatAktifBar";
import { parseCategoryDbList } from "@/lib/propertyType";
import { OPSI_KAMAR_MANDI_TIPE, OPSI_TIPE_UNIT } from "@/lib/listingFilters";
import {
  parseHalaman,
  parseSort,
  urlHalamanTerakhir,
} from "@/lib/listingSort";
import { orderByListing, whereHargaListing } from "@/lib/listingSortRuntime";

// --- TIPE DATA URL PARAMETERS ---
type Props = {
  searchParams: { [key: string]: string | string[] | undefined };
};

// --- METADATA DINAMIS (SEO) ---
export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const kota =
    typeof searchParams.kota === "string" ? searchParams.kota : undefined;

  const formatText = (text?: string) =>
    text ? text.charAt(0).toUpperCase() + text.slice(1) : "";

  let title = "Sewa Properti & Hunian Terlengkap | Premier";
  if (kota) title = `Sewa Properti di ${formatText(kota)} Harga Terbaik | Premier`;

  return {
    title,
    description: `Temukan properti sewa idaman di ${
      kota || "Indonesia"
    }. Rumah, apartemen, ruko & lainnya dengan harga terbaik.`,
    alternates: {
      canonical: `/Sewa${kota ? `?kota=${kota}` : ""}`,
    },
  };
}

// --- HELPERS GAMBAR ---
function isValidImageUrl(url: string): boolean {
  if (!url || url.trim() === "") return false;
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/")
  );
}

function normalizeListingImages(raw: string | null | undefined): string[] {
  if (!raw || raw.trim() === "") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) =>
      isValidImageUrl(s) ? s : `https://drive.google.com/thumbnail?id=${s}`,
    );
}

function normalizeAgentPhoto(fileId: string | null | undefined): string {
  if (!fileId || fileId.trim() === "") return "/images/default-profile.png";
  const trimmed = fileId.trim();
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }
  return `https://drive.google.com/thumbnail?id=${trimmed}&sz=w64`;
}

// --- SERVER COMPONENT UTAMA ---
export default async function SewaSearchPage({ searchParams }: Props) {
  // A. Parameter URL
  // Divalidasi, bukan Number() mentah: "?page=abc" dulu jadi NaN → skip NaN →
  // Prisma error → halaman 500.
  const page = parseHalaman(searchParams.page);
  const kota =
    typeof searchParams.kota === "string" ? searchParams.kota : undefined;
  const tipe =
    typeof searchParams.tipe === "string" ? searchParams.tipe : undefined;

  const q =
    typeof searchParams.q === "string" && searchParams.q.trim().length > 0
      ? searchParams.q.trim()
      : undefined;
  const idPropertyRaw =
    typeof searchParams.idProperty === "string" &&
    /^\d+$/.test(searchParams.idProperty.trim())
      ? searchParams.idProperty.trim()
      : undefined;

  // Filter lanjutan (sidebar)
  const minKT =
    typeof searchParams.minKT === "string" ? Number(searchParams.minKT) : undefined;
  const minKM =
    typeof searchParams.minKM === "string" ? Number(searchParams.minKM) : undefined;
  const lantai =
    typeof searchParams.lantai === "string" ? Number(searchParams.lantai) : undefined;
  const hadap =
    typeof searchParams.hadap === "string" ? searchParams.hadap : undefined;
  const kondisi =
    typeof searchParams.kondisi === "string" ? searchParams.kondisi : undefined;
  const legalitas =
    typeof searchParams.legalitas === "string" ? searchParams.legalitas : undefined;
  // Urutan dinormalkan lewat katalog bersama (@/lib/listingSort); nilai lama
  // "asc"/"desc" dan sisa sidebar lama ("relevansi"/"rating") ikut dikenali.
  // Dihitung setelah tempatnya diketahui — "terdekat" hanya sah bila ada titik
  // acuannya (lihat parseSort).
  const sortMentah = searchParams.sort;

  // Filter harga & luas
  const minHarga =
    typeof searchParams.minHarga === "string" ? Number(searchParams.minHarga) : undefined;
  const maxHarga =
    typeof searchParams.maxHarga === "string" ? Number(searchParams.maxHarga) : undefined;
  const minLT =
    typeof searchParams.minLT === "string" ? Number(searchParams.minLT) : undefined;
  const maxLT =
    typeof searchParams.maxLT === "string" ? Number(searchParams.maxLT) : undefined;
  const minLB =
    typeof searchParams.minLB === "string" ? Number(searchParams.minLB) : undefined;
  const maxLB =
    typeof searchParams.maxLB === "string" ? Number(searchParams.maxLB) : undefined;

  // Filter khusus sewa
  const durasi =
    typeof searchParams.durasi === "string" ? searchParams.durasi : undefined;
  const gender =
    typeof searchParams.gender === "string" ? searchParams.gender : undefined;
  const kamarMandiTipeRaw =
    typeof searchParams.kmTipe === "string" ? searchParams.kmTipe : undefined;
  const kamarMandiTipe =
    kamarMandiTipeRaw && OPSI_KAMAR_MANDI_TIPE.some((o) => o.value === kamarMandiTipeRaw)
      ? kamarMandiTipeRaw
      : undefined;
  const tipeUnitRaw =
    typeof searchParams.tipeUnit === "string" ? searchParams.tipeUnit : undefined;
  const tipeUnit =
    tipeUnitRaw && OPSI_TIPE_UNIT.some((o) => o.value === tipeUnitRaw)
      ? tipeUnitRaw
      : undefined;
  const hotDeal = searchParams.hotDeal === "1";

  const limit = 30;
  const skip = (page - 1) * limit;

  // Listing SEWA bisa punya >1 durasi sekaligus (harga_sewa_harian/mingguan/
  // bulanan/tahunan, sekarang di tabel ListingSewaDetail) — saat user filter
  // durasi tertentu, kita cari listing yang MENAWARKAN durasi itu (field-nya
  // terisi), bukan hanya yang durasi utamanya sama. Range harga ikut ditarget
  // ke kolom durasi tsb kalau dipilih.
  const DURASI_FIELD_MAP = {
    HARIAN: "harga_sewa_harian",
    MINGGUAN: "harga_sewa_mingguan",
    BULANAN: "harga_sewa_bulanan",
    TAHUNAN: "harga_sewa_tahunan",
  } as const;
  const durasiField =
    durasi && durasi in DURASI_FIELD_MAP
      ? DURASI_FIELD_MAP[durasi as keyof typeof DURASI_FIELD_MAP]
      : undefined;

  // Semua filter yang menyasar tabel ListingSewaDetail (durasi+harga, gender)
  // WAJIB digabung jadi SATU object relasi `sewaDetail` — kalau dipisah jadi
  // beberapa spread `{ sewaDetail: {...} }`, spread belakangan akan menimpa
  // yang sebelumnya karena sama-sama pakai key `sewaDetail`.
  const sewaDetailFilter: Record<string, any> = {};
  if (durasiField) {
    sewaDetailFilter[durasiField] = {
      not: null,
      ...(minHarga !== undefined && { gte: minHarga }),
      ...(maxHarga !== undefined && { lte: maxHarga }),
    };
  }
  if (gender) {
    sewaDetailFilter.kos_gender = { equals: gender as any };
  }
  if (kamarMandiTipe) {
    sewaDetailFilter.kamar_mandi_tipe = { equals: kamarMandiTipe as any };
  }
  if (tipeUnit) {
    sewaDetailFilter.tipe_unit = { equals: tipeUnit as any };
  }
  const hasSewaDetailFilter = Object.keys(sewaDetailFilter).length > 0;

  // Filter harga generik (kolom harga di Listing) — dipakai cuma kalau user
  // TIDAK memilih durasi spesifik; kalau ia memilih, yang disaring adalah
  // kolom harga per durasi di listing_sewa_detail (lihat sewaDetailWhere).
  //
  // Kolomnya ditentukan di sisi server lewat pintu yang SAMA dengan urutannya
  // (whereHargaListing/orderByListing), jadi filter & urutan mustahil memakai
  // kolom yang berbeda. Normalnya `harga_efektif` — angka yang tercetak di
  // kartu, harga promo bila diskonnya sah. Di database yang belum menjalankan
  // prisma/migration_harga_efektif.sql kolom itu ada tapi seluruhnya NULL, dan
  // filter di atasnya diam-diam mengembalikan NOL hasil; di situ keduanya
  // pindah bersama ke kolom cadangan.
  const genericPriceFilter = durasiField
    ? undefined
    : await whereHargaListing("SEWA", minHarga, maxHarga);
  const locationWhere = buildLocationWhere(searchParams);

  // Filter "dekat X" — menangani `?dekat=…` maupun `?q=deket unesa`. Di /Sewa
  // inilah fitur yang paling ditunggu: yang mencari kos hampir selalu memulai
  // dari kampusnya, bukan dari nama kelurahan.
  const siapTempat = await siapkanTempat(searchParams, { q, kota });
  const tempatWhere = buildTempatWhere(siapTempat.tempat);
  const sort = parseSort(sortMentah, "SEWA", siapTempat.chip?.nama);
  const kategoriList = parseCategoryDbList(searchParams.tipe);

  // B. WHERE — khusus SEWA
  const whereClause: Prisma.ListingWhereInput = {
    jenis_transaksi: "SEWA",
    status_tayang: { in: ["TERSEDIA", "TERJUAL"] },

    ...(idPropertyRaw && { id_property: BigInt(idPropertyRaw) }),


    // Digabung dalam SATU daftar AND — dua kunci `AND` di objek yang sama akan
    // saling menimpa, dan filter yang hilang diam-diam adalah kerusakan yang
    // tidak terlihat sebagai kerusakan.
    // Kata kunci, lokasi administratif, dan "dekat tempat" digabung dalam SATU
    // daftar AND — dua kunci `AND` di objek yang sama akan saling menimpa, dan
    // filter yang hilang diam-diam adalah kerusakan yang tidak terlihat
    // sebagai kerusakan.
    //
    // Kata kunci memakai pembangun bersama (src/lib/listingKataKunci.ts): ia
    // mencari lintas kolom, bukan cuma `alamat_lengkap`. "Dukuh Kupang" adalah
    // nama KELURAHAN dan sering tidak tertulis ulang di dalam alamat — dicari
    // di satu kolom saja, orang mengetik nama yang benar lalu mendapat nol.
    ...(() => {
      const and = [
        buildKataKunciWhere(siapTempat.q),
        locationWhere,
        tempatWhere,
      ].filter(Boolean) as Prisma.ListingWhereInput[];
      return !idPropertyRaw && and.length ? { AND: and } : {};
    })(),

    ...(!idPropertyRaw && kategoriList.length > 0 && {
      kategori: { in: kategoriList as any },
    }),

    ...(!idPropertyRaw && genericPriceFilter && genericPriceFilter),
    ...(!idPropertyRaw && hasSewaDetailFilter && { sewaDetail: sewaDetailFilter }),

    ...(!idPropertyRaw && minKT !== undefined && { kamar_tidur: { gte: minKT } }),
    ...(!idPropertyRaw && minKM !== undefined && { kamar_mandi: { gte: minKM } }),
    ...(!idPropertyRaw && lantai !== undefined && { jumlah_lantai: { gte: lantai } }),
    ...(!idPropertyRaw && hadap && {
      hadap_bangunan: { contains: hadap, mode: "insensitive" },
    }),
    ...(!idPropertyRaw && kondisi && {
      kondisi_interior: { contains: kondisi, mode: "insensitive" },
    }),
    ...(!idPropertyRaw && legalitas && { legalitas: { equals: legalitas as any } }),

    // Luas bangunan — sebelumnya diparse (minLB/maxLB) tapi tidak pernah
    // dituang ke where clause di halaman ini, jadi filternya terlihat aktif
    // di drawer tapi tidak menyaring apa pun.
    ...(!idPropertyRaw && (minLB !== undefined || maxLB !== undefined) && {
      luas_bangunan: {
        ...(minLB !== undefined && { gte: minLB }),
        ...(maxLB !== undefined && { lte: maxLB }),
      },
    }),

    ...(!idPropertyRaw && hotDeal && { is_hot_deal: true }),
  };

  // C. SORTING — satu aturan bersama untuk /Jual, /Sewa, /Lelang.
  // "Harga terendah" memakai `harga_efektif` (harga promo bila ada), yaitu
  // angka yang benar-benar tercetak di kartu. "Terluas" memakai luas BANGUNAN
  // di konteks sewa, karena unit apartemen tidak punya luas tanah.
  const orderByDasar = await orderByListing(sort, "SEWA");

  // Satu penyesuaian khas /Sewa: kalau pemakai memilih DURASI, harga yang
  // diurut harus harga durasi ITU.
  //
  // `Listing.harga` (dan turunannya `harga_efektif`) hanya menyimpan harga
  // durasi UTAMA pilihan pemilik — kos yang utamanya bulanan tapi juga
  // menawarkan tahunan tetap tersimpan sebagai harga bulanannya. Jadi ketika
  // pemakai menyaring "tahunan, 20–40 juta", filternya menyasar
  // listing_sewa_detail.harga_sewa_tahunan sementara urutannya dulu memakai
  // harga bulanan — daftar yang katanya "termurah" tampil dengan angka yang
  // naik-turun tanpa pola, karena yang diurut memang bukan angka yang tampil.
  // Filter dan urutan sekarang menunjuk kolom yang sama.
  //
  // Aman terhadap NULL tanpa klausa khusus: saat `durasiField` terisi,
  // sewaDetailFilter sudah mensyaratkan kolom itu `not: null`.
  const orderBy =
    durasiField && (sort === "termurah" || sort === "termahal")
      ? orderByDasar.map((bagian) =>
          "harga_efektif" in bagian ||
          "harga" in bagian ||
          "nilai_limit_lelang" in bagian
            ? ({
                sewaDetail: { [durasiField]: sort === "termurah" ? "asc" : "desc" },
              } as Prisma.ListingOrderByWithRelationInput)
            : bagian,
        )
      : orderByDasar;

  // D. QUERY
  // `totalAktif` = seluruh listing sewa yang tayang, TANPA filter — dipakai
  // badge hero ("N unit aktif") supaya angkanya tidak ikut berubah saat user
  // mempersempit pencarian.
  const sertakan = {
    agent: {
      select: {
        nama_kantor: true,
        foto_profil_url: true,
        pengguna: { select: { nama_lengkap: true } },
      },
    },
    sewaDetail: true,
    // Cukup jumlahnya: card hanya perlu tahu ada >1 tipe kamar supaya harga
    // ditampilkan sebagai "mulai dari". Detail tipenya urusan halaman detail,
    // bukan daftar.
    _count: { select: { kamarTipe: true } },
  } as const;

  // "Terdekat" diurut di luar `orderBy` — jaraknya ada di relasi to-many dan
  // berbeda per tempat yang dicari. Lihat urutkanTerdekat().
  const urutJarak =
    sort === "terdekat" && siapTempat.tempat
      ? await urutkanTerdekat(siapTempat.tempat, whereClause, page, limit)
      : null;

  const [totalItems, totalAktif, propertiesRaw] = urutJarak
    ? [
        urutJarak.total,
        await prisma.listing.count({
          where: { jenis_transaksi: "SEWA", status_tayang: "TERSEDIA" },
        }),
        await prisma.listing
          .findMany({
            where: { id_property: { in: urutJarak.ids } },
            include: sertakan,
          })
          .then((baris) => {
            // findMany tidak menjamin urutan daftar `in` — disusun ulang
            // mengikuti jarak yang sudah dihitung.
            const peta = new Map(baris.map((b) => [String(b.id_property), b]));
            return urutJarak.ids
              .map((id) => peta.get(String(id)))
              .filter(Boolean) as typeof baris;
          }),
      ]
    : await prisma.$transaction([
        prisma.listing.count({ where: whereClause }),
        prisma.listing.count({
          where: { jenis_transaksi: "SEWA", status_tayang: "TERSEDIA" },
        }),
        prisma.listing.findMany({
          where: whereClause,
          take: limit,
          skip,
          orderBy,
          include: sertakan,
        }),
      ]);

  const petaJarak = await ambilJarakKeTempat(
    siapTempat.tempat,
    propertiesRaw.map((p) => p.id_property),
  );

  const totalPages = Math.ceil(totalItems / limit);

  // Halaman di luar jangkauan → geser ke halaman terakhir, bukan grid kosong.
  const tujuan = urlHalamanTerakhir("/Sewa", searchParams, page, totalPages);
  if (tujuan) redirect(tujuan);

  // E. FORMAT DATA
  const formattedData = propertiesRaw.map((item) => {
    const foto_list = normalizeListingImages(item.gambar);
    const agentPhotoUrl = normalizeAgentPhoto(item.agent?.foto_profil_url || null);

    return {
      id_property: String(item.id_property),
      slug: item.slug,
      judul: item.judul,
      kota: item.kota,
      kecamatan: item.kecamatan,
      kelurahan: item.kelurahan,
      harga: Number(item.harga),
      harga_promo: item.harga_promo != null ? Number(item.harga_promo) : null,
      jenis_transaksi: item.jenis_transaksi,
      kategori: item.kategori,
      status_tayang: item.status_tayang,
      gambar: foto_list[0] || "/images/hero/banner.jpg",
      foto_list,
      luas_tanah: item.luas_tanah ? Number(item.luas_tanah) : 0,
      luas_bangunan: item.luas_bangunan ? Number(item.luas_bangunan) : 0,
      kamar_tidur: item.kamar_tidur ?? 0,
      kamar_mandi: item.kamar_mandi ?? 0,
      durasi_sewa: item.sewaDetail?.durasi_sewa ?? null,
      fasilitas_kamar: item.sewaDetail?.fasilitas_kamar ?? null,
      fasilitas_bersama: item.sewaDetail?.fasilitas_bersama ?? null,
      peraturan: item.sewaDetail?.peraturan ?? null,
      kos_gender: item.sewaDetail?.kos_gender ?? null,
      kapasitas_penghuni: item.sewaDetail?.kapasitas_penghuni ?? null,
      // Spesifikasi unit apartemen — dipakai card untuk menggantikan grid
      // KT/KM/LT/LB yang tidak berlaku bagi unit apartemen.
      tipe_unit: item.sewaDetail?.tipe_unit ?? null,
      lantai_unit: item.sewaDetail?.lantai_unit ?? null,
      kondisi_interior: item.kondisi_interior ?? null,
      kamar_mandi_tipe: item.sewaDetail?.kamar_mandi_tipe ?? null,
      kamar_tersedia: item.sewaDetail?.kamar_tersedia ?? null,
      jumlah_tipe_kamar: item._count?.kamarTipe ?? 0,
      // Patokan terdekat ("5 mnt ke UNAIR") — faktor keputusan utama penyewa
      // kos, disimpan sebagai Json terstruktur di Listing.
      akses_terdekat: Array.isArray(item.akses_terdekat)
        ? (item.akses_terdekat as any[])
        : [],
      agent_name: item.agent?.pengguna?.nama_lengkap || "Agent Premier",
      agent_photo: agentPhotoUrl,
      agent_office: item.agent?.nama_kantor || "Solusindo Aset",
      is_hot_deal: !!item.is_hot_deal,
      // Nama tempatnya yang dicetak, bukan nama filternya: "152 m dari
      // Universitas Ciputra" menjawab pertanyaan pembaca, "152 m dari Semua
      // kampus" mengulang apa yang sudah ia ketik sendiri.
      jarak_tempat: petaJarak.get(String(item.id_property)) ?? null,
    };
  });

  return (
    <main className="bg-[#0F0F0F] min-h-screen pb-20">
      <SearchHero
        key={`${q ?? ""}_${siapTempat.chip?.nilai ?? ""}_${idPropertyRaw ?? ""}_${kota ?? ""}_${tipe ?? ""}_${durasi ?? ""}_${gender ?? ""}_${minHarga ?? ""}_${maxHarga ?? ""}`}
        totalAktif={totalAktif}
        initial={{
          q: siapTempat.q,
          dekat: siapTempat.chip,
          radius: siapTempat.tempat?.radius,
          idProperty: idPropertyRaw,
          kota,
          tipe,
          durasi,
          gender,
          minHarga,
          maxHarga,
        }}
      />

      {(siapTempat.chip || siapTempat.catatan) && (
        <div className="container mx-auto px-4 mt-6">
          <TempatAktifBar
            tempat={siapTempat.chip}
            radius={siapTempat.tempat?.radius}
            jumlah={totalItems}
            ditebak={siapTempat.ditebak}
            kueriAsli={q}
            catatan={siapTempat.catatan}
          />
        </div>
      )}

      <ProductList
        initialData={formattedData}
        namaTempat={siapTempat.chip?.nama ?? null}
        pagination={{ currentPage: page, totalPages, totalItems }}
        baseUrl="/Sewa"
        heading="Listing Sewa"
        konteks="SEWA"
      />
    </main>
  );
}

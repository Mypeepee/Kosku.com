import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SearchHero from "./searchhero";
import ProductList from "./produklist";
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

// --- 1. GENERATE METADATA DINAMIS (SEO) ---
export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const kota =
    typeof searchParams.kota === "string" ? searchParams.kota : undefined;

  const formatText = (text?: string) =>
    text ? text.charAt(0).toUpperCase() + text.slice(1) : "";

  let title =
    "Jual Beli Properti Primary & Secondary Terlengkap | Premier";
  if (kota)
    title = `Jual Properti di ${formatText(
      kota
    )} Harga Terbaik | Premier`;

  return {
    title,
    description: `Temukan properti idaman di ${
      kota || "Indonesia"
    }. Tersedia Primary & Secondary dengan legalitas terjamin.`,
    alternates: {
      canonical: `/Jual${kota ? `?kota=${kota}` : ""}`,
    },
  };
}

// --- HELPERS GAMBAR ---
// validasi URL gambar listing
function isValidImageUrl(url: string): boolean {
  if (!url || url.trim() === "") return false;
  const trimmed = url.trim().toLowerCase();

  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/")
  );
}

// normalisasi daftar gambar listing (campuran URL & ID Drive)
function normalizeListingImages(raw: string | null | undefined): string[] {
  if (!raw || raw.trim() === "") return [];

  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => {
      if (isValidImageUrl(s)) {
        // sudah URL penuh (file.lelang.go.id, drive.google.com, dll) atau path relatif
        return s;
      }
      // selain itu anggap Google Drive fileId
      return `https://drive.google.com/thumbnail?id=${s}`;
    });
}

// normalisasi foto agent dari Google Drive ID / URL
function normalizeAgentPhoto(fileId: string | null | undefined): string {
  if (!fileId || fileId.trim() === "") {
    return "/images/default-profile.png";
  }

  const trimmed = fileId.trim();

  // jika sudah URL atau path relatif
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }

  // selain itu anggap sebagai Google Drive fileId
  return `https://drive.google.com/thumbnail?id=${trimmed}&sz=w64`;
}

const allowedKategori = [
  "RUMAH",
  "APARTEMEN",
  "RUKO",
  "TANAH",
  "GUDANG",
  "HOTEL_DAN_VILLA",
  "TOKO",
  "PABRIK",
] as const;

// --- 2. SERVER COMPONENT UTAMA (ASYNC) ---
export default async function SearchPage({ searchParams }: Props) {
  // A. Ambil Parameter URL (Standard)
  // `page` divalidasi (bukan Number() mentah): "?page=abc" dulu menghasilkan
  // NaN → `skip: NaN` → Prisma melempar error → halaman 500.
  const page = parseHalaman(searchParams.page);
  const kota =
    typeof searchParams.kota === "string"
      ? searchParams.kota
      : undefined;
  const tipe =
    typeof searchParams.tipe === "string"
      ? searchParams.tipe
      : undefined;

  // Keyword pencarian dari home search: q = alamat / kata kunci, idProperty = id_property eksak
  const q =
    typeof searchParams.q === "string" && searchParams.q.trim().length > 0
      ? searchParams.q.trim()
      : undefined;
  const idPropertyRaw =
    typeof searchParams.idProperty === "string" && /^\d+$/.test(searchParams.idProperty.trim())
      ? searchParams.idProperty.trim()
      : undefined;

  // A.2. Ambil Parameter Filter Lanjutan (DARI SIDEBAR)
  const minKT =
    typeof searchParams.minKT === "string"
      ? Number(searchParams.minKT)
      : undefined;
  const minKM =
    typeof searchParams.minKM === "string"
      ? Number(searchParams.minKM)
      : undefined;
  const lantai =
    typeof searchParams.lantai === "string"
      ? Number(searchParams.lantai)
      : undefined;
  const hadap =
    typeof searchParams.hadap === "string"
      ? searchParams.hadap
      : undefined;
  const kondisi =
    typeof searchParams.kondisi === "string"
      ? searchParams.kondisi
      : undefined;
  const legalitas =
    typeof searchParams.legalitas === "string"
      ? searchParams.legalitas
      : undefined;
  const hotDeal = searchParams.hotDeal === "1";
  // Urutan: dinormalkan lewat katalog bersama (@/lib/listingSort) — nilai lama
  // "asc"/"desc" tetap dikenali, nilai asing jatuh ke default "terbaru".
  // Nama tempat dibaca DI SINI supaya "terdekat" hanya sah ketika ada titik
  // acuannya. Dihitung ulang setelah siapTempat siap (lihat di bawah).
  const sortMentah = searchParams.sort;

  // Filter harga & luas dari SearchHero
  const minHarga =
    typeof searchParams.minHarga === "string"
      ? Number(searchParams.minHarga)
      : undefined;
  const maxHarga =
    typeof searchParams.maxHarga === "string"
      ? Number(searchParams.maxHarga)
      : undefined;
  const minLT =
    typeof searchParams.minLT === "string"
      ? Number(searchParams.minLT)
      : undefined;
  const maxLT =
    typeof searchParams.maxLT === "string"
      ? Number(searchParams.maxLT)
      : undefined;
  const minLB =
    typeof searchParams.minLB === "string"
      ? Number(searchParams.minLB)
      : undefined;
  const maxLB =
    typeof searchParams.maxLB === "string"
      ? Number(searchParams.maxLB)
      : undefined;

  const limit = 30;
  const skip = (page - 1) * limit;

  // Filter harga memakai kolom `harga_efektif` — kolom YANG SAMA dengan yang
  // dipakai "Urutkan → harga terendah" dan yang dicetak kartu. Sebelumnya
  // filter menyusun sendiri OR promo-vs-harga sementara urutan memakai `harga`
  // mentah, jadi keduanya bisa tidak sepakat: listing harga Rp 1 M berpromo
  // Rp 5 M (promo lebih mahal — bukan diskon, dan kartu menampilkan Rp 1 M)
  // dulu ikut tersaring ke rentang Rp 5 M. Satu kolom, satu kebenaran.
  //
  // Kolomnya ditentukan di sisi server (whereHargaListing) dan dipakai bersama
  // dengan urutannya — di database yang belum menjalankan
  // prisma/migration_harga_efektif.sql, `harga_efektif` ada tapi seluruhnya
  // NULL, dan filter di atasnya diam-diam mengembalikan NOL hasil.
  const priceFilter = await whereHargaListing("JUAL", minHarga, maxHarga);

  // Filter lokasi multi-wilayah (provinsi/kota/kecamatan/kelurahan) → grup OR.
  const locationWhere = buildLocationWhere(searchParams);

  /**
   * Filter "dekat X". Menangani DUA jalan masuk sekaligus: `?dekat=…` (user
   * mengklik saran) dan `?q=deket unesa` (user langsung menekan Enter).
   * Yang kedua dulu berakhir "0 properti" karena teksnya dicari apa adanya di
   * dalam kolom alamat — lihat siapkanTempat().
   */
  const siapTempat = await siapkanTempat(searchParams, { q, kota });
  const tempatWhere = buildTempatWhere(siapTempat.tempat);

  // Tipe aset multi-kategori (param `tipe` = daftar enum dipisah koma).
  const kategoriList = parseCategoryDbList(searchParams.tipe);

  // B. BUILD FILTER QUERY (WHERE)
  // Jika idProperty ada → exact match (paling spesifik, abaikan filter q dan
  // filter sekunder lainnya supaya properti yang dicari pasti tampil).
  // Jika q ada → cari di alamat_lengkap (case-insensitive contains)
  const whereClause: Prisma.ListingWhereInput = {
    jenis_transaksi: { in: ["PRIMARY", "SECONDARY"] },
    status_tayang: { in: ["TERSEDIA", "TERJUAL"] },

    ...(idPropertyRaw && { id_property: BigInt(idPropertyRaw) }),


    // Lokasi administratif & "dekat tempat" digabung dalam SATU daftar AND —
    // dua kunci `AND` di objek yang sama akan saling menimpa, dan filter yang
    // hilang diam-diam adalah kerusakan yang tidak terlihat sebagai kerusakan.
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

    ...(!idPropertyRaw && priceFilter && priceFilter),

    ...(!idPropertyRaw && minKT !== undefined && {
      kamar_tidur: { gte: minKT },
    }),

    ...(!idPropertyRaw && minKM !== undefined && {
      kamar_mandi: { gte: minKM },
    }),

    ...(!idPropertyRaw && lantai !== undefined && {
      jumlah_lantai: { gte: lantai },
    }),

    ...(!idPropertyRaw && hadap && {
      hadap_bangunan: { contains: hadap, mode: "insensitive" },
    }),

    ...(!idPropertyRaw && kondisi && {
      kondisi_interior: {
        contains: kondisi,
        mode: "insensitive",
      },
    }),

    ...(!idPropertyRaw && legalitas && {
      legalitas: { equals: legalitas as any },
    }),

    ...(!idPropertyRaw && hotDeal && { is_hot_deal: true }),
  };

  // C. TENTUKAN SORTING (ORDER BY)
  // Aturannya (status_tayang dulu → kunci pilihan user → pemecah seri
  // id_property) ada di @/lib/listingSort supaya /Jual, /Sewa, dan /Lelang
  // tidak pernah berbeda perilaku.
  const sort = parseSort(sortMentah, "JUAL", siapTempat.chip?.nama);
  const orderBy = await orderByListing(sort, "JUAL");

  // D. EKSEKUSI QUERY DATABASE (TRANSACTION)
  //
  // "Terdekat" tidak bisa lewat `orderBy`: jaraknya ada di relasi to-many dan
  // berbeda untuk setiap tempat yang dicari, jadi tidak ada kolom yang bisa
  // diurut. Urutan & paginasinya dihitung lebih dulu, lalu barisnya diambil
  // berdasarkan id — lihat urutkanTerdekat().
  const urutJarak =
    sort === "terdekat" && siapTempat.tempat
      ? await urutkanTerdekat(siapTempat.tempat, whereClause, page, limit)
      : null;

  const sertakanAgent = {
    agent: {
      select: {
        nama_kantor: true,
        foto_profil_url: true,
        pengguna: { select: { nama_lengkap: true } },
      },
    },
  } as const;

  const [totalItems, propertiesRaw] = urutJarak
    ? [
        urutJarak.total,
        // Urutan hasil findMany tidak dijamin mengikuti daftar `in`, jadi
        // barisnya disusun ulang mengikuti urutan jarak yang sudah dihitung.
        await prisma.listing
          .findMany({
            where: { id_property: { in: urutJarak.ids } },
            include: sertakanAgent,
          })
          .then((baris) => {
            const peta = new Map(baris.map((b) => [String(b.id_property), b]));
            return urutJarak.ids
              .map((id) => peta.get(String(id)))
              .filter(Boolean) as typeof baris;
          }),
      ]
    : await prisma.$transaction([
    prisma.listing.count({ where: whereClause }),

    prisma.listing.findMany({
      where: whereClause,
      take: limit,
      skip,
      orderBy,
      include: {
        agent: {
          select: {
            nama_kantor: true,
            foto_profil_url: true,
            pengguna: {
              select: {
                nama_lengkap: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(totalItems / limit);

  // Halaman di luar jangkauan → pindahkan ke halaman terakhir, jangan sajikan
  // grid kosong bertuliskan "Belum Ada Properti" padahal hasilnya ada. Ini juga
  // yang terjadi saat user mempersempit filter selagi berada di halaman jauh.
  const tujuan = urlHalamanTerakhir("/Jual", searchParams, page, totalPages);
  if (tujuan) redirect(tujuan);

  // Jarak tiap kartu ke tempat yang dicari — SATU kueri untuk seluruh halaman,
  // bukan satu per kartu.
  const petaJarak = await ambilJarakKeTempat(
    siapTempat.tempat,
    propertiesRaw.map((p) => p.id_property),
  );

  // E. FORMAT DATA UNTUK UI
  const formattedData = propertiesRaw.map((item) => {
    const foto_list = normalizeListingImages(item.gambar);
    const agentPhotoUrl = normalizeAgentPhoto(
      item.agent?.foto_profil_url || null
    );

    return {
      id_property: String(item.id_property),
      slug: item.slug,
      judul: item.judul,
      kota: item.kota,
      harga: Number(item.harga),
      harga_promo:
        item.harga_promo != null ? Number(item.harga_promo) : null,
      jenis_transaksi: item.jenis_transaksi,
      kategori: item.kategori,
      status_tayang: item.status_tayang,

      // ambil gambar pertama + list lengkap
      gambar: foto_list[0] || "/images/hero/banner.jpg",
      foto_list,

      luas_tanah: item.luas_tanah ? Number(item.luas_tanah) : 0,
      luas_bangunan: item.luas_bangunan
        ? Number(item.luas_bangunan)
        : 0,
      kamar_tidur: item.kamar_tidur ?? 0,
      kamar_mandi: item.kamar_mandi ?? 0,

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
        key={`${q ?? ""}_${siapTempat.chip?.nilai ?? ""}_${idPropertyRaw ?? ""}_${kota ?? ""}_${tipe ?? ""}_${minHarga ?? ""}_${maxHarga ?? ""}_${minLT ?? ""}_${maxLT ?? ""}_${minLB ?? ""}_${maxLB ?? ""}`}
        initial={{
          // Teks yang sudah ditafsirkan jadi tempat tidak ditaruh lagi di
          // kotak kata kunci — chip-nya sudah mewakili, dan menampilkan
          // keduanya membuat pemakai mengira filternya dobel.
          q: siapTempat.q,
          dekat: siapTempat.chip,
          radius: siapTempat.tempat?.radius,
          idProperty: idPropertyRaw,
          kota: kota,
          tipe: tipe,
          minHarga: minHarga,
          maxHarga: maxHarga,
          minLT: minLT,
          maxLT: maxLT,
          minLB: minLB,
          maxLB: maxLB,
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
        pagination={{
          currentPage: page,
          totalPages,
          totalItems,
        }}
      />
    </main>
  );
}

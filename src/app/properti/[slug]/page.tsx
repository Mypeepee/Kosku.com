import React from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { buildLocationWhere } from "@/lib/listingLocationFilter";
import { parseCategoryDbList } from "@/lib/propertyType";
import KategoriPageClient from "./KategoriPageClient";

// --- SLUG → KATEGORI MAP ---
const SLUG_TO_KATEGORI: Record<string, Prisma.kategori_properti_enum> = {
  "rumah":          "RUMAH",
  "apartemen":      "APARTEMEN",
  "ruko":           "RUKO",
  "tanah":          "TANAH",
  "gudang":         "GUDANG",
  "hotel-dan-villa":"HOTEL_DAN_VILLA",
  "toko":           "TOKO",
  "pabrik":         "PABRIK",
};

const KATEGORI_LABEL: Record<string, string> = {
  "rumah":          "Rumah",
  "apartemen":      "Apartemen",
  "ruko":           "Ruko",
  "tanah":          "Tanah",
  "gudang":         "Gudang",
  "hotel-dan-villa":"Hotel & Villa",
  "toko":           "Kios / Toko",
  "pabrik":         "Pabrik",
};

const KATEGORI_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(SLUG_TO_KATEGORI).map(([slugKey, kat]) => [kat, slugKey])
);

const TIPE_FOR_JENIS: Record<string, string> = {
  PRIMARY:   "jual",
  SECONDARY: "jual",
  LELANG:    "lelang",
  SEWA:      "sewa",
};

const KATEGORI_DESC: Record<string, string> = {
  "rumah":          "hunian nyaman untuk keluarga",
  "apartemen":      "hunian vertikal modern",
  "ruko":           "rumah toko dan properti bisnis",
  "tanah":          "investasi tanah strategis",
  "gudang":         "properti logistik dan penyimpanan",
  "hotel-dan-villa":"properti akomodasi dan wisata",
  "toko":           "ruang usaha dan kios ritel",
  "pabrik":         "properti industri dan produksi",
};

type Props = {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const slug = params.slug;
  const label = slug === "semua" ? "Semua Kategori" : KATEGORI_LABEL[slug];
  if (!label) return { title: "Kategori Properti | Kosku" };

  const tipe = typeof searchParams.tipe === "string" ? searchParams.tipe : undefined;
  const kota = typeof searchParams.kota === "string" ? searchParams.kota : undefined;

  const tipeLabel: Record<string, string> = {
    jual: "Dijual",
    lelang: "Lelang",
    sewa: "Disewa",
  };

  const tipeSuffix = tipe && tipeLabel[tipe] ? ` ${tipeLabel[tipe]}` : "";
  const kotaSuffix = kota ? ` di ${kota.charAt(0).toUpperCase() + kota.slice(1)}` : "";

  const title = `${label}${tipeSuffix}${kotaSuffix} - Jual, Sewa & Lelang | Kosku`;
  const description = `Temukan ${label.toLowerCase()} ${KATEGORI_DESC[slug] || ""} terbaik${kotaSuffix}. Tersedia pilihan dijual, disewa, maupun lelang dengan legalitas terjamin.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/properti/${slug}${tipe ? `?tipe=${tipe}` : ""}`,
    },
    openGraph: {
      title,
      description,
      type: "website",
    },
  };
}

// --- IMAGE HELPERS ---
function isValidImageUrl(url: string): boolean {
  if (!url || url.trim() === "") return false;
  const t = url.trim().toLowerCase();
  return t.startsWith("http://") || t.startsWith("https://") || t.startsWith("/");
}

function normalizeListingImages(raw: string | null | undefined): string[] {
  if (!raw || raw.trim() === "") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => (isValidImageUrl(s) ? s : `https://drive.google.com/thumbnail?id=${s}`));
}

function normalizeAgentPhoto(fileId: string | null | undefined): string {
  if (!fileId || fileId.trim() === "") return "/images/default-profile.png";
  const t = fileId.trim();
  if (t.startsWith("http://") || t.startsWith("https://") || t.startsWith("/")) return t;
  return `https://drive.google.com/thumbnail?id=${t}&sz=w64`;
}

// --- SERVER COMPONENT ---
export default async function KategoriPage({ params, searchParams }: Props) {
  const slug = params.slug;
  const isSemua = slug === "semua";
  const kategori = SLUG_TO_KATEGORI[slug];
  if (!kategori && !isSemua) notFound();

  const label = isSemua ? "Semua Kategori" : KATEGORI_LABEL[slug];

  // Parse searchParams
  const page = typeof searchParams.page === "string" ? Number(searchParams.page) : 1;
  const tipe = typeof searchParams.tipe === "string" ? searchParams.tipe         : "semua";
  const minHarga = typeof searchParams.minHarga === "string" ? Number(searchParams.minHarga) : undefined;
  const maxHarga = typeof searchParams.maxHarga === "string" ? Number(searchParams.maxHarga) : undefined;
  const minLT    = typeof searchParams.minLT    === "string" ? Number(searchParams.minLT)    : undefined;
  const maxLT    = typeof searchParams.maxLT    === "string" ? Number(searchParams.maxLT)    : undefined;
  const minLB    = typeof searchParams.minLB    === "string" ? Number(searchParams.minLB)    : undefined;
  const maxLB    = typeof searchParams.maxLB    === "string" ? Number(searchParams.maxLB)    : undefined;
  // Keyword pencarian: q (alamat) / idProperty (eksak)
  const q =
    typeof searchParams.q === "string" && searchParams.q.trim().length > 0
      ? searchParams.q.trim()
      : undefined;
  const idPropertyRaw =
    typeof searchParams.idProperty === "string" && /^\d+$/.test(searchParams.idProperty.trim())
      ? searchParams.idProperty.trim()
      : undefined;

  // Pencarian by ID: cari listing-nya dulu (tanpa filter kategori/tipe) lalu
  // arahkan ke tab & kategori yang sesuai dengan data aslinya, supaya hasil
  // pencarian selalu ketemu di tab yang benar (mis. Lelang) dari manapun
  // pencarian dilakukan (Home, Semua, Primary/Secondary, dll).
  if (idPropertyRaw) {
    const found = await prisma.listing.findFirst({
      where: { id_property: BigInt(idPropertyRaw), status_tayang: "TERSEDIA" },
      select: { kategori: true, jenis_transaksi: true },
    });
    if (found) {
      const canonicalTipe = TIPE_FOR_JENIS[found.jenis_transaksi] ?? "semua";
      const canonicalSlug =
        slug !== "semua" && SLUG_TO_KATEGORI[slug] === found.kategori
          ? slug
          : KATEGORI_TO_SLUG[found.kategori] ?? "semua";

      if (slug !== canonicalSlug || tipe !== canonicalTipe) {
        const redirectParams = new URLSearchParams();
        redirectParams.set("idProperty", idPropertyRaw);
        redirectParams.set("tipe", canonicalTipe);
        redirect(`/properti/${canonicalSlug}?${redirectParams.toString()}`);
      }
    }
  }

  // rawSort: hanya ada nilai jika user memang memilih sort (untuk highlight pill)
  // sort: selalu punya nilai fallback untuk query DB
  const rawSort = typeof searchParams.sort === "string" ? searchParams.sort : "";
  const sort     = rawSort || "terbaru";
  const limit = 30;
  const skip  = (page - 1) * limit;

  // jenis_transaksi filter berdasarkan tab
  const transaksiFilter = (): Prisma.ListingWhereInput["jenis_transaksi"] => {
    if (tipe === "jual")   return { in: ["PRIMARY", "SECONDARY"] };
    if (tipe === "lelang") return "LELANG";
    if (tipe === "sewa")   return "SEWA";
    return { in: ["PRIMARY", "SECONDARY", "LELANG", "SEWA"] };
  };

  // Pencarian by ID bersifat eksak & sudah diarahkan ke tab/kategori yang
  // benar di atas, jadi filter sekunder (lokasi, harga, dimensi) tidak perlu
  // ikut membatasi — supaya properti yang dicari pasti tampil.
  //
  // `baseWhere` = semua filter pencarian KECUALI jenis_transaksi (tab). Dipakai
  // bersama oleh daftar listing & perhitungan tab count, supaya angka di pill
  // tab ikut menyesuaikan filter user (kota, harga, dll), bukan total semua.
  // Filter lokasi multi-wilayah (provinsi/kota/kecamatan/kelurahan) → grup OR.
  const locationWhere = buildLocationWhere(searchParams);

  // Multi-tipe aset: param `kategori` (daftar enum) MENGGANTIKAN kategori slug.
  const kategoriList = parseCategoryDbList(searchParams.kategori);
  const kategoriWhere: Prisma.ListingWhereInput =
    kategoriList.length > 0
      ? { kategori: { in: kategoriList as any } }
      : kategori
      ? { kategori }
      : {};

  const baseWhere: Prisma.ListingWhereInput = {
    ...kategoriWhere,
    status_tayang: "TERSEDIA",
    ...(idPropertyRaw && { id_property: BigInt(idPropertyRaw) }),
    // Keyword dicari lintas kolom (alamat, kota, area administratif, judul),
    // bukan cuma alamat_lengkap — supaya mis. "surabaya" tetap ketemu walau
    // kata itu hanya ada di kolom `kota`/`judul`, bukan di alamat.
    ...(!idPropertyRaw && q && {
      OR: [
        { alamat_lengkap: { contains: q, mode: "insensitive" } },
        { kota:           { contains: q, mode: "insensitive" } },
        { kecamatan:      { contains: q, mode: "insensitive" } },
        { kelurahan:      { contains: q, mode: "insensitive" } },
        { provinsi:       { contains: q, mode: "insensitive" } },
        { judul:          { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(!idPropertyRaw && locationWhere && { AND: [locationWhere] }),
    ...(!idPropertyRaw && (minHarga !== undefined || maxHarga !== undefined) && {
      harga: {
        ...(minHarga !== undefined && { gte: minHarga }),
        ...(maxHarga !== undefined && { lte: maxHarga }),
      },
    }),
    ...(!idPropertyRaw && (minLT !== undefined || maxLT !== undefined) && {
      luas_tanah: {
        ...(minLT !== undefined && { gte: minLT }),
        ...(maxLT !== undefined && { lte: maxLT }),
      },
    }),
    ...(!idPropertyRaw && (minLB !== undefined || maxLB !== undefined) && {
      luas_bangunan: {
        ...(minLB !== undefined && { gte: minLB }),
        ...(maxLB !== undefined && { lte: maxLB }),
      },
    }),
  };

  const whereClause: Prisma.ListingWhereInput = {
    ...baseWhere,
    jenis_transaksi: transaksiFilter(),
  };

  // Sorting — is_hot_deal always floats to top, then secondary sort
  let secondaryOrder: Prisma.ListingOrderByWithRelationInput = { tanggal_dibuat: "desc" };
  if (sort === "termurah")   secondaryOrder = { harga: "asc" };
  if (sort === "termahal")   secondaryOrder = { harga: "desc" };
  if (sort === "terpopuler") secondaryOrder = { dilihat: "desc" };
  if (sort === "luas-asc")   secondaryOrder = { luas_tanah: "asc" };
  if (sort === "luas-desc")  secondaryOrder = { luas_tanah: "desc" };
  const orderBy: Prisma.ListingOrderByWithRelationInput[] = [
    { is_hot_deal: "desc" },
    secondaryOrder,
  ];

  const [totalItems, propertiesRaw] = await prisma.$transaction([
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
            pengguna: { select: { nama_lengkap: true } },
          },
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(totalItems / limit);

  const properties = propertiesRaw.map((item) => {
    const foto_list = normalizeListingImages(item.gambar);
    return {
      id_property:     String(item.id_property),
      slug:            item.slug,
      judul:           item.judul,
      kota:            item.kota,
      alamat_lengkap:  item.alamat_lengkap ?? "",
      harga:           item.nilai_limit_lelang
                         ? Number(item.nilai_limit_lelang)
                         : Number(item.harga),
      harga_promo:     item.harga_promo != null ? Number(item.harga_promo) : null,
      jenis_transaksi: item.jenis_transaksi,
      kategori:        item.kategori,
      gambar:          foto_list[0] || "/images/hero/banner.jpg",
      foto_list,
      luas_tanah:      Number(item.luas_tanah ?? 0),
      luas_bangunan:   Number(item.luas_bangunan ?? 0),
      kamar_tidur:     item.kamar_tidur ?? 0,
      kamar_mandi:     item.kamar_mandi ?? 0,
      tanggal_lelang:  item.tanggal_lelang ? item.tanggal_lelang.toISOString() : null,
      agent_name:      item.agent?.pengguna?.nama_lengkap || "Agent Kosku",
      agent_photo:     normalizeAgentPhoto(item.agent?.foto_profil_url),
      agent_office:    item.agent?.nama_kantor || "Kosku",
      is_hot_deal:     !!item.is_hot_deal,
    };
  });

  // Hitung tab counts — pakai baseWhere (semua filter user kecuali tab),
  // supaya angka pill menyesuaikan hasil pencarian, bukan total keseluruhan.
  const tabCounts = await prisma.listing.groupBy({
    by: ["jenis_transaksi"],
    where: baseWhere,
    _count: { jenis_transaksi: true },
  });

  const countMap: Record<string, number> = {};
  tabCounts.forEach((t) => { countMap[t.jenis_transaksi] = t._count.jenis_transaksi; });
  const totalCount =
    (countMap["PRIMARY"] ?? 0) +
    (countMap["SECONDARY"] ?? 0) +
    (countMap["LELANG"] ?? 0) +
    (countMap["SEWA"] ?? 0);
  const jualCount  = (countMap["PRIMARY"] ?? 0) + (countMap["SECONDARY"] ?? 0);

  return (
    <KategoriPageClient
      slug={slug}
      label={label}
      initialData={properties}
      pagination={{ currentPage: page, totalPages, totalItems }}
      activeTipe={tipe}
      activeSort={rawSort}
      tabCounts={{
        semua:  totalCount,
        jual:   jualCount,
        lelang: countMap["LELANG"] ?? 0,
        sewa:   countMap["SEWA"] ?? 0,
      }}
    />
  );
}

import React from "react";
import type { Metadata } from "next";
import SearchHero from "@/app/Jual/searchhero";
import ProductList from "@/app/Jual/produklist";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { buildLocationWhere } from "@/lib/listingLocationFilter";
import { parseCategoryDbList } from "@/lib/propertyType";

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
  const page =
    typeof searchParams.page === "string" ? Number(searchParams.page) : 1;
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
  const sort =
    typeof searchParams.sort === "string" ? searchParams.sort : "desc";

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

  const limit = 30;
  const skip = (page - 1) * limit;

  const buildPriceFilter = (): Prisma.ListingWhereInput | undefined => {
    if (minHarga === undefined && maxHarga === undefined) return undefined;
    return {
      OR: [
        {
          AND: [
            { harga_promo: { gt: 0 } },
            ...(minHarga !== undefined ? [{ harga_promo: { gte: minHarga } }] : []),
            ...(maxHarga !== undefined ? [{ harga_promo: { lte: maxHarga } }] : []),
          ],
        },
        {
          AND: [
            { OR: [{ harga_promo: null }, { harga_promo: { lte: 0 } }] },
            ...(minHarga !== undefined ? [{ harga: { gte: minHarga } }] : []),
            ...(maxHarga !== undefined ? [{ harga: { lte: maxHarga } }] : []),
          ],
        },
      ],
    };
  };

  const priceFilter = buildPriceFilter();
  const locationWhere = buildLocationWhere(searchParams);
  const kategoriList = parseCategoryDbList(searchParams.tipe);

  // B. WHERE — khusus SEWA
  const whereClause: Prisma.ListingWhereInput = {
    jenis_transaksi: "SEWA",
    status_tayang: "TERSEDIA",

    ...(idPropertyRaw && { id_property: BigInt(idPropertyRaw) }),

    ...(!idPropertyRaw && q && {
      alamat_lengkap: { contains: q, mode: "insensitive" },
    }),

    ...(!idPropertyRaw && locationWhere && { AND: [locationWhere] }),

    ...(!idPropertyRaw && kategoriList.length > 0 && {
      kategori: { in: kategoriList as any },
    }),

    ...(!idPropertyRaw && priceFilter && priceFilter),

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
  };

  // C. SORTING
  let orderBy: Prisma.ListingOrderByWithRelationInput = { tanggal_dibuat: "desc" };
  if (sort === "asc") orderBy = { harga: "asc" };
  else if (sort === "desc") orderBy = { harga: "desc" };

  // D. QUERY
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

  // E. FORMAT DATA
  const formattedData = propertiesRaw.map((item) => {
    const foto_list = normalizeListingImages(item.gambar);
    const agentPhotoUrl = normalizeAgentPhoto(item.agent?.foto_profil_url || null);

    return {
      id_property: String(item.id_property),
      slug: item.slug,
      judul: item.judul,
      kota: item.kota,
      harga: Number(item.harga),
      harga_promo: item.harga_promo != null ? Number(item.harga_promo) : null,
      jenis_transaksi: item.jenis_transaksi,
      kategori: item.kategori,
      gambar: foto_list[0] || "/images/hero/banner.jpg",
      foto_list,
      luas_tanah: item.luas_tanah ? Number(item.luas_tanah) : 0,
      luas_bangunan: item.luas_bangunan ? Number(item.luas_bangunan) : 0,
      kamar_tidur: item.kamar_tidur ?? 0,
      kamar_mandi: item.kamar_mandi ?? 0,
      agent_name: item.agent?.pengguna?.nama_lengkap || "Agent Premier",
      agent_photo: agentPhotoUrl,
      agent_office: item.agent?.nama_kantor || "Solusindo Aset",
      is_hot_deal: !!item.is_hot_deal,
    };
  });

  return (
    <main className="bg-[#0F0F0F] min-h-screen pb-20">
      <SearchHero
        initialTab="sewa"
        key={`${q ?? ""}_${idPropertyRaw ?? ""}_${kota ?? ""}_${tipe ?? ""}_${minHarga ?? ""}_${maxHarga ?? ""}_${minLT ?? ""}_${maxLT ?? ""}_${minLB ?? ""}_${maxLB ?? ""}`}
        initial={{
          q,
          idProperty: idPropertyRaw,
          kota,
          tipe,
          minHarga,
          maxHarga,
          minLT,
          maxLT,
          minLB,
          maxLB,
        }}
      />

      <ProductList
        initialData={formattedData}
        pagination={{ currentPage: page, totalPages, totalItems }}
        baseUrl="/Sewa"
        heading="Listing Sewa"
      />
    </main>
  );
}

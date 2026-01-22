import React from "react";
import { Metadata } from "next";
import SearchHero from "./searchhero";
import ProductList from "./produklist";
import SortBar from "./sortbar";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type Props = {
  searchParams: { [key: string]: string | string[] | undefined };
};

// mapping string dari URL -> enum kategori_properti_enum di Prisma
const KATEGORI_MAP: Record<string, Prisma.kategori_properti_enum> = {
  RUMAH: "RUMAH",
  TANAH: "TANAH",
  GUDANG: "GUDANG",
  APARTEMEN: "APARTEMEN",
  PABRIK: "PABRIK",
  RUKO: "RUKO",
  TOKO: "TOKO",
  HOTEL: "HOTEL",
  VILLA: "VILLA",
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const kota = typeof searchParams.kota === "string" ? searchParams.kota : undefined;

  const formatText = (text?: string) =>
    text ? text.charAt(0).toUpperCase() + text.slice(1) : "";

  let title = "Lelang Properti Terpercaya | Premier";
  if (kota) title = `Lelang Properti di ${formatText(kota)} Harga Terbaik | Premier`;

  return {
    title,
    description: `Ikuti lelang properti di ${
      kota || "Indonesia"
    } dengan proses aman dan transparan. Temukan rumah, tanah, dan aset komersial dengan harga di bawah pasaran.`,
    alternates: {
      canonical: `/Lelang${kota ? `?kota=${kota}` : ""}`,
    },
  };
}

const hasToken = (parts: string[], token: string) => parts.includes(token);

export default async function SearchPage({ searchParams }: Props) {
  const page =
    typeof searchParams.page === "string" ? Number(searchParams.page) : 1;
  const kota =
    typeof searchParams.kota === "string" ? searchParams.kota : undefined;
  const tipe =
    typeof searchParams.tipe === "string" ? searchParams.tipe : undefined;

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

  // tambahan dari SearchHero
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

  const sortRaw =
    typeof searchParams.sort === "string"
      ? searchParams.sort
      : "auction_asc";
  const sortParts = sortRaw.split("_").filter(Boolean);

  const limit = 18;
  const skip = (page - 1) * limit;

  // mapping tipe -> enum kategori
  const mappedKategori = tipe ? KATEGORI_MAP[tipe.toUpperCase()] : undefined;

  const whereClause: Prisma.propertyWhereInput = {
    jenis_transaksi: "LELANG",
    status_tayang: "TERSEDIA",

    ...(kota && {
      kota: { contains: kota, mode: "insensitive" },
    }),

    ...(mappedKategori && {
      kategori: { equals: mappedKategori },
    }),

    ...(minKT && {
      kamar_tidur: { gte: minKT },
    }),

    ...(minKM && {
      kamar_mandi: { gte: minKM },
    }),

    ...(lantai && {
      jumlah_lantai: { gte: lantai },
    }),

    ...(hadap && {
      hadap_bangunan: { contains: hadap, mode: "insensitive" },
    }),

    ...(kondisi && {
      kondisi_interior: { contains: kondisi, mode: "insensitive" },
    }),

    ...(legalitas && {
      legalitas: { equals: legalitas as any },
    }),

    ...(minHarga && {
      harga: {
        ...(minHarga && { gte: minHarga }),
        ...(maxHarga && { lte: maxHarga }),
      },
    }),

    ...(minLT && {
      luas_tanah: {
        ...(minLT && { gte: minLT }),
        ...(maxLT && { lte: maxLT }),
      },
    }),
  };

  const orderByArray: Prisma.propertyOrderByWithRelationInput[] = [];

  if (hasToken(sortParts, "auction") && hasToken(sortParts, "desc")) {
    orderByArray.push({ tanggal_lelang: "desc" });
  } else {
    orderByArray.push({ tanggal_lelang: "asc" });
  }

  if (hasToken(sortParts, "price")) {
    if (hasToken(sortParts, "asc")) {
      orderByArray.push({ harga: "asc" });
    } else if (hasToken(sortParts, "desc")) {
      orderByArray.push({ harga: "desc" });
    }
  }

  if (hasToken(sortParts, "land")) {
    if (hasToken(sortParts, "asc")) {
      orderByArray.push({ luas_tanah: "asc" });
    } else if (hasToken(sortParts, "desc")) {
      orderByArray.push({ luas_tanah: "desc" });
    }
  }

  const orderBy:
    | Prisma.propertyOrderByWithRelationInput
    | Prisma.propertyOrderByWithRelationInput[] =
    orderByArray.length > 0 ? orderByArray : [{ tanggal_lelang: "asc" }];

  const [totalItems, propertiesRaw] = await prisma.$transaction([
    prisma.property.count({ where: whereClause }),
    prisma.property.findMany({
      where: whereClause,
      take: limit,
      skip,
      orderBy,
      include: {
        agent: {
          include: {
            pengguna: {
              select: {
                nama_lengkap: true,
                foto_profil_url: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(totalItems / limit);

  const formattedData = propertiesRaw.map((item) => {
    const rawGambar = item.gambar || "";
    const foto_list =
      rawGambar.trim().length > 0
        ? rawGambar
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : [];

    return {
      id_property: item.id_property,
      slug: item.slug,
      judul: item.judul,
      kota: item.kota,
      alamat_lengkap: item.alamat_lengkap ?? "",
      harga: Number(item.harga),
      jenis_transaksi: item.jenis_transaksi,
      kategori: item.kategori,

      gambar: foto_list[0] || "/images/hero/banner.jpg",
      foto_list,

      luas_tanah: Number(item.luas_tanah ?? 0),
      luas_bangunan: Number(item.luas_bangunan ?? 0),
      kamar_tidur: item.kamar_tidur ?? 0,
      kamar_mandi: item.kamar_mandi ?? 0,

      agent_name: item.agent.pengguna.nama_lengkap,
      agent_photo: item.agent.pengguna.foto_profil_url || "",
      agent_office: item.agent.nama_kantor,

      tanggal_lelang: item.tanggal_lelang
        ? item.tanggal_lelang.toISOString()
        : null,
    };
  });

  return (
    <main className="bg-[#0F0F0F] min-h-screen pb-20">
      <SearchHero />

      <section className="container mx-auto px-4 mt-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-white text-2xl md:text-3xl font-black">
              Listing Lelang Properti
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {totalItems} properti ditemukan
            </p>
          </div>

          <div className="w-full md:w-auto">
            <SortBar />
          </div>
        </div>

        <ProductList
          initialData={formattedData}
          pagination={{
            currentPage: page,
            totalPages,
            totalItems,
          }}
        />
      </section>
    </main>
  );
}

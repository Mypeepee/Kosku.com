import React from "react";
import { Metadata } from "next";
import SearchHero from "./searchhero";
import ProductList from "./produklist";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// --- TIPE DATA URL PARAMETERS ---
type Props = {
  searchParams: { [key: string]: string | string[] | undefined };
};

// --- 1. GENERATE METADATA DINAMIS (SEO) ---
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const kota = typeof searchParams.kota === "string" ? searchParams.kota : undefined;

  const formatText = (text?: string) =>
    text ? text.charAt(0).toUpperCase() + text.slice(1) : "";

  let title = "Jual Beli Properti Primary & Secondary Terlengkap | Premier";
  if (kota) title = `Jual Properti di ${formatText(kota)} Harga Terbaik | Premier`;

  return {
    title,
    description: `Temukan properti idaman di ${kota || "Indonesia"}. Tersedia Primary & Secondary dengan legalitas terjamin.`,
    alternates: {
      canonical: `/Jual${kota ? `?kota=${kota}` : ""}`,
    },
  };
}

// --- 2. SERVER COMPONENT UTAMA (ASYNC) ---
export default async function SearchPage({ searchParams }: Props) {
  // A. Ambil Parameter URL (Standard)
  const page = typeof searchParams.page === "string" ? Number(searchParams.page) : 1;
  const kota = typeof searchParams.kota === "string" ? searchParams.kota : undefined;
  const tipe = typeof searchParams.tipe === "string" ? searchParams.tipe : undefined;

  // A.2. Ambil Parameter Filter Lanjutan (DARI SIDEBAR)
  const minKT =
    typeof searchParams.minKT === "string" ? Number(searchParams.minKT) : undefined;
  const minKM =
    typeof searchParams.minKM === "string" ? Number(searchParams.minKM) : undefined;
  const lantai =
    typeof searchParams.lantai === "string" ? Number(searchParams.lantai) : undefined;
  const hadap = typeof searchParams.hadap === "string" ? searchParams.hadap : undefined;
  const kondisi =
    typeof searchParams.kondisi === "string" ? searchParams.kondisi : undefined;
  const legalitas =
    typeof searchParams.legalitas === "string" ? searchParams.legalitas : undefined;
  const sort = typeof searchParams.sort === "string" ? searchParams.sort : "desc";

  const limit = 15;
  const skip = (page - 1) * limit;

  // B. BUILD FILTER QUERY (WHERE)
  const whereClause: Prisma.propertyWhereInput = {
    jenis_transaksi: { in: ["PRIMARY", "SECONDARY"] },
    status_tayang: "TERSEDIA",

    ...(kota && {
      kota: { contains: kota, mode: "insensitive" },
    }),

    ...(tipe && {
      kategori: { equals: tipe.toUpperCase() as any },
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
  };

  // C. TENTUKAN SORTING (ORDER BY)
  let orderBy: Prisma.propertyOrderByWithRelationInput = { tanggal_dibuat: "desc" };

  if (sort === "asc") {
    orderBy = { harga: "asc" };
  } else if (sort === "desc") {
    orderBy = { harga: "desc" };
  }

  // D. EKSEKUSI QUERY DATABASE (TRANSACTION)
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

  // E. FORMAT DATA UNTUK UI (split kolom gambar jadi foto_list[])
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
      harga: Number(item.harga),
      jenis_transaksi: item.jenis_transaksi,
      kategori: item.kategori,

      gambar: foto_list[0] || "/images/hero/banner.jpg",
      foto_list,

      luas_tanah: Number(item.luas_tanah),
      luas_bangunan: Number(item.luas_bangunan),
      kamar_tidur: item.kamar_tidur ?? 0,
      kamar_mandi: item.kamar_mandi ?? 0,

      agent_name: item.agent.pengguna.nama_lengkap,
      agent_photo: item.agent.pengguna.foto_profil_url || "",
      agent_office: item.agent.nama_kantor,
    };
  });

  return (
    <main className="bg-[#0F0F0F] min-h-screen pb-20">
      <SearchHero />

      <ProductList
        initialData={formattedData}
        pagination={{
          currentPage: page,
          totalPages,
          totalItems,
        }}
      />
    </main>
  );
}

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

// ✅ mapping string dari URL -> enum kategori_properti_enum di Prisma
const KATEGORI_MAP: Record<string, Prisma.kategori_properti_enum> = {
  RUMAH: "RUMAH",
  TANAH: "TANAH",
  GUDANG: "GUDANG",
  APARTEMEN: "APARTEMEN",
  PABRIK: "PABRIK",
  RUKO: "RUKO",
  TOKO: "TOKO",
  HOTEL_DAN_VILLA: "HOTEL_DAN_VILLA",
};

// ✅ Format kategori untuk display (HOTEL_DAN_VILLA → HOTEL DAN VILLA)
const formatKategoriDisplay = (kategori: string): string => {
  return kategori.replace(/_/g, " ");
};

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const kota =
    typeof searchParams.kota === "string" ? searchParams.kota : undefined;

  const formatText = (text?: string) =>
    text ? text.charAt(0).toUpperCase() + text.slice(1) : "";

  let title = "Lelang Properti Terpercaya | Premier";
  if (kota)
    title = `Lelang Properti di ${formatText(kota)} Harga Terbaik | Premier`;

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

// helper: validasi URL gambar listing
function isValidImageUrl(url: string): boolean {
  if (!url || url.trim() === "") return false;
  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("/")
  );
}

// helper: normalisasi foto agent dari Google Drive ID
function normalizeAgentPhoto(fileId: string | null | undefined): string {
  if (!fileId || fileId.trim() === "") {
    return "/images/default-profile.png";
  }

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
    typeof searchParams.hadap === "string" ? searchParams.hadap : undefined;
  const kondisi =
    typeof searchParams.kondisi === "string"
      ? searchParams.kondisi
      : undefined;
  const legalitas =
    typeof searchParams.legalitas === "string"
      ? searchParams.legalitas
      : undefined;

  // ✅ Filter harga dan luas tanah dari SearchHero
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

  // ✅ Sort parameter (default: lelang-terdekat)
  const sortRaw =
    typeof searchParams.sort === "string"
      ? searchParams.sort
      : "lelang-terdekat";

  const limit = 18;
  const skip = (page - 1) * limit;

  // ✅ mapping tipe -> enum kategori
  const mappedKategori = tipe ? KATEGORI_MAP[tipe.toUpperCase()] : undefined;

  // ✅ Tanggal hari ini (awal hari untuk comparison yang fair)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const whereClause: Prisma.ListingWhereInput = {
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

    // ✅ Filter HARGA pakai nilai_limit_lelang (BUKAN harga)
    ...((minHarga !== undefined || maxHarga !== undefined) && {
      nilai_limit_lelang: {
        ...(minHarga !== undefined && { gte: minHarga }),
        ...(maxHarga !== undefined && { lte: maxHarga }),
      },
    }),

    // ✅ Filter LUAS TANAH
    ...((minLT !== undefined || maxLT !== undefined) && {
      luas_tanah: {
        ...(minLT !== undefined && { gte: minLT }),
        ...(maxLT !== undefined && { lte: maxLT }),
      },
    }),

    // ✅ FILTER berdasarkan waktu lelang
    ...(sortRaw === "lelang-terdekat" && {
      tanggal_lelang: { gte: today }, // Lelang yang akan datang
    }),
    ...(sortRaw === "lelang-terjauh" && {
      tanggal_lelang: { gte: today }, // Lelang yang akan datang
    }),
    ...(sortRaw === "lelang-berlalu" && {
      tanggal_lelang: { lt: today }, // Lelang yang sudah lewat
    }),
  };

  // ✅ Switch-based sorting
  let orderBy: Prisma.ListingOrderByWithRelationInput[] = [];

  switch (sortRaw) {
    case "lelang-terdekat":
      // Lelang yang akan datang, dari yang paling dekat
      orderBy = [{ tanggal_lelang: "asc" }];
      break;
    case "lelang-terjauh":
      // Lelang yang akan datang, dari yang paling jauh
      orderBy = [{ tanggal_lelang: "desc" }];
      break;
    case "lelang-berlalu":
      // Lelang yang sudah lewat, dari yang baru lewat
      orderBy = [{ tanggal_lelang: "desc" }];
      break;
    case "termurah":
      orderBy = [{ nilai_limit_lelang: "asc" }];
      break;
    case "termahal":
      orderBy = [{ nilai_limit_lelang: "desc" }];
      break;
    case "terluas":
      orderBy = [{ luas_tanah: "desc" }];
      break;
    case "terkecil":
      orderBy = [{ luas_tanah: "asc" }];
      break;
    case "terpopuler":
      orderBy = [{ dilihat: "desc" }];
      break;
    default:
      // terbaru = default (sort by created date)
      orderBy = [{ tanggal_dibuat: "desc" }];
  }

  const [totalItems, propertiesRaw] = await prisma
    .$transaction([
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
    ])
    .catch((error) => {
      console.error("Prisma Error:", error);
      throw error;
    });

  const totalPages = Math.ceil(totalItems / limit);

  const formattedData = propertiesRaw.map((item) => {
    const rawGambar = item.gambar || "";
    const foto_list =
      rawGambar.trim().length > 0
        ? rawGambar
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0 && isValidImageUrl(s))
        : [];

    const agentPhotoUrl = normalizeAgentPhoto(item.agent.foto_profil_url);

    return {
      id_property: item.id_property,
      slug: item.slug,
      judul: item.judul,
      kota: item.kota,
      alamat_lengkap: item.alamat_lengkap ?? "",

      // ✅ Display harga pakai nilai_limit_lelang
      harga: item.nilai_limit_lelang
        ? Number(item.nilai_limit_lelang)
        : Number(item.harga),

      jenis_transaksi: item.jenis_transaksi,

      // ✅ Format kategori untuk display (HOTEL_DAN_VILLA → HOTEL DAN VILLA)
      kategori: formatKategoriDisplay(item.kategori),

      gambar: foto_list[0] || "/images/hero/banner.jpg",
      foto_list,

      luas_tanah: Number(item.luas_tanah ?? 0),
      luas_bangunan: Number(item.luas_bangunan ?? 0),
      kamar_tidur: item.kamar_tidur ?? 0,
      kamar_mandi: item.kamar_mandi ?? 0,

      agent_name: item.agent.pengguna.nama_lengkap,
      agent_photo: agentPhotoUrl,
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

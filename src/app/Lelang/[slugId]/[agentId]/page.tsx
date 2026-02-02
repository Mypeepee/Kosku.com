// app/Lelang/[slugId]/[agentId]/page.tsx
import React from "react";
import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import DetailClient from "../DetailClient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// --- TYPES ---
interface ParamsShape {
  slugId: string;   // contoh: "toko-lintas-...-78675"
  agentId: string;  // contoh: "AG1"
}

interface Props {
  params: ParamsShape;
}

// --- HELPER: extract id_property (bigint) dari slugId (angka di akhir) ---
function extractIdFromSlugId(slugId: string | undefined | null): bigint | null {
  if (!slugId) return null;
  const parts = slugId.split("-");
  if (parts.length < 2) return null;
  const last = parts[parts.length - 1];
  if (!/^\d+$/.test(last)) return null;
  try {
    return BigInt(last);
  } catch {
    return null;
  }
}

// --- HELPER: konversi BigInt di object Prisma jadi plain object siap dikirim ke client ---
function serializePrisma<T>(data: T): any {
  return JSON.parse(
    JSON.stringify(
      data,
      (_key, value) => (typeof value === "bigint" ? value.toString() : value)
    )
  );
}

// --- HELPER: normalisasi foto agent dari Google Drive ID ---
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

// --- QUERY DETAIL dari tabel listing ---
async function getProperty(id: bigint) {
  const product = await prisma.listing.findUnique({
    where: { id_property: id },
    include: {
      agent: {
        select: {
          id_agent: true,
          nama_kantor: true,
          rating: true,
          jumlah_closing: true,
          nomor_whatsapp: true,
          kota_area: true,
          jabatan: true,
          foto_profil_url: true,
          pengguna: {
            select: {
              nama_lengkap: true,
              nomor_telepon: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!product) return null;
  if (product.status_tayang !== "TERSEDIA") return null;

  return product;
}

// --- QUERY SIMILAR dari listing ---
async function getSimilarProperties(currentProperty: any) {
  try {
    const similarProperties = await prisma.listing.findMany({
      where: {
        AND: [
          { id_property: { not: currentProperty.id_property } },
          {
            OR: [
              { kota: currentProperty.kota },
              { kategori: currentProperty.kategori },
            ],
          },
          { status_tayang: "TERSEDIA" },
          { jenis_transaksi: "LELANG" },
        ],
      },
      include: {
        agent: {
          select: {
            id_agent: true,
            nama_kantor: true,
            rating: true,
            jumlah_closing: true,
            nomor_whatsapp: true,
            kota_area: true,
            jabatan: true,
            foto_profil_url: true,
            pengguna: {
              select: {
                nama_lengkap: true,
                nomor_telepon: true,
                email: true,
              },
            },
          },
        },
      },
      take: 50,
      orderBy: [{ is_hot_deal: "desc" }, { tanggal_dibuat: "desc" }],
    });

    return similarProperties;
  } catch (error) {
    console.error("❌ Error fetching similar properties:", error);
    return [];
  }
}

// --- METADATA ---
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slugId } = params;
  const id = extractIdFromSlugId(slugId);

  if (!id) {
    return {
      title: "Properti Tidak Ditemukan | Premier Asset",
      description: "Halaman properti yang Anda cari tidak ditemukan.",
    };
  }

  const product = await getProperty(id);

  if (!product) {
    return {
      title: "Properti Tidak Ditemukan | Premier Asset",
      description: "Halaman properti yang Anda cari tidak ditemukan.",
    };
  }

  const hargaFormatted = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(product.harga));

  const namaAgent =
    product.agent?.pengguna?.nama_lengkap || "Agent Premier";

  const specs = [
    product.luas_tanah && `LT ${product.luas_tanah}m²`,
    product.luas_bangunan && `LB ${product.luas_bangunan}m²`,
    product.kamar_tidur && `${product.kamar_tidur} KT`,
    product.kamar_mandi && `${product.kamar_mandi} KM`,
  ]
    .filter(Boolean)
    .join(" • ");

  const description = product.deskripsi
    ? product.deskripsi.substring(0, 155) + "..."
    : `${product.jenis_transaksi} ${product.kategori} di ${product.kota}, ${product.provinsi}. ${specs}. Hubungi ${namaAgent} untuk info lebih lanjut.`;

  const rawGambar = product.gambar || "";
  const fotoArray =
    rawGambar.trim().length > 0
      ? rawGambar
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];
  const firstImage = fotoArray[0] || "/images/hero/banner.jpg";

  const safeSlugId =
    slugId || `${product.slug}-${product.id_property.toString()}`;
  const canonicalUrl = `https://premierasset.com/Lelang/${safeSlugId}`;

  return {
    title: `${product.judul} - ${hargaFormatted} | Premier Asset`,
    description,
    keywords: [
      product.kategori,
      product.jenis_transaksi,
      product.kota,
      product.kecamatan,
      product.provinsi,
      "properti lelang",
      "real estate",
      "Indonesia",
      namaAgent,
    ],
    openGraph: {
      type: "website",
      locale: "id_ID",
      url: canonicalUrl,
      siteName: "Premier Asset",
      title: `${product.judul} - ${hargaFormatted}`,
      description,
      images: [
        {
          url: firstImage,
          width: 1200,
          height: 630,
          alt: product.judul,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.judul} - ${hargaFormatted}`,
      description,
      images: [firstImage],
    },
    robots: {
      index: product.status_tayang === "TERSEDIA",
      follow: true,
      googleBot: {
        index: product.status_tayang === "TERSEDIA",
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

// --- PAGE ---
export default async function DetailPage({ params }: Props) {
  const { slugId, agentId } = params;

  const id = extractIdFromSlugId(slugId);
  if (!id) {
    notFound();
  }

  const product = await getProperty(id as bigint);
  if (!product) {
    notFound();
  }

  // Self-healing slugId: kalau slug berubah, tetap pertahankan agentId
  if (product.slug && product.id_property) {
    const expectedSlugId = `${product.slug}-${product.id_property.toString()}`;
    if (expectedSlugId !== slugId) {
      return redirect(`/Lelang/${expectedSlugId}/${agentId}`);
    }
  }

  // Ambil session dan cocokan dengan agentId di URL
  const session = await getServerSession(authOptions);
  const loggedInAgentId = (session?.user as any)?.agentId || null;

  const currentAgentId =
    loggedInAgentId && loggedInAgentId === agentId
      ? loggedInAgentId
      : null;

  const rawGambar = product.gambar || "";
  const fotoArray =
    rawGambar.trim().length > 0
      ? rawGambar
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];

  const finalFotoArray =
    fotoArray.length > 0 ? fotoArray : ["/images/hero/banner.jpg"];

  const similarPropertiesRaw = await getSimilarProperties(product);

  const similarProperties = similarPropertiesRaw.map((prop) => {
    const propGambar = prop.gambar || "";
    const propFotoArray =
      propGambar.trim().length > 0
        ? propGambar
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : ["/images/hero/banner.jpg"];

    const agentPhotoUrl = normalizeAgentPhoto(prop.agent?.foto_profil_url);

    return {
      ...prop,
      foto_list: propFotoArray,
      agent_photo: agentPhotoUrl,
    };
  });

  const productAgentPhoto = normalizeAgentPhoto(
    product.agent?.foto_profil_url
  );

  const productForClient = serializePrisma({
    ...product,
    agent: {
      ...product.agent,
      foto_profil_url: productAgentPhoto,
    },
  });
  const similarForClient = serializePrisma(similarProperties);

  return (
    <main className="bg-[#0F0F0F] min-h-screen text-white">
      <DetailClient
        product={productForClient}
        fotoArray={finalFotoArray}
        similarProperties={similarForClient}
        currentAgentId={currentAgentId}
      />
    </main>
  );
}

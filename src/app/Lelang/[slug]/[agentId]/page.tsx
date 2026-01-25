// app/Lelang/[slug]/[agentId]/page.tsx
import React from "react";
import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import DetailClient from "../DetailClient";

interface Props {
  params: {
    slug: string;
    agentId: string;
  };
}

// Ambil id_property (UUID v4) dari slug-id => 5 segmen terakhir
function extractIdPropertyFromSlug(slug: string): string | null {
  const parts = slug.split("-");
  if (parts.length < 5) return null;
  const uuidParts = parts.slice(-5);
  return uuidParts.join("-");
}

async function getProperty(id: string) {
  const product = await prisma.property.findUnique({
    where: { id_property: id },
    include: {
      agent: {
        select: {
          nama_kantor: true,
          rating: true,
          jumlah_closing: true,
          nomor_whatsapp: true,
          kota_area: true,
          jabatan: true,
          pengguna: {
            select: {
              nama_lengkap: true,
              foto_profil_url: true,
              nomor_telepon: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (product && product.status_tayang !== "TERSEDIA") {
    return null;
  }

  return product;
}

async function getSimilarProperties(currentProperty: any) {
  try {
    const similarProperties = await prisma.property.findMany({
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
            nama_kantor: true,
            rating: true,
            jumlah_closing: true,
            nomor_whatsapp: true,
            kota_area: true,
            jabatan: true,
            pengguna: {
              select: {
                nama_lengkap: true,
                foto_profil_url: true,
                nomor_telepon: true,
                email: true,
              },
            },
          },
        },
      },
      take: 50,
      orderBy: [
        { is_hot_deal: "desc" },
        { tanggal_dibuat: "desc" },
      ],
    });

    return similarProperties;
  } catch (error) {
    console.error("❌ Error fetching similar properties:", error);
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const idProperty = extractIdPropertyFromSlug(params.slug);
  if (!idProperty) {
    return {
      title: "Properti Tidak Ditemukan | Premier Asset",
      description: "Halaman properti yang Anda cari tidak ditemukan.",
    };
  }

  const product = await getProperty(idProperty);

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

  const canonicalUrl = `https://premierasset.com/Lelang/${params.slug}`;

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

export default async function DetailPage({ params }: Props) {
  const { slug, agentId } = params;

  const idProperty = extractIdPropertyFromSlug(slug);
  if (!idProperty) {
    notFound();
  }

  const product = await getProperty(idProperty);
  if (!product) {
    notFound();
  }

  // Self-healing slug: kalau slug berubah, tetap pertahankan agentId
  if (product.slug && product.id_property) {
    const expectedSlug = `${product.slug}-${product.id_property}`;
    if (expectedSlug !== slug) {
      return redirect(`/Lelang/${expectedSlug}/${agentId}`);
    }
  }

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

    return {
      ...prop,
      foto_list: propFotoArray,
    };
  });

  return (
    <main className="bg-[#0F0F0F] min-h-screen text-white">
      <DetailClient
        product={JSON.parse(JSON.stringify(product))}
        fotoArray={finalFotoArray}
        similarProperties={JSON.parse(
          JSON.stringify(similarProperties)
        )}
        currentAgentId={agentId} // ⬅️ kirim ke DetailClient
      />
    </main>
  );
}

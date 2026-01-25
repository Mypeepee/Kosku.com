// app/Lelang/[slug]/page.tsx
import React from "react";
import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import DetailClient from "./DetailClient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

interface ParamsShape {
  slug?: string;
}

interface Props {
  params: Promise<ParamsShape>; // ← penting: treat params as Promise
}

// Ambil id_property (UUID v4) dari slug-id => 5 segmen terakhir
function extractIdPropertyFromSlug(
  slug: string | undefined | null
): string | null {
  if (!slug) return null;
  const parts = slug.split("-");
  if (parts.length < 5) return null;
  const uuidParts = parts.slice(-5); // 8-4-4-4-12
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

// Similar properties
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
            id_agent: true,
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
      orderBy: [{ is_hot_deal: "desc" }, { tanggal_dibuat: "desc" }],
    });

    return similarProperties;
  } catch (error) {
    console.error("❌ Error fetching similar properties:", error);
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params; // ← di-await dulu

  const idProperty = extractIdPropertyFromSlug(slug);
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

  const safeSlug = slug || product.slug || "";
  const canonicalUrl = `https://premierasset.com/Lelang/${safeSlug}`;

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
  const { slug } = await params; // ← di-await

  const idProperty = extractIdPropertyFromSlug(slug);
  if (!idProperty) {
    notFound();
  }

  const product = await getProperty(idProperty!);
  if (!product) {
    notFound();
  }

  // Ambil session: kalau agent login, punya agentId
  const session = await getServerSession(authOptions);
  const currentAgentId = (session?.user as any)?.agentId || null;

  // Self-healing slug
  if (product.slug && product.id_property) {
    const expectedSlug = `${product.slug}-${product.id_property}`;

    if (expectedSlug !== slug) {
      if (currentAgentId) {
        return redirect(`/Lelang/${expectedSlug}/${currentAgentId}`);
      }
      return redirect(`/Lelang/${expectedSlug}`);
    }
  }

  // Kalau slug sudah benar dan agent sedang login → pakai /[slug]/[agentId]
  if (currentAgentId) {
    const safeSlug = slug || `${product.slug}-${product.id_property}`;
    return redirect(`/Lelang/${safeSlug}/${currentAgentId}`);
  }

  const safeSlug = slug || `${product.slug}-${product.id_property}`;
  const canonicalUrl = `https://premierasset.com/Lelang/${safeSlug}`;

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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "@id": canonicalUrl,
    url: canonicalUrl,
    name: product.judul,
    description:
      product.deskripsi ||
      `${product.kategori} ${product.jenis_transaksi} di ${product.kota}`,
    image: finalFotoArray,
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://premierasset.com",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Lelang",
        item: "https://premierasset.com/Lelang",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.kota,
        item: `https://premierasset.com/Lelang?kota=${product.kota}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: product.judul,
        item: canonicalUrl,
      },
    ],
  };

  return (
    <main className="bg-[#0F0F0F] min-h-screen text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd),
        }}
      />

      <DetailClient
        product={JSON.parse(JSON.stringify(product))}
        fotoArray={finalFotoArray}
        similarProperties={JSON.parse(JSON.stringify(similarProperties))}
        // route tanpa /[agentId] selalu dianggap visitor biasa;
        currentAgentId={null}
      />
    </main>
  );
}

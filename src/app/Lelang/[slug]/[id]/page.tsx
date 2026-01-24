import React from "react";
import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import DetailClient from "../DetailClient";

interface Props {
  params: {
    slug: string;
    id: string;
  };
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

// ⚠️ NEW: Fetch Similar Properties
async function getSimilarProperties(currentProperty: any) {
  try {
    const similarProperties = await prisma.property.findMany({
      where: {
        AND: [
          { id_property: { not: currentProperty.id_property } }, // Exclude current property
          {
            OR: [
              { kota: currentProperty.kota }, // Same city (highest priority)
              { kategori: currentProperty.kategori }, // Same category
            ],
          },
          { status_tayang: "TERSEDIA" }, // Only available properties
          { jenis_transaksi: "LELANG" }, // Only auction properties
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
      take: 50, // Max 50 for algorithm scoring
      orderBy: [
        { is_hot_deal: "desc" }, // Hot deals first
        { tanggal_dibuat: "desc" }, // Newest first
      ],
    });

    return similarProperties;
  } catch (error) {
    console.error("❌ Error fetching similar properties:", error);
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProperty(params.id);

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

  const namaAgent = product.agent?.pengguna?.nama_lengkap || "Agent Premier";

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

  // Split gambar untuk metadata
  const rawGambar = product.gambar || "";
  const fotoArray =
    rawGambar.trim().length > 0
      ? rawGambar
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];
  const firstImage = fotoArray[0] || "/images/hero/banner.jpg";

  const canonicalUrl = `https://premierasset.com/Lelang/${product.slug || "property"}/${product.id_property}`;

  return {
    title: `${product.judul} - ${hargaFormatted} | Premier Asset`,
    description: description,

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
      description: description,
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
      description: description,
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
  const product = await getProperty(params.id);

  if (!product) {
    notFound();
  }

  if (product.slug && product.slug !== params.slug) {
    redirect(`/Lelang/${product.slug}/${product.id_property}`);
  }

  const canonicalUrl = `https://premierasset.com/Lelang/${product.slug || "property"}/${product.id_property}`;

  // Split kolom gambar jadi array
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

  console.log("✅ page.tsx finalFotoArray:", finalFotoArray);

  // ⚠️ NEW: Fetch similar properties
  const similarPropertiesRaw = await getSimilarProperties(product);

  // Process similar properties (split gambar untuk each)
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

  console.log("✅ Found similar properties:", similarProperties.length);

  // JSON-LD
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

    offers: {
      "@type": "Offer",
      url: canonicalUrl,
      priceCurrency: "IDR",
      price: Number(product.harga),
      priceValidUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      itemCondition:
        product.kondisi_interior === "BARU"
          ? "https://schema.org/NewCondition"
          : "https://schema.org/UsedCondition",
      availability:
        product.status_tayang === "TERSEDIA"
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
      seller: {
        "@type": "RealEstateAgent",
        name: product.agent?.pengguna?.nama_lengkap || "Premier Asset",
        telephone:
          product.agent?.nomor_whatsapp ||
          product.agent?.pengguna?.nomor_telepon,
        email: product.agent?.pengguna?.email,
      },
    },

    address: {
      "@type": "PostalAddress",
      streetAddress: product.alamat_lengkap,
      addressLocality: product.kota,
      addressRegion: product.provinsi,
      postalCode: (product as any).kode_pos || "",
      addressCountry: "ID",
    },

    ...(product.latitude &&
      product.longitude && {
        geo: {
          "@type": "GeoCoordinates",
          latitude: product.latitude,
          longitude: product.longitude,
        },
      }),

    numberOfRooms: product.kamar_tidur || 0,
    numberOfBathroomsTotal: product.kamar_mandi || 0,

    floorSize: product.luas_bangunan
      ? {
          "@type": "QuantitativeValue",
          value: product.luas_bangunan,
          unitCode: "MTK",
          unitText: "m²",
        }
      : undefined,

    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "Luas Tanah",
        value: `${product.luas_tanah || 0} m²`,
      },
      {
        "@type": "PropertyValue",
        name: "Jumlah Lantai",
        value: product.jumlah_lantai || 1,
      },
      {
        "@type": "PropertyValue",
        name: "Sertifikat",
        value: product.legalitas || "N/A",
      },
      {
        "@type": "PropertyValue",
        name: "Daya Listrik",
        value: `${product.daya_listrik || 0} Watt`,
      },
    ].filter((prop) => prop.value && prop.value !== "N/A"),

    identifier: product.kode_properti,
    category: product.kategori,
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* ⚠️ PASS FOTO ARRAY + SIMILAR PROPERTIES KE DetailClient */}
      <DetailClient
        product={JSON.parse(JSON.stringify(product))}
        fotoArray={finalFotoArray}
        similarProperties={JSON.parse(JSON.stringify(similarProperties))}
      />
    </main>
  );
}

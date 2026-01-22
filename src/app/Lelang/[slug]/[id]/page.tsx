import React from "react";
import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import DetailClient from "../DetailClient";

// --- 1. SETUP TIPE DATA (3 PARAMS) ---
interface Props {
  params: { 
    slug: string;
    id: string;
  };
}

// --- 2. FUNCTION UNTUK AMBIL DATA ---
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

  // Filter by status
  if (product && product.status_tayang !== "TERSEDIA") {
    return null;
  }

  return product;
}

// --- 3. GENERATE METADATA SEO ---
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProperty(params.id);

  if (!product) {
    return { 
      title: "Properti Tidak Ditemukan | Premier Asset",
      description: "Halaman properti yang Anda cari tidak ditemukan."
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
  ].filter(Boolean).join(' • ');

  const description = product.deskripsi 
    ? product.deskripsi.substring(0, 155) + '...'
    : `${product.jenis_transaksi} ${product.kategori} di ${product.kota}, ${product.provinsi}. ${specs}. Hubungi ${namaAgent} untuk info lebih lanjut.`;

  // ✅ 3-SEGMENT CANONICAL URL
  const canonicalUrl = `https://premierasset.com/Jual/${product.slug || 'property'}/${product.id_property}`;

  return {
    title: `${product.judul} - ${hargaFormatted} | Premier Asset`,
    description: description,
    
    keywords: [
      product.kategori,
      product.jenis_transaksi,
      product.kota,
      product.kecamatan,
      product.provinsi,
      'properti',
      'real estate',
      'Indonesia',
      namaAgent
    ],

    openGraph: {
      type: 'website',
      locale: 'id_ID',
      url: canonicalUrl,
      siteName: 'Premier Asset',
      title: `${product.judul} - ${hargaFormatted}`,
      description: description,
      images: [
        {
          url: product.gambar_utama_url || "/images/placeholder.jpg",
          width: 1200,
          height: 630,
          alt: product.judul,
        }
      ],
    },

    twitter: {
      card: 'summary_large_image',
      title: `${product.judul} - ${hargaFormatted}`,
      description: description,
      images: [product.gambar_utama_url || "/images/placeholder.jpg"],
    },

    robots: {
      index: product.status_tayang === "TERSEDIA",
      follow: true,
      googleBot: {
        index: product.status_tayang === "TERSEDIA",
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },

    alternates: {
      canonical: canonicalUrl,
    },
  };
}

// --- 4. KOMPONEN UTAMA ---
export default async function DetailPage({ params }: Props) {
  const product = await getProperty(params.id);

  if (!product) {
    notFound(); 
  }

  // ✅ SLUG VALIDATION - Redirect if slug mismatch
  if (product.slug && product.slug !== params.slug) {
    redirect(`/Jual/${product.slug}/${product.id_property}`);
  }

  // ✅ 3-SEGMENT CANONICAL URL
  const canonicalUrl = `https://premierasset.com/Jual/${product.slug || 'property'}/${product.id_property}`;

  // JSON-LD Structured Data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "@id": canonicalUrl,
    "url": canonicalUrl,
    "name": product.judul,
    "description": product.deskripsi || `${product.kategori} ${product.jenis_transaksi} di ${product.kota}`,
    "image": product.gambar_utama_url ? [product.gambar_utama_url] : [],
    
    "offers": {
      "@type": "Offer",
      "url": canonicalUrl,
      "priceCurrency": "IDR",
      "price": Number(product.harga),
      "priceValidUntil": new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "itemCondition": product.kondisi_interior === "BARU" 
        ? "https://schema.org/NewCondition" 
        : "https://schema.org/UsedCondition",
      "availability": product.status_tayang === "TERSEDIA"
        ? "https://schema.org/InStock"
        : "https://schema.org/SoldOut",
      "seller": {
        "@type": "RealEstateAgent",
        "name": product.agent?.pengguna?.nama_lengkap || "Premier Asset",
        "telephone": product.agent?.nomor_whatsapp || product.agent?.pengguna?.nomor_telepon,
        "email": product.agent?.pengguna?.email,
      },
    },

    "address": {
      "@type": "PostalAddress",
      "streetAddress": product.alamat_lengkap,
      "addressLocality": product.kota,
      "addressRegion": product.provinsi,
      "postalCode": product.kode_pos || "",
      "addressCountry": "ID"
    },

    ...(product.latitude && product.longitude && {
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": product.latitude,
        "longitude": product.longitude
      }
    }),

    "numberOfRooms": product.kamar_tidur || 0,
    "numberOfBathroomsTotal": product.kamar_mandi || 0,
    
    "floorSize": product.luas_bangunan ? {
      "@type": "QuantitativeValue",
      "value": product.luas_bangunan,
      "unitCode": "MTK",
      "unitText": "m²"
    } : undefined,

    "additionalProperty": [
      {
        "@type": "PropertyValue",
        "name": "Luas Tanah",
        "value": `${product.luas_tanah || 0} m²`
      },
      {
        "@type": "PropertyValue",
        "name": "Jumlah Lantai",
        "value": product.jumlah_lantai || 1
      },
      {
        "@type": "PropertyValue",
        "name": "Sertifikat",
        "value": product.legalitas || "N/A"
      },
      {
        "@type": "PropertyValue",
        "name": "Daya Listrik",
        "value": `${product.daya_listrik || 0} Watt`
      }
    ].filter(prop => prop.value && prop.value !== "N/A"),

    "identifier": product.kode_properti,
    "category": product.kategori,
  };

  // Breadcrumb JSON-LD
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://premierasset.com"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Jual",
        "item": "https://premierasset.com/Jual"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": product.kota,
        "item": `https://premierasset.com/Jual?kota=${product.kota}`
      },
      {
        "@type": "ListItem",
        "position": 4,
        "name": product.judul,
        "item": canonicalUrl
      }
    ]
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

      <DetailClient product={JSON.parse(JSON.stringify(product))} />
    </main>
  );
}

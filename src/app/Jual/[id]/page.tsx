import React from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import DetailClient from "./DetailClient"; // Pastikan path import ini benar

// --- 1. SETUP TIPE DATA ---
interface Props {
  params: { id: string };
}

// --- 2. FUNCTION UNTUK AMBIL DATA (REUSABLE) ---
async function getProperty(id: string) {
  const product = await prisma.property.findUnique({
    where: { id_property: id },
    include: {
      agent: {
        include: {
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

  if (!product) return null;
  return product;
}

// --- 3. GENERATE METADATA SEO (JUDUL & DESKRIPSI OTOMATIS) ---
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProperty(params.id);

  if (!product) {
    return { title: "Properti Tidak Ditemukan | Premier" };
  }

  // Format Harga untuk Judul (biar menarik diklik)
  const hargaFormatted = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(product.harga));

  return {
    title: `${product.judul} - ${product.kota} | ${hargaFormatted}`,
    description: `Dijual ${product.kategori} di ${product.kota}. Luas Tanah: ${product.luas_tanah}m², Luas Bangunan: ${product.luas_bangunan}m². Hubungi Agen ${product.agent.pengguna.nama_lengkap}.`,
    openGraph: {
      title: product.judul,
      description: `Lihat detail properti ini. Harga: ${hargaFormatted}`,
      images: [product.gambar_utama_url || "/images/placeholder.jpg"],
    },
  };
}

// --- 4. KOMPONEN UTAMA (SERVER COMPONENT) ---
export default async function DetailPage({ params }: Props) {
  const product = await getProperty(params.id);

  if (!product) {
    notFound(); // Redirect ke halaman 404 bawaan Next.js
  }

  // --- 5. SCHEMA.ORG JSON-LD (RAHASIA SEO GOOGLE) ---
  // Ini script yang memberitahu Google: "Hei, ini adalah produk jualan properti!"
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product", // Atau 'SingleFamilyResidence'
    name: product.judul,
    image: [product.gambar_utama_url],
    description: product.deskripsi,
    sku: product.kode_properti,
    brand: {
      "@type": "Brand",
      name: "Premier Properti",
    },
    offers: {
      "@type": "Offer",
      url: `https://websiteanda.com/Jual/${product.id_property}`,
      priceCurrency: "IDR",
      price: Number(product.harga),
      itemCondition: "https://schema.org/NewCondition", // Bisa disesuaikan logic Primary/Secondary
      availability:
        product.status_tayang === "TERSEDIA"
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
      seller: {
        "@type": "Person",
        name: product.agent.pengguna.nama_lengkap,
      },
    },
  };

  return (
    <main className="bg-[#0F0F0F] min-h-screen text-white">
      {/* Inject JSON-LD untuk Google Bot */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Render Tampilan (Client Component) */}
      <DetailClient product={JSON.parse(JSON.stringify(product))} />
    </main>
  );
}
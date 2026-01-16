import React from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import DetailClient from "./DetailClient";

// --- 1. SETUP TIPE DATA ---
interface Props {
  params: { id: string };
}

// --- 2. FUNCTION UNTUK AMBIL DATA (UPDATED) ---
// Kita update query ini agar mengambil data Agent yang lengkap (Rating, Closing, Area, Kantor)
async function getProperty(id: string) {
  const product = await prisma.property.findUnique({
    where: { id_property: id },
    include: {
      agent: {
        // PENTING: Kita select kolom-kolom spesifik dari tabel AGENT
        select: {
          nama_kantor: true,
          rating: true,
          jumlah_closing: true,
          nomor_whatsapp: true,
          kota_area: true, // <--- Ini yang dipakai untuk mengganti "Terjual"
          jabatan: true,
          
          // JOIN ke tabel PENGGUNA untuk Nama & Foto
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

// --- 3. GENERATE METADATA SEO ---
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProperty(params.id);

  if (!product) {
    return { title: "Properti Tidak Ditemukan | Premier Asset" };
  }

  // Format Harga
  const hargaFormatted = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(product.harga));

  const namaAgent = product.agent?.pengguna?.nama_lengkap || "Agent Premier";

  return {
    title: `${product.judul} - ${product.kota} | ${hargaFormatted}`,
    description: `Dijual ${product.kategori} di ${product.kota}. Luas Tanah: ${product.luas_tanah}m², Luas Bangunan: ${product.luas_bangunan}m². Hubungi Agen ${namaAgent}.`,
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
    notFound(); 
  }

  // --- 5. SCHEMA.ORG JSON-LD (SEO) ---
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.judul,
    image: [product.gambar_utama_url],
    description: product.deskripsi,
    sku: product.kode_properti,
    brand: {
      "@type": "Brand",
      name: "Premier Asset",
    },
    offers: {
      "@type": "Offer",
      url: `https://premierasset.com/Jual/${product.id_property}`, // Ganti domain jika sudah live
      priceCurrency: "IDR",
      price: Number(product.harga),
      itemCondition: "https://schema.org/NewCondition",
      availability:
        product.status_tayang === "TERSEDIA"
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
      seller: {
        "@type": "Person",
        name: product.agent?.pengguna?.nama_lengkap || "Agent Premier",
      },
    },
  };

  return (
    <main className="bg-[#0F0F0F] min-h-screen text-white">
      {/* Inject JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Render Client Component */}
      {/* JSON.parse(JSON.stringify(...)) digunakan untuk menghindari warning Serialization Date object di Next.js */}
      <DetailClient product={JSON.parse(JSON.stringify(product))} />
    </main>
  );
}
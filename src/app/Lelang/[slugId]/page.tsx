// app/Lelang/[slugId]/page.tsx
import React from "react";
import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import DetailClient from "./DetailClient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

type ParamsShape = {
  slugId: string; // contoh: "rumahdigambut-32"
};

type Props = {
  params: ParamsShape;
};

// --- HELPER: extract id BigInt dari slug-id ---
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
      (_key, value) =>
        typeof value === "bigint" ? value.toString() : value // BigInt → string
    )
  );
}

// --- QUERY DETAIL ---
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
  if (product.status_tayang !== "TERSEDIA") return null;

  return product;
}

// --- QUERY SIMILAR ---
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
  const { slugId } = params;

  const id = extractIdFromSlugId(slugId);
  if (!id) {
    notFound();
  }

  const product = await getProperty(id);
  if (!product) {
    notFound();
  }

  // Ambil session: kalau agent login, punya agentId
  const session = await getServerSession(authOptions);
  const currentAgentId = (session?.user as any)?.agentId || null;

  // Self-healing slug: pastikan slug-id di URL sesuai data
  if (product.slug && product.id_property) {
    const expectedSlugId = `${product.slug}-${product.id_property.toString()}`;

    if (expectedSlugId !== slugId) {
      if (currentAgentId) {
        return redirect(`/Lelang/${expectedSlugId}/${currentAgentId}`);
      }
      return redirect(`/Lelang/${expectedSlugId}`);
    }
  }

  // Kalau slug-id sudah benar dan agent sedang login → pakai segmen agentId
  if (currentAgentId) {
    const safeSlugId =
      slugId || `${product.slug}-${product.id_property.toString()}`;
    return redirect(`/Lelang/${safeSlugId}/${currentAgentId}`);
  }

  const safeSlugId =
    slugId || `${product.slug}-${product.id_property.toString()}`;
  const canonicalUrl = `https://premierasset.com/Lelang/${safeSlugId}`;

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

  // --- SERIALIZE UNTUK CLIENT COMPONENT (hapus BigInt) ---
  const productForClient = serializePrisma(product);
  const similarForClient = serializePrisma(similarProperties);

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
        product={productForClient}
        fotoArray={finalFotoArray}
        similarProperties={similarForClient}
        currentAgentId={null}
      />
    </main>
  );
}

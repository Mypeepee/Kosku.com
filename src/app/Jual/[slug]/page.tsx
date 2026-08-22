import React from "react";
import { cache } from "react";
import { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { bacaSekitarTersimpan } from "@/lib/nearbyPlaces.server";
import DetailClient from "./DetailClient";
import { getSimilarItems } from "./lib/similar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";

interface Props {
  params: {
    slug: string; // contoh: "rumah-minimalis-di-citraland-123"
  };
}

// Ambil id_property (BigInt) dari slug-di-akhir → segmen terakhir setelah tanda "-"
function extractIdPropertyFromSlug(slugWithId: string): bigint | null {
  const parts = slugWithId.split("-");
  const last = parts[parts.length - 1];
  if (!last) return null;
  const asNumber = Number(last);
  if (Number.isNaN(asNumber)) return null;
  return BigInt(asNumber);
}

// --- HELPER GAMBAR: bikin array foto_list dari kolom gambar (CSV) ---
function buildFotoList(gambar: string | null): string[] {
  if (!gambar || gambar.trim() === "") return [];
  return gambar
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// --------- SERIALIZER ---------
function serializeListing(listing: any) {
  if (!listing) return null;

  return {
    ...listing,
    id_property: listing.id_property
      ? listing.id_property.toString()
      : null,

    harga: listing.harga != null ? Number(listing.harga) : 0,
    harga_promo:
      listing.harga_promo != null ? Number(listing.harga_promo) : null,
    nilai_limit_lelang:
      listing.nilai_limit_lelang != null
        ? Number(listing.nilai_limit_lelang)
        : null,
    uang_jaminan:
      listing.uang_jaminan != null ? Number(listing.uang_jaminan) : null,
    nilai_limit:
      listing.nilai_limit != null ? Number(listing.nilai_limit) : null,

    luas_tanah:
      listing.luas_tanah != null ? Number(listing.luas_tanah) : null,
    luas_bangunan:
      listing.luas_bangunan != null ? Number(listing.luas_bangunan) : null,

    latitude:
      listing.latitude != null ? Number(listing.latitude) : null,
    longitude:
      listing.longitude != null ? Number(listing.longitude) : null,

    tanggal_dibuat: listing.tanggal_dibuat
      ? listing.tanggal_dibuat.toISOString()
      : null,
    tanggal_diupdate: listing.tanggal_diupdate
      ? listing.tanggal_diupdate.toISOString()
      : null,
    tanggal_lelang: listing.tanggal_lelang
      ? listing.tanggal_lelang.toISOString()
      : null,

    agent: listing.agent
      ? {
          ...listing.agent,
          rating:
            listing.agent.rating != null
              ? Number(listing.agent.rating)
              : null,
          jumlah_closing:
            listing.agent.jumlah_closing != null
              ? Number(listing.agent.jumlah_closing)
              : null,
        }
      : null,
  };
}

// --------- DB HELPERS ----------
const getProperty = cache(async (id: bigint) => {
  const product = await prisma.listing.findUnique({
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
  if (product.status_tayang === "TARIK_LISTING") return null;

  return product;
});


// --------- METADATA ----------
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const idProperty = extractIdPropertyFromSlug(params.slug);
  if (!idProperty) {
    return {
      title: "Properti Tidak Ditemukan | Solusindo Aset",
      description: "Halaman properti yang Anda cari tidak ditemukan.",
    };
  }

  const product = await getProperty(idProperty);
  if (!product) {
    return {
      title: "Properti Tidak Ditemukan | Solusindo Aset",
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

  const firstImage =
    (product.gambar &&
      product.gambar.split(",").map((s) => s.trim())[0]) ||
    "/images/hero/banner.jpg";

  const canonicalUrl = `https://premierasset.com/Jual/${params.slug}`;

  return {
    title: `${product.judul} - ${hargaFormatted} | Solusindo Aset`,
    description,
    keywords: [
      product.kategori,
      product.jenis_transaksi,
      product.kota,
      product.kecamatan || "",
      product.provinsi || "",
      "jual rumah",
      "properti",
      "real estate",
      "Indonesia",
      namaAgent,
    ],
    openGraph: {
      type: "website",
      locale: "id_ID",
      url: canonicalUrl,
      siteName: "Solusindo Aset",
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

// --------- PAGE ----------
export default async function DetailPage({ params }: Props) {
  const idProperty = extractIdPropertyFromSlug(params.slug);
  if (!idProperty) {
    notFound();
  }

  const product = await getProperty(idProperty);
  if (!product) {
    notFound();
  }

  // Ambil session: kalau agent login, punya agentId
  const session = await getServerSession(authOptions);
  const currentAgentId = (session?.user as any)?.agentId || null;

  // Self-healing slug: dari DB (slug) + id_property
  if (product.slug && product.id_property) {
    const expectedSlug = `${product.slug}-${product.id_property}`;

    if (expectedSlug !== params.slug) {
      if (currentAgentId) {
        return permanentRedirect(`/Jual/${expectedSlug}/${currentAgentId}`);
      }
      return permanentRedirect(`/Jual/${expectedSlug}`);
    }
  }

  // Kalau slug sudah benar dan agent sedang login → paksa URL pakai /[slug]/[agentId]
  if (currentAgentId) {
    return permanentRedirect(`/Jual/${params.slug}/${currentAgentId}`);
  }

  const canonicalUrl = `https://premierasset.com/Jual/${params.slug}`;

  const foto_list = buildFotoList(product.gambar);
  const firstImage = foto_list[0] || "/images/hero/banner.jpg";

  const finalFotoArray = [firstImage];

  const similarItems = await getSimilarItems(product);

  // Hasil pemindaian "apa yang ada di sekitar" yang SUDAH tersimpan. Dibaca
  // sekali di server supaya aset yang pernah dipindai tampil lengkap di HTML
  // pertama — tanpa spinner dan tanpa satu pun permintaan dari browser. Aset
  // yang belum pernah dipindai mengembalikan null, dan komponennya yang
  // meminta pemindaian lewat /api/listing/{id}/sekitar.
  const sekitar = await bacaSekitarTersimpan(product.id_property);

  const serializedProduct = {
    ...serializeListing(product),
    gambar_utama_url: firstImage,
    foto_list,
  };

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
        name: "Jual",
        item: "https://premierasset.com/Jual",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.kota,
        item: `https://premierasset.com/Jual?kota=${product.kota}`,
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
    <main className="bg-[#070A11] min-h-screen text-white">
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
        product={serializedProduct as any}
        sekitar={sekitar}
        currentAgentId={null}
        similarProperties={similarItems}
      />
    </main>
  );
}

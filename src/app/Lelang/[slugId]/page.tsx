// app/Lelang/[slugId]/page.tsx
import React from "react";
import { cache } from "react";
import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import DetailClient from "./DetailClient";
import { getSimilarItems } from "@/app/Jual/[slug]/lib/similar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { SITE_URL, lelangOgImageUrl } from "@/lib/site";

// --- TYPES ---
type ParamsShape = {
  slugId: string;
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

// ✅ HELPER BARU: normalisasi gambar listing dari Google Drive ID
function normalizeListingImages(gambar: string | null | undefined): string[] {
  if (!gambar || gambar.trim() === "") {
    return ["/images/hero/banner.jpg"];
  }

  const rawImages = gambar
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (rawImages.length === 0) {
    return ["/images/hero/banner.jpg"];
  }

  return rawImages.map((img) => {
    if (
      img.startsWith("http://") ||
      img.startsWith("https://") ||
      img.startsWith("/")
    ) {
      return img;
    }

    return `https://drive.google.com/thumbnail?id=${img}&sz=w800`;
  });
}

// --- QUERY DETAIL ---
const getProperty = cache(async (id: bigint) => {
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
});

// --- METADATA ---
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slugId } = params;

  const id = extractIdFromSlugId(slugId);
  if (!id) {
    return {
      title: "Properti Tidak Ditemukan | Solusindo Aset",
      description: "Halaman properti yang Anda cari tidak ditemukan.",
    };
  }

  const product = await getProperty(id);

  if (!product) {
    return {
      title: "Properti Tidak Ditemukan | Solusindo Aset",
      description: "Halaman properti yang Anda cari tidak ditemukan.",
    };
  }

  // Lelang: harga utama ada di nilai_limit_lelang, bukan harga (yang bisa 0).
  const hargaAngka = Number(product.nilai_limit_lelang ?? product.harga ?? 0) || Number(product.harga ?? 0);
  const hargaFormatted = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(hargaAngka);

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

  // og:image disajikan lewat proxy domain sendiri (lihat /api/og/lelang/[id])
  // supaya crawler WhatsApp bisa mengambilnya — bukan langsung dari Google Drive
  // / file.lelang.go.id yang sering gagal di-fetch oleh crawler.
  const ogImage = lelangOgImageUrl(id.toString());

  const safeSlugId =
    slugId || `${product.slug}-${product.id_property.toString()}`;
  const canonicalUrl = `${SITE_URL}/Lelang/${safeSlugId}`;

  return {
    title: `${product.judul} - ${hargaFormatted} | Solusindo Aset`,
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
      siteName: "Solusindo Aset",
      title: `${product.judul} - ${hargaFormatted}`,
      description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          type: "image/jpeg",
          alt: product.judul,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.judul} - ${hargaFormatted}`,
      description,
      images: [ogImage],
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

  const session = await getServerSession(authOptions);
  const currentAgentId = (session?.user as any)?.agentId || null;
  const role = (session?.user as any)?.role || (session?.user as any)?.peran || null;
  const referralCode = (session?.user as any)?.kode_referral || null;
  const isAgentUser = Boolean(currentAgentId) || role === "AGENT";

  // Agent penyaji efektif:
  //  - agent yang login  -> dirinya sendiri (perilaku normal agent)
  //  - klien referral     -> agent perujuk (MONOPOLI Lelang). Kalau kode tak valid,
  //    halaman [agentId] otomatis fallback ke owner listing.
  //  Begitu user JADI agent, monopoli mati (dia bukan calon pembeli lagi).
  const presenterId =
    currentAgentId || (!isAgentUser && referralCode ? referralCode : null);

  if (product.slug && product.id_property) {
    const expectedSlugId = `${product.slug}-${product.id_property.toString()}`;

    if (expectedSlugId !== slugId) {
      if (presenterId) {
        return redirect(`/Lelang/${expectedSlugId}/${presenterId}`);
      }
      return redirect(`/Lelang/${expectedSlugId}`);
    }
  }

  if (presenterId) {
    const safeSlugId =
      slugId || `${product.slug}-${product.id_property.toString()}`;
    return redirect(`/Lelang/${safeSlugId}/${presenterId}`);
  }

  const safeSlugId =
    slugId || `${product.slug}-${product.id_property.toString()}`;
  const canonicalUrl = `${SITE_URL}/Lelang/${safeSlugId}`;

  // ✅ NORMALISASI GAMBAR LISTING UTAMA
  const fotoArray = normalizeListingImages(product.gambar);

  // Rekomendasi "Properti Serupa" — campuran Primary/Secondary/Lelang, di-ranking relevansi.
  const similarItems = await getSimilarItems(product);

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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "@id": canonicalUrl,
    url: canonicalUrl,
    name: product.judul,
    description:
      product.deskripsi ||
      `${product.kategori} ${product.jenis_transaksi} di ${product.kota}`,
    image: fotoArray,
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Lelang",
        item: `${SITE_URL}/Lelang`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.kota,
        item: `${SITE_URL}/Lelang?kota=${product.kota}`,
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
        fotoArray={fotoArray}
        similarProperties={similarItems}
        currentAgentId={null}
      />
    </main>
  );
}

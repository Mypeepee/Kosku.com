// app/Lelang/[slugId]/[agentId]/page.tsx
import React from "react";
import { cache } from "react";
import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { bacaSekitarTersimpan } from "@/lib/nearbyPlaces.server";
import DetailClient from "../DetailClient";
import { getSimilarItems } from "@/app/Jual/[slug]/lib/similar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { SITE_URL, lelangOgImageUrl } from "@/lib/site";
import { getAuctionHistory } from "@/lib/auctionHistory";

export const revalidate = 3600;

interface ParamsShape {
  slugId: string;
  agentId: string;
}

interface Props {
  params: ParamsShape;
}

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

function serializePrisma<T>(data: T): any {
  return JSON.parse(
    JSON.stringify(
      data,
      (_key, value) => (typeof value === "bigint" ? value.toString() : value)
    )
  );
}

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

// Resolve "Agent Penyaji" (presenter) dari kode di URL, mis. AG8.
// Hanya field publik. Jika kode tak valid / agent non-aktif -> null (fallback ke owner).
async function getPresentingAgent(agentId: string | null | undefined) {
  if (!agentId) return null;
  const code = agentId.trim();
  if (!/^AG\d+$/i.test(code)) return null;

  const agent = await prisma.agent.findFirst({
    where: { id_agent: code, status_keanggotaan: "AKTIF" },
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
        select: { nama_lengkap: true, nomor_telepon: true, email: true },
      },
    },
  });

  if (!agent) return null;

  return {
    id_agent: agent.id_agent,
    nama: agent.pengguna?.nama_lengkap || "Agent Premier",
    kantor: agent.nama_kantor || "Solusindo Aset",
    rating: agent.rating != null ? Number(agent.rating) : 5,
    jumlah_closing: agent.jumlah_closing ?? 0,
    whatsapp: agent.nomor_whatsapp || agent.pengguna?.nomor_telepon || "",
    telepon: agent.pengguna?.nomor_telepon || agent.nomor_whatsapp || "",
    kota_area: agent.kota_area || "",
    jabatan: agent.jabatan || "",
    foto_url: normalizeAgentPhoto(agent.foto_profil_url),
    email: agent.pengguna?.email || "",
  };
}

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
  if (product.status_tayang === "TARIK_LISTING") return null;

  return product;
});

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

  // og:image lewat proxy domain sendiri (lihat /api/og/lelang/[id]) — nilai
  // `gambar` mentah bisa berupa file-id Google Drive yang bukan URL valid,
  // sehingga preview WhatsApp gagal total kalau dipakai langsung.
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

  if (product.slug && product.id_property) {
    const expectedSlugId = `${product.slug}-${product.id_property.toString()}`;
    if (expectedSlugId !== slugId) {
      return redirect(`/Lelang/${expectedSlugId}/${agentId}`);
    }
  }

  // Jalankan semua query independen secara paralel.
  // Riwayat lelang sengaja diambil di server: blok ini wajib ada di HTML
  // pertama, bukan hasil fetch dari browser yang bisa gagal/terlambat.
  const [session, stoker, presentingAgent, similarItems, riwayatLelang] =
    await Promise.all([
    getServerSession(authOptions),
    prisma.agent.findFirst({
      where: { jabatan: "STOKER", status_keanggotaan: "AKTIF" },
      orderBy: { tanggal_gabung: "asc" },
      select: {
        nomor_whatsapp: true,
        pengguna: { select: { nomor_telepon: true } },
      },
    }),
    getPresentingAgent(agentId),
    getSimilarItems(product),
    // Kegagalan riwayat tidak boleh menjatuhkan seluruh halaman detail.
    getAuctionHistory(product.id_property).catch((e) => {
      console.error("❌ Gagal menyiapkan riwayat lelang untuk halaman detail:", e);
      return null;
    }),
  ]);

  const loggedInAgentId = (session?.user as any)?.agentId || null;
  const role = (session?.user as any)?.role || null;
  const jabatan = (session?.user as any)?.jabatan || null;
  const currentAgentId = loggedInAgentId;
  const stokerPhone =
    stoker?.pengguna?.nomor_telepon || stoker?.nomor_whatsapp || null;

  // selfAgent: reuse presentingAgent kalau agent yang login = agent di URL
  const selfAgent = loggedInAgentId
    ? (loggedInAgentId === agentId ? presentingAgent : await getPresentingAgent(loggedInAgentId))
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

  const productAgentPhoto = normalizeAgentPhoto(
    product.agent?.foto_profil_url
  );

  // Hasil pemindaian "apa yang ada di sekitar" yang SUDAH tersimpan. Dibaca
  // sekali di server supaya aset yang pernah dipindai tampil lengkap di HTML
  // pertama — tanpa spinner dan tanpa satu pun permintaan dari browser. Aset
  // yang belum pernah dipindai mengembalikan null, dan komponennya yang
  // meminta pemindaian lewat /api/listing/{id}/sekitar.
  const sekitar = await bacaSekitarTersimpan(product.id_property);

  const productForClient = serializePrisma({
    ...product,
    agent: {
      ...product.agent,
      foto_profil_url: productAgentPhoto,
    },
  });

  return (
    <main className="bg-[#070A11] min-h-screen text-white">
      <DetailClient
        product={productForClient}
        sekitar={sekitar}
        fotoArray={finalFotoArray}
        similarProperties={similarItems}
        currentAgentId={currentAgentId}
        currentRole={role}
        currentJabatan={jabatan}
        stokerPhone={stokerPhone}
        presentingAgent={presentingAgent}
        selfAgent={selfAgent}
        riwayatLelang={riwayatLelang}
        isLoggedIn={Boolean(session?.user)}
      />
    </main>
  );
}

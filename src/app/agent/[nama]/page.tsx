// src/app/agent/[nama]/page.tsx
import React from "react";
import { Metadata } from "next";
import prisma from "@/lib/prisma";
import AgentDetailClient from "./AgentDetailClient";
import { Icon } from "@iconify/react";

type PageProps = {
  params: { nama: string };
};

function urlToNama(urlNama: string) {
  const decoded = decodeURIComponent(urlNama);
  return decoded.replace(/-/g, " ").trim();
}

function serializePrisma<T>(data: T): any {
  return JSON.parse(
    JSON.stringify(
      data,
      (_k, v) => (typeof v === "bigint" ? v.toString() : v)
    )
  );
}

export async function generateMetadata(
  { params }: PageProps
): Promise<Metadata> {
  const namaQuery = urlToNama(params.nama);

  const agent = await prisma.agent.findFirst({
    where: {
      status_keanggotaan: "AKTIF",
      pengguna: {
        nama_lengkap: {
          contains: namaQuery,
          mode: "insensitive",
        },
      },
    },
    include: {
      pengguna: { select: { nama_lengkap: true } },
    },
  });

  const nama =
    agent?.pengguna?.nama_lengkap || agent?.nama_kantor || "Agent Premier";

  return {
    title: `${nama} | Premier Agent`,
    description: `Profil agent dan daftar listing dari ${nama} di Premier Asset.`,
  };
}

export default async function AgentDetailPage({ params }: PageProps) {
  const namaQuery = urlToNama(params.nama);

  const agent = await prisma.agent.findFirst({
    where: {
      status_keanggotaan: "AKTIF",
      pengguna: {
        nama_lengkap: {
          contains: namaQuery,
          mode: "insensitive",
        },
      },
    },
    include: {
      pengguna: {
        select: {
          nama_lengkap: true,
          email: true,
          nomor_telepon: true,
          kota_asal: true,
        },
      },
      listings: {
        where: {
          status_tayang: "TERSEDIA",
        },
        orderBy: [{ tanggal_dibuat: "desc" }],
        select: {
          id_property: true,
          judul: true,
          slug: true,
          jenis_transaksi: true,
          kategori: true,
          kota: true,
          harga: true,
          gambar: true,
        },
      },
    },
  });

  if (!agent) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-black via-[#050816] to-[#020617] text-white">
        <section className="max-w-4xl mx-auto px-4 pt-24 pb-16">
          <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-12 text-center">
            <Icon
              icon="solar:user-cross-bold-duotone"
              className="mx-auto mb-4 text-4xl text-gray-500"
            />
            <h1 className="text-xl font-bold mb-2">Agent tidak ditemukan</h1>
            <p className="text-sm text-gray-400">
              Agent yang Anda cari tidak tersedia atau sudah tidak aktif.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const nama = agent.pengguna?.nama_lengkap || agent.nama_kantor || "Agent";
  const initial = nama.trim().charAt(0).toUpperCase();
  const photoUrl = agent.foto_profil_url
    ? `https://drive.google.com/thumbnail?id=${agent.foto_profil_url}`
    : null;

  const payload = serializePrisma({
    id_agent: agent.id_agent,
    namaLengkap: nama,
    initial,
    photoUrl,
    jabatan: agent.jabatan,
    nama_kantor: agent.nama_kantor,
    kota_area: agent.kota_area,
    nomor_whatsapp: agent.nomor_whatsapp,
    // sosial media
    link_instagram: agent.link_instagram,
    link_tiktok: agent.link_tiktok,
    link_facebook: agent.link_facebook,
    pengguna: agent.pengguna,
    listings: agent.listings,
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-[#050816] to-[#020617] text-white">
      <section className="max-w-6xl mx-auto px-4 pt-24 pb-12">
        <AgentDetailClient agent={payload} />
      </section>
    </main>
  );
}

// app/Agent/page.tsx
import React from "react";
import { Metadata } from "next";
import prisma from "@/lib/prisma";
import AgentListClient from "./AgentListClient";

export const metadata: Metadata = {
  title: "Agent Premier Asset | Premier Asset",
  description:
    "Temukan agent properti profesional Premier Asset dengan keahlian area dan portofolio listing aktif di seluruh Indonesia.",
};

function serializePrisma<T>(data: T): any {
  return JSON.parse(
    JSON.stringify(
      data,
      (_k, v) => (typeof v === "bigint" ? v.toString() : v)
    )
  );
}

export default async function AgentPage() {
  // Ambil semua agent aktif + statistik listing
  const agents = await prisma.agent.findMany({
    where: {
      status_keanggotaan: "AKTIF",
    },
    include: {
      pengguna: {
        select: {
          nama_lengkap: true,
          foto_profil_url: true,
          email: true,
          nomor_telepon: true,
          kota_asal: true,
        },
      },
      listings: {
        where: {
          status_tayang: "TERSEDIA",
        },
        select: {
          jenis_transaksi: true,
        },
      },
    },
    orderBy: [{ tanggal_gabung: "asc" }],
  });

  // Hitung statistik listing per agent
  const agentsWithStats = agents.map((agent) => {
    const totalListings = agent.listings.length;
    const jualListings = agent.listings.filter((l) =>
      ["PRIMARY", "SECONDARY"].includes(l.jenis_transaksi)
    ).length;
    const sewaListings = agent.listings.filter(
      (l) => l.jenis_transaksi === "SEWA"
    ).length;

    return {
      ...agent,
      totalListings,
      jualListings,
      sewaListings,
    };
  });

  const agentsForClient = serializePrisma(agentsWithStats);

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-[#050816] to-[#020617] text-white">
      <section className="max-w-6xl mx-auto px-4 pt-20 pb-12">
        {/* HEADER SEDERHANA & FUTURISTIK */}
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 mb-4">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-200">
              Premier Agent Network
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                Jaringan Agent{" "}
                <span className="text-emerald-400">Premier</span>
              </h1>
              <p className="mt-3 text-sm md:text-base text-gray-400 max-w-xl">
                Pilih agent yang paling cocok dengan kebutuhan Anda, lengkap
                dengan area keahlian dan jumlah listing aktif.
              </p>
            </div>
          </div>
        </header>

        <AgentListClient agents={agentsForClient} />
      </section>
    </main>
  );
}

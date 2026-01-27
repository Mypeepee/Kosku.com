import React from "react";
import { Metadata } from "next";
import prisma from "@/lib/prisma";
import AgentListClient from "./AgentListClient";
import { Icon } from "@iconify/react";

export const metadata: Metadata = {
  title: "Agent Premier Asset | Premier Asset",
  description:
    "Temukan agent properti profesional Premier Asset dengan keahlian area dan portofolio listing aktif di seluruh Indonesia.",
};

// convert BigInt → string, selain itu biarkan apa adanya (Date, null, dll.)
function serializePrisma<T>(data: T): any {
  return JSON.parse(
    JSON.stringify(
      data,
      (_k, v) => (typeof v === "bigint" ? v.toString() : v)
    )
  );
}

export default async function AgentPage() {
  const agents = await prisma.agent.findMany({
    where: {
      status_keanggotaan: "AKTIF",
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
        select: {
          jenis_transaksi: true,
        },
      },
    },
    // penting: tidak ada orderBy tanggal_gabung di sini
    // orderBy: [{ tanggal_gabung: "asc" }],
  });

  const agentsWithStats = agents.map((agent) => {
    const totalListings = agent.listings.length;
    const jualListings = agent.listings.filter((l) =>
      ["PRIMARY", "SECONDARY", "LELANG"].includes(l.jenis_transaksi)
    ).length;
    const sewaListings = agent.listings.filter(
      (l) => l.jenis_transaksi === "SEWA"
    ).length;

    const nama = agent.pengguna?.nama_lengkap || agent.nama_kantor || "Agent";
    const initial = nama.trim().charAt(0).toUpperCase();

    const photoUrl = agent.foto_profil_url
      ? `https://drive.google.com/thumbnail?id=${agent.foto_profil_url}`
      : null;

    return {
      ...agent,
      totalListings,
      jualListings,
      sewaListings,
      namaLengkap: nama,
      initial,
      photoUrl,
      // tidak menyentuh agent.tanggal_gabung sama sekali
    };
  });

  const agentsForClient = serializePrisma(agentsWithStats);

  const totalAgents = agentsForClient.length as number;
  const totalListings = agentsWithStats.reduce(
    (acc, a) => acc + a.totalListings,
    0
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-[#050816] to-[#020617] text-white">
      <section className="max-w-6xl mx-auto px-4 pt-24 pb-12">
        {/* HERO + SEARCH */}
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 mb-4">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-200">
              Premier Agent Network
            </span>
          </div>

          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            {/* Kiri: title + subtext + stats */}
            <div className="max-w-xl">
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                Temukan{" "}
                <span className="text-emerald-400">Agent Terbaik</span>{" "}
                untuk Properti Anda
              </h1>
              <p className="mt-3 text-sm md:text-base text-gray-400">
                Jelajahi jaringan agent tersertifikasi Premier Asset. Lihat area
                keahlian dan portofolio listing aktif sebelum Anda menghubungi
                mereka.
              </p>

              <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center">
                    <Icon
                      icon="solar:users-group-rounded-bold-duotone"
                      className="text-emerald-400 text-lg"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">
                      Agent aktif
                    </p>
                    <p className="text-sm font-semibold text-white">
                      {totalAgents}+
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-sky-500/10 border border-sky-500/40 flex items-center justify-center">
                    <Icon
                      icon="solar:home-bold-duotone"
                      className="text-sky-400 text-lg"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">
                      Listing aktif
                    </p>
                    <p className="text-sm font-semibold text-white">
                      {totalListings}+
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Kanan: search card */}
            <div className="w-full md:w-[320px]">
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/0 to-emerald-500/10 p-4 shadow-[0_18px_60px_-24px_rgba(16,185,129,0.8)]">
                <p className="text-xs font-semibold text-gray-300 mb-2">
                  Cari agent berdasarkan nama atau kota
                </p>
                <div className="mt-1 flex items-center gap-2 rounded-xl bg-black/40 border border-white/10 px-3 py-2.5">
                  <Icon
                    icon="solar:magnifer-bold-duotone"
                    className="text-emerald-300 text-lg flex-shrink-0"
                  />
                  <input
                    type="text"
                    placeholder="Ketik nama agent atau kota..."
                    className="w-full bg-transparent text-sm text-white placeholder:text-gray-500 outline-none"
                    id="agent-search-input"
                  />
                </div>
                <p className="mt-2 text-[11px] text-gray-500 leading-snug">
                  Tip: coba ketik nama agent yang Anda kenal, atau kota seperti{" "}
                  <span className="text-emerald-300 font-semibold">
                    Surabaya
                  </span>{" "}
                  atau{" "}
                  <span className="text-emerald-300 font-semibold">
                    Jakarta
                  </span>
                  .
                </p>
              </div>
            </div>
          </div>
        </header>

        <AgentListClient agents={agentsForClient} />
      </section>
    </main>
  );
}

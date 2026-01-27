"use client";

import React, { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";

interface Pengguna {
  nama_lengkap: string | null;
  email: string | null;
  nomor_telepon: string | null;
  kota_asal: string | null;
}

interface ListingItem {
  id_property: string | number;
  judul: string;
  slug: string;
  jenis_transaksi: string; // PRIMARY | SECONDARY | LELANG | SEWA
  kategori: string;
  kota: string;
  harga: string | number;
  gambar: string | null;
}

interface AgentDetailProps {
  agent: {
    id_agent: string;
    namaLengkap: string;
    initial: string;
    photoUrl: string | null;
    jabatan: string;
    nama_kantor: string;
    kota_area: string;
    nomor_whatsapp: string;

    // opsional: kalau server sudah hitung
    jualListings?: number;
    sewaListings?: number;

    link_instagram?: string | null;
    link_tiktok?: string | null;
    link_facebook?: string | null;

    pengguna: Pengguna | null;
    listings: ListingItem[];
  };
}

const AgentAvatar: React.FC<{
  nama: string;
  initial: string;
  photoUrl: string | null;
}> = ({ nama, initial, photoUrl }) => {
  const [error, setError] = useState(false);

  if (!photoUrl || error) {
    return (
      <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-emerald-500/20 text-emerald-300 font-semibold text-4xl shadow-[0_0_30px_rgba(16,185,129,0.5)]">
        {initial}
      </div>
    );
  }

  return (
    <div className="relative h-24 w-24 rounded-[28px] bg-gradient-to-tr from-emerald-500 to-sky-500 p-[3px] shadow-[0_0_30px_rgba(16,185,129,0.7)]">
      <div className="h-full w-full overflow-hidden rounded-[26px] bg-black">
        <Image
          src={photoUrl}
          alt={nama}
          width={96}
          height={96}
          className="h-full w-full object-cover"
          onError={() => setError(true)}
        />
      </div>
    </div>
  );
};

const formatHarga = (val: number | string) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(val || 0));

const AgentDetailClient: React.FC<AgentDetailProps> = ({ agent }) => {
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const input = document.getElementById(
      "agent-listing-search-input"
    ) as HTMLInputElement | null;
    if (!input) return;

    const handler = (e: Event) => {
      const target = e.target as HTMLInputElement;
      setSearchTerm(target.value);
    };

    input.addEventListener("input", handler);
    return () => input.removeEventListener("input", handler);
  }, []);

  const filteredListings = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return agent.listings || [];

    return (agent.listings || []).filter((l) => {
      const judul = (l.judul || "").toLowerCase();
      const kota = (l.kota || "").toLowerCase();
      const kategori = (l.kategori || "").toLowerCase();
      const jenis = (l.jenis_transaksi || "").toLowerCase();
      return (
        judul.includes(term) ||
        kota.includes(term) ||
        kategori.includes(term) ||
        jenis.includes(term)
      );
    });
  }, [agent.listings, searchTerm]);

  const totalListings = agent.listings?.length ?? 0;

  // hitung jual/sewa kalau belum dikirim dari server
  const jualListings =
    agent.jualListings ??
    agent.listings.filter((l) =>
      ["PRIMARY", "SECONDARY", "LELANG"].includes(l.jenis_transaksi)
    ).length;

  const sewaListings =
    agent.sewaListings ??
    agent.listings.filter((l) => l.jenis_transaksi === "SEWA").length;

  return (
    <>
      {/* HEADER AGENT */}
      <header className="mb-10">
        <div className="rounded-[28px] border border-white/10 bg-[#020617]/95 px-5 py-5 md:px-7 md:py-6 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.9)]">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            {/* Kiri: profil & stats */}
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex items-center gap-4 md:gap-5">
                <AgentAvatar
                  nama={agent.namaLengkap}
                  initial={agent.initial}
                  photoUrl={agent.photoUrl}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                      {agent.namaLengkap}
                    </h1>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/50 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                      AGENT
                    </span>
                  </div>

                  <p className="mt-1 text-xs md:text-sm text-gray-300 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1.5">
                      <Icon
                        icon="solar:buildings-2-bold-duotone"
                        className="text-emerald-300 text-base"
                      />
                      <span>{agent.nama_kantor}</span>
                    </span>
                    <span className="hidden h-1 w-1 rounded-full bg-gray-600 md:inline-block" />
                    <span className="flex items-center gap-1.5">
                      <Icon
                        icon="solar:map-point-wave-bold"
                        className="text-sky-400 text-base"
                      />
                      <span>{agent.kota_area}</span>
                    </span>
                  </p>

                  {agent.pengguna?.kota_asal && (
                    <p className="mt-1 text-[11px] text-gray-400">
                      Domisili pengguna:{" "}
                      <span className="text-gray-200">
                        {agent.pengguna.kota_asal}
                      </span>
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                        {jualListings}
                      </span>
                      <span className="text-emerald-100 font-semibold">
                        Listing jual
                      </span>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold">
                        {sewaListings}
                      </span>
                      <span className="text-sky-100 font-semibold">
                        Listing sewa
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sosmed + kontak */}
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                {/* Sosmed */}
                <div className="flex flex-wrap gap-3">
                  {agent.link_instagram && (
                    <a
                      href={agent.link_instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-[12px] font-semibold text-gray-100 border border-white/10 hover:bg-white/10"
                    >
                      <Icon
                        icon="mdi:instagram"
                        className="text-pink-400 text-base"
                      />
                      <span>Instagram</span>
                    </a>
                  )}
                  {agent.link_facebook && (
                    <a
                      href={agent.link_facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-[12px] font-semibold text-gray-100 border border-white/10 hover:bg-white/10"
                    >
                      <Icon
                        icon="mdi:facebook"
                        className="text-sky-500 text-base"
                      />
                      <span>Facebook</span>
                    </a>
                  )}
                  {agent.link_tiktok && (
                    <a
                      href={agent.link_tiktok}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-[12px] font-semibold text-gray-100 border border-white/10 hover:bg-white/10"
                    >
                      <Icon
                        icon="ic:baseline-tiktok"
                        className="text-white text-base"
                      />
                      <span>TikTok</span>
                    </a>
                  )}
                </div>

                {/* WhatsApp + email */}
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                  <a
                    href={`https://wa.me/${agent.nomor_whatsapp.replace(
                      /\D/g,
                      ""
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-[12px] font-bold text-black shadow-[0_18px_50px_-18px_rgba(16,185,129,0.9)] hover:bg-emerald-400 transition-transform active:scale-95"
                  >
                    <Icon
                      icon="logos:whatsapp-icon"
                      className="text-lg"
                    />
                    <span>Chat WhatsApp</span>
                  </a>
                  {agent.pengguna?.email && (
                    <a
                      href={`mailto:${agent.pengguna.email}`}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-white/5 px-4 py-2.5 text-[12px] font-semibold text-gray-100 border border-white/10 hover:bg-white/10"
                    >
                      <Icon
                        icon="solar:letter-bold-duotone"
                        className="text-sm text-emerald-300"
                      />
                      <span>{agent.pengguna.email}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Kanan: search listing milik agent */}
            <div className="w-full md:w-[320px]">
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/0 to-emerald-500/10 p-4 shadow-[0_18px_60px_-24px_rgba(16,185,129,0.8)]">
                <p className="text-xs font-semibold text-gray-300 mb-2">
                  Cari listing milik agent ini
                </p>
                <div className="mt-1 flex items-center gap-2 rounded-xl bg-black/40 border border-white/10 px-3 py-2.5">
                  <Icon
                    icon="solar:magnifer-bold-duotone"
                    className="text-emerald-300 text-lg flex-shrink-0"
                  />
                  <input
                    id="agent-listing-search-input"
                    type="text"
                    placeholder="Cari judul, kota, atau tipe..."
                    className="w-full bg-transparent text-sm text-white placeholder:text-gray-500 outline-none"
                  />
                </div>
                <p className="mt-2 text-[11px] text-gray-500 leading-snug">
                  Menampilkan {filteredListings.length} dari {totalListings}{" "}
                  listing aktif.
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* LISTING CARDS */}
      {filteredListings.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-emerald-500/40 bg-emerald-500/5 px-6 py-10 text-center">
          <Icon
            icon="solar:home-smile-angle-bold-duotone"
            className="mx-auto mb-3 text-3xl text-emerald-300"
          />
          <h2 className="text-base md:text-lg font-bold text-white mb-1">
            Tidak ada listing ditemukan
          </h2>
          <p className="text-xs md:text-sm text-emerald-100">
            Coba gunakan kata kunci lain atau hapus pencarian untuk melihat
            semua listing agent ini.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.map((listing) => (
            <Link
              key={listing.id_property}
              href={`/property/${listing.slug}`}
              className="group relative bg-[#050816] border border-white/10 rounded-3xl overflow-hidden shadow-[0_18px_60px_-20px_rgba(15,23,42,0.9)] hover:shadow-[0_22px_80px_-24px_rgba(16,185,129,0.8)] transition-all duration-300 hover:-translate-y-1"
            >
              <div className="relative h-40 w-full overflow-hidden">
                {listing.gambar ? (
                  <Image
                    src={listing.gambar}
                    alt={listing.judul}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-slate-900 text-gray-500 text-xs">
                    Tidak ada gambar
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute top-2 left-2 flex gap-2">
                  <span className="px-2 py-[2px] rounded-full text-[10px] font-semibold uppercase tracking-wide bg-black/70 text-emerald-300 border border-emerald-400/40">
                    {listing.jenis_transaksi}
                  </span>
                  <span className="px-2 py-[2px] rounded-full text-[10px] font-semibold uppercase tracking-wide bg-black/70 text-sky-300 border border-sky-400/40">
                    {listing.kategori}
                  </span>
                </div>
              </div>

              <div className="p-4 flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-white line-clamp-2">
                  {listing.judul}
                </h3>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <Icon
                    icon="solar:map-point-wave-bold"
                    className="text-sky-400 text-sm"
                  />
                  <span className="truncate">{listing.kota}</span>
                </p>
                <p className="text-sm font-bold text-emerald-300 mt-1">
                  {formatHarga(listing.harga)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
};

export default AgentDetailClient;

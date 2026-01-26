"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";

interface AgentUser {
  nama_lengkap: string | null;
  foto_profil_url: string | null;
  email: string | null;
  nomor_telepon: string | null;
  kota_asal: string | null;
}

interface AgentItem {
  id_agent: string;
  id_pengguna: string;
  nama_kantor: string;
  kota_area: string;
  jabatan: string;
  rating: string | number;
  nomor_whatsapp: string;
  status_keanggotaan: string;
  tanggal_gabung: string;

  totalListings: number;
  jualListings: number;
  sewaListings: number;

  pengguna: AgentUser | null;
}

interface AgentListClientProps {
  agents: AgentItem[];
}

const AgentCard: React.FC<{ agent: AgentItem }> = ({ agent }) => {
  const name = agent.pengguna?.nama_lengkap || "Agent Premier";
  const avatar =
    agent.pengguna?.foto_profil_url || "/images/user/user-01.png";

  const rating =
    typeof agent.rating === "string"
      ? parseFloat(agent.rating)
      : agent.rating || 0;

  const kota =
    agent.kota_area || agent.pengguna?.kota_asal || "Area strategis";

  const profileUrl = `/Agent/${agent.id_agent}`;

  return (
    <div className="group relative bg-[#050816] border border-emerald-400/60 rounded-3xl overflow-hidden shadow-[0_18px_60px_-20px_rgba(16,185,129,0.6)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_80px_-24px_rgba(16,185,129,0.9)]">
      {/* Glow aktif dari awal */}
      <div className="pointer-events-none absolute inset-0 opacity-100">
        <div className="absolute -inset-px bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.25),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.2),_transparent_55%)]" />
      </div>

      {/* Extra glow on hover */}
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.35),_transparent_55%)]" />
      </div>

      {/* Content */}
      <div className="relative p-5 flex flex-col gap-4">
        {/* Top: avatar + basic info */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-sky-500 p-[2px] shadow-[0_0_25px_rgba(16,185,129,0.5)] group-hover:shadow-[0_0_35px_rgba(16,185,129,0.9)] transition-shadow">
              <div className="w-full h-full rounded-2xl overflow-hidden bg-black">
                <Image
                  src={avatar}
                  alt={name}
                  width={56}
                  height={56}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <span className="absolute -bottom-1 -right-1 inline-flex items-center gap-1 px-2 py-[2px] rounded-full bg-black/80 border border-emerald-400/60">
              <Icon
                icon="solar:star-bold-duotone"
                className="text-xs text-amber-300"
              />
              <span className="text-[10px] font-semibold text-emerald-100">
                {rating.toFixed(1)}
              </span>
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-white truncate">
                {name}
              </h3>
              <span className="px-2 py-[2px] rounded-full text-[10px] font-semibold tracking-wide uppercase bg-emerald-500/10 border border-emerald-400/40 text-emerald-200">
                {agent.jabatan}
              </span>
            </div>
            <p className="text-xs text-gray-300 flex items-center gap-1">
              <Icon
                icon="solar:buildings-2-bold-duotone"
                className="text-emerald-300 text-sm"
              />
              <span className="truncate">{agent.nama_kantor}</span>
            </p>
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
              <Icon
                icon="solar:map-point-wave-bold"
                className="text-sky-400 text-sm"
              />
              <span className="truncate">{kota}</span>
            </p>
          </div>
        </div>

        {/* Middle: public stats (listing) */}
        <div className="grid grid-cols-3 gap-2 mt-2 text-center text-[11px]">
          <div className="bg-white/5 rounded-xl py-2 px-1 border border-white/5">
            <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">
              Listing Aktif
            </p>
            <p className="text-xs font-bold text-white">
              {agent.totalListings}
            </p>
          </div>
          <div className="bg-white/5 rounded-xl py-2 px-1 border border-white/5">
            <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">
              Jual
            </p>
            <p className="text-xs font-bold text-emerald-300">
              {agent.jualListings}
            </p>
          </div>
          <div className="bg-white/5 rounded-xl py-2 px-1 border border-white/5">
            <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">
              Sewa
            </p>
            <p className="text-xs font-bold text-sky-300">
              {agent.sewaListings}
            </p>
          </div>
        </div>

        {/* Bottom: actions */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <Link
            href={profileUrl}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-200 group-hover:text-emerald-300 transition-colors"
          >
            <span>Detail profil</span>
            <Icon
              icon="solar:arrow-right-up-bold-duotone"
              className="text-sm"
            />
          </Link>

          <a
            href={`https://wa.me/${agent.nomor_whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-bold shadow-[0_10px_30px_rgba(16,185,129,0.6)] transition-transform active:scale-95"
          >
            <Icon
              icon="logos:whatsapp-icon"
              className="text-base"
            />
            <span>Chat WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  );
};

const AgentListClient: React.FC<AgentListClientProps> = ({ agents }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const totalPages = Math.max(1, Math.ceil((agents?.length || 0) / pageSize));

  const pagedAgents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return agents.slice(start, start + pageSize);
  }, [agents, currentPage]);

  if (!agents || agents.length === 0) {
    return (
      <div className="mt-10 text-center py-16 rounded-3xl border border-white/5 bg-white/5">
        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
          <Icon
            icon="solar:user-cross-bold-duotone"
            className="text-3xl text-gray-500"
          />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">
          Belum Ada Agent Aktif
        </h2>
        <p className="text-sm text-gray-400 max-w-md mx-auto">
          Saat ini belum ada agent yang tampil. Silakan kembali beberapa saat
          lagi atau hubungi tim Premier Asset.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* GRID: 3 kolom di desktop */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {pagedAgents.map((agent) => (
          <AgentCard key={agent.id_agent} agent={agent} />
        ))}
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="mt-10 flex justify-center">
          <nav className="flex items-center gap-2 bg-[#050816] p-2 rounded-full border border-white/10 shadow-2xl">
            <button
              onClick={() =>
                setCurrentPage((prev) => Math.max(1, prev - 1))
              }
              disabled={currentPage === 1}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all text-xs"
            >
              <Icon icon="solar:alt-arrow-left-linear" className="text-lg" />
            </button>

            {Array.from({ length: totalPages }).map((_, idx) => {
              const pageNum = idx + 1;
              const isActive = currentPage === pageNum;

              if (
                totalPages > 7 &&
                Math.abs(currentPage - pageNum) > 2 &&
                pageNum !== 1 &&
                pageNum !== totalPages
              ) {
                if (Math.abs(currentPage - pageNum) === 3)
                  return (
                    <span
                      key={pageNum}
                      className="text-gray-500 px-1 text-xs"
                    >
                      …
                    </span>
                  );
                return null;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-9 h-9 rounded-full font-bold text-[11px] transition-all duration-300 ${
                    isActive
                      ? "bg-emerald-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.6)] scale-110"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage === totalPages}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all text-xs"
            >
              <Icon
                icon="solar:alt-arrow-right-linear"
                className="text-lg"
              />
            </button>
          </nav>
        </div>
      )}
    </>
  );
};

export default AgentListClient;

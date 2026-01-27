"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";

// ===================
// Helper: Google Drive photo
// ===================
const buildDriveImageUrl = (idOrUrl?: string | null) => {
  if (!idOrUrl) return null;

  // kalau simpan ID saja
  if (!idOrUrl.includes("http")) {
    return `https://drive.google.com/uc?export=view&id=${idOrUrl}`;
  }

  // kalau simpan full URL share
  try {
    const url = new URL(idOrUrl);
    const idFromQuery = url.searchParams.get("id");
    if (idFromQuery) {
      return `https://drive.google.com/uc?export=view&id=${idFromQuery}`;
    }

    const match = url.pathname.match(/\/d\/([^/]+)/);
    if (match?.[1]) {
      return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
  } catch {
    // ignore
  }

  return null;
};

// ===================
// Stat Card
// ===================
const StatCard = ({ icon, imageSrc, label, value, colorClass }: any) => (
  <div className="flex items-center gap-4 p-5 rounded-2xl bg-[#181818] border border-white/5 hover:border-[#86efac]/30 transition-all group">
    <div
      className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl bg-white/5 ${colorClass} group-hover:scale-110 transition-transform relative overflow-hidden`}
    >
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt={label}
          width={32}
          height={32}
          className="object-contain"
        />
      ) : (
        <Icon icon={icon} />
      )}
    </div>
    <div>
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
        {label}
      </p>
      <p className="text-xl font-bold text-white mt-1">{value}</p>
    </div>
  </div>
);

// ===================
// Badge status_akun (tabel pengguna)
// ===================
const StatusBadge = ({ status }: { status: string }) => {
  const map: any = {
    AKTIF: {
      label: "Akun Aktif",
      className:
        "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      icon: "solar:verified-check-bold",
    },
    NONAKTIF: {
      label: "Akun Nonaktif",
      className: "bg-gray-500/10 text-gray-300 border-gray-500/20",
      icon: "solar:sleeping-bold",
    },
    DIBEKUKAN: {
      label: "Akun Dibekukan",
      className: "bg-red-500/10 text-red-400 border-red-500/20",
      icon: "solar:danger-triangle-bold",
    },
  };

  const cfg = map[status] ?? map.AKTIF;

  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold border ${cfg.className}`}
    >
      <Icon icon={cfg.icon} /> {cfg.label}
    </span>
  );
};

// ===================
// Badge status keanggotaan agent (status_agent_enum)
// ===================
const AgentMembershipBadge = ({ status }: { status?: string }) => {
  if (!status) return null;

  const map: any = {
    PENDING: {
      label: "Agent Pending",
      className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
      icon: "solar:clock-circle-bold",
    },
    AKTIF: {
      label: "Agent Aktif",
      className:
        "bg-sky-500/10 text-sky-400 border-sky-500/30",
      icon: "solar:shield-star-bold",
    },
    SUSPEND: {
      label: "Agent Suspend",
      className: "bg-red-500/10 text-red-400 border-red-500/30",
      icon: "solar:forbidden-bold",
    },
  };

  const cfg = map[status] ?? map.PENDING;

  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold border ${cfg.className}`}
    >
      <Icon icon={cfg.icon} /> {cfg.label}
    </span>
  );
};

// ===================
// Avatar + overlay edit (desktop) + teks kecil (mobile)
// ===================
const ProfileAvatar = ({
  user,
  agent,
  isAgent,
  onEditPhoto,
}: {
  user: any;
  agent: any | null;
  isAgent: boolean;
  onEditPhoto?: () => void;
}) => {
  const [imgError, setImgError] = useState(false);

  const name: string = user?.nama_lengkap || "Pengguna Baru";
  const initial = name
    .split(" ")
    .map((n: string) => n.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  let photoUrl: string | null = null;

  if (isAgent && agent?.foto_profil_url) {
    photoUrl = buildDriveImageUrl(agent.foto_profil_url);
  } else if (user?.foto_profil_url) {
    photoUrl = user.foto_profil_url;
  }

  const showFallback = !photoUrl || imgError;

  const rawRating =
    typeof agent?.rating === "string"
      ? parseFloat(agent.rating) || 0
      : agent?.rating || 0;

  return (
    <div className="flex flex-col items-center sm:items-start gap-2">
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0">
        <button
          type="button"
          onClick={onEditPhoto}
          className="group w-full h-full rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#181818]"
        >
          {/* Lingkaran foto */}
          {showFallback ? (
            <div className="w-full h-full rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 flex items-center justify-center font-semibold text-xl">
              {initial}
            </div>
          ) : (
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-emerald-500 to-sky-500 p-[2px] shadow-[0_0_25px_rgba(16,185,129,0.5)]">
              <div className="w-full h-full rounded-full overflow-hidden bg-black relative">
                <Image
                  src={photoUrl}
                  alt={name}
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />

                {/* Overlay edit hanya di atas foto */}
                {onEditPhoto && (
                  <div className="hidden sm:flex absolute inset-0 items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex flex-col items-center gap-1 text-[10px] text-gray-100">
                      <Icon icon="solar:camera-bold" className="text-base" />
                      <span>Ubah foto</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </button>

        {/* Badge rating di luar lingkaran, di atas overlay */}
        {isAgent && (
          <span className="pointer-events-none absolute -bottom-1 -right-1 z-10 inline-flex items-center gap-1 px-2 py-[2px] rounded-full bg-black/80 border border-emerald-400/60">
            <Icon
              icon="solar:star-bold-duotone"
              className="text-xs text-amber-300"
            />
            <span className="text-[10px] font-semibold text-emerald-100">
              {rawRating.toFixed(1)}
            </span>
          </span>
        )}
      </div>

      {/* Teks kecil di mobile (tap) */}
      {onEditPhoto && (
        <button
          type="button"
          onClick={onEditPhoto}
          className="sm:hidden inline-flex items-center gap-1 text-[11px] text-emerald-300 hover:text-emerald-200 transition-colors"
        >
          <Icon icon="solar:camera-bold" className="text-xs" />
          <span>Ubah foto</span>
        </button>
      )}
    </div>
  );
};

// ===================
// Stats
// ===================
const ProfileStatsUser = ({ stats }: any) => (
  <div className="grid grid-cols-3 gap-3 flex-[1.5]">
    <StatCard
      icon="solar:heart-bold"
      label="Properti Favorit"
      value={stats?.totalWishlist ?? 0}
      colorClass="text-pink-400"
    />
    <StatCard
      icon="solar:bill-check-bold"
      label="Riwayat Transaksi"
      value={stats?.totalTransaksi ?? 0}
      colorClass="text-[#86efac]"
    />
    <StatCard
      icon="solar:user-plus-bold"
      label="Referral Aktif"
      value={stats?.totalReferral ?? 0}
      colorClass="text-sky-400"
    />
  </div>
);

const ProfileStatsAgent = ({ stats }: any) => (
  <div className="grid grid-cols-3 gap-3 flex-[1.5]">
    <StatCard
      imageSrc="/images/logo/PremierPoints.png"
      label="Premier Poin"
      value={stats?.premierPoin ?? 0}
      colorClass="text-yellow-400"
    />
    <StatCard
      icon="solar:buildings-3-bold"
      label="Listing Aktif"
      value={stats?.listingAktif ?? 0}
      colorClass="text-sky-400"
    />
    <StatCard
      icon="solar:bill-check-bold"
      label="Transaksi Berhasil"
      value={stats?.transaksiBerhasil ?? 0}
      colorClass="text-[#86efac]"
    />
  </div>
);

// ===================
// Props & Komponen Utama
// ===================
type Props = {
  user: any; // dari tabel pengguna
  agent?: any; // dari tabel agent (optional)
  statsUser?: {
    totalWishlist?: number;
    totalTransaksi?: number;
    totalReferral?: number;
  };
  statsAgent?: {
    premierPoin?: number;
    listingAktif?: number;
    transaksiBerhasil?: number;
  };
  onEditPhoto?: () => void;
};

const ProfileHeader = ({
  user,
  agent,
  statsUser,
  statsAgent,
  onEditPhoto,
}: Props) => {
  const isAgent = user?.peran === "AGENT";

  return (
    <div className="flex flex-col md:flex-row gap-6 md:gap-8 mb-8 md:mb-10">
      {/* Avatar & Identitas */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 flex-1 bg-[#181818] p-6 rounded-2xl border border-white/5 text-center sm:text-left">
        {/* Avatar + Edit */}
        <ProfileAvatar
          user={user}
          agent={agent || null}
          isAgent={isAgent}
          onEditPhoto={onEditPhoto}
        />

        {/* Info */}
        <div className="w-full">
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
            {user?.nama_lengkap || "Pengguna Baru"}
          </h1>

          {/* Baris email */}
          <div className="flex items-center justify-center sm:justify-start gap-1 text-sm text-gray-400">
            <Icon icon="solar:letter-bold" />
            <span>{user?.email || "-"}</span>
          </div>

          {/* Baris kantor (kalau agent) */}
          {isAgent && agent?.nama_kantor && (
            <div className="mt-1 flex items-center justify-center sm:justify-start gap-1 text-xs text-gray-400">
              <Icon icon="solar:buildings-2-bold-duotone" />
              <span>{agent.nama_kantor}</span>
            </div>
          )}

          {/* Badges status akun + status keanggotaan agent (jika agent) */}
          <div className="mt-3 flex gap-2 justify-center sm:justify-start flex-wrap">
            <StatusBadge status={user?.status_akun || "AKTIF"} />
            {isAgent && (
              <AgentMembershipBadge status={agent?.status_keanggotaan} />
            )}
          </div>
        </div>
      </div>

      {/* Statistik Grid */}
      {isAgent ? (
        <ProfileStatsAgent stats={statsAgent} />
      ) : (
        <ProfileStatsUser stats={statsUser} />
      )}
    </div>
  );
};

export default ProfileHeader;

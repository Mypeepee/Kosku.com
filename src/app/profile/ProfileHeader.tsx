"use client";

import React from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";

// Komponen Kecil StatCard (Updated: Support Custom Image)
const StatCard = ({ icon, imageSrc, label, value, colorClass }: any) => (
  <div className="flex items-center gap-4 p-5 rounded-2xl bg-[#181818] border border-white/5 hover:border-[#86efac]/30 transition-all group">
    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl bg-white/5 ${colorClass} group-hover:scale-110 transition-transform relative overflow-hidden`}>
      {/* Jika ada imageSrc, pakai Gambar. Jika tidak, pakai Iconify */}
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
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-white mt-1">{value}</p>
    </div>
  </div>
);

type Props = {
  user: any;
};

const ProfileHeader = ({ user }: Props) => {
  return (
    <div className="flex flex-col md:flex-row gap-6 md:gap-8 mb-8 md:mb-10">
      {/* Avatar & Identitas */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 flex-1 bg-[#181818] p-6 rounded-2xl border border-white/5 text-center sm:text-left">
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0">
          <div className="w-full h-full rounded-full border-2 border-[#86efac] overflow-hidden relative">
            {user.foto_profil_url ? (
              <Image src={user.foto_profil_url} alt="Profile" fill className="object-cover" />
            ) : (
              <div className="w-full h-full bg-[#222] flex items-center justify-center text-gray-500">
                <Icon icon="solar:user-bold" className="text-4xl" />
              </div>
            )}
          </div>
          {/* Tombol Kamera dihapus agar tidak dikira bisa diedit */}
        </div>

        <div className="w-full">
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
            {user.nama_lengkap || "Pengguna Baru"}
          </h1>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-1 sm:gap-3 text-sm text-gray-400 mb-3 justify-center sm:justify-start">
            <span className="flex items-center gap-1">
              <Icon icon="solar:letter-bold" /> {user.email || "-"}
            </span>
          </div>

          <div className="flex gap-2 justify-center sm:justify-start">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#86efac]/10 text-[#86efac] text-[10px] sm:text-xs font-bold border border-[#86efac]/20">
              <Icon icon="solar:verified-check-bold" /> Akun Aktif
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-[10px] sm:text-xs font-bold border border-yellow-500/20">
              <Icon icon="solar:star-bold" /> Member
            </span>
          </div>
        </div>
      </div>

      {/* Statistik Grid */}
      <div className="grid grid-cols-3 gap-3 flex-[1.5]">
        {/* 1. Kosku Poin (Custom Image) */}
        <StatCard 
          imageSrc="/images/logo/koskupoint.png" // Pastikan file gambar ada di folder public/images/logo/
          label="Kosku Poin" 
          value="0" 
          colorClass="text-yellow-400" 
        />
        
        {/* 2. Sewa */}
        <StatCard 
          icon="solar:bill-check-bold" 
          label="Sewa" 
          value="0" 
          colorClass="text-[#86efac]" 
        />
        
        {/* 3. Wishlist (Ganti dari Like) */}
        <StatCard 
          icon="solar:heart-bold" 
          label="Wishlist" 
          value="0" 
          colorClass="text-pink-400" 
        />
      </div>
    </div>
  );
};

export default ProfileHeader;
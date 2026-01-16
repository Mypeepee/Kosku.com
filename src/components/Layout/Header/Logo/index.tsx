"use client";
import Image from "next/image";
import Link from "next/link";

const Logo: React.FC = () => {
  return (
    // PERUBAHAN DISINI: Tambahkan 'hidden lg:flex'
    // hidden = Hilang di semua layar (mobile/tablet)
    // lg:flex = Muncul kembali (sebagai flex) hanya di layar besar (Desktop)
    <Link href="/" className="hidden lg:flex items-center gap-2">
      
      {/* Gambar Logo */}
      <Image
        src="/images/logo/logopremier.svg"
        alt="Logo Premier"
        width={40}
        height={40}
        className="w-10 h-10 object-contain"
      />

      {/* Teks Logo: PREMIER (Putih) ASSET (Hijau Tombol) */}
      <span className="text-2xl font-bold tracking-tight">
        <span className="text-white">Premier</span>
        <span className="text-[#86efac] ml-1">Asset</span>
      </span>
    </Link>
  );
};

export default Logo;
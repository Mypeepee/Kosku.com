"use client";
import Image from "next/image";
import Link from "next/link";

const Logo: React.FC = () => {
  return (
    <Link href="/" className="flex items-center gap-2">
      {/* Gambar Logo */}
      <Image
        src="/images/logo/logokosku.svg" // Jangan lupa ganti ini dengan file logo Premier jika sudah ada
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
"use client";
import Image from "next/image";
import Link from "next/link";
// Hapus import yang tidak perlu

const Logo: React.FC = () => {
  return (
    <Link href="/" className="flex items-center gap-2">
      {/* Gambar Logo */}
      <Image
        src="/images/logo/logokosku.svg" 
        alt="Logo Kosku"
        width={40}
        height={40}
        className="w-10 h-10 object-contain"
      />

      {/* Teks Logo */}
      <span className="text-2xl font-bold text-white tracking-tight">
        Kos<span className="text-primary">ku</span>.com
      </span>
    </Link>
  );
};

export default Logo;
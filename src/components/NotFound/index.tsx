"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";

export default function NotFound() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth - 0.5) * 20,
        y: (e.clientY / window.innerHeight - 0.5) * 20,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const quickLinks = [
    { icon: "solar:home-2-bold-duotone", label: "Beranda", href: "/" },
    { icon: "solar:sale-bold-duotone", label: "Properti Dijual", href: "/Jual" },
    { icon: "solar:key-bold-duotone", label: "Properti Disewa", href: "/Sewa" },
    { icon: "solar:chat-round-dots-bold-duotone", label: "Kontak Kami", href: "/contact" },
  ];

  return (
    // ✅ FIXED: Absolute positioning to cover everything including navbar
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-[#0F0F0F] via-[#1A1A1A] to-[#0F0F0F] overflow-auto">
      
      {/* Animated Background Grid */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" 
          style={{
            backgroundImage: `
              linear-gradient(rgba(134, 239, 172, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(134, 239, 172, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            transform: `translate(${mousePosition.x * 0.5}px, ${mousePosition.y * 0.5}px)`,
            transition: 'transform 0.1s ease-out'
          }}
        />
      </div>

      {/* Gradient Orbs */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" 
        style={{
          transform: `translate(${mousePosition.x * 2}px, ${mousePosition.y * 2}px)`,
          transition: 'transform 0.3s ease-out'
        }}
      />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" 
        style={{
          animationDelay: '700ms',
          transform: `translate(${-mousePosition.x * 1.5}px, ${-mousePosition.y * 1.5}px)`,
          transition: 'transform 0.3s ease-out'
        }}
      />

      {/* Main Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12 min-h-screen flex flex-col justify-center text-center">
        
        {/* 404 Number - Interactive */}
        <div className="relative mb-8">
          <h1 
            className="text-[12rem] md:text-[18rem] font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600 leading-none select-none"
            style={{
              transform: `translate(${mousePosition.x * 0.3}px, ${mousePosition.y * 0.3}px)`,
              transition: 'transform 0.2s ease-out',
              textShadow: '0 0 80px rgba(134, 239, 172, 0.3)'
            }}
          >
            404
          </h1>
          
          {/* Floating Icons */}
          <div className="absolute inset-0 pointer-events-none">
            <Icon 
              icon="solar:home-smile-bold-duotone" 
              className="absolute top-10 left-1/4 text-emerald-400/40 text-6xl animate-bounce"
              style={{ animationDelay: '0s', animationDuration: '3s' }}
            />
            <Icon 
              icon="solar:map-point-wave-bold-duotone" 
              className="absolute bottom-10 right-1/4 text-blue-400/40 text-5xl animate-bounce"
              style={{ animationDelay: '1s', animationDuration: '4s' }}
            />
            <Icon 
              icon="solar:sad-circle-bold-duotone" 
              className="absolute top-1/2 right-10 text-gray-400/30 text-7xl animate-pulse"
            />
          </div>
        </div>

        {/* Error Message */}
        <div className="mb-8 space-y-3">
          <h2 className="text-3xl md:text-4xl font-bold text-white flex items-center justify-center gap-3">
            <Icon icon="solar:danger-circle-bold-duotone" className="text-yellow-400 text-4xl" />
            Halaman Tidak Ditemukan
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Maaf, halaman yang Anda cari mungkin telah dipindahkan, dihapus, atau tidak pernah ada. 
            Jangan khawatir, kami siap membantu Anda menemukan jalan kembali! 🏡
          </p>
        </div>

        {/* Quick Actions */}
        <div className="mb-12">
          <Link
            href="/"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="group inline-flex items-center gap-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold px-8 py-4 rounded-full transition-all duration-300 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105 active:scale-95"
          >
            <Icon icon="solar:home-2-bold-duotone" className="text-2xl group-hover:rotate-12 transition-transform" />
            <span className="text-lg">Kembali ke Beranda</span>
            <Icon 
              icon="solar:arrow-right-linear" 
              className={`text-xl transition-transform ${isHovered ? 'translate-x-1' : ''}`} 
            />
          </Link>
        </div>

        {/* Quick Links Grid */}
        <div className="mb-10">
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-6">
            Atau Coba Halaman Populer Ini
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {quickLinks.map((link, index) => (
              <Link
                key={index}
                href={link.href}
                className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/50 rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/20"
              >
                <Icon 
                  icon={link.icon} 
                  className="text-4xl text-emerald-400 mb-3 mx-auto group-hover:scale-110 transition-transform" 
                />
                <p className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">
                  {link.label}
                </p>
              </Link>
            ))}
          </div>
        </div>

        {/* Search Alternative */}
        <div className="max-w-xl mx-auto">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Icon icon="solar:magnifer-bold-duotone" className="text-emerald-400 text-2xl" />
              <h3 className="text-white font-bold text-lg">Cari Properti Impian?</h3>
            </div>
            <p className="text-gray-400 text-sm mb-5">
              Gunakan pencarian untuk menemukan properti yang sesuai dengan kebutuhan Anda
            </p>
            <Link 
              href="/Jual"
              className="w-full inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-6 py-3 rounded-xl transition-all"
            >
              <Icon icon="solar:buildings-2-bold-duotone" />
              Jelajahi Semua Properti
            </Link>
          </div>
        </div>

        {/* Fun Fact */}
        <div className="mt-12 flex items-center justify-center gap-2 text-gray-500 text-sm">
          <Icon icon="solar:info-circle-bold" className="text-base" />
          <p>
            Error Code: 404 | Halaman hilang sejak {new Date().getFullYear()}
          </p>
        </div>

      </div>

      {/* Bottom Wave Decoration */}
      <div className="absolute bottom-0 left-0 right-0 h-32 opacity-20 pointer-events-none">
        <svg viewBox="0 0 1440 320" className="w-full h-full">
          <path 
            fill="rgba(134, 239, 172, 0.3)" 
            d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,160C1248,160,1344,128,1392,112L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
        </svg>
      </div>

    </div>
  );
}

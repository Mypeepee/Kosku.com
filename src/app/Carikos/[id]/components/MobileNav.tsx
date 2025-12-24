"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { AnimatePresence, motion } from "framer-motion";

// Data Menu untuk Drawer
const menuItems = [
  { label: "Beranda", href: "/" },
  { label: "Cari Kos", href: "/Carikos" },
  { label: "Sewa Apartemen", href: "/CariApartemen" },
  { label: "Favorit Saya", href: "/wishlist" },
  { label: "Riwayat Booking", href: "/history" },
  { label: "Bantuan", href: "/help" },
];

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Efek Scroll: Header transparan -> Gelap saat di-scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Kunci scroll body saat menu terbuka
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";
  }, [isOpen]);

  return (
    <>
      {/* --- MOBILE HEADER (Fixed Top) --- */}
      <div
        className={`lg:hidden fixed top-0 left-0 w-full z-50 transition-all duration-300 px-4 py-3 flex justify-between items-center ${
          isScrolled || isOpen
            ? "bg-[#0F0F0F]/95 backdrop-blur-xl border-b border-white/5 shadow-xl"
            : "bg-gradient-to-b from-black/60 to-transparent"
        }`}
      >
        {/* 1. BACK ARROW (Khusus Kos: Link ke /Carikos) */}
        <Link
          href="/Carikos"
          className={`p-2.5 rounded-full backdrop-blur-md active:scale-95 transition-all shadow-sm ${
            isScrolled ? "bg-white/10 text-white" : "bg-black/30 text-white border border-white/10"
          }`}
        >
          <Icon icon="solar:arrow-left-linear" className="text-xl" />
        </Link>

        {/* 2. CENTER LOGO */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
          <Icon
            icon="solar:home-smile-bold"
            className="text-[#86efac] text-xl drop-shadow-md"
          />
          <span className="font-extrabold text-white text-lg tracking-tight drop-shadow-md">
            Kosku<span className="text-[#86efac]">.com</span>
          </span>
        </div>

        {/* 3. BURGER MENU */}
        <button
          onClick={() => setIsOpen(true)}
          className={`p-2.5 rounded-full backdrop-blur-md active:scale-95 transition-all shadow-sm ${
            isScrolled ? "bg-white/10 text-white" : "bg-black/30 text-white border border-white/10"
          }`}
        >
          <Icon icon="solar:hamburger-menu-linear" className="text-xl" />
        </button>
      </div>

      {/* --- DRAWER MENU (Slide dari Kanan) --- */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop Gelap */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm lg:hidden"
            />

            {/* Panel Menu */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed top-0 right-0 z-[61] h-full w-[80%] max-w-xs bg-[#121212] border-l border-white/10 shadow-2xl lg:hidden flex flex-col"
            >
              {/* Header Drawer */}
              <div className="flex items-center justify-between p-5 border-b border-white/10 bg-[#0F0F0F]">
                <span className="font-bold text-white text-lg">Menu</span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
                >
                  <Icon icon="solar:close-circle-bold" className="text-2xl" />
                </button>
              </div>

              {/* List Menu */}
              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {menuItems.map((item, idx) => (
                  <Link
                    key={idx}
                    href={item.href}
                    className="flex items-center justify-between px-4 py-3.5 rounded-xl text-gray-300 hover:text-white hover:bg-white/5 transition-all font-medium border-b border-white/5 last:border-0"
                  >
                    {item.label}
                    <Icon icon="solar:alt-arrow-right-linear" className="text-gray-500" />
                  </Link>
                ))}
              </div>

              {/* Tombol Login/Register */}
              <div className="p-5 border-t border-white/10 space-y-3 bg-[#0F0F0F]">
                <button className="w-full py-3 rounded-xl border border-white/20 text-white font-bold hover:bg-white/10 transition-colors text-sm">
                  Masuk
                </button>
                <button className="w-full py-3 rounded-xl bg-[#86efac] text-black font-bold hover:bg-[#6ee7b7] transition-colors shadow-lg shadow-green-500/10 text-sm">
                  Daftar Sekarang
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
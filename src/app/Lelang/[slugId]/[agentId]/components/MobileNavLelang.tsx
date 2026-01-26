"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image"; // Import Image
import { Icon } from "@iconify/react";
import { AnimatePresence, motion } from "framer-motion";

// Import Data Menu
import { headerData } from "@/components/Layout/Header/Navigation/menuData"; 

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";
  }, [isOpen]);

  const toggleSubmenu = (index: number) => {
    setOpenSubmenu(openSubmenu === index ? null : index);
  };

  return (
    <>
      {/* --- HEADER MOBILE (FIXED TOP) --- */}
      <div
        className={`lg:hidden fixed top-0 left-0 w-full z-50 transition-all duration-300 px-4 py-3 flex justify-between items-center ${
          isScrolled || isOpen
            ? "bg-[#0F0F0F]/95 backdrop-blur-xl border-b border-white/5 shadow-xl"
            : "bg-gradient-to-b from-black/80 to-transparent"
        }`}
      >
        {/* 1. TOMBOL KEMBALI */}
        <Link
          href="/Jual"
          className={`p-2.5 rounded-full backdrop-blur-md active:scale-95 transition-all shadow-sm ${
            isScrolled ? "bg-white/10 text-white" : "bg-black/40 text-white border border-white/10"
          }`}
        >
          <Icon icon="solar:arrow-left-linear" className="text-xl" />
        </Link>

        {/* 2. LOGO TENGAH (Logo SVG + Teks Premier Asset) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
          {/* Gambar Logo */}
          <div className="relative w-8 h-8">
            <Image
                src="/images/logo/logopremier.svg"
                alt="Logo Premier"
                fill
                className="object-contain"
                priority
            />
          </div>
          
          {/* Teks Logo */}
          <span className="text-xl font-bold tracking-tight">
            <span className="text-white">Premier</span>
            <span className="text-[#86efac] ml-1">Asset</span>
          </span>
        </div>

        {/* 3. BURGER MENU */}
        <button
          onClick={() => setIsOpen(true)}
          className={`p-2.5 rounded-full backdrop-blur-md active:scale-95 transition-all shadow-sm ${
            isScrolled ? "bg-white/10 text-white" : "bg-black/40 text-white border border-white/10"
          }`}
        >
          <Icon icon="solar:hamburger-menu-linear" className="text-xl" />
        </button>
      </div>

      {/* --- DRAWER MENU --- */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm lg:hidden"
            />

            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed top-0 right-0 z-[61] h-full w-[80%] max-w-xs bg-[#121212] border-l border-white/10 shadow-2xl lg:hidden flex flex-col"
            >
              {/* HEADER DRAWER (Logo SVG + Teks Premier Asset) */}
              <div className="flex items-center justify-between p-5 border-b border-white/10 bg-[#0F0F0F]">
                <div className="flex items-center gap-2">
                    {/* Gambar Logo */}
                    <div className="relative w-8 h-8">
                        <Image
                            src="/images/logo/logopremier.svg"
                            alt="Logo Premier"
                            fill
                            className="object-contain"
                        />
                    </div>
                    {/* Teks Logo */}
                    <span className="text-xl font-bold tracking-tight">
                        <span className="text-white">Premier</span>
                        <span className="text-[#86efac] ml-1">Asset</span>
                    </span>
                </div>
                
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
                >
                  <Icon icon="solar:close-circle-bold" className="text-2xl text-gray-400 hover:text-white" />
                </button>
              </div>

              {/* LIST MENU */}
              <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
                
                {headerData?.map((menuItem, idx) => (
                  <div key={idx}>
                    
                    {menuItem.submenu && menuItem.submenu.length > 0 ? (
                      <div>
                        {/* Accordion Button */}
                        <button 
                            onClick={() => toggleSubmenu(idx)}
                            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all font-medium border-b border-white/5 ${openSubmenu === idx ? "bg-white/5 text-primary" : "text-gray-300 hover:text-white"}`}
                        >
                            <span className="flex items-center gap-3">
                                {menuItem.label}
                            </span>
                            <Icon 
                                icon="solar:alt-arrow-down-linear" 
                                className={`transition-transform duration-300 ${openSubmenu === idx ? "rotate-180" : ""}`} 
                            />
                        </button>
                        
                        {/* Submenu Content */}
                        <AnimatePresence>
                            {openSubmenu === idx && (
                                <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden bg-black/20 rounded-b-xl mb-1"
                                >
                                    {menuItem.submenu.map((sub, subIdx) => (
                                        <Link 
                                            key={subIdx}
                                            href={sub.href || "#"}
                                            onClick={() => setIsOpen(false)} 
                                            className="flex items-center gap-3 px-6 py-3 text-sm text-gray-400 hover:text-white border-l-2 border-transparent hover:border-primary hover:bg-white/5 transition-all"
                                        >
                                            {sub.icon && <Icon icon={sub.icon} className="text-lg text-primary" />}
                                            {sub.label}
                                        </Link>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                      </div>
                    ) : (
                      /* Single Link */
                      <Link
                        href={menuItem.href || "/"}
                        onClick={() => setIsOpen(false)} 
                        className="flex items-center justify-between px-4 py-3.5 rounded-xl text-gray-300 hover:text-white hover:bg-white/5 transition-all font-medium border-b border-white/5 last:border-0"
                      >
                        {menuItem.label}
                        <Icon icon="solar:alt-arrow-right-linear" className="text-gray-600" />
                      </Link>
                    )}
                  </div>
                ))}

              </div>

              {/* FOOTER DRAWER */}
              <div className="p-5 border-t border-white/10 space-y-3 bg-[#0F0F0F]">
                <button className="w-full py-3 rounded-xl border border-white/20 text-white font-bold hover:bg-white/10 transition-colors text-sm">
                  Masuk
                </button>
                <button className="w-full py-3 rounded-xl bg-primary text-black font-bold hover:bg-green-400 transition-colors shadow-lg shadow-green-500/10 text-sm">
                  Hubungi Agen
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
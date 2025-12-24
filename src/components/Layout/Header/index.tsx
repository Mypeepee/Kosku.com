"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "./Logo";
import Signin from "@/components/Auth/SignIn";
import SignUp from "@/components/Auth/SignUp";

// =============================================================================
// 1. STRUKTUR DATA MENU (Agar Logic Dropdown Benar)
// =============================================================================
const NAV_ITEMS = [
  {
    id: 1,
    title: "Cari Sewa",
    path: "#", // Parent tidak navigasi, hanya trigger dropdown
    newTab: false,
    submenu: [
      { id: 11, title: "Cari Kos", path: "/Carikos", icon: "solar:home-smile-bold" },
      { id: 12, title: "Sewa Apartemen", path: "/apartemen", icon: "solar:buildings-bold" },
    ],
  },
  { id: 2, title: "Blog", path: "/blog", newTab: false },
  { id: 3, title: "Bantuan", path: "/help", newTab: false },
  {
    id: 4,
    title: "Jadi Juragan",
    path: "#",
    newTab: false,
    submenu: [
      { id: 41, title: "Daftarkan Kos", path: "/daftar-kos", icon: "solar:key-minimalistic-square-bold" },
      { id: 42, title: "Panduan Pemilik", path: "/kenapa-kosku", icon: "solar:book-bookmark-bold" },
    ],
  },
];

// =============================================================================
// 2. COMPONENT: DESKTOP MENU ITEM (Instant Hover)
// =============================================================================
const DesktopMenuItem = ({ item }: { item: any }) => {
  const [isHovered, setIsHovered] = useState(false);
  const pathUrl = usePathname();
  const isActive = item.path === pathUrl;

  return (
    <div 
      className="relative h-full flex items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link
        href={item.submenu ? "#" : item.path}
        className={`flex items-center gap-1 text-sm font-bold transition-colors py-2 ${
          isActive || isHovered ? "text-[#86efac]" : "text-white/80 hover:text-white"
        }`}
      >
        {item.title}
        {item.submenu && (
          <Icon 
            icon="solar:alt-arrow-down-linear" 
            className={`transition-transform duration-300 ${isHovered ? "rotate-180" : ""}`}
          />
        )}
      </Link>

      {/* DROPDOWN MENU */}
      <AnimatePresence>
        {item.submenu && isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 pt-4 w-56 z-50"
          >
            {/* White/Dark Box */}
            <div className="bg-[#1A1A1A] border border-white/10 rounded-xl shadow-2xl overflow-hidden p-2">
              {item.submenu.map((subItem: any) => (
                <Link
                  key={subItem.id}
                  href={subItem.path}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/5 transition-all group"
                >
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-[#86efac] group-hover:bg-[#86efac]/10 transition-colors">
                     <Icon icon={subItem.icon || "solar:link-circle-linear"} className="text-lg"/>
                  </div>
                  <span className="text-sm font-medium text-gray-300 group-hover:text-white">
                    {subItem.title}
                  </span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// =============================================================================
// 3. COMPONENT: MOBILE MENU ITEM (Accordion Style)
// =============================================================================
const MobileMenuItem = ({ item, closeMenu }: { item: any, closeMenu: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasSubmenu = item.submenu && item.submenu.length > 0;

  return (
    <div className="border-b border-white/5 last:border-0">
      {hasSubmenu ? (
        // JIKA PUNYA SUBMENU -> JADI TOMBOL TOGGLE (Bukan Link)
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between py-4 px-2 text-left"
        >
          <span className={`text-base font-bold ${isOpen ? "text-[#86efac]" : "text-white"}`}>
            {item.title}
          </span>
          <Icon 
            icon="solar:alt-arrow-down-linear" 
            className={`text-gray-400 transition-transform duration-300 ${isOpen ? "rotate-180 text-[#86efac]" : ""}`}
          />
        </button>
      ) : (
        // JIKA TIDAK PUNYA SUBMENU -> JADI LINK BIASA
        <Link
          href={item.path}
          onClick={closeMenu}
          className="block w-full py-4 px-2 text-base font-bold text-white hover:text-[#86efac] transition-colors"
        >
          {item.title}
        </Link>
      )}

      {/* SUBMENU LIST (ACCORDION) */}
      <AnimatePresence>
        {hasSubmenu && isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-white/5 rounded-xl mb-4"
          >
            <div className="flex flex-col py-2">
              {item.submenu.map((sub: any) => (
                <Link
                  key={sub.id}
                  href={sub.path}
                  onClick={closeMenu}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all"
                >
                  <Icon icon={sub.icon || "solar:arrow-right-linear"} className="text-gray-500"/>
                  {sub.title}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// =============================================================================
// 4. MAIN COMPONENT: HEADER
// =============================================================================
const Header: React.FC = () => {
  const pathUrl = usePathname();
  // Sembunyikan header default di halaman detail (karena ada MobileNav sendiri)
  const isDetailPage = pathUrl?.startsWith("/Carikos/") && pathUrl.split("/").length > 2;

  const [navbarOpen, setNavbarOpen] = useState(false);
  const [sticky, setSticky] = useState(false);
  
  // Auth Modals
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);

  // Scroll Handler
  useEffect(() => {
    const handleScroll = () => setSticky(window.scrollY >= 40);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock Body Scroll when Menu Open
  useEffect(() => {
    if (navbarOpen || isSignInOpen || isSignUpOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
  }, [navbarOpen, isSignInOpen, isSignUpOpen]);

  return (
    <>
      <header
        className={`fixed top-0 left-0 w-full z-40 transition-all duration-300 ${
          sticky ? "bg-[#0F0F0F]/80 backdrop-blur-md border-b border-white/5 py-4" : "bg-transparent py-6"
        } ${isDetailPage ? "hidden lg:block" : ""}`}
      >
        <div className="container mx-auto px-4 lg:max-w-screen-xl flex items-center justify-between">
          
          {/* 1. LOGO */}
          <div className="shrink-0 mr-8">
            <Logo />
          </div>

          {/* 2. DESKTOP NAVIGATION (CENTER) */}
          <nav className="hidden lg:flex flex-grow items-center gap-8">
            {NAV_ITEMS.map((item) => (
              <DesktopMenuItem key={item.id} item={item} />
            ))}
          </nav>

          {/* 3. AUTH BUTTONS (RIGHT) */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSignInOpen(true)}
              className="hidden lg:block text-sm font-bold text-white hover:text-[#86efac] transition-colors"
            >
              Masuk
            </button>
            <button
              onClick={() => setIsSignUpOpen(true)}
              className="hidden lg:block px-5 py-2.5 rounded-full bg-[#86efac] text-black text-sm font-extrabold hover:bg-[#6ee7b7] shadow-lg shadow-green-500/20 transition-all active:scale-95"
            >
              Daftar
            </button>

            {/* MOBILE BURGER BUTTON */}
            <button
              onClick={() => setNavbarOpen(true)}
              className="lg:hidden p-2 text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <Icon icon="solar:hamburger-menu-linear" className="text-2xl" />
            </button>
          </div>
        </div>
      </header>

      {/* ==================================================================
          MOBILE MENU DRAWER (SLIDE FROM RIGHT)
      ================================================================== */}
      <AnimatePresence>
        {navbarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setNavbarOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 lg:hidden"
            />
            
            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-[85%] max-w-xs bg-[#121212] border-l border-white/10 z-[51] shadow-2xl flex flex-col lg:hidden"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <span className="text-lg font-bold text-white">Menu</span>
                <button onClick={() => setNavbarOpen(false)} className="p-2 rounded-full hover:bg-white/10 text-white transition-colors">
                  <Icon icon="solar:close-circle-bold" className="text-2xl" />
                </button>
              </div>

              {/* Drawer Body (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                <div className="flex flex-col">
                  {NAV_ITEMS.map((item) => (
                    <MobileMenuItem key={item.id} item={item} closeMenu={() => setNavbarOpen(false)} />
                  ))}
                </div>
              </div>

              {/* Drawer Footer (Auth) */}
              <div className="p-5 border-t border-white/10 bg-[#0F0F0F] space-y-3">
                <button 
                  onClick={() => { setNavbarOpen(false); setIsSignInOpen(true); }}
                  className="w-full py-3 rounded-xl border border-white/20 text-white font-bold text-sm hover:bg-white/5 transition-all"
                >
                  Masuk Akun
                </button>
                <button 
                  onClick={() => { setNavbarOpen(false); setIsSignUpOpen(true); }}
                  className="w-full py-3 rounded-xl bg-[#86efac] text-black font-bold text-sm hover:bg-[#6ee7b7] shadow-lg transition-all"
                >
                  Daftar Sekarang
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ==================================================================
          AUTH MODALS (PORTAL)
      ================================================================== */}
      {isSignInOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsSignInOpen(false)}></div>
          <div className="relative w-full max-w-md bg-[#181818] border border-white/10 rounded-2xl p-8 shadow-2xl">
             <button onClick={() => setIsSignInOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><Icon icon="solar:close-circle-bold" className="text-2xl"/></button>
             <h3 className="text-2xl font-bold text-white mb-6 text-center">Selamat Datang Kembali</h3>
             <Signin />
          </div>
        </div>
      )}

      {isSignUpOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsSignUpOpen(false)}></div>
          <div className="relative w-full max-w-md bg-[#181818] border border-white/10 rounded-2xl p-8 shadow-2xl">
             <button onClick={() => setIsSignUpOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><Icon icon="solar:close-circle-bold" className="text-2xl"/></button>
             <h3 className="text-2xl font-bold text-white mb-6 text-center">Buat Akun Baru</h3>
             <SignUp />
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
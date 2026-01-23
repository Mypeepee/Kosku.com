"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";

import Logo from "./Logo";
import Signin from "@/components/Auth/SignIn";
import SignUp from "@/components/Auth/SignUp";

import { headerData } from "./Navigation/menuData";

// =============================================================================
// 2. COMPONENT: DESKTOP MENU ITEM
// =============================================================================
const DesktopMenuItem = ({ item }: { item: any }) => {
  const [isHovered, setIsHovered] = useState(false);
  const pathUrl = usePathname();

  const isActive =
    item.href === pathUrl ||
    item.submenu?.some((sub: any) => sub.href === pathUrl);

  return (
    <div
      className="relative h-full flex items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link
        href={item.submenu ? "#" : item.href}
        className={`flex items-center gap-1 text-sm font-bold transition-colors py-2 ${
          isActive || isHovered
            ? "text-[#86efac]"
            : "text-white/80 hover:text-white"
        }`}
      >
        {item.label}
        {item.submenu && (
          <Icon
            icon="solar:alt-arrow-down-linear"
            className={`transition-transform duration-300 ${
              isHovered ? "rotate-180" : ""
            }`}
          />
        )}
      </Link>

      <AnimatePresence>
        {item.submenu && isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 pt-4 w-64 z-50"
          >
            <div className="bg-[#1A1A1A] border border-white/10 rounded-xl shadow-2xl overflow-hidden p-2">
              {item.submenu.map((subItem: any, index: number) => (
                <Link
                  key={index}
                  href={subItem.href}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/5 transition-all group"
                >
                  <div className="shrink-0 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-[#86efac] group-hover:bg-[#86efac]/10 transition-colors">
                    <Icon
                      icon={subItem.icon || "solar:link-circle-linear"}
                      className="text-lg"
                    />
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-gray-300 group-hover:text-white">
                      {subItem.label}
                    </span>
                    {subItem.description && (
                      <span className="text-[10px] text-gray-500 block leading-tight mt-0.5">
                        {subItem.description}
                      </span>
                    )}
                  </div>
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
// 3. COMPONENT: MOBILE MENU ITEM
// =============================================================================
const MobileMenuItem = ({
  item,
  closeMenu,
}: {
  item: any;
  closeMenu: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasSubmenu = item.submenu && item.submenu.length > 0;

  return (
    <div className="border-b border-white/5 last:border-0">
      {hasSubmenu ? (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between py-4 px-2 text-left"
        >
          <span
            className={`text-base font-bold ${
              isOpen ? "text-[#86efac]" : "text-white"
            }`}
          >
            {item.label}
          </span>
          <Icon
            icon="solar:alt-arrow-down-linear"
            className={`text-gray-400 transition-transform duration-300 ${
              isOpen ? "rotate-180 text-[#86efac]" : ""
            }`}
          />
        </button>
      ) : (
        <Link
          href={item.href}
          onClick={closeMenu}
          className="block w-full py-4 px-2 text-base font-bold text-white hover:text-[#86efac] transition-colors"
        >
          {item.label}
        </Link>
      )}

      <AnimatePresence>
        {hasSubmenu && isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-white/5 rounded-xl mb-4"
          >
            <div className="flex flex-col py-2">
              {item.submenu.map((sub: any, index: number) => (
                <Link
                  key={index}
                  href={sub.href}
                  onClick={closeMenu}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all"
                >
                  <Icon
                    icon={sub.icon || "solar:arrow-right-linear"}
                    className="text-gray-500 text-lg"
                  />
                  <div className="flex flex-col">
                    <span>{sub.label}</span>
                    {sub.description && (
                      <span className="text-[10px] text-gray-500">
                        {sub.description}
                      </span>
                    )}
                  </div>
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
  const { data: session, status } = useSession();
  const pathUrl = usePathname();
  const isDetailPage =
    pathUrl?.startsWith("/Carikos/") && pathUrl.split("/").length > 2;
  const isDashboard = pathUrl?.startsWith("/dashboard");

  const [navbarOpen, setNavbarOpen] = useState(false);
  const [sticky, setSticky] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setSticky(window.scrollY >= 40);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (navbarOpen || isSignInOpen || isSignUpOpen)
      document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
  }, [navbarOpen, isSignInOpen, isSignUpOpen]);

  const handleLogout = () => {
    signOut({ callbackUrl: "/" });
    setProfileDropdownOpen(false);
    setNavbarOpen(false);
  };

  // ========= ROLE & MENU DINAMIS =========
  const isAgent = (session?.user as any)?.role === "AGENT";

  const computedMenu = React.useMemo(() => {
    if (!isAgent) return headerData;

    const items = [...headerData];
    const dashboardItem = {
      label: "Dashboard",
      href: "/dashboard",
    };

    const idx = items.findIndex((m) => m.label === "Cari Properti");
    if (idx === -1) return [dashboardItem, ...items];

    const withDashboard = [...items];
    withDashboard.splice(idx + 1, 0, dashboardItem);
    return withDashboard;
  }, [isAgent]);

  // ======================================

  return (
    <>
      <header
        className={`fixed top-0 left-0 w-full z-40 transition-all duration-300 ${
          sticky
            ? "bg-[#0F0F0F]/80 backdrop-blur-md border-b border-white/5 py-4"
            : "bg-transparent py-6"
        } ${isDashboard ? "hidden" : isDetailPage ? "hidden lg:block" : ""}`}
      >
        <div className="container mx-auto px-4 lg:max-w-screen-xl flex items-center justify-between">
          <div className="shrink-0 mr-8">
            <Logo />
          </div>

          {/* DESKTOP NAVIGATION */}
          <nav className="hidden lg:flex flex-grow items-center gap-6 xl:gap-8">
            {(computedMenu || []).map((item, index) => (
              <DesktopMenuItem key={index} item={item} />
            ))}
          </nav>

          {/* RIGHT SIDE (AUTH) */}
          <div className="flex items-center gap-4">
            {status === "loading" ? (
              <div className="hidden lg:block w-8 h-8 rounded-full bg-white/10 animate-pulse"></div>
            ) : status === "authenticated" ? (
              <div
                className="hidden lg:block relative"
                onMouseEnter={() => setProfileDropdownOpen(true)}
                onMouseLeave={() => setProfileDropdownOpen(false)}
              >
                {/* Desktop Profile Button */}
                <button className="flex items-center gap-2 py-2 group outline-none">
                  <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden relative bg-white/5 shrink-0">
                    {session?.user?.image ? (
                      <Image
                        src={session.user.image}
                        alt="Profile"
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 group-hover:text-[#86efac] transition-colors">
                        <Icon
                          icon="solar:user-circle-bold"
                          className="text-2xl"
                        />
                      </div>
                    )}
                  </div>
                </button>

                <AnimatePresence>
                  {profileDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-full right-0 pt-2 w-48"
                    >
                      <div className="bg-[#1A1A1A] border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1">
                        <div className="px-4 py-3 border-b border-white/5">
                          <p className="text-xs text-gray-400">Halo,</p>
                          <p className="text-sm font-bold text-white truncate">
                            {session?.user?.name || "Pengguna"}
                          </p>
                        </div>

                        <Link
                          href="/profile"
                          className="flex items-center gap-2 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-[#86efac] transition-colors"
                        >
                          <Icon
                            icon="solar:user-id-bold"
                            className="text-lg"
                          />
                          Profil Saya
                        </Link>

                        {isAgent && (
                          <Link
                            href="/dashboard"
                            className="flex items-center gap-2 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-[#86efac] transition-colors"
                          >
                            <Icon
                              icon="solar:widget-3-bold-duotone"
                              className="text-lg"
                            />
                            Dashboard Agent
                          </Link>
                        )}

                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-left"
                        >
                          <Icon
                            icon="solar:logout-2-bold"
                            className="text-lg"
                          />
                          Keluar
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <>
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
              </>
            )}

            <button
              onClick={() => setNavbarOpen(true)}
              className="lg:hidden p-2 text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <Icon
                icon="solar:hamburger-menu-linear"
                className="text-2xl"
              />
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE MENU DRAWER */}
      <AnimatePresence>
        {navbarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNavbarOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 lg:hidden"
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-[85%] max-w-xs bg-[#121212] border-l border-white/10 z-[51] shadow-2xl flex flex-col lg:hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <span className="text-lg font-bold text-white">Menu</span>
                <button
                  onClick={() => setNavbarOpen(false)}
                  className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
                >
                  <Icon
                    icon="solar:close-circle-bold"
                    className="text-2xl"
                  />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                <div className="flex flex-col">
                  {(computedMenu || []).map((item, index) => (
                    <MobileMenuItem
                      key={index}
                      item={item}
                      closeMenu={() => setNavbarOpen(false)}
                    />
                  ))}
                </div>
              </div>

              <div className="p-5 border-t border-white/10 bg-[#0F0F0F] space-y-3">
                {status === "authenticated" ? (
                  <>
                    <div className="flex items-center gap-3 mb-4 px-2">
                      <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden relative shrink-0 border border-white/10">
                        {session?.user?.image ? (
                          <Image
                            src={session.user.image}
                            alt="User"
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white">
                            <Icon
                              icon="solar:user-circle-bold"
                              className="text-2xl"
                            />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">
                          {session?.user?.name || "Pengguna"}
                        </p>
                        <p className="text-xs text-gray-400">
                          {session?.user?.email}
                        </p>
                      </div>
                    </div>

                    {isAgent && (
                      <Link
                        href="/dashboard"
                        onClick={() => setNavbarOpen(false)}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/20 text-white font-bold text-sm hover:bg-white/5 transition-all"
                      >
                        <Icon
                          icon="solar:widget-3-bold-duotone"
                          className="text-lg"
                        />
                        Dashboard Agent
                      </Link>
                    )}

                    <Link
                      href="/profile"
                      onClick={() => setNavbarOpen(false)}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/20 text-white font-bold text-sm hover:bg-white/5 transition-all"
                    >
                      <Icon
                        icon="solar:user-id-bold"
                        className="text-lg"
                      />
                      Profil Saya
                    </Link>

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 text-red-400 font-bold text-sm hover:bg-red-500/20 transition-all border border-red-500/20"
                    >
                      <Icon
                        icon="solar:logout-2-bold"
                        className="text-lg"
                      />
                      Keluar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setNavbarOpen(false);
                        setIsSignInOpen(true);
                      }}
                      className="w-full py-3 rounded-xl border border-white/20 text-white font-bold text-sm hover:bg-white/5 transition-all"
                    >
                      Masuk Akun
                    </button>
                    <button
                      onClick={() => {
                        setNavbarOpen(false);
                        setIsSignUpOpen(true);
                      }}
                      className="w-full py-3 rounded-xl bg-[#86efac] text-black font-bold text-sm hover:bg-[#6ee7b7] shadow-lg transition-all"
                    >
                      Daftar Sekarang
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MODALS */}
      {isSignInOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => setIsSignInOpen(false)}
          ></div>
          <div className="relative w-full max-w-md bg-[#181818] border border-white/10 rounded-2xl p-8 shadow-2xl">
            <button
              onClick={() => setIsSignInOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <Icon
                icon="solar:close-circle-bold"
                className="text-2xl"
              />
            </button>
            <h3 className="text-2xl font-bold text-white mb-6 text-center">
              Selamat Datang Kembali
            </h3>
            <Signin closeModal={() => setIsSignInOpen(false)} />
          </div>
        </div>
      )}

      {isSignUpOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => setIsSignUpOpen(false)}
          ></div>
          <div className="relative w-full max-w-md bg-[#181818] border border-white/10 rounded-2xl p-8 shadow-2xl">
            <button
              onClick={() => setIsSignUpOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <Icon
                icon="solar:close-circle-bold"
                className="text-2xl"
              />
            </button>
            <h3 className="text-2xl font-bold text-white mb-6 text-center">
              Buat Akun Baru
            </h3>
            <SignUp />
          </div>
        </div>
      )}
    </>
  );
};

export default Header;

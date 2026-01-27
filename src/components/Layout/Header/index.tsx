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

// ============================================================================
// MOBILE NAV
// ============================================================================
interface MobileNavProps {
  onOpenSignIn: () => void;
  onOpenSignUp: () => void;
  status: "loading" | "authenticated" | "unauthenticated";
  userName?: string | null;
  userImage?: string | null;
  isAgent: boolean;
  onLogout: () => void;
  baseMenu: any[];
}

const MobileNav: React.FC<MobileNavProps> = ({
  onOpenSignIn,
  onOpenSignUp,
  status,
  userName,
  userImage,
  isAgent,
  onLogout,
  baseMenu,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "auto";
  }, [isOpen]);

  const toggleSubmenu = (index: number) => {
    setOpenSubmenu(openSubmenu === index ? null : index);
  };

  const noBackPaths = ["/"];
  const showBackButton = !noBackPaths.includes(pathname || "/");
  const backHref = "/Jual";

  // menu untuk mobile: prepend Profile/Dashboard saat login
  const mobileMenu = React.useMemo(() => {
    const items = [...baseMenu];

    if (status !== "authenticated") return items;

    const extra: any[] = [
      {
        label: "Profil Saya",
        href: "/profile",
        icon: "solar:user-id-bold",
      },
    ];

    if (isAgent) {
      extra.push({
        label: "Dashboard Agent",
        href: "/dashboard",
        icon: "solar:widget-3-bold-duotone",
      });
    }

    return [...extra, { divider: true }, ...items];
  }, [baseMenu, status, isAgent]);

  return (
    <>
      {/* HEADER MOBILE (FIXED TOP) */}
      <div
        className={`lg:hidden fixed top-0 left-0 w-full z-50 transition-all duration-300 px-4 py-3 flex justify-between items-center ${
          isScrolled || isOpen
            ? "bg-[#0F0F0F]/95 backdrop-blur-xl border-b border-white/5 shadow-xl"
            : "bg-gradient-to-b from-black/80 to-transparent"
        }`}
      >
        {/* BACK BUTTON */}
        {showBackButton ? (
          <Link
            href={backHref}
            className={`p-2.5 rounded-full backdrop-blur-md active:scale-95 transition-all shadow-sm ${
              isScrolled
                ? "bg-white/10 text-white"
                : "bg-black/40 text-white border border-white/10"
            }`}
          >
            <Icon icon="solar:arrow-left-linear" className="text-xl" />
          </Link>
        ) : (
          <div className="w-10 h-10" />
        )}

        {/* LOGO */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
          <div className="relative w-8 h-8">
            <Image
              src="/images/logo/logopremier.svg"
              alt="Logo Premier"
              fill
              className="object-contain"
              priority
            />
          </div>
          <span className="text-xl font-bold tracking-tight">
            <span className="text-white">Premier</span>
            <span className="text-[#86efac] ml-1">Asset</span>
          </span>
        </div>

        {/* AVATAR + BURGER */}
        <button
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full backdrop-blur-md active:scale-95 transition-all shadow-sm ${
            isScrolled
              ? "bg-white/10 text-white"
              : "bg-black/40 text-white border border-white/10"
          }`}
        >
          {status === "authenticated" ? (
            <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 bg-white/10 relative">
              {userImage ? (
                <Image
                  src={userImage}
                  alt="Profile"
                  fill
                  sizes="32px"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <Icon icon="solar:user-circle-bold" className="text-xl" />
                </div>
              )}
            </div>
          ) : (
            <Icon
              icon="solar:user-circle-bold"
              className="text-xl text-gray-300"
            />
          )}
          <Icon icon="solar:hamburger-menu-linear" className="text-xl" />
        </button>
      </div>

      {/* DRAWER MENU */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm lg:hidden"
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed top-0 right-0 z-[61] h-full w-[80%] max-w-xs bg-[#090909] border-l border-white/10 shadow-2xl lg:hidden flex flex-col"
            >
              {/* HEADER DRAWER */}
              <div className="p-5 border-b border-white/10 bg-[#0F0F0F] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative w-9 h-9">
                    <Image
                      src="/images/logo/logopremier.svg"
                      alt="Logo Premier"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-base font-bold text-white leading-tight">
                      Premier Asset
                    </span>
                    <span className="text-[10px] text-gray-400">
                      Portal properti modern
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
                >
                  <Icon
                    icon="solar:close-circle-bold"
                    className="text-2xl text-gray-400 hover:text-white"
                  />
                </button>
              </div>

              {/* SECTION PROFIL (JIKA LOGIN) */}
              {status === "authenticated" && (
                <div className="px-5 py-4 border-b border-white/10 bg-gradient-to-r from-emerald-500/10 via-emerald-500/0 to-sky-500/10 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-emerald-400/60 bg-black relative">
                    {userImage ? (
                      <Image
                        src={userImage}
                        alt="Profile"
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-emerald-300">
                        <Icon
                          icon="solar:user-circle-bold"
                          className="text-2xl"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-400">Masuk sebagai</p>
                    <p className="text-sm font-semibold text-white truncate">
                      {userName || "Pengguna"}
                    </p>
                    {isAgent && (
                      <p className="text-[11px] text-emerald-300 font-medium">
                        Agent Premier
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* LIST MENU */}
              <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
                {mobileMenu.map((menuItem, idx) =>
                  menuItem.divider ? (
                    <div
                      key={`divider-${idx}`}
                      className="my-2 h-px bg-white/10"
                    />
                  ) : (
                    <div key={idx}>
                      {menuItem.submenu && menuItem.submenu.length > 0 ? (
                        <div>
                          <button
                            onClick={() => toggleSubmenu(idx)}
                            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all font-medium ${
                              openSubmenu === idx
                                ? "bg-white/5 text-[#86efac]"
                                : "text-gray-300 hover:text-white hover:bg-white/5"
                            }`}
                          >
                            <span className="flex items-center gap-3">
                              {menuItem.icon && (
                                <Icon
                                  icon={menuItem.icon}
                                  className="text-lg text-[#86efac]"
                                />
                              )}
                              {menuItem.label}
                            </span>
                            <Icon
                              icon="solar:alt-arrow-down-linear"
                              className={`transition-transform duration-300 ${
                                openSubmenu === idx ? "rotate-180" : ""
                              }`}
                            />
                          </button>

                          <AnimatePresence>
                            {openSubmenu === idx && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden bg-black/30 rounded-2xl mt-1 mb-2"
                              >
                                {menuItem.submenu.map(
                                  (sub: any, subIdx: number) => (
                                    <Link
                                      key={subIdx}
                                      href={sub.href || "#"}
                                      onClick={() => setIsOpen(false)}
                                      className="flex items-center gap-3 px-6 py-3 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                                    >
                                      {sub.icon && (
                                        <Icon
                                          icon={sub.icon}
                                          className="text-lg text-[#86efac]"
                                        />
                                      )}
                                      {sub.label}
                                    </Link>
                                  )
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ) : (
                        <Link
                          href={menuItem.href || "/"}
                          onClick={() => setIsOpen(false)}
                          className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-gray-300 hover:text-white hover:bg-white/5 transition-all font-medium"
                        >
                          {menuItem.icon && (
                            <Icon
                              icon={menuItem.icon}
                              className="text-lg text-[#86efac]"
                            />
                          )}
                          {menuItem.label}
                        </Link>
                      )}
                    </div>
                  )
                )}
              </div>

              {/* FOOTER DRAWER */}
              <div className="p-5 border-t border-white/10 bg-[#0F0F0F] space-y-3">
                {status === "authenticated" ? (
                  <button
                    className="w-full py-3 rounded-xl border border-red-400/50 text-red-300 font-bold hover:bg-red-500/10 transition-colors text-sm flex items-center justify-center gap-2"
                    onClick={() => {
                      setIsOpen(false);
                      onLogout();
                    }}
                  >
                    <Icon icon="solar:logout-2-bold" className="text-lg" />
                    Keluar
                  </button>
                ) : (
                  <>
                    <button
                      className="w-full py-3 rounded-xl border border-white/20 text-white font-bold hover:bg-white/10 transition-colors text-sm"
                      onClick={() => {
                        setIsOpen(false);
                        onOpenSignIn();
                      }}
                    >
                      Masuk
                    </button>
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        onOpenSignUp();
                      }}
                      className="w-full py-3 rounded-xl bg-[#86efac] text-black font-bold hover:bg-[#6ee7b7] transition-colors shadow-lg shadow-green-500/20 text-sm"
                    >
                      Daftar Gratis
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

// ============================================================================
// DESKTOP MENU ITEM
// ============================================================================
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

// ============================================================================
// MAIN HEADER
// ============================================================================
const Header: React.FC = () => {
  const { data: session, status } = useSession();
  const pathUrl = usePathname();
  const isDashboard = pathUrl?.startsWith("/dashboard");

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
    document.body.style.overflow =
      isSignInOpen || isSignUpOpen ? "hidden" : "";
  }, [isSignInOpen, isSignUpOpen]);

  const handleLogout = () => {
    signOut({ callbackUrl: "/" });
    setProfileDropdownOpen(false);
  };

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

  if (isDashboard) return null;

  return (
    <>
      {/* MOBILE HEADER */}
      <MobileNav
        onOpenSignIn={() => setIsSignInOpen(true)}
        onOpenSignUp={() => setIsSignUpOpen(true)}
        status={status}
        userName={session?.user?.name}
        userImage={session?.user?.image}
        isAgent={isAgent}
        onLogout={handleLogout}
        baseMenu={computedMenu}
      />

      {/* DESKTOP HEADER */}
      <header
        className={`hidden lg:block fixed top-0 left-0 w-full z-40 transition-all duration-300 ${
          sticky
            ? "bg-[#0F0F0F]/80 backdrop-blur-md border-b border-white/5 py-4"
            : "bg-transparent py-6"
        }`}
      >
        <div className="container mx-auto px-4 lg:max-w-screen-xl flex items-center justify-between">
          <div className="shrink-0 mr-8">
            <Logo />
          </div>

          <nav className="flex flex-grow items-center gap-6 xl:gap-8">
            {(computedMenu || []).map((item, index) => (
              <DesktopMenuItem key={index} item={item} />
            ))}
          </nav>

          {/* RIGHT SIDE (AUTH) */}
          <div className="flex items-center gap-4">
            {status === "loading" ? (
              <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
            ) : status === "authenticated" ? (
              <div
                className="relative"
                onMouseEnter={() => setProfileDropdownOpen(true)}
                onMouseLeave={() => setProfileDropdownOpen(false)}
              >
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
                  className="text-sm font-bold text-white hover:text-[#86efac] transition-colors"
                >
                  Masuk
                </button>
                <button
                  onClick={() => setIsSignUpOpen(true)}
                  className="px-5 py-2.5 rounded-full bg-[#86efac] text-black text-sm font-extrabold hover:bg-[#6ee7b7] shadow-lg shadow-green-500/20 transition-all active:scale-95"
                >
                  Daftar
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* MODALS */}
      {isSignInOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => setIsSignInOpen(false)}
          />
          <div className="relative w-full max-w-md bg-[#181818] border border-white/10 rounded-2xl p-8 shadow-2xl">
            <button
              onClick={() => setIsSignInOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <Icon icon="solar:close-circle-bold" className="text-2xl" />
            </button>
            <h3 className="text-2xl font-bold text-white mb-6 text-center">
              Selamat Datang Kembali
            </h3>
            <Signin
              closeModal={() => setIsSignInOpen(false)}
              openSignupModal={() => {
                setIsSignInOpen(false);
                setIsSignUpOpen(true);
              }}
            />
          </div>
        </div>
      )}

      {isSignUpOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => setIsSignUpOpen(false)}
          />
          <div className="relative w-full max-w-md bg-[#181818] border border-white/10 rounded-2xl p-8 shadow-2xl">
            <button
              onClick={() => setIsSignUpOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <Icon icon="solar:close-circle-bold" className="text-2xl" />
            </button>
            <h3 className="text-2xl font-bold text-white mb-6 text-center">
              Buat Akun Baru
            </h3>
            <SignUp
              closeModal={() => setIsSignUpOpen(false)}
              openSigninModal={() => {
                setIsSignUpOpen(false);
                setIsSignInOpen(true);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default Header;

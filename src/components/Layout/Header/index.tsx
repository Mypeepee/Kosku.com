"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";

import Logo from "./Logo";
import Signin from "@/components/Auth/SignIn";
import SignUp from "@/components/Auth/SignUp";
import AuthModal from "@/components/Auth/AuthModal";
import ForgotPasswordFlow from "@/components/Auth/ForgotPassword/ForgotPasswordFlow";
import { headerData } from "./Navigation/menuData";

const matchesPath = (subHref: string, currentPath: string) => {
  if (subHref === currentPath) return true;
  const base = "/" + subHref.split("/")[1];
  return currentPath === base || currentPath.startsWith(base + "/");
};

// ============================================================================
// MOBILE NAV
// ============================================================================
interface MobileNavProps {
  onOpenSignIn: () => void;
  onOpenSignUp: () => void;
  status: "loading" | "authenticated" | "unauthenticated";
  userName?: string | null;
  userImage?: string | null;

  // ✅ pakai peran yang sudah dihitung dari session
  isAgent: boolean;

  // ✅ supaya bisa hide/show "Gabung jadi Agent" di menu data
  canJoinAgent: boolean;

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
  canJoinAgent,
  onLogout,
  baseMenu,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Saat menu ditutup nilainya WAJIB dikosongkan, bukan "auto".
  // `html` di globals.css memakai `overflow-x: clip`, jadi overflow milik
  // <body> tidak lagi dipropagasi ke viewport — begitu body diberi
  // `overflow: auto` body berubah jadi scroll container sendiri dan SEMUA
  // `position: sticky` di halaman (mis. sidebar agent di detail properti)
  // langsung berhenti menempel saat di-scroll.
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
  }, [isOpen]);

  const toggleSubmenu = (index: number) => {
    setOpenSubmenu(openSubmenu === index ? null : index);
  };

  const noBackPaths = ["/"];
  const showBackButton = !noBackPaths.includes(pathname || "/");

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  // ✅ filter base menu: hide "Gabung Jadi Agent" jika tidak eligible
  const filteredBaseMenu = React.useMemo(() => {
    const isJoinAgentItem = (it: any) =>
      String(it?.href || "").startsWith("/gabung-jadi-agent") ||
      String(it?.label || "").toLowerCase().includes("gabung jadi agent");

    const deepFilter = (items: any[]): any[] =>
      (items || [])
        .map((it) => {
          if (it?.submenu?.length) {
            const next = { ...it, submenu: deepFilter(it.submenu) };
            return next;
          }
          return it;
        })
        .filter((it) => {
          if (!canJoinAgent && isJoinAgentItem(it)) return false;
          // kalau parent submenu jadi kosong, boleh tetap tampil atau hilang
          if (it?.submenu && Array.isArray(it.submenu) && it.submenu.length === 0) {
            // biar clean, hilangkan parent kosong
            return false;
          }
          return true;
        });

    return deepFilter([...baseMenu]);
  }, [baseMenu, canJoinAgent]);

  // menu untuk mobile: prepend Profile/Dashboard saat login
  const mobileMenu = React.useMemo(() => {
    const items = [...filteredBaseMenu];

    if (status !== "authenticated") return items;

    const extra: any[] = [
      {
        label: "Profil Saya",
        href: "/profile",
        icon: "solar:user-id-bold",
      },
    ];

    // ✅ dashboard hanya kalau agent
    if (isAgent) {
      extra.push({
        label: "Dashboard Agent",
        href: "/dashboard",
        icon: "solar:widget-3-bold-duotone",
      });
    }

    // Hindari duplikat: "Dashboard Agent" di atas sudah menuju /dashboard,
    // jadi buang item "Dashboard" polos (disuntik untuk desktop nav) di mobile.
    const deduped = isAgent
      ? items.filter((it) => !(it?.href === "/dashboard" && it?.label === "Dashboard"))
      : items;

    return [...extra, { divider: true }, ...deduped];
  }, [filteredBaseMenu, status, isAgent]);

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
          <button
            onClick={handleBack}
            className={`p-2.5 rounded-full backdrop-blur-md active:scale-95 transition-all shadow-sm ${
              isScrolled
                ? "bg-white/10 text-white"
                : "bg-black/40 text-white border border-white/10"
            }`}
          >
            <Icon icon="solar:arrow-left-linear" className="text-xl" />
          </button>
        ) : (
          <div className="w-10 h-10" />
        )}

        {/* LOGO */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
          <div className="relative w-8 h-8">
            <Image
              src="/images/logo/LogoSolusindoPremier.png"
              alt="Logo Premier"
              fill
              className="object-contain"
              priority
            />
          </div>
          <span className="text-xl font-bold tracking-tight">
            <span className="text-white">Solusindo</span>
            <span className="text-[#86efac] ml-1">Aset</span>
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
                      src="/images/logo/LogoSolusindoPremier.png"
                      alt="Logo Premier"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-base font-bold text-white leading-tight">
                      Solusindo Aset
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
                              openSubmenu === idx ||
                              menuItem.submenu?.some((s: any) => matchesPath(s.href, pathname))
                                ? "bg-[#86efac]/10 text-[#86efac]"
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
                                      className={`flex items-center gap-3 px-6 py-3 text-sm transition-all ${
                                        matchesPath(sub.href, pathname)
                                          ? "text-[#86efac] bg-[#86efac]/5 font-medium"
                                          : "text-gray-400 hover:text-white hover:bg-white/5"
                                      }`}
                                    >
                                      {sub.icon && (
                                        <Icon
                                          icon={sub.icon}
                                          className="text-lg text-[#86efac]"
                                        />
                                      )}
                                      {sub.label}
                                      {matchesPath(sub.href, pathname) && (
                                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#86efac]" />
                                      )}
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
                          className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-medium ${
                            matchesPath(menuItem.href, pathname)
                              ? "bg-[#86efac]/10 text-[#86efac]"
                              : "text-gray-300 hover:text-white hover:bg-white/5"
                          }`}
                        >
                          {menuItem.icon && (
                            <Icon
                              icon={menuItem.icon}
                              className="text-lg text-[#86efac]"
                            />
                          )}
                          {menuItem.label}
                          {matchesPath(menuItem.href, pathname) && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#86efac]" />
                          )}
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
    matchesPath(item.href, pathUrl) ||
    item.submenu?.some((sub: any) => matchesPath(sub.href, pathUrl));

  return (
    <div
      className="relative h-full flex items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link
        href={item.submenu ? "#" : item.href}
        className={`relative flex items-center gap-1 text-sm font-bold transition-colors py-2 ${
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
        {isActive && (
          <span className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-[#86efac]" />
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
              {item.submenu.map((subItem: any, index: number) => {
                const isSubActive = matchesPath(subItem.href, pathUrl);
                return (
                <Link
                  key={index}
                  href={subItem.href}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all group ${
                    isSubActive
                      ? "bg-[#86efac]/10"
                      : "hover:bg-white/5"
                  }`}
                >
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    isSubActive
                      ? "bg-[#86efac]/20 text-[#86efac]"
                      : "bg-white/5 text-gray-400 group-hover:text-[#86efac] group-hover:bg-[#86efac]/10"
                  }`}>
                    <Icon
                      icon={subItem.icon || "solar:link-circle-linear"}
                      className="text-lg"
                    />
                  </div>
                  <div className="flex-1">
                    <span className={`block text-sm font-medium transition-colors ${
                      isSubActive ? "text-[#86efac]" : "text-gray-300 group-hover:text-white"
                    }`}>
                      {subItem.label}
                    </span>
                    {subItem.description && (
                      <span className="text-[10px] text-gray-500 block leading-tight mt-0.5">
                        {subItem.description}
                      </span>
                    )}
                  </div>
                  {isSubActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#86efac] shrink-0" />
                  )}
                </Link>
                );
              })}
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
  const [isForgotOpen, setIsForgotOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setSticky(window.scrollY >= 40);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow =
      isSignInOpen || isSignUpOpen || isForgotOpen ? "hidden" : "";
  }, [isSignInOpen, isSignUpOpen, isForgotOpen]);

  // ── Capture referral klien ─────────────────────────────────────────────
  // Link /r/AG### -> redirect ke "/?ref=AG###&daftar=1". Di sini kita:
  //  1) simpan kode ke localStorage + cookie (prefill modal daftar, 3 hari)
  //  2) buka modal Daftar otomatis (hanya untuk pengunjung yang belum login)
  //  3) bersihkan query agar tidak terbuka lagi saat refresh / di-share
  useEffect(() => {
    if (typeof window === "undefined" || status === "loading") return;

    let params: URLSearchParams;
    try {
      params = new URLSearchParams(window.location.search);
    } catch {
      return;
    }

    const ref = params.get("ref");
    const wantDaftar = params.get("daftar") === "1";

    if (ref) {
      const code = ref.trim().toUpperCase();
      try {
        localStorage.setItem("ref_code", code);
        document.cookie = `ref_code=${encodeURIComponent(code)}; path=/; max-age=${60 * 60 * 24 * 3}; samesite=lax`;
      } catch {
        /* ignore */
      }
    }

    if ((ref || wantDaftar) && status !== "authenticated") {
      setIsSignUpOpen(true);
    }

    if (params.has("ref") || params.has("daftar")) {
      params.delete("ref");
      params.delete("daftar");
      const qs = params.toString();
      const newUrl =
        window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
      window.history.replaceState(null, "", newUrl);
    }
  }, [status]);

  const handleLogout = () => {
    signOut({ callbackUrl: "/" });
    setProfileDropdownOpen(false);
  };

  // ✅ PERAN: pakai session.user.peran (baru), fallback ke role (lama)
  const peran = (session?.user as any)?.peran || (session?.user as any)?.role || "USER";
  const isAgent = status === "authenticated" && peran === "AGENT";

  // ✅ "Gabung jadi agent" hanya muncul untuk:
  // - unauthenticated
  // - authenticated tapi USER
  const canJoinAgent =
    status !== "authenticated" || (status === "authenticated" && peran === "USER");

  // ✅ menu computed:
  // - sisipkan dashboard hanya jika isAgent
  // - buang "Gabung Jadi Agent" jika !canJoinAgent
  const computedMenu = React.useMemo(() => {
    // 1) filter headerData untuk join agent
    const isJoinAgentItem = (it: any) =>
      String(it?.href || "").startsWith("/gabung-jadi-agent") ||
      String(it?.label || "").toLowerCase().includes("gabung jadi agent");

    // ✅ "Titip Jual" hanya untuk USER (belum jadi agent).
    // Agent sudah punya akses listing lewat dashboard, jadi menu ini disembunyikan.
    const isTitipJualItem = (it: any) =>
      String(it?.href || "").startsWith("/titip-jual") ||
      String(it?.label || "").toLowerCase().includes("titip jual");

    const deepFilter = (items: any[]): any[] =>
      (items || [])
        .map((it) => {
          if (it?.submenu?.length) {
            return { ...it, submenu: deepFilter(it.submenu) };
          }
          return it;
        })
        .filter((it) => {
          if (!canJoinAgent && isJoinAgentItem(it)) return false;
          if (isAgent && isTitipJualItem(it)) return false;
          if (it?.submenu && Array.isArray(it.submenu) && it.submenu.length === 0) return false;
          return true;
        });

    const base = deepFilter([...headerData]);

    // 2) inject dashboard jika agent
    if (!isAgent) return base;

    const dashboardItem = { label: "Dashboard", href: "/dashboard" };

    const idx = base.findIndex((m) => m.label === "Cari Properti");
    if (idx === -1) return [dashboardItem, ...base];

    const withDashboard = [...base];
    withDashboard.splice(idx + 1, 0, dashboardItem);
    return withDashboard;
  }, [isAgent, canJoinAgent]);

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
        canJoinAgent={canJoinAgent}
        onLogout={handleLogout}
        baseMenu={computedMenu}
      />

      {/* DESKTOP HEADER */}
      <header
        className={`hidden lg:flex lg:items-center fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
          sticky
            ? "bg-[#0F0F0F]/80 backdrop-blur-md border-b border-white/5 h-[72px]"
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
                          {isAgent ? (
                            <p className="text-[11px] text-emerald-300 font-medium mt-1">
                              Agent Premier
                            </p>
                          ) : (
                            <p className="text-[11px] text-white/45 font-medium mt-1">
                              User
                            </p>
                          )}
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

                        {/* ✅ dashboard hanya jika agent */}
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
      <AuthModal
        open={isSignInOpen}
        onClose={() => setIsSignInOpen(false)}
        variant="signin"
      >
        <Signin
          hideBrand
          closeModal={() => setIsSignInOpen(false)}
          openSignupModal={() => {
            setIsSignInOpen(false);
            setIsSignUpOpen(true);
          }}
          openForgotModal={() => {
            setIsSignInOpen(false);
            setIsForgotOpen(true);
          }}
        />
      </AuthModal>

      <AuthModal
        open={isSignUpOpen}
        onClose={() => setIsSignUpOpen(false)}
        variant="signup"
      >
        <SignUp
          hideBrand
          closeModal={() => setIsSignUpOpen(false)}
          openSigninModal={() => {
            setIsSignUpOpen(false);
            setIsSignInOpen(true);
          }}
        />
      </AuthModal>

      {/* FORGOT PASSWORD MODAL */}
      <AuthModal
        open={isForgotOpen}
        onClose={() => setIsForgotOpen(false)}
        variant="forgot"
      >
        <ForgotPasswordFlow
          hideBrand
          onClose={() => setIsForgotOpen(false)}
          onBackToSignin={() => {
            setIsForgotOpen(false);
            setIsSignInOpen(true);
          }}
        />
      </AuthModal>
    </>
  );
};

export default Header;

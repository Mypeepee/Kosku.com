// src/app/dashboard/components/topbar.tsx
"use client";

import { Icon } from "@iconify/react";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import GlobalSearch from "./global-search";
import NotificationBell from "./NotificationBell";

type DashboardTopbarProps = {
  onOpenMobileSidebar?: () => void;
};

export default function DashboardTopbar({
  onOpenMobileSidebar,
}: DashboardTopbarProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click (works on touch devices)
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 sm:gap-3 border-b border-white/5 bg-[#050608]/90 backdrop-blur px-3 sm:px-5 py-3 sm:py-4">

      {/* Burger — mobile only, shrink-0 so it never gets squeezed */}
      <button
        type="button"
        onClick={onOpenMobileSidebar}
        className="flex md:hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#050608] text-slate-200 hover:bg-white/5 active:scale-95 transition-transform"
      >
        <Icon icon="solar:hamburger-menu-linear" className="h-4 w-4" />
      </button>

      {/* Search — grows to fill space, min-w-0 prevents flex overflow */}
      <div className="flex-1 min-w-0">
        <GlobalSearch />
      </div>

      {/* Right: notif + profile — shrink-0 so they're NEVER cut off */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <NotificationBell />

        {/* Profile dropdown */}
        <div
          ref={profileRef}
          className="relative"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen((s) => !s)}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-[#050608] p-[3px] sm:pl-1.5 sm:pr-3 sm:py-1 hover:bg-white/5 active:scale-95 transition-all"
            aria-label="Menu profil"
          >
            {/* Avatar */}
            <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-full overflow-hidden bg-white/5 border border-white/10 relative">
              {session?.user?.image ? (
                <Image
                  src={session.user.image}
                  alt="Profile"
                  fill
                  sizes="36px"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <Icon icon="solar:user-circle-bold" className="text-base sm:text-lg" />
                </div>
              )}
            </div>
            {/* Name + arrow — only on sm+ */}
            <span className="hidden sm:inline text-xs font-medium text-slate-200 max-w-[120px] truncate">
              {session?.user?.name || "Owner"}
            </span>
            <Icon
              icon="solar:alt-arrow-down-linear"
              className="hidden sm:block text-slate-500 text-xs transition-transform duration-200"
              style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>

          {/* Dropdown */}
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute right-0 mt-2 w-56 bg-[#101015] border border-white/10 rounded-xl shadow-2xl shadow-black/60 overflow-hidden z-30"
              >
                {/* User info header */}
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Masuk sebagai</p>
                  <p className="mt-0.5 text-sm font-semibold text-white truncate">
                    {session?.user?.name || "Pengguna"}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {session?.user?.email}
                  </p>
                </div>

                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-emerald-300 transition-colors"
                >
                  <Icon icon="solar:user-id-bold" className="text-base shrink-0" />
                  Profil Saya
                </Link>

                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-left"
                >
                  <Icon icon="solar:logout-2-bold" className="text-base shrink-0" />
                  Keluar
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

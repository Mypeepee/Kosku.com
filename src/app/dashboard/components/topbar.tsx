"use client";

import { Icon } from "@iconify/react";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export default function DashboardTopbar() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  return (
    <div
      className="
        sticky top-0 z-20
        flex items-center justify-between gap-4
        border-b border-white/5
        bg-[#050608]/90 backdrop-blur
        px-5 py-6          /* >>> SAMA dgn aside: px-5 py-6 */
      "
    >
      {/* LEFT: search */}
      <div className="flex flex-1 items-center gap-3">
        <div className="flex flex-1 items-center rounded-full bg-[#0b0d11] px-4 py-2 border border-white/5">
          <Icon
            icon="solar:magnifer-linear"
            className="mr-2 h-4 w-4 text-slate-500"
          />
          <input
            type="text"
            placeholder="Cari listing, agent, atau client..."
            className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-500 text-slate-100"
          />
        </div>
      </div>

      {/* RIGHT: notif + profile */}
      <div className="hidden sm:flex items-center gap-2">
        <button className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#050608] text-slate-200 hover:bg-white/5">
          <Icon icon="solar:bell-linear" className="h-4 w-4" />
        </button>

        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-[#050608] pl-1 pr-3 py-1 hover:bg-white/5 transition-colors"
          >
            <div className="w-10 h-10 rounded-full overflow-hidden bg-white/5 border border-white/10 relative">
              {session?.user?.image ? (
                <Image
                  src={session.user.image}
                  alt="Profile"
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <Icon icon="solar:user-circle-bold" className="text-xl" />
                </div>
              )}
            </div>
            <span className="hidden md:inline text-xs font-medium text-slate-200 max-w-[140px] truncate">
              {session?.user?.name || "Owner"}
            </span>
            <Icon
              icon="solar:alt-arrow-down-linear"
              className="text-slate-500 text-xs md:text-sm"
            />
          </button>

          {/* Dropdown profil mirip header */}
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.18 }}
                className="absolute right-0 mt-2 w-52 bg-[#101015] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-30"
              >
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="text-xs text-gray-400">Masuk sebagai</p>
                  <p className="text-sm font-semibold text-white truncate">
                    {session?.user?.name || "Pengguna"}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">
                    {session?.user?.email}
                  </p>
                </div>

                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-[#86efac] transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <Icon icon="solar:user-id-bold" className="text-lg" />
                  Profil Saya
                </Link>

                <button
                  onClick={() => {
                    setOpen(false);
                    signOut({ callbackUrl: "/" });
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-left"
                >
                  <Icon icon="solar:logout-2-bold" className="text-lg" />
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

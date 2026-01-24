// src/app/dashboard/components/mobile-sidebar.tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const homepageMenu = [
  { label: "Dashboard", icon: "solar:widget-5-linear", href: "/dashboard" },
  { label: "Listings", icon: "solar:buildings-3-linear", href: "/dashboard/listings" },
  { label: "Leads & Clients", icon: "solar:users-group-two-rounded-linear", href: "/dashboard/leads" },
  { label: "Agents", icon: "solar:user-id-linear", href: "/dashboard/agents" },
  { label: "Analytics", icon: "solar:chart-square-linear", href: "/dashboard/analytics" },
  { label: "Tasks & HRM", icon: "solar:clipboard-check-linear", href: "/dashboard/tasks" },
];

type MobileSidebarProps = {
  open: boolean;
  onClose: () => void;
};

export default function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.aside
            className="
              fixed inset-y-0 left-0 z-50 w-72
              bg-[#040608] border-r border-white/10
              px-5 py-6
              md:hidden
            "
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: "tween", duration: 0.2 }}
          >
            <div className="mb-6 flex items-center justify-between">
              <span className="text-lg font-bold text-white">
                Premier <span className="text-emerald-400">Asset</span>
              </span>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-slate-300 hover:bg-white/5"
              >
                <Icon icon="solar:close-circle-linear" className="text-lg" />
              </button>
            </div>

            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Homepage
            </p>
            <nav className="space-y-1.5">
              {homepageMenu.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={onClose}
                    className={[
                      "flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm transition-all duration-150",
                      active
                        ? "bg-emerald-500/12 text-emerald-200 border border-emerald-400/40"
                        : "text-slate-300 border border-transparent hover:bg-white/5 hover:text-emerald-200",
                    ].join(" ")}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#050608] border border-white/10">
                      <Icon
                        icon={item.icon}
                        className={
                          active
                            ? "text-emerald-300 text-[20px]"
                            : "text-slate-400 text-[20px]"
                        }
                      />
                    </div>
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

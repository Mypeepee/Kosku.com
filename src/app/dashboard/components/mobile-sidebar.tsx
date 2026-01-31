// src/app/dashboard/components/mobile-sidebar.tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { homepageMenu, appsMenu, type MenuItem } from "./list-menu";

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
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Sidebar */}
          <motion.aside
            className="
              fixed inset-y-0 left-0 z-50 w-72
              bg-[#040608] border-r border-white/10
              px-5 py-6 overflow-y-auto
              md:hidden
            "
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: "tween", duration: 0.2 }}
          >
            {/* Header */}
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

            {/* Homepage Section */}
            <SectionLabel>Homepage</SectionLabel>
            <nav className="mb-6 space-y-1.5">
              {homepageMenu.map((item) => (
                <MobileSidebarItem
                  key={item.label}
                  item={item}
                  active={pathname === item.href}
                  onClose={onClose}
                />
              ))}
            </nav>

            {/* Divider */}
            <div className="my-3 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* Apps Section */}
            <SectionLabel>Apps</SectionLabel>
            <nav className="mb-2 space-y-1.5">
              {appsMenu.map((item) => (
                <MobileSidebarItem
                  key={item.label}
                  item={item}
                  active={pathname === item.href}
                  onClose={onClose}
                />
              ))}
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
      {children}
    </p>
  );
}

function MobileSidebarItem({
  item,
  active,
  onClose,
}: {
  item: MenuItem;
  active?: boolean;
  onClose: () => void;
}) {
  const isLink = Boolean(item.href);
  const base =
    "flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm transition-all duration-150";
  const state = active
    ? "bg-emerald-500/12 text-emerald-200 border border-emerald-400/40"
    : "text-slate-300 border border-transparent hover:bg-white/5 hover:text-emerald-200";

  const content = (
    <>
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
      <span className="truncate text-[0.95rem]">{item.label}</span>
      {item.href && (
        <Icon
          icon="solar:alt-arrow-right-linear"
          className="ml-auto text-[16px] text-slate-500"
        />
      )}
    </>
  );

  if (isLink) {
    return (
      <Link href={item.href!} onClick={onClose} className={`${base} ${state}`}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClose} className={`${base} ${state}`}>
      {content}
    </button>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { usePathname } from "next/navigation";

const homepageMenu = [
  { label: "Dashboard", icon: "solar:widget-5-linear", href: "/dashboard" },
  { label: "Listings", icon: "solar:buildings-3-linear", href: "/dashboard/listings" },
  { label: "Leads & Clients", icon: "solar:users-group-two-rounded-linear", href: "/dashboard/leads" },
  { label: "Agents", icon: "solar:user-id-linear", href: "/dashboard/agents" },
  { label: "Analytics", icon: "solar:chart-square-linear", href: "/dashboard/analytics" },
  { label: "Tasks & HRM", icon: "solar:clipboard-check-linear", href: "/dashboard/tasks" },
];

const appsMenu = [
  { label: "E-commerce", icon: "solar:bag-4-linear" },
  { label: "CRM", icon: "solar:card-linear" },
  { label: "Invoice", icon: "solar:bill-list-linear" },
  { label: "E-mail", icon: "solar:letter-linear" },
  { label: "Events", icon: "solar:calendar-linear" },
  { label: "Kanban", icon: "solar:rows-3-linear" },
  { label: "Hiring", icon: "solar:briefcase-linear" },
  { label: "Chat", icon: "solar:chat-round-dots-linear" },
  { label: "Social", icon: "solar:share-circle-linear" },
];

export function OwnerSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="
        hidden md:flex w-72 flex-col border-r border-white/5 bg-[#040608] px-5 py-6
        overflow-y-auto
      "
    >
      {/* Logo + text clickable ke home, glow halus hanya saat hover */}
      <Link
        href="/"
        className="
          group relative
          mb-8 flex items-center gap-2.5 px-1
          rounded-2xl
          transition-all duration-300
        "
      >
        <div className="relative">
          {/* Glow belakang logo */}
          <div
            className="
              pointer-events-none absolute inset-0
              rounded-full
              bg-emerald-500/0
              blur-2xl
              transition-all duration-500
              group-hover:bg-emerald-500/35
              group-hover:scale-125
            "
          />
          <Image
            src="/images/logo/logopremier.svg"
            alt="Logo Premier"
            width={40}
            height={40}
            className="
              relative z-10 w-10 h-10 object-contain
              transition-transform duration-300
              group-hover:scale-105
            "
          />
        </div>

        <span
          className="
            text-2xl font-bold tracking-tight
            transition-colors duration-300
            group-hover:text-white
          "
        >
          <span className="text-white">Premier</span>
          <span className="ml-1 text-[#86efac] group-hover:text-emerald-300">
            Asset
          </span>
        </span>

        {/* highlight halus di belakang teks + logo */}
        <div
          className="
            pointer-events-none absolute inset-0 -z-10
            opacity-0 group-hover:opacity-100
            transition-opacity duration-500
          "
        >
          <div className="mx-0.5 mt-1 h-9 rounded-2xl bg-emerald-500/6" />
        </div>
      </Link>

      {/* HOME SECTION */}
      <SectionLabel>Homepage</SectionLabel>
      <nav className="mb-6 space-y-1">
        {homepageMenu.map((item) => (
          <SidebarItem
            key={item.label}
            item={item}
            active={pathname === item.href}
          />
        ))}
      </nav>

      {/* Divider subtle */}
      <div className="my-3 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* APPS SECTION */}
      <SectionLabel>Apps</SectionLabel>
      <nav className="mb-2 space-y-1">
        {appsMenu.map((item) => (
          <SidebarItem key={item.label} item={item} />
        ))}
      </nav>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 mt-2 px-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
      {children}
    </p>
  );
}

function SidebarItem({
  item,
  active,
}: {
  item: { label: string; icon: string; href?: string };
  active?: boolean;
}) {
  const Component = item.href ? Link : "button";
  const base =
    "group flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm transition-all duration-150";

  const state = active
    ? "bg-emerald-500/12 text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.45)] border border-emerald-400/40"
    : "text-slate-300 hover:bg-white/5 hover:text-emerald-200 border border-transparent";

  return (
    <Component
      // @ts-expect-error href hanya untuk Link
      href={item.href || "#"}
      className={`${base} ${state}`}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#050608] border border-white/10 group-hover:border-emerald-400/50">
        <Icon
          icon={item.icon}
          className={
            active
              ? "text-emerald-300 text-[20px]"
              : "text-slate-400 group-hover:text-emerald-300 text-[20px]"
          }
        />
      </div>

      <span className="truncate text-[0.95rem]">{item.label}</span>

      {item.href && (
        <Icon
          icon="solar:alt-arrow-right-linear"
          className="ml-auto text-[16px] text-slate-500 group-hover:text-emerald-300"
        />
      )}
    </Component>
  );
}

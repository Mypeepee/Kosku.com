// app/dashboard/layout.tsx
"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { OwnerSidebar } from "@/app/dashboard/components/sidebar";
import DashboardTopbar from "@/app/dashboard/components/topbar";
import MobileSidebar from "@/app/dashboard/components/mobile-sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#050608] text-slate-50">
      {/* Sidebar desktop */}
      <OwnerSidebar />

      {/* Kanan: topbar + konten */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardTopbar onOpenMobileSidebar={() => setMobileOpen(true)} />

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-5 pb-6">
            {children}
          </div>
        </div>
      </div>

      {/* Sidebar mobile (drawer) */}
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </div>
  );
}

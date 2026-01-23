"use client";

import { OwnerSidebar } from "./sidebar";

type DashboardShellProps = {
  children: React.ReactNode;
};

export default function DashboardShell({ children }: DashboardShellProps) {
  return (
    // tinggi full viewport → biar yang scroll hanya child yang di-set overflow
    <div className="flex h-screen bg-[#050608] text-slate-50">
      {/* kiri: sidebar (scroll sendiri) */}
      <OwnerSidebar />

      {/* kanan: konten (scroll sendiri) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

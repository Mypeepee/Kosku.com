"use client";

import type { ReactNode } from "react";
import DashboardTopbar from "@/app/dashboard/components/topbar";
import MobileSidebar from "@/app/dashboard/components/mobile-sidebar";
import {
  DashboardOverlayProvider,
  useDashboardOverlay,
} from "@/app/dashboard/components/overlay-context";

function Chrome({ children }: { children: ReactNode }) {
  const { isOpen, close } = useDashboardOverlay();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 sm:px-5 pb-6">{children}</div>
      </div>

      <MobileSidebar open={isOpen("sidebar")} onClose={() => close("sidebar")} />
    </div>
  );
}

export default function DashboardMobileWrapper({ children }: { children: ReactNode }) {
  // Provider membungkus topbar + sidebar supaya keduanya berbagi satu
  // state overlay — mustahil dua overlay terbuka bersamaan.
  return (
    <DashboardOverlayProvider>
      <Chrome>{children}</Chrome>
    </DashboardOverlayProvider>
  );
}

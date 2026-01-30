import React from "react";
import { Icon } from "@iconify/react";

type SidebarTabId = "profile" | "data-penting" | "booking" | "reward";

type Props = {
  activeTab: SidebarTabId;
  setActiveTab: (tab: SidebarTabId) => void;
  onSignOut: () => void;
  role: "USER" | "AGENT" | string;
};

const ProfileSidebar = ({ activeTab, setActiveTab, onSignOut, role }: Props) => {
  const isAgent = role === "AGENT";

  const agentTabs: { id: SidebarTabId; label: string; icon: string; subtitle?: string }[] = [
    {
      id: "profile",
      label: "Profil",
      icon: "solar:user-id-bold",
      subtitle: "Data diri & kontak",
    },
    {
      id: "data-penting",
      label: "Data Penting",
      icon: "solar:shield-user-bold",
      subtitle: "Data agent & verifikasi",
    },
    {
      id: "booking",
      label: "Transaksi",
      icon: "solar:wallet-money-bold",
      subtitle: "Riwayat dan status",
    },
    {
      id: "reward",
      label: "Zona Hadiah",
      icon: "solar:gift-bold",
      subtitle: "Poin & penukaran",
    },
  ];

  const userTabs: { id: SidebarTabId; label: string; icon: string; subtitle?: string }[] = [
    {
      id: "profile",
      label: "Profil",
      icon: "solar:user-id-bold",
      subtitle: "Data diri & kontak",
    },
    {
      id: "booking",
      label: "Transaksi",
      icon: "solar:history-bold",
      subtitle: "Riwayat sewa & beli",
    },
  ];

  const tabs = isAgent ? agentTabs : userTabs;

  return (
    <aside className="w-full lg:w-72 shrink-0 z-30">
      <div className="bg-[#181818] rounded-2xl border border-white/5 p-2 sm:p-3 sticky top-20 lg:top-28">
        <p className="text-[10px] font-bold text-gray-500 px-4 py-2 uppercase tracking-widest lg:block hidden">
          Menu Akun
        </p>

        <nav className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible no-scrollbar pb-1 lg:pb-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center justify-between lg:justify-start gap-2 sm:gap-3 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex-shrink-0
                  ${
                    isActive
                      ? "bg-[#86efac] text-black shadow-[0_0_20px_rgba(134,239,172,0.2)]"
                      : "text-gray-400 hover:bg-white/5 hover:text-white bg-white/5 lg:bg-transparent"
                  }
                `}
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <Icon
                    icon={tab.icon}
                    className={`text-base sm:text-lg ${
                      isActive ? "text-black" : "text-gray-300"
                    }`}
                  />
                  <div className="flex flex-col items-start min-w-0">
                    <span className="truncate">{tab.label}</span>
                    {tab.subtitle && (
                      <span className="hidden lg:inline text-[10px] font-normal text-gray-500 truncate">
                        {tab.subtitle}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          <div className="h-px bg-white/10 my-2 hidden lg:block" />

          <button
  onClick={onSignOut}
  className="
    flex items-center gap-3 px-4 py-3 rounded-xl
    text-xs sm:text-sm font-bold
    text-red-400 hover:bg-red-500/10 hover:text-red-300
    transition-all
    flex-shrink-0      /* jadi pill di mobile */
    lg:w-full lg:flex-shrink /* full width di lg ke atas */
  "
>
  <Icon icon="solar:logout-2-bold" className="text-lg" />
  <span className="hidden sm:inline">Keluar</span>
  <span className="sm:hidden">Exit</span>
</button>

        </nav>
      </div>
    </aside>
  );
};

export default ProfileSidebar;

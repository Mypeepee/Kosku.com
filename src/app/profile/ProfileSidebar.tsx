import React from "react";
import { Icon } from "@iconify/react";

type Props = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onSignOut: () => void;
};

const ProfileSidebar = ({ activeTab, setActiveTab, onSignOut }: Props) => {
  return (
    <aside className="w-full lg:w-72 shrink-0 z-30">
      <div className="bg-[#181818] rounded-2xl border border-white/5 p-2 sm:p-3 sticky top-20 lg:top-28">
        <p className="text-[10px] font-bold text-gray-500 px-4 py-2 uppercase tracking-widest lg:block hidden">
          Menu Akun
        </p>

        <nav className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible no-scrollbar pb-1 lg:pb-0">
          {[
            { id: "profile", label: "Profil", icon: "solar:user-id-bold" },
            { id: "booking", label: "Sewa", icon: "solar:history-bold" },
            { id: "reward", label: "Reward Zone", icon: "solar:gift-bold" },
            { id: "security", label: "Keamanan", icon: "solar:shield-keyhole-bold" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 sm:gap-3 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex-shrink-0
                ${
                  activeTab === tab.id
                    ? "bg-[#86efac] text-black shadow-[0_0_20px_rgba(134,239,172,0.2)]"
                    : "text-gray-400 hover:bg-white/5 hover:text-white bg-white/5 lg:bg-transparent"
                }
              `}
            >
              <Icon icon={tab.icon} className="text-base sm:text-lg" />
              {tab.label}
            </button>
          ))}

          <div className="h-px bg-white/10 my-2 hidden lg:block"></div>

          <button
            onClick={onSignOut}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all w-full flex-shrink-0 lg:flex-shrink"
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
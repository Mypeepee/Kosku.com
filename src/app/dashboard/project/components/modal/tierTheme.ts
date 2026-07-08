import { Crown, Gem, Rocket, Shield } from "lucide-react";

import type { ModalTierTheme } from "./types";

export type TierTheme = ModalTierTheme & {
  deskripsi: string;
  shortcut: string;
  shortcutHover: string;
};

/**
 * Investor tier styling derived from total invested funds. Shared by the
 * wallet card (create flow) and the edit modal so both surfaces render with a
 * single, consistent source of truth.
 */
export function getTierTheme(totalDana: number): TierTheme {
  if (totalDana < 20_000_000) {
    return {
      nama: "Power Investor",
      deskripsi:
        "Tier awal untuk investor yang baru mulai membangun portofolio pendanaan.",
      shell:
        "border-emerald-400/15 bg-[linear-gradient(135deg,#06110d_0%,#0a1914_30%,#0e241c_65%,#123126_100%)]",
      overlay:
        "bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.20),transparent_24%),radial-gradient(circle_at_85%_18%,rgba(52,211,153,0.14),transparent_18%),radial-gradient(circle_at_50%_120%,rgba(45,212,191,0.10),transparent_28%)]",
      edgeGlow: "shadow-[0_30px_120px_rgba(16,185,129,0.12)]",
      orbA: "bg-emerald-400/18",
      orbB: "bg-teal-300/14",
      orbC: "bg-lime-200/8",
      badge: "border-emerald-400/20 bg-emerald-500/12 text-emerald-300",
      shortcut: "border-white/10 bg-white/[0.05]",
      shortcutHover: "hover:border-emerald-400/24 hover:bg-white/[0.07]",
      actionButton:
        "bg-[linear-gradient(135deg,#34d399_0%,#4ade80_55%,#86efac_100%)] text-[#07110b] hover:brightness-110",
      accentText: "text-emerald-300",
      modalField: "border-white/10 bg-white/[0.05]",
      modalFieldFocus:
        "focus:border-emerald-400/40 focus:bg-white/[0.07] focus:ring-2 focus:ring-emerald-400/10",
      modalMutedButton: "border-white/10 bg-white/[0.04]",
      modalMutedButtonHover:
        "hover:bg-white/[0.08] hover:border-emerald-400/24",
      icon: Rocket,
    };
  }

  if (totalDana < 100_000_000) {
    return {
      nama: "Crown Investor",
      deskripsi:
        "Tier menengah untuk investor dengan nominal pendanaan yang sudah semakin serius.",
      shell:
        "border-rose-400/15 bg-[linear-gradient(135deg,#12070c_0%,#1b0b12_28%,#27101a_62%,#341320_100%)]",
      overlay:
        "bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.20),transparent_24%),radial-gradient(circle_at_84%_18%,rgba(251,113,133,0.14),transparent_18%),radial-gradient(circle_at_50%_120%,rgba(217,70,239,0.10),transparent_28%)]",
      edgeGlow: "shadow-[0_30px_120px_rgba(244,63,94,0.12)]",
      orbA: "bg-rose-400/18",
      orbB: "bg-fuchsia-300/14",
      orbC: "bg-pink-200/8",
      badge: "border-rose-400/20 bg-rose-500/12 text-rose-300",
      shortcut: "border-white/10 bg-white/[0.05]",
      shortcutHover: "hover:border-rose-400/24 hover:bg-white/[0.07]",
      actionButton:
        "bg-[linear-gradient(135deg,#fb7185_0%,#f43f5e_60%,#e11d48_100%)] text-white hover:brightness-110",
      accentText: "text-rose-300",
      modalField: "border-white/10 bg-white/[0.05]",
      modalFieldFocus:
        "focus:border-rose-400/40 focus:bg-white/[0.07] focus:ring-2 focus:ring-rose-400/10",
      modalMutedButton: "border-white/10 bg-white/[0.04]",
      modalMutedButtonHover: "hover:bg-white/[0.08] hover:border-rose-400/24",
      icon: Crown,
    };
  }

  if (totalDana < 500_000_000) {
    return {
      nama: "Royal Investor",
      deskripsi:
        "Tier tinggi untuk investor dengan posisi pendanaan besar dan portofolio yang matang.",
      shell:
        "border-amber-300/15 bg-[linear-gradient(135deg,#140f06_0%,#1d1508_28%,#2a1e0b_62%,#38280e_100%)]",
      overlay:
        "bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.20),transparent_24%),radial-gradient(circle_at_84%_18%,rgba(253,224,71,0.14),transparent_18%),radial-gradient(circle_at_50%_120%,rgba(245,158,11,0.10),transparent_28%)]",
      edgeGlow: "shadow-[0_30px_120px_rgba(251,191,36,0.12)]",
      orbA: "bg-amber-300/18",
      orbB: "bg-yellow-200/14",
      orbC: "bg-orange-200/8",
      badge: "border-amber-300/22 bg-amber-400/12 text-amber-200",
      shortcut: "border-white/10 bg-white/[0.05]",
      shortcutHover: "hover:border-amber-300/24 hover:bg-white/[0.07]",
      actionButton:
        "bg-[linear-gradient(135deg,#fbbf24_0%,#f59e0b_58%,#fcd34d_100%)] text-[#1b1205] hover:brightness-110",
      accentText: "text-amber-200",
      modalField: "border-white/10 bg-white/[0.05]",
      modalFieldFocus:
        "focus:border-amber-300/40 focus:bg-white/[0.07] focus:ring-2 focus:ring-amber-300/10",
      modalMutedButton: "border-white/10 bg-white/[0.04]",
      modalMutedButtonHover:
        "hover:bg-white/[0.08] hover:border-amber-300/24",
      icon: Gem,
    };
  }

  return {
    nama: "Elite Investor",
    deskripsi:
      "Tier tertinggi untuk investor dengan akumulasi modal besar dan eksposur pendanaan premium.",
    shell:
      "border-slate-300/16 bg-[linear-gradient(135deg,#090c11_0%,#10151d_28%,#171e28_62%,#202734_100%)]",
    overlay:
      "bg-[radial-gradient(circle_at_top_left,rgba(203,213,225,0.18),transparent_24%),radial-gradient(circle_at_84%_18%,rgba(148,163,184,0.14),transparent_18%),radial-gradient(circle_at_50%_120%,rgba(244,244,245,0.08),transparent_28%)]",
    edgeGlow: "shadow-[0_30px_120px_rgba(148,163,184,0.12)]",
    orbA: "bg-slate-300/16",
    orbB: "bg-zinc-200/12",
    orbC: "bg-white/8",
    badge: "border-slate-300/22 bg-slate-400/12 text-slate-100",
    shortcut: "border-white/10 bg-white/[0.05]",
    shortcutHover: "hover:border-slate-300/24 hover:bg-white/[0.07]",
    actionButton:
      "bg-[linear-gradient(135deg,#e2e8f0_0%,#94a3b8_58%,#cbd5e1_100%)] text-[#090c10] hover:brightness-110",
    accentText: "text-slate-200",
    modalField: "border-white/10 bg-white/[0.05]",
    modalFieldFocus:
      "focus:border-slate-300/40 focus:bg-white/[0.07] focus:ring-2 focus:ring-slate-300/10",
    modalMutedButton: "border-white/10 bg-white/[0.04]",
    modalMutedButtonHover:
      "hover:bg-white/[0.08] hover:border-slate-300/24",
    icon: Shield,
  };
}

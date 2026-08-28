import {
  FileCheck2,
  Hammer,
  PiggyBank,
  ShieldCheck,
  Wallet2,
  type LucideIcon,
} from "lucide-react";
import type { WalletKey } from "@/lib/project-kas";

/** Satu tempat untuk warna & ikon tiap pos, dipakai semua komponen dompet. */
export type WalletTheme = {
  icon: LucideIcon;
  badge: string;
  shell: string;
  glow: string;
  border: string;
  badgeClass: string;
  iconWrap: string;
  progress: string;
  /** Kelas ringkas untuk chip/dropdown. */
  chip: string;
  text: string;
  dot: string;
};

export const WALLET_THEME: Record<WalletKey, WalletTheme> = {
  utama: {
    icon: Wallet2,
    badge: "Core Wallet",
    shell:
      "bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.14),transparent_34%),linear-gradient(135deg,rgba(7,18,33,0.98),rgba(7,28,46,0.96))]",
    glow: "shadow-[0_18px_60px_rgba(16,185,129,0.14)]",
    border: "border-emerald-400/20",
    badgeClass: "border-emerald-300/15 bg-emerald-400/10 text-emerald-200",
    iconWrap: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
    progress: "from-emerald-300 via-emerald-400 to-teal-300",
    chip: "border-emerald-300/20 bg-emerald-400/10",
    text: "text-emerald-200",
    dot: "bg-emerald-400",
  },
  dokumen: {
    icon: FileCheck2,
    badge: "Legal Flow",
    shell:
      "bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.14),transparent_34%),linear-gradient(135deg,rgba(7,18,33,0.98),rgba(7,28,46,0.96))]",
    glow: "shadow-[0_18px_60px_rgba(34,211,238,0.14)]",
    border: "border-cyan-400/20",
    badgeClass: "border-cyan-300/15 bg-cyan-400/10 text-cyan-200",
    iconWrap: "border-cyan-300/20 bg-cyan-400/10 text-cyan-200",
    progress: "from-cyan-300 via-sky-400 to-cyan-200",
    chip: "border-cyan-300/20 bg-cyan-400/10",
    text: "text-cyan-200",
    dot: "bg-cyan-400",
  },
  eksekusi: {
    icon: ShieldCheck,
    badge: "Execution",
    shell:
      "bg-[radial-gradient(circle_at_top_left,rgba(253,224,71,0.13),transparent_34%),linear-gradient(135deg,rgba(7,18,33,0.98),rgba(7,28,46,0.96))]",
    glow: "shadow-[0_18px_60px_rgba(245,158,11,0.12)]",
    border: "border-amber-300/20",
    badgeClass: "border-amber-300/15 bg-amber-400/10 text-amber-200",
    iconWrap: "border-amber-300/20 bg-amber-400/10 text-amber-200",
    progress: "from-amber-200 via-amber-400 to-orange-300",
    chip: "border-amber-300/20 bg-amber-400/10",
    text: "text-amber-200",
    dot: "bg-amber-400",
  },
  renovasi: {
    icon: Hammer,
    badge: "Renovation",
    shell:
      "bg-[radial-gradient(circle_at_top_left,rgba(196,181,253,0.14),transparent_34%),linear-gradient(135deg,rgba(7,18,33,0.98),rgba(7,28,46,0.96))]",
    glow: "shadow-[0_18px_60px_rgba(139,92,246,0.12)]",
    border: "border-violet-300/20",
    badgeClass: "border-violet-300/15 bg-violet-400/10 text-violet-200",
    iconWrap: "border-violet-300/20 bg-violet-400/10 text-violet-200",
    progress: "from-violet-200 via-violet-400 to-fuchsia-300",
    chip: "border-violet-300/20 bg-violet-400/10",
    text: "text-violet-200",
    dot: "bg-violet-400",
  },
  cadangan: {
    icon: PiggyBank,
    badge: "Reserve",
    shell:
      "bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,0.14),transparent_34%),linear-gradient(135deg,rgba(7,18,33,0.98),rgba(7,28,46,0.96))]",
    glow: "shadow-[0_18px_60px_rgba(244,63,94,0.12)]",
    border: "border-rose-300/20",
    badgeClass: "border-rose-300/15 bg-rose-400/10 text-rose-200",
    iconWrap: "border-rose-300/20 bg-rose-400/10 text-rose-200",
    progress: "from-rose-200 via-rose-400 to-pink-300",
    chip: "border-rose-300/20 bg-rose-400/10",
    text: "text-rose-200",
    dot: "bg-rose-400",
  },
};

export function walletTheme(key: unknown): WalletTheme {
  return WALLET_THEME[key as WalletKey] ?? WALLET_THEME.utama;
}

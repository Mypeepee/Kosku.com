import { AlertTriangle, HandCoins } from "lucide-react";
import { formatCurrency } from "../lib/format-currency";
import type { WalletSummary } from "../types";
import { walletTheme } from "./wallet-theme";

/**
 * Kartu saldo satu dompet.
 *
 * Angka di sini SELALU berasal dari mesin `@/lib/project-kas` — kartu tidak
 * menghitung apa pun sendiri supaya tak mungkin beda dengan validasi server.
 *
 * Saldo dompet tidak boleh minus. Kalau minus, itu pasti data lama (sebelum
 * aturan talangan berlaku) dan ditampilkan terang-terangan sebagai KEKURANGAN
 * yang harus ditutup investor, bukan sebagai saldo negatif.
 */
export default function WalletCard({
  wallet,
  active,
  onClick,
}: {
  wallet: WalletSummary;
  active?: boolean;
  onClick?: () => void;
}) {
  const theme = walletTheme(wallet.walletKey);
  const Icon = theme.icon;
  const { kekurangan, overBudget } = wallet;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group relative w-full snap-center snap-always overflow-hidden rounded-[30px] border p-6 text-left text-white",
        "min-h-[228px] backdrop-blur-xl transition-colors duration-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60",
        active
          ? "border-cyan-300/40 ring-1 ring-cyan-300/60 shadow-[0_0_0_1px_rgba(103,232,249,0.18),0_24px_80px_rgba(8,145,178,0.18)]"
          : `${theme.border} ${theme.glow}`,
        theme.shell,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_28%,transparent_74%,rgba(255,255,255,0.03))]" />
      <div className="pointer-events-none absolute -right-10 top-0 h-36 w-36 rounded-full bg-white/[0.08] blur-3xl" />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/10" />

      <div className="relative flex h-full flex-col justify-between gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={[
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] border backdrop-blur-md",
                theme.iconWrap,
              ].join(" ")}
            >
              <Icon className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div className="truncate text-base font-medium text-white/90">
                {wallet.title}
              </div>
              <div className="mt-0.5 truncate text-xs text-white/40">
                {wallet.hint}
              </div>
            </div>
          </div>

          <div
            className={[
              "inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.22em]",
              overBudget
                ? "border-amber-300/25 bg-amber-400/10 text-amber-200"
                : theme.badgeClass,
            ].join(" ")}
          >
            {overBudget ? "Perlu ditutup" : theme.badge}
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.24em] text-white/40">
            {overBudget ? "Saldo kurang" : "Saldo dompet"}
          </div>

          <div
            className={[
              "mt-3 min-w-0 text-[clamp(1.8rem,4vw,2.5rem)] font-semibold leading-none tracking-tight",
              overBudget ? "text-amber-300" : "text-white",
            ].join(" ")}
          >
            {formatCurrency(overBudget ? kekurangan : wallet.sisaAnggaran)}
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-sm text-white/45">
            {overBudget ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-300/80" />
                <span>Harus ditalangi investor</span>
              </>
            ) : (
              <span className="truncate">
                Terpakai {formatCurrency(wallet.terpakai)} dari{" "}
                {formatCurrency(wallet.anggaran)}
              </span>
            )}
          </div>

          {wallet.talangan > 0 ? (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-300/15 bg-amber-400/[0.08] px-2.5 py-1 text-[11px] text-amber-100/80">
              <HandCoins className="h-3 w-3 shrink-0" />
              <span>
                Termasuk talangan investor {formatCurrency(wallet.talangan)}
              </span>
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/35">
              Terpakai
            </div>

            <div
              className={[
                "text-lg font-semibold",
                overBudget ? "text-amber-300" : "text-white/85",
              ].join(" ")}
            >
              {wallet.persenTerpakai.toFixed(0)}%
            </div>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className={[
                "h-full rounded-full bg-gradient-to-r transition-all duration-500",
                overBudget
                  ? "from-amber-300 via-amber-400 to-orange-400"
                  : theme.progress,
              ].join(" ")}
              style={{ width: `${wallet.persenTerpakai}%` }}
            />
          </div>
        </div>
      </div>
    </button>
  );
}

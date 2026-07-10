import Link from "next/link";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Lock } from "lucide-react";
import type { WalletKey, WalletSummary } from "../types";
import WalletCard from "./wallet-card";
import { formatCurrency } from "../lib/format-currency";

function ProjectCashSummary({
  danaMasuk,
  danaKeluar,
  sisaKas,
}: {
  danaMasuk: number;
  danaKeluar: number;
  sisaKas: number;
}) {
  const kasEmpty = sisaKas <= 0;

  return (
    <div
      className={[
        "relative overflow-hidden rounded-[30px] border p-6",
        "bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.13),transparent_36%),linear-gradient(135deg,rgba(7,18,33,0.98),rgba(7,28,46,0.96))]",
        "backdrop-blur-xl",
        kasEmpty
          ? "border-rose-400/25 shadow-[0_18px_60px_rgba(244,63,94,0.12)]"
          : "border-sky-400/20 shadow-[0_18px_60px_rgba(56,189,248,0.12)]",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_28%,transparent_74%,rgba(255,255,255,0.03))]" />
      <div className="pointer-events-none absolute -right-10 top-0 h-36 w-36 rounded-full bg-white/8 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/10" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-white/42">
              Cash position
            </div>
            <div className="mt-1 text-base font-semibold text-white/92">
              Kas Proyek
            </div>
          </div>
          <div
            className={[
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.22em]",
              kasEmpty
                ? "border-rose-300/20 bg-rose-400/12 text-rose-300"
                : "border-sky-300/15 bg-sky-400/10 text-sky-200",
            ].join(" ")}
          >
            {kasEmpty ? (
              <>
                <Lock className="h-3 w-3" />
                <span>Kas habis</span>
              </>
            ) : (
              "Real Cash"
            )}
          </div>
        </div>

        {/* Sisa Kas besar */}
        <div className="mt-5">
          <div className="text-[11px] uppercase tracking-[0.24em] text-white/42">
            Sisa kas tersedia
          </div>
          <div
            className={[
              "mt-2 text-[clamp(1.8rem,4vw,2.5rem)] font-semibold leading-none tracking-tight",
              kasEmpty ? "text-rose-300" : "text-white",
            ].join(" ")}
          >
            {formatCurrency(sisaKas)}
          </div>
        </div>

        {/* Dana Masuk / Dana Keluar */}
        <div className="mt-5 grid grid-cols-2 gap-4 rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
          <div>
            <div className="flex items-center gap-1.5">
              <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-400" />
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                Dana masuk
              </div>
            </div>
            <div className="mt-1.5 text-sm font-semibold text-emerald-300">
              {formatCurrency(danaMasuk)}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5 text-rose-400" />
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                Dana keluar
              </div>
            </div>
            <div className="mt-1.5 text-sm font-semibold text-rose-300">
              {formatCurrency(danaKeluar)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WalletGrid({
  wallets,
  selectedWallet,
  onSelectWallet,
  backHref,
  onBack,
  danaMasuk,
  danaKeluar,
  sisaKas,
}: {
  wallets: WalletSummary[];
  selectedWallet: WalletKey | "all";
  onSelectWallet: (value: WalletKey | "all") => void;
  backHref?: string;
  onBack?: () => void;
  danaMasuk?: number;
  danaKeluar?: number;
  sisaKas?: number;
}) {
  const backButtonClasses =
    "inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08]";

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {backHref ? (
            <Link href={backHref} className={backButtonClasses} aria-label="Kembali">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          ) : onBack ? (
            <button
              type="button"
              onClick={onBack}
              className={backButtonClasses}
              aria-label="Kembali"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : null}

          <div>
            <h2 className="text-base font-semibold text-white">
              Dompet Operasional
            </h2>
            <p className="text-sm text-slate-400">
              Pilih dompet untuk fokus ke pos dana tertentu.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSelectWallet("all")}
          className={[
            "self-start rounded-full border px-3 py-1.5 text-xs font-medium transition sm:self-auto",
            selectedWallet === "all"
              ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-200"
              : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.06]",
          ].join(" ")}
        >
          Semua Dompet
        </button>
      </div>

      {/* Kartu ringkas kas riil — di atas grid dompet per pos */}
      {danaMasuk !== undefined && danaKeluar !== undefined && sisaKas !== undefined && (
        <ProjectCashSummary
          danaMasuk={danaMasuk}
          danaKeluar={danaKeluar}
          sisaKas={sisaKas}
        />
      )}

      <div className="-mx-1 overflow-x-auto pb-2 scroll-smooth overscroll-x-contain snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="grid min-w-full grid-flow-col auto-cols-[min(92vw,430px)] gap-4 px-1 sm:auto-cols-[450px] xl:auto-cols-[470px]">
          {wallets.map((wallet) => (
            <WalletCard
              key={wallet.walletKey}
              wallet={wallet}
              active={selectedWallet === wallet.walletKey}
              onClick={() => onSelectWallet(wallet.walletKey)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
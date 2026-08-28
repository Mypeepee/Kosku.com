"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, LayoutGrid } from "lucide-react";
import { WALLET_KEYS, WALLET_LABELS } from "@/lib/project-kas";
import type { WalletKey, WalletSummary } from "../types";
import { formatCurrency } from "../lib/format-currency";
import { walletTheme } from "./wallet-theme";

type WalletOption = WalletKey | "all";

/**
 * Pemilih dompet — dipakai sebagai filter riwayat (dengan opsi "Semua dompet")
 * dan sebagai field pemilih dompet di form pencatatan (varian `field`).
 * Sengaja dropdown, bukan daftar kartu, supaya hemat ruang dan cepat dipakai.
 */
export default function WalletDropdown({
  value,
  onChange,
  wallets,
  includeAll = true,
  variant = "chip",
  disabled,
}: {
  value: WalletOption;
  onChange: (value: WalletOption) => void;
  /** Untuk menampilkan sisa anggaran tiap pos di dalam daftar. */
  wallets?: WalletSummary[];
  includeAll?: boolean;
  variant?: "chip" | "field";
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const options: WalletOption[] = includeAll
    ? ["all", ...WALLET_KEYS]
    : [...WALLET_KEYS];

  const walletByKey = new Map(
    (wallets ?? []).map((wallet) => [wallet.walletKey, wallet])
  );

  const selectedTheme = value === "all" ? null : walletTheme(value);
  const SelectedIcon = selectedTheme?.icon ?? LayoutGrid;
  const selectedLabel =
    value === "all" ? "Semua dompet" : WALLET_LABELS[value as WalletKey];
  const selectedWallet = value === "all" ? null : walletByKey.get(value);

  const isField = variant === "field";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={
          isField
            ? [
                "flex h-16 w-full items-center justify-between gap-3 rounded-[20px] border px-4 text-left transition",
                "disabled:cursor-not-allowed disabled:opacity-60",
                open
                  ? "border-cyan-300/40 bg-cyan-400/[0.07]"
                  : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]",
              ].join(" ")
            : [
                "flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition",
                selectedTheme
                  ? `${selectedTheme.chip} ${selectedTheme.text} hover:brightness-125`
                  : "border-white/10 bg-white/[0.06] text-slate-200 hover:bg-white/[0.09]",
              ].join(" ")
        }
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            className={[
              "flex shrink-0 items-center justify-center rounded-[14px] border",
              isField ? "h-10 w-10" : "h-5 w-5 border-0 bg-transparent",
              selectedTheme && isField
                ? `${selectedTheme.chip} ${selectedTheme.text}`
                : "",
            ].join(" ")}
          >
            <SelectedIcon
              className={isField ? "h-4 w-4" : "h-3.5 w-3.5 shrink-0"}
            />
          </span>

          <span className="min-w-0">
            <span
              className={
                isField
                  ? "block truncate text-base font-medium text-white"
                  : "block whitespace-nowrap"
              }
            >
              {selectedLabel}
            </span>
            {isField ? (
              <span className="mt-0.5 block truncate text-xs text-slate-400">
                {selectedWallet
                  ? selectedWallet.overBudget
                    ? `Kurang ${formatCurrency(selectedWallet.kekurangan)}`
                    : `Saldo ${formatCurrency(selectedWallet.sisaAnggaran)}`
                  : "Pilih dompet"}
              </span>
            ) : null}
          </span>
        </span>

        <ChevronDown
          className={`h-4 w-4 shrink-0 opacity-60 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          className={[
            "absolute left-0 z-[110] mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#0a1120] shadow-[0_24px_64px_rgba(0,0,0,0.6)] backdrop-blur-xl",
            isField ? "right-0" : "min-w-[240px]",
          ].join(" ")}
        >
          {options.map((key) => {
            const theme = key === "all" ? null : walletTheme(key);
            const Icon = theme?.icon ?? LayoutGrid;
            const wallet = key === "all" ? null : walletByKey.get(key);
            const isActive = key === value;

            return (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  onChange(key);
                  setOpen(false);
                }}
                className={[
                  "flex w-full items-center gap-3 px-3.5 py-3 text-sm transition",
                  isActive
                    ? "bg-white/[0.07] text-white"
                    : "text-slate-300 hover:bg-white/[0.04]",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
                    theme
                      ? `${theme.chip} ${theme.text}`
                      : "border-white/10 bg-white/[0.05] text-slate-300",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                </span>

                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-medium">
                    {key === "all" ? "Semua dompet" : WALLET_LABELS[key]}
                  </span>
                  {wallet ? (
                    <span
                      className={[
                        "mt-0.5 block truncate text-xs tabular-nums",
                        wallet.overBudget
                          ? "text-amber-300/80"
                          : "text-slate-500",
                      ].join(" ")}
                    >
                      {wallet.overBudget
                        ? `Kurang ${formatCurrency(wallet.kekurangan)}`
                        : `Sisa ${formatCurrency(wallet.sisaAnggaran)}`}
                    </span>
                  ) : null}
                </span>

                {isActive ? (
                  <Check className="h-4 w-4 shrink-0 text-cyan-300" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

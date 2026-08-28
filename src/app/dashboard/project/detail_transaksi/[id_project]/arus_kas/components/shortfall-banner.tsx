"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, HandCoins, Loader2, X } from "lucide-react";
import type { FundState, WalletKey } from "@/lib/project-kas";
import { formatCurrency } from "../lib/format-currency";
import type { InvestorSummary } from "../types";
import { walletTheme } from "./wallet-theme";

/**
 * Dompet yang saldonya minus (data lama, sebelum aturan talangan berlaku) tak
 * boleh dibiarkan menggantung. Panel ini menutupnya dengan talangan investor:
 * modal disetor penanggung bertambah, kepemilikan dihitung ulang, dan saldo
 * dompet kembali ke nol — bukan disembunyikan sebagai angka merah.
 *
 * Hanya muncul kalau memang ada dompet yang minus.
 */
export default function ShortfallBanner({
  idProject,
  fund,
  investors,
}: {
  idProject: string;
  fund: FundState;
  investors: InvestorSummary[];
}) {
  const router = useRouter();
  const [openWallet, setOpenWallet] = useState<WalletKey | null>(null);
  const [investorId, setInvestorId] = useState<string | null>(
    investors.length === 1 ? investors[0].id_project_investor : null
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const posKurang = fund.pos.filter((item) => item.kekurangan > 0);

  if (posKurang.length === 0) return null;

  const active = posKurang.find((item) => item.walletKey === openWallet) ?? null;

  // Rumus yang sama dipakai server: kekurangan pos ditutup talangan, sisa
  // kekurangan kas ditutup setoran modal. Totalnya yang dibebankan investor.
  const tambahanKas = active
    ? Math.max(0, -(fund.sisaKas + active.kekurangan))
    : 0;
  const totalDibebankan = active ? active.kekurangan + tambahanKas : 0;
  const totalKekurangan = posKurang.reduce(
    (total, item) => total + item.kekurangan,
    0
  );

  async function submit(walletKey: WalletKey) {
    if (pending) return;

    if (investors.length > 1 && !investorId) {
      setError("Pilih investor yang menanggung kekurangan ini.");
      return;
    }

    setPending(true);
    setError("");

    try {
      const response = await fetch(
        "/api/project/catat_arus_kas/tutup_kekurangan",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id_project: idProject,
            wallet_key: walletKey,
            id_project_investor: investorId,
          }),
        }
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message || "Gagal menutup kekurangan dana.");
      }

      setOpenWallet(null);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menutup kekurangan dana."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <section className="rounded-[24px] border border-amber-300/25 bg-[linear-gradient(180deg,rgba(251,191,36,0.10),rgba(255,255,255,0.02))] p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-amber-300/25 bg-amber-400/10 text-amber-200">
            <AlertTriangle className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-white">
              {posKurang.length === 1
                ? `Saldo ${posKurang[0].title} kurang ${formatCurrency(
                    posKurang[0].kekurangan
                  )}`
                : `${posKurang.length} dompet kekurangan dana ${formatCurrency(
                    totalKekurangan
                  )}`}
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-300">
              Pengeluaran melebihi saldo dompet. Bebankan kekurangannya ke
              investor — modal disetornya bertambah dan porsi kepemilikan semua
              investor dihitung ulang otomatis.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {posKurang.map((pos) => {
                const theme = walletTheme(pos.walletKey);
                const Icon = theme.icon;

                return (
                  <button
                    key={pos.walletKey}
                    type="button"
                    onClick={() => {
                      setError("");
                      setOpenWallet(pos.walletKey);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-400/16"
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    Tutup {pos.title} · {formatCurrency(pos.kekurangan)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {active ? (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-[#020817]/80 p-0 backdrop-blur-md sm:items-center sm:p-4">
          <div
            className="absolute inset-0"
            onClick={() => !pending && setOpenWallet(null)}
            aria-hidden="true"
          />

          <div className="relative z-[1] w-full overflow-hidden rounded-t-[28px] border border-white/10 bg-[#0a1120] shadow-[0_30px_80px_rgba(0,0,0,0.65)] sm:max-w-md sm:rounded-[28px]">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">
                  Tutup kekurangan
                </div>
                <div className="mt-1 truncate text-base font-semibold text-white">
                  {active.title}
                </div>
              </div>

              <button
                type="button"
                onClick={() => !pending && setOpenWallet(null)}
                disabled={pending}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-50"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="rounded-[20px] border border-amber-300/20 bg-amber-400/[0.08] px-4 py-4 text-center">
                <div className="text-[11px] uppercase tracking-[0.2em] text-amber-100/60">
                  Kekurangan yang ditanggung
                </div>
                <div className="mt-2 text-3xl font-semibold tabular-nums text-amber-200">
                  {formatCurrency(totalDibebankan)}
                </div>

                {tambahanKas > 0 ? (
                  <div className="mt-3 space-y-1 border-t border-amber-300/15 pt-3 text-xs leading-5 text-amber-100/70">
                    <div className="flex items-center justify-between gap-3">
                      <span>Tambah saldo {active.title}</span>
                      <span className="tabular-nums">
                        {formatCurrency(active.kekurangan)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Setoran modal investor</span>
                      <span className="tabular-nums">
                        {formatCurrency(tambahanKas)}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              {investors.length === 0 ? (
                <div className="rounded-[18px] border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-100">
                  Project ini belum punya investor, jadi kekurangan dana belum
                  bisa ditalangi.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">
                    {investors.length === 1
                      ? "Ditanggung oleh"
                      : "Pilih investor penanggung"}
                  </div>

                  {investors.map((investor) => {
                    const selected =
                      investor.id_project_investor === investorId;

                    return (
                      <button
                        key={investor.id_project_investor}
                        type="button"
                        onClick={() => {
                          setInvestorId(investor.id_project_investor);
                          setError("");
                        }}
                        disabled={pending}
                        className={[
                          "flex w-full items-center gap-3 rounded-[18px] border p-3 text-left transition disabled:opacity-60",
                          selected
                            ? "border-amber-300/40 bg-amber-400/[0.10]"
                            : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]",
                        ].join(" ")}
                      >
                        {investor.foto_profil_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={investor.foto_profil_url}
                            alt={investor.nama}
                            className="h-10 w-10 shrink-0 rounded-[14px] object-cover ring-1 ring-white/10"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.05] text-sm font-bold text-white">
                            {investor.nama.slice(0, 1).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-white">
                            {investor.nama}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-slate-400">
                            Modal {formatCurrency(investor.disetor)} →{" "}
                            <span className="text-amber-200">
                              {formatCurrency(
                                investor.disetor + totalDibebankan
                              )}
                            </span>
                          </div>
                        </div>

                        {selected ? (
                          <Check className="h-4 w-4 shrink-0 text-amber-300" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}

              {error ? (
                <div className="rounded-[16px] border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-100">
                  {error}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => submit(active.walletKey)}
                disabled={pending || investors.length === 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-amber-300/30 bg-amber-400/15 px-5 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <HandCoins className="h-4 w-4" />
                    Bebankan ke investor
                  </>
                )}
              </button>

              <p className="text-center text-xs leading-5 text-slate-500">
                Bisa dibatalkan lagi dari riwayat selama dananya belum
                terpakai.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

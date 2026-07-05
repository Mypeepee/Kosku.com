"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@iconify/react";

export type MarkSoldPreviewItem = {
  id: string;
  title: string;
};

type MarkSoldDialogProps = {
  open: boolean;
  count: number;
  preview?: MarkSoldPreviewItem[];
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "sold" | "takedown";
};

export default function MarkSoldDialog({
  open,
  count,
  preview = [],
  loading = false,
  onConfirm,
  onCancel,
  variant = "sold",
}: MarkSoldDialogProps) {
  const isTakedown = variant === "takedown";
  // Esc untuk batal, Enter untuk konfirmasi, + lock scroll body saat terbuka.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (loading) return;
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, loading, onCancel, onConfirm]);

  const extra = Math.max(0, count - preview.length);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label="Konfirmasi tandai terjual"
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/75 backdrop-blur-xl"
            onClick={() => !loading && onCancel()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Card shell (animated gradient border) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 14 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="relative w-full max-w-md overflow-hidden rounded-[28px] p-px shadow-[0_40px_120px_-24px_rgba(0,0,0,0.9)]"
          >
            {/* Rotating conic sheen on the border */}
            {isTakedown ? (
              <>
                <span className="pointer-events-none absolute -inset-[60%] animate-[spin_9s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(239,68,68,0.35)_36deg,transparent_120deg,transparent_240deg,rgba(248,113,113,0.25)_300deg,transparent_360deg)]" />
                <span className="pointer-events-none absolute inset-0 rounded-[28px] border border-red-400/20" />
              </>
            ) : (
              <>
                <span className="pointer-events-none absolute -inset-[60%] animate-[spin_9s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(16,185,129,0.35)_36deg,transparent_120deg,transparent_240deg,rgba(52,211,153,0.25)_300deg,transparent_360deg)]" />
                <span className="pointer-events-none absolute inset-0 rounded-[28px] border border-emerald-400/20" />
              </>
            )}

            {/* Inner panel */}
            <div className={`relative overflow-hidden rounded-[27px] px-7 pb-7 pt-8 ${isTakedown ? "bg-gradient-to-b from-[#150a0a]/95 via-[#100606]/96 to-[#100202]/98" : "bg-gradient-to-b from-[#0a1410]/95 via-[#06100c]/96 to-[#02100a]/98"}`}>
              {/* Decorative glow + grid */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[27px]">
                <div className={`absolute -top-24 left-1/2 h-48 w-56 -translate-x-1/2 rounded-full blur-3xl ${isTakedown ? "bg-red-500/20" : "bg-emerald-500/25"}`} />
                <div className={`absolute inset-0 opacity-[0.05] [background-size:34px_34px] ${isTakedown ? "[background-image:linear-gradient(to_right,#ef4444_1px,transparent_1px),linear-gradient(to_bottom,#ef4444_1px,transparent_1px)]" : "[background-image:linear-gradient(to_right,#22c55e_1px,transparent_1px),linear-gradient(to_bottom,#22c55e_1px,transparent_1px)]"}`} />
              </div>

              {/* Close (X) */}
              <button
                type="button"
                onClick={() => !loading && onCancel()}
                disabled={loading}
                aria-label="Tutup"
                className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-zinc-400 transition-all hover:border-white/25 hover:bg-white/10 hover:text-white disabled:opacity-40"
              >
                <Icon icon="solar:close-circle-linear" className="text-base" />
              </button>

              {/* Icon badge */}
              <div className="relative mx-auto mb-5 flex h-[70px] w-[70px] items-center justify-center">
                {isTakedown ? (
                  <>
                    <span className="absolute inset-0 rounded-2xl bg-red-500/25 blur-md" />
                    <span className="absolute inset-0 animate-ping rounded-2xl border border-red-400/40 [animation-duration:2.6s]" />
                    <span className="relative flex h-[70px] w-[70px] items-center justify-center rounded-2xl border border-red-200/40 bg-gradient-to-br from-red-300 via-red-500 to-red-700 shadow-[0_10px_34px_rgba(239,68,68,0.55)]">
                      <Icon icon="solar:eye-closed-bold" className="text-3xl text-white drop-shadow" />
                    </span>
                  </>
                ) : (
                  <>
                    <span className="absolute inset-0 rounded-2xl bg-emerald-500/25 blur-md" />
                    <span className="absolute inset-0 animate-ping rounded-2xl border border-emerald-400/40 [animation-duration:2.6s]" />
                    <span className="relative flex h-[70px] w-[70px] items-center justify-center rounded-2xl border border-emerald-200/40 bg-gradient-to-br from-emerald-300 via-emerald-500 to-emerald-700 shadow-[0_10px_34px_rgba(16,185,129,0.55)]">
                      <Icon icon="solar:verified-check-bold" className="text-3xl text-white drop-shadow" />
                    </span>
                  </>
                )}
              </div>

              {/* Title + description */}
              <div className="relative text-center">
                {isTakedown ? (
                  <>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-red-400/70">
                      Konfirmasi Takedown
                    </p>
                    <h2 className="text-[20px] font-extrabold leading-tight tracking-tight text-white">
                      Tarik{" "}
                      <span className="bg-gradient-to-r from-red-200 to-red-400 bg-clip-text text-transparent">
                        Listing
                      </span>
                      ?
                    </h2>
                    <p className="mx-auto mt-2.5 max-w-[20.5rem] text-[13px] leading-relaxed text-red-50/55">
                      <span className="font-bold text-red-200">{count}</span> properti
                      akan ditarik dari penayangan publik. Data tetap{" "}
                      <span className="font-semibold text-red-100">aman tersimpan</span> dan bisa diaktifkan kembali.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400/70">
                      Konfirmasi Closing
                    </p>
                    <h2 className="text-[20px] font-extrabold leading-tight tracking-tight text-white">
                      Tandai sebagai{" "}
                      <span className="bg-gradient-to-r from-emerald-200 to-emerald-400 bg-clip-text text-transparent">
                        Terjual
                      </span>
                      ?
                    </h2>
                    <p className="mx-auto mt-2.5 max-w-[20.5rem] text-[13px] leading-relaxed text-emerald-50/55">
                      <span className="font-bold text-emerald-200">{count}</span> properti
                      akan ditandai{" "}
                      <span className="font-semibold text-emerald-200">TERJUAL</span> dan
                      hilang dari listing aktif Anda. Datanya tetap{" "}
                      <span className="font-semibold text-emerald-100">aman tersimpan</span>.
                    </p>
                  </>
                )}
              </div>

              {/* Preview list */}
              {preview.length > 0 && (
                <div className="relative mt-5 max-h-44 space-y-1 overflow-y-auto rounded-2xl border border-white/8 bg-black/30 p-2 [scrollbar-width:thin]">
                  {preview.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/5"
                    >
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${isTakedown ? "border-red-400/15 bg-red-500/10" : "border-emerald-400/15 bg-emerald-500/10"}`}>
                        <Icon
                          icon="solar:home-smile-bold-duotone"
                          className={`text-sm ${isTakedown ? "text-red-300/80" : "text-emerald-300/80"}`}
                        />
                      </span>
                      <span className="truncate text-[12px] font-medium text-zinc-300">
                        {p.title}
                      </span>
                      <span className="ml-auto shrink-0 font-mono text-[10px] text-zinc-600">
                        #{p.id}
                      </span>
                    </div>
                  ))}
                  {extra > 0 && (
                    <p className="px-2 pb-0.5 pt-1 text-[11px] font-medium text-zinc-500">
                      + {extra} properti lainnya
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="relative mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => !loading && onCancel()}
                  disabled={loading}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[13px] font-bold text-zinc-300 transition-all hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Batal
                </button>
                {isTakedown ? (
                  <button
                    type="button"
                    onClick={onConfirm}
                    disabled={loading}
                    className="group relative flex flex-[1.5] items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-red-500 to-red-700 px-4 py-3 text-[13px] font-extrabold text-white shadow-[0_12px_34px_-8px_rgba(239,68,68,0.7)] transition-all hover:from-red-400 hover:to-red-600 hover:shadow-[0_16px_44px_-8px_rgba(239,68,68,0.9)] disabled:cursor-wait disabled:opacity-80"
                  >
                    <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Memproses…
                      </>
                    ) : (
                      <>
                        <Icon icon="solar:eye-closed-bold" className="text-base" />
                        Ya, Tarik Listing
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onConfirm}
                    disabled={loading}
                    className="group relative flex flex-[1.5] items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-400 to-emerald-600 px-4 py-3 text-[13px] font-extrabold text-[#03241a] shadow-[0_12px_34px_-8px_rgba(16,185,129,0.7)] transition-all hover:from-emerald-300 hover:to-emerald-500 hover:shadow-[0_16px_44px_-8px_rgba(16,185,129,0.9)] disabled:cursor-wait disabled:opacity-80"
                  >
                    <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/45 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#03241a]/30 border-t-[#03241a]" />
                        Memproses…
                      </>
                    ) : (
                      <>
                        <Icon icon="solar:check-circle-bold" className="text-base" />
                        Ya, Tandai Terjual
                      </>
                    )}
                  </button>
                )}
              </div>

              <p className="relative mt-3.5 text-center text-[10.5px] text-zinc-600">
                Tekan{" "}
                <kbd className="rounded border border-white/10 bg-white/5 px-1 font-mono text-[9px] text-zinc-400">
                  Enter
                </kbd>{" "}
                untuk konfirmasi ·{" "}
                <kbd className="rounded border border-white/10 bg-white/5 px-1 font-mono text-[9px] text-zinc-400">
                  Esc
                </kbd>{" "}
                untuk batal
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

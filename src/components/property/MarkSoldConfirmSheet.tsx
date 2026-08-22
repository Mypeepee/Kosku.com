"use client";

/**
 * Konfirmasi ubah status listing dari halaman detail.
 *
 * Kenapa ada langkah konfirmasi padahal tujuannya "biar cepat"?
 * Karena tombolnya sekarang ada di halaman yang sama dengan galeri foto dan
 * tombol bagikan — satu ketukan meleset di layar sentuh tidak boleh langsung
 * menutup aset yang belum laku. Satu ketukan tambahan itu murah; salah tanda
 * lalu aset hilang dari daftar aktif itu mahal.
 *
 * Bentuknya menyesuaikan perangkat: bottom sheet di ponsel (ibu jari sampai
 * di tombolnya) dan dialog di tengah untuk desktop, sama seperti modal
 * "Bagikan Listing" supaya kebiasaan di situs ini konsisten.
 *
 * Dirender lewat portal ke <body> supaya tidak pernah terpotong oleh
 * `overflow-hidden` atau kalah lapis dari elemen sticky di halaman detail.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@iconify/react";

export type MarkSoldMode = "sold" | "reactivate";

interface Props {
  open: boolean;
  mode: MarkSoldMode;
  loading?: boolean;
  /** "Terjual" untuk jual/lelang, "Tersewa" untuk sewa. */
  soldLabel: string;
  judul: string;
  idProperty: string;
  lokasi?: string | null;
  harga?: number | null;
  hargaLabel?: string;
  thumbnail?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const formatRupiah = (value?: number | null): string | null => {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
};

export default function MarkSoldConfirmSheet({
  open,
  mode,
  loading = false,
  soldLabel,
  judul,
  idProperty,
  lokasi,
  harga,
  hargaLabel = "Harga",
  thumbnail,
  onConfirm,
  onCancel,
}: Props) {
  const isSold = mode === "sold";
  const [mounted, setMounted] = useState(false);
  const [thumbError, setThumbError] = useState(false);
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => setMounted(true), []);

  const batal = useCallback(() => {
    if (loading) return;
    onCancel();
  }, [loading, onCancel]);

  // Kunci gulir + pindah fokus ke tombol utama. Sengaja hanya bergantung pada
  // `open`: kalau efek ini ikut berjalan ulang setiap kali `loading` berubah,
  // elemen pemicunya tercatat ulang di tengah proses simpan dan fokus tidak
  // pernah kembali ke tempat asalnya saat sheet ditutup.
  useEffect(() => {
    if (!open) return;

    // Fokus dikembalikan ke tombol pemanggil saat sheet ditutup — kalau tidak,
    // pengguna keyboard terlempar ke awal halaman setiap kali membatalkan.
    const pemicu = document.activeElement;
    const timer = window.setTimeout(() => confirmRef.current?.focus(), 120);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = prevOverflow;
      (pemicu as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  // Esc = batal, Enter = konfirmasi. Keduanya mati selama proses simpan supaya
  // tidak ada permintaan kedua yang menyusul di tengah jalan.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (loading) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel, onConfirm]);

  useEffect(() => {
    if (open) setThumbError(false);
  }, [open]);

  if (!mounted) return null;

  const hargaText = formatRupiah(harga);

  // Satu set token warna per mode — supaya tidak ada kelas warna yang
  // ditulis dua kali dan lupa disesuaikan saat mode berubah.
  const t = isSold
    ? {
        eyebrow: "Konfirmasi Closing",
        titleLead: "Tandai sebagai",
        titleAccent: `${soldLabel}?`,
        icon: "solar:verified-check-bold",
        spinner: "border-[#03241a]/30 border-t-[#03241a]",
        ring: "border-emerald-400/40",
        glow: "bg-emerald-500/25",
        badge:
          "border-emerald-200/40 bg-gradient-to-br from-emerald-300 via-emerald-500 to-emerald-700 shadow-[0_10px_34px_rgba(16,185,129,0.55)]",
        conic:
          "bg-[conic-gradient(from_0deg,transparent_0deg,rgba(16,185,129,0.35)_36deg,transparent_120deg,transparent_240deg,rgba(52,211,153,0.25)_300deg,transparent_360deg)]",
        panel: "from-[#08130f]/95 via-[#050e0b]/95 to-[#02100a]/95",
        eyebrowText: "text-emerald-300/70",
        accentText: "from-emerald-200 to-emerald-400",
        cta: "bg-gradient-to-r from-emerald-400 to-emerald-600 text-[#03241a] shadow-[0_12px_34px_-8px_rgba(16,185,129,0.7)] hover:from-emerald-300 hover:to-emerald-500",
        ctaIcon: "solar:check-circle-bold",
        ctaLabel: `Ya, Tandai ${soldLabel}`,
        points: [
          {
            icon: "solar:shield-check-bold-duotone",
            text: "Data listing tetap tersimpan utuh untuk riwayat closing.",
          },
          {
            icon: "solar:eye-scan-bold-duotone",
            text: `Halaman ini tetap bisa dibuka, tapi bertanda ${soldLabel.toUpperCase()} dan turun ke urutan bawah pencarian.`,
          },
          {
            icon: "solar:refresh-circle-bold-duotone",
            text: "Salah tandai? Bisa diaktifkan lagi dari halaman ini juga.",
          },
        ],
      }
    : {
        eyebrow: "Aktifkan Kembali",
        titleLead: "Kembalikan ke listing",
        titleAccent: "aktif?",
        icon: "solar:refresh-bold",
        spinner: "border-[#2a1603]/30 border-t-[#2a1603]",
        ring: "border-amber-400/40",
        glow: "bg-amber-500/25",
        badge:
          "border-amber-200/40 bg-gradient-to-br from-amber-300 via-amber-500 to-orange-600 shadow-[0_10px_34px_rgba(245,158,11,0.5)]",
        conic:
          "bg-[conic-gradient(from_0deg,transparent_0deg,rgba(245,158,11,0.35)_36deg,transparent_120deg,transparent_240deg,rgba(251,191,36,0.25)_300deg,transparent_360deg)]",
        panel: "from-[#151007]/95 via-[#100b04]/95 to-[#0b0702]/95",
        eyebrowText: "text-amber-300/70",
        accentText: "from-amber-200 to-amber-400",
        cta: "bg-gradient-to-r from-amber-400 to-orange-500 text-[#2a1603] shadow-[0_12px_34px_-8px_rgba(245,158,11,0.6)] hover:from-amber-300 hover:to-orange-400",
        ctaIcon: "solar:play-circle-bold",
        ctaLabel: "Ya, Aktifkan Lagi",
        points: [
          {
            icon: "solar:global-bold-duotone",
            text: `Penanda ${soldLabel.toUpperCase()} dilepas dan listing kembali dihitung sebagai aktif.`,
          },
          {
            icon: "solar:list-check-bold-duotone",
            text: "Listing muncul lagi di daftar aktif dashboard Anda.",
          },
        ],
      };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[99998] flex items-end justify-center sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="judul-konfirmasi-status"
        >
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            onClick={batal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />

          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className="relative w-full overflow-hidden rounded-t-[30px] p-px shadow-[0_-30px_90px_-20px_rgba(0,0,0,0.95)] sm:max-w-[27rem] sm:rounded-[28px] sm:shadow-[0_40px_120px_-24px_rgba(0,0,0,0.9)]"
          >
            {/* Sapuan cahaya yang berputar pelan di garis tepi — satu-satunya
                animasi terus-menerus di kartu ini, sisanya diam supaya mata
                tetap jatuh ke tombolnya. */}
            <span
              aria-hidden
              className={`pointer-events-none absolute -inset-[60%] animate-[spin_9s_linear_infinite] ${t.conic}`}
            />
            <span
              aria-hidden
              className={`pointer-events-none absolute inset-0 rounded-t-[30px] border sm:rounded-[28px] ${t.ring}`}
            />

            <div
              className={`relative overflow-hidden rounded-t-[29px] bg-gradient-to-b px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:rounded-[27px] sm:px-7 sm:pb-7 sm:pt-8 ${t.panel}`}
            >
              {/* Latar dekoratif: cahaya di atas + kisi tipis. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 overflow-hidden"
              >
                <div
                  className={`absolute -top-24 left-1/2 h-48 w-64 -translate-x-1/2 rounded-full blur-3xl ${t.glow}`}
                />
                <div className="absolute inset-0 opacity-[0.045] [background-image:linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] [background-size:34px_34px]" />
              </div>

              {/* Pegangan sheet — penanda "bisa ditarik/ditutup" di ponsel. */}
              <div
                aria-hidden
                className="relative mx-auto mb-4 h-1 w-10 rounded-full bg-white/20 sm:hidden"
              />

              <button
                type="button"
                onClick={batal}
                disabled={loading}
                aria-label="Tutup"
                className="absolute right-4 top-4 z-10 hidden h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-zinc-400 transition-all hover:border-white/25 hover:bg-white/10 hover:text-white disabled:opacity-40 sm:grid"
              >
                <Icon icon="solar:close-circle-linear" className="text-base" />
              </button>

              {/* Lencana ikon */}
              <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center sm:mb-5 sm:h-[70px] sm:w-[70px]">
                <span className={`absolute inset-0 rounded-2xl blur-md ${t.glow}`} />
                <span
                  className={`absolute inset-0 animate-ping rounded-2xl border [animation-duration:2.6s] ${t.ring}`}
                />
                <span
                  className={`relative flex h-full w-full items-center justify-center rounded-2xl border ${t.badge}`}
                >
                  <Icon icon={t.icon} className="text-3xl text-white drop-shadow" />
                </span>
              </div>

              <div className="relative text-center">
                <p
                  className={`mb-1 text-[10px] font-bold uppercase tracking-[0.22em] ${t.eyebrowText}`}
                >
                  {t.eyebrow}
                </p>
                <h2
                  id="judul-konfirmasi-status"
                  className="text-[19px] font-extrabold leading-tight tracking-tight text-white sm:text-[20px]"
                >
                  {t.titleLead}{" "}
                  <span
                    className={`bg-gradient-to-r bg-clip-text text-transparent ${t.accentText}`}
                  >
                    {t.titleAccent}
                  </span>
                </h2>
              </div>

              {/* Aset yang sedang diubah — ditampilkan lengkap supaya tidak
                  ada keraguan "yang mana yang saya tutup". */}
              <div className="relative mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 p-2.5">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                  {thumbnail && !thumbError ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnail}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={() => setThumbError(true)}
                    />
                  ) : (
                    <span className="grid h-full w-full place-items-center">
                      <Icon
                        icon="solar:home-smile-bold-duotone"
                        className="text-xl text-white/30"
                      />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[12.5px] font-bold leading-snug text-white">
                    {judul}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] font-semibold text-zinc-500">
                    <span className="font-mono">#{idProperty}</span>
                    {lokasi ? (
                      <>
                        <span className="text-zinc-700">•</span>
                        <span className="truncate">{lokasi}</span>
                      </>
                    ) : null}
                  </div>
                  {hargaText && (
                    <p className="mt-1 text-[11px] font-bold tabular-nums text-zinc-300">
                      <span className="text-zinc-500">{hargaLabel}: </span>
                      {hargaText}
                    </p>
                  )}
                </div>
              </div>

              {/* Akibatnya apa — ditulis apa adanya, bukan peringatan menakuti. */}
              <ul className="relative mt-3 space-y-1.5">
                {t.points.map((p) => (
                  <li
                    key={p.icon}
                    className="flex items-start gap-2.5 rounded-xl bg-white/[0.03] px-2.5 py-2"
                  >
                    <Icon
                      icon={p.icon}
                      className="mt-[1px] shrink-0 text-base text-white/40"
                    />
                    <span className="text-[11.5px] leading-relaxed text-zinc-400">
                      {p.text}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="relative mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={batal}
                  disabled={loading}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[13px] font-bold text-zinc-300 transition-all hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  ref={confirmRef}
                  type="button"
                  onClick={onConfirm}
                  disabled={loading}
                  className={`group relative flex flex-[1.6] items-center justify-center gap-2 overflow-hidden rounded-2xl px-4 py-3 text-[13px] font-extrabold transition-all active:scale-[0.98] disabled:cursor-wait disabled:opacity-80 ${t.cta}`}
                >
                  <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/45 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                  {loading ? (
                    <>
                      <span
                        className={`h-4 w-4 animate-spin rounded-full border-2 ${t.spinner}`}
                      />
                      Memproses…
                    </>
                  ) : (
                    <>
                      <Icon icon={t.ctaIcon} className="text-base" />
                      {t.ctaLabel}
                    </>
                  )}
                </button>
              </div>

              <p className="relative mt-3 hidden text-center text-[10.5px] text-zinc-600 sm:block">
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
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

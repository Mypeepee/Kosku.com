"use client";

/**
 * Daftar nomor sertifikat satu lot lelang.
 *
 * KENAPA PERLU LAYAR SENDIRI.
 * Satu lot lelang sering berisi beberapa bidang sekaligus, dan semua nomornya
 * ditumpuk dalam satu kolom ("123,456,789,1011"). Ditampilkan mentah di baris
 * ringkasan, deretan itu terpotong `truncate` dan justru tidak terbaca —
 * padahal nomor inilah yang dibacakan agent ke notaris, dicek ke BPN, dan
 * disalin ke berkas penawaran. Jadi nomornya dipindah ke panel terpisah: baris
 * ringkasan cukup mengumumkan "4 bidang", detailnya sekali ketuk.
 *
 * HANYA UNTUK SATU KEADAAN.
 * Pemicunya hanya aktif kalau bidangnya LEBIH DARI SATU. Aset satu bidang tidak
 * punya yang perlu dibuka — nomornya sudah utuh di baris ringkasan — dan
 * membuatnya tetap bisa diketuk hanya mengajari orang bahwa ketukan di situ
 * kadang tidak melakukan apa-apa. Gerbang perannya ada di pemanggil: nomor
 * sertifikat tidak pernah tampil untuk pengunjung biasa.
 *
 * BENTUK.
 * Bottom sheet di ponsel (bisa ditarik turun untuk menutup, ibu jari sampai ke
 * semua tombolnya) dan dialog di tengah untuk desktop — mengikuti kebiasaan
 * yang sudah dipakai MarkSoldConfirmSheet & modal bagikan listing. Dirender
 * lewat portal ke <body> supaya tidak terpotong `overflow-hidden` kartu detail
 * atau kalah lapis dari sidebar sticky.
 *
 * GERAK.
 * Satu gerakan besar (panel masuk) + satu gerakan kecil berurutan (baris nomor
 * muncul bertingkat 30ms). Tidak ada yang berdenyut terus-menerus: yang dibaca
 * di sini angka, dan angka yang bergoyang lebih sulit disalin dengan mata.
 * `useReducedMotion` mematikan semuanya untuk yang menyetel "kurangi gerak".
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
} from "framer-motion";
import { Icon } from "@iconify/react";

import { daftarBidang } from "@/lib/nomorLegalitas";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Isi kolom `listing.nomor_legalitas` apa adanya. */
  nomorLegalitas?: string | null;
  /** Jenis sertifikat — "SHM", "SHGB", … Dipakai sebagai judul & prefiks salin. */
  jenis?: string | null;
  /** Total luas tanah SEMUA bidang (m²), kalau ada. */
  luasTotal?: number | null;
  /** Kode/ID aset, untuk konteks di kepala panel. */
  kodeAset?: string | null;
}

const formatLuas = (m2?: number | null) =>
  m2 && Number.isFinite(m2) ? `${new Intl.NumberFormat("id-ID").format(m2)} m²` : null;

export default function DaftarSertifikatSheet({
  open,
  onClose,
  nomorLegalitas,
  jenis,
  luasTotal,
  kodeAset,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const kurangiGerak = useReducedMotion();
  const tutupRef = useRef<HTMLButtonElement | null>(null);
  const kendaliSeret = useDragControls();

  /** Indeks baris yang baru disalin (-1 = tidak ada), untuk umpan balik ✓. */
  const [barisTersalin, setBarisTersalin] = useState(-1);
  const [semuaTersalin, setSemuaTersalin] = useState(false);
  const timerRef = useRef<number | null>(null);

  const bidang = useMemo(() => daftarBidang(nomorLegalitas), [nomorLegalitas]);
  const label = (jenis || "Sertifikat").toUpperCase();

  // Seret-untuk-menutup hanya masuk akal di sheet yang menempel ke tepi layar.
  // Di desktop panelnya mengambang di tengah, jadi drag dimatikan lewat lebar
  // layar sungguhan — bukan lewat class, karena `drag` bukan urusan CSS.
  const [ponsel, setPonsel] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setPonsel(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => setMounted(true), []);

  // Umpan balik salin selalu dibersihkan saat komponen lepas — kalau tidak,
  // timer yang masih jalan memanggil setState pada komponen yang sudah mati.
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  // Kunci gulir halaman + kembalikan fokus ke pemicunya saat ditutup. Tanpa
  // ini, pengguna keyboard terlempar ke awal halaman setiap kali menutup panel.
  useEffect(() => {
    if (!open) return;

    const pemicu = document.activeElement;
    const fokus = window.setTimeout(() => tutupRef.current?.focus(), 120);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(fokus);
      document.body.style.overflow = prevOverflow;
      (pemicu as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setBarisTersalin(-1);
      setSemuaTersalin(false);
    }
  }, [open]);

  const salin = useCallback(async (teks: string, indeks: number) => {
    try {
      await navigator.clipboard.writeText(teks);
    } catch {
      return; // izin clipboard ditolak — jangan tampilkan ✓ palsu
    }
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (indeks < 0) setSemuaTersalin(true);
    else setBarisTersalin(indeks);
    timerRef.current = window.setTimeout(() => {
      setBarisTersalin(-1);
      setSemuaTersalin(false);
    }, 1800);
  }, []);

  const salinSemua = useCallback(() => {
    const teks = bidang.map((b, i) => `${i + 1}. ${label} No. ${b.teks}`).join("\n");
    void salin(teks, -1);
  }, [bidang, label, salin]);

  if (!mounted || bidang.length === 0) return null;

  const luas = formatLuas(luasTotal);
  const pegas = kurangiGerak
    ? { duration: 0.15 }
    : ({ type: "spring", stiffness: 360, damping: 32 } as const);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[99998] flex items-end justify-center sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="judul-daftar-sertifikat"
        >
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />

          <motion.div
            initial={kurangiGerak ? { opacity: 0 } : { opacity: 0, y: 64, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={kurangiGerak ? { opacity: 0 } : { opacity: 0, y: 44, scale: 0.97 }}
            transition={pegas}
            // Tarik ke bawah untuk menutup — lihat catatan `ponsel` di atas.
            // `dragListener={false}`: seretan HANYA boleh dimulai dari kepala
            // panel (lihat `mulaiSeret`). Tanpa itu, mengusap daftar nomor yang
            // panjang akan menarik seluruh sheet turun alih-alih menggulung.
            drag={ponsel && !kurangiGerak ? "y" : false}
            dragListener={false}
            dragControls={kendaliSeret}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.55 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 700) onClose();
            }}
            className="relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[30px] p-px shadow-[0_-30px_90px_-20px_rgba(0,0,0,0.95)] sm:max-h-[82vh] sm:max-w-[29rem] sm:rounded-[28px] sm:shadow-[0_40px_120px_-24px_rgba(0,0,0,0.9)]"
          >
            {/* Tepi bercahaya statis. Versi berputar dipakai di sheet
                konfirmasi karena di sana matanya harus ditarik ke satu tombol;
                di sini yang dibaca daftar angka, jadi tepinya diam. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-t-[30px] border border-emerald-400/25 sm:rounded-[28px]"
            />

            <div className="relative flex min-h-0 flex-col overflow-hidden rounded-t-[29px] bg-gradient-to-b from-[#0a1512]/95 via-[#06100d]/95 to-[#030b09]/95 sm:rounded-[27px]">
              <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-24 left-1/2 h-48 w-64 -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
                <div className="absolute inset-0 opacity-[0.045] [background-image:linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] [background-size:34px_34px]" />
              </div>

              {/* ── KEPALA ── juga area pegangan seret di ponsel. */}
              <div
                onPointerDown={(e) => {
                  if (!ponsel || kurangiGerak) return;
                  // Tombol tutup ikut duduk di kepala panel; menekan tombol
                  // tidak boleh dianggap awal seretan.
                  if ((e.target as HTMLElement).closest("button")) return;
                  kendaliSeret.start(e);
                }}
                className="relative shrink-0 touch-none px-5 pt-4 sm:touch-auto sm:px-7 sm:pt-7"
              >
                <div
                  aria-hidden
                  className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20 sm:hidden"
                />

                <button
                  ref={tutupRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Tutup daftar nomor sertifikat"
                  className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-zinc-400 transition-all hover:border-white/25 hover:bg-white/10 hover:text-white active:scale-90 sm:right-6 sm:top-6"
                >
                  <Icon icon="solar:close-circle-linear" className="text-base" />
                </button>

                <div className="flex items-start gap-3.5 pr-10">
                  <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-emerald-200/40 bg-gradient-to-br from-emerald-300 via-emerald-500 to-emerald-700 shadow-[0_10px_30px_-6px_rgba(16,185,129,0.55)]">
                    <Icon
                      icon="solar:document-text-bold"
                      className="text-2xl text-[#03241a]"
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300/70">
                      Nomor sertifikat
                    </p>
                    <h2
                      id="judul-daftar-sertifikat"
                      className="text-[19px] font-extrabold leading-tight tracking-tight text-white sm:text-[21px]"
                    >
                      {label}{" "}
                      <span className="bg-gradient-to-r from-emerald-200 to-emerald-400 bg-clip-text text-transparent">
                        {bidang.length} bidang
                      </span>
                    </h2>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-white/40">
                      {luas && (
                        <span className="inline-flex items-center gap-1">
                          <Icon icon="solar:ruler-angular-bold" className="text-xs" />
                          Total {luas}
                        </span>
                      )}
                      {luas && kodeAset && <span className="text-white/20">·</span>}
                      {kodeAset && (
                        <span className="inline-flex items-center gap-1">
                          <Icon icon="solar:hashtag-bold" className="text-xs" />
                          {kodeAset}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Pengingat kerahasiaan. Panel ini hanya muncul untuk tim
                    internal, dan isinya sering dibuka saat layar terlihat
                    calon pembeli. */}
                <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-3.5 py-2.5">
                  <Icon
                    icon="solar:lock-keyhole-bold-duotone"
                    className="mt-px shrink-0 text-sm text-amber-300"
                  />
                  <p className="text-[11px] font-medium leading-relaxed text-amber-100/70">
                    Hanya terlihat oleh tim internal. Luas tanah pada listing adalah
                    <span className="font-bold text-amber-100"> total seluruh bidang</span>,
                    bukan luas per sertifikat.
                  </p>
                </div>
              </div>

              {/* ── DAFTAR BIDANG ── */}
              <div className="relative mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2 sm:px-7 [scrollbar-color:rgba(255,255,255,0.15)_transparent] [scrollbar-width:thin]">
                <ul className="space-y-2">
                  {bidang.map((b, i) => {
                    const tersalin = barisTersalin === i;
                    return (
                      <motion.li
                        key={`${b.nomor}-${i}`}
                        initial={
                          kurangiGerak ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.98 }
                        }
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={
                          kurangiGerak
                            ? { duration: 0.12 }
                            : {
                                delay: 0.05 + i * 0.03,
                                type: "spring",
                                stiffness: 420,
                                damping: 34,
                              }
                        }
                      >
                        <button
                          type="button"
                          onClick={() => salin(`${label} No. ${b.teks}`, i)}
                          title="Salin nomor ini"
                          className={`group flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all duration-200 active:scale-[0.985] ${
                            tersalin
                              ? "border-emerald-400/45 bg-emerald-400/[0.12]"
                              : "border-white/[0.07] bg-white/[0.03] hover:border-emerald-400/30 hover:bg-white/[0.06]"
                          }`}
                        >
                          <span
                            className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border text-[11px] font-black tabular-nums transition-colors ${
                              tersalin
                                ? "border-emerald-400/40 bg-emerald-400/20 text-emerald-200"
                                : "border-white/10 bg-white/[0.04] text-white/45 group-hover:text-white/70"
                            }`}
                          >
                            {String(i + 1).padStart(2, "0")}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-white/30">
                              Bidang {i + 1}
                            </span>
                            <span className="mt-0.5 block break-all text-[15px] font-extrabold leading-snug tracking-tight text-white tabular-nums">
                              {b.teks}
                            </span>
                          </span>

                          <span
                            className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-all ${
                              tersalin
                                ? "text-emerald-300"
                                : "text-white/25 group-hover:bg-white/[0.06] group-hover:text-white/70"
                            }`}
                          >
                            <Icon
                              icon={
                                tersalin ? "solar:check-circle-bold" : "solar:copy-bold-duotone"
                              }
                              className={`text-lg transition-transform duration-200 ${
                                tersalin ? "scale-110" : ""
                              }`}
                            />
                          </span>
                        </button>
                      </motion.li>
                    );
                  })}
                </ul>
              </div>

              {/* ── KAKI ── */}
              <div className="relative shrink-0 border-t border-white/[0.06] bg-black/20 px-5 pb-[max(1.15rem,env(safe-area-inset-bottom))] pt-3.5 sm:px-7 sm:pb-6">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={salinSemua}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[13px] font-extrabold transition-all active:scale-[0.98] ${
                      semuaTersalin
                        ? "bg-emerald-400/15 text-emerald-200 ring-1 ring-inset ring-emerald-400/40"
                        : "bg-gradient-to-r from-emerald-400 to-emerald-600 text-[#03241a] shadow-[0_12px_30px_-10px_rgba(16,185,129,0.7)] hover:from-emerald-300 hover:to-emerald-500"
                    }`}
                  >
                    <Icon
                      icon={
                        semuaTersalin
                          ? "solar:check-circle-bold"
                          : "solar:clipboard-list-bold-duotone"
                      }
                      className="text-base"
                    />
                    {semuaTersalin ? "Tersalin" : `Salin ${bidang.length} nomor`}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] font-bold text-white/70 transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white active:scale-[0.98]"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

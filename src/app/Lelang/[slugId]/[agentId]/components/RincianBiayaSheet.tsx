"use client";

/**
 * ────────────────────────────────────────────────────────────────────────────
 * RINCIAN BIAYA — bottom sheet di mobile, dialog di desktop.
 * ────────────────────────────────────────────────────────────────────────────
 * Dibaca dari atas ke bawah tanpa satu pun isian: total dulu, lalu dua pos
 * biaya beserta komponennya, ditutup rekap dan tombol salin. Semua angka
 * berasal dari data listing lewat src/lib/lelangBiaya.ts, jadi agent tidak
 * perlu menghitung, memilih wilayah, atau mengisi luas apa pun.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { toast } from "sonner";
import {
  TABEL_PENGOSONGAN,
  formatPersen,
  formatPesanBiayaLelang,
  formatRupiah,
  formatRupiahRingkas,
  hitungBiayaLelang,
  tarifBand,
  type KomponenBiaya,
  type KonteksPesanBiaya,
} from "@/lib/lelangBiaya";

export interface RincianBiayaSheetProps {
  open: boolean;
  onClose: () => void;
  /** Nilai limit lelang — dasar seluruh perhitungan. */
  limit: number;
  provinsi?: string | null;
  luasTanah?: number | null;
  luasBangunan?: number | null;
  /** Konteks aset & agent untuk teks salinan. */
  konteks?: KonteksPesanBiaya;
}

// ═══════════════════════════ POTONGAN UI KECIL ══════════════════════════════

/** Satu baris komponen biaya: keterangan di kiri, nominal rata kanan. */
function BarisBiaya({ komponen }: { komponen: KomponenBiaya }) {
  return (
    <div className="flex items-start gap-3 px-4 py-2.5 border-t border-white/[0.05]">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[12.5px] font-semibold text-slate-100 leading-tight">
            {komponen.label}
          </span>
          {komponen.persen != null && (
            <span className="text-[9px] font-bold tabular-nums px-1.5 py-[1px] rounded-md bg-white/[0.06] border border-white/10 text-slate-300">
              {formatPersen(komponen.persen)}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[10px] text-slate-500 leading-snug">{komponen.rumus}</p>
      </div>
      <span
        className={`shrink-0 text-[13px] font-bold tabular-nums leading-tight pt-[1px] ${
          komponen.tentatif ? "text-slate-500 font-semibold text-[11px]" : "text-white"
        }`}
      >
        {komponen.tentatif ? "Tentatif" : formatRupiah(komponen.nominal)}
      </span>
    </div>
  );
}

/** Kartu satu pos biaya: judul + subtotal di kepala, komponen di badannya. */
function KartuPos({
  kode,
  judul,
  subtitel,
  subtotal,
  aksen,
  komponen,
  children,
}: {
  kode: string;
  judul: string;
  subtitel?: string;
  subtotal: number;
  aksen: "emerald" | "amber";
  komponen: KomponenBiaya[];
  children?: React.ReactNode;
}) {
  const warna =
    aksen === "emerald"
      ? { chip: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30", garis: "bg-emerald-400" }
      : { chip: "bg-amber-400/15 text-amber-300 border-amber-400/30", garis: "bg-amber-400" };

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <header className="flex items-start gap-3 px-4 py-3">
        <span
          className={`shrink-0 w-6 h-6 rounded-lg border flex items-center justify-center text-[11px] font-black ${warna.chip}`}
        >
          {kode}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[12.5px] font-bold text-white leading-tight">{judul}</h3>
          {subtitel && <p className="mt-0.5 text-[10px] text-slate-500 leading-snug">{subtitel}</p>}
        </div>
        <span className="shrink-0 text-[15px] font-black text-white tabular-nums leading-tight">
          {formatRupiah(subtotal)}
        </span>
      </header>
      <div className="pb-1">
        {komponen.map((k) => (
          <BarisBiaya key={k.kode} komponen={k} />
        ))}
      </div>
      {children}
    </section>
  );
}

// ════════════════════════════ KOMPONEN UTAMA ════════════════════════════════

export default function RincianBiayaSheet({
  open,
  onClose,
  limit,
  provinsi,
  luasTanah,
  luasBangunan,
  konteks,
}: RincianBiayaSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [tabelTerbuka, setTabelTerbuka] = useState(false);
  const [tersalin, setTersalin] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 280);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  const rincian = useMemo(
    () => hitungBiayaLelang({ limit, provinsi, luasTanah, luasBangunan }),
    [limit, provinsi, luasTanah, luasBangunan]
  );

  const handleSalin = async () => {
    const teks = formatPesanBiayaLelang(rincian, konteks ?? {});
    try {
      await navigator.clipboard.writeText(teks);
    } catch {
      // Safari/webview lama: fallback textarea + execCommand.
      const ta = document.createElement("textarea");
      ta.value = teks;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      document.body.removeChild(ta);
      if (!ok) {
        toast.error("Gagal menyalin. Coba kirim lewat tombol WhatsApp.");
        return;
      }
    }
    setTersalin(true);
    setTimeout(() => setTersalin(false), 2200);
    toast.success("Rincian biaya disalin — tinggal tempel di chat klien.");
  };

  const handleKirimWa = () => {
    const teks = formatPesanBiayaLelang(rincian, konteks ?? {});
    window.open(`https://wa.me/?text=${encodeURIComponent(teks)}`, "_blank");
  };

  if (!mounted) return null;

  const { balikNama, eksekusi, totalModal, totalBiaya, band, wilayah } = rincian;
  const namaWilayah = wilayah === "JATIM" ? "Jawa Timur" : "Luar Jawa Timur";

  const rekap = [
    { label: "Harga limit", nilai: limit },
    { label: "Biaya balik nama", nilai: balikNama.subtotal },
    { label: "Biaya eksekusi", nilai: eksekusi.subtotal },
  ];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Rincian estimasi biaya lelang"
    >
      <div
        onClick={handleClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-[6px]"
        style={{ opacity: visible ? 1 : 0, transition: "opacity 0.28s ease" }}
      />

      <div
        className="relative w-full sm:max-w-[480px] rounded-t-[1.75rem] sm:rounded-[1.75rem] overflow-hidden
          max-h-[90dvh] sm:max-h-[88vh] flex flex-col
          bg-[#080B14] border border-white/10 shadow-[0_-24px_80px_rgba(0,0,0,0.9)]"
        style={{
          transform: visible ? "translateY(0) scale(1)" : "translateY(32px) scale(0.98)",
          opacity: visible ? 1 : 0,
          transition: visible
            ? "transform 0.38s cubic-bezier(0.22,1.2,0.36,1), opacity 0.25s ease"
            : "transform 0.26s ease-in, opacity 0.2s ease",
        }}
      >
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-9 h-[3px] rounded-full bg-white/15" />
        </div>

        {/* ═══════════ HEADER — angka penutup percakapan dengan klien ═══════ */}
        <div className="shrink-0 px-5 pt-3.5 pb-4 border-b border-white/[0.07] bg-gradient-to-br from-emerald-500/[0.13] via-emerald-500/[0.03] to-transparent">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-100 tracking-[0.16em] uppercase">
                  Estimasi Biaya
                </span>
              </div>
              <p className="mt-2.5 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                Total Modal Dibutuhkan
              </p>
              <p className="mt-1 text-[27px] sm:text-[30px] font-black text-white leading-none tabular-nums">
                {formatRupiah(totalModal)}
              </p>
              <p className="mt-2 text-[11px] text-slate-400 leading-snug">
                Harga limit{" "}
                <span className="font-semibold text-slate-200">{formatRupiahRingkas(limit)}</span>
                {"  +  "}biaya{" "}
                <span className="font-semibold text-emerald-300">
                  {formatRupiahRingkas(totalBiaya)}
                </span>
              </p>
            </div>
            <button
              onClick={handleClose}
              aria-label="Tutup rincian biaya"
              className="shrink-0 w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center transition-colors"
            >
              <Icon icon="solar:close-circle-bold" className="text-white/50 text-base" />
            </button>
          </div>
        </div>

        {/* ═══════════════════════════ ISI ═══════════════════════════════════ */}
        <div
          className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.14) transparent" }}
        >
          <KartuPos
            kode="A"
            judul="Biaya Balik Nama"
            subtitel="8,5% dari harga limit + fee jasa"
            subtotal={balikNama.subtotal}
            aksen="emerald"
            komponen={balikNama.komponen}
          />

          <KartuPos
            kode="B"
            judul="Biaya Eksekusi Pengosongan"
            subtitel={`Tarif ${namaWilayah} · berlaku bila aset masih berpenghuni`}
            subtotal={eksekusi.subtotal}
            aksen="amber"
            komponen={eksekusi.komponen}
          >
            {/* Tabel band disembunyikan sampai dibutuhkan — jawaban untuk
                pertanyaan klien "kenapa segitu?" tanpa meramaikan tampilan. */}
            <button
              onClick={() => setTabelTerbuka((v) => !v)}
              className="w-full flex items-center justify-between gap-2 px-4 py-2.5 border-t border-white/[0.05] hover:bg-white/[0.03] transition-colors"
            >
              <span className="text-[10.5px] font-semibold text-slate-400">
                Tabel biaya pengosongan
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                {band.label}
                <Icon
                  icon="solar:alt-arrow-down-linear"
                  className={`text-[13px] transition-transform ${tabelTerbuka ? "rotate-180" : ""}`}
                />
              </span>
            </button>

            {tabelTerbuka && (
              <div className="px-2.5 pb-3">
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-2 pb-1">
                  <span className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-slate-500">
                    Harga Limit
                  </span>
                  <span className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-slate-500 text-right">
                    Jatim
                  </span>
                  <span className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-slate-500 text-right">
                    Luar Jatim
                  </span>
                </div>
                {TABEL_PENGOSONGAN.map((b) => {
                  const aktif = b.min === band.min;
                  const teks = b.persen
                    ? `${formatPersen(b.persen)} + ${formatRupiahRingkas(b.tambahanTetap ?? 0)}`
                    : null;
                  return (
                    <div
                      key={b.label}
                      className={`grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-2 py-1.5 rounded-xl ${
                        aktif ? "bg-amber-400/10 border border-amber-400/25" : ""
                      }`}
                    >
                      <span
                        className={`text-[10.5px] ${
                          aktif ? "text-amber-100 font-bold" : "text-slate-400"
                        }`}
                      >
                        {b.label}
                      </span>
                      <span
                        className={`text-[10.5px] tabular-nums text-right ${
                          aktif ? "text-white font-bold" : "text-slate-300"
                        }`}
                      >
                        {teks ?? formatRupiahRingkas(b.jatim)}
                      </span>
                      <span
                        className={`text-[10.5px] tabular-nums text-right ${
                          aktif ? "text-white font-bold" : "text-slate-300"
                        }`}
                      >
                        {teks ?? formatRupiahRingkas(b.luarJatim)}
                      </span>
                    </div>
                  );
                })}
                <p className="px-2 pt-2 text-[9px] text-slate-500 leading-relaxed">
                  Aset ini masuk band {band.label} di {namaWilayah} —{" "}
                  <span className="text-slate-300 font-semibold">
                    {formatRupiah(tarifBand(band, wilayah, limit))}
                  </span>
                  . Di atas Rp 10 M biaya dihitung 5% per sertifikat ditambah Rp 150 jt.
                </p>
              </div>
            )}
          </KartuPos>

          {/* ── Rekap: penjumlahan yang bisa dibacakan langsung ke klien ── */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] px-4 py-3.5">
            {rekap.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-3 py-[3px]">
                <span className="text-[11px] text-slate-400">{r.label}</span>
                <span className="text-[12px] font-semibold text-slate-200 tabular-nums">
                  {formatRupiah(r.nilai)}
                </span>
              </div>
            ))}
            <div className="mt-2 pt-2.5 border-t border-white/10 flex items-center justify-between gap-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">
                Total Modal
              </span>
              <span className="text-[18px] font-black text-white tabular-nums leading-none">
                {formatRupiah(totalModal)}
              </span>
            </div>
          </div>

          <p className="px-1 text-[9.5px] text-slate-500 leading-relaxed">
            Tempat perpindahan barang bersifat tentatif (perkiraan kebutuhan ruang ± 50% luas
            bangunan) sehingga belum dimasukkan ke total. Angka di atas estimasi dan belum
            termasuk pajak serta biaya lain di luar daftar.
          </p>
        </div>

        {/* ═══════════════ AKSI: menyalin rincian untuk klien ════════════════ */}
        <div
          className="shrink-0 px-5 pt-3 border-t border-white/[0.07] bg-[#080B14] flex items-stretch gap-2"
          style={{ paddingBottom: "calc(0.9rem + env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={handleSalin}
            className="flex-1 min-w-0 flex items-center justify-center gap-2 py-3 rounded-2xl
              bg-gradient-to-r from-[#86efac] to-[#34d399] text-black font-extrabold text-[13px]
              shadow-[0_8px_28px_rgba(52,211,153,0.28)] hover:shadow-[0_10px_34px_rgba(52,211,153,0.4)]
              transition-all active:scale-[0.98]"
          >
            <Icon
              icon={tersalin ? "solar:check-circle-bold" : "solar:copy-bold-duotone"}
              className="text-[18px]"
            />
            {tersalin ? "Tersalin!" : "Salin untuk Klien"}
          </button>
          <button
            onClick={handleKirimWa}
            aria-label="Kirim rincian lewat WhatsApp"
            className="shrink-0 w-[52px] flex items-center justify-center rounded-2xl
              bg-emerald-500/[0.14] border border-emerald-400/40 hover:bg-emerald-500/25
              transition-colors active:scale-[0.97]"
          >
            <Icon icon="ic:baseline-whatsapp" className="text-emerald-100 text-[20px]" />
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { buildLelangPosterPayload, downloadLelangPoster } from "@/lib/lelangPoster";
import { SITE_URL } from "@/lib/site";
import RincianBiayaSheet from "./RincianBiayaSheet";
import {
  formatRupiah as formatMoney,
  formatRupiahRingkas as formatMoneyShort,
  hitungBiayaLelang,
} from "@/lib/lelangBiaya";

interface SelfAgentLite {
  nama?: string;
  whatsapp?: string;
  telepon?: string;
}

interface KeperluanAgentProps {
  data: any;
  currentAgentId?: string | null;
  currentJabatan?: string | null;
  stokerPhone?: string | null;
  canEdit?: boolean;
  /** Profil agent yang sedang login — dipakai sebagai kontak di poster. */
  selfAgent?: SelfAgentLite | null;
  /** Dipanggil saat tombol Bagikan ditekan — modal dirender di level atas (DetailClient). */
  onShareOpen?: () => void;
}

const formatTanggalLelang = (val?: string | null): string => {
  if (!val) return "-";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

export default function KeperluanAgent({ data, currentAgentId, currentJabatan, stokerPhone, selfAgent, onShareOpen }: KeperluanAgentProps) {
  const rawLimit =
    data?.nilai_limit_lelang || data?.harga || data?.priceRates?.monthly || 0;

  const limit =
    typeof rawLimit === "number"
      ? rawLimit
      : parseFloat(String(rawLimit).replace(/[^0-9.-]/g, "")) || 0;

  const luasTanah = Number(data?.luas_tanah) || 0;
  const luasBangunan = Number(data?.luas_bangunan) || 0;

  // Angka ringkas di sidebar & dock memakai mesin yang sama dengan sheet
  // rincian — seluruh masukannya diambil dari data listing.
  const rincian = hitungBiayaLelang({
    limit,
    provinsi: data?.provinsi,
    luasTanah,
    luasBangunan,
  });
  const slugId =
    data?.slug && data?.id_property
      ? `${data.slug}-${data.id_property}`
      : String(data?.id_property || "");
  const propertyUrl = slugId ? `${SITE_URL}/Lelang/${slugId}` : null;

  const biayaBalikNama = rincian.balikNama.subtotal;
  const biayaEksekusi = rincian.eksekusi.subtotal;
  const totalBiaya = rincian.totalBiaya;

  // ✅ Check Ownership
  const ownerId: string = data?.owner?.id || data?.id_agent || "";
  const isOwner = !!currentAgentId && !!ownerId && currentAgentId === ownerId;

  // ✅ Get property ID for edit
  const propertyId = data?.id_property || data?.id || "";

  const [isBuildingPoster, setIsBuildingPoster] = useState(false);
  const [rincianOpen, setRincianOpen] = useState(false);

  const canShare = !!onShareOpen;

  // ── Listing sudah terjual: poster & konfirmasi stok tidak relevan lagi
  // karena transaksinya sudah selesai. Edit & bagikan tetap dibuka.
  const isSold = String(data?.status_tayang || "").toUpperCase() === "TERJUAL";

  // ✅ STOKER sendiri -> pilih kontak PIC manual (nomor PIC rahasia, tak ada di DB).
  //    Role lain (Owner, Agent, Admin, Principal, dst) -> pesan dikirim ke nomor STOKER.
  const isStoker = currentJabatan === "STOKER";
  const stokLabel = isStoker ? "Tanya PIC" : "Tanya Stok";

  const handleDownloadPoster = async () => {
    const payload = buildLelangPosterPayload(data, { agentCode: currentAgentId, selfAgent });
    await downloadLelangPoster(payload, setIsBuildingPoster);
  };

  const handleAskStock = () => {
    const kodeProperti =
      data?.kode_properti && data.kode_properti !== "-"
        ? data.kode_properti
        : data?.id_property || "-";
    const alamat = data?.alamat_lengkap || data?.address || "-";
    const tanggalLelang = formatTanggalLelang(data?.tanggal_lelang);

    const text =
      `🔍 *Konfirmasi Stok Properti*\n\n` +
      `🆔 *ID:* ${kodeProperti}\n` +
      `📍 *Lokasi:* ${alamat}\n` +
      `📅 *Tanggal Lelang:* ${tanggalLelang}\n\n` +
      `❓ Apakah aset ini masih *TERSEDIA* atau sudah *TERJUAL*?\n\n` +
      `Ada respon dari klien kami yang sedang menanyakan. Mohon konfirmasi segera. 🙏\n\n` +
      `🔗 *Lihat detail properti:*\n` +
      `${propertyUrl || `${SITE_URL}/Lelang`}`;

    // Stoker/Owner -> pilih kontak PIC manual (nomor PIC rahasia, tak ada di DB).
    // Role lain -> langsung ke nomor stoker dari DB.
    const stokerNum = (stokerPhone || "").replace(/^0/, "62").replace(/\D/g, "");
    const waUrl =
      !isStoker && stokerNum
        ? `https://wa.me/${stokerNum}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(waUrl, "_blank");
  };

  // ── Dock mobile ──────────────────────────────────────────────────────────
  // Hirarki warna: HANYA aksi utama (Bagikan) yang memakai aksen penuh.
  // Semua aksi sekunder memakai permukaan netral yang identik, dibedakan
  // lewat tint ikon + label — supaya tidak ada dua tombol yang terlihat
  // sama-sama "utama" dan tidak ada tombol tanpa keterangan.
  const dockActionClass =
    "shrink-0 w-[58px] h-[50px] rounded-2xl flex flex-col items-center justify-center gap-[3px] " +
    "bg-white/[0.055] border border-white/[0.09] active:bg-white/[0.1] active:scale-[0.95] " +
    "transition-all disabled:opacity-50 disabled:cursor-not-allowed";
  const dockLabelClass =
    "text-[7.5px] font-black uppercase tracking-[0.12em] text-white/45 leading-none";
  // Tanpa tombol Bagikan, "Tanya Stok" naik jadi aksi utama supaya baris dock
  // tetap punya satu titik fokus yang jelas.
  const waIsPrimary = !canShare && !isSold;

  return (
    <>
      <RincianBiayaSheet
        open={rincianOpen}
        onClose={() => setRincianOpen(false)}
        limit={limit}
        provinsi={data?.provinsi}
        luasTanah={luasTanah}
        luasBangunan={luasBangunan}
        konteks={{
          judul: data?.judul,
          kategori: data?.kategori,
          alamat: data?.alamat_lengkap || data?.address,
          kota: data?.kota,
          provinsi: data?.provinsi,
          tanggalLelang: data?.tanggal_lelang ? formatTanggalLelang(data.tanggal_lelang) : null,
          url: propertyUrl,
          namaAgent: selfAgent?.nama || null,
          whatsappAgent: selfAgent?.whatsapp || selfAgent?.telepon || null,
        }}
      />

      {/* ════════════════════ DESKTOP ════════════════════ */}
      {/* Kartu sticky: header & CTA di-pin, hanya rincian yang menggulir —
          jadi tombol aksi tidak pernah terpotong di layar pendek. */}
      <aside
        className="hidden lg:flex flex-col w-[380px] shrink-0 self-start sticky top-24
        max-h-[calc(100dvh-7rem)] overflow-hidden
        bg-slate-950/95 border border-white/10 rounded-3xl
        shadow-[0_24px_80px_rgba(0,0,0,0.75)] backdrop-blur"
      >
        {/* HEADER: Estimasi Biaya — selalu terlihat */}
        <div className="shrink-0 px-6 pt-4 pb-3 [@media(max-height:820px)]:pt-3 [@media(max-height:820px)]:pb-2.5 border-b border-white/10 bg-gradient-to-br from-emerald-500/20 via-emerald-500/5 to-transparent">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-semibold text-emerald-100 tracking-[0.16em] uppercase">
                Estimasi Biaya
              </span>
            </div>
            <button
              onClick={() => setRincianOpen(true)}
              className="flex items-center gap-1 text-[10px] font-semibold text-slate-300 hover:text-white
                rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] px-2 py-1 transition-colors"
            >
              <Icon icon="solar:calculator-minimalistic-bold-duotone" className="text-emerald-300 text-xs" />
              Rincian
            </button>
          </div>

          {/* LIMIT UTAMA */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
              Harga Limit
            </p>
            <p className="mt-1 text-[20px] font-bold text-white leading-tight tabular-nums">
              {formatMoney(limit)}
            </p>
            <p className="mt-1 text-[10px] text-slate-400 [@media(max-height:820px)]:hidden">
              Nilai ini akan menyesuaikan dengan harga menang lelang.
            </p>
          </div>
        </div>

        {/* RINCIAN ESTIMASI — area yang menggulir kalau layar pendek */}
        <div
          className="flex-1 min-h-0 overflow-y-auto px-6 py-3 space-y-2.5 bg-slate-950"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.14) transparent" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-200">
              Rincian Estimasi
            </span>
            <span className="text-[10px] text-slate-400">
              Belum termasuk pajak &amp; biaya lain
            </span>
          </div>

          {/* Dua pos biaya utama — warnanya konsisten dengan sheet rincian
              (hijau = balik nama, kuning = eksekusi) supaya agent tidak perlu
              membaca ulang label saat berpindah tampilan. */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setRincianOpen(true)}
              className="flex flex-col text-left rounded-2xl bg-emerald-500/5 border border-emerald-400/30 px-3 py-2 hover:bg-emerald-500/10 transition-colors"
            >
              <span className="text-[9px] uppercase tracking-[0.16em] text-emerald-200/80">
                Balik Nama
              </span>
              <span className="mt-1 text-[14px] font-semibold text-emerald-50 tabular-nums">
                {formatMoney(biayaBalikNama)}
              </span>
              <span className="mt-1 text-[9px] text-emerald-100/80 leading-snug">
                8,5% × limit + fee Rp 10 jt
              </span>
            </button>

            <button
              onClick={() => setRincianOpen(true)}
              className="flex flex-col text-left rounded-2xl bg-amber-500/5 border border-amber-400/40 px-3 py-2 hover:bg-amber-500/10 transition-colors"
            >
              <span className="text-[9px] uppercase tracking-[0.16em] text-amber-200/80">
                Eksekusi
              </span>
              <span className="mt-1 text-[14px] font-semibold text-amber-50 tabular-nums">
                {formatMoney(biayaEksekusi)}
              </span>
              <span className="mt-1 text-[9px] text-amber-100/80 leading-snug">
                Pengosongan + transportasi + konsumsi
              </span>
            </button>
          </div>

          {/* Total modal: angka pertama yang ditanya klien. */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-[0.16em] text-slate-400">
                Estimasi Total Modal
              </p>
              <p className="text-[9px] text-slate-500 mt-0.5">Limit + balik nama + eksekusi</p>
            </div>
            <p className="text-[15px] font-bold text-white tabular-nums shrink-0">
              {formatMoney(rincian.totalModal)}
            </p>
          </div>

          <button
            onClick={() => setRincianOpen(true)}
            className="w-full mt-1 rounded-2xl bg-white/[0.02] border border-white/5 px-3 py-2 text-left hover:bg-white/[0.05] transition-colors [@media(max-height:900px)]:hidden"
          >
            <p className="text-[9px] text-slate-400 leading-relaxed">
              Buka rincian untuk melihat komponen tiap pos biaya dan menyalin penjelasannya
              dalam format siap kirim ke klien.
            </p>
          </button>
        </div>

        {/* fade petunjuk bahwa area di atas bisa digulir */}
        <div className="shrink-0 h-4 -mt-4 pointer-events-none bg-gradient-to-t from-slate-950 to-transparent" />

        {/* TOMBOL AKSI — di-pin, tidak pernah terpotong */}
        <div className="shrink-0 px-5 pb-3 pt-2 bg-slate-950/95 border-t border-white/5">
          <div className="flex flex-col gap-1.5">
            {/* TOMBOL BAGIKAN — CTA utama: link membawa kode agent ini */}
            {canShare && (
              <button
                onClick={() => onShareOpen?.()}
                className="group w-full flex items-center justify-between px-4 py-3 [@media(max-height:820px)]:py-2.5 rounded-2xl
                  bg-gradient-to-r from-[#86efac] to-[#34d399] text-black
                  shadow-[0_8px_28px_rgba(52,211,153,0.28)] hover:shadow-[0_10px_34px_rgba(52,211,153,0.4)]
                  transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-black/10 flex items-center justify-center">
                    <Icon icon="solar:share-bold-duotone" className="text-black text-lg" />
                  </div>
                  <div className="text-left">
                    <p className="text-[12px] font-extrabold">Bagikan Listing</p>
                    <p className="text-[10px] font-semibold text-black/55">
                      Lead masuk ke nomor &amp; profil kamu
                    </p>
                  </div>
                </div>
                <Icon
                  icon="solar:arrow-right-linear"
                  className="text-black/60 text-base group-hover:translate-x-1 transition-transform"
                />
              </button>
            )}

            {/* ✅ TOMBOL EDIT - HANYA UNTUK OWNER - UPDATED LINK */}
            {isOwner && propertyId && (
              <Link
                href={`/tambah-property?id=${propertyId}&mode=edit`}
                className="group relative w-full overflow-hidden rounded-2xl
                  bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600
                  p-[1px] shadow-[0_0_30px_rgba(168,85,247,0.5)]
                  hover:shadow-[0_0_40px_rgba(168,85,247,0.7)]
                  transition-all duration-300 active:scale-[0.98]"
              >
                <div className="relative w-full h-full bg-slate-950 rounded-2xl px-4 py-3 [@media(max-height:820px)]:py-2
                  flex items-center justify-center gap-2.5
                  group-hover:bg-gradient-to-r group-hover:from-violet-600/10 group-hover:via-fuchsia-600/10 group-hover:to-pink-600/10
                  transition-all duration-300">

                  {/* Animated Background Glow */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute top-0 left-0 w-20 h-20 bg-violet-500/30 rounded-full blur-2xl animate-pulse" />
                    <div className="absolute bottom-0 right-0 w-20 h-20 bg-pink-500/30 rounded-full blur-2xl animate-pulse delay-75" />
                  </div>

                  {/* Icon with Glow */}
                  <div className="relative flex items-center justify-center w-8 h-8 rounded-xl
                    bg-gradient-to-br from-violet-500/20 to-pink-500/20
                    border border-violet-400/40
                    group-hover:border-violet-300/70
                    transition-all duration-300">
                    <Icon
                      icon="solar:pen-new-square-bold-duotone"
                      className="text-violet-200 text-lg group-hover:text-white group-hover:scale-110 transition-all duration-300"
                    />
                  </div>

                  {/* Text */}
                  <div className="relative text-left flex-1">
                    <p className="text-[12px] font-bold bg-gradient-to-r from-violet-200 via-fuchsia-200 to-pink-200 bg-clip-text text-transparent
                      group-hover:from-white group-hover:via-violet-100 group-hover:to-pink-100
                      transition-all duration-300">
                      Edit Properti Saya
                    </p>
                    <p className="text-[9px] text-slate-400 group-hover:text-slate-300 transition-colors duration-300 [@media(max-height:820px)]:hidden">
                      Kelola listing &amp; data properti
                    </p>
                  </div>

                  {/* Arrow Icon */}
                  <Icon
                    icon="solar:arrow-right-linear"
                    className="relative text-violet-300 text-base opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300"
                  />
                </div>
              </Link>
            )}

            {isSold ? (
              <div className="w-full rounded-2xl border border-red-500/25 bg-red-500/[0.06] px-4 py-3 flex items-center gap-2.5">
                <Icon icon="solar:lock-keyhole-minimalistic-bold-duotone" className="text-red-400 text-lg shrink-0" />
                <p className="text-[11px] text-red-300/80 font-semibold leading-snug">
                  Listing sudah terjual — poster &amp; konfirmasi stok tidak tersedia.
                </p>
              </div>
            ) : (
            <>
            <button
              onClick={handleDownloadPoster}
              disabled={isBuildingPoster}
              className="btn-lux btn-lux--poster w-full flex items-center justify-between px-4 py-2.5 [@media(max-height:820px)]:py-2 rounded-2xl disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2.5">
                <span className="btn-lux__chip w-8 h-8">
                  <Icon icon={isBuildingPoster ? "solar:spinner-bold" : "solar:gallery-wide-bold-duotone"} className={`lux-ico text-sky-100 text-lg ${isBuildingPoster ? "animate-spin" : ""}`} />
                </span>
                <div className="text-left">
                  <p className="text-[11px] font-bold text-white">
                    {isBuildingPoster ? "Membuat poster…" : "Download Poster"}
                  </p>
                  <p className="text-[10px] text-sky-100/60 [@media(max-height:820px)]:hidden">
                    {isBuildingPoster ? "Merender katalog aset…" : "Katalog story 1080×1920 siap dibagikan"}
                  </p>
                </div>
              </div>
              {!isBuildingPoster && (
                <Icon icon="solar:download-minimalistic-bold" className="lux-ico text-sky-300 text-sm" />
              )}
            </button>

            <button
              onClick={handleAskStock}
              className="w-full flex items-center justify-between px-4 py-2 rounded-2xl
                bg-emerald-500/14 border border-emerald-400/70 hover:bg-emerald-500/24
                transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/25 border border-emerald-100/70 flex items-center justify-center">
                  <Icon
                    icon="ic:baseline-whatsapp"
                    className="text-emerald-50 text-lg"
                  />
                </div>
                <div className="text-left">
                  <p className="text-[11px] font-semibold text-emerald-50">
                    {stokLabel}
                  </p>
                  <p className="text-[10px] text-emerald-100/80 [@media(max-height:820px)]:hidden">
                    {isStoker
                      ? "Buka WA, pilih kontak PIC, lalu kirim."
                      : "Kirim detail aset ke stoker via WA."}
                  </p>
                </div>
              </div>
              <Icon
                icon="solar:arrow-right-up-linear"
                className="text-emerald-50 text-sm"
              />
            </button>
            </>
            )}
          </div>
        </div>
      </aside>

      {/* ════════════════════ MOBILE / MID — dock ════════════════════ */}
      {/* Dua lapis: baris info (angka, bisa diketuk untuk rincian) lalu baris
          aksi. Memisahkan "membaca" dari "menekan" bikin tiap tombol punya
          satu makna yang jelas. */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#020617]/[0.97] backdrop-blur-xl"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          boxShadow:
            "0 -16px 48px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.06)",
          borderTop: "1px solid rgba(255,255,255,0.09)",
        }}
      >
        {/* ── Baris info: limit + estimasi biaya, ketuk untuk rincian ── */}
        <button
          onClick={() => setRincianOpen(true)}
          aria-label="Lihat rincian estimasi biaya"
          className="w-full h-[32px] px-4 flex items-center justify-between gap-2
            border-b border-white/[0.06] active:bg-white/[0.035] transition-colors"
        >
          <span className="flex items-center gap-2 min-w-0 leading-none">
            <span className="flex items-baseline gap-1.5 shrink-0">
              <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/35">
                Limit
              </span>
              <span className="text-[11.5px] font-bold text-white tabular-nums">
                {formatMoneyShort(limit)}
              </span>
            </span>
            <span className="w-px h-2.5 bg-white/10 shrink-0" />
            <span className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/35 shrink-0">
                Est. Biaya
              </span>
              <span className="text-[11.5px] font-bold text-emerald-300 tabular-nums truncate">
                {formatMoneyShort(totalBiaya)}
              </span>
            </span>
          </span>
          <span className="flex items-center gap-0.5 shrink-0 text-white/40">
            <span className="text-[9.5px] font-bold uppercase tracking-[0.1em] max-[359px]:hidden">
              Rincian
            </span>
            <Icon icon="solar:alt-arrow-right-linear" className="text-[11px]" />
          </span>
        </button>

        {/* ── Baris aksi: satu aksi utama, sisanya netral & berlabel ── */}
        <div className="px-3 pt-2 pb-2.5 flex items-center gap-2">
          {canShare && (
            <button
              onClick={() => onShareOpen?.()}
              className="flex-1 min-w-0 h-[50px] flex items-center justify-center gap-2 rounded-2xl
                bg-gradient-to-r from-[#86efac] to-[#34d399] text-black
                shadow-[0_6px_22px_rgba(52,211,153,0.32)] active:scale-[0.97] transition-all"
            >
              <Icon icon="solar:share-bold-duotone" className="text-[19px] shrink-0" />
              <span className="text-left leading-none min-w-0">
                <span className="block text-[13.5px] font-extrabold truncate">Bagikan</span>
                <span className="block mt-[3px] text-[8.5px] font-bold text-black/50 truncate max-[359px]:hidden">
                  Lead masuk ke nomor kamu
                </span>
              </span>
            </button>
          )}

          {isSold ? (
            <div
              className={`${canShare ? "shrink-0 px-3.5" : "flex-1"} h-[50px] flex items-center justify-center gap-2
                rounded-2xl border border-red-500/25 bg-red-500/[0.08]`}
            >
              <Icon icon="solar:lock-keyhole-minimalistic-bold-duotone" className="text-red-400 text-lg shrink-0" />
              <span className="text-[11px] font-bold text-red-300/80 whitespace-nowrap">Terjual</span>
            </div>
          ) : (
            <>
              <button
                onClick={handleDownloadPoster}
                disabled={isBuildingPoster}
                className={dockActionClass}
              >
                <Icon
                  icon={isBuildingPoster ? "solar:spinner-bold" : "solar:gallery-wide-bold-duotone"}
                  className={`text-sky-300 text-[19px]${isBuildingPoster ? " animate-spin" : ""}`}
                />
                <span className={dockLabelClass}>{isBuildingPoster ? "Proses" : "Poster"}</span>
              </button>

              <button
                onClick={handleAskStock}
                className={
                  waIsPrimary
                    ? "flex-1 min-w-0 h-[50px] flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-black font-extrabold text-[13.5px] shadow-[0_6px_20px_rgba(16,185,129,0.3)] active:scale-[0.97] transition-all"
                    : dockActionClass
                }
              >
                <Icon icon="ic:baseline-whatsapp" className={waIsPrimary ? "text-[19px] shrink-0" : "text-emerald-300 text-[19px]"} />
                {waIsPrimary ? (
                  <span className="truncate">{stokLabel}</span>
                ) : (
                  <span className={dockLabelClass}>{isStoker ? "PIC" : "Stok"}</span>
                )}
              </button>
            </>
          )}

          {isOwner && propertyId && (
            <Link href={`/tambah-property?id=${propertyId}&mode=edit`} className={dockActionClass}>
              <Icon icon="solar:pen-new-square-bold-duotone" className="text-violet-300 text-[19px]" />
              <span className={dockLabelClass}>Edit</span>
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

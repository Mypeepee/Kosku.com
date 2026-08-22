"use client";

/**
 * Panel pemesanan — kolom kanan yang mengikuti scroll di desktop, dan bar bawah
 * + bottom sheet di layar kecil. Polanya sengaja sama persis dengan panel agent
 * di halaman Jual & Lelang: pengunjung yang sudah pernah membuka salah satunya
 * tidak perlu belajar tata letak baru, dan aksi utama selalu berada di tempat
 * yang sama (kanan atas di desktop, menempel di bawah layar di mobile).
 *
 * Satu isi panel dipakai dua kali (desktop & sheet) lewat renderPanel() supaya
 * tidak ada versi yang tertinggal saat ada perubahan — bug klasik ketika markup
 * desktop dan mobile ditulis terpisah.
 */

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";

import Kalender, { type FaseRentang } from "./Kalender";
import SurveiModal from "./SurveiModal";
import VoucherSheet from "./VoucherSheet";
import PengajuanSewaModal from "./PengajuanSewaModal";
import { useVoucher } from "../lib/useVoucher";
import { useSeretTutup } from "../lib/useSeretTutup";
import {
  AKSEN,
  KILAU_PANEL,
  LINE,
  SURFACE,
  aksenSisaKamar,
} from "./sewaTheme";
import {
  DURASI_META,
  formatRupiah,
  formatRupiahSingkat,
  formatTanggal,
  formatTanggalHari,
  tambahDurasi,
} from "@/lib/kosDetail";
import type { BookingState } from "../lib/useBooking";
import type { SewaDetailData } from "../types";

/**
 * `penyewa`   — panel seperti biasa, tombol aksi hidup.
 * `pratinjau` — dilihat pengelola listing ini sendiri. Isinya SAMA PERSIS,
 *               hanya tombol aksinya dihilangkan. Bukan kosmetik: pengajuan
 *               sewa yang hidup akan tercatat sebagai lead atas listingnya
 *               sendiri — mengotori persis angka yang dipakai menilai listing
 *               itu — dan penjadwalan surveinya berakhir di nomor sendiri.
 */
export type ModePanel = "penyewa" | "pratinjau";

interface Props {
  data: SewaDetailData;
  booking: BookingState;
  mode?: ModePanel;
  /**
   * Peran pembaca BELUM diketahui — sesi masih dibaca.
   *
   * Selama ini true, panel tidak menampilkan satu pun kontrol yang khas peran:
   * tidak ada "Ajukan Sewa", tidak ada tab "Kelola". Lihat catatan panjang di
   * `renderMenunggu` untuk kenapa menebak salah satunya lebih buruk daripada
   * menunggu.
   */
  menunggu?: boolean;
  /**
   * Token muat-ulang voucher. Dinaikkan halaman setiap kali pemilik menyunting
   * vouchernya lewat drawer kelola, supaya panel ini tidak terus menawarkan
   * promo yang baru saja dihapus.
   */
  voucherVersi?: number;
  /**
   * Isi panel untuk PENGELOLA (kelola ketersediaan & voucher). Kalau diisi,
   * panel ini tumbuh sepasang tab: "Kelola" (isi slot ini) dan "Pratinjau"
   * (panel penyewa apa adanya).
   *
   * Berbentuk fungsi, bukan node, supaya isinya bisa MENUTUP bottom sheet
   * sebelum membuka drawer kelola. Tanpa itu, di ponsel drawer terbuka di atas
   * sheet yang masih membentang — dua lapis gelap bertumpuk, dan menutup yang
   * atas mengembalikan pengguna ke lapis yang sudah tidak dia butuhkan.
   * Di desktop `tutupSheet` tidak melakukan apa-apa; sheet-nya memang tidak
   * pernah terbuka.
   */
  panelPengelola?: (tutupSheet: () => void) => React.ReactNode;
}

// ─────────────────────────────────────────────────────────────────────────────
// POTONGAN
// ─────────────────────────────────────────────────────────────────────────────

function Stepper({
  nilai,
  min,
  maks,
  onUbah,
}: {
  nilai: number;
  min: number;
  maks: number;
  /** Menerima selisih (+1/−1), bukan nilai baru — lihat catatan di useBooking. */
  onUbah: (delta: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onUbah(-1)}
        disabled={nilai <= min}
        className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.07] text-white transition-colors hover:bg-white/[0.14] disabled:opacity-20"
        aria-label="Kurangi"
      >
        <Icon icon="ic:round-minus" width="14" />
      </button>
      <span className="w-6 text-center text-xs font-extrabold tabular-nums text-white">
        {nilai}
      </span>
      <button
        onClick={() => onUbah(1)}
        disabled={nilai >= maks}
        className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.07] text-white transition-colors hover:bg-white/[0.14] disabled:opacity-20"
        aria-label="Tambah"
      >
        <Icon icon="ic:round-plus" width="14" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KOMPONEN UTAMA
// ─────────────────────────────────────────────────────────────────────────────

export default function BookingSidebar({
  data,
  booking,
  mode = "penyewa",
  menunggu = false,
  voucherVersi = 0,
  panelPengelola,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [sheet, setSheet] = useState(false);
  /**
   * Tab pengelola. Bawaannya "kelola", bukan "pratinjau": pengelola yang
   * membuka listingnya sendiri hampir selalu datang untuk MENGUBAH sesuatu —
   * menutup tanggal yang baru terisi, memasang promo karena kamarnya sepi.
   * Melihat tampilan penyewa adalah pemeriksaan sesudahnya, bukan tujuannya.
   */
  const [tabPengelola, setTabPengelola] = useState<"kelola" | "pratinjau">(
    "kelola",
  );
  const [kalender, setKalender] = useState(false);
  const [fase, setFase] = useState<FaseRentang>("mulai");
  const [survei, setSurvei] = useState(false);
  const [pilihTipeBuka, setPilihTipeBuka] = useState(false);
  const [voucherBuka, setVoucherBuka] = useState(false);
  const [pengajuanBuka, setPengajuanBuka] = useState(false);
  /**
   * Rincian biaya sengaja TERTUTUP saat pertama dibuka.
   *
   * Selama penyewa masih mengubah tipe/tanggal/lama sewa, angka yang dia awasi
   * hanya satu: total. Membentangkan empat baris rincian di bawah setiap
   * perubahan membuat panel berdenyut naik-turun dan mendorong tombol aksi
   * keluar layar — dan rinciannya sendiri baru benar-benar dibaca sekali, tepat
   * sebelum mengajukan (di sana ia memang tampil utuh tanpa perlu dibuka).
   */
  const [rincianBuka, setRincianBuka] = useState(false);

  /**
   * Seret-ke-bawah untuk kedua lapisan yang muncul dari bawah layar. Masing-
   * masing punya instansnya sendiri: satu sheet bisa terbuka di atas yang lain,
   * dan satu state seret bersama akan menggeser keduanya sekaligus.
   */
  const seretSheet = useSeretTutup(() => setSheet(false));
  const seretKalender = useSeretTutup(() => setKalender(false));

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!sheet && !kalender) return;
    const asal = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = asal;
    };
  }, [sheet, kalender]);

  // Esc menutup kalender. Kalender dirender lewat portal di <body>, jadi tidak
  // ada elemen pembungkus yang bisa menerima keydown — listener harus di dokumen.
  useEffect(() => {
    if (!kalender) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setKalender(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [kalender]);

  // Tutup dropdown tipe saat klik di luar. Ditandai lewat data-attribute, bukan
  // ref: isi panel dirender dua kali (desktop & sheet), jadi satu ref hanya akan
  // menunjuk salah satunya dan dropdown di salinan lain tidak pernah tertutup.
  useEffect(() => {
    if (!pilihTipeBuka) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest("[data-pilih-tipe]")) setPilihTipeBuka(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pilihTipeBuka]);

  const {
    durasi,
    durasiOpsi,
    pilihDurasi,
    tipe,
    tipeList,
    pilihTipe,
    tipeTanpaDurasi,
    tanggalMulai,
    setTanggalMulai,
    tanggalSelesai,
    setTanggalSelesai,
    snapTanggalSelesai,
    totalHari,
    hapusTanggal,
    lama,
    ubahLama,
    lamaMin,
    lamaMaks,
    penghuni,
    ubahPenghuni,
    penghuniMaks,
    hargaSatuan,
    deposit,
    sisaKamar,
    penuh,
    penuhKarenaTanggal,
    sisaUntukTipe,
    ketersediaanKalender,
    kapasitas,
  } = booking;

  const pratinjau = mode === "pratinjau";
  /** Pembacanya berwenang DAN halaman memang menitipkan alat kelolanya. */
  const modePengelola = pratinjau && Boolean(panelPengelola);
  const tersewa = data.statusTayang !== "TERSEDIA";
  const terkunci = tersewa || penuh || hargaSatuan <= 0;
  const unitTunggal = data.modelInventaris === "UNIT";

  /**
   * Promo hanya ditampilkan kalau harga yang sedang dilihat memang harga yang
   * dipromokan. `harga_promo` di tabel listing menempel pada `harga` (durasi
   * utama, tipe termurah) — menerapkannya ke tipe atau durasi lain berarti
   * menjanjikan potongan yang tidak pernah disetujui pemilik.
   */
  const promoBerlaku =
    data.hargaPromo != null &&
    data.hargaPromo < data.harga &&
    hargaSatuan === data.harga;
  const hargaEfektif = promoBerlaku ? (data.hargaPromo as number) : hargaSatuan;
  const subtotal = hargaEfektif * lama;

  /**
   * Keadaan yang dinilai voucher. Dibungkus useMemo bukan demi kecepatan —
   * evaluasinya murah — melainkan supaya identitasnya stabil: objek baru di
   * tiap render membatalkan seluruh useMemo di dalam useVoucher, termasuk
   * urutan daftar yang sedang dilihat penyewa di sheet.
   *
   * Yang dikirim `subtotal`, BUKAN total. Deposit tidak pernah ikut didiskon —
   * lihat catatan di @/lib/voucher.
   */
  const konteksVoucher = useMemo(
    () => ({
      subtotal,
      durasi,
      lama,
      tanggalMulai,
      // Tipe kamar ikut dikirim supaya voucher yang dibatasi ke satu tipe
      // dinilai benar. `namaTipe` HANYA dipakai menyusun kalimat sebab
      // ("Hanya untuk tipe Deluxe") — nama diambil dari daftar tipe yang
      // sedang tampil, bukan dari nama yang tersimpan di vouchernya, supaya
      // kalimatnya selalu cocok dengan kartu tipe di atasnya.
      idTipe: tipe?.id ?? null,
      namaTipe: Object.fromEntries(tipeList.map((t) => [t.id, t.nama])),
    }),
    [subtotal, durasi, lama, tanggalMulai, tipe?.id, tipeList],
  );

  const voucher = useVoucher(data.idProperty, konteksVoucher, voucherVersi);

  const potongan = voucher.potongan;
  const totalEfektif = subtotal + deposit - potongan;

  const voucherDipakai = potongan > 0;
  /** Potongan terbesar yang bisa didapat sekarang — umpan baris voucher. */
  const hematTerbaik = voucher.terbaik?.potongan ?? 0;

  const ringkasanPilihan = tipe
    ? `tipe ${tipe.nama}${tipe.luasKamar ? ` (${tipe.luasKamar} m²)` : ""}`
    : undefined;

  const lokasiRingkas =
    [data.kelurahan, data.kecamatan, data.kota].filter(Boolean).join(", ") ||
    data.kota;

  const bukaKalender = (f: FaseRentang) => {
    // Tanpa tanggal masuk, fase "selesai" tidak punya titik awal untuk dihitung —
    // klik pada kolom "Sampai" pun dimulai dari tanggal masuk.
    setFase(tanggalMulai ? f : "mulai");
    setKalender(true);
  };

  /**
   * Sewa non-harian ditagih per satuan penuh, jadi tanggal keluar yang dipilih
   * dibulatkan. Dikatakan di muka — penyewa yang mengklik 20 November lalu melihat
   * 9 Desember tanpa penjelasan akan menganggapnya bug.
   */
  const catatanPembulatan =
    durasi === "HARIAN"
      ? null
      : `Dihitung per ${DURASI_META[durasi].satuan} penuh — tanggal keluar menyesuaikan.`;

  const ringkasanMasaSewa =
    tanggalMulai && tanggalSelesai
      ? `${formatTanggal(tanggalMulai)} – ${formatTanggal(tanggalSelesai)}`
      : null;

  /**
   * Batas jelajah kalender dibuat cukup jauh untuk mencapai sewa terpanjang yang
   * boleh dipilih stepper. Kalau tidak, ada masa sewa yang bisa disetel lewat
   * tombol +/− tapi tanggal keluarnya tidak pernah bisa diklik di kalender —
   * dua kontrol untuk satu angka dengan batas yang berbeda.
   */
  const bulanKeDepanKalender = (() => {
    const hariIni = new Date();
    const akhirTerjauh = tambahDurasi(tanggalMulai ?? hariIni, durasi, lamaMaks);
    const selisihBulan =
      (akhirTerjauh.getFullYear() - hariIni.getFullYear()) * 12 +
      (akhirTerjauh.getMonth() - hariIni.getMonth());
    return Math.max(12, selisihBulan + 1);
  })();

  /* Dulu di sini ada `hubungiWA` — pembangun pesan WhatsApp untuk tombol "Chat
     agent" di area aksi. Tombolnya dihapus (lihat catatan di sana), dan
     fungsinya ikut dihapus daripada ditinggal menganggur: pesan WhatsApp yang
     setara sudah dibangun di PengajuanSewaModal & SurveiModal, dan dua salinan
     format pesan yang sama adalah dua tempat yang harus diingat saat harganya
     berubah bentuk. */

  /**
   * Isi panel, dipakai desktop & bottom sheet.
   *
   * Sengaja fungsi yang DIPANGGIL (`{renderPanel()}`), bukan komponen yang
   * di-render (`<PanelIsi/>`). Komponen yang didefinisikan di dalam render
   * menghasilkan tipe baru tiap kali state berubah — React akan melepas lalu
   * memasang ulang seluruh subtree, sehingga dropdown tertutup sendiri dan
   * input kehilangan fokus setiap kali tombol stepper ditekan.
   */
  const renderPanel = () => (
    <>
      {/* Harga — satu-satunya hal berukuran besar di panel. Semua kontrol di
          bawahnya sengaja seragam & tenang supaya angka ini tidak punya
          pesaing; itu yang membuat panel terbaca dalam sekali lihat. */}
      <div className="px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {promoBerlaku && (
              <p className="mb-1 text-xs font-medium text-white/25 line-through tabular-nums">
                {formatRupiah(data.harga)}
              </p>
            )}
            <p className="flex flex-wrap items-baseline gap-x-1.5 text-[2rem] font-black leading-[1.05] tracking-[-0.02em] tabular-nums text-white">
              {hargaSatuan > 0 ? formatRupiah(hargaEfektif) : "Hubungi agent"}
              {hargaSatuan > 0 && (
                <span className="text-xs font-semibold tracking-normal text-white/35">
                  {DURASI_META[durasi].suffix}
                </span>
              )}
            </p>
          </div>
          {promoBerlaku && (
            <span
              className={`mt-1 shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${AKSEN.mint.chip}`}
            >
              Promo
            </span>
          )}
        </div>

        {/* Baris status: tipe yang dipilih + ketersediaannya. Ketersediaan di
            sini SELALU mengikuti tanggal yang sedang dipilih — kalau tidak, ia
            akan menjanjikan kamar untuk masa sewa yang kalender di bawahnya
            sendiri sudah mencoret. */}
        {(tipe || sisaKamar != null || unitTunggal) && (
          <p className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] font-semibold text-white/40">
            {tipe && (
              <>
                <Icon
                  icon="solar:bed-bold-duotone"
                  className={`text-sm ${AKSEN.violet.ikon}`}
                />
                Tipe {tipe.nama}
              </>
            )}

            {tipe && (unitTunggal || sisaKamar != null) && (
              <span className="text-white/15">·</span>
            )}

            {unitTunggal ? (
              <span className={penuh ? AKSEN.rose.teks : AKSEN.emerald.teks}>
                {!penuh
                  ? "Unit tersedia"
                  : penuhKarenaTanggal
                    ? "Tidak tersedia pada tanggal itu"
                    : "Sedang tidak tersedia"}
              </span>
            ) : (
              sisaKamar != null && (
                <span className={aksenSisaKamar(sisaKamar).teks}>
                  {sisaKamar > 0
                    ? `sisa ${sisaKamar} kamar`
                    : penuhKarenaTanggal
                      ? "penuh pada tanggal itu"
                      : "kamar penuh"}
                </span>
              )
            )}

            {tanggalMulai && (
              <span className="text-white/25">
                · untuk masa sewa terpilih
              </span>
            )}
          </p>
        )}
      </div>

      {/* Tab durasi — penanda aktif MELUNCUR ke pilihan baru, bukan berkedip
          pindah. Perpindahan yang bisa diikuti mata memberi tahu bahwa yang
          berubah hanyalah satuan waktunya, dan angka harga di atas berubah
          karena itu — bukan karena harganya tiba-tiba lain. */}
      {durasiOpsi.length > 1 && (
        <div className="px-5 pt-4">
          <div
            className="relative flex rounded-2xl border border-white/[0.06] p-1"
            style={{ background: SURFACE.raised }}
          >
            <span
              aria-hidden
              className="absolute inset-y-1 left-1 rounded-xl bg-[#86efac] shadow-[0_4px_16px_-6px_rgba(134,239,172,0.9)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                width: `calc((100% - 0.5rem) / ${durasiOpsi.length})`,
                transform: `translateX(${Math.max(0, durasiOpsi.indexOf(durasi)) * 100}%)`,
              }}
            />
            {durasiOpsi.map((d) => (
              <button
                key={d}
                onClick={() => pilihDurasi(d)}
                className={`relative z-10 flex-1 rounded-xl py-2 text-[11px] font-bold transition-colors duration-200 ${
                  durasi === d ? "text-black" : "text-white/40 hover:text-white"
                }`}
              >
                {DURASI_META[d].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Kontrol — SATU objek dengan pemisah rambut, bukan empat kartu
          melayang berjarak. Empat kartu membuat mata berhenti empat kali dan
          panel terasa panjang; satu blok terbaca sebagai satu formulir, dan
          tinggi yang dihemat itulah yang membuatnya muat tanpa scroll. */}
      <div
        className="mx-5 mt-3 divide-y divide-white/[0.06] overflow-visible rounded-2xl border border-white/[0.08]"
        style={{ background: SURFACE.raised }}
      >
        {/* Pemilih tipe kamar */}
        {tipeList.length > 0 && (
          <div className="relative" data-pilih-tipe>
            <button
              onClick={() => setPilihTipeBuka((v) => !v)}
              className="flex w-full items-center justify-between rounded-t-2xl p-3 text-left transition-colors hover:bg-white/[0.03]"
            >
              <div className="min-w-0">
                <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-white/30">
                  Tipe kamar
                </span>
                <span className="block truncate text-xs font-bold text-white">
                  {tipe?.nama ?? "Pilih tipe"}
                </span>
              </div>
              <Icon
                icon="solar:alt-arrow-down-linear"
                className={`shrink-0 text-lg text-white/50 transition-transform ${
                  pilihTipeBuka ? "rotate-180" : ""
                }`}
              />
            </button>

            {pilihTipeBuka && (
              <div
                className="absolute left-0 top-full z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-white/[0.12] shadow-2xl"
                style={{ background: SURFACE.modal }}
              >
                {tipeList.map((t) => {
                  const tanpaDurasi = tipeTanpaDurasi(t);
                  // Sisa pada MASA SEWA yang sedang dipilih, bukan sisa hari
                  // ini: tanpa itu daftar menawarkan tipe yang panelnya sendiri
                  // akan menolak begitu tipe itu dipilih.
                  const sisa = sisaUntukTipe(t);
                  const habis = sisa <= 0;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        if (habis) return;
                        pilihTipe(t.id);
                        setPilihTipeBuka(false);
                      }}
                      disabled={habis}
                      className={`flex w-full items-center justify-between gap-3 border-b border-white/[0.05] px-3.5 py-3 text-left transition-colors last:border-0 ${
                        habis ? "cursor-not-allowed opacity-35" : "hover:bg-white/[0.05]"
                      } ${tipe?.id === t.id ? "bg-[#86efac]/[0.07]" : ""}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-white">
                          {t.nama}
                        </p>
                        <p className="text-[10px] text-white/35">
                          {habis
                            ? tanggalMulai
                              ? "Penuh pada tanggal itu"
                              : "Kamar penuh"
                            : tanpaDurasi
                              ? `Tidak tersedia ${DURASI_META[durasi].label.toLowerCase()}`
                              : `Sisa ${sisa} kamar`}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] font-extrabold tabular-nums text-white/70">
                        {t.harga[durasi]
                          ? formatRupiahSingkat(t.harga[durasi] as number)
                          : "—"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tanggal masuk & keluar */}
        <div>
          <div className="flex divide-x divide-white/[0.06]">
            <button
              onClick={() => bukaKalender("mulai")}
              className="flex-1 p-3 text-left transition-colors hover:bg-white/[0.03]"
            >
              <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-white/30">
                Mulai sewa
              </span>
              <span
                className={`mt-0.5 block truncate text-xs font-bold ${
                  tanggalMulai ? "text-white" : "text-white/35"
                }`}
              >
                {tanggalMulai ? formatTanggal(tanggalMulai) : "Pilih tanggal"}
              </span>
            </button>
            <button
              onClick={() => bukaKalender("selesai")}
              className="flex-1 p-3 text-left transition-colors hover:bg-white/[0.03]"
            >
              <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-white/30">
                Sampai
              </span>
              <span
                className={`mt-0.5 block truncate text-xs font-bold ${
                  tanggalSelesai ? "text-white" : "text-white/35"
                }`}
              >
                {tanggalSelesai ? formatTanggal(tanggalSelesai) : "Pilih tanggal"}
              </span>
            </button>
          </div>
          {/* Strip hasil hitungan: sky, karena ini fakta tanggal — bukan uang. */}
          {totalHari != null && (
            <div
              className={`flex items-center gap-1.5 border-t px-3.5 py-2 text-[10px] font-bold ${LINE.row} ${AKSEN.sky.wash} ${AKSEN.sky.teks}`}
            >
              <Icon icon="solar:calendar-mark-linear" className="text-xs" />
              {lama} {DURASI_META[durasi].satuan}
              <span className="opacity-40">·</span>
              {totalHari} hari
            </div>
          )}
        </div>

        {/* Lama sewa */}
        <div className="flex items-center justify-between gap-3 p-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${AKSEN.sky.kotak}`}
            >
              <Icon icon="solar:clock-circle-bold-duotone" className="text-base" />
            </span>
            <div className="min-w-0">
              <span className="block truncate text-xs font-bold text-white/75">
                Lama sewa ({DURASI_META[durasi].satuan})
              </span>
              {lamaMin > 1 && (
                <span className="block text-[10px] text-white/30">
                  Minimal {lamaMin} {DURASI_META[durasi].satuan}
                </span>
              )}
            </div>
          </div>
          <Stepper nilai={lama} min={lamaMin} maks={lamaMaks} onUbah={ubahLama} />
        </div>

        {/* Penghuni */}
        <div className="flex items-center justify-between gap-3 rounded-b-2xl p-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${AKSEN.violet.kotak}`}
            >
              <Icon
                icon="solar:users-group-rounded-bold-duotone"
                className="text-base"
              />
            </span>
            <div className="min-w-0">
              <span className="block text-xs font-bold text-white/75">Penghuni</span>
              <span className="block text-[10px] text-white/30">
                Maks {penghuniMaks} orang per kamar
              </span>
            </div>
          </div>
          <Stepper
            nilai={penghuni}
            min={1}
            maks={penghuniMaks}
            onUbah={ubahPenghuni}
          />
        </div>
      </div>

      {/* ── VOUCHER ──
          Satu baris, bukan daftar yang dibentangkan di panel. Voucher adalah
          langkah kedua: yang menentukan keputusan sewa tetap kamar, tanggal &
          harga di atasnya. Baris ini cukup menyatakan ADA yang bisa dihemat —
          pilihannya terjadi di sheet, tempat kartunya punya ruang untuk
          menjelaskan syaratnya masing-masing.

          Barisnya SELALU ada selama katalog berhasil dimuat, termasuk ketika
          listing ini belum punya promo satu pun. Dulu ia disembunyikan di
          keadaan itu, dan akibatnya: penyewa yang memegang kode khusus dari
          pemilik tidak punya satu pun tempat untuk memasukkannya — kolom
          kodenya ada di dalam sheet yang tidak pernah bisa dibuka. Voucher
          rahasia memang tidak pernah ikut di katalog publik, jadi "katalog
          kosong" tidak sama dengan "tidak ada yang bisa dipakai".

          Barisnya baru hilang sama sekali kalau katalog GAGAL dimuat: voucher
          itu bonus, dan pesan galat tentang bonus di sebelah tombol pemesanan
          hanya menimbulkan keraguan pada pemesanannya. */}
      {!terkunci && !voucher.gagalMuat && (
        <div className="px-5 pt-3">
          {voucher.memuat ? (
            <div className="h-[58px] animate-pulse rounded-2xl bg-white/[0.04] motion-reduce:animate-none" />
          ) : (
            <button
              onClick={() => setVoucherBuka(true)}
              className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all duration-200 active:scale-[0.99] motion-reduce:transition-none ${
                voucher.gugur
                  ? `border-rose-400/30 ${AKSEN.rose.wash}`
                  : voucherDipakai
                    ? `border-[#86efac]/40 ${AKSEN.mint.wash}`
                    : "border-white/[0.08] hover:border-white/25"
              }`}
              style={
                voucher.gugur || voucherDipakai
                  ? undefined
                  : { background: SURFACE.raised }
              }
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${
                  voucher.gugur
                    ? AKSEN.rose.kotak
                    : voucherDipakai
                      ? AKSEN.mint.kotak
                      : "border-white/10 bg-white/[0.04] text-white/45"
                }`}
              >
                <Icon
                  icon={
                    voucher.gugur
                      ? "solar:danger-triangle-bold-duotone"
                      : "solar:ticket-sale-bold-duotone"
                  }
                  className="text-lg"
                />
              </span>

              <div className="min-w-0 flex-1">
                {voucher.dipilih ? (
                  <>
                    <p className="truncate text-xs font-extrabold tracking-wide text-white">
                      {voucher.dipilih.kode}
                    </p>
                    {/* Voucher yang gugur menampilkan SEBABNYA, bukan
                        namanya. Namanya sudah ada di baris atas; yang belum
                        diketahui penyewa adalah kenapa potongannya hilang
                        setelah dia mengubah lama sewa. */}
                    <p
                      className={`truncate text-[10px] font-semibold ${
                        voucher.gugur ? AKSEN.rose.teks : "text-white/40"
                      }`}
                    >
                      {voucher.gugur
                        ? voucher.hasil?.alasan
                        : voucher.dipilih.nama}
                    </p>
                  </>
                ) : voucher.daftar.length > 0 ? (
                  <>
                    <p className="text-xs font-extrabold text-white">
                      Punya voucher?
                    </p>
                    <p className={`text-[10px] font-semibold ${AKSEN.mint.teks}`}>
                      {hematTerbaik > 0
                        ? `Hemat sampai ${formatRupiah(hematTerbaik)}`
                        : `${voucher.daftar.length} promo tersedia`}
                    </p>
                  </>
                ) : (
                  /* Katalog kosong. Yang tersisa adalah kode khusus yang
                     dibagikan pemilik lewat japri — jadi barisnya mengajak
                     memasukkan kode, bukan mengumumkan "0 promo tersedia"
                     yang membuat baris ini terbaca seperti kerusakan. */
                  <>
                    <p className="text-xs font-extrabold text-white">
                      Punya kode voucher?
                    </p>
                    <p className="text-[10px] font-semibold text-white/40">
                      Masukkan kode dari pemilik
                    </p>
                  </>
                )}
              </div>

              <span className="flex shrink-0 items-center gap-1">
                {voucherDipakai && (
                  <span
                    className={`text-xs font-black tabular-nums ${AKSEN.mint.teks}`}
                  >
                    −{formatRupiahSingkat(potongan)}
                  </span>
                )}
                <Icon
                  icon="solar:alt-arrow-right-linear"
                  className="text-lg text-white/30"
                />
              </span>
            </button>
          )}
        </div>
      )}

      {/* ── ESTIMASI TOTAL ──
          Dikembalikan ke panel karena voucher membuatnya wajib: potongan yang
          tidak terlihat mengubah angka apa pun sama saja dengan tidak ada.
          Tetap ringkas — satu baris yang bisa dibuka — supaya tinggi panel
          yang selama ini pas tanpa scroll tidak dikorbankan untuk empat baris
          yang hanya sesekali dibaca. */}
      {!terkunci && hargaSatuan > 0 && (
        <div
          className="mx-5 mt-3 overflow-hidden rounded-2xl border border-white/[0.08]"
          style={{ background: SURFACE.raised }}
        >
          {/* grid-rows 0fr→1fr: tinggi beranimasi tanpa mengukur apa pun lewat
              JS, jadi rinciannya boleh sepanjang apa pun tanpa angka ajaib. */}
          <div
            className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
              rincianBuka ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="overflow-hidden">
              <div className={`space-y-2 border-b px-4 pb-3 pt-3.5 ${LINE.row}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold text-white/40">
                    {formatRupiah(hargaEfektif)} × {lama}{" "}
                    {DURASI_META[durasi].satuan}
                  </span>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-white/70">
                    {formatRupiah(subtotal)}
                  </span>
                </div>
                {deposit > 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold text-white/40">
                      Deposit
                      <span className="ml-1 text-white/25">· dikembalikan</span>
                    </span>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-white/70">
                      {formatRupiah(deposit)}
                    </span>
                  </div>
                )}
                {voucherDipakai && (
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`truncate text-[11px] font-semibold ${AKSEN.mint.teks}`}
                    >
                      Voucher {voucher.dipilih?.kode}
                    </span>
                    <span
                      className={`shrink-0 text-xs font-bold tabular-nums ${AKSEN.mint.teks}`}
                    >
                      −{formatRupiah(potongan)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setRincianBuka((v) => !v)}
            aria-expanded={rincianBuka}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
          >
            <span className="min-w-0">
              <span className="block text-[11px] font-bold text-white/50">
                Estimasi total
              </span>
              {voucherDipakai && (
                <span
                  className={`mt-0.5 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${AKSEN.mint.chip}`}
                >
                  <Icon icon="solar:tag-price-bold" className="text-[10px]" />
                  Hemat {formatRupiahSingkat(potongan)}
                </span>
              )}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <span className="text-[1.05rem] font-black tabular-nums text-white">
                {formatRupiah(totalEfektif)}
              </span>
              <Icon
                icon="solar:alt-arrow-down-linear"
                className={`text-base text-white/35 transition-transform duration-300 motion-reduce:transition-none ${
                  rincianBuka ? "rotate-180" : ""
                }`}
              />
            </span>
          </button>
        </div>
      )}

      {/* Aksi */}
      <div className="px-5 pt-4">
        {terkunci ? (
          <div
            className={`rounded-2xl border border-rose-400/20 p-4 ${AKSEN.rose.wash}`}
          >
            <p className={`flex items-center gap-2 text-xs font-bold ${AKSEN.rose.teks}`}>
              <Icon icon="solar:lock-keyhole-bold-duotone" className="text-base" />
              {tersewa
                ? "Listing ini sudah tersewa"
                : penuhKarenaTanggal
                  ? unitTunggal
                    ? "Unit sudah terpakai pada tanggal itu"
                    : "Kamar sudah penuh pada tanggal itu"
                  : penuh
                    ? unitTunggal
                      ? "Unit ini sedang tidak tersedia"
                      : "Semua kamar sedang terisi"
                    : "Harga belum tersedia untuk durasi ini"}
            </p>

            {/* Penuh karena TANGGAL masih punya jalan keluar, dan jalan
                keluarnya ada di panel ini — mengarahkannya ke listing lain
                justru membuang penyewa yang sebenarnya masih tertarik. */}
            {penuhKarenaTanggal ? (
              <button
                onClick={() => {
                  hapusTanggal();
                  setFase("mulai");
                  bukaKalender("mulai");
                }}
                className={`mt-2 inline-flex items-center gap-1 text-[11px] font-bold transition-colors hover:text-white ${AKSEN.sky.teks}`}
              >
                Coba tanggal lain
                <Icon icon="solar:calendar-search-linear" />
              </button>
            ) : (
              <Link
                href={`/Sewa?kota=${encodeURIComponent(data.kota)}`}
                className={`mt-2 inline-flex items-center gap-1 text-[11px] font-bold transition-colors hover:text-white ${AKSEN.sky.teks}`}
              >
                Lihat kos lain di {data.kota}
                <Icon icon="solar:arrow-right-linear" />
              </Link>
            )}
          </div>
        ) : pratinjau ? (
          /* Pengelola listing ini: TIDAK ada apa pun di area aksi.

             Panel di atasnya sengaja dibiarkan utuh — justru itu gunanya, dia
             harus melihat persis apa yang dilihat calon penyewa, termasuk
             harga & sisa kamar yang salah. Yang hilang hanya tombolnya, karena
             semuanya ditujukan ke dirinya sendiri: pengajuan sewa akan tercatat
             sebagai lead atas listingnya sendiri — mengotori persis angka yang
             dia pakai menilai listing itu — dan permintaan surveinya berakhir
             di nomor WhatsApp-nya sendiri.

             Keterangan yang dulu ada di sini sudah dihapus atas permintaan:
             alat kerjanya ada di Panel Kontrol Agent di atas halaman, jadi
             kotak penjelasan di sini hanya mengulang yang sudah dia tahu. */
          null
        ) : (
          /* SATU BARIS, dua tombol berdampingan.
             Ditumpuk, keduanya memakan dua tinggi tombol plus jaraknya — dan
             tinggi itulah yang membuat ujung panel jatuh di luar layar laptop.
             Berdampingan, biayanya tinggal satu baris.

             Bahwa keduanya kini sama besar TIDAK membuat keduanya setara:
             urutannya (kiri lebih dulu dibaca), isian mint pekat lawan garis
             tipis, dan bayangan yang hanya dimiliki yang kiri sudah menyatakan
             mana yang dimaksudkan. Warna & bobot memikul hierarki di sini,
             bukan lebar. */
          <div className="grid grid-cols-2 gap-2.5">
            {/* Tombol utama: cahaya menyebar di BAWAH tombol (bukan border
                menyala) supaya ia terlihat mengambang di atas panel — arah
                kedalaman yang sama dengan cangkang panelnya. Sapuan cahaya
                melintas saat hover, sekali, tanpa animasi berulang yang
                menarik perhatian terus-menerus.

                "Ajukan Sewa", bukan "Pesan Sekarang": yang terjadi setelah
                ditekan memang pengajuan yang masih akan dikonfirmasi agent,
                bukan pemesanan yang mengunci kamar. Tombol yang menjanjikan
                lebih dari yang dilakukannya membayar janji itu di layar
                berikutnya. */}
            {/* Tanpa tanggal masuk, tombolnya TIDAK dimatikan — ia berubah
                menjadi langkah yang kurang.

                Tombol nonaktif menyisakan teka-teki ("kenapa tidak bisa
                ditekan?") tepat di titik paling menentukan halaman ini.
                Sebaliknya, mengirimkannya apa adanya menghasilkan pengajuan
                tanpa tanggal — dan hal pertama yang ditanyakan agent saat
                menelepon justru "mau mulai kapan?". Menyebut kekurangannya di
                label lalu membuka kalendernya sendiri menyelesaikan keduanya
                dalam satu ketukan.

                Labelnya "Pilih tanggal" (bukan "Pilih tanggal masuk"): di
                separuh lebar panel, kalimat yang lebih panjang akan pecah dua
                baris dan membuat kedua tombol tidak sama tinggi. */}
            <button
              onClick={() =>
                tanggalMulai ? setPengajuanBuka(true) : bukaKalender("mulai")
              }
              className="group relative overflow-hidden rounded-2xl bg-[#86efac] px-2 py-3.5 text-[13px] font-extrabold text-black shadow-[0_10px_30px_-10px_rgba(134,239,172,0.75)] transition-all duration-200 hover:bg-[#a7f3c4] hover:shadow-[0_14px_38px_-10px_rgba(134,239,172,0.9)] active:scale-[0.985] motion-reduce:transition-none"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/45 to-transparent transition-transform duration-700 group-hover:translate-x-full motion-reduce:hidden"
              />
              <span className="relative inline-flex items-center justify-center gap-1.5">
                <Icon
                  icon={
                    tanggalMulai
                      ? "solar:document-add-bold"
                      : "solar:calendar-mark-bold"
                  }
                  className="shrink-0 text-base"
                />
                {tanggalMulai ? "Ajukan Sewa" : "Pilih tanggal"}
              </span>
            </button>

            {/* SATU jalur cadangan, bukan dua.
                "Chat agent" dihapus: ia menawarkan hal yang sama dengan tombol
                di sebelahnya — bicara dengan agent — hanya lewat pintu yang
                lebih sepi. WhatsApp-nya sendiri tidak hilang: baik pengajuan
                sewa maupun penjadwalan survei berakhir di percakapan WhatsApp
                dengan agent yang sama, lengkap dengan tanggal & harga yang sudah
                dipilih — pesan yang jauh lebih berguna daripada "halo" kosong. */}
            <button
              onClick={() => setSurvei(true)}
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-white/[0.12] px-2 py-3.5 text-[11px] font-bold text-white transition-all duration-200 hover:border-white/30 hover:bg-white/[0.06] active:scale-[0.985] motion-reduce:transition-none"
            >
              <Icon
                icon="solar:calendar-add-bold-duotone"
                className="shrink-0 text-base"
              />
              Jadwalkan survei
            </button>
          </div>
        )}
      </div>

      {/* Penutup: jaminan, bukan hiasan. Ditaruh DI DALAM panel supaya panel
          punya ujung yang jelas, bukan berhenti mendadak di bawah tombol. */}
      <div
        className={`mt-3 flex items-center justify-center gap-2 border-t px-5 py-2.5 ${LINE.row}`}
      >
        <Icon
          icon="solar:shield-check-bold-duotone"
          className={`text-sm ${AKSEN.emerald.ikon}`}
        />
        <span className="text-[10px] font-semibold text-white/30">
          Listing terverifikasi agent resmi Solusindo
        </span>
      </div>
    </>
  );

  /**
   * Kepala panel versi pengelola: SEPASANG TAB, tidak lebih.
   *
   * Dulu di atas tab ini ada blok identitas — ikon gerigi, "PANEL PENGELOLA",
   * dan dasar wewenangnya ("Akses Owner"). Tiga baris itu dibuang, dan
   * alasannya sederhana: keduanya menjawab pertanyaan yang tidak pernah
   * ditanyakan siapa pun. Orang yang membuka listingnya sendiri sudah tahu
   * listing itu miliknya — yang dia cari adalah tombolnya. Tinggi yang dipakai
   * blok itu diambil langsung dari ketersediaan & aksi di bawahnya, yang justru
   * satu-satunya isi panel yang bisa ditindaklanjuti.
   *
   * Tabnya sengaja BUKAN dua panel terpisah yang saling menggantikan diam-diam.
   * Pengelola perlu tahu, setiap saat, sedang melihat halamannya sendiri atau
   * halaman calon penyewa — dan sakelar yang terlihat adalah satu-satunya cara
   * menjawab itu tanpa harus menebak dari isi panel. Sesudah blok identitas
   * hilang, tab "Kelola" itu pula yang menyatakan peran pembacanya.
   *
   * Penanda aktifnya MELUNCUR, sama seperti tab durasi di panel penyewa:
   * perpindahan yang bisa diikuti mata memberi tahu bahwa yang berganti adalah
   * sudut pandang, bukan halamannya.
   *
   * Warnanya netral (putih redup), bukan mint. Mint di halaman ini hanya untuk
   * uang & aksi utama; memakainya di sakelar sudut pandang akan mengaburkan
   * satu-satunya penanda yang dipunyai harga.
   */
  const renderKepalaPengelola = (ringkas = false) => (
    <div
      className={`border-b border-white/[0.06] px-5 pb-3.5 ${
        ringkas ? "pt-1" : "pt-4"
      }`}
    >
      <div
        role="tablist"
        aria-label="Sudut pandang panel"
        className="relative flex rounded-2xl border border-white/[0.06] p-1"
        style={{ background: SURFACE.raised }}
      >
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 rounded-xl bg-white/[0.10] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{
            width: "calc((100% - 0.5rem) / 2)",
            transform: `translateX(${tabPengelola === "kelola" ? 0 : 100}%)`,
          }}
        />
        {(
          [
            ["kelola", "Kelola", "solar:tuning-2-bold-duotone"],
            ["pratinjau", "Pratinjau", "solar:eye-bold-duotone"],
          ] as const
        ).map(([nilai, label, ikon]) => (
          <button
            key={nilai}
            role="tab"
            aria-selected={tabPengelola === nilai}
            onClick={() => setTabPengelola(nilai)}
            className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-bold transition-colors duration-200 ${
              tabPengelola === nilai
                ? "text-white"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            <Icon icon={ikon} className="text-sm" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );

  /**
   * Panel SEBELUM peran pembacanya diketahui.
   *
   * ── KENAPA MENUNGGU, BUKAN MENEBAK ────────────────────────────────────────
   * Halaman ini di-cache untuk semua orang (lihat catatan di useModePengelola),
   * jadi siapa yang membukanya baru ketahuan sesudah hidrasi — beberapa ratus
   * milidetik setelah piksel pertama. Sebelum ini ada, celah itu diisi dengan
   * TEBAKAN "penyewa", dan tebakan itu salah untuk satu-satunya orang yang
   * paling sering membuka halaman ini: pemiliknya sendiri. Yang dia lihat tiap
   * kali me-refresh adalah tombol "Ajukan Sewa" atas kosnya sendiri, yang
   * sekejap kemudian berganti jadi panel kelola.
   *
   * Menebak ke arah sebaliknya lebih buruk lagi: setiap pengunjung biasa akan
   * melihat kilasan tombol "Kelola" atas listing orang lain. Itu bukan lubang
   * keamanan — API memeriksa ulang wewenang pada setiap permintaan, dan tombol
   * yang berkedip tidak memberi siapa pun izin apa pun — tapi ia MENGAJARKAN
   * hal yang salah: bahwa panel itu memang untuknya, dan kalau tidak bisa
   * ditekan berarti sedang rusak.
   *
   * Jadi celahnya diisi bentuk yang tidak menjanjikan apa-apa: siluet setinggi
   * panel sungguhan. Tinggi itu penting — kalau lebih pendek, seluruh halaman
   * tersentak begitu panel yang sebenarnya datang.
   *
   * Harga TIDAK ikut ditampilkan di sini meski sebenarnya sama untuk kedua
   * peran, karena mesin telusur tidak membacanya dari sini: `page.tsx` sudah
   * mengirimkan harga lewat JSON-LD `offers`, yang tidak bergantung hidrasi
   * sama sekali.
   */
  const renderMenunggu = () => (
    <div
      role="status"
      aria-label="Menyiapkan panel"
      className="animate-pulse space-y-3 px-5 pb-5 pt-5 motion-reduce:animate-none"
    >
      <div className="h-8 w-2/3 rounded-xl bg-white/[0.07]" />
      <div className="h-3 w-1/2 rounded-lg bg-white/[0.05]" />
      <div className="h-11 rounded-2xl bg-white/[0.05]" />
      <div className="h-[232px] rounded-2xl bg-white/[0.05]" />
      <div className="h-[58px] rounded-2xl bg-white/[0.04]" />
      <div className="h-[60px] rounded-2xl bg-white/[0.04]" />
      <div className="h-14 rounded-2xl bg-white/[0.07]" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-12 rounded-2xl bg-white/[0.04]" />
        <div className="h-12 rounded-2xl bg-white/[0.04]" />
      </div>
    </div>
  );

  /**
   * Isi panel yang benar untuk pembacanya. Dipakai desktop & bottom sheet lewat
   * satu jalur — alasan yang sama dengan renderPanel: dua salinan markup yang
   * "harusnya sama" selalu berakhir berbeda.
   */
  const renderIsi = (ringkas = false) =>
    menunggu ? (
      renderMenunggu()
    ) : modePengelola ? (
      <>
        {renderKepalaPengelola(ringkas)}
        {tabPengelola === "kelola"
          ? panelPengelola!(() => setSheet(false))
          : renderPanel()}
      </>
    ) : (
      renderPanel()
    );

  return (
    <>
      {/* ══════════ DESKTOP ══════════
          Panel diikat pada tinggi layar: `top-[88px]` (persis di bawah header
          72px, sisanya nafas) dengan tinggi maksimum sisa layarnya.

          Aturan lama di sini adalah "panel TIDAK boleh bisa di-scroll" — dengan
          alasan yang benar: panel yang selalu punya scrollnya sendiri adalah
          jebakan, halaman terasa macet saat kursor kebetulan di atasnya. Yang
          keliru adalah kesimpulannya. Panel ini tumbuh (voucher, estimasi
          total, strip masa sewa), dan tanpa batas tinggi, kelebihannya tidak
          "mengalir bersama halaman" — ia menggantung di luar layar dan TIDAK
          PERNAH bisa dicapai, karena panelnya menempel di tempatnya sementara
          halaman lewat di belakangnya. Tombol "Ajukan Sewa" pun bisa termasuk
          yang hilang itu.

          `max-h` + `overflow-y-auto` justru mempertahankan maksud aturan lama:
          selama panel muat — dan sesudah pemangkasan di atas, itu berlaku untuk
          hampir semua layar — tidak ada yang bisa di-scroll, jadi roda mouse
          tetap menggerakkan halaman seperti biasa. Scroll baru muncul persis
          pada layar yang tanpanya akan menyembunyikan tombolnya. */}
      <aside className="sticky top-[88px] hidden w-[360px] shrink-0 self-start lg:block">
        {/* Cangkang berlapis:
            1. lapisan luar = garis rambut gradien (p-px + background gradien),
               memberi tepi yang menangkap cahaya, bukan border rata 1px;
            2. lapisan dalam = permukaan panel + blur;
            3. cahaya radial lembut di puncak, meredup ke bawah.
            Ini penerapan "liquid glass": kedalaman dari lapisan tembus pandang,
            bukan dari bayangan tebal. */}
        <div
          className="relative rounded-[1.75rem] p-px"
          style={{
            background:
              "linear-gradient(160deg, rgba(255,255,255,0.14), rgba(255,255,255,0.03) 38%, rgba(134,239,172,0.10))",
            boxShadow: KILAU_PANEL,
          }}
        >
          <div
            className="relative overflow-hidden rounded-[calc(1.75rem-1px)] backdrop-blur-xl"
            style={{ background: SURFACE.panel }}
          >
            {/* Cahaya puncak — menandai bahwa harga adalah pusat panel.
                Ditaruh DI LUAR lapisan yang bisa di-scroll: kalau ikut
                bergulir, cahayanya berpindah ke tengah panel dan berhenti
                menandai apa pun. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-40"
              style={{
                background:
                  "radial-gradient(120% 100% at 50% 0%, rgba(134,239,172,0.10), transparent 70%)",
              }}
            />
            {/* Sengaja TANPA `overscroll-contain`: begitu isi panel habis
                di-scroll, gulirannya harus lanjut ke halaman — kalau ditahan,
                panel justru jadi jebakan yang dulu ditakutkan. */}
            <div className="custom-scrollbar relative max-h-[calc(100dvh-104px)] overflow-y-auto">
              {renderIsi()}
            </div>
          </div>
        </div>
      </aside>

      {/* ══════════ MOBILE & TABLET: BAR BAWAH ══════════
          Berlaku sampai lg karena tata letak halaman baru terbelah dua kolom di
          lg (lihat DetailClient). Di tablet, bar ini justru lebih tepat
          daripada panel samping: ibu jari ada di bawah, bukan di kanan atas.

          BENTUKNYA: bilah penuh yang menutup rapat — BUKAN kartu mengambang.

          Kartu mengambang sempat dicoba dan ditolak, dengan alasan yang benar:
          begitu ada sela di kiri, kanan & bawahnya, isi halaman menyembul di
          sela itu. Bilah aksi berdiri di lapisan paling depan; sesuatu di
          lapisan paling depan yang membiarkan tulisan lain merembes di
          pinggirnya terlihat seperti tempelan, bukan seperti bagian dari
          aplikasi. Menutup rapat sampai ketiga tepi layar bukan pilihan gaya,
          itu syarat.

          Tapi dua masalah yang membuat versi lama jelek TIDAK boleh ikut
          kembali, dan keduanya diselesaikan tanpa mengangkat bilahnya:

          1. JURANG DI LAYAR SEDANG. Yang dibatasi lebarnya bukan bilahnya,
             melainkan ISINYA (`max-w-[560px] mx-auto`). Bilah tetap penuh dari
             tepi ke tepi, sementara harga & tombol berkumpul di tengah sebagai
             satu gugus. Persis cara toolbar Safari & bilah "Dapatkan" di App
             Store berperilaku di iPad.

          2. TULISAN YANG TERPOTONG MENDADAK. Di atas bilah ada gradien peredup
             setinggi 40px: isi halaman meredup lebih dulu sebelum mencapai
             tepinya, bukan terpenggal oleh garis lurus. Ini juga yang menjawab
             keluhan "tulisan di bawahnya kelihatan" — permukaannya sendiri
             dinaikkan ke nyaris pekat (0.94), jadi tidak ada lagi kalimat yang
             terbaca menembus bilah. Kacanya masih kaca — blur & saturasinya
             tetap bekerja pada warna yang lewat — hanya tidak lagi tembus
             pandang di tempat yang mengganggu. */}
      <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
        {/* Peredup. `pointer-events-none` supaya pita 40px ini tidak mencuri
            ketukan pada isi halaman yang masih terlihat di belakangnya. */}
        <div
          aria-hidden
          className="pointer-events-none h-10 w-full"
          style={{
            background:
              "linear-gradient(to bottom, rgba(6,9,14,0), rgba(6,9,14,0.55) 55%, rgba(6,9,14,0.9))",
          }}
        />
        <div
          className="relative backdrop-blur-2xl backdrop-saturate-150"
          style={{
            background:
              "linear-gradient(180deg, rgba(10,14,20,0.94), rgba(6,9,13,0.98))",
            boxShadow: "0 -1px 0 rgba(255,255,255,0.04)",
          }}
        >
          {/* Garis rambut gradien — menegaskan tepi atas tanpa border rata yang
              memotong layar jadi dua secara kasar. Mint di tengah, meredup ke
              putih lalu hilang: satu isyarat halus bahwa yang berdiri di bawah
              sini sewarna dengan tombol aksinya. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.10), rgba(134,239,172,0.35), rgba(255,255,255,0.10), transparent)",
            }}
          />
          {/* Isi yang dibatasi & ditengahkan — lihat butir 1 di atas. */}
          <div className="mx-auto max-w-[560px] px-4 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
            {/* ── BILAH PENGELOLA ──
                Diperiksa SEBELUM `terkunci`. Kalau tidak, pengelola yang listingnya
                sudah tersewa akan mendapat tombol "Kos lainnya" — mengusir orang
                yang justru sedang mengurus kosnya sendiri, dan menyembunyikan satu-
                satunya jalan ke kelola ketersediaan tepat ketika ia paling
                dibutuhkan (menandai kamar kembali kosong).

                Dua tombol, dua maksud yang berbeda: mata = "seperti apa tampilannya
                bagi penyewa", Kelola = "saya mau mengubah sesuatu". Keduanya membuka
                sheet yang sama, hanya tab awalnya yang berbeda — jadi salah tekan
                selalu bisa dibetulkan tanpa menutup apa pun. */}
            {menunggu ? (
              /* Peran belum diketahui — lihat renderMenunggu. Bilah ini tetap
                 setinggi bilah sungguhan supaya isi halaman di atasnya tidak
                 bergeser saat yang benar akhirnya datang. */
              <div
                role="status"
                aria-label="Menyiapkan panel"
                className="flex animate-pulse items-center gap-2 py-2 motion-reduce:animate-none"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-28 rounded-lg bg-white/[0.07]" />
                  <div className="h-2.5 w-20 rounded bg-white/[0.05]" />
                </div>
                <div className="h-12 w-12 shrink-0 rounded-2xl bg-white/[0.05]" />
                <div className="h-12 w-24 shrink-0 rounded-2xl bg-white/[0.07]" />
              </div>
            ) : modePengelola ? (
              <div className="flex items-center gap-2 py-2">
                {/* Ikon identitas dilepas di bawah `sm`: pada ponsel 360px, 44px
                    yang dipakainya diambil dari lebar yang dibutuhkan judul —
                    dan judul yang terpotong jauh lebih merugikan daripada bilah
                    tanpa ikon. */}
                <span
                  className={`hidden h-12 w-12 shrink-0 place-items-center rounded-2xl border sm:grid ${AKSEN.amber.kotak}`}
                >
                  <Icon icon="solar:settings-bold-duotone" className="text-xl" />
                </span>

                {/* Bilah ini dulu bertuliskan "Panel Pengelola" + dasar wewenang.
                    Keduanya diganti KEADAAN listing hari ini: pemilik tidak perlu
                    diberi tahu bahwa ini panelnya — tombol di sebelah kanan sudah
                    menyatakannya — tapi ia memang ingin tahu, tanpa membuka apa
                    pun, apakah masih ada kamar yang tersisa. */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-extrabold leading-none tracking-[-0.01em] text-white">
                    {unitTunggal
                      ? penuh
                        ? "Unit terpakai hari ini"
                        : "Unit tersedia hari ini"
                      : sisaKamar != null
                        ? `Sisa ${sisaKamar} kamar`
                        : "Listing Anda"}
                  </p>
                  <p className="mt-2 truncate text-[12px] font-semibold leading-none text-white/45">
                    Ketersediaan &amp; voucher
                  </p>
                </div>

                <button
                  onClick={() => {
                    setTabPengelola("pratinjau");
                    setSheet(true);
                  }}
                  aria-label="Pratinjau tampilan penyewa"
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/[0.14] bg-white/[0.04] text-white transition-all duration-200 hover:bg-white/[0.09] active:scale-95 motion-reduce:transition-none"
                >
                  <Icon icon="solar:eye-bold-duotone" className="text-xl" />
                </button>

                {/* Putih, bukan mint. Mint di halaman ini adalah warna uang & aksi
                    penyewa; memakainya untuk tombol pengelola membuat dua peran
                    terlihat menekan tombol yang sama. */}
                <button
                  onClick={() => {
                    setTabPengelola("kelola");
                    setSheet(true);
                  }}
                  className="h-12 shrink-0 rounded-2xl bg-white px-5 text-[15px] font-extrabold text-black shadow-[0_8px_26px_-12px_rgba(255,255,255,0.8)] transition-transform active:scale-[0.97] motion-reduce:transition-none"
                >
                  Kelola
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 py-2">
                {/* ── ANGKA HARGA ──
                    Ditulis UTUH: "Rp 2.500.000", bukan "Rp 2,5 jt".

                    Singkatan itu dua kali merugikan. Pertama, ia berbohong:
                    `formatRupiahSingkat` membulatkan ke satu desimal, jadi
                    Rp 2.750.000 tampil sebagai "Rp 2,8 jt" — angka yang salah,
                    di tempat paling ditatap orang di seluruh layar. Kedua, ia
                    terbaca murah: "2,5 jt" adalah bahasa iklan baris, sedangkan
                    deret angka penuh dengan titik ribuan terbaca sebagai harga
                    yang sungguh-sungguh. Barang mahal tidak pernah menyingkat
                    harganya.

                    Bisa muat karena satuan waktunya turun ke baris kedua dan
                    panah kecilnya dibuang: satu baris, satu angka, tidak ada
                    yang berebut. `tabular-nums` menjaga lebar tiap digit tetap
                    sama, jadi angkanya tidak "bergoyang" saat durasi diganti.

                    18px & `tracking-[-0.02em]`: pada bobot black, huruf perlu
                    ditarik sedikit lebih rapat — itu yang membedakan angka yang
                    disusun dari angka yang sekadar diperbesar. */}
                <button
                  onClick={() => setSheet(true)}
                  aria-label="Lihat rincian & pilihan sewa"
                  className="-my-1 min-w-0 flex-1 rounded-xl py-1 pr-2 text-left transition-opacity active:opacity-60 motion-reduce:transition-none"
                >
                  {hargaSatuan > 0 ? (
                    <>
                      <span className="block truncate text-[18px] font-black leading-none tracking-[-0.02em] tabular-nums text-white">
                        {formatRupiah(hargaEfektif)}
                      </span>
                      {/* Voucher yang sudah dipakai MENGGANTIKAN baris meta, bukan
                          menambah baris ketiga. Bar bawah setinggi ibu jari tidak
                          punya ruang untuk keduanya, dan potongan harga lebih layak
                          menempati baris itu daripada pengulangan nama tipe yang
                          sudah terbaca di panel.

                          12px & dua tingkat terang, bukan 10px kelabu rata:
                          satuan waktu ("per bulan") ditulis lebih terang karena
                          tanpanya angka di atas tidak punya arti sama sekali —
                          dan ia ditaruh PALING DEPAN supaya dialah yang selamat
                          ketika barisnya kepanjangan lalu terpotong. Tipe kamar
                          & sisa kamar menyusul di tingkat yang lebih redup. */}
                      {voucherDipakai ? (
                        <span
                          className={`mt-2 flex items-center gap-1.5 text-[12px] font-bold leading-none ${AKSEN.mint.teks}`}
                        >
                          <Icon
                            icon="solar:ticket-sale-bold"
                            className="shrink-0 text-sm"
                          />
                          <span className="truncate">
                            Hemat {formatRupiahSingkat(potongan)} · total{" "}
                            {formatRupiahSingkat(totalEfektif)}
                          </span>
                        </span>
                      ) : (
                        <span className="mt-2 block truncate text-[12px] font-semibold leading-none text-white/45">
                          <span className="text-white/70">
                            per {DURASI_META[durasi].satuan}
                          </span>
                          {tipe && ` · ${tipe.nama}`}
                          {sisaKamar != null && sisaKamar > 0 && ` · sisa ${sisaKamar} kamar`}
                          {unitTunggal && !penuh && " · tersedia"}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="block text-[16px] font-black leading-none tracking-[-0.02em] text-white">
                        Hubungi agent
                      </span>
                      <span className="mt-2 block text-[12px] font-semibold leading-none text-white/45">
                        Harga belum ditayangkan
                      </span>
                    </>
                  )}
                </button>

                {terkunci ? (
                  penuhKarenaTanggal ? (
                    <button
                      onClick={() => {
                        hapusTanggal();
                        setFase("mulai");
                        bukaKalender("mulai");
                      }}
                      className="h-12 shrink-0 rounded-2xl border border-white/[0.14] bg-white/[0.04] px-4 text-[13px] font-extrabold text-white transition-all duration-200 active:scale-[0.97] motion-reduce:transition-none"
                    >
                      Ganti tanggal
                    </button>
                  ) : (
                    <Link
                      href={`/Sewa?kota=${encodeURIComponent(data.kota)}`}
                      className="flex h-12 shrink-0 items-center rounded-2xl border border-white/[0.14] bg-white/[0.04] px-4 text-[13px] font-extrabold text-white transition-all duration-200 active:scale-[0.97] motion-reduce:transition-none"
                    >
                      Kos lainnya
                    </Link>
                  )
                ) : pratinjau ? (
                  /* Pengelola tetap bisa membuka panel untuk memeriksa tampilannya,
                     tapi tidak diberi tombol aksi — isi sheet-nya sudah menjelaskan
                     kenapa (renderPanel dipakai bersama). */
                  <button
                    onClick={() => setSheet(true)}
                    className="h-12 shrink-0 rounded-2xl border border-white/[0.14] bg-white/[0.04] px-4 text-[13px] font-extrabold text-white transition-all duration-200 active:scale-[0.97] motion-reduce:transition-none"
                  >
                    Lihat panel
                  </button>
                ) : (
                  <>
                    {/* 44px persis untuk keduanya — batas bawah target sentuh yang
                        nyaman di ponsel; tombol 40px terasa "meleset" saat dipakai
                        sambil berjalan. Tingginya disamakan supaya keduanya terbaca
                        sebagai satu gugus kontrol, bukan dua benda yang kebetulan
                        bersebelahan.

                        Tombol ikon diberi isian tipis (bukan hanya garis): kotak
                        berongga di atas permukaan kaca terlihat seperti lubang. */}
                    <button
                      onClick={() => setSurvei(true)}
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/[0.14] bg-white/[0.04] text-white transition-all duration-200 hover:bg-white/[0.09] active:scale-95 motion-reduce:transition-none"
                      aria-label="Jadwalkan survei"
                    >
                      <Icon icon="solar:calendar-add-bold-duotone" className="text-xl" />
                    </button>
                    {/* Membuka sheet, BUKAN langsung modal pengajuan: di layar kecil
                        tipe kamar & tanggal belum pernah terlihat, jadi mengajukan
                        dari sini berarti mengajukan atas pilihan bawaan yang tidak
                        pernah dilihat siapa pun. Tombol "Ajukan Sewa" yang sebenarnya
                        ada di dalam sheet, sesudah semua pilihan. */}
                    <button
                      onClick={() => setSheet(true)}
                      className="h-12 shrink-0 rounded-2xl bg-[#86efac] px-5 text-[15px] font-extrabold text-black shadow-[0_8px_26px_-10px_rgba(134,239,172,0.9)] transition-transform active:scale-[0.97] motion-reduce:transition-none"
                    >
                      Ajukan
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════ MOBILE: BOTTOM SHEET ══════════ */}
      {mounted &&
        sheet &&
        createPortal(
          <div className="fixed inset-0 z-[9998] flex items-end lg:hidden">
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setSheet(false)}
            />
            <div
              className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[2rem] border-t border-white/10 shadow-2xl"
              style={{ background: SURFACE.panel, ...seretSheet.gaya }}
            >
              {/* Pegangan + kepala = daerah seret. Keduanya digabung dalam satu
                  pembungkus supaya ibu jari punya sasaran setinggi ±72px, bukan
                  garis 3px yang harus dibidik. */}
              <div {...seretSheet.pegangan}>
                <div className="flex cursor-grab justify-center pb-1 pt-3 active:cursor-grabbing">
                  <span className="h-[3px] w-9 rounded-full bg-white/25" />
                </div>
                <div className="flex items-center justify-between px-5 pb-1 pt-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-extrabold text-white">
                      {modePengelola ? "Kelola listing" : "Atur pengajuan"}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSheet(false)}
                    className="shrink-0 rounded-full p-1.5 text-white/55 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Tutup"
                  >
                    <Icon icon="solar:close-circle-bold" className="text-xl" />
                  </button>
                </div>
              </div>
              <div className="custom-scrollbar flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
                {renderIsi(true)}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ══════════ KALENDER MASA SEWA ══════════ */}
      {mounted &&
        kalender &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-4">
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setKalender(false)}
            />
            <div
              className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-white/10 shadow-2xl sm:max-h-[88dvh] sm:max-w-[680px] sm:rounded-[1.75rem]"
              style={{ background: SURFACE.modal, ...seretKalender.gaya }}
            >
              <div {...seretKalender.pegangan}>
                <div className="flex cursor-grab justify-center pt-3 active:cursor-grabbing sm:hidden">
                  <span className="h-[3px] w-9 rounded-full bg-white/25" />
                </div>

                {/* Judul: hasil hitungan lebih dulu, tanggalnya sebagai penjelas —
                    itu yang dicari penyewa saat menimbang lama sewa. */}
                <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
                  <div className="min-w-0">
                    <h3 className="text-base font-extrabold text-white">
                      {ringkasanMasaSewa
                        ? `${lama} ${DURASI_META[durasi].satuan} sewa`
                        : "Pilih masa sewa"}
                    </h3>
                    <p className="truncate text-[11px] text-white/55">
                      {ringkasanMasaSewa
                        ? `${ringkasanMasaSewa}${totalHari ? ` · ${totalHari} hari` : ""}`
                        : "Tanggal masuk, lalu tanggal keluar"}
                    </p>
                  </div>
                  <button
                    onClick={() => setKalender(false)}
                    className="shrink-0 rounded-full p-1.5 text-white/55 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Tutup"
                  >
                    <Icon icon="solar:close-circle-bold" className="text-xl" />
                  </button>
                </div>
              </div>

              {/* Dua kolom tanggal sekaligus penanda field yang sedang diisi */}
              <div className="grid grid-cols-2 gap-2 px-5 pb-4">
                {(
                  [
                    ["mulai", "Mulai sewa", tanggalMulai],
                    ["selesai", "Sampai", tanggalSelesai],
                  ] as const
                ).map(([f, label, nilai]) => (
                  <button
                    key={f}
                    onClick={() => setFase(tanggalMulai ? f : "mulai")}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      fase === f
                        ? "border-sky-400/60 bg-sky-400/[0.08]"
                        : "border-white/[0.08] hover:border-white/20"
                    }`}
                    style={
                      fase === f ? undefined : { background: SURFACE.raised }
                    }
                  >
                    <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-white/30">
                      {label}
                    </span>
                    <span
                      className={`block truncate text-xs font-bold ${
                        nilai ? "text-white" : "text-white/35"
                      }`}
                    >
                      {nilai ? formatTanggalHari(nilai) : "Pilih tanggal"}
                    </span>
                  </button>
                ))}
              </div>

              <div className="custom-scrollbar flex-1 overflow-y-auto px-5 pb-4">
                <Kalender
                  mode="range"
                  jumlahBulan={2}
                  maksBulanKeDepan={bulanKeDepanKalender}
                  mulai={tanggalMulai}
                  selesai={tanggalSelesai}
                  fase={fase}
                  onFase={setFase}
                  onMulai={setTanggalMulai}
                  onSelesai={setTanggalSelesai}
                  snapSelesai={snapTanggalSelesai}
                  ketersediaan={ketersediaanKalender}
                  kapasitas={kapasitas}
                />
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="min-w-0 space-y-0.5">
                  {catatanPembulatan && (
                    <p className="truncate text-[10px] font-semibold text-white/30">
                      {catatanPembulatan}
                    </p>
                  )}
                  {lamaMin > 1 && (
                    <p className="truncate text-[10px] font-semibold text-white/30">
                      Minimal sewa {lamaMin} {DURASI_META[durasi].satuan}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => {
                      hapusTanggal();
                      setFase("mulai");
                    }}
                    disabled={!tanggalMulai}
                    className="rounded-xl px-3 py-2.5 text-xs font-bold text-white/50 underline transition-colors hover:text-white disabled:opacity-30 disabled:no-underline"
                  >
                    Hapus
                  </button>
                  <button
                    onClick={() => setKalender(false)}
                    className="rounded-xl bg-[#86efac] px-5 py-2.5 text-xs font-extrabold text-black transition-all hover:bg-[#6ee7b7] active:scale-[0.97]"
                  >
                    Selesai
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ══════════ VOUCHER ══════════ */}
      <VoucherSheet
        buka={voucherBuka}
        onTutup={() => setVoucherBuka(false)}
        voucher={voucher}
        konteksLabel={`${lama} ${DURASI_META[durasi].satuan} · ${formatRupiah(subtotal)}`}
      />

      {/* ══════════ PENGAJUAN SEWA ══════════ */}
      <PengajuanSewaModal
        buka={pengajuanBuka}
        onTutup={() => setPengajuanBuka(false)}
        idProperty={data.idProperty}
        idAgent={data.agent.idAgent}
        namaAgent={data.agent.nama}
        teleponAgent={data.agent.telepon}
        judulProperti={data.judul}
        slugId={data.slugId}
        lokasi={lokasiRingkas}
        namaTipe={tipe?.nama ?? null}
        idTipe={tipe?.id ?? null}
        tanggalMulai={tanggalMulai}
        tanggalSelesai={tanggalSelesai}
        penghuni={penghuni}
        biaya={{
          hargaSatuan: hargaEfektif,
          lama,
          durasi,
          subtotal,
          deposit,
          potongan,
          total: totalEfektif,
        }}
        voucherKode={voucher.dipilih?.kode ?? null}
        // Dinilai ULANG saat tombol kirim ditekan, bukan dibekukan saat modal
        // dibuka: panel di belakangnya tetap hidup, dan kamar bisa habis di
        // antara dua ketukan itu.
        bisaLanjut={!terkunci}
        voucherSah={!voucher.gugur}
      />

      <SurveiModal
        buka={survei}
        onTutup={() => setSurvei(false)}
        idProperty={data.idProperty}
        idAgent={data.agent.idAgent}
        namaAgent={data.agent.nama}
        teleponAgent={data.agent.telepon}
        judulProperti={data.judul}
        ringkasanPilihan={ringkasanPilihan}
      />
    </>
  );
}

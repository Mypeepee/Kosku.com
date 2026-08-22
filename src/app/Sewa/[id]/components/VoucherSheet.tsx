"use client";

/**
 * Pemilih voucher — bottom sheet di layar kecil, modal terpusat di ≥sm.
 *
 * BENTUK KARTUNYA TIKET, dan itu bukan hiasan. Voucher adalah satu-satunya
 * benda di panel pemesanan yang bukan properti kamar: ia dimiliki, dipakai,
 * dan bisa hangus. Bentuk tiket — rel kiri berwarna, perforasi putus-putus,
 * takik di tepi — menyampaikan semua itu sebelum satu kata pun dibaca, dan
 * membuatnya mustahil tertukar dengan baris "tipe kamar" atau "lama sewa" di
 * atasnya yang sama-sama kotak.
 *
 * TIGA KEADAAN, SATU DAFTAR. Voucher yang syaratnya belum terpenuhi tetap
 * ditampilkan lengkap dengan sebabnya ("Untuk sewa minimal 6 bulan"), bukan
 * disembunyikan. Menyembunyikannya menghilangkan justru informasi yang bisa
 * ditindaklanjuti penyewa — dan menyisakan pertanyaan "kenapa promo yang saya
 * lihat di beranda tidak ada di sini".
 *
 * Pemilihan TIDAK langsung menutup sheet. Voucher dipilih untuk dibandingkan
 * ("10% dari 9,6 juta" versus "Rp 500rb tetap"), dan sheet yang menutup pada
 * ketukan pertama memaksa penyewa membukanya berkali-kali untuk membandingkan
 * dua angka. Yang menutup adalah tombol di bawah, yang sekaligus menampilkan
 * hasil akhirnya.
 */

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";

import { AKSEN, LINE, SURFACE } from "./sewaTheme";
import Tiket from "./voucher/Tiket";
import { useSeretTutup } from "../lib/useSeretTutup";
import { formatRupiah } from "@/lib/kosDetail";
import {
  kuotaMenipis,
  labelNilai,
  metaVoucher,
  ringkasSyarat,
  sisaHariVoucher,
  sisaKuota,
  type Voucher,
} from "@/lib/voucher";
import type { VoucherState } from "../lib/useVoucher";

interface Props {
  buka: boolean;
  onTutup: () => void;
  voucher: VoucherState;
  /** Ringkasan pilihan sewa yang sedang dinilai — mis. "3 bulan · Rp 9.600.000". */
  konteksLabel: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// KARTU TIKET
// ─────────────────────────────────────────────────────────────────────────────

function KartuVoucher({
  v,
  berlaku,
  potongan,
  alasan,
  terpilih,
  disarankan,
  onPilih,
}: {
  v: Voucher;
  berlaku: boolean;
  potongan: number;
  alasan: string | null;
  terpilih: boolean;
  disarankan: boolean;
  onPilih: () => void;
}) {
  const meta = metaVoucher(v);
  const aksen = AKSEN[meta.aksen];
  const sisa = sisaHariVoucher(v);
  const syarat = ringkasSyarat(v);

  /**
   * DUA JENIS KELANGKAAN, SATU BARIS KAKI.
   *
   * Voucher bisa habis karena waktu ("3 hari lagi") atau karena jatah ("sisa 2
   * lagi"), dan keduanya tidak pernah ditampilkan bersamaan — dua penanda
   * mendesak pada satu kartu saling melemahkan, dan penyewa berhenti membaca
   * keduanya.
   *
   * Yang menang adalah KUOTA, karena ia bisa habis kapan saja tanpa peringatan:
   * "sisa 2 lagi" berubah menjadi nol oleh orang lain, sementara "3 hari lagi"
   * berkurang dengan kecepatan yang sudah diketahui semua orang.
   */
  const jatah = sisaKuota(v);
  const jatahMenipis = kuotaMenipis(v);
  const mendesak = jatahMenipis || (sisa != null && sisa <= 7);

  const kelangkaan = jatahMenipis
    ? { ikon: "solar:fire-bold-duotone", teks: `Sisa ${jatah} lagi` }
    : sisa != null
      ? {
          ikon: sisa <= 7 ? "solar:alarm-bold-duotone" : "solar:clock-circle-linear",
          teks: sisa === 0 ? "Terakhir hari ini" : `${sisa} hari lagi`,
        }
      : null;

  return (
    <button
      type="button"
      onClick={onPilih}
      disabled={!berlaku}
      aria-pressed={terpilih}
      className={`group block w-full text-left transition-all duration-200 motion-reduce:transition-none ${
        terpilih
          ? "shadow-[0_8px_28px_-14px_rgba(134,239,172,0.8)]"
          : berlaku
            ? "hover:brightness-110 active:scale-[0.99]"
            : "cursor-not-allowed opacity-45"
      }`}
    >
      <Tiket
        ikon={meta.ikon}
        nilai={labelNilai(v)}
        labelJenis={meta.label}
        aksenRel={aksen}
        terpilih={terpilih}
        padam={!berlaku}
        pojok={
          /* Rekomendasi. Satu per daftar — dua "terbaik" bukan rekomendasi
             lagi, melainkan dekorasi. */
          disarankan && !terpilih ? (
            <span
              className={`absolute right-0 top-0 rounded-bl-lg px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] ${AKSEN.mint.chip}`}
            >
              Hemat terbanyak
            </span>
          ) : null
        }
      >
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-[13px] font-extrabold leading-snug text-white">
            {v.nama}
          </p>
          {/* Penanda terpilih menempati ruang tetap supaya baris judul tidak
              bergeser sepersekian piksel saat dipilih. */}
          <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center">
            {terpilih && (
              <Icon
                icon="solar:check-circle-bold"
                className={`text-base ${AKSEN.mint.ikon}`}
              />
            )}
          </span>
        </div>

        <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-white/60">
          {v.deskripsi}
        </p>

        {syarat.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {syarat.map((s) => (
              <span
                key={s}
                className="rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-bold text-white/65"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Baris kaki: hasil di kanan, sebab/tenggat di kiri. Angka potongan
            selalu di posisi yang sama supaya bisa dipindai turun ke bawah
            tanpa membaca kartunya satu per satu. */}
        <div className="mt-2 flex items-end justify-between gap-2 font-bold">
          {berlaku ? (
            <span
              className={`inline-flex items-center gap-1 text-[10px] ${
                mendesak ? AKSEN.amber.teks : "text-white/55"
              }`}
            >
              {kelangkaan && (
                <>
                  <Icon icon={kelangkaan.ikon} className="text-xs" />
                  {kelangkaan.teks}
                </>
              )}
            </span>
          ) : (
            <span
              className={`inline-flex min-w-0 items-center gap-1 text-[10px] ${AKSEN.rose.teks}`}
            >
              <Icon icon="solar:info-circle-bold" className="shrink-0 text-xs" />
              <span className="truncate">{alasan}</span>
            </span>
          )}

          {berlaku && (
            <span
              className={`shrink-0 text-[13px] font-black tabular-nums ${AKSEN.mint.teks}`}
            >
              −{formatRupiah(potongan)}
            </span>
          )}
        </div>
      </Tiket>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHEET
// ─────────────────────────────────────────────────────────────────────────────

export default function VoucherSheet({ buka, onTutup, voucher, konteksLabel }: Props) {
  const [mounted, setMounted] = useState(false);
  /** Dipisah dari `buka` supaya animasi masuk punya satu frame "sebelum". */
  const [tampil, setTampil] = useState(false);
  const [kode, setKode] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const seret = useSeretTutup(onTutup);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!buka) {
      setTampil(false);
      return;
    }
    setKode("");
    voucher.resetGalatKode();
    const t = requestAnimationFrame(() => setTampil(true));

    const asal = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onTutup();
    };
    document.addEventListener("keydown", onKey);

    // Fokus dipindahkan ke panel supaya pembaca layar & tombol Tab masuk ke
    // dalam sheet, bukan tetap tertinggal di halaman yang tertutup overlay.
    panelRef.current?.focus();

    return () => {
      cancelAnimationFrame(t);
      document.body.style.overflow = asal;
      document.removeEventListener("keydown", onKey);
    };
    // `voucher` sengaja tidak ikut: objeknya baru tiap render, dan
    // menyertakannya membuat efek ini berjalan ulang terus-menerus —
    // fokus akan direbut kembali setiap kali penyewa mengetik kode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buka, onTutup]);

  if (!mounted || !buka) return null;

  const { daftar, memuat, dipilih, pilih, nilai, terbaik, statusKode, galatKode } =
    voucher;

  const hasilTerpilih = dipilih ? nilai(dipilih) : null;
  const potonganTerpilih = hasilTerpilih?.berlaku ? hasilTerpilih.potongan : 0;

  const kirimKode = async () => {
    if (!kode.trim()) return;
    const ok = await voucher.tebusKode(kode);
    if (ok) setKode("");
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Pilih voucher"
    >
      <div
        className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none ${
          tampil ? "opacity-100" : "opacity-0"
        }`}
        onClick={onTutup}
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-white/10 shadow-2xl outline-none transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:max-h-[86dvh] sm:max-w-[460px] sm:rounded-[1.75rem] ${
          tampil ? "translate-y-0" : "translate-y-8 sm:translate-y-4"
        }`}
        style={{ background: SURFACE.modal, ...seret.gaya }}
      >
        {/* ── Kepala ──
            Sekaligus daerah seret: tarik ke bawah untuk menutup, sama seperti
            sheet mana pun yang muncul dari tepi bawah layar. */}
        <div {...seret.pegangan}>
          <div className="flex cursor-grab justify-center pt-3 active:cursor-grabbing sm:hidden">
            <span className="h-[3px] w-9 rounded-full bg-white/25" />
          </div>

          <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-4">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-base font-extrabold text-white">
                <Icon
                  icon="solar:ticket-sale-bold-duotone"
                  className={`text-xl ${AKSEN.mint.ikon}`}
                />
                Voucher & promo
              </h3>
              {/* Konteksnya ditulis, bukan diandaikan: potongan 10% tidak punya
                  arti sampai penyewa tahu 10% dari angka yang mana. */}
              <p className="mt-0.5 truncate text-[11px] font-semibold text-white/55">
                Untuk {konteksLabel}
              </p>
            </div>
            <button
              onClick={onTutup}
              className="shrink-0 rounded-full p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Tutup"
            >
              <Icon icon="solar:close-circle-bold" className="text-xl" />
            </button>
          </div>
        </div>

        {/* ── Daftar ── */}
        <div className="custom-scrollbar flex-1 space-y-2.5 overflow-y-auto px-5 pb-5">
          {memuat ? (
            // Rangka setinggi kartu asli — bukan spinner. Spinner memberi tahu
            // "sedang sibuk"; rangka memberi tahu "akan ada tiga kartu di sini",
            // sehingga tata letak tidak melompat saat isinya datang.
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-[104px] animate-pulse rounded-2xl bg-white/[0.04] motion-reduce:animate-none"
              />
            ))
          ) : daftar.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.07] px-5 py-10 text-center">
              <Icon
                icon="solar:ticket-bold-duotone"
                className="text-4xl text-white/15"
              />
              <p className="mt-3 text-sm font-bold text-white">
                Belum ada voucher tersedia
              </p>
              <p className="mx-auto mt-1 max-w-[30ch] text-[11px] leading-relaxed text-white/55">
                Pemilik kos ini belum memasang promo. Kalau Anda punya kode
                khusus darinya, masukkan di kolom bawah.
              </p>
            </div>
          ) : (
            daftar.map((v) => {
              const h = nilai(v);
              return (
                <KartuVoucher
                  key={v.kode}
                  v={v}
                  berlaku={h.berlaku}
                  potongan={h.potongan}
                  alasan={h.alasan}
                  terpilih={dipilih?.kode === v.kode}
                  disarankan={terbaik?.voucher.kode === v.kode}
                  onPilih={() => pilih(dipilih?.kode === v.kode ? null : v)}
                />
              );
            })
          )}
        </div>

        {/* ── Kode manual ──
            Ditaruh DI BAWAH daftar, bukan di atasnya. Sebagian besar penyewa
            datang tanpa kode; kolom ketik di paling atas menyuruh mereka
            mengingat sesuatu yang tidak mereka punya sebelum sempat melihat
            promo yang tersedia. */}
        <div className={`border-t px-5 pt-3.5 ${LINE.row}`}>
          <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.14em] text-white/50">
            Punya kode lain?
          </label>
          <div className="flex gap-2">
            <input
              value={kode}
              onChange={(e) => {
                setKode(e.target.value.toUpperCase().replace(/\s/g, ""));
                if (galatKode) voucher.resetGalatKode();
              }}
              onKeyDown={(e) => e.key === "Enter" && kirimKode()}
              placeholder="KODE DARI PEMILIK"
              spellCheck={false}
              autoCapitalize="characters"
              className="min-w-0 flex-1 rounded-xl border border-white/[0.08] px-3.5 py-3 text-xs font-bold tracking-wider text-white outline-none transition-colors placeholder:font-semibold placeholder:tracking-normal placeholder:text-white/35 focus:border-[#86efac]/50"
              style={{ background: SURFACE.raised }}
            />
            <button
              onClick={kirimKode}
              disabled={!kode.trim() || statusKode === "memeriksa"}
              className="shrink-0 rounded-xl border border-white/[0.12] px-4 text-xs font-extrabold text-white transition-colors hover:bg-white/[0.06] disabled:opacity-25"
            >
              {statusKode === "memeriksa" ? (
                <Icon icon="solar:refresh-bold" className="animate-spin text-base" />
              ) : (
                "Pakai"
              )}
            </button>
          </div>
          {galatKode && (
            <p
              className={`mt-2 flex items-center gap-1.5 text-[11px] font-semibold ${AKSEN.rose.teks}`}
            >
              <Icon icon="solar:danger-triangle-bold" className="text-sm" />
              {galatKode}
            </p>
          )}
        </div>

        {/* ── Aksi ──
            Tombolnya menyebut HASILNYA, bukan perintahnya. "Pakai — hemat
            Rp 250.000" menutup lingkaran antara yang dipilih dan yang didapat;
            "Simpan" memaksa penyewa kembali ke panel untuk memastikan. */}
        <div className="flex items-center gap-2 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {dipilih && (
            <button
              onClick={() => {
                pilih(null);
                onTutup();
              }}
              className="shrink-0 rounded-xl px-3 py-3.5 text-xs font-bold text-white/70 underline transition-colors hover:text-white"
            >
              Lepas
            </button>
          )}
          <button
            onClick={onTutup}
            className={`flex-1 rounded-2xl py-3.5 text-sm font-extrabold transition-all duration-200 active:scale-[0.98] motion-reduce:transition-none ${
              potonganTerpilih > 0
                ? "bg-[#86efac] text-black shadow-[0_10px_30px_-12px_rgba(134,239,172,0.9)] hover:bg-[#a7f3c4]"
                : "border border-white/[0.12] text-white hover:bg-white/[0.06]"
            }`}
          >
            {potonganTerpilih > 0
              ? `Pakai — hemat ${formatRupiah(potonganTerpilih)}`
              : "Selesai"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

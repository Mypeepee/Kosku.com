"use client";

/**
 * Kartu voucher versi PEMILIK.
 *
 * Bentuknya tiket — cangkang yang SAMA PERSIS (`./Tiket`) dengan yang dilihat
 * penyewa di VoucherSheet. Kesamaan itu disengaja dan bukan penghematan kode:
 * pemilik yang membuka daftarnya harus mengenali bahwa BENDA INILAH yang
 * muncul di panel pemesanan. Kalau panel kelola memakai baris tabel, hubungan
 * antara "yang saya buat" dan "yang dilihat calon penyewa" harus dibayangkan
 * sendiri, dan yang dibayangkan hampir selalu berbeda dari yang terjadi.
 *
 * YANG DITAMBAHKAN DI SISI PEMILIK, dan tidak pernah dilihat penyewa:
 * status sesungguhnya (kedaluwarsa/terjadwal/habis), meteran kuota, dan hasil
 * — berapa kali dipakai serta berapa rupiah yang sudah diberikan. Tiga angka
 * itu yang menjawab satu-satunya pertanyaan yang membuat pemilik kembali ke
 * panel ini: "promo saya jalan atau tidak?"
 */

import React from "react";
import { Icon } from "@iconify/react";

import { AKSEN } from "../sewaTheme";
import Tiket from "./Tiket";
import { MeterKuota } from "./kelolaPrimitif";
import { formatRupiah } from "@/lib/kosDetail";
import {
  kuotaMenipis,
  labelNilai,
  metaVoucher,
  ringkasRupiah,
  ringkasSyarat,
  sisaHariVoucher,
  sisaKuota,
  statusVoucher,
  type Voucher,
} from "@/lib/voucher";

export interface StatistikVoucher {
  dipakai: number;
  totalPotongan: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// KARTU DAFTAR
// ─────────────────────────────────────────────────────────────────────────────

export default function KartuKelola({
  v,
  statistik,
  namaTipe,
  onBuka,
}: {
  v: Voucher;
  statistik?: StatistikVoucher;
  /** id tipe kamar → namanya, untuk pill "khusus tipe". */
  namaTipe?: Record<string, string>;
  onBuka: () => void;
}) {
  const meta = metaVoucher(v);
  const aksenRel = AKSEN[meta.aksen];
  const status = statusVoucher(v);
  const aksenStatus = AKSEN[status.aksen];

  const sisa = sisaHariVoucher(v);
  const sisaJatah = sisaKuota(v);
  const menipis = kuotaMenipis(v);
  const dipakai = statistik?.dipakai ?? v.kuotaTerpakai;
  const totalPotongan = statistik?.totalPotongan ?? 0;

  const syarat = ringkasSyarat(v, namaTipe);

  /** Satu nada warna kuota, dipakai angka DAN meterannya — dua sumber warna
   *  untuk satu keadaan pasti berselisih suatu hari. */
  const nadaKuota =
    sisaJatah === 0
      ? AKSEN.rose.teks
      : menipis
        ? AKSEN.amber.teks
        : AKSEN.mint.teks;

  /**
   * Baris kaki menampilkan HASIL kalau sudah ada, dan TENGGAT kalau belum.
   *
   * Urutannya begitu karena keduanya tidak sama pentingnya sepanjang umur
   * voucher: sebelum ada yang memakai, satu-satunya yang bisa ditindaklanjuti
   * pemilik adalah sisa waktu; sesudah ada yang memakai, angka hasil itulah
   * yang menentukan apakah promonya diperpanjang.
   */
  const adaHasil = dipakai > 0;

  return (
    <button
      type="button"
      onClick={onBuka}
      className={`group block w-full rounded-2xl text-left transition-all duration-200 hover:brightness-110 active:scale-[0.99] motion-reduce:transition-none ${
        status.hidup ? "" : "opacity-60"
      }`}
    >
      <Tiket
        ikon={meta.ikon}
        nilai={labelNilai(v)}
        labelJenis={meta.label}
        aksenRel={aksenRel}
        padam={!status.hidup}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 truncate text-[13px] font-extrabold leading-snug text-white">
            {v.nama}
          </p>
          <Icon
            icon="solar:alt-arrow-right-linear"
            className="mt-px shrink-0 text-base text-white/45 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </div>

        {/* Kode ditulis terang, bukan abu-abu: inilah satu-satunya bagian
            voucher yang diketik ulang orang lain dari tangkapan layar. */}
        <p className="mt-0.5 truncate text-[10.5px] font-bold tracking-[0.08em] text-white/60">
          {v.kode}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${aksenStatus.chip}`}
          >
            <Icon icon={status.ikon} className="text-[11px]" />
            {status.label}
          </span>

          {v.rahasia && (
            <span
              className={`rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${AKSEN.sky.chip}`}
            >
              Rahasia
            </span>
          )}

          {syarat.map((s) => (
            <span
              key={s}
              className="rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-bold text-white/65"
            >
              {s}
            </span>
          ))}
        </div>

        {/* ── Kuota ──
            Meteran hanya muncul kalau kuotanya memang dibatasi. Meteran kosong
            pada voucher tanpa kuota menjanjikan batas yang tidak ada, dan
            pemilik akan mencari-cari angka penyebutnya. */}
        {v.kuotaTotal != null && (
          <div className="mt-2.5">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-[9.5px] font-black uppercase tracking-[0.1em] text-white/50">
                Kuota
              </span>
              <span
                className={`text-[10px] font-black tabular-nums ${
                  sisaJatah === 0 || menipis ? nadaKuota : "text-white/80"
                }`}
              >
                {sisaJatah === 0 ? "Habis" : `Sisa ${sisaJatah}`}
                <span className="font-bold text-white/45">
                  {" "}
                  / {v.kuotaTotal}
                </span>
              </span>
            </div>
            <MeterKuota
              terpakai={v.kuotaTerpakai}
              total={v.kuotaTotal}
              aksen={nadaKuota}
            />
          </div>
        )}

        {/* ── Kaki ── */}
        <div className="mt-2 flex items-end justify-between gap-2">
          {adaHasil ? (
            <span className="inline-flex min-w-0 items-center gap-1 text-[10px] font-bold text-white/65">
              <Icon
                icon="solar:users-group-rounded-bold-duotone"
                className="shrink-0 text-xs"
              />
              <span className="truncate">
                Dipakai {dipakai}×
                {totalPotongan > 0 && ` · ${ringkasRupiah(totalPotongan)} diberikan`}
              </span>
            </span>
          ) : (
            <span
              className={`inline-flex min-w-0 items-center gap-1 text-[10px] font-bold ${
                status.hidup && sisa != null && sisa <= 7
                  ? AKSEN.amber.teks
                  : "text-white/55"
              }`}
            >
              <Icon icon={status.ikon} className="shrink-0 text-xs" />
              <span className="truncate">
                {status.hidup
                  ? sisa == null
                    ? "Belum ada yang memakai"
                    : sisa === 0
                      ? "Hari terakhir"
                      : `${sisa} hari lagi`
                  : status.label}
              </span>
            </span>
          )}

          {totalPotongan > 0 && (
            <span
              className={`shrink-0 text-[11px] font-black tabular-nums ${AKSEN.mint.teks}`}
              title="Total potongan yang sudah diberikan lewat voucher ini"
            >
              {formatRupiah(totalPotongan)}
            </span>
          )}
        </div>
      </Tiket>
    </button>
  );
}

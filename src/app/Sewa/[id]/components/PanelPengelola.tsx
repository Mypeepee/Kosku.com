"use client";

/**
 * Isi panel kolom kanan versi PENGELOLA — pengganti panel pemesanan untuk orang
 * yang memegang listing ini.
 *
 * ── KENAPA DI SINI, BUKAN DI PANEL KONTROL ATAS ────────────────────────────
 * "Kelola Ketersediaan" & "Kelola Voucher" dulu dititipkan ke Panel Kontrol
 * Agent di atas halaman (lewat slot `aksiTambahan`). Dua hal yang salah dari
 * situ:
 *
 * 1. Panel atas menjawab pertanyaan "bagaimana performa aset ini?" — angka
 *    tayang, dilihat, klik WA. Menempelkan dua tombol pengaturan di sebelahnya
 *    membuat satu blok menjawab dua pertanyaan sekaligus, dan tombol utamanya
 *    ("Tandai Tersewa") harus berebut lebar dengan keduanya di layar kecil.
 * 2. Yang diatur kedua tombol itu — tanggal & harga — persis yang ditampilkan
 *    panel kanan kepada calon penyewa. Tempat mengubah sesuatu sebaiknya berada
 *    di tempat yang sama dengan tempat akibatnya terlihat.
 *
 * Jadi kolom kanan sekarang punya satu aturan yang mudah diingat: PENYEWA
 * memilih tanggal di sana, PENGELOLA mengatur tanggal & voucher di sana. Satu
 * ruang, dua peran, tanpa satu pun kontrol yang muncul di dua tempat.
 *
 * Komponen ini hanya ISI panel; cangkang kaca, bilah bawah mobile, dan tab
 * "Kelola / Pratinjau" dipegang BookingSidebar supaya kedua peran memakai
 * kerangka yang sama persis.
 *
 * Sama seperti pendahulunya, komponen ini TIDAK memeriksa izin sama sekali: ia
 * hanya dirender kalau `useModePengelola` sudah memutuskan pembacanya berwenang,
 * dan penentu sesungguhnya tetap ada di API.
 */

import React, { useEffect, useState } from "react";
import { Icon } from "@iconify/react";

import { AKSEN, SURFACE, aksenSisaKamar, type Aksen } from "./sewaTheme";
import { kuotaMenipis, statusVoucher, type Voucher } from "@/lib/voucher";
import type { ModelInventaris } from "../types";

interface Props {
  idProperty: string;
  /** Hanya kategori bermode BOOKING yang punya kalender ketersediaan. */
  berkalender: boolean;
  modelInventaris: ModelInventaris;
  /** Sisa & total kamar HARI INI. null untuk unit tunggal. */
  sisaKamar: number | null;
  totalKamar: number | null;
  /** Unit tunggal: tersedia hari ini atau tidak. */
  unitTersedia: boolean;
  /** Dinaikkan tiap kali voucher berubah — memaksa ringkasan dimuat ulang. */
  voucherVersi: number;
  onKelolaKetersediaan: () => void;
  onKelolaVoucher: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// BARIS AKSI
// ─────────────────────────────────────────────────────────────────────────────

function BarisKelola({
  ikon,
  aksen,
  judul,
  ringkas,
  nada,
  onKlik,
}: {
  ikon: string;
  aksen: Aksen;
  judul: string;
  /** Satu kalimat keadaan — bukan dashboard mini. */
  ringkas: string;
  /** Kelas warna untuk `ringkas`; dipakai menandai keadaan yang perlu tindakan. */
  nada: string;
  onKlik: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onKlik}
      className="group flex w-full items-center gap-3 p-4 text-left transition-colors duration-200 hover:bg-white/[0.03] active:bg-white/[0.05] motion-reduce:transition-none"
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${aksen.kotak}`}
      >
        <Icon icon={ikon} className="text-lg" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-extrabold leading-tight text-white">
          {judul}
        </span>
        <span
          className={`mt-0.5 block truncate text-[11px] font-semibold leading-tight ${nada}`}
        >
          {ringkas}
        </span>
      </span>

      <Icon
        icon="solar:alt-arrow-right-linear"
        className="shrink-0 text-lg text-white/45 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-white motion-reduce:transition-none"
      />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KOMPONEN UTAMA
// ─────────────────────────────────────────────────────────────────────────────

export default function PanelPengelola({
  idProperty,
  berkalender,
  modelInventaris,
  sisaKamar,
  totalKamar,
  unitTersedia,
  voucherVersi,
  onKelolaKetersediaan,
  onKelolaVoucher,
}: Props) {
  /**
   * Ringkasan voucher diambil sendiri lewat satu permintaan kecil. Permintaan
   * itu hanya terjadi untuk pengelola — pengunjung biasa tidak pernah merender
   * komponen ini — dan tanpa angkanya, barisnya kehilangan gunanya yang paling
   * besar: memberi tahu bahwa promo yang dipasang bulan lalu ternyata sudah
   * kedaluwarsa tanpa pernah dibuka lagi.
   */
  const [daftar, setDaftar] = useState<Voucher[] | null>(null);

  useEffect(() => {
    let batal = false;
    fetch(`/api/listings/${idProperty}/voucher?kelola=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!batal) setDaftar(Array.isArray(j?.vouchers) ? j.vouchers : []);
      })
      .catch(() => {
        // Diam. Ringkasan yang gagal dimuat tidak boleh mengubah baris ini jadi
        // pesan galat — pekerjaannya (membuka panel) tetap bisa dilakukan.
        if (!batal) setDaftar([]);
      });
    return () => {
      batal = true;
    };
  }, [idProperty, voucherVersi]);

  const unitTunggal = modelInventaris === "UNIT";

  // ── Ketersediaan ──
  const aksenKamar: Aksen = unitTunggal
    ? unitTersedia
      ? AKSEN.emerald
      : AKSEN.rose
    : aksenSisaKamar(sisaKamar);

  const kapasitasTerbaca =
    !unitTunggal && sisaKamar != null && totalKamar != null && totalKamar > 0;

  const persenTersedia = kapasitasTerbaca
    ? Math.max(0, Math.min(100, Math.round((sisaKamar! / totalKamar!) * 100)))
    : unitTunggal
      ? unitTersedia
        ? 100
        : 0
      : null;

  const ringkasKetersediaan = unitTunggal
    ? unitTersedia
      ? "Unit tersedia hari ini"
      : "Unit terpakai hari ini"
    : kapasitasTerbaca
      ? sisaKamar! > 0
        ? `Sisa ${sisaKamar} dari ${totalKamar} kamar`
        : "Semua kamar terisi"
      : sisaKamar != null
        ? `Sisa ${sisaKamar} kamar`
        : "Kapasitas belum diisi";

  const ketersediaanPerluPerhatian = unitTunggal
    ? !unitTersedia
    : sisaKamar != null && sisaKamar <= 0;

  // ── Voucher ──
  // Status dibaca dari `statusVoucher`, bukan dari kolom `aktif`. Kolom itu
  // hanya berarti "pemiliknya belum mematikannya"; voucher yang kedaluwarsa
  // atau kuotanya tandas tetap `aktif = true` di DB, dan menghitungnya sebagai
  // hidup di sini akan menampilkan "3 voucher aktif" pada listing yang tidak
  // menawarkan satu pun promo — kebohongan yang justru menghentikan pemilik
  // membuka panelnya.
  const sekarang = new Date();
  const hidup = daftar?.filter((v) => statusVoucher(v, sekarang).hidup) ?? [];
  const terjadwal =
    daftar?.filter((v) => statusVoucher(v, sekarang).status === "TERJADWAL") ?? [];

  // Voucher yang mati diam-diam adalah keadaan yang butuh tindakan, jadi itu
  // yang diangkat; sisanya cukup hitungan.
  const adaYangPadam =
    (daftar?.length ?? 0) > 0 && hidup.length === 0 && terjadwal.length === 0;
  // Kuota yang tinggal sedikit sama mendesaknya: promo bisa berhenti sendiri
  // besok pagi tanpa satu pun pemberitahuan.
  const adaYangMenipis = hidup.some(kuotaMenipis);

  const ringkasVoucher =
    daftar === null
      ? "Memuat…"
      : daftar.length === 0
        ? "Belum ada promo terpasang"
        : adaYangPadam
          ? "Tidak ada yang berjalan"
          : hidup.length === 0
            ? `${terjadwal.length} voucher terjadwal`
            : adaYangMenipis
              ? `${hidup.length} berjalan · kuota menipis`
              : `${hidup.length} voucher berjalan${
                  terjadwal.length > 0 ? ` · ${terjadwal.length} terjadwal` : ""
                }`;

  return (
    <div className="px-5 pb-5 pt-4">
      {/* ── KEADAAN HARI INI ──
          Satu angka besar, satu meteran. Ini pengganti "sisa 9/19 kamar" yang
          dulu tersembunyi sebagai teks kecil di dalam tombol: keadaan kamar
          adalah hal pertama yang dicari pengelola saat membuka listingnya, jadi
          ia berhak atas ukuran yang sama dengan harga di panel penyewa.

          Blok ini hanya untuk kategori berkalender — rumah & ruko sewa tidak
          punya inventaris harian, dan meteran kosong di sana hanya menjanjikan
          kendali yang tidak ada. */}
      {berkalender && (
        <div
          className="mb-3 rounded-2xl border border-white/[0.08] p-4"
          style={{ background: SURFACE.raised }}
        >
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9.5px] font-black uppercase tracking-[0.14em] text-white/55">
                Ketersediaan hari ini
              </p>
              <p className="mt-1.5 flex items-baseline gap-1.5 text-[1.75rem] font-black leading-none tracking-[-0.02em] tabular-nums text-white">
                {unitTunggal ? (
                  <span className="text-[1.35rem]">
                    {unitTersedia ? "Tersedia" : "Terpakai"}
                  </span>
                ) : (
                  <>
                    {sisaKamar ?? "—"}
                    <span className="text-xs font-bold tracking-normal text-white/55">
                      {totalKamar != null ? `/ ${totalKamar} kamar` : "kamar"}
                    </span>
                  </>
                )}
              </p>
            </div>

            <span
              className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${aksenKamar.chip}`}
            >
              {ketersediaanPerluPerhatian ? "Penuh" : "Terbuka"}
            </span>
          </div>

          {/* Meteran memakai `bg-current` supaya warnanya mengikuti aksen yang
              sudah dihitung di induknya — satu sumber warna, bukan dua yang
              harus dijaga tetap sepakat. */}
          {persenTersedia != null && (
            <div className={`mt-3.5 ${aksenKamar.teks}`}>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full bg-current transition-[width] duration-500 ease-out motion-reduce:transition-none"
                  style={{ width: `${persenTersedia}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── AKSI ──
          Satu objek dengan pemisah rambut, bukan dua kartu melayang — pola yang
          sama dengan blok kontrol di panel penyewa, supaya kedua peran merasa
          sedang memakai halaman yang sama. */}
      <div
        className="overflow-hidden rounded-2xl border border-white/[0.08] divide-y divide-white/[0.06]"
        style={{ background: SURFACE.raised }}
      >
        {berkalender && (
          <BarisKelola
            ikon="solar:calendar-mark-bold-duotone"
            aksen={AKSEN.sky}
            judul="Kelola Ketersediaan"
            ringkas={ringkasKetersediaan}
            nada={
              ketersediaanPerluPerhatian ? AKSEN.rose.teks : "text-white/65"
            }
            onKlik={onKelolaKetersediaan}
          />
        )}

        {/* Voucher tidak perlu disaring lagi di sini: panel ini hanya hidup di
            dalam BookingSidebar, dan BookingSidebar hanya dirender untuk
            kategori bermode BOOKING — yaitu tepat kategori yang punya langkah
            pemesanan tempat voucher ditebus. Penyaringnya ada di DetailClient
            dan ditegakkan ulang di /api/listings/[id]/voucher. */}
        <BarisKelola
          ikon="solar:ticket-sale-bold-duotone"
          aksen={AKSEN.mint}
          judul="Kelola Voucher"
          ringkas={ringkasVoucher}
          nada={adaYangPadam || adaYangMenipis ? AKSEN.amber.teks : "text-white/65"}
          onKlik={onKelolaVoucher}
        />
      </div>

    </div>
  );
}

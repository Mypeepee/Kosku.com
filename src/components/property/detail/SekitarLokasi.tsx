"use client";

/**
 * Bagian "Lokasi & sekitar" untuk halaman detail /Jual & /Lelang.
 *
 * MASALAH YANG DIPERBAIKI. Kedua halaman itu punya peta, tapi tidak punya
 * jawaban atas pertanyaan yang justru paling sering menentukan pembelian:
 * "dekat apa?". Pin di peta memang menyimpan jawabannya, tapi harus ditemukan
 * satu per satu dengan menggeser dan mengklik — pekerjaan yang tidak akan
 * dilakukan orang yang sedang membandingkan lima listing. Halaman /Sewa sudah
 * menjawabnya lewat patokan yang diisi agent; di sini jawabannya datang dari
 * dua sumber sekaligus:
 *
 *   1. PATOKAN AGENT (kolom `akses_terdekat`) — paling dipercaya karena
 *      diverifikasi orang, dan satu-satunya yang tahu "5 menit ke pintu tol".
 *   2. FASILITAS SEKITAR OTOMATIS (OpenStreetMap) — selalu ada, termasuk untuk
 *      ribuan aset lelang hasil scrape yang tidak akan pernah diisi patokannya
 *      oleh siapa pun.
 *
 * Sumber kedua TIDAK dicari dari browser. Server memindainya sekali lalu
 * menyimpannya (src/lib/nearbyPlaces.server.ts); aset yang sudah pernah
 * dipindai datang lengkap bersama HTML halaman lewat prop `awal`, sehingga
 * bagian ini tampil seketika tanpa spinner dan tanpa satu pun permintaan
 * keluar. Peta di atas dan daftar di bawah memakai objek data yang sama persis,
 * jadi mustahil keduanya berselisih isi.
 *
 * Warna tiap kategori sengaja sama persis dengan warna pin & chip filter di
 * peta — pembaca yang melihat "Kuliner" oranye di daftar langsung tahu pin
 * oranye mana yang dimaksud, tanpa legenda.
 */

import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@iconify/react";

import { AKSEN, SURFACE } from "@/lib/detailTheme";
import { type AksesTerdekat } from "@/lib/kosDetail";

import FasilitasSekitar from "./FasilitasSekitar";
import PatokanAgent from "./PatokanAgent";
import { Bagian, Chip, Judul } from "./parts";
import { useSekitar, type SekitarAwal } from "./useSekitar";

const PetaLokasi = dynamic(() => import("@/components/Maps/GoogleMapView"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-2 text-sky-300/50"
      style={{ background: SURFACE.raised }}
    >
      <Icon icon="solar:map-point-bold-duotone" className="animate-bounce text-3xl" />
      <span className="text-xs font-bold">Memuat peta…</span>
    </div>
  ),
});

interface SekitarLokasiProps {
  /** Wajib untuk pemindaian & cache — tanpa ini bagian sekitar tidak aktif. */
  idProperty?: string | number | null;
  /**
   * Hasil pemindaian yang SUDAH tersimpan, dibaca server saat render halaman
   * (lihat bacaSekitarTersimpan). Bila ada, bagian ini tidak menyentuh
   * jaringan sama sekali.
   */
  awal?: SekitarAwal | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Alamat satu baris — dipakai peta sebagai cadangan geocoding. */
  alamatLengkap?: string | null;
  /** Wilayah administratif untuk chip: kelurahan, kecamatan, kota, provinsi. */
  wilayah?: (string | null | undefined)[];
  areaLokasi?: string | null;
  /** Patokan yang diisi agent (kolom `akses_terdekat`). */
  aksesTerdekat?: AksesTerdekat[];
  /** Bagian terakhir di kolomnya → tanpa garis bawah. */
  akhir?: boolean;
}

export default function SekitarLokasi({
  idProperty,
  awal = null,
  latitude,
  longitude,
  alamatLengkap,
  wilayah = [],
  areaLokasi,
  aksesTerdekat = [],
  akhir = false,
}: SekitarLokasiProps) {
  const sekitar = useSekitar(idProperty, awal);

  const daftarWilayah = wilayah.filter(Boolean) as string[];
  const alamatBaris =
    alamatLengkap?.trim() || daftarWilayah.join(", ") || "Lokasi belum dilengkapi";

  const adaKoordinat =
    latitude != null &&
    longitude != null &&
    !Number.isNaN(Number(latitude)) &&
    !Number.isNaN(Number(longitude));

  /**
   * Titik yang dipakai peta: koordinat listing kalau ada, kalau tidak hasil
   * geocode dari server.
   *
   * Yang kedua penting untuk biaya: tanpa itu, komponen peta akan memanggil
   * Google Geocoder dari browser SETIAP kunjungan pada aset yang koordinatnya
   * kosong — padahal server sudah pernah menemukan titiknya dan menyimpannya.
   */
  const titik = adaKoordinat
    ? { lat: Number(latitude), lng: Number(longitude) }
    : sekitar.titik
      ? { lat: sekitar.titik.lat, lng: sekitar.titik.lng }
      : null;

  const titikPerkiraan = !adaKoordinat && sekitar.titik?.sumber === "GEOCODE";

  // Tanpa koordinat, peta masih bisa dipakai selama ada teks yang bisa
  // di-geocode — untuk listing SECONDARY yang alamat persisnya sengaja
  // disembunyikan, teks itu adalah nama kecamatan/kota.
  const adaPeta = !!titik || !!alamatLengkap?.trim() || daftarWilayah.length > 0;

  const tautanRute = titik
    ? `https://www.google.com/maps/search/?api=1&query=${titik.lat},${titik.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        alamatLengkap || daftarWilayah.join(", "),
      )}`;

  return (
    <Bagian akhir={akhir}>
      <Judul
        ikon="solar:map-point-bold-duotone"
        aksen={AKSEN.sky}
        keterangan={
          <>
            <p>{alamatBaris}</p>
            {(daftarWilayah.length > 0 || areaLokasi) && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {areaLokasi && (
                  <Chip ikon="solar:streets-map-point-bold-duotone" aksen={AKSEN.sky}>
                    {areaLokasi}
                  </Chip>
                )}
                {daftarWilayah.map((w) => (
                  <Chip key={w}>{w}</Chip>
                ))}
              </div>
            )}
          </>
        }
        aksi={
          adaPeta ? (
            <a
              href={tautanRute}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-1 text-xs font-bold transition-colors hover:text-white ${AKSEN.sky.teks}`}
            >
              Lihat rute <Icon icon="solar:arrow-right-up-linear" />
            </a>
          ) : null
        }
      >
        Lokasi &amp; sekitar
      </Judul>

      {adaPeta ? (
        <div
          className="relative z-0 mb-6 h-[420px] w-full overflow-hidden rounded-[1.5rem] border border-white/10 md:h-[500px]"
          style={{ background: SURFACE.raised }}
        >
          <PetaLokasi
            lat={titik?.lat}
            lng={titik?.lng}
            address={alamatLengkap || daftarWilayah.join(", ")}
            tempat={sekitar.tempat}
            radius={sekitar.radius}
            memuat={sekitar.memuat}
            gagal={sekitar.gagal}
            onUlang={sekitar.ulangi}
          />
        </div>
      ) : (
        <div
          className="mb-6 flex flex-col items-center justify-center rounded-[1.5rem] border border-white/10 px-6 py-12 text-center"
          style={{ background: SURFACE.card }}
        >
          <Icon
            icon="solar:map-point-remove-bold-duotone"
            className="mb-3 text-5xl text-white/15"
          />
          <p className="text-sm font-bold text-white">Titik lokasi belum tersedia</p>
          <p className="mt-1 max-w-sm text-xs text-white/40">
            Koordinat dan alamat belum diinput. Hubungi agent untuk informasi lokasi.
          </p>
        </div>
      )}

      {/* ── Patokan dari agent ── */}
      <PatokanAgent akses={aksesTerdekat} className="mb-7" />

      {/* ── Fasilitas sekitar otomatis ── */}
      {adaPeta && (
        <FasilitasSekitar sekitar={sekitar} titikPerkiraan={titikPerkiraan} />
      )}
    </Bagian>
  );
}

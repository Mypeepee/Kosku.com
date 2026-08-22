"use client";

/**
 * Kolom kiri halaman detail sewa — semua yang perlu dibaca sebelum menghubungi
 * agent, disusun mengikuti urutan pertanyaan calon penghuni kos:
 *
 *   1. "Berapa kamar yang masih ada, kos apa ini?"  → strip ringkasan
 *   2. "Ceritakan tempatnya"                        → deskripsi
 *   3. "Kamar yang mana yang saya ambil?"           → tipe kamar (inti halaman)
 *   4. "Dapat apa saja?"                            → fasilitas
 *   5. "Syaratnya apa, boleh apa tidak?"            → ketentuan & peraturan
 *   6. "Dekat apa?"                                 → lokasi & patokan
 *   7. "Siapa yang saya hubungi?"                   → agent
 *
 * Urutan itu bukan selera: bagian yang tidak terjawab akan ditanyakan lewat
 * WhatsApp satu per satu, dan itu beban yang berpindah ke agent.
 */

import React, { useEffect, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Icon } from "@iconify/react";
import { createPortal } from "react-dom";

import TipeKamarSection from "./TipeKamarSection";
import FasilitasSekitar from "@/components/property/detail/FasilitasSekitar";
import PatokanAgent from "@/components/property/detail/PatokanAgent";
import { useSekitar } from "@/components/property/detail/useSekitar";
import {
  AKSEN,
  AKSEN_GENDER,
  AKSEN_SECTION,
  KILAU_KARTU,
  LINE,
  SURFACE,
  aksenSisaKamar,
  type Aksen,
} from "./sewaTheme";
import type { BookingState } from "../lib/useBooking";
import type { SewaDetailData } from "../types";
import {
  DURASI_META,
  GENDER_KOS,
  KAMAR_MANDI,
  formatRupiah,
  type FasilitasItem,
} from "@/lib/kosDetail";

/**
 * Peta yang sama persis dengan halaman Jual & Lelang. Dulu halaman ini memakai
 * KosMap (Leaflet) — tampilannya berbeda sendiri padahal isinya pertanyaan yang
 * sama ("dekat apa?"), dan pengunjung yang membandingkan listing sewa dengan
 * listing jual harus membaca dua bahasa peta.
 *
 * Pin fasilitas sekitarnya kini datang dari mesin yang dipindai & disimpan di
 * server (lihat useSekitar + src/lib/nearbyPlaces.server.ts), bukan dari
 * pencarian ulang di browser tiap kali halaman dibuka.
 */
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

// ─────────────────────────────────────────────────────────────────────────────
// POTONGAN KECIL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Judul section. Ikonnya diberi warna per section (lihat AKSEN_SECTION): saat
 * di-scroll, deretan kotak ikon jadi penanda posisi — "aku sudah lewat yang
 * kuning (ketentuan)" — yang tidak mungkin terjadi kalau semuanya hijau.
 */
function Judul({
  children,
  ikon,
  aksen = AKSEN.netral,
}: {
  children: React.ReactNode;
  ikon?: string;
  aksen?: Aksen;
}) {
  return (
    <h3 className="mb-4 flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-white">
      {ikon && (
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${aksen.kotak}`}
        >
          <Icon icon={ikon} className="text-base" />
        </span>
      )}
      {children}
    </h3>
  );
}

function StatCell({
  ikon,
  label,
  nilai,
  aksen,
}: {
  ikon: string;
  label: string;
  nilai: string;
  /** Angka yang menentukan keputusan diberi warna; sisanya tetap netral. */
  aksen?: Aksen;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center rounded-xl px-1 py-2.5 text-center transition-colors hover:bg-white/[0.03] sm:px-2 sm:py-3">
      <Icon
        icon={ikon}
        className={`mb-1 text-lg sm:mb-1.5 sm:text-xl ${aksen ? aksen.ikon : "text-white/40"}`}
      />
      <p className="text-[8px] font-black uppercase leading-tight tracking-[0.06em] text-white/30 sm:text-[9px] sm:tracking-[0.12em]">
        {label}
      </p>
      <p className="mt-0.5 w-full break-words text-[11px] font-extrabold leading-tight text-white sm:text-[13px]">
        {nilai}
      </p>
    </div>
  );
}

function FasilitasGrid({ items, aksen }: { items: FasilitasItem[]; aksen: Aksen }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
      {items.map((f) => (
        <div key={f.label} className="flex items-center gap-3">
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${aksen.kotak}`}
          >
            <Icon icon={f.icon} className="text-base" />
          </span>
          <span className="text-sm text-white/80">{f.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Modal daftar fasilitas lengkap (dipakai saat item terlalu banyak). */
function FasilitasModal({
  buka,
  onTutup,
  grup,
}: {
  buka: boolean;
  onTutup: () => void;
  grup: { judul: string; items: FasilitasItem[] }[];
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!buka) return;
    const asal = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onTutup();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = asal;
    };
  }, [buka, onTutup]);

  if (!mounted || !buka) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center md:items-center">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onTutup}
      />
      <div
        className="relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 shadow-2xl md:max-w-2xl md:rounded-3xl"
        style={{ background: SURFACE.modal }}
      >
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
          <h3 className="text-lg font-extrabold text-white">Fasilitas lengkap</h3>
          <button
            onClick={onTutup}
            className="rounded-full p-2 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Tutup"
          >
            <Icon icon="solar:close-circle-bold" className="text-2xl" />
          </button>
        </div>
        <div className="custom-scrollbar flex-1 space-y-7 overflow-y-auto px-6 py-6">
          {grup
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <div key={g.judul}>
                <h4 className="mb-4 text-[11px] font-black uppercase tracking-[0.14em] text-white/35">
                  {g.judul}
                </h4>
                <div className="space-y-3.5">
                  {g.items.map((f) => (
                    <div
                      key={f.label}
                      className="flex items-center gap-4 border-b border-white/[0.05] pb-3.5 last:border-0"
                    >
                      <Icon
                        icon={f.icon}
                        className={`text-xl ${AKSEN.cyan.ikon}`}
                      />
                      <span className="text-sm text-white/80">{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Satu baris ketentuan: label kiri, nilai kanan. */
/** Suffix periode biaya tambahan — nominal tanpa periode tidak bisa dibaca. */
const PERIODE_BIAYA_SUFFIX: Record<"SEKALI" | "BULANAN" | "TAHUNAN", string> = {
  BULANAN: "/bulan",
  TAHUNAN: "/tahun",
  SEKALI: "sekali",
};

function BarisKetentuan({
  ikon,
  label,
  nilai,
  catatan,
  aksen,
}: {
  ikon: string;
  label: string;
  nilai: string;
  catatan?: string;
  /** Diberi warna hanya bila jawabannya berkonsekuensi biaya. */
  aksen?: Aksen;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] py-3 last:border-0">
      <div className="flex items-start gap-3">
        <Icon
          icon={ikon}
          className={`mt-0.5 shrink-0 text-lg ${aksen ? aksen.ikon : "text-white/35"}`}
        />
        <div>
          <p className="text-sm font-semibold text-white/75">{label}</p>
          {catatan && (
            <p className="mt-0.5 text-[11px] text-white/35">{catatan}</p>
          )}
        </div>
      </div>
      <span className="shrink-0 text-sm font-bold text-white">{nilai}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KOMPONEN UTAMA
// ─────────────────────────────────────────────────────────────────────────────

export default function DetailInfo({
  data,
  booking,
}: {
  data: SewaDetailData;
  booking: BookingState;
}) {
  const [deskripsiPenuh, setDeskripsiPenuh] = useState(false);
  const [modalFasilitas, setModalFasilitas] = useState(false);

  // Fasilitas sekitar — dipakai bersama oleh pin di peta DAN daftar di bawahnya,
  // jadi keduanya mustahil berselisih isi. Pemindaiannya dilakukan & disimpan di
  // server; `data.sekitar` adalah hasil yang sudah tersimpan dan ikut dirender
  // bersama halaman, sehingga kos yang pernah dibuka orang lain tampil seketika
  // tanpa satu pun permintaan keluar.
  const sekitar = useSekitar(data.idProperty, data.sekitar ?? null);

  const multiTipe = data.tipeKamar.length > 0;
  const gender = data.kosGender ? GENDER_KOS[data.kosGender] : null;
  const aksenGender = data.kosGender
    ? AKSEN_GENDER[data.kosGender] ?? AKSEN.netral
    : AKSEN.netral;
  const km = data.kamarMandiTipe ? KAMAR_MANDI[data.kamarMandiTipe] : null;

  // Saat kos memakai tipe kamar, fasilitas kamar sudah tampil di tiap kartu
  // tipe (lengkap dengan yang khas tipe itu). Menampilkannya lagi di sini
  // berarti daftar yang sama muncul dua kali dengan arti yang berbeda —
  // membingungkan, jadi yang tersisa hanya fasilitas gedung.
  const grupFasilitas = [
    ...(multiTipe
      ? []
      : [{ judul: "Fasilitas kamar", items: data.fasilitasKamar }]),
    { judul: "Fasilitas bersama", items: data.fasilitasBersama },
  ].filter((g) => g.items.length > 0);

  const totalFasilitas = grupFasilitas.reduce((s, g) => s + g.items.length, 0);
  const fasilitasPratinjau = grupFasilitas
    .flatMap((g) => g.items)
    .slice(0, 8);

  const alamatLengkap =
    [data.alamat, data.kelurahan, data.kecamatan, data.kota, data.provinsi]
      .filter(Boolean)
      .join(", ") || data.kota;

  /**
   * Titik yang dipakai peta: koordinat listing kalau ada, kalau tidak hasil
   * geocode yang sudah ditemukan & disimpan server saat memindai sekitar.
   *
   * Yang kedua bukan sekadar kelengkapan: tanpa itu, kos yang koordinatnya
   * belum diisi agent — dan itu banyak — sama sekali tidak menampilkan peta
   * maupun daftar sekitar, padahal alamatnya cukup untuk menemukan titiknya.
   */
  const adaKoordinat = data.latitude != null && data.longitude != null;
  const titik = adaKoordinat
    ? { lat: data.latitude as number, lng: data.longitude as number }
    : sekitar.titik
      ? { lat: sekitar.titik.lat, lng: sekitar.titik.lng }
      : null;
  const titikPerkiraan = !adaKoordinat && sekitar.titik?.sumber === "GEOCODE";
  // Peta tetap berguna tanpa koordinat selama ada alamat yang bisa di-geocode.
  const adaPeta = !!titik || !!alamatLengkap.trim();
  const tautanRute = titik
    ? `https://www.google.com/maps/search/?api=1&query=${titik.lat},${titik.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(alamatLengkap)}`;

  // Identitas unit apartemen dirakit jadi satu baris ("Lantai 12 · Unit 12A")
  // supaya terbaca sebagai satu alamat, bukan dua fakta lepas.
  //
  // Luas SENGAJA tidak ikut di sini: sel "Luas unit" berada persis di bawahnya
  // dalam kartu yang sama, jadi angkanya akan terbaca dua kali dalam satu
  // tarikan mata — pengulangan yang tidak menambah apa pun selain tinggi.
  const barisUnit = [
    data.lantaiUnit ? `Lantai ${data.lantaiUnit}` : null,
    data.nomorUnit ? `Unit ${data.nomorUnit}` : null,
  ].filter(Boolean) as string[];
  const adaIdentitasUnit = !!(data.namaGedung || data.tipeUnit || barisUnit.length);

  const sisaKamarTotal = multiTipe
    ? data.tipeKamar.reduce((s, t) => s + t.kamarTersedia, 0)
    : data.kamarTersedia;
  const totalKamar = multiTipe
    ? data.tipeKamar.reduce((s, t) => s + t.jumlahKamar, 0)
    : data.totalKamar;

  return (
    <div className="w-full min-w-0 flex-1 space-y-7">
      {/* ══ 1. IDENTITAS & RINGKASAN UNIT ══
          Identitas unit dan angka-angkanya SATU kartu, bukan dua section yang
          dipisah pembatas. Keduanya menjawab pertanyaan yang sama ("unit apa
          ini, sebesar apa"), jadi memisahkannya menghasilkan pembatas + dua
          jarak antar-section (±72px) di antara dua baris yang justru harus
          dibaca sekaligus — halaman terasa renggang tanpa menambah kejelasan.

          Ringkasannya punya dua bentuk, karena yang diringkas memang beda
          benda. Kos disewa per KAMAR (sisa kamar, gender penghuni, kamar mandi
          dalam/luar); apartemen & rumah disewa UTUH (luas unit, jumlah kamar
          tidur & mandi, furnished). Memakai satu baris statistik untuk keduanya
          membuat setengahnya selalu "—". */}
      <section className={`bg-transparent border-b pb-7 ${LINE.section}`}>
        <div
          className={`overflow-hidden rounded-[1.5rem] border ${LINE.card}`}
          style={{ background: SURFACE.card, boxShadow: KILAU_KARTU }}
        >
          {adaIdentitasUnit && (
            <>
              <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${AKSEN_SECTION.ringkasan.kotak}`}
                >
                  <Icon
                    icon="solar:buildings-3-bold-duotone"
                    className="text-lg"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-extrabold leading-tight text-white">
                    {data.namaGedung || "Unit apartemen"}
                  </p>
                  {barisUnit.length > 0 && (
                    <p className="mt-0.5 truncate text-[11px] text-white/45">
                      {barisUnit.join(" · ")}
                    </p>
                  )}
                </div>
                {data.tipeUnit && (
                  <span
                    className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-black ${AKSEN_SECTION.ringkasan.chip}`}
                  >
                    {data.tipeUnit}
                  </span>
                )}
              </div>
              <div className="h-px bg-white/[0.06]" />
            </>
          )}

          {/* Selalu 4 kolom di semua lebar layar. Empat angka ini dibaca
              sebagai satu baris ringkasan ("16/16 kamar, campur, 3 tipe,
              kamar mandi bervariasi"); begitu dipecah jadi 2×2 di layar kecil,
              urutannya patah dan kartunya jadi dua kali lebih tinggi. Ukuran
              teks & padding yang mengecil di mobile — bukan jumlah kolom. */}
          <div className="grid grid-cols-4 gap-0.5 p-1.5 sm:gap-1">
          {data.isKos ? (
            <>
              <StatCell
                ikon="mdi:door-open"
                label="Sisa kamar"
                nilai={
                  sisaKamarTotal != null
                    ? `${sisaKamarTotal}${totalKamar ? ` / ${totalKamar}` : ""}`
                    : "—"
                }
                aksen={aksenSisaKamar(sisaKamarTotal)}
              />
              <StatCell
                ikon={gender?.icon || "solar:users-group-rounded-bold-duotone"}
                label="Tipe kos"
                nilai={gender?.label.replace("Kos ", "") || "Umum"}
                aksen={gender ? aksenGender : undefined}
              />
              <StatCell
                ikon={
                  multiTipe
                    ? "solar:layers-minimalistic-bold-duotone"
                    : "solar:ruler-angular-bold-duotone"
                }
                label={multiTipe ? "Tipe kamar" : "Luas kamar"}
                nilai={
                  multiTipe
                    ? `${data.tipeKamar.length} tipe`
                    : data.luasKamar
                      ? `${data.luasKamar} m²`
                      : "—"
                }
                aksen={multiTipe ? AKSEN_SECTION.tipeKamar : undefined}
              />
              <StatCell
                ikon={km?.icon || "solar:bath-bold-duotone"}
                label="Kamar mandi"
                nilai={
                  km
                    ? km.label
                        .replace("Kamar mandi ", "")
                        .replace(/^./, (c) => c.toUpperCase())
                    : multiTipe
                      ? "Bervariasi"
                      : "—"
                }
                // Ikon kamar mandi selalu biru muda — termasuk saat jawabannya
                // "Bervariasi" (kos multi-tipe), yang tetap sebuah jawaban,
                // bukan data kosong. Hanya "—" yang dibiarkan abu-abu.
                aksen={km || multiTipe ? AKSEN.sky : undefined}
              />
            </>
          ) : (
            <>
              <StatCell
                ikon="solar:ruler-angular-bold-duotone"
                label="Luas unit"
                nilai={data.luasBangunan ? `${data.luasBangunan} m²` : "—"}
                aksen={data.luasBangunan ? AKSEN_SECTION.ringkasan : undefined}
              />
              <StatCell
                ikon="solar:bed-bold-duotone"
                label="Kamar tidur"
                nilai={
                  data.kamarTidur == null
                    ? "—"
                    : data.kamarTidur === 0
                      ? "Studio"
                      : `${data.kamarTidur}`
                }
                aksen={data.kamarTidur != null ? AKSEN.violet : undefined}
              />
              <StatCell
                ikon="solar:bath-bold-duotone"
                label="Kamar mandi"
                nilai={data.kamarMandi != null ? `${data.kamarMandi}` : "—"}
                aksen={data.kamarMandi != null ? AKSEN.sky : undefined}
              />
              <StatCell
                ikon="solar:sofa-2-bold-duotone"
                label="Kondisi"
                nilai={data.kondisiInterior || "—"}
              />
            </>
          )}
          </div>
        </div>

        {/* Pill "Listrik termasuk" & "Air termasuk" dihapus: keduanya sudah
            dijawab lengkap di baris Listrik & Air pada blok Ketentuan sewa —
            di sana bahkan lebih jujur, karena keadaan "belum diisi agent" ikut
            tampil sebagai "Tanya agent", sedangkan pill hanya muncul saat
            jawabannya Ya. */}
        {data.akses24Jam && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold ${AKSEN.sky.chip}`}
            >
              <Icon icon="solar:clock-circle-bold-duotone" className="text-sm" />
              Akses 24 jam
            </span>
          </div>
        )}
      </section>

      {/* ══ 2. DESKRIPSI ══ */}
      {data.deskripsi && (
        <section className={`bg-transparent border-b pb-7 ${LINE.section}`}>
          <Judul
            ikon="solar:document-text-bold-duotone"
            aksen={AKSEN_SECTION.deskripsi}
          >
            {data.isKos ? "Tentang kos ini" : "Tentang properti ini"}
          </Judul>
          <p
            className={`whitespace-pre-line text-sm leading-[1.85] text-white/60 ${
              deskripsiPenuh ? "" : "line-clamp-6"
            }`}
          >
            {data.deskripsi}
          </p>
          {data.deskripsi.length > 320 && (
            <button
              onClick={() => setDeskripsiPenuh((v) => !v)}
              className="mt-3 flex items-center gap-1.5 text-sm font-bold text-white underline underline-offset-4 transition-colors hover:text-white/60"
            >
              {deskripsiPenuh ? "Tutup deskripsi" : "Baca selengkapnya"}
              <Icon
                icon="solar:alt-arrow-down-linear"
                className={`transition-transform ${deskripsiPenuh ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </section>
      )}

      {/* ══ 3. TIPE KAMAR / SPESIFIKASI ══ */}
      {multiTipe ? (
        <TipeKamarSection data={data} booking={booking} />
      ) : (
        <section className={`bg-transparent border-b pb-7 ${LINE.section}`}>
          <Judul ikon="solar:bed-bold-duotone" aksen={AKSEN_SECTION.tipeKamar}>
            {data.isKos ? "Spesifikasi kamar" : "Spesifikasi unit"}
          </Judul>
          <div
            className={`rounded-[1.5rem] border p-5 ${LINE.card}`}
            style={{ background: SURFACE.card, boxShadow: KILAU_KARTU }}
          >
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              {(data.isKos
                ? [
                    data.luasKamar && {
                      ikon: "solar:ruler-angular-bold-duotone",
                      label: "Luas kamar",
                      nilai: `${data.luasKamar} m²`,
                    },
                    km && {
                      ikon: km.icon,
                      label: "Kamar mandi",
                      nilai: km.label.replace("Kamar mandi ", ""),
                    },
                    data.kapasitasPenghuni && {
                      ikon: "solar:users-group-rounded-bold-duotone",
                      label: "Kapasitas",
                      nilai: `${data.kapasitasPenghuni} orang`,
                    },
                    data.totalKamar && {
                      ikon: "solar:buildings-2-bold-duotone",
                      label: "Total kamar",
                      nilai: `${data.totalKamar} kamar`,
                    },
                    data.kamarTersedia != null && {
                      ikon: "mdi:door-open",
                      label: "Sisa kamar",
                      nilai: `${data.kamarTersedia} kamar`,
                    },
                    data.jamMalam && {
                      ikon: "solar:moon-stars-bold-duotone",
                      label: "Jam malam",
                      nilai: data.jamMalam,
                    },
                  ]
                : // Unit utuh: yang dibandingkan penyewa apartemen/rumah adalah
                  // luas, jumlah ruang, dan sudah berperabot atau belum.
                  [
                    data.luasBangunan && {
                      ikon: "solar:ruler-angular-bold-duotone",
                      label: "Luas unit",
                      nilai: `${data.luasBangunan} m²`,
                    },
                    data.tipeUnit && {
                      ikon: "solar:home-2-bold-duotone",
                      label: "Tipe unit",
                      nilai: data.tipeUnit,
                    },
                    data.kamarTidur != null && {
                      ikon: "solar:bed-bold-duotone",
                      label: "Kamar tidur",
                      nilai:
                        data.kamarTidur === 0
                          ? "Studio"
                          : `${data.kamarTidur} kamar`,
                    },
                    data.kamarMandi != null && {
                      ikon: "solar:bath-bold-duotone",
                      label: "Kamar mandi",
                      nilai: `${data.kamarMandi} kamar`,
                    },
                    data.kapasitasPenghuni && {
                      ikon: "solar:users-group-rounded-bold-duotone",
                      label: "Kapasitas",
                      nilai: `${data.kapasitasPenghuni} orang`,
                    },
                    data.kondisiInterior && {
                      ikon: "solar:sofa-2-bold-duotone",
                      label: "Kondisi",
                      nilai: data.kondisiInterior,
                    },
                  ]
              )
                .filter(Boolean)
                .map((s: any) => (
                  <div key={s.label} className="flex items-start gap-3">
                    <Icon
                      icon={s.ikon}
                      className={`mt-0.5 text-lg ${AKSEN_SECTION.tipeKamar.ikon}`}
                    />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/30">
                        {s.label}
                      </p>
                      <p className="mt-0.5 text-sm font-bold text-white">
                        {s.nilai}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </section>
      )}

      {/* ══ 4. FASILITAS ══ */}
      {totalFasilitas > 0 && (
        <section className={`bg-transparent border-b pb-7 ${LINE.section}`}>
          <Judul
            ikon="solar:widget-5-bold-duotone"
            aksen={AKSEN_SECTION.fasilitas}
          >
            {multiTipe ? "Fasilitas bersama" : "Fasilitas yang tersedia"}
          </Judul>
          {multiTipe && (
            <p className="-mt-2 mb-5 text-xs leading-relaxed text-white/40">
              Dipakai bergantian seluruh penghuni. Fasilitas di dalam kamar
              berbeda tiap tipe — lihat kartu tipe kamar di atas.
            </p>
          )}

          <FasilitasGrid
            items={fasilitasPratinjau}
            aksen={AKSEN_SECTION.fasilitas}
          />

          {totalFasilitas > fasilitasPratinjau.length && (
            <button
              onClick={() => setModalFasilitas(true)}
              className="mt-6 w-full rounded-xl border border-white/15 px-8 py-3 text-sm font-bold text-white transition-all hover:bg-white/[0.06] active:scale-[0.98] md:w-auto"
            >
              Tampilkan semua {totalFasilitas} fasilitas
            </button>
          )}

          <FasilitasModal
            buka={modalFasilitas}
            onTutup={() => setModalFasilitas(false)}
            grup={grupFasilitas}
          />
        </section>
      )}

      {/* ══ 5. KETENTUAN & PERATURAN ══ */}
      <section className={`bg-transparent border-b pb-7 ${LINE.section}`}>
        <Judul
          ikon="solar:clipboard-check-bold-duotone"
          aksen={AKSEN_SECTION.ketentuan}
        >
          Ketentuan sewa
        </Judul>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div
            className={`rounded-[1.5rem] border px-5 py-2 ${LINE.card}`}
            style={{ background: SURFACE.card, boxShadow: KILAU_KARTU }}
          >
            {data.minimalSewaJumlah && data.minimalSewaSatuan && (
              <BarisKetentuan
                ikon="solar:calendar-minimalistic-bold-duotone"
                label="Minimal sewa"
                nilai={`${data.minimalSewaJumlah} ${
                  DURASI_META[data.minimalSewaSatuan].satuan
                }`}
              />
            )}
            {data.deposit != null && data.deposit > 0 && (
              <BarisKetentuan
                ikon="solar:safe-square-bold-duotone"
                label="Deposit"
                catatan="Dikembalikan saat keluar bila tidak ada kerusakan"
                nilai={formatRupiah(data.deposit)}
                aksen={AKSEN.mint}
              />
            )}
            {/* Ikonnya ikut jawabannya: hijau bila sudah termasuk, kuning bila
                masih ada tagihan sendiri. Warnanya jadi ringkasan yang terbaca
                sebelum teksnya dibaca. */}
            <BarisKetentuan
              ikon="solar:bolt-circle-bold-duotone"
              label="Listrik"
              nilai={
                data.termasukListrik == null
                  ? "Tanya agent"
                  : data.termasukListrik
                    ? "Termasuk"
                    : "Bayar sendiri"
              }
              aksen={
                data.termasukListrik == null
                  ? undefined
                  : data.termasukListrik
                    ? AKSEN.emerald
                    : AKSEN.amber
              }
            />
            <BarisKetentuan
              ikon="solar:waterdrops-bold-duotone"
              label="Air"
              nilai={
                data.termasukAir == null
                  ? "Tanya agent"
                  : data.termasukAir
                    ? "Termasuk"
                    : "Bayar sendiri"
              }
              aksen={
                data.termasukAir == null
                  ? undefined
                  : data.termasukAir
                    ? AKSEN.emerald
                    : AKSEN.amber
              }
            />
            {data.jamMalam && (
              <BarisKetentuan
                ikon="solar:moon-stars-bold-duotone"
                label="Jam malam"
                nilai={data.jamMalam}
              />
            )}
            {data.akses24Jam != null && (
              <BarisKetentuan
                ikon="solar:key-minimalistic-square-bold-duotone"
                label="Akses 24 jam"
                nilai={data.akses24Jam ? "Ya" : "Tidak"}
              />
            )}
            {/* Check-in/out hanya terisi untuk sewa harian/mingguan. */}
            {data.jamCheckIn && (
              <BarisKetentuan
                ikon="solar:login-3-bold-duotone"
                label="Check-in"
                nilai={`Mulai ${data.jamCheckIn}`}
              />
            )}
            {data.jamCheckOut && (
              <BarisKetentuan
                ikon="solar:logout-3-bold-duotone"
                label="Check-out"
                nilai={`Sebelum ${data.jamCheckOut}`}
              />
            )}
          </div>

          <div>
            <h4 className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-white/35">
              {data.isKos ? "Peraturan kos" : "Peraturan"}
            </h4>
            {data.peraturan.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {data.peraturan.map((p) => {
                  const larangan = /dilarang|tidak boleh/i.test(p.label);
                  return (
                    <span
                      key={p.label}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
                        larangan ? AKSEN.rose.chip : AKSEN.netral.chip
                      }`}
                    >
                      <Icon icon={p.icon} className="text-base" />
                      {p.label}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-white/35">
                Belum ada peraturan khusus yang dicantumkan pemilik.
              </p>
            )}

            {gender && (
              <div
                className={`mt-4 flex items-start gap-3 rounded-xl border p-3.5 ${LINE.card} ${aksenGender.wash}`}
              >
                <Icon icon={gender.icon} className={`text-xl ${aksenGender.ikon}`} />
                <div>
                  <p className="text-sm font-bold text-white">{gender.label}</p>
                  <p className="text-[11px] text-white/40">{gender.sublabel}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Biaya tambahan — alasan nomor satu penyewa merasa dikelabui adalah
            tagihan yang baru muncul setelah tanda tangan. Ditampilkan sebagai
            daftar eksplisit lengkap dengan periodenya, dan nominal yang
            memang belum pasti ditulis apa adanya ("Sesuai pemakaian")
            daripada disembunyikan. */}
        {data.biayaTambahan.length > 0 && (
          <div
            className={`mt-6 rounded-[1.5rem] border border-amber-400/15 p-5 ${AKSEN.amber.wash}`}
          >
            <h4 className="mb-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-amber-200">
              <Icon icon="solar:bill-list-bold-duotone" className="text-base" />
              Biaya di luar harga sewa
            </h4>
            <p className="mb-4 text-[11px] text-white/40">
              Ditagih terpisah dari harga sewa dan deposit.
            </p>
            <div className="grid gap-x-6 sm:grid-cols-2">
              {data.biayaTambahan.map((b, i) => (
                <div
                  key={`${b.nama}-${i}`}
                  className="flex items-baseline justify-between gap-4 border-b border-white/[0.05] py-2.5 last:border-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-0"
                >
                  <span className="text-sm font-semibold text-white/75">
                    {b.nama}
                  </span>
                  <span className="shrink-0 text-sm font-bold text-white">
                    {b.nominal != null && b.nominal > 0 ? (
                      <>
                        {formatRupiah(b.nominal)}
                        <span className="ml-1 text-[11px] font-semibold text-white/40">
                          {PERIODE_BIAYA_SUFFIX[b.periode]}
                        </span>
                      </>
                    ) : (
                      <span className="text-white/50">Sesuai pemakaian</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ══ 6. LOKASI ══ */}
      <section className={`bg-transparent border-b pb-7 ${LINE.section}`}>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-white">
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${AKSEN_SECTION.lokasi.kotak}`}
              >
                <Icon icon="solar:map-point-bold-duotone" className="text-base" />
              </span>
              Lokasi & sekitar
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-white/45">
              {alamatLengkap}
            </p>
          </div>
          <a
            href={tautanRute}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex shrink-0 items-center gap-1 text-xs font-bold transition-colors hover:text-white ${AKSEN_SECTION.lokasi.teks}`}
          >
            Lihat rute <Icon icon="solar:arrow-right-up-linear" />
          </a>
        </div>

        {/* Tinggi peta disamakan dengan Jual & Lelang. Di 340px, chip filter di
            atas dan kartu "Fasilitas Terdekat" di bawah memakan hampir separuh
            tinggi peta — yang tersisa untuk melihat sebaran pin tinggal
            sepotong pita di tengah. */}
        {adaPeta && (
          <div
            className="relative z-0 mb-6 h-[420px] w-full overflow-hidden rounded-[1.5rem] border border-white/10 md:h-[500px]"
            style={{ background: SURFACE.raised }}
          >
            <PetaLokasi
              lat={titik?.lat}
              lng={titik?.lng}
              address={alamatLengkap}
              tempat={sekitar.tempat}
              radius={sekitar.radius}
              memuat={sekitar.memuat}
              gagal={sekitar.gagal}
              onUlang={sekitar.ulangi}
            />
          </div>
        )}

        {/* ── Patokan dari agent ──
            Diletakkan di atas daftar otomatis karena inilah yang diverifikasi
            manusia: hanya agent yang tahu "5 menit jalan kaki ke gerbang
            kampus". Daftar otomatis di bawahnya melengkapi, bukan menggantikan
            — dan selalu ada, termasuk untuk listing yang patokannya tidak
            pernah diisi. */}
        {/* Warna per kategori patokan (kampus ungu, transport biru, RS merah,
            niaga kuning) — pola yang sudah dikenal dari aplikasi peta, jadi
            kategorinya terbaca dari ikon tanpa membaca judul grupnya. Tata
            letak & pemotongan daftarnya ada di PatokanAgent, dipakai bersama
            /Jual & /Lelang. */}
        <PatokanAgent
          akses={data.aksesTerdekat}
          className={adaPeta ? "mb-7" : ""}
        />

        {/* ── Fasilitas sekitar otomatis ──
            Sama persis dengan yang dipakai /Jual & /Lelang: satu pemindaian per
            aset di server, disimpan, lalu dipakai ulang oleh semua pengunjung
            berikutnya. Tanpa daftar ini, pin berwarna di peta hanya bisa dibaca
            dengan mengklik satu per satu — pekerjaan yang tidak akan dilakukan
            orang yang sedang membandingkan lima kos. */}
        {adaPeta && (
          <FasilitasSekitar sekitar={sekitar} titikPerkiraan={titikPerkiraan} />
        )}
      </section>

      {/* ══ 7. AGENT ══ */}
      <section className="bg-transparent">
        <Judul
          ikon="solar:user-check-rounded-bold-duotone"
          aksen={AKSEN_SECTION.agent}
        >
          Dikelola oleh
        </Judul>
        <div
          className={`flex flex-col gap-5 rounded-[1.5rem] border p-5 sm:flex-row sm:items-center ${LINE.card}`}
          style={{ background: SURFACE.card, boxShadow: KILAU_KARTU }}
        >
          <div className="relative h-16 w-16 shrink-0">
            {/* Cincin foto memakai hue "orang" (violet→sky), bukan mint: mint
                sudah jadi penanda harga & tombol di panel sebelahnya. */}
            <div
              className="h-full w-full overflow-hidden rounded-full p-[2px]"
              style={{
                background: "linear-gradient(135deg,#a78bfa 0%,#38bdf8 100%)",
              }}
            >
              <div
                className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full"
                style={{ background: SURFACE.raised }}
              >
                {data.agent.foto ? (
                  <Image
                    src={data.agent.foto}
                    alt={data.agent.nama}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                ) : (
                  <span className="text-xl font-black text-white">
                    {data.agent.nama.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <span
              className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full"
              style={{ background: SURFACE.card }}
            >
              <span className="grid h-full w-full place-items-center rounded-full bg-blue-500">
                <Icon icon="solar:verified-check-bold" className="text-[10px] text-white" />
              </span>
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="text-base font-extrabold text-white">
              {data.agent.nama}
            </h4>
            <p className="text-xs text-white/40">
              {data.agent.kantor} · {data.agent.kotaArea}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-semibold text-white/45">
              <span className="inline-flex items-center gap-1.5">
                <Icon icon="solar:star-bold" className="text-amber-400" />
                {data.agent.rating > 0 ? data.agent.rating.toFixed(1) : "Baru"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon
                  icon="solar:medal-ribbon-bold"
                  className={AKSEN_SECTION.agent.ikon}
                />
                {data.agent.jumlahClosing} closing
              </span>
              {data.agent.tahunGabung && (
                <span className="inline-flex items-center gap-1.5">
                  <Icon icon="solar:calendar-bold" />
                  Sejak {data.agent.tahunGabung}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

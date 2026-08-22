"use client";

/**
 * Kolom kiri halaman detail aset lelang — urutannya mengikuti pertanyaan
 * penawar, bukan urutan kolom di database:
 *
 *   1. "Aset apa ini, di mana?"          → kepala halaman
 *   2. (internal) "Siapa PIC-nya?"       → panel stok, hanya tim dalam
 *   3. "Kapan lelangnya, jaminannya?"    → ringkasan satu baris
 *   4. "Ceritakan asetnya"               → deskripsi
 *   5. "Sertifikatnya apa?"              → legalitas & status
 *   6. "Dekat apa?"                      → lokasi & sekitar
 *   7. "Sudah pernah dilelang?"          → riwayat lelang
 *   8. "Kenapa harus lelang?"            → edukasi
 *
 * PERUBAHAN BESAR DARI VERSI LAMA.
 *
 * a. Ringkasan lelang dulu empat kartu tinggi berisi satu nilai masing-masing;
 *    sekarang satu baris ringkas (StatStrip) yang tetap sebaris di ponsel.
 *
 * b. Blok "Alamat Lengkap" berupa kisi lima kotak DIHAPUS — isinya persis
 *    sama dengan alamat di kepala halaman, hanya dipecah. Wilayahnya jadi chip
 *    di atas peta.
 *
 * c. Bagian lokasi kini menjawab "dekat apa?" (SekitarLokasi). Ini penting
 *    justru untuk lelang: aset lelang hampir selalu dilihat orang yang tidak
 *    kenal daerahnya, dan judul hasil scrape sering hanya menyebut nomor SHM.
 *
 * d. Bagian edukasi lelang dipadatkan. Sebelumnya sepertiga halaman berisi
 *    teks promosi umum yang sama untuk SEMUA aset — didorong ke bawah dan
 *    dibuat ringkas supaya tidak mengalahkan data aset yang sedang dilihat.
 *
 * Warna mengikuti src/lib/detailTheme.ts. Panel "Info Stok Internal" tetap
 * emas mencolok: itu satu-satunya blok yang memang harus terlihat berbeda —
 * isinya tidak boleh dibacakan ke klien.
 */

import React, { useMemo, useState } from "react";
import { Icon } from "@iconify/react";

import RiwayatLelang from "./RiwayatLelang";
import type { AuctionHistoryResult } from "@/lib/auctionHistory";
import { daftarBidang } from "@/lib/nomorLegalitas";
import DaftarSertifikatSheet from "@/components/property/detail/DaftarSertifikatSheet";
import {
  AKSEN,
  AKSEN_SECTION_ASET,
  LINE,
  SURFACE,
  type Aksen,
} from "@/lib/detailTheme";
import type { AksesTerdekat } from "@/lib/kosDetail";
import SekitarLokasi from "@/components/property/detail/SekitarLokasi";
import type { SekitarAwal } from "@/components/property/detail/useSekitar";
import {
  Bagian,
  BarisFakta,
  Chip,
  Deskripsi,
  Judul,
  Kartu,
  SpandukTerjual,
  StatStrip,
  TombolBagikan,
  type ItemStat,
} from "@/components/property/detail/parts";

interface AgentInfo {
  nama: string;
  telepon: string;
  whatsapp: string;
  email: string;
  kantor: string;
  foto_url: string;
  rating: number;
  jumlah_closing: number;
  kota_area: string;
  jabatan: string;
}

interface OwnerInfo {
  name: string;
  avatar: string;
  phone: string;
  office: string;
  rating: number;
  closing: number;
  area: string;
  join: string;
}

interface PropertyData {
  id_property: string; // <- biarkan sebagai string hasil serialize BigInt
  kode_properti: string;
  judul: string;
  title: string;

  kota: string;
  alamat_lengkap: string;
  address: string;
  area_lokasi: string | null;
  kelurahan: string | null;
  kecamatan: string | null;
  provinsi: string | null;
  latitude: number | null;
  longitude: number | null;
  akses_terdekat?: AksesTerdekat[] | null;
  /** Hasil pemindaian sekitar yang sudah tersimpan (dibaca di server). */
  sekitar?: SekitarAwal | null;

  harga: number;
  harga_promo: number | null;
  jenis_transaksi: string;
  kategori: string;
  status_tayang: string;
  is_hot_deal: boolean;
  dilihat: number;
  tanggal_lelang: string | null;

  uang_jaminan: number | null;
  nilai_limit_lelang: number | null;

  luas_tanah: number | null;
  luas_bangunan: number | null;
  kamar_tidur: number | null;
  kamar_mandi: number | null;
  jumlah_lantai: number | null;
  daya_listrik: number | null;
  sumber_air: string | null;
  hadap_bangunan: string | null;
  kondisi_interior: string | null;
  legalitas: string | null;
  nomor_legalitas?: string | null;
  vendor?: string | null;
  lampiran?: string | null;
  /**
   * Tautan pengumuman lelang di sumber aslinya (lelang.go.id / situs vendor).
   * Hanya ditampilkan ke agent — lihat `canSeeLinkSumber`.
   */
  link?: string | null;

  deskripsi: string | null;

  gambar_utama: string;

  agent: AgentInfo | null;
  owner: OwnerInfo;

  priceRates: {
    monthly: number;
    daily: number;
  };
}

interface DetailInfoProps {
  data: PropertyData;
  selectedRoom?: any;
  setSelectedRoom?: (room: any) => void;
  currentAgentId?: string | null;
  currentRole?: string | null;
  currentJabatan?: string | null;
  /** Riwayat lelang hasil hitungan server — lihat @/lib/auctionHistory. */
  riwayatLelang?: AuctionHistoryResult | null;
  /** Status login dari server, supaya blok riwayat tidak salah render dulu. */
  isLoggedIn?: boolean;
}

const formatRupiah = (val: number | null | undefined) => {
  if (val == null || isNaN(val)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val);
};

/**
 * "Rp 1,2 M" — dipakai di ringkasan satu baris.
 *
 * Uang jaminan lelang bernilai ratusan juta; ditulis penuh, ia memaksa satu sel
 * ringkasan jadi tiga baris dan merusak barisnya. Nominal penuhnya tetap ada di
 * panel harga sebelah kanan.
 */
const formatRupiahSingkat = (n: number | null | undefined): string => {
  if (n == null || isNaN(n) || n <= 0) return "-";
  if (n >= 1_000_000_000) {
    const v = n / 1_000_000_000;
    return `Rp ${v % 1 === 0 ? v : v.toFixed(1).replace(".", ",")} M`;
  }
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `Rp ${v % 1 === 0 ? v : v.toFixed(1).replace(".", ",")} jt`;
  }
  if (n >= 1_000) return `Rp ${Math.round(n / 1_000)} rb`;
  return formatRupiah(n);
};

const BADGE_TRANSAKSI: Record<string, { label: string; icon: string; aksen: Aksen }> = {
  JUAL: { label: "Dijual", icon: "solar:tag-price-bold", aksen: AKSEN.mint },
  SECONDARY: { label: "Secondary", icon: "solar:tag-price-bold", aksen: AKSEN.mint },
  SEWA: { label: "Disewa", icon: "solar:key-bold", aksen: AKSEN.sky },
  LELANG: { label: "Lelang", icon: "mdi:gavel", aksen: AKSEN.amber },
};

const badgeTransaksi = (jenis: string) =>
  BADGE_TRANSAKSI[jenis?.toUpperCase()] || {
    label: jenis || "Properti",
    icon: "solar:home-bold",
    aksen: AKSEN.violet,
  };

const KATEGORI: Record<string, { label: string; icon: string }> = {
  RUMAH: { label: "Rumah", icon: "solar:home-2-bold-duotone" },
  APARTEMEN: { label: "Apartemen", icon: "solar:buildings-3-bold-duotone" },
  RUKO: { label: "Ruko", icon: "solar:shop-2-bold-duotone" },
  TANAH: { label: "Tanah", icon: "solar:map-bold-duotone" },
  GUDANG: { label: "Gudang", icon: "solar:box-bold-duotone" },
  VILLA: { label: "Villa", icon: "solar:home-wifi-bold-duotone" },
  GEDUNG: { label: "Gedung", icon: "solar:buildings-2-bold-duotone" },
  KANTOR: { label: "Kantor", icon: "solar:case-bold-duotone" },
};

const kategoriMeta = (kategori: string) =>
  KATEGORI[kategori?.toUpperCase()] || {
    label: kategori || "Properti",
    icon: "solar:home-bold-duotone",
  };

const formatTanggalLelang = (val?: string | null) => {
  if (!val) return "-";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/**
 * Sisa hari menuju lelang.
 *
 * Tanggal saja tidak menjawab pertanyaan yang sebenarnya ("masih sempat
 * tidak?"), apalagi untuk aset hasil scrape yang tanggalnya bisa sudah lewat
 * berbulan-bulan. Dihitung di client dengan sengaja: nilainya berubah tiap
 * hari, sedangkan halaman ini di-ISR dan bisa tersaji dari cache lama.
 */
const hitungSisaHari = (val?: string | null): number | null => {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  const hariIni = new Date();
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate());
  return Math.round((a - b) / 86_400_000);
};

// Template soft selling
const buildShareMessage = (data: PropertyData) => {
  const judul = data?.judul || "Listing Properti";
  const hargaLelang = data?.nilai_limit_lelang ?? data?.harga ?? 0;
  const harga = formatRupiah(hargaLelang);
  const lokasiSingkat =
    data?.kota ||
    data?.alamat_lengkap ||
    [data?.kelurahan, data?.kecamatan, data?.kota, data?.provinsi]
      .filter(Boolean)
      .join(", ");

  const luasTanah = data?.luas_tanah ? `${data.luas_tanah} m²` : "-";
  const legal = data?.legalitas || "-";
  const kode =
    data?.kode_properti && data.kode_properti !== "-"
      ? data.kode_properti
      : data?.id_property || "-";

  const headerLelang = data?.tanggal_lelang
    ? `🔥 SEGERA LELANG, ${formatTanggalLelang(data.tanggal_lelang)} 🔥`
    : "🔥 SEGERA LELANG 🔥";

  return (
    `${headerLelang}\n` +
    `🏡 ${judul}\n` +
    (lokasiSingkat ? `📍 ${lokasiSingkat}\n` : "") +
    `📌 Spesifikasi\n` +
    (data?.alamat_lengkap ? `📍 ${data.alamat_lengkap}\n` : "") +
    `📐 LT ${luasTanah}\n` +
    `📃 Tipe Hak: ${legal}\n` +
    `💰 Harga Limit: ${harga}\n` +
    `Kode: ${kode}\n\n` +
    `✨ Kenapa Beli Lelang Menarik?\n` +
    `• Harga jauh di bawah pasar, lebih murah dibanding rumah primary & secondary.\n` +
    `• Potensi capital gain tinggi, bisa dijual kembali mendekati harga pasar.\n` +
    `• Salah satu cara aman untuk beli properti melalui mekanisme resmi.\n\n` +
    `📞 Kontak: ${
      data?.agent?.telepon ||
      data?.owner?.phone ||
      "Hubungi kami untuk info lebih lanjut"
    }`
  );
};

/** Tiga alasan beli lelang — dipakai di bagian edukasi. */
const ALASAN_LELANG: { ikon: string; judul: string; isi: string; aksen: Aksen }[] = [
  {
    ikon: "solar:wallet-money-bold-duotone",
    judul: "Harga di bawah pasar",
    isi: "Aset lelang umumnya 20–40% lebih murah karena harus cepat terjual.",
    aksen: AKSEN.mint,
  },
  {
    ikon: "solar:shield-check-bold-duotone",
    judul: "Legal terjamin",
    isi: "Diawasi lembaga resmi; sertifikat & dokumen terverifikasi sebelum lelang.",
    aksen: AKSEN.emerald,
  },
  {
    ikon: "solar:clock-circle-bold-duotone",
    judul: "Proses cepat",
    isi: "Tanpa negosiasi berlarut. Menang lelang, langsung proses akad.",
    aksen: AKSEN.violet,
  },
];

export default function DetailInfo({
  data,
  currentAgentId: _currentAgentId,
  currentRole,
  currentJabatan,
  riwayatLelang = null,
  isLoggedIn,
}: DetailInfoProps) {
  // Nomor sertifikat hanya untuk orang dalam. `currentRole` isinya `peran_enum`
  // (USER|AGENT), jadi cabang keduanya memakai `currentJabatan` — sebelumnya
  // ditulis `currentRole === "OWNER"`, perbandingan yang tidak pernah benar.
  // Praktisnya owner tetap lolos lewat cabang pertama (peran-nya AGENT); cabang
  // jabatan ada sebagai jaring kalau ada akun owner yang perannya belum AGENT.
  const canSeeNomorLegalitas =
    currentRole === "AGENT" || currentJabatan === "OWNER";

  // Satu lot lelang bisa memuat beberapa bidang; nomornya ditumpuk dalam satu
  // kolom ("123,456,789"). Kalau lebih dari satu, deretan itu tidak muat di
  // baris ringkasan dan dipindah ke panel tersendiri — lihat
  // DaftarSertifikatSheet. Aset satu bidang TIDAK bisa diketuk: nomornya sudah
  // tampil utuh, jadi tidak ada isi yang bisa dibuka.
  const bidangSertifikat = useMemo(
    () => (canSeeNomorLegalitas ? daftarBidang(data?.nomor_legalitas) : []),
    [canSeeNomorLegalitas, data?.nomor_legalitas],
  );
  const multiBidang = bidangSertifikat.length > 1;
  const [sertifikatTerbuka, setSertifikatTerbuka] = useState(false);

  const bukaSertifikat = multiBidang ? () => setSertifikatTerbuka(true) : undefined;
  const petunjukSertifikat = multiBidang
    ? `Lihat ${bidangSertifikat.length} nomor sertifikat`
    : undefined;
  // Nomor lengkapnya hanya dicetak di baris ringkasan saat cuma ada satu bidang.
  const catatanSertifikat = !canSeeNomorLegalitas
    ? undefined
    : multiBidang
      ? `${bidangSertifikat.length} bidang`
      : bidangSertifikat.length === 1
        ? `No. ${bidangSertifikat[0].teks}`
        : // Kolomnya terisi tapi tidak mengandung angka sama sekali (mis. "menyusul
          // dari vendor"). Tetap ditampilkan apa adanya — itu tetap informasi.
          data?.nomor_legalitas
          ? `No. ${data.nomor_legalitas}`
          : undefined;

  /**
   * Tautan pengumuman lelang di sumbernya — alat kerja agent, bukan informasi
   * publik.
   *
   * Aturannya sengaja disamakan dengan nomor sertifikat (`canSeeNomorLegalitas`)
   * dan bukan aturan baru: keduanya menjawab pertanyaan yang sama, "apakah
   * pembaca ini orang dalam?". Dua aturan terpisah untuk satu pertanyaan adalah
   * cara paling pasti membuat keduanya perlahan berbeda.
   *
   * Kenapa tidak untuk pengunjung umum: tautan ini menuju pengumuman aslinya,
   * dan menaruhnya di halaman publik berarti mengantar calon pembeli keluar dari
   * platform — tepat sebelum titik yang membuat agent dibayar. Untuk agent
   * sendiri ia justru wajib ada: itu sumber yang dia pakai memverifikasi jadwal,
   * nilai limit, dan uang jaminan sebelum menjawab pertanyaan klien.
   *
   * CATATAN: `product` dikirim utuh ke browser, jadi penyaringan ini hanya
   * menyembunyikan dari LAYAR — nilainya tetap ada di payload halaman dan
   * terbaca lewat "view source". Sama persis dengan nomor sertifikat & lampiran
   * hari ini. Kalau tautannya memang rahasia, yang harus diubah adalah
   * page.tsx-nya (jangan pernah kirim kolomnya untuk non-agent), bukan baris ini.
   */
  const canSeeLinkSumber = canSeeNomorLegalitas;

  /**
   * Tautan yang sudah dipastikan aman dibuka.
   *
   * Kolom `link` diisi scraper dan agent, jadi isinya tidak pernah bisa
   * dipercaya mentah-mentah: `javascript:…` di dalam `href` adalah XSS yang
   * dijalankan oleh klik korbannya sendiri. Hanya http & https yang lolos;
   * selain itu barisnya tidak dirender sama sekali — lebih baik tidak ada
   * tombol daripada ada tombol yang tidak jelas membawa ke mana.
   */
  const linkSumber = useMemo<string | null>(() => {
    if (!canSeeLinkSumber) return null;
    const mentah = (data?.link || "").trim();
    if (!mentah) return null;
    try {
      const url = new URL(mentah);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      return url.toString();
    } catch {
      return null;
    }
  }, [canSeeLinkSumber, data?.link]);

  // ✅ Section PIC/Vendor & Lampiran hanya untuk tim internal (Stoker & manajemen)
  const canSeePicInfo =
    currentJabatan === "STOKER" ||
    currentJabatan === "ADMIN" ||
    currentJabatan === "OWNER" ||
    currentJabatan === "PRINCIPAL";

  const lampiranList = (data?.lampiran || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const badge = badgeTransaksi(data?.jenis_transaksi || "LELANG");
  const kategori = kategoriMeta(data?.kategori || "RUMAH");
  const isSold = data?.status_tayang?.toString().toUpperCase() === "TERJUAL";

  const [shared, setShared] = useState(false);
  const [vendorCopied, setVendorCopied] = useState(false);

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    const text = buildShareMessage(data);

    if (navigator.share) {
      try {
        await navigator.share({
          title: data?.judul || "Listing Properti Lelang",
          text,
          url,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch {
        // user batal / error
      }
    } else if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(`${text}\n\n🔗 Info lengkap: ${url}`);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch {
        // gagal copy, abaikan
      }
    }
  };

  const sisaHari = hitungSisaHari(data?.tanggal_lelang);
  // Merah bila tinggal seminggu, netral bila sudah lewat: tanggal yang sudah
  // berlalu bukan hal mendesak, hanya arsip.
  const aksenJadwal =
    sisaHari == null
      ? AKSEN.netral
      : sisaHari < 0
        ? AKSEN.netral
        : sisaHari <= 7
          ? AKSEN.rose
          : AKSEN.amber;

  const alamatKepala =
    data?.alamat_lengkap ||
    [data?.kelurahan, data?.kecamatan, data?.kota, data?.provinsi]
      .filter(Boolean)
      .join(", ") ||
    "Lokasi tidak tersedia";

  const aksesTerdekat: AksesTerdekat[] = Array.isArray(data?.akses_terdekat)
    ? (data.akses_terdekat as AksesTerdekat[]).filter((a) => a?.nama)
    : [];

  const ringkasan: ItemStat[] = [
    data?.luas_tanah && {
      ikon: "solar:ruler-angular-bold-duotone",
      label: "Luas tanah",
      nilai: `${data.luas_tanah} m²`,
      aksen: AKSEN.amber,
    },
    data?.luas_bangunan && {
      ikon: "solar:home-2-bold-duotone",
      label: "Luas bangunan",
      nilai: `${data.luas_bangunan} m²`,
      aksen: AKSEN.sky,
    },
    {
      ikon: "solar:shield-check-bold-duotone",
      label: "Legalitas",
      nilai: data?.legalitas || "-",
      aksen: data?.legalitas ? AKSEN.emerald : undefined,
      catatan: catatanSertifikat,
      onKlik: bukaSertifikat,
      petunjuk: petunjukSertifikat,
    },
    {
      ikon: "solar:calendar-date-bold-duotone",
      label: "Tanggal lelang",
      nilai: formatTanggalLelang(data?.tanggal_lelang),
      aksen: data?.tanggal_lelang ? aksenJadwal : undefined,
      catatan:
        sisaHari == null
          ? undefined
          : sisaHari > 0
            ? `${sisaHari} hari lagi`
            : sisaHari === 0
              ? "Hari ini"
              : "Sudah lewat",
    },
    {
      ikon: "solar:wallet-money-bold-duotone",
      label: "Uang jaminan",
      nilai: formatRupiahSingkat(data?.uang_jaminan),
      aksen: data?.uang_jaminan ? AKSEN.mint : undefined,
    },
  ].filter(Boolean) as ItemStat[];

  return (
    <div className="w-full min-w-0 space-y-7 pb-10 lg:w-2/3">
      {isSold && <SpandukTerjual label="terjual" />}

      {/* ══ 1. KEPALA HALAMAN ══ */}
      <Bagian>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Chip ikon={badge.icon} aksen={badge.aksen}>
            {badge.label}
          </Chip>
          <Chip ikon={kategori.icon}>{kategori.label}</Chip>
          {data?.is_hot_deal && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/30 bg-gradient-to-r from-orange-500/20 to-rose-500/20 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-orange-200"
              title="Hot Deal"
            >
              <Icon icon="solar:fire-bold" className="text-sm" />
              <span className="hidden sm:inline">Hot deal</span>
            </span>
          )}
          {sisaHari != null && sisaHari >= 0 && sisaHari <= 7 && (
            <Chip ikon="solar:alarm-bold-duotone" aksen={AKSEN.rose}>
              {sisaHari === 0 ? "Lelang hari ini" : `${sisaHari} hari lagi`}
            </Chip>
          )}
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black leading-tight tracking-tight text-white md:text-[32px]">
              {data?.judul || "Properti Tanpa Judul"}
            </h1>

            <div className="mt-3 flex items-start gap-2">
              <Icon
                icon="solar:map-point-bold"
                className={`mt-0.5 shrink-0 text-lg ${AKSEN.sky.ikon}`}
              />
              <p className="text-[15px] font-medium leading-snug text-white/85">
                {alamatKepala}
              </p>
            </div>

            <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-semibold text-white/40">
              <span className="inline-flex items-center gap-1.5">
                <Icon icon="solar:eye-bold" /> {data?.dilihat ?? 0} dilihat
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon icon="solar:hashtag-bold" /> ID {data?.id_property || "-"}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                  isSold ? AKSEN.rose.chip : AKSEN.emerald.chip
                }`}
              >
                <Icon
                  icon={isSold ? "solar:lock-keyhole-bold" : "solar:check-circle-bold"}
                  className="text-xs"
                />
                {data?.status_tayang || "TERSEDIA"}
              </span>
            </div>
          </div>

          <TombolBagikan onClick={handleShare} tersalin={shared} />
        </div>
      </Bagian>

      {/* ══ 1.5. PIC / VENDOR & LAMPIRAN — KHUSUS STOKER & MANAJEMEN ══
          Sengaja tetap emas & mencolok: satu-satunya blok di halaman ini yang
          isinya TIDAK boleh dibacakan ke klien, jadi perbedaannya harus
          terlihat dari sudut mata. */}
      {canSeePicInfo && (
        <div className="relative rounded-[1.5rem] bg-gradient-to-br from-amber-300/50 via-amber-500/15 to-white/[0.04] p-px shadow-[0_20px_60px_-15px_rgba(245,158,11,0.25)]">
          <div
            className="relative overflow-hidden rounded-[1.5rem] p-5 ring-1 ring-inset ring-white/[0.04] sm:p-6"
            style={{ background: SURFACE.panel }}
          >
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-amber-400/[0.08] blur-[80px]" />

            <div className="relative mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-amber-300 to-yellow-600 shadow-[0_0_16px_rgba(245,158,11,0.4)]">
                  <Icon
                    icon="solar:shield-keyhole-bold"
                    className="text-sm text-[#1a1206]"
                  />
                </span>
                <span className="bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 bg-clip-text text-[11px] font-extrabold uppercase tracking-[0.24em] text-transparent sm:text-xs">
                  Info stok internal
                </span>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-400/25 bg-white/[0.03] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-200/90">
                <Icon icon="solar:lock-keyhole-bold" className="text-xs text-amber-400" />
                Akses stoker
              </span>
            </div>

            <div className="relative space-y-px overflow-hidden rounded-2xl border border-amber-400/15 bg-white/[0.015]">
              {/* PIC / VENDOR */}
              <div className="flex items-start gap-4 p-4 transition-colors hover:bg-amber-400/[0.04] sm:p-5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-300/20 to-amber-600/10">
                  <Icon
                    icon="solar:user-id-bold-duotone"
                    className="text-2xl text-amber-300"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/60">
                    PIC / Vendor
                  </p>
                  <p className="break-words text-base font-extrabold leading-snug tracking-tight text-white sm:text-lg">
                    {data?.vendor || "Belum diisi"}
                  </p>
                </div>
                {data?.vendor && (
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(data.vendor || "");
                      setVendorCopied(true);
                      setTimeout(() => setVendorCopied(false), 1500);
                    }}
                    title="Salin nama vendor"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-amber-400/20 bg-white/[0.03] text-amber-300/80 transition-all hover:border-amber-300/50 hover:bg-amber-400/10 hover:text-amber-200 active:scale-95"
                  >
                    <Icon
                      icon={
                        vendorCopied ? "solar:check-circle-bold" : "solar:copy-bold"
                      }
                      className="text-sm"
                    />
                  </button>
                )}
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-amber-400/20 to-transparent" />

              {/* LAMPIRAN */}
              <div className="p-4 sm:p-5">
                <div className="mb-3.5 flex items-center gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-300/20 to-amber-600/10">
                    <Icon
                      icon="solar:folder-with-files-bold-duotone"
                      className="text-2xl text-amber-300"
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/60">
                      Lampiran dokumen
                    </p>
                    <p className="text-sm font-extrabold text-white">
                      {lampiranList.length > 0
                        ? `${lampiranList.length} dokumen tersedia`
                        : "Belum ada lampiran"}
                    </p>
                  </div>
                </div>

                {lampiranList.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    {lampiranList.slice(0, 3).map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-amber-400/20 bg-gradient-to-br from-amber-400/[0.07] to-transparent px-3.5 py-3 text-amber-50 transition-all hover:border-amber-300/50 hover:from-amber-400/[0.14] active:scale-[0.98]"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-amber-400/30 bg-gradient-to-br from-amber-300/25 to-amber-600/10">
                          <Icon
                            icon="solar:paperclip-bold"
                            className="text-sm text-amber-300"
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold">
                            Dokumen {i + 1}
                          </span>
                          <span className="block truncate text-[10px] text-amber-200/50">
                            Buka lampiran
                          </span>
                        </div>
                        <Icon
                          icon="solar:arrow-right-up-linear"
                          className="shrink-0 text-sm opacity-40 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100"
                        />
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-3 text-xs text-white/35">
                    <Icon icon="solar:file-corrupted-linear" className="text-base" />
                    Tidak ada dokumen yang diunggah untuk listing ini.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ 2. RINGKASAN LELANG — SATU BARIS ══ */}
      <Bagian>
        <Judul ikon="mdi:gavel" aksen={AKSEN_SECTION_ASET.jadwal}>
          Ringkasan lelang
        </Judul>
        <StatStrip items={ringkasan} />
      </Bagian>

      {/* ══ 3. DESKRIPSI ══ */}
      {data?.deskripsi && (
        <Bagian>
          <Judul
            ikon="solar:document-text-bold-duotone"
            aksen={AKSEN_SECTION_ASET.deskripsi}
          >
            Tentang aset ini
          </Judul>
          <Deskripsi teks={data.deskripsi} />
        </Bagian>
      )}

      {/* ══ 4. LEGALITAS & STATUS ══ */}
      <Bagian>
        <Judul ikon="solar:shield-check-bold-duotone" aksen={AKSEN_SECTION_ASET.legal}>
          Legalitas &amp; status
        </Judul>
        <Kartu padat>
          <div className="px-5 py-2">
            <BarisFakta
              ikon="solar:document-add-bold-duotone"
              label="Jenis sertifikat"
              catatan={
                multiBidang ? (
                  <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    <span className={`font-bold ${AKSEN.emerald.teks}`}>
                      {bidangSertifikat.length} bidang
                    </span>
                    <span className="text-white/20">·</span>
                    <span className="text-white/45">ketuk untuk lihat semua nomor</span>
                  </span>
                ) : (
                  catatanSertifikat
                )
              }
              onKlik={bukaSertifikat}
              petunjuk={petunjukSertifikat}
              nilai={
                data?.legalitas ? (
                  <span className={AKSEN.emerald.teks}>{data.legalitas}</span>
                ) : (
                  <span className="text-white/40">Tanya agent</span>
                )
              }
              aksen={data?.legalitas ? AKSEN.emerald : undefined}
            />
            <BarisFakta
              ikon="solar:tag-horizontal-bold-duotone"
              label="Status properti"
              nilai={
                <span className={isSold ? "text-rose-300" : "text-emerald-300"}>
                  {data?.status_tayang || "TERSEDIA"}
                </span>
              }
              aksen={isSold ? AKSEN.rose : AKSEN.emerald}
            />
            <BarisFakta
              ikon="solar:calendar-date-bold-duotone"
              label="Tanggal lelang"
              catatan={
                sisaHari != null && sisaHari > 0 ? `${sisaHari} hari lagi` : undefined
              }
              nilai={formatTanggalLelang(data?.tanggal_lelang)}
              aksen={data?.tanggal_lelang ? aksenJadwal : undefined}
            />
            <BarisFakta
              ikon="solar:wallet-money-bold-duotone"
              label="Uang jaminan"
              catatan="Disetor sebelum ikut lelang"
              nilai={
                data?.uang_jaminan ? (
                  <span className={AKSEN.mint.teks}>
                    {formatRupiah(data.uang_jaminan)}
                  </span>
                ) : (
                  <span className="text-white/40">Tanya agent</span>
                )
              }
              aksen={data?.uang_jaminan ? AKSEN.mint : undefined}
            />

            {/* Tautan sumber — baris paling bawah, dan hanya untuk agent.
                Ditaruh terakhir karena ia satu-satunya baris yang MEMBAWA
                PEMBACA KELUAR dari halaman: menempatkannya di tengah membuat
                mata berhenti di sana sebelum sempat membaca jadwal & jaminan
                di bawahnya.

                `onKlik` sengaja tidak dipakai walau baris ini bisa ditekan:
                BarisFakta akan membungkus seluruh barisnya jadi <button>, dan
                <a> di dalam <button> adalah HTML yang tidak sah — di sebagian
                browser tautannya jadi tidak bisa dibuka di tab baru. Jadi yang
                interaktif hanya tombolnya sendiri. */}
            {linkSumber && (
              <BarisFakta
                ikon="solar:link-circle-bold-duotone"
                label="Link properti"
                nilai={
                  <a
                    href={linkSumber}
                    target="_blank"
                    // noopener wajib bersama target="_blank": tanpanya halaman
                    // tujuan bisa menyetir tab ini lewat window.opener.
                    rel="noopener noreferrer"
                    // Alamat lengkapnya pindah ke tooltip: barisnya kini cuma
                    // label + tombol, tapi agent yang ragu tetap bisa memastikan
                    // tujuannya tanpa harus menekan lebih dulu.
                    title={linkSumber}
                    // Sengaja seukuran teks nilai di baris-baris lain (bukan
                    // tombol setinggi 32px): begitu tingginya melebihi label di
                    // sebelah kiri, baris ini jadi lebih tinggi daripada Status
                    // & Uang jaminan, dan deretan yang tadinya rata terlihat
                    // seperti salah render. `leading-none` + py-1 menahan
                    // tingginya persis di sekitar tinggi satu baris teks.
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold uppercase leading-none tracking-wider transition-all duration-200 hover:bg-white/[0.06] active:scale-[0.97] ${AKSEN.sky.chip}`}
                  >
                    <Icon
                      icon="solar:square-arrow-right-up-bold"
                      className="text-[11px]"
                    />
                    Buka link
                  </a>
                }
                aksen={AKSEN.sky}
              />
            )}
          </div>
        </Kartu>
      </Bagian>

      {/* ══ 5. LOKASI & SEKITAR ══ */}
      <SekitarLokasi
        idProperty={data?.id_property}
        awal={data?.sekitar ?? null}
        latitude={data?.latitude}
        longitude={data?.longitude}
        alamatLengkap={data?.alamat_lengkap}
        wilayah={[data?.kelurahan, data?.kecamatan, data?.kota, data?.provinsi]}
        areaLokasi={data?.area_lokasi}
        aksesTerdekat={aksesTerdekat}
      />

      {/* ══ 6. RIWAYAT LELANG ══ */}
      <RiwayatLelang
        idProperty={data?.id_property}
        initialData={riwayatLelang}
        isLoggedIn={isLoggedIn}
      />

      {/* ══ 7. EDUKASI LELANG ══
          Isinya sama untuk semua aset, jadi tempatnya paling bawah dan
          bentuknya ringkas — pembaca yang sudah paham lelang tidak perlu
          menggulung tiga layar untuk melewatinya. */}
      <Bagian akhir>
        <Judul
          ikon="solar:lightbulb-bolt-bold-duotone"
          aksen={AKSEN.violet}
          keterangan="Berlaku umum untuk pembelian lewat lelang, bukan khusus aset ini."
        >
          Kenapa beli lewat lelang?
        </Judul>

        <div className="grid gap-3 md:grid-cols-3">
          {ALASAN_LELANG.map((a) => (
            <div
              key={a.judul}
              className={`rounded-2xl border p-4 ${LINE.card} ${a.aksen.wash}`}
            >
              <span
                className={`mb-3 grid h-10 w-10 place-items-center rounded-xl border ${a.aksen.kotak}`}
              >
                <Icon icon={a.ikon} className="text-xl" />
              </span>
              <h4 className="text-sm font-extrabold text-white">{a.judul}</h4>
              <p className="mt-1 text-xs leading-relaxed text-white/45">{a.isi}</p>
            </div>
          ))}
        </div>

        <Kartu className="mt-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${AKSEN.mint.kotak}`}
            >
              <Icon icon="solar:key-bold-duotone" className="text-2xl" />
            </span>
            <div className="min-w-0 flex-1">
              <h4 className="text-base font-extrabold text-white">
                Kami dampingi sampai serah terima kunci
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-white/45">
                Rumah masih ditempati atau dokumen bermasalah bukan urusan Anda
                sendiri — tim kami memastikan aset siap serah terima sesuai
                kesepakatan lelang.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {["Pendampingan legal", "Bantu eksekusi", "Garansi serah terima"].map(
                  (t) => (
                    <Chip key={t} ikon="solar:check-circle-bold" aksen={AKSEN.mint}>
                      {t}
                    </Chip>
                  ),
                )}
              </div>
            </div>
          </div>
        </Kartu>

        <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-white/25">
          <Icon icon="solar:info-circle-linear" className="mt-0.5 shrink-0 text-sm" />
          Untuk detail spesifik aset ini, konsultasikan dengan agent kami lewat tombol
          WhatsApp di panel sebelah.
        </p>
      </Bagian>

      {/* Daftar nomor sertifikat — dirender lewat portal, jadi posisinya di
          pohon JSX tidak berpengaruh pada tata letak halaman. */}
      {multiBidang && (
        <DaftarSertifikatSheet
          open={sertifikatTerbuka}
          onClose={() => setSertifikatTerbuka(false)}
          nomorLegalitas={data?.nomor_legalitas}
          jenis={data?.legalitas}
          luasTotal={data?.luas_tanah}
          kodeAset={
            data?.kode_properti && data.kode_properti !== "-"
              ? data.kode_properti
              : data?.id_property
          }
        />
      )}
    </div>
  );
}

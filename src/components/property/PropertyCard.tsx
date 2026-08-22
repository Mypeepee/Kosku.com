"use client";

/**
 * Kartu properti — SATU-SATUNYA bentuk kartu listing di seluruh situs.
 *
 * Sebelumnya kartu ini hidup di dalam src/app/Jual/produklist.tsx, dan halaman
 * detail sewa membuat kartunya SENDIRI untuk blok "Kos serupa". Dua kartu untuk
 * benda yang sama pasti menyimpang: yang satu punya slider foto, badge ID, Hot
 * Deal, sisa kamar & footer agent, yang satunya tidak — dan pencari kos yang
 * melompat dari daftar ke detail merasa masuk ke situs yang berbeda.
 *
 * Karena itu kartunya dipindah ke sini dan dipakai bersama oleh:
 *   • /Jual, /Lelang, /Sewa, /Carikos  (lewat ProductList)
 *   • blok "Kos serupa" di /Sewa/[id]  (SimilarProperties)
 *
 * Konsekuensinya disengaja: siapa pun yang mengubah tampilan kartu harus
 * mengubahnya di satu tempat, dan perubahan itu berlaku di semua halaman.
 */

import React, { useState } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { useSwipe } from "@/hooks/useSwipe";
import { HotDealBadge, HOT_DEAL_CARD_CLASS } from "@/components/HotDeal/HotDealBadge";
import { SliderDots } from "@/components/SliderDots";
import { AksesMarquee, Marquee } from "@/components/AksesMarquee";
import { KosChipRow } from "@/components/kos/KosChipRow";
import { KosPillBadge } from "@/components/kos/KosPillBadge";
import {
  buildFasilitasChips,
  pilihAksesUtama,
  type AksesTerdekat,
} from "@/lib/kosCard";

// --- TIPE DATA ---
export interface PropertyDB {
  /**
   * Longgar (string | number) karena tiap halaman menyerialkan BigInt Prisma
   * dengan caranya sendiri. Kartu tidak pernah membandingkan nilainya — hanya
   * menampilkan & menyusun URL — jadi memaksa satu bentuk cuma menambah
   * konversi di pemanggil tanpa manfaat.
   */
  id_property: string | number;
  slug: string;
  judul: string;
  kota: string;
  kecamatan?: string | null;
  kelurahan?: string | null;
  /**
   * Alamat selengkap yang dimiliki listing ("Desa Kertek, Kecamatan Kertek,
   * Kab. Wonosobo"). Untuk lelang ini bukan pelengkap: aset lelang tersebar
   * sampai ke pelosok kabupaten, dan "Kab. Deli Serdang" saja tidak cukup
   * untuk menilai apakah lokasinya masuk akal didatangi.
   */
  alamat_lengkap?: string | null;
  harga: number;
  /** Harga diskon. Opsional: listing lelang tidak mengenal harga promo. */
  harga_promo?: number | null;
  jenis_transaksi: string; // PRIMARY / SECONDARY / LELANG / SEWA
  kategori: string;
  status_tayang?: string; // TERSEDIA / TERJUAL / TARIK_LISTING
  gambar: string;
  foto_list: string[];
  luas_tanah: number;
  luas_bangunan: number;
  kamar_tidur: number;
  kamar_mandi: number;
  durasi_sewa?: string | null;
  // Spesifikasi khusus KOS — KT/KM/LT/LB tidak relevan untuk kos (memang tidak
  // diisi). Yang dicari calon penghuni: dekat mana, fasilitasnya apa, kamar
  // mandi dalam/luar, dan kos putra/putri.
  kamar_mandi_tipe?: string | null;
  kos_gender?: string | null;
  kamar_tersedia?: number | null;
  /**
   * Jumlah tipe kamar. Kos dengan >1 tipe punya harga berbeda per tipe, dan
   * `harga` di sini adalah yang TERMURAH — tanpa penanda "mulai", angkanya
   * terbaca sebagai harga semua kamar dan calon penghuni merasa dibohongi
   * saat menanyakan kamar mandi dalam.
   */
  jumlah_tipe_kamar?: number | null;
  fasilitas_kamar?: string | null;
  fasilitas_bersama?: string | null;
  akses_terdekat?: AksesTerdekat[] | null;
  /**
   * ISO string jadwal lelang. Untuk listing LELANG ini informasi yang paling
   * menentukan — ia tenggat, dan kartu menampilkannya sebagai hitung mundur,
   * bukan sekadar tanggal.
   */
  tanggal_lelang?: string | null;
  /**
   * Limit lelang tertinggi dari event SEBELUMNYA untuk aset fisik yang sama —
   * lihat src/lib/auctionDiscount.ts. Hanya terisi kalau memang lebih tinggi
   * dari limit sekarang, jadi card cukup memeriksa ada/tidaknya.
   */
  lelang_limit_awal?: number | null;
  // Spesifikasi khusus APARTEMEN SEWA. Sama seperti kos, grid KT/KM/LT/LB
  // salah alat untuk unit apartemen: luas tanah selalu kosong (unit tidak
  // punya lahan), dan yang benar-benar dipakai menyaring adalah tipe unitnya
  // (Studio/1BR/2BR), luas unit, dan sudah berperabot atau belum.
  tipe_unit?: string | null;
  kondisi_interior?: string | null;
  lantai_unit?: string | null;
  kapasitas_penghuni?: number | null;
  agent_name: string;
  agent_photo: string;
  agent_office: string;
  is_hot_deal: boolean;
  /**
   * Jarak ke tempat yang sedang dicari ("1,2 km dari UNESA").
   *
   * Hanya terisi saat halaman sedang menyaring "dekat X". Ditaruh di kartu,
   * bukan cuma di bilah filter di atas, karena inilah angka yang dipakai
   * pembaca untuk MEMBANDINGKAN — "dekat UNESA" berlaku untuk seluruh hasil,
   * yang membedakan satu kartu dari kartu lain justru jaraknya.
   */
  /**
   * Tempat-tempat yang cocok dengan pencarian "dekat X", TERDEKAT DULU.
   *
   * Hanya terisi saat halaman sedang menyaring "dekat X". Ditaruh di kartu,
   * bukan cuma di bilah filter di atas, karena inilah yang dipakai pembaca
   * untuk MEMBANDINGKAN — "dekat kampus" berlaku untuk seluruh hasil; yang
   * membedakan satu kartu dari kartu lain justru kampus mana dan berapa jauh.
   */
  jarak_tempat?: {
    daftar: Array<{
      nama: string;
      teks: string;
      /** True → ditampilkan dengan "±". Titik asetnya kasar atau angkanya
       *  klaim agent, bukan hasil ukur. */
      perkiraan: boolean;
    }>;
  } | null;
}

// --- CONSTANTS ---
const PROPERTY_ICONS: Record<string, string> = {
  RUMAH: "solar:home-2-bold-duotone",
  APARTEMEN: "solar:buildings-2-bold-duotone",
  GUDANG: "solar:box-minimalistic-bold-duotone",
  TANAH: "solar:map-point-wave-bold-duotone",
  PABRIK: "solar:garage-bold-duotone",
  RUKO: "solar:shop-2-bold-duotone",
  TOKO: "solar:shop-bold-duotone",
  HOTEL: "solar:bed-bold-duotone",
  VILLA: "solar:star-fall-bold-duotone",
  HOTEL_DAN_VILLA: "solar:bed-bold-duotone",
  KOS: "solar:bed-bold-duotone",
};

// --- UTILS ---
const formatDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const daysUntil = (iso?: string | null): number | null => {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
};

/**
 * Penanda jadwal lelang — empat tingkat menurut sisa waktu, bukan satu tanggal
 * datar.
 *
 * Lelang punya tenggat, dan tenggat itulah yang menentukan seseorang bertindak
 * hari ini atau menundanya sampai lewat. "15 Sep 2026" tidak memberi tahu apa
 * pun tanpa pembaca menghitung sendiri; "3 hari lagi" memberitahunya seketika.
 * Karena itu tampilannya berubah seiring mendekatnya hari-H — dan hanya lelang
 * yang benar-benar mendesak yang boleh memakai warna paling menyala, supaya
 * penanda merah tetap berarti saat ia muncul.
 */
function LelangBadge({ tanggal_lelang }: { tanggal_lelang?: string | null }) {
  const days = daysUntil(tanggal_lelang);
  if (days === null) return null;

  if (days <= 0)
    return (
      <span className="relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-50">
        <span className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 opacity-80 blur-[3px]" />
        <span className="absolute inset-[1px] rounded-full border border-amber-300/80 bg-gradient-to-r from-[#18181b] via-[#030712] to-[#111827] shadow-[0_0_22px_rgba(250,204,21,0.75)]" />
        <span className="relative inline-flex items-center gap-1.5">
          <Icon icon="solar:cup-star-bold-duotone" className="text-sm text-amber-200" />
          <span className="tracking-[0.2em]">PELUANG EMAS</span>
        </span>
      </span>
    );

  if (days <= 10)
    return (
      <span className="relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
        <span className="absolute inset-0 rounded-full bg-[conic-gradient(at_top,_#22c55e,_#f97316,_#ef4444,_#22c55e)] opacity-90 blur-[3px]" />
        <span className="absolute inset-[1px] rounded-full border border-red-400/80 bg-gradient-to-r from-black/80 via-black/70 to-black/80 shadow-[0_0_26px_rgba(248,113,113,0.8)]" />
        <span className="relative inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-red-400" />
          <Icon icon="solar:fire-bold-duotone" className="text-sm text-yellow-200" />
          {days} hari lagi
        </span>
      </span>
    );

  if (days <= 20)
    return (
      <span className="relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
        <span className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 opacity-80 blur-[2px]" />
        <span className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 opacity-70" />
        <span className="relative inline-flex items-center gap-1.5">
          <Icon icon="solar:fire-bold-duotone" className="text-sm text-yellow-100" />
          {days} hari lagi
        </span>
      </span>
    );

  return (
    <span className="relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-50">
      <span className="absolute inset-0 rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 opacity-70 blur-[3px]" />
      <span className="absolute inset-[1px] rounded-full border border-sky-300/70 bg-gradient-to-r from-[#020617] via-[#020617] to-[#022c22] shadow-[0_0_18px_rgba(56,189,248,0.7)]" />
      <span className="relative inline-flex items-center gap-1.5">
        <Icon icon="solar:calendar-bold-duotone" className="text-sm text-sky-200" />
        {formatDateShort(tanggal_lelang!)}
      </span>
    </span>
  );
}

/** "Rp 2 M" / "Rp 743,5 jt" — untuk angka yang menemani harga utama, bukan
 *  menggantikannya. Bentuk panjangnya menghabiskan ruang sebaris penuh. */
const formatRupiahSingkat = (n: number): string => {
  if (n >= 1_000_000_000) {
    const v = n / 1_000_000_000;
    return `Rp ${(v % 1 === 0 ? v : Number(v.toFixed(1))).toLocaleString("id-ID")} M`;
  }
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `Rp ${(v % 1 === 0 ? v : Number(v.toFixed(1))).toLocaleString("id-ID")} jt`;
  }
  if (n >= 1_000) return `Rp ${Math.round(n / 1_000)} rb`;
  return `Rp ${n.toLocaleString("id-ID")}`;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

const getBadgeColor = (type: string) => {
  const t = type?.toUpperCase();
  if (t === "PRIMARY") return "bg-blue-500 shadow-blue-500/20";
  if (t === "SECONDARY") return "bg-violet-500 shadow-violet-500/20";
  if (t === "LELANG") return "bg-amber-500 shadow-amber-500/20";
  if (t === "SEWA") return "bg-emerald-500 shadow-emerald-500/20";
  return "bg-gray-500 shadow-gray-500/20";
};

const getPropertyIcon = (kategori: string): string => {
  const key = kategori?.trim().toUpperCase();
  return PROPERTY_ICONS[key] || "solar:home-2-bold-duotone";
};

/**
 * URL halaman detail sesuai jenis transaksinya.
 *
 * LELANG wajib punya cabangnya sendiri: halaman /properti/[slug] ("Semua")
 * mencampur ketiga jenis dalam satu grid, dan tanpa cabang ini seluruh listing
 * lelang — bagian terbesar isi halaman itu — akan diarahkan ke /Jual/… yang
 * tidak ada. Di /Jual & /Sewa cabangnya memang tidak pernah terpakai karena
 * datanya sudah tersaring, jadi menambahkannya tidak mengubah apa pun di sana.
 */
export const getPropertyUrl = (property: PropertyDB): string => {
  const transactionType = property.jenis_transaksi?.toUpperCase();
  const urlPath =
    transactionType === "SEWA"
      ? "Sewa"
      : transactionType === "LELANG"
        ? "Lelang"
        : "Jual";
  const baseSlug = property.slug || "property";
  const slugWithId = `${baseSlug}-${property.id_property}`;
  return `/${urlPath}/${slugWithId}`;
};

// --- CARD ---
export const PropertyCard = ({ item }: { item: PropertyDB }) => {
  const kategoriUpper = item.kategori?.trim().toUpperCase() || "";

  const images =
    item.foto_list && item.foto_list.length > 0
      ? item.foto_list
      : [item.gambar || "/images/hero/banner.jpg"];

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const currentImage = images[currentImageIndex];
  const [idCopied, setIdCopied] = useState(false);
  const idBadge = String(item.id_property);

  const nextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const swipe = useSwipe(nextImage, prevImage);

  const hasDiscount =
    item.harga_promo != null &&
    item.harga_promo > 0 &&
    item.harga_promo < item.harga;

  const discountPercent = hasDiscount
    ? Math.round(((item.harga - item.harga_promo!) / item.harga) * 100)
    : 0;

  const mainPrice = hasDiscount ? item.harga_promo! : item.harga;
  const isSewa = item.jenis_transaksi?.toUpperCase() === "SEWA";
  const DURASI_SUFFIX: Record<string, string> = {
    HARIAN: "/hari",
    MINGGUAN: "/minggu",
    BULANAN: "/bulan",
    TAHUNAN: "/tahun",
  };
  const periodSuffix = isSewa ? (
    <span className="text-gray-500 text-xs font-medium">
      {" "}
      {DURASI_SUFFIX[item.durasi_sewa?.toUpperCase() || ""] || "/bulan"}
    </span>
  ) : null;

  const isSold = item.status_tayang?.toUpperCase() === "TERJUAL";
  const soldLabel = isSewa ? "Tersewa" : "Terjual";
  const isKos = kategoriUpper === "KOS";

  /**
   * Apartemen yang DISEWAKAN dibaca dengan mata yang sama seperti kos, bukan
   * seperti rumah dijual. Grid KT/KM/LT/LB salah alat untuknya: luas tanah
   * selalu kosong (satu unit tidak punya lahan), dan "KT 1 / KM 1" tidak
   * menjawab pertanyaan pertama penyewa apartemen — "ini Studio atau 2BR,
   * berapa meter, sudah berperabot belum?".
   *
   * Apartemen DIJUAL tetap memakai grid: di sana pembeli memang membandingkan
   * luas bangunan & jumlah kamar seperti properti lain.
   */
  const isApartemenSewa = isSewa && kategoriUpper === "APARTEMEN";

  /** Kos & apartemen sewa sama-sama memakai tata letak "chip", bukan grid. */
  const pakaiTataLetakSewa = isKos || isApartemenSewa;

  /**
   * Lelang juga punya tata letaknya sendiri, dan alasannya sama seperti kos:
   * KT/KM/LT/LB salah alat. Aset lelang mayoritas dilelang sebagai BIDANG
   * TANAH ("4 bidang tanah total 6307 m² berikut bangunan"), jadi kamar tidur,
   * kamar mandi & luas bangunan hampir selalu kosong. Grid empat kolom yang
   * tiga di antaranya berisi "–" bukan cuma jelek — ia menenggelamkan dua
   * satu-satunya hal yang menentukan: LUASNYA dan KAPAN lelangnya.
   */
  const isLelang = item.jenis_transaksi?.toUpperCase() === "LELANG";

  /**
   * Aset yang dilelang ulang lebih murah — sinyal FOMO paling jujur yang
   * dimiliki listing lelang, karena angkanya berasal dari event lelang nyata,
   * bukan diskon yang dikarang.
   *
   * Ambang 1%: pembulatan limit antar event kadang menghasilkan selisih
   * beberapa ribu rupiah pada aset milyaran. "↓0%" bukan cuma tidak berguna,
   * ia membuat penanda turun harga kehilangan arti saat benar-benar muncul.
   */
  const turunLelang = (() => {
    if (!isLelang) return null;
    const awal = item.lelang_limit_awal ?? 0;
    if (!awal || awal <= mainPrice) return null;
    const persen = Math.round(((awal - mainPrice) / awal) * 100);
    if (persen < 1) return null;

    /**
     * Tiga tingkat, dan pembedanya BUKAN selera — melainkan efek isolasi (Von
     * Restorff): yang diingat adalah satu hal yang menonjol di antara yang
     * seragam. Di halaman lelang, 8 dari 12 card menampilkan penanda ini; kalau
     * semuanya berdenyut, tidak ada yang menonjol dan semuanya jadi kebisingan
     * yang otomatis diabaikan mata (banner blindness).
     *
     * Maka denyut cahaya HANYA untuk diskon ≥40%. Dengan begitu intensitas
     * visual mengkodekan besaran — pengunjung belajar memindai yang menyala,
     * dan penanda itu tetap berarti setiap kali muncul.
     */
    const tingkat = persen >= 40 ? "besar" : persen >= 20 ? "sedang" : "kecil";
    return { limitAwal: awal, persen, tingkat };
  })();

  // Kos multi-tipe: harga yang tersimpan adalah tipe termurah, jadi diberi
  // awalan "mulai" — satu angka tanpa penanda akan dibaca sebagai harga
  // seluruh kamar.
  const hargaMulaiDari = isKos && (item.jumlah_tipe_kamar ?? 0) > 1;

  /**
   * Alamat selengkap yang dimiliki listing, bukan kotanya saja.
   *
   * Untuk lelang ini menentukan: asetnya tersebar sampai pelosok kabupaten,
   * dan "Kab. Deli Serdang" saja tidak cukup untuk menilai apakah lokasinya
   * masuk akal didatangi — sedangkan "Desa Kertek, Kecamatan Kertek, Kab.
   * Wonosobo" langsung menjawabnya.
   *
   * Urutannya bertingkat, bukan satu sumber: `alamat_lengkap` dipakai kalau
   * ada, kalau tidak dirakit dari kelurahan/kecamatan/kota, dan kota jadi
   * jaring terakhir. Dengan begitu listing lama yang alamatnya belum lengkap
   * tetap menampilkan sesuatu yang berguna, bukan kosong.
   */
  const alamatRakitan =
    [item.kelurahan, item.kecamatan, item.kota].filter(Boolean).join(", ") ||
    item.kota;

  // Kos & apartemen sewa TIDAK memakai alamat_lengkap sekalipun tersedia, dan
  // itu disengaja: alamat jalan sebuah kos adalah tempat tinggal orang, bukan
  // aset yang dipajang. Kelurahan/kecamatan sudah cukup untuk menilai jarak,
  // dan menahannya di sini juga membuat kos tampil sama di /Sewa (yang tidak
  // mengirim alamat_lengkap) maupun di halaman "Semua" (yang mengirimnya).
  const lokasiLabel = pakaiTataLetakSewa
    ? alamatRakitan
    : item.alamat_lengkap?.trim() || alamatRakitan;

  const aksesList = pakaiTataLetakSewa ? pilihAksesUtama(item.akses_terdekat) : [];

  const sisaKamar = isKos ? item.kamar_tersedia ?? null : null;

  /**
   * Spesifikasi utama unit apartemen, URUT sesuai yang dicari penyewa:
   * tipe unit → luas → berperabot → kapasitas/lantai.
   *
   * Tipe unit lebih dulu karena itulah cara penyewa apartemen menyebut
   * kebutuhannya ("cari 2BR di Surabaya Barat") dan filter nomor satu di
   * Travelio/Jendela360. Luas tanah sengaja tidak ada di daftar ini sama
   * sekali — bukan disembunyikan saat kosong, memang tidak berlaku.
   */
  const TIPE_UNIT_SINGKAT: Record<string, string> = {
    STUDIO: "Studio",
    SATU_KAMAR: "1BR",
    DUA_KAMAR: "2BR",
    TIGA_KAMAR: "3BR",
    EMPAT_KAMAR_PLUS: "4BR+",
  };

  const specApartemen = isApartemenSewa
    ? ([
        item.tipe_unit
          ? TIPE_UNIT_SINGKAT[item.tipe_unit.toUpperCase()] ?? item.tipe_unit
          : item.kamar_tidur > 0
            ? `${item.kamar_tidur}BR`
            : null,
        item.luas_bangunan > 0 ? `${item.luas_bangunan} m²` : null,
        // Listing lama menyimpan "Bare"; form sekarang menyimpan "Kosongan".
        // Diterjemahkan di sini supaya tidak ada label berbahasa Inggris yang
        // menyelip di antara label Indonesia.
        item.kondisi_interior
          ? /^bare$/i.test(item.kondisi_interior)
            ? "Kosongan"
            : item.kondisi_interior
          : null,
        item.kamar_mandi > 0 ? `${item.kamar_mandi} KM` : null,
        item.lantai_unit ? `Lt. ${item.lantai_unit}` : null,
        item.kapasitas_penghuni ? `${item.kapasitas_penghuni} org` : null,
      ].filter(Boolean) as string[])
        // Maksimal 3, dan itu batas yang disengaja.
        //
        // Daftar di atas urut prioritas, jadi tiga teratas persis tiga hal yang
        // dipakai penyewa apartemen menyaring: tipe unit, luas, dan sudah
        // berperabot atau belum. Sisanya baru dibaca setelah unitnya masuk
        // daftar pendek — dan untuk itu ada halaman detail. Urutannya juga jadi
        // cadangan bertingkat: kalau kondisi interior belum diisi agent, slot
        // ketiga jatuh ke jumlah kamar mandi, bukan dibiarkan kosong.
        .slice(0, 3)
    : [];

  // Gender ikut turun ke deret chip hanya kalau pill kanan sudah dipakai angka
  // sisa kamar — supaya kos putra/putri tidak pernah hilang tapi juga tidak
  // tampil dua kali.
  const { labelChips, iconChips } = pakaiTataLetakSewa
    ? buildFasilitasChips({
        kamarMandiTipe: isKos ? item.kamar_mandi_tipe : null,
        fasilitasKamar: item.fasilitas_kamar,
        fasilitasBersama: item.fasilitas_bersama,
        gender: item.kos_gender,
        sertakanGender: sisaKamar != null,
      })
    : { labelChips: [], iconChips: [] };

  /**
   * Spesifikasi apartemen menempati slot label di AWAL baris chip — slot yang
   * sama dengan "KM Luar"/"Campur" pada kos, bukan barisnya sendiri.
   *
   * Dua keuntungan sekaligus. Pertama, kartu apartemen kehilangan satu baris
   * penuh sehingga tingginya kembali setara kartu kos di sebelahnya; karena
   * tinggi diseragamkan per baris grid, satu baris berlebih pada kartu
   * tertinggi berubah jadi ruang kosong di SEMUA kartu lain. Kedua, KosChipRow
   * mengukur lebar sebenarnya dan mengisi sisa ruang dengan ikon sebanyak yang
   * muat — jadi spesifikasi tidak pernah tergusur, dan "+N" tetap jujur.
   *
   * Ikon pada ketiga label ini sengaja dilepas: di ukuran chip 10px, ikon
   * hanya menambah lebar tanpa menambah arti — "Studio" dan "28 m²" sudah
   * menjelaskan dirinya sendiri.
   */
  const labelChipsTampil = isApartemenSewa
    ? specApartemen.map((label) => ({ label }))
    : labelChips;

  return (
    <div className={`bg-[#111111] rounded-3xl overflow-hidden group transition-all duration-300 flex flex-col h-full ${item.is_hot_deal ? HOT_DEAL_CARD_CLASS : "border border-white/5 hover:border-emerald-400/70 hover:shadow-[0_24px_70px_-30px_rgba(16,185,129,0.7)]"}`}>
      {/* IMAGE */}
      <div
        className="relative w-full h-60 md:h-64 overflow-hidden"
        {...(images.length > 1 ? swipe : {})}
      >
        <Image
          key={currentImage}
          src={currentImage}
          alt={item.judul}
          fill
          className={`object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05] ${
            isSold ? "grayscale" : ""
          }`}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 33vw"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/0" />

        {isSold && (
          <div className="absolute inset-0 z-10 bg-black/55 flex items-center justify-center">
            <span className="text-red-500 font-bold text-lg md:text-xl uppercase tracking-widest border-2 border-red-500/70 px-5 py-1.5 rounded-lg backdrop-blur-sm">
              {soldLabel}
            </span>
          </div>
        )}

        {images.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/60 hover:bg-black/90 text-white rounded-full flex items-center justify-center z-20 transition-all lg:opacity-0 lg:group-hover:opacity-100"
            >
              <Icon icon="solar:alt-arrow-left-linear" className="text-lg" />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/60 hover:bg-black/90 text-white rounded-full flex items-center justify-center z-20 transition-all lg:opacity-0 lg:group-hover:opacity-100"
            >
              <Icon icon="solar:alt-arrow-right-linear" className="text-lg" />
            </button>

            <SliderDots
              total={images.length}
              index={currentImageIndex}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20"
            />
          </>
        )}

        {/* Pojok kanan atas.
            Kos → slot khusus kos (putra/putri). Di halaman Sewa semua listing
            sudah pasti SEWA, jadi pill "SEWA" nol informasi dan slot kiri
            dipakai kategori.
            Non-kos → kategori, posisi TETAP baik ada/tidak Hot Deal. */}
        {isKos ? (
          <KosPillBadge
            kamarTersedia={sisaKamar}
            gender={item.kos_gender}
            className="absolute top-3 right-3 z-20"
          />
        ) : (
          <span className="absolute top-3 right-3 z-20 bg-black/70 backdrop-blur-sm border border-white/10 text-white text-[10px] font-semibold px-3 py-1.5 rounded-full inline-flex items-center gap-1.5">
            <Icon
              icon={getPropertyIcon(item.kategori)}
              className="text-sm opacity-90"
            />
            {kategoriUpper}
          </span>
        )}

        {/* BADGE BAR kiri — Hot Deal paling atas (bikin FOMO) + kategori (kos)
            atau tipe transaksi (non-kos) */}
        <div className="absolute top-3 left-3 z-20 flex flex-col items-start gap-2 max-w-[calc(100%-6.5rem)]">
          {item.is_hot_deal && <HotDealBadge />}
          <span
            className={`${getBadgeColor(
              item.jenis_transaksi
            )} text-white text-[10px] font-semibold px-3 py-1.5 rounded-full shadow-md uppercase tracking-wide inline-flex items-center gap-1`}
          >
            <Icon
              icon={
                isKos ? getPropertyIcon(item.kategori) : "solar:star-bold-duotone"
              }
              className="text-xs opacity-90"
            />
            {isKos ? kategoriUpper : item.jenis_transaksi}
          </span>
        </div>

        {/* Hitung mundur lelang — tepat di bawah pill kategori, sisi kanan yang
            sama, supaya keduanya terbaca sebagai satu kolom keterangan dan
            tidak bertabrakan dengan Hot Deal di kiri. Ini penanda paling
            menyala di seluruh kartu, dan memang seharusnya: tenggat adalah
            alasan orang membuka listing lelang sejak awal. */}
        {isLelang && item.tanggal_lelang && (
          <div className="absolute right-3 top-14 z-20 flex max-w-[calc(100%-1.5rem)] justify-end">
            <LelangBadge tanggal_lelang={item.tanggal_lelang} />
          </div>
        )}

        {/* Kode properti — pojok kiri bawah.
            Ini metadata, bukan judul. Versi sebelumnya berbentuk sobekan tiket
            (blok hijau pekat "ID" + blok hitam solid) yang berteriak selantang
            pill kategori, padahal nyaris tidak pernah dibaca — ia hanya dipakai
            saat seseorang menyebut listing ke agent lewat WhatsApp.

            Sekarang satu keping kaca: latar tembus + blur, garis rambut 1px,
            angka monospace berawalan "#". Ia menumpang pada gelapnya gradien
            foto alih-alih menutupinya, jadi tetap terbaca di atas foto seterang
            apa pun tanpa menuntut perhatian.

            Ikon salin sengaja TIDAK disembunyikan sampai hover: di ponsel hover
            tidak ada, dan tombol yang afordansinya cuma muncul saat hover sama
            saja dengan tidak ada bagi separuh pengunjung. Ia tampil samar, lalu
            menegas saat disentuh. */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            navigator.clipboard.writeText(idBadge);
            setIdCopied(true);
            setTimeout(() => setIdCopied(false), 2000);
          }}
          title={idCopied ? "Kode tersalin" : "Salin kode properti"}
          aria-label={`Salin kode properti ${idBadge}`}
          className="group/id absolute bottom-3 left-3 z-30 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 active:scale-95"
        >
          <span
            className={`font-mono text-[11px] font-medium tabular-nums tracking-wider transition-colors duration-200 ${
              idCopied ? "text-emerald-300" : "text-white/45 group-hover/id:text-white/80"
            }`}
            // Tanpa kotak, keterbacaan sepenuhnya bergantung pada bayangan ini:
            // foto bisa saja terang benderang di sudut itu. Dua lapis — satu
            // rapat untuk ketajaman huruf, satu lebar sebagai peredam.
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.7)" }}
          >
            <span className={idCopied ? "text-emerald-400/60" : "text-white/25"}>
              #
            </span>
            {idBadge}
          </span>
          {/* Ikon salin tetap tampil (tidak menunggu hover): di ponsel hover
              tidak ada, dan afordansi yang cuma muncul saat hover sama saja
              dengan tidak ada bagi separuh pengunjung. Lebarnya tetap & hanya
              ikonnya yang berganti, supaya angka di sebelahnya tidak bergeser
              saat disalin. */}
          <Icon
            icon={idCopied ? "solar:check-circle-bold" : "solar:copy-bold-duotone"}
            className={`shrink-0 text-[12px] transition-all duration-200 ${
              idCopied
                ? "scale-110 text-emerald-300"
                : "text-white/30 group-hover/id:text-white/70"
            }`}
            style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.95))" }}
          />
        </button>
      </div>

      {/* CONTENT */}
      {/* Jarak antar blok sengaja rapat (gap-2). Tinggi kartu diseragamkan
          dalam satu baris grid, jadi setiap piksel berlebih pada kartu
          TERTINGGI berubah jadi ruang kosong di semua kartu lain — kerapatan
          di sini membayar dirinya sendiri berkali-kali. */}
      <div className="p-5 flex flex-col flex-grow gap-2">
        {/* Harga — SATU baris, selalu.
            `whitespace-nowrap` + `min-w-0` pada bagian sekunder: kalau ruang
            habis, yang menyusut adalah harga lama & chip, bukan barisnya yang
            membungkus jadi dua. Tinggi card diseragamkan per baris grid, jadi
            satu baris tambahan di sini akan jadi ruang kosong di semua card
            lain — persis hal yang berulang kali kita perbaiki.

            Untuk promo biasa (harga_promo) harga lama TETAP tidak ditampilkan:
            di card ~300px ia tidak muat bersama harga utama, dan persen diskon
            sudah cukup memberi sinyalnya. */}
        <h3 className="flex items-baseline gap-2 whitespace-nowrap text-white text-xl font-black tracking-tight">
          <span className="shrink-0">
            {hargaMulaiDari && (
              <span className="mr-1.5 align-middle text-[11px] font-bold uppercase tracking-wider text-gray-500">
                mulai
              </span>
            )}
            {formatCurrency(mainPrice)}
            {periodSuffix}
          </span>

          {hasDiscount && (
            <span className="shrink-0 text-[11px] font-bold leading-none text-rose-400">
              −{discountPercent}%
            </span>
          )}

          {/* Lelang ulang: limit sebelumnya dicoret + berapa persen turunnya.
              Angka lamanya dipendekkan ("Rp 2 M", bukan "Rp 2.000.000.000") —
              bentuk panjang menghabiskan ~150px dan pasti mendorong barisnya
              membungkus. Yang ingin disampaikan memang besarannya, bukan
              rupiah tepatnya.

              Urutannya disengaja: persen turun lebih dulu (paling kuat, paling
              sempit), harga coret menyusul dan boleh terpotong lebih dulu
              kalau card benar-benar sempit. */}
          {/* Urutan animasinya menirukan urutan orang menyadari sebuah diskon,
              dan sengaja begitu:

              1. (220ms) chip persen MASUK dengan sedikit melewati ukurannya —
                 gerak adalah isyarat pra-atensi terkuat, jadi mata sampai ke
                 sini lebih dulu daripada ke teks mana pun.
              2. (480ms) coretan pada harga lama DIGAMBAR kiri→kanan. Ini beat
                 psikologis yang sebenarnya: pengunjung melihat angka yang
                 lebih tinggi DIBATALKAN di depan matanya, bukan menemukannya
                 sudah tercoret. Jangkar (anchoring) jadi peristiwa, bukan
                 keterangan.
              3. Setelah itu DIAM — kecuali diskon ≥40%, yang cahayanya terus
                 bernapas pelan.

              Semua dimatikan lewat `motion-reduce:` untuk pengunjung yang
              menyetel "kurangi gerak" di sistemnya; bagi mereka gerak seperti
              ini bisa memicu pusing, dan informasinya toh tetap utuh tanpa
              animasi. */}
          {turunLelang && (
            <span className="flex min-w-0 items-baseline gap-1.5 overflow-hidden">
              <span
                // `isolate` mengurung lapisan cahaya -z-10 di dalam chip ini.
                // Tanpanya, lapisan itu bisa jatuh ke belakang latar card dan
                // hilang sama sekali.
                className={`relative isolate shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-black leading-none animate-fomo-masuk motion-reduce:animate-none ${
                  turunLelang.tingkat === "besar"
                    ? "bg-rose-500/25 text-rose-200 ring-1 ring-rose-400/40"
                    : turunLelang.tingkat === "sedang"
                      ? "bg-rose-500/15 text-rose-300"
                      : "bg-rose-500/10 text-rose-300/80"
                }`}
              >
                {/* Cahaya di BELAKANG chip, bukan border yang berkedip: yang
                    dianimasikan cuma opacity satu lapisan blur, sehingga tidak
                    memicu repaint pada teks di atasnya. */}
                {turunLelang.tingkat === "besar" && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -inset-1 -z-10 rounded-lg bg-rose-500/40 blur-md animate-fomo-nyala motion-reduce:animate-none"
                  />
                )}
                ↓{turunLelang.persen}%
              </span>

              {/* Coretan digambar sendiri (bukan `line-through`) supaya bisa
                  dianimasikan. `origin-left` + scaleX = gerak dari kiri ke
                  kanan seperti orang mencoret dengan tangan. */}
              {/* <s> dipertahankan demi maknanya (harga yang sudah tidak
                  berlaku), tapi garis bawaannya dimatikan — garis yang tampil
                  adalah yang dianimasikan di bawah ini. Pembaca layar tetap
                  mendengar angka ini sebagai harga yang dicoret. */}
              <s className="relative shrink truncate text-[11px] font-semibold leading-none text-gray-500 no-underline">
                {formatRupiahSingkat(turunLelang.limitAwal)}
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-1/2 h-px origin-left -translate-y-1/2 bg-gray-500 animate-fomo-coret motion-reduce:animate-none motion-reduce:scale-x-100"
                />
              </s>
            </span>
          )}
        </h3>

        <h4
          className="text-gray-100 text-sm md:text-base font-semibold line-clamp-2 group-hover:text-primary transition-colors"
          title={item.judul}
        >
          {item.judul}
        </h4>

        <div className="flex items-start gap-2 text-xs text-gray-400">
          <Icon
            icon="solar:map-point-wave-bold"
            className="text-primary text-base shrink-0 mt-0.5"
          />
          <span className="line-clamp-1" title={lokasiLabel}>
            {lokasiLabel}
          </span>
        </div>

        {/* Jarak ke tempat yang dicari — baris sendiri di bawah alamat, dan
            BERJALAN, bukan menumpuk.

            Aset sering dekat ke beberapa tempat sekaligus (kos di Dharmahusada
            dekat ke Unair maupun Universitas Ciputra), dan nama tempat itu
            panjang. Ditumpuk vertikal, dua tempat saja sudah memakan dua baris
            dan tinggi kartu melompat-lompat di dalam grid; dipotong jadi satu,
            alasan kedua yang mungkin justru lebih penting bagi pembacanya
            hilang. Satu baris berjalan: semuanya terbaca, tinggi kartu tetap. */}
        {item.jarak_tempat && item.jarak_tempat.daftar.length > 0 && (
          <div className="mt-2">
            <Marquee>
              {item.jarak_tempat.daftar.map((t) => (
                <span
                  key={`${t.nama}-${t.teks}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[10px] font-medium text-emerald-200"
                >
                  <Icon
                    icon="solar:map-arrow-square-bold-duotone"
                    className="shrink-0 text-xs text-emerald-400"
                  />
                  <span className="whitespace-nowrap">
                    <span className="font-bold text-emerald-300">
                      {t.perkiraan ? "±" : ""}
                      {t.teks}
                    </span>{" "}
                    dari {t.nama}
                  </span>
                </span>
              ))}
            </Marquee>
          </div>
        )}

        {/* Specs — tiga bentuk, karena tiga jenis pembaca:

            SEWA (kos & apartemen) → dekat apa, dapat apa. Keduanya memakai
            SUSUNAN yang persis sama (patokan + baris chip); yang berbeda hanya
            isi slot labelnya: kos menaruh "KM Luar"/"Campur", apartemen
            menaruh "Studio"/"28 m²"/"Semi Furnished". Menyatukan susunannya
            membuat tinggi kedua kartu setara — syarat agar grid yang tingginya
            diseragamkan tidak menyisakan ruang kosong.

            LELANG → luas tanah & tanggal lelang. Dua itu saja: aset lelang
            dilelang sebagai bidang tanah, jadi KT/KM/LB memang kosong.

            Lainnya → KT/KM/LT/LB seperti biasa (properti dijual). */}
        {pakaiTataLetakSewa ? (
          <div className="flex flex-col gap-2">
            <AksesMarquee items={aksesList} />

            <KosChipRow labelChips={labelChipsTampil} iconChips={iconChips} />
          </div>
        ) : isLelang ? (
          <div className="rounded-2xl border border-white/5 bg-white/5 p-3">
            {/* Dua kolom lebar sama dengan pemisah di tengah. Dibanding grid
                empat kolom, tiap nilai dapat ruang dua kali lipat — angka
                sepanjang "6.307 m²" dan "15 Sep 2026" muat utuh tanpa
                terpotong, bahkan di kolom grid tersempit. */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Icon
                  icon="solar:ruler-angular-bold"
                  className="shrink-0 text-base text-gray-400"
                />
                <div className="min-w-0">
                  <span className="block text-[10px] uppercase tracking-wide text-gray-500">
                    Luas Tanah
                  </span>
                  <span className="block truncate text-xs font-bold text-white">
                    {item.luas_tanah
                      ? `${item.luas_tanah.toLocaleString("id-ID")} m²`
                      : "-"}
                  </span>
                </div>
              </div>

              <span className="h-8 w-px bg-white/10" />

              <div className="flex min-w-0 items-center gap-2">
                <Icon
                  icon="solar:calendar-date-bold"
                  className="shrink-0 text-base text-red-400"
                />
                <div className="min-w-0">
                  <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-500">
                    <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" />
                    Lelang
                  </span>
                  <span className="block truncate text-xs font-bold text-white">
                    {item.tanggal_lelang
                      ? formatDateShort(item.tanggal_lelang)
                      : "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
              <div className="flex flex-col gap-0.5">
                <span className="text-gray-500">KT</span>
                <span className="text-white font-semibold inline-flex justify-center items-center gap-1">
                  <Icon
                    icon="solar:bed-bold"
                    className="text-xs text-gray-400"
                  />
                  {item.kamar_tidur || "-"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-gray-500">KM</span>
                <span className="text-white font-semibold inline-flex justify-center items-center gap-1">
                  <Icon
                    icon="solar:bath-bold"
                    className="text-xs text-gray-400"
                  />
                  {item.kamar_mandi || "-"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-gray-500">LT</span>
                <span className="text-white font-semibold">
                  {item.luas_tanah || "-"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-gray-500">LB</span>
                <span className="text-white font-semibold">
                  {item.luas_bangunan || "-"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* footer agent */}
        <div className="mt-auto pt-3 flex items-center justify-between gap-3 border-t border-white/5">
          {/* min-w-0 wajib di SETIAP tingkat flex sampai ke teksnya — item flex
              punya min-width:auto secara bawaan, jadi tanpa ini `truncate` di
              dalamnya tidak pernah aktif dan nama panjang malah membungkus
              sampai 4 baris. */}
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="relative w-8 h-8 rounded-full overflow-hidden border border-white/15 shrink-0">
              <Image
                src={item.agent_photo || "/images/user/user-01.png"}
                alt="Agent"
                fill
                sizes="32px"
                className="object-cover"
              />
            </div>
            <div className="flex min-w-0 flex-col">
              <span
                className="truncate text-[11px] font-semibold text-gray-100 leading-tight"
                title={item.agent_name}
              >
                {item.agent_name}
              </span>
              <span
                className="truncate text-[10px] text-gray-500 leading-tight"
                title={item.agent_office}
              >
                {item.agent_office}
              </span>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-primary flex items-center gap-1 shrink-0">
            Lihat detail
            <Icon icon="solar:arrow-right-linear" className="text-sm" />
          </span>
        </div>
      </div>
    </div>
  );
};

export default PropertyCard;

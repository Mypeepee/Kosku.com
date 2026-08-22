// app/Lelang/[slug]/DetailClient.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";

import ImageGallery from "./[agentId]/components/ImageGalleryLelang";
import DetailInfo from "./[agentId]/components/DetailInfoLelang";
import type { AuctionHistoryResult } from "@/lib/auctionHistory";
import BookingSidebar from "./[agentId]/components/AgentSidebarLelang";
import SimilarProperties from "./[agentId]/components/SimilarPropertiesLelang";
import type { PropertyItem } from "@/app/properti/[slug]/types";
import type { SekitarAwal } from "@/components/property/detail/useSekitar";
import KeperluanAgent from "./[agentId]/components/KeperluanAgent";
import ShareListingModal from "./[agentId]/components/ShareListingModal";
import MarkSoldControl from "@/components/property/MarkSoldControl";
import type { ListingStatus } from "@/lib/listingStatusPermission";

interface ProductData {
  id_property: string;
  /** Pemegang listing dari DB — penentu siapa yang boleh menandainya terjual. */
  id_agent?: string | null;
  agent_id?: string | null;
  kode_properti?: string | null;
  slug?: string;
  judul: string;
  kota: string;
  harga: number | string;
  harga_promo?: number | string | null;
  deskripsi: string | null;
  alamat_lengkap: string;
  area_lokasi?: string | null;
  kelurahan?: string | null;
  kecamatan?: string | null;
  provinsi?: string | null;
  gambar: string | null;
  foto_list?: string[];
  kamar_tidur: number | null;
  kamar_mandi: number | null;
  luas_tanah: number | null;
  luas_bangunan: number | null;
  jumlah_lantai?: number | null;
  daya_listrik?: number | null;
  sumber_air?: string | null;
  hadap_bangunan?: string | null;
  kondisi_interior?: string | null;
  legalitas?: string | null;
  nomor_legalitas?: string | null;
  vendor?: string | null;
  lampiran?: string | null;
  /** Tautan pengumuman lelang di sumber aslinya (lelang.go.id / situs vendor). */
  link?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Patokan lokasi yang diisi agent — dipakai bagian "Lokasi & sekitar". */
  akses_terdekat?: unknown;
  kategori: string;
  jenis_transaksi: string;
  status_tayang?: string | null;
  is_hot_deal?: boolean | null;
  dilihat?: number | null;
  tanggal_lelang?: string | null;
  uang_jaminan?: number | string | null;
  nilai_limit_lelang?: number | string | null;
  agent_photo?: string;

  agent?: {
    id_agent?: string | null;
    nama_kantor?: string | null;
    rating?: number | null;
    jumlah_closing?: number | null;
    nomor_whatsapp?: string | null;
    kota_area?: string | null;
    jabatan?: string | null;
    foto_profil_url?: string | null;
    pengguna?: {
      nama_lengkap?: string | null;
      foto_profil_url?: string | null;
      nomor_telepon?: string | null;
      email?: string | null;
    } | null;
  } | null;
}

export interface PresentingAgent {
  id_agent: string;
  nama: string;
  kantor: string;
  rating: number;
  jumlah_closing: number;
  whatsapp: string;
  telepon: string;
  kota_area: string;
  jabatan: string;
  foto_url: string;
  email: string;
}

interface DetailClientProps {
  product: ProductData;
  fotoArray: string[];
  similarProperties?: PropertyItem[];
  currentAgentId?: string | null;
  currentRole?: "AGENT" | "OWNER" | "USER" | string | null;
  currentJabatan?: string | null;
  stokerPhone?: string | null;
  /** Agent yang kodenya ada di URL — identitas & nomor yang dilihat klien. */
  presentingAgent?: PresentingAgent | null;
  /** Profil agent yang sedang login — untuk preview di modal "Bagikan". */
  selfAgent?: PresentingAgent | null;
  /**
   * Riwayat lelang aset ini, sudah dihitung di server (lihat
   * @/lib/auctionHistory). Dikirim sebagai prop supaya blok riwayat langsung
   * ada di HTML pertama dan tidak bergantung pada fetch dari browser.
   */
  riwayatLelang?: AuctionHistoryResult | null;
  /** Apakah pengunjung sudah login (dihitung di server, bukan dari useSession). */
  isLoggedIn?: boolean;
  /**
   * Hasil pemindaian "apa yang ada di sekitar" yang sudah tersimpan, dibaca di
   * server. Ada supaya aset yang pernah dipindai tampil lengkap di HTML
   * pertama — tanpa spinner dan tanpa satu pun permintaan dari browser.
   */
  sekitar?: SekitarAwal | null;
}

export default function DetailClient({
  product,
  fotoArray,
  similarProperties = [],
  currentAgentId,
  currentRole,
  currentJabatan,
  stokerPhone,
  presentingAgent = null,
  selfAgent = null,
  riwayatLelang = null,
  isLoggedIn,
  sekitar = null,
}: DetailClientProps) {
  useEffect(() => {
    if (!product?.id_property) return;
    const id = product.id_property;
    const key = `viewed_${id}`;
    if (sessionStorage.getItem(key)) return;
    fetch(`/api/listing/${id}/dilihat`, { method: "POST" }).catch(() => {});
    sessionStorage.setItem(key, "true");
  }, [product?.id_property]);

  const convertToNumber = (value: any): number => {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = parseFloat(value.replace(/[^0-9.-]/g, ""));
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const harga = convertToNumber(product.harga);
  const hargaPromo =
    product.harga_promo !== undefined && product.harga_promo !== null
      ? convertToNumber(product.harga_promo)
      : null;

  const uangJaminan =
    product.uang_jaminan !== undefined && product.uang_jaminan !== null
      ? convertToNumber(product.uang_jaminan)
      : null;

  const nilaiLimitLelang =
    product.nilai_limit_lelang !== undefined &&
    product.nilai_limit_lelang !== null
      ? convertToNumber(product.nilai_limit_lelang)
      : null;

  // Status dipegang di sini supaya satu klik "Tandai Terjual" langsung
  // mengubah galeri, badge di blok informasi, dan panel kontrol sekaligus —
  // tanpa menunggu render ulang dari server yang bisa saja masih dari cache.
  const [statusTayang, setStatusTayang] = useState<string>(
    product.status_tayang ?? "TERSEDIA"
  );

  const propertyData = {
    id_property: product.id_property,
    slug: product.slug || "",
    kode_properti: product.kode_properti ?? "-",
    judul: product.judul,
    title: product.judul,

    kota: product.kota,
    alamat_lengkap: product.alamat_lengkap,
    address: product.alamat_lengkap,
    area_lokasi: product.area_lokasi ?? null,
    kelurahan: product.kelurahan ?? null,
    kecamatan: product.kecamatan ?? null,
    provinsi: product.provinsi ?? null,
    latitude: product.latitude ?? null,
    longitude: product.longitude ?? null,
    akses_terdekat: Array.isArray(product.akses_terdekat)
      ? product.akses_terdekat
      : [],
    sekitar,

    harga,
    harga_promo: hargaPromo,
    jenis_transaksi: product.jenis_transaksi,
    kategori: product.kategori,
    status_tayang: statusTayang,
    is_hot_deal: product.is_hot_deal ?? false,
    dilihat: product.dilihat ?? 0,
    tanggal_lelang: product.tanggal_lelang ?? null,

    uang_jaminan: uangJaminan,
    nilai_limit_lelang: nilaiLimitLelang,

    luas_tanah: product.luas_tanah ?? null,
    luas_bangunan: product.luas_bangunan ?? null,
    kamar_tidur: product.kamar_tidur ?? null,
    kamar_mandi: product.kamar_mandi ?? null,
    jumlah_lantai: product.jumlah_lantai ?? null,
    daya_listrik: product.daya_listrik ?? null,
    sumber_air: product.sumber_air ?? null,
    hadap_bangunan: product.hadap_bangunan ?? null,
    kondisi_interior: product.kondisi_interior ?? null,
    legalitas: product.legalitas ?? null,
    nomor_legalitas: product.nomor_legalitas ?? null,
    vendor: product.vendor ?? null,
    lampiran: product.lampiran ?? null,
    link: product.link ?? null,

    deskripsi: product.deskripsi ?? null,

    gambar_utama: fotoArray[0] || "/images/hero/banner.jpg",
    gambar: fotoArray[0] || "/images/hero/banner.jpg",
    foto_list: fotoArray,

    agent: product.agent
      ? {
          nama: product.agent.pengguna?.nama_lengkap || "Agent Premier",
          telepon:
            product.agent.pengguna?.nomor_telepon ||
            product.agent.nomor_whatsapp ||
            "",
          whatsapp: product.agent.nomor_whatsapp || "",
          email: product.agent.pengguna?.email || "",
          kantor: product.agent.nama_kantor || "Solusindo Aset",
          foto_url:
            product.agent.foto_profil_url ||
            product.agent.pengguna?.foto_profil_url ||
            "/images/user/user-01.png",
          rating: product.agent.rating ?? 5,
          jumlah_closing: product.agent.jumlah_closing ?? 0,
          kota_area: product.agent.kota_area || "",
          jabatan: product.agent.jabatan || "",
        }
      : null,

    agent_name:
      product.agent?.pengguna?.nama_lengkap || "Agent Premier",
    agent_photo:
      product.agent?.foto_profil_url ||
      product.agent?.pengguna?.foto_profil_url ||
      "/images/user/user-01.png",

    owner: product.agent
      ? {
          id: product.agent.id_agent || "",
          name: product.agent.pengguna?.nama_lengkap || "Agent Premier",
          avatar:
            product.agent.foto_profil_url ||
            product.agent.pengguna?.foto_profil_url ||
            "/images/user/user-01.png",
          phone: product.agent.nomor_whatsapp || "",
          office: product.agent.nama_kantor || "Solusindo Aset",
          rating: product.agent.rating ?? 5.0,
          closing: product.agent.jumlah_closing ?? 0,
          area: product.agent.kota_area || "Indonesia",
          join: "2024",
        }
      : {
          id: "",
          name: "Agent Premier",
          avatar: "/images/user/user-01.png",
          phone: "",
          office: "Solusindo Aset",
          rating: 5.0,
          closing: 0,
          area: "Indonesia",
          join: "2024",
        },

    priceRates: {
      monthly: nilaiLimitLelang ?? harga,
      daily: 0,
    },
  };

  const minimalRoom = {
    id: 1,
    name: propertyData.judul,
    size: `${product.luas_bangunan || 0} m²`,
    amenities: [] as string[],
  };

  const [selectedRoom, setSelectedRoom] = useState(minimalRoom);
  const [shareOpen, setShareOpen] = useState(false);

  const ownerId: string = (propertyData as any).owner?.id || "";

  // `canEdit` menyalakan tombol "Edit Listing", yang mengarah ke
  // PUT /api/listings/{id} — dan endpoint itu HANYA menerima pemegang
  // listing. Cabang `currentRole === "OWNER"` yang dulu ada di sini tidak
  // pernah bernilai true (isinya `peran_enum` = USER|AGENT), jadi tidak ada
  // perilaku yang hilang saat dibuang. Sengaja TIDAK diganti jadi
  // `currentJabatan === "OWNER"`: itu akan memunculkan tombol yang lalu
  // ditolak 403 saat disimpan. Kalau owner memang perlu menyunting listing
  // agent lain, endpoint-nya dulu yang dibuka, baru tombol ini menyusul.
  const canEdit =
    currentRole === "AGENT" && !!currentAgentId && currentAgentId === ownerId;

  const isAgent = currentRole === "AGENT";

  const isSold = statusTayang.toUpperCase() === "TERJUAL";

  // Siapapun yang login sebagai agent atau owner bisa share.
  const canShare = !!(currentAgentId);

  const shareSlugId =
    (product.slug && product.id_property)
      ? `${product.slug}-${product.id_property}`
      : String(product.id_property || "");

  const shareLocation =
    product.area_lokasi ||
    [product.kecamatan, product.kota].filter(Boolean).join(", ") ||
    product.kota ||
    "";

  const shareCoverImage =
    fotoArray[0] || undefined;

  return (
    <div className="text-white font-sans bg-[#070A11]">
      <div className="lg:hidden h-[60px]" />
      <div className="hidden lg:block h-24 w-full" />

      {/* BREADCRUMB */}
      <div className="container mx-auto px-4 mb-4 lg:mb-6">
        <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-wider">
          <Link href="/" className="hover:text-[#86efac] transition-colors">
            Home
          </Link>
          <Icon icon="solar:alt-arrow-right-linear" className="text-sm" />
          <Link
            href="/Lelang"
            className="hover:text-[#86efac] transition-colors"
          >
            Lelang
          </Link>
          <Icon icon="solar:alt-arrow-right-linear" className="text-sm" />
          <span className="text-white truncate max-w-[150px] sm:max-w-xs">
            {product.judul}
          </span>
        </div>
      </div>

      {/* GALLERY */}
      <div className="container mx-auto lg:px-4 mb-8 px-4 mt-4 lg:mt-0">
        {/* Judul listing lelang datang dari sumber lelang dan sering tidak
            menyebut lokasi sama sekali — yang dipajang di kepala lightbox
            alamat lengkapnya. Judul cuma cadangan kalau alamatnya kosong. */}
        <ImageGallery
          images={fotoArray}
          judul={product.alamat_lengkap || product.judul}
          isSold={isSold}
        />
      </div>

      {/* Panel kontrol agent — tampil untuk pemegang listing, Owner, dan
          Stoker (yang memang mengurus seluruh stok aset lelang). Ditaruh
          tepat di atas kartu agent, bukan di atas galeri. */}
      <MarkSoldControl
        className="mb-4 lg:mb-6"
        idProperty={product.id_property}
        ownerAgentId={product.id_agent ?? product.agent?.id_agent ?? ownerId}
        jenisTransaksi={product.jenis_transaksi}
        status={statusTayang}
        onStatusChange={(s: ListingStatus) => setStatusTayang(s)}
        judul={product.alamat_lengkap || product.judul}
        lokasi={shareLocation}
        harga={nilaiLimitLelang || hargaPromo || harga}
        hargaLabel={nilaiLimitLelang ? "Harga limit" : "Harga"}
        thumbnail={shareCoverImage}
      />

      <div className="container mx-auto px-4 relative">
        <div className="flex flex-col lg:flex-row gap-10 items-start">
          <DetailInfo
            data={propertyData as any}
            selectedRoom={selectedRoom}
            setSelectedRoom={setSelectedRoom}
            currentAgentId={currentAgentId}
            currentRole={currentRole}
            currentJabatan={currentJabatan}
            riwayatLelang={riwayatLelang}
            isLoggedIn={isLoggedIn}
          />

          {isAgent ? (
            <KeperluanAgent
              data={propertyData as any}
              currentAgentId={currentAgentId}
              currentJabatan={currentJabatan}
              stokerPhone={stokerPhone}
              canEdit={canEdit}
              selfAgent={selfAgent}
              onShareOpen={canShare ? () => setShareOpen(true) : undefined}
            />
          ) : (
            <BookingSidebar
              data={propertyData as any}
              currentAgentId={currentAgentId}
              presentingAgent={presentingAgent}
              onShareOpen={canShare ? () => setShareOpen(true) : undefined}
            />
          )}
        </div>
      </div>

      <SimilarProperties items={similarProperties} />

      {/* Ruang bawah supaya konten terakhir tidak tertutup dock/bar yang fixed di mobile */}
      <div
        className="lg:hidden"
        style={{ height: `calc(${isAgent ? "100px" : "150px"} + env(safe-area-inset-bottom))` }}
      />

      {/* Modal share — dirender di level atas untuk bebas dari overflow/stacking context apapun */}
      <ShareListingModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        agentCode={currentAgentId || ""}
        selfAgent={selfAgent}
        propertyTitle={product.judul}
        propertyPrice={nilaiLimitLelang || hargaPromo || harga}
        priceLabel={nilaiLimitLelang ? "HARGA LIMIT" : hargaPromo ? "HARGA PROMO" : "HARGA"}
        propertyLocation={shareLocation}
        slugId={shareSlugId}
        posterImages={fotoArray}
        coverImage={shareCoverImage}
      />
    </div>
  );
}

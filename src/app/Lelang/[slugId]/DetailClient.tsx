// app/Lelang/[slug]/DetailClient.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";

import ImageGallery from "./[agentId]/components/ImageGalleryLelang";
import DetailInfo from "./[agentId]/components/DetailInfoLelang";
import BookingSidebar from "./[agentId]/components/AgentSidebarLelang";
import SimilarProperties from "./[agentId]/components/SimilarPropertiesLelang";
import KeperluanAgent from "./[agentId]/components/KeperluanAgent";

interface ProductData {
  id_property: string;
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
  latitude?: number | null;
  longitude?: number | null;
  kategori: string;
  jenis_transaksi: string;
  status_tayang?: string | null;
  is_hot_deal?: boolean | null;
  dilihat?: number | null;
  tanggal_lelang?: string | null;
  uang_jaminan?: number | string | null;
  nilai_limit_lelang?: number | string | null;

  agent?: {
    id_agent?: string | null;
    nama_kantor?: string | null;
    rating?: number | null;
    jumlah_closing?: number | null;
    nomor_whatsapp?: string | null;
    kota_area?: string | null;
    jabatan?: string | null;
    foto_profil_url?: string | null; // <- SUDAH DINORMALISASI DI page.tsx
    pengguna?: {
      nama_lengkap?: string | null;
      foto_profil_url?: string | null;
      nomor_telepon?: string | null;
      email?: string | null;
    } | null;
  } | null;
}

interface DetailClientProps {
  product: ProductData;
  fotoArray: string[];
  similarProperties?: ProductData[];
  currentAgentId?: string | null;   // id agent yang login (jika ada)
  currentRole?: "AGENT" | "OWNER" | "USER" | string | null; // role user
}

export default function DetailClient({
  product,
  fotoArray,
  similarProperties = [],
  currentAgentId,
  currentRole,
}: DetailClientProps) {
  // ========= INCREMENT VIEW SETIAP HALAMAN DETAIL DIBUKA =========
  useEffect(() => {
    if (!product?.id_property) return;

    const id = product.id_property;
    fetch(`/api/listing/${id}/dilihat`, { method: "POST" }).catch(() => {});
  }, [product?.id_property]);
  // ===============================================================

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

    harga,
    harga_promo: hargaPromo,
    jenis_transaksi: product.jenis_transaksi,
    kategori: product.kategori,
    status_tayang: product.status_tayang ?? "TERSEDIA",
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

    deskripsi: product.deskripsi ?? null,

    gambar_utama: fotoArray[0] || "/images/hero/banner.jpg",
    gambar: fotoArray[0] || "/images/hero/banner.jpg",
    foto_list: fotoArray,

    // ✅ GUNAKAN foto_profil_url DARI agent (SUDAH JADI URL THUMB)
    agent: product.agent
      ? {
          nama: product.agent.pengguna?.nama_lengkap || "Agent Premier",
          telepon:
            product.agent.pengguna?.nomor_telepon ||
            product.agent.nomor_whatsapp ||
            "",
          whatsapp: product.agent.nomor_whatsapp || "",
          email: product.agent.pengguna?.email || "",
          kantor: product.agent.nama_kantor || "Premier Asset",
          foto_url:
            product.agent.foto_profil_url ||        // utama: dari kolom agent (sudah normalize)
            product.agent.pengguna?.foto_profil_url || // fallback jika ada di pengguna
            "",
          rating: product.agent.rating ?? 5,
          jumlah_closing: product.agent.jumlah_closing ?? 0,
          kota_area: product.agent.kota_area || "",
          jabatan: product.agent.jabatan || "",
        }
      : null,

    agent_name:
      product.agent?.pengguna?.nama_lengkap || "Agent Premier",
    agent_photo:
      product.agent?.foto_profil_url ||            // pakai yang sudah normalize
      product.agent?.pengguna?.foto_profil_url ||
      "/images/user/user-01.png",

    // owner dengan id_agent + avatar yang benar
    owner: product.agent
      ? {
          id: product.agent.id_agent || "", // penting untuk cek kepemilikan
          name: product.agent.pengguna?.nama_lengkap || "Agent Premier",
          avatar:
            product.agent.foto_profil_url ||        // <== INI YANG DIBACA AgentSidebar
            product.agent.pengguna?.foto_profil_url ||
            "",
          phone: product.agent.nomor_whatsapp || "",
          office: product.agent.nama_kantor || "Premier Asset",
          rating: product.agent.rating ?? 5.0,
          closing: product.agent.jumlah_closing ?? 0,
          area: product.agent.kota_area || "Indonesia",
          join: "2024",
        }
      : {
          id: "",
          name: "Agent Premier",
          avatar: "",
          phone: "",
          office: "Premier Asset",
          rating: 5.0,
          closing: 0,
          area: "Indonesia",
          join: "2024",
        },

    priceRates: {
      monthly: harga,
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

  const formattedSimilarProperties = similarProperties.map((p) => ({
    ...p,
    slug: p.slug || "",
    gambar: p.gambar || "/images/hero/banner.jpg",
    foto_list: p.gambar
      ? p.gambar.split(",").map((g) => g.trim())
      : [],
    agent_name:
      p.agent?.pengguna?.nama_lengkap || "Agent Premier",
    agent_photo:
      p.agent?.foto_profil_url ||                  // gunakan thumbnail agent juga di similar
      p.agent?.pengguna?.foto_profil_url ||
      "/images/user/user-01.png",
    harga: convertToNumber(p.harga),
    dilihat: p.dilihat ?? 0,
    is_hot_deal: p.is_hot_deal ?? false,
  }));

  const ownerId: string = (propertyData as any).owner?.id || "";

  // boleh edit jika:
  // - currentRole OWNER (admin/owner sistem), ATAU
  // - currentRole AGENT dan currentAgentId === ownerId
  const canEdit =
    currentRole === "OWNER" ||
    (currentRole === "AGENT" && !!currentAgentId && currentAgentId === ownerId);

  const isAgent = currentRole === "AGENT";

  return (
    <div className="text-white font-sans bg-[#0F0F0F]">
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
        <ImageGallery images={fotoArray} />
      </div>

      <div className="container mx-auto px-4 relative">
        <div className="flex flex-col lg:flex-row gap-10 items-start">
          <DetailInfo
            data={propertyData as any}
            selectedRoom={selectedRoom}
            setSelectedRoom={setSelectedRoom}
            currentAgentId={currentAgentId}
          />

          {isAgent ? (
            // Semua agent selalu lihat KeperluanAgent
            <KeperluanAgent
              data={propertyData as any}
              currentAgentId={currentAgentId}
              canEdit={canEdit} // di dalamnya tombol Edit hanya muncul jika canEdit true
            />
          ) : (
            // Non-agent (buyer biasa) lihat BookingSidebar
            <BookingSidebar
              data={propertyData as any}
              currentAgentId={currentAgentId}
            />
          )}
        </div>
      </div>

      <SimilarProperties
        currentProperty={propertyData as any}
        allProperties={formattedSimilarProperties as any}
      />
    </div>
  );
}

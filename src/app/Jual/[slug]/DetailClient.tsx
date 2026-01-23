"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";

// Components
import MobileNav from "./[id]/components/MobileNav";
import ImageGallery from "./[id]/components/ImageGallery";
import DetailInfo from "./[id]/components/DetailInfo";
import BookingSidebar from "./[id]/components/AgentSidebar";
import SimilarProperties from "./[id]/components/SimilarProperties";

// Interface sesuai DB
interface ProductData {
  id_property: string;
  kode_properti?: string;
  judul: string;
  kota: string;
  harga: number | string;
  harga_promo?: number | string;
  deskripsi: string;
  alamat_lengkap: string;
  area_lokasi?: string;
  kelurahan?: string;
  kecamatan?: string;
  provinsi?: string;
  gambar_utama_url: string;
  kamar_tidur: number;
  kamar_mandi: number;
  luas_tanah: number;
  luas_bangunan: number;
  jumlah_lantai?: number;
  daya_listrik?: number;
  sumber_air?: string;
  hadap_bangunan?: string;
  kondisi_interior?: string;
  legalitas?: string;
  latitude?: number;
  longitude?: number;
  kategori: string;
  jenis_transaksi: string; // JUAL / SEWA / LELANG
  status_tayang?: string;
  is_hot_deal?: boolean;
  dilihat?: number;
  agent?: {
    nama_kantor?: string;
    rating?: number;
    jumlah_closing?: number;
    nomor_whatsapp?: string;
    kota_area?: string;
    jabatan?: string;
    pengguna?: {
      nama_lengkap?: string;
      foto_profil_url?: string;
      nomor_telepon?: string;
      email?: string;
    };
  };
}

export default function DetailClient({ product }: { product: ProductData }) {
  const convertToNumber = (value: any): number => {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = parseFloat(value.replace(/[^0-9.-]/g, ""));
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const harga = convertToNumber(product.harga);
  const hargaPromo = product.harga_promo
    ? convertToNumber(product.harga_promo)
    : null;

  useEffect(() => {
    console.log("🔍 DetailClient - Product Data:", product);
  }, [product, harga, hargaPromo]);

  const propertyData = {
    id_property: product.id_property,
    kode_properti: product.kode_properti || "-",
    judul: product.judul,
    title: product.judul,

    kota: product.kota,
    alamat_lengkap: product.alamat_lengkap,
    address: product.alamat_lengkap,
    area_lokasi: product.area_lokasi || null,
    kelurahan: product.kelurahan || null,
    kecamatan: product.kecamatan || null,
    provinsi: product.provinsi || null,
    latitude: product.latitude || null,
    longitude: product.longitude || null,

    harga,
    harga_promo: hargaPromo,
    jenis_transaksi: product.jenis_transaksi,
    kategori: product.kategori,
    status_tayang: product.status_tayang || "TERSEDIA",
    is_hot_deal: product.is_hot_deal || false,
    dilihat: product.dilihat || 0,

    luas_tanah: product.luas_tanah || null,
    luas_bangunan: product.luas_bangunan || null,
    kamar_tidur: product.kamar_tidur ?? null,
    kamar_mandi: product.kamar_mandi ?? null,
    jumlah_lantai: product.jumlah_lantai || null,
    daya_listrik: product.daya_listrik || null,
    sumber_air: product.sumber_air || null,
    hadap_bangunan: product.hadap_bangunan || null,
    kondisi_interior: product.kondisi_interior || null,
    legalitas: product.legalitas || null,

    deskripsi: product.deskripsi || null,

    gambar_utama_url: product.gambar_utama_url,

    agent: product.agent
      ? {
          nama: product.agent.pengguna?.nama_lengkap || "Agent Premier",
          telepon:
            product.agent.pengguna?.nomor_telepon ||
            product.agent.nomor_whatsapp,
          whatsapp: product.agent.nomor_whatsapp,
          email: product.agent.pengguna?.email,
          kantor: product.agent.nama_kantor,
          foto_url: product.agent.pengguna?.foto_profil_url,
          rating: product.agent.rating,
          jumlah_closing: product.agent.jumlah_closing,
          kota_area: product.agent.kota_area,
          jabatan: product.agent.jabatan,
        }
      : null,

    owner: product.agent
      ? {
          name: product.agent.pengguna?.nama_lengkap || "Agent Premier",
          avatar: product.agent.pengguna?.foto_profil_url || "",
          phone: product.agent.nomor_whatsapp || "",
          office: product.agent.nama_kantor || "Premier Asset",
          rating: product.agent.rating || 5.0,
          closing: product.agent.jumlah_closing || 0,
          area: product.agent.kota_area || "Indonesia",
          join: "2024",
        }
      : {
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

  const jenisLabel =
    product.jenis_transaksi === "JUAL"
      ? "Jual"
      : product.jenis_transaksi === "SEWA"
      ? "Sewa"
      : "Lelang";

  return (
    <div className="text-white font-sans bg-[#0F0F0F]">
      <MobileNav />

      {/* Spacer mobile utk header fixed */}
      <div className="lg:hidden h-[60px]" />

      {/* Spacer desktop */}
      <div className="hidden lg:block h-24 w-full" />

      {/* Breadcrumb - TAMPIL di semua ukuran */}
      <div className="container mx-auto px-4 mb-4 lg:mb-6">
        <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-wider">
          <Link href="/" className="hover:text-[#86efac] transition-colors">
            Home
          </Link>
          <Icon icon="solar:alt-arrow-right-linear" className="text-sm" />
          <Link
            href="/Jual"
            className="hover:text-[#86efac] transition-colors"
          >
            {jenisLabel}
          </Link>
          <Icon icon="solar:alt-arrow-right-linear" className="text-sm" />
          <span className="text-white truncate max-w-[150px] sm:max-w-xs">
            {product.judul}
          </span>
        </div>
      </div>

      {/* Image Gallery dengan space atas (mt-2 untuk mobile) */}
      <div className="container mx-auto lg:px-4 mb-8 px-4 mt-2 lg:mt-0">
        <ImageGallery
          images={[
            product.gambar_utama_url || "/images/placeholder.jpg",
          ]}
        />
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 relative">
        <div className="flex flex-col lg:flex-row gap-10 items-start">
          <DetailInfo
            data={propertyData}
            selectedRoom={selectedRoom}
            setSelectedRoom={setSelectedRoom}
          />

          <BookingSidebar data={propertyData} />
        </div>
      </div>

      <SimilarProperties />
    </div>
  );
}

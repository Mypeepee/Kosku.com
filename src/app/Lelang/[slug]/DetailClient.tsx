"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";

// --- IMPORT COMPONENTS ---
import MobileNav from "./[id]/components/MobileNav";
import ImageGallery from "./[id]/components/ImageGallery";
import DetailInfo from "./[id]/components/DetailInfo";
import BookingSidebar from "./[id]/components/AgentSidebar";
import SimilarProperties from "./[id]/components/SimilarProperties";

// --- INTERFACE SESUAI DATABASE ---
interface ProductData {
  id_property: string;
  kode_properti?: string;
  judul: string;
  kota: string;
  harga: number | string; // Bisa string dari database
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
  jenis_transaksi: string;
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
    }
  };
}

export default function DetailClient({ product }: { product: ProductData }) {
  
  // 🔥 CONVERT HARGA TO NUMBER PROPERLY
  const convertToNumber = (value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const harga = convertToNumber(product.harga);
  const hargaPromo = product.harga_promo ? convertToNumber(product.harga_promo) : null;

  // 🔥 DEBUG LOGS
  useEffect(() => {
    console.log('🔍 DetailClient - Product Data:', product);
    console.log('🔍 jenis_transaksi:', product.jenis_transaksi);
    console.log('🔍 harga (raw):', product.harga, 'type:', typeof product.harga);
    console.log('🔍 harga (converted):', harga);
    console.log('🔍 harga_promo (raw):', product.harga_promo);
    console.log('🔍 harga_promo (converted):', hargaPromo);
    console.log('🔍 KPR Condition Check:', product.jenis_transaksi === 'JUAL' && harga > 0);
  }, [product, harga, hargaPromo]);

  // 🔥 DATA PROPERTI DENGAN SAFE NAVIGATION & PROPER TYPE CONVERSION
  const propertyData = {
    // Basic Info
    id_property: product.id_property,
    kode_properti: product.kode_properti || '-',
    judul: product.judul,
    title: product.judul,
    
    // Location
    kota: product.kota,
    alamat_lengkap: product.alamat_lengkap,
    address: product.alamat_lengkap,
    area_lokasi: product.area_lokasi || null,
    kelurahan: product.kelurahan || null,
    kecamatan: product.kecamatan || null,
    provinsi: product.provinsi || null,
    latitude: product.latitude || null,
    longitude: product.longitude || null,
    
    // Price & Transaction - PROPERLY CONVERTED
    harga: harga,
    harga_promo: hargaPromo,
    jenis_transaksi: product.jenis_transaksi, // JUAL, SEWA, LELANG
    kategori: product.kategori,
    status_tayang: product.status_tayang || 'TERSEDIA',
    is_hot_deal: product.is_hot_deal || false,
    dilihat: product.dilihat || 0,
    
    // Specs
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
    
    // Description
    deskripsi: product.deskripsi || null,
    
    // Images
    gambar_utama_url: product.gambar_utama_url,
    
    // 🔥 Agent/Owner Info (untuk AgentSidebar)
    agent: product.agent ? {
      nama: product.agent.pengguna?.nama_lengkap || "Agent Premier",
      telepon: product.agent.pengguna?.nomor_telepon || product.agent.nomor_whatsapp,
      whatsapp: product.agent.nomor_whatsapp,
      email: product.agent.pengguna?.email,
      kantor: product.agent.nama_kantor,
      foto_url: product.agent.pengguna?.foto_profil_url,
      rating: product.agent.rating,
      jumlah_closing: product.agent.jumlah_closing,
      kota_area: product.agent.kota_area,
      jabatan: product.agent.jabatan,
    } : null,

    // 🔥 Alias 'owner' untuk backward compatibility dengan AgentSidebar
    owner: product.agent ? {
      name: product.agent.pengguna?.nama_lengkap || "Agent Premier",
      avatar: product.agent.pengguna?.foto_profil_url || "",
      phone: product.agent.nomor_whatsapp || "",
      office: product.agent.nama_kantor || "Premier Asset",
      rating: product.agent.rating || 5.0,
      closing: product.agent.jumlah_closing || 0,
      area: product.agent.kota_area || "Indonesia",
      join: "2024",
    } : {
      name: "Agent Premier",
      avatar: "",
      phone: "",
      office: "Premier Asset",
      rating: 5.0,
      closing: 0,
      area: "Indonesia",
      join: "2024",
    },

    // 🔥 Tambahkan priceRates untuk AgentSidebar
    priceRates: {
      monthly: harga,
      daily: 0
    },
  };

  // Log final propertyData yang di-pass ke DetailInfo
  useEffect(() => {
    console.log('🔥 Final propertyData passed to DetailInfo:', propertyData);
  }, []);

  // Minimal selectedRoom
  const minimalRoom = {
    id: 1,
    name: propertyData.judul,
    size: `${product.luas_bangunan || 0} m²`,
    amenities: []
  };

  const [selectedRoom, setSelectedRoom] = useState(minimalRoom);

  return (
    <div className="text-white font-sans bg-[#0F0F0F]">
      
      <MobileNav />
      <div className="hidden lg:block h-24 w-full"></div>

      {/* Breadcrumb */}
      <div className="hidden lg:block container mx-auto px-4 mb-6">
         <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            <Link href="/" className="hover:text-[#86efac] transition-colors">Home</Link> 
            <Icon icon="solar:alt-arrow-right-linear" />
            <Link href="/Jual" className="hover:text-[#86efac] transition-colors">
              {product.jenis_transaksi === 'JUAL' ? 'Jual' : 
               product.jenis_transaksi === 'SEWA' ? 'Sewa' : 'Lelang'}
            </Link> 
            <Icon icon="solar:alt-arrow-right-linear" />
            <span className="text-white truncate max-w-xs">{product.judul}</span>
         </div>
      </div>

      {/* Image Gallery */}
      <div className="container mx-auto lg:px-4 mb-8">
          <ImageGallery images={[product.gambar_utama_url || "/images/placeholder.jpg"]} />
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 relative">
         <div className="flex flex-col lg:flex-row gap-10 items-start">
            
            {/* Detail Info */}
            <DetailInfo 
                data={propertyData}
                selectedRoom={selectedRoom} 
                setSelectedRoom={setSelectedRoom} 
            />

            {/* Agent Sidebar */}
            <BookingSidebar 
                data={propertyData}  
            />
            
         </div>
      </div>

      {/* Similar Properties */}
      <SimilarProperties />

    </div>
  );
}

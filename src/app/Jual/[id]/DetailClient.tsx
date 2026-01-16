"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";

// --- IMPORT COMPONENTS ---
import MobileNav from "./components/MobileNav";
import ImageGallery from "./components/ImageGallery";
import DetailInfo from "./components/DetailInfo";
import BookingSidebar from "./components/AgentSidebar";
import SimilarProperties from "./components/SimilarProperties";

// --- INTERFACE SESUAI DATABASE ---
interface ProductData {
  id_property: string;
  judul: string;
  kota: string;
  harga: number;
  deskripsi: string;
  alamat_lengkap: string;
  gambar_utama_url: string;
  kamar_tidur: number;
  kamar_mandi: number;
  luas_tanah: number;
  luas_bangunan: number;
  listrik: number;
  agent: {
    nama_kantor: string;
    rating: number;
    jumlah_closing: number;
    nomor_whatsapp: string;
    kota_area: string;
    pengguna: {
      nama_lengkap: string;
      foto_profil_url: string;
    }
  };
  kategori: string;
  jenis_transaksi: string;
}

export default function DetailClient({ product }: { product: ProductData }) {
  
  // 1. DATA ADAPTER
  const formattedData = {
    id: product.id_property,
    title: product.judul,
    location: product.kota,
    address: product.alamat_lengkap || product.kota,
    description: product.deskripsi || "Hubungi agen untuk detail lebih lanjut.",
    type: product.kategori, 
    priceRates: { monthly: Number(product.harga), daily: 0 },
    deposit: 0,
    images: [
      product.gambar_utama_url || "/images/placeholder.jpg",
      "/images/placeholder.jpg", 
      "/images/placeholder.jpg",
    ],
    owner: { 
      name: product.agent?.pengguna?.nama_lengkap || "Agent Premier", 
      avatar: product.agent?.pengguna?.foto_profil_url || "", 
      phone: product.agent?.nomor_whatsapp, 
      office: product.agent?.nama_kantor || "Premier Asset Office",
      rating: product.agent?.rating || 5.0,
      closing: product.agent?.jumlah_closing || 0,
      area: product.agent?.kota_area || "Indonesia",
      join: "2024", 
    },
    specs: { 
        luas_tanah: `${product.luas_tanah} m²`,
        luas_bangunan: `${product.luas_bangunan} m²`,
        listrik: `${product.listrik || '-'} Watt`
    },
    roomTypes: [
      { 
          id: 1, 
          name: "Unit Properti Utama", 
          price: Number(product.harga), 
          size: `${product.luas_bangunan} m²`, 
          bedType: `${product.kamar_tidur} KT / ${product.kamar_mandi} KM`, 
          image: product.gambar_utama_url || "/images/placeholder.jpg", 
          // PERBAIKAN: Menambahkan 'tags' agar DetailInfo tidak error
          tags: [product.jenis_transaksi, product.kategori, "Bebas Banjir"], 
          amenities: [
              { icon: "solar:bed-bold", label: `${product.kamar_tidur} KT` },
              { icon: "solar:bath-bold", label: `${product.kamar_mandi} KM` },
              { icon: "solar:ruler-angular-bold", label: `LT ${product.luas_tanah}m²` },
              { icon: "solar:home-bold", label: `LB ${product.luas_bangunan}m²` }
          ],
      }
    ],
    facilities: { public: ["Sertifikat Hak Milik (SHM)", "Bebas Banjir", "Akses Jalan Lebar"] },
    rules: ["Hubungi agen untuk survei", "Harga Nego"],
    depositInfo: { amount: 0, notes: "-" },
    accessibility: ["Dekat Jalan Raya", "Akses Mobil"],
    ratingDetail: { clean: 5, comfort: 5, location: 5, service: 5, value: 5 },
  };

  const [selectedRoom, setSelectedRoom] = useState(formattedData.roomTypes[0]);

  return (
    <div className="text-white font-sans bg-[#0F0F0F]">
      
      <MobileNav />
      <div className="hidden lg:block h-24 w-full"></div>

      <div className="hidden lg:block container mx-auto px-4 mb-6">
         <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            <Link href="/" className="hover:text-[#86efac] transition-colors">Home</Link> 
            <Icon icon="solar:alt-arrow-right-linear" />
            <Link href="/Carikos" className="hover:text-[#86efac] transition-colors">Jual</Link> 
            <Icon icon="solar:alt-arrow-right-linear" />
            <span className="text-white truncate max-w-xs">{formattedData.title}</span>
         </div>
      </div>

      <div className="container mx-auto lg:px-4 mb-8">
          <ImageGallery images={formattedData.images} />
      </div>

      <div className="container mx-auto px-4 relative">
         <div className="flex flex-col lg:flex-row gap-10 items-start">
            
            {/* 2. PASS STATE KE DETAIL INFO */}
            <DetailInfo 
                data={formattedData}
                selectedRoom={selectedRoom} 
                setSelectedRoom={setSelectedRoom} 
            />

            {/* 3. PASS STATE KE BOOKING SIDEBAR */}
            <BookingSidebar 
                data={formattedData}  
            />
            
         </div>
      </div>

      <SimilarProperties />

    </div>
  );
}
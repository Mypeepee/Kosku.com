"use client";
import React from "react";
import { Icon } from "@iconify/react";
import dynamic from "next/dynamic";

const Maps = dynamic(
  () => import("../../../../../components/Maps/maps"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-[#151515] animate-pulse flex flex-col items-center justify-center text-gray-500 gap-2">
        <Icon
          icon="solar:map-point-bold-duotone"
          className="text-3xl animate-bounce"
        />
        <span className="text-xs font-bold">Memuat Peta...</span>
      </div>
    ),
  }
);

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
  selectedRoom: any;
  setSelectedRoom: (room: any) => void;
}

const formatRupiah = (val: number | null | undefined) => {
  if (val == null || isNaN(val)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val);
};

const getTransactionBadge = (jenis: string) => {
  if (jenis === "JUAL" || jenis === "SECONDARY")
    return {
      color: "border-emerald-500 text-emerald-400 bg-emerald-500/10",
      label: "Dijual",
      icon: "solar:tag-price-bold",
    };
  if (jenis === "SEWA")
    return {
      color: "border-blue-500 text-blue-400 bg-blue-500/10",
      label: "Disewa",
      icon: "solar:key-bold",
    };
  if (jenis === "LELANG")
    return {
      color: "border-orange-500 text-orange-400 bg-orange-500/10",
      label: "Lelang",
      icon: "solar:gavel-bold",
    };
  return {
    color: "border-purple-500 text-purple-400 bg-purple-500/10",
    label: jenis,
    icon: "solar:home-bold",
  };
};

const getCategoryLabel = (kategori: string) => {
  const labels: Record<string, string> = {
    RUMAH: "Rumah",
    APARTEMEN: "Apartemen",
    RUKO: "Ruko",
    TANAH: "Tanah",
    GUDANG: "Gudang",
    VILLA: "Villa",
    GEDUNG: "Gedung",
    KANTOR: "Kantor",
  };
  return labels[kategori] || kategori;
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

// Template soft selling
const buildShareMessage = (data: PropertyData) => {
  const judul = data?.judul || "Listing Properti";
  const harga = formatRupiah(data?.harga);
  const lokasiSingkat =
    data?.kota ||
    data?.alamat_lengkap ||
    [data?.kelurahan, data?.kecamatan, data?.kota, data?.provinsi]
      .filter(Boolean)
      .join(", ");

  const luasTanah = data?.luas_tanah ? `${data.luas_tanah} m²` : "-";
  const legal = data?.legalitas || "-";

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
    `💰 Harga: ${harga}\n` +
    `Kode: ${data?.kode_properti || "-"}\n\n` +
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

export default function DetailInfo({
  data,
  selectedRoom,
  setSelectedRoom,
}: DetailInfoProps) {
  const transactionBadge = getTransactionBadge(data?.jenis_transaksi || "JUAL");

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
      } catch {
        // user batal / error
      }
    } else if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(
          `${text}\n\n🔗 Info lengkap: ${url}`
        );
      } catch {
        // gagal copy, abaikan
      }
    }
  };

  return (
    <div className="w-full lg:w-2/3 space-y-6 pb-10">
      {/* 1. HEADER */}
      <div className="border-b border-white/5 pb-4">
        <div className="flex justify-between items-start gap-3 mb-3">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase border ${transactionBadge.color} flex items-center gap-1.5`}
              >
                <Icon icon={transactionBadge.icon} className="text-sm" />{" "}
                {transactionBadge.label}
              </span>
              <span className="px-3 py-1.5 bg-slate-700/30 text-slate-300 border border-slate-600/30 rounded-lg text-xs font-bold uppercase">
                {getCategoryLabel(data?.kategori || "RUMAH")}
              </span>

              {data?.is_hot_deal && (
                <span className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.16em] text-white">
                  <span className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 opacity-70 blur-[3px]" />
                  <span className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 animate-pulse opacity-80" />
                  <span className="relative inline-flex items-center gap-1.5 px-1.5">
                    <Icon
                      icon="solar:fire-bold-duotone"
                      className="text-sm text-yellow-100"
                    />
                    HOT DEAL
                  </span>
                </span>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-white leading-tight mb-3">
              {data?.judul || "Properti Tanpa Judul"}
            </h1>

            <div className="flex items-start gap-2 mb-3">
              <Icon
                icon="solar:map-point-bold"
                className="text-emerald-400 text-xl flex-shrink-0 mt-0.5"
              />
              <div className="flex-1">
                <p className="text-base text-white font-medium leading-snug">
                  {data?.alamat_lengkap ||
                    [
                      data?.kelurahan,
                      data?.kecamatan,
                      data?.kota,
                      data?.provinsi,
                    ]
                      .filter(Boolean)
                      .join(", ") ||
                    "Lokasi tidak tersedia"}
                </p>
                {(data?.kelurahan ||
                  data?.kecamatan ||
                  data?.kota ||
                  data?.provinsi) && (
                  <p className="text-xs text-gray-400 mt-1">
                    {[
                      data?.kelurahan,
                      data?.kecamatan,
                      data?.kota,
                      data?.provinsi,
                    ]
                      .filter(Boolean)
                      .join(", ") || "-"}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Icon icon="solar:eye-bold" /> {data?.dilihat ?? 0}
              </span>
              <span>•</span>
              <span>ID: {data?.id_property || "-"}</span>
              <span>•</span>
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] border border-emerald-500/20 font-medium">
                {data?.status_tayang || "TERSEDIA"}
              </span>
            </div>
          </div>

          <button
            onClick={handleShare}
            className="bg-slate-800/50 w-10 h-10 flex items-center justify-center rounded-lg text-white border border-slate-700/50 hover:bg-slate-700/50 active:scale-95 transition-all flex-shrink-0"
          >
            <Icon icon="solar:share-bold" className="text-lg" />
          </button>
        </div>
      </div>

      {/* 2. RINGKASAN LELANG */}
      <div>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Icon
            icon="solar:home-2-bold-duotone"
            className="text-emerald-400"
          />
          Ringkasan Lelang
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Luas Tanah */}
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/30 rounded-xl p-4 hover:border-emerald-400/40 hover:shadow-lg hover:shadow-emerald-500/10 transition-all group">
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Icon
                  icon="solar:ruler-angular-bold-duotone"
                  className="text-amber-400 text-2xl"
                />
              </div>
              <div>
                <p className="text-2xl font-black text-white">
                  {data?.luas_tanah ?? "-"}
                </p>
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wide">
                  Luas Tanah (m²)
                </span>
              </div>
            </div>
          </div>

          {/* Legalitas */}
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/30 rounded-xl p-4 hover:border-emerald-400/40 hover:shadow-lg hover:shadow-emerald-500/10 transition-all group">
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Icon
                  icon="solar:shield-check-bold-duotone"
                  className="text-emerald-400 text-2xl"
                />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-400">
                  {data?.legalitas || "-"}
                </p>
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wide">
                  Legalitas
                </span>
              </div>
            </div>
          </div>

          {/* Tanggal Lelang */}
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/30 rounded-xl p-4 hover:border-emerald-400/40 hover:shadow-lg hover:shadow-emerald-500/10 transition-all group">
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Icon
                  icon="solar:calendar-date-bold-duotone"
                  className="text-red-400 text-2xl"
                />
              </div>
              <div>
                <p className="text-sm font-black text-white">
                  {formatTanggalLelang(data?.tanggal_lelang)}
                </p>
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wide">
                  Tanggal Lelang
                </span>
              </div>
            </div>
          </div>

          {/* Uang Jaminan */}
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/30 rounded-xl p-4 hover:border-emerald-400/40 hover:shadow-lg hover:shadow-emerald-500/10 transition-all group">
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                <Icon
                  icon="solar:wallet-money-bold-duotone"
                  className="text-yellow-400 text-2xl"
                />
              </div>
              <div>
                <p className="text-sm font-black text-white break-words">
                  {formatRupiah(data?.uang_jaminan)}
                </p>
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wide">
                  Uang Jaminan
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. DESKRIPSI */}
      {data?.deskripsi && (
        <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/30 rounded-xl p-5">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Icon
                icon="solar:document-text-bold-duotone"
                className="text-blue-400"
              />
            </div>
            Deskripsi Properti
          </h3>
          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">
            {data.deskripsi}
          </p>
        </div>
      )}

      {/* 4. LEGAL & SERTIFIKAT */}
      <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/30 rounded-xl p-5">
        <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Icon
              icon="solar:shield-check-bold-duotone"
              className="text-emerald-400"
            />
          </div>
          Legal & Sertifikat
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="py-2 px-3 bg-slate-900/30 rounded-lg">
            <span className="text-xs text-gray-400 block mb-1">
              Jenis Sertifikat
            </span>
            <span className="text-sm text-emerald-400 font-bold">
              {data?.legalitas || "-"}
            </span>
          </div>
          <div className="py-2 px-3 bg-slate-900/30 rounded-lg">
            <span className="text-xs text-gray-400 block mb-1">
              Status Properti
            </span>
            <span className="text-sm text-emerald-400 font-semibold">
              {data?.status_tayang || "TERSEDIA"}
            </span>
          </div>
        </div>
      </div>

      {/* 5. ALAMAT */}
      <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/30 rounded-xl p-5">
        <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Icon
              icon="solar:map-point-wave-bold-duotone"
              className="text-emerald-400"
            />
          </div>
          Alamat Lengkap
        </h4>
        <div className="space-y-3">
          <div className="py-2 px-3 bg-slate-900/30 rounded-lg">
            <span className="text-xs text-gray-400 block mb-1">Alamat</span>
            <span className="text-sm text-white font-medium">
              {data?.alamat_lengkap || "-"}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="py-2 px-3 bg-slate-900/30 rounded-lg">
              <span className="text-xs text-gray-400 block mb-1">
                Kelurahan
              </span>
              <span className="text-sm text-white font-semibold">
                {data?.kelurahan ?? "-"}
              </span>
            </div>
            <div className="py-2 px-3 bg-slate-900/30 rounded-lg">
              <span className="text-xs text-gray-400 block mb-1">
                Kecamatan
              </span>
              <span className="text-sm text-white font-semibold">
                {data?.kecamatan ?? "-"}
              </span>
            </div>
            <div className="py-2 px-3 bg-slate-900/30 rounded-lg">
              <span className="text-xs text-gray-400 block mb-1">
                Kota/Kabupaten
              </span>
              <span className="text-sm text-white font-semibold">
                {data?.kota ?? "-"}
              </span>
            </div>
            <div className="py-2 px-3 bg-slate-900/30 rounded-lg">
              <span className="text-xs text-gray-400 block mb-1">
                Provinsi
              </span>
              <span className="text-sm text-white font-semibold">
                {data?.provinsi ?? "-"}
              </span>
            </div>
          </div>
          {data?.area_lokasi && (
            <div className="py-2 px-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
              <span className="text-xs text-emerald-400 block mb-1">Area</span>
              <span className="text-sm text-white font-semibold">
                {data.area_lokasi}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 6. MAP */}
      <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/30 rounded-xl p-5 backdrop-blur-sm">
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-sm font-bold flex items-center gap-2 text-white">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 flex items-center justify-center">
              <Icon
                icon="solar:map-bold-duotone"
                className="text-red-400 text-xl"
              />
            </div>
            Peta Lokasi & Fasilitas Sekitar
          </h3>

          {(data?.latitude != null && data?.longitude != null) ||
          data?.alamat_lengkap ? (
            <a
              href={
                data?.latitude != null && data?.longitude != null
                  ? `https://www.google.com/maps/search/?api=1&query=${data.latitude},${data.longitude}`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      data?.alamat_lengkap || ""
                    )}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-all flex items-center gap-1 group"
            >
              Buka di Google Maps
              <Icon
                icon="solar:arrow-right-up-linear"
                className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
              />
            </a>
          ) : null}
        </div>

        {data?.latitude != null && data?.longitude != null ? (
          <div className="relative w-full h-[550px] bg-slate-900 rounded-xl overflow-hidden border border-slate-700/50 shadow-2xl ring-1 ring-white/5">
            <Maps
              lat={data.latitude}
              lng={data.longitude}
              address={data.alamat_lengkap}
            />
          </div>
        ) : data?.alamat_lengkap ? (
          <div className="relative w-full h-[550px] bg-slate-900 rounded-xl overflow-hidden border border-slate-700/50 shadow-2xl ring-1 ring-white/5">
            <Maps address={data.alamat_lengkap} />
          </div>
        ) : (
          <div className="bg-slate-900/30 border border-slate-700/30 rounded-xl p-8 flex flex-col items-center justify-center text-center min-h-[400px]">
            <Icon
              icon="solar:map-point-bold-duotone"
              className="text-6xl text-slate-700 mb-3"
            />
            <h4 className="text-white font-bold mb-2">
              Lokasi Belum Tersedia
            </h4>
            <p className="text-sm text-gray-400 max-w-md">
              Koordinat dan alamat belum diinput. Hubungi agent untuk informasi
              lokasi.
            </p>
          </div>
        )}
      </div>

      {/* 7. EDUKASI LELANG */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800/90 to-slate-900 border border-emerald-500/20 rounded-2xl p-6 md:p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 mb-4 shadow-lg shadow-emerald-500/30">
            <Icon
              icon="solar:verified-check-bold"
              className="text-3xl text-white"
            />
          </div>
          <h3 className="text-2xl md:text-3xl font-black text-white mb-2">
            Kenapa Beli Rumah Lelang?
          </h3>
          <p className="text-sm text-gray-400 max-w-2xl mx-auto">
            Dapatkan properti impian dengan harga di bawah pasar. Kami bantu
            sampai serah terima kunci.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-xl p-5 hover:border-emerald-400/50 hover:shadow-lg hover:shadow-emerald-500/10 transition-all group">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <Icon
                  icon="solar:wallet-money-bold-duotone"
                  className="text-2xl text-emerald-400"
                />
              </div>
              <div className="flex-1">
                <h4 className="text-base font-bold text-white mb-1">
                  Harga Lebih Murah
                </h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Properti lelang umumnya 20-40% lebih murah dari harga pasar
                  karena harus cepat terjual.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 rounded-xl p-5 hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all group">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <Icon
                  icon="solar:shield-check-bold-duotone"
                  className="text-2xl text-blue-400"
                />
              </div>
              <div className="flex-1">
                <h4 className="text-base font-bold text-white mb-1">
                  Legal Terjamin
                </h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Diawasi bank/lembaga resmi, sertifikat dan dokumen sudah
                  terverifikasi sebelum lelang.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20 rounded-xl p-5 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/10 transition-all group">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <Icon
                  icon="solar:clock-circle-bold-duotone"
                  className="text-2xl text-purple-400"
                />
              </div>
              <div className="flex-1">
                <h4 className="text-base font-bold text-white mb-1">
                  Proses Cepat
                </h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Tanpa proses negosiasi berlarut-larut. Menang lelang langsung
                  proses akad.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-purple-500/10 border border-white/10 rounded-xl p-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center shadow-lg">
                <Icon
                  icon="solar:key-bold-duotone"
                  className="text-4xl text-white"
                />
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h4 className="text-lg md:text-xl font-black text-white mb-2">
                Kami Dampingi Sampai Serah Terima Kunci
              </h4>
              <p className="text-sm text-gray-300 leading-relaxed mb-4">
                Tidak perlu khawatir soal rumah masih ditempati atau dokumen
                bermasalah. Tim kami akan memastikan properti siap serah terima
                dengan kondisi sesuai kesepakatan lelang.
              </p>
              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                  <Icon icon="solar:check-circle-bold" className="text-base" />
                  Pendampingan Legal
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                  <Icon icon="solar:check-circle-bold" className="text-base" />
                  Bantu Eksekusi
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                  <Icon icon="solar:check-circle-bold" className="text-base" />
                  Garansi Serah Terima
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-start gap-2 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
          <Icon
            icon="solar:info-circle-bold"
            className="text-gray-500 text-base flex-shrink-0 mt-0.5"
          />
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Informasi di atas bersifat umum. Untuk detail spesifik properti
            ini, konsultasi dengan agent kami melalui tombol WhatsApp di
            sidebar.
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";
import React, { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import dynamic from "next/dynamic";

const KosMap = dynamic(() => import("../../../../components/Maps/KosMap"), { 
  ssr: false, 
  loading: () => (
    <div className="w-full h-full bg-[#151515] animate-pulse flex flex-col items-center justify-center text-gray-500 gap-2">
      <Icon icon="solar:map-point-bold-duotone" className="text-3xl animate-bounce"/>
      <span className="text-xs font-bold">Memuat Peta...</span>
    </div>
  )
});

interface DetailInfoProps {
  data: any;
  selectedRoom: any;
  setSelectedRoom: (room: any) => void;
}

const formatRupiah = (val: number | null | undefined) => {
  if (!val || isNaN(val)) return 'Rp 0';
  return new Intl.NumberFormat("id-ID", { 
    style: "currency", 
    currency: "IDR", 
    maximumFractionDigits: 0 
  }).format(val);
};

const getTransactionBadge = (jenis: string) => {
  if(jenis === 'JUAL' || jenis === 'SECONDARY') return { 
    color: 'border-emerald-500 text-emerald-400 bg-emerald-500/10', 
    label: 'Dijual', 
    icon: 'solar:tag-price-bold' 
  };
  if(jenis === 'SEWA') return { 
    color: 'border-blue-500 text-blue-400 bg-blue-500/10', 
    label: 'Disewa', 
    icon: 'solar:key-bold' 
  };
  if(jenis === 'LELANG') return { 
    color: 'border-orange-500 text-orange-400 bg-orange-500/10', 
    label: 'Lelang', 
    icon: 'solar:gavel-bold' 
  };
  return { 
    color: 'border-purple-500 text-purple-400 bg-purple-500/10', 
    label: jenis, 
    icon: 'solar:home-bold' 
  };
};

const getCategoryLabel = (kategori: string) => {
  const labels: Record<string, string> = {
    'RUMAH': 'Rumah', 'APARTEMEN': 'Apartemen', 'RUKO': 'Ruko',
    'TANAH': 'Tanah', 'GUDANG': 'Gudang', 'VILLA': 'Villa',
    'GEDUNG': 'Gedung', 'KANTOR': 'Kantor'
  };
  return labels[kategori] || kategori;
};

export default function DetailInfo({ data }: DetailInfoProps) {
  const [dpPercentage, setDpPercentage] = useState(20);
  const [tenor, setTenor] = useState(15);
  const [interestRate, setInterestRate] = useState(6.75);

  const transactionBadge = getTransactionBadge(data?.jenis_transaksi || 'JUAL');
  
  const harga = parseFloat(data?.harga) || 0;
  const hargaPromo = parseFloat(data?.harga_promo) || 0;
  const hargaFinal = hargaPromo > 0 ? hargaPromo : harga;

  const calculateKPR = () => {
    const dp = hargaFinal * (dpPercentage / 100);
    const pinjaman = hargaFinal - dp;
    const monthlyRate = (interestRate / 100) / 12;
    const totalMonths = tenor * 12;
    
    if (monthlyRate === 0) return { monthly: pinjaman / totalMonths, total: pinjaman, interest: 0, dp };
    
    const monthly = pinjaman * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1);
    const totalPayment = monthly * totalMonths;
    const totalInterest = totalPayment - pinjaman;
    
    return { monthly, total: totalPayment + dp, interest: totalInterest, dp };
  };

  const kprData = calculateKPR();

  const jenisUpper = data?.jenis_transaksi?.toString().toUpperCase();
  const isJualTransaction = jenisUpper === 'JUAL' || jenisUpper === 'SECONDARY';
  const hasValidPrice = hargaFinal > 0;
  const showKPRCalculator = isJualTransaction && hasValidPrice;

  // ✅ Smart Interest Rate Handler
  const handleInterestRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Remove leading zeros: "002.75" → "2.75"
    value = value.replace(/^0+(?=\d)/, '');
    
    if (value === '' || value === '.') {
      setInterestRate(0);
      return;
    }
    
    const numValue = parseFloat(value);
    
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 15) {
      setInterestRate(numValue);
    }
  };

  return (
    <div className="w-full lg:w-2/3 space-y-6 pb-10">
        
       {/* 1. HEADER */}
       <div className="border-b border-white/5 pb-4">
          <div className="flex justify-between items-start gap-3 mb-3">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase border ${transactionBadge.color} flex items-center gap-1.5`}>
                    <Icon icon={transactionBadge.icon} className="text-sm"/> {transactionBadge.label}
                  </span>
                  <span className="px-3 py-1.5 bg-slate-700/30 text-slate-300 border border-slate-600/30 rounded-lg text-xs font-bold uppercase">
                     {getCategoryLabel(data?.kategori || 'RUMAH')}
                  </span>
                  {data?.is_hot_deal && (
                    <span className="px-3 py-1.5 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg text-xs font-black uppercase flex items-center gap-1.5 animate-pulse shadow-lg">
                       <Icon icon="solar:fire-bold" className="text-sm"/> HOT DEAL
                    </span>
                  )}
                </div>
                
                <h1 className="text-2xl md:text-3xl font-black text-white leading-tight mb-3">
                  {data?.judul || 'Properti Tanpa Judul'}
                </h1>
                
                <div className="flex items-start gap-2 mb-3">
                  <Icon icon="solar:map-point-bold" className="text-emerald-400 text-xl flex-shrink-0 mt-0.5"/> 
                  <div className="flex-1">
                    <p className="text-base text-white font-medium leading-snug">
                      {data?.alamat_lengkap || `${data?.kecamatan || '-'}, ${data?.kota || '-'}` || 'Lokasi tidak tersedia'}
                    </p>
                    {(data?.kelurahan || data?.kecamatan || data?.kota || data?.provinsi) && (
                      <p className="text-xs text-gray-400 mt-1">
                        {[data?.kelurahan, data?.kecamatan, data?.kota, data?.provinsi].filter(Boolean).join(', ') || '-'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Icon icon="solar:eye-bold"/> {data?.dilihat || 0}
                  </span>
                  <span>•</span>
                  <span>ID: {data?.kode_properti || '-'}</span>
                  <span>•</span>
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] border border-emerald-500/20 font-medium">
                    {data?.status_tayang || 'TERSEDIA'}
                  </span>
                </div>
              </div>
              
              <button className="bg-slate-800/50 w-10 h-10 flex items-center justify-center rounded-lg text-white border border-slate-700/50 hover:bg-slate-700/50 active:scale-95 transition-all flex-shrink-0">
                  <Icon icon="solar:share-bold" className="text-lg"/>
              </button>
          </div>
       </div>

       {/* 2. OVERVIEW */}
       <div>
           <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
             <Icon icon="solar:home-2-bold-duotone" className="text-emerald-400"/>
             Ringkasan Properti
           </h3>
           
           <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/30 rounded-xl p-4 hover:border-emerald-400/40 hover:shadow-lg hover:shadow-emerald-500/10 transition-all group">
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                      <Icon icon="solar:ruler-angular-bold-duotone" className="text-amber-400 text-2xl" />
                    </div>
                    <div>
                      <p className="text-2xl font-black text-white">{data?.luas_tanah || '-'}</p>
                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wide">Luas Tanah (m²)</span>
                    </div>
                  </div>
              </div>

              <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/30 rounded-xl p-4 hover:border-emerald-400/40 hover:shadow-lg hover:shadow-emerald-500/10 transition-all group">
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                      <Icon icon="solar:home-2-bold-duotone" className="text-blue-400 text-2xl" />
                    </div>
                    <div>
                      <p className="text-2xl font-black text-white">{data?.luas_bangunan || '-'}</p>
                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wide">Luas Bangunan (m²)</span>
                    </div>
                  </div>
              </div>

              <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/30 rounded-xl p-4 hover:border-emerald-400/40 hover:shadow-lg hover:shadow-emerald-500/10 transition-all group">
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                      <Icon icon="solar:bed-bold-duotone" className="text-purple-400 text-2xl" />
                    </div>
                    <div>
                      <p className="text-2xl font-black text-white">{data?.kamar_tidur ?? '-'}</p>
                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wide">Kamar Tidur</span>
                    </div>
                  </div>
              </div>

              <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/30 rounded-xl p-4 hover:border-emerald-400/40 hover:shadow-lg hover:shadow-emerald-500/10 transition-all group">
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                      <Icon icon="solar:bath-bold-duotone" className="text-cyan-400 text-2xl" />
                    </div>
                    <div>
                      <p className="text-2xl font-black text-white">{data?.kamar_mandi ?? '-'}</p>
                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wide">Kamar Mandi</span>
                    </div>
                  </div>
              </div>

              <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/30 rounded-xl p-4 hover:border-emerald-400/40 hover:shadow-lg hover:shadow-emerald-500/10 transition-all group">
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                      <Icon icon="solar:layers-bold-duotone" className="text-rose-400 text-2xl" />
                    </div>
                    <div>
                      <p className="text-2xl font-black text-white">{data?.jumlah_lantai || '-'}</p>
                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wide">Lantai</span>
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
               <Icon icon="solar:document-text-bold-duotone" className="text-blue-400"/>
             </div>
             Deskripsi Properti
           </h3>
           <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{data.deskripsi}</p>
         </div>
       )}

       {/* 4. DETAIL SECTIONS */}
       <div className="space-y-4">
           <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/30 rounded-xl p-5">
             <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
               <div className="w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                 <Icon icon="solar:settings-bold-duotone" className="text-yellow-400"/>
               </div>
               Utilitas & Kondisi Bangunan
             </h4>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
               <div className="py-2 px-3 bg-slate-900/30 rounded-lg">
                 <span className="text-xs text-gray-400 block mb-1">Daya Listrik</span>
                 <span className="text-sm text-white font-semibold">{data?.daya_listrik ? `${data.daya_listrik} Watt` : '-'}</span>
               </div>
               <div className="py-2 px-3 bg-slate-900/30 rounded-lg">
                 <span className="text-xs text-gray-400 block mb-1">Sumber Air</span>
                 <span className="text-sm text-white font-semibold">{data?.sumber_air || '-'}</span>
               </div>
               <div className="py-2 px-3 bg-slate-900/30 rounded-lg">
                 <span className="text-xs text-gray-400 block mb-1">Kondisi Interior</span>
                 <span className="text-sm text-white font-semibold">{data?.kondisi_interior || '-'}</span>
               </div>
               <div className="py-2 px-3 bg-slate-900/30 rounded-lg">
                 <span className="text-xs text-gray-400 block mb-1">Hadap Bangunan</span>
                 <span className="text-sm text-white font-semibold">{data?.hadap_bangunan || '-'}</span>
               </div>
             </div>
           </div>

           <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/30 rounded-xl p-5">
             <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
               <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                 <Icon icon="solar:shield-check-bold-duotone" className="text-emerald-400"/>
               </div>
               Legal & Sertifikat
             </h4>
             <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
               <div className="py-2 px-3 bg-slate-900/30 rounded-lg">
                 <span className="text-xs text-gray-400 block mb-1">Jenis Sertifikat</span>
                 <span className="text-sm text-emerald-400 font-bold">{data?.legalitas || '-'}</span>
               </div>
               <div className="py-2 px-3 bg-slate-900/30 rounded-lg">
                 <span className="text-xs text-gray-400 block mb-1">Status Properti</span>
                 <span className="text-sm text-emerald-400 font-semibold">{data?.status_tayang || 'TERSEDIA'}</span>
               </div>
             </div>
           </div>
       </div>

       {/* 5. ALAMAT */}
       <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/30 rounded-xl p-5">
         <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
           <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
             <Icon icon="solar:map-point-wave-bold-duotone" className="text-emerald-400"/>
           </div>
           Alamat Lengkap
         </h4>
         <div className="space-y-3">
           <div className="py-2 px-3 bg-slate-900/30 rounded-lg">
             <span className="text-xs text-gray-400 block mb-1">Alamat</span>
             <span className="text-sm text-white font-medium">{data?.alamat_lengkap || '-'}</span>
           </div>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
             <div className="py-2 px-3 bg-slate-900/30 rounded-lg">
               <span className="text-xs text-gray-400 block mb-1">Kelurahan</span>
               <span className="text-sm text-white font-semibold">{data?.kelurahan || '-'}</span>
             </div>
             <div className="py-2 px-3 bg-slate-900/30 rounded-lg">
               <span className="text-xs text-gray-400 block mb-1">Kecamatan</span>
               <span className="text-sm text-white font-semibold">{data?.kecamatan || '-'}</span>
             </div>
             <div className="py-2 px-3 bg-slate-900/30 rounded-lg">
               <span className="text-xs text-gray-400 block mb-1">Kota/Kabupaten</span>
               <span className="text-sm text-white font-semibold">{data?.kota || '-'}</span>
             </div>
             <div className="py-2 px-3 bg-slate-900/30 rounded-lg">
               <span className="text-xs text-gray-400 block mb-1">Provinsi</span>
               <span className="text-sm text-white font-semibold">{data?.provinsi || '-'}</span>
             </div>
           </div>
           {data?.area_lokasi && (
             <div className="py-2 px-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
               <span className="text-xs text-emerald-400 block mb-1">Area</span>
               <span className="text-sm text-white font-semibold">{data.area_lokasi}</span>
             </div>
           )}
         </div>
       </div>

       {/* 6. MAP */}
       <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/30 rounded-xl p-5">
         <div className="flex justify-between items-end mb-4">
             <h3 className="text-sm font-bold flex items-center gap-2 text-white">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <Icon icon="solar:map-bold-duotone" className="text-red-400"/>
                  </div>
                  Peta Lokasi
             </h3>
             
             {data?.latitude && data?.longitude && (
               <a 
                 href={`https://www.google.com/maps/search/?api=1&query=${data.latitude},${data.longitude}`}
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1">
                   Buka di Google Maps <Icon icon="solar:arrow-right-up-linear"/>
               </a>
             )}
         </div>
         
         {data?.latitude && data?.longitude ? (
           <div className="relative w-full h-[400px] bg-slate-900 rounded-xl overflow-hidden border border-slate-700/50 shadow-xl">
               <KosMap lat={data.latitude} lng={data.longitude} />
           </div>
         ) : (
           <div className="bg-slate-900/30 border border-slate-700/30 rounded-xl p-8 flex flex-col items-center justify-center text-center">
             <Icon icon="solar:map-point-bold-duotone" className="text-6xl text-slate-700 mb-3"/>
             <h4 className="text-white font-bold mb-2">Lokasi Belum Tersedia</h4>
             <p className="text-sm text-gray-400 max-w-md">Koordinat belum diinput. Hubungi agent untuk informasi lokasi.</p>
           </div>
         )}
       </div>

       {/* 7. KPR CALCULATOR - AUTO OPEN & SMART INPUT */}
       {showKPRCalculator && (
         <div className="bg-gradient-to-br from-emerald-900/20 to-emerald-950/20 border border-emerald-500/20 rounded-xl p-5">
           {/* Header - No Toggle */}
           <div className="flex items-center gap-2 mb-5 pb-4 border-b border-emerald-500/10">
             <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
               <Icon icon="solar:calculator-bold-duotone" className="text-emerald-400 text-lg"/>
             </div>
             <div>
               <h3 className="text-base font-bold text-white">Simulasi KPR</h3>
               <p className="text-[10px] text-gray-500">Estimasi cicilan bulanan Anda</p>
             </div>
           </div>

           {/* Always Open */}
           <div className="space-y-5">
             {/* Featured Result */}
             <div className="bg-gradient-to-br from-emerald-500/5 to-transparent border border-emerald-500/20 rounded-xl p-4 text-center">
               <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide mb-1">Cicilan Per Bulan</p>
               <p className="text-3xl font-black text-white leading-tight break-words">
                 {formatRupiah(kprData.monthly)}
               </p>
             </div>

             {/* Input Controls */}
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
               {/* DP Slider */}
               <div className="space-y-2">
                 <div className="flex justify-between items-center">
                   <label className="text-[10px] text-gray-400 uppercase font-bold">Uang Muka</label>
                   <span className="text-sm font-bold text-emerald-400">{dpPercentage}%</span>
                 </div>
                 <input 
                   type="range" min="10" max="50" step="5" value={dpPercentage}
                   onChange={(e) => setDpPercentage(Number(e.target.value))}
                   className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-emerald-500"
                 />
                 <p className="text-xs font-semibold text-white text-right">{formatRupiah(kprData.dp)}</p>
               </div>

               {/* Tenor Pills */}
               <div className="space-y-2">
                 <label className="text-[10px] text-gray-400 uppercase font-bold block">Jangka Waktu</label>
                 <div className="grid grid-cols-4 gap-1.5">
                   {[5, 10, 15, 20].map(year => (
                     <button 
                       key={year} onClick={() => setTenor(year)}
                       className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
                         tenor === year 
                           ? 'bg-emerald-500 text-black' 
                           : 'bg-slate-800 text-gray-400 hover:text-white border border-slate-700'
                       }`}>
                       {year}
                     </button>
                   ))}
                 </div>
                 <p className="text-[10px] text-gray-500 text-center">Tahun</p>
               </div>

               {/* Interest Rate - SMART INPUT */}
               <div className="space-y-2">
                 <label className="text-[10px] text-gray-400 uppercase font-bold block">Suku Bunga</label>
                 <div className="relative">
                   <input 
                     type="number" 
                     step="0.25" 
                     min="3" 
                     max="15" 
                     value={interestRate || ''}
                     onChange={handleInterestRateChange}
                     onBlur={(e) => {
                       if (!e.target.value || parseFloat(e.target.value) < 3) {
                         setInterestRate(6.75);
                       }
                     }}
                     placeholder="6.75"
                     className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-semibold focus:outline-none focus:border-emerald-500 transition-colors pr-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                   />
                   <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">%</span>
                 </div>
                 <p className="text-[10px] text-gray-500">Rata-rata: 6-8%</p>
               </div>
             </div>

             {/* Results */}
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
               <div className="bg-slate-900/50 border border-slate-700/30 rounded-lg p-3">
                 <p className="text-[10px] text-gray-500 uppercase font-bold mb-1.5 truncate">Uang Muka</p>
                 <p className="text-base font-black text-white leading-tight break-words">{formatRupiah(kprData.dp)}</p>
               </div>
               
               <div className="bg-slate-900/50 border border-slate-700/30 rounded-lg p-3">
                 <p className="text-[10px] text-gray-500 uppercase font-bold mb-1.5 truncate">Pokok Pinjaman</p>
                 <p className="text-base font-black text-white leading-tight break-words">{formatRupiah(hargaFinal - kprData.dp)}</p>
               </div>
               
               <div className="bg-slate-900/50 border border-orange-500/30 rounded-lg p-3">
                 <p className="text-[10px] text-gray-500 uppercase font-bold mb-1.5 truncate">Total Bunga</p>
                 <p className="text-base font-black text-orange-400 leading-tight break-words">{formatRupiah(kprData.interest)}</p>
               </div>
               
               <div className="bg-slate-900/50 border border-emerald-500/30 rounded-lg p-3">
                 <p className="text-[10px] text-gray-500 uppercase font-bold mb-1.5 truncate">Total Bayar</p>
                 <p className="text-base font-black text-emerald-400 leading-tight break-words">{formatRupiah(kprData.total)}</p>
               </div>
             </div>

             {/* Breakdown */}
             <div className="bg-slate-900/30 border border-slate-700/20 rounded-lg p-4">
               <p className="text-[10px] font-bold text-gray-500 uppercase mb-3">Rincian Pembayaran</p>
               <div className="space-y-2">
                 <div className="flex justify-between items-center text-sm">
                   <span className="text-gray-400">Tenor</span>
                   <span className="font-bold text-white">{tenor} Tahun ({tenor * 12} Bulan)</span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                   <span className="text-gray-400">Suku Bunga</span>
                   <span className="font-bold text-white">{interestRate}% per tahun</span>
                 </div>
                 <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-700/30">
                   <span className="text-gray-400">Cicilan x {tenor * 12} bulan</span>
                   <span className="font-bold text-emerald-400">{formatRupiah(kprData.monthly * tenor * 12)}</span>
                 </div>
               </div>
             </div>

             {/* Disclaimer */}
             <div className="flex items-start gap-2 p-3 bg-slate-900/20 rounded-lg">
               <Icon icon="solar:info-circle-bold" className="text-gray-500 text-sm flex-shrink-0 mt-0.5"/>
               <p className="text-[10px] text-gray-500 leading-relaxed">
                 Kalkulasi ini adalah estimasi. Nilai aktual dapat berbeda tergantung kebijakan bank dan kelengkapan dokumen.
               </p>
             </div>
           </div>
         </div>
       )}

    </div>
  );
}

"use client";

import React, { useState } from "react";
import { Icon } from "@iconify/react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function BookingPage() {
  // --- STATE MANAGEMENT ---
  const [currentStep, setCurrentStep] = useState(1); // 1: Data, 2: Konfirmasi, 3: Bayar
  const [paymentMethod, setPaymentMethod] = useState("qris");
  
  // State Form Data (Bisa dikembangkan nanti)
  const [formData, setFormData] = useState({
      name: "",
      phone: "",
      gender: "",
      ktp: null
  });

  // Mock Data Kamar
  const bookingData = {
    roomName: "Executive Suite Kuningan",
    location: "Setiabudi, Jakarta Selatan",
    image: "/images/hero/banner.jpg", 
    price: 2500000,
    duration: 3, 
    startDate: "20 Jan 2024",
    endDate: "20 Apr 2024",
    deposit: 500000,
    serviceFee: 15000,
    discount: 150000,
  };

  const totalPrice = (bookingData.price * bookingData.duration) + bookingData.deposit + bookingData.serviceFee - bookingData.discount;
  const formatRupiah = (val: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);

  // --- NAVIGATION HANDLERS ---
  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 3));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  // --- RENDER STEPS ---
  
  // STEP 1: DATA DIRI LENGKAP (Standar Travelio/Mamikos)
  const StepOne = () => (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
        <div className="bg-[#151515] border border-white/10 rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Informasi Penyewa</h3>
                <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-1 rounded">Wajib diisi sesuai KTP</span>
            </div>
            
            {/* Nama & Kontak */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                    <label className="block text-xs font-bold text-gray-400 mb-2">Nama Lengkap (Sesuai KTP)</label>
                    <input type="text" placeholder="Contoh: Budi Santoso" className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#86efac] focus:outline-none transition-colors text-white placeholder:text-gray-600"/>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-400 mb-2">Nomor WhatsApp Aktif</label>
                    <input type="tel" placeholder="0812xxxxxxxx" className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#86efac] focus:outline-none transition-colors text-white placeholder:text-gray-600"/>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-400 mb-2">Alamat Email</label>
                    <input type="email" placeholder="email@contoh.com" className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#86efac] focus:outline-none transition-colors text-white placeholder:text-gray-600"/>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-400 mb-2">Status Pekerjaan</label>
                    <div className="relative">
                        <select className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#86efac] focus:outline-none transition-colors text-white appearance-none cursor-pointer">
                            <option value="" disabled selected>Pilih Status...</option>
                            <option value="mahasiswa">Mahasiswa</option>
                            <option value="karyawan">Karyawan / Pegawai</option>
                            <option value="wiraswasta">Wiraswasta / Freelance</option>
                        </select>
                        <Icon icon="solar:alt-arrow-down-linear" className="absolute right-4 top-3.5 text-gray-400 pointer-events-none"/>
                    </div>
                </div>
            </div>
            
            {/* Gender Selection */}
            <div>
                <label className="block text-xs font-bold text-gray-400 mb-2">Jenis Kelamin</label>
                <div className="flex gap-4">
                    <label className="flex-1 cursor-pointer group">
                        <input type="radio" name="gender" className="peer hidden" />
                        <div className="bg-[#1A1A1A] border border-white/10 rounded-xl py-3 px-4 flex items-center justify-center gap-2 text-sm text-gray-400 peer-checked:bg-[#86efac]/10 peer-checked:text-[#86efac] peer-checked:border-[#86efac] transition-all group-hover:border-white/30">
                            <Icon icon="solar:user-bold" /> Pria
                        </div>
                    </label>
                    <label className="flex-1 cursor-pointer group">
                        <input type="radio" name="gender" className="peer hidden" />
                        <div className="bg-[#1A1A1A] border border-white/10 rounded-xl py-3 px-4 flex items-center justify-center gap-2 text-sm text-gray-400 peer-checked:bg-[#86efac]/10 peer-checked:text-[#86efac] peer-checked:border-[#86efac] transition-all group-hover:border-white/30">
                            <Icon icon="solar:user-female-bold" /> Wanita
                        </div>
                    </label>
                </div>
            </div>

            {/* Emergency Contact (Fitur Safety Travelio) */}
            <div className="pt-2">
                <div className="flex items-center gap-2 mb-3">
                    <Icon icon="solar:shield-warning-bold" className="text-yellow-500"/>
                    <label className="text-xs font-bold text-white">Kontak Darurat (Tidak Serumah)</label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#1A1A1A] p-4 rounded-xl border border-white/5">
                    <div>
                        <input type="text" placeholder="Nama Kerabat" className="w-full bg-transparent border-b border-white/10 py-2 text-sm focus:border-[#86efac] focus:outline-none transition-colors text-white placeholder:text-gray-600"/>
                    </div>
                    <div>
                        <input type="tel" placeholder="Nomor HP Kerabat" className="w-full bg-transparent border-b border-white/10 py-2 text-sm focus:border-[#86efac] focus:outline-none transition-colors text-white placeholder:text-gray-600"/>
                    </div>
                </div>
            </div>

            {/* Upload KTP */}
            <div>
                 <label className="block text-xs font-bold text-gray-400 mb-2">Foto Identitas (KTP/KTM/Paspor)</label>
                 <div className="border border-dashed border-gray-600 rounded-xl p-6 flex flex-col items-center justify-center text-gray-500 hover:border-[#86efac] hover:text-[#86efac] hover:bg-[#86efac]/5 cursor-pointer transition-all bg-[#1A1A1A] group">
                     <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Icon icon="solar:card-recive-bold" className="text-2xl"/>
                     </div>
                     <span className="text-xs font-bold">Upload Foto</span>
                     <span className="text-[10px] opacity-60 mt-1">Format JPG/PNG, Maks 5MB</span>
                 </div>
            </div>
        </div>
    </motion.div>
  );

  // STEP 2: KONFIRMASI
  const StepTwo = () => (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
        <div className="bg-[#151515] border border-white/10 rounded-2xl p-6 space-y-5">
            <h3 className="text-lg font-bold text-white">Cek Rincian Pesanan</h3>
            
            {/* Ringkasan Data Diri (Read Only) */}
            <div className="bg-[#1A1A1A] rounded-xl p-4 border border-white/5 space-y-3">
                <div className="flex justify-between">
                    <span className="text-xs text-gray-500">Nama Penyewa</span>
                    <span className="text-sm font-bold text-white">Budi Santoso</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-xs text-gray-500">Nomor WhatsApp</span>
                    <span className="text-sm font-bold text-white">0812-3456-7890</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-xs text-gray-500">Jenis Kelamin</span>
                    <span className="text-sm font-bold text-white">Pria</span>
                </div>
            </div>

            {/* Aturan Kos */}
            <div>
                <h4 className="text-sm font-bold text-white mb-3">Aturan Kos Ini</h4>
                <ul className="space-y-2">
                    {['Dilarang membawa hewan peliharaan', 'Tamu lawan jenis dilarang masuk kamar', 'Jam malam tamu pukul 22.00'].map((rule, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                            <Icon icon="solar:info-circle-bold" className="text-gray-600 mt-0.5"/>
                            {rule}
                        </li>
                    ))}
                </ul>
            </div>

            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-white/5 transition-colors">
                <input type="checkbox" className="w-5 h-5 rounded border-gray-600 bg-transparent text-[#86efac] focus:ring-[#86efac]" />
                <span className="text-xs text-gray-300">Saya menyetujui <span className="text-[#86efac] underline">Syarat & Ketentuan</span> Kosku.</span>
            </label>
        </div>
    </motion.div>
  );

  // STEP 3: PEMBAYARAN
  const StepThree = () => (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
        <div className="bg-[#151515] border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-white/10">
                <h3 className="text-lg font-bold text-white">Pilih Metode Pembayaran</h3>
            </div>
            
            {/* Option: QRIS */}
            <div 
                onClick={() => setPaymentMethod("qris")}
                className={`p-5 border-b border-white/5 cursor-pointer flex items-center gap-4 transition-colors ${paymentMethod === 'qris' ? 'bg-[#86efac]/5' : 'hover:bg-white/5'}`}
            >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'qris' ? 'border-[#86efac]' : 'border-gray-500'}`}>
                    {paymentMethod === 'qris' && <div className="w-2.5 h-2.5 rounded-full bg-[#86efac]"/>}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">QRIS Instant</span>
                        <span className="text-[10px] bg-green-900 text-green-300 px-2 py-0.5 rounded-full font-bold">Otomatis</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Gopay, OVO, Dana, ShopeePay, BCA Mobile</p>
                </div>
                <Icon icon="solar:qr-code-bold" className="text-2xl text-gray-400"/>
            </div>

            {/* Option: Transfer Bank */}
            <div 
                onClick={() => setPaymentMethod("transfer")}
                className={`p-5 cursor-pointer flex items-center gap-4 transition-colors ${paymentMethod === 'transfer' ? 'bg-[#86efac]/5' : 'hover:bg-white/5'}`}
            >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'transfer' ? 'border-[#86efac]' : 'border-gray-500'}`}>
                    {paymentMethod === 'transfer' && <div className="w-2.5 h-2.5 rounded-full bg-[#86efac]"/>}
                </div>
                <div className="flex-1">
                    <span className="font-bold text-sm text-white">Transfer Bank (Verifikasi Manual)</span>
                    <p className="text-xs text-gray-500 mt-1">BCA, Mandiri, BNI, BRI</p>
                </div>
                <Icon icon="solar:card-transfer-linear" className="text-2xl text-gray-400"/>
            </div>
        </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white pb-20">
      
      {/* 1. SIMPLE HEADER */}
      <div className="border-b border-white/10 bg-[#151515] sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
           <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
              <Icon icon="solar:arrow-left-linear" className="text-xl"/>
              <span className="text-sm font-bold">Kembali</span>
           </Link>
           {/* STEPPER INDICATOR */}
           <div className="hidden md:flex items-center gap-4">
               {[1, 2, 3].map((step) => (
                   <div key={step} className="flex items-center gap-2">
                       <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${currentStep >= step ? 'bg-[#86efac] text-black' : 'bg-[#252525] text-gray-500'}`}>
                           {step}
                       </div>
                       <span className={`text-xs font-bold ${currentStep >= step ? 'text-white' : 'text-gray-600'}`}>
                           {step === 1 ? 'Data Diri' : step === 2 ? 'Konfirmasi' : 'Pembayaran'}
                       </span>
                       {step < 3 && <div className="w-8 h-[1px] bg-white/10"/>}
                   </div>
               ))}
           </div>
           <div className="flex items-center gap-2">
               <Icon icon="solar:shield-check-bold" className="text-[#86efac]"/>
               <span className="text-xs font-medium text-gray-400 hidden sm:block">Aman & Terverifikasi</span>
           </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-8 flex flex-col lg:flex-row gap-8 lg:gap-12">
        
        {/* KOLOM KIRI: DYNAMIC STEPS */}
        <div className="flex-1">
             {/* Mobile Stepper Title */}
             <div className="md:hidden mb-6">
                 <h2 className="text-xl font-bold text-white flex items-center gap-2">
                     <span className="text-[#86efac]">Langkah {currentStep}/3:</span>
                     {currentStep === 1 ? 'Data Penyewa' : currentStep === 2 ? 'Konfirmasi' : 'Pembayaran'}
                 </h2>
                 <div className="w-full h-1 bg-[#252525] mt-3 rounded-full overflow-hidden">
                     <div 
                        className="h-full bg-[#86efac] transition-all duration-500 ease-out" 
                        style={{ width: `${(currentStep/3)*100}%` }}
                     />
                 </div>
             </div>

             <AnimatePresence mode="wait">
                 {currentStep === 1 && <StepOne key="step1"/>}
                 {currentStep === 2 && <StepTwo key="step2"/>}
                 {currentStep === 3 && <StepThree key="step3"/>}
             </AnimatePresence>
             
             {/* Navigation Buttons (Desktop Layout - Inline) */}
             <div className="hidden lg:flex justify-between mt-8 pt-6 border-t border-white/10">
                 {currentStep > 1 ? (
                    <button onClick={prevStep} className="px-6 py-3 rounded-xl border border-white/20 hover:bg-white/5 text-white font-bold text-sm transition-all">
                        Kembali
                    </button>
                 ) : <div></div>}
                 
                 {currentStep < 3 && (
                    <button onClick={nextStep} className="px-8 py-3 rounded-xl bg-[#86efac] text-black font-bold text-sm hover:bg-[#6ee7b7] transition-all shadow-lg shadow-[#86efac]/10">
                        Lanjut ke {currentStep === 1 ? 'Konfirmasi' : 'Pembayaran'}
                    </button>
                 )}
             </div>
        </div>

        {/* KOLOM KANAN: STICKY SUMMARY */}
        <div className="lg:w-[380px] shrink-0">
             <div className="sticky top-24 space-y-4">
                 
                 {/* Card Rincian */}
                 <div className="bg-[#151515] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                     <div className="relative h-40 w-full">
                         <Image src={bookingData.image} fill alt="Room" className="object-cover"/>
                         <div className="absolute inset-0 bg-gradient-to-t from-[#151515] to-transparent"></div>
                         <div className="absolute bottom-4 left-4">
                             <h3 className="font-bold text-lg text-white leading-tight">{bookingData.roomName}</h3>
                             <p className="text-xs text-gray-300 flex items-center gap-1 mt-1">
                                <Icon icon="solar:map-point-bold" className="text-[#86efac]"/> {bookingData.location}
                             </p>
                         </div>
                     </div>

                     <div className="p-5 border-b border-white/5">
                         <div className="flex justify-between items-center bg-[#1A1A1A] p-3 rounded-xl">
                             <div className="text-center">
                                 <p className="text-[10px] text-gray-500 font-bold uppercase">Check In</p>
                                 <p className="text-sm font-bold text-white">{bookingData.startDate}</p>
                             </div>
                             <div className="h-8 w-[1px] bg-white/10"></div>
                             <div className="text-center">
                                 <p className="text-[10px] text-gray-500 font-bold uppercase">Check Out</p>
                                 <p className="text-sm font-bold text-white">{bookingData.endDate}</p>
                             </div>
                         </div>
                     </div>

                     <div className="p-5 space-y-3">
                         <div className="flex justify-between text-sm text-gray-400">
                             <span>Harga Sewa ({bookingData.duration} bln)</span>
                             <span>{formatRupiah(bookingData.price * bookingData.duration)}</span>
                         </div>
                         <div className="flex justify-between text-sm text-gray-400">
                             <span>Biaya Layanan</span>
                             <span>{formatRupiah(bookingData.serviceFee)}</span>
                         </div>
                         <div className="flex justify-between text-sm text-gray-400">
                             <span className="underline decoration-dotted">Deposit (Dikembalikan)</span>
                             <span>{formatRupiah(bookingData.deposit)}</span>
                         </div>
                         <div className="flex justify-between text-sm text-[#86efac] font-bold">
                             <span>Diskon Promo</span>
                             <span>- {formatRupiah(bookingData.discount)}</span>
                         </div>
                         <div className="border-t border-dashed border-white/20 my-4"></div>
                         <div className="flex justify-between items-end">
                             <span className="text-sm font-bold text-white">Total Pembayaran</span>
                             <span className="text-2xl font-extrabold text-[#86efac]">{formatRupiah(totalPrice)}</span>
                         </div>
                     </div>

                     {/* MAIN ACTION BUTTON (Berubah sesuai Step) */}
                     <div className="p-5 pt-0">
                         {currentStep === 3 ? (
                             <button className="w-full bg-[#86efac] hover:bg-[#6ee7b7] text-black font-extrabold py-4 rounded-xl shadow-[0_0_20px_rgba(134,239,172,0.2)] hover:shadow-[0_0_30px_rgba(134,239,172,0.4)] transition-all active:scale-[0.98] flex justify-center items-center gap-2">
                                <Icon icon="solar:card-bold" className="text-xl"/>
                                Bayar Sekarang
                             </button>
                         ) : (
                             // Di Mobile tombol Lanjut ada di Sticky Bottom, di Desktop ada di sini juga sebagai duplikat agar mudah dijangkau
                             <button onClick={nextStep} className="lg:hidden w-full bg-[#86efac] hover:bg-[#6ee7b7] text-black font-extrabold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98]">
                                Lanjut
                             </button>
                         )}
                     </div>
                 </div>

                 {/* Trust Box */}
                 <div className="bg-[#151515] border border-white/10 rounded-xl p-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Icon icon="solar:shield-check-bold-duotone" className="text-blue-400 text-xl"/>
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-white mb-0.5">Jaminan Aman 100%</h4>
                        <p className="text-[10px] text-gray-400 leading-relaxed">Uang diteruskan ke pemilik kos setelah check-in berhasil.</p>
                    </div>
                 </div>
             </div>
        </div>

      </div>

      {/* MOBILE STICKY BOTTOM NAV (Hanya muncul di Step 1 & 2) */}
      {currentStep < 3 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#151515] border-t border-white/10 p-4 safe-area-bottom z-50">
             <div className="flex items-center gap-3">
                 <div className="flex-1">
                     <p className="text-[10px] text-gray-400">Total Pembayaran</p>
                     <p className="text-lg font-extrabold text-[#86efac]">{formatRupiah(totalPrice)}</p>
                 </div>
                 <button onClick={nextStep} className="bg-[#86efac] text-black font-extrabold text-sm px-6 py-3 rounded-xl shadow-lg">
                    Lanjut
                 </button>
             </div>
        </div>
      )}

    </div>
  );
}
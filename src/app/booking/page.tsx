"use client";

import React, { useState, Suspense } from "react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation"; 

// --- PERBAIKAN IMPORT (MENGGUNAKAN TITIK SATU) ---
import BookingForm from "./BookingForm";
import BookingSummary from "./BookingSummary";
import BookingFAQ from "./BookingFAQ";

// MOCK DATA VOUCHER
const AVAILABLE_VOUCHERS = [
    { id: 1, code: "ANAKKOSBARU", title: "Diskon Penghuni Baru", amount: 150000, desc: "Min. sewa 1 bulan", color: "bg-green-500/20 text-green-400" },
    { id: 2, code: "KOSKUHEMAT", title: "Cashback Awal Tahun", amount: 50000, desc: "Potongan langsung", color: "bg-blue-500/20 text-blue-400" },
];

const formatRupiah = (val: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);

function BookingContent() {
  const searchParams = useSearchParams();

  // 1. DATA AWAL DARI URL
  const initialData = {
      roomName: searchParams.get('roomName') || "Kamar Standard Kosku",
      price: Number(searchParams.get('price')) || 0,
      duration: Number(searchParams.get('duration')) || 1,
      startDate: searchParams.get('start') || "-",
      endDate: searchParams.get('end') || "-",
      deposit: Number(searchParams.get('deposit')) || 0,
      serviceFee: Number(searchParams.get('serviceFee')) || 0,
      discount: Number(searchParams.get('discount')) || 0,
      image: "/images/hero/banner.jpg" 
  };

  // 2. STATE MANAGEMENT
  const [currentStep, setCurrentStep] = useState(1); 
  const [paymentMethod, setPaymentMethod] = useState("qris");
  
  // State Booking Form
  const [duration, setDuration] = useState(initialData.duration);
  const [guestCount, setGuestCount] = useState(1);
  const [parking, setParking] = useState("none"); 
  const [relationship, setRelationship] = useState("friend"); 
  const [bringChild, setBringChild] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState(initialData.discount);
  const [selectedVoucherId, setSelectedVoucherId] = useState<number | null>(null);

  // 3. LOGIC HARGA
  const extraChargeAdult = 500000; 
  const parkingFee = parking === "mobil" ? 300000 : parking === "motor" ? 50000 : 0;
  
  const voucherDiscount = selectedVoucherId 
    ? (AVAILABLE_VOUCHERS.find(v => v.id === selectedVoucherId)?.amount || 0)
    : appliedVoucher;
  
  const monthlyItemCost = initialData.price + (guestCount > 1 ? extraChargeAdult : 0) + parkingFee;
  const totalRentCost = monthlyItemCost * duration;
  const totalPrice = totalRentCost + initialData.deposit + initialData.serviceFee - voucherDiscount;

  // Handlers
  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 3));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));
  
  const handleApplyVoucher = () => {
      if(voucherCode === "DISKON") { setAppliedVoucher(100000); alert("Voucher Manual Berhasil!"); } 
      else { alert("Kode Salah"); }
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white pb-20">
      
      {/* HEADER SIMPLE */}
      <div className="border-b border-white/10 bg-[#151515] sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
           <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
              <Icon icon="solar:arrow-left-linear" className="text-xl"/>
              <span className="text-sm font-bold">Kembali</span>
           </Link>
           <div className="hidden md:flex items-center gap-4">
               {[1, 2, 3].map((step) => (
                   <div key={step} className="flex items-center gap-2">
                       <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${currentStep >= step ? 'bg-[#86efac] text-black' : 'bg-[#252525] text-gray-500'}`}>{step}</div>
                       <span className={`text-xs font-bold ${currentStep >= step ? 'text-white' : 'text-gray-600'}`}>{step === 1 ? 'Atur Pesanan' : step === 2 ? 'Data Diri' : 'Bayar'}</span>
                       {step < 3 && <div className="w-8 h-[1px] bg-white/10"/>}
                   </div>
               ))}
           </div>
           <div className="flex items-center gap-2"><Icon icon="solar:shield-check-bold" className="text-[#86efac]"/><span className="text-xs font-medium text-gray-400 hidden sm:block">Aman & Terverifikasi</span></div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-8 flex flex-col lg:flex-row gap-8 lg:gap-12">
        
        {/* KOLOM KIRI (FORM) */}
        <BookingForm 
            currentStep={currentStep} prevStep={prevStep} nextStep={nextStep}
            initialData={initialData} duration={duration} setDuration={setDuration}
            guestCount={guestCount} setGuestCount={setGuestCount}
            parking={parking} setParking={setParking}
            relationship={relationship} setRelationship={setRelationship}
            bringChild={bringChild} setBringChild={setBringChild}
            voucherCode={voucherCode} setVoucherCode={setVoucherCode}
            handleApplyVoucher={handleApplyVoucher} appliedVoucher={appliedVoucher}
            selectedVoucherId={selectedVoucherId} setSelectedVoucherId={setSelectedVoucherId}
            availableVouchers={AVAILABLE_VOUCHERS}
            extraChargeAdult={extraChargeAdult}
            paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
        />

        {/* KOLOM KANAN (SUMMARY) */}
        <div className="lg:w-[380px] shrink-0">
             <BookingSummary 
                initialData={initialData} duration={duration}
                guestCount={guestCount} extraChargeAdult={extraChargeAdult}
                parking={parking} parkingFee={parkingFee}
                totalRentCost={totalRentCost} voucherDiscount={voucherDiscount}
                totalPrice={totalPrice} currentStep={currentStep} nextStep={nextStep}
             />
        </div>

      </div>

      {/* SECTION FAQ (EDUKASI) - DI BAWAH FORM */}
      <div className="max-w-6xl mx-auto px-4">
          <BookingFAQ />
      </div>

      {/* MOBILE STICKY (Hanya muncul jika belum Step 3) */}
      {currentStep < 3 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#151515] border-t border-white/10 p-4 safe-area-bottom z-50">
             <div className="flex items-center gap-3">
                 <div className="flex-1"><p className="text-[10px] text-gray-400">Total Pembayaran</p><p className="text-lg font-extrabold text-[#86efac]">{formatRupiah(totalPrice)}</p></div>
                 <button onClick={nextStep} className="bg-[#86efac] text-black font-extrabold text-sm px-6 py-3 rounded-xl shadow-lg">Lanjut</button>
             </div>
        </div>
      )}

    </div>
  );
}

// --- DEFAULT EXPORT ---
export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0F0F0F] text-white flex items-center justify-center">Loading...</div>}>
      <BookingContent />
    </Suspense>
  );
}
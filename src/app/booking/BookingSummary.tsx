"use client";
import React from "react";
import { Icon } from "@iconify/react";
import Image from "next/image";

// Helper format rupiah
const formatRupiah = (val: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);

// Helper Hitung Tanggal Checkout (New)
const getCheckoutDate = (startDateStr: string, durationMonths: number) => {
    if (!startDateStr || startDateStr === "-") return "-";
    
    try {
        // Parsing tanggal (Asumsi format: "20 Jan 2024")
        const date = new Date(startDateStr);
        
        // Validasi jika tanggal tidak valid
        if (isNaN(date.getTime())) return "-"; 

        // Tambah Bulan sesuai durasi
        date.setMonth(date.getMonth() + durationMonths);

        // Format kembali ke Bahasa Indonesia (Contoh: 20 Apr 2024)
        return new Intl.DateTimeFormat('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }).format(date);
    } catch (e) {
        return "-";
    }
};

export default function BookingSummary({ 
  initialData, duration, guestCount, extraChargeAdult, 
  parking, parkingFee, totalRentCost, voucherDiscount, 
  totalPrice, currentStep, nextStep 
}: any) {
  return (
    <div className="sticky top-24 space-y-4">
        
        {/* Card Rincian */}
        <div className="bg-[#151515] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="relative h-40 w-full">
                <Image src={initialData.image} fill alt="Room" className="object-cover"/>
                <div className="absolute inset-0 bg-gradient-to-t from-[#151515] to-transparent"></div>
                <div className="absolute bottom-4 left-4">
                    <h3 className="font-bold text-lg text-white leading-tight">{initialData.roomName}</h3>
                    <p className="text-xs text-gray-300 flex items-center gap-1 mt-1"><Icon icon="solar:map-point-bold" className="text-[#86efac]"/> Lokasi Kos</p>
                </div>
            </div>

            <div className="p-5 border-b border-white/5">
                <div className="flex justify-between items-center bg-[#1A1A1A] p-3 rounded-xl">
                    <div className="text-center">
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Check In</p>
                        <p className="text-sm font-bold text-white">{initialData.startDate}</p>
                    </div>
                    
                    {/* Divider Vertical */}
                    <div className="h-8 w-[1px] bg-white/10"></div>
                    
                    <div className="text-center">
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Check Out</p>
                        {/* UPDATE DISINI: Menampilkan Tanggal Real, bukan "+ Bulan" */}
                        <p className="text-sm font-bold text-white">
                            {getCheckoutDate(initialData.startDate, duration)}
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-5 space-y-3">
                <div className="flex justify-between text-sm text-gray-400"><span>Harga Sewa ({duration} bln)</span><span>{formatRupiah(totalRentCost)}</span></div>
                
                {/* Rincian Tambahan Dinamis */}
                <div className="pl-2 space-y-1">
                    {guestCount > 1 && (<div className="flex justify-between text-[10px] text-gray-500"><span>• Extra Orang (x{duration})</span><span>{formatRupiah(extraChargeAdult * duration)}</span></div>)}
                    {parking !== 'none' && (<div className="flex justify-between text-[10px] text-gray-500"><span>• Parkir {parking} (x{duration})</span><span>{formatRupiah(parkingFee * duration)}</span></div>)}
                </div>

                <div className="flex justify-between text-sm text-gray-400"><span>Biaya Layanan</span><span>{formatRupiah(initialData.serviceFee)}</span></div>
                <div className="flex justify-between text-sm text-gray-400"><span className="underline decoration-dotted">Deposit (Dikembalikan)</span><span>{formatRupiah(initialData.deposit)}</span></div>
                
                {voucherDiscount > 0 && <div className="flex justify-between text-sm text-[#86efac] font-bold"><span>Diskon Promo</span><span>- {formatRupiah(voucherDiscount)}</span></div>}
                
                <div className="border-t border-dashed border-white/20 my-4"></div>
                <div className="flex justify-between items-end"><span className="text-sm font-bold text-white">Total Pembayaran</span><span className="text-2xl font-extrabold text-[#86efac]">{formatRupiah(totalPrice)}</span></div>
            </div>

            <div className="p-5 pt-0">
                {currentStep === 3 ? (
                    <button className="w-full bg-[#86efac] hover:bg-[#6ee7b7] text-black font-extrabold py-4 rounded-xl shadow-[0_0_20px_rgba(134,239,172,0.2)] hover:shadow-[0_0_30px_rgba(134,239,172,0.4)] transition-all active:scale-[0.98] flex justify-center items-center gap-2"><Icon icon="solar:card-bold" className="text-xl"/> Bayar Sekarang</button>
                ) : (
                    <button onClick={nextStep} className="lg:hidden w-full bg-[#86efac] hover:bg-[#6ee7b7] text-black font-extrabold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98]">Lanjut</button>
                )}
            </div>
        </div>

        {/* Trust Signal */}
        <div className="bg-[#151515] border border-white/10 rounded-xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0"><Icon icon="solar:shield-check-bold-duotone" className="text-blue-400 text-xl"/></div>
            <div><h4 className="text-xs font-bold text-white mb-0.5">Jaminan Aman 100%</h4><p className="text-[10px] text-gray-400 leading-relaxed">Uang diteruskan ke pemilik kos setelah check-in berhasil.</p></div>
        </div>
    </div>
  );
}
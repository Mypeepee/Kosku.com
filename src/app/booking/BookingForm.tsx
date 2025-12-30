"use client";
import React from "react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";

// Helper format rupiah
const formatRupiah = (val: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);

export default function BookingForm({
  currentStep, prevStep, nextStep,
  initialData, duration, setDuration,
  guestCount, setGuestCount,
  parking, setParking,
  relationship, setRelationship,
  bringChild, setBringChild,
  voucherCode, setVoucherCode, handleApplyVoucher, appliedVoucher, selectedVoucherId, setSelectedVoucherId, availableVouchers,
  extraChargeAdult,
  paymentMethod, setPaymentMethod
}: any) {

  return (
    <div className="flex-1">
         {/* Mobile Stepper Title */}
         <div className="md:hidden mb-6">
             <h2 className="text-xl font-bold text-white flex items-center gap-2">
                 <span className="text-[#86efac]">Langkah {currentStep}/3:</span>
                 {currentStep === 1 ? 'Atur Pesanan' : currentStep === 2 ? 'Data Diri' : 'Pembayaran'}
             </h2>
             <div className="w-full h-1 bg-[#252525] mt-3 rounded-full overflow-hidden">
                 <div className="h-full bg-[#86efac] transition-all duration-500 ease-out" style={{ width: `${(currentStep/3)*100}%` }}/>
             </div>
         </div>

         <AnimatePresence mode="wait">
             
             {/* ================= STEP 1: ATUR PESANAN ================= */}
             {currentStep === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }} className="bg-[#151515] border border-white/10 rounded-2xl p-6 space-y-8">
                    
                    {/* A. DURASI SEWA */}
                    <div className="bg-[#1A1A1A] p-4 rounded-xl border border-white/5">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm font-bold text-white flex items-center gap-2"><Icon icon="solar:clock-circle-bold" className="text-[#86efac]"/> Durasi Sewa</h4>
                            <div className="flex items-center gap-3 bg-black/40 rounded-lg p-1 border border-white/10">
                                <button onClick={() => setDuration(Math.max(1, duration - 1))} className="w-8 h-8 flex items-center justify-center bg-[#252525] rounded text-white hover:bg-white/20 text-lg active:scale-95 transition-all">-</button>
                                <span className="text-sm font-bold text-white w-16 text-center">{duration} Bln</span>
                                <button onClick={() => setDuration(duration + 1)} className="w-8 h-8 flex items-center justify-center bg-[#252525] rounded text-white hover:bg-white/20 text-lg active:scale-95 transition-all">+</button>
                            </div>
                        </div>
                        <div className="flex justify-between items-center text-xs text-gray-500 border-t border-dashed border-white/10 pt-3">
                            <span>Mulai: <b className="text-gray-300">{initialData.startDate}</b></span>
                            <Icon icon="solar:arrow-right-linear"/>
                            <span>Selesai: <b className="text-[#86efac]">Auto Update (+{duration} Bln)</b></span>
                        </div>
                    </div>

                    {/* B. PENGHUNI */}
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-3">Rincian Penghuni</label>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div onClick={() => setGuestCount(1)} className={`cursor-pointer border rounded-2xl p-4 flex flex-col items-center justify-center gap-2 transition-all ${guestCount === 1 ? 'bg-[#86efac]/10 border-[#86efac] text-[#86efac]' : 'bg-[#1A1A1A] border-white/10 text-gray-400 hover:border-white/30'}`}>
                                <Icon icon="solar:user-bold" className="text-3xl"/>
                                <span className="text-sm font-bold">1 Orang</span>
                            </div>
                            <div onClick={() => setGuestCount(2)} className={`cursor-pointer border rounded-2xl p-4 flex flex-col items-center justify-center gap-2 transition-all ${guestCount === 2 ? 'bg-[#86efac]/10 border-[#86efac] text-[#86efac]' : 'bg-[#1A1A1A] border-white/10 text-gray-400 hover:border-white/30'}`}>
                                <div className="flex gap-1"><Icon icon="solar:user-bold" className="text-3xl"/><Icon icon="solar:user-bold" className="text-3xl"/></div>
                                <span className="text-sm font-bold">2 Orang</span>
                                <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-white">+{formatRupiah(extraChargeAdult)}/bln</span>
                            </div>
                        </div>

                        {/* Status Hubungan (Muncul jika 2 org) */}
                        <AnimatePresence>
                        {guestCount === 2 && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-4">
                                <div className="p-4 bg-[#1A1A1A] rounded-xl border border-white/10">
                                    <p className="text-[10px] text-gray-400 mb-3 font-bold uppercase">Status Hubungan:</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div onClick={() => setRelationship('couple')} className={`cursor-pointer border rounded-xl p-3 flex flex-col items-center gap-1 transition-all ${relationship === 'couple' ? 'border-[#86efac] bg-[#86efac]/10 text-white' : 'border-white/10 text-gray-500 hover:bg-white/5'}`}>
                                            <Icon icon="solar:heart-bold" className="text-xl text-pink-500"/>
                                            <span className="text-xs font-bold">Pasutri</span>
                                        </div>
                                        <div onClick={() => setRelationship('friend')} className={`cursor-pointer border rounded-xl p-3 flex flex-col items-center gap-1 transition-all ${relationship === 'friend' ? 'border-[#86efac] bg-[#86efac]/10 text-white' : 'border-white/10 text-gray-500 hover:bg-white/5'}`}>
                                            <Icon icon="solar:users-group-rounded-bold" className="text-xl text-blue-500"/>
                                            <span className="text-xs font-bold">Teman</span>
                                        </div>
                                    </div>
                                    {relationship === 'couple' && <p className="text-[10px] text-yellow-500 mt-3 italic flex gap-1 items-center bg-yellow-500/10 p-2 rounded-lg"><Icon icon="solar:info-circle-bold"/> Wajib tunjukkan Buku Nikah saat check-in.</p>}
                                </div>
                            </motion.div>
                        )}
                        </AnimatePresence>

                        {/* Toggle Anak */}
                        <div className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${bringChild ? 'border-[#86efac] bg-[#86efac]/5' : 'border-white/10 bg-[#1A1A1A] hover:border-white/30'}`} onClick={() => setBringChild(!bringChild)}>
                            <div className="flex items-center gap-3">
                                <div className="bg-pink-500/20 text-pink-400 p-2 rounded-lg"><Icon icon="solar:user-hand-up-bold" className="text-xl"/></div>
                                <div><p className="text-sm font-bold text-white">Membawa Anak Kecil?</p><p className="text-[10px] text-gray-500">Maksimal 1 anak (Balita free)</p></div>
                            </div>
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${bringChild ? 'bg-[#86efac] border-[#86efac]' : 'border-gray-500'}`}>{bringChild && <Icon icon="solar:check-read-linear" className="text-black text-sm"/>}</div>
                        </div>
                    </div>

                    {/* C. KENDARAAN (ICON DIPERBAIKI) */}
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-3">Bawa Kendaraan?</label>
                        <div className="grid grid-cols-3 gap-3">
                            <div onClick={() => setParking('none')} className={`cursor-pointer border rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 h-28 transition-all relative overflow-hidden ${parking === 'none' ? 'border-[#86efac] bg-[#86efac]/10' : 'border-white/10 bg-[#1A1A1A] hover:bg-white/5'}`}>
                                <Icon icon="solar:walking-round-bold" className={`text-3xl ${parking === 'none' ? 'text-[#86efac]' : 'text-gray-500'}`}/><span className={`text-xs font-bold ${parking === 'none' ? 'text-white' : 'text-gray-400'}`}>Tidak Ada</span><span className="text-[10px] text-green-400 font-medium bg-green-400/10 px-1.5 rounded">Free</span>
                                {parking === 'none' && <div className="absolute top-2 right-2 text-[#86efac]"><Icon icon="solar:check-circle-bold"/></div>}
                            </div>
                            
                            {/* Icon Motor & Mobil diganti dengan yang lebih umum agar pasti muncul */}
                            <div onClick={() => setParking('motor')} className={`cursor-pointer border rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 h-28 transition-all relative overflow-hidden ${parking === 'motor' ? 'border-[#86efac] bg-[#86efac]/10' : 'border-white/10 bg-[#1A1A1A] hover:bg-white/5'}`}>
                                <Icon icon="solar:bicycling-bold" className={`text-3xl ${parking === 'motor' ? 'text-[#86efac]' : 'text-gray-500'}`}/>
                                <span className={`text-xs font-bold ${parking === 'motor' ? 'text-white' : 'text-gray-400'}`}>Motor</span><span className="text-[10px] text-gray-400 font-medium">+50rb</span>
                                {parking === 'motor' && <div className="absolute top-2 right-2 text-[#86efac]"><Icon icon="solar:check-circle-bold"/></div>}
                            </div>
                            
                            <div onClick={() => setParking('mobil')} className={`cursor-pointer border rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 h-28 transition-all relative overflow-hidden ${parking === 'mobil' ? 'border-[#86efac] bg-[#86efac]/10' : 'border-white/10 bg-[#1A1A1A] hover:bg-white/5'}`}>
                                <Icon icon="solar:wheel-bold" className={`text-3xl ${parking === 'mobil' ? 'text-[#86efac]' : 'text-gray-500'}`}/>
                                <span className={`text-xs font-bold ${parking === 'mobil' ? 'text-white' : 'text-gray-400'}`}>Mobil</span><span className="text-[10px] text-gray-400 font-medium">+300rb</span>
                                {parking === 'mobil' && <div className="absolute top-2 right-2 text-[#86efac]"><Icon icon="solar:check-circle-bold"/></div>}
                            </div>
                        </div>
                    </div>

                    {/* D. VOUCHER */}
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-3">Voucher Hemat</label>
                        <div className="space-y-3">
                            <div className="flex gap-2 mb-3">
                                <input type="text" value={voucherCode} onChange={(e) => setVoucherCode(e.target.value.toUpperCase())} placeholder="Masukkan kode promo" className="flex-1 bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#86efac] focus:outline-none transition-colors text-white placeholder:text-gray-600 uppercase"/>
                                <button onClick={handleApplyVoucher} className="bg-[#252525] border border-white/10 text-white font-bold px-4 rounded-xl hover:bg-white/10 text-sm active:scale-95 transition-transform">Gunakan</button>
                            </div>
                            {appliedVoucher > 0 && selectedVoucherId === null && <p className="text-xs text-[#86efac] mt-2 flex items-center gap-1"><Icon icon="solar:check-circle-bold"/> Voucher Manual Digunakan</p>}

                            {availableVouchers.map((v: any) => (
                                <div key={v.id} onClick={() => setSelectedVoucherId(selectedVoucherId === v.id ? null : v.id)} className={`border rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all ${selectedVoucherId === v.id ? 'border-[#86efac] bg-[#86efac]/10' : 'border-white/10 bg-[#1A1A1A] hover:border-white/30'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${selectedVoucherId === v.id ? 'bg-[#86efac] text-black' : 'bg-[#252525] text-gray-400'}`}><Icon icon="solar:ticket-sale-bold" className="text-lg"/></div>
                                        <div><p className={`text-sm font-bold ${selectedVoucherId === v.id ? 'text-[#86efac]' : 'text-white'}`}>{v.code}</p><p className="text-[10px] text-gray-400">{v.desc}</p></div>
                                    </div>
                                    <div className="text-right"><p className="text-xs font-bold text-[#86efac]">- {formatRupiah(v.amount)}</p>{selectedVoucherId === v.id && <div className="text-[10px] text-gray-400 flex items-center justify-end gap-1 mt-0.5"><Icon icon="solar:check-circle-bold"/> Dipakai</div>}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
             )}

             {/* ================= STEP 2: DATA DIRI (REVISI UI/UX) ================= */}
             {currentStep === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }} className="bg-[#151515] border border-white/10 rounded-2xl p-6 space-y-6">
                    <div className="flex items-center justify-between"><h3 className="text-lg font-bold text-white">Data Penyewa</h3><span className="text-[10px] text-gray-500 bg-white/5 px-2 py-1 rounded">Wajib sesuai KTP</span></div>
                    
                    {/* INFO UTAMA */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2">Nama Lengkap (Sesuai KTP)</label>
                            <input type="text" placeholder="Budi Santoso" className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#86efac] focus:outline-none transition-colors text-white"/>
                        </div>
                        
                        {/* UPDATE: NO HP DISABLED + OTP ICON */}
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2">Nomor WhatsApp</label>
                            <div className="relative">
                                <input 
                                    type="tel" 
                                    value="0812-3456-7890" 
                                    disabled 
                                    className="w-full bg-[#252525] border border-white/5 rounded-xl px-4 py-3 text-sm text-gray-400 cursor-not-allowed pr-24"
                                />
                                <div className="absolute right-2 top-1.5 bottom-1.5">
                                    <button className="h-full bg-[#86efac]/10 hover:bg-[#86efac]/20 text-[#86efac] text-[10px] font-bold px-3 rounded-lg border border-[#86efac]/20 flex items-center gap-1 transition-colors">
                                        <Icon icon="solar:shield-check-bold"/> Verifikasi
                                    </button>
                                </div>
                            </div>
                            <p className="text-[10px] text-yellow-500/80 mt-1.5 flex items-center gap-1">
                                <Icon icon="solar:info-circle-linear"/> Wajib verifikasi OTP sebelum lanjut.
                            </p>
                        </div>

                        {/* UPDATE: STATUS PEKERJAAN (Standard Booking App) */}
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2">Status Pekerjaan</label>
                            <div className="relative">
                                <select className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#86efac] focus:outline-none transition-colors text-white appearance-none cursor-pointer">
                                    <option value="" disabled selected>Pilih Status...</option>
                                    <option value="mahasiswa">Mahasiswa</option>
                                    <option value="karyawan">Karyawan / Pegawai</option>
                                    <option value="wiraswasta">Wiraswasta / Freelance</option>
                                    <option value="keluarga">Pasangan Suami Istri</option>
                                </select>
                                <Icon icon="solar:alt-arrow-down-linear" className="absolute right-4 top-3.5 text-gray-400 pointer-events-none"/>
                            </div>
                        </div>

                        {/* UPDATE: EMAIL */}
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2">Email (Untuk E-Tiket)</label>
                            <input type="email" placeholder="email@contoh.com" className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#86efac] focus:outline-none transition-colors text-white"/>
                        </div>
                    </div>

                    {/* UPDATE: EMERGENCY CONTACT (Standard Safety) */}
                    <div className="pt-2 border-t border-white/5">
                        <div className="flex items-center gap-2 mb-3">
                            <Icon icon="solar:shield-warning-bold" className="text-orange-400"/>
                            <label className="text-xs font-bold text-white">Kontak Darurat (Tidak Serumah)</label>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <input type="text" placeholder="Nama Kerabat" className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white"/>
                            <input type="tel" placeholder="No. HP Kerabat" className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white"/>
                        </div>
                    </div>
                    
                    {/* Ringkasan Step 1 (Visual Only) */}
                    <div className="p-3 bg-[#86efac]/5 rounded-xl border border-[#86efac]/10 flex items-start gap-3">
                        <Icon icon="solar:notes-bold" className="text-[#86efac] mt-0.5"/>
                        <div className="text-xs text-gray-400">
                            <p className="mb-1"><span className="text-white font-bold">Rincian Hunian:</span></p>
                            <p>• {guestCount} Dewasa {relationship === 'couple' ? '(Pasutri)' : ''} {bringChild ? '+ 1 Anak' : ''}</p>
                            <p>• {parking === 'none' ? 'Tanpa Kendaraan' : `Parkir ${parking.charAt(0).toUpperCase() + parking.slice(1)}`}</p>
                        </div>
                    </div>

                    {/* Upload KTP */}
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2">Foto Identitas (KTP/Passport)</label>
                        <div className="border border-dashed border-gray-600 rounded-xl p-6 flex flex-col items-center justify-center text-gray-500 hover:border-[#86efac] hover:text-[#86efac] hover:bg-[#86efac]/5 cursor-pointer transition-all bg-[#1A1A1A] group">
                            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                <Icon icon="solar:camera-add-bold" className="text-xl"/>
                            </div>
                            <span className="text-xs">Klik untuk upload foto</span>
                        </div>
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer pt-2 bg-black/20 p-3 rounded-lg border border-white/5">
                        <input type="checkbox" className="w-4 h-4 mt-0.5 rounded border-gray-600 bg-transparent text-[#86efac] focus:ring-[#86efac]" />
                        <span className="text-[10px] text-gray-400 leading-relaxed">Saya menyatakan data di atas benar dan menyetujui <span className="text-[#86efac] underline">Syarat & Ketentuan</span> Kosku. Pemalsuan identitas dapat diproses secara hukum.</span>
                    </label>
                </motion.div>
             )}

             {/* ================= STEP 3: PEMBAYARAN ================= */}
             {currentStep === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }} className="bg-[#151515] border border-white/10 rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-white/10 bg-[#1A1A1A]"><h3 className="text-lg font-bold text-white">Pilih Metode Pembayaran</h3></div>
                    <div onClick={() => setPaymentMethod("qris")} className={`p-5 border-b border-white/5 cursor-pointer flex items-center gap-4 transition-colors ${paymentMethod === 'qris' ? 'bg-[#86efac]/5' : 'hover:bg-white/5'}`}><div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'qris' ? 'border-[#86efac]' : 'border-gray-500'}`}>{paymentMethod === 'qris' && <div className="w-2.5 h-2.5 rounded-full bg-[#86efac]"/>}</div><div className="flex-1"><div className="flex items-center gap-2"><span className="font-bold text-sm text-white">QRIS Instant</span><span className="text-[10px] bg-green-900 text-green-300 px-2 py-0.5 rounded-full font-bold">Otomatis</span></div><p className="text-xs text-gray-500 mt-1">Gopay, OVO, Dana, ShopeePay</p></div><Icon icon="solar:qr-code-bold" className="text-2xl text-gray-400"/></div>
                    <div onClick={() => setPaymentMethod("transfer")} className={`p-5 cursor-pointer flex items-center gap-4 transition-colors ${paymentMethod === 'transfer' ? 'bg-[#86efac]/5' : 'hover:bg-white/5'}`}><div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'transfer' ? 'border-[#86efac]' : 'border-gray-500'}`}>{paymentMethod === 'transfer' && <div className="w-2.5 h-2.5 rounded-full bg-[#86efac]"/>}</div><div className="flex-1"><span className="font-bold text-sm text-white">Transfer Bank (Verifikasi Manual)</span><p className="text-xs text-gray-500 mt-1">BCA, Mandiri, BNI, BRI</p></div><Icon icon="solar:card-transfer-linear" className="text-2xl text-gray-400"/></div>
                </motion.div>
             )}
         </AnimatePresence>
         
         <div className="hidden lg:flex justify-between mt-8 pt-6 border-t border-white/10">
             {currentStep > 1 ? (<button onClick={prevStep} className="px-6 py-3 rounded-xl border border-white/20 hover:bg-white/5 text-white font-bold text-sm transition-all">Kembali</button>) : <div></div>}
             {currentStep < 3 && (<button onClick={nextStep} className="px-8 py-3 rounded-xl bg-[#86efac] text-black font-bold text-sm hover:bg-[#6ee7b7] transition-all shadow-lg shadow-[#86efac]/10">Lanjut ke {currentStep === 1 ? 'Data Diri' : 'Pembayaran'}</button>)}
         </div>
    </div>
  );
}
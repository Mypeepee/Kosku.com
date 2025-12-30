"use client";
import React, { useState } from "react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";

// --- DATA: TIMELINE ALUR DANA (TRUST SYSTEM) ---
const SAFETY_STEPS = [
    {
        icon: "solar:wallet-money-bold",
        title: "1. Pembayaran Aman",
        desc: "Uang Anda ditahan aman di Rekening Bersama Kosku, tidak langsung ke pemilik.",
        color: "text-blue-400 bg-blue-400/10"
    },
    {
        icon: "solar:key-bold",
        title: "2. Serah Terima",
        desc: "Anda datang ke lokasi, bertemu pemilik, dan cek kondisi kamar secara langsung.",
        color: "text-yellow-400 bg-yellow-400/10"
    },
    {
        icon: "solar:shield-check-bold",
        title: "3. Konfirmasi / Klaim",
        desc: "Jika sesuai, dana diteruskan. Jika BEDA DENGAN FOTO, ajukan klaim refund dalam 1x24 jam.",
        color: "text-green-400 bg-green-400/10"
    }
];

// --- DATA: FAQ LENGKAP ---
const FAQS = [
    { 
        q: "Bagaimana jika kamar aslinya kotor atau beda dengan foto?", 
        a: "Jangan khawatir! Uang Anda masih ada di kami. Cukup foto kondisi kamar dan ajukan komplain lewat aplikasi maksimal 1x24 jam setelah check-in. Jika terbukti tidak sesuai, kami carikan kos pengganti atau Refund 100%." 
    },
    { 
        q: "Kapan alamat lengkap & kontak pemilik muncul?", 
        a: "Demi privasi dan keamanan (Anti-Bypass), alamat detail dan No. WA pemilik akan otomatis muncul di menu 'Tiket Saya' segera setelah pembayaran Anda berhasil dikonfirmasi." 
    },
    { 
        q: "Apakah biaya listrik sudah termasuk?", 
        a: "Tergantung kebijakan kamar yang Anda pilih. Cek kembali bagian 'Fasilitas' di rincian pesanan di atas. Jika tertulis 'Listrik Token', berarti biaya listrik ditanggung penyewa." 
    },
    { 
        q: "Bisakah saya membatalkan pesanan?", 
        a: "Bisa. Pembatalan H-7 check-in akan mendapatkan refund penuh (dikurangi biaya admin). Pembatalan mendadak mengikuti kebijakan pemilik kos masing-masing." 
    },
];

export default function BookingFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="mt-12 mb-20 border-t border-white/10 pt-10">
        
        {/* SECTION 1: TRUST TIMELINE (JAWABAN "KALAU GAK COCOK GIMANA?") */}
        <div className="mb-12">
            <div className="text-center mb-8">
                <h3 className="text-xl font-bold text-white mb-2">Jaminan Transaksi Aman</h3>
                <p className="text-sm text-gray-400">Kami melindungi uang Anda sampai Anda resmi check-in.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
                {/* Garis Penghubung (Desktop Only) */}
                <div className="hidden md:block absolute top-6 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-blue-500/20 via-yellow-500/20 to-green-500/20 -z-10 transform translate-y-1/2"></div>

                {SAFETY_STEPS.map((step, i) => (
                    <div key={i} className="bg-[#151515] border border-white/10 rounded-2xl p-6 relative flex flex-col items-center text-center hover:border-white/20 transition-all group">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 text-2xl ${step.color} shadow-lg shadow-black/50 group-hover:scale-110 transition-transform`}>
                            <Icon icon={step.icon}/>
                        </div>
                        <h4 className="text-white font-bold mb-2">{step.title}</h4>
                        <p className="text-xs text-gray-400 leading-relaxed">{step.desc}</p>
                    </div>
                ))}
            </div>
        </div>

        {/* SECTION 2: ACCORDION FAQ */}
        <div>
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <Icon icon="solar:question-circle-bold" className="text-[#86efac]"/>
                Pertanyaan Populer
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {FAQS.map((faq, i) => (
                    <div 
                        key={i} 
                        onClick={() => setOpenIndex(openIndex === i ? null : i)} 
                        className={`border rounded-xl p-5 cursor-pointer transition-all duration-300 ${openIndex === i ? 'bg-[#1A1A1A] border-[#86efac]/30' : 'bg-[#151515] border-white/10 hover:border-white/30'}`}
                    >
                        <div className="flex justify-between items-start gap-3">
                            <h4 className={`text-sm font-bold leading-snug ${openIndex === i ? 'text-[#86efac]' : 'text-gray-200'}`}>{faq.q}</h4>
                            <Icon icon="solar:alt-arrow-down-linear" className={`text-gray-500 text-lg transition-transform duration-300 shrink-0 ${openIndex === i ? 'rotate-180 text-[#86efac]' : ''}`}/>
                        </div>
                        <AnimatePresence>
                            {openIndex === i && (
                                <motion.div 
                                    initial={{ height: 0, opacity: 0, marginTop: 0 }} 
                                    animate={{ height: "auto", opacity: 1, marginTop: 12 }} 
                                    exit={{ height: 0, opacity: 0, marginTop: 0 }} 
                                    className="overflow-hidden"
                                >
                                    <p className="text-xs text-gray-400 leading-relaxed border-l-2 border-white/10 pl-3">{faq.a}</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>
        </div>

    </div>
  );
}
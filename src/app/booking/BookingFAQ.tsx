"use client";
import React, { useState } from "react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";

// --- DATA: TIMELINE TRUST SYSTEM ---
const TRUST_STEPS = [
    {
        step: "01",
        title: "Bayar & Tahan",
        desc: "Pembayaran Anda aman di Rekening Bersama Kosku. Dana tidak langsung cair ke pemilik.",
        icon: "solar:shield-check-bold-duotone",
        color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
    },
    {
        step: "02",
        title: "Cek Lokasi",
        desc: "Datang saat check-in. Pastikan fasilitas & kondisi kamar sesuai dengan foto di aplikasi.",
        icon: "solar:map-point-bold-duotone",
        color: "text-blue-400 bg-blue-400/10 border-blue-400/20"
    },
    {
        step: "03",
        title: "Puas Baru Cair",
        desc: "Jika sesuai, dana diteruskan H+1. Jika beda, ajukan komplain untuk REFUND 100%.",
        icon: "solar:hand-money-bold-duotone",
        color: "text-purple-400 bg-purple-400/10 border-purple-400/20"
    }
];

// --- DATA: FAQ (Dibagi 2 Kolom untuk Masonry) ---
const FAQS_LEFT = [
    { 
        id: 1,
        q: "Bagaimana jika kamar aslinya kotor atau beda dengan foto?", 
        a: "Tenang! Uang Anda aman. Foto bukti ketidaksesuaian dan ajukan komplain di aplikasi maksimal 1x24 jam setelah check-in. Kami akan memverifikasi dan memberikan opsi ganti kamar atau Refund 100%." 
    },
    { 
        id: 3,
        q: "Apakah biaya listrik sudah termasuk?", 
        a: "Tergantung kebijakan kamar. Cek kembali detail fasilitas di atas. Jika tertulis 'Listrik Token', biaya ditanggung penyewa. Jika 'Listrik Include', berarti gratis." 
    },
];

const FAQS_RIGHT = [
    { 
        id: 2,
        q: "Kapan saya dapat alamat lengkap & kontak pemilik?", 
        a: "Demi keamanan transaksi (Anti-Bypass), info lengkap lokasi dan WhatsApp pemilik akan otomatis muncul di menu 'Tiket Saya' segera setelah pembayaran Anda terverifikasi sistem." 
    },
    { 
        id: 4,
        q: "Bisakah saya membatalkan pesanan?", 
        a: "Bisa. Pembatalan H-7 check-in mendapatkan refund penuh. Pembatalan mendadak (H-1) mengikuti kebijakan denda dari pemilik kos. Proses refund memakan waktu 1-3 hari kerja." 
    },
];

// --- COMPONENT CARD FAQ ---
const FAQCard = ({ item, isOpen, onClick }: any) => (
    <div 
        onClick={onClick}
        className={`group border rounded-2xl p-5 cursor-pointer transition-all duration-300 mb-4 relative overflow-hidden ${isOpen ? 'bg-[#1A1A1A] border-[#86efac]/30 shadow-lg shadow-[#86efac]/5' : 'bg-[#151515] border-white/5 hover:border-white/20'}`}
    >
        {/* Glow Effect saat Open */}
        {isOpen && <div className="absolute top-0 left-0 w-1 h-full bg-[#86efac]"/>}
        
        <div className="flex justify-between items-start gap-4">
            <h4 className={`text-sm font-bold leading-relaxed pr-2 ${isOpen ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                {item.q}
            </h4>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-all duration-300 ${isOpen ? 'bg-[#86efac] border-[#86efac] text-black rotate-180' : 'bg-transparent border-white/20 text-gray-400 group-hover:border-white/50'}`}>
                <Icon icon="solar:alt-arrow-down-linear" className="text-sm"/>
            </div>
        </div>
        
        <AnimatePresence>
            {isOpen && (
                <motion.div 
                    initial={{ height: 0, opacity: 0, marginTop: 0 }} 
                    animate={{ height: "auto", opacity: 1, marginTop: 16 }} 
                    exit={{ height: 0, opacity: 0, marginTop: 0 }} 
                    className="overflow-hidden"
                >
                    <p className="text-xs text-gray-400 leading-loose border-t border-white/5 pt-4">
                        {item.a}
                    </p>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
);

export default function BookingFAQ() {
  const [openId, setOpenId] = useState<number | null>(null);

  const toggle = (id: number) => setOpenId(openId === id ? null : id);

  return (
    <div className="mt-16 mb-24 pt-10 border-t border-white/5">
        
        {/* SECTION 1: TRUST FLOW (Horisontal Cards) */}
        <div className="mb-16">
            <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
                <div>
                    <h3 className="text-2xl font-extrabold text-white mb-2 flex items-center gap-2">
                        <Icon icon="solar:verified-check-bold" className="text-[#86efac]"/>
                        Transaksi Tanpa Cemas
                    </h3>
                    <p className="text-sm text-gray-400">Sistem perlindungan ganda untuk uang & kenyamanan Anda.</p>
                </div>
                <div className="text-xs font-bold text-[#86efac] bg-[#86efac]/5 px-4 py-2 rounded-full border border-[#86efac]/20">
                    Garansi Uang Kembali 100%
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {TRUST_STEPS.map((step, i) => (
                    <div key={i} className={`relative p-6 rounded-2xl border ${step.color} bg-opacity-5 hover:bg-opacity-10 transition-all group overflow-hidden`}>
                        {/* Background Icon Watermark */}
                        <Icon icon={step.icon} className="absolute -right-4 -bottom-4 text-8xl opacity-5 group-hover:opacity-10 transition-opacity rotate-12"/>
                        
                        <div className="relative z-10">
                            <span className="text-xs font-black tracking-widest opacity-50 mb-2 block">STEP {step.step}</span>
                            <h4 className="text-lg font-bold mb-2 flex items-center gap-2">
                                {step.title}
                            </h4>
                            <p className="text-xs font-medium leading-relaxed opacity-80">{step.desc}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* SECTION 2: MASONRY FAQ (Layout Kolom Terpisah) */}
        <div>
            <h3 className="text-lg font-bold text-white mb-6">Pertanyaan Sering Diajukan</h3>
            
            {/* Masonry Layout: 2 Kolom Independen */}
            <div className="flex flex-col md:flex-row gap-4 items-start">
                
                {/* Kolom Kiri */}
                <div className="flex-1 w-full">
                    {FAQS_LEFT.map((item) => (
                        <FAQCard key={item.id} item={item} isOpen={openId === item.id} onClick={() => toggle(item.id)} />
                    ))}
                </div>

                {/* Kolom Kanan */}
                <div className="flex-1 w-full">
                    {FAQS_RIGHT.map((item) => (
                        <FAQCard key={item.id} item={item} isOpen={openId === item.id} onClick={() => toggle(item.id)} />
                    ))}
                </div>

            </div>
        </div>

    </div>
  );
}
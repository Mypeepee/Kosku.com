"use client";
import React, { useState } from "react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";

// --- DATA DUMMY (FAQ DATABASE) ---
const helpData = {
  penyewa: [
    {
      id: "pay-1",
      category: "pembayaran",
      question: "Apakah uang sewa aman jika saya bayar lewat aplikasi?",
      answer: "Sangat aman. Uang Anda akan ditahan di Rekening Bersama (Escrow) Kosku dan baru diteruskan ke pemilik kos H+1 setelah Anda check-in dan mengonfirmasi kondisi kamar sesuai."
    },
    {
      id: "pay-2",
      category: "pembayaran",
      question: "Metode pembayaran apa saja yang tersedia?",
      answer: "Kami menerima Transfer Bank (Virtual Account), E-Wallet (GoPay, OVO, ShopeePay), Kartu Kredit, dan pembayaran via Minimarket (Indomaret/Alfamart)."
    },
    {
      id: "book-1",
      category: "booking",
      question: "Bagaimana cara mengajukan survei lokasi?",
      answer: "Klik tombol 'Ajukan Sewa' atau 'Chat Pemilik' di halaman detail. Anda bisa memilih opsi 'Janji Temu' untuk melihat lokasi secara langsung sebelum membayar."
    },
    {
      id: "cancel-1",
      category: "pembatalan",
      question: "Kebijakan pengembalian dana (Refund)",
      answer: "Refund 100% jika pembatalan dilakukan 7 hari sebelum check-in. Refund 50% jika kurang dari 3 hari. Dana tidak kembali jika pembatalan pada hari H."
    },
    {
      id: "ac-1",
      category: "akun",
      question: "Lupa password akun saya",
      answer: "Klik 'Lupa Password' di halaman login. Kami akan mengirimkan tautan reset ke email atau nomor WhatsApp yang terdaftar."
    }
  ],
  pemilik: [
    {
      id: "own-1",
      category: "pembayaran",
      question: "Kapan uang sewa cair ke rekening saya?",
      answer: "Pencairan dana dilakukan otomatis 1x24 jam setelah penyewa melakukan konfirmasi check-in di aplikasi."
    },
    {
      id: "own-2",
      category: "listing",
      question: "Bagaimana cara menaikkan peringkat kos saya agar dilihat banyak orang?",
      answer: "Lengkapi foto dengan kualitas HD, pastikan harga kompetitif, dan respon chat penyewa secepat mungkin. Anda juga bisa membeli paket 'Premium Listing'."
    },
    {
      id: "own-3",
      category: "booking",
      question: "Bisakah saya menolak pengajuan sewa?",
      answer: "Bisa. Anda memiliki waktu 24 jam untuk menerima atau menolak pengajuan sewa sebelum sistem membatalkannya otomatis."
    }
  ]
};

const categories = [
  { id: "all", label: "Semua Topik", icon: "solar:layers-minimalistic-bold" },
  { id: "pembayaran", label: "Pembayaran", icon: "solar:wallet-money-bold" },
  { id: "booking", label: "Booking & Survei", icon: "solar:calendar-mark-bold" },
  { id: "pembatalan", label: "Refund & Batal", icon: "solar:refresh-circle-bold" },
  { id: "akun", label: "Akun & Keamanan", icon: "solar:user-id-bold" },
];

const HelpCenterPage = () => {
  const [role, setRole] = useState<"penyewa" | "pemilik">("penyewa");
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  // --- FILTER LOGIC ---
  const currentData = helpData[role];
  const filteredData = currentData.filter((item) => {
    const matchCategory = activeCategory === "all" || item.category === activeCategory;
    const matchSearch = item.question.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <main className="bg-darkmode min-h-screen text-white pb-24">
      
      {/* === HERO SECTION (SEARCH) === */}
      <section className="relative pt-32 pb-16 px-4 overflow-hidden border-b border-white/5">
        {/* Background Accents */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/10 blur-[120px] rounded-full -z-10 opacity-30"></div>

        <div className="container mx-auto text-center max-w-3xl">
          <span className="text-primary font-bold tracking-widest uppercase text-xs mb-4 block animate-pulse">Pusat Bantuan Kosku</span>
          <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">
            Apa yang bisa kami <br /> bantu hari ini?
          </h1>
          
          {/* Main Search Bar */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Icon icon="solar:magnifer-linear" className="text-2xl text-gray-500 group-focus-within:text-primary transition-colors" />
            </div>
            <input 
              type="text" 
              placeholder={`Cari kendala seputar ${role === 'penyewa' ? 'booking, pembayaran...' : 'pencairan dana, kelola kos...'}`}
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-full py-5 pl-14 pr-6 text-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:shadow-[0_0_20px_rgba(34,197,94,0.2)] transition-all"
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* === ROLE SWITCHER & CATEGORIES === */}
      <section className="container mx-auto px-4 -mt-8 relative z-10">
        
        {/* 1. Role Toggle (Penyewa vs Pemilik) */}
        <div className="flex justify-center mb-10">
          <div className="bg-[#1A1A1A] p-1.5 rounded-full border border-white/10 flex items-center relative">
            {/* Active Background Pill Animation */}
            <motion.div 
              layoutId="activeRole"
              className={`absolute top-1.5 bottom-1.5 rounded-full bg-primary z-0`}
              initial={false}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{
                left: role === "penyewa" ? "6px" : "50%",
                width: "calc(50% - 6px)",
                transform: role === "pemilik" ? "translateX(0%)" : "translateX(0)" 
              }}
            />
            
            <button 
              onClick={() => { setRole("penyewa"); setActiveCategory("all"); }}
              className={`relative z-10 px-8 py-2.5 rounded-full text-sm font-bold transition-colors w-32 ${role === 'penyewa' ? 'text-darkmode' : 'text-gray-400 hover:text-white'}`}
            >
              Penyewa
            </button>
            <button 
              onClick={() => { setRole("pemilik"); setActiveCategory("all"); }}
              className={`relative z-10 px-8 py-2.5 rounded-full text-sm font-bold transition-colors w-32 ${role === 'pemilik' ? 'text-darkmode' : 'text-gray-400 hover:text-white'}`}
            >
              Pemilik
            </button>
          </div>
        </div>

        {/* 2. Category Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex flex-col items-center justify-center p-6 rounded-2xl border transition-all duration-300 group ${
                activeCategory === cat.id 
                  ? "bg-primary/10 border-primary text-primary" 
                  : "bg-[#1A1A1A] border-white/5 text-gray-400 hover:border-white/20 hover:bg-white/5"
              }`}
            >
              <Icon icon={cat.icon} className={`text-3xl mb-3 ${activeCategory === cat.id ? "text-primary" : "text-gray-500 group-hover:text-white"}`} />
              <span className={`text-xs font-bold uppercase tracking-wide ${activeCategory === cat.id ? "text-white" : ""}`}>{cat.label}</span>
            </button>
          ))}
        </div>

      </section>

      {/* === FAQ LIST (ACCORDION) === */}
      <section className="container mx-auto px-4 max-w-4xl min-h-[400px]">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Icon icon="solar:question-circle-bold" className="text-primary" />
          Topik Populer
        </h3>

        <div className="space-y-4">
          {filteredData.length > 0 ? (
            filteredData.map((item) => (
              <div 
                key={item.id} 
                className={`bg-[#1A1A1A] border rounded-2xl overflow-hidden transition-all duration-300 ${expandedFaq === item.id ? 'border-primary/50 bg-white/5' : 'border-white/5 hover:border-white/10'}`}
              >
                <button 
                  onClick={() => setExpandedFaq(expandedFaq === item.id ? null : item.id)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span className={`font-bold text-lg ${expandedFaq === item.id ? 'text-primary' : 'text-white'}`}>
                    {item.question}
                  </span>
                  <Icon 
                    icon="solar:alt-arrow-down-linear" 
                    className={`text-2xl text-gray-500 transition-transform duration-300 ${expandedFaq === item.id ? 'rotate-180 text-primary' : ''}`} 
                  />
                </button>
                
                <AnimatePresence>
                  {expandedFaq === item.id && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="px-6 pb-6 text-gray-300 leading-relaxed border-t border-white/5 pt-4 text-sm md:text-base">
                        {item.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))
          ) : (
            <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
              <Icon icon="solar:confounded-square-linear" className="text-5xl text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Maaf, kami tidak menemukan jawaban untuk pencarian tersebut.</p>
              <button 
                onClick={() => {setSearchQuery(""); setActiveCategory("all")}}
                className="mt-4 text-primary text-sm font-bold hover:underline"
              >
                Bersihkan Pencarian
              </button>
            </div>
          )}
        </div>
      </section>

      {/* === CONTACT SUPPORT (FOOTER CTA) === */}
      <section className="container mx-auto px-4 mt-24">
        <div className="bg-gradient-to-r from-blue-900/20 to-primary/10 border border-white/10 rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
           <div className="relative z-10">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">Masih butuh bantuan?</h2>
              <p className="text-gray-400 mb-8 max-w-xl mx-auto">
                Tim support kami siap membantu Anda 24/7. Jangan ragu untuk menghubungi kami jika masalah Anda belum terselesaikan di FAQ.
              </p>
              
              <div className="flex flex-col md:flex-row justify-center gap-4">
                 <button className="bg-[#25D366] hover:bg-[#20bd5a] text-white px-8 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-900/20">
                    <Icon icon="logos:whatsapp-icon" className="brightness-0 invert" width="20" />
                    Chat WhatsApp
                 </button>
                 <button className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-8 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                    <Icon icon="solar:letter-bold" />
                    Kirim Email
                 </button>
              </div>
           </div>
        </div>
      </section>

    </main>
  );
};

export default HelpCenterPage;
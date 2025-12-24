"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";

// --- 1. ANIMATION VARIANTS ---
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const scaleIn = {
  hidden: { scale: 0.9, opacity: 0 },
  visible: { scale: 1, opacity: 1, transition: { duration: 0.5 } },
};

// --- 2. DATA CONSTANTS ---

const features = [
  {
    title: "Marketplace Terintegrasi",
    desc: "Iklan kos Anda otomatis tayang di platform pencarian kami yang dikunjungi 50rb+ pencari kos tiap bulan.",
    icon: "solar:rocket-2-bold",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  {
    title: "Auto-Tagih WhatsApp",
    desc: "Sistem robot kami mengirim invoice sewa + listrik ke WA penyewa. Ada tombol bayar instan via QRIS/VA.",
    icon: "solar:bell-bing-bold",
    color: "text-green-400",
    bg: "bg-green-400/10",
  },
  {
    title: "Screening Penyewa",
    desc: "Fitur 'Credit Score' untuk melihat riwayat pembayaran calon penyewa di tempat kos sebelumnya.",
    icon: "solar:user-check-bold",
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
  {
    title: "Laporan Pajak Ready",
    desc: "Laporan keuangan diformat khusus agar mudah digunakan untuk pelaporan pajak tahunan Anda.",
    icon: "solar:document-text-bold",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
  },
  {
    title: "Manajemen Tukang",
    desc: "Ada kerusakan? Hubungkan dengan database tukang rekanan Kosku untuk perbaikan cepat.",
    icon: "solar:hammer-wrench-bold",
    color: "text-orange-400",
    bg: "bg-orange-400/10",
  },
  {
    title: "Smart Contract",
    desc: "Pembuatan perjanjian sewa digital dengan tanda tangan elektronik (e-sign) yang sah secara hukum.",
    icon: "solar:pen-new-square-bold",
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
  },
];

const faqs = [
  {
    q: "Apakah ada biaya pendaftaran?",
    a: "Tidak ada. Pendaftaran 100% gratis. Anda bisa mencoba semua fitur dasar tanpa kartu kredit.",
  },
  {
    q: "Bagaimana cara kerja Auto-Tagih?",
    a: "Sistem kami terhubung dengan WhatsApp API. 3 hari sebelum jatuh tempo, sistem mengirim pesan tagihan. Jika penyewa membayar via link di pesan tersebut, status di dashboard otomatis menjadi 'Lunas'.",
  },
  {
    q: "Apakah uang sewa masuk ke Kosku dulu?",
    a: "Untuk keamanan, ya (Sistem Escrow). Namun, dana otomatis diteruskan ke rekening Anda 1x24 jam setelah pembayaran diverifikasi, atau bisa diatur pencairan manual kapan saja.",
  },
  {
    q: "Bisakah saya mengelola lebih dari 1 lokasi kos?",
    a: "Tentu bisa. Akun Juragan Pro mendukung manajemen multi-properti dalam satu dashboard yang terintegrasi.",
  },
];

const testimonials = [
  {
    name: "Hj. Sarah",
    role: "Juragan 40 Pintu, Jakarta",
    text: "Dulu saya pusing tiap tanggal 1 harus chat anak kos satu-satu. Sekarang sambil liburan pun tagihan beres sendiri. Mantap Kosku!",
    rating: 5,
  },
  {
    name: "Pak Budi Santoso",
    role: "Pemilik Kost Putri, Jogja",
    text: "Fitur laporan keuangannya juara. Saya jadi tahu persis berapa pengeluaran untuk maintenance AC bulan ini. Sangat transparan.",
    rating: 5,
  },
  {
    name: "Ko Hendra",
    role: "Apartemen Owner, Surabaya",
    text: "Awalnya ragu, tapi setelah coba versi gratis, langsung upgrade ke Pro. Screening penyewa-nya sangat membantu menghindari masalah.",
    rating: 4,
  },
];

// --- 3. MAIN COMPONENT ---

const OwnerPage = () => {
  // State Kalkulator
  const [roomCount, setRoomCount] = useState(15);
  const [roomPrice, setRoomPrice] = useState(2000000);
  const revenue = roomCount * roomPrice * 0.95; // 95% Okupansi

  // State Pricing
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  
  // State FAQ
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <main className="bg-[#0F0F0F] min-h-screen text-white overflow-hidden font-sans selection:bg-primary/30">
      
      {/* =========================================
          HERO SECTION
      ========================================= */}
      <section className="relative pt-32 pb-16 px-4 overflow-hidden border-b border-white/5">
        {/* Background Elements */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 blur-[130px] rounded-full -z-10 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/5 blur-[130px] rounded-full -z-10"></div>
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-5 z-0"></div>

        <div className="container mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 items-center relative z-10">
          
          {/* Left: Text Content */}
          <motion.div 
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="max-w-2xl"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-primary text-[10px] font-bold uppercase tracking-wider mb-6 backdrop-blur-md">
              <Icon icon="solar:crown-star-bold" /> #1 Property Management System
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-extrabold mb-6 leading-[1.1] tracking-tight">
              Kelola Kos Jadi <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-green-300 to-emerald-400">
                Auto-Pilot
              </span> & Cuan.
            </h1>
            
            <p className="text-gray-400 text-lg mb-8 leading-relaxed max-w-lg">
              Tinggalkan cara manual. Kosku membantu Anda menagih sewa otomatis, pembukuan rapi, dan screening penyewa dalam satu aplikasi.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-10">
              <button className="bg-primary hover:bg-green-500 text-[#0F0F0F] font-bold px-8 py-4 rounded-xl transition-all shadow-[0_0_30px_rgba(34,197,94,0.3)] hover:shadow-[0_0_50px_rgba(34,197,94,0.5)] hover:-translate-y-1 flex items-center justify-center gap-2 text-sm md:text-base">
                Mulai Gratis Sekarang
                <Icon icon="solar:arrow-right-linear" className="text-xl"/>
              </button>
              <button className="bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold px-8 py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm md:text-base backdrop-blur-sm">
                <Icon icon="solar:play-circle-bold" className="text-xl"/>
                Lihat Demo
              </button>
            </div>

            <div className="flex items-center gap-6 border-t border-white/5 pt-6">
              <div>
                <h4 className="text-2xl font-bold text-white">2.5k+</h4>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Juragan Aktif</p>
              </div>
              <div className="w-px h-8 bg-white/10"></div>
              <div>
                <h4 className="text-2xl font-bold text-white">Rp 50M+</h4>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Transaksi/Bln</p>
              </div>
              <div className="w-px h-8 bg-white/10"></div>
              <div className="flex -space-x-2">
                 {[1,2,3,4].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full bg-gray-700 border border-[#0F0F0F] relative overflow-hidden">
                       {/* Placeholder Avatar */}
                       <div className={`absolute inset-0 opacity-50 ${i%2===0 ? 'bg-blue-500':'bg-purple-500'}`}></div>
                    </div>
                 ))}
                 <div className="w-8 h-8 rounded-full bg-[#1A1A1A] border border-white/10 flex items-center justify-center text-[10px] text-gray-400">+99</div>
              </div>
            </div>
          </motion.div>

          {/* Right: Complex Dashboard Mockup (CSS Only) */}
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative hidden lg:block perspective-1000"
          >
            {/* Floating Notification Card */}
            <motion.div 
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-6 -left-8 z-30 bg-[#151515]/90 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl w-64"
            >
              <div className="flex items-start gap-3">
                 <div className="w-10 h-10 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center flex-shrink-0">
                    <Icon icon="solar:wallet-money-bold" className="text-xl"/>
                 </div>
                 <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Payment Received</p>
                    <p className="text-sm font-bold text-white leading-tight">Putri (Kamar 102)</p>
                    <p className="text-sm font-bold text-green-400">+ Rp 1.500.000</p>
                 </div>
              </div>
            </motion.div>

            {/* Main Dashboard UI */}
            <div className="relative z-20 bg-[#121212] border border-white/10 rounded-3xl p-6 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] rotate-y-[-5deg] rotate-x-[5deg] hover:rotate-0 transition-transform duration-700 group">
               {/* Header UI */}
               <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary"><Icon icon="solar:home-smile-bold"/></div>
                     <div>
                        <h4 className="text-sm font-bold text-white">Wisma Sejahtera</h4>
                        <p className="text-[10px] text-gray-500">Jakarta Selatan</p>
                     </div>
                  </div>
                  <div className="flex gap-2">
                     <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400"><Icon icon="solar:bell-bing-linear"/></div>
                     <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400"><Icon icon="solar:settings-linear"/></div>
                  </div>
               </div>

               {/* Stats Grid */}
               <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-[#1A1A1A] p-4 rounded-2xl border border-white/5 group-hover:border-primary/30 transition-colors">
                     <p className="text-[10px] text-gray-400 mb-1">Total Revenue (Okt)</p>
                     <p className="text-2xl font-bold text-white">Rp 42.5Jt</p>
                     <div className="flex items-center gap-1 text-[10px] text-green-400 mt-1">
                        <Icon icon="solar:graph-up-linear"/> +12% vs last month
                     </div>
                  </div>
                  <div className="bg-[#1A1A1A] p-4 rounded-2xl border border-white/5">
                     <p className="text-[10px] text-gray-400 mb-1">Occupancy Rate</p>
                     <p className="text-2xl font-bold text-white">95%</p>
                     <div className="w-full bg-gray-700 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div className="bg-primary w-[95%] h-full rounded-full"></div>
                     </div>
                  </div>
               </div>

               {/* Recent Activity List */}
               <div className="bg-[#1A1A1A] rounded-2xl border border-white/5 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center">
                     <span className="text-xs font-bold text-white">Aktivitas Terbaru</span>
                     <span className="text-[10px] text-primary cursor-pointer">Lihat Semua</span>
                  </div>
                  <div className="divide-y divide-white/5">
                     {[
                        { icon: "solar:user-plus-bold", color: "text-blue-400", title: "Booking Baru: Ahmad", time: "2m lalu" },
                        { icon: "solar:danger-circle-bold", color: "text-red-400", title: "Komplain: AC Panas (Kmr 201)", time: "15m lalu" },
                        { icon: "solar:bill-check-bold", color: "text-green-400", title: "Tagihan Lunas: Sarah", time: "1j lalu" },
                     ].map((item, i) => (
                        <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors">
                           <div className="flex items-center gap-3">
                              <div className={`w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-xs ${item.color}`}>
                                 <Icon icon={item.icon} />
                              </div>
                              <span className="text-xs text-gray-300">{item.title}</span>
                           </div>
                           <span className="text-[10px] text-gray-600">{item.time}</span>
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            {/* Background Blob for Dashboard */}
            <div className="absolute top-10 left-10 right-10 bottom-10 bg-primary/20 blur-[80px] -z-10 rounded-full"></div>
          </motion.div>

        </div>
      </section>

      {/* =========================================
          COMPARISON SECTION (PAIN vs GAIN)
      ========================================= */}
      <section className="py-20 container mx-auto px-4">
        <motion.div 
          initial="hidden" 
          whileInView="visible" 
          viewport={{ once: true }} 
          variants={fadeInUp} 
          className="text-center mb-16 max-w-2xl mx-auto"
        >
           <h2 className="text-3xl font-bold mb-4">Masih Pakai Cara Lama?</h2>
           <p className="text-gray-400">Transformasi manajemen kos Anda dari manual yang melelahkan menjadi digital yang efisien.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
           {/* OLD WAY */}
           <motion.div 
             initial={{ opacity: 0, x: -50 }}
             whileInView={{ opacity: 1, x: 0 }}
             viewport={{ once: true }}
             transition={{ duration: 0.6 }}
             className="bg-[#151515] p-8 rounded-3xl border border-red-500/10 relative overflow-hidden group"
           >
              <div className="absolute top-0 right-0 bg-red-500/10 px-4 py-2 rounded-bl-2xl text-red-500 text-[10px] font-bold uppercase tracking-wider">Manual</div>
              <ul className="space-y-6 mt-4 relative z-10">
                 {[
                    { title: "Nagih Sewa Manual", desc: "Harus chat WA satu-satu. Sering lupa, sungkan, atau dibalas lama." },
                    { title: "Keuangan Berantakan", desc: "Nota hilang, lupa catat pengeluaran, untung rugi tidak terlacak." },
                    { title: "Talangan Listrik", desc: "Penyewa telat isi token, owner terpaksa nalangin biar gak mati lampu." }
                 ].map((item, i) => (
                    <li key={i} className="flex gap-4 opacity-70 group-hover:opacity-100 transition-opacity">
                       <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 flex-shrink-0">
                          <Icon icon="solar:close-circle-bold" />
                       </div>
                       <div>
                          <h4 className="font-bold text-white text-sm mb-1">{item.title}</h4>
                          <p className="text-xs text-gray-500">{item.desc}</p>
                       </div>
                    </li>
                 ))}
              </ul>
           </motion.div>

           {/* KOSKU WAY */}
           <motion.div 
             initial={{ opacity: 0, x: 50 }}
             whileInView={{ opacity: 1, x: 0 }}
             viewport={{ once: true }}
             transition={{ duration: 0.6 }}
             className="bg-[#151515] p-8 rounded-3xl border border-primary/20 relative overflow-hidden group shadow-[0_0_60px_rgba(34,197,94,0.05)]"
           >
              <div className="absolute top-0 right-0 bg-primary text-[#0F0F0F] px-4 py-2 rounded-bl-2xl text-[10px] font-bold uppercase tracking-wider">Juragan Kosku</div>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <ul className="space-y-6 mt-4 relative z-10">
                 {[
                    { title: "Auto-Tagih WhatsApp", desc: "Robot mengirim invoice otomatis. Ada tombol bayar instan (VA/QRIS)." },
                    { title: "Laporan Real-time", desc: "Cek cashflow di HP kapan saja. Download laporan PDF/Excel sekali klik." },
                    { title: "One-Bill System", desc: "Sewa + Listrik + Laundry jadi satu tagihan. Bayar lunas, terima bersih." }
                 ].map((item, i) => (
                    <li key={i} className="flex gap-4">
                       <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-[#0F0F0F] flex-shrink-0 shadow-lg shadow-primary/20">
                          <Icon icon="solar:check-read-bold" />
                       </div>
                       <div>
                          <h4 className="font-bold text-white text-sm mb-1">{item.title}</h4>
                          <p className="text-xs text-gray-400">{item.desc}</p>
                       </div>
                    </li>
                 ))}
              </ul>
           </motion.div>
        </div>
      </section>

      {/* =========================================
          KEY FEATURES (WHY US)
      ========================================= */}
      <section className="py-20 bg-[#121212] border-y border-white/5">
         <div className="container mx-auto px-4">
            <motion.div 
               initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}
               className="text-center mb-12"
            >
               <h2 className="text-2xl md:text-3xl font-bold mb-3">Kenapa Harus Pindah ke Kosku?</h2>
               <p className="text-gray-400 text-sm">Ekosistem lengkap untuk pertumbuhan bisnis properti Anda.</p>
            </motion.div>

            <motion.div 
               variants={staggerContainer}
               initial="hidden"
               whileInView="visible"
               viewport={{ once: true }}
               className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
               {features.map((item, idx) => (
                  <motion.div 
                     variants={fadeInUp}
                     key={idx} 
                     className="bg-[#1A1A1A] p-6 rounded-2xl border border-white/5 hover:border-white/20 hover:bg-[#202020] transition-all group cursor-default"
                  >
                     <div className={`w-12 h-12 rounded-xl ${item.bg} ${item.color} flex items-center justify-center text-2xl mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
                        <Icon icon={item.icon} />
                     </div>
                     <h4 className="text-lg font-bold text-white mb-2 group-hover:text-primary transition-colors">{item.title}</h4>
                     <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
                  </motion.div>
               ))}
            </motion.div>
         </div>
      </section>

      {/* =========================================
          INTERACTIVE CALCULATOR
      ========================================= */}
      <section className="py-20 container mx-auto px-4">
         <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-gradient-to-br from-[#1A1A1A] to-black border border-white/10 rounded-3xl p-8 lg:p-12 max-w-5xl mx-auto shadow-2xl relative overflow-hidden"
         >
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
               <div className="md:col-span-7 space-y-8">
                  <div>
                     <h3 className="text-2xl font-bold text-white mb-2">Simulasi Potensi Cuan</h3>
                     <p className="text-sm text-gray-400">Geser slider untuk melihat estimasi pendapatan bersih Anda.</p>
                  </div>

                  <div className="space-y-6">
                     <div>
                        <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                           <span>Jumlah Kamar</span>
                           <span className="text-white bg-white/10 px-2 py-1 rounded">{roomCount} Unit</span>
                        </div>
                        <input 
                           type="range" min="5" max="100" step="1" 
                           value={roomCount} onChange={(e) => setRoomCount(Number(e.target.value))} 
                           className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-green-400 transition-all"
                        />
                     </div>
                     <div>
                        <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                           <span>Harga Sewa Rata-rata</span>
                           <span className="text-white bg-white/10 px-2 py-1 rounded">Rp {roomPrice.toLocaleString()}</span>
                        </div>
                        <input 
                           type="range" min="500000" max="10000000" step="100000" 
                           value={roomPrice} onChange={(e) => setRoomPrice(Number(e.target.value))} 
                           className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-green-400 transition-all"
                        />
                     </div>
                  </div>
               </div>

               <div className="md:col-span-5 relative">
                  <div className="bg-[#111] rounded-2xl p-8 border border-white/10 text-center relative z-10">
                     <div className="absolute inset-0 bg-primary/5 rounded-2xl animate-pulse"></div>
                     <p className="text-primary text-xs font-bold uppercase tracking-widest mb-2 relative z-10">Estimasi Income / Bulan</p>
                     <h3 className="text-4xl lg:text-5xl font-extrabold text-white mb-4 relative z-10 tracking-tight">
                        Rp {(revenue/1000000).toFixed(1)} <span className="text-2xl text-gray-500">jt</span>
                     </h3>
                     <p className="text-[10px] text-gray-500 relative z-10">*Estimasi okupansi 95% dengan sistem manajemen & marketing Kosku</p>
                     
                     <button className="w-full mt-6 bg-primary text-[#0F0F0F] font-bold py-3 rounded-xl text-sm hover:bg-green-500 transition-colors relative z-10">
                        Raih Target Ini
                     </button>
                  </div>
               </div>
            </div>
         </motion.div>
      </section>

      {/* =========================================
          PRICING PLANS
      ========================================= */}
      <section className="py-20 bg-[#121212] border-y border-white/5" id="pricing">
         <div className="container mx-auto px-4">
            <div className="text-center mb-12">
               <h2 className="text-3xl font-bold mb-4">Investasi Kecil, Untung Besar</h2>
               <p className="text-gray-400 text-sm mb-8">Pilih paket yang sesuai dengan skala bisnis properti Anda.</p>
               
               {/* Toggle */}
               <div className="inline-flex bg-[#1A1A1A] p-1.5 rounded-full border border-white/10 relative">
                  <motion.div 
                     layout
                     className="absolute top-1.5 bottom-1.5 bg-white rounded-full z-0"
                     style={{ 
                        left: billingCycle === "monthly" ? "6px" : "50%", 
                        width: "calc(50% - 6px)",
                     }}
                     transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                  <button onClick={() => setBillingCycle("monthly")} className={`relative z-10 px-6 py-2 rounded-full text-xs font-bold transition-all w-32 ${billingCycle === 'monthly' ? 'text-darkmode' : 'text-gray-400 hover:text-white'}`}>Bulanan</button>
                  <button onClick={() => setBillingCycle("yearly")} className={`relative z-10 px-6 py-2 rounded-full text-xs font-bold transition-all w-32 flex items-center justify-center gap-1 ${billingCycle === 'yearly' ? 'text-darkmode' : 'text-gray-400 hover:text-white'}`}>Tahunan <span className="text-[8px] bg-green-500 text-white px-1 py-0.5 rounded ml-1">-20%</span></button>
               </div>
            </div>

            <motion.div 
               variants={staggerContainer}
               initial="hidden"
               whileInView="visible"
               viewport={{ once: true }}
               className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto items-end"
            >
               {/* PLAN: FREE */}
               <motion.div variants={fadeInUp} className="bg-[#1A1A1A] rounded-2xl p-6 border border-white/5 hover:border-white/20 transition-all">
                  <h3 className="text-lg font-bold text-white mb-2">Juragan Pemula</h3>
                  <p className="text-gray-400 text-xs mb-6 h-8">Untuk yang baru mulai kelola 1 kosan.</p>
                  <div className="text-3xl font-bold text-white mb-6">Gratis <span className="text-sm font-normal text-gray-500">/ selamanya</span></div>
                  <button className="w-full border border-white/20 text-white font-bold py-3 rounded-xl text-sm mb-6 hover:bg-white/5 transition-all">Daftar Sekarang</button>
                  
                  <div className="space-y-3">
                     <p className="text-xs font-bold text-white uppercase tracking-wider">Fitur:</p>
                     <ul className="space-y-3 text-sm text-gray-400">
                        <li className="flex items-center gap-2"><Icon icon="solar:check-read-bold" className="text-white"/> 1 Properti (Max 10 Kamar)</li>
                        <li className="flex items-center gap-2"><Icon icon="solar:check-read-bold" className="text-white"/> Iklan Tayang Standar</li>
                        <li className="flex items-center gap-2"><Icon icon="solar:check-read-bold" className="text-white"/> Chat Dasar</li>
                        <li className="flex items-center gap-2 text-gray-600"><Icon icon="solar:close-circle-linear"/> Laporan Keuangan</li>
                     </ul>
                  </div>
               </motion.div>

               {/* PLAN: PRO */}
               <motion.div variants={fadeInUp} className="bg-[#1A1A1A] rounded-2xl p-8 border-2 border-primary relative shadow-[0_0_40px_rgba(34,197,94,0.1)] z-10">
                  <div className="absolute top-0 right-0 bg-primary text-[#0F0F0F] text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase">Best Value</div>
                  <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">Juragan Pro <Icon icon="solar:crown-star-bold" className="text-yellow-500"/></h3>
                  <p className="text-gray-400 text-xs mb-6 h-8">Sistem auto-pilot lengkap.</p>
                  <div className="text-4xl font-bold text-white mb-6">
                     {billingCycle === 'monthly' ? 'Rp 49rb' : 'Rp 39rb'} <span className="text-sm font-normal text-gray-500">/ bulan</span>
                  </div>
                  <button className="w-full bg-primary hover:bg-green-500 text-[#0F0F0F] font-bold py-3.5 rounded-xl text-sm mb-6 transition-all shadow-lg shadow-green-500/20">Coba Gratis 14 Hari</button>
                  
                  <div className="space-y-3">
                     <p className="text-xs font-bold text-primary uppercase tracking-wider">Semua Fitur Free, plus:</p>
                     <ul className="space-y-3 text-sm text-gray-300">
                        <li className="flex items-center gap-2"><Icon icon="solar:check-read-bold" className="text-primary"/> 3 Properti (Unlimited Kamar)</li>
                        <li className="flex items-center gap-2"><Icon icon="solar:check-read-bold" className="text-primary"/> <strong>Boost Iklan</strong> (Halaman 1)</li>
                        <li className="flex items-center gap-2"><Icon icon="solar:check-read-bold" className="text-primary"/> Laporan Keuangan PDF</li>
                        <li className="flex items-center gap-2"><Icon icon="solar:check-read-bold" className="text-primary"/> Auto-Tagih WA Robot</li>
                        <li className="flex items-center gap-2"><Icon icon="solar:check-read-bold" className="text-primary"/> Manajemen Komplain</li>
                     </ul>
                  </div>
               </motion.div>

               {/* PLAN: SULTAN */}
               <motion.div variants={fadeInUp} className="bg-[#1A1A1A] rounded-2xl p-6 border border-white/5 hover:border-white/20 transition-all">
                  <h3 className="text-lg font-bold text-white mb-2">Juragan Sultan</h3>
                  <p className="text-gray-400 text-xs mb-6 h-8">Untuk skala bisnis besar.</p>
                  <div className="text-3xl font-bold text-white mb-6">
                     {billingCycle === 'monthly' ? 'Rp 149rb' : 'Rp 119rb'} <span className="text-sm font-normal text-gray-500">/ bulan</span>
                  </div>
                  <button className="w-full border border-white/20 text-white font-bold py-3 rounded-xl text-sm mb-6 hover:bg-white/5 transition-all">Hubungi Sales</button>
                  
                  <div className="space-y-3">
                     <p className="text-xs font-bold text-white uppercase tracking-wider">Fitur Eksklusif:</p>
                     <ul className="space-y-3 text-sm text-gray-400">
                        <li className="flex items-center gap-2"><Icon icon="solar:check-read-bold" className="text-white"/> Unlimited Properti</li>
                        <li className="flex items-center gap-2"><Icon icon="solar:check-read-bold" className="text-white"/> Super Boost (Top Search)</li>
                        <li className="flex items-center gap-2"><Icon icon="solar:check-read-bold" className="text-white"/> Akuntan Pribadi</li>
                        <li className="flex items-center gap-2"><Icon icon="solar:check-read-bold" className="text-white"/> API Access</li>
                     </ul>
                  </div>
               </motion.div>
            </motion.div>
         </div>
      </section>

      {/* =========================================
          TESTIMONIALS (SOCIAL PROOF)
      ========================================= */}
      <section className="py-20 container mx-auto px-4">
         <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}
            className="text-center mb-12"
         >
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Kata Mereka yang Sudah Santai</h2>
         </motion.div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
               <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-[#151515] p-6 rounded-2xl border border-white/5 relative"
               >
                  <div className="flex text-yellow-500 mb-4">
                     {[...Array(t.rating)].map((_, idx) => <Icon key={idx} icon="solar:star-bold" />)}
                  </div>
                  <p className="text-gray-300 text-sm mb-6 leading-relaxed">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center font-bold text-white border border-white/10">
                        {t.name.charAt(0)}
                     </div>
                     <div>
                        <h5 className="text-sm font-bold text-white">{t.name}</h5>
                        <p className="text-[10px] text-gray-500">{t.role}</p>
                     </div>
                  </div>
               </motion.div>
            ))}
         </div>
      </section>

      {/* =========================================
          FAQ (ACCORDION)
      ========================================= */}
      <section className="py-20 bg-[#121212] border-t border-white/5">
         <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-2xl md:text-3xl font-bold mb-10 text-center">Sering Ditanyakan</h2>
            <div className="space-y-4">
               {faqs.map((faq, idx) => (
                  <div key={idx} className="bg-[#1A1A1A] rounded-2xl border border-white/5 overflow-hidden">
                     <button 
                        onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                        className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-colors"
                     >
                        <span className={`font-bold text-sm ${openFaq === idx ? 'text-primary' : 'text-white'}`}>{faq.q}</span>
                        <Icon icon="solar:alt-arrow-down-linear" className={`transition-transform duration-300 ${openFaq === idx ? 'rotate-180 text-primary' : 'text-gray-500'}`}/>
                     </button>
                     <AnimatePresence>
                        {openFaq === idx && (
                           <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="px-5 pb-5 pt-0"
                           >
                              <p className="text-sm text-gray-400 leading-relaxed border-t border-white/5 pt-4">{faq.a}</p>
                           </motion.div>
                        )}
                     </AnimatePresence>
                  </div>
               ))}
            </div>
         </div>
      </section>

      {/* =========================================
          FINAL CTA
      ========================================= */}
      <section className="py-20 container mx-auto px-4 text-center">
         <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={scaleIn}
            className="bg-gradient-to-r from-primary/20 to-blue-500/20 border border-white/10 rounded-3xl p-12 relative overflow-hidden max-w-4xl mx-auto"
         >
            <div className="relative z-10">
               <h2 className="text-3xl md:text-4xl font-bold mb-6">Jangan Tunggu Kompetitor Anda Lebih Dulu.</h2>
               <p className="text-gray-300 mb-8 max-w-xl mx-auto">Bergabunglah dengan 2,500+ juragan yang sudah merasakan kemudahan teknologi Kosku.</p>
               <button className="bg-primary hover:bg-green-500 text-[#0F0F0F] font-bold px-10 py-4 rounded-xl shadow-[0_0_40px_rgba(34,197,94,0.4)] transition-all transform hover:-translate-y-1">
                  Daftar Gratis Sekarang
               </button>
               <p className="text-[10px] text-gray-500 mt-4">Tanpa kartu kredit • Batalkan kapan saja</p>
            </div>
         </motion.div>
      </section>

    </main>
  );
};

export default OwnerPage;
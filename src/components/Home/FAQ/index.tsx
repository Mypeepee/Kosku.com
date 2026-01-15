"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";

// --- DATA FAQ (Disesuaikan untuk Premier / Property All-in-One) ---
const faqs = [
  {
    question: "Bagaimana alur pembelian aset lelang di Premier?",
    answer: "Kami menyederhanakan proses lelang yang rumit. Tim kami akan mendampingi Anda mulai dari cek legalitas aset, survei lokasi, pendaftaran NIPL (Nomor Induk Peserta Lelang), hingga proses bidding dan balik nama sertifikat.",
  },
  {
    question: "Apakah harga yang tertera sudah termasuk biaya notaris?",
    answer: "Harga yang tertera di website adalah harga aset. Biaya tambahan seperti Pajak Pembeli (BPHTB), Biaya Notaris/PPAT, dan Balik Nama akan dihitungkan secara transparan oleh agen kami sebelum Anda bertransaksi.",
  },
  {
    question: "Bisakah saya menitipkan properti untuk dijual/disewakan?",
    answer: "Tentu! Gunakan fitur 'Titip Jual' di menu akun Anda. Agen spesialis area kami akan menghubungi Anda untuk verifikasi data, foto aset, dan strategi pemasaran agar properti cepat laku.",
  },
  {
    question: "Metode pembayaran apa saja yang tersedia?",
    answer: "Untuk Booking Fee, kami mendukung Transfer Bank (Virtual Account) dan E-Wallet. Untuk pelunasan transaksi Jual-Beli, pembayaran dilakukan langsung melalui mekanisme perbankan (KPR/Cash Keras) yang aman.",
  },
  {
    question: "Apakah uang tanda jadi (Booking Fee) bisa kembali?",
    answer: "Kebijakan refund Booking Fee bergantung pada jenis transaksi. Untuk unit Developer (Primary), biasanya hangus jika batal sepihak. Namun untuk Secondary/Sewa, hal ini tertuang dalam perjanjian penawaran yang disepakati kedua belah pihak.",
  },
];

const FAQ = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(0);

  const toggleAccordion = (index: number) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  return (
    // REVISI PADDING: py-16 (Standar Compact yang kita sepakati)
    // BG: #0F0F0F (Abu gelap premium, sama dengan section WhyKosku & Types)
    <section className="py-16 bg-[#0F0F0F] relative z-10" id="faq">
      <div className="container mx-auto lg:max-w-screen-xl px-4">
        <div className="grid lg:grid-cols-12 gap-10 items-start">
          
          {/* BAGIAN KIRI: JUDUL (STICKY / DIAM SAAT SCROLL) */}
          {/* Fitur yang Anda suka ada di class 'lg:sticky lg:top-32' */}
          <div className="lg:col-span-5 lg:sticky lg:top-32">
            <span className="text-[#86efac] font-bold tracking-widest uppercase text-xs mb-2 block">
              Pusat Bantuan
            </span>
            <h2 className="text-white sm:text-5xl text-3xl font-extrabold leading-tight mb-6">
              Sering <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#86efac] to-teal-500">Ditanyakan</span>
            </h2>
            <p className="text-white/50 text-base mb-8 leading-relaxed">
              Masih bingung seputar prosedur lelang, jual-beli, atau sewa? Temukan jawaban lengkapnya di sini.
            </p>

            {/* Support Card Kecil */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-[#86efac]/20 p-3 rounded-full">
                  <Icon icon="solar:headset-bold-duotone" className="text-[#86efac] text-2xl" />
                </div>
                <div>
                  <h4 className="text-white font-bold">Butuh Konsultasi?</h4>
                  <p className="text-white/40 text-xs">Tim ahli kami siap 24/7</p>
                </div>
              </div>
              <button className="w-full py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-[#86efac] transition-colors duration-300 flex items-center justify-center gap-2">
                <Icon icon="logos:whatsapp-icon" className="text-base" />
                Hubungi CS
              </button>
            </div>
          </div>

          {/* BAGIAN KANAN: ACCORDION LIST (SCROLLABLE) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {faqs.map((item, index) => (
              <div
                key={index}
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                  activeIndex === index
                    ? "border-[#86efac]/50 bg-white/5 shadow-[0_0_30px_rgba(134,239,172,0.05)]"
                    : "border-white/10 bg-transparent hover:border-white/20"
                }`}
              >
                <button
                  onClick={() => toggleAccordion(index)}
                  className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
                >
                  <span className={`text-base md:text-lg font-bold transition-colors pr-4 ${activeIndex === index ? 'text-[#86efac]' : 'text-white'}`}>
                    {item.question}
                  </span>
                  <div className={`p-2 rounded-full transition-all duration-300 shrink-0 ${activeIndex === index ? 'bg-[#86efac] text-black rotate-180' : 'bg-white/10 text-white'}`}>
                    <Icon icon="solar:alt-arrow-down-linear" width="20" />
                  </div>
                </button>

                <AnimatePresence>
                  {activeIndex === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <div className="px-6 pb-6 pt-0 text-white/50 text-sm leading-relaxed border-t border-white/5 mt-2">
                        <div className="pt-4">
                          {item.answer}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
};

export default FAQ;
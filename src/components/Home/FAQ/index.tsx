"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";

// Data Dummy FAQ
const faqs = [
  {
    question: "Bagaimana cara booking kos di Kosku?",
    answer: "Sangat mudah! Pilih kos yang Anda suka, klik tombol 'Ajukan Sewa', isi formulir singkat, dan tunggu konfirmasi dari pemilik kos. Anda juga bisa langsung chat pemilik untuk survei.",
  },
  {
    question: "Apakah harga yang tertera sudah termasuk listrik?",
    answer: "Tergantung kebijakan masing-masing kos. Informasi ini tertera jelas di setiap halaman detail kos pada bagian 'Fasilitas' dan 'Ketentuan'.",
  },
  {
    question: "Apakah saya bisa survei lokasi sebelum membayar?",
    answer: "Tentu saja! Kami sangat menyarankan survei. Gunakan fitur 'Jadwalkan Survei' atau chat langsung dengan pemilik kos melalui platform kami.",
  },
  {
    question: "Metode pembayaran apa saja yang tersedia?",
    answer: "Kosku mendukung berbagai metode pembayaran mulai dari Transfer Bank (Virtual Account), E-Wallet (GoPay, OVO, Dana), hingga Kartu Kredit dan pembayaran via Minimarket.",
  },
  {
    question: "Bagaimana jika saya ingin membatalkan pesanan?",
    answer: "Pembatalan mengikuti kebijakan masing-masing pemilik kos yang tertera saat booking. Dana akan dikembalikan (refund) sesuai syarat & ketentuan yang berlaku.",
  },
];

const Upgrade = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(0);

  const toggleAccordion = (index: number) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  return (
    // REVISI: Mengubah 'py-24' menjadi 'pb-24 pt-0'
    // pt-0 menghilangkan jarak atas yang berlebihan.
    <section className="pb-24 pt-0 relative z-10" id="faq">
      <div className="container mx-auto lg:max-w-screen-xl px-4">
        <div className="grid lg:grid-cols-12 gap-10 items-start">
          
          {/* BAGIAN KIRI: JUDUL (Sticky) */}
          <div className="lg:col-span-5 lg:sticky lg:top-32">
            <span className="text-primary font-bold tracking-widest uppercase text-sm mb-2 block">
              Pusat Bantuan
            </span>
            <h2 className="text-white sm:text-5xl text-4xl font-bold leading-tight mb-6">
              Sering <span className="text-primary">Ditanyakan</span>
            </h2>
            <p className="text-gray-400 text-lg mb-8 leading-relaxed">
              Masih bingung? Temukan jawaban atas pertanyaan umum seputar pencarian dan penyewaan kos di sini.
            </p>

            {/* Support Card Kecil */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-primary/20 p-3 rounded-full">
                  <Icon icon="solar:headset-bold" className="text-primary text-2xl" />
                </div>
                <div>
                  <h4 className="text-white font-bold">Butuh Bantuan Lain?</h4>
                  <p className="text-gray-400 text-sm">Tim kami siap 24/7</p>
                </div>
              </div>
              <button className="w-full py-3 rounded-xl bg-white text-darkmode font-bold hover:bg-primary transition-colors duration-300">
                Hubungi CS
              </button>
            </div>
          </div>

          {/* BAGIAN KANAN: ACCORDION LIST */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {faqs.map((item, index) => (
              <div
                key={index}
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                  activeIndex === index
                    ? "border-primary bg-white/5 shadow-[0_0_30px_rgba(34,197,94,0.1)]"
                    : "border-white/10 bg-transparent hover:border-white/30"
                }`}
              >
                <button
                  onClick={() => toggleAccordion(index)}
                  className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
                >
                  <span className={`text-lg font-bold transition-colors ${activeIndex === index ? 'text-primary' : 'text-white'}`}>
                    {item.question}
                  </span>
                  <div className={`p-2 rounded-full transition-all duration-300 ${activeIndex === index ? 'bg-primary text-darkmode rotate-180' : 'bg-white/10 text-white'}`}>
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
                      <div className="px-6 pb-6 pt-0 text-gray-400 leading-relaxed border-t border-white/5 mt-2">
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

export default Upgrade;
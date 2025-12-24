"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";

const Portfolio = () => {
  const [isAnnual, setIsAnnual] = useState(false);

  // Data Paket Langganan (Disesuaikan untuk Pemilik Kos)
  const plans = [
    {
      name: "Starter",
      price: "0",
      desc: "Cocok untuk pemilik kos pemula dengan jumlah kamar sedikit.",
      features: [
        "Maksimal 5 Kamar",
        "Iklan Kos Gratis",
        "Chat dengan Penyewa",
        "Laporan Keuangan Sederhana",
      ],
      buttonText: "Mulai Gratis",
      isPopular: false,
    },
    {
      name: "Juragan",
      price: isAnnual ? "390.000" : "49.000", // Diskon kalau tahunan
      desc: "Solusi lengkap untuk mengelola bisnis kos secara profesional.",
      features: [
        "Maksimal 50 Kamar",
        "Auto-Tagih (WhatsApp Reminder)",
        "Manajemen Komplain",
        "Kontrak Digital (E-Sign)",
        "Laporan Keuangan Detail",
        "Prioritas Support 24/7",
      ],
      buttonText: "Coba Gratis 7 Hari",
      isPopular: true, // Ini yang akan di-highlight
    },
    {
      name: "Enterprise",
      price: "Custom",
      desc: "Untuk operator coliving atau manajemen properti skala besar.",
      features: [
        "Unlimited Kamar",
        "Multi-Admin & Role",
        "API Access",
        "White Label (Logo Sendiri)",
        "Dedicated Account Manager",
        "Training Pegawai",
      ],
      buttonText: "Hubungi Sales",
      isPopular: false,
    },
  ];

  return (
    // REVISI: Mengubah 'py-24' menjadi 'pb-24 pt-0'
    // pt-0 membuat section ini langsung menempel ke bawah section "Tentang Kami" tanpa celah besar.
    <section className="pb-24 pt-0 relative z-10" id="pricing">
      <div className="container mx-auto lg:max-w-screen-xl px-4">
        
        {/* HEADER SECTION */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-white sm:text-5xl text-4xl font-bold mb-6">
            Pilih Paket <span className="text-primary">Terbaik</span> Anda
          </h2>
          <p className="text-gray-400 text-lg mb-8">
            Investasi kecil untuk kemudahan besar. Kelola kosan jadi lebih santai, cuan tetap lancar.
          </p>

          {/* TOGGLE SWITCH (Bulanan / Tahunan) */}
          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm font-bold ${!isAnnual ? 'text-white' : 'text-gray-500'}`}>
              Bulanan
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="w-16 h-8 bg-gray-700 rounded-full p-1 relative transition-colors duration-300 focus:outline-none ring-2 ring-primary/50"
            >
              <div
                className={`w-6 h-6 bg-primary rounded-full shadow-md transform transition-transform duration-300 ${
                  isAnnual ? "translate-x-8" : "translate-x-0"
                }`}
              />
            </button>
            <span className={`text-sm font-bold ${isAnnual ? 'text-white' : 'text-gray-500'}`}>
              Tahunan <span className="text-primary text-xs ml-1">(Hemat 20%)</span>
            </span>
          </div>
        </div>

        {/* PRICING CARDS GRID */}
        <div className="grid lg:grid-cols-3 gap-8 items-start">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`relative rounded-3xl p-8 border transition-all duration-300 ${
                plan.isPopular
                  ? "bg-gradient-to-b from-primary/10 to-darkmode border-primary shadow-[0_0_40px_rgba(34,197,94,0.15)] transform lg:-translate-y-4"
                  : "bg-darkmode border-white/10 hover:border-white/20"
              }`}
            >
              {/* Badge "Most Popular" */}
              {plan.isPopular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-darkmode text-sm font-bold px-4 py-1 rounded-full shadow-lg">
                  Paling Laris
                </div>
              )}

              {/* Nama Paket */}
              <h3 className="text-white text-xl font-bold mb-2">{plan.name}</h3>
              <p className="text-gray-400 text-sm h-10 mb-6">{plan.desc}</p>

              {/* Harga */}
              <div className="flex items-baseline gap-1 mb-8">
                {plan.price !== "Custom" && <span className="text-gray-400 text-lg">Rp</span>}
                <span className={`font-bold text-white ${plan.price === "Custom" ? "text-4xl" : "text-5xl"}`}>
                  {plan.price}
                </span>
                {plan.price !== "0" && plan.price !== "Custom" && (
                  <span className="text-gray-400">/{isAnnual ? "thn" : "bln"}</span>
                )}
              </div>

              {/* Tombol CTA */}
              <button
                className={`w-full py-4 rounded-xl font-bold transition-all mb-8 ${
                  plan.isPopular
                    ? "bg-primary text-darkmode hover:bg-primary/90 shadow-lg"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {plan.buttonText}
              </button>

              {/* List Fitur */}
              <div className="space-y-4">
                <p className="text-sm font-bold text-white uppercase tracking-wider">Fitur Unggulan:</p>
                {plan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <Icon
                      icon="solar:check-circle-bold"
                      className={`text-xl mt-0.5 ${plan.isPopular ? 'text-primary' : 'text-gray-500'}`}
                    />
                    <span className="text-gray-300 text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Portfolio;
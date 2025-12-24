"use client";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";

const features = [
  {
    icon: "solar:shield-check-bold-duotone",
    title: "Terverifikasi",
    desc: "Setiap kos disurvei langsung oleh tim kami untuk menjamin keaslian data.",
    color: "bg-blue-500",
  },
  {
    icon: "solar:wallet-money-bold-duotone",
    title: "Harga Jujur",
    desc: "Tidak ada biaya tersembunyi. Harga yang Anda lihat adalah harga yang Anda bayar.",
    color: "bg-primary",
  },
  {
    icon: "solar:clock-circle-bold-duotone",
    title: "Layanan 24/7",
    desc: "Bantuan pelanggan siap sedia kapanpun Anda membutuhkan solusi.",
    color: "bg-purple-500",
  },
  {
    icon: "solar:smart-home-angle-bold-duotone",
    title: "Smart Living",
    desc: "Integrasi teknologi pintar untuk kenyamanan dan keamanan penghuni.",
    color: "bg-orange-500",
  },
];

const TimeLine = () => {
  return (
    // REVISI: Mengganti 'py-24' menjadi 'pb-24 pt-0'.
    // pt-0: Menghilangkan jarak atas agar langsung menempel dengan section sebelumnya.
    <section className="pb-24 pt-0 relative overflow-hidden" id="about">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-darkmode to-darkmode -z-10"></div>

      <div className="container mx-auto lg:max-w-screen-xl px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* BAGIAN KIRI: GRID KARTU FITUR */}
          <div className="grid grid-cols-2 gap-6">
            {features.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className={`p-6 rounded-3xl border border-white/5 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 group ${index === 1 || index === 3 ? 'lg:translate-y-12' : ''}`}
              >
                <div className={`w-12 h-12 rounded-2xl ${item.color}/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon icon={item.icon} className={`text-2xl ${item.color.replace('bg-', 'text-')}`} />
                </div>
                <h3 className="text-white text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>

          {/* BAGIAN KANAN: TEKS TENTANG KAMI */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="h-px w-8 bg-primary"></span>
              <span className="text-primary font-bold tracking-widest uppercase text-sm">
                Tentang Kosku
              </span>
            </div>
            
            <h2 className="text-white sm:text-5xl text-4xl font-bold leading-tight mb-6">
              Revolusi Pencarian <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-green-400">
                Tempat Tinggal
              </span> Impian
            </h2>
            
            <p className="text-gray-400 text-lg mb-6 leading-relaxed">
              Kosku hadir untuk memecahkan masalah klasik pencari kos: informasi yang tidak akurat dan proses yang ribet. Kami menggabungkan teknologi AI dengan verifikasi lapangan manual.
            </p>

            <p className="text-gray-400 text-lg mb-10 leading-relaxed">
              Bagi pemilik properti, kami adalah asisten digital yang mengotomatisasi penagihan, pemasaran, hingga manajemen komplain penghuni.
            </p>

            <button className="bg-primary hover:bg-primary/90 text-darkmode px-8 py-4 rounded-full font-bold text-lg transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] flex items-center gap-2 group">
              <span>Pelajari Visi Kami</span>
              <Icon icon="solar:arrow-right-linear" className="group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>

        </div>
      </div>
    </section>
  );
};

export default TimeLine;
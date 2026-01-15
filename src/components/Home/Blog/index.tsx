"use client";

import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";

// --- DATA BLOG (Disesuaikan untuk Premier: Lelang, Market, Investasi) ---
const blogPosts = [
  {
    id: 1,
    title: "Cara Menang Lelang Rumah Sitaan Bank: Panduan Pemula",
    category: "Tips Lelang",
    date: "14 Jan 2026",
    image: "/images/hero/banner.jpg", // Ganti dengan path gambar yang tersedia
    excerpt: "Jangan takut main lelang. Simak strategi bidding dan cara cek legalitas aset agar investasi properti Anda cuan maksimal.",
    slug: "/blog/tips-lelang",
  },
  {
    id: 2,
    title: "Prediksi Harga Properti Surabaya 2026: Saatnya Beli?",
    category: "Analisa Pasar",
    date: "10 Jan 2026",
    image: "/images/hero/banner-image.png",
    excerpt: "Melihat tren kenaikan harga tanah di Surabaya Barat dan Timur. Apakah ini momen yang tepat untuk mulai berinvestasi?",
    slug: "/blog/market-outlook-2026",
  },
  {
    id: 3,
    title: "Beli Rumah Primary vs Secondary: Mana Lebih Untung?",
    category: "Panduan Pembeli",
    date: "05 Jan 2026",
    image: "/images/hero/banner.jpg",
    excerpt: "Perbandingan detail mengenai biaya KPR, legalitas, dan potensi capital gain antara rumah baru developer dan rumah bekas.",
    slug: "/blog/primary-vs-secondary",
  },
];

const Blog = () => {
  return (
    // PADDING: py-16 (Standar Compact)
    // BG: #0F0F0F (Konsisten dengan section FAQ & WhyKosku)
    <section className="py-16 bg-[#0F0F0F] relative z-10" id="blog">
      <div className="container mx-auto lg:max-w-screen-xl px-4">
        
        {/* HEADER SECTION */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <motion.span 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block py-1 px-3 rounded-full bg-white/5 border border-white/10 text-[#86efac] text-[10px] font-bold tracking-widest mb-3 uppercase"
          >
            Wawasan Properti
          </motion.span>
          
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-white text-3xl md:text-4xl font-extrabold mb-4"
          >
            Berita & Artikel <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#86efac] to-teal-500">Terbaru</span>
          </motion.h2>
          
          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-white/50 text-sm md:text-base leading-relaxed"
          >
            Dapatkan informasi terkini seputar strategi investasi, legalitas lelang, hingga tren pasar properti Indonesia.
          </motion.p>
        </div>

        {/* BLOG GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {blogPosts.map((post, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group bg-[#151515] border border-white/10 rounded-3xl overflow-hidden hover:border-[#86efac]/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(134,239,172,0.05)] flex flex-col h-full"
            >
              {/* Gambar Blog dengan Efek Zoom */}
              <div className="relative h-56 w-full overflow-hidden">
                <Image
                  src={post.image}
                  alt={post.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                
                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#151515] via-transparent to-transparent opacity-60" />

                {/* Badge Kategori */}
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                  <span className="text-[10px] font-bold text-[#86efac] uppercase tracking-wide">
                    {post.category}
                  </span>
                </div>
              </div>

              {/* Konten Blog */}
              <div className="p-6 flex flex-col flex-grow">
                <div className="flex items-center gap-2 text-white/40 text-xs mb-3 font-medium">
                  <Icon icon="solar:calendar-date-bold-duotone" className="text-base" />
                  <span>{post.date}</span>
                </div>
                
                <h3 className="text-white text-lg font-bold mb-3 line-clamp-2 group-hover:text-[#86efac] transition-colors leading-snug">
                  <Link href={post.slug}>
                    {post.title}
                  </Link>
                </h3>
                
                <p className="text-white/50 text-sm line-clamp-3 mb-6 flex-grow leading-relaxed">
                  {post.excerpt}
                </p>

                {/* Tombol Baca Selengkapnya */}
                <Link 
                  href={post.slug}
                  className="inline-flex items-center gap-2 text-[#86efac] text-sm font-bold hover:gap-3 transition-all mt-auto"
                >
                  Baca Selengkapnya
                  <Icon icon="solar:arrow-right-linear" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Tombol Lihat Semua */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <button className="px-8 py-3 rounded-full border border-white/10 bg-white/5 text-white text-sm font-bold hover:bg-[#86efac] hover:text-black hover:border-[#86efac] transition-all duration-300">
            Lihat Semua Artikel
          </button>
        </motion.div>

      </div>
    </section>
  );
};

export default Blog;
"use client";
import React, { useState } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import Link from "next/link";

// --- DUMMY DATA BLOG ---
const blogPosts = [
  {
    id: 1,
    title: "5 Tips Menghemat Listrik Token untuk Anak Kos, Bisa Hemat 50%!",
    excerpt: "Tagihan listrik membengkak? Simak cara jitu mengatur penggunaan elektronik agar token listrik kamu awet sampai akhir bulan tanpa harus kepanasan.",
    category: "Tips Hemat",
    author: "Rizky Admin",
    date: "20 Des 2025",
    readTime: "5 min read",
    image: "/images/hero/banner.jpg", // Ganti dengan image Anda
    featured: true, // Artikel Utama
  },
  {
    id: 2,
    title: "Review Kawasan Setiabudi: Surga Kuliner & Akses MRT",
    excerpt: "Kenapa Setiabudi jadi primadona eksekutif muda? Kita bedah tuntas akses transportasi, spot kuliner malam, dan range harga kos di sini.",
    category: "Review Area",
    author: "Sarah J.",
    date: "18 Des 2025",
    readTime: "8 min read",
    image: "/images/hero/banner.jpg",
    featured: false,
  },
  {
    id: 3,
    title: "Panduan Dekorasi Kamar Sempit Jadi Terlihat Luas & Aesthetic",
    excerpt: "Kamar 3x3 meter terasa sumpek? Coba trik penataan layout dan pemilihan warna cat ini. Dijamin kamar kos rasa hotel bintang lima.",
    category: "Design & Decor",
    author: "Arsitek Kos",
    date: "15 Des 2025",
    readTime: "6 min read",
    image: "/images/hero/banner.jpg",
    featured: false,
  },
  {
    id: 4,
    title: "Barang Wajib Punya Saat Pindah Kos Pertama Kali",
    excerpt: "Jangan bawa seisi rumah! Ini checklist barang esensial yang benar-benar kamu butuhkan saat menjadi anak rantau untuk pertama kalinya.",
    category: "Lifestyle",
    author: "Rizky Admin",
    date: "10 Des 2025",
    readTime: "4 min read",
    image: "/images/hero/banner.jpg",
    featured: false,
  },
  {
    id: 5,
    title: "Cara Menghadapi Teman Kos yang Berisik Tanpa Drama",
    excerpt: "Tetangga kamar suka setel musik kencang? Ini cara menegur yang sopan tapi ampuh agar hubungan tetap baik dan tidurmu tetap nyenyak.",
    category: "Lifestyle",
    author: "Psikolog Kos",
    date: "08 Des 2025",
    readTime: "3 min read",
    image: "/images/hero/banner.jpg",
    featured: false,
  },
  {
    id: 6,
    title: "Investasi Properti Kos-kosan: Masih Cuan di 2026?",
    excerpt: "Analisis pasar properti sewa pasca pandemi. Apakah bisnis kos masih menjanjikan passive income yang besar? Baca datanya di sini.",
    category: "Bisnis",
    author: "Juragan Senior",
    date: "01 Des 2025",
    readTime: "10 min read",
    image: "/images/hero/banner.jpg",
    featured: false,
  },
];

// --- KATEGORI ---
const categories = ["All", "Tips Hemat", "Review Area", "Design & Decor", "Lifestyle", "Bisnis"];

const BlogPage = () => {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Logic Filter Sederhana
  const filteredPosts = blogPosts.filter((post) => {
    const matchCategory = activeCategory === "All" || post.category === activeCategory;
    const matchSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const featuredPost = blogPosts.find(p => p.featured);
  const otherPosts = filteredPosts.filter(p => !p.featured);

  return (
    <main className="bg-darkmode min-h-screen text-white pb-24">
      
      {/* === HERO SECTION: HEADER & SEARCH === */}
      <section className="pt-32 pb-12 border-b border-white/5 bg-gradient-to-b from-darkmode to-[#1A1A1A]">
        <div className="container mx-auto px-4 text-center">
          <span className="text-primary font-bold tracking-widest uppercase text-xs mb-3 block">Kosku Blog</span>
          <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">
            Cerita & Inspirasi <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">Anak Kos Modern</span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg mb-10">
            Temukan tips hemat, rekomendasi area, hingga inspirasi dekorasi kamar untuk kehidupan kos yang lebih berkualitas.
          </p>

          {/* Search Bar */}
          <div className="max-w-xl mx-auto relative">
            <input 
              type="text" 
              placeholder="Cari artikel (contoh: dekorasi, hemat)..." 
              className="w-full bg-white/5 border border-white/10 rounded-full py-4 pl-6 pr-14 text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:bg-white/10 transition-all"
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="absolute right-2 top-2 bg-primary text-darkmode p-2 rounded-full hover:bg-white transition-colors">
              <Icon icon="solar:magnifer-linear" className="text-xl" />
            </button>
          </div>
        </div>
      </section>

      {/* === CATEGORY FILTER === */}
      <section className="py-8 sticky top-20 z-30 bg-darkmode/80 backdrop-blur-md border-b border-white/5">
        <div className="container mx-auto px-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-3 min-w-max justify-center">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-all border ${
                  activeCategory === cat 
                    ? "bg-white text-darkmode border-white" 
                    : "bg-transparent text-gray-400 border-white/10 hover:border-white/30 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 mt-12">
        
        {/* === FEATURED POST (Artikel Utama) === */}
        {activeCategory === "All" && !searchQuery && featuredPost && (
          <div className="mb-16">
            <Link href={`/blog/${featuredPost.id}`} className="group relative block rounded-3xl overflow-hidden aspect-video md:aspect-[21/9] border border-white/10">
              <Image 
                src={featuredPost.image} 
                alt={featuredPost.title} 
                fill 
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-90"></div>
              
              <div className="absolute bottom-0 left-0 w-full p-6 md:p-12">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="bg-primary text-darkmode text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">{featuredPost.category}</span>
                    <span className="text-gray-300 text-xs flex items-center gap-1"><Icon icon="solar:clock-circle-bold" /> {featuredPost.readTime}</span>
                  </div>
                  <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight group-hover:text-primary transition-colors">
                    {featuredPost.title}
                  </h2>
                  <p className="text-gray-300 text-base md:text-lg line-clamp-2 mb-6 hidden md:block">
                    {featuredPost.excerpt}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-600 border-2 border-darkmode"></div>
                    <div className="text-sm">
                      <p className="text-white font-bold">{featuredPost.author}</p>
                      <p className="text-gray-400 text-xs">{featuredPost.date}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* === POST GRID (Artikel Lainnya) === */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {otherPosts.length > 0 ? (
            otherPosts.map((post) => (
              <Link href={`/blog/${post.id}`} key={post.id} className="group flex flex-col h-full">
                <div className="relative h-60 rounded-2xl overflow-hidden mb-5 border border-white/5">
                  <Image 
                    src={post.image} 
                    alt={post.title} 
                    fill 
                    className="object-cover transition-transform duration-700 group-hover:scale-110" 
                  />
                  <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-lg border border-white/10">
                    <span className="text-white text-[10px] font-bold uppercase tracking-wider">{post.category}</span>
                  </div>
                </div>
                
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                    <span className="flex items-center gap-1"><Icon icon="solar:calendar-bold" /> {post.date}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Icon icon="solar:clock-circle-bold" /> {post.readTime}</span>
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-3 line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                    {post.title}
                  </h3>
                  
                  <p className="text-gray-400 text-sm line-clamp-3 mb-4 flex-1 leading-relaxed">
                    {post.excerpt}
                  </p>
                  
                  <div className="flex items-center gap-2 mt-auto pt-4 border-t border-white/5">
                    <div className="w-6 h-6 rounded-full bg-gray-700"></div>
                    <span className="text-xs text-gray-300 font-bold">{post.author}</span>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full text-center py-20">
              <Icon icon="solar:sad-square-linear" className="text-6xl text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white">Artikel tidak ditemukan</h3>
              <p className="text-gray-500">Coba cari dengan kata kunci lain.</p>
            </div>
          )}
        </div>

        {/* === NEWSLETTER CTA === */}
        <div className="mt-24 relative rounded-3xl overflow-hidden bg-primary/5 border border-primary/20 p-8 md:p-16 text-center">
           <div className="absolute inset-0 bg-[url('/images/pattern.png')] opacity-5"></div> {/* Optional Pattern */}
           <div className="relative z-10 max-w-2xl mx-auto">
              <Icon icon="solar:letter-bold" className="text-5xl text-primary mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-4">Jangan Ketinggalan Info Kos Terbaru</h2>
              <p className="text-gray-400 mb-8">Dapatkan notifikasi kos murah baru, promo eksklusif, dan tips anak kos langsung di emailmu.</p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                 <input 
                    type="email" 
                    placeholder="Masukkan alamat email kamu" 
                    className="flex-1 bg-darkmode border border-white/10 rounded-xl px-5 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                 />
                 <button className="bg-primary hover:bg-green-600 text-darkmode font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-green-500/20">
                    Langganan
                 </button>
              </div>
              <p className="text-gray-500 text-xs mt-4">Kami tidak akan mengirim spam. Unsubscribe kapan saja.</p>
           </div>
        </div>

      </div>
    </main>
  );
};

export default BlogPage;
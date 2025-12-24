"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import Link from "next/link";

// --- DUMMY DATA BLOG DETAIL ---
// Idealnya data ini diambil dari API/Database berdasarkan props 'id'
const blogData = {
  id: 1,
  title: "5 Tips Menghemat Listrik Token untuk Anak Kos, Bisa Hemat 50%!",
  author: "Rizky Admin",
  date: "20 Des 2025",
  readTime: "5 min read",
  image: "/images/hero/banner.jpg",
  category: "Tips Hemat"
};

const BlogClient = ({ id }: { id: number }) => {
  const [scrollProgress, setScrollProgress] = useState(0);

  // --- LOGIC: READING PROGRESS BAR ---
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (window.scrollY / totalHeight) * 100;
      setScrollProgress(progress);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <main className="bg-darkmode min-h-screen text-white relative">
      
      {/* === 1. READING PROGRESS BAR (Fixed Top) === */}
      <div className="fixed top-0 left-0 w-full h-1.5 z-50 bg-gray-800">
        <div 
          className="h-full bg-primary transition-all duration-150 ease-out" 
          style={{ width: `${scrollProgress}%` }}
        ></div>
      </div>

      {/* === 2. ARTICLE HEADER === */}
      <header className="pt-32 pb-10 container mx-auto px-4 text-center max-w-4xl">
        {/* Breadcrumb */}
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mb-6 font-bold uppercase tracking-wider">
           <Link href="/blog" className="hover:text-primary transition-colors">Blog</Link>
           <Icon icon="solar:alt-arrow-right-linear" />
           <span className="text-primary">{blogData.category}</span>
        </div>

        <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold mb-6 leading-tight">
          {blogData.title}
        </h1>

        <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
           <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-600 border border-white/10 overflow-hidden relative">
                 <div className="absolute inset-0 bg-gradient-to-tr from-primary to-blue-500 opacity-50"></div>
              </div>
              <span className="text-white font-bold">{blogData.author}</span>
           </div>
           <span className="w-1 h-1 rounded-full bg-gray-600"></span>
           <span>{blogData.date}</span>
           <span className="w-1 h-1 rounded-full bg-gray-600"></span>
           <span className="flex items-center gap-1"><Icon icon="solar:clock-circle-bold" className="text-primary"/> {blogData.readTime}</span>
        </div>
      </header>

      {/* === 3. FEATURED IMAGE === */}
      <div className="container mx-auto px-4 mb-16">
         <div className="relative w-full aspect-video md:aspect-[21/9] rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
            <Image 
               src={blogData.image} 
               alt="Cover Article" 
               fill 
               className="object-cover"
               priority
            />
         </div>
      </div>

      {/* === 4. CONTENT AREA === */}
      <div className="container mx-auto px-4 pb-24">
         <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 relative">
            
            {/* --- LEFT: STICKY SHARE --- */}
            <div className="hidden lg:block lg:col-span-2 relative">
               <div className="sticky top-32 flex flex-col gap-4 items-center">
                  <span className="text-[10px] uppercase font-bold text-gray-500 mb-2 writing-vertical">Share</span>
                  <button className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-gray-400 hover:bg-[#1877F2] hover:text-white transition-all"><Icon icon="logos:facebook" width="18" /></button>
                  <button className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-gray-400 hover:bg-[#1DA1F2] hover:text-white transition-all"><Icon icon="logos:twitter" width="18" /></button>
                  <button className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-gray-400 hover:bg-[#25D366] hover:text-white transition-all"><Icon icon="logos:whatsapp-icon" width="18" /></button>
               </div>
            </div>

            {/* --- CENTER: MAIN ARTICLE --- */}
            <article className="lg:col-span-8">
               <div className="space-y-8 text-gray-300 leading-loose text-lg font-light">
                  <p className="first-letter:text-5xl first-letter:font-bold first-letter:text-primary first-letter:mr-1 first-letter:float-left">
                     Tagihan listrik seringkali menjadi "musuh dalam selimut" bagi anak kos. Merasa jarang di kamar, tapi kok token cepat habis? Tenang, kamu tidak sendirian.
                  </p>
                  <p>
                     Berdasarkan data, 60% pengeluaran anak kos selain sewa kamar habis di konsumsi makanan dan listrik. Tapi jangan khawatir, dengan sedikit trik cerdas, kamu bisa memangkas biaya listrik hingga separuhnya.
                  </p>

                  <h2 className="text-2xl md:text-3xl font-bold text-white mt-12 mb-6 flex items-center gap-3">
                     <span className="w-8 h-8 rounded-lg bg-primary text-darkmode flex items-center justify-center text-lg font-bold">1</span>
                     Cabut Colokan "Vampir Listrik"
                  </h2>
                  <p>
                     Banyak yang mengira mematikan TV atau AC lewat remote sudah cukup. Padahal, alat elektronik yang masih tertancap di stopkontak (standby mode) tetap menyedot daya. Ini disebut <em>Vampire Power</em>.
                  </p>
                  <div className="bg-yellow-500/10 border-l-4 border-yellow-500 p-6 rounded-r-xl my-8">
                     <h4 className="text-yellow-500 font-bold text-sm mb-2 uppercase tracking-wider flex items-center gap-2">
                        <Icon icon="solar:lightbulb-bolt-bold" /> Pro Tips
                     </h4>
                     <p className="text-sm text-yellow-200/80">
                        Gunakan stopkontak yang memiliki saklar on/off (switch). Jadi kamu tidak perlu repot cabut-pasang kabel setiap kali mau pergi.
                     </p>
                  </div>

                  <h2 className="text-2xl md:text-3xl font-bold text-white mt-12 mb-6 flex items-center gap-3">
                     <span className="w-8 h-8 rounded-lg bg-primary text-darkmode flex items-center justify-center text-lg font-bold">2</span>
                     Atur Suhu AC di 24-25°C
                  </h2>
                  <p>
                     Menyetel AC di suhu 16°C tidak akan membuat kamar cepat dingin, malah membuat kompresor bekerja non-stop. Suhu ideal untuk tubuh manusia dan hemat energi adalah di kisaran 24-25 derajat Celcius.
                  </p>
                  
                  <hr className="border-white/10 my-12" />

                  <p className="font-bold text-white">
                     Kesimpulan: Hemat itu kebiasaan, bukan sekadar trik sesaat. Mulai dari hal kecil hari ini, dan rasakan dompetmu lebih tebal di akhir bulan. Selamat mencoba!
                  </p>
               </div>

               {/* AUTHOR BOX */}
               <div className="mt-16 bg-[#1A1A1A] border border-white/5 p-8 rounded-3xl flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left">
                  <div className="w-20 h-20 rounded-full bg-gray-700 border-2 border-primary flex-shrink-0"></div>
                  <div>
                     <h3 className="text-xl font-bold text-white mb-2">Ditulis oleh {blogData.author}</h3>
                     <p className="text-gray-400 text-sm leading-relaxed mb-4">
                        Content Specialist di Kosku. Berpengalaman 5 tahun jadi anak kos.
                     </p>
                  </div>
               </div>
            </article>

            {/* --- RIGHT: STICKY TOC --- */}
            <div className="hidden lg:block lg:col-span-2 relative">
               <div className="sticky top-32">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4 border-l-2 border-primary pl-3">Daftar Isi</h4>
                  <ul className="space-y-3 text-sm border-l border-white/10 pl-3">
                     <li><a href="#" className="text-primary font-medium block">1. Cabut "Vampir Listrik"</a></li>
                     <li><a href="#" className="text-gray-500 hover:text-white transition-colors block">2. Atur Suhu AC Ideal</a></li>
                     <li><a href="#" className="text-gray-500 hover:text-white transition-colors block">Kesimpulan</a></li>
                  </ul>
               </div>
            </div>

         </div>
      </div>
    </main>
  );
};

export default BlogClient;
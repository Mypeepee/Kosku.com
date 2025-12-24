"use client";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";

// Data Dummy Berita
const blogPosts = [
  {
    id: 1,
    title: "5 Tips Memilih Kos Agar Tidak Salah Pilih di Jakarta",
    category: "Tips Penyewa",
    date: "19 Des 2025",
    image: "/images/hero/banner-image.png",
    excerpt: "Jangan sampai menyesal belakangan. Simak panduan lengkap memilih hunian yang aman dan nyaman...",
    slug: "/blog/tips-memilih-kos",
  },
  {
    id: 2,
    title: "Tren Bisnis Kos Eksklusif: Apakah Masih Menguntungkan?",
    category: "Bisnis Properti",
    date: "18 Des 2025",
    image: "/images/hero/banner-image.png",
    excerpt: "Analisa pasar properti tahun 2025 menunjukkan kenaikan permintaan hunian co-living sebesar 40%...",
    slug: "/blog/tren-bisnis-kos",
  },
  {
    id: 3,
    title: "Review Kawasan Kos Mahasiswa Terbaik di Yogyakarta",
    category: "Review Lokasi",
    date: "15 Des 2025",
    image: "/images/hero/banner-image.png",
    excerpt: "Seturan, Gejayan, atau Pogung? Mana yang paling strategis dan ramah kantong mahasiswa...",
    slug: "/blog/review-jogja",
  },
];

const Blog = () => {
  return (
    // REVISI: Mengubah 'py-24' menjadi 'pb-24 pt-0'
    // pt-0 menghilangkan jarak atas, pb-24 menjaga jarak bawah sebelum footer.
    <section className="pb-24 pt-0 relative z-10" id="blog">
      <div className="container mx-auto lg:max-w-screen-xl px-4">
        
        {/* HEADER SECTION */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="h-px w-8 bg-primary"></span>
            <span className="text-primary font-bold tracking-widest uppercase text-sm">
              Wawasan Properti
            </span>
            <span className="h-px w-8 bg-primary"></span>
          </div>
          <h2 className="text-white sm:text-5xl text-4xl font-bold mb-6">
            Berita & Artikel <span className="text-primary">Terbaru</span>
          </h2>
          <p className="text-gray-400 text-lg">
            Dapatkan informasi terkini seputar dunia properti, tips anak kos, hingga panduan investasi.
          </p>
        </div>

        {/* BLOG GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {blogPosts.map((post, index) => (
            <div 
              key={index} 
              className="group bg-white/5 border border-white/10 rounded-3xl overflow-hidden hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(34,197,94,0.1)] flex flex-col h-full"
            >
              {/* Gambar Blog dengan Efek Zoom */}
              <div className="relative h-60 w-full overflow-hidden">
                <Image
                  src={post.image}
                  alt={post.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                {/* Badge Kategori */}
                <div className="absolute top-4 left-4 bg-darkmode/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                  <span className="text-xs font-bold text-primary uppercase tracking-wide">
                    {post.category}
                  </span>
                </div>
              </div>

              {/* Konten Blog */}
              <div className="p-6 flex flex-col flex-grow">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-3">
                  <Icon icon="solar:calendar-date-bold" />
                  <span>{post.date}</span>
                </div>
                
                <h3 className="text-white text-xl font-bold mb-3 line-clamp-2 group-hover:text-primary transition-colors">
                  <Link href={post.slug}>
                    {post.title}
                  </Link>
                </h3>
                
                <p className="text-gray-400 text-sm line-clamp-3 mb-6 flex-grow">
                  {post.excerpt}
                </p>

                {/* Tombol Baca Selengkapnya */}
                <Link 
                  href={post.slug}
                  className="inline-flex items-center gap-2 text-primary font-bold hover:gap-3 transition-all mt-auto"
                >
                  Baca Selengkapnya
                  <Icon icon="solar:arrow-right-linear" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Tombol Lihat Semua */}
        <div className="mt-16 text-center">
          <button className="px-8 py-3 rounded-full border border-white/20 text-white font-bold hover:bg-white hover:text-darkmode transition-all duration-300">
            Lihat Semua Artikel
          </button>
        </div>

      </div>
    </section>
  );
};

export default Blog;
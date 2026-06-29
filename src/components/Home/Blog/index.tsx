import React from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import CoverImage from "@/components/Blog/CoverImage";
import { getLatest } from "@/lib/berita";
import { accentFor, formatTanggal } from "@/lib/beritaUi";

const Blog = async () => {
  // Di-cache lewat ISR halaman (lihat `revalidate` di app/page.tsx) supaya
  // homepage tidak query DB tiap kunjungan. Artikel baru muncul otomatis
  // setelah jendela revalidate.
  let posts: Awaited<ReturnType<typeof getLatest>> = [];
  try {
    posts = await getLatest(3);
  } catch {
    posts = [];
  }

  // Nothing published yet → hide the section entirely.
  if (posts.length === 0) return null;

  return (
    <section className="relative z-10 bg-[#0F0F0F] py-10 sm:py-14" id="blog">
      <div className="container mx-auto px-4 lg:max-w-screen-xl">
        {/* HEADER */}
        <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div data-aos="fade-right" data-aos-duration="1000">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#86efac]">
              <Icon icon="solar:notebook-bold" /> Wawasan Properti
            </span>
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
              Berita &amp; Artikel{" "}
              <span className="bg-gradient-to-r from-[#86efac] to-teal-500 bg-clip-text text-transparent">
                Terbaru
              </span>
            </h2>
          </div>
          <Link
            href="/blog"
            data-aos="fade-left"
            data-aos-duration="1000"
            className="group hidden shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-bold text-white transition-all hover:border-[#86efac] hover:bg-[#86efac] hover:text-black sm:flex"
          >
            Lihat Semua
            <Icon
              icon="solar:arrow-right-linear"
              className="text-lg transition-transform group-hover:translate-x-1"
            />
          </Link>
        </div>

        {/* GRID */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, i) => {
            const accent = accentFor(post.kategori);
            return (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                data-aos="fade-up"
                data-aos-delay={i * 120}
                data-aos-duration="1000"
                className={`group flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#151515] transition-all duration-300 hover:-translate-y-1 ${accent.ring} ${accent.glow}`}
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden">
                  <CoverImage
                    src={post.gambar_utama}
                    alt={post.judul}
                    sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#151515] via-transparent to-transparent opacity-60" />
                  <span
                    className={`absolute left-4 top-4 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide backdrop-blur-md ${accent.chip}`}
                  >
                    {post.kategori}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-6">
                  <div className="mb-3 flex items-center gap-2 text-xs font-medium text-white/40">
                    <Icon icon="solar:calendar-minimalistic-bold" className="text-base" />
                    <span>{formatTanggal(post.tanggal_publish || post.tanggal_dibuat)}</span>
                    <span className="h-1 w-1 rounded-full bg-white/20" />
                    <span>{post.readMinutes} min baca</span>
                  </div>

                  <h3 className="text-lg font-bold leading-snug text-white line-clamp-2 transition-colors group-hover:text-[#86efac]">
                    {post.judul}
                  </h3>

                  {post.ringkasan && (
                    <p className="mt-3 flex-grow text-sm leading-relaxed text-white/50 line-clamp-3">
                      {post.ringkasan}
                    </p>
                  )}

                  <span className={`mt-6 inline-flex items-center gap-2 text-sm font-bold ${accent.text}`}>
                    Baca Selengkapnya
                    <Icon
                      icon="solar:arrow-right-linear"
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* MOBILE CTA */}
        <div className="mt-10 flex justify-center sm:hidden">
          <Link
            href="/blog"
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-7 py-3 text-sm font-bold text-white transition-all hover:border-[#86efac] hover:bg-[#86efac] hover:text-black"
          >
            Lihat Semua Artikel
            <Icon icon="solar:arrow-right-linear" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Blog;

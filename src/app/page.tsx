import React from "react";
import Hero from "@/components/Home/Hero";
import Recommendation from "@/components/Home/Rekomendasi"; // Dulu Work
import WhyKosku from "@/components/Home/WhyKosku";             // Dulu Timeline
import Subscription from "@/components/Home/Pricing";     // Dulu Portfolio
import FAQ from "@/components/Home/FAQ";                       // Dulu Upgrade
import Blog from "@/components/Home/Blog";                     // Dulu Perks
import Types from "@/components/Home/Types";
import Partnership from "@/components/Home/Partnership";
// import TrackRecord from "@/components/Home/TrackRecord"; // dinonaktifkan sementara
import Proses from "@/components/Home/Proses";
import Testimoni from "@/components/Home/Testimoni";
import CtaPenutup from "@/components/Home/CtaPenutup";

// ISR: homepage di-render statis lalu di-cache, di-refresh tiap 5 menit.
// Kunjungan tidak lagi menunggu query DB — HTML disajikan instan dari cache.
export const revalidate = 300;

export default function Home() {
  return (
    <main className="bg-darkmode min-h-screen">
      {/* Hook */}
      <Hero />
      <Types />
      {/* Interest */}
      <Recommendation />
      {/* Trust: institusi/bank */}
      {/* <TrackRecord />  — dinonaktifkan sementara */}
      <Partnership />
      {/* Diferensiasi */}
      <WhyKosku />
      {/* Reduksi friksi: cara kerja aman */}
      <Proses />
      {/* Social proof */}
      <Testimoni />
      {/* Objeksi */}
      <FAQ />
      {/* Konversi */}
      <CtaPenutup />
      {/* <Subscription /> */}
      {/* Nurture / SEO */}
      <Blog />
    </main>
  );
}
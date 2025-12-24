import React from "react";
import Hero from "@/components/Home/Hero";
import Recommendation from "@/components/Home/Rekomendasi"; // Dulu Work
import WhyKosku from "@/components/Home/WhyKosku";             // Dulu Timeline
import Subscription from "@/components/Home/Pricing";     // Dulu Portfolio
import FAQ from "@/components/Home/FAQ";                       // Dulu Upgrade
import Blog from "@/components/Home/Blog";                     // Dulu Perks

export default function Home() {
  return (
    <main className="bg-darkmode min-h-screen">
      <Hero />
      <Recommendation />
      <WhyKosku />
      <Subscription />
      <FAQ />
      <Blog />
    </main>
  );
}
import React from "react";
import Hero from "@/components/Home/Hero";
import Recommendation from "@/components/Home/Rekomendasi"; // Dulu Work
import WhyKosku from "@/components/Home/WhyKosku";             // Dulu Timeline
import Subscription from "@/components/Home/Pricing";     // Dulu Portfolio
import FAQ from "@/components/Home/FAQ";                       // Dulu Upgrade
import Blog from "@/components/Home/Blog";                     // Dulu Perks
import Types from "@/components/Home/Types"; 
import Partnership from "@/components/Home/Partnership"; 

export default function Home() {
  return (
    <main className="bg-darkmode min-h-screen">
      <Hero />
      <Types />
      <Recommendation />
      <Partnership />
      <WhyKosku />
      {/* <Subscription /> */}
      <FAQ />
      <Blog />
    </main>
  );
}
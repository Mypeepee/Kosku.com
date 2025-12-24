"use client";
import React from "react";

// --- PERBAIKAN IMPORT ---
// 1. Hapus "/components/" karena file ada di folder yang sama
// 2. Gunakan nama file yang sesuai (huruf kecil: searchhero, produklist)
import SearchHero from "./searchhero"; 
import ProductList from "./produklist";

const SearchPage = () => {
  return (
    <main className="bg-[#0F0F0F] min-h-screen pb-20">
      <SearchHero />
      <ProductList />
    </main>
  );
};

export default SearchPage;
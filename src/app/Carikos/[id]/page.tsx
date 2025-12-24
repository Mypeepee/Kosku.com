import React from "react";
import DetailClient from "./DetailClient";

// --- WAJIB ADA UNTUK "output: export" ---
// Fungsi ini memberi tahu Next.js: "Tolong buatkan file HTML untuk ID 101, 102, dst."
export async function generateStaticParams() {
  // Masukkan ID dummy yang sesuai dengan data mock Anda
  // Di aplikasi nyata, Anda akan fetch ini dari database/API
  return [
    { id: '1' },
    { id: '2' },
    { id: '3' },
    { id: '4' },
    { id: '5' },
  ];
}

// Server Component
export default function Page({ params }: { params: { id: string } }) {
  // Convert ID string ke number untuk diteruskan ke Client Component
  const kosId = parseInt(params.id);

  return (
    <main className="bg-[#0F0F0F] min-h-screen">
      <DetailClient id={kosId} />
    </main>
  );
}
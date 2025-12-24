import React from "react";
import BlogClient from "./BlogClient";

// --- STATIC PARAMS (WAJIB untuk 'output: export') ---
// Kita harus mendaftarkan semua ID artikel blog yang mungkin ada
export async function generateStaticParams() {
  // Contoh: generate ID 1 sampai 10
  return [
    { id: '1' },
    { id: '2' },
    { id: '3' },
    { id: '4' },
    { id: '5' },
    { id: '6' }
  ];
}

const BlogDetailPage = ({ params }: { params: { id: string } }) => {
  // Konversi ID ke number dan kirim ke Client Component
  const blogId = Number(params.id);
  
  return <BlogClient id={blogId} />;
};

export default BlogDetailPage;
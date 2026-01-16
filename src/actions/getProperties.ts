// src/actions/getProperties.ts
"use server";

// import prisma from "@/lib/prisma"; // Aktifkan jika pakai Prisma

export async function getProperties(params: any) {
  const { kota, tipe, kategori, page = 1 } = params;
  const limit = 15;
  const offset = (Number(page) - 1) * limit;

  // LOGIC DATABASE (Contoh Logic Prisma / SQL)
  // Query ini memfilter HANYA Primary & Secondary
  
  /* CONTOH RAW SQL:
  SELECT p.*, a.nama_lengkap as agent_name, a.foto_profil_url as agent_photo 
  FROM property p
  JOIN agent ag ON p.id_agent = ag.id_agent
  JOIN pengguna u ON ag.id_pengguna = u.id_pengguna
  WHERE p.jenis_transaksi IN ('PRIMARY', 'SECONDARY')
  AND p.kota ILIKE %kota%
  LIMIT 15 OFFSET ...
  */

  // --- MOCK DATA DB (GANTI INI DENGAN QUERY DB ASLI ANDA) ---
  // Di sini saya simulasikan DB membalas data sesuai struktur tabel Anda
  const dbResult = [/* ... data kosong untuk saat ini ... */]; 
  const totalCount = 0; 
  // -----------------------------------------------------------

  return {
    data: dbResult,
    total: totalCount,
    totalPages: Math.ceil(totalCount / limit)
  };
}
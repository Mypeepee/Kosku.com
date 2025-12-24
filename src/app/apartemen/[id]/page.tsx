import DetailClient from "./DetailClient";
import { apartmentsData } from "../data"; // Kita import data dummy untuk ambil list ID-nya

// ============================================================
// FIX: FUNGSI INI WAJIB ADA UNTUK STATIC EXPORT (output: 'export')
// Ini memberitahu Next.js daftar ID apartemen yang harus di-generate HTML-nya
// ============================================================
export async function generateStaticParams() {
  return apartmentsData.map((apartment) => ({
    id: apartment.id.toString(), // ID harus di-convert jadi string
  }));
}

export const metadata = {
  title: "Detail Apartemen | Kosku",
  description: "Sewa apartemen idaman tanpa ribet",
};

export default function Page({ params }: { params: { id: string } }) {
  // Convert ID string dari URL ke number untuk dikirim ke Client Component
  const apartmentId = Number(params.id);

  return <DetailClient id={apartmentId} />;
}
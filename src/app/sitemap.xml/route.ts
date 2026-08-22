/**
 * /sitemap.xml — INDEKS peta situs.
 *
 * Isinya bukan daftar halaman, melainkan daftar berkas peta lain. Ini alamat
 * yang didaftarkan ke Google Search Console; dari sini Google menemukan
 * sendiri seluruh pecahannya.
 *
 * Ditulis sebagai route handler, bukan lewat konvensi `app/sitemap.ts` milik
 * Next. Konvensi itu bagus untuk situs kecil, tapi pada 120 ribu URL ia
 * memaksa pemakaian `generateSitemaps()` yang TIDAK ikut menghasilkan berkas
 * indeksnya — sehingga tetap harus ada berkas seperti ini, dan menggabungkan
 * dua mekanisme untuk satu peta hanya membuat sulit ditelusuri saat ada yang
 * salah.
 */

import {
  HEADER_XML,
  jumlahBagianListing,
  xmlIndeks,
} from "@/lib/sitemap";
import { SITE_URL } from "@/lib/site";

// Jumlah pecahan bergantung pada banyaknya listing, jadi indeksnya ikut
// disegarkan tiap jam — bukan dibekukan saat build.
export const revalidate = 3600;

export async function GET() {
  const sekarang = new Date();

  try {
    const bagian = await jumlahBagianListing();

    const berkas = [
      { url: `${SITE_URL}/sitemap/statis.xml`, lastModified: sekarang },
      ...Array.from({ length: bagian }, (_, i) => ({
        url: `${SITE_URL}/sitemap/listing-${i}.xml`,
        lastModified: sekarang,
      })),
      { url: `${SITE_URL}/sitemap/artikel.xml`, lastModified: sekarang },
    ];

    return new Response(xmlIndeks(berkas), { headers: HEADER_XML });
  } catch (error) {
    // Database tidak terjangkau saat crawler datang.
    //
    // Yang dikembalikan tetap indeks yang sah berisi halaman statis, BUKAN
    // error. Peta situs yang membalas 500 membuat Google menandainya
    // bermasalah dan menurunkan frekuensi pengambilannya untuk waktu yang
    // lama — kerugian yang jauh melebihi satu perayapan yang kehilangan daftar
    // listing.
    console.error("❌ /sitemap.xml gagal:", error);
    return new Response(
      xmlIndeks([{ url: `${SITE_URL}/sitemap/statis.xml`, lastModified: sekarang }]),
      { headers: HEADER_XML },
    );
  }
}

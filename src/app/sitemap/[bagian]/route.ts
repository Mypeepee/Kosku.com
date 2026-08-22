/**
 * /sitemap/{bagian}.xml — satu berkas pecahan peta situs.
 *
 * Nama bagian yang dikenali:
 *   statis.xml      halaman tetap (beranda, /Jual, /Sewa, /Lelang, blog, …)
 *   listing-N.xml   pecahan ke-N daftar listing TERSEDIA (N mulai dari 0)
 *   artikel.xml     artikel blog yang sudah terbit
 *
 * Semuanya ditemukan Google lewat indeks di /sitemap.xml — tidak ada yang
 * perlu didaftarkan satu per satu.
 */

import {
  HEADER_XML,
  bagianArtikel,
  bagianListing,
  halamanStatis,
  jumlahBagianListing,
  xmlUrlset,
} from "@/lib/sitemap";

export const revalidate = 3600;

export async function GET(
  _request: Request,
  { params }: { params: { bagian: string } },
) {
  // Ekstensi ".xml" ikut masuk sebagai bagian dari parameter rute. Dibuang di
  // sini supaya alamat yang dilihat Google tetap berakhiran .xml (yang
  // diharapkan crawler) tanpa nama bagiannya ikut membawa ekstensi.
  const nama = params.bagian.replace(/\.xml$/i, "");

  try {
    if (nama === "statis") {
      return new Response(xmlUrlset(halamanStatis()), { headers: HEADER_XML });
    }

    if (nama === "artikel") {
      return new Response(xmlUrlset(await bagianArtikel()), { headers: HEADER_XML });
    }

    const cocok = /^listing-(\d+)$/.exec(nama);
    if (cocok) {
      const indeks = Number(cocok[1]);

      // Nomor pecahan di luar jangkauan dibalas 404, BUKAN berkas kosong.
      // Berkas kosong yang sah membuat Google terus mengambilnya selamanya;
      // 404 memberitahunya berhenti — dan sekaligus menjadi tanda kalau suatu
      // saat indeks dan pecahannya tidak lagi sepakat.
      if (!Number.isInteger(indeks) || indeks < 0) {
        return new Response("Not found", { status: 404 });
      }
      if (indeks >= (await jumlahBagianListing())) {
        return new Response("Not found", { status: 404 });
      }

      return new Response(xmlUrlset(await bagianListing(indeks)), {
        headers: HEADER_XML,
      });
    }

    return new Response("Not found", { status: 404 });
  } catch (error) {
    console.error(`❌ /sitemap/${params.bagian} gagal:`, error);
    // Di sini 503 memang jawaban yang benar — berbeda dengan indeksnya.
    // Pecahan yang membalas 200 dengan isi kosong akan menghapus ribuan URL
    // dari peta seolah-olah halamannya memang sudah tidak ada lagi.
    return new Response("Sitemap sedang tidak tersedia", { status: 503 });
  }
}

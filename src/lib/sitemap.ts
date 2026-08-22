/**
 * Bagian bersama peta situs — dipakai oleh indeks (/sitemap.xml) dan tiap
 * berkas pecahannya (/sitemap/*.xml).
 *
 * ── KENAPA DIPECAH, BUKAN SATU BERKAS ─────────────────────────────────────
 * Protokol sitemap membatasi satu berkas pada 50.000 URL. Situs ini punya
 * ±120.750 listing berstatus TERSEDIA. Satu berkas tunggal berarti sekitar
 * 70.000 halaman tidak pernah didaftarkan sama sekali — dan yang paling
 * berbahaya, tanpa error apa pun: berkasnya tetap sah, Google tetap menerima,
 * dan tidak ada satu pun tanda bahwa dua pertiga situs hilang dari peta.
 *
 * Karena itu strukturnya indeks + pecahan, pola yang sama dipakai situs
 * marketplace mana pun pada skala ini:
 *
 *   /sitemap.xml                  ← indeks, menunjuk ke semua berkas di bawah
 *   /sitemap/statis.xml
 *   /sitemap/listing-0.xml … listing-N.xml
 *   /sitemap/artikel.xml
 */

import prisma from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";

/**
 * URL per berkas pecahan.
 *
 * Sengaja jauh di bawah batas 50.000. Bukan karena batasnya bisa bergeser,
 * tapi karena tiap berkas dibangun dengan menarik sebanyak itu baris ke memori
 * dalam satu permintaan — 25.000 sudah memberi kelegaan tanpa membuat jumlah
 * berkasnya merepotkan.
 */
export const PER_BAGIAN = 25_000;

/** Segmen URL per jenis transaksi — harus sama dengan nama folder rutenya. */
export function basisJenis(jenis: string): "Jual" | "Sewa" | "Lelang" {
  if (jenis === "SEWA") return "Sewa";
  if (jenis === "LELANG") return "Lelang";
  return "Jual";
}

/**
 * Listing yang layak dirayapi.
 *
 * Hanya TERSEDIA. Yang TERJUAL/tersewa halamannya memang masih hidup (link-nya
 * sudah beredar), tapi mengundang Google merayapinya berarti membelanjakan
 * jatah perayapan untuk halaman yang tidak bisa lagi menghasilkan transaksi.
 * TARIK_LISTING sudah 404, jadi memasukkannya justru mengirim Google ke
 * halaman mati.
 */
export const LISTING_TAYANG = { status_tayang: "TERSEDIA" } as const;

export interface EntriPeta {
  url: string;
  lastModified?: Date | null;
  changefreq?: string;
  priority?: number;
}

const escXml = (s: string): string =>
  s.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;",
  );

/** Bungkus daftar entri jadi dokumen <urlset> yang sah. */
export function xmlUrlset(entri: EntriPeta[]): string {
  const baris = entri
    .map((e) => {
      const bagian = [`    <loc>${escXml(e.url)}</loc>`];
      if (e.lastModified) {
        bagian.push(`    <lastmod>${e.lastModified.toISOString()}</lastmod>`);
      }
      if (e.changefreq) bagian.push(`    <changefreq>${e.changefreq}</changefreq>`);
      if (e.priority != null) bagian.push(`    <priority>${e.priority}</priority>`);
      return `  <url>\n${bagian.join("\n")}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${baris}\n</urlset>\n`;
}

/** Bungkus daftar berkas jadi dokumen <sitemapindex> yang sah. */
export function xmlIndeks(berkas: { url: string; lastModified?: Date }[]): string {
  const baris = berkas
    .map((b) => {
      const bagian = [`    <loc>${escXml(b.url)}</loc>`];
      if (b.lastModified) {
        bagian.push(`    <lastmod>${b.lastModified.toISOString()}</lastmod>`);
      }
      return `  <sitemap>\n${bagian.join("\n")}\n  </sitemap>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${baris}\n</sitemapindex>\n`;
}

/** Halaman tetap yang layak masuk peta. */
export function halamanStatis(): EntriPeta[] {
  const sekarang = new Date();
  return [
    { url: `${SITE_URL}/`, changefreq: "daily", priority: 1 },
    { url: `${SITE_URL}/Jual`, changefreq: "daily", priority: 0.9 },
    { url: `${SITE_URL}/Sewa`, changefreq: "daily", priority: 0.9 },
    { url: `${SITE_URL}/Lelang`, changefreq: "daily", priority: 0.9 },
    { url: `${SITE_URL}/blog`, changefreq: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/titip-jual`, changefreq: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/gabung-jadi-agent`, changefreq: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/about/company-profile`, changefreq: "monthly", priority: 0.4 },
  ].map((e) => ({ ...e, lastModified: sekarang }));
}

/** Satu pecahan listing, diurutkan stabil supaya isi tiap berkas tidak
 *  berpindah-pindah antar permintaan. */
export async function bagianListing(indeks: number): Promise<EntriPeta[]> {
  const rows = await prisma.listing.findMany({
    where: LISTING_TAYANG,
    select: {
      id_property: true,
      slug: true,
      jenis_transaksi: true,
      tanggal_diupdate: true,
      tanggal_dibuat: true,
    },
    // Urut berdasarkan kunci primer, BUKAN tanggal update. Urutan yang
    // berubah-ubah membuat satu listing melompat antar berkas pecahan tiap
    // kali ada yang diperbarui, sehingga Google melihatnya sebagai halaman
    // yang hilang dari satu berkas dan muncul di berkas lain.
    orderBy: { id_property: "asc" },
    skip: indeks * PER_BAGIAN,
    take: PER_BAGIAN,
  });

  return rows.map((l) => ({
    url: `${SITE_URL}/${basisJenis(l.jenis_transaksi)}/${l.slug}-${l.id_property}`,
    // Tanggal ubah yang JUJUR. Menaruh `new Date()` di sini — godaan yang umum
    // — membuat setiap halaman tampak baru saja berubah di tiap perayapan;
    // Google berhenti mempercayai kolom ini, dan halaman yang benar-benar
    // diperbarui kehilangan satu-satunya sinyal bahwa ia berubah.
    lastModified: l.tanggal_diupdate ?? l.tanggal_dibuat,
    changefreq: "weekly",
    priority: 0.8,
  }));
}

export async function bagianArtikel(): Promise<EntriPeta[]> {
  const rows = await prisma.berita.findMany({
    where: { status_publish: "PUBLISHED" },
    select: { slug: true, tanggal_publish: true, tanggal_dibuat: true },
    orderBy: { tanggal_publish: "desc" },
    take: PER_BAGIAN,
  });

  return rows.map((b) => ({
    url: `${SITE_URL}/blog/${b.slug}`,
    lastModified: b.tanggal_publish ?? b.tanggal_dibuat,
    changefreq: "monthly",
    priority: 0.6,
  }));
}

/** Jumlah berkas pecahan listing yang dibutuhkan sekarang. */
export async function jumlahBagianListing(): Promise<number> {
  const total = await prisma.listing.count({ where: LISTING_TAYANG });
  return Math.max(1, Math.ceil(total / PER_BAGIAN));
}

/** Header yang sama untuk semua balasan peta situs. */
export const HEADER_XML = {
  "Content-Type": "application/xml; charset=utf-8",
  // Dibolehkan disimpan CDN sejam, dan boleh disajikan basi sehari selagi
  // versi barunya diambil — crawler tidak pernah menunggu query 25.000 baris.
  "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
} as const;

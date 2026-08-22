/**
 * Backfill slug SEO untuk SELURUH listing yang sudah ada.
 *
 * Cara pakai (Node 24 menjalankan TypeScript langsung):
 *
 *   node scripts/backfill-slug-seo.ts            # uji coba — TIDAK menulis
 *   node scripts/backfill-slug-seo.ts --apply    # benar-benar menulis
 *
 * Uji coba adalah BAWAAN, dan itu disengaja. Skrip ini menulis ulang alamat
 * publik setiap listing; menjalankannya karena salah ketik satu argumen jauh
 * lebih mahal daripada harus mengetik `--apply`.
 *
 * ── KENAPA AMAN DIJALANKAN PADA SITUS YANG SUDAH TERINDEKS ────────────────
 * Halaman detail sudah punya self-healing redirect: URL apa pun yang berakhir
 * `-{id_property}` tetap menemukan listingnya, lalu dialihkan ke slug terbaru
 * dengan HTTP 308 permanen. Jadi setiap URL lama yang sudah tersebar di Google
 * maupun WhatsApp tidak mati — ia berpindah, dan sinyal peringkatnya ikut.
 *
 * ── KENAPA DUA TAHAP ──────────────────────────────────────────────────────
 * Kolom `slug` punya indeks UNIK. Kalau listing A hendak memakai slug yang
 * saat ini masih dipegang listing B, penulisan A gagal — padahal B akan
 * melepasnya beberapa baris kemudian. Karena itu semua baris yang berubah
 * dipindahkan dulu ke slug sementara (`tmp-slug-{id}`) yang dijamin bebas,
 * baru kemudian diberi slug finalnya. Mengurutkan penulisan "dengan pintar"
 * tidak menyelesaikan ini: tabrakan bisa membentuk siklus.
 */

import { PrismaClient } from "@prisma/client";
// Ekstensi `.ts` ditulis eksplisit karena Node mewajibkannya pada impor
// relatif. Agar tsc tetap menerimanya, tsconfig diberi
// `allowImportingTsExtensions` — aman sepenuhnya di proyek ini karena
// `noEmit: true`, jadi tsc tidak pernah menghasilkan berkas yang ekstensinya
// bisa keliru. Alternatifnya (mengecualikan folder scripts/ dari tsconfig)
// akan membuat berkas ini berhenti diperiksa tipenya sama sekali.
import { buatSlugListing } from "../src/lib/listingSlug.ts";

const prisma = new PrismaClient();
const TULIS = process.argv.includes("--apply");

/**
 * Listing LELANG DILEWATI secara bawaan.
 *
 * Ini bukan kehati-hatian abstrak — uji coba pertama skrip ini yang
 * menunjukkannya. Slug lelang yang ada sekarang dibentuk dari ALAMAT aset:
 *
 *   rumah-griya-alam-permai-d1-kapasa-tamalanrea-makassar
 *
 * sementara judulnya kalimat baku dokumen lelang ("1 bidang tanah dengan total
 * luas 117 m2 …") yang praktis sama untuk ribuan aset. Menulis ulang 121 ribu
 * URL yang sudah terindeks demi menggantinya dengan kalimat baku adalah
 * kerugian besar tanpa satu pun keuntungan.
 *
 * `buatSlugListing` kini sudah tahu memilih alamat untuk judul baku (lihat
 * `judulBaku` di @/lib/listingSlug), jadi hasilnya tidak lagi buruk — tapi
 * memindahkan 121 ribu URL sekaligus tetap peristiwa besar yang harus
 * diputuskan sadar, bukan efek samping menjalankan skrip.
 *
 * Jalankan dengan --termasuk-lelang kalau memang itu yang diinginkan.
 */
const IKUT_LELANG = process.argv.includes("--termasuk-lelang");

/** Berapa contoh perubahan yang dicetak saat uji coba. */
const CONTOH = 25;

async function main() {
  console.log(
    TULIS
      ? "MODE: MENULIS — slug akan diubah di database\n"
      : "MODE: UJI COBA — tidak ada yang ditulis (tambahkan --apply untuk menulis)\n",
  );
  console.log(
    IKUT_LELANG
      ? "CAKUPAN: SEMUA listing, termasuk LELANG\n"
      : "CAKUPAN: semua KECUALI lelang (pakai --termasuk-lelang untuk ikut)\n",
  );

  const listings = await prisma.listing.findMany({
    where: IKUT_LELANG ? {} : { jenis_transaksi: { not: "LELANG" } },
    select: {
      id_property: true,
      slug: true,
      judul: true,
      kategori: true,
      kecamatan: true,
      kota: true,
      alamat_lengkap: true,
      jenis_transaksi: true,
    },
    orderBy: { id_property: "asc" },
  });

  console.log(`Membaca ${listings.length} listing.\n`);

  // ── Hitung slug tujuan, selesaikan tabrakan di memori ──────────────────
  // Diselesaikan di sini, bukan lewat query per baris: dengan ribuan listing
  // itu ribuan round-trip, dan yang lebih penting — tabrakan harus dinilai
  // terhadap slug TUJUAN semua baris, bukan terhadap isi tabel saat ini yang
  // sebentar lagi seluruhnya berubah.
  //
  // Slug baris yang TIDAK ikut diproses (lelang, saat dilewati) ikut didaftar
  // lebih dulu sebagai "terpakai". Tanpa ini, sebuah listing sewa bisa diberi
  // slug yang ternyata masih dipegang listing lelang, dan penulisannya gagal
  // menabrak indeks unik di tengah jalan.
  const terpakai = new Set<string>();

  if (!IKUT_LELANG) {
    const lain = await prisma.listing.findMany({
      where: { jenis_transaksi: "LELANG" },
      select: { slug: true },
    });
    for (const l of lain) terpakai.add(l.slug);
    console.log(`${lain.length} slug lelang dicatat sebagai sudah terpakai.\n`);
  }

  const rencana: {
    id: bigint;
    lama: string;
    baru: string;
    jenis: string;
  }[] = [];

  for (const l of listings) {
    const dasar = buatSlugListing({
      judul: l.judul,
      kategori: l.kategori,
      kecamatan: l.kecamatan,
      kota: l.kota,
      alamat: l.alamat_lengkap,
    });

    let baru = dasar;
    let n = 2;
    while (terpakai.has(baru)) baru = `${dasar}-${n++}`;
    terpakai.add(baru);

    if (baru !== l.slug) {
      rencana.push({
        id: l.id_property,
        lama: l.slug,
        baru,
        jenis: l.jenis_transaksi,
      });
    }
  }

  const basis = (j: string) =>
    j === "SEWA" ? "Sewa" : j === "LELANG" ? "Lelang" : "Jual";

  console.log(`${rencana.length} listing akan berubah slug-nya.`);
  console.log(`${listings.length - rencana.length} sudah sesuai, dilewati.\n`);

  if (rencana.length === 0) {
    console.log("Tidak ada yang perlu dikerjakan.");
    return;
  }

  console.log(`Contoh ${Math.min(CONTOH, rencana.length)} perubahan pertama:\n`);
  for (const r of rencana.slice(0, CONTOH)) {
    console.log(`  /${basis(r.jenis)}/${r.lama}-${r.id}`);
    console.log(`  → /${basis(r.jenis)}/${r.baru}-${r.id}\n`);
  }

  if (!TULIS) {
    console.log(
      "Uji coba selesai. Jalankan ulang dengan --apply untuk menuliskannya.",
    );
    return;
  }

  // ── Tahap 1: pindahkan ke slug sementara ──────────────────────────────
  // Hanya baris yang BERUBAH yang disentuh. `tmp-slug-{id}` dijamin bebas
  // karena id_property unik, dan tidak ada slug asli yang berbentuk begitu
  // (slug hasil buatSlugListing tidak pernah diawali "tmp-slug-").
  console.log("Tahap 1/2 — memindahkan ke slug sementara…");
  for (const r of rencana) {
    await prisma.listing.update({
      where: { id_property: r.id },
      data: { slug: `tmp-slug-${r.id}` },
    });
  }

  // ── Tahap 2: slug final ────────────────────────────────────────────────
  console.log("Tahap 2/2 — menuliskan slug final…");
  for (const r of rencana) {
    await prisma.listing.update({
      where: { id_property: r.id },
      data: { slug: r.baru },
    });
  }

  console.log(`\nSelesai. ${rencana.length} slug diperbarui.`);
  console.log(
    "URL lama tetap hidup: halaman detail mengalihkannya dengan HTTP 308.",
  );
}

main()
  .catch((e) => {
    console.error("\n❌ Gagal:", e);
    console.error(
      "\nKalau ini terjadi di tengah Tahap 1, sebagian listing masih memakai\n" +
        "slug sementara `tmp-slug-{id}`. URL-nya TETAP bisa dibuka (id di ujung\n" +
        "yang jadi pegangan). Jalankan ulang skrip ini dengan --apply untuk\n" +
        "menuntaskannya.",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

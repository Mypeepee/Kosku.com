// scripts/audit-lelang.mjs
//
// Ukur kelengkapan data lelang yang SUDAH tersimpan di DB.
//
//   node scripts/audit-lelang.mjs            → laporan kelengkapan semua kolom
//   node scripts/audit-lelang.mjs --contoh   → + contoh baris yang bolong
//
// Kenapa perlu terpisah dari scraper: laporan di akhir scrape hanya menceritakan
// baris yang BARU diproses. Yang menentukan kualitas halaman detail adalah
// seluruh isi tabel, termasuk 121 ribu baris hasil scrape versi lama. Angka di
// sini adalah garis dasar — jalankan sekali sebelum scrape ulang dan sekali
// sesudahnya, lalu bandingkan.

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const contoh = process.argv.includes("--contoh");

const persen = (n, total) => (total ? Math.round((n / total) * 1000) / 10 : 0);
const bar = (p) => {
  const isi = Math.round(p / 5);
  return "█".repeat(isi) + "░".repeat(20 - isi);
};

async function main() {
  const [{ total }] = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int total FROM listing WHERE jenis_transaksi='LELANG'`,
  );

  if (!total) {
    console.log("Tidak ada listing LELANG di database.");
    return;
  }

  // Kolom yang memang harus terisi untuk setiap aset lelang. Kolom turunan
  // (harga_per_meter) & khusus non-lelang (kamar_tidur) sengaja tidak dinilai.
  const KOLOM = [
    "judul", "link", "alamat_lengkap", "kota", "provinsi", "kecamatan", "kelurahan",
    "latitude", "longitude", "luas_tanah", "legalitas", "nomor_legalitas",
    "tanggal_lelang", "nilai_limit_lelang", "uang_jaminan", "vendor", "gambar", "lampiran",
  ];

  const pilihan = KOLOM.map(
    (k) => `count(*) FILTER (WHERE ${k} IS NOT NULL)::int AS "${k}"`,
  ).join(", ");
  const [terisi] = await prisma.$queryRawUnsafe(
    `SELECT ${pilihan} FROM listing WHERE jenis_transaksi='LELANG'`,
  );

  console.log(`\n═══ AUDIT DATA LELANG — ${total.toLocaleString("id-ID")} baris ═══\n`);
  console.log("kolom                terisi          %  ");
  const baris = KOLOM.map((k) => ({ kolom: k, terisi: terisi[k], p: persen(terisi[k], total) }))
    .sort((a, b) => a.p - b.p);
  for (const b of baris) {
    const tanda = b.p === 100 ? "✅" : b.p >= 90 ? "🟡" : "🔴";
    console.log(
      `${tanda} ${b.kolom.padEnd(20)}${String(b.terisi).padStart(7)}  ${String(b.p).padStart(5)}%  ${bar(b.p)}`,
    );
  }

  // ── Mutu isi, bukan cuma ada/tidak ──
  // Kolom terisi belum tentu benar. Tiga hal di bawah adalah cacat yang tidak
  // terlihat oleh hitungan NULL biasa.
  const [mutu] = await prisma.$queryRawUnsafe(`
    SELECT
      count(*) FILTER (WHERE legalitas = 'LAINNYA')::int                       AS legalitas_lainnya,
      count(*) FILTER (WHERE nomor_legalitas ~ ',')::int                       AS nomor_multi,
      count(*) FILTER (WHERE (substring(judul from '([0-9]+) bidang'))::int > 1)::int AS judul_multi_bidang,
      count(*) FILTER (WHERE (substring(judul from '([0-9]+) bidang'))::int > 1
                         AND nomor_legalitas IS NOT NULL
                         AND nomor_legalitas !~ ',')::int                      AS bidang_hilang,
      count(*) FILTER (WHERE kota = 'Tidak Diketahui')::int                    AS kota_kosong,
      count(*) FILTER (WHERE harga = 0 OR harga IS NULL)::int                  AS harga_nol,
      count(*) FILTER (WHERE harga <> nilai_limit_lelang)::int                 AS harga_beda_limit
    FROM listing WHERE jenis_transaksi='LELANG'
  `);

  console.log(`\n── Mutu isi ───────────────────────────────────────────────────`);
  console.log(`legalitas = LAINNYA          : ${mutu.legalitas_lainnya}`);
  console.log(`kota = "Tidak Diketahui"     : ${mutu.kota_kosong}`);
  console.log(`harga = 0 / null             : ${mutu.harga_nol}  (harus = nilai_limit_lelang)`);
  console.log(`harga ≠ nilai_limit_lelang   : ${mutu.harga_beda_limit}`);
  console.log(`\nlot yang judulnya >1 bidang  : ${mutu.judul_multi_bidang}`);
  console.log(`  ↳ menyimpan >1 nomor       : ${mutu.nomor_multi}`);
  console.log(
    `  ↳ HANYA 1 nomor tersimpan  : ${mutu.bidang_hilang}` +
      (mutu.bidang_hilang > 0 ? "   ← bidang hilang, perlu scrape ulang" : ""),
  );

  if (contoh) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id_property::text, substring(judul,1,58) judul, legalitas::text, nomor_legalitas, link
      FROM listing
      WHERE jenis_transaksi='LELANG'
        AND (substring(judul from '([0-9]+) bidang'))::int > 1
        AND (nomor_legalitas IS NULL OR nomor_legalitas !~ ',')
      ORDER BY id_property DESC LIMIT 10
    `);
    console.log(`\n── Contoh lot yang bidangnya hilang ───────────────────────────`);
    for (const r of rows) {
      console.log(`  #${r.id_property}  ${r.legalitas ?? "-"} ${r.nomor_legalitas ?? "-"}`);
      console.log(`     ${r.judul}`);
      console.log(`     ${r.link ?? "(tanpa link)"}`);
    }
  }

  console.log("");
}

main()
  .catch((e) => {
    console.error("Gagal:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

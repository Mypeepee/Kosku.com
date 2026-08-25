// scripts/periksa-urut.mjs
// ───────────────────────────────────────────────────────────────────────────────
// Periksa (dan kalau perlu perbaiki) mesin "Urutkan" pada database yang sedang
// ditunjuk DATABASE_URL.
//
// KENAPA ADA. Urutan & filter harga di /Jual, /Sewa, /Lelang, dan
// /properti/[slug] bertumpu pada kolom turunan `listing.harga_efektif`. Kolom
// itu dibuat `prisma db push`, tapi ISINYA diisi trigger + backfill yang hidup
// di prisma/migration_harga_efektif.sql — SQL yang dijalankan manual per
// environment. Kalau langkah itu terlewat di satu server, kolomnya ada tapi
// seluruhnya NULL: tidak ada error, tidak ada log, halaman tampil normal, dan
// "urutkan termurah" tidak mengubah apa pun. Persis gejala "di lokal benar, di
// produksi tidak terjadi apa-apa".
//
// PAKAI:
//   node scripts/periksa-urut.mjs              # periksa saja (read-only)
//   node scripts/periksa-urut.mjs --perbaiki   # jalankan migrasinya lalu periksa ulang
//   npm run db:urut / npm run db:urut:perbaiki
//
// Keluar dengan kode 1 kalau ada masalah, jadi bisa dipasang di langkah deploy.
// Aman diulang: seluruh SQL yang dijalankan idempoten.
// ───────────────────────────────────────────────────────────────────────────────

import "dotenv/config";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { periksaUrut, laporanKeTeks } from "../src/lib/listingSortDiagnostik.mjs";

const perbaiki = process.argv.includes("--perbaiki");
const prisma = new PrismaClient();

const MIGRASI = [
  "prisma/migration_harga_efektif.sql",
  "prisma/migration_lelang_harga_efektif.sql",
];

function jalankanMigrasi(berkas) {
  console.log(`\n$ prisma db execute --file ${berkas}`);
  const hasil = spawnSync(
    "npx",
    ["prisma", "db", "execute", "--file", berkas, "--schema", "prisma/schema.prisma"],
    { stdio: "inherit", shell: process.platform === "win32" },
  );
  if (hasil.status !== 0) {
    throw new Error(`Gagal menjalankan ${berkas} (kode ${hasil.status}).`);
  }
}

try {
  // Yang dipakai ditampilkan, tanpa kata sandinya. Satu-satunya kesalahan yang
  // paling sering terjadi di sini adalah memeriksa database yang salah.
  const url = process.env.DATABASE_URL ?? "";
  console.log(`Database: ${url.replace(/:\/\/([^:]+):[^@]*@/, "://$1:***@") || "(DATABASE_URL kosong)"}`);

  let laporan = await periksaUrut(prisma);
  laporanKeTeks(laporan).forEach((b) => console.log(b));

  if (!laporan.ok && perbaiki) {
    console.log("── Memperbaiki ─────────────────────────────────────────────────");
    for (const berkas of MIGRASI) jalankanMigrasi(berkas);

    laporan = await periksaUrut(prisma);
    console.log("\n── Setelah perbaikan ───────────────────────────────────────────");
    laporanKeTeks(laporan).forEach((b) => console.log(b));

    if (laporan.ok) {
      console.log(
        "Selesai. RESTART proses aplikasinya — hasil pemeriksaan kolom harga\n" +
          "di-cache per proses (lihat src/lib/listingSortRuntime.ts), jadi server\n" +
          "yang sedang berjalan masih memakai jalur cadangan sampai cache-nya kedaluwarsa.",
      );
    }
  } else if (!laporan.ok) {
    console.log("Tambahkan --perbaiki untuk menjalankan migrasi di atas sekarang juga.");
  }

  process.exitCode = laporan.ok ? 0 : 1;
} catch (e) {
  console.error("\nGagal memeriksa:", e?.message || e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

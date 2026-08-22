// scripts/pindai-sekitar.mjs
// ───────────────────────────────────────────────────────────────────────────────
// Pemanas cache "apa yang ada di sekitar aset ini".
//
// KENAPA ADA. Pemindaian pertama sebuah aset butuh beberapa detik (Overpass →
// kadang geocoding dulu). Kalau semuanya dibiarkan terjadi "saat ada yang
// membuka halaman", maka pengunjung PERTAMA setiap aset — sering kali calon
// pembeli yang baru diberi tautan oleh agent — yang menanggung tunggunya.
// Script ini memindahkan beban itu ke waktu yang tidak ada yang menunggu.
//
// Cara kerjanya sengaja bodoh: ia hanya memanggil API aplikasi sendiri
// (/api/listing/{id}/sekitar) untuk aset yang belum punya baris cache. Semua
// aturan — tangga radius, verifikasi jawaban kosong, sumber cadangan, kapan
// boleh disimpan — tetap satu tempat di src/lib/nearbyPlaces.server.ts, dan
// script ini tidak menduplikasi satu baris pun darinya.
//
// PAKAI:
//   node scripts/pindai-sekitar.mjs                        # 50 aset, localhost
//   node scripts/pindai-sekitar.mjs --limit=500
//   node scripts/pindai-sekitar.mjs --base=https://solusindoaset.com --limit=1000
//   node scripts/pindai-sekitar.mjs --ulang                 # ikut aset yang belum lengkap
//
// Aman diulang & aman dihentikan di tengah jalan: kemajuannya tersimpan di
// tabel, bukan di memori script.
// ───────────────────────────────────────────────────────────────────────────────

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const arg = (nama, bawaan) => {
  const p = process.argv.find((a) => a.startsWith(`--${nama}=`));
  return p ? p.split("=").slice(1).join("=") : bawaan;
};
const ada = (nama) => process.argv.includes(`--${nama}`);

const BASE = (arg("base", "http://localhost:3000") || "").replace(/\/+$/, "");
const LIMIT = Number(arg("limit", "50"));
/** Jeda antar aset — memberi napas ke server publik OSM. Wajib, bukan hiasan. */
const JEDA_MS = Number(arg("jeda", "1500"));

async function main() {
  const ulang = ada("ulang");

  // Aset yang belum pernah dipindai lebih dulu; dengan --ulang, yang hasilnya
  // belum lengkap ikut diantrikan (mis. setelah data OSM daerah itu bertambah).
  const rows = await prisma.$queryRawUnsafe(
    `
    SELECT l.id_property, l.kota, (s.id_property IS NOT NULL) AS pernah
    FROM listing l
    LEFT JOIN listing_sekitar s ON s.id_property = l.id_property
    WHERE l.status_tayang <> 'TARIK_LISTING'
      AND (s.id_property IS NULL ${ulang ? "OR s.lengkap = FALSE" : ""})
    ORDER BY l.tanggal_dibuat DESC NULLS LAST
    LIMIT ${Number.isFinite(LIMIT) ? LIMIT : 50}
    `,
  );

  console.log(
    `🗺️  ${rows.length} aset akan dipindai lewat ${BASE} (jeda ${JEDA_MS} ms)\n`,
  );

  let lengkap = 0;
  let kurang = 0;
  let gagal = 0;

  for (const [i, r] of rows.entries()) {
    const id = String(r.id_property);
    const t = Date.now();
    try {
      const res = await fetch(`${BASE}/api/listing/${id}/sekitar`, {
        headers: { "User-Agent": "SolusindoAset-pemanas/1.0" },
      });
      const j = await res.json();
      const n = Array.isArray(j?.tempat) ? j.tempat.length : 0;
      if (j?.lengkap) lengkap++;
      else if (j?.status === "gagal" || j?.status === "tanpa-titik") gagal++;
      else kurang++;

      console.log(
        `${String(i + 1).padStart(4)}/${rows.length}  ${id.padEnd(8)} ` +
          `${String(r.kota ?? "-").slice(0, 20).padEnd(20)} → ` +
          `${String(j?.status ?? "?").padEnd(10)} r=${String(j?.radius ?? 0).padStart(4)} ` +
          `n=${String(n).padStart(2)} ${j?.lengkap ? "OK" : "--"}  ${Date.now() - t}ms`,
      );
    } catch (e) {
      gagal++;
      console.log(`${String(i + 1).padStart(4)}/${rows.length}  ${id} → ERROR ${e.message}`);
    }

    if (i < rows.length - 1) await new Promise((s) => setTimeout(s, JEDA_MS));
  }

  console.log(
    `\n✅ selesai — lengkap=${lengkap} kurang=${kurang} gagal=${gagal}\n` +
      `   Yang gagal akan dicoba lagi otomatis saat halamannya dibuka ` +
      `(atau jalankan ulang script ini dengan --ulang).`,
  );
}

main()
  .catch((e) => {
    console.error("❌", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

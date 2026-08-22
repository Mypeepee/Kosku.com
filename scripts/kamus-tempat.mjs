// scripts/kamus-tempat.mjs
// ───────────────────────────────────────────────────────────────────────────────
// Pengisi kamus tempat dari data yang SUDAH ada di database.
//
// KENAPA ADA. Kamus "dekat X" tumbuh sendiri: tiap kali sebuah aset dipindai
// (halaman detailnya dibuka pertama kali) atau agent menyimpan patokan, isinya
// bertambah. Tapi data yang sudah telanjur ada sebelum fitur ini dibuat tidak
// akan menyerap dirinya sendiri — dan itulah yang dikerjakan script ini.
//
// Cara kerjanya sengaja bodoh: ia hanya memanggil API aplikasi sendiri
// (/api/tempat/serap). Semua aturan — kanonikalisasi nama, alias, batas
// presisi, dedup — tetap satu tempat di src/lib/tempat/, dan script ini tidak
// menduplikasi satu baris pun darinya.
//
// PAKAI:
//   node scripts/kamus-tempat.mjs                        # semua sumber, localhost
//   node scripts/kamus-tempat.mjs --mode=patokan
//   node scripts/kamus-tempat.mjs --base=https://solusindoaset.com
//
// Aman diulang & aman dihentikan di tengah jalan: seluruh penulisannya upsert.
//
// PRASYARAT: prisma/migration_tempat_landmark.sql sudah dijalankan, dan proses
// aplikasi sudah di-restart setelah `npx prisma generate`.
// ───────────────────────────────────────────────────────────────────────────────

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const arg = (nama, bawaan) => {
  const p = process.argv.find((a) => a.startsWith(`--${nama}=`));
  return p ? p.split("=").slice(1).join("=") : bawaan;
};

const BASE = (arg("base", "http://localhost:3000") || "").replace(/\/+$/, "");
const MODE = arg("mode", "semua");
const PER_BATCH = Number(arg("batch", "200"));
const JEDA_MS = Number(arg("jeda", "150"));

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

async function hitungTotal(mode) {
  if (mode === "patokan") {
    const [r] = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int n FROM listing
       WHERE akses_terdekat IS NOT NULL
         AND jsonb_typeof(akses_terdekat::jsonb) = 'array'
         AND jsonb_array_length(akses_terdekat::jsonb) > 0`,
    );
    return r?.n ?? 0;
  }
  const [r] = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int n FROM listing_sekitar WHERE lengkap = TRUE`,
  );
  return r?.n ?? 0;
}

async function jalankan(mode) {
  const total = await hitungTotal(mode);
  console.log(`\n📚 mode "${mode}" — ${total} baris sumber`);
  if (total === 0) return { patokan: 0, pindai: 0, tanpaPresisi: 0 };

  const ringkas = { patokan: 0, pindai: 0, tanpaPresisi: 0 };

  for (let offset = 0; offset < total; offset += PER_BATCH) {
    const res = await fetch(`${BASE}/api/tempat/serap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.CRON_SECRET
          ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
          : {}),
      },
      body: JSON.stringify({ mode, limit: PER_BATCH, offset }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      console.error(`   ✖ offset ${offset}: ${json.message ?? res.status}`);
      // Satu batch gagal bukan alasan membuang sisanya — penulisannya upsert,
      // jadi batch ini bisa diulang nanti tanpa efek samping.
      continue;
    }

    ringkas.patokan += json.patokan ?? 0;
    ringkas.pindai += json.pindai ?? 0;
    ringkas.tanpaPresisi += json.tanpaPresisi ?? 0;

    const selesai = Math.min(offset + PER_BATCH, total);
    process.stdout.write(`\r   ${selesai}/${total}`);
    await tidur(JEDA_MS);
  }
  process.stdout.write("\n");
  return ringkas;
}

async function main() {
  console.log(`🗺️  kamus tempat lewat ${BASE}`);

  const mode = MODE === "semua" ? ["patokan", "pindai"] : [MODE];
  const total = { patokan: 0, pindai: 0, tanpaPresisi: 0 };
  for (const m of mode) {
    const r = await jalankan(m);
    total.patokan += r.patokan;
    total.pindai += r.pindai;
    total.tanpaPresisi += r.tanpaPresisi;
  }

  // Perawatan penutup: segarkan penghitung & buang tempat yang tidak lagi
  // punya aset. Aturan nama yang berubah (alias baru, singkatan yang
  // dibentangkan) meninggalkan baris yatim yang masih bisa diklik di kotak
  // pencarian padahal tidak ada apa-apa di baliknya.
  const resBersih = await fetch(`${BASE}/api/tempat/serap`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.CRON_SECRET
        ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
        : {}),
    },
    body: JSON.stringify({ mode: "bersihkan" }),
  });
  const bersih = await resBersih.json().catch(() => ({}));
  if (bersih?.ok) {
    console.log(
      `\n🧹 perawatan — ${bersih.disegarkan ?? 0} penghitung disegarkan, ` +
        `${bersih.dibuang ?? 0} tempat tanpa aset dibuang`,
    );
  }

  const [tempat] = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int n FROM tempat`,
  );
  const [alias] = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int n FROM tempat_alias`,
  );
  const [indeks] = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int n FROM listing_tempat`,
  );

  console.log(
    `\n✅ selesai — ${total.patokan} aset berpatokan, ${total.pindai} hasil pindai diserap`,
  );
  console.log(
    `   kamus sekarang: ${tempat.n} tempat, ${alias.n} alias, ${indeks.n} baris indeks`,
  );

  if (total.tanpaPresisi > 0) {
    console.log(
      `\n⚠️  ${total.tanpaPresisi} hasil pindai LAMA dilewati karena presisi titiknya
   tidak tercatat (kolom presisi_titik baru ada sekarang). Titik hasil geocode
   bisa setepat nomor rumah atau sekasar tengah kota, dan menebaknya berarti
   mengarang ketepatan. Baris-baris itu akan masuk kamus dengan sendirinya
   begitu dipindai ulang:

     node scripts/pindai-sekitar.mjs --ulang --limit=500`,
    );
  }

  const [teratas] = await prisma.$queryRawUnsafe(
    `SELECT string_agg(nama || ' (' || jumlah_listing || ')', ', ') s
     FROM (SELECT nama, jumlah_listing FROM tempat
           ORDER BY jumlah_listing DESC, nama LIMIT 8) x`,
  );
  if (teratas?.s) console.log(`\n   contoh isi kamus: ${teratas.s}`);
}

main()
  .catch((e) => {
    console.error("\n✖ gagal:", e?.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

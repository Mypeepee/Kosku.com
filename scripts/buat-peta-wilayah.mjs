// scripts/buat-peta-wilayah.mjs
//
// Bangkitkan ulang src/lib/lelang/wilayah.mjs dari isi database.
//
//   node scripts/buat-peta-wilayah.mjs
//
// Kenapa dibangkitkan, bukan diketik: daftar 514 kabupaten/kota Indonesia
// berubah (pemekaran), dan yang benar-benar dibutuhkan hanyalah kota yang
// MUNCUL di data lelang — ditulis tangan, ia akan usang tanpa ada yang tahu.
// Sumbernya baris yang provinsinya sudah terisi, disaring supaya kesalahan
// lama tidak ikut dipelajari (lihat komentar di file hasilnya).

import "dotenv/config";
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { tebakProvinsi } from "../src/lib/lelang/parse.mjs";

const TUJUAN = "src/lib/lelang/wilayah.mjs";
/** Satu kota diterima hanya bila sekian bagian barisnya sepakat. */
const AMBANG_SEPAKAT = 0.8;

const normalKota = (v) =>
  String(v ?? "")
    .toUpperCase()
    .replace(/^(KOTA ADM\.?|KOTA|KAB\.?|KABUPATEN)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();

const prisma = new PrismaClient();

async function main() {
  const pasangan = await prisma.$queryRawUnsafe(`
    SELECT kota, provinsi, count(*)::int n FROM listing
    WHERE provinsi IS NOT NULL AND kota IS NOT NULL AND kota <> 'Tidak Diketahui'
    GROUP BY 1, 2
  `);

  const agg = new Map();
  let provTakDikenal = 0;
  for (const r of pasangan) {
    const prov = tebakProvinsi(r.provinsi);
    if (!prov) {
      provTakDikenal += r.n;
      continue;
    }
    const kota = normalKota(r.kota);
    if (kota.length < 3) continue;
    const m = agg.get(kota) ?? new Map();
    m.set(prov, (m.get(prov) ?? 0) + r.n);
    agg.set(kota, m);
  }

  const peta = {};
  const ambigu = [];
  for (const [kota, m] of [...agg.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const urut = [...m.entries()].sort((a, b) => b[1] - a[1]);
    const total = urut.reduce((s, [, v]) => s + v, 0);
    if (urut[0][1] / total < AMBANG_SEPAKAT) {
      ambigu.push(`${kota}: ${urut.map(([p, n]) => `${p}(${n})`).join(", ")}`);
      continue;
    }
    peta[kota] = urut[0][0];
  }

  const kunci = Object.keys(peta);
  const isi = kunci.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(peta[k])},`).join("\n");

  const lama = fs.existsSync(TUJUAN) ? fs.readFileSync(TUJUAN, "utf8") : "";
  const kepala = lama.split("/** @type {Record<string, string>} */")[0];
  if (!kepala) {
    console.error(`Gagal: ${TUJUAN} tidak punya kepala komentar yang bisa dipertahankan.`);
    process.exitCode = 1;
    return;
  }

  fs.writeFileSync(
    TUJUAN,
    `${kepala}/** @type {Record<string, string>} */\nexport const KOTA_KE_PROVINSI = {\n${isi}\n};\n`,
  );

  console.log(`✅ ${TUJUAN} — ${kunci.length} kota`);
  console.log(`   baris dengan provinsi tak dikenal : ${provTakDikenal}`);
  console.log(`   kota ambigu (sengaja dilewati)    : ${ambigu.length}`);
  for (const a of ambigu) console.log(`     · ${a}`);
}

main()
  .catch((e) => {
    console.error("Gagal:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

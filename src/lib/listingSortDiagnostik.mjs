// src/lib/listingSortDiagnostik.mjs
// ═══════════════════════════════════════════════════════════════════════════
// PEMERIKSA "URUTKAN" — kenapa daftar tidak berubah saat urutannya diganti
// ═══════════════════════════════════════════════════════════════════════════
//
// KENAPA BERKAS INI ADA
// "Urutkan → harga terendah" bertumpu pada SATU kolom turunan,
// `listing.harga_efektif`, yang TIDAK dibuat oleh `prisma db push`. Kolomnya
// memang ikut dibuat push (ada di schema.prisma), tapi ISINYA diisi trigger +
// backfill yang hidup di prisma/migration_harga_efektif.sql — berkas SQL yang
// harus dijalankan manual di setiap environment.
//
// Kalau langkah itu terlewat di produksi, yang terjadi bukan error, melainkan
// hal yang jauh lebih sulit dilacak: kolomnya ADA tapi seluruhnya NULL, jadi
// `ORDER BY harga_efektif` tidak punya apa pun untuk dibandingkan. Postgres
// menjawab dengan senang hati, halaman tampil normal, tidak ada satu pun baris
// log — dan daftar "termurah" persis sama dengan daftar "termahal". Filter
// harga min/maks memakai kolom yang sama, jadi ia diam-diam nol hasil.
//
// Gejala yang khas: DI LOKAL BENAR, DI PRODUKSI TIDAK ADA EFEK APA-APA.
//
// Berkas ini menjawabnya dengan bukti, bukan tebakan: ia menjalankan urutan
// yang sama persis dengan yang dipakai halaman, lalu memperlihatkan tiga baris
// teratas versi "termurah" dan versi "termahal". Kalau id-nya sama, urutannya
// memang mati — dan laporannya menyebut sebabnya.
//
// Dipakai bersama oleh:
//   • scripts/periksa-urut.mjs        (terminal, bisa sekalian memperbaiki)
//   • src/app/api/diagnostik/urut     (HTTP, untuk memeriksa server produksi)
// Sengaja .mjs polos supaya kedua pemakai itu bisa memuatnya tanpa build step.
// ═══════════════════════════════════════════════════════════════════════════

/** Index yang dibuat prisma/migration_harga_efektif.sql. */
export const INDEX_URUT = [
  "idx_listing_urut_harga",
  "idx_listing_urut_harga_desc",
  "idx_listing_urut_terbaru",
  "idx_listing_urut_jadwal_asc",
  "idx_listing_urut_jadwal_desc",
  "idx_listing_urut_luas_asc",
  "idx_listing_urut_luas_desc",
];

/** Konteks halaman → nilai enum jenis_transaksi yang ditampilkannya. */
export const JENIS_PER_KONTEKS = {
  JUAL: ["PRIMARY", "SECONDARY"],
  LELANG: ["LELANG"],
  SEWA: ["SEWA"],
  SEMUA: ["PRIMARY", "SECONDARY", "LELANG", "SEWA"],
};

/**
 * Aturan `harga_efektif`, ditulis ulang sebagai ekspresi SQL.
 *
 * Sengaja TIDAK memanggil fungsi `listing_harga_efektif()`: fungsi itu dibuat
 * oleh migrasi yang justru sedang diperiksa ada-tidaknya. Pemeriksa yang gagal
 * karena hal yang ia periksa belum terpasang bukan pemeriksa.
 */
const EKSPRESI_HARGA_EFEKTIF = `
  CASE
    WHEN harga_promo IS NOT NULL AND harga_promo > 0 AND harga_promo < harga
    THEN harga_promo ELSE harga
  END`;

const daftarSql = (nilai) => nilai.map((v) => `'${v}'`).join(", ");

/**
 * Laporan lengkap kesehatan mesin urut. Tidak pernah melempar untuk keadaan
 * yang memang sedang dicari (kolom hilang, trigger hilang) — itu justru
 * jawabannya, bukan kegagalan.
 */
export async function periksaUrut(prisma) {
  const laporan = {
    ok: false,
    ringkasan: "",
    masalah: [],
    saran: [],
    kolom: { ada: false, tipe: null },
    baris: { total: 0, kosong: 0, meleset: 0 },
    trigger: { ada: false },
    index: { ada: [], hilang: [...INDEX_URUT] },
    perKonteks: [],
    lelang: { hargaNolTapiPunyaLimit: 0 },
  };

  /* ── 1. Kolomnya ada? Semua pertanyaan lain menganggapnya ada ─────────── */
  const kolom = await prisma.$queryRawUnsafe(
    `SELECT data_type FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'listing' AND column_name = 'harga_efektif'`,
  );
  laporan.kolom.ada = kolom.length > 0;
  laporan.kolom.tipe = kolom[0]?.data_type ?? null;

  if (!laporan.kolom.ada) {
    laporan.masalah.push(
      "Kolom listing.harga_efektif TIDAK ADA di database ini. Semua urutan & filter harga bertumpu padanya.",
    );
    laporan.saran.push(
      "npx prisma db push   (membuat kolomnya dari schema.prisma)",
      "npx prisma db execute --file prisma/migration_harga_efektif.sql --schema prisma/schema.prisma",
    );
    laporan.ringkasan = "Kolom harga_efektif belum ada — urutan harga mustahil bekerja.";
    return laporan;
  }

  /* ── 2. Isinya benar? ─────────────────────────────────────────────────── */
  const [isi] = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE harga_efektif IS NULL)::int AS kosong,
            count(*) FILTER (
              WHERE harga_efektif IS DISTINCT FROM (${EKSPRESI_HARGA_EFEKTIF})
            )::int AS meleset
       FROM listing`,
  );
  laporan.baris = isi;

  /* ── 3. Triggernya hidup? Backfill sekali jalan tidak cukup — baris baru
         dari scraper & form akan masuk dengan harga_efektif NULL. ───────── */
  const [trig] = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS jumlah FROM pg_trigger
      WHERE tgrelid = 'listing'::regclass
        AND tgname = 'trg_listing_harga_efektif' AND NOT tgisinternal`,
  );
  laporan.trigger.ada = trig.jumlah > 0;

  /* ── 4. Index jalur panas ─────────────────────────────────────────────── */
  const idx = await prisma.$queryRawUnsafe(
    `SELECT indexname FROM pg_indexes
      WHERE tablename = 'listing' AND indexname LIKE 'idx_listing_urut_%'`,
  );
  laporan.index.ada = idx.map((r) => r.indexname).sort();
  laporan.index.hilang = INDEX_URUT.filter((n) => !laporan.index.ada.includes(n));

  /* ── 5. Sisa masalah khas LELANG ──────────────────────────────────────── */
  const [lel] = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS jumlah FROM listing
      WHERE jenis_transaksi = 'LELANG'
        AND (harga IS NULL OR harga = 0)
        AND nilai_limit_lelang IS NOT NULL AND nilai_limit_lelang > 0`,
  );
  laporan.lelang.hargaNolTapiPunyaLimit = lel.jumlah;

  /* ── 6. BUKTINYA: jalankan urutan yang sama persis dengan halaman ─────── */
  for (const [konteks, jenis] of Object.entries(JENIS_PER_KONTEKS)) {
    const saring = `jenis_transaksi IN (${daftarSql(jenis)})
                    AND status_tayang IN ('TERSEDIA', 'TERJUAL')`;

    const [ragam] = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS total,
              count(DISTINCT harga_efektif)::int AS ragam,
              count(*) FILTER (WHERE harga_efektif IS NULL)::int AS kosong
         FROM listing WHERE ${saring}`,
    );

    // ORDER BY-nya disalin dari buildOrderBy() di src/lib/listingSort.ts.
    const ambil = (arah) =>
      prisma.$queryRawUnsafe(
        `SELECT id_property::text AS id, harga_efektif::float8 AS harga
           FROM listing WHERE ${saring}
          ORDER BY status_tayang ASC, harga_efektif ${arah}, id_property DESC
          LIMIT 3`,
      );

    const [termurah, termahal] = await Promise.all([ambil("ASC"), ambil("DESC")]);
    const kunci = (baris) => baris.map((b) => b.id).join(",");

    laporan.perKonteks.push({
      konteks,
      total: ragam.total,
      ragamHarga: ragam.ragam,
      kosong: ragam.kosong,
      termurah,
      termahal,
      // Dua daftar yang isinya sama = mengganti urutan tidak mengubah apa pun.
      // Inilah yang dilihat pemakai, diperiksa langsung alih-alih disimpulkan.
      urutBerpengaruh: ragam.total > 3 && kunci(termurah) !== kunci(termahal),
    });
  }

  /* ── 7. Kesimpulan ────────────────────────────────────────────────────── */
  if (laporan.baris.kosong > 0) {
    laporan.masalah.push(
      `${laporan.baris.kosong} dari ${laporan.baris.total} baris punya harga_efektif NULL. ` +
        `ORDER BY pada kolom yang NULL tidak membandingkan apa pun — daftar "termurah" & "termahal" jadi identik.`,
    );
  }
  if (laporan.baris.meleset > laporan.baris.kosong) {
    laporan.masalah.push(
      `${laporan.baris.meleset} baris nilainya tidak sesuai aturan (harga promo yang sah, kalau tidak harga).`,
    );
  }
  if (!laporan.trigger.ada) {
    laporan.masalah.push(
      "Trigger trg_listing_harga_efektif tidak terpasang. Tanpa itu setiap listing BARU masuk dengan harga_efektif NULL, jadi backfill sekali jalan akan rusak lagi besok.",
    );
  }
  if (laporan.index.hilang.length) {
    laporan.masalah.push(
      `Index urut belum ada: ${laporan.index.hilang.join(", ")}. Urutannya tetap benar, tapi tiap halaman menyortir seluruh tabel (ratusan ms).`,
    );
  }
  if (laporan.lelang.hargaNolTapiPunyaLimit > 0) {
    laporan.masalah.push(
      `${laporan.lelang.hargaNolTapiPunyaLimit} listing LELANG punya harga = 0 padahal nilai_limit_lelang terisi. Kartu menampilkan nilai limit, tapi yang diurut & difilter adalah harga.`,
    );
    laporan.saran.push(
      "npx prisma db execute --file prisma/migration_lelang_harga_efektif.sql --schema prisma/schema.prisma",
    );
  }
  const mati = laporan.perKonteks.filter((k) => k.total > 3 && !k.urutBerpengaruh);
  if (mati.length) {
    laporan.masalah.push(
      `Urutan harga TIDAK berpengaruh di: ${mati.map((k) => k.konteks).join(", ")} — tiga baris teratas "termurah" sama persis dengan "termahal".`,
    );
  }

  if (laporan.masalah.length && !laporan.saran.length) {
    laporan.saran.push(
      "npx prisma db execute --file prisma/migration_harga_efektif.sql --schema prisma/schema.prisma",
    );
  } else if (laporan.baris.kosong > 0 || !laporan.trigger.ada || laporan.index.hilang.length) {
    laporan.saran.unshift(
      "npx prisma db execute --file prisma/migration_harga_efektif.sql --schema prisma/schema.prisma",
    );
  }

  laporan.ok = laporan.masalah.length === 0;
  laporan.ringkasan = laporan.ok
    ? `Sehat. ${laporan.baris.total} baris konsisten, trigger aktif, ${laporan.index.ada.length} index urut terpasang.`
    : laporan.masalah[0];

  return laporan;
}

/** Laporan → baris teks siap cetak di terminal. */
export function laporanKeTeks(laporan) {
  const b = [];
  const tanda = laporan.ok ? "OK " : "!! ";
  b.push("");
  b.push("── Pemeriksaan mesin urut ──────────────────────────────────────");
  b.push(`${tanda}${laporan.ringkasan}`);
  b.push("");
  b.push(`kolom harga_efektif : ${laporan.kolom.ada ? laporan.kolom.tipe : "TIDAK ADA"}`);
  if (laporan.kolom.ada) {
    b.push(
      `isi                 : ${laporan.baris.total} baris · NULL ${laporan.baris.kosong} · meleset ${laporan.baris.meleset}`,
    );
    b.push(`trigger             : ${laporan.trigger.ada ? "terpasang" : "TIDAK TERPASANG"}`);
    b.push(
      `index urut          : ${laporan.index.ada.length}/${INDEX_URUT.length}` +
        (laporan.index.hilang.length ? ` · hilang: ${laporan.index.hilang.join(", ")}` : ""),
    );
    b.push("");
    for (const k of laporan.perKonteks) {
      const ringkas = (baris) =>
        baris.map((r) => `${r.id}${r.harga == null ? "(NULL)" : ""}`).join(" ") || "—";
      b.push(
        `${k.konteks.padEnd(7)} ${String(k.total).padStart(7)} baris · ` +
          `${k.ragamHarga} harga berbeda · ` +
          (k.total <= 3
            ? "terlalu sedikit untuk diuji"
            : k.urutBerpengaruh
              ? "urutan BERPENGARUH"
              : "URUTAN MATI"),
      );
      b.push(`        termurah: ${ringkas(k.termurah)}`);
      b.push(`        termahal: ${ringkas(k.termahal)}`);
    }
  }
  if (laporan.masalah.length) {
    b.push("");
    b.push("Masalah:");
    laporan.masalah.forEach((m, i) => b.push(`  ${i + 1}. ${m}`));
  }
  if (laporan.saran.length) {
    b.push("");
    b.push("Jalankan di server yang bersangkutan:");
    laporan.saran.forEach((s) => b.push(`  $ ${s}`));
  }
  b.push("");
  return b;
}

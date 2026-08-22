-- ═══════════════════════════════════════════════════════════════════════════
-- Pembersih durasi sewa yang tidak sah untuk kategorinya
-- Pasangan data dari tabel kode src/lib/sewaKapabilitas.ts
-- ═══════════════════════════════════════════════════════════════════════════
--
-- MASALAHNYA
-- Formulir tambah properti dulu menawarkan keempat durasi sewa (harian,
-- mingguan, bulanan, tahunan) untuk SEMUA kategori. Akibatnya ada gudang
-- dengan tarif harian, tanah dengan tarif mingguan, dan ruko yang durasi
-- utamanya menunjuk harga harian — angka yang tidak pernah dimaksudkan
-- pemiliknya, tapi terlanjur jadi angka yang tampil di kartu listing dan
-- dipakai untuk mengurutkan seluruh halaman /Sewa.
--
-- Sejak src/lib/sewaKapabilitas.ts ada, jalur tulis tidak bisa lagi menyimpan
-- kombinasi itu, dan halaman detail sudah menyaringnya saat membaca. Skrip ini
-- membereskan baris yang ditulis SEBELUM aturan itu berlaku — terutama supaya
-- kartu listing (yang membaca listing.harga & durasi_sewa mentah, tanpa lewat
-- penyaring) berhenti menampilkan "Rp 300.000/hari" untuk sebuah gudang.
--
-- ATURANNYA — harus sama persis dengan KAPABILITAS_SEWA di berkas TS itu:
--   KOS, APARTEMEN   : harian, mingguan, bulanan, tahunan
--   HOTEL_DAN_VILLA  : harian, mingguan, bulanan
--   RUMAH, RUKO, TOKO, GUDANG, PABRIK : bulanan, tahunan
--   TANAH            : tahunan
--
-- Jalankan sekali per environment (lokal & produksi):
--   psql "$DATABASE_URL" -f prisma/migration_sewa_durasi_kategori.sql
-- atau:
--   npx prisma db execute --file prisma/migration_sewa_durasi_kategori.sql --schema prisma/schema.prisma
--
-- Idempoten: aman dijalankan berulang kali (jalan kedua tidak menyentuh apa
-- pun karena tidak ada lagi yang tidak sah). Dibungkus satu transaksi — kalau
-- salah satu tahap gagal, tidak ada listing yang tertinggal dengan harga sudah
-- dinihilkan tapi durasi utamanya belum dihitung ulang.

BEGIN;

-- ── 0. Laporan sebelum ────────────────────────────────────────────────────
-- Dicetak dulu supaya ada catatan berapa banyak yang tersentuh. Kalau
-- angkanya nol, sisa skrip ini memang tidak akan mengubah apa-apa.
DO $$
DECLARE
  n_harga  bigint;
  n_durasi bigint;
BEGIN
  SELECT count(*) INTO n_harga
  FROM listing_sewa_detail d
  JOIN listing l ON l.id_property = d.id_property
  WHERE (d.harga_sewa_harian   IS NOT NULL AND l.kategori NOT IN ('KOS','APARTEMEN','HOTEL_DAN_VILLA'))
     OR (d.harga_sewa_mingguan IS NOT NULL AND l.kategori NOT IN ('KOS','APARTEMEN','HOTEL_DAN_VILLA'))
     OR (d.harga_sewa_bulanan  IS NOT NULL AND l.kategori =  'TANAH')
     OR (d.harga_sewa_tahunan  IS NOT NULL AND l.kategori =  'HOTEL_DAN_VILLA');

  SELECT count(*) INTO n_durasi
  FROM listing_sewa_detail d
  JOIN listing l ON l.id_property = d.id_property
  WHERE (d.durasi_sewa IN ('HARIAN','MINGGUAN') AND l.kategori NOT IN ('KOS','APARTEMEN','HOTEL_DAN_VILLA'))
     OR (d.durasi_sewa = 'BULANAN' AND l.kategori = 'TANAH')
     OR (d.durasi_sewa = 'TAHUNAN' AND l.kategori = 'HOTEL_DAN_VILLA');

  RAISE NOTICE 'Sebelum: % baris punya harga durasi terlarang, % baris durasi utamanya terlarang',
    n_harga, n_durasi;
END $$;

-- ── 1. Nihilkan harga pada durasi yang tidak sah ──────────────────────────
-- Empat UPDATE terpisah, satu per durasi, karena syarat kategorinya berbeda.
-- Masing-masing menyaring `IS NOT NULL` supaya baris yang sudah bersih tidak
-- ikut ditulis ulang (dan tidak ikut menaikkan tanggal_diupdate listingnya).

UPDATE listing_sewa_detail d
SET harga_sewa_harian = NULL
FROM listing l
WHERE l.id_property = d.id_property
  AND d.harga_sewa_harian IS NOT NULL
  AND l.kategori NOT IN ('KOS', 'APARTEMEN', 'HOTEL_DAN_VILLA');

UPDATE listing_sewa_detail d
SET harga_sewa_mingguan = NULL
FROM listing l
WHERE l.id_property = d.id_property
  AND d.harga_sewa_mingguan IS NOT NULL
  AND l.kategori NOT IN ('KOS', 'APARTEMEN', 'HOTEL_DAN_VILLA');

-- Bulanan hanya terlarang untuk TANAH (sewa lahan dihitung per tahun).
UPDATE listing_sewa_detail d
SET harga_sewa_bulanan = NULL
FROM listing l
WHERE l.id_property = d.id_property
  AND d.harga_sewa_bulanan IS NOT NULL
  AND l.kategori = 'TANAH';

-- Tahunan hanya terlarang untuk HOTEL_DAN_VILLA (yang disewa setahun penuh
-- sudah berhenti jadi villa dan seharusnya didaftarkan sebagai Rumah).
UPDATE listing_sewa_detail d
SET harga_sewa_tahunan = NULL
FROM listing l
WHERE l.id_property = d.id_property
  AND d.harga_sewa_tahunan IS NOT NULL
  AND l.kategori = 'HOTEL_DAN_VILLA';

-- ── 2. Satuan minimal sewa ────────────────────────────────────────────────
-- Aturan yang sama: "minimal 2 minggu" pada gudang adalah syarat yang tidak
-- punya tarif pasangannya. Jumlahnya ikut dikosongkan — angka tanpa satuan
-- bukan informasi, dan halaman detail merendernya sebagai "3 " menggantung.
UPDATE listing_sewa_detail d
SET minimal_sewa_satuan = NULL,
    minimal_sewa_jumlah = NULL
FROM listing l
WHERE l.id_property = d.id_property
  AND d.minimal_sewa_satuan IS NOT NULL
  AND (
       (d.minimal_sewa_satuan IN ('HARIAN','MINGGUAN') AND l.kategori NOT IN ('KOS','APARTEMEN','HOTEL_DAN_VILLA'))
    OR (d.minimal_sewa_satuan = 'BULANAN' AND l.kategori = 'TANAH')
    OR (d.minimal_sewa_satuan = 'TAHUNAN' AND l.kategori = 'HOTEL_DAN_VILLA')
  );

-- ── 3. Pilih ulang durasi utama ───────────────────────────────────────────
-- Dijalankan SESUDAH tahap 1: durasi utama harus menunjuk harga yang masih
-- ada. Urutan pemilihannya mengikuti PRIORITAS_DURASI + durasiBawaan di
-- sewaKapabilitas.ts — villa jatuh ke HARIAN lebih dulu (barang per malam),
-- kategori lain ke BULANAN lalu TAHUNAN.
--
-- Baris yang durasi utamanya masih sah DAN harganya masih ada tidak disentuh.
UPDATE listing_sewa_detail d
SET durasi_sewa = CASE
  WHEN l.kategori = 'HOTEL_DAN_VILLA' THEN
    CASE
      WHEN d.harga_sewa_harian   IS NOT NULL THEN 'HARIAN'
      WHEN d.harga_sewa_mingguan IS NOT NULL THEN 'MINGGUAN'
      WHEN d.harga_sewa_bulanan  IS NOT NULL THEN 'BULANAN'
      ELSE NULL
    END
  ELSE
    CASE
      WHEN d.harga_sewa_bulanan  IS NOT NULL THEN 'BULANAN'
      WHEN d.harga_sewa_tahunan  IS NOT NULL THEN 'TAHUNAN'
      WHEN d.harga_sewa_mingguan IS NOT NULL THEN 'MINGGUAN'
      WHEN d.harga_sewa_harian   IS NOT NULL THEN 'HARIAN'
      ELSE NULL
    END
END::durasi_sewa_enum
FROM listing l
WHERE l.id_property = d.id_property
  AND l.jenis_transaksi = 'SEWA'
  AND (
    d.durasi_sewa IS NULL
    OR (d.durasi_sewa IN ('HARIAN','MINGGUAN') AND l.kategori NOT IN ('KOS','APARTEMEN','HOTEL_DAN_VILLA'))
    OR (d.durasi_sewa = 'BULANAN' AND l.kategori = 'TANAH')
    OR (d.durasi_sewa = 'TAHUNAN' AND l.kategori = 'HOTEL_DAN_VILLA')
    -- Durasi utama yang sah tapi harganya kosong: juga harus dipilih ulang,
    -- kalau tidak halaman detail memakai tab yang harganya nol.
    OR (d.durasi_sewa = 'HARIAN'   AND d.harga_sewa_harian   IS NULL)
    OR (d.durasi_sewa = 'MINGGUAN' AND d.harga_sewa_mingguan IS NULL)
    OR (d.durasi_sewa = 'BULANAN'  AND d.harga_sewa_bulanan  IS NULL)
    OR (d.durasi_sewa = 'TAHUNAN'  AND d.harga_sewa_tahunan  IS NULL)
  );

-- ── 4. Samakan listing.harga dengan durasi utama yang baru ────────────────
-- INI TAHAP YANG PALING MUDAH TERLEWAT. `listing.harga` adalah salinan harga
-- pada durasi utama, dan dari sanalah `harga_efektif` (kolom yang menyetir
-- urutan & filter seluruh situs) dihitung oleh trigger. Kalau durasi utamanya
-- berubah di tahap 3 tapi `harga` dibiarkan, halaman /Sewa akan mengurutkan
-- gudang memakai tarif hariannya yang sudah dihapus — persis kelas bug yang
-- dulu melahirkan migration_harga_efektif.sql.
--
-- Trigger trg_listing_harga_efektif ikut jalan sendiri pada UPDATE ini, jadi
-- harga_efektif tidak perlu (dan tidak boleh) disentuh di sini.
UPDATE listing l
SET harga = CASE d.durasi_sewa
      WHEN 'HARIAN'   THEN d.harga_sewa_harian
      WHEN 'MINGGUAN' THEN d.harga_sewa_mingguan
      WHEN 'BULANAN'  THEN d.harga_sewa_bulanan
      WHEN 'TAHUNAN'  THEN d.harga_sewa_tahunan
    END
FROM listing_sewa_detail d
WHERE d.id_property = l.id_property
  AND l.jenis_transaksi = 'SEWA'
  AND d.durasi_sewa IS NOT NULL
  AND CASE d.durasi_sewa
        WHEN 'HARIAN'   THEN d.harga_sewa_harian
        WHEN 'MINGGUAN' THEN d.harga_sewa_mingguan
        WHEN 'BULANAN'  THEN d.harga_sewa_bulanan
        WHEN 'TAHUNAN'  THEN d.harga_sewa_tahunan
      END IS NOT NULL
  -- Hanya yang benar-benar berbeda — supaya jalan kedua skrip ini tidak
  -- menyentuh satu baris pun.
  AND l.harga IS DISTINCT FROM CASE d.durasi_sewa
        WHEN 'HARIAN'   THEN d.harga_sewa_harian
        WHEN 'MINGGUAN' THEN d.harga_sewa_mingguan
        WHEN 'BULANAN'  THEN d.harga_sewa_bulanan
        WHEN 'TAHUNAN'  THEN d.harga_sewa_tahunan
      END;

-- ── 5. Sisa yang tidak bisa dibereskan otomatis ───────────────────────────
-- Listing sewa yang setelah pembersihan tidak punya SATU PUN harga yang sah.
-- Sengaja TIDAK ditarik dari tayang oleh skrip ini: menurunkan listing orang
-- lain diam-diam adalah tindakan yang tidak bisa dibatalkan, dan angka aslinya
-- mungkin benar tapi salah kategori (gudang yang sebenarnya kos harian).
-- Yang benar: agentnya menyunting sendiri. Daftarnya dicetak di sini supaya
-- ada yang bisa dihubungi.
DO $$
DECLARE
  r record;
  n bigint := 0;
BEGIN
  FOR r IN
    SELECT l.id_property, l.kategori, l.id_agent, l.judul
    FROM listing l
    JOIN listing_sewa_detail d ON d.id_property = l.id_property
    WHERE l.jenis_transaksi = 'SEWA'
      AND d.durasi_sewa IS NULL
    ORDER BY l.id_agent, l.id_property
  LOOP
    n := n + 1;
    RAISE NOTICE 'Perlu disunting agent %: listing % (%) — %',
      r.id_agent, r.id_property, r.kategori, r.judul;
  END LOOP;

  RAISE NOTICE 'Selesai. % listing sewa tidak punya harga durasi yang sah lagi.', n;
END $$;

COMMIT;

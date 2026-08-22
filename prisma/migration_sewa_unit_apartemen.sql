-- ============================================================
-- Migration: Detail unit apartemen, biaya tambahan & lokasi kamar kos
--
-- Jalankan SEKALI per environment (staging & production) SEBELUM deploy
-- kode barunya — form tambah/edit property mengirim kolom-kolom ini, dan
-- Prisma akan menolak insert kalau kolomnya belum ada.
--
-- Semua ALTER memakai IF NOT EXISTS sehingga aman dijalankan ulang.
-- Tidak ada kolom NOT NULL & tidak ada backfill: seluruh listing sewa yang
-- sudah tayang tetap valid dengan nilai NULL (artinya "belum diisi").
-- ============================================================

-- ------------------------------------------------------------
-- 1. ENUM tipe unit apartemen (Studio / 1BR / 2BR / 3BR / 4BR+)
--    Nama simbol tidak diawali angka karena identifier Postgres yang
--    diawali angka harus selalu dikutip.
-- ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE tipe_unit_enum AS ENUM (
    'STUDIO',
    'SATU_KAMAR',
    'DUA_KAMAR',
    'TIGA_KAMAR',
    'EMPAT_KAMAR_PLUS'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------
-- 2. listing_sewa_detail — identitas unit, biaya tambahan, jam check-in/out
-- ------------------------------------------------------------
ALTER TABLE listing_sewa_detail
  -- Identitas unit apartemen. VARCHAR (bukan INT) untuk lantai & nomor unit:
  -- di lapangan nilainya memang bukan angka murni ("GF", "12A", "3 Mezzanine").
  -- Nama tower ditulis menyatu di nama_gedung, tidak punya kolom sendiri.
  ADD COLUMN IF NOT EXISTS nama_gedung    VARCHAR(150)   NULL,
  ADD COLUMN IF NOT EXISTS lantai_unit    VARCHAR(20)    NULL,
  ADD COLUMN IF NOT EXISTS nomor_unit     VARCHAR(30)    NULL,
  ADD COLUMN IF NOT EXISTS tipe_unit      tipe_unit_enum NULL,
  -- Biaya di luar harga sewa & deposit, mis.
  -- [{"nama":"Listrik","nominal":150000,"periode":"BULANAN"}]
  ADD COLUMN IF NOT EXISTS biaya_tambahan JSONB          NULL,
  -- Hanya bermakna untuk sewa harian/mingguan; null untuk bulanan/tahunan.
  ADD COLUMN IF NOT EXISTS jam_check_in   VARCHAR(10)    NULL,
  ADD COLUMN IF NOT EXISTS jam_check_out  VARCHAR(10)    NULL;

-- Filter "cari unit 2BR" adalah filter utama di halaman sewa apartemen, jadi
-- kolomnya diindeks. Partial index: hanya baris yang tipe unitnya terisi
-- (mayoritas listing kos akan NULL dan tidak perlu ikut membebani index).
CREATE INDEX IF NOT EXISTS idx_sewa_detail_tipe_unit
  ON listing_sewa_detail (tipe_unit)
  WHERE tipe_unit IS NOT NULL;

-- ------------------------------------------------------------
-- 3. listing_kamar_tipe — letak kamar di dalam gedung kos
-- ------------------------------------------------------------
ALTER TABLE listing_kamar_tipe
  ADD COLUMN IF NOT EXISTS lantai_kamar VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS nomor_kamar  VARCHAR(60) NULL;

-- ------------------------------------------------------------
-- 4. Verifikasi — hasilnya harus 9 baris
-- ------------------------------------------------------------
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE (table_name = 'listing_sewa_detail'
--        AND column_name IN ('nama_gedung','lantai_unit','nomor_unit',
--                            'tipe_unit','biaya_tambahan','jam_check_in','jam_check_out'))
--    OR (table_name = 'listing_kamar_tipe'
--        AND column_name IN ('lantai_kamar','nomor_kamar'))
-- ORDER BY table_name, column_name;

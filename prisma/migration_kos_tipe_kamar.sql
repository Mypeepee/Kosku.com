-- ============================================================
-- Migration: Tipe kamar kos (listing_kamar_tipe)
--
-- Satu listing KOS mewakili satu gedung, dan gedung itu hampir tidak pernah
-- seragam: dari 10 kamar bisa ada 2 kamar mandi dalam yang lebih luas dan
-- lebih mahal. Sebelum tabel ini, pemilik dipaksa memilih SATU luas, SATU
-- jenis kamar mandi dan SATU harga untuk seluruh gedung.
--
-- Tabel ini OPSIONAL: kos yang semua kamarnya sama tidak punya baris di sini
-- dan tetap memakai kolom tunggal di listing_sewa_detail. Kalau barisnya ADA,
-- kolom agregat di listing_sewa_detail (total_kamar, kamar_tersedia,
-- harga_sewa_*) dihitung ulang dari tabel ini oleh API — lihat
-- src/lib/kosRoomTypes.ts. Duplikasi itu disengaja supaya query daftar &
-- filter listing tidak perlu join + agregat per baris.
--
-- Jalankan manual per environment:
--   psql "$DATABASE_URL" -f prisma/migration_kos_tipe_kamar.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS listing_kamar_tipe (
  id                  BIGSERIAL PRIMARY KEY,
  id_property         BIGINT       NOT NULL,
  nama                VARCHAR(80)  NOT NULL,
  urutan              INTEGER      NOT NULL DEFAULT 0,
  jumlah_kamar        INTEGER      NOT NULL,
  kamar_tersedia      INTEGER      NOT NULL DEFAULT 0,
  luas_kamar          NUMERIC(12, 2),
  kamar_mandi_tipe    kamar_mandi_tipe_enum,
  kapasitas_penghuni  INTEGER,
  harga_sewa_harian   NUMERIC(20, 2),
  harga_sewa_mingguan NUMERIC(20, 2),
  harga_sewa_bulanan  NUMERIC(20, 2),
  harga_sewa_tahunan  NUMERIC(20, 2),
  fasilitas_kamar     TEXT,
  catatan             VARCHAR(255),
  tanggal_dibuat      TIMESTAMPTZ  DEFAULT now(),
  tanggal_diupdate    TIMESTAMPTZ  DEFAULT now(),
  -- ON UPDATE CASCADE wajib disebut eksplisit: itu default referential action
  -- Prisma, dan kalau di DB berbeda, `prisma migrate diff` melihatnya sebagai
  -- drift dan terus-menerus mengusulkan drop/recreate constraint ini.
  CONSTRAINT listing_kamar_tipe_listing_fk
    FOREIGN KEY (id_property) REFERENCES listing (id_property)
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Selalu diambil per listing (detail & edit form), tidak pernah berdiri sendiri.
CREATE INDEX IF NOT EXISTS idx_listing_kamar_tipe_property
  ON listing_kamar_tipe (id_property);

-- Sisa kamar > jumlah kamar bikin pill "Sisa N kamar" di card berbohong;
-- tipe tanpa jumlah kamar tidak punya arti sama sekali.
DO $$ BEGIN
  ALTER TABLE listing_kamar_tipe
    ADD CONSTRAINT listing_kamar_tipe_jumlah_check
    CHECK (jumlah_kamar >= 1 AND kamar_tersedia >= 0 AND kamar_tersedia <= jumlah_kamar);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

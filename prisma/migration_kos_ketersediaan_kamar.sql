-- ============================================================
-- Migration: Ketersediaan kamar kos
--
-- Satu listing KOS mewakili SATU gedung dengan banyak kamar, jadi
-- listing.status_tayang (TERSEDIA/TERJUAL) tidak cukup untuk menjawab
-- "masih ada kamar kosong atau tidak". Dua kolom ini yang dipakai card
-- listing untuk menampilkan pill "Sisa N kamar".
--
-- Keduanya NULLABLE: listing sewa non-kos (rumah/apartemen kontrakan) tidak
-- mengisinya, dan listing kos lama juga belum punya nilainya. Card jatuh ke
-- label netral (putra/putri) selama kamar_tersedia masih NULL.
--
-- Jalankan manual per environment:
--   psql "$DATABASE_URL" -f prisma/migration_kos_ketersediaan_kamar.sql
-- ============================================================

ALTER TABLE listing_sewa_detail
  ADD COLUMN IF NOT EXISTS total_kamar    INTEGER,
  ADD COLUMN IF NOT EXISTS kamar_tersedia INTEGER;

-- Angka negatif tidak punya arti, dan sisa kamar tidak boleh melebihi total.
-- Dibuat NOT VALID supaya baris lama (semuanya NULL) tidak perlu discan ulang.
DO $$ BEGIN
  ALTER TABLE listing_sewa_detail
    ADD CONSTRAINT listing_sewa_detail_kamar_check
    CHECK (
      (total_kamar    IS NULL OR total_kamar    >= 0) AND
      (kamar_tersedia IS NULL OR kamar_tersedia >= 0) AND
      (total_kamar IS NULL OR kamar_tersedia IS NULL OR kamar_tersedia <= total_kamar)
    ) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

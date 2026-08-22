-- ============================================================
-- Migration: Ketersediaan sewa berbasis tanggal
--
-- Sebelum ini, ketersediaan sewa hanya satu angka tanpa dimensi waktu
-- (listing_sewa_detail.kamar_tersedia & listing_kamar_tipe.kamar_tersedia),
-- jadi pertanyaan "kamar ini kosong tanggal berapa?" tidak bisa dijawab —
-- padahal panel booking sudah meminta tanggal masuk & keluar.
--
-- Tabel listing_ketersediaan menjadi SUMBER KEBENARAN TUNGGAL, dan kedua
-- kolom kamar_tersedia di atas berubah status menjadi TURUNAN (cache "hari
-- ini" untuk card & filter, supaya query daftar listing tetap tanpa join).
--
-- Jalankan manual per environment:
--   psql "$DATABASE_URL" -f prisma/migration_sewa_ketersediaan.sql
--
-- Aman diulang (idempoten).
-- ============================================================

BEGIN;

-- ── 1. ENUM ──────────────────────────────────────────────────
-- Alasan blokir bukan hiasan: "DISEWA" adalah kamar yang menghasilkan uang,
-- "RENOVASI" adalah kamar yang tidak. Nilainya informasi operasional internal
-- dan tidak pernah dikirim ke pengunjung publik.
DO $$ BEGIN
  CREATE TYPE alasan_blokir_enum AS ENUM (
    'DISEWA', 'RENOVASI', 'DIPAKAI_SENDIRI', 'TUTUP'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. TABEL ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS listing_ketersediaan (
  id              BIGSERIAL PRIMARY KEY,
  id_property     BIGINT       NOT NULL,
  -- NULL = berlaku untuk seluruh listing (unit tunggal, atau kos tanpa tipe).
  id_tipe         BIGINT,
  -- Rentang SETENGAH TERBUKA [tanggal_mulai, tanggal_selesai): hari
  -- tanggal_selesai sudah kosong lagi. Konvensi ini menyamai useBooking
  -- (12 Agu + 8 hari = 20 Agu). Rentang tertutup akan membuat kamar tidak
  -- bisa disewakan pada hari penghuni sebelumnya keluar.
  tanggal_mulai   DATE         NOT NULL,
  -- NULL = terbuka, "sampai dibuka lagi" (tombol "Tandai penuh").
  tanggal_selesai DATE,
  jumlah_kamar    INTEGER      NOT NULL DEFAULT 1,
  alasan          alasan_blokir_enum NOT NULL DEFAULT 'DISEWA',
  catatan         VARCHAR(255),
  dibuat_oleh     VARCHAR(20)  NOT NULL,
  dibuat_pada     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  diperbarui_pada TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT listing_ketersediaan_listing_fk
    FOREIGN KEY (id_property) REFERENCES listing (id_property) ON DELETE CASCADE,
  -- Tipe kamar dihapus lewat wizard edit → bloknya ikut hilang. Ini
  -- satu-satunya jalur yang mengubah tabel ini dari luar API ketersediaan,
  -- jadi sesudahnya kamar_tersedia HARUS dihitung ulang.
  CONSTRAINT listing_ketersediaan_tipe_fk
    FOREIGN KEY (id_tipe) REFERENCES listing_kamar_tipe (id) ON DELETE CASCADE
);

-- ── 3. CHECK ─────────────────────────────────────────────────
-- Rentang setengah terbuka yang kosong ([5 Sep, 5 Sep) = nol hari) tidak
-- memblokir apa pun tapi tampil sebagai baris di daftar pengelola — menolaknya
-- di DB lebih murah daripada menjelaskannya di UI.
DO $$ BEGIN
  ALTER TABLE listing_ketersediaan
    ADD CONSTRAINT listing_ketersediaan_rentang_check
    CHECK (tanggal_selesai IS NULL OR tanggal_selesai > tanggal_mulai);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE listing_ketersediaan
    ADD CONSTRAINT listing_ketersediaan_jumlah_check
    CHECK (jumlah_kamar > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4. INDEX ─────────────────────────────────────────────────
-- Pola query satu-satunya: "semua blok listing X yang menyentuh rentang Y".
CREATE INDEX IF NOT EXISTS idx_ketersediaan_property_rentang
  ON listing_ketersediaan (id_property, tanggal_mulai, tanggal_selesai);

CREATE INDEX IF NOT EXISTS idx_ketersediaan_tipe
  ON listing_ketersediaan (id_tipe);

-- ── 5. BACKFILL ──────────────────────────────────────────────
-- Tujuannya SATU: angka yang tampil hari ini tidak boleh bergeser sedikit pun
-- saat mesin baru mengambil alih. Setiap selisih total_kamar − kamar_tersedia
-- yang sudah ada diubah menjadi satu blok terbuka mulai hari ini, sehingga
-- perhitungan turunan menghasilkan angka yang persis sama.
--
-- Dijaga oleh WHERE NOT EXISTS supaya menjalankan ulang berkas ini tidak
-- menggandakan blok migrasi.

-- 5a. Tipe kamar (kos multi-tipe)
INSERT INTO listing_ketersediaan
  (id_property, id_tipe, tanggal_mulai, tanggal_selesai, jumlah_kamar, alasan, catatan, dibuat_oleh)
SELECT
  t.id_property,
  t.id,
  CURRENT_DATE,
  NULL,
  t.jumlah_kamar - t.kamar_tersedia,
  'DISEWA',
  'Migrasi data lama',
  l.id_agent
FROM listing_kamar_tipe t
JOIN listing l ON l.id_property = t.id_property
WHERE t.jumlah_kamar > t.kamar_tersedia
  AND NOT EXISTS (
    SELECT 1 FROM listing_ketersediaan k WHERE k.id_tipe = t.id
  );

-- 5b. Listing sewa tanpa tipe kamar (kos seragam & unit tunggal)
INSERT INTO listing_ketersediaan
  (id_property, id_tipe, tanggal_mulai, tanggal_selesai, jumlah_kamar, alasan, catatan, dibuat_oleh)
SELECT
  d.id_property,
  NULL,
  CURRENT_DATE,
  NULL,
  d.total_kamar - d.kamar_tersedia,
  'DISEWA',
  'Migrasi data lama',
  l.id_agent
FROM listing_sewa_detail d
JOIN listing l ON l.id_property = d.id_property
WHERE d.total_kamar IS NOT NULL
  AND d.kamar_tersedia IS NOT NULL
  AND d.total_kamar > d.kamar_tersedia
  AND NOT EXISTS (
    SELECT 1 FROM listing_kamar_tipe t WHERE t.id_property = d.id_property
  )
  AND NOT EXISTS (
    SELECT 1 FROM listing_ketersediaan k
    WHERE k.id_property = d.id_property AND k.id_tipe IS NULL
  );

COMMIT;

-- ============================================================
-- 6. PENGERASAN OPSIONAL — jalankan terpisah, hanya bila btree_gist tersedia
--
-- Untuk unit tunggal (apartemen/rumah), dua blok yang tumpang tindih adalah
-- kemustahilan fisik. Dijamin DB jauh lebih kuat daripada dijamin kode
-- aplikasi. Inventaris pooled (kos) TIDAK bisa diekspresikan begini — karena
-- itu pemeriksaan transaksional di sewa-availability-write.ts tetap wajib ada
-- dan tetap menjadi penjaga utama; blok ini murni lapisan tambahan.
--
--   CREATE EXTENSION IF NOT EXISTS btree_gist;
--
--   ALTER TABLE listing_ketersediaan
--     ADD CONSTRAINT ketersediaan_unit_tunggal_tak_tumpang
--     EXCLUDE USING gist (
--       id_property WITH =,
--       daterange(tanggal_mulai, COALESCE(tanggal_selesai, 'infinity'::date), '[)') WITH &&
--     ) WHERE (id_tipe IS NULL AND jumlah_kamar = 1);
-- ============================================================

-- ============================================================
-- VERIFIKASI — jalankan SEBELUM & SESUDAH, hasilnya harus identik.
-- Ini bukti mesin baru mengambil alih tanpa menggeser satu angka pun.
--
--   SELECT id_property, total_kamar, kamar_tersedia
--   FROM listing_sewa_detail ORDER BY id_property;
--
--   SELECT id_property, id, jumlah_kamar, kamar_tersedia
--   FROM listing_kamar_tipe ORDER BY id_property, id;
-- ============================================================

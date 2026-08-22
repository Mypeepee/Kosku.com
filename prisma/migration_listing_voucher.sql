-- ============================================================
-- Migration: Voucher sewa milik listing
--
-- Sebelum ini tidak ada voucher untuk PENYEWA sama sekali. Tabel yang
-- namanya mirip — reward_poin & penukaran_poin — adalah milik AGENT (tukar
-- poin jadi hadiah), bukan potongan harga sewa, dan memakainya untuk ini akan
-- mencampur dua saldo yang tidak ada hubungannya.
--
-- Voucher di sini SELALU milik satu listing. Potongan harga sewa dibayar oleh
-- pemilik aset, bukan oleh platform, jadi hanya dia yang boleh menentukan
-- besarnya — dan hanya untuk asetnya sendiri.
--
-- Jalankan manual per environment:
--   psql "$DATABASE_URL" -f prisma/migration_listing_voucher.sql
--
-- Aman diulang (idempoten). Tidak ada backfill: sebelum ini tidak ada satu
-- pun voucher yang perlu dipindahkan.
-- ============================================================

BEGIN;

-- ── 1. ENUM ──────────────────────────────────────────────────
-- Dipisah sebagai enum, bukan ditebak dari besar `nilai` ("≤100 berarti
-- persen"): potongan Rp 50 memang mustahil, tapi menebaknya di lapisan data
-- berarti voucher nominal kecil diam-diam berubah arti.
DO $$ BEGIN
  CREATE TYPE jenis_voucher_enum AS ENUM ('PERSEN', 'NOMINAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. TABEL ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS listing_voucher (
  id              BIGSERIAL PRIMARY KEY,
  id_property     BIGINT       NOT NULL,

  kode            VARCHAR(30)  NOT NULL,
  nama            VARCHAR(120) NOT NULL,
  deskripsi       VARCHAR(300),

  jenis           jenis_voucher_enum NOT NULL DEFAULT 'NOMINAL',
  -- PERSEN → dibaca 0–100. NOMINAL → dibaca rupiah.
  nilai           NUMERIC(14,2) NOT NULL,
  potongan_maks   BIGINT,
  -- Subtotal sewa minimum. Deposit TIDAK pernah ikut dihitung, di sini maupun
  -- di mesin evaluasinya (src/lib/voucher.ts): deposit uang jaminan yang akan
  -- dikembalikan, mendiskonnya berarti memotong hak penyewa sendiri.
  min_transaksi   BIGINT,

  -- Array kosong = berlaku untuk semua durasi yang ditawarkan listing.
  durasi_berlaku  durasi_sewa_enum[] NOT NULL DEFAULT '{}',
  lama_min        INTEGER,
  -- Inklusif: voucher masih hidup pada tanggal ini.
  berlaku_sampai  DATE,

  aktif           BOOLEAN      NOT NULL DEFAULT TRUE,
  rahasia         BOOLEAN      NOT NULL DEFAULT FALSE,

  dibuat_oleh     VARCHAR(20)  NOT NULL,
  dibuat_pada     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  diperbarui_pada TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT listing_voucher_listing_fk
    FOREIGN KEY (id_property) REFERENCES listing (id_property) ON DELETE CASCADE
);

-- ── 3. CHECK ─────────────────────────────────────────────────
-- Persen di luar 0–100 bukan salah ketik yang bisa ditoleransi: "150%"
-- menghasilkan total negatif, dan yang menanggungnya pemilik aset.
DO $$ BEGIN
  ALTER TABLE listing_voucher
    ADD CONSTRAINT listing_voucher_nilai_check
    CHECK (
      nilai > 0
      AND (jenis <> 'PERSEN' OR nilai <= 100)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE listing_voucher
    ADD CONSTRAINT listing_voucher_batas_check
    CHECK (
      (potongan_maks IS NULL OR potongan_maks > 0)
      AND (min_transaksi IS NULL OR min_transaksi >= 0)
      AND (lama_min IS NULL OR lama_min >= 1)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4. KEUNIKAN & INDEX ──────────────────────────────────────
-- Unik PER LISTING, bukan global: dua pemilik berbeda boleh sama-sama memakai
-- "HEMAT10" untuk asetnya masing-masing. Keunikan global hanya akan menolak
-- pemilik kedua tanpa sebab yang bisa dia lihat.
CREATE UNIQUE INDEX IF NOT EXISTS uq_listing_voucher_kode
  ON listing_voucher (id_property, kode);

-- Pola query satu-satunya di sisi publik: "voucher aktif milik listing X".
CREATE INDEX IF NOT EXISTS idx_listing_voucher_property_aktif
  ON listing_voucher (id_property, aktif);

COMMIT;

-- ============================================================
-- VERIFIKASI
--
--   \d listing_voucher
--   SELECT id_property, kode, jenis, nilai, aktif, berlaku_sampai
--   FROM listing_voucher ORDER BY id_property, kode;
-- ============================================================

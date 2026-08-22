-- ============================================================
-- Migration: Voucher v2 — jadwal mulai, kuota, & catatan pemakaian
--
-- Lanjutan dari prisma/migration_listing_voucher.sql. JALANKAN SESUDAHNYA:
--   psql "$DATABASE_URL" -f prisma/migration_listing_voucher.sql
--   psql "$DATABASE_URL" -f prisma/migration_listing_voucher_v2.sql
--
-- Aman diulang (idempoten). Backfill-nya sepele dan sudah tercakup oleh
-- DEFAULT: voucher lama tidak punya jadwal mulai (NULL = berlaku sejak
-- dibuat) dan tidak punya kuota (NULL = tanpa batas), yang keduanya persis
-- perilaku sebelum migrasi ini.
--
-- ── APA YANG DITAMBAHKAN & KENAPA ──────────────────────────────────────────
--
-- 1. `berlaku_mulai` — tanggal voucher MULAI hidup.
--    Sebelumnya hanya ada tanggal berakhir, jadi satu-satunya cara memasang
--    promo untuk minggu depan adalah dengan mengingat sendiri untuk membuatnya
--    minggu depan. Pemilik yang lupa kehilangan promonya; pemilik yang tidak
--    lupa harus membuat voucher pada jam yang tepat. Keduanya masalah yang
--    diselesaikan satu kolom tanggal.
--
-- 2. `kuota_total` & `kuota_terpakai` — batas jumlah pemakaian.
--    Ini alat promosi, bukan sekadar pengaman: "sisa 5 dari 20" adalah alasan
--    penyewa memutuskan HARI INI, dan itulah yang dipakai hampir semua
--    aplikasi tiket & hotel. Sekaligus batas kerugian yang bisa dihitung
--    pemilik di muka — 20 × Rp 250.000 adalah angka yang bisa dianggarkan,
--    sedangkan promo tanpa kuota tidak punya angka terbesar.
--
--    `kuota_terpakai` disimpan sebagai kolom counter, BUKAN dihitung dengan
--    COUNT(*) ke listing_voucher_pakai setiap kali daftar voucher dibuka.
--    Alasannya bukan kecepatan (barisnya sedikit), melainkan penguncian:
--    penambahan counter lewat satu UPDATE bersyarat di bawah ini aman dari
--    dua penyewa yang menebus voucher terakhir pada detik yang sama —
--    COUNT lalu INSERT tidak, kecuali seluruh tabel dikunci.
--
-- 3. `listing_voucher_pakai` — satu baris per pemakaian.
--    Counter menjawab "berapa sisa", tabel ini menjawab "promo mana yang
--    sebenarnya menghasilkan". Tanpa itu pemilik hanya bisa menebak: voucher
--    yang tidak pernah dipakai dan voucher yang dipakai 30 kali terlihat sama
--    persis di daftar.
-- ============================================================

BEGIN;

-- ── 1. KOLOM BARU ────────────────────────────────────────────
ALTER TABLE listing_voucher
  ADD COLUMN IF NOT EXISTS berlaku_mulai   DATE,
  ADD COLUMN IF NOT EXISTS kuota_total     INTEGER,
  ADD COLUMN IF NOT EXISTS kuota_terpakai  INTEGER NOT NULL DEFAULT 0;

-- Kuota harus masuk akal DI TINGKAT DATA, bukan hanya di validator aplikasi:
-- counter negatif atau kuota 0 tidak punya arti apa pun, dan satu skrip
-- perbaikan data yang ceroboh cukup untuk membuat seluruh voucher listing
-- menghilang dari panel tanpa jejak sebabnya.
DO $$ BEGIN
  ALTER TABLE listing_voucher
    ADD CONSTRAINT listing_voucher_kuota_check
    CHECK (
      (kuota_total IS NULL OR kuota_total >= 1)
      AND kuota_terpakai >= 0
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Rentang terbalik ("mulai 1 Des, berakhir 1 Nov") menghasilkan voucher yang
-- tidak pernah hidup satu hari pun — dan pemiliknya akan menyangka fiturnya
-- rusak, bukan tanggalnya tertukar.
DO $$ BEGIN
  ALTER TABLE listing_voucher
    ADD CONSTRAINT listing_voucher_rentang_check
    CHECK (
      berlaku_mulai IS NULL
      OR berlaku_sampai IS NULL
      OR berlaku_mulai <= berlaku_sampai
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. CATATAN PEMAKAIAN ─────────────────────────────────────
-- Angka-angka pemesanan ikut DIBEKUKAN di sini (subtotal, potongan, durasi,
-- lama). Sengaja tidak dibaca ulang dari vouchernya saat ditampilkan: pemilik
-- boleh mengubah besaran promonya kapan saja, dan riwayat yang ikut berubah
-- ketika syaratnya diubah bukan riwayat — laporan "promo ini sudah menelan
-- Rp 3 juta" harus tetap benar setelah vouchernya disunting.
CREATE TABLE IF NOT EXISTS listing_voucher_pakai (
  id             BIGSERIAL PRIMARY KEY,
  id_voucher     BIGINT       NOT NULL,
  id_property    BIGINT       NOT NULL,

  -- Disalin, bukan hanya di-join: kode adalah yang dilihat pemilik di riwayat,
  -- dan kode voucher boleh diubah setelah dipakai.
  kode           VARCHAR(30)  NOT NULL,

  nama_klien     VARCHAR(160),
  telepon_klien  VARCHAR(32),

  subtotal       BIGINT       NOT NULL DEFAULT 0,
  potongan       BIGINT       NOT NULL DEFAULT 0,
  durasi         durasi_sewa_enum,
  lama           INTEGER,

  dipakai_pada   TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT listing_voucher_pakai_voucher_fk
    FOREIGN KEY (id_voucher) REFERENCES listing_voucher (id) ON DELETE CASCADE,
  CONSTRAINT listing_voucher_pakai_listing_fk
    FOREIGN KEY (id_property) REFERENCES listing (id_property) ON DELETE CASCADE
);

-- Pola query satu-satunya: "riwayat voucher X, terbaru dulu".
CREATE INDEX IF NOT EXISTS idx_listing_voucher_pakai_voucher
  ON listing_voucher_pakai (id_voucher, dipakai_pada DESC);

-- ── 3. SINKRONKAN COUNTER ────────────────────────────────────
-- Untuk environment yang sudah terlanjur punya baris pemakaian sebelum kolom
-- counter ada. Pada pemasangan baru hasilnya nol baris tersentuh.
UPDATE listing_voucher v
SET kuota_terpakai = s.jml
FROM (
  SELECT id_voucher, COUNT(*)::int AS jml
  FROM listing_voucher_pakai
  GROUP BY id_voucher
) s
WHERE s.id_voucher = v.id
  AND v.kuota_terpakai <> s.jml;

COMMIT;

-- ============================================================
-- VERIFIKASI
--
--   \d listing_voucher
--   \d listing_voucher_pakai
--
--   -- Voucher + pemakaiannya
--   SELECT v.id_property, v.kode, v.berlaku_mulai, v.berlaku_sampai,
--          v.kuota_terpakai, v.kuota_total,
--          COALESCE(SUM(p.potongan), 0) AS total_potongan
--   FROM listing_voucher v
--   LEFT JOIN listing_voucher_pakai p ON p.id_voucher = v.id
--   GROUP BY v.id
--   ORDER BY v.id_property, v.kode;
--
-- CATATAN OPERASIONAL — penambahan counter yang dipakai aplikasi:
--
--   UPDATE listing_voucher
--   SET kuota_terpakai = kuota_terpakai + 1
--   WHERE id = $1
--     AND (kuota_total IS NULL OR kuota_terpakai < kuota_total);
--
-- Syarat kuota ada di dalam WHERE, bukan diperiksa lebih dulu dengan SELECT.
-- Itu yang membuat penebusan terakhir tidak bisa diberikan dua kali kepada
-- dua orang yang menekan tombol pada saat yang sama.
-- ============================================================

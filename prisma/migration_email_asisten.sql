-- prisma/migration_email_asisten.sql
-- ===========================================================================
-- REM PENGIRIMAN EMAIL ASISTEN ASET
--
-- Satu baris = satu email yang SUDAH dikirim ke seorang agent untuk satu slot
-- waktu. Tabelnya kecil dan tugasnya cuma satu: menjadi rem.
--
-- KENAPA REMNYA DI DATABASE, BUKAN DI KODE.
-- Pemindaian aset baru berjalan tiap dua jam. Tanpa rem, seorang agent yang
-- punya klien berkriteria luas akan menerima email tiap dua jam sepanjang hari
-- — dan email yang datang tiap dua jam berhenti dibaca dalam tiga hari. Setelah
-- itu tidak ada email apa pun yang berguna lagi, termasuk yang benar-benar
-- penting.
--
-- Remnya harus di database karena cron bisa berjalan dua kali bersamaan
-- (scheduler menembak sementara panggilan manual sedang jalan). Rem berupa
-- "baca dulu, lalu tulis" akan bocor persis di celah itu. Di sini INSERT-nya
-- yang menjadi izin: unik (id_agent, kunci) — kalau barisnya berhasil masuk,
-- proses inilah yang berhak mengirim; kalau ditolak, slotnya sudah diambil.
--
-- KUNCI: 'ASETBARU:<YYYY-MM-DD>:<slot>' dengan slot = jam WIB / JEDA_EMAIL_JAM.
-- Tanggal ikut masuk supaya barisnya bercerita sendiri saat dibaca manusia,
-- dan supaya pembersihan berkala bisa sekadar membuang yang lampau.
--
-- Jalankan manual (konvensi proyek ini — tidak memakai prisma migrate):
--   psql "$DATABASE_URL" -f prisma/migration_email_asisten.sql
-- Aman diulang.
-- ===========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS email_asisten (
  id            BIGSERIAL PRIMARY KEY,
  id_agent      VARCHAR(20)  NOT NULL,
  kunci         VARCHAR(80)  NOT NULL,
  dikirim_pada  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  jumlah_klien  INTEGER      NOT NULL DEFAULT 0,
  jumlah_aset   INTEGER      NOT NULL DEFAULT 0,
  terkirim      BOOLEAN      NOT NULL DEFAULT FALSE
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_asisten_agent_fk') THEN
    ALTER TABLE email_asisten
      ADD CONSTRAINT email_asisten_agent_fk
      FOREIGN KEY (id_agent) REFERENCES agent(id_agent) ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS email_asisten_unik
  ON email_asisten (id_agent, kunci);

CREATE INDEX IF NOT EXISTS idx_email_asisten_waktu
  ON email_asisten (dikirim_pada DESC);

COMMIT;

-- ============================================================
-- Migration: Voucher v3 — promo khusus tipe kamar tertentu
--
-- Jalankan SESUDAH v1 & v2:
--   psql "$DATABASE_URL" -f prisma/migration_listing_voucher.sql
--   psql "$DATABASE_URL" -f prisma/migration_listing_voucher_v2.sql
--   psql "$DATABASE_URL" -f prisma/migration_listing_voucher_v3.sql
--
-- Aman diulang (idempoten). Tidak ada backfill: array kosong — nilai DEFAULT —
-- berarti "berlaku untuk semua tipe", yang persis perilaku sebelum migrasi ini.
--
-- ── KENAPA ────────────────────────────────────────────────────────────────
-- Kos menjual beberapa tipe kamar dengan harga yang jauh berbeda, dan yang
-- sepi hampir tidak pernah semuanya. Tanpa kolom ini, satu-satunya cara
-- mendiskon tipe Standard yang tersisa lima kamar adalah memasang promo yang
-- juga menggerogoti tipe Deluxe yang justru sudah penuh — pemilik membayar
-- potongan untuk kamar yang tetap akan tersewa tanpa promo apa pun.
--
-- ── KENAPA ARRAY, BUKAN TABEL PENGHUBUNG ──────────────────────────────────
-- Isinya segelintir id per voucher, tidak pernah di-query terbalik ("voucher
-- apa saja yang menyentuh tipe X"), dan selalu dibaca bersama barisnya sendiri.
-- Tabel penghubung untuk itu hanya menambah satu JOIN di setiap pembacaan
-- katalog demi keluwesan yang tidak pernah dipakai. Pola yang sama sudah
-- dipakai `durasi_berlaku` di tabel ini.
--
-- ── TIDAK ADA FOREIGN KEY, DAN ITU DISENGAJA ──────────────────────────────
-- Postgres memang tidak bisa memasang FK per elemen array. Yang lebih penting:
-- perilaku saat tipe kamar DIHAPUS harus GAGAL-TERTUTUP. Id yang tertinggal di
-- sini tidak akan pernah cocok dengan tipe mana pun, sehingga vouchernya
-- berhenti cair — aman. Kebalikannya (membersihkan id yang hilang, sampai
-- arraynya kosong) akan diam-diam mengubah promo "khusus Standard" menjadi
-- promo untuk SELURUH tipe, termasuk yang termahal. Lihat catatan sepadan di
-- src/lib/voucher.ts.
-- ============================================================

BEGIN;

ALTER TABLE listing_voucher
  ADD COLUMN IF NOT EXISTS tipe_berlaku BIGINT[] NOT NULL DEFAULT '{}';

-- Nol di dalam array hampir selalu berarti parse yang gagal ("" → 0) di suatu
-- tempat, dan voucher yang syaratnya mustahil dipenuhi jauh lebih sulit
-- didiagnosis daripada penulisan yang ditolak sejak awal.
--
-- Dipakai operator irisan `&&`, BUKAN `(SELECT bool_and(t > 0) FROM unnest(…))`:
-- Postgres melarang subquery di dalam CHECK sama sekali (versi pertama migrasi
-- ini gagal persis di situ). Batas bawah "harus positif" karena itu tidak
-- ditegakkan di sini — id dari BIGSERIAL tidak pernah negatif, dan
-- `validasiVoucher` di src/lib/voucher.ts sudah menolak apa pun yang bukan
-- digit sebelum sampai ke sini.
DO $$ BEGIN
  ALTER TABLE listing_voucher
    ADD CONSTRAINT listing_voucher_tipe_check
    CHECK (
      tipe_berlaku IS NOT NULL
      AND NOT (tipe_berlaku && ARRAY[0]::BIGINT[])
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;

-- ============================================================
-- VERIFIKASI
--
--   \d listing_voucher
--
--   -- Voucher beserta nama tipe yang dilayaninya
--   SELECT v.kode,
--          v.tipe_berlaku,
--          COALESCE(
--            (SELECT string_agg(k.nama, ', ' ORDER BY k.urutan)
--             FROM listing_kamar_tipe k
--             WHERE k.id = ANY(v.tipe_berlaku)),
--            '(semua tipe)'
--          ) AS tipe
--   FROM listing_voucher v
--   ORDER BY v.id_property, v.kode;
--
--   -- Id yatim: tipenya sudah dihapus, vouchernya berhenti cair (gagal-tertutup)
--   SELECT v.kode, t AS id_tipe_hilang
--   FROM listing_voucher v, unnest(v.tipe_berlaku) AS t
--   WHERE NOT EXISTS (SELECT 1 FROM listing_kamar_tipe k WHERE k.id = t);
-- ============================================================

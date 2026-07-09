-- Backfill modal disetar (nominal_terbayar) untuk data eksisting.
-- Investor yang sudah 'lunas' dianggap sudah menyetor penuh komitmennya.
-- Aman diulang (idempotent): hanya menyalin komitmen ke terbayar bila lunas.
--
-- Jalankan SETELAH `prisma db push` menambahkan kolom nominal_terbayar.
-- UJI DI STAGING DULU — ini menyentuh data uang riil.

UPDATE project_investor
SET nominal_terbayar = nominal_komitmen
WHERE status = 'lunas'
  AND nominal_terbayar = 0;

-- Investor yang belum lunas: modal disetor tetap 0 (default).
-- Tidak perlu update eksplisit karena default kolom sudah 0.

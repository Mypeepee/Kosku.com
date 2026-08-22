-- ============================================================
-- Migration: Foto per tipe kamar kos (listing_kamar_tipe.gambar)
--
-- MASALAH. Satu kos dengan 3 tipe kamar hampir tidak pernah punya 3 kamar yang
-- terlihat sama — itu justru sebabnya tipenya dipisah. Tapi galeri listing
-- hanya punya satu tumpukan foto untuk seluruh gedung, jadi calon penghuni
-- tidak punya cara tahu kamar mana yang ia lihat di foto. Keputusan sewa kos
-- diambil dari wujud kamarnya, bukan dari daftar fasilitas; tanpa foto per
-- tipe, penghuni datang survei untuk mencari tahu hal yang seharusnya sudah
-- terjawab di halaman.
--
-- BENTUK KOLOM. Sengaja CSV URL seperti `listing.gambar`, bukan kolom URL
-- tunggal, supaya satu parser yang sama dipakai di kedua tempat (lihat
-- buildFotoList di src/app/Sewa/[id]/page.tsx yang memang sudah membaca kolom
-- ini). Form tambah/edit properti membatasi diri pada SATU foto per tipe —
-- lebih dari itu membuat kartu tipe berubah jadi galeri kedua yang justru
-- menutupi perbandingan antar tipe. Batas itu keputusan produk di sisi form,
-- bukan batas struktur data.
--
-- Aman diulang. Jalankan manual per environment:
--   psql "$DATABASE_URL" -f prisma/migration_kos_foto_tipe_kamar.sql
-- ============================================================

ALTER TABLE listing_kamar_tipe
  ADD COLUMN IF NOT EXISTS gambar TEXT;

COMMENT ON COLUMN listing_kamar_tipe.gambar IS
  'CSV URL foto kamar untuk tipe ini (format sama dengan listing.gambar). Form membatasi 1 foto per tipe.';

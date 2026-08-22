-- prisma/migration_preferensi_dekat.sql
-- ===========================================================================
-- KRITERIA "DEKAT LANDMARK" PADA PREFERENSI KLIEN
--
-- Menyimpan pilihan tempat dalam BENTUK YANG SAMA dengan yang dipakai
-- searchbar di URL (`?dekat=unesa-surabaya`), bukan sebagai id angka.
--
-- Kenapa token, bukan id_tempat:
--   • satu pilihan bisa mewakili BANYAK baris kamus — "brand:mie-gacoan"
--     adalah seluruh gerai, "cocok:excelso" adalah semua penulisan namanya.
--     Kolom id tunggal tidak bisa menampung itu.
--   • pilihan "jenis tempat" ("hotel mana pun di Surabaya") sama sekali bukan
--     id — ia kriteria kelas + wilayah.
--   • kamus `tempat` disegarkan berkala dan id bisa berubah; slug tidak.
--   • preferensi dan pencarian jadi bicara bahasa yang sama persis, sehingga
--     "cari aset" di CRM dan hasil pencarian publik tidak bisa menyimpang.
--
-- Radius disimpan terpisah karena agent boleh menyempitkannya dari bawaan
-- kelas tempat (hotel 1500 m, halte 800 m, dst).
--
-- Jalankan manual (konvensi proyek ini — tidak memakai prisma migrate):
--   psql "$DATABASE_URL" -f prisma/migration_preferensi_dekat.sql
-- Aman diulang.
-- ===========================================================================

BEGIN;

ALTER TABLE preferensi_klien
  ADD COLUMN IF NOT EXISTS dekat_nilai  VARCHAR(220),
  ADD COLUMN IF NOT EXISTS dekat_radius INTEGER;

COMMENT ON COLUMN preferensi_klien.dekat_nilai IS
  'Token tempat, sama persis dengan param ?dekat= di searchbar: slug tempat, '
  '"brand:<x>" untuk seluruh gerai satu jaringan, "cocok:<x>" untuk semua '
  'penulisan nama, atau "kelas:<KELAS>[:wilayah]" untuk jenis tempat. '
  'Diterjemahkan bacaTempatTerpilih() saat pencocokan. NULL = tanpa kriteria tempat.';

COMMENT ON COLUMN preferensi_klien.dekat_radius IS
  'Radius meter. NULL = pakai radius bawaan kelas tempatnya.';

-- Batas yang masuk akal dijaga database, bukan hanya formulir: radius 5 cm
-- atau 900 km sama-sama tidak berarti apa pun, dan keduanya bisa masuk lewat
-- panggilan API langsung.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'preferensi_dekat_radius_wajar') THEN
    ALTER TABLE preferensi_klien
      ADD CONSTRAINT preferensi_dekat_radius_wajar
      CHECK (dekat_radius IS NULL OR (dekat_radius BETWEEN 200 AND 20000));
  END IF;
END $$;

COMMIT;

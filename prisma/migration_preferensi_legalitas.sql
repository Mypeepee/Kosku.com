-- prisma/migration_preferensi_legalitas.sql
-- ===========================================================================
-- KRITERIA LEGALITAS PADA PREFERENSI KLIEN
--
-- Satu-satunya kriteria tambahan yang benar-benar bisa dijawab data listing
-- hari ini. Diukur pada 120.395 aset tersedia:
--
--   legalitas   99,9% terisi   SHM 107.005 · HGB 12.123 · AJB 153 · HP 58
--   kamar tidur      4 baris
--   luas bangunan    5 baris
--   kondisi / hadap / akses / koordinat   NOL
--
-- Kriteria yang sisi listing-nya tidak bisa menjawab bukan sekadar tidak
-- berguna — ia merusak: agent mengisinya, hasilnya nol, lalu berhenti memakai
-- seluruh fiturnya. Karena itu hanya kolom ini yang ditambahkan.
--
-- Kenapa legalitas yang penting: banyak pembeli menolak HGB sejak awal, dan
-- bank memperlakukannya berbeda untuk KPR. Ini kriteria yang benar-benar
-- mengubah daftar yang dikirim agent.
--
-- NULL = klien tidak mempermasalahkan. Itu keadaan bawaan dan yang paling
-- sering benar — memaksa agent memilih akan membuatnya mengarang jawaban.
--
-- Jalankan manual (konvensi proyek ini — tidak memakai prisma migrate):
--   psql "$DATABASE_URL" -f prisma/migration_preferensi_legalitas.sql
-- Aman diulang.
-- ===========================================================================

BEGIN;

ALTER TABLE preferensi_klien
  ADD COLUMN IF NOT EXISTS legalitas sertifikat_enum;

COMMENT ON COLUMN preferensi_klien.legalitas IS
  'Sertifikat yang diminta klien. NULL = tidak mempermasalahkan. Dicocokkan '
  'persis dengan listing.legalitas oleh src/lib/klienMatch.ts.';

COMMIT;

-- Index sengaja TIDAK dibuat: tabel preferensi berisi puluhan sampai ribuan
-- baris, dan penyaringnya selalu dipasangkan dengan id_klien yang sudah
-- ber-index. Index di sini hanya menambah beban tulis tanpa mempercepat apa pun.

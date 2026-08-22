-- prisma/migration_preferensi_lokasi_wajib.sql
-- ===========================================================================
-- TIPE PROPERTI JADI OPSIONAL, DAN KRITERIA TEKS ALAMAT
--
-- ── 1. tipe_properti boleh NULL ───────────────────────────────────────────
-- Sebelumnya tipe properti WAJIB dan lokasi opsional. Itu terbalik dari cara
-- agent berpikir, dan salah di kedua sisinya:
--
--   • Klien yang bilang "apa saja di Wiyung, budget 500 jt" TIDAK BISA
--     dicatat. Agent terpaksa mencentang sembilan tipe satu per satu, atau
--     menebak satu dan kehilangan sisanya.
--   • Preferensi tanpa lokasi menyaring 120 ribu aset se-Indonesia — daftar
--     yang tidak pernah berguna bagi siapa pun.
--
-- NULL sekarang berarti SEMUA TIPE. Itu juga bawaan yang paling sering benar:
-- klien menyebut daerah dan anggaran jauh lebih dulu daripada menyebut ia mau
-- rumah atau ruko.
--
-- Kewajiban lokasi ditegakkan di formulir dan API, BUKAN sebagai NOT NULL di
-- sini: satu baris preferensi menyimpan lokasi dalam empat kolom terpisah
-- (provinsi/kota/kecamatan/kelurahan) yang mana pun boleh terisi, dan CHECK
-- yang mencoba menangkap "salah satunya harus ada" akan menolak baris lama
-- yang sah.
--
-- ── 2. alamat_teks ────────────────────────────────────────────────────────
-- "Dekat X" tidak selalu berarti landmark. Agent sering diberi patokan berupa
-- nama jalan atau perumahan — "Jalan Raya Darmo", "Perum Graha Family" — yang
-- tidak ada di kamus tempat dan memang tidak perlu ada di sana. Teks itu
-- dicocokkan langsung ke `listing.alamat_lengkap`, yang sudah punya index
-- trigram (5 ms pada 120 ribu baris).
--
-- Jalankan manual (konvensi proyek ini — tidak memakai prisma migrate):
--   psql "$DATABASE_URL" -f prisma/migration_preferensi_lokasi_wajib.sql
-- Aman diulang.
-- ===========================================================================

BEGIN;

ALTER TABLE preferensi_klien
  ALTER COLUMN tipe_properti DROP NOT NULL;

COMMENT ON COLUMN preferensi_klien.tipe_properti IS
  'NULL = SEMUA tipe. Bawaan yang paling sering benar: klien menyebut daerah '
  'dan anggaran lebih dulu daripada menyebut rumah atau ruko.';

ALTER TABLE preferensi_klien
  ADD COLUMN IF NOT EXISTS alamat_teks VARCHAR(160);

COMMENT ON COLUMN preferensi_klien.alamat_teks IS
  'Patokan berupa teks alamat — nama jalan / perumahan yang tidak ada di kamus '
  'tempat. Dicocokkan ke listing.alamat_lengkap (index trigram sudah ada).';

COMMIT;

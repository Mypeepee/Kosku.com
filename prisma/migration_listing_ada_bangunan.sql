-- prisma/migration_listing_ada_bangunan.sql
-- ===========================================================================
-- BENTUK ASET: TANAH KOSONG ATAU SUDAH ADA BANGUNANNYA
--
-- MASALAH YANG DIPECAHKAN.
-- `migration_listing_bukan_properti.sql` sudah membuang lot yang bukan
-- properti sama sekali (sepeda motor, sapi, batubara). Yang TERSISA adalah
-- kesalahan yang lebih halus dan justru lebih sering sampai ke tangan klien:
-- lot yang memang properti, tapi BENTUKNYA bukan yang diminta.
--
-- Terukur pada basis data ini (120 ribu baris, status TERSEDIA):
--   • ember TANAH  → 2.467 lot yang judulnya "…berikut bangunan".
--     Klien yang minta tanah menerima rumah tua di atas tanahnya.
--   • ember RUMAH  → 238 lot yang judulnya "1 bidang tanah …" tanpa bangunan,
--     termasuk 76 hektar tanah kosong di Kotawaringin Barat yang dikirim ke
--     orang yang mencari rumah tinggal.
--   • ember GUDANG → 10, ember PABRIK → 5, dengan pola yang sama.
--
-- Sama seperti `bukan_properti`, yang bohong adalah kolom `kategori`: pada
-- data hasil scraping ia adalah EMBER TEMPAT LOT ITU DIAMBIL. Bedanya, di
-- sini judulnya justru MEMBERI jawaban — lot lelang properti hampir selalu
-- berbunyi "N bidang tanah dengan total luas X m2" dan menambahkan "berikut
-- bangunan" bila ada bangunannya. Itu satu bit informasi yang bisa dipercaya,
-- dan satu bit itu cukup untuk memisahkan tanah kosong dari yang terbangun.
--
-- ── URUTAN ATURAN, DAN KENAPA BEGITU ──────────────────────────────────────
--   1. `luas_bangunan > 0`      → ADA bangunan. Angka yang diisi manusia
--      mengalahkan tebakan apa pun atas kata-kata.
--   2. judul menyebut "berikut/beserta/dan bangunan" → ADA.
--   3. judul menyebut wujud bangunan (rumah, ruko, kios, gudang, pabrik,
--      gedung, vila, hotel, apartemen, toko, kantor, kos) → ADA.
--      Diperiksa SESUDAH nomor 2 supaya "1 bidang tanah berikut bangunan"
--      tidak bergantung pada daftar kata ini sama sekali.
--   4. judul menyebut "bidang tanah" / "tanah kosong" / "kavling" dan TIDAK
--      tertangkap aturan 1–3 → TANAH KOSONG.
--   5. sisanya → NULL = TIDAK DIKETAHUI, dan itu disengaja.
--      NULL tidak pernah dibuang oleh mesin pencocokan; hanya nilai yang
--      benar-benar BERTENTANGAN dengan permintaan yang dibuang. Menebak
--      "kosong" untuk judul yang tidak berbunyi apa-apa akan menghapus
--      listing yang diinput agent sendiri (judulnya bebas) dari seluruh
--      pencarian, dan tidak ada yang akan tahu.
--
-- ── KENAPA TRIGGER ────────────────────────────────────────────────────────
-- Alasan yang sama persis dengan `bukan_properti`: ada tiga jalur yang menulis
-- ke tabel ini (scraper lelang, form tambah properti, form edit) dan yang
-- ketiga akan lupa. Trigger membuat kolomnya benar apa pun yang menulis,
-- termasuk perbaikan manual lewat psql.
--
-- Jalankan manual (konvensi proyek ini — tidak memakai prisma migrate):
--   psql "$DATABASE_URL" -f prisma/migration_listing_ada_bangunan.sql
-- Aman diulang.
-- ===========================================================================

BEGIN;

ALTER TABLE listing
  ADD COLUMN IF NOT EXISTS ada_bangunan BOOLEAN;

COMMENT ON COLUMN listing.ada_bangunan IS
  'TRUE = di atas tanahnya ada bangunan, FALSE = tanah kosong, '
  'NULL = tidak bisa disimpulkan dari data yang ada. Diisi trigger '
  'trg_listing_ada_bangunan — jangan diisi manual dari aplikasi.';

CREATE OR REPLACE FUNCTION listing_hitung_ada_bangunan(
  p_luas_bangunan NUMERIC,
  p_judul         TEXT
) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    -- 1. Angka yang diisi manusia mengalahkan tebakan atas kata-kata.
    WHEN COALESCE(p_luas_bangunan, 0) > 0 THEN TRUE
    -- 2. Bunyi baku lot lelang yang terbangun.
    WHEN COALESCE(p_judul, '') ~* '(berikut|beserta|dan)[[:space:]]+bangunan' THEN TRUE
    -- 3. Judul menyebut wujud bangunannya.
    WHEN COALESCE(p_judul, '') ~* (
      'rumah|ruko|kios|gudang|pabrik|gedung|villa|vila|hotel|apartemen|'
      || 'apartment|toko|bangunan|kantor|kost|kos-kosan'
    ) THEN TRUE
    -- 4. Bunyi baku lot lelang tanah kosong.
    WHEN COALESCE(p_judul, '') ~* (
      'bidang[[:space:]]+tanah|tanah[[:space:]]+kosong|kav(l|el)ing|^[[:space:]]*tanah'
    ) THEN FALSE
    -- 5. Tidak diketahui. JANGAN ditebak — lihat catatan di kepala berkas.
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION trg_listing_ada_bangunan() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.ada_bangunan := listing_hitung_ada_bangunan(NEW.luas_bangunan, NEW.judul);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listing_ada_bangunan_biu ON listing;
CREATE TRIGGER listing_ada_bangunan_biu
  BEFORE INSERT OR UPDATE OF luas_bangunan, judul
  ON listing
  FOR EACH ROW EXECUTE FUNCTION trg_listing_ada_bangunan();

-- Backfill baris yang sudah ada.
UPDATE listing
   SET ada_bangunan = listing_hitung_ada_bangunan(luas_bangunan, judul)
 WHERE ada_bangunan IS DISTINCT FROM listing_hitung_ada_bangunan(luas_bangunan, judul);

COMMIT;

-- Sengaja TANPA index, alasan yang sama dengan `bukan_properti`: penyaring ini
-- baru bekerja SESUDAH index kategori/jenis_transaksi/lokasi menyempitkan
-- kolam, dan pada kolam sekecil itu Postgres menyaringnya tanpa biaya berarti.

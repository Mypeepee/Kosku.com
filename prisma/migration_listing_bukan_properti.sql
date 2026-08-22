-- prisma/migration_listing_bukan_properti.sql
-- ===========================================================================
-- GERBANG "BUKAN PROPERTI" PADA TABEL LISTING
--
-- MASALAH YANG DIPECAHKAN.
-- Kolom `kategori` pada listing hasil scraping lelang BUKAN jenis aset
-- sebenarnya — ia adalah ember tempat lot itu diambil. scripts/scrape-lelang.mjs
-- dijalankan dengan `--kategori Rumah`, dan SELURUH lot yang terambil di
-- putaran itu ditulis sebagai RUMAH. Akibatnya di database ada sepeda motor,
-- mobil, ekskavator, sapi potong, batubara, batik, dan logistik eks pemilu
-- yang semuanya ber-`kategori = 'RUMAH'`.
--
-- Gerbang kategori di mesin pencocokan (src/lib/klienMatch.ts) bekerja dengan
-- benar; yang bohong datanya. Hasilnya: agent membuka "cari aset" untuk klien
-- yang mencari rumah ≤ 250 jt di Gresik, dan menerima lelang sepeda motor.
--
-- ── ATURAN, DAN KENAPA LUAS YANG JADI HAKIMNYA ────────────────────────────
-- Godaan pertama adalah mencocokkan judul: buang apa pun yang mengandung
-- "barang bergerak". Itu SALAH, dan datanya membuktikan: ada 660 baris yang
-- cocok dengan pola semacam itu, dan di antaranya
--
--     "3 bidang tanah dengan total luas 174460 m2 berikut bangunan
--      dan barang bergerak"
--
-- — pabrik seluas 17 hektar yang dijual berikut isinya. Aturan berbasis kata
-- akan membuang aset paling bernilai di seluruh basis data ini.
--
-- Maka LUAS yang jadi hakimnya, bukan kata-katanya:
--
--   1. Punya luas tanah ATAU luas bangunan  → PROPERTI. Titik.
--      Ini mendahului segalanya, dan itulah yang menyelamatkan pabrik di atas.
--   2. Tidak punya luas sama sekali, dan LELANG → BUKAN properti.
--      Lot properti dari lelang.go.id SELALU membawa luasnya. Sampel acak atas
--      1.327 baris yang tertangkap aturan ini berisi sapi potong, batubara,
--      inventaris kantor rusak, hak piutang, dan mobil — plus segelintir
--      bangunan ber-luas 0 yang datanya memang tidak bisa dipakai. Keduanya
--      sama-sama tidak layak direkomendasikan.
--   3. Tidak punya luas, BUKAN lelang → hanya dibuang bila judulnya memang
--      menyebut barang bergerak. Listing yang diinput agent sendiri (kos,
--      apartemen sewa) sering dibiarkan tanpa luas, dan tidak boleh ikut
--      tersapu hanya karena kolomnya kosong.
--
-- ── KENAPA TRIGGER, BUKAN DIHITUNG SAAT QUERY ─────────────────────────────
-- Ada tiga jalur yang menulis ke tabel ini: scraper lelang, form tambah
-- properti, dan form edit. Menaruh aturannya di aplikasi berarti menaruhnya di
-- tiga tempat, dan yang ketiga akan lupa. Trigger membuat kolomnya benar
-- apa pun yang menulis — termasuk perbaikan manual lewat psql.
--
-- Jalankan manual (konvensi proyek ini — tidak memakai prisma migrate):
--   psql "$DATABASE_URL" -f prisma/migration_listing_bukan_properti.sql
-- Aman diulang.
-- ===========================================================================

BEGIN;

ALTER TABLE listing
  ADD COLUMN IF NOT EXISTS bukan_properti BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN listing.bukan_properti IS
  'TRUE = lot ini bukan properti (kendaraan, mesin, barang bergerak, hewan, '
  'komoditas) atau datanya tidak layak direkomendasikan. Diisi trigger '
  'trg_listing_bukan_properti — jangan diisi manual dari aplikasi.';

-- Pola barang bergerak. HANYA dipakai untuk baris tanpa luas yang bukan
-- lelang; lihat urutan aturan di fungsi di bawah.
CREATE OR REPLACE FUNCTION listing_hitung_bukan_properti(
  p_luas_tanah    NUMERIC,
  p_luas_bangunan NUMERIC,
  p_jenis         TEXT,
  p_judul         TEXT
) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    -- 1. Ada luas → properti, apa pun bunyi judulnya.
    WHEN COALESCE(p_luas_tanah, 0) > 0 OR COALESCE(p_luas_bangunan, 0) > 0
      THEN FALSE
    -- 2. Lot lelang tanpa luas → tidak layak direkomendasikan.
    WHEN p_jenis = 'LELANG'
      THEN TRUE
    -- 3. Sisanya: hanya bila judulnya memang menyebut barang bergerak.
    ELSE COALESCE(p_judul, '') ~* (
      'sepeda motor|kendaraan bermotor|unit mobil|excavator|forklift|genset|'
      || 'alat berat|barang bergerak|barang inventaris|inventaris kantor|'
      || 'peralatan dan mesin|hak piutang|batubara|scrap|besi tua'
    )
  END;
$$;

CREATE OR REPLACE FUNCTION trg_listing_bukan_properti() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.bukan_properti := listing_hitung_bukan_properti(
    NEW.luas_tanah, NEW.luas_bangunan, NEW.jenis_transaksi::text, NEW.judul
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listing_bukan_properti_biu ON listing;
CREATE TRIGGER listing_bukan_properti_biu
  BEFORE INSERT OR UPDATE OF luas_tanah, luas_bangunan, jenis_transaksi, judul
  ON listing
  FOR EACH ROW EXECUTE FUNCTION trg_listing_bukan_properti();

-- Backfill baris yang sudah ada.
UPDATE listing
   SET bukan_properti = listing_hitung_bukan_properti(
         luas_tanah, luas_bangunan, jenis_transaksi::text, judul)
 WHERE bukan_properti IS DISTINCT FROM listing_hitung_bukan_properti(
         luas_tanah, luas_bangunan, jenis_transaksi::text, judul);

COMMIT;

-- Sengaja TANPA index parsial. Prisma tidak pernah memakainya (lihat catatan
-- di migration listing sort), dan penyaring ini hanya membuang ~1,2% baris
-- SESUDAH index kategori/jenis_transaksi bekerja — Postgres menyaringnya saat
-- itu juga tanpa biaya berarti.

-- prisma/migration_listing_pembersihan.sql
-- ===========================================================================
-- KOTAK HITAM PEMBERSIHAN LISTING
--
-- KENAPA ADA. Fitur "Bersihkan Data" di /dashboard/listings menghapus baris
-- listing SUNGGUHAN (DELETE, bukan status). Itu keputusan yang benar untuk lot
-- sepeda motor dan sapi potong yang tidak akan pernah jadi properti — tapi
-- DELETE tidak punya tombol batal, dan yang menekannya sedang menyapu ribuan
-- baris sekaligus. Satu pola yang keliru berarti persediaan asli ikut lenyap
-- tanpa jejak.
--
-- Maka setiap baris yang dihapus DISALIN UTUH ke sini lebih dulu, dalam satu
-- transaksi dengan DELETE-nya. Kolom `data` berisi `to_jsonb(listing)` — SELURUH
-- baris apa adanya, termasuk kolom yang belum ada waktu berkas ini ditulis.
-- Sengaja JSONB dan bukan tabel kembar berkolom: tabel kembar harus ikut
-- diubah setiap kali `listing` bertambah kolom, dan yang pertama kali lupa
-- diubah adalah tabel arsip yang tidak pernah dibaca siapa pun.
--
-- Kolom di luar `data` (judul, kota, harga, aturan, pelaku) ada supaya arsipnya
-- bisa DIBACA dan DICARI tanpa membongkar JSON — "apa saja yang dihapus Owner
-- kemarin?" harus bisa dijawab dengan satu SELECT biasa.
--
-- TIDAK ada foreign key ke `listing`: barisnya justru ada karena listing-nya
-- sudah tiada.
--
-- ── MEMULIHKAN SATU BARIS ─────────────────────────────────────────────────
-- Anak-anak barisnya (foto sekitar, riwayat status, dst) sudah ikut terhapus
-- lewat ON DELETE CASCADE dan TIDAK ikut dipulihkan — yang kembali adalah
-- listing-nya sendiri, dengan id_property yang sama:
--
--   INSERT INTO listing
--   SELECT (jsonb_populate_record(NULL::listing, data)).*
--     FROM listing_dibersihkan WHERE id_property = 12345;
--
-- (Bentuk ini sudah diuji: arsip → DELETE → pulihkan, barisnya kembali utuh
--  dengan id_property yang sama.)
--
-- (Kolom turunan `harga_efektif` / `bukan_properti` / `ada_bangunan` akan
--  dihitung ulang trigger masing-masing saat INSERT — biarkan.)
--
-- Jalankan manual (konvensi proyek ini — tidak memakai prisma migrate):
--   npx prisma db execute --file prisma/migration_listing_pembersihan.sql --schema prisma/schema.prisma
-- Aman diulang.
-- ===========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS listing_dibersihkan (
  id              BIGSERIAL    PRIMARY KEY,
  id_property     BIGINT       NOT NULL,
  judul           VARCHAR(255),
  jenis_transaksi VARCHAR(20),
  kategori        VARCHAR(30),
  kota            VARCHAR(355),
  harga           NUMERIC(20,2),
  id_agent        VARCHAR(20),
  -- Aturan yang menangkapnya, atau 'MANUAL' bila Owner memilihnya sendiri
  -- lewat pencarian. Ini yang membuat arsipnya bisa dievaluasi: kalau suatu
  -- aturan ternyata terlalu rakus, semua korbannya bisa ditemukan sekaligus.
  aturan          VARCHAR(40)  NOT NULL,
  alasan          TEXT,
  dihapus_oleh    VARCHAR(20),
  -- Nama saat kejadian, bukan lewat relasi: nama bisa berubah, dan baris audit
  -- harus tetap terbaca sendirian bertahun-tahun kemudian.
  nama_pelaku     VARCHAR(255),
  dihapus_pada    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  data            JSONB        NOT NULL
);

COMMENT ON TABLE listing_dibersihkan IS
  'Arsip baris listing yang dihapus fitur Pembersihan Data (Owner). Kolom data '
  'berisi to_jsonb(listing) — baris utuh, bisa dipulihkan dengan '
  'jsonb_populate_record. Lihat prisma/migration_listing_pembersihan.sql.';

CREATE INDEX IF NOT EXISTS idx_listing_dibersihkan_waktu
  ON listing_dibersihkan (dihapus_pada DESC);
CREATE INDEX IF NOT EXISTS idx_listing_dibersihkan_property
  ON listing_dibersihkan (id_property);
CREATE INDEX IF NOT EXISTS idx_listing_dibersihkan_aturan
  ON listing_dibersihkan (aturan);

COMMIT;

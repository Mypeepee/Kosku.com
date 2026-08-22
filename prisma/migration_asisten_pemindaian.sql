-- prisma/migration_asisten_pemindaian.sql
-- ===========================================================================
-- PEMINDAIAN ASISTEN: TANDA AIR & PREFERENSI YANG BELUM PERNAH DIPINDAI
--
-- Menutup dua lubang yang keduanya berupa KEHILANGAN DIAM — tidak ada galat,
-- tidak ada log, hanya kabar yang tidak pernah sampai.
--
-- ── 1. cron_watermark: jendela geser kehilangan kejadian ──────────────────
-- Pemindai lama mencari listing dengan `tanggal_dibuat >= now() - 26 jam`.
-- Selama cron-nya hidup terus, itu bekerja. Begitu prosesnya mati tiga jam
-- (deploy, restart cPanel, galat SMTP yang menggagalkan seluruh putaran),
-- listing yang masuk di jam-jam itu akan berada DI LUAR jendela pada putaran
-- berikutnya — dan tidak akan pernah masuk jendela mana pun lagi. Hilang
-- selamanya, tanpa satu baris log pun.
--
-- Tanda air menyimpan "sampai mana yang sudah benar-benar diproses", dan MAJU
-- HANYA setelah putaran berhasil. Proses yang mati tiga jam akan mengejar
-- ketinggalannya sendiri di putaran berikutnya.
--
-- ── 2. preferensi_klien.terakhir_dipindai ─────────────────────────────────
-- Pemindai lama hanya melihat listing BARU. Konsekuensinya tidak terlihat
-- sampai dipikirkan: klien yang preferensinya baru dibuat hari ini TIDAK akan
-- pernah dikabari soal 100 aset cocok yang sudah lama ada di database — karena
-- seratus aset itu tidak baru. Agent baru mengetahuinya kalau ia kebetulan
-- membuka CRM.
--
-- NULL = kriteria ini belum pernah diadu dengan persediaan yang sudah ada.
-- Pemindai menjalankan pencocokan penuh sekali, mengabarkannya, lalu mengisi
-- kolom ini. Sesudah itu kriteria tersebut ikut jalur "aset baru" biasa.
--
-- Jalankan manual (konvensi proyek ini — tidak memakai prisma migrate):
--   psql "$DATABASE_URL" -f prisma/migration_asisten_pemindaian.sql
-- Aman diulang.
-- ===========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS cron_watermark (
  kunci           VARCHAR(64) PRIMARY KEY,
  -- Sampai kapan yang sudah diproses. Pemindaian berikutnya mengambil yang
  -- LEBIH BARU dari ini.
  waktu           TIMESTAMPTZ NOT NULL,
  -- Pemecah seri: dua listing bisa punya cap waktu yang sama persis (impor
  -- borongan menulis ratusan baris dalam satu detik). Tanpa id, batas ">
  -- waktu" akan melewatkan sebagian di antaranya atau memprosesnya dua kali.
  id_terakhir     BIGINT,
  diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
  catatan         TEXT
);

COMMENT ON TABLE cron_watermark IS
  'Sampai mana tiap pemindai latar sudah benar-benar memproses. Maju HANYA '
  'setelah putaran berhasil, supaya proses yang sempat mati mengejar '
  'ketinggalannya sendiri alih-alih kehilangan kejadian di celahnya.';

ALTER TABLE preferensi_klien
  ADD COLUMN IF NOT EXISTS terakhir_dipindai TIMESTAMPTZ;

COMMENT ON COLUMN preferensi_klien.terakhir_dipindai IS
  'NULL = kriteria ini belum pernah diadu dengan persediaan yang SUDAH ADA. '
  'Pemindai menjalankan pencocokan penuh sekali, mengabari agent, lalu '
  'mengisi kolom ini. Tanpa kolom ini, klien baru tidak pernah dikabari soal '
  'aset lama yang cocok — karena aset itu tidak baru.';

-- Kriteria yang menunggu pemindaian pertama selalu sedikit; index parsial di
-- sini TIDAK sia-sia karena query-nya ditulis lewat $queryRaw, bukan Prisma
-- (Prisma tidak memakai index parsial — lihat catatan di migrasi listing sort).
CREATE INDEX IF NOT EXISTS idx_preferensi_belum_dipindai
  ON preferensi_klien (id_preferensi)
  WHERE terakhir_dipindai IS NULL;

-- Titik awal tanda air: SEKARANG. Disetel di sini, bukan dibiarkan kosong,
-- supaya pemasangan pertama tidak memperlakukan seluruh 120 ribu listing lama
-- sebagai "baru" dan mengirimi setiap agent email raksasa berisi aset yang
-- sudah mereka kenal bertahun-tahun.
-- DUA tanda air, bukan satu. Pemindai menangkap dua hal berbeda — listing yang
-- baru DIBUAT dan listing lama yang baru BERUBAH (harganya turun ke dalam
-- anggaran klien) — dan menggabungkannya jadi satu tanda air merusak keduanya:
-- di tabel ini ada 4.624 baris yang dibuat tahun lalu tapi baru di-update
-- kemarin, dan satu putaran berisi baris seperti itu akan memajukan tanda air
-- ke TAHUN LALU. Mundur. Putaran berikutnya menganggap seluruh 120 ribu listing
-- belum diproses, dan setiap agent menerima email raksasa berisi aset yang
-- sudah lama mereka kenal — berulang, karena keadaannya tidak pernah membaik.
INSERT INTO cron_watermark (kunci, waktu, catatan) VALUES
  ('asisten:aset_baru', now(), 'listing baru dibuat — disetel saat migrasi dipasang'),
  ('asisten:aset_ubah', now(), 'listing lama berubah — disetel saat migrasi dipasang')
ON CONFLICT (kunci) DO NOTHING;

COMMIT;

-- ===========================================================================
-- PILIHAN SAAT MEMASANG DI LINGKUNGAN YANG SUDAH BERJALAN
--
-- Seluruh preferensi yang sudah ada akan ber-`terakhir_dipindai IS NULL`,
-- jadi putaran cron berikutnya akan mengadu SEMUANYA dengan persediaan yang
-- ada dan mengabari agent-nya. Itu memang perilaku yang diinginkan — "inilah
-- yang sudah tersedia untuk klien Anda" — dan penyebarannya sudah direm
-- sendiri: 40 kriteria per putaran, satu email per agent per 6 jam.
--
-- Kalau Anda TIDAK ingin gelombang pertama itu (mis. memasang di produksi pada
-- jam sibuk), jalankan baris di bawah SEKALI sesudah migrasi. Sesudah itu
-- hanya kriteria yang BENAR-BENAR baru yang akan di-backfill:
--
--   UPDATE preferensi_klien SET terakhir_dipindai = now()
--    WHERE terakhir_dipindai IS NULL;
--
-- Tidak bisa dibatalkan: kriteria yang ditandai sudah dipindai tidak akan
-- pernah diadu dengan persediaan lama lagi.
-- ===========================================================================

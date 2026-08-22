-- ===========================================================================
-- ASISTEN PREFERENSI KLIEN — migrasi manual
-- ---------------------------------------------------------------------------
-- Jalankan SEKALI per environment (staging lalu produksi):
--   psql "$DATABASE_URL" -f prisma/migration_rekomendasi_klien.sql
--
-- Seluruh berkas ini idempoten: aman dijalankan ulang kalau terputus di
-- tengah. Tidak ada satu pun DROP terhadap data yang sudah ada.
--
-- Yang dibangun:
--   1. `maksud` pada preferensi_klien  — BELI vs SEWA, ditegakkan CHECK
--   2. kiriman_rekomendasi             — buku catatan aset yang sudah dikirim
--   3. perubahan_kiriman               — antrean kabar perubahan harga/status
--   4. tugas.id_klien + tugas.kunci_otomatis — sandaran follow-up otomatis
--   5. dua nilai baru pada tipe_notifikasi_enum
-- ===========================================================================

BEGIN;

-- ── 1. MAKSUD: BELI atau SEWA ──────────────────────────────────────────────
-- Preferensi menyimpan `jenis_transaksi` yang BOLEH kosong ("rumah di Gresik,
-- maks 500 jt" tanpa menyebut primary/secondary). Mesin pencocokan tetap harus
-- tahu ini orang mau BELI atau SEWA: satu rumah yang sama bisa terdaftar
-- sebagai dua listing berbeda, dan mengirim listing sewa kepada orang yang mau
-- beli adalah kesalahan yang langsung terlihat bodoh di mata klien.
-- Namanya `maksud_preferensi_enum`, bukan `maksud_klien_enum`. Tipe ini SUDAH
-- ADA di database sebagai sisa upaya terdahulu yang kodenya hilang, dan
-- kolom preferensi_klien.maksud sudah memakainya berikut datanya. Membuat
-- enum kedua dengan nilai identik berarti dua sumber kebenaran untuk satu
-- konsep — dan salah satunya pasti akan ketinggalan saat nilainya bertambah.
DO $$ BEGIN
  CREATE TYPE maksud_preferensi_enum AS ENUM ('BELI', 'SEWA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE preferensi_klien ADD COLUMN IF NOT EXISTS maksud maksud_preferensi_enum;

-- Backfill. KOS ikut SEWA tanpa syarat: kategori itu memang hanya pernah ada
-- sebagai sewa (lihat guard di form & API add-property).
UPDATE preferensi_klien SET maksud = CASE
  WHEN jenis_transaksi = 'SEWA' THEN 'SEWA'::maksud_preferensi_enum
  WHEN tipe_properti   = 'KOS'  THEN 'SEWA'::maksud_preferensi_enum
  ELSE 'BELI'::maksud_preferensi_enum
END
WHERE maksud IS NULL;

ALTER TABLE preferensi_klien ALTER COLUMN maksud SET DEFAULT 'BELI';
ALTER TABLE preferensi_klien ALTER COLUMN maksud SET NOT NULL;

-- Aturan "kalau sewa ya sewa saja" ditegakkan di DATABASE, bukan cuma di
-- aplikasi. Satu form yang lupa memvalidasi, satu skrip impor, atau satu
-- perbaikan data lewat psql sudah cukup untuk menyelundupkan preferensi
-- SEWA yang jenis transaksinya LELANG — dan mesin pencocokan akan patuh
-- mengirimkannya. Constraint ini membuat baris seperti itu mustahil ada.
ALTER TABLE preferensi_klien DROP CONSTRAINT IF EXISTS preferensi_maksud_selaras;
ALTER TABLE preferensi_klien ADD CONSTRAINT preferensi_maksud_selaras CHECK (
  (maksud = 'SEWA' AND (jenis_transaksi IS NULL OR jenis_transaksi = 'SEWA')) OR
  (maksud = 'BELI' AND (jenis_transaksi IS NULL OR jenis_transaksi <> 'SEWA'))
);

-- ── 2. BUKU KIRIMAN ────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE tanggapan_kiriman_enum AS ENUM
    ('MENUNGGU', 'SUKA', 'TIDAK_COCOK', 'MINTA_SURVEI', 'DEAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS kiriman_rekomendasi (
  id_kiriman    BIGSERIAL PRIMARY KEY,
  id_klien      VARCHAR(20) NOT NULL,
  id_property   BIGINT      NOT NULL,
  id_agent      VARCHAR(20) NOT NULL,
  -- Preferensi yang MELAHIRKAN kiriman ini. Boleh yatim: preferensi sering
  -- dihapus/diganti saat kriteria klien berubah, sementara fakta "aset ini
  -- pernah dikirim" tidak boleh ikut hilang — itulah satu-satunya hal yang
  -- mencegah aset yang sama dikirim dua kali.
  id_preferensi BIGINT,
  kanal         VARCHAR(20) NOT NULL DEFAULT 'WHATSAPP',

  -- SNAPSHOT saat dikirim. Inilah dasar seluruh deteksi perubahan: tanpa
  -- menyimpan harga pada detik pengiriman, "harganya turun" tidak punya titik
  -- pembanding dan sistem cuma bisa menebak.
  harga_saat_kirim  NUMERIC(20,2)        NOT NULL,
  status_saat_kirim status_properti_enum NOT NULL,

  -- Harga yang TERAKHIR DIKETAHUI KLIEN. Berbeda dari harga_saat_kirim:
  -- kolom ini ikut bergerak setiap kali agent meneruskan kabar perubahan.
  -- Tanpa pemisahan ini, satu aset yang turun harga tiga kali akan terus
  -- dilaporkan sebagai "turun dari harga pertama" selamanya.
  harga_diketahui   NUMERIC(20,2)        NOT NULL,

  jumlah_kirim     INTEGER     NOT NULL DEFAULT 1,
  pertama_dikirim  TIMESTAMPTZ NOT NULL DEFAULT now(),
  terakhir_dikirim TIMESTAMPTZ NOT NULL DEFAULT now(),

  tanggapan        tanggapan_kiriman_enum NOT NULL DEFAULT 'MENUNGGU',
  tanggapan_pada   TIMESTAMPTZ,
  alasan_tanggapan TEXT,

  CONSTRAINT kiriman_klien_fk    FOREIGN KEY (id_klien)      REFERENCES klien(id_klien)                      ON DELETE CASCADE,
  CONSTRAINT kiriman_listing_fk  FOREIGN KEY (id_property)   REFERENCES listing(id_property)                 ON DELETE CASCADE,
  CONSTRAINT kiriman_agent_fk    FOREIGN KEY (id_agent)      REFERENCES agent(id_agent)                      ON DELETE CASCADE,
  CONSTRAINT kiriman_pref_fk     FOREIGN KEY (id_preferensi) REFERENCES preferensi_klien(id_preferensi)      ON DELETE SET NULL,

  -- ANTI-DOBEL, ditegakkan database. Aturan "jangan kirim aset yang sama dua
  -- kali" yang hanya dijaga aplikasi akan bocor pada klik ganda, pada dua tab
  -- terbuka, dan pada dua agent yang memegang klien sama. Di sini bocornya
  -- mustahil: baris keduanya ditolak Postgres.
  CONSTRAINT kiriman_unik UNIQUE (id_klien, id_property)
);

CREATE INDEX IF NOT EXISTS idx_kiriman_klien   ON kiriman_rekomendasi (id_klien, terakhir_dikirim DESC);
CREATE INDEX IF NOT EXISTS idx_kiriman_agent   ON kiriman_rekomendasi (id_agent, terakhir_dikirim DESC);
CREATE INDEX IF NOT EXISTS idx_kiriman_listing ON kiriman_rekomendasi (id_property);

-- Index parsial untuk si pengawas perubahan. Ia memindai HANYA kiriman yang
-- masih layak dipantau: aset yang sudah ditolak klien tidak perlu diawasi
-- harganya sampai kiamat. Di kantor dengan puluhan ribu kiriman, ini beda
-- antara pemindaian penuh tiap 15 menit dan pemindaian yang nyaris gratis.
CREATE INDEX IF NOT EXISTS idx_kiriman_dipantau
  ON kiriman_rekomendasi (id_property)
  WHERE tanggapan <> 'TIDAK_COCOK';

-- ── 3. ANTREAN KABAR PERUBAHAN ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE jenis_perubahan_kiriman_enum AS ENUM
    ('HARGA_TURUN', 'HARGA_NAIK', 'TERJUAL', 'DITARIK', 'LELANG_DEKAT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS perubahan_kiriman (
  id              BIGSERIAL PRIMARY KEY,
  id_kiriman      BIGINT NOT NULL,
  jenis           jenis_perubahan_kiriman_enum NOT NULL,
  harga_lama      NUMERIC(20,2),
  harga_baru      NUMERIC(20,2),
  selisih_persen  NUMERIC(7,2),
  terdeteksi_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Agent SUDAH meneruskan kabar ini ke klien.
  diteruskan_pada TIMESTAMPTZ,
  -- Agent memutuskan kabar ini tidak layak diteruskan (mis. naik 1%).
  -- Dipisahkan dari diteruskan_pada supaya bisa dibedakan "sudah dikerjakan"
  -- dari "sengaja dilewati" — dua hal yang artinya jauh berbeda saat menilai
  -- apakah asistennya membantu atau malah berisik.
  diabaikan_pada  TIMESTAMPTZ,

  CONSTRAINT perubahan_kiriman_fk FOREIGN KEY (id_kiriman)
    REFERENCES kiriman_rekomendasi(id_kiriman) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_perubahan_kiriman ON perubahan_kiriman (id_kiriman, terdeteksi_pada DESC);

-- Antrean kerja: perubahan yang belum diapa-apakan. Inilah yang dibaca
-- dashboard dan pembuat tugas otomatis, jadi ia harus murah.
CREATE INDEX IF NOT EXISTS idx_perubahan_tertunda
  ON perubahan_kiriman (terdeteksi_pada DESC)
  WHERE diteruskan_pada IS NULL AND diabaikan_pada IS NULL;

-- ── 4. TUGAS: sandaran klien + kunci anti-dobel ────────────────────────────
ALTER TABLE tugas ADD COLUMN IF NOT EXISTS id_klien VARCHAR(20);
DO $$ BEGIN
  ALTER TABLE tugas ADD CONSTRAINT tugas_klien_fk
    FOREIGN KEY (id_klien) REFERENCES klien(id_klien) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_tugas_klien ON tugas (id_klien) WHERE id_klien IS NOT NULL;

-- KUNCI ANTI-DOBEL untuk tugas yang dibuat mesin.
-- Cron berjalan tiap 15 menit. Tanpa kunci ini, klien yang sepi 14 hari akan
-- memperoleh 96 tugas identik per hari dan halaman Tugas berubah jadi tempat
-- sampah — cara paling cepat membuat agent berhenti mempercayai asistennya.
-- Kuncinya memuat TANGGAL, jadi "sepi" boleh muncul lagi besok, sekali.
-- Ditegakkan sebagai index unik parsial: tugas manual (kunci NULL) tidak
-- pernah tersentuh aturan ini.
ALTER TABLE tugas ADD COLUMN IF NOT EXISTS kunci_otomatis VARCHAR(160);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tugas_kunci_otomatis
  ON tugas (kunci_otomatis) WHERE kunci_otomatis IS NOT NULL;

COMMIT;

-- ── 5. NOTIFIKASI ──────────────────────────────────────────────────────────
-- DI LUAR transaksi dengan sengaja. `ALTER TYPE ... ADD VALUE` ditolak
-- Postgres bila dijalankan di dalam blok transaksi pada versi < 12, dan pada
-- versi mana pun nilai barunya tidak boleh dipakai di transaksi yang sama.
-- Keduanya idempoten, jadi aman kalau berkas ini dijalankan ulang.
ALTER TYPE tipe_notifikasi_enum ADD VALUE IF NOT EXISTS 'REKOMENDASI_ASET';
ALTER TYPE tipe_notifikasi_enum ADD VALUE IF NOT EXISTS 'PERUBAHAN_ASET';

-- ── VERIFIKASI CEPAT ───────────────────────────────────────────────────────
-- SELECT maksud, count(*) FROM preferensi_klien GROUP BY 1;
-- \d kiriman_rekomendasi
-- \d perubahan_kiriman

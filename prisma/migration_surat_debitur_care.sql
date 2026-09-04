-- prisma/migration_surat_debitur_care.sql
-- ===========================================================================
-- REGISTER NOMOR SURAT DEBITUR CARE
--
-- KENAPA ADA. Surat "Debitur Care" (Surat Kuasa + Perjanjian Jasa Hukum)
-- bernomor NNN/PJH-[inisial]/[romawi bulan]/[tahun]. Nomor itu tidak boleh
-- ditulis tangan di form: dua orang yang menggenerate surat di menit yang sama
-- akan memilih angka yang sama, dan dua perjanjian bernomor kembar adalah
-- masalah hukum, bukan masalah tampilan. Maka nomornya DIPESAN oleh server —
-- baris di tabel ini yang menentukan urutan, bukan sebaliknya.
--
-- KENAPA SELURUH ISI SURAT IKUT DISIMPAN. Nomor tanpa isi hanya membuktikan
-- bahwa surat pernah dibuat, bukan APA yang dibuat. Kolom-kolom di bawah
-- adalah snapshot hasil pembacaan KTP persis seperti yang tercetak di PDF;
-- kalau kelak fotonya hilang atau debiturnya membantah isinya, yang tersisa
-- di sini sudah cukup untuk menjawab.
--
-- KUNCI KEUNIKAN. `(tahun, bulan, nomor_urut)` unik: urutan di-reset tiap
-- ganti bulan. Route pembuat surat memakai kunci ini sebagai penjaga balapan —
-- ia menghitung urut berikutnya lalu mencoba INSERT; kalau tabrakan (23505)
-- ia menghitung ulang dan mencoba lagi. Itu sebabnya keunikannya HARUS ada di
-- basis data, bukan cuma di kode: pemeriksaan di aplikasi tidak menghentikan
-- dua proses Node yang berjalan bersamaan.
--
-- `nomor` juga unik tersendiri sebagai jaring kedua — dua bulan berbeda tidak
-- akan pernah menghasilkan string nomor yang sama, tapi kalau format nomornya
-- kelak diubah, kunci ini yang lebih dulu berteriak.
--
-- AMAN DIJALANKAN ULANG. Semuanya IF NOT EXISTS.
-- Jalankan sekali per environment (lokal, staging, produksi):
--
--   npm run db:surat-debitur-care
--
-- Pakai skrip itu, JANGAN psql langsung. `DATABASE_URL` proyek ini berakhiran
-- `?schema=public`, dan psql menolaknya dengan "invalid URI query parameter:
-- schema" — parameter itu milik Prisma, bukan libpq. `prisma db execute` yang
-- dipanggil skrip tersebut memahaminya. Kalau memang harus lewat psql, buang
-- dulu bagian `?schema=...` dari URL-nya.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS surat_debitur_care (
  id                    BIGSERIAL PRIMARY KEY,
  nomor                 VARCHAR(60)  NOT NULL,
  nomor_urut            INTEGER      NOT NULL,
  inisial               VARCHAR(10)  NOT NULL,
  bulan                 INTEGER      NOT NULL,
  tahun                 INTEGER      NOT NULL,

  tanggal_surat         DATE         NOT NULL,

  -- ── Debitur (PIHAK KESATU / PEMBERI KUASA), hasil scan KTP ──
  nama                  VARCHAR(200) NOT NULL,
  nik                   VARCHAR(20),
  tempat_lahir          VARCHAR(100),
  tanggal_lahir         VARCHAR(30),
  tempat_tanggal_lahir  VARCHAR(140),
  jenis_kelamin         VARCHAR(20),
  gol_darah             VARCHAR(5),
  agama                 VARCHAR(40),
  status_kawin          VARCHAR(40),
  pekerjaan             VARCHAR(120),
  warga_negara          VARCHAR(50),

  -- ── Alamat lengkap sampai provinsi ──
  alamat                TEXT,
  rt_rw                 VARCHAR(20),
  kelurahan             VARCHAR(100),
  kecamatan             VARCHAR(100),
  kota                  VARCHAR(100),
  jenis_kota            VARCHAR(20),
  provinsi              VARCHAR(100),
  alamat_lengkap        TEXT,

  -- ── Objek yang dikosongkan ──
  jenis_sertifikat      VARCHAR(120),
  nomor_sertifikat      VARCHAR(120),

  -- ── Jejak pembacaan KTP ──
  -- 'gabungan' = model penglihatan + OCR sepakat, 'vision' = model tidak
  -- tersedia saat itu. Berguna untuk menemukan surat mana yang lahir dari
  -- pembacaan paling lemah kalau kelak ada yang janggal.
  sumber_ocr            VARCHAR(20),
  skor_ocr              INTEGER,

  id_agent              VARCHAR(20),

  dibuat_pada           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  diperbarui_pada       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Penjaga balapan yang sebenarnya. Tanpa ini, dua request bersamaan sama-sama
-- membaca "urut terakhir = 7" lalu sama-sama menulis 8.
CREATE UNIQUE INDEX IF NOT EXISTS sdc_periode_urut_unique
  ON surat_debitur_care (tahun, bulan, nomor_urut);

CREATE UNIQUE INDEX IF NOT EXISTS surat_debitur_care_nomor_key
  ON surat_debitur_care (nomor);

-- Daftar surat selalu dibuka per periode ("surat bulan ini"), dan dicari lewat
-- nama atau NIK debitur ketika seseorang menelepon menanyakan perkaranya.
CREATE INDEX IF NOT EXISTS idx_sdc_periode ON surat_debitur_care (tahun, bulan);
CREATE INDEX IF NOT EXISTS idx_sdc_nama    ON surat_debitur_care (nama);
CREATE INDEX IF NOT EXISTS idx_sdc_nik     ON surat_debitur_care (nik);

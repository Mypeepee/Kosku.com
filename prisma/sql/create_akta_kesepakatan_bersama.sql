-- Tabel register + arsip Akta Kesepakatan Bersama.
-- Aditif & idempoten (IF NOT EXISTS) — aman dijalankan ulang, tidak menyentuh
-- tabel lain. Nama constraint/index disamakan dengan konvensi Prisma agar
-- `prisma db push` di kemudian hari tidak menganggapnya drift.

CREATE TABLE IF NOT EXISTS akta_kesepakatan_bersama (
  id                    BIGSERIAL      PRIMARY KEY,
  nomor                 VARCHAR(60)    NOT NULL,
  nomor_urut            INTEGER        NOT NULL,
  bulan                 INTEGER        NOT NULL,
  tahun                 INTEGER        NOT NULL,

  tanggal_akta          DATE           NOT NULL,
  pukul                 VARCHAR(10),

  -- Pihak Pertama (OCR KTP)
  p1_nama               VARCHAR(200)   NOT NULL,
  p1_nik                VARCHAR(20),
  p1_tempat_lahir       VARCHAR(100),
  p1_tgl_lahir          VARCHAR(30),
  p1_warga_negara       VARCHAR(50),
  p1_pekerjaan          VARCHAR(100),
  p1_alamat             TEXT,

  -- Pihak Kedua (OCR KTP)
  p2_nama               VARCHAR(200)   NOT NULL,
  p2_nik                VARCHAR(20),
  p2_tempat_lahir       VARCHAR(100),
  p2_tgl_lahir          VARCHAR(30),
  p2_warga_negara       VARCHAR(50),
  p2_pekerjaan          VARCHAR(100),
  p2_alamat             TEXT,

  -- Risalah lelang & objek
  risalah_nomor         VARCHAR(100),
  risalah_tanggal       VARCHAR(30),
  kantor_lelang         VARCHAR(200),
  jenis_hak             VARCHAR(100),
  nib                   VARCHAR(100),
  luas                  VARCHAR(50),
  alamat_obyek          TEXT,
  alamat_obyek_lengkap  TEXT,
  obyek_provinsi        VARCHAR(100),
  obyek_kabupaten       VARCHAR(100),
  obyek_kecamatan       VARCHAR(100),
  obyek_kelurahan       VARCHAR(100),

  -- Nominal eksekusi / kompensasi
  kompensasi_total      DECIMAL(20,2)  NOT NULL DEFAULT 0,
  tahap1_jumlah         DECIMAL(20,2)  NOT NULL DEFAULT 0,
  tahap2_jumlah         DECIMAL(20,2)  NOT NULL DEFAULT 0,
  tahap1_tanggal        DATE,
  batas_tanggal         DATE,

  -- Meta penandatanganan
  pengadilan            VARCHAR(200),
  kota_ttd              VARCHAR(100),
  tanggal_ttd           DATE,
  id_agent              VARCHAR(20),

  dibuat_pada           TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  diperbarui_pada       TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS akta_kesepakatan_bersama_nomor_key
  ON akta_kesepakatan_bersama (nomor);

CREATE UNIQUE INDEX IF NOT EXISTS akb_periode_urut_unique
  ON akta_kesepakatan_bersama (tahun, bulan, nomor_urut);

CREATE INDEX IF NOT EXISTS idx_akb_periode
  ON akta_kesepakatan_bersama (tahun, bulan);

CREATE INDEX IF NOT EXISTS idx_akb_p2_nama
  ON akta_kesepakatan_bersama (p2_nama);

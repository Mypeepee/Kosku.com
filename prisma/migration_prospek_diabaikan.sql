-- ===========================================================================
-- NISAN PROSPEK — migrasi manual
-- ---------------------------------------------------------------------------
--   psql "$DATABASE_URL" -f prisma/migration_prospek_diabaikan.sql
--
-- MASALAH YANG DIPERBAIKI. Sinkron prospek membandingkan sumber (Lead, Titip
-- Jual, Penawaran, Site Visit) dengan klien yang SEDANG ADA. Menghapus seorang
-- klien tidak menghapus sumbernya, jadi putaran sinkron berikutnya mengimpornya
-- kembali — dan karena sinkron berjalan otomatis, penghapusan itu terlihat
-- membatalkan dirinya sendiri beberapa detik kemudian.
--
-- KENAPA BUKAN SEKADAR DAFTAR HITAM. Nisan menyimpan WAKTU. Sinkron hanya
-- melewati kandidat yang aktivitas sumbernya lebih tua dari nisannya. Kalau
-- orang yang sama menghubungi lagi besok, lead barunya lebih muda dari nisan
-- dan ia masuk kembali sebagaimana mestinya. Daftar hitam tanpa waktu akan
-- memblokir nomor itu selamanya — dan calon pembeli yang datang kembali adalah
-- hal terakhir yang boleh dibuang diam-diam oleh sebuah CRM.
-- ===========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS prospek_diabaikan (
  id             BIGSERIAL   PRIMARY KEY,
  id_agent       VARCHAR(20) NOT NULL,
  -- Nomor ternormalisasi (62xxx) ATAU "lead:<id>". Lihat src/lib/prospek.ts —
  -- bentuknya HARUS sama dengan yang dipakai sinkron, kalau tidak nisannya
  -- tidak pernah cocok dengan kandidatnya.
  kunci          VARCHAR(64) NOT NULL,
  diabaikan_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Jejak untuk menjelaskan asal-usulnya saat menelusuri data.
  nama_terakhir  VARCHAR(150),

  CONSTRAINT prospek_diabaikan_agent_fk FOREIGN KEY (id_agent)
    REFERENCES agent(id_agent) ON DELETE CASCADE,
  CONSTRAINT prospek_diabaikan_unik UNIQUE (id_agent, kunci)
);

CREATE INDEX IF NOT EXISTS idx_prospek_diabaikan_agent ON prospek_diabaikan (id_agent);

COMMIT;

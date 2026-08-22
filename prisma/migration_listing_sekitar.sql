-- ════════════════════════════════════════════════════════════════════════════
-- listing_sekitar — cache "apa yang ada di sekitar aset ini"
--
-- JALANKAN MANUAL di setiap environment (staging & produksi), sebelum atau
-- segera setelah deploy. Aplikasinya sengaja tahan berjalan tanpa tabel ini:
-- src/lib/nearbyPlaces.server.ts menangkap error "relation does not exist" dan
-- kembali memindai langsung, hanya tanpa cache. Jadi urutan deploy tidak bisa
-- membuat halaman detail mati — tapi selama tabel belum ada, tiap kunjungan
-- memanggil Overpass lagi, yang justru ingin dihentikan.
--
-- Aman diulang (idempoten).
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS listing_sekitar (
  id_property   BIGINT PRIMARY KEY,
  latitude      DECIMAL(10, 8),
  longitude     DECIMAL(11, 8),
  sumber_titik  VARCHAR(20),
  radius_meter  INTEGER      NOT NULL DEFAULT 0,
  jumlah        INTEGER      NOT NULL DEFAULT 0,
  lengkap       BOOLEAN      NOT NULL DEFAULT FALSE,
  percobaan     INTEGER      NOT NULL DEFAULT 1,
  tempat        JSONB        NOT NULL DEFAULT '[]'::jsonb,
  dipindai_pada TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Cascade: cache tanpa listing-nya tidak ada gunanya, dan baris yatim akan
-- menahan hasil lama kalau id_property dipakai ulang.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'listing_sekitar_listing_fk'
  ) THEN
    ALTER TABLE listing_sekitar
      ADD CONSTRAINT listing_sekitar_listing_fk
      FOREIGN KEY (id_property) REFERENCES listing (id_property) ON DELETE CASCADE;
  END IF;
END $$;

-- Dipakai pekerjaan latar "pindai yang belum lengkap, paling lama tak tersentuh
-- lebih dulu".
CREATE INDEX IF NOT EXISTS idx_listing_sekitar_lengkap
  ON listing_sekitar (lengkap, dipindai_pada);

-- ── Perawatan (opsional, jalankan manual bila perlu) ────────────────────────
-- Paksa pindai ulang satu aset:
--   DELETE FROM listing_sekitar WHERE id_property = 123456;
--
-- Paksa pindai ulang semua yang gagal/kurang dari 3 tempat:
--   DELETE FROM listing_sekitar WHERE lengkap = FALSE;
--
-- Lihat cakupan cache:
--   SELECT lengkap, count(*), round(avg(jumlah), 1) AS rata_tempat
--   FROM listing_sekitar GROUP BY lengkap;

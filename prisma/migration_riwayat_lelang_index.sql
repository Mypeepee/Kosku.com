-- ═══════════════════════════════════════════════════════════════════════════
-- Index pendukung RIWAYAT LELANG (src/lib/auctionHistory.ts)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Pencarian "aset yang sama" mengambil kandidat lewat IRISAN himpunan nomor
-- sertifikat. Satu lot lelang bisa memuat beberapa bidang sekaligus, dan
-- scraper menyimpan semua nomornya dalam satu kolom dipisah koma
-- ("123,456"). Karena urutan bidang dari sumber tidak stabil dan sebuah paket
-- bisa dilelang ulang dengan bidang yang bertambah/berkurang, pencocokan harus
-- memakai operator irisan array (`&&`), bukan kesamaan satu nomor.
--
-- Tanpa index ini Postgres melakukan seq scan ke seluruh tabel listing
-- (±122 ribu baris, dan makin berat seiring hasil scraping bertambah) —
-- inilah yang bikin blok riwayat kadang muncul kadang tidak saat halaman
-- detail ramai dibuka. Dengan index: ±0,1 ms untuk kasus umum, ±1 ms untuk
-- kasus terburuk (nomor sertifikat 1 digit yang dipakai 200+ baris).
--
-- Ekspresi di bawah HARUS sama dengan `certKeysSql()` di
-- src/lib/auctionHistory.ts. Postgres membandingkan pohon ekspresi, jadi spasi
-- dan baris baru bebas — tapi urutan fungsi, pola regex, dan argumennya harus
-- identik, kalau tidak index ini berhenti terpakai tanpa error apa pun.
-- Blok verifikasi di bagian bawah file ini menguji hal itu; kalau ekspresinya
-- diubah dan ternyata tidak lagi cocok dengan perilaku `certNumbers()`,
-- skrip ini GAGAL dengan pesan yang jelas alih-alih diam-diam salah.
--
-- Semua fungsi yang dipakai (string_to_array, btrim, regexp_replace, upper,
-- NULLIF, COALESCE, ||) IMMUTABLE, jadi sah dipakai sebagai index ekspresi.
--
-- Jalankan sekali per environment (lokal & produksi):
--   psql "$DATABASE_URL" -f prisma/migration_riwayat_lelang_index.sql
-- atau:
--   npx prisma db execute --file prisma/migration_riwayat_lelang_index.sql --schema prisma/schema.prisma
--
-- Catatan: `prisma db push` TIDAK membuat index ini (ekspresi tidak bisa
-- dinyatakan di schema.prisma), dan juga tidak akan menghapusnya. Tapi
-- `prisma db push --force-reset` MENGHAPUS seluruh schema, jadi file ini wajib
-- dijalankan lagi sesudahnya.
--
-- Sengaja TIDAK memakai fungsi PL/pgSQL: kalau file ini lupa dijalankan di
-- suatu environment, fitur riwayat tetap BENAR (hanya lambat) — bukan error
-- "function does not exist" yang mematikan halaman detail lelang.

-- ── 1. Index lama (satu nomor sertifikat saja) sudah tidak dipakai ─────────
-- Dibiarkan hidup hanya akan memperlambat setiap INSERT/UPDATE listing.
DROP INDEX IF EXISTS idx_listing_riwayat_lelang_cert;

-- ── 2. Index baru: himpunan nomor sertifikat kanonik ──────────────────────
-- Ekspresi menghasilkan text[]:
--   ',' || upper(nomor) || ','          → sentinel supaya tiap elemen berapit koma
--   '[,;/|+&]|\mDAN\M' → ','            → samakan semua pemisah daftar
--   '[^0-9A-Z,]' → ''                   → buang spasi/tanda baca di dalam nomor
--   ',0+' → ','                         → buang nol di depan tiap nomor
--   ',+' → ','                          → rapatkan elemen kosong
--   btrim(...,',') + NULLIF + string_to_array
-- Contoh: '00003729' → {3729} · '123, 0456' → {123,456} · '121 dan 14' → {121,14}
CREATE INDEX IF NOT EXISTS idx_listing_riwayat_lelang_certkeys
  ON listing USING gin (
    (
      string_to_array(
        NULLIF(
          btrim(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(
                    ',' || upper(COALESCE(nomor_legalitas, '')) || ',',
                    '[,;/|+&]|\mDAN\M', ',', 'g'
                  ),
                  '[^0-9A-Z,]', '', 'g'
                ),
                ',0+', ',', 'g'
              ),
              ',+', ',', 'g'
            ),
            ','
          ),
          ''
        ),
        ','
      )
    )
  )
  WHERE jenis_transaksi = 'LELANG' AND status_tayang <> 'TARIK_LISTING';

ANALYZE listing;

-- ── 3. Verifikasi ekspresi ────────────────────────────────────────────────
-- Angka-angka ini adalah kontrak antara SQL dan `certNumbers()` di TypeScript.
-- Catatan: sisi SQL sengaja TIDAK membuang potongan tanpa angka
-- ('0087/Desa Sukajadi' → {87,DESASUKAJADI}) — hasilnya selalu SUPERSET dari
-- sisi JS, jadi tidak ada pasangan benar yang hilang, dan penyaringan presisi
-- tetap dikerjakan scoreAssetMatch() di aplikasi.
DO $verifikasi$
DECLARE
  r record;
  gagal int := 0;
BEGIN
  FOR r IN
    WITH kasus(nomor_legalitas, harapan) AS (
      VALUES
        ('00003729',           ARRAY['3729']),
        ('123, 0456',          ARRAY['123','456']),
        ('456,123',            ARRAY['456','123']),
        ('0000',               NULL::text[]),
        ('0,0',                NULL::text[]),
        ('',                   NULL::text[]),
        (NULL,                 NULL::text[]),
        ('121 dan 14',         ARRAY['121','14']),
        ('12DAN34',            ARRAY['12DAN34']),
        ('1.234',              ARRAY['1234']),
        ('1;2|3+4&5',          ARRAY['1','2','3','4','5']),
        ('0087/Desa Sukajadi', ARRAY['87','DESASUKAJADI'])
    )
    SELECT
      kasus.nomor_legalitas AS input,
      kasus.harapan,
      string_to_array(
        NULLIF(
          btrim(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(
                    ',' || upper(COALESCE(nomor_legalitas, '')) || ',',
                    '[,;/|+&]|\mDAN\M', ',', 'g'
                  ),
                  '[^0-9A-Z,]', '', 'g'
                ),
                ',0+', ',', 'g'
              ),
              ',+', ',', 'g'
            ),
            ','
          ),
          ''
        ),
        ','
      ) AS hasil
    FROM kasus
  LOOP
    IF r.hasil IS DISTINCT FROM r.harapan THEN
      RAISE WARNING 'cert keys MELESET untuk %: dapat %, harusnya %',
        COALESCE(r.input, '<NULL>'), COALESCE(r.hasil::text, '<NULL>'),
        COALESCE(r.harapan::text, '<NULL>');
      gagal := gagal + 1;
    END IF;
  END LOOP;

  IF gagal > 0 THEN
    RAISE EXCEPTION 'Ekspresi nomor sertifikat tidak sesuai kontrak (% kasus meleset). Samakan lagi dengan certKeysSql() di src/lib/auctionHistory.ts.', gagal;
  END IF;

  RAISE NOTICE 'Verifikasi ekspresi nomor sertifikat: OK.';
END
$verifikasi$;

-- ── 4. Pastikan index barunya benar-benar dipakai ─────────────────────────
-- Kalau langkah ini melaporkan Seq Scan, berarti ekspresi di query aplikasi
-- (certKeysSql di src/lib/auctionHistory.ts) sudah menyimpang dari index ini.
DO $pakai$
DECLARE
  rencana text;
  jumlah  bigint;
BEGIN
  SELECT count(*) INTO jumlah FROM listing WHERE jenis_transaksi = 'LELANG';
  IF jumlah < 1000 THEN
    RAISE NOTICE 'Data lelang baru % baris — pemeriksaan pemakaian index dilewati (planner wajar memilih seq scan pada tabel kecil).', jumlah;
    RETURN;
  END IF;

  EXECUTE $q$
    EXPLAIN (FORMAT JSON)
    SELECT id_property FROM listing
    WHERE jenis_transaksi = 'LELANG'
      AND status_tayang <> 'TARIK_LISTING'
      AND string_to_array(
            NULLIF(
              btrim(
                regexp_replace(
                  regexp_replace(
                    regexp_replace(
                      regexp_replace(
                        ',' || upper(COALESCE(nomor_legalitas, '')) || ',',
                        '[,;/|+&]|\mDAN\M', ',', 'g'
                      ),
                      '[^0-9A-Z,]', '', 'g'
                    ),
                    ',0+', ',', 'g'
                  ),
                  ',+', ',', 'g'
                ),
                ','
              ),
              ''
            ),
            ','
          ) && ARRAY['3729']::text[]
  $q$ INTO rencana;

  IF rencana NOT LIKE '%idx_listing_riwayat_lelang_certkeys%' THEN
    RAISE WARNING 'Index riwayat lelang TIDAK dipakai oleh planner. Rencana: %', rencana;
  ELSE
    RAISE NOTICE 'Index riwayat lelang terpakai. OK.';
  END IF;
END
$pakai$;

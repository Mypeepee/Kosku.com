-- prisma/migration_listing_index_lokasi.sql
-- ===========================================================================
-- INDEX TRIGRAM UNTUK PENCARIAN LOKASI
--
-- MASALAHNYA. Mesin pencocokan preferensi menyaring lokasi di tingkat yang
-- MENGIKAT — kalau klien mencari "Kecamatan Wiyung", SQL-nya menyaring
-- `kecamatan ILIKE '%wiyung%'`. Itu wajib: tanpanya kolam kandidat diisi
-- listing terbaru yang kebetulan lewat, dan aset yang benar-benar cocok tidak
-- pernah sampai ke penyaringan (20 rumah di Tandes, nol yang terlihat).
--
-- Tapi `ILIKE '%…%'` TIDAK BISA memakai index btree — polanya diawali wildcard,
-- jadi tidak ada awalan yang bisa ditelusuri. Dan kolom `kecamatan` maupun
-- `kelurahan` memang tidak punya index sama sekali; yang ada hanya `kota`.
-- Akibatnya tiap pencocokan memindai seluruh tabel:
--
--     Parallel Seq Scan on listing
--     Rows Removed by Filter: 40.608 (per worker)
--     Execution Time: 1.208 ms
--
-- Satu detik lebih, untuk SATU preferensi. Panel "Siap dikirim" di halaman
-- Client memindai sampai 14 klien, jadi halamannya menunggu belasan detik
-- untuk pekerjaan yang seharusnya milidetik.
--
-- SOLUSINYA. Index GIN trigram (pg_trgm) memang dibuat untuk pola berwildcard:
-- ia memecah teks jadi potongan tiga huruf dan mengindeksnya, sehingga
-- `ILIKE '%wiyung%'` bisa ditelusuri alih-alih dipindai.
--
-- Kolom `kota` juga diberi trigram meski sudah punya btree: btree-nya berguna
-- untuk kesamaan persis, tapi tidak untuk `contains` yang dipakai mesin ini.
--
-- Jalankan manual (konvensi proyek ini — tidak memakai prisma migrate):
--   psql "$DATABASE_URL" -f prisma/migration_listing_index_lokasi.sql
-- Aman diulang. Butuh hak membuat EXTENSION sekali di awal.
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CONCURRENTLY sengaja TIDAK dipakai: ia dilarang di dalam transaksi dan
-- membuat berkas ini tidak bisa dijalankan sebagai satu kesatuan. Tabel 121rb
-- baris terkunci beberapa detik saat index dibangun — jalankan di luar jam
-- sibuk bila memasangnya di produksi.
CREATE INDEX IF NOT EXISTS idx_listing_kecamatan_trgm
  ON listing USING gin (kecamatan gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_listing_kelurahan_trgm
  ON listing USING gin (kelurahan gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_listing_kota_trgm
  ON listing USING gin (kota gin_trgm_ops);

-- Statistik disegarkan supaya perencana query langsung memakai index barunya,
-- bukan menunggu autovacuum yang jadwalnya tak tentu.
ANALYZE listing;

-- ═══════════════════════════════════════════════════════════════════════════
-- listing.harga_efektif — harga yang BENAR-BENAR dilihat pemakai
-- Pendukung "Urutkan" di /Jual, /Sewa, /Lelang (src/lib/listingSort.ts)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- MASALAHNYA
-- Kartu properti menampilkan `harga_promo` kalau diskonnya sah, kalau tidak
-- `harga` (lihat mainPrice di src/components/property/PropertyCard.tsx).
-- Filter min/max harga juga sudah memakai aturan itu. Tapi "Urutkan → harga
-- terendah" dulu mengurutkan kolom `harga` mentah, sehingga listing Rp 5 M
-- berpromo Rp 1 M tampil bertuliskan "Rp 1 M" namun diurutkan sebagai Rp 5 M.
-- Daftar "termurah" pun terlihat acak — dan memang acak, menurut angka yang
-- dibaca pemakai.
--
-- KENAPA KOLOM, BUKAN EKSPRESI DI QUERY
-- `orderBy` Prisma tidak bisa menyatakan CASE/COALESCE, sedangkan WHERE
-- halaman daftar dibangun dari objek Prisma yang berlapis (lihat
-- buildLocationWhere). Menulis ulang seluruh query jadi SQL mentah berarti
-- menduplikasi logika filter — sumber bug yang lebih besar daripada yang
-- diperbaiki. Kolom nyata membuat urutan, filter, index, dan `count` memakai
-- satu angka yang sama.
--
-- KENAPA TRIGGER, BUKAN GENERATED COLUMN
-- `prisma db push` DIAM-DIAM MENCOPOT klausa GENERATED dan menyisakan kolom
-- biasa (diuji langsung di Postgres 17: is_generated berubah NEVER, tanpa
-- peringatan apa pun). Sesudah itu nilainya membeku dan urutan harga jadi
-- salah tanpa satu pun error. Trigger BUKAN objek yang dikelola Prisma, jadi
-- ia SELAMAT dari `db push` — sudah diuji juga. Bonusnya: kalau ada kode yang
-- keliru mengirim `harga_efektif`, trigger menimpanya dengan nilai benar,
-- bukan menolak transaksinya seperti generated column.
--
-- Jalankan sekali per environment (lokal & produksi), SESUDAH `prisma db push`:
--   psql "$DATABASE_URL" -f prisma/migration_harga_efektif.sql
-- atau:
--   npx prisma db execute --file prisma/migration_harga_efektif.sql --schema prisma/schema.prisma
--
-- Idempoten: aman dijalankan berulang kali. WAJIB diulang setiap kali
-- `prisma db push --force-reset` dipakai (reset menghapus seluruh schema).
--
-- ⚠️ KALAU LANGKAH INI TERLEWAT DI SEBUAH SERVER, tidak ada error yang muncul.
-- Kolomnya tetap dibuat `prisma db push` (ia ada di schema.prisma), hanya
-- ISINYA yang NULL — dan ORDER BY pada kolom NULL tidak membandingkan apa pun.
-- Yang terlihat: "urutkan termurah/termahal" tidak mengubah daftar sama sekali,
-- dan filter harga min/maks mengembalikan NOL hasil dari puluhan ribu listing.
-- Benar di lokal, mati di produksi, tanpa satu baris log pun.
--
-- Periksa kapan saja, di server mana pun:
--   npm run db:urut              (periksa saja)
--   npm run db:urut:perbaiki     (periksa, jalankan migrasi ini, periksa lagi)
--   curl "https://…/api/diagnostik/urut?secret=$CRON_SECRET"
-- Aplikasi ikut menjaga diri: src/lib/listingSortRuntime.ts mendeteksi keadaan
-- ini saat berjalan, pindah ke kolom cadangan, dan meneriakkannya ke log.

-- ── 1. Kolom ──────────────────────────────────────────────────────────────
-- Normalnya sudah dibuat `prisma db push` dari schema.prisma. Baris ini
-- menjaga urutan pemasangan yang terbalik (SQL dijalankan lebih dulu) supaya
-- tidak gagal di tengah jalan.
ALTER TABLE listing ADD COLUMN IF NOT EXISTS harga_efektif numeric(20,2);

-- ── 2. Aturannya, satu tempat ─────────────────────────────────────────────
-- Definisi ini HARUS sama dengan `hasDiscount`/`mainPrice` di PropertyCard:
-- promo hanya sah bila terisi, positif, DAN lebih murah dari harga aslinya.
-- Promo Rp 0 (kolom sisa form lama) atau promo yang lebih mahal dari harga
-- bukan diskon — kartu pun menampilkan harga aslinya untuk kasus itu.
CREATE OR REPLACE FUNCTION listing_harga_efektif(
  p_harga numeric,
  p_harga_promo numeric
) RETURNS numeric
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p_harga_promo IS NOT NULL
     AND p_harga_promo > 0
     AND p_harga_promo < p_harga
    THEN p_harga_promo
    ELSE p_harga
  END;
$$;

CREATE OR REPLACE FUNCTION set_listing_harga_efektif() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.harga_efektif := listing_harga_efektif(NEW.harga, NEW.harga_promo);
  RETURN NEW;
END;
$$;

-- BEFORE INSERT OR UPDATE tanpa daftar kolom: `UPDATE OF harga, harga_promo`
-- terlihat lebih hemat, tapi tidak akan menyalakan trigger saat baris lama
-- di-update lewat jalur lain yang kebetulan tidak menyentuh kedua kolom itu —
-- padahal baris hasil restore/impor bisa saja harga_efektif-nya masih NULL.
DROP TRIGGER IF EXISTS trg_listing_harga_efektif ON listing;
CREATE TRIGGER trg_listing_harga_efektif
  BEFORE INSERT OR UPDATE ON listing
  FOR EACH ROW EXECUTE FUNCTION set_listing_harga_efektif();

-- ── 3. Isi ulang baris yang sudah ada ─────────────────────────────────────
-- Hanya baris yang nilainya belum benar, supaya aman dijalankan berkali-kali
-- dan tidak menyentuh 122 ribu baris tanpa perlu.
UPDATE listing
SET harga_efektif = listing_harga_efektif(harga, harga_promo)
WHERE harga_efektif IS DISTINCT FROM listing_harga_efektif(harga, harga_promo);

-- ── 4. Index untuk jalur urut yang panas ──────────────────────────────────
-- Urutan kolomnya HARUS sama persis dengan ORDER BY yang disusun
-- src/lib/listingSort.ts (status_tayang → kunci → id_property DESC).
--
-- "Sama persis" termasuk aturan NULL-nya. `tanggal_lelang DESC` di index berarti
-- DESC NULLS FIRST, sedangkan query menulis DESC NULLS LAST — beda aturan NULL
-- saja sudah cukup membuat Postgres berhenti memakai index dan menyortir
-- seluruh tabel (terukur: 0,3 ms → 32 ms pada 121.825 baris). Karena itu
-- tiap index di bawah mencantumkan aturan NULL-nya secara eksplisit.
--
-- Dua jalur SENGAJA dibiarkan tanpa index, dengan alasan yang berbeda:
--
--   • "Paling banyak dilihat" (`dilihat`). Kolom ini naik setiap kali halaman
--     detail dibuka. Meng-index-nya berarti setiap kunjungan ikut menulis ulang
--     index dan mematikan HOT update — memberatkan jalur paling ramai di situs
--     demi opsi urut yang paling jarang dipakai. Biayanya ±170 ms, ditanggung.
--
--   • "Luas bangunan" (khusus /Sewa). Stok sewa masih kecil, jadi sortirnya
--     murah. Kalau suatu saat stok sewa menembus puluhan ribu, tambahkan
--     pasangan index luas_bangunan meniru pasangan luas_tanah di bawah.
--
-- ⚠️ TANPA klausa WHERE — jangan menjadikannya index parsial.
-- Prisma mengirim query berparameter: `status_tayang IN ($2, $3)`. Postgres
-- harus BISA MEMBUKTIKAN predikat index terpenuhi saat menyusun rencana, dan
-- nilai parameter belum diketahui saat itu — jadi index parsial
-- `WHERE status_tayang <> 'TARIK_LISTING'` DIABAIKAN total. Versi awal file ini
-- memakainya: di psql (nilai literal) tampak Index Only Scan 0,5 ms, tapi lewat
-- Prisma jatuh ke sortir penuh 13 DETIK pada query pertama. Lagi pula
-- predikatnya tidak menyaring apa pun — 0 baris berstatus TARIK_LISTING.
-- Alasan yang sama membuat `jenis_transaksi` jadi KOLOM PERTAMA index, bukan
-- predikat.

-- Index dari iterasi sebelumnya (parsial / aturan NULL tidak cocok) di-drop
-- dulu supaya `CREATE INDEX IF NOT EXISTS` benar-benar membangun definisi baru,
-- bukan melewatinya karena namanya sudah ada.
DROP INDEX IF EXISTS idx_listing_urut_harga;
DROP INDEX IF EXISTS idx_listing_urut_harga_desc;
DROP INDEX IF EXISTS idx_listing_urut_terbaru;
DROP INDEX IF EXISTS idx_listing_urut_jadwal_lelang;
DROP INDEX IF EXISTS idx_listing_urut_jadwal_asc;
DROP INDEX IF EXISTS idx_listing_urut_jadwal_desc;
DROP INDEX IF EXISTS idx_listing_urut_luas_asc;
DROP INDEX IF EXISTS idx_listing_urut_luas_desc;

-- Harga butuh DUA index, satu per arah. Membaca satu index secara mundur TIDAK
-- cukup: ORDER BY-nya bercampur arah (status ASC, harga DESC, id DESC), dan
-- pembacaan mundur membalik SEMUA kolom sekaligus — status ikut terbalik.
-- Diuji: dengan satu index saja, "Harga tertinggi" jatuh ke Incremental Sort
-- 175 ms; dengan pasangannya jadi Index Only Scan ±1 ms.
CREATE INDEX IF NOT EXISTS idx_listing_urut_harga
  ON listing (jenis_transaksi, status_tayang, harga_efektif ASC, id_property DESC);

CREATE INDEX IF NOT EXISTS idx_listing_urut_harga_desc
  ON listing (jenis_transaksi, status_tayang, harga_efektif DESC, id_property DESC);

CREATE INDEX IF NOT EXISTS idx_listing_urut_terbaru
  ON listing (jenis_transaksi, status_tayang, tanggal_dibuat DESC, id_property DESC);

-- Jadwal lelang butuh DUA index: `tanggal_lelang` boleh NULL, jadi arah naik
-- dan turun sama-sama memakai NULLS LAST — dan index NULLS LAST yang dibaca
-- mundur menghasilkan NULLS FIRST, bukan pasangan yang dicari.
CREATE INDEX IF NOT EXISTS idx_listing_urut_jadwal_asc
  ON listing (jenis_transaksi, status_tayang, tanggal_lelang ASC NULLS LAST, id_property DESC);

CREATE INDEX IF NOT EXISTS idx_listing_urut_jadwal_desc
  ON listing (jenis_transaksi, status_tayang, tanggal_lelang DESC NULLS LAST, id_property DESC);

-- Luas tanah — jalur nyata bagi pemburu tanah/kavling di /Lelang & /Jual.
-- Tanpa index, "Luas tanah terbesar" memakan 886 ms pada 121.825 baris
-- (kolomnya banyak NULL, jadi sortirnya mahal); dengan index turun ke ±2 ms.
-- Aman di-index: luas hanya berubah saat listing diedit, bukan tiap kunjungan.
CREATE INDEX IF NOT EXISTS idx_listing_urut_luas_asc
  ON listing (jenis_transaksi, status_tayang, luas_tanah ASC NULLS LAST, id_property DESC);

CREATE INDEX IF NOT EXISTS idx_listing_urut_luas_desc
  ON listing (jenis_transaksi, status_tayang, luas_tanah DESC NULLS LAST, id_property DESC);

ANALYZE listing;

-- ── 5. Verifikasi ─────────────────────────────────────────────────────────
-- Gagal keras kalau ada satu saja baris yang meleset. Kolom turunan yang
-- salah tidak memunculkan error di mana pun — ia cuma membuat "urutkan
-- termurah" salah diam-diam, persis bug yang file ini perbaiki.
DO $verifikasi$
DECLARE
  meleset bigint;
  kosong  bigint;
  contoh  text;
BEGIN
  SELECT count(*) INTO meleset FROM listing
  WHERE harga_efektif IS DISTINCT FROM listing_harga_efektif(harga, harga_promo);

  IF meleset > 0 THEN
    SELECT string_agg(id_property::text, ', ') INTO contoh
    FROM (SELECT id_property FROM listing
          WHERE harga_efektif IS DISTINCT FROM listing_harga_efektif(harga, harga_promo)
          LIMIT 5) s;
    RAISE EXCEPTION 'harga_efektif meleset di % baris (mis. id %). Backfill gagal.', meleset, contoh;
  END IF;

  SELECT count(*) INTO kosong FROM listing WHERE harga_efektif IS NULL;
  IF kosong > 0 THEN
    RAISE EXCEPTION 'harga_efektif masih NULL di % baris.', kosong;
  END IF;

  -- Uji trigger benar-benar hidup, bukan cuma backfill yang jalan sekali.
  CREATE TEMP TABLE _uji_he ON COMMIT DROP AS SELECT * FROM listing LIMIT 0;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'listing'::regclass
      AND tgname = 'trg_listing_harga_efektif'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Trigger trg_listing_harga_efektif tidak terpasang.';
  END IF;

  RAISE NOTICE 'harga_efektif: % baris konsisten, trigger aktif. OK.',
    (SELECT count(*) FROM listing);
END
$verifikasi$;

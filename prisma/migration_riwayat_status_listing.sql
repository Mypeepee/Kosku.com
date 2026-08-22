-- ═══════════════════════════════════════════════════════════════════════════
-- Jejak audit perubahan status tayang listing  (riwayat_status_listing)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Sejak status listing bisa diubah langsung dari halaman detail, ada TIGA
-- pihak yang boleh menekan tombolnya: pemegang listing, OWNER, dan STOKER
-- (khusus aset lelang). Sebelum tabel ini, satu-satunya bekas yang tertinggal
-- adalah listing.tanggal_diupdate — yang tidak menyebut pelakunya sama sekali.
-- Pertanyaan wajar seperti "siapa yang menandai listing saya terjual?" jadi
-- tidak bisa dijawab, dan itu persis pertanyaan yang muncul saat ada salah
-- tanda.
--
-- Identitas pelaku disimpan sebagai SNAPSHOT (id + nama + jabatan saat itu),
-- bukan foreign key ke tabel agent:
--   • jabatan berubah — stoker hari ini bisa jadi agent biasa bulan depan,
--     sementara audit harus mencatat wewenang yang dipakai SAAT kejadian;
--   • baris audit harus selamat walaupun akun pelakunya kelak dihapus.
-- Karena itu satu-satunya FK di sini menunjuk ke listing, yang memang tidak
-- berarti lagi kalau listingnya sendiri sudah tidak ada (ON DELETE CASCADE).
--
-- Tabel ini APPEND-ONLY: aplikasi tidak pernah melakukan UPDATE/DELETE di
-- sini. Barisnya ditulis dalam transaksi yang sama dengan perubahan status,
-- jadi tidak mungkin ada perubahan status tanpa jejaknya (atau sebaliknya).
--
-- Jalankan sekali per environment (lokal & produksi), SEBELUM menjalankan
-- versi aplikasi yang memakainya:
--   psql "$DATABASE_URL" -f prisma/migration_riwayat_status_listing.sql
--
-- Aman diulang (idempoten).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS riwayat_status_listing (
  id               BIGSERIAL    PRIMARY KEY,
  id_property      BIGINT       NOT NULL,

  -- Pelaku (snapshot, tanpa FK — lihat catatan di atas)
  id_agent         VARCHAR(20)  NOT NULL,
  nama_pelaku      VARCHAR(150),
  jabatan_pelaku   VARCHAR(30)  NOT NULL,

  -- Dasar izin yang dipakai: OWNER | PEMILIK | STOKER_LELANG.
  -- Inilah yang membedakan "agent menutup listingnya sendiri" dari "stoker
  -- menutup aset agent lain" — dua kejadian dengan bobot sangat berbeda.
  dasar_wewenang   VARCHAR(20)  NOT NULL,

  -- Pemegang listing saat kejadian (listing bisa dialihkan ke agent lain).
  id_agent_pemilik VARCHAR(20)  NOT NULL,

  status_lama      status_properti_enum NOT NULL,
  status_baru      status_properti_enum NOT NULL,

  -- Asal aksi: DETAIL (halaman detail aset) | DASHBOARD (aksi massal).
  sumber           VARCHAR(20)  NOT NULL,

  dibuat_pada      TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT riwayat_status_listing_listing_fk
    FOREIGN KEY (id_property) REFERENCES listing (id_property) ON DELETE CASCADE
);

-- Pertanyaan utama tabel ini: "apa saja yang pernah terjadi pada listing X,
-- terbaru dulu" — dipakai panel kontrol di halaman detail.
CREATE INDEX IF NOT EXISTS idx_riwayat_status_listing_property
  ON riwayat_status_listing (id_property, dibuat_pada DESC);

-- Pertanyaan kedua: "apa saja yang pernah dilakukan agent Y" — dipakai saat
-- menelusuri kejanggalan (mis. satu akun menutup banyak aset dalam semenit).
CREATE INDEX IF NOT EXISTS idx_riwayat_status_listing_pelaku
  ON riwayat_status_listing (id_agent, dibuat_pada DESC);

-- Nilai di luar daftar yang dikenal berarti ada penulis baru yang tidak lewat
-- src/lib/listingStatusPermission.ts. Lebih baik ditolak di sini daripada
-- diam-diam mengotori audit. NOT VALID: tabel baru, tidak ada baris lama.
DO $$ BEGIN
  ALTER TABLE riwayat_status_listing
    ADD CONSTRAINT riwayat_status_listing_dasar_check
    CHECK (dasar_wewenang IN ('OWNER', 'PEMILIK', 'STOKER_LELANG')) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE riwayat_status_listing
    ADD CONSTRAINT riwayat_status_listing_sumber_check
    CHECK (sumber IN ('DETAIL', 'DASHBOARD')) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Sanity check: gagal dengan pesan jelas kalau tabelnya tidak terbentuk.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'riwayat_status_listing'
  ) THEN
    RAISE EXCEPTION 'riwayat_status_listing gagal dibuat';
  END IF;
  RAISE NOTICE 'OK — riwayat_status_listing siap dipakai.';
END $$;

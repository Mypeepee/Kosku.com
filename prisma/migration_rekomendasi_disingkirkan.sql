-- prisma/migration_rekomendasi_disingkirkan.sql
-- ===========================================================================
-- ASET YANG DISINGKIRKAN AGENT DARI DAFTAR REKOMENDASI SEORANG KLIEN
--
-- MASALAH YANG DIPECAHKAN.
-- Mesin pencocokan sengaja KETAT, tapi seketat apa pun kriteria yang bisa
-- ditulis, selalu ada alasan yang tidak ada kolomnya: bangunannya menghadap
-- makam, sertifikatnya sedang bersengketa, klien sudah pernah melihat rumah
-- itu tahun lalu dan tidak suka. Agent tahu; database tidak.
--
-- Tanpa tempat menyimpan penilaian itu, aset yang sama muncul di puncak daftar
-- setiap kali layar dibuka, selamanya. Agent melewatinya sekali, dua kali,
-- lalu berhenti membaca daftarnya sama sekali — dan aset BARU yang benar-benar
-- cocok ikut terlewat karena tertimbun di bawah lima aset yang sudah ia tolak.
-- Daftar rekomendasi hanya berguna selama ia bisa DIHABISKAN.
--
-- ── KENAPA TABEL SENDIRI, BUKAN KOLOM DI `kiriman_rekomendasi` ─────────────
-- "Pernah dikirim" dan "disingkirkan tanpa pernah dikirim" adalah dua fakta
-- berbeda dengan umur yang berbeda. Kiriman membawa harga saat kirim, jumlah
-- kirim, tanggapan klien, dan antrean kabar perubahan — seluruhnya tidak punya
-- arti untuk aset yang tidak pernah ditawarkan. Menumpangkannya di sana berarti
-- setiap query kiriman harus ingat menyaring "yang benar-benar terkirim", dan
-- yang lupa akan melaporkan penyingkiran sebagai penawaran kepada klien.
--
-- ── UNIK (id_klien, id_property) ──────────────────────────────────────────
-- Penilaian ini milik PASANGAN klien–aset, bukan milik agent. Rumah yang tidak
-- cocok untuk Budi tetap layak ditawarkan ke Sari. `id_agent` disimpan hanya
-- sebagai jejak siapa yang memutuskan — bukan bagian dari kuncinya.
--
-- Uniknya juga yang membuat tombolnya aman diketuk dua kali (jaringan lambat,
-- agent mengetuk ulang): ON CONFLICT, bukan baris kembar.
--
-- ── KENAPA BARISNYA DIHAPUS SAAT DIPULIHKAN, BUKAN DITANDAI ───────────────
-- Godaan berikutnya adalah menambahkan `dipulihkan_pada` dan menyaringnya.
-- Ditolak: setiap pembaca tabel ini kemudian harus ingat menyaring kolom itu,
-- dan yang lupa akan menyembunyikan aset yang sudah dipulihkan agent — persis
-- kerusakan yang tidak meninggalkan jejak. Tabel ini menjawab SATU pertanyaan
-- ("aset apa yang sedang disingkirkan"), dan barisnya ada hanya selama
-- jawabannya "ya". Riwayat penyingkiran bukan kebutuhan yang pernah muncul.
--
-- Jalankan manual (konvensi proyek ini — tidak memakai prisma migrate):
--   psql "$DATABASE_URL" -f prisma/migration_rekomendasi_disingkirkan.sql
-- Aman diulang.
-- ===========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS rekomendasi_disingkirkan (
  id          BIGSERIAL PRIMARY KEY,
  id_klien    VARCHAR(20) NOT NULL,
  id_property BIGINT      NOT NULL,
  -- Siapa yang memutuskan. Jejak, bukan bagian dari kunci: penilaiannya
  -- melekat pada klien, dan klien bisa berpindah tangan antar agent.
  id_agent    VARCHAR(20) NOT NULL,
  -- Alasan bebas, opsional. Sengaja TEXT tanpa enum: alasan sebenarnya selalu
  -- di luar daftar yang bisa ditebak lebih dulu, dan enum yang tidak muat
  -- membuat agent memilih "lainnya" sampai kolomnya tidak berarti apa-apa.
  alasan      TEXT,
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT disingkirkan_klien_fk   FOREIGN KEY (id_klien)    REFERENCES klien(id_klien)        ON DELETE CASCADE,
  CONSTRAINT disingkirkan_listing_fk FOREIGN KEY (id_property) REFERENCES listing(id_property)   ON DELETE CASCADE,
  CONSTRAINT disingkirkan_agent_fk   FOREIGN KEY (id_agent)    REFERENCES agent(id_agent)        ON DELETE CASCADE
);

-- Kunci anti-dobel DAN penyaring utamanya sekaligus: seluruh pembacaan tabel
-- ini berbentuk "aset apa saja yang disingkirkan untuk klien X".
CREATE UNIQUE INDEX IF NOT EXISTS disingkirkan_unik
  ON rekomendasi_disingkirkan (id_klien, id_property);

-- Dipakai saat sebuah listing terjual/dihapus dan barisnya ikut dibersihkan.
CREATE INDEX IF NOT EXISTS idx_disingkirkan_listing
  ON rekomendasi_disingkirkan (id_property);

COMMENT ON TABLE rekomendasi_disingkirkan IS
  'Penilaian agent bahwa sebuah aset TIDAK cocok untuk seorang klien, dengan '
  'alasan yang tidak punya kolom di preferensi. Dikecualikan dari seluruh '
  'pencarian rekomendasi klien itu (layar CRM, panel ringkasan, dan cron '
  'email) lewat src/lib/klienPengecualian.ts. Baris dihapus saat dipulihkan.';

COMMIT;

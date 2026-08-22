-- ════════════════════════════════════════════════════════════════════════════
-- sekitar_titik — cache "apa yang ada di sekitar KOORDINAT ini"
--
-- JALANKAN MANUAL di setiap environment (staging & produksi), sebelum atau
-- segera setelah deploy. Seperti listing_sekitar, aplikasinya tahan berjalan
-- tanpa tabel ini (src/lib/nearbyPlaces.server.ts menangkap "relation does not
-- exist" lalu memindai langsung) — hanya saja tanpa penghematan yang jadi
-- alasan tabel ini ada.
--
-- KENAPA TERPISAH DARI listing_sekitar. Yang itu dikunci id_property, dan itu
-- syarat yang tidak selalu bisa dipenuhi:
--
--   1. Form tambah properti memindai SEBELUM listing-nya ada. Tanpa tabel ini,
--      hasil pindaian di form terbuang, lalu titik yang sama dipindai lagi
--      begitu pengunjung pertama membuka halaman detailnya — dua pemindaian
--      untuk satu jawaban yang identik.
--   2. Beberapa listing bisa berbagi satu titik (5 unit di gedung apartemen
--      yang sama). Dikunci per listing, itu 5 pemindaian; dikunci per titik,
--      1 pemindaian.
--
-- listing_sekitar tetap ada dan tetap jadi yang dibaca halaman detail: ia
-- menyimpan titik mana yang dipakai aset itu (termasuk hasil geocode) dan
-- ikut terhapus bersama listingnya. Tabel ini lapisan di bawahnya.
--
-- KUNCINYA. Koordinat dibulatkan 3 desimal (±110 m) lalu digabung jadi teks,
-- mis. "-7.245,112.671". Radius pemindaian terkecil 800 m, jadi geseran 110 m
-- praktis tidak mengubah daftar hasilnya — sementara pembulatan yang lebih
-- ketat (4 desimal ≈ 11 m) membuat dua agent yang menandai gedung yang sama
-- tetap memindai dua kali, yang persis ingin dihindari.
--
-- Aman diulang (idempoten).
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sekitar_titik (
  -- "lat,lng" yang sudah dibulatkan 3 desimal — lihat kunciTitik().
  kunci         VARCHAR(32) PRIMARY KEY,
  latitude      DECIMAL(10, 8) NOT NULL,
  longitude     DECIMAL(11, 8) NOT NULL,
  radius_meter  INTEGER      NOT NULL DEFAULT 0,
  jumlah        INTEGER      NOT NULL DEFAULT 0,
  lengkap       BOOLEAN      NOT NULL DEFAULT FALSE,
  tempat        JSONB        NOT NULL DEFAULT '[]'::jsonb,
  dipindai_pada TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Sengaja TANPA foreign key: barisnya memang tidak dimiliki listing mana pun.
-- Titik yang dipindai dari form tambah properti hidup sebelum listing pertama
-- yang memakainya, dan tetap berguna setelah listing itu dihapus.

-- Dipakai perawatan "buang cache titik yang sudah basi".
CREATE INDEX IF NOT EXISTS idx_sekitar_titik_dipindai
  ON sekitar_titik (dipindai_pada);

-- ── Perawatan (opsional, jalankan manual bila perlu) ────────────────────────
-- Paksa pindai ulang satu titik:
--   DELETE FROM sekitar_titik WHERE kunci = '-7.245,112.671';
--
-- Buang percobaan yang hasilnya kurang dari 3 tempat:
--   DELETE FROM sekitar_titik WHERE lengkap = FALSE;
--
-- Lihat berapa banyak pemindaian yang dihemat (titik dipakai >1 listing):
--   SELECT t.kunci, t.jumlah, count(l.id_property) AS dipakai
--   FROM sekitar_titik t
--   JOIN listing_sekitar l
--     ON round(l.latitude, 3) = round(t.latitude, 3)
--    AND round(l.longitude, 3) = round(t.longitude, 3)
--   GROUP BY t.kunci, t.jumlah
--   HAVING count(l.id_property) > 1;

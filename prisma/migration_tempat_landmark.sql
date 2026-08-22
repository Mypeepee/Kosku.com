-- ════════════════════════════════════════════════════════════════════════════
-- KAMUS TEMPAT — supaya orang bisa mencari "deket UNESA", bukan cuma "Surabaya"
--
-- JALANKAN MANUAL di setiap environment (staging & produksi), lalu jalankan
-- `npm run kamus:tempat` sekali untuk mengisi kamus dari data yang SUDAH ada.
-- Aplikasinya tahan berjalan tanpa tabel-tabel ini (semua pembacanya menangkap
-- "relation does not exist" lalu diam) — hanya saja fitur "dekat X" mati.
--
-- ── KENAPA ADA ──────────────────────────────────────────────────────────────
-- Filter lokasi yang lama menjawab "di mana" secara administratif: provinsi,
-- kota, kecamatan, kelurahan. Itu bukan cara orang mencari tempat tinggal.
-- Yang diketik calon penghuni kos adalah "deket unesa"; yang diketik keluarga
-- muda adalah "deket rs soetomo". Nama kelurahan di sekitar UNESA (Lidah
-- Wetan, Lidah Kulon, Jeruk) tidak diketahui justru oleh orang yang paling
-- butuh — pendatang.
--
-- ── DARI MANA ISINYA ────────────────────────────────────────────────────────
-- Kamus ini TIDAK diimpor massal dari OpenStreetMap. Isinya tumbuh dari dua
-- hal yang sudah terjadi sendiri di sistem ini:
--
--   1. `listing_sekitar` — hasil pindai "apa yang ada di sekitar aset ini",
--      yang berjalan sekali saat halaman detail dibuka pertama kali.
--   2. `listing.akses_terdekat` — patokan yang diketik agent sendiri saat
--      menambah properti ("KAMPUS, UNESA, 4 km").
--
-- Konsekuensinya disengaja dan bagus: sebuah tempat masuk kamus HANYA kalau
-- ada aset di dekatnya. Artinya saran autocomplete tidak pernah menawarkan
-- tempat yang hasilnya nol — cacat yang selalu muncul kalau kamusnya diimpor
-- dari gazetteer nasional (ketik "unair" di kota yang tidak punya listing,
-- dapat saran, klik, kosong).
--
-- ── CACAT YANG DIPERBAIKI BERSAMAAN ─────────────────────────────────────────
-- Terukur di data: dari 68 pemindaian yang lengkap, 54 berhenti di radius
-- 800 m — karena tangga radius memang berhenti begitu dapat 3 tempat, dan di
-- kota itu tercapai di anak tangga pertama. Akibatnya kampus 4 km TIDAK PERNAH
-- tercatat, padahal "dekat kampus" justru berarti sejauh itu. (Lihat aset di
-- Balas Klumprik: UNESA tampil di halaman detailnya sebagai patokan agent,
-- BUKAN sebagai hasil pindai.)
--
-- Maka pemindaian sekarang punya sapuan KEDUA: khusus kelas landmark, radius
-- tetap 5 km. Pembagiannya berprinsip, bukan angka asal:
--
--   HARIAN   (800 m)  — warung, minimarket, laundry, masjid. Orang jalan kaki.
--   LANDMARK (5 km)   — kampus, RS, mall, stasiun, terminal, bandara, pasar,
--                       stadion. Orang naik motor, dan 5 km masih "deket".
--
-- Landmark jumlahnya sedikit per titik, jadi sapuan lebar tidak membanjiri
-- daftar "yang ada di sekitar" yang tampil di halaman detail — hasilnya
-- disimpan di kolom terpisah dan tidak ikut ditampilkan di sana.
--
-- Aman diulang (idempoten).
-- ════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ────────────────────────────────────────────────────────────────────────────
-- tempat — satu baris per tempat yang bisa dicari
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tempat (
  id           BIGSERIAL PRIMARY KEY,

  -- Kunci dedup, dihitung di src/lib/tempat/normalisasi.ts (kunciTempat()).
  -- Aturannya beda per jangkauan, dan bedanya penting:
  --   LANDMARK → "kelas|nama|kota"  → satu UNESA per kota, walau dipindai dari
  --              50 aset berbeda yang koordinatnya berjauhan.
  --   HARIAN   → "kelas|nama|lat,lng(3 desimal)" → tiap cabang Alfamart tetap
  --              baris sendiri; menggabungkannya per kota akan membuat "dekat
  --              Alfamart" berarti "di kota yang ada Alfamart-nya", yaitu
  --              seluruh kota di Indonesia.
  kunci        VARCHAR(220) NOT NULL UNIQUE,

  -- Dipakai di URL: /Sewa?dekat=unesa-surabaya. Stabil; jangan diubah setelah
  -- dibagikan karena tautan hasil pencarian ikut tersebar lewat WhatsApp.
  slug         VARCHAR(200) NOT NULL UNIQUE,

  -- Nama yang ditampilkan, apa adanya dari sumbernya ("Universitas Negeri
  -- Surabaya" atau "UNESA" — mana yang lebih dulu terlihat).
  nama         VARCHAR(200) NOT NULL,
  -- Hasil normalisasi: huruf kecil, tanpa tanda baca, gelar & kata sambung
  -- dibuang. Inilah yang dicocokkan, bukan `nama`.
  nama_normal  VARCHAR(200) NOT NULL,

  kelas        VARCHAR(24)  NOT NULL,
  -- LANDMARK | HARIAN — menentukan radius sapuan DAN radius bawaan pencarian.
  jangkauan    VARCHAR(12)  NOT NULL,

  latitude     DECIMAL(10, 8),
  longitude    DECIMAL(11, 8),
  kota         VARCHAR(120),
  provinsi     VARCHAR(120),

  -- Nama brand yang dinormalisasi, mis. "mie gacoan" untuk 12 cabangnya.
  -- Kosong untuk tempat tunggal (UNESA tidak punya cabang). Dipakai supaya
  -- "deket mie gacoan" bisa berarti "dekat cabang mana pun", bukan memaksa
  -- user memilih cabang yang bahkan tidak dia tahu ada.
  brand_normal VARCHAR(120),

  -- TURUNAN — disegarkan oleh skrip/penyerap, bukan sumber kebenaran. Ada
  -- semata-mata untuk PERINGKAT saran: kalau "pasar" cocok ke 40 tempat,
  -- yang punya aset terbanyak yang pantas tampil lebih dulu.
  jumlah_listing INTEGER NOT NULL DEFAULT 0,

  -- PINDAI (hasil OpenStreetMap) | PATOKAN (diketik agent) | KURATIF (seed).
  sumber       VARCHAR(16)  NOT NULL DEFAULT 'PINDAI',

  dibuat_pada     TIMESTAMPTZ NOT NULL DEFAULT now(),
  disegarkan_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- tempat_alias — nama lain untuk tempat yang sama
--
-- INI JANTUNG FITURNYA. "UNESA" dan "Universitas Negeri Surabaya" adalah dua
-- string yang tidak punya kemiripan trigram sama sekali (bandingkan: "unesa"
-- vs "universitasnegerisurabaya") — tidak ada pencocokan fuzzy secanggih apa
-- pun yang bisa menyatukannya. Satu-satunya jalan adalah dicatat bahwa
-- keduanya nama yang sama, dan itulah tabel ini.
--
-- Empat sumber alias, dari yang paling dipercaya:
--   OSM     — tag short_name/alt_name/official_name/name:en dari OpenStreetMap.
--             Gratis, ditulis pemeta setempat, dan sering persis yang dicari.
--   KURATIF — daftar tulis-tangan di src/lib/tempat/alias-kuratif.ts untuk
--             singkatan yang terlanjur baku tapi tidak dipetakan siapa pun.
--   PATOKAN — nama yang diketik agent di form ("UNESA") saat tempat yang sama
--             sudah ada di kamus dengan nama panjangnya.
--   AKRONIM — huruf depan tiap kata, dibangkitkan otomatis. PALING LEMAH dan
--             sengaja diberi bobot terendah saat pemeringkatan: "Universitas
--             Negeri Surabaya" menghasilkan "uns", yang justru milik
--             Universitas Sebelas Maret. Berguna untuk "RSUD Dr Soetomo" →
--             "rsuds", berbahaya untuk kampus. Jadi ia boleh mencocokkan,
--             tapi tidak pernah menang atas alias bersumber lain.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tempat_alias (
  id_tempat    BIGINT       NOT NULL REFERENCES tempat(id) ON DELETE CASCADE,
  alias        VARCHAR(200) NOT NULL,
  alias_normal VARCHAR(200) NOT NULL,
  sumber       VARCHAR(16)  NOT NULL,
  PRIMARY KEY (id_tempat, alias_normal)
);

-- ────────────────────────────────────────────────────────────────────────────
-- listing_tempat — indeks terbalik: dari tempat, ke aset di dekatnya
--
-- Tanpa tabel ini, "dekat UNESA" harus membongkar kolom JSON di 120 ribu baris
-- listing_sekitar setiap kali ada yang mencari. Dengan tabel ini, ia sebuah
-- index scan pada (id_tempat, jarak_meter) yang langsung terurut dari yang
-- paling dekat — persis urutan yang ingin dilihat pencarinya.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS listing_tempat (
  id_property BIGINT  NOT NULL REFERENCES listing(id_property) ON DELETE CASCADE,
  id_tempat   BIGINT  NOT NULL REFERENCES tempat(id)           ON DELETE CASCADE,

  jarak_meter INTEGER NOT NULL,

  -- PINDAI  — jarak diukur haversine dari titik aset ke titik POI. Angka nyata.
  -- PATOKAN — jarak diketik agent. Kalau satuannya MENIT, dikonversi memakai
  --           600 m/menit (motor dalam kota ±36 km/jam); itu perkiraan kasar
  --           dan ditandai lewat `presisi`, bukan disembunyikan.
  sumber      VARCHAR(12) NOT NULL,

  -- SEBERAPA BOLEH DIPERCAYA jarak di atas — turunan dari presisi titik aset:
  --   TITIK     — koordinat ditandai agent sendiri. Terbaik.
  --   ALAMAT    — geocode nama jalan. Baik (±100 m).
  --   KELURAHAN — geocode berhenti di kelurahan (±1 km).
  --   KECAMATAN — ±5 km. Ditandai "perkiraan" di layar.
  --   PATOKAN   — klaim agent, tidak diukur sistem.
  -- Presisi KOTA sengaja TIDAK PERNAH masuk tabel ini: titik yang cuma tahu
  -- "Kota Surabaya" tidak berhak mengklaim "1,2 km dari UNESA". Aset seperti
  -- itu tetap ketemu lewat filter kota — yang memang sebatas itu yang diketahui.
  presisi     VARCHAR(12) NOT NULL,

  PRIMARY KEY (id_property, id_tempat)
);

-- Arah baca yang sesungguhnya: "beri aset terdekat dari tempat ini".
CREATE INDEX IF NOT EXISTS idx_listing_tempat_dekat
  ON listing_tempat (id_tempat, jarak_meter);

-- Arah sebaliknya, dipakai kartu hasil & halaman detail ("aset ini dekat apa").
CREATE INDEX IF NOT EXISTS idx_listing_tempat_listing
  ON listing_tempat (id_property);

-- ────────────────────────────────────────────────────────────────────────────
-- Index pencocokan nama
--
-- GIN trigram untuk toleransi salah ketik ("unessa", "tunjungan plasa"), dan
-- btree pattern_ops untuk pencocokan awalan yang jauh lebih murah — awalan
-- adalah kasus terbanyak (orang mengetik dari depan), jadi ia dicoba lebih
-- dulu dan trigram hanya dipakai kalau awalan tidak menghasilkan cukup saran.
-- ────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tempat_nama_trgm
  ON tempat USING gin (nama_normal gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tempat_nama_awalan
  ON tempat (nama_normal varchar_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_tempat_alias_trgm
  ON tempat_alias USING gin (alias_normal gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tempat_alias_awalan
  ON tempat_alias (alias_normal varchar_pattern_ops);

-- Saran diurutkan "yang punya aset terbanyak dulu"; ini yang membuatnya murah.
CREATE INDEX IF NOT EXISTS idx_tempat_populer
  ON tempat (jumlah_listing DESC);

-- Pengelompokan cabang ("Mie Gacoan · 12 cabang").
CREATE INDEX IF NOT EXISTS idx_tempat_brand
  ON tempat (brand_normal) WHERE brand_normal IS NOT NULL;

-- Pencarian per JENIS tempat ("semua kampus di Malang"). Kolom wilayah ikut
-- karena pertanyaannya hampir selalu berpasangan — "kampus" tanpa batas
-- wilayah adalah pertanyaan yang jawabannya seluruh Indonesia, dan hampir
-- tidak ada yang benar-benar menanyakannya.
CREATE INDEX IF NOT EXISTS idx_tempat_kelas
  ON tempat (kelas, kota);
CREATE INDEX IF NOT EXISTS idx_tempat_kelas_provinsi
  ON tempat (kelas, provinsi);

-- ────────────────────────────────────────────────────────────────────────────
-- Index kata kunci alamat
--
-- Bukan bagian dari kamus tempat, tapi lahir dari kebutuhannya: kotak
-- pencarian sekarang menghitung "berapa properti yang alamatnya memuat teks
-- ini" sambil user mengetik, supaya orang yang mengetik nama jalan atau
-- kelurahan ("Dukuh Kupang") langsung melihat bahwa asetnya ADA — bukan
-- disodori pesan yang terbaca seperti "tidak ada apa-apa di sini".
--
-- Terukur di 120 ribu baris: tanpa index 750 ms, dengan index 19 ms. Yang
-- 750 ms itu juga dibayar oleh filter `q` di /Jual, /Sewa, /Lelang setiap kali
-- ada yang mencari — jadi index ini mempercepat pencarian yang sudah ada,
-- bukan cuma fitur barunya. Ukurannya ±25 MB.
-- ────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_listing_alamat_trgm
  ON listing USING gin (alamat_lengkap gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_listing_judul_trgm
  ON listing USING gin (judul gin_trgm_ops);

-- `provinsi` menyusul belakangan dan itu bukan kelengkapan: pencariannya satu
-- gabungan OR atas enam kolom, dan SATU kolom tanpa index sudah cukup memaksa
-- seluruhnya jadi pemindaian penuh. Terukur — dengan lima dari enam kolom
-- ter-index, penghitungnya masih 450 ms; setelah yang keenam, 17 ms.
CREATE INDEX IF NOT EXISTS idx_listing_provinsi_trgm
  ON listing USING gin (provinsi gin_trgm_ops);

-- ────────────────────────────────────────────────────────────────────────────
-- Kolom tambahan pada tabel pindai yang sudah ada
-- ────────────────────────────────────────────────────────────────────────────

-- Hasil sapuan landmark 5 km. DIPISAH dari kolom `tempat` dengan sengaja:
-- `tempat` adalah "apa yang ada di sekitar" untuk dibaca manusia di halaman
-- detail, dan mencampurkan bandara 4 km ke daftar bertajuk "Radius 800 m"
-- akan membuat tajuknya bohong. Kolom ini murni bahan bakar indeks pencarian.
ALTER TABLE listing_sekitar ADD COLUMN IF NOT EXISTS landmark JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE sekitar_titik   ADD COLUMN IF NOT EXISTS landmark JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Seberapa kasar titik yang dipakai memindai: TITIK | ALAMAT | KELURAHAN |
-- KECAMATAN | KOTA. Dulu tidak dicatat, dan itu lubang kejujuran yang nyata —
-- aset lelang yang alamatnya cuma "Kel. Mangkujayan, Kec. Ponorogo" digeocode
-- ke titik kelurahan lalu ditampilkan di peta persis sama meyakinkannya dengan
-- aset yang koordinatnya ditandai agent di atas atapnya sendiri.
ALTER TABLE listing_sekitar ADD COLUMN IF NOT EXISTS presisi_titik VARCHAR(12);
ALTER TABLE sekitar_titik   ADD COLUMN IF NOT EXISTS presisi_titik VARCHAR(12);

-- ── Perawatan (opsional) ────────────────────────────────────────────────────
-- Segarkan penghitung untuk peringkat saran:
--   UPDATE tempat t SET jumlah_listing = COALESCE((
--     SELECT count(*) FROM listing_tempat lt
--     JOIN listing l ON l.id_property = lt.id_property
--     WHERE lt.id_tempat = t.id
--       AND l.status_tayang = 'TERSEDIA' AND l.bukan_properti = FALSE
--   ), 0);
--
-- Buang tempat yang tidak lagi punya aset (mis. setelah listing dihapus):
--   DELETE FROM tempat WHERE jumlah_listing = 0 AND sumber <> 'KURATIF';
--
-- Lihat tempat paling laku dicari:
--   SELECT nama, kelas, kota, jumlah_listing FROM tempat
--   ORDER BY jumlah_listing DESC LIMIT 30;

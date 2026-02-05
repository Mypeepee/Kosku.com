-- CreateEnum
CREATE TYPE "peran_enum" AS ENUM ('USER', 'AGENT');

-- CreateEnum
CREATE TYPE "status_akun_enum" AS ENUM ('AKTIF', 'NONAKTIF', 'DIBEKUKAN');

-- CreateEnum
CREATE TYPE "jabatan_agent_enum" AS ENUM ('PRINCIPAL', 'STOKER', 'ADMIN', 'OWNER', 'AGENT', 'TEAMLEADER');

-- CreateEnum
CREATE TYPE "jenis_transaksi_enum" AS ENUM ('PRIMARY', 'SECONDARY', 'LELANG', 'SEWA');

-- CreateEnum
CREATE TYPE "kategori_properti_enum" AS ENUM ('RUMAH', 'APARTEMEN', 'RUKO', 'TANAH', 'GUDANG', 'HOTEL_DAN_VILLA', 'TOKO', 'PABRIK');

-- CreateEnum
CREATE TYPE "sertifikat_enum" AS ENUM ('SHM', 'HGB', 'HGU', 'HP', 'STRATA_TITLE', 'PPJB', 'AJB', 'LAINNYA');

-- CreateEnum
CREATE TYPE "status_agent_enum" AS ENUM ('PENDING', 'AKTIF', 'SUSPEND');

-- CreateEnum
CREATE TYPE "status_properti_enum" AS ENUM ('TERSEDIA', 'TERJUAL', 'TARIK_LISTING');

-- CreateEnum
CREATE TYPE "status_berita_enum" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "status_penukaran_enum" AS ENUM ('PENDING', 'DIPROSES', 'DIKIRIM', 'SELESAI', 'DITOLAK', 'DIBATALKAN');

-- CreateEnum
CREATE TYPE "tipe_poin_enum" AS ENUM ('DAPAT', 'PAKAI');

-- CreateEnum
CREATE TYPE "tipe_acara_enum" AS ENUM ('BUYER_MEETING', 'SITE_VISIT', 'CLOSING', 'FOLLOW_UP', 'OPEN_HOUSE', 'INTERNAL_MEETING', 'TRAINING', 'PEMILU', 'LAINNYA');

-- CreateEnum
CREATE TYPE "status_acara_enum" AS ENUM ('DRAFT', 'PUBLISHED', 'OPEN_REGISTRATION', 'REGISTRATION_CLOSED', 'SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "status_peserta_enum" AS ENUM ('TERDAFTAR', 'MENUNGGU_GILIRAN', 'SEDANG_MEMILIH', 'SUDAH_MEMILIH', 'DISKUALIFIKASI', 'SKIP');

-- CreateTable
CREATE TABLE "pengguna" (
    "id_pengguna" VARCHAR(20) NOT NULL DEFAULT ('AC'::text || nextval('pengguna_code_seq'::regclass)),
    "nama_lengkap" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150),
    "nomor_telepon" VARCHAR(20),
    "kata_sandi" VARCHAR(255),
    "google_id" VARCHAR(100),
    "kota_asal" VARCHAR(50),
    "tanggal_lahir" DATE,
    "peran" "peran_enum" NOT NULL DEFAULT 'USER',
    "status_akun" "status_akun_enum" NOT NULL DEFAULT 'AKTIF',
    "wa_terverifikasi" BOOLEAN NOT NULL DEFAULT false,
    "kode_referral" VARCHAR(20),
    "login_terakhir" TIMESTAMPTZ(6),
    "dibuat_pada" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "diperbarui_pada" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pengguna_pkey" PRIMARY KEY ("id_pengguna")
);

-- CreateTable
CREATE TABLE "agent" (
    "id_agent" VARCHAR(20) NOT NULL DEFAULT ('AG'::text || nextval('agent_code_seq'::regclass)),
    "id_pengguna" VARCHAR(20) NOT NULL,
    "nama_kantor" VARCHAR(100) NOT NULL,
    "kota_area" VARCHAR(50) NOT NULL,
    "jabatan" "jabatan_agent_enum" NOT NULL DEFAULT 'AGENT',
    "id_upline" VARCHAR(20),
    "rating" DECIMAL(3,2) DEFAULT 0.00,
    "jumlah_closing" INTEGER NOT NULL DEFAULT 0,
    "total_omset" DECIMAL(18,2) DEFAULT 0,
    "nomor_whatsapp" VARCHAR(20) NOT NULL,
    "poin" INTEGER NOT NULL DEFAULT 0,
    "foto_ktp_url" TEXT,
    "foto_npwp_url" TEXT,
    "foto_profil_url" TEXT,
    "nama_bank" VARCHAR(50),
    "nomor_rekening" VARCHAR(50),
    "atas_nama_rekening" VARCHAR(100),
    "link_instagram" VARCHAR(100),
    "link_tiktok" VARCHAR(100),
    "link_facebook" VARCHAR(100),
    "status_keanggotaan" "status_agent_enum" NOT NULL DEFAULT 'PENDING',
    "tanggal_gabung" DATE DEFAULT CURRENT_DATE,
    "dibuat_pada" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "diperbarui_pada" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_pkey" PRIMARY KEY ("id_agent")
);

-- CreateTable
CREATE TABLE "listing" (
    "id_property" BIGSERIAL NOT NULL,
    "id_agent" VARCHAR(20) NOT NULL,
    "judul" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(300) NOT NULL,
    "deskripsi" TEXT,
    "jenis_transaksi" "jenis_transaksi_enum" NOT NULL,
    "kategori" "kategori_properti_enum" NOT NULL,
    "vendor" VARCHAR(200),
    "status_tayang" "status_properti_enum" NOT NULL DEFAULT 'TERSEDIA',
    "harga" DECIMAL(20,2) NOT NULL,
    "harga_promo" DECIMAL(20,2),
    "tanggal_lelang" TIMESTAMPTZ(6),
    "uang_jaminan" DECIMAL(20,2),
    "nilai_limit_lelang" DECIMAL(20,2),
    "link" VARCHAR(500),
    "alamat_lengkap" VARCHAR(500),
    "provinsi" VARCHAR(355),
    "kota" VARCHAR(355) NOT NULL,
    "kecamatan" VARCHAR(355),
    "kelurahan" VARCHAR(355),
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "luas_tanah" DECIMAL(12,2),
    "luas_bangunan" DECIMAL(12,2),
    "jumlah_lantai" INTEGER NOT NULL DEFAULT 1,
    "kamar_tidur" INTEGER,
    "kamar_mandi" INTEGER,
    "daya_listrik" INTEGER,
    "sumber_air" VARCHAR(50),
    "hadap_bangunan" VARCHAR(20),
    "kondisi_interior" VARCHAR(50),
    "legalitas" "sertifikat_enum",
    "nomor_legalitas" VARCHAR(250),
    "gambar" TEXT,
    "lampiran" TEXT,
    "dilihat" INTEGER NOT NULL DEFAULT 0,
    "wa_click_count" INTEGER NOT NULL DEFAULT 0,
    "is_hot_deal" BOOLEAN NOT NULL DEFAULT false,
    "tanggal_dibuat" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "tanggal_diupdate" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_pkey" PRIMARY KEY ("id_property")
);

-- CreateTable
CREATE TABLE "transaksi" (
    "id" BIGSERIAL NOT NULL,
    "kode_transaksi" VARCHAR(20),
    "id_listing" BIGINT NOT NULL,
    "id_agent" VARCHAR(20) NOT NULL,
    "id_klien" VARCHAR(20),
    "jenis_transaksi" "jenis_transaksi_enum" NOT NULL,
    "tipe_komisi" VARCHAR(50) NOT NULL,
    "harga_deal" BIGINT NOT NULL,
    "harga_promo_deal" BIGINT DEFAULT 0,
    "harga_limit" DECIMAL(20,2),
    "harga_bidding" DECIMAL(20,2),
    "selisih" BIGINT,
    "kenaikan_dari_limit" DECIMAL(10,6),
    "persentase_komisi" DECIMAL(10,6),
    "basis_pendapatan" BIGINT NOT NULL,
    "biaya_baliknama" BIGINT,
    "biaya_pengosongan" BIGINT,
    "royalty_fee" BIGINT NOT NULL DEFAULT 0,
    "cobroke_fee" BIGINT NOT NULL DEFAULT 0,
    "status_transaksi" VARCHAR(50) NOT NULL DEFAULT 'CLOSING',
    "tanggal_transaksi" DATE NOT NULL,
    "rating" INTEGER,
    "comment" VARCHAR(250),
    "catatan" TEXT,
    "dibuat_pada" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diperbarui_pada" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaksi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detail_transaksi" (
    "id" BIGSERIAL NOT NULL,
    "id_transaksi" BIGINT NOT NULL,
    "id_agent" VARCHAR(20) NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "pendapatan" BIGINT NOT NULL,

    CONSTRAINT "detail_transaksi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_boost" (
    "id_boost" BIGSERIAL NOT NULL,
    "id_listing" BIGINT NOT NULL,
    "jenis_boost" VARCHAR(30) NOT NULL,
    "sumber" VARCHAR(30) NOT NULL,
    "tanggal_mulai" TIMESTAMPTZ(6) NOT NULL,
    "tanggal_selesai" TIMESTAMPTZ(6) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    "tanggal_dibuat" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_boost_pkey" PRIMARY KEY ("id_boost")
);

-- CreateTable
CREATE TABLE "berita" (
    "id_berita" BIGSERIAL NOT NULL,
    "id_agent" VARCHAR(20),
    "judul" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(300) NOT NULL,
    "ringkasan" VARCHAR(500),
    "isi_berita" TEXT NOT NULL,
    "gambar_utama" VARCHAR(500),
    "galeri_gambar" TEXT,
    "kategori" VARCHAR(50) NOT NULL,
    "tag" VARCHAR(255),
    "penulis" VARCHAR(100) NOT NULL,
    "sumber_berita" VARCHAR(200),
    "status_publish" "status_berita_enum" NOT NULL DEFAULT 'DRAFT',
    "berita_unggulan" BOOLEAN NOT NULL DEFAULT false,
    "berita_utama" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "share" INTEGER NOT NULL DEFAULT 0,
    "tanggal_publish" TIMESTAMPTZ(6),
    "tanggal_dibuat" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tanggal_diupdate" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "berita_pkey" PRIMARY KEY ("id_berita")
);

-- CreateTable
CREATE TABLE "reward_poin" (
    "id_reward" BIGSERIAL NOT NULL,
    "nama_reward" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(300) NOT NULL,
    "deskripsi" TEXT,
    "gambar_reward" VARCHAR(500),
    "kategori_reward" VARCHAR(50) NOT NULL,
    "poin_dibutuhkan" INTEGER NOT NULL,
    "stok" INTEGER,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "tanggal_dibuat" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tanggal_diupdate" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_poin_pkey" PRIMARY KEY ("id_reward")
);

-- CreateTable
CREATE TABLE "penukaran_poin" (
    "id_penukaran" BIGSERIAL NOT NULL,
    "id_agent" VARCHAR(20) NOT NULL,
    "id_reward" BIGINT NOT NULL,
    "kode_penukaran" VARCHAR(20) NOT NULL,
    "jumlah" INTEGER NOT NULL DEFAULT 1,
    "total_poin" INTEGER NOT NULL,
    "alamat_pengiriman" VARCHAR(500),
    "kota_pengiriman" VARCHAR(100),
    "kode_pos" VARCHAR(10),
    "nomor_telepon" VARCHAR(20),
    "catatan" VARCHAR(500),
    "status_penukaran" "status_penukaran_enum" NOT NULL DEFAULT 'PENDING',
    "nomor_resi" VARCHAR(100),
    "kurir" VARCHAR(50),
    "tanggal_penukaran" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tanggal_diproses" TIMESTAMPTZ(6),
    "tanggal_dikirim" TIMESTAMPTZ(6),
    "tanggal_selesai" TIMESTAMPTZ(6),

    CONSTRAINT "penukaran_poin_pkey" PRIMARY KEY ("id_penukaran")
);

-- CreateTable
CREATE TABLE "riwayat_poin" (
    "id_riwayat" BIGSERIAL NOT NULL,
    "id_agent" VARCHAR(20) NOT NULL,
    "jenis_aktivitas" VARCHAR(100) NOT NULL,
    "deskripsi" VARCHAR(255) NOT NULL,
    "poin" INTEGER NOT NULL,
    "tipe_transaksi" "tipe_poin_enum" NOT NULL,
    "id_referensi" BIGINT,
    "tabel_referensi" VARCHAR(50),
    "saldo_sebelum" INTEGER NOT NULL,
    "saldo_sesudah" INTEGER NOT NULL,
    "tanggal_dibuat" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "riwayat_poin_pkey" PRIMARY KEY ("id_riwayat")
);

-- CreateTable
CREATE TABLE "acara" (
    "id_acara" BIGSERIAL NOT NULL,
    "id_agent" VARCHAR(20),
    "id_property" BIGINT,
    "judul_acara" VARCHAR(255) NOT NULL,
    "deskripsi" TEXT,
    "tipe_acara" "tipe_acara_enum" NOT NULL,
    "tanggal_mulai" TIMESTAMPTZ(6) NOT NULL,
    "tanggal_selesai" TIMESTAMPTZ(6) NOT NULL,
    "lokasi" VARCHAR(255),
    "durasi_pilih" INTEGER,
    "status_acara" "status_acara_enum" NOT NULL DEFAULT 'DRAFT',
    "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "tanggal_dibuat" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tanggal_diupdate" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sudah_dimulai" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "acara_pkey" PRIMARY KEY ("id_acara")
);

-- CreateTable
CREATE TABLE "peserta_acara" (
    "id_peserta" BIGSERIAL NOT NULL,
    "id_acara" BIGINT NOT NULL,
    "id_agent" VARCHAR(20) NOT NULL,
    "nomor_urut" INTEGER,
    "status_peserta" "status_peserta_enum" NOT NULL DEFAULT 'TERDAFTAR',
    "waktu_daftar" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "waktu_mulai_pilih" TIMESTAMPTZ(6),
    "waktu_selesai_pilih" TIMESTAMPTZ(6),
    "sisa_waktu" INTEGER,

    CONSTRAINT "peserta_acara_pkey" PRIMARY KEY ("id_peserta")
);

-- CreateTable
CREATE TABLE "pilihan_pemilu" (
    "id_pilihan" SERIAL NOT NULL,
    "id_acara" BIGINT NOT NULL,
    "id_agent" VARCHAR(20) NOT NULL,
    "id_listing" BIGINT NOT NULL,

    CONSTRAINT "pilihan_pemilu_pkey" PRIMARY KEY ("id_acara","id_pilihan")
);

-- CreateTable
CREATE TABLE "account" (
    "id_account" VARCHAR(50),
    "username" VARCHAR(50),
    "email" VARCHAR(100),
    "nama" VARCHAR(100),
    "tanggal_lahir" DATE,
    "password" VARCHAR(255),
    "kota" VARCHAR(100),
    "kecamatan" VARCHAR(100),
    "nomor_telepon" VARCHAR(15),
    "roles" VARCHAR(255),
    "tanggal_dibuat" TIMESTAMP(0),
    "tanggal_diupdate" TIMESTAMP(0),
    "kode_referal" VARCHAR(10),
    "provinsi" VARCHAR(100)
);

-- CreateTable
CREATE TABLE "agent_tampungan" (
    "id_account" VARCHAR(50) NOT NULL,
    "username" VARCHAR(50),
    "email" VARCHAR(100) NOT NULL,
    "nama" VARCHAR(100) NOT NULL,
    "tanggal_lahir" DATE,
    "password" VARCHAR(255),
    "kota" VARCHAR(100),
    "kecamatan" VARCHAR(100),
    "nomor_telepon" VARCHAR(15) NOT NULL,
    "roles" VARCHAR(255) NOT NULL DEFAULT 'User',
    "tanggal_dibuat" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tanggal_diupdate" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kode_referal" VARCHAR(10),
    "provinsi" VARCHAR(100),
    "id_agent" VARCHAR(50),
    "instagram" VARCHAR(50),
    "facebook" VARCHAR(50),
    "tanggal_join" VARCHAR(50),
    "picture" VARCHAR(50),
    "status" VARCHAR(50),
    "rating" INTEGER,
    "comment" VARCHAR(50),
    "jumlah_penjualan" INTEGER,
    "lokasi_kerja" VARCHAR(50),
    "gambar_ktp" VARCHAR(50),
    "gambar_npwp" VARCHAR(50),
    "upline_id" VARCHAR(50),

    CONSTRAINT "agent_tampungan_pkey" PRIMARY KEY ("id_account")
);

-- CreateTable
CREATE TABLE "mapping_agent" (
    "id_agent_lama" VARCHAR(50) NOT NULL,
    "id_agent_baru" VARCHAR(20) NOT NULL,

    CONSTRAINT "mapping_agent_pkey" PRIMARY KEY ("id_agent_lama")
);

-- CreateTable
CREATE TABLE "mapping_pengguna" (
    "id_account_lama" VARCHAR(50) NOT NULL,
    "id_pengguna_baru" VARCHAR(20) NOT NULL,

    CONSTRAINT "mapping_pengguna_pkey" PRIMARY KEY ("id_account_lama")
);

-- CreateTable
CREATE TABLE "property_tampungan" (
    "id_listing" BIGSERIAL NOT NULL,
    "id_agent" VARCHAR(50),
    "vendor" VARCHAR(200),
    "judul" VARCHAR(255),
    "deskripsi" VARCHAR(3000),
    "tipe" VARCHAR(15),
    "harga" BIGINT,
    "lokasi" VARCHAR(1000),
    "luas" BIGINT,
    "provinsi" VARCHAR(355),
    "kota" VARCHAR(350),
    "kecamatan" VARCHAR(200),
    "kelurahan" VARCHAR(200),
    "sertifikat" VARCHAR(370),
    "status" VARCHAR(20),
    "gambar" VARCHAR(1500),
    "payment" VARCHAR(20),
    "uang_jaminan" BIGINT,
    "batas_akhir_jaminan" DATE,
    "batas_akhir_penawaran" DATE,
    "tanggal_buyer_meeting" DATE,
    "tanggal_dibuat" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tanggal_diupdate" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "link" VARCHAR(500),
    "exported" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "property_tampungan_pkey" PRIMARY KEY ("id_listing")
);

-- CreateIndex
CREATE UNIQUE INDEX "pengguna_email_key" ON "pengguna"("email");

-- CreateIndex
CREATE UNIQUE INDEX "pengguna_nomor_telepon_key" ON "pengguna"("nomor_telepon");

-- CreateIndex
CREATE UNIQUE INDEX "pengguna_google_id_key" ON "pengguna"("google_id");

-- CreateIndex
CREATE INDEX "idx_kode_referral" ON "pengguna"("kode_referral");

-- CreateIndex
CREATE INDEX "idx_pengguna_email" ON "pengguna"("email");

-- CreateIndex
CREATE UNIQUE INDEX "agent_id_pengguna_unique" ON "agent"("id_pengguna");

-- CreateIndex
CREATE INDEX "idx_agent_jabatan" ON "agent"("jabatan");

-- CreateIndex
CREATE INDEX "idx_agent_kantor" ON "agent"("nama_kantor");

-- CreateIndex
CREATE UNIQUE INDEX "listing_slug_key" ON "listing"("slug");

-- CreateIndex
CREATE INDEX "idx_property_lokasi" ON "listing"("kota");

-- CreateIndex
CREATE INDEX "idx_property_jenis" ON "listing"("jenis_transaksi");

-- CreateIndex
CREATE INDEX "idx_property_agent" ON "listing"("id_agent");

-- CreateIndex
CREATE INDEX "idx_property_slug" ON "listing"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "transaksi_kode_transaksi_key" ON "transaksi"("kode_transaksi");

-- CreateIndex
CREATE INDEX "transaksi_agent_idx" ON "transaksi"("id_agent");

-- CreateIndex
CREATE INDEX "transaksi_listing_idx" ON "transaksi"("id_listing");

-- CreateIndex
CREATE INDEX "transaksi_date_idx" ON "transaksi"("tanggal_transaksi");

-- CreateIndex
CREATE INDEX "detail_transaksi_agent_idx" ON "detail_transaksi"("id_agent");

-- CreateIndex
CREATE INDEX "detail_transaksi_trans_idx" ON "detail_transaksi"("id_transaksi");

-- CreateIndex
CREATE UNIQUE INDEX "detail_transaksi_unique_per_role" ON "detail_transaksi"("id_transaksi", "id_agent", "role");

-- CreateIndex
CREATE INDEX "listing_boost_listing_idx" ON "listing_boost"("id_listing");

-- CreateIndex
CREATE INDEX "listing_boost_status_idx" ON "listing_boost"("status");

-- CreateIndex
CREATE INDEX "listing_boost_time_idx" ON "listing_boost"("tanggal_mulai", "tanggal_selesai");

-- CreateIndex
CREATE UNIQUE INDEX "berita_slug_key" ON "berita"("slug");

-- CreateIndex
CREATE INDEX "idx_berita_slug" ON "berita"("slug");

-- CreateIndex
CREATE INDEX "idx_berita_kategori" ON "berita"("kategori");

-- CreateIndex
CREATE INDEX "idx_berita_status" ON "berita"("status_publish");

-- CreateIndex
CREATE INDEX "idx_berita_tanggal" ON "berita"("tanggal_publish");

-- CreateIndex
CREATE UNIQUE INDEX "reward_poin_slug_key" ON "reward_poin"("slug");

-- CreateIndex
CREATE INDEX "idx_reward_kategori" ON "reward_poin"("kategori_reward");

-- CreateIndex
CREATE INDEX "idx_reward_aktif" ON "reward_poin"("aktif");

-- CreateIndex
CREATE UNIQUE INDEX "penukaran_poin_kode_penukaran_key" ON "penukaran_poin"("kode_penukaran");

-- CreateIndex
CREATE INDEX "idx_penukaran_agent" ON "penukaran_poin"("id_agent");

-- CreateIndex
CREATE INDEX "idx_penukaran_kode" ON "penukaran_poin"("kode_penukaran");

-- CreateIndex
CREATE INDEX "idx_penukaran_status" ON "penukaran_poin"("status_penukaran");

-- CreateIndex
CREATE INDEX "idx_penukaran_tanggal" ON "penukaran_poin"("tanggal_penukaran");

-- CreateIndex
CREATE INDEX "idx_riwayat_agent" ON "riwayat_poin"("id_agent");

-- CreateIndex
CREATE INDEX "idx_riwayat_tipe" ON "riwayat_poin"("tipe_transaksi");

-- CreateIndex
CREATE INDEX "idx_riwayat_tanggal" ON "riwayat_poin"("tanggal_dibuat");

-- CreateIndex
CREATE INDEX "idx_acara_agent" ON "acara"("id_agent");

-- CreateIndex
CREATE INDEX "idx_acara_tipe" ON "acara"("tipe_acara");

-- CreateIndex
CREATE INDEX "idx_acara_tanggal" ON "acara"("tanggal_mulai");

-- CreateIndex
CREATE INDEX "idx_acara_status" ON "acara"("status_acara");

-- CreateIndex
CREATE INDEX "idx_peserta_acara" ON "peserta_acara"("id_acara");

-- CreateIndex
CREATE INDEX "idx_peserta_urut" ON "peserta_acara"("nomor_urut");

-- CreateIndex
CREATE INDEX "idx_peserta_status" ON "peserta_acara"("status_peserta");

-- CreateIndex
CREATE UNIQUE INDEX "peserta_acara_id_acara_id_agent_key" ON "peserta_acara"("id_acara", "id_agent");

-- CreateIndex
CREATE INDEX "idx_pilihan_acara" ON "pilihan_pemilu"("id_acara");

-- CreateIndex
CREATE INDEX "idx_pilihan_agent" ON "pilihan_pemilu"("id_agent");

-- CreateIndex
CREATE UNIQUE INDEX "pilihan_pemilu_id_acara_id_listing_key" ON "pilihan_pemilu"("id_acara", "id_listing");

-- CreateIndex
CREATE UNIQUE INDEX "agent_tampungan_email_unique" ON "agent_tampungan"("email");

-- AddForeignKey
ALTER TABLE "agent" ADD CONSTRAINT "agent_id_pengguna_fkey" FOREIGN KEY ("id_pengguna") REFERENCES "pengguna"("id_pengguna") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent" ADD CONSTRAINT "agent_id_upline_fkey" FOREIGN KEY ("id_upline") REFERENCES "agent"("id_agent") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing" ADD CONSTRAINT "listing_id_agent_fkey" FOREIGN KEY ("id_agent") REFERENCES "agent"("id_agent") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaksi" ADD CONSTRAINT "transaksi_agent_fk" FOREIGN KEY ("id_agent") REFERENCES "agent"("id_agent") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaksi" ADD CONSTRAINT "transaksi_klien_fk" FOREIGN KEY ("id_klien") REFERENCES "pengguna"("id_pengguna") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaksi" ADD CONSTRAINT "transaksi_listing_fk" FOREIGN KEY ("id_listing") REFERENCES "listing"("id_property") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_transaksi" ADD CONSTRAINT "detail_transaksi_agent_fk" FOREIGN KEY ("id_agent") REFERENCES "agent"("id_agent") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_transaksi" ADD CONSTRAINT "detail_transaksi_trans_fk" FOREIGN KEY ("id_transaksi") REFERENCES "transaksi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_boost" ADD CONSTRAINT "listing_boost_listing_fk" FOREIGN KEY ("id_listing") REFERENCES "listing"("id_property") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "berita" ADD CONSTRAINT "berita_id_agent_fkey" FOREIGN KEY ("id_agent") REFERENCES "agent"("id_agent") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penukaran_poin" ADD CONSTRAINT "penukaran_poin_id_agent_fkey" FOREIGN KEY ("id_agent") REFERENCES "agent"("id_agent") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penukaran_poin" ADD CONSTRAINT "penukaran_poin_id_reward_fkey" FOREIGN KEY ("id_reward") REFERENCES "reward_poin"("id_reward") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_poin" ADD CONSTRAINT "riwayat_poin_id_agent_fkey" FOREIGN KEY ("id_agent") REFERENCES "agent"("id_agent") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acara" ADD CONSTRAINT "acara_id_agent_fkey" FOREIGN KEY ("id_agent") REFERENCES "agent"("id_agent") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acara" ADD CONSTRAINT "acara_id_property_fkey" FOREIGN KEY ("id_property") REFERENCES "listing"("id_property") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peserta_acara" ADD CONSTRAINT "peserta_acara_id_acara_fkey" FOREIGN KEY ("id_acara") REFERENCES "acara"("id_acara") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peserta_acara" ADD CONSTRAINT "peserta_acara_id_agent_fkey" FOREIGN KEY ("id_agent") REFERENCES "agent"("id_agent") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pilihan_pemilu" ADD CONSTRAINT "pilihan_pemilu_id_acara_fkey" FOREIGN KEY ("id_acara") REFERENCES "acara"("id_acara") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pilihan_pemilu" ADD CONSTRAINT "pilihan_pemilu_id_agent_fkey" FOREIGN KEY ("id_agent") REFERENCES "agent"("id_agent") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pilihan_pemilu" ADD CONSTRAINT "pilihan_pemilu_id_listing_fkey" FOREIGN KEY ("id_listing") REFERENCES "listing"("id_property") ON DELETE RESTRICT ON UPDATE CASCADE;

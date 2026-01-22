-- CreateEnum
CREATE TYPE "peran_enum" AS ENUM ('USER', 'AGENT');

-- CreateEnum
CREATE TYPE "status_akun_enum" AS ENUM ('AKTIF', 'NONAKTIF', 'DIBEKUKAN');

-- CreateEnum
CREATE TYPE "gender_enum" AS ENUM ('LAKI_LAKI', 'PEREMPUAN');

-- CreateEnum
CREATE TYPE "jabatan_agent_enum" AS ENUM ('PRINCIPAL', 'STOKER', 'HOM', 'ADMIN', 'OWNER', 'AGENT', 'TEAMLEADER');

-- CreateEnum
CREATE TYPE "jenis_transaksi_enum" AS ENUM ('PRIMARY', 'SECONDARY', 'LELANG', 'SEWA');

-- CreateEnum
CREATE TYPE "kategori_properti_enum" AS ENUM ('RUMAH', 'APARTEMEN', 'RUKO', 'TANAH', 'GUDANG', 'HOTEL_DAN_VILLA', 'TOKO', 'PABRIK');

-- CreateEnum
CREATE TYPE "sertifikat_enum" AS ENUM ('SHM', 'HGB', 'HGU', 'HP', 'STRATA_TITLE', 'PPJB', 'AJB', 'LAINNYA');

-- CreateEnum
CREATE TYPE "status_agent_enum" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'RESIGNED');

-- CreateEnum
CREATE TYPE "status_properti_enum" AS ENUM ('TERSEDIA', 'TERJUAL', 'TARIK_LISTING');

-- CreateTable
CREATE TABLE "pengguna" (
    "id_pengguna" VARCHAR(20) NOT NULL,
    "nama_lengkap" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150),
    "nomor_telepon" VARCHAR(20),
    "kata_sandi" VARCHAR(255),
    "google_id" VARCHAR(100),
    "kota_asal" VARCHAR(50),
    "tanggal_lahir" DATE,
    "jenis_kelamin" "gender_enum",
    "foto_profil_url" TEXT,
    "peran" "peran_enum" DEFAULT 'USER',
    "status_akun" "status_akun_enum" DEFAULT 'AKTIF',
    "wa_terverifikasi" BOOLEAN DEFAULT false,
    "kode_referral" VARCHAR(20),
    "login_terakhir" TIMESTAMP(6),
    "dibuat_pada" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "diperbarui_pada" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pengguna_pkey" PRIMARY KEY ("id_pengguna")
);

-- CreateTable
CREATE TABLE "agent" (
    "id_agent" VARCHAR(20) NOT NULL,
    "id_pengguna" VARCHAR(20) NOT NULL,
    "nama_kantor" VARCHAR(100) NOT NULL,
    "kota_area" VARCHAR(50) NOT NULL,
    "jabatan" "jabatan_agent_enum" DEFAULT 'AGENT',
    "id_upline" VARCHAR(20),
    "rating" DECIMAL(3,2) DEFAULT 0.00,
    "jumlah_closing" INTEGER DEFAULT 0,
    "total_omset" DECIMAL(18,2) DEFAULT 0,
    "nomor_whatsapp" VARCHAR(20) NOT NULL,
    "foto_ktp_url" TEXT,
    "foto_npwp_url" TEXT,
    "nama_bank" VARCHAR(50),
    "nomor_rekening" VARCHAR(50),
    "atas_nama_rekening" VARCHAR(100),
    "link_instagram" VARCHAR(100),
    "link_tiktok" VARCHAR(100),
    "status_keanggotaan" "status_agent_enum" DEFAULT 'PENDING',
    "tanggal_gabung" DATE DEFAULT CURRENT_DATE,
    "diperbarui_pada" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_pkey" PRIMARY KEY ("id_agent")
);

-- CreateTable
CREATE TABLE "property" (
    "id_property" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_agent" VARCHAR(20) NOT NULL,
    "kode_properti" VARCHAR(20) NOT NULL DEFAULT ('LST'::text || lpad((nextval('property_code_seq'::regclass))::text, 5, '0'::text)),
    "judul" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(300) NOT NULL,
    "deskripsi" TEXT,
    "jenis_transaksi" "jenis_transaksi_enum" NOT NULL,
    "kategori" "kategori_properti_enum" NOT NULL,
    "status_tayang" "status_properti_enum" DEFAULT 'TERSEDIA',
    "harga" DECIMAL(18,2) NOT NULL,
    "harga_promo" DECIMAL(18,2),
    "tanggal_lelang" TIMESTAMP(6),
    "uang_jaminan" DECIMAL(18,2),
    "nilai_limit_lelang" DECIMAL(18,2),
    "link" VARCHAR(500),
    "alamat_lengkap" VARCHAR(500),
    "area_lokasi" VARCHAR(100),
    "provinsi" VARCHAR(100),
    "kota" VARCHAR(100) NOT NULL,
    "kecamatan" VARCHAR(100),
    "kelurahan" VARCHAR(100),
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "luas_tanah" DECIMAL(10,2),
    "luas_bangunan" DECIMAL(10,2),
    "jumlah_lantai" INTEGER DEFAULT 1,
    "kamar_tidur" INTEGER,
    "kamar_mandi" INTEGER,
    "daya_listrik" INTEGER,
    "sumber_air" VARCHAR(50),
    "hadap_bangunan" VARCHAR(20),
    "kondisi_interior" VARCHAR(50),
    "legalitas" "sertifikat_enum",
    "gambar_utama_url" TEXT,
    "dilihat" INTEGER DEFAULT 0,
    "is_hot_deal" BOOLEAN DEFAULT false,
    "tanggal_dibuat" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "tanggal_diupdate" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_pkey" PRIMARY KEY ("id_property")
);

-- CreateTable
CREATE TABLE "property_photo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "urutan" INTEGER DEFAULT 0,

    CONSTRAINT "property_photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pengguna_email_key" ON "pengguna"("email");

-- CreateIndex
CREATE UNIQUE INDEX "pengguna_nomor_telepon_key" ON "pengguna"("nomor_telepon");

-- CreateIndex
CREATE UNIQUE INDEX "pengguna_google_id_key" ON "pengguna"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "pengguna_kode_referral_key" ON "pengguna"("kode_referral");

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
CREATE UNIQUE INDEX "property_kode_properti_key" ON "property"("kode_properti");

-- CreateIndex
CREATE UNIQUE INDEX "property_slug_key" ON "property"("slug");

-- CreateIndex
CREATE INDEX "idx_property_agent" ON "property"("id_agent");

-- CreateIndex
CREATE INDEX "idx_property_jenis" ON "property"("jenis_transaksi");

-- CreateIndex
CREATE INDEX "idx_property_lokasi" ON "property"("kota");

-- CreateIndex
CREATE INDEX "idx_property_slug" ON "property"("slug");

-- CreateIndex
CREATE INDEX "idx_property_photo_property" ON "property_photo"("property_id");

-- AddForeignKey
ALTER TABLE "agent" ADD CONSTRAINT "agent_id_pengguna_fkey" FOREIGN KEY ("id_pengguna") REFERENCES "pengguna"("id_pengguna") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "agent" ADD CONSTRAINT "agent_id_upline_fkey" FOREIGN KEY ("id_upline") REFERENCES "agent"("id_agent") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "property" ADD CONSTRAINT "property_id_agent_fkey" FOREIGN KEY ("id_agent") REFERENCES "agent"("id_agent") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_photo" ADD CONSTRAINT "property_photo_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id_property") ON DELETE CASCADE ON UPDATE CASCADE;

export type JenisTransaksi = 'PRIMARY' | 'SECONDARY' | 'LELANG' | 'SEWA';
export type KategoriProperti = 'RUMAH' | 'APARTEMEN' | 'RUKO' | 'TANAH' | 'GUDANG' | 'HOTEL_DAN_VILLA' | 'TOKO' | 'PABRIK' | 'KOS';
export type DurasiSewa = 'HARIAN' | 'MINGGUAN' | 'BULANAN' | 'TAHUNAN';
export type TipeUnit = 'STUDIO' | 'SATU_KAMAR' | 'DUA_KAMAR' | 'TIGA_KAMAR' | 'EMPAT_KAMAR_PLUS';
export type BiayaPeriode = 'SEKALI' | 'BULANAN' | 'TAHUNAN';
export type KosGender = 'PUTRA' | 'PUTRI' | 'CAMPUR';
export type KamarMandiTipe = 'DALAM' | 'LUAR';
export type StatusProperti = 'TERSEDIA' | 'TERJUAL' | 'TARIK_LISTING';
export type Sertifikat = 'SHM' | 'HGB' | 'HGU' | 'HP' | 'STRATA_TITLE' | 'PPJB' | 'AJB' | 'LAINNYA';

export interface ImageFile {
  id: string;
  file: File;
  preview: string;
  uploaded?: boolean;
}

export const JENIS_TRANSAKSI_OPTIONS: { value: JenisTransaksi; label: string; icon: string }[] = [
  { value: 'PRIMARY', label: 'Primary', icon: '🏗️' },
  { value: 'SECONDARY', label: 'Secondary', icon: '🏘️' },
  { value: 'LELANG', label: 'Lelang', icon: '⚖️' },
  { value: 'SEWA', label: 'Sewa', icon: '🔑' },
];

export const KATEGORI_OPTIONS: { value: KategoriProperti; label: string; icon: string }[] = [
  { value: 'RUMAH', label: 'Rumah', icon: '🏠' },
  { value: 'APARTEMEN', label: 'Apartemen', icon: '🏢' },
  { value: 'RUKO', label: 'Ruko', icon: '🏪' },
  { value: 'TANAH', label: 'Tanah', icon: '🏞️' },
  { value: 'GUDANG', label: 'Gudang', icon: '🏭' },
  { value: 'HOTEL_DAN_VILLA', label: 'Hotel & Villa', icon: '🏨' },
  { value: 'TOKO', label: 'Toko', icon: '🏬' },
  { value: 'PABRIK', label: 'Pabrik', icon: '🏗️' },
  { value: 'KOS', label: 'Kos', icon: '🛏️' },
];

/**
 * Kategori yang masuk akal untuk tiap jenis transaksi.
 *
 * KOS hanya ada di SEWA — "kos dijual" sebagai kategori tidak punya arti di
 * sistem ini: seluruh isian kos (tipe kamar, sisa kamar, gender penghuni,
 * harga per durasi) hidup di listing_sewa_detail, yang cuma dibuat untuk
 * transaksi SEWA. Membiarkan KOS bisa dipilih di PRIMARY/SECONDARY/LELANG
 * menghasilkan listing yang lolos form tapi kehilangan seluruh detailnya saat
 * disimpan. Gedung kos yang benar-benar DIJUAL tetap bisa didaftarkan sebagai
 * RUMAH dengan judul "Rumah Kos 12 Kamar …".
 */
export function kategoriUntukTransaksi(
  jenis: JenisTransaksi | undefined | null,
): { value: KategoriProperti; label: string; icon: string }[] {
  return KATEGORI_OPTIONS.filter((k) => k.value !== 'KOS' || jenis === 'SEWA');
}

/** Kategori yang tidak lagi valid setelah jenis transaksi berubah. */
export function kategoriMasihValid(
  kategori: KategoriProperti | undefined | null,
  jenis: JenisTransaksi | undefined | null,
): boolean {
  if (!kategori) return true;
  return kategoriUntukTransaksi(jenis).some((k) => k.value === kategori);
}

/**
 * Tipe unit apartemen — filter nomor satu di Travelio/Jendela360, dan cara
 * penyewa apartemen menyebut kebutuhannya ("cari 2BR di Surabaya Barat").
 * Nilai enum tidak diawali angka karena identifier Postgres yang diawali
 * angka harus dikutip; labelnya yang menyebut istilah pasar (1BR, 2BR).
 */
export const TIPE_UNIT_OPTIONS: {
  value: TipeUnit;
  label: string;
  desc: string;
  kamarTidur: number;
}[] = [
  { value: 'STUDIO', label: 'Studio', desc: 'Tanpa sekat kamar tidur', kamarTidur: 0 },
  { value: 'SATU_KAMAR', label: '1BR', desc: '1 kamar tidur', kamarTidur: 1 },
  { value: 'DUA_KAMAR', label: '2BR', desc: '2 kamar tidur', kamarTidur: 2 },
  { value: 'TIGA_KAMAR', label: '3BR', desc: '3 kamar tidur', kamarTidur: 3 },
  { value: 'EMPAT_KAMAR_PLUS', label: '4BR+', desc: '4 kamar tidur atau lebih', kamarTidur: 4 },
];

export const TIPE_UNIT_LABEL: Record<TipeUnit, string> = Object.fromEntries(
  TIPE_UNIT_OPTIONS.map((t) => [t.value, t.label]),
) as Record<TipeUnit, string>;

/**
 * Biaya di luar harga sewa & deposit.
 *
 * Keluhan paling sering penyewa kos/apartemen: angka di iklan bukan angka yang
 * dibayar — listrik, air, wifi & kebersihan baru disebut saat survei. Karena
 * disimpan terstruktur (nama + nominal + periode, bukan satu paragraf teks),
 * biayanya bisa dijumlahkan jadi estimasi tagihan bulan pertama di halaman
 * detail, dan tidak ada lagi kejutan di ujung.
 */
export interface BiayaTambahan {
  nama: string;
  nominal?: number | null;
  periode: BiayaPeriode;
}

export const BIAYA_PERIODE_OPTIONS: { value: BiayaPeriode; label: string; suffix: string }[] = [
  { value: 'BULANAN', label: 'Per bulan', suffix: '/bulan' },
  { value: 'TAHUNAN', label: 'Per tahun', suffix: '/tahun' },
  { value: 'SEKALI', label: 'Sekali bayar', suffix: 'sekali' },
];

export const BIAYA_PERIODE_SUFFIX: Record<BiayaPeriode, string> = Object.fromEntries(
  BIAYA_PERIODE_OPTIONS.map((p) => [p.value, p.suffix]),
) as Record<BiayaPeriode, string>;

/** Batas jumlah baris biaya — di atas ini isinya jadi daftar belanja, bukan ringkasan. */
export const MAKS_BIAYA_TAMBAHAN = 8;

/**
 * Preset biaya yang paling sering ada. Urutannya mengikuti yang paling umum
 * ditagih terpisah di kos/apartemen Indonesia (mengikuti daftar Mamikos).
 */
export const BIAYA_TAMBAHAN_PRESET: {
  nama: string;
  icon: string;
  periode: BiayaPeriode;
}[] = [
  { nama: 'Listrik', icon: 'mdi:flash', periode: 'BULANAN' },
  { nama: 'Air', icon: 'mdi:water', periode: 'BULANAN' },
  { nama: 'WiFi', icon: 'mdi:wifi', periode: 'BULANAN' },
  { nama: 'Kebersihan', icon: 'mdi:broom', periode: 'BULANAN' },
  { nama: 'Laundry', icon: 'mdi:tshirt-crew', periode: 'BULANAN' },
  { nama: 'Parkir', icon: 'mdi:car', periode: 'BULANAN' },
  { nama: 'IPL / Service Charge', icon: 'mdi:office-building-cog', periode: 'BULANAN' },
  { nama: 'Biaya Kunci / Administrasi', icon: 'mdi:key-variant', periode: 'SEKALI' },
];

export const DURASI_SEWA_OPTIONS: { value: DurasiSewa; label: string; suffix: string }[] = [
  { value: 'HARIAN', label: 'Harian', suffix: '/hari' },
  { value: 'MINGGUAN', label: 'Mingguan', suffix: '/minggu' },
  { value: 'BULANAN', label: 'Bulanan', suffix: '/bulan' },
  { value: 'TAHUNAN', label: 'Tahunan', suffix: '/tahun' },
];

/** Nama field form untuk harga per-durasi. */
export const DURASI_SEWA_FIELD_MAP: Record<
  DurasiSewa,
  'harga_sewa_harian' | 'harga_sewa_mingguan' | 'harga_sewa_bulanan' | 'harga_sewa_tahunan'
> = {
  HARIAN: 'harga_sewa_harian',
  MINGGUAN: 'harga_sewa_mingguan',
  BULANAN: 'harga_sewa_bulanan',
  TAHUNAN: 'harga_sewa_tahunan',
};

/** Urutan prioritas jadi "harga utama" otomatis kalau agent belum pilih manual. */
export const DURASI_PRIORITY: DurasiSewa[] = ['BULANAN', 'TAHUNAN', 'MINGGUAN', 'HARIAN'];

/**
 * Peringkat durasi dari terpendek ke terpanjang. Dipakai untuk cascade minimal
 * sewa: kalau minimal sewa = TAHUNAN, durasi yg lebih pendek (bulanan/mingguan/
 * harian) otomatis dinonaktifkan — mustahil menawarkan sewa harian kalau
 * komitmen minimalnya 1 tahun.
 */
export const DURASI_RANK: Record<DurasiSewa, number> = {
  HARIAN: 0,
  MINGGUAN: 1,
  BULANAN: 2,
  TAHUNAN: 3,
};

/** Satuan minimal sewa dalam bentuk kata benda ("1 Tahun", bukan "1 Tahunan"). */
export const DURASI_SATUAN_LABEL: Record<DurasiSewa, string> = {
  HARIAN: 'Hari',
  MINGGUAN: 'Minggu',
  BULANAN: 'Bulan',
  TAHUNAN: 'Tahun',
};

/**
 * Peruntukan penghuni kos.
 *
 * Ikonnya sengaja sama persis dengan yang dipakai card & halaman detail
 * (`src/lib/kosCard.ts`) — pilihan yang dilihat agent saat mengisi harus
 * berwujud sama dengan yang dilihat penyewa nanti, kalau tidak agent tidak
 * pernah tahu bagaimana pilihannya benar-benar tampil.
 *
 * `warna` bukan sekadar hiasan: tiga pilihan ini setara & saling eksklusif,
 * dan warna adalah cara tercepat memastikan yang terpilih memang yang
 * dimaksud, tanpa harus membaca ulang labelnya. Nilainya ditulis lengkap
 * (bukan dirakit `text-${x}-300`) supaya pasti ikut digenerate Tailwind.
 */
export const KOS_GENDER_OPTIONS: {
  value: KosGender;
  label: string;
  desc: string;
  icon: string;
  warna: { teks: string; kotak: string; panel: string };
}[] = [
  {
    value: 'PUTRA',
    label: 'Kos Putra',
    desc: 'Khusus penghuni laki-laki',
    icon: 'solar:men-bold-duotone',
    warna: {
      teks: 'text-sky-300',
      kotak: 'border-sky-400/40 bg-sky-400/15 text-sky-300',
      panel: 'border-sky-400/50 bg-sky-400/[0.09]',
    },
  },
  {
    value: 'PUTRI',
    label: 'Kos Putri',
    desc: 'Khusus penghuni perempuan',
    icon: 'solar:women-bold-duotone',
    warna: {
      teks: 'text-pink-300',
      kotak: 'border-pink-400/40 bg-pink-400/15 text-pink-300',
      panel: 'border-pink-400/50 bg-pink-400/[0.09]',
    },
  },
  {
    value: 'CAMPUR',
    label: 'Kos Campur',
    desc: 'Putra & putri dalam satu gedung',
    icon: 'solar:users-group-rounded-bold-duotone',
    warna: {
      teks: 'text-violet-300',
      kotak: 'border-violet-400/40 bg-violet-400/15 text-violet-300',
      panel: 'border-violet-400/50 bg-violet-400/[0.09]',
    },
  },
];

export const KAMAR_MANDI_TIPE_OPTIONS: { value: KamarMandiTipe; label: string }[] = [
  { value: 'DALAM', label: 'Dalam' },
  { value: 'LUAR', label: 'Luar' },
];

/**
 * Preset tipe kamar — pembeda paling sering antar kamar dalam satu kos adalah
 * jenis kamar mandinya, jadi dua preset teratas langsung mengisi field itu.
 * Preset hanya mempercepat pembuatan baris; semua isinya tetap bisa diubah.
 */
export interface KamarTipePreset {
  nama: string;
  desc: string;
  icon: string;
  kamar_mandi_tipe?: KamarMandiTipe;
}

export const KAMAR_TIPE_PRESET: KamarTipePreset[] = [
  {
    nama: 'Kamar Mandi Dalam',
    desc: 'Kamar mandi pribadi di dalam kamar',
    icon: 'solar:bath-bold-duotone',
    kamar_mandi_tipe: 'DALAM',
  },
  {
    nama: 'Kamar Mandi Luar',
    desc: 'Kamar mandi bersama di luar kamar',
    icon: 'mdi:shower',
    kamar_mandi_tipe: 'LUAR',
  },
  {
    nama: 'Tipe Standar',
    desc: 'Kamar ukuran paling umum di kos ini',
    icon: 'solar:bed-bold-duotone',
  },
  {
    nama: 'Tipe Luas',
    desc: 'Kamar yang lebih besar / sudut',
    icon: 'solar:scale-bold-duotone',
  },
];

// ============================================================
// Patokan / akses terdekat
// ============================================================

export type AksesTipe =
  | 'KAMPUS'
  | 'SEKOLAH'
  | 'STASIUN'
  | 'HALTE'
  | 'BANDARA'
  | 'MALL'
  | 'PASAR'
  | 'RUMAH_SAKIT'
  | 'PERKANTORAN'
  | 'MASJID'
  | 'MINIMARKET'
  | 'LAINNYA';

export type AksesSatuan = 'MENIT' | 'KM';

export interface AksesTerdekat {
  tipe: AksesTipe;
  nama: string;
  jarak?: number | null;
  satuan?: AksesSatuan | null;
}

export const AKSES_TIPE_OPTIONS: { value: AksesTipe; label: string; icon: string }[] = [
  { value: 'KAMPUS', label: 'Kampus', icon: 'mdi:school' },
  { value: 'SEKOLAH', label: 'Sekolah', icon: 'mdi:book-education' },
  { value: 'STASIUN', label: 'Stasiun', icon: 'mdi:train' },
  { value: 'HALTE', label: 'Halte / Terminal', icon: 'mdi:bus' },
  { value: 'BANDARA', label: 'Bandara', icon: 'mdi:airplane' },
  { value: 'MALL', label: 'Mall', icon: 'mdi:shopping' },
  { value: 'PASAR', label: 'Pasar', icon: 'mdi:storefront' },
  { value: 'RUMAH_SAKIT', label: 'Rumah Sakit', icon: 'mdi:hospital-building' },
  { value: 'PERKANTORAN', label: 'Perkantoran', icon: 'mdi:office-building' },
  { value: 'MASJID', label: 'Masjid', icon: 'mdi:mosque' },
  { value: 'MINIMARKET', label: 'Minimarket', icon: 'mdi:store' },
  { value: 'LAINNYA', label: 'Lainnya', icon: 'solar:map-point-bold-duotone' },
];

export const AKSES_SATUAN_OPTIONS: { value: AksesSatuan; label: string }[] = [
  { value: 'MENIT', label: 'menit' },
  { value: 'KM', label: 'km' },
];

/** Satu item fasilitas — `name` yang disimpan ke DB, `icon` untuk tampilan. */
export interface FasilitasOption {
  name: string;
  icon: string;
}

/**
 * Fasilitas dipisah 2 grup — menjawab pertanyaan pertama calon penyewa kos:
 * "mana yang saya dapat sendiri di kamar, mana yang dipakai bareng-bareng?".
 * Daftar mengikuti pola Mamikos/Cove (perabot, elektronik, isi kamar mandi).
 *
 * "Kamar Mandi Dalam" sengaja TIDAK ada di sini karena sudah punya field
 * sendiri (kamar_mandi_tipe) — kalau dobel bisa saling bertentangan.
 * "Furnished" juga tidak dipakai, diganti item perabot eksplisit karena
 * "semi furnished" ditafsirkan beda-beda tiap pemilik.
 */
export const FASILITAS_KAMAR_OPTIONS: FasilitasOption[] = [
  { name: 'AC', icon: 'mdi:air-conditioner' },
  { name: 'Kipas Angin', icon: 'mdi:fan' },
  { name: 'Kasur', icon: 'solar:bed-bold-duotone' },
  { name: 'Bantal & Guling', icon: 'tabler:pillow' },
  { name: 'Lemari Pakaian', icon: 'mdi:wardrobe' },
  { name: 'Meja Belajar', icon: 'mdi:desk' },
  { name: 'Kursi', icon: 'mdi:chair-rolling' },
  { name: 'TV', icon: 'solar:tv-bold-duotone' },
  { name: 'Kulkas', icon: 'mdi:fridge-outline' },
  { name: 'Cermin', icon: 'mdi:mirror-rectangle' },
  { name: 'Jendela', icon: 'mdi:window-closed-variant' },
  { name: 'Balkon', icon: 'mdi:balcony' },
  { name: 'Water Heater', icon: 'mdi:water-boiler' },
  { name: 'Shower', icon: 'mdi:shower' },
  { name: 'Kloset Duduk', icon: 'mdi:toilet' },
  { name: 'Wastafel', icon: 'mdi:sink' },
];

export const FASILITAS_BERSAMA_OPTIONS: FasilitasOption[] = [
  { name: 'WiFi', icon: 'solar:wi-fi-router-bold-duotone' },
  { name: 'Dapur', icon: 'mdi:stove' },
  { name: 'Ruang Tamu', icon: 'solar:sofa-2-bold-duotone' },
  { name: 'Jemuran', icon: 'mdi:hanger' },
  { name: 'Mesin Cuci', icon: 'mdi:washing-machine' },
  { name: 'Setrika', icon: 'mdi:iron' },
  { name: 'Kulkas Bersama', icon: 'mdi:fridge-outline' },
  { name: 'Dispenser', icon: 'mdi:water-pump' },
  { name: 'Parkir Motor', icon: 'mdi:motorbike' },
  { name: 'Parkir Mobil', icon: 'mdi:car' },
  { name: 'CCTV', icon: 'mdi:cctv' },
  { name: 'Security 24 Jam', icon: 'solar:shield-check-bold-duotone' },
  { name: 'Musholla', icon: 'mdi:mosque' },
  { name: 'Laundry', icon: 'mdi:tshirt-crew' },
  { name: 'Kolam Renang', icon: 'mdi:pool' },
  { name: 'Gym', icon: 'mdi:dumbbell' },
];

/** Aturan rumah — dideklarasikan di depan supaya tidak jadi ribut belakangan. */
export const PERATURAN_OPTIONS: FasilitasOption[] = [
  { name: 'Boleh Tamu Menginap', icon: 'solar:users-group-rounded-bold-duotone' },
  { name: 'Boleh Pasutri', icon: 'mdi:ring' },
  { name: 'Boleh Bawa Hewan', icon: 'mdi:paw' },
  { name: 'Dilarang Merokok', icon: 'mdi:smoking-off' },
  { name: 'Dilarang Bawa Anak', icon: 'mdi:human-child' },
  { name: 'Khusus Mahasiswa', icon: 'mdi:school' },
  { name: 'Khusus Karyawan', icon: 'mdi:briefcase' },
];

export const SERTIFIKAT_OPTIONS: { value: Sertifikat; label: string }[] = [
  { value: 'SHM', label: 'SHM (Sertifikat Hak Milik)' },
  { value: 'HGB', label: 'HGB (Hak Guna Bangunan)' },
  { value: 'HGU', label: 'HGU (Hak Guna Usaha)' },
  { value: 'HP', label: 'HP (Hak Pakai)' },
  { value: 'STRATA_TITLE', label: 'Strata Title' },
  { value: 'PPJB', label: 'PPJB' },
  { value: 'AJB', label: 'AJB' },
  { value: 'LAINNYA', label: 'Lainnya' },
];

export const PROVINSI_OPTIONS = [
  'Jawa Timur', 'Jawa Barat', 'Jawa Tengah', 'DKI Jakarta',
  'Banten', 'Bali', 'Sumatera Utara', 'Sumatera Selatan'
];

export const KOTA_BY_PROVINSI: Record<string, string[]> = {
  'Jawa Timur': ['Surabaya', 'Malang', 'Sidoarjo', 'Gresik', 'Mojokerto'],
  'DKI Jakarta': ['Jakarta Pusat', 'Jakarta Selatan', 'Jakarta Barat', 'Jakarta Utara', 'Jakarta Timur'],
};

export const HADAP_OPTIONS = ['Utara', 'Selatan', 'Timur', 'Barat', 'Tenggara', 'Barat Daya'];
export const SUMBER_AIR_OPTIONS = ['PDAM', 'Sumur Bor', 'Sumur Gali', 'Air Tanah'];
export const KONDISI_INTERIOR_OPTIONS = ['Bare', 'Semi Furnished', 'Fully Furnished'];

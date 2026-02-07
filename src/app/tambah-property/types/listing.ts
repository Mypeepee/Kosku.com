export type JenisTransaksi = 'PRIMARY' | 'SECONDARY' | 'LELANG' | 'SEWA';
export type KategoriProperti = 'RUMAH' | 'APARTEMEN' | 'RUKO' | 'TANAH' | 'GUDANG' | 'HOTEL_DAN_VILLA' | 'TOKO' | 'PABRIK';
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

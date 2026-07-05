export interface PropertyItem {
  id_property: string;
  slug: string;
  judul: string;
  kota: string;
  alamat_lengkap: string;
  harga: number;
  harga_promo: number | null;
  jenis_transaksi: string;
  kategori: string;
  gambar: string;
  foto_list: string[];
  luas_tanah: number;
  luas_bangunan: number;
  kamar_tidur: number;
  kamar_mandi: number;
  tanggal_lelang: string | null;
  agent_name: string;
  agent_photo: string;
  agent_office: string;
  is_hot_deal: boolean;
}

export interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

export interface TabCounts {
  semua: number;
  jual: number;
  lelang: number;
  sewa: number;
}

export interface KategoriPageProps {
  slug: string;
  label: string;
  initialData: PropertyItem[];
  pagination: PaginationData;
  activeTipe: string;
  activeSort: string;
  tabCounts: TabCounts;
}

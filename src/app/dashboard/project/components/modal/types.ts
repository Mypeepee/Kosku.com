import type { LucideIcon } from "lucide-react";

export type jenis_pendanaan_enum = "terbuka" | "tertutup";

export type status_project_enum =
  | "pendanaan_terbuka"
  | "pendanaan_penuh"
  | "pengurusan_dokumen"
  | "eksekusi_pengosongan"
  | "renovasi"
  | "sedang_dijual"
  | "terjual"
  | "dibatalkan";

export type status_pembayaran_project_enum =
  | "menunggu_pembayaran"
  | "dibayar_sebagian"
  | "lunas"
  | "dikembalikan"
  | "dibatalkan";

export type CmaEntry = {
  id: string;
  nama: string;
  luas_tanah: number;
  harga: number;
  catatan?: string;
};

export type FundingInvestorAllocation = {
  id: string;
  investor_id: string;
  nominal: number;
  investor_nama?: string;
  investor_label?: string;
  investor_avatar?: string;
  status?: status_pembayaran_project_enum;
  catatan?: string;
};

export type ListingOption = {
  id_listing: string;
  id_property?: string;
  judul?: string | null;
  slug?: string | null;

  alamat_property?: string | null;
  alamat_lengkap?: string | null;
  provinsi?: string | null;
  kota?: string | null;
  kecamatan?: string | null;
  kelurahan?: string | null;

  gambar_thumbnail?: string | null;
  gambar?: string | null;

  harga?: number | null;
  harga_promo?: number | null;
  nilai_limit_lelang?: number | null;
  uang_jaminan?: number | null;

  vendor?: string | null;
  kategori?: string | null;
  jenis_transaksi?: "PRIMARY" | "SECONDARY" | "LELANG" | "SEWA" | string;
  tanggal_lelang?: string | null;

  luas_tanah?: number | null;
  luas_bangunan?: number | null;
  legalitas?: string | null;
};

export type InvestorOption = {
  id: string;
  id_agent: string;
  id_pengguna: string;
  nama: string;
  label: string;
  nama_kantor: string;
  kota_area: string;
  jabatan: string;
  nomor_whatsapp: string;
  foto_profil_url: string;
  status_keanggotaan: string;
};

export type BiayaBalikNamaBreakdown = {
  bea_lelang: number;
  bphtb: number;
  ppn_lelang: number;
  roya: number;
  balik_nama: number;
  total: number;
};

export type AcquisitionFinancials = {
  acquisition_base_label: string;
  acquisition_base: number;

  biaya_balik_nama_base_label: string;
  biaya_balik_nama_base: number;

  harga_menang_lelang: number;
  spare_bidding: number;

  biaya_balik_nama: BiayaBalikNamaBreakdown;
  biaya_eksekusi: number;
  biaya_renov: number;

  total_biaya_akuisisi: number;
  dana_cadangan: number;
  target_pendanaan: number;
};

export type CreateProjectFormValues = {
  id_listing: string | null;

  nama_project: string;
  alamat_property: string;
  provinsi: string;
  kota: string;
  kecamatan: string;
  kelurahan: string;
  gambar_thumbnail: string;

  tanggal_pembelian: string | null;
  harga_pembelian: number;
  estimasi_harga_jual: number;
  estimasi_profit_bersih: number;
  target_pendanaan: number;
  total_pendanaan: number;

  jenis_pendanaan: jenis_pendanaan_enum;
  status: status_project_enum;

  mulai_tanggal: string | null;
  estimasi_selesai: string | null;
  estimasi_bulan: number;
  pendanaan_ditutup_pada: string | null;

  deskripsi_project: string;
  dibuat_oleh?: string;
  invitedInvestorIds: string[];

  nilai_limit_lelang: number;
  spare_bidding: number;
  biaya_balik_nama: number;
  biaya_eksekusi: number;
  biaya_renov: number;

  total_biaya_akuisisi: number;
  dana_cadangan: number;

  cma_entries: CmaEntry[];
  investor_allocations: FundingInvestorAllocation[];
};

export type ProjectInvestorPayload = {
  id_agent: string;
  nominal_komitmen: number;
  nominal_terbayar: number;
  persentase_kepemilikan: number | null;
  status: status_pembayaran_project_enum;
  catatan?: string | null;
};

export type ProjectCmaPayload = {
  nama: string;
  luas_tanah: number;
  harga: number;
  catatan?: string | null;
};

export type CreateProjectPayload = {
  id_listing: string;

  nama_project: string;
  alamat_property: string;
  provinsi: string;
  kota: string;
  kecamatan: string;
  kelurahan: string;
  gambar_thumbnail: string;

  tanggal_pembelian: string | null;
  harga_pembelian: number;
  estimasi_harga_jual: number;
  estimasi_profit_bersih: number;
  target_pendanaan: number;
  total_pendanaan: number;

  jenis_pendanaan: jenis_pendanaan_enum;
  status: status_project_enum;

  mulai_tanggal: string | null;
  estimasi_selesai: string | null;
  estimasi_bulan: number;
  pendanaan_ditutup_pada: string | null;

  deskripsi_project: string;
  dibuat_oleh: string;

  nilai_limit_lelang: number;
  spare_bidding: number;
  biaya_balik_nama: number;
  biaya_eksekusi: number;
  biaya_renov: number;
  total_biaya_akuisisi: number;
  dana_cadangan: number;

  investor_allocations: ProjectInvestorPayload[];
  cma_entries: ProjectCmaPayload[];
};

export type CreateProjectSubmitResponse = {
  success: boolean;
  message: string;
  data?: {
    id_project: string;
  };
  errors?: string[];
};

export type ModalTierTheme = {
  nama: string;
  badge: string;
  actionButton: string;
  accentText: string;
  shell: string;
  overlay: string;
  edgeGlow: string;
  orbA: string;
  orbB: string;
  orbC: string;
  modalField: string;
  modalFieldFocus: string;
  modalMutedButton: string;
  modalMutedButtonHover: string;
  icon: LucideIcon;
};

export type WizardStep = 1 | 2 | 3;

export type ListingApiResponse = {
  success: boolean;
  query?: string;
  total?: number;
  data?: ListingOption[];
  message?: string;
};

export type ProjectModalApiResponse = {
  success: boolean;
  query?: string;
  investor_query?: string;
  total?: number;
  investor_total?: number;
  data?: ListingOption[];
  investors?: InvestorOption[];
  message?: string;
};

export type ProjectFullInvestor = {
  id_agent: string;
  nominal_komitmen: number;
  persentase_kepemilikan: number | null;
  status: status_pembayaran_project_enum;
  nama: string;
  label: string;
  nama_kantor: string;
  kota_area: string;
  foto_profil_url: string;
};

export type ProjectFullCma = {
  nama: string;
  luas_tanah: number;
  harga: number;
  catatan: string;
};

export type ProjectFullDetail = {
  id_project: string;
  id_listing: string;

  nama_project: string;
  deskripsi_project: string;
  alamat_property: string;
  provinsi: string;
  kota: string;
  kecamatan: string;
  kelurahan: string;
  gambar_thumbnail: string;

  tanggal_pembelian: string | null;
  mulai_tanggal: string | null;
  estimasi_selesai: string | null;
  pendanaan_ditutup_pada: string | null;
  estimasi_bulan: number;

  harga_pembelian: number;
  estimasi_harga_jual: number;
  estimasi_profit_bersih: number;
  target_pendanaan: number;
  total_pendanaan: number;

  jenis_pendanaan: jenis_pendanaan_enum;
  status: status_project_enum;

  nilai_limit_lelang: number;
  spare_bidding: number;
  biaya_eksekusi: number;
  biaya_renov: number;
  biaya_balik_nama: number;
  total_biaya_akuisisi: number;
  dana_cadangan: number;

  dibuat_oleh: string;
  is_sold: boolean;

  investor_allocations: ProjectFullInvestor[];
  cma_entries: ProjectFullCma[];
  listing: ListingOption | null;
};

export type ProjectFullResponse = {
  success: boolean;
  data?: ProjectFullDetail;
  message?: string;
};
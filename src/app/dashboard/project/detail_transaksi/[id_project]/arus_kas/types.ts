export type WalletKey =
  | "utama"
  | "dokumen"
  | "eksekusi"
  | "renovasi"
  | "cadangan";

export type DbProject = {
  id_project: string;
  nama_project: string;
  dibuat_oleh: string;
  status?: string;
  target_pendanaan?: number;
  total_pendanaan?: number;
  total_biaya_akuisisi?: number;
  nilai_limit_lelang?: number;
  spare_bidding?: number;
  biaya_balik_nama?: number;
  biaya_eksekusi?: number;
  biaya_renov?: number;
  dana_cadangan?: number;
  estimasi_harga_jual?: number;
  estimasi_profit_bersih?: number;
  dibuat_tanggal?: string | Date;
};

export type CurrentInvestorInfo = {
  nama: string | null;
  nominal_komitmen: number;
  persentase_kepemilikan: number | null;
  status: string;
};

export type DbCashflow = {
  id_project_arus_kas: bigint | number | string;
  id_project: string;
  wallet_key: WalletKey;
  tanggal_transaksi: Date | string;
  jenis_transaksi: "pemasukan" | "pengeluaran";
  kategori_transaksi: string;
  judul_transaksi: string;
  nominal: number | string;
  status_transaksi: "tercatat" | "dibatalkan";
  catatan?: string | null;
  dibuat_tanggal?: Date | string;
  diupdate_tanggal?: Date | string;
};

export type WalletSummary = {
  walletKey: WalletKey;
  title: string;
  budget: number;
  income: number;
  expense: number;
  balance: number;
  usedBudget: number;
  remainingBudget: number;
  visible: boolean;
};

export type ManageFundData = {
  project: DbProject;
  wallets: WalletSummary[];
  transactions: DbCashflow[];
  totalIncome: number;
  totalExpense: number;
  totalBalance: number;
  totalRemainingBudget: number;
  currentInvestorInfo: CurrentInvestorInfo | null;
};

export type ProjectInvestorOption = {
  id_project_investor: string | number;
  id_agent: string;
  nama?: string | null;
  foto_profil_url?: string | null;
  nama_kantor?: string | null;
  kota_area?: string | null;
  jabatan?: string | null;
  nomor_whatsapp?: string | null;
  nominal_komitmen?: number | string | null;
  persentase_kepemilikan?: number | string | null;
  status?: string | null;
};

export type ProjectInvestorResponse = {
  investors: ProjectInvestorOption[];
  project_total_pendanaan: number;
};
import type { FundState, PosState, WalletKey } from "@/lib/project-kas";

export type { WalletKey, PosState, FundState };

export type DbProject = {
  id_project: string;
  nama_project: string;
  dibuat_oleh: string;
  status?: string;
  jenis_pendanaan?: string;
  target_pendanaan?: number;
  total_pendanaan?: number;
  dibuat_tanggal?: string | Date;
};

/** Ringkasan satu pos/dompet siap tampil. Angkanya berasal dari mesin tunggal
 *  `@/lib/project-kas` — jangan hitung ulang di komponen. */
export type WalletSummary = PosState;

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
  /** Investor yang menyetor/menalangi (untuk baris setoran_modal & talangan_investor). */
  id_project_investor?: string | null;
  investor_nama?: string | null;
  /** Baris ini dibuat otomatis oleh sistem (talangan/setoran) → tak bisa diedit. */
  dikunci?: boolean;
};

/** Satu investor project, lengkap dengan porsi kepemilikannya. */
export type InvestorSummary = {
  id_project_investor: string;
  id_agent: string;
  nama: string;
  foto_profil_url: string | null;
  /** Nominal yang dijanjikan. */
  komitmen: number;
  /** Modal yang benar-benar sudah masuk — dasar kepemilikan. */
  disetor: number;
  /** max(0, komitmen − disetor). */
  belumSetor: number;
  status: string;
  isCurrentUser: boolean;
};

export type CurrentInvestorInfo = {
  nama: string | null;
  nominal_komitmen: number;
  nominal_terbayar: number;
  persentase_kepemilikan: number | null;
  status: string;
};

export type ManageFundData = {
  project: DbProject;
  /** Seluruh angka kas & anggaran. Sumber tunggal. */
  fund: FundState;
  /** Alias `fund.pos` untuk komponen dompet. */
  wallets: WalletSummary[];
  transactions: DbCashflow[];
  /** Dipakai form pencatatan & panel tutup kekurangan (memilih penanggung). */
  investors: InvestorSummary[];
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
  source_label?: string | null;
  funding_mode?: string | null;
};

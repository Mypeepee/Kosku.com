export type FundingType = "terbuka" | "tertutup";

export type ProjectStatus =
  | "pendanaan_terbuka"
  | "pendanaan_penuh"
  | "pengurusan_dokumen"
  | "eksekusi_pengosongan"
  | "renovasi"
  | "sedang_dijual"
  | "terjual"
  | "dibatalkan";

export type PaymentStatus =
  | "menunggu_pembayaran"
  | "dibayar_sebagian"
  | "lunas"
  | "dikembalikan"
  | "dibatalkan";

export type NullableDate = string | Date | null | undefined;

export type ProjectInvestorViewModel = {
  id: string;
  name: string;
  avatar?: string | null;
  committed: number | string;
  paid: number | string;
  ownership?: number | string | null;
  status: PaymentStatus;
  note?: string | null;
};

export type ProjectCmaViewModel = {
  id: string | number;
  name: string;
  landArea: number | string;
  price: number | string;
  note?: string | null;
};

export type ProjectDetailViewModel = {
  id: string;
  listingId?: string | number;
  name: string;
  address?: string | null;
  province?: string | null;
  city?: string | null;
  district?: string | null;
  village?: string | null;
  image?: string | null;
  purchaseDate?: NullableDate;

  landArea?: number | string | null;

  purchasePrice: number | string;
  estimatedSellPrice: number | string;
  estimatedNetProfit: number | string;
  fundingTarget: number | string;
  /** Modal yang SUDAH disetor — dasar progres pendanaan. */
  totalFunded: number | string;
  /** Σ komitmen seluruh investor (dibayar maupun belum). */
  totalCommitted?: number | string;
  /** Dijanjikan tapi belum disetor. */
  unpaidCommitment?: number | string;

  fundingType: FundingType;
  status: ProjectStatus;

  startDate?: NullableDate;
  estimatedFinish?: NullableDate;
  estimatedMonths?: number | string | null;
  fundingClosedAt?: NullableDate;

  description?: string | null;

  createdById?: string;
  createdByName?: string | null;
  createdByAvatar?: string | null;

  auctionLimitValue?: number | string;
  spareBidding?: number | string;
  executionCost?: number | string;
  renovationCost?: number | string;
  transferCost?: number | string;
  totalAcquisitionCost?: number | string;
  reserveFund?: number | string;

  createdAt?: NullableDate;
  updatedAt?: NullableDate;

  investors: ProjectInvestorViewModel[];
  cma: ProjectCmaViewModel[];
};
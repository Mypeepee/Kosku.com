import { Prisma } from "@prisma/client";

/**
 * Shared server-side helpers for writing (create & update) a project.
 *
 * Both `POST /api/project/modal/simpan_project` (create) and
 * `PUT /api/project/[id_project]/update` (edit) import from here so the
 * financial computation, date derivation, and investor/CMA normalization
 * stay byte-for-byte identical between the two flows.
 */

export type StatusPembayaranProject =
  | "menunggu_pembayaran"
  | "dibayar_sebagian"
  | "lunas"
  | "dikembalikan"
  | "dibatalkan";

/**
 * The DB enum `status_pembayaran_project_enum` only supports two states.
 * Coerce any wider client-side status down to a value Postgres will accept so
 * an unexpected value can never break the insert/update.
 */
export type DbPaymentStatus = "lunas" | "menunggu_pembayaran";

export function toDbPaymentStatus(
  value?: string | null
): DbPaymentStatus {
  return value === "lunas" ? "lunas" : "menunggu_pembayaran";
}

export type JenisPendanaan = "terbuka" | "tertutup";

export type StatusProject =
  | "pendanaan_terbuka"
  | "pendanaan_penuh"
  | "pengurusan_dokumen"
  | "eksekusi_pengosongan"
  | "renovasi"
  | "sedang_dijual"
  | "terjual"
  | "dibatalkan";

export const STATUS_PROJECT_VALUES: StatusProject[] = [
  "pendanaan_terbuka",
  "pendanaan_penuh",
  "pengurusan_dokumen",
  "eksekusi_pengosongan",
  "renovasi",
  "sedang_dijual",
  "terjual",
  "dibatalkan",
];

export type ProjectInvestorInput = {
  id_agent?: string;
  nominal_komitmen?: number;
  persentase_kepemilikan?: number | null;
  status?: StatusPembayaranProject;
  catatan?: string | null;
};

export type ProjectCmaInput = {
  nama?: string;
  luas_tanah?: number;
  harga?: number;
  catatan?: string | null;
};

export type ProjectWritePayload = {
  id_listing?: string;

  nama_project?: string;
  alamat_property?: string;
  provinsi?: string;
  kota?: string;
  kecamatan?: string;
  kelurahan?: string;
  gambar_thumbnail?: string;

  tanggal_pembelian?: string | null;
  harga_pembelian?: number;
  estimasi_harga_jual?: number;
  estimasi_profit_bersih?: number;
  target_pendanaan?: number;
  total_pendanaan?: number;

  jenis_pendanaan?: JenisPendanaan;
  status?: StatusProject;

  mulai_tanggal?: string | null;
  estimasi_selesai?: string | null;
  estimasi_bulan?: number;
  pendanaan_ditutup_pada?: string | null;

  deskripsi_project?: string;
  dibuat_oleh?: string;

  nilai_limit_lelang?: number;
  spare_bidding?: number;
  biaya_balik_nama?: number;
  biaya_eksekusi?: number;
  biaya_renov?: number;
  total_biaya_akuisisi?: number;
  dana_cadangan?: number;

  investor_allocations?: ProjectInvestorInput[];
  cma_entries?: ProjectCmaInput[];
};

export function toDecimal(value: number | string | null | undefined) {
  return new Prisma.Decimal(String(Number(value || 0)));
}

export function toSafeString(value?: string | null) {
  return String(value ?? "").trim();
}

export function toSafeNumber(value?: number | string | null) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function toNonNegativeNumber(value?: number | string | null) {
  return Math.max(0, toSafeNumber(value));
}

export function parseBigIntId(value?: string | null) {
  const trimmed = toSafeString(value);

  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;

  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

export function normalizeJenisPendanaan(value?: string | null): JenisPendanaan {
  return value === "tertutup" ? "tertutup" : "terbuka";
}

export function normalizeStatusProject(value?: string | null): StatusProject {
  const trimmed = toSafeString(value) as StatusProject;
  return STATUS_PROJECT_VALUES.includes(trimmed) ? trimmed : "pendanaan_terbuka";
}

function parsePlainDate(value?: string | null) {
  const trimmed = toSafeString(value);
  if (!trimmed) return null;

  const isoDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateMatch) {
    const year = Number(isoDateMatch[1]);
    const month = Number(isoDateMatch[2]);
    const day = Number(isoDateMatch[3]);

    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }

    return null;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toNullableDate(value?: string | null) {
  return parsePlainDate(value);
}

function addMonthsPreserveDay(baseDate: Date, monthsToAdd: number) {
  const safeMonths = Math.max(0, Math.trunc(monthsToAdd));
  const baseDay = baseDate.getDate();

  const targetMonthStart = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth() + safeMonths,
    1
  );

  const lastDayOfTargetMonth = new Date(
    targetMonthStart.getFullYear(),
    targetMonthStart.getMonth() + 1,
    0
  ).getDate();

  return new Date(
    targetMonthStart.getFullYear(),
    targetMonthStart.getMonth(),
    Math.min(baseDay, lastDayOfTargetMonth)
  );
}

export function getDerivedProjectDates(body: ProjectWritePayload) {
  const tanggal_pembelian = toNullableDate(body.tanggal_pembelian);
  const estimasi_bulan = Math.max(
    0,
    Math.trunc(toSafeNumber(body.estimasi_bulan))
  );

  const mulai_tanggal = tanggal_pembelian
    ? new Date(
        tanggal_pembelian.getFullYear(),
        tanggal_pembelian.getMonth(),
        tanggal_pembelian.getDate()
      )
    : null;

  const estimasi_selesai =
    tanggal_pembelian && estimasi_bulan >= 0
      ? addMonthsPreserveDay(tanggal_pembelian, estimasi_bulan)
      : null;

  return {
    tanggal_pembelian,
    mulai_tanggal,
    estimasi_selesai,
    estimasi_bulan,
  };
}

export function getBiayaBalikNamaBreakdown(acquisitionBase: number) {
  const base = toNonNegativeNumber(acquisitionBase);

  const bea_lelang = base * 0.02;
  const bphtb = base * 0.05;
  const ppn_lelang = base * 0.011;
  const balik_nama = base * 0.001;
  const roya = 75000;

  return {
    bea_lelang,
    bphtb,
    ppn_lelang,
    roya,
    balik_nama,
    total: bea_lelang + bphtb + ppn_lelang + balik_nama + roya,
  };
}

export function getProjectAcquisitionFinancials(body: ProjectWritePayload) {
  const nilaiLimitLelang = toNonNegativeNumber(body.nilai_limit_lelang);
  const hargaPembelianInput = toNonNegativeNumber(body.harga_pembelian);

  const acquisition_base =
    nilaiLimitLelang > 0 ? nilaiLimitLelang : hargaPembelianInput;

  const spare_bidding = toNonNegativeNumber(body.spare_bidding);
  const biaya_eksekusi = toNonNegativeNumber(body.biaya_eksekusi);
  const biaya_renov = toNonNegativeNumber(body.biaya_renov);
  const target_pendanaan = toNonNegativeNumber(body.target_pendanaan);

  const biaya_balik_nama_base =
    nilaiLimitLelang > 0 ? nilaiLimitLelang : acquisition_base;

  const autoBreakdown = getBiayaBalikNamaBreakdown(biaya_balik_nama_base);
  const biaya_balik_nama_total = autoBreakdown.total;

  const total_biaya_akuisisi =
    acquisition_base +
    spare_bidding +
    biaya_balik_nama_total +
    biaya_eksekusi +
    biaya_renov;

  const dana_cadangan = target_pendanaan - total_biaya_akuisisi;

  return {
    acquisition_base,
    spare_bidding,
    biaya_balik_nama_base,
    biaya_balik_nama_total,
    biaya_eksekusi,
    biaya_renov,
    total_biaya_akuisisi,
    dana_cadangan,
    target_pendanaan,
  };
}

export function normalizeInvestorAllocations(
  items: ProjectInvestorInput[] = []
): Required<ProjectInvestorInput>[] {
  const map = new Map<string, Required<ProjectInvestorInput>>();

  for (const item of items) {
    const id_agent = toSafeString(item.id_agent);
    if (!id_agent) continue;

    const existing = map.get(id_agent);

    map.set(id_agent, {
      id_agent,
      nominal_komitmen:
        toSafeNumber(existing?.nominal_komitmen) +
        Math.max(0, toSafeNumber(item.nominal_komitmen)),
      persentase_kepemilikan:
        item.persentase_kepemilikan === null ||
        item.persentase_kepemilikan === undefined
          ? existing?.persentase_kepemilikan ?? null
          : toSafeNumber(item.persentase_kepemilikan),
      status:
        item.status ??
        existing?.status ??
        ("menunggu_pembayaran" as StatusPembayaranProject),
      catatan: toSafeString(item.catatan) || null,
    });
  }

  return Array.from(map.values());
}

export function normalizeCmaEntries(items: ProjectCmaInput[] = []) {
  return items
    .map((item) => ({
      nama: toSafeString(item.nama),
      luas_tanah: Math.max(0, toSafeNumber(item.luas_tanah)),
      harga: Math.max(0, toSafeNumber(item.harga)),
      catatan: toSafeString(item.catatan) || null,
    }))
    .filter((item) => {
      return (
        item.nama.length > 0 ||
        item.luas_tanah > 0 ||
        item.harga > 0 ||
        Boolean(item.catatan)
      );
    });
}

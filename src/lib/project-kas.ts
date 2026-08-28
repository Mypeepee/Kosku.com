/**
 * ─────────────────────────────────────────────────────────────────────────
 *  KAS & ANGGARAN PROJECT — SATU SUMBER KEBENARAN
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  Uang itu sensitif: server (penegak aturan) dan UI (penampil angka) WAJIB
 *  memakai rumus yang sama persis. Semua rumus itu ada di berkas ini saja.
 *
 *  ── DUA BUKU YANG BERBEDA (jangan pernah dicampur) ──────────────────────
 *
 *  1) KAS PROYEK = uang riil yang benar-benar ada.
 *
 *         sisaKas = Σ modal_disetor + Σ pemasukan_non_modal − Σ pengeluaran
 *
 *     • modal_disetor = kolom `nominal_terbayar` tiap investor (BUKAN komitmen).
 *     • pemasukan_non_modal = baris pemasukan selain setoran_modal/talangan
 *       (hasil_penjualan, refund, pemasukan_lain). Setoran & talangan SUDAH
 *       terhitung lewat nominal_terbayar → dikecualikan agar tak dobel.
 *     • Dijaga ≥ 0. Kekurangan wajib ditalangi investor.
 *
 *  2) ANGGARAN POS (dompet) = rencana belanja per pos.
 *
 *         anggaranPos = rencana_pos + Σ talangan(pos) + Σ refund(pos)
 *         sisaAnggaranPos = anggaranPos − Σ pengeluaran(pos)
 *
 *     • rencana_pos berasal dari kolom project (Σ rencana = target_pendanaan).
 *     • Talangan investor MENAMBAH anggaran pos yang ditalangi — karena uang
 *       baru memang masuk untuk pos itu. Efeknya pos tak pernah minus.
 *     • Refund mengembalikan anggaran pos asalnya (uangnya kembali).
 *     • Dijaga ≥ 0 untuk transaksi baru. Data lama boleh minus (ditandai
 *       sebagai "kekurangan" agar bisa ditutup manual).
 *
 *  ── JEMBATAN ANTARA KEDUANYA (dipakai di UI supaya tidak ambigu) ────────
 *
 *      sisaKas = ΣsisaAnggaranPos − modalBelumSetor + pemasukanLuarPos
 *
 *  ── ATURAN PENGELUARAN BARU ─────────────────────────────────────────────
 *
 *      talanganDibutuhkan = max(
 *          nominal − sisaAnggaranPos,   // pos-nya kurang
 *          nominal − sisaKas            // kas proyeknya kurang
 *      )   (dibatasi ≥ 0)
 *
 *  Satu talangan menutup keduanya sekaligus: ia menambah modal disetor
 *  penanggung (kas naik) DAN menambah anggaran pos yang bersangkutan.
 */

export const WALLET_KEYS = [
  "utama",
  "dokumen",
  "eksekusi",
  "renovasi",
  "cadangan",
] as const;

export type WalletKey = (typeof WALLET_KEYS)[number];

export function isWalletKey(value: unknown): value is WalletKey {
  return (
    typeof value === "string" && (WALLET_KEYS as readonly string[]).includes(value)
  );
}

export function normalizeWalletKey(value: unknown): WalletKey {
  return isWalletKey(value) ? value : "utama";
}

export const WALLET_LABELS: Record<WalletKey, string> = {
  utama: "Dompet Utama",
  dokumen: "Dokumen",
  eksekusi: "Eksekusi",
  renovasi: "Renovasi",
  cadangan: "Cadangan",
};

export const WALLET_HINTS: Record<WalletKey, string> = {
  utama: "Pembelian aset & spare bidding",
  dokumen: "Balik nama & legalitas",
  eksekusi: "Pengosongan & operasional lapangan",
  renovasi: "Perbaikan & finishing",
  cadangan: "Buffer di luar rencana pos",
};

/** Pemasukan yang merepresentasikan modal investor. Sudah dihitung lewat
 *  `nominal_terbayar`, jadi TIDAK boleh dijumlah lagi dari ledger. */
export const MODAL_INCOME_CATEGORIES = [
  "setoran_modal",
  "talangan_investor",
] as const;

/** Pemasukan yang mengembalikan anggaran pos asalnya. */
export const POS_REFUND_CATEGORIES = ["refund"] as const;

export function isModalIncomeCategory(kategori: string) {
  return (MODAL_INCOME_CATEGORIES as readonly string[]).includes(kategori);
}

export function isPosRefundCategory(kategori: string) {
  return (POS_REFUND_CATEGORIES as readonly string[]).includes(kategori);
}

// ── Sumber angka ────────────────────────────────────────────────────────────

/** Kolom project yang dipakai untuk menyusun rencana anggaran tiap pos. */
export type ProjectBudgetSource = {
  target_pendanaan?: unknown;
  nilai_limit_lelang?: unknown;
  spare_bidding?: unknown;
  biaya_balik_nama?: unknown;
  biaya_eksekusi?: unknown;
  biaya_renov?: unknown;
  dana_cadangan?: unknown;
};

export type LedgerRow = {
  wallet_key: unknown;
  jenis_transaksi: string;
  kategori_transaksi: string;
  status_transaksi: string;
  nominal: unknown;
};

export type InvestorRow = {
  nominal_komitmen?: unknown;
  nominal_terbayar?: unknown;
};

/** Angka uang yang aman: finite, selain itu 0. Boleh negatif. */
export function money(value: unknown): number {
  if (value === null || value === undefined) return 0;

  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  if (typeof value === "object" && typeof (value as any).toString === "function") {
    const parsed = Number((value as any).toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Uang non-negatif (untuk anggaran rencana yang tak boleh minus). */
function positiveMoney(value: unknown): number {
  const n = money(value);
  return n > 0 ? n : 0;
}

/** Rencana anggaran per pos dari kolom project. Σ = target_pendanaan. */
export function planBudgets(
  project: ProjectBudgetSource
): Record<WalletKey, number> {
  return {
    utama:
      positiveMoney(project.nilai_limit_lelang) +
      positiveMoney(project.spare_bidding),
    dokumen: positiveMoney(project.biaya_balik_nama),
    eksekusi: positiveMoney(project.biaya_eksekusi),
    renovasi: positiveMoney(project.biaya_renov),
    // dana_cadangan = target − total biaya; bisa negatif kalau target di bawah
    // biaya. Anggaran tak boleh minus → dijepit 0, kekurangannya akan muncul
    // sebagai kekurangan kas (yang memang jujur).
    cadangan: positiveMoney(project.dana_cadangan),
  };
}

// ── Bentuk hasil ────────────────────────────────────────────────────────────

export type PosState = {
  walletKey: WalletKey;
  title: string;
  hint: string;
  /** Anggaran rencana dari kolom project. */
  rencana: number;
  /** Σ talangan investor yang masuk ke pos ini (menambah anggaran). */
  talangan: number;
  /** Σ refund yang mengembalikan anggaran pos ini. */
  refund: number;
  /** rencana + talangan + refund. */
  anggaran: number;
  /** Σ pengeluaran pos. */
  terpakai: number;
  /** anggaran − terpakai. Negatif hanya mungkin dari data lama. */
  sisaAnggaran: number;
  /** max(0, −sisaAnggaran). Wajib ditutup investor. */
  kekurangan: number;
  overBudget: boolean;
  /** Porsi anggaran yang sudah terpakai, 0..100 (dijepit). */
  persenTerpakai: number;
  /** Pemasukan pos yang TIDAK menambah anggaran pos (hasil jual, lain-lain). */
  pemasukanLain: number;
  /** Jumlah baris transaksi tercatat pada pos ini. */
  jumlahTransaksi: number;
};

export type FundState = {
  pos: PosState[];

  // ── Buku anggaran ──
  totalRencana: number;
  totalTalangan: number;
  totalRefund: number;
  totalAnggaran: number;
  totalTerpakai: number;
  totalSisaAnggaran: number;
  totalKekurangan: number;

  // ── Buku kas ──
  /** Σ nominal_terbayar seluruh investor (termasuk talangan). */
  modalDisetor: number;
  /** Σ nominal_komitmen seluruh investor. */
  modalKomitmen: number;
  /** Modal yang dijanjikan tapi belum masuk = max(0, komitmen − disetor). */
  modalBelumSetor: number;
  /** Target pendanaan project. */
  targetPendanaan: number;
  /** Kekurangan modal terhadap target = max(0, target − modal dasar disetor). */
  targetBelumTerpenuhi: number;
  /** Σ pemasukan non-modal (refund + hasil penjualan + pemasukan lain). */
  pemasukanNonModal: number;
  /** Pemasukan non-modal yang bukan refund pos. */
  pemasukanLuarPos: number;
  /** Σ pengeluaran seluruh pos = totalTerpakai. */
  pengeluaran: number;
  /** modalDisetor + pemasukanNonModal. */
  kasMasuk: number;
  /** kasMasuk − pengeluaran. Dijaga ≥ 0 untuk transaksi baru. */
  sisaKas: number;

  // ── Jembatan anggaran ↔ kas (supaya UI tak pernah terlihat "tidak nyambung") ──
  /** totalSisaAnggaran − sisaKas. Positif = anggaran lebih besar dari uangnya. */
  selisihAnggaranKas: number;
  /**
   * Modal yang direncanakan tapi belum masuk kas.
   * Identitas yang PASTI berlaku:
   *   sisaKas = totalSisaAnggaran − modalBelumMasuk + pemasukanLuarPos
   */
  modalBelumMasuk: number;

  // ── Kepemilikan ──
  /** Denominator kepemilikan = max(target, Σ modal disetor). */
  denominator: number;
};

/** Hitung seluruh keadaan dana dari baris mentah. Murni & deterministik. */
export function computeFundState(params: {
  project: ProjectBudgetSource;
  rows: ReadonlyArray<LedgerRow>;
  investors: ReadonlyArray<InvestorRow>;
}): FundState {
  const { project, rows, investors } = params;

  const rencana = planBudgets(project);

  const acc: Record<
    WalletKey,
    {
      talangan: number;
      refund: number;
      terpakai: number;
      pemasukanLain: number;
      jumlah: number;
    }
  > = {
    utama: { talangan: 0, refund: 0, terpakai: 0, pemasukanLain: 0, jumlah: 0 },
    dokumen: { talangan: 0, refund: 0, terpakai: 0, pemasukanLain: 0, jumlah: 0 },
    eksekusi: { talangan: 0, refund: 0, terpakai: 0, pemasukanLain: 0, jumlah: 0 },
    renovasi: { talangan: 0, refund: 0, terpakai: 0, pemasukanLain: 0, jumlah: 0 },
    cadangan: { talangan: 0, refund: 0, terpakai: 0, pemasukanLain: 0, jumlah: 0 },
  };

  let pemasukanNonModal = 0;
  let pemasukanLuarPos = 0;

  for (const row of rows) {
    if (row.status_transaksi === "dibatalkan") continue;

    const key = normalizeWalletKey(row.wallet_key);
    const nominal = positiveMoney(row.nominal);
    const bucket = acc[key];
    bucket.jumlah += 1;

    if (row.jenis_transaksi === "pengeluaran") {
      bucket.terpakai += nominal;
      continue;
    }

    if (row.jenis_transaksi !== "pemasukan") continue;

    if (row.kategori_transaksi === "talangan_investor") {
      // Kas-nya sudah terhitung lewat nominal_terbayar; di sini hanya menambah
      // anggaran pos yang ditalangi.
      bucket.talangan += nominal;
      continue;
    }

    if (row.kategori_transaksi === "setoran_modal") {
      // Sama: kas lewat nominal_terbayar, dan setoran tidak terikat pos.
      continue;
    }

    pemasukanNonModal += nominal;

    if (isPosRefundCategory(row.kategori_transaksi)) {
      bucket.refund += nominal;
    } else {
      bucket.pemasukanLain += nominal;
      pemasukanLuarPos += nominal;
    }
  }

  const pos: PosState[] = WALLET_KEYS.map((key) => {
    const bucket = acc[key];
    const anggaran = rencana[key] + bucket.talangan + bucket.refund;
    const sisaAnggaran = anggaran - bucket.terpakai;

    return {
      walletKey: key,
      title: WALLET_LABELS[key],
      hint: WALLET_HINTS[key],
      rencana: rencana[key],
      talangan: bucket.talangan,
      refund: bucket.refund,
      anggaran,
      terpakai: bucket.terpakai,
      sisaAnggaran,
      kekurangan: sisaAnggaran < 0 ? -sisaAnggaran : 0,
      overBudget: sisaAnggaran < 0,
      persenTerpakai:
        anggaran > 0
          ? Math.min(100, Math.max(0, (bucket.terpakai / anggaran) * 100))
          : bucket.terpakai > 0
            ? 100
            : 0,
      pemasukanLain: bucket.pemasukanLain,
      jumlahTransaksi: bucket.jumlah,
    };
  });

  const sum = (pick: (item: PosState) => number) =>
    pos.reduce((total, item) => total + pick(item), 0);

  const totalRencana = sum((p) => p.rencana);
  const totalTalangan = sum((p) => p.talangan);
  const totalRefund = sum((p) => p.refund);
  const totalAnggaran = sum((p) => p.anggaran);
  const totalTerpakai = sum((p) => p.terpakai);
  const totalKekurangan = sum((p) => p.kekurangan);

  const modalDisetor = investors.reduce(
    (total, inv) => total + positiveMoney(inv.nominal_terbayar),
    0
  );
  const modalKomitmen = investors.reduce(
    (total, inv) => total + positiveMoney(inv.nominal_komitmen),
    0
  );

  const targetPendanaan = positiveMoney(project.target_pendanaan);
  // Modal "dasar" = setoran murni tanpa talangan; itulah yang dibandingkan
  // dengan target pendanaan supaya talangan tidak terlihat sebagai pemenuhan
  // target.
  const modalDasar = modalDisetor - totalTalangan;

  const totalSisaAnggaran = totalAnggaran - totalTerpakai;
  const kasMasuk = modalDisetor + pemasukanNonModal;
  const sisaKas = kasMasuk - totalTerpakai;

  return {
    pos,
    totalRencana,
    totalTalangan,
    totalRefund,
    totalAnggaran,
    totalTerpakai,
    totalSisaAnggaran,
    totalKekurangan,

    modalDisetor,
    modalKomitmen,
    modalBelumSetor: Math.max(0, modalKomitmen - modalDisetor),
    targetPendanaan,
    targetBelumTerpenuhi: Math.max(0, targetPendanaan - modalDasar),
    pemasukanNonModal,
    pemasukanLuarPos,
    pengeluaran: totalTerpakai,
    kasMasuk,
    sisaKas,

    selisihAnggaranKas: totalSisaAnggaran - sisaKas,
    modalBelumMasuk: totalSisaAnggaran - sisaKas + pemasukanLuarPos,

    denominator: Math.max(targetPendanaan, modalDisetor),
  };
}

// ── Aturan transaksi ────────────────────────────────────────────────────────

export type ExpensePlan = {
  /** Sisa anggaran pos sebelum transaksi. */
  sisaAnggaranPos: number;
  /** Sisa kas proyek sebelum transaksi. */
  sisaKas: number;
  /**
   * Bagian kekurangan yang MENAMBAH ANGGARAN POS — dicatat sebagai
   * `talangan_investor` pada pos itu. Terjadi saat belanja melebihi rencana
   * pos: uang baru di luar rencana benar-benar dibutuhkan.
   */
  tambahanAnggaran: number;
  /**
   * Bagian kekurangan yang HANYA MENAMBAH KAS — dicatat sebagai
   * `setoran_modal`. Terjadi saat rencana pos masih cukup tapi uangnya belum
   * masuk (komitmen investor belum disetor). Anggaran pos TIDAK ikut naik,
   * karena rencananya memang sudah ada.
   */
  tambahanKas: number;
  /** tambahanAnggaran + tambahanKas = total yang dibebankan ke investor. */
  totalDibebankan: number;
  /** Perlu investor penanggung? */
  butuhTalangan: boolean;
  /** Sisa anggaran pos setelah transaksi + tambahan. Selalu ≥ 0. */
  sisaAnggaranPosSetelah: number;
  /** Sisa kas setelah transaksi + tambahan. Selalu ≥ 0. */
  sisaKasSetelah: number;
};

/**
 * Rencana satu pengeluaran: berapa yang kurang, dan kekurangan itu jenisnya apa.
 * Dipakai UI (pratinjau) DAN server (penegakan) — hasilnya wajib identik.
 *
 * Dua jenis kekurangan sengaja dibedakan supaya angka anggaran tidak melar:
 *
 *   1. Anggaran pos kurang  → talangan (anggaran pos + kas sama-sama naik).
 *   2. Anggaran cukup tapi kas kurang → setoran modal (hanya kas yang naik);
 *      rencananya sudah ada, yang belum cuma uangnya.
 */
export function planExpense(params: {
  state: Pick<FundState, "pos" | "sisaKas">;
  walletKey: WalletKey;
  nominal: number;
}): ExpensePlan {
  const { state, walletKey } = params;
  const nominal = positiveMoney(params.nominal);

  const pos = state.pos.find((item) => item.walletKey === walletKey);
  const sisaAnggaranPos = pos ? pos.sisaAnggaran : 0;
  const sisaKas = money(state.sisaKas);

  // (1) Kekurangan rencana pos → uang baru di luar rencana.
  const tambahanAnggaran = Math.max(0, nominal - sisaAnggaranPos);

  // (2) Sisa kekurangan kas SETELAH talangan di atas ikut masuk kas.
  const tambahanKas = Math.max(
    0,
    nominal - (sisaKas + tambahanAnggaran)
  );

  const totalDibebankan = tambahanAnggaran + tambahanKas;

  return {
    sisaAnggaranPos,
    sisaKas,
    tambahanAnggaran,
    tambahanKas,
    totalDibebankan,
    butuhTalangan: totalDibebankan > 0,
    sisaAnggaranPosSetelah: sisaAnggaranPos + tambahanAnggaran - nominal,
    sisaKasSetelah: sisaKas + totalDibebankan - nominal,
  };
}

/** Pemasukan yang menambah anggaran pos (talangan/refund) — untuk pratinjau. */
export function isPosBudgetIncome(kategori: string) {
  return kategori === "talangan_investor" || isPosRefundCategory(kategori);
}

/**
 * Keadaan dana seolah satu baris ledger dihapus. Dipakai UI untuk pratinjau
 * saat mengedit transaksi (server tetap menghitung ulang dari database —
 * ini hanya supaya angka di layar mengikuti ketikan user secara langsung).
 */
export function stateWithoutRow(
  state: FundState,
  row: LedgerRow | null | undefined
): FundState {
  if (!row || row.status_transaksi === "dibatalkan") return state;

  const key = normalizeWalletKey(row.wallet_key);
  const nominal = positiveMoney(row.nominal);
  if (nominal <= 0) return state;

  const isExpense = row.jenis_transaksi === "pengeluaran";
  const isModal = isModalIncomeCategory(row.kategori_transaksi);
  const isRefund =
    row.jenis_transaksi === "pemasukan" &&
    isPosRefundCategory(row.kategori_transaksi);

  // Efek baris terhadap anggaran pos & kas, dibalik tandanya.
  const deltaAnggaranPos = isExpense ? nominal : isRefund ? -nominal : 0;
  const deltaKas = isExpense ? nominal : isModal ? 0 : -nominal;

  const pos = state.pos.map((item) => {
    if (item.walletKey !== key) return item;

    const anggaran = item.anggaran - (isRefund ? nominal : 0);
    const terpakai = item.terpakai - (isExpense ? nominal : 0);
    const sisaAnggaran = anggaran - terpakai;

    return {
      ...item,
      anggaran,
      terpakai,
      refund: item.refund - (isRefund ? nominal : 0),
      sisaAnggaran,
      kekurangan: sisaAnggaran < 0 ? -sisaAnggaran : 0,
      overBudget: sisaAnggaran < 0,
      persenTerpakai:
        anggaran > 0
          ? Math.min(100, Math.max(0, (terpakai / anggaran) * 100))
          : terpakai > 0
            ? 100
            : 0,
      jumlahTransaksi: Math.max(0, item.jumlahTransaksi - 1),
    };
  });

  const totalSisaAnggaran = state.totalSisaAnggaran + deltaAnggaranPos;
  const sisaKas = state.sisaKas + deltaKas;

  return {
    ...state,
    pos,
    totalAnggaran: state.totalAnggaran - (isRefund ? nominal : 0),
    totalRefund: state.totalRefund - (isRefund ? nominal : 0),
    totalTerpakai: state.totalTerpakai - (isExpense ? nominal : 0),
    totalSisaAnggaran,
    pengeluaran: state.pengeluaran - (isExpense ? nominal : 0),
    pemasukanNonModal:
      state.pemasukanNonModal - (!isExpense && !isModal ? nominal : 0),
    pemasukanLuarPos:
      state.pemasukanLuarPos - (!isExpense && !isModal && !isRefund ? nominal : 0),
    kasMasuk: state.kasMasuk - (!isExpense && !isModal ? nominal : 0),
    sisaKas,
    selisihAnggaranKas: totalSisaAnggaran - sisaKas,
  };
}

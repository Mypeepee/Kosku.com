import type { WalletKey } from "@/lib/project-kas";

/** Kategori arus kas yang boleh dipilih manual (setoran modal & talangan
 *  dibuat otomatis sistem, jadi sengaja tidak ada di sini). */
export const KATEGORI_PENGELUARAN = [
  { value: "pembelian_aset", label: "Pembelian aset" },
  { value: "biaya_spare_bidding", label: "Spare bidding" },
  { value: "biaya_dokumen_balik_nama", label: "Dokumen & balik nama" },
  { value: "biaya_eksekusi_pengosongan", label: "Eksekusi & pengosongan" },
  { value: "biaya_renovasi", label: "Renovasi" },
  { value: "penggunaan_dana_cadangan", label: "Pakai dana cadangan" },
  { value: "pengeluaran_lain", label: "Pengeluaran lain" },
] as const;

export const KATEGORI_PEMASUKAN = [
  { value: "hasil_penjualan", label: "Hasil penjualan" },
  { value: "refund", label: "Refund (uang kembali ke pos)" },
  { value: "pemasukan_lain", label: "Pemasukan lain" },
] as const;

export type KategoriOption = { value: string; label: string };

export function kategoriOptions(jenis: "pemasukan" | "pengeluaran") {
  return jenis === "pemasukan"
    ? (KATEGORI_PEMASUKAN as readonly KategoriOption[])
    : (KATEGORI_PENGELUARAN as readonly KategoriOption[]);
}

/** Kategori default per pos — sama persis dengan `inferKategori` di server. */
export function defaultKategori(
  walletKey: WalletKey,
  jenis: "pemasukan" | "pengeluaran"
): string {
  if (jenis === "pemasukan") return "pemasukan_lain";

  switch (walletKey) {
    case "dokumen":
      return "biaya_dokumen_balik_nama";
    case "eksekusi":
      return "biaya_eksekusi_pengosongan";
    case "renovasi":
      return "biaya_renovasi";
    case "cadangan":
      return "penggunaan_dana_cadangan";
    case "utama":
    default:
      return "pembelian_aset";
  }
}

export function kategoriLabel(value: string) {
  const found = [...KATEGORI_PENGELUARAN, ...KATEGORI_PEMASUKAN].find(
    (item) => item.value === value
  );

  if (found) return found.label;

  if (value === "setoran_modal") return "Setoran modal";
  if (value === "talangan_investor") return "Talangan investor";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

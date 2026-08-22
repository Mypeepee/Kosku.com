import type { SelectedRegion } from "@/lib/regionSearch";
import type { TempatDipilih } from "@/lib/searchTabs";

export type KlienStatus =
  | "lead_baru"
  | "sudah_dikontak"
  | "hot_buyer"
  | "closing"
  | "lost_iseng";

export type SumberKlien =
  | "wa_organik"
  | "iklan"
  | "referral"
  | "website"
  | "walk_in"
  | "titip_jual"
  | "lainnya";

export type MetodePembayaran = "cash" | "kpr" | "cash_bertahap";

export type TujuanBeli = "ditempati" | "investasi" | "disewakan";

export type TipeProperti =
  | "RUMAH"
  | "APARTEMEN"
  | "RUKO"
  | "TANAH"
  | "GUDANG"
  | "HOTEL_DAN_VILLA"
  | "TOKO"
  | "PABRIK";

export type JenisTransaksi =
  | "PRIMARY"
  | "SECONDARY"
  | "LELANG"
  | "SEWA"
  | "CESSIE";

export interface PreferensiKlien {
  id_preferensi: string;
  id_klien: string;
  /** null = semua tipe. */
  tipe_properti: TipeProperti | null;
  jenis_transaksi: JenisTransaksi | null;
  lokasi_dicari: string | null;
  loc_provinsi: string | null;
  loc_kota: string | null;
  loc_kecamatan: string | null;
  loc_kelurahan: string | null;
  budget_min: number | null;
  budget_max: number | null;
  luas_min: number | null;
  luas_max: number | null;
  legalitas: Sertifikat | null;
  dekat_nilai: string | null;
  dekat_radius: number | null;
  alamat_teks: string | null;
  tujuan_beli: TujuanBeli | null;
  catatan: string | null;
  dibuat_pada: string;
}

export interface Klien {
  id_klien: string;
  id_agent: string;
  id_pengguna: string | null;
  id_lead_asal: string | null;
  id_properti_asal: string | null;
  nama: string;
  nomor_whatsapp: string | null;
  email: string | null;
  sumber: SumberKlien;
  metode_pembayaran: MetodePembayaran | null;
  bank_kpr: string | null;
  tenor_kpr: number | null;
  tanggal_masuk: string;
  tanggal_kontak_terakhir: string | null;
  tanggal_follow_up: string | null;
  status: KlienStatus;
  catatan: string | null;
  dibuat_pada: string;
  diperbarui_pada: string;
  preferensi: PreferensiKlien[];
  propertiAsal?: {
    id_property: string;
    judul: string;
    slug: string;
    kota: string;
    kategori: string;
    alamat_lengkap: string | null;
    jenis_transaksi: string;
  } | null;
}

/**
 * Form preferensi — satu kartu boleh memuat BANYAK tipe properti & BANYAK lokasi
 * (UX multi-select seperti search bar). Saat disimpan, kartu di-"expand" jadi
 * satu baris PreferensiKlien per kombinasi (tipe × lokasi); saat edit,
 * baris-baris yang sekriteria di-grup balik jadi satu kartu.
 */
export interface PreferensiForm {
  tipe_properti: TipeProperti[];
  jenis_transaksi: JenisTransaksi | "";
  locations: SelectedRegion[];
  budget_min: string;
  budget_max: string;
  luas_min: string;
  luas_max: string;
  /** "" = tidak mempermasalahkan. Itu keadaan bawaan dan yang paling sering
   *  benar — memaksa agent memilih akan membuatnya mengarang jawaban. */
  legalitas: Sertifikat | "";
  /** Tempat patokan, disimpan utuh supaya chip-nya bisa digambar ulang tanpa
   *  menanyakan kamus lagi. null = tanpa kriteria tempat. */
  dekat: TempatDipilih | null;
  /** Patokan teks alamat (nama jalan / perumahan). "" = tidak dipakai. */
  alamat_teks: string;
  tujuan_beli: TujuanBeli | "";
  catatan: string;
}

export interface KlienForm {
  nama: string;
  nomor_whatsapp: string;
  email: string;
  sumber: SumberKlien;
  status: KlienStatus;
  metode_pembayaran: MetodePembayaran | "";
  bank_kpr: string;
  tenor_kpr: string;
  catatan: string;
  tanggal_follow_up: string;
  preferensi: PreferensiForm[];
  // untuk konversi dari lead
  id_lead_asal?: string;
  id_properti_asal?: string;
}

export const STATUS_LABEL: Record<KlienStatus, string> = {
  lead_baru:      "Lead Baru",
  sudah_dikontak: "Sudah Dikontak",
  hot_buyer:      "Hot Buyer",
  closing:        "Closing",
  lost_iseng:     "Lost / Iseng",
};

export const STATUS_COLOR: Record<KlienStatus, string> = {
  lead_baru:      "bg-rose-500/15 text-rose-300 border-rose-400/25",
  sudah_dikontak: "bg-sky-500/15 text-sky-300 border-sky-400/25",
  hot_buyer:      "bg-amber-500/15 text-amber-300 border-amber-400/25",
  closing:        "bg-emerald-500/15 text-emerald-300 border-emerald-400/25",
  lost_iseng:     "bg-slate-500/15 text-slate-400 border-slate-400/20",
};

export const STATUS_ICON: Record<KlienStatus, string> = {
  lead_baru:      "solar:bell-bing-bold-duotone",
  sudah_dikontak: "solar:phone-calling-bold-duotone",
  hot_buyer:      "solar:fire-bold-duotone",
  closing:        "solar:document-text-bold-duotone",
  lost_iseng:     "solar:close-circle-bold-duotone",
};

export const SUMBER_LABEL: Record<SumberKlien, string> = {
  wa_organik: "WA Organik",
  iklan:      "Iklan",
  referral:   "Referral",
  website:    "Website",
  walk_in:    "Walk In",
  titip_jual: "Titip Jual",
  lainnya:    "Lainnya",
};

export const TIPE_PROPERTI_LABEL: Record<TipeProperti, string> = {
  RUMAH:         "Rumah",
  APARTEMEN:     "Apartemen",
  RUKO:          "Ruko",
  TANAH:         "Tanah",
  GUDANG:        "Gudang",
  HOTEL_DAN_VILLA: "Hotel & Villa",
  TOKO:          "Toko",
  PABRIK:        "Pabrik",
};

export const JENIS_TRANSAKSI_LABEL: Record<JenisTransaksi, string> = {
  PRIMARY:   "Primary",
  SECONDARY: "Secondary",
  LELANG:    "Lelang",
  SEWA:      "Sewa",
  CESSIE:    "Cessie",
};

/** Nilai `sertifikat_enum` di database. Urutannya sengaja dari yang paling
 *  sering diminta: SHM dipegang 107 ribu dari 120 ribu aset, HGB 12 ribu,
 *  sisanya ekor panjang. */
export type Sertifikat = "SHM" | "HGB" | "HGU" | "HP" | "AJB" | "PPJB" | "LAINNYA";

export const SERTIFIKAT_LABEL: Record<Sertifikat, string> = {
  SHM:     "SHM — Hak Milik",
  HGB:     "HGB — Hak Guna Bangunan",
  HGU:     "HGU — Hak Guna Usaha",
  HP:      "HP — Hak Pakai",
  AJB:     "AJB — Akta Jual Beli",
  PPJB:    "PPJB — Perjanjian Pengikatan",
  LAINNYA: "Lainnya",
};

export const EMPTY_PREFERENSI: PreferensiForm = {
  tipe_properti:   [],
  jenis_transaksi: "",
  locations:       [],
  budget_min:      "",
  budget_max:      "",
  luas_min:        "",
  luas_max:        "",
  legalitas:       "",
  dekat:           null,
  alamat_teks:     "",
  tujuan_beli:     "",
  catatan:         "",
};

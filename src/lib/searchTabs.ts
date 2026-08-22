/**
 * searchTabs — sumber tunggal konfigurasi pill transaksi (Semua | Jual | Lelang
 * | Sewa) beserta bentuk form pencarian yang menyertainya.
 *
 * Kenapa dipusatkan: search bar muncul di empat tempat (Home, Jual, Lelang,
 * Sewa) dan kriterianya BEDA per tab — sewa memakai Durasi + Harga Sewa,
 * sisanya memakai Harga + Dimensi (LT/LB). Sebelum ini tiap hero menyalin
 * sendiri daftar tipe, tujuan navigasi, dan perakitan query param, sehingga
 * satu perubahan kecil harus disentuh empat kali (dan sempat berbeda-beda,
 * mis. daftar tipe sewa di Home tidak sama dengan di halaman Sewa).
 */

import { setLocationParams, type SelectedRegion } from "@/lib/regionSearch";
import { serializeTypes, parseTypeParamToDisplays } from "@/lib/propertyType";

/** `beli` dipertahankan sebagai ID (label-nya saja yang tampil "Jual") supaya
 *  tidak perlu migrasi nilai yang sudah tersebar di URL & komponen lain. */
export type TxTab = "semua" | "beli" | "lelang" | "sewa";

export const TX_TABS: { id: TxTab; label: string; icon: string; href: string }[] = [
  { id: "semua",  label: "Semua",  icon: "solar:map-point-rotate-bold",        href: "/properti/semua" },
  { id: "beli",   label: "Jual",   icon: "solar:home-2-bold",                  href: "/Jual" },
  { id: "lelang", label: "Lelang", icon: "solar:tag-price-bold",               href: "/Lelang" },
  { id: "sewa",   label: "Sewa",   icon: "solar:key-minimalistic-square-bold", href: "/Sewa" },
];

const sortAlpha = (arr: string[]) => [...arr].sort((a, b) => a.localeCompare(b));

export const PROPERTY_ICONS: Record<string, string> = {
  Rumah: "solar:home-2-bold-duotone",
  Apartemen: "solar:buildings-2-bold-duotone",
  Gudang: "solar:box-minimalistic-bold-duotone",
  Tanah: "solar:map-point-wave-bold-duotone",
  Pabrik: "solar:garage-bold-duotone",
  Ruko: "solar:shop-2-bold-duotone",
  Toko: "solar:shop-bold-duotone",
  "Hotel & Villa": "solar:bed-bold-duotone",
  Kos: "solar:bed-bold-duotone",
};

export const BUY_TYPES = sortAlpha([
  "Rumah", "Tanah", "Gudang", "Apartemen", "Pabrik", "Ruko", "Toko", "Hotel & Villa",
]);

/**
 * Tipe yang relevan untuk SEWA. Empat teratas adalah yang paling dicari dan
 * sengaja TIDAK diurutkan abjad — urutan daftar di sini menentukan urutan
 * tampil di TypePicker, jadi yang diutamakan harus terbaca lebih dulu tanpa
 * perlu men-scroll. Sisanya baru menyusul menurut abjad.
 *
 * "Ruko" dan "Toko" sengaja dipisah (bukan satu opsi "Ruko & Toko" seperti
 * versi lama): label gabungan itu tidak punya padanan di enum kategori DB,
 * jadi param `tipe` yang dihasilkan selalu dibuang oleh parser di server dan
 * filternya tidak pernah benar-benar jalan.
 */
const RENT_TYPES_PRIORITAS = ["Kos", "Apartemen", "Rumah", "Gudang"];
const RENT_TYPES_LAINNYA = ["Ruko", "Toko"];

export const RENT_TYPES = [...RENT_TYPES_PRIORITAS, ...sortAlpha(RENT_TYPES_LAINNYA)];

/**
 * Ikon "semua opsi" yang dipakai seragam di setiap daftar pilihan (tipe aset,
 * durasi, gender). Sebelumnya `solar:apps-bold-duotone` — nama itu TIDAK ADA di
 * paket @iconify-json/solar, jadi barisnya merender ruang kosong tanpa error.
 */
export const ICON_SEMUA = "solar:widget-3-bold-duotone";

export const DURASI_OPTIONS: { value: string; label: string; icon: string }[] = [
  { value: "HARIAN", label: "Harian", icon: "solar:sun-2-bold-duotone" },
  { value: "MINGGUAN", label: "Mingguan", icon: "solar:calendar-minimalistic-bold-duotone" },
  { value: "BULANAN", label: "Bulanan", icon: "solar:calendar-date-bold-duotone" },
  { value: "TAHUNAN", label: "Tahunan", icon: "solar:calendar-mark-bold-duotone" },
];

export const GENDER_OPTIONS: { value: string; label: string; icon: string }[] = [
  { value: "PUTRA", label: "Putra", icon: "solar:men-bold" },
  { value: "PUTRI", label: "Putri", icon: "solar:women-bold" },
  { value: "CAMPUR", label: "Campur", icon: "solar:users-group-two-rounded-bold-duotone" },
];

export const isRentTab = (tab: TxTab) => tab === "sewa";

export const typeOptionsFor = (tab: TxTab) => (isRentTab(tab) ? RENT_TYPES : BUY_TYPES);

export const typeLabelFor = (tab: TxTab) => (isRentTab(tab) ? "Tipe Hunian" : "Tipe Aset");

export const keywordLabelFor = (tab: TxTab) => (isRentTab(tab) ? "Cari Hunian" : "Cari Properti");

export const destinationFor = (tab: TxTab) =>
  TX_TABS.find((t) => t.id === tab)?.href ?? "/properti/semua";

export const durasiLabelFor = (value: string) =>
  DURASI_OPTIONS.find((d) => d.value === value)?.label ?? "Semua Durasi";

const DURASI_UNIT: Record<string, string> = {
  HARIAN: "per hari",
  MINGGUAN: "per minggu",
  BULANAN: "per bulan",
  TAHUNAN: "per tahun",
};

/** Satuan harga sewa mengikuti durasi terpilih — dipakai di label & hint. */
export const durasiUnitFor = (value: string) => DURASI_UNIT[value] ?? "";

// --- Helper angka -----------------------------------------------------------

export const isNumericOnly = (val: string) => /^\d+$/.test(val.trim());

export const parseRawNumber = (val: string) =>
  val.replace(/\./g, "").replace(/[^0-9]/g, "");

export const formatIdNumber = (raw: string | number) => {
  const digits = parseRawNumber(String(raw));
  return digits ? new Intl.NumberFormat("id-ID").format(Number(digits)) : "";
};

// --- Bentuk state form ------------------------------------------------------

/**
 * Tempat yang dipilih user di kotak pencarian ("Dekat UNESA").
 *
 * Bentuknya sengaja memuat label & ikon, bukan cuma `nilai`: chip yang tampil
 * di search bar harus bisa dirender ULANG saat halaman dimuat dari URL, dan
 * memaksa setiap halaman menembak API dulu hanya untuk tahu cara menggambar
 * satu chip berarti chip itu berkedip di setiap kunjungan.
 */
export interface TempatDipilih {
  /** Nilai param `dekat`. Grup cabang berawalan "brand:". */
  nilai: string;
  nama: string;
  label: string;
  icon: string;
  warna: string;
  kota?: string | null;
  /** Radius bawaan kelas tempat ini, meter. */
  radius: number;
  cabang?: number;
  /**
   * True bila yang dipilih adalah JENIS tempat ("semua kampus di Malang"),
   * bukan tempat tertentu. Mengubah cara kalimatnya dirangkai di layar —
   * "Di sekitar UNESA" vs "Di sekitar semua kampus di Malang".
   */
  kelasSemua?: boolean;
}

export interface SearchFormState {
  keyword: string;
  /**
   * Tempat yang dipilih dari saran. Berdampingan dengan `keyword`, tidak
   * menggantikannya: keduanya bisa terisi ("kos murah" DEKAT UNESA), dan yang
   * satu tidak pernah menghapus yang lain diam-diam.
   */
  dekat: TempatDipilih | null;
  /** Radius yang dipilih user (meter). Kosong = pakai bawaan kelas tempat. */
  radius: string;
  locations: SelectedRegion[];
  types: string[];
  /** Harga jual/lelang (Rp, format id-ID). */
  minPrice: string;
  maxPrice: string;
  /** Harga sewa — DIPISAH dari harga jual supaya berpindah tab tidak membawa
   *  budget beli (mis. 500.000.000) ke kolom harga sewa per bulan. */
  minRent: string;
  maxRent: string;
  minLt: string;
  maxLt: string;
  minLb: string;
  maxLb: string;
  durasi: string;
  gender: string;
}

export type RangeField =
  | "minPrice" | "maxPrice"
  | "minRent"  | "maxRent"
  | "minLt"    | "maxLt"
  | "minLb"    | "maxLb";

export type RangeKey = "price" | "rent" | "lt" | "lb";

export type RangeErrors = Partial<Record<RangeKey, string>>;

export const RANGE_PAIRS: Record<RangeKey, { min: RangeField; max: RangeField; unit: string }> = {
  price: { min: "minPrice", max: "maxPrice", unit: "" },
  rent:  { min: "minRent",  max: "maxRent",  unit: "" },
  lt:    { min: "minLt",    max: "maxLt",    unit: " m²" },
  lb:    { min: "minLb",    max: "maxLb",    unit: " m²" },
};

export const RANGE_OF_FIELD: Record<RangeField, RangeKey> = {
  minPrice: "price", maxPrice: "price",
  minRent: "rent",   maxRent: "rent",
  minLt: "lt",       maxLt: "lt",
  minLb: "lb",       maxLb: "lb",
};

/** Range mana yang benar-benar tampil di tab ini — error pada range yang
 *  tersembunyi tidak boleh ikut memblokir tombol Cari. */
export const activeRangeKeys = (tab: TxTab): RangeKey[] =>
  isRentTab(tab) ? ["rent"] : ["price", "lt", "lb"];

export const EMPTY_SEARCH_STATE: SearchFormState = {
  keyword: "",
  dekat: null,
  radius: "",
  locations: [],
  types: [],
  minPrice: "",
  maxPrice: "",
  minRent: "",
  maxRent: "",
  minLt: "",
  maxLt: "",
  minLb: "",
  maxLb: "",
  durasi: "",
  gender: "",
};

export interface SearchInitial {
  q?: string;
  /** Tempat yang sedang disaring — dihidrasi server dari param `dekat`. */
  dekat?: TempatDipilih | null;
  radius?: number | string;
  idProperty?: string;
  kota?: string;
  tipe?: string;
  minHarga?: number;
  maxHarga?: number;
  minLT?: number;
  maxLT?: number;
  minLB?: number;
  maxLB?: number;
  durasi?: string;
  gender?: string;
}

/**
 * Hidrasi state form dari query URL halaman yang sedang dibuka.
 * `tab` menentukan ke kolom mana `minHarga/maxHarga` jatuh: harga sewa untuk
 * halaman Sewa, harga jual untuk sisanya.
 */
export function buildSearchState(
  init: SearchInitial,
  locations: SelectedRegion[],
  tab: TxTab
): SearchFormState {
  const rent = isRentTab(tab);
  const minHarga = init.minHarga ? formatIdNumber(init.minHarga) : "";
  const maxHarga = init.maxHarga ? formatIdNumber(init.maxHarga) : "";

  return {
    keyword: init.idProperty || init.q || "",
    dekat: init.dekat ?? null,
    radius: init.radius ? String(init.radius) : "",
    locations,
    types: parseTypeParamToDisplays(init.tipe),
    minPrice: rent ? "" : minHarga,
    maxPrice: rent ? "" : maxHarga,
    minRent: rent ? minHarga : "",
    maxRent: rent ? maxHarga : "",
    minLt: init.minLT ? formatIdNumber(init.minLT) : "",
    maxLt: init.maxLT ? formatIdNumber(init.maxLT) : "",
    minLb: init.minLB ? formatIdNumber(init.minLB) : "",
    maxLb: init.maxLB ? formatIdNumber(init.maxLB) : "",
    durasi: init.durasi || "",
    gender: init.gender || "",
  };
}

/** Rakit query string pencarian sesuai tab aktif. */
export function buildSearchParams(state: SearchFormState, tab: TxTab): URLSearchParams {
  const params = new URLSearchParams();

  const kw = state.keyword.trim();
  if (kw) {
    if (isNumericOnly(kw)) params.set("idProperty", kw);
    else params.set("q", kw);
  }

  if (state.dekat) {
    params.set("dekat", state.dekat.nilai);
    // Radius hanya ditulis bila BERBEDA dari bawaan kelasnya. URL yang bersih
    // lebih mudah dibaca saat dibagikan lewat WhatsApp, dan bawaan yang tidak
    // ditulis bebas diperbaiki nanti tanpa mematikan tautan lama.
    const r = Number(state.radius);
    if (Number.isFinite(r) && r > 0 && r !== state.dekat.radius) {
      params.set("radius", String(Math.round(r)));
    }
  }

  setLocationParams(params, state.locations);

  // Di /properti/semua, `tipe` dipakai untuk tab transaksi → multi-kategori
  // dikirim lewat `kategori`. Di Jual/Lelang/Sewa, `tipe` memang = kategori.
  const typeParam = serializeTypes(state.types);
  if (typeParam) params.set(tab === "semua" ? "kategori" : "tipe", typeParam);

  if (isRentTab(tab)) {
    if (state.durasi) params.set("durasi", state.durasi);
    // Gender hanya relevan (dan hanya bisa dipilih) saat tipe Kos aktif.
    if (state.types.includes("Kos") && state.gender) params.set("gender", state.gender);

    const min = parseRawNumber(state.minRent);
    const max = parseRawNumber(state.maxRent);
    if (min) params.set("minHarga", min);
    if (max) params.set("maxHarga", max);
  } else {
    const min = parseRawNumber(state.minPrice);
    const max = parseRawNumber(state.maxPrice);
    if (min) params.set("minHarga", min);
    if (max) params.set("maxHarga", max);

    const minLt = parseRawNumber(state.minLt);
    const maxLt = parseRawNumber(state.maxLt);
    if (minLt) params.set("minLT", minLt);
    if (maxLt) params.set("maxLT", maxLt);

    const minLb = parseRawNumber(state.minLb);
    const maxLb = parseRawNumber(state.maxLb);
    if (minLb) params.set("minLB", minLb);
    if (maxLb) params.set("maxLB", maxLb);
  }

  params.set("page", "1");
  return params;
}

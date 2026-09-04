/**
 * searchSummary — meringkas isi form pencarian menjadi (a) daftar chip filter
 * aktif yang bisa dilepas satu-satu dan (b) satu baris teks ringkas.
 *
 * Dipakai oleh command bar di layar kecil: search bar versi mobile tidak lagi
 * menampilkan lima kolom bertumpuk, melainkan satu baris berisi ringkasan ini
 * plus tombol filter ber-badge. Logika "filter apa saja yang sedang aktif"
 * dipusatkan di sini supaya badge, chip, dan teks ringkas tidak pernah beda
 * hitungan.
 */

import { regionLabel } from "@/lib/regionSearch";
import {
  durasiLabelFor,
  durasiUnitFor,
  isRentTab,
  parseRawNumber,
  PROPERTY_ICONS,
  GENDER_OPTIONS,
  type SearchFormState,
  type TxTab,
} from "@/lib/searchTabs";

export interface FilterChip {
  key: string;
  label: string;
  icon: string;
  /** Patch yang melepas filter ini saja — sisa form tidak tersentuh. */
  clear: Partial<SearchFormState>;
}

/** 1.500.000.000 → "1,5 M". Ringkasan harus muat di satu baris layar 320px. */
export function compactRupiah(value: string): string {
  const n = Number(parseRawNumber(value));
  if (!n) return "";

  const trim = (v: number) =>
    new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(v);

  if (n >= 1_000_000_000) return `${trim(n / 1_000_000_000)} M`;
  if (n >= 1_000_000) return `${trim(n / 1_000_000)} jt`;
  if (n >= 1_000) return `${trim(n / 1_000)} rb`;
  return trim(n);
}

const compactRange = (
  min: string,
  max: string,
  format: (v: string) => string,
  suffix = ""
) => {
  const lo = min ? format(min) : "";
  const hi = max ? format(max) : "";
  if (lo && hi) return `${lo} – ${hi}${suffix}`;
  if (lo) return `≥ ${lo}${suffix}`;
  if (hi) return `≤ ${hi}${suffix}`;
  return "";
};

const plainNumber = (value: string) => {
  const n = Number(parseRawNumber(value));
  return n ? new Intl.NumberFormat("id-ID").format(n) : "";
};

/**
 * Chip filter aktif, urut sesuai cara orang membaca hasil pencarian:
 * lokasi → tipe → (durasi) → harga → dimensi. Keyword TIDAK ikut karena sudah
 * tampil sebagai teks utama di command bar.
 */
export function buildFilterChips(state: SearchFormState, tab: TxTab): FilterChip[] {
  const chips: FilterChip[] = [];

  for (const loc of state.locations) {
    chips.push({
      key: `loc-${loc.level}-${loc.id}`,
      // Nama saja menyembunyikan justru yang membedakan: ada tiga kecamatan
      // "Taman" di Jawa Timur–Tengah. `regionLabel` menambahkan induk
      // terdekatnya jadi "Taman, Sidoarjo".
      label: regionLabel(loc),
      icon: "solar:map-point-bold-duotone",
      clear: {
        locations: state.locations.filter(
          (l) => !(l.level === loc.level && l.id === loc.id)
        ),
      },
    });
  }

  for (const type of state.types) {
    chips.push({
      key: `type-${type}`,
      label: type,
      icon: PROPERTY_ICONS[type] ?? "solar:home-2-bold-duotone",
      clear: { types: state.types.filter((t) => t !== type) },
    });
  }

  if (isRentTab(tab)) {
    if (state.durasi) {
      chips.push({
        key: "durasi",
        label: durasiLabelFor(state.durasi),
        icon: "solar:calendar-date-bold-duotone",
        clear: { durasi: "" },
      });
    }

    // Gender hanya dikirim ke server saat tipe Kos aktif — chip-nya ikut aturan
    // yang sama supaya badge tidak menghitung filter yang tak berpengaruh.
    if (state.gender && state.types.includes("Kos")) {
      chips.push({
        key: "gender",
        label:
          GENDER_OPTIONS.find((g) => g.value === state.gender)?.label ?? state.gender,
        icon: "solar:users-group-rounded-bold-duotone",
        clear: { gender: "" },
      });
    }

    const unit = durasiUnitFor(state.durasi);
    const rent = compactRange(
      state.minRent,
      state.maxRent,
      compactRupiah,
      unit ? ` ${unit.replace("per ", "/")}` : ""
    );
    if (rent) {
      chips.push({
        key: "rent",
        label: `Rp ${rent}`,
        icon: "solar:wallet-money-bold-duotone",
        clear: { minRent: "", maxRent: "" },
      });
    }
  } else {
    const price = compactRange(state.minPrice, state.maxPrice, compactRupiah);
    if (price) {
      chips.push({
        key: "price",
        label: `Rp ${price}`,
        icon: "solar:wallet-money-bold-duotone",
        clear: { minPrice: "", maxPrice: "" },
      });
    }

    const lt = compactRange(state.minLt, state.maxLt, plainNumber, " m²");
    if (lt) {
      chips.push({
        key: "lt",
        label: `LT ${lt}`,
        icon: "solar:map-bold-duotone",
        clear: { minLt: "", maxLt: "" },
      });
    }

    const lb = compactRange(state.minLb, state.maxLb, plainNumber, " m²");
    if (lb) {
      chips.push({
        key: "lb",
        label: `LB ${lb}`,
        icon: "solar:home-bold-duotone",
        clear: { minLb: "", maxLb: "" },
      });
    }
  }

  return chips;
}

/**
 * Placeholder command bar saat kolom kata kunci kosong. Filter yang sedang
 * aktif TIDAK ikut diringkas di sini: baris chip tepat di bawah bar sudah
 * menampilkannya satu per satu (dan bisa dilepas), jadi meringkasnya lagi di
 * dalam bar cuma menggandakan informasi yang sama di layar sesempit itu.
 */
export const emptySummaryFor = (tab: TxTab) =>
  isRentTab(tab) ? "Cari kos, apartemen, atau rumah" : "Cari alamat, area, atau ID";

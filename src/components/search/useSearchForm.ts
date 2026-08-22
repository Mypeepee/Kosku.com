"use client";

/**
 * useSearchForm — otak search bar yang dipakai bersama oleh Home, Jual,
 * Lelang, dan Sewa. Empat hero itu beda tampilan (terang/gelap, art hero
 * masing-masing) tapi perilakunya harus persis sama, terutama sejak pill
 * transaksi bisa mengubah kriteria yang tampil (sewa → Durasi + Harga Sewa).
 *
 * Hook ini sengaja TIDAK memanggil `useSearchParams()`. Home dirender di route
 * statis; memanggilnya di sana memaksa seluruh halaman masuk client-side
 * rendering (dan meminta Suspense boundary). Hero yang memang butuh hidrasi
 * URL yang menghitungnya sendiri lalu mengoper `hydratedLocations` + `navKey`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { SelectedRegion } from "@/lib/regionSearch";
import {
  activeRangeKeys,
  buildSearchParams,
  buildSearchState,
  destinationFor,
  EMPTY_SEARCH_STATE,
  formatIdNumber,
  isNumericOnly,
  parseRawNumber,
  RANGE_OF_FIELD,
  RANGE_PAIRS,
  typeOptionsFor,
  type RangeErrors,
  type RangeField,
  type RangeKey,
  type SearchFormState,
  type SearchInitial,
  type TxTab,
} from "@/lib/searchTabs";

const asNumber = (val: string) => Number(parseRawNumber(val)) || 0;

/** Pesan error untuk satu pasangan min–max, `undefined` kalau valid. */
function rangeErrorOf(state: SearchFormState, key: RangeKey): string | undefined {
  const { min, max, unit } = RANGE_PAIRS[key];
  if (!state[min] || !state[max]) return undefined;
  return asNumber(state[min]) > asNumber(state[max])
    ? `Max harus ≥ ${state[min]}${unit}`
    : undefined;
}

const allRangeErrors = (state: SearchFormState): RangeErrors =>
  (Object.keys(RANGE_PAIRS) as RangeKey[]).reduce<RangeErrors>((acc, key) => {
    acc[key] = rangeErrorOf(state, key);
    return acc;
  }, {});

interface Options {
  /** Tab bawaan = konteks halaman (Jual → "beli", Sewa → "sewa", dst). */
  initialTab?: TxTab;
  /** Nilai dari query URL halaman ini. Kosongkan untuk form yang selalu bersih. */
  initial?: SearchInitial;
  /** Wilayah terpilih hasil parse URL (sudah di-memo oleh pemanggil). */
  hydratedLocations?: SelectedRegion[];
  /** Berubah tiap query URL berubah — penanda navigasi selesai. */
  navKey?: string;
}

export function useSearchForm({
  initialTab = "semua",
  initial,
  hydratedLocations,
  navKey,
}: Options = {}) {
  const router = useRouter();

  const [activeTab, setActiveTabState] = useState<TxTab>(initialTab);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [rangeErrors, setRangeErrors] = useState<RangeErrors>({});
  const [shaking, setShaking] = useState(false);

  const [formData, setFormData] = useState<SearchFormState>(() =>
    initial || hydratedLocations
      ? buildSearchState(initial ?? {}, hydratedLocations ?? [], initialTab)
      : EMPTY_SEARCH_STATE
  );

  const hydrateEnabled = Boolean(initial || hydratedLocations);

  // Query URL berubah (mis. user menekan Cari lalu server render ulang) →
  // samakan lagi isi form dengan URL. Tab TIDAK ikut direset supaya pilihan
  // pill yang sedang dilihat user tidak melompat balik.
  useEffect(() => {
    if (!hydrateEnabled) return;
    setFormData(buildSearchState(initial ?? {}, hydratedLocations ?? [], initialTab));
    setRangeErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hydrateEnabled,
    initialTab,
    initial?.q,
    initial?.idProperty,
    initial?.tipe,
    initial?.minHarga,
    initial?.maxHarga,
    initial?.minLT,
    initial?.maxLT,
    initial?.minLB,
    initial?.maxLB,
    initial?.durasi,
    initial?.gender,
    initial?.dekat?.nilai,
    initial?.radius,
    hydratedLocations,
  ]);

  // Hasil baru sudah ter-render → lepas state "Mencari...".
  useEffect(() => {
    setSearching(false);
  }, [navKey]);

  // Failsafe: kalau navigasi menggantung, tombol pulih sendiri.
  useEffect(() => {
    if (!searching) return;
    const t = setTimeout(() => setSearching(false), 8000);
    return () => clearTimeout(t);
  }, [searching]);

  // --- Tutup dropdown saat klik di luar kartu ---
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element;
      // Panel LocationPicker/TypePicker di-portal ke <body> — kliknya bukan
      // "di luar" secara logis meski di luar secara DOM.
      if (target?.closest?.("[data-search-portal]")) return;
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Turunan ---
  const keywordTrimmed = formData.keyword.trim();
  const keywordMode: "id" | "alamat" | null =
    keywordTrimmed === "" ? null : isNumericOnly(keywordTrimmed) ? "id" : "alamat";

  /** True saat sebuah tempat sedang dipilih — UI menampilkan chip, bukan teks. */
  const adaTempat = Boolean(formData.dekat);

  /**
   * Kota yang sedang jadi konteks pencarian, untuk memeringkat saran tempat.
   *
   * Diambil dari wilayah terpilih tingkat kota. Hanya MENAIKKAN saran di kota
   * itu, tidak pernah menyaring — orang yang sedang melihat Surabaya dan
   * mengetik "ugm" tetap berhak menemukan Yogyakarta, karena besar kemungkinan
   * ia memang sedang mencari kos untuk anaknya yang kuliah di sana.
   */
  const kotaKonteks = useMemo(
    () => formData.locations.find((l) => l.level === "kota")?.name ?? null,
    [formData.locations],
  );

  /** Pilih tempat dari saran, lalu langsung cari — itu yang diharapkan orang
   *  saat mengklik sebuah saran: satu klik, satu hasil. */
  const pilihTempat = useCallback(
    (tempat: SearchFormState["dekat"]) => {
      setFormData((f) => {
        const next: SearchFormState = { ...f, dekat: tempat, radius: "" };
        // Kata kunci yang tadi diketik ("deket unesa") sudah terwakili chip;
        // membiarkannya berarti hasilnya disaring dua kali — sekali sebagai
        // tempat, sekali sebagai teks yang tidak akan cocok ke alamat mana pun.
        if (tempat) next.keyword = "";
        return next;
      });
      setOpenDropdown(null);
    },
    [],
  );

  const isKosSelected = formData.types.includes("Kos");
  const showGenderRow = activeTab === "sewa" && isKosSelected;

  const patch = useCallback((next: Partial<SearchFormState>) => {
    setFormData((prev) => ({ ...prev, ...next }));
  }, []);

  /**
   * Ganti pill transaksi. Nilai form sengaja DIPERTAHANKAN (kecuali tipe yang
   * memang tidak ada di tab tujuan) — harga jual & harga sewa disimpan di
   * kolom berbeda, jadi bolak-balik tab tidak pernah menghapus input user.
   */
  const setActiveTab = useCallback((tab: TxTab) => {
    setActiveTabState((prev) => (prev === tab ? prev : tab));
    // Dropdown yang sedang terbuka bisa jadi milik kolom yang baru saja
    // digantikan (mis. panel Dimensi saat pindah ke Sewa) — selalu tutup.
    setOpenDropdown(null);
    setFormData((f) => {
      const allowed = typeOptionsFor(tab);
      const types = f.types.filter((t) => allowed.includes(t));
      return types.length === f.types.length ? f : { ...f, types };
    });
  }, []);

  /** Input angka ber-format (harga/luas) + validasi pasangan min–max. */
  const handleRangeChange = useCallback(
    (field: RangeField, rawValue: string) => {
      const next: SearchFormState = { ...formData, [field]: formatIdNumber(rawValue) };
      const key = RANGE_OF_FIELD[field];

      setFormData(next);
      setRangeErrors((prev) => ({ ...prev, [key]: rangeErrorOf(next, key) }));
    },
    [formData]
  );

  /**
   * Ubah beberapa field sekaligus lalu validasi ULANG semua pasangan range.
   * Dipakai jalur yang menulis lebih dari satu field dalam satu ketukan (chip
   * preset harga, melepas chip filter): `handleRangeChange` dipanggil dua kali
   * beruntun akan saling menimpa karena keduanya membaca `formData` yang sama,
   * dan error lama bisa menggantung padahal nilainya sudah diganti.
   */
  const patchRange = useCallback(
    (next: Partial<SearchFormState>) => {
      const merged: SearchFormState = { ...formData, ...next };
      setFormData(merged);
      setRangeErrors(allRangeErrors(merged));
    },
    [formData]
  );

  /** Kosongkan seluruh isian (tombol "Reset"/"Hapus semua"). */
  const resetForm = useCallback(() => {
    setFormData(EMPTY_SEARCH_STATE);
    setRangeErrors({});
  }, []);

  /** Error yang benar-benar relevan untuk tab aktif (kolom yang tampil saja). */
  const blockingError = useMemo(
    () => activeRangeKeys(activeTab).some((k) => Boolean(rangeErrors[k])),
    [activeTab, rangeErrors]
  );

  const shake = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  }, []);

  /**
   * Jalankan pencarian dari state eksplisit. Dipisah dari `handleSearch` karena
   * pintasan (chip) perlu langsung mencari dengan hasil patch — `setFormData`
   * belum tentu ter-flush saat baris berikutnya jalan.
   */
  const runSearch = useCallback(
    (state: SearchFormState = formData, tab: TxTab = activeTab) => {
      if (searching) return;
      if (activeRangeKeys(tab).some((k) => Boolean(rangeErrors[k]))) {
        toast.error("Perbaiki range nilai sebelum mencari", { icon: "⚠️" });
        shake();
        return;
      }
      const params = buildSearchParams(state, tab);
      setSearching(true);
      setOpenDropdown(null);
      router.push(`${destinationFor(tab)}?${params.toString()}`);
    },
    [activeTab, formData, rangeErrors, router, searching, shake]
  );

  const handleSearch = useCallback(() => runSearch(), [runSearch]);

  return {
    // state
    formData,
    setFormData,
    patch,
    patchRange,
    resetForm,
    activeTab,
    setActiveTab,
    openDropdown,
    setOpenDropdown,
    searching,
    shaking,
    rangeErrors,
    blockingError,
    // turunan
    keywordMode,
    adaTempat,
    kotaKonteks,
    pilihTempat,
    isKosSelected,
    showGenderRow,
    wrapperRef,
    // aksi
    handleRangeChange,
    handleSearch,
    runSearch,
  };
}

export type SearchFormApi = ReturnType<typeof useSearchForm>;

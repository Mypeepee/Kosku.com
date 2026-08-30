"use client";

/**
 * MobileSearchDock — wajah search bar di layar kecil (< lg).
 *
 * Versi lama menumpuk kelima kolom search bar secara vertikal, sehingga
 * pembukaan halaman Jual/Lelang/Sewa dihabiskan filter dan katalog properti
 * baru terlihat setelah user men-scroll satu layar penuh. Di sini filter
 * diringkas jadi SATU baris (command bar) berisi ringkasan filter aktif +
 * tombol ber-badge; seluruh kolomnya pindah ke bottom sheet yang dibuka
 * sengaja oleh user. Pola yang sama dipakai Airbnb/Zillow/Rumah123 di mobile.
 *
 * Isi sheet sengaja TIDAK memakai `TabFilterFields`: komponen itu berbasis
 * popover melayang yang di dalam sheet akan bertumpuk-tumpuk. Di mobile semua
 * kriteria dirender inline (chip + input langsung) — satu layar, tanpa lapisan
 * dropdown. Otak form-nya tetap satu: `useSearchForm` milik hero pemanggil.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  motion,
  useDragControls,
  type PanInfo,
} from "framer-motion";
import { Icon } from "@iconify/react";
import LocationPicker from "@/components/search/LocationPicker";
import TypePicker from "@/components/search/TypePicker";
import TransactionTabs from "@/components/search/TransactionTabs";
import TempatSaranPanel, {
  type SaranTempatUi,
} from "@/components/search/TempatSaranPanel";
import ContohKetikan, {
  type JenisContoh,
} from "@/components/search/ContohKetikan";
import { buildFilterChips, emptySummaryFor } from "@/lib/searchSummary";
import {
  DURASI_OPTIONS,
  GENDER_OPTIONS,
  ICON_SEMUA,
  PROPERTY_ICONS,
  durasiUnitFor,
  formatIdNumber,
  isNumericOnly,
  isRentTab,
  keywordLabelFor,
  parseRawNumber,
  typeLabelFor,
  typeOptionsFor,
  type RangeErrors,
  type RangeField,
  type SearchFormState,
  type TempatDipilih,
  type TxTab,
} from "@/lib/searchTabs";

type Theme = "light" | "dark";

interface ThemeTokens {
  bar: string;
  barActive: string;
  barIcon: string;
  barText: string;
  barPlaceholder: string;
  barDivider: string;
  filterBtn: string;
  chip: string;
  sheet: string;
  grabber: string;
  sheetTitle: string;
  sheetSub: string;
  closeBtn: string;
  card: string;
  cardLabel: string;
  input: string;
  inputError: string;
  error: string;
  optionIdle: string;
  footer: string;
  resetBtn: string;
  scrim: string;
}

const THEMES: Record<Theme, ThemeTokens> = {
  dark: {
    bar: "bg-white/[0.06] border-white/[0.12] shadow-[0_18px_50px_-24px_rgba(0,0,0,0.95)]",
    barActive:
      "bg-primary/[0.09] border-primary/40 shadow-[0_0_34px_-12px_rgba(153,227,158,0.85)]",
    barIcon: "bg-primary/15 text-primary",
    barText: "text-white",
    barPlaceholder: "text-white/45",
    barDivider: "bg-white/10",
    filterBtn: "text-white/70",
    chip: "bg-white/[0.07] border-white/[0.12] text-white/85",
    sheet: "bg-[#0B1113] border-white/10",
    grabber: "bg-white/25",
    sheetTitle: "text-white",
    sheetSub: "text-white/45",
    closeBtn: "bg-white/[0.07] text-white/70 hover:text-white",
    card: "bg-white/[0.04] border-white/[0.08]",
    cardLabel: "text-white/45",
    input:
      "bg-white/[0.05] border-white/10 text-white placeholder:text-white/30 focus:border-primary/60",
    inputError: "border-red-500/70",
    error: "text-red-400",
    optionIdle: "bg-white/[0.05] border-white/10 text-white/75 active:bg-white/10",
    footer: "bg-[#0B1113]/95 border-white/10",
    resetBtn: "text-white/55 active:text-red-400",
    scrim: "bg-black/70",
  },
  light: {
    bar: "bg-white border-gray-200 shadow-[0_18px_45px_-22px_rgba(0,0,0,0.45)]",
    barActive:
      "bg-white border-primary/60 shadow-[0_0_30px_-10px_rgba(153,227,158,0.9)]",
    barIcon: "bg-primary/15 text-emerald-600",
    barText: "text-gray-900",
    barPlaceholder: "text-gray-400",
    barDivider: "bg-gray-200",
    filterBtn: "text-gray-500",
    chip: "bg-gray-100 border-gray-200 text-gray-700",
    sheet: "bg-white border-gray-200",
    grabber: "bg-gray-300",
    sheetTitle: "text-gray-900",
    sheetSub: "text-gray-400",
    closeBtn: "bg-gray-100 text-gray-500 hover:text-gray-900",
    card: "bg-gray-50 border-gray-100",
    cardLabel: "text-gray-400",
    input:
      "bg-white border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-primary",
    inputError: "border-red-400",
    error: "text-red-500",
    optionIdle: "bg-white border-gray-200 text-gray-600 active:bg-gray-100",
    footer: "bg-white/95 border-gray-100",
    resetBtn: "text-gray-500 active:text-red-500",
    scrim: "bg-black/50",
  },
};

/**
 * Preset budget jual/lelang. Sengaja EMPAT, bukan lima: empat kolom masih muat
 * satu baris penuh dengan label bahasa manusia ("500jt–1M") di layar 320px,
 * sementara lima kolom memaksa label disingkat sampai ambigu atau terpotong.
 * Rentang yang tidak terwakili tetap bisa diisi lewat input Min/Max di bawahnya.
 */
const PRICE_PRESETS: { label: string; min: string; max: string }[] = [
  { label: "≤ 500jt", min: "", max: "500000000" },
  { label: "500jt–1M", min: "500000000", max: "1000000000" },
  { label: "1–2 M", min: "1000000000", max: "2000000000" },
  { label: "≥ 2 M", min: "2000000000", max: "" },
];

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Pasang di `onMouseDown` tombol mana pun yang bisa ditekan SELAGI kolom teks
 * masih fokus. Tanpa ini tap pertamanya sering hilang, lewat rantai:
 *
 *   tap → input blur → keyboard virtual turun → visualViewport membesar →
 *   sheet (yang tingginya mengikuti viewport itu) berubah ukuran → tombolnya
 *   bergeser dari bawah jari → browser membatalkan `click`.
 *
 * Efeknya user harus menekan dua kali. `preventDefault` di mousedown menahan
 * perpindahan fokus, jadi keyboard tidak turun, layout tidak bergeser, dan tap
 * pertama sampai ke `onClick`. Tombol tetap berfungsi lewat keyboard/aksesibilitas
 * karena yang dicegah hanya default mousedown, bukan event klik itu sendiri.
 */
const keepFocus = (e: React.MouseEvent) => e.preventDefault();

export interface MobileSearchDockProps {
  tab: TxTab;
  onTabChange: (tab: TxTab) => void;
  state: SearchFormState;
  /** Merge biasa (keyword, lokasi, tipe, durasi, gender). */
  patch: (next: Partial<SearchFormState>) => void;
  /** Merge yang memvalidasi ulang SEMUA pasangan range — dipakai chip preset. */
  patchRange: (next: Partial<SearchFormState>) => void;
  resetForm: () => void;
  errors: RangeErrors;
  onRangeChange: (field: RangeField, rawValue: string) => void;
  searching: boolean;
  onSubmit: () => void;
  /**
   * Pilih/hapus tempat dari saran. Tanpa handler ini saran tempat dimatikan —
   * dock tetap berfungsi persis seperti sebelumnya.
   */
  onPilihTempat?: (tempat: TempatDipilih | null) => void;
  /** Kota yang sedang dilihat — menaikkan saran di kota itu, tidak menyaring. */
  kotaKonteks?: string | null;
  theme?: Theme;
  className?: string;
}

export default function MobileSearchDock({
  tab,
  onTabChange,
  state,
  patch,
  patchRange,
  resetForm,
  errors,
  onRangeChange,
  searching,
  onSubmit,
  onPilihTempat,
  kotaKonteks = null,
  theme = "dark",
  className = "",
}: MobileSearchDockProps) {
  const t = THEMES[theme];
  const rent = isRentTab(tab);

  const [open, setOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const keywordRef = useRef<HTMLInputElement>(null);
  const kotakKeywordRef = useRef<HTMLDivElement>(null);
  /** Area isi sheet yang bisa di-scroll — lihat efek "naikkan ke atas" di bawah. */
  const isiSheetRef = useRef<HTMLDivElement>(null);

  // ── Saran tempat ("deket unesa") ─────────────────────────────────────────
  const [fokusKeyword, setFokusKeyword] = useState(false);
  const [saranTempat, setSaranTempat] = useState<SaranTempatUi[]>([]);
  /** Tawaran pembuka — lihat catatan yang sama di KeywordField. */
  const [populer, setPopuler] = useState<SaranTempatUi[]>([]);
  /** Tawaran "cari sebagai alamat" + jumlahnya — lihat catatan di panel. */
  const [alamat, setAlamat] = useState<{ teks: string; jumlah: number | null } | null>(
    null,
  );
  const [memuatSaran, setMemuatSaran] = useState(false);
  const [saranAktif, setSaranAktif] = useState(0);
  const [kueriSaran, setKueriSaran] = useState("");
  /** Jenis contoh yang sedang diketik sendiri di kolom sheet — untuk lencana. */
  const [jenisContoh, setJenisContoh] = useState<JenisContoh | null>(null);
  /** Sheet dibuka lewat area teks → langsung fokus ke kolom kata kunci. */
  const autoFocusKeyword = useRef(false);
  /** Geser-untuk-tutup HANYA dari header. Kalau `drag` dipasang di seluruh
   *  sheet, sapuan jari untuk men-scroll isi filter ikut menyeret sheet-nya. */
  const dragControls = useDragControls();

  useEffect(() => setMounted(true), []);

  const chips = useMemo(() => buildFilterChips(state, tab), [state, tab]);
  const count = chips.length;
  const keyword = state.keyword.trim();

  /**
   * Ambil saran tempat sambil diketik. Aturannya sama persis dengan
   * KeywordField di desktop — jeda 220 ms dan pembatalan permintaan yang
   * kedaluwarsa — karena keduanya melayani orang yang sama, hanya di layar
   * yang berbeda.
   */
  useEffect(() => {
    if (!onPilihTempat || !open) return;
    if (keyword.length < 2 || isNumericOnly(keyword)) {
      setSaranTempat([]);
      setAlamat(null);
      setMemuatSaran(false);
      return;
    }
    const ac = new AbortController();
    const jam = setTimeout(async () => {
      setMemuatSaran(true);
      try {
        const url =
          `/api/tempat/cari?q=${encodeURIComponent(keyword)}&tx=${
            isRentTab(tab) ? "sewa" : tab === "beli" || tab === "lelang" ? tab : "semua"
          }` + (kotaKonteks ? `&kota=${encodeURIComponent(kotaKonteks)}` : "");
        const res = await fetch(url, { signal: ac.signal });
        const json = await res.json();
        setSaranTempat(Array.isArray(json?.items) ? json.items : []);
        setAlamat(json?.alamat ?? null);
        setKueriSaran(keyword);
        setSaranAktif(0);
      } catch {
        // Termasuk pembatalan karena ketikan berikutnya — bukan kesalahan.
      } finally {
        setMemuatSaran(false);
      }
    }, 220);
    return () => {
      clearTimeout(jam);
      ac.abort();
    };
  }, [keyword, kotaKonteks, tab, onPilihTempat, open]);

  useEffect(() => {
    if (!onPilihTempat || !open || populer.length > 0) return;
    let batal = false;
    (async () => {
      try {
        const url =
          "/api/tempat/cari?populer=1" +
          (kotaKonteks ? `&kota=${encodeURIComponent(kotaKonteks)}` : "");
        const res = await fetch(url);
        const json = await res.json();
        if (!batal && Array.isArray(json?.items)) setPopuler(json.items);
      } catch {
        // Sheet-nya tetap berfungsi penuh tanpa tawaran pembuka.
      }
    })();
    return () => {
      batal = true;
    };
  }, [onPilihTempat, open, kotaKonteks, populer.length]);

  const pilihSaran = (saran: SaranTempatUi) => {
    onPilihTempat?.({
      nilai: saran.nilai,
      nama: saran.nama,
      label: saran.label,
      icon: saran.icon,
      warna: saran.warna,
      kota: saran.kota,
      radius: saran.radius,
      cabang: saran.cabang,
      kelasSemua: saran.kelasSemua,
    });
    setSaranTempat([]);
    setFokusKeyword(false);
    keywordRef.current?.blur();
  };

  const modePopuler =
    Boolean(onPilihTempat) && !state.dekat && keyword.length < 2 && populer.length > 0;
  const daftarSaran = modePopuler ? populer : saranTempat;

  const adaAlamat = Boolean(alamat) && !modePopuler;

  const panelSaranTerbuka =
    Boolean(onPilihTempat) &&
    open &&
    fokusKeyword &&
    ((keyword.length >= 2 &&
      !isNumericOnly(keyword) &&
      (daftarSaran.length > 0 || adaAlamat || memuatSaran)) ||
      modePopuler);

  /**
   * Begitu daftar saran muncul, isi sheet dinaikkan ke posisi paling atas.
   *
   * Panelnya menyatu dengan alur (bukan melayang), jadi ia mendorong kolom di
   * bawahnya alih-alih menutupinya — dan kolom kata kunci memang seksi pertama.
   * Menggeser ke atas memberi daftar itu ruang penuh yang tersisa di atas
   * keyboard, sekaligus menjaga kotak yang sedang diketik tetap terlihat.
   *
   * Hanya dijalankan saat panel BARU terbuka: memanggilnya pada tiap ketikan
   * akan merebut kembali gulir yang barusan dilakukan pemakai untuk membaca
   * saran ke-tujuh.
   */
  useEffect(() => {
    if (!panelSaranTerbuka) return;
    const el = isiSheetRef.current;
    if (!el || el.scrollTop === 0) return;
    el.scrollTo({ top: 0, behavior: "smooth" });
  }, [panelSaranTerbuka]);


  // Kunci scroll body selama sheet terbuka — tanpa ini konten di belakang ikut
  // bergeser saat user men-scroll isi sheet sampai mentok (scroll chaining).
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  /**
   * Sheet ini ber-anchor di BAWAH dan berisi input teks — kombinasi yang paling
   * rawan tertutup keyboard virtual: `position: fixed; bottom: 0` mengacu ke
   * layout viewport, yang di iOS TIDAK menyusut saat keyboard naik, sehingga
   * footer & input terbawah hilang di balik keyboard. Solusinya: kotak pembungkus
   * disamakan dengan visualViewport (tinggi + offset), jadi "bawah layar" bagi
   * sheet selalu berarti tepat di atas keyboard.
   */
  const [viewport, setViewport] = useState<{ height: number; top: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setViewport({ height: vv.height, top: vv.offsetTop });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [open]);

  // Fokus kata kunci ditunda sampai animasi sheet hampir selesai — memanggil
  // focus() saat sheet masih meluncur membuat browser menghitung posisi scroll
  // dari koordinat yang sebentar lagi berubah.
  useEffect(() => {
    if (!open || !autoFocusKeyword.current) return;
    const id = setTimeout(() => keywordRef.current?.focus(), 320);
    return () => clearTimeout(id);
  }, [open]);

  // Escape menutup sheet, KECUALI saat panel lokasi/tipe sedang terbuka di
  // atasnya — panel itu punya handler Escape sendiri dan harus tertutup dulu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !locationOpen && !typeOpen) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, locationOpen, typeOpen]);

  const openSheet = (focusKeyword = false) => {
    autoFocusKeyword.current = focusKeyword;
    setOpen(true);
  };

  const closeSheet = () => {
    setLocationOpen(false);
    setTypeOpen(false);
    setOpen(false);
  };

  const submitAndClose = () => {
    closeSheet();
    onSubmit();
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 700) closeSheet();
  };

  const types = typeOptionsFor(tab);
  const showGender = rent && state.types.includes("Kos");
  const unit = durasiUnitFor(state.durasi);

  const keywordMode: "id" | "alamat" | null =
    keyword === "" ? null : isNumericOnly(keyword) ? "id" : "alamat";

  const isPresetActive = (p: { min: string; max: string }) =>
    parseRawNumber(state.minPrice) === p.min && parseRawNumber(state.maxPrice) === p.max;

  // ---------------------------------------------------------------- sub-render

  const rangeInputs = (
    minField: RangeField,
    maxField: RangeField,
    errorKey: keyof RangeErrors,
    placeholderMin: string,
    placeholderMax: string,
    ariaPrefix: string
  ) => {
    const error = errors[errorKey];
    const cls = `w-full rounded-xl border px-3 py-2.5 text-sm font-bold outline-none transition-colors ${t.input} ${
      error ? t.inputError : ""
    }`;
    return (
      <>
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            aria-label={`${ariaPrefix} minimum`}
            aria-invalid={Boolean(error)}
            placeholder={placeholderMin}
            value={state[minField]}
            onChange={(e) => onRangeChange(minField, e.target.value)}
            className={cls}
          />
          <span className={`shrink-0 text-xs font-bold ${t.cardLabel}`}>s/d</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            aria-label={`${ariaPrefix} maksimum`}
            aria-invalid={Boolean(error)}
            placeholder={placeholderMax}
            value={state[maxField]}
            onChange={(e) => onRangeChange(maxField, e.target.value)}
            className={cls}
          />
        </div>
        {error && (
          <p className={`mt-2 flex items-center gap-1 text-[11px] font-medium ${t.error}`}>
            <Icon icon="solar:danger-triangle-bold-duotone" className="shrink-0 text-sm" />
            {error}
          </p>
        )}
      </>
    );
  };

  const section = (
    label: string,
    icon: string,
    children: React.ReactNode,
    hint?: string
  ) => (
    <div className={`rounded-2xl border p-3.5 ${t.card}`}>
      <div className="mb-2.5 flex items-center gap-1.5">
        <Icon icon={icon} className="text-sm text-primary" />
        <span
          className={`text-[10px] font-extrabold uppercase tracking-[0.14em] ${t.cardLabel}`}
        >
          {label}
        </span>
      </div>
      {children}
      {hint && <p className={`mt-2 text-[10px] leading-snug ${t.sheetSub}`}>{hint}</p>}
    </div>
  );

  /**
   * Ubin pilihan: ikon di atas, label di bawah, lebar mengikuti sel grid.
   *
   * Dipakai untuk daftar pendek yang tiap opsinya punya simbol khas (durasi,
   * gender). Menaruh ikon di SAMPING label akan melebarkan chip ~17px masing-
   * masing dan mendorong lima opsi durasi jadi dua baris; ditumpuk, kelimanya
   * tetap satu baris dan simbolnya justru lebih terbaca.
   */
  const tile = (
    key: string,
    label: string,
    icon: string,
    active: boolean,
    onClick: () => void
  ) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 transition-all active:scale-95 ${
        active
          ? "border-primary bg-primary text-darkmode shadow-[0_0_18px_-6px_rgba(153,227,158,0.9)]"
          : t.optionIdle
      }`}
    >
      <Icon icon={icon} className="shrink-0 text-base" />
      <span className="w-full truncate text-center text-[9px] font-bold leading-none tracking-tight">
        {label}
      </span>
    </button>
  );

  /**
   * Chip pilihan teks. `block` = mengisi penuh sel grid (preset harga yang
   * dibariskan rata); tanpa itu chip melebar seperlunya lalu membungkus.
   *
   * Preset harga sengaja tanpa simbol: nilainya rentang angka, dan ikon dompet
   * yang sama di keempat chip tidak membedakan apa pun — hanya memakan lebar.
   * Simbolnya sudah ada di judul seksi.
   */
  const pill = (
    key: string,
    label: string,
    active: boolean,
    onClick: () => void,
    block = false
  ) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border font-bold tracking-tight transition-all active:scale-95 ${
        block ? "w-full px-1 py-2 text-[10px]" : "px-2.5 py-2 text-[10px]"
      } ${
        active
          ? "border-primary bg-primary text-darkmode shadow-[0_0_18px_-6px_rgba(153,227,158,0.9)]"
          : t.optionIdle
      }`}
    >
      {label}
    </button>
  );

  // ------------------------------------------------------------------- sheet

  const sheet = mounted
    ? createPortal(
        <AnimatePresence>
          {open && (
            <div
              /* `zoom-safe`: sheet ini di-portal ke <body>, jadi ia BERADA DI
                 LUAR pembungkus .zoom-safe milik hero — dan tanpa kelas ini
                 setiap ketukan pada kolom teks di dalamnya membuat iOS
                 melompat-zoom. Aturannya ada di globals.css. */
              className="zoom-safe fixed inset-x-0 top-0 z-[9000] h-[100dvh] lg:hidden"
              style={
                viewport
                  ? { height: viewport.height, top: viewport.top }
                  : undefined
              }
              data-search-portal="true"
            >
              {/* Latar gelap. Sengaja BUKAN <button>: aksi tutup yang bisa
                  diakses sudah diwakili tombol X dan tombol Escape, sementara
                  scrim ber-aria-label sama hanya menghasilkan dua tombol
                  "Tutup filter" kembar di pembaca layar. */}
              <motion.div
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onMouseDown={keepFocus}
                onClick={closeSheet}
                className={`absolute inset-0 h-full w-full backdrop-blur-sm ${t.scrim}`}
              />

              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="Filter pencarian"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 360, damping: 36 }}
                drag="y"
                dragListener={false}
                dragControls={dragControls}
                dragElastic={{ top: 0, bottom: 0.4 }}
                dragConstraints={{ top: 0, bottom: 0 }}
                onDragEnd={onDragEnd}
                className={`absolute inset-x-0 bottom-0 flex max-h-full flex-col rounded-t-[1.75rem] border-t shadow-[0_-24px_70px_-20px_rgba(0,0,0,0.9)] ${t.sheet}`}
              >
                {/* --- HEADER: grabber + judul + tab transaksi --- */}
                <div className="shrink-0 px-5 pt-3">
                  {/* Zona seret. Sengaja TIDAK mencakup baris pill transaksi —
                      `touch-action: none` di atas tombol membuat tap-nya terasa
                      "berat" karena browser menunggu gestur yang tak pernah ada. */}
                  <div
                    onPointerDown={(e) => dragControls.start(e)}
                    style={{ touchAction: "none" }}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <div className="-mt-1 mb-3 flex justify-center py-1.5" aria-hidden="true">
                      <span className={`h-1 w-10 rounded-full ${t.grabber}`} />
                    </div>
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className={`text-lg font-black tracking-tight ${t.sheetTitle}`}>
                          Filter Pencarian
                        </h2>
                        <p className={`mt-0.5 text-[11px] font-medium ${t.sheetSub}`}>
                          {count > 0
                            ? `${count} filter aktif`
                            : "Persempit hasil sesuai kebutuhanmu"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={closeSheet}
                        onPointerDown={(e) => e.stopPropagation()}
                        onMouseDown={keepFocus}
                        aria-label="Tutup filter"
                        /* `before:-inset-2` melebarkan area sentuh jadi ~52px
                           tanpa mengubah ukuran lingkaran yang terlihat. */
                        className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90 before:absolute before:-inset-2 before:content-[''] ${t.closeBtn}`}
                      >
                        <Icon icon="solar:close-circle-bold" className="text-xl" />
                      </button>
                    </div>
                  </div>

                  {/* Pill transaksi ikut masuk sheet: mengganti tab mengubah
                      kriteria yang tampil, jadi harus bisa diubah dari sini
                      tanpa menutup sheet lebih dulu. */}
                  <TransactionTabs
                    active={tab}
                    onChange={onTabChange}
                    pillId="txTabPillSheet"
                    className="mb-4"
                  />
                </div>

                {/* --- BODY --- */}
                <div
                  ref={isiSheetRef}
                  className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-5 pb-5"
                >
                  {/* Kata kunci — sekaligus pencarian TEMPAT ("deket unesa").
                      Sarannya wajib ada di sini, bukan cuma di desktop: yang
                      mengetik "deket kampus" hampir selalu sedang di jalan,
                      dan halaman inilah yang ia buka. */}
                  {section(
                    state.dekat
                      ? "Dekat tempat"
                      : keywordLabelFor(tab),
                    state.dekat
                      ? "solar:map-point-bold-duotone"
                      : keywordMode === "id"
                        ? "solar:hashtag-square-bold-duotone"
                        : "solar:magnifer-bold-duotone",
                    <div className="relative" ref={kotakKeywordRef}>
                      {state.dekat && (
                        <button
                          type="button"
                          onClick={() => onPilihTempat?.(null)}
                          className={`mb-2 inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-bold ${t.input}`}
                          title="Hapus filter tempat"
                        >
                          <span
                            className="grid h-5 w-5 shrink-0 place-items-center rounded-md"
                            style={{
                              backgroundColor: `${state.dekat.warna}22`,
                              color: state.dekat.warna,
                            }}
                          >
                            <Icon icon={state.dekat.icon} className="text-sm" />
                          </span>
                          <span className="truncate">{state.dekat.nama}</span>
                          <Icon icon="solar:close-circle-bold" className="shrink-0 text-sm opacity-60" />
                        </button>
                      )}
                      <input
                        ref={keywordRef}
                        type="text"
                        autoComplete="off"
                        value={state.keyword}
                        // Dikosongkan saat contoh mengetik mengambil alih —
                        // dua teks di posisi yang sama akan saling menimpa.
                        placeholder={
                          state.dekat ? "Tambah kata kunci (opsional)" : ""
                        }
                        onChange={(e) => patch({ keyword: e.target.value })}
                        onFocus={() => setFokusKeyword(true)}
                        // Jeda sebelum menutup: tap pada baris saran terjadi
                        // SETELAH blur, dan menutup panel seketika membuat
                        // tap-nya jatuh ke ruang kosong.
                        onBlur={() => setTimeout(() => setFokusKeyword(false), 140)}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          // Enter saat ADA YANG DIKETIK dan ada saran = ambil
                          // yang teratas; di layar sentuh itu yang paling
                          // sering dimaksud. Di tawaran pembuka (kotak masih
                          // kosong) Enter tetap mencari biasa — menekan Enter
                          // di kotak kosong tidak boleh mendarat di "semua
                          // kampus" tanpa diminta.
                          if (!modePopuler && saranTempat.length > 0) {
                            pilihSaran(saranTempat[0]);
                            return;
                          }
                          submitAndClose();
                        }}
                        className={`w-full rounded-xl border py-2.5 pl-3 text-sm font-bold outline-none transition-colors ${
                          state.keyword ? "pr-24" : "pr-3"
                        } ${t.input}`}
                      />
                      {/* Contoh yang mengetik sendiri — di sheet inilah user
                          benar-benar mengetik, jadi di sinilah pelajaran soal
                          "bisa tempat, bisa alamat, bisa ID" paling berguna. */}
                      {!state.keyword && !state.dekat && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-y-0 left-3 right-24 flex items-center overflow-hidden"
                        >
                          <ContohKetikan
                            onJenis={setJenisContoh}
                            className="ketikan-hantu truncate text-sm font-medium leading-none"
                            kelasAwal={
                              theme === "dark" ? "text-white/30" : "text-gray-400"
                            }
                            kelasInti={
                              theme === "dark"
                                ? "font-bold text-primary"
                                : "font-bold text-emerald-600"
                            }
                          />
                        </span>
                      )}

                      {/* Lencana contoh: memakai ruang yang memang kosong saat
                          kolomnya kosong, dan menampilkan persis umpan balik
                          yang akan muncul begitu user benar-benar mengetik. */}
                      {!state.keyword && !state.dekat && jenisContoh && (
                        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                          <span
                            className={`rounded-full border px-1.5 py-[2px] text-[9px] font-black uppercase tracking-wider ${
                              theme === "dark"
                                ? "border-white/10 bg-white/5 text-white/40"
                                : "border-gray-200 bg-gray-100 text-gray-400"
                            }`}
                          >
                            {jenisContoh === "tempat"
                              ? "Tempat"
                              : jenisContoh === "alamat"
                                ? "Alamat"
                                : "ID"}
                          </span>
                        </div>
                      )}

                      {state.keyword && (
                        <div className="absolute inset-y-0 right-2 flex items-center gap-1.5">
                          {keywordMode && (
                            <span className="rounded-full bg-primary/15 px-1.5 py-[2px] text-[9px] font-black uppercase tracking-wider text-primary">
                              {keywordMode === "id" ? "ID" : "Alamat"}
                            </span>
                          )}
                          <button
                            type="button"
                            onMouseDown={keepFocus}
                            onClick={() => {
                              patch({ keyword: "" });
                              // Kembalikan fokus secara eksplisit: tombol ini
                              // ikut hilang begitu keyword kosong, dan kalau ia
                              // sempat mengambil fokus, fokusnya jatuh ke <body>
                              // — keyboard turun dan user harus mengetuk kolom
                              // lagi hanya untuk melanjutkan mengetik.
                              keywordRef.current?.focus();
                            }}
                            aria-label="Hapus kata kunci"
                            className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-transform active:scale-90 before:absolute before:-inset-1 before:content-[''] ${t.resetBtn}`}
                          >
                            <Icon icon="solar:close-circle-bold" className="text-lg" />
                          </button>
                        </div>
                      )}

                      <TempatSaranPanel
                        anchorRef={kotakKeywordRef}
                        inline
                        open={panelSaranTerbuka}
                        items={daftarSaran}
                        memuat={memuatSaran}
                        kueri={kueriSaran || keyword}
                        populer={modePopuler}
                        alamat={adaAlamat ? alamat : null}
                        onPilihAlamat={submitAndClose}
                        onContoh={(teks) => {
                          patch({ keyword: teks });
                          keywordRef.current?.focus();
                        }}
                        aktif={saranAktif}
                        onHover={setSaranAktif}
                        onPilih={pilihSaran}
                        theme={theme}
                      />
                    </div>
                  )}

                  {/* Lokasi — memakai LocationPicker apa adanya: di bawah lg ia
                      sudah membuka takeover satu layar sendiri (z di atas sheet). */}
                  {section(
                    "Lokasi",
                    "solar:map-point-bold-duotone",
                    <div className={`rounded-xl border px-3 py-2.5 ${t.input}`}>
                      <LocationPicker
                        theme={theme}
                        label=""
                        value={state.locations}
                        onChange={(locations) => patch({ locations })}
                        open={locationOpen}
                        onOpenChange={setLocationOpen}
                      />
                    </div>
                  )}

                  {/* Tipe — dropdown multi-pilih beserta ikon tiap kategori.
                      Sembilan chip inline memakan dua baris penuh; sebagai satu
                      trigger ia cuma sebaris, dan perilakunya jadi persis sama
                      dengan search bar desktop. */}
                  {section(
                    typeLabelFor(tab),
                    "solar:buildings-2-bold-duotone",
                    <div className={`rounded-xl border px-3 py-2.5 ${t.input}`}>
                      <TypePicker
                        theme={theme}
                        label={typeLabelFor(tab)}
                        showLabel={false}
                        value={state.types}
                        onChange={(next) => patch({ types: next })}
                        options={types}
                        icons={PROPERTY_ICONS}
                        open={typeOpen}
                        onOpenChange={setTypeOpen}
                      />
                    </div>
                  )}

                  {showGender &&
                    section(
                      "Gender Kos",
                      "solar:users-group-rounded-bold-duotone",
                      <div className="grid grid-cols-4 gap-1.5">
                        {tile("gender-all", "Semua", ICON_SEMUA, state.gender === "", () =>
                          patch({ gender: "" })
                        )}
                        {GENDER_OPTIONS.map((g) =>
                          tile(
                            `gender-${g.value}`,
                            g.label,
                            g.icon,
                            state.gender === g.value,
                            () => patch({ gender: g.value })
                          )
                        )}
                      </div>
                    )}

                  {rent ? (
                    <>
                      {section(
                        "Durasi Sewa",
                        "solar:calendar-date-bold-duotone",
                        <div className="grid grid-cols-5 gap-1.5">
                          {tile("durasi-all", "Semua", ICON_SEMUA, state.durasi === "", () =>
                            patch({ durasi: "" })
                          )}
                          {DURASI_OPTIONS.map((d) =>
                            tile(
                              `durasi-${d.value}`,
                              d.label,
                              d.icon,
                              state.durasi === d.value,
                              () => patch({ durasi: d.value })
                            )
                          )}
                        </div>,
                        "Menampilkan unit yang menawarkan durasi tersebut."
                      )}

                      {section(
                        `Harga Sewa (Rp)`,
                        "solar:wallet-money-bold-duotone",
                        rangeInputs("minRent", "maxRent", "rent", "Min", "Max", "Harga sewa"),
                        state.durasi
                          ? `Dihitung ${unit} sesuai durasi yang dipilih.`
                          : "Pilih durasi dulu agar harga dibandingkan pada satuan yang sama."
                      )}
                    </>
                  ) : (
                    <>
                      {section(
                        "Range Harga (Rp)",
                        "solar:wallet-money-bold-duotone",
                        <>
                          <div className="mb-2.5 grid grid-cols-4 gap-1.5">
                            {PRICE_PRESETS.map((p) =>
                              pill(
                                `price-${p.label}`,
                                p.label,
                                isPresetActive(p),
                                () =>
                                  patchRange({
                                    minPrice: formatIdNumber(p.min),
                                    maxPrice: formatIdNumber(p.max),
                                  }),
                                true
                              )
                            )}
                          </div>
                          {rangeInputs("minPrice", "maxPrice", "price", "Min", "Max", "Harga")}
                        </>
                      )}

                      {section(
                        "Luas Tanah (m²)",
                        "solar:map-bold-duotone",
                        rangeInputs("minLt", "maxLt", "lt", "Min", "Max", "Luas tanah")
                      )}

                      {section(
                        "Luas Bangunan (m²)",
                        "solar:home-bold-duotone",
                        rangeInputs("minLb", "maxLb", "lb", "Min", "Max", "Luas bangunan"),
                        tab === "lelang"
                          ? "Aset lelang umumnya dinilai dari luas tanah (land value)."
                          : undefined
                      )}
                    </>
                  )}
                </div>

                {/* --- FOOTER --- */}
                <div
                  className={`shrink-0 border-t px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl ${t.footer}`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onMouseDown={keepFocus}
                      onClick={resetForm}
                      disabled={count === 0 && !state.keyword}
                      className={`shrink-0 px-2 py-3 text-xs font-bold transition-colors disabled:opacity-40 ${t.resetBtn}`}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onMouseDown={keepFocus}
                      onClick={submitAndClose}
                      disabled={searching}
                      className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-base font-black text-darkmode shadow-[0_10px_30px_-10px_rgba(153,227,158,0.9)] transition-transform active:scale-[0.98] disabled:opacity-70"
                    >
                      {searching ? (
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-darkmode border-t-transparent" />
                      ) : (
                        <Icon icon="solar:magnifer-linear" className="text-lg stroke-2" />
                      )}
                      {searching ? "Mencari..." : "Cari Sekarang"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )
    : null;

  // -------------------------------------------------------------- command bar

  return (
    <div className={className}>
      <div
        className={`flex items-center gap-1 rounded-full border p-1.5 backdrop-blur-2xl transition-colors ${
          count > 0 ? t.barActive : t.bar
        }`}
      >
        <button
          type="button"
          onClick={() => openSheet(true)}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full py-1.5 pl-1 pr-2 text-left active:opacity-70"
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${t.barIcon}`}
          >
            <Icon icon="solar:magnifer-linear" className="text-lg stroke-2" />
          </span>
          <span className="min-w-0 flex-1">
            {keyword ? (
              <span className={`block truncate text-sm font-bold ${t.barText}`}>
                {keyword}
              </span>
            ) : (
              // Command bar adalah satu-satunya bagian pencarian yang terlihat
              // di layar kecil sebelum ada yang diketuk. Kalau kemampuan
              // "deket X" tidak disebut di sini, di mobile ia praktis tidak
              // pernah ditemukan.
              <ContohKetikan
                awalan={emptySummaryFor(tab)}
                className="block truncate text-sm font-semibold leading-none"
                kelasAwal={t.barPlaceholder}
                kelasInti={theme === "dark" ? "text-primary" : "text-emerald-600"}
              />
            )}
          </span>
        </button>

        <span className={`h-6 w-px shrink-0 ${t.barDivider}`} aria-hidden="true" />

        <button
          type="button"
          onClick={() => openSheet(false)}
          aria-label={count > 0 ? `Filter, ${count} aktif` : "Buka filter"}
          className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95 ${t.filterBtn}`}
        >
          <Icon icon="solar:tuning-4-bold-duotone" className="text-2xl" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black leading-none text-darkmode">
              {count}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onSubmit}
          disabled={searching}
          aria-label="Cari"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-darkmode shadow-[0_8px_22px_-8px_rgba(153,227,158,0.95)] transition-transform active:scale-95 disabled:opacity-70"
        >
          {searching ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-darkmode border-t-transparent" />
          ) : (
            <Icon icon="solar:arrow-right-linear" className="text-xl stroke-2" />
          )}
        </button>
      </div>

      {/* Chip filter aktif — transparansi tanpa memakan tinggi: satu baris
          geser horizontal, dan hanya muncul kalau memang ada filter. */}
      <AnimatePresence initial={false}>
        {chips.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
            className="overflow-hidden"
          >
            <div className="no-scrollbar mt-2 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => patchRange(chip.clear)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold backdrop-blur-md transition-colors active:scale-95 ${t.chip}`}
                >
                  <Icon icon={chip.icon} className="shrink-0 text-xs text-primary" />
                  <span className="max-w-[9rem] truncate">{chip.label}</span>
                  <Icon icon="solar:close-circle-bold" className="shrink-0 text-sm opacity-60" />
                </button>
              ))}
              <button
                type="button"
                onClick={resetForm}
                className={`ml-0.5 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${t.resetBtn}`}
              >
                Hapus semua
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {sheet}
    </div>
  );
}

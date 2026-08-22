"use client";

import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import type { TabCounts } from "../types";
import TransactionTabs, { type TxTab } from "@/components/search/TransactionTabs";
import LocationPicker from "@/components/search/LocationPicker";
import {
  setLocationParams,
  parseLocationParams,
  locationsToSelectedRegions,
  type SelectedRegion,
} from "@/lib/regionSearch";
import TypePicker from "@/components/search/TypePicker";
import MobileSearchDock from "@/components/search/MobileSearchDock";
import KeywordField from "@/components/search/KeywordField";
import type { TempatDipilih } from "@/lib/searchTabs";
import {
  serializeTypes,
  parseTypeParamToDisplays,
} from "@/lib/propertyType";
import {
  DURASI_OPTIONS,
  EMPTY_SEARCH_STATE,
  ICON_SEMUA,
  PROPERTY_ICONS,
  durasiLabelFor,
  durasiUnitFor,
  formatIdNumber,
  typeOptionsFor,
  type RangeField,
} from "@/lib/searchTabs";

/** Animasi masuk saat kolom kriteria berganti mode (Harga/Dimensi ↔ Sewa). */
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
const SWAP_MOTION = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.24, ease: EASE_OUT_EXPO },
};

// ─── PORTAL DROPDOWN ─────────────────────────────────────────────────────────
// Renders children directly into document.body to escape any stacking context
function PortalDropdown({
  triggerRef,
  open,
  children,
}: {
  triggerRef: React.RefObject<HTMLDivElement>;
  open: boolean;
  children: React.ReactNode;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, triggerRef]);

  if (!open || !rect || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-search-portal="true"
      className="zoom-safe"
      style={{
        position: "fixed",
        top: rect.bottom + 12,
        left: rect.left,
        zIndex: 99999,
        pointerEvents: "auto",
      }}
    >
      {children}
    </div>,
    document.body
  );
}

// ─── COUNT-UP ─────────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1100): number {
  const [val, setVal] = useState(0);
  const raf  = useRef<number>(0);
  const done = useRef(false);
  useEffect(() => {
    done.current = false;
    setVal(0);
    if (target === 0) return;
    const t0 = performance.now();
    const run = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf.current = requestAnimationFrame(run);
      else done.current = true;
    };
    raf.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return val;
}

// ─── KATEGORI DATA ────────────────────────────────────────────────────────────
const KATEGORI_LIST = [
  { key: "SEMUA",           label: "Semua",         slug: "semua",           icon: "solar:map-point-rotate-bold-duotone", color: "#6366f1", desc: "Semua jenis properti" },
  { key: "RUMAH",           label: "Rumah",         slug: "rumah",           icon: "solar:home-smile-bold-duotone",     color: "#34d399", desc: "Hunian nyaman & strategis" },
  { key: "APARTEMEN",       label: "Apartemen",     slug: "apartemen",       icon: "solar:city-bold-duotone",           color: "#60a5fa", desc: "Unit modern di pusat kota" },
  { key: "RUKO",            label: "Ruko",          slug: "ruko",            icon: "solar:shop-bold-duotone",           color: "#fbbf24", desc: "Bisnis & residensial" },
  { key: "TANAH",           label: "Tanah",         slug: "tanah",           icon: "solar:map-point-wave-bold-duotone", color: "#f472b6", desc: "Kavling & lahan investasi" },
  { key: "GUDANG",          label: "Gudang",        slug: "gudang",          icon: "solar:box-bold-duotone",            color: "#a78bfa", desc: "Logistik & pergudangan" },
  { key: "HOTEL_DAN_VILLA", label: "Hotel & Villa", slug: "hotel-dan-villa", icon: "solar:bed-bold-duotone",            color: "#fb923c", desc: "Resor & penginapan mewah" },
  { key: "TOKO",            label: "Toko",          slug: "toko",            icon: "solar:bag-heart-bold-duotone",      color: "#e879f9", desc: "Retail & komersial" },
  { key: "PABRIK",          label: "Pabrik",        slug: "pabrik",          icon: "solar:garage-bold-duotone",         color: "#94a3b8", desc: "Industri & manufaktur" },
];

const N = KATEGORI_LIST.length;
const LOOPED_LIST = [
  ...KATEGORI_LIST.map((k, i) => ({ ...k, uid: `a-${i}` })),
  ...KATEGORI_LIST.map((k, i) => ({ ...k, uid: `b-${i}` })),
  ...KATEGORI_LIST.map((k, i) => ({ ...k, uid: `c-${i}` })),
];

// Carousel kategori duduk di sisi kanan hero pada SEMUA ukuran layar, jadi di
// layar sempit kolomnya cuma ~130px. Lebar kartu karena itu ikut lebar kolom,
// dengan batas bawah supaya label & angka statistik tetap terbaca.
const CARD_W_MAX = 152;
const CARD_W_MIN = 118;
/** Ruang yang disisakan agar kartu berikutnya "mengintip" → sinyal bisa digeser. */
const PEEK = 24;

function useCardMetrics(ref: React.RefObject<HTMLElement>) {
  const [{ cardW, gap }, setMetrics] = useState({ cardW: CARD_W_MAX, gap: 10 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const compute = () => {
      const avail = el.clientWidth;
      if (!avail) return;
      const nextGap = avail < 260 ? 8 : 10;
      const nextW = Math.round(
        Math.min(CARD_W_MAX, Math.max(CARD_W_MIN, avail - nextGap - PEEK))
      );
      setMetrics((prev) =>
        prev.cardW === nextW && prev.gap === nextGap ? prev : { cardW: nextW, gap: nextGap }
      );
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  const stride = cardW + gap;
  return { cardW, gap, stride, oneSet: N * stride };
}

// ─── SEARCH CONFIG ────────────────────────────────────────────────────────────
type TabType = "beli" | "sewa" | "lelang";

interface SearchState {
  keyword: string;
  /** Tempat yang dipilih dari saran ("Dekat UNESA"). */
  dekat: TempatDipilih | null;
  /** Radius pilihan user (meter); kosong = pakai bawaan kelas tempat. */
  radius: string;
  locations: SelectedRegion[]; types: string[];
  minPrice: string; maxPrice: string;
  minLt: string; maxLt: string;
  minLb: string; maxLb: string;
  /** Kriteria khusus tab Sewa — harga sewa dipisah dari harga jual supaya
   *  berpindah pill tidak membawa budget beli ke kolom harga sewa. */
  minRent: string; maxRent: string; durasi: string;
  /** Gender kos. Hanya bisa diisi lewat sheet filter mobile (tab Sewa + tipe
   *  Kos); search bar desktop di sini belum punya barisnya. */
  gender: string;
}

const isNumericOnly = (val: string) => /^\d+$/.test(val.trim());

const PARTICLES = [
  { x:  8, y: 22, s: 2,   d: 3.1, delay: 0   },
  { x: 18, y: 65, s: 1.5, d: 4.2, delay: 0.6 },
  { x: 30, y: 12, s: 2.5, d: 3.8, delay: 1.2 },
  { x: 55, y: 35, s: 2,   d: 3.5, delay: 1.8 },
  { x: 72, y: 18, s: 2,   d: 3.2, delay: 2.1 },
  { x: 88, y: 72, s: 2,   d: 3.6, delay: 1.5 },
];

// ─── STAT ROW (count-up per baris) ────────────────────────────────────────────
function StatRow({ label, count, color }: { label: string; count: number; color: string }) {
  const animated = useCountUp(count);
  return (
    <div className="flex items-center justify-between gap-1">
      <span className="text-[9px] font-semibold text-white/30 uppercase tracking-[0.08em] lg:tracking-[0.12em] shrink-0">
        {label}
      </span>
      <span className="text-[11px] font-black tabular-nums truncate text-right" style={{ color }}>
        {animated.toLocaleString("id-ID")}
      </span>
    </div>
  );
}

// ─── KATEGORI CARD ────────────────────────────────────────────────────────────
function KategoriCard({ item, isActive, tabCounts, scrollRef, cardW }: {
  item: typeof LOOPED_LIST[0];
  isActive: boolean;
  tabCounts?: TabCounts;
  scrollRef: React.RefObject<HTMLDivElement>;
  cardW: number;
}) {
  const router      = useRouter();
  const cardRef     = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);

  const handleClick = () => {
    if (pending) return;
    setPending(true);
    window.dispatchEvent(new CustomEvent("navigate-start"));

    if (cardRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const cardRect  = cardRef.current.getBoundingClientRect();
      const contRect  = container.getBoundingClientRect();
      const delta     = (cardRect.left - contRect.left) - (container.offsetWidth / 2 - cardW / 2);
      container.scrollTo({ left: container.scrollLeft + delta, behavior: "smooth" });
      setTimeout(() => router.push(`/properti/${item.slug}`), 260);
    } else {
      router.push(`/properti/${item.slug}`);
    }
  };

  return (
    <div ref={cardRef} className="shrink-0 flex cursor-pointer" style={{ width: cardW }} onClick={handleClick}>
      <div
        className="relative rounded-2xl p-3 lg:p-4 transition-all duration-300 flex flex-col w-full"
        style={{
          background: isActive
            ? `linear-gradient(145deg,${item.color}22 0%,${item.color}06 100%)`
            : "rgba(255,255,255,0.038)",
          border: `1px solid ${isActive ? item.color + "50" : "rgba(255,255,255,0.07)"}`,
          boxShadow: isActive ? `0 6px 28px -6px ${item.color}45, 0 0 0 1px ${item.color}18` : "none",
          transform: isActive ? "translateY(-4px)" : "translateY(0px)",
        }}
      >
        {/* top shimmer */}
        {isActive && (
          <div className="absolute top-0 left-5 right-5 h-px"
            style={{ background: `linear-gradient(90deg,transparent,${item.color}cc,transparent)` }} />
        )}

        {/* loading overlay */}
        {pending && (
          <div className="absolute inset-0 rounded-2xl flex items-center justify-center z-10"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}>
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: `${item.color} transparent transparent transparent` }} />
          </div>
        )}

        {/* check badge */}
        {isActive && !pending && (
          <div className="absolute top-2 right-2 lg:top-3 lg:right-3 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: `${item.color}22`, border: `1px solid ${item.color}48` }}>
            <Icon icon="solar:check-circle-bold" className="text-xs" style={{ color: item.color }} />
          </div>
        )}

        {/* icon */}
        <div className="w-9 h-9 lg:w-11 lg:h-11 rounded-xl flex items-center justify-center mb-2.5 lg:mb-3 transition-all duration-300 shrink-0"
          style={{
            background: `${item.color}18`,
            border: `1px solid ${item.color}28`,
            boxShadow: isActive ? `0 0 18px ${item.color}30` : "none",
          }}>
          <Icon icon={item.icon} className="text-[19px] lg:text-[22px] transition-all duration-300"
            style={{ color: item.color, filter: isActive ? `drop-shadow(0 0 6px ${item.color}aa)` : "none" }} />
        </div>

        <div className="text-[12px] lg:text-[13px] font-bold leading-tight mb-1 transition-colors duration-300"
          style={{ color: isActive ? item.color : "rgba(255,255,255,0.78)" }}>
          {item.label}
        </div>
        <div className="text-[10px] text-white/28 leading-snug">{item.desc}</div>

        <div className="flex-1" />

        {/* stats dengan count-up — hanya kartu aktif */}
        {isActive && tabCounts && (
          <div className="mt-3 flex flex-col gap-1.5">
            <div className="h-px w-full"
              style={{ background: `linear-gradient(90deg,transparent,${item.color}30,transparent)` }} />
            <div className="flex flex-col gap-1 pt-1">
              <StatRow label="Dijual" count={tabCounts.jual}   color="#60a5fa" />
              <StatRow label="Lelang" count={tabCounts.lelang} color="#fbbf24" />
              <StatRow label="Disewa" count={tabCounts.sewa}   color="#34d399" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DARK SEARCH BAR ─────────────────────────────────────────────────────────
function DarkSearchBar({
  slug,
  activeColor,
  activeTab,
  onTabChange,
  tempatAwal = null,
}: {
  slug: string;
  activeColor: string;
  activeTab: TxTab;
  /** Pill transaksi ikut dirender di dalam sheet filter mobile, jadi setter-nya
   *  harus turun ke sini — bukan hanya dipakai TransactionTabs di induk. */
  onTabChange: (tab: TxTab) => void;
  /** Tempat yang sedang disaring — dioper dari server (lihat KategoriHero). */
  tempatAwal?: TempatDipilih | null;
}) {
  const router = useRouter();
  const sp     = useSearchParams();
  const wrapperRef   = useRef<HTMLDivElement>(null);
  const refHarga     = useRef<HTMLDivElement>(null);
  const refDimensi   = useRef<HTMLDivElement>(null);
  const keywordInputRef = useRef<HTMLInputElement>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  /** Tab Sewa memakai kriteria Durasi + Harga Sewa, bukan Harga + Dimensi. */
  const isRent = activeTab === "sewa";

  const fmt = (val: string | null) =>
    val ? new Intl.NumberFormat("id-ID").format(Number(val)) : "";

  const [formData, setFormData] = useState<SearchState>(() => {
    const rawKeyword = sp.get("idProperty") ?? sp.get("q") ?? "";
    // tipe aset dihidrasi dari param `kategori` (multi) atau dari slug halaman.
    const fromParam = parseTypeParamToDisplays(sp.get("kategori"));
    const cat = KATEGORI_LIST.find((k) => k.slug === slug);
    const types = fromParam.length
      ? fromParam
      : cat && cat.key !== "SEMUA"
      ? [cat.label]
      : [];
    // Harga di URL milik konteks tab yang sedang dibuka: pada tab Sewa ia
    // adalah harga sewa, selain itu harga jual/lelang.
    const rentContext = activeTab === "sewa";
    return {
      keyword: rawKeyword,
      // Chip tempat dihidrasi dari prop server (butuh nama & ikonnya, yang
      // tidak ada di URL — URL cuma menyimpan slug).
      dekat: tempatAwal ?? null,
      radius: sp.get("radius") ?? "",
      locations: locationsToSelectedRegions(parseLocationParams((k) => sp.get(k))),
      types,
      minPrice: rentContext ? "" : fmt(sp.get("minHarga")),
      maxPrice: rentContext ? "" : fmt(sp.get("maxHarga")),
      minLt:    fmt(sp.get("minLT") ?? sp.get("minLt")),
      maxLt:    fmt(sp.get("maxLT") ?? sp.get("maxLt")),
      minLb:    fmt(sp.get("minLB") ?? sp.get("minLb")),
      maxLb:    fmt(sp.get("maxLB") ?? sp.get("maxLb")),
      minRent:  rentContext ? fmt(sp.get("minHarga")) : "",
      maxRent:  rentContext ? fmt(sp.get("maxHarga")) : "",
      durasi:   sp.get("durasi") ?? "",
      gender:   sp.get("gender") ?? "",
    };
  });

  const keywordTrimmed = formData.keyword.trim();
  const keywordMode: "id" | "alamat" | null =
    keywordTrimmed === "" ? null : isNumericOnly(keywordTrimmed) ? "id" : "alamat";

  // Sync tipe aset ke param `kategori` (multi) atau kategori halaman aktif (slug)
  useEffect(() => {
    const fromParam = parseTypeParamToDisplays(sp.get("kategori"));
    if (fromParam.length) {
      setFormData(prev => ({ ...prev, types: fromParam }));
      return;
    }
    const cat = KATEGORI_LIST.find(k => k.slug === slug);
    setFormData(prev => ({ ...prev, types: cat && cat.key !== "SEMUA" ? [cat.label] : [] }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, sp]);

  // Pindah pill bisa mengganti kolom yang sedang membuka dropdown (mis. panel
  // Dimensi saat berpindah ke Sewa) — selalu tutup supaya tidak ada panel
  // yatim yang muncul lagi saat user kembali ke tab semula.
  //
  // Daftar tipe juga berganti (Sewa punya "Kos", tapi tidak punya "Tanah" atau
  // "Hotel & Villa"). Tipe terpilih yang tak ada di tab tujuan harus dilepas:
  // kalau dibiarkan ia tetap terbaca di trigger padahal barisnya tidak ada di
  // dalam daftar, jadi user tak punya cara untuk membatalkannya.
  useEffect(() => {
    setOpenDropdown(null);
    const allowed = typeOptionsFor(activeTab);
    setFormData(prev => {
      const types = prev.types.filter(t => allowed.includes(t));
      return types.length === prev.types.length ? prev : { ...prev, types };
    });
  }, [activeTab]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const target = e.target as Element;
      if (wrapperRef.current?.contains(target)) return;
      if (target.closest?.("[data-search-portal]")) return;
      setOpenDropdown(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleFormattedInput = (e: React.ChangeEvent<HTMLInputElement>, field: keyof SearchState) => {
    const raw = e.target.value.replace(/\D/g, "");
    setFormData(prev => ({ ...prev, [field]: raw ? new Intl.NumberFormat("id-ID").format(Number(raw)) : "" }));
  };

  // --- Jembatan ke MobileSearchDock (sheet filter di layar kecil) ------------
  // Search bar ini punya state sendiri (bukan `useSearchForm`), tapi bentuk
  // state-nya identik dengan `SearchFormState`, jadi cukup dioper apa adanya.
  const patchForm = useCallback((next: Partial<SearchState>) => {
    setFormData(prev => ({ ...prev, ...next }));
  }, []);

  const resetForm = useCallback(() => setFormData(EMPTY_SEARCH_STATE), []);

  /** Pilih tempat dari saran; kata kunci lama dibuang karena sudah terwakili
   *  chip — membiarkannya berarti hasil disaring dua kali, sekali sebagai
   *  tempat dan sekali sebagai teks yang tidak akan cocok ke alamat mana pun. */
  const pilihTempat = useCallback((tempat: TempatDipilih | null) => {
    setFormData((prev) => ({
      ...prev,
      dekat: tempat,
      radius: "",
      keyword: tempat ? "" : prev.keyword,
    }));
    setOpenDropdown(null);
  }, []);

  /** Kota yang sedang dilihat — MENAIKKAN saran di kota itu, tidak menyaring. */
  const kotaKonteks = useMemo(
    () => formData.locations.find((l) => l.level === "kota")?.name ?? null,
    [formData.locations],
  );

  const handleDockRange = useCallback((field: RangeField, rawValue: string) => {
    setFormData(prev => ({ ...prev, [field]: formatIdNumber(rawValue) }));
  }, []);

  const getLabel = (min: string, max: string, def: string, prefix = "") => {
    if (min && max) return `${prefix}${min} – ${prefix}${max}`;
    if (min) return `Mulai ${prefix}${min}`;
    if (max) return `Hingga ${prefix}${max}`;
    return def;
  };

  const [searching, setSearching] = useState(false);

  // ✅ Reset state "searching" setiap kali URL/searchParams berubah (navigasi
  //    selesai → server selesai render hasil baru). Tanpa ini, tombol akan
  //    terkunci "muter" selamanya setelah pencarian pertama, karena route
  //    /properti/[slug] tidak remount saat hanya query yang berubah.
  useEffect(() => {
    setSearching(false);
  }, [sp]);

  // ✅ Failsafe: kalau karena suatu hal navigasi gagal/menggantung dan sp tak
  //    pernah berubah, tombol tetap pulih sendiri setelah beberapa detik.
  useEffect(() => {
    if (!searching) return;
    const t = setTimeout(() => setSearching(false), 8000);
    return () => clearTimeout(t);
  }, [searching]);

  const handleSearch = () => {
    if (searching) return;

    const dbTypes = serializeTypes(formData.types).split(",").filter(Boolean);
    const raw = (v: string) => v.replace(/\./g, "");

    const params = new URLSearchParams();
    if (keywordTrimmed) {
      if (keywordMode === "id") params.set("idProperty", keywordTrimmed);
      else params.set("q", keywordTrimmed);
    }
    if (formData.dekat) {
      params.set("dekat", formData.dekat.nilai);
      // Radius hanya ditulis bila BERBEDA dari bawaan kelasnya — URL yang
      // dibagikan lewat WhatsApp jadi lebih pendek, dan bawaan yang diperbaiki
      // nanti tetap berlaku untuk tautan lama.
      const r = Number(formData.radius);
      if (Number.isFinite(r) && r > 0 && r !== formData.dekat.radius) {
        params.set("radius", String(Math.round(r)));
      }
    }
    setLocationParams(params, formData.locations);
    // Kriteria mengikuti pill aktif: Sewa memakai durasi + harga sewa,
    // sisanya harga jual + dimensi (LT/LB).
    if (activeTab === "sewa") {
      if (formData.durasi)  params.set("durasi",   formData.durasi);
      // Gender hanya dipakai listing kos — kirim cuma saat tipe Kos aktif,
      // sama seperti perakitan query di `buildSearchParams`.
      if (formData.gender && formData.types.includes("Kos")) {
        params.set("gender", formData.gender);
      }
      if (formData.minRent) params.set("minHarga", raw(formData.minRent));
      if (formData.maxRent) params.set("maxHarga", raw(formData.maxRent));
    } else {
      if (formData.minPrice) params.set("minHarga", raw(formData.minPrice));
      if (formData.maxPrice) params.set("maxHarga", raw(formData.maxPrice));
      if (formData.minLt)    params.set("minLT",    raw(formData.minLt));
      if (formData.maxLt)    params.set("maxLT",    raw(formData.maxLt));
      if (formData.minLb)    params.set("minLB",    raw(formData.minLb));
      if (formData.maxLb)    params.set("maxLB",    raw(formData.maxLb));
    }

    setOpenDropdown(null);

    // Tab transaksi ≠ "semua" → pindah ke halaman section (Jual/Lelang/Sewa).
    // Tipe aset dikirim sebagai `tipe` (di Jual/Lelang, `tipe` = kategori).
    // Pencarian by ID tetap lewat /properti agar server bisa mengarahkan ke
    // tab/section yang benar lintas transaksi.
    if (activeTab !== "semua" && keywordMode !== "id") {
      if (dbTypes.length) params.set("tipe", dbTypes.join(","));
      const dest =
        activeTab === "beli" ? "/Jual" : activeTab === "lelang" ? "/Lelang" : "/Sewa";
      setSearching(true);
      window.dispatchEvent(new CustomEvent("navigate-start"));
      router.push(`${dest}?${params.toString()}`);
      return;
    }

    // Tab "semua" → tetap di halaman kategori. 1 tipe → slug kategori (URL rapi);
    // >1 tipe → /properti/semua + param `kategori`.
    const targetSlug =
      dbTypes.length === 1
        ? KATEGORI_LIST.find(k => k.key === dbTypes[0])?.slug ?? "semua"
        : "semua";
    if (dbTypes.length > 1) params.set("kategori", dbTypes.join(","));

    // Kalau tujuan & kriteria sama persis dgn URL sekarang → tak perlu navigasi.
    params.sort();
    const nextQuery = params.toString();
    const curParams = new URLSearchParams(sp.toString());
    curParams.sort();
    const noChange = targetSlug === slug && nextQuery === curParams.toString();
    if (noChange) return;

    setSearching(true);
    window.dispatchEvent(new CustomEvent("navigate-start"));
    router.push(`/properti/${targetSlug}?${nextQuery}`, { scroll: false });
  };

  // shared dark input style
  const inputCls = "w-full rounded-xl px-3 py-2.5 text-sm outline-none font-medium placeholder:text-white/20 text-white/80 transition-colors";
  const inputStyle = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" };
  const inputFocusStyle = { border: `1px solid ${activeColor}60` };

  // dropdown panel base style
  const panelStyle: React.CSSProperties = {
    background: "rgba(10,13,20,0.98)",
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 24px 64px rgba(0,0,0,0.85)",
    backdropFilter: "blur(20px)",
  };

  return (
    <div ref={wrapperRef} className="w-full relative z-[100] zoom-safe">

      {/* MOBILE: command bar ringkas — detail filter pindah ke bottom sheet */}
      <MobileSearchDock
        className="lg:hidden"
        tab={activeTab}
        onTabChange={onTabChange}
        state={formData}
        patch={patchForm}
        patchRange={patchForm}
        resetForm={resetForm}
        errors={{}}
        onRangeChange={handleDockRange}
        searching={searching}
        onSubmit={handleSearch}
        onPilihTempat={pilihTempat}
        kotaKonteks={kotaKonteks}
      />

      {/* DESKTOP: SEARCH BAR */}
      <div
        className="hidden lg:block rounded-[1.75rem] p-2"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: "0 4px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center divide-y lg:divide-y-0 lg:divide-x divide-white/[0.07]">

          {/* A. KEYWORD / ID PROPERTI / TEMPAT
              Dulu kolom ini menggandakan KeywordField dengan markup sendiri.
              Sejak kotak pencarian juga menawarkan TEMPAT ("deket unesa"),
              duplikat itu berarti satu-satunya halaman kategori tidak ikut
              kebagian — jadi ia dipakai bersama sekarang. */}
          <KeywordField
            id="kategori-search-keyword"
            theme="dark"
            label="Cari Properti"
            width="lg:w-[24%]"
            value={formData.keyword}
            onChange={(keyword) => setFormData((prev) => ({ ...prev, keyword }))}
            onSubmit={handleSearch}
            onFocusField={() => setOpenDropdown(null)}
            dekat={formData.dekat}
            onPilihTempat={pilihTempat}
            kota={kotaKonteks}
            tx={activeTab === "beli" || activeTab === "sewa" || activeTab === "lelang" ? activeTab : "semua"}
          />

          {/* B. LOKASI */}
          <div className="w-full lg:w-[20%] px-3 py-2.5 relative min-w-0">
            <LocationPicker
              theme="dark"
              value={formData.locations}
              onChange={(locs) => setFormData((prev) => ({ ...prev, locations: locs }))}
              open={openDropdown === "location"}
              onOpenChange={(o) => setOpenDropdown(o ? "location" : null)}
            />
          </div>

          {/* C. TIPE ASET */}
          <div className="w-full lg:w-[13%] px-3 py-2.5 relative min-w-0">
            <TypePicker
              theme="dark"
              value={formData.types}
              onChange={(ts) => setFormData((prev) => ({ ...prev, types: ts }))}
              options={typeOptionsFor(activeTab)}
              icons={PROPERTY_ICONS}
              open={openDropdown === "type"}
              onOpenChange={(o) => setOpenDropdown(o ? "type" : null)}
            />
          </div>

          {/* D. HARGA — pada tab Sewa berganti jadi DURASI SEWA */}
          <div ref={refHarga} className="w-full lg:w-[16%] px-3 py-2.5 relative group min-w-0">
            {isRent ? (
              <>
                <motion.div key="kat-durasi" {...SWAP_MOTION}>
                  <div className="cursor-pointer" onClick={() => setOpenDropdown(openDropdown === "durasi" ? null : "durasi")}>
                    <label className="text-[10px] font-extrabold tracking-wider text-white/30 uppercase mb-1 block group-hover:text-white/60 transition-colors">
                      Durasi Sewa
                    </label>
                    <div className="flex items-center gap-2">
                      <Icon icon="solar:calendar-date-bold-duotone" className="text-xl text-white/30 group-hover:text-white/60 transition-colors shrink-0" />
                      <p className="font-bold text-white/85 text-sm truncate flex-1">
                        {durasiLabelFor(formData.durasi)}
                      </p>
                      <motion.div animate={{ rotate: openDropdown === "durasi" ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <Icon icon="solar:alt-arrow-down-linear" className="text-white/25 shrink-0" />
                      </motion.div>
                    </div>
                  </div>
                </motion.div>

                <PortalDropdown triggerRef={refHarga} open={openDropdown === "durasi"}>
                  <AnimatePresence>
                  {openDropdown === "durasi" && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.18, ease: [0.16,1,0.3,1] }}
                      className="w-[280px] rounded-2xl p-3"
                      style={panelStyle}
                    >
                      {[{ value: "", label: "Semua Durasi", icon: ICON_SEMUA }, ...DURASI_OPTIONS].map((d) => {
                        const active = formData.durasi === d.value;
                        return (
                          <button
                            key={d.value || "all"}
                            type="button"
                            onClick={() => { setFormData(prev => ({ ...prev, durasi: d.value })); setOpenDropdown(null); }}
                            className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors"
                            style={active
                              ? { background: `${activeColor}1f`, color: activeColor }
                              : { color: "rgba(255,255,255,0.65)" }}
                          >
                            <Icon
                              icon={d.icon}
                              className="text-lg opacity-70 shrink-0"
                            />
                            <span className="flex-1">{d.label}</span>
                            {active && <Icon icon="solar:check-circle-bold" className="text-lg" />}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                  </AnimatePresence>
                </PortalDropdown>
              </>
            ) : (
              <>
                <motion.div key="kat-price" {...SWAP_MOTION}>
                  <div className="cursor-pointer" onClick={() => setOpenDropdown(openDropdown === "price" ? null : "price")}>
                    <label className="text-[10px] font-extrabold tracking-wider text-white/30 uppercase mb-1 block group-hover:text-white/60 transition-colors">
                      Harga
                    </label>
                    <div className="flex items-center gap-2">
                      <Icon icon="solar:wallet-money-bold-duotone" className="text-xl text-white/30 group-hover:text-white/60 transition-colors shrink-0" />
                      <p className="font-bold text-white/85 text-sm truncate flex-1">
                        {getLabel(formData.minPrice, formData.maxPrice, "Range Harga")}
                      </p>
                      <motion.div animate={{ rotate: openDropdown === "price" ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <Icon icon="solar:alt-arrow-down-linear" className="text-white/25 shrink-0" />
                      </motion.div>
                    </div>
                  </div>
                </motion.div>

                <PortalDropdown triggerRef={refHarga} open={openDropdown === "price"}>
                  <AnimatePresence>
                  {openDropdown === "price" && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.18, ease: [0.16,1,0.3,1] }}
                      className="w-[320px] rounded-2xl p-5"
                      style={panelStyle}
                    >
                      <h4 className="font-bold text-white/70 mb-3 text-sm">Range Budget (Rp)</h4>
                      <div className="flex items-center gap-2">
                        <input type="text" inputMode="numeric" placeholder="Min" value={formData.minPrice}
                          onChange={e => handleFormattedInput(e, "minPrice")}
                          className={inputCls} style={inputStyle}
                          onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                          onBlur={e => Object.assign(e.target.style, inputStyle)}
                        />
                        <span className="text-white/30 font-medium shrink-0">s/d</span>
                        <input type="text" inputMode="numeric" placeholder="Max" value={formData.maxPrice}
                          onChange={e => handleFormattedInput(e, "maxPrice")}
                          className={inputCls} style={inputStyle}
                          onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                          onBlur={e => Object.assign(e.target.style, inputStyle)}
                        />
                      </div>
                    </motion.div>
                  )}
                  </AnimatePresence>
                </PortalDropdown>
              </>
            )}
          </div>

          {/* E. DIMENSI — pada tab Sewa berganti jadi HARGA SEWA */}
          <div ref={refDimensi} className="w-full lg:w-[17%] px-3 py-2.5 relative group min-w-0">
            {isRent && (
              <>
                <motion.div key="kat-rent" {...SWAP_MOTION}>
                  <div className="cursor-pointer" onClick={() => setOpenDropdown(openDropdown === "rent" ? null : "rent")}>
                    <label className="text-[10px] font-extrabold tracking-wider text-white/30 uppercase mb-1 block group-hover:text-white/60 transition-colors">
                      Harga Sewa
                    </label>
                    <div className="flex items-center gap-2">
                      <Icon icon="solar:wallet-money-bold-duotone" className="text-xl text-white/30 group-hover:text-white/60 transition-colors shrink-0" />
                      <p className="font-bold text-white/85 text-sm truncate flex-1">
                        {getLabel(
                          formData.minRent,
                          formData.maxRent,
                          "Range Harga",
                        )}
                        {(formData.minRent || formData.maxRent) && durasiUnitFor(formData.durasi)
                          ? ` ${durasiUnitFor(formData.durasi)}`
                          : ""}
                      </p>
                      <motion.div animate={{ rotate: openDropdown === "rent" ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <Icon icon="solar:alt-arrow-down-linear" className="text-white/25 shrink-0" />
                      </motion.div>
                    </div>
                  </div>
                </motion.div>

                <PortalDropdown triggerRef={refDimensi} open={openDropdown === "rent"}>
                  <AnimatePresence>
                  {openDropdown === "rent" && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.18, ease: [0.16,1,0.3,1] }}
                      className="w-[320px] rounded-2xl p-5"
                      style={panelStyle}
                    >
                      <h4 className="font-bold text-white/70 mb-1 text-sm">Range Harga Sewa (Rp)</h4>
                      <p className="text-[11px] text-white/35 mb-3">
                        {formData.durasi
                          ? `Dihitung ${durasiUnitFor(formData.durasi)} sesuai durasi yang dipilih.`
                          : "Pilih durasi dulu agar harga dibandingkan pada satuan yang sama."}
                      </p>
                      <div className="flex items-center gap-2">
                        <input type="text" inputMode="numeric" placeholder="Min" value={formData.minRent}
                          onChange={e => handleFormattedInput(e, "minRent")}
                          className={inputCls} style={inputStyle}
                          onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                          onBlur={e => Object.assign(e.target.style, inputStyle)}
                        />
                        <span className="text-white/30 font-medium shrink-0">s/d</span>
                        <input type="text" inputMode="numeric" placeholder="Max" value={formData.maxRent}
                          onChange={e => handleFormattedInput(e, "maxRent")}
                          className={inputCls} style={inputStyle}
                          onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                          onBlur={e => Object.assign(e.target.style, inputStyle)}
                        />
                      </div>
                    </motion.div>
                  )}
                  </AnimatePresence>
                </PortalDropdown>
              </>
            )}

            {!isRent && (
              <>
            <motion.div key="kat-dimensi" {...SWAP_MOTION}>
            <div className="cursor-pointer" onClick={() => setOpenDropdown(openDropdown === "dimensions" ? null : "dimensions")}>
              <label className="text-[10px] font-extrabold tracking-wider text-white/30 uppercase mb-1 block group-hover:text-white/60 transition-colors">
                Dimensi
              </label>
              <div className="flex items-center gap-2">
                <Icon icon="solar:ruler-angular-bold-duotone" className="text-xl text-white/30 group-hover:text-white/60 transition-colors shrink-0" />
                <p className="font-bold text-white/85 text-sm truncate flex-1">
                  {formData.minLt || formData.maxLt
                    ? getLabel(formData.minLt, formData.maxLt, "", "") + " m²"
                    : "Luas Tanah/Bangunan"}
                </p>
                <motion.div animate={{ rotate: openDropdown === "dimensions" ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <Icon icon="solar:alt-arrow-down-linear" className="text-white/25 shrink-0" />
                </motion.div>
              </div>
            </div>
            </motion.div>

            <PortalDropdown triggerRef={refDimensi} open={openDropdown === "dimensions"}>
              <AnimatePresence>
              {openDropdown === "dimensions" && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.18, ease: [0.16,1,0.3,1] }}
                  className="w-[320px] rounded-2xl p-5"
                  style={panelStyle}
                >
                  <div className="mb-4">
                    <h4 className="font-bold text-white/70 mb-2 text-sm flex items-center gap-2">
                      <Icon icon="solar:map-bold" className="text-white/30" /> Luas Tanah (m²)
                    </h4>
                    <div className="flex items-center gap-2">
                      <input type="text" placeholder="Min" value={formData.minLt}
                        onChange={e => handleFormattedInput(e, "minLt")}
                        className={inputCls} style={inputStyle}
                        onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                        onBlur={e => Object.assign(e.target.style, inputStyle)}
                      />
                      <span className="text-white/30 shrink-0">–</span>
                      <input type="text" placeholder="Max" value={formData.maxLt}
                        onChange={e => handleFormattedInput(e, "maxLt")}
                        className={inputCls} style={inputStyle}
                        onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                        onBlur={e => Object.assign(e.target.style, inputStyle)}
                      />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-white/70 mb-2 text-sm flex items-center gap-2">
                      <Icon icon="solar:home-bold" className="text-white/30" /> Luas Bangunan (m²)
                    </h4>
                    <div className="flex items-center gap-2">
                      <input type="text" placeholder="Min" value={formData.minLb}
                        onChange={e => handleFormattedInput(e, "minLb")}
                        className={inputCls} style={inputStyle}
                        onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                        onBlur={e => Object.assign(e.target.style, inputStyle)}
                      />
                      <span className="text-white/30 shrink-0">–</span>
                      <input type="text" placeholder="Max" value={formData.maxLb}
                        onChange={e => handleFormattedInput(e, "maxLb")}
                        className={inputCls} style={inputStyle}
                        onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                        onBlur={e => Object.assign(e.target.style, inputStyle)}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
              </AnimatePresence>
            </PortalDropdown>
              </>
            )}
          </div>

          {/* F. TOMBOL CARI */}
          <div className="w-full lg:w-[10%] p-1.5 shrink-0 flex items-center justify-center">
            <button
              onClick={handleSearch}
              disabled={searching}
              className="w-full lg:w-12 h-12 rounded-2xl lg:rounded-full font-bold text-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-80 disabled:cursor-not-allowed"
              style={{
                background: activeColor,
                color: "#0a0d14",
                boxShadow: `0 8px 24px -6px ${activeColor}70`,
                transition: "background 0.4s ease, box-shadow 0.4s ease",
              }}
            >
              {searching ? (
                <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "#0a0d14 transparent transparent transparent" }} />
              ) : (
                <Icon icon="solar:magnifer-linear" className="text-xl" />
              )}
              <span className="lg:hidden ml-2 text-base">
                {searching ? "Mencari..." : "Cari Sekarang"}
              </span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── PROPS ────────────────────────────────────────────────────────────────────
interface KategoriHeroProps {
  slug: string;
  label: string;
  tabCounts: TabCounts;
  /** Tempat yang sedang disaring ("dekat UNESA"), dari server. */
  tempatAwal?: TempatDipilih | null;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function KategoriHero({
  slug,
  label,
  tabCounts,
  /**
   * Tempat yang sedang disaring. Dioper server, bukan dibaca dari URL: URL
   * hanya menyimpan slug, sementara chip butuh nama, ikon, dan warnanya —
   * dan menembak API hanya untuk menggambar satu chip berarti chip itu
   * berkedip di setiap kunjungan.
   */
  tempatAwal = null,
}: KategoriHeroProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { cardW, gap, stride, oneSet } = useCardMetrics(scrollRef);
  const dragging       = useRef(false);
  const dragStartX     = useRef(0);
  const dragScrollLeft = useRef(0);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  // Tab transaksi (Semua/Beli/Lelang/Sewa) — terkontrol, tidak navigasi sampai
  // user menekan Cari. Init dari param `tipe` (transaksi) bila ada.
  const sp = useSearchParams();
  const txTipe = sp.get("tipe");
  const [activeTab, setActiveTab] = useState<TxTab>(
    txTipe === "jual" ? "beli" :
    txTipe === "lelang" ? "lelang" :
    txTipe === "sewa" ? "sewa" : "semua"
  );

  const categoryKey = slug.toUpperCase().replace(/-/g, "_");
  const current     = KATEGORI_LIST.find((k) => k.key === categoryKey);
  const activeColor = current?.color ?? "#34d399";
  const activeIdx   = KATEGORI_LIST.findIndex((k) => k.key === categoryKey);

  useEffect(() => {
    const h = (e: MouseEvent) => setMouse({
      x: (e.clientX / window.innerWidth  - 0.5) * 18,
      y: (e.clientY / window.innerHeight - 0.5) * 18,
    });
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollLeft < oneSet * 0.5)      el.scrollLeft += oneSet;
    else if (el.scrollLeft > oneSet * 1.5) el.scrollLeft -= oneSet;
  }, [oneSet]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const cardOffset = activeIdx >= 0 ? activeIdx * stride : 0;
    let scrollTarget = oneSet + cardOffset - el.offsetWidth / 2 + cardW / 2;
    // Normalise ke range valid [oneSet*0.5, oneSet*1.5] tanpa mengubah posisi visual
    while (scrollTarget > oneSet * 1.5) scrollTarget -= oneSet;
    while (scrollTarget < oneSet * 0.5) scrollTarget += oneSet;
    el.scrollLeft = scrollTarget;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [activeIdx, handleScroll, cardW, stride, oneSet]);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current       = true;
    dragStartX.current     = e.pageX;
    dragScrollLeft.current = scrollRef.current?.scrollLeft ?? 0;
    if (scrollRef.current) scrollRef.current.style.cursor = "grabbing";
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current || !scrollRef.current) return;
    e.preventDefault();
    scrollRef.current.scrollLeft = dragScrollLeft.current - (e.pageX - dragStartX.current);
  };
  const stopDrag = () => {
    dragging.current = false;
    if (scrollRef.current) scrollRef.current.style.cursor = "grab";
  };

  return (
    <div
      className="relative border-b border-white/[0.06]"
      style={{ background: "linear-gradient(160deg,#07080f 0%,#080c12 55%,#060810 100%)" }}
    >
      {/* BACKGROUND */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-28 w-[520px] h-96 rounded-full blur-[130px] opacity-20"
          style={{
            background: `radial-gradient(circle,${activeColor}cc,transparent 65%)`,
            transform: `translate(${mouse.x * 1.6}px,${mouse.y * 1.6}px)`,
            transition: "transform 0.22s ease-out, background 0.6s ease",
          }} />
        <div className="absolute bottom-0 right-1/4 w-80 h-56 rounded-full blur-[90px] opacity-10"
          style={{
            background: "radial-gradient(circle,rgba(96,165,250,0.6),transparent 65%)",
            transform: `translate(${-mouse.x * 0.8}px,${mouse.y * 0.8}px)`,
            transition: "transform 0.22s ease-out",
          }} />
        <div className="absolute inset-0 opacity-[0.032]"
          style={{
            backgroundImage:
              `linear-gradient(${activeColor}88 1px,transparent 1px),` +
              `linear-gradient(90deg,${activeColor}88 1px,transparent 1px)`,
            backgroundSize: "52px 52px",
            transform: `translate(${mouse.x * 0.28}px,${mouse.y * 0.28}px)`,
            transition: "transform 0.15s ease-out",
          }} />
        {PARTICLES.map((p, i) => (
          <motion.div key={i} className="absolute rounded-full"
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, background: activeColor, opacity: 0.28 }}
            animate={{ y: [-4, 4, -4], opacity: [0.12, 0.42, 0.12] }}
            transition={{ duration: p.d, repeat: Infinity, ease: "easeInOut", delay: p.delay }} />
        ))}
        <motion.div className="absolute left-0 right-0 h-px pointer-events-none"
          style={{ background: `linear-gradient(90deg,transparent,${activeColor}55,transparent)` }}
          animate={{ top: ["0%", "100%"] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "linear", repeatDelay: 9 }} />
      </div>

      {/* CONTENT */}
      <div className="relative z-10 container mx-auto max-w-screen-xl px-5 sm:px-8 md:px-10 pt-[72px] pb-8 md:pt-20 md:pb-10">

        {/* TOP ROW — teks kiri, carousel kategori kanan di semua breakpoint */}
        <div className="flex flex-row items-stretch gap-3 sm:gap-5 lg:gap-10 xl:gap-14">

          {/* LEFT — ukuran teks fluid: kolom ini menyempit saat carousel di kanan,
              jadi skala px per breakpoint selalu meleset. clamp() mengisi ruang
              yang tersisa tanpa menabrak kolom kanan. */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <motion.div initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08, duration: 0.5 }} className="inline-flex max-w-full items-center gap-2 mb-3 sm:mb-4">
              <div className="inline-flex max-w-full items-center gap-2 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-[clamp(10px,1.35vw,13px)] font-bold tracking-wide"
                style={{ background: `${activeColor}15`, border: `1px solid ${activeColor}38`, color: activeColor }}>
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70" style={{ background: activeColor }} />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: activeColor }} />
                </span>
                Layanan Properti Terbaik
              </div>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="font-black text-white leading-[1.02] md:leading-[0.96] lg:leading-[0.9] tracking-tight text-[clamp(21px,5.5vw,56px)]">
              Temukan Properti
              <br />
              <span className="text-transparent bg-clip-text"
                style={{
                  backgroundImage: `linear-gradient(120deg,${activeColor} 0%,#fff 42%,${activeColor} 85%)`,
                  WebkitBackgroundClip: "text",
                  transition: "background-image 0.55s ease",
                }}>
                {label}
              </span>
              <br />
              <span className="text-white/48 text-[clamp(16px,3.95vw,40px)] font-semibold">
                Terbaik Anda
              </span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.26, duration: 0.5 }}
              className="text-white/32 text-[clamp(11.5px,1.5vw,15px)] mt-3 sm:mt-4 max-w-[340px] md:max-w-[460px] leading-relaxed">
              Properti dijual, disewa & dilelang di seluruh Indonesia. Satu platform, semua pilihan.
            </motion.p>
          </div>

          {/* RIGHT — carousel */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="w-[46%] max-w-[176px] sm:w-[44%] sm:max-w-[260px] md:max-w-[320px] lg:w-auto lg:max-w-[400px] xl:max-w-[440px] shrink-0 flex flex-col">

            <div className="flex items-center mb-2 sm:mb-3 px-1 shrink-0">
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.14em] sm:tracking-[0.2em] text-white/20">
                Semua Kategori
              </span>
            </div>

            <div className="relative flex-1 min-h-0 flex flex-col">
              <div className="absolute left-0 inset-y-0 w-4 sm:w-6 lg:w-10 z-10 pointer-events-none"
                style={{ background: "linear-gradient(90deg,rgba(7,8,15,0.9),transparent)" }} />
              <div className="absolute right-0 inset-y-0 w-4 sm:w-6 lg:w-10 z-10 pointer-events-none"
                style={{ background: "linear-gradient(270deg,rgba(7,8,15,0.9),transparent)" }} />

              <div ref={scrollRef}
                onMouseDown={onMouseDown} onMouseMove={onMouseMove}
                onMouseUp={stopDrag} onMouseLeave={stopDrag}
                className="flex overflow-x-scroll flex-1"
                style={{
                  gap, paddingTop: 8, paddingBottom: 10,
                  scrollbarWidth: "none", msOverflowStyle: "none",
                  cursor: "grab", WebkitOverflowScrolling: "touch",
                  overscrollBehaviorX: "contain",
                  alignItems: "stretch",
                }}>
                {LOOPED_LIST.map(item => (
                  <KategoriCard key={item.uid} item={item}
                    isActive={item.key === categoryKey}
                    tabCounts={item.key === categoryKey ? tabCounts : undefined}
                    scrollRef={scrollRef} cardW={cardW} />
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* SEARCH BAR */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="mt-7 md:mt-8">
          <TransactionTabs active={activeTab} onChange={setActiveTab} />
          <DarkSearchBar
            slug={slug}
            activeColor={activeColor}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tempatAwal={tempatAwal}
          />
        </motion.div>
      </div>

      {/* bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#0F0F0F] to-transparent pointer-events-none" />
    </div>
  );
}

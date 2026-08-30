"use client";

/**
 * LocationPicker — pemilih lokasi multi-wilayah yang dipakai bersama oleh
 * seluruh search bar (Home, Jual, Lelang, halaman kategori).
 *
 * Fitur:
 *  - Multi-select lintas level (provinsi / kota / kecamatan / kelurahan).
 *  - Ketik-cari lintas provinsi (indeks gabungan provinsi + semua kota) —
 *    mis. ketik "gresik" langsung muncul "Kabupaten Gresik — Jawa Timur".
 *  - Drill-down bertingkat saat kotak cari kosong (untuk kecamatan/kelurahan).
 *  - Responsif & anti-overflow: dropdown ter-clamp di desktop, bottom sheet
 *    full-width di mobile.
 *  - Themeable: "light" (Home) / "dark" (halaman listing).
 *
 * Data diambil lewat proxy internal (/api/regions/*) yang sudah ter-cache.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  type RegionLevel,
  type SelectedRegion,
  normalizeRegionName,
  regionKey,
  regionLabel,
} from "@/lib/regionSearch";

type Theme = "light" | "dark";

interface LocationPickerProps {
  value: SelectedRegion[];
  onChange: (next: SelectedRegion[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme?: Theme;
  /** label kecil di atas field (default "Lokasi") */
  label?: string;
}

interface ThemeTokens {
  triggerLabel: string;
  triggerValue: string;
  triggerIcon: string;
  triggerChip: string;
  panel: string;
  header: string;
  bodyBg: string;
  title: string;
  sub: string;
  nameIdle: string;
  rowHover: string;
  rowBorder: string;
  input: string;
  inputIcon: string;
  checkboxIdle: string;
  footer: string;
  iconBtn: string;
  ghostText: string;
  resetBtn: string;
  skeleton: string;
}

const THEMES: Record<Theme, ThemeTokens> = {
  light: {
    triggerLabel: "text-gray-400 group-hover:text-primary",
    triggerValue: "text-gray-800",
    triggerIcon: "text-gray-400 group-hover:text-primary",
    triggerChip:
      "bg-primary/15 border-primary/30 text-darkmode hover:bg-red-100 hover:text-red-500 hover:border-red-200",
    panel: "bg-white border-gray-100",
    header: "bg-gray-50 border-gray-100",
    bodyBg: "bg-white",
    title: "text-gray-800",
    sub: "text-gray-400",
    nameIdle: "text-gray-700",
    rowHover: "hover:bg-gray-50",
    rowBorder: "border-gray-50",
    input:
      "bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-primary",
    inputIcon: "text-gray-400",
    checkboxIdle: "border-gray-300 bg-white",
    footer: "bg-gray-50 border-gray-100",
    iconBtn: "hover:bg-gray-200 text-gray-600",
    ghostText: "text-gray-500",
    resetBtn: "text-gray-500 hover:text-red-500 hover:bg-red-50",
    skeleton: "bg-gray-200",
  },
  dark: {
    triggerLabel: "text-gray-400 group-hover:text-primary",
    triggerValue: "text-white",
    triggerIcon: "text-gray-400 group-hover:text-primary",
    triggerChip:
      "bg-primary/20 border-primary/30 text-white hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50",
    panel: "bg-[#222] border-white/10",
    header: "bg-[#2A2A2A] border-white/10",
    bodyBg: "bg-[#1A1A1A]",
    title: "text-white",
    sub: "text-gray-500",
    nameIdle: "text-gray-300",
    rowHover: "hover:bg-white/5",
    rowBorder: "border-white/5",
    input:
      "bg-[#1A1A1A] border-white/10 text-white placeholder:text-gray-600 focus:border-primary",
    inputIcon: "text-gray-500",
    checkboxIdle: "border-gray-600 bg-transparent",
    footer: "bg-[#2A2A2A] border-white/10",
    iconBtn: "hover:bg-white/10 text-gray-400",
    ghostText: "text-gray-400",
    resetBtn: "text-gray-400 hover:text-red-400 hover:bg-red-500/10",
    skeleton: "bg-white/10",
  },
};

const REGION_ICON: Record<RegionLevel, string> = {
  provinsi: "solar:globus-bold-duotone",
  kota: "solar:buildings-2-bold-duotone",
  kecamatan: "solar:buildings-bold-duotone",
  kelurahan: "solar:map-point-wave-bold-duotone",
};

const NEXT_LEVEL: Partial<Record<RegionLevel, RegionLevel>> = {
  provinsi: "kota",
  kota: "kecamatan",
  kecamatan: "kelurahan",
};

const CHILD_LABEL: Record<RegionLevel, string> = {
  provinsi: "Kota / Kab.",
  kota: "Kecamatan",
  kecamatan: "Kelurahan",
  kelurahan: "",
};

const isRealId = (id: string) => /^\d+$/.test(id);

const sortByName = <T extends { name: string }>(arr: T[]) =>
  [...arr].sort((a, b) => a.name.localeCompare(b.name, "id"));

export default function LocationPicker({
  value,
  onChange,
  open,
  onOpenChange,
  theme = "light",
  label = "Lokasi",
}: LocationPickerProps) {
  const t = THEMES[theme];

  // --- responsif: desktop popover vs mobile bottom sheet ---
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // --- panel di-portal ke body (lepas dari stacking/transform induk) ---
  const triggerRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // posisi trigger di-track saat panel terbuka (desktop popover ikut scroll/resize)
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
  }, [open]);

  // --- indeks ketik-cari (provinsi + semua kota) ---
  const [provincesIndex, setProvincesIndex] = useState<SelectedRegion[]>([]);
  const [citiesIndex, setCitiesIndex] = useState<SelectedRegion[]>([]);
  const [indexLoaded, setIndexLoaded] = useState(false);
  const indexLoadingRef = useRef(false);

  const ensureIndex = useCallback(async () => {
    if (indexLoaded || indexLoadingRef.current) return;
    indexLoadingRef.current = true;
    try {
      const [provRes, cityRes] = await Promise.all([
        fetch("/api/regions/wilayah?level=provinsi"),
        fetch("/api/regions/cities"),
      ]);
      const provJson = await provRes.json().catch(() => ({}));
      const cityJson = await cityRes.json().catch(() => ({}));
      const provinces: SelectedRegion[] = sortByName(
        (provJson.items ?? []).map((p: { id: string; name: string }) => ({
          id: String(p.id),
          name: p.name,
          level: "provinsi" as const,
        }))
      );
      const cities: SelectedRegion[] = (cityJson.cities ?? []).map(
        (c: { id: string; name: string; province?: string }) => ({
          id: String(c.id),
          name: c.name,
          level: "kota" as const,
          parent: c.province,
        })
      );
      setProvincesIndex(provinces);
      setCitiesIndex(cities);
      setIndexLoaded(true);
    } catch {
      toast.error("Gagal memuat data wilayah");
    } finally {
      indexLoadingRef.current = false;
    }
  }, [indexLoaded]);

  // --- drill-down (breadcrumb stack: setiap elemen = induk yang di-drill) ---
  const [path, setPath] = useState<SelectedRegion[]>([]);
  const [childList, setChildList] = useState<SelectedRegion[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const [query, setQuery] = useState("");

  // induk & level saat ini DITURUNKAN dari path (hindari state desync)
  const parentRegion = path.length ? path[path.length - 1] : null;
  const viewLevel: RegionLevel = parentRegion
    ? NEXT_LEVEL[parentRegion.level] ?? "kelurahan"
    : "provinsi";

  // saat dibuka: pastikan indeks termuat & reset ke akar provinsi
  useEffect(() => {
    if (!open) return;
    ensureIndex();
    setPath([]);
    setChildList([]);
    setQuery("");
  }, [open, ensureIndex]);

  // tutup dengan Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // kunci scroll body saat bottom sheet aktif
  useEffect(() => {
    if (open && !isDesktop) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open, isDesktop]);

  // --- tinggi sheet mobile mengikuti keyboard virtual ---
  // Sheet di-anchor dari ATAS (top:0), bukan bawah — keyboard hanya pernah
  // menutupi dari bawah layar, jadi header/input/hasil teratas TIDAK PERNAH
  // bisa tertutup keyboard secara struktural, apapun akurasi hitungan tinggi
  // di bawah ini. `h-[100dvh]` (dynamic viewport height) sudah otomatis
  // menyusut saat keyboard muncul di browser modern; listener visualViewport
  // di bawah cuma penghalus untuk browser lama yang belum kenal `dvh`.
  const [vvHeight, setVvHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!open || isDesktop) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setVvHeight(vv.height);
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [open, isDesktop]);

  // --- selection ---
  const selectedKeys = useMemo(
    () => new Set(value.map((v) => regionKey(v))),
    [value]
  );
  const isSelected = useCallback(
    (r: { name: string; level: RegionLevel }) => selectedKeys.has(regionKey(r)),
    [selectedKeys]
  );

  const toggle = useCallback(
    (region: SelectedRegion) => {
      const key = regionKey(region);
      if (selectedKeys.has(key)) {
        onChange(value.filter((v) => regionKey(v) !== key));
        return;
      }
      let next = value.slice();
      // smart replacement: buang leluhur/keturunan langsung (id ibnux hierarkis)
      if (isRealId(region.id)) {
        next = next.filter((v) => {
          if (!isRealId(v.id)) return true;
          return !(v.id.startsWith(region.id) || region.id.startsWith(v.id));
        });
      }
      next.push(region);
      onChange(next);
      toast.success(`${regionLabel(region)} ditambahkan`, {
        icon: "📍",
        style: {
          borderRadius: "10px",
          background: "#333",
          color: "#fff",
          fontSize: "12px",
        },
      });
    },
    [value, onChange, selectedKeys]
  );

  const clearAll = useCallback(() => onChange([]), [onChange]);

  // --- navigasi drill-down ---
  // Muat anak dari sebuah induk → isi childList.
  const loadChildren = useCallback(async (parent: SelectedRegion) => {
    const lvl = NEXT_LEVEL[parent.level];
    if (!lvl) return;
    setLoadingList(true);
    setChildList([]);
    try {
      const res = await fetch(
        `/api/regions/wilayah?level=${lvl}&parentId=${encodeURIComponent(parent.id)}`
      );
      const json = await res.json().catch(() => ({}));
      /**
       * Rantai induk yang akan dibawa anak-anak ini sampai ke URL.
       *
       * Hanya dipasang mulai KECAMATAN ke bawah, dan itu disengaja: nama
       * kecamatan tidak unik se-Indonesia ("Taman" ada di Sidoarjo, Madiun,
       * dan Pemalang) sehingga tanpa induk hasilnya selalu tercampur, sementara
       * nilai param `kota` dibaca juga oleh judul halaman & saran tempat —
       * menempelkan provinsi di sana hanya akan mengotori teks yang tampil
       * tanpa menambah ketepatan apa pun.
       */
      const rantai =
        lvl === "kecamatan" || lvl === "kelurahan"
          ? [
              normalizeRegionName(parent.name, parent.level),
              ...(parent.ancestors ?? []),
            ].filter(Boolean)
          : [];
      setChildList(
        sortByName(
          (json.items ?? []).map((it: { id: string; name: string }) => ({
            id: String(it.id),
            name: it.name,
            level: lvl,
            parent: parent.name,
            ancestors: rantai,
          }))
        )
      );
    } catch {
      toast.error("Gagal memuat data wilayah");
    } finally {
      setLoadingList(false);
    }
  }, []);

  const drillInto = useCallback(
    (region: SelectedRegion) => {
      if (!NEXT_LEVEL[region.level]) return; // kelurahan: tak ada anak
      // keluar dari mode ketik-cari supaya daftar level berikutnya tampil
      // (mis. klik "Kota Surabaya" dari hasil pencarian → tampilkan kecamatan).
      setQuery("");
      setPath((prev) => [...prev, region]);
      loadChildren(region);
    },
    [loadChildren]
  );

  // Kembali SATU level: buang induk terakhir, muat anak dari induk baru
  // (atau kembali ke daftar provinsi bila path kosong).
  const goBack = useCallback(() => {
    if (path.length === 0) return;
    setQuery("");
    const newPath = path.slice(0, -1);
    setPath(newPath);
    const newParent = newPath[newPath.length - 1];
    if (newParent) loadChildren(newParent);
    else setChildList([]);
  }, [path, loadChildren]);

  // --- daftar yang ditampilkan ---
  const trimmedQuery = query.trim();
  const ql = trimmedQuery.toLowerCase();
  const hasQuery = trimmedQuery.length > 0;
  const isAtRoot = path.length === 0;

  // Mode pencarian GLOBAL (lintas provinsi) — hanya di akar & ≥2 huruf:
  // gabungan provinsi + semua kota, supaya bisa loncat ke kota mana pun.
  const globalSearch = isAtRoot && trimmedQuery.length >= 2;

  // Daftar baris yang tampil:
  //  - globalSearch → provinsi + semua kota yang cocok.
  //  - selain itu   → daftar level saat ini (provinsi di akar / childList saat
  //    drilled), DIFILTER LOKAL oleh query (mis. cari kecamatan di Surabaya).
  const rows = useMemo(() => {
    if (globalSearch) {
      return [...provincesIndex, ...citiesIndex]
        .filter((r) => r.name.toLowerCase().includes(ql))
        .slice(0, 80);
    }
    const base = isAtRoot ? provincesIndex : childList;
    if (!hasQuery) return base;
    return base.filter((r) => r.name.toLowerCase().includes(ql));
  }, [globalSearch, isAtRoot, provincesIndex, citiesIndex, childList, ql, hasQuery]);

  // Sedang memuat? (akar/global menunggu index; level dalam menunggu fetch)
  const isLoading = isAtRoot ? !indexLoaded : loadingList;

  // ============ RENDER HELPERS (fungsi inline, bukan komponen, agar tidak remount) ============

  const checkBox = (checked: boolean) => (
    <div
      className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${
        checked ? "bg-primary border-primary" : t.checkboxIdle
      }`}
    >
      {checked && (
        <Icon icon="solar:check-read-linear" className="text-white text-sm" />
      )}
    </div>
  );

  const regionRow = (region: SelectedRegion) => {
    const selected = isSelected(region);
    const hasChild = region.level !== "kelurahan";
    return (
      <div
        key={`${region.level}-${region.id}`}
        className={`flex items-center justify-between group/row ${t.rowHover} border-b ${t.rowBorder} last:border-0`}
      >
        {/* Ketuk baris = pilih/hapus langsung — tidak perlu bidik checkbox kecil.
            Drill-down dipindah ke tombol panah eksplisit di kanan, supaya niat
            "pilih wilayah ini" vs "lihat isinya" tidak lagi ambigu. */}
        <button
          type="button"
          onClick={() => toggle(region)}
          className="flex-1 flex items-center gap-3 px-4 py-3 text-left min-w-0"
        >
          {checkBox(selected)}
          <Icon
            icon={REGION_ICON[region.level]}
            className={`text-lg shrink-0 ${
              selected ? "text-primary" : `${t.sub} group-hover/row:text-primary`
            }`}
          />
          <div className="flex-1 min-w-0">
            <span
              className={`text-sm block truncate ${
                selected ? "font-bold text-primary" : `font-medium ${t.nameIdle}`
              }`}
            >
              {region.name}
            </span>
            {region.parent ? (
              <span className={`text-[10px] block truncate ${t.sub}`}>
                {region.parent}
              </span>
            ) : null}
          </div>
        </button>
        {hasChild && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              drillInto(region);
            }}
            className={`flex items-center gap-1 px-3 py-3 shrink-0 text-[11px] font-bold ${t.sub} hover:text-primary transition-colors`}
            aria-label={`Lihat ${CHILD_LABEL[region.level]} di ${region.name}`}
          >
            <span className="whitespace-nowrap">{CHILD_LABEL[region.level]}</span>
            <Icon icon="solar:alt-arrow-right-linear" className="text-base" />
          </button>
        )}
      </div>
    );
  };

  // skeleton saat data wilayah sedang dimuat (biar tak terlihat kosong)
  const loadingSkeleton = (
    <div className="py-1" aria-busy="true" aria-label="Memuat data wilayah">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 px-4 py-3 border-b ${t.rowBorder}`}
        >
          <div
            className={`w-7 h-7 rounded-lg ${t.skeleton} animate-pulse shrink-0`}
          />
          <div className="flex-1 min-w-0">
            <div
              className={`h-3 rounded ${t.skeleton} animate-pulse`}
              style={{ width: `${45 + ((i * 13) % 40)}%` }}
            />
            <div
              className={`h-2 mt-2 rounded ${t.skeleton} animate-pulse`}
              style={{ width: "28%" }}
            />
          </div>
          <div
            className={`w-5 h-5 rounded ${t.skeleton} animate-pulse shrink-0`}
          />
        </div>
      ))}
    </div>
  );

  const panelBody = (showCloseButton?: boolean) => (
    <>
      {/* HEADER */}
      <div
        className={`px-4 py-3 border-b ${t.header} flex items-center justify-between gap-2 shrink-0`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {!globalSearch && path.length > 0 && (
            <button
              type="button"
              onClick={goBack}
              className={`p-1.5 rounded-full transition-colors ${t.iconBtn}`}
              aria-label="Kembali"
            >
              <Icon icon="solar:arrow-left-linear" className="text-lg" />
            </button>
          )}
          <h4
            className={`font-bold ${t.title} text-sm flex items-center gap-2 min-w-0`}
          >
            <Icon
              icon={REGION_ICON[viewLevel]}
              className="text-primary text-lg shrink-0"
            />
            {globalSearch ? (
              <span className="truncate">Hasil pencarian</span>
            ) : isAtRoot ? (
              <span>Pilih Wilayah</span>
            ) : (
              <span className="text-primary truncate">{parentRegion?.name}</span>
            )}
          </h4>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isLoading && (
            <Icon icon="line-md:loading-loop" className="text-primary text-lg" />
          )}
          {showCloseButton && (
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={`p-1.5 rounded-full transition-colors ${t.iconBtn}`}
              aria-label="Tutup"
            >
              <Icon icon="solar:close-circle-bold" className="text-xl" />
            </button>
          )}
        </div>
      </div>

      {/* SEARCH INPUT */}
      <div className={`px-3 py-2.5 border-b ${t.rowBorder} ${t.bodyBg} shrink-0`}>
        <div className="relative">
          <Icon
            icon="solar:magnifer-linear"
            className={`absolute left-3 top-1/2 -translate-y-1/2 text-base ${t.inputIcon}`}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isAtRoot
                ? "Cari kota / wilayah (mis. Surabaya)"
                : `Cari ${viewLevel}${parentRegion ? ` di ${parentRegion.name}` : ""}`
            }
            className={`w-full border rounded-xl pl-9 pr-8 py-2.5 text-sm outline-none font-medium transition-colors ${t.input}`}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full ${t.iconBtn}`}
              aria-label="Bersihkan"
            >
              <Icon icon="solar:close-circle-bold" className="text-base" />
            </button>
          )}
        </div>
      </div>

      {/* SELECTED CHIPS */}
      {value.length > 0 && (
        <div
          className={`px-3 py-2 border-b ${t.rowBorder} ${t.bodyBg} flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0`}
        >
          {value.map((loc) => (
            <button
              type="button"
              key={`${loc.level}-${loc.id}`}
              onClick={() => toggle(loc)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-bold whitespace-nowrap transition-colors ${t.triggerChip}`}
            >
              {regionLabel(loc)}
              <Icon icon="solar:close-circle-bold" className="text-xs" />
            </button>
          ))}
        </div>
      )}

      {/* LIST */}
      <div className={`overflow-y-auto custom-scrollbar flex-1 min-h-0 ${t.bodyBg}`}>
        {/* "Pilih semua di X" — saat drilled, tidak loading, tidak sedang mem-filter */}
        {!globalSearch && !isLoading && !hasQuery && parentRegion && (
          <button
            type="button"
            onClick={() => toggle(parentRegion)}
            className={`w-full text-left px-4 py-3 bg-primary/5 hover:bg-primary/10 border-b ${t.rowBorder} flex items-center gap-3 transition-colors`}
          >
            {checkBox(isSelected(parentRegion))}
            <span className={`text-sm font-bold ${t.title}`}>
              Pilih semua di {parentRegion.name}
            </span>
          </button>
        )}

        {isLoading ? (
          loadingSkeleton
        ) : rows.length > 0 ? (
          rows.map((r) => regionRow(r))
        ) : (
          <div className={`px-4 py-12 text-center text-sm ${t.ghostText}`}>
            {hasQuery
              ? `Tidak ada wilayah cocok untuk "${trimmedQuery}"`
              : "Tidak ada data wilayah"}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div
        className={`px-3 py-2.5 border-t ${t.footer} flex items-center justify-between gap-2 shrink-0`}
      >
        <button
          type="button"
          onClick={clearAll}
          disabled={value.length === 0}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 ${t.resetBtn}`}
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          disabled={value.length === 0}
          className="px-5 py-2.5 rounded-xl text-sm font-bold bg-primary text-darkmode hover:bg-[#6ee7b7] transition-colors shadow-lg shadow-primary/30 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed"
        >
          Terapkan{value.length > 0 ? ` (${value.length})` : ""}
        </button>
      </div>
    </>
  );

  // ---- posisi panel desktop (fixed, ter-clamp ke viewport) ----
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  // Lebar panel = lebar trigger (min 320px, max 440px) — BUKAN berbasis viewport
  const PANEL_W = Math.min(440, Math.max(rect?.width ?? 320, 320));
  const rawLeft = rect ? rect.left : 8;
  const desktopLeft = Math.max(8, rawLeft + PANEL_W > vw - 8 ? vw - PANEL_W - 8 : rawLeft);
  // Buka ke atas jika ruang bawah < 300px dan ruang atas lebih banyak
  const spaceBelow = rect ? vh - rect.bottom - 16 : 400;
  const spaceAbove = rect ? rect.top - 16 : 400;
  const openUpward = spaceBelow < 300 && spaceAbove > spaceBelow;
  const desktopMaxH = Math.max(260, Math.min(480, openUpward ? spaceAbove : spaceBelow));
  const desktopTop = openUpward
    ? (rect?.top ?? 0) - desktopMaxH - 8
    : (rect?.bottom ?? 0) + 8;

  // Portal selalu ter-mount (begitu `mounted`), kondisi `open` ada DI DALAM
  // AnimatePresence supaya animasi exit (tutup) ikut diputar, bukan hanya open.
  const panel = mounted
    ? createPortal(
        <AnimatePresence>
          {open &&
            (isDesktop
              ? [
                  // ---- DESKTOP: popover fixed, anti-overflow ----
                  <motion.div
                    key="popover"
                    data-search-portal="true"
                    initial={{ opacity: 0, y: openUpward ? -8 : 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: openUpward ? -8 : 8 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                      position: "fixed",
                      top: desktopTop,
                      left: desktopLeft,
                      width: PANEL_W,
                      maxHeight: desktopMaxH,
                      zIndex: 99999,
                    }}
                    className={`rounded-2xl shadow-2xl border overflow-hidden flex flex-col zoom-safe ${t.panel}`}
                  >
                    {panelBody()}
                  </motion.div>,
                ]
              : [
                  // ---- MOBILE: full-screen takeover, anchor dari ATAS ----
                  // Pola sama seperti pencarian lokasi di Airbnb/Booking/Google:
                  // search bar nempel di atas layar, bukan sheet dari bawah.
                  // Keyboard virtual hanya makan ruang dari bawah, jadi header +
                  // search + hasil teratas TIDAK PERNAH tertutup keyboard — beda
                  // dengan sheet ala bottom-anchored yang gampang "digigit" keyboard
                  // karena berebut sisi bawah viewport yang sama.
                  <motion.div
                    key="sheet"
                    data-search-portal="true"
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", stiffness: 380, damping: 38 }}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                      height: vvHeight ?? undefined,
                      paddingTop: "env(safe-area-inset-top)",
                    }}
                    className={`fixed inset-x-0 top-0 z-[100001] h-screen h-[100dvh] flex flex-col zoom-safe ${t.panel}`}
                  >
                    {panelBody(true)}
                  </motion.div>,
                ])}
        </AnimatePresence>,
        document.body
      )
    : null;

  return (
    <div className="relative w-full h-full">
      {/* TRIGGER */}
      <div
        ref={triggerRef}
        className="cursor-pointer h-full flex flex-col justify-center group"
        onClick={() => onOpenChange(!open)}
      >
        {label ? (
          <label
            className={`text-[10px] font-extrabold tracking-wider uppercase mb-1 block transition-colors ${t.triggerLabel}`}
          >
            {label}
          </label>
        ) : null}
        <div className="flex items-center gap-2 w-full">
          <Icon
            icon="solar:map-point-bold-duotone"
            className={`text-xl shrink-0 transition-colors ${t.triggerIcon}`}
          />
          <div className="w-full overflow-x-auto no-scrollbar flex items-center gap-1.5 h-6">
            {value.length === 0 ? (
              <p className={`font-bold text-sm truncate ${t.triggerValue}`}>
                Semua Lokasi
              </p>
            ) : (
              value.map((loc) => (
                <span
                  key={`${loc.level}-${loc.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(loc);
                  }}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap transition-colors cursor-pointer ${t.triggerChip}`}
                >
                  {regionLabel(loc)}
                  <Icon icon="solar:close-circle-bold" className="text-xs" />
                </span>
              ))
            )}
          </div>
          <Icon
            icon="solar:alt-arrow-down-linear"
            className={`shrink-0 transition-transform ${t.triggerIcon} ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {/* PANEL (di-portal ke body) */}
      {panel}
    </div>
  );
}

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";

export type ListingFilterState = {
  q: string;
  vendor: string;
  jenis: "ALL" | "PRIMARY" | "SECONDARY" | "LELANG" | "SEWA";
  kategori:
    | "ALL"
    | "RUMAH"
    | "APARTEMEN"
    | "RUKO"
    | "TANAH"
    | "GUDANG"
    | "HOTEL_DAN_VILLA"
    | "TOKO"
    | "PABRIK";
  provinsi: string;
  kota: string;
  kecamatan: string;
  kelurahan: string;
};

type Level = "provinsi" | "kota" | "kecamatan" | "kelurahan";
type Region = { id: string; name: string; level: Level };
type ApiRegion = { id: string; nama: string };

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
function clean(s: any) {
  return String(s ?? "").trim();
}
function formatCount(n: number) {
  try {
    return new Intl.NumberFormat("id-ID").format(n);
  } catch {
    return String(n);
  }
}
function buildLocationLabel(v: ListingFilterState) {
  const parts = [v.provinsi, v.kota, v.kecamatan, v.kelurahan].map(clean).filter(Boolean);
  if (!parts.length) return "Semua Lokasi";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} / ${parts[1]}`;
  return `${parts[0]} / ${parts[1]} / …`;
}
function getRegionIcon(level: Level) {
  switch (level) {
    case "provinsi":
      return "solar:globus-bold-duotone";
    case "kota":
      return "solar:buildings-2-bold-duotone";
    case "kecamatan":
      return "solar:buildings-bold-duotone";
    case "kelurahan":
      return "solar:map-point-wave-bold-duotone";
    default:
      return "solar:map-point-bold-duotone";
  }
}

const KATEGORI_OPTIONS: Array<{
  value: ListingFilterState["kategori"];
  label: string;
  icon: string;
}> = [
  { value: "ALL", label: "Semua Tipe", icon: "solar:widget-3-bold-duotone" },
  { value: "RUMAH", label: "Rumah", icon: "solar:home-2-bold-duotone" },
  { value: "APARTEMEN", label: "Apartemen", icon: "solar:buildings-2-bold-duotone" },
  { value: "GUDANG", label: "Gudang", icon: "solar:box-minimalistic-bold-duotone" },
  { value: "TANAH", label: "Tanah", icon: "solar:map-point-wave-bold-duotone" },
  { value: "PABRIK", label: "Pabrik", icon: "solar:garage-bold-duotone" },
  { value: "RUKO", label: "Ruko", icon: "solar:shop-2-bold-duotone" },
  { value: "TOKO", label: "Toko", icon: "solar:shop-bold-duotone" },
  { value: "HOTEL_DAN_VILLA", label: "Hotel/Villa", icon: "solar:bed-bold-duotone" },
];

function kategoriLabel(v: ListingFilterState["kategori"]) {
  return KATEGORI_OPTIONS.find((x) => x.value === v)?.label ?? "Semua Tipe";
}
function kategoriIcon(v: ListingFilterState["kategori"]) {
  return KATEGORI_OPTIONS.find((x) => x.value === v)?.icon ?? "solar:widget-3-bold-duotone";
}

type OpenKey = null | "location" | "type";
type MenuPos = { top: number; left: number; width: number };

export default function ListingFilters(props: {
  value: ListingFilterState;
  onChange: (next: ListingFilterState) => void;
  total: number;
  loading?: boolean;
  hideVendor?: boolean;
}) {
  const { value, onChange, total, loading, hideVendor } = props;

  const set = (patch: Partial<ListingFilterState>) => onChange({ ...value, ...patch });

  const resetAll = () =>
    onChange({
      q: "",
      vendor: "",
      jenis: "ALL",
      kategori: "ALL",
      provinsi: "",
      kota: "",
      kecamatan: "",
      kelurahan: "",
    });

  const isDirty = useMemo(() => {
    return Boolean(
      clean(value.q) ||
        clean(value.vendor) ||
        value.jenis !== "ALL" ||
        value.kategori !== "ALL" ||
        clean(value.provinsi) ||
        clean(value.kota) ||
        clean(value.kecamatan) ||
        clean(value.kelurahan)
    );
  }, [value]);

  // ====== portal positioning refs ======
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const typeBtnRef = useRef<HTMLDivElement>(null);
  const locBtnRef = useRef<HTMLDivElement>(null);

  const [openDropdown, setOpenDropdown] = useState<OpenKey>(null);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);

  // ====== LOCATION (ibnux)
  const BASE_API = "https://ibnux.github.io/data-indonesia";
  const [viewLevel, setViewLevel] = useState<Level>("provinsi");
  const [currentList, setCurrentList] = useState<Region[]>([]);
  const [parentRegion, setParentRegion] = useState<Region | null>(null);
  const [loadingWilayah, setLoadingWilayah] = useState(false);
  const [searchLoc, setSearchLoc] = useState("");

  const [pickedId, setPickedId] = useState<{ provinsi?: string; kota?: string; kecamatan?: string }>({});

  const locationLabel = useMemo(() => buildLocationLabel(value), [value]);

  const mapData = (data: ApiRegion[], level: Level): Region[] =>
    (Array.isArray(data) ? data : [])
      .filter((x) => x?.id && x?.nama)
      .map((x) => ({ id: String(x.id), name: String(x.nama), level }))
      .sort((a, b) => a.name.localeCompare(b.name));

  const fetchRegions = async (level: Level, parentId?: string) => {
    setLoadingWilayah(true);
    try {
      let url = "";
      if (level === "provinsi") url = `${BASE_API}/propinsi.json`;
      if (level === "kota" && parentId) url = `${BASE_API}/kabupaten/${parentId}.json`;
      if (level === "kecamatan" && parentId) url = `${BASE_API}/kecamatan/${parentId}.json`;
      if (level === "kelurahan" && parentId) url = `${BASE_API}/kelurahan/${parentId}.json`;

      if (!url) {
        setCurrentList([]);
        return;
      }

      const res = await fetch(url);
      const data = (await res.json()) as ApiRegion[];
      setCurrentList(mapData(data, level));
    } catch (err) {
      console.error(err);
      setCurrentList([]);
    } finally {
      setLoadingWilayah(false);
    }
  };

  // ====== menu position (fixed) ======
  const updateMenuPos = () => {
    const anchor =
      openDropdown === "type"
        ? typeBtnRef.current
        : openDropdown === "location"
        ? locBtnRef.current
        : null;

    const r = anchor?.getBoundingClientRect();
    if (!r) return;

    const maxW = openDropdown === "location" ? 420 : 320;
    const width = Math.min(maxW, Math.max(260, r.width));

    const viewportW = window.innerWidth;
    const left = Math.min(r.left, viewportW - width - 12);

    setMenuPos({
      top: r.bottom + 12,
      left: Math.max(12, left),
      width,
    });
  };

  const toggleDropdown = (key: Exclude<OpenKey, null>) => {
    setOpenDropdown((prev) => {
      const next = prev === key ? null : key;
      return next;
    });
  };

  // open -> set pos
  useEffect(() => {
    if (!openDropdown) {
      setMenuPos(null);
      return;
    }
    // reset loc state if open location
    if (openDropdown === "location") {
      setViewLevel("provinsi");
      setParentRegion(null);
      setSearchLoc("");
      setPickedId({});
      fetchRegions("provinsi");
    }
    requestAnimationFrame(updateMenuPos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDropdown]);

  // keep pos updated on scroll/resize
  useEffect(() => {
    if (!openDropdown) return;
    const onScroll = () => updateMenuPos();
    const onResize = () => updateMenuPos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDropdown]);

  // close outside click (portal-friendly)
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!openDropdown) return;
      const t = e.target as Node;

      const inWrapper = !!wrapperRef.current?.contains(t);
      const inMenu = !!dropdownRef.current?.contains(t);

      // klik di area filter masih boleh (biar switch dropdown enak),
      // tapi kalau klik di luar semua, tutup
      if (!inWrapper && !inMenu) setOpenDropdown(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [openDropdown]);

  const handleRowClick = (item: Region) => {
    if (item.level === "provinsi") {
      set({ provinsi: item.name, kota: "", kecamatan: "", kelurahan: "" });
      setPickedId({ provinsi: item.id });
      setParentRegion(item);
      setViewLevel("kota");
      setSearchLoc("");
      fetchRegions("kota", item.id);
      return;
    }
    if (item.level === "kota") {
      set({ kota: item.name, kecamatan: "", kelurahan: "" });
      setPickedId((p) => ({ ...p, kota: item.id }));
      setParentRegion(item);
      setViewLevel("kecamatan");
      setSearchLoc("");
      fetchRegions("kecamatan", item.id);
      return;
    }
    if (item.level === "kecamatan") {
      set({ kecamatan: item.name, kelurahan: "" });
      setPickedId((p) => ({ ...p, kecamatan: item.id }));
      setParentRegion(item);
      setViewLevel("kelurahan");
      setSearchLoc("");
      fetchRegions("kelurahan", item.id);
      return;
    }
    set({ kelurahan: item.name });
    setOpenDropdown(null);
  };

  const handleBack = () => {
    if (viewLevel === "provinsi") return;

    if (viewLevel === "kota") {
      setViewLevel("provinsi");
      setParentRegion(null);
      setSearchLoc("");
      fetchRegions("provinsi");
      return;
    }

    if (viewLevel === "kecamatan") {
      setViewLevel("kota");
      setParentRegion(null);
      setSearchLoc("");
      fetchRegions("kota", pickedId.provinsi);
      return;
    }

    if (viewLevel === "kelurahan") {
      setViewLevel("kecamatan");
      setParentRegion(null);
      setSearchLoc("");
      fetchRegions("kecamatan", pickedId.kota);
      return;
    }
  };

  const filteredList = useMemo(() => {
    const q = clean(searchLoc).toLowerCase();
    const base = currentList ?? [];
    if (!q) return base;
    return base.filter((x) => x.name.toLowerCase().includes(q));
  }, [currentList, searchLoc]);

  // ====== pill jenis gradient
  const jenisBtn = (k: ListingFilterState["jenis"], label: string, icon: string) => {
    const active = value.jenis === k;

    const inactive = "border-zinc-800/80 bg-zinc-950/25 text-zinc-200 hover:bg-zinc-900/40";
    const activeMap: Record<ListingFilterState["jenis"], string> = {
      ALL: "border-emerald-300/35 bg-gradient-to-r from-emerald-500/25 via-emerald-400/15 to-cyan-400/10 text-emerald-50",
      PRIMARY: "border-sky-300/35 bg-gradient-to-r from-sky-500/25 via-blue-500/18 to-cyan-400/12 text-sky-50",
      SECONDARY:
        "border-fuchsia-300/30 bg-gradient-to-r from-purple-500/25 via-fuchsia-500/18 to-pink-500/12 text-fuchsia-50",
      LELANG:
        "border-amber-300/30 bg-gradient-to-r from-amber-500/25 via-orange-500/18 to-rose-500/10 text-amber-50",
      SEWA: "border-teal-300/30 bg-gradient-to-r from-teal-500/22 via-emerald-500/16 to-cyan-500/10 text-teal-50",
    };

    return (
      <button
        key={k}
        type="button"
        onClick={() => set({ jenis: k })}
        className={cx(
          "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black transition",
          "focus:outline-none focus:ring-2 focus:ring-emerald-400/15",
          active ? activeMap[k] : inactive
        )}
      >
        <Icon icon={icon} className={cx("text-base", active ? "text-white/95" : "text-zinc-300")} />
        {label}
      </button>
    );
  };

  // ====== style tokens
  const surface = cx(
    "relative overflow-visible rounded-[24px] border",
    "border-emerald-400/25",
    "bg-gradient-to-b from-emerald-400/[0.18] via-zinc-950/55 to-zinc-950/35",
    "shadow-[0_0_0_1px_rgba(16,185,129,0.12),0_18px_60px_rgba(0,0,0,0.65)]"
  );
  const inputWrap = cx(
    "rounded-2xl border border-zinc-800/70 bg-zinc-950/30",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
  );

  // ====== PORTAL MENUS ======
  const portalMenu =
    openDropdown && menuPos
      ? createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              zIndex: 2147483647, // ✅ always on top
            }}
            className="pointer-events-auto"
          >
            {openDropdown === "type" ? (
              <div className="bg-zinc-950/95 rounded-2xl shadow-2xl border border-zinc-800/70 p-2 max-h-[320px] overflow-y-auto custom-scrollbar">
                {KATEGORI_OPTIONS.map((k) => {
                  const active = value.kategori === k.value;
                  return (
                    <button
                      key={k.value}
                      type="button"
                      onClick={() => {
                        set({ kategori: k.value });
                        setOpenDropdown(null);
                      }}
                      className={cx(
                        "w-full text-left px-4 py-3 rounded-xl text-sm font-black transition-colors flex items-center gap-3",
                        active ? "bg-emerald-400/12 text-emerald-200" : "text-zinc-300 hover:bg-white/5"
                      )}
                    >
                      <Icon icon={k.icon} className={cx("text-lg", active ? "text-emerald-200" : "text-zinc-400")} />
                      {k.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="bg-zinc-950/95 rounded-2xl shadow-2xl border border-zinc-800/70 overflow-hidden flex flex-col max-h-[420px]">
                {/* Header */}
                <div className="p-4 border-b border-zinc-800/70 bg-zinc-950/70 flex items-center justify-between sticky top-0 z-10">
                  <div className="flex items-center gap-2 min-w-0">
                    {viewLevel !== "provinsi" && (
                      <button
                        type="button"
                        onClick={handleBack}
                        className="p-1.5 hover:bg-white/10 rounded-full transition-colors group"
                      >
                        <Icon icon="solar:arrow-left-linear" className="text-lg text-zinc-300 group-hover:text-white" />
                      </button>
                    )}

                    <h4 className="font-extrabold text-white text-sm flex items-center gap-2 min-w-0">
                      <Icon icon={getRegionIcon(viewLevel)} className="text-emerald-300 text-lg shrink-0" />
                      {viewLevel === "provinsi" ? (
                        <span>Pilih Wilayah</span>
                      ) : (
                        <span className="text-emerald-200 truncate max-w-[240px] block">
                          {parentRegion?.name || "Lanjut pilih"}
                        </span>
                      )}
                    </h4>
                  </div>

                  {loadingWilayah && <Icon icon="line-md:loading-loop" className="text-emerald-300 text-lg" />}
                </div>

                {/* Search */}
                <div className="p-3 border-b border-zinc-800/60 bg-zinc-950/60">
                  <div className="relative">
                    <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                      <Icon icon="solar:magnifer-linear" className="text-lg" />
                    </div>
                    <input
                      value={searchLoc}
                      onChange={(e) => setSearchLoc(e.target.value)}
                      placeholder={`Cari ${viewLevel}…`}
                      className="w-full bg-zinc-900/40 border border-zinc-800/70 rounded-xl pl-10 pr-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-400/40"
                    />
                  </div>
                </div>

                {/* List */}
                <div className="overflow-y-auto custom-scrollbar flex-1 bg-zinc-950/40">
                  {filteredList.map((item) => {
                    const hasChild = item.level !== "kelurahan";
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between group hover:bg-white/5 border-b border-white/5 last:border-0 pr-2"
                      >
                        <button
                          type="button"
                          onClick={() => handleRowClick(item)}
                          className="flex-1 flex items-center gap-3 px-4 py-3 text-left"
                        >
                          <Icon
                            icon={getRegionIcon(item.level)}
                            className="text-lg shrink-0 text-zinc-500 group-hover:text-emerald-300 transition-colors"
                          />
                          <div className="flex-1 overflow-hidden">
                            <span className="text-sm block truncate font-black text-zinc-200">{item.name}</span>
                            {hasChild && (
                              <span className="text-[10px] text-zinc-500 group-hover:text-emerald-300 transition-colors">
                                Lihat{" "}
                                {item.level === "provinsi"
                                  ? "Kota"
                                  : item.level === "kota"
                                  ? "Kecamatan"
                                  : "Kelurahan"}
                              </span>
                            )}
                          </div>
                        </button>

                        {hasChild ? (
                          <button
                            type="button"
                            onClick={() => handleRowClick(item)}
                            className="p-2 text-zinc-500 hover:text-emerald-300"
                          >
                            <Icon icon="solar:alt-arrow-right-linear" />
                          </button>
                        ) : null}
                      </div>
                    );
                  })}

                  {filteredList.length === 0 && (
                    <div className="p-4 text-center text-sm text-zinc-400">
                      {loadingWilayah ? "Memuat..." : "Tidak ada data."}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div className={surface} ref={wrapperRef}>
      {/* glow */}
      <div className="pointer-events-none absolute -top-24 left-6 h-52 w-52 rounded-full bg-emerald-400/22 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 right-8 h-56 w-56 rounded-full bg-cyan-400/12 blur-3xl" />

      <div className="p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-center">
          {/* Search ID/Alamat */}
          <div className={hideVendor ? "lg:col-span-5" : "lg:col-span-3"}>
            <div className={cx(inputWrap, "relative p-1.5")}>
              <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300">
                <Icon icon="solar:magnifer-linear" className="text-lg" />
              </div>
              <input
                className="w-full rounded-xl bg-transparent pl-10 pr-3 py-3 text-sm text-zinc-50 placeholder:text-zinc-500 outline-none"
                placeholder="ID / Alamat…"
                value={value.q}
                onChange={(e) => set({ q: e.target.value })}
              />
            </div>
          </div>

          {/* Search Vendor */}
          {!hideVendor && (
            <div className="lg:col-span-2">
              <div className={cx(inputWrap, "relative p-1.5")}>
                <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300">
                  <Icon icon="solar:buildings-2-linear" className="text-lg" />
                </div>
                <input
                  className="w-full rounded-xl bg-transparent pl-10 pr-3 py-3 text-sm text-zinc-50 placeholder:text-zinc-500 outline-none"
                  placeholder="Vendor…"
                  value={value.vendor}
                  onChange={(e) => set({ vendor: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* TIPE ASET */}
          <div className="lg:col-span-3">
            <div
              ref={typeBtnRef}
              className={cx(inputWrap, "px-3.5 py-3 hover:bg-zinc-900/35 transition cursor-pointer")}
              onClick={() => toggleDropdown("type")}
            >
              <label className="text-[10px] font-extrabold tracking-wider text-zinc-400 uppercase mb-1 block">
                Tipe Aset
              </label>
              <div className="flex items-center gap-2">
                <Icon icon={kategoriIcon(value.kategori)} className="text-xl text-zinc-400 shrink-0" />
                <p className="font-extrabold text-zinc-100 text-sm truncate flex-1">
                  {kategoriLabel(value.kategori)}
                </p>
                <Icon
                  icon="solar:alt-arrow-down-linear"
                  className={cx("text-zinc-400 transition-transform", openDropdown === "type" && "rotate-180")}
                />
              </div>
            </div>
          </div>

          {/* LOKASI */}
          <div className="lg:col-span-3">
            <div
              ref={locBtnRef}
              className={cx(inputWrap, "px-3.5 py-3 hover:bg-zinc-900/35 transition cursor-pointer")}
              onClick={() => toggleDropdown("location")}
            >
              <label className="text-[10px] font-extrabold tracking-wider text-zinc-400 uppercase mb-1 block">
                Lokasi
              </label>
              <div className="flex items-center gap-2">
                <Icon icon="solar:map-point-bold-duotone" className="text-xl text-zinc-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-zinc-100 text-sm truncate">{locationLabel}</p>
                  <p className="text-xs text-zinc-500 truncate">Pilih Provinsi, Kota, Kecamatan…</p>
                </div>
                <Icon
                  icon="solar:alt-arrow-down-linear"
                  className={cx("text-zinc-400 transition-transform", openDropdown === "location" && "rotate-180")}
                />
              </div>
            </div>
          </div>

          {/* Reset */}
          <div className="lg:col-span-1">
            <button
              type="button"
              onClick={resetAll}
              className={cx(
                "w-full rounded-2xl border px-3 py-3 text-sm font-extrabold transition",
                "border-emerald-400/30 bg-gradient-to-b from-emerald-400/12 to-zinc-950/30 text-zinc-50",
                "hover:bg-zinc-900/35 hover:border-emerald-400/55",
                "focus:outline-none focus:ring-2 focus:ring-emerald-400/12",
                !isDirty && "opacity-60"
              )}
              title="Reset semua filter"
            >
              <Icon icon="solar:restart-bold" className="inline text-lg text-emerald-200/90" />
            </button>
          </div>
        </div>

        {/* Pills + count */}
        <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {jenisBtn("ALL", "All", "solar:globus-linear")}
            {jenisBtn("PRIMARY", "Primary", "solar:home-2-linear")}
            {jenisBtn("SECONDARY", "Secondary", "solar:buildings-3-linear")}
            {jenisBtn("LELANG", "Lelang", "solar:money-bag-linear")}
            {jenisBtn("SEWA", "Sewa", "solar:key-linear")}
          </div>

          <div className="text-xs text-zinc-300 flex items-center gap-2">
            <span className={cx("h-2 w-2 rounded-full", loading ? "bg-amber-400" : "bg-emerald-400")} />
            {loading ? "Loading…" : `${formatCount(total)} listing`}
          </div>
        </div>
      </div>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-emerald-400/25 to-transparent" />

      {/* ✅ portal menu */}
      {portalMenu}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(134, 239, 172, 0.25);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(134, 239, 172, 0.45);
        }
      `}</style>
    </div>
  );
}
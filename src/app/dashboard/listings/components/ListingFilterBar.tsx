"use client";

/**
 * Bilah filter daftar listing — satu baris, menempel di atas.
 *
 * Versi sebelumnya adalah panel setinggi ~340px: kotak cari, dua kartu
 * dropdown bertingkat dua baris, tombol reset selebar kolom, lalu lima pill
 * jenis transaksi di baris sendiri. Di laptop 13" panel itu memakan hampir
 * seluruh layar pertama, sehingga halaman "daftar properti" dibuka tanpa satu
 * pun properti terlihat — alat pencarinya mengalahkan barang yang dicari.
 *
 * Prinsip susunan barunya, sama seperti yang dipakai Rightmove/Zillow/
 * Rumah123: SATU baris kontrol setinggi 44px, tiap filter jadi tombol ringkas
 * yang menampilkan nilainya sendiri, dan panel pilihannya baru muncul saat
 * diklik. Tidak ada satu pun kemampuan yang hilang — pencarian teks, jenis
 * transaksi, tipe aset, lokasi bertingkat empat level, reset, dan penghitung
 * hasil semuanya masih di sini, ditambah urutan & angka facet.
 *
 * Yang tetap terlihat tanpa diklik: apa yang sedang aktif (deret chip di
 * bawah bilah) dan berapa hasilnya. Dua itu yang benar-benar dibaca berulang;
 * sisanya cukup tersedia saat dibutuhkan.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import {
  JENIS_OPTIONS,
  KATEGORI_OPTIONS,
  FILTER_KOSONG,
  SORT_DEFAULT,
  adaYangBisaDireset,
  iconJenis,
  iconKategori,
  iconSortDasbor,
  jumlahFilterAktif,
  kategoriTersedia,
  labelJenis,
  labelKategori,
  labelSortDasbor,
  opsiUrutDasbor,
  sortIkutMenyaring,
  type DashboardSortKey,
  type JenisFilter,
  type KategoriFilter,
  type ListingFilters,
} from "../lib/filters";

/* ─────────────────────────────── Utilitas ────────────────────────────── */

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}
const bersih = (s: unknown) => String(s ?? "").trim();
const formatAngka = (n: number) => {
  try {
    return new Intl.NumberFormat("id-ID").format(n);
  } catch {
    return String(n);
  }
};

type Level = "provinsi" | "kota" | "kecamatan" | "kelurahan";
type Region = { id: string; name: string; level: Level };
type ApiRegion = { id: string; nama: string };

const IKON_LEVEL: Record<Level, string> = {
  provinsi: "solar:globus-bold-duotone",
  kota: "solar:buildings-2-bold-duotone",
  kecamatan: "solar:buildings-bold-duotone",
  kelurahan: "solar:map-point-wave-bold-duotone",
};

const LEVEL_BERIKUT: Record<Level, Level | null> = {
  provinsi: "kota",
  kota: "kecamatan",
  kecamatan: "kelurahan",
  kelurahan: null,
};

const LABEL_LEVEL: Record<Level, string> = {
  provinsi: "Provinsi",
  kota: "Kota / Kabupaten",
  kecamatan: "Kecamatan",
  kelurahan: "Kelurahan",
};

function ringkasLokasi(v: ListingFilters): string {
  const bagian = [v.provinsi, v.kota, v.kecamatan, v.kelurahan].map(bersih).filter(Boolean);
  if (!bagian.length) return "Semua Lokasi";
  // Yang paling menentukan adalah wilayah TERSEMPIT yang dipilih — itu yang
  // ditampilkan, bukan provinsinya. "Gubeng" lebih memberi tahu daripada
  // "Jawa Timur / …".
  return bagian[bagian.length - 1];
}

/* ─────────────────────────── Popover berjangkar ──────────────────────── */

type MenuKey = "jenis" | "tipe" | "lokasi" | "urut";
type PosisiMenu = { top: number; left: number; width: number; maxHeight: number };

/** Panel melayang yang mengikuti tombolnya; membalik ke atas kalau ruang
 *  bawah tidak cukup, dan selalu tetap di dalam layar. */
function useAnchoredMenu(
  open: MenuKey | null,
  anchorRef: React.RefObject<HTMLElement>,
  lebarIdeal: number
) {
  const [pos, setPos] = useState<PosisiMenu | null>(null);

  const hitung = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const width = Math.min(lebarIdeal, Math.max(240, vw - 24));
    const left = Math.max(12, Math.min(r.left, vw - width - 12));

    const ruangBawah = vh - r.bottom - 16;
    const ruangAtas = r.top - 16;
    const keAtas = ruangBawah < 260 && ruangAtas > ruangBawah;

    const maxHeight = Math.min(440, Math.max(200, keAtas ? ruangAtas : ruangBawah));
    const top = keAtas ? r.top - 8 - maxHeight : r.bottom + 8;

    setPos({ top, left, width, maxHeight });
  }, [anchorRef, lebarIdeal]);

  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    hitung();
    const f = () => hitung();
    // `true` (capture) supaya panel ikut bergerak saat yang men-scroll adalah
    // kontainer dasbor, bukan window.
    window.addEventListener("scroll", f, true);
    window.addEventListener("resize", f);
    return () => {
      window.removeEventListener("scroll", f, true);
      window.removeEventListener("resize", f);
    };
  }, [open, hitung]);

  return pos;
}

function PanelMenu({
  pos,
  children,
  panelRef,
}: {
  pos: PosisiMenu | null;
  children: React.ReactNode;
  panelRef: React.RefObject<HTMLDivElement>;
}) {
  const [siap, setSiap] = useState(false);
  useEffect(() => setSiap(true), []);
  if (!siap || !pos) return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: pos.width,
        maxHeight: pos.maxHeight,
        zIndex: 2147483000,
      }}
      className="lfb-masuk flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#080b0a]/95 shadow-[0_24px_70px_rgba(0,0,0,0.85)] backdrop-blur-xl"
    >
      {children}
    </div>,
    document.body
  );
}

/* ──────────────────────────── Tombol pemicu ──────────────────────────── */

const Pemicu = React.forwardRef<
  HTMLButtonElement,
  {
    icon: string;
    label: string;
    caption?: string;
    aktif?: boolean;
    terbuka?: boolean;
    onClick: () => void;
  }
>(function Pemicu({ icon, label, caption, aktif, terbuka, onClick }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-expanded={!!terbuka}
      aria-haspopup="menu"
      title={caption ? `${caption}: ${label}` : label}
      className={cx(
        "group inline-flex h-9 max-w-[190px] shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold transition-all duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50",
        aktif
          ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100 shadow-[0_0_14px_rgba(16,185,129,0.15)]"
          : terbuka
            ? "border-white/20 bg-white/10 text-zinc-100"
            : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/20 hover:bg-white/10 hover:text-white"
      )}
    >
      <Icon
        icon={icon}
        className={cx("shrink-0 text-base", aktif ? "text-emerald-300" : "text-zinc-400")}
      />
      <span className="truncate">{label}</span>
      <Icon
        icon="solar:alt-arrow-down-linear"
        className={cx(
          "shrink-0 text-[11px] transition-transform duration-150",
          aktif ? "text-emerald-300/70" : "text-zinc-500",
          terbuka && "rotate-180"
        )}
      />
    </button>
  );
});

/** Baris pilihan di dalam panel — dipakai jenis, tipe, dan urutan. */
function BarisOpsi({
  icon,
  label,
  hint,
  count,
  aktif,
  redup,
  onClick,
}: {
  icon: string;
  label: string;
  hint?: string;
  count?: number;
  aktif?: boolean;
  redup?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors",
        aktif ? "bg-emerald-400/10" : "hover:bg-white/5"
      )}
    >
      <Icon
        icon={icon}
        className={cx(
          "shrink-0 text-lg",
          aktif ? "text-emerald-300" : redup ? "text-zinc-600" : "text-zinc-400"
        )}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cx(
            "block truncate text-[13px] font-bold",
            aktif ? "text-emerald-200" : redup ? "text-zinc-500" : "text-zinc-200"
          )}
        >
          {label}
        </span>
        {hint && (
          <span className="mt-0.5 block truncate text-[10px] leading-tight text-zinc-500">
            {hint}
          </span>
        )}
      </span>
      {count !== undefined && (
        <span
          className={cx(
            "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
            aktif
              ? "bg-emerald-400/20 text-emerald-200"
              : count === 0
                ? "bg-white/5 text-zinc-600"
                : "bg-white/5 text-zinc-400"
          )}
        >
          {formatAngka(count)}
        </span>
      )}
      {aktif && count === undefined && (
        <Icon icon="solar:check-circle-bold" className="shrink-0 text-base text-emerald-300" />
      )}
    </button>
  );
}

/* ─────────────────────────── Chip filter aktif ───────────────────────── */

function ChipAktif({
  icon,
  label,
  onHapus,
  nada = "hijau",
}: {
  icon: string;
  label: string;
  onHapus: () => void;
  nada?: "hijau" | "kuning";
}) {
  return (
    <span
      className={cx(
        "inline-flex h-7 items-center gap-1.5 rounded-full border pl-2.5 pr-1 text-[11px] font-bold",
        nada === "kuning"
          ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
          : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
      )}
    >
      <Icon
        icon={icon}
        className={cx("text-sm", nada === "kuning" ? "text-amber-300" : "text-emerald-300")}
      />
      <span className="max-w-[180px] truncate">{label}</span>
      <button
        type="button"
        onClick={onHapus}
        aria-label={`Hapus filter ${label}`}
        className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full opacity-70 transition-all hover:bg-white/15 hover:opacity-100"
      >
        <Icon icon="mdi:close" className="text-[12px]" />
      </button>
    </span>
  );
}

/* ────────────────────────────── Komponen ─────────────────────────────── */

export default function ListingFilterBar({
  value,
  onChange,
  total,
  loading,
  jenisCounts,
  kategoriCounts,
}: {
  value: ListingFilters;
  onChange: (next: ListingFilters) => void;
  total: number;
  loading?: boolean;
  jenisCounts?: Record<string, number>;
  kategoriCounts?: Record<string, number>;
}) {
  const [buka, setBuka] = useState<MenuKey | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const refJenis = useRef<HTMLButtonElement>(null);
  const refTipe = useRef<HTMLButtonElement>(null);
  const refLokasi = useRef<HTMLButtonElement>(null);
  const refUrut = useRef<HTMLButtonElement>(null);

  const anchorAktif =
    buka === "jenis"
      ? refJenis
      : buka === "tipe"
        ? refTipe
        : buka === "lokasi"
          ? refLokasi
          : refUrut;
  const lebarPanel = buka === "lokasi" ? 380 : buka === "urut" ? 320 : 280;
  const pos = useAnchoredMenu(buka, anchorAktif as React.RefObject<HTMLElement>, lebarPanel);

  const set = (patch: Partial<ListingFilters>) => onChange({ ...value, ...patch });

  /* ── tutup saat klik di luar / tekan Esc, dan pintasan "/" ── */
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!buka) return;
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setBuka(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [buka]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      const sedangMengetik =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el as HTMLElement | null)?.isContentEditable;

      if (e.key === "Escape") {
        if (buka) {
          setBuka(null);
          return;
        }
        if (el === inputRef.current && value.q) set({ q: "" });
        return;
      }
      // "/" = lompat ke kotak cari, pintasan yang sama dipakai GitHub/Notion.
      if (e.key === "/" && !sedangMengetik) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buka, value.q]);

  const toggle = (k: MenuKey) => setBuka((p) => (p === k ? null : k));

  /* ── Perubahan jenis merembet: kategori & urutan bisa jadi tidak berlaku ── */
  const terapkanJenis = (jenis: JenisFilter, kategoriPilihan?: KategoriFilter) => {
    const kategoriAwal = kategoriPilihan ?? value.kategori;
    const kategori: KategoriFilter = kategoriTersedia(kategoriAwal, jenis)
      ? kategoriAwal
      : "ALL";
    // Opsi urut khas lelang tidak ada di konteks lain; membiarkannya berarti
    // URL menyimpan urutan yang diam-diam diabaikan server.
    const sortMasihAda = opsiUrutDasbor(jenis).some((o) => o.value === value.sort);
    onChange({
      ...value,
      jenis,
      kategori,
      sort: sortMasihAda ? value.sort : SORT_DEFAULT,
    });
    setBuka(null);
  };

  const gantiJenis = (jenis: JenisFilter) => terapkanJenis(jenis);

  const gantiKategori = (kategori: KategoriFilter) => {
    // Memilih "Kos" saat jenisnya belum Sewa langsung memindahkan keduanya —
    // kos hanya ada di transaksi sewa, jadi maksud pemakainya tidak ambigu.
    if (!kategoriTersedia(kategori, value.jenis)) {
      terapkanJenis("SEWA", kategori);
      return;
    }
    set({ kategori });
    setBuka(null);
  };

  const reset = () => {
    onChange({ ...FILTER_KOSONG });
    setBuka(null);
  };

  const opsiUrut = useMemo(() => opsiUrutDasbor(value.jenis), [value.jenis]);
  const filterAktif = jumlahFilterAktif(value);
  const bisaReset = adaYangBisaDireset(value);
  const lokasiLabel = ringkasLokasi(value);
  const adaLokasi = Boolean(value.provinsi || value.kota || value.kecamatan || value.kelurahan);

  return (
    <div
      ref={wrapRef}
      // Menempel di atas area gulir dasbor: begitu kartunya banyak, filter tetap
      // terjangkau tanpa menggulir balik ke puncak halaman.
      //
      // Latar & blur wajib ada di pembungkusnya, bukan cuma di bilahnya: deret
      // chip di bawah bilah ikut menempel, dan tanpa latar kartu yang lewat di
      // belakangnya terbaca menembus tulisan chip.
      className="sticky top-0 z-30 -mx-1 bg-[#020617]/95 px-1 py-2 backdrop-blur-md"
    >
      <div className="rounded-2xl border border-white/10 bg-[#080b0a]/95 p-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* ── Cari ──
              Di ponsel kotak cari mengambil barisnya sendiri (basis-full) dan
              pemicu filter turun ke baris kedua sebagai deret yang bisa
              digeser — pola yang sama dipakai Airbnb/Traveloka. Di layar lebar
              semuanya kembali jadi satu baris. */}
          <div className="relative flex h-9 min-w-[190px] flex-1 basis-full items-center rounded-xl border border-white/10 bg-white/5 focus-within:border-emerald-400/40 focus-within:bg-white/10 sm:basis-auto">
            <Icon
              icon="solar:magnifer-linear"
              className="pointer-events-none absolute left-2.5 text-base text-zinc-400"
            />
            <input
              ref={inputRef}
              value={value.q}
              onChange={(e) => set({ q: e.target.value })}
              // Mengetik dan panel terbuka tidak pernah dilakukan bersamaan;
              // panel yang menggantung di atas hasil hanya menghalangi.
              onFocus={() => setBuka(null)}
              placeholder="Cari ID, judul, atau alamat…"
              aria-label="Cari listing"
              className="h-full w-full bg-transparent pl-8 pr-16 text-xs font-semibold text-zinc-100 outline-none placeholder:font-medium placeholder:text-zinc-500"
            />
            {value.q ? (
              <button
                type="button"
                onClick={() => {
                  set({ q: "" });
                  inputRef.current?.focus();
                }}
                aria-label="Bersihkan pencarian"
                className="absolute right-2 flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-zinc-300 transition-colors hover:bg-white/20 hover:text-white"
              >
                <Icon icon="mdi:close" className="text-[12px]" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2 hidden rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 sm:block">
                /
              </kbd>
            )}
          </div>

          {/* ── Pemicu filter ── */}
          <div className="lfb-no-bar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-none sm:overflow-visible">
          <Pemicu
            ref={refJenis}
            icon={iconJenis(value.jenis)}
            label={labelJenis(value.jenis)}
            caption="Jenis transaksi"
            aktif={value.jenis !== "ALL"}
            terbuka={buka === "jenis"}
            onClick={() => toggle("jenis")}
          />
          <Pemicu
            ref={refTipe}
            icon={iconKategori(value.kategori)}
            label={labelKategori(value.kategori)}
            caption="Tipe aset"
            aktif={value.kategori !== "ALL"}
            terbuka={buka === "tipe"}
            onClick={() => toggle("tipe")}
          />
          <Pemicu
            ref={refLokasi}
            icon="solar:map-point-bold-duotone"
            label={lokasiLabel}
            caption="Lokasi"
            aktif={adaLokasi}
            terbuka={buka === "lokasi"}
            onClick={() => toggle("lokasi")}
          />

          <span className="mx-0.5 hidden h-5 w-px bg-white/10 lg:block" />

          <Pemicu
            ref={refUrut}
            icon={iconSortDasbor(value.sort, value.jenis)}
            label={labelSortDasbor(value.sort, value.jenis)}
            caption="Urutkan"
            aktif={value.sort !== SORT_DEFAULT}
            terbuka={buka === "urut"}
            onClick={() => toggle("urut")}
          />
          </div>

          {/* ── Hasil + reset ── */}
          <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-1">
            <span className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 text-[11px] font-bold text-zinc-300">
              <span
                className={cx(
                  "h-1.5 w-1.5 rounded-full",
                  loading ? "animate-pulse bg-amber-400" : "bg-emerald-400"
                )}
              />
              {loading ? "Memuat…" : `${formatAngka(total)} listing`}
            </span>

            <button
              type="button"
              onClick={reset}
              disabled={!bisaReset}
              title="Reset semua filter"
              aria-label="Reset semua filter"
              className={cx(
                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all",
                bisaReset
                  ? "border-white/10 bg-white/5 text-zinc-300 hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200"
                  : "cursor-not-allowed border-white/5 bg-white/5 text-zinc-600"
              )}
            >
              <Icon icon="solar:restart-bold" className="text-base" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Chip filter aktif — hanya muncul kalau memang ada yang aktif ── */}
      {(filterAktif > 0 || sortIkutMenyaring(value.sort)) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 px-0.5">
          {value.q.trim() && (
            <ChipAktif
              icon="solar:magnifer-linear"
              label={`"${value.q.trim()}"`}
              onHapus={() => set({ q: "" })}
            />
          )}
          {value.jenis !== "ALL" && (
            <ChipAktif
              icon={iconJenis(value.jenis)}
              label={labelJenis(value.jenis)}
              onHapus={() => gantiJenis("ALL")}
            />
          )}
          {value.kategori !== "ALL" && (
            <ChipAktif
              icon={iconKategori(value.kategori)}
              label={labelKategori(value.kategori)}
              onHapus={() => set({ kategori: "ALL" })}
            />
          )}
          {(["provinsi", "kota", "kecamatan", "kelurahan"] as Level[]).map((lv) =>
            value[lv] ? (
              <ChipAktif
                key={lv}
                icon={IKON_LEVEL[lv]}
                label={value[lv]}
                // Membuang satu level ikut membuang level di bawahnya: "Jawa
                // Timur dihapus tapi Gubeng tetap" bukan lokasi yang masuk akal.
                onHapus={() =>
                  set(
                    lv === "provinsi"
                      ? { provinsi: "", kota: "", kecamatan: "", kelurahan: "" }
                      : lv === "kota"
                        ? { kota: "", kecamatan: "", kelurahan: "" }
                        : lv === "kecamatan"
                          ? { kecamatan: "", kelurahan: "" }
                          : { kelurahan: "" }
                  )
                }
              />
            ) : null
          )}

          {/* Urutan lelang yang ikut menyaring WAJIB terlihat di sini —
              tanpanya agent mengira sebagian listingnya hilang. */}
          {sortIkutMenyaring(value.sort) && (
            <ChipAktif
              nada="kuning"
              icon="solar:danger-triangle-bold-duotone"
              label={`${labelSortDasbor(value.sort, value.jenis)} — hasil ikut disaring`}
              onHapus={() => set({ sort: SORT_DEFAULT })}
            />
          )}

          {filterAktif > 1 && (
            <button
              type="button"
              onClick={reset}
              className="ml-0.5 text-[11px] font-bold text-zinc-400 underline decoration-dotted underline-offset-4 transition-colors hover:text-red-300"
            >
              Hapus semua
            </button>
          )}
        </div>
      )}

      {/* ── Panel ── */}
      {buka === "jenis" && (
        <PanelMenu pos={pos} panelRef={panelRef}>
          <div className="lfb-scroll overflow-y-auto p-1.5">
            {JENIS_OPTIONS.map((o) => (
              <BarisOpsi
                key={o.value}
                icon={o.icon}
                label={o.label}
                count={jenisCounts?.[o.value] ?? undefined}
                aktif={value.jenis === o.value}
                onClick={() => gantiJenis(o.value)}
              />
            ))}
          </div>
        </PanelMenu>
      )}

      {buka === "tipe" && (
        <PanelMenu pos={pos} panelRef={panelRef}>
          <div className="lfb-scroll overflow-y-auto p-1.5">
            {KATEGORI_OPTIONS.map((o) => {
              const tersedia = kategoriTersedia(o.value, value.jenis);
              return (
                <BarisOpsi
                  key={o.value}
                  icon={o.icon}
                  label={o.label}
                  hint={tersedia ? undefined : "Khusus jenis Sewa — pilih untuk beralih"}
                  count={tersedia ? kategoriCounts?.[o.value] ?? undefined : undefined}
                  aktif={value.kategori === o.value}
                  redup={!tersedia}
                  onClick={() => gantiKategori(o.value)}
                />
              );
            })}
          </div>
        </PanelMenu>
      )}

      {buka === "urut" && (
        <PanelMenu pos={pos} panelRef={panelRef}>
          <div className="lfb-scroll overflow-y-auto p-1.5">
            {opsiUrut.map((o) => (
              <BarisOpsi
                key={o.value}
                icon={o.icon}
                label={o.label}
                hint={o.hint}
                aktif={value.sort === o.value}
                onClick={() => {
                  set({ sort: o.value as DashboardSortKey });
                  setBuka(null);
                }}
              />
            ))}
          </div>
        </PanelMenu>
      )}

      {buka === "lokasi" && (
        <PanelMenu pos={pos} panelRef={panelRef}>
          <PickerLokasi
            value={value}
            onPatch={(patch) => set(patch)}
            onTutup={() => setBuka(null)}
          />
        </PanelMenu>
      )}

      {/* Panel dirender lewat portal ke <body>, jadi gayanya harus global —
          styled-jsx yang tercakup komponen tidak ikut ke sana. */}
      <style jsx global>{`
        @keyframes lfb-turun {
          from {
            opacity: 0;
            transform: translateY(-6px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .lfb-masuk {
          animation: lfb-turun 0.14s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @media (prefers-reduced-motion: reduce) {
          .lfb-masuk {
            animation: none;
          }
        }
        .lfb-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .lfb-scroll::-webkit-scrollbar-thumb {
          background: rgba(134, 239, 172, 0.25);
          border-radius: 10px;
        }
        .lfb-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .lfb-no-bar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────── Picker lokasi ───────────────────────────── */

/**
 * Pemilih wilayah bertingkat empat level (provinsi → kota → kecamatan →
 * kelurahan) dengan data dari dataset wilayah Indonesia.
 *
 * Dua hal yang diperbaiki dari versi lama, keduanya soal "di mana saya
 * sekarang": ada BREADCRUMB yang bisa diklik untuk melompat balik ke level
 * mana pun (dulu hanya panah kembali satu langkah, dan menutup panel
 * menghapus jejaknya), dan pilihan bisa langsung dipakai di level mana pun —
 * memilih kota tidak memaksa turun sampai kelurahan.
 */
function PickerLokasi({
  value,
  onPatch,
  onTutup,
}: {
  value: ListingFilters;
  onPatch: (patch: Partial<ListingFilters>) => void;
  onTutup: () => void;
}) {
  const BASE_API = "https://ibnux.github.io/data-indonesia";

  const [level, setLevel] = useState<Level>("provinsi");
  const [daftar, setDaftar] = useState<Region[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [cari, setCari] = useState("");
  const [indukId, setIndukId] = useState<{ provinsi?: string; kota?: string; kecamatan?: string }>(
    {}
  );

  /** Ambil daftar wilayah satu level. Murni — tidak menyentuh state. */
  const ambilData = useCallback(async (lv: Level, indukID?: string): Promise<Region[]> => {
    const url =
      lv === "provinsi"
        ? `${BASE_API}/propinsi.json`
        : lv === "kota" && indukID
          ? `${BASE_API}/kabupaten/${indukID}.json`
          : lv === "kecamatan" && indukID
            ? `${BASE_API}/kecamatan/${indukID}.json`
            : lv === "kelurahan" && indukID
              ? `${BASE_API}/kelurahan/${indukID}.json`
              : "";
    if (!url) return [];
    try {
      const res = await fetch(url);
      const data = (await res.json()) as ApiRegion[];
      return (Array.isArray(data) ? data : [])
        .filter((x) => x?.id && x?.nama)
        .map((x) => ({ id: String(x.id), name: String(x.nama), level: lv }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }, []);

  const ambil = useCallback(
    async (lv: Level, indukID?: string) => {
      setMemuat(true);
      try {
        setDaftar(await ambilData(lv, indukID));
      } finally {
        setMemuat(false);
      }
    },
    [ambilData]
  );

  /**
   * Panel dibuka dengan lokasi yang SUDAH terpilih harus melanjutkan dari sana,
   * bukan kembali ke daftar provinsi. Id wilayah tidak disimpan di URL (yang
   * disimpan namanya, supaya tautannya terbaca manusia), jadi id-nya dicari
   * ulang dengan menelusuri nama tersimpan level demi level.
   *
   * Tanpa ini, breadcrumb "Kota Surabaya" pada panel yang baru dibuka menunjuk
   * ke daftar yang induknya tidak diketahui — dan yang muncul daftar kosong.
   */
  useEffect(() => {
    let batal = false;
    const samaNama = (a: string, b: string) =>
      a.trim().toLowerCase() === b.trim().toLowerCase();

    (async () => {
      setMemuat(true);
      try {
        const prov = await ambilData("provinsi");
        if (batal) return;
        setDaftar(prov);

        if (!value.provinsi) return;
        const p = prov.find((x) => samaNama(x.name, value.provinsi));
        if (!p) return;
        const kota = await ambilData("kota", p.id);
        if (batal) return;
        setIndukId({ provinsi: p.id });
        setLevel("kota");
        setDaftar(kota);

        if (!value.kota) return;
        const k = kota.find((x) => samaNama(x.name, value.kota));
        if (!k) return;
        const kec = await ambilData("kecamatan", k.id);
        if (batal) return;
        setIndukId((s) => ({ ...s, kota: k.id }));
        setLevel("kecamatan");
        setDaftar(kec);

        if (!value.kecamatan) return;
        const c = kec.find((x) => samaNama(x.name, value.kecamatan));
        if (!c) return;
        const kel = await ambilData("kelurahan", c.id);
        if (batal) return;
        setIndukId((s) => ({ ...s, kecamatan: c.id }));
        setLevel("kelurahan");
        setDaftar(kel);
      } finally {
        if (!batal) setMemuat(false);
      }
    })();

    return () => {
      batal = true;
    };
    // Sengaja hanya saat panel dipasang: sesudahnya navigasi dikendalikan
    // pemakai, dan menyetel ulang di tengah jalan akan melempar dia balik.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambilData]);

  const pilih = (item: Region) => {
    const berikut = LEVEL_BERIKUT[item.level];

    if (item.level === "provinsi") {
      onPatch({ provinsi: item.name, kota: "", kecamatan: "", kelurahan: "" });
      setIndukId({ provinsi: item.id });
    } else if (item.level === "kota") {
      onPatch({ kota: item.name, kecamatan: "", kelurahan: "" });
      setIndukId((p) => ({ ...p, kota: item.id }));
    } else if (item.level === "kecamatan") {
      onPatch({ kecamatan: item.name, kelurahan: "" });
      setIndukId((p) => ({ ...p, kecamatan: item.id }));
    } else {
      onPatch({ kelurahan: item.name });
      onTutup();
      return;
    }

    if (berikut) {
      setLevel(berikut);
      setCari("");
      ambil(berikut, item.id);
    }
  };

  /** Lompat ke level tertentu lewat breadcrumb. */
  const keLevel = (lv: Level) => {
    setCari("");
    setLevel(lv);
    if (lv === "provinsi") ambil("provinsi");
    if (lv === "kota") ambil("kota", indukId.provinsi);
    if (lv === "kecamatan") ambil("kecamatan", indukId.kota);
    if (lv === "kelurahan") ambil("kelurahan", indukId.kecamatan);
  };

  const remah = useMemo(() => {
    const r: { level: Level; label: string }[] = [];
    if (value.provinsi) r.push({ level: "provinsi", label: value.provinsi });
    if (value.kota) r.push({ level: "kota", label: value.kota });
    if (value.kecamatan) r.push({ level: "kecamatan", label: value.kecamatan });
    if (value.kelurahan) r.push({ level: "kelurahan", label: value.kelurahan });
    return r;
  }, [value.provinsi, value.kota, value.kecamatan, value.kelurahan]);

  const tersaring = useMemo(() => {
    const q = bersih(cari).toLowerCase();
    if (!q) return daftar;
    return daftar.filter((x) => x.name.toLowerCase().includes(q));
  }, [daftar, cari]);

  const adaLokasi = Boolean(value.provinsi || value.kota || value.kecamatan || value.kelurahan);

  return (
    <>
      {/* Kepala: breadcrumb + hapus */}
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
        <Icon icon={IKON_LEVEL[level]} className="shrink-0 text-base text-emerald-300" />
        <div className="lfb-no-bar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-[11px] font-bold [-ms-overflow-style:none] [scrollbar-width:none]">
          {remah.length === 0 ? (
            <span className="text-zinc-300">Pilih {LABEL_LEVEL[level]}</span>
          ) : (
            remah.map((r, i) => (
              <React.Fragment key={r.level}>
                {i > 0 && <Icon icon="solar:alt-arrow-right-linear" className="text-zinc-600" />}
                <button
                  type="button"
                  onClick={() => keLevel(r.level)}
                  className="max-w-[120px] shrink-0 truncate rounded px-1 py-0.5 text-emerald-200 transition-colors hover:bg-white/10"
                >
                  {r.label}
                </button>
              </React.Fragment>
            ))
          )}
        </div>
        {memuat && <Icon icon="line-md:loading-loop" className="shrink-0 text-sm text-emerald-300" />}
        {adaLokasi && (
          <button
            type="button"
            onClick={() => {
              onPatch({ provinsi: "", kota: "", kecamatan: "", kelurahan: "" });
              setIndukId({});
              keLevel("provinsi");
            }}
            className="shrink-0 rounded-lg px-1.5 py-1 text-[10px] font-bold text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
          >
            Hapus
          </button>
        )}
      </div>

      {/* Cari wilayah */}
      <div className="border-b border-white/10 p-2">
        <div className="relative">
          <Icon
            icon="solar:magnifer-linear"
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-zinc-500"
          />
          <input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder={`Cari ${LABEL_LEVEL[level].toLowerCase()}…`}
            autoFocus
            className="h-8 w-full rounded-lg border border-white/10 bg-white/5 pl-8 pr-2 text-xs font-semibold text-zinc-100 outline-none placeholder:font-medium placeholder:text-zinc-500 focus:border-emerald-400/40"
          />
        </div>
      </div>

      {/* Daftar wilayah */}
      <div className="lfb-scroll flex-1 overflow-y-auto p-1.5">
        {level !== "provinsi" && (
          <button
            type="button"
            onClick={() => {
              const naik: Record<Level, Level> = {
                provinsi: "provinsi",
                kota: "provinsi",
                kecamatan: "kota",
                kelurahan: "kecamatan",
              };
              keLevel(naik[level]);
            }}
            className="mb-1 flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-[11px] font-bold text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
          >
            <Icon icon="solar:alt-arrow-left-linear" className="text-sm" />
            Kembali ke {LABEL_LEVEL[level === "kota" ? "provinsi" : level === "kecamatan" ? "kota" : "kecamatan"]}
          </button>
        )}

        {tersaring.map((item) => {
          const terpilih =
            bersih(value[item.level]).toLowerCase() === item.name.trim().toLowerCase();
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => pilih(item)}
              className={cx(
                "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors",
                terpilih ? "bg-emerald-400/10" : "hover:bg-white/5"
              )}
            >
              <Icon
                icon={IKON_LEVEL[item.level]}
                className={cx("shrink-0 text-base", terpilih ? "text-emerald-300" : "text-zinc-500")}
              />
              <span
                className={cx(
                  "min-w-0 flex-1 truncate text-[13px] font-bold",
                  terpilih ? "text-emerald-200" : "text-zinc-200"
                )}
              >
                {item.name}
              </span>
              {LEVEL_BERIKUT[item.level] && (
                <Icon
                  icon="solar:alt-arrow-right-linear"
                  className="shrink-0 text-sm text-zinc-600"
                />
              )}
            </button>
          );
        })}

        {tersaring.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-zinc-500">
            {memuat ? "Memuat wilayah…" : "Wilayah tidak ditemukan."}
          </p>
        )}
      </div>

      {/* Kaki: pakai wilayah yang sedang dipilih tanpa harus turun ke kelurahan */}
      {adaLokasi && (
        <div className="border-t border-white/10 p-2">
          <button
            type="button"
            onClick={onTutup}
            className="h-9 w-full rounded-xl border border-emerald-400/40 bg-emerald-500/15 text-xs font-black text-emerald-100 transition-colors hover:bg-emerald-500/25"
          >
            Terapkan · {ringkasLokasi(value)}
          </button>
        </div>
      )}
    </>
  );
}

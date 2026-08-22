"use client";

/**
 * TabFilterFields — dua kolom terakhir search bar yang ISINYA MENGIKUTI pill
 * transaksi yang sedang aktif:
 *
 *   • Sewa            → Durasi Sewa + Harga Sewa
 *   • Semua/Jual/Lelang → Harga + Dimensi (Luas Tanah / Luas Bangunan)
 *
 * Dirender sebagai dua <div> bersaudara (bukan satu pembungkus) supaya garis
 * pemisah `divide-x` milik kartu tetap jatuh di antara kolom seperti kolom
 * lainnya. Pergantian mode diberi animasi masuk singkat lewat `key` pada
 * motion.div — remount = animasi terputar ulang, tanpa exit animation yang
 * bisa membuat tinggi baris berkedut.
 */

import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import {
  DURASI_OPTIONS,
  durasiLabelFor,
  durasiUnitFor,
  isRentTab,
  type RangeErrors,
  type RangeField,
  type SearchFormState,
  type TxTab,
} from "@/lib/searchTabs";

type Theme = "light" | "dark";

interface ThemeTokens {
  label: string;
  value: string;
  icon: string;
  focusRing: string;
  panel: string;
  panelTitle: string;
  hint: string;
  input: string;
  inputError: string;
  error: string;
  sep: string;
  optionIdle: string;
  note: string;
}

const THEMES: Record<Theme, ThemeTokens> = {
  light: {
    label: "text-gray-400 group-hover:text-primary",
    value: "text-gray-800",
    icon: "text-gray-400 group-hover:text-primary",
    focusRing: "focus-visible:ring-primary/50",
    panel: "bg-white border-gray-100",
    panelTitle: "text-gray-800",
    hint: "text-gray-500",
    input:
      "bg-gray-50 border-gray-200 text-gray-700 placeholder:text-gray-400 focus:border-primary",
    inputError: "border-red-400",
    error: "text-red-500",
    sep: "text-gray-400",
    optionIdle: "text-gray-600 hover:bg-gray-50",
    note: "bg-orange-50 text-orange-600 border-orange-100",
  },
  dark: {
    label: "text-gray-400 group-hover:text-primary",
    value: "text-white",
    icon: "text-gray-400 group-hover:text-primary",
    focusRing: "focus-visible:ring-primary/60",
    panel: "bg-[#222] border-white/10",
    panelTitle: "text-white",
    hint: "text-gray-500",
    input:
      "bg-[#1A1A1A] border-white/10 text-white placeholder:text-gray-600 focus:border-primary",
    inputError: "border-red-500/70",
    error: "text-red-400",
    sep: "text-gray-500",
    optionIdle: "text-gray-300 hover:bg-white/5",
    note: "bg-orange-500/10 text-orange-300 border-orange-500/25",
  },
};

/** Animasi masuk saat kolom berganti mode. */
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

const SWAP_MOTION = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.24, ease: EASE_OUT_EXPO },
};

const rangeLabel = (min: string, max: string, fallback: string, suffix = "") => {
  if (min && max) return `${min} - ${max}${suffix}`;
  if (min) return `Mulai ${min}${suffix}`;
  if (max) return `Hingga ${max}${suffix}`;
  return fallback;
};

/**
 * Ringkasan dimensi. Versi lama hanya membaca luas tanah, jadi filter yang
 * cuma mengisi luas bangunan tetap tampil sebagai "Luas Tanah/Bangunan" —
 * terlihat seperti filternya tidak tersimpan.
 */
const dimensionSummary = (s: SearchFormState) => {
  const lt = rangeLabel(s.minLt, s.maxLt, "");
  const lb = rangeLabel(s.minLb, s.maxLb, "");
  const parts: string[] = [];
  if (lt) parts.push(`LT ${lt}`);
  if (lb) parts.push(`LB ${lb}`);
  return parts.length ? `${parts.join(" · ")} m²` : "Luas Tanah/Bangunan";
};

function Slot({
  width,
  children,
}: {
  width: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`w-full ${width} px-3 lg:px-4 py-4 lg:py-2.5 relative group min-w-0`}>
      {children}
    </div>
  );
}

function Trigger({
  t,
  label,
  icon,
  value,
  open,
  onToggle,
  panelId,
}: {
  t: ThemeTokens;
  label: string;
  icon: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  panelId: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={panelId}
      className={`w-full text-left rounded-lg outline-none focus-visible:ring-2 ${t.focusRing}`}
    >
      <span
        className={`block text-[10px] font-extrabold tracking-wider uppercase mb-1 transition-colors ${t.label}`}
      >
        {label}
      </span>
      <span className="flex items-center gap-2">
        <Icon icon={icon} className={`text-xl shrink-0 transition-colors ${t.icon}`} />
        <span title={value} className={`font-bold text-sm truncate flex-1 ${t.value}`}>
          {value}
        </span>
        <Icon
          icon="solar:alt-arrow-down-linear"
          className={`shrink-0 transition-transform ${t.icon} ${open ? "rotate-180" : ""}`}
        />
      </span>
    </button>
  );
}

function Panel({
  t,
  id,
  alignRight,
  onClose,
  children,
}: {
  t: ThemeTokens;
  id: string;
  alignRight?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      id={id}
      role="dialog"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
      className={`absolute top-full ${
        alignRight ? "left-0 lg:left-auto lg:right-0" : "left-0"
      } w-full lg:w-[320px] rounded-2xl shadow-2xl border mt-4 p-5 z-50 ${t.panel}`}
    >
      {children}
    </motion.div>
  );
}

function MinMaxInputs({
  t,
  minValue,
  maxValue,
  onMin,
  onMax,
  error,
  onSubmit,
  separator = "s/d",
  ariaMin,
  ariaMax,
}: {
  t: ThemeTokens;
  minValue: string;
  maxValue: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
  error?: string;
  onSubmit?: () => void;
  separator?: string;
  ariaMin: string;
  ariaMax: string;
}) {
  const cls = `w-1/2 border rounded-xl px-3 py-2.5 text-sm outline-none font-medium transition-colors ${
    t.input
  } ${error ? t.inputError : ""}`;
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={ariaMin}
          aria-invalid={Boolean(error)}
          placeholder="Min"
          value={minValue}
          onChange={(e) => onMin(e.target.value)}
          onKeyDown={onKeyDown}
          className={cls}
        />
        <span className={`font-medium shrink-0 ${t.sep}`}>{separator}</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={ariaMax}
          aria-invalid={Boolean(error)}
          placeholder="Max"
          value={maxValue}
          onChange={(e) => onMax(e.target.value)}
          onKeyDown={onKeyDown}
          className={cls}
        />
      </div>
      {error && (
        <p className={`text-[11px] mt-1.5 flex items-center gap-1 ${t.error}`}>
          <Icon icon="solar:danger-triangle-bold-duotone" className="shrink-0 text-sm" />
          {error}
        </p>
      )}
    </>
  );
}

export interface TabFilterFieldsProps {
  tab: TxTab;
  theme?: Theme;
  state: SearchFormState;
  errors: RangeErrors;
  openDropdown: string | null;
  setOpenDropdown: (next: string | null) => void;
  onRangeChange: (field: RangeField, rawValue: string) => void;
  onDurasiChange: (value: string) => void;
  /** Enter di dalam panel = langsung cari. */
  onSubmit?: () => void;
}

export default function TabFilterFields({
  tab,
  theme = "dark",
  state,
  errors,
  openDropdown,
  setOpenDropdown,
  onRangeChange,
  onDurasiChange,
  onSubmit,
}: TabFilterFieldsProps) {
  const t = THEMES[theme];
  const rent = isRentTab(tab);
  const toggle = (key: string) => setOpenDropdown(openDropdown === key ? null : key);
  const close = () => setOpenDropdown(null);

  const unit = durasiUnitFor(state.durasi);

  return (
    <>
      {/* === KOLOM D: Durasi Sewa (sewa) / Harga (lainnya) === */}
      <Slot width="lg:w-[16%]">
        {rent ? (
          <>
            <motion.div key="slot-durasi" {...SWAP_MOTION}>
              <Trigger
                t={t}
                label="Durasi Sewa"
                icon="solar:calendar-date-bold-duotone"
                value={durasiLabelFor(state.durasi)}
                open={openDropdown === "durasi"}
                onToggle={() => toggle("durasi")}
                panelId="search-panel-durasi"
              />
            </motion.div>

            {openDropdown === "durasi" && (
              <Panel t={t} id="search-panel-durasi" onClose={close}>
                <h4 className={`font-bold mb-1 text-sm ${t.panelTitle}`}>Durasi Sewa</h4>
                <p className={`text-[11px] mb-3 ${t.hint}`}>
                  Menampilkan unit yang menawarkan durasi tersebut.
                </p>
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      onDurasiChange("");
                      close();
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors ${
                      state.durasi === "" ? "bg-primary/10 text-primary" : t.optionIdle
                    }`}
                  >
                    <Icon icon="solar:widget-3-bold-duotone" className="text-lg opacity-70 shrink-0" />
                    <span className="flex-1">Semua Durasi</span>
                    {state.durasi === "" && (
                      <Icon icon="solar:check-circle-bold" className="text-primary text-lg" />
                    )}
                  </button>
                  {DURASI_OPTIONS.map((d) => {
                    const active = state.durasi === d.value;
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => {
                          onDurasiChange(d.value);
                          close();
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors ${
                          active ? "bg-primary/10 text-primary" : t.optionIdle
                        }`}
                      >
                        <Icon icon={d.icon} className="text-lg opacity-70 shrink-0" />
                        <span className="flex-1">{d.label}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                          {durasiUnitFor(d.value).replace("per ", "/")}
                        </span>
                        {active && (
                          <Icon icon="solar:check-circle-bold" className="text-primary text-lg" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </Panel>
            )}
          </>
        ) : (
          <>
            <motion.div key="slot-harga" {...SWAP_MOTION}>
              <Trigger
                t={t}
                label="Harga"
                icon="solar:wallet-money-bold-duotone"
                value={rangeLabel(state.minPrice, state.maxPrice, "Range Harga")}
                open={openDropdown === "price"}
                onToggle={() => toggle("price")}
                panelId="search-panel-price"
              />
            </motion.div>

            {openDropdown === "price" && (
              <Panel t={t} id="search-panel-price" onClose={close}>
                <h4 className={`font-bold mb-3 text-sm ${t.panelTitle}`}>Range Budget (Rp)</h4>
                <MinMaxInputs
                  t={t}
                  minValue={state.minPrice}
                  maxValue={state.maxPrice}
                  onMin={(v) => onRangeChange("minPrice", v)}
                  onMax={(v) => onRangeChange("maxPrice", v)}
                  error={errors.price}
                  onSubmit={onSubmit}
                  ariaMin="Harga minimum"
                  ariaMax="Harga maksimum"
                />
              </Panel>
            )}
          </>
        )}
      </Slot>

      {/* === KOLOM E: Harga Sewa (sewa) / Dimensi (lainnya) === */}
      <Slot width="lg:w-[17%]">
        {rent ? (
          <>
            <motion.div key="slot-harga-sewa" {...SWAP_MOTION}>
              <Trigger
                t={t}
                label="Harga Sewa"
                icon="solar:wallet-money-bold-duotone"
                value={rangeLabel(
                  state.minRent,
                  state.maxRent,
                  "Range Harga",
                  unit ? ` ${unit}` : ""
                )}
                open={openDropdown === "rent"}
                onToggle={() => toggle("rent")}
                panelId="search-panel-rent"
              />
            </motion.div>

            {openDropdown === "rent" && (
              <Panel t={t} id="search-panel-rent" alignRight onClose={close}>
                <h4 className={`font-bold mb-1 text-sm ${t.panelTitle}`}>Range Harga Sewa (Rp)</h4>
                <p className={`text-[11px] mb-3 ${t.hint}`}>
                  {state.durasi
                    ? `Dihitung ${unit} sesuai durasi yang dipilih.`
                    : "Pilih durasi dulu agar harga dibandingkan pada satuan yang sama."}
                </p>
                <MinMaxInputs
                  t={t}
                  minValue={state.minRent}
                  maxValue={state.maxRent}
                  onMin={(v) => onRangeChange("minRent", v)}
                  onMax={(v) => onRangeChange("maxRent", v)}
                  error={errors.rent}
                  onSubmit={onSubmit}
                  ariaMin="Harga sewa minimum"
                  ariaMax="Harga sewa maksimum"
                />
              </Panel>
            )}
          </>
        ) : (
          <>
            <motion.div key="slot-dimensi" {...SWAP_MOTION}>
              <Trigger
                t={t}
                label="Dimensi"
                icon="solar:ruler-angular-bold-duotone"
                value={dimensionSummary(state)}
                open={openDropdown === "dimensions"}
                onToggle={() => toggle("dimensions")}
                panelId="search-panel-dimensions"
              />
            </motion.div>

            {openDropdown === "dimensions" && (
              <Panel t={t} id="search-panel-dimensions" alignRight onClose={close}>
                <div className="mb-4">
                  <h4
                    className={`font-bold mb-2 text-sm flex items-center gap-2 ${t.panelTitle}`}
                  >
                    <Icon icon="solar:map-bold" className={t.sep} /> Luas Tanah (m²)
                  </h4>
                  <MinMaxInputs
                    t={t}
                    minValue={state.minLt}
                    maxValue={state.maxLt}
                    onMin={(v) => onRangeChange("minLt", v)}
                    onMax={(v) => onRangeChange("maxLt", v)}
                    error={errors.lt}
                    onSubmit={onSubmit}
                    separator="-"
                    ariaMin="Luas tanah minimum"
                    ariaMax="Luas tanah maksimum"
                  />
                </div>
                <div>
                  <h4
                    className={`font-bold mb-2 text-sm flex items-center gap-2 ${t.panelTitle}`}
                  >
                    <Icon icon="solar:home-bold" className={t.sep} /> Luas Bangunan (m²)
                  </h4>
                  <MinMaxInputs
                    t={t}
                    minValue={state.minLb}
                    maxValue={state.maxLb}
                    onMin={(v) => onRangeChange("minLb", v)}
                    onMax={(v) => onRangeChange("maxLb", v)}
                    error={errors.lb}
                    onSubmit={onSubmit}
                    separator="-"
                    ariaMin="Luas bangunan minimum"
                    ariaMax="Luas bangunan maksimum"
                  />
                </div>
                {tab === "lelang" && (
                  <p
                    className={`text-[10px] p-2 rounded-lg mt-3 font-medium border ${t.note}`}
                  >
                    <Icon icon="solar:info-circle-bold" className="inline mr-1 text-sm" />
                    Aset lelang umumnya dinilai dari luas tanah (land value).
                  </p>
                )}
              </Panel>
            )}
          </>
        )}
      </Slot>
    </>
  );
}

"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import LocationPicker from "@/components/search/LocationPicker";
import TypePicker from "@/components/search/TypePicker";
import TransactionTabs from "@/components/search/TransactionTabs";
import KeywordField from "@/components/search/KeywordField";
import TabFilterFields from "@/components/search/TabFilterFields";
import KosGenderChips from "@/components/search/KosGenderChips";
import SearchSubmitButton from "@/components/search/SearchSubmitButton";
import MobileSearchDock from "@/components/search/MobileSearchDock";
import { useSearchForm } from "@/components/search/useSearchForm";
import { parseLocationParams, locationsToSelectedRegions } from "@/lib/regionSearch";
import {
  PROPERTY_ICONS,
  keywordLabelFor,
  typeLabelFor,
  typeOptionsFor,
  type SearchFormState,
  type SearchInitial,
} from "@/lib/searchTabs";

export type SewaSearchHeroInitial = SearchInitial;

/**
 * Chip pintasan di bawah judul: satu klik = set filter + langsung cari.
 * `patch` sengaja hanya berisi field yang relevan supaya sisa form (lokasi,
 * keyword, range harga) tetap utuh saat chip ditekan.
 */
type QuickFilter = {
  label: string;
  icon: string;
  patch: Partial<Pick<SearchFormState, "types" | "durasi" | "gender">>;
};

const QUICK_FILTERS: QuickFilter[] = [
  { label: "Kos Putri", icon: "solar:women-bold", patch: { types: ["Kos"], gender: "PUTRI" } },
  { label: "Kos Putra", icon: "solar:men-bold", patch: { types: ["Kos"], gender: "PUTRA" } },
  { label: "Apartemen", icon: "solar:buildings-2-bold-duotone", patch: { types: ["Apartemen"], gender: "" } },
  { label: "Rumah", icon: "solar:home-2-bold-duotone", patch: { types: ["Rumah"], gender: "" } },
  { label: "Sewa Bulanan", icon: "solar:calendar-date-bold-duotone", patch: { durasi: "BULANAN" } },
];

/**
 * Partikel debu cahaya di latar hero. Nilainya di-hardcode (bukan Math.random)
 * supaya markup server & client identik — random akan memicu hydration mismatch.
 * Semua mulai dari paruh bawah lalu naik ±140px sesuai keyframe.
 */
const HERO_PARTICLES: {
  left: string;
  top: string;
  size: string;
  duration: string;
  delay: string;
}[] = [
  { left: "12%", top: "72%", size: "3px", duration: "11s", delay: "0s" },
  { left: "26%", top: "88%", size: "2px", duration: "14s", delay: "2.4s" },
  { left: "41%", top: "66%", size: "2px", duration: "12.5s", delay: "5.1s" },
  { left: "58%", top: "84%", size: "3px", duration: "10.5s", delay: "1.2s" },
  { left: "73%", top: "70%", size: "2px", duration: "13.5s", delay: "3.8s" },
  { left: "88%", top: "90%", size: "3px", duration: "12s", delay: "6.3s" },
];

const SewaSearchHero = ({
  initial = {},
  totalAktif,
}: {
  initial?: SewaSearchHeroInitial;
  /** Jumlah listing sewa berstatus TERSEDIA (tanpa filter) — untuk badge hero. */
  totalAktif?: number;
}) => {
  const searchParams = useSearchParams();

  const hydratedLocations = useMemo(
    () => locationsToSelectedRegions(parseLocationParams((k) => searchParams.get(k))),
    [searchParams]
  );

  const {
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
    showGenderRow,
    wrapperRef,
    handleRangeChange,
    handleSearch,
    runSearch,
    pilihTempat,
    kotaKonteks,
  } = useSearchForm({
    initialTab: "sewa",
    initial,
    hydratedLocations,
    navKey: searchParams.toString(),
  });

  /** Chip dianggap aktif kalau SEMUA field di `patch` sudah sama dengan form. */
  const isQuickActive = (qf: QuickFilter) => {
    if (activeTab !== "sewa") return false;
    const { types, durasi, gender } = qf.patch;
    if (types) {
      if (types.length !== formData.types.length) return false;
      if (!types.every((t) => formData.types.includes(t))) return false;
    }
    if (durasi !== undefined && durasi !== formData.durasi) return false;
    if (gender !== undefined && gender !== formData.gender) return false;
    return true;
  };

  /**
   * Klik chip: terapkan patch lalu cari. Klik chip aktif = lepas filternya.
   * Chip selalu berarti "sewa", jadi pill ikut dikembalikan ke Sewa kalau user
   * sempat berpindah tab.
   */
  const applyQuickFilter = (qf: QuickFilter) => {
    const off = isQuickActive(qf);
    const patchValue: Partial<SearchFormState> = off
      ? {
          ...(qf.patch.types !== undefined && { types: [] }),
          ...(qf.patch.durasi !== undefined && { durasi: "" }),
          ...(qf.patch.gender !== undefined && { gender: "" }),
        }
      : qf.patch;

    const allowed = typeOptionsFor("sewa");
    const next: SearchFormState = { ...formData, ...patchValue };
    next.types = next.types.filter((t) => allowed.includes(t));

    setFormData(next);
    setActiveTab("sewa");
    runSearch(next, "sewa");
  };

  const totalAktifLabel =
    typeof totalAktif === "number" && totalAktif > 0
      ? new Intl.NumberFormat("id-ID").format(totalAktif)
      : null;

  return (
    <>
      {/* === BAGIAN 1: HERO — aurora mesh + kaca gelap ===
          Lapisan latar sengaja jadi sibling ber-`z-0` semua (bukan z negatif)
          supaya urutan gambarnya murni ikut urutan DOM dan tidak bocor keluar
          stacking context milik section. */}
      {/* `bg-[#050B09]` menimpa `section { @apply bg-darkmode }` di globals.css —
          darkmode (#000510) kebiruan dan bentrok dengan aurora hijau-teal. */}
      {/* min-h sengaja DI BAWAH tinggi natural konten. Kalau min-h lebih besar,
          `items-center` menyisakan ruang kosong yang dibagi rata atas-bawah —
          dan jarak ke navbar ikut melar tanpa kelihatan dari nilai padding. */}
      <section className="relative isolate overflow-hidden flex items-center justify-center min-h-[440px] md:min-h-[500px] bg-[#050B09]">
        {/* Foto banner — HANYA sebagai tekstur, bukan gambar yang dibaca.
            Diblur kuat + diturunkan opacity supaya yang tersisa cuma variasi
            gelap-terang, tidak bertabrakan dengan judul. */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <Image
            src="/images/hero/banner2.jpg"
            alt=""
            aria-hidden="true"
            fill
            sizes="100vw"
            className="object-cover scale-125 blur-[10px] opacity-[0.13] saturate-[0.4]"
            priority
          />
          <div className="absolute inset-0 bg-[#040E0A]/80" />
        </div>

        {/* Aurora mesh — tiga blob MENGAPIT teks, tidak ada yang duduk di
            tengah, supaya teks putih tidak kehilangan kontras. */}
        <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
          <div className="sewa-hero-blob-a absolute -top-[28%] md:-top-[45%] -left-[24%] md:-left-[6%] h-[26rem] w-[26rem] md:h-[36rem] md:w-[36rem] rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.55),transparent_66%)] blur-[90px] md:blur-[110px]" />
          <div className="sewa-hero-blob-b absolute -bottom-[30%] md:-bottom-[52%] -right-[22%] md:-right-[6%] h-[24rem] w-[24rem] md:h-[34rem] md:w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(20,184,166,0.5),transparent_66%)] blur-[95px] md:blur-[120px]" />
          <div className="sewa-hero-blob-c absolute -top-[18%] right-[4%] md:right-[14%] h-[16rem] w-[16rem] md:h-[24rem] md:w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(163,230,53,0.22),transparent_70%)] blur-[80px] md:blur-[100px]" />
        </div>

        {/* Sorot cahaya berbentuk kerucut dari atas — sumbu simetri komposisi */}
        <div
          className="absolute left-1/2 top-0 z-0 h-[70%] w-[130%] max-w-[1100px] -translate-x-1/2 pointer-events-none bg-[conic-gradient(from_180deg_at_50%_0%,transparent_0deg,rgba(153,227,158,0.13)_78deg,rgba(94,234,212,0.16)_90deg,rgba(153,227,158,0.13)_102deg,transparent_180deg)] blur-[42px]"
          aria-hidden="true"
        />

        {/* Panggung gelap di tengah — dipasang SETELAH aurora supaya cahaya
            hanya membingkai, tidak menerangi area teks. */}
        <div
          className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_58%_52%_at_50%_44%,rgba(2,10,7,0.88),rgba(2,10,7,0.45)_55%,transparent_78%)]"
          aria-hidden="true"
        />

        {/* Grid teknis (paruh atas) + garis pindai */}
        <div className="sewa-hero-grid absolute inset-0 z-0" aria-hidden="true" />
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="sewa-hero-scan absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-transparent via-emerald-300/[0.07] to-transparent" />
        </div>

        {/* Lantai grid perspektif + garis horizon — memberi hero kedalaman
            dan jadi "alas" tempat kartu pencarian mengambang. */}
        <div className="absolute inset-x-0 bottom-0 z-0 h-[46%] overflow-hidden pointer-events-none" aria-hidden="true">
          {/* h-[200%]: rotateX(64°) memampatkan tinggi bidang ±0.44×, jadi
              elemennya dibuat dua kali tinggi kotak supaya hasil proyeksinya
              tetap mengisi penuh sampai garis horizon. */}
          <div className="sewa-hero-floor absolute -inset-x-1/2 bottom-0 h-[200%] opacity-60" />
          <div className="sewa-hero-horizon absolute inset-x-[12%] top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent" />
          <div className="sewa-hero-horizon absolute inset-x-[22%] -top-7 h-14 bg-[radial-gradient(ellipse_at_center,rgba(52,211,153,0.3),transparent_70%)] blur-xl" />
        </div>

        {/* Partikel debu cahaya */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
          {HERO_PARTICLES.map((p, i) => (
            <span
              key={i}
              className="sewa-hero-particle absolute rounded-full bg-emerald-200/70 shadow-[0_0_8px_2px_rgba(153,227,158,0.5)]"
              style={{
                left: p.left,
                top: p.top,
                width: p.size,
                height: p.size,
                animationDuration: p.duration,
                animationDelay: p.delay,
              }}
            />
          ))}
        </div>

        {/* Bingkai sudut ala HUD */}
        <div className="absolute inset-4 md:inset-8 z-0 pointer-events-none hidden sm:block" aria-hidden="true">
          <span className="absolute left-0 top-0 h-8 w-8 border-l border-t border-emerald-300/25 rounded-tl-lg" />
          <span className="absolute right-0 top-0 h-8 w-8 border-r border-t border-emerald-300/25 rounded-tr-lg" />
          <span className="absolute left-0 bottom-0 h-8 w-8 border-l border-b border-emerald-300/20 rounded-bl-lg" />
          <span className="absolute right-0 bottom-0 h-8 w-8 border-r border-b border-emerald-300/20 rounded-br-lg" />
        </div>

        {/* Vignette tepi + grain + peleburan ke warna body (#0F0F0F). */}
        <div
          className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_35%,transparent_45%,rgba(3,8,7,0.5)_100%)]"
          aria-hidden="true"
        />
        <div className="sewa-hero-noise absolute inset-0 z-0 pointer-events-none" aria-hidden="true" />
        {/* Sengaja pendek (h-32): fade yang terlalu tinggi menelan bagian
            lantai grid yang justru paling terbaca. */}
        <div
          className="absolute inset-x-0 bottom-0 z-0 h-32 pointer-events-none bg-gradient-to-t from-[#0F0F0F] via-[#0F0F0F]/55 to-transparent"
          aria-hidden="true"
        />

        {/* --- Konten --- */}
        <div className="relative z-10 w-full px-4 pt-20 md:pt-28 pb-32 md:pb-36 text-center">
          {/* Badge kaca + jumlah unit aktif (data nyata dari server) */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="inline-flex items-center gap-2.5 rounded-full border border-emerald-400/25 bg-emerald-400/[0.07] px-3.5 py-1.5 backdrop-blur-md shadow-[0_0_36px_-12px_rgba(52,211,153,0.75)]"
          >
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            {/* Label penuh + hitungan unit = ±290px di layar 320px. Di bawah
                `sm` dipakai versi pendek supaya pill tetap satu baris. */}
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.18em] sm:tracking-[0.2em] text-emerald-300 whitespace-nowrap">
              <span className="sm:hidden">Sewa Kos &amp; Hunian</span>
              <span className="hidden sm:inline">Sewa Kos, Apartemen &amp; Rumah</span>
            </span>
            {totalAktifLabel && (
              <>
                <span className="h-3 w-px bg-emerald-400/25" aria-hidden="true" />
                <span className="text-[9px] sm:text-[10px] font-bold tracking-wide text-emerald-100/75 whitespace-nowrap">
                  {totalAktifLabel} unit aktif
                </span>
              </>
            )}
          </motion.div>

          {/* Judul — baris kedua pakai gradient text bergerak (kinetic type). */}
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.06, ease: "easeOut" }}
            className="relative mt-5 text-white font-black tracking-[-0.035em] leading-[1.05] text-[1.95rem] sm:text-[2.6rem] md:text-[3.15rem] lg:text-[3.65rem] drop-shadow-[0_12px_36px_rgba(0,0,0,0.75)]"
          >
            Cari Hunian Sewa
            <br />
            <span className="sewa-hero-gradient-text">Sesuai Kebutuhanmu</span>
          </motion.h1>

          {/* text-gray-400 dulu dipakai di sini dan terbaca kusam kebiruan di
              atas latar hijau — abu netral selalu bentrok dengan background
              berwarna. Putih transparan mengambil rona latarnya sendiri. */}
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.14, ease: "easeOut" }}
            className="mx-auto mt-4 max-w-[34rem] text-[13px] sm:text-sm md:text-[15px] leading-relaxed text-white/70"
          >
            Kos, apartemen, sampai rumah siap huni — harga transparan, lokasi
            terverifikasi, dan agen yang siap dampingi dari survei sampai akad.
          </motion.p>

          {/* Chip pintasan — sekali klik langsung set filter & mencari */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.22, ease: "easeOut" }}
            /* Membungkus di SEMUA ukuran, rata tengah. Strip geser di mobile
               membuat dua chip terakhir tak pernah ditemukan. */
            className="mt-6 flex flex-wrap items-center justify-center gap-2"
          >
            {QUICK_FILTERS.map((qf) => {
              const active = isQuickActive(qf);
              return (
                <button
                  key={qf.label}
                  type="button"
                  onClick={() => applyQuickFilter(qf)}
                  disabled={searching}
                  aria-pressed={active}
                  /* Kontras dinaikkan: border/10 + bg/[0.04] praktis tidak
                     terlihat di atas latar gelap — chip-nya terbaca sebagai
                     teks melayang, bukan tombol yang bisa diklik. */
                  className={`group inline-flex shrink-0 items-center gap-1.5 sm:gap-2 rounded-full border px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-bold backdrop-blur-md transition-all duration-200 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
                    active
                      ? "border-primary/70 bg-primary/20 text-primary shadow-[0_0_26px_-8px_rgba(153,227,158,0.9)]"
                      : "border-white/20 bg-white/[0.08] text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-primary/50 hover:bg-primary/15 hover:text-white"
                  }`}
                >
                  <Icon
                    icon={qf.icon}
                    className={`text-sm sm:text-base shrink-0 transition-colors ${
                      active ? "text-primary" : "text-emerald-300/80 group-hover:text-primary"
                    }`}
                  />
                  {qf.label}
                </button>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* === BAGIAN 2: FILTER FORM === */}
      <div className="container mx-auto px-4 relative z-30 -mt-24 mb-10 zoom-safe" ref={wrapperRef}>
        <TransactionTabs active={activeTab} onChange={setActiveTab} />

        <div className="relative">
          {/* Halo di balik kartu supaya terlihat "mengambang" di atas aurora */}
          <div
            className="pointer-events-none absolute -inset-x-8 -inset-y-6 rounded-[3rem] bg-[radial-gradient(ellipse_at_center,rgba(52,211,153,0.18),transparent_70%)] blur-2xl"
            aria-hidden="true"
          />

          {/* === MOBILE: command bar ringkas (detail filter pindah ke sheet) === */}
          <MobileSearchDock
            className="relative lg:hidden"
            tab={activeTab}
            onTabChange={setActiveTab}
            state={formData}
            patch={patch}
            patchRange={patchRange}
            resetForm={resetForm}
            errors={rangeErrors}
            onRangeChange={handleRangeChange}
            searching={searching}
            onSubmit={handleSearch}
            onPilihTempat={pilihTempat}
            kotaKonteks={kotaKonteks}
          />

          {/* === DESKTOP: search bar satu baris === */}
          <div className="sewa-hero-ring relative hidden lg:block bg-[#101614]/85 rounded-[2rem] shadow-[0_32px_90px_-24px_rgba(0,0,0,0.9)] p-2 lg:p-3 border border-white/10 backdrop-blur-2xl">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center divide-y lg:divide-y-0 lg:divide-x divide-white/10">

              {/* === A. KEYWORD / ID PROPERTI === */}
              <KeywordField
                id="sewa-search-keyword"
                theme="dark"
                label={keywordLabelFor(activeTab)}
                value={formData.keyword}
                onChange={(keyword) => patch({ keyword })}
                onSubmit={handleSearch}
                onFocusField={() => setOpenDropdown(null)}
                dekat={formData.dekat}
                onPilihTempat={pilihTempat}
                kota={kotaKonteks}
            tx={activeTab === "beli" || activeTab === "sewa" || activeTab === "lelang" ? activeTab : "semua"}
              />

              {/* === B. LOKASI === */}
              <div className="w-full lg:w-[20%] px-3 lg:px-4 py-4 lg:py-2.5 relative min-w-0">
                <LocationPicker
                  theme="dark"
                  value={formData.locations}
                  onChange={(locations) => patch({ locations })}
                  open={openDropdown === "location"}
                  onOpenChange={(o) => setOpenDropdown(o ? "location" : null)}
                />
              </div>

              {/* === C. TIPE HUNIAN === */}
              <div className="w-full lg:w-[13%] px-3 lg:px-4 py-4 lg:py-2.5 relative min-w-0">
                <TypePicker
                  theme="dark"
                  label={typeLabelFor(activeTab)}
                  value={formData.types}
                  onChange={(types) => patch({ types })}
                  options={typeOptionsFor(activeTab)}
                  icons={PROPERTY_ICONS}
                  open={openDropdown === "type"}
                  onOpenChange={(o) => setOpenDropdown(o ? "type" : null)}
                />
              </div>

              {/* === D & E. KRITERIA YANG MENGIKUTI TAB === */}
              <TabFilterFields
                tab={activeTab}
                theme="dark"
                state={formData}
                errors={rangeErrors}
                openDropdown={openDropdown}
                setOpenDropdown={setOpenDropdown}
                onRangeChange={handleRangeChange}
                onDurasiChange={(durasi) => patch({ durasi })}
                onSubmit={handleSearch}
              />

              {/* === F. TOMBOL CARI === */}
              <SearchSubmitButton
                searching={searching}
                shaking={shaking}
                onClick={handleSearch}
              />
            </div>

            {/* === GENDER KOS (hanya saat Sewa + tipe Kos) === */}
            <KosGenderChips
              theme="dark"
              show={showGenderRow}
              value={formData.gender}
              onChange={(gender) => patch({ gender })}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default SewaSearchHero;

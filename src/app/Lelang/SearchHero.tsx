"use client";

import React, { useMemo } from "react";
import { useSearchParams } from "next/navigation";
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
  type SearchInitial,
} from "@/lib/searchTabs";

export type SearchHeroInitial = SearchInitial;

const SearchHero = ({ initial = {} }: { initial?: SearchHeroInitial }) => {
  const searchParams = useSearchParams();

  const hydratedLocations = useMemo(
    () => locationsToSelectedRegions(parseLocationParams((k) => searchParams.get(k))),
    [searchParams]
  );

  const {
    formData,
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
    pilihTempat,
    kotaKonteks,
  } = useSearchForm({
    initialTab: "lelang",
    initial,
    hydratedLocations,
    navKey: searchParams.toString(),
  });

  return (
    <>
      {/* === BAGIAN 1: HERO LELANG === */}
      <section className="relative min-h-[450px] flex items-center justify-center overflow-hidden bg-gradient-to-br from-darkmode via-[#1A1A1A] to-darkmode">
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(rgba(134,239,172,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(134,239,172,0.1) 1px,transparent 1px)`,
              backgroundSize: "50px 50px",
            }}
          />
        </div>
        <div className="absolute top-20 left-20 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "700ms" }}
        />

        <div className="relative z-10 max-w-5xl mx-auto px-4 pt-16 pb-32 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/50 backdrop-blur-xl border border-emerald-500/30 mb-5">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-emerald-400 font-black tracking-[0.28em] text-[10px] uppercase">
              Peluang Investasi Terbaik
            </span>
          </div>

          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight mb-4"
            style={{ textShadow: "0 0 60px rgba(134,239,172,0.2)" }}
          >
            Temukan{" "}
            <span className="text-emerald-400 drop-shadow-[0_0_20px_rgba(134,239,172,0.4)]">
              Properti Lelang Terbaik
            </span>
          </h1>

          <p className="text-slate-300 text-base md:text-lg max-w-2xl mx-auto leading-relaxed mb-6">
            Dapatkan rumah, tanah, dan aset komersial dengan{" "}
            <span className="text-emerald-400 font-bold">harga di bawah pasaran</span>. Proses
            transparan, legal, dan didampingi tim profesional.
          </p>

          <div className="flex flex-wrap justify-center gap-3 text-xs md:text-sm">
            {[
              { icon: "solar:shield-check-bold-duotone", label: "Legal & Aman" },
              { icon: "solar:medal-star-bold-duotone", label: "Diskon 20–40%" },
              { icon: "solar:ranking-bold-duotone", label: "Bank Terpercaya" },
            ].map(({ icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-slate-200 hover:border-emerald-500/50 transition-colors"
              >
                <Icon icon={icon} className="text-emerald-400 text-lg" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-darkmode to-transparent pointer-events-none" />
      </section>

      {/* === BAGIAN 2: FILTER FORM (identik Jual) === */}
      <div className="container mx-auto px-4 relative z-30 -mt-24 mb-10 zoom-safe" ref={wrapperRef}>
        <TransactionTabs active={activeTab} onChange={setActiveTab} />

        {/* === MOBILE: command bar ringkas (detail filter pindah ke sheet) === */}
        <MobileSearchDock
          className="lg:hidden"
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
        <div className="hidden lg:block bg-[#1A1A1A] rounded-[2rem] shadow-2xl shadow-black/50 p-2 lg:p-3 border border-white/10 backdrop-blur-md">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center divide-y lg:divide-y-0 lg:divide-x divide-white/10">

            {/* === A. KEYWORD / ID PROPERTI === */}
            <KeywordField
              id="lelang-search-keyword"
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

            {/* === C. TIPE ASET === */}
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
    </>
  );
};

export default SearchHero;

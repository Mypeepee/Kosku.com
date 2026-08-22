"use client";

import React, { useMemo } from "react";
import Image from "next/image";
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
  type TxTab,
} from "@/lib/searchTabs";

export type SearchHeroInitial = SearchInitial;

const SearchHero = ({
  initial = {},
  initialTab = "beli",
}: {
  initial?: SearchHeroInitial;
  initialTab?: TxTab;
}) => {
  const searchParams = useSearchParams();

  // Wilayah terpilih dihidrasi dari URL (multi-level: provinsi/kota/kecamatan/kelurahan).
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
    initialTab,
    initial,
    hydratedLocations,
    navKey: searchParams.toString(),
  });

  return (
    <>
      {/* === BAGIAN 1: BANNER BACKGROUND === */}
      <section className="relative h-[400px] flex items-center justify-center">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/hero/banner2.jpg"
            alt="Search Banner"
            fill
            className="object-cover opacity-60"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-darkmode via-darkmode/50 to-transparent"></div>
        </div>
        <div className="relative z-10 text-center px-4 mb-20">
          <span className="inline-flex items-center gap-2 text-emerald-400 font-black tracking-[0.20em] text-[10px] uppercase">
            <Icon
              icon="solar:home-smile-bold-duotone"
              className="text-base md:text-lg text-emerald-400"
            />
            <span>Hunian Baru Berkualitas</span>
          </span>
          <h1 className="text-white font-bold text-3xl md:text-5xl leading-relaxed drop-shadow-2xl">
            Temukan Properti Impian <br />
            Primary &amp; Secondary
          </h1>
        </div>
      </section>

      {/* === BAGIAN 2: FILTER FORM === */}
      <div
        /* z-index NAIK selagi ada dropdown terbuka.
           Panel "Harga"/"Dimensi"/"Durasi" (TabFilterFields) dirender ABSOLUT
           di dalam pembungkus ini, bukan lewat portal seperti LocationPicker.
           Artinya `z-50` miliknya hanya berlaku DI DALAM stacking context yang
           dibuat pembungkus ber-z-index ini — dan pembungkusnya (z-30) kalah
           dari FilterCommandBar yang lengket (z-40), jadi panelnya tertutup bar
           filter begitu terbuka. Menaikkan pembungkusnya hanya saat dropdown
           terbuka memperbaiki itu tanpa membuat kartu hero melintas di atas bar
           lengket saat halaman di-scroll. */
        className={`container mx-auto px-4 relative ${
          openDropdown ? "z-50" : "z-30"
        } -mt-24 mb-10 zoom-safe`}
        ref={wrapperRef}
      >
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
              id="jual-search-keyword"
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

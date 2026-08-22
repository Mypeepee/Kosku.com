"use client";

/**
 * Search bar utama di Home. Kriteria dua kolom terakhir mengikuti pill
 * transaksi: Sewa → Durasi Sewa + Harga Sewa, sisanya → Harga + Dimensi.
 * Seluruh state & perakitan query ditangani `useSearchForm` supaya perilakunya
 * identik dengan search bar di halaman Jual, Lelang, dan Sewa.
 */

import LocationPicker from "@/components/search/LocationPicker";
import TypePicker from "@/components/search/TypePicker";
import TransactionTabs from "@/components/search/TransactionTabs";
import KeywordField from "@/components/search/KeywordField";
import TabFilterFields from "@/components/search/TabFilterFields";
import KosGenderChips from "@/components/search/KosGenderChips";
import SearchSubmitButton from "@/components/search/SearchSubmitButton";
import MobileSearchDock from "@/components/search/MobileSearchDock";
import { useSearchForm } from "@/components/search/useSearchForm";
import {
  PROPERTY_ICONS,
  keywordLabelFor,
  typeLabelFor,
  typeOptionsFor,
} from "@/lib/searchTabs";

const CardSlider = () => {
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
  } = useSearchForm({ initialTab: "semua" });

  return (
    <div className="w-full max-w-6xl mx-auto font-sans relative z-30 zoom-safe" ref={wrapperRef}>
      <TransactionTabs active={activeTab} onChange={setActiveTab} className="mb-6" />

      {/* MOBILE: command bar ringkas — detail filter pindah ke bottom sheet */}
      <MobileSearchDock
        className="lg:hidden"
        theme="light"
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

      {/* MAIN SEARCH BAR (desktop) */}
      <div className="hidden lg:block bg-white rounded-[2rem] shadow-2xl shadow-black/40 p-2 lg:p-3 border border-white/10 relative">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center divide-y lg:divide-y-0 lg:divide-x divide-gray-100">

          {/* === A. KEYWORD / ID PROPERTI === */}
          <KeywordField
            id="search-keyword"
            theme="light"
            label={keywordLabelFor(activeTab)}
            placeholder="Alamat / ID / tempat, ex: deket UNESA"
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
              theme="light"
              value={formData.locations}
              onChange={(locations) => patch({ locations })}
              open={openDropdown === "location"}
              onOpenChange={(o) => setOpenDropdown(o ? "location" : null)}
            />
          </div>

          {/* === C. TIPE PROPERTI === */}
          <div className="w-full lg:w-[13%] px-3 lg:px-4 py-4 lg:py-2.5 relative min-w-0">
            <TypePicker
              theme="light"
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
            theme="light"
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
            mobileLabel="Cari Sekarang"
          />
        </div>

        {/* === GENDER KOS (hanya saat Sewa + tipe Kos) === */}
        <KosGenderChips
          theme="light"
          show={showGenderRow}
          value={formData.gender}
          onChange={(gender) => patch({ gender })}
        />
      </div>
    </div>
  );
};

export default CardSlider;

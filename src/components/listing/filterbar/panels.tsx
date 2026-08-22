"use client";

import React from "react";
import LocationPicker from "@/components/search/LocationPicker";
import {
  locationsToSelectedRegions,
  parseLocationParams,
  serializeLocations,
  REGION_LEVELS,
  type SelectedRegion,
} from "@/lib/regionSearch";
import { TYPE_DISPLAY_TO_DB } from "@/lib/propertyType";
import { typeOptionsFor } from "@/lib/searchTabs";
import {
  OPSI_HADAP,
  OPSI_JADWAL,
  OPSI_KAMAR_MANDI_TIPE,
  OPSI_KONDISI,
  OPSI_LEGALITAS,
  OPSI_TIPE_UNIT,
  type BidangFilter,
  type KonteksFilter,
} from "@/lib/listingFilters";
import {
  ChipBanyak,
  ChipPilihan,
  LabelSeksi,
  MinimalN,
  PintasanRentang,
  RentangInput,
  Sakelar,
  type OpsiChip,
} from "./controls";

/**
 * Isi tiap panel filter, ditulis SEKALI dan dipakai bersama oleh popover
 * desktop dan laci/sheet layar kecil.
 *
 * Draft = kumpulan nilai param URL yang belum diterapkan. Sengaja berbentuk
 * `Record<string, string>` — persis bentuk URL — supaya tidak ada bentuk state
 * kedua yang harus disinkronkan dengan URL. Menerapkan filter berarti menuang
 * draft ke URLSearchParams, tidak lebih.
 */

export type Draft = Record<string, string>;

export interface DefPanel {
  bidang: BidangFilter;
  /** Label saat bidang masih kosong. */
  label: string;
  ikon: string;
  /**
   * `true` = pilihan tunggal, langsung diterapkan begitu diklik lalu panel
   * ditutup. `false` = ada isian/pilihan ganda, butuh tombol "Terapkan".
   *
   * Aturannya sengaja bisa ditebak dari bentuk panelnya: yang cukup satu
   * ketukan langsung jalan, yang perlu mengetik menunggu konfirmasi.
   */
  instan: boolean;
  lebar?: number;
}

export const DEF_PANEL: Record<BidangFilter, DefPanel> = {
  keyword: { bidang: "keyword", label: "Kata kunci", ikon: "solar:magnifer-linear", instan: false },
  lokasi: { bidang: "lokasi", label: "Lokasi", ikon: "solar:map-point-bold-duotone", instan: false, lebar: 300 },
  kategori: { bidang: "kategori", label: "Tipe aset", ikon: "solar:home-2-bold-duotone", instan: false, lebar: 320 },
  harga: { bidang: "harga", label: "Harga", ikon: "solar:wallet-money-bold-duotone", instan: false, lebar: 340 },
  luasTanah: { bidang: "luasTanah", label: "Luas tanah", ikon: "solar:map-bold-duotone", instan: false, lebar: 320 },
  luasBangunan: { bidang: "luasBangunan", label: "Luas bangunan", ikon: "solar:ruler-angular-bold-duotone", instan: false, lebar: 320 },
  kamar: { bidang: "kamar", label: "Kamar", ikon: "solar:bed-bold-duotone", instan: false, lebar: 320 },
  lantai: { bidang: "lantai", label: "Lantai", ikon: "solar:layers-bold-duotone", instan: true, lebar: 300 },
  kondisi: { bidang: "kondisi", label: "Kondisi", ikon: "solar:sofa-bold-duotone", instan: true, lebar: 280 },
  hadap: { bidang: "hadap", label: "Hadap", ikon: "solar:compass-bold-duotone", instan: true, lebar: 260 },
  legalitas: { bidang: "legalitas", label: "Legalitas", ikon: "solar:document-text-bold-duotone", instan: true, lebar: 280 },
  jadwal: { bidang: "jadwal", label: "Jadwal lelang", ikon: "solar:alarm-bold-duotone", instan: true, lebar: 300 },
  durasi: { bidang: "durasi", label: "Durasi sewa", ikon: "solar:calendar-date-bold-duotone", instan: true, lebar: 280 },
  gender: { bidang: "gender", label: "Gender kos", ikon: "solar:users-group-two-rounded-bold-duotone", instan: true, lebar: 280 },
  kamarMandiTipe: { bidang: "kamarMandiTipe", label: "Kamar mandi", ikon: "solar:bath-bold-duotone", instan: true, lebar: 280 },
  tipeUnit: { bidang: "tipeUnit", label: "Tipe unit", ikon: "solar:buildings-2-bold-duotone", instan: true, lebar: 300 },
  hotDeal: { bidang: "hotDeal", label: "Hot deal", ikon: "solar:fire-bold-duotone", instan: true, lebar: 300 },
};

/* ─────────────────────────── Pintasan harga ──────────────────────────── */

const jt = 1_000_000;
const M = 1_000_000_000;

/**
 * Pintasan budget dibedakan per konteks: sewa dibayar per bulan dalam satuan
 * juta, sedangkan jual & lelang dalam ratusan juta sampai miliaran. Satu daftar
 * untuk keduanya berarti separuh pintasannya selalu tidak berguna.
 */
function pintasanHarga(konteks: KonteksFilter) {
  if (konteks === "SEWA") {
    return [
      { label: "< Rp 1 jt", max: 1 * jt },
      { label: "Rp 1–3 jt", min: 1 * jt, max: 3 * jt },
      { label: "Rp 3–10 jt", min: 3 * jt, max: 10 * jt },
      { label: "> Rp 10 jt", min: 10 * jt },
    ];
  }
  return [
    { label: "< Rp 500 jt", max: 500 * jt },
    { label: "Rp 500 jt–1 M", min: 500 * jt, max: 1 * M },
    { label: "Rp 1–3 M", min: 1 * M, max: 3 * M },
    { label: "> Rp 3 M", min: 3 * M },
  ];
}

/* ────────────────────────── Opsi tipe aset ───────────────────────────── */

function opsiKategori(konteks: KonteksFilter): OpsiChip[] {
  // `typeOptionsFor` sudah tahu KOS hanya ada di sewa dan tanah/hotel tidak —
  // daftarnya dipakai apa adanya supaya bar ini tidak pernah menawarkan tipe
  // yang search bar hero anggap tidak ada.
  const tab = konteks === "SEWA" ? "sewa" : "semua";
  return typeOptionsFor(tab).map((display) => ({
    value: TYPE_DISPLAY_TO_DB[display] ?? display,
    label: display,
  }));
}

/* ──────────────────────────── Panel lokasi ───────────────────────────── */

/**
 * Dipisah jadi komponen sendiri karena butuh state buka/tutup milik
 * `LocationPicker`. Kalau state itu dititipkan ke draft, ia ikut tertulis ke
 * URL saat filter diterapkan — dan `?__lokasiOpen=1` yang nyangkut di tautan
 * yang dibagikan adalah persis jenis kebocoran yang membuat URL tidak bisa
 * dipercaya sebagai sumber kebenaran.
 */
function PanelLokasi({ draft, patch }: { draft: Draft; patch: (n: Draft) => void }) {
  const [buka, setBuka] = React.useState(false);

  const terpilih = locationsToSelectedRegions(
    parseLocationParams((k) => draft[k] ?? "")
  );

  const setLokasi = (next: SelectedRegion[]) => {
    const ser = serializeLocations(next);
    const patchLokasi: Draft = {};
    // Setiap level ditulis, termasuk yang kosong — supaya wilayah yang dilepas
    // benar-benar terhapus dari URL, bukan tertinggal karena `serializeLocations`
    // hanya mengembalikan level yang terisi.
    for (const level of REGION_LEVELS) patchLokasi[level] = ser[level] ?? "";
    patch(patchLokasi);
  };

  return (
    <div>
      <LabelSeksi ikon="solar:map-point-bold-duotone">Lokasi</LabelSeksi>
      {/* LocationPicker membawa dropdown-nya sendiri (di-portal ke body), jadi
          ia dipakai utuh — bukan ditiru — supaya pencarian wilayah, drill-down,
          dan cache /api/regions tetap satu implementasi. */}
      <div
        className="rounded-xl px-3 py-2.5"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <LocationPicker
          theme="dark"
          label=""
          value={terpilih}
          onChange={setLokasi}
          open={buka}
          onOpenChange={setBuka}
        />
      </div>
      <p className="mt-2 text-[11px] leading-snug" style={{ color: "rgba(255,255,255,0.3)" }}>
        Bisa memilih beberapa wilayah sekaligus, lintas provinsi.
      </p>
    </div>
  );
}

/* ──────────────────────────── Render panel ───────────────────────────── */

export function IsiPanel({
  bidang,
  konteks,
  draft,
  patch,
}: {
  bidang: BidangFilter;
  konteks: KonteksFilter;
  draft: Draft;
  /** Menulis satu atau beberapa param sekaligus. String kosong = hapus param. */
  patch: (next: Draft) => void;
}) {
  const v = (k: string) => draft[k] ?? "";

  switch (bidang) {
    case "lokasi":
      return <PanelLokasi draft={draft} patch={patch} />;

    case "kategori": {
      const nilai = v("kategori").split(",").filter(Boolean);
      return (
        <div>
          <LabelSeksi ikon="solar:home-2-bold-duotone">Tipe aset</LabelSeksi>
          <ChipBanyak
            label="Tipe aset"
            opsi={opsiKategori(konteks)}
            nilai={nilai}
            onChange={(next) => patch({ kategori: next.join(",") })}
          />
        </div>
      );
    }

    case "harga":
      return (
        <div>
          <LabelSeksi ikon="solar:wallet-money-bold-duotone">
            {konteks === "SEWA" ? "Harga sewa" : "Harga"}
          </LabelSeksi>
          <RentangInput
            label="Harga"
            awalan="Rp"
            min={v("minHarga")}
            max={v("maxHarga")}
            onMin={(x) => patch({ minHarga: x })}
            onMax={(x) => patch({ maxHarga: x })}
          />
          <PintasanRentang
            opsi={pintasanHarga(konteks)}
            min={v("minHarga")}
            max={v("maxHarga")}
            onPilih={(min, max) => patch({ minHarga: min, maxHarga: max })}
          />
          {konteks === "SEMUA" && (
            <p
              className="mt-3 text-[11px] leading-snug"
              style={{ color: "rgba(252,211,77,0.75)" }}
            >
              Tab ini mencampur jual, lelang, dan sewa. Harga sewa dibandingkan
              apa adanya terhadap harga jual — pilih tab Sewa untuk budget bulanan.
            </p>
          )}
          {konteks === "SEWA" && (
            <p className="mt-3 text-[11px] leading-snug" style={{ color: "rgba(255,255,255,0.3)" }}>
              Dibandingkan pada durasi utama tiap listing. Pilih durasi agar
              satuannya setara.
            </p>
          )}
        </div>
      );

    case "luasTanah":
      return (
        <div>
          <LabelSeksi ikon="solar:map-bold-duotone">Luas tanah</LabelSeksi>
          <RentangInput
            label="Luas tanah"
            satuan="m²"
            min={v("minLT")}
            max={v("maxLT")}
            onMin={(x) => patch({ minLT: x })}
            onMax={(x) => patch({ maxLT: x })}
          />
        </div>
      );

    case "luasBangunan":
      return (
        <div>
          <LabelSeksi ikon="solar:ruler-angular-bold-duotone">Luas bangunan</LabelSeksi>
          <RentangInput
            label="Luas bangunan"
            satuan="m²"
            min={v("minLB")}
            max={v("maxLB")}
            onMin={(x) => patch({ minLB: x })}
            onMax={(x) => patch({ maxLB: x })}
          />
        </div>
      );

    case "kamar":
      return (
        <div className="space-y-4">
          <div>
            <LabelSeksi ikon="solar:bed-bold-duotone">Kamar tidur</LabelSeksi>
            <MinimalN
              label="Kamar tidur"
              pilihan={[1, 2, 3, 4, 5]}
              nilai={v("minKT")}
              onChange={(x) => patch({ minKT: x })}
            />
          </div>
          <div>
            <LabelSeksi ikon="solar:bath-bold-duotone">Kamar mandi</LabelSeksi>
            <MinimalN
              label="Kamar mandi"
              pilihan={[1, 2, 3, 4]}
              nilai={v("minKM")}
              onChange={(x) => patch({ minKM: x })}
            />
          </div>
        </div>
      );

    case "lantai":
      return (
        <div>
          <LabelSeksi ikon="solar:layers-bold-duotone">Jumlah lantai</LabelSeksi>
          <MinimalN
            label="Lantai"
            pilihan={[1, 2, 3, 4]}
            nilai={v("lantai")}
            onChange={(x) => patch({ lantai: x })}
          />
        </div>
      );

    case "kondisi":
      return (
        <div>
          <LabelSeksi ikon="solar:sofa-bold-duotone">Kondisi interior</LabelSeksi>
          <ChipPilihan
            label="Kondisi interior"
            kolom={1}
            opsi={OPSI_KONDISI.map((k) => ({ value: k, label: k }))}
            nilai={v("kondisi")}
            onChange={(x) => patch({ kondisi: x })}
          />
        </div>
      );

    case "hadap":
      return (
        <div>
          <LabelSeksi ikon="solar:compass-bold-duotone">Hadap bangunan</LabelSeksi>
          <ChipPilihan
            label="Hadap bangunan"
            opsi={OPSI_HADAP.map((h) => ({ value: h, label: h }))}
            nilai={v("hadap")}
            onChange={(x) => patch({ hadap: x })}
          />
        </div>
      );

    case "legalitas":
      return (
        <div>
          <LabelSeksi ikon="solar:document-text-bold-duotone">Legalitas</LabelSeksi>
          <ChipPilihan
            label="Legalitas"
            opsi={OPSI_LEGALITAS}
            nilai={v("legalitas")}
            onChange={(x) => patch({ legalitas: x })}
          />
        </div>
      );

    case "jadwal":
      return (
        <div>
          <LabelSeksi ikon="solar:alarm-bold-duotone">Jadwal lelang</LabelSeksi>
          <ChipPilihan
            label="Jadwal lelang"
            kolom={1}
            opsi={OPSI_JADWAL.map((o) => ({
              value: o.value,
              label: o.label,
              hint: o.hint,
            }))}
            nilai={v("jadwal")}
            onChange={(x) => patch({ jadwal: x })}
          />
        </div>
      );

    case "durasi":
      return (
        <div>
          <LabelSeksi ikon="solar:calendar-date-bold-duotone">Durasi sewa</LabelSeksi>
          <ChipPilihan
            label="Durasi sewa"
            opsi={[
              { value: "HARIAN", label: "Harian" },
              { value: "MINGGUAN", label: "Mingguan" },
              { value: "BULANAN", label: "Bulanan" },
              { value: "TAHUNAN", label: "Tahunan" },
            ]}
            nilai={v("durasi")}
            onChange={(x) => patch({ durasi: x })}
          />
        </div>
      );

    case "gender":
      return (
        <div>
          <LabelSeksi ikon="solar:users-group-two-rounded-bold-duotone">
            Gender kos
          </LabelSeksi>
          <ChipPilihan
            label="Gender kos"
            kolom={3}
            opsi={[
              { value: "PUTRA", label: "Putra" },
              { value: "PUTRI", label: "Putri" },
              { value: "CAMPUR", label: "Campur" },
            ]}
            nilai={v("gender")}
            onChange={(x) => patch({ gender: x })}
          />
        </div>
      );

    case "kamarMandiTipe":
      return (
        <div>
          <LabelSeksi ikon="solar:bath-bold-duotone">Kamar mandi</LabelSeksi>
          <ChipPilihan
            label="Letak kamar mandi"
            opsi={OPSI_KAMAR_MANDI_TIPE}
            nilai={v("kmTipe")}
            onChange={(x) => patch({ kmTipe: x })}
          />
        </div>
      );

    case "tipeUnit":
      return (
        <div>
          <LabelSeksi ikon="solar:buildings-2-bold-duotone">Tipe unit</LabelSeksi>
          <ChipPilihan
            label="Tipe unit"
            opsi={OPSI_TIPE_UNIT}
            nilai={v("tipeUnit")}
            onChange={(x) => patch({ tipeUnit: x })}
          />
        </div>
      );

    case "hotDeal":
      return (
        <Sakelar
          ikon="solar:fire-bold-duotone"
          judul="Hanya hot deal"
          keterangan="Listing yang ditandai penawaran terbaik oleh agent"
          aktif={v("hotDeal") === "1"}
          onChange={(on) => patch({ hotDeal: on ? "1" : "" })}
        />
      );

    case "keyword":
    default:
      return null;
  }
}

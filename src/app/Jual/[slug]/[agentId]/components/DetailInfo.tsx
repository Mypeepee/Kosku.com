"use client";

/**
 * Kolom kiri halaman detail properti dijual — disusun mengikuti urutan
 * pertanyaan calon pembeli, sama seperti halaman /Sewa:
 *
 *   1. "Properti apa ini, di mana?"        → kepala halaman
 *   2. "Sebesar apa?"                      → ringkasan satu baris
 *   3. "Ceritakan"                         → deskripsi
 *   4. "Bangunannya bagaimana?"            → spesifikasi & utilitas
 *   5. "Sertifikatnya aman?"               → legalitas & status
 *   6. "Dekat apa?"                        → lokasi & sekitar
 *   7. "Sanggup tidak mencicilnya?"        → simulasi KPR
 *
 * PERUBAHAN BESAR DARI VERSI LAMA.
 *
 * a. Ringkasan (LT/LB/KT/KM/lantai) dulu lima kartu setinggi 120px yang
 *    memakan hampir satu layar ponsel penuh untuk lima angka. Sekarang satu
 *    baris (lihat StatStrip), dan sel yang datanya kosong tidak ikut tampil —
 *    listing tanah tidak lagi memajang "— kamar tidur".
 *
 * b. Bagian "Alamat Lengkap" yang berupa kisi delapan kotak (alamat,
 *    kelurahan, kecamatan, kota, provinsi, area) DIHAPUS: isinya persis sama
 *    dengan yang sudah tertulis di kepala halaman, hanya dipecah jadi kotak.
 *    Wilayahnya kini jadi chip di bagian Lokasi, tepat di atas petanya —
 *    tempat orang memang mencarinya.
 *
 * c. Bagian Lokasi sekarang menjawab "dekat apa?" (lihat SekitarLokasi),
 *    yang sebelumnya hanya bisa dijawab dengan mengklik pin di peta satu per
 *    satu.
 *
 * Warna mengikuti src/lib/detailTheme.ts: satu hue satu arti, mint hanya untuk
 * uang. Sebelumnya seluruh halaman memakai emerald untuk segalanya — ikon
 * judul, sertifikat, tombol share, harga — sehingga tidak ada yang menonjol.
 */

import React, { useState } from "react";
import { Icon } from "@iconify/react";

import {
  AKSEN,
  AKSEN_SECTION_ASET,
  KILAU_KARTU,
  LINE,
  SURFACE,
  type Aksen,
} from "@/lib/detailTheme";
import type { AksesTerdekat } from "@/lib/kosDetail";
import SekitarLokasi from "@/components/property/detail/SekitarLokasi";
import {
  Bagian,
  BarisFakta,
  Chip,
  Deskripsi,
  FaktaGrid,
  Judul,
  Kartu,
  SpandukTerjual,
  StatStrip,
  TombolBagikan,
  type ItemFakta,
  type ItemStat,
} from "@/components/property/detail/parts";

interface DetailInfoProps {
  data: any;
  selectedRoom?: any;
  setSelectedRoom?: (room: any) => void;
}

const formatRupiah = (val: number | null | undefined) => {
  if (!val || isNaN(val)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val);
};

const BADGE_TRANSAKSI: Record<string, { label: string; icon: string; aksen: Aksen }> = {
  JUAL: { label: "Dijual", icon: "solar:tag-price-bold", aksen: AKSEN.mint },
  PRIMARY: { label: "Dijual", icon: "solar:tag-price-bold", aksen: AKSEN.mint },
  SECONDARY: { label: "Secondary", icon: "solar:tag-price-bold", aksen: AKSEN.mint },
  SEWA: { label: "Disewa", icon: "solar:key-bold", aksen: AKSEN.sky },
  LELANG: { label: "Lelang", icon: "mdi:gavel", aksen: AKSEN.amber },
};

const badgeTransaksi = (jenis: string) =>
  BADGE_TRANSAKSI[jenis?.toUpperCase()] || {
    label: jenis || "Properti",
    icon: "solar:home-bold",
    aksen: AKSEN.violet,
  };

/** Ikon per kategori — rumah, ruko, dan tanah tidak pantas berikon sama. */
const KATEGORI: Record<string, { label: string; icon: string }> = {
  RUMAH: { label: "Rumah", icon: "solar:home-2-bold-duotone" },
  APARTEMEN: { label: "Apartemen", icon: "solar:buildings-3-bold-duotone" },
  RUKO: { label: "Ruko", icon: "solar:shop-2-bold-duotone" },
  TANAH: { label: "Tanah", icon: "solar:map-bold-duotone" },
  GUDANG: { label: "Gudang", icon: "solar:box-bold-duotone" },
  VILLA: { label: "Villa", icon: "solar:home-wifi-bold-duotone" },
  GEDUNG: { label: "Gedung", icon: "solar:buildings-2-bold-duotone" },
  KANTOR: { label: "Kantor", icon: "solar:case-bold-duotone" },
  KOS: { label: "Kos", icon: "solar:bed-bold-duotone" },
};

const kategoriMeta = (kategori: string) =>
  KATEGORI[kategori?.toUpperCase()] || {
    label: kategori || "Properti",
    icon: "solar:home-bold-duotone",
  };

// Template soft selling
const buildShareMessage = (data: any) => {
  const judul = data?.judul || "Listing Properti";

  const harga = parseFloat(data?.harga) || 0;
  const hargaPromo = parseFloat(data?.harga_promo) || 0;
  const hasPromo = hargaPromo > 0 && hargaPromo < harga;
  const hargaDisplay = hasPromo
    ? `~${formatRupiah(harga)}~ → *${formatRupiah(hargaPromo)}* 🔥`
    : formatRupiah(harga);

  const lokasiSingkat =
    data?.kota ||
    data?.alamat_lengkap ||
    [data?.kelurahan, data?.kecamatan, data?.kota, data?.provinsi]
      .filter(Boolean)
      .join(", ");

  const luasTanah = data?.luas_tanah ? `${data.luas_tanah} m²` : "-";
  const luasBangunan = data?.luas_bangunan ? `${data.luas_bangunan} m²` : "-";
  const legal = data?.legalitas || "-";

  return (
    `🏡 ${judul}\n` +
    (lokasiSingkat ? `📍 ${lokasiSingkat}\n` : "") +
    `📌 Spesifikasi\n` +
    (data?.alamat_lengkap ? `📍 ${data.alamat_lengkap}\n` : "") +
    `📐 LT ${luasTanah} / LB ${luasBangunan}\n` +
    `🛏️ ${data?.kamar_tidur ?? "-"} KT • 🚿 ${data?.kamar_mandi ?? "-"} KM\n` +
    `📃 Tipe Hak: ${legal}\n` +
    `💰 Harga Jual: ${hargaDisplay}\n` +
    `Kode: ${data?.id_property || "-"}\n\n` +
    `📞 Hubungi kami untuk info lebih lanjut`
  );
};

export default function DetailInfo({ data }: DetailInfoProps) {
  const [dpPercentage, setDpPercentage] = useState(20);
  const [tenor, setTenor] = useState(15);
  const [interestRate, setInterestRate] = useState(6.75);
  const [shared, setShared] = useState(false);

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    const text = buildShareMessage(data);

    if (navigator.share) {
      try {
        await navigator.share({
          title: data?.judul || "Listing Properti",
          text,
          url,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch {
        // user batal / error
      }
    } else if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(`${text}\n\n🔗 Info lengkap: ${url}`);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch {
        // gagal copy, abaikan
      }
    }
  };

  const badge = badgeTransaksi(data?.jenis_transaksi || "JUAL");
  const kategori = kategoriMeta(data?.kategori || "RUMAH");

  const harga = parseFloat(data?.harga) || 0;
  const hargaPromo = parseFloat(data?.harga_promo) || 0;
  const hargaFinal = hargaPromo > 0 && hargaPromo < harga ? hargaPromo : harga;

  const calculateKPR = () => {
    const dp = hargaFinal * (dpPercentage / 100);
    const pinjaman = hargaFinal - dp;
    const monthlyRate = interestRate / 100 / 12;
    const totalMonths = tenor * 12;

    if (monthlyRate === 0)
      return {
        monthly: totalMonths ? pinjaman / totalMonths : 0,
        total: pinjaman,
        interest: 0,
        dp,
      };

    const factor = Math.pow(1 + monthlyRate, totalMonths);
    const monthly = (pinjaman * monthlyRate * factor) / (factor - 1);
    const totalPayment = monthly * totalMonths;
    const totalInterest = totalPayment - pinjaman;

    return {
      monthly,
      total: totalPayment + dp,
      interest: totalInterest,
      dp,
    };
  };

  const kprData = calculateKPR();

  const jenisUpper = data?.jenis_transaksi?.toString().toUpperCase();
  const isJualTransaction =
    jenisUpper === "JUAL" || jenisUpper === "PRIMARY" || jenisUpper === "SECONDARY";
  const hasValidPrice = hargaFinal > 0;
  const isSold = data?.status_tayang?.toString().toUpperCase() === "TERJUAL";
  const soldLabel = jenisUpper === "SEWA" ? "tersewa" : "terjual";
  const showKPRCalculator = isJualTransaction && hasValidPrice;

  const isSecondary = jenisUpper === "SECONDARY";
  const showFullAddress = !isSecondary;

  const handleInterestRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    value = value.replace(/^0+(?=\d)/, "");

    if (value === "" || value === ".") {
      setInterestRate(0);
      return;
    }

    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 15) {
      setInterestRate(numValue);
    }
  };

  const alamatKepala =
    (showFullAddress ? data?.alamat_lengkap : null) ||
    [data?.kecamatan, data?.kota].filter(Boolean).join(", ") ||
    "Lokasi tidak tersedia";

  const wilayah = [data?.kelurahan, data?.kecamatan, data?.kota, data?.provinsi];

  const aksesTerdekat: AksesTerdekat[] = Array.isArray(data?.akses_terdekat)
    ? (data.akses_terdekat as AksesTerdekat[]).filter((a) => a?.nama)
    : [];

  // Sel ringkasan yang datanya kosong dibuang, bukan diisi "—": tanah kosong
  // yang menampilkan empat strip terbaca seperti data yang gagal dimuat.
  const ringkasan: ItemStat[] = [
    data?.luas_tanah && {
      ikon: "solar:ruler-angular-bold-duotone",
      label: "Luas tanah",
      nilai: `${data.luas_tanah} m²`,
      aksen: AKSEN.amber,
    },
    data?.luas_bangunan && {
      ikon: "solar:home-2-bold-duotone",
      label: "Luas bangunan",
      nilai: `${data.luas_bangunan} m²`,
      aksen: AKSEN.sky,
    },
    data?.kamar_tidur != null && {
      ikon: "solar:bed-bold-duotone",
      label: "Kamar tidur",
      nilai: `${data.kamar_tidur}`,
      aksen: AKSEN.violet,
    },
    data?.kamar_mandi != null && {
      ikon: "solar:bath-bold-duotone",
      label: "Kamar mandi",
      nilai: `${data.kamar_mandi}`,
      aksen: AKSEN.cyan,
    },
    data?.jumlah_lantai && {
      ikon: "solar:layers-minimalistic-bold-duotone",
      label: "Lantai",
      nilai: `${data.jumlah_lantai}`,
      aksen: AKSEN.rose,
    },
  ].filter(Boolean) as ItemStat[];

  const utilitas: ItemFakta[] = [
    data?.daya_listrik && {
      ikon: "solar:bolt-circle-bold-duotone",
      label: "Daya listrik",
      nilai: `${data.daya_listrik} Watt`,
    },
    data?.sumber_air && {
      ikon: "solar:waterdrops-bold-duotone",
      label: "Sumber air",
      nilai: data.sumber_air,
    },
    data?.kondisi_interior && {
      ikon: "solar:sofa-2-bold-duotone",
      label: "Kondisi interior",
      nilai: data.kondisi_interior,
    },
    data?.hadap_bangunan && {
      ikon: "solar:compass-bold-duotone",
      label: "Hadap bangunan",
      nilai: data.hadap_bangunan,
    },
  ].filter(Boolean) as ItemFakta[];

  return (
    <div className="w-full min-w-0 space-y-7 pb-10 lg:w-2/3">
      {isSold && <SpandukTerjual label={soldLabel} />}

      {/* ══ 1. KEPALA HALAMAN ══ */}
      <Bagian>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Chip ikon={badge.icon} aksen={badge.aksen}>
            {badge.label}
          </Chip>
          <Chip ikon={kategori.icon}>{kategori.label}</Chip>
          {data?.is_hot_deal && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/30 bg-gradient-to-r from-orange-500/20 to-rose-500/20 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-orange-200"
              title="Hot Deal"
            >
              <Icon icon="solar:fire-bold" className="text-sm" />
              <span className="hidden sm:inline">Hot deal</span>
            </span>
          )}
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black leading-tight tracking-tight text-white md:text-[32px]">
              {data?.judul || "Properti Tanpa Judul"}
            </h1>

            <div className="mt-3 flex items-start gap-2">
              <Icon
                icon="solar:map-point-bold"
                className={`mt-0.5 shrink-0 text-lg ${AKSEN.sky.ikon}`}
              />
              <p className="text-[15px] font-medium leading-snug text-white/85">
                {alamatKepala}
              </p>
            </div>

            <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-semibold text-white/40">
              <span className="inline-flex items-center gap-1.5">
                <Icon icon="solar:eye-bold" /> {data?.dilihat || 0} dilihat
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon icon="solar:hashtag-bold" /> ID {data?.id_property || "-"}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                  isSold ? AKSEN.rose.chip : AKSEN.emerald.chip
                }`}
              >
                <Icon
                  icon={isSold ? "solar:lock-keyhole-bold" : "solar:check-circle-bold"}
                  className="text-xs"
                />
                {data?.status_tayang || "TERSEDIA"}
              </span>
            </div>
          </div>

          <TombolBagikan onClick={handleShare} tersalin={shared} />
        </div>
      </Bagian>

      {/* ══ 2. RINGKASAN — SATU BARIS ══ */}
      {ringkasan.length > 0 && (
        <Bagian>
          <Judul
            ikon="solar:widget-4-bold-duotone"
            aksen={AKSEN_SECTION_ASET.ringkasan}
          >
            Ringkasan properti
          </Judul>
          <StatStrip items={ringkasan} />
        </Bagian>
      )}

      {/* ══ 3. DESKRIPSI ══ */}
      {data?.deskripsi && (
        <Bagian>
          <Judul
            ikon="solar:document-text-bold-duotone"
            aksen={AKSEN_SECTION_ASET.deskripsi}
          >
            Tentang properti ini
          </Judul>
          <Deskripsi teks={data.deskripsi} />
        </Bagian>
      )}

      {/* ══ 4. SPESIFIKASI & UTILITAS ══ */}
      {utilitas.length > 0 && (
        <Bagian>
          <Judul
            ikon="solar:settings-minimalistic-bold-duotone"
            aksen={AKSEN_SECTION_ASET.utilitas}
          >
            Utilitas &amp; kondisi bangunan
          </Judul>
          <Kartu>
            <FaktaGrid items={utilitas} kolom={4} aksen={AKSEN_SECTION_ASET.utilitas} />
          </Kartu>
        </Bagian>
      )}

      {/* ══ 5. LEGALITAS & STATUS ══ */}
      <Bagian>
        <Judul
          ikon="solar:shield-check-bold-duotone"
          aksen={AKSEN_SECTION_ASET.legal}
        >
          Legalitas &amp; status
        </Judul>
        <Kartu padat>
          <div className="px-5 py-2">
            <BarisFakta
              ikon="solar:document-add-bold-duotone"
              label="Jenis sertifikat"
              nilai={
                data?.legalitas ? (
                  <span className={AKSEN.emerald.teks}>{data.legalitas}</span>
                ) : (
                  <span className="text-white/40">Tanya agent</span>
                )
              }
              aksen={data?.legalitas ? AKSEN.emerald : undefined}
            />
            <BarisFakta
              ikon="solar:tag-horizontal-bold-duotone"
              label="Status properti"
              nilai={
                <span className={isSold ? "text-rose-300" : "text-emerald-300"}>
                  {data?.status_tayang || "TERSEDIA"}
                </span>
              }
              aksen={isSold ? AKSEN.rose : AKSEN.emerald}
            />
            <BarisFakta
              ikon={kategori.icon}
              label="Kategori"
              nilai={kategori.label}
              aksen={AKSEN.violet}
            />
          </div>
        </Kartu>
      </Bagian>

      {/* ══ 6. LOKASI & SEKITAR ══ */}
      <SekitarLokasi
        idProperty={data?.id_property}
        awal={data?.sekitar ?? null}
        latitude={data?.latitude}
        longitude={data?.longitude}
        alamatLengkap={showFullAddress ? data?.alamat_lengkap : null}
        wilayah={wilayah}
        areaLokasi={data?.area_lokasi}
        aksesTerdekat={aksesTerdekat}
        akhir={!showKPRCalculator}
      />

      {/* ══ 7. SIMULASI KPR ══
          Mint dipakai di sini dan hanya di sini pada kolom kiri: seluruh
          bagian ini bicara uang. */}
      {showKPRCalculator && (
        <Bagian akhir>
          <Judul
            ikon="solar:calculator-minimalistic-bold-duotone"
            aksen={AKSEN_SECTION_ASET.simulasi}
            keterangan="Estimasi cicilan bulanan berdasarkan harga listing ini."
          >
            Simulasi KPR
          </Judul>

          <div className="space-y-5">
            {/* Hasil utama — satu angka yang dicari orang saat membuka bagian ini. */}
            <div
              className={`rounded-[1.5rem] border border-[#86efac]/20 p-6 text-center ${AKSEN.mint.wash}`}
            >
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#86efac]">
                Cicilan per bulan
              </p>
              <p className="break-words text-3xl font-black leading-tight text-white md:text-4xl">
                {formatRupiah(kprData.monthly)}
              </p>
              <p className="mt-2 text-[11px] text-white/40">
                DP {dpPercentage}% · {tenor} tahun · bunga {interestRate}%
              </p>
            </div>

            <Kartu>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                {/* DP */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-[0.12em] text-white/35">
                      Uang muka
                    </label>
                    <span className={`text-sm font-black ${AKSEN.mint.teks}`}>
                      {dpPercentage}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="50"
                    step="5"
                    value={dpPercentage}
                    onChange={(e) => setDpPercentage(Number(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full accent-[#86efac]"
                    style={{ background: SURFACE.raised }}
                  />
                  <p className="text-right text-xs font-bold text-white">
                    {formatRupiah(kprData.dp)}
                  </p>
                </div>

                {/* Tenor */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-white/35">
                    Jangka waktu
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[5, 10, 15, 20].map((year) => (
                      <button
                        key={year}
                        onClick={() => setTenor(year)}
                        className={`rounded-lg px-2 py-2 text-[11px] font-black transition-all active:scale-95 ${
                          tenor === year
                            ? "bg-[#86efac] text-[#07130C]"
                            : "border border-white/10 text-white/50 hover:text-white"
                        }`}
                        style={tenor === year ? undefined : { background: SURFACE.raised }}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                  <p className="text-center text-[10px] text-white/30">Tahun</p>
                </div>

                {/* Bunga */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-white/35">
                    Suku bunga
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.25"
                      min="3"
                      max="15"
                      value={interestRate || ""}
                      onChange={handleInterestRateChange}
                      onBlur={(e) => {
                        if (!e.target.value || parseFloat(e.target.value) < 3)
                          setInterestRate(6.75);
                      }}
                      placeholder="6.75"
                      className="w-full rounded-lg border border-white/10 px-3 py-2 pr-8 text-sm font-bold text-white transition-colors [appearance:textfield] focus:border-[#86efac]/50 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      style={{ background: SURFACE.raised }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-white/40">
                      %
                    </span>
                  </div>
                  <p className="text-[10px] text-white/30">Rata-rata pasar 6–8%</p>
                </div>
              </div>
            </Kartu>

            {/* Rincian angka */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                {
                  label: "Uang muka",
                  nilai: formatRupiah(kprData.dp),
                  warna: "text-white",
                  garis: LINE.card,
                },
                {
                  label: "Pokok pinjaman",
                  nilai: formatRupiah(hargaFinal - kprData.dp),
                  warna: "text-white",
                  garis: LINE.card,
                },
                {
                  label: "Total bunga",
                  nilai: formatRupiah(kprData.interest),
                  warna: "text-amber-300",
                  garis: "border-amber-400/20",
                },
                {
                  label: "Total bayar",
                  nilai: formatRupiah(kprData.total),
                  warna: "text-[#86efac]",
                  garis: "border-[#86efac]/20",
                },
              ].map((k) => (
                <div
                  key={k.label}
                  className={`rounded-2xl border p-4 ${k.garis}`}
                  style={{ background: SURFACE.card, boxShadow: KILAU_KARTU }}
                >
                  <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-white/30">
                    {k.label}
                  </p>
                  <p className={`break-words text-base font-black leading-tight ${k.warna}`}>
                    {k.nilai}
                  </p>
                </div>
              ))}
            </div>

            <Kartu padat>
              <div className="px-5 py-2">
                <BarisFakta
                  ikon="solar:calendar-minimalistic-bold-duotone"
                  label="Tenor"
                  nilai={`${tenor} tahun (${tenor * 12} bulan)`}
                />
                <BarisFakta
                  ikon="solar:chart-2-bold-duotone"
                  label="Suku bunga"
                  nilai={`${interestRate}% per tahun`}
                />
                <BarisFakta
                  ikon="solar:wallet-money-bold-duotone"
                  label={`Cicilan × ${tenor * 12} bulan`}
                  nilai={
                    <span className={AKSEN.mint.teks}>
                      {formatRupiah(kprData.monthly * tenor * 12)}
                    </span>
                  }
                  aksen={AKSEN.mint}
                />
              </div>
            </Kartu>

            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-white/30">
              <Icon icon="solar:info-circle-linear" className="mt-0.5 shrink-0 text-sm" />
              Kalkulasi ini estimasi. Nilai aktual dapat berbeda tergantung kebijakan
              bank dan kelengkapan dokumen.
            </p>
          </div>
        </Bagian>
      )}
    </div>
  );
}

'use client';

import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { ListingFormData } from '@/lib/validations/listing';
import { FormField } from '../FormField';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HADAP_OPTIONS,
  KONDISI_INTERIOR_OPTIONS as RAW_KONDISI_INTERIOR_OPTIONS,
  FASILITAS_KAMAR_OPTIONS,
  FASILITAS_BERSAMA_OPTIONS,
  PERATURAN_OPTIONS,
  TIPE_UNIT_OPTIONS,
} from '@/app/tambah-property/types/listing';
import { FacilityMultiSelect } from '../FacilityMultiSelect';
import {
  Square,
  Home,
  Bed,
  Bath,
  Layers,
  Zap,
  Droplets,
  Droplet,
  Waves,
  Gauge,
  Compass,
  Sofa,
  FileText,
  CheckCircle2,
  TrendingUp,
  Shield,
  Key,
  Clock,
  Building2,
  Hash,
  LogIn,
  LogOut,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PremiumSelect, type PremiumSelectOption } from '../PremiumSelect';
import { GenderKosSelect } from '../kos/GenderKosSelect';
import {
  hargaTipe,
  ringkasKamarTipe,
  type KamarTipe,
} from '@/lib/kosRoomTypes';
import { KAMAR_MANDI_TIPE_LABEL } from '@/lib/kosCard';

// Opsi Sumber Air dengan ikon + deskripsi untuk dropdown premium
const SUMBER_AIR_SELECT_OPTIONS: PremiumSelectOption[] = [
  { value: 'PDAM', label: 'PDAM', desc: 'Jaringan air ledeng kota', icon: <Droplets className="h-4 w-4" /> },
  { value: 'Sumur Bor', label: 'Sumur Bor', desc: 'Pompa sumur dalam', icon: <Gauge className="h-4 w-4" /> },
  { value: 'Sumur Gali', label: 'Sumur Gali', desc: 'Sumur galian dangkal', icon: <Droplet className="h-4 w-4" /> },
  { value: 'Air Tanah', label: 'Air Tanah', desc: 'Sumber air alami', icon: <Waves className="h-4 w-4" /> },
];

interface Step4Props {
  form: UseFormReturn<ListingFormData>;
}

// Sertifikat enum sesuai DB (label singkat + deskripsi untuk dropdown premium)
const SERTIFIKAT_SELECT_OPTIONS: PremiumSelectOption[] = [
  { value: 'SHM', label: 'SHM', desc: 'Sertifikat Hak Milik' },
  { value: 'HGB', label: 'HGB', desc: 'Hak Guna Bangunan' },
  { value: 'HGU', label: 'HGU', desc: 'Hak Guna Usaha' },
  { value: 'HP', label: 'HP', desc: 'Hak Pakai' },
  { value: 'STRATA_TITLE', label: 'Strata Title', desc: 'Hak satuan rumah susun' },
  { value: 'PPJB', label: 'PPJB', desc: 'Perjanjian Pengikatan Jual Beli' },
  { value: 'AJB', label: 'AJB', desc: 'Akta Jual Beli' },
  { value: 'LAINNYA', label: 'Lainnya', desc: 'Dokumen lainnya' },
].map((o) => ({ ...o, icon: <FileText className="h-4 w-4" /> }));

// Ganti label "Bare" => "Kosongan"
const KONDISI_INTERIOR_OPTIONS = RAW_KONDISI_INTERIOR_OPTIONS.map((k) =>
  k.toLowerCase() === 'bare' ? 'Kosongan' : k,
);

// Opsi dropdown premium untuk Hadap Bangunan
const HADAP_SELECT_OPTIONS: PremiumSelectOption[] = HADAP_OPTIONS.map((h) => ({
  value: h,
  label: h,
  icon: <Compass className="h-4 w-4" />,
}));

// Opsi dropdown premium untuk Kondisi Interior
const KONDISI_DESC: Record<string, string> = {
  Kosongan: 'Tanpa perabot',
  'Semi Furnished': 'Sebagian perabot terpasang',
  'Fully Furnished': 'Perabot lengkap',
};
const KONDISI_SELECT_OPTIONS: PremiumSelectOption[] = KONDISI_INTERIOR_OPTIONS.map(
  (k) => ({ value: k, label: k, desc: KONDISI_DESC[k], icon: <Sofa className="h-4 w-4" /> }),
);

// Konversi ke number, undefined kalau kosong/0
const toNumericOrUndefined = (v: unknown): number | undefined => {
  if (v === '' || v === null || v === undefined) return undefined;
  const asString = String(v);
  const numeric = Number(asString);
  return Number.isNaN(numeric) || numeric === 0 ? undefined : numeric;
};

// Filter hanya angka dan hilangkan leading zero (0023 -> 23, 0 -> kosong)
const stripNonDigitAndLeadingZeros = (raw: string): string => {
  const onlyDigits = raw.replace(/\D/g, '');
  if (onlyDigits === '') return '';
  const noLeading = onlyDigits.replace(/^0+/, '');
  return noLeading === '' ? '' : noLeading;
};

// Handler untuk semua input angka (kecuali nomor sertifikat)
const handleNumericInputNoLeadingZero = (
  e: React.ChangeEvent<HTMLInputElement>,
) => {
  const cleaned = stripNonDigitAndLeadingZeros(e.target.value);
  e.target.value = cleaned;
};


/**
 * Format jam sambil mengetik: "2200" → "22:00". Titik dua disisipkan sendiri
 * supaya pemilik cukup mengetik angka. Jam dibatasi 23 dan menit 59, jadi
 * mustahil tersimpan nilai seperti "99:99". Menghapus mundur tetap terasa
 * alami karena string selalu dirakit ulang dari angkanya saja.
 */
const formatJam = (raw: string): string => {
  const digit = raw.replace(/\D/g, '').slice(0, 4);
  if (!digit) return '';

  if (digit.length <= 2) {
    return Number(digit) > 23 ? '23' : digit;
  }

  const jam = Number(digit.slice(0, 2)) > 23 ? '23' : digit.slice(0, 2);
  let menit = digit.slice(2);
  if (menit.length === 2 && Number(menit) > 59) menit = '59';
  return `${jam}:${menit}`;
};

// Toggle Ya/Tidak sederhana — value null = belum dijawab (beda dari "Tidak")
function YesNoToggle({
  value,
  onChange,
  icon,
  /**
   * `lg` dipakai saat toggle ini berdampingan dengan kontrol setinggi 56px
   * (mis. dropdown gender kos) — dua kontrol sebaris dengan tinggi berbeda
   * membuat barisnya terlihat seperti salah rakit.
   */
  tinggi = 'md',
}: {
  value: boolean | null | undefined;
  onChange: (v: boolean) => void;
  icon: React.ReactNode;
  tinggi?: 'md' | 'lg';
}) {
  const h = tinggi === 'lg' ? 'h-14' : 'h-11';
  return (
    <div className="flex items-center gap-2">
      <div className="text-emerald-400 shrink-0">{icon}</div>
      <div className="flex gap-2 flex-1">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={cn(
            'flex-1 rounded-xl text-sm font-bold border-2 transition-colors',
            h,
            value === true
              ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
              : 'border-slate-800 bg-slate-900/30 text-slate-400 hover:border-emerald-500/30',
          )}
        >
          Ya
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={cn(
            'flex-1 rounded-xl text-sm font-bold border-2 transition-colors',
            h,
            value === false
              ? 'border-slate-600 bg-slate-800/60 text-slate-300'
              : 'border-slate-800 bg-slate-900/30 text-slate-400 hover:border-slate-600',
          )}
        >
          Tidak
        </button>
      </div>
    </div>
  );
}

export function Step4Specifications({ form }: Step4Props) {
  const {
    watch,
    formState: { errors },
    register,
    setValue,
  } = form;

  const luasTanah = watch('luas_tanah');
  const luasBangunan = watch('luas_bangunan');
  const jumlahLantai = watch('jumlah_lantai');
  const kamarTidur = watch('kamar_tidur');
  const kamarMandi = watch('kamar_mandi');
  const dayaListrik = watch('daya_listrik');
  const hadapBangunan = watch('hadap_bangunan');
  const sumberAir = watch('sumber_air');
  const kondisiInterior = watch('kondisi_interior');
  const legalitas = watch('legalitas');
  const nomorLegalitas = watch('nomor_legalitas');

  const jenisTransaksi = watch('jenis_transaksi');
  const kategori = watch('kategori');
  const isSewa = jenisTransaksi === 'SEWA';
  const isKos = kategori === 'KOS';
  const isApartemen = kategori === 'APARTEMEN';

  /**
   * Apartemen & kos sama-sama tidak punya lahan sendiri — yang ditransaksikan
   * adalah satu unit/kamar di dalam gedung milik bersama. Menanyakan luas
   * tanah untuk keduanya cuma memancing angka karangan (luas tanah gedung
   * apartemen bukan milik pemilik satu unit), jadi seluruh blok dimensi
   * lahan diganti satu isian: luas unit.
   */
  const tanpaLahan = isKos || isApartemen;

  // Identitas unit (gedung/lantai/nomor/tipe/luas) hanya untuk apartemen yang
  // DISEWAKAN: kolomnya hidup di listing_sewa_detail, dan baris itu hanya
  // dibuat untuk transaksi SEWA. Menampilkannya di apartemen dijual akan
  // meminta agent mengisi data yang tidak punya tempat penyimpanan.
  const isUnitApartemen = isSewa && isApartemen;

  const tipeUnit = watch('tipe_unit');
  const hargaSewaHarian = watch('harga_sewa_harian');
  const hargaSewaMingguan = watch('harga_sewa_mingguan');

  // Jam check-in/out cuma bermakna untuk sewa jangka pendek (pola Booking/
  // Agoda). Untuk kontrak bulanan/tahunan, "jam check-in" bukan hal yang
  // pernah ditanyakan penyewa — jadi field-nya tidak ditampilkan sama sekali.
  const adaSewaJangkaPendek =
    isSewa &&
    (Number(hargaSewaHarian ?? 0) > 0 || Number(hargaSewaMingguan ?? 0) > 0);

  // Kos dengan beberapa tipe kamar: luas, kamar mandi, kapasitas, total & sisa
  // kamar sudah diatur per tipe di step Harga & Kamar. Menampilkannya lagi di
  // sini akan menciptakan dua sumber kebenaran yang saling menimpa — jadi
  // diganti ringkasan read-only.
  const kamarTipe = (watch('kamar_tipe') ?? []) as KamarTipe[];
  const adaTipeKamar = isKos && kamarTipe.length > 0;
  const ringkasanTipe = ringkasKamarTipe(kamarTipe);
  const durasiUtama = watch('durasi_sewa');

  // Baris ringkasan kamar. Mode seragam tetap dapat satu baris ("Semua kamar")
  // supaya bentuk ringkasannya sama di kedua mode — agent tidak perlu belajar
  // dua tampilan untuk informasi yang sama.
  const ringkasanBarisKamar = adaTipeKamar
    ? kamarTipe.map((t, i) => ({
        nama: t.nama?.trim() || `Tipe ${i + 1}`,
        jumlah: Number(t.jumlah_kamar ?? 0),
        tersedia: Number(t.kamar_tersedia ?? 0),
        detail: [
          t.kamar_mandi_tipe ? KAMAR_MANDI_TIPE_LABEL[t.kamar_mandi_tipe] : null,
          t.luas_kamar ? `${t.luas_kamar} m²` : null,
          t.kapasitas_penghuni ? `maks ${t.kapasitas_penghuni} org` : null,
        ].filter(Boolean) as string[],
        harga: durasiUtama ? hargaTipe(t, durasiUtama) : null,
      }))
    : [
        {
          nama: 'Semua kamar',
          jumlah: Number(watch('total_kamar') ?? 0),
          tersedia: Number(watch('kamar_tersedia') ?? 0),
          detail: [
            watch('kamar_mandi_tipe')
              ? KAMAR_MANDI_TIPE_LABEL[watch('kamar_mandi_tipe') as string]
              : null,
            watch('luas_kamar') ? `${watch('luas_kamar')} m²` : null,
            watch('kapasitas_penghuni')
              ? `maks ${watch('kapasitas_penghuni')} org`
              : null,
          ].filter(Boolean) as string[],
          harga: null as number | null,
        },
      ];

  // Tiga grup chip disimpan sebagai string comma-separated (konvensi yang sama
  // dipakai kolom `gambar`), jadi butuh parse/toggle generik.
  type ChipField = 'fasilitas_kamar' | 'fasilitas_bersama' | 'peraturan';

  const parseChips = (raw: string | null | undefined) =>
    raw ? raw.split(',').map((f) => f.trim()).filter(Boolean) : [];

  const setChips = (field: ChipField, next: string[]) => {
    setValue(field, next.join(','), { shouldValidate: true });
  };

  const fasilitasKamar = parseChips(watch('fasilitas_kamar'));
  const fasilitasBersama = parseChips(watch('fasilitas_bersama'));
  const peraturan = parseChips(watch('peraturan'));

  const termasukListrik = watch('termasuk_listrik');
  const termasukAir = watch('termasuk_air');
  const akses24Jam = watch('akses_24_jam');

  const buildingRatio =
    luasTanah && luasBangunan && luasTanah > 0
      ? (luasBangunan / luasTanah) * 100
      : 0;

  const totalFields = 11;
  const filledFields = [
    luasTanah,
    luasBangunan,
    jumlahLantai,
    kamarTidur,
    kamarMandi,
    dayaListrik,
    hadapBangunan,
    sumberAir,
    kondisiInterior,
    legalitas,
    nomorLegalitas,
  ].filter((val) => val !== undefined && val !== null && val !== '').length;

  const completionPercentage = Math.round((filledFields / totalFields) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Identitas unit apartemen — satu unit hanya bisa disebut dengan benar
          lewat gedung + lantai + nomornya. Ditaruh paling atas karena
          inilah yang membedakan listing ini dari puluhan unit lain di gedung
          yang sama, dan pola yang dipakai Travelio/Jendela360. */}
      {isUnitApartemen && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/20">
              <Building2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">Identitas Unit</h3>
              <p className="text-xs text-slate-500">
                Alamat &amp; ukuran unit di dalam gedung — pembeda dari unit lain
                di gedung yang sama
              </p>
            </div>
          </div>

          <FormField
            label="Tipe Unit"
            required
            error={errors.tipe_unit?.message}
            description="Cara penyewa apartemen menyebut kebutuhannya, sekaligus filter utama di halaman daftar"
          >
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {TIPE_UNIT_OPTIONS.map((opsi) => {
                const aktif = tipeUnit === opsi.value;
                return (
                  <button
                    key={opsi.value}
                    type="button"
                    aria-pressed={aktif}
                    onClick={() => {
                      setValue('tipe_unit', opsi.value, { shouldValidate: true });
                      // Jumlah kamar tidur mengikuti tipe unit — 2BR berarti 2
                      // kamar tidur, selalu. Diisikan (bukan dikunci) supaya
                      // kasus tak lazim seperti 4BR+ dengan 5 kamar tetap bisa
                      // dikoreksi manual di isian di bawahnya.
                      setValue('kamar_tidur', opsi.kamarTidur, {
                        shouldValidate: true,
                      });
                    }}
                    className={cn(
                      'group relative overflow-hidden rounded-xl border-2 px-3 py-3 text-left transition-all duration-200',
                      aktif
                        ? 'border-emerald-500/60 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
                        : 'border-slate-800 bg-slate-900/30 hover:border-emerald-500/30 hover:bg-slate-900/50',
                    )}
                  >
                    <span
                      className={cn(
                        'block text-base font-black leading-none',
                        aktif ? 'text-emerald-300' : 'text-slate-200',
                      )}
                    >
                      {opsi.label}
                    </span>
                    <span className="mt-1.5 block text-[11px] leading-tight text-slate-500">
                      {opsi.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </FormField>

          <FormField
            label="Nama Apartemen / Gedung"
            error={errors.nama_gedung?.message}
            description="Nama yang diketik orang saat mencari. Kalau ada tower-nya, tulis sekalian di sini"
          >
            <div className="relative flex items-center">
              <Building2 className="absolute left-4 h-4 w-4 text-emerald-400" />
              <input
                {...register('nama_gedung')}
                placeholder="Educity Apartment Tower Amethyst"
                maxLength={150}
                className={cn(
                  'h-14 w-full rounded-xl pl-12 pr-4 text-base font-semibold text-slate-100',
                  'border-2 border-slate-800 bg-slate-900/50',
                  'focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
                  'transition-all duration-300 placeholder:text-slate-600',
                )}
              />
            </div>
          </FormField>

          {/* Luas unit ikut di sini, bukan di blok Dimensi terpisah: untuk
              apartemen luas adalah bagian dari cara menyebut unitnya ("2BR
              51 m² lantai 12"), dan setelah luas tanah & jumlah lantai hilang
              blok Dimensi tidak menyisakan apa-apa selain isian ini sendiri.

              Lantai & nomor unit sengaja teks bebas: di lapangan nilainya
              memang bukan angka murni ("GF", "12A", "3 Mezzanine"), dan
              memaksanya jadi angka akan membuat agent mengisi yang salah. */}
          <div className="grid gap-6 sm:grid-cols-3">
            <FormField
              label="Luas Unit"
              required
              error={errors.luas_bangunan?.message}
            >
              <div className="relative flex items-center">
                <Square className="absolute left-4 h-4 w-4 text-emerald-400" />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="51"
                  {...register('luas_bangunan', {
                    setValueAs: toNumericOrUndefined,
                  })}
                  onInput={handleNumericInputNoLeadingZero}
                  className={cn(
                    'h-14 w-full rounded-xl pl-12 pr-12 text-base font-semibold text-slate-100',
                    'border-2 border-slate-800 bg-slate-900/50',
                    'focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
                    'transition-all duration-300 placeholder:text-slate-600',
                  )}
                />
                <span className="absolute right-4 text-sm font-semibold text-slate-400">
                  m²
                </span>
              </div>
            </FormField>

            {[
              {
                name: 'lantai_unit' as const,
                label: 'Lantai',
                placeholder: '12',
                maxLength: 20,
                icon: <Layers className="h-4 w-4 text-cyan-400" />,
                error: errors.lantai_unit?.message,
              },
              {
                name: 'nomor_unit' as const,
                label: 'Nomor Unit',
                placeholder: '12A',
                maxLength: 30,
                icon: <Hash className="h-4 w-4 text-indigo-400" />,
                error: errors.nomor_unit?.message,
              },
            ].map((f) => (
              <FormField key={f.name} label={f.label} error={f.error}>
                <div className="relative flex items-center">
                  <span className="absolute left-4">{f.icon}</span>
                  <input
                    {...register(f.name)}
                    placeholder={f.placeholder}
                    maxLength={f.maxLength}
                    className={cn(
                      'h-14 w-full rounded-xl pl-12 pr-4 text-base font-semibold text-slate-100',
                      'border-2 border-slate-800 bg-slate-900/50',
                      'focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
                      'transition-all duration-300 placeholder:text-slate-600',
                    )}
                  />
                </div>
              </FormField>
            ))}
          </div>
        </div>
      )}

      {/* Dimensi & Struktur Bangunan — disembunyikan untuk KOS: yang disewa
          adalah satu kamar, bukan gedung. Luas tanah, jumlah lantai, daya
          listrik & sumber air bukan pertimbangan calon penghuni kos.

          Untuk apartemen SEWA juga dilewati: luas tanah & jumlah lantai tidak
          berlaku, dan satu-satunya isian yang tersisa (luas unit) sudah pindah
          ke blok Identitas Unit di atas — kalau tetap dirender, hasilnya
          heading "Dimensi Unit" dengan isi kosong. Apartemen DIJUAL tetap
          lewat sini karena blok Identitas Unit tidak dirender untuknya. */}
      {!isKos && !isUnitApartemen && (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Square className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">
              {isApartemen ? 'Dimensi Unit' : 'Dimensi Property'}
            </h3>
            <p className="text-xs text-slate-500">
              {isApartemen
                ? 'Ukuran unit yang disewakan — angka pertama yang dibandingkan calon penyewa'
                : 'Ukuran tanah dan bangunan'}
            </p>
          </div>
        </div>

        <div
          className={cn(
            'grid gap-6',
            // Apartemen hanya menyisakan satu isian (luas unit); dibatasi
            // lebarnya supaya tidak melebar sendirian selebar form.
            isApartemen ? 'md:max-w-sm' : 'md:grid-cols-3',
          )}
        >
          {/* Luas Tanah — hilang untuk apartemen & kos: yang ditransaksikan
              satu unit di dalam gedung milik bersama, jadi angkanya tidak ada
              wujudnya. Untuk SEWA tidak wajib — penyewa memutuskan dari luas
              yang ditempati, bukan luas kavling. */}
          {!tanpaLahan && (
          <FormField label="Luas Tanah" required={!isSewa} error={errors.luas_tanah?.message}>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex items-center">
                <div className="absolute left-4 flex items-center gap-2">
                  <Square className="h-4 w-4 text-emerald-400" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="200"
                  {...register('luas_tanah', {
                    setValueAs: toNumericOrUndefined,
                  })}
                  onInput={handleNumericInputNoLeadingZero}
                  className={cn(
                    'w-full h-14 pl-12 pr-12 rounded-xl text-base font-semibold text-slate-100',
                    'bg-slate-900/50 border-2 border-slate-800',
                    'focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
                    'transition-all duration-300',
                    'placeholder:text-slate-600',
                  )}
                />
                <div className="absolute right-4 text-slate-400 text-sm font-semibold">
                  m²
                </div>
                {luasTanah && luasTanah > 0 && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="absolute right-14"
                  >
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </motion.div>
                )}
              </div>
            </div>
          </FormField>
          )}

          {/* Luas Bangunan — untuk apartemen inilah SATU-SATUNYA ukuran unit,
              jadi wajib: tanpa angka ini listing apartemen tidak punya ukuran
              sama sekali dan tidak bisa dibandingkan dengan unit lain. */}
          <FormField
            label={isApartemen ? 'Luas Unit' : 'Luas Bangunan'}
            required={isApartemen}
            error={errors.luas_bangunan?.message}
            description={
              isApartemen
                ? 'Luas unit sesuai brosur/sertifikat, mis. 51 m²'
                : undefined
            }
          >
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-teal-500/20 to-cyan-500/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex items-center">
                <div className="absolute left-4 flex items-center gap-2">
                  <Home className="h-4 w-4 text-teal-400" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="150"
                  {...register('luas_bangunan', {
                    setValueAs: toNumericOrUndefined,
                  })}
                  onInput={handleNumericInputNoLeadingZero}
                  className={cn(
                    'w-full h-14 pl-12 pr-12 rounded-xl text-base font-semibold text-slate-100',
                    'bg-slate-900/50 border-2 border-slate-800',
                    'focus:border-teal-500/50 focus:outline-none focus:ring-2 focus:ring-teal-500/20',
                    'transition-all duration-300',
                    'placeholder:text-slate-600',
                  )}
                />
                <div className="absolute right-4 text-slate-400 text-sm font-semibold">
                  m²
                </div>
                {luasBangunan && luasBangunan > 0 && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="absolute right-14"
                  >
                    <CheckCircle2 className="h-5 w-5 text-teal-500" />
                  </motion.div>
                )}
              </div>
            </div>
          </FormField>

          {/* Jumlah Lantai — tidak ditanyakan untuk apartemen: satu unit
              menempati satu lantai, dan lantai keberapanya sudah diisi di
              "Lantai" pada blok Identitas Unit. Menanyakannya lagi di sini
              hanya membuat dua tempat yang bisa saling bertentangan. */}
          {!isApartemen && (
          <FormField
            label="Jumlah Lantai"
            error={errors.jumlah_lantai?.message}
          >
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex items-center">
                <div className="absolute left-4 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-cyan-400" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="2"
                  {...register('jumlah_lantai', {
                    setValueAs: toNumericOrUndefined,
                  })}
                  onInput={handleNumericInputNoLeadingZero}
                  className={cn(
                    'w-full h-14 pl-12 pr-12 rounded-xl text-base font-semibold text-slate-100',
                    'bg-slate-900/50 border-2 border-slate-800',
                    'focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20',
                    'transition-all duration-300',
                    'placeholder:text-slate-600',
                  )}
                />
                <div className="absolute right-4 text-slate-400 text-sm font-semibold">
                  Lantai
                </div>
                {jumlahLantai && jumlahLantai > 0 && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="absolute right-14"
                  >
                    <CheckCircle2 className="h-5 w-5 text-cyan-500" />
                  </motion.div>
                )}
              </div>
            </div>
          </FormField>
          )}
        </div>

        {/* Building Ratio */}
        <AnimatePresence>
          {luasTanah && luasBangunan && buildingRatio > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 to-black border border-emerald-500/20 p-5"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl" />
              <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                      Rasio Bangunan/Tanah
                    </p>
                    <p className="text-2xl font-black text-emerald-400">
                      {buildingRatio.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  <div className="w-full sm:w-40 h-3 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(buildingRatio, 100)}%` }}
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    {buildingRatio < 50
                      ? 'Ruang terbuka luas'
                      : buildingRatio < 80
                      ? 'Proporsional'
                      : 'Maksimal coverage'}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      )}

      {!isKos && (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
            <Bed className="h-5 w-5 text-teal-400" />
          </div>
        <div>
          <h3 className="text-lg font-bold text-slate-100">
            {isApartemen ? 'Isi Unit' : 'Struktur Bangunan'}
          </h3>
          <p className="text-xs text-slate-500">
            {isApartemen
              ? 'Jumlah ruang dan daya listrik unit'
              : 'Fasilitas dan utilitas property'}
          </p>
        </div>
      </div>

        {/* Apartemen hanya punya 3 isian di sini (sumber air tidak berlaku),
            jadi grid 2 kolom menyisakan satu field yatim di baris kedua dengan
            separuh baris kosong di sebelahnya. Tiga kolom membuat ketiganya
            habis dalam satu baris. Kategori lain tetap 2 kolom: isiannya 4,
            yang justru pas berpasangan. */}
        <div
          className={cn(
            'grid gap-6',
            isApartemen ? 'md:grid-cols-3' : 'md:grid-cols-2',
          )}
        >
          {/* Kamar Tidur — untuk apartemen sudah terisi otomatis dari tipe unit
              (2BR → 2). Tetap bisa diubah supaya kasus tak lazim seperti 4BR+
              dengan 5 kamar tidak terkunci pada angka yang salah.

              Catatan "terisi otomatis" ditaruh DI BAWAH input, bukan lewat prop
              `description` yang merender di atasnya: description menambah tinggi
              header field ini saja, sehingga input-nya turun sendirian dan tidak
              lagi sebaris dengan Kamar Mandi di kolom sebelah. */}
          <FormField label="Kamar Tidur" error={errors.kamar_tidur?.message}>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex items-center">
                <div className="absolute left-4">
                  <Bed className="h-4 w-4 text-purple-400" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="4"
                  {...register('kamar_tidur', {
                    setValueAs: toNumericOrUndefined,
                  })}
                  onInput={handleNumericInputNoLeadingZero}
                  className={cn(
                    'w-full h-14 pl-12 pr-4 rounded-xl text-base font-semibold text-slate-100',
                    'bg-slate-900/50 border-2 border-slate-800',
                    'focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20',
                    'transition-all duration-300',
                    'placeholder:text-slate-600',
                  )}
                />
                {kamarTidur !== undefined && kamarTidur !== null && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-4"
                  >
                    <CheckCircle2 className="h-5 w-5 text-purple-500" />
                  </motion.div>
                )}
              </div>
              {isUnitApartemen && tipeUnit && (
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  Terisi otomatis dari tipe unit — ubah kalau berbeda
                </p>
              )}
            </div>
          </FormField>

          {/* Kamar Mandi */}
          <FormField label="Kamar Mandi" error={errors.kamar_mandi?.message}>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex items-center">
                <div className="absolute left-4">
                  <Bath className="h-4 w-4 text-blue-400" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="3"
                  {...register('kamar_mandi', {
                    setValueAs: toNumericOrUndefined,
                  })}
                  onInput={handleNumericInputNoLeadingZero}
                  className={cn(
                    'w-full h-14 pl-12 pr-4 rounded-xl text-base font-semibold text-slate-100',
                    'bg-slate-900/50 border-2 border-slate-800',
                    'focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                    'transition-all duration-300',
                    'placeholder:text-slate-600',
                  )}
                />
                {kamarMandi !== undefined && kamarMandi !== null && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-4"
                  >
                    <CheckCircle2 className="h-5 w-5 text-blue-500" />
                  </motion.div>
                )}
              </div>
            </div>
          </FormField>

          {/* Daya Listrik */}
          <FormField label="Daya Listrik" error={errors.daya_listrik?.message}>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex items-center">
                <div className="absolute left-4">
                  <Zap className="h-4 w-4 text-yellow-400" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="2200"
                  {...register('daya_listrik', {
                    setValueAs: toNumericOrUndefined,
                  })}
                  onInput={handleNumericInputNoLeadingZero}
                  className={cn(
                    'w-full h-14 pl-12 pr-12 rounded-xl text-base font-semibold text-slate-100',
                    'bg-slate-900/50 border-2 border-slate-800',
                    'focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20',
                    'transition-all duration-300',
                    'placeholder:text-slate-600',
                  )}
                />
                <div className="absolute right-4 text-slate-400 text-sm font-semibold">
                  VA
                </div>
                {dayaListrik && dayaListrik > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-14"
                  >
                    <CheckCircle2 className="h-5 w-5 text-yellow-500" />
                  </motion.div>
                )}
              </div>
            </div>
          </FormField>

          {/* Sumber Air — tidak berlaku untuk apartemen: airnya disalurkan
              pengelola gedung, tidak ada pilihan PDAM vs sumur bor untuk satu
              unit. Menanyakannya cuma memaksa agent menebak. */}
          {!isApartemen && (
          <FormField label="Sumber Air" error={errors.sumber_air?.message}>
            <div className="group">
              <PremiumSelect
                value={sumberAir ?? ''}
                onChange={(v) =>
                  setValue('sumber_air', v, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                options={SUMBER_AIR_SELECT_OPTIONS}
                placeholder="Pilih Sumber Air"
                accent="cyan"
                ariaLabel="Sumber Air"
                leadingIcon={<Droplets className="h-4 w-4" />}
              />
            </div>
          </FormField>
          )}
        </div>
      </div>
      )}

      {/* Fasilitas & Info Kos — khusus SEWA */}
      <AnimatePresence>
        {isSewa && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden space-y-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <Key className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">
                  {isKos ? 'Detail Kos' : isApartemen ? 'Detail Unit' : 'Detail Sewa'}
                </h3>
                <p className="text-xs text-slate-500">
                  Informasi yang paling dicari calon penyewa
                </p>
              </div>
            </div>

            {/* Ringkasan kamar — read-only. Semua isian kamar (jumlah, luas,
                kamar mandi, kapasitas, harga) hidup di step "Kamar & Harga";
                di sini hanya cermin, supaya agent tidak mencari-cari field yang
                dipikirnya hilang dan tidak ada dua tempat yang bisa berbeda. */}
            {isKos && (
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.08] p-4">
                <div className="mb-3 flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-emerald-400/40 bg-emerald-400/20">
                    <Layers className="h-4 w-4 text-emerald-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base font-bold text-white">
                      {adaTipeKamar
                        ? `${ringkasanTipe.jumlahTipe} tipe kamar · ${ringkasanTipe.totalKamar} kamar`
                        : `${watch('total_kamar') ?? 0} kamar · semua sama`}
                    </h4>
                    <p className="mt-1 text-xs text-slate-400">
                      Jumlah, ukuran, kamar mandi, harga &amp; fasilitas kamar diatur
                      di step{' '}
                      <span className="font-bold text-slate-200">Kamar &amp; Harga</span>.
                      Di sini tinggal peruntukan, tagihan &amp; peraturan.
                    </p>
                  </div>
                </div>

                <ul className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
                  {ringkasanBarisKamar.map((b, i) => (
                    <li
                      key={i}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-black/30 px-4 py-3"
                    >
                      <span className="text-sm font-bold text-white">{b.nama}</span>
                      <span className="text-xs font-bold text-emerald-300">
                        {b.tersedia}/{b.jumlah} kosong
                      </span>
                      {b.detail.length > 0 && (
                        <span className="text-xs text-slate-400">
                          {b.detail.join(' · ')}
                        </span>
                      )}
                      {b.harga != null && (
                        <span className="ml-auto text-xs font-bold text-slate-200">
                          Rp {b.harga.toLocaleString('id-ID')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sewa non-kos (apartemen, rumah, ruko): yang disewa adalah unit
                UTUH, jadi yang perlu ditanyakan cuma batas jumlah penghuninya —
                pertanyaan pertama di Booking/Agoda ("berapa tamu?").

                Sebelumnya di sini ada "Ukuran Kamar" & "Kamar Mandi Dalam/Luar".
                Keduanya isian berbentuk kos yang salah tempat untuk unit utuh:
                ukuran unit sudah diisi sebagai Luas Unit di atas, dan kamar
                mandi unit sudah dihitung jumlahnya — "dalam atau luar" tidak
                punya arti untuk apartemen. */}
            {!isKos && (
            <div className="grid gap-6 md:max-w-sm">
              <FormField
                label="Kapasitas Penghuni"
                error={errors.kapasitas_penghuni?.message}
                description="Batas jumlah orang yang boleh menempati unit"
              >
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  <div className="relative flex items-center">
                    <div className="absolute left-4">
                      <Users className="h-4 w-4 text-emerald-400" />
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="4"
                      {...register('kapasitas_penghuni', {
                        setValueAs: toNumericOrUndefined,
                      })}
                      onInput={handleNumericInputNoLeadingZero}
                      className={cn(
                        'w-full h-14 pl-12 pr-16 rounded-xl text-base font-semibold text-slate-100',
                        'bg-slate-900/50 border-2 border-slate-800',
                        'focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
                        'transition-all duration-300 placeholder:text-slate-600',
                      )}
                    />
                    <div className="absolute right-4 text-slate-400 text-sm font-semibold">
                      orang
                    </div>
                  </div>
                </div>
              </FormField>
            </div>
            )}

            {/* Peruntukan & akses masuk.
                KHUSUS KOS keduanya SEBARIS. Dua-duanya pertanyaan tentang
                "siapa yang boleh tinggal & kapan boleh masuk", jawabannya
                sama-sama pendek, dan sebelumnya masing-masing memakan satu
                baris penuh — tiga kartu radio selebar form untuk satu kata.
                Digabung begini, keduanya terbaca sekali pandang.

                Untuk sewa non-kos, "termasuk listrik/air" ikut di baris ini.
                Pada kos kedua toggle itu pindah ke step "Kamar & Harga" karena
                keduanya mengubah ARTI angka harga, jadi tempatnya menempel
                dengan harganya. */}
            {isKos ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Gender Kos"
                  required
                  error={errors.kos_gender?.message}
                  description="Diperuntukkan untuk penghuni yang mana"
                >
                  <GenderKosSelect
                    value={watch('kos_gender') ?? null}
                    onChange={(v) =>
                      setValue('kos_gender', v, { shouldValidate: true })
                    }
                    error={errors.kos_gender?.message}
                  />
                </FormField>

                <FormField
                  label="Akses 24 Jam?"
                  description="Penghuni bisa keluar-masuk kapan saja"
                >
                  <YesNoToggle
                    value={akses24Jam}
                    onChange={(v) => {
                      setValue('akses_24_jam', v, { shouldValidate: true });
                      if (v) setValue('jam_malam', undefined as any);
                    }}
                    icon={<Clock className="h-4 w-4" />}
                    tinggi="lg"
                  />
                </FormField>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label="Termasuk Listrik?">
                  <YesNoToggle
                    value={termasukListrik}
                    onChange={(v) =>
                      setValue('termasuk_listrik', v, { shouldValidate: true })
                    }
                    icon={<Zap className="h-4 w-4" />}
                  />
                </FormField>

                <FormField label="Termasuk Air?">
                  <YesNoToggle
                    value={termasukAir}
                    onChange={(v) =>
                      setValue('termasuk_air', v, { shouldValidate: true })
                    }
                    icon={<Droplets className="h-4 w-4" />}
                  />
                </FormField>

                <FormField label="Akses 24 Jam?">
                  <YesNoToggle
                    value={akses24Jam}
                    onChange={(v) => {
                      setValue('akses_24_jam', v, { shouldValidate: true });
                      if (v) setValue('jam_malam', undefined as any);
                    }}
                    icon={<Clock className="h-4 w-4" />}
                  />
                </FormField>
              </div>
            )}

            <AnimatePresence>
              {akses24Jam === false && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <FormField label="Jam Malam">
                    <div className="relative w-full sm:w-40">
                      <Clock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
                      <input
                        type="text"
                        inputMode="numeric"
                        value={watch('jam_malam') || ''}
                        onChange={(e) =>
                          setValue('jam_malam', formatJam(e.target.value), {
                            shouldValidate: true,
                          })
                        }
                        placeholder="22:00"
                        aria-label="Jam malam"
                        className={cn(
                          'h-11 w-full rounded-lg pl-10 pr-4 text-sm font-bold tracking-wide text-slate-100',
                          'bg-slate-900/60 border border-slate-700',
                          'focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
                          'placeholder:font-medium placeholder:tracking-normal placeholder:text-slate-600',
                        )}
                      />
                    </div>
                  </FormField>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Jam check-in/out — muncul hanya kalau ada harga harian atau
                mingguan. Untuk kontrak bulanan/tahunan pertanyaan ini tidak
                pernah ditanyakan penyewa, jadi menampilkannya di semua listing
                cuma menambah dua kotak kosong yang harus dilewati. */}
            <AnimatePresence>
              {adaSewaJangkaPendek && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <FormField
                    label="Jam Check-in & Check-out"
                    description="Anda menawarkan sewa harian/mingguan"
                  >
                    <div className="flex flex-wrap gap-3">
                      {[
                        {
                          name: 'jam_check_in' as const,
                          label: 'Check-in mulai',
                          placeholder: '14:00',
                          icon: <LogIn className="h-4 w-4 text-emerald-400" />,
                        },
                        {
                          name: 'jam_check_out' as const,
                          label: 'Check-out sebelum',
                          placeholder: '12:00',
                          icon: <LogOut className="h-4 w-4 text-amber-400" />,
                        },
                      ].map((f) => (
                        <div key={f.name} className="w-full sm:w-44">
                          <span className="mb-1.5 block text-xs font-semibold text-slate-400">
                            {f.label}
                          </span>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                              {f.icon}
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={watch(f.name) || ''}
                              onChange={(e) =>
                                setValue(f.name, formatJam(e.target.value), {
                                  shouldValidate: true,
                                })
                              }
                              placeholder={f.placeholder}
                              aria-label={f.label}
                              className={cn(
                                'h-11 w-full rounded-lg pl-10 pr-4 text-sm font-bold tracking-wide text-slate-100',
                                'border border-slate-700 bg-slate-900/60',
                                'focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
                                'placeholder:font-medium placeholder:tracking-normal placeholder:text-slate-600',
                              )}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </FormField>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Fasilitas dipisah menurut cakupannya: milik kamar vs milik
                gedung. Untuk KOS keduanya sudah diisi di step "Kamar & Harga"
                — menempel dengan kamarnya, karena di situlah pemilik
                memikirkannya. Di sini hanya untuk sewa non-kos. */}
            {!isKos && (
              <>
                <FormField
                  label={isApartemen ? 'Fasilitas di Dalam Unit' : 'Fasilitas Kamar'}
                  description={
                    isApartemen
                      ? 'Yang sudah tersedia di dalam unit saat penyewa masuk'
                      : 'Yang didapat penyewa di dalam kamarnya sendiri'
                  }
                >
                  <FacilityMultiSelect
                    options={FASILITAS_KAMAR_OPTIONS}
                    value={fasilitasKamar}
                    onChange={(next) => setChips('fasilitas_kamar', next)}
                    placeholder="Pilih fasilitas kamar…"
                    searchPlaceholder="Cari: AC, kasur, lemari…"
                    ariaLabel="Fasilitas Kamar"
                  />
                </FormField>

                <FormField
                  label={isApartemen ? 'Fasilitas Gedung' : 'Fasilitas Bersama'}
                  description={
                    isApartemen
                      ? 'Fasilitas gedung yang bisa dipakai penghuni (kolam renang, gym, parkir…)'
                      : 'Dipakai bersama seluruh penghuni'
                  }
                >
                  <FacilityMultiSelect
                    options={FASILITAS_BERSAMA_OPTIONS}
                    value={fasilitasBersama}
                    onChange={(next) => setChips('fasilitas_bersama', next)}
                    placeholder="Pilih fasilitas bersama…"
                    searchPlaceholder="Cari: wifi, dapur, parkir…"
                    ariaLabel="Fasilitas Bersama"
                  />
                </FormField>
              </>
            )}

            <FormField
              label="Peraturan"
              description="Deklarasikan di awal supaya tidak jadi masalah belakangan (opsional)"
            >
              <FacilityMultiSelect
                options={PERATURAN_OPTIONS}
                value={peraturan}
                onChange={(next) => setChips('peraturan', next)}
                placeholder={isKos ? 'Pilih peraturan kos…' : 'Pilih peraturan…'}
                searchPlaceholder="Cari peraturan…"
                ariaLabel="Peraturan"
              />
            </FormField>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Tambahan — hadap bangunan itu pertimbangan orang BELI rumah,
          bukan nyewa kamar kos. Disembunyikan untuk KOS. */}
      {!isKos && (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
            <Compass className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">
              Detail Tambahan
            </h3>
            <p className="text-xs text-slate-500">
              Informasi pelengkap property
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Hadap Bangunan */}
          <FormField
            label="Hadap Bangunan"
            error={errors.hadap_bangunan?.message}
          >
            <div className="group">
              <PremiumSelect
                value={hadapBangunan ?? ''}
                onChange={(v) =>
                  setValue('hadap_bangunan', v, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                options={HADAP_SELECT_OPTIONS}
                placeholder="Pilih Arah"
                accent="indigo"
                ariaLabel="Hadap Bangunan"
                leadingIcon={<Compass className="h-4 w-4" />}
              />
            </div>
          </FormField>

          {/* Kondisi Interior */}
          <FormField
            label="Kondisi Interior"
            error={errors.kondisi_interior?.message}
          >
            <div className="group">
              <PremiumSelect
                value={kondisiInterior ?? ''}
                onChange={(v) =>
                  setValue('kondisi_interior', v, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                options={KONDISI_SELECT_OPTIONS}
                placeholder="Pilih Kondisi"
                accent="rose"
                ariaLabel="Kondisi Interior"
                leadingIcon={<Sofa className="h-4 w-4" />}
              />
            </div>
          </FormField>
        </div>
      </div>
      )}

      {/* Legalitas — hanya untuk transaksi JUAL & LELANG. Penyewa tidak
          membeli hak atas tanahnya, jadi sertifikat bukan bagian dari
          keputusannya; Travelio/Booking/Agoda pun tidak pernah menanyakannya.
          Menyimpannya sebagai isian wajib di listing sewa hanya menahan agent
          di depan field yang tidak akan pernah ditampilkan ke penyewa. */}
      {!isSewa && !isKos && (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <Shield className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">
              Legalitas Property
            </h3>
            <p className="text-xs text-slate-500">
              Dokumen dan sertifikat resmi
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 items-start">
          {/* Jenis Sertifikat — tidak wajib untuk Kos */}
          <FormField
            label="Jenis Sertifikat"
            required={!isKos}
            error={errors.legalitas?.message}
          >
            <div className="group">
              <PremiumSelect
                value={legalitas ?? ''}
                onChange={(v) =>
                  setValue('legalitas', v as ListingFormData['legalitas'], {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                options={SERTIFIKAT_SELECT_OPTIONS}
                placeholder="Pilih Sertifikat"
                accent="amber"
                ariaLabel="Jenis Sertifikat"
                leadingIcon={<FileText className="h-4 w-4" />}
              />
            </div>
          </FormField>

          {/* Nomor Sertifikat (boleh leading zero) */}
          <FormField
            label="Nomor Sertifikat"
            error={errors.nomor_legalitas?.message}
          >
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex items-center">
                <input
                  {...register('nomor_legalitas')}
                  placeholder="001234/2023"
                  className={cn(
                    'w-full h-14 pl-4 pr-10 rounded-xl text-base font-semibold text-slate-100',
                    'bg-slate-900/50 border-2 border-slate-800',
                    'focus:border-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20',
                    'transition-all duration-300',
                    'placeholder:text-slate-600',
                  )}
                />
                {nomorLegalitas && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-3"
                  >
                    <CheckCircle2 className="h-5 w-5 text-orange-500" />
                  </motion.div>
                )}
              </div>
            </div>
          </FormField>
        </div>
      </div>
      )}

      {/* Success Indicator — dihitung dari 11 field jual (termasuk luas tanah &
          sertifikat), jadi hanya bermakna untuk listing jual/lelang. Untuk
          sewa & kos sebagian field itu memang tidak ditampilkan, sehingga
          100% mustahil tercapai dan indikatornya cuma jadi janji kosong. */}
      {!isSewa && !isKos && completionPercentage === 100 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 p-4"
        >
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            </motion.div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-400">
                ✨ Semua spesifikasi sudah lengkap!
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Property Anda siap untuk tahap berikutnya
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { ListingFormData } from '@/lib/validations/listing';
import { Textarea } from '@/components/ui/textarea';
import { ImageUploader } from '../ImageUploader';
import { JudulOtomatis } from '../JudulOtomatis';
import { generateSlug } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ImageIcon,
  Sparkles,
  Star,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  KATEGORI_OPTIONS,
  DURASI_SEWA_OPTIONS,
  DURASI_SATUAN_LABEL,
  AKSES_TIPE_OPTIONS,
  type AksesTerdekat,
} from '@/app/tambah-property/types/listing';

/**
 * `file` boleh null/absen: saat EDIT listing, foto yang sudah tersimpan hanya
 * punya URL (`preview`) tanpa File. Sebelumnya tipe di sini menuntut `File`
 * sehingga tidak cocok dengan tipe di ImageUploader & halaman induk — dua tipe
 * bernama sama yang tidak kompatibel.
 */
interface ImageFile {
  id: string;
  file?: File | null;
  preview: string;
}

/**
 * Kepala bagian di langkah terakhir.
 *
 * Versi sebelumnya memakai kotak ikon 40px + judul `text-lg` + keterangan,
 * berdiri sendiri di atas jarak 24px — empat kali, untuk empat bagian yang
 * semuanya sudah jelas dari isinya. Di sini ikonnya 32px, judulnya `text-sm`,
 * dan nomornya yang menjelaskan urutan. Yang hilang cuma ruangnya.
 */
function KepalaBagian({
  nomor,
  ikon,
  warna,
  judul,
  desc,
  kanan,
}: {
  nomor: number;
  ikon: React.ReactNode;
  /** Gradien kotak ikon — ditulis lengkap supaya pasti digenerate Tailwind. */
  warna: string;
  judul: string;
  desc: string;
  kanan?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          'grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br',
          warna,
        )}
      >
        {ikon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5">
          <span className="text-[10px] font-black tabular-nums text-slate-600">
            {nomor}
          </span>
          <span className="truncate text-sm font-bold text-slate-100">{judul}</span>
        </span>
        <span className="block truncate text-[11px] text-slate-500">{desc}</span>
      </span>
      {kanan}
    </div>
  );
}

/**
 * Warna per gaya deskripsi.
 *
 * Ditulis utuh, BUKAN dirakit `'text-' + color + '-400'` seperti sebelumnya:
 * Tailwind memindai kode sebagai teks dan tidak pernah melihat kelas yang
 * dirakit saat runtime, jadi keempat kartu gaya itu sebenarnya selalu tampil
 * tanpa warna sama sekali — bug yang tidak pernah memunculkan error apa pun.
 */
const GAYA_TEMPLATE: Record<string, { teks: string; border: string }> = {
  emerald: { teks: 'text-emerald-400', border: 'hover:border-emerald-500/50' },
  blue: { teks: 'text-blue-400', border: 'hover:border-blue-500/50' },
  orange: { teks: 'text-orange-400', border: 'hover:border-orange-500/50' },
  purple: { teks: 'text-purple-400', border: 'hover:border-purple-500/50' },
};

interface Step5Props {
  form: UseFormReturn<ListingFormData>;
  images: ImageFile[];
  onImagesChange: (images: ImageFile[]) => void;
  isEditMode?: boolean;
  /** Langkah ini sedang ditampilkan — diteruskan ke penyusun judul. */
  aktif?: boolean;
}

export function Step5Media({
  form,
  images,
  onImagesChange,
  isEditMode = false,
  aktif = false,
}: Step5Props) {
  const { watch, setValue, getValues, formState: { errors } } = form;
  const [isGenerating, setIsGenerating] = useState(false);

  const deskripsi = watch('deskripsi') || '';
  const judulProperty = watch('judul') || '';
  const kategori = watch('kategori') || '';
  /**
   * Label jenis properti untuk kalimat deskripsi ("Rumah Bersertifikat SHM
   * di ..."). Diturunkan dari `kategori`, bukan dari field terpisah: dulu ini
   * membaca `tipe_property` yang tidak punya kolom di DB dan tidak punya input
   * pengisi, sehingga template SELALU jatuh ke kata generik "Property".
   */
  const tipeProperty =
    KATEGORI_OPTIONS.find((k) => k.value === kategori)?.label || '';
  const jenisTransaksi = watch('jenis_transaksi') || '';
  const luasTanah = watch('luas_tanah');
  const luasBangunan = watch('luas_bangunan');
  const jumlahLantai = watch('jumlah_lantai');
  const kamarTidur = watch('kamar_tidur');
  const kamarMandi = watch('kamar_mandi');
  const dayaListrik = watch('daya_listrik');
  const sumberAir = watch('sumber_air');
  const hadapBangunan = watch('hadap_bangunan');
  const kondisiInterior = watch('kondisi_interior');
  const legalitas = watch('legalitas');
  const nomorLegalitas = watch('nomor_legalitas');
  const harga = watch('harga');
  const hargaPromo = watch('harga_promo');
  const nilaiLimitLelang = watch('nilai_limit_lelang');
  const alamat = watch('alamat_lengkap');
  const kota = watch('kota');
  const isSewa = jenisTransaksi === 'SEWA';
  const isKos = kategori === 'KOS';
  const isHotDeal = !!watch('is_hot_deal');

  // Dipakai perakit judul otomatis (bukan template deskripsi) — nama daerah,
  // identitas unit apartemen, tipe kamar kos & jadwal lelang semuanya jadi
  // bahan judul yang faktual.
  const kecamatan = watch('kecamatan');
  const kelurahan = watch('kelurahan');
  const tipeUnit = watch('tipe_unit');
  const namaGedung = watch('nama_gedung');
  const kamarTipe = watch('kamar_tipe');
  const tanggalLelang = watch('tanggal_lelang');

  // --- Data khusus SEWA (tersimpan di ListingSewaDetail) ---
  const durasiSewa = watch('durasi_sewa');
  const hargaSewaHarian = watch('harga_sewa_harian');
  const hargaSewaMingguan = watch('harga_sewa_mingguan');
  const hargaSewaBulanan = watch('harga_sewa_bulanan');
  const hargaSewaTahunan = watch('harga_sewa_tahunan');
  const minimalSewaJumlah = watch('minimal_sewa_jumlah');
  const minimalSewaSatuan = watch('minimal_sewa_satuan');
  const deposit = watch('deposit');
  const luasKamar = watch('luas_kamar');
  const kamarMandiTipe = watch('kamar_mandi_tipe');
  const termasukListrik = watch('termasuk_listrik');
  const termasukAir = watch('termasuk_air');
  const akses24Jam = watch('akses_24_jam');
  const jamMalam = watch('jam_malam');
  const kosGender = watch('kos_gender');
  const kapasitasPenghuni = watch('kapasitas_penghuni');
  const totalKamar = watch('total_kamar');
  const kamarTersedia = watch('kamar_tersedia');
  const fasilitasKamarRaw = watch('fasilitas_kamar');
  const fasilitasBersamaRaw = watch('fasilitas_bersama');
  const peraturanRaw = watch('peraturan');

  // ---------------------------------------------------------------------
  // Slug mengikuti judul. Dulu efek ini tinggal di Step 1 bersama kolom
  // judulnya; sekarang judul dirakit di step ini, jadi efeknya ikut pindah.
  // Aman karena semua step selalu ter-mount (hanya disembunyikan), bukan
  // di-unmount saat berpindah — jadi tidak ada perubahan judul yang lolos.
  // ---------------------------------------------------------------------
  const slugSuffixRef = useRef(Math.random().toString(36).substring(2, 7));
  const slugTerakhirOtomatisRef = useRef<string | null>(null);

  useEffect(() => {
    if (!judulProperty) return;

    // Slug yang sudah ada dan BUKAN hasil generate efek ini berarti milik
    // listing yang sudah tayang (mode edit, diisi dari DB) — jangan disentuh.
    // Tanpa penjaga ini, membuka form edit saja sudah mengganti slug dengan
    // suffix acak baru, sehingga URL listing berubah tiap kali disimpan dan
    // semua tautan yang sudah tersebar (WhatsApp, Google) kehilangan alamat.
    const slugSekarang = getValues('slug');
    if (slugSekarang && slugSekarang !== slugTerakhirOtomatisRef.current) return;

    const slug = generateSlug(judulProperty) + '-' + slugSuffixRef.current;
    slugTerakhirOtomatisRef.current = slug;
    setValue('slug', slug);
  }, [judulProperty, setValue, getValues]);

  const parseList = (raw?: string | null) =>
    raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];

  // Patokan lokasi — hanya baris yang namanya terisi yang dipakai
  const aksesTerdekat = ((watch('akses_terdekat') ?? []) as AksesTerdekat[]).filter(
    (a) => a?.nama?.trim(),
  );

  /** "5 menit ke UNAIR" / "dekat Stasiun Gubeng" (kalau jarak tidak diisi) */
  const aksesKalimat = (a: AksesTerdekat) => {
    const nama = a.nama.trim();
    if (!a.jarak) return `dekat ${nama}`;
    const satuan = a.satuan === 'KM' ? 'km' : 'menit';
    return `${a.jarak} ${satuan} ke ${nama}`;
  };

  const aksesBaris = (a: AksesTerdekat) => {
    const label = AKSES_TIPE_OPTIONS.find((t) => t.value === a.tipe)?.label ?? 'Lokasi';
    const jarak = a.jarak
      ? ` — ${a.jarak} ${a.satuan === 'KM' ? 'km' : 'menit'}`
      : '';
    return `• ${label}: ${a.nama.trim()}${jarak}`;
  };

  // Calculate completion status
  const hasEnoughImages = images.length >= 3;
  const hasGoodDescription = deskripsi.length >= 100;
  const hasTitle = judulProperty.length > 0;
  const completionScore = [hasEnoughImages, hasGoodDescription, hasTitle].filter(Boolean).length;

  // Format harga untuk template.
  // Dulu pakai .toFixed(0) untuk jutaan → Rp 1.200.000 tertulis "1 Juta" dan
  // Rp 1.750.000 jadi "2 Juta". Untuk harga sewa kos (kisaran 800rb–3jt) selisih
  // itu menyesatkan, jadi sekarang pakai 1 desimal + koma ala Indonesia.
  const formatHarga = (harga?: number) => {
    if (!harga) return '';
    const ringkas = (n: number, satuan: string) =>
      `${n.toFixed(1).replace(/\.0$/, '').replace('.', ',')} ${satuan}`;
    if (harga >= 1000000000) return ringkas(harga / 1000000000, 'Miliar');
    if (harga >= 1000000) return ringkas(harga / 1000000, 'Juta');
    return harga.toLocaleString('id-ID');
  };

  // Untuk sewa, nominal penuh lebih dipercaya penyewa daripada dibulatkan
  // ("Rp 1.200.000 /bulan" vs "Rp 1,2 Juta /bulan").
  const formatRupiahPenuh = (n: number) => n.toLocaleString('id-ID');

  // Get action text based on jenis_transaksi
  const getActionText = () => {
    if (jenisTransaksi === 'SEWA') return 'DISEWAKAN';
    if (jenisTransaksi === 'LELANG') return 'DILELANG';
    // PRIMARY atau SECONDARY
    return 'DIJUAL';
  };

  // Get current month and year
  const getCurrentMonthYear = () => {
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const now = new Date();
    return `${months[now.getMonth()]} ${now.getFullYear()}`;
  };

  // AI Description Templates REAL - hanya berdasarkan data input
  const generateSmartDescription = (template: 'professional' | 'detailed' | 'concise' | 'family') => {
    setIsGenerating(true);
    
    setTimeout(() => {
      let description = '';
      const actionText = getActionText();
      const isLelang = jenisTransaksi === 'LELANG';
      
      // Build specs array
      const specs = [];
      if (luasTanah) specs.push(`Luas Tanah: ${luasTanah} m²`);
      if (luasBangunan) specs.push(`Luas Bangunan: ${luasBangunan} m²`);
      if (jumlahLantai) specs.push(`${jumlahLantai} Lantai`);
      if (kamarTidur) specs.push(`${kamarTidur} Kamar Tidur`);
      if (kamarMandi) specs.push(`${kamarMandi} Kamar Mandi`);
      if (dayaListrik) specs.push(`Listrik ${dayaListrik} VA`);
      if (sumberAir) specs.push(`Sumber Air: ${sumberAir}`);
      if (hadapBangunan) specs.push(`Menghadap: ${hadapBangunan}`);
      if (kondisiInterior) specs.push(`Kondisi: ${kondisiInterior}`);
      if (legalitas) specs.push(`Sertifikat: ${legalitas}`);

      // Helper harga sesuai jenis transaksi
      const hargaDisplay = isLelang
        ? nilaiLimitLelang ? `💰 Nilai Limit Lelang: Rp ${formatHarga(Number(nilaiLimitLelang))}` : ''
        : harga
          ? isSewa
            ? `💰 Harga Sewa: Rp ${formatHarga(Number(harga))} / tahun${hargaPromo ? `\n💸 Harga Promo: Rp ${formatHarga(Number(hargaPromo))} / tahun` : ''}`
            : `💰 Harga: Rp ${formatHarga(Number(harga))}${hargaPromo ? `\n💸 Harga Promo: Rp ${formatHarga(Number(hargaPromo))}` : ''}`
          : '';

      // ------------------------------------------------------------------
      // TEMPLATE KHUSUS SEWA (kos/apartemen/rumah kontrakan)
      // Template lama memakai luas tanah, daya listrik, sertifikat dsb yang
      // untuk KOS memang sengaja tidak diisi — hasilnya deskripsi kosong.
      // Cabang ini memakai data sewa yang sebenarnya: harga per durasi,
      // minimal sewa, deposit, detail kamar, fasilitas & peraturan.
      // ------------------------------------------------------------------
      if (isSewa) {
        const unitLabel =
          KATEGORI_OPTIONS.find((k) => k.value === kategori)?.label || 'Hunian';
        const genderLabel = kosGender
          ? { PUTRA: 'Putra', PUTRI: 'Putri', CAMPUR: 'Campur' }[kosGender]
          : '';
        const judulUnit = isKos && genderLabel ? `Kos ${genderLabel}` : unitLabel;

        // Daftar harga semua durasi yang ditawarkan (bukan cuma harga utama)
        const hargaPerDurasi = DURASI_SEWA_OPTIONS.map((d) => {
          const nilai = {
            HARIAN: hargaSewaHarian,
            MINGGUAN: hargaSewaMingguan,
            BULANAN: hargaSewaBulanan,
            TAHUNAN: hargaSewaTahunan,
          }[d.value];
          if (nilai == null || Number(nilai) <= 0) return null;
          const utama = durasiSewa === d.value ? ' ⭐' : '';
          return `• ${d.label}: Rp ${formatRupiahPenuh(Number(nilai))} ${d.suffix}${utama}`;
        }).filter(Boolean) as string[];

        const syaratBooking: string[] = [];
        if (minimalSewaJumlah && minimalSewaSatuan) {
          const satuan = DURASI_SATUAN_LABEL[minimalSewaSatuan].toLowerCase();
          syaratBooking.push(`Minimal sewa ${minimalSewaJumlah} ${satuan}`);
        }
        if (deposit && Number(deposit) > 0) {
          syaratBooking.push(`Deposit Rp ${formatRupiahPenuh(Number(deposit))} (dikembalikan)`);
        }

        // Detail kamar — hanya yang benar-benar diisi
        const detailKamar: string[] = [];
        if (luasKamar) detailKamar.push(`Ukuran kamar ${luasKamar} m²`);
        if (kamarMandiTipe)
          detailKamar.push(
            kamarMandiTipe === 'DALAM' ? 'Kamar mandi dalam' : 'Kamar mandi luar (bersama)',
          );
        if (kapasitasPenghuni)
          detailKamar.push(`Maksimal ${kapasitasPenghuni} orang per kamar`);
        if (totalKamar) detailKamar.push(`Total ${totalKamar} kamar`);
        if (kamarTersedia != null)
          detailKamar.push(
            kamarTersedia === 0
              ? 'Kamar sedang penuh'
              : `Sisa ${kamarTersedia} kamar kosong`,
          );
        if (termasukListrik === true && termasukAir === true)
          detailKamar.push('Listrik & air sudah termasuk harga sewa');
        else {
          if (termasukListrik === true) detailKamar.push('Listrik sudah termasuk');
          if (termasukListrik === false) detailKamar.push('Listrik bayar sendiri');
          if (termasukAir === true) detailKamar.push('Air sudah termasuk');
          if (termasukAir === false) detailKamar.push('Air bayar sendiri');
        }
        if (akses24Jam === true) detailKamar.push('Akses 24 jam');
        if (akses24Jam === false)
          detailKamar.push(jamMalam ? `Jam malam pukul ${jamMalam}` : 'Ada jam malam');

        const fKamar = parseList(fasilitasKamarRaw);
        const fBersama = parseList(fasilitasBersamaRaw);
        const aturan = parseList(peraturanRaw);
        const lokasiText = alamat || 'lokasi strategis';

        // Blok patokan lokasi (bullet) + versi kalimat untuk hook pembuka
        const blokAkses = aksesTerdekat.length
          ? `📍 AKSES TERDEKAT\n${aksesTerdekat.map(aksesBaris).join('\n')}\n`
          : '';
        const aksesRingkas = aksesTerdekat.slice(0, 2).map(aksesKalimat).join(', ');

        // Kalimat pembuka ala Airbnb/Mamikos — dirangkai dari data yang ada,
        // bukan kalimat generik. Kalau data minim, hook otomatis memendek.
        const unggulan = fKamar.slice(0, 3).map((f) => f.toLowerCase());
        const buildHook = () => {
          const bagian: string[] = [];
          bagian.push(
            isKos
              ? `${judulUnit} siap huni${kota ? ` di ${kota}` : ''}`
              : `${judulUnit} disewakan${kota ? ` di ${kota}` : ''}`,
          );
          if (aksesRingkas) bagian.push(`cuma ${aksesRingkas}`);
          if (unggulan.length) bagian.push(`kamar sudah lengkap dengan ${unggulan.join(', ')}`);
          return `${bagian.join(' — ')}.`;
        };
        const hook = buildHook();

        switch (template) {
          case 'professional':
            description = `DISEWAKAN — ${judulUnit}${alamat ? ` di ${alamat}` : ''}

${hook}

${hargaPerDurasi.length ? `💰 HARGA SEWA\n${hargaPerDurasi.join('\n')}\n` : ''}${syaratBooking.length ? `${syaratBooking.join(' · ')}\n` : ''}
${blokAkses ? `${blokAkses}\n` : ''}${detailKamar.length ? `🛏 DETAIL KAMAR\n${detailKamar.map((d) => `• ${d}`).join('\n')}\n` : ''}
${fKamar.length ? `✨ FASILITAS KAMAR\n${fKamar.join(', ')}\n` : ''}
${fBersama.length ? `🏠 FASILITAS BERSAMA\n${fBersama.join(', ')}\n` : ''}
${aturan.length ? `📋 PERATURAN\n${aturan.join(', ')}\n` : ''}
Hubungi kami untuk survei lokasi & cek ketersediaan kamar.`;
            break;

          case 'detailed':
            description = `${judulUnit.toUpperCase()} DISEWAKAN — ${getCurrentMonthYear()}

${hook}

📍 LOKASI
${lokasiText}
${blokAkses ? `\n${blokAkses}` : ''}
💰 PILIHAN HARGA SEWA
${hargaPerDurasi.length ? hargaPerDurasi.join('\n') : 'Hubungi kami untuk informasi harga'}
${syaratBooking.length ? `\n📝 SYARAT BOOKING\n${syaratBooking.map((s) => `• ${s}`).join('\n')}\n` : ''}
${detailKamar.length ? `🛏 SPESIFIKASI KAMAR\n${detailKamar.map((d) => `• ${d}`).join('\n')}\n` : ''}
${fKamar.length ? `✨ FASILITAS DALAM KAMAR\n${fKamar.map((f) => `• ${f}`).join('\n')}\n` : ''}
${fBersama.length ? `🏠 FASILITAS BERSAMA\n${fBersama.map((f) => `• ${f}`).join('\n')}\n` : ''}
${aturan.length ? `📋 PERATURAN ${isKos ? 'KOS' : 'HUNIAN'}\n${aturan.map((p) => `• ${p}`).join('\n')}\n` : ''}
${isKos ? 'Kos ini cocok untuk mahasiswa maupun karyawan yang mencari hunian nyaman dengan akses mudah.' : 'Hunian siap huni dengan lokasi strategis.'}

Silakan hubungi kami untuk jadwal survei dan informasi ketersediaan kamar.`;
            break;

          case 'concise':
            description = `${judulUnit} disewakan${alamat ? ` — ${alamat}` : ''}
${aksesRingkas ? `📍 ${aksesRingkas}\n` : ''}
${hargaPerDurasi.length ? `${hargaPerDurasi.join('\n')}\n` : ''}${syaratBooking.length ? `${syaratBooking.join(' · ')}\n` : ''}
${detailKamar.length ? `${detailKamar.map((d) => `✓ ${d}`).join('\n')}\n` : ''}
${fKamar.length ? `✓ Fasilitas kamar: ${fKamar.join(', ')}\n` : ''}${fBersama.length ? `✓ Fasilitas bersama: ${fBersama.join(', ')}\n` : ''}${aturan.length ? `✓ ${aturan.join(' · ')}\n` : ''}
Chat sekarang untuk cek kamar kosong!`;
            break;

          case 'family':
            description = `${judulUnit}${alamat ? ` di ${lokasiText}` : ''} — siap huni!

${hook}
${aksesRingkas ? `\nLokasinya strategis: ${aksesRingkas}.\n` : ''}

${hargaPerDurasi.length ? `Harga sewa:\n${hargaPerDurasi.join('\n')}\n` : ''}${syaratBooking.length ? `${syaratBooking.join(' · ')}\n` : ''}
${detailKamar.length ? `Yang kamu dapat:\n${detailKamar.map((d) => `• ${d}`).join('\n')}\n` : ''}
${fKamar.length ? `Di dalam kamar sudah ada ${fKamar.join(', ').toLowerCase()}.\n` : ''}${fBersama.length ? `Fasilitas bersama: ${fBersama.join(', ').toLowerCase()}.\n` : ''}
${aturan.length ? `Peraturan: ${aturan.join(', ').toLowerCase()}.\n` : ''}
Yuk hubungi kami untuk lihat kamarnya langsung — kamar terbatas!`;
            break;
        }
      }
      // TEMPLATE KHUSUS LELANG
      else if (isLelang) {
        switch (template) {
          case 'professional':
            description = `🔨 SEGERA ${actionText.toUpperCase()}, ${getCurrentMonthYear()} 🔨

📍 ${tipeProperty || 'Property'} ${legalitas || 'Bersertifikat'}${alamat ? ` di ${alamat}` : ''}

SPESIFIKASI:
${specs.map(s => `• ${s}`).join('\n')}

${legalitas && nomorLegalitas ? `LEGALITAS:\n• Sertifikat ${legalitas}\n• No. ${nomorLegalitas}\n\n` : ''}${hargaDisplay ? `${hargaDisplay}\n\n` : ''}🎯 Kenapa Beli Lelang Lebih Menarik?

✓ Harga jauh di bawah pasar → lebih murah dibanding property primary & second
✓ Potensi capital gain tinggi → bisa dijual kembali sesuai harga pasar
✓ Cara paling aman untuk beli property
✓ Pilihan tepat untuk investasi cerdas

Hubungi kami untuk informasi lengkap & proses lelang!`;
            break;

          case 'detailed':
            description = `🔨 ${actionText.toUpperCase()} - ${tipeProperty || 'Property'} ${getCurrentMonthYear()} 🔨

📍 LOKASI:
${alamat || 'Lokasi strategis'}

📋 DETAIL PROPERTY:

Dimensi & Struktur:
${luasTanah ? `- Luas Tanah: ${luasTanah} m²` : ''}
${luasBangunan ? `- Luas Bangunan: ${luasBangunan} m²` : ''}
${jumlahLantai ? `- Jumlah Lantai: ${jumlahLantai}` : ''}

Fasilitas:
${kamarTidur !== undefined && kamarTidur !== null ? `- Kamar Tidur: ${kamarTidur}` : ''}
${kamarMandi !== undefined && kamarMandi !== null ? `- Kamar Mandi: ${kamarMandi}` : ''}
${dayaListrik ? `- Daya Listrik: ${dayaListrik} VA` : ''}
${sumberAir ? `- Sumber Air: ${sumberAir}` : ''}

${hadapBangunan ? `Orientasi: ${hadapBangunan}\n` : ''}${kondisiInterior ? `Kondisi: ${kondisiInterior}\n` : ''}
${legalitas ? `📜 LEGALITAS:\n- Tipe Hak: ${legalitas}${nomorLegalitas ? `\n- Nomor: ${nomorLegalitas}` : ''}\n` : ''}
${hargaDisplay ? `${hargaDisplay}\n` : ''}
🎯 KEUNGGULAN LELANG:

✅ Harga Di Bawah Pasar
Dapatkan property dengan harga jauh lebih murah dibanding harga market. Hemat hingga 20-30% dari harga normal!

✅ Potensi Untung Besar
Beli dengan harga lelang, jual dengan harga pasar. Capital gain yang menguntungkan untuk investasi Anda.

✅ Proses Legal & Aman
Semua dokumen dijamin legal dan proses lelang diawasi resmi. Investasi property paling aman!

✅ Cocok untuk Investasi
Baik untuk hunian maupun investasi jangka panjang dengan ROI yang menarik.

Hubungi sekarang untuk detail lengkap dan panduan proses lelang!`;
            break;

          case 'concise':
            description = `🔨 ${actionText} ${tipeProperty || 'Property'} - ${getCurrentMonthYear()}

📍 ${alamat || 'Lokasi strategis'}

SPESIFIKASI:
${specs.slice(0, 6).map(s => `✓ ${s}`).join('\n')}
${legalitas ? `✓ ${legalitas}` : ''}

${hargaDisplay ? `${hargaDisplay}\n` : ''}
🎯 KENAPA LELANG?
✓ Harga di bawah pasar
✓ Legal & aman
✓ Potensi profit tinggi
✓ Investasi cerdas

Info lengkap hubungi kami!`;
            break;

          case 'family':
            description = `🔨 ${tipeProperty || 'Property'} ${actionText} - ${getCurrentMonthYear()} 🔨

${alamat ? `📍 Berlokasi di ${alamat}\n` : ''}
SPESIFIKASI PROPERTY:
${specs.map(s => `• ${s}`).join('\n')}

${legalitas ? `Dilengkapi dengan sertifikat ${legalitas} yang legal dan aman.\n` : ''}
${hargaDisplay ? `${hargaDisplay}\n` : ''}
🏡 COCOK UNTUK KELUARGA
${kamarTidur && kamarTidur >= 3 ? `Dengan ${kamarTidur} kamar tidur, property ini ideal untuk keluarga dengan ruang yang cukup untuk seluruh anggota keluarga.\n` : ''}
🎯 MENGAPA BELI LEWAT LELANG?

Beli property lewat lelang adalah cara paling cerdas untuk mendapatkan hunian impian dengan harga terjangkau!

✅ Harga Lebih Murah
Dapatkan property dengan harga jauh di bawah pasaran. Hemat budget untuk renovasi atau kebutuhan lainnya.

✅ Legal & Terpercaya
Proses lelang dijamin legal dan aman. Semua dokumen lengkap dan sah secara hukum.

✅ Investasi Menguntungkan
Beli dengan harga lelang, nilai property tetap sesuai harga pasar. Keuntungan langsung untuk keluarga Anda!

Hubungi kami untuk informasi detail dan panduan lengkap proses lelang!`;
            break;
        }
      }
      // TEMPLATE NORMAL (NON-LELANG)
      else {
        switch (template) {
          case 'professional':
            description = `${actionText} - ${tipeProperty || 'Property'}

SPESIFIKASI:
${specs.map(s => `• ${s}`).join('\n')}

${legalitas && nomorLegalitas ? `LEGALITAS:\n• Sertifikat ${legalitas}\n• No. ${nomorLegalitas}\n\n` : ''}${hargaDisplay ? `${hargaDisplay}\n\n` : ''}Informasi lebih lanjut hubungi kami.`;
            break;

          case 'detailed':
            description = `${actionText} ${tipeProperty || 'Property'}${harga ? ` - Rp ${formatHarga(Number(harga))}${isSewa ? ' / tahun' : ''}` : ''}

DETAIL PROPERTY:

Dimensi & Struktur:
${luasTanah ? `- Luas Tanah: ${luasTanah} m²` : ''}
${luasBangunan ? `- Luas Bangunan: ${luasBangunan} m²` : ''}
${jumlahLantai ? `- Jumlah Lantai: ${jumlahLantai}` : ''}

Fasilitas:
${kamarTidur !== undefined && kamarTidur !== null ? `- Kamar Tidur: ${kamarTidur}` : ''}
${kamarMandi !== undefined && kamarMandi !== null ? `- Kamar Mandi: ${kamarMandi}` : ''}
${dayaListrik ? `- Daya Listrik: ${dayaListrik} VA` : ''}
${sumberAir ? `- Sumber Air: ${sumberAir}` : ''}

${hadapBangunan ? `Orientasi Bangunan: ${hadapBangunan}\n` : ''}${kondisiInterior ? `Kondisi Interior: ${kondisiInterior}\n` : ''}
${legalitas ? `LEGALITAS:\n- Sertifikat: ${legalitas}${nomorLegalitas ? `\n- Nomor: ${nomorLegalitas}` : ''}\n` : ''}
${hargaDisplay ? `${hargaDisplay}\n` : ''}
Untuk informasi lebih detail dan jadwal survey, silakan hubungi kami.`;
            break;

          case 'concise':
            description = `${actionText} ${tipeProperty || 'Property'}

${specs.slice(0, 6).map(s => `✓ ${s}`).join('\n')}
${legalitas ? `✓ ${legalitas}` : ''}

${hargaDisplay}

Hubungi untuk info lengkap.`;
            break;

          case 'family':
            description = `${tipeProperty || 'Property'} ${actionText}${harga ? ` - Rp ${formatHarga(Number(harga))}${isSewa ? ' / tahun' : ''}` : ''}

Property ini menawarkan:
${specs.map(s => `• ${s}`).join('\n')}

${kondisiInterior ? `Interior dalam kondisi ${kondisiInterior.toLowerCase()}, ` : ''}${legalitas ? `dengan sertifikat ${legalitas} yang lengkap dan legal` : 'dengan legalitas yang jelas'}.
${hargaPromo ? `\n💸 Tersedia harga promo: Rp ${formatHarga(Number(hargaPromo))}${isSewa ? ' / tahun' : ''}` : ''}

${kamarTidur && kamarTidur >= 3 ? 'Cocok untuk keluarga dengan ruang yang cukup untuk seluruh anggota keluarga.' : ''}

Silakan hubungi untuk informasi lebih lanjut dan jadwal kunjungan.`;
            break;
        }
      }

      setValue('deskripsi', description.trim());
      setIsGenerating(false);
    }, 1500);
  };

  const templates = [
    {
      id: 'professional',
      name: 'Professional',
      icon: '🎯',
      color: 'emerald',
      description: 'Format bisnis, to the point, jelas',
    },
    {
      id: 'detailed',
      name: 'Detailed',
      icon: '📋',
      color: 'blue',
      description: 'Lengkap dengan kategorisasi rapi',
    },
    {
      id: 'concise',
      name: 'Concise',
      icon: '⚡',
      color: 'orange',
      description: 'Singkat, padat, mudah dibaca',
    },
    isSewa
      ? {
          id: 'family',
          name: 'Santai',
          icon: '👋',
          color: 'purple',
          description: isKos ? 'Akrab, cocok untuk anak kos' : 'Hangat & mengundang',
        }
      : {
          id: 'family',
          name: 'Family Friendly',
          icon: '🏡',
          color: 'purple',
          description: 'Hangat, untuk target keluarga',
        },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* ══ 1. FOTO ══ */}
      <section className="space-y-3 bg-transparent">
        <KepalaBagian
          nomor={1}
          ikon={<ImageIcon className="h-4 w-4 text-white" />}
          warna="from-purple-500 to-pink-600"
          judul="Foto Property"
          desc="Foto pertama jadi thumbnail listing"
          kanan={
            <span
              className={cn(
                'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums',
                hasEnoughImages
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-slate-800 text-slate-400',
              )}
            >
              {images.length}/10
            </span>
          }
        />

        <ImageUploader value={images} onChange={onImagesChange} maxFiles={10} />

        {errors.gambar && (
          <p className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {errors.gambar.message}
          </p>
        )}

        {/* Tips foto. Dulu dua kartu setinggi 160px berdampingan — 320px layar
            untuk enam kalimat yang dibaca sekali seumur hidup agent, lalu
            dilewati selamanya. Sekarang satu strip yang bisa dilipat: tetap ada
            untuk yang butuh, tidak menghalangi yang sudah hafal. Dibuka
            otomatis selama belum ada foto sama sekali — hanya di saat itulah
            saran ini masih bisa mengubah hasil. */}
        <details open={images.length === 0} className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3.5 py-2.5 text-xs font-bold text-slate-300 transition-colors hover:border-purple-500/30 hover:text-slate-100">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-purple-400" />
            Tips foto yang bikin listing dilirik
            <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 grid gap-x-6 gap-y-1.5 rounded-xl border border-slate-800 bg-slate-900/40 px-3.5 py-3 sm:grid-cols-2">
            {[
              ['✨', 'Cahaya alami pagi/sore, bukan lampu kuning'],
              ['📐', 'Sudut lebar dari pojok ruangan'],
              ['🧹', 'Rapikan dulu — barang berserakan menurunkan harga'],
              ['🏠', 'Tampak depan, ruang tamu, kamar utama, dapur'],
              ['🚿', 'Kamar mandi & halaman kalau ada'],
              ['🚫', 'Hindari foto buram atau ada orangnya'],
            ].map(([emo, teks]) => (
              <p key={teks} className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
                <span className="shrink-0">{emo}</span>
                <span>{teks}</span>
              </p>
            ))}
          </div>
        </details>
      </section>

      {/* ══ 2. JUDUL ══
          Sebelum deskripsi, sesudah foto. Judul adalah kalimat yang paling
          menentukan (satu-satunya yang dibaca Google & calon pembeli di hasil
          pencarian), jadi ia diselesaikan lebih dulu — dan deskripsi ditulis
          mengikutinya, bukan sebaliknya. Perakitnya butuh seluruh data dari
          langkah 1–4, itu sebabnya ia berada di langkah terakhir ini. */}
      <section className="rounded-2xl border-2 border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.07] via-slate-900/40 to-transparent p-4 sm:p-5">
        <JudulOtomatis
          // Harga & jumlah kamar SENGAJA tidak ada di sini — `DataJudul`
          // memang tidak punya tempat untuk keduanya. Judul dibangun dari
          // lokasi, patokan terdekat & ciri khas; alasannya di kepala
          // src/lib/listingTitle.ts.
          data={{
            jenis_transaksi: jenisTransaksi || null,
            kategori: (kategori || null) as any,
            kota,
            kecamatan,
            kelurahan,
            luas_tanah: luasTanah,
            luas_bangunan: luasBangunan,
            jumlah_lantai: jumlahLantai,
            kondisi_interior: kondisiInterior,
            legalitas,
            tanggal_lelang: tanggalLelang,
            kos_gender: kosGender,
            kamar_mandi_tipe: kamarMandiTipe,
            akses_24_jam: akses24Jam,
            fasilitas_kamar: fasilitasKamarRaw,
            kamar_tipe: kamarTipe as any,
            tipe_unit: tipeUnit,
            nama_gedung: namaGedung,
            akses_terdekat: aksesTerdekat,
          }}
          value={judulProperty}
          onChange={(v) => setValue('judul', v, { shouldValidate: true })}
          error={errors.judul?.message}
          isEditMode={isEditMode}
          aktif={aktif}
        />
      </section>

      {/* ══ 3. DESKRIPSI ══ */}
      <section className="space-y-3 bg-transparent">
        <KepalaBagian
          nomor={3}
          ikon={<Sparkles className="h-4 w-4 text-white" />}
          warna="from-indigo-500 to-purple-600"
          judul="Deskripsi"
          desc="Pilih gaya — isinya dirakit dari data yang sudah Anda isi"
          kanan={
            <span
              className={cn(
                'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums',
                hasGoodDescription
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-slate-800 text-slate-400',
              )}
            >
              {deskripsi.length}
            </span>
          }
        />

        {/* Empat gaya, langsung terlihat — tidak lagi disembunyikan di balik
            tombol raksasa "Generate Deskripsi Otomatis" setinggi 96px. Tombol
            itu memakan satu layar penuh di HP hanya untuk mengumumkan adanya
            empat tombol lain, dan menambah satu ketukan sebelum pekerjaan
            sebenarnya dimulai. */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {templates.map((t) => {
            const gaya = GAYA_TEMPLATE[t.color];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => generateSmartDescription(t.id as any)}
                disabled={isGenerating}
                title={t.description}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-xl border-2 border-slate-800 bg-slate-900/50 p-2.5 text-left transition-all duration-200',
                  'hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50',
                  gaya.border,
                )}
              >
                <span className="flex w-full items-center gap-1.5">
                  <span className="text-base leading-none">{t.icon}</span>
                  <span className={cn('truncate text-xs font-bold', gaya.teks)}>
                    {t.name}
                  </span>
                  {isGenerating && (
                    <Zap className="ml-auto h-3.5 w-3.5 shrink-0 animate-pulse text-yellow-400" />
                  )}
                </span>
                <span className="line-clamp-2 text-[10px] leading-tight text-slate-500">
                  {t.description}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Textarea
            {...form.register('deskripsi')}
            placeholder="Ketuk salah satu gaya di atas untuk merakit deskripsi otomatis — atau tulis sendiri di sini."
            rows={9}
            className={cn(
              'resize-y rounded-xl border-2 border-slate-800 bg-slate-900/50 p-3.5 text-sm',
              'text-slate-100 placeholder:text-slate-600',
              'focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20',
            )}
          />

          {isGenerating && (
            <span className="absolute inset-0 grid place-items-center rounded-xl bg-slate-950/70">
              <span className="flex items-center gap-2 text-xs font-bold text-purple-300">
                <Sparkles className="h-4 w-4 animate-spin" />
                Merakit deskripsi…
              </span>
            </span>
          )}

          {deskripsi.length > 0 && (
            <span
              className={cn(
                'pointer-events-none absolute bottom-2.5 right-2.5 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
                hasGoodDescription
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-slate-800/90 text-slate-400',
              )}
            >
              {deskripsi.length} / 100+
            </span>
          )}
        </div>

        {errors.deskripsi?.message && (
          <p className="text-xs font-semibold text-red-400">{errors.deskripsi.message}</p>
        )}
      </section>

      {/* ══ 4. PROMOSI ══ */}
      <section className="space-y-2 bg-transparent">
        <KepalaBagian
          nomor={4}
          ikon={<TrendingUp className="h-4 w-4 text-white" />}
          warna="from-red-500 to-orange-600"
          judul="Promosi Premium"
          desc="Opsional — bisa dinyalakan kapan saja setelah tayang"
        />

        {/* Satu baris, bukan kartu setinggi 96px. Isinya satu keputusan
            ya/tidak; sakelar di kanan menjawabnya tanpa perlu membaca ulang. */}
        <label
          className={cn(
            'flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-colors',
            isHotDeal
              ? 'border-red-500/50 bg-red-500/[0.07]'
              : 'border-slate-800 bg-slate-900/40 hover:border-red-500/30',
          )}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-red-500/30 bg-red-500/15 text-xl">
            🔥
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-slate-100">Hot Deal Badge</span>
            <span className="block truncate text-[11px] text-slate-400">
              Tampil di homepage · badge eksklusif · prioritas pencarian
            </span>
          </span>
          <input
            type="checkbox"
            {...form.register('is_hot_deal')}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className={cn(
              'relative h-6 w-11 shrink-0 rounded-full transition-colors',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-red-400/60',
              isHotDeal ? 'bg-red-500' : 'bg-slate-700',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all',
                isHotDeal ? 'left-[22px]' : 'left-0.5',
              )}
            />
          </span>
        </label>

        <AnimatePresence>
          {isHotDeal && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden text-[11px] font-semibold text-red-300"
            >
              Aktif — listing ini masuk antrean prioritas homepage &amp; hasil pencarian.
            </motion.p>
          )}
        </AnimatePresence>
      </section>

      {/* ══ SIAP TAYANG? ══
          Tiga baris kartu setinggi 56px diringkas jadi tiga pil dalam satu
          baris. Isinya bukan pekerjaan baru — cuma cermin dari tiga bagian di
          atasnya, jadi tidak pantas memakan ruang sebesar bagian itu sendiri. */}
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl border px-3.5 py-3 transition-colors',
          completionScore === 3
            ? 'border-emerald-500/40 bg-emerald-500/[0.08]'
            : 'border-slate-800 bg-slate-900/40',
        )}
      >
        <span className="mr-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
          Siap tayang
        </span>

        {[
          { ok: hasEnoughImages, teks: `${images.length}/3 foto` },
          { ok: hasTitle, teks: 'Judul' },
          { ok: hasGoodDescription, teks: `Deskripsi ${deskripsi.length}/100` },
        ].map((c) => (
          <span
            key={c.teks}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold',
              c.ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-400',
            )}
          >
            <span
              className={cn(
                'grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full',
                c.ok ? 'bg-emerald-400 text-slate-950' : 'border border-slate-600',
              )}
            >
              {c.ok && <Check className="h-2 w-2" strokeWidth={4} />}
            </span>
            {c.teks}
          </span>
        ))}

        {completionScore === 3 && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] font-bold text-emerald-300">
            <Star className="h-3.5 w-3.5" />
            Siap go live
          </span>
        )}
      </div>
    </motion.div>
  );
}

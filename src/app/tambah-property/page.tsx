'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useForm, useWatch, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ListingFormData, listingSchema } from '@/lib/validations/listing';
import { ProgressIndicator } from './components/listing/ProgressIndicator';
import { AutoSaveIndicator } from './components/listing/AutoSaveIndicator';
import { LivePreview } from './components/listing/LivePreview';
import { Step1BasicInfo } from './components/listing/steps/Step1BasicInfo';
import { Step2Location } from './components/listing/steps/Step2Location';
import { Step3Pricing } from './components/listing/steps/Step3Pricing';
import { Step4Specifications } from './components/listing/steps/Step4Specifications';
import { Step5Media } from './components/listing/steps/Step5Media';
import { useFormPersist } from './hooks/useFormPersist';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Send, ArrowLeft, AlertTriangle, X } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

interface ImageFile {
  id: string;
  file: File | null;
  preview: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const STEPS = [
  { id: 1, label: 'Dasar', icon: '📝' },
  { id: 2, label: 'Lokasi', icon: '📍' },
  { id: 3, label: 'Harga', icon: '💰' },
  { id: 4, label: 'Spesifikasi', icon: '🏠' },
  // Judul ikut di langkah terakhir — labelnya menyebutkannya supaya agent tahu
  // di mana kolom itu berada setelah dipindah dari langkah pertama.
  { id: 5, label: 'Media & Judul', icon: '📸' },
];

// Kos menyusun kamar (jumlah & tipe) lebih dulu, baru harganya — keduanya di
// step 3. Label menyebut "Kamar" di depan supaya urutannya jelas dari progress
// bar, dan agent tidak mencari isian kamar di step Spesifikasi.
const STEPS_KOS = STEPS.map((s) =>
  s.id === 3 ? { ...s, label: 'Kamar & Harga', icon: '🛏️' } : s,
);

/**
 * Pesan error untuk daftar ringkasan di bawah form. Field array (kamar_tipe)
 * errornya bisa berupa daftar per baris tanpa `message` di level atas — kalau
 * langsung dibaca `.message`, barisnya tampil kosong dan agent tidak tahu apa
 * yang salah. Jadi baris pertama yang bermasalah ikut disebut nomornya.
 */
function ringkasPesanError(error: unknown): string {
  if (!error) return 'Perlu diperiksa';

  if (Array.isArray(error)) {
    const idx = error.findIndex((e) => !!e);
    if (idx === -1) return 'Perlu diperiksa';
    const detail = error[idx] as Record<string, any>;
    const pesan =
      detail?.message ??
      Object.values(detail ?? {}).find(
        (v: any) => typeof v?.message === 'string',
      )?.message;
    return `baris ${idx + 1} — ${pesan || 'perlu diperiksa'}`;
  }

  const e = error as { message?: string; root?: { message?: string } };
  return e.message ?? e.root?.message ?? 'Perlu diperiksa';
}

// Isolated subscriber: hanya re-render LivePreview, bukan seluruh halaman
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LivePreviewWrapper({
  control,
  images,
}: {
  control: Control<ListingFormData, any, any>;
  images: ImageFile[];
}) {
  const data = useWatch({ control }) as Partial<ListingFormData>;
  return <LivePreview data={data} images={images} />;
}

function TambahPropertyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const listingId = searchParams.get('id');
  const mode = searchParams.get('mode');
  const isEditMode = mode === 'edit' && !!listingId;

  const [currentStep, setCurrentStep] = useState(1);
  const [justEnteredStep5, setJustEnteredStep5] = useState(false);
  const formTopRef = useRef<HTMLDivElement>(null);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [saveStatus] = useState<SaveStatus>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  // Ref untuk cleanup blob URL saat unmount
  const imagesRef = useRef<ImageFile[]>([]);
  imagesRef.current = images;

  const form = useForm<ListingFormData>({
    resolver: zodResolver(listingSchema),
    mode: 'onChange',
    defaultValues: {
      jumlah_lantai: 1,
      status_tayang: 'TERSEDIA',
      is_hot_deal: false,
    },
  });

  const {
    watch,
    handleSubmit,
    formState: { errors },
    trigger,
    reset,
  } = form;

  const kategori = watch('kategori');

  useEffect(() => {
    if (isEditMode && listingId) {
      loadListingData(listingId);
    }
  }, [isEditMode, listingId]);

  // Auto-scroll to form top on step change (runs after render, reliable on mobile)
  useEffect(() => {
    if (formTopRef.current) {
      const headerOffset = 72;
      const y = formTopRef.current.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }
  }, [currentStep]);

  const loadListingData = async (id: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/listings/${id}`);
      if (!response.ok) throw new Error('Failed to load listing data');
      const result = await response.json();
      const listing = result.data;

      reset({
        judul: listing.judul || '',
        slug: listing.slug || '',
        jenis_transaksi: listing.jenis_transaksi,
        kategori: listing.kategori,
        vendor: listing.vendor || '',
        status_tayang: listing.status_tayang || 'TERSEDIA',
        harga: listing.harga,
        harga_promo: listing.harga_promo || undefined,
        tanggal_lelang: listing.tanggal_lelang
          ? new Date(listing.tanggal_lelang)
          : undefined,
        uang_jaminan: listing.uang_jaminan || undefined,
        nilai_limit_lelang: listing.nilai_limit_lelang || undefined,
        link: listing.link || '',
        alamat_lengkap: listing.alamat_lengkap || '',
        provinsi: listing.provinsi || '',
        kota: listing.kota || '',
        kecamatan: listing.kecamatan || '',
        kelurahan: listing.kelurahan || '',
        latitude: listing.latitude || undefined,
        longitude: listing.longitude || undefined,
        akses_terdekat: Array.isArray(listing.akses_terdekat)
          ? listing.akses_terdekat
          : [],
        luas_tanah: listing.luas_tanah || undefined,
        luas_bangunan: listing.luas_bangunan || undefined,
        jumlah_lantai: listing.jumlah_lantai || 1,
        kamar_tidur: listing.kamar_tidur || undefined,
        kamar_mandi: listing.kamar_mandi || undefined,
        daya_listrik: listing.daya_listrik || undefined,
        sumber_air: listing.sumber_air || '',
        hadap_bangunan: listing.hadap_bangunan || '',
        kondisi_interior: listing.kondisi_interior || '',
        legalitas: listing.legalitas || undefined,
        nomor_legalitas: listing.nomor_legalitas || '',
        // Identitas unit apartemen & biaya tambahan — wajib ikut di-prefill:
        // PUT menulis ulang semua kolom sewaDetail, jadi field yang tidak
        // dipulihkan di sini akan tertimpa null tiap kali listing disimpan.
        nama_gedung: listing.sewaDetail?.nama_gedung || '',
        lantai_unit: listing.sewaDetail?.lantai_unit || '',
        nomor_unit: listing.sewaDetail?.nomor_unit || '',
        tipe_unit: listing.sewaDetail?.tipe_unit || undefined,
        biaya_tambahan: Array.isArray(listing.sewaDetail?.biaya_tambahan)
          ? listing.sewaDetail.biaya_tambahan.map((b: any) => ({
              nama: String(b?.nama ?? ''),
              nominal: b?.nominal != null ? Number(b.nominal) : null,
              periode: b?.periode === 'SEKALI' || b?.periode === 'TAHUNAN'
                ? b.periode
                : 'BULANAN',
            }))
          : [],
        jam_check_in: listing.sewaDetail?.jam_check_in || '',
        jam_check_out: listing.sewaDetail?.jam_check_out || '',
        durasi_sewa: listing.sewaDetail?.durasi_sewa || undefined,
        harga_sewa_harian: listing.sewaDetail?.harga_sewa_harian || undefined,
        harga_sewa_mingguan: listing.sewaDetail?.harga_sewa_mingguan || undefined,
        harga_sewa_bulanan: listing.sewaDetail?.harga_sewa_bulanan || undefined,
        harga_sewa_tahunan: listing.sewaDetail?.harga_sewa_tahunan || undefined,
        minimal_sewa_jumlah: listing.sewaDetail?.minimal_sewa_jumlah || undefined,
        minimal_sewa_satuan: listing.sewaDetail?.minimal_sewa_satuan || undefined,
        deposit: listing.sewaDetail?.deposit || undefined,
        luas_kamar: listing.sewaDetail?.luas_kamar || undefined,
        kamar_mandi_tipe: listing.sewaDetail?.kamar_mandi_tipe || undefined,
        termasuk_listrik: listing.sewaDetail?.termasuk_listrik ?? undefined,
        termasuk_air: listing.sewaDetail?.termasuk_air ?? undefined,
        akses_24_jam: listing.sewaDetail?.akses_24_jam ?? undefined,
        jam_malam: listing.sewaDetail?.jam_malam || '',
        fasilitas_kamar: listing.sewaDetail?.fasilitas_kamar || '',
        fasilitas_bersama: listing.sewaDetail?.fasilitas_bersama || '',
        peraturan: listing.sewaDetail?.peraturan || '',
        kos_gender: listing.sewaDetail?.kos_gender || undefined,
        kapasitas_penghuni: listing.sewaDetail?.kapasitas_penghuni || undefined,
        total_kamar: listing.sewaDetail?.total_kamar || undefined,
        // ?? bukan || — 0 kamar tersedia (kos penuh) itu nilai sah.
        kamar_tersedia: listing.sewaDetail?.kamar_tersedia ?? undefined,
        // Tipe kamar — Decimal dari Prisma datang sebagai string, jadi
        // dinormalkan ke number supaya input harga & luas langsung terisi.
        kamar_tipe: Array.isArray(listing.kamarTipe)
          ? listing.kamarTipe.map((t: any) => ({
              nama: t.nama || '',
              jumlah_kamar: Number(t.jumlah_kamar ?? 1),
              kamar_tersedia: Number(t.kamar_tersedia ?? 0),
              luas_kamar: t.luas_kamar != null ? Number(t.luas_kamar) : null,
              kamar_mandi_tipe: t.kamar_mandi_tipe || null,
              kapasitas_penghuni:
                t.kapasitas_penghuni != null ? Number(t.kapasitas_penghuni) : null,
              lantai_kamar: t.lantai_kamar || null,
              nomor_kamar: t.nomor_kamar || null,
              harga_sewa_harian:
                t.harga_sewa_harian != null ? Number(t.harga_sewa_harian) : null,
              harga_sewa_mingguan:
                t.harga_sewa_mingguan != null ? Number(t.harga_sewa_mingguan) : null,
              harga_sewa_bulanan:
                t.harga_sewa_bulanan != null ? Number(t.harga_sewa_bulanan) : null,
              harga_sewa_tahunan:
                t.harga_sewa_tahunan != null ? Number(t.harga_sewa_tahunan) : null,
              fasilitas_kamar: t.fasilitas_kamar || null,
              gambar: t.gambar || null,
              catatan: t.catatan || null,
            }))
          : [],
        deskripsi: listing.deskripsi || '',
        // Wajib ikut di-prefill: PUT menulis semua field yang ada di payload,
        // jadi field yang tidak dipulihkan di sini akan tertimpa null setiap
        // kali listing disimpan ulang — walau agent tidak menyentuhnya.
        lampiran: listing.lampiran || null,
        is_hot_deal: listing.is_hot_deal || false,
      });

      if (listing.gambar) {
        const imageUrls = listing.gambar
          .split(',')
          .filter((url: string) => url.trim());
        const existingImages: ImageFile[] = imageUrls.map(
          (url: string, index: number) => ({
            id: `existing-${index}`,
            file: null,
            preview: url,
          })
        );
        setImages(existingImages);
      }
    } catch (error) {
      console.error('Load listing error:', error);
      toast.error('Gagal memuat data listing');
      router.push('/dashboard/listings');
    } finally {
      setIsLoading(false);
    }
  };

  const { clearDraft } = useFormPersist(form);

  // Cleanup blob URLs saat halaman unmount (cegah memory leak)
  useEffect(() => {
    return () => {
      imagesRef.current.forEach((img) => {
        if (img.preview?.startsWith('blob:')) {
          URL.revokeObjectURL(img.preview);
        }
      });
    };
  }, []);

  const validateStep = async (
    step: number,
  ): Promise<{ ok: boolean; pesan?: string | null }> => {
    const fieldsToValidate: Record<number, (keyof ListingFormData)[]> = {
      // `judul` TIDAK divalidasi di sini lagi — kolomnya sudah pindah ke step
      // 5, dirakit otomatis dari data yang baru lengkap di sana. Menahannya di
      // step 1 berarti menuntut agent mengisi kolom yang belum ada.
      1: ['jenis_transaksi', 'kategori'],
      2: ['kota', 'provinsi', 'alamat_lengkap'],
      // Step 3 sekarang memuat kamar + harga (khusus kos), jadi kesalahan
      // seperti tipe tanpa harga atau sisa kamar melebihi jumlahnya harus
      // tertahan di sini — bukan baru muncul saat submit di step 5.
      3: [
        'harga',
        'durasi_sewa',
        'kamar_tipe',
        'total_kamar',
        'kamar_tersedia',
        'biaya_tambahan',
      ],
      // luas_bangunan & tipe_unit ikut di sini: keduanya wajib untuk apartemen
      // dan diisi di step ini, jadi kesalahannya harus tertahan sekarang —
      // bukan baru muncul saat submit di step 5, jauh dari field yang salah.
      4: ['luas_tanah', 'luas_bangunan', 'legalitas', 'kos_gender', 'tipe_unit'],
      5: [],
    };

    const fields = fieldsToValidate[step];
    if (fields.length === 0) return { ok: true as const };

    const ok = await trigger(fields);
    if (ok) return { ok: true as const };

    // Sebutkan MASALAHNYA, bukan sekadar "ada yang kurang".
    //
    // Toast generik memaksa agent menebak: ia melihat kartu tipe kamar yang
    // fotonya masih kosong lalu menyimpulkan foto itu penyebabnya, padahal
    // yang menahan adalah harga per tipe yang belum diisi di bagian lain.
    // Menebak salah berarti mencoba memperbaiki hal yang tidak rusak.
    const errs = form.formState.errors as Record<string, unknown>;
    const bermasalah = fields.find((f) => errs[f as string]);
    const pesan = bermasalah ? ringkasPesanError(errs[bermasalah as string]) : null;
    return { ok: false as const, pesan };
  };

  const handleNext = async () => {
    const { ok, pesan } = await validateStep(currentStep);

    if (!ok) {
      toast.error(pesan || 'Mohon lengkapi field yang diperlukan');
      return;
    }

    if (currentStep < 5) {
      setCurrentStep((prev) => {
        const next = prev + 1;
        if (next === 5) {
          setJustEnteredStep5(true);
        }
        return next;
      });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const uploadImagesToGoogleDrive = async (
    imgs: ImageFile[],
    kota: string,
    alamat: string
  ): Promise<string[]> => {
    try {
      const formData = new FormData();

      // Indeks HARUS rapat (0,1,2,…): API pembaca berhenti di celah pertama
      // (`if (!file) break`), jadi memakai indeks array asli akan memotong
      // sisanya begitu ada satu elemen tanpa file.
      let slot = 0;
      imgs.forEach((img) => {
        if (img.file) {
          formData.append(`images[${slot}]`, img.file);
          slot += 1;
        }
      });

      formData.append('kota', kota);
      formData.append('alamat', alamat);
      // Cover ditentukan urutan di form, dan API mengembalikan URL cover di
      // posisi pertama (`imageUrls.unshift(coverUrl)`). Karena `imgs` sudah
      // terurut sesuai susunan agent, "0" berarti file baru pertama — hasilnya
      // urutan yang kembali tetap sama dengan urutan yang dikirim.
      formData.append('cover_image_index', '0');

      const response = await fetch('/api/upload/images', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload images');
      }

      const result = await response.json();
      return result.imageUrls;
    } catch (error) {
      console.error('Upload error:', error);
      throw new Error('Gagal mengupload gambar ke Google Drive');
    }
  };

  const onSubmit = async (data: ListingFormData) => {
    if (currentStep < 5) return;

    if (images.length === 0) {
      toast.error('Minimal 1 foto harus diupload');
      setCurrentStep(5);
      return;
    }

    setIsSubmitting(true);

    try {
      const newImages = images.filter((img) => img.file);
      let newImageUrls: string[] = [];

      if (newImages.length > 0) {
        toast.info('Uploading gambar ke Google Drive...');
        newImageUrls = await uploadImagesToGoogleDrive(
          newImages,
          data.kota,
          data.alamat_lengkap || data.judul
        );
      }

      // Susun ulang ke URUTAN YANG DIATUR AGENT, bukan "yang lama dulu lalu
      // yang baru". Foto pertama dipakai sebagai cover di card listing & preview
      // WhatsApp, jadi menaruh foto lama di depan akan mengabaikan pengaturan
      // urutan yang baru saja dilakukan di step Media.
      let indeksBaru = 0;
      const allImageUrls = images
        .map((img) => (img.file ? newImageUrls[indeksBaru++] : img.preview))
        .filter((url): url is string => !!url);

      // Kos dengan beberapa tipe kamar: luas/kamar mandi/kapasitas per kamar
      // hidup di tiap tipe, jadi kolom tunggalnya tidak boleh ikut terkirim —
      // kalau ikut, DB menyimpan dua kebenaran yang bisa saling bertentangan.
      const hasTipeKamar =
        data.kategori === 'KOS' &&
        Array.isArray(data.kamar_tipe) &&
        data.kamar_tipe.length > 0;

      const submitData = {
        judul: data.judul,
        slug: data.slug,
        deskripsi: data.deskripsi || null,
        jenis_transaksi: data.jenis_transaksi,
        kategori: data.kategori,
        vendor: data.vendor || null,
        status_tayang: data.status_tayang || 'TERSEDIA',
        harga: Number(data.harga),
        harga_promo: data.harga_promo ? Number(data.harga_promo) : null,
        uang_jaminan: data.uang_jaminan ? Number(data.uang_jaminan) : null,
        nilai_limit_lelang: data.nilai_limit_lelang
          ? Number(data.nilai_limit_lelang)
          : null,
        tanggal_lelang: data.tanggal_lelang
          ? new Date(data.tanggal_lelang).toISOString()
          : null,
        link: data.link || null,
        alamat_lengkap: data.alamat_lengkap || null,
        provinsi: data.provinsi || null,
        kota: data.kota,
        kecamatan: data.kecamatan || null,
        kelurahan: data.kelurahan || null,
        latitude: data.latitude ? Number(data.latitude) : null,
        longitude: data.longitude ? Number(data.longitude) : null,
        // Baris patokan yang namanya kosong dibuang — jangan simpan sampah
        akses_terdekat: (data.akses_terdekat ?? []).filter((a) => a?.nama?.trim()),
        luas_tanah: data.luas_tanah ? Number(data.luas_tanah) : null,
        luas_bangunan: data.luas_bangunan ? Number(data.luas_bangunan) : null,
        jumlah_lantai: data.jumlah_lantai || 1,
        kamar_tidur: data.kamar_tidur || null,
        kamar_mandi: data.kamar_mandi || null,
        daya_listrik: data.daya_listrik || null,
        sumber_air: data.sumber_air || null,
        hadap_bangunan: data.hadap_bangunan || null,
        kondisi_interior: data.kondisi_interior || null,
        legalitas: data.legalitas || null,
        nomor_legalitas: data.nomor_legalitas || null,
        gambar: allImageUrls.join(','),
        lampiran: data.lampiran || null,
        is_hot_deal: data.is_hot_deal || false,

        // --- Field SEWA (disimpan API ke tabel ListingSewaDetail) ---
        // Hanya dikirim saat transaksi SEWA supaya listing jual/lelang tidak
        // ikut membuat baris sewaDetail kosong.
        ...(data.jenis_transaksi === 'SEWA' && {
          // Tipe kamar kos. Kalau daftarnya terisi, server yang menghitung
          // ulang total/sisa kamar & harga "mulai dari" dari daftar ini —
          // field tunggal di bawah dikirim apa adanya tapi tidak dipakai.
          kamar_tipe: hasTipeKamar
            ? (data.kamar_tipe ?? []).map((t, index) => ({
                nama: t.nama?.trim() || `Tipe ${index + 1}`,
                urutan: index,
                jumlah_kamar: Number(t.jumlah_kamar ?? 1),
                kamar_tersedia: Number(t.kamar_tersedia ?? 0),
                luas_kamar: t.luas_kamar != null ? Number(t.luas_kamar) : null,
                kamar_mandi_tipe: t.kamar_mandi_tipe || null,
                kapasitas_penghuni:
                  t.kapasitas_penghuni != null ? Number(t.kapasitas_penghuni) : null,
                lantai_kamar: t.lantai_kamar || null,
                nomor_kamar: t.nomor_kamar || null,
                harga_sewa_harian:
                  t.harga_sewa_harian != null ? Number(t.harga_sewa_harian) : null,
                harga_sewa_mingguan:
                  t.harga_sewa_mingguan != null ? Number(t.harga_sewa_mingguan) : null,
                harga_sewa_bulanan:
                  t.harga_sewa_bulanan != null ? Number(t.harga_sewa_bulanan) : null,
                harga_sewa_tahunan:
                  t.harga_sewa_tahunan != null ? Number(t.harga_sewa_tahunan) : null,
                fasilitas_kamar: t.fasilitas_kamar || null,
                // Foto tipe sudah berupa URL (diunggah saat dipilih), jadi
                // tidak ikut alur unggah gambar listing di atas.
                gambar: t.gambar || null,
                catatan: t.catatan || null,
              }))
            : [],
          durasi_sewa: data.durasi_sewa || null,
          harga_sewa_harian: data.harga_sewa_harian ? Number(data.harga_sewa_harian) : null,
          harga_sewa_mingguan: data.harga_sewa_mingguan
            ? Number(data.harga_sewa_mingguan)
            : null,
          harga_sewa_bulanan: data.harga_sewa_bulanan
            ? Number(data.harga_sewa_bulanan)
            : null,
          harga_sewa_tahunan: data.harga_sewa_tahunan
            ? Number(data.harga_sewa_tahunan)
            : null,
          minimal_sewa_jumlah: data.minimal_sewa_jumlah
            ? Number(data.minimal_sewa_jumlah)
            : null,
          minimal_sewa_satuan: data.minimal_sewa_satuan || null,
          deposit: data.deposit ? Number(data.deposit) : null,

          // --- Identitas unit apartemen ---
          // Hanya dikirim untuk kategori APARTEMEN: kalau agent sempat mengisi
          // nama gedung/nomor unit lalu pindah kategori ke Rumah, nilainya
          // tidak boleh ikut tersimpan — listing rumah dengan "Unit 12A"
          // adalah data sampah yang akan tampil di halaman detail.
          ...(data.kategori === 'APARTEMEN'
            ? {
                nama_gedung: data.nama_gedung?.trim() || null,
                lantai_unit: data.lantai_unit?.trim() || null,
                nomor_unit: data.nomor_unit?.trim() || null,
                tipe_unit: data.tipe_unit || null,
              }
            : {
                nama_gedung: null,
                lantai_unit: null,
                nomor_unit: null,
                tipe_unit: null,
              }),

          // Baris biaya tanpa nama dibuang — baris kosong adalah keadaan normal
          // saat agent baru menekan "tambah" lalu berpindah pikiran. Nominal
          // boleh null: "listrik sesuai pemakaian" itu jawaban yang sah.
          biaya_tambahan: (data.biaya_tambahan ?? [])
            .filter((b) => b?.nama?.trim())
            .map((b) => ({
              nama: b.nama.trim(),
              nominal: b.nominal != null ? Number(b.nominal) : null,
              periode: b.periode,
            })),

          jam_check_in: data.jam_check_in || null,
          jam_check_out: data.jam_check_out || null,
          luas_kamar:
            hasTipeKamar || !data.luas_kamar ? null : Number(data.luas_kamar),
          kamar_mandi_tipe: hasTipeKamar ? null : data.kamar_mandi_tipe || null,
          termasuk_listrik: data.termasuk_listrik ?? null,
          termasuk_air: data.termasuk_air ?? null,
          akses_24_jam: data.akses_24_jam ?? null,
          jam_malam: data.jam_malam || null,
          fasilitas_kamar: data.fasilitas_kamar || null,
          fasilitas_bersama: data.fasilitas_bersama || null,
          peraturan: data.peraturan || null,
          kos_gender: data.kos_gender || null,
          kapasitas_penghuni:
            hasTipeKamar || !data.kapasitas_penghuni
              ? null
              : Number(data.kapasitas_penghuni),
          total_kamar: data.total_kamar ? Number(data.total_kamar) : null,
          // != null bukan truthy-check — 0 kamar tersedia (kos penuh) harus ikut
          // terkirim, kalau tidak angkanya balik jadi "belum diisi".
          kamar_tersedia:
            data.kamar_tersedia != null ? Number(data.kamar_tersedia) : null,
        }),
      };

      const url = isEditMode ? `/api/listings/${listingId}` : '/api/listings';
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error ||
            `Failed to ${isEditMode ? 'update' : 'create'} listing`
        );
      }

      const result = await response.json();

      clearDraft();
      if (!isEditMode) {
        await fetch('/api/listings/draft', { method: 'DELETE' }).catch(
          () => {}
        );
      }

      if (isEditMode) {
        toast.success('Property berhasil diupdate!');

        const updated = result.data as {
          id_property: number | string;
          slug: string;
          jenis_transaksi: 'PRIMARY' | 'SECONDARY' | 'LELANG' | 'SEWA';
          id_agent: number | string;
        };

        const slug = updated.slug;
        const idProp = updated.id_property;
        const agentId = updated.id_agent;

        if (!slug || !idProp || !agentId) {
          setCurrentStep(5);
          return;
        }

        if (updated.jenis_transaksi === 'SEWA') {
          router.push('/Sewa');
          return;
        }

        const base =
          updated.jenis_transaksi === 'LELANG' ? 'Lelang' : 'Jual';

        const detailUrl = `/${base}/${slug}-${idProp}/${agentId}`;
        router.push(detailUrl);
      } else {
        toast.success('Property berhasil ditambahkan! 🎉\n+10 poin untuk Anda!');

        const created = result.data as {
          id_property: number | string;
          slug: string;
          jenis_transaksi: 'PRIMARY' | 'SECONDARY' | 'LELANG' | 'SEWA';
          id_agent: number | string;
        };

        // SEWA punya halaman detail sendiri tanpa segmen agent — panel
        // kanannya adalah pemesanan kamar, bukan kartu agent seperti Jual/
        // Lelang, jadi tidak ada varian /[agentId] yang perlu dituju.
        if (created.jenis_transaksi === 'SEWA') {
          router.push(`/Sewa/${created.slug}-${created.id_property}`);
          return;
        }

        const base = created.jenis_transaksi === 'LELANG' ? 'Lelang' : 'Jual';
        const detailUrl = `/${base}/${created.slug}-${created.id_property}/${created.id_agent}`;
        router.push(detailUrl);
      }
    } catch (error) {
      console.error('Submit error:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : `Gagal ${isEditMode ? 'mengupdate' : 'menambahkan'} property`;
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();

    if (currentStep < 5) {
      void handleNext();
      return;
    }

    if (justEnteredStep5) {
      setJustEnteredStep5(false);
      return;
    }

    void handleSubmit(onSubmit)();
  };

  const handleGoBack = () => {
    const all = watch();
    const hasUnsavedChanges = Object.keys(all).some((key) => {
      const value = all[key as keyof ListingFormData];
      return value !== undefined && value !== '' && value !== null;
    });

    if (hasUnsavedChanges) {
      setShowExitModal(true);
      return;
    }

    router.back();
  };

  const handleConfirmExit = () => {
    clearDraft();
    setShowExitModal(false);
    router.back();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20"></div>
            <div className="absolute inset-0 rounded-full border-2 border-t-emerald-500 animate-spin"></div>
          </div>
          <p className="text-slate-300 font-medium">Memuat data listing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-black to-black"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '1s' }}
        ></div>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(16, 185, 129, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(16, 185, 129, 0.03) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        ></div>
      </div>

      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-50 backdrop-blur-xl bg-black/60 border-b border-emerald-500/20"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-teal-500/5"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="flex items-center justify-between h-16">
            <motion.button
              whileHover={{ scale: 1.05, x: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleGoBack}
              className="group flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-slate-900/80 to-slate-800/80 hover:from-emerald-900/30 hover:to-teal-900/30 border border-slate-800 hover:border-emerald-500/50 transition-all duration-300"
            >
              <ArrowLeft className="h-4 w-4 text-slate-400 group-hover:text-emerald-400 transition-colors" />
              <span className="text-sm font-medium text-slate-300 group-hover:text-emerald-300 hidden sm:inline transition-colors">
                Kembali
              </span>
            </motion.button>

            <div className="flex items-center gap-3">
              <div className="text-center">
                <h1 className="text-sm sm:text-base font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  {isEditMode ? 'Edit Property' : 'Tambah Property Baru'}
                </h1>
                <p className="text-xs text-slate-500 hidden sm:block">
                  Lengkapi dengan detail
                </p>
              </div>
              <AutoSaveIndicator status={saveStatus} />
            </div>

            <div className="w-28 sm:w-36" />
          </div>
        </div>
      </motion.div>

      {/* Exit Confirmation Modal */}
      <AnimatePresence>
        {showExitModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            onClick={() => setShowExitModal(false)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Glow ring */}
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-amber-500/40 via-orange-500/20 to-red-500/30 blur-sm" />

              <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border border-white/10 overflow-hidden shadow-2xl">
                {/* Top shimmer line */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

                {/* Close button */}
                <button
                  onClick={() => setShowExitModal(false)}
                  className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="p-8">
                  {/* Icon */}
                  <div className="flex justify-center mb-6">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-xl scale-150" />
                      <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 flex items-center justify-center">
                        <AlertTriangle className="w-7 h-7 text-amber-400" />
                      </div>
                    </div>
                  </div>

                  {/* Text */}
                  <div className="text-center mb-8">
                    <h2 className="text-xl font-bold text-white mb-2 tracking-tight">
                      Keluar tanpa menyimpan?
                    </h2>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Data yang sudah Anda isi akan hilang dan tidak dapat dikembalikan.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setShowExitModal(false)}
                      className="flex-1 px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-sm font-medium text-slate-300 transition-all duration-200"
                    >
                      Tetap di sini
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleConfirmExit}
                      className="flex-1 relative px-5 py-3 rounded-xl overflow-hidden text-sm font-semibold text-white transition-all duration-200"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-rose-600" />
                      <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-rose-500 opacity-0 hover:opacity-100 transition-opacity duration-200" />
                      <span className="relative">Ya, keluar</span>
                    </motion.button>
                  </div>
                </div>

                {/* Bottom shimmer line */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2"
          >
            <div ref={formTopRef} />
            <ProgressIndicator
              currentStep={currentStep}
              steps={kategori === 'KOS' ? STEPS_KOS : STEPS}
            />

            <form
              onSubmit={handleFormSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && currentStep < 5) {
                  e.preventDefault();
                }
              }}
            >
              <div className="relative backdrop-blur-xl bg-slate-900/40 rounded-3xl border border-emerald-500/20 p-6 sm:p-8 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 pointer-events-none"></div>
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="relative z-10 space-y-6">
                  {/* Semua step dirender, hanya di-hide/show */}
                  <div className={currentStep === 1 ? 'block' : 'hidden'}>
                    <Step1BasicInfo form={form} />
                  </div>
                  <div className={currentStep === 2 ? 'block' : 'hidden'}>
                    <Step2Location form={form} />
                  </div>
                  <div className={currentStep === 3 ? 'block' : 'hidden'}>
                    <Step3Pricing form={form} isEditMode={isEditMode} />
                  </div>
                  <div className={currentStep === 4 ? 'block' : 'hidden'}>
                    <Step4Specifications form={form} />
                  </div>
                  <div className={currentStep === 5 ? 'block' : 'hidden'}>
                    <Step5Media
                      form={form}
                      images={images}
                      onImagesChange={setImages}
                      isEditMode={isEditMode}
                      aktif={currentStep === 5}
                    />
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-6 border-t border-emerald-500/20">
                    <motion.button
                      whileHover={{ scale: 1.05, x: -2 }}
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={handlePrevious}
                      disabled={currentStep === 1}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 disabled:from-slate-800 disabled:to-slate-800 disabled:opacity-50 border border-slate-700 hover:border-emerald-500/50 transition-all duration-300"
                    >
                      <ChevronLeft className="h-4 w-4 text-slate-300" />
                      <span className="text-sm font-medium text-slate-300">
                        Kembali
                      </span>
                    </motion.button>

                    {currentStep < 5 ? (
                      <motion.button
                        whileHover={{ scale: 1.05, x: 2 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={handleNext}
                        className="relative flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border border-emerald-500/50 hover:border-emerald-400 transition-all duration-300 overflow-hidden group"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                        <span className="text-sm font-medium text-white relative z-10">
                          Lanjut
                        </span>
                        <ChevronRight className="h-4 w-4 text-white relative z-10" />
                      </motion.button>
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="submit"
                        disabled={isSubmitting}
                        className="relative flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:via-emerald-400 hover:to-teal-500 disabled:from-slate-700 disabled:to-slate-700 border border-emerald-400/50 transition-all duration-300 min-w-[180px] justify-center overflow-hidden group"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                        {isSubmitting ? (
                          <>
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{
                                duration: 1,
                                repeat: Infinity,
                                ease: 'linear',
                              }}
                              className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full relative z-10"
                            />
                            <span className="text-sm font-bold text-white relative z-10">
                              {isEditMode ? 'Updating...' : 'Publishing...'}
                            </span>
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 text-white relative z-10" />
                            <span className="text-sm font-bold text-white relative z-10">
                              {isEditMode ? 'Update Listing' : 'Publish Listing'}
                            </span>
                          </>
                        )}
                      </motion.button>
                    )}
                  </div>
                </div>
              </div>
            </form>

            {Object.keys(errors).length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 backdrop-blur-xl bg-red-500/10 border border-red-500/30 rounded-2xl"
              >
                <h4 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  Ada beberapa field yang perlu diperbaiki
                </h4>
                <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                  {Object.entries(errors).map(([key, error]) => (
                    <li key={key}>
                      <span className="font-medium capitalize">
                        {key.replace(/_/g, ' ')}:
                      </span>{' '}
                      {ringkasPesanError(error)}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-1"
          >
            <div className="sticky top-24">
              <LivePreviewWrapper control={form.control} images={images} />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function TambahPropertyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20"></div>
              <div className="absolute inset-0 rounded-full border-2 border-t-emerald-500 animate-spin"></div>
            </div>
            <p className="text-slate-300 font-medium">Loading...</p>
          </div>
        </div>
      }
    >
      <TambahPropertyContent />
    </Suspense>
  );
}

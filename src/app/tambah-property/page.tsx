'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
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
import { ChevronLeft, ChevronRight, Save, Send, ArrowLeft } from 'lucide-react';
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
  { id: 5, label: 'Media', icon: '📸' },
];

function TambahPropertyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const listingId = searchParams.get('id');
  const mode = searchParams.get('mode');
  const isEditMode = mode === 'edit' && !!listingId;

  const [currentStep, setCurrentStep] = useState(1);
  const [justEnteredStep5, setJustEnteredStep5] = useState(false);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [saveStatus] = useState<SaveStatus>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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

  useEffect(() => {
    if (isEditMode && listingId) {
      loadListingData(listingId);
    }
  }, [isEditMode, listingId]);

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
        tipe_property: listing.tipe_property || '',
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
        deskripsi: listing.deskripsi || '',
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

  const validateStep = async (step: number): Promise<boolean> => {
    const fieldsToValidate: Record<number, (keyof ListingFormData)[]> = {
      1: ['judul', 'jenis_transaksi', 'kategori', 'tipe_property'],
      2: ['kota', 'provinsi', 'alamat_lengkap'],
      3: ['harga'],
      4: ['luas_tanah', 'luas_bangunan'],
      5: [],
    };

    const fields = fieldsToValidate[step];
    if (fields.length === 0) return true;

    const result = await trigger(fields);
    return result;
  };

  const handleNext = async () => {
    const isValid = await validateStep(currentStep);

    if (!isValid) {
      toast.error('Mohon lengkapi field yang diperlukan');
      return;
    }

    const values = watch();
    console.log('[DEBUG NEXT] currentStep =', currentStep, {
      jenis_transaksi: values.jenis_transaksi,
      alamat_lengkap: values.alamat_lengkap,
      kota: values.kota,
      provinsi: values.provinsi,
      latitude: values.latitude,
      longitude: values.longitude,
    });

    if (currentStep < 5) {
      setCurrentStep((prev) => {
        const next = prev + 1;
        if (next === 5) {
          setJustEnteredStep5(true);
        }
        return next;
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSaveDraft = async () => {
    toast.info(
      'Fitur simpan draft otomatis dimatikan. Data hanya disimpan saat Publish / Update di Step 5.'
    );
  };

  const uploadImagesToGoogleDrive = async (
    imgs: ImageFile[],
    kota: string,
    alamat: string
  ): Promise<string[]> => {
    try {
      const formData = new FormData();

      imgs.forEach((img, index) => {
        if (img.file) {
          formData.append(`images[${index}]`, img.file);
        }
      });

      formData.append('kota', kota);
      formData.append('alamat', alamat);
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
    console.log('[ON SUBMIT] DIPANGGIL, currentStep =', currentStep);

    if (currentStep < 5) {
      console.warn('[ON SUBMIT] DIBLOKIR karena currentStep < 5');
      return;
    }

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

      const existingImageUrls = images
        .filter((img) => !img.file)
        .map((img) => img.preview);
      const allImageUrls = [...existingImageUrls, ...newImageUrls];

      const submitData = {
        judul: data.judul,
        slug: data.slug,
        deskripsi: data.deskripsi || null,
        jenis_transaksi: data.jenis_transaksi,
        kategori: data.kategori,
        tipe_property: data.tipe_property || null,
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

        const base =
          updated.jenis_transaksi === 'LELANG' ? 'Lelang' : 'Jual';

        const detailUrl = `/${base}/${slug}-${idProp}/${agentId}`;
        router.push(detailUrl);
      } else {
        toast.success('Property berhasil ditambahkan! 🎉\n+10 poin untuk Anda!');
        router.push(`/listing/${result.data.slug}`);
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
    console.log(
      '[FORM onSubmit] currentStep =',
      currentStep,
      'justEnteredStep5 =',
      justEnteredStep5
    );

    if (currentStep < 5) {
      void handleNext();
      return;
    }

    if (justEnteredStep5) {
      console.warn(
        '[FORM onSubmit] submit pertama setelah masuk step 5 → diabaikan'
      );
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
      const confirmExit = window.confirm(
        '⚠️ Anda memiliki perubahan yang belum disimpan.\n\nApakah Anda yakin ingin keluar?'
      );
      if (!confirmExit) return;
    }

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

  const allValues = watch();
  console.log('[RENDER PAGE] values:', allValues);

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

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSaveDraft}
              disabled={isEditMode}
              className="group relative hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-slate-700 to-slate-700 transition-all duration-300 overflow-hidden"
            >
              <Save className="h-4 w-4 text-white relative z-10" />
              <span className="text-sm font-medium text-white relative z-10">
                Simpan Draft (non-aktif)
              </span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleSaveDraft}
              disabled={isEditMode}
              className="sm:hidden p-2 rounded-xl bg-slate-700"
            >
              <Save className="h-5 w-5 text-white" />
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2"
          >
            <ProgressIndicator currentStep={currentStep} steps={STEPS} />

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
                    <Step3Pricing form={form} />
                  </div>
                  <div className={currentStep === 4 ? 'block' : 'hidden'}>
                    <Step4Specifications form={form} />
                  </div>
                  <div className={currentStep === 5 ? 'block' : 'hidden'}>
                    <Step5Media
                      form={form}
                      images={images}
                      onImagesChange={setImages}
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
                      {error.message as string}
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
              <LivePreview data={allValues} images={images} />
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

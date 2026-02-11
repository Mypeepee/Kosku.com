'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { ListingFormData } from '@/lib/validations/listing';
import { FormField } from '../FormField';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Navigation,
  Loader2,
  Crosshair,
  CheckCircle2,
  AlertCircle,
  EyeOff,
  ShieldCheck,
  Search,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';

interface Step2Props {
  form: UseFormReturn<ListingFormData>;
}

interface Region {
  id: string;
  nama: string;
}

const BASE_API = 'https://ibnux.github.io/data-indonesia';
const libraries: ('places')[] = ['places'];

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: -7.2575,
  lng: 112.7521,
};

export function Step2Location({ form }: Step2Props) {
  const {
    watch,
    setValue,
    formState: { errors },
  } = form;

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_GEOCODING_API_KEY || '',
    libraries: libraries,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markerPosition, setMarkerPosition] =
    useState<google.maps.LatLngLiteral | null>(null);
  const [autocomplete, setAutocomplete] =
    useState<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // State for location hierarchy
  const [provinsiList, setProvinsiList] = useState<Region[]>([]);

  // Loading states
  const [loadingProvinsi, setLoadingProvinsi] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Location completeness score
  const [locationScore, setLocationScore] = useState(0);

  // Privacy check
  const jenisTransaksi = watch('jenis_transaksi');
  const isPrivacyMode =
    jenisTransaksi === 'SECONDARY' || jenisTransaksi === 'SEWA';

  // Fetch Provinsi on mount
  useEffect(() => {
    fetchProvinsi();
  }, []);

  const fetchProvinsi = async () => {
    setLoadingProvinsi(true);
    try {
      const res = await fetch(`${BASE_API}/propinsi.json`);
      const data: Region[] = await res.json();
      setProvinsiList(data.sort((a, b) => a.nama.localeCompare(b.nama)));
      console.log('✅ Provinsi loaded:', data.length);
    } catch (error) {
      console.error('Error loading provinsi:', error);
    } finally {
      setLoadingProvinsi(false);
    }
  };

  // RESTORE INPUT VALUE when returning to this step
  useEffect(() => {
    if (inputRef.current && watch('alamat_lengkap')) {
      inputRef.current.value = watch('alamat_lengkap');
      console.log('✅ Restored input value:', watch('alamat_lengkap'));
    }
  }, [watch('alamat_lengkap')]);

  // RESTORE MAP POSITION when coordinates exist
  useEffect(() => {
    const lat = watch('latitude');
    const lng = watch('longitude');

    if (lat && lng && map) {
      const position = { lat: Number(lat), lng: Number(lng) }; // ⬅️ pastikan number
      setMarkerPosition(position);
      map.panTo(position);
      map.setZoom(17);
      console.log('✅ Restored map position:', position);
    }
  }, [watch('latitude'), watch('longitude'), map]);

  // Initialize Autocomplete
  useEffect(() => {
    if (isLoaded && inputRef.current && !autocomplete) {
      console.log('🔧 Initializing autocomplete...');

      const autocompleteInstance = new google.maps.places.Autocomplete(
        inputRef.current,
        {
          componentRestrictions: { country: 'id' },
          fields: ['address_components', 'geometry', 'formatted_address', 'name'],
          types: ['geocode', 'establishment'],
        }
      );

      autocompleteInstance.addListener('place_changed', async () => {
        console.log('🎯 Place changed event fired!');

        const place = autocompleteInstance.getPlace();
        console.log('📍 Selected place:', place);

        if (!place.geometry || !place.geometry.location) {
          toast.error('❌ Pilih lokasi dari dropdown yang muncul');
          return;
        }

        setIsProcessing(true);

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const address = place.formatted_address || place.name || '';

        console.log('📌 Coordinates:', { lat, lng, address });

        // Update form
        setValue('alamat_lengkap', address);
        setValue('latitude', lat);
        setValue('longitude', lng);

        // Update marker
        const newPos = { lat, lng };
        setMarkerPosition(newPos);

        // ZOOM MAP
        if (map) {
          console.log('🗺️ Zooming map to location...');
          map.panTo(newPos);
          map.setZoom(17);
          console.log('✅ Map zoomed!');
        } else {
          console.warn('⚠️ Map not ready yet');
        }

        // Extract address components
        if (place.address_components) {
          await handleAddressComponents(place.address_components);
        }

        setIsProcessing(false);
        toast.success('✅ Lokasi berhasil dipilih!');
      });

      setAutocomplete(autocompleteInstance);
      console.log('✅ Autocomplete initialized');
    }
  }, [isLoaded, inputRef.current, map]);

  // Handle address components extraction
  const handleAddressComponents = async (
    components: google.maps.GeocoderAddressComponent[]
  ) => {
    console.log('🔍 Processing address components:', components);

    let provinsi = '';
    let kota = '';
    let kecamatan = '';
    let kelurahan = '';

    components.forEach((component) => {
      const types = component.types;

      if (types.includes('administrative_area_level_1')) {
        provinsi = component.long_name;
      }
      if (types.includes('administrative_area_level_2')) {
        kota = component.long_name;
      }
      if (types.includes('administrative_area_level_3')) {
        kecamatan = component.long_name;
      }
      if (
        types.includes('administrative_area_level_4') ||
        types.includes('sublocality_level_1') ||
        types.includes('sublocality')
      ) {
        kelurahan = component.long_name;
      }
    });

    console.log('📦 Extracted:', { provinsi, kota, kecamatan, kelurahan });

    // Clean and set values directly
    if (provinsi) {
      const cleanProv = provinsi
        .replace(/^(Provinsi|Province|Prov\.?)\s*/i, '')
        .trim();
      setValue('provinsi', cleanProv);
      console.log('✅ Provinsi set:', cleanProv);
    }

    if (kota) {
      const cleanKota = kota
        .replace(/^(Kabupaten|Kota|Kab\.?)\s*/i, '')
        .trim();
      setValue('kota', cleanKota);
      console.log('✅ Kota set:', cleanKota);
    }

    if (kecamatan) {
      const cleanKecamatan = kecamatan
        .replace(/^(Kecamatan|Kec\.?)\s*/i, '')
        .trim();
      setValue('kecamatan', cleanKecamatan);
      console.log('✅ Kecamatan set:', cleanKecamatan);
    }

    if (kelurahan) {
      const cleanKelurahan = kelurahan
        .replace(/^(Kelurahan|Desa|Kel\.?)\s*/i, '')
        .trim();
      setValue('kelurahan', cleanKelurahan);
      console.log('✅ Kelurahan set:', cleanKelurahan);
    }

    console.log('✅ Address extraction completed');
  };

  // Calculate location completeness
  useEffect(() => {
    let score = 0;
    if (watch('provinsi')) score += 20;
    if (watch('kota')) score += 30;
    if (watch('kecamatan')) score += 20;
    if (watch('kelurahan')) score += 15;
    if (watch('latitude') && watch('longitude')) score += 15;
    setLocationScore(score);
  }, [
    watch('provinsi'),
    watch('kota'),
    watch('kecamatan'),
    watch('kelurahan'),
    watch('latitude'),
    watch('longitude'),
  ]);

  // Get GPS location
  const handleGetCurrentLocation = () => {
    setIsLoadingLocation(true);
    const loadingToast = toast.loading('📡 Mendapatkan lokasi GPS...');

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          setValue('latitude', lat);
          setValue('longitude', lng);

          const newPos = { lat, lng };
          setMarkerPosition(newPos);

          if (map) {
            map.panTo(newPos);
            map.setZoom(17);
          }

          // Reverse geocode
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ location: newPos }, async (results, status) => {
            if (status === 'OK' && results && results[0]) {
              const address = results[0].formatted_address;
              setValue('alamat_lengkap', address);
              if (inputRef.current) {
                inputRef.current.value = address;
              }

              if (results[0].address_components) {
                await handleAddressComponents(results[0].address_components);
              }
            }
          });

          setIsLoadingLocation(false);
          toast.dismiss(loadingToast);
          toast.success('✅ Lokasi GPS didapatkan!');
        },
        (error) => {
          setIsLoadingLocation(false);
          toast.dismiss(loadingToast);
          toast.error('❌ Aktifkan izin lokasi di browser');
        }
      );
    }
  };

  const onMapLoad = useCallback((map: google.maps.Map) => {
    console.log('🗺️ Map loaded!');
    setMap(map);
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'from-green-500 to-emerald-500';
    if (score >= 50) return 'from-amber-500 to-orange-500';
    return 'from-slate-600 to-slate-500';
  };

  const hasCoordinates = watch('latitude') && watch('longitude');

  // ambil value sekali biar nggak panggil watch berkali-kali di JSX
  const latValue = watch('latitude');
  const lngValue = watch('longitude');

  if (loadError) {
    return (
      <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
        <p className="font-semibold mb-2">❌ Error loading Google Maps</p>
        <p className="text-sm">Check: NEXT_PUBLIC_GOOGLE_GEOCODING_API_KEY</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="p-6 rounded-xl bg-slate-800 border border-slate-700">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
          <p className="text-slate-300">Loading Google Maps...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Privacy Notice */}
      <AnimatePresence>
        {isPrivacyMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/30">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="h-4 w-4 text-amber-400" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-amber-400 mb-2 flex items-center gap-2">
                    <EyeOff className="h-4 w-4" />
                    Privacy Protection Mode
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed mb-2">
                    Alamat lengkap{' '}
                    <span className="font-semibold">disimpan</span> tapi{' '}
                    <span className="font-semibold">tidak ditampilkan</span> ke
                    publik.
                  </p>
                  <div className="flex items-start gap-2 text-xs bg-amber-500/10 rounded-lg p-2 border border-amber-500/20">
                    <Info className="h-3 w-3 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-300 mb-1">
                        Yang tampil di listing:
                      </p>
                      <p className="text-amber-200/80">
                        Kelurahan, Kecamatan, Kota, Provinsi
                      </p>
                      <p className="text-amber-200/60 mt-1 italic">
                        Alamat lengkap hanya terlihat setelah deal
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Autocomplete Input */}
      <FormField
        label="Cari Alamat Property"
        required
        error={errors.alamat_lengkap?.message}
        description="Ketik alamat dan WAJIB pilih dari dropdown Google Maps"
        hint="Contoh: Jl. Raya Kalirungkut No. 45, Surabaya"
        icon={<Search className="h-3 w-3 text-emerald-400" />}
        loading={isProcessing}
      >
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="Mulai ketik alamat..."
            defaultValue={watch('alamat_lengkap') || ''}
            className={cn(
              'flex h-12 w-full rounded-xl px-4 py-2 text-sm text-slate-100 pr-10',
              'bg-slate-900/50 backdrop-blur-sm',
              'border-2 border-slate-800 focus:border-emerald-500/50',
              'focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
              'placeholder:text-slate-500',
              'transition-all duration-300'
            )}
          />
          {isProcessing ? (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-400 animate-spin" />
          ) : (
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-400" />
          )}
        </div>
      </FormField>

      {/* Google Map */}
      <div className="relative">
        <div className="aspect-[16/10] w-full rounded-2xl border-2 border-slate-700 overflow-hidden shadow-2xl">
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={markerPosition || defaultCenter}
            zoom={markerPosition ? 17 : 12}
            onLoad={onMapLoad}
            options={{
              zoomControl: true,
              streetViewControl: true,
              mapTypeControl: true,
              fullscreenControl: true,
              styles: [],
            }}
          >
            {markerPosition && (
              <Marker
                position={markerPosition}
                animation={google.maps.Animation.DROP}
              />
            )}
          </GoogleMap>

          <motion.button
            type="button"
            onClick={handleGetCurrentLocation}
            disabled={isLoadingLocation}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              'absolute top-4 right-4 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg backdrop-blur-xl border-2 z-10',
              isLoadingLocation
                ? 'bg-slate-200 border-slate-300 text-slate-500'
                : 'bg-white hover:bg-emerald-50 border-emerald-500/50 text-emerald-700'
            )}
          >
            {isLoadingLocation ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {isLoadingLocation ? 'Mencari...' : 'GPS Saya'}
            </span>
          </motion.button>

          <AnimatePresence>
            {hasCoordinates && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-4 left-4 z-10"
              >
                <div className="bg-white/95 backdrop-blur-xl px-4 py-3 rounded-xl border border-emerald-500/30 shadow-lg">
                  <div className="flex items-center gap-3">
                    <Crosshair className="h-4 w-4 text-emerald-600" />
                    <div>
                      <p className="text-xs text-emerald-600 font-semibold">
                        Koordinat
                      </p>
                      <p className="text-xs text-slate-700 font-mono">
                        {latValue != null && latValue !== ''
                          ? Number(latValue).toFixed(6) // ⬅️ aman untuk string/number
                          : '-'}
                        ,{' '}
                        {lngValue != null && lngValue !== ''
                          ? Number(lngValue).toFixed(6)
                          : '-'}
                      </p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Location Score */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl bg-slate-900/50 border border-slate-800"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <MapPin className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-200">
                Location Completeness
              </h4>
              <p className="text-xs text-slate-500">
                Kelengkapan data lokasi
              </p>
            </div>
          </div>
          <span className="text-2xl font-bold text-slate-200">
            {locationScore}%
          </span>
        </div>

        <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className={`h-full bg-gradient-to-r ${getScoreColor(
              locationScore
            )}`}
            animate={{ width: `${locationScore}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { label: 'Provinsi', checked: !!watch('provinsi') },
            { label: 'Kota', checked: !!watch('kota') },
            { label: 'Kecamatan', checked: !!watch('kecamatan') },
            { label: 'Kelurahan', checked: !!watch('kelurahan') },
            { label: 'Koordinat', checked: hasCoordinates },
          ].map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium',
                item.checked
                  ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                  : 'bg-slate-800/50 text-slate-500 border border-slate-700/50'
              )}
            >
              {item.checked ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <AlertCircle className="h-3 w-3" />
              )}
              <span>{item.label}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Data Lokasi - READONLY INPUTS WITH CHECKMARKS */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-px bg-slate-700 flex-1"></div>
          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
            Data Lokasi (Terisi Otomatis)
          </span>
          <div className="h-px bg-slate-700 flex-1"></div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Provinsi" badge="Auto">
            <div className="relative">
              <input
                type="text"
                value={watch('provinsi') || ''}
                readOnly
                className={cn(
                  'flex h-11 w-full rounded-xl px-4 py-2 text-sm pr-10',
                  'bg-slate-900/70 backdrop-blur-sm border-2',
                  watch('provinsi')
                    ? 'text-slate-100 border-emerald-500/30 bg-emerald-500/5'
                    : 'text-slate-500 border-slate-800',
                  'cursor-not-allowed transition-all duration-300'
                )}
                placeholder="Belum terisi"
              />
              {watch('provinsi') && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 30,
                  }}
                >
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                </motion.div>
              )}
            </div>
          </FormField>

          <FormField
            label="Kota"
            required
            error={errors.kota?.message}
            badge="Auto"
          >
            <div className="relative">
              <input
                type="text"
                value={watch('kota') || ''}
                readOnly
                className={cn(
                  'flex h-11 w-full rounded-xl px-4 py-2 text-sm pr-10',
                  'bg-slate-900/70 backdrop-blur-sm border-2',
                  watch('kota')
                    ? 'text-slate-100 border-emerald-500/30 bg-emerald-500/5'
                    : 'text-slate-500 border-slate-800',
                  'cursor-not-allowed transition-all duration-300'
                )}
                placeholder="Belum terisi"
              />
              {watch('kota') && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 30,
                  }}
                >
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                </motion.div>
              )}
            </div>
          </FormField>

          <FormField label="Kecamatan" badge="Auto">
            <div className="relative">
              <input
                type="text"
                value={watch('kecamatan') || ''}
                readOnly
                className={cn(
                  'flex h-11 w-full rounded-xl px-4 py-2 text-sm pr-10',
                  'bg-slate-900/70 backdrop-blur-sm border-2',
                  watch('kecamatan')
                    ? 'text-slate-100 border-emerald-500/30 bg-emerald-500/5'
                    : 'text-slate-500 border-slate-800',
                  'cursor-not-allowed transition-all duration-300'
                )}
                placeholder="Belum terisi"
              />
              {watch('kecamatan') && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 30,
                  }}
                >
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                </motion.div>
              )}
            </div>
          </FormField>

          <FormField label="Kelurahan" badge="Auto">
            <div className="relative">
              <input
                type="text"
                value={watch('kelurahan') || ''}
                readOnly
                className={cn(
                  'flex h-11 w-full rounded-xl px-4 py-2 text-sm pr-10',
                  'bg-slate-900/70 backdrop-blur-sm border-2',
                  watch('kelurahan')
                    ? 'text-slate-100 border-emerald-500/30 bg-emerald-500/5'
                    : 'text-slate-500 border-slate-800',
                  'cursor-not-allowed transition-all duration-300'
                )}
                placeholder="Belum terisi"
              />
              {watch('kelurahan') && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 30,
                  }}
                >
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                </motion.div>
              )}
            </div>
          </FormField>
        </div>
      </div>

      {/* Tips */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20"
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
            <span>💡</span>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-emerald-400 mb-2">
              Cara Pakai
            </h4>
            <ul className="text-xs text-slate-300 space-y-1.5">
              <li className="flex gap-2">
                <span className="text-emerald-400">1.</span>
                <span>Ketik alamat di kotak pencarian</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400">2.</span>
                <span>
                  <strong>WAJIB pilih</strong> dari dropdown yang muncul
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400">3.</span>
                <span>
                  Map akan zoom & data lokasi terisi otomatis
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400">4.</span>
                <span>
                  Data akan tersimpan saat navigasi antar step
                </span>
              </li>
            </ul>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

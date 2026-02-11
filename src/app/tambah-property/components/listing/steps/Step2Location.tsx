'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
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
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';

// ====== CONFIG ======
interface Step2Props {
  form: UseFormReturn<ListingFormData>;
}

const libraries: ('places')[] = ['places'];

// Batas geografis Indonesia untuk restriction map
const INDONESIA_BOUNDS = {
  north: 6.2,     // kira-kira Sabang
  south: -11.0,   // kira-kira Rote
  west: 95.0,     // Aceh
  east: 141.0,    // Papua
};

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

// Center kira-kira tengah Indonesia
const defaultCenter = {
  lat: -2.5,
  lng: 118.0,
};

const defaultZoom = 5;

// ====== HELPER ======
function debounce<F extends (...args: any[]) => void>(fn: F, delay: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<F>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ====== COMPONENT ======
export function Step2Location({ form }: Step2Props) {
  const {
    watch,
    setValue,
    formState: { errors },
  } = form;

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_GEOCODING_API_KEY || '',
    libraries,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markerPosition, setMarkerPosition] =
    useState<google.maps.LatLngLiteral | null>(null);

  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [locationScore, setLocationScore] = useState(0);

  const [alamatInput, setAlamatInput] = useState('');

  const autocompleteServiceRef =
    useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(
    null
  );

  const jenisTransaksi = watch('jenis_transaksi');
  const isPrivacyMode =
    jenisTransaksi === 'SECONDARY' || jenisTransaksi === 'SEWA';

  // Sinkron awal dari form -> state input
  useEffect(() => {
    const alamat = watch('alamat_lengkap') || '';
    setAlamatInput(alamat);
  }, [watch('alamat_lengkap')]);

  // Init services (hanya Indonesia)
  useEffect(() => {
    if (!isLoaded || !window.google) return;

    if (!autocompleteServiceRef.current) {
      autocompleteServiceRef.current =
        new google.maps.places.AutocompleteService();
    }
    if (!placesServiceRef.current && map) {
      placesServiceRef.current = new google.maps.places.PlacesService(map);
    }
  }, [isLoaded, map]);

  // Restore map position dari lat/lng
  useEffect(() => {
    const lat = watch('latitude');
    const lng = watch('longitude');

    if (lat && lng && map) {
      const position = { lat: Number(lat), lng: Number(lng) };
      setMarkerPosition(position);
      map.panTo(position);
      map.setZoom(17);
    }
  }, [watch('latitude'), watch('longitude'), map]);

  const handleAddressComponents = (
    components: google.maps.GeocoderAddressComponent[]
  ) => {
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

    if (provinsi) {
      const cleanProv = provinsi
        .replace(/^(Provinsi|Province|Prov\.?)\s*/i, '')
        .trim();
      setValue('provinsi', cleanProv);
    }
    if (kota) {
      const cleanKota = kota
        .replace(/^(Kabupaten|Kota|Kab\.?)\s*/i, '')
        .trim();
      setValue('kota', cleanKota);
    }
    if (kecamatan) {
      const cleanKecamatan = kecamatan
        .replace(/^(Kecamatan|Kec\.?)\s*/i, '')
        .trim();
      setValue('kecamatan', cleanKecamatan);
    }
    if (kelurahan) {
      const cleanKelurahan = kelurahan
        .replace(/^(Kelurahan|Desa|Kel\.?)\s*/i, '')
        .trim();
      setValue('kelurahan', cleanKelurahan);
    }
  };

  // Auto cari tempat terdekat di Indonesia tiap user berhenti mengetik
  const fetchNearestPlace = useCallback(
    debounce((input: string) => {
      if (
        !input ||
        !autocompleteServiceRef.current ||
        !placesServiceRef.current
      ) {
        return;
      }

      setIsProcessing(true);

      autocompleteServiceRef.current
        .getPlacePredictions({
          input,
          // batasi ke Indonesia
          componentRestrictions: { country: 'id' },
        })
        .then((response) => {
          const predictions = response.predictions;
          if (!predictions || predictions.length === 0) {
            setIsProcessing(false);
            return;
          }

          const best = predictions[0];
          const request: google.maps.places.PlaceDetailsRequest = {
            placeId: best.place_id,
            fields: ['geometry', 'address_components'],
          };

          placesServiceRef.current!.getDetails(
            request,
            (place, status) => {
              if (
                status === google.maps.places.PlacesServiceStatus.OK &&
                place &&
                place.geometry &&
                place.geometry.location
              ) {
                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();
                const coords = { lat, lng };

                setValue('latitude', lat);
                setValue('longitude', lng);
                setMarkerPosition(coords);
                if (map) {
                  map.panTo(coords);
                  map.setZoom(17);
                }

                if (place.address_components) {
                  handleAddressComponents(place.address_components);
                }
              }
              setIsProcessing(false);
            }
          );
        })
        .catch(() => {
          setIsProcessing(false);
        });
    }, 500),
    [map, setValue]
  );

  // Trigger auto-locate ketika alamatInput berubah
  useEffect(() => {
    if (!isLoaded) return;
    if (!alamatInput || alamatInput.trim().length < 5) return;
    fetchNearestPlace(alamatInput);
  }, [alamatInput, isLoaded, fetchNearestPlace]);

  // Hitung skor kelengkapan
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

  // GPS: tetap dalam Indonesia, area dari geocoder
  const handleGetCurrentLocation = () => {
    setIsLoadingLocation(true);
    const loadingToast = toast.loading('📡 Mendapatkan lokasi GPS...');

    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const coords = { lat, lng };

        setValue('latitude', lat);
        setValue('longitude', lng);
        setMarkerPosition(coords);
        if (map) {
          map.panTo(coords);
          map.setZoom(17);
        }

        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: coords }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            if (results[0].address_components) {
              handleAddressComponents(results[0].address_components);
            }
          }
        });

        setIsLoadingLocation(false);
        toast.dismiss(loadingToast);
        toast.success('✅ Lokasi GPS didapatkan!');
      },
      () => {
        setIsLoadingLocation(false);
        toast.dismiss(loadingToast);
        toast.error('❌ Aktifkan izin lokasi di browser');
      }
    );
  };

  const onMapLoad = useCallback((m: google.maps.Map) => {
    setMap(m);

    // Set initial bounds & restriction Indonesia
    const bounds = new google.maps.LatLngBounds(
      { lat: INDONESIA_BOUNDS.south, lng: INDONESIA_BOUNDS.west },
      { lat: INDONESIA_BOUNDS.north, lng: INDONESIA_BOUNDS.east }
    );
    m.fitBounds(bounds);
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'from-green-500 to-emerald-500';
    if (score >= 50) return 'from-amber-500 to-orange-500';
    return 'from-slate-600 to-slate-500';
  };

  const hasCoordinates = watch('latitude') && watch('longitude');
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
                    Alamat lengkap disimpan, tapi tidak ditampilkan ke publik.
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
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input alamat */}
      <FormField
        label="Alamat Lengkap Property"
        required
        error={errors.alamat_lengkap?.message}
        description="Tulis alamat selengkap mungkin. Sistem akan otomatis mencari titik terdekat di Indonesia, dan mengisi peta + area."
        hint="Contoh: Grand Pakuwon Cluster Adelaide JF10-32, Surabaya"
        icon={<Search className="h-3 w-3 text-emerald-400" />}
        loading={isProcessing}
      >
        <div className="relative">
          <input
            type="text"
            placeholder="Ketik alamat lengkap (Indonesia saja)..."
            value={alamatInput}
            onChange={(e) => {
              setAlamatInput(e.target.value);
              setValue('alamat_lengkap', e.target.value);
            }}
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

      {/* Map hanya Indonesia */}
      <div className="relative">
        <div className="aspect-[16/10] w-full rounded-2xl border-2 border-slate-700 overflow-hidden shadow-2xl">
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={markerPosition || defaultCenter}
            zoom={markerPosition ? 17 : defaultZoom}
            onLoad={onMapLoad}
            options={{
              zoomControl: true,
              streetViewControl: true,
              mapTypeControl: true,
              fullscreenControl: true,
              styles: [],
              restriction: {
                latLngBounds: INDONESIA_BOUNDS,
                strictBounds: true,
              },
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
                          ? Number(latValue).toFixed(6)
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

      {/* Data lokasi auto */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-px bg-slate-700 flex-1" />
          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
            Data Lokasi (Terisi Otomatis)
          </span>
          <div className="h-px bg-slate-700 flex-1" />
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
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
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
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
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
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
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
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
              )}
            </div>
          </FormField>
        </div>
      </div>
    </motion.div>
  );
}

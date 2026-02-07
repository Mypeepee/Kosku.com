'use client';

import React, { useState, useEffect, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { ListingFormData } from '@/lib/validations/listing';
import { FormField } from '../FormField';
import { Select } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, Loader2, Crosshair, CheckCircle2, AlertCircle, EyeOff, ShieldCheck, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { useJsApiLoader, GoogleMap, Marker } from '@react-google-maps/api';

interface Step2Props {
  form: UseFormReturn<ListingFormData>;
}

interface Region {
  id: string;
  nama: string;
}

const BASE_API = "https://ibnux.github.io/data-indonesia";
const libraries: ("places")[] = ["places"];

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

const defaultCenter = {
  lat: -7.2575,
  lng: 112.7521
};

export function Step2Location({ form }: Step2Props) {
  const { watch, setValue, formState: { errors } } = form;
  
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_GEOCODING_API_KEY || '',
    libraries: libraries,
  });

  const autocompleteInputRef = useRef<HTMLInputElement>(null);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markerPosition, setMarkerPosition] = useState<google.maps.LatLngLiteral | null>(null);
  
  // State for location hierarchy
  const [provinsiList, setProvinsiList] = useState<Region[]>([]);
  const [kotaList, setKotaList] = useState<Region[]>([]);
  const [kecamatanList, setKecamatanList] = useState<Region[]>([]);
  const [kelurahanList, setKelurahanList] = useState<Region[]>([]);
  
  // Loading states
  const [loadingProvinsi, setLoadingProvinsi] = useState(false);
  const [loadingKota, setLoadingKota] = useState(false);
  const [loadingKecamatan, setLoadingKecamatan] = useState(false);
  const [loadingKelurahan, setLoadingKelurahan] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Selected IDs for cascading
  const [selectedProvinsiId, setSelectedProvinsiId] = useState<string>('');
  const [selectedKotaId, setSelectedKotaId] = useState<string>('');
  const [selectedKecamatanId, setSelectedKecamatanId] = useState<string>('');

  // Location completeness score
  const [locationScore, setLocationScore] = useState(0);

  // Privacy check
  const jenisTransaksi = watch('jenis_transaksi');
  const isPrivacyMode = jenisTransaksi === 'SECONDARY' || jenisTransaksi === 'SEWA';

  // Fetch Provinsi on mount
  useEffect(() => {
    fetchProvinsi();
  }, []);

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (isLoaded && autocompleteInputRef.current && !autocomplete) {
      const autocompleteInstance = new google.maps.places.Autocomplete(
        autocompleteInputRef.current,
        {
          componentRestrictions: { country: 'id' },
          fields: ['formatted_address', 'address_components', 'geometry', 'name', 'place_id'],
          types: ['geocode', 'establishment'],
        }
      );

      autocompleteInstance.addListener('place_changed', async () => {
        const place = autocompleteInstance.getPlace();
        
        if (!place.geometry || !place.geometry.location) {
          toast.error('❌ Lokasi tidak ditemukan. Pilih dari dropdown yang muncul.');
          return;
        }

        setIsProcessing(true);

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const fullAddress = place.formatted_address || place.name || '';

        // Save to form
        setValue('alamat_lengkap', fullAddress);
        setValue('latitude', lat);
        setValue('longitude', lng);

        // Update map
        setMarkerPosition({ lat, lng });
        if (map) {
          map.panTo({ lat, lng });
          map.setZoom(17);
        }

        // Extract address components and auto-fill
        if (place.address_components) {
          await extractAndFillAddressComponents(place.address_components);
        }

        setIsProcessing(false);
        toast.success('✅ Lokasi berhasil dipilih!', {
          duration: 3000,
          icon: '📍',
        });
      });

      setAutocomplete(autocompleteInstance);
    }
  }, [isLoaded, map, autocomplete]);

  // Extract and auto-fill address components
  const extractAndFillAddressComponents = async (components: google.maps.GeocoderAddressComponent[]) => {
    let extractedProvinsi = '';
    let extractedKota = '';
    let extractedKecamatan = '';
    let extractedKelurahan = '';

    // Extract from Google
    components.forEach((component) => {
      const types = component.types;
      
      if (types.includes('administrative_area_level_1')) {
        extractedProvinsi = component.long_name;
      }
      if (types.includes('administrative_area_level_2')) {
        extractedKota = component.long_name;
      }
      if (types.includes('administrative_area_level_3')) {
        extractedKecamatan = component.long_name;
      }
      if (types.includes('administrative_area_level_4') || types.includes('sublocality_level_1') || types.includes('sublocality')) {
        extractedKelurahan = component.long_name;
      }
    });

    console.log('Extracted:', { extractedProvinsi, extractedKota, extractedKecamatan, extractedKelurahan });

    // Clean province name
    if (extractedProvinsi) {
      const cleanProvinsi = extractedProvinsi
        .replace(/^(Provinsi|Province|Prov\.?|Propinsi)\s*/i, '')
        .replace(/\s+(Provinsi|Province)$/i, '')
        .trim();
      
      setValue('provinsi', cleanProvinsi);
      
      // Match with Indonesian data
      const matchedProv = provinsiList.find(p => {
        const pNorm = p.nama.toLowerCase().replace(/\s+/g, '');
        const cNorm = cleanProvinsi.toLowerCase().replace(/\s+/g, '');
        return pNorm.includes(cNorm) || cNorm.includes(pNorm);
      });
      
      if (matchedProv) {
        setSelectedProvinsiId(matchedProv.id);
        await fetchKota(matchedProv.id);
        
        // Wait and match Kota
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (extractedKota) {
          const cleanKota = extractedKota
            .replace(/^(Kabupaten|Kota|Kab\.?)\s*/i, '')
            .replace(/\s+(Regency|City)$/i, '')
            .trim();
          
          setValue('kota', cleanKota);
          
          // Force re-fetch to ensure kotaList is populated
          const res = await fetch(`${BASE_API}/kabupaten/${matchedProv.id}.json`);
          const kotaData: Region[] = await res.json();
          setKotaList(kotaData.sort((a, b) => a.nama.localeCompare(b.nama)));
          
          const matchedKota = kotaData.find(k => {
            const kNorm = k.nama.toLowerCase().replace(/\s+/g, '');
            const cNorm = cleanKota.toLowerCase().replace(/\s+/g, '');
            return kNorm.includes(cNorm) || cNorm.includes(kNorm);
          });
          
          if (matchedKota) {
            setSelectedKotaId(matchedKota.id);
            await fetchKecamatan(matchedKota.id);
            
            // Wait and match Kecamatan
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (extractedKecamatan) {
              const cleanKecamatan = extractedKecamatan
                .replace(/^(Kecamatan|Kec\.?)\s*/i, '')
                .replace(/\s+(District)$/i, '')
                .trim();
              
              setValue('kecamatan', cleanKecamatan);
              
              const resKec = await fetch(`${BASE_API}/kecamatan/${matchedKota.id}.json`);
              const kecData: Region[] = await resKec.json();
              setKecamatanList(kecData.sort((a, b) => a.nama.localeCompare(b.nama)));
              
              const matchedKec = kecData.find(k => {
                const kNorm = k.nama.toLowerCase().replace(/\s+/g, '');
                const cNorm = cleanKecamatan.toLowerCase().replace(/\s+/g, '');
                return kNorm.includes(cNorm) || cNorm.includes(kNorm);
              });
              
              if (matchedKec) {
                setSelectedKecamatanId(matchedKec.id);
                await fetchKelurahan(matchedKec.id);
                
                // Wait and match Kelurahan
                await new Promise(resolve => setTimeout(resolve, 500));
                
                if (extractedKelurahan) {
                  const cleanKelurahan = extractedKelurahan
                    .replace(/^(Kelurahan|Desa|Kel\.?)\s*/i, '')
                    .replace(/\s+(Village|Subdistrict)$/i, '')
                    .trim();
                  
                  setValue('kelurahan', cleanKelurahan);
                }
              }
            }
          }
        }
      }
    }
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
  }, [watch('provinsi'), watch('kota'), watch('kecamatan'), watch('kelurahan'), watch('latitude'), watch('longitude')]);

  const fetchProvinsi = async () => {
    setLoadingProvinsi(true);
    try {
      const res = await fetch(`${BASE_API}/propinsi.json`);
      const data: Region[] = await res.json();
      setProvinsiList(data.sort((a, b) => a.nama.localeCompare(b.nama)));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingProvinsi(false);
    }
  };

  const fetchKota = async (provinsiId: string) => {
    setLoadingKota(true);
    try {
      const res = await fetch(`${BASE_API}/kabupaten/${provinsiId}.json`);
      const data: Region[] = await res.json();
      setKotaList(data.sort((a, b) => a.nama.localeCompare(b.nama)));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingKota(false);
    }
  };

  const fetchKecamatan = async (kotaId: string) => {
    setLoadingKecamatan(true);
    try {
      const res = await fetch(`${BASE_API}/kecamatan/${kotaId}.json`);
      const data: Region[] = await res.json();
      setKecamatanList(data.sort((a, b) => a.nama.localeCompare(b.nama)));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingKecamatan(false);
    }
  };

  const fetchKelurahan = async (kecamatanId: string) => {
    setLoadingKelurahan(true);
    try {
      const res = await fetch(`${BASE_API}/kelurahan/${kecamatanId}.json`);
      const data: Region[] = await res.json();
      setKelurahanList(data.sort((a, b) => a.nama.localeCompare(b.nama)));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingKelurahan(false);
    }
  };

  // Manual selection handlers
  const handleProvinsiChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selectedName = provinsiList.find(p => p.id === selectedId)?.nama || '';
    
    setSelectedProvinsiId(selectedId);
    setValue('provinsi', selectedName);
    setValue('kota', '');
    setValue('kecamatan', '');
    setValue('kelurahan', '');
    
    setSelectedKotaId('');
    setSelectedKecamatanId('');
    setKotaList([]);
    setKecamatanList([]);
    setKelurahanList([]);
    
    if (selectedId) fetchKota(selectedId);
  };

  const handleKotaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selectedName = kotaList.find(k => k.id === selectedId)?.nama || '';
    
    setSelectedKotaId(selectedId);
    setValue('kota', selectedName);
    setValue('kecamatan', '');
    setValue('kelurahan', '');
    
    setSelectedKecamatanId('');
    setKecamatanList([]);
    setKelurahanList([]);
    
    if (selectedId) fetchKecamatan(selectedId);
  };

  const handleKecamatanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selectedName = kecamatanList.find(k => k.id === selectedId)?.nama || '';
    
    setSelectedKecamatanId(selectedId);
    setValue('kecamatan', selectedName);
    setValue('kelurahan', '');
    
    setKelurahanList([]);
    
    if (selectedId) fetchKelurahan(selectedId);
  };

  const handleKelurahanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedName = kelurahanList.find(k => k.id === e.target.value)?.nama || '';
    setValue('kelurahan', selectedName);
  };

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
          setMarkerPosition({ lat, lng });
          
          if (map) {
            map.panTo({ lat, lng });
            map.setZoom(17);
          }

          await reverseGeocode(lat, lng);
          
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

  // Reverse Geocode
  const reverseGeocode = async (lat: number, lng: number) => {
    if (!isLoaded) return;

    setIsProcessing(true);

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, async (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const address = results[0].formatted_address;
        setValue('alamat_lengkap', address);
        
        // Update autocomplete input display
        if (autocompleteInputRef.current) {
          autocompleteInputRef.current.value = address;
        }
        
        if (results[0].address_components) {
          await extractAndFillAddressComponents(results[0].address_components);
        }
      }
      
      setIsProcessing(false);
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'from-green-500 to-emerald-500';
    if (score >= 50) return 'from-amber-500 to-orange-500';
    return 'from-slate-600 to-slate-500';
  };

  const hasCoordinates = watch('latitude') && watch('longitude');

  if (loadError) {
    return (
      <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
        <p className="font-semibold mb-2">❌ Error loading Google Maps</p>
        <p className="text-sm">Check: NEXT_PUBLIC_GOOGLE_GEOCODING_API_KEY in .env.local</p>
        <p className="text-xs mt-2 text-slate-500">Make sure Maps JavaScript API & Places API are enabled</p>
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
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Alamat lengkap <span className="font-semibold">disimpan</span> tapi <span className="font-semibold">tidak ditampilkan</span> ke publik. Hanya <span className="text-amber-200">Kelurahan, Kecamatan, Kota</span> yang terlihat.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Google Maps Search Input */}
      <FormField
        label="Cari Alamat Property"
        required
        error={errors.alamat_lengkap?.message}
        description="Ketik alamat dan pilih dari dropdown. Provinsi-Kelurahan akan terisi otomatis."
        hint="Contoh: Jl. Raya Kalirungkut No. 45, Surabaya"
        icon={<Search className="h-3 w-3 text-emerald-400" />}
        loading={isProcessing}
      >
        <div className="relative group">
          {/* Glow effect */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl opacity-0 group-focus-within:opacity-20 blur transition-opacity duration-300"></div>
          
          <input
            ref={autocompleteInputRef}
            type="text"
            placeholder="Ketik alamat property di sini..."
            disabled={!isLoaded}
            className={cn(
              "relative flex h-12 w-full rounded-xl px-4 py-2 text-sm text-slate-100 pr-10",
              "bg-slate-900/50 backdrop-blur-sm",
              "border-2 border-slate-800 focus:border-emerald-500/50",
              "focus:outline-none focus:ring-2 focus:ring-emerald-500/20",
              "placeholder:text-slate-500",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "transition-all duration-300"
            )}
          />
          
          {isProcessing ? (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-400 animate-spin" />
          ) : (
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-400 pointer-events-none" />
          )}
        </div>
      </FormField>

      {/* Google Map */}
      <div className="relative">
        <div className="aspect-[16/10] w-full rounded-2xl border-2 border-slate-700 overflow-hidden relative">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={markerPosition || defaultCenter}
              zoom={markerPosition ? 17 : 12}
              onLoad={setMap}
              options={{
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: true,
                styles: [
                  { featureType: 'all', elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
                  { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
                  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
                ]
              }}
            >
              {markerPosition && <Marker position={markerPosition} animation={google.maps.Animation.DROP} />}
            </GoogleMap>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <div className="text-center">
                <Loader2 className="h-8 w-8 text-emerald-400 animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-400">Loading Google Maps...</p>
              </div>
            </div>
          )}

          <motion.button
            type="button"
            onClick={handleGetCurrentLocation}
            disabled={isLoadingLocation || !isLoaded}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "absolute top-4 right-4 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg backdrop-blur-xl border-2 z-10",
              isLoadingLocation || !isLoaded
                ? "bg-slate-800/80 border-slate-700 text-slate-400"
                : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border-emerald-500/50 text-white"
            )}
          >
            {isLoadingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
            <span className="hidden sm:inline">{isLoadingLocation ? 'Mencari...' : 'GPS Saya'}</span>
          </motion.button>

          <AnimatePresence>
            {hasCoordinates && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-4 left-4 z-10"
              >
                <div className="bg-slate-900/95 backdrop-blur-xl px-4 py-3 rounded-xl border border-emerald-500/30 shadow-lg">
                  <div className="flex items-center gap-3">
                    <Crosshair className="h-4 w-4 text-emerald-400" />
                    <div>
                      <p className="text-xs text-emerald-400 font-semibold">GPS Coordinates</p>
                      <p className="text-xs text-slate-200 font-mono">
                        {watch('latitude')?.toFixed(6)}, {watch('longitude')?.toFixed(6)}
                      </p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <p className="text-xs text-slate-500 mt-3 flex items-center gap-2">
          <span>💡</span>
          <span>Pilih alamat dari dropdown untuk hasil terbaik. Provinsi-Kelurahan akan terisi otomatis.</span>
        </p>
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
              <h4 className="text-sm font-semibold text-slate-200">Location Completeness</h4>
              <p className="text-xs text-slate-500">Kelengkapan data lokasi</p>
            </div>
          </div>
          <span className="text-2xl font-bold text-slate-200">{locationScore}%</span>
        </div>

        <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className={`h-full bg-gradient-to-r ${getScoreColor(locationScore)}`}
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
                "flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium",
                item.checked 
                  ? "bg-green-500/10 text-green-400 border border-green-500/30" 
                  : "bg-slate-800/50 text-slate-500 border border-slate-700/50"
              )}
            >
              {item.checked ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
              <span>{item.label}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Manual Override */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-px bg-slate-700 flex-1"></div>
          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Koreksi Manual (Jika Perlu)</span>
          <div className="h-px bg-slate-700 flex-1"></div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Provinsi" badge="Auto">
            <Select value={selectedProvinsiId} onChange={handleProvinsiChange} disabled={loadingProvinsi}>
              <option value="">{watch('provinsi') || 'Pilih Provinsi'}</option>
              {provinsiList.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
            </Select>
          </FormField>

          <FormField label="Kota" required error={errors.kota?.message} badge="Auto" loading={loadingKota}>
            <Select value={selectedKotaId} onChange={handleKotaChange} disabled={!selectedProvinsiId || loadingKota}>
              <option value="">{watch('kota') || 'Pilih Kota'}</option>
              {kotaList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </Select>
          </FormField>

          <FormField label="Kecamatan" badge="Auto" loading={loadingKecamatan}>
            <Select value={selectedKecamatanId} onChange={handleKecamatanChange} disabled={!selectedKotaId || loadingKecamatan}>
              <option value="">{watch('kecamatan') || 'Pilih Kecamatan'}</option>
              {kecamatanList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </Select>
          </FormField>

          <FormField label="Kelurahan" badge="Auto" loading={loadingKelurahan}>
            <Select 
              value={kelurahanList.find(k => k.nama === watch('kelurahan'))?.id || ''}
              onChange={handleKelurahanChange} 
              disabled={!selectedKecamatanId || loadingKelurahan}
            >
              <option value="">{watch('kelurahan') || 'Pilih Kelurahan'}</option>
              {kelurahanList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </Select>
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
            <h4 className="text-sm font-semibold text-emerald-400 mb-2">Tips Lokasi Akurat</h4>
            <ul className="text-xs text-slate-300 space-y-1.5">
              <li className="flex gap-2"><span className="text-emerald-400">•</span><span>Ketik alamat lengkap dan <strong>pilih dari dropdown</strong> yang muncul</span></li>
              <li className="flex gap-2"><span className="text-emerald-400">•</span><span>Provinsi-Kelurahan akan <strong>terisi otomatis</strong></span></li>
              <li className="flex gap-2"><span className="text-emerald-400">•</span><span>Gunakan <strong>"GPS Saya"</strong> jika property di lokasi Anda saat ini</span></li>
            </ul>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

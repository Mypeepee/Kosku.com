"use client";
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { GoogleMap, Circle, OverlayView, useJsApiLoader } from "@react-google-maps/api";
import { Icon } from "@iconify/react";
import {
  KATEGORI_POI,
  RADIUS_POI_METER,
  URUTAN_KATEGORI,
  formatJarak,
  type KategoriPOI,
  type TempatTerdekat,
} from "@/lib/nearbyPlaces";

/**
 * Peta detail properti — dipakai halaman Jual, Lelang, DAN Sewa.
 *
 * Dulu ada dua peta: Google Maps di Jual/Lelang, dan Leaflet (KosMap) di Sewa.
 * Keduanya punya separuh dari yang dibutuhkan — Google Maps punya tampilan yang
 * dipakai di seluruh situs, Leaflet punya pencarian fasilitas sekitar yang
 * benar-benar berfungsi. Sekarang satu komponen.
 *
 * KOMPONEN INI TIDAK LAGI MENCARI SENDIRI. Dulu ia memanggil Overpass dari
 * browser setiap kali dipasang; hasilnya seperti undian (server publik sering
 * 504) dan permintaannya berulang untuk jawaban yang tidak pernah berubah.
 * Sekarang pencarian dilakukan sekali di server dan disimpan
 * (src/lib/nearbyPlaces.server.ts); peta menerima hasilnya sebagai prop, sama
 * persis dengan yang dipakai daftar "yang ada di sekitar" di bawahnya — satu
 * data, dua tampilan, mustahil berselisih.
 */

interface GoogleMapViewProps {
  address?: string;
  lat?: number | null;
  lng?: number | null;
  /** Tempat di sekitar, hasil pemindaian server (lihat useSekitar). */
  tempat?: TempatTerdekat[];
  /** Radius pemindaian yang benar-benar dipakai — lingkaran & label ikut ini. */
  radius?: number;
  memuat?: boolean;
  gagal?: boolean;
  /** Tombol "Coba lagi" di kartu bawah-kiri. */
  onUlang?: () => void;
}

const libraries: ('places')[] = ['places'];

const mapContainerStyle = { width: "100%", height: "100%" };

export default function GoogleMapView({
  address,
  lat,
  lng,
  tempat,
  radius = RADIUS_POI_METER,
  memuat = false,
  gagal = false,
  onUlang,
}: GoogleMapViewProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
    language: 'id',
    region: 'ID',
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const [center, setCenter] = useState<google.maps.LatLngLiteral | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<KategoriPOI | "all">("all");
  const [aktif, setAktif] = useState<TempatTerdekat | null>(null);

  const nearbyPOI = useMemo(() => tempat ?? [], [tempat]);

  useEffect(() => {
    if (!isLoaded) return;

    const init = async () => {
      setLoading(true);
      setError(null);

      let finalLat = lat != null ? Number(lat) : null;
      let finalLng = lng != null ? Number(lng) : null;

      if (
        (finalLat == null || finalLng == null || isNaN(finalLat) || isNaN(finalLng) || (finalLat === 0 && finalLng === 0)) &&
        address
      ) {
        const coords = await geocodeAddress(address);
        if (coords) {
          finalLat = coords.lat;
          finalLng = coords.lng;
        } else {
          setError("Lokasi tidak ditemukan");
          setLoading(false);
          return;
        }
      }

      if (finalLat != null && finalLng != null && !isNaN(finalLat) && !isNaN(finalLng)) {
        setCenter({ lat: finalLat, lng: finalLng });
      } else {
        setError("Data lokasi tidak tersedia");
      }

      setLoading(false);
    };

    init();
  }, [isLoaded, lat, lng, address]);

  /** Kategori yang benar-benar ada hasilnya — chip kosong hanya menipu. */
  const kategoriTersedia = useMemo(
    () => URUTAN_KATEGORI.filter((k) => nearbyPOI.some((p) => p.kategori === k)),
    [nearbyPOI],
  );

  const poiTampil = useMemo(
    () => (filter === "all" ? nearbyPOI : nearbyPOI.filter((p) => p.kategori === filter)),
    [nearbyPOI, filter],
  );

  /**
   * Bingkai peta = lingkaran radius pemindaian, bukan zoom tetap 16.
   *
   * Radius pemindaian tidak selalu 800 m: aset pinggiran baru dapat cukup
   * tetangga di 3 km. Dengan zoom mati di 16, lingkaran seluas itu keluar
   * layar dan separuh pin jatuh di luar bingkai — pembaca melihat peta kosong
   * padahal datanya ada. `fitBounds` membuat semua yang dihitung selalu
   * terlihat, di lebar layar mana pun.
   */
  const pasKanBingkai = useCallback(
    (map: google.maps.Map | null, titik: google.maps.LatLngLiteral | null) => {
      if (!map || !titik) return;
      map.setCenter(titik);
      const lingkaran = new google.maps.Circle({ center: titik, radius });
      const batas = lingkaran.getBounds();
      if (batas) map.fitBounds(batas, 0);
      else map.setZoom(16);
    },
    [radius],
  );

  const onMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      pasKanBingkai(map, center);
    },
    [center, pasKanBingkai],
  );

  // Ketika center selesai di-set (setelah geocoding), paksa map ke posisi yang benar
  useEffect(() => {
    pasKanBingkai(mapRef.current, center);
  }, [center, pasKanBingkai]);

  const handleZoomIn = () => mapRef.current?.setZoom((mapRef.current.getZoom() ?? 16) + 1);
  const handleZoomOut = () => mapRef.current?.setZoom((mapRef.current.getZoom() ?? 16) - 1);
  const handleRecenter = () => pasKanBingkai(mapRef.current, center);

  // ====== LOADING ======
  if (!isLoaded || loading) {
    return (
      <div className="h-full w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-72 h-72 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
          <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-0 left-1/2 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        </div>
        <div className="text-center relative z-10">
          <div className="relative inline-block">
            <Icon icon="solar:map-bold-duotone" className="text-6xl text-emerald-400 animate-pulse mb-4" />
            <div className="absolute inset-0 animate-ping">
              <Icon icon="solar:map-bold-duotone" className="text-6xl text-emerald-400 opacity-30" />
            </div>
          </div>
          <p className="text-sm font-semibold text-gray-300">Memuat peta interaktif...</p>
          <div className="mt-4 flex gap-1.5 justify-center">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
          </div>
        </div>
      </div>
    );
  }

  // ====== ERROR ======
  if (loadError || error) {
    return (
      <div className="h-full w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="text-center bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
          <Icon icon="solar:map-point-remove-bold-duotone" className="text-6xl text-red-400 mb-3 mx-auto" />
          <p className="text-sm font-semibold text-red-300">{error ?? "Gagal memuat peta"}</p>
        </div>
      </div>
    );
  }

  if (!center) return null;

  return (
    <div className="relative h-full w-full">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={16}
        onLoad={onMapLoad}
        options={{
          zoomControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        }}
      >
        {/* Lingkaran = radius pemindaian yang benar-benar dipakai, bukan angka
            hiasan. Kalau ia menggambar 500 m sementara daftarnya menghitung
            3 km, pembaca menyimpulkan jarak yang salah dari gambar. */}
        <Circle
          center={center}
          radius={radius}
          options={{
            strokeColor: "#059669",
            strokeOpacity: 0.9,
            strokeWeight: 4,
            fillColor: "#10b981",
            fillOpacity: 0.15,
          }}
        />

        {/* Premier marker */}
        <OverlayView
          position={center}
          mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
          getPixelPositionOffset={() => ({ x: 0, y: 0 })}
        >
          <div style={{ position: "absolute", transform: "translate(-50%, -50%)", width: 56 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow:
                  "0 8px 32px rgba(16,185,129,0.4), 0 0 0 4px rgba(255,255,255,0.9), 0 0 0 6px rgba(16,185,129,0.2)",
                position: "relative",
                animation: "gmv-pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/logo/LogoSolusindoPremier.png"
                alt="P"
                style={{ width: 36, height: 36, objectFit: "contain" }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: -12,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 0,
                  height: 0,
                  borderLeft: "12px solid transparent",
                  borderRight: "12px solid transparent",
                  borderTop: "14px solid #10b981",
                }}
              />
            </div>
            <style>{`
              @keyframes gmv-pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
              }
            `}</style>
          </div>
        </OverlayView>

        {/* POI markers */}
        {poiTampil.map((p) => {
          const k = KATEGORI_POI[p.kategori];
          const dipilih = aktif?.id === p.id;
          return (
            <OverlayView
              key={p.id}
              position={{ lat: p.lat, lng: p.lon }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              getPixelPositionOffset={() => ({ x: 0, y: 0 })}
            >
              <div
                style={{
                  position: "absolute",
                  transform: "translate(-50%, -50%)",
                  zIndex: dipilih ? 20 : 1,
                }}
              >
                <button
                  onClick={() => setAktif(dipilih ? null : p)}
                  title={`${p.nama} — ${k.label} · ${formatJarak(p.jarak)}`}
                  aria-label={`${p.nama}, ${formatJarak(p.jarak)}`}
                  style={{
                    width: dipilih ? 40 : 34,
                    height: dipilih ? 40 : 34,
                    borderRadius: "50%",
                    background: k.warna,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "3px solid rgba(255,255,255,0.95)",
                    boxShadow: `0 4px 12px rgba(0,0,0,0.25), 0 0 0 2px ${k.warna}33`,
                    cursor: "pointer",
                    transition: "width 160ms ease, height 160ms ease",
                  }}
                >
                  <Icon icon={k.icon} style={{ color: "white", fontSize: dipilih ? 20 : 17 }} />
                </button>

                {/* Label hanya muncul saat pin diklik. Kalau semua pin berlabel,
                    peta padat justru tidak terbaca — persis masalah yang bikin
                    nama POI disembunyikan di peta mana pun. */}
                {dipilih && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "calc(100% + 8px)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      whiteSpace: "nowrap",
                      background: "rgba(255,255,255,0.97)",
                      borderRadius: 12,
                      padding: "6px 10px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                      pointerEvents: "none",
                    }}
                  >
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                      {p.nama}
                    </p>
                    <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>
                      {k.label} · {formatJarak(p.jarak)}
                    </p>
                  </div>
                )}
              </div>
            </OverlayView>
          );
        })}
      </GoogleMap>

      {/* ── Filter kategori (atas-kiri) ──
          Dibawa dari peta Sewa: tanpa penyaring, 60 pin dari 10 kategori jadi
          satu kerumunan warna dan pertanyaan "ada apotek tidak di sini?" tetap
          tidak terjawab. Hanya kategori yang ADA hasilnya yang ditampilkan. */}
      {kategoriTersedia.length > 0 && (
        <div className="absolute left-4 right-20 top-4 z-[500] flex gap-2 overflow-x-auto hide-scrollbar">
          <button
            onClick={() => {
              setFilter("all");
              setAktif(null);
            }}
            className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold shadow-lg backdrop-blur-2xl transition-all ${
              filter === "all"
                ? "bg-slate-900 text-white"
                : "border border-white/40 bg-white/80 text-slate-700 hover:bg-white"
            }`}
          >
            Semua {nearbyPOI.length}
          </button>

          {kategoriTersedia.map((k) => {
            const cfg = KATEGORI_POI[k];
            const jumlah = nearbyPOI.filter((p) => p.kategori === k).length;
            const dipilih = filter === k;
            return (
              <button
                key={k}
                onClick={() => {
                  setFilter(dipilih ? "all" : k);
                  setAktif(null);
                }}
                className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold shadow-lg backdrop-blur-2xl transition-all"
                style={
                  dipilih
                    ? { background: cfg.warna, color: "#fff" }
                    : {
                        background: "rgba(255,255,255,0.85)",
                        color: "#334155",
                        border: "1px solid rgba(255,255,255,0.5)",
                      }
                }
              >
                <Icon
                  icon={cfg.icon}
                  style={{ fontSize: 15, color: dipilih ? "#fff" : cfg.warna }}
                />
                {cfg.label}
                <span className={dipilih ? "opacity-80" : "text-slate-400"}>{jumlah}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Glassmorphism controls (top right) */}
      <div className="absolute top-4 right-4 z-[500] flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="group relative w-12 h-12 backdrop-blur-2xl bg-white/80 hover:bg-white/95 rounded-2xl shadow-lg hover:shadow-xl border border-white/40 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95"
          title="Perbesar"
        >
          <Icon icon="solar:add-circle-bold-duotone" className="text-2xl text-slate-700 group-hover:text-emerald-600 transition-colors" />
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/0 to-emerald-400/0 group-hover:from-emerald-400/20 group-hover:to-emerald-600/20 rounded-2xl transition-all duration-300" />
        </button>

        <button
          onClick={handleZoomOut}
          className="group relative w-12 h-12 backdrop-blur-2xl bg-white/80 hover:bg-white/95 rounded-2xl shadow-lg hover:shadow-xl border border-white/40 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95"
          title="Perkecil"
        >
          <Icon icon="solar:minus-circle-bold-duotone" className="text-2xl text-slate-700 group-hover:text-red-600 transition-colors" />
          <div className="absolute inset-0 bg-gradient-to-br from-red-400/0 to-red-400/0 group-hover:from-red-400/20 group-hover:to-red-600/20 rounded-2xl transition-all duration-300" />
        </button>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-300/50 to-transparent my-1" />

        <button
          onClick={handleRecenter}
          className="group relative w-12 h-12 backdrop-blur-2xl bg-white/80 hover:bg-white/95 rounded-2xl shadow-lg hover:shadow-xl border border-white/40 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95"
          title="Kembali ke Pusat"
        >
          <Icon icon="solar:compass-bold-duotone" className="text-2xl text-slate-700 group-hover:text-blue-600 transition-colors group-hover:rotate-180 duration-500" />
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400/0 to-blue-400/0 group-hover:from-blue-400/20 group-hover:to-blue-600/20 rounded-2xl transition-all duration-300" />
        </button>
      </div>

      {/* Floating badge (bottom left) */}
      <div className="absolute bottom-4 left-4 z-[500] backdrop-blur-2xl bg-white/80 border border-white/40 rounded-2xl shadow-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
              <Icon icon="solar:map-point-search-bold-duotone" className="text-xl text-white" />
            </div>
            <div className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full border-2 border-white bg-emerald-400 px-1 shadow-sm">
              <span className="text-[8px] font-bold text-white">{poiTampil.length}</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-medium text-slate-600">Fasilitas Terdekat</p>
            <p className="text-sm font-bold text-slate-800">
              {memuat
                ? "Mencari…"
                : gagal
                  ? "Gagal dimuat"
                  : `${poiTampil.length} Lokasi`}
            </p>
            {gagal && onUlang ? (
              <button
                onClick={onUlang}
                className="text-[9px] font-bold text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
              >
                Coba lagi
              </button>
            ) : (
              <p className="text-[9px] font-medium text-slate-500">
                {filter === "all"
                  ? `Radius ${radius >= 1000 ? `${(radius / 1000).toFixed(1).replace(".", ",")} km` : `${radius} m`}`
                  : KATEGORI_POI[filter].label}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address, region: "ID" }, (results, status) => {
      if (status === "OK" && results && results[0]) {
        const loc = results[0].geometry.location;
        resolve({ lat: loc.lat(), lng: loc.lng() });
      } else {
        resolve(null);
      }
    });
  });
}

"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { GoogleMap, Circle, OverlayView, useJsApiLoader } from "@react-google-maps/api";
import { Icon } from "@iconify/react";

interface POI {
  id: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
  icon: string;
  color: string;
  category: string;
}

interface GoogleMapViewProps {
  address?: string;
  lat?: number | null;
  lng?: number | null;
}

const libraries: ('places')[] = ['places'];

const mapContainerStyle = { width: "100%", height: "100%" };

// ====== FOURSQUARE POI ======
async function fetchPOIsWithFoursquare(lat: number, lon: number): Promise<POI[]> {
  const API_KEY = process.env.NEXT_PUBLIC_FOURSQUARE_API_KEY;
  if (!API_KEY) return [];
  try {
    const res = await fetch(
      `https://api.foursquare.com/v3/places/nearby?ll=${lat},${lon}&radius=500&limit=50`,
      { headers: { Accept: "application/json", Authorization: API_KEY } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.results) return [];
    return data.results.map((place: any) => {
      const categoryName = place.categories?.[0]?.name || "Unknown";
      const style = getIconStyle(categoryName);
      return {
        id: place.fsq_id,
        name: place.name,
        type: categoryName,
        lat: place.geocodes.main.latitude,
        lon: place.geocodes.main.longitude,
        ...style,
      };
    });
  } catch {
    return [];
  }
}

function getIconStyle(categoryName: string) {
  const lower = categoryName.toLowerCase();
  if (lower.includes("school") || lower.includes("university") || lower.includes("education"))
    return { icon: "solar:diploma-bold-duotone", color: "#3b82f6", category: "Pendidikan" };
  if (lower.includes("hospital") || lower.includes("clinic") || lower.includes("pharmacy"))
    return { icon: "solar:health-bold-duotone", color: "#ef4444", category: "Kesehatan" };
  if (lower.includes("mosque") || lower.includes("church") || lower.includes("temple"))
    return { icon: "solar:mosque-bold-duotone", color: "#8b5cf6", category: "Ibadah" };
  if (lower.includes("restaurant") || lower.includes("cafe") || lower.includes("food"))
    return { icon: "solar:chef-hat-bold-duotone", color: "#f97316", category: "Kuliner" };
  if (lower.includes("supermarket") || lower.includes("shop") || lower.includes("store"))
    return { icon: "solar:cart-large-bold-duotone", color: "#fbbf24", category: "Belanja" };
  if (lower.includes("bank") || lower.includes("atm"))
    return { icon: "solar:card-bold-duotone", color: "#06b6d4", category: "Keuangan" };
  if (lower.includes("bus") || lower.includes("station") || lower.includes("transit"))
    return { icon: "solar:bus-bold-duotone", color: "#10b981", category: "Transportasi" };
  if (lower.includes("police") || lower.includes("fire"))
    return { icon: "solar:shield-check-bold-duotone", color: "#64748b", category: "Keamanan" };
  return { icon: "solar:map-point-bold", color: "#94a3b8", category: "Lainnya" };
}

export default function GoogleMapView({ address, lat, lng }: GoogleMapViewProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
    language: 'id',
    region: 'ID',
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const [center, setCenter] = useState<google.maps.LatLngLiteral | null>(null);
  const [nearbyPOI, setNearbyPOI] = useState<POI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const pois = await fetchPOIsWithFoursquare(finalLat, finalLng);
        setNearbyPOI(pois);
      } else {
        setError("Data lokasi tidak tersedia");
      }

      setLoading(false);
    };

    init();
  }, [isLoaded, lat, lng, address]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    if (center) {
      map.setCenter(center);
      map.setZoom(16);
    }
  }, [center]);

  // Ketika center selesai di-set (setelah geocoding), paksa map ke posisi yang benar
  useEffect(() => {
    if (mapRef.current && center) {
      mapRef.current.setCenter(center);
      mapRef.current.setZoom(16);
    }
  }, [center]);

  const handleZoomIn = () => mapRef.current?.setZoom((mapRef.current.getZoom() ?? 16) + 1);
  const handleZoomOut = () => mapRef.current?.setZoom((mapRef.current.getZoom() ?? 16) - 1);
  const handleRecenter = () => {
    if (mapRef.current && center) {
      mapRef.current.setCenter(center);
      mapRef.current.setZoom(16);
    }
  };

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
        {/* Circle radius */}
        <Circle
          center={center}
          radius={500}
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
        {nearbyPOI.map((p) => (
          <OverlayView
            key={p.id}
            position={{ lat: p.lat, lng: p.lon }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            getPixelPositionOffset={() => ({ x: 0, y: 0 })}
          >
            <div
              title={`${p.name} — ${p.category}`}
              style={{
                position: "absolute",
                transform: "translate(-50%, -50%)",
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: p.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "3px solid rgba(255,255,255,0.95)",
                boxShadow: `0 4px 12px rgba(0,0,0,0.25), 0 0 0 2px ${p.color}33`,
                cursor: "pointer",
              }}
            >
              <Icon icon={p.icon} style={{ color: "white", fontSize: 18 }} />
            </div>
          </OverlayView>
        ))}
      </GoogleMap>

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
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white shadow-sm flex items-center justify-center">
              <span className="text-[8px] font-bold text-white">{nearbyPOI.length}</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] text-slate-600 font-medium">Fasilitas Terdekat</p>
            <p className="text-sm font-bold text-slate-800">{nearbyPOI.length} Lokasi</p>
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

"use client";
import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Icon } from "@iconify/react";

// --- FIX LEAFLET ICONS ---
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  iconUrl: "/leaflet/marker-icon.png",
  shadowUrl: "/leaflet/marker-shadow.png",
});

// --- PREMIER ICON (Enhanced) ---
const premierIcon = L.divIcon({
  html: `
    <div style="
      width:56px; 
      height:56px; 
      border-radius:50%; 
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      display:flex; 
      align-items:center; 
      justify-content:center; 
      box-shadow: 0 8px 32px rgba(16, 185, 129, 0.4), 0 0 0 4px rgba(255,255,255,0.9), 0 0 0 6px rgba(16, 185, 129, 0.2);
      position:relative; 
      animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    ">
      <img src="/images/logo/logopremier.svg" alt="P" style="width:36px; height:36px; object-fit:contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));" />
      <div style="
        position:absolute; 
        bottom:-12px; 
        left:50%; 
        transform:translateX(-50%); 
        width:0; 
        height:0; 
        border-left:12px solid transparent; 
        border-right:12px solid transparent; 
        border-top:14px solid #10b981;
        filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));
      "></div>
    </div>
    <style>
      @keyframes pulse {
        0%, 100% { 
          transform: scale(1);
          box-shadow: 0 8px 32px rgba(16, 185, 129, 0.4), 0 0 0 4px rgba(255,255,255,0.9), 0 0 0 6px rgba(16, 185, 129, 0.2);
        }
        50% { 
          transform: scale(1.05);
          box-shadow: 0 8px 32px rgba(16, 185, 129, 0.6), 0 0 0 4px rgba(255,255,255,0.9), 0 0 0 8px rgba(16, 185, 129, 0.3);
        }
      }
    </style>
  `,
  className: "",
  iconSize: [56, 56],
  iconAnchor: [28, 68],
  popupAnchor: [0, -60],
});

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

interface KosMapProps {
  address?: string;
  lat?: number | null;
  lng?: number | null;
}

// Hook untuk access map instance
function MapController({
  center,
  onMapReady,
}: {
  center: [number, number];
  onMapReady: (map: L.Map) => void;
}) {
  const map = useMap();

  useEffect(() => {
    onMapReady(map);
  }, [map, onMapReady]);

  useEffect(() => {
    map.setView(center, 16, { animate: true, duration: 1.2 });
  }, [center, map]);

  return null;
}

export default function KosMapWithNearby({ address, lat, lng }: KosMapProps) {
  const [center, setCenter] = useState<[number, number]>([-6.2088, 106.8456]);
  const [nearbyPOI, setNearbyPOI] = useState<POI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // =================================================================
  // GEOCODING - GOOGLE
  // =================================================================
  const geocodeWithGoogle = async (address: string) => {
    const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_GEOCODING_API_KEY;
    if (!API_KEY) return null;

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address
      )}&region=id&key=${API_KEY}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.status === "OK" && data.results.length > 0) {
        const loc = data.results[0].geometry.location;
        return { lat: loc.lat, lng: loc.lng };
      }
      return null;
    } catch (err) {
      console.error("Geocoding error:", err);
      return null;
    }
  };

  // =================================================================
  // POI FETCHING - FOURSQUARE
  // =================================================================
  const fetchPOIsWithFoursquare = async (lat: number, lon: number) => {
    const API_KEY = process.env.NEXT_PUBLIC_FOURSQUARE_API_KEY;
    if (!API_KEY) return [];

    const radius = 500;
    const limit = 50;

    try {
      const url = `https://api.foursquare.com/v3/places/nearby?ll=${lat},${lon}&radius=${radius}&limit=${limit}`;

      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: API_KEY,
        },
      });

      if (!res.ok) return [];

      const data = await res.json();
      if (!data.results) return [];

      return data.results.map((place: any) => {
        const categoryName = place.categories?.[0]?.name || "Unknown";
        const style = getIconStyleFromFoursquare(categoryName);

        return {
          id: place.fsq_id,
          name: place.name,
          type: categoryName,
          lat: place.geocodes.main.latitude,
          lon: place.geocodes.main.longitude,
          ...style,
        };
      });
    } catch (e) {
      return [];
    }
  };

  const getIconStyleFromFoursquare = (categoryName: string) => {
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
  };

  const createCustomIcon = (icon: string, color: string) =>
    L.divIcon({
      html: `
        <div style="
          background: ${color};
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid rgba(255,255,255,0.95);
          box-shadow: 0 4px 12px rgba(0,0,0,0.25), 0 0 0 2px ${color}33;
          transition: transform 0.2s;
        ">
          <iconify-icon icon="${icon}" style="color:white; font-size:20px;"></iconify-icon>
        </div>
      `,
      className: "",
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -20],
    });

  // =================================================================
  // INIT
  // =================================================================
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);

      let finalLat = lat ?? null;
      let finalLng = lng ?? null;

      if ((!finalLat || !finalLng) && address) {
        const geo = await geocodeWithGoogle(address);
        if (geo) {
          finalLat = geo.lat;
          finalLng = geo.lng;
        } else {
          setError("Lokasi tidak ditemukan");
          setLoading(false);
          return;
        }
      }

      if (finalLat != null && finalLng != null) {
        setCenter([finalLat, finalLng]);
        const pois = await fetchPOIsWithFoursquare(finalLat, finalLng);
        setNearbyPOI(pois);
      } else {
        setError("Data lokasi tidak tersedia");
      }

      setLoading(false);
    };

    init();
  }, [address, lat, lng]);

  // =================================================================
  // MAP CONTROLS
  // =================================================================
  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(center, 16, { animate: true, duration: 1.2 });
    }
  };

  const handleMapReady = (map: L.Map) => {
    mapInstanceRef.current = map;
  };

  if (loading) {
    return (
      <div className="h-full w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center relative overflow-hidden">
        {/* Animated Background */}
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

  if (error) {
    return (
      <div className="h-full w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="text-center bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
          <Icon icon="solar:map-point-remove-bold-duotone" className="text-6xl text-red-400 mb-3 mx-auto" />
          <p className="text-sm font-semibold text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={center}
        zoom={16}
        zoomControl={false}
        style={{ height: "100%", width: "100%", borderRadius: "12px" }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController center={center} onMapReady={handleMapReady} />

        {/* Marker Properti */}
        <Marker position={center} icon={premierIcon}>
          <Popup className="custom-popup">
            <div className="p-3 text-center min-w-[180px]">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <strong className="text-emerald-600 text-sm font-bold">Lokasi Properti</strong>
              </div>
              <span className="text-[11px] text-gray-600 leading-relaxed">{address}</span>
            </div>
          </Popup>
        </Marker>

        {/* Circle Radius - PREMIUM BOLD */}
        <Circle
          center={center}
          radius={500}
          pathOptions={{
            color: "#059669",      // emerald-600
            fillColor: "#10b981",  // emerald-500
            fillOpacity: 0.15,     // lebih jelas tapi masih transparan
            weight: 4,             // garis lebih tebal
            opacity: 0.9,          // hampir solid
            dashArray: "15,10",    // dash lebih panjang
            lineCap: "round",
            lineJoin: "round",
          }}
        />

        {/* POI Markers */}
        {nearbyPOI.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lon]} icon={createCustomIcon(p.icon, p.color)}>
            <Popup>
              <div className="p-2">
                <strong className="text-xs block text-slate-800 mb-1.5 font-semibold">{p.name}</strong>
                <span
                  className="text-[10px] px-2.5 py-1 rounded-full text-white inline-block font-medium shadow-sm"
                  style={{ backgroundColor: p.color }}
                >
                  {p.category}
                </span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* GLASSMORPHISM CONTROLS (Top Right) */}
      <div className="absolute top-4 right-4 z-[500] flex flex-col gap-2">
        {/* Zoom In */}
        <button
          onClick={handleZoomIn}
          className="group relative w-12 h-12 backdrop-blur-2xl bg-white/80 hover:bg-white/95 rounded-2xl shadow-lg hover:shadow-xl border border-white/40 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95"
          title="Perbesar"
        >
          <Icon
            icon="solar:add-circle-bold-duotone"
            className="text-2xl text-slate-700 group-hover:text-emerald-600 transition-colors"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/0 to-emerald-400/0 group-hover:from-emerald-400/20 group-hover:to-emerald-600/20 rounded-2xl transition-all duration-300"></div>
        </button>

        {/* Zoom Out */}
        <button
          onClick={handleZoomOut}
          className="group relative w-12 h-12 backdrop-blur-2xl bg-white/80 hover:bg-white/95 rounded-2xl shadow-lg hover:shadow-xl border border-white/40 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95"
          title="Perkecil"
        >
          <Icon
            icon="solar:minus-circle-bold-duotone"
            className="text-2xl text-slate-700 group-hover:text-red-600 transition-colors"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-red-400/0 to-red-400/0 group-hover:from-red-400/20 group-hover:to-red-600/20 rounded-2xl transition-all duration-300"></div>
        </button>

        {/* Divider Line */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-300/50 to-transparent my-1"></div>

        {/* Recenter */}
        <button
          onClick={handleRecenter}
          className="group relative w-12 h-12 backdrop-blur-2xl bg-white/80 hover:bg-white/95 rounded-2xl shadow-lg hover:shadow-xl border border-white/40 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95"
          title="Kembali ke Pusat"
        >
          <Icon
            icon="solar:compass-bold-duotone"
            className="text-2xl text-slate-700 group-hover:text-blue-600 transition-colors group-hover:rotate-180 duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400/0 to-blue-400/0 group-hover:from-blue-400/20 group-hover:to-blue-600/20 rounded-2xl transition-all duration-300"></div>
        </button>
      </div>

      {/* FLOATING INFO BADGE (Bottom Left) - Glassmorphism */}
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

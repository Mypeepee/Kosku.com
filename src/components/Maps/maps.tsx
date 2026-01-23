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

// --- PREMIER ICON ---
const premierIcon = L.divIcon({
  html: `
    <div style="width:50px; height:50px; border-radius:50%; background:white; display:flex; align-items:center; justify-content:center; box-shadow:0 6px 20px rgba(34,197,94,0.4); border:3px solid #22c55e; position:relative; animation:bounce 2s infinite;">
      <img src="/images/logo/logopremier.svg" alt="P" style="width:32px; height:32px; object-fit:contain;" />
      <div style="position:absolute; bottom:-10px; left:50%; transform:translateX(-50%); width:0; height:0; border-left:10px solid transparent; border-right:10px solid transparent; border-top:10px solid #22c55e;"></div>
    </div>
    <style>
      @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
    </style>
  `,
  className: "",
  iconSize: [50, 50],
  iconAnchor: [25, 60],
  popupAnchor: [0, -55],
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

// Component untuk auto-center saat center state berubah
function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 16, { animate: true, duration: 1 });
  }, [center, map]);
  return null;
}

export default function KosMapWithNearby({ address, lat, lng }: KosMapProps) {
  const [center, setCenter] = useState<[number, number]>([-6.2088, 106.8456]);
  const [nearbyPOI, setNearbyPOI] = useState<POI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeFilters, setActiveFilters] = useState<string[]>([
    "Pendidikan",
    "Kesehatan",
    "Belanja",
    "Kuliner",
    "Ibadah",
    "Transportasi",
    "Keamanan",
  ]);

  const [isMobile, setIsMobile] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  // =================================================================
  // RESPONSIVE DETECT (mobile vs desktop)
  // =================================================================
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // =================================================================
  // GEOCODING - GOOGLE
  // =================================================================
  const geocodeWithGoogle = async (address: string) => {
    const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_GEOCODING_API_KEY;
    if (!API_KEY) {
      console.error("Google Geocoding API key tidak ada di env");
      return null;
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address
      )}&region=id&key=${API_KEY}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.status === "OK" && data.results.length > 0) {
        const loc = data.results[0].geometry.location;
        return { lat: loc.lat, lng: loc.lng };
      } else {
        console.warn("Google geocoding gagal:", data.status, data.error_message);
        return null;
      }
    } catch (err) {
      console.error("Google geocoding error:", err);
      return null;
    }
  };

  // =================================================================
  // POI FETCHING (Overpass API dengan error handling)
  // =================================================================
  const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
  // bisa diganti mirror lain jika sering timeout:
  // const OVERPASS_URL = "https://overpass.kumi.systems/api/interpreter";

  const fetchPOIs = async (lat: number, lon: number) => {
    const radius = 500;
    const query = `
      [out:json][timeout:30];
      (
        node["amenity"="school"](around:${radius},${lat},${lon});
        node["amenity"="university"](around:${radius},${lat},${lon});
        node["amenity"="kindergarten"](around:${radius},${lat},${lon});
        node["amenity"="hospital"](around:${radius},${lat},${lon});
        node["amenity"="clinic"](around:${radius},${lat},${lon});
        node["amenity"="pharmacy"](around:${radius},${lat},${lon});
        node["amenity"="place_of_worship"](around:${radius},${lat},${lon});
        node["amenity"="restaurant"](around:${radius},${lat},${lon});
        node["amenity"="cafe"](around:${radius},${lat},${lon});
        node["amenity"="fast_food"](around:${radius},${lat},${lon});
        node["amenity"="bank"](around:${radius},${lat},${lon});
        node["amenity"="atm"](around:${radius},${lat},${lon});
        node["shop"="supermarket"](around:${radius},${lat},${lon});
        node["shop"="convenience"](around:${radius},${lat},${lon});
        node["shop"="mall"](around:${radius},${lat},${lon});
        node["amenity"="bus_station"](around:${radius},${lat},${lon});
        node["highway"="bus_stop"](around:${radius},${lat},${lon});
        node["public_transport"="station"](around:${radius},${lat},${lon});
        node["amenity"="police"](around:${radius},${lat},${lon});
        node["amenity"="fire_station"](around:${radius},${lat},${lon});
      );
      out body 50;
    `;

    try {
      const res = await fetch(OVERPASS_URL, {
        method: "POST",
        body: query,
      });

      if (!res.ok) {
        // biasanya HTML error page -> jangan parse json
        const text = await res.text();
        console.warn("Overpass status:", res.status, text.slice(0, 200));
        return [];
      }

      const data = await res.json();
      if (!data.elements) return [];

      return (data.elements as any[]).map((el) => ({
        id: String(el.id),
        name: el.tags?.name || el.tags?.amenity || el.tags?.shop || "Fasilitas",
        type: el.tags?.amenity || el.tags?.shop || el.tags?.highway || "unknown",
        lat: el.lat,
        lon: el.lon,
        ...getIconStyle(el.tags),
      }));
    } catch (e) {
      console.error("Overpass Error:", e);
      return [];
    }
  };

  const getIconStyle = (tags: any) => {
    const type = tags?.amenity || tags?.shop || tags?.highway || tags?.public_transport;
    const name = (tags?.name || "").toLowerCase();

    if (["school", "university", "kindergarten"].includes(type))
      return { icon: "solar:diploma-bold-duotone", color: "#3b82f6", category: "Pendidikan" };

    if (["hospital", "clinic", "pharmacy"].includes(type))
      return { icon: "solar:health-bold-duotone", color: "#ef4444", category: "Kesehatan" };

    if (type === "place_of_worship")
      return { icon: "solar:mosque-bold-duotone", color: "#8b5cf6", category: "Ibadah" };

    if (["restaurant", "cafe", "fast_food"].includes(type))
      return { icon: "solar:chef-hat-bold-duotone", color: "#f97316", category: "Kuliner" };

    if (["supermarket", "convenience", "mall"].includes(type)) {
      if (name.includes("indomaret"))
        return { icon: "solar:shop-bold-duotone", color: "#2563eb", category: "Belanja" };
      if (name.includes("alfamart"))
        return { icon: "solar:shop-bold-duotone", color: "#dc2626", category: "Belanja" };
      return { icon: "solar:cart-large-bold-duotone", color: "#fbbf24", category: "Belanja" };
    }

    if (["bank", "atm"].includes(type))
      return { icon: "solar:card-bold-duotone", color: "#06b6d4", category: "Keuangan" };

    if (["bus_station", "bus_stop", "station"].includes(type))
      return { icon: "solar:bus-bold-duotone", color: "#10b981", category: "Transportasi" };

    if (["police", "fire_station"].includes(type))
      return { icon: "solar:shield-check-bold-duotone", color: "#64748b", category: "Keamanan" };

    return { icon: "solar:map-point-bold", color: "#94a3b8", category: "Lainnya" };
  };

  const createCustomIcon = (icon: string, color: string) =>
    L.divIcon({
      html: `<div style="background:${color}; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid white; box-shadow:0 3px 8px rgba(0,0,0,0.3);"><iconify-icon icon="${icon}" style="color:white; font-size:18px;"></iconify-icon></div>`,
      className: "",
      iconSize: [32, 32],
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
        const pois = await fetchPOIs(finalLat, finalLng);
        setNearbyPOI(pois);
      } else {
        setError("Data lokasi tidak tersedia");
      }

      setLoading(false);
    };

    init();
  }, [address, lat, lng]);

  // =================================================================
  // HELPER: FILTER & STATS
  // =================================================================
  const filteredPOI = nearbyPOI.filter((p) => activeFilters.includes(p.category));

  const toggleFilter = (category: string) => {
    setActiveFilters((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const handleRecenter = () => {
    if (mapRef.current) {
      mapRef.current.setView(center, 16, { animate: true, duration: 1 });
    }
  };

  if (loading) {
    return (
      <div className="h-full w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Icon icon="solar:map-bold-duotone" className="text-5xl text-emerald-400 animate-pulse mb-3 mx-auto" />
          <p className="text-sm font-semibold text-gray-300">Mencari lokasi akurat...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="text-center">
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
        style={{ height: "100%", width: "100%", borderRadius: "12px" }}
        className="z-0"
        whenCreated={(m) => (mapRef.current = m)}
      >
        <TileLayer
          attribution='&copy; <a href="https://osm.org">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterMap center={center} />

        {/* Marker Properti */}
        <Marker position={center} icon={premierIcon}>
          <Popup>
            <div className="p-2 text-center">
              <strong className="text-emerald-600 block mb-1 text-sm">📍 Lokasi Properti</strong>
              <span className="text-[10px] text-gray-600">{address}</span>
            </div>
          </Popup>
        </Marker>

        {/* Circle Radius */}
        <Circle
          center={center}
          radius={500}
          pathOptions={{
            color: "#10b981",
            fillColor: "#10b981",
            fillOpacity: 0.08,
            weight: 2,
            dashArray: "8,12",
          }}
        />

        {/* POI */}
        {filteredPOI.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lon]} icon={createCustomIcon(p.icon, p.color)}>
            <Popup>
              <div className="p-1.5">
                <strong className="text-xs block text-slate-800 mb-1">{p.name}</strong>
                <span
                  className="text-[9px] px-2 py-0.5 rounded-full text-white inline-block font-medium"
                  style={{ backgroundColor: p.color }}
                >
                  {p.category}
                </span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* BUTTON RECENTER (TOP RIGHT) */}
      <div className="absolute top-4 right-4 z-[500] flex flex-col gap-2">
        <button
          onClick={handleRecenter}
          className="w-10 h-10 bg-white/95 backdrop-blur-md hover:bg-emerald-500 text-slate-700 hover:text-white rounded-lg shadow-lg border border-white/20 flex items-center justify-center transition-all duration-300"
          title="Kembali ke pusat"
        >
          <Icon icon="solar:map-point-bold" className="text-xl" />
        </button>
      </div>

      {/* RADIUS BADGE (TOP LEFT) */}
      <div className="absolute top-4 left-4 z-[500] bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-3 rounded-xl shadow-2xl border border-white/20 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Icon icon="solar:home-smile-bold-duotone" className="text-2xl" />
          <div>
            <p className="text-[9px] font-medium opacity-90">Radius Pencarian</p>
            <p className="text-lg font-bold leading-none">500m</p>
          </div>
        </div>
      </div>

      {/* LEGEND & FILTERS */}
      {isMobile ? (
        // MOBILE: bottom sheet kecil, bisa expand
        <div className="absolute inset-x-0 bottom-0 z-[500]">
          <div className="mx-3 mb-3 rounded-2xl bg-white/95 backdrop-blur-lg shadow-2xl border border-white/40">
            <button
              onClick={() => setLegendOpen(!legendOpen)}
              className="w-full flex items-center justify-between px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <Icon icon="solar:filter-bold-duotone" className="text-emerald-500 text-lg" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Fasilitas Sekitar ({filteredPOI.length})
                </span>
              </div>
              <Icon
                icon={legendOpen ? "solar:alt-arrow-down-bold" : "solar:alt-arrow-up-bold"}
                className="text-slate-500 text-base"
              />
            </button>

            {legendOpen && (
              <div className="px-3 pb-3 max-h-40 overflow-y-auto space-y-2">
                {[
                  { cat: "Pendidikan", color: "#3b82f6" },
                  { cat: "Kesehatan", color: "#ef4444" },
                  { cat: "Kuliner", color: "#f97316" },
                  { cat: "Belanja", color: "#fbbf24" },
                  { cat: "Ibadah", color: "#8b5cf6" },
                  { cat: "Transportasi", color: "#10b981" },
                  { cat: "Keamanan", color: "#64748b" },
                ].map(({ cat, color }) => {
                  const count = nearbyPOI.filter((p) => p.category === cat).length;
                  const isActive = activeFilters.includes(cat);
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleFilter(cat)}
                      className={`w-full flex items-center justify-between text-[11px] px-2 py-1.5 rounded-lg ${
                        isActive ? "bg-slate-100 text-slate-800" : "bg-slate-50 text-slate-400"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: isActive ? color : "#cbd5e1" }}
                        />
                        <span className="font-medium">{cat}</span>
                      </div>
                      <span className={isActive ? "text-emerald-600 font-semibold" : ""}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        // DESKTOP: card di kiri bawah
        <div className="absolute bottom-4 left-4 z-[500] bg-white/95 backdrop-blur-lg p-4 rounded-xl shadow-2xl border border-white/30 max-w-[220px]">
          <h5 className="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wide flex items-center gap-2">
            <Icon icon="solar:filter-bold-duotone" className="text-emerald-500" />
            Fasilitas Sekitar
          </h5>
          <div className="space-y-2 mb-3">
            {[
              { cat: "Pendidikan", color: "#3b82f6" },
              { cat: "Kesehatan", color: "#ef4444" },
              { cat: "Kuliner", color: "#f97316" },
              { cat: "Belanja", color: "#fbbf24" },
              { cat: "Ibadah", color: "#8b5cf6" },
              { cat: "Transportasi", color: "#10b981" },
              { cat: "Keamanan", color: "#64748b" },
            ].map(({ cat, color }) => {
              const count = nearbyPOI.filter((p) => p.category === cat).length;
              const isActive = activeFilters.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleFilter(cat)}
                  className={`w-full flex items-center justify-between text-[11px] px-2 py-1.5 rounded-lg ${
                    isActive
                      ? "bg-gradient-to-r from-slate-100 to-white text-slate-800 shadow-sm"
                      : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        isActive ? "ring-2 ring-offset-1 ring-slate-300" : ""
                      }`}
                      style={{ backgroundColor: isActive ? color : "#cbd5e1" }}
                    />
                    <span className="font-medium">{cat}</span>
                  </div>
                  <span className={isActive ? "text-emerald-600 font-semibold" : ""}>{count}</span>
                </button>
              );
            })}
          </div>
          <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
            <span className="text-[9px] text-slate-500 font-medium">Total aktif</span>
            <span className="text-sm font-bold text-emerald-600">{filteredPOI.length}</span>
          </div>
        </div>
      )}

      {/* POWERED BY */}
      <div className="absolute bottom-4 right-4 z-[500] bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-md text-[9px] text-slate-600 font-medium border border-white/30">
        Powered by <strong className="text-emerald-600">Google Maps</strong>
      </div>
    </div>
  );
}

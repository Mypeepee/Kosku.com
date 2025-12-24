"use client";

import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { useEffect, useState, useMemo } from "react";

interface KosMapProps {
  lat: number;
  lng: number;
}

// Tambah 'education' ke tipe kategori
type CategoryType = 'food' | 'laundry' | 'mart' | 'health' | 'gym' | 'transport' | 'mall' | 'worship' | 'education';

interface NearbyPlace {
  id: number;
  lat: number;
  lon: number;
  name: string;
  type: CategoryType;
}

// --- 1. KOLEKSI SVG ICON ---
const SVG_PATHS = {
    food: "M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z",
    laundry: "M9.17 16.83a4.008 4.008 0 0 0 5.66 0l2.24 2.24 1.41-1.41L15.42 14.58a3.995 3.995 0 0 0 0-5.66l-2.24-2.24-2.12 2.12L13.17 11L12 9.83l-4.24 4.24l2.12 2.12 1.29-1.36zM3.51 6.34L1.39 8.46l5.66 5.66l4.24-4.24l-2.12-2.12l-2.83 2.83l-2.83-4.25zM19.07 9.17l-2.12-2.12l-2.24 2.24a4.008 4.008 0 0 0-5.66 0l-2.24-2.24L4.69 9.17a5.98 5.98 0 0 1 8.49 0a5.996 5.996 0 0 1 5.89 0z",
    mart: "M18.36 9l.6 3H5.04l.6-3h12.72M20 4H4v2h16V4zm0 3H4l-1 5v2h1v6h10v-6h4v6h2v-6h1v-2l-1-5zM6 18v-4h6v4H6z",
    health: "M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z",
    gym: "M20.57 14.86L22 13.43L20.57 12L17 15.57L8.43 7L12 3.43L10.57 2L9.14 3.43L7.71 2L5.57 4.14L4.14 2.71L2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57L3.43 12L7 8.43L15.57 17L12 20.57L13.43 22l1.43-1.43L16.29 22l2.14-2.14l1.43 1.43l1.43-1.43l-1.43-1.43L22 16.29z",
    transport: "M12 2c-4.42 0-8 3.58-8 8v8c0 1.1.9 2 2 2h2v2h2v-2h4v2h2v-2h2c1.1 0 2-.9 2-2v-8c0-4.42-3.58-8-8-8zm0 3.25c1.24 0 2.25 1.01 2.25 2.25S13.24 9.75 12 9.75S9.75 8.74 9.75 7.5S10.76 5.25 12 5.25zM6 18V8.5c0-3.31 2.69-6 6-6s6 2.69 6 6V18H6z",
    mall: "M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-1.99.9-1.99 2L3 20c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2l-.01-12c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm0 10c-2.76 0-5-2.24-5-5h2c0 1.66 1.34 3 3 3s3-1.34 3-3h2c0 2.76-2.24 5-5 5z",
    worship: "M12 3a7 7 0 0 0-7 7v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a7 7 0 0 0-7-7zm-5 7a5 5 0 0 1 10 0v8H7v-8z M15.5 6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z",
    education: "M12 3L1 9l11 6l9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z", // Simbol Topi Wisuda
    target: "M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4s4-1.79 4-4s-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7s7 3.13 7 7s-3.13 7-7 7z",
    plus: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
    minus: "M19 13H5v-2h14v2z"
};

const CATEGORY_CONFIG = {
    food: { label: "Kuliner", color: "bg-orange-500", path: SVG_PATHS.food },
    laundry: { label: "Laundry", color: "bg-cyan-500", path: SVG_PATHS.laundry },
    mart: { label: "Mart", color: "bg-green-600", path: SVG_PATHS.mart },
    health: { label: "Apotek", color: "bg-red-500", path: SVG_PATHS.health },
    gym: { label: "Gym", color: "bg-blue-600", path: SVG_PATHS.gym },
    mall: { label: "Mall", color: "bg-purple-600", path: SVG_PATHS.mall },
    transport: { label: "Transport", color: "bg-gray-700", path: SVG_PATHS.transport },
    worship: { label: "Ibadah", color: "bg-yellow-500", path: SVG_PATHS.worship }, 
    education: { label: "Pendidikan", color: "bg-indigo-500", path: SVG_PATHS.education }, // Warna Indigo untuk Kampus/Sekolah
};

// --- 2. GENERATE MARKER ICON ---
const createPlaceIcon = (type: CategoryType) => {
    const config = CATEGORY_CONFIG[type] || CATEGORY_CONFIG.food;
    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="${config.path}"/></svg>`;

    const iconHtml = `
        <div class="relative group cursor-pointer transition-transform duration-300 hover:scale-110">
            <div class="w-9 h-9 rounded-full ${config.color} border-[2px] border-white shadow-md flex items-center justify-center text-white z-20 relative">
                ${svgString}
            </div>
            <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white rotate-45 z-10 rounded-[1px] shadow-sm"></div>
        </div>
    `;

    return L.divIcon({ html: iconHtml, className: "custom-leaflet-icon", iconSize: [36, 36], iconAnchor: [18, 38] });
};

const createBrandIcon = () => {
  const iconHtml = renderToStaticMarkup(
    <div className="relative flex flex-col items-center justify-center w-14 h-16 hover:scale-105 transition-transform">
       <div className="w-12 h-12 rounded-full bg-black border-[3px] border-white shadow-[0_4px_15px_rgba(0,0,0,0.3)] flex items-center justify-center overflow-hidden z-20 relative">
          <div className="w-full h-full bg-black flex items-center justify-center">
             <img src="/images/logo/logokosku.svg" alt="K" className="w-full h-full object-cover p-1" />
          </div>
       </div>
       <div className="w-4 h-4 bg-white rotate-45 -mt-2.5 shadow-md z-10 rounded-[1px]"></div>
       <div className="absolute -bottom-1.5 w-10 h-2.5 bg-black/30 blur-sm rounded-full z-0"></div>
       <div className="absolute inset-0 rounded-full border-2 border-[#86efac] opacity-0 animate-ping z-0"></div>
    </div>
  );
  return L.divIcon({ html: iconHtml, className: "custom-leaflet-icon", iconSize: [56, 64], iconAnchor: [28, 60] });
};

// --- 3. CUSTOM CONTROLS ---
const CustomMapControls = ({ lat, lng }: { lat: number, lng: number }) => {
    const map = useMap();
    const ControlBtn = ({ onClick, path, title }: any) => (
        <button onClick={onClick} title={title} className="w-9 h-9 bg-white hover:bg-gray-50 flex items-center justify-center text-gray-700 transition-colors">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d={path}/></svg>
        </button>
    );
    return (
        <div className="absolute bottom-6 right-4 z-[400] flex flex-col gap-2">
            <button onClick={() => map.flyTo([lat, lng], 16)} className="w-9 h-9 bg-white text-gray-800 rounded-lg shadow-md flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all border border-gray-100">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d={SVG_PATHS.target}/></svg>
            </button>
            <div className="flex flex-col bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden">
                <ControlBtn onClick={() => map.zoomIn()} path={SVG_PATHS.plus} title="Zoom In" />
                <div className="h-[1px] w-full bg-gray-200"></div>
                <ControlBtn onClick={() => map.zoomOut()} path={SVG_PATHS.minus} title="Zoom Out" />
            </div>
        </div>
    );
};

// --- 4. COMPONENT MAP UTAMA ---
const KosMap = ({ lat, lng }: KosMapProps) => {
  const position: [number, number] = [lat, lng];
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<CategoryType | 'all'>('all');

  useEffect(() => {
    const fetchPlaces = async () => {
        setLoading(true);
        
        // QUERY API REAL (RADIUS 500 METER)
        const query = `
            [out:json][timeout:25];
            (
              node["amenity"~"restaurant|cafe|fast_food|food_court|ice_cream"](around:500,${lat},${lng});
              node["shop"~"laundry|dry_cleaning"](around:500,${lat},${lng});
              node["amenity"~"pharmacy|clinic|hospital|doctors"](around:500,${lat},${lng});
              node["amenity"~"place_of_worship"](around:500,${lat},${lng});
              node["amenity"~"university|school|college|kindergarten"](around:500,${lat},${lng});
              node["leisure"~"gym|fitness_centre|sports_centre"](around:500,${lat},${lng});
              node["shop"~"mall|department_store|supermarket|convenience"](around:500,${lat},${lng});
              node["public_transport"](around:500,${lat},${lng});
              node["railway"~"station"](around:500,${lat},${lng});
              node["amenity"~"bus_station"](around:500,${lat},${lng});
              node["highway"~"bus_stop"](around:500,${lat},${lng});
            );
            out body 30;
        `; 
        
        try {
            const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            let mappedPlaces: NearbyPlace[] = [];
            
            if (data.elements && data.elements.length > 0) {
                mappedPlaces = data.elements.map((el: any) => {
                    let type: CategoryType = 'food';
                    const t = el.tags;
                    
                    if (t.amenity === 'place_of_worship') type = 'worship';
                    else if (t.amenity === 'university' || t.amenity === 'school' || t.amenity === 'college' || t.amenity === 'kindergarten') type = 'education';
                    else if (t.shop === 'laundry') type = 'laundry';
                    else if (t.amenity === 'pharmacy' || t.amenity === 'clinic' || t.healthcare || t.amenity === 'doctors') type = 'health';
                    else if (t.leisure === 'gym' || t.leisure === 'fitness_centre' || t.leisure === 'sports_centre') type = 'gym';
                    else if (t.shop === 'mall' || t.shop === 'department_store') type = 'mall';
                    else if (t.public_transport || t.railway || t.amenity === 'bus_station' || t.highway === 'bus_stop') type = 'transport';
                    else if (t.shop === 'convenience' || t.shop === 'supermarket') type = 'mart';
                    else type = 'food'; // Default
                    
                    let finalName = t.name;
                    if (!finalName) {
                        if (type === 'worship') finalName = "Tempat Ibadah";
                        else if (type === 'education') finalName = "Sekolah/Kampus";
                        else if (type === 'food') finalName = "Warung Makan";
                        else if (type === 'mart') finalName = "Minimarket";
                        else if (type === 'laundry') finalName = "Jasa Laundry";
                        else if (type === 'health') finalName = "Apotek/Klinik";
                        else if (type === 'transport') finalName = "Halte/Terminal";
                        else finalName = "Tempat Umum";
                    }

                    return { id: el.id, lat: el.lat, lon: el.lon, name: finalName, type: type };
                });
            }
            
            // --- FIX PENTING: HAPUS DUPLIKAT (ICON TUMPUK) ---
            // Kita filter array, hanya ambil item jika ID-nya belum pernah muncul sebelumnya
            const uniquePlaces = mappedPlaces.filter((v, i, a) => a.findIndex(v2 => (v2.id === v.id)) === i);
            
            setPlaces(uniquePlaces);

        } catch (error) {
            console.error("Gagal mengambil data peta:", error);
            setPlaces([]); 
        } finally {
            setLoading(false);
        }
    };
    fetchPlaces();
  }, [lat, lng]);

  const filteredPlaces = useMemo(() => {
      if (activeFilter === 'all') return places;
      return places.filter(p => p.type === activeFilter);
  }, [places, activeFilter]);

  return (
    <div className="relative w-full h-full bg-[#f8f9fa]">
      <style jsx global>{`
        .leaflet-layer { filter: saturate(1.1); }
        .leaflet-container { background: #f4f4f5 !important; font-family: inherit; }
        .custom-leaflet-icon { background: transparent !important; border: none !important; }
        .leaflet-popup-content-wrapper {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(12px);
            border-radius: 12px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.12);
            padding: 0; border: 1px solid rgba(0,0,0,0.05);
        }
        .leaflet-popup-content { margin: 0 !important; width: auto !important; }
        .leaflet-popup-tip { background: rgba(255, 255, 255, 0.95); }
        .leaflet-popup-close-button { display: none; }
      `}</style>

      {/* FILTER PILLS - Worship & Education DIHIDE DARI MENU */}
      <div className="absolute top-4 left-4 z-[400] flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide max-w-[90%] pr-4 mask-linear-fade">
          <button 
             onClick={() => setActiveFilter('all')}
             className={`px-3 py-1.5 rounded-full text-[11px] font-bold shadow-sm transition-all border flex-shrink-0 ${activeFilter === 'all' ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
          >
             Semua
          </button>
          {Object.entries(CATEGORY_CONFIG)
             // LOGIC PENTING: Filter agar 'worship' DAN 'education' tidak muncul di menu
             .filter(([key]) => key !== 'worship' && key !== 'education') 
             .map(([key, config]) => (
             <button 
                key={key}
                onClick={() => setActiveFilter(key as CategoryType)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold shadow-sm transition-all border flex-shrink-0 whitespace-nowrap ${activeFilter === key ? `${config.color} text-white border-transparent` : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
             >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5" style={{ minWidth: '14px' }}>
                    <path d={config.path} />
                </svg>
                {config.label}
             </button>
          ))}
      </div>

      {loading && (
          <div className="absolute bottom-6 left-6 z-[400] bg-white/90 backdrop-blur px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 border border-gray-200 animate-pulse">
               <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-ping"></div>
              <span className="text-[10px] font-bold text-gray-600">Scan area 500m...</span>
          </div>
      )}

      <MapContainer center={position} zoom={16} scrollWheelZoom={true} className="w-full h-full z-0 outline-none rounded-3xl" zoomControl={false}>
        <TileLayer attribution='&copy; CartoDB' url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
        
        {/* Lingkaran Radius 500m dengan Warna HIJAU (#10b981) */}
        <Circle center={position} radius={500} pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.08, weight: 1.5, dashArray: '6, 6' }} />
        
        <Marker position={position} icon={createBrandIcon()} zIndexOffset={999} />

        {filteredPlaces.map(place => (
            <Marker key={place.id} position={[place.lat, place.lon]} icon={createPlaceIcon(place.type)}>
                <Popup offset={[0, -12]}>
                    <div className="px-3 py-2 text-center min-w-[120px]">
                        <span className={`text-[9px] uppercase font-bold tracking-wider mb-0.5 block ${CATEGORY_CONFIG[place.type].color.replace('bg-', 'text-')}`}>
                           {CATEGORY_CONFIG[place.type].label}
                        </span>
                        <h4 className="font-bold text-gray-800 text-xs leading-tight">{place.name}</h4>
                    </div>
                </Popup>
            </Marker>
        ))}

        <CustomMapControls lat={lat} lng={lng} />
      </MapContainer>
      
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_40px_rgba(0,0,0,0.05)] z-[300] rounded-3xl"></div>
    </div>
  );
};

export default KosMap;
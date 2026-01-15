"use client";
import { useState, useRef, useEffect } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";

// --- 1. CONFIGURATION ---

const sortAlpha = (arr: string[]) => arr.sort((a, b) => a.localeCompare(b));

const PROPERTY_ICONS: Record<string, string> = {
  "Rumah": "solar:home-2-bold-duotone",
  "Apartemen": "solar:buildings-2-bold-duotone",
  "Gudang": "solar:box-minimalistic-bold-duotone",
  "Tanah": "solar:map-point-wave-bold-duotone",
  "Pabrik": "solar:garage-bold-duotone",
  "Ruko": "solar:shop-2-bold-duotone",
  "Toko": "solar:shop-bold-duotone",
  "Hotel": "solar:bed-bold-duotone",
  "Villa": "solar:star-fall-bold-duotone",
};

const PROPERTY_TYPES = {
  beli: sortAlpha(["Rumah", "Tanah", "Gudang", "Apartemen", "Pabrik", "Ruko", "Toko", "Hotel", "Villa"]),
  sewa: sortAlpha(["Rumah", "Tanah", "Gudang", "Apartemen", "Pabrik", "Ruko", "Toko"]),
  lelang: sortAlpha(["Rumah", "Tanah", "Gudang", "Apartemen", "Pabrik", "Ruko", "Toko", "Hotel", "Villa"]),
};

type TabType = "beli" | "sewa" | "lelang";

interface Region {
  id: string;
  name: string;
  level: 'provinsi' | 'kota' | 'kecamatan' | 'kelurahan';
}

interface ApiRegion {
  id: string;
  nama: string;
}

interface SearchState {
  locations: Region[];
  type: string;
  minPrice: string;
  maxPrice: string;
  minLt: string;
  maxLt: string;
  minLb: string;
  maxLb: string;
}

const CardSlider = () => {
  const [activeTab, setActiveTab] = useState<TabType>("beli");
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  
  // --- STATE WILAYAH ---
  const [viewLevel, setViewLevel] = useState<'provinsi' | 'kota' | 'kecamatan' | 'kelurahan'>('provinsi');
  const [currentList, setCurrentList] = useState<Region[]>([]);
  const [parentRegion, setParentRegion] = useState<Region | null>(null);
  const [loadingWilayah, setLoadingWilayah] = useState(false);

  const [formData, setFormData] = useState<SearchState>({
    locations: [],
    type: "",
    minPrice: "",
    maxPrice: "",
    minLt: "",
    maxLt: "",
    minLb: "",
    maxLb: "",
  });

  const wrapperRef = useRef<HTMLDivElement>(null);
  const BASE_API = "https://ibnux.github.io/data-indonesia";

  // Helper Mapping
  const mapData = (data: ApiRegion[], level: Region['level']): Region[] => {
    return data
      .map(item => ({ id: item.id, name: item.nama, level }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const getRegionIcon = (level: Region['level']) => {
    switch (level) {
      case 'provinsi': return "solar:globus-bold-duotone";
      case 'kota': return "solar:buildings-2-bold-duotone";
      case 'kecamatan': return "solar:buildings-bold-duotone";
      case 'kelurahan': return "solar:map-point-wave-bold-duotone"; 
      default: return "solar:map-point-bold-duotone";
    }
  };

  const fetchRegions = async (level: Region['level'], parentId?: string) => {
    setLoadingWilayah(true);
    try {
        let url = "";
        if (level === 'provinsi') url = `${BASE_API}/propinsi.json`;
        if (level === 'kota' && parentId) url = `${BASE_API}/kabupaten/${parentId}.json`;
        if (level === 'kecamatan' && parentId) url = `${BASE_API}/kecamatan/${parentId}.json`;
        if (level === 'kelurahan' && parentId) url = `${BASE_API}/kelurahan/${parentId}.json`;

        if (url) {
            const res = await fetch(url);
            const data = await res.json();
            setCurrentList(mapData(data, level));
        }
    } catch (err) {
        console.error(err);
        toast.error("Gagal memuat data wilayah");
    } finally {
        setLoadingWilayah(false);
    }
  };

  useEffect(() => {
    if (openDropdown === "location" && viewLevel === 'provinsi') {
        fetchRegions('provinsi');
    }
  }, [openDropdown]);

  // --- HANDLER SELECTION ---
  const toggleLocation = (item: Region) => {
    const isAlreadySelected = formData.locations.some(loc => loc.id === item.id);

    if (!isAlreadySelected) {
        toast.success(`${item.name} berhasil ditambahkan!`, {
            icon: '📍',
            style: { borderRadius: '10px', background: '#333', color: '#fff', fontSize: '12px' },
        });
    }

    setFormData(prev => {
        const exists = prev.locations.find(loc => loc.id === item.id);
        let newLocations = [...prev.locations];

        if (exists) {
            newLocations = newLocations.filter(loc => loc.id !== item.id);
        } else {
            // Smart Replacement Logic
            newLocations = newLocations.filter(loc => !item.id.startsWith(loc.id));
            newLocations = newLocations.filter(loc => !loc.id.startsWith(item.id));
            newLocations.push(item);
        }
        return { ...prev, locations: newLocations };
    });
  };

  // --- HANDLER NAVIGATION ---
  const handleRowClick = (item: Region) => {
    if (item.level !== 'kelurahan') {
        setParentRegion(item);
        let nextLevel: Region['level'] = 'kota';
        if (item.level === 'provinsi') nextLevel = 'kota';
        if (item.level === 'kota') nextLevel = 'kecamatan';
        if (item.level === 'kecamatan') nextLevel = 'kelurahan';
        setViewLevel(nextLevel);
        fetchRegions(nextLevel, item.id);
    } else {
        toggleLocation(item);
    }
  };

  const handleBack = () => {
    setViewLevel('provinsi');
    setParentRegion(null);
    fetchRegions('provinsi');
  };

  // --- UTILS ---
  const toggleDropdown = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const handleFormattedInput = (e: React.ChangeEvent<HTMLInputElement>, field: keyof SearchState) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    const formattedValue = rawValue ? new Intl.NumberFormat("id-ID").format(Number(rawValue)) : "";
    setFormData(prev => ({ ...prev, [field]: formattedValue }));
  };

  const getLabel = (min: string, max: string, defaultText: string, prefix = "") => {
    if (min && max) return `${prefix}${min} - ${prefix}${max}`;
    if (min) return `Mulai ${prefix}${min}`;
    if (max) return `Hingga ${prefix}${max}`;
    return defaultText;
  };

  return (
    <div className="w-full max-w-6xl mx-auto font-sans relative z-30" ref={wrapperRef}>
      
      {/* TABS */}
      <div className="flex justify-center mb-6">
        <div className="bg-[#1A1A1A]/90 backdrop-blur-md border border-white/20 p-1.5 rounded-full inline-flex shadow-xl overflow-x-auto max-w-full no-scrollbar">
          {[
            { id: "beli", label: "Beli", icon: "solar:home-2-bold" },
            { id: "sewa", label: "Sewa", icon: "solar:key-minimalistic-square-bold" },
            { id: "lelang", label: "Lelang", icon: "solar:tag-price-bold" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as TabType);
                setOpenDropdown(null);
                setFormData(prev => ({ ...prev, type: "" }));
              }}
              className={`
                flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 whitespace-nowrap
                ${activeTab === tab.id 
                  ? "bg-primary text-darkmode shadow-[0_0_20px_rgba(74,222,128,0.4)]" 
                  : "text-gray-400 hover:text-white hover:bg-white/10"}
              `}
            >
              <Icon icon={tab.icon} className="text-lg" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN SEARCH BAR */}
      <div className="bg-white rounded-[2rem] shadow-2xl shadow-black/40 p-2 lg:p-4 border border-white/10 relative">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
          
          {/* === A. LOKASI (28%) === 
              REVISI: Width dikurangi jadi 28%, min-w-0 ditambah untuk truncate text
          */}
          <div className="w-full lg:w-[28%] px-4 lg:px-5 py-4 lg:py-3 relative group min-w-0">
            <div 
              className="cursor-pointer h-full flex flex-col justify-center"
              onClick={() => toggleDropdown("location")}
            >
              <label className="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase mb-1 block group-hover:text-primary transition-colors">
                Lokasi
              </label>
              
              <div className="flex items-center gap-2 w-full">
                 <Icon icon="solar:map-point-bold-duotone" className="text-2xl text-gray-400 group-hover:text-primary transition-colors shrink-0" />
                 
                 {/* BUBBLE RESULT */}
                 <div className="w-full overflow-x-auto no-scrollbar flex items-center gap-1.5 h-7">
                    {formData.locations.length === 0 ? (
                        <div className="w-full">
                            <p className="font-bold text-gray-800 text-sm truncate">Semua Lokasi</p>
                            <p className="text-xs text-gray-400 truncate">Pilih Provinsi, Kota...</p>
                        </div>
                    ) : (
                        formData.locations.map((loc) => (
                            <span 
                                key={loc.id} 
                                onClick={(e) => { e.stopPropagation(); toggleLocation(loc); }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-darkmode text-[10px] font-bold whitespace-nowrap hover:bg-red-100 hover:text-red-500 hover:border-red-200 transition-colors cursor-pointer group-bubble"
                            >
                                {loc.name}
                                <Icon icon="solar:close-circle-bold" className="text-primary group-hover:text-red-500 text-xs"/>
                            </span>
                        ))
                    )}
                 </div>

                 <Icon icon="solar:alt-arrow-down-linear" className={`text-gray-400 transition-transform shrink-0 ${openDropdown === "location" ? "rotate-180" : ""}`} />
              </div>
            </div>

            {/* DROPDOWN LOKASI */}
            {openDropdown === "location" && (
              <div className="absolute top-full left-0 w-full lg:w-[400px] bg-white rounded-2xl shadow-2xl border border-gray-100 mt-4 p-0 z-50 animate-fade-in-up overflow-hidden flex flex-col max-h-[400px]">
                 <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                        {viewLevel !== 'provinsi' && (
                            <button onClick={handleBack} className="p-1.5 hover:bg-gray-200 rounded-full transition-colors group">
                                <Icon icon="solar:arrow-left-linear" className="text-lg text-gray-600 group-hover:text-darkmode"/>
                            </button>
                        )}
                        <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                            <Icon icon={getRegionIcon(viewLevel)} className="text-primary text-lg"/> 
                            {viewLevel === 'provinsi' ? <span>Pilih Wilayah</span> : <span className="text-primary truncate max-w-[200px] block">{parentRegion?.name}</span>}
                        </h4>
                    </div>
                    {loadingWilayah && <Icon icon="line-md:loading-loop" className="text-primary text-lg" />}
                 </div>
                 
                 <div className="overflow-y-auto custom-scrollbar flex-1">
                    {viewLevel !== 'provinsi' && parentRegion && (
                        <button 
                            onClick={() => toggleLocation(parentRegion)}
                            className="w-full text-left px-4 py-3 bg-primary/5 hover:bg-primary/10 border-b border-gray-100 flex items-center gap-3 transition-colors"
                        >
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${formData.locations.some(l => l.id === parentRegion.id) ? "bg-primary border-primary" : "border-gray-400 bg-white"}`}>
                                {formData.locations.some(l => l.id === parentRegion.id) && <Icon icon="solar:check-read-linear" className="text-white text-sm"/>}
                            </div>
                            <div>
                                <span className="text-sm font-bold text-darkmode block">Pilih Semua di {parentRegion.name}</span>
                            </div>
                        </button>
                    )}

                    {currentList.map((item) => {
                        const isSelected = formData.locations.some(l => l.id === item.id);
                        const hasChild = item.level !== 'kelurahan';
                        return (
                            <div key={item.id} className="flex items-center justify-between group hover:bg-gray-50 border-b border-gray-50 last:border-0 pr-2">
                                <button onClick={() => handleRowClick(item)} className="flex-1 flex items-center gap-3 px-4 py-3 text-left">
                                    <Icon icon={getRegionIcon(item.level)} className={`text-lg shrink-0 ${isSelected ? "text-primary" : "text-gray-300 group-hover:text-primary"}`}/>
                                    <div className="flex-1 overflow-hidden">
                                        <span className={`text-sm block truncate ${isSelected ? "font-bold text-primary" : "font-medium text-gray-700"}`}>{item.name}</span>
                                        {hasChild && <span className="text-[10px] text-gray-400 group-hover:text-primary transition-colors">Lihat {item.level === 'provinsi' ? 'Kota' : item.level === 'kota' ? 'Kecamatan' : 'Kelurahan'}</span>}
                                    </div>
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); toggleLocation(item); }} className="p-3 hover:bg-gray-100 rounded-lg transition-colors">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? "bg-primary border-primary" : "border-gray-300 bg-white"}`}>
                                        {isSelected && <Icon icon="solar:check-read-linear" className="text-white text-sm"/>}
                                    </div>
                                </button>
                                {hasChild && (
                                    <button onClick={() => handleRowClick(item)} className="p-2 text-gray-300 hover:text-primary"><Icon icon="solar:alt-arrow-right-linear" /></button>
                                )}
                            </div>
                        )
                    })}
                 </div>
              </div>
            )}
          </div>

          {/* === B. TIPE PROPERTI (18%) === */}
          <div className="w-full lg:w-[18%] px-4 lg:px-5 py-4 lg:py-3 relative group min-w-0">
             <div 
               className="cursor-pointer"
               onClick={() => toggleDropdown("type")}
             >
               <label className="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase mb-1 block group-hover:text-primary transition-colors">
                Tipe Aset
               </label>
               <div className="flex items-center gap-2">
                 <Icon icon="solar:buildings-bold-duotone" className="text-2xl text-gray-400 group-hover:text-primary transition-colors shrink-0" />
                 <div className="w-full overflow-hidden">
                    <p className="font-bold text-gray-800 text-sm truncate">
                        {formData.type || "Semua Tipe"}
                    </p>
                 </div>
                 <Icon icon="solar:alt-arrow-down-linear" className={`text-gray-400 transition-transform ${openDropdown === "type" ? "rotate-180" : ""}`} />
               </div>
            </div>

            {openDropdown === "type" && (
               <div className="absolute top-full left-0 w-full lg:w-[280px] bg-white rounded-2xl shadow-2xl border border-gray-100 mt-4 p-2 z-50 animate-fade-in-up max-h-[300px] overflow-y-auto custom-scrollbar">
                  <button 
                     onClick={() => { setFormData(prev => ({...prev, type: ""})); setOpenDropdown(null); }}
                     className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors flex items-center gap-3 ${formData.type === "" ? "bg-primary/10 text-primary" : "text-gray-600 hover:bg-gray-50"}`}
                  >
                     <Icon icon="solar:apps-bold-duotone" className="text-lg opacity-70" />
                     Semua Tipe
                  </button>
                  {PROPERTY_TYPES[activeTab].map((item) => (
                     <button 
                        key={item}
                        onClick={() => {
                            setFormData(prev => ({...prev, type: item}));
                            setOpenDropdown(null);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors flex items-center gap-3 ${formData.type === item ? "bg-primary/10 text-primary" : "text-gray-600 hover:bg-gray-50"}`}
                     >
                        <Icon icon={PROPERTY_ICONS[item] || "solar:home-bold-duotone"} className="text-lg opacity-70" />
                        {item}
                     </button>
                  ))}
               </div>
            )}
          </div>

          {/* === C. HARGA (22%) === */}
          <div className="w-full lg:w-[22%] px-4 lg:px-5 py-4 lg:py-3 relative group min-w-0">
             <div 
               className="cursor-pointer"
               onClick={() => toggleDropdown("price")}
             >
               <label className="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase mb-1 block group-hover:text-primary transition-colors">Harga</label>
               <div className="flex items-center gap-2">
                 <Icon icon="solar:wallet-money-bold-duotone" className="text-2xl text-gray-400 group-hover:text-primary transition-colors shrink-0" />
                 <div className="w-full overflow-hidden">
                    <p className="font-bold text-gray-800 text-sm truncate">
                       {getLabel(formData.minPrice, formData.maxPrice, "Range Harga")}
                    </p>
                 </div>
                 <Icon icon="solar:alt-arrow-down-linear" className={`text-gray-400 transition-transform ${openDropdown === "price" ? "rotate-180" : ""}`} />
               </div>
            </div>

            {openDropdown === "price" && (
              <div className="absolute top-full left-0 w-full lg:w-[320px] bg-white rounded-2xl shadow-2xl border border-gray-100 mt-4 p-5 z-50 animate-fade-in-up">
                 <h4 className="font-bold text-gray-800 mb-3 text-sm">Range Budget (Rp)</h4>
                 <div className="flex items-center gap-2 mb-1">
                    <div className="relative w-1/2">
                       <input type="text" placeholder="Min" value={formData.minPrice} onChange={(e) => handleFormattedInput(e, 'minPrice')} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-primary outline-none text-gray-700 font-medium placeholder:text-gray-400" />
                    </div>
                    <span className="text-gray-400 font-medium">s/d</span>
                    <div className="relative w-1/2">
                       <input type="text" placeholder="Max" value={formData.maxPrice} onChange={(e) => handleFormattedInput(e, 'maxPrice')} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-primary outline-none text-gray-700 font-medium placeholder:text-gray-400" />
                    </div>
                 </div>
              </div>
            )}
          </div>

          {/* === D. DIMENSI (22%) === */}
          <div className="w-full lg:w-[22%] px-4 lg:px-5 py-4 lg:py-3 relative group min-w-0">
             <div 
               className="cursor-pointer"
               onClick={() => toggleDropdown("dimensions")}
             >
               <label className="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase mb-1 block group-hover:text-primary transition-colors">Dimensi</label>
               <div className="flex items-center gap-2">
                 <Icon icon="solar:ruler-angular-bold-duotone" className="text-2xl text-gray-400 group-hover:text-primary transition-colors shrink-0" />
                 <div className="w-full overflow-hidden">
                    <p className="font-bold text-gray-800 text-sm truncate">
                        {formData.minLt || formData.maxLt 
                          ? getLabel(formData.minLt, formData.maxLt, "", "LT: ") + " m²"
                          : "Luas Tanah/Bangunan"}
                    </p>
                 </div>
                 <Icon icon="solar:alt-arrow-down-linear" className={`text-gray-400 transition-transform ${openDropdown === "dimensions" ? "rotate-180" : ""}`} />
               </div>
            </div>

            {openDropdown === "dimensions" && (
              <div className="absolute top-full right-0 lg:left-auto left-0 w-full lg:w-[320px] bg-white rounded-2xl shadow-2xl border border-gray-100 mt-4 p-5 z-50 animate-fade-in-up">
                 <div className="mb-4">
                    <h4 className="font-bold text-gray-800 mb-2 text-sm flex items-center gap-2"><Icon icon="solar:map-bold" className="text-gray-400"/> Luas Tanah (m²)</h4>
                    <div className="flex items-center gap-2">
                       <input type="text" placeholder="Min" value={formData.minLt} onChange={(e) => handleFormattedInput(e, 'minLt')} className="w-1/2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-primary outline-none font-medium placeholder:text-gray-400 text-gray-700" />
                       <span className="text-gray-400">-</span>
                       <input type="text" placeholder="Max" value={formData.maxLt} onChange={(e) => handleFormattedInput(e, 'maxLt')} className="w-1/2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-primary outline-none font-medium placeholder:text-gray-400 text-gray-700" />
                    </div>
                 </div>
                 {activeTab !== "lelang" && (
                    <div>
                       <h4 className="font-bold text-gray-800 mb-2 text-sm flex items-center gap-2"><Icon icon="solar:home-bold" className="text-gray-400"/> Luas Bangunan (m²)</h4>
                       <div className="flex items-center gap-2">
                          <input type="text" placeholder="Min" value={formData.minLb} onChange={(e) => handleFormattedInput(e, 'minLb')} className="w-1/2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-primary outline-none font-medium placeholder:text-gray-400 text-gray-700" />
                          <span className="text-gray-400">-</span>
                          <input type="text" placeholder="Max" value={formData.maxLb} onChange={(e) => handleFormattedInput(e, 'maxLb')} className="w-1/2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-primary outline-none font-medium placeholder:text-gray-400 text-gray-700" />
                       </div>
                    </div>
                 )}
                 {activeTab === "lelang" && <p className="text-[10px] text-orange-600 bg-orange-50 p-2 rounded-lg mt-2 font-medium border border-orange-100"><Icon icon="solar:info-circle-bold" className="inline mr-1 text-sm"/>Aset lelang fokus pada nilai tanah (Land Value).</p>}
              </div>
            )}
          </div>

          {/* === E. TOMBOL CARI (10%) === */}
          <div className="w-full lg:w-[10%] p-4 lg:p-2 shrink-0 flex items-center justify-center">
            <button className="w-full lg:w-14 h-14 bg-primary hover:bg-[#6ee7b7] text-darkmode rounded-2xl lg:rounded-full font-bold text-lg flex items-center justify-center shadow-lg shadow-primary/30 transition-all transform active:scale-95">
              <Icon icon="solar:magnifer-linear" className="text-2xl stroke-2" />
              <span className="lg:hidden ml-2">Cari Sekarang</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default CardSlider;
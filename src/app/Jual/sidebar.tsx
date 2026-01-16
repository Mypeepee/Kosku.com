"use client";
import { Icon } from "@iconify/react";
import { useRouter, useSearchParams } from "next/navigation";

const Sidebar = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const BASE_URL = "/Jual";

  // Helper Update URL
  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (value) {
      if (params.get(key) === value) {
         params.delete(key);
      } else {
         params.set(key, value);
      }
    } else {
      params.delete(key);
    }
    
    params.set('page', '1'); 
    router.push(`${BASE_URL}?${params.toString()}`, { scroll: false });
  };

  const isActive = (key: string, value: string) => searchParams.get(key) === value;

  // STYLE BARU (Ukuran Font Lebih Besar & Jelas)
  const getButtonStyle = (active: boolean) => 
    active 
      ? "bg-primary text-black border-primary font-bold shadow-md shadow-primary/20" 
      : "bg-white/5 border-white/20 text-gray-300 font-medium hover:bg-white/10 hover:border-white/50 hover:text-white";

  return (
    <div className="bg-[#121212] rounded-xl border border-white/10 p-5 sticky top-24 h-fit max-h-[85vh] overflow-y-auto custom-scrollbar shadow-xl">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
        <h3 className="text-white font-bold text-lg tracking-tight">Filter Properti</h3>
        <button 
            onClick={() => router.push(BASE_URL)}
            className="text-primary text-xs uppercase font-bold hover:text-white hover:underline transition-colors flex items-center gap-1"
        >
            <Icon icon="solar:restart-bold" /> Reset
        </button>
      </div>

      {/* 1. URUTKAN HARGA */}
      <div className="mb-6">
        <h4 className="text-white text-xs font-bold mb-3 uppercase tracking-wider flex items-center gap-2 opacity-90">
            <Icon icon="solar:sort-from-top-to-bottom-bold" className="text-primary text-base"/> Urutkan Harga
        </h4>
        <div className="flex gap-2">
          <button 
            onClick={() => updateFilter('sort', 'asc')}
            className={`flex-1 py-2.5 px-3 rounded-lg border text-sm transition-all duration-200 ${getButtonStyle(isActive('sort', 'asc'))}`}
          >
            Termurah
          </button>
          <button 
            onClick={() => updateFilter('sort', 'desc')}
            className={`flex-1 py-2.5 px-3 rounded-lg border text-sm transition-all duration-200 ${getButtonStyle(isActive('sort', 'desc'))}`}
          >
            Termahal
          </button>
        </div>
      </div>

      {/* 2. SPESIFIKASI FISIK */}
      <div className="mb-6 space-y-5">
        
        {/* Kamar Tidur */}
        <div>
            <h4 className="text-white text-xs font-bold mb-3 uppercase tracking-wider flex items-center gap-2 opacity-90">
                <Icon icon="solar:bed-bold" className="text-primary text-base"/> Kamar Tidur
            </h4>
            <div className="flex gap-2">
                {[2, 3, 4, 5].map((num) => (
                    <button 
                        key={num}
                        onClick={() => updateFilter('minKT', String(num))}
                        className={`h-10 flex-1 rounded-lg border flex items-center justify-center text-sm transition-all ${getButtonStyle(isActive('minKT', String(num)))}`}
                    >
                        {num}+
                    </button>
                ))}
            </div>
        </div>

        {/* Kamar Mandi */}
        <div>
            <h4 className="text-white text-xs font-bold mb-3 uppercase tracking-wider flex items-center gap-2 opacity-90">
                <Icon icon="solar:bath-bold" className="text-primary text-base"/> Kamar Mandi
            </h4>
            <div className="flex gap-2">
                {[1, 2, 3, 4].map((num) => (
                    <button 
                        key={num}
                        onClick={() => updateFilter('minKM', String(num))}
                        className={`h-10 flex-1 rounded-lg border flex items-center justify-center text-sm transition-all ${getButtonStyle(isActive('minKM', String(num)))}`}
                    >
                        {num}+
                    </button>
                ))}
            </div>
        </div>

        {/* Jumlah Lantai */}
        <div>
            <h4 className="text-white text-xs font-bold mb-3 uppercase tracking-wider flex items-center gap-2 opacity-90">
                <Icon icon="solar:layers-bold" className="text-primary text-base"/> Lantai
            </h4>
            <div className="flex gap-2">
                {[1, 2, 3].map((num) => (
                    <button 
                        key={num}
                        onClick={() => updateFilter('lantai', String(num))}
                        className={`h-10 flex-1 rounded-lg border flex items-center justify-center text-sm transition-all ${getButtonStyle(isActive('lantai', String(num)))}`}
                    >
                        {num}{num === 3 ? '+' : ''}
                    </button>
                ))}
            </div>
        </div>

      </div>

      <div className="w-full h-[1px] bg-white/10 mb-6"></div>

      {/* 3. HADAP BANGUNAN */}
      <div className="mb-6">
        <h4 className="text-white text-xs font-bold mb-3 uppercase tracking-wider flex items-center gap-2 opacity-90">
            <Icon icon="solar:compass-bold" className="text-primary text-base"/> Hadap Bangunan
        </h4>
        <div className="grid grid-cols-2 gap-2">
            {["Utara", "Selatan", "Timur", "Barat"].map((arah) => (
                <button 
                    key={arah}
                    onClick={() => updateFilter('hadap', arah)}
                    className={`py-2.5 px-3 rounded-lg border text-sm transition-all ${getButtonStyle(isActive('hadap', arah))}`}
                >
                    {arah}
                </button>
            ))}
        </div>
      </div>

      <div className="w-full h-[1px] bg-white/10 mb-6"></div>

      {/* 4. KONDISI INTERIOR */}
      <div className="mb-6">
        <h4 className="text-white text-xs font-bold mb-3 uppercase tracking-wider flex items-center gap-2 opacity-90">
            <Icon icon="solar:sofa-bold" className="text-primary text-base"/> Kondisi Interior
        </h4>
        <div className="flex flex-col gap-2">
          {["Furnished", "Semi Furnished", "Unfurnished"].map((item) => (
            <button
                key={item}
                onClick={() => updateFilter('kondisi', item)}
                className={`
                    w-full text-left px-4 py-3 rounded-lg border text-sm transition-all flex items-center justify-between group
                    ${isActive('kondisi', item) 
                        ? "bg-primary text-black border-primary font-bold shadow-sm" 
                        : "border-white/20 text-gray-300 bg-white/5 hover:border-white hover:bg-white/10 hover:text-white"}
                `}
            >
                {item}
                {isActive('kondisi', item) && <Icon icon="solar:check-circle-bold" className="text-base"/>}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
};

export default Sidebar;
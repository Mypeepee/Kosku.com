import React, { useState, useEffect, useRef } from "react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { id } from "date-fns/locale"; // Bahasa Indonesia untuk Kalender

// =============================================================================
// 1. DATA KOTA (Contoh Kota Besar di Indonesia)
// =============================================================================
const CITIES_INDONESIA = [
  "Jakarta Pusat", "Jakarta Selatan", "Jakarta Barat", "Jakarta Timur", "Jakarta Utara",
  "Surabaya", "Bandung", "Medan", "Semarang", "Makassar", "Palembang", "Batam",
  "Pekanbaru", "Malang", "Denpasar", "Tangerang", "Depok", "Bekasi", "Bogor",
  "Yogyakarta", "Surakarta (Solo)", "Balikpapan", "Banjarmasin", "Pontianak",
  "Manado", "Mataram", "Padang", "Lampung", "Jambi", "Samarinda"
].sort();

// =============================================================================
// 2. MAIN COMPONENT
// =============================================================================
type Props = {
  formData: any;
  setFormData: (data: any) => void;
  isLoading: boolean;
  onSave: (e: React.FormEvent) => void;
};

const ProfileForm = ({ formData, setFormData, isLoading, onSave }: Props) => {
  // State untuk Pencarian Kota
  const [citySearch, setCitySearch] = useState("");
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const cityInputRef = useRef<HTMLDivElement>(null);

  // Sinkronisasi input search dengan data user saat load
  useEffect(() => {
    if (formData.kota_asal) setCitySearch(formData.kota_asal);
  }, [formData.kota_asal]);

  // Handle Klik di luar dropdown kota untuk menutup
  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (cityInputRef.current && !cityInputRef.current.contains(event.target)) {
        setIsCityDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter Kota berdasarkan ketikan
  const filteredCities = CITIES_INDONESIA.filter((city) =>
    city.toLowerCase().includes(citySearch.toLowerCase())
  );

  // Styles
  const inputWrapperClass = "relative group";
  const inputClass = 
    "w-full px-5 py-3.5 rounded-xl bg-[#0F0F0F] border border-white/10 text-white placeholder-gray-500 " +
    "focus:border-[#86efac] focus:ring-1 focus:ring-[#86efac] outline-none transition-all font-medium";
  const labelClass = "block text-sm font-bold text-gray-300 mb-2 group-focus-within:text-[#86efac] transition-colors";

  return (
    <>
      {/* GLOBAL STYLE OVERRIDE UNTUK DATEPICKER DARK MODE */}
      <style jsx global>{`
        .react-datepicker-wrapper { width: 100%; }
        .react-datepicker {
          background-color: #181818;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 0.75rem;
          font-family: inherit;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
        }
        .react-datepicker__header {
          background-color: #0F0F0F;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          border-top-left-radius: 0.75rem;
          border-top-right-radius: 0.75rem;
          padding-top: 15px;
        }
        .react-datepicker__current-month, .react-datepicker-time__header, .react-datepicker-year-header {
          color: white;
          font-weight: bold;
        }
        .react-datepicker__day-name { color: #888; }
        .react-datepicker__day { color: white; border-radius: 0.375rem; }
        .react-datepicker__day:hover { background-color: rgba(134, 239, 172, 0.2); }
        .react-datepicker__day--selected {
          background-color: #86efac;
          color: black;
          font-weight: bold;
        }
        .react-datepicker__day--keyboard-selected {
          background-color: rgba(134, 239, 172, 0.4);
        }
        .react-datepicker__triangle { display: none; }
        .react-datepicker__year-read-view--down-arrow,
        .react-datepicker__month-read-view--down-arrow,
        .react-datepicker__month-year-read-view--down-arrow { top: 8px; }
      `}</style>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#181818] rounded-2xl border border-white/5 p-5 sm:p-8 relative overflow-hidden"
      >
        {/* Hiasan Background Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#86efac]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/5">
            <div className="w-10 h-10 rounded-full bg-[#86efac]/10 flex items-center justify-center text-[#86efac]">
              <Icon icon="solar:user-id-bold" className="text-xl" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Edit Data Pribadi</h2>
              <p className="text-xs sm:text-sm text-gray-400">Pastikan data yang Anda masukkan valid.</p>
            </div>
          </div>

          <form onSubmit={onSave} className="space-y-6">
            
            {/* ROW 1: Nama & Email (Sekarang Editable) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={inputWrapperClass}>
                <label className={labelClass}>Nama Lengkap</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={formData.nama_lengkap}
                    onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
                    className={inputClass}
                    placeholder="Masukkan nama lengkap"
                  />
                  <Icon icon="solar:user-linear" className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                </div>
              </div>

              <div className={inputWrapperClass}>
                <label className={labelClass}>Email (Dapat Diubah)</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={inputClass}
                    placeholder="nama@email.com"
                  />
                  {/* Ikon Gembok HILANG, diganti amplop */}
                  <Icon icon="solar:letter-linear" className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                </div>
              </div>
            </div>

            {/* ROW 2: Telepon & Kota (Autocomplete) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={inputWrapperClass}>
                <label className={labelClass}>Nomor Telepon</label>
                <div className="relative opacity-70">
                  <input
                    type="text"
                    value={formData.nomor_telepon}
                    disabled
                    className={`${inputClass} cursor-not-allowed bg-[#222] border-transparent`}
                  />
                  <Icon icon="solar:lock-bold" className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                </div>
                <p className="text-[10px] text-gray-500 mt-1 ml-1">*No. HP terhubung dengan akun login</p>
              </div>

              {/* CITY SEARCH AUTOCOMPLETE */}
              <div className={inputWrapperClass} ref={cityInputRef}>
                <label className={labelClass}>Kota Asal</label>
                <div className="relative">
                  <input
                    type="text"
                    value={citySearch}
                    onChange={(e) => {
                      setCitySearch(e.target.value);
                      setIsCityDropdownOpen(true);
                      setFormData({ ...formData, kota_asal: e.target.value });
                    }}
                    onFocus={() => setIsCityDropdownOpen(true)}
                    className={inputClass}
                    placeholder="Cari kota..."
                  />
                  <Icon icon="solar:map-point-linear" className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                  
                  {/* Dropdown Results */}
                  <AnimatePresence>
                    {isCityDropdownOpen && filteredCities.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute top-full left-0 w-full mt-2 bg-[#1A1A1A] border border-white/10 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-50 custom-scrollbar"
                      >
                        {filteredCities.map((city, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setCitySearch(city);
                              setFormData({ ...formData, kota_asal: city });
                              setIsCityDropdownOpen(false);
                            }}
                            className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-[#86efac]/10 hover:text-[#86efac] transition-colors flex items-center gap-2 border-b border-white/5 last:border-0"
                          >
                            <Icon icon="solar:city-linear" />
                            {city}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* ROW 3: Tanggal Lahir (Modern) & Pekerjaan */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={inputWrapperClass}>
                <label className={labelClass}>Tanggal Lahir</label>
                <div className="relative">
                  <DatePicker
                    selected={formData.tanggal_lahir ? new Date(formData.tanggal_lahir) : null}
                    onChange={(date) => {
                       // Konversi ke string YYYY-MM-DD
                       const isoDate = date ? date.toISOString().split("T")[0] : "";
                       setFormData({ ...formData, tanggal_lahir: isoDate });
                    }}
                    dateFormat="dd MMMM yyyy"
                    locale={id}
                    placeholderText="Pilih tanggal lahir"
                    showYearDropdown
                    scrollableYearDropdown
                    yearDropdownItemNumber={50}
                    className={inputClass} // Pakai style input yang sama
                    wrapperClassName="w-full"
                    onKeyDown={(e) => e.preventDefault()} // Mencegah ketik manual
                  />
                  <Icon icon="solar:calendar-linear" className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
              </div>

              <div className={inputWrapperClass}>
                <label className={labelClass}>Pekerjaan</label>
                <div className="relative">
                  <select
                    value={formData.pekerjaan}
                    onChange={(e) => setFormData({ ...formData, pekerjaan: e.target.value })}
                    className={`${inputClass} appearance-none cursor-pointer`}
                  >
                    <option value="mahasiswa">Mahasiswa</option>
                    <option value="karyawan">Karyawan</option>
                    <option value="wiraswasta">Wiraswasta</option>
                    <option value="keluarga">Keluarga</option>
                    <option value="lainnya">Lainnya</option>
                  </select>
                  <Icon
                    icon="solar:alt-arrow-down-linear"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                  />
                </div>
              </div>
            </div>

            {/* ROW 4: Jenis Kelamin (Modern Cards) */}
            <div className={inputWrapperClass}>
              <label className={labelClass}>Jenis Kelamin</label>
              <div className="grid grid-cols-2 gap-4">
                {["pria", "wanita"].map((gender) => {
                  const isActive = formData.jenis_kelamin === gender;
                  return (
                    <button
                      key={gender}
                      type="button"
                      onClick={() => setFormData({ ...formData, jenis_kelamin: gender })}
                      className={`
                        relative overflow-hidden rounded-xl border px-4 py-4 transition-all duration-300 group
                        ${isActive 
                          ? "border-[#86efac] bg-[#86efac]/10 text-[#86efac]" 
                          : "border-white/10 bg-[#0F0F0F] text-gray-400 hover:border-white/20 hover:bg-white/5"
                        }
                      `}
                    >
                      <div className="flex flex-col items-center justify-center gap-2 relative z-10">
                        <Icon 
                          icon={gender === "pria" ? "solar:man-bold" : "solar:woman-bold"} 
                          className={`text-3xl transition-transform duration-300 ${isActive ? "scale-110" : "group-hover:scale-110"}`} 
                        />
                        <span className="capitalize font-bold text-sm tracking-wide">{gender}</span>
                      </div>
                      
                      {/* Active Indicator Dot */}
                      {isActive && (
                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#86efac] shadow-[0_0_10px_#86efac]"></div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TOMBOL SAVE */}
            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isLoading}
                className="
                  relative overflow-hidden rounded-xl bg-[#86efac] px-8 py-4 font-extrabold text-black 
                  shadow-[0_0_20px_rgba(134,239,172,0.3)] transition-all hover:shadow-[0_0_30px_rgba(134,239,172,0.5)] 
                  hover:-translate-y-1 active:scale-95 disabled:opacity-70 disabled:active:scale-100
                "
              >
                <div className="relative z-10 flex items-center gap-2">
                  {isLoading ? (
                    <>
                      <Icon icon="eos-icons:loading" className="animate-spin text-xl" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Icon icon="solar:diskette-bold" className="text-xl" />
                      <span>Simpan Perubahan</span>
                    </>
                  )}
                </div>
              </button>
            </div>

          </form>
        </div>
      </motion.div>
    </>
  );
};

export default ProfileForm;
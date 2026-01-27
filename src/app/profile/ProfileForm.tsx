"use client";

import React, { useState, useEffect, useRef } from "react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { id as localeId } from "date-fns/locale";
import toast from "react-hot-toast";

// =============================================================================
// TIPE DATA & UTIL
// =============================================================================

type Props = {
  formData: any;
  setFormData: (data: any) => void;
  isLoading: boolean;
  onSave: (e: React.FormEvent) => void;
};

interface Region {
  id: string;
  name: string;
  provinceName: string;
}

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/;
const EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Normalisasi nomor ke bentuk +62xxxxxxxx (dipanggil di awal render)
const normalizePhone = (raw?: string | null): string => {
  if (!raw) return "+62";
  let v = raw.toString().trim();

  // jika sudah format +62...
  if (v.startsWith("+62")) {
    // pastikan hanya digit setelah +62
    const digits = v.slice(3).replace(/\D/g, "");
    return "+62" + digits;
  }

  // jika format lokal 08xxxx → jadikan +628xxxx
  if (v.startsWith("0")) {
    const digits = v.replace(/\D/g, "").slice(1);
    return "+62" + digits;
  }

  // kalau angka tanpa 0 & tanpa +62, anggap sudah tanpa prefix → tambahkan +62
  const digits = v.replace(/\D/g, "");
  return "+62" + digits;
};

// =============================================================================
// KOMPONEN
// =============================================================================

const ProfileForm = ({ formData, setFormData, isLoading, onSave }: Props) => {
  const [errors, setErrors] = useState<{
    nama_lengkap?: string;
    email?: string;
    nomor_telepon?: string;
    kota_asal?: string;
    kode_referral?: string;
  }>({});

  const isAgent: boolean = formData.peran === "AGENT";

  // Saat pertama kali mount, normalisasi nomor telepon ke +62...
  useEffect(() => {
    if (!formData.nomor_telepon) {
      setFormData({ ...formData, nomor_telepon: "+62" });
    } else {
      setFormData((prev: any) => ({
        ...prev,
        nomor_telepon: normalizePhone(prev.nomor_telepon),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =============================================================================
  // NOMOR TELEPON: +62 | input, digit pertama tidak boleh 0
  // =============================================================================
  const handlePhoneChange = (value: string) => {
    const justDigits = value.replace(/\D/g, "");
    let digits = justDigits;

    if (digits.startsWith("0")) {
      digits = digits.slice(1);
    }

    const finalVal = "+62" + (digits ? digits : "");
    setFormData({ ...formData, nomor_telepon: finalVal });

    if (!digits) {
      setErrors((prev) => ({
        ...prev,
        nomor_telepon:
          "Masukkan nomor tanpa 0 di depan, contoh: 8123456789",
      }));
    } else {
      setErrors((prev) => ({ ...prev, nomor_telepon: undefined }));
    }
  };

  const getPhoneInputValue = () => {
    const normalized = normalizePhone(formData.nomor_telepon);
    return normalized.slice(3);
  };

  // =============================================================================
  // KOTA ASAL (sama seperti versi sebelumnya)
  // =============================================================================
  const [citySearch, setCitySearch] = useState("");
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [cityList, setCityList] = useState<Region[]>([]);
  const [loadingCity, setLoadingCity] = useState(false);
  const cityInputRef = useRef<HTMLDivElement>(null);
  const BASE_API = "https://ibnux.github.io/data-indonesia";

  const fetchCitiesOnce = async () => {
    if (cityList.length > 0) return;
    setLoadingCity(true);
    try {
      const provRes = await fetch(`${BASE_API}/provinsi.json`);
      const provData: { id: string; nama: string }[] = await provRes.json();

      const allCities: Region[] = [];

      for (const prov of provData) {
        try {
          const kabRes = await fetch(
            `${BASE_API}/kabupaten/${prov.id}.json`
          );
          const kabData: { id: string; nama: string }[] =
            await kabRes.json();

          kabData.forEach((k) => {
            allCities.push({
              id: k.id,
              name: k.nama,
              provinceName: prov.nama,
            });
          });
        } catch (e) {
          console.error("Error fetch kabupaten", e);
        }
      }

      allCities.sort((a, b) => a.name.localeCompare(b.name));
      setCityList(allCities);
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat daftar kota");
    } finally {
      setLoadingCity(false);
    }
  };

  useEffect(() => {
    if (formData.kota_asal) setCitySearch(formData.kota_asal);
  }, [formData.kota_asal]);

  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (
        cityInputRef.current &&
        !cityInputRef.current.contains(event.target)
      ) {
        setIsCityDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCities = cityList.filter((city) =>
    `${city.name}, ${city.provinceName}`
      .toLowerCase()
      .includes(citySearch.toLowerCase())
  );

  // =============================================================================
  // STYLE
  // =============================================================================
  const inputWrapperClass = "relative group";
  const inputClass =
    "w-full px-5 py-3.5 rounded-xl bg-[#0F0F0F] border border-white/10 text-white placeholder-gray-500 " +
    "focus:border-[#86efac] focus:ring-1 focus:ring-[#86efac] outline-none transition-all font-medium";
  const labelClass =
    "block text-sm font-bold text-gray-300 mb-2 group-focus-within:text-[#86efac] transition-colors";

  // =============================================================================
  // NAMA & EMAIL (sama seperti sebelumnya)
  // =============================================================================
  const handleNameChange = (value: string) => {
    setFormData({ ...formData, nama_lengkap: value });
    if (!value) {
      setErrors((prev) => ({
        ...prev,
        nama_lengkap: "Nama tidak boleh kosong",
      }));
      return;
    }
    if (!NAME_REGEX.test(value)) {
      setErrors((prev) => ({
        ...prev,
        nama_lengkap:
          "Nama hanya boleh huruf dan spasi (tanpa angka atau simbol).",
      }));
    } else {
      setErrors((prev) => ({ ...prev, nama_lengkap: undefined }));
    }
  };

  const handleEmailChange = (value: string) => {
    setFormData({ ...formData, email: value });
    if (!value) {
      setErrors((prev) => ({
        ...prev,
        email: "Email tidak boleh kosong",
      }));
      return;
    }
    if (!EMAIL_REGEX.test(value)) {
      setErrors((prev) => ({
        ...prev,
        email: "Format email tidak valid.",
      }));
    } else {
      setErrors((prev) => ({ ...prev, email: undefined }));
    }
  };

  // =============================================================================
  // KODE REFERRAL + SHARE (sama seperti versi terakhir)
  // =============================================================================
  const agentReferralCode: string | undefined =
    isAgent && formData.id_agent
      ? formData.id_agent
      : isAgent && formData.kode_referral
      ? formData.kode_referral
      : undefined;

  const handleReferralChange = (value: string) => {
    const raw = value.toUpperCase().replace(/\s+/g, "");
    const withoutAG = raw.replace(/^AG\|?/, "").replace(/^AG/, "");
    const cleaned = withoutAG.replace(/[^A-Z0-9]/g, "");
    const finalCode = cleaned;

    if (!finalCode) {
      setErrors((prev) => ({
        ...prev,
        kode_referral: "Isi kode referral agent jika ada.",
      }));
    } else {
      setErrors((prev) => ({ ...prev, kode_referral: undefined }));
    }

    setFormData({ ...formData, kode_referral: `AG${finalCode}` });
  };

  const referralHint =
    "Bagikan kode ini ke klien. Jika mereka daftar atau transaksi dengan kode ini, klien akan terhubung ke akunmu dan aktivitas properti mereka akan tercatat untukmu.";

  const handleShareReferral = async () => {
    if (!agentReferralCode) return;

    const fullCode = agentReferralCode;
    const shareText = `Kode referral saya di Premier Asset: ${fullCode}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Kode Referral Agent",
          text: shareText,
        });
      } catch (err) {
        console.error(err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        toast.success("Kode referral disalin ke clipboard.");
      } catch {
        toast.error("Tidak dapat menyalin kode referral.");
      }
    }
  };

  return (
    <>
      {/* GLOBAL STYLE DATEPICKER (tetap) */}
      <style jsx global>{`
        .react-datepicker-wrapper {
          width: 100%;
        }
        .react-datepicker {
          background-color: #181818;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.75rem;
          font-family: inherit;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
        }
        .react-datepicker__header {
          background-color: #0f0f0f;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          border-top-left-radius: 0.75rem;
          border-top-right-radius: 0.75rem;
          padding-top: 15px;
        }
        .react-datepicker__current-month,
        .react-datepicker-time__header,
        .react-datepicker-year-header {
          color: white;
          font-weight: bold;
        }
        .react-datepicker__day-name {
          color: #888;
        }
        .react-datepicker__day {
          color: white;
          border-radius: 0.375rem;
        }
        .react-datepicker__day:hover {
          background-color: rgba(134, 239, 172, 0.2);
        }
        .react-datepicker__day--selected {
          background-color: #86efac;
          color: black;
          font-weight: bold;
        }
        .react-datepicker__day--keyboard-selected {
          background-color: rgba(134, 239, 172, 0.4);
        }
        .react-datepicker__triangle {
          display: none;
        }
      `}</style>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#181818] rounded-2xl border border-white/5 p-5 sm:p-8 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#86efac]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        <div className="relative z-10">
          {/* HEADER */}
          <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/5">
            <div className="w-10 h-10 rounded-full bg-[#86efac]/10 flex items-center justify-center text-[#86efac]">
              <Icon icon="solar:user-id-bold" className="text-xl" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                Edit Data Pribadi
              </h2>
              <p className="text-xs sm:text-sm text-gray-400">
                Pastikan data yang Anda masukkan valid.
              </p>
            </div>
          </div>

          {/* FORM */}
          <form onSubmit={onSave} className="space-y-6">
            {/* ROW 1: Nama & Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nama */}
              <div className={inputWrapperClass}>
                <label className={labelClass}>Nama Lengkap</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={formData.nama_lengkap || ""}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className={inputClass}
                    placeholder="Masukkan nama lengkap"
                  />
                  <Icon
                    icon="solar:user-linear"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
                  />
                </div>
                {errors.nama_lengkap && (
                  <p className="mt-1 text-[11px] text-red-400">
                    {errors.nama_lengkap}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className={inputWrapperClass}>
                <label className={labelClass}>Email</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={formData.email || ""}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    className={inputClass}
                    placeholder="nama@email.com"
                  />
                  <Icon
                    icon="solar:letter-linear"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-[11px] text-red-400">
                    {errors.email}
                  </p>
                )}
              </div>
            </div>

            {/* ROW 2: Telepon & Kota */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Telepon: +62 | input */}
              <div className={inputWrapperClass}>
                <label className={labelClass}>Nomor Telepon</label>
                <div className="relative flex">
                  <span className="inline-flex items-center px-3 sm:px-4 rounded-l-xl bg-[#0F0F0F] border border-r-0 border-white/10 text-xs sm:text-sm font-semibold text-gray-300 whitespace-nowrap">
                    +62
                  </span>
                  <input
                    type="tel"
                    value={getPhoneInputValue()}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className={`${inputClass} rounded-l-none`}
                    placeholder="8123456789"
                  />
                  <Icon
                    icon="solar:phone-linear"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1 ml-1">
                  Masukkan nomor tanpa 0 di depan, contoh: 8123456789.
                </p>
                {errors.nomor_telepon && (
                  <p className="mt-1 text-[11px] text-red-400">
                    {errors.nomor_telepon}
                  </p>
                )}
              </div>

              {/* Kota Asal */}
              <div className={inputWrapperClass} ref={cityInputRef}>
                <label className={labelClass}>Kota Asal</label>
                <div className="relative">
                  <input
                    type="text"
                    value={citySearch}
                    onChange={(e) => {
                      setCitySearch(e.target.value);
                      setIsCityDropdownOpen(true);
                    }}
                    onFocus={() => {
                      setIsCityDropdownOpen(true);
                      fetchCitiesOnce();
                    }}
                    className={inputClass}
                    placeholder="Cari kota / kabupaten..."
                  />
                  <Icon
                    icon="solar:map-point-linear"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
                  />

                  <AnimatePresence>
                    {isCityDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute top-full left-0 w-full mt-2 bg-[#1A1A1A] border border-white/10 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-50 custom-scrollbar"
                      >
                        {loadingCity && (
                          <div className="px-4 py-3 text-xs text-gray-400 flex items-center gap-2">
                            <Icon
                              icon="line-md:loading-loop"
                              className="text-[#86efac]"
                            />
                            Memuat daftar kota...
                          </div>
                        )}
                        {!loadingCity && filteredCities.length === 0 && (
                          <div className="px-4 py-3 text-xs text-gray-400">
                            Kota tidak ditemukan.
                          </div>
                        )}
                        {!loadingCity &&
                          filteredCities.map((city) => (
                            <button
                              key={city.id}
                              type="button"
                              onClick={() => {
                                setCitySearch(city.name);
                                setFormData({
                                  ...formData,
                                  kota_asal: city.name,
                                });
                                setIsCityDropdownOpen(false);
                                setErrors((prev) => ({
                                  ...prev,
                                  kota_asal: undefined,
                                }));
                              }}
                              className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-[#86efac]/10 hover:text-[#86efac] transition-colors flex items-center gap-2 border-b border-white/5 last:border-0"
                            >
                              <Icon icon="solar:city-linear" />
                              <div>
                                <div>{city.name}</div>
                                <div className="text-[10px] text-gray-500">
                                  {city.provinceName}
                                </div>
                              </div>
                            </button>
                          ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {errors.kota_asal && (
                  <p className="mt-1 text-[11px] text-red-400">
                    {errors.kota_asal}
                  </p>
                )}
              </div>
            </div>

            {/* ROW 3: Tanggal Lahir & Peran */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tanggal Lahir */}
              <div className={inputWrapperClass}>
                <label className={labelClass}>Tanggal Lahir</label>
                <div className="relative">
                  <DatePicker
                    selected={
                      formData.tanggal_lahir
                        ? new Date(formData.tanggal_lahir)
                        : null
                    }
                    onChange={(date) => {
                      const isoDate = date
                        ? date.toISOString().split("T")[0]
                        : "";
                      setFormData({
                        ...formData,
                        tanggal_lahir: isoDate,
                      });
                    }}
                    dateFormat="dd MMMM yyyy"
                    locale={localeId}
                    placeholderText="Pilih tanggal lahir"
                    showYearDropdown
                    scrollableYearDropdown
                    yearDropdownItemNumber={50}
                    className={inputClass}
                    wrapperClassName="w-full"
                    onKeyDown={(e) => e.preventDefault()}
                  />
                  <Icon
                    icon="solar:calendar-linear"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                  />
                </div>
              </div>

              {/* Peran */}
              <div className={inputWrapperClass}>
                <label className={labelClass}>Peran Akun</label>
                <div className="relative">
                  <input
                    type="text"
                    value={
                      formData.peran === "AGENT"
                        ? "Agent"
                        : formData.peran === "USER"
                        ? "Pengguna"
                        : formData.peran || "-"
                    }
                    disabled
                    className={`${inputClass} bg-[#222] cursor-not-allowed`}
                  />
                  <Icon
                    icon="solar:shield-user-bold"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
                  />
                </div>
              </div>
            </div>

            {/* ROW 4: Kode Referral */}
            <div className={inputWrapperClass}>
              <label className={labelClass}>Kode Referral</label>

              {isAgent ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <div className="relative flex flex-1">
                      <span className="inline-flex items-center px-3 sm:px-4 rounded-l-xl bg-[#0F0F0F] border border-r-0 border-white/10 text-xs sm:text-sm font-semibold text-gray-300 whitespace-nowrap">
                        AG
                      </span>
                      <input
                        type="text"
                        value={
                          (agentReferralCode || "")
                            .toUpperCase()
                            .replace(/^AG/, "") || ""
                        }
                        disabled
                        className={`${inputClass} rounded-l-none bg-[#222] cursor-not-allowed`}
                      />
                      <Icon
                        icon="solar:ticket-sale-linear"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleShareReferral}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0F0F0F] border border-white/10 text-[11px] sm:text-xs text-gray-100 hover:bg-white/10 hover:border-[#86efac]/50 hover:text-[#86efac] transition-colors whitespace-nowrap"
                    >
                      <Icon
                        icon="solar:share-bold"
                        className="text-sm"
                      />
                      <span>Bagikan</span>
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400 leading-relaxed">
                    {referralHint}
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="relative flex">
                    <span className="inline-flex items-center px-3 sm:px-4 rounded-l-xl bg-[#0F0F0F] border border-r-0 border-white/10 text-xs sm:text-sm font-semibold text-gray-300 whitespace-nowrap">
                      AG
                    </span>
                    <input
                      type="text"
                      value={
                        (formData.kode_referral || "")
                          .toUpperCase()
                          .replace(/^AG/, "") || ""
                      }
                      onChange={(e) => handleReferralChange(e.target.value)}
                      className={`${inputClass} rounded-l-none`}
                      placeholder="Isi kode referral agent (opsional)"
                    />
                    <Icon
                      icon="solar:ticket-sale-linear"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400">
                    Kode akan menghubungkan akunmu ke agent tertentu. Kosongkan
                    jika tidak punya kode.
                  </p>
                </div>
              )}

              {errors.kode_referral && (
                <p className="mt-1 text-[11px] text-red-400">
                  {errors.kode_referral}
                </p>
              )}
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
                      <Icon
                        icon="eos-icons:loading"
                        className="animate-spin text-xl"
                      />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Icon
                        icon="solar:diskette-bold"
                        className="text-xl"
                      />
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

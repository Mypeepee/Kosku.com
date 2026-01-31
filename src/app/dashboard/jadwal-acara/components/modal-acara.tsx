"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { createPortal } from "react-dom";

interface EventData {
  id_acara: string;
  judul_acara: string;
  deskripsi?: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  waktu_mulai?: string;
  waktu_selesai?: string;
  tipe_acara: string;
  lokasi?: string;
  alamat_lengkap?: string;
  status_acara: string;
  id_property?: string;
  durasi_pilih?: number;
}

interface ModalAcaraProps {
  open: boolean;
  onClose: () => void;
  selectedDate?: Date | null;
  selectedEvent?: EventData | null;
  onSuccess?: () => void;
}

const tipeAcaraOptions = [
  { value: "BUYER_MEETING", label: "Meeting Buyer", icon: "solar:users-group-rounded-linear", color: "bg-blue-500" },
  { value: "SITE_VISIT", label: "Site Visit", icon: "solar:home-2-linear", color: "bg-purple-500" },
  { value: "CLOSING", label: "Closing", icon: "solar:check-circle-linear", color: "bg-green-500" },
  { value: "FOLLOW_UP", label: "Follow Up", icon: "solar:phone-calling-linear", color: "bg-yellow-500" },
  { value: "OPEN_HOUSE", label: "Open House", icon: "solar:buildings-3-linear", color: "bg-pink-500" },
  { value: "INTERNAL_MEETING", label: "Meeting Internal", icon: "solar:case-round-linear", color: "bg-indigo-500" },
  { value: "TRAINING", label: "Training", icon: "solar:book-linear", color: "bg-orange-500" },
  { value: "PEMILU", label: "Event PEMILU", icon: "solar:flag-linear", color: "bg-red-500" },
  { value: "LAINNYA", label: "Lainnya", icon: "solar:star-linear", color: "bg-gray-500" },
];

// ✅ Helper function untuk format date ke YYYY-MM-DD (timezone-safe)
const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function ModalAcara({ 
  open, 
  onClose, 
  selectedDate, 
  selectedEvent,
  onSuccess 
}: ModalAcaraProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    judul_acara: "",
    deskripsi: "",
    tipe_acara: "BUYER_MEETING",
    tanggal_mulai: "",
    tanggal_selesai: "",
    waktu_mulai: "09:00",
    waktu_selesai: "10:00",
    lokasi: "",
    alamat_lengkap: "",
    durasi_pilih: 60,
    id_property: "",
  });

  // ✅ Set default date ketika selectedDate berubah (ADD MODE)
  useEffect(() => {
    if (selectedDate && open && !selectedEvent) {
      const dateStr = formatDateForInput(selectedDate);
      console.log("Setting default date:", dateStr);
      
      setFormData(prev => ({
        ...prev,
        tanggal_mulai: dateStr,
        tanggal_selesai: dateStr,
      }));
    }
  }, [selectedDate, open, selectedEvent]);

  // ✅ Set form data ketika edit event (EDIT MODE)
  useEffect(() => {
    if (selectedEvent && open) {
      console.log("Editing event:", selectedEvent);
      
      setFormData({
        judul_acara: selectedEvent.judul_acara,
        deskripsi: selectedEvent.deskripsi || "",
        tipe_acara: selectedEvent.tipe_acara,
        tanggal_mulai: selectedEvent.tanggal_mulai.substring(0, 10),
        tanggal_selesai: selectedEvent.tanggal_selesai.substring(0, 10),
        waktu_mulai: selectedEvent.waktu_mulai || "09:00",
        waktu_selesai: selectedEvent.waktu_selesai || "10:00",
        lokasi: selectedEvent.lokasi || "",
        alamat_lengkap: selectedEvent.alamat_lengkap || "",
        durasi_pilih: selectedEvent.durasi_pilih || 60,
        id_property: selectedEvent.id_property || "",
      });
    } else if (!selectedEvent && open && !selectedDate) {
      // ✅ Reset form jika bukan edit dan tidak ada selected date
      resetForm();
    }
  }, [selectedEvent, open, selectedDate]);

  // ✅ Reset form to default
  const resetForm = () => {
    setFormData({
      judul_acara: "",
      deskripsi: "",
      tipe_acara: "BUYER_MEETING",
      tanggal_mulai: "",
      tanggal_selesai: "",
      waktu_mulai: "09:00",
      waktu_selesai: "10:00",
      lokasi: "",
      alamat_lengkap: "",
      durasi_pilih: 60,
      id_property: "",
    });
    setError(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // ✅ Validation
      if (!formData.judul_acara.trim()) {
        throw new Error("Judul acara wajib diisi");
      }

      if (!formData.tanggal_mulai || !formData.tanggal_selesai) {
        throw new Error("Tanggal mulai dan selesai wajib diisi");
      }

      // ✅ Check if tanggal_selesai >= tanggal_mulai
      if (formData.tanggal_selesai < formData.tanggal_mulai) {
        throw new Error("Tanggal selesai tidak boleh lebih awal dari tanggal mulai");
      }

      const payload = {
        ...formData,
        id_acara: selectedEvent?.id_acara,
      };

      console.log("Submitting payload:", payload);

      const response = await fetch("/api/dashboard/acara", {
        method: selectedEvent ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Gagal menyimpan acara");
      }

      const result = await response.json();
      console.log("Success:", result);

      // ✅ Reset form
      resetForm();

      // ✅ Callback success
      if (onSuccess) onSuccess();
      onClose();

      // ✅ Show success message (optional: replace with toast)
      alert(selectedEvent ? "Acara berhasil diperbarui!" : "Acara berhasil ditambahkan!");
      
    } catch (error: any) {
      console.error("Error:", error);
      setError(error.message || "Gagal menyimpan acara. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Gunakan portal untuk render modal di luar DOM tree
  if (typeof window === "undefined") return null;

  const isEditMode = !!selectedEvent;

  const modalContent = (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
            style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
          />

          {/* Modal - Centered */}
          <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4" 
            style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="
                w-full max-w-2xl max-h-[90vh]
                overflow-hidden
                rounded-2xl border border-white/10
                bg-gradient-to-br from-[#0a0e14] to-[#050608]
                shadow-2xl
              "
            >
              {/* Header */}
              <div className="border-b border-white/10 bg-white/5 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                      isEditMode 
                        ? "bg-blue-500/20 border-blue-500/50" 
                        : "bg-emerald-500/20 border-emerald-500/50"
                    }`}>
                      <Icon 
                        icon={isEditMode ? "solar:pen-linear" : "solar:calendar-add-linear"} 
                        className={`text-xl ${isEditMode ? "text-blue-300" : "text-emerald-300"}`} 
                      />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">
                        {isEditMode ? "Edit Acara" : "Tambah Acara Baru"}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {isEditMode ? "Perbarui detail acara" : "Buat jadwal atau event baru"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    disabled={loading}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
                  >
                    <Icon icon="solar:close-circle-linear" className="text-2xl" />
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                  <div className="flex items-start gap-2">
                    <Icon icon="solar:danger-circle-bold" className="text-red-400 text-lg flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-red-300">{error}</span>
                  </div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-180px)] px-6 py-4 custom-scrollbar">
                <div className="space-y-5">
                  {/* Judul Acara */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-300">
                      Judul Acara <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="judul_acara"
                      value={formData.judul_acara}
                      onChange={handleChange}
                      required
                      placeholder="Contoh: Meeting dengan Pak Budi"
                      className="
                        w-full rounded-xl border border-white/10 
                        bg-white/5 px-4 py-3 text-white
                        placeholder:text-slate-500
                        focus:border-emerald-500/50 focus:bg-white/10 focus:outline-none
                        transition-all
                      "
                    />
                  </div>

                  {/* Tipe Acara */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-300">
                      Tipe Acara <span className="text-red-400">*</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {tipeAcaraOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, tipe_acara: option.value }))}
                          className={`
                            flex items-center gap-2 rounded-xl border p-3 transition-all
                            ${
                              formData.tipe_acara === option.value
                                ? "border-emerald-500/50 bg-emerald-500/20 shadow-lg shadow-emerald-500/20"
                                : "border-white/10 bg-white/5 hover:bg-white/10"
                            }
                          `}
                        >
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${option.color}`}>
                            <Icon icon={option.icon} className="text-lg text-white" />
                          </div>
                          <span className={`text-sm font-medium ${formData.tipe_acara === option.value ? "text-emerald-300" : "text-slate-300"}`}>
                            {option.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tanggal */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-300">
                        Tanggal Mulai <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="date"
                        name="tanggal_mulai"
                        value={formData.tanggal_mulai}
                        onChange={handleChange}
                        required
                        className="
                          w-full rounded-xl border border-white/10 
                          bg-white/5 px-4 py-3 text-white
                          focus:border-emerald-500/50 focus:bg-white/10 focus:outline-none
                          transition-all
                        "
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-300">
                        Tanggal Selesai <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="date"
                        name="tanggal_selesai"
                        value={formData.tanggal_selesai}
                        onChange={handleChange}
                        required
                        min={formData.tanggal_mulai}
                        className="
                          w-full rounded-xl border border-white/10 
                          bg-white/5 px-4 py-3 text-white
                          focus:border-emerald-500/50 focus:bg-white/10 focus:outline-none
                          transition-all
                        "
                      />
                    </div>
                  </div>

                  {/* Waktu */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-300">
                        Waktu Mulai
                      </label>
                      <input
                        type="time"
                        name="waktu_mulai"
                        value={formData.waktu_mulai}
                        onChange={handleChange}
                        className="
                          w-full rounded-xl border border-white/10 
                          bg-white/5 px-4 py-3 text-white
                          focus:border-emerald-500/50 focus:bg-white/10 focus:outline-none
                          transition-all
                        "
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-300">
                        Waktu Selesai
                      </label>
                      <input
                        type="time"
                        name="waktu_selesai"
                        value={formData.waktu_selesai}
                        onChange={handleChange}
                        className="
                          w-full rounded-xl border border-white/10 
                          bg-white/5 px-4 py-3 text-white
                          focus:border-emerald-500/50 focus:bg-white/10 focus:outline-none
                          transition-all
                        "
                      />
                    </div>
                  </div>

                  {/* Lokasi */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-300">
                      Lokasi
                    </label>
                    <input
                      type="text"
                      name="lokasi"
                      value={formData.lokasi}
                      onChange={handleChange}
                      placeholder="Contoh: Kantor Cabang Surabaya"
                      className="
                        w-full rounded-xl border border-white/10 
                        bg-white/5 px-4 py-3 text-white
                        placeholder:text-slate-500
                        focus:border-emerald-500/50 focus:bg-white/10 focus:outline-none
                        transition-all
                      "
                    />
                  </div>

                  {/* Alamat Lengkap */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-300">
                      Alamat Lengkap
                    </label>
                    <textarea
                      name="alamat_lengkap"
                      value={formData.alamat_lengkap}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Masukkan alamat lengkap lokasi acara..."
                      className="
                        w-full rounded-xl border border-white/10 
                        bg-white/5 px-4 py-3 text-white
                        placeholder:text-slate-500
                        focus:border-emerald-500/50 focus:bg-white/10 focus:outline-none
                        transition-all resize-none
                      "
                    />
                  </div>

                  {/* Deskripsi */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-300">
                      Deskripsi
                    </label>
                    <textarea
                      name="deskripsi"
                      value={formData.deskripsi}
                      onChange={handleChange}
                      rows={4}
                      placeholder="Tulis detail atau catatan tentang acara ini..."
                      className="
                        w-full rounded-xl border border-white/10 
                        bg-white/5 px-4 py-3 text-white
                        placeholder:text-slate-500
                        focus:border-emerald-500/50 focus:bg-white/10 focus:outline-none
                        transition-all resize-none
                      "
                    />
                  </div>

                  {/* Durasi Pilih (hanya untuk PEMILU) */}
                  {formData.tipe_acara === "PEMILU" && (
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-300">
                        Durasi Pilih Unit (detik)
                      </label>
                      <input
                        type="number"
                        name="durasi_pilih"
                        value={formData.durasi_pilih}
                        onChange={handleChange}
                        min={30}
                        max={300}
                        className="
                          w-full rounded-xl border border-white/10 
                          bg-white/5 px-4 py-3 text-white
                          focus:border-emerald-500/50 focus:bg-white/10 focus:outline-none
                          transition-all
                        "
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Waktu yang diberikan kepada agent untuk memilih unit (default: 60 detik)
                      </p>
                    </div>
                  )}
                </div>
              </form>

              {/* Footer */}
              <div className="border-t border-white/10 bg-white/5 px-6 py-4">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={loading}
                    className="
                      rounded-xl border border-white/10 bg-white/5 
                      px-5 py-2.5 text-sm font-medium text-slate-300
                      transition-all hover:bg-white/10
                      disabled:opacity-50 disabled:cursor-not-allowed
                    "
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    onClick={handleSubmit}
                    disabled={loading}
                    className={`
                      group relative overflow-hidden
                      rounded-xl bg-gradient-to-r 
                      ${isEditMode 
                        ? "from-blue-500 to-blue-600 shadow-blue-500/50 hover:shadow-blue-500/60" 
                        : "from-emerald-500 to-emerald-600 shadow-emerald-500/50 hover:shadow-emerald-500/60"
                      }
                      px-6 py-2.5 text-sm font-semibold text-white
                      shadow-lg
                      transition-all duration-300
                      hover:shadow-xl
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <Icon icon="solar:settings-linear" className="animate-spin text-lg" />
                        {isEditMode ? "Memperbarui..." : "Menyimpan..."}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Icon icon="solar:check-circle-bold" className="text-lg" />
                        {isEditMode ? "Perbarui Acara" : "Simpan Acara"}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  // Render modal menggunakan Portal ke body
  return createPortal(modalContent, document.body);
}

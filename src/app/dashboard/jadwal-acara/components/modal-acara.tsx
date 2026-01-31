// src/app/dashboard/jadwal-acara/components/modal-acara.tsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { createPortal } from "react-dom";

interface ModalAcaraProps {
  open: boolean;
  onClose: () => void;
  selectedDate?: Date | null;
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

export default function ModalAcara({ open, onClose, selectedDate, onSuccess }: ModalAcaraProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    judul_acara: "",
    deskripsi: "",
    tipe_acara: "BUYER_MEETING",
    tanggal_mulai: selectedDate ? selectedDate.toISOString().split("T")[0] : "",
    tanggal_selesai: selectedDate ? selectedDate.toISOString().split("T")[0] : "",
    waktu_mulai: "09:00",
    waktu_selesai: "10:00",
    lokasi: "",
    alamat_lengkap: "",
    durasi_pilih: 60,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/dashboard/acara", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Gagal menyimpan acara");
      }

      const result = await response.json();
      
      // Reset form
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
      });

      if (onSuccess) onSuccess();
      onClose();
      alert("Acara berhasil ditambahkan!");
      
    } catch (error) {
      console.error("Error:", error);
      alert("Gagal menyimpan acara. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  // Gunakan portal untuk render modal di luar DOM tree
  if (typeof window === "undefined") return null;

  const modalContent = (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
            style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
          />

          {/* Modal - Tambahkan flex centering di container */}
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}>
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
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/50">
                      <Icon icon="solar:calendar-add-linear" className="text-xl text-emerald-300" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Tambah Acara Baru</h3>
                      <p className="text-xs text-slate-400">Buat jadwal atau event baru</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <Icon icon="solar:close-circle-linear" className="text-2xl" />
                  </button>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-180px)] px-6 py-4">
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
                    onClick={onClose}
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
                    className="
                      group relative overflow-hidden
                      rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600
                      px-6 py-2.5 text-sm font-semibold text-white
                      shadow-lg shadow-emerald-500/50
                      transition-all duration-300
                      hover:shadow-xl hover:shadow-emerald-500/60
                      disabled:opacity-50 disabled:cursor-not-allowed
                    "
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <Icon icon="solar:settings-linear" className="animate-spin text-lg" />
                        Menyimpan...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Icon icon="solar:check-circle-bold" className="text-lg" />
                        Simpan Acara
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

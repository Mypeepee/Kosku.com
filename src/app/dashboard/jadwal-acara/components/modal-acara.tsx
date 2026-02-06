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
  tipe_acara: string;
  lokasi?: string;
  status_acara: string;
  id_property?: string;
  durasi_pilih?: number;
}

// 🔥 tambah type mode
type ModalMode = "create" | "edit" | "view";

interface ModalAcaraProps {
  open: boolean;
  onClose: () => void;
  selectedDate?: Date | null;
  selectedEvent?: EventData | null;
  onSuccess?: () => void;
  mode?: ModalMode; // optional, default auto dari selectedEvent
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

const formatDateForInput = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const extractTime = (iso: string): string => {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
};

export default function ModalAcara({
  open,
  onClose,
  selectedDate,
  selectedEvent,
  onSuccess,
  mode, // create | edit | view
}: ModalAcaraProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateTimeError, setDateTimeError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    judul_acara: "",
    deskripsi: "",
    tipe_acara: "BUYER_MEETING",
    tanggal_mulai: "",
    tanggal_selesai: "",
    jam_mulai: "09:00",
    jam_selesai: "10:00",
    lokasi: "",
    durasi_pilih: 60,
    id_property: "",
  });

  // mode final (kalau prop mode tidak dikirim, fallback ke create/edit)
  const isEditMode = !!selectedEvent && (mode ?? "edit") === "edit";
  const isViewMode =
    (mode ?? (selectedEvent ? "edit" : "create")) === "view";

  useEffect(() => {
    if (selectedDate && open && !selectedEvent) {
      const dateStr = formatDateForInput(selectedDate);
      setFormData((prev) => ({
        ...prev,
        tanggal_mulai: dateStr,
        tanggal_selesai: dateStr,
      }));
    }
  }, [selectedDate, open, selectedEvent]);

  useEffect(() => {
    if (selectedEvent && open) {
      setFormData({
        judul_acara: selectedEvent.judul_acara,
        deskripsi: selectedEvent.deskripsi || "",
        tipe_acara: selectedEvent.tipe_acara,
        tanggal_mulai: selectedEvent.tanggal_mulai.substring(0, 10),
        tanggal_selesai: selectedEvent.tanggal_selesai.substring(0, 10),
        jam_mulai: extractTime(selectedEvent.tanggal_mulai),
        jam_selesai: extractTime(selectedEvent.tanggal_selesai),
        lokasi: selectedEvent.lokasi || "",
        durasi_pilih: selectedEvent.durasi_pilih || 60,
        id_property: selectedEvent.id_property || "",
      });
    } else if (!selectedEvent && open && !selectedDate) {
      resetForm();
    }
  }, [selectedEvent, open, selectedDate]);

  const resetForm = () => {
    setFormData({
      judul_acara: "",
      deskripsi: "",
      tipe_acara: "BUYER_MEETING",
      tanggal_mulai: "",
      tanggal_selesai: "",
      jam_mulai: "09:00",
      jam_selesai: "10:00",
      lokasi: "",
      durasi_pilih: 60,
      id_property: "",
    });
    setError(null);
    setDateTimeError(null);
  };

  const validateDateTime = () => {
    if (!formData.tanggal_mulai || !formData.tanggal_selesai) {
      setDateTimeError(null);
      return true;
    }

    const startDateTime = new Date(`${formData.tanggal_mulai}T${formData.jam_mulai}:00`);
    const endDateTime = new Date(`${formData.tanggal_selesai}T${formData.jam_selesai}:00`);

    if (endDateTime <= startDateTime) {
      setDateTimeError("Waktu selesai harus lebih besar dari waktu mulai");
      return false;
    }

    setDateTimeError(null);
    return true;
  };

  useEffect(() => {
    if (!isViewMode) {
      validateDateTime();
    }
  }, [
    formData.tanggal_mulai,
    formData.tanggal_selesai,
    formData.jam_mulai,
    formData.jam_selesai,
    isViewMode,
  ]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    if (isViewMode) return; // di view mode tidak boleh mengubah
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "durasi_pilih" ? Number(value) : value,
    }));
  };

  const buildDateTime = (date: string, time: string): string => {
    return `${date}T${time}:00`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) return; // safety guard

    setLoading(true);
    setError(null);

    try {
      if (!formData.judul_acara.trim()) {
        throw new Error("Judul acara wajib diisi");
      }
      if (!formData.tanggal_mulai || !formData.tanggal_selesai) {
        throw new Error("Tanggal mulai dan selesai wajib diisi");
      }

      const startDateTime = new Date(`${formData.tanggal_mulai}T${formData.jam_mulai}:00`);
      const endDateTime = new Date(`${formData.tanggal_selesai}T${formData.jam_selesai}:00`);

      if (endDateTime <= startDateTime) {
        throw new Error("Waktu selesai harus lebih besar dari waktu mulai");
      }

      if (
        formData.tipe_acara === "PEMILU" &&
        (!formData.durasi_pilih || formData.durasi_pilih < 30)
      ) {
        throw new Error("Durasi pilih minimal 30 detik untuk event PEMILU");
      }

      const tanggal_mulai_full = buildDateTime(
        formData.tanggal_mulai,
        formData.jam_mulai
      );
      const tanggal_selesai_full = buildDateTime(
        formData.tanggal_selesai,
        formData.jam_selesai
      );

      const payload = {
        id_acara: selectedEvent?.id_acara,
        judul_acara: formData.judul_acara.trim(),
        deskripsi: formData.deskripsi.trim() || null,
        tipe_acara: formData.tipe_acara,
        tanggal_mulai: tanggal_mulai_full,
        tanggal_selesai: tanggal_selesai_full,
        lokasi: formData.lokasi.trim() || null,
        durasi_pilih:
          formData.tipe_acara === "PEMILU" ? formData.durasi_pilih || 60 : null,
        id_property: formData.id_property ? Number(formData.id_property) : null,
      };

      const response = await fetch("/api/dashboard/acara", {
        method: selectedEvent ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Gagal menyimpan acara");
      }

      await response.json();

      resetForm();
      onSuccess?.();
      onClose();
      alert(selectedEvent ? "Acara berhasil diperbarui!" : "Acara berhasil ditambahkan!");
    } catch (err: any) {
      console.error("Error submit acara:", err);
      setError(err.message || "Gagal menyimpan acara. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (typeof window === "undefined") return null;

  const hasDateTimeError = !!dateTimeError;

  const modalContent = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
          />

          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#05060b] via-[#050712] to-[#020308] shadow-[0_0_60px_rgba(59,130,246,0.35)]"
            >
              {/* Header */}
              <div className="border-b border-white/10 bg-white/5 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                        isViewMode
                          ? "bg-slate-500/20 border-slate-500/60"
                          : isEditMode
                          ? "bg-blue-500/20 border-blue-500/60"
                          : "bg-emerald-500/20 border-emerald-500/60"
                      }`}
                    >
                      <Icon
                        icon={
                          isViewMode
                            ? "solar:eye-linear"
                            : isEditMode
                            ? "solar:pen-linear"
                            : "solar:calendar-add-linear"
                        }
                        className={`text-xl ${
                          isViewMode
                            ? "text-slate-200"
                            : isEditMode
                            ? "text-blue-300"
                            : "text-emerald-300"
                        }`}
                      />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        {isViewMode
                          ? "Detail Acara"
                          : isEditMode
                          ? "Edit Acara"
                          : "Tambah Acara Baru"}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {isViewMode
                          ? "Lihat detail acara yang sudah terjadwal"
                          : isEditMode
                          ? "Perbarui detail acara yang sudah terjadwal"
                          : "Buat event baru untuk jadwal aktivitas dan pemilu unit"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    disabled={loading}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
                  >
                    <Icon icon="solar:close-circle-linear" className="text-2xl" />
                  </button>
                </div>
              </div>

              {/* Error (hanya relevan di edit/create) */}
              {!isViewMode && error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mx-6 mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3"
                >
                  <div className="flex items-start gap-2">
                    <Icon
                      icon="solar:danger-circle-bold"
                      className="mt-0.5 text-lg text-red-400"
                    />
                    <span className="text-sm text-red-200">{error}</span>
                  </div>
                </motion.div>
              )}

              {/* Form */}
              <form
                onSubmit={handleSubmit}
                className="custom-scrollbar max-h-[calc(90vh-180px)] overflow-y-auto px-6 py-4"
              >
                <div className="space-y-5">
                  {/* Judul */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-300">
                      Judul Acara <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="judul_acara"
                      value={formData.judul_acara}
                      onChange={handleChange}
                      readOnly={isViewMode}
                      className={`w-full rounded-xl border px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none transition-all ${
                        isViewMode
                          ? "border-white/10 bg-white/5 cursor-default"
                          : "border-white/10 bg-white/5 focus:border-emerald-500/60 focus:bg-white/10"
                      }`}
                      placeholder={
                        isViewMode
                          ? ""
                          : "Contoh: Event Pemilu Unit Cluster Sakura"
                      }
                    />
                  </div>

                  {/* Tipe */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-300">
                      Tipe Acara <span className="text-red-400">*</span>
                    </label>
                    {isViewMode ? (
                      <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                        {(() => {
                          const opt = tipeAcaraOptions.find(
                            (o) => o.value === formData.tipe_acara
                          ) || tipeAcaraOptions[0];
                          return (
                            <>
                              <div
                                className={`flex h-8 w-8 items-center justify-center rounded-lg ${opt.color}`}
                              >
                                <Icon
                                  icon={opt.icon}
                                  className="text-lg text-white"
                                />
                              </div>
                              <span className="text-sm font-medium text-slate-200">
                                {opt.label}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {tipeAcaraOptions.map((opt) => {
                          const active = formData.tipe_acara === opt.value;
                          return (
                            <motion.button
                              key={opt.value}
                              type="button"
                              whileTap={{ scale: 0.98 }}
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  tipe_acara: opt.value,
                                }))
                              }
                              className={`
                                flex items-center gap-2 rounded-xl border p-3 text-left text-xs transition-all
                                ${
                                  active
                                    ? "border-emerald-500/60 bg-emerald-500/15 shadow-[0_0_24px_rgba(16,185,129,0.4)]"
                                    : "border-white/10 bg-white/5 hover:bg-white/10"
                                }
                              `}
                            >
                              <div
                                className={`flex h-8 w-8 items-center justify-center rounded-lg ${opt.color}`}
                              >
                                <Icon
                                  icon={opt.icon}
                                  className="text-lg text-white"
                                />
                              </div>
                              <span
                                className={`font-medium ${
                                  active ? "text-emerald-200" : "text-slate-200"
                                }`}
                              >
                                {opt.label}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Tanggal + Jam */}
                  <div className="relative">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-300">
                          Tanggal Mulai <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="date"
                          name="tanggal_mulai"
                          value={formData.tanggal_mulai}
                          onChange={handleChange}
                          readOnly={isViewMode}
                          disabled={isViewMode}
                          className={`w-full rounded-xl border bg-white/5 px-4 py-3 text-sm text-white focus:outline-none transition-all ${
                            isViewMode
                              ? "border-white/10 cursor-default"
                              : hasDateTimeError
                              ? "border-red-500/60 focus:border-red-500"
                              : "border-white/10 focus:border-emerald-500/60 focus:bg-white/10"
                          }`}
                        />
                        <label className="mt-3 mb-2 block text-xs font-semibold text-slate-400">
                          Jam Mulai
                        </label>
                        <input
                          type="time"
                          name="jam_mulai"
                          value={formData.jam_mulai}
                          onChange={handleChange}
                          readOnly={isViewMode}
                          disabled={isViewMode}
                          className={`w-full rounded-xl border bg-white/5 px-4 py-2.5 text-sm text-white focus:outline-none transition-all ${
                            isViewMode
                              ? "border-white/10 cursor-default"
                              : hasDateTimeError
                              ? "border-red-500/60 focus:border-red-500"
                              : "border-white/10 focus:border-emerald-500/60 focus:bg-white/10"
                          }`}
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
                          readOnly={isViewMode}
                          disabled={isViewMode}
                          className={`w-full rounded-xl border bg-white/5 px-4 py-3 text-sm text-white focus:outline-none transition-all ${
                            isViewMode
                              ? "border-white/10 cursor-default"
                              : hasDateTimeError
                              ? "border-red-500/60 focus:border-red-500"
                              : "border-white/10 focus:border-emerald-500/60 focus:bg-white/10"
                          }`}
                        />
                        <label className="mt-3 mb-2 block text-xs font-semibold text-slate-400">
                          Jam Selesai
                        </label>
                        <input
                          type="time"
                          name="jam_selesai"
                          value={formData.jam_selesai}
                          onChange={handleChange}
                          readOnly={isViewMode}
                          disabled={isViewMode}
                          className={`w-full rounded-xl border bg-white/5 px-4 py-2.5 text-sm text-white focus:outline-none transition-all ${
                            isViewMode
                              ? "border-white/10 cursor-default"
                              : hasDateTimeError
                              ? "border-red-500/60 focus:border-red-500"
                              : "border-white/10 focus:border-emerald-500/60 focus:bg-white/10"
                          }`}
                        />
                      </div>
                    </div>

                    {!isViewMode && (
                      <AnimatePresence>
                        {hasDateTimeError && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 overflow-hidden rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5"
                          >
                            <div className="flex items-center gap-2">
                              <Icon
                                icon="solar:danger-triangle-bold"
                                className="text-base text-red-400 animate-pulse"
                              />
                              <span className="text-xs font-medium text-red-200">
                                {dateTimeError}
                              </span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    )}
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
                      readOnly={isViewMode}
                      className={`w-full rounded-xl border px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none transition-all ${
                        isViewMode
                          ? "border-white/10 bg-white/5 cursor-default"
                          : "border-white/10 bg-white/5 focus:border-emerald-500/60 focus:bg-white/10"
                      }`}
                      placeholder={
                        isViewMode ? "" : "Contoh: Kantor Cabang Surabaya"
                      }
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
                      readOnly={isViewMode}
                      className={`w-full resize-none rounded-xl border px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none transition-all ${
                        isViewMode
                          ? "border-white/10 bg-white/5 cursor-default"
                          : "border-white/10 bg-white/5 focus:border-emerald-500/60 focus:bg-white/10"
                      }`}
                      placeholder={
                        isViewMode ? "" : "Detail atau catatan penting acara..."
                      }
                    />
                  </div>

                  {/* Durasi pilih (PEMILU) */}
                  {formData.tipe_acara === "PEMILU" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-transparent to-cyan-500/10 p-5"
                    >
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.25),_transparent_55%)]" />
                      <div className="relative flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <label className="mb-1 flex items-center gap-2 text-sm font-semibold text-emerald-300">
                            <Icon icon="solar:timer-linear" className="text-base" />
                            Durasi Pilih Unit (detik)
                          </label>
                          <p className="mb-4 text-xs leading-relaxed text-emerald-200/70">
                            Waktu yang diberikan ke setiap agent untuk memilih unit property saat giliran PEMILU berlangsung
                          </p>
                          <div className="flex flex-wrap items-center gap-3">
                            <input
                              type="number"
                              name="durasi_pilih"
                              value={formData.durasi_pilih}
                              onChange={handleChange}
                              onFocus={(e) => !isViewMode && e.target.select()}
                              min={30}
                              max={300}
                              readOnly={isViewMode}
                              className={`w-32 rounded-xl border px-4 py-2.5 text-sm font-semibold text-emerald-50 shadow-inner focus:outline-none transition-all ${
                                isViewMode
                                  ? "border-emerald-500/40 bg-black/40 cursor-default"
                                  : "border-emerald-500/60 bg-black/40 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30"
                              }`}
                            />
                            {!isViewMode && (
                              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-100 shadow-sm">
                                <div className="flex items-center gap-2">
                                  <Icon
                                    icon="solar:clock-circle-linear"
                                    className="text-base text-emerald-300"
                                  />
                                  <span>
                                    Rekomendasi:{" "}
                                    <span className="font-semibold">60–120 detik</span>
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="hidden h-full items-center sm:flex">
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/50 bg-black/40 shadow-[0_0_40px_rgba(16,185,129,0.4)]">
                            <Icon
                              icon="solar:hourglass-bold-duotone"
                              className="text-3xl text-emerald-300"
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </form>

              {/* Footer */}
              {!isViewMode && (
                <div className="border-t border-white/10 bg-white/5 px-6 py-4">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={loading}
                      className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-300 transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Batal
                    </button>
                    <motion.button
                      type="submit"
                      onClick={handleSubmit}
                      disabled={loading || hasDateTimeError}
                      whileTap={{ scale: 0.98 }}
                      className={`group relative overflow-hidden rounded-xl bg-gradient-to-r px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 ${
                        isEditMode
                          ? "from-blue-500 to-blue-600 shadow-blue-500/50 hover:shadow-blue-500/60"
                          : "from-emerald-500 to-emerald-600 shadow-emerald-500/50 hover:shadow-emerald-500/60"
                      }`}
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <Icon
                            icon="solar:settings-linear"
                            className="animate-spin text-lg"
                          />
                          {isEditMode ? "Memperbarui..." : "Menyimpan..."}
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Icon icon="solar:check-circle-bold" className="text-lg" />
                          {isEditMode ? "Perbarui Acara" : "Simpan Acara"}
                        </span>
                      )}
                    </motion.button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}

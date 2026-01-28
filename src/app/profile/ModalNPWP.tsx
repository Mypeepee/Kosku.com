"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import Cropper, { Area } from "react-easy-crop";

type Props = {
  open: boolean;
  onClose: () => void;
  // kirim base64 hasil crop ke parent
  onSave: (croppedBase64: string) => void;
  // jika sudah ada NPWP tersimpan, kirim URL/thumbnail untuk diedit ulang
  initialImageUrl?: string | null;
};

const ModalNPWP: React.FC<Props> = ({
  open,
  onClose,
  onSave,
  initialImageUrl,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setImageSrc(initialImageUrl || null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setLoading(false);
    }
  }, [open, initialImageUrl]);

  const onCropComplete = useCallback(
    (_croppedArea: Area, croppedPixels: Area) => {
      setCroppedAreaPixels(croppedPixels);
    },
    []
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      setImageSrc(reader.result as string); // base64 data URL
      setZoom(1);
      setCrop({ x: 0, y: 0 });
    });
    reader.readAsDataURL(file);
  };

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", (error) => reject(error));
      image.setAttribute("crossOrigin", "anonymous");
      image.src = url;
    });

  const getCroppedBase64 = async (
    imageSrc: string,
    crop: Area
  ): Promise<string> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    const pixelRatio = window.devicePixelRatio || 1;

    canvas.width = crop.width * pixelRatio;
    canvas.height = crop.height * pixelRatio;

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = "high";

    ctx.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height
    );

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    return dataUrl;
  };

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setLoading(true);
    try {
      const base64 = await getCroppedBase64(imageSrc, croppedAreaPixels);
      onSave(base64);
      setLoading(false);
      onClose();
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const closeWithReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setLoading(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* backdrop click */}
          <button
            type="button"
            className="absolute inset-0 w-full h-full cursor-default"
            onClick={closeWithReset}
          />

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="relative z-[1000] w-full max-w-3xl rounded-2xl bg-[#020617] border border-white/15 shadow-[0_32px_120px_rgba(15,23,42,0.9)] max-h-[calc(100vh-3rem)] flex flex-col"
          >
            {/* Header */}
            <div className="px-5 pt-4 pb-3 border-b border-white/10 bg-gradient-to-r from-amber-400/15 via-emerald-400/10 to-transparent">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-400/20 flex items-center justify-center text-amber-200 border border-amber-300/60">
                    <Icon icon="solar:card-bold-duotone" className="text-lg" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-white">
                      Atur Foto NPWP
                    </h3>
                    <p className="text-[11px] text-gray-400">
                      Potong dan sesuaikan foto NPWP agar data terlihat jelas
                      saat proses verifikasi.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeWithReset}
                  className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
                >
                  <Icon
                    icon="solar:close-circle-bold"
                    className="text-lg"
                  />
                </button>
              </div>

              <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-400">
                <Icon
                  icon="solar:shield-check-bold"
                  className="text-emerald-300 text-sm"
                />
                <span>
                  Kami hanya menggunakan foto ini untuk keperluan verifikasi,
                  tidak dibagikan ke pihak lain.
                </span>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 pb-8 grid grid-cols-1 md:grid-cols-[2fr_minmax(0,1fr)] gap-4">
              {/* Crop area */}
              <div className="flex flex-col gap-3">
                <div className="relative rounded-xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black overflow-hidden min-h-[260px] md:min-h-[320px] flex items-center justify-center">
                  {imageSrc ? (
                    <div className="relative w-full h-full">
                      <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={16 / 9}
                        showGrid={false}
                        cropShape="rect"
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropComplete}
                      />
                      <div className="pointer-events-none absolute inset-6 rounded-xl border border-white/60 shadow-[0_0_0_1px_rgba(15,23,42,0.8)]" />
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(250,250,250,0.08),_transparent_55%)]" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 text-[11px] text-gray-400 px-4 text-center">
                      <Icon
                        icon="solar:upload-square-bold-duotone"
                        className="text-3xl text-gray-500"
                      />
                      <p>Belum ada foto NPWP yang dipilih.</p>
                      <p className="text-[10px] text-gray-500">
                        Unggah foto NPWP, lalu sesuaikan posisi dan ukuran
                        sebelum menyimpan.
                      </p>
                      <label className="inline-flex items-center gap-1.5 mt-1 rounded-full bg-amber-400 text-[11px] text-black px-3 py-1.5 cursor-pointer hover:bg-amber-300 transition-colors">
                        <Icon
                          icon="solar:upload-minimalistic-bold"
                          className="text-[12px]"
                        />
                        Pilih foto NPWP
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </label>
                    </div>
                  )}
                </div>

                {/* controls */}
                {imageSrc && (
                  <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[11px] text-gray-300">
                      <Icon
                        icon="solar:slider-vertical-bold-duotone"
                        className="text-amber-300 text-base"
                      />
                      <span className="text-[10px] text-gray-400">
                        Geser gambar untuk mengatur posisi. Gunakan slider
                        untuk zoom in / zoom out.
                      </span>
                    </div>
                    <div className="flex items-center gap-2 md:w-1/2">
                      <Icon
                        icon="solar:zoom-minimalistic-out-bold"
                        className="text-gray-400 text-sm"
                      />
                      <input
                        type="range"
                        min={1}
                        max={3}
                        step={0.05}
                        value={zoom}
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        className="w-full accent-amber-400"
                      />
                      <Icon
                        icon="solar:zoom-minimalistic-in-bold"
                        className="text-gray-400 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Side panel */}
              <div className="flex flex-col gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] text-gray-300 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Icon
                      icon="solar:info-circle-bold"
                      className="text-amber-300 text-sm"
                    />
                    <p className="font-semibold text-gray-100">
                      Tips foto NPWP yang baik
                    </p>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[10px] text-gray-400">
                    <li>Teks nomor NPWP dan nama harus mudah dibaca.</li>
                    <li>Hindari bayangan gelap atau pantulan cahaya berlebih.</li>
                    <li>Gunakan foto landscape agar kartu tidak terpotong.</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-[11px] text-gray-300 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-300">
                      Status pengaturan
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-400/40 text-[10px] text-emerald-300">
                      <Icon
                        icon={
                          imageSrc
                            ? "solar:check-circle-bold"
                            : "solar:danger-triangle-bold"
                        }
                        className="text-[11px]"
                      />
                      {imageSrc ? "Siap disimpan" : "Belum ada foto"}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500">
                    Kamu bisa mengganti foto kapan saja. Versi yang tersimpan
                    akan digunakan pada halaman verifikasi NPWP.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/15 text-[11px] text-gray-100 px-3 py-1.5 cursor-pointer hover:bg-white/10 transition-colors">
                    <Icon
                      icon="solar:refresh-bold"
                      className="text-[12px]"
                    />
                    Ganti foto
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                  {imageSrc && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className="inline-flex items-center gap-1.5 rounded-full bg-transparent border border-white/15 text-[11px] text-gray-300 px-3 py-1.5 hover:bg-white/5 transition-colors"
                    >
                      <Icon
                        icon="solar:arrow-to-down-left-bold"
                        className="text-[12px]"
                      />
                      Reset posisi
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 pb-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-[10px] text-gray-500" />
              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={closeWithReset}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-full text-[11px] text-gray-300 bg-white/5 border border-white/15 hover:bg-white/10 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!imageSrc || loading}
                  className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                    imageSrc
                      ? "bg-amber-400 text-black hover:bg-amber-300"
                      : "bg-amber-400/30 text-amber-100 cursor-not-allowed"
                  }`}
                >
                  <Icon
                    icon="solar:download-square-bold-duotone"
                    className="text-[13px]"
                  />
                  {loading ? "Memproses..." : "Simpan & gunakan foto"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ModalNPWP;

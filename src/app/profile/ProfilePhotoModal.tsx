// src/app/(dashboard)/profile/ProfilePhotoModal.tsx
"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";

type ProfilePhotoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  currentPhotoUrl?: string | null; // full URL avatar sekarang (opsional, buat preview awal)
};

const ProfilePhotoModal: React.FC<ProfilePhotoModalProps> = ({
  isOpen,
  onClose,
  currentPhotoUrl,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    if (!f.type.startsWith("image/")) {
      toast.error("File harus berupa gambar (jpg, png, dll).");
      return;
    }

    if (f.size > 2 * 1024 * 1024) {
      toast.error("Ukuran gambar maksimal 2MB.");
      return;
    }

    setFile(f);

    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(f);
  };

  const handleSubmit = async () => {
    if (!file) {
      toast.error("Pilih gambar terlebih dahulu.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Endpoint untuk update foto agent
      const res = await fetch("/api/profile/photo", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Gagal mengunggah foto");
      }

      toast.success("Foto profil berhasil diperbarui.");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Terjadi kesalahan saat mengunggah foto.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayImage = preview || currentPhotoUrl || "/images/default-avatar.png";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-[#181818] border border-white/10 shadow-2xl p-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            Ubah Foto Profil Agent
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <Icon icon="solar:close-circle-bold" className="text-xl" />
          </button>
        </div>

        {/* Preview */}
        <div className="flex flex-col items-center gap-4 mb-6">
          <div className="w-28 h-28 rounded-full border border-white/10 overflow-hidden bg-black flex items-center justify-center">
            {displayImage ? (
              <Image
                src={displayImage}
                alt="Preview"
                width={112}
                height={112}
                className="w-full h-full object-cover"
              />
            ) : (
              <Icon
                icon="solar:user-bold"
                className="text-4xl text-gray-500"
              />
            )}
          </div>

          <button
            type="button"
            onClick={handlePickFile}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-xs text-gray-100 border border-white/15 transition-colors"
          >
            <Icon icon="solar:upload-bold" className="text-sm" />
            <span>Pilih gambar</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <p className="text-[11px] text-gray-500 text-center">
            Format: JPG, PNG. Maksimal 2MB. Disarankan foto wajah jelas dengan
            background rapi.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-full text-xs text-gray-300 hover:bg-white/5 border border-white/10 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-full text-xs font-semibold bg-emerald-500 text-black hover:bg-emerald-400 transition-colors disabled:opacity-60"
          >
            {isSubmitting ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePhotoModal;

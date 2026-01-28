"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";

// Helper: build Google Drive thumbnail URL (id atau full URL)
const buildDriveImageUrl = (idOrUrl?: string | null) => {
  if (!idOrUrl) return null;

  let raw = idOrUrl.trim();

  // Pure ID
  if (!raw.includes("http")) {
    return `https://drive.google.com/thumbnail?id=${raw}&sz=w1000`;
  }

  try {
    const url = new URL(raw);
    const fromQuery = url.searchParams.get("id");
    if (fromQuery) {
      return `https://drive.google.com/thumbnail?id=${fromQuery}&sz=w1000`;
    }
    const match = url.pathname.match(/\/d\/([^/]+)/);
    if (match?.[1]) {
      return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
    }
  } catch {
    // ignore
  }

  return null;
};

export type AgentData = {
  foto_ktp_url?: string | null;
  foto_npwp_url?: string | null;
  nama_bank?: string | null;
  nomor_rekening?: string | null;
  atas_nama_rekening?: string | null;
};

type Props = {
  agent: AgentData;
  onUploadKtp: () => void;
  onUploadNpwp: () => void;
  onEditRekening: () => void;
};

const DataPenting = ({ agent, onUploadKtp, onUploadNpwp, onEditRekening }: Props) => {
  const ktpUrl = buildDriveImageUrl(agent.foto_ktp_url);
  const npwpUrl = buildDriveImageUrl(agent.foto_npwp_url);

  const hasKtp = !!ktpUrl;
  const hasNpwp = !!npwpUrl;

  const hasBank =
    agent.nama_bank && agent.nomor_rekening && agent.atas_nama_rekening;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#050607] rounded-2xl border border-white/5 p-5 sm:p-7 relative overflow-hidden"
    >
      {/* Futuristic glows */}
      <div className="pointer-events-none absolute -top-32 right-[-4rem] w-72 h-72 bg-[#86efac]/10 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-[-4rem] w-80 h-80 bg-sky-500/8 rounded-full blur-3xl" />

      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#86efac]/10 flex items-center justify-center text-[#86efac] border border-[#86efac]/40 shadow-[0_0_25px_rgba(134,239,172,0.25)]">
              <Icon icon="solar:shield-check-bold" className="text-xl" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                Data Verifikasi & Rekening
              </h2>
              <p className="text-xs sm:text-sm text-gray-400">
                Pastikan dokumen dan rekeningmu lengkap agar komisi dapat
                diproses tanpa hambatan.
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 border border-white/10 text-[11px] text-gray-300">
            <Icon icon="solar:shield-keyhole-bold" className="text-sm" />
          </div>
        </div>

        {/* Dokumen: KTP & NPWP */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* KTP */}
          <div className="rounded-xl bg-[#0B0C0F] border border-white/10 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Icon
                  icon="solar:id-card-bold-duotone"
                  className="text-sky-400"
                />
                <p className="text-xs font-semibold text-gray-300">
                  Foto KTP
                </p>
              </div>

              {hasKtp ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-[#86efac]/40 bg-[#86efac]/10 text-[10px] text-[#86efac]">
                  <Icon
                    icon="solar:check-circle-bold"
                    className="text-[11px]"
                  />
                  Tersimpan
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-rose-400/50 bg-rose-500/10 text-[10px] text-rose-200">
                  <Icon
                    icon="solar:danger-triangle-bold"
                    className="text-[11px]"
                  />
                  Belum diunggah
                </span>
              )}
            </div>

            {/* ukuran kartu */}
            <div className="relative w-full aspect-[16/9] rounded-xl border border-dashed border-white/10 overflow-hidden bg-gradient-to-br from-black/60 via-[#0F172A]/60 to-black/60 flex items-center justify-center">
              {ktpUrl ? (
                <img
                  src={ktpUrl}
                  alt="Foto KTP"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 text-[11px] text-gray-400 px-4 text-center">
                  <Icon
                    icon="solar:id-card-bold-duotone"
                    className="text-2xl text-gray-600"
                  />
                  <p>Belum ada foto KTP.</p>
                  <button
                    type="button"
                    onClick={onUploadKtp}
                    className="inline-flex items-center gap-1.5 mt-1 rounded-full bg-sky-500 text-[11px] text-white px-3 py-1.5 hover:bg-sky-400 transition-colors"
                  >
                    <Icon
                      icon="solar:upload-minimalistic-bold"
                      className="text-[12px]"
                    />
                    Unggah KTP
                  </button>
                  <span className="text-[10px] text-gray-500">
                    Pastikan foto KTP terlihat jelas dan tidak blur.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* NPWP */}
          <div className="rounded-xl bg-[#0B0C0F] border border-white/10 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Icon
                  icon="solar:card-bold-duotone"
                  className="text-amber-300"
                />
                <p className="text-xs font-semibold text-gray-300">
                  Foto NPWP
                </p>
              </div>

              {hasNpwp ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-[#86efac]/40 bg-[#86efac]/10 text-[10px] text-[#86efac]">
                  <Icon
                    icon="solar:check-circle-bold"
                    className="text-[11px]"
                  />
                  Tersimpan
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-amber-400/60 bg-amber-500/10 text-[10px] text-amber-100">
                  <Icon
                    icon="solar:danger-triangle-bold"
                    className="text-[11px]"
                  />
                  Belum diunggah
                </span>
              )}
            </div>

            <div className="relative w-full aspect-[16/9] rounded-xl border border-dashed border-white/10 overflow-hidden bg-gradient-to-br from-black/60 via-[#111827]/60 to-black/60 flex items-center justify-center">
              {npwpUrl ? (
                <img
                  src={npwpUrl}
                  alt="Foto NPWP"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 text-[11px] text-gray-400 px-4 text-center">
                  <Icon
                    icon="solar:card-bold-duotone"
                    className="text-2xl text-gray-600"
                  />
                  <p>Belum ada foto NPWP.</p>
                  <button
                    type="button"
                    onClick={onUploadNpwp}
                    className="inline-flex items-center gap-1.5 mt-1 rounded-full bg-amber-400 text-[11px] text-black px-3 py-1.5 hover:bg-amber-300 transition-colors"
                  >
                    <Icon
                      icon="solar:upload-minimalistic-bold"
                      className="text-[12px]"
                    />
                    Unggah NPWP
                  </button>
                  <span className="text-[10px] text-gray-500">
                    Dokumen NPWP membantu kelancaran pembayaran dan pajak.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rekening Bank */}
        <div className="rounded-2xl bg-[#050609] border border-white/10 p-4 sm:p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-300 border border-emerald-400/30">
                <Icon
                  icon="solar:card-recive-bold-duotone"
                  className="text-lg"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-300">
                  Rekening Penerimaan Komisi
                </p>
              </div>
            </div>

            {hasBank && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/40 text-[10px] text-emerald-300">
                <Icon
                  icon="solar:verified-check-bold"
                  className="text-[12px]"
                />
                Rekening siap digunakan
              </span>
            )}
          </div>

          {hasBank ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[11px] text-gray-300 mt-2">
              <div className="flex flex-col gap-1">
                <span className="text-gray-500">Bank</span>
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <Icon
                    icon="solar:bank-bold-duotone"
                    className="text-emerald-300 text-sm"
                  />
                  {agent.nama_bank?.toUpperCase()}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-gray-500">Nomor Rekening</span>
                <span className="font-mono tracking-tight">
                  {agent.nomor_rekening}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-gray-500">Atas Nama</span>
                <span className="font-semibold">
                  {agent.atas_nama_rekening}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 mt-2">
              <p className="text-[11px] text-gray-400">
                Kamu belum menambahkan informasi rekening.
              </p>
              <button
                type="button"
                onClick={onEditRekening}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 text-[11px] text-black px-3 py-1.5 hover:bg-emerald-400 transition-colors"
              >
                <Icon
                  icon="solar:add-circle-bold"
                  className="text-[12px]"
                />
                Tambah rekening
              </button>
            </div>
          )}

          {hasBank && (
            <button
              type="button"
              onClick={onEditRekening}
              className="self-start mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/15 text-[11px] text-gray-100 px-3 py-1.5 hover:bg-white/10 transition-colors"
            >
              <Icon icon="solar:pen-bold" className="text-[12px]" />
              Ubah rekening
            </button>
          )}

          <p className="text-[10px] text-gray-500 mt-2">
            Data rekening disimpan secara terenkripsi dan hanya
            digunakan untuk keperluan pencairan komisi yang sah.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default DataPenting;

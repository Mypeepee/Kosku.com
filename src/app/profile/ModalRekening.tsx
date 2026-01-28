"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";

type Bank = {
  code: string;
  name: string;
};

const bankList: Bank[] = [
  { code: "014", name: "BANK BCA" },
  { code: "009", name: "BANK BNI" },
  { code: "008", name: "BANK MANDIRI" },
  { code: "002", name: "BANK BRI" },
  { code: "013", name: "BANK PERMATA" },
  { code: "011", name: "BANK DANAMON" },
  { code: "022", name: "BANK CIMB NIAGA" },
  { code: "200", name: "BANK TABUNGAN NEGARA (BTN)" },
  // nanti bisa kamu ganti fetch JSON bank Indonesia dari API/file sendiri [web:21][web:23]
];

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    nama_bank: string;
    nomor_rekening: string;
    atas_nama_rekening: string;
  }) => Promise<void> | void; // boleh async
  defaultValue?: {
    nama_bank?: string | null;
    nomor_rekening?: string | null;
    atas_nama_rekening?: string | null;
  };
};

const ModalRekening: React.FC<Props> = ({
  open,
  onClose,
  onSave,
  defaultValue,
}) => {
  const [bankQuery, setBankQuery] = useState("");
  const [selectedBank, setSelectedBank] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const [nomorRekening, setNomorRekening] = useState("");
  const [konfirmasiRekening, setKonfirmasiRekening] = useState("");
  const [atasNama, setAtasNama] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  // reset & isi dari default ketika modal dibuka
  useEffect(() => {
    if (open) {
      const namaBank = defaultValue?.nama_bank || "";
      const norek = defaultValue?.nomor_rekening || "";
      const atas = defaultValue?.atas_nama_rekening || "";

      setSelectedBank(namaBank);
      setBankQuery(namaBank);
      setShowDropdown(false);
      setNomorRekening(norek);
      setKonfirmasiRekening(norek);
      setAtasNama(atas);
      setSubmitting(false);
      setTouched(false);
    }
  }, [open, defaultValue]);

  const filteredBanks = useMemo(() => {
    if (!bankQuery.trim()) return bankList;
    return bankList.filter((b) =>
      `${b.name} ${b.code}`
        .toLowerCase()
        .includes(bankQuery.trim().toLowerCase())
    );
  }, [bankQuery]);

  const rekeningMatch =
    nomorRekening.length > 0 &&
    konfirmasiRekening.length > 0 &&
    nomorRekening === konfirmasiRekening;

  const isValid =
    selectedBank.trim().length > 0 &&
    rekeningMatch &&
    atasNama.trim().length > 2 &&
    nomorRekening.length >= 6;

  const handleSubmit = async () => {
    setTouched(true);
    if (!isValid || submitting) return;

    setSubmitting(true);
    try {
      await onSave({
        nama_bank: selectedBank.trim(),
        nomor_rekening: nomorRekening,
        atas_nama_rekening: atasNama.trim(),
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const resetOnClose = () => {
    setTouched(false);
    setSubmitting(false);
    onClose();
  };

  const handleBankInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (filteredBanks.length > 0) {
          setSelectedBank(filteredBanks[0].name);
          setBankQuery(filteredBanks[0].name);
        } else if (bankQuery.trim()) {
          setSelectedBank(bankQuery.trim().toUpperCase());
        }
        setShowDropdown(false);
      }
    },
    [filteredBanks, bankQuery]
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* overlay for close */}
          <button
            type="button"
            className="absolute inset-0 w-full h-full cursor-default"
            onClick={resetOnClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="relative z-[1000] w-full max-w-lg rounded-2xl bg-[#05070b] border border-white/15 shadow-[0_32px_120px_rgba(15,23,42,0.8)] overflow-hidden"
          >
            {/* Top bar */}
            <div className="relative px-5 pt-4 pb-3 border-b border-white/10 bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-transparent">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-300 border border-emerald-400/40">
                    <Icon
                      icon="solar:card-recive-bold-duotone"
                      className="text-lg"
                    />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-white">
                      Tambah Rekening Penerimaan
                    </h3>
                    <p className="text-[11px] text-gray-400">
                      Gunakan rekening atas namamu sendiri agar proses pencairan
                      komisi berjalan mulus.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={resetOnClose}
                  className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
                >
                  <Icon icon="solar:close-circle-bold" className="text-lg" />
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2 text-[10px] text-gray-400">
                <Icon
                  icon="solar:shield-check-bold"
                  className="text-emerald-300 text-sm"
                />
                <span>
                  Data rekening disimpan terenkripsi dan hanya dipakai untuk
                  pencairan komisi.
                </span>
              </div>
            </div>

            {/* FORM */}
            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Nama Bank */}
              <div className="space-y-1.5">
                <label className="flex items-center justify-between text-[11px] text-gray-300">
                  <span>Nama bank di Indonesia</span>
                  <span className="text-[10px] text-gray-500">
                    Pilih dari daftar resmi
                  </span>
                </label>
                <div className="relative">
                  <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 focus-within:border-emerald-400/60 focus-within:bg-black/40 transition-colors">
                    <Icon
                      icon="solar:bank-bold-duotone"
                      className="text-emerald-300 text-lg"
                    />
                    <input
                      type="text"
                      value={bankQuery}
                      onChange={(e) => {
                        setBankQuery(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      onKeyDown={handleBankInputKeyDown}
                      placeholder="Cari bank (mis. BCA, BNI, Mandiri)"
                      className="w-full bg-transparent text-xs text-gray-100 placeholder:text-gray-500 outline-none"
                    />
                  </div>

                  {/* dropdown */}
                  {showDropdown && (
                    <div className="absolute mt-1 left-0 right-0 z-10 max-h-40 overflow-y-auto rounded-xl bg-[#020617] border border-white/10 shadow-xl">
                      {filteredBanks.length === 0 ? (
                        <div className="px-3 py-2 text-[11px] text-gray-500">
                          Bank tidak ditemukan. Tekan Enter untuk memakai nama
                          yang kamu ketik.
                        </div>
                      ) : (
                        filteredBanks.map((bank) => (
                          <button
                            key={bank.code}
                            type="button"
                            onClick={() => {
                              setSelectedBank(bank.name);
                              setBankQuery(bank.name);
                              setShowDropdown(false);
                            }}
                            className={`flex w-full items-center justify-between px-3 py-2 text-[11px] text-gray-200 hover:bg-white/5 ${
                              selectedBank === bank.name
                                ? "bg-emerald-500/10 text-emerald-200"
                                : ""
                            }`}
                          >
                            <span>{bank.name}</span>
                            <span className="text-[10px] text-gray-500">
                              {bank.code}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {touched && !selectedBank.trim() && (
                  <p className="text-[10px] text-rose-400 mt-0.5">
                    Pilih bank atau tekan Enter setelah mengetik nama bank.
                  </p>
                )}
              </div>

              {/* Nomor Rekening */}
              <div className="space-y-1.5">
                <label className="flex items-center justify-between text-[11px] text-gray-300">
                  <span>Nomor rekening</span>
                  <span className="text-[10px] text-gray-500">
                    Mohon pastikan benar karena akan digunakan untuk transfer
                    komisi.
                  </span>
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 focus-within:border-sky-400/60 focus-within:bg-black/40 transition-colors">
                  <Icon
                    icon="solar:card-transfer-bold-duotone"
                    className="text-sky-400 text-lg"
                  />
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={nomorRekening}
                    onChange={(e) =>
                      setNomorRekening(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="Masukkan nomor rekening"
                    className="w-full bg-transparent text-xs text-gray-100 placeholder:text-gray-500 outline-none font-mono tracking-tight"
                    onBlur={() => setTouched(true)}
                  />
                </div>
                {touched && nomorRekening.length < 6 && (
                  <p className="text-[10px] text-rose-400 mt-0.5">
                    Nomor rekening minimal 6 digit.
                  </p>
                )}
              </div>

              {/* Konfirmasi Rekening */}
              <div className="space-y-1.5">
                <label className="flex items-center justify-between text-[11px] text-gray-300">
                  <span>Konfirmasi nomor rekening</span>
                  <span className="text-[10px] text-gray-500">
                    Ketik ulang untuk memastikan tidak ada salah angka.
                  </span>
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 focus-within:border-sky-400/60 focus-within:bg-black/40 transition-colors">
                  <Icon
                    icon={
                      rekeningMatch
                        ? "solar:check-circle-bold"
                        : "solar:shield-warning-bold"
                    }
                    className={`text-lg ${
                      rekeningMatch ? "text-emerald-400" : "text-amber-300"
                    }`}
                  />
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={konfirmasiRekening}
                    onChange={(e) =>
                      setKonfirmasiRekening(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="Masukkan ulang nomor rekening"
                    className="w-full bg-transparent text-xs text-gray-100 placeholder:text-gray-500 outline-none font-mono tracking-tight"
                    onBlur={() => setTouched(true)}
                  />
                </div>
                {touched && !rekeningMatch && konfirmasiRekening.length > 0 && (
                  <p className="text-[10px] text-rose-400 mt-0.5">
                    Nomor rekening dan konfirmasi tidak sama. Periksa lagi
                    angkanya.
                  </p>
                )}
              </div>

              {/* Atas Nama */}
              <div className="space-y-1.5">
                <label className="flex items-center justify-between text-[11px] text-gray-300">
                  <span>Atas nama rekening</span>
                  <span className="text-[10px] text-gray-500">
                    Gunakan nama sesuai di buku/tabungan.
                  </span>
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 focus-within:border-emerald-400/60 focus-within:bg-black/40 transition-colors">
                  <Icon
                    icon="solar:user-hand-up-bold-duotone"
                    className="text-emerald-300 text-lg"
                  />
                  <input
                    type="text"
                    value={atasNama}
                    onChange={(e) => setAtasNama(e.target.value)}
                    placeholder="Contoh: LIE MING"
                    className="w-full bg-transparent text-xs text-gray-100 placeholder:text-gray-500 outline-none uppercase"
                    onBlur={() => setTouched(true)}
                  />
                </div>
                {touched && atasNama.trim().length <= 2 && (
                  <p className="text-[10px] text-rose-400 mt-0.5">
                    Nama pemilik rekening wajib diisi.
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 pb-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-[10px] text-gray-500">

              </div>

              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={resetOnClose}
                  className="px-3 py-1.5 rounded-full text-[11px] text-gray-300 bg-white/5 border border-white/15 hover:bg-white/10 transition-colors"
                  disabled={submitting}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!isValid || submitting}
                  className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                    isValid
                      ? "bg-emerald-500 text-black hover:bg-emerald-400"
                      : "bg-emerald-500/30 text-emerald-100 cursor-not-allowed"
                  }`}
                >
                  <Icon
                    icon="solar:check-square-bold-duotone"
                    className="text-[13px]"
                  />
                  {submitting ? "Menyimpan..." : "Simpan rekening"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ModalRekening;

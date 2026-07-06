"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import {
  PillLabel,
  SectionTitle,
} from "../../about/company-profile/components/_shared";

/* =========================================================
   Types
   ========================================================= */

type PropertyType =
  | "RUMAH"
  | "APARTEMEN"
  | "RUKO"
  | "TANAH"
  | "GUDANG"
  | "PABRIK"
  | "HOTEL_DAN_VILLA"
  | "TOKO";

type OwnershipStatus = "PRIBADI" | "ORANG_LAIN";

type FormState = {
  // Properti
  propertyType: PropertyType | "";
  address: string;
  provinsi: string;
  kota: string;
  kecamatan: string;
  kelurahan: string;
  latitude: number | null;
  longitude: number | null;
  estimatedPrice: string;
  // Pemilik
  ownerName: string;
  ownerPhone: string;
  ownershipStatus: OwnershipStatus | "";
  agreement: boolean;
};

const initial: FormState = {
  propertyType: "",
  address: "",
  provinsi: "",
  kota: "",
  kecamatan: "",
  kelurahan: "",
  latitude: null,
  longitude: null,
  estimatedPrice: "",
  ownerName: "",
  ownerPhone: "",
  ownershipStatus: "",
  agreement: false,
};

/* =========================================================
   Constants
   ========================================================= */

const PROPERTY_TYPES: { v: PropertyType; l: string; i: string }[] = [
  { v: "RUMAH", l: "Rumah", i: "solar:home-2-bold-duotone" },
  { v: "APARTEMEN", l: "Apartemen", i: "solar:buildings-2-bold-duotone" },
  { v: "RUKO", l: "Ruko", i: "solar:shop-2-bold-duotone" },
  { v: "TANAH", l: "Tanah", i: "solar:map-point-wave-bold-duotone" },
  { v: "GUDANG", l: "Gudang", i: "solar:box-minimalistic-bold-duotone" },
  { v: "PABRIK", l: "Pabrik", i: "solar:garage-bold-duotone" },
  { v: "HOTEL_DAN_VILLA", l: "Hotel & Villa", i: "solar:bed-bold-duotone" },
  { v: "TOKO", l: "Toko", i: "solar:shop-bold-duotone" },
];

const ADMIN_LEVELS = [
  { key: "provinsi" as const, label: "Provinsi", icon: "solar:globus-bold-duotone" },
  { key: "kota" as const, label: "Kota / Kab.", icon: "solar:buildings-2-bold-duotone" },
  { key: "kecamatan" as const, label: "Kecamatan", icon: "solar:buildings-bold-duotone" },
  { key: "kelurahan" as const, label: "Kelurahan", icon: "solar:map-point-wave-bold-duotone" },
] as const;

/* =========================================================
   Helpers
   ========================================================= */

function formatRupiahInput(raw: string) {
  const digits = (raw || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  return new Intl.NumberFormat("id-ID").format(Number(digits));
}
function formatPhoneInput(raw: string) {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("62")) d = d.slice(2);
  d = d.replace(/^0+/, "");
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 12)}`;
}

/* =========================================================
   Main component
   ========================================================= */

const ConsignmentForm: React.FC = () => {
  const [data, setData] = useState<FormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setData((p) => ({ ...p, [k]: v }));

  const canSubmit = useMemo(() => {
    return (
      !!data.propertyType &&
      data.address.trim().length > 5 &&
      !!data.provinsi &&
      !!data.kota &&
      data.latitude !== null &&
      data.longitude !== null &&
      data.ownerName.trim().length > 1 &&
      data.ownerPhone.replace(/\D/g, "").length >= 9 &&
      !!data.ownershipStatus &&
      data.agreement
    );
    // Estimasi harga OPSIONAL — tidak diharuskan
  }, [data]);

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/titip-jual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jenis_properti: data.propertyType,
          alamat_lengkap: data.address,
          provinsi: data.provinsi,
          kota: data.kota,
          kecamatan: data.kecamatan || null,
          kelurahan: data.kelurahan || null,
          latitude: data.latitude,
          longitude: data.longitude,
          estimasi_harga: data.estimatedPrice || null,
          pengirim_nama: data.ownerName,
          pengirim_phone: data.ownerPhone,
          status_kepemilikan: data.ownershipStatus,
          referrer: typeof document !== "undefined" ? document.referrer : "",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      setDone(true);
      requestAnimationFrame(() => {
        if (!cardRef.current) return;
        const top =
          cardRef.current.getBoundingClientRect().top + window.scrollY - 96;
        window.scrollTo({ top, behavior: "smooth" });
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Gagal mengirim. Coba lagi.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      id="form-titip-jual"
      className="relative w-full bg-[#05070D] py-10 sm:py-12 lg:py-14"
    >
      {/* Ambient orbs — dikungkung di wrapper sendiri agar tidak memutus sticky di section level */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 -left-32 h-[24rem] w-[24rem] rounded-full bg-emerald-500/[0.07] blur-[120px]" />
        <div className="absolute bottom-0 -right-32 h-[24rem] w-[24rem] rounded-full bg-teal-500/[0.06] blur-[120px]" />
      </div>

      <div className="container relative mx-auto px-4 sm:px-6 max-w-screen-xl">
        <div className="text-center">
          <PillLabel>Mulai Sekarang · Gratis</PillLabel>
          <SectionTitle
            title={
              <>
                Cukup{" "}
                <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  90 Detik.
                </span>
              </>
            }
            subtitle="Beri kami hanya enam informasi inti — agent kami akan menghubungi dalam 24 jam untuk diskusi detail dan jadwal survey gratis."
          />
        </div>

        <div className="mt-7 sm:mt-9 grid lg:grid-cols-12 gap-3.5 lg:gap-4">
          {/* SIDEBAR */}
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-24 space-y-3.5">
              {/* Why only 6 fields */}
              <div className="rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-400/[0.06] to-transparent p-5 sm:p-6">
                <Icon
                  icon="solar:bolt-bold-duotone"
                  className="text-emerald-300 text-2xl"
                />
                <h4 className="mt-3 text-white font-bold text-sm">
                  Kenapa cuma 6 isian?
                </h4>
                <p className="mt-1.5 text-white/60 text-[12.5px] leading-relaxed">
                  Detail seperti luas, sertifikat, foto, dan dokumen
                  dikumpulkan langsung oleh agent kami saat{" "}
                  <span className="text-emerald-300 font-semibold">
                    survey gratis di lokasi
                  </span>{" "}
                  — Anda tidak perlu repot.
                </p>
              </div>

              {/* Data aman */}
              <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-md p-5 sm:p-6">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center">
                    <Icon
                      icon="solar:shield-user-bold-duotone"
                      className="text-emerald-300 text-xl"
                    />
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm">
                      Data Anda Aman
                    </div>
                    <div className="text-white/45 text-[10.5px] uppercase tracking-[0.18em] font-bold">
                      Privasi terjamin
                    </div>
                  </div>
                </div>
                <ul className="mt-4 space-y-2">
                  {[
                    "Tidak dipublikasikan tanpa izin",
                    "Hanya konsultan ditugaskan yang akses",
                    "Bisa dihapus permanen kapan saja",
                  ].map((t) => (
                    <li
                      key={t}
                      className="flex items-start gap-2 text-[12px] text-white/65 leading-snug"
                    >
                      <Icon
                        icon="solar:check-circle-bold"
                        className="text-emerald-300 text-base shrink-0 mt-0.5"
                      />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>

              {/* WhatsApp shortcut */}
              <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-md p-5 sm:p-6">
                <Icon
                  icon="solar:chat-round-call-bold-duotone"
                  className="text-emerald-300 text-2xl"
                />
                <h4 className="mt-3 text-white font-bold text-sm">
                  Lebih nyaman langsung chat?
                </h4>
                <p className="mt-1.5 text-white/55 text-[12.5px] leading-relaxed">
                  Hubungi konsultan kami via WhatsApp — biasanya membalas dalam
                  beberapa menit.
                </p>
                <a
                  href="https://wa.me/6281335716679?text=Halo%20Solusindo%2C%20saya%20tertarik%20titip%20jual%20properti."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-400 text-[#05070D] font-bold text-[12.5px] tracking-wide hover:bg-emerald-300 active:scale-[0.98] transition-all"
                >
                  <Icon icon="ic:baseline-whatsapp" className="text-base" />
                  Chat WhatsApp
                </a>
              </div>
            </div>
          </aside>

          {/* FORM */}
          <div ref={cardRef} className="lg:col-span-8 scroll-mt-24">
            <div className="relative rounded-3xl p-[1px] bg-gradient-to-br from-emerald-400/35 via-white/[0.05] to-transparent">
              <div className="relative rounded-3xl bg-[#0B0F17]/95 backdrop-blur-xl overflow-hidden">
                <div className="pointer-events-none absolute -top-24 -right-20 h-56 w-56 rounded-full bg-emerald-400/15 blur-3xl" />

                {!done ? (
                  <>
                    {/* Top bar */}
                    <div className="relative px-5 sm:px-7 pt-6 sm:pt-7 pb-3 flex items-center justify-between">
                      <div className="text-[10.5px] font-bold tracking-[0.22em] uppercase text-emerald-300/90">
                        Formulir Pendaftaran
                      </div>
                      <div className="text-[10.5px] font-bold tracking-[0.16em] uppercase text-white/45">
                        ± 90 detik
                      </div>
                    </div>

                    <div className="relative px-5 sm:px-7 pb-7">
                      {/* === Group: PROPERTI === */}
                      <GroupCard
                        index="01"
                        title="Properti"
                        desc="Cukup tiga informasi inti — sisanya kami verifikasi saat survey."
                        icon="solar:home-smile-bold-duotone"
                      >
                        <Field label="Jenis Properti" required>
                          <PropertyTypeDropdown
                            value={data.propertyType}
                            onChange={(v) => setField("propertyType", v)}
                          />
                        </Field>

                        <Field
                          label="Lokasi Properti"
                          hint="Cari alamat / geser pin — provinsi sampai kelurahan terisi otomatis."
                          required
                        >
                          <AddressMapPicker
                            value={{
                              address: data.address,
                              provinsi: data.provinsi,
                              kota: data.kota,
                              kecamatan: data.kecamatan,
                              kelurahan: data.kelurahan,
                              latitude: data.latitude,
                              longitude: data.longitude,
                            }}
                            onChange={(v) =>
                              setData((prev) => ({ ...prev, ...v }))
                            }
                          />
                        </Field>

                        <Field
                          label="Estimasi Harga Jual"
                          hint="Boleh kosong — tim kami bantu estimasi gratis saat survey."
                        >
                          <Input
                            prefix="Rp"
                            placeholder="1.500.000.000"
                            value={data.estimatedPrice}
                            onChange={(e) =>
                              setField(
                                "estimatedPrice",
                                formatRupiahInput(e.target.value)
                              )
                            }
                            inputMode="numeric"
                          />
                        </Field>
                      </GroupCard>

                      {/* === Group: ANDA === */}
                      <GroupCard
                        index="02"
                        title="Anda"
                        desc="Untuk konsultan menghubungi — tidak dipublikasikan."
                        icon="solar:user-id-bold-duotone"
                      >
                        <div className="grid sm:grid-cols-2 gap-4 [&>div]:!mt-0">
                          <Field label="Nama Lengkap" required>
                            <Input
                              icon="solar:user-bold"
                              placeholder="Nama sesuai KTP"
                              value={data.ownerName}
                              onChange={(e) =>
                                setField("ownerName", e.target.value)
                              }
                            />
                          </Field>
                          <Field label="No. WhatsApp" required>
                            <Input
                              prefix="+62"
                              placeholder="812-3456-7890"
                              value={data.ownerPhone}
                              onChange={(e) =>
                                setField(
                                  "ownerPhone",
                                  formatPhoneInput(e.target.value)
                                )
                              }
                              inputMode="numeric"
                            />
                          </Field>
                        </div>

                        <Field label="Status Kepemilikan" required>
                          <div className="grid grid-cols-2 gap-2.5">
                            {[
                              {
                                v: "PRIBADI" as OwnershipStatus,
                                l: "Pribadi",
                                d: "Saya pemilik sah",
                                i: "solar:user-check-bold-duotone",
                              },
                              {
                                v: "ORANG_LAIN" as OwnershipStatus,
                                l: "Orang Lain",
                                d: "Berkuasa atas nama pemilik",
                                i: "solar:users-group-rounded-bold-duotone",
                              },
                            ].map((o) => {
                              const active = data.ownershipStatus === o.v;
                              return (
                                <button
                                  key={o.v}
                                  type="button"
                                  onClick={() =>
                                    setField("ownershipStatus", o.v)
                                  }
                                  className={`flex items-start gap-2.5 px-3.5 py-3 rounded-2xl border text-left transition-all ${
                                    active
                                      ? "border-emerald-400/50 bg-emerald-400/10"
                                      : "border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.05]"
                                  }`}
                                >
                                  <Icon
                                    icon={o.i}
                                    className={`text-xl shrink-0 ${
                                      active
                                        ? "text-emerald-300"
                                        : "text-white/45"
                                    }`}
                                  />
                                  <div className="min-w-0">
                                    <div
                                      className={`text-[13px] font-bold ${
                                        active ? "text-white" : "text-white/80"
                                      }`}
                                    >
                                      {o.l}
                                    </div>
                                    <div className="text-[10.5px] mt-0.5 text-white/55">
                                      {o.d}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          <AnimatePresence initial={false}>
                            {data.ownershipStatus === "ORANG_LAIN" && (
                              <motion.div
                                key="kuasa-warn"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{
                                  duration: 0.28,
                                  ease: [0.22, 1, 0.36, 1],
                                }}
                                className="overflow-hidden"
                              >
                                <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.05] p-3">
                                  <Icon
                                    icon="solar:info-circle-bold-duotone"
                                    className="text-amber-300 text-base shrink-0 mt-0.5"
                                  />
                                  <p className="text-[11.5px] text-white/70 leading-snug">
                                    Pastikan Anda memiliki{" "}
                                    <span className="text-amber-200 font-bold">
                                      Surat Kuasa
                                    </span>{" "}
                                    dari pemilik resmi. Tim notaris kami akan
                                    memverifikasi keabsahannya sebelum
                                    perjanjian titip jual ditandatangani.
                                  </p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </Field>
                      </GroupCard>

                      {/* === Agreement + Submit === */}
                      <div className="mt-5">
                        <label className="flex items-start gap-3 cursor-pointer group rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.03] p-3.5 hover:border-emerald-400/30 hover:bg-emerald-400/[0.05] transition-all">
                          <input
                            type="checkbox"
                            checked={data.agreement}
                            onChange={(e) =>
                              setField("agreement", e.target.checked)
                            }
                            className="sr-only peer"
                          />
                          <span className="mt-0.5 h-5 w-5 shrink-0 rounded-md border border-white/25 bg-white/[0.03] peer-checked:bg-emerald-400 peer-checked:border-emerald-400 flex items-center justify-center transition-all">
                            <Icon
                              icon="solar:check-read-bold"
                              className={`text-[#05070D] text-sm ${
                                data.agreement ? "opacity-100" : "opacity-0"
                              } transition-opacity`}
                            />
                          </span>
                          <span className="text-[12.5px] text-white/75 leading-snug">
                            Saya menjamin informasi yang diberikan benar &amp;
                            saya adalah pihak yang berwenang atas properti ini.
                            Saya menyetujui{" "}
                            <a
                              href="/help/syarat-ketentuan"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-300 font-semibold underline-offset-2 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Syarat &amp; Ketentuan
                            </a>{" "}
                            dan memahami formulir ini{" "}
                            <span className="text-white font-semibold">
                              belum mengikat
                            </span>{" "}
                            — perjanjian resmi dibuat di hadapan notaris.
                          </span>
                        </label>

                        <button
                          type="button"
                          onClick={handleSubmit}
                          disabled={!canSubmit || submitting}
                          className={`mt-4 w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold text-sm tracking-wide transition-all ${
                            canSubmit && !submitting
                              ? "bg-gradient-to-r from-emerald-400 to-teal-500 text-[#05070D] shadow-[0_10px_30px_rgba(52,211,153,0.3)] hover:shadow-[0_16px_44px_rgba(52,211,153,0.5)] active:scale-[0.98]"
                              : "bg-white/[0.05] text-white/35 cursor-not-allowed"
                          }`}
                        >
                          {submitting ? (
                            <>
                              <Icon
                                icon="line-md:loading-loop"
                                className="text-base"
                              />
                              Mengirim…
                            </>
                          ) : (
                            <>
                              Kirim Pendaftaran
                              <Icon
                                icon="solar:paper-plane-bold"
                                className="text-base"
                              />
                            </>
                          )}
                        </button>

                        {!canSubmit && !submitting && !submitError && (
                          <p className="mt-3 text-center text-[11px] text-white/40">
                            Lengkapi field bertanda{" "}
                            <span className="text-emerald-300">*</span> untuk
                            mengirim.
                          </p>
                        )}

                        {submitError && (
                          <div className="mt-3 rounded-xl border border-red-400/30 bg-red-400/[0.06] p-3 text-[12px] text-red-200 flex items-start gap-2">
                            <Icon
                              icon="solar:danger-triangle-bold-duotone"
                              className="text-red-300 text-base shrink-0 mt-0.5"
                            />
                            <span>{submitError}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  /* === SUCCESS === */
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 200,
                      damping: 22,
                    }}
                    className="relative px-5 sm:px-7 py-12 sm:py-14 text-center"
                  >
                    <motion.div
                      initial={{ scale: 0, rotate: -15 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{
                        delay: 0.15,
                        type: "spring",
                        stiffness: 200,
                        damping: 16,
                      }}
                      className="mx-auto h-16 w-16 rounded-2xl bg-emerald-400/15 border border-emerald-400/40 flex items-center justify-center shadow-[0_0_30px_rgba(52,211,153,0.3)]"
                    >
                      <Icon
                        icon="solar:check-circle-bold-duotone"
                        className="text-emerald-300 text-3xl"
                      />
                    </motion.div>
                    <h3 className="mt-5 text-white font-bold text-2xl sm:text-3xl">
                      Pendaftaran Terkirim
                    </h3>
                    <p className="mt-3 max-w-md mx-auto text-white/65 text-[13.5px] sm:text-sm leading-relaxed">
                      Terima kasih,{" "}
                      {data.ownerName.split(" ")[0] || "Bapak/Ibu"}. Konsultan
                      kami akan menghubungi nomor{" "}
                      <span className="text-emerald-300 font-semibold">
                        +62 {data.ownerPhone}
                      </span>{" "}
                      dalam 1×24 jam dengan estimasi harga pasar awal.
                    </p>

                    <div className="mt-7 grid sm:grid-cols-3 gap-3 max-w-lg mx-auto">
                      {[
                        {
                          n: "1",
                          l: "Konsultan menghubungi",
                          s: "< 24 jam",
                          i: "solar:phone-calling-bold",
                        },
                        {
                          n: "2",
                          l: "Survey & CMA",
                          s: "1–2 hari",
                          i: "solar:map-point-bold",
                        },
                        {
                          n: "3",
                          l: "Listing siap pasar",
                          s: "4–7 hari",
                          i: "solar:rocket-bold",
                        },
                      ].map((x) => (
                        <div
                          key={x.n}
                          className="rounded-2xl border border-white/8 bg-white/[0.025] p-3.5 text-left"
                        >
                          <div className="flex items-center justify-between">
                            <Icon
                              icon={x.i}
                              className="text-emerald-300 text-base"
                            />
                            <span className="text-[10px] font-bold text-emerald-300/80 tracking-[0.18em] uppercase">
                              {x.s}
                            </span>
                          </div>
                          <div className="mt-1.5 text-[12.5px] font-semibold text-white">
                            {x.l}
                          </div>
                        </div>
                      ))}
                    </div>

                    <a
                      href="https://wa.me/6281335716679?text=Halo%20Solusindo%2C%20saya%20baru%20saja%20submit%20form%20titip%20jual."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-7 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-400 text-[#05070D] font-bold text-sm tracking-wide hover:bg-emerald-300 active:scale-[0.98] transition-all"
                    >
                      <Icon
                        icon="ic:baseline-whatsapp"
                        className="text-lg"
                      />
                      Chat Konsultan Sekarang
                    </a>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

/* =========================================================
   Atoms
   ========================================================= */

const GroupCard: React.FC<{
  index: string;
  title: string;
  desc: string;
  icon: string;
  children: React.ReactNode;
}> = ({ index, title, desc, icon, children }) => (
  <div className="mt-5 first:mt-0 rounded-3xl border border-white/[0.07] bg-white/[0.015] p-4 sm:p-5">
    <div className="flex items-start gap-3 mb-4">
      <div className="h-10 w-10 rounded-2xl bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center shrink-0">
        <Icon icon={icon} className="text-emerald-300 text-xl" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[10.5px] font-bold tracking-[0.22em] uppercase text-emerald-300/90 tabular-nums">
            {index}
          </span>
          <h3 className="text-white font-bold text-base sm:text-lg leading-tight">
            {title}
          </h3>
        </div>
        <p className="mt-0.5 text-white/55 text-[12px] sm:text-[12.5px]">
          {desc}
        </p>
      </div>
    </div>
    {children}
  </div>
);

const Field: React.FC<{
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}> = ({ label, hint, required, children }) => (
  <div className="mt-4 first:mt-0">
    <div className="flex items-center justify-between mb-2">
      <label className="text-[11.5px] font-bold tracking-[0.16em] uppercase text-white/70">
        {label}{" "}
        {required && (
          <span className="text-emerald-300 ml-0.5 normal-case tracking-normal">
            *
          </span>
        )}
      </label>
      {hint && (
        <span className="hidden sm:inline text-[10.5px] text-white/40 max-w-[60%] text-right">
          {hint}
        </span>
      )}
    </div>
    {children}
    {hint && (
      <p className="sm:hidden mt-1.5 text-[10.5px] text-white/40">{hint}</p>
    )}
  </div>
);

const Input: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & {
    icon?: string;
    prefix?: string;
  }
> = ({ icon, prefix, ...rest }) => (
  <div className="relative flex items-center rounded-2xl border border-white/10 bg-white/[0.03] focus-within:border-emerald-400/50 focus-within:bg-emerald-400/[0.04] transition-all">
    {icon && (
      <Icon
        icon={icon}
        className="absolute left-3.5 text-white/45 text-base pointer-events-none"
      />
    )}
    {prefix && (
      <span className="pl-3.5 text-white/55 text-[13px] font-semibold tabular-nums select-none">
        {prefix}
      </span>
    )}
    <input
      {...rest}
      className={`w-full bg-transparent text-white placeholder:text-white/30 text-[13.5px] sm:text-sm font-medium py-3 pr-3.5 outline-none ${
        icon ? "pl-11" : prefix ? "pl-1.5" : "pl-3.5"
      }`}
    />
  </div>
);

/* =========================================================
   Property type dropdown (custom UI)
   ========================================================= */

const PropertyTypeDropdown: React.FC<{
  value: PropertyType | "";
  onChange: (v: PropertyType) => void;
}> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<PropertyType | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const selected = PROPERTY_TYPES.find((t) => t.v === value);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className={`w-full flex items-center gap-3 rounded-2xl border bg-white/[0.03] text-left p-3.5 transition-all ${
          open
            ? "border-emerald-400/50 bg-emerald-400/[0.04] shadow-[0_0_18px_rgba(52,211,153,0.15)]"
            : "border-white/10 hover:border-white/20 hover:bg-white/[0.05]"
        }`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <div
          className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 transition-all ${
            selected
              ? "border-emerald-400/35 bg-emerald-400/15"
              : "border-white/10 bg-white/[0.03]"
          }`}
        >
          <Icon
            icon={selected?.i ?? "solar:home-2-bold-duotone"}
            className={`text-xl ${selected ? "text-emerald-300" : "text-white/40"}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={`text-[10px] font-bold tracking-[0.16em] uppercase ${
              selected ? "text-emerald-300/80" : "text-white/40"
            }`}
          >
            {selected ? "Jenis dipilih" : "Belum dipilih"}
          </div>
          <div
            className={`mt-0.5 text-[14px] font-bold truncate ${
              selected ? "text-white" : "text-white/40"
            }`}
          >
            {selected?.l ?? "Pilih jenis properti"}
          </div>
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="shrink-0"
        >
          <Icon
            icon="solar:alt-arrow-down-bold"
            className={`text-base ${open ? "text-emerald-300" : "text-white/50"}`}
          />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
            className="absolute z-50 mt-2 left-0 right-0 rounded-2xl border border-white/10 bg-[#0A0D14] shadow-[0_24px_70px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)] overflow-hidden"
            role="listbox"
          >
            <div className="h-px w-full bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />

            <div className="px-4 pt-3 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon
                  icon="solar:buildings-bold-duotone"
                  className="text-emerald-300 text-base"
                />
                <span className="text-[10.5px] font-bold tracking-[0.22em] uppercase text-white/55">
                  Pilih Jenis Properti
                </span>
              </div>
              <span className="text-[10px] text-white/35 font-bold tabular-nums">
                {PROPERTY_TYPES.length} opsi
              </span>
            </div>

            <div className="p-2 grid grid-cols-2 gap-1.5">
              {PROPERTY_TYPES.map((t, idx) => {
                const isActive = value === t.v;
                const isHover = hover === t.v;
                return (
                  <motion.button
                    key={t.v}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setHover(t.v)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => {
                      onChange(t.v);
                      setOpen(false);
                    }}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.025 }}
                    className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all overflow-hidden ${
                      isActive
                        ? "bg-emerald-400/12 border border-emerald-400/40"
                        : isHover
                        ? "bg-white/[0.05] border border-white/10"
                        : "bg-white/[0.02] border border-white/[0.05]"
                    }`}
                  >
                    <span
                      className={`pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-400/[0.06] to-transparent transition-opacity ${
                        isHover && !isActive ? "opacity-100" : "opacity-0"
                      }`}
                    />

                    <div
                      className={`relative h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                        isActive
                          ? "bg-emerald-400/20 border border-emerald-400/40"
                          : "bg-white/[0.04] border border-white/10 group-hover:bg-emerald-400/10 group-hover:border-emerald-400/25"
                      }`}
                    >
                      <Icon
                        icon={t.i}
                        className={`text-[18px] transition-colors ${
                          isActive
                            ? "text-emerald-300"
                            : "text-white/55 group-hover:text-emerald-300"
                        }`}
                      />
                    </div>
                    <span
                      className={`relative text-[13px] font-bold truncate transition-colors ${
                        isActive ? "text-white" : "text-white/80 group-hover:text-white"
                      }`}
                    >
                      {t.l}
                    </span>
                    {isActive && (
                      <motion.span
                        layoutId="prop-active-check"
                        className="relative ml-auto h-5 w-5 rounded-full bg-emerald-400 text-[#05070D] flex items-center justify-center shrink-0"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      >
                        <Icon icon="solar:check-read-bold" className="text-xs" />
                      </motion.span>
                    )}
                  </motion.button>
                );
              })}
            </div>

            <div className="px-4 py-2.5 border-t border-white/[0.05] bg-black/20 flex items-center gap-1.5">
              <Icon
                icon="solar:info-circle-bold"
                className="text-white/35 text-xs"
              />
              <span className="text-[10.5px] text-white/40 font-semibold">
                Belum yakin? Tim kami bantu identifikasi saat survey.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* =========================================================
   Address Map Picker (Google Places + Maps)
   ========================================================= */

type AddressPayload = {
  address: string;
  provinsi: string;
  kota: string;
  kecamatan: string;
  kelurahan: string;
  latitude: number | null;
  longitude: number | null;
};

const INDONESIA_BOUNDS = {
  north: 6.2,
  south: -11.0,
  west: 95.0,
  east: 141.0,
};
const DEFAULT_CENTER = { lat: -2.5, lng: 118.0 };
const GMAPS_LIBS: ("places")[] = ["places"];

function debounceFn<F extends (...args: any[]) => void>(fn: F, delay: number) {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<F>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function parseAdminLevels(
  components: any[] | undefined
): Pick<AddressPayload, "provinsi" | "kota" | "kecamatan" | "kelurahan"> {
  let provinsi = "";
  let kota = "";
  let kecamatan = "";
  let kelurahan = "";
  (components || []).forEach((c) => {
    const t: string[] = c.types || [];
    if (t.includes("administrative_area_level_1")) provinsi = c.long_name;
    if (t.includes("administrative_area_level_2")) kota = c.long_name;
    if (t.includes("administrative_area_level_3")) kecamatan = c.long_name;
    if (
      t.includes("administrative_area_level_4") ||
      t.includes("sublocality_level_1") ||
      t.includes("sublocality")
    )
      kelurahan = c.long_name;
  });
  return {
    provinsi: provinsi.replace(/^(Provinsi|Province|Prov\.?)\s*/i, "").trim(),
    kota: kota.replace(/^(Kabupaten|Kota|Kab\.?)\s*/i, "").trim(),
    kecamatan: kecamatan.replace(/^(Kecamatan|Kec\.?)\s*/i, "").trim(),
    kelurahan: kelurahan.replace(/^(Kelurahan|Desa|Kel\.?)\s*/i, "").trim(),
  };
}

const AddressMapPicker: React.FC<{
  value: AddressPayload;
  onChange: (partial: Partial<AddressPayload>) => void;
}> = ({ value, onChange }) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useJsApiLoader, GoogleMap, Marker } = require("@react-google-maps/api");
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: GMAPS_LIBS,
    language: 'id',
    region: 'ID',
  });

  const [map, setMap] = useState<any>(null);
  const acRef = useRef<any>(null);
  const psRef = useRef<any>(null);

  const [query, setQuery] = useState(value.address || "");
  const [predictions, setPredictions] = useState<
    { place_id: string; description: string; main_text: string; secondary_text: string }[]
  >([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [loadingPred, setLoadingPred] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const inputBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (value.address !== query) setQuery(value.address || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.address]);

  useEffect(() => {
    if (!isLoaded || !(window as any).google) return;
    if (!acRef.current) {
      acRef.current = new (window as any).google.maps.places.AutocompleteService();
    }
    if (!psRef.current && map) {
      psRef.current = new (window as any).google.maps.places.PlacesService(map);
    }
  }, [isLoaded, map]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (
        inputBoxRef.current &&
        !inputBoxRef.current.contains(e.target as Node)
      )
        setShowPredictions(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const fetchPredictions = useMemo(
    () =>
      debounceFn((input: string) => {
        if (!acRef.current || input.trim().length < 3) {
          setPredictions([]);
          setLoadingPred(false);
          return;
        }
        setLoadingPred(true);
        acRef.current
          .getPlacePredictions({
            input,
            componentRestrictions: { country: "id" },
          })
          .then((res: any) => {
            const list = (res?.predictions || []).slice(0, 6).map((p: any) => ({
              place_id: p.place_id,
              description: p.description,
              main_text: p.structured_formatting?.main_text || p.description,
              secondary_text: p.structured_formatting?.secondary_text || "",
            }));
            setPredictions(list);
            setLoadingPred(false);
          })
          .catch(() => {
            setPredictions([]);
            setLoadingPred(false);
          });
      }, 280),
    []
  );

  const onQueryChange = (q: string) => {
    setQuery(q);
    onChange({ address: q });
    setShowPredictions(true);
    fetchPredictions(q);
  };

  const applyPlace = (placeId: string, fallbackText?: string) => {
    if (!psRef.current) return;
    setResolving(true);
    psRef.current.getDetails(
      {
        placeId,
        fields: ["geometry", "address_components", "formatted_address", "name"],
      },
      (place: any, status: any) => {
        const ok =
          status === (window as any).google.maps.places.PlacesServiceStatus.OK;
        if (ok && place?.geometry?.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const admin = parseAdminLevels(place.address_components);
          const finalAddress =
            place.formatted_address || fallbackText || query;
          onChange({
            address: finalAddress,
            latitude: lat,
            longitude: lng,
            ...admin,
          });
          setQuery(finalAddress);
          if (map) {
            map.panTo({ lat, lng });
            map.setZoom(17);
          }
        }
        setResolving(false);
        setShowPredictions(false);
      }
    );
  };

  const reverseGeocode = (lat: number, lng: number) => {
    if (!(window as any).google) return;
    const gc = new (window as any).google.maps.Geocoder();
    gc.geocode({ location: { lat, lng } }, (results: any, status: string) => {
      if (status === "OK" && results?.[0]) {
        const admin = parseAdminLevels(results[0].address_components);
        const newAddr = results[0].formatted_address || "";
        onChange({
          latitude: lat,
          longitude: lng,
          address: newAddr,
          ...admin,
        });
        setQuery(newAddr);
      } else {
        onChange({ latitude: lat, longitude: lng });
      }
    });
  };

  const onMarkerDragEnd = (e: any) => {
    if (!e?.latLng) return;
    reverseGeocode(e.latLng.lat(), e.latLng.lng());
  };

  const onMapClick = (e: any) => {
    if (!e?.latLng) return;
    reverseGeocode(e.latLng.lat(), e.latLng.lng());
  };

  const requestGPS = () => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        reverseGeocode(lat, lng);
        if (map) {
          map.panTo({ lat, lng });
          map.setZoom(17);
        }
        setGpsLoading(false);
      },
      () => {
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const onMapLoad = (m: any) => {
    setMap(m);
    if (value.latitude && value.longitude) {
      m.panTo({ lat: value.latitude, lng: value.longitude });
      m.setZoom(17);
    } else {
      const g = (window as any).google;
      if (g) {
        const bounds = new g.maps.LatLngBounds(
          { lat: INDONESIA_BOUNDS.south, lng: INDONESIA_BOUNDS.west },
          { lat: INDONESIA_BOUNDS.north, lng: INDONESIA_BOUNDS.east }
        );
        m.fitBounds(bounds);
      }
    }
  };

  const verified =
    value.latitude !== null &&
    value.longitude !== null &&
    !!value.provinsi &&
    !!value.kota;

  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-400/30 bg-red-400/[0.06] p-4 text-[12.5px] text-red-200">
        Gagal memuat Google Maps. Pastikan koneksi & API key aktif.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div ref={inputBoxRef} className="relative">
        <div
          className={`flex items-center gap-2.5 rounded-2xl border bg-white/[0.03] transition-all p-3.5 ${
            showPredictions
              ? "border-emerald-400/50 bg-emerald-400/[0.04]"
              : "border-white/10 hover:border-white/20"
          }`}
        >
          <Icon
            icon="solar:magnifer-bold-duotone"
            className="text-emerald-300 text-xl shrink-0"
          />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => query.length >= 3 && setShowPredictions(true)}
            placeholder="Cari alamat — contoh: Manukan Karya No. 1, Surabaya"
            className="w-full bg-transparent outline-none text-white placeholder:text-white/35 text-[13.5px] sm:text-sm font-medium"
          />
          {(loadingPred || resolving) && (
            <Icon
              icon="line-md:loading-loop"
              className="text-emerald-300 text-base shrink-0"
            />
          )}
        </div>

        <AnimatePresence>
          {showPredictions && predictions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="absolute z-50 left-0 right-0 mt-2 rounded-2xl border border-white/10 bg-[#0A0D14] shadow-[0_24px_70px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)] overflow-hidden"
            >
              <div className="h-px w-full bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
              <div className="max-h-[280px] overflow-y-auto p-1.5">
                {predictions.map((p, i) => (
                  <button
                    key={p.place_id}
                    type="button"
                    onClick={() => applyPlace(p.place_id, p.description)}
                    className="group w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-emerald-400/[0.06] transition-colors"
                  >
                    <div className="h-8 w-8 rounded-lg border border-white/10 bg-white/[0.03] group-hover:bg-emerald-400/10 group-hover:border-emerald-400/30 flex items-center justify-center shrink-0 mt-0.5 transition-all">
                      <Icon
                        icon="solar:map-point-bold-duotone"
                        className="text-white/50 group-hover:text-emerald-300 text-base transition-colors"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold text-white truncate">
                        {p.main_text}
                      </div>
                      <div className="text-[11.5px] text-white/50 truncate">
                        {p.secondary_text}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold tabular-nums text-white/30 mt-1.5">
                      {i + 1}
                    </span>
                  </button>
                ))}
              </div>
              <div className="px-4 py-2 border-t border-white/[0.05] bg-black/20 flex items-center gap-1.5">
                <Icon
                  icon="solar:info-circle-bold"
                  className="text-white/35 text-xs"
                />
                <span className="text-[10.5px] text-white/40 font-semibold">
                  Powered by Google Places · Indonesia only
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/40">
        <div className="aspect-[16/11] sm:aspect-[16/9] w-full">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%" }}
              center={
                value.latitude && value.longitude
                  ? { lat: value.latitude, lng: value.longitude }
                  : DEFAULT_CENTER
              }
              zoom={value.latitude && value.longitude ? 17 : 5}
              onLoad={onMapLoad}
              onClick={onMapClick}
              options={{
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
                clickableIcons: false,
                restriction: {
                  latLngBounds: INDONESIA_BOUNDS,
                  strictBounds: true,
                },
              }}
            >
              {value.latitude && value.longitude && (
                <Marker
                  position={{ lat: value.latitude, lng: value.longitude }}
                  draggable
                  onDragEnd={onMarkerDragEnd}
                />
              )}
            </GoogleMap>
          ) : (
            <div className="h-full w-full flex items-center justify-center text-white/40 text-[12.5px] gap-2">
              <Icon
                icon="line-md:loading-loop"
                className="text-emerald-300 text-base"
              />
              Memuat peta…
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={requestGPS}
          disabled={gpsLoading || !isLoaded}
          className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#0B0F17]/85 backdrop-blur-md border border-emerald-400/30 text-emerald-200 text-[11.5px] font-bold tracking-wide shadow-[0_8px_24px_rgba(0,0,0,0.4)] hover:bg-emerald-400/15 active:scale-[0.97] transition-all disabled:opacity-50"
        >
          <Icon
            icon={gpsLoading ? "line-md:loading-loop" : "solar:gps-bold-duotone"}
            className="text-base"
          />
          GPS Saya
        </button>

        {!value.latitude && (
          <div className="absolute inset-x-0 bottom-3 mx-auto w-fit pointer-events-none">
            <div className="px-3 py-1.5 rounded-full bg-[#0B0F17]/85 backdrop-blur-md border border-white/10 text-white/70 text-[11px] font-semibold flex items-center gap-1.5">
              <Icon
                icon="solar:hand-pointing-bold"
                className="text-emerald-300 text-sm"
              />
              Cari alamat di atas, atau klik peta untuk menaruh pin
            </div>
          </div>
        )}
      </div>

      <motion.div
        initial={false}
        animate={{ opacity: verified ? 1 : 0.55 }}
        className={`rounded-2xl border p-3.5 sm:p-4 transition-colors ${
          verified
            ? "border-emerald-400/30 bg-emerald-400/[0.05]"
            : "border-white/10 bg-white/[0.025]"
        }`}
      >
        <div className="flex items-center gap-2 mb-3">
          <Icon
            icon={
              verified
                ? "solar:verified-check-bold-duotone"
                : "solar:map-arrow-square-bold-duotone"
            }
            className={`text-base ${verified ? "text-emerald-300" : "text-white/45"}`}
          />
          <span
            className={`text-[10.5px] font-bold tracking-[0.22em] uppercase ${
              verified ? "text-emerald-300" : "text-white/45"
            }`}
          >
            {verified ? "Lokasi Terverifikasi" : "Menunggu Lokasi"}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ADMIN_LEVELS.map((lv) => {
            const v = value[lv.key];
            const filled = !!v;
            return (
              <div
                key={lv.key}
                className={`rounded-xl border p-2.5 transition-all ${
                  filled
                    ? "border-emerald-400/25 bg-emerald-400/[0.05]"
                    : "border-white/[0.06] bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Icon
                    icon={lv.icon}
                    className={`text-sm ${filled ? "text-emerald-300" : "text-white/35"}`}
                  />
                  <span className="text-[9.5px] font-bold tracking-[0.16em] uppercase text-white/45">
                    {lv.label}
                  </span>
                </div>
                <div
                  className={`mt-1 text-[12.5px] font-bold truncate ${
                    filled ? "text-white" : "text-white/30"
                  }`}
                >
                  {v || "—"}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default ConsignmentForm;

"use client";

/**
 * Jadwalkan survei kos — memakai jalur yang sama dengan halaman Jual & Lelang
 * (`/api/survei/availability` + `/api/survei/booking`), jadi jadwal yang dibuat
 * dari halaman sewa langsung muncul di kalender agent dan memblokir slot yang
 * sama. Tidak ada tabel atau alur baru untuk sewa.
 *
 * Kenapa survei, bukan "booking online": kamar kos disewa setelah dilihat.
 * Membuat tombol yang seolah-olah mengunci kamar tanpa pembayaran hanya
 * memindahkan kekecewaan ke hari kedatangan — yang bisa dijanjikan halaman ini
 * dengan jujur adalah janji temu yang benar-benar tercatat di sisi agent.
 */

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { useSession } from "next-auth/react";
import { trackLeadClick } from "@/lib/leadTracking";
import Kalender from "./Kalender";
import { AKSEN, SURFACE } from "./sewaTheme";

interface Slot {
  label: string;
  hour: number;
  blocked: boolean;
}

interface Props {
  buka: boolean;
  onTutup: () => void;
  idProperty: string;
  idAgent: string;
  namaAgent: string;
  teleponAgent: string;
  judulProperti: string;
  /** Ikut dikirim ke agent supaya dia tahu kamar mana yang mau dilihat. */
  ringkasanPilihan?: string;
}

const formatTanggalPanjang = (d: Date) =>
  d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function SurveiModal({
  buka,
  onTutup,
  idProperty,
  idAgent,
  namaAgent,
  teleponAgent,
  judulProperti,
  ringkasanPilihan,
}: Props) {
  const { data: session } = useSession();

  const [mounted, setMounted] = useState(false);
  const [langkah, setLangkah] = useState<1 | 2 | 3>(1);
  const [tanggal, setTanggal] = useState<Date | null>(null);
  const [jam, setJam] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot[]>([]);
  const [muatSlot, setMuatSlot] = useState(false);
  const [nama, setNama] = useState("");
  const [telepon, setTelepon] = useState("");
  const [catatan, setCatatan] = useState("");
  const [galat, setGalat] = useState("");
  const [kirim, setKirim] = useState(false);
  const [sukses, setSukses] = useState(false);

  useEffect(() => setMounted(true), []);

  // Reset tiap kali dibuka — modal yang masih menyimpan pilihan lama membuat
  // user mengira jadwal sebelumnya belum terkirim.
  useEffect(() => {
    if (!buka) return;
    setLangkah(1);
    setTanggal(null);
    setJam(null);
    setSlot([]);
    setGalat("");
    setSukses(false);
    setCatatan(
      ringkasanPilihan
        ? `Saya ingin melihat ${ringkasanPilihan}.`
        : "Saya ingin melihat kamarnya langsung.",
    );

    if (session?.user) {
      setNama(session.user.name || "");
      fetch("/api/profile")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          let digit = String(d?.pengguna?.nomor_telepon || "").replace(/\D/g, "");
          if (digit.startsWith("62")) digit = digit.slice(2);
          if (digit.startsWith("0")) digit = digit.slice(1);
          setTelepon(digit.slice(0, 12));
        })
        .catch(() => {});
    }
  }, [buka, session, ringkasanPilihan]);

  useEffect(() => {
    if (!buka) return;
    const asal = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = asal;
    };
  }, [buka]);

  const pilihTanggal = async (d: Date) => {
    setTanggal(d);
    setJam(null);
    setMuatSlot(true);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    try {
      const res = await fetch(
        `/api/survei/availability?agentId=${idAgent}&date=${iso}`,
      );
      const json = await res.json();
      setSlot(json.blockedSlots ?? []);
    } catch {
      setSlot([]);
    } finally {
      setMuatSlot(false);
    }
  };

  const teleponPenuh = `+62${telepon}`;

  const submit = async () => {
    if (!tanggal || !jam) return;
    if (!nama.trim()) {
      setGalat("Nama lengkap wajib diisi");
      return;
    }
    if (telepon.length < 7) {
      setGalat("Nomor WhatsApp tidak valid");
      return;
    }

    setKirim(true);
    setGalat("");

    // Jam slot adalah waktu WIB (UTC+7); dikirim ke API sebagai UTC supaya
    // tidak bergeser mengikuti zona waktu perangkat pengunjung.
    const [jamAngka] = jam.split(":").map(Number);
    const waktuUTC = new Date(
      Date.UTC(
        tanggal.getFullYear(),
        tanggal.getMonth(),
        tanggal.getDate(),
        jamAngka - 7,
        0,
        0,
      ),
    );

    const lead = await trackLeadClick({
      id_property: idProperty,
      id_agent: idAgent,
      source: "survei",
      client_name: nama.trim(),
      client_phone: teleponPenuh,
    });

    try {
      const res = await fetch("/api/survei/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_property: idProperty,
          id_agent: idAgent,
          nama_klien: nama.trim(),
          nomor_telepon: teleponPenuh,
          tanggal_survei: waktuUTC.toISOString(),
          catatan: catatan.trim() || undefined,
          id_lead: lead.id_lead,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setGalat(err.error || "Gagal menyimpan jadwal. Coba lagi.");
        setKirim(false);
        return;
      }
    } catch {
      setGalat("Koneksi gagal. Periksa jaringan Anda.");
      setKirim(false);
      return;
    }

    const wa = teleponAgent.replace(/^0/, "62").replace(/\D/g, "");
    const pesan =
      `Halo ${namaAgent}, saya ingin *survei kos*:\n` +
      `🏠 ${judulProperti}\n` +
      (ringkasanPilihan ? `🛏️ ${ringkasanPilihan}\n` : "") +
      `\n📅 ${formatTanggalPanjang(tanggal)}\n🕐 ${jam} WIB\n` +
      `👤 ${nama.trim()}\n📱 ${teleponPenuh}\n` +
      (catatan.trim() ? `📝 ${catatan.trim()}\n` : "") +
      `\nMohon konfirmasinya, terima kasih!`;
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(pesan)}`, "_blank");

    setKirim(false);
    setSukses(true);
  };

  if (!mounted || !buka) return null;

  const JUDUL_LANGKAH = ["Pilih jadwal", "Data diri", "Konfirmasi"];

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:px-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onTutup} />

      <div
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-white/10 shadow-2xl sm:max-h-[88vh] sm:max-w-[440px] sm:rounded-[1.75rem]"
        style={{ background: SURFACE.modal }}
      >
        {sukses ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-emerald-400/10">
              <Icon
                icon="solar:check-circle-bold"
                className={`text-4xl ${AKSEN.emerald.ikon}`}
              />
            </span>
            <h3 className="text-lg font-extrabold text-white">Jadwal terkirim</h3>
            <p className="mt-2 max-w-[30ch] text-sm leading-relaxed text-white/45">
              {namaAgent} sudah menerima permintaan survei Anda dan akan
              mengonfirmasi lewat WhatsApp.
            </p>
            <div className="mt-5 w-full rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 text-left">
              <p className="text-sm font-bold text-white">
                {tanggal && formatTanggalPanjang(tanggal)}
              </p>
              <p className="text-xs text-white/40">Pukul {jam} WIB</p>
            </div>
            <button
              onClick={onTutup}
              className="mt-6 w-full rounded-xl bg-white py-3 text-sm font-extrabold text-black transition-transform active:scale-[0.98]"
            >
              Selesai
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="border-b border-white/[0.06] px-5 pb-4 pt-5">
              <div className="mb-3 flex items-center gap-1.5">
                {[1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="h-[3px] rounded-full transition-all duration-300"
                    style={{
                      width: langkah === i ? 28 : 16,
                      background:
                        langkah === i
                          ? "#38bdf8"
                          : langkah > i
                            ? "rgba(56,189,248,0.35)"
                            : "rgba(255,255,255,0.1)",
                    }}
                  />
                ))}
                <span className="ml-auto text-[10px] font-bold tabular-nums text-white/25">
                  {langkah}/3
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-extrabold text-white">
                    {JUDUL_LANGKAH[langkah - 1]}
                  </h3>
                  <p className="truncate text-[11px] text-white/35">
                    {judulProperti}
                  </p>
                </div>
                <button
                  onClick={onTutup}
                  className="shrink-0 rounded-full p-1.5 text-white/35 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Tutup"
                >
                  <Icon icon="solar:close-circle-bold" className="text-xl" />
                </button>
              </div>
            </div>

            {/* Isi */}
            <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-5">
              {langkah === 1 && (
                <>
                  <Kalender value={tanggal} onSelect={pilihTanggal} maksBulanKeDepan={3} />

                  {tanggal && (
                    <div className="mt-5 border-t border-white/[0.06] pt-4">
                      <p className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-white/35">
                        Pilih jam (WIB)
                      </p>
                      {muatSlot ? (
                        <div className="grid grid-cols-3 gap-2">
                          {Array.from({ length: 6 }).map((_, i) => (
                            <div
                              key={i}
                              className="h-10 animate-pulse rounded-xl bg-white/[0.05]"
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {slot.map((s) => (
                            <button
                              key={s.label}
                              onClick={() => !s.blocked && setJam(s.label)}
                              disabled={s.blocked}
                              className={`rounded-xl py-2.5 text-xs font-bold transition-all ${
                                s.blocked
                                  ? "cursor-not-allowed bg-white/[0.02] text-white/15 line-through"
                                  : jam === s.label
                                    ? "bg-sky-400 text-[#06131f]"
                                    : "border border-white/[0.08] text-white/70 hover:border-white/30"
                              }`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {langkah === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-white/35">
                      Nama lengkap
                    </label>
                    <input
                      value={nama}
                      onChange={(e) => {
                        setNama(e.target.value);
                        setGalat("");
                      }}
                      placeholder="Nama sesuai KTP"
                      className="w-full rounded-xl border border-white/[0.08] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/20 focus:border-sky-400/60"
                      style={{ background: SURFACE.raised }}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-white/35">
                      Nomor WhatsApp
                    </label>
                    <div
                      className="flex items-center gap-2 rounded-xl border border-white/[0.08] px-4 focus-within:border-sky-400/60"
                      style={{ background: SURFACE.raised }}
                    >
                      <span className="text-sm font-bold text-white/40">+62</span>
                      <input
                        value={telepon}
                        onChange={(e) => {
                          let v = e.target.value.replace(/\D/g, "");
                          if (v.startsWith("62")) v = v.slice(2);
                          if (v.startsWith("0")) v = v.slice(1);
                          setTelepon(v.slice(0, 12));
                          setGalat("");
                        }}
                        inputMode="numeric"
                        placeholder="81234567890"
                        className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-white/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-white/35">
                      Catatan untuk agent
                    </label>
                    <textarea
                      value={catatan}
                      onChange={(e) => setCatatan(e.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-xl border border-white/[0.08] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/20 focus:border-sky-400/60"
                      style={{ background: SURFACE.raised }}
                    />
                  </div>
                </div>
              )}

              {langkah === 3 && (
                <div className="space-y-3">
                  {[
                    {
                      ikon: "solar:calendar-bold-duotone",
                      label: "Jadwal",
                      nilai: `${tanggal ? formatTanggalPanjang(tanggal) : "-"} · ${jam} WIB`,
                    },
                    {
                      ikon: "solar:user-bold-duotone",
                      label: "Nama",
                      nilai: nama,
                    },
                    {
                      ikon: "ic:baseline-whatsapp",
                      label: "WhatsApp",
                      nilai: teleponPenuh,
                    },
                    ...(ringkasanPilihan
                      ? [
                          {
                            ikon: "solar:bed-bold-duotone",
                            label: "Kamar diminati",
                            nilai: ringkasanPilihan,
                          },
                        ]
                      : []),
                  ].map((b) => (
                    <div
                      key={b.label}
                      className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5"
                    >
                      <Icon icon={b.ikon} className={`mt-0.5 text-lg ${AKSEN.cyan.ikon}`} />
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/30">
                          {b.label}
                        </p>
                        <p className="text-sm font-bold text-white">{b.nilai}</p>
                      </div>
                    </div>
                  ))}
                  <p className="pt-1 text-[11px] leading-relaxed text-white/35">
                    Dengan mengirim, jadwal ini masuk ke kalender agent dan Anda
                    akan diarahkan ke WhatsApp untuk konfirmasi. Tidak ada
                    pembayaran pada tahap ini.
                  </p>
                </div>
              )}

              {galat && (
                <p className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/[0.07] p-3 text-xs font-semibold text-rose-300">
                  <Icon icon="solar:danger-triangle-bold" className="text-base" />
                  {galat}
                </p>
              )}
            </div>

            {/* Aksi */}
            <div className="flex gap-2 border-t border-white/[0.06] px-5 py-4">
              {langkah > 1 && (
                <button
                  onClick={() => setLangkah((s) => (s - 1) as 1 | 2 | 3)}
                  className="flex-1 rounded-xl border border-white/[0.08] py-3 text-sm font-bold text-white/50 transition-colors hover:text-white"
                >
                  Kembali
                </button>
              )}
              <button
                onClick={() => {
                  if (langkah === 1) {
                    if (!tanggal || !jam) return;
                    setLangkah(2);
                  } else if (langkah === 2) {
                    if (!nama.trim()) return setGalat("Nama lengkap wajib diisi");
                    if (telepon.length < 7)
                      return setGalat("Nomor WhatsApp tidak valid");
                    setLangkah(3);
                  } else {
                    submit();
                  }
                }}
                disabled={
                  kirim || (langkah === 1 && (!tanggal || !jam))
                }
                className="flex-[2] rounded-xl bg-[#86efac] py-3 text-sm font-extrabold text-black transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-25"
              >
                {kirim ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Icon icon="solar:refresh-bold" className="animate-spin" />
                    Mengirim…
                  </span>
                ) : langkah === 3 ? (
                  "Kirim jadwal survei"
                ) : (
                  "Lanjut"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

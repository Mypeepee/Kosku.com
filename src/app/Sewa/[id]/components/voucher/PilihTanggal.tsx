"use client";

/**
 * Pemilih tanggal untuk panel kelola — pengganti `<input type="date">`.
 *
 * ── KENAPA BUKAN INPUT BAWAAN ─────────────────────────────────────────────
 * Kolom tanggal bawaan peramban adalah satu-satunya elemen di seluruh panel
 * yang tampilannya ditentukan sistem operasi, bukan halaman ini. Akibatnya
 * bukan sekadar "kurang cantik":
 *
 * 1. Bentuknya berbeda di setiap tempat — Chrome menampilkan tiga kotak angka
 *    dengan ikon kalender kecil, Safari iOS melempar roda gulung setinggi
 *    separuh layar, Firefox lain lagi. Satu-satunya isian yang tidak bisa
 *    ditebak bentuknya adalah isian yang paling sering ditinggalkan.
 * 2. Formatnya mengikuti sistem, jadi "03/08/2026" bisa berarti 3 Agustus atau
 *    8 Maret tergantung mesin pembacanya. Untuk tanggal yang menentukan kapan
 *    promo berhenti, ambiguitas itu berbiaya nyata.
 * 3. Placeholder-nya ("dd/mm/yyyy") tidak bisa diganti, jadi kolom yang boleh
 *    dikosongkan tetap terbaca seperti kolom wajib yang belum diisi.
 *
 * Yang dipakai sebagai gantinya: tombol yang MENULIS TANGGALNYA sebagai kalimat
 * ("Senin, 3 Agustus 2026" — beserta "12 hari lagi" di bawahnya), dan sebuah
 * kalender kecil yang muncul di tengah layar. Satu ketukan memilih dan langsung
 * menutup; tidak ada tombol "OK" yang harus dicari, karena memilih tanggal
 * adalah satu-satunya hal yang bisa dilakukan di sana.
 *
 * Batas `min`/`max` dihormati sebagai TANGGAL, bukan sebagai bulan: tanggal di
 * luar rentang tetap terlihat (supaya bulannya tetap utuh terbaca) tapi tidak
 * bisa ditekan.
 */

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";

import { AKSEN, LINE, SURFACE } from "../sewaTheme";
import { useSeretTutup } from "../../lib/useSeretTutup";

const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const NAMA_HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const NAMA_HARI_PANJANG = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

// ─────────────────────────────────────────────────────────────────────────────
// KUNCI TANGGAL
//
// Format yang dipakai voucher: "YYYY-MM-DD". Diurai & disusun manual, TIDAK
// lewat `new Date("2026-08-03")` — string ISO tanpa jam ditafsirkan sebagai UTC
// oleh peramban, dan di WIB (UTC+7) itu menggeser tanggalnya satu hari mundur
// untuk siapa pun yang membukanya. Bug yang persis seperti ini adalah alasan
// promo bisa berhenti sehari lebih cepat dari yang dipasang pemiliknya.
// ─────────────────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");

export const keKunci = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const dariKunci = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

/** "Senin, 3 Agustus 2026" — nama harinya ikut karena promo mingguan disusun
 *  per hari, bukan per angka. */
export const labelTanggal = (kunci: string): string => {
  const d = dariKunci(kunci);
  if (!d) return "";
  return `${NAMA_HARI_PANJANG[d.getDay()]}, ${d.getDate()} ${NAMA_BULAN[d.getMonth()]} ${d.getFullYear()}`;
};

/** "3 Agu 2026" — untuk ringkasan yang ruangnya sempit (kepala bagian
 *  terlipat), tempat "2026-08-03" hanya bisa dibaca oleh mesin. */
export const labelTanggalPendek = (kunci: string): string => {
  const d = dariKunci(kunci);
  if (!d) return kunci;
  return `${d.getDate()} ${NAMA_BULAN[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
};

/** Jarak dari hari ini, ditulis sebagai manusia bicara. */
const jarakHari = (kunci: string): string | null => {
  const d = dariKunci(kunci);
  if (!d) return null;
  const kini = new Date();
  kini.setHours(0, 0, 0, 0);
  const selisih = Math.round((d.getTime() - kini.getTime()) / 86_400_000);
  if (selisih === 0) return "Hari ini";
  if (selisih === 1) return "Besok";
  if (selisih === -1) return "Kemarin";
  return selisih > 0 ? `${selisih} hari lagi` : `${-selisih} hari lalu`;
};

// ─────────────────────────────────────────────────────────────────────────────
// KALENDER
// ─────────────────────────────────────────────────────────────────────────────

function Bulan({
  tampil,
  terpilih,
  min,
  max,
  onPilih,
}: {
  tampil: Date;
  terpilih: Date | null;
  min: Date | null;
  max: Date | null;
  onPilih: (d: Date) => void;
}) {
  const y = tampil.getFullYear();
  const m = tampil.getMonth();
  const hariPertama = new Date(y, m, 1).getDay();
  const jumlahHari = new Date(y, m + 1, 0).getDate();

  const hariIni = new Date();
  hariIni.setHours(0, 0, 0, 0);

  return (
    <>
      <div className="mb-1.5 grid grid-cols-7 text-center text-[10px] font-black uppercase tracking-[0.08em] text-white/45">
        {NAMA_HARI.map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {Array.from({ length: hariPertama }).map((_, i) => (
          <div key={`kosong-${i}`} className="h-10" />
        ))}

        {Array.from({ length: jumlahHari }).map((_, i) => {
          const tanggal = new Date(y, m, i + 1);
          const waktu = tanggal.getTime();
          const mati =
            (min != null && waktu < min.getTime()) ||
            (max != null && waktu > max.getTime());
          const dipilih = terpilih != null && waktu === terpilih.getTime();
          const ini = waktu === hariIni.getTime();

          return (
            <div key={i} className="flex h-10 items-center justify-center">
              <button
                type="button"
                onClick={() => !mati && onPilih(tanggal)}
                disabled={mati}
                aria-pressed={dipilih}
                aria-label={labelTanggal(keKunci(tanggal))}
                className={`relative grid h-9 w-9 place-items-center rounded-full text-[13px] font-bold transition-all duration-150 motion-reduce:transition-none ${
                  mati
                    ? "cursor-not-allowed text-white/15"
                    : dipilih
                      ? "scale-105 bg-[#86efac] text-black shadow-[0_6px_18px_-6px_rgba(134,239,172,0.9)]"
                      : ini
                        ? "text-[#86efac] hover:bg-white/10"
                        : "text-white/85 hover:bg-white/10"
                }`}
              >
                {i + 1}
                {ini && !dipilih && (
                  <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[#86efac]" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KOMPONEN UTAMA
// ─────────────────────────────────────────────────────────────────────────────

export default function PilihTanggal({
  nilai,
  onUbah,
  min,
  max,
  judul,
  kosong = "Pilih tanggal",
}: {
  /** "YYYY-MM-DD", atau "" bila memang dikosongkan. */
  nilai: string;
  onUbah: (v: string) => void;
  min?: string;
  max?: string;
  /** Judul kalender saat terbuka — menjawab "tanggal apa yang sedang saya isi". */
  judul: string;
  /** Bunyi tombol saat kosong. Bukan "dd/mm/yyyy": kolom ini boleh kosong, dan
   *  kalimatnya harus menyebutkan ARTI kosongnya. */
  kosong?: string;
}) {
  const [buka, setBuka] = useState(false);
  const [tampilkan, setTampilkan] = useState(false);
  const [mounted, setMounted] = useState(false);
  /** Seret pegangan/kepala ke bawah untuk menutup — lihat useSeretTutup. */
  const seret = useSeretTutup(() => setBuka(false));

  const terpilih = nilai ? dariKunci(nilai) : null;
  const batasBawah = min ? dariKunci(min) : null;
  const batasAtas = max ? dariKunci(max) : null;

  /** Bulan yang sedang dibuka. Dimulai dari tanggal yang sudah terisi, lalu
   *  batas bawah, lalu hari ini — urutan "yang paling mungkin dicari". */
  const [bulan, setBulan] = useState<Date>(() => {
    const acuan = terpilih ?? batasBawah ?? new Date();
    return new Date(acuan.getFullYear(), acuan.getMonth(), 1);
  });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!buka) {
      setTampilkan(false);
      return;
    }
    // Kalender selalu dibuka pada bulan yang relevan sekarang — bukan bulan
    // terakhir yang kebetulan dijelajahi lalu ditinggalkan.
    const acuan = terpilih ?? batasBawah ?? new Date();
    setBulan(new Date(acuan.getFullYear(), acuan.getMonth(), 1));

    const t = requestAnimationFrame(() => setTampilkan(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setBuka(false);
      }
    };
    // `capture`: drawer voucher di belakangnya juga mendengarkan Esc, dan tanpa
    // ini satu ketukan Esc menutup keduanya sekaligus.
    document.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(t);
      document.removeEventListener("keydown", onKey, true);
    };
    // Hanya `buka` yang boleh memicu: `terpilih`/`batasBawah` objek baru tiap
    // render dan akan melempar kalender kembali ke bulan awal terus-menerus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buka]);

  const geser = (arah: -1 | 1) =>
    setBulan((b) => new Date(b.getFullYear(), b.getMonth() + arah, 1));

  const diAwal =
    batasBawah != null &&
    bulan.getFullYear() === batasBawah.getFullYear() &&
    bulan.getMonth() === batasBawah.getMonth();
  const diAkhir =
    batasAtas != null &&
    bulan.getFullYear() === batasAtas.getFullYear() &&
    bulan.getMonth() === batasAtas.getMonth();

  const jarak = nilai ? jarakHari(nilai) : null;

  return (
    <>
      {/* ── Tombol ──
          Dua baris: tanggalnya sebagai kalimat, dan jaraknya dari hari ini.
          Baris kedua itu yang menangkap salah ketik tahun — "3 Agustus 2025"
          terlihat wajar sampai di bawahnya tertulis "355 hari lalu". */}
      <div
        className="flex items-center rounded-xl border border-white/[0.08] transition-colors focus-within:border-[#86efac]/50 hover:border-white/25"
        style={{ background: SURFACE.raised }}
      >
        <button
          type="button"
          onClick={() => setBuka(true)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left"
        >
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${
              nilai ? AKSEN.sky.kotak : "border-white/10 bg-white/[0.04] text-white/50"
            }`}
          >
            <Icon
              icon={nilai ? "solar:calendar-date-bold-duotone" : "solar:calendar-add-bold-duotone"}
              className="text-lg"
            />
          </span>
          <span className="min-w-0 flex-1">
            <span
              className={`block truncate text-[13px] font-bold ${
                nilai ? "text-white" : "text-white/60"
              }`}
            >
              {nilai ? labelTanggal(nilai) : kosong}
            </span>
            <span className="mt-0.5 block truncate text-[10px] font-semibold text-white/50">
              {jarak ?? "Ketuk untuk memilih tanggal"}
            </span>
          </span>
        </button>

        {nilai ? (
          <button
            type="button"
            onClick={() => onUbah("")}
            aria-label="Kosongkan tanggal"
            className="mr-2 shrink-0 rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white motion-reduce:transition-none"
          >
            <Icon icon="solar:close-circle-bold" className="text-lg" />
          </button>
        ) : (
          <Icon
            icon="solar:alt-arrow-right-linear"
            className="mr-3 shrink-0 text-lg text-white/35"
          />
        )}
      </div>

      {/* ── Kalender ──
          z-nya di atas drawer voucher (z-[9999]); kalender yang muncul di
          BAWAH modal pemanggilnya adalah kegagalan yang tidak bisa dipulihkan
          pengguna. */}
      {mounted &&
        buka &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-end justify-center sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label={judul}
          >
            <div
              className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none ${
                tampilkan ? "opacity-100" : "opacity-0"
              }`}
              onClick={() => setBuka(false)}
            />

            <div
              className={`relative w-full overflow-hidden rounded-t-[1.75rem] border border-white/10 shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:max-w-[360px] sm:rounded-[1.5rem] ${
                tampilkan
                  ? "translate-y-0 opacity-100 sm:scale-100"
                  : "translate-y-6 opacity-0 sm:translate-y-0 sm:scale-95"
              }`}
              style={{ background: SURFACE.modal, ...seret.gaya }}
            >
              <div {...seret.pegangan}>
                <div className="flex cursor-grab justify-center pt-3 active:cursor-grabbing sm:hidden">
                  <span className="h-[3px] w-9 rounded-full bg-white/25" />
                </div>

                {/* Kepala: apa yang sedang diisi, dan hasil pilihannya sekarang. */}
                <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
                  <div className="min-w-0">
                    <h4 className="text-[13px] font-extrabold leading-tight text-white">
                      {judul}
                    </h4>
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-white/55">
                      {nilai ? labelTanggal(nilai) : kosong}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBuka(false)}
                    aria-label="Tutup"
                    className="shrink-0 rounded-full p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white motion-reduce:transition-none"
                  >
                    <Icon icon="solar:close-circle-bold" className="text-xl" />
                  </button>
                </div>
              </div>

              {/* Navigasi bulan */}
              <div className="flex items-center justify-between gap-2 px-4 pb-2">
                <button
                  type="button"
                  onClick={() => geser(-1)}
                  disabled={diAwal}
                  aria-label="Bulan sebelumnya"
                  className="grid h-8 w-8 place-items-center rounded-lg text-white transition-colors hover:bg-white/10 disabled:opacity-20 motion-reduce:transition-none"
                >
                  <Icon icon="solar:alt-arrow-left-linear" />
                </button>
                <p className="text-[13px] font-extrabold tracking-[-0.01em] text-white">
                  {NAMA_BULAN[bulan.getMonth()]} {bulan.getFullYear()}
                </p>
                <button
                  type="button"
                  onClick={() => geser(1)}
                  disabled={diAkhir}
                  aria-label="Bulan berikutnya"
                  className="grid h-8 w-8 place-items-center rounded-lg text-white transition-colors hover:bg-white/10 disabled:opacity-20 motion-reduce:transition-none"
                >
                  <Icon icon="solar:alt-arrow-right-linear" />
                </button>
              </div>

              <div className="px-4 pb-2">
                <Bulan
                  tampil={bulan}
                  terpilih={terpilih}
                  min={batasBawah}
                  max={batasAtas}
                  onPilih={(d) => {
                    onUbah(keKunci(d));
                    setBuka(false);
                  }}
                />
              </div>

              {/* Kaki: pintasan yang paling sering dipakai, dan jalan keluar
                  untuk mengosongkan kembali. */}
              <div
                className={`flex items-center justify-between gap-2 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${LINE.row}`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onUbah("");
                    setBuka(false);
                  }}
                  disabled={!nilai}
                  className="rounded-lg px-2 py-2 text-[11px] font-bold text-white/60 underline transition-colors hover:text-white disabled:opacity-25 disabled:no-underline motion-reduce:transition-none"
                >
                  Kosongkan
                </button>
                <div className="flex items-center gap-1.5">
                  {[
                    { label: "Hari ini", hari: 0 },
                    { label: "Besok", hari: 1 },
                    { label: "+30 hari", hari: 30 },
                  ].map((p) => {
                    const d = new Date();
                    d.setHours(0, 0, 0, 0);
                    d.setDate(d.getDate() + p.hari);
                    const mati =
                      (batasBawah != null && d.getTime() < batasBawah.getTime()) ||
                      (batasAtas != null && d.getTime() > batasAtas.getTime());
                    return (
                      <button
                        key={p.label}
                        type="button"
                        disabled={mati}
                        onClick={() => {
                          onUbah(keKunci(d));
                          setBuka(false);
                        }}
                        className="rounded-lg border border-white/[0.12] px-2.5 py-1.5 text-[11px] font-bold text-white/75 transition-colors hover:border-white/30 hover:text-white disabled:opacity-25 motion-reduce:transition-none"
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

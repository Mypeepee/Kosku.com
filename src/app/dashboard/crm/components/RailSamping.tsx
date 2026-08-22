"use client";

// src/app/dashboard/crm/components/RailSamping.tsx
// ---------------------------------------------------------------------------
// PANEL TINDAKAN: dua tumpukan pendek yang menjawab "sekarang apa".
//
// KENAPA ADA PANEL TERPISAH, PADAHAL SEMUANYA SUDAH ADA DI DAFTAR.
// Daftar klien itu tempat MENCARI; panel ini tempat DIBERI TAHU. Bedanya
// nyata: untuk menemukan siapa yang telat di-follow-up lewat daftar, agent
// harus tahu dulu bahwa ada yang telat, lalu memilih saringan, lalu membaca.
// Panel menaruhnya di layar tanpa satu pun langkah itu.
//
// Isinya dibatasi empat baris. Panel yang bisa digulir sendiri berhenti jadi
// ringkasan dan berubah jadi daftar kedua yang bersaing dengan daftar utama;
// ekor "lihat N lainnya" memindahkan sisanya ke daftar itu dengan saringan yang
// sudah terpasang.
//
// KENAPA BERTAB, BUKAN DUA TUMPUKAN BERTINDIH.
// Kartu ini berdiri sebagai sel ketiga di baris grafik. Dua tumpukan bertindih
// membuatnya setinggi ~470 px sementara dua grafik di sebelahnya cuma ~250 px —
// dan karena sel dalam satu baris kisi saling menyamakan tinggi, kedua grafik
// itu ikut ditarik molor dan menyisakan 200 px ruang kosong masing-masing.
// Tab menaruh dua daftar di tempat yang sama, jadi kartunya setinggi SATU
// daftar, dan barisnya rapat tanpa ada yang dikorbankan.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Klien, RingkasanRekomendasi } from "./types";
import { TAHAP, angkaRingkas, inisial, jadwalFollowUp } from "./crmUi";
import { FOKUS, PEGAS_TEKAN, TIPE } from "./crmMotion";
import { Permukaan } from "./PanelStatistik";
import { SegmentedControl, type Segmen } from "./CrmPrimitives";

const BATAS = 4;

/**
 * Satu baris di dalam panel.
 *
 * Avatar dipakai lagi persis seperti di daftar utama — inisial yang sama, titik
 * tahap yang sama. Itu yang membuat "Bambang" di panel dan "Bambang" di daftar
 * terbaca sebagai orang yang sama, bukan dua entri yang kebetulan senama.
 */
function Baris({
  klien,
  kanan,
  onKlik,
  indeks,
}: {
  klien: Klien;
  kanan: React.ReactNode;
  onKlik: () => void;
  indeks: number;
}) {
  const kurangiGerak = useReducedMotion();
  const tahap = TAHAP[klien.status];

  return (
    <motion.li
      initial={kurangiGerak ? { opacity: 0 } : { opacity: 0, x: 6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        type: "spring",
        stiffness: 420,
        damping: 34,
        delay: kurangiGerak ? 0 : indeks * 0.04,
      }}
    >
      <motion.button
        onClick={onKlik}
        whileTap={kurangiGerak ? undefined : { scale: 0.98 }}
        transition={PEGAS_TEKAN}
        className={`flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left transition-colors hover:bg-white/[0.05] ${FOKUS}`}
      >
        <span className="relative shrink-0">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.08] text-[11px] font-semibold text-slate-200">
            {inisial(klien.nama)}
          </span>
          <span
            className={`absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full ring-[2px] ring-[#16181c] ${tahap.dot}`}
          />
        </span>

        <span className="min-w-0 flex-1">
          <span className={`${TIPE.sekunder} block truncate font-medium text-white`}>
            {klien.nama}
          </span>
          <span className={`${TIPE.mungil} block truncate text-slate-500`}>{tahap.label}</span>
        </span>

        {kanan}
      </motion.button>
    </motion.li>
  );
}

/**
 * Ekor tumpukan — memindahkan sisanya ke daftar utama dengan saringan terpasang,
 * bukan memperpanjang panel.
 */
function SelebihNya({ jumlah, onKlik }: { jumlah: number; onKlik: () => void }) {
  return (
    <li>
      <button
        onClick={onKlik}
        className={`${TIPE.mungil} mt-0.5 flex w-full items-center justify-center gap-1 rounded-[10px] px-2 py-1.5 font-medium text-emerald-400 transition-colors hover:bg-emerald-500/10 ${FOKUS}`}
      >
        Lihat {jumlah} lainnya
        <Icon icon="solar:alt-arrow-right-linear" className="text-[13px]" />
      </button>
    </li>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PANEL
   ══════════════════════════════════════════════════════════════════ */

type Tab = "agenda" | "kiriman";

export default function RailSamping({
  items,
  rekomendasi,
  onBuka,
  onLihatSemuaFollowUp,
  onLihatSemuaKiriman,
}: {
  items: Klien[];
  rekomendasi: Record<string, RingkasanRekomendasi>;
  onBuka: (k: Klien, tab?: "rekomendasi") => void;
  onLihatSemuaFollowUp: () => void;
  onLihatSemuaKiriman: () => void;
}) {
  const [tab, setTab] = useState<Tab>("agenda");

  /* ── Agenda ──
     Yang terlambat naik lebih dulu, lalu yang jatuh tempo paling dekat. Klien
     yang sudah closing atau lost tidak ikut: janji yang tertinggal di sana
     bukan pekerjaan yang harus dikejar hari ini. */
  const agenda = items
    .filter(
      (k) =>
        k.tanggal_follow_up &&
        k.status !== "closing" &&
        k.status !== "lost_iseng" &&
        (jadwalFollowUp(k.tanggal_follow_up)?.mendesak ||
          new Date(k.tanggal_follow_up).getTime() - Date.now() < 7 * 86_400_000),
    )
    .sort(
      (a, b) => new Date(a.tanggal_follow_up!).getTime() - new Date(b.tanggal_follow_up!).getTime(),
    );

  /* ── Bahan kiriman ──
     Turun harga dikalikan sepuluh dalam pengurutan: klien sudah pernah melihat
     barangnya dan yang berubah cuma angkanya — alasan menelepon yang jauh lebih
     kuat daripada sekadar "ada properti baru". */
  const kiriman = items
    .map((k) => ({ k, r: rekomendasi[k.id_klien] }))
    .filter((x) => x.r && x.r.baru + x.r.turun_harga > 0)
    .sort((a, b) => b.r!.turun_harga * 10 + b.r!.baru - (a.r!.turun_harga * 10 + a.r!.baru));

  const adaTerlambat = agenda.some((k) => jadwalFollowUp(k.tanggal_follow_up)?.terlambat);

  const segmen: Segmen<Tab>[] = [
    { nilai: "agenda", label: "Agenda", jumlah: agenda.length },
    { nilai: "kiriman", label: "Kiriman", jumlah: kiriman.length },
  ];

  return (
    <Permukaan kelas="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-[8px] ${
            adaTerlambat && tab === "agenda"
              ? "bg-rose-500/15 text-rose-300"
              : "bg-emerald-500/15 text-emerald-300"
          }`}
        >
          <Icon
            icon={
              tab === "agenda"
                ? "solar:calendar-mark-bold-duotone"
                : "solar:magic-stick-3-bold-duotone"
            }
            className="text-[13px]"
          />
        </span>
        <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.01em] text-white">
          Perlu ditindak
        </h3>
      </div>

      <div className="mb-2">
        <SegmentedControl segmen={segmen} nilai={tab} onChange={setTab} ukuran="kecil" />
      </div>

      {tab === "agenda" ? (
        agenda.length === 0 ? (
          <Hampa
            icon="solar:calendar-mark-linear"
            teks="Tidak ada janji dalam sepekan ke depan."
          />
        ) : (
          <ul className="-mx-2">
            {agenda.slice(0, BATAS).map((k, i) => {
              const j = jadwalFollowUp(k.tanggal_follow_up)!;
              return (
                <Baris
                  key={k.id_klien}
                  klien={k}
                  indeks={i}
                  onKlik={() => onBuka(k)}
                  kanan={
                    /* `whitespace-nowrap`: "Terlambat 53 hari" membungkus jadi
                       dua baris di kolom sempit, dan daftar pendek yang tinggi
                       barisnya tidak seragam terbaca berantakan. */
                    <span
                      className={`${TIPE.mungil} shrink-0 whitespace-nowrap text-right font-medium ${
                        j.terlambat
                          ? "text-rose-300"
                          : j.mendesak
                            ? "text-amber-300"
                            : "text-slate-500"
                      }`}
                    >
                      {j.teks}
                    </span>
                  }
                />
              );
            })}
            {agenda.length > BATAS && (
              <SelebihNya jumlah={agenda.length - BATAS} onKlik={onLihatSemuaFollowUp} />
            )}
          </ul>
        )
      ) : kiriman.length === 0 ? (
        <Hampa
          icon="solar:magic-stick-3-linear"
          teks="Belum ada properti baru yang cocok dengan kriteria klien."
        />
      ) : (
        <ul className="-mx-2">
          {kiriman.slice(0, BATAS).map(({ k, r }, i) => (
            <Baris
              key={k.id_klien}
              klien={k}
              indeks={i}
              onKlik={() => onBuka(k, "rekomendasi")}
              kanan={
                <span
                  className={`${TIPE.mungil} inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0.5 font-medium ${
                    r!.turun_harga > 0
                      ? "border-amber-400/30 bg-amber-500/15 text-amber-200"
                      : "border-emerald-400/25 bg-emerald-500/15 text-emerald-200"
                  }`}
                >
                  <Icon
                    icon={
                      r!.turun_harga > 0
                        ? "solar:graph-down-linear"
                        : "solar:magic-stick-3-linear"
                    }
                    className="text-[12px]"
                  />
                  {angkaRingkas(r!.turun_harga > 0 ? r!.turun_harga : r!.baru)}
                </span>
              }
            />
          ))}
          {kiriman.length > BATAS && (
            <SelebihNya jumlah={kiriman.length - BATAS} onKlik={onLihatSemuaKiriman} />
          )}
        </ul>
      )}
    </Permukaan>
  );
}

/** Keadaan kosong sebuah tab — menjelaskan, bukan sekadar bilang "kosong". */
function Hampa({ icon, teks }: { icon: string; teks: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
      <Icon icon={icon} className="text-[22px] text-slate-600" />
      <p className={`${TIPE.mungil} max-w-[26ch] text-slate-500`}>{teks}</p>
    </div>
  );
}

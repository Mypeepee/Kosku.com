"use client";

// src/app/dashboard/crm/components/PanelStatistik.tsx
// ---------------------------------------------------------------------------
// LAPISAN RINGKASAN di puncak CRM: satu baris KPI, lalu dua grafik.
//
// PEMBAGIAN TUGAS YANG JADI TULANG PUNGGUNG SUSUNAN INI
//
// Versi pertama panel ini memberi SETIAP kartu KPI visualnya sendiri —
// sparkline di satu kartu, meter di kartu lain, cincin di kartu ketiga.
// Hasilnya empat kotak yang sama-sama berteriak, dan tak satu pun grafiknya
// cukup besar untuk benar-benar terbaca. Susunan sekarang membagi tugas:
//
//   • KARTU KPI = ANGKA. Label, angka, satu baris pembanding. Titik. Tugasnya
//     dibaca dalam seperempat detik, dan apa pun yang ditambahkan ke dalamnya
//     justru memperlambat itu. Hanya satu kartu yang punya visual — cincin
//     konversi di kartu Closing, karena "2 closing" tanpa "dari 12 klien"
//     memang tidak bermakna.
//
//   • GRAFIK = BENTUK. Dua grafik berukuran layak di bawahnya: sebaran
//     pipeline (donut, part-to-whole) dan klien masuk per bulan (area, tren).
//     Keduanya cukup besar untuk punya sumbu, legenda bernilai, dan tooltip.
//
// ATURAN YANG DIPEGANG DI SELURUH BERKAS INI
//
//  • ANGKA BESAR MEMAKAI ANGKA PROPORSIONAL, BUKAN `tabular-nums`. Angka
//    tabular memberi setiap digit lebar "0"; pada ukuran 27 px, "121" jadi
//    terlihat renggang. Tabular hanya untuk kolom yang harus lurus ke bawah —
//    di sini cuma legenda donut yang begitu.
//
//  • TEKS TIDAK PERNAH MEMAKAI WARNA DATA. Warna tahap dipakai oleh BIDANG
//    (irisan donut, titik legenda); labelnya tetap memakai warna teks biasa.
//    Kuning di atas hitam terbaca sebagai bidang, nyaris tidak sebagai huruf.
//
//  • PEMISAH ANTAR IRISAN ADALAH CELAH, BUKAN GARIS TEPI. Irisan donut
//    dipisahkan celah berwarna kartu. Garis tepi menambah tinta yang bukan
//    data; celah memisahkan tanpa menambah apa pun.
// ---------------------------------------------------------------------------

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { KlienStatus } from "./types";
import { TAHAP, URUTAN_TAHAP, rupiahRingkas } from "./crmUi";
import { FOKUS, GARIS, PEGAS_TEKAN, TIPE, WARNA } from "./crmMotion";

/* ══════════════════════════════════════════════════════════════════
   BENTUK DATA
   ══════════════════════════════════════════════════════════════════ */

export interface Statistik {
  total: number;
  klienAktif: number;
  /** Per tahap: berapa orang, dan berapa rupiah yang mereka bawa. */
  perTahap: Record<KlienStatus, { jumlah: number; nilai: number }>;
  nilaiPipeline: number;
  nilaiClosing: number;
  /** Klien aktif yang budgetnya belum diisi — penjelas kenapa pipeline kecil. */
  tanpaBudget: number;
  jumlahClosing: number;
  followUp: { terlambat: number; hariIni: number };
  tren: { bulan: string; jumlah: number }[];
  bulanIni: number;
  bulanLalu: number;
}

const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "2026-08" → "Agu". */
function labelBulan(kunci: string): string {
  const n = parseInt(kunci.split("-")[1] ?? "1", 10);
  return BULAN_PENDEK[n - 1] ?? "";
}

/* ══════════════════════════════════════════════════════════════════
   ANGKA YANG BERJALAN NAIK
   ══════════════════════════════════════════════════════════════════ */

/**
 * Angka yang dihitung naik dari nol saat pertama terlihat.
 *
 * Bukan hiasan: gerakan itu menandai bahwa nilainya BARU DIHITUNG, bukan sisa
 * render sebelumnya. Saat agent menekan "sinkronkan" dan angkanya berlari lagi,
 * ia tahu datanya benar-benar dimuat ulang tanpa perlu spinner.
 *
 * Durasinya tetap di bawah 0,9 detik. Lebih lama dari itu, orang yang datang
 * untuk membaca satu angka malah menunggu — dan menunggu angka adalah bentuk
 * animasi paling menyebalkan yang ada.
 */
function AngkaBerjalan({
  nilai,
  format = (n) => Math.round(n).toLocaleString("id-ID"),
}: {
  nilai: number;
  format?: (n: number) => string;
}) {
  const kurangiGerak = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const terlihat = useInView(ref, { once: true, margin: "-40px" });
  const mv = useMotionValue(0);
  const teks = useTransform(mv, (v) => format(v));

  useEffect(() => {
    if (!terlihat) return;
    if (kurangiGerak) {
      mv.set(nilai);
      return;
    }
    const kendali = animate(mv, nilai, {
      duration: Math.min(0.9, 0.35 + Math.log10(Math.max(nilai, 1)) * 0.14),
      ease: [0.22, 1, 0.36, 1],
    });
    return () => kendali.stop();
  }, [nilai, terlihat, kurangiGerak, mv]);

  return (
    <span ref={ref}>
      {/* Nilai akhir tetap ditulis untuk pembaca layar; yang beranimasi hanya
          bayangan visualnya. */}
      <span className="sr-only">{format(nilai)}</span>
      <motion.span aria-hidden>{teks as unknown as MotionValue<string>}</motion.span>
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════
   KERANGKA KARTU
   ══════════════════════════════════════════════════════════════════ */

/**
 * Permukaan kartu yang dipakai seluruh panel — KPI maupun grafik.
 *
 * Kilau setipis rambut di tepi atas itu yang membuat kartu terbaca sebagai
 * benda yang TERANGKAT dari halaman, bukan tambalan warna yang kebetulan beda.
 * Ia meniru cara cahaya jatuh di tepi atas permukaan fisik; satu piksel, tapi
 * tanpanya seluruh dasbor terasa rata.
 */
export function Permukaan({
  children,
  kelas = "",
  aksen,
}: {
  children: React.ReactNode;
  kelas?: string;
  aksen?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[16px] border ${
        aksen
          ? "border-emerald-400/20 bg-[#16181c] bg-gradient-to-br from-emerald-500/[0.14] via-emerald-500/[0.03] to-transparent"
          : `${GARIS} bg-[#16181c]`
      } ${kelas}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
      />
      {children}
    </div>
  );
}

/** Judul sebuah kartu grafik, dengan slot aksi di kanan. */
function KepalaKartu({
  judul,
  keterangan,
  kanan,
}: {
  judul: string;
  keterangan?: React.ReactNode;
  kanan?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-white">{judul}</h3>
        {keterangan && <p className={`${TIPE.mungil} mt-0.5 text-slate-500`}>{keterangan}</p>}
      </div>
      {kanan}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   KARTU KPI
   ══════════════════════════════════════════════════════════════════ */

/**
 * Satu angka, satu pembanding. Tidak ada grafik di dalamnya.
 *
 * `samping` hanya dipakai sekali di seluruh panel — cincin konversi di kartu
 * Closing. Kalau slot ini mulai terisi di tiga kartu, susunannya sudah kembali
 * jadi versi lama yang ditinggalkan: empat kotak yang sama-sama sibuk.
 */
function KartuKpi({
  label,
  icon,
  aksen,
  nilai,
  keterangan,
  samping,
  indeks,
}: {
  label: string;
  icon: string;
  aksen?: boolean;
  nilai: React.ReactNode;
  keterangan?: React.ReactNode;
  samping?: React.ReactNode;
  indeks: number;
}) {
  const kurangiGerak = useReducedMotion();
  return (
    <motion.div
      initial={kurangiGerak ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 32,
        delay: kurangiGerak ? 0 : indeks * 0.05,
      }}
    >
      <Permukaan aksen={aksen} kelas="h-full">
        <div className="flex h-full items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Icon
                icon={icon}
                className={`shrink-0 text-[14px] ${aksen ? "text-emerald-400" : "text-slate-500"}`}
              />
              <p className={`${TIPE.mungil} truncate font-medium text-slate-400`}>{label}</p>
            </div>

            {/* Angka besar TIDAK memakai tabular-nums — lihat catatan di kepala
                berkas. Tracking dirapatkan karena angka besar dengan jarak
                normal terlihat berantakan. */}
            <p className="mt-1.5 truncate text-[24px] font-semibold leading-none tracking-[-0.03em] text-white sm:text-[27px]">
              {nilai}
            </p>

            {/* Keterangan TURUN BARIS, tidak dipotong: di lebar dua kolom pada
                ponsel, `truncate` memotong "belum ada yang tutup" jadi "belum
                ada y…" — kalimat terpotong lebih buruk daripada kartu yang
                tumbuh satu baris, apalagi karena kisi menyamakan tinggi baris. */}
            {keterangan && (
              <div className={`${TIPE.mungil} mt-2 leading-[1.35] text-slate-500`}>{keterangan}</div>
            )}
          </div>
          {samping}
        </div>
      </Permukaan>
    </motion.div>
  );
}

/** Panah + angka perubahan. Hijau hanya bila arahnya memang kabar baik. */
function Delta({ nilai, satuan = "vs bulan lalu" }: { nilai: number; satuan?: string }) {
  if (nilai === 0) return <span>tetap {satuan}</span>;
  const naik = nilai > 0;
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold ${
          naik ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-500/15 text-slate-300"
        }`}
      >
        <Icon
          icon={naik ? "solar:arrow-right-up-linear" : "solar:arrow-right-down-linear"}
          className="text-[12px]"
        />
        {naik ? "+" : ""}
        {nilai}
      </span>
      <span>{satuan}</span>
    </span>
  );
}

/**
 * Cincin konversi kecil di sisi angka closing.
 *
 * Jalur kosongnya memakai warna isian pada opasitas rendah, bukan abu netral —
 * dengan begitu "hampir penuh" dan "hampir kosong" sama-sama terbaca sebagai
 * satu cincin utuh, bukan dua benda berbeda.
 */
function Cincin({ persen }: { persen: number }) {
  const kurangiGerak = useReducedMotion();
  const p = Math.max(0, Math.min(100, persen));
  const r = 19;
  const keliling = 2 * Math.PI * r;

  return (
    <div className="relative shrink-0" aria-hidden>
      <svg width="46" height="46" viewBox="0 0 46 46" className="-rotate-90">
        <circle cx="23" cy="23" r={r} fill="none" stroke="#34d39926" strokeWidth="4" />
        <motion.circle
          cx="23"
          cy="23"
          r={r}
          fill="none"
          stroke="#34d399"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={keliling}
          initial={kurangiGerak ? false : { strokeDashoffset: keliling }}
          animate={{ strokeDashoffset: keliling * (1 - p / 100) }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[11px] font-semibold tabular-nums text-emerald-300">
        {Math.round(p)}%
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   DONUT — SEBARAN PIPELINE
   ══════════════════════════════════════════════════════════════════ */

/**
 * Satu irisan donut.
 *
 * Digambar sebagai lingkaran ber-`strokeDasharray`, bukan `<path>` busur.
 * Alasannya praktis: busur menuntut trigonometri untuk tiap ujung dan punya
 * kasus tepi yang menyusahkan pada sudut di atas 180°, sedangkan dasharray
 * cuma butuh panjang keliling — dan panjang itu bisa dianimasikan dari nol
 * tanpa satu pun perhitungan tambahan.
 */
function Irisan({
  keliling,
  panjang,
  mulai,
  warna,
  radius,
  tebal,
  redup,
  tunda,
  onClick,
  judul,
}: {
  keliling: number;
  panjang: number;
  mulai: number;
  warna: string;
  radius: number;
  tebal: number;
  redup: boolean;
  tunda: number;
  onClick?: () => void;
  judul: string;
}) {
  const kurangiGerak = useReducedMotion();
  const maju = useMotionValue(kurangiGerak ? 1 : 0);
  const dash = useTransform(maju, (t) => `${panjang * t} ${keliling - panjang * t}`);

  useEffect(() => {
    if (kurangiGerak) {
      maju.set(1);
      return;
    }
    const k = animate(maju, 1, { duration: 0.7, delay: tunda, ease: [0.22, 1, 0.36, 1] });
    return () => k.stop();
  }, [maju, kurangiGerak, tunda, panjang]);

  return (
    <motion.circle
      cx="0"
      cy="0"
      r={radius}
      fill="none"
      stroke={warna}
      strokeWidth={tebal}
      style={{ strokeDasharray: dash }}
      strokeDashoffset={-mulai}
      opacity={redup ? 0.28 : 1}
      onClick={onClick}
      className={onClick ? "cursor-pointer transition-opacity" : "transition-opacity"}
    >
      <title>{judul}</title>
    </motion.circle>
  );
}

/**
 * Sebaran klien per tahap — donut dengan legenda bernilai, sekaligus penyaring.
 *
 * KENAPA DONUT, PADAHAL TAHAP ITU BERURUTAN. Donut biasanya salah untuk data
 * berurutan karena urutannya hilang. Di sini tidak: irisan disusun searah jarum
 * jam mulai dari pukul 12 mengikuti urutan pipeline, jadi urutannya justru
 * terbaca sebagai perjalanan mengelilingi lingkaran. Syarat lain juga
 * terpenuhi — lima irisan (batas wajarnya enam), dan angka pastinya tidak
 * digantungkan pada perbandingan sudut karena legenda menuliskannya.
 *
 * Legenda memuat DUA angka per tahap: berapa orang, dan berapa rupiah. Jumlah
 * orang menjelaskan lebar irisan; rupiah menjelaskan kenapa tahap berisi dua
 * orang bisa lebih berharga daripada tahap berisi sepuluh.
 */
function DonutPipeline({
  perTahap,
  total,
  aktif,
  onPilih,
}: {
  perTahap: Record<KlienStatus, { jumlah: number; nilai: number }>;
  total: number;
  aktif: KlienStatus | null;
  onPilih: (s: KlienStatus) => void;
}) {
  const kurangiGerak = useReducedMotion();
  const R = 52;
  const TEBAL = 20;
  const KELILING = 2 * Math.PI * R;
  /** Celah pemisah, dalam satuan panjang keliling. */
  const CELAH = 4;

  const terisi = URUTAN_TAHAP.filter((s) => perTahap[s].jumlah > 0);

  const irisan = useMemo(() => {
    let jalan = 0;
    return terisi.map((s) => {
      const penuh = (perTahap[s].jumlah / total) * KELILING;
      const mulai = jalan;
      jalan += penuh;
      return {
        status: s,
        mulai,
        // Irisan tunggal tidak diberi celah: cincin utuh yang dipotong 4 px
        // terlihat seperti cacat render, bukan seperti pemisah.
        panjang: terisi.length === 1 ? penuh : Math.max(penuh - CELAH, 2),
      };
    });
  }, [terisi, perTahap, total, KELILING]);

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
      {/* ── Cincin ── */}
      <div className="relative shrink-0">
        <svg
          width="148"
          height="148"
          viewBox="-74 -74 148 148"
          role="img"
          aria-label="Sebaran klien per tahap"
        >
          {/* Jalur kosong: satu langkah di atas warna kartu, sehingga cincin
              tetap terbaca sebagai lingkaran utuh walau datanya cuma satu
              tahap. */}
          <circle cx="0" cy="0" r={R} fill="none" stroke="#ffffff0f" strokeWidth={TEBAL} />
          <g transform="rotate(-90)">
            {irisan.map((it, i) => (
              <Irisan
                key={it.status}
                keliling={KELILING}
                panjang={it.panjang}
                mulai={it.mulai}
                radius={R}
                tebal={TEBAL}
                warna={TAHAP[it.status].mark}
                redup={aktif !== null && aktif !== it.status}
                tunda={kurangiGerak ? 0 : 0.1 + i * 0.08}
                onClick={() => onPilih(it.status)}
                judul={`${TAHAP[it.status].label}: ${perTahap[it.status].jumlah} klien`}
              />
            ))}
          </g>
        </svg>

        {/* Angka di pusat cincin. Donut punya lubang; membiarkannya kosong
            berarti membuang tempat paling menonjol di seluruh grafik. */}
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <p className="text-[26px] font-semibold leading-none tracking-[-0.03em] text-white">
            <AngkaBerjalan nilai={total} />
          </p>
          <p className={`${TIPE.mungil} mt-1 text-slate-500`}>klien</p>
        </div>
      </div>

      {/* ── Legenda bernilai, sekaligus penyaring ──
          Jumlah kolomnya naik-turun, dan urutannya memang tidak berurutan:
          DUA kolom di ponsel dan di 2xl, SATU kolom di antaranya.

          Yang menentukan bukan lebar layar, tapi lebar kartu ini sendiri. Di
          ponsel kartu memakai selebar layar dan cincinnya duduk di ATAS
          legenda, jadi legenda dapat 358 px penuh — lima baris bertumpuk di
          sana membuat kartunya setinggi 570 px tanpa alasan. Di xl kartu
          menyusut jadi ~360 px DAN cincin pindah ke sampingnya, menyisakan
          legenda ~200 px; dipaksa dua kolom, "Hot Buyer" tidak muat utuh. Di
          2xl kartunya cukup lebar untuk keduanya lagi. */}
      <div className="grid w-full min-w-0 grid-cols-2 gap-x-4 gap-y-0.5 xl:grid-cols-1 2xl:grid-cols-2">
        {URUTAN_TAHAP.map((s) => {
          const t = TAHAP[s];
          const d = perTahap[s];
          const dipilih = aktif === s;
          return (
            <motion.button
              key={s}
              onClick={() => onPilih(s)}
              whileTap={kurangiGerak ? undefined : { scale: 0.97 }}
              transition={PEGAS_TEKAN}
              aria-pressed={dipilih}
              className={`flex items-center gap-2 rounded-[9px] px-2 py-1.5 text-left transition-colors ${FOKUS} ${
                dipilih ? "bg-white/[0.09]" : "hover:bg-white/[0.05]"
              }`}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: t.mark, opacity: d.jumlah === 0 && !dipilih ? 0.35 : 1 }}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-1.5">
                  <span
                    className={`truncate text-[13px] font-medium ${
                      dipilih ? "text-white" : "text-slate-300"
                    }`}
                  >
                    {t.label}
                  </span>
                  {/* Kolom angka: DI SINI tabular-nums memang benar, karena
                      lima baris angka harus lurus ke bawah. */}
                  <span className="text-[13px] tabular-nums text-slate-500">{d.jumlah}</span>
                </span>
                <span className={`${TIPE.mungil} block truncate tabular-nums text-slate-500`}>
                  {d.nilai > 0 ? rupiahRingkas(d.nilai) : "—"}
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   AREA — KLIEN MASUK PER BULAN
   ══════════════════════════════════════════════════════════════════ */

/**
 * Tren klien baru 12 bulan terakhir.
 *
 * Satu deret, jadi TIDAK ada kotak legenda: judul kartu sudah menyebut apa yang
 * digambar, dan kotak legenda berisi satu contoh warna hanya mengulang judul
 * sambil memakan ruang.
 *
 * Grafik HTML/SVG pada dasarnya interaktif, jadi ia dikirim dengan lapisan
 * sorot: garis bidik + tooltip mengikuti bulan terdekat dari kursor. Tanpa itu,
 * nilai tiap bulan cuma bisa ditebak dari tinggi garis — dan menebak adalah
 * pekerjaan yang seharusnya dikerjakan grafik, bukan pembacanya.
 */
function AreaKlienMasuk({ tren }: { tren: { bulan: string; jumlah: number }[] }) {
  const kurangiGerak = useReducedMotion();
  /* Id gradien harus unik per contoh komponen. `<defs>` hidup di ruang nama
     global dokumen: dua grafik dengan id sama membuat yang kedua mengacu ke
     gradien milik yang pertama — dan bila yang pertama dilepas dari DOM,
     isian yang kedua hilang tanpa pesan kesalahan apa pun. */
  const idGradien = `crm-area-${useId().replace(/:/g, "")}`;
  const [sorot, setSorot] = useState<number | null>(null);
  const wadah = useRef<HTMLDivElement>(null);

  const L = 300;
  /* Tinggi 180, bukan 132.
     Kartu ini berdiri sebaris dengan kartu donut yang setinggi ~330 px karena
     legendanya lima baris. Sel dalam satu baris kisi saling menyamakan tinggi,
     jadi grafik 132 px meninggalkan 110 px kosong di dasar kartunya — ruang
     yang lebih baik dipakai grafiknya sendiri, karena naik-turun antar bulan
     jadi jauh lebih terbaca pada bidang yang lebih tinggi. */
  const T = 180;
  const PAD_B = 16; // ruang di bawah garis dasar
  /* Sisa 10 unit di kiri-kanan: titik penanda bulan terakhir berdiameter 8 px
     plus cincin 2 px, dan tanpa jarak ini separuhnya tergunting tepi kartu. */
  const PAD_X = 10;

  const { garis, area, titik, maks } = useMemo(() => {
    const nilai = tren.map((t) => t.jumlah);
    /* Skala dibulatkan ke atas ke angka bersih supaya garis panduan jatuh di
       nilai yang layak dibaca (5 / 10 / 20), bukan di 17 atau 23. */
    const puncak = Math.max(...nilai, 1);
    const langkah = puncak <= 5 ? 1 : puncak <= 20 ? 5 : puncak <= 50 ? 10 : 25;
    const maks = Math.ceil(puncak / langkah) * langkah;

    const tinggiPlot = T - PAD_B - 12;
    const titik = nilai.map((v, i) => {
      const x = PAD_X + (i / Math.max(nilai.length - 1, 1)) * (L - PAD_X * 2);
      const y = 12 + tinggiPlot - (v / maks) * tinggiPlot;
      return [x, y] as [number, number];
    });

    /* Catmull–Rom → Bézier kubik. Garis patah antar-bulan membuat data bulanan
       terlihat lebih bergejolak daripada kenyataannya; kurva halus terbaca
       sebagai kecenderungan, dan kecenderungan itulah isi grafik ini. */
    const d = titik.reduce((acc, p, i, arr) => {
      if (i === 0) return `M ${p[0]} ${p[1]}`;
      const p0 = arr[i - 2] ?? arr[i - 1];
      const p1 = arr[i - 1];
      const p3 = arr[i + 1] ?? p;
      const c1 = [p1[0] + (p[0] - p0[0]) / 6, p1[1] + (p[1] - p0[1]) / 6];
      const c2 = [p[0] - (p3[0] - p1[0]) / 6, p[1] - (p3[1] - p1[1]) / 6];
      return `${acc} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p[0]} ${p[1]}`;
    }, "");

    const dasar = T - PAD_B;
    return {
      garis: d,
      area: `${d} L ${titik[titik.length - 1][0]} ${dasar} L ${titik[0][0]} ${dasar} Z`,
      titik,
      maks,
    };
  }, [tren]);

  /** Bulan terdekat dari kursor, dihitung dari posisi relatif di dalam wadah. */
  function lacak(e: React.MouseEvent<HTMLDivElement>) {
    const kotak = wadah.current?.getBoundingClientRect();
    if (!kotak) return;
    const rasio = (e.clientX - kotak.left) / kotak.width;
    const i = Math.round(rasio * (tren.length - 1));
    setSorot(Math.max(0, Math.min(tren.length - 1, i)));
  }

  const aktif = sorot === null ? null : tren[sorot];
  const pAktif = sorot === null ? null : titik[sorot];
  const terakhir = titik[titik.length - 1];

  return (
    <div>
      <div ref={wadah} onMouseMove={lacak} onMouseLeave={() => setSorot(null)} className="relative">
        <svg viewBox={`0 0 ${L} ${T}`} preserveAspectRatio="none" className="h-[180px] w-full">
          <defs>
            <linearGradient id={idGradien} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={WARNA.aksen} stopOpacity="0.26" />
              <stop offset="100%" stopColor={WARNA.aksen} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Garis panduan mendatar — setipis mungkin dan tanpa putus-putus.
              Garis putus-putus menarik perhatian ke dirinya sendiri; panduan
              justru harus jadi hal yang paling tidak terlihat di grafik. */}
          {[0, 0.5, 1].map((f) => {
            const y = 12 + (T - PAD_B - 12) * f;
            return (
              <line
                key={f}
                x1={0}
                y1={y}
                x2={L}
                y2={y}
                stroke="#ffffff"
                strokeOpacity={0.06}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          <motion.path
            d={area}
            fill={`url(#${idGradien})`}
            initial={kurangiGerak ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          />
          {/* `vectorEffect` menjaga tebal garis tetap 2 px walau viewBox
              diregangkan mengikuti lebar kartu. Tanpa ini, garis ikut memipih. */}
          <motion.path
            d={garis}
            fill="none"
            stroke={WARNA.aksen}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            initial={kurangiGerak ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          />

          {/* Garis bidik. Garis boleh tinggal di dalam SVG yang teregang —
              `vectorEffect` menjaga tebalnya tetap 1 px. Titik bulat TIDAK,
              lihat catatan di bawah. */}
          {pAktif && (
            <line
              x1={pAktif[0]}
              y1={12}
              x2={pAktif[0]}
              y2={T - PAD_B}
              stroke="#ffffff"
              strokeOpacity={0.25}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* ── TITIK PENANDA, DIGAMBAR SEBAGAI HTML ──
            Bukan sebagai <circle> di dalam SVG, dan ini bukan selera.
            `preserveAspectRatio="none"` meregangkan viewBox 300 unit menjadi
            selebar kartu — sekitar 460 px — sehingga satu unit mendatar jadi
            1,5× lebih panjang daripada satu unit menegak. Lingkaran ber-r=4 di
            dalamnya keluar sebagai ELIPS yang penyok. `vectorEffect` menolong
            garis, tapi ia hanya mengatur tebal goresan, bukan bentuk isian.
            Elemen HTML yang diposisikan dalam persen kebal terhadap peregangan
            itu, jadi titiknya bulat di lebar berapa pun. */}
        {(() => {
          const p = pAktif ?? terakhir;
          return (
            <motion.span
              key={sorot === null ? "kini" : "sorot"}
              aria-hidden
              initial={kurangiGerak ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, delay: sorot === null ? 0.75 : 0 }}
              className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[#16181c]"
              style={{
                /* SVG-nya membentang persis selebar & setinggi wadah ini, jadi
                   koordinat viewBox tinggal dibagi ukuran viewBox untuk jadi
                   persen — tanpa perlu tahu berapa piksel lebarnya sekarang. */
                left: `${(p[0] / L) * 100}%`,
                top: `${(p[1] / T) * 100}%`,
                backgroundColor: WARNA.aksen,
              }}
            />
          );
        })()}

        {/* Tooltip berupa HTML, bukan <text> di dalam SVG: teks SVG ikut
            teregang oleh `preserveAspectRatio="none"` dan hurufnya jadi gepeng.
            Posisinya dijepit 6%–94% supaya kotaknya tidak menggantung keluar
            kartu saat kursor berada di bulan pertama atau terakhir. */}
        {aktif && sorot !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2"
            style={{
              /* Rumus yang sama dengan titik penanda, lalu dijepit 8%–92% agar
                 kotaknya tidak menggantung keluar kartu di bulan tepi. */
              left: `${Math.min(92, Math.max(8, (titik[sorot][0] / L) * 100))}%`,
            }}
          >
            <div className="whitespace-nowrap rounded-lg border border-white/10 bg-[#1e2126] px-2.5 py-1.5 text-center shadow-[0_6px_24px_rgba(0,0,0,0.5)]">
              <p className="text-[13px] font-semibold tabular-nums text-white">{aktif.jumlah}</p>
              <p className="text-[11px] text-slate-400">{labelBulan(aktif.bulan)}</p>
            </div>
          </div>
        )}

        {/* Skala sumbu Y hanya satu angka: nol tersirat di dasar, puncaknya di
            atas. Menuliskan lima tingkat pada grafik setinggi 132 px hanya
            menambah tinta tanpa menambah ketelitian yang bisa dipakai. */}
        <span className={`${TIPE.mungil} absolute left-0 top-0 tabular-nums text-slate-600`}>
          {maks}
        </span>
      </div>

      {/* Label bulan: hanya empat, berjarak sama. Dua belas label pada lebar
          300 px akan bertumpuk dan tak satu pun terbaca. */}
      <div className={`${TIPE.mungil} mt-1 flex justify-between tabular-nums text-slate-600`}>
        {[0, 4, 8, 11].map((i) => (
          <span key={i}>{labelBulan(tren[i]?.bulan ?? "")}</span>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PANEL
   ══════════════════════════════════════════════════════════════════ */

export default function PanelStatistik({
  stat,
  muat,
  tahapAktif,
  onPilihTahap,
  panelTindakan,
}: {
  stat: Statistik | null;
  muat: boolean;
  tahapAktif: KlienStatus | null;
  onPilihTahap: (s: KlienStatus) => void;
  /**
   * Kartu agenda, ditaruh sebagai sel KETIGA di baris grafik.
   *
   * Ia dititipkan dari luar alih-alih dirender di sini karena isinya berasal
   * dari daftar klien, bukan dari statistik — dan panel ini sengaja tidak tahu
   * apa-apa soal daftar. Yang diatur di sini cuma tempatnya berdiri.
   */
  panelTindakan?: React.ReactNode;
}) {
  if (muat && !stat) return <RangkaPanel panelTindakan={panelTindakan} />;
  if (!stat) return null;

  const {
    total,
    klienAktif,
    perTahap,
    nilaiPipeline,
    nilaiClosing,
    tanpaBudget,
    jumlahClosing,
    followUp,
    tren,
    bulanIni,
    bulanLalu,
  } = stat;

  const konversi = total > 0 ? (jumlahClosing / total) * 100 : 0;
  const perluTindakan = followUp.terlambat + followUp.hariIni;

  return (
    <div className="space-y-3">
      {/* ══ BARIS KPI ══ */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KartuKpi
          indeks={0}
          label="Total klien"
          icon="solar:users-group-rounded-bold-duotone"
          nilai={<AngkaBerjalan nilai={total} />}
          keterangan={<Delta nilai={bulanIni - bulanLalu} />}
        />

        <KartuKpi
          indeks={1}
          aksen
          label="Nilai pipeline"
          icon="solar:wallet-money-bold-duotone"
          nilai={
            nilaiPipeline > 0 ? (
              <AngkaBerjalan nilai={nilaiPipeline} format={(n) => rupiahRingkas(n)} />
            ) : (
              "—"
            )
          }
          keterangan={
            tanpaBudget > 0 ? (
              <>
                dari {klienAktif} klien aktif ·{" "}
                <span className="text-amber-300/80">{tanpaBudget} tanpa budget</span>
              </>
            ) : (
              <>potensi dari {klienAktif} klien aktif</>
            )
          }
        />

        <KartuKpi
          indeks={2}
          label="Closing"
          icon="solar:cup-star-bold-duotone"
          nilai={<AngkaBerjalan nilai={jumlahClosing} />}
          keterangan={
            nilaiClosing > 0 ? <>senilai {rupiahRingkas(nilaiClosing)}</> : <>belum ada yang tutup</>
          }
          samping={<Cincin persen={konversi} />}
        />

        <KartuKpi
          indeks={3}
          label="Perlu tindakan"
          icon="solar:bell-bing-bold-duotone"
          nilai={
            <span className={followUp.terlambat > 0 ? "text-rose-300" : undefined}>
              <AngkaBerjalan nilai={perluTindakan} />
            </span>
          }
          keterangan={
            perluTindakan > 0 ? (
              <span className="inline-flex flex-wrap items-center gap-x-1.5">
                {followUp.terlambat > 0 && (
                  <span className="rounded-md bg-rose-500/15 px-1.5 py-0.5 font-semibold text-rose-300">
                    {followUp.terlambat} terlambat
                  </span>
                )}
                {followUp.hariIni > 0 && <span>{followUp.hariIni} jatuh hari ini</span>}
              </span>
            ) : (
              <>tidak ada janji tertunggak</>
            )
          }
        />
      </div>

      {/* ══ BARIS GRAFIK ══
          Satu kolom, lalu TIGA sekaligus mulai xl — tidak pernah dua.
          Dua kolom terdengar seperti langkah antara yang wajar, tapi dengan
          tiga kartu ia justru bentuk terburuk: kartu ketiga terlempar ke baris
          bawah dan menyisakan separuh baris kosong di sebelahnya. Melompat dari
          satu ke tiga tidak pernah menyisakan sel menganggur. */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.92fr)]">
        <Permukaan kelas="p-4">
          <KepalaKartu
            judul="Sebaran pipeline"
            keterangan="Klik satu tahap untuk menyaring daftar"
            kanan={
              tahapAktif ? (
                <button
                  onClick={() => onPilihTahap(tahapAktif)}
                  className={`${TIPE.mungil} shrink-0 rounded-full px-2 py-1 font-medium text-emerald-400 transition-colors hover:bg-emerald-500/10 ${FOKUS}`}
                >
                  Tampilkan semua
                </button>
              ) : undefined
            }
          />
          <DonutPipeline perTahap={perTahap} total={total} aktif={tahapAktif} onPilih={onPilihTahap} />
        </Permukaan>

        <Permukaan kelas="p-4">
          <KepalaKartu
            judul="Klien masuk"
            keterangan="12 bulan terakhir"
            kanan={
              <div className="shrink-0 text-right">
                <p className="text-[20px] font-semibold leading-none tracking-[-0.02em] text-white">
                  {bulanIni}
                </p>
                <p className={`${TIPE.mungil} mt-1 text-slate-500`}>bulan ini</p>
              </div>
            }
          />
          <AreaKlienMasuk tren={tren} />
        </Permukaan>

        {panelTindakan}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   RANGKA PEMUATAN
   ══════════════════════════════════════════════════════════════════ */

/**
 * Rangka yang bentuknya SAMA dengan panel jadinya.
 *
 * Dibangun dari komponen `Permukaan` dan `KartuKpi` yang sama, bukan dari
 * <div> setinggi angka tebakan. Angka tebakan pasti meleset begitu tipografi
 * atau padding diubah, dan melesetnya baru ketahuan sebagai KEDIPAN: halaman
 * melompat pada detik data tiba — hal yang paling membuat sebuah situs terasa
 * murah, lebih daripada animasi apa pun yang absen.
 */
function Batang({ w, tinggi = "0.9em" }: { w: string; tinggi?: string }) {
  return (
    <span
      className="inline-block animate-pulse rounded-full bg-white/[0.07] align-middle"
      style={{ width: w, height: tinggi }}
    />
  );
}

function RangkaPanel({ panelTindakan }: { panelTindakan?: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <KartuKpi
            key={i}
            indeks={i}
            label=""
            icon="solar:hashtag-square-linear"
            nilai={<Batang w={i === 1 ? "5em" : "2.2em"} tinggi="0.72em" />}
            keterangan={<Batang w="8em" />}
            samping={
              i === 2 ? (
                <span className="h-[46px] w-[46px] shrink-0 animate-pulse rounded-full bg-white/[0.05]" />
              ) : undefined
            }
          />
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.92fr)]">
        <Permukaan kelas="p-4">
          <div className="mb-4">
            <Batang w="9em" />
          </div>
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <div className="h-[148px] w-[148px] shrink-0 animate-pulse rounded-full bg-white/[0.05]" />
            <div className="grid w-full grid-cols-2 gap-y-2 xl:grid-cols-1 2xl:grid-cols-2">
              {URUTAN_TAHAP.map((s) => (
                <span key={s} className="px-2 py-1.5">
                  <Batang w="6em" />
                </span>
              ))}
            </div>
          </div>
        </Permukaan>

        <Permukaan kelas="p-4">
          <div className="mb-4">
            <Batang w="7em" />
          </div>
          <div className="h-[180px] animate-pulse rounded-lg bg-white/[0.04]" />
          <div className="mt-1 h-4" />
        </Permukaan>

        {panelTindakan}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PENGAMBIL DATA
   ══════════════════════════════════════════════════════════════════ */

/**
 * Statistik ditarik terpisah dari daftar klien, dengan alasan yang sama seperti
 * ringkasan rekomendasi: ia menyapu SELURUH klien milik agent, sementara daftar
 * hanya memuat 50 baris teratas dan berubah setiap kali kotak pencarian
 * diketik. Angka di kartu tidak boleh ikut berubah saat agent mencari nama.
 */
export function useStatistik() {
  const [stat, setStat] = useState<Statistik | null>(null);
  const [muat, setMuat] = useState(true);

  const ambil = useRef(async () => {
    try {
      const res = await fetch("/api/dashboard/klien/statistik");
      const json = await res.json();
      if (json.ok) setStat(json.data);
    } catch {
      /* Kartu boleh gagal diam-diam — daftar klien di bawahnya tetap berguna. */
    } finally {
      setMuat(false);
    }
  }).current;

  useEffect(() => {
    ambil();
  }, [ambil]);

  return { stat, muat, muatUlang: ambil };
}

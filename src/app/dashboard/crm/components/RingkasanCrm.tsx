"use client";

/* ---------------------------------------------------------------------------
   RINGKASAN CRM — panel di puncak /dashboard/crm
   ---------------------------------------------------------------------------
   Dua kartu angka (Total Leads, Potensi Komisi), satu baris "apa yang harus
   dikerjakan hari ini", dan grafik batang lead masuk per bulan untuk satu
   TAHUN KALENDER penuh.

   KENAPA KARTU KEDUA KOMISI, BUKAN "TOTAL BUDGET". Nilai budget klien adalah
   uang orang lain — agent membacanya sekali lalu lupa. Angka yang membuat
   orang mengangkat telepon adalah bagiannya sendiri. Rp 300 jt pipeline tidak
   menggerakkan siapa pun; "Rp 7,5 jt menunggu di-follow-up" menggerakkan.
   Angkanya turunan langsung dari nilai pipeline, jadi tidak ada data baru yang
   perlu dipercaya — hanya bingkai yang benar.

   KENAPA TAHUN KALENDER, BUKAN 12 BULAN TERAKHIR. Pertanyaan yang dijawab
   grafik ini adalah "Agustus ini dapat berapa, dibanding Agustus lalu".
   Jendela berjalan menggeser sumbunya tiap bulan sehingga perbandingan
   bulan-ke-bulan antar tahun mustahil dibaca.

   KENAPA GANTI TAHUN TIDAK MEMANGGIL SERVER. Field `tahunan` dari
   /api/dashboard/klien/statistik sudah memuat SELURUH tahun sekaligus —
   seorang agent punya hitungan tahun, bukan ratusan.
   ------------------------------------------------------------------------- */

import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";

/* ── Bentuk data dari /api/dashboard/klien/statistik ──────────────── */

export type TahapStat = { jumlah: number; nilai: number };

export type StatistikCrm = {
  total: number;
  klienAktif: number;
  perTahap: Record<string, TahapStat>;
  nilaiPipeline: number;
  nilaiClosing: number;
  tanpaBudget: number;
  tanpaBudgetSemua: number;
  jumlahClosing: number;
  followUp: { terlambat: number; hariIni: number; nilaiTerlambat: number };
  tren: { bulan: string; jumlah: number }[];
  tahunan: { tahun: number; bulan: number[]; total: number }[];
  bulanIni: number;
  bulanLalu: number;
};

/* Komisi kantor saat closing: 2,5%–3% (lihat halaman Titip Jual & pasal MOU).
   Dipakai batas BAWAH-nya supaya angka yang dijanjikan panel ini tidak pernah
   lebih besar dari yang benar-benar cair. Satu tempat, gampang diubah kalau
   skema komisinya berubah. */
export const RATE_KOMISI = 0.025;

/* Batang tertinggi hanya mengisi 84% trek: 16% sisanya ruang bernapas untuk
   angka yang mengambang di atas ujungnya. */
const SKALA = 84;

const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/* Rupiah dipendekkan karena dua kartu berbagi satu baris di ponsel dan angka
   pipeline sering bermiliar; nilai persisnya tetap terbaca lewat `title`. */
export function rupiahRingkas(n: number) {
  if (!n) return "Rp 0";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `Rp ${(n / 1e12).toFixed(abs >= 1e13 ? 0 : 1).replace(".", ",")} T`;
  if (abs >= 1e9)  return `Rp ${(n / 1e9).toFixed(abs >= 1e10 ? 0 : 1).replace(".", ",")} M`;
  if (abs >= 1e6)  return `Rp ${(n / 1e6).toFixed(abs >= 1e7 ? 0 : 1).replace(".", ",")} jt`;
  if (abs >= 1e3)  return `Rp ${Math.round(n / 1e3).toLocaleString("id-ID")} rb`;
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

const rupiahPenuh = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

/* ── Sebaran tahap, dasar kartu Total Leads ───────────────────────
   Menggantikan sparkline 12 bulan yang sempat ada di sini: grafik batang di
   sebelahnya SUDAH menggambar lead masuk per bulan, jadi sparkline itu
   menggambar data yang sama dua kali sambil menyisakan kartunya setengah
   kosong. Yang belum terjawab di mana pun adalah "tujuh klien itu ada di
   tahap mana" — dan itu yang menentukan apakah angka tujuh ini kabar baik.  */

const TAHAP_URUT = [
  { key: "lead_baru",      warna: "bg-rose-400",    teks: "text-rose-300",    label: "Baru" },
  { key: "sudah_dikontak", warna: "bg-sky-400",     teks: "text-sky-300",     label: "Dikontak" },
  { key: "hot_buyer",      warna: "bg-amber-400",   teks: "text-amber-300",   label: "Hot" },
  { key: "closing",        warna: "bg-emerald-400", teks: "text-emerald-300", label: "Closing" },
  { key: "lost_iseng",     warna: "bg-slate-600",   teks: "text-slate-500",   label: "Lost" },
] as const;

function SebaranTahap({ perTahap }: { perTahap: Record<string, TahapStat> }) {
  const isi = TAHAP_URUT
    .map(t => ({ ...t, jumlah: perTahap[t.key]?.jumlah ?? 0 }))
    .filter(t => t.jumlah > 0);

  if (isi.length === 0) return null;

  /* Legenda memuat tiga tahap terbanyak; sisanya diringkas jadi "+N". Kartu
     ini selebar setengah kolom — lima label berjejer akan membungkus jadi tiga
     baris dan merusak tinggi yang sudah disamakan dengan kartu sebelahnya. */
  const terbesar = [...isi].sort((a, b) => b.jumlah - a.jumlah);
  const tampil = terbesar.slice(0, 3);
  const sisa = terbesar.slice(3).reduce((n, t) => n + t.jumlah, 0);

  /* TANPA mt-auto di sini. Dua margin auto dalam satu kolom flex membagi
     ruang sisa rata di antara keduanya — hasilnya dua celah setengah lebar,
     bukan satu blok rapat di dasar. Biar angka besarnya saja yang memegang
     mt-auto; blok ini menempel tepat di bawah catatannya. */
  return (
    <div className="relative pt-3">
      <div className="flex h-1.5 gap-[3px] overflow-hidden">
        {isi.map((t, i) => (
          <motion.div
            key={t.key}
            initial={{ flexGrow: 0, opacity: 0 }}
            animate={{ flexGrow: t.jumlah, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.15 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            style={{ flexBasis: 0 }}
            className={`min-w-[6px] rounded-full ${t.warna}`}
            title={`${t.label}: ${t.jumlah} klien`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-semibold leading-tight">
        {tampil.map(t => (
          <span key={t.key} className="inline-flex items-center gap-1 whitespace-nowrap" title={`${t.label}: ${t.jumlah} klien`}>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.warna}`} />
            <span className="text-slate-300">{t.jumlah}</span>
            <span className="text-slate-500">{t.label}</span>
          </span>
        ))}
        {sisa > 0 && <span className="text-slate-600">+{sisa} lainnya</span>}
      </div>
    </div>
  );
}

/* ── Kartu angka ──────────────────────────────────────────────────── */

const AKSEN = {
  emerald: {
    kotak: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    aura:  "bg-emerald-500/15",
    angka: "from-white via-white to-emerald-200",
  },
  amber: {
    kotak: "border-amber-400/25 bg-amber-400/10 text-amber-300",
    aura:  "bg-amber-500/15",
    angka: "from-white via-amber-50 to-amber-200",
  },
} as const;

function Kartu({
  ikon, label, nilai, judulNilai, catatan, aksen, anak,
}: {
  ikon: string;
  label: string;
  nilai: string;
  judulNilai?: string;
  catatan: React.ReactNode;
  aksen: keyof typeof AKSEN;
  /** Blok tambahan di dasar kartu. Ada supaya kartu yang catatannya pendek
      punya sesuatu yang berarti untuk mengisi tinggi yang disamakan dengan
      kartu sebelahnya — bukan supaya ada hiasan tambahan. */
  anak?: React.ReactNode;
}) {
  const a = AKSEN[aksen];
  return (
    <div className="group relative isolate flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-3.5 backdrop-blur-xl transition-colors duration-300 hover:border-white/[0.12] sm:p-4">
      {/* Cahaya sudut: satu-satunya elemen dekoratif, meredup di luar hover
          supaya angkanya yang jadi hal paling terang di kartu. */}
      <div className={`pointer-events-none absolute -right-10 -top-10 -z-10 h-28 w-28 rounded-full ${a.aura} blur-2xl transition-opacity duration-500 group-hover:opacity-80`} style={{ opacity: 0.5 }} />
      <div className="relative flex items-center gap-2">
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${a.kotak}`}>
          <Icon icon={ikon} className="text-[15px]" />
        </div>
        <div className="truncate text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-slate-400 sm:text-[10px]">
          {label}
        </div>
      </div>

      {/* mt-auto tetap dipakai di kartu tanpa blok bawah supaya garis dasar
          angka kedua kartu sejajar; kartu yang punya `anak` mendorong sisa
          tingginya ke blok itu. */}
      <div
        className={`relative mt-auto pt-2 bg-gradient-to-br ${a.angka} bg-clip-text text-[24px] font-extrabold leading-none tracking-tight text-transparent sm:text-[30px]`}
        title={judulNilai}
      >
        {nilai}
      </div>

      <div className="relative mt-1.5 text-[10.5px] leading-snug text-slate-400 sm:text-[11.5px]">{catatan}</div>
      {anak}
    </div>
  );
}

/* ── Baris aksi: satu kalimat, pekerjaan hari ini ─────────────────── */

function BarisAksi({ stat }: { stat: StatistikCrm }) {
  const { terlambat, hariIni, nilaiTerlambat } = stat.followUp;
  const hot = stat.perTahap.hot_buyer ?? { jumlah: 0, nilai: 0 };

  /* Urutan sengaja: yang lewat tenggat mengalahkan segalanya, lalu yang jatuh
     tempo hari ini, lalu — kalau tidak ada utang — dorongan ke arah klien yang
     paling dekat closing. Panel ini hanya boleh menyuruh satu hal. */
  let nada: "amber" | "sky" | "emerald" = "emerald";
  let ikon = "solar:check-circle-bold-duotone";
  let isi: React.ReactNode = "Semua follow-up terkendali. Waktunya cari lead baru.";

  if (terlambat > 0) {
    nada = "amber";
    ikon = "solar:danger-triangle-bold-duotone";
    isi = (
      <>
        <b className="font-extrabold text-amber-200">{terlambat} follow-up lewat tenggat</b>
        {nilaiTerlambat > 0 && (
          <> — <span title={rupiahPenuh(nilaiTerlambat * RATE_KOMISI)}>
            {rupiahRingkas(nilaiTerlambat * RATE_KOMISI)} komisi menganggur
          </span></>
        )}
      </>
    );
  } else if (hariIni > 0) {
    nada = "sky";
    ikon = "solar:bell-bing-bold-duotone";
    isi = <><b className="font-extrabold text-sky-200">{hariIni} follow-up</b> jatuh tempo hari ini</>;
  } else if (hot.jumlah > 0) {
    ikon = "solar:fire-bold-duotone";
    isi = (
      <>
        <b className="font-extrabold text-emerald-200">{hot.jumlah} hot buyer</b> tinggal selangkah
        {hot.nilai > 0 && <> · {rupiahRingkas(hot.nilai * RATE_KOMISI)} komisi</>}
      </>
    );
  }

  const gaya = {
    amber:   "border-amber-400/20 bg-amber-500/[0.07] text-amber-100/90",
    sky:     "border-sky-400/20 bg-sky-500/[0.07] text-sky-100/90",
    emerald: "border-emerald-400/15 bg-emerald-500/[0.05] text-emerald-100/80",
  }[nada];

  const warnaIkon = { amber: "text-amber-400", sky: "text-sky-400", emerald: "text-emerald-400" }[nada];

  return (
    <div className={`flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-[11.5px] leading-snug backdrop-blur-xl ${gaya}`}>
      <Icon icon={ikon} className={`shrink-0 text-[17px] ${warnaIkon}`} />
      <span className="min-w-0">{isi}</span>
    </div>
  );
}

/* ── Grafik batang ────────────────────────────────────────────────── */

function GrafikTahun({ stat }: { stat: StatistikCrm }) {
  const tahunTersedia = useMemo(() => stat.tahunan.map(t => t.tahun), [stat.tahunan]);
  const [tahunDipilih, setTahunDipilih] = useState<number | null>(null);

  /* Pilihan pengguna disimpan terpisah dan jatuh kembali ke tahun terbaru
     selama belum dipilih — atau saat tahun yang dipilih lenyap dari data. */
  const tahunAktif =
    tahunDipilih !== null && tahunTersedia.includes(tahunDipilih)
      ? tahunDipilih
      : tahunTersedia[0] ?? new Date().getFullYear();

  const baris   = stat.tahunan.find(t => t.tahun === tahunAktif);
  const bulanan = baris?.bulan ?? Array(12).fill(0);
  const total   = baris?.total ?? 0;
  const puncak  = Math.max(1, ...bulanan);
  const kini    = new Date();
  const idxKini = tahunAktif === kini.getFullYear() ? kini.getMonth() : -1;

  /* Rata-rata dihitung dari bulan yang SUDAH lewat saja. Membagi dengan 12 di
     bulan Agustus menenggelamkan garisnya dengan empat bulan yang belum
     terjadi, dan agent membaca dirinya jauh lebih buruk dari kenyataan. */
  const bulanBerjalan = idxKini >= 0 ? idxKini + 1 : 12;
  const rata = total / bulanBerjalan;

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-3.5 backdrop-blur-xl sm:p-4">
      <div className="pointer-events-none absolute -left-16 bottom-0 h-40 w-64 rounded-full bg-emerald-500/[0.06] blur-3xl" />

      <div className="relative mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-slate-400 sm:text-[10px]">
            Lead Masuk
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-[17px] font-extrabold leading-none text-white sm:text-[19px]">
              {total.toLocaleString("id-ID")}
            </span>
            <span className="truncate text-[11.5px] text-slate-400">
              klien sepanjang {tahunAktif}
              {total > 0 && <span className="hidden sm:inline"> · rata-rata {rata.toFixed(1).replace(".", ",")}/bln</span>}
            </span>
          </div>
        </div>

        {tahunTersedia.length > 1 && (
          <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-white/[0.07] bg-black/20 p-0.5">
            {tahunTersedia.slice(0, 3).map(th => (
              <button
                key={th}
                onClick={() => setTahunDipilih(th)}
                className={`relative rounded-[9px] px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  th === tahunAktif ? "text-emerald-200" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {th === tahunAktif && (
                  <motion.span
                    layoutId="tahun-aktif"
                    className="absolute inset-0 rounded-[9px] border border-emerald-400/25 bg-emerald-400/10"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative">{th}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Area grafik. Tinggi trek DITETAPKAN (bukan flex-1 di dalam induk
          items-end) — persentase tinggi batang harus punya sesuatu yang pasti
          untuk dihitung, dan induk yang tidak meregang membuat semuanya nol.
          Tingginya sengaja MINIMUM, bukan tetap: dua kolom panel ini
          disamakan tingginya oleh grid, dan sisa tinggi harus mendarat di
          SINI — di grafik, sisa ruang berarti batang lebih tinggi dan lebih
          mudah dibandingkan; di kartu angka, sisa ruang cuma lubang di bawah
          teks. Karena itu angka minimumnya dipasang sedikit lebih pendek dari
          tinggi alami kolom kiri. */}
      <div className="relative min-h-[92px] flex-1 sm:min-h-[100px]">
        {/* Garis bantu: puncak, tengah, dasar. */}
        <div className="pointer-events-none absolute inset-0">
          {[0, 50, 100].map(p => (
            <div
              key={p}
              className="absolute inset-x-0 border-t border-dashed border-white/[0.05]"
              style={{ top: `${p}%` }}
            />
          ))}
          {rata > 0 && (
            <div
              className="absolute inset-x-0 border-t border-dashed border-emerald-400/25"
              style={{ bottom: `${(rata / puncak) * SKALA}%` }}
            >
              <span className="absolute -top-[7px] right-0 rounded bg-[#0b0f16] px-1 text-[8.5px] font-bold uppercase tracking-wider text-emerald-400/70">
                rata²
              </span>
            </div>
          )}
        </div>

        <div className="absolute inset-0 flex items-stretch gap-[3px] sm:gap-1.5">
          {bulanan.map((jumlah, i) => {
            const aktif = i === idxKini;
            const tinggi = jumlah ? Math.max(7, (jumlah / puncak) * SKALA) : 0;
            return (
              <div key={i} className="group/bar relative flex min-w-0 flex-1 items-end">
                {/* Bidang bidik setinggi trek: batang bulan sepi cuma 2 px,
                    mustahil di-hover kalau bidang bidiknya menempel di batang. */}
                <div className="absolute inset-0 rounded-md transition-colors group-hover/bar:bg-white/[0.03]" />

                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: jumlah ? `${tinggi}%` : "2px" }}
                  transition={{ duration: 0.55, delay: i * 0.025, ease: [0.22, 1, 0.36, 1] }}
                  className={`absolute inset-x-0 bottom-0 rounded-t-[5px] ${
                    aktif
                      ? "bg-gradient-to-t from-emerald-600/60 via-emerald-400 to-emerald-300 shadow-[0_0_18px_-2px_rgba(52,211,153,0.65)]"
                      : jumlah
                        ? "bg-gradient-to-t from-emerald-500/15 via-emerald-400/45 to-emerald-300/65 group-hover/bar:from-emerald-500/25 group-hover/bar:to-emerald-200"
                        : "bg-white/[0.08]"
                  }`}
                />

                {/* Angka DI ATAS ujung batang, bukan di dalamnya. Di dalam
                    batang, teks putih jatuh ke hijau terang dan hilang; di
                    latar gelap ia selalu terbaca. SKALA menyisakan 16% ruang
                    di puncak trek supaya angka bulan tertinggi tidak terpotong.
                    Selalu tampak — dua belas angka masih terbaca sekaligus,
                    dan menyembunyikannya di balik hover berarti agent harus
                    menebak dulu batang mana yang layak ditunjuk. */}
                {jumlah > 0 && (
                  <motion.span
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.35 + i * 0.025 }}
                    style={{ bottom: `calc(${tinggi}% + 5px)` }}
                    className={`pointer-events-none absolute inset-x-0 text-center text-[10px] font-extrabold tabular-nums leading-none sm:text-[11px] ${
                      aktif ? "text-emerald-200" : "text-slate-300 group-hover/bar:text-white"
                    }`}
                  >
                    {jumlah}
                  </motion.span>
                )}
              </div>
            );
          })}
        </div>

        {total === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-full border border-white/[0.07] bg-[#0b0f16]/85 px-3 py-1 text-[11px] text-slate-400">
              Belum ada lead masuk di {tahunAktif}
            </span>
          </div>
        )}
      </div>

      <div className="mt-2 flex gap-[3px] sm:gap-1.5">
        {BULAN_PENDEK.map((b, i) => (
          <span
            key={b}
            className={`min-w-0 flex-1 text-center text-[8.5px] font-bold sm:text-[9.5px] ${
              i === idxKini ? "text-emerald-300" : "text-slate-600"
            }`}
          >
            {b}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Kerangka saat memuat ─────────────────────────────────────────── */

function Kerangka() {
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      <div className="grid gap-3 lg:grid-rows-[minmax(0,1fr)_auto]">
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map(i => (
            <div key={i} className="h-[140px] animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.03]" />
          ))}
        </div>
        <div className="h-[46px] animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.03]" />
      </div>
      <div className="h-[196px] animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.03]" />
    </div>
  );
}

/* ── Panel ────────────────────────────────────────────────────────── */

export default function RingkasanCrm({
  stat, memuat,
}: {
  stat: StatistikCrm | null;
  memuat: boolean;
}) {
  if (memuat && !stat) return <Kerangka />;
  if (!stat) return null;

  const selisih  = stat.bulanIni - stat.bulanLalu;
  const potensi  = stat.nilaiPipeline * RATE_KOMISI;
  const terkumpul = stat.nilaiClosing * RATE_KOMISI;

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      <div className="grid gap-3 lg:grid-rows-[minmax(0,1fr)_auto]">
        {/* Dua kartu SELALU sebaris, termasuk di ponsel: keduanya hanya satu
            angka pendek, dan menumpuknya membuang setengah layar sebelum papan
            klien — isi halaman yang sebenarnya — sempat terlihat. */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <Kartu
            ikon="solar:users-group-two-rounded-bold-duotone"
            label="Total Leads"
            nilai={stat.total.toLocaleString("id-ID")}
            aksen="emerald"
            anak={<SebaranTahap perTahap={stat.perTahap} />}
            catatan={
              <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span>{stat.klienAktif.toLocaleString("id-ID")} aktif</span>
                <span className="text-slate-600">·</span>
                <span
                  className={`inline-flex items-center gap-0.5 font-bold ${
                    selisih > 0 ? "text-emerald-300" : selisih < 0 ? "text-rose-300" : "text-slate-500"
                  }`}
                  title={`Bulan ini ${stat.bulanIni}, bulan lalu ${stat.bulanLalu}`}
                >
                  {selisih !== 0 && (
                    <Icon
                      icon={selisih > 0 ? "solar:alt-arrow-up-bold" : "solar:alt-arrow-down-bold"}
                      className="text-[11px]"
                    />
                  )}
                  {selisih > 0 ? "+" : ""}{selisih}
                </span>
                <span className="text-slate-500">bln ini</span>
              </span>
            }
          />

          <Kartu
            ikon="solar:hand-money-bold-duotone"
            label="Potensi Komisi"
            nilai={rupiahRingkas(potensi)}
            judulNilai={`${rupiahPenuh(potensi)} — estimasi ${(RATE_KOMISI * 100).toString().replace(".", ",")}% dari pipeline ${rupiahPenuh(stat.nilaiPipeline)}`}
            aksen="amber"
            catatan={
              <>
                <span className="text-slate-500">est. {(RATE_KOMISI * 100).toString().replace(".", ",")}% dari </span>
                <span title={rupiahPenuh(stat.nilaiPipeline)}>{rupiahRingkas(stat.nilaiPipeline)} pipeline</span>
                {terkumpul > 0 && (
                  <>
                    <br />
                    <span className="text-emerald-300/90" title={rupiahPenuh(terkumpul)}>
                      +{rupiahRingkas(terkumpul)} sudah closing
                    </span>
                  </>
                )}
                {terkumpul === 0 && stat.tanpaBudget > 0 && (
                  <>
                    <br />
                    <span className="text-slate-500">{stat.tanpaBudget} klien belum ada budget</span>
                  </>
                )}
              </>
            }
          />
        </div>

        <BarisAksi stat={stat} />
      </div>

      <GrafikTahun stat={stat} />
    </div>
  );
}

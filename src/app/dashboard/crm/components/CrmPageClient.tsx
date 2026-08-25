"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import KlienFormModal from "./KlienFormModal";
import {
  FormPreferensi,
  formatRupiah as fmtRup,
  locFieldsToRegion,
  buildPrefPayloads,
  sidikKriteria,
  type PickerPref,
} from "./FormPreferensi";
import { PremiumSelect, PremiumDateTimePicker, type PremiumOption } from "./CrmFormControls";
import RingkasanCrm, { rupiahRingkas, RATE_KOMISI, type StatistikCrm } from "./RingkasanCrm";
import { regionKey, type SelectedRegion } from "@/lib/regionSearch";
import { rapikanAlamat, saringAlasan, labelLuas } from "@/lib/klienRingkas";
import { pathListing } from "@/lib/klienPesan";
import {
  Klien, KlienStatus, PreferensiKlien, PreferensiForm,
  TipeProperti, JenisTransaksi, TujuanBeli,
  EMPTY_PREFERENSI, SUMBER_LABEL, JENIS_TRANSAKSI_LABEL, TIPE_PROPERTI_LABEL,
  SERTIFIKAT_LABEL, type Sertifikat,
} from "./types";

/* ────────────────────────────────────────────────────────────
   THEME — per-status visual language (futuristic glass + glow)
   ──────────────────────────────────────────────────────────── */
type StatusTheme = {
  label: string;
  icon: string;
  dot: string;        // solid dot / accent
  text: string;       // accent text
  badge: string;      // badge bg + border + text
  bar: string;        // column top accent gradient
  glow: string;       // ambient glow blob
  ring: string;       // drop target ring
  grad: string;       // avatar gradient
  shadow: string;     // ambient hover drop-shadow (status colored)
  tint: string;       // subtle surface wash (gradient start)
};

const STATUS_THEME: Record<KlienStatus, StatusTheme> = {
  lead_baru: {
    label: "Lead Baru", icon: "solar:bell-bing-bold-duotone",
    dot: "bg-rose-400", text: "text-rose-300",
    badge: "bg-rose-500/15 text-rose-200 border-rose-400/25",
    bar: "from-rose-400/0 via-rose-400/80 to-rose-400/0",
    glow: "bg-rose-500/20", ring: "ring-rose-400/50",
    grad: "from-rose-500/40 to-rose-900/10 text-rose-100 ring-rose-400/25",
    shadow: "group-hover:shadow-[0_26px_60px_-28px_rgba(244,63,94,0.6)]",
    tint: "from-rose-500/[0.07]",
  },
  sudah_dikontak: {
    label: "Sudah Dikontak", icon: "solar:phone-calling-bold-duotone",
    dot: "bg-sky-400", text: "text-sky-300",
    badge: "bg-sky-500/15 text-sky-200 border-sky-400/25",
    bar: "from-sky-400/0 via-sky-400/80 to-sky-400/0",
    glow: "bg-sky-500/20", ring: "ring-sky-400/50",
    grad: "from-sky-500/40 to-sky-900/10 text-sky-100 ring-sky-400/25",
    shadow: "group-hover:shadow-[0_26px_60px_-28px_rgba(56,189,248,0.6)]",
    tint: "from-sky-500/[0.07]",
  },
  hot_buyer: {
    label: "Hot Buyer", icon: "solar:fire-bold-duotone",
    dot: "bg-amber-400", text: "text-amber-300",
    badge: "bg-amber-500/15 text-amber-200 border-amber-400/25",
    bar: "from-amber-400/0 via-amber-400/80 to-amber-400/0",
    glow: "bg-amber-500/20", ring: "ring-amber-400/50",
    grad: "from-amber-500/40 to-amber-900/10 text-amber-100 ring-amber-400/25",
    shadow: "group-hover:shadow-[0_26px_60px_-28px_rgba(245,158,11,0.6)]",
    tint: "from-amber-500/[0.08]",
  },
  closing: {
    label: "Closing", icon: "solar:cup-star-bold-duotone",
    dot: "bg-emerald-400", text: "text-emerald-300",
    badge: "bg-emerald-500/15 text-emerald-200 border-emerald-400/25",
    bar: "from-emerald-400/0 via-emerald-400/80 to-emerald-400/0",
    glow: "bg-emerald-500/20", ring: "ring-emerald-400/50",
    grad: "from-emerald-500/40 to-emerald-900/10 text-emerald-100 ring-emerald-400/25",
    shadow: "group-hover:shadow-[0_26px_60px_-28px_rgba(16,185,129,0.6)]",
    tint: "from-emerald-500/[0.07]",
  },
  lost_iseng: {
    label: "Lost / Iseng", icon: "solar:close-circle-bold-duotone",
    dot: "bg-slate-500", text: "text-slate-400",
    badge: "bg-slate-500/15 text-slate-400 border-slate-400/20",
    bar: "from-slate-400/0 via-slate-400/50 to-slate-400/0",
    glow: "bg-slate-500/10", ring: "ring-slate-400/40",
    grad: "from-slate-600/40 to-slate-900/10 text-slate-200 ring-slate-400/20",
    shadow: "group-hover:shadow-[0_26px_60px_-28px_rgba(148,163,184,0.4)]",
    tint: "from-slate-500/[0.05]",
  },
};

const PIPELINE_ORDER: KlienStatus[] = [
  "lead_baru", "sudah_dikontak", "hot_buyer", "closing", "lost_iseng",
];

/* ────────────────────────────────────────────────────────────
   HELPERS
   ──────────────────────────────────────────────────────────── */
function formatRp(n: number | null) {
  if (!n) return null;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(".0", "")} M`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(0)} jt`;
  return `${n.toLocaleString("id-ID")}`;
}
function formatRpFull(n: number | null) {
  if (!n) return "—";
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "Baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}

function followUpLabel(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const diff = d.getTime() - Date.now();
  if (diff < 0) return { text: "Terlambat!", urgent: true };
  const h = diff / 3600000;
  if (h < 24) return { text: `Hari ini ${d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`, urgent: true };
  return { text: d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }), urgent: false };
}

function initialsOf(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

/** Sumber prospek yang spesifik — diturunkan dari catatan auto-import */
const SOURCE_META: { test: RegExp; label: string; icon: string }[] = [
  { test: /Titip Jual/i,           label: "Titip Jual", icon: "solar:home-add-bold-duotone" },
  { test: /Penawaran/i,            label: "Penawaran",  icon: "solar:tag-price-bold-duotone" },
  { test: /Site Visit/i,           label: "Site Visit", icon: "solar:map-point-bold-duotone" },
  { test: /Form Website|Website/i, label: "Website",    icon: "solar:global-bold-duotone" },
  { test: /WA Organik/i,           label: "WA Organik", icon: "ic:baseline-whatsapp" },
];
function provenanceOf(k: Klien): { label: string; icon: string } {
  const c = k.catatan || "";
  for (const m of SOURCE_META) if (m.test.test(c)) return { label: m.label, icon: m.icon };
  return { label: SUMBER_LABEL[k.sumber], icon: "solar:inbox-line-bold-duotone" };
}

/** URL detail properti — konsisten dgn getPropertyUrl (slug-id, route per jenis transaksi) */
function propertiHref(p: { slug: string; id_property: string; jenis_transaksi: string }) {
  const id = `${p.slug}-${p.id_property}`;
  switch (p.jenis_transaksi?.toUpperCase()) {
    case "SEWA":   return `/Sewa/${id}`;
    case "LELANG": return `/Lelang/${id}`;
    default:       return `/Jual/${id}`; // PRIMARY, SECONDARY, CESSIE
  }
}

function waHref(phone: string, nama?: string) {
  const digits = phone.replace(/\D/g, "");
  const greet = nama ? `Halo ${nama.split(" ")[0]}, ` : "";
  return `https://wa.me/${digits}${greet ? `?text=${encodeURIComponent(greet)}` : ""}`;
}

/** Budget satu klien = MAKS di antara preferensinya, bukan jumlahnya.
    Satu kartu preferensi di UI dipecah jadi satu baris per (tipe × lokasi),
    jadi orang yang mencari "rumah atau ruko di Gresik atau Driyorejo, maks
    250 jt" tersimpan sebagai empat baris 250 jt. Menjumlahkannya melaporkan
    1 M dari satu orang yang mau beli satu rumah. Rumus ini sengaja sama
    persis dengan yang dipakai /api/dashboard/klien/statistik supaya angka di
    baris daftar tidak pernah berselisih dengan angka di kartu ringkasan. */
function budgetKlien(k: Klien): number {
  let maks = 0;
  for (const p of k.preferensi) {
    const v = Number(p.budget_max ?? p.budget_min ?? 0);
    if (v > maks) maks = v;
  }
  return maks;
}

/** Ringkasan preferensi untuk satu baris daftar: tipe unik, kota unik, dan
    berapa niat berbeda yang tersimpan di baliknya. */
function ringkasPreferensi(k: Klien) {
  const tipe: string[] = [];
  const kota: string[] = [];
  const niat = new Set<string>();
  for (const p of k.preferensi) {
    /* tipe null = semua tipe. Ditulis apa adanya supaya baris klien di daftar
       tidak terlihat seperti kehilangan data. */
    const t = p.tipe_properti ? (TIPE_PROPERTI_LABEL[p.tipe_properti] ?? p.tipe_properti) : "Semua tipe";
    if (!tipe.includes(t)) tipe.push(t);
    if (p.loc_kota && !kota.includes(p.loc_kota)) kota.push(p.loc_kota);
    niat.add(`${p.budget_min ?? ""}|${p.budget_max ?? ""}|${p.jenis_transaksi ?? ""}`);
  }
  return { tipe, kota, niat: niat.size };
}

const HARI_MS = 86_400_000;

/** Selisih HARI KALENDER, bukan selisih 24 jam. Follow-up jam 23.00 hari ini
    dan jam 01.00 besok cuma berjarak dua jam, tapi bagi agent yang satu
    "hari ini" dan yang lain "besok" — itu yang harus terbaca. */
function selisihHari(iso: string) {
  const a = new Date(iso); a.setHours(0, 0, 0, 0);
  const b = new Date();    b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / HARI_MS);
}

function waktuRelatif(iso: string | null): string {
  if (!iso) return "—";
  const d = -selisihHari(iso);
  if (d <= 0) return "hari ini";
  if (d === 1) return "kemarin";
  if (d < 30) return `${d} hr lalu`;
  if (d < 365) return `${Math.round(d / 30)} bln lalu`;
  return `${Math.floor(d / 365)} thn lalu`;
}

type JadwalFU = { label: string; ikon: string; kelas: string; telat: boolean };

function jadwalFollowUp(iso: string | null): JadwalFU | null {
  if (!iso) return null;
  const d = selisihHari(iso);
  if (d < 0) {
    return {
      label: d === -1 ? "Telat 1 hari" : `Telat ${-d} hari`,
      ikon: "solar:danger-triangle-bold-duotone",
      kelas: "border-amber-400/30 bg-amber-500/[0.12] text-amber-200",
      telat: true,
    };
  }
  if (d === 0) return { label: "Hari ini", ikon: "solar:bell-bing-bold-duotone", kelas: "border-sky-400/30 bg-sky-500/[0.12] text-sky-200", telat: false };
  if (d === 1) return { label: "Besok", ikon: "solar:calendar-mark-bold-duotone", kelas: "border-white/[0.08] bg-white/[0.04] text-slate-300", telat: false };
  return {
    label: d < 30 ? `${d} hari lagi` : `${Math.round(d / 30)} bln lagi`,
    ikon: "solar:calendar-mark-bold-duotone",
    kelas: "border-white/[0.08] bg-white/[0.04] text-slate-400",
    telat: false,
  };
}

/* ── Pengurutan daftar ────────────────────────────────────────
   Diurutkan di browser, bukan di SQL: daftar dibatasi 50 baris yang sudah
   ada di memori, jadi urutan berganti seketika tanpa memuat ulang. Kalau
   suatu saat batasnya dinaikkan atau dipaginasi, pengurutan harus pindah ke
   query — kalau tidak, "budget terbesar" cuma berarti terbesar di halaman
   yang kebetulan termuat. */
type UrutKlien = "prioritas" | "terbaru" | "budget" | "nama";

const URUT_OPSI: { value: UrutKlien; label: string; icon: string; hint: string }[] = [
  { value: "prioritas", label: "Prioritas",      icon: "solar:bolt-bold-duotone",          hint: "Follow-up telat lebih dulu" },
  { value: "terbaru",   label: "Terbaru",        icon: "solar:clock-circle-bold-duotone",  hint: "Klien paling baru masuk" },
  { value: "budget",    label: "Budget terbesar",icon: "solar:banknote-2-bold-duotone",    hint: "Nilai terbesar di atas" },
  { value: "nama",      label: "Nama A–Z",       icon: "solar:sort-by-alphabet-bold-duotone", hint: "Urut abjad" },
];

function urutkanKlien(list: Klien[], urut: UrutKlien): Klien[] {
  const salinan = [...list];
  switch (urut) {
    case "terbaru":
      return salinan.sort((a, b) => +new Date(b.tanggal_masuk) - +new Date(a.tanggal_masuk));
    case "budget":
      return salinan.sort((a, b) => budgetKlien(b) - budgetKlien(a));
    case "nama":
      return salinan.sort((a, b) => a.nama.localeCompare(b.nama, "id"));
    default: {
      /* PRIORITAS — urutan bawaan, dan satu-satunya yang menjawab "siapa yang
         harus saya hubungi sekarang". Janji yang sudah lewat naik ke puncak,
         paling telat lebih dulu; lalu yang terjadwal ke depan menurut
         kedekatannya; baru yang belum dijadwalkan sama sekali, diurut nilai
         supaya yang paling mahal tidak tenggelam. Yang lost selalu di dasar —
         mereka bukan pekerjaan. */
      const skor = (k: Klien) => {
        if (k.status === "lost_iseng") return 4;
        if (!k.tanggal_follow_up) return 3;
        return selisihHari(k.tanggal_follow_up) < 0 ? 0 : 1;
      };
      return salinan.sort((a, b) => {
        const sa = skor(a), sb = skor(b);
        if (sa !== sb) return sa - sb;
        if (sa === 0 || sa === 1) {
          return +new Date(a.tanggal_follow_up!) - +new Date(b.tanggal_follow_up!);
        }
        return budgetKlien(b) - budgetKlien(a);
      });
    }
  }
}

/* ════════════════════════════════════════════════════════════
   MAIN
   ════════════════════════════════════════════════════════════ */
export default function CrmPageClient() {
  const [items, setItems]   = useState<Klien[]>([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ]           = useState("");
  const [statusFilter, setStatusFilter] = useState<KlienStatus | "semua">("semua");
  const [urut, setUrut] = useState<UrutKlien>("prioritas");
  /* Asisten aset bisa dibuka TANPA melewati kartu klien maupun preferensi —
     dari panel "siap kirim", dari tombol di baris daftar, dan dari tautan
     dalam (?klien=KL00007) yang dipakai tugas & notifikasi otomatis. Yang
     disimpan cuma id-nya; sisanya diambil sendiri oleh modalnya. */
  const [asetUntuk, setAsetUntuk] = useState<{ id: string; nama: string; aset?: string[] } | null>(null);
  /* Kabar hasil pencarian ulang sesudah kriteria diubah. Bukan sekadar
     pemberitahuan: bisa diketuk untuk langsung membuka asetnya, karena
     kalimat "24 aset cocok" yang tidak bisa ditindaklanjuti hanya memindahkan
     pekerjaan membuka layar, tidak menghapusnya. */
  const [kabarKriteria, setKabarKriteria] = useState<{ id: string; nama: string; jumlah: number } | null>(null);
  /* Penanda "ringkasan sudah tidak mewakili keadaan". Dinaikkan dari SATU
     tempat — `kriteriaBerubah` — dan sesudah asisten aset ditutup, karena
     mengirim aset juga mengubah apa yang tersisa untuk dikirim. */
  const [versiRingkasan, setVersiRingkasan] = useState(0);
  const jedaKabar = useRef<ReturnType<typeof setTimeout> | null>(null);

  const jedaCari = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Satu pintu untuk "kriteria klien ini berubah". Dipanggil dari KETIGA
   *  jalur yang bisa mengubahnya — edit preferensi, hapus preferensi, dan
   *  formulir edit klien — supaya tidak ada satu pun yang lupa.
   *
   *  DIREDAM, dan itu bukan penghalusan: menghapus satu kartu preferensi yang
   *  berisi tiga lokasi memanggil `onPrefDeleted` tiga kali berturut-turut,
   *  dan tanpa peredam itu berarti TIGA pencarian penuh untuk satu tindakan —
   *  dua di antaranya atas data yang sudah usang sebelum jawabannya tiba.
   *  Simpanan tetap dibuang SEKETIKA; yang ditunda hanya pencarian ulangnya. */
  const kriteriaBerubah = useCallback((id: string, nama: string) => {
    buangSimpanan(id);
    setVersiRingkasan(v => v + 1);
    if (jedaCari.current) clearTimeout(jedaCari.current);
    jedaCari.current = setTimeout(async () => {
      const jumlah = await cariUlangDiamDiam(id);
      if (jumlah === null) return;
      if (jedaKabar.current) clearTimeout(jedaKabar.current);
      setKabarKriteria({ id, nama, jumlah });
      /* Delapan detik. Cukup lama untuk sempat dibaca dan diketuk sesudah agent
         menutup formulirnya, cukup pendek supaya tidak menggantung di layar
         sampai pekerjaan berikutnya. */
      jedaKabar.current = setTimeout(() => setKabarKriteria(null), 8000);
    }, 400);
  }, []);

  useEffect(() => () => {
    if (jedaKabar.current) clearTimeout(jedaKabar.current);
    if (jedaCari.current) clearTimeout(jedaCari.current);
  }, []);
  /* Baris mana yang laci hapusnya sedang tersingkap. Disimpan di induk, bukan
     di tiap baris: dua laci merah menganga sekaligus terbaca seperti aplikasi
     yang kehilangan kendali, dan membuka yang satu harus menutup yang lain. */
  const [geserTerbuka, setGeserTerbuka] = useState<string | null>(null);
  /* Apakah agent sudah pernah menggeser satu baris. Dimulai `true` (= jangan
     beri petunjuk) supaya render server dan render pertama browser identik;
     nilai sebenarnya dibaca dari localStorage sesudah pemasangan. Salah tebak
     ke arah "tidak ada petunjuk" jauh lebih aman daripada kedipan hydration. */
  const [pernahGeser, setPernahGeser] = useState(true);
  useEffect(() => {
    try { setPernahGeser(localStorage.getItem("crm-geser-hapus") === "1"); } catch {}
  }, []);
  /* Menggulir dengan laci terbuka menyisakan tombol merah menggantung di
     tengah layar — perilaku yang sama dengan daftar bawaan iOS adalah
     menutupnya. Didengarkan di window karena daftar ini ikut menggulir bersama
     halaman, bukan di dalam kotak bergulir sendiri. */
  useEffect(() => {
    if (!geserTerbuka) return;
    const tutup = () => setGeserTerbuka(null);
    window.addEventListener("scroll", tutup, { passive: true });
    return () => window.removeEventListener("scroll", tutup);
  }, [geserTerbuka]);

  const tandaiPernahGeser = useCallback(() => {
    setPernahGeser(true);
    try { localStorage.setItem("crm-geser-hapus", "1"); } catch {}
  }, []);
  const [showForm, setShowForm]   = useState(false);
  const [editTarget, setEditTarget] = useState<Klien | undefined>(undefined);
  const [detailOpen, setDetailOpen] = useState<Klien | null>(null);
  const [deleting, setDeleting]   = useState<string | null>(null);
  /* ── MODE PILIH ──
     Membuang dua belas prospek sampah satu per satu berarti dua belas geseran,
     dua belas konfirmasi, dan dua belas putaran jaringan. Tapi mode ini
     DINYALAKAN agent, tidak menyala sendiri: daftar ini jauh lebih sering
     dibaca daripada dihapus, dan kotak centang yang menempel permanen di tiap
     baris membuat papan klien terbaca seperti formulir. */
  const [modePilih, setModePilih]   = useState(false);
  const [terpilih, setTerpilih]     = useState<Set<string>>(() => new Set());
  const [konfirmasiMassal, setKonfirmasiMassal] = useState(false);
  const [menghapusMassal, setMenghapusMassal]   = useState(false);
  /* Kegagalan hapus massal ditampilkan DI DALAM kotak konfirmasinya, bukan
     lewat toast hijau di sudut layar: di situlah mata agent sedang berada, dan
     pilihannya masih utuh untuk dicoba lagi. */
  const [gagalMassal, setGagalMassal] = useState<string | null>(null);
  const [syncMsg, setSyncMsg]     = useState<string | null>(null);
  const [stat, setStat]           = useState<StatistikCrm | null>(null);
  const [statLoading, setStatLoading] = useState(true);
  const syncTerakhirRef = useRef(0);
  /* Spinner besar hanya berhak muncul SEKALI: saat halaman belum punya apa-apa
     untuk ditampilkan. Sesudah itu daftarnya sudah ada di layar, dan
     menggantinya dengan spinner pada tiap penyegaran — sinkron latar, kembali
     dari modal, bahkan mengetik di pencarian — terbaca seperti halaman yang
     me-refresh dirinya sendiri tanpa diminta, tepat saat agent sedang membaca.
     Penyegaran berikutnya berjalan diam-diam; petunjuknya sebuah spinner kecil
     di dalam kotak pencarian, yang tidak memindahkan satu piksel pun. */
  const pernahMuatRef = useRef(false);
  const [menyegarkan, setMenyegarkan] = useState(false);

  const load = useCallback(async (paksaDiam = false) => {
    const diam = paksaDiam || pernahMuatRef.current;
    if (diam) setMenyegarkan(true); else setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (q) params.set("q", q);
      const res  = await fetch(`/api/dashboard/klien?${params}`);
      const json = await res.json();
      setItems(json.data || []);
      setTotal(json.total || 0);
      pernahMuatRef.current = true;
    } finally {
      if (diam) setMenyegarkan(false); else setLoading(false);
    }
  }, [q]);

  /* Statistik dipanggil terpisah dari daftar karena menjawab pertanyaan yang
     berbeda: daftar menunjukkan 50 klien yang sedang dilihat (dan menyusut saat
     agent mengetik di pencarian), statistik menghitung SELURUH baris milik
     agent. Menurunkan "total lead" dari daftar akan membuat angkanya berubah
     tiap ketukan tombol — dan diam-diam salah begitu kliennya lebih dari 50. */
  const muatStatistik = useCallback(async () => {
    try {
      const res  = await fetch("/api/dashboard/klien/statistik");
      const json = await res.json();
      if (json?.ok) setStat(json.data);
    } catch {
      /* Statistik gagal tidak boleh menjatuhkan halaman: papan pipeline di
         bawahnya tetap berguna tanpa kartu ringkasan. */
    } finally {
      setStatLoading(false);
    }
  }, []);

  useEffect(() => { muatStatistik(); }, [muatStatistik]);

  // Ref so the mount-time auto-sync can call the latest load() without creating dep cycles
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);
  const statRef = useRef(muatStatistik);
  useEffect(() => { statRef.current = muatStatistik; }, [muatStatistik]);

  useEffect(() => {
    const t = setTimeout(() => load(), q ? 350 : 0);
    return () => clearTimeout(t);
  }, [q, load]);

  /* SINKRON PROSPEK TIDAK PUNYA TOMBOL LAGI.
     Tombol "Sinkronkan" menyerahkan pekerjaan mesin kepada orang: agent harus
     ingat menekannya, dan kalau lupa ia melihat pipeline yang tidak lengkap
     tanpa pernah tahu. Sinkron sekarang berjalan sendiri — saat halaman
     dibuka, tiap kali tab kembali aktif, dan tiap lima menit selama dibiarkan
     terbuka. Peredam lima puluh detik menahan ledakan permintaan saat agent
     berpindah-pindah tab (dan double-mount React Strict Mode di dev).

     Diam kalau tidak ada yang berubah: pemberitahuan hanya muncul ketika ada
     prospek yang benar-benar masuk — itu kabar, sisanya kebisingan. */
  const syncProspek = useCallback(async () => {
    /* Peredam lima menit, bukan lima puluh detik. Sinkron yang berjalan tiap
       kali tab kembali aktif membuat daftar berkedip pada tindakan paling
       sepele — pindah ke WhatsApp lalu kembali. Prospek baru yang telat
       lima menit tidak merugikan siapa pun; daftar yang berkedip merugikan
       tiap kali. */
    if (Date.now() - syncTerakhirRef.current < 5 * 60_000) return;
    syncTerakhirRef.current = Date.now();
    try {
      const res  = await fetch("/api/dashboard/klien/sync-prospek", { method: "POST" });
      const json = await res.json();
      const changed = (json.created || 0) + (json.updated || 0);
      if (changed > 0) {
        loadRef.current(true);
        statRef.current();
        setSyncMsg(`${json.created || 0} prospek baru diimpor · ${json.updated || 0} diperbarui`);
        setTimeout(() => setSyncMsg(null), 4000);
      }
    } catch {
      /* Sinkron yang gagal tidak boleh mengganggu: daftar klien yang sudah ada
         tetap benar, dan percobaan berikutnya datang sendiri. */
    }
  }, []);

  useEffect(() => {
    syncProspek();
    const saatKembali = () => { if (document.visibilityState === "visible") syncProspek(); };
    window.addEventListener("focus", saatKembali);
    document.addEventListener("visibilitychange", saatKembali);
    const denyut = setInterval(syncProspek, 10 * 60_000);
    return () => {
      window.removeEventListener("focus", saatKembali);
      document.removeEventListener("visibilitychange", saatKembali);
      clearInterval(denyut);
    };
  }, [syncProspek]);

  /* ?klien=KL00007 membuka asisten aset seketika. Inilah yang membuat tugas
     otomatis "3 aset baru cocok untuk Budi" bisa diselesaikan dengan SATU
     ketukan dari halaman Tugas, bukan dengan menelusuri CRM lagi. */
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const id = qs.get("klien");
    if (!id) return;
    /* &aset=12,13 datang dari email asisten: aset yang SUDAH ditampilkan di
       email itulah yang tercentang, bukan tiga teratas versi server. Agent
       yang mengetuk "kirim 3 aset ini" harus mengirim tiga aset yang sama
       dengan yang barusan dilihatnya. */
    const aset = (qs.get("aset") || "").split(",").map(x => x.trim()).filter(Boolean);
    setAsetUntuk({ id, nama: "", aset: aset.length ? aset : undefined });
  }, []);

  const barisKlien = useMemo(() => {
    const tersaring = statusFilter === "semua" ? items : items.filter(k => k.status === statusFilter);
    return urutkanKlien(tersaring, urut);
  }, [items, statusFilter, urut]);

  /* Berapa yang menunggu di daftar YANG SEDANG DILIHAT. Dihitung dari baris
     tersaring, bukan dari statistik global, karena inilah janji yang bisa
     ditepati agent tanpa mengganti filter dulu. */
  const telatTampil = useMemo(
    () => barisKlien.filter(k => k.status !== "lost_iseng" && k.tanggal_follow_up && selisihHari(k.tanggal_follow_up) < 0).length,
    [barisKlien],
  );

  /* Pilihan selalu dibatasi pada baris yang SEDANG TAMPIL. "Pilih semua" yang
     diam-diam ikut mencentang klien di balik filter status — lalu
     menghapusnya — adalah kejutan, bukan kemudahan. */
  const idTampil = useMemo(() => barisKlien.map(k => k.id_klien), [barisKlien]);
  const terpilihTampil = useMemo(() => idTampil.filter(id => terpilih.has(id)), [idTampil, terpilih]);
  const semuaTerpilih = idTampil.length > 0 && terpilihTampil.length === idTampil.length;

  /* Filter berganti, pencarian diketik, sinkron menarik daftar baru — baris
     yang tercentang bisa lenyap dari layar sambil tetap tercatat terpilih.
     Tanpa pemangkasan ini tombol "Hapus 5 klien" menghitung orang yang tidak
     terlihat di mana pun, dan menepatinya. */
  useEffect(() => {
    setTerpilih(prev => {
      if (prev.size === 0) return prev;
      const ada = new Set(idTampil);
      const n = new Set<string>();
      prev.forEach(id => { if (ada.has(id)) n.add(id); });
      return n.size === prev.size ? prev : n;
    });
  }, [idTampil]);

  const togglePilih = useCallback((id: string) => {
    setTerpilih(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  const toggleSemua = useCallback(() => {
    setTerpilih(prev => idTampil.length > 0 && idTampil.every(id => prev.has(id))
      ? new Set<string>()
      : new Set(idTampil));
  }, [idTampil]);

  const keluarModePilih = useCallback(() => {
    setModePilih(false);
    setTerpilih(new Set());
    setKonfirmasiMassal(false);
    setGagalMassal(null);
  }, []);

  /* Esc mengakhiri mode pilih. Sebuah mode yang mengubah arti ketukan di
     SELURUH daftar harus punya jalan keluar yang tidak perlu dicari dulu. */
  useEffect(() => {
    if (!modePilih) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || menghapusMassal) return;
      if (konfirmasiMassal) setKonfirmasiMassal(false); else keluarModePilih();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modePilih, konfirmasiMassal, menghapusMassal, keluarModePilih]);

  /* SATU permintaan untuk seluruh pilihan, bukan satu DELETE per klien. Lima
     puluh penghapusan berurutan dari browser bisa berhenti di tengah jalan --
     sebagian terhapus, sebagian tidak, dan tak seorang pun tahu sampai mana.
     Baris yang hilang dari layar adalah baris yang DIJAWAB server sebagai
     terhapus, bukan yang dikirim: id milik agent lain (atau yang sudah
     terhapus lebih dulu) tidak boleh lenyap dari layar seolah berhasil. */
  async function hapusTerpilih() {
    const ids = terpilihTampil;
    if (ids.length === 0 || menghapusMassal) return;
    setMenghapusMassal(true);
    setGagalMassal(null);
    try {
      const res  = await fetch("/api/dashboard/klien/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json().catch(() => null);
      const terhapus: string[] = json?.ok && Array.isArray(json.deleted) ? json.deleted : [];

      if (terhapus.length === 0) {
        setGagalMassal(json?.message || "Gagal menghapus. Coba lagi.");
        return;
      }

      /* Simpanan hasil pencarian milik klien yang sudah tidak ada tidak akan
         pernah dibaca lagi — tapi id klien dipakai ulang bukan hal mustahil,
         dan simpanan yatim yang kebetulan cocok akan menampilkan aset milik
         orang lain. */
      const hilang = new Set(terhapus);
      terhapus.forEach(buangSimpanan);
      setItems(prev => prev.filter(k => !hilang.has(k.id_klien)));
      setTotal(t => Math.max(0, t - terhapus.length));
      if (detailOpen && hilang.has(detailOpen.id_klien)) setDetailOpen(null);
      muatStatistik();
      setSyncMsg(`${terhapus.length} klien dihapus`);
      setTimeout(() => setSyncMsg(null), 4000);
      keluarModePilih();
    } catch {
      setGagalMassal("Gagal menghapus. Periksa koneksi lalu coba lagi.");
    } finally {
      setMenghapusMassal(false);
    }
  }

  function handleSaved(k: Klien) {
    muatStatistik();

    /* JALUR KETIGA yang bisa mengubah kriteria, dan yang paling mudah
       terlewat: formulir "Edit Klien" MENULIS ULANG seluruh preferensi
       (hapus semua → buat baru), bukan hanya data kontaknya. Tanpa cabang ini,
       agent yang mengubah plafon budget lewat formulir itu akan menerima
       daftar aset lama — sudah tidak sesuai kriterianya, tanpa satu pun tanda
       bahwa ada yang salah.

       Dibandingkan ISI kriterianya, bukan id-nya: penulisan ulang selalu
       menghasilkan id baru, jadi membandingkan id akan memicu pencarian ulang
       setiap kali agent sekadar memperbaiki nomor telepon.

       Diperiksa DI LUAR updater `setItems`. React boleh memanggil updater dua
       kali (StrictMode di pengembangan), dan efek samping di dalamnya akan
       ikut berjalan dua kali — dua pencarian penuh untuk satu penyimpanan. */
    const lama = items.find(x => x.id_klien === k.id_klien) ?? null;
    const berubah = !lama || !kriteriaSama(lama.preferensi, k.preferensi);
    if (berubah) {
      if (k.preferensi.length > 0) kriteriaBerubah(k.id_klien, k.nama);
      else buangSimpanan(k.id_klien);
    }

    setItems(prev => {
      const idx = prev.findIndex(x => x.id_klien === k.id_klien);
      if (idx >= 0) { const n = [...prev]; n[idx] = k; return n; }
      setTotal(t => t + 1);
      return [k, ...prev];
    });
  }

  /* `sudahDikonfirmasi` dipakai jalur geser-hapus: laci merahnya sendiri
     sudah meminta ketukan kedua ("Yakin?"), jadi menambahkan dialog bawaan
     browser di atasnya cuma memaksa orang menyetujui hal yang sama dua kali —
     dan dialog itulah satu-satunya bagian layar ini yang tidak bisa didandani. */
  async function handleDelete(id: string, sudahDikonfirmasi = false) {
    if (!sudahDikonfirmasi && !confirm("Hapus klien ini?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/dashboard/klien/${id}`, { method: "DELETE" });
      /* Simpanan klien yang sudah tidak ada tidak akan pernah dibaca lagi —
         tapi id klien dipakai ulang tidaklah mustahil, dan simpanan yatim yang
         kebetulan cocok akan menampilkan aset milik orang lain. */
      buangSimpanan(id);
      setItems(prev => prev.filter(x => x.id_klien !== id));
      setTotal(t => t - 1);
      muatStatistik();
      if (detailOpen?.id_klien === id) setDetailOpen(null);
    } finally {
      setDeleting(null);
    }
  }

  async function moveStatus(id: string, status: KlienStatus) {
    setItems(prev => prev.map(k => k.id_klien === id ? { ...k, status } : k));
    setDetailOpen(d => d && d.id_klien === id ? { ...d, status } : d);
    /* Pindah tahap menggeser uangnya antar kotak (pipeline ↔ closing ↔ hangus),
       jadi kartu Potensi Komisi harus ikut dihitung ulang — TAPI baru setelah
       tulisannya benar-benar mendarat. Memanggilnya lebih dulu berarti server
       masih membaca status lama, dan kartunya menampilkan angka usang sampai
       ada yang memuat ulang halaman. */
    try {
      await fetch(`/api/dashboard/klien/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      muatStatistik();
    } catch {
      load(true);      // kembalikan baris ke keadaan server, tanpa berkedip
      muatStatistik(); // …dan angkanya ikut, supaya keduanya tidak berselisih
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#040608] text-white">
      {/* ── Latar ──
          Dulu tiga aurora — emerald, indigo, cyan — beradu di belakang konten.
          Warna latar yang bersaing dengan warna data membuat batang grafik
          harus lebih menyala untuk menang, dan seluruh halaman jadi ribut.
          Sekarang satu wash hijau sangat tipis; sisanya gelap netral. */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 left-1/2 h-[34rem] w-[52rem] -translate-x-1/2 rounded-full bg-emerald-500/[0.07] blur-[90px]" />
        <div className="absolute inset-0 opacity-[0.02] [background-image:linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:46px_46px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,#000_30%,transparent_75%)]" />
      </div>

      <div className="relative z-10">
        {/* ── HEADER ──
            Dulu SELURUH kepala halaman menempel di puncak layar. Setelah
            grafik masuk, blok itu jadi setinggi ~380 px — di ponsel 667 px
            artinya papan klien yang jadi isi halaman tinggal separuh layar dan
            tidak pernah bisa lebih. Jadi dipecah menurut apa yang dipakai
            berulang: RINGKASAN dibaca sekali lalu boleh menggulir pergi;
            PENCARIAN & FILTER adalah kendali yang harus selalu terjangkau,
            dan cuma itu yang tetap menempel. */}
        <div className="px-4 pt-5 sm:px-6">

          {/* Judul dan aksi SEBARIS di semua lebar. Menumpuknya di ponsel
              memakan satu baris penuh untuk satu tombol, dan tiap piksel di
              kepala halaman dibayar dengan piksel papan klien di bawahnya. */}
          <div className="relative mb-3.5 flex items-start justify-between gap-3 sm:mb-4">
            <div className="min-w-0">
              {/* Lencana konteks. Titik hijau yang berdenyut dipertahankan —
                  itu satu-satunya bagian yang benar-benar menyandi sesuatu
                  (data hidup, kini juga tersinkron sendiri). */}
              <div className="mb-1.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                Workspace · CRM
              </div>
              <h1 className="text-[22px] font-semibold tracking-tight text-white sm:text-2xl lg:text-[30px]">
                Pipeline Klien
              </h1>
              <p className="mt-0.5 truncate text-[12px] text-slate-500">
                {(stat?.total ?? total).toLocaleString("id-ID")} klien · <span className="hidden sm:inline">kelola perjalanan dari lead hingga closing</span><span className="sm:hidden">lead hingga closing</span>
              </p>
            </div>

            <button
              onClick={() => { setEditTarget(undefined); setShowForm(true); }}
              className="mt-1 flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 px-3.5 py-2.5 text-sm font-semibold text-[#04130d] shadow-[0_10px_28px_-12px_rgba(16,185,129,0.9)] transition-all hover:from-emerald-300 hover:to-emerald-400 active:scale-[0.98] sm:px-4"
            >
              <Icon icon="solar:user-plus-bold" className="text-base" />
              <span className="hidden sm:inline">Tambah Klien</span>
              <span className="sm:hidden">Tambah</span>
            </button>
          </div>

          {/* Ringkasan */}
          <div className="relative pb-4">
            <RingkasanCrm stat={stat} memuat={statLoading} />
          </div>
        </div>

        {/* ── TOOLBAR (menempel) ── */}
        <div className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#060810]/90 px-4 py-3 backdrop-blur-2xl sm:px-6">
          <div className="relative flex items-center gap-2.5">
            {/* Search */}
            <div className="relative min-w-0 flex-1">
              <Icon icon="solar:magnifer-bold-duotone" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-500" />
              <input
                type="text"
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Cari nama, WA, atau email…"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 pl-10 pr-9 text-sm text-white placeholder-slate-600 outline-none transition-colors focus:border-emerald-400/50 focus:bg-white/[0.05]"
              />
              {menyegarkan ? (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Icon icon="svg-spinners:ring-resize" className="text-[15px] text-emerald-400/80" />
                </span>
              ) : q ? (
                <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  <Icon icon="solar:close-circle-bold" className="text-base" />
                </button>
              ) : null}
            </div>

            {/* Status dropdown */}
            <StatusDropdown value={statusFilter} onChange={setStatusFilter} />

            {/* Pengurutan. Bawaannya "Prioritas", bukan "Terbaru": daftar CRM
                dibuka untuk memutuskan siapa yang dihubungi sekarang, dan
                urutan waktu masuk tidak pernah menjawab itu. */}
            <UrutDropdown value={urut} onChange={setUrut} />
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div className="px-4 py-5 sm:px-6">
          {loading ? (
            <div className="flex items-center justify-center py-28">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-2 border-emerald-400/20" />
                <div className="absolute inset-0 h-12 w-12 animate-spin rounded-full border-2 border-transparent border-t-emerald-400" />
              </div>
            </div>
          ) : items.length === 0 ? (
            <EmptyState onAdd={() => { setEditTarget(undefined); setShowForm(true); }} />
          ) : barisKlien.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Icon icon="solar:magnifer-zoom-out-bold-duotone" className="text-4xl text-slate-700" />
              <p className="mt-3 text-sm font-semibold text-slate-300">Tidak ada klien pada status ini</p>
              <button onClick={() => setStatusFilter("semua")} className="mt-3 text-[12px] font-semibold text-emerald-400 hover:text-emerald-300">
                Tampilkan semua
              </button>
            </div>
          ) : (
            <>
              {/* Baris konteks di atas daftar: berapa yang tampil, dan — kalau
                  ada — berapa janji yang sudah lewat di antaranya. */}
              <PanelSiapKirim versi={versiRingkasan} onPilih={(id, nama) => setAsetUntuk({ id, nama })} />

              <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11.5px]">
                <span className="text-slate-500">
                  <b className="font-bold text-slate-300">{barisKlien.length}</b> klien
                  {statusFilter !== "semua" && <> · {STATUS_THEME[statusFilter].label}</>}
                </span>
                {telatTampil > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-500/[0.1] px-2 py-0.5 font-semibold text-amber-200">
                    <Icon icon="solar:danger-triangle-bold-duotone" className="text-[13px]" />
                    {telatTampil} follow-up telat
                  </span>
                )}

                {/* Saklar mode pilih. Ditaruh di baris hitungan, bukan di
                    toolbar yang menempel: ia milik DAFTAR di bawahnya, dan
                    kepala tabel — tempat kotak "pilih semua" berdiri — cuma
                    ada di layar lebar. Di ponsel inilah satu-satunya jalan
                    masuknya. */}
                {!modePilih ? (
                  <button
                    onClick={() => setModePilih(true)}
                    className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-semibold text-slate-400 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
                  >
                    <Icon icon="solar:check-square-bold-duotone" className="text-[14px]" />
                    Pilih
                  </button>
                ) : (
                  <div className="ml-auto inline-flex shrink-0 items-center gap-2">
                    <button
                      onClick={toggleSemua}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/[0.12] px-2.5 py-1 font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20"
                    >
                      <Icon icon={semuaTerpilih ? "solar:check-square-bold" : "solar:check-square-linear"} className="text-[14px]" />
                      {semuaTerpilih ? "Batal pilih" : `Pilih semua ${barisKlien.length}`}
                    </button>
                    <button
                      onClick={keluarModePilih}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-semibold text-slate-400 transition-colors hover:text-white"
                    >
                      Selesai
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.035] to-white/[0.015] backdrop-blur-xl">
                {/* Kepala kolom hanya di layar lebar. Di ponsel setiap baris
                    membawa labelnya sendiri lewat bentuk, bukan lewat header
                    yang menggulir pergi. */}
                <div className={`hidden border-b border-white/[0.07] bg-white/[0.02] px-4 py-2.5 text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-slate-500 lg:grid ${KOLOM_DAFTAR} lg:items-center lg:gap-4`}>
                  <span className="flex items-center gap-2.5">
                    {modePilih && (
                      <KotakCentang
                        dipilih={semuaTerpilih}
                        sebagian={terpilihTampil.length > 0 && !semuaTerpilih}
                        onClick={toggleSemua}
                        label="Pilih semua klien yang tampil"
                      />
                    )}
                    Klien
                  </span>
                  <span>Yang dicari</span>
                  <span>Budget &amp; komisi</span>
                  <span>Follow-up</span>
                  <span>Tahap</span>
                  <span className="text-right">Aksi</span>
                </div>

                <motion.div layout className="divide-y divide-white/[0.05]">
                  <AnimatePresence initial={false} mode="popLayout">
                    {barisKlien.map((klien, i) => (
                      <KlienRow
                        key={klien.id_klien}
                        klien={klien}
                        indeks={i}
                        deleting={deleting === klien.id_klien}
                        terbuka={geserTerbuka === klien.id_klien}
                        onGeser={(buka) => { setGeserTerbuka(buka ? klien.id_klien : null); if (buka) tandaiPernahGeser(); }}
                        beriPetunjuk={!pernahGeser && i === 0}
                        onEdit={() => { setEditTarget(klien); setShowForm(true); }}
                        onDelete={() => handleDelete(klien.id_klien, true)}
                        onOpen={() => setDetailOpen(klien)}
                        onMove={(st) => moveStatus(klien.id_klien, st)}
                        onAset={() => setAsetUntuk({ id: klien.id_klien, nama: klien.nama })}
                        modePilih={modePilih}
                        dipilih={terpilih.has(klien.id_klien)}
                        onTogglePilih={() => togglePilih(klien.id_klien)}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              </div>

              {total > barisKlien.length && statusFilter === "semua" && !q && (
                <p className="mt-3 text-center text-[11.5px] text-slate-600">
                  Menampilkan {barisKlien.length} klien terbaru dari {total.toLocaleString("id-ID")} · pakai pencarian untuk menemukan sisanya
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Detail drawer */}
      {detailOpen && (
        <KlienDetailDrawer
          klien={detailOpen}
          onClose={() => setDetailOpen(null)}
          onEdit={() => { setEditTarget(detailOpen); setDetailOpen(null); setShowForm(true); }}
          onDelete={() => handleDelete(detailOpen.id_klien)}
          onMove={(s) => moveStatus(detailOpen.id_klien, s)}
          onKlienUpdated={(updated) => { handleSaved(updated); setDetailOpen(updated); }}
          onPrefDeleted={(prefId) => {
            /* Kriteria berubah → hasil yang tersimpan sudah bukan jawaban atas
               pertanyaan yang sama lagi. Dibuang, lalu dicari ulang. */
            kriteriaBerubah(detailOpen.id_klien, detailOpen.nama);
            const strip = (k: Klien) => ({ ...k, preferensi: k.preferensi.filter(p => p.id_preferensi !== prefId) });
            setDetailOpen(d => d ? strip(d) : null);
            setItems(prev => prev.map(k => k.id_klien === detailOpen.id_klien ? strip(k) : k));
          }}
          onPrefGroupSynced={(semua) => {
            kriteriaBerubah(detailOpen.id_klien, detailOpen.nama);
            const pasang = (k: Klien) => ({ ...k, preferensi: semua });
            setDetailOpen(d => d ? pasang(d) : null);
            setItems(prev => prev.map(k => k.id_klien === detailOpen!.id_klien ? pasang(k) : k));
          }}
        />
      )}

      {/* ── Kabar hasil pencarian ulang sesudah kriteria diubah ──
          Ditaruh di atas toast sinkron karena inilah yang sedang ditunggu
          agent: ia baru saja mengubah kriteria dan ingin tahu apakah
          perubahannya berhasil. Bisa diketuk — kalimat "24 aset cocok" yang
          tidak bisa ditindaklanjuti cuma memindahkan pekerjaan membuka layar,
          tidak menghapusnya. */}
      <AnimatePresence>
        {/* Disembunyikan saat layar Asisten Aset terbuka: toast ini berdiri di
            z-85, di ATAS modal itu (z-80), dan panel melayang yang menutupi
            layar yang sedang dipakai adalah gangguan, bukan kabar. Kalau agent
            sudah membuka asetnya, kabarnya pun sudah tidak diperlukan. */}
        {kabarKriteria && !asetUntuk && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-0 bottom-6 z-[85] flex justify-center px-4"
          >
            <button
              onClick={() => {
                setAsetUntuk({ id: kabarKriteria.id, nama: kabarKriteria.nama });
                setKabarKriteria(null);
              }}
              disabled={kabarKriteria.jumlah === 0}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-2.5 text-left shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-colors ${
                kabarKriteria.jumlah > 0
                  ? "border-emerald-400/30 bg-[#0a0c12]/95 hover:border-emerald-400/60"
                  : "border-white/[0.1] bg-[#0a0c12]/95"
              }`}
            >
              <Icon
                icon={kabarKriteria.jumlah > 0 ? "solar:magic-stick-3-bold-duotone" : "solar:info-circle-bold-duotone"}
                className={`shrink-0 text-lg ${kabarKriteria.jumlah > 0 ? "text-emerald-400" : "text-slate-400"}`}
              />
              <span className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Kriteria {kabarKriteria.nama} diperbarui
                </span>
                <span className={`block text-[13px] font-extrabold ${kabarKriteria.jumlah > 0 ? "text-emerald-100" : "text-slate-300"}`}>
                  {kabarKriteria.jumlah > 0
                    ? `${kabarKriteria.jumlah.toLocaleString("id-ID")} aset cocok — lihat sekarang`
                    : "Belum ada aset yang cocok"}
                </span>
              </span>
              {kabarKriteria.jumlah > 0 && (
                <Icon icon="solar:alt-arrow-right-linear" className="shrink-0 text-base text-emerald-300" />
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BILAH AKSI MODE PILIH ──
          Menempel di dasar layar, bukan di kepala halaman. Yang dipandangi
          orang saat memilih adalah barisnya; tombol hapus yang ikut menggulir
          pergi bersama header memaksa gulir balik hanya untuk mengakhiri
          pekerjaan yang baru saja selesai dikerjakan. */}
      <AnimatePresence>
        {modePilih && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-0 bottom-5 z-[70] flex justify-center px-4"
          >
            <div className="flex w-full max-w-md items-center gap-2 rounded-2xl border border-white/[0.1] bg-[#0a0c12]/95 p-2 pl-3.5 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)] backdrop-blur-xl">
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-slate-400">
                {terpilihTampil.length > 0
                  ? <><b className="text-white">{terpilihTampil.length}</b> klien dipilih</>
                  : "Ketuk baris untuk memilih"}
              </span>
              <button
                onClick={keluarModePilih}
                className="shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12.5px] font-semibold text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                Batal
              </button>
              <button
                onClick={() => { setGagalMassal(null); setKonfirmasiMassal(true); }}
                disabled={terpilihTampil.length === 0}
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-b from-rose-500 to-rose-600 px-3.5 py-2 text-[12.5px] font-bold text-white shadow-[0_10px_28px_-12px_rgba(244,63,94,0.9)] transition-all hover:from-rose-400 hover:to-rose-500 active:scale-[0.97] disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none"
              >
                <Icon icon="solar:trash-bin-trash-bold" className="text-[15px]" />
                Hapus{terpilihTampil.length > 0 ? ` ${terpilihTampil.length}` : ""}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── KONFIRMASI HAPUS MASSAL ──
          Laci geser meminta ketukan kedua di tempat, dan itu cukup untuk SATU
          klien. Menghapus dua belas sekaligus tidak bisa dibatalkan dan tidak
          bisa ditebak dari tombolnya saja, jadi kotak ini menyebutkan siapa
          yang akan hilang — nama, bukan angka — sebelum menanyakannya. */}
      <AnimatePresence>
        {konfirmasiMassal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => { if (!menghapusMassal) setKonfirmasiMassal(false); }}
            className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-rose-400/25 bg-[#0b0d12] p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.95)]"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-rose-400/25 bg-rose-500/[0.12] text-rose-300">
                  <Icon icon="solar:trash-bin-trash-bold" className="text-[19px]" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-bold tracking-tight text-white">
                    Hapus {terpilihTampil.length} klien?
                  </h3>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
                    Preferensi dan riwayat rekomendasi yang menempel ikut terhapus.
                    Tindakan ini tidak bisa dibatalkan.
                  </p>
                </div>
              </div>

              {/* Nama, bukan cuma jumlah: satu baris salah centang di antara
                  dua belas tidak akan pernah ketahuan dari angka. */}
              <div className="mt-3.5 max-h-40 overflow-y-auto rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
                <ul className="space-y-1">
                  {barisKlien
                    .filter(k => terpilih.has(k.id_klien))
                    .map(k => (
                      <li key={k.id_klien} className="flex items-center gap-2 text-[12px] text-slate-300">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_THEME[k.status].dot}`} />
                        <span className="truncate font-semibold">{k.nama}</span>
                        <span className="shrink-0 text-[10.5px] text-slate-600">
                          {k.nomor_whatsapp ? `+${k.nomor_whatsapp}` : "tanpa nomor"}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>

              {gagalMassal && (
                <p className="mt-3 flex items-center gap-1.5 rounded-lg border border-rose-400/25 bg-rose-500/[0.1] px-2.5 py-1.5 text-[11.5px] font-semibold text-rose-200">
                  <Icon icon="solar:danger-triangle-bold" className="shrink-0 text-[13px]" />
                  {gagalMassal}
                </p>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setKonfirmasiMassal(false)}
                  disabled={menghapusMassal}
                  className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-[13px] font-semibold text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
                >
                  Batal
                </button>
                <button
                  onClick={hapusTerpilih}
                  disabled={menghapusMassal}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-rose-500 to-rose-600 py-2.5 text-[13px] font-bold text-white shadow-[0_10px_28px_-12px_rgba(244,63,94,0.9)] transition-all hover:from-rose-400 hover:to-rose-500 active:scale-[0.98] disabled:opacity-60"
                >
                  {menghapusMassal
                    ? <><Icon icon="svg-spinners:ring-resize" className="text-[15px]" /> Menghapus…</>
                    : "Ya, hapus"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sync toast */}
      {syncMsg && (
        <div className="fixed inset-x-0 bottom-6 z-[80] flex justify-center px-4">
          <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-400/30 bg-[#0a0c12]/95 px-4 py-2.5 text-sm font-semibold text-emerald-100 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <Icon icon="solar:check-circle-bold" className="text-base text-emerald-400" />
            {syncMsg}
          </div>
        </div>
      )}

      {/* Asisten aset — dibuka dari panel, dari baris daftar, atau dari tautan
          dalam. Prop `pref` sengaja null: daftarnya gabungan seluruh preferensi
          klien, jadi tidak ada langkah "pilih preferensi" yang harus dilewati. */}
      {asetUntuk && (
        <MatchListingModal
          klienId={asetUntuk.id}
          klienNama={asetUntuk.nama}
          punyaWa
          klienEmail={null}
          prefIds={null}
          praPilih={asetUntuk.aset}
          onClose={() => {
            setAsetUntuk(null);
            /* Bersihkan tautan dalam supaya menyegarkan halaman tidak membuka
               layar yang sama lagi. */
            if (new URLSearchParams(window.location.search).get("klien")) {
              window.history.replaceState({}, "", window.location.pathname);
            }
            load(true); muatStatistik(); setVersiRingkasan(v => v + 1);
          }}
        />
      )}

      {/* Form modal */}
      <KlienFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onSaved={handleSaved}
        editTarget={editTarget}
      />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   STATUS DROPDOWN
   ════════════════════════════════════════════════════════════ */
function StatusDropdown({ value, onChange }: {
  value: KlienStatus | "semua";
  onChange: (v: KlienStatus | "semua") => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  const options: { value: KlienStatus | "semua"; label: string; dot?: string; icon?: string }[] = [
    { value: "semua", label: "Semua Status", icon: "solar:layers-minimalistic-bold-duotone" },
    ...PIPELINE_ORDER.map(s => ({ value: s, label: STATUS_THEME[s].label, dot: STATUS_THEME[s].dot })),
  ];
  const selected = options.find(o => o.value === value)!;
  const isFiltered = value !== "semua";

  return (
    <div ref={ref} className="relative w-[132px] shrink-0 sm:w-[172px]">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`group flex w-full items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-sm transition-all duration-300 ${
          isFiltered
            ? "border-emerald-400/40 bg-emerald-400/[0.06] text-white shadow-[0_0_24px_-12px_rgba(16,185,129,0.8)]"
            : "border-white/[0.08] bg-white/[0.03] text-slate-200 hover:border-white/[0.16]"
        } ${open ? "ring-2 ring-emerald-400/40" : ""}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected.dot
            ? <span className={`h-2 w-2 shrink-0 rounded-full ${selected.dot} shadow-[0_0_8px_currentColor]`} />
            : <Icon icon={selected.icon!} className="shrink-0 text-base text-slate-400" />}
          <span className="truncate font-medium">{selected.label}</span>
        </span>
        <Icon icon="solar:alt-arrow-down-line-duotone"
          className={`shrink-0 text-base text-slate-400 transition-transform duration-300 ${open ? "rotate-180 text-emerald-300" : ""}`} />
      </button>

      <div
        role="listbox"
        className={`absolute right-0 z-50 mt-2 w-[200px] origin-top overflow-hidden rounded-xl border border-white/10 bg-[#0a0c12]/95 p-1.5 backdrop-blur-2xl shadow-[0_24px_60px_-15px_rgba(0,0,0,0.85)] transition-all duration-200 ease-out ${
          open ? "pointer-events-auto translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0"
        }`}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
        <div className="space-y-0.5">
          {options.map(opt => {
            const isSel = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSel}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150 hover:bg-white/[0.07] ${
                  isSel ? "text-white" : "text-slate-300"
                }`}
              >
                {opt.dot
                  ? <span className={`h-2 w-2 shrink-0 rounded-full ${opt.dot} shadow-[0_0_8px_currentColor]`} />
                  : <Icon icon={opt.icon!} className="shrink-0 text-base text-slate-400" />}
                <span className="flex-1 truncate text-left font-medium">{opt.label}</span>
                {isSel && <Icon icon="solar:check-circle-bold" className="shrink-0 text-base text-emerald-400" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   GRID CARD
   ════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════
   PANEL "SIAP KIRIM"
   ------------------------------------------------------------
   Perubahan paling penting di seluruh fitur ini, dan yang paling sedikit
   kodenya. Sebelumnya rekomendasi adalah sesuatu yang harus DICARI agent:
   buka CRM → cari klien → buka kartunya → pilih preferensi → tekan cari.
   Empat dari lima ketukan itu adalah pekerjaan mencari, bukan pekerjaan
   menjual — dan pekerjaan yang butuh lima ketukan untuk dimulai tidak pernah
   jadi kebiasaan harian.

   Panel ini membalik arahnya: begitu halaman terbuka, agent sudah melihat
   siapa yang bisa dikirimi aset hari ini. Satu ketukan membuka asisten dengan
   tiga aset terbaik SUDAH tercentang; ketukan kedua membuka WhatsApp.

   Ia sengaja diam kalau tidak ada apa-apa — panel kosong yang selalu nongol
   akan mengajari mata untuk melewatinya.
   ════════════════════════════════════════════════════════════ */

type SiapKirim = { id_klien: string; nama: string; status: string; jumlah: number; punyaWa: boolean; telat: boolean };

function PanelSiapKirim({ versi, onPilih }: {
  /** Naik setiap kali kriteria seorang klien berubah atau ada aset yang
   *  dikirim. Tanpanya panel ini mengambil datanya SEKALI saat halaman dibuka
   *  dan tidak pernah lagi: agent yang baru saja memperbaiki wilayah seorang
   *  klien tetap membaca "12 aset" dari kriteria yang sudah ia ganti, dan
   *  angka yang salah di panel paling menonjol di layar adalah cara tercepat
   *  membuat seluruh fitur ini tidak dipercaya. */
  versi: number;
  onPilih: (id: string, nama: string) => void;
}) {
  const [items, setItems] = useState<SiapKirim[]>([]);
  const [memuat, setMemuat] = useState(true);

  useEffect(() => {
    let hidup = true;
    fetch("/api/dashboard/klien/rekomendasi-ringkasan")
      .then(r => r.json())
      .then(j => { if (hidup && j.ok) setItems(j.items || []); })
      .catch(() => {})
      .finally(() => { if (hidup) setMemuat(false); });
    return () => { hidup = false; };
  }, [versi]);

  /* Sunyi saat memuat DAN saat kosong. Pencarian ini berjalan sungguhan di
     server, jadi ia tiba beberapa ratus milidetik setelah daftar klien —
     kerangka abu-abu yang berkedip lalu hilang lebih mengganggu daripada
     panel yang muncul begitu isinya siap. */
  if (memuat || items.length === 0) return null;

  const total = items.reduce((n, i) => n + i.jumlah, 0);

  return (
    <div className="mb-3 overflow-hidden rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.08] to-emerald-500/[0.02] p-3 backdrop-blur-xl">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-lg border border-emerald-400/25 bg-emerald-400/10">
          <Icon icon="solar:magic-stick-3-bold-duotone" className="text-[13px] text-emerald-300" />
        </span>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-emerald-200/90">
          Siap dikirim
        </span>
        <span className="text-[11.5px] text-slate-400">
          {total} aset untuk {items.length} klien
        </span>
      </div>

      {/* Menggulir mendatar di ponsel, membungkus di layar lebar. Daftar ini
          pendek menurut rancangan (maksimal delapan), jadi tidak perlu
          kendali gulir apa pun. */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible">
        {items.map(k => {
          const t = STATUS_THEME[k.status as KlienStatus] ?? STATUS_THEME.lead_baru;
          return (
            <button
              key={k.id_klien}
              onClick={() => onPilih(k.id_klien, k.nama)}
              className="group flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] py-1.5 pl-2 pr-2.5 transition-all hover:border-emerald-400/40 hover:bg-emerald-500/[0.12] active:scale-[0.98]"
            >
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-[10px] font-bold ring-1 ${t.grad}`}>
                {initialsOf(k.nama)}
              </span>
              <span className="max-w-[120px] truncate text-[12px] font-bold text-white">{k.nama}</span>
              <span className="rounded-md bg-emerald-400/15 px-1.5 py-0.5 text-[10.5px] font-extrabold text-emerald-300">
                {k.jumlah}
              </span>
              {/* Titik amber = follow-up-nya sudah lewat. Aset baru adalah
                  alasan terbaik untuk menghubungi orang yang terlanjur
                  didiamkan, jadi mereka pantas ditandai. */}
              {k.telat && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400 shadow-[0_0_6px_currentColor]" />}
              {!k.punyaWa && (
                <span title="Belum ada nomor WhatsApp" className="shrink-0 leading-none">
                  <Icon icon="solar:phone-calling-rounded-bold-duotone" className="text-[13px] text-slate-600" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PEMILIH URUTAN
   ════════════════════════════════════════════════════════════ */
function UrutDropdown({ value, onChange }: {
  value: UrutKlien; onChange: (v: UrutKlien) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  const dipilih = URUT_OPSI.find(o => o.value === value)!;

  return (
    <div ref={ref} className="relative shrink-0">
      {/* Di ponsel hanya ikon: pencarian yang berhak atas lebar layar, dan
          urutan adalah kendali yang dipakai sesekali, bukan tiap ketukan. */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={`Urutkan: ${dipilih.label}`}
        className={`flex h-[42px] items-center gap-2 rounded-xl border px-3 text-sm transition-all duration-300 sm:px-3.5 ${
          value !== "prioritas"
            ? "border-emerald-400/40 bg-emerald-400/[0.06] text-white"
            : "border-white/[0.08] bg-white/[0.03] text-slate-200 hover:border-white/[0.16]"
        } ${open ? "ring-2 ring-emerald-400/40" : ""}`}
      >
        <Icon icon={dipilih.icon} className="shrink-0 text-base text-emerald-300/80" />
        <span className="hidden truncate font-medium md:inline">{dipilih.label}</span>
        <Icon icon="solar:alt-arrow-down-line-duotone"
          className={`hidden shrink-0 text-base text-slate-400 transition-transform duration-300 md:inline ${open ? "rotate-180 text-emerald-300" : ""}`} />
      </button>

      <div
        role="listbox"
        className={`absolute right-0 z-50 mt-2 w-[240px] origin-top-right overflow-hidden rounded-xl border border-white/10 bg-[#0a0c12]/95 p-1.5 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.85)] backdrop-blur-2xl transition-all duration-200 ease-out ${
          open ? "pointer-events-auto translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0"
        }`}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
        <p className="px-2 pb-1.5 pt-1 text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Urutkan</p>
        <div className="space-y-0.5">
          {URUT_OPSI.map(opt => {
            const sel = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={sel}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                  sel ? "bg-emerald-400/10 text-white" : "text-slate-300 hover:bg-white/[0.05]"
                }`}
              >
                <Icon icon={opt.icon} className={`shrink-0 text-base ${sel ? "text-emerald-300" : "text-slate-500"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold">{opt.label}</span>
                  <span className="block truncate text-[10.5px] text-slate-500">{opt.hint}</span>
                </span>
                {sel && <Icon icon="solar:check-circle-bold" className="shrink-0 text-[15px] text-emerald-400" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   BARIS KLIEN
   ------------------------------------------------------------
   Dulu setiap klien adalah kartu di grid empat kolom. Kartu memaksa tiap
   klien memakai ruang yang sama besarnya — jadi hanya muat nama, satu baris
   preferensi, dan sebuah tombol; sisanya harus dibuka satu per satu. Enam
   klien saja sudah memenuhi layar, dan agent kehilangan kemampuan yang paling
   dibutuhkan dari sebuah CRM: memindai.

   Baris memuat lebih banyak dalam ruang lebih sedikit karena kolomnya SEJAJAR
   ke bawah — budget bisa dibandingkan antar klien tanpa membaca satu pun
   label. Yang ditambahkan di sini dan tidak pernah ada di kartu: nilai
   komisi, jadwal follow-up berikut keterlambatannya, kontak terakhir, dan
   pemindah tahap satu klik.
   ════════════════════════════════════════════════════════════ */

/* Satu sumber lebar kolom, dipakai bersama oleh kepala tabel dan tiap baris.
   ENAM kolom, dan dua yang terakhir LEBARNYA TETAP — bukan `auto`.

   Kepala tabel dan baris adalah dua grid yang TERPISAH; keduanya hanya
   sejajar bila setiap track menghitung lebarnya tanpa melihat isi. Versi
   sebelumnya memakai `minmax(150px,auto)` di kolom aksi: di header isinya cuma
   kata "AKSI", di baris ada tiga tombol. Track auto itu melar berbeda di
   masing-masing grid, dan sisa lebarnya — yang dibagi track `fr` — jadi
   berbeda pula. Akibatnya seluruh kolom di tengah bergeser: judulnya tidak
   pernah berdiri di atas nilainya. Lebar tetap menghapus seluruh persoalan. */
const KOLOM_DAFTAR =
  "lg:grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.05fr)_148px_196px]";

/** Lebar laci hapus yang tersingkap saat baris digeser. */
const LEBAR_HAPUS = 92;

/* ════════════════════════════════════════════════════════════
   KOTAK CENTANG
   ------------------------------------------------------------
   Digambar sendiri, bukan <input type="checkbox">, dan itu bukan soal selera:
   kotak bawaan mewarisi warna sistem operasi — di papan segelap ini ia muncul
   sebagai kotak putih terang yang lebih menonjol daripada nama klien di
   sebelahnya. Satu-satunya cara meredamnya (`appearance:none`) berarti
   menggambar ulang seluruhnya juga, jadi sekalian.

   Perannya tetap `checkbox`, bukan `button`: pembaca layar harus mengumumkan
   "tercentang / tidak", dan keadaan SEBAGIAN — dipakai kotak "pilih semua" —
   hanya punya nama di kosakata checkbox (`aria-checked="mixed"`).
   ════════════════════════════════════════════════════════════ */
function KotakCentang({ dipilih, sebagian, onClick, label }: {
  dipilih: boolean;
  /** Sebagian anggota tercentang. Kosong dan penuh saja tidak cukup
   *  menjelaskan keadaan kotak "pilih semua" di kepala tabel. */
  sebagian?: boolean;
  onClick: () => void;
  label: string;
}) {
  const aktif = dipilih || sebagian;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={sebagian && !dipilih ? "mixed" : dipilih}
      aria-label={label}
      title={label}
      onClick={e => { e.stopPropagation(); onClick(); }}
      className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[6px] border transition-all active:scale-90 ${
        aktif
          ? "border-emerald-400 bg-emerald-500 text-[#04130d]"
          : "border-white/25 bg-white/[0.04] text-transparent hover:border-emerald-400/70 hover:bg-emerald-500/[0.12]"
      }`}
    >
      {/* SVG sebaris, bukan ikon Iconify: pada 18 px setiap setengah piksel
          terlihat, dan bentuk yang digambar sendiri tidak pernah menunggu
          jaringan untuk muncul. */}
      <svg viewBox="0 0 16 16" className="h-[11px] w-[11px]" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        {sebagian && !dipilih ? <path d="M4 8h8" /> : <path d="M3.5 8.5l3 3 6-6.5" />}
      </svg>
    </button>
  );
}

function KlienRow({ klien, indeks, deleting, terbuka, beriPetunjuk, onGeser, onEdit, onDelete, onOpen, onMove, onAset, modePilih, dipilih, onTogglePilih }: {
  klien: Klien; indeks: number; deleting: boolean;
  /** Sekali seumur pemakaian: baris paling atas menggeser dirinya sendiri
   *  sedikit lalu kembali, memperlihatkan sesobek merah di baliknya. Gerakan
   *  mengajarkan gestur; kalimat "geser untuk hapus" yang menempel permanen
   *  akan berubah jadi hiasan yang tak seorang pun baca lagi. */
  beriPetunjuk?: boolean;
  /** Laci hapus baris ini sedang tersingkap. Dikendalikan induk supaya hanya
   *  SATU baris yang pernah terbuka — dua laci merah menganga sekaligus
   *  terbaca seperti aplikasi yang kehilangan kendali. */
  terbuka: boolean;
  onGeser: (buka: boolean) => void;
  onEdit: () => void; onDelete: () => void; onOpen: () => void;
  onMove: (s: KlienStatus) => void;
  onAset: () => void;
  /** Mode pilih-banyak sedang menyala. Saat menyala SELURUH baris jadi sasaran
   *  centang — mengetuk di mana pun memilih, bukan membuka detail — dan geser
   *  untuk hapus dimatikan supaya dua cara menghapus tidak berebut jempol yang
   *  sama. */
  modePilih: boolean;
  dipilih: boolean;
  onTogglePilih: () => void;
}) {
  const theme = STATUS_THEME[klien.status];
  const prov  = provenanceOf(klien);
  const pref  = ringkasPreferensi(klien);
  const budget = budgetKlien(klien);
  const fu    = jadwalFollowUp(klien.tanggal_follow_up);

  /* Penanda "baru saja digeser". Framer tetap melepas klik setelah pointer
     diangkat, jadi tanpa ini setiap geseran akan sekalian membuka detail
     klien — persis hal yang tidak diinginkan orang yang sedang menggeser. */
  const baruGeser = useRef(false);

  /* Dua ketukan di dalam laci, bukan satu ketukan + dialog browser. Jempol
     yang meleset saat menggeser tidak boleh langsung menghapus seorang klien,
     tapi konfirmasinya harus tetap berada di dalam layar yang sedang disentuh. */
  const [yakin, setYakin] = useState(false);
  useEffect(() => {
    if (!yakin) return;
    const t = setTimeout(() => setYakin(false), 3000);
    return () => clearTimeout(t);
  }, [yakin]);
  useEffect(() => { if (!terbuka) setYakin(false); }, [terbuka]);

  const [mengintip, setMengintip] = useState(!!beriPetunjuk);
  useEffect(() => {
    if (!mengintip) return;
    const t = setTimeout(() => setMengintip(false), 1800);
    return () => clearTimeout(t);
  }, [mengintip]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const bukaDetail = () => {
    if (baruGeser.current) return;
    /* Di mode pilih, seluruh baris adalah sasaran centang. Memaksa jempol
       mengenai kotak 18 px di ujung kiri untuk memilih dua belas orang adalah
       persis pekerjaan yang mode ini ada untuk menghapusnya. */
    if (modePilih) { onTogglePilih(); return; }
    if (terbuka) { onGeser(false); return; }  // geseran terbuka: ketukan pertama menutupnya
    onOpen();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
      transition={{ duration: 0.32, delay: Math.min(indeks, 12) * 0.025, ease: [0.22, 1, 0.36, 1] }}
      className={`relative overflow-hidden ${deleting ? "pointer-events-none opacity-40" : ""}`}
    >
      {/* ── Laci hapus, di belakang baris ──
          Digambar lebih dulu dan diam di tempat; barisnyalah yang bergeser di
          atasnya. Ikonnya membesar mengikuti terbukanya laci supaya geseran
          setengah jalan terasa seperti sesuatu yang sedang terjadi, bukan
          seperti lapisan yang tiba-tiba ada. */}
      <div className={`absolute inset-y-0 right-0 flex items-stretch ${terbuka ? "" : "pointer-events-none"} ${modePilih ? "hidden" : ""}`}>
        <button
          onClick={(e) => { e.stopPropagation(); if (yakin) onDelete(); else setYakin(true); }}
          aria-label={yakin ? `Konfirmasi hapus ${klien.nama}` : `Hapus ${klien.nama}`}
          tabIndex={terbuka && !modePilih ? 0 : -1}
          style={{ width: LEBAR_HAPUS }}
          className={`flex flex-col items-center justify-center gap-0.5 text-white transition-colors ${
            yakin
              ? "bg-gradient-to-l from-rose-500 to-rose-400"
              : "bg-gradient-to-l from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400"
          }`}
        >
          <motion.span
            animate={{ scale: terbuka ? 1 : 0.6, opacity: terbuka || mengintip ? 1 : 0.35 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className="flex flex-col items-center gap-0.5"
          >
            <Icon
              icon={deleting ? "svg-spinners:ring-resize" : yakin ? "solar:danger-triangle-bold" : "solar:trash-bin-trash-bold"}
              className="text-[19px]"
            />
            <span className="text-[10px] font-extrabold uppercase tracking-wide">
              {deleting ? "…" : yakin ? "Yakin?" : "Hapus"}
            </span>
          </motion.span>
        </button>
      </div>

      {/* ── Baris ── */}
      <motion.div
        drag={modePilih ? false : "x"}
        dragDirectionLock
        dragConstraints={{ left: -LEBAR_HAPUS, right: 0 }}
        /* Elastis hanya ke kiri. Menarik ke kanan tidak menyingkap apa pun,
           jadi memberinya karet cuma membuat baris terasa longgar. */
        dragElastic={{ left: 0.06, right: 0 }}
        dragMomentum={false}
        animate={mengintip && !modePilih ? { x: [0, -30, 0] } : { x: terbuka && !modePilih ? -LEBAR_HAPUS : 0 }}
        transition={
          mengintip
            ? { delay: 0.75, duration: 1, times: [0, 0.4, 1], ease: [0.4, 0, 0.2, 1] }
            : { type: "spring", stiffness: 520, damping: 44, mass: 0.6 }
        }
        onDragStart={() => { baruGeser.current = true; }}
        onDragEnd={(_, info) => {
          /* Dua jalan membukanya: ditarik melewati separuh laci, ATAU
             disentak cepat. Yang kedua penting di ponsel — jempol yang cekatan
             jarang menempuh jarak penuh, dan gerakan cepat yang tidak
             menghasilkan apa-apa terasa seperti aplikasi yang tidak menangkap. */
          const buka = info.offset.x < -LEBAR_HAPUS / 2 || info.velocity.x < -420;
          onGeser(buka);
          setTimeout(() => { baruGeser.current = false; }, 60);
        }}
        onClick={bukaDetail}
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key !== "Enter" && !(modePilih && e.key === " ")) return;
          e.preventDefault();
          if (modePilih) onTogglePilih(); else onOpen();
        }}
        aria-selected={modePilih ? dipilih : undefined}
        /* LATAR BARIS HARUS PADAT DI SEMUA KEADAAN — termasuk saat hover.
           Sebelumnya hover memakai `bg-white/[0.035]`, yang bukan menumpuk di
           atas warna dasar melainkan MENGGANTINYA: satu properti
           `background-color`, deklarasi terakhir menang. Hasilnya barisnya jadi
           putih 3,5% alias nyaris tembus pandang, dan laci hapus merah di
           belakangnya muncul begitu kursor lewat — tanpa ada yang menggeser
           apa pun. Warna hover-nya kini padat juga. */
        /* Warna baris terpilih PADAT juga, dengan alasan yang sama seperti
           hover di atas: warna emerald tembus pandang akan menyingkap laci
           merah di belakangnya. */
        className={`group relative cursor-pointer touch-pan-y select-none px-3 py-3 outline-none transition-colors duration-200 focus-visible:bg-[#12151b] lg:grid ${KOLOM_DAFTAR} lg:items-center lg:gap-4 lg:px-4 ${
          dipilih ? "bg-[#0b1712] hover:bg-[#0f2019]" : "bg-[#0a0c0e] hover:bg-[#101318]"
        }`}
      >
        {/* Rel status di tepi kiri: satu-satunya cara membaca tahap seluruh
            daftar dalam satu sapuan mata. */}
        <span className={`pointer-events-none absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-gradient-to-b ${theme.bar} opacity-60 transition-opacity duration-300 group-hover:opacity-100`} />
        {fu?.telat && klien.status !== "lost_iseng" && (
          <span className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-amber-500/[0.07] to-transparent" />
        )}

        {/* ── 1. Klien ── */}
        <div className="relative flex min-w-0 items-center gap-3">
          {modePilih && (
            <KotakCentang
              dipilih={dipilih}
              onClick={onTogglePilih}
              label={`${dipilih ? "Batal pilih" : "Pilih"} ${klien.nama}`}
            />
          )}
          <div className="relative shrink-0">
            <div className={`relative grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-gradient-to-br text-[13px] font-bold ring-1 transition-transform duration-300 group-hover:scale-105 ${theme.grad}`}>
              <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent" />
              <span className="relative">{initialsOf(klien.nama)}</span>
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ${theme.dot} ring-2 ring-[#0a0c0e]`} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-bold leading-tight tracking-tight text-white">{klien.nama}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
              {klien.nomor_whatsapp
                ? <span className="truncate font-medium text-slate-400">+{klien.nomor_whatsapp}</span>
                : <span className="italic text-slate-600">Tanpa nomor</span>}
              <span className="text-slate-700">·</span>
              <Icon icon={prov.icon} className="shrink-0 text-[12px]" />
              <span className="truncate">{prov.label}</span>
            </p>
          </div>

          {/* Tahap ikut di baris nama HANYA di layar kecil; di desktop ia punya
              kolomnya sendiri, tempat ia bisa diklik untuk memindah tahap. */}
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide lg:hidden ${theme.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${theme.dot}`} />
            {theme.label}
          </span>
        </div>

        {/* ── 2. Yang dicari ──
            Di layar kecil TIDAK lagi menjorok 52 px mengikuti avatar. Indentasi
            itu membakar seperlima lebar ponsel demi kerapian yang cuma terlihat
            saat layarnya lebar. */}
        <div className="relative mt-2 min-w-0 lg:mt-0">
          {klien.propertiAsal ? (
            <div className="flex min-w-0 items-center gap-1.5">
              <Icon icon="solar:map-point-bold-duotone" className={`shrink-0 text-[15px] ${theme.text}`} />
              <span className="truncate text-[11.5px] font-semibold text-slate-200">
                {klien.propertiAsal.alamat_lengkap || klien.propertiAsal.kota || klien.propertiAsal.judul}
              </span>
              <span className="shrink-0 rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-slate-400">
                Titip jual
              </span>
            </div>
          ) : pref.tipe.length === 0 ? (
            <span className="text-[11.5px] italic text-slate-600">Belum ada preferensi</span>
          ) : (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {pref.tipe.slice(0, 2).map(t => (
                <span key={t} className="rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-200">
                  {t}
                </span>
              ))}
              {pref.tipe.length > 2 && (
                <span className="text-[10.5px] font-semibold text-slate-500">+{pref.tipe.length - 2}</span>
              )}
              {pref.kota.length > 0 && (
                <span className="inline-flex min-w-0 items-center gap-1 text-[11px] text-slate-500">
                  <Icon icon="solar:map-point-linear" className="shrink-0 text-[12px]" />
                  <span className="truncate">
                    {pref.kota[0]}{pref.kota.length > 1 && ` +${pref.kota.length - 1}`}
                  </span>
                </span>
              )}
              {pref.niat > 1 && (
                <span className={`rounded-md px-1.5 py-0.5 text-[9.5px] font-bold ${theme.badge}`}>{pref.niat} niat</span>
              )}
            </div>
          )}
        </div>

        {/* Pembungkus `lg:contents`: di ponsel ia baris flex yang menaruh uang
            di kiri dan jadwal di kanan; di desktop ia menghilang sebagai kotak
            dan kedua anaknya langsung jadi sel grid ke-3 dan ke-4. Satu markup,
            dua tata letak, tanpa satu pun elemen digandakan. */}
        <div className="relative mt-2 flex items-start justify-between gap-3 lg:contents">
          {/* ── 3. Budget & komisi ── */}
          <div className="min-w-0">
            {budget > 0 ? (
              <>
                <div className={`truncate text-[13.5px] font-extrabold leading-tight tracking-tight ${theme.text}`} title={`Rp ${budget.toLocaleString("id-ID")}`}>
                  {rupiahRingkas(budget)}
                </div>
                <div className="truncate text-[10.5px] text-slate-500" title={`Estimasi ${(RATE_KOMISI * 100).toString().replace(".", ",")}% dari Rp ${budget.toLocaleString("id-ID")}`}>
                  ≈ {rupiahRingkas(budget * RATE_KOMISI)} komisi
                </div>
              </>
            ) : (
              <span className="text-[11.5px] italic text-slate-600">Budget belum diisi</span>
            )}
          </div>

          {/* ── 4. Follow-up ── */}
          <div className="min-w-0 shrink-0 text-right lg:text-left">
            {fu ? (
              <span className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold ${fu.kelas}`}>
                <Icon icon={fu.ikon} className="shrink-0 text-[13px]" />
                <span className="truncate">{fu.label}</span>
              </span>
            ) : (
              <span className="text-[11.5px] text-slate-600">Belum dijadwalkan</span>
            )}
            <div className="mt-1 truncate text-[10.5px] text-slate-600">
              {klien.tanggal_kontak_terakhir
                ? `Kontak ${waktuRelatif(klien.tanggal_kontak_terakhir)}`
                : `Masuk ${waktuRelatif(klien.tanggal_masuk)}`}
            </div>
          </div>
        </div>

        {/* ── 5. Tahap (desktop) ──
            Komponen yang SAMA dengan yang dipakai kartu klien. */}
        <div className="hidden lg:block" onClick={stop}>
          <DropdownTahap nilai={klien.status} onPilih={onMove} gaya="pil" />
        </div>

        {/* ── 6. Aksi ── */}
        <div className="relative mt-2.5 flex items-center gap-1.5 lg:mt-0 lg:justify-end" onClick={stop}>
          {/* Aksi utama, dan ia BERTULISAN. Ikon tongkat sihir sendirian tidak
              memberi tahu siapa pun bahwa di baliknya ada pencarian aset —
              agent yang tidak tahu sebuah tombol untuk apa tidak akan pernah
              menekannya, dan seluruh fitur ini mati di situ. */}
          <button
            onClick={onAset}
            title="Cari aset yang cocok & kirim ke klien ini"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-500/[0.12] px-3 py-2 text-[12px] font-bold text-emerald-200 transition-all hover:border-emerald-400/50 hover:bg-emerald-500/20 hover:text-emerald-100 active:scale-[0.97] lg:flex-none"
          >
            <Icon icon="solar:magic-stick-3-bold-duotone" className="shrink-0 text-[15px]" />
            <span>Cari aset</span>
          </button>

          {klien.nomor_whatsapp ? (
            <a
              href={waHref(klien.nomor_whatsapp, klien.nama)}
              target="_blank"
              rel="noopener noreferrer"
              title="Chat WhatsApp"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-emerald-300/80 transition-all hover:border-emerald-400/40 hover:bg-emerald-500/15 hover:text-emerald-200 active:scale-95 lg:h-8 lg:w-8"
            >
              <Icon icon="ic:baseline-whatsapp" className="text-[17px]" />
            </a>
          ) : (
            <span title="Belum ada nomor" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.06] bg-white/[0.02] text-slate-700 lg:h-8 lg:w-8">
              <Icon icon="ic:baseline-whatsapp" className="text-[17px]" />
            </span>
          )}

          <button onClick={onEdit} title="Edit klien"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-400 transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white active:scale-95 lg:h-8 lg:w-8">
            <Icon icon="solar:pen-2-bold-duotone" className="text-[15px]" />
          </button>
        </div>

      </motion.div>
    </motion.div>
  );
}



/* ════════════════════════════════════════════════════════════
   DROPDOWN TAHAP — dipakai baris daftar DAN kartu klien
   ------------------------------------------------------------
   Panelnya digambar lewat PORTAL ke <body>, bukan di tempatnya berdiri.

   Kedua pemakainya duduk di dalam wadah ber-`overflow-hidden`: baris daftar
   (laci merah geser-hapus bersembunyi di baliknya) dan kartu klien (panel
   melayang dengan sudut membulat). Menu yang menggantung ke bawah akan
   TERPOTONG di garis wadahnya — yang terlihat agent: menunya terbuka tapi
   hanya pilihan teratas tersembul separuh, sisanya tidak bisa diketuk. Terbaca
   sebagai "dropdown rusak", dan memang begitu akibatnya.

   Diekstrak jadi satu komponen, bukan disalin: jebakan itu sudah menggigit
   sekali, dan salinan kedua pasti melupakan salah satu dari tiga penjaganya —
   posisi dihitung sendiri, membuka ke atas bila ruang bawah kurang, dan
   klik-di-luar yang memeriksa DUA simpul (tombol + panel). Memeriksa tombolnya
   saja akan menutup menu pada klik pertama ke pilihannya, dengan gejala yang
   sama persis: "tidak bisa memilih".
   ════════════════════════════════════════════════════════════ */
function DropdownTahap({ nilai, onPilih, gaya, tinggiPanel = 232 }: {
  nilai: KlienStatus;
  onPilih: (s: KlienStatus) => void;
  /** Bentuk tombolnya berbeda di daftar (pil kecil) dan di kartu klien (baris
   *  penuh); isinya sama. */
  gaya: "pil" | "baris";
  tinggiPanel?: number;
}) {
  const [buka, setBuka] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const acuan = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const t = STATUS_THEME[nilai];

  const bukaMenu = useCallback(() => {
    const el = acuan.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    /* Membuka ke ATAS bila ruang di bawah tidak cukup. Tanpa ini, kartu klien
       di dasar layar membuka menu yang separuhnya di luar viewport. */
    const keAtas = r.bottom + tinggiPanel > window.innerHeight && r.top > tinggiPanel;
    setPos({
      top: keAtas ? r.top - tinggiPanel - 6 : r.bottom + 6,
      left: r.left,
      width: Math.max(r.width, 190),
    });
    setBuka(true);
  }, [tinggiPanel]);

  useEffect(() => {
    if (!buka) return;
    const klik = (e: MouseEvent) => {
      const n = e.target as Node;
      if (acuan.current?.contains(n) || panel.current?.contains(n)) return;
      setBuka(false);
    };
    const tutup = () => setBuka(false);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setBuka(false); } };
    document.addEventListener("mousedown", klik);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", tutup, true);
    window.addEventListener("resize", tutup);
    return () => {
      document.removeEventListener("mousedown", klik);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", tutup, true);
      window.removeEventListener("resize", tutup);
    };
  }, [buka]);

  const kelasTombol = gaya === "pil"
    ? `inline-flex w-full items-center gap-1 rounded-full border px-2 py-1 text-[9.5px] font-bold uppercase tracking-wide transition-all hover:brightness-125 ${t.badge}`
    : `flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-bold transition-all hover:brightness-110 ${t.badge}`;

  return (
    <div ref={acuan} className="relative" onClick={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => (buka ? setBuka(false) : bukaMenu())}
        aria-haspopup="listbox"
        aria-expanded={buka}
        title="Pindahkan tahap"
        className={kelasTombol}
      >
        {gaya === "baris"
          ? <Icon icon={t.icon} className="shrink-0 text-sm" />
          : <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.dot}`} />}
        <span className="min-w-0 flex-1 truncate text-left">{t.label}</span>
        <Icon
          icon="solar:alt-arrow-down-line-duotone"
          className={`shrink-0 transition-transform ${gaya === "baris" ? "text-sm" : "text-[11px]"} ${buka ? "rotate-180" : ""}`}
        />
      </button>

      {buka && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={panel}
          role="listbox"
          onClick={e => e.stopPropagation()}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}
          className="z-[95] overflow-hidden rounded-xl border border-white/10 bg-[#0a0c12]/95 p-1.5 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
        >
          {PIPELINE_ORDER.map(st => {
            const m = STATUS_THEME[st];
            const aktif = st === nilai;
            return (
              <button
                key={st}
                type="button"
                role="option"
                aria-selected={aktif}
                disabled={aktif}
                onClick={() => { setBuka(false); onPilih(st); }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold transition-colors ${
                  aktif ? "cursor-default bg-white/[0.05] text-white" : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${m.dot}`} />
                <span className="min-w-0 flex-1 truncate">{m.label}</span>
                {aktif && <Icon icon="solar:check-circle-bold" className="shrink-0 text-[14px] text-emerald-400" />}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   DETAIL DRAWER
   ════════════════════════════════════════════════════════════ */
type PrefGroup = {
  ids: string[];
  rows: PreferensiKlien[];
  types: string[];
  lokasi: string[];
  jenis_transaksi: string | null;
  budget_min: number | null;
  budget_max: number | null;
  luas_min: number | null;
  luas_max: number | null;
  legalitas: string | null;
  dekat_nilai: string | null;
  dekat_radius: number | null;
  alamat_teks: string | null;
  tujuan_beli: string | null;
  catatan: string | null;
};

function KlienDetailDrawer({ klien, onClose, onEdit, onDelete, onMove, onKlienUpdated, onPrefDeleted, onPrefGroupSynced }: {
  klien: Klien; onClose: () => void; onEdit: () => void; onDelete: () => void;
  onMove: (s: KlienStatus) => void;
  onKlienUpdated: (k: Klien) => void;
  onPrefDeleted: (prefId: string) => void;
  /** SELURUH daftar preferensi sesudah transaksi, bukan tambalan.
   *  Sebelumnya berupa (oldIds, newPrefs) dan layar merakit sendiri hasilnya —
   *  yang berarti layar dan database bisa berbeda pendapat begitu sebagian
   *  permintaan gagal. Server sekarang menjawab dengan keadaan akhir, dan itu
   *  yang dipasang apa adanya. */
  onPrefGroupSynced: (semua: PreferensiKlien[]) => void;
}) {
  const [shown, setShown] = useState(false);
  /* DAFTAR id, bukan satu preferensi. Satu kartu preferensi di layar adalah
     beberapa baris di database — satu per tipe properti — jadi "Rumah atau
     Ruko di Gresik" tersimpan sebagai dua baris. Versi sebelumnya mengirim
     `g.rows[0]` saja, sehingga separuh kriteria klien tidak pernah ikut
     dicari dan tidak ada satu pun galat yang memberi tahu. */
  const [matchPrefIds, setMatchPrefIds] = useState<string[] | null>(null);
  const [deletingPrefs, setDeletingPrefs] = useState<Set<string>>(new Set());
  const [editingGroupIdx, setEditingGroupIdx] = useState<number | null>(null);
  /* Mode TAMBAH berdiri terpisah dari mode edit, dan keduanya saling menutup.
     Dua formulir terbuka sekaligus di satu panel sempit membuat agent
     kehilangan jejak mana yang sedang diisinya. */
  const [menambahPref, setMenambahPref] = useState(false);
  const [savingTambah, setSavingTambah] = useState(false);
  const [editForm, setEditForm] = useState<PreferensiForm | null>(null);
  const [openEditPicker, setOpenEditPicker] = useState<PickerPref>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  /* Kegagalan ditampilkan DI DALAM formulirnya, bukan lewat toast di sudut
     layar: di situlah mata agent sedang berada, dan isiannya masih utuh untuk
     dicoba lagi. Satu keadaan dipakai bersama mode tambah & mode edit — hanya
     satu dari keduanya yang bisa terbuka pada satu waktu. */
  const [galatPref, setGalatPref] = useState<string | null>(null);

  // ── Inline CRM edit (catatan & follow-up) ──
  const [editingCrm, setEditingCrm] = useState(false);
  const [crmDraft, setCrmDraft] = useState({ tanggal_follow_up: "", catatan: "" });
  const [savingCrm, setSavingCrm] = useState(false);
  const [crmErr, setCrmErr] = useState<string | null>(null);

  function startEditCrm() {
    setCrmDraft({
      tanggal_follow_up: klien.tanggal_follow_up
        ? String(klien.tanggal_follow_up).slice(0, 16)
        : "",
      catatan: klien.catatan || "",
    });
    setCrmErr(null);
    setEditingCrm(true);
  }

  async function handleSaveCrm() {
    setSavingCrm(true);
    setCrmErr(null);
    try {
      const res = await fetch(`/api/dashboard/klien/${klien.id_klien}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catatan: crmDraft.catatan.trim() || null,
          tanggal_follow_up: crmDraft.tanggal_follow_up || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || `HTTP ${res.status}`);
      }
      const { data } = await res.json();
      onKlienUpdated(data);
      setEditingCrm(false);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("acara:changed", { detail: { mode: "edit" } }));
      }
    } catch (e: unknown) {
      setCrmErr(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSavingCrm(false);
    }
  }

  useEffect(() => { const t = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(t); }, []);

  function startEditGroup(g: PrefGroup, i: number) {
    const seen = new Set<string>();
    const locations: SelectedRegion[] = [];
    for (const row of g.rows) {
      const r = locFieldsToRegion(row);
      if (r) { const k = regionKey(r); if (!seen.has(k)) { seen.add(k); locations.push(r); } }
    }
    setEditForm({
      /* Baris ber-tipe null dibuang dari daftar centang: "semua tipe" adalah
         KETIADAAN pilihan, bukan salah satu pilihan. */
      tipe_properti: Array.from(new Set(g.rows.map(r => r.tipe_properti).filter(Boolean))) as TipeProperti[],
      jenis_transaksi: (g.jenis_transaksi as JenisTransaksi | null) || "",
      locations,
      budget_min: g.budget_min ? fmtRup(String(g.budget_min)) : "",
      budget_max: g.budget_max ? fmtRup(String(g.budget_max)) : "",
      luas_min:   g.luas_min   ? fmtRup(String(g.luas_min))   : "",
      luas_max:   g.luas_max   ? fmtRup(String(g.luas_max))   : "",
      legalitas:  (g.legalitas as Sertifikat | null) || "",
      alamat_teks: g.alamat_teks || "",
      dekat: g.dekat_nilai
        ? { nilai: g.dekat_nilai, nama: g.dekat_nilai, label: "Tempat",
            icon: "solar:map-point-bold-duotone", warna: "emerald",
            radius: g.dekat_radius ?? 1500 }
        : null,
      tujuan_beli: (g.tujuan_beli as TujuanBeli | null) || "",
      catatan: g.catatan || "",
    });
    setEditingGroupIdx(i);
    setOpenEditPicker(null);
    setGalatPref(null);
  }

  function cancelEdit() {
    setEditingGroupIdx(null);
    setEditForm(null);
    setOpenEditPicker(null);
    setGalatPref(null);
  }

  function mulaiTambah() {
    setEditingGroupIdx(null);          // tutup edit yang mungkin sedang terbuka
    setEditForm({ ...EMPTY_PREFERENSI });
    setOpenEditPicker(null);
    setGalatPref(null);
    setMenambahPref(true);
  }

  function batalTambah() {
    setMenambahPref(false);
    setEditForm(null);
    setOpenEditPicker(null);
    setGalatPref(null);
  }

  /**
   * Tulis ulang preferensi lewat SATU permintaan transaksional.
   *
   * `ganti` menyebut baris mana yang digantikan:
   *   []          → hanya menambah; kriteria lain tidak disentuh.
   *   [id, id, …] → kartu itu yang ditulis ulang.
   *
   * Sebelumnya ini rentetan DELETE lalu POST dari browser, tanpa satu pun
   * jawaban yang dibaca. Dua akhir buruknya sama-sama senyap: gagal di tengah
   * menghapus kriteria klien tanpa jejak, dan DELETE yang gagal sementara POST
   * berhasil meninggalkan baris lama sebagai HANTU — layar menampilkan wilayah
   * yang baru, sementara pencarian aset masih memakai wilayah yang lama.
   */
  async function simpanPreferensi(ganti: string[]): Promise<boolean> {
    if (!editForm) return false;
    setGalatPref(null);
    try {
      /* Satu kartu formulir mekar jadi beberapa baris — satu per kombinasi
         tipe × lokasi. Fungsi yang sama dipakai formulir klien, jadi bentuk
         barisnya tidak bisa menyimpang antar jalur. */
      const res = await fetch(`/api/dashboard/klien/${klien.id_klien}/preferensi`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ganti, preferensi: buildPrefPayloads(editForm) }),
      });
      const j = await res.json().catch(() => ({} as any));
      if (!res.ok || !j?.ok) {
        setGalatPref(j?.message || "Gagal menyimpan. Tidak ada yang diubah.");
        return false;
      }
      /* Server mengembalikan SELURUH daftar sesudah transaksi, jadi layar tidak
         perlu menebak baris mana yang bertahan. `ganti` diteruskan sebagai
         "buang semua yang lama" karena daftar barunya sudah lengkap. */
      onPrefGroupSynced(j.data as PreferensiKlien[]);
      return true;
    } catch {
      setGalatPref("Gagal menyimpan. Periksa koneksi lalu coba lagi.");
      return false;
    }
  }

  async function handleSaveTambah() {
    if (!editForm || savingTambah) return;
    setSavingTambah(true);
    try {
      /* Formulir ditutup HANYA kalau benar-benar tersimpan. Menutupnya setelah
         kegagalan membuang isian agent tanpa satu pun penjelasan. */
      if (await simpanPreferensi([])) batalTambah();
    } finally {
      setSavingTambah(false);
    }
  }

  async function handleSaveEdit(g: PrefGroup) {
    if (!editForm || savingEdit) return;
    setSavingEdit(true);
    try {
      if (await simpanPreferensi(g.ids)) {
        setEditingGroupIdx(null);
        setEditForm(null);
        setGalatPref(null);
      }
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeletePrefGroup(ids: string[]) {
    setDeletingPrefs(new Set(ids));
    setGalatPref(null);
    try {
      /* Yang lenyap dari layar adalah yang DIJAWAB server sebagai terhapus,
         bukan yang dikirim. Baris yang gagal dihapus tapi ikut hilang dari
         layar adalah kriteria hantu: tidak terlihat di mana pun, tapi tetap
         ikut menentukan aset mana yang dicarikan untuk klien ini. */
      const hasil = await Promise.all(ids.map(async id => {
        try {
          const r = await fetch(`/api/dashboard/klien/${klien.id_klien}/preferensi/${id}`, { method: "DELETE" });
          return r.ok ? id : null;
        } catch { return null; }
      }));
      const terhapus = hasil.filter((v): v is string => v !== null);
      terhapus.forEach(id => onPrefDeleted(id));
      if (terhapus.length < ids.length) {
        setGalatPref("Sebagian kriteria gagal dihapus. Muat ulang halaman lalu coba lagi.");
      }
    } finally {
      setDeletingPrefs(new Set());
    }
  }
  const handleClose = useCallback(() => { setShown(false); setTimeout(onClose, 220); }, [onClose]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [handleClose]);

  const theme = STATUS_THEME[klien.status];
  const phone = klien.nomor_whatsapp;
  const fu = followUpLabel(klien.tanggal_follow_up);
  const prov = provenanceOf(klien);

  return (
    <div
      className={`fixed inset-0 z-[65] flex items-end justify-center bg-black/60 backdrop-blur-xl transition-opacity duration-200 sm:items-center ${shown ? "opacity-100" : "opacity-0"}`}
      onClick={handleClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] border-t border-white/[0.1] bg-[#0a0c12] shadow-[0_-30px_80px_rgba(0,0,0,0.7)] transition-transform duration-300 sm:max-h-[88vh] sm:rounded-[28px] sm:border ${shown ? "translate-y-0" : "translate-y-10"}`}
      >
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${theme.bar}`} />
        <div className={`pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full ${theme.glow} blur-3xl`} />
        <div className="absolute left-1/2 top-2.5 z-20 h-1 w-12 -translate-x-1/2 rounded-full bg-white/20 sm:hidden" />

        <button onClick={handleClose} className="absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-full border border-white/[0.1] bg-white/[0.06] text-slate-200 transition-all hover:bg-white/[0.12]">
          <Icon icon="solar:close-circle-bold" className="text-lg" />
        </button>

        {/* Header */}
        <header className="relative shrink-0 border-b border-white/[0.06] px-5 pb-5 pt-9 sm:pt-6">
          <div className="flex items-center gap-4">
            <div className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br text-lg font-extrabold ring-1 ${theme.grad}`}>
              {initialsOf(klien.nama)}
            </div>
            <div className="min-w-0">
              <p className="text-[16px] font-bold text-white">{klien.nama}</p>
              <p className="text-[12px] text-slate-400">{phone ? `+${phone}` : "Belum ada nomor"}</p>
            </div>
          </div>

          {/* ── Tahap pipeline ──
              Dulu lima chip yang membungkus jadi dua baris — sekitar 70px
              tinggi di puncak kartu, untuk sesuatu yang jarang diubah. Sebagai
              dropdown ia jadi satu baris, dan ruang yang dihemat langsung
              terpakai: nama klien, kriteria, dan tombol aksi naik ke atas
              lipatan layar ponsel. */}
          <div className="mt-4">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Tahap Pipeline</p>
            <DropdownTahap nilai={klien.status} onPilih={onMove} gaya="baris" />
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <InfoSection title="Asal Prospek" icon={prov.icon}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500">Sumber</span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-[11px] font-semibold text-slate-200">
                <Icon icon={prov.icon} className="text-[11px] text-slate-400" />
                {prov.label}
              </span>
            </div>
            {klien.propertiAsal && (
              <a
                href={propertiHref(klien.propertiAsal)}
                target="_blank" rel="noopener noreferrer"
                className="mt-1 flex items-start gap-2 rounded-xl border border-emerald-400/15 bg-emerald-500/[0.06] px-3 py-2 transition-colors hover:border-emerald-400/30 hover:bg-emerald-500/10"
              >
                <Icon icon="solar:map-point-bold-duotone" className="mt-0.5 shrink-0 text-base text-emerald-300" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[12px] font-bold leading-snug text-white">
                    {klien.propertiAsal.alamat_lengkap || klien.propertiAsal.kota || klien.propertiAsal.judul}
                  </p>
                  {klien.propertiAsal.alamat_lengkap && klien.propertiAsal.kota && (
                    <p className="mt-0.5 text-[10px] text-slate-400">{klien.propertiAsal.kota}</p>
                  )}
                </div>
                <Icon icon="solar:arrow-right-up-line-duotone" className="mt-0.5 shrink-0 text-sm text-slate-500" />
              </a>
            )}
          </InfoSection>

          <InfoSection title="Kontak" icon="solar:phone-calling-bold-duotone">
            <InfoRow label="WhatsApp" value={phone ? `+${phone}` : "—"} />
            <InfoRow label="Email"    value={klien.email || "—"} />
            <InfoRow label="Sumber"   value={SUMBER_LABEL[klien.sumber]} />
          </InfoSection>

          <InfoSection title="Pembayaran" icon="solar:card-bold-duotone">
            <InfoRow label="Metode" value={klien.metode_pembayaran
              ? { cash: "Cash", kpr: "KPR", cash_bertahap: "Cash Bertahap" }[klien.metode_pembayaran]
              : "Belum ditentukan"} />
            {klien.metode_pembayaran === "kpr" && (
              <>
                <InfoRow label="Bank KPR" value={klien.bank_kpr || "—"} />
                <InfoRow label="Tenor"    value={klien.tenor_kpr ? `${klien.tenor_kpr} tahun` : "—"} />
              </>
            )}
          </InfoSection>

          {/* SELALU dirender, termasuk saat kosong. Versi lama menyembunyikan
              seluruh bagian ini kalau klien belum punya preferensi — dan
              karena menambah preferensi hanya bisa dari dalamnya, klien baru
              terkunci dalam lingkaran: tidak ada pintu masuk sama sekali,
              satu-satunya jalan adalah membuka "Edit Klien" dan menebak.
              Justru klien yang belum punya kriteria yang PALING butuh tombol
              ini — seluruh asisten aset tidak bisa bekerja untuk mereka. */}
          {(() => {
            const map = new Map<string, PrefGroup>();
            for (const p of klien.preferensi) {
              /* Sidik jari yang SAMA dengan yang dipakai formulir klien saat
                 mengelompokkan baris jadi kartu (src/.../FormPreferensi.tsx).
                 Dua rumus terpisah untuk pertanyaan yang sama — "baris mana
                 yang satu kartu" — akan menghasilkan jumlah kartu yang berbeda
                 di dua layar untuk klien yang sama.

                 Angkanya dinormalkan di dalam sidiknya: Decimal yang lewat JSON
                 pernah datang sebagai "500000000" dari satu endpoint dan
                 500000000 dari endpoint lain, dan itu memecah satu kartu jadi
                 dua persis sesudah disimpan. */
              const sig = sidikKriteria(p);
              let g = map.get(sig);
              if (!g) {
                g = {
                  ids: [], rows: [], types: [], lokasi: [],
                  jenis_transaksi: p.jenis_transaksi ?? null,
                  legalitas: p.legalitas ?? null,
                  dekat_nilai: p.dekat_nilai ?? null,
                  dekat_radius: p.dekat_radius ?? null,
                  alamat_teks: p.alamat_teks ?? null,
                  budget_min: p.budget_min ? Number(p.budget_min) : null,
                  budget_max: p.budget_max ? Number(p.budget_max) : null,
                  luas_min:   p.luas_min   ? Number(p.luas_min)   : null,
                  luas_max:   p.luas_max   ? Number(p.luas_max)   : null,
                  tujuan_beli: p.tujuan_beli ?? null,
                  catatan:     p.catatan ?? null,
                };
                map.set(sig, g);
              }
              g.ids.push(p.id_preferensi);
              g.rows.push(p);
              const tl = p.tipe_properti
                ? p.tipe_properti.charAt(0) + p.tipe_properti.slice(1).toLowerCase().replace(/_/g, " ")
                : "Semua tipe";
              if (!g.types.includes(tl)) g.types.push(tl);
              if (p.lokasi_dicari && !g.lokasi.includes(p.lokasi_dicari)) g.lokasi.push(p.lokasi_dicari);
            }
            const groups = Array.from(map.values());

            const adaFormTambah = menambahPref && editForm;

            return (
              <InfoSection title="Preferensi Properti" icon="solar:home-bold-duotone">
                {/* ── Keadaan kosong ──
                    Bukan sekadar "belum ada data". Kalimatnya menjelaskan APA
                    yang hilang kalau dibiarkan kosong, karena preferensi bukan
                    kolom pelengkap: ia satu-satunya bahan bakar pencarian aset,
                    email pengingat, dan tugas otomatis. Klien tanpa preferensi
                    tidak akan pernah muncul di mana pun. */}
                {groups.length === 0 && !adaFormTambah && (
                  <div className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] px-4 py-5 text-center">
                    <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10">
                      <Icon icon="solar:magic-stick-3-bold-duotone" className="text-xl text-emerald-300" />
                    </div>
                    <p className="mt-2.5 text-[13px] font-bold text-white">Belum ada kriteria</p>
                    <p className="mx-auto mt-1 max-w-[15rem] text-[11.5px] leading-relaxed text-slate-500">
                      Isi tipe, lokasi, dan budget yang dicari — asisten langsung mencarikan asetnya,
                      dan mengabari Anda saat ada yang baru masuk.
                    </p>
                    <button
                      onClick={mulaiTambah}
                      className="mt-3.5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-2.5 text-[12.5px] font-extrabold text-[#04130d] transition-all hover:from-emerald-400 hover:to-emerald-300"
                    >
                      <Icon icon="solar:add-circle-bold" className="text-sm" />
                      Tambah Kriteria Pertama
                    </button>
                  </div>
                )}

                {groups.map((g, i) => {
                  const isDel = g.ids.some(id => deletingPrefs.has(id));
                  const isEditing = editingGroupIdx === i;

                  return (
                    <div
                      key={i}
                      className={`rounded-xl border transition-all duration-200 ${
                        isEditing
                          ? "border-emerald-400/30 bg-emerald-500/[0.04] shadow-[0_0_20px_-8px_rgba(52,211,153,0.15)]"
                          : "border-white/[0.06] bg-white/[0.02]"
                      }`}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {isEditing && editForm ? (
                          /* ── MODE EDIT INLINE ──
                             Komponen yang SAMA dengan formulir tambah. */
                          <FormPreferensi
                            form={editForm}
                            setForm={setEditForm}
                            pickerTerbuka={openEditPicker}
                            setPicker={setOpenEditPicker}
                            judul={`Edit Preferensi #${i + 1}`}
                            ikon="solar:pen-2-bold-duotone"
                            labelSimpan="Simpan Perubahan"
                            menyimpan={savingEdit}
                            galat={galatPref}
                            onBatal={cancelEdit}
                            onSimpan={() => handleSaveEdit(g)}
                          />
                        ) : (
                          /* ── MODE BACA ── */
                          <motion.div
                            key="read"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 6 }}
                            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                            className="space-y-1.5 p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[11px] font-bold text-slate-300">Preferensi #{i + 1}</p>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => startEditGroup(g, i)}
                                  title="Edit preferensi ini"
                                  className="grid h-6 w-6 place-items-center rounded-md border border-white/[0.08] bg-white/[0.03] text-slate-400 transition-all hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-300"
                                >
                                  <Icon icon="solar:pen-2-bold-duotone" className="text-[11px]" />
                                </button>
                                <button
                                  onClick={() => handleDeletePrefGroup(g.ids)}
                                  disabled={isDel}
                                  title="Hapus preferensi ini"
                                  className="grid h-6 w-6 place-items-center rounded-md border border-rose-400/20 bg-rose-500/10 text-rose-300 transition-all hover:bg-rose-500/20 disabled:opacity-50"
                                >
                                  <Icon icon={isDel ? "solar:refresh-circle-bold-duotone" : "solar:trash-bin-2-bold-duotone"} className={`text-[11px] ${isDel ? "animate-spin" : ""}`} />
                                </button>
                              </div>
                            </div>
                            <InfoRow label="Tipe" value={g.types.join(", ")} />
                            {g.jenis_transaksi && <InfoRow label="Jenis" value={g.jenis_transaksi} />}
                            {g.lokasi.length > 0 && <InfoRow label="Lokasi" value={g.lokasi.join(", ")} />}
                            {(g.budget_min || g.budget_max) && (
                              <InfoRow label="Budget" value={"Rp " + [formatRp(g.budget_min), formatRp(g.budget_max)].filter(Boolean).join(" – ")} />
                            )}
                            {(g.luas_min || g.luas_max) && (
                              <InfoRow label={labelLuas(g.types)} value={[g.luas_min, g.luas_max].filter(Boolean).join(" – ") + " m²"} />
                            )}
                            {g.dekat_nilai && <InfoRow label="Dekat" value={`${g.dekat_nilai}${g.dekat_radius ? ` · ${(g.dekat_radius/1000).toFixed(1).replace(".", ",")} km` : ""}`} />}
                            {g.legalitas && <InfoRow label="Sertifikat" value={SERTIFIKAT_LABEL[g.legalitas as Sertifikat] ?? g.legalitas} />}
                            {g.tujuan_beli && <InfoRow label="Tujuan" value={{ ditempati: "Ditempati", investasi: "Investasi", disewakan: "Disewakan" }[g.tujuan_beli] ?? g.tujuan_beli} />}
                            {g.catatan && <InfoRow label="Catatan" value={g.catatan} />}
                            <button
                              onClick={() => setMatchPrefIds(g.ids)}
                              className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-500/10 py-2 text-[12px] font-bold text-emerald-200 transition-all hover:bg-emerald-500/20"
                            >
                              <Icon icon="solar:magnifer-bold-duotone" className="text-sm" />
                              Cari Listing Cocok
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}

                {/* ── Formulir tambah ── */}
                <AnimatePresence mode="wait" initial={false}>
                  {adaFormTambah && (
                    <FormPreferensi
                      className="rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.04]"
                      form={editForm!}
                      setForm={setEditForm}
                      pickerTerbuka={openEditPicker}
                      setPicker={setOpenEditPicker}
                      judul="Preferensi Baru"
                      ikon="solar:add-circle-bold-duotone"
                      labelSimpan="Simpan Preferensi"
                      menyimpan={savingTambah}
                      galat={galatPref}
                      onBatal={batalTambah}
                      onSimpan={handleSaveTambah}
                    />
                  )}
                </AnimatePresence>

                {/* Tombol tambah hanya muncul saat TIDAK ada formulir terbuka.
                    Tombol "tambah" di bawah formulir tambah yang sedang terisi
                    adalah undangan untuk kehilangan isian. */}
                {groups.length > 0 && !adaFormTambah && editingGroupIdx === null && (
                  <button
                    onClick={mulaiTambah}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] py-2.5 text-[12px] font-bold text-slate-300 transition-all hover:border-emerald-400/40 hover:bg-emerald-500/[0.06] hover:text-emerald-200"
                  >
                    <Icon icon="solar:add-circle-bold-duotone" className="text-sm" />
                    Tambah Preferensi
                  </button>
                )}
              </InfoSection>
            );
          })()}

          <InfoSection title="Catatan & Follow Up" icon="solar:clipboard-text-bold-duotone">
            <AnimatePresence mode="wait" initial={false}>
              {editingCrm ? (
                <motion.div
                  key="crm-edit"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/20">
                      <Icon icon="solar:pen-2-bold-duotone" className="text-[10px] text-amber-300" />
                    </div>
                    <p className="text-[11px] font-bold text-amber-300">Edit Catatan & Follow Up</p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Jadwal Follow Up
                    </label>
                    <PremiumDateTimePicker
                      value={crmDraft.tanggal_follow_up}
                      onChange={v => setCrmDraft(d => ({ ...d, tanggal_follow_up: v }))}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Catatan
                    </label>
                    <textarea
                      value={crmDraft.catatan}
                      onChange={e => setCrmDraft(d => ({ ...d, catatan: e.target.value }))}
                      placeholder="Tulis catatan tentang klien ini..."
                      rows={3}
                      className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-white placeholder-slate-600 outline-none transition-all focus:border-amber-400/50 focus:bg-white/[0.05]"
                    />
                  </div>

                  {crmErr && (
                    <p className="text-[11px] text-rose-300">{crmErr}</p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingCrm(false)}
                      className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-[12px] font-bold text-slate-300 transition-all hover:border-white/20 hover:text-white"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleSaveCrm}
                      disabled={savingCrm}
                      className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 py-2.5 text-[12px] font-extrabold text-[#140a00] transition-all hover:from-amber-400 hover:to-amber-300 disabled:opacity-50"
                    >
                      {savingCrm
                        ? <><Icon icon="solar:refresh-circle-bold-duotone" className="animate-spin text-sm" /> Menyimpan...</>
                        : <><Icon icon="solar:check-circle-bold" className="text-sm" /> Simpan</>
                      }
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="crm-read"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-1.5"
                >
                  {fu ? (
                    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${fu.urgent ? "border-amber-400/30 bg-amber-500/10" : "border-white/[0.06] bg-white/[0.02]"}`}>
                      <Icon icon="solar:bell-bing-bold-duotone" className={`shrink-0 text-base ${fu.urgent ? "text-amber-300" : "text-slate-400"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Follow Up</p>
                        <p className={`text-[13px] font-bold ${fu.urgent ? "text-amber-200" : "text-slate-200"}`}>{fu.text}</p>
                      </div>
                      {fu.urgent && (
                        <span className="shrink-0 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">Segera</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-dashed border-white/[0.08] px-3 py-2 text-slate-600">
                      <Icon icon="solar:calendar-add-bold-duotone" className="shrink-0 text-base" />
                      <span className="text-[12px] italic">Belum ada jadwal follow up</span>
                    </div>
                  )}

                  <InfoRow label="Tanggal Masuk" value={new Date(klien.tanggal_masuk).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} />

                  {klien.catatan ? (
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Catatan</p>
                      <p className="text-[12px] leading-relaxed text-slate-200">{klien.catatan}</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/[0.08] px-3 py-2 text-slate-600">
                      <span className="text-[12px] italic">Belum ada catatan</span>
                    </div>
                  )}

                  <button
                    onClick={startEditCrm}
                    className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 py-2 text-[12px] font-bold text-amber-200 transition-all hover:bg-amber-500/20"
                  >
                    <Icon icon="solar:pen-2-bold-duotone" className="text-sm" />
                    Edit Catatan & Follow Up
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </InfoSection>
        </div>

        {/* Footer */}
        <footer className="shrink-0 space-y-2 border-t border-white/[0.06] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {phone && (
            <a href={waHref(phone, klien.nama)} target="_blank" rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 py-2.5 text-sm font-bold text-emerald-100 transition-all hover:bg-emerald-500/20">
              <Icon icon="ic:baseline-whatsapp" className="text-base" />
              Chat WhatsApp
            </a>
          )}
          <div className="flex gap-2">
            <button onClick={onDelete} className="flex-1 rounded-xl border border-rose-400/20 bg-rose-500/10 py-2.5 text-sm font-semibold text-rose-300 transition-all hover:bg-rose-500/20">
              Hapus
            </button>
            <button onClick={onEdit} className="flex-[2] rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 py-2.5 text-sm font-extrabold text-[#04130d] transition-all hover:from-emerald-400 hover:to-emerald-300">
              Edit Klien
            </button>
          </div>
        </footer>
      </div>

      {matchPrefIds && (
        <MatchListingModal
          klienId={klien.id_klien}
          klienNama={klien.nama}
          punyaWa={!!klien.nomor_whatsapp}
          klienEmail={klien.email}
          prefIds={matchPrefIds}
          onClose={() => setMatchPrefIds(null)}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   ASISTEN ASET — modal pencarian & pengiriman
   ------------------------------------------------------------
   Dulu layar ini hanya sebuah daftar: cari aset yang cocok, lalu setiap kartu
   punya tombol WhatsApp sendiri. Akibatnya agent yang ingin mengirim empat
   aset harus mengirim empat pesan terpisah, dan tidak ada satu pun jejak
   siapa pernah dikirimi apa — sehingga minggu depan ia mengirim rumah yang
   sama lagi, dan klien mengira agennya tidak ingat percakapan mereka.

   Sekarang layar ini punya dua muka:
     COCOK    — pilih beberapa aset sekaligus, satu pesan, satu ketukan.
     TERKIRIM — apa yang pernah dikirim, bagaimana tanggapan klien, dan apa
                yang berubah sejak itu.
   ════════════════════════════════════════════════════════════ */

/** Satu PILL di layar Asisten Aset = satu kriteria yang DIRASAKAN agent,
 *  bukan satu baris `preferensi_klien`. Formulir menyimpan "Gudang di
 *  Surabaya, Sidoarjo, Gresik" sebagai tiga baris; menampilkannya sebagai tiga
 *  pill membocorkan bentuk penyimpanan ke layar dan membuat klien yang punya
 *  dua kriteria terlihat punya empat. Pengelompokannya dikerjakan server
 *  (src/lib/klienRingkas.ts) supaya sama persis dengan kartu klien. */
type PrefRingkasan = {
  id_grup: string;
  ids: string[];
  label: string;
  maksud: string;
  /** Seluruh kecocokan kriteria ini, termasuk yang tidak muat di daftar. */
  total: number;
  /** Yang benar-benar ada di daftar untuk grup ini — INI yang ditulis di pill.
   *  Menulis `total` di pill lalu menampilkan lebih sedikit adalah cara
   *  tercepat membuat agent berhenti percaya angkanya. */
  ditampilkan: number;
};

type MatchedListing = {
  id_property: string;
  /** Preferensi yang paling menjelaskan kenapa aset ini muncul — yang dicatat
   *  saat dikirim. */
  id_preferensi: string;
  /** Grup kriteria yang paling menjelaskan kenapa aset ini muncul. */
  grup?: string;
  /** SEMUA grup yang mencocoki aset ini. Satu aset bisa memenuhi dua kriteria
   *  klien yang sama; menyaring hanya lewat satu grup akan membuatnya
   *  menghilang dari yang lain tanpa alasan yang terlihat. */
  cocok_grup?: string[];
  slug: string;
  judul: string;
  kota: string;
  kecamatan: string;
  kelurahan: string;
  alamat_lengkap: string;
  jenis_transaksi: string;
  kategori: string;
  harga: number;
  harga_asli: number;
  harga_promo: number | null;
  nilai_limit_lelang: number | null;
  gambar: string;
  luas_tanah: number;
  luas_bangunan: number;
  kamar_tidur: number;
  kamar_mandi: number;
  agent_name: string;
  agent_office: string;
  skor: number;
  alasan: string[];
};

type Diagnosa = {
  totalTanpaFilterLunak: number;
  jikaBudgetNaik10: number;
  jikaLokasiDiperluas: number;
  jikaLuasDiabaikan: number;
  jikaBentukDiabaikan: number;
  tingkatLokasi: string;
  adaBudget: boolean;
  adaLuas: boolean;
  adaBentuk: boolean;
  /** Preferensi mana yang didiagnosa. Klien bisa punya beberapa, dan saran
   *  "naikkan plafon 10%" tanpa menyebut plafon yang mana tidak bisa
   *  ditindaklanjuti. */
  id_preferensi?: string;
  label?: string;
};

type PerubahanKiriman = {
  id: string;
  jenis: "HARGA_TURUN" | "HARGA_NAIK" | "TERJUAL" | "DITARIK" | "LELANG_DEKAT";
  harga_lama: number | null;
  harga_baru: number | null;
  selisih_persen: number | null;
  terdeteksi_pada: string;
};

type ItemTerkirim = {
  id_kiriman: string;
  id_property: string;
  slug: string;
  judul: string;
  kota: string;
  kecamatan: string;
  jenis_transaksi: string;
  kategori: string;
  gambar: string;
  status_tayang: string;
  harga_sekarang: number;
  harga_saat_kirim: number;
  harga_diketahui: number;
  jumlah_kirim: number;
  terakhir_dikirim: string;
  tanggapan: string;
  alasan_tanggapan: string | null;
  perubahan: PerubahanKiriman[];
};

/** Aset yang disingkirkan agent dari daftar rekomendasi seorang klien.
 *  Sengaja BUKAN `MatchedListing`: barisnya tidak punya skor, alasan, maupun
 *  preferensi asal — semua itu dihitung saat pencocokan, dan aset ini justru
 *  yang dikeluarkan dari pencocokan. Memakai bentuk yang sama akan memaksa
 *  separuh medannya diisi nilai palsu. */
type ItemDisingkirkan = {
  id_property: string;
  slug: string;
  judul: string;
  kategori: string;
  jenis_transaksi: string;
  alamat_lengkap: string;
  harga: number;
  gambar: string;
  luas_tanah: number;
  luas_bangunan: number;
  alasan: string | null;
  disingkirkan_pada: string;
  /** Aset yang sudah terjual tidak akan kembali ke daftar "Cocok" walau
   *  dipulihkan — dikatakan di kartunya, bukan dibiarkan jadi teka-teki. */
  masih_tersedia: boolean;
};

const TANGGAPAN_META: Record<string, { label: string; kelas: string; ikon: string }> = {
  MENUNGGU:     { label: "Menunggu",   kelas: "border-white/[0.08] bg-white/[0.04] text-slate-400",        ikon: "solar:clock-circle-bold-duotone" },
  SUKA:         { label: "Suka",       kelas: "border-emerald-400/25 bg-emerald-500/[0.12] text-emerald-200", ikon: "solar:like-bold-duotone" },
  TIDAK_COCOK:  { label: "Tidak cocok",kelas: "border-white/[0.08] bg-white/[0.03] text-slate-500",         ikon: "solar:dislike-bold-duotone" },
  MINTA_SURVEI: { label: "Minta survei",kelas: "border-amber-400/25 bg-amber-500/[0.12] text-amber-200",    ikon: "solar:calendar-mark-bold-duotone" },
  DEAL:         { label: "Deal",       kelas: "border-emerald-400/40 bg-emerald-500/20 text-emerald-100",   ikon: "solar:cup-star-bold-duotone" },
};

const PERUBAHAN_META: Record<string, { label: string; kelas: string; ikon: string }> = {
  HARGA_TURUN:  { label: "Harga turun",  kelas: "border-emerald-400/30 bg-emerald-500/[0.12] text-emerald-200", ikon: "solar:graph-down-bold-duotone" },
  HARGA_NAIK:   { label: "Harga naik",   kelas: "border-amber-400/30 bg-amber-500/[0.12] text-amber-200",       ikon: "solar:graph-up-bold-duotone" },
  TERJUAL:      { label: "Sudah laku",   kelas: "border-rose-400/30 bg-rose-500/[0.12] text-rose-200",          ikon: "solar:lock-bold-duotone" },
  DITARIK:      { label: "Ditarik",      kelas: "border-slate-400/25 bg-slate-500/[0.12] text-slate-300",       ikon: "solar:archive-bold-duotone" },
  LELANG_DEKAT: { label: "Lelang dekat", kelas: "border-amber-400/30 bg-amber-500/[0.12] text-amber-200",       ikon: "solar:hammer-bold-duotone" },
};

/* ── SIMPANAN HASIL PENCARIAN ───────────────────────────────────────────────
   Layar ini menjalankan satu query pencocokan PER BARIS preferensi, dan tiap
   query menarik kolam sampai 600 baris untuk disaring ketat di JavaScript.
   Untuk klien dengan empat baris preferensi, membukanya berarti empat kali
   pekerjaan itu — dan agent membuka layar yang sama berkali-kali dalam satu
   sesi: buka, lihat, tutup, buka lagi untuk klien sebelumnya.

   Isinya juga tidak berubah secepat itu. Listing baru masuk dalam hitungan
   jam, bukan detik. Maka hasilnya disimpan, ditampilkan SEKETIKA saat dibuka
   lagi, lalu disegarkan diam-diam di belakang layar. Agent tidak pernah
   menunggu untuk melihat sesuatu yang sudah pernah ia lihat.

   Disimpan di modul, bukan di React state: seluruh maksudnya justru bertahan
   melewati pelepasan komponen. Ikut hilang saat halaman dimuat ulang, dan itu
   memang batas yang tepat — tidak ada yang perlu bertahan lebih lama dari
   satu sesi tab. */
type IsiSimpanan = {
  items: MatchedListing[];
  /** Kode agent yang sedang login — ditempelkan di ekor tautan detail. */
  idAgent: string | null;
  diagnosa: Diagnosa | null;
  daftarPref: PrefRingkasan[];
  tanpaPref: boolean;
  nama: string;
  adaWa: boolean;
  terpilih: string[];
  /** Berapa aset yang sedang disingkirkan. Datang dari server bersama daftar
   *  "cocok" supaya lencana tab "Disingkirkan" sudah benar SEBELUM tabnya
   *  pernah dibuka — lencana yang baru muncul setelah diketuk tidak pernah
   *  memberi tahu agent bahwa di sana ada sesuatu. */
  jumlahSingkir: number;
  waktu: number;
  /** Versi kriteria klien saat hasil ini diambil. Lihat `versiKriteria`. */
  versi: number;
};
const simpananCocok = new Map<string, IsiSimpanan>();

/* ── VERSI KRITERIA ────────────────────────────────────────────────────────
   Membuang simpanan saja TIDAK CUKUP, dan inilah lubang yang paling lama tidak
   terlihat.

   Layar Asisten Aset menyegarkan dirinya diam-diam di belakang data yang sudah
   terpampang. Kalau agent menyunting kriteria tepat saat penyegaran itu masih
   di jalan, urutannya jadi: simpanan dibuang → jawaban LAMA tiba → jawaban itu
   ditulis ke simpanan dengan stempel waktu BARU. Simpanan pun berisi hasil
   dari kriteria yang sudah tidak ada lagi, dan karena stempelnya segar, layar
   menampilkannya seketika tanpa merasa perlu memuat ulang.

   Yang terlihat agent persis seperti aplikasi yang mengabaikan suntingannya:
   wilayah sudah diganti, tombol cari ditekan, daftarnya sama saja.

   Penghitung ini menutupnya. Tiap perubahan kriteria menaikkan versinya;
   jawaban yang berangkat sebelum kenaikan itu tidak lagi berhak menulis. */
const versiKriteria = new Map<string, number>();
const versiKlien = (klienId: string) => versiKriteria.get(klienId) ?? 0;

/** Umur simpanan sebelum layar memilih memuat dari nol (dengan pemintal)
 *  alih-alih menampilkan yang lama dulu. Lima menit: cukup lama untuk menutupi
 *  perpindahan antar klien, cukup pendek supaya data yang benar-benar basi
 *  tidak pernah tampil tanpa penyegaran. */
const UMUR_SIMPANAN_MS = 5 * 60_000;

/** Buang simpanan satu klien. Dipanggil sesudah mengirim: aset yang baru saja
 *  dikirim harus hilang dari daftar "cocok", dan simpanan yang tidak dibuang
 *  akan menampilkannya lagi seolah belum pernah dikirim. */
function buangSimpanan(klienId: string) {
  for (const k of [...simpananCocok.keys()]) {
    if (k.startsWith(`${klienId}|`)) simpananCocok.delete(k);
  }
  versiKriteria.set(klienId, versiKlien(klienId) + 1);
}

/**
 * Kriteria klien berubah → cari ulang SEKARANG, di belakang layar.
 *
 * Membuang simpanan saja belum cukup. Agent yang baru saja memperbaiki plafon
 * budget ingin tahu apakah perbaikannya berhasil — dan tanpa jawaban, ia harus
 * membuka layar Asisten Aset hanya untuk mencari tahu, lalu menunggu pemintal
 * yang sama seperti sebelum ada simpanan. Dua langkah yang seluruhnya bisa
 * dihapus: pencarian dijalankan begitu kriterianya disimpan, hasilnya
 * dilaporkan sebagai satu kalimat, dan layarnya terbuka seketika saat diketuk.
 *
 * Sengaja TIDAK melempar galat. Ini pekerjaan latar yang memperbaiki
 * pengalaman, bukan yang menentukan kebenaran — kegagalannya cukup dibalas
 * dengan `null`, dan layar Asisten Aset tetap bisa memuat sendiri seperti biasa.
 *
 * @returns jumlah kecocokan, atau null bila gagal / tidak bisa dipastikan.
 */
async function cariUlangDiamDiam(klienId: string): Promise<number | null> {
  buangSimpanan(klienId);
  const versi = versiKlien(klienId);
  try {
    const r = await fetch(`/api/dashboard/klien/${klienId}/rekomendasi/siap`);
    const j = await r.json();
    if (!j?.ok) return null;
    /* Kriteria berubah LAGI selagi pencarian ini berjalan? Jawabannya sudah
       basi sebelum tiba. Dibuang diam-diam; putaran berikutnya yang benar. */
    if (versiKlien(klienId) !== versi) return null;
    simpananCocok.set(`${klienId}|`, {
      items: j.items || [],
      idAgent: j.idAgent ?? null,
      diagnosa: j.diagnosa || null,
      daftarPref: j.preferensi || [],
      tanpaPref: !!j.tanpaPreferensi,
      nama: j.klien?.nama || "",
      adaWa: !!j.klien?.punyaWa,
      terpilih: Array.isArray(j.terpilih) ? j.terpilih : [],
      jumlahSingkir: j.jumlahDisingkirkan ?? 0,
      waktu: Date.now(),
      versi,
    });
    return typeof j.total === "number" ? j.total : (j.items?.length ?? 0);
  } catch {
    return null;
  }
}

/** Apakah dua daftar preferensi menyebut kriteria yang sama?
 *
 *  Dipakai untuk memutuskan apakah pencarian ulang perlu dijalankan. Formulir
 *  edit klien MENULIS ULANG seluruh preferensi, jadi id-nya selalu berubah
 *  meskipun agent cuma mengganti nomor telepon — membandingkan id akan membuat
 *  setiap penyuntingan catatan memicu empat query pencocokan yang tidak ada
 *  gunanya. Yang dibandingkan ISI kriterianya.
 *
 *  ── HARUS MEMUAT SETIAP KOLOM YANG DIBACA MESIN PENCOCOKAN ───────────────
 *  Versi sebelumnya menimbang tujuh kolom saja, dan melewatkan lima yang
 *  seluruhnya ikut menentukan hasil: keempat kolom `loc_*` (ia cuma melihat
 *  label `lokasi_dicari`), sertifikat, patokan tempat, radius, dan patokan
 *  alamat. Akibatnya nyata: mengganti patokan dari "dekat UNESA" ke "dekat
 *  Tunjungan Plaza" dianggap BUKAN perubahan, simpanan hasil tidak dibuang,
 *  dan layar Asisten Aset menyajikan daftar dari kriteria yang sudah tidak
 *  ada lagi.
 *
 *  Kolom yang TIDAK ikut cuma yang tidak dibaca mesin: `catatan` dan
 *  `tujuan_beli` — keduanya keterangan untuk manusia. Menyertakannya hanya
 *  akan membuat pembetulan salah ketik memicu pencarian penuh. */
function kriteriaSama(a: PreferensiKlien[], b: PreferensiKlien[]): boolean {
  if (a.length !== b.length) return false;
  const n = (v: unknown) => (v === null || v === undefined || v === "" ? "" : String(Number(v)));
  const sidik = (p: PreferensiKlien) => JSON.stringify([
    p.tipe_properti ?? "", p.jenis_transaksi ?? "",
    p.loc_provinsi ?? "", p.loc_kota ?? "", p.loc_kecamatan ?? "", p.loc_kelurahan ?? "",
    n(p.budget_min), n(p.budget_max), n(p.luas_min), n(p.luas_max),
    p.legalitas ?? "", p.dekat_nilai ?? "", n(p.dekat_radius), p.alamat_teks ?? "",
  ]);
  const kiri  = a.map(sidik).sort();
  const kanan = b.map(sidik).sort();
  return kiri.every((v, i) => v === kanan[i]);
}

function MatchListingModal({ klienId, klienNama, punyaWa, klienEmail, prefIds, praPilih, onClose }: {
  klienId: string;
  /** Petunjuk awal saja — nama sebenarnya datang dari API, karena layar ini
   *  bisa dibuka dari panel "siap kirim" dan dari tautan dalam yang tidak
   *  memuat data klien apa pun. */
  klienNama: string;
  punyaWa: boolean;
  klienEmail: string | null;
  /** null = GABUNGAN seluruh preferensi klien. Inilah jalur normalnya: agent
   *  tidak pernah berpikir "kirim aset dari preferensi kedua Budi", ia
   *  berpikir "kirimkan sesuatu untuk Budi".
   *
   *  Berupa DAFTAR, bukan satu preferensi. Satu kartu preferensi di layar
   *  sebenarnya beberapa baris di database — satu per tipe properti — jadi
   *  "Rumah atau Ruko di Gresik" tersimpan sebagai dua baris. Mengirimkan
   *  hanya baris pertama, seperti sebelumnya, membuat separuh kriteria klien
   *  tidak pernah ikut dicari, dan tidak ada satu pun pesan galat yang
   *  memberi tahu bahwa itu terjadi. */
  prefIds: string[] | null;
  /** id_property yang langsung tercentang saat layar terbuka — dipakai tautan
   *  dari email/tugas yang sudah menyebut aset tertentu. */
  praPilih?: string[];
  onClose: () => void;
}) {
  const [shown, setShown] = useState(false);
  const [tab, setTab] = useState<"cocok" | "terkirim" | "disingkirkan">("cocok");

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MatchedListing[]>([]);
  const [diagnosa, setDiagnosa] = useState<Diagnosa | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [terkirim, setTerkirim] = useState<ItemTerkirim[]>([]);
  const [loadingKirim, setLoadingKirim] = useState(true);

  const [dipilih, setDipilih] = useState<Set<string>>(new Set());
  const [mengirim, setMengirim] = useState(false);
  const [draf, setDraf] = useState<{ pesan: string; waUrl: string | null } | null>(null);

  /* ── PENYINGKIRAN ────────────────────────────────────────────────────────
     Aset yang tidak cocok karena alasan yang tidak punya kolom di preferensi
     (menghadap makam, sertifikat bersengketa, klien sudah pernah melihatnya).
     Tanpa ini, aset yang sama naik ke puncak daftar tiap kali layar dibuka
     sampai agent berhenti membaca daftarnya. */
  const [disingkirkan, setDisingkirkan] = useState<ItemDisingkirkan[]>([]);
  /** Hitungan dari server, dipakai lencana tab SEBELUM daftarnya pernah dimuat.
   *  Begitu daftarnya ada, daftarnya yang jadi kebenaran — angka yang lebih
   *  besar daripada jumlah baris yang muncul saat diketuk akan terbaca sebagai
   *  kerusakan, dan agent tidak punya cara memastikan mana yang benar. */
  const [jumlahSingkir, setJumlahSingkir] = useState(0);
  const [loadingSingkir, setLoadingSingkir] = useState(false);
  const [singkirDimuat, setSingkirDimuat] = useState(false);
  const [memulihkan, setMemulihkan] = useState<Set<string>>(new Set());
  /** Batch terakhir yang disingkirkan, untuk bilah "Urungkan".
   *  Menyimpan POSISI aslinya, bukan cuma id: mengembalikan aset ke ujung
   *  daftar setelah "Urungkan" membuat agent kehilangan tempatnya dan mengira
   *  yang kembali adalah aset yang berbeda. */
  const [urung, setUrung] = useState<{ item: MatchedListing; indeks: number }[]>([]);
  const urungTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Galat SATU KETUKAN — dipisahkan dari `error`, yang mengganti seluruh isi
   *  tab. Kegagalan menyingkirkan satu kartu tidak boleh menghapus daftar yang
   *  barusan dibaca agent; ia cukup dikatakan di tempat yang sama dengan bilah
   *  "Urungkan", lalu pergi sendiri. */
  /** Berapa aset yang disingkirkan per grup preferensi SEJAK muatan terakhir.
   *  Dipakai mengoreksi `total` dari server, yang tidak tahu apa-apa tentang
   *  penyingkiran yang baru terjadi sedetik lalu. Disetel ulang tiap kali data
   *  segar datang — sesudah itu server sudah memperhitungkannya sendiri. */
  const [kurangGrup, setKurangGrup] = useState<Map<string, number>>(new Map());
  const [aksiGalat, setAksiGalat] = useState<string | null>(null);
  const galatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Penyegaran "susulan" yang diredam — lihat catatan di `singkirkan()`. */
  const susulTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lapor = useCallback((pesan: string) => {
    setAksiGalat(pesan);
    if (galatTimer.current) clearTimeout(galatTimer.current);
    galatTimer.current = setTimeout(() => setAksiGalat(null), 4000);
  }, []);
  useEffect(() => () => {
    if (urungTimer.current) clearTimeout(urungTimer.current);
    if (galatTimer.current) clearTimeout(galatTimer.current);
    if (susulTimer.current) clearTimeout(susulTimer.current);
  }, []);

  useEffect(() => { const t = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(t); }, []);
  const close = useCallback(() => { setShown(false); setTimeout(onClose, 200); }, [onClose]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [close]);

  const [nama, setNama] = useState(klienNama);
  const [adaWa, setAdaWa] = useState(punyaWa);
  const [tanpaPref, setTanpaPref] = useState(false);
  const [idAgent, setIdAgent] = useState<string | null>(null);
  const [daftarPref, setDaftarPref] = useState<PrefRingkasan[]>([]);
  /* Preferensi mana yang sedang disorot DI LAYAR — beda dari `prefIds`, yang
     menentukan apa yang diminta dari server. Penyaringannya di sisi klien:
     datanya sudah ada, dan menembak ulang server untuk menyembunyikan baris
     membuat penyaring terasa berat padahal pekerjaannya nol. */
  const [sorot, setSorot] = useState<string | null>(null);

  const kunciPref = (prefIds ?? []).join(",");

  const kunciSimpanan = `${klienId}|${kunciPref}`;

  /** Pasang isi simpanan ke layar. Dipisah dari pengambilannya supaya jalur
   *  "tampilkan yang lama" dan jalur "pasang yang baru" memakai kode yang
   *  sama — kalau tidak, keduanya akan menyimpang dan salah satunya lupa
   *  menyetel sesuatu. */
  const pasang = useCallback((c: IsiSimpanan, pilihkan: boolean) => {
    setItems(c.items);
    setDiagnosa(c.diagnosa);
    setTanpaPref(c.tanpaPref);
    setIdAgent(c.idAgent);
    setDaftarPref(c.daftarPref);
    setNama(c.nama);
    setAdaWa(c.adaWa);
    setJumlahSingkir(c.jumlahSingkir);
    /* Data segar sudah memperhitungkan penyingkiran; koreksi lokalnya habis
       masa berlakunya di sini. Lupa menyetelnya ulang membuat sisa "menyusul"
       terus mengecil tiap penyegaran sampai jadi nol selamanya. */
    setKurangGrup(new Map());
    if (pilihkan) {
      /* Tautan dari email sudah menyebut aset mana yang dimaksud; centangnya
         harus mengikuti itu, bukan tiga teratas versi server — kalau tidak,
         agent yang mengetuk "kirim 3 aset ini" dari email bisa mengirim tiga
         aset yang lain. */
      const dariTautan = (praPilih ?? []).filter(id => c.items.some(x => x.id_property === id));
      /* Tiga aset terbaik langsung tercentang. Layar yang terbuka dengan nol
         pilihan memaksa agent memutuskan sesuatu sebelum bisa bertindak, dan
         keputusan itulah gesekan yang sebenarnya — mencabut centang jauh lebih
         murah daripada memasangnya. */
      const awal = dariTautan.length > 0 ? dariTautan : c.terpilih;
      if (awal.length > 0) setDipilih(new Set(awal));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * @param diam jangan tampilkan pemintal — dipakai saat menyegarkan di balik
   *   data lama yang sudah terpampang. Pemintal di atas isi yang benar dan
   *   terbaca hanya membuat layar terasa lebih lambat daripada sebenarnya.
   */
  const muatCocok = useCallback((diam = false) => {
    if (!diam) setLoading(true);
    setError(null);
    /* Dicatat SEBELUM berangkat. Kalau agent menyunting kriteria selagi
       permintaan ini di jalan, jawabannya sudah menjawab pertanyaan yang lain —
       dan menampilkannya (apalagi menyimpannya) berarti menyajikan hasil
       kriteria lama sebagai hasil kriteria baru. */
    const versi = versiKlien(klienId);
    const url = kunciPref
      ? `/api/dashboard/klien/${klienId}/rekomendasi/siap?pref=${encodeURIComponent(kunciPref)}`
      : `/api/dashboard/klien/${klienId}/rekomendasi/siap`;
    return fetch(url)
      .then(r => r.json())
      .then(j => {
        if (!j.ok) { if (!diam) setError(j.message || "Gagal memuat"); return; }
        if (versiKlien(klienId) !== versi) return;
        const isi: IsiSimpanan = {
          items: j.items || [],
          idAgent: j.idAgent ?? null,
          diagnosa: j.diagnosa || null,
          daftarPref: j.preferensi || [],
          tanpaPref: !!j.tanpaPreferensi,
          nama: j.klien?.nama || klienNama,
          adaWa: !!j.klien?.punyaWa,
          terpilih: Array.isArray(j.terpilih) ? j.terpilih : [],
          jumlahSingkir: j.jumlahDisingkirkan ?? 0,
          waktu: Date.now(),
          versi,
        };
        simpananCocok.set(kunciSimpanan, isi);
        /* Saat menyegarkan diam-diam, centang TIDAK disetel ulang: agent bisa
           sedang memilih aset ketika jawabannya tiba, dan pilihan yang tiba-
           tiba berubah sendiri adalah kehilangan kendali yang paling menjengkelkan. */
        pasang(isi, !diam);
      })
      .catch(() => { if (!diam) setError("Gagal memuat"); })
      .finally(() => { if (!diam) setLoading(false); });
  }, [klienId, klienNama, kunciPref, kunciSimpanan, pasang]);

  const muatTerkirim = useCallback(() => {
    setLoadingKirim(true);
    return fetch(`/api/dashboard/klien/${klienId}/rekomendasi`)
      .then(r => r.json())
      .then(j => { if (j.ok) setTerkirim(j.items || []); })
      .catch(() => {})
      .finally(() => setLoadingKirim(false));
  }, [klienId]);

  const muatDisingkirkan = useCallback(() => {
    setLoadingSingkir(true);
    return fetch(`/api/dashboard/klien/${klienId}/rekomendasi/singkirkan`)
      .then(r => r.json())
      .then(j => { if (j.ok) { setDisingkirkan(j.items || []); setJumlahSingkir((j.items || []).length); } })
      .catch(() => {})
      .finally(() => { setLoadingSingkir(false); setSingkirDimuat(true); });
  }, [klienId]);

  /** Tulis ulang daftar "cocok" ke simpanan.
   *
   *  WAJIB, dan ini yang paling mudah terlupa: `items` di layar dan
   *  `simpananCocok` adalah dua salinan dari daftar yang sama. Menyingkirkan
   *  aset hanya dari `items` membuatnya muncul lagi begitu agent menutup dan
   *  membuka layar dalam lima menit — persis perilaku yang sedang diperbaiki
   *  fitur ini, dan agent akan menyimpulkan tombolnya tidak berfungsi. */
  const simpanItems = useCallback((baru: MatchedListing[]) => {
    const c = simpananCocok.get(kunciSimpanan);
    if (c) simpananCocok.set(kunciSimpanan, { ...c, items: baru });
  }, [kunciSimpanan]);

  /** Singkirkan satu aset — OPTIMISTIS.
   *
   *  Kartunya hilang seketika, permintaannya menyusul. Menunggu jawaban server
   *  sebelum menganimasikan keluar membuat tombol terasa macet pada koneksi
   *  4G yang biasa dipakai agent di lapangan; kalau gagal, kartunya kembali ke
   *  posisi semula dan galatnya dikatakan. */
  const singkirkan = useCallback(async (id: string) => {
    const indeks = items.findIndex(x => x.id_property === id);
    if (indeks < 0) return;
    const dibuang = { item: items[indeks], indeks };

    /* Efek samping (menulis simpanan) dihitung DI LUAR updater `setItems`.
       React StrictMode memanggil updater dua kali, dan simpanan yang ditulis
       dari dalamnya akan ditulis dua kali juga — kebetulan tidak berbahaya di
       sini, tapi pola yang sama sudah pernah menggandakan permintaan jaringan
       di berkas ini. */
    const sisa = items.filter(x => x.id_property !== id);
    setItems(sisa);
    simpanItems(sisa);
    /* Centangnya ikut dicabut. Aset yang tidak lagi di layar tapi masih
       terhitung di "Siapkan pesan · 3 aset" adalah cara paling cepat mengirim
       aset yang baru saja dibuang. */
    setDipilih(prev => { const n = new Set(prev); n.delete(id); return n; });

    /* Batch, bukan satu: agent yang membuang lima aset berturut-turut tidak
       ingin lima bilah "Urungkan" bergantian — ia ingin satu yang mengembalikan
       kelimanya. Timernya disetel ulang tiap penambahan. */
    setUrung(prev => [...prev, dibuang]);
    setJumlahSingkir(n => n + 1);
    setKurangGrup(prev => {
      const n = new Map(prev);
      for (const g of dibuang.item.cocok_grup ?? []) n.set(g, (n.get(g) ?? 0) + 1);
      return n;
    });
    if (urungTimer.current) clearTimeout(urungTimer.current);
    urungTimer.current = setTimeout(() => setUrung([]), 7000);

    try {
      const r = await fetch(`/api/dashboard/klien/${klienId}/rekomendasi/singkirkan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_property: id }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.message || "gagal");
      /* Tab "Disingkirkan" hanya disegarkan kalau memang sudah pernah dibuka.
         Menariknya untuk tab yang belum pernah dilihat agent adalah permintaan
         jaringan yang tidak menghasilkan satu piksel pun. */
      if (singkirDimuat) muatDisingkirkan();
      /* SUSULAN. Daftar ini dipotong (24 teratas), jadi menyingkirkan satu aset
         membuka satu slot — dan aset berikutnya seharusnya naik menggantikannya.
         Tanpa ini agent harus menutup lalu membuka layar untuk melihatnya, dan
         daftar yang menyusut terus tanpa pernah terisi ulang terbaca seperti
         persediaan yang habis.

         Diredam: agent yang membuang lima kartu beruntun akan memicu lima
         pencarian penuh, dan yang keempat tiba saat ia sudah membaca hasil
         kelima — daftar yang berubah sendiri di bawah kursor. Satu penyegaran,
         1,2 detik sesudah ketukan TERAKHIR. */
      if (susulTimer.current) clearTimeout(susulTimer.current);
      susulTimer.current = setTimeout(() => { buangSimpanan(klienId); muatCocok(true); }, 1200);
    } catch {
      /* Kembalikan ke POSISI SEMULA, bukan ke ujung daftar. */
      setItems(prev => {
        if (prev.some(x => x.id_property === id)) return prev;
        const baru = [...prev];
        baru.splice(Math.min(dibuang.indeks, baru.length), 0, dibuang.item);
        return baru;
      });
      setUrung(prev => prev.filter(u => u.item.id_property !== id));
      setJumlahSingkir(n => Math.max(0, n - 1));
      setKurangGrup(prev => {
        const n = new Map(prev);
        for (const g of dibuang.item.cocok_grup ?? []) n.set(g, Math.max(0, (n.get(g) ?? 0) - 1));
        return n;
      });
      /* `aksiGalat`, BUKAN `error`. `error` mengganti SELURUH isi tab dengan
         satu baris merah — kegagalan satu ketukan tidak boleh menghapus daftar
         yang barusan dibaca agent. */
      lapor("Gagal menyingkirkan aset — coba lagi");
    }
  }, [items, klienId, simpanItems, singkirDimuat, muatDisingkirkan]);

  /** Kembalikan aset ke daftar. Dipakai bilah "Urungkan" DAN tombol "Pulihkan"
   *  di tab Disingkirkan — satu jalur, supaya keduanya tidak menyimpang. */
  const pulihkan = useCallback(async (ids: string[], kembalikan?: { item: MatchedListing; indeks: number }[]) => {
    if (ids.length === 0) return;
    setMemulihkan(prev => new Set([...prev, ...ids]));
    try {
      const r = await fetch(
        `/api/dashboard/klien/${klienId}/rekomendasi/singkirkan?id=${ids.join(",")}`,
        { method: "DELETE" },
      );
      const j = await r.json();
      if (!j?.ok) throw new Error();
      setDisingkirkan(prev => prev.filter(d => !ids.includes(d.id_property)));
      setJumlahSingkir(n => Math.max(0, n - ids.length));
      if (kembalikan?.length) {
        /* Jalur "Urungkan": kartunya masih ada di memori, jadi bisa dikembalikan
           ke posisi semula tanpa menembak server lagi. Dimasukkan dari indeks
           terkecil supaya posisi yang tersimpan tetap berarti. */
        const baru = [...items];
        for (const u of [...kembalikan].sort((a, b) => a.indeks - b.indeks)) {
          if (baru.some(x => x.id_property === u.item.id_property)) continue;
          baru.splice(Math.min(u.indeks, baru.length), 0, u.item);
        }
        setItems(baru);
        simpanItems(baru);
        setKurangGrup(prev => {
          const n = new Map(prev);
          for (const u of kembalikan) {
            for (const g of u.item.cocok_grup ?? []) n.set(g, Math.max(0, (n.get(g) ?? 0) - 1));
          }
          return n;
        });
      } else {
        /* Jalur "Pulihkan" dari tab Disingkirkan: kartunya tidak ada di memori
           (bentuk datanya pun berbeda — tanpa skor & alasan), dan menebak
           posisinya di daftar berperingkat adalah menebak. Muat ulang. */
        buangSimpanan(klienId);
        muatCocok(true);
      }
    } catch {
      lapor("Gagal memulihkan aset — coba lagi");
    } finally {
      setMemulihkan(prev => { const n = new Set(prev); ids.forEach(i => n.delete(i)); return n; });
    }
  }, [items, klienId, simpanItems, muatCocok]);

  const urungkan = useCallback(() => {
    if (urungTimer.current) clearTimeout(urungTimer.current);
    /* WAJIB. Penyegaran susulan yang terlanjur dijadwalkan akan menimpa daftar
       tepat setelah kartunya dikembalikan — kartu yang muncul lalu hilang lagi
       sendiri adalah kerusakan yang paling meyakinkan. */
    if (susulTimer.current) clearTimeout(susulTimer.current);
    const batch = urung;
    setUrung([]);
    pulihkan(batch.map(u => u.item.id_property), batch);
  }, [urung, pulihkan]);

  useEffect(() => {
    const tersimpan = simpananCocok.get(kunciSimpanan);
    /* Sabuk kedua di samping `buangSimpanan`. Simpanan yang versinya tertinggal
       diperlakukan seolah tidak ada — lebih baik memutar pemintal sebentar
       daripada menampilkan daftar yang jawaban atas kriteria yang sudah
       dihapus agent sendiri. */
    const c = tersimpan && tersimpan.versi === versiKlien(klienId) ? tersimpan : undefined;
    if (c) {
      /* Tampilkan yang lama SEKETIKA, lalu segarkan di belakang layar. Yang
         dihindari bukan sekadar detik menunggunya, melainkan layar kosong
         berpemintal untuk daftar yang isinya hampir pasti sama dengan yang
         barusan dilihat agent. */
      pasang(c, true);
      setLoading(false);
      if (Date.now() - c.waktu > UMUR_SIMPANAN_MS) muatCocok(true);
    } else {
      muatCocok();
    }
    muatTerkirim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunciSimpanan]);

  const togglePilih = (id: string) => setDipilih(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id);
    /* Enam adalah batas yang sama dengan yang ditegakkan server. Ditegakkan
       juga di sini supaya agent tahu batasnya SEBELUM menekan kirim, bukan
       lewat pesan galat setelahnya. */
    else if (n.size < 6) n.add(id);
    return n;
  });

  async function kirim() {
    if (dipilih.size === 0 || mengirim) return;
    setMengirim(true);
    try {
      const res = await fetch(`/api/dashboard/klien/${klienId}/rekomendasi/kirim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [...dipilih],
          /* PETA, bukan satu nilai. Aset dalam satu pesan bisa datang dari
             kriteria yang berbeda — klien yang mencari "rumah Gresik ≤500jt"
             DAN "ruko Surabaya ≤1M" menerima keduanya sekaligus — dan
             mencatat semuanya di bawah satu preferensi membuat laporan
             "kriteria mana yang menghasilkan closing" bohong sejak awal. */
          pref_map: Object.fromEntries(
            items.filter(i => dipilih.has(i.id_property)).map(i => [i.id_property, i.id_preferensi]),
          ),
        }),
      });
      const j = await res.json();
      if (!j.ok) { setError(j.message || "Gagal mencatat kiriman"); return; }
      setDraf({ pesan: j.pesan, waUrl: j.waUrl });
      setDipilih(new Set());
      /* Aset yang barusan dikirim harus lenyap dari daftar "cocok". Simpanan
         yang tidak dibuang akan menampilkannya lagi seolah belum pernah
         dikirim — dan anti-dobel yang terlihat bocor merusak kepercayaan pada
         seluruh buku kiriman. */
      buangSimpanan(klienId);
      muatCocok(); muatTerkirim();
    } finally {
      setMengirim(false);
    }
  }

  const perluDikabari = terkirim.filter(t => t.perubahan.length > 0).length;

  /* Chip penyaring hanya muncul kalau memang ADA yang bisa disaring. Satu chip
     tunggal di atas daftar cuma menyita ruang dan menyiratkan ada pilihan lain
     yang sebenarnya tidak ada. */
  const adaBanyakPref = daftarPref.length > 1;
  /* Berapa kecocokan yang ADA tapi belum muat di daftar — dihitung untuk
     lingkup yang sedang dilihat, bukan global. */
  /* Angka di pill DIHITUNG ULANG dari `items` yang ada di layar, bukan dipakai
     apa adanya dari server (`p.ditampilkan`).
     Sebabnya penyingkiran: begitu satu kartu dibuang, angka dari server jadi
     lebih besar satu daripada jumlah baris yang benar-benar terlihat — dan
     angka yang meleset satu pun akan terlihat, lalu membuat agent meragukan
     seluruh daftarnya. Server tetap yang menentukan APA isinya; layar yang
     menentukan BERAPA yang sedang ditampilkannya. */
  const hitungGrup = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) for (const g of it.cocok_grup ?? []) m.set(g, (m.get(g) ?? 0) + 1);
    return m;
  }, [items]);

  const sisaBelumTampil = useMemo(() => {
    /* `total` (persediaan seluruhnya) ikut dikoreksi oleh penyingkiran yang
       belum sempat disegarkan ke server — aset yang dibuang tidak akan
       "menyusul setelah ini dikirim", jadi menghitungnya di sana adalah janji
       yang tidak akan ditepati. */
    if (sorot) {
      const g = daftarPref.find(p => p.id_grup === sorot);
      if (!g) return 0;
      return Math.max(0, g.total - (kurangGrup.get(sorot) ?? 0) - (hitungGrup.get(sorot) ?? 0));
    }
    const total = daftarPref.reduce((n, p) => n + p.total - (kurangGrup.get(p.id_grup) ?? 0), 0);
    return Math.max(0, total - items.length);
  }, [daftarPref, sorot, items.length, hitungGrup, kurangGrup]);
  const tampil = useMemo(
    () => (sorot ? items.filter(i => (i.cocok_grup ?? []).includes(sorot)) : items),
    [items, sorot],
  );
  const ringkasHeader = daftarPref.length === 0
    ? "Dari seluruh preferensi klien ini"
    : daftarPref.length === 1
      ? daftarPref[0].label
      : `${daftarPref.length} preferensi · ${daftarPref.reduce((n, p) => n + p.total - (kurangGrup.get(p.id_grup) ?? 0), 0)} kecocokan`;

  return (
    <div
      onClick={e => { e.stopPropagation(); close(); }}
      className={`fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-xl transition-opacity duration-200 sm:items-center ${shown ? "opacity-100" : "opacity-0"}`}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border-t border-white/[0.1] bg-[#0a0c12] shadow-[0_-30px_80px_rgba(0,0,0,0.7)] transition-transform duration-300 sm:max-h-[88vh] sm:rounded-[28px] sm:border ${shown ? "translate-y-0" : "translate-y-10"}`}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-emerald-400/0 via-emerald-400/80 to-emerald-400/0" />
        <div className="absolute left-1/2 top-2.5 z-20 h-1 w-12 -translate-x-1/2 rounded-full bg-white/20 sm:hidden" />

        <button onClick={close} className="absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-full border border-white/[0.1] bg-white/[0.06] text-slate-200 transition-all hover:bg-white/[0.12]">
          <Icon icon="solar:close-circle-bold" className="text-lg" />
        </button>

        {/* ── Kepala ── */}
        <header className="shrink-0 border-b border-white/[0.06] px-5 pb-0 pt-9 sm:pt-6">
          <div className="flex items-center gap-2">
            <Icon icon="solar:magic-stick-3-bold-duotone" className="text-base text-emerald-300" />
            <h3 className="text-[15px] font-extrabold text-white">Asisten Aset · {nama}</h3>
          </div>
          <p className="mt-1 text-[12px] text-slate-400">{ringkasHeader}</p>

          {/* ── Chip preferensi ──
              Klien nyata jarang punya satu kriteria. Tanpa baris ini, dua
              preferensi menghasilkan satu daftar campur yang tidak bisa
              ditelusuri: agent melihat ruko di antara rumah dan menyimpulkan
              pencocokannya rusak. Angka nol pun sengaja ditampilkan — kriteria
              yang tidak menghasilkan apa pun adalah kriteria yang perlu
              digeser, dan menyembunyikannya membuatnya tak pernah diperbaiki. */}
          {adaBanyakPref && (
            <div className="-mx-1 mt-2.5 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                onClick={() => setSorot(null)}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  sorot === null
                    ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                    : "border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-slate-200"
                }`}
              >
                Semua · {items.length}
              </button>
              {daftarPref.map(p => (
                <button
                  key={p.id_grup}
                  onClick={() => setSorot(s => (s === p.id_grup ? null : p.id_grup))}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    sorot === p.id_grup
                      ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                      : (hitungGrup.get(p.id_grup) ?? 0) === 0
                        ? "border-white/[0.06] bg-white/[0.02] text-slate-600 hover:text-slate-400"
                        : "border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {p.label} · {hitungGrup.get(p.id_grup) ?? 0}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex gap-1">
            {([
              { k: "cocok" as const, label: "Cocok", n: items.length },
              { k: "terkirim" as const, label: "Terkirim", n: terkirim.length },
              /* Tab ketiga BUKAN hiasan. Tindakan yang tidak bisa dilihat lagi
                 setelah bilah "Urungkan" menghilang adalah tindakan yang
                 menakutkan, dan agent yang takut salah buang akan berhenti
                 memakai tombolnya sama sekali. */
              { k: "disingkirkan" as const, label: "Disingkirkan", n: singkirDimuat ? disingkirkan.length : jumlahSingkir },
            ]).map(t => (
              <button
                key={t.k}
                /* Dimuat MALAS: daftar penyingkiran hanya diambil saat tabnya
                   benar-benar dibuka. Sebagian besar sesi tidak pernah
                   menyentuhnya, dan permintaan yang tidak menghasilkan piksel
                   tetap ikut mengantre di depan yang menghasilkan. */
                onClick={() => { setTab(t.k); if (t.k === "disingkirkan" && !singkirDimuat) muatDisingkirkan(); }}
                className={`relative flex items-center gap-1.5 rounded-t-lg px-3.5 py-2 text-[12.5px] font-bold transition-colors ${
                  tab === t.k ? "text-white" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {t.label}
                {t.n > 0 && (
                  <span className={`rounded-full px-1.5 py-px text-[10px] ${tab === t.k ? "bg-emerald-400/15 text-emerald-300" : "bg-white/[0.06] text-slate-500"}`}>
                    {t.n}
                  </span>
                )}
                {/* Titik peringatan: ada kabar yang belum diteruskan ke klien. */}
                {t.k === "terkirim" && perluDikabari > 0 && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_currentColor]" />
                )}
                {tab === t.k && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-emerald-400" />}
              </button>
            ))}
          </div>
        </header>

        {/* ── Isi ── */}
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
          {tab === "cocok" ? (
            loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
                <Icon icon="svg-spinners:ring-resize" className="text-3xl text-emerald-400" />
                <p className="text-[13px]">Mencari aset…</p>
              </div>
            ) : error ? (
              <div className="py-20 text-center text-[13px] text-rose-300">{error}</div>
            ) : items.length === 0 ? (
              /* Habis karena DITINJAU, bukan karena tidak ada persediaan.
                 Dua keadaan yang terlihat identik di layar tapi menuntut
                 tindakan yang berlawanan: yang satu minta kriteria digeser,
                 yang lain justru kabar baik. Menampilkan diagnosa "coba
                 naikkan plafon" kepada agent yang baru saja menyingkirkan
                 sepuluh aset terakhirnya adalah saran yang menyesatkan. */
              jumlahSingkir > 0 && !diagnosa ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="grid h-16 w-16 place-items-center rounded-3xl border border-emerald-400/20 bg-emerald-500/[0.06]">
                    <Icon icon="solar:check-circle-bold-duotone" className="text-3xl text-emerald-300" />
                  </div>
                  <p className="mt-3 text-[14px] font-bold text-white">Semua sudah ditinjau</p>
                  <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-slate-500">
                    Tidak ada aset yang tersisa untuk klien ini sekarang. Aset baru yang cocok akan
                    muncul di sini sendiri.
                  </p>
                  <button
                    onClick={() => { setTab("disingkirkan"); if (!singkirDimuat) muatDisingkirkan(); }}
                    className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-[12px] font-bold text-slate-300 transition-colors hover:bg-white/[0.08]"
                  >
                    Lihat {jumlahSingkir} yang disingkirkan
                  </button>
                </div>
              ) : (
                <PanelKosong diagnosa={diagnosa} tanpaPref={tanpaPref} />
              )
            ) : tampil.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Icon icon="solar:filter-bold-duotone" className="text-3xl text-slate-700" />
                <p className="mt-3 text-[13px] font-bold text-white">Preferensi ini belum ada yang cocok</p>
                <p className="mt-1 max-w-xs text-[12px] text-slate-500">
                  Kriteria lain klien ini masih punya {items.length} aset — ketuk “Semua” di atas.
                </p>
              </div>
            ) : (
              <>
                {/* Menyebut sisanya secara terbuka. Daftar yang memotong diam-diam
                    membuat agent mengira persediaannya cuma segitu, lalu berhenti
                    mencari — padahal aset berikutnya muncul sendiri begitu yang
                    sekarang selesai dikirim. */}
                <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {tampil.length} aset cocok · pilih maksimal 6 untuk dikirim sekaligus
                  {sisaBelumTampil > 0 && (
                    <span className="ml-1 normal-case tracking-normal text-slate-600">
                      ({sisaBelumTampil.toLocaleString("id-ID")} lagi menyusul setelah ini dikirim)
                    </span>
                  )}
                </p>
                {/* JARAK ANTAR KARTU ADA DI DALAM KOTAK YANG DIANIMASIKAN
                    (pb-2.5), bukan di `space-y` induknya — dan pembungkus
                    <div> ini yang membuat induk hanya melihat SATU anak.
                    Kalau jaraknya milik induk, kartu yang tingginya menyusut
                    ke nol tetap menyisakan celah 10px: hantu yang membuat
                    daftar terlihat seperti punya baris rusak. */}
                <div>
                  <AnimatePresence initial={false}>
                    {tampil.map(it => (
                      <motion.div
                        key={it.id_property}
                        /* `layout` — kartu di bawahnya NAIK dengan mulus alih-alih
                           melompat. Lompatan itulah yang membuat agent kehilangan
                           tempatnya dan mengetuk kartu yang salah berikutnya. */
                        layout
                        initial={false}
                        exit={{ height: 0, opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] } }}
                        className="overflow-hidden"
                      >
                        <div className="pb-2.5">
                          <KartuCocok
                            it={it}
                            idAgent={idAgent}
                            dipilih={dipilih.has(it.id_property)}
                            onToggle={() => togglePilih(it.id_property)}
                            onSingkirkan={() => singkirkan(it.id_property)}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </>
            )
          ) : tab === "disingkirkan" ? (
            loadingSingkir && disingkirkan.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
                <Icon icon="svg-spinners:ring-resize" className="text-3xl text-emerald-400" />
              </div>
            ) : disingkirkan.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-3xl border border-white/[0.06] bg-white/[0.02]">
                  <Icon icon="solar:trash-bin-minimalistic-bold-duotone" className="text-3xl text-slate-600" />
                </div>
                <p className="mt-3 text-[14px] font-bold text-white">Tidak ada yang disingkirkan</p>
                <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-slate-500">
                  Aset yang Anda singkirkan dari daftar “Cocok” berhenti muncul untuk klien ini —
                  di layar maupun di email otomatis. Semuanya bisa dipulihkan dari sini.
                </p>
              </div>
            ) : (
              <>
                <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {disingkirkan.length} aset disingkirkan
                  <span className="ml-1 normal-case tracking-normal text-slate-600">
                    (tidak akan muncul lagi untuk klien ini, termasuk di email otomatis)
                  </span>
                </p>
                <div>
                  <AnimatePresence initial={false}>
                    {disingkirkan.map(d => (
                      <motion.div
                        key={d.id_property}
                        layout
                        initial={false}
                        exit={{ height: 0, opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] } }}
                        className="overflow-hidden"
                      >
                        <div className="pb-2.5">
                          <KartuDisingkirkan
                            d={d}
                            idAgent={idAgent}
                            memulihkan={memulihkan.has(d.id_property)}
                            onPulihkan={() => pulihkan([d.id_property])}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </>
            )
          ) : loadingKirim ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
              <Icon icon="svg-spinners:ring-resize" className="text-3xl text-emerald-400" />
            </div>
          ) : terkirim.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Icon icon="solar:posts-carousel-vertical-bold-duotone" className="text-4xl text-slate-700" />
              <p className="mt-3 text-[14px] font-bold text-white">Belum ada aset yang dikirim</p>
              <p className="mt-1 max-w-xs text-[12px] text-slate-500">
                Aset yang Anda kirim tercatat di sini — lengkap dengan tanggapan klien dan perubahan harganya.
              </p>
            </div>
          ) : (
            terkirim.map(t => (
              <KartuTerkirim
                key={t.id_kiriman}
                t={t}
                idAgent={idAgent}
                klienId={klienId}
                onSelesai={() => { buangSimpanan(klienId); muatTerkirim(); muatCocok(); }}
              />
            ))
          )}
        </div>

        {/* ── Bilah "Urungkan" ──
            Pola yang sama dengan arsip di Gmail, dan alasannya sama: konfirmasi
            SEBELUM tindakan membuat agent membaca dialog di setiap kartu yang
            ia buang — puluhan kali sehari — sementara jalan keluar SESUDAH
            tindakan hanya dipakai saat benar-benar salah. Yang pertama menagih
            biaya dari semua orang untuk melindungi yang jarang.

            Melayang di ATAS daftar, bukan mendorongnya: daftar yang bergeser
            naik-turun tiap kali satu kartu dibuang membuat kartu berikutnya
            pindah dari bawah kursor tepat sebelum diketuk. */}
        <AnimatePresence>
          {aksiGalat && (
            <motion.div
              key="aksi-galat"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              className={`pointer-events-none absolute inset-x-0 z-40 flex justify-center px-4 ${
                tab === "cocok" && dipilih.size > 0 ? "bottom-[74px]" : "bottom-4"
              }`}
            >
              <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-rose-400/25 bg-[#2a1418]/95 px-4 py-2.5 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.9)] backdrop-blur-xl">
                <Icon icon="solar:danger-triangle-bold-duotone" className="shrink-0 text-base text-rose-300" />
                <span className="text-[12.5px] font-semibold text-rose-100">{aksiGalat}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {urung.length > 0 && !aksiGalat && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              /* Naik di atas kaki kirim saat kaki itu muncul. Bilah yang
                 menutupi tombol "Siapkan pesan" adalah bilah yang menghalangi
                 pekerjaan utama layar ini demi memberitahu sesuatu yang sudah
                 selesai. */
              className={`pointer-events-none absolute inset-x-0 z-30 flex justify-center px-4 ${
                tab === "cocok" && dipilih.size > 0 ? "bottom-[74px]" : "bottom-4"
              }`}
            >
              <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/[0.1] bg-[#161a23]/95 py-2 pl-4 pr-2 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.9)] backdrop-blur-xl">
                <Icon icon="solar:trash-bin-minimalistic-bold-duotone" className="shrink-0 text-base text-slate-400" />
                <span className="text-[12.5px] font-semibold text-slate-200">
                  {urung.length === 1 ? "1 aset disingkirkan" : `${urung.length} aset disingkirkan`}
                </span>
                <button
                  onClick={urungkan}
                  className="rounded-xl bg-white/[0.08] px-3 py-1.5 text-[12px] font-extrabold text-emerald-300 transition-colors hover:bg-white/[0.14] hover:text-emerald-200"
                >
                  Urungkan
                </button>
                {/* Menutup bilahnya, BUKAN membatalkan penyingkirannya. Diberi
                    label yang jelas lewat aria-label supaya tidak tertukar
                    dengan "Urungkan" oleh pembaca layar. */}
                <button
                  onClick={() => { if (urungTimer.current) clearTimeout(urungTimer.current); setUrung([]); }}
                  aria-label="Tutup pemberitahuan"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-300"
                >
                  <Icon icon="solar:close-circle-linear" className="text-base" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Kaki: bilah kirim ──
            Hanya muncul saat ada yang dipilih. Bilah aksi permanen yang
            kebanyakan waktu berisi tombol mati cuma memakan tinggi layar. */}
        {tab === "cocok" && dipilih.size > 0 && (
          <footer className="shrink-0 border-t border-white/[0.08] bg-[#0c0f16] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setDipilih(new Set())}
                className="shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[12px] font-semibold text-slate-300 transition-colors hover:bg-white/[0.07]"
              >
                Batal
              </button>
              <button
                onClick={kirim}
                disabled={mengirim}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 py-2.5 text-[13px] font-extrabold text-[#04130d] transition-all hover:from-emerald-300 hover:to-emerald-400 active:scale-[0.99] disabled:opacity-60"
              >
                <Icon icon={mengirim ? "svg-spinners:ring-resize" : "ic:baseline-whatsapp"} className="text-base" />
                {mengirim ? "Menyiapkan…" : `Siapkan pesan · ${dipilih.size} aset`}
              </button>
            </div>
          </footer>
        )}
      </div>

      {draf && (
        <DrafPesanModal
          draf={draf}
          punyaWa={adaWa}
          klienEmail={klienEmail}
          onClose={() => setDraf(null)}
        />
      )}
    </div>
  );
}

/* ── Panel "kenapa kosong" ─────────────────────────────────────
   Inilah bayaran atas keputusan mencocokkan secara ketat. Layar kosong tanpa
   penjelasan membuat agent menyimpulkan fiturnya rusak; layar kosong yang
   menyebut gerbang mana yang menghalangi membuatnya membuka preferensi dan
   memperbaiki satu angka. */
function PanelKosong({ diagnosa, tanpaPref }: { diagnosa: Diagnosa | null; tanpaPref?: boolean }) {
  if (tanpaPref) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-3xl border border-white/[0.06] bg-white/[0.02]">
          <Icon icon="solar:clipboard-list-bold-duotone" className="text-3xl text-slate-500" />
        </div>
        <p className="mt-3 text-[14px] font-bold text-white">Klien ini belum punya preferensi</p>
        <p className="mt-1 max-w-xs text-[12px] text-slate-500">
          Isi kriteria yang dicari (tipe, lokasi, budget) di kartu klien, lalu asisten ini bisa mencarikan asetnya.
        </p>
      </div>
    );
  }

  const saran: { ikon: string; teks: string; n: number }[] = [];
  if (diagnosa) {
    if (diagnosa.adaBudget && diagnosa.jikaBudgetNaik10 > 0)
      saran.push({ ikon: "solar:wallet-money-bold-duotone", teks: "kalau plafon budget dinaikkan 10%", n: diagnosa.jikaBudgetNaik10 });
    if (diagnosa.tingkatLokasi !== "bebas" && diagnosa.jikaLokasiDiperluas > 0)
      saran.push({ ikon: "solar:map-point-bold-duotone", teks: "kalau lokasi diperluas satu tingkat", n: diagnosa.jikaLokasiDiperluas });
    if (diagnosa.adaLuas && diagnosa.jikaLuasDiabaikan > 0)
      saran.push({ ikon: "solar:ruler-angular-bold-duotone", teks: "kalau batas luas dilepas", n: diagnosa.jikaLuasDiabaikan });
    /* Gerbang paling tidak terduga dari sisi agent: ia mengisi "Tanah" dan
       tidak pernah membayangkan bahwa lot "tanah berikut bangunan" ikut
       tersaring keluar. Tanpa baris ini, layar kosongnya tidak punya
       penjelasan sama sekali. */
    if (diagnosa.adaBentuk && diagnosa.jikaBentukDiabaikan > 0)
      saran.push({ ikon: "solar:home-2-bold-duotone", teks: "kalau tanah kosong & yang sudah ada bangunannya sama-sama diterima", n: diagnosa.jikaBentukDiabaikan });
  }

  return (
    <div className="flex flex-col items-center py-14 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-3xl border border-white/[0.06] bg-white/[0.02]">
        <Icon icon="solar:home-smile-angle-bold-duotone" className="text-3xl text-slate-500" />
      </div>
      <p className="mt-3 text-[14px] font-bold text-white">Belum ada aset yang cocok persis</p>
      {/* Klien bisa punya beberapa kriteria; saran "naikkan plafon 10%" tanpa
          menyebut plafon yang mana tidak bisa ditindaklanjuti. */}
      {diagnosa?.label && (
        <p className="mt-1 text-[11px] font-semibold text-slate-500">
          Ditinjau dari kriteria: <span className="text-slate-300">{diagnosa.label}</span>
        </p>
      )}

      {diagnosa && diagnosa.totalTanpaFilterLunak === 0 ? (
        <p className="mt-1 max-w-sm text-[12px] text-slate-500">
          Tidak ada satu pun aset dengan kategori dan jenis transaksi ini yang sedang tersedia. Kriteria budget dan
          lokasinya belum jadi soal.
        </p>
      ) : saran.length > 0 ? (
        <>
          <p className="mt-1 max-w-sm text-[12px] text-slate-500">
            Pencarian sengaja ketat — tidak ada aset yang ditampilkan kalau tidak benar-benar masuk kriteria. Yang
            menghalangi:
          </p>
          <div className="mt-3 w-full max-w-sm space-y-1.5">
            {saran.map((s, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-left">
                <Icon icon={s.ikon} className="shrink-0 text-[17px] text-emerald-300/80" />
                <span className="min-w-0 flex-1 text-[11.5px] text-slate-300">{s.teks}</span>
                <span className="shrink-0 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                  +{s.n}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 max-w-sm text-[11px] text-slate-600">
            Ubah preferensinya di kartu klien kalau salah satu pelonggaran itu memang masuk akal.
          </p>
        </>
      ) : (
        <p className="mt-1 max-w-sm text-[12px] text-slate-500">
          Semua aset yang cocok sudah pernah dikirim ke klien ini. Lihat tab Terkirim.
        </p>
      )}
    </div>
  );
}

/* ── Foto aset ─────────────────────────────────────────────── */

/* KENAPA <Image>, BUKAN <img>.
   Nilai kolom `gambar` menunjuk ke host pihak ketiga: 121.411 baris ke
   file.lelang.go.id, sisanya ke drive.google.com. <img> biasa membuat BROWSER
   agent yang mengambilnya langsung ke sana — dan kedua host itu punya aturan
   sendiri soal siapa yang boleh mengambil: file.lelang.go.id menolak hotlink,
   Drive membatasi laju per akun dan ikut membaca cookie Google si agent. Jadi
   fotonya bisa hilang di layar seorang agent sementara URL-nya baik-baik saja
   dari server (sudah dicek: 12 dari 12 URL Drive membalas 200 dari sini).

   Seluruh permukaan lain di situs ini memakai next/image, yang mengambilnya
   SERVER-SIDE lalu menyajikannya dari domain sendiri. Kartu CRM ini satu-
   satunya yang tidak — karena itu pula hanya di sini fotonya rusak. Kedua host
   sudah terdaftar di remotePatterns, dan hasil optimasinya (cache 30 hari)
   dipakai bersama kartu publik yang menampilkan aset yang sama. */
function FotoAset({ src, alt, ikon }: { src: string; alt: string; ikon: string }) {
  /* Kunci per-URL. Tanpa ini, kartu yang tergantikan aset lain saat daftarnya
     disaring ulang akan mewarisi status gagal milik aset sebelumnya, dan foto
     yang sebenarnya baik ikut tidak pernah tampil. */
  const [gagal, setGagal] = useState("");

  if (!src || gagal === src) {
    return (
      <div className="grid h-full w-full place-items-center text-slate-700">
        <Icon icon="solar:gallery-bold-duotone" className={ikon} />
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      /* Kartunya berukuran tetap dan kecil; tanpa `sizes` next/image meminta
         lebar viewport penuh dan mengunduh gambar 1080px untuk kotak 92px. */
      sizes="96px"
      className="object-cover"
      /* Placeholder yang tenang mengalahkan teks alt yang meluber keluar kotak
         — bentuk kegagalan yang tadinya terlihat seperti kartu yang rusak. */
      onError={() => setGagal(src)}
    />
  );
}

/* ── Kartu aset yang cocok ─────────────────────────────────── */

function KartuCocok({ it, idAgent, dipilih, onToggle, onSingkirkan }: {
  it: MatchedListing; idAgent: string | null; dipilih: boolean; onToggle: () => void;
  onSingkirkan: () => void;
}) {
  const isLel = it.jenis_transaksi.toUpperCase() === "LELANG";
  const harga = isLel ? (it.nilai_limit_lelang ?? it.harga) : it.harga;
  /* Alamat lengkap, bukan rangkaian kelurahan/kecamatan/kota. Di situlah nama
     jalan, komplek, blok, dan nomor kavling berada — hal-hal yang membuat
     agent tahu persis di mana asetnya tanpa membuka detailnya. Sebagian baris
     bahkan punya alamat lengkap sementara kolom kelurahan & kecamatannya
     kosong, dan versi lama menampilkan "Kab. Gresik" saja untuk aset yang
     alamatnya sebenarnya "Perum GKGA Blok Q-11, Kedanyang, Gresik".
     Dirapikan karena 26% baris datang dari lelang.go.id dalam HURUF BESAR
     SEMUA, dan teks yang berteriak justru lebih lambat dibaca. */
  const lokasi =
    rapikanAlamat(it.alamat_lengkap) ||
    [it.kelurahan, it.kecamatan, it.kota].filter(Boolean).join(", ");
  /* Sudah dinormalisasi server (file-id Drive → URL thumbnail). */
  const foto = it.gambar || "";
  const luas = it.kategori.toUpperCase() === "TANAH"
    ? (it.luas_tanah ? `LT ${it.luas_tanah} m²` : "")
    : [it.luas_tanah ? `LT ${it.luas_tanah}` : "", it.luas_bangunan ? `LB ${it.luas_bangunan}` : ""].filter(Boolean).join(" · ");

  return (
    <div
      onClick={onToggle}
      className={`group cursor-pointer rounded-2xl border p-2.5 transition-all ${
        dipilih
          ? "border-emerald-400/50 bg-emerald-500/[0.07] shadow-[0_0_24px_-10px_rgba(16,185,129,0.8)]"
          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14]"
      }`}
    >
      <div className="flex gap-3">
        {/* Kotak centang. Seluruh kartu bisa diketuk, tapi kotaknya tetap
            digambar — tanpa penanda visual, tidak ada yang menduga kartu ini
            bisa dipilih berbarengan. */}
        <div className="flex shrink-0 items-center">
          <span className={`grid h-5 w-5 place-items-center rounded-md border transition-all ${
            dipilih ? "border-emerald-400 bg-emerald-400 text-[#04130d]" : "border-white/20 bg-white/[0.04] text-transparent group-hover:border-white/40"
          }`}>
            <Icon icon="solar:check-read-linear" className="text-[13px]" />
          </span>
        </div>

        <div className="relative h-[72px] w-[92px] shrink-0 overflow-hidden rounded-xl bg-white/[0.04]">
          <FotoAset src={foto} alt={it.judul} ikon="text-xl" />
          <span className="absolute left-1 top-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-200 backdrop-blur">
            {JENIS_TRANSAKSI_LABEL[it.jenis_transaksi as keyof typeof JENIS_TRANSAKSI_LABEL] ?? it.jenis_transaksi}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
          <div className="min-w-0">
            <p className="line-clamp-1 text-[13px] font-bold text-white">{it.judul}</p>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-400">
              <Icon icon="solar:map-point-bold-duotone" className="mr-0.5 inline align-[-2px] text-[11px] text-slate-500" />
              {lokasi || "—"}
            </p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-extrabold text-emerald-300">{formatRpFull(harga)}</span>
            {luas && <span className="shrink-0 text-[10px] text-slate-500">{luas}</span>}
          </div>
        </div>
      </div>

      {/* Kaki kartu: alasan di kiri, jalan keluar di kanan.
          SELALU dirender — dulu hanya muncul kalau ada alasan, dan itu membuat
          tombol "Lihat detail" hilang persis pada aset yang paling perlu
          diperiksa: yang datanya paling miskin.

          Alasan kenapa aset ini muncul. Rekomendasi tanpa alasan menuntut
          kepercayaan buta, dan agent berhenti memakainya setelah satu hasil
          yang terasa aneh.

          Di sini TIDAK ada lencana "sudah pernah dikirim", dan itu disengaja:
          aset yang sudah dikirim dikeluarkan dari kolam pencarian di server
          (lihat `kecuali` di endpoint /rekomendasi/siap), jadi ia tidak pernah
          sampai ke kartu ini. Daftar ini antrean kerja, bukan katalog. */}
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/[0.05] pt-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {saringAlasan(it.alasan, lokasi).map((a, i) => (
            <span key={i} className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
              {a}
            </span>
          ))}
        </div>

        {/* Bertuliskan "Lihat detail", bukan ikon telanjang. Ikon panah-keluar
            sendirian menuntut agent menebak, dan yang ditebak salah di sini
            adalah membuka tab baru — hal yang terasa seperti kehilangan tempat.

            Tiga keputusan yang tidak terlihat:
            • stopPropagation — seluruh kartu ini saklar pilih. Tanpanya,
              membuka detail sekaligus mencentang/mencabut asetnya, dan agent
              kembali dari tab sebelah menemukan pilihannya berubah sendiri.
            • target="_blank" — agent sedang di tengah memilih sampai enam aset.
              Berpindah halaman di tab yang sama membuang seluruh pilihan itu.
            • jalur relatif (pathListing), bukan URL berdomain — SITE_URL
              menunjuk ke solusindoaset.com, jadi tautan berdomain akan
              melempar agent ke situs produksi saat menguji di localhost. */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* SINGKIRKAN.
              Berlabel, bukan ikon telanjang — alasan yang sama dengan tombol di
              sebelahnya, dan di sini taruhannya lebih besar: ikon "X" di pojok
              kartu terbaca sebagai "tutup" oleh separuh orang, dan yang salah
              tebak sedang membuang aset dari daftar kliennya.

              Warnanya sengaja NETRAL, bukan merah. Merah menandakan kerusakan
              atau tindakan yang tak bisa ditarik; ini keputusan kerja biasa
              yang bisa diurungkan sedetik kemudian, dan agent yang membuang
              belasan aset per klien tidak boleh disambut peringatan tiap kali.
              Merah baru muncul saat kursor di atasnya — cukup untuk memisahkan
              tombol ini dari "Lihat detail" di sebelahnya.

              stopPropagation WAJIB: seluruh kartu ini saklar pilih, dan tanpa
              itu menyingkirkan aset sekaligus mencentangnya. */}
          <button
            onClick={e => { e.stopPropagation(); onSingkirkan(); }}
            aria-label={`Singkirkan ${it.judul} dari daftar`}
            title="Aset ini tidak cocok — sembunyikan dari daftar klien ini"
            className="flex shrink-0 items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-[11px] font-bold text-slate-400 transition-colors hover:border-rose-400/35 hover:bg-rose-500/10 hover:text-rose-200"
          >
            <Icon icon="solar:close-circle-linear" className="text-[12px]" />
            Singkirkan
          </button>

          <a
            href={pathListing({ slug: it.slug, id_property: it.id_property, jenis_transaksi: it.jenis_transaksi }, idAgent)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            aria-label={`Lihat detail ${it.judul} di tab baru`}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-bold text-slate-300 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-200"
          >
            Lihat detail
            <Icon icon="solar:arrow-right-up-linear" className="text-[12px]" />
          </a>
        </div>
      </div>
    </div>
  );
}

/* ── Kartu aset yang disingkirkan ──────────────────────────────────────────
   Sengaja LEBIH SEPI daripada kartu "Cocok": tanpa foto besar, tanpa chip
   alasan, tanpa kotak centang. Isinya bukan antrean kerja — ia daftar yang
   dibuka sesekali untuk memastikan tidak ada yang terbuang keliru, dan kartu
   yang sama menonjolnya dengan daftar utama akan menarik perhatian yang tidak
   dibutuhkannya. */
function KartuDisingkirkan({ d, idAgent, memulihkan, onPulihkan }: {
  d: ItemDisingkirkan; idAgent: string | null; memulihkan: boolean; onPulihkan: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-2.5 transition-colors hover:border-white/[0.1]">
      <div className="flex gap-3">
        <div className="relative h-[52px] w-[68px] shrink-0 overflow-hidden rounded-lg bg-white/[0.04] opacity-60">
          <FotoAset src={d.gambar} alt={d.judul} ikon="text-base" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="line-clamp-1 text-[12.5px] font-bold text-slate-300">{d.judul}</p>
          <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
            <Icon icon="solar:map-point-linear" className="mr-0.5 inline align-[-2px] text-[11px]" />
            {d.alamat_lengkap || "—"}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[12px] font-bold text-slate-400">{formatRpFull(d.harga)}</span>
            {/* Dikatakan terus terang. Tombol "Pulihkan" yang seolah tidak
                berefek — karena asetnya memang sudah tidak tersedia — akan
                terbaca sebagai kerusakan, dan agent akan mengetuknya berkali
                kali sebelum menyerah. */}
            {!d.masih_tersedia && (
              <span className="rounded-md bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-300/90">
                sudah tidak tersedia
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end justify-center gap-1.5">
          <button
            onClick={onPulihkan}
            disabled={memulihkan}
            className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-bold text-slate-300 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-200 disabled:opacity-50"
          >
            <Icon icon={memulihkan ? "svg-spinners:ring-resize" : "solar:restart-linear"} className="text-[12px]" />
            {memulihkan ? "Memulihkan…" : "Pulihkan"}
          </button>
          <a
            href={pathListing({ slug: d.slug, id_property: d.id_property, jenis_transaksi: d.jenis_transaksi }, idAgent)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10.5px] font-semibold text-slate-500 transition-colors hover:text-slate-300"
          >
            Lihat detail →
          </a>
        </div>
      </div>
    </div>
  );
}

/* ── Kartu aset yang sudah dikirim ─────────────────────────── */

function KartuTerkirim({ t, idAgent, klienId, onSelesai }: {
  t: ItemTerkirim; idAgent: string | null; klienId: string; onSelesai: () => void;
}) {
  const [sibuk, setSibuk] = useState(false);
  const meta = TANGGAPAN_META[t.tanggapan] ?? TANGGAPAN_META.MENUNGGU;
  const foto = t.gambar || "";
  const lokasi = [t.kecamatan, t.kota].filter(Boolean).join(", ");

  async function setTanggapan(tanggapan: string) {
    if (sibuk) return;
    setSibuk(true);
    try {
      await fetch(`/api/dashboard/klien/${klienId}/rekomendasi/tanggapan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_kiriman: t.id_kiriman, tanggapan }),
      });
      onSelesai();
    } finally { setSibuk(false); }
  }

  async function tutupPerubahan(id: string, aksi: "TERUSKAN" | "ABAIKAN") {
    if (sibuk) return;
    setSibuk(true);
    try {
      await fetch(`/api/dashboard/klien/${klienId}/rekomendasi/tanggapan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_perubahan: id, aksi }),
      });
      onSelesai();
    } finally { setSibuk(false); }
  }

  return (
    <div className={`rounded-2xl border p-2.5 transition-all ${
      t.perubahan.length > 0 ? "border-amber-400/25 bg-amber-500/[0.04]" : "border-white/[0.06] bg-white/[0.02]"
    }`}>
      <div className="flex gap-3">
        <div className="relative h-[62px] w-[80px] shrink-0 overflow-hidden rounded-xl bg-white/[0.04]">
          <FotoAset src={foto} alt={t.judul} ikon="text-lg" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-1 text-[12.5px] font-bold text-white">{t.judul}</p>
            {/* Di tab ini justru lebih sering diperlukan daripada di tab Cocok:
                klien membalas menanyakan sesuatu, dan agent harus membuka
                asetnya untuk menjawab. Kartu ini BUKAN saklar pilih, jadi tidak
                perlu stopPropagation — tapi tetap tab baru, supaya daftar
                kiriman yang sedang ditelusuri tidak hilang. */}
            <a
              href={pathListing({ slug: t.slug, id_property: t.id_property, jenis_transaksi: t.jenis_transaksi }, idAgent)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Lihat detail ${t.judul} di tab baru`}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[10.5px] font-bold text-slate-400 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-200"
            >
              Detail
              <Icon icon="solar:arrow-right-up-linear" className="text-[11px]" />
            </a>
          </div>
          <p className="mt-0.5 line-clamp-1 text-[10.5px] text-slate-500">{lokasi || "—"}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] font-extrabold text-emerald-300">{formatRpFull(t.harga_sekarang)}</span>
            {t.harga_sekarang !== t.harga_diketahui && (
              <span className="text-[10px] text-slate-500 line-through">{formatRpFull(t.harga_diketahui)}</span>
            )}
            <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9.5px] font-bold ${meta.kelas}`}>
              <Icon icon={meta.ikon} className="text-[11px]" />
              {meta.label}
            </span>
            {t.jumlah_kirim > 1 && (
              <span className="text-[10px] text-slate-600">dikirim {t.jumlah_kirim}×</span>
            )}
          </div>
        </div>
      </div>

      {/* Kabar yang belum diteruskan ke klien */}
      {t.perubahan.map(p => {
        const m = PERUBAHAN_META[p.jenis];
        return (
          <div key={p.id} className={`mt-2 rounded-xl border px-2.5 py-2 ${m.kelas}`}>
            <div className="flex items-center gap-1.5 text-[11.5px] font-bold">
              <Icon icon={m.ikon} className="text-[14px]" />
              {m.label}
              {p.selisih_persen != null && (
                <span>{Math.abs(Number(p.selisih_persen)).toFixed(1).replace(".", ",")}%</span>
              )}
              {p.harga_lama != null && p.harga_baru != null && (
                <span className="font-medium opacity-80">
                  {formatRpFull(p.harga_lama)} → {formatRpFull(p.harga_baru)}
                </span>
              )}
            </div>
            <div className="mt-1.5 flex gap-1.5">
              <button
                onClick={() => tutupPerubahan(p.id, "TERUSKAN")}
                disabled={sibuk}
                className="flex-1 rounded-lg bg-white/[0.12] py-1.5 text-[11px] font-bold transition-colors hover:bg-white/20 disabled:opacity-50"
              >
                Sudah saya kabari
              </button>
              <button
                onClick={() => tutupPerubahan(p.id, "ABAIKAN")}
                disabled={sibuk}
                className="rounded-lg border border-white/[0.12] px-2.5 py-1.5 text-[11px] font-semibold opacity-70 transition-opacity hover:opacity-100 disabled:opacity-40"
              >
                Lewati
              </button>
            </div>
          </div>
        );
      })}

      {/* Pencatat tanggapan klien. Bukan hiasan: "tidak cocok" empat kali
          berturut-turut adalah bukti bahwa kriteria di preferensinya salah. */}
      <div className="mt-2 flex flex-wrap gap-1 border-t border-white/[0.05] pt-2">
        {(["SUKA", "MINTA_SURVEI", "TIDAK_COCOK", "DEAL"] as const).map(k => {
          const m = TANGGAPAN_META[k];
          const aktif = t.tanggapan === k;
          return (
            <button
              key={k}
              onClick={() => setTanggapan(aktif ? "MENUNGGU" : k)}
              disabled={sibuk}
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10.5px] font-bold transition-all disabled:opacity-50 ${
                aktif ? m.kelas : "border-white/[0.07] bg-white/[0.02] text-slate-500 hover:text-slate-300"
              }`}
            >
              <Icon icon={m.ikon} className="text-[12px]" />
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Draf pesan ────────────────────────────────────────────────
   Muncul SETELAH kiriman tercatat. Urutannya disengaja: kalau tautan WhatsApp
   dibuka lebih dulu lalu pencatatannya gagal, agent sudah terlanjur mengirim
   sesuatu yang tidak tercatat — dan anti-dobel bocor pada aset itu selamanya. */
function DrafPesanModal({ draf, punyaWa, klienEmail, onClose }: {
  draf: { pesan: string; waUrl: string | null };
  punyaWa: boolean;
  klienEmail: string | null;
  onClose: () => void;
}) {
  const [disalin, setDisalin] = useState(false);

  return (
    <div onClick={onClose} className="fixed inset-0 z-[90] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-4">
      <div onClick={e => e.stopPropagation()} className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-[24px] border border-white/[0.1] bg-[#0a0c12] sm:rounded-[24px]">
        <header className="shrink-0 border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-2">
            <Icon icon="solar:check-circle-bold" className="text-lg text-emerald-400" />
            <h4 className="text-[14px] font-extrabold text-white">Kiriman tercatat</h4>
          </div>
          <p className="mt-1 text-[11.5px] text-slate-500">
            Aset ini tidak akan muncul lagi sebagai rekomendasi baru untuk klien tersebut, dan harganya mulai dipantau.
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <pre className="whitespace-pre-wrap break-words rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3 font-sans text-[12px] leading-relaxed text-slate-200">
            {draf.pesan}
          </pre>
        </div>

        <footer className="shrink-0 space-y-2 border-t border-white/[0.08] px-5 py-4">
          {draf.waUrl ? (
            <a
              href={draf.waUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 py-3 text-[13px] font-extrabold text-[#04130d] transition-all hover:from-emerald-300 hover:to-emerald-400"
            >
              <Icon icon="ic:baseline-whatsapp" className="text-lg" />
              Buka WhatsApp
            </a>
          ) : (
            <p className="rounded-xl border border-amber-400/25 bg-amber-500/[0.08] px-3 py-2 text-center text-[11.5px] text-amber-200">
              Klien ini belum punya nomor WhatsApp. Salin pesannya, atau lengkapi nomornya di kartu klien.
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(draf.pesan)
                  .then(() => { setDisalin(true); setTimeout(() => setDisalin(false), 1600); })
                  .catch(() => {});
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-[12px] font-bold text-slate-200 transition-colors hover:bg-white/[0.07]"
            >
              <Icon icon={disalin ? "solar:check-circle-bold" : "solar:copy-bold"} className="text-sm" />
              {disalin ? "Tersalin" : "Salin pesan"}
            </button>
            {klienEmail && (
              <a
                href={`mailto:${klienEmail}?subject=${encodeURIComponent("Properti untuk Anda")}&body=${encodeURIComponent(draf.pesan)}`}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-sky-400/20 bg-sky-500/10 py-2.5 text-[12px] font-bold text-sky-200 transition-colors hover:bg-sky-500/20"
              >
                <Icon icon="solar:letter-bold" className="text-sm" />
                Email
              </a>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function InfoSection({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Icon icon={icon} className="text-[13px] text-slate-400" />
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300">{title}</span>
        <div className="h-px flex-1 bg-gradient-to-r from-white/[0.08] to-transparent" />
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string | undefined; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-[11px] text-slate-500">{label}</span>
      <span className={`text-right text-[12px] font-medium ${highlight ? "text-amber-300" : "text-slate-200"}`}>{value}</span>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="relative grid h-20 w-20 place-items-center rounded-3xl border border-white/[0.06] bg-white/[0.02]">
        <div className="pointer-events-none absolute inset-0 rounded-3xl bg-emerald-500/10 blur-2xl" />
        <Icon icon="solar:users-group-rounded-bold-duotone" className="relative text-4xl text-emerald-400/70" />
      </div>
      <p className="mt-4 text-[15px] font-bold text-white">Belum ada klien</p>
      <p className="mt-1 max-w-xs text-[12px] text-slate-500">
        Tambahkan klien pertama Anda, atau convert lead dari Hot Leads ke CRM.
      </p>
      <button onClick={onAdd}
        className="mt-6 flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/20 px-5 py-2.5 text-sm font-bold text-emerald-300 transition-all hover:bg-emerald-500/30">
        <Icon icon="solar:user-plus-bold-duotone" className="text-base" />
        Tambah Klien Pertama
      </button>
    </div>
  );
}

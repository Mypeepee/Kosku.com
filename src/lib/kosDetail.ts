/**
 * Halaman detail kos — aturan tampilan yang dipakai bersama server & client.
 *
 * Bedanya dengan [kosCard.ts]: di card kita hanya punya ruang untuk ringkasan
 * (chip & pill), sedangkan di halaman detail calon penghuni memutuskan. Yang
 * diputuskan bukan "kos ini bagus atau tidak", tapi "KAMAR YANG MANA yang saya
 * ambil, untuk berapa lama, dan berapa totalnya" — jadi seluruh modul ini
 * berputar di sekitar dua sumbu itu: TIPE KAMAR × DURASI SEWA.
 *
 * Kolom agregat di listing_sewa_detail (harga_sewa_*, total_kamar,
 * kamar_tersedia) adalah turunan dari daftar tipe — lihat [kosRoomTypes.ts].
 * Di halaman detail kita justru kembali ke sumbernya (tabel tipe) supaya
 * angkanya tepat per kamar, bukan "mulai dari". Kolom agregat tetap dipakai
 * sebagai fallback untuk kos yang semua kamarnya sama (daftar tipe kosong).
 *
 * TIDAK ada string class Tailwind di file ini — warna & layout urusan komponen.
 */

import {
  FASILITAS_KAMAR_OPTIONS,
  FASILITAS_BERSAMA_OPTIONS,
  PERATURAN_OPTIONS,
  AKSES_TIPE_OPTIONS,
  type AksesTerdekat,
} from "@/app/tambah-property/types/listing";

export type { AksesTerdekat };

// ─────────────────────────────────────────────────────────────────────────────
// DURASI
// ─────────────────────────────────────────────────────────────────────────────

export type DurasiKey = "HARIAN" | "MINGGUAN" | "BULANAN" | "TAHUNAN";

export interface DurasiMeta {
  /** Label tab, mis. "Bulanan". */
  label: string;
  /** Akhiran harga, mis. "/bulan". */
  suffix: string;
  /** Kata benda satuan untuk hitungan, mis. "bulan" pada "3 bulan". */
  satuan: string;
  /** Nama kolom harga di DB — satu-satunya tempat pemetaan ini ditulis ulang. */
  field: HargaField;
}

export type HargaField =
  | "harga_sewa_harian"
  | "harga_sewa_mingguan"
  | "harga_sewa_bulanan"
  | "harga_sewa_tahunan";

/** Urut dari durasi terpendek — urutan tab mengikuti ini. */
export const DURASI_URUT: DurasiKey[] = [
  "HARIAN",
  "MINGGUAN",
  "BULANAN",
  "TAHUNAN",
];

export const DURASI_META: Record<DurasiKey, DurasiMeta> = {
  HARIAN: {
    label: "Harian",
    suffix: "/hari",
    satuan: "hari",
    field: "harga_sewa_harian",
  },
  MINGGUAN: {
    label: "Mingguan",
    suffix: "/minggu",
    satuan: "minggu",
    field: "harga_sewa_mingguan",
  },
  BULANAN: {
    label: "Bulanan",
    suffix: "/bulan",
    satuan: "bulan",
    field: "harga_sewa_bulanan",
  },
  TAHUNAN: {
    label: "Tahunan",
    suffix: "/tahun",
    satuan: "tahun",
    field: "harga_sewa_tahunan",
  },
};

/** Peringkat durasi — dipakai membandingkan minimal sewa dgn durasi terpilih. */
export const DURASI_RANK: Record<DurasiKey, number> = {
  HARIAN: 0,
  MINGGUAN: 1,
  BULANAN: 2,
  TAHUNAN: 3,
};

export const isDurasiKey = (v: unknown): v is DurasiKey =>
  typeof v === "string" && (DURASI_URUT as string[]).includes(v);

/**
 * Tanggal keluar = tanggal masuk + n satuan durasi.
 *
 * Bulan & tahun sengaja TIDAK dihitung sebagai kelipatan hari: sewa 1 bulan dari
 * 31 Januari berakhir 28/29 Februari menurut kalender, bukan 3 Maret — itu yang
 * dipahami penyewa maupun pemilik kos.
 *
 * Tanggalnya dijepit sendiri ke akhir bulan, karena Date#setMonth TIDAK
 * melakukannya: 31 Jan + 1 bulan meluber ke 3 Maret. Karena itu bulan digeser
 * saat tanggal masih 1 (tidak mungkin meluber), baru tanggalnya dipasang.
 */
export function tambahDurasi(mulai: Date, durasi: DurasiKey, n: number): Date {
  const d = new Date(mulai);
  if (durasi === "HARIAN") {
    d.setDate(d.getDate() + n);
    return d;
  }
  if (durasi === "MINGGUAN") {
    d.setDate(d.getDate() + n * 7);
    return d;
  }
  const tanggalAsal = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + (durasi === "BULANAN" ? n : n * 12));
  const hariTerakhir = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(tanggalAsal, hariTerakhir));
  return d;
}

/**
 * Selisih hari kalender antara dua tanggal.
 *
 * Dihitung dari komponen tanggalnya lewat Date.UTC, bukan pengurangan timestamp:
 * dua tanggal yang terpisah pergantian waktu musim panas berjarak 23 atau 25 jam,
 * dan pembagian per 24 jam akan menghasilkan 0,96 hari — dibulatkan jadi salah.
 */
export function selisihHari(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86_400_000);
}

/**
 * Kebalikan `tambahDurasi`: jumlah satuan durasi paling sedikit yang menutupi
 * rentang [mulai, target] — 9 Agu → 9 Nov = 3 bulan, 9 Agu → 20 Nov = 4 bulan.
 *
 * Dibulatkan KE ATAS karena satu satuan durasi adalah satu satuan tagihan: kos
 * bulanan tidak dijual setengah bulan, jadi menginap sampai 20 November berarti
 * membayar bulan keempat. Angka inilah yang jadi `lama` sewa, dan tanggal keluar
 * yang ditampilkan dihitung ulang dari situ (`tambahDurasi`) supaya tanggal yang
 * dilihat penyewa selalu cocok dengan total yang ditagihkan.
 *
 * Pencarian dimulai dari perkiraan lalu dirapikan dengan `tambahDurasi`, bukan
 * rumus langsung: hanya `tambahDurasi` yang tahu bahwa 31 Jan + 1 bulan jatuh di
 * akhir Februari, dan hasil keduanya harus selalu sepakat.
 */
export function unitDurasiMenutupi(
  mulai: Date,
  target: Date,
  durasi: DurasiKey,
): number {
  const hari = selisihHari(mulai, target);
  if (hari <= 0) return 1;

  let n =
    durasi === "HARIAN"
      ? hari
      : durasi === "MINGGUAN"
        ? Math.ceil(hari / 7)
        : durasi === "BULANAN"
          ? Math.round(hari / 30.4375)
          : Math.round(hari / 365.25);
  n = Math.max(1, n);

  const akhir = (k: number) => tambahDurasi(mulai, durasi, k).getTime();
  const batas = target.getTime();
  while (n > 1 && akhir(n - 1) >= batas) n--;
  while (akhir(n) < batas) n++;
  return n;
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT
// ─────────────────────────────────────────────────────────────────────────────

export const formatRupiah = (n: number): string =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

/** "Rp 2,9 jt" — dipakai di ruang sempit (bar bawah mobile & chip harga). */
export function formatRupiahSingkat(n: number): string {
  if (n >= 1_000_000_000) {
    const v = n / 1_000_000_000;
    return `Rp ${v % 1 === 0 ? v : v.toFixed(1).replace(".", ",")} M`;
  }
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `Rp ${v % 1 === 0 ? v : v.toFixed(1).replace(".", ",")} jt`;
  }
  if (n >= 1_000) return `Rp ${Math.round(n / 1_000)} rb`;
  return formatRupiah(n);
}

export const formatTanggal = (d: Date): string =>
  d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** "Sab, 9 Agu 2026" — dipakai saat harinya ikut menentukan keputusan (pindahan). */
export const formatTanggalHari = (d: Date): string =>
  d.toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

// ─────────────────────────────────────────────────────────────────────────────
// FASILITAS
// ─────────────────────────────────────────────────────────────────────────────

export interface FasilitasItem {
  label: string;
  icon: string;
}

const IKON_FASILITAS: Record<string, string> = Object.fromEntries(
  [
    ...FASILITAS_KAMAR_OPTIONS,
    ...FASILITAS_BERSAMA_OPTIONS,
    ...PERATURAN_OPTIONS,
  ].map((f) => [f.name.toLowerCase(), f.icon]),
);

/** Ikon per tipe patokan lokasi ("KAMPUS" → ikon sekolah). */
export const IKON_AKSES: Record<string, string> = Object.fromEntries(
  AKSES_TIPE_OPTIONS.map((o) => [o.value, o.icon]),
);

export const LABEL_AKSES: Record<string, string> = Object.fromEntries(
  AKSES_TIPE_OPTIONS.map((o) => [o.value, o.label]),
);

/**
 * "AC,Kasur" → [{label:"AC",icon:...}, …].
 *
 * Nama di luar daftar pilihan (listing hasil scrape / data lama) tetap
 * ditampilkan dengan ikon netral — menyembunyikannya berarti halaman detail
 * memberi tahu LEBIH SEDIKIT dari yang diisi agent, dan itu tidak pernah
 * merupakan perbaikan.
 */
export function parseFasilitas(raw?: string | null): FasilitasItem[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((label) => ({
      label,
      icon: IKON_FASILITAS[label.toLowerCase()] || "solar:check-circle-bold-duotone",
    }));
}

/** Gabung beberapa daftar fasilitas, buang duplikat (tanpa peduli huruf besar). */
export function gabungFasilitas(
  ...daftar: (FasilitasItem[] | undefined | null)[]
): FasilitasItem[] {
  const seen = new Set<string>();
  const out: FasilitasItem[] = [];
  for (const list of daftar) {
    for (const f of list ?? []) {
      const k = f.label.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(f);
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// KAMAR MANDI & GENDER
// ─────────────────────────────────────────────────────────────────────────────

export const KAMAR_MANDI: Record<string, { label: string; icon: string }> = {
  DALAM: { label: "Kamar mandi dalam", icon: "solar:bath-bold-duotone" },
  LUAR: { label: "Kamar mandi luar", icon: "mdi:shower" },
};

export const GENDER_KOS: Record<
  string,
  { label: string; sublabel: string; icon: string }
> = {
  PUTRA: {
    label: "Kos Putra",
    sublabel: "Khusus penghuni laki-laki",
    icon: "solar:men-bold-duotone",
  },
  PUTRI: {
    label: "Kos Putri",
    sublabel: "Khusus penghuni perempuan",
    icon: "solar:women-bold-duotone",
  },
  CAMPUR: {
    label: "Kos Campur",
    sublabel: "Terbuka untuk putra & putri",
    icon: "solar:users-group-rounded-bold-duotone",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TIPE KAMAR (view model)
// ─────────────────────────────────────────────────────────────────────────────

export interface TipeKamarView {
  id: string;
  nama: string;
  jumlahKamar: number;
  kamarTersedia: number;
  luasKamar: number | null;
  kamarMandiTipe: "DALAM" | "LUAR" | null;
  kapasitasPenghuni: number | null;
  /** Lantai tempat kamar tipe ini berada, mis. "2" atau "2 & 3". */
  lantaiKamar: string | null;
  /** Nomor kamar milik tipe ini, mis. "A1, A2, A3". */
  nomorKamar: string | null;
  /**
   * Foto kamar milik tipe ini, urut seperti diunggah agent. Boleh kosong: kos
   * lama diunggah sebelum foto per tipe ada, dan kartu tipe menampilkan
   * penampung kosong yang dirancang — bukan gambar rusak — kalau begitu.
   *
   * Sumbernya kolom `gambar` di listing_kamar_tipe, formatnya sama persis
   * dengan `Listing.gambar` (dipisah koma, boleh ID Drive atau URL penuh).
   */
  foto: string[];
  /** Harga per durasi; durasi yang tidak ditawarkan tidak muncul sebagai key. */
  harga: Partial<Record<DurasiKey, number>>;
  /** Fasilitas lengkap tipe ini (khas tipe + yang berlaku semua tipe). */
  fasilitas: FasilitasItem[];
  catatan: string | null;
}

/** Durasi yang ditawarkan minimal satu tipe, urut dari terpendek. */
export function durasiTersedia(tipe: TipeKamarView[]): DurasiKey[] {
  return DURASI_URUT.filter((d) => tipe.some((t) => (t.harga[d] ?? 0) > 0));
}

/** Tipe termurah untuk satu durasi — dipakai badge "Termurah" & harga "mulai". */
export function tipeTermurah(
  tipe: TipeKamarView[],
  durasi: DurasiKey,
): TipeKamarView | null {
  const kandidat = tipe.filter((t) => (t.harga[durasi] ?? 0) > 0);
  if (kandidat.length === 0) return null;
  return kandidat.reduce((a, b) =>
    (b.harga[durasi] as number) < (a.harga[durasi] as number) ? b : a,
  );
}

export function rentangHarga(
  tipe: TipeKamarView[],
  durasi: DurasiKey,
): { min: number; max: number } | null {
  const harga = tipe
    .map((t) => t.harga[durasi])
    .filter((h): h is number => typeof h === "number" && h > 0);
  if (harga.length === 0) return null;
  return { min: Math.min(...harga), max: Math.max(...harga) };
}

/**
 * Tipe yang layak dipilih lebih dulu saat halaman dibuka: yang masih ada
 * kamarnya, termurah untuk durasi utama. Kalau semua penuh, tetap kembalikan
 * yang termurah supaya panel booking tidak pernah kosong — statusnya
 * ditampilkan sebagai "penuh", bukan disembunyikan.
 */
export function tipeDefault(
  tipe: TipeKamarView[],
  durasi: DurasiKey,
): TipeKamarView | null {
  const adaKamar = tipe.filter(
    (t) => t.kamarTersedia > 0 && (t.harga[durasi] ?? 0) > 0,
  );
  return tipeTermurah(adaKamar.length > 0 ? adaKamar : tipe, durasi);
}

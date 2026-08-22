/**
 * Tampilan ringkas kos untuk card listing.
 *
 * Dipakai dua tempat yang harus terlihat sama: card publik di halaman Sewa
 * (src/app/Jual/produklist.tsx) dan Live Preview di wizard tambah property.
 * Agent memutuskan isian berdasarkan preview, jadi kalau keduanya beda aturan,
 * preview-nya berbohong.
 *
 * Prinsipnya: card kos TIDAK menampilkan luas kamar & maks penghuni. Keduanya
 * bukan penyaring — yang menentukan calon penghuni klik atau tidak adalah
 * "dekat apa" dan "dapat fasilitas apa".
 */

import {
  AKSES_TIPE_OPTIONS,
  FASILITAS_KAMAR_OPTIONS,
  FASILITAS_BERSAMA_OPTIONS,
  type AksesTerdekat,
} from "@/app/tambah-property/types/listing";

export type { AksesTerdekat };

/**
 * Gender kos — hanya label & ikon.
 *
 * WARNANYA SENGAJA TIDAK DI SINI. Tailwind memindai file untuk mencari string
 * class, dan `src/lib` sempat luput dari daftar `content`; akibatnya class
 * seperti `bg-violet-500/90` tidak pernah digenerate dan pill-nya tampil
 * transparan tanpa error apa pun. Semua string class kini tinggal di
 * `src/components/kos/kosCardStyle.ts` yang pasti dipindai.
 */
export type KosGenderKey = "PUTRA" | "PUTRI" | "CAMPUR";

export const KOS_GENDER: Record<
  KosGenderKey,
  { label: string; icon: string }
> = {
  PUTRA: { label: "Putra", icon: "solar:men-bold-duotone" },
  PUTRI: { label: "Putri", icon: "solar:women-bold-duotone" },
  CAMPUR: {
    label: "Campur",
    icon: "solar:users-group-rounded-bold-duotone",
  },
};

export const normalisasiGender = (
  gender?: string | null
): KosGenderKey | undefined => {
  const k = gender?.toUpperCase();
  return k && k in KOS_GENDER ? (k as KosGenderKey) : undefined;
};

export const KAMAR_MANDI_TIPE_LABEL: Record<string, string> = {
  DALAM: "KM Dalam",
  LUAR: "KM Luar",
};

/** Ikon per tipe patokan — sama dengan yang dipakai form supaya konsisten. */
export const AKSES_ICON: Record<string, string> = Object.fromEntries(
  AKSES_TIPE_OPTIONS.map((o) => [o.value, o.icon])
);

/**
 * Ikon per nama fasilitas. Fasilitas kamar & bersama digabung jadi satu lookup
 * karena di card keduanya tampil dalam satu deret chip; ditambah beberapa chip
 * yang bukan berasal dari daftar fasilitas (KM dalam/luar, gender kos).
 */
export const FASILITAS_ICON: Record<string, string> = {
  ...Object.fromEntries(
    [...FASILITAS_KAMAR_OPTIONS, ...FASILITAS_BERSAMA_OPTIONS].map((f) => [
      f.name.toLowerCase(),
      f.icon,
    ])
  ),
  "km dalam": "solar:bath-bold-duotone",
  "km luar": "mdi:shower",
  "kos putra": "solar:users-group-rounded-bold-duotone",
  "kos putri": "solar:users-group-rounded-bold-duotone",
  "kos campur": "solar:users-group-rounded-bold-duotone",
};

/** "AC, WiFi, Kasur" → ["AC", "WiFi", "Kasur"] */
export const parseFasilitas = (raw?: string | null): string[] =>
  raw
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

/** "5 mnt · UNAIR" — jarak boleh kosong kalau agent tidak isi. */
export const formatAkses = (a: AksesTerdekat): string => {
  const satuan = a.satuan === "KM" ? "km" : "mnt";
  return a.jarak ? `${a.jarak} ${satuan} · ${a.nama}` : a.nama;
};

/**
 * Urutan tipe patokan yang paling menentukan buat pencari kos.
 *
 * Kos dipilih karena dekat tempat beraktivitas tiap hari — kampus/kantor jauh
 * lebih menentukan daripada minimarket, meskipun minimarketnya lebih dekat.
 * Tipe di luar daftar ini masuk paling belakang.
 */
const PRIORITAS_AKSES: string[] = [
  "KAMPUS",
  "PERKANTORAN",
  "SEKOLAH",
  "STASIUN",
  "HALTE",
  "RUMAH_SAKIT",
  "MALL",
  "PASAR",
  "MINIMARKET",
  "MASJID",
  "BANDARA",
];

/**
 * Urutan patokan untuk ditampilkan di card.
 *
 * Semuanya dikembalikan — barisnya berjalan (marquee), jadi tidak ada yang
 * perlu dibuang. Yang penting urutannya: patokan paling menentukan harus lewat
 * duluan, karena itu yang terbaca sebelum orang scroll lewat.
 *
 * Diurut berdasarkan tipe dulu, baru jarak. Jarak hanya dibandingkan kalau
 * satuannya sama — "5 menit" dan "3 km" tidak bisa diadu tanpa mengarang asumsi
 * kecepatan, jadi urutan input agent yang dipakai sebagai penentu terakhir.
 */
export function pilihAksesUtama(
  list?: AksesTerdekat[] | null
): AksesTerdekat[] {
  const valid = (list ?? []).filter((a) => a?.nama?.trim());
  if (valid.length <= 1) return valid;

  const peringkat = (a: AksesTerdekat) => {
    const i = PRIORITAS_AKSES.indexOf(a.tipe);
    return i === -1 ? PRIORITAS_AKSES.length : i;
  };

  return [...valid].sort((a, b) => {
    const selisihTipe = peringkat(a) - peringkat(b);
    if (selisihTipe !== 0) return selisihTipe;
    if (a.satuan === b.satuan && a.jarak != null && b.jarak != null) {
      return a.jarak - b.jarak;
    }
    return 0;
  });
}

/**
 * Isi pill pojok kanan atas pada card kos, urut dari yang paling mendesak.
 *
 * Di halaman Sewa semua listing sudah pasti SEWA, jadi pill "SEWA" nol
 * informasi — slot ini dipakai ketersediaan kamar. Kalau agent belum pernah
 * mengisi angkanya, jatuh ke gender kos supaya slot tidak kosong melompong.
 *
 * Ambang 3: di bawah itu angkanya terasa mendesak, di atas itu justru terbaca
 * sebagai "masih banyak" dan tidak perlu diwarnai merah.
 */
export const AMBANG_KAMAR_MENIPIS = 3;

/**
 * Varian pill — bukan class. Pemetaan varian → warna ada di komponen
 * (`src/components/kos/kosCardStyle.ts`), lihat catatan di [KOS_GENDER].
 */
export type KosPillVarian =
  | KosGenderKey
  | "PENUH"
  | "MENIPIS"
  | "TERSEDIA";

export interface KosPill {
  varian: KosPillVarian;
  label: string;
  icon: string;
}

export function buildKosPill(
  kamarTersedia?: number | null,
  gender?: string | null
): KosPill | null {
  if (kamarTersedia == null) {
    const g = normalisasiGender(gender);
    return g
      ? { varian: g, label: KOS_GENDER[g].label, icon: KOS_GENDER[g].icon }
      : null;
  }

  if (kamarTersedia === 0) {
    return {
      varian: "PENUH",
      label: "Kamar penuh",
      icon: "solar:lock-keyhole-bold-duotone",
    };
  }

  if (kamarTersedia <= AMBANG_KAMAR_MENIPIS) {
    return {
      varian: "MENIPIS",
      label: `Sisa ${kamarTersedia} kamar`,
      icon: "solar:fire-bold-duotone",
    };
  }

  return {
    varian: "TERSEDIA",
    label: `${kamarTersedia} kamar tersedia`,
    icon: "mdi:door-open",
  };
}

export interface FasilitasIkon {
  label: string;
  icon: string;
}

export interface LabelChip {
  label: string;
  /** Tanpa gender = chip netral; ada gender = ikut kode warna gender. */
  gender?: KosGenderKey;
}

export interface KosChips {
  /** Chip berteks pendek — identitas kos, bukan fasilitas. */
  labelChips: LabelChip[];
  /** SELURUH fasilitas sebagai ikon. Berapa yang muat diputuskan saat render. */
  iconChips: FasilitasIkon[];
}

/**
 * Isi baris ringkas di bawah lokasi.
 *
 * Dipisah dua jenis dengan sengaja:
 *
 * - Gender & jenis kamar mandi tetap BERTEKS. Keduanya identitas kos yang
 *   menentukan orang lanjut atau tidak, dan ikonnya tidak bisa dibedakan
 *   sekilas (ikon "orang" tidak memberi tahu putra/putri/campur).
 * - Fasilitas jadi IKON saja. Daftarnya bisa 20+ item; ditulis lengkap justru
 *   tidak terbaca, sedangkan AC/WiFi/parkir sudah punya ikon yang dikenal umum.
 *
 * Fungsi ini TIDAK memotong daftar. Dulu ada jatah tetap (maks 5) yang bikin
 * card lebar menyisakan ruang kosong sementara "+19" tetap muncul — pemotongan
 * sekarang diputuskan saat render berdasarkan lebar asli, lihat KosChipRow.
 *
 * `sertakanGender` dipakai card publik: gender hanya turun ke sini kalau pill
 * kanan sudah dipakai angka sisa kamar, supaya tidak tampil dua kali.
 */
export function buildFasilitasChips(opts: {
  kamarMandiTipe?: string | null;
  fasilitasKamar?: string | null;
  fasilitasBersama?: string | null;
  gender?: string | null;
  sertakanGender?: boolean;
}): KosChips {
  const g = normalisasiGender(opts.gender);
  const kamarMandiLabel =
    KAMAR_MANDI_TIPE_LABEL[opts.kamarMandiTipe?.toUpperCase() || ""];

  const labelChips: LabelChip[] = [
    ...(opts.sertakanGender && g
      ? [{ label: KOS_GENDER[g].label, gender: g }]
      : []),
    ...(kamarMandiLabel ? [{ label: kamarMandiLabel }] : []),
  ];

  // Fasilitas di luar daftar pilihan (data lama/hasil scrape) tetap ditampilkan
  // dengan ikon netral. Menyembunyikannya jadi "+N" membuat angka misterius
  // yang tidak bisa dibuka di card.
  const iconChips: FasilitasIkon[] = [
    ...parseFasilitas(opts.fasilitasKamar),
    ...parseFasilitas(opts.fasilitasBersama),
  ].map((nama) => ({
    label: nama,
    icon: FASILITAS_ICON[nama.toLowerCase()] || "solar:check-circle-bold-duotone",
  }));

  return { labelChips, iconChips };
}

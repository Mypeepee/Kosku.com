/**
 * Tipe kamar kos — satu listing KOS mewakili satu gedung, dan gedung itu
 * hampir tidak pernah seragam: dari 10 kamar, 2 di antaranya kamar mandi
 * dalam & lebih luas, harganya pun beda. Sebelum ada tabel tipe kamar,
 * pemilik dipaksa memilih SATU angka (satu luas, satu harga, satu jenis
 * kamar mandi) untuk seluruh gedung — calon penghuni datang survei dengan
 * ekspektasi yang salah, dan agent kehilangan waktu.
 *
 * Modul ini satu-satunya sumber aturan turunan (agregat) dari daftar tipe:
 * total kamar, sisa kamar, dan harga termurah per durasi. Dipakai tiga
 * tempat yang WAJIB sepakat:
 *   1. Wizard tambah property (builder + live preview),
 *   2. API listings (nilai yang benar-benar disimpan ke DB),
 *   3. Card/detail listing publik lewat kolom agregat di listing_sewa_detail.
 *
 * Kalau ketiganya menghitung sendiri-sendiri, angka "Sisa 3 kamar" di card
 * bisa berbeda dengan yang diisi agent — jadi semua lewat sini.
 */

import {
  DURASI_SEWA_FIELD_MAP,
  DURASI_SEWA_OPTIONS,
  type DurasiSewa,
} from '@/app/tambah-property/types/listing';

/** Nama field harga per durasi, mis. 'harga_sewa_bulanan'. */
export type HargaDurasiField =
  (typeof DURASI_SEWA_FIELD_MAP)[DurasiSewa];

/** Satu tipe kamar. Semua angka opsional kecuali nama & jumlah kamar. */
export interface KamarTipe {
  nama: string;
  jumlah_kamar?: number | null;
  kamar_tersedia?: number | null;
  luas_kamar?: number | null;
  kamar_mandi_tipe?: 'DALAM' | 'LUAR' | null;
  kapasitas_penghuni?: number | null;
  /** Lantai tempat kamar tipe ini berada, mis. "2" atau "2 & 3". */
  lantai_kamar?: string | null;
  /** Nomor kamar milik tipe ini, mis. "A1, A2, A3". */
  nomor_kamar?: string | null;
  harga_sewa_harian?: number | null;
  harga_sewa_mingguan?: number | null;
  harga_sewa_bulanan?: number | null;
  harga_sewa_tahunan?: number | null;
  /** Fasilitas yang khas tipe ini saja (mis. AC), di luar fasilitas umum. */
  fasilitas_kamar?: string | null;
  /**
   * Foto kamar tipe ini — URL siap pakai, format CSV seperti `listing.gambar`.
   * Form membatasi satu foto per tipe (lihat FotoKamarTipe), tapi bentuk
   * datanya tetap CSV supaya halaman detail memakai parser yang sama dengan
   * galeri listing.
   */
  gambar?: string | null;
  catatan?: string | null;
}

/**
 * Batas 8 tipe. Kos dengan lebih dari itu praktis tidak ada; batas ini yang
 * menahan agent memakai tipe kamar sebagai daftar kamar satu-per-satu
 * (20 baris "Kamar 1".."Kamar 20") — bukan itu gunanya.
 */
export const MAKS_TIPE_KAMAR = 8;

/** Urutan durasi dari terpendek — dipakai untuk render kolom harga. */
export const DURASI_LIST: DurasiSewa[] = DURASI_SEWA_OPTIONS.map((d) => d.value);

/** Angka dari form bisa datang sebagai string ("12") — dinormalkan di sini. */
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Teks opsional: dipangkas, dipotong ke batas kolom, kosong → null. */
const teks = (v: unknown, maks: number): string | null => {
  if (typeof v !== 'string') return null;
  const bersih = v.trim().slice(0, maks);
  return bersih.length > 0 ? bersih : null;
};

/** Maksimal foto yang disimpan per tipe kamar — lihat catatan di `KamarTipe.gambar`. */
export const MAKS_FOTO_TIPE = 1;

/**
 * Saring CSV URL foto tipe kamar.
 *
 * Yang lolos hanya URL http(s) atau path absolut milik situs ini. `blob:` &
 * `data:` sengaja ditolak: blob URL hanya hidup di tab yang membuatnya (kalau
 * tersimpan, halaman detail menampilkan gambar rusak untuk semua orang), dan
 * data URI berukuran ratusan KB akan ikut terkirim di setiap query listing.
 */
export function bersihkanUrlGambar(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const daftar = v
    .split(',')
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length > 0 &&
        s.length <= 500 &&
        (s.startsWith('https://') || s.startsWith('http://') || s.startsWith('/')),
    )
    .slice(0, MAKS_FOTO_TIPE);
  return daftar.length > 0 ? daftar.join(',') : null;
}

/** Harga satu tipe untuk satu durasi, null kalau belum diisi / nol. */
export function hargaTipe(tipe: KamarTipe, durasi: DurasiSewa): number | null {
  const raw = num(tipe[DURASI_SEWA_FIELD_MAP[durasi]]);
  return raw && raw > 0 ? raw : null;
}

/** Tipe tanpa satu pun harga tidak bisa disewakan — dipakai validasi & badge. */
export function punyaHarga(tipe: KamarTipe): boolean {
  return DURASI_LIST.some((d) => hargaTipe(tipe, d) !== null);
}

/** Daftar durasi yang harganya terisi pada satu tipe. */
export function durasiTerisiTipe(tipe: KamarTipe): DurasiSewa[] {
  return DURASI_LIST.filter((d) => hargaTipe(tipe, d) !== null);
}

/**
 * Mode multi-tipe = daftar tipe tidak kosong. Sengaja TIDAK pakai flag
 * boolean terpisah: flag dan daftar bisa saling bertentangan (flag on tapi
 * daftar kosong), dan bug seperti itu baru kelihatan setelah tersimpan.
 */
export function adaTipeKamar(list?: KamarTipe[] | null): boolean {
  return Array.isArray(list) && list.length > 0;
}

export interface RingkasanKamar {
  jumlahTipe: number;
  /** Σ jumlah_kamar seluruh tipe. */
  totalKamar: number;
  /** Σ kamar_tersedia seluruh tipe. */
  kamarTersedia: number;
  /** Durasi yang punya harga di minimal satu tipe. */
  durasiTerisi: DurasiSewa[];
  /** Harga termurah per durasi — ini yang jadi "mulai dari" di card. */
  hargaMin: Partial<Record<DurasiSewa, number>>;
  hargaMax: Partial<Record<DurasiSewa, number>>;
  /** Nama tipe yang belum punya harga sama sekali. */
  tipeTanpaHarga: string[];
  /** Nama tipe yang sisa kamarnya melebihi jumlah kamarnya. */
  tipeSisaBerlebih: string[];
}

export function ringkasKamarTipe(list?: KamarTipe[] | null): RingkasanKamar {
  const tipe = Array.isArray(list) ? list : [];

  const hargaMin: Partial<Record<DurasiSewa, number>> = {};
  const hargaMax: Partial<Record<DurasiSewa, number>> = {};
  let totalKamar = 0;
  let kamarTersedia = 0;
  const tipeTanpaHarga: string[] = [];
  const tipeSisaBerlebih: string[] = [];

  for (const t of tipe) {
    const jumlah = num(t.jumlah_kamar) ?? 0;
    const tersedia = num(t.kamar_tersedia) ?? 0;
    totalKamar += jumlah > 0 ? jumlah : 0;
    kamarTersedia += tersedia > 0 ? tersedia : 0;

    const label = t.nama?.trim() || 'Tanpa nama';
    if (!punyaHarga(t)) tipeTanpaHarga.push(label);
    if (jumlah > 0 && tersedia > jumlah) tipeSisaBerlebih.push(label);

    for (const d of DURASI_LIST) {
      const h = hargaTipe(t, d);
      if (h === null) continue;
      const min = hargaMin[d];
      const max = hargaMax[d];
      if (min === undefined || h < min) hargaMin[d] = h;
      if (max === undefined || h > max) hargaMax[d] = h;
    }
  }

  return {
    jumlahTipe: tipe.length,
    totalKamar,
    kamarTersedia,
    durasiTerisi: DURASI_LIST.filter((d) => hargaMin[d] !== undefined),
    hargaMin,
    hargaMax,
    tipeTanpaHarga,
    tipeSisaBerlebih,
  };
}

/**
 * Nilai yang ditulis ke listing_sewa_detail saat listing pakai tipe kamar.
 *
 * Harga per durasi di level listing jadi harga TERMURAH antar tipe, bukan
 * rata-rata: card menampilkannya sebagai "mulai dari", dan filter harga
 * ("maksimal 1 juta") harus tetap menemukan kos yang tipe termurahnya masuk
 * anggaran. Rata-rata akan membuat kos itu hilang dari hasil filter.
 */
export function agregatSewaDariTipe(list: KamarTipe[]) {
  const r = ringkasKamarTipe(list);
  return {
    total_kamar: r.totalKamar,
    kamar_tersedia: r.kamarTersedia,
    harga_sewa_harian: r.hargaMin.HARIAN ?? null,
    harga_sewa_mingguan: r.hargaMin.MINGGUAN ?? null,
    harga_sewa_bulanan: r.hargaMin.BULANAN ?? null,
    harga_sewa_tahunan: r.hargaMin.TAHUNAN ?? null,
  };
}

/**
 * Jenis kamar mandi yang berlaku untuk SEMUA tipe, kalau memang seragam.
 *
 * Card listing menampilkan chip "KM Dalam"/"KM Luar" dari kolom tunggal di
 * listing_sewa_detail. Kalau semua tipe sepakat, chip itu tetap benar dan
 * informatif; begitu ada yang berbeda, nilainya null — lebih baik chipnya
 * hilang daripada menjanjikan kamar mandi dalam untuk 8 kamar yang luar.
 */
export function kamarMandiSeragam(
  list: KamarTipe[],
): 'DALAM' | 'LUAR' | null {
  const nilai = list.map((t) => t.kamar_mandi_tipe ?? null);
  if (nilai.length === 0 || nilai.some((v) => v === null)) return null;
  return nilai.every((v) => v === nilai[0]) ? nilai[0] : null;
}

/**
 * Fasilitas kamar yang dimiliki SEMUA tipe (irisan), sebagai teks siap simpan.
 *
 * Saat kos punya beberapa tipe, fasilitas kamar diisi per tipe — tidak ada lagi
 * daftar "berlaku semua tipe" yang diisi manual. Tapi card & filter listing
 * memakai satu kolom `fasilitas_kamar` di level listing, jadi nilainya
 * diturunkan dari IRISAN antar tipe: hanya yang benar-benar ada di setiap tipe.
 *
 * Kenapa irisan, bukan gabungan: gabungan akan membuat card menjanjikan AC
 * padahal hanya 2 dari 10 kamar yang punya — dan penghuni baru sadar saat
 * survei. Irisan tidak pernah menjanjikan lebih dari kenyataan; kelebihan tiap
 * tipe tetap tampil di halaman detail lewat tabel tipe kamarnya.
 */
export function fasilitasKamarSeragam(list: KamarTipe[]): string | null {
  const perTipe = list.map((t) =>
    (t.fasilitas_kamar ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  if (perTipe.length === 0) return null;

  // Urutan mengikuti tipe pertama supaya hasilnya stabil, bukan acak Set.
  const irisan = perTipe[0].filter((nama) =>
    perTipe.every((daftar) =>
      daftar.some((x) => x.toLowerCase() === nama.toLowerCase()),
    ),
  );
  return irisan.length > 0 ? irisan.join(',') : null;
}

/**
 * Durasi utama (yang tampil di card) harus salah satu durasi yang benar-benar
 * ditawarkan. Kalau pilihan agent sudah tidak terisi lagi — mis. tipe
 * terakhir yang punya harga bulanan dihapus — jatuh ke durasi terisi pertama
 * supaya card tidak pernah menampilkan "Rp -".
 */
export function durasiUtamaDariTipe(
  list: KamarTipe[],
  pilihan?: DurasiSewa | null,
): DurasiSewa | null {
  const { durasiTerisi } = ringkasKamarTipe(list);
  if (durasiTerisi.length === 0) return null;
  if (pilihan && durasiTerisi.includes(pilihan)) return pilihan;
  return durasiTerisi[0];
}

/** Harga yang dipakai kolom generik `listing.harga` (untuk sort & filter). */
export function hargaUtamaDariTipe(
  list: KamarTipe[],
  pilihan?: DurasiSewa | null,
): number | null {
  const durasi = durasiUtamaDariTipe(list, pilihan);
  if (!durasi) return null;
  return ringkasKamarTipe(list).hargaMin[durasi] ?? null;
}

/**
 * Bersihkan input dari klien sebelum disimpan: buang baris tanpa nama/harga,
 * potong ke batas maksimum, dan pastikan sisa kamar tidak melebihi jumlahnya.
 * API tidak boleh percaya angka agregat kiriman klien — semuanya dihitung
 * ulang dari daftar bersih ini.
 */
export function bersihkanTipeKamar(raw: unknown): KamarTipe[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
    .map((t) => {
      const jumlah = Math.max(1, Math.round(num(t.jumlah_kamar) ?? 1));
      const tersediaRaw = num(t.kamar_tersedia);
      const tersedia = Math.min(
        jumlah,
        Math.max(0, Math.round(tersediaRaw ?? 0)),
      );

      const tipe: KamarTipe = {
        nama: String(t.nama ?? '').trim().slice(0, 80),
        jumlah_kamar: jumlah,
        kamar_tersedia: tersedia,
        luas_kamar: num(t.luas_kamar),
        kamar_mandi_tipe:
          t.kamar_mandi_tipe === 'DALAM' || t.kamar_mandi_tipe === 'LUAR'
            ? t.kamar_mandi_tipe
            : null,
        kapasitas_penghuni: num(t.kapasitas_penghuni),
        lantai_kamar: teks(t.lantai_kamar, 20),
        nomor_kamar: teks(t.nomor_kamar, 60),
        harga_sewa_harian: num(t.harga_sewa_harian),
        harga_sewa_mingguan: num(t.harga_sewa_mingguan),
        harga_sewa_bulanan: num(t.harga_sewa_bulanan),
        harga_sewa_tahunan: num(t.harga_sewa_tahunan),
        fasilitas_kamar:
          typeof t.fasilitas_kamar === 'string' && t.fasilitas_kamar.trim()
            ? t.fasilitas_kamar.trim()
            : null,
        // Hanya URL yang diterima. Nilai lain (data URI, path relatif, teks
        // sembarang) dibuang tanpa suara: kolom ini dirender langsung sebagai
        // <img src>, jadi apa pun yang masuk ke sini akan dimuat browser
        // pengunjung — bukan tempat untuk mempercayai kiriman klien.
        gambar: bersihkanUrlGambar(t.gambar),
        catatan:
          typeof t.catatan === 'string' && t.catatan.trim()
            ? t.catatan.trim().slice(0, 255)
            : null,
      };

      return tipe;
    })
    .filter((t) => t.nama.length > 0 && punyaHarga(t))
    .slice(0, MAKS_TIPE_KAMAR);
}

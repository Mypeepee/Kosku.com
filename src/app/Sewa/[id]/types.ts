/**
 * Bentuk data yang dikirim server → client untuk halaman detail sewa.
 *
 * Sengaja BUKAN bentuk mentah Prisma: Decimal & BigInt tidak bisa diserialisasi
 * ke Client Component, dan nama kolom DB ("harga_sewa_bulanan") bukan bahasa
 * yang enak dipakai di UI. Semua konversi terjadi sekali di page.tsx, jadi
 * komponen di bawahnya tidak pernah lagi menangani null-vs-0 atau string angka.
 */

import type {
  AksesTerdekat,
  DurasiKey,
  FasilitasItem,
  TipeKamarView,
} from "@/lib/kosDetail";
import type {
  BlokirView,
  InventarisView,
  KunciTanggal,
} from "@/lib/sewaAvailability";
import type { ModeSewa } from "@/lib/sewaKapabilitas";
import type { PropertyDB } from "@/components/property/PropertyCard";
import type { SekitarAwal } from "@/components/property/detail/useSekitar";

/**
 * Bentuk inventaris listing — menentukan seluruh tata letak panel kanan.
 *
 *   KAMAR → kos: banyak kamar, boleh berkelompok per tipe, "sisa N kamar".
 *   UNIT  → apartemen/rumah/ruko: satu unit, "tersedia / tidak pada tanggal ini".
 *
 * Bukan dua sistem: UNIT adalah KAMAR dengan kapasitas 1 dan tanpa tipe. Yang
 * berbeda hanya kalimat & kontrol yang dirender, bukan perhitungannya.
 */
export type ModelInventaris = "KAMAR" | "UNIT";

/**
 * Ketersediaan yang boleh dilihat siapa pun.
 *
 * Sengaja mengirim BLOK mentah, bukan peta tanggal→sisa yang sudah jadi: peta
 * setahun untuk tiga tipe kamar itu ribuan entri JSON, sementara bloknya cuma
 * puluhan baris — dan @/lib/sewaAvailability memang dibuat bebas dari prisma
 * supaya browser bisa menghitung sendiri dari data yang sama persis dengan
 * yang dipakai server. Satu mesin, dua sisi, tanpa kemungkinan berselisih.
 *
 * `alasan` & `catatan` TIDAK ikut. "RENOVASI" dan "kamar A3 bocor" adalah
 * informasi operasional pemilik; kalender penyewa hanya perlu tahu tanggalnya
 * terpakai — persis sebatas yang ditampilkan Airbnb & Booking.
 */
export interface KetersediaanPublik {
  inventaris: InventarisView[];
  blok: BlokirView[];
  /** Batas atas perhitungan; di luar ini data dianggap "belum diketahui". */
  horizonSampai: KunciTanggal;
}

/**
 * Satu baris biaya di luar harga sewa. `nominal` boleh null — "listrik: sesuai
 * pemakaian" adalah jawaban yang sah, dan justru itu yang ingin diketahui
 * calon penyewa sebelum survei.
 */
export interface BiayaTambahanView {
  nama: string;
  nominal: number | null;
  periode: "SEKALI" | "BULANAN" | "TAHUNAN";
}

export interface SewaAgentView {
  idAgent: string;
  nama: string;
  kantor: string;
  jabatan: string;
  kotaArea: string;
  /** URL siap pakai; string kosong kalau agent belum unggah foto. */
  foto: string;
  telepon: string;
  rating: number;
  jumlahClosing: number;
  tahunGabung: string | null;
}

export interface SewaDetailData {
  idProperty: string;
  slug: string;
  /** "slug-id" — bagian URL detail, dipakai share & self-healing link. */
  slugId: string;
  judul: string;
  deskripsi: string | null;
  kategori: string;
  statusTayang: string;
  /** KOS punya tipe kamar & fasilitas bersama; kategori sewa lain tidak. */
  isKos: boolean;
  /** Turunan dari kategori — lihat [ModelInventaris]. */
  modelInventaris: ModelInventaris;
  /**
   * Bentuk transaksi sewa kategori ini, dari tabel @/lib/sewaKapabilitas.
   *
   *   • BOOKING   → kos, apartemen, villa. Disewa berulang dengan tanggal
   *     masuk–keluar yang berganti; kolom kanan = panel pemesanan.
   *   • NEGOSIASI → gudang, ruko, pabrik, tanah, rumah. Disewakan sekali lalu
   *     diam bertahun-tahun; tidak ada yang bisa "dipesan", jadi kolom kanan =
   *     panel kontak (chat, ajukan penawaran, jadwalkan survei) persis seperti
   *     halaman detail Jual & Lelang.
   */
  modeSewa: ModeSewa;
  dilihat: number;

  // — Lokasi —
  alamat: string | null;
  kota: string;
  kecamatan: string | null;
  kelurahan: string | null;
  provinsi: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Patokan yang diisi agent sendiri — paling dipercaya, tapi sering kosong. */
  aksesTerdekat: AksesTerdekat[];
  /**
   * Hasil pemindaian "apa yang ada di sekitar" yang SUDAH tersimpan di server
   * (lihat bacaSekitarTersimpan). Ada isinya → bagian lokasi tampil lengkap di
   * HTML pertama, tanpa spinner dan tanpa satu pun permintaan dari browser.
   * null → aset ini belum pernah dipindai; komponennya yang meminta lewat
   * /api/listing/{id}/sekitar, dan hasilnya disimpan untuk pengunjung berikutnya.
   */
  sekitar?: SekitarAwal | null;

  // — Media —
  fotoList: string[];

  // — Harga level listing (agregat dari tipe, atau nilai tunggal) —
  harga: number;
  hargaPromo: number | null;
  durasiUtama: DurasiKey | null;
  hargaDurasi: Partial<Record<DurasiKey, number>>;

  // — Identitas unit (APARTEMEN) —
  /** Nama gedung/apartemen, mis. "Educity Apartment Tower Amethyst". */
  namaGedung: string | null;
  lantaiUnit: string | null;
  nomorUnit: string | null;
  /** Label siap tampil ("2BR"), bukan nilai enumnya. */
  tipeUnit: string | null;

  // — Ketentuan sewa —
  deposit: number | null;
  minimalSewaJumlah: number | null;
  minimalSewaSatuan: DurasiKey | null;
  termasukListrik: boolean | null;
  termasukAir: boolean | null;
  akses24Jam: boolean | null;
  jamMalam: string | null;
  jamCheckIn: string | null;
  jamCheckOut: string | null;
  /** Biaya di luar harga sewa & deposit — listrik, air, wifi, IPL. */
  biayaTambahan: BiayaTambahanView[];

  // — Spesifikasi unit utuh (apartemen/rumah sewa) —
  // Kos tidak memakai ini: yang disewa satu kamar, bukan bangunannya.
  luasBangunan: number | null;
  kamarTidur: number | null;
  kamarMandi: number | null;
  kondisiInterior: string | null;

  // — Spesifikasi kamar (dipakai saat semua kamar sama) —
  luasKamar: number | null;
  kamarMandiTipe: "DALAM" | "LUAR" | null;
  kapasitasPenghuni: number | null;
  totalKamar: number | null;
  kamarTersedia: number | null;
  kosGender: string | null;

  // — Fasilitas —
  /** Berlaku untuk semua kamar (irisan antar tipe kalau multi-tipe). */
  fasilitasKamar: FasilitasItem[];
  fasilitasBersama: FasilitasItem[];
  peraturan: FasilitasItem[];

  /** Kosong = semua kamar sama; isi = kos punya beberapa tipe kamar. */
  tipeKamar: TipeKamarView[];

  /**
   * Kalender ketersediaan. Ikut dirender server & ikut ter-cache bersama
   * halaman karena isinya memang konten publik — tidak ada satu pun bagiannya
   * yang bergantung pada siapa yang membuka halaman.
   */
  ketersediaan: KetersediaanPublik;

  agent: SewaAgentView;
  tanggalDiupdate: string | null;
}

/** Kartu "Kos Serupa" di bawah halaman detail. */
/**
 * Item "Kos serupa" = PropertyDB, bentuk yang dimakan kartu bersama
 * (@/components/property/PropertyCard) — kartu yang sama persis dengan yang
 * dipakai halaman daftar /Sewa, /Jual, /Lelang & /Carikos.
 *
 * Sebelumnya blok ini punya bentuk sendiri yang lebih ramping (idProperty,
 * lokasi, aksesTeratas, …) untuk kartu buatan sendiri. Bentuk ramping itulah
 * yang memaksa kartunya berbeda: tanpa foto_list tidak ada slider, tanpa data
 * agent tidak ada footer, tanpa harga_promo tidak ada penanda diskon.
 */
export type SewaSimilarItem = PropertyDB;

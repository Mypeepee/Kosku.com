/**
 * Voucher sewa — TIPE & MESIN HITUNG. Tidak ada React di sini, dan tidak ada
 * prisma: file ini dipakai bersama oleh browser (panel pemesanan, panel kelola)
 * dan server (rute katalog & pencatat pemakaian), persis seperti
 * @/lib/sewaAvailability dipakai dua sisi untuk ketersediaan kamar.
 *
 * Alasannya sama pentingnya di sini: potongan harga adalah angka yang dikirim
 * penyewa ke agent. Kalau panel menghitungnya dengan satu rumus dan server
 * memvalidasinya dengan rumus lain, yang terjadi bukan "selisih kecil" —
 * penyewa melihat Rp 250.000 di layar lalu ditolak saat mengajukan, dan
 * kepercayaan pada seluruh halaman ikut hilang.
 *
 * EMPAT ATURAN YANG DIJAGA DI SINI:
 *
 * 1. POTONGAN HANYA MENGGIGIT SUBTOTAL SEWA — tidak pernah deposit.
 *    Deposit itu uang jaminan yang akan dikembalikan; mendiskonnya berarti
 *    menjanjikan pengembalian yang lebih kecil daripada yang disetor. Bukan
 *    diskon, tapi potongan hak.
 *
 * 2. TIDAK BERLAKU ≠ TIDAK DITAMPILKAN. Voucher yang syaratnya belum terpenuhi
 *    tetap muncul dengan kalimat sebabnya, karena sebab itulah yang berguna:
 *    "berlaku untuk sewa minimal 6 bulan" memberi tahu penyewa apa yang bisa
 *    dia ubah. Menyembunyikannya hanya menyisakan pertanyaan.
 *
 * 3. SATU VOUCHER PUNYA SATU STATUS, dan status itu dihitung — tidak disimpan.
 *    "Aktif" di kolom `aktif` hanya berarti pemiliknya belum mematikannya;
 *    apakah ia benar-benar hidup hari ini juga bergantung pada jadwal & kuota.
 *    Menyimpannya sebagai kolom berarti ada tanggal ketika baris di DB dan
 *    kenyataan berselisih, dan tidak ada yang memberitahu siapa pun.
 *
 * 4. SETIAP VOUCHER MILIK SATU LISTING dan dibuat sendiri oleh agent
 *    pemegangnya — tidak ada voucher global lintas listing. Potongan harga
 *    sewa dibayar oleh pemilik aset, bukan oleh platform, jadi hanya dia yang
 *    boleh menentukan besarnya. Datanya di tabel `listing_voucher`, dilayani
 *    src/app/api/listings/[id]/voucher/route.ts.
 */

import {
  DURASI_META,
  DURASI_URUT,
  formatRupiah,
  isDurasiKey,
  type DurasiKey,
} from "@/lib/kosDetail";
import type { AksenKey } from "@/lib/detailTheme";

// ─────────────────────────────────────────────────────────────────────────────
// BENTUK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `PERSEN` — `nilai` dibaca 0–100, hampir selalu berpasangan dengan
 * `potonganMaks` (tanpa itu, promo 15% pada sewa tahunan bisa jadi jutaan).
 * `NOMINAL` — `nilai` dibaca rupiah.
 */
export type JenisVoucher = "PERSEN" | "NOMINAL";

export interface Voucher {
  /** id baris DB, sudah jadi string (BigInt tidak bisa diserialisasi ke JSON). */
  id: string;
  /** Huruf besar tanpa spasi. Unik PER LISTING, bukan global. */
  kode: string;
  nama: string;
  deskripsi: string;
  jenis: JenisVoucher;
  nilai: number;
  /** Batas atas potongan untuk jenis PERSEN. null = tanpa batas. */
  potonganMaks: number | null;
  /** Subtotal sewa minimum. null = tanpa syarat. */
  minTransaksi: number | null;
  /** Durasi yang dilayani. null = semua durasi. */
  durasiBerlaku: DurasiKey[] | null;
  /**
   * Id tipe kamar yang dilayani. null = semua tipe.
   *
   * Hanya berarti pada kos yang memang punya tipe kamar; pada unit tunggal
   * (rumah, ruko, apartemen) daftarnya selalu null karena tidak ada yang bisa
   * dipilih.
   *
   * Isinya id MENTAH, dan sengaja tidak pernah disaring terhadap tipe yang
   * masih ada. Tipe kamar yang dihapus meninggalkan id yatim di sini, dan id
   * itu tidak akan cocok dengan apa pun — vouchernya berhenti cair. Itu
   * gagal-tertutup, dan disengaja: menyaringnya sampai daftar ini kosong akan
   * mengubah promo "khusus Standard" menjadi promo untuk SELURUH tipe,
   * termasuk yang termahal, tanpa satu pun pemberitahuan ke pemiliknya.
   */
  tipeBerlaku: string[] | null;
  /** Lama sewa minimum dalam satuan durasinya. null = tanpa syarat. */
  lamaMin: number | null;
  /**
   * "YYYY-MM-DD", inklusif — voucher BELUM hidup sebelum tanggal ini.
   * null = hidup sejak dibuat.
   *
   * Ini tanggal KAMPANYE, bukan syarat tanggal masuk penyewa. Voucher yang
   * dijadwalkan mulai 1 September tidak ditawarkan sebelum tanggal itu; sesudah
   * ditawarkan, ia menilai pemesanan seperti voucher lain. Menjadikannya syarat
   * tanggal masuk sekaligus akan membuat satu isian berarti dua hal, dan
   * pemilik tidak punya cara membedakannya.
   */
  berlakuMulai: string | null;
  /** "YYYY-MM-DD", inklusif — voucher masih hidup di tanggal ini. */
  berlakuSampai: string | null;
  /** Batas jumlah pemakaian. null = tanpa batas. */
  kuotaTotal: number | null;
  /** Sudah dipakai berapa kali. Selalu ≥ 0. */
  kuotaTerpakai: number;
  /**
   * Dimatikan sementara tanpa dihapus. Voucher tidak aktif TIDAK pernah
   * dikirim ke pengunjung publik — hanya terlihat pemiliknya di panel kelola.
   */
  aktif: boolean;
  /**
   * true = tidak pernah muncul di daftar; hanya bisa dipanggil dengan mengetik
   * kodenya. Untuk promo tertutup (kerja sama kampus, kode influencer) yang
   * tidak boleh bocor hanya karena ada orang membuka halaman.
   */
  rahasia: boolean;
}

/** Keadaan pemesanan yang sedang dinilai. Semua angka dalam rupiah penuh. */
export interface KonteksVoucher {
  /** Harga sewa × lama, SESUDAH promo listing. Deposit tidak termasuk. */
  subtotal: number;
  durasi: DurasiKey;
  lama: number;
  /** Tanggal masuk; null bila penyewa belum memilih tanggal. */
  tanggalMulai: Date | null;
  /**
   * Tipe kamar yang sedang dipilih penyewa. null pada listing tanpa tipe
   * (unit tunggal) atau saat penyewa belum memilih.
   */
  idTipe?: string | null;
  /**
   * id tipe → namanya. HANYA dipakai menyusun kalimat sebab ("Hanya untuk
   * tipe Deluxe"), tidak pernah ikut menentukan sah atau tidaknya voucher.
   *
   * Dikirim pemanggil, bukan disimpan di voucher: nama tipe boleh diubah
   * pemiliknya kapan saja, dan kalimat yang dibaca penyewa harus memakai nama
   * yang sedang tampil di kartu tipe di atasnya — bukan nama saat vouchernya
   * dulu dibuat.
   */
  namaTipe?: Record<string, string>;
}

export interface HasilVoucher {
  berlaku: boolean;
  /** Rupiah yang dipotong. Selalu 0 saat `berlaku` false. */
  potongan: number;
  /**
   * Sebab kalau tidak berlaku — ditulis sebagai syarat yang bisa dipenuhi
   * ("Untuk sewa minimal 6 bulan"), bukan sebagai penolakan ("Tidak
   * memenuhi syarat"). Yang pertama bisa ditindaklanjuti, yang kedua buntu.
   */
  alasan: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// TANGGAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * "YYYY-MM-DD" waktu lokal perangkat.
 *
 * Sengaja BUKAN toISOString().slice(0,10): itu mengubah ke UTC lebih dulu,
 * sehingga di WIB (UTC+7) setiap tanggal sebelum pukul 07.00 mundur satu hari —
 * voucher yang berakhir "hari ini" akan terbaca kedaluwarsa sejak tengah malam.
 */
export const kunciTanggal = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

/** Jarak hari kalender dari HARI INI ke "YYYY-MM-DD". Negatif = sudah lewat. */
function selisihHariKunci(kunci: string, sekarang: Date): number {
  // Dihitung dari tengah malam ke tengah malam, bukan dari jam sekarang —
  // kalau tidak, voucher yang berakhir besok sore terbaca "0 hari lagi".
  const [th, bl, tg] = kunci.split("-").map(Number);
  const target = new Date(th, bl - 1, tg);
  const awal = new Date(
    sekarang.getFullYear(),
    sekarang.getMonth(),
    sekarang.getDate(),
  );
  return Math.round((target.getTime() - awal.getTime()) / 86_400_000);
}

/**
 * Sisa hari sampai voucher mati. null = tanpa tanggal akhir.
 * Negatif berarti sudah lewat.
 */
export function sisaHariVoucher(
  v: Pick<Voucher, "berlakuSampai">,
  sekarang = new Date(),
): number | null {
  if (!v.berlakuSampai) return null;
  return selisihHariKunci(v.berlakuSampai, sekarang);
}

/**
 * Hari menuju voucher mulai hidup. null = tanpa jadwal mulai.
 * ≤ 0 berarti sudah dimulai.
 */
export function hariMenujuMulai(
  v: Pick<Voucher, "berlakuMulai">,
  sekarang = new Date(),
): number | null {
  if (!v.berlakuMulai) return null;
  return selisihHariKunci(v.berlakuMulai, sekarang);
}

/** "2026-09-30" → "30 Sep 2026". */
export function tanggalRingkas(kunci: string): string {
  const [th, bl, tg] = kunci.split("-").map(Number);
  return new Date(th, bl - 1, tg).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "YYYY-MM-DD" n hari dari hari ini — dipakai preset & pembatas input tanggal. */
export function kunciTambahHari(n: number, sekarang = new Date()): string {
  const d = new Date(
    sekarang.getFullYear(),
    sekarang.getMonth(),
    sekarang.getDate() + n,
  );
  return kunciTanggal(d);
}

// ─────────────────────────────────────────────────────────────────────────────
// KUOTA
// ─────────────────────────────────────────────────────────────────────────────

/** Sisa jatah pemakaian. null = tanpa batas. Tidak pernah negatif. */
export function sisaKuota(
  v: Pick<Voucher, "kuotaTotal" | "kuotaTerpakai">,
): number | null {
  if (v.kuotaTotal == null) return null;
  return Math.max(0, v.kuotaTotal - v.kuotaTerpakai);
}

export function kuotaHabis(
  v: Pick<Voucher, "kuotaTotal" | "kuotaTerpakai">,
): boolean {
  return sisaKuota(v) === 0;
}

/**
 * Kuota yang tersisanya sedikit — ambang untuk menyalakan nada mendesak
 * ("Sisa 3 lagi") di kartu penyewa.
 *
 * Ambangnya relatif DAN absolut: 3 dari 5 bukan keadaan mendesak, 3 dari 100
 * iya. Yang dipakai batas terkecil di antara keduanya supaya kuota kecil tidak
 * berteriak "hampir habis" sejak pemakaian pertama.
 */
export function kuotaMenipis(
  v: Pick<Voucher, "kuotaTotal" | "kuotaTerpakai">,
): boolean {
  const sisa = sisaKuota(v);
  if (sisa == null || sisa === 0 || v.kuotaTotal == null) return false;
  return sisa <= Math.min(5, Math.ceil(v.kuotaTotal * 0.25));
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS — satu voucher, satu keadaan
//
// Dihitung, tidak disimpan. Kolom `aktif` di DB hanya berarti "pemiliknya
// belum mematikannya"; apakah ia benar-benar hidup hari ini juga bergantung
// pada jadwal & kuota, dan ketiganya berubah tanpa ada yang menulis ulang
// barisnya.
// ─────────────────────────────────────────────────────────────────────────────

export type StatusVoucher =
  /** Tanggal akhirnya sudah lewat. Menyalakannya tidak mengubah apa pun. */
  | "KEDALUWARSA"
  /** Kuotanya sudah tandas. */
  | "HABIS"
  /** Dimatikan sendiri oleh pemiliknya. */
  | "NONAKTIF"
  /** Sah & lengkap, tapi tanggal mulainya belum tiba. */
  | "TERJADWAL"
  /** Sedang ditawarkan kepada penyewa. */
  | "AKTIF";

export interface StatusMetaVoucher {
  status: StatusVoucher;
  label: string;
  ikon: string;
  aksen: AksenKey;
  /** Satu kalimat pendek untuk pemilik — apa artinya & apa yang bisa diperbuat. */
  keterangan: string;
  /** true = sedang ditawarkan ke penyewa hari ini. */
  hidup: boolean;
}

/**
 * URUTAN PEMERIKSAANNYA DISENGAJA dan bukan selera: yang dinilai lebih dulu
 * adalah keadaan yang TIDAK BISA diperbaiki hanya dengan menyalakan sakelar.
 *
 * Voucher yang sudah lewat tanggal DAN dimatikan pemiliknya harus terbaca
 * "Kedaluwarsa", bukan "Nonaktif" — kalau tidak, pemilik menyalakannya,
 * tidak terjadi apa-apa, dan dia menyimpulkan fiturnya rusak.
 */
export function statusVoucher(
  v: Voucher,
  sekarang = new Date(),
): StatusMetaVoucher {
  const sisaHari = sisaHariVoucher(v, sekarang);

  if (sisaHari != null && sisaHari < 0) {
    return {
      status: "KEDALUWARSA",
      label: "Kedaluwarsa",
      ikon: "solar:calendar-minimalistic-bold-duotone",
      aksen: "netral",
      keterangan: `Berakhir ${tanggalRingkas(v.berlakuSampai!)}. Beri tanggal baru untuk memakainya lagi.`,
      hidup: false,
    };
  }

  if (kuotaHabis(v)) {
    return {
      status: "HABIS",
      label: "Kuota habis",
      ikon: "solar:box-minimalistic-bold-duotone",
      aksen: "amber",
      keterangan: `Terpakai ${v.kuotaTerpakai} dari ${v.kuotaTotal}. Tambah kuota untuk membukanya lagi.`,
      hidup: false,
    };
  }

  if (!v.aktif) {
    return {
      status: "NONAKTIF",
      label: "Nonaktif",
      ikon: "solar:pause-circle-bold-duotone",
      aksen: "netral",
      keterangan: "Disembunyikan oleh Anda. Syaratnya utuh dan siap dinyalakan kapan saja.",
      hidup: false,
    };
  }

  const menujuMulai = hariMenujuMulai(v, sekarang);
  if (menujuMulai != null && menujuMulai > 0) {
    return {
      status: "TERJADWAL",
      label: "Terjadwal",
      ikon: "solar:clock-circle-bold-duotone",
      aksen: "sky",
      keterangan:
        menujuMulai === 1
          ? "Mulai ditawarkan besok."
          : `Mulai ditawarkan ${tanggalRingkas(v.berlakuMulai!)} — ${menujuMulai} hari lagi.`,
      hidup: false,
    };
  }

  return {
    status: "AKTIF",
    label: "Aktif",
    ikon: "solar:check-circle-bold-duotone",
    aksen: "mint",
    keterangan:
      sisaHari == null
        ? "Sedang ditawarkan ke calon penyewa."
        : sisaHari === 0
          ? "Hari terakhir ditawarkan."
          : `Ditawarkan sampai ${tanggalRingkas(v.berlakuSampai!)}.`,
    hidup: true,
  };
}

/** Cukup untuk penyaringan; tidak perlu membangun seluruh meta. */
export const voucherHidup = (v: Voucher, sekarang = new Date()): boolean =>
  statusVoucher(v, sekarang).status === "AKTIF";

// ─────────────────────────────────────────────────────────────────────────────
// MESIN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Potongan mentah — sebelum syarat diperiksa dan sebelum dibatasi subtotal.
 * Dipisah supaya daftar voucher bisa menampilkan "hemat Rp 250.000" pada
 * voucher yang syaratnya BELUM terpenuhi: itu justru angka yang membuat
 * penyewa mau memenuhi syaratnya.
 */
export function potonganMentah(
  v: Pick<Voucher, "jenis" | "nilai" | "potonganMaks">,
  subtotal: number,
): number {
  const kasar = v.jenis === "PERSEN" ? (subtotal * v.nilai) / 100 : v.nilai;
  const dibatasi =
    v.potonganMaks != null ? Math.min(kasar, v.potonganMaks) : kasar;
  // Dibulatkan ke bawah ke rupiah penuh. Ke bawah, bukan ke terdekat: selisih
  // setengah rupiah yang menguntungkan penyewa tidak pernah jadi masalah,
  // sebaliknya bisa membuat total di layar berbeda dari total di server.
  return Math.max(0, Math.floor(dibatasi));
}

/**
 * Nilai satu voucher terhadap satu keadaan pemesanan.
 *
 * Urutan pemeriksaannya disengaja: yang PALING TIDAK BISA DIUBAH penyewa
 * diperiksa lebih dulu (kedaluwarsa → kuota → jadwal → durasi → lama sewa →
 * nilai transaksi), supaya kalimat yang muncul selalu hambatan yang paling
 * pokok. Memeriksa "minimal transaksi" lebih dulu pada voucher yang sudah
 * kedaluwarsa akan menyuruh penyewa memperpanjang sewa demi voucher mati.
 */
export function evaluasiVoucher(
  v: Voucher,
  ctx: KonteksVoucher,
  sekarang = new Date(),
): HasilVoucher {
  const tolak = (alasan: string): HasilVoucher => ({
    berlaku: false,
    potongan: 0,
    alasan,
  });

  const sisa = sisaHariVoucher(v, sekarang);
  if (sisa != null && sisa < 0) return tolak("Masa berlaku sudah lewat");

  if (kuotaHabis(v)) return tolak("Kuota promo sudah habis");

  const menujuMulai = hariMenujuMulai(v, sekarang);
  if (menujuMulai != null && menujuMulai > 0) {
    return tolak(`Berlaku mulai ${tanggalRingkas(v.berlakuMulai!)}`);
  }

  // Voucher dipakai pada masa sewa, jadi tanggal masuk yang jatuh setelah
  // voucher mati tetap tidak sah walau hari ini vouchernya masih hidup.
  if (v.berlakuSampai && ctx.tanggalMulai) {
    if (kunciTanggal(ctx.tanggalMulai) > v.berlakuSampai) {
      return tolak(
        `Hanya untuk sewa yang mulai sebelum ${tanggalRingkas(v.berlakuSampai)}`,
      );
    }
  }

  if (v.durasiBerlaku && !v.durasiBerlaku.includes(ctx.durasi)) {
    const daftar = v.durasiBerlaku
      .map((d) => DURASI_META[d].label.toLowerCase())
      .join(" atau ");
    return tolak(`Hanya untuk sewa ${daftar}`);
  }

  // Tipe kamar diperiksa SESUDAH durasi, sebelum lama sewa: keduanya sama-sama
  // "kamar yang salah", dan penyewa yang memilih tipe lain lebih cepat menemukan
  // jalan keluarnya daripada yang harus memperpanjang masa sewa.
  if (v.tipeBerlaku && v.tipeBerlaku.length > 0) {
    if (!ctx.idTipe || !v.tipeBerlaku.includes(ctx.idTipe)) {
      // Nama tipe yang sudah dihapus tidak punya entri di `namaTipe`; yang
      // tersisa tetap disebut. Kalau tak satu pun bisa dinamai, kalimatnya
      // turun ke bentuk umum — lebih baik daripada "Hanya untuk tipe " yang
      // menggantung tanpa objek.
      const nama = v.tipeBerlaku
        .map((id) => ctx.namaTipe?.[id])
        .filter((n): n is string => Boolean(n));
      return tolak(
        nama.length > 0
          ? `Hanya untuk tipe ${nama.join(" atau ")}`
          : "Hanya untuk tipe kamar tertentu",
      );
    }
  }

  if (v.lamaMin != null && ctx.lama < v.lamaMin) {
    return tolak(
      `Untuk sewa minimal ${v.lamaMin} ${DURASI_META[ctx.durasi].satuan}`,
    );
  }

  if (v.minTransaksi != null && ctx.subtotal < v.minTransaksi) {
    return tolak(`Minimal transaksi ${formatRupiah(v.minTransaksi)}`);
  }

  if (ctx.subtotal <= 0) return tolak("Harga sewa belum tersedia");

  // Potongan tidak pernah melebihi yang dibayar. Tanpa batas ini, voucher
  // nominal Rp 500.000 pada sewa harian Rp 150.000 menghasilkan total minus.
  const potongan = Math.min(potonganMentah(v, ctx.subtotal), ctx.subtotal);

  if (potongan <= 0) return tolak("Tidak ada potongan untuk pilihan ini");

  return { berlaku: true, potongan, alasan: null };
}

/**
 * Voucher paling menguntungkan yang BENAR-BENAR berlaku sekarang.
 *
 * Dipakai untuk menandai satu kartu sebagai rekomendasi. Hanya yang berlaku
 * yang ikut dinilai — merekomendasikan voucher bernilai besar yang syaratnya
 * belum terpenuhi hanya memindahkan kekecewaan ke satu ketukan berikutnya.
 */
export function voucherTerbaik(
  daftar: Voucher[],
  ctx: KonteksVoucher,
  sekarang = new Date(),
): { voucher: Voucher; potongan: number } | null {
  let juara: { voucher: Voucher; potongan: number } | null = null;
  for (const v of daftar) {
    const h = evaluasiVoucher(v, ctx, sekarang);
    if (!h.berlaku) continue;
    if (!juara || h.potongan > juara.potongan)
      juara = { voucher: v, potongan: h.potongan };
  }
  return juara;
}

/**
 * Urutan tampil daftar voucher: yang berlaku di atas (potongan terbesar dulu),
 * yang belum memenuhi syarat di bawah (tetap potongan terbesar dulu, karena
 * itu yang paling layak diperjuangkan penyewa).
 *
 * Tidak memakai `Array.prototype.sort` di tempat — daftar aslinya milik hook
 * dan ikut dipakai untuk pencocokan kode.
 */
export function urutkanVoucher(
  daftar: Voucher[],
  ctx: KonteksVoucher,
  sekarang = new Date(),
): Voucher[] {
  return [...daftar].sort((a, b) => {
    const ha = evaluasiVoucher(a, ctx, sekarang);
    const hb = evaluasiVoucher(b, ctx, sekarang);
    if (ha.berlaku !== hb.berlaku) return ha.berlaku ? -1 : 1;
    const pa = ha.berlaku ? ha.potongan : potonganMentah(a, ctx.subtotal);
    const pb = hb.berlaku ? hb.potongan : potonganMentah(b, ctx.subtotal);
    return pb - pa;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TAMPILAN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ikon, label & aksen kartu voucher — DITURUNKAN dari sifat vouchernya, bukan
 * dari kolom "sumber" yang harus diisi pemilik.
 *
 * Semua voucher di sini dibuat oleh pemegang listing, jadi menanyakan
 * "sumbernya dari mana" hanya menambah satu isian yang jawabannya selalu sama.
 * Yang benar-benar membedakan tampilannya cuma satu: apakah ia terbuka untuk
 * semua orang, atau harus ditebus dengan kode.
 *
 * Ditaruh di sini, bukan di komponen — dua tempat yang memilih ikon sendiri
 * akan segera berbeda.
 */
export function metaVoucher(v: Pick<Voucher, "rahasia">): {
  label: string;
  ikon: string;
  aksen: AksenKey;
} {
  return v.rahasia
    ? { label: "Kode khusus", ikon: "solar:key-bold-duotone", aksen: "sky" }
    : { label: "Promo", ikon: "solar:ticket-sale-bold-duotone", aksen: "mint" };
}

/**
 * Syarat voucher sebagai potongan kalimat pendek untuk pill di kartu.
 *
 * Maksimal tiga: kartu voucher dibaca sambil memilih, bukan dipelajari.
 * Syarat selengkapnya memang tidak muat — dan yang menentukan pilihan hanya
 * angka potongan & syarat terberatnya.
 */
export function ringkasSyarat(
  v: Voucher,
  namaTipe?: Record<string, string>,
): string[] {
  const out: string[] = [];

  // Tipe kamar didahulukan: pada kos, "cuma buat tipe Standard" adalah syarat
  // yang paling sering membatalkan pilihan, dan pill yang terpotong di urutan
  // keempat sama saja dengan tidak ditulis.
  if (v.tipeBerlaku && v.tipeBerlaku.length > 0) {
    const nama = v.tipeBerlaku
      .map((id) => namaTipe?.[id])
      .filter((n): n is string => Boolean(n));
    out.push(
      nama.length > 0 ? nama.join("/") : `${v.tipeBerlaku.length} tipe tertentu`,
    );
  }

  if (v.durasiBerlaku && v.durasiBerlaku.length > 0) {
    out.push(v.durasiBerlaku.map((d) => DURASI_META[d].label).join("/"));
  }
  if (v.lamaMin != null && v.lamaMin > 1) {
    out.push(`Min. ${v.lamaMin}×`);
  }
  if (v.minTransaksi != null) {
    out.push(`Min. ${ringkasRupiah(v.minTransaksi)}`);
  }
  if (v.potonganMaks != null && v.jenis === "PERSEN") {
    out.push(`Maks. ${ringkasRupiah(v.potonganMaks)}`);
  }

  return out.slice(0, 3);
}

/** "Rp 1,5jt" / "Rp 250rb" — hanya untuk pill syarat yang ruangnya sempit. */
export function ringkasRupiah(n: number): string {
  if (n >= 1_000_000) {
    const jt = n / 1_000_000;
    return `Rp ${(Math.round(jt * 10) / 10).toString().replace(".", ",")}jt`;
  }
  if (n >= 1_000) return `Rp ${Math.round(n / 1_000)}rb`;
  return formatRupiah(n);
}

/** Label besar di sisi kanan kartu: "10%" atau "Rp 500rb". */
export function labelNilai(v: Pick<Voucher, "jenis" | "nilai">): string {
  return v.jenis === "PERSEN" ? `${v.nilai}%` : ringkasRupiah(v.nilai);
}

// ─────────────────────────────────────────────────────────────────────────────
// BAHASA MANUSIA — untuk PEMILIK, bukan untuk penyewa
//
// Form voucher punya delapan isian, dan delapan isian yang masing-masing benar
// masih bisa menghasilkan promo yang artinya tidak seperti yang dibayangkan
// pembuatnya. Fungsi di bawah ini menerjemahkan seluruh isian kembali ke satu
// kalimat bahasa Indonesia, supaya kesalahannya terlihat SEBELUM disimpan —
// bukan sesudah ada penyewa yang memakainya.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hanya bidang yang benar-benar dibaca kedua fungsi di bawah — bukan
 * `Omit<Voucher, …>`. Bedanya penting: `InputVoucher` (isi form yang belum
 * tersimpan) punya `deskripsi: string | null` dan `durasiBerlaku` tanpa null,
 * jadi ia TIDAK cocok dengan bentuk turunan `Voucher`. Menuliskan kebutuhannya
 * apa adanya membuat form & voucher tersimpan bisa memakai fungsi yang sama
 * tanpa satu pun konversi di tempat pemanggilan.
 */
type BentukTerbaca = {
  jenis: JenisVoucher;
  nilai: number;
  potonganMaks: number | null;
  minTransaksi: number | null;
  durasiBerlaku: DurasiKey[] | null;
  tipeBerlaku: string[] | null;
  lamaMin: number | null;
  berlakuMulai: string | null;
  berlakuSampai: string | null;
  kuotaTotal: number | null;
  kuotaTerpakai?: number;
  rahasia: boolean;
};

/**
 * Satu kalimat utuh yang menyatakan seluruh aturan voucher.
 *
 * Dibaca sekali oleh pemilik sebelum menyimpan. Ini alasan kenapa isian
 * "potongan maksimal" tidak lagi bisa terlupa: kalimatnya berbunyi "hemat 15%
 * dari total sewa" tanpa batas apa pun, dan itu langsung terasa salah.
 */
export function kalimatVoucher(
  v: BentukTerbaca,
  namaTipe?: Record<string, string>,
): string {
  const bagian: string[] = [];

  const besaran =
    v.jenis === "PERSEN"
      ? `Penyewa hemat ${v.nilai || 0}% dari total sewa${
          v.potonganMaks ? `, maksimal ${ringkasRupiah(v.potonganMaks)}` : ""
        }`
      : `Penyewa hemat ${formatRupiah(v.nilai || 0)}`;
  bagian.push(besaran);

  const syarat: string[] = [];
  if (v.tipeBerlaku && v.tipeBerlaku.length > 0) {
    const nama = v.tipeBerlaku
      .map((id) => namaTipe?.[id])
      .filter((n): n is string => Boolean(n));
    syarat.push(
      nama.length > 0
        ? `tipe ${nama.join(" atau ")}`
        : `${v.tipeBerlaku.length} tipe kamar tertentu`,
    );
  }
  if (v.durasiBerlaku && v.durasiBerlaku.length > 0) {
    syarat.push(
      `sewa ${v.durasiBerlaku.map((d) => DURASI_META[d].label.toLowerCase()).join(" atau ")}`,
    );
  }
  if (v.lamaMin != null && v.lamaMin > 1) {
    // Satuannya diambil dari durasi yang dilayani kalau tunggal; kalau voucher
    // melayani beberapa durasi, "6 periode" lebih jujur daripada memilih salah
    // satu satuan dan membuat dua pembaca mengerti dua hal berbeda.
    const satuan =
      v.durasiBerlaku && v.durasiBerlaku.length === 1
        ? DURASI_META[v.durasiBerlaku[0]].satuan
        : "periode";
    syarat.push(`minimal ${v.lamaMin} ${satuan}`);
  }
  if (v.minTransaksi != null && v.minTransaksi > 0) {
    syarat.push(`total sewa minimal ${ringkasRupiah(v.minTransaksi)}`);
  }
  if (syarat.length > 0) bagian.push(`untuk ${syarat.join(", ")}`);

  const kalimat = bagian.join(" ") + ".";

  const tambahan: string[] = [];
  if (v.berlakuMulai && v.berlakuSampai) {
    tambahan.push(
      `Ditawarkan ${tanggalRingkas(v.berlakuMulai)} – ${tanggalRingkas(v.berlakuSampai)}`,
    );
  } else if (v.berlakuMulai) {
    tambahan.push(`Mulai ditawarkan ${tanggalRingkas(v.berlakuMulai)}`);
  } else if (v.berlakuSampai) {
    tambahan.push(`Ditawarkan sampai ${tanggalRingkas(v.berlakuSampai)}`);
  }
  if (v.kuotaTotal != null) {
    tambahan.push(`dibatasi ${v.kuotaTotal} pemakaian`);
  }
  if (v.rahasia) {
    tambahan.push("hanya untuk penyewa yang tahu kodenya");
  }

  return tambahan.length > 0 ? `${kalimat} ${tambahan.join(", ")}.` : kalimat;
}

/**
 * Rupiah TERBESAR yang mungkin ditanggung pemilik dari satu voucher.
 * null = tidak bisa dihitung, dan itu justru temuannya.
 *
 * Ini angka yang paling ditanyakan pemilik dan paling jarang disediakan sistem
 * voucher: "promo ini bisa menelan berapa?". Bisa dijawab hanya kalau DUA hal
 * terbatas — besar satu potongan (nominal, atau persen yang punya batas atas)
 * dan banyaknya pemakaian (kuota). Kehilangan salah satunya membuat jawabannya
 * tak terhingga, dan menampilkan angka apa pun di situ akan berbohong.
 */
export function anggaranMaksimal(v: BentukTerbaca): number | null {
  const perPemakaian =
    v.jenis === "NOMINAL" ? v.nilai : v.potonganMaks != null ? v.potonganMaks : null;
  if (perPemakaian == null || v.kuotaTotal == null) return null;
  return Math.max(0, Math.round(perPemakaian * v.kuotaTotal));
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMULASI — "kalau dipakai, angkanya jadi berapa?"
//
// Pemilik tidak berpikir dalam persen; dia berpikir dalam rupiah yang masuk ke
// rekeningnya. Voucher 15% pada kos Rp 1,2 juta/bulan untuk sewa 6 bulan
// terdengar wajar sampai angkanya ditulis: Rp 1.080.000 yang tidak jadi
// diterima. Simulasi ini memakai HARGA LISTING YANG SEBENARNYA, bukan contoh
// karangan — angka karangan hanya melatih pemilik mengabaikan blok ini.
// ─────────────────────────────────────────────────────────────────────────────

export interface SimulasiVoucher {
  durasi: DurasiKey;
  lama: number;
  /** Harga sewa × lama, sebelum potongan. */
  subtotal: number;
  potongan: number;
  /** Yang dibayar penyewa (di luar deposit & biaya tambahan). */
  bayar: number;
  /** Potongan sebagai persentase subtotal — dibulatkan untuk tampilan. */
  persen: number;
  berlaku: boolean;
  alasan: string | null;
}

/**
 * @param hargaSatuan Harga per satu periode durasi (mis. per bulan).
 *   0 berarti listing tidak menjual durasi itu — hasilnya tetap dikembalikan
 *   dengan `berlaku` false supaya pemanggil tidak perlu menangani null.
 */
export function simulasiVoucher(
  v: Voucher,
  hargaSatuan: number,
  durasi: DurasiKey,
  lama: number,
  sekarang = new Date(),
): SimulasiVoucher {
  const subtotal = Math.max(0, Math.round(hargaSatuan * lama));
  const hasil = evaluasiVoucher(
    v,
    // `tanggalMulai` null: simulasi menilai BENTUK vouchernya, bukan satu
    // pemesanan tertentu. Menyodorkan tanggal hari ini akan membuat voucher
    // yang sah tampak gugur hanya karena kebetulan disimulasikan di hari
    // terakhir masa berlakunya.
    { subtotal, durasi, lama, tanggalMulai: null },
    sekarang,
  );

  return {
    durasi,
    lama,
    subtotal,
    potongan: hasil.potongan,
    bayar: Math.max(0, subtotal - hasil.potongan),
    persen: subtotal > 0 ? Math.round((hasil.potongan / subtotal) * 100) : 0,
    berlaku: hasil.berlaku,
    alasan: hasil.alasan,
  };
}

/** Tiga lama sewa yang masuk akal untuk disimulasikan pada satu durasi. */
const LAMA_LAZIM: Record<DurasiKey, number[]> = {
  HARIAN: [1, 7, 30],
  MINGGUAN: [1, 4, 12],
  BULANAN: [1, 6, 12],
  TAHUNAN: [1, 2, 3],
};

/**
 * Pilihan lama sewa untuk tombol simulasi.
 *
 * `lamaMin` selalu ikut kalau disetel — tanpa itu, voucher bersyarat "minimal
 * 6 bulan" disimulasikan pada 1 & 12 bulan saja, dan pemilik tidak pernah
 * melihat angka pada titik syaratnya sendiri.
 */
export function pilihanLamaSimulasi(
  v: Pick<Voucher, "lamaMin">,
  durasi: DurasiKey,
): number[] {
  const dasar = new Set(LAMA_LAZIM[durasi]);
  if (v.lamaMin != null && v.lamaMin > 1) dasar.add(v.lamaMin);
  return [...dasar].sort((a, b) => a - b).slice(0, 4);
}

// ─────────────────────────────────────────────────────────────────────────────
// PRESET — form dimulai dari TUJUAN, bukan dari kolom kosong
//
// Ini pintu masuk utama pembuatan voucher, dan alasannya bisa diuji sendiri:
// isian "jenis potongan", "potongan maksimal", "minimal lama sewa" & "kuota"
// tidak berarti apa-apa bagi pemilik kos yang baru pertama membuat promo. Yang
// dia tahu adalah apa yang ingin dicapainya — "biar yang sewa setahun mau
// bayar di muka", "biar kamar sisa cepat terisi".
//
// Preset menerjemahkan tujuan itu menjadi kombinasi isian yang sudah benar,
// termasuk pasangan yang mudah terlupa (persen TANPA batas atas, kuota TANPA
// tanggal akhir). Semuanya tetap bisa diubah sesudahnya — preset menyiapkan
// titik berangkat, bukan mengunci hasil.
// ─────────────────────────────────────────────────────────────────────────────

export interface PresetVoucher {
  id: string;
  judul: string;
  /** Tujuan yang dilayani, dari sudut pandang pemilik. */
  ringkas: string;
  ikon: string;
  aksen: AksenKey;
  /** Isian awal. Digabung di atas `KOSONG_VOUCHER`. */
  isi: Partial<InputVoucher>;
}

/** Pembulatan ke atas ke kelipatan Rp 50.000 supaya angka usulannya "bulat". */
const bulatkanRatus = (n: number): number =>
  Math.max(50_000, Math.ceil(n / 50_000) * 50_000);

/**
 * @param hargaAcuan Harga listing per periode `durasiUtama`. 0 bila belum ada
 *   harga — preset nominal lalu memakai angka aman Rp 250.000, bukan Rp 0 yang
 *   akan langsung ditolak validator dan membuat preset terasa rusak.
 * @param durasiTersedia Durasi yang benar-benar dijual listing ini.
 */
export function presetVoucher(
  hargaAcuan: number,
  durasiUtama: DurasiKey,
  durasiTersedia: DurasiKey[],
): PresetVoucher[] {
  const harga = hargaAcuan > 0 ? hargaAcuan : 0;
  const satuan = DURASI_META[durasiUtama].satuan;
  const nominalWajar = harga > 0 ? bulatkanRatus(harga * 0.1) : 250_000;
  // Batas atas persen diturunkan dari harga: 10% dari SATU periode adalah
  // angka yang pemilik kenal, dan mencegah promo persen menggerogoti sewa
  // panjang tanpa disadari.
  const batasPersen = harga > 0 ? bulatkanRatus(harga * 0.15) : 500_000;

  const semuaDurasi = durasiTersedia.length > 0 ? durasiTersedia : DURASI_URUT;
  const durasiPanjang = semuaDurasi.filter(
    (d) => d === "BULANAN" || d === "TAHUNAN",
  );

  const daftar: PresetVoucher[] = [
    {
      id: "potongan-langsung",
      judul: "Potongan langsung",
      ringkas: `Angka rupiah tetap. Paling cepat dipahami penyewa — “hemat ${ringkasRupiah(nominalWajar)}” tidak perlu dihitung dulu.`,
      ikon: "solar:tag-price-bold-duotone",
      aksen: "mint",
      isi: {
        nama: `Potongan ${ringkasRupiah(nominalWajar)}`,
        kode: "HEMAT" + Math.round(nominalWajar / 1000),
        jenis: "NOMINAL",
        nilai: nominalWajar,
        deskripsi: "Potongan langsung dari total biaya sewa.",
      },
    },
    {
      id: "diskon-persen",
      judul: "Diskon persen",
      ringkas:
        "Ikut membesar saat sewa makin panjang. Batas atasnya sudah disiapkan supaya tidak menggerogoti sewa tahunan.",
      ikon: "solar:sale-square-bold-duotone",
      aksen: "violet",
      isi: {
        nama: "Diskon 10% biaya sewa",
        kode: "DISKON10",
        jenis: "PERSEN",
        nilai: 10,
        potonganMaks: batasPersen,
        deskripsi: "Potongan 10% dari total biaya sewa.",
      },
    },
    {
      id: "sewa-panjang",
      judul: "Hadiah sewa panjang",
      ringkas: `Hanya cair kalau penyewa mengambil minimal 6 ${satuan}. Menukar potongan dengan kepastian kamar terisi lama.`,
      ikon: "solar:calendar-mark-bold-duotone",
      aksen: "sky",
      isi: {
        nama: `Diskon 15% sewa 6 ${satuan}`,
        kode: "PANJANG15",
        jenis: "PERSEN",
        nilai: 15,
        potonganMaks: batasPersen,
        lamaMin: 6,
        durasiBerlaku: durasiPanjang.length > 0 ? durasiPanjang : [durasiUtama],
        deskripsi: `Berlaku untuk sewa minimal 6 ${satuan}.`,
      },
    },
    {
      id: "promo-kilat",
      judul: "Promo kilat",
      ringkas:
        "Berumur 7 hari dan dibatasi 10 pemakaian. Untuk kamar yang harus cepat terisi — kelangkaan yang jujur, bukan hitung mundur karangan.",
      ikon: "solar:fire-bold-duotone",
      aksen: "amber",
      isi: {
        nama: `Promo kilat ${ringkasRupiah(nominalWajar)}`,
        kode: "KILAT7",
        jenis: "NOMINAL",
        nilai: nominalWajar,
        berlakuSampai: kunciTambahHari(7),
        kuotaTotal: 10,
        deskripsi: "Promo terbatas — berlaku 7 hari atau sampai kuota habis.",
      },
    },
    {
      id: "kode-khusus",
      judul: "Kode khusus",
      ringkas:
        "Tidak pernah muncul di daftar. Hanya cair untuk orang yang Anda beri kodenya — kerja sama kampus, kantor, atau tamu undangan.",
      ikon: "solar:key-bold-duotone",
      aksen: "cyan",
      isi: {
        nama: "Kode khusus mitra",
        kode: "MITRA",
        jenis: "NOMINAL",
        nilai: nominalWajar,
        rahasia: true,
        deskripsi: "Potongan khusus untuk penyewa yang membawa kode ini.",
      },
    },
  ];

  /**
   * "Gratis 1 periode" hanya ditawarkan kalau harga sewanya diketahui.
   *
   * Nilainya memang harga satu periode itu sendiri — tanpa harga, satu-satunya
   * angka yang bisa diisi preset adalah 0, dan voucher bernilai 0 ditolak
   * validator. Menyodorkan pilihan yang pasti gagal saat disimpan lebih buruk
   * daripada tidak menyodorkannya sama sekali: pemilik menyalahkan sistemnya,
   * bukan harga listingnya yang belum diisi.
   */
  if (harga > 0) {
    daftar.push({
      id: "gratis-satu-periode",
      judul: `Gratis 1 ${satuan}`,
      ringkas: `Setara ${formatRupiah(harga)}, ditukar dengan komitmen sewa 12 ${satuan}. Pola yang dipakai kos & apartemen untuk mengunci penghuni setahun.`,
      ikon: "solar:gift-bold-duotone",
      aksen: "pink",
      isi: {
        nama: `Gratis 1 ${satuan} untuk sewa 12 ${satuan}`,
        kode: "GRATIS1",
        jenis: "NOMINAL",
        nilai: Math.round(harga),
        lamaMin: 12,
        durasiBerlaku: [durasiUtama],
        deskripsi: `Potongan setara 1 ${satuan} sewa untuk kontrak 12 ${satuan}.`,
      },
    });
  }

  // "Mulai dari kosong" selalu TERAKHIR. Menghilangkannya akan memaksa pemilik
  // berpengalaman menghapus isian preset satu per satu — jalan yang lebih
  // lambat daripada mengetik dari nol.
  daftar.push({
    id: "kosong",
    judul: "Mulai dari kosong",
    ringkas:
      "Semua isian dibiarkan kosong. Untuk promo yang bentuknya sudah Anda tahu persis.",
    ikon: "solar:pen-new-square-bold-duotone",
    aksen: "netral",
    isi: {},
  });

  return daftar;
}

// ─────────────────────────────────────────────────────────────────────────────
// PENYUNTINGAN — dipakai FORM PEMILIK dan API dari satu tempat
//
// Ini bagian yang paling mudah retak kalau ditulis dua kali. Form yang lebih
// longgar daripada API menghasilkan penolakan yang tidak bisa dijelaskan
// ("kenapa saya ditolak, isian saya hijau semua"); form yang lebih ketat
// menyembunyikan voucher yang sebenarnya sah. Karena itu keduanya memanggil
// `validasiVoucher` yang sama persis, dan menyimpan hasil `normalisasiInput`
// yang sama persis.
// ─────────────────────────────────────────────────────────────────────────────

/** Bentuk mentah dari form pemilik. Belum tentu sah — itu tugas validator. */
export interface InputVoucher {
  kode: string;
  nama: string;
  deskripsi: string | null;
  jenis: JenisVoucher;
  nilai: number;
  potonganMaks: number | null;
  minTransaksi: number | null;
  /** Kosong = berlaku untuk semua durasi yang ditawarkan listing. */
  durasiBerlaku: DurasiKey[];
  /** Kosong = berlaku untuk semua tipe kamar. */
  tipeBerlaku: string[];
  lamaMin: number | null;
  berlakuMulai: string | null;
  berlakuSampai: string | null;
  kuotaTotal: number | null;
  aktif: boolean;
  rahasia: boolean;
}

export const KOSONG_VOUCHER: InputVoucher = {
  kode: "",
  nama: "",
  deskripsi: null,
  jenis: "NOMINAL",
  nilai: 0,
  potonganMaks: null,
  minTransaksi: null,
  durasiBerlaku: [],
  tipeBerlaku: [],
  lamaMin: null,
  berlakuMulai: null,
  berlakuSampai: null,
  kuotaTotal: null,
  aktif: true,
  rahasia: false,
};

/** Voucher tersimpan → bentuk yang bisa disunting form. */
export function keInputVoucher(v: Voucher): InputVoucher {
  return {
    kode: v.kode,
    nama: v.nama,
    deskripsi: v.deskripsi || null,
    jenis: v.jenis,
    nilai: v.nilai,
    potonganMaks: v.potonganMaks,
    minTransaksi: v.minTransaksi,
    durasiBerlaku: v.durasiBerlaku ?? [],
    tipeBerlaku: v.tipeBerlaku ?? [],
    lamaMin: v.lamaMin,
    berlakuMulai: v.berlakuMulai,
    berlakuSampai: v.berlakuSampai,
    kuotaTotal: v.kuotaTotal,
    aktif: v.aktif,
    rahasia: v.rahasia,
  };
}

/**
 * Huruf & angka saja, 4–20 karakter.
 *
 * Tanpa spasi dan tanda baca bukan demi kerapian: kodenya diketik ulang oleh
 * penyewa dari tangkapan layar atau pesan WhatsApp, dan "HEMAT 10%" menciptakan
 * tiga cara mengetik satu voucher yang sama — dua di antaranya akan gagal.
 */
export const KODE_VOUCHER_RE = /^[A-Z0-9]{4,20}$/;

/**
 * Nama voucher → usulan kode. Dipakai form supaya pemilik tidak perlu
 * mengarang kode sendiri — pekerjaan yang tidak dia pedulikan tapi menahan
 * penyimpanan sampai formatnya benar.
 *
 * Kalau hasilnya terlalu pendek (nama berisi angka/simbol saja), sisanya
 * diisi "PROMO" — mengembalikan string kosong berarti membiarkan pemilik
 * menatap isian yang tetap kosong tanpa tahu kenapa.
 */
export function usulKode(nama: string): string {
  const bersih = nama
    .toUpperCase()
    // Aksen dipisah lalu dibuang lewat rentang gabungan Unicode-nya, bukan
    // ditulis sebagai karakter mati di dalam kelas regex: sumber ini pernah
    // melewati beberapa alat dan karakter gabungan telanjang tidak selamat
    // dari semuanya.
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");
  if (bersih.length >= 4) return bersih.slice(0, 20);
  return (bersih + "PROMO").slice(0, 20);
}

/**
 * Membersihkan input SEBELUM divalidasi & disimpan.
 *
 * `potonganMaks` sengaja dinolkan untuk voucher NOMINAL: batas atas pada
 * potongan yang nilainya sudah tetap tidak punya arti, dan membiarkannya
 * tersimpan berarti suatu hari ada yang membacanya sebagai syarat sungguhan.
 */
export function normalisasiInput(v: InputVoucher): InputVoucher {
  const kode = v.kode.trim().toUpperCase().replace(/\s+/g, "");
  const nama = v.nama.trim();
  const deskripsi = v.deskripsi?.trim() || null;

  return {
    ...v,
    kode,
    nama,
    deskripsi,
    potonganMaks: v.jenis === "PERSEN" ? v.potonganMaks : null,
    minTransaksi: v.minTransaksi && v.minTransaksi > 0 ? v.minTransaksi : null,
    lamaMin: v.lamaMin && v.lamaMin > 1 ? v.lamaMin : null,
    berlakuMulai: v.berlakuMulai || null,
    berlakuSampai: v.berlakuSampai || null,
    kuotaTotal: v.kuotaTotal && v.kuotaTotal > 0 ? Math.round(v.kuotaTotal) : null,
    // Duplikat & urutan acak dibereskan di sini supaya dua voucher dengan
    // syarat yang sama tidak tersimpan dalam dua bentuk yang berbeda.
    durasiBerlaku: DURASI_URUT.filter((d) => v.durasiBerlaku.includes(d)),
    // Id tipe dibakukan sebagai string angka, dibuang duplikatnya, lalu
    // diurutkan secara NUMERIK. Urutan leksikografis akan menaruh "10"
    // sebelum "9", dan dua voucher dengan syarat yang sama persis tersimpan
    // dalam dua urutan berbeda — cukup untuk membuat pembandingan apa pun di
    // kemudian hari salah tanpa terlihat.
    tipeBerlaku: [...new Set(v.tipeBerlaku.map((t) => String(t).trim()))]
      .filter((t) => /^\d+$/.test(t))
      .sort((a, b) => Number(a) - Number(b)),
  };
}

/**
 * Pesan galat pertama, atau null bila sah. Sudah dalam bahasa yang siap tampil.
 *
 * @param kuotaTerpakai Pemakaian yang SUDAH tercatat, kalau ini penyuntingan.
 *   Dipakai menolak kuota baru yang lebih kecil daripada yang telanjur
 *   dipakai — angka yang, kalau diterima, akan membuat "12 / 10 terpakai"
 *   muncul di panel pemilik dan tidak ada cara menjelaskannya.
 */
export function validasiVoucher(
  mentah: InputVoucher,
  kuotaTerpakai = 0,
): string | null {
  const v = normalisasiInput(mentah);

  if (!KODE_VOUCHER_RE.test(v.kode)) {
    return "Kode hanya boleh huruf & angka, 4–20 karakter (mis. HEMAT10)";
  }
  if (v.nama.length < 3) return "Nama voucher minimal 3 karakter";
  if (v.nama.length > 120) return "Nama voucher maksimal 120 karakter";
  if ((v.deskripsi?.length ?? 0) > 300) return "Deskripsi maksimal 300 karakter";

  if (!Number.isFinite(v.nilai) || v.nilai <= 0) {
    return "Besar potongan harus lebih dari 0";
  }
  if (v.jenis === "PERSEN" && v.nilai > 100) {
    return "Potongan persen tidak boleh lebih dari 100%";
  }
  if (v.jenis === "PERSEN" && v.potonganMaks != null && v.potonganMaks <= 0) {
    return "Batas maksimal potongan harus lebih dari 0";
  }
  if (v.minTransaksi != null && v.minTransaksi < 0) {
    return "Minimal transaksi tidak boleh negatif";
  }
  if (v.lamaMin != null && (!Number.isInteger(v.lamaMin) || v.lamaMin < 1)) {
    return "Minimal lama sewa harus bilangan bulat ≥ 1";
  }
  if (v.durasiBerlaku.some((d) => !isDurasiKey(d))) {
    return "Ada durasi yang tidak dikenali";
  }
  // `normalisasiInput` sudah membuang id yang bukan angka, jadi sisa yang tidak
  // sah hanya bisa datang dari body permintaan yang tidak lewat form. Tetap
  // diperiksa: rute API memanggil validator ini sebagai penjaga terakhir.
  if (v.tipeBerlaku.some((t) => !/^\d+$/.test(t))) {
    return "Ada tipe kamar yang tidak dikenali";
  }

  // Potongan nominal yang lebih besar daripada syarat transaksinya tidak bisa
  // pernah cair sepenuhnya — dan pemiliknya tidak punya cara melihat itu.
  if (
    v.jenis === "NOMINAL" &&
    v.minTransaksi != null &&
    v.nilai > v.minTransaksi
  ) {
    return `Potongan ${formatRupiah(v.nilai)} lebih besar daripada minimal transaksi ${formatRupiah(v.minTransaksi)} — turunkan potongannya atau naikkan minimal transaksinya`;
  }

  const hariIni = kunciTanggal(new Date());

  for (const [kunci, label] of [
    [v.berlakuMulai, "mulai"],
    [v.berlakuSampai, "berakhir"],
  ] as const) {
    if (kunci && !/^\d{4}-\d{2}-\d{2}$/.test(kunci)) {
      return `Tanggal ${label} tidak valid`;
    }
  }

  // Voucher yang lahir sudah kedaluwarsa tidak pernah terlihat siapa pun,
  // dan pemiliknya akan menyangka fiturnya rusak.
  //
  // Pesannya menyebutkan JALAN KELUARNYA, bukan hanya sebabnya. Aturan ini
  // paling sering ditemui bukan saat membuat voucher baru, melainkan saat
  // menyunting voucher lama yang sudah kedaluwarsa — dan di situ "tanggal
  // berakhir sudah lewat" terasa seperti jalan buntu, padahal pemilik hanya
  // perlu tahu bahwa mengosongkannya pun boleh.
  if (v.berlakuSampai && v.berlakuSampai < hariIni) {
    return "Tanggal berakhir sudah lewat — beri tanggal baru, atau kosongkan supaya voucher ini berjalan tanpa batas waktu";
  }
  // Tanggal MULAI di masa lalu sengaja DIBIARKAN: artinya "sudah berjalan",
  // yang sama sekali tidak merugikan — sedangkan menolaknya akan membuat
  // penyuntingan voucher lama gagal hanya karena tanggal mulainya kemarin.
  if (v.berlakuMulai && v.berlakuSampai && v.berlakuMulai > v.berlakuSampai) {
    return "Tanggal mulai tidak boleh setelah tanggal berakhir";
  }

  if (v.kuotaTotal != null) {
    if (!Number.isInteger(v.kuotaTotal) || v.kuotaTotal < 1) {
      return "Kuota harus bilangan bulat minimal 1";
    }
    if (v.kuotaTotal > 100_000) {
      return "Kuota maksimal 100.000 — kosongkan saja kalau memang tanpa batas";
    }
    if (v.kuotaTotal < kuotaTerpakai) {
      return `Voucher ini sudah dipakai ${kuotaTerpakai} kali, jadi kuotanya tidak bisa diturunkan ke ${v.kuotaTotal}`;
    }
  }

  return null;
}

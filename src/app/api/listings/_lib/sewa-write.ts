/**
 * Perakit data tulis untuk listing SEWA — dipakai bersama oleh POST
 * /api/listings (create) dan PUT /api/listings/[id] (update) supaya keduanya
 * mustahil menyimpan aturan yang berbeda. Sebelumnya kedua route menyusun
 * objek sewaDetail-nya sendiri dan sudah mulai menyimpang satu sama lain.
 *
 * Aturan intinya: kalau listing kos punya tipe kamar, kolom-kolom di
 * listing_sewa_detail yang berbicara soal "kamar" (harga per durasi, total &
 * sisa kamar, luas, kamar mandi, kapasitas) TIDAK diambil dari kiriman klien —
 * semuanya dihitung ulang dari daftar tipe. Itu yang menjaga angka di card
 * listing selalu sama dengan yang diisi agent per tipe.
 */

import {
  agregatSewaDariTipe,
  fasilitasKamarSeragam,
  kamarMandiSeragam,
  type KamarTipe,
} from '@/lib/kosRoomTypes';
import {
  dariFieldHarga,
  durasiSewaSah,
  kapabilitasSewa,
  keFieldHarga,
  normalisasiHargaSewa,
  type DurasiSewaKey,
  type HasilNormalisasi,
} from '@/lib/sewaKapabilitas';

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

const PERIODE_BIAYA = ['SEKALI', 'BULANAN', 'TAHUNAN'] as const;
type PeriodeBiaya = (typeof PERIODE_BIAYA)[number];

/**
 * Bersihkan daftar biaya tambahan dari kiriman klien.
 *
 * Baris tanpa NAMA dibuang (baris kosong adalah keadaan normal saat agent
 * menekan "tambah" lalu berpindah pikiran), tapi baris tanpa NOMINAL tetap
 * disimpan — "listrik: sesuai pemakaian" adalah jawaban yang sah dan justru
 * informasi yang dicari penyewa. Periode yang tidak dikenal jatuh ke BULANAN,
 * bukan ditolak: mayoritas biaya kos memang bulanan.
 */
function bersihkanBiayaTambahan(raw: unknown): {
  nama: string;
  nominal: number | null;
  periode: PeriodeBiaya;
}[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((b): b is Record<string, unknown> => !!b && typeof b === 'object')
    .map((b) => ({
      nama: teks(b.nama, 60) ?? '',
      nominal: num(b.nominal),
      periode: (PERIODE_BIAYA as readonly string[]).includes(
        String(b.periode),
      )
        ? (b.periode as PeriodeBiaya)
        : ('BULANAN' as const),
    }))
    .filter((b) => b.nama.length > 0)
    .slice(0, 8);
}

/**
 * Harga per durasi & durasi utama yang SAH untuk kategori ini — satu-satunya
 * tempat kedua angka itu diputuskan di jalur tulis.
 *
 * Dipanggil dua kali per request (sekali oleh route untuk mengisi
 * `Listing.harga`, sekali oleh `buildSewaDetailData` untuk mengisi
 * listing_sewa_detail) dan itu memang disengaja: fungsinya murni dengan
 * masukan yang sama, jadi kedua pemanggil mustahil mendapat jawaban berbeda.
 * Alternatifnya — menyalurkan hasilnya lewat parameter — justru membuka celah
 * satu route lupa meneruskannya dan diam-diam memakai angka mentah lagi.
 *
 * Kenapa harga listing tidak boleh diambil begitu saja dari `body.harga`:
 * kalau agent (atau draft lama) mengirim durasi utama HARIAN untuk sebuah
 * gudang, harga hariannya dibuang di sini — dan `Listing.harga`, kolom yang
 * menyetir sortir & filter seluruh situs lewat `harga_efektif`, akan menunjuk
 * angka yang sumbernya sudah tidak ada. Karena itu keduanya lahir bersamaan.
 */
export function normalisasiSewaTulis(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any,
  kategori: string,
  kamarTipe: KamarTipe[],
): HasilNormalisasi {
  const pakaiTipe = kamarTipe.length > 0;

  // Pakai tipe kamar: harga level listing adalah harga TERMURAH antar tipe
  // ("mulai dari"), bukan angka kiriman klien. Agregatnya tetap disaring —
  // aturan kategori berlaku sama, dari mana pun angkanya berasal.
  const sumber = pakaiTipe
    ? dariFieldHarga(agregatSewaDariTipe(kamarTipe))
    : dariFieldHarga(body);

  return normalisasiHargaSewa(kategori, {
    harga: sumber,
    durasiUtama: body.durasi_sewa ?? null,
  });
}

/**
 * Data untuk listing_sewa_detail (dipakai baik create maupun update).
 *
 * Return-nya `any` karena field enum (durasi_sewa, kos_gender, dst) datang
 * sebagai string dari JSON body — Prisma yang memvalidasi nilainya.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildSewaDetailData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any,
  kategori: string,
  kamarTipe: KamarTipe[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const kapabilitas = kapabilitasSewa(kategori);
  const isKos = kategori === 'KOS';
  const punyaIdentitasUnit = kapabilitas.identitasUnit;
  const berbasisKamar = kapabilitas.inventaris === 'KAMAR';
  const pakaiTipe = kamarTipe.length > 0;
  const agregat = pakaiTipe ? agregatSewaDariTipe(kamarTipe) : null;

  // Harga & durasi utama yang sudah lolos aturan kategori — lihat catatan
  // panjang di normalisasiSewaTulis.
  const sewa = normalisasiSewaTulis(body, kategori, kamarTipe);

  // Jam check-in/out cuma bermakna kalau unitnya benar-benar ditawarkan per
  // hari atau per minggu (pola Booking/Agoda). Pada sewa bulanan/tahunan ia
  // bukan sekadar tidak berguna — ia menyesatkan, karena membuat halaman detail
  // terlihat seperti menawarkan menginap semalam.
  const ditawarkanJangkaPendek: DurasiSewaKey[] = ['HARIAN', 'MINGGUAN'];
  const punyaJangkaPendek = ditawarkanJangkaPendek.some(
    (d) => sewa.harga[d] !== null,
  );

  return {
    // Identitas unit hanya milik APARTEMEN. Dipaksa null untuk kategori lain
    // supaya listing yang pindah kategori (mis. Apartemen → Rumah) tidak
    // meninggalkan "Unit 12A" yang ikut tampil di halaman detail.
    nama_gedung: punyaIdentitasUnit ? teks(body.nama_gedung, 150) : null,
    lantai_unit: punyaIdentitasUnit ? teks(body.lantai_unit, 20) : null,
    nomor_unit: punyaIdentitasUnit ? teks(body.nomor_unit, 30) : null,
    tipe_unit: punyaIdentitasUnit ? body.tipe_unit || null : null,

    // Daftar kosong disimpan sebagai null, bukan `[]` — halaman detail cukup
    // memeriksa satu keadaan ("tidak ada biaya tambahan") daripada dua.
    biaya_tambahan: (() => {
      const bersih = bersihkanBiayaTambahan(body.biaya_tambahan);
      return bersih.length > 0 ? bersih : null;
    })(),

    jam_check_in: punyaJangkaPendek ? teks(body.jam_check_in, 10) : null,
    jam_check_out: punyaJangkaPendek ? teks(body.jam_check_out, 10) : null,

    durasi_sewa: sewa.durasiUtama,

    // Harga per durasi, sudah disaring terhadap kategori. Saat pakai tipe
    // kamar, angkanya adalah harga TERMURAH antar tipe ("mulai dari").
    ...keFieldHarga(sewa.harga),

    // Syarat booking — tidak terpengaruh tipe kamar. Satuannya ikut aturan
    // kategori: "minimal 2 minggu" pada gudang adalah syarat yang tidak bisa
    // dipenuhi oleh satu pun harga yang boleh ditawarkan gudang.
    minimal_sewa_jumlah: durasiSewaSah(kategori, body.minimal_sewa_satuan)
      ? num(body.minimal_sewa_jumlah)
      : null,
    minimal_sewa_satuan: durasiSewaSah(kategori, body.minimal_sewa_satuan)
      ? body.minimal_sewa_satuan
      : null,
    deposit: num(body.deposit),

    // Spesifikasi kamar: hidup di tiap tipe kalau pakai tipe kamar. Khusus
    // kamar mandi, nilainya tetap diisi kalau SEMUA tipe seragam — chip
    // "KM Dalam" di card masih benar & informatif dalam kasus itu.
    luas_kamar: pakaiTipe ? null : num(body.luas_kamar),
    kamar_mandi_tipe: pakaiTipe
      ? kamarMandiSeragam(kamarTipe)
      : body.kamar_mandi_tipe || null,
    kapasitas_penghuni: pakaiTipe ? null : num(body.kapasitas_penghuni),

    termasuk_listrik: body.termasuk_listrik ?? null,
    termasuk_air: body.termasuk_air ?? null,
    akses_24_jam: body.akses_24_jam ?? null,
    jam_malam: body.jam_malam || null,

    // Pakai tipe kamar: fasilitas kamar diisi per tipe, dan nilai di level
    // listing adalah IRISAN antar tipe — card tidak boleh menjanjikan AC kalau
    // hanya sebagian tipe yang punya.
    fasilitas_kamar: pakaiTipe
      ? fasilitasKamarSeragam(kamarTipe)
      : body.fasilitas_kamar || null,
    fasilitas_bersama: body.fasilitas_bersama || null,
    peraturan: body.peraturan || null,
    kos_gender: isKos ? body.kos_gender || null : null,

    // Hanya inventaris berbasis KAMAR yang punya konsep "sisa kamar" — unit
    // apartemen/rumah/gudang disewakan utuh, jadi kolomnya dibiarkan null.
    total_kamar: agregat
      ? agregat.total_kamar
      : berbasisKamar
      ? num(body.total_kamar)
      : null,
    kamar_tersedia: agregat
      ? agregat.kamar_tersedia
      : berbasisKamar
      ? num(body.kamar_tersedia)
      : null,
  };
}

/** Satu baris listing_kamar_tipe. `urutan` = posisi yang disusun agent. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toKamarTipeRow(tipe: KamarTipe, index: number): any {
  return {
    nama: tipe.nama,
    urutan: index,
    jumlah_kamar: Number(tipe.jumlah_kamar ?? 1),
    kamar_tersedia: Number(tipe.kamar_tersedia ?? 0),
    luas_kamar: num(tipe.luas_kamar),
    kamar_mandi_tipe: tipe.kamar_mandi_tipe || null,
    kapasitas_penghuni: num(tipe.kapasitas_penghuni),
    lantai_kamar: teks(tipe.lantai_kamar, 20),
    nomor_kamar: teks(tipe.nomor_kamar, 60),
    harga_sewa_harian: num(tipe.harga_sewa_harian),
    harga_sewa_mingguan: num(tipe.harga_sewa_mingguan),
    harga_sewa_bulanan: num(tipe.harga_sewa_bulanan),
    harga_sewa_tahunan: num(tipe.harga_sewa_tahunan),
    fasilitas_kamar: tipe.fasilitas_kamar || null,
    // Sudah lewat bersihkanUrlGambar() di bersihkanTipeKamar — nilainya pasti
    // URL http(s)/path absolut atau null, tidak pernah blob:/data: kiriman klien.
    gambar: tipe.gambar || null,
    catatan: tipe.catatan || null,
  };
}

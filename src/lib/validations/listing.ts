import { z } from 'zod';
import { MAKS_TIPE_KAMAR, punyaHarga } from '@/lib/kosRoomTypes';
import { MAKS_BIAYA_TAMBAHAN } from '@/app/tambah-property/types/listing';
import {
  DURASI_URUT_SEWA,
  FIELD_HARGA_DURASI,
  LABEL_DURASI,
  durasiSewaSah,
  kalimatDurasiDiizinkan,
  pesanDurasiTidakSah,
} from '@/lib/sewaKapabilitas';

/**
 * Kategori yang tidak punya lahan sendiri: yang disewa/dijual adalah satu unit
 * di dalam gedung milik bersama. Menanyakan luas tanah untuk keduanya hanya
 * memancing angka karangan — luas tanah gedung apartemen bukan milik penghuni
 * satu unit, dan kamar kos bukan sebidang tanah.
 */
const KATEGORI_TANPA_LAHAN = ['APARTEMEN', 'KOS'] as const;

// ✅ Helper untuk handle Decimal/Number dari Prisma atau form input
const decimalSchema = z
  .union([
    z.number(),
    z.string().transform((val) => {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? undefined : parsed;
    }),
  ])
  .optional()
  .nullable();

// ✅ Helper untuk tanggal (support Date object dan ISO string)
const dateSchema = z
  .union([
    z.date(),
    z.string().transform((val) => new Date(val)),
  ])
  .optional()
  .nullable();

/**
 * Satu tipe kamar kos (mis. "Kamar Mandi Dalam" — 2 kamar, 4x4, Rp 1,2 jt).
 *
 * Cross-field yang masih di dalam satu baris divalidasi di sini (bukan di
 * superRefine listing) supaya pesan errornya menempel ke baris & field yang
 * benar, bukan ke seluruh daftar.
 */
const kamarTipeSchema = z
  .object({
    nama: z
      .string()
      .trim()
      .min(2, 'Nama tipe minimal 2 karakter')
      .max(80, 'Nama tipe maksimal 80 karakter'),

    jumlah_kamar: z
      .number({ error: 'Jumlah kamar wajib diisi' })
      .int()
      .min(1, 'Minimal 1 kamar')
      .max(200, 'Maksimal 200 kamar per tipe'),

    // 0 valid: tipe ini ada tapi sedang penuh.
    kamar_tersedia: z
      .number({ error: 'Kamar tersedia wajib diisi' })
      .int()
      .min(0, 'Tidak boleh negatif'),

    luas_kamar: decimalSchema,
    kamar_mandi_tipe: z.enum(['DALAM', 'LUAR']).optional().nullable(),
    kapasitas_penghuni: z.number().int().min(1).max(10).optional().nullable(),

    // Letak kamar di gedung — teks bebas karena penomoran kos tidak seragam
    // ("A1, A2", "Lt. 2 & 3"); gunanya menunjuk kamar saat survei.
    lantai_kamar: z.string().max(20, 'Maksimal 20 karakter').optional().nullable(),
    nomor_kamar: z.string().max(60, 'Maksimal 60 karakter').optional().nullable(),

    harga_sewa_harian: decimalSchema,
    harga_sewa_mingguan: decimalSchema,
    harga_sewa_bulanan: decimalSchema,
    harga_sewa_tahunan: decimalSchema,

    fasilitas_kamar: z.string().optional().nullable(),

    /**
     * Foto kamar tipe ini — WAJIB.
     *
     * Bukan sekadar pelengkap: begitu satu kos punya beberapa tipe, seluruh
     * gunanya tipe adalah membuat calon penghuni bisa MEMBEDAKAN kamar mana
     * yang ia bayar. Tipe tanpa foto mengembalikan persoalan yang justru mau
     * diselesaikan — penghuni datang survei untuk mencari tahu hal yang
     * seharusnya sudah terjawab di layar.
     *
     * Isinya URL hasil unggah, bukan File: foto diunggah seketika saat dipilih
     * karena isi form ikut ditulis ke localStorage sebagai draft — objek File
     * tidak bisa di-serialize, dan blob URL mati begitu tab ditutup.
     */
    gambar: z
      .string({ error: 'Foto kamar wajib diunggah' })
      .trim()
      .min(1, 'Foto kamar wajib diunggah')
      .max(500, 'URL foto terlalu panjang'),

    catatan: z.string().max(255, 'Catatan maksimal 255 karakter').optional().nullable(),
  })
  .superRefine((tipe, ctx) => {
    // Tipe tanpa harga tidak bisa disewakan — dan kalau lolos, harga "mulai
    // dari" di card jadi salah karena tipe itu tidak ikut dihitung.
    if (!punyaHarga(tipe)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Tipe ini belum punya harga sewa',
        path: [],
      });
    }

    if (
      tipe.jumlah_kamar != null &&
      tipe.kamar_tersedia != null &&
      tipe.kamar_tersedia > tipe.jumlah_kamar
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Maksimal ${tipe.jumlah_kamar} (jumlah kamar tipe ini)`,
        path: ['kamar_tersedia'],
      });
    }
  });

export const listingSchema = z
  .object({
    // ========== Basic Info ==========
    judul: z
      .string()
      .min(10, 'Judul minimal 10 karakter')
      .max(255, 'Judul maksimal 255 karakter'),

    slug: z.string().optional(),

    jenis_transaksi: z.enum(['PRIMARY', 'SECONDARY', 'LELANG', 'SEWA'], {
      error: 'Pilih jenis transaksi',
    }),

    kategori: z.enum(
      [
        'RUMAH',
        'APARTEMEN',
        'RUKO',
        'TANAH',
        'GUDANG',
        'HOTEL_DAN_VILLA',
        'TOKO',
        'PABRIK',
        'KOS',
      ],
      {
        error: 'Pilih kategori property',
      }
    ),

    // `tipe_property` dihapus: tidak punya kolom di tabel `listing` maupun
    // detailnya, dan tidak ada input pengisinya — satu-satunya pemakai adalah
    // label deskripsi di Step 5, yang sekarang diturunkan dari `kategori`.
    // "Tipe kos" (putra/putri/campur) adalah hal LAIN dan sudah punya
    // rumahnya sendiri: `kos_gender` di listing_sewa_detail.

    vendor: z.string().optional().nullable(),

    status_tayang: z
      .enum(['TERSEDIA', 'TERJUAL', 'TARIK_LISTING'])
      .default('TERSEDIA'),

    // ========== Pricing (Conditional) ==========
    // ✅ Harga OPTIONAL - akan divalidasi conditional di superRefine
    harga: z
      .union([
        z.number().positive('Harga harus lebih dari 0'),
        z.string().transform((val) => {
          const parsed = parseFloat(val.replace(/\D/g, ''));
          return isNaN(parsed) ? undefined : parsed;
        }),
      ])
      .optional()
      .nullable(),

    harga_promo: z
      .union([
        z.number().positive('Harga promo harus lebih dari 0'),
        z.string().transform((val) => {
          const parsed = parseFloat(val.replace(/\D/g, ''));
          return isNaN(parsed) ? undefined : parsed;
        }),
      ])
      .optional()
      .nullable(),

    // ========== Lelang Specific (Conditional) ==========
    tanggal_lelang: dateSchema,
    uang_jaminan: decimalSchema,
    nilai_limit_lelang: decimalSchema,

    // ========== Sewa Specific (Conditional) ==========
    // durasi_sewa = durasi mana yang jadi "harga utama" (ditampilkan di card).
    // harga_sewa_* = harga per-durasi individual; kos di Indonesia lazim
    // menawarkan >1 durasi sekaligus (mis. hanya mingguan & tahunan saja).
    durasi_sewa: z
      .enum(['HARIAN', 'MINGGUAN', 'BULANAN', 'TAHUNAN'])
      .optional()
      .nullable(),
    harga_sewa_harian: decimalSchema,
    harga_sewa_mingguan: decimalSchema,
    harga_sewa_bulanan: decimalSchema,
    harga_sewa_tahunan: decimalSchema,
    fasilitas_kamar: z.string().optional().nullable(),
    fasilitas_bersama: z.string().optional().nullable(),
    peraturan: z.string().optional().nullable(),
    kos_gender: z.enum(['PUTRA', 'PUTRI', 'CAMPUR']).optional().nullable(),
    kapasitas_penghuni: z.number().int().min(1).optional().nullable(),

    // Ketersediaan kamar kos — dipakai pill "Sisa N kamar" di card listing.
    // 0 valid (penuh); relasi kamar_tersedia <= total_kamar dicek di superRefine.
    // Saat listing pakai tipe kamar, dua angka ini jadi TURUNAN (Σ per tipe)
    // dan tidak lagi diisi manual.
    total_kamar: z.number().int().min(1).optional().nullable(),
    kamar_tersedia: z.number().int().min(0).optional().nullable(),

    // Tipe kamar — daftar kosong berarti "semua kamar sama" (mode sederhana).
    // Daftar yang terisi adalah satu-satunya sumber luas/harga/jenis kamar
    // mandi per kamar; kolom tunggal di atas tidak dipakai lagi.
    kamar_tipe: z.array(kamarTipeSchema).max(MAKS_TIPE_KAMAR).optional().nullable(),

    // Minimal sewa & deposit — syarat booking, semua opsional
    minimal_sewa_jumlah: z.number().int().min(1).optional().nullable(),
    minimal_sewa_satuan: z
      .enum(['HARIAN', 'MINGGUAN', 'BULANAN', 'TAHUNAN'])
      .optional()
      .nullable(),
    deposit: decimalSchema,

    // Biaya di luar harga sewa & deposit (listrik, air, wifi, IPL…). Baris
    // tanpa nama dibuang saat submit, jadi nama tidak divalidasi wajib di sini
    // — baris kosong adalah keadaan normal saat agent baru menekan "tambah".
    biaya_tambahan: z
      .array(
        z.object({
          nama: z.string().max(60, 'Nama biaya maksimal 60 karakter'),
          nominal: decimalSchema,
          periode: z.enum(['SEKALI', 'BULANAN', 'TAHUNAN']),
        }),
      )
      .max(MAKS_BIAYA_TAMBAHAN, `Maksimal ${MAKS_BIAYA_TAMBAHAN} biaya tambahan`)
      .optional()
      .nullable(),

    // ========== Identitas unit apartemen ==========
    // Satu unit apartemen hanya bisa disebut dengan benar lewat gedung +
    // lantai + nomornya. String semua: "GF", "12A", "3 Mezzanine" bukan angka.
    nama_gedung: z.string().max(150, 'Maksimal 150 karakter').optional().nullable(),
    lantai_unit: z.string().max(20, 'Maksimal 20 karakter').optional().nullable(),
    nomor_unit: z.string().max(30, 'Maksimal 30 karakter').optional().nullable(),
    tipe_unit: z
      .enum(['STUDIO', 'SATU_KAMAR', 'DUA_KAMAR', 'TIGA_KAMAR', 'EMPAT_KAMAR_PLUS'])
      .optional()
      .nullable(),

    // Jam check-in/out — hanya relevan kalau unit ditawarkan harian/mingguan.
    jam_check_in: z.string().optional().nullable(),
    jam_check_out: z.string().optional().nullable(),

    // Unit/kamar — relevan Kos & Apartemen sewa
    luas_kamar: decimalSchema,
    kamar_mandi_tipe: z.enum(['DALAM', 'LUAR']).optional().nullable(),
    termasuk_listrik: z.boolean().optional().nullable(),
    termasuk_air: z.boolean().optional().nullable(),
    akses_24_jam: z.boolean().optional().nullable(),
    jam_malam: z.string().optional().nullable(),

    link: z
      .string()
      .url('Format URL tidak valid')
      .optional()
      .or(z.literal(''))
      .nullable(),

    // ========== Location ==========
    alamat_lengkap: z.string().optional().nullable(),
    provinsi: z.string().optional().nullable(),
    kota: z.string().min(1, 'Kota wajib diisi'),
    kecamatan: z.string().optional().nullable(),
    kelurahan: z.string().optional().nullable(),
    latitude: decimalSchema,
    longitude: decimalSchema,

    // Patokan/akses terdekat — semua opsional; baris tanpa nama dibuang saat submit
    akses_terdekat: z
      .array(
        z.object({
          tipe: z.enum([
            'KAMPUS',
            'SEKOLAH',
            'STASIUN',
            'HALTE',
            'BANDARA',
            'MALL',
            'PASAR',
            'RUMAH_SAKIT',
            'PERKANTORAN',
            'MASJID',
            'MINIMARKET',
            'LAINNYA',
          ]),
          nama: z.string(),
          jarak: z.number().positive().optional().nullable(),
          satuan: z.enum(['MENIT', 'KM']).optional().nullable(),
        }),
      )
      .optional()
      .nullable(),

    // ========== Specifications ==========
    luas_tanah: decimalSchema,
    luas_bangunan: decimalSchema,
    jumlah_lantai: z.number().int().min(1).default(1),
    kamar_tidur: z.number().int().min(0).optional().nullable(),
    kamar_mandi: z.number().int().min(0).optional().nullable(),
    daya_listrik: z.number().int().min(0).optional().nullable(),
    sumber_air: z.string().optional().nullable(),
    hadap_bangunan: z.string().optional().nullable(),
    kondisi_interior: z.string().optional().nullable(),

    // ========== Legal ==========
    legalitas: z
      .enum([
        'SHM',
        'HGB',
        'HGU',
        'HP',
        'STRATA_TITLE',
        'PPJB',
        'AJB',
        'LAINNYA',
      ])
      .optional()
      .nullable(),
    nomor_legalitas: z.string().optional().nullable(),

    // ========== Media & Description ==========
    deskripsi: z.string().optional().nullable(),
    gambar: z.string().optional().nullable(),
    lampiran: z.string().optional().nullable(),

    // ========== Features ==========
    is_hot_deal: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    const isLelang = data.jenis_transaksi === 'LELANG';
    const isSewa = data.jenis_transaksi === 'SEWA';
    const isKos = data.kategori === 'KOS';
    const isApartemen = data.kategori === 'APARTEMEN';
    const tanpaLahan = (KATEGORI_TANPA_LAHAN as readonly string[]).includes(
      data.kategori,
    );
    // Mode multi-tipe kamar: harga & spesifikasi kamar diatur per tipe, jadi
    // beberapa aturan level-listing di bawah tidak lagi berlaku.
    const adaTipe = isKos && Array.isArray(data.kamar_tipe) && data.kamar_tipe.length > 0;

    // ✅ Validasi untuk LELANG
    if (isLelang) {
      // Nilai limit lelang wajib
      if (!data.nilai_limit_lelang || data.nilai_limit_lelang <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Nilai limit lelang wajib diisi untuk tipe LELANG',
          path: ['nilai_limit_lelang'],
        });
      }

      // Uang jaminan wajib
      if (!data.uang_jaminan || data.uang_jaminan <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Uang jaminan wajib diisi untuk tipe LELANG',
          path: ['uang_jaminan'],
        });
      }

      // Tanggal lelang wajib
      if (!data.tanggal_lelang) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Tanggal lelang wajib diisi untuk tipe LELANG',
          path: ['tanggal_lelang'],
        });
      }
    }

    // ✅ Validasi untuk NON-LELANG (PRIMARY, SECONDARY, SEWA)
    if (!isLelang) {
      if (!data.harga || data.harga <= 0) {
        // Saat pakai tipe kamar TIDAK ADA kolom "harga" di form — angkanya
        // diturunkan dari harga termurah antar tipe. Pesan "Harga wajib diisi"
        // di situasi itu menyuruh agent mengisi kotak yang tidak pernah ada di
        // layar; yang sebenarnya kosong adalah harga di dalam tiap tipe. Jadi
        // yang berubah bukan aturannya, melainkan ke mana pesannya menunjuk.
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: adaTipe
            ? 'Belum ada satu pun harga sewa. Isi harga tiap tipe kamar di bagian “Harga per Tipe Kamar” di bawah.'
            : 'Harga wajib diisi',
          path: ['harga'],
        });
      }
    }

    // ✅ Validasi harga promo < harga normal (hanya untuk non-LELANG)
    if (
      !isLelang &&
      data.harga &&
      data.harga_promo &&
      data.harga_promo >= data.harga
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Harga promo harus lebih kecil dari harga normal',
        path: ['harga_promo'],
      });
    }

    // ✅ Validasi uang jaminan <= nilai limit (untuk LELANG)
    if (
      isLelang &&
      data.uang_jaminan &&
      data.nilai_limit_lelang &&
      data.uang_jaminan > data.nilai_limit_lelang
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Uang jaminan tidak boleh lebih besar dari nilai limit lelang',
        path: ['uang_jaminan'],
      });
    }

    // ✅ Validasi untuk SEWA
    if (isSewa) {
      /**
       * Durasi harus sah untuk KATEGORInya — gudang tidak disewakan harian.
       *
       * Form sudah tidak merender chip durasi yang terlarang, jadi aturan ini
       * tidak akan pernah menyala lewat pemakaian normal. Ia tetap wajib ada
       * karena ada satu jalur yang melewati layar itu: isi form disimpan
       * sebagai draft di localStorage, dan draft "Kos" yang dibuka lalu diubah
       * kategorinya jadi "Gudang" membawa serta harga harian & mingguan yang
       * sudah terlanjur diketik. Di sinilah bawaan itu dihentikan — plus, tentu,
       * kiriman yang tidak lewat form sama sekali.
       */
      const durasiTerlarang = DURASI_URUT_SEWA.filter(
        (d) =>
          !durasiSewaSah(data.kategori, d) &&
          Number(data[FIELD_HARGA_DURASI[d]] ?? 0) > 0,
      );

      if (durasiTerlarang.length > 0) {
        for (const d of durasiTerlarang) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${pesanDurasiTidakSah(data.kategori)} Hapus harga ${LABEL_DURASI[d]}-nya.`,
            path: [FIELD_HARGA_DURASI[d]],
          });
        }
      }

      if (data.durasi_sewa && !durasiSewaSah(data.kategori, data.durasi_sewa)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: pesanDurasiTidakSah(data.kategori),
          path: ['durasi_sewa'],
        });
      }

      // Minimal sewa memakai satuan yang sama dengan durasi harga. "Minimal 3
      // minggu" pada gudang yang cuma punya tarif bulanan/tahunan adalah syarat
      // yang tidak bisa dipenuhi lewat satu pun harga yang ditawarkan.
      if (
        data.minimal_sewa_satuan &&
        !durasiSewaSah(data.kategori, data.minimal_sewa_satuan)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: pesanDurasiTidakSah(data.kategori),
          path: ['minimal_sewa_satuan'],
        });
      }

      // Harga per tipe kamar ikut aturan yang sama. Hari ini hanya Kos yang
      // punya tipe kamar dan Kos boleh keempat durasi, jadi aturan ini tidak
      // pernah menyala — ditulis tetap supaya kategori bertipe kamar berikutnya
      // tidak lolos lewat pintu belakang.
      if (Array.isArray(data.kamar_tipe)) {
        data.kamar_tipe.forEach((tipe, i) => {
          for (const d of DURASI_URUT_SEWA) {
            if (durasiSewaSah(data.kategori, d)) continue;
            if (Number(tipe[FIELD_HARGA_DURASI[d]] ?? 0) <= 0) continue;
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: pesanDurasiTidakSah(data.kategori),
              path: ['kamar_tipe', i, FIELD_HARGA_DURASI[d]],
            });
          }
        });
      }

      const hargaPerDurasi = DURASI_URUT_SEWA.filter((d) =>
        durasiSewaSah(data.kategori, d),
      ).map((d) => data[FIELD_HARGA_DURASI[d]]);
      const adaDurasiTerisi = hargaPerDurasi.some((h) => h != null && Number(h) > 0);

      // Saat pakai tipe kamar, ketiadaan harga SUDAH dilaporkan sekali lewat
      // `harga` di atas dengan kalimat yang menunjuk tempat mengisinya.
      // Mengulanginya di sini membuat ringkasan error menampilkan tiga baris
      // untuk satu kesalahan yang sama — dan dua di antaranya menyebut field
      // yang tidak punya kolom, sehingga agent membaca daftar itu lalu tetap
      // tidak tahu harus menekan apa.
      if (!adaDurasiTerisi) {
        if (!adaTipe) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Isi minimal 1 harga sewa berdasarkan durasi (${kalimatDurasiDiizinkan(data.kategori)})`,
            path: ['durasi_sewa'],
          });
        }
      } else if (!data.durasi_sewa) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Pilih durasi mana yang jadi harga utama',
          path: ['durasi_sewa'],
        });
      }

      // Gender kos wajib khusus kategori Kos
      if (isKos && !data.kos_gender) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Gender kos wajib dipilih',
          path: ['kos_gender'],
        });
      }

      // Sisa kamar tidak boleh melebihi total kamar — angka yang mustahil
      // bikin pill "Sisa N kamar" di card jadi menyesatkan. Tidak berlaku saat
      // pakai tipe kamar: kedua angka itu turunan, bukan isian.
      if (
        isKos &&
        !adaTipe &&
        data.total_kamar != null &&
        data.kamar_tersedia != null &&
        data.kamar_tersedia > data.total_kamar
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Kamar tersedia tidak boleh lebih banyak dari total kamar',
          path: ['kamar_tersedia'],
        });
      }

      // Nama tipe yang sama dua kali bikin penghuni tidak bisa menyebut
      // "saya mau tipe X" tanpa ambiguitas — dan agent sendiri bingung kamar
      // mana yang sudah terisi.
      if (adaTipe) {
        const terlihat = new Set<string>();
        for (const t of data.kamar_tipe!) {
          const kunci = t.nama?.trim().toLowerCase();
          if (!kunci) continue;
          if (terlihat.has(kunci)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Nama tipe "${t.nama.trim()}" dipakai lebih dari sekali — beri nama yang berbeda`,
              path: ['kamar_tipe'],
            });
            break;
          }
          terlihat.add(kunci);
        }
      }
    }

    // ✅ Luas tanah wajib — kecuali dua hal:
    //    1. Kategori tanpa lahan sendiri (apartemen & kos): yang ditransaksikan
    //       satu unit di dalam gedung, jadi angkanya tidak ada wujudnya. Yang
    //       dipakai untuk keduanya adalah luas bangunan/unit.
    //    2. Transaksi SEWA: penyewa memutuskan berdasarkan luas yang ditempati,
    //       bukan luas kavling. Tetap boleh diisi, hanya tidak menahan submit.
    if (!tanpaLahan && !isSewa && (!data.luas_tanah || Number(data.luas_tanah) <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Luas tanah wajib diisi',
        path: ['luas_tanah'],
      });
    }

    // ✅ Luas bangunan wajib untuk apartemen — tanpa itu unitnya tidak punya
    //    ukuran sama sekali (luas tanah tidak berlaku), dan "51 m²" adalah hal
    //    pertama yang dibandingkan calon penyewa antar unit.
    if (isApartemen && (!data.luas_bangunan || Number(data.luas_bangunan) <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Luas unit wajib diisi untuk apartemen',
        path: ['luas_bangunan'],
      });
    }

    // ✅ Tipe unit wajib untuk sewa apartemen — Studio/1BR/2BR adalah cara
    //    penyewa apartemen menyebut kebutuhannya dan filter utama di halaman
    //    daftar; tanpa nilai ini unitnya tidak akan muncul saat difilter.
    if (isSewa && isApartemen && !data.tipe_unit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pilih tipe unit (Studio / 1BR / 2BR / …)',
        path: ['tipe_unit'],
      });
    }

    // ✅ Sertifikat wajib untuk transaksi JUAL & LELANG saja. Penyewa tidak
    //    membeli haknya atas tanah — Booking/Agoda/Travelio pun tidak pernah
    //    menanyakannya. Kos sudah dikecualikan lewat aturan SEWA ini.
    if (!isSewa && !isKos && !data.legalitas) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Jenis sertifikat wajib dipilih',
        path: ['legalitas'],
      });
    }

    // ✅ Kos hanya ada dalam transaksi SEWA: seluruh isian kos (tipe kamar,
    //    sisa kamar, gender, harga per durasi) disimpan di listing_sewa_detail,
    //    yang hanya dibuat untuk SEWA. Kombinasi lain akan tersimpan sebagai
    //    listing tanpa satupun detail kosnya.
    if (isKos && !isSewa) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Kategori Kos hanya untuk transaksi Sewa. Untuk menjual gedung kos, pilih kategori Rumah.',
        path: ['kategori'],
      });
    }
  });

export type ListingFormData = z.infer<typeof listingSchema>;

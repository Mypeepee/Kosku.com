import { z } from 'zod';

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

export const listingSchema = z
  .object({
    // ========== Basic Info ==========
    judul: z
      .string()
      .min(10, 'Judul minimal 10 karakter')
      .max(255, 'Judul maksimal 255 karakter'),

    slug: z.string().optional(),

    jenis_transaksi: z.enum(['PRIMARY', 'SECONDARY', 'LELANG', 'SEWA'], {
      required_error: 'Pilih jenis transaksi',
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
      ],
      {
        required_error: 'Pilih kategori properti',
      }
    ),

    tipe_property: z.string().optional().nullable(),

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
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Harga wajib diisi',
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
  });

export type ListingFormData = z.infer<typeof listingSchema>;

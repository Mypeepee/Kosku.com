import { z } from 'zod';

// ✅ Helper untuk handle Decimal from Prisma
const decimalSchema = z.union([
  z.number(),
  z.string().transform((val) => parseFloat(val)),
]).optional();

export const listingSchema = z.object({
  // Basic Info
  judul: z.string()
    .min(10, 'Judul minimal 10 karakter')
    .max(255, 'Judul maksimal 255 karakter'),
  
  slug: z.string().optional(),
  
  jenis_transaksi: z.enum(['PRIMARY', 'SECONDARY', 'LELANG', 'SEWA'], {
    required_error: 'Pilih jenis transaksi'
  }),
  
  kategori: z.enum([
    'RUMAH', 'APARTEMEN', 'RUKO', 'TANAH', 
    'GUDANG', 'HOTEL_DAN_VILLA', 'TOKO', 'PABRIK'
  ], {
    required_error: 'Pilih kategori properti'
  }),
  
  vendor: z.string().optional(),
  
  status_tayang: z.enum(['TERSEDIA', 'TERJUAL', 'TARIK_LISTING']).default('TERSEDIA'),
  
  // Pricing - ✅ Support both number and string (from API)
  harga: z.union([
    z.number().min(1, 'Harga harus lebih dari 0'),
    z.string().transform((val) => parseFloat(val))
  ]),
  
  harga_promo: z.union([
    z.number(),
    z.string().transform((val) => parseFloat(val)),
    z.null()
  ]).optional(),
  
  // Lelang specific
  tanggal_lelang: z.union([z.date(), z.string().transform((val) => new Date(val))]).optional(),
  uang_jaminan: decimalSchema,
  nilai_limit_lelang: decimalSchema,
  
  link: z.string().url('Format URL tidak valid').optional().or(z.literal('')),
  
  // Location
  alamat_lengkap: z.string().optional(),
  provinsi: z.string().optional(),
  kota: z.string().min(1, 'Kota wajib diisi'),
  kecamatan: z.string().optional(),
  kelurahan: z.string().optional(),
  latitude: decimalSchema,
  longitude: decimalSchema,
  
  // Specifications
  luas_tanah: decimalSchema,
  luas_bangunan: decimalSchema,
  jumlah_lantai: z.number().int().min(1).default(1),
  kamar_tidur: z.number().int().min(0).optional(),
  kamar_mandi: z.number().int().min(0).optional(),
  daya_listrik: z.number().int().min(0).optional(),
  sumber_air: z.string().optional(),
  hadap_bangunan: z.string().optional(),
  kondisi_interior: z.string().optional(),
  
  // Legal
  legalitas: z.enum([
    'SHM', 'HGB', 'HGU', 'HP', 
    'STRATA_TITLE', 'PPJB', 'AJB', 'LAINNYA'
  ]).optional(),
  nomor_legalitas: z.string().optional(),
  
  // Media & Description
  deskripsi: z.string().optional(),
  gambar: z.string().optional(),
  lampiran: z.string().optional(),
  
  // Features
  is_hot_deal: z.boolean().default(false),
}).superRefine((data, ctx) => {
  // Conditional validation for LELANG
  if (data.jenis_transaksi === 'LELANG') {
    if (!data.tanggal_lelang) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Tanggal lelang wajib diisi untuk tipe LELANG',
        path: ['tanggal_lelang']
      });
    }
    
    if (!data.uang_jaminan || data.uang_jaminan <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Uang jaminan wajib diisi untuk tipe LELANG',
        path: ['uang_jaminan']
      });
    }
    
    if (!data.nilai_limit_lelang || data.nilai_limit_lelang <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Nilai limit lelang wajib diisi untuk tipe LELANG',
        path: ['nilai_limit_lelang']
      });
    }
  }
  
  // Validate harga_promo < harga
  if (data.harga_promo && data.harga_promo >= data.harga) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Harga promo harus lebih kecil dari harga normal',
      path: ['harga_promo']
    });
  }
});

export type ListingFormData = z.infer<typeof listingSchema>;

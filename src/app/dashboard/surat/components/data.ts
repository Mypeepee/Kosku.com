import { FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SuratTemplateStatus = "Populer" | "Baru" | "Standar";

export type SuratFieldType =
  | "text"
  | "textarea"
  | "date"
  | "number"
  | "select"
  | "file";

export type SuratFieldSection =
  | "surat"
  | "kuasa"
  | "pemohon"
  | "debitur"
  | "asset"
  | "lelang"
  | "lampiran";

export type SuratFieldOption = {
  label: string;
  value: string;
};

export type SuratField = {
  key: string;
  label: string;
  type: SuratFieldType;
  section: SuratFieldSection;
  required?: boolean;
  placeholder?: string;
  readOnly?: boolean;
  hiddenInForm?: boolean;
  options?: SuratFieldOption[];
  helperText?: string;
};

export type SuratTemplate = {
  id: string;
  code: string;
  title: string;
  category: string;
  description: string;
  status: SuratTemplateStatus;
  updatedAt: string;
  usedCount: number;
  icon: LucideIcon;
  templateFileName: string;
  fields: SuratField[];
};

export type KuasaOption = {
  id: string;
  label: string;
  nama_kuasa: string;
  nik_kuasa: string;
  kotalahir_kuasa: string;
  tanggallahir_kuasa: string;
  kelamin_kuasa: string;
  agama_kuasa: string;
  alamat_kuasa: string;
  pekerjaan_kuasa: string;
  statuskawin_kuasa: string;
};

export type WizardStepKey = "kuasa" | "debitur" | "asset" | "review";

export type WizardStep = {
  key: WizardStepKey;
  title: string;
  description: string;
};

export const wizardSteps: WizardStep[] = [
  {
    key: "kuasa",
    title: "Pilih Kuasa",
    description: "Pilih kuasa dari daftar yang tersedia dan isi data surat dasar.",
  },
  {
    key: "debitur",
    title: "Debitur",
    description: "Upload foto KTP debitur agar data terisi lebih cepat.",
  },
  {
    key: "asset",
    title: "Asset & Lelang",
    description: "Isi data sertifikat, objek, dan detail lelang.",
  },
  {
    key: "review",
    title: "Review",
    description: "Periksa ulang sebelum generate surat.",
  },
];

export const kuasaOptions: KuasaOption[] = [
  {
    id: "kuasa-a",
    label: "Kuasa A",
    nama_kuasa: "VENATHA TANOTO",
    nik_kuasa: "3316057105990006",
    kotalahir_kuasa: "Blora",
    tanggallahir_kuasa: "31 Mei 1999",
    kelamin_kuasa: "Perempuan",
    agama_kuasa: "Kristen",
    alamat_kuasa: "Simo Katrungan Kidul VII/2A",
    pekerjaan_kuasa: "Advokat",
    statuskawin_kuasa: "Belum Menikah",
  },
  {
    id: "kuasa-b",
    label: "Kuasa B",
    nama_kuasa: "NAMA KUASA B",
    nik_kuasa: "0000000000000000",
    kotalahir_kuasa: "Surabaya",
    tanggallahir_kuasa: "01 Januari 1990",
    kelamin_kuasa: "Laki-Laki",
    agama_kuasa: "Kristen",
    alamat_kuasa: "Alamat Kuasa B",
    pekerjaan_kuasa: "Advokat",
    statuskawin_kuasa: "Menikah",
  },
];

export const suratTemplates: SuratTemplate[] = [
  {
    id: "permohonan-eksekusi-pn",
    code: "LIT-001",
    title: "Permohonan Eksekusi",
    category: "Litigasi Perdata",
    description:
      "Template permohonan eksekusi pengosongan / pelaksanaan eksekusi ke Pengadilan Negeri. Alur input dibuat bertahap: pilih kuasa, scan KTP debitur, lalu isi data asset dan data lelang.",
    status: "Baru",
    updatedAt: "04 Apr 2026",
    usedCount: 0,
    icon: FileText,
    templateFileName: "Template_permohonan_PN.docx",
    fields: [
      {
        key: "selected_kuasa_id",
        label: "Pilih Kuasa",
        type: "select",
        section: "kuasa",
        required: true,
        options: kuasaOptions.map((item) => ({
          label: item.label,
          value: item.id,
        })),
      },

      {
        key: "kota",
        label: "Kota",
        type: "text",
        section: "surat",
        required: true,
        placeholder: "Contoh: Surabaya",
      },
      {
        key: "tanggal_surat",
        label: "Tanggal Surat",
        type: "date",
        section: "surat",
        required: true,
      },
      {
        key: "alamat_PN",
        label: "Alamat Pengadilan Negeri",
        type: "textarea",
        section: "surat",
        required: true,
        placeholder: "Contoh: Jl. Raya Arjuno No. 16-18",
      },
      {
        key: "alamat_pn",
        label: "Alamat PN (Lampiran)",
        type: "textarea",
        section: "lampiran",
        placeholder: "Alamat lengkap PN untuk bagian alat bukti",
      },
      {
        key: "kecamatan",
        label: "Kecamatan PN",
        type: "text",
        section: "lampiran",
        placeholder: "Contoh: Sawahan",
      },
      {
        key: "provinsi",
        label: "Provinsi",
        type: "text",
        section: "lampiran",
        placeholder: "Contoh: Jawa Timur",
      },
      {
        key: "kode_pos",
        label: "Kode Pos",
        type: "text",
        section: "lampiran",
        placeholder: "Contoh: 60251",
      },

      {
        key: "nama_kuasa",
        label: "Nama Kuasa",
        type: "text",
        section: "kuasa",
        required: true,
        readOnly: true,
      },
      {
        key: "nik_kuasa",
        label: "NIK Kuasa",
        type: "text",
        section: "kuasa",
        required: true,
        readOnly: true,
      },
      {
        key: "kotalahir_kuasa",
        label: "Kota Lahir Kuasa",
        type: "text",
        section: "kuasa",
        readOnly: true,
      },
      {
        key: "tanggallahir_kuasa",
        label: "Tanggal Lahir Kuasa",
        type: "text",
        section: "kuasa",
        readOnly: true,
      },
      {
        key: "kelamin_kuasa",
        label: "Jenis Kelamin Kuasa",
        type: "text",
        section: "kuasa",
        readOnly: true,
      },
      {
        key: "agama_kuasa",
        label: "Agama Kuasa",
        type: "text",
        section: "kuasa",
        readOnly: true,
      },
      {
        key: "alamat_kuasa",
        label: "Alamat Kuasa",
        type: "textarea",
        section: "kuasa",
        readOnly: true,
      },
      {
        key: "pekerjaan_kuasa",
        label: "Pekerjaan Kuasa",
        type: "text",
        section: "kuasa",
        readOnly: true,
      },
      {
        key: "statuskawin_kuasa",
        label: "Status Kawin Kuasa",
        type: "text",
        section: "kuasa",
        readOnly: true,
      },

      {
        key: "nama_pemohon",
        label: "Nama Pemohon",
        type: "text",
        section: "pemohon",
        required: true,
        placeholder: "Nama pemilik / pemberi kuasa",
      },
      {
        key: "nik_pemohon",
        label: "NIK Pemohon",
        type: "text",
        section: "pemohon",
        required: true,
      },
      {
        key: "kotalahir_pemohon",
        label: "Kota Lahir Pemohon",
        type: "text",
        section: "pemohon",
      },
      {
        key: "tanggallahir_pemohon",
        label: "Tanggal Lahir Pemohon",
        type: "text",
        section: "pemohon",
        placeholder: "Contoh: 18 Oktober 1983",
      },
      {
        key: "kelamin_pemohon",
        label: "Jenis Kelamin Pemohon",
        type: "select",
        section: "pemohon",
        options: [
          { label: "Laki-Laki", value: "Laki-Laki" },
          { label: "Perempuan", value: "Perempuan" },
        ],
      },
      {
        key: "agama_pemohon",
        label: "Agama Pemohon",
        type: "text",
        section: "pemohon",
      },
      {
        key: "alamat_pemohon",
        label: "Alamat Pemohon",
        type: "textarea",
        section: "pemohon",
      },
      {
        key: "pekerjaan_pemohon",
        label: "Pekerjaan Pemohon",
        type: "text",
        section: "pemohon",
      },
      {
        key: "statuskawin_pemohon",
        label: "Status Kawin Pemohon",
        type: "text",
        section: "pemohon",
      },

      {
        key: "ktp_debitur_file",
        label: "Foto KTP Debitur",
        type: "file",
        section: "debitur",
        helperText: "Upload foto KTP agar nama dan alamat debitur bisa diprefill.",
      },
      {
        key: "nama_debitur",
        label: "Nama Debitur / Termohon",
        type: "text",
        section: "debitur",
        required: true,
        placeholder: "Hasil scan KTP / koreksi manual",
      },
      {
        key: "nik_debitur",
        label: "NIK Debitur",
        type: "text",
        section: "debitur",
        placeholder: "Opsional, untuk arsip internal",
      },
      {
        key: "alamat_debitur",
        label: "Alamat Debitur",
        type: "textarea",
        section: "debitur",
        placeholder: "Hasil scan KTP / koreksi manual",
      },

      {
        key: "jenis_sertifikat",
        label: "Jenis Sertifikat",
        type: "text",
        section: "asset",
        required: true,
        placeholder: "Contoh: Sertipikat Hak Guna Bangunan",
      },
      {
        key: "singkatan_sertifikat",
        label: "Singkatan Sertifikat",
        type: "text",
        section: "asset",
        required: true,
        placeholder: "Contoh: SHGB",
      },
      {
        key: "nomor_nib",
        label: "Nomor NIB",
        type: "text",
        section: "asset",
        required: true,
      },
      {
        key: "LT",
        label: "Luas Tanah (m²)",
        type: "number",
        section: "asset",
        required: true,
      },
      {
        key: "lokasi_asset",
        label: "Lokasi Asset",
        type: "textarea",
        section: "asset",
        required: true,
        placeholder: "Alamat lengkap objek",
      },
      {
        key: "kelurahan_asset",
        label: "Kelurahan Asset",
        type: "text",
        section: "asset",
        required: true,
      },
      {
        key: "kecamatan_asset",
        label: "Kecamatan Asset",
        type: "text",
        section: "asset",
        required: true,
      },
      {
        key: "kota_asset",
        label: "Kota Asset",
        type: "text",
        section: "asset",
        required: true,
      },

      {
        key: "nama_bank",
        label: "Nama Bank",
        type: "text",
        section: "lelang",
        required: true,
        placeholder: "Contoh: Bank Rakyat Indonesia",
      },
      {
        key: "nomor_risalah",
        label: "Nomor Risalah",
        type: "text",
        section: "lelang",
        required: true,
      },
      {
        key: "tanggal_risalah",
        label: "Tanggal Risalah",
        type: "text",
        section: "lelang",
        required: true,
        placeholder: "Contoh: 17 November 2025",
      },
      {
        key: "nomor_kwitansi",
        label: "Nomor Kwitansi",
        type: "text",
        section: "lelang",
        required: true,
      },
      {
        key: "tanggal_kwitansi",
        label: "Tanggal Kwitansi",
        type: "text",
        section: "lelang",
        required: true,
        placeholder: "Contoh: 17 November 2025",
      },
    ],
  },

  // ── Transaksi ─────────────────────────────────────────────────────────────────
  {
    id: "mou-transaksi",
    code: "TRX-003",
    title: "MOU Transaksi",
    category: "Transaksi",
    description:
      "Memorandum of Understanding antara kantor dan klien. Sistem otomatis memilih template sesuai skema komisi — Persentase atau Selisih Harga.",
    status: "Baru",
    updatedAt: "22 Mei 2026",
    usedCount: 0,
    icon: FileText,
    templateFileName: "MOU_Template_persentase_final.docx", // dipilih otomatis oleh generate-mou
    fields: [
      {
        key: "id_transaksi",
        label: "ID Transaksi",
        type: "text",
        section: "surat",
        required: true,
        placeholder: "ID transaksi dari database",
        helperText: "Diisi otomatis jika dibuka dari progress transaksi",
      },
      {
        key: "nama_klien",
        label: "Nama Klien",
        type: "text",
        section: "pemohon",
        required: true,
        placeholder: "Nama lengkap sesuai KTP",
        helperText: "Diisi otomatis dari data transaksi",
      },
      {
        key: "nik_klien",
        label: "NIK Klien",
        type: "text",
        section: "pemohon",
        required: true,
        placeholder: "16 digit NIK",
        helperText: "Diisi otomatis dari data transaksi",
      },
      {
        key: "alamat_klien",
        label: "Alamat Klien",
        type: "textarea",
        section: "pemohon",
        required: true,
        placeholder: "Alamat sesuai KTP",
        helperText: "Diisi otomatis dari data transaksi",
      },
      {
        key: "uang_tanda_jaminan",
        label: "Uang Tanda Jaminan (Rp)",
        type: "number",
        section: "surat",
        required: true,
        placeholder: "Contoh: 50000000",
        helperText: "Default dari uang jaminan listing jika kosong",
      },
      // Khusus PERSENTASE
      {
        key: "biaya_lelang_persen",
        label: "Biaya Lelang (%)",
        type: "text",
        section: "surat",
        placeholder: "Contoh: 2",
        helperText: "Hanya untuk skema Persentase Komisi",
      },
      {
        key: "pengosongan_min",
        label: "Biaya Pengosongan Minimum (Rp)",
        type: "number",
        section: "surat",
        placeholder: "Contoh: 10000000",
        helperText: "Hanya untuk skema Persentase Komisi",
      },
      {
        key: "pengosongan_max",
        label: "Biaya Pengosongan Maksimum (Rp)",
        type: "number",
        section: "surat",
        placeholder: "Contoh: 30000000",
        helperText: "Hanya untuk skema Persentase Komisi",
      },
    ],
  },
  {
    id: "kuitansi-solusindo",
    code: "TRX-002",
    title: "Kuitansi Pembayaran",
    category: "Transaksi",
    description:
      "Template kuitansi penerimaan pembayaran. Isi nama pembayar, nominal, dan keperluan — sistem generate kuitansi siap cetak.",
    status: "Baru",
    updatedAt: "20 Mei 2026",
    usedCount: 0,
    icon: FileText,
    templateFileName: "Kuitansi_Solusindo_Premier.docx",
    fields: [
      { key: "nomor_kuitansi", label: "Nomor Kuitansi", type: "text", section: "surat", required: true, placeholder: "KWT/2026/05/001" },
      { key: "tanggal", label: "Tanggal", type: "date", section: "surat", required: true },
      { key: "kota", label: "Kota", type: "text", section: "surat", required: true, placeholder: "Surabaya" },
      { key: "nama_pembayar", label: "Nama Pembayar", type: "text", section: "pemohon", required: true, placeholder: "Nama lengkap atau perusahaan" },
      { key: "nominal", label: "Nominal (Rp)", type: "number", section: "surat", required: true, placeholder: "5000000" },
      { key: "perihal", label: "Untuk Keperluan", type: "textarea", section: "surat", required: true, placeholder: "Contoh: Pembayaran jasa pengurusan eksekusi aset" },
      { key: "catatan", label: "Catatan", type: "textarea", section: "lampiran", placeholder: "Opsional" },
    ],
  },
  {
    id: "invoice-solusindo",
    code: "TRX-001",
    title: "Invoice Penagihan",
    category: "Transaksi",
    description:
      "Template invoice penagihan jasa hukum untuk klien. Isi data klien, uraian pekerjaan, dan nominal tagihan — sistem akan generate dokumen siap kirim.",
    status: "Baru",
    updatedAt: "19 Mei 2026",
    usedCount: 0,
    icon: FileText,
    templateFileName: "Invoice_Solusindo_Premier_Final.docx",
    fields: [
      {
        key: "nomor_invoice",
        label: "Nomor Invoice",
        type: "text",
        section: "surat",
        required: true,
        placeholder: "Contoh: INV/2026/05/001",
      },
      {
        key: "tanggal_invoice",
        label: "Tanggal Invoice",
        type: "date",
        section: "surat",
        required: true,
      },
      {
        key: "kota",
        label: "Kota",
        type: "text",
        section: "surat",
        required: true,
        placeholder: "Contoh: Surabaya",
      },
      {
        key: "nama_klien",
        label: "Nama Klien / Penerima",
        type: "text",
        section: "pemohon",
        required: true,
        placeholder: "Nama lengkap atau nama perusahaan",
      },
      {
        key: "alamat_klien",
        label: "Alamat Klien",
        type: "textarea",
        section: "pemohon",
        required: true,
        placeholder: "Alamat lengkap klien",
      },
      {
        key: "perihal",
        label: "Perihal / Uraian Pekerjaan",
        type: "textarea",
        section: "surat",
        required: true,
        placeholder: "Contoh: Jasa Konsultasi Hukum Pengurusan Eksekusi Aset",
      },
      {
        key: "nominal_jasa",
        label: "Nominal Jasa (Rp)",
        type: "number",
        section: "surat",
        required: true,
        placeholder: "Contoh: 5000000",
      },
      {
        key: "biaya_lain",
        label: "Biaya Lain-lain (Rp)",
        type: "number",
        section: "surat",
        placeholder: "Opsional",
      },
      {
        key: "catatan",
        label: "Catatan / Keterangan",
        type: "textarea",
        section: "lampiran",
        placeholder: "Catatan tambahan jika ada",
      },
    ],
  },

  // ── Pengurusan Dokumen ────────────────────────────────────────────────────────
  {
    id: "tanda-terima-dokumen",
    code: "PEN-002",
    title: "Tanda Terima Dokumen",
    category: "Pengurusan Dokumen",
    description:
      "Bukti serah terima dokumen properti dari agent ke penerima. Scan KTP penerima untuk auto-isi nama, NIK, dan alamat, pilih properti closing, lalu PDF ter-generate otomatis.",
    status: "Baru",
    updatedAt: "07 Jul 2026",
    usedCount: 0,
    icon: FileText,
    templateFileName: "TandaTerima_Solusindo.docx",
    fields: [
      { key: "ktp_penerima_file", label: "Foto KTP Penerima", type: "file", section: "debitur", helperText: "Upload KTP agar nama, NIK, dan alamat penerima terisi otomatis." },
      { key: "nama_pemilik", label: "Nama Penerima", type: "text", section: "debitur", required: true, placeholder: "Hasil scan KTP / koreksi manual" },
      { key: "nik_pemilik", label: "NIK Penerima", type: "text", section: "debitur", placeholder: "16 digit NIK" },
      { key: "alamat_pemilik", label: "Alamat Penerima", type: "textarea", section: "debitur", placeholder: "Hasil scan KTP / koreksi manual" },
      { key: "alamat_properti", label: "Alamat Properti", type: "textarea", section: "asset", required: true, placeholder: "Alamat properti closing" },
      { key: "tanggal_ttd", label: "Tanggal Terima", type: "date", section: "surat", required: true },
      { key: "nama_agent", label: "Nama Agent (Yang Menyerahkan)", type: "text", section: "surat", placeholder: "Otomatis dari akun agent" },
      { key: "no_agent", label: "No. Agent / WhatsApp", type: "text", section: "surat", placeholder: "Otomatis dari akun agent" },
    ],
  },
  {
    id: "permohonan-akte-grosse",
    code: "PEN-001",
    title: "Permohonan Akte Grosse",
    category: "Pengurusan Notaris",
    description:
      "Template surat permohonan penerbitan akte grosse kepada notaris. Digunakan untuk meminta salinan resmi akte notariil seperti APHT, PPJB, atau akta kredit dalam rangka proses lelang atau eksekusi.",
    status: "Baru",
    updatedAt: "04 Mei 2026",
    usedCount: 0,
    icon: FileText,
    templateFileName: "Template_Permohonan_Akte_Grosse.docx",
    fields: [
      // ── Data Surat ────────────────────────────────────────────────────────
      {
        key: "kota",
        label: "Kota",
        type: "text",
        section: "surat",
        required: true,
        placeholder: "Contoh: Surabaya",
      },
      {
        key: "tanggal_surat",
        label: "Tanggal Surat",
        type: "date",
        section: "surat",
        required: true,
      },
      {
        key: "nomor_surat",
        label: "Nomor Surat",
        type: "text",
        section: "surat",
        placeholder: "Contoh: 012/SP/AG/V/2026",
      },

      // ── Data Kuasa ────────────────────────────────────────────────────────
      {
        key: "selected_kuasa_id",
        label: "Pilih Kuasa",
        type: "select",
        section: "kuasa",
        required: true,
        options: kuasaOptions.map((item) => ({
          label: item.label,
          value: item.id,
        })),
      },
      {
        key: "nama_kuasa",
        label: "Nama Kuasa",
        type: "text",
        section: "kuasa",
        required: true,
        readOnly: true,
      },
      {
        key: "nik_kuasa",
        label: "NIK Kuasa",
        type: "text",
        section: "kuasa",
        readOnly: true,
      },
      {
        key: "alamat_kuasa",
        label: "Alamat Kuasa",
        type: "textarea",
        section: "kuasa",
        readOnly: true,
      },
      {
        key: "pekerjaan_kuasa",
        label: "Pekerjaan Kuasa",
        type: "text",
        section: "kuasa",
        readOnly: true,
      },

      // ── Data Pemohon (Bank / Kreditur) ────────────────────────────────────
      {
        key: "nama_pemohon",
        label: "Nama Pemohon / Bank",
        type: "text",
        section: "pemohon",
        required: true,
        placeholder: "Contoh: PT Bank Rakyat Indonesia (Persero) Tbk",
      },
      {
        key: "alamat_pemohon",
        label: "Alamat Pemohon",
        type: "textarea",
        section: "pemohon",
        placeholder: "Alamat lengkap kantor / bank",
      },

      // ── Data Notaris ──────────────────────────────────────────────────────
      {
        key: "nama_notaris",
        label: "Nama Notaris",
        type: "text",
        section: "surat",
        required: true,
        placeholder: "Contoh: SITI RAHAYU, S.H., M.Kn.",
      },
      {
        key: "alamat_notaris",
        label: "Alamat Kantor Notaris",
        type: "textarea",
        section: "surat",
        required: true,
        placeholder: "Contoh: Jl. Diponegoro No. 88, Surabaya",
      },

      // ── Data Akta ─────────────────────────────────────────────────────────
      {
        key: "jenis_akta",
        label: "Jenis Akta",
        type: "select",
        section: "surat",
        required: true,
        options: [
          { label: "Akta Pemberian Hak Tanggungan (APHT)", value: "Akta Pemberian Hak Tanggungan (APHT)" },
          { label: "Perjanjian Kredit (PK)", value: "Perjanjian Kredit (PK)" },
          { label: "Pengakuan Hutang (PH)", value: "Pengakuan Hutang (PH)" },
          { label: "Perjanjian Pengikatan Jual Beli (PPJB)", value: "Perjanjian Pengikatan Jual Beli (PPJB)" },
          { label: "Lainnya", value: "Lainnya" },
        ],
      },
      {
        key: "nomor_akta_grosse",
        label: "Nomor Akta",
        type: "text",
        section: "surat",
        required: true,
        placeholder: "Contoh: 25",
      },
      {
        key: "tanggal_akta",
        label: "Tanggal Akta",
        type: "text",
        section: "surat",
        required: true,
        placeholder: "Contoh: 15 Maret 2022",
      },
      {
        key: "nomor_aktegrosse",
        label: "Nomor Akte Grosse (jika ada)",
        type: "text",
        section: "surat",
        placeholder: "Nomor salinan akte grosse sebelumnya",
      },

      // ── Data Debitur ──────────────────────────────────────────────────────
      {
        key: "nama_debitur",
        label: "Nama Debitur",
        type: "text",
        section: "debitur",
        required: true,
        placeholder: "Nama lengkap debitur / pemilik agunan",
      },
      {
        key: "nik_debitur",
        label: "NIK Debitur",
        type: "text",
        section: "debitur",
        placeholder: "16 digit NIK",
      },
      {
        key: "alamat_debitur",
        label: "Alamat Debitur",
        type: "textarea",
        section: "debitur",
        placeholder: "Alamat sesuai KTP",
      },

      // ── Data Asset / Agunan ───────────────────────────────────────────────
      {
        key: "jenis_sertifikat",
        label: "Jenis Sertifikat",
        type: "text",
        section: "asset",
        required: true,
        placeholder: "Contoh: Sertipikat Hak Milik",
      },
      {
        key: "singkatan_sertifikat",
        label: "Singkatan Sertifikat",
        type: "text",
        section: "asset",
        required: true,
        placeholder: "Contoh: SHM",
      },
      {
        key: "nomor_nib",
        label: "Nomor NIB / Sertifikat",
        type: "text",
        section: "asset",
        required: true,
        placeholder: "Nomor sertifikat tanah",
      },
      {
        key: "lokasi_asset",
        label: "Lokasi / Alamat Asset",
        type: "textarea",
        section: "asset",
        required: true,
        placeholder: "Alamat lengkap objek agunan",
      },
      {
        key: "LT",
        label: "Luas Tanah (m²)",
        type: "number",
        section: "asset",
        placeholder: "Contoh: 120",
      },

      // ── Keperluan / Alasan ────────────────────────────────────────────────
      {
        key: "alasan_permohonan",
        label: "Keperluan / Alasan Permohonan",
        type: "textarea",
        section: "lampiran",
        placeholder: "Contoh: dalam rangka proses lelang eksekusi hak tanggungan berdasarkan Pasal 6 UUHT",
        helperText: "Dijelaskan mengapa akte grosse dibutuhkan",
      },
    ],
  },

  // ── Eksekusi Pengosongan ──────────────────────────────────────────────────────
  {
    id: "akta-kesepakatan-bersama",
    code: "EKS-001",
    title: "Akta Kesepakatan Bersama",
    category: "Eksekusi Pengosongan",
    description:
      "Akta kesepakatan bersama antara pemenang lelang dan debitur untuk pengosongan aset. Scan KTP kedua pihak + upload risalah lelang, lalu input kompensasi dan tanggal paling lambat pengosongan — PDF ter-generate otomatis.",
    status: "Baru",
    updatedAt: "08 Jul 2026",
    usedCount: 0,
    icon: FileText,
    templateFileName: "Akta_kesepakatan_bersama_TemplateSolusindo.docx",
    fields: [],
  },
];
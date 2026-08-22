/**
 * ────────────────────────────────────────────────────────────────────────────
 * MESIN ESTIMASI BIAYA PEMBELIAN ASET LELANG
 * ────────────────────────────────────────────────────────────────────────────
 * Satu-satunya sumber kebenaran untuk angka biaya lelang di seluruh website
 * (sidebar agent, dock mobile, sheet rincian, teks salinan untuk klien).
 *
 * Prinsipnya: SEMUA MASUKAN DIAMBIL DARI DATA LISTING — harga selalu memakai
 * nilai limit, wilayah dibaca dari provinsi, kebutuhan armada dari luas tanah.
 * Tidak ada satu pun angka yang harus diisi manual oleh agent, supaya hasil
 * yang dibacakan ke klien selalu sama dari siapa pun agent-nya.
 *
 * Dua kelompok biaya yang selalu ditanya klien:
 *   A. BALIK NAMA  → persentase dari harga limit + fee jasa tetap.
 *   B. EKSEKUSI    → biaya pengosongan aset yang masih berpenghuni.
 */

// ═══════════════════════════════ TIPE ═══════════════════════════════════════

export type WilayahEksekusi = "JATIM" | "LUAR_JATIM";

export interface InputBiayaLelang {
  /** Nilai limit lelang. */
  limit: number;
  /** Provinsi listing — penentu tarif eksekusi Jawa Timur vs luar. */
  provinsi?: string | null;
  /** Luas tanah (m²) — dasar hitung jumlah paket armada. */
  luasTanah?: number | null;
  /** Luas bangunan (m²) — dasar perkiraan kebutuhan tempat perpindahan. */
  luasBangunan?: number | null;
}

export interface KomponenBiaya {
  kode: string;
  label: string;
  /** Label pendek untuk pesan WhatsApp — baris chat hanya muat ± 35 karakter. */
  labelPesan?: string;
  /** Keterangan rumus ringkas yang tampil di bawah label. */
  rumus: string;
  nominal: number;
  /** Angka belum pasti — tidak ikut dijumlahkan ke subtotal. */
  tentatif?: boolean;
  /** Persentase (0–1) bila komponen berbasis persen. */
  persen?: number;
}

export interface BlokBiaya {
  label: string;
  komponen: KomponenBiaya[];
  subtotal: number;
}

export interface RincianBiayaLelang {
  limit: number;
  wilayah: WilayahEksekusi;
  luasTanah: number;
  luasBangunan: number;
  balikNama: BlokBiaya;
  eksekusi: BlokBiaya;
  /** Balik nama + eksekusi (tanpa harga aset). */
  totalBiaya: number;
  /** Limit + seluruh biaya. */
  totalModal: number;
  /** Band pengosongan yang terpilih — dipakai untuk label & tabel. */
  band: BandPengosongan;
  /** Berapa paket armada yang dibutuhkan. */
  paketArmada: number;
  /** Perkiraan luas tempat penampungan barang (m²), null bila LB tak diketahui. */
  luasTempatPerpindahan: number | null;
}

// ═══════════════════════════ TARIF & KONSTANTA ══════════════════════════════

/** Komponen persentase biaya balik nama. Totalnya 8,5% dari harga limit. */
export const TARIF_BALIK_NAMA = [
  { kode: "bea_lelang", label: "Bea Lelang", persen: 0.02 },
  { kode: "bphtb", label: "BPHTB", persen: 0.05 },
  { kode: "ppn_lelang", label: "PPN Lelang", persen: 0.011 },
  { kode: "roya_balik_nama", label: "Roya & Balik Nama", persen: 0.004 },
] as const;

/** Jumlah seluruh komponen persentase balik nama (8,5%). */
export const PERSEN_BALIK_NAMA = TARIF_BALIK_NAMA.reduce((a, t) => a + t.persen, 0);

/** Fee jasa pengurusan dokumen — nilai tetap, tidak ikut harga. */
export const FEE_JASA = 10_000_000;

/** Satu paket armada: 6 truk + 15 kuli, kerja ± 2 jam. */
export const TARIF_ARMADA = 6_800_000;
/** Satu paket armada menangani sampai 240 m² luas tanah. */
export const LUAS_TANAH_PER_PAKET = 240;

/** Konsumsi aparat pelaksana eksekusi: 100 orang × Rp 30.000. */
export const KONSUMSI_JUMLAH_ORANG = 100;
export const KONSUMSI_PER_ORANG = 30_000;
export const BIAYA_KONSUMSI = KONSUMSI_JUMLAH_ORANG * KONSUMSI_PER_ORANG;

/** Tempat perpindahan diperkirakan seluas 50% luas bangunan. */
export const RASIO_TEMPAT_PERPINDAHAN = 0.5;

export interface BandPengosongan {
  /** Batas bawah (inklusif). */
  min: number;
  /** Batas atas (eksklusif). Infinity untuk band terakhir. */
  max: number;
  label: string;
  /** Tarif untuk aset di Jawa Timur. */
  jatim: number;
  /** Tarif untuk aset di luar Jawa Timur. */
  luarJatim: number;
  /**
   * Band teratas tidak memakai nilai tetap: biayanya 5% dari harga limit per
   * sertifikat ditambah Rp 150 jt, berlaku sama di semua wilayah.
   */
  persen?: number;
  tambahanTetap?: number;
}

/** Tabel biaya eksekusi pengosongan menurut harga limit. */
export const TABEL_PENGOSONGAN: BandPengosongan[] = [
  { min: 0, max: 500_000_000, label: "< Rp 500 jt", jatim: 125_000_000, luarJatim: 150_000_000 },
  {
    min: 500_000_000,
    max: 1_500_000_000,
    label: "Rp 500 jt – Rp 1,5 M",
    jatim: 150_000_000,
    luarJatim: 175_000_000,
  },
  {
    min: 1_500_000_000,
    max: 2_500_000_000,
    label: "Rp 1,5 M – Rp 2,5 M",
    jatim: 200_000_000,
    luarJatim: 225_000_000,
  },
  {
    min: 2_500_000_000,
    max: 5_000_000_000,
    label: "Rp 2,5 M – Rp 5 M",
    jatim: 325_000_000,
    luarJatim: 350_000_000,
  },
  {
    min: 5_000_000_000,
    max: 10_000_000_000,
    label: "Rp 5 M – Rp 10 M",
    jatim: 625_000_000,
    luarJatim: 675_000_000,
  },
  {
    min: 10_000_000_000,
    max: Infinity,
    label: "> Rp 10 M",
    jatim: 0,
    luarJatim: 0,
    persen: 0.05,
    tambahanTetap: 150_000_000,
  },
];

// ═══════════════════════════ PEMFORMATAN ANGKA ══════════════════════════════

export const formatRupiah = (value: number): string => {
  if (!value || !isFinite(value)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Math.round(value));
};

/** Versi ringkas untuk ruang sempit: Rp 3,5 M · Rp 605 Jt */
export const formatRupiahRingkas = (value: number): string => {
  if (!value || !isFinite(value)) return "Rp 0";
  const trim = (n: number) => n.toFixed(n % 1 === 0 ? 0 : 1).replace(".", ",");
  if (value >= 1_000_000_000_000) return `Rp ${trim(value / 1_000_000_000_000)} T`;
  if (value >= 1_000_000_000) return `Rp ${trim(value / 1_000_000_000)} M`;
  if (value >= 1_000_000) return `Rp ${Math.round(value / 1_000_000)} Jt`;
  return formatRupiah(value);
};

/** "2%", "1,1%", "0,4%" — tanpa nol di belakang koma. */
export const formatPersen = (persen: number): string =>
  `${(persen * 100).toFixed(2).replace(/\.?0+$/, "").replace(".", ",")}%`;

// ═════════════════════════════ KALKULASI ════════════════════════════════════

/** Deteksi wilayah dari kolom provinsi listing. */
export const wilayahDariProvinsi = (provinsi?: string | null): WilayahEksekusi =>
  /jawa\s*tim|jatim|east\s*java/i.test(String(provinsi || "")) ? "JATIM" : "LUAR_JATIM";

export const cariBandPengosongan = (limit: number): BandPengosongan => {
  const nilai = Math.max(0, limit || 0);
  return (
    TABEL_PENGOSONGAN.find((b) => nilai >= b.min && nilai < b.max) ??
    TABEL_PENGOSONGAN[TABEL_PENGOSONGAN.length - 1]
  );
};

/** Tarif satu band untuk satu wilayah. Band teratas dihitung dari harga limit. */
export const tarifBand = (
  band: BandPengosongan,
  wilayah: WilayahEksekusi,
  limit: number
): number => {
  if (band.persen != null) {
    return Math.round(limit * band.persen) + (band.tambahanTetap ?? 0);
  }
  return wilayah === "JATIM" ? band.jatim : band.luarJatim;
};

/** Jumlah paket armada: satu paket per 240 m² luas tanah, minimal satu. */
export const hitungPaketArmada = (luasTanah?: number | null): number => {
  const luas = Number(luasTanah) || 0;
  if (luas <= 0) return 1;
  return Math.max(1, Math.floor(luas / LUAS_TANAH_PER_PAKET));
};

/** Biaya balik nama: 8,5% dari harga + fee jasa tetap. */
export const hitungBalikNama = (harga: number): number => {
  if (!harga || harga <= 0) return 0;
  return Math.round(harga * PERSEN_BALIK_NAMA) + FEE_JASA;
};

export function hitungBiayaLelang(input: InputBiayaLelang): RincianBiayaLelang {
  const limit = Math.max(0, Number(input.limit) || 0);
  const wilayah = wilayahDariProvinsi(input.provinsi);
  const luasTanah = Number(input.luasTanah) || 0;
  const luasBangunan = Number(input.luasBangunan) || 0;

  // ── A. BALIK NAMA ─────────────────────────────────────────────────────────
  const komponenBalikNama: KomponenBiaya[] = TARIF_BALIK_NAMA.map((t) => ({
    kode: t.kode,
    label: t.label,
    rumus: `${formatPersen(t.persen)} × harga limit`,
    nominal: Math.round(limit * t.persen),
    persen: t.persen,
  }));
  komponenBalikNama.push({
    kode: "fee_jasa",
    label: "Fee Jasa Pengurusan",
    rumus: "Nilai tetap",
    nominal: FEE_JASA,
  });
  const subtotalBalikNama = komponenBalikNama.reduce((a, k) => a + k.nominal, 0);

  // ── B. EKSEKUSI PENGOSONGAN ───────────────────────────────────────────────
  const band = cariBandPengosongan(limit);
  const biayaPengosongan = tarifBand(band, wilayah, limit);
  const paketArmada = hitungPaketArmada(luasTanah);
  const luasTempatPerpindahan =
    luasBangunan > 0 ? Math.round(luasBangunan * RASIO_TEMPAT_PERPINDAHAN) : null;

  const namaWilayah = wilayah === "JATIM" ? "Jawa Timur" : "luar Jawa Timur";

  const komponenEksekusi: KomponenBiaya[] = [
    {
      kode: "pengosongan",
      label: "Eksekusi Pengosongan",
      labelPesan: "Eksekusi pengosongan",
      rumus: band.persen
        ? `${formatPersen(band.persen)} × limit + ${formatRupiahRingkas(band.tambahanTetap ?? 0)}`
        : `Limit ${band.label} · ${namaWilayah}`,
      nominal: biayaPengosongan,
    },
    {
      kode: "armada",
      label: "Transportasi & Tenaga Angkut",
      labelPesan: `Transportasi 6 truk + 15 kuli${paketArmada > 1 ? ` ×${paketArmada}` : ""}`,
      rumus:
        `6 truk + 15 kuli${paketArmada > 1 ? ` × ${paketArmada} paket` : ""}` +
        (luasTanah > 0 ? ` · LT ${luasTanah} m²` : ""),
      nominal: TARIF_ARMADA * paketArmada,
    },
    {
      kode: "konsumsi",
      label: "Konsumsi Aparat",
      labelPesan: `Konsumsi aparat (${KONSUMSI_JUMLAH_ORANG} orang)`,
      rumus: `${KONSUMSI_JUMLAH_ORANG} orang × ${formatRupiah(KONSUMSI_PER_ORANG)}`,
      nominal: BIAYA_KONSUMSI,
    },
    {
      kode: "tempat_perpindahan",
      label: "Tempat Perpindahan Barang",
      labelPesan: "Tempat perpindahan barang",
      rumus: luasTempatPerpindahan
        ? `Perlu ± ${luasTempatPerpindahan} m² (50% luas bangunan)`
        : "± 50% luas bangunan",
      nominal: 0,
      tentatif: true,
    },
  ];
  const subtotalEksekusi = komponenEksekusi.reduce(
    (a, k) => a + (k.tentatif ? 0 : k.nominal),
    0
  );

  const totalBiaya = subtotalBalikNama + subtotalEksekusi;

  return {
    limit,
    wilayah,
    luasTanah,
    luasBangunan,
    balikNama: { label: "Biaya Balik Nama", komponen: komponenBalikNama, subtotal: subtotalBalikNama },
    eksekusi: { label: "Biaya Eksekusi Pengosongan", komponen: komponenEksekusi, subtotal: subtotalEksekusi },
    totalBiaya,
    totalModal: limit + totalBiaya,
    band,
    paketArmada,
    luasTempatPerpindahan,
  };
}

// ═══════════════════ TEKS SALINAN UNTUK KLIEN (WHATSAPP) ════════════════════

export interface KonteksPesanBiaya {
  judul?: string | null;
  kategori?: string | null;
  alamat?: string | null;
  kota?: string | null;
  provinsi?: string | null;
  tanggalLelang?: string | null;
  url?: string | null;
  namaAgent?: string | null;
  whatsappAgent?: string | null;
}

const GARIS = "━━━━━━━━━━━━━━";

/**
 * Menyusun teks siap tempel ke WhatsApp. Format sengaja dibuat rapat: WhatsApp
 * mobile hanya muat ± 35 karakter per baris, jadi label dipendekkan dan tidak
 * ada indentasi spasi (WhatsApp memangkas spasi berulang).
 */
export function formatPesanBiayaLelang(
  rincian: RincianBiayaLelang,
  konteks: KonteksPesanBiaya = {}
): string {
  const { balikNama, eksekusi, limit } = rincian;
  const L: string[] = [];

  L.push("*ESTIMASI BIAYA PEMBELIAN LELANG*");
  const namaAset = [konteks.judul, konteks.kategori].find(Boolean);
  if (namaAset) L.push(`_${namaAset}_`);
  const lokasi = [konteks.kota, konteks.provinsi].filter(Boolean).join(", ");
  if (konteks.alamat) L.push(`📍 ${konteks.alamat}`);
  else if (lokasi) L.push(`📍 ${lokasi}`);
  if (konteks.tanggalLelang) L.push(`🗓️ Lelang: ${konteks.tanggalLelang}`);

  L.push("");
  L.push(GARIS);
  L.push("*HARGA LIMIT*");
  L.push(`*${formatRupiah(limit)}*`);
  L.push("_Biaya di bawah menyesuaikan harga menang lelang._");

  L.push("");
  L.push(GARIS);
  L.push("*A. BIAYA BALIK NAMA*");
  balikNama.komponen.forEach((k) => {
    const label = k.persen ? `${k.label} ${formatPersen(k.persen)}` : k.label;
    L.push(`• ${label} — ${formatRupiah(k.nominal)}`);
  });
  L.push(`▸ *Subtotal: ${formatRupiah(balikNama.subtotal)}*`);

  L.push("");
  L.push(GARIS);
  L.push("*B. BIAYA EKSEKUSI PENGOSONGAN*");
  L.push(`_Berlaku bila aset masih berpenghuni._`);
  eksekusi.komponen.forEach((k) => {
    L.push(
      `• ${k.labelPesan ?? k.label} — ${k.tentatif ? "_tentatif_" : formatRupiah(k.nominal)}`
    );
  });
  L.push(`▸ *Subtotal: ${formatRupiah(eksekusi.subtotal)}*`);

  L.push("");
  L.push(GARIS);
  L.push("*TOTAL ESTIMASI MODAL*");
  L.push(`*${formatRupiah(rincian.totalModal)}*`);
  L.push(
    `_Limit ${formatRupiahRingkas(limit)} + biaya ${formatRupiahRingkas(rincian.totalBiaya)}_`
  );

  L.push("");
  L.push(
    `_Tempat perpindahan barang${
      rincian.luasTempatPerpindahan ? ` (± ${rincian.luasTempatPerpindahan} m²)` : ""
    } bersifat tentatif dan belum masuk total._`
  );
  L.push("_Angka di atas estimasi, belum termasuk pajak & biaya lain di luar daftar._");

  if (konteks.url) {
    L.push("");
    L.push("🔗 Detail aset:");
    L.push(konteks.url);
  }
  if (konteks.namaAgent) {
    L.push("");
    const wa = (konteks.whatsappAgent || "").replace(/^0/, "62").replace(/\D/g, "");
    L.push(`👤 ${konteks.namaAgent}${wa ? ` — wa.me/${wa}` : ""}`);
  }

  return L.join("\n");
}

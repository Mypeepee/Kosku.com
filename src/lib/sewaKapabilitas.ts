/**
 * Kapabilitas sewa per kategori — SATU tabel yang menjawab pertanyaan
 * "kategori ini kalau disewakan itu barang seperti apa?".
 *
 * ── KENAPA ADA ────────────────────────────────────────────────────────────
 *
 * Jawaban atas pertanyaan itu sebelumnya ditulis ulang di lima tempat, dan
 * masing-masing hanya tahu sepotong: `KATEGORI_BERKALENDER` di
 * @/lib/sewaAvailability tahu soal kalender, `modelInventarisDari` tahu soal
 * kamar-vs-unit, validator & dua route API sama-sama menghafal `isKos` /
 * `isApartemen` sendiri. Tidak ada satu pun yang tahu bahwa GUDANG tidak boleh
 * punya harga harian — jadi form menawarkan empat durasi untuk semua kategori,
 * dan sebuah gudang bisa tayang dengan tarif "Rp 300.000/hari" yang tidak
 * pernah dimaksudkan siapa pun.
 *
 * Perbaikannya bukan menambah validasi. Validasi menangkap kesalahan SETELAH
 * agent mengetik; yang benar adalah membuat pilihannya tidak pernah ada. Tabel
 * di bawah dipakai form untuk memutuskan chip mana yang dirender, dipakai
 * validator & server untuk menolak kiriman langsung, dan dipakai halaman detail
 * untuk memutuskan panel mana yang muncul. Satu fakta, satu tempat.
 *
 * ── DUA HAL YANG DIPUTUSKAN TABEL INI ─────────────────────────────────────
 *
 * 1. `mode` — BOOKING vs NEGOSIASI. Menentukan seluruh isi kolom kanan halaman
 *    detail. BOOKING = barang yang disewa berulang dengan tanggal masuk–keluar
 *    yang berganti sepanjang tahun (kos, apartemen, villa): pantas punya
 *    kalender, pilihan tanggal, voucher, dan tombol "Ajukan Sewa". NEGOSIASI =
 *    barang yang disewakan sekali lalu diam bertahun-tahun (gudang, ruko,
 *    pabrik, tanah): tidak ada yang bisa "dipesan" — yang terjadi adalah
 *    percakapan, penawaran harga, dan survei lokasi. Memberi gudang panel
 *    pemesanan berarti menampilkan kalender yang tidak pernah dipakai dan
 *    tombol yang menjanjikan proses yang tidak ada.
 *
 * 2. `durasi` — durasi mana yang SAH ditawarkan. Bukan selera: tanah disewakan
 *    per tahun, villa per malam. Durasi di luar daftar ini tidak dirender di
 *    form, ditolak validator, dan dinihilkan server.
 *
 * ── DISIPLIN BERKAS ───────────────────────────────────────────────────────
 *
 * Bebas dari `prisma`, `next/*`, dan session — murni data + fungsi tanpa efek
 * samping, supaya aman ikut ke bundel browser dan dipakai form maupun API dari
 * definisi yang sama persis. Disiplin yang sama dengan @/lib/sewaAvailability
 * dan @/lib/listingStatusPermission.
 */

// ─────────────────────────────────────────────────────────────────────────────
// BENTUK
// ─────────────────────────────────────────────────────────────────────────────

/** Sama dengan `durasi_sewa_enum` di schema.prisma. */
export type DurasiSewaKey = "HARIAN" | "MINGGUAN" | "BULANAN" | "TAHUNAN";

/** Sama dengan `kategori_properti_enum` di schema.prisma. */
export type KategoriProperti =
  | "RUMAH"
  | "APARTEMEN"
  | "RUKO"
  | "TANAH"
  | "GUDANG"
  | "HOTEL_DAN_VILLA"
  | "TOKO"
  | "PABRIK"
  | "KOS";

/**
 * Bentuk transaksi sewa untuk kategori ini.
 *   • BOOKING   → panel pemesanan: tanggal, durasi, voucher, "Ajukan Sewa".
 *   • NEGOSIASI → panel kontak: chat, ajukan penawaran, jadwalkan survei.
 */
export type ModeSewa = "BOOKING" | "NEGOSIASI";

/** Bentuk inventaris — kembaran `ModelInventaris` di lapisan tulis. */
export type ModelInventarisSewa = "KAMAR" | "UNIT";

export interface KapabilitasSewa {
  mode: ModeSewa;
  /** Durasi yang sah ditawarkan, urut dari terpendek. */
  durasi: readonly DurasiSewaKey[];
  /** Durasi yang dinyalakan duluan di form — durasi paling lazim kategori ini. */
  durasiBawaan: DurasiSewaKey;
  inventaris: ModelInventarisSewa;
  /** Boleh dipecah jadi beberapa tipe kamar (listing_kamar_tipe). */
  tipeKamar: boolean;
  /** Punya identitas unit: nama gedung, lantai, nomor, tipe unit. */
  identitasUnit: boolean;
}

/** Urutan kanonik durasi — dipakai semua daftar supaya tidak pernah acak. */
export const DURASI_URUT_SEWA: readonly DurasiSewaKey[] = [
  "HARIAN",
  "MINGGUAN",
  "BULANAN",
  "TAHUNAN",
] as const;

/** Durasi → kolom harganya di `listing_sewa_detail` & `listing_kamar_tipe`. */
export const FIELD_HARGA_DURASI = {
  HARIAN: "harga_sewa_harian",
  MINGGUAN: "harga_sewa_mingguan",
  BULANAN: "harga_sewa_bulanan",
  TAHUNAN: "harga_sewa_tahunan",
} as const satisfies Record<DurasiSewaKey, string>;

export type FieldHargaDurasi = (typeof FIELD_HARGA_DURASI)[DurasiSewaKey];

/** Kata sifat untuk kalimat penjelasan ("disewakan bulanan atau tahunan"). */
export const LABEL_DURASI: Record<DurasiSewaKey, string> = {
  HARIAN: "harian",
  MINGGUAN: "mingguan",
  BULANAN: "bulanan",
  TAHUNAN: "tahunan",
};

/** Nama tampilan kategori, untuk kalimat kesalahan yang enak dibaca. */
export const LABEL_KATEGORI: Record<KategoriProperti, string> = {
  RUMAH: "Rumah",
  APARTEMEN: "Apartemen",
  RUKO: "Ruko",
  TANAH: "Tanah",
  GUDANG: "Gudang",
  HOTEL_DAN_VILLA: "Hotel & Villa",
  TOKO: "Toko",
  PABRIK: "Pabrik",
  KOS: "Kos",
};

// ─────────────────────────────────────────────────────────────────────────────
// TABEL
// ─────────────────────────────────────────────────────────────────────────────

const SEMUA_DURASI = DURASI_URUT_SEWA;
const BULANAN_TAHUNAN = ["BULANAN", "TAHUNAN"] as const;

/**
 * Kontrak sewa tiap kategori.
 *
 * Tipenya `Record<KategoriProperti, …>` dan bukan `Partial<…>` dengan sengaja:
 * menambah nilai baru ke `kategori_properti_enum` akan MENGGAGALKAN compile
 * sampai barisnya ditulis di sini. Itu satu-satunya cara memastikan kategori
 * baru tidak diam-diam mewarisi perilaku bawaan yang belum pernah dipikirkan.
 */
export const KAPABILITAS_SEWA: Record<KategoriProperti, KapabilitasSewa> = {
  /**
   * Kos — satu-satunya kategori dengan banyak kamar di balik satu listing,
   * dan satu-satunya yang boleh dipecah per tipe kamar. Keempat durasi lazim:
   * kos harian di dekat rumah sakit sama nyatanya dengan kos tahunan mahasiswa.
   */
  KOS: {
    mode: "BOOKING",
    durasi: SEMUA_DURASI,
    durasiBawaan: "BULANAN",
    inventaris: "KAMAR",
    tipeKamar: true,
    identitasUnit: false,
  },

  /**
   * Apartemen — satu unit, disebut lewat gedung + lantai + nomor. Harian &
   * mingguan sah (sewa unit harian sudah jadi pasar tersendiri), tapi tidak
   * punya tipe kamar: yang disewakan unitnya, utuh.
   */
  APARTEMEN: {
    mode: "BOOKING",
    durasi: SEMUA_DURASI,
    durasiBawaan: "BULANAN",
    inventaris: "UNIT",
    tipeKamar: false,
    identitasUnit: true,
  },

  /**
   * Hotel & Villa — barang per malam. Diberi mode BOOKING karena polanya
   * identik dengan kos/apartemen harian: tanggal masuk–keluar berganti terus,
   * dan pertanyaan "kosong tanggal berapa?" muncul tiap minggu. Tahunan
   * sengaja TIDAK ada — villa yang disewakan setahun penuh sudah berhenti
   * jadi villa dan sebaiknya didaftarkan sebagai Rumah.
   */
  HOTEL_DAN_VILLA: {
    mode: "BOOKING",
    durasi: ["HARIAN", "MINGGUAN", "BULANAN"],
    durasiBawaan: "HARIAN",
    inventaris: "UNIT",
    tipeKamar: false,
    identitasUnit: false,
  },

  /**
   * Rumah sewa — di Indonesia praktis selalu kontrak tahunan, kadang bulanan.
   * Rumah yang disewakan per malam adalah homestay: kategorinya Hotel & Villa.
   */
  RUMAH: {
    mode: "NEGOSIASI",
    durasi: BULANAN_TAHUNAN,
    durasiBawaan: "TAHUNAN",
    inventaris: "UNIT",
    tipeKamar: false,
    identitasUnit: false,
  },

  RUKO: {
    mode: "NEGOSIASI",
    durasi: BULANAN_TAHUNAN,
    durasiBawaan: "TAHUNAN",
    inventaris: "UNIT",
    tipeKamar: false,
    identitasUnit: false,
  },

  TOKO: {
    mode: "NEGOSIASI",
    durasi: BULANAN_TAHUNAN,
    durasiBawaan: "TAHUNAN",
    inventaris: "UNIT",
    tipeKamar: false,
    identitasUnit: false,
  },

  GUDANG: {
    mode: "NEGOSIASI",
    durasi: BULANAN_TAHUNAN,
    durasiBawaan: "TAHUNAN",
    inventaris: "UNIT",
    tipeKamar: false,
    identitasUnit: false,
  },

  PABRIK: {
    mode: "NEGOSIASI",
    durasi: BULANAN_TAHUNAN,
    durasiBawaan: "TAHUNAN",
    inventaris: "UNIT",
    tipeKamar: false,
    identitasUnit: false,
  },

  /**
   * Tanah — sewa lahan dihitung per tahun, titik. Menawarkan tarif bulanan
   * untuk sebidang tanah hanya melahirkan angka yang harus dinegosiasikan
   * ulang dari nol begitu ada peminat.
   */
  TANAH: {
    mode: "NEGOSIASI",
    durasi: ["TAHUNAN"],
    durasiBawaan: "TAHUNAN",
    inventaris: "UNIT",
    tipeKamar: false,
    identitasUnit: false,
  },
};

/**
 * Dipakai saat kategori tidak dikenal — data lama, kiriman langsung ke API,
 * atau enum yang baru ditambah di DB tapi belum di sini.
 *
 * Sengaja yang paling membatasi: NEGOSIASI + bulanan/tahunan. Kategori tak
 * dikenal harus jatuh ke perilaku yang paling sedikit menjanjikan, bukan ke
 * panel pemesanan lengkap yang belum tentu ada artinya.
 */
const KAPABILITAS_BAWAAN: KapabilitasSewa = {
  mode: "NEGOSIASI",
  durasi: BULANAN_TAHUNAN,
  durasiBawaan: "TAHUNAN",
  inventaris: "UNIT",
  tipeKamar: false,
  identitasUnit: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// PEMBACAAN
// ─────────────────────────────────────────────────────────────────────────────

const normalKategori = (v: unknown): string =>
  String(v ?? "").trim().toUpperCase();

export function isKategoriProperti(v: unknown): v is KategoriProperti {
  return normalKategori(v) in KAPABILITAS_SEWA;
}

export function isDurasiSewaKey(v: unknown): v is DurasiSewaKey {
  return (DURASI_URUT_SEWA as readonly string[]).includes(
    String(v ?? "").trim().toUpperCase(),
  );
}

/** Kapabilitas kategori. Selalu mengembalikan sesuatu — lihat KAPABILITAS_BAWAAN. */
export function kapabilitasSewa(
  kategori: string | null | undefined,
): KapabilitasSewa {
  const k = normalKategori(kategori);
  return KAPABILITAS_SEWA[k as KategoriProperti] ?? KAPABILITAS_BAWAAN;
}

/** Durasi yang sah untuk kategori ini, urut dari terpendek. */
export function durasiSewaDiizinkan(
  kategori: string | null | undefined,
): DurasiSewaKey[] {
  return [...kapabilitasSewa(kategori).durasi];
}

export function durasiSewaSah(
  kategori: string | null | undefined,
  durasi: unknown,
): durasi is DurasiSewaKey {
  if (!isDurasiSewaKey(durasi)) return false;
  const d = String(durasi).trim().toUpperCase() as DurasiSewaKey;
  return kapabilitasSewa(kategori).durasi.includes(d);
}

export function modeSewa(kategori: string | null | undefined): ModeSewa {
  return kapabilitasSewa(kategori).mode;
}

/**
 * Kategori ini pakai panel pemesanan (tanggal, voucher, "Ajukan Sewa")?
 *
 * Kebalikannya bukan "tidak ada apa-apa": kategori NEGOSIASI mendapat panel
 * kontak — chat, ajukan penawaran, jadwalkan survei — persis seperti halaman
 * detail Jual & Lelang.
 */
export function punyaPanelPemesanan(
  kategori: string | null | undefined,
): boolean {
  return modeSewa(kategori) === "BOOKING";
}

/** Kategori yang boleh dipecah per tipe kamar (hari ini: hanya KOS). */
export function punyaTipeKamar(kategori: string | null | undefined): boolean {
  return kapabilitasSewa(kategori).tipeKamar;
}

/** Kategori yang punya identitas unit (hari ini: hanya APARTEMEN). */
export function punyaIdentitasUnit(
  kategori: string | null | undefined,
): boolean {
  return kapabilitasSewa(kategori).identitasUnit;
}

/** Daftar kategori dengan mode tertentu — dipakai turunan seperti kalender. */
export function kategoriDenganMode(mode: ModeSewa): KategoriProperti[] {
  return (Object.keys(KAPABILITAS_SEWA) as KategoriProperti[]).filter(
    (k) => KAPABILITAS_SEWA[k].mode === mode,
  );
}

/**
 * "bulanan atau tahunan" / "harian, mingguan, atau bulanan" — potongan kalimat
 * untuk pesan kesalahan. Pesan yang menyebut apa yang BOLEH selalu lebih
 * berguna daripada yang hanya menyebut apa yang salah.
 */
export function kalimatDurasiDiizinkan(
  kategori: string | null | undefined,
): string {
  const list = durasiSewaDiizinkan(kategori).map((d) => LABEL_DURASI[d]);
  if (list.length === 0) return "—";
  if (list.length === 1) return list[0];
  return `${list.slice(0, -1).join(", ")} atau ${list[list.length - 1]}`;
}

/** Kalimat penolakan siap pakai, sama bunyinya di form maupun API. */
export function pesanDurasiTidakSah(
  kategori: string | null | undefined,
): string {
  const nama = isKategoriProperti(kategori)
    ? LABEL_KATEGORI[normalKategori(kategori) as KategoriProperti]
    : "Kategori ini";
  return `${nama} hanya disewakan ${kalimatDurasiDiizinkan(kategori)}.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// NORMALISASI
// ─────────────────────────────────────────────────────────────────────────────

/** Peta harga per durasi, bentuk yang dipakai form, API, maupun halaman detail. */
export type HargaPerDurasi = Partial<
  Record<DurasiSewaKey, number | null | undefined>
>;

export interface HasilNormalisasi {
  /** Harga yang lolos: durasi terlarang jadi `null`, bukan hilang dari objek. */
  harga: Record<DurasiSewaKey, number | null>;
  /** Durasi yang harganya ditampilkan di card. null = tidak ada harga sama sekali. */
  durasiUtama: DurasiSewaKey | null;
  /** Angka untuk `Listing.harga` — harga pada `durasiUtama`. */
  hargaUtama: number | null;
  /** Durasi yang harganya dibuang karena tidak sah untuk kategori ini. */
  dibuang: DurasiSewaKey[];
  /** Durasi utama kiriman ditolak & diganti — form memakai ini untuk memberi tahu. */
  durasiUtamaDiganti: boolean;
}

/**
 * Prioritas pemilihan durasi utama saat agent belum memilih sendiri.
 *
 * Bulanan dulu karena itu angka yang paling mudah dibandingkan orang antar
 * listing; tahunan kedua karena itulah bentuk kontrak properti komersial.
 * Untuk kategori yang tidak menawarkan keduanya, `durasiBawaan` kategori yang
 * menang lebih dulu (villa → harian), jadi urutan ini hanya jaring terakhir.
 */
const PRIORITAS_DURASI: readonly DurasiSewaKey[] = [
  "BULANAN",
  "TAHUNAN",
  "MINGGUAN",
  "HARIAN",
] as const;

const angkaPositif = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Saring harga per durasi terhadap kategorinya, lalu pilih durasi utama yang
 * konsisten dengan hasil saringan itu.
 *
 * INI FUNGSI YANG MENJAGA SELURUH SISTEM TETAP JUJUR, dan ia dipanggil dari
 * empat lapis: form (saat kategori berubah), validator zod, perakit data tulis
 * di server, dan halaman detail saat membaca baris lama. Semua memakai aturan
 * yang sama karena semua memanggil fungsi yang sama.
 *
 * Perhatikan satu hal yang mudah terlewat: membuang harga saja tidak cukup.
 * Kalau `durasi_sewa` menunjuk durasi yang baru saja dibuang, `Listing.harga` —
 * kolom yang dipakai sortir & filter seluruh situs — akan tertinggal memegang
 * angka yang sumbernya sudah tidak ada. Karena itu durasi utama & harga utama
 * ikut dihitung ulang di sini, bukan di pemanggilnya.
 */
export function normalisasiHargaSewa(
  kategori: string | null | undefined,
  input: {
    harga: HargaPerDurasi;
    durasiUtama?: string | null;
  },
): HasilNormalisasi {
  const diizinkan = kapabilitasSewa(kategori).durasi;
  const bawaan = kapabilitasSewa(kategori).durasiBawaan;

  const harga = {} as Record<DurasiSewaKey, number | null>;
  const dibuang: DurasiSewaKey[] = [];

  for (const d of DURASI_URUT_SEWA) {
    const nilai = angkaPositif(input.harga[d]);
    if (diizinkan.includes(d)) {
      harga[d] = nilai;
    } else {
      harga[d] = null;
      if (nilai !== null) dibuang.push(d);
    }
  }

  const terisi = DURASI_URUT_SEWA.filter((d) => harga[d] !== null);

  const diminta = isDurasiSewaKey(input.durasiUtama)
    ? (String(input.durasiUtama).trim().toUpperCase() as DurasiSewaKey)
    : null;

  const dimintaSah = diminta !== null && terisi.includes(diminta);

  const durasiUtama: DurasiSewaKey | null = dimintaSah
    ? diminta
    : // Bawaan kategori dulu — untuk villa itu HARIAN, dan menjatuhkannya ke
      // BULANAN hanya karena urutan prioritas umum akan menampilkan harga
      // sebulan pada barang yang dijual per malam.
      terisi.includes(bawaan)
      ? bawaan
      : (PRIORITAS_DURASI.find((d) => terisi.includes(d)) ?? null);

  return {
    harga,
    durasiUtama,
    hargaUtama: durasiUtama ? harga[durasiUtama] : null,
    dibuang,
    durasiUtamaDiganti: diminta !== null && diminta !== durasiUtama,
  };
}

/**
 * Bentuk `{HARIAN: …}` → bentuk kolom DB `{harga_sewa_harian: …}`.
 * Dipakai perakit data tulis; dipisah supaya urusan nama kolom tidak bocor ke
 * logika pemilihan durasi di atas.
 */
export function keFieldHarga(
  harga: Record<DurasiSewaKey, number | null>,
): Record<FieldHargaDurasi, number | null> {
  return {
    harga_sewa_harian: harga.HARIAN,
    harga_sewa_mingguan: harga.MINGGUAN,
    harga_sewa_bulanan: harga.BULANAN,
    harga_sewa_tahunan: harga.TAHUNAN,
  };
}

/** Kebalikan `keFieldHarga` — baris DB/kiriman klien → bentuk `{HARIAN: …}`. */
export function dariFieldHarga(row: {
  harga_sewa_harian?: unknown;
  harga_sewa_mingguan?: unknown;
  harga_sewa_bulanan?: unknown;
  harga_sewa_tahunan?: unknown;
}): HargaPerDurasi {
  return {
    HARIAN: angkaPositif(row.harga_sewa_harian),
    MINGGUAN: angkaPositif(row.harga_sewa_mingguan),
    BULANAN: angkaPositif(row.harga_sewa_bulanan),
    TAHUNAN: angkaPositif(row.harga_sewa_tahunan),
  };
}

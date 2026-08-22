/**
 * Perakit judul listing — "biarkan mesin yang menulis judulnya".
 *
 * MASALAH YANG DISELESAIKAN. Judul adalah satu-satunya kalimat yang dibaca
 * Google dan satu-satunya kalimat yang dibaca calon pembeli di hasil pencarian.
 * Tapi menulis judul yang bagus adalah keahlian tersendiri, dan sebagian besar
 * agent bukan penulis: yang muncul adalah "Rumah Dijual Murah" atau "Kos
 * Surabaya" — tidak menyebut apa pun yang membuat aset ini berbeda, dan tidak
 * mengandung satu pun kata yang benar-benar diketik orang di Google.
 *
 * ATURAN YANG DIPEGANG MODUL INI:
 *
 * 1. JUDUL ADALAH SOAL LOKASI. Orang tidak mencari "kos 1,2 juta"; mereka
 *    mencari "kos dekat UNAIR". Yang menentukan keputusan pertama adalah di
 *    mana tempatnya dan dekat apa — harga baru dibandingkan setelah kandidat
 *    mengerucut, dan angkanya sudah tercetak besar di kartu listing maupun
 *    halaman detail. Menaruhnya lagi di judul memakan ruang kata kunci tanpa
 *    memberi tahu apa pun yang baru.
 *
 * 2. HARGA & JUMLAH KAMAR TIDAK PERNAH MASUK JUDUL — dan itu ditegakkan oleh
 *    BENTUK DATANYA, bukan oleh disiplin. `DataJudul` di bawah sengaja tidak
 *    punya satu pun field harga, sisa kamar, atau jumlah kamar: modul ini
 *    secara harfiah tidak bisa melihatnya. Aturan yang hanya ditulis di komentar
 *    akan dilanggar lagi enam bulan lagi; aturan yang tidak punya jalan masuk
 *    tidak bisa dilanggar.
 *
 * 3. TIDAK PERNAH MENGARANG. Setiap kata punya sumbernya di data yang diisi
 *    agent. "Strategis" hanya keluar kalau memang ada patokan di bawah 1 km;
 *    "Full Furnished" hanya kalau kondisi interiornya memang begitu; nama
 *    kampus hanya kalau kampus itu memang terdaftar sebagai patokan.
 *
 * 4. PANJANG DIJAGA 40–70 KARAKTER. Google memotong judul di ~60 karakter di
 *    desktop; di bawah 40 karakter biasanya berarti ada fakta pembeda yang
 *    belum disebut. Perakitnya membuang bagian paling tidak penting satu per
 *    satu sampai muat, bukan memotong di tengah kata.
 *
 * 5. TIGA SUDUT, BUKAN SATU. Yang sama bisa dijual lewat patokannya, lewat
 *    kata kunci daerahnya, atau seringkas mungkin. Agent memilih — mesin tidak
 *    memutuskan sendirian.
 */

import {
  KATEGORI_OPTIONS,
  TIPE_UNIT_LABEL,
  type AksesTerdekat,
  type JenisTransaksi,
  type KategoriProperti,
  type KosGender,
  type TipeUnit,
} from '@/app/tambah-property/types/listing';

// ---------------------------------------------------------------------------
// Bentuk data yang dibutuhkan
// ---------------------------------------------------------------------------

/**
 * Sengaja longgar (semua opsional, angka boleh string): sumbernya adalah form
 * yang sedang setengah terisi, dan judul memang harus bisa dirakit dari apa pun
 * yang sudah ada.
 *
 * Perhatikan apa yang TIDAK ada di sini: harga (dalam bentuk apa pun), nilai
 * limit lelang, jumlah kamar, sisa kamar, dan jumlah kamar tidur. Lihat aturan
 * 2 di kepala berkas — ketiadaannya disengaja dan bukan kelalaian.
 */
export interface DataJudul {
  jenis_transaksi?: JenisTransaksi | null;
  kategori?: KategoriProperti | null;

  kota?: string | null;
  kecamatan?: string | null;
  kelurahan?: string | null;

  luas_tanah?: number | string | null;
  luas_bangunan?: number | string | null;
  jumlah_lantai?: number | string | null;
  kondisi_interior?: string | null;
  legalitas?: string | null;

  /** Tanggal, bukan harga — tenggat lelang adalah fakta lokasi-waktu. */
  tanggal_lelang?: Date | string | null;

  // — Kos —
  kos_gender?: KosGender | null;
  kamar_mandi_tipe?: 'DALAM' | 'LUAR' | null;
  akses_24_jam?: boolean | null;
  /** CSV nama fasilitas kamar tingkat listing (dipakai saat tanpa tipe kamar). */
  fasilitas_kamar?: string | null;
  kamar_tipe?: {
    kamar_mandi_tipe?: 'DALAM' | 'LUAR' | null;
    fasilitas_kamar?: string | null;
  }[] | null;

  // — Apartemen —
  tipe_unit?: TipeUnit | null;
  nama_gedung?: string | null;

  akses_terdekat?: AksesTerdekat[] | null;
}

export interface KandidatJudul {
  id: 'lokasi' | 'kunci' | 'ringkas';
  gaya: string;
  /** Satu kalimat kenapa gaya ini dipakai — muncul di kartu pilihan. */
  alasan: string;
  teks: string;
  skor: number;
}

/** Panjang ideal: di bawah ini judul kurang bercerita, di atasnya dipotong Google. */
export const JUDUL_MIN = 40;
export const JUDUL_IDEAL_MAKS = 70;
/** Batas keras — sama dengan maxLength input & jauh di bawah batas kolom (255). */
export const JUDUL_MAKS = 100;

// ---------------------------------------------------------------------------
// Utilitas kecil
// ---------------------------------------------------------------------------

const angka = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const BULAN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

function tanggalSingkat(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getDate()} ${BULAN[d.getMonth()]}`;
}

/**
 * Buang potongan yang sudah muncul sebelumnya. Perakit menyusun bagian dari
 * sumber berbeda (kategori, patokan, area), dan bagian itu bisa memuat kata
 * yang sama — "Kos Putri Dekat Kos Muslimah" adalah hasil yang mungkin kalau
 * tidak dijaga di sini.
 */
function tanpaUlangan(bagian: string[]): string[] {
  const terpakai = new Set<string>();
  return bagian.filter((b) => {
    const kunci = b.trim().toLowerCase();
    if (!kunci || terpakai.has(kunci)) return false;
    terpakai.add(kunci);
    return true;
  });
}

/**
 * Rapikan spasi ganda & tanda baca menggantung.
 *
 * Hanya spasi sebelum KOMA yang dibuang. Em-dash & titik tengah justru wajib
 * berspasi di kedua sisinya ("Surabaya — 12 Mar", bukan "Surabaya— 12 Mar").
 */
function rapikan(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/[\s,·—]+$/g, '')
    .trim();
}

/** Potong di batas kata, bukan di tengah kata. */
function potongRapi(s: string, maks: number): string {
  if (s.length <= maks) return s;
  const potong = s.slice(0, maks);
  const spasi = potong.lastIndexOf(' ');
  return rapikan(spasi > maks * 0.6 ? potong.slice(0, spasi) : potong);
}

// ---------------------------------------------------------------------------
// Perakit: kepala + detil + lokasi + ekor
// ---------------------------------------------------------------------------

interface BahanJudul {
  /** Wajib ada, tidak pernah dibuang. Mis. "Dijual Rumah". */
  kepala: string;
  /** Fakta pembeda, urut dari yang paling penting. Dibuang dari belakang. */
  detil: string[];
  /** "di Rungkut, Surabaya". Dibuang paling akhir setelah detil & ekor habis. */
  lokasi?: string | null;
  /**
   * Versi lebih pendek dari lokasi ("di Rungkut" saja).
   *
   * Dicoba SEBELUM membuang detil apa pun. Tanpa jalan tengah ini, judul yang
   * kelebihan satu karakter akan mengorbankan nama kampusnya — hal paling
   * berharga di judul — demi mempertahankan nama kota yang sebenarnya boleh
   * dipersingkat tanpa kehilangan kata kunci tempat.
   */
  lokasiPendek?: string | null;
  /** Penutup setelah tanda pisah. Kini hanya dipakai jadwal lelang. */
  ekor?: string | null;
  /** Kalau true, ekor dipertahankan lebih lama daripada detil. */
  ekorPenting?: boolean;
  /**
   * Pemisah antar detil. Spasi untuk gaya kata kunci (rangkaian kata kunci
   * yang menyatu lebih cocok dengan cara orang mengetik di Google); koma untuk
   * gaya yang dibaca sebagai kalimat oleh manusia.
   */
  pemisahDetil?: ' ' | ', ';
}

function rakit(bahan: BahanJudul, maks = JUDUL_IDEAL_MAKS): string {
  const detil = tanpaUlangan(bahan.detil.filter(Boolean));
  const pemisah = bahan.pemisahDetil ?? ' ';

  const bentuk = (n: number, pakaiEkor: boolean, lokasiRingkas = false) => {
    const potongan = [bahan.kepala, ...detil.slice(0, n)].filter(Boolean);
    // Detil PERTAMA selalu menempel ke kepala dengan spasi — "Rumah, Full
    // Furnished" terbaca seperti daftar yang terputus, sedangkan "Rumah Full
    // Furnished" adalah satu sebutan utuh. Koma baru berguna sebagai pemisah
    // antar detil berikutnya.
    const inti =
      potongan.length > 1
        ? `${potongan[0]} ${potongan.slice(1).join(pemisah)}`
        : (potongan[0] ?? '');
    const tempat =
      (lokasiRingkas ? bahan.lokasiPendek : null) ?? bahan.lokasi ?? null;
    const denganLokasi = tempat ? `${inti} di ${tempat}` : inti;
    return rapikan(
      pakaiEkor && bahan.ekor ? `${denganLokasi} — ${bahan.ekor}` : denganLokasi,
    );
  };

  // Urutan pengorbanan: detil paling belakang dulu, lalu ekor (atau sebaliknya
  // kalau ekornya justru inti pesannya), lalu lokasi sebagai upaya terakhir.
  const percobaan: string[] = [];
  for (let n = detil.length; n >= 0; n--) {
    percobaan.push(bentuk(n, true));
    percobaan.push(bentuk(n, true, true));
    if (!bahan.ekorPenting) {
      percobaan.push(bentuk(n, false));
      percobaan.push(bentuk(n, false, true));
    }
  }
  if (bahan.ekorPenting) {
    for (let n = detil.length; n >= 0; n--) {
      percobaan.push(bentuk(n, false));
      percobaan.push(bentuk(n, false, true));
    }
  }

  const muat = percobaan.find((t) => t.length <= maks);
  if (muat) return muat;

  // Semua varian masih kepanjangan (lokasi + kepala saja sudah lewat batas):
  // dipotong di batas kata, bukan ditolak — judul tetap harus ada.
  return potongRapi(percobaan[percobaan.length - 1], JUDUL_MAKS);
}

// ---------------------------------------------------------------------------
// Pembacaan fakta dari data form
// ---------------------------------------------------------------------------

const labelKategori = (k?: KategoriProperti | null): string =>
  KATEGORI_OPTIONS.find((o) => o.value === k)?.label ?? 'Properti';

const GENDER_LABEL: Record<KosGender, string> = {
  PUTRA: 'Putra',
  PUTRI: 'Putri',
  CAMPUR: 'Campur',
};

/** "Rungkut, Surabaya" — kecamatan dulu (kata kunci pencarian), lalu kota. */
function areaJudul(d: DataJudul): string | null {
  const kota = d.kota?.trim();
  const kec = d.kecamatan?.trim();
  if (kec && kota) {
    // "Surabaya, Surabaya" terjadi di kota yang kecamatannya senama.
    return kec.toLowerCase() === kota.toLowerCase() ? kota : `${kec}, ${kota}`;
  }
  return kec || kota || null;
}

/** Versi pendek: kecamatan saja kalau ada. Dipakai saat ruangnya sempit. */
function areaPendek(d: DataJudul): string | null {
  return d.kecamatan?.trim() || d.kota?.trim() || null;
}

/** Nama unit properti untuk judul: "Kos Putri", "Apartemen 2BR", "Rumah". */
function namaUnit(d: DataJudul): string {
  const dasar = labelKategori(d.kategori);
  if (d.kategori === 'KOS' && d.kos_gender) {
    return `Kos ${GENDER_LABEL[d.kos_gender]}`;
  }
  // "2BR" adalah NAMA tipe unit di pasar apartemen (cara orang mengetik
  // pencariannya), bukan cacahan kamar listing ini — karena itu ia tetap ada
  // meski jumlah kamar sebagai angka sudah dibuang dari seluruh modul.
  if (d.kategori === 'APARTEMEN' && d.tipe_unit) {
    return `Apartemen ${TIPE_UNIT_LABEL[d.tipe_unit]}`;
  }
  return dasar;
}

/**
 * Bobot patokan untuk judul.
 *
 * KAMPUS diberi bobot jauh di atas yang lain, dan itu bukan selera: untuk kos —
 * kategori terbesar di sistem ini — nama kampus PERSIS kata kunci yang diketik
 * penyewanya ("kos dekat UNAIR"), dan seringkali satu-satunya alasan sebuah kos
 * dilirik. Minimarket di seberang jalan tidak pernah jadi alasan siapa pun
 * memilih tempat tinggal.
 */
const BOBOT_PATOKAN: Record<string, number> = {
  KAMPUS: 12,
  SEKOLAH: 6,
  STASIUN: 5,
  RUMAH_SAKIT: 4,
  PERKANTORAN: 4,
  MALL: 4,
  BANDARA: 3,
  HALTE: 2,
  PASAR: 2,
  MASJID: 1,
  MINIMARKET: 1,
  LAINNYA: 0,
};

/** Nama patokan yang lebih panjang dari ini akan memakan seluruh sisa judul. */
const MAKS_NAMA_PATOKAN = 26;

/**
 * Patokan paling layak disebut, terurut dari yang paling kuat.
 *
 * Diekspor karena route penyusun judul AI memakainya juga: mengirim seluruh
 * patokan ke model (bisa 40+ untuk satu titik di kota) bukan cuma boros token,
 * tapi menenggelamkan yang penting di antara puluhan halte dan posyandu —
 * dan model yang kehilangan pegangan akan meraih nama tempat terkenal yang ia
 * ingat dari pelatihannya, bukan yang ada di daftar.
 */
export function patokanTerpilih(
  d: DataJudul,
  maks = 2,
  maksPanjangNama = MAKS_NAMA_PATOKAN,
): AksesTerdekat[] {
  const daftar = (d.akses_terdekat ?? []).filter(
    (a) => a?.nama?.trim() && a.nama.trim().length <= maksPanjangNama,
  );
  if (daftar.length === 0) return [];

  const nilai = (a: AksesTerdekat) => {
    const bobot = BOBOT_PATOKAN[a.tipe] ?? 0;
    // Dekat itu bagian dari nilainya: kampus 8 km bukan alasan siapa pun.
    const dekat =
      a.jarak == null
        ? 1
        : a.satuan === 'KM'
          ? a.jarak <= 1
            ? 3
            : a.jarak <= 3
              ? 2
              : 0
          : a.jarak <= 10
            ? 3
            : a.jarak <= 20
              ? 1
              : 0;
    // Nama pendek menang: "UNAIR" menyisakan ruang untuk daerah & ciri,
    // "Universitas Airlangga Kampus C" tidak.
    const ringkas = a.nama.trim().length <= 14 ? 2 : a.nama.trim().length <= 20 ? 1 : 0;
    return bobot * 4 + dekat * 2 + ringkas;
  };

  return [...daftar].sort((a, b) => nilai(b) - nilai(a)).slice(0, maks);
}

/**
 * "Dekat UNAIR & ITS" · "5 Menit ke UNAIR" · "Dekat Stasiun Gubeng".
 *
 * Dua patokan digabung kalau muat, karena dua nama kampus adalah alasan yang
 * dua kali lebih kuat — dan itu tetap satu frasa, bukan dua fakta terpisah.
 */
function frasaDekat(d: DataJudul, maksPatokan = 2): string | null {
  const p = patokanTerpilih(d, maksPatokan);
  if (p.length === 0) return null;

  const nama = p.map((x) => x.nama.trim());

  if (nama.length === 1) {
    const a = p[0];
    // Menit lebih meyakinkan daripada "dekat" karena bisa dibayangkan —
    // tapi hanya kalau angkanya memang masuk akal untuk jalan kaki/motor.
    if (a.jarak != null && a.satuan === 'MENIT' && a.jarak <= 15) {
      return `${a.jarak} Menit ke ${nama[0]}`;
    }
    return `Dekat ${nama[0]}`;
  }

  const gabung = `${nama[0]} & ${nama[1]}`;
  return gabung.length <= 30 ? `Dekat ${gabung}` : `Dekat ${nama[0]}`;
}

/** Ada patokan terukur di bawah 1 km / 10 menit → kata "Strategis" punya dasar. */
function memangStrategis(d: DataJudul): boolean {
  return (d.akses_terdekat ?? []).some((a) => {
    if (!a?.nama?.trim() || a.jarak == null) return false;
    return a.satuan === 'KM' ? a.jarak <= 1 : a.jarak <= 10;
  });
}

/** Jenis kamar mandi yang berlaku untuk seluruh kos (kalau seragam). */
function kamarMandiKos(d: DataJudul): 'DALAM' | 'LUAR' | null {
  const tipe = d.kamar_tipe ?? [];
  if (tipe.length > 0) {
    const nilai = tipe.map((t) => t.kamar_mandi_tipe ?? null);
    if (nilai.some((v) => v === null)) return null;
    return nilai.every((v) => v === nilai[0]) ? nilai[0] : null;
  }
  return d.kamar_mandi_tipe ?? null;
}

/**
 * Fasilitas yang dimiliki SEMUA kamar (irisan antar tipe).
 *
 * Irisan, bukan gabungan: judul yang menjanjikan AC padahal hanya 2 dari 10
 * kamar yang punya adalah janji yang dibantah saat survei.
 */
function fasilitasSemuaKamar(d: DataJudul): string[] {
  const pisah = (raw?: string | null) =>
    (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  const tipe = d.kamar_tipe ?? [];
  if (tipe.length === 0) return pisah(d.fasilitas_kamar);

  const perTipe = tipe.map((t) => pisah(t.fasilitas_kamar));
  if (perTipe.length === 0) return [];
  return perTipe[0].filter((nama) =>
    perTipe.every((daftar) => daftar.some((x) => x.toLowerCase() === nama.toLowerCase())),
  );
}

/** "Full Furnished" / "Semi Furnished" — apa adanya, tanpa dilebihkan. */
function frasaInterior(d: DataJudul): string | null {
  const k = d.kondisi_interior?.trim().toLowerCase();
  if (!k) return null;
  if (k.includes('fully')) return 'Full Furnished';
  if (k.includes('semi')) return 'Semi Furnished';
  return null;
}

/**
 * Ciri khas kos yang layak masuk judul — semuanya sifat, bukan angka.
 * Urut dari yang paling sering jadi penentu saat memilih kos.
 */
function ciriKos(d: DataJudul): string[] {
  const fasilitas = fasilitasSemuaKamar(d).map((f) => f.toLowerCase());
  return [
    kamarMandiKos(d) === 'DALAM' ? 'Kamar Mandi Dalam' : null,
    fasilitas.includes('ac') ? 'AC' : null,
    d.akses_24_jam === true ? 'Akses 24 Jam' : null,
    memangStrategis(d) ? 'Strategis' : null,
  ].filter(Boolean) as string[];
}

// ---------------------------------------------------------------------------
// Perakitan per jenis transaksi
// ---------------------------------------------------------------------------

const ALASAN = {
  lokasi:
    'Dipimpin patokan terdekat — inilah yang benar-benar diketik orang saat mencari ("dekat kampus X").',
  kunci:
    'Nama daerah + ciri khas properti. Susunan yang paling cocok dengan kata kunci pencarian lokal.',
  ringkas:
    'Pendek dan langsung — paling terbaca di layar HP dan di judul tab browser.',
} as const;

function kandidatKos(d: DataJudul): Omit<KandidatJudul, 'skor'>[] {
  const unit = namaUnit(d); // "Kos Putri"
  const area = areaJudul(d);
  const dekat = frasaDekat(d);
  const ciri = ciriKos(d);

  return [
    {
      id: 'lokasi',
      gaya: 'Dekat Kampus',
      alasan: ALASAN.lokasi,
      teks: rakit({
        kepala: unit,
        detil: [dekat, ciri[0]].filter(Boolean) as string[],
        lokasi: area,
        lokasiPendek: areaPendek(d),
        pemisahDetil: ', ',
      }),
    },
    {
      id: 'kunci',
      gaya: 'Kata Kunci',
      alasan: ALASAN.kunci,
      teks: rakit({
        kepala: unit,
        detil: ciri,
        lokasi: area,
        pemisahDetil: ', ',
      }),
    },
    {
      id: 'ringkas',
      gaya: 'Ringkas',
      alasan: ALASAN.ringkas,
      teks: rakit(
        {
          kepala: unit,
          detil: [dekat ?? ciri[0]].filter(Boolean) as string[],
          lokasi: areaPendek(d),
        },
        58,
      ),
    },
  ];
}

function kandidatSewaLain(d: DataJudul): Omit<KandidatJudul, 'skor'>[] {
  const unit = namaUnit(d);
  const area = areaJudul(d);
  const dekat = frasaDekat(d);
  const interior = frasaInterior(d);
  const lb = angka(d.luas_bangunan);
  const gedung = d.nama_gedung?.trim();

  return [
    {
      id: 'lokasi',
      gaya: 'Dekat Patokan',
      alasan: ALASAN.lokasi,
      teks: rakit({
        kepala: `Disewakan ${unit}`,
        detil: [dekat, interior].filter(Boolean) as string[],
        lokasi: area,
        lokasiPendek: areaPendek(d),
        pemisahDetil: ', ',
      }),
    },
    {
      id: 'kunci',
      gaya: 'Kata Kunci',
      alasan: ALASAN.kunci,
      teks: rakit({
        kepala: `Disewakan ${unit}`,
        detil: [interior, lb ? `${lb} m²` : null].filter(Boolean) as string[],
        lokasi: gedung && gedung.length <= 24 ? `${gedung}, ${d.kota ?? ''}`.replace(/,\s*$/, '') : area,
        pemisahDetil: ', ',
      }),
    },
    {
      id: 'ringkas',
      gaya: 'Ringkas',
      alasan: ALASAN.ringkas,
      teks: rakit(
        {
          kepala: `Sewa ${unit}`,
          detil: [interior].filter(Boolean) as string[],
          lokasi: area,
        },
        58,
      ),
    },
  ];
}

function kandidatLelang(d: DataJudul): Omit<KandidatJudul, 'skor'>[] {
  const unit = namaUnit(d);
  const area = areaJudul(d);
  const dekat = frasaDekat(d, 1);
  const tgl = tanggalSingkat(d.tanggal_lelang);
  const lt = angka(d.luas_tanah);
  const lb = angka(d.luas_bangunan);

  return [
    {
      id: 'lokasi',
      gaya: 'Dekat Patokan',
      alasan: ALASAN.lokasi,
      teks: rakit({
        kepala: `Lelang ${unit}`,
        detil: [dekat, d.legalitas ? String(d.legalitas) : null].filter(
          Boolean,
        ) as string[],
        lokasi: area,
        lokasiPendek: areaPendek(d),
        pemisahDetil: ', ',
      }),
    },
    {
      id: 'kunci',
      gaya: 'Kata Kunci',
      alasan: ALASAN.kunci,
      teks: rakit({
        kepala: `Lelang ${unit}`,
        detil: [
          d.legalitas ? String(d.legalitas) : null,
          lt ? `LT ${lt} m²` : null,
          lb ? `LB ${lb} m²` : null,
        ].filter(Boolean) as string[],
        lokasi: area,
      }),
    },
    {
      id: 'ringkas',
      gaya: 'Jadwal',
      alasan:
        'Tanggal lelang di judul menciptakan tenggat yang nyata — pembaca tahu ini tidak bisa ditunda.',
      teks: rakit({
        kepala: `Lelang ${unit}`,
        detil: [d.legalitas ? String(d.legalitas) : null].filter(Boolean) as string[],
        lokasi: area,
        ekor: tgl,
        ekorPenting: true,
      }),
    },
  ];
}

function kandidatJual(d: DataJudul): Omit<KandidatJudul, 'skor'>[] {
  const unit = namaUnit(d);
  const area = areaJudul(d);
  const dekat = frasaDekat(d);
  const interior = frasaInterior(d);
  const lt = angka(d.luas_tanah);
  const lb = angka(d.luas_bangunan);
  const lantai = angka(d.jumlah_lantai);

  return [
    {
      id: 'lokasi',
      gaya: 'Dekat Patokan',
      alasan: ALASAN.lokasi,
      teks: rakit({
        kepala: `Dijual ${unit}`,
        detil: [
          dekat,
          interior,
          !dekat && memangStrategis(d) ? 'Strategis' : null,
        ].filter(Boolean) as string[],
        lokasi: area,
        lokasiPendek: areaPendek(d),
        pemisahDetil: ', ',
      }),
    },
    {
      id: 'kunci',
      gaya: 'Kata Kunci',
      alasan: ALASAN.kunci,
      teks: rakit({
        kepala: `Dijual ${unit}`,
        detil: [
          d.legalitas ? String(d.legalitas) : null,
          lt ? `LT ${lt} m²` : null,
          lb ? `LB ${lb} m²` : null,
        ].filter(Boolean) as string[],
        lokasi: area,
      }),
    },
    {
      id: 'ringkas',
      gaya: 'Ringkas',
      alasan: ALASAN.ringkas,
      teks: rakit(
        {
          kepala: unit,
          detil: [
            interior,
            d.legalitas ? String(d.legalitas) : null,
            lantai && lantai > 1 ? `${lantai} Lantai` : null,
          ].filter(Boolean) as string[],
          lokasi: area,
        },
        58,
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// Pintu masuk
// ---------------------------------------------------------------------------

/**
 * Data minimum supaya judul yang dirakit tidak terdengar kosong: tanpa
 * kategori & kota, yang keluar hanya "Properti di —".
 */
export function bisaRakitJudul(d: DataJudul): boolean {
  return !!d.kategori && !!(d.kota?.trim() || d.kecamatan?.trim());
}

export function susunKandidatJudul(d: DataJudul): KandidatJudul[] {
  if (!bisaRakitJudul(d)) return [];

  const mentah =
    d.jenis_transaksi === 'SEWA'
      ? d.kategori === 'KOS'
        ? kandidatKos(d)
        : kandidatSewaLain(d)
      : d.jenis_transaksi === 'LELANG'
        ? kandidatLelang(d)
        : kandidatJual(d);

  // Dua gaya bisa menghasilkan kalimat yang sama persis saat datanya minim —
  // menampilkan dua kartu identik membuat agent mengira ada yang rusak.
  const terlihat = new Set<string>();
  return mentah
    .map((k) => ({ ...k, teks: rapikan(k.teks) }))
    .filter((k) => {
      const kunci = k.teks.toLowerCase();
      if (!k.teks || terlihat.has(kunci)) return false;
      terlihat.add(kunci);
      return true;
    })
    .map((k) => ({ ...k, skor: nilaiJudul(k.teks, d).skor }));
}

export interface PenilaianJudul {
  skor: number;
  tips: string[];
  /** Rincian per kriteria — dipakai untuk menandai mana yang sudah terpenuhi. */
  kriteria: { label: string; lulus: boolean }[];
}

/**
 * Penilaian judul, dihitung dari DATA properti ini — bukan dari daftar kota &
 * kata sifat yang ditulis tetap di dalam kode. Versi lama hanya mengenali 10
 * kota, sehingga judul yang benar untuk Sidoarjo atau Gresik selalu kehilangan
 * seperempat nilainya tanpa alasan yang bisa dijelaskan ke agent.
 */
export function nilaiJudul(judul: string, d: DataJudul): PenilaianJudul {
  const teks = (judul ?? '').trim();
  const kecil = teks.toLowerCase();
  const tips: string[] = [];

  const panjangPas = teks.length >= JUDUL_MIN && teks.length <= JUDUL_IDEAL_MAKS;
  if (!panjangPas) {
    tips.push(
      teks.length < JUDUL_MIN
        ? `Terlalu pendek (${teks.length}). Tambahkan patokan terdekat atau ciri khas propertinya.`
        : `Terlalu panjang (${teks.length}). Google memotong judul di sekitar ${JUDUL_IDEAL_MAKS} karakter.`,
    );
  }

  const daerah = [d.kota, d.kecamatan, d.kelurahan]
    .map((x) => x?.trim().toLowerCase())
    .filter(Boolean) as string[];
  const adaLokasi = daerah.some((x) => kecil.includes(x));
  if (!adaLokasi && daerah.length > 0) {
    tips.push(
      `Sebut nama daerahnya (${d.kecamatan?.trim() || d.kota?.trim()}) — hampir semua pencarian properti memakai nama tempat.`,
    );
  }

  const labelJenis = labelKategori(d.kategori).toLowerCase();
  const adaJenis =
    kecil.includes(labelJenis) ||
    (d.kategori === 'HOTEL_DAN_VILLA' &&
      (kecil.includes('hotel') || kecil.includes('villa')));
  if (!adaJenis && d.kategori) {
    tips.push(
      `Sertakan jenis propertinya ("${labelKategori(d.kategori)}") supaya cocok dengan kata yang diketik pencari.`,
    );
  }

  /**
   * Kriteria keempat: judul menyebut PATOKAN atau CIRI KHAS.
   *
   * Menggantikan kriteria lama "memuat angka konkret", yang lahir dari era
   * ketika judul boleh menyebut harga & jumlah kamar. Sekarang keduanya tidak
   * pernah masuk judul, jadi menuntut angka berarti menuntut hal yang tidak
   * bisa dipenuhi — dan itu membuat skor selalu mentok di 75%.
   */
  const penanda = [
    ...(d.akses_terdekat ?? [])
      .map((a) => a?.nama?.trim().toLowerCase())
      .filter(Boolean) as string[],
    ...ciriKos(d).map((c) => c.toLowerCase()),
    frasaInterior(d)?.toLowerCase(),
    d.legalitas ? String(d.legalitas).toLowerCase() : null,
  ].filter(Boolean) as string[];

  const adaPenanda = penanda.some((p) => kecil.includes(p));
  const bisaAdaPenanda = penanda.length > 0;
  if (!adaPenanda && bisaAdaPenanda) {
    tips.push(
      'Sebut satu patokan terdekat (kampus/stasiun/mall) atau satu ciri khas — itu yang membedakan listing ini dari puluhan lain di daerah yang sama.',
    );
  } else if (!bisaAdaPenanda) {
    tips.push(
      'Isi patokan terdekat di langkah Lokasi — nama kampus atau stasiun di judul adalah kata kunci terkuat untuk properti.',
    );
  }

  const kriteria = [
    { label: `Panjang ${JUDUL_MIN}–${JUDUL_IDEAL_MAKS} karakter`, lulus: panjangPas },
    { label: 'Menyebut nama daerah', lulus: adaLokasi },
    { label: 'Menyebut jenis properti', lulus: adaJenis },
    { label: 'Menyebut patokan / ciri khas', lulus: adaPenanda },
  ];

  const skor = teks
    ? Math.round((kriteria.filter((k) => k.lulus).length / kriteria.length) * 100)
    : 0;

  return { skor, tips, kriteria };
}

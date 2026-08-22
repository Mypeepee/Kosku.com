/**
 * Kosakata & normalisasi kamus tempat — dipakai BERSAMA oleh server, skrip
 * backfill, dan browser. Tidak ada pengambilan data di file ini.
 *
 * Masalah yang dipecahkannya: orang tidak mengetik nama resmi. Yang diketik
 * adalah "deket unesa", "dket rs.soetomo", "sekitaran tunjungan plasa". Tiga
 * hal harus dilakukan sebelum string seperti itu bisa dicocokkan ke apa pun:
 *
 *   1. Buang kata "dekat"-nya. Ia bukan bagian dari nama tempat, tapi ia
 *      SINYAL — bedanya "unesa" dan "deket unesa" adalah niat, dan niat itu
 *      yang menentukan halaman hasil menampilkan chip "Dekat UNESA" atau tidak.
 *   2. Ratakan bentuknya. Huruf besar-kecil, titik, koma, gelar ("Dr."),
 *      dan spasi ganda semuanya derau.
 *   3. Ratakan ejaan yang memang dua-duanya dipakai orang Indonesia:
 *      plaza/plasa, apotek/apotik, univ/universitas.
 *
 * Yang TIDAK bisa dipecahkan di sini: "UNESA" ↔ "Universitas Negeri Surabaya".
 * Dua string itu tidak punya kemiripan trigram sama sekali, jadi tidak ada
 * fungsi normalisasi yang bisa menyatukannya. Itu urusan tabel `tempat_alias`
 * — lihat alias-kuratif.ts.
 */

// ─────────────────────────────────────────────────────────────────────────────
// KELAS TEMPAT
// ─────────────────────────────────────────────────────────────────────────────

export type KelasTempat =
  | "KAMPUS"
  | "SEKOLAH"
  | "RUMAH_SAKIT"
  | "KLINIK"
  | "MALL"
  | "PASAR"
  | "MINIMARKET"
  | "STASIUN"
  | "TERMINAL"
  | "BANDARA"
  | "HALTE"
  | "STADION"
  | "WISATA"
  | "PERKANTORAN"
  | "KULINER"
  | "IBADAH"
  | "GYM"
  | "HOTEL"
  | "LAUNDRY"
  | "LAINNYA";

/**
 * Seberapa jauh sebuah kelas masih pantas disebut "dekat".
 *
 * Pembagiannya bukan angka asal, melainkan pertanyaan "orang ke sana naik apa".
 *
 *   HARIAN   — didatangi jalan kaki, tiap hari. Minimarket 2 km bukan
 *              "minimarket saya"; itu minimarket yang kebetulan ada di kota
 *              yang sama.
 *   LANDMARK — didatangi berkendara, terjadwal. Kampus 4 km justru KHAS: tidak
 *              ada mahasiswa yang menolak kos karena kampusnya 4 km, dan
 *              memaksa radius 800 m untuk kampus membuang hampir semua jawaban
 *              yang benar.
 *
 * Angka ini menentukan dua hal sekaligus: seberapa lebar pemindai menyapu saat
 * mengisi kamus, dan radius bawaan saat orang mencari "dekat X".
 */
export type Jangkauan = "LANDMARK" | "HARIAN";

export const RADIUS_JANGKAUAN: Record<Jangkauan, number> = {
  LANDMARK: 5_000,
  HARIAN: 1_200,
};

export interface KonfigKelas {
  label: string;
  icon: string;
  warna: string;
  jangkauan: Jangkauan;
  /**
   * Dipakai saat dua sumber melaporkan kelas berbeda untuk tempat yang sama.
   * Pemindaian 800 m tidak membedakan rumah sakit dari klinik (keduanya
   * "health"), sedangkan sapuan landmark membedakannya — jadi RSUD Dr Soetomo
   * bisa masuk sebagai KLINIK lebih dulu. Yang lebih spesifik menang, karena
   * "Klinik Dr Soetomo" salah di layar sedangkan "RS Dr Soetomo" benar.
   */
  bobot: number;
}

export const KELAS_TEMPAT: Record<KelasTempat, KonfigKelas> = {
  KAMPUS:      { label: "Kampus",        icon: "solar:square-academic-cap-bold-duotone", warna: "#8b5cf6", jangkauan: "LANDMARK", bobot: 90 },
  RUMAH_SAKIT: { label: "Rumah Sakit",   icon: "solar:hospital-bold-duotone",            warna: "#ef4444", jangkauan: "LANDMARK", bobot: 88 },
  BANDARA:     { label: "Bandara",       icon: "solar:plane-bold-duotone",               warna: "#0ea5e9", jangkauan: "LANDMARK", bobot: 86 },
  STASIUN:     { label: "Stasiun",       icon: "solar:tram-bold-duotone",                warna: "#0284c7", jangkauan: "LANDMARK", bobot: 84 },
  MALL:        { label: "Mall",          icon: "solar:shop-2-bold-duotone",              warna: "#a855f7", jangkauan: "LANDMARK", bobot: 82 },
  TERMINAL:    { label: "Terminal",      icon: "solar:bus-bold-duotone",                 warna: "#0891b2", jangkauan: "LANDMARK", bobot: 80 },
  STADION:     { label: "Stadion",       icon: "solar:basketball-bold-duotone",          warna: "#22c55e", jangkauan: "LANDMARK", bobot: 78 },
  SEKOLAH:     { label: "Sekolah",       icon: "solar:diploma-bold-duotone",             warna: "#3b82f6", jangkauan: "LANDMARK", bobot: 76 },
  PASAR:       { label: "Pasar",         icon: "solar:cart-large-bold-duotone",          warna: "#eab308", jangkauan: "LANDMARK", bobot: 74 },
  WISATA:      { label: "Wisata",        icon: "solar:camera-bold-duotone",              warna: "#14b8a6", jangkauan: "LANDMARK", bobot: 72 },
  PERKANTORAN: { label: "Perkantoran",   icon: "solar:buildings-2-bold-duotone",         warna: "#64748b", jangkauan: "LANDMARK", bobot: 70 },

  KLINIK:      { label: "Klinik/Apotek", icon: "solar:health-bold-duotone",              warna: "#f43f5e", jangkauan: "HARIAN",   bobot: 50 },
  KULINER:     { label: "Kuliner",       icon: "solar:chef-hat-bold-duotone",            warna: "#f97316", jangkauan: "HARIAN",   bobot: 48 },
  MINIMARKET:  { label: "Minimarket",    icon: "solar:shop-bold-duotone",                warna: "#16a34a", jangkauan: "HARIAN",   bobot: 46 },
  HALTE:       { label: "Halte",         icon: "solar:bus-bold-duotone",                 warna: "#38bdf8", jangkauan: "HARIAN",   bobot: 44 },
  GYM:         { label: "Gym",           icon: "solar:dumbbell-large-bold-duotone",      warna: "#2563eb", jangkauan: "HARIAN",   bobot: 42 },
  HOTEL:       { label: "Hotel",         icon: "solar:bed-bold-duotone",                 warna: "#d946ef", jangkauan: "HARIAN",   bobot: 40 },
  IBADAH:      { label: "Tempat Ibadah", icon: "mdi:hands-pray",                         warna: "#7c3aed", jangkauan: "HARIAN",   bobot: 38 },
  LAUNDRY:     { label: "Laundry",       icon: "solar:washing-machine-bold-duotone",     warna: "#06b6d4", jangkauan: "HARIAN",   bobot: 36 },
  LAINNYA:     { label: "Tempat",        icon: "solar:map-point-bold-duotone",           warna: "#94a3b8", jangkauan: "HARIAN",   bobot: 10 },
};

export const adalahKelas = (v: unknown): v is KelasTempat =>
  typeof v === "string" && v in KELAS_TEMPAT;

export const jangkauanKelas = (kelas: KelasTempat): Jangkauan =>
  KELAS_TEMPAT[kelas].jangkauan;

/** Yang lebih spesifik menang — lihat catatan `bobot`. */
export function kelasTerbaik(a: KelasTempat, b: KelasTempat): KelasTempat {
  return KELAS_TEMPAT[a].bobot >= KELAS_TEMPAT[b].bobot ? a : b;
}

// ─────────────────────────────────────────────────────────────────────────────
// NORMALISASI TEKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bentuk dasar: huruf kecil, tanpa diakritik, tanda baca jadi spasi.
 *
 * Titik diperlakukan sebagai pemisah, bukan dibuang — "rs.soetomo" harus
 * menjadi "rs soetomo", bukan "rssoetomo". Ini lazim pada data hasil scrape
 * risalah lelang yang spasinya sering hilang setelah singkatan.
 */
export function normalTeks(s: string | null | undefined): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Gelar & sapaan yang selalu ikut tertulis di papan nama tapi tidak pernah
 * diketik pencari. "RSUD Dr. Soetomo" dicari sebagai "rs soetomo".
 *
 * `dr` sengaja ikut walau berisiko kecil (ada tempat bernama "Dr" sungguhan):
 * hampir seluruh rumah sakit besar Indonesia memakainya, dan hampir tidak ada
 * yang mengetiknya.
 */
/**
 * "st" sengaja TIDAK ada di sini walau ia gelar (S.T.). Ia juga singkatan
 * "Stasiun" dan "Sekolah Tinggi", dan membuangnya sebagai gelar membuat
 * "Stasiun Gubeng" kehilangan kata pertamanya lalu gagal menghasilkan alias
 * "gubeng" — nama yang justru paling sering diketik orang. Gelar yang menempel
 * di nama tempat praktis tidak pernah "S.T.".
 */
const GELAR = new Set([
  "dr", "drs", "dra", "prof", "ir", "kh", "hj", "haji", "raden", "rd",
  "mm", "spd", "letjen", "mayjen", "brigjen", "jend", "jenderal",
]);

/** Kata sambung yang tidak pernah diketik dan tidak menambah pembeda apa pun. */
const KATA_SAMBUNG = new Set(["dan", "di", "ke", "the", "of", "yang"]);

/**
 * Ejaan yang dua-duanya hidup di Indonesia. Diratakan ke satu sisi supaya
 * "tunjungan plasa" dan "tunjungan plaza" jadi string yang sama persis —
 * pencocokan trigram saja tidak cukup di sini karena keduanya cuma beda satu
 * huruf di kata KEDUA, sementara kata pertamanya panjang dan menenggelamkan
 * bedanya… atau justru sebaliknya pada nama pendek.
 *
 * Yang panjang juga diringkas ke bentuk pendek ("universitas" → "univ") karena
 * bentuk pendeklah yang lebih sering diketik, dan meringkas tidak pernah
 * kehilangan informasi ke arah yang salah.
 */
const EJAAN: Array<[RegExp, string]> = [
  [/\bplaza\b/g, "plasa"],
  [/\bapotik\b/g, "apotek"],
  [/\buniversitas\b/g, "univ"],
  [/\bpoliteknik\b/g, "poltek"],
  [/\brumah sakit\b/g, "rs"],
  [/\bpuskesmas\b/g, "pkm"],
  [/\bterminal\b/g, "term"],
  [/\bbandar udara\b/g, "bandara"],
  [/\bpusat perbelanjaan\b/g, "mall"],
  [/\bmal\b/g, "mall"],
  [/\bkecamatan\b/g, "kec"],
  [/\bkelurahan\b/g, "kel"],
  [/\bperumahan\b/g, "perum"],
  [/\bjalan\b/g, "jl"],
];

/**
 * Bentuk yang benar-benar dicocokkan: bentuk dasar, gelar & kata sambung
 * dibuang, ejaan diratakan.
 *
 * Dipakai untuk KEDUA sisi — nama tempat saat disimpan, dan kueri saat dicari.
 * Wajib satu fungsi yang sama: dua fungsi yang "kurang lebih sama" adalah cara
 * paling andal membuat pencarian gagal pada kasus yang tidak pernah diuji.
 */
export function normalNama(s: string | null | undefined): string {
  const dasar = normalTeks(s);
  if (!dasar) return "";

  let hasil = dasar;
  for (const [pola, ganti] of EJAAN) hasil = hasil.replace(pola, ganti);

  return hasil
    .split(" ")
    .filter((w) => w && !GELAR.has(w) && !KATA_SAMBUNG.has(w))
    .join(" ")
    .trim();
}

/** Nama kota tanpa prefix administratif — "Kota Adm. Jakarta Selatan" → "jakarta selatan". */
export function normalKota(s: string | null | undefined): string {
  return normalTeks(s).replace(
    /^(kota administrasi|kabupaten administrasi|kota adm|kab adm|kabupaten|kota|kab)\s+/,
    "",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MEMBACA NIAT "DEKAT"
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kata yang berarti "di sekitar", dalam segala ejaan yang benar-benar diketik
 * orang — termasuk yang salah eja, karena yang mengetik "deket" bukan sedang
 * salah, dia sedang mengetik seperti dia bicara.
 *
 * Diurutkan dari yang terpanjang saat dibuang, supaya "di sekitar" tidak
 * dipotong jadi "di" + sisa "sekitar" yang lalu lolos.
 */
const KATA_DEKAT = [
  "di sekitar", "di sekitaran", "di deket", "di dekat", "dekat dengan",
  "deket sama", "dekat sama", "sekitaran", "sekitar", "deketan", "deket",
  "dekat", "dkt", "dket", "cedak", "caket", "near", "nearby", "sebelah",
  "samping", "depan", "belakang", "area", "daerah", "kawasan", "dket",
].sort((a, b) => b.length - a.length);

export interface KueriDekat {
  /** True bila user memang menulis kata "dekat"/"sekitar" dan sejenisnya. */
  niatDekat: boolean;
  /** Sisa kueri setelah kata "dekat" dibuang — inilah yang dicari. */
  inti: string;
  /** `inti` dalam bentuk ternormalisasi, siap dicocokkan. */
  intiNormal: string;
}

/**
 * Pisahkan "deket unesa" menjadi niat + nama tempat.
 *
 * Kata "dekat" hanya dibuang bila ada SISA sesudahnya. Orang yang mengetik
 * "dekat" saja tidak sedang menyebut tempat bernama kosong — dia baru mengetik
 * separuh, dan kueri kosong akan menampilkan seluruh isi database seolah itu
 * jawaban.
 */
export function bacaKueriDekat(q: string | null | undefined): KueriDekat {
  const asli = String(q ?? "").trim();
  let kerja = normalTeks(asli);
  let niatDekat = false;

  // Berulang: "di deket sekitar unesa" memang ditulis orang.
  let berubah = true;
  while (berubah) {
    berubah = false;
    for (const kata of KATA_DEKAT) {
      if (kerja === kata) continue; // "dekat" saja — bukan sebutan tempat
      if (kerja.startsWith(kata + " ")) {
        kerja = kerja.slice(kata.length + 1).trim();
        niatDekat = true;
        berubah = true;
        break;
      }
    }
  }

  return { niatDekat, inti: kerja, intiNormal: normalNama(kerja) };
}

// ─────────────────────────────────────────────────────────────────────────────
// MENCARI JENIS TEMPAT, BUKAN TEMPAT TERTENTU
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kata yang menyebut JENIS tempat, bukan namanya.
 *
 * Ini pertanyaan yang berbeda sama sekali dari "deket UNESA". Yang mencari ruko
 * untuk usaha percetakan tidak peduli kampus mana — yang ia butuhkan adalah
 * BERADA DI KAWASANNYA, kampus apa pun. Begitu juga yang membuka warung makan
 * ("deket sekolah"), apotek ("deket rumah sakit"), atau kos ("deket kampus").
 *
 * Ditulis dalam bentuk manusia lalu dinormalisasi saat dimuat — jadi daftar ini
 * enak disunting orang yang tidak peduli soal normalisasi. Perhatikan bahwa
 * normalisasi ikut meratakan ejaan ("universitas" → "univ", "rumah sakit" →
 * "rs"), sehingga menuliskan kedua bentuknya di sini tidak masalah dan tidak
 * menghasilkan entri ganda.
 */
const KATA_KELAS: Array<[KelasTempat, string[]]> = [
  ["KAMPUS", [
    "universitas", "univ", "kampus", "perguruan tinggi", "kuliah",
    "institut", "politeknik", "poltek", "sekolah tinggi", "akademi", "kampus negeri",
  ]],
  ["SEKOLAH", [
    "sekolah", "sekolah dasar", "sd", "sdn", "smp", "smpn", "sma", "sman",
    "smk", "smkn", "madrasah", "mi", "mts", "tk", "paud", "sekolahan",
  ]],
  ["RUMAH_SAKIT", ["rumah sakit", "rs", "rsu", "rsud", "rsup"]],
  ["KLINIK", ["klinik", "apotek", "puskesmas", "pkm", "faskes"]],
  ["MALL", ["mall", "mal", "plaza", "plasa", "pusat perbelanjaan", "pusat belanja"]],
  ["PASAR", ["pasar", "pasar tradisional"]],
  ["MINIMARKET", ["minimarket", "supermarket", "swalayan", "toko kelontong"]],
  ["STASIUN", ["stasiun", "stasiun kereta"]],
  ["TERMINAL", ["terminal", "terminal bus"]],
  ["BANDARA", ["bandara", "bandar udara", "airport"]],
  ["HALTE", ["halte", "halte bus", "shelter"]],
  ["STADION", ["stadion", "gor", "gelanggang"]],
  ["WISATA", ["wisata", "tempat wisata", "objek wisata", "museum"]],
  // "kantor" sendirian sengaja TIDAK ada: kata itu terlalu sering jadi bagian
  // dari pencarian lain ("ruko kantor", "kantor notaris"), dan menafsirkannya
  // sebagai "kawasan perkantoran" berarti membajak pertanyaan yang lebih
  // sempit. "perkantoran" tidak punya ambiguitas itu.
  ["PERKANTORAN", ["perkantoran", "gedung perkantoran", "kawasan perkantoran"]],
  ["KULINER", [
    "kuliner", "tempat makan", "warung", "warung makan", "rumah makan",
    "restoran", "resto", "cafe", "kafe", "kedai kopi", "coffee shop",
  ]],
  ["IBADAH", [
    "masjid", "mushola", "musholla", "gereja", "pura", "vihara", "klenteng",
    "tempat ibadah",
  ]],
  ["HOTEL", ["hotel", "penginapan", "losmen"]],
  ["GYM", ["gym", "fitness", "tempat fitness", "pusat kebugaran"]],
  ["LAUNDRY", ["laundry", "binatu"]],
];

/** kata ternormalisasi → kelas. Dibangun sekali saat modul dimuat. */
const INDEKS_KELAS: Map<string, KelasTempat> = (() => {
  const peta = new Map<string, KelasTempat>();
  for (const [kelas, kata] of KATA_KELAS) {
    for (const k of kata) {
      const n = normalNama(k);
      // Yang lebih dulu menang: urutan daftar di atas adalah urutan
      // prioritasnya. "sekolah tinggi" sengaja ditaruh di KAMPUS dan tidak
      // boleh direbut SEKOLAH — ia perguruan tinggi, bukan SD.
      if (n && !peta.has(n)) peta.set(n, kelas);
    }
  }
  return peta;
})();

/**
 * Kelas yang dimaksud sebuah kueri, atau null.
 *
 * Sengaja hanya menerima kecocokan PERSIS. "universitas" berarti "kampus mana
 * pun"; "universitas negeri surabaya" berarti satu kampus tertentu, dan
 * memperlakukannya sebagai pencarian jenis akan menukar pertanyaan yang jelas
 * dengan pertanyaan yang kabur.
 */
export function kelasDariKata(kueriNormal: string): KelasTempat | null {
  return INDEKS_KELAS.get(kueriNormal) ?? null;
}

/** Kata jenis yang dikenali — dipakai UI untuk memberi contoh. */
export const CONTOH_KATA_KELAS = ["kampus", "sekolah", "rumah sakit", "mall", "pasar"];

// ─────────────────────────────────────────────────────────────────────────────
// MEMBACA JENIS DARI NAMANYA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Penanda KUAT — kata pembuka nama yang menyebut jenisnya secara harfiah.
 *
 * KENAPA INI PENTING. Jenis tempat datang dari dua sumber yang sama-sama
 * kasar: dropdown yang dipilih agent (12 pilihan untuk seluruh dunia) dan
 * penggolong pindaian (yang tidak membedakan rumah sakit dari apotek).
 * Akibatnya terukur di data: "Universitas Sunan Giri" tercatat SEKOLAH,
 * "Terminal Purabaya" tercatat HALTE, dan enam belas restoran — McDonald's,
 * Pizza Hut, Starbucks, Mie Gacoan, Depot Bu Rudy — semuanya tercatat LAINNYA
 * karena itulah pilihan terakhir di dropdown.
 *
 * Padahal namanya sudah mengatakannya. Sebuah tempat yang namanya diawali
 * "Universitas" adalah kampus; itu bukan tebakan, itu membaca.
 *
 * Ditulis dalam bentuk manusia, dinormalisasi saat dimuat — perhatikan bahwa
 * normalisasi meringkas ejaan ("terminal" → "term", "universitas" → "univ"),
 * jadi menulis kedua bentuknya aman dan tidak menghasilkan entri ganda.
 */
const PENANDA_KUAT: Array<[KelasTempat, string[]]> = [
  ["KAMPUS", [
    "universitas", "institut", "politeknik", "akademi", "sekolah tinggi",
    "stikes", "stie", "stmik", "stikom", "kampus",
  ]],
  ["SEKOLAH", [
    "sd", "sdn", "sdit", "sdk", "smp", "smpn", "smpk", "sma", "sman", "smak",
    "smk", "smkn", "mi", "mts", "man", "tk", "paud", "kb", "madrasah",
    "sekolah", "pondok pesantren", "ponpes",
  ]],
  ["RUMAH_SAKIT", ["rumah sakit", "rs", "rsu", "rsud", "rsup", "rsia", "rsj"]],
  ["KLINIK", [
    "klinik", "poliklinik", "apotek", "puskesmas", "pustu", "posyandu",
    "polindes", "laboratorium", "lab", "bidan", "praktek", "dokter",
  ]],
  ["PASAR", ["pasar"]],
  ["MALL", ["mall", "plaza", "supermall", "trade center"]],
  ["STASIUN", ["stasiun"]],
  ["TERMINAL", ["terminal", "pelabuhan"]],
  ["BANDARA", ["bandara", "bandar udara"]],
  ["IBADAH", [
    "masjid", "musholla", "mushola", "surau", "langgar",
    "gereja", "kapel", "gkjw", "gpib", "hkbp",
    "pura", "vihara", "klenteng", "kelenteng",
  ]],
  ["HOTEL", ["hotel", "wisma", "penginapan", "homestay", "losmen", "guest house"]],
  ["STADION", ["stadion", "gor", "gelanggang"]],
  ["MINIMARKET", ["minimarket", "swalayan", "supermarket"]],
  ["HALTE", ["halte", "shelter"]],
  ["WISATA", ["museum", "kebun binatang", "taman wisata", "taman hiburan"]],
  ["GYM", ["gym"]],
  ["LAUNDRY", ["laundry"]],
  ["PERKANTORAN", ["gedung perkantoran", "kawasan industri"]],
];

/**
 * Penanda LEMAH — kata yang boleh muncul di mana saja dalam nama.
 *
 * Dipakai HANYA untuk tempat yang jenisnya belum diketahui (LAINNYA), tidak
 * pernah untuk menimpa jenis yang sudah jelas. Bedanya penting: "Depot Bu
 * Rudy" jelas kuliner, tapi "Apotek Depot Jamu" bukan — dan yang kedua sudah
 * punya jenis sendiri dari penanda kuat "apotek".
 */
const PENANDA_LEMAH: Array<[KelasTempat, string[]]> = [
  ["KULINER", [
    "mie", "bakmi", "bakso", "soto", "warung", "warteg", "depot", "rumah makan",
    "resto", "restoran", "cafe", "kafe", "kopi", "coffee", "kedai", "seafood",
    "ayam", "bebek", "sate", "nasi", "pecel", "rawon", "gudeg", "padang",
    "bubur", "steak", "ramen", "sushi", "dimsum", "burger", "pizza", "donut",
    "bakery", "roti", "jus", "martabak", "geprek", "penyetan", "angkringan",
    "lesehan", "kwetiau", "tongseng", "catering", "food", "eatery", "bistro",
    // Jaringan yang namanya tidak memuat kata jenis apa pun.
    "mcdonald", "mcd", "kfc", "starbucks", "dunkin", "hokben", "solaria",
    "yoshinoya", "richeese", "excelso", "gacoan", "chatime", "mixue",
    "kenangan", "janji jiwa", "tomoro", "fore",
  ]],
  ["MINIMARKET", [
    "indomaret", "alfamart", "alfamidi", "lawson", "circle k", "superindo",
    "super indo", "hypermart", "transmart", "giant", "lotte mart", "ranch market",
  ]],
  ["GYM", ["fitness", "fithub", "kebugaran"]],
  ["STADION", ["bulutangkis", "futsal", "lapangan olahraga"]],
  ["WISATA", ["wisata", "taman kota", "alun alun"]],
];

interface Penanda {
  kata: string;
  kelas: KelasTempat;
}

/** Diurut TERPANJANG dulu supaya "sekolah tinggi" tidak tertelan "sekolah". */
function susun(daftar: Array<[KelasTempat, string[]]>): Penanda[] {
  const keluar: Penanda[] = [];
  const terlihat = new Set<string>();
  for (const [kelas, kata] of daftar) {
    for (const k of kata) {
      const n = normalNama(k);
      if (!n || terlihat.has(n)) continue;
      terlihat.add(n);
      keluar.push({ kata: n, kelas });
    }
  }
  return keluar.sort((a, b) => b.kata.length - a.kata.length);
}

const KUAT = susun(PENANDA_KUAT);
const LEMAH = susun(PENANDA_LEMAH);

export interface TebakanKelas {
  kelas: KelasTempat;
  /**
   * true = namanya MENYEBUT jenisnya di depan ("Universitas …", "Terminal …").
   * Boleh menimpa jenis dari sumber, karena membaca nama lebih dapat dipercaya
   * daripada dropdown 12 pilihan.
   * false = hanya ada kata petunjuk di tengah nama. Cuma dipakai untuk tempat
   * yang jenisnya memang belum diketahui.
   */
  kuat: boolean;
}

/**
 * Baca jenis tempat dari namanya sendiri.
 *
 * Penanda kuat harus berada di AWAL nama (batas kata), bukan di mana saja.
 * "Universitas Airlangga" adalah kampus; "Apotek Dekat Universitas" bukan —
 * dan bedanya persis pada posisi katanya.
 */
export function tebakKelasDariNama(nama: string): TebakanKelas | null {
  const n = normalNama(nama);
  if (!n) return null;

  for (const p of KUAT) {
    if (n === p.kata || n.startsWith(p.kata + " ")) {
      return { kelas: p.kelas, kuat: true };
    }
  }

  const kata = new Set(n.split(" "));
  for (const p of LEMAH) {
    const cocok = p.kata.includes(" ")
      ? n === p.kata || n.includes(p.kata + " ") || n.endsWith(" " + p.kata)
      : kata.has(p.kata);
    if (cocok) return { kelas: p.kelas, kuat: false };
  }

  return null;
}

export interface KueriBerwilayah {
  /** Bagian nama/jenis, sebelum "di …". */
  nama: string;
  /** Bagian wilayah setelah "di …", atau null bila tidak ada. */
  wilayah: string | null;
}

/**
 * Pisahkan "universitas di malang" jadi jenis + wilayah.
 *
 * DIKERJAKAN SEBELUM `normalNama`, dan itu bukan detail teknis: normalisasi
 * membuang "di" sebagai kata sambung, jadi "universitas di malang" akan menjadi
 * "univ malang" — kueri yang tidak akan pernah cocok ke apa pun, dan wilayahnya
 * hilang tanpa jejak. Pemisahnya harus melihat teks selagi "di"-nya masih ada.
 *
 * Dipotong pada " di " TERAKHIR: "rumah sakit di kota malang" harus terpisah di
 * "di" yang memisahkan wilayah, bukan yang kebetulan ada di tengah nama.
 *
 * Pemanggil WAJIB memverifikasi bahwa `wilayah` benar-benar sebuah wilayah
 * sebelum memakainya. Tanpa itu, "Mie Gacoan di Manukan" akan diperlakukan
 * sebagai "Mie Gacoan" di wilayah bernama "Manukan" — dan gagal menemukan
 * apa pun.
 */
export function pisahWilayah(teksNormal: string): KueriBerwilayah {
  const potong = teksNormal.lastIndexOf(" di ");
  if (potong < 0) return { nama: teksNormal, wilayah: null };

  const nama = teksNormal.slice(0, potong).trim();
  const wilayah = teksNormal.slice(potong + 4).trim();
  if (!nama || wilayah.length < 3) return { nama: teksNormal, wilayah: null };

  return { nama, wilayah };
}

// ─────────────────────────────────────────────────────────────────────────────
// ALIAS TURUNAN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Akronim dari huruf depan tiap kata — "Rumah Sakit Umum Daerah" → "rsud".
 *
 * SENGAJA DIPERLAKUKAN SEBAGAI ALIAS TERLEMAH. Huruf depan "Universitas Negeri
 * Surabaya" adalah "uns", dan "uns" adalah Universitas Sebelas Maret. Akronim
 * yang benar-benar dipakai orang (UNESA, UNAIR, ITS, UB) TIDAK bisa
 * dibangkitkan — ia konvensi, bukan aturan — dan itulah alasan alias-kuratif.ts
 * ada. Fungsi ini hanya menangkap sisa yang memang mekanis.
 *
 * Dikembalikan null bila hasilnya terlalu pendek (< 3 huruf) untuk membedakan
 * apa pun: dua huruf akan cocok ke ratusan tempat dan hanya menghasilkan derau.
 */
export function akronimDari(nama: string): string | null {
  const kata = normalNama(nama)
    .split(" ")
    .filter((w) => w.length > 1 && !/^\d+$/.test(w));
  if (kata.length < 2) return null;

  const akronim = kata.map((w) => w[0]).join("");
  return akronim.length >= 3 ? akronim : null;
}

/**
 * Nama tanpa kata jenisnya di depan — "Pasar Wonokromo" → "wonokromo",
 * "Stasiun Gubeng" → "gubeng".
 *
 * Orang menyebut Gubeng, bukan Stasiun Gubeng. Ini alias yang paling sering
 * benar-benar dipakai dan paling sering luput kalau hanya mengandalkan
 * pencocokan awalan.
 */
const KATA_JENIS = [
  "rs", "rsu", "rsud", "rsup", "rsia", "pkm", "klinik", "apotek",
  "univ", "poltek", "institut", "akademi", "kampus", "sekolah", "tinggi",
  "sd", "sdn", "smp", "smpn", "sma", "sman", "smk", "smkn", "mi", "mts", "ma",
  "pasar", "mall", "plasa", "stasiun", "term", "bandara", "stadion", "gor",
  "hotel", "masjid", "gereja", "pura", "vihara", "klenteng", "pelabuhan",
];

/**
 * Kata sifat yang berdiri SETELAH kata jenis tapi SEBELUM nama dirinya.
 * Kehadirannya berarti nama dirinya belum mulai — dan itu tanda berhenti.
 *
 * Tanpa penjaga ini, "Universitas Negeri Surabaya" akan menghasilkan alias
 * "surabaya" (kalau "negeri" ikut dibuang) atau "negeri surabaya" (kalau
 * tidak). Keduanya bencana: yang pertama menjadikan seluruh kampus negeri di
 * Surabaya bernama sama dengan kotanya, yang kedua alias yang tak pernah
 * diketik siapa pun tapi tetap ikut dicocokkan.
 */
const KATA_SIFAT_GENERIK = new Set([
  "negeri", "umum", "daerah", "pusat", "nasional", "internasional",
  "islam", "kristen", "katolik", "swasta", "muhammadiyah", "raya", "besar",
]);

/**
 * Nama tanpa kata jenisnya — "Pasar Wonokromo" → "wonokromo".
 *
 * Dikembalikan null bila sisanya diawali kata sifat generik (lihat
 * KATA_SIFAT_GENERIK): lebih baik tidak punya alias daripada punya alias yang
 * salah, karena alias yang salah bukan sekadar tidak membantu — ia menarik
 * hasil orang lain ke tempat yang keliru.
 */
export function tanpaKataJenis(nama: string): string | null {
  const kata = normalNama(nama).split(" ").filter(Boolean);
  if (kata.length < 2) return null;

  let i = 0;
  while (i < kata.length && KATA_JENIS.includes(kata[i])) i++;
  if (i === 0 || i >= kata.length) return null;
  if (KATA_SIFAT_GENERIK.has(kata[i])) return null;

  const sisa = kata.slice(i).join(" ");
  return sisa.length >= 3 ? sisa : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// IDENTITAS BARIS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kunci dedup sebuah tempat: NAMA + KOTA. Sesederhana itu, dan sengaja.
 *
 * Alternatif yang tampak lebih benar — mengunci per koordinat supaya tiap
 * cabang jadi baris sendiri — justru merusak hal yang paling ingin dilayani.
 * Mie Gacoan punya delapan gerai di Surabaya; dikunci per koordinat, orang
 * yang mengetik "deket mie gacoan" disodori delapan pilihan yang tidak dia
 * ketahui bedanya, lalu memilih satu dan kehilangan tujuh per delapan
 * jawabannya. Dikunci per nama+kota, ia satu pilihan yang berarti "dekat gerai
 * mana pun di kota ini" — dan jarak tiap aset tetap jarak sesungguhnya ke
 * gerai yang memang dipindai di dekatnya, karena jarak disimpan per aset di
 * `listing_tempat`, bukan di baris tempatnya.
 *
 * Yang hilang: satu titik peta mewakili beberapa gerai. Itu harga yang murah,
 * dan UI menyebutnya apa adanya saat cabangnya lebih dari satu.
 */
export function kunciTempat(nama: string, kota: string | null | undefined): string {
  return `${normalNama(nama)}|${normalKota(kota)}`;
}

/** Slug URL yang stabil & dapat dibaca: "unesa-surabaya". */
export function slugTempat(nama: string, kota: string | null | undefined): string {
  const inti = normalTeks(nama).replace(/\s+/g, "-").slice(0, 140);
  const kt = normalKota(kota).replace(/\s+/g, "-").slice(0, 50);
  return [inti, kt].filter(Boolean).join("-").replace(/-{2,}/g, "-") || inti;
}

/**
 * Jarak "menit" yang diketik agent → meter.
 *
 * 600 m/menit ≈ 36 km/jam, kecepatan motor dalam kota. Angkanya pasti tidak
 * tepat untuk kasus mana pun; yang penting ia KONSISTEN dan hasilnya ditandai
 * `presisi: "PATOKAN"` sehingga tidak pernah tampil sebagai jarak terukur.
 * Tanpa konversi apa pun, patokan bersatuan menit tidak bisa diurutkan bersama
 * hasil pindai sama sekali — dan patokan justru satu-satunya sumber untuk aset
 * yang belum pernah dipindai.
 */
export const METER_PER_MENIT = 600;

export function jarakPatokanKeMeter(
  jarak: number | null | undefined,
  satuan: string | null | undefined,
): number | null {
  const n = Number(jarak);
  if (!Number.isFinite(n) || n <= 0) return null;
  return satuan === "MENIT" ? Math.round(n * METER_PER_MENIT) : Math.round(n * 1000);
}

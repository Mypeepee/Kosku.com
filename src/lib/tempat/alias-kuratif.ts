/**
 * Alias tulis-tangan: singkatan yang terlanjur baku tapi tidak bisa
 * dibangkitkan aturan apa pun.
 *
 * KENAPA HARUS DITULIS TANGAN. "UNESA" bukan hasil pemotongan "Universitas
 * Negeri Surabaya" — huruf depannya "UNS", dan UNS milik Universitas Sebelas
 * Maret. Ia juga bukan awalan, bukan sufiks, bukan kemiripan trigram (bandingkan
 * "unesa" dengan "univnegerisurabaya": nyaris tidak ada trigram yang sama).
 * Akronim Indonesia dibentuk dari SUKU KATA, dan pilihan suku katanya
 * konvensi — UNAIR ambil dua suku dari kata terakhir, UNESA ambil satu suku
 * dari kata kedua dan satu dari ketiga, ITS murni huruf depan. Tidak ada
 * aturan; yang ada cuma kebiasaan. Kebiasaan harus dicatat.
 *
 * BENTUKNYA GRUP KESETARAAN, bukan pemetaan berarah. Sebuah tempat yang nama
 * resminya "Universitas Negeri Surabaya" dan tempat yang di OpenStreetMap
 * kebetulan tertulis "UNESA" adalah dua kemungkinan yang sama-sama nyata, dan
 * keduanya harus berakhir dengan alias yang sama persis. Maka: cocok ke ANGGOTA
 * MANA PUN dalam satu grup → dapat SELURUH anggota grup itu sebagai alias.
 *
 * Ditulis dalam bentuk manusia (huruf besar, titik, spasi apa adanya) dan
 * dinormalisasi saat dipakai — supaya daftar ini enak dibaca & disunting orang
 * yang tidak peduli soal normalisasi.
 *
 * MENAMBAH ENTRI. Tambahkan saja barisnya, lalu jalankan `npm run kamus:tempat`
 * — skrip itu menempelkan alias baru ke tempat yang sudah ada di kamus tanpa
 * perlu memindai ulang apa pun.
 */

import { normalNama } from "./normalisasi";

// ─────────────────────────────────────────────────────────────────────────────
// GRUP KESETARAAN NAMA
// ─────────────────────────────────────────────────────────────────────────────

export const GRUP_ALIAS: string[][] = [
  // ── Kampus: Surabaya raya ────────────────────────────────────────────────
  ["Universitas Negeri Surabaya", "UNESA"],
  ["Universitas Airlangga", "UNAIR"],
  ["Institut Teknologi Sepuluh Nopember", "ITS", "ITS Surabaya"],
  ["Universitas Kristen Petra", "UK Petra", "Petra"],
  ["Universitas Surabaya", "UBAYA"],
  ["Universitas Ciputra", "UC Surabaya"],
  ["Universitas Katolik Widya Mandala", "UKWMS", "Widya Mandala"],
  ["Universitas 17 Agustus 1945 Surabaya", "UNTAG Surabaya", "UNTAG"],
  ["Universitas Muhammadiyah Surabaya", "UM Surabaya", "UMSurabaya"],
  ["Universitas Islam Negeri Sunan Ampel", "UINSA", "UIN Sunan Ampel"],
  ["Universitas Wijaya Kusuma Surabaya", "UWKS"],
  ["Universitas Narotama", "Narotama"],
  ["Universitas Dr. Soetomo", "UNITOMO"],
  ["Universitas Pembangunan Nasional Veteran Jawa Timur", "UPN Veteran Jatim", "UPN Jatim"],
  ["Politeknik Elektronika Negeri Surabaya", "PENS"],
  ["Politeknik Perkapalan Negeri Surabaya", "PPNS"],
  ["Politeknik Negeri Malang", "POLINEMA"],
  ["Universitas Muhammadiyah Sidoarjo", "UMSIDA"],

  // ── Kampus: Malang & Jawa Timur ──────────────────────────────────────────
  ["Universitas Brawijaya", "UB", "UNIBRAW"],
  ["Universitas Negeri Malang", "UM Malang"],
  ["Universitas Muhammadiyah Malang", "UMM"],
  ["Universitas Islam Malang", "UNISMA"],
  ["Universitas Islam Negeri Maulana Malik Ibrahim", "UIN Malang", "UIN Maliki"],
  ["Universitas Jember", "UNEJ"],
  ["Universitas Trunojoyo Madura", "UTM Madura", "Trunojoyo"],

  // ── Kampus: Jabodetabek ──────────────────────────────────────────────────
  ["Universitas Indonesia", "UI"],
  ["Institut Pertanian Bogor", "IPB", "IPB University"],
  ["Universitas Negeri Jakarta", "UNJ"],
  ["Universitas Bina Nusantara", "BINUS", "Binus University"],
  ["Universitas Trisakti", "USAKTI", "Trisakti"],
  ["Universitas Gunadarma", "Gunadarma"],
  ["Universitas Pancasila", "UP Jakarta"],
  ["Universitas Islam Negeri Syarif Hidayatullah", "UIN Jakarta", "UIN Ciputat"],
  ["Universitas Katolik Indonesia Atma Jaya", "Atma Jaya Jakarta", "UAJ"],
  ["Universitas Multimedia Nusantara", "UMN"],
  ["Institut Teknologi Sepuluh November", "ITS"],
  ["Universitas Pertamina", "UP"],
  ["Universitas Mercu Buana", "UMB"],
  ["Universitas Tarumanagara", "UNTAR"],

  // ── Kampus: Bandung, Jateng, DIY ─────────────────────────────────────────
  ["Institut Teknologi Bandung", "ITB"],
  ["Universitas Padjadjaran", "UNPAD"],
  ["Universitas Pendidikan Indonesia", "UPI"],
  ["Universitas Telkom", "Telkom University", "Tel-U"],
  ["Universitas Islam Bandung", "UNISBA"],
  ["Universitas Katolik Parahyangan", "UNPAR"],
  ["Universitas Gadjah Mada", "UGM"],
  ["Universitas Negeri Yogyakarta", "UNY"],
  ["Universitas Islam Indonesia", "UII"],
  ["Universitas Muhammadiyah Yogyakarta", "UMY"],
  ["Universitas Atma Jaya Yogyakarta", "UAJY"],
  ["Universitas Sanata Dharma", "USD"],
  ["Universitas Diponegoro", "UNDIP"],
  ["Universitas Negeri Semarang", "UNNES"],
  ["Universitas Dian Nuswantoro", "UDINUS"],
  ["Universitas Sebelas Maret", "UNS", "UNS Solo"],

  // ── Kampus: luar Jawa ────────────────────────────────────────────────────
  ["Universitas Hasanuddin", "UNHAS"],
  ["Universitas Sumatera Utara", "USU"],
  ["Universitas Negeri Medan", "UNIMED"],
  ["Universitas Andalas", "UNAND"],
  ["Universitas Negeri Padang", "UNP"],
  ["Universitas Udayana", "UNUD"],
  ["Universitas Sriwijaya", "UNSRI"],
  ["Universitas Lampung", "UNILA"],
  ["Universitas Riau", "UNRI"],
  ["Universitas Mulawarman", "UNMUL"],
  ["Universitas Tanjungpura", "UNTAN"],
  ["Universitas Syiah Kuala", "USK", "UNSYIAH"],
  ["Universitas Sam Ratulangi", "UNSRAT"],
  ["Universitas Mataram", "UNRAM"],

  // ── Rumah sakit ──────────────────────────────────────────────────────────
  ["RSUD Dr. Soetomo", "RS Soetomo", "RSDS", "Rumah Sakit Umum Daerah Dr Soetomo"],
  ["RSUD Dr. Saiful Anwar", "RSSA", "RS Saiful Anwar"],
  ["RSUPN Dr. Cipto Mangunkusumo", "RSCM", "RS Cipto Mangunkusumo"],
  ["RSUP Dr. Sardjito", "RS Sardjito"],
  ["RSUP Dr. Kariadi", "RS Kariadi"],
  ["RSUD Dr. Moewardi", "RS Moewardi"],
  ["RSUP Dr. Hasan Sadikin", "RSHS", "RS Hasan Sadikin"],
  ["RSUP Haji Adam Malik", "RS Adam Malik"],
  ["RSUP Dr. Wahidin Sudirohusodo", "RS Wahidin"],
  ["RSUD Sidoarjo", "RS Sidoarjo"],
  ["RS Premier Surabaya", "RS Premier"],
  ["RS Husada Utama", "RSHU"],
  ["RSUD Dr. Mohammad Soewandhie", "RS Soewandhie"],
  ["Rumah Sakit Islam", "RSI"],
  ["Rumah Sakit Umum Daerah", "RSUD"],
  ["Rumah Sakit Umum Pusat", "RSUP"],
  ["Rumah Sakit Ibu dan Anak", "RSIA"],

  // ── Mall: Surabaya raya ──────────────────────────────────────────────────
  ["Tunjungan Plaza", "TP Surabaya", "TP"],
  ["Pakuwon Trade Center", "PTC", "PTC Surabaya"],
  ["Pakuwon Mall", "Pakuwon Mall Surabaya"],
  ["Galaxy Mall", "GM Surabaya"],
  ["Ciputra World Surabaya", "CIWO", "Ciputra World"],
  ["Grand City Mall", "Grand City Surabaya"],
  ["Royal Plaza Surabaya", "Royal Plaza"],
  ["Plaza Marina", "Marina Surabaya"],
  ["Marvell City", "Marvell City Surabaya"],
  ["Lenmarc Mall", "Lenmarc"],
  ["Plaza Surabaya", "Delta Plaza", "Delta"],
  ["Lippo Plaza Sidoarjo", "Lippo Sidoarjo"],
  ["Sun City Sidoarjo", "Suncity Sidoarjo"],

  // ── Mall: Jabodetabek & lainnya ──────────────────────────────────────────
  ["Grand Indonesia", "GI Jakarta"],
  ["Plaza Indonesia", "PI Jakarta"],
  ["Senayan City", "Sency"],
  ["Pacific Place", "PP Jakarta"],
  ["Central Park Mall", "Central Park Jakarta", "CP Jakarta"],
  ["Mall Taman Anggrek", "MTA", "Taman Anggrek"],
  ["Pondok Indah Mall", "PIM"],
  ["Mall Kelapa Gading", "MKG", "Kelapa Gading Mall"],
  ["Gandaria City", "Gancit"],
  ["Kota Kasablanka", "Kokas"],
  ["Summarecon Mall Serpong", "SMS Serpong"],
  ["Summarecon Mall Bekasi", "SMB Bekasi"],
  ["Aeon Mall BSD", "Aeon BSD"],
  ["Margo City", "Margo City Depok"],
  ["Depok Town Square", "Detos"],
  ["Paris Van Java", "PVJ", "PVJ Bandung"],
  ["Trans Studio Mall Bandung", "TSM Bandung"],
  ["Cihampelas Walk", "Ciwalk"],
  ["Ambarrukmo Plaza", "Amplaz"],
  ["Malioboro Mall", "Malioboro"],
  ["Solo Grand Mall", "SGM Solo"],

  // ── Transportasi ─────────────────────────────────────────────────────────
  ["Stasiun Surabaya Gubeng", "Stasiun Gubeng", "Gubeng"],
  ["Stasiun Surabaya Pasar Turi", "Stasiun Pasar Turi", "Pasar Turi"],
  ["Terminal Purabaya", "Terminal Bungurasih", "Bungurasih"],
  ["Bandar Udara Internasional Juanda", "Bandara Juanda", "Juanda"],
  ["Pelabuhan Tanjung Perak", "Tanjung Perak"],
  ["Bandar Udara Internasional Soekarno-Hatta", "Bandara Soekarno Hatta", "Soetta", "Cengkareng"],
  ["Bandar Udara Internasional Ngurah Rai", "Bandara Ngurah Rai", "Bandara Bali"],
  ["Bandar Udara Internasional Kualanamu", "Bandara Kualanamu", "KNO"],
  ["Bandar Udara Internasional Sultan Hasanuddin", "Bandara Hasanuddin"],
  ["Bandar Udara Internasional Adisutjipto", "Bandara Adisutjipto"],
  ["Bandar Udara Internasional Yogyakarta", "YIA", "Bandara Kulon Progo"],
  ["Bandar Udara Husein Sastranegara", "Bandara Husein"],
  ["Bandar Udara Internasional Abdulrachman Saleh", "Bandara Abdulrachman Saleh", "Bandara Malang"],
  ["Stasiun Gambir", "Gambir"],
  ["Stasiun Pasar Senen", "Pasar Senen"],
  ["Stasiun Yogyakarta", "Stasiun Tugu", "Tugu Jogja"],
  ["Stasiun Bandung", "Stasiun Hall"],
  ["Stasiun Malang Kotabaru", "Stasiun Malang"],
  ["Terminal Kampung Rambutan", "Kampung Rambutan"],
  ["Terminal Pulo Gebang", "Pulo Gebang"],
  ["Terminal Arjosari", "Arjosari"],
  ["Terminal Tirtonadi", "Tirtonadi"],
  ["Terminal Giwangan", "Giwangan"],

  // ── Penanda kota ─────────────────────────────────────────────────────────
  ["Kebun Binatang Surabaya", "KBS", "Bonbin Surabaya"],
  ["Tugu Pahlawan", "Tugu Pahlawan Surabaya"],
  ["Masjid Nasional Al Akbar", "Masjid Al Akbar", "MAS Surabaya"],
  ["Jembatan Suramadu", "Suramadu"],
  ["Gelora Bung Tomo", "GBT", "Stadion GBT"],
  ["Gelora Bung Karno", "GBK", "Senayan"],
  ["Gelora 10 November", "Tambaksari"],
  ["Monumen Nasional", "Monas"],
  ["Alun-Alun Kota", "Alun Alun"],
  ["Malioboro", "Jalan Malioboro"],
  ["Simpang Lima", "Simpang Lima Semarang"],
  ["Braga", "Jalan Braga"],
];

// ─────────────────────────────────────────────────────────────────────────────
// BRAND / JARINGAN CABANG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Nama jaringan yang punya banyak gerai. Sebuah tempat yang namanya MENGANDUNG
 * salah satu dari ini diberi `brand_normal`, dan pencarian mengelompokkannya:
 * "deket mie gacoan" berarti dekat gerai mana pun, bukan memaksa user memilih
 * cabang yang bahkan tidak dia tahu ada.
 *
 * Daftar ini juga menjawab permintaan "cari dekat tempat makan tertentu" —
 * yang dimaksud orang hampir selalu jaringan (Gacoan, McD, Richeese), bukan
 * warung tunggal, karena hanya jaringan yang cukup dikenal untuk jadi patokan.
 *
 * Diurutkan dari yang paling panjang saat dicocokkan supaya "Alfamidi" tidak
 * tertelan "Alfa".
 */
export const BRAND_DIKENAL: string[] = [
  // Kuliner
  "Mie Gacoan", "Gacoan",
  "McDonald's", "McDonalds", "McD",
  "KFC", "Kentucky Fried Chicken",
  "Burger King",
  "Pizza Hut", "PHD",
  "Richeese Factory", "Richeese",
  "HokBen", "Hoka Hoka Bento",
  "Solaria",
  "Starbucks",
  "J.CO Donuts", "JCO",
  "Dunkin Donuts", "Dunkin",
  "Chatime", "Mixue", "Kopi Kenangan", "Janji Jiwa", "Point Coffee",
  "Es Teh Indonesia", "Haus", "Tomoro Coffee", "Fore Coffee",
  "Sate Khas Senayan", "Bakmi GM", "Yoshinoya", "Marugame Udon",
  "Warteg Bahari", "Rocket Chicken", "Sabana Fried Chicken", "Geprek Bensu",
  "Ayam Geprek", "Bebek Kaleyo", "Warung Steak", "Waroeng Steak",

  // Retail & minimarket
  "Indomaret", "Alfamidi", "Alfamart", "Alfa Express",
  "Superindo", "Super Indo", "Hypermart", "Transmart", "Giant",
  "Lotte Mart", "Ranch Market", "Farmers Market", "Hero Supermarket",
  "Yogya", "Griya", "Borma", "Tip Top", "Naga Swalayan", "Diamond Supermarket",

  // Apotek & kesehatan
  "Apotek K-24", "K-24", "Kimia Farma", "Century Healthcare", "Guardian",
  "Watsons", "Viva Apotek",

  // Jasa lain
  "Alfa Gift", "JNE", "J&T Express", "SiCepat", "Pos Indonesia",
  "Bank BCA", "Bank Mandiri", "Bank BNI", "Bank BRI", "Bank BTN",
  "Pertamina", "SPBU Pertamina", "Shell", "BP AKR", "Vivo",
  "Planet Ban", "Auto2000", "Astra Motor",
  "Celebrity Fitness", "Fitness First", "Gold's Gym", "FIT HUB",
  "The Body Shop", "Miniso", "Ace Hardware", "Informa", "Mitra10",
];

// ─────────────────────────────────────────────────────────────────────────────
// INDEKS SIAP PAKAI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * nama ternormalisasi → seluruh anggota grupnya (juga ternormalisasi).
 *
 * Dibangun sekali saat modul dimuat: daftarnya ratusan baris dan dipakai untuk
 * setiap tempat yang masuk kamus, jadi membangunnya ulang tiap panggilan
 * adalah pemborosan yang tidak perlu dijelaskan.
 */
interface EntriAlias {
  /** Nama tampil kanonik — anggota pertama grup, apa adanya (huruf besar dst). */
  kanonik: string;
  /** Seluruh anggota grup dalam bentuk ternormalisasi. */
  anggota: string[];
}

const INDEKS_ALIAS: Map<string, EntriAlias> = (() => {
  const peta = new Map<string, EntriAlias>();
  for (const grup of GRUP_ALIAS) {
    const normal = Array.from(
      new Set(grup.map((n) => normalNama(n)).filter(Boolean)),
    );
    if (normal.length < 2) continue;
    for (const anggota of normal) {
      // Sebuah nama bisa muncul di dua grup (mis. "ITS" ditulis dua kali dengan
      // ejaan "Nopember"/"November"). Gabungkan, jangan saling menimpa —
      // kanonik pertama yang menang supaya hasilnya tidak bergantung urutan
      // pembacaan.
      const lama = peta.get(anggota);
      peta.set(anggota, {
        kanonik: lama?.kanonik ?? grup[0],
        anggota: Array.from(new Set([...(lama?.anggota ?? []), ...normal])),
      });
    }
  }
  return peta;
})();

/** Brand ternormalisasi, terpanjang dulu — lihat catatan Alfamidi/Alfa. */
const BRAND_NORMAL: string[] = Array.from(
  new Set(BRAND_DIKENAL.map((b) => normalNama(b)).filter(Boolean)),
).sort((a, b) => b.length - a.length);

/**
 * Alias kuratif untuk sebuah nama — kosong bila namanya tidak ada di daftar.
 * Nama itu sendiri ikut dikembalikan; pemanggil yang membuang duplikatnya.
 */
export function aliasKuratif(nama: string): string[] {
  return INDEKS_ALIAS.get(normalNama(nama))?.anggota ?? [];
}

/**
 * Nama kanonik sebuah grup — anggota PERTAMA yang ditulis di GRUP_ALIAS.
 *
 * KENAPA PENTING. Kunci dedup sebuah tempat adalah nama+kota, dan itu berarti
 * "UNESA" (nama yang kebetulan dipakai satu node OpenStreetMap) dan
 * "Universitas Negeri Surabaya" (nama yang dipakai node sebelahnya) akan
 * menghasilkan DUA baris untuk satu kampus yang sama. Autocomplete-nya lalu
 * menawarkan dua pilihan identik dengan jumlah aset yang terbelah, dan
 * memilih salah satunya berarti kehilangan separuh jawaban.
 *
 * Dengan kanonikalisasi, keduanya mendarat di kunci yang sama sebelum sempat
 * jadi dua baris. Anggota pertama dipilih sebagai kanonik karena daftarnya
 * memang ditulis dengan nama panjang di depan — yang lebih jelas saat tampil
 * di layar, sementara singkatannya tetap bisa dicari lewat alias.
 */
export function kanonikDari(nama: string): string | null {
  return INDEKS_ALIAS.get(normalNama(nama))?.anggota[0] ?? null;
}

/**
 * Nama TAMPIL kanonik — bentuk manusiawinya, bukan yang ternormalisasi.
 *
 * Dipakai supaya sebuah kampus yang di OpenStreetMap kebetulan cuma tertulis
 * "UNESA" tetap tampil sebagai "Universitas Negeri Surabaya" di daftar saran:
 * nama panjang lebih jelas bagi orang yang belum tahu, sementara singkatannya
 * toh tetap bisa diketik karena ia ada di alias.
 */
export function namaKanonik(nama: string): string | null {
  return INDEKS_ALIAS.get(normalNama(nama))?.kanonik ?? null;
}

/**
 * Bentangkan singkatan yang menjadi AWALAN sebuah nama.
 *
 * "Unair Kampus A" bukan anggota grup mana pun — yang jadi anggota hanyalah
 * "UNAIR" — jadi kanonikalisasi biasa melewatinya, dan ia mendarat sebagai
 * baris kamus ketiga untuk kampus yang sama. Dengan awalannya dibentangkan,
 * ia menjadi "Universitas Airlangga Kampus A": satu keluarga dengan entri
 * UNAIR lainnya, dan langsung ikut terkumpul saat orang mengetik "unair".
 *
 * Yang terpanjang menang, supaya "UI" tidak merebut nama yang sebenarnya
 * diawali "UII".
 */
export function bentangkanAwalan(nama: string): string | null {
  const n = normalNama(nama);
  if (!n) return null;

  let terbaik: { alias: string; kanonik: string } | null = null;
  for (const [alias, entri] of INDEKS_ALIAS) {
    if (alias === n) return null; // sudah ditangani namaKanonik()
    if (!n.startsWith(alias + " ")) continue;
    if (!terbaik || alias.length > terbaik.alias.length) {
      terbaik = { alias, kanonik: entri.kanonik };
    }
  }
  if (!terbaik) return null;

  // Sisa nama diambil dari teks ASLI, bukan bentuk ternormalisasi, supaya
  // huruf besar & tanda bacanya tidak hilang ("Kampus A", bukan "kampus a").
  const kata = String(nama).trim().split(/\s+/);
  const jumlahAwalan = terbaik.alias.split(" ").length;
  const sisa = kata.slice(jumlahAwalan).join(" ").trim();
  return sisa ? `${terbaik.kanonik} ${sisa}` : terbaik.kanonik;
}

/** True bila nama ini punya entri kuratif — dipakai untuk MEMATIKAN akronim. */
export function adaAliasKuratif(nama: string): boolean {
  return INDEKS_ALIAS.has(normalNama(nama));
}

/**
 * Brand yang terkandung dalam sebuah nama tempat, atau null.
 *
 * Dicocokkan sebagai kata utuh di AWAL nama ("Indomaret Lidah Wetan"), bukan
 * di mana pun. Nama gerai Indonesia hampir selalu "Brand + lokasi", dan
 * pencocokan bebas-posisi membuat "Toko Sebelah Alfamart" ikut terhitung gerai
 * Alfamart — yang jelas bukan maksudnya.
 */
export function brandDari(nama: string): string | null {
  const n = normalNama(nama);
  if (!n) return null;
  for (const brand of BRAND_NORMAL) {
    if (n === brand || n.startsWith(brand + " ")) return brand;
  }
  return null;
}

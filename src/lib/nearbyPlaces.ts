/**
 * Kosakata "fasilitas di sekitar properti" — bagian yang dipakai BERSAMA oleh
 * server & browser: tipe data, kategori, ikon, warna, dan penerjemah hasil
 * mentah OpenStreetMap.
 *
 * TIDAK ADA PENGAMBILAN DATA DI FILE INI. Pencarian sesungguhnya (Overpass,
 * geocoding, penyimpanan) ada di `nearbyPlaces.server.ts` dan hanya berjalan di
 * server. Pemisahan itu disengaja dan penting:
 *
 *   - Dulu browser yang memanggil Overpass langsung, sekali untuk SETIAP kali
 *     halaman detail dibuka. Server publik Overpass menjawab 429/504 saat sibuk,
 *     jadi hasilnya seperti undian — dan kegagalannya tampil sebagai "tidak ada
 *     apa-apa di sekitar sini", kebohongan yang meyakinkan.
 *   - Warung di sekitar rumah tidak berubah tiap kali halaman dibuka. Jawaban
 *     yang sama dicari ribuan kali adalah pemborosan yang murni.
 *
 * Sekarang: server memindai SEKALI, menyimpannya di tabel `listing_sekitar`,
 * dan seluruh kunjungan berikutnya membaca baris itu.
 *
 * TIDAK ada string class Tailwind di sini — warna dipakai sebagai nilai inline
 * pada marker peta, jadi aman dari pemindaian Tailwind.
 */

import type { AksesTipe } from "@/app/tambah-property/types/listing";

export type KategoriPOI =
  | "food"
  | "mart"
  | "health"
  | "education"
  | "worship"
  | "transport"
  | "mall"
  | "gym"
  | "hotel"
  | "laundry";

export interface TempatTerdekat {
  id: string;
  nama: string;
  lat: number;
  lon: number;
  kategori: KategoriPOI;
  /** Jarak garis lurus dari properti, dalam meter. */
  jarak: number;
}

export interface KonfigKategori {
  label: string;
  icon: string;
  /** Warna marker & chip, sebagai nilai inline (bukan class Tailwind). */
  warna: string;
}

/**
 * Urutan sengaja mengikuti seberapa sering ditanyakan calon penghuni: makan
 * dulu, baru belanja, kesehatan, sekolah… Chip pertama yang terlihat tanpa
 * menggeser adalah yang paling menentukan.
 */
export const KATEGORI_POI: Record<KategoriPOI, KonfigKategori> = {
  food: { label: "Kuliner", icon: "solar:chef-hat-bold-duotone", warna: "#f97316" },
  mart: { label: "Minimarket", icon: "solar:cart-large-bold-duotone", warna: "#16a34a" },
  health: { label: "Kesehatan", icon: "solar:health-bold-duotone", warna: "#ef4444" },
  education: { label: "Pendidikan", icon: "solar:diploma-bold-duotone", warna: "#3b82f6" },
  // Ikonnya sengaja netral (bukan bulan-bintang): satu kategori ini memuat
  // masjid, gereja, dan pura sekaligus. Selama hanya jadi pin di peta, salah
  // ikon tidak terasa; begitu namanya ikut ditulis di daftar "yang ada di
  // sekitar", "Gereja X" berlambang bulan sabit jadi salah yang terlihat.
  worship: { label: "Ibadah", icon: "mdi:hands-pray", warna: "#8b5cf6" },
  transport: { label: "Transport", icon: "solar:bus-bold-duotone", warna: "#0ea5e9" },
  mall: { label: "Mall", icon: "solar:shop-2-bold-duotone", warna: "#a855f7" },
  gym: { label: "Gym", icon: "solar:dumbbell-large-bold-duotone", warna: "#2563eb" },
  hotel: { label: "Hotel", icon: "solar:bed-bold-duotone", warna: "#d946ef" },
  laundry: { label: "Laundry", icon: "solar:washing-machine-bold-duotone", warna: "#06b6d4" },
};

export const URUTAN_KATEGORI = Object.keys(KATEGORI_POI) as KategoriPOI[];

/**
 * Kategori POI → tipe patokan di form tambah properti.
 *
 * Dipakai saat agent mengadopsi hasil pindaian jadi patokan (lihat
 * PindaiSekitarPanel). Pemetaannya tidak bisa sempurna karena kedua kosakata
 * dibuat untuk keperluan berbeda: kategori POI menjawab "apa yang ada di
 * sekitar" (ada Kuliner & Laundry), sedangkan tipe patokan menjawab "apa yang
 * jadi alasan orang memilih tempat ini" (ada Bandara & Perkantoran yang tidak
 * pernah dipindai).
 *
 * Yang tidak punya padanan sengaja jatuh ke LAINNYA daripada dipaksakan:
 * "Mie Gacoan" bertipe PASAR lebih membingungkan daripada bertipe Lainnya, dan
 * tipe ini toh tinggal diganti agent lewat dropdown yang sudah ada di barisnya.
 */
export const AKSES_DARI_KATEGORI: Record<KategoriPOI, AksesTipe> = {
  food: "LAINNYA",
  mart: "MINIMARKET",
  health: "RUMAH_SAKIT",
  // Pindaian tidak membedakan sekolah dari kampus; SEKOLAH dipilih karena jauh
  // lebih sering benar, dan salahnya satu klik untuk dibetulkan.
  education: "SEKOLAH",
  worship: "MASJID",
  transport: "HALTE",
  mall: "MALL",
  gym: "LAINNYA",
  hotel: "LAINNYA",
  laundry: "LAINNYA",
};

/** Nama cadangan saat OSM tidak menyimpan `name` — lebih baik daripada "?" . */
const NAMA_CADANGAN: Record<KategoriPOI, string> = {
  food: "Tempat makan",
  mart: "Minimarket",
  health: "Apotek / klinik",
  education: "Sekolah / kampus",
  worship: "Tempat ibadah",
  transport: "Halte / stasiun",
  mall: "Pusat perbelanjaan",
  gym: "Gym",
  hotel: "Penginapan",
  laundry: "Laundry",
};

// ─────────────────────────────────────────────────────────────────────────────
// ATURAN PEMINDAIAN
// ─────────────────────────────────────────────────────────────────────────────

/** Radius bawaan & yang ditampilkan saat hasil datang dari langkah pertama. */
/**
 * Seberapa kasar sebuah titik aset — dan karenanya, seberapa jauh ia boleh
 * dipercaya.
 *
 * KENAPA HARUS DICATAT. Pencarian koordinat turun bertingkat: alamat lengkap →
 * kelurahan → kecamatan → kota, dan berhenti di anak tangga pertama yang
 * dijawab geocoder. Dulu semua hasil itu disimpan dengan cara yang sama persis,
 * sehingga aset lelang yang alamatnya cuma "Kel. Mangkujayan, Kec. Ponorogo"
 * tampil di peta seyakin aset yang koordinatnya ditandai agent di atas atapnya
 * sendiri. Pin yang meleset 3 km terlihat identik dengan pin yang tepat.
 *
 * Dari 120.395 aset tayang, 79.459 punya teks alamat setingkat jalan dan
 * sisanya tidak — ini bukan kasus pinggiran, ini bagian besar yang pantas
 * dikatakan apa adanya.
 *
 * Definisinya ada di file BERSAMA ini (bukan di nearbyPlaces.server.ts) karena
 * komponen peta di browser perlu membacanya untuk menulis kalimatnya.
 */
export type PresisiTitik =
  /** Koordinat ditandai agent sendiri di peta. */
  | "TITIK"
  /** Geocoder menemukan alamat setingkat jalan (±100 m). */
  | "ALAMAT"
  /** Berhenti di kelurahan/desa (±1 km). */
  | "KELURAHAN"
  /** Berhenti di kecamatan (±5 km). */
  | "KECAMATAN"
  /** Hanya kota yang dikenali (±15 km). Tidak pernah masuk indeks pencarian. */
  | "KOTA";

/** Urutan dari paling halus ke paling kasar. */
export const URUT_PRESISI: PresisiTitik[] = [
  "TITIK",
  "ALAMAT",
  "KELURAHAN",
  "KECAMATAN",
  "KOTA",
];

export const adalahPresisi = (v: unknown): v is PresisiTitik =>
  typeof v === "string" && (URUT_PRESISI as string[]).includes(v);

/**
 * Kalimat yang ditulis di bawah peta — sengaja MENYEBUT ANGKA MELESETNYA.
 *
 * "Posisinya perkiraan" adalah peringatan yang tidak bisa dipakai: pembacanya
 * tidak tahu apakah artinya meleset 50 m (tidak apa-apa) atau 8 km (asetnya
 * bahkan bukan di kecamatan yang ia kira). Yang berguna adalah SEBERAPA, dan
 * dari mana angka itu berasal.
 */
export const CATATAN_PRESISI: Record<PresisiTitik, string | null> = {
  TITIK: null,
  ALAMAT:
    "Titik ini hasil pencarian alamat, jadi letaknya perkiraan — biasanya tepat di ruas jalan yang benar.",
  KELURAHAN:
    "Alamat aset ini hanya diketahui sampai tingkat kelurahan/desa, jadi titiknya mewakili kelurahan — bukan bangunannya. Meleset ratusan meter itu wajar.",
  KECAMATAN:
    "Alamat aset ini hanya diketahui sampai tingkat kecamatan, jadi titiknya mewakili kecamatan — bukan bangunannya. Selisihnya bisa beberapa kilometer.",
  KOTA:
    "Alamat aset ini hanya dikenali sampai tingkat kota, jadi titik di peta mewakili KOTA, bukan lokasi asetnya. Pakai sebagai gambaran kasar saja.",
};

/** Label pendek untuk lencana di sudut peta. */
export const LABEL_PRESISI: Record<PresisiTitik, string | null> = {
  TITIK: null,
  ALAMAT: "Perkiraan · tingkat alamat",
  KELURAHAN: "Perkiraan · tingkat kelurahan",
  KECAMATAN: "Perkiraan · tingkat kecamatan",
  KOTA: "Perkiraan · tingkat kota",
};

export const RADIUS_POI_METER = 800;

/**
 * Tangga radius pemindaian.
 *
 * Satu radius tetap 800 m adalah asumsi kota: benar untuk kos di Surabaya,
 * salah total untuk gudang lelang di pinggir Sukabumi yang tetangga
 * terdekatnya 2 km. Aset seperti itu dulu selalu tampil "tidak ada apa-apa di
 * sekitar" — bukan karena sepi, tapi karena kita berhenti mencari terlalu
 * dekat. Sekarang radiusnya naik bertahap sampai dapat cukup tempat, dan
 * radius yang akhirnya dipakai ikut ditampilkan supaya jaraknya jujur.
 */
export const RADIUS_TANGGA = [800, 1500, 3000, 6000] as const;

/**
 * Ambang "cukup". Di bawah ini hasilnya tidak dianggap final: belum disimpan
 * sebagai jawaban, dan boleh dicoba lagi nanti. Tiga adalah jumlah terkecil
 * yang masih membentuk gambaran ("ada minimarket, sekolah, dan masjid");
 * dengan satu tempat, pembaca tidak tahu apakah itu memang sepi atau
 * pencariannya yang setengah jalan.
 */
export const MIN_TEMPAT = 3;

/** Batas hasil — lebih dari ini, peta jadi lautan pin dan tidak terbaca lagi. */
export const MAKS_HASIL = 60;

// ─────────────────────────────────────────────────────────────────────────────
// PERHITUNGAN & PENERJEMAHAN
// ─────────────────────────────────────────────────────────────────────────────

/** Jarak garis lurus (haversine) dalam meter. */
export function jarakMeter(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const R = 6_371_000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const p =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(p), Math.sqrt(1 - p)));
}

function klasifikasi(tags: Record<string, string>): KategoriPOI | null {
  const { amenity, shop, leisure, tourism, healthcare, railway, highway } = tags;

  if (amenity === "place_of_worship") return "worship";
  if (["university", "school", "college", "kindergarten"].includes(amenity))
    return "education";
  if (["pharmacy", "clinic", "hospital", "doctors"].includes(amenity) || healthcare)
    return "health";
  if (["laundry", "dry_cleaning"].includes(shop)) return "laundry";
  if (["gym", "fitness_centre", "sports_centre"].includes(leisure)) return "gym";
  if (["hotel", "guest_house", "hostel", "motel", "apartment"].includes(tourism))
    return "hotel";
  if (["mall", "department_store"].includes(shop)) return "mall";
  if (["convenience", "supermarket"].includes(shop)) return "mart";
  if (
    tags.public_transport ||
    railway === "station" ||
    amenity === "bus_station" ||
    highway === "bus_stop"
  )
    return "transport";
  if (["restaurant", "cafe", "fast_food", "food_court", "ice_cream"].includes(amenity))
    return "food";

  return null;
}

/**
 * Query Overpass untuk satu titik & radius.
 *
 * Pakai `nwr` (node/way/relation) + `center`, bukan `node` saja: sekolah, mall,
 * dan rumah sakit di OSM hampir selalu digambar sebagai AREA, bukan titik —
 * query yang hanya mengambil node membuat justru fasilitas terbesar di sekitar
 * properti tidak pernah muncul.
 */
export function bangunQueryOverpass(lat: number, lon: number, radius: number): string {
  return `
    [out:json][timeout:25];
    (
      nwr["amenity"~"^(restaurant|cafe|fast_food|food_court|ice_cream|pharmacy|clinic|hospital|doctors|place_of_worship|university|school|college|kindergarten|bus_station)$"](around:${radius},${lat},${lon});
      nwr["shop"~"^(laundry|dry_cleaning|mall|department_store|convenience|supermarket)$"](around:${radius},${lat},${lon});
      nwr["leisure"~"^(gym|fitness_centre|sports_centre)$"](around:${radius},${lat},${lon});
      nwr["tourism"~"^(hotel|guest_house|hostel|motel)$"](around:${radius},${lat},${lon});
      nwr["railway"="station"](around:${radius},${lat},${lon});
      node["highway"="bus_stop"](around:${radius},${lat},${lon});
      nwr["public_transport"="station"](around:${radius},${lat},${lon});
    );
    out center ${MAKS_HASIL * 3};
  `;
}

/**
 * Ubah jawaban mentah Overpass jadi daftar tempat yang siap ditampilkan:
 * dibuang yang tidak berkategori, dihitung jaraknya, dibuang kembarannya, lalu
 * diurutkan dari yang terdekat.
 */
export function petakanElemen(
  elemen: any[],
  lat: number,
  lon: number,
): TempatTerdekat[] {
  const hasil: TempatTerdekat[] = [];
  const terlihat = new Set<string>();

  for (const el of Array.isArray(elemen) ? elemen : []) {
    const tags = (el?.tags ?? {}) as Record<string, string>;
    const kategori = klasifikasi(tags);
    if (!kategori) continue;

    // Way/relation tidak punya lat/lon sendiri — `out center` menaruhnya di
    // properti `center`.
    const pLat = el.lat ?? el.center?.lat;
    const pLon = el.lon ?? el.center?.lon;
    if (typeof pLat !== "number" || typeof pLon !== "number") continue;

    const nama = (tags.name || "").trim() || NAMA_CADANGAN[kategori];

    // Satu tempat bisa muncul sebagai node DAN way (mis. gedung + titik POI).
    // Kuncinya nama+kategori, bukan id, supaya pin tidak menumpuk persis.
    const kunci = `${kategori}|${nama.toLowerCase()}`;
    if (terlihat.has(kunci)) continue;
    terlihat.add(kunci);

    hasil.push({
      id: `${el.type}-${el.id}`,
      nama,
      lat: pLat,
      lon: pLon,
      kategori,
      jarak: jarakMeter(lat, lon, pLat, pLon),
    });
  }

  // Yang terdekat menang saat dipotong: kalau harus membuang, buang yang paling
  // jauh — bukan yang kebetulan datang terakhir dari Overpass.
  return hasil.sort((a, b) => a.jarak - b.jarak).slice(0, MAKS_HASIL);
}

/**
 * Terjemahkan jawaban Photon (sumber cadangan) ke bentuk yang sama.
 *
 * Photon memakai skema OSM yang sama, hanya rata: satu pasang `osm_key` /
 * `osm_value` per fitur, bukan kantong tag. Dirakit ulang jadi bentuk tag
 * supaya melewati penggolong yang sama persis dengan hasil Overpass — dua
 * sumber, satu aturan, jadi kategorinya tidak mungkin berbeda arti.
 */
export function petakanFiturPhoton(
  fitur: any[],
  lat: number,
  lon: number,
): TempatTerdekat[] {
  const elemen = (Array.isArray(fitur) ? fitur : [])
    .map((f) => {
      const koor = f?.geometry?.coordinates;
      const p = f?.properties ?? {};
      if (!Array.isArray(koor) || koor.length < 2 || !p.osm_key) return null;
      return {
        type: String(p.osm_type ?? "N").toLowerCase(),
        id: p.osm_id,
        lat: Number(koor[1]),
        lon: Number(koor[0]),
        tags: { [p.osm_key]: String(p.osm_value ?? ""), name: p.name ?? "" },
      };
    })
    .filter(Boolean);

  return petakanElemen(elemen as any[], lat, lon);
}

/**
 * Pilih radius terkecil yang sudah memuat cukup tempat, lalu potong daftarnya
 * ke radius itu.
 *
 * Dipakai dua sumber sekaligus supaya angka "Radius 800 m" di layar selalu
 * berarti sama: batas terkecil yang benar-benar memuat isi daftarnya. Tanpa
 * ini, hasil dari sumber cadangan (yang mencari sejauh mungkin sekaligus) akan
 * menampilkan tempat 4 km di bawah judul "radius 800 m".
 */
export function pilihRadius(tempat: TempatTerdekat[]): {
  radius: number;
  tempat: TempatTerdekat[];
} {
  const terbesar = RADIUS_TANGGA[RADIUS_TANGGA.length - 1];
  for (const r of RADIUS_TANGGA) {
    const dalam = tempat.filter((t) => t.jarak <= r);
    if (dalam.length >= MIN_TEMPAT) return { radius: r, tempat: dalam };
  }
  return { radius: terbesar, tempat: tempat.filter((t) => t.jarak <= terbesar) };
}

/** Penjaga bentuk untuk data yang dibaca kembali dari kolom JSON. */
export function bacaTempatJson(nilai: unknown): TempatTerdekat[] {
  if (!Array.isArray(nilai)) return [];
  return nilai.filter(
    (t: any): t is TempatTerdekat =>
      !!t &&
      typeof t.nama === "string" &&
      typeof t.lat === "number" &&
      typeof t.lon === "number" &&
      typeof t.jarak === "number" &&
      typeof t.kategori === "string" &&
      t.kategori in KATEGORI_POI,
  );
}

export const formatJarak = (m: number): string => {
  // "0 m" muncul saat titik properti kebetulan berimpit dengan POI-nya (lazim
  // pada titik hasil geocode alamat) dan terbaca seperti data rusak. Jarak
  // sekecil ini juga tidak berarti apa-apa: yang benar disampaikan adalah
  // "persis di sebelah", bukan angka.
  if (m < 50) return "< 50 m";
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;
};

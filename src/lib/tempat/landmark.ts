/**
 * Sapuan landmark — bagian yang membuat "deket UNESA" mungkin.
 *
 * ── MASALAHNYA ──────────────────────────────────────────────────────────────
 * Pemindaian "apa yang ada di sekitar" (src/lib/nearbyPlaces.ts) berhenti di
 * radius terkecil yang sudah memuat 3 tempat. Di kota itu selalu anak tangga
 * pertama: 800 m. Terukur di data — 54 dari 68 pemindaian lengkap berhenti di
 * situ. Untuk daftar yang dibaca manusia di halaman detail, itu perilaku yang
 * BENAR: yang ingin dilihat adalah warung dan masjid yang bisa dijalani kaki.
 *
 * Tapi untuk PENCARIAN, itu fatal. Kampus 4 km tidak pernah tercatat, padahal
 * "dekat kampus" memang berarti sejauh itu — tidak ada mahasiswa yang menolak
 * kos karena kampusnya 4 km. Aset contoh di Balas Klumprik memperlihatkannya
 * dengan telak: UNESA muncul di halaman detailnya sebagai patokan yang diketik
 * agent, sementara daftar hasil pindainya (radius 800 m, 16 tempat) tidak
 * memuat satu pun kampus.
 *
 * ── SOLUSINYA ───────────────────────────────────────────────────────────────
 * Satu kueri Overpass KEDUA, terpisah, radius tetap 5 km, dan hanya untuk
 * kelas yang layak jadi patokan. Hasilnya tidak pernah ikut ditampilkan di
 * daftar "Radius 800 m" — ia disimpan di kolomnya sendiri dan hanya menjadi
 * bahan bakar indeks pencarian.
 *
 * Kenapa hanya kelas tertentu: minimarket dan warung jumlahnya ratusan dalam
 * radius 5 km, dan tidak seorang pun memilih rumah karena ada Indomaret 4 km.
 * Landmark sebaliknya — sedikit, dan justru itulah yang jadi alasan orang
 * memilih lokasi.
 */

import {
  KELAS_TEMPAT,
  type KelasTempat,
  normalTeks,
} from "./normalisasi";

/** Radius sapuan landmark. Lihat RADIUS_JANGKAUAN.LANDMARK. */
export const RADIUS_LANDMARK = 5_000;

/**
 * Batas atas jarak PER KELAS saat masuk indeks.
 *
 * Tidak semua landmark "dekat"-nya sejauh 5 km. Orang memilih rumah karena
 * sekolah anaknya 1 km, bukan 5 km — sedangkan bandara 5 km justru dekat
 * sekali menurut ukuran bandara. Kelas yang tidak disebut di sini memakai
 * RADIUS_LANDMARK penuh.
 */
export const RADIUS_INDEKS: Partial<Record<KelasTempat, number>> = {
  SEKOLAH: 2_500,
  PASAR: 3_000,
  PERKANTORAN: 3_000,
  STADION: 4_000,
};

/**
 * Batas jumlah PER KELAS, dan batas total.
 *
 * Tanpa ini, satu aset di pusat Surabaya menghasilkan 150-an baris indeks —
 * hampir semuanya sekolah, dan hampir semuanya tidak pernah dicari siapa pun.
 * Dikalikan 120 ribu aset, itu belasan juta baris yang dibayar penuh biaya
 * tulis & indeksnya untuk nilai nol.
 *
 * Empat per kelas dipilih karena yang orang cari adalah SATU tempat tertentu
 * ("deket unesa"), bukan daftar; yang penting tempat itu ada di indeks, bukan
 * bahwa seluruh tetangganya ikut. Yang terdekat yang dipertahankan.
 */
const MAKS_PER_KELAS = 4;
const MAKS_LANDMARK = 30;

export interface TempatLandmark {
  id: string;
  nama: string;
  lat: number;
  lon: number;
  kelas: KelasTempat;
  /** Jarak garis lurus dari titik aset, meter. */
  jarak: number;
  /**
   * Nama lain dari tag OpenStreetMap (short_name / alt_name / official_name /
   * name:en / nickname). INI SUMBER ALIAS TERBAIK yang kita punya: ditulis
   * pemeta setempat yang tahu bahwa kampus itu memang dipanggil "UNESA",
   * gratis, dan sudah ada di sana sebelum kita mulai.
   */
  alias?: string[];
  /** Tag brand/operator — dipakai mengelompokkan cabang. */
  brand?: string | null;
}

/**
 * Kueri Overpass khusus landmark.
 *
 * Memakai `nwr` + `out center` dengan alasan yang sama seperti kueri utama:
 * kampus, mall, dan rumah sakit di OSM hampir selalu digambar sebagai AREA,
 * bukan titik. Kueri yang hanya mengambil node membuat justru bangunan
 * terbesar di sekitar properti tidak pernah muncul — kegagalan yang paling
 * mahal, karena yang terbesar itulah yang jadi patokan orang.
 */
export function bangunQueryLandmark(
  lat: number,
  lon: number,
  radius: number = RADIUS_LANDMARK,
): string {
  const a = `(around:${radius},${lat},${lon})`;
  return `
    [out:json][timeout:30];
    (
      nwr["amenity"~"^(university|college|hospital|marketplace|bus_station)$"]["name"]${a};
      nwr["amenity"~"^(school|kindergarten)$"]["name"](around:${Math.min(radius, RADIUS_INDEKS.SEKOLAH ?? radius)},${lat},${lon});
      nwr["shop"~"^(mall|department_store)$"]["name"]${a};
      nwr["railway"="station"]["name"]${a};
      nwr["aeroway"="aerodrome"]["name"]${a};
      nwr["leisure"="stadium"]["name"]${a};
      nwr["tourism"~"^(attraction|museum|zoo|theme_park)$"]["name"]${a};
      nwr["amenity"="ferry_terminal"]["name"]${a};
      nwr["landuse"="retail"]["name"]["shop"]${a};
    );
    out center 400;
  `;
}

/** Tag OpenStreetMap → kelas tempat. Null = bukan landmark. */
export function klasifikasiLandmark(
  tags: Record<string, string>,
): KelasTempat | null {
  const { amenity, shop, railway, aeroway, leisure, tourism } = tags;

  if (amenity === "university" || amenity === "college") return "KAMPUS";
  if (amenity === "school" || amenity === "kindergarten") return "SEKOLAH";
  if (amenity === "hospital") return "RUMAH_SAKIT";
  if (amenity === "marketplace") return "PASAR";
  if (amenity === "bus_station") return "TERMINAL";
  if (amenity === "ferry_terminal") return "TERMINAL";
  if (shop === "mall" || shop === "department_store") return "MALL";
  if (railway === "station") return "STASIUN";
  if (aeroway === "aerodrome") return "BANDARA";
  if (leisure === "stadium") return "STADION";
  if (["attraction", "museum", "zoo", "theme_park"].includes(tourism)) return "WISATA";

  return null;
}

/**
 * Alias dari kantong tag OSM.
 *
 * `alt_name` boleh berisi beberapa nama dipisah titik koma — itu konvensi OSM,
 * bukan kecelakaan data, jadi dipecah alih-alih disimpan utuh sebagai satu
 * nama panjang yang tidak akan pernah cocok dengan apa pun.
 *
 * `official_name` sengaja ikut walau panjang dan kaku ("Rumah Sakit Umum
 * Daerah Dokter Soetomo"): justru bentuk resmi itu yang muncul di dokumen dan
 * kadang diketik orang yang menyalin dari surat.
 */
const TAG_ALIAS = [
  "short_name",
  "alt_name",
  "official_name",
  "name:en",
  "name:id",
  "nickname",
  "old_name",
  "loc_name",
];

export function aliasDariTag(tags: Record<string, string>): string[] {
  const keluar = new Set<string>();
  for (const kunci of TAG_ALIAS) {
    const nilai = tags[kunci];
    if (!nilai) continue;
    for (const bagian of String(nilai).split(";")) {
      const bersih = bagian.trim();
      // Dua huruf tidak pernah cukup membedakan apa pun dan akan menarik hasil
      // acak; nama 120 huruf bukan nama, itu deskripsi.
      if (bersih.length >= 3 && bersih.length <= 120) keluar.add(bersih);
    }
  }
  return [...keluar];
}

/**
 * Ubah jawaban mentah Overpass jadi daftar landmark siap indeks: yang bukan
 * landmark dibuang, jaraknya dihitung, kembarannya dibuang, dipotong ke batas
 * per kelas dan total — semuanya dari yang terdekat.
 */
export function petakanLandmark(
  elemen: any[],
  lat: number,
  lon: number,
): TempatLandmark[] {
  const hasil: TempatLandmark[] = [];
  const terlihat = new Set<string>();

  for (const el of Array.isArray(elemen) ? elemen : []) {
    const tags = (el?.tags ?? {}) as Record<string, string>;
    const kelas = klasifikasiLandmark(tags);
    if (!kelas) continue;

    const nama = String(tags.name ?? "").trim();
    // Landmark TANPA NAMA tidak berguna sama sekali di sini. Beda dengan
    // daftar "yang ada di sekitar" yang masih bisa menulis "Tempat makan" —
    // di indeks pencarian, tempat tanpa nama adalah baris yang tidak mungkin
    // dicari siapa pun.
    if (nama.length < 3) continue;

    const pLat = el.lat ?? el.center?.lat;
    const pLon = el.lon ?? el.center?.lon;
    if (typeof pLat !== "number" || typeof pLon !== "number") continue;

    const jarak = jarakLurus(lat, lon, pLat, pLon);
    if (jarak > (RADIUS_INDEKS[kelas] ?? RADIUS_LANDMARK)) continue;

    // Satu tempat sering muncul dua kali (node POI + way bangunan). Dikunci
    // nama+kelas, bukan id, supaya keduanya tidak jadi dua baris kamus.
    const kunci = `${kelas}|${normalTeks(nama)}`;
    if (terlihat.has(kunci)) continue;
    terlihat.add(kunci);

    hasil.push({
      id: `${el.type}-${el.id}`,
      nama,
      lat: pLat,
      lon: pLon,
      kelas,
      jarak,
      alias: aliasDariTag(tags),
      brand: tags.brand?.trim() || tags.operator?.trim() || null,
    });
  }

  hasil.sort((a, b) => a.jarak - b.jarak);

  const perKelas = new Map<KelasTempat, number>();
  const dipilih: TempatLandmark[] = [];
  for (const t of hasil) {
    const n = perKelas.get(t.kelas) ?? 0;
    if (n >= MAKS_PER_KELAS) continue;
    perKelas.set(t.kelas, n + 1);
    dipilih.push(t);
    if (dipilih.length >= MAKS_LANDMARK) break;
  }
  return dipilih;
}

/** Haversine, meter. Disalin seperlunya supaya modul ini tidak saling impor. */
function jarakLurus(aLat: number, aLon: number, bLat: number, bLon: number): number {
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

/** Hitung ulang jarak dari titik yang sebenarnya — sepola setelJarak(). */
export function setelJarakLandmark(
  daftar: TempatLandmark[],
  lat: number,
  lon: number,
): TempatLandmark[] {
  return daftar
    .map((t) => ({ ...t, jarak: jarakLurus(lat, lon, t.lat, t.lon) }))
    .filter((t) => t.jarak <= (RADIUS_INDEKS[t.kelas] ?? RADIUS_LANDMARK))
    .sort((a, b) => a.jarak - b.jarak);
}

/** Penjaga bentuk untuk data yang dibaca kembali dari kolom JSON. */
export function bacaLandmarkJson(nilai: unknown): TempatLandmark[] {
  if (!Array.isArray(nilai)) return [];
  return nilai.filter(
    (t: any): t is TempatLandmark =>
      !!t &&
      typeof t.nama === "string" &&
      typeof t.lat === "number" &&
      typeof t.lon === "number" &&
      typeof t.jarak === "number" &&
      typeof t.kelas === "string" &&
      t.kelas in KELAS_TEMPAT,
  );
}

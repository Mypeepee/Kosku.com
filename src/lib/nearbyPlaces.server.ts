/**
 * Mesin "apa yang ada di sekitar aset ini" — HANYA berjalan di server.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * MASALAH YANG DIPERBAIKI
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Versi sebelumnya memanggil Overpass langsung dari browser, sekali untuk
 * setiap kali halaman detail dibuka. Tiga cacat sekaligus:
 *
 *   1. SEPERTI UNDIAN. Server publik Overpass gratis dan tanpa kunci, tapi
 *      sering menjawab 429/504 saat sibuk. Sekali gagal, halaman menampilkan
 *      "tidak ada apa-apa di sekitar sini" — yang dibaca pengunjung sebagai
 *      fakta tentang properti, bukan sebagai kegagalan jaringan.
 *   2. RADIUS TETAP 800 m. Benar untuk kos di tengah kota, salah total untuk
 *      gudang lelang di pinggiran yang tetangga terdekatnya 2 km. Aset seperti
 *      itu SELALU kosong, konsisten dan konsisten salah.
 *   3. BOROS. Warung tidak pindah tiap kali halaman dibuka. Satu aset yang
 *      dilihat seribu kali menghasilkan seribu pencarian untuk jawaban yang
 *      identik.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * BAGAIMANA SEKARANG
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   BACA CACHE ─ lengkap? ─ ya ─→ selesai (nol permintaan keluar)
 *        │
 *        tidak
 *        ↓
 *   TENTUKAN TITIK  koordinat listing → kalau kosong, geocode alamat
 *        │          (Nominatim, lalu Google sebagai cadangan; alamatnya
 *        │           dipendekkan bertahap sampai ketemu)
 *        ↓
 *   CACHE TITIK ─ titik ini sudah pernah dipindai? ─ ya ─→ pakai (nol
 *        │          permintaan keluar). Lapisan kedua, dikunci koordinat
 *        │          dibulatkan ±110 m — bukan id_property. Ia melayani yang
 *        tidak       tidak punya id: form tambah properti memindai sebelum
 *        ↓          listing-nya ada, dan unit-unit di gedung yang sama berbagi
 *        │          satu titik. Lihat bagian CACHE PER TITIK di bawah.
 *        ↓
 *   PINDAI          radius 800 → 1500 → 3000 → 6000 m, berhenti begitu dapat
 *        │          ≥3 tempat; tiap radius dicoba ke beberapa server Overpass
 *        │          bergantian, dua ronde, dengan jeda. Jawaban KOSONG selalu
 *        │          diverifikasi ke server kedua sebelum dipercaya, dan bila
 *        │          Overpass tetap tidak memadai, sumber cadangan (Photon)
 *        │          yang dipakai.
 *        ↓
 *   SIMPAN          ≥3 tempat → baris LENGKAP, tidak akan dipindai lagi.
 *                   1–2 tempat → disimpan apa adanya, boleh dicoba lagi setelah
 *                   JEDA_ULANG_MS. 0 tempat → lihat aturan "nol" di bawah.
 *
 * Satu permintaan per aset seumur hidup aset itu, bukan satu per kunjungan.
 *
 * ATURAN "NOL". Nol tempat punya dua arti yang berlawanan dan terlihat sama:
 * daerahnya memang sepi, atau penyedianya sedang tidak menjawab. Keduanya
 * dibedakan lewat `tuntas` (seluruh tangga radius benar-benar dijawab) dan
 * disimpan berbeda: `radius_meter > 0` berarti nol yang sah, `radius_meter = 0`
 * berarti pencarian yang putus — yang terakhir dilaporkan sebagai "gagal" ke
 * UI (bukan "tidak ada apa-apa di sini") dan dicoba lagi dalam hitungan jam.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * SIFAT YANG SENGAJA DIPILIH
 * ════════════════════════════════════════════════════════════════════════════
 *
 * - TAHAN TANPA TABEL. Bila `listing_sekitar` belum dibuat (SQL-nya dijalankan
 *   manual per environment, lihat prisma/migration_listing_sekitar.sql), semua
 *   sentuhan DB di sini gagal diam-diam dan mesin kembali memindai langsung.
 *   Urutan deploy tidak bisa membuat halaman detail mati.
 * - SATU PEMINDAIAN PER ASET PADA SATU WAKTU. Sepuluh pengunjung yang membuka
 *   aset yang sama bersamaan berbagi satu janji (single-flight), bukan memicu
 *   sepuluh pemindaian identik.
 * - TIDAK PERNAH MELEMPAR. Halaman detail tidak boleh gagal hanya karena
 *   daftar warung tidak ketemu; kegagalan dilaporkan sebagai status, bukan
 *   sebagai exception.
 */

import prisma from "@/lib/prisma";
import {
  MAKS_HASIL,
  MIN_TEMPAT,
  RADIUS_TANGGA,
  bacaTempatJson,
  bangunQueryOverpass,
  jarakMeter,
  petakanElemen,
  petakanFiturPhoton,
  pilihRadius,
  URUT_PRESISI,
  adalahPresisi,
  type PresisiTitik,
  type TempatTerdekat,
} from "@/lib/nearbyPlaces";
import {
  RADIUS_LANDMARK,
  bacaLandmarkJson,
  bangunQueryLandmark,
  petakanLandmark,
  setelJarakLandmark,
  type TempatLandmark,
} from "@/lib/tempat/landmark";
import {
  serapKamusDariPatokan,
  serapKamusDariPindaian,
} from "@/lib/tempat/serap";

// ─────────────────────────────────────────────────────────────────────────────
// BENTUK DATA
// ─────────────────────────────────────────────────────────────────────────────

export type SumberTitik = "LISTING" | "GEOCODE";

export type { PresisiTitik };

export interface TitikAset {
  lat: number;
  lng: number;
  sumber: SumberTitik;
  presisi?: PresisiTitik;
}

export type StatusSekitar =
  /** Dibaca dari tabel — tidak ada permintaan keluar sama sekali. */
  | "tersimpan"
  /** Baru dipindai pada permintaan ini. */
  | "baru"
  /** Semua server Overpass menolak; hasilnya belum bisa dipastikan. */
  | "gagal"
  /** Koordinat tidak ada dan alamatnya tidak bisa di-geocode. */
  | "tanpa-titik";

export interface SekitarPayload {
  titik: TitikAset | null;
  /** Radius (meter) yang akhirnya dipakai; 0 bila belum pernah berhasil. */
  radius: number;
  tempat: TempatTerdekat[];
  /** ≥ MIN_TEMPAT tempat ditemukan → jawaban final, tidak dipindai lagi. */
  lengkap: boolean;
  status: StatusSekitar;
  dipindaiPada: string | null;
  /**
   * Hasil sapuan landmark 5 km. TIDAK untuk ditampilkan di daftar "yang ada
   * di sekitar" — daftar itu bertajuk "Radius 800 m", dan menyelipkan bandara
   * 4 km ke sana membuat tajuknya bohong. Ini bahan bakar indeks pencarian
   * "dekat X", dan halaman detail memakainya untuk kalimat terpisah
   * ("5 menit ke UNESA").
   */
  landmark?: TempatLandmark[];
}

// ─────────────────────────────────────────────────────────────────────────────
// TETAPAN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Server Overpass, dicoba bergantian.
 *
 * Overpass gratis dan tanpa kunci, harganya: server publiknya sering kelebihan
 * beban. Satu server saja berarti satu 504 = "tidak ada apa-apa di sekitar
 * sini". Titik awal putarannya digeser tiap panggilan (lihat `mulaiDari`)
 * supaya beban tidak selalu jatuh ke server pertama dan satu server yang
 * sedang mati tidak selalu jadi percobaan pertama.
 */
const SERVER_OVERPASS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

/**
 * ⚠️ JANGAN MASUKKAN `overpass.osm.ch` KE DAFTAR DI ATAS.
 *
 * Instansi itu menjawab HTTP 200 dengan `elements: []` untuk koordinat
 * Indonesia — basis datanya hanya Eropa. Diuji langsung: satu titik di pusat
 * Surabaya menghasilkan 30 tempat di overpass-api.de dan 0 di osm.ch, tanpa
 * error, tanpa `remark`, tanpa apa pun yang bisa dibedakan dari "daerah ini
 * memang kosong".
 *
 * Inilah penyebab utama fitur ini dulu terasa seperti undian: separuh
 * permintaan mendarat di server yang tidak punya datanya, lalu jawabannya
 * "tidak ada apa-apa di sekitar sini" disimpan seolah fakta. Kegagalan yang
 * paling mahal bukan yang melempar error — melainkan yang menjawab dengan
 * percaya diri.
 */

let mulaiDari = 0;

/** Batas tunggu per server. Overpass yang sehat menjawab < 5 detik. */
const BATAS_TUNGGU_MS = 12_000;

/**
 * Anggaran waktu untuk SATU pemindaian, seluruhnya.
 *
 * Tanpa ini, kasus terburuk adalah perkalian yang jahat: 4 tangga radius × 4
 * server × 2 ronde × batas tunggu. Pernah terukur 125 detik untuk satu aset —
 * dan yang menunggu adalah pengunjung pertama yang membuka halamannya. Dengan
 * anggaran, pencarian berhenti di titik terbaik yang sudah didapat, lalu
 * dilanjutkan pada kunjungan berikutnya (hasil nol punya tenggat ulang yang
 * pendek). Lebih baik jawaban seadanya dalam 40 detik daripada jawaban sempurna
 * yang tidak pernah dilihat siapa pun.
 */
const ANGGARAN_PINDAI_MS = 40_000;

/** Sisa waktu yang tetap diberikan ke sumber cadangan walau anggaran habis. */
const CADANGAN_MS = 12_000;

/**
 * Jatah waktu sapuan landmark, di luar anggaran pemindaian utama.
 *
 * Sengaja terpisah dan sengaja kecil. Sapuan ini melayani PENCARIAN, sedangkan
 * anggaran utama melayani orang yang sedang menunggu halaman detail terbuka —
 * dan yang sedang menunggu selalu menang. Kalau sapuannya tidak selesai dalam
 * jatah ini, ia dilewati tanpa suara: aset itu cuma belum masuk indeks "dekat
 * X" hari ini, dan pemindaian berikutnya akan mencobanya lagi. Tidak ada yang
 * rusak, tidak ada yang perlu dilaporkan ke siapa pun.
 */
const LANDMARK_MS = 14_000;
/** Berapa kali seluruh daftar server diulang sebelum menyerah. */
const RONDE = 2;
/** Jeda antar ronde — memberi kesempatan server yang sedang antre. */
const JEDA_RONDE_MS = 800;

/**
 * Jeda sebelum aset yang hasilnya belum lengkap boleh dipindai ulang.
 *
 * Ada aset yang memang di tengah kebun: dipindai seratus kali pun hasilnya
 * tetap dua tempat. Tanpa jeda, aset seperti itu memicu empat permintaan
 * Overpass (satu per anak tangga radius) SETIAP kali halamannya dibuka —
 * persis pemborosan yang ingin dihentikan. Tujuh hari cukup untuk menangkap
 * data OSM yang baru ditambahkan tanpa jadi beban.
 */
const JEDA_ULANG_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Jeda untuk hasil NOL tempat — jauh lebih pendek.
 *
 * Nol adalah angka yang mencurigakan: di Indonesia, radius 6 km tanpa satu pun
 * warung, sekolah, atau musala praktis tidak ada. Jadi nol hampir selalu berarti
 * kedua penyedia sedang menolak, bukan sekitar yang benar-benar kosong.
 * Barisnya tetap ditulis agar kunjungan berikutnya tidak langsung memindai
 * lagi, tapi tenggatnya dihitung jam, bukan minggu.
 */
const JEDA_KOSONG_MS = 6 * 60 * 60 * 1000;

/** Jeda minimum antar pemindaian paksa (tombol "coba lagi" agent). */
const JEDA_PAKSA_MS = 60_000;

/** Nominatim meminta maksimum 1 permintaan per detik, dan itu dihormati. */
const JEDA_NOMINATIM_MS = 1_100;

/** Identitas wajib untuk Nominatim; tanpa ini permintaannya diblokir. */
const AGEN_HTTP =
  "SolusindoAset/1.0 (+https://solusindoaset.com; kontak: closingsystem@gmail.com)";

// ─────────────────────────────────────────────────────────────────────────────
// UTILITAS
// ─────────────────────────────────────────────────────────────────────────────

const tidur = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Log sekali saja per jenis, supaya tabel yang belum dibuat tidak membanjiri log. */
const sudahDilaporkan = new Set<string>();
function laporSekali(kunci: string, pesan: string, e?: unknown) {
  if (sudahDilaporkan.has(kunci)) return;
  sudahDilaporkan.add(kunci);
  console.warn(`[sekitar] ${pesan}`, e ?? "");
}

const angka = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const titikSah = (lat: number | null, lng: number | null): boolean =>
  lat != null &&
  lng != null &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180 &&
  // (0,0) di Teluk Guinea adalah nilai bawaan yang lolos dari form, bukan
  // lokasi properti mana pun di Indonesia.
  !(Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001);

// ─────────────────────────────────────────────────────────────────────────────
// OVERPASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sekring. Ketika SEMUA server Overpass menolak, tidak ada gunanya pengunjung
 * berikutnya mengulangi seluruh putaran yang barusan memakan 40 detik — ia
 * hanya menambah beban ke server yang sedang jatuh dan membuat halamannya ikut
 * lambat. Selama tenggat ini, pemindaian langsung memakai sumber cadangan.
 */
let sekringSampai = 0;
const SEKRING_MS = 60_000;

/** Jarak minimum antar permintaan Overpass dari proses ini — sopan santun. */
const JEDA_OVERPASS_MS = 600;
let overpassTerakhir = 0;

/**
 * Ingatan pendek per server: yang baru saja gagal dilewati sebentar.
 *
 * Sekring di atas berlaku global (semua server jatuh). Yang jauh lebih sering
 * terjadi adalah SATU server yang sedang tidak sehat sementara yang lain
 * baik-baik saja — dan tanpa ingatan ini, server itu tetap dicoba di SETIAP
 * anak tangga radius, masing-masing membakar 12 detik batas tunggu sampai
 * di-abort. Terukur pada satu titik di Malang selatan: dua server yang sakit
 * memakan ±24 detik per tangga, sehingga anggaran 40 detik habis sebelum
 * pemindaian sempat naik ke radius yang justru menyimpan jawabannya (0 tempat
 * di 1,5 km, 43 tempat di 6 km).
 *
 * Bukan penilaian permanen: dua menit kemudian server itu dicoba lagi.
 */
const serverSakit = new Map<string, number>();
const SAKIT_MS = 120_000;

/**
 * Urutan server untuk satu permintaan: yang sehat dulu.
 *
 * Kalau ternyata SEMUA sedang ditandai sakit, daftarnya dipakai utuh — lebih
 * baik mencoba server yang tadi bermasalah daripada tidak mencoba sama sekali.
 */
function urutanServer(): string[] {
  const sekarang = Date.now();
  const sehat: string[] = [];
  const sakit: string[] = [];
  for (let i = 0; i < SERVER_OVERPASS.length; i++) {
    const url = SERVER_OVERPASS[(mulaiDari + i) % SERVER_OVERPASS.length];
    ((serverSakit.get(url) ?? 0) > sekarang ? sakit : sehat).push(url);
  }
  return sehat.length > 0 ? sehat : sakit;
}

interface JawabanOverpass {
  json: any;
  /** Server yang menjawab — dipakai untuk memverifikasi jawaban kosong. */
  url: string;
}

async function tanyaOverpass(
  query: string,
  lewati?: string,
  /**
   * Tenggat keseluruhan pemindaian. Diperiksa DI DALAM putaran server, bukan
   * hanya di antara tangga radius: satu tangga saja bisa memakan 4 server × 2
   * ronde × batas tunggu, dan itulah yang dulu membuat satu aset menahan
   * pengunjungnya 90 detik.
   */
  tenggat?: number,
): Promise<JawabanOverpass> {
  let terakhir: unknown = null;

  const jeda = JEDA_OVERPASS_MS - (Date.now() - overpassTerakhir);
  if (jeda > 0) await tidur(jeda);
  overpassTerakhir = Date.now();

  for (let ronde = 0; ronde < RONDE; ronde++) {
    const daftar = urutanServer();
    for (let i = 0; i < daftar.length; i++) {
      if (tenggat && Date.now() > tenggat) {
        throw new Error("anggaran waktu pemindaian habis");
      }
      const url = daftar[i];
      // Dipakai saat memverifikasi jawaban kosong: harus server yang BERBEDA,
      // kalau tidak verifikasinya hanya mengulang jawaban yang sama.
      if (lewati && url === lewati) continue;
      const ac = new AbortController();
      // Jangan pernah menunggu lebih lama daripada sisa anggaran.
      const sisa = tenggat ? Math.max(2_000, tenggat - Date.now()) : BATAS_TUNGGU_MS;
      const jam = setTimeout(() => ac.abort(), Math.min(BATAS_TUNGGU_MS, sisa));
      try {
        const res = await fetch(url, {
          method: "POST",
          body: `data=${encodeURIComponent(query)}`,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": AGEN_HTTP,
          },
          signal: ac.signal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        // Overpass bisa menjawab 200 sambil menyelipkan `remark: "runtime
        // error: Query timed out"` dan daftar elemen kosong. Tanpa
        // pemeriksaan ini, timeout server terbaca sebagai "tidak ada apa-apa
        // di sekitar sini".
        if (typeof json?.remark === "string" && /error|timed out/i.test(json.remark)) {
          throw new Error(`remark: ${json.remark}`);
        }
        // Server yang menjawab dipakai lebih dulu pada panggilan berikutnya,
        // dan tanda sakitnya (kalau ada) dicabut.
        mulaiDari = SERVER_OVERPASS.indexOf(url);
        serverSakit.delete(url);
        return { json, url };
      } catch (e) {
        terakhir = e;
        // Ditandai supaya anak tangga radius berikutnya tidak membakar 12 detik
        // lagi di pintu yang barusan tidak dibuka.
        serverSakit.set(url, Date.now() + SAKIT_MS);
      } finally {
        clearTimeout(jam);
      }
    }
    // Ronde berikutnya mulai dari server sesudahnya, bukan mengulang urutan
    // yang barusan gagal seluruhnya.
    mulaiDari = (mulaiDari + 1) % SERVER_OVERPASS.length;
    if (ronde < RONDE - 1 && !(tenggat && Date.now() > tenggat)) {
      await tidur(JEDA_RONDE_MS);
    }
  }

  sekringSampai = Date.now() + SEKRING_MS;
  throw new Error(`semua server Overpass gagal: ${String(terakhir)}`);
}

/**
 * Sumber cadangan: Photon (komoot) — indeks OSM yang sama, mesin & operator
 * berbeda.
 *
 * Ada karena satu penyedia bukan jaminan. Pengujian dengan titik nyata di
 * Bulak, Surabaya: Overpass menjawab 504 di seluruh mirror-nya, sementara
 * Photon mengembalikan 50 tempat dalam radius yang sama. Tanpa cadangan,
 * kejadian itu tersimpan sebagai "tidak ada apa-apa di sekitar sini" — persis
 * kebohongan yang membuat fitur ini terasa seperti undian.
 *
 * Photon tidak punya penyaring radius, jadi ia diminta tetangga TERDEKAT per
 * jenis tag lalu dipotong sendiri di sini.
 */
const TAG_PHOTON = [
  "amenity",
  "shop",
  "leisure",
  "tourism",
  "railway:station",
  "highway:bus_stop",
  "public_transport:station",
];

async function tanyaPhoton(
  lat: number,
  lon: number,
  tenggat = Date.now() + CADANGAN_MS,
): Promise<TempatTerdekat[]> {
  const kumpul: any[] = [];

  for (const tag of TAG_PHOTON) {
    // Cadangan pun punya batas: lebih baik menyerahkan hasil separuh tag
    // daripada menahan halaman lebih lama lagi.
    if (Date.now() > tenggat) break;
    const ac = new AbortController();
    const jam = setTimeout(() => ac.abort(), 8_000);
    try {
      // CATATAN: JANGAN tambahkan `lang=` — instansi publik Photon menjawab
      // 400 untuk bahasa yang tidak didukungnya (termasuk `id`), dan seluruh
      // permintaan jadi sia-sia tanpa pesan yang jelas.
      const url =
        `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&limit=50` +
        `&osm_tag=${encodeURIComponent(tag)}`;
      const res = await fetch(url, {
        headers: { "User-Agent": AGEN_HTTP },
        signal: ac.signal,
        cache: "no-store",
      });
      if (!res.ok) continue;
      const json = await res.json();
      if (Array.isArray(json?.features)) kumpul.push(...json.features);
    } catch {
      // Satu tag gagal bukan alasan membatalkan yang lain.
    } finally {
      clearTimeout(jam);
    }
  }

  return petakanFiturPhoton(kumpul, lat, lon);
}

interface HasilPindai {
  tempat: TempatTerdekat[];
  radius: number;
  gagal: boolean;
  /**
   * Seluruh tangga radius benar-benar dijawab penyedia (bukan putus di tengah
   * karena error).
   *
   * Inilah yang membedakan dua "nol" yang tampak sama tapi artinya berlawanan:
   * nol setelah radius 6 km DIJAWAB = daerahnya memang sepi (fakta, layak
   * disimpan); nol karena tidak ada yang menjawab = kabar tentang server
   * (bukan fakta, tidak boleh disimpan sebagai jawaban).
   */
  tuntas: boolean;
  /** Hasil sapuan landmark 5 km — kosong bila sapuannya gagal/dilewati. */
  landmark: TempatLandmark[];
}

/**
 * Pindai satu titik: radius menaik di Overpass, lalu Photon bila perlu.
 *
 * Berhenti pada anak tangga pertama yang menghasilkan ≥ MIN_TEMPAT — untuk
 * properti kota itu berarti tepat SATU permintaan. Sumber cadangan hanya
 * disentuh kalau yang utama tidak cukup; jadi jalur normal tetap satu
 * permintaan, sementara jalur sial tetap menghasilkan jawaban.
 */
async function pindaiTitik(lat: number, lon: number): Promise<HasilPindai> {
  let terbaik: TempatTerdekat[] = [];
  let radiusTerbaik = 0;
  let adaYangBerhasil = false;
  let tuntas = false;

  const sekringTerbuka = Date.now() < sekringSampai;
  const tenggat = Date.now() + ANGGARAN_PINDAI_MS;

  if (!sekringTerbuka) {
    for (let tangga = 0; tangga < RADIUS_TANGGA.length; tangga++) {
      const radius = RADIUS_TANGGA[tangga];
      // Anggaran habis: berhenti menaikkan radius. Yang sudah didapat tetap
      // dipakai, dan sisa pekerjaannya jadi urusan kunjungan berikutnya.
      if (Date.now() > tenggat) break;
      let jawab: JawabanOverpass;
      try {
        jawab = await tanyaOverpass(
          bangunQueryOverpass(lat, lon, radius),
          undefined,
          tenggat,
        );
        adaYangBerhasil = true;
      } catch (e) {
        laporSekali(`overpass-${radius}`, `pemindaian radius ${radius} m gagal`, e);
        // Radius berikutnya query-nya lebih berat; kalau yang ringan saja tidak
        // dilayani, meneruskan hanya menambah beban ke server yang sedang jatuh.
        break;
      }

      let tempat = petakanElemen(jawab.json?.elements ?? [], lat, lon);

      // "Kosong" adalah satu-satunya jawaban yang tidak boleh dipercaya dari
      // satu sumber saja: itulah bentuk kegagalan yang paling mahal (lihat
      // catatan tentang osm.ch di atas). Kalau server kedua menemukan isi,
      // yang pertama sedang berbohong.
      //
      // TAPI HANYA DI TANGGA TERATAS. Diverifikasi di setiap radius, aturan ini
      // menggandakan biaya justru di kasus yang paling tidak membutuhkannya:
      // aset di pinggiran memang kosong pada 800 m dan 1.500 m, dan dua
      // permintaan tambahan itu memakan anggaran yang seharusnya dipakai naik
      // ke radius yang benar-benar menyimpan jawabannya. Terukur di satu titik
      // Malang selatan: 0 tempat di 1,5 km tapi 43 tempat di 6 km — dan
      // pemindaiannya kehabisan waktu sebelum sampai ke sana.
      //
      // Kosong di radius bawah toh tidak pernah jadi jawaban akhir: tangga
      // berikutnya sendiri sudah merupakan pemeriksaan ulang, memakai
      // permintaan yang sama sekali tidak terbuang. Yang wajib diverifikasi
      // hanyalah kosong yang akan DISIMPAN sebagai "daerah ini memang sepi".
      const tanggaTeratas = radius === RADIUS_TANGGA[RADIUS_TANGGA.length - 1];
      if (tempat.length === 0 && tanggaTeratas) {
        try {
          const kedua = await tanyaOverpass(
            bangunQueryOverpass(lat, lon, radius),
            jawab.url,
            tenggat,
          );
          tempat = petakanElemen(kedua.json?.elements ?? [], lat, lon);
        } catch {
          // Verifikasi gagal → jangan naikkan status apa pun; anggap saja
          // hasil pertama, dan biarkan tangga radius berikutnya mencoba.
        }
      }
      if (tempat.length > terbaik.length) {
        terbaik = tempat;
        radiusTerbaik = radius;
      }
      if (tempat.length >= MIN_TEMPAT) break;
      // Tangga teratas dijawab dan tetap segini — pencariannya sudah habis,
      // bukan terputus.
      if (tanggaTeratas) tuntas = true;

      /**
       * NOL BERARTI JANGAN MERAYAP — LOMPAT.
       *
       * Tangga radius dibuat untuk mendekat perlahan supaya jaraknya tetap
       * masuk akal. Tapi begitu sebuah radius menjawab NOL, merayap ke radius
       * berikutnya adalah taruhan yang buruk: daerah yang tidak punya apa pun
       * dalam 800 m hampir tidak pernah tiba-tiba ramai di 1.500 m, sementara
       * tiap anak tangga memakan ±10 detik dari anggaran yang cuma sekian
       * puluh detik. Itulah yang membuat aset pinggiran gagal dengan cara
       * paling menyesakkan: pemindaian berhenti kehabisan waktu di 3 km,
       * padahal 43 tempat menunggu di 6 km (terukur di satu titik Malang
       * selatan — 47 detik, pulang dengan tangan kosong).
       *
       * Hasil 1-2 tempat diperlakukan lain: di sana jelas ADA sesuatu, jadi
       * kenaikan bertahap masih layak dan jaraknya tetap terjaga rapat.
       */
      if (tempat.length === 0 && !tanggaTeratas) {
        tangga = RADIUS_TANGGA.length - 2; // iterasi berikutnya = tangga teratas
      }
    }
  }

  // Cadangan dipakai ketika yang utama gagal ATAU hasilnya masih di bawah
  // ambang. "Nol tempat" dari satu penyedia bukan fakta tentang lokasinya —
  // hampir selalu itu kabar tentang penyedianya.
  if (terbaik.length < MIN_TEMPAT) {
    try {
      // Cadangan tetap dapat jatah waktunya sendiri walau anggaran utama sudah
      // habis — justru saat Overpass melempem, inilah satu-satunya harapan
      // mendapat jawaban hari ini.
      const cadangan = await tanyaPhoton(lat, lon, Date.now() + CADANGAN_MS);
      if (cadangan.length > terbaik.length) {
        const pilih = pilihRadius(cadangan);
        terbaik = pilih.tempat;
        radiusTerbaik = pilih.radius;
        adaYangBerhasil = true;
      }
    } catch (e) {
      laporSekali("photon", "sumber cadangan Photon gagal", e);
    }
  }

  /**
   * Rapatkan kembali ke radius terkecil yang sudah memuat cukup tempat.
   *
   * Ini penutup dari aturan "nol berarti lompat" di atas. Melompat ke tangga
   * teratas menghemat belasan detik, tapi tanpa langkah ini ia juga mengubah
   * ARTI jawabannya: aset yang tempat terdekatnya 2,5 km akan berkata "radius
   * 6 km, 43 tempat" — memasukkan puluhan tempat yang tidak seorang pun
   * anggap "dekat", hanya karena kebetulan ikut terjaring sekali tembak.
   *
   * Dengan dirapatkan, lompatan tadi murni penghematan biaya: jawabannya sama
   * persis dengan yang didapat kalau tangganya dinaiki satu per satu, hanya
   * tanpa permintaan tambahan. Aturan yang sama sudah dipakai untuk hasil
   * Photon di atas, jadi angka "Radius …" di layar selalu berarti hal yang
   * sama dari sumber mana pun: batas terkecil yang benar-benar memuat isinya.
   */
  if (terbaik.length >= MIN_TEMPAT) {
    const rapat = pilihRadius(terbaik);
    terbaik = rapat.tempat;
    radiusTerbaik = rapat.radius;
  }

  /**
   * SAPUAN KEDUA: landmark, radius tetap 5 km.
   *
   * Kenapa tidak digabung saja ke kueri utama: karena keduanya menjawab
   * pertanyaan yang berbeda, dan menggabungkannya merusak keduanya. Kueri
   * utama mencari "apa yang bisa saya jalan kaki ke sana" dan berhenti begitu
   * dapat 3 — kalau hasil 5 km ikut masuk, daftar bertajuk "Radius 800 m"
   * akan memuat bandara. Sebaliknya, kalau kueri utama dipaksa 5 km supaya
   * kampusnya kena, daftar di halaman detail jadi 300 warung acak sekota.
   *
   * Jadi: dua kueri, dua kolom, dua pembaca. Yang ini tidak pernah tampil di
   * daftar "yang ada di sekitar".
   */
  let landmark: TempatLandmark[] = [];
  if (!sekringTerbuka && adaYangBerhasil) {
    try {
      const jawab = await tanyaOverpass(
        bangunQueryLandmark(lat, lon, RADIUS_LANDMARK),
        undefined,
        Date.now() + LANDMARK_MS,
      );
      landmark = petakanLandmark(jawab.json?.elements ?? [], lat, lon);
    } catch (e) {
      // Sengaja tidak dilaporkan sebagai kegagalan pemindaian: hasil utama
      // sudah didapat, dan halaman detail tetap lengkap tanpa ini.
      laporSekali("landmark", "sapuan landmark 5 km dilewati", e);
    }
  }

  return {
    tempat: terbaik.slice(0, MAKS_HASIL),
    radius: radiusTerbaik || RADIUS_TANGGA[0],
    gagal: !adaYangBerhasil,
    tuntas,
    landmark,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GEOCODING
// ─────────────────────────────────────────────────────────────────────────────

let nominatimTerakhir = 0;

/** Antre agar dua permintaan Nominatim tidak pernah berdempetan. */
async function antreNominatim() {
  const jeda = JEDA_NOMINATIM_MS - (Date.now() - nominatimTerakhir);
  if (jeda > 0) await tidur(jeda);
  nominatimTerakhir = Date.now();
}

/**
 * Rapikan satu potong alamat sebelum dikirim ke geocoder.
 *
 * Ini bukan kosmetik — inilah yang membedakan "ketemu" dan "tidak ketemu".
 * Diuji langsung ke Nominatim dengan data asli dari tabel listing:
 *
 *   "Kab. Rejang Lebong"                       → 0 hasil
 *   "Rejang Lebong"                            → ketemu (kabupatennya)
 *   "Jl. Ade Irma Suryani, Kab. Rejang Lebong" → 0 hasil
 *   "Jalan Ade Irma Suryani, Rejang Lebong"    → ketemu (jalannya, tepat)
 *
 * Jadi satu titik di "Kab." adalah selisih antara peta kosong dan alamat yang
 * benar. Hal serupa berlaku untuk keterangan dalam kurung dan "RT 003 RW 003"
 * yang lazim di risalah lelang: keduanya tidak ada di OSM dan hanya membuat
 * pencarian gagal utuh.
 */
function rapikan(teks?: string | null): string {
  if (!teks) return "";
  return teks
    .replace(/\([^)]*\)/g, " ") // "(disertipikat tertulis Blok Tando)"
    .replace(/\bR[TW]\s*\.?\s*\d+/gi, " ") // "RT. 003", "RW 003"
    .replace(/\bBlok\s+[A-Z0-9-]+/gi, " ")
    .replace(/\bKab(?:upaten)?\s*\.?\s+/gi, "") // "Kab. X" → "X"
    .replace(/\bKota\s+Adm(?:inistrasi)?\s*\.?\s+/gi, "Kota ")
    .replace(/\bKec\s*\.?\s+/gi, "Kecamatan ")
    .replace(/\bKel\s*\.?\s+/gi, "Kelurahan ")
    .replace(/\bJl\s*\.?\s+/gi, "Jalan ")
    .replace(/\bProv\s*\.?\s+/gi, "Provinsi ")
    .replace(/[,\s]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Pencarian terstruktur Nominatim (street/city/state terpisah).
 *
 * Lebih tahan terhadap alamat Indonesia yang urutannya tidak baku daripada
 * satu string bebas: geocoder tidak perlu menebak mana nama jalan dan mana
 * nama kabupaten.
 */
async function geocodeNominatimTerstruktur(bagian: {
  jalan?: string;
  kota?: string;
  provinsi?: string;
}): Promise<HasilGeocode | null> {
  const q = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    countrycodes: "id",
  });
  if (bagian.jalan) q.set("street", bagian.jalan);
  if (bagian.kota) q.set("city", bagian.kota);
  if (bagian.provinsi) q.set("state", bagian.provinsi);
  if (!bagian.kota && !bagian.jalan) return null;

  return tembakNominatim(`https://nominatim.openstreetmap.org/search?${q}`);
}

async function geocodeNominatim(teks: string): Promise<HasilGeocode | null> {
  return tembakNominatim(
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=id&q=" +
      encodeURIComponent(teks),
  );
}

/**
 * Hasil geocode beserta seberapa dalam geocoder benar-benar sampai.
 *
 * `presisi` di sini adalah pengakuan GEOCODER, bukan tebakan kita dari kueri
 * mana yang berhasil. Bedanya nyata: kita boleh mengirim alamat setingkat
 * jalan lengkap dan Nominatim tetap menjawab dengan titik tengah kota karena
 * jalannya tidak ada di peta. Menganggap jawaban itu "presisi ALAMAT" hanya
 * karena kita MEMINTA alamat adalah persis cara sebuah sistem berbohong
 * dengan yakin.
 */
interface HasilGeocode {
  lat: number;
  lng: number;
  presisi: PresisiTitik;
}

/**
 * `place_rank` OpenStreetMap → presisi.
 *
 * Skalanya: negara 4, provinsi 8, kabupaten 12, kota 16, kota kecil 18,
 * desa 19, kelurahan/suburb 20, lingkungan 22, jalan 26, bangunan 30.
 * Angka batas di bawah ini mengikuti pembagian administratif Indonesia
 * sebagaimana dipetakan OSM.
 */
function presisiDariRank(rank: number | null): PresisiTitik {
  if (rank == null) return "KOTA";
  if (rank >= 26) return "ALAMAT";
  if (rank >= 19) return "KELURAHAN";
  if (rank >= 16) return "KECAMATAN";
  return "KOTA";
}

/**
 * Ambil yang PALING KASAR di antara dua penilaian.
 *
 * Dipakai menggabungkan pengakuan geocoder dengan batas dari kueri yang kita
 * kirim: kalau kita hanya bertanya "Kecamatan Ponorogo, Kab. Ponorogo",
 * jawaban seakurat apa pun tidak bisa lebih halus dari KECAMATAN — geocoder
 * tidak punya informasi yang tidak kita berikan. Pesimisme di sini murni
 * kejujuran, bukan kehati-hatian berlebihan.
 */
export function presisiTerkasar(a: PresisiTitik, b: PresisiTitik): PresisiTitik {
  return URUT_PRESISI.indexOf(a) >= URUT_PRESISI.indexOf(b) ? a : b;
}

async function tembakNominatim(url: string): Promise<HasilGeocode | null> {
  await antreNominatim();
  const ac = new AbortController();
  const jam = setTimeout(() => ac.abort(), 12_000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": AGEN_HTTP, "Accept-Language": "id" },
      signal: ac.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    const lat = angka(json?.[0]?.lat);
    const lon = angka(json?.[0]?.lon);
    if (!titikSah(lat, lon)) return null;
    return {
      lat: lat as number,
      lng: lon as number,
      presisi: presisiDariRank(angka(json?.[0]?.place_rank)),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(jam);
  }
}

/**
 * `location_type` Google → presisi. ROOFTOP berarti Google benar-benar tahu
 * bangunannya; APPROXIMATE berarti ia menaruh titik di tengah area — nilai
 * yang tidak boleh disamakan walau keduanya sama-sama sepasang angka.
 */
function presisiDariGoogle(tipe: string | undefined): PresisiTitik {
  switch (tipe) {
    case "ROOFTOP":
    case "RANGE_INTERPOLATED":
      return "ALAMAT";
    case "GEOMETRIC_CENTER":
      return "KELURAHAN";
    default:
      return "KOTA";
  }
}

async function geocodeGoogle(teks: string): Promise<HasilGeocode | null> {
  const kunci =
    process.env.GOOGLE_GEOCODING_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_GEOCODING_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!kunci) return null;

  const url =
    "https://maps.googleapis.com/maps/api/geocode/json?region=id&address=" +
    encodeURIComponent(teks) +
    `&key=${kunci}`;
  const ac = new AbortController();
  const jam = setTimeout(() => ac.abort(), 12_000);
  try {
    const res = await fetch(url, { signal: ac.signal, cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    // Kunci yang dibatasi HTTP-referrer akan menjawab REQUEST_DENIED dari
    // server; itu bukan alasan menggagalkan seluruh pencarian — Nominatim
    // sudah lebih dulu dicoba dan biasanya cukup.
    if (json?.status !== "OK") return null;
    const geo = json?.results?.[0]?.geometry;
    const lat = angka(geo?.location?.lat);
    const lng = angka(geo?.location?.lng);
    if (!titikSah(lat, lng)) return null;
    return {
      lat: lat as number,
      lng: lng as number,
      presisi: presisiDariGoogle(geo?.location_type),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(jam);
  }
}

/**
 * Cari koordinat dari alamat, dari yang paling spesifik ke yang paling umum.
 *
 * Alamat aset lelang sering ditulis apa adanya dari risalah ("Jl. Baru
 * Sukaraja No. 13 RT 003 RW 003 (disertipikat tertulis Blok Tando)") — teks
 * seperti itu hampir tidak pernah ditemukan utuh oleh geocoder mana pun.
 * Karena itu dicoba bertingkat sampai tersisa "kecamatan, kota": titik
 * kecamatan yang benar jauh lebih berguna daripada peta kosong, dan UI
 * menandainya sebagai perkiraan.
 */
async function cariKoordinat(bagian: {
  alamat?: string | null;
  kelurahan?: string | null;
  kecamatan?: string | null;
  kota?: string | null;
  provinsi?: string | null;
}): Promise<HasilGeocode | null> {
  const alamat = rapikan(bagian.alamat);
  const kelurahan = rapikan(bagian.kelurahan);
  const kecamatan = rapikan(bagian.kecamatan);
  const kota = rapikan(bagian.kota);
  const provinsi = rapikan(bagian.provinsi);

  // Percobaan pertama: terstruktur. Paling jitu untuk "nama jalan + kota".
  const terstruktur = await geocodeNominatimTerstruktur({
    jalan: alamat || undefined,
    kota: kota || kecamatan || undefined,
    provinsi: provinsi || undefined,
  });
  if (terstruktur) {
    // Tanpa teks alamat, yang dikirim cuma kota — jawabannya tidak mungkin
    // lebih halus dari itu, seberapa pun yakinnya geocoder.
    return {
      ...terstruktur,
      presisi: presisiTerkasar(terstruktur.presisi, alamat ? "ALAMAT" : "KOTA"),
    };
  }

  const gabung = (...x: string[]) => x.filter(Boolean).join(", ");

  /**
   * Tangga kandidat, dari yang paling spesifik ke yang paling umum, MASING-
   * MASING dengan batas presisinya sendiri.
   *
   * Batas itu bukan hiasan. `gabung(alamat, kelurahan, …)` menjadi persis sama
   * dengan `gabung(kelurahan, …)` ketika alamatnya kosong — dan tanpa batas
   * yang dihitung dari isi sesungguhnya, aset tanpa teks alamat akan tercatat
   * berpresisi ALAMAT hanya karena kebetulan lolos di baris pertama tangga.
   */
  const kandidat: Array<{ teks: string; batas: PresisiTitik }> = [
    { teks: gabung(alamat, kelurahan, kecamatan, kota, provinsi), batas: (alamat ? "ALAMAT" : kelurahan ? "KELURAHAN" : "KECAMATAN") as PresisiTitik },
    { teks: gabung(alamat, kota), batas: (alamat ? "ALAMAT" : "KOTA") as PresisiTitik },
    { teks: gabung(kelurahan, kecamatan, kota), batas: (kelurahan ? "KELURAHAN" : "KECAMATAN") as PresisiTitik },
    { teks: gabung(kecamatan, kota, provinsi), batas: (kecamatan ? "KECAMATAN" : "KOTA") as PresisiTitik },
    { teks: gabung(kota, provinsi), batas: "KOTA" as PresisiTitik },
    { teks: kota, batas: "KOTA" as PresisiTitik },
  ].filter(
    (k, i, arr) =>
      k.teks.length > 3 && arr.findIndex((x) => x.teks === k.teks) === i,
  );

  for (const { teks, batas } of kandidat) {
    const hasil = await geocodeNominatim(teks);
    if (hasil) {
      return { ...hasil, presisi: presisiTerkasar(hasil.presisi, batas) };
    }
  }

  // Google sebagai penjaga gawang, dan hanya untuk kandidat terkuat: ia
  // berbayar per permintaan, jadi bukan tempat untuk mencoba enam variasi.
  for (const { teks, batas } of kandidat.slice(0, 2)) {
    const hasil = await geocodeGoogle(teks);
    if (hasil) {
      return { ...hasil, presisi: presisiTerkasar(hasil.presisi, batas) };
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// TABEL CACHE (tahan bila tabelnya belum ada)
// ─────────────────────────────────────────────────────────────────────────────

interface BarisCache {
  latitude: unknown;
  longitude: unknown;
  sumber_titik: string | null;
  presisi_titik: string | null;
  radius_meter: number;
  jumlah: number;
  lengkap: boolean;
  percobaan: number;
  tempat: unknown;
  landmark: unknown;
  dipindai_pada: Date;
}

async function bacaBaris(id: bigint): Promise<BarisCache | null> {
  try {
    return (await prisma.listingSekitar.findUnique({
      where: { id_property: id },
    })) as unknown as BarisCache | null;
  } catch (e) {
    laporSekali(
      "baca",
      "tabel listing_sekitar belum ada / tidak terbaca — jalankan prisma/migration_listing_sekitar.sql",
      e,
    );
    return null;
  }
}

async function tulisBaris(
  id: bigint,
  isi: {
    titik: TitikAset | null;
    radius: number;
    tempat: TempatTerdekat[];
    landmark?: TempatLandmark[];
    lengkap: boolean;
    percobaan: number;
  },
) {
  const data = {
    latitude: isi.titik ? isi.titik.lat : null,
    longitude: isi.titik ? isi.titik.lng : null,
    sumber_titik: isi.titik ? isi.titik.sumber : null,
    presisi_titik: isi.titik?.presisi ?? null,
    radius_meter: isi.radius,
    jumlah: isi.tempat.length,
    lengkap: isi.lengkap,
    percobaan: isi.percobaan,
    tempat: isi.tempat as any,
    landmark: (isi.landmark ?? []) as any,
    dipindai_pada: new Date(),
  };
  try {
    await prisma.listingSekitar.upsert({
      where: { id_property: id },
      create: { id_property: id, ...data },
      update: data,
    });
  } catch (e) {
    // Termasuk kasus listing terhapus di tengah pemindaian (pelanggaran FK):
    // hasilnya tetap dikembalikan ke pemanggil, hanya tidak tersimpan.
    laporSekali("tulis", "gagal menyimpan hasil pemindaian sekitar", e);
  }
}

/** Penjaga bentuk: nilai lama/asing di kolom teks tidak boleh lolos jadi tipe. */
function bacaPresisi(v: unknown): PresisiTitik | undefined {
  return adalahPresisi(v) ? v : undefined;
}

function dariBaris(baris: BarisCache): SekitarPayload {
  const lat = angka(baris.latitude);
  const lng = angka(baris.longitude);
  const sumber: SumberTitik =
    baris.sumber_titik === "GEOCODE" ? "GEOCODE" : "LISTING";
  return {
    titik:
      titikSah(lat, lng) && baris.sumber_titik
        ? {
            lat: lat as number,
            lng: lng as number,
            sumber,
            // Baris lama (ditulis sebelum kolom presisi ada) tidak punya
            // nilainya. Pin yang ditandai agent tetap bisa disimpulkan TITIK;
            // hasil geocode lama sengaja dibiarkan kosong, karena menebaknya
            // "ALAMAT" persis kesalahan yang kolom ini ada untuk mencegah.
            presisi: bacaPresisi(baris.presisi_titik) ??
              (sumber === "LISTING" ? "TITIK" : undefined),
          }
        : null,
    radius: baris.radius_meter || RADIUS_TANGGA[0],
    tempat: bacaTempatJson(baris.tempat),
    landmark: bacaLandmarkJson(baris.landmark),
    lengkap: baris.lengkap,
    status: "tersimpan",
    dipindaiPada: baris.dipindai_pada?.toISOString?.() ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CACHE PER TITIK (lapisan di bawah listing_sekitar)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kenapa ada dua lapisan cache.
 *
 * `listing_sekitar` dikunci id_property, dan itu syarat yang tidak selalu bisa
 * dipenuhi:
 *
 *   1. Form tambah properti memindai SEBELUM listing-nya ada. Tanpa lapisan
 *      ini hasil pindaian di form terbuang, lalu titik yang sama dipindai lagi
 *      begitu pengunjung pertama membuka halaman detailnya — dua pemindaian
 *      untuk jawaban yang identik.
 *   2. Beberapa listing bisa berbagi satu titik (unit-unit di gedung yang
 *      sama). Dikunci per listing itu jadi sekian pemindaian; dikunci per
 *      titik, satu.
 *
 * `listing_sekitar` tetap jadi yang dibaca halaman detail — ia menyimpan titik
 * mana yang dipakai aset itu (termasuk hasil geocode) dan ikut terhapus
 * bersama listingnya. Tabel ini duduk di bawahnya dan hanya menjawab satu
 * pertanyaan: "titik ini sudah pernah dipindai belum?".
 */

/**
 * Presisi kunci: 3 desimal ≈ 110 m.
 *
 * Radius pemindaian terkecil 800 m, jadi geseran 110 m praktis tidak mengubah
 * daftar hasilnya. Presisi yang lebih ketat (4 desimal ≈ 11 m) akan membuat
 * dua agent yang menandai gedung yang sama tetap memindai dua kali — persis
 * pemborosan yang lapisan ini ada untuk menghentikannya.
 */
const PRESISI_KUNCI = 3;

function kunciTitik(lat: number, lng: number): string {
  const b = (n: number) => n.toFixed(PRESISI_KUNCI);
  return `${b(lat)},${b(lng)}`;
}

interface BarisTitik {
  radius_meter: number;
  jumlah: number;
  lengkap: boolean;
  tempat: unknown;
  landmark: unknown;
  dipindai_pada: Date;
}

/**
 * Delegate `sekitarTitik`, atau null bila Prisma client belum mengenalnya.
 *
 * Ini bukan kehati-hatian yang mengada-ada: model ini lahir belakangan, dan
 * proses Node yang sudah berjalan (dev server, atau app cPanel yang belum
 * di-restart setelah deploy) memegang client versi LAMA di memori — file di
 * disk sudah benar, yang di RAM belum. Gejalanya dulu berupa
 * `Cannot read properties of undefined (reading 'upsert')` yang tidak
 * menyebutkan satu pun langkah perbaikan, sementara setiap pemindaian diam-diam
 * membayar harga penuh karena hasilnya tidak pernah tersimpan.
 */
function tabelTitik(): any | null {
  const t = (prisma as any).sekitarTitik;
  if (!t) {
    laporSekali(
      "titik-model",
      "Prisma client belum punya model SekitarTitik — jalankan `npx prisma generate` " +
        "LALU RESTART proses ini (client lama tetap dipakai sampai proses dimulai ulang). " +
        "Sampai itu dilakukan, cache titik mati dan setiap pemindaian diulang dari nol.",
    );
    return null;
  }
  return t;
}

async function bacaBarisTitik(kunci: string): Promise<BarisTitik | null> {
  const tabel = tabelTitik();
  if (!tabel) return null;
  try {
    return (await tabel.findUnique({
      where: { kunci },
    })) as unknown as BarisTitik | null;
  } catch (e) {
    laporSekali(
      "baca-titik",
      "tabel sekitar_titik belum ada / tidak terbaca — jalankan prisma/migration_sekitar_titik.sql",
      e,
    );
    return null;
  }
}

/**
 * Jarak maksimum sebuah pindaian tetangga masih boleh dipakai ulang.
 *
 * Pembulatan kunci membagi peta jadi kotak-kotak ~110 m, dan dua titik yang
 * hanya berjarak 40 m bisa jatuh di sisi berlawanan garis pembagi — persis
 * kasus "lima unit di satu gedung, pin-nya digeser sedikit tiap unit". Tanpa
 * langkah ini, kejadian itu berarti pemindaian penuh 14 detik untuk jawaban
 * yang sudah dimiliki tetangga sebelahnya.
 *
 * 150 m dipilih karena kecil dibanding radius pemindaian terkecil (800 m):
 * daftar tempatnya pada dasarnya sama, dan jaraknya toh dihitung ulang dari
 * titik yang sebenarnya (lihat setelJarak).
 */
const TOLERANSI_TITIK_M = 150;

/**
 * Cari pindaian tetangga yang masih layak dipakai untuk titik ini.
 *
 * Hanya baris LENGKAP yang boleh dipinjam: percobaan yang gagal atau setengah
 * jalan milik titik lain bukan alasan untuk tidak mencoba di titik ini.
 */
async function bacaBarisTitikTetangga(
  lat: number,
  lng: number,
): Promise<BarisTitik | null> {
  const langkah = 10 ** -PRESISI_KUNCI;
  const kunci: string[] = [];
  for (const dLat of [-langkah, 0, langkah]) {
    for (const dLng of [-langkah, 0, langkah]) {
      kunci.push(kunciTitik(lat + dLat, lng + dLng));
    }
  }

  const tabel = tabelTitik();
  if (!tabel) return null;

  try {
    const baris = (await tabel.findMany({
      where: { kunci: { in: kunci }, lengkap: true },
    })) as unknown as (BarisTitik & { latitude: unknown; longitude: unknown })[];

    let terdekat: BarisTitik | null = null;
    let jarakTerdekat = Infinity;
    for (const b of baris) {
      const bLat = angka(b.latitude);
      const bLng = angka(b.longitude);
      if (bLat == null || bLng == null) continue;
      const jarak = jarakMeter(lat, lng, bLat, bLng);
      if (jarak <= TOLERANSI_TITIK_M && jarak < jarakTerdekat) {
        jarakTerdekat = jarak;
        terdekat = b;
      }
    }
    return terdekat;
  } catch (e) {
    laporSekali("baca-titik-tetangga", "gagal membaca cache titik tetangga", e);
    return null;
  }
}

/**
 * Hitung ulang jarak tiap tempat dari titik yang SEBENARNYA, lalu urutkan lagi.
 *
 * Jarak yang tersimpan dihitung dari titik pemindaian, dan titik itu tidak
 * selalu persis sama dengan titik yang sedang ditanyakan — satu kotak kunci
 * lebarnya ~110 m, dan pindaian tetangga boleh dipakai sampai 150 m. Tanpa
 * langkah ini, "< 50 m" bisa muncul untuk warung yang sebenarnya 200 m jauhnya:
 * kesalahan yang tidak terlihat sebagai kesalahan.
 *
 * Tiap tempat menyimpan koordinatnya sendiri, jadi ini murni aritmetika —
 * tidak ada permintaan keluar.
 */
function setelJarak(
  tempat: TempatTerdekat[],
  lat: number,
  lng: number,
): TempatTerdekat[] {
  return tempat
    .map((t) => ({
      ...t,
      jarak: Math.round(jarakMeter(lat, lng, t.lat, t.lon)),
    }))
    .sort((a, b) => a.jarak - b.jarak);
}

async function tulisBarisTitik(
  kunci: string,
  lat: number,
  lng: number,
  hasil: HasilPindai,
) {
  const tabel = tabelTitik();
  if (!tabel) return;

  // Radius 0 merangkap penanda "pencariannya putus", sama seperti di
  // listing_sekitar: hasil nol yang penyedianya memang menjawab sampai tangga
  // teratas (daerahnya sepi) harus bisa dibedakan dari nol karena tidak ada
  // yang menjawab. Yang pertama fakta, yang kedua kabar tentang server.
  const radius =
    hasil.tempat.length > 0
      ? hasil.radius
      : hasil.tuntas
        ? RADIUS_TANGGA[RADIUS_TANGGA.length - 1]
        : 0;

  const data = {
    latitude: lat,
    longitude: lng,
    radius_meter: radius,
    jumlah: hasil.tempat.length,
    lengkap: hasil.tempat.length >= MIN_TEMPAT,
    tempat: hasil.tempat as any,
    landmark: hasil.landmark as any,
    dipindai_pada: new Date(),
  };
  try {
    await tabel.upsert({
      where: { kunci },
      create: { kunci, ...data },
      update: data,
    });
  } catch (e) {
    laporSekali("tulis-titik", "gagal menyimpan cache titik", e);
  }
}

interface HasilTitik extends HasilPindai {
  /** true = dijawab dari tabel; tidak ada satu pun permintaan keluar. */
  dariCache: boolean;
}

/** Satu pemindaian per titik pada satu waktu — sepola `berjalan` di bawah. */
const berjalanTitik = new Map<string, Promise<HasilPindai>>();

/**
 * `pindaiTitik` dengan ingatan.
 *
 * Inilah satu-satunya pintu ke Overpass yang boleh dipakai jalur mana pun
 * (halaman detail maupun form tambah properti). Titik yang sudah pernah
 * dipindai dijawab dari tabel, tanpa satu pun permintaan keluar.
 */
async function pindaiTitikBercache(
  lat: number,
  lng: number,
  opsi: { paksa?: boolean } = {},
): Promise<HasilTitik> {
  const kunci = kunciTitik(lat, lng);

  const baris = await bacaBarisTitik(kunci);
  if (baris) {
    const umur = Date.now() - new Date(baris.dipindai_pada).getTime();
    // Aturannya sama persis dengan jalur listing: jawaban lengkap final,
    // hasil sedikit-tapi-nyata boleh menunggu lama, hasil nol yang tidak
    // meyakinkan dicoba lagi dalam hitungan jam.
    const nolSah = baris.jumlah === 0 && baris.radius_meter > 0;
    const tepercaya = baris.jumlah > 0 || nolSah;
    const jeda = opsi.paksa
      ? // Pemindaian paksa pun tetap dijaga jaraknya: tombol "pindai ulang"
        // yang ditekan berkali-kali tidak boleh jadi alat membanjiri Overpass.
        JEDA_PAKSA_MS
      : tepercaya
        ? JEDA_ULANG_MS
        : JEDA_KOSONG_MS;
    if ((baris.lengkap && !opsi.paksa) || umur < jeda) {
      return {
        tempat: setelJarak(bacaTempatJson(baris.tempat), lat, lng),
        landmark: setelJarakLandmark(bacaLandmarkJson(baris.landmark), lat, lng),
        radius: baris.radius_meter || RADIUS_TANGGA[0],
        gagal: !tepercaya,
        tuntas: nolSah,
        dariCache: true,
      };
    }
  } else if (!opsi.paksa) {
    // Belum pernah dipindai persis di kotak ini — tapi tetangga sebelah mungkin
    // sudah, dan pada jarak segitu jawabannya sama. Ini yang membuat unit-unit
    // di satu gedung berbagi satu pemindaian walau pin-nya digeser sedikit.
    const tetangga = await bacaBarisTitikTetangga(lat, lng);
    if (tetangga) {
      return {
        tempat: setelJarak(bacaTempatJson(tetangga.tempat), lat, lng),
        landmark: setelJarakLandmark(bacaLandmarkJson(tetangga.landmark), lat, lng),
        radius: tetangga.radius_meter || RADIUS_TANGGA[0],
        gagal: false,
        tuntas: false,
        dariCache: true,
      };
    }
  }

  // Pemindaian yang sedang berjalan untuk titik ini diikuti bersama, bukan
  // ditumpuki pemindaian kedua yang jawabannya pasti sama.
  const sedang = berjalanTitik.get(kunci);
  if (sedang) return { ...(await sedang), dariCache: false };

  const janji = (async () => {
    const hasil = await pindaiTitik(lat, lng);
    await tulisBarisTitik(kunci, lat, lng, hasil);
    return hasil;
  })().finally(() => berjalanTitik.delete(kunci));

  berjalanTitik.set(kunci, janji);
  return { ...(await janji), dariCache: false };
}

/**
 * Jawaban untuk satu KOORDINAT, tanpa perlu ada listing-nya.
 *
 * Dipakai form tambah/edit properti (lihat /api/sekitar/titik): agent menandai
 * titik di peta lalu menekan "Pindai sekitar", dan hasil pindaian itu tersimpan
 * — jadi halaman detail listing yang nanti dibuat di titik itu tidak memindai
 * ulang apa pun.
 */
export async function ambilSekitarTitik(
  lat: number,
  lng: number,
  opsi: OpsiAmbil = {},
): Promise<SekitarPayload> {
  if (!titikSah(lat, lng)) return kosong("tanpa-titik");

  const hasil = await pindaiTitikBercache(lat, lng, opsi);
  const tempat = hasil.tempat;

  return {
    // Titiknya datang dari agent yang menandainya di peta — bukan tebakan
    // geocoder, jadi UI tidak perlu menyebutnya perkiraan.
    titik: { lat, lng, sumber: "LISTING", presisi: "TITIK" },
    radius: hasil.radius,
    tempat,
    landmark: hasil.landmark,
    lengkap: tempat.length >= MIN_TEMPAT,
    // "gagal" hanya untuk nol yang tidak meyakinkan — nol setelah tangga
    // teratas dijawab adalah fakta tentang daerahnya, bukan kegagalan.
    status:
      tempat.length === 0 && !hasil.tuntas
        ? "gagal"
        : hasil.dariCache
          ? "tersimpan"
          : "baru",
    dipindaiPada: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BACA SAJA (dipakai halaman saat render server)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ambil hasil yang SUDAH tersimpan, tanpa pernah memicu pemindaian.
 *
 * Dipakai page.tsx supaya aset yang pernah dipindai tampil lengkap di HTML
 * pertama — tanpa spinner, tanpa satu pun permintaan dari browser. Aset yang
 * belum pernah dipindai mengembalikan null, dan komponennya yang meminta
 * pemindaian lewat API.
 */
export async function bacaSekitarTersimpan(
  idProperty: bigint | string | number,
): Promise<SekitarPayload | null> {
  let id: bigint;
  try {
    id = BigInt(idProperty as any);
  } catch {
    return null;
  }
  const baris = await bacaBaris(id);
  if (!baris) return null;
  // Baris yang belum lengkap tidak dikirim sebagai hasil awal: biar komponennya
  // memanggil API dan (kalau jedanya sudah lewat) mencoba lagi.
  return baris.lengkap ? dariBaris(baris) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PEMINDAIAN (dengan single-flight)
// ─────────────────────────────────────────────────────────────────────────────

const berjalan = new Map<string, Promise<SekitarPayload>>();

export interface OpsiAmbil {
  /** Abaikan cache & jeda — hanya untuk tombol "pindai ulang" milik agent. */
  paksa?: boolean;
}

/**
 * Jawaban lengkap untuk satu aset: baca cache, atau pindai lalu simpan.
 * Tidak pernah melempar.
 */
export async function ambilSekitar(
  idProperty: bigint | string | number,
  opsi: OpsiAmbil = {},
): Promise<SekitarPayload> {
  let id: bigint;
  try {
    id = BigInt(idProperty as any);
  } catch {
    return kosong("tanpa-titik");
  }

  // Kuncinya id saja — termasuk untuk permintaan paksa. Kalau satu pemindaian
  // sedang berjalan untuk aset ini, semua peminta ikut hasil yang sama; menaruh
  // pemindaian kedua di atas yang pertama tidak pernah membuat jawabannya lebih
  // benar, hanya menggandakan beban ke server yang sama.
  const kunci = String(id);
  const sedang = berjalan.get(kunci);
  if (sedang) return sedang;

  const janji = kerjakan(id, opsi).finally(() => berjalan.delete(kunci));
  berjalan.set(kunci, janji);
  return janji;
}

function kosong(status: StatusSekitar): SekitarPayload {
  return {
    titik: null,
    radius: 0,
    tempat: [],
    lengkap: false,
    status,
    dipindaiPada: null,
  };
}

async function kerjakan(id: bigint, opsi: OpsiAmbil): Promise<SekitarPayload> {
  const baris = await bacaBaris(id);
  const umur = baris ? Date.now() - new Date(baris.dipindai_pada).getTime() : Infinity;

  if (baris && !opsi.paksa) {
    // Jawaban final — inilah jalur yang dilalui hampir semua kunjungan.
    if (baris.lengkap) return dariBaris(baris);

    // Baris yang belum lengkap punya dua rasa yang sangat berbeda:
    //
    //   jumlah 1–2  → pemindaiannya JALAN, daerahnya memang sepi. Layak
    //                 ditampilkan, dan tidak perlu diulang dalam waktu dekat.
    //   jumlah 0    → hampir pasti bukan fakta tentang lokasinya, melainkan
    //                 tentang penyedianya (semua sumber sedang menolak).
    //                 Ditandai gagal supaya UI tidak berbohong "tidak ada
    //                 apa-apa di sekitar sini", dan dicoba lagi jauh lebih
    //                 cepat.
    //
    // Nol yang SAH (penyedia menjawab sampai radius teratas, daerahnya memang
    // sepi) dibedakan lewat radius_meter > 0 — lihat catatan di bawah tempat
    // barisnya ditulis.
    const nolSah = baris.jumlah === 0 && baris.radius_meter > 0;
    const tepercaya = baris.jumlah > 0 || nolSah;
    const jeda = tepercaya ? JEDA_ULANG_MS : JEDA_KOSONG_MS;
    if (umur < jeda) {
      const isi = dariBaris(baris);
      return tepercaya ? isi : { ...isi, status: "gagal" };
    }
  }

  // Pemindaian paksa pun tetap dijaga jaraknya, supaya tombol "coba lagi" yang
  // ditekan berulang kali tidak jadi alat membanjiri Overpass.
  if (baris && opsi.paksa && umur < JEDA_PAKSA_MS) return dariBaris(baris);

  const listing = await ambilListing(id);
  if (!listing) return baris ? dariBaris(baris) : kosong("tanpa-titik");

  // ── Titik ──────────────────────────────────────────────────────────────
  let titik: TitikAset | null = null;
  const latDb = angka(listing.latitude);
  const lngDb = angka(listing.longitude);
  if (titikSah(latDb, lngDb)) {
    titik = {
      lat: latDb as number,
      lng: lngDb as number,
      sumber: "LISTING",
      presisi: "TITIK",
    };
  } else if (baris && titikSah(angka(baris.latitude), angka(baris.longitude))) {
    // Hasil geocode sebelumnya dipakai ulang — geocoder tidak perlu ditanya
    // dua kali untuk alamat yang sama.
    titik = {
      lat: angka(baris.latitude) as number,
      lng: angka(baris.longitude) as number,
      sumber: "GEOCODE",
      presisi: bacaPresisi(baris.presisi_titik),
    };
  } else {
    const hasil = await cariKoordinat({
      alamat: listing.alamat_lengkap,
      kelurahan: listing.kelurahan,
      kecamatan: listing.kecamatan,
      kota: listing.kota,
      provinsi: listing.provinsi,
    });
    if (hasil) {
      titik = {
        lat: hasil.lat,
        lng: hasil.lng,
        sumber: "GEOCODE",
        presisi: hasil.presisi,
      };
    }
  }

  const percobaan = (baris?.percobaan ?? 0) + 1;

  if (!titik) {
    // Dicatat supaya alamat yang memang tidak bisa di-geocode tidak dicoba
    // ulang di setiap kunjungan.
    await tulisBaris(id, {
      titik: null,
      radius: 0,
      tempat: [],
      lengkap: false,
      percobaan,
    });
    return { ...kosong("tanpa-titik"), dipindaiPada: new Date().toISOString() };
  }

  // ── Pindai ─────────────────────────────────────────────────────────────
  // Lewat cache titik, bukan langsung ke Overpass: aset yang titiknya sudah
  // pernah dipindai (dari form tambah properti, atau dari listing lain di
  // gedung yang sama) mengisi barisnya tanpa satu pun permintaan keluar.
  const hasil = await pindaiTitikBercache(titik.lat, titik.lng, opsi);
  const lengkap = hasil.tempat.length >= MIN_TEMPAT;

  // Hasil KOSONG tidak pernah dianggap jawaban. Menyimpan "0 tempat" sebagai
  // fakta berarti membekukan kegagalan jaringan menjadi kalimat permanen
  // "tidak ada apa-apa di sekitar sini" untuk aset yang sebenarnya ramai —
  // dan itu tidak akan pernah diperbaiki sendiri karena tidak ada yang tahu
  // ada yang salah. Barisnya tetap ditulis sebagai catatan percobaan (dengan
  // tenggat pendek), tapi yang dilaporkan ke pemanggil adalah "gagal".
  if (hasil.tempat.length === 0) {
    // `radius_meter` merangkap penanda: >0 berarti penyedia benar-benar
    // menjawab sampai tangga teratas dan daerahnya memang sepi (fakta), 0
    // berarti pencariannya yang putus (bukan fakta). Dua keadaan ini terlihat
    // identik di kolom `jumlah`, dan membedakannya menentukan apakah UI boleh
    // berkata "tidak ada apa-apa di sini".
    const memangSepi = hasil.tuntas;
    const radiusHabis = RADIUS_TANGGA[RADIUS_TANGGA.length - 1];

    await tulisBaris(id, {
      titik,
      radius: memangSepi ? radiusHabis : 0,
      tempat: [],
      lengkap: false,
      percobaan,
    });

    if (memangSepi) {
      return {
        titik,
        radius: radiusHabis,
        tempat: [],
        lengkap: false,
        status: "baru",
        dipindaiPada: new Date().toISOString(),
      };
    }

    // Data lama yang isinya masih ada lebih berharga daripada kegagalan hari
    // ini — jangan sampai kunjungan yang apes menghapus jawaban yang benar.
    if (baris && bacaTempatJson(baris.tempat).length > 0) {
      return { ...dariBaris(baris), status: "gagal" };
    }
    return { ...kosong("gagal"), titik, dipindaiPada: new Date().toISOString() };
  }

  await tulisBaris(id, {
    titik,
    radius: hasil.radius,
    tempat: hasil.tempat,
    landmark: hasil.landmark,
    lengkap,
    percobaan,
  });

  // Kamus tempat diisi DI SINI, di titik ketika satu-satunya hal yang tahu
  // "aset ini dekat apa saja" masih di tangan. Sengaja tidak ditunggu: yang
  // memicu pemindaian ini adalah orang yang sedang menunggu halaman detail
  // terbuka, dan ia tidak punya urusan dengan indeks pencarian orang lain.
  void serapKamusDariPindaian(id, titik, hasil.landmark, hasil.tempat, {
    kota: listing.kota,
    provinsi: listing.provinsi,
  });

  // Patokan yang diketik agent ikut diserap di sini — bukan pekerjaan
  // tambahan, melainkan satu-satunya kesempatan yang wajar: aset ini toh baru
  // saja dibaca lengkap dari tabel.
  void serapKamusDariPatokan(id, listing.akses_terdekat, {
    kota: listing.kota,
    provinsi: listing.provinsi,
  });

  return {
    titik,
    radius: hasil.radius,
    tempat: hasil.tempat,
    landmark: hasil.landmark,
    lengkap,
    status: "baru",
    dipindaiPada: new Date().toISOString(),
  };
}

async function ambilListing(id: bigint) {
  try {
    return await prisma.listing.findUnique({
      where: { id_property: id },
      select: {
        latitude: true,
        longitude: true,
        alamat_lengkap: true,
        kelurahan: true,
        kecamatan: true,
        kota: true,
        provinsi: true,
        akses_terdekat: true,
      },
    });
  } catch (e) {
    laporSekali("listing", "gagal membaca listing untuk pemindaian sekitar", e);
    return null;
  }
}

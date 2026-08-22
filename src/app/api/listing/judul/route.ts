/**
 * POST /api/listing/judul — merangkai judul listing dengan model bahasa.
 *
 * KENAPA ADA. Perakit aturan di `src/lib/listingTitle.ts` selalu berbunyi
 * seperti mesin yang menyebutkan tag ("Kos Putri Kamar Mandi Dalam, AC, Akses
 * 24 Jam di Mulyorejo"), karena memang itulah yang ia lakukan: mengisi slot
 * lalu menyambungnya dengan koma. Judul yang terdengar ditulis orang menuntut
 * penilaian tentang fakta MANA yang layak jadi kalimat — dan itu di luar
 * jangkauan template.
 *
 * PERAKIT ATURAN TIDAK DIBUANG. Ia tetap jadi jawaban instan (nol latensi, nol
 * biaya, jalan tanpa internet) sekaligus jaring pengaman: kalau kunci belum
 * diisi, kuota habis, model menolak, atau hasilnya melanggar pagar di bawah,
 * route ini mengembalikan hasil aturan dan pemanggilnya tidak perlu tahu
 * bedanya. Form tambah properti TIDAK PERNAH boleh macet gara-gara judul.
 *
 * PAGAR YANG DITEGAKKAN DI SINI, BUKAN DI PROMPT SAJA.
 * Model diminta patuh, lalu hasilnya tetap DIPERIKSA ULANG. Prompt adalah
 * permintaan, bukan jaminan; satu-satunya hal yang benar-benar menjamin
 * "harga tidak pernah muncul di judul" adalah penyaring di bawah yang membuang
 * kandidat yang melanggar. Fakta yang boleh dilihat model pun dibatasi oleh
 * bentuk `DataJudul` yang memang tidak punya field harga & jumlah kamar.
 *
 * KUNCI API TIDAK PERNAH KE BROWSER. Itu sebabnya ini route server, bukan
 * fetch langsung dari komponen.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  JUDUL_IDEAL_MAKS,
  JUDUL_MAKS,
  bisaRakitJudul,
  nilaiJudul,
  patokanTerpilih,
  susunKandidatJudul,
  type DataJudul,
  type KandidatJudul,
} from '@/lib/listingTitle';

/**
 * Rantai model, dicoba berurutan.
 *
 * Dua kegagalan berbeda yang sama-sama sunyi menuntut dua penawar:
 *
 *   1. MODEL DIPENSIUNKAN. `gemini-2.0-flash` sudah tidak ada lagi di daftar
 *      model yang bisa diakses kunci proyek ini — versi terpaku menjawab 404.
 *   2. MODEL SEDANG PENUH. Alias `-latest` justru yang paling sering menjawab
 *      503 "high demand", karena ke sanalah semua orang menunjuk.
 *
 * Versi terpaku yang terbukti jalan didahulukan; alias jadi jaring kalau versi
 * itu kelak dipensiunkan. Kalau semuanya gagal, pemanggil tetap dapat judul
 * dari mesin aturan — hanya tidak sepintar tadi.
 *
 * `GEMINI_MODEL` menimpa seluruh rantai kalau perlu dikunci ke satu model.
 */
const RANTAI_MODEL = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : ['gemini-2.5-flash', 'gemini-flash-latest'];

/**
 * Umur cache. Fakta satu listing praktis tidak berubah dalam satu sesi
 * pengisian form, jadi TTL sepanjang ini membuat agent yang bolak-balik antar
 * langkah tidak menghabiskan kuota gratis untuk pertanyaan yang sama.
 */
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAKS = 200;

type Hasil = { kandidat: KandidatJudul[]; sumber: 'ai' | 'aturan'; pesan?: string };

const cache = new Map<string, { pada: number; hasil: Hasil }>();

function bacaCache(kunci: string): Hasil | null {
  const isi = cache.get(kunci);
  if (!isi) return null;
  if (Date.now() - isi.pada > CACHE_TTL_MS) {
    cache.delete(kunci);
    return null;
  }
  return isi.hasil;
}

function tulisCache(kunci: string, hasil: Hasil) {
  // Map mempertahankan urutan sisip, jadi entri terlama ada di depan.
  if (cache.size >= CACHE_MAKS) {
    const tertua = cache.keys().next().value;
    if (tertua) cache.delete(tertua);
  }
  cache.set(kunci, { pada: Date.now(), hasil });
}

// ---------------------------------------------------------------------------
// Pagar isi judul
// ---------------------------------------------------------------------------

/**
 * Pola yang membatalkan sebuah kandidat.
 *
 * Bukan daftar selera — tiap baris menutup satu cara judul jadi menyesatkan
 * atau melanggar keputusan produk yang sudah diambil (lihat aturan 1–3 di
 * kepala src/lib/listingTitle.ts).
 */
const TERLARANG: { pola: RegExp; sebab: string }[] = [
  // Harga dalam bentuk apa pun. Model tidak diberi angka harga sama sekali,
  // jadi apa pun yang lolos ke sini pasti karangan.
  { pola: /\brp\.?\s*\d/i, sebab: 'menyebut harga' },
  // "m" (miliar) SENGAJA tidak masuk daftar satuan: ia tidak bisa dibedakan
  // dari meter, dan justru "600 m ke UNAIR" & "LT 120 m²" adalah dua bentuk
  // yang paling ingin kita pertahankan. Model tidak pernah diberi angka harga,
  // jadi risiko "1,9 M" lolos jauh lebih kecil daripada risiko membuang setiap
  // judul yang menyebut jarak atau luas.
  { pola: /\b\d+([.,]\d+)?\s*(jt|juta|rb|ribu|miliar|milyar)\b/i, sebab: 'menyebut nominal' },
  { pola: /\/\s*(bln|bulan|thn|tahun|hari|minggu)\b/i, sebab: 'menyebut tarif per periode' },
  { pola: /\b(murah|termurah|diskon|promo|nego|budget|cicilan|dp)\b/i, sebab: 'klaim harga' },

  // Cacahan kamar. "Kamar Mandi Dalam" tetap lolos karena tidak berpola angka.
  // "BR" DIKECUALIKAN dengan sengaja: "2BR" adalah nama tipe unit di pasar
  // apartemen (cara orang mengetik pencariannya), bukan cacahan kamar listing
  // ini — memblokirnya akan membuang judul apartemen yang justru paling benar.
  { pola: /\b\d+\s*(kamar|kmr)\b/i, sebab: 'menyebut jumlah kamar' },
  { pola: /\bsisa\s*\d/i, sebab: 'menyebut sisa kamar' },

  // Klaim superlatif tanpa dasar data.
  { pola: /\b(terbaik|terlengkap|ternyaman|paling|nomor 1|no\.?\s*1)\b/i, sebab: 'klaim superlatif' },

  // Gaya yang tidak dipakai di judul listing.
  { pola: /[!?]/, sebab: 'tanda seru/tanya' },
  { pola: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, sebab: 'emoji' },
];

/** Judul yang seluruhnya kapital terbaca seperti spam, bukan seperti judul. */
const teriak = (s: string) => s.length > 12 && s === s.toUpperCase();

/**
 * Kata yang menandai judul sedang MENGKLAIM KEDEKATAN dengan suatu tempat.
 * Klaim seperti itu hanya sah kalau tempatnya memang ada di daftar patokan.
 */
const POLA_KEDEKATAN =
  /\b(dekat|didekat|menuju|selangkah|seberang|depan|samping|belakang|menit ke|meter (ke|dari)|km (ke|dari)|akses ke)\b/i;

/** Kata umum kategori — bukan identitas tempat, jadi tidak bisa jadi bukti. */
const KATA_UMUM_TEMPAT = new Set([
  'masjid', 'musholla', 'gereja', 'sekolah', 'kampus', 'universitas', 'institut',
  'stasiun', 'terminal', 'halte', 'bandara', 'mall', 'plaza', 'pasar', 'toko',
  'rumah', 'sakit', 'klinik', 'apotek', 'posyandu', 'bidan', 'puskesmas',
  'negeri', 'swasta', 'school', 'jalan', 'kota', 'kabupaten', 'wisma', 'residence',
  'tempat', 'ibadah', 'lainnya', 'gedung', 'kantor', 'pusat', 'raya', 'baru',
  'paud', 'sdit', 'smpn', 'sman', 'smkn', 'bank', 'spbu',
]);

/**
 * Kumpulan kata yang benar-benar MENGIDENTIFIKASI patokan milik listing ini.
 *
 * Dipakai untuk memeriksa klaim kedekatan. Nama patokan dipecah jadi kata,
 * lalu kata kategori yang generik dibuang — "Masjid" tidak membuktikan apa pun
 * karena hampir setiap listing punya masjid di dekatnya, sedangkan
 * "Hidayatul-Islamiyyah" hanya mungkin muncul kalau model membacanya dari
 * fakta yang kita kirim.
 */
function penandaPatokan(d: DataJudul): Set<string> {
  /**
   * Kata milik NAMA DAERAH tidak boleh jadi bukti.
   *
   * Setiap judul memang wajib menyebut daerahnya, dan daerah itu sering ikut
   * menempel di nama patokan ("Lidah Kulon B", "SMA Negeri 13 Surabaya").
   * Kalau "lidah", "kulon", atau "surabaya" dihitung sebagai bukti, maka
   * "selangkah menuju Pakuwon Trade Center di Lidah Kulon" akan lolos hanya
   * karena kebetulan menyebut nama kelurahannya — persis judul karangan yang
   * sedang kita cegah.
   */
  const kataDaerah = new Set(
    [d.kota, d.kecamatan, d.kelurahan]
      .filter(Boolean)
      .flatMap((x) => String(x).toLowerCase().split(/[\s,./()-]+/))
      .filter(Boolean),
  );

  const kata = new Set<string>();
  for (const a of d.akses_terdekat ?? []) {
    const nama = a?.nama?.trim().toLowerCase();
    if (!nama) continue;
    // Nama utuh tetap dihitung: menyebutnya lengkap sudah bukti tersendiri.
    kata.add(nama);
    for (const bagian of nama.split(/[\s,./()-]+/)) {
      if (
        bagian.length >= 4 &&
        !KATA_UMUM_TEMPAT.has(bagian) &&
        !kataDaerah.has(bagian)
      ) {
        kata.add(bagian);
      }
    }
  }
  return kata;
}

/**
 * Judul mengklaim dekat sesuatu, tapi tidak menyebut satu pun patokan yang
 * benar-benar terdaftar → tempatnya dikarang.
 *
 * Ini kegagalan yang paling merugikan dan paling sulit ditangkap: modelnya
 * fasih, kalimatnya meyakinkan, dan satu-satunya yang salah adalah fakta —
 * "hanya selangkah menuju Pakuwon Trade Center" untuk kos yang patokan
 * terdekatnya sebuah PAUD. Pembaca tidak punya cara tahu, agent tidak
 * memeriksa judul yang terlihat bagus, dan yang menanggung akibatnya calon
 * penghuni yang datang survei.
 */
function mengarangTempat(teks: string, d: DataJudul): boolean {
  if (!POLA_KEDEKATAN.test(teks)) return false;
  const penanda = penandaPatokan(d);
  if (penanda.size === 0) return true; // klaim kedekatan tanpa patokan apa pun
  const kecil = teks.toLowerCase();
  return ![...penanda].some((k) => kecil.includes(k));
}

function lolosPagar(teks: string, d: DataJudul): boolean {
  if (teks.length < 15 || teks.length > JUDUL_MAKS) return false;
  if (teriak(teks)) return false;
  if (TERLARANG.some(({ pola }) => pola.test(teks))) return false;
  return !mengarangTempat(teks, d);
}

const rapikan = (s: string) =>
  s
    .replace(/["'`]/g, '')
    // "2 KM ke Galaxy Mall" — di iklan properti Indonesia "KM" huruf besar
    // dibaca KAMAR MANDI, bukan kilometer. Model tidak pernah diberi jumlah
    // kamar mandi, jadi "angka + KM" di sini pasti jarak; dikecilkan supaya
    // tidak ada pembaca yang salah mengerti.
    .replace(/(\d)\s*KM\b/g, '$1 km')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.])/g, '$1')
    .replace(/[\s,.;:—-]+$/g, '')
    .trim();

/**
 * Enum internal → kata yang dipakai manusia.
 *
 * Tanpa ini model menulis "Rumah Secondary Rungkut": ia menerima "SECONDARY"
 * sebagai fakta dan dengan patuh memasukkannya ke judul. Istilah internal
 * sistem tidak pernah boleh bocor ke halaman yang dibaca pembeli.
 */
const KATA_TRANSAKSI: Record<string, string> = {
  PRIMARY: 'dijual (properti baru dari pengembang)',
  SECONDARY: 'dijual (properti bekas/second)',
  LELANG: 'dilelang',
  SEWA: 'disewakan',
};

const KATA_KAMAR_MANDI: Record<string, string> = {
  DALAM: 'kamar mandi dalam',
  LUAR: 'kamar mandi luar (bersama)',
};

const KATA_GENDER: Record<string, string> = {
  PUTRA: 'khusus putra',
  PUTRI: 'khusus putri',
  CAMPUR: 'campur (putra & putri)',
};

const KATA_TIPE_UNIT: Record<string, string> = {
  STUDIO: 'studio',
  SATU_KAMAR: '1BR',
  DUA_KAMAR: '2BR',
  TIGA_KAMAR: '3BR',
  EMPAT_KAMAR_PLUS: '4BR',
};

const KATA_PATOKAN: Record<string, string> = {
  KAMPUS: 'kampus',
  SEKOLAH: 'sekolah',
  STASIUN: 'stasiun',
  HALTE: 'halte/terminal',
  BANDARA: 'bandara',
  MALL: 'mall',
  PASAR: 'pasar',
  RUMAH_SAKIT: 'rumah sakit',
  PERKANTORAN: 'perkantoran',
  MASJID: 'masjid',
  MINIMARKET: 'minimarket',
  LAINNYA: 'lainnya',
};

const KATA_KATEGORI: Record<string, string> = {
  RUMAH: 'rumah',
  APARTEMEN: 'apartemen',
  RUKO: 'ruko',
  TANAH: 'tanah',
  GUDANG: 'gudang',
  HOTEL_DAN_VILLA: 'villa',
  TOKO: 'toko',
  PABRIK: 'pabrik',
  KOS: 'kos',
};

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function susunPrompt(d: DataJudul): string {
  // Hanya fakta yang benar-benar terisi yang dikirim. Field kosong yang ikut
  // terkirim sebagai null adalah undangan bagi model untuk mengisinya sendiri.
  const fakta: Record<string, unknown> = {};
  const isi = (k: string, v: unknown) => {
    if (v === null || v === undefined || v === '' ) return;
    if (Array.isArray(v) && v.length === 0) return;
    fakta[k] = v;
  };

  isi('status', d.jenis_transaksi ? KATA_TRANSAKSI[d.jenis_transaksi] : null);
  isi('jenis_properti', d.kategori ? KATA_KATEGORI[d.kategori] : null);
  isi('kota', d.kota);
  isi('kecamatan', d.kecamatan);
  isi('kelurahan', d.kelurahan);
  isi('luas_tanah_m2', d.luas_tanah);
  isi('luas_bangunan_m2', d.luas_bangunan);
  isi('jumlah_lantai', d.jumlah_lantai);
  isi('kondisi_interior', d.kondisi_interior);
  isi('sertifikat', d.legalitas);
  isi('tanggal_lelang', d.tanggal_lelang);
  isi('peruntukan_kos', d.kos_gender ? KATA_GENDER[d.kos_gender] : null);
  isi('kamar_mandi', d.kamar_mandi_tipe ? KATA_KAMAR_MANDI[d.kamar_mandi_tipe] : null);
  isi('akses_24_jam', d.akses_24_jam);
  isi('fasilitas_kamar', d.fasilitas_kamar);
  isi('tipe_unit_apartemen', d.tipe_unit ? KATA_TIPE_UNIT[d.tipe_unit] : null);
  isi('nama_gedung', d.nama_gedung);
  // Hanya patokan terkuat yang dikirim. Satu titik di tengah kota bisa punya
  // 40+ patokan; menyodorkan semuanya membuat yang penting tenggelam di antara
  // belasan halte, dan model yang kehilangan pegangan mulai mengarang nama
  // tempat terkenal yang ia ingat sendiri.
  isi(
    'patokan_terdekat',
    patokanTerpilih(d, 8, 40)
      .map((a) => ({
        jenis: KATA_PATOKAN[a.tipe] ?? 'lainnya',
        nama: a.nama.trim(),
        jarak:
          a.jarak != null
            ? `${a.jarak} ${a.satuan === 'KM' ? 'km' : 'menit'}`
            : undefined,
      })),
  );
  isi(
    'fasilitas_semua_tipe_kamar',
    (d.kamar_tipe ?? [])
      .map((t) => t.fasilitas_kamar)
      .filter(Boolean),
  );

  return `Kamu copywriter properti Indonesia. Tugasmu menulis JUDUL IKLAN yang terdengar seperti ditulis manusia, bukan daftar kata kunci.

FAKTA PROPERTI (hanya ini yang boleh kamu pakai):
${JSON.stringify(fakta, null, 2)}

CONTOH JUDUL BURUK — jangan pernah seperti ini:
- "Kos Putri Mulyorejo Surabaya Kamar Mandi Dalam AC Dekat UNAIR" (tumpukan kata kunci, bukan kalimat)
- "Kos Putri AC Akses 24 Jam Kamar Mandi Dalam Surabaya" (semua fakta dijejalkan, tidak ada sudut)
- "Kos Putri Terbaik dan Termurah Dekat Kampus" (klaim tanpa dasar)
- "Rumah Secondary Rungkut Dekat Mall" (memakai istilah internal sistem)

CONTOH JUDUL BAIK — seperti inilah yang diminta:
- "Kos Putri Ber-AC, 600 Meter ke UNAIR Kampus C"
- "Kos Putri di Mulyorejo untuk Mahasiswi UNAIR"
- "Kos Putri Akses 24 Jam di Mulyorejo, Kamar Mandi Dalam"
Perhatikan: masing-masing memakai PALING BANYAK DUA fakta pendukung, dan mengalir seperti kalimat.

ATURAN — judul yang melanggar dibuang:
1. Hanya pakai fakta di atas. Dilarang mengarang fasilitas, kondisi, atau kedekatan apa pun.
2. Dilarang menambah kata pujian yang tidak ada di fakta: nyaman, asri, eksklusif, mewah, strategis, aman, bersih, lengkap. Sebutkan fakta, jangan memuji.
3. Nama tempat harus PERSIS seperti di daftar patokan_terdekat. Jangan menambah kata seperti "gerbang", "kampus", atau "pintu" kalau tidak tertulis.
3b. DILARANG KERAS menyebut tempat, mall, kampus, atau jalan yang TIDAK ADA di daftar patokan_terdekat — sekalipun kamu tahu tempat itu memang ada di daerah tersebut. Kamu hanya boleh menyebut nama yang tertulis di fakta di atas. Kalau daftar patokannya tidak menarik, JANGAN menyebut patokan sama sekali; pakai sudut lain.
4. Dilarang menyebut harga, nominal, tarif, atau kata murah/promo/nego/diskon. Harga sudah tampil besar di kartu listing; mengulanginya di judul hanya membuang ruang.
5. Dilarang menyebut jumlah kamar, sisa kamar, atau jumlah unit. ("Kamar Mandi Dalam" boleh — itu jenis kamar mandi, bukan cacahan.)
6. Dilarang klaim superlatif: terbaik, ternyaman, paling strategis.
7. MAKSIMAL ${JUDUL_IDEAL_MAKS} KARAKTER termasuk spasi. Hitung sebelum menjawab — ini batas potong Google.
8. Wajib menyebut jenis properti DAN nama daerah (kecamatan atau kota).
9. Maksimal DUA fakta pendukung per judul. Sisanya buang — itu tugas deskripsi, bukan judul.
10. Jarak ditulis "600 meter" atau "2 km" huruf kecil. JANGAN "2 KM" huruf besar: di iklan properti Indonesia "KM" dibaca sebagai kamar mandi.
11. Tanpa emoji, tanpa tanda seru, tanpa kapital semua. Title Case seperti judul iklan.

SUDUT YANG HARUS BERBEDA untuk ketiga judul:
- Judul 1: patokan terdekat sebagai tulang punggung, pakai jarak konkret kalau ada.
- Judul 2: untuk siapa tempat ini paling cocok, DISIMPULKAN DARI FAKTA (dekat kampus -> mahasiswa kampus itu; dekat perkantoran -> karyawan; rumah besar & berlantai dua -> keluarga). Kalau tidak ada dasarnya, pakai sudut lokasi yang berbeda dari judul 1.
- Judul 3: satu ciri khas properti + nama daerah.

Balas HANYA JSON array 3 objek, tanpa teks lain:
[{"gaya":"label 1-2 kata untuk sudut ini","teks":"judulnya","alasan":"satu kalimat singkat kenapa sudut ini kuat"}]`;
}

// ---------------------------------------------------------------------------
// Panggilan model
// ---------------------------------------------------------------------------

async function mintaKeSatuModel(
  model: string,
  prompt: string,
  kunci: string,
  signal: AbortSignal,
): Promise<Omit<KandidatJudul, 'skor' | 'id'>[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': kunci,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          // Judul butuh sedikit keberanian berbahasa; terlalu rendah dan
          // ketiganya jadi parafrase satu sama lain.
          temperature: 0.9,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
          // Penalaran internal DIMATIKAN. Bukan penghematan biaya semata:
          // model sempat menghabiskan 670 dari 700 token jatah untuk berpikir,
          // lalu jawabannya terpotong di tengah string JSON — dan seluruh
          // fitur diam-diam jatuh ke mesin aturan tanpa satu pun pesan error.
          // Menulis tiga judul pendek tidak menuntut penalaran bertingkat.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const err = new Error(`Gemini ${model} ${res.status}: ${detail.slice(0, 160)}`);
    // Ditandai supaya pemanggil tahu ini layak dicoba ke model berikutnya
    // (model penuh/hilang/kuota), bukan kesalahan bentuk permintaan kita.
    (err as Error & { bolehGantiModel?: boolean }).bolehGantiModel =
      res.status === 404 || res.status === 429 || res.status >= 500;
    throw err;
  }

  const json = await res.json();
  const teks: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!teks) throw new Error('Balasan model kosong');

  // `responseMimeType: application/json` biasanya sudah bersih, tapi pagar
  // pengurai tetap dipasang: sekali model membungkusnya dengan ```json,
  // JSON.parse akan gagal dan seluruh fitur ikut mati tanpa alasan yang jelas.
  const bersih = teks.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(bersih);
  if (!Array.isArray(parsed)) throw new Error('Balasan model bukan array');

  return parsed
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => ({
      gaya: String(x.gaya ?? 'Saran AI').slice(0, 20),
      teks: rapikan(String(x.teks ?? '')),
      alasan: String(x.alasan ?? '').slice(0, 180),
    }));
}

/** Coba tiap model di rantai sampai ada yang menjawab. */
async function mintaKeGemini(
  d: DataJudul,
  kunci: string,
  signal: AbortSignal,
): Promise<Omit<KandidatJudul, 'skor' | 'id'>[]> {
  const prompt = susunPrompt(d);
  let terakhir: unknown;

  for (const model of RANTAI_MODEL) {
    try {
      return await mintaKeSatuModel(model, prompt, kunci, signal);
    } catch (e) {
      terakhir = e;
      const bisaLanjut = (e as { bolehGantiModel?: boolean })?.bolehGantiModel;
      // Permintaan dibatalkan (lewat batas waktu) atau salah bentuk: mencoba
      // model lain hanya memperpanjang penantian tanpa mengubah hasilnya.
      if (!bisaLanjut || signal.aborted) throw e;
      console.warn(`[judul] ${model} tidak bisa dipakai, coba berikutnya:`, e);
    }
  }
  throw terakhir instanceof Error ? terakhir : new Error('Semua model gagal');
}

// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let data: DataJudul;
  try {
    data = (await request.json()) as DataJudul;
  } catch {
    return NextResponse.json({ error: 'Body bukan JSON' }, { status: 400 });
  }

  // Selalu siapkan hasil aturan lebih dulu — ia jawaban cadangan untuk SETIAP
  // jalur kegagalan di bawah, jadi tidak ada cabang yang boleh mengembalikan
  // daftar kosong.
  const cadangan: Hasil = {
    kandidat: susunKandidatJudul(data),
    sumber: 'aturan',
  };

  if (!bisaRakitJudul(data)) {
    return NextResponse.json({ ...cadangan, pesan: 'Data belum cukup' });
  }

  const kunci = process.env.GEMINI_API_KEY;
  if (!kunci) {
    return NextResponse.json({
      ...cadangan,
      pesan: 'GEMINI_API_KEY belum diisi — memakai saran otomatis biasa',
    });
  }

  // `?paksa=1` = agent menekan "Tulis ulang" karena ketiga saran tadi tidak
  // ada yang cocok. Melewati cache adalah SATU-SATUNYA cara tombol itu punya
  // arti; tanpa ini ia akan mengembalikan tiga judul yang sama persis.
  const paksa = new URL(request.url).searchParams.get('paksa') === '1';

  const sidik = JSON.stringify(data);
  if (!paksa) {
    const tersimpan = bacaCache(sidik);
    if (tersimpan) return NextResponse.json(tersimpan);
  }

  // Batas waktu keras. Agent sedang menunggu di depan form; saran judul yang
  // datang setelah 15 detik sudah tidak berguna, dan menahan permintaan
  // selamanya adalah cara paling pelan membuat halaman terasa rusak.
  const pembatal = new AbortController();
  const jamPasir = setTimeout(() => pembatal.abort(), 15_000);

  try {
    const mentah = await mintaKeGemini(data, kunci, pembatal.signal);

    const terlihat = new Set<string>();
    const lolos = mentah
      .filter((k) => {
        if (!lolosPagar(k.teks, data)) return false;
        const kunciTeks = k.teks.toLowerCase();
        if (terlihat.has(kunciTeks)) return false;
        terlihat.add(kunciTeks);
        return true;
      })
      .slice(0, 3)
      .map((k, i) => ({
        ...k,
        id: (['lokasi', 'kunci', 'ringkas'] as const)[i] ?? 'lokasi',
        skor: nilaiJudul(k.teks, data).skor,
      }));

    // Semua kandidat gugur di pagar (model mengarang harga, mengaku terbaik,
    // atau memakai emoji di ketiganya). Lebih baik saran aturan yang membosankan
    // daripada judul yang menjanjikan hal yang tidak ada.
    if (lolos.length === 0) {
      return NextResponse.json({
        ...cadangan,
        pesan: 'Saran AI tidak lolos pemeriksaan fakta',
      });
    }

    const hasil: Hasil = { kandidat: lolos, sumber: 'ai' };
    tulisCache(sidik, hasil);
    return NextResponse.json(hasil);
  } catch (e) {
    // Kuota habis, model salah nama, jaringan putus, JSON rusak — semuanya
    // berakhir sama: agent tetap dapat judul, hanya tidak sepintar tadi.
    console.error('[judul] gagal memanggil model:', e);
    return NextResponse.json({
      ...cadangan,
      pesan: 'Model sedang tidak bisa dihubungi — memakai saran otomatis biasa',
    });
  } finally {
    clearTimeout(jamPasir);
  }
}

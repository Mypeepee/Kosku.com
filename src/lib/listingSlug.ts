/**
 * Pembentuk slug URL listing — SATU-SATUNYA tempat aturannya ditulis.
 *
 * ── MASALAH YANG DIPERBAIKI ───────────────────────────────────────────────
 * Sebelum ini slug dibentuk langsung dari `judul` apa adanya, sehingga URL
 * mewarisi seluruh nasib ketikan agent:
 *
 *   /Sewa/nnfrscdsvsvgs-mij10k-iactg-122317
 *
 * Dua akibatnya. Pertama, URL tidak terbaca manusia — dan URL adalah salah
 * satu hal yang ikut ditampilkan di hasil pencarian. Kedua, dan ini yang jauh
 * lebih mahal: pencarian properti didominasi LOKASI ("kos murah surabaya",
 * "sewa apartemen gubeng"), sementara judul sering tidak menyebut kotanya sama
 * sekali. Slug yang hanya menyalin judul membuang kata kunci terpenting yang
 * sebenarnya sudah kita punya di kolom `kota` & `kecamatan`.
 *
 * Karena itu slug di sini DISUSUN, bukan disalin:
 *
 *   kategori + judul (dibatasi) + kecamatan + kota
 *   → kos-putri-mawar-tenggilis-mejoyo-surabaya
 *
 * Judul gibberish pun tetap menghasilkan URL yang mengandung kata kunci nyata,
 * karena kategori & lokasi tidak pernah datang dari ketikan bebas.
 *
 * ── KENAPA BERKAS INI TANPA SATU PUN IMPOR ────────────────────────────────
 * Aturan yang sama dipakai tiga tempat: API pembuatan listing, API
 * penyuntingan, dan skrip backfill `scripts/backfill-slug-seo.ts` yang
 * dijalankan langsung oleh Node (bukan lewat bundler Next). Tanpa impor —
 * termasuk tanpa alias `@/` — berkas ini bisa dibaca ketiganya apa adanya.
 * Menyalin logikanya ke skrip akan membuat URL hasil backfill perlahan
 * berbeda dari URL listing baru, dan itu jenis perbedaan yang baru ketahuan
 * setelah ratusan halaman terlanjur terindeks.
 */

/** Berapa kata dari judul yang boleh masuk slug. */
const MAKS_TOKEN_JUDUL = 7;

/**
 * Batas panjang slug (tanpa `-id` di belakangnya).
 *
 * Bukan batas teknis — kolomnya VarChar(300) dan Google tidak menghukum URL
 * panjang. Ini batas KETERBACAAN: slug yang lebih panjang dari ini terpotong
 * di hasil pencarian, di bilah alamat ponsel, dan saat ditempel ke WhatsApp,
 * sehingga bagian ekornya — yang justru berisi lokasi — tidak pernah terlihat.
 */
const MAKS_PANJANG = 80;

/**
 * Kata yang tidak pernah dicari orang dan hanya memakan jatah panjang.
 *
 * Sengaja PENDEK. "dijual", "disewakan", "murah", "dekat" TIDAK masuk daftar
 * ini — semuanya kata kunci yang benar-benar diketik orang di Google.
 */
const STOPWORD = new Set([
  "di", "ke", "dari", "yang", "dan", "atau", "untuk", "dengan", "pada",
  "dalam", "ini", "itu", "the", "of", "a", "an", "for", "in", "at",
]);

/** Label kategori sebagai kata yang benar-benar dicari orang. */
const KATEGORI_LABEL: Record<string, string> = {
  KOS: "kos",
  RUMAH: "rumah",
  APARTEMEN: "apartemen",
  RUKO: "ruko",
  TANAH: "tanah",
  GUDANG: "gudang",
  HOTEL_DAN_VILLA: "villa",
  TOKO: "toko",
  PABRIK: "pabrik",
};

export interface SumberSlug {
  judul?: string | null;
  /** Nilai enum kategori, mis. "KOS". Bebas huruf besar/kecil. */
  kategori?: string | null;
  kecamatan?: string | null;
  kota?: string | null;
  /**
   * Alamat lengkap. Dipakai sebagai PENGGANTI judul kalau judulnya ternyata
   * kalimat baku tanpa daya pembeda — lihat `judulBaku` di bawah.
   */
  alamat?: string | null;
}

/**
 * Judul yang tidak membedakan satu aset dari aset lain.
 *
 * Ini bukan kehati-hatian teoretis. 99% baris di tabel listing berasal dari
 * pengambilan otomatis lelang, dan judulnya kalimat hukum yang seragam:
 *
 *   "1 bidang tanah dengan total luas 117 m2 berikut bangunan di Kota Makassar"
 *   "1 bidang tanah dengan total luas 365 m2 berikut bangunan di Kab. …"
 *
 * Slug dari judul semacam itu menghasilkan alamat yang praktis sama untuk
 * ribuan aset berbeda — bertabrakan terus-menerus, dan tidak satu pun kata di
 * dalamnya yang membantu orang menemukan aset TERTENTU. Alamatnya jauh lebih
 * berdaya beda ("griya-alam-permai-d1-kapasa"), jadi itu yang dipakai.
 *
 * Polanya sengaja SEMPIT dan hanya mengenali kalimat pembuka baku dokumen
 * lelang. Deteksi "judul jelek" yang serakah akan mulai membuang judul asli
 * tulisan agent, dan itu kerusakan yang jauh lebih sulit disadari.
 */
function judulBaku(judul: string): boolean {
  return /^\s*(\d+\s*(\([a-z]+\))?|se)\s*bidang\s+tanah\b/i.test(judul);
}

/**
 * Teks bebas → deretan kata bersih.
 *
 * Diakritik diuraikan lebih dulu (NFD) lalu tanda-nya dibuang, sehingga
 * "Bogor Café" menjadi "bogor cafe" dan bukan "bogor caf" — huruf yang hilang
 * diam-diam adalah cara paling halus merusak sebuah kata kunci.
 */
function token(s: string | null | undefined): string[] {
  if (!s) return [];
  return s
    .normalize("NFD")
    // \p{M} = semua tanda gabung (combining marks) Unicode. Dipakai alih-alih
    // rentang \u0300-\u036f yang ditulis literal: tanda diakritik telanjang di
    // berkas sumber tidak terlihat di editor mana pun, dan satu editor yang
    // menormalkan berkasnya akan mengubah regex ini tanpa jejak di diff.
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** Buang kata kembar, urutan kemunculan pertama dipertahankan. */
function unik(kata: string[]): string[] {
  const lihat = new Set<string>();
  const out: string[] = [];
  for (const k of kata) {
    if (lihat.has(k)) continue;
    lihat.add(k);
    out.push(k);
  }
  return out;
}

/**
 * Slug SEO untuk satu listing. Selalu mengembalikan string tidak kosong.
 *
 * Angka id TIDAK ikut di sini — ia ditempelkan saat URL dirakit
 * (`${slug}-${id_property}`), supaya kolom `slug` tetap bisa dipakai untuk
 * hal lain tanpa harus membedah kembali bagian mana yang id.
 */
export function buatSlugListing(s: SumberSlug): string {
  const kategori = (s.kategori ?? "").toUpperCase().trim();
  const katTok = KATEGORI_LABEL[kategori]
    ? [KATEGORI_LABEL[kategori]]
    : token(kategori).slice(0, 1);

  // Lokasi disusun lebih dulu karena ia yang menentukan kata mana di judul
  // yang boleh dibuang sebagai kembaran. Kecamatan sebelum kota: dari yang
  // paling spesifik ke paling umum, sama seperti cara orang menyebut alamat.
  const lokTok = unik([...token(s.kecamatan), ...token(s.kota)]);

  // Kata yang sudah pasti muncul dari kategori & lokasi tidak perlu diambil
  // lagi dari judul — "Kos Putri Surabaya" + kota Surabaya seharusnya menjadi
  // "kos-putri-surabaya", bukan "kos-putri-surabaya-surabaya".
  // Sumber bagian deskriptif: judul, kecuali judulnya kalimat baku lelang yang
  // tidak membedakan apa pun — maka alamat yang dipakai.
  const judul = (s.judul ?? "").trim();
  const deskriptif =
    judul && judulBaku(judul) && s.alamat?.trim() ? s.alamat : judul;

  const sudahAda = new Set([...katTok, ...lokTok]);
  let judTok = unik(token(deskriptif))
    .filter((t) => !STOPWORD.has(t) && !sudahAda.has(t))
    .slice(0, MAKS_TOKEN_JUDUL);

  const rakit = () => [...katTok, ...judTok, ...lokTok].join("-");

  // Kalau kepanjangan, yang dipotong SELALU dari judul — tidak pernah lokasi.
  // Lokasi adalah kata kunci paling bernilai di slug ini; membuangnya demi
  // memuat satu kata lagi dari judul membatalkan seluruh alasan fungsi ini ada.
  while (rakit().length > MAKS_PANJANG && judTok.length > 0) {
    judTok = judTok.slice(0, -1);
  }

  // Listing tanpa judul, kategori, maupun lokasi seharusnya mustahil (semuanya
  // wajib di form), tapi slug kosong akan menghasilkan URL "/Sewa/-122317"
  // yang tidak bisa dipulihkan oleh redirect mana pun.
  return rakit() || "properti";
}

/**
 * Cari varian slug yang belum terpakai.
 *
 * Berakhiran `-2`, `-3`, … seperti WordPress — BUKAN lima huruf acak seperti
 * sebelumnya (`-a3f9k`). Keduanya sama-sama menyelesaikan tabrakan, tapi yang
 * pertama masih terbaca manusia, dan seluruh gunanya berkas ini adalah supaya
 * URL bisa dibaca.
 *
 * `dipakai` dibuat sebagai callback supaya berkas ini tetap tanpa impor —
 * pemanggil yang menyediakan cara bertanya ke database.
 */
export async function buatSlugUnik(
  dasar: string,
  dipakai: (kandidat: string) => Promise<boolean>,
  maksPercobaan = 50,
): Promise<string> {
  if (!(await dipakai(dasar))) return dasar;

  for (let n = 2; n <= maksPercobaan; n++) {
    const kandidat = `${dasar}-${n}`;
    if (!(await dipakai(kandidat))) return kandidat;
  }

  // Lima puluh listing dengan kategori, judul, DAN lokasi yang sama persis.
  // Praktis mustahil, tapi gagal menyimpan listing karena slug lebih buruk
  // daripada satu slug jelek.
  return `${dasar}-${Date.now().toString(36)}`;
}

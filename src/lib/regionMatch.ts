/**
 * regionMatch — menjembatani nama wilayah yang DIPILIH pemakai dengan nilai
 * yang benar-benar tersimpan di kolom `listing.provinsi/kota/kecamatan/kelurahan`.
 *
 * ── KENAPA INI ADA ──────────────────────────────────────────────────────────
 * Dulu pencocokannya `contains` (ILIKE '%nama%'). Untuk kota itu kebetulan
 * jalan — pemilih wilayah memberi "Kabupaten Sidoarjo" sementara DB menyimpan
 * "Kab. Sidoarjo", dan `contains "Sidoarjo"` menutup selisih itu. Tapi untuk
 * level di bawahnya `contains` salah secara mendasar:
 *
 *   memilih Kecamatan "Taman"  → 763 aset  (ikut terbawa: "Taman Sari",
 *                                "Tamansari", "Ataman Taman", di kota mana pun)
 *   yang benar (Taman, Sidoarjo) → 241 aset
 *
 * Dan untuk kota pun `contains` bocor: "Bandung" ikut menarik "Bandung Barat".
 *
 * ── CARA KERJANYA ───────────────────────────────────────────────────────────
 * Pencocokan diubah jadi SAMA PERSIS (case-insensitive) terhadap sekumpulan
 * VARIAN penulisan yang dibangkitkan dari satu nama. Variannya lahir dari tiga
 * jenis selisih yang memang ada di data (diukur langsung dari tabel listing):
 *
 *   1. Prefix administratif — "Kabupaten Sidoarjo" / "Kab. Sidoarjo" /
 *      "Kab Sidoarjo" / "Sidoarjo". 961 nilai kota berbeda di DB, semuanya
 *      mengikuti salah satu pola ini.
 *   2. Spasi di tengah — "Taman Sari" vs "Tamansari", "Batu Ceper" vs
 *      "Batuceper". Satu kecamatan bisa punya 6 ejaan berbeda, dan selisihnya
 *      bisa ke DUA arah: kadang dataset yang merapatkan ("Bojongsari") sementara
 *      DB memisah ("Bojong Sari"), kadang sebaliknya.
 *   3. Spasi nyasar di pinggir — "Sawangan " (52 baris kecamatan, 553 baris
 *      kelurahan). `equals` polos akan meleset di baris-baris itu.
 *
 * Huruf besar/kecil TIDAK perlu divariasikan: pembanding di Prisma memakai
 * `mode: "insensitive"` yang diterjemahkan jadi `LOWER(kolom) IN (LOWER($n)…)`.
 */

import type { RegionLevel } from "./regionSearch";

/**
 * Prefix administratif tingkat kota/kabupaten, dari yang PALING panjang ke yang
 * paling pendek. Urutan itu wajib: kalau "kota" diuji lebih dulu, "Kota
 * Administrasi Jakarta Barat" akan terpotong jadi "Administrasi Jakarta Barat".
 */
const PREFIX_KOTA_RE =
  /^(kabupaten administrasi|kota administrasi|kab\.?\s*adm\.?|kota\s*adm\.?|kabupaten|kota|kab\.?)\s+/i;

type KeluargaKota = "kota" | "kabupaten";

/**
 * Penulisan prefix yang benar-benar dipakai di data. "Kab." mendominasi (98 rb
 * baris), "Kota" menyusul (58 rb), sisanya ejaan panjang dari dataset wilayah.
 */
const PREFIX_VARIAN: Record<KeluargaKota, string[]> = {
  kota: ["Kota", "Kota Adm.", "Kota Adm", "Kota Administrasi"],
  kabupaten: [
    "Kabupaten",
    "Kab.",
    "Kab",
    "Kabupaten Administrasi",
    "Kab. Adm.",
    "Kab Adm",
  ],
};

/** Rapikan spasi ganda & pinggir tanpa menyentuh isinya. */
export function rapikanSpasi(v: string): string {
  return (v || "").replace(/\s+/g, " ").trim();
}

/**
 * Keluarga administratif sebuah nama kota — atau null bila namanya sudah
 * telanjang ("Sidoarjo"). Null berarti "tidak tahu", dan pemanggil sengaja
 * membangkitkan KEDUA keluarga supaya tautan lama yang hanya menyimpan nama
 * inti tetap menemukan asetnya.
 */
export function keluargaKota(name: string): KeluargaKota | null {
  const m = rapikanSpasi(name).match(PREFIX_KOTA_RE);
  if (!m) return null;
  return /^kab/i.test(m[1]) ? "kabupaten" : "kota";
}

/** Buang prefix administratif dari nama kota → "Kabupaten Sidoarjo" → "Sidoarjo". */
export function intiNamaKota(name: string): string {
  return rapikanSpasi(name).replace(PREFIX_KOTA_RE, "").trim();
}

/**
 * Kunci kanonik sebuah nama wilayah: huruf & angka saja, huruf kecil semua.
 * "Taman Sari", "TAMANSARI", dan "taman sari " semuanya jadi "tamansari",
 * sementara "Taman" tetap "taman" — persis pembeda yang hilang saat memakai
 * `contains`. Dipakai untuk membandingkan dua nama di dalam JS (bukan di SQL).
 */
export function kunciWilayah(name: string, level?: RegionLevel): string {
  const dasar = level === "kota" ? intiNamaKota(name) : name;
  return (dasar || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Apakah dua nama wilayah menunjuk tempat yang sama, lepas dari ejaannya. */
export function namaWilayahSama(
  a: string,
  b: string,
  level?: RegionLevel
): boolean {
  const ka = kunciWilayah(a, level);
  return ka.length > 0 && ka === kunciWilayah(b, level);
}

/**
 * Semua penulisan yang mungkin dari satu nama wilayah, siap dipakai sebagai
 * daftar `in` di Prisma.
 *
 * Daftarnya sengaja dibangkitkan, bukan diambil dari DB: membaca 11 ribu nilai
 * kecamatan berbeda pada setiap permintaan halaman jauh lebih mahal daripada
 * menyusun belasan string di memori, dan hasilnya sama karena selisih ejaan di
 * data hanya tiga jenis yang disebut di kepala berkas ini.
 */
export function regionValueVariants(
  rawName: string,
  level: RegionLevel
): string[] {
  const base = rapikanSpasi(rawName);
  if (!base) return [];

  const bentuk = new Set<string>();
  /** Tambah satu ejaan beserta versi tanpa spasi ("Taman Sari" → "TamanSari"). */
  const tambah = (v: string) => {
    const s = rapikanSpasi(v);
    if (!s) return;
    bentuk.add(s);
    const rapat = s.replace(/\s+/g, "");
    if (rapat !== s) bentuk.add(rapat);
  };

  tambah(base);

  /**
   * Selisih spasi ke arah SEBALIKNYA: nama rapat di sumber, terpisah di DB
   * ("Bojongsari" → "Bojong Sari", "Kotabumi Selatan" → "Kota Bumi Selatan").
   * Membuang spasi itu mudah; mengembalikannya tidak — tidak ada cara menebak
   * di sela mana spasinya dulu berada.
   *
   * Jadi dicoba semua, tapi TERARAH: tiap kata dipecah dua di setiap sela,
   * sementara kata-kata lain dibiarkan utuh. Yang salah ("Bojon gsari") tidak
   * berbahaya — pencocokannya sama persis, jadi ia sekadar tidak pernah cocok
   * dengan apa pun. Memecah per kata, bukan mengacak seluruh nama, menahan
   * daftarnya tetap sepanjang nama (belasan) alih-alih kuadratnya (ratusan).
   *
   * Bentuk rapat penuh juga ikut dipecah, supaya nama yang di DB tersimpan
   * menyatu sepenuhnya ("KOTABUMISELATAN") tetap terjangkau.
   *
   * Tidak berlaku untuk kota: nilai kota di DB sudah rapi (semuanya mengikuti
   * pola "Kab./Kota X"), dan memecah setiap varian prefiksnya cuma
   * melipatgandakan daftar tanpa menambah satu pun kecocokan.
   */
  if (level === "kecamatan" || level === "kelurahan") {
    const kata = base.split(" ");
    const pecah = (teks: string): string[] => {
      if (teks.length < 4 || teks.length > 28) return [];
      const out: string[] = [];
      for (let i = 2; i < teks.length - 1; i++) {
        out.push(`${teks.slice(0, i)} ${teks.slice(i)}`);
      }
      return out;
    };
    for (let w = 0; w < kata.length; w++) {
      for (const belah of pecah(kata[w])) {
        bentuk.add([...kata.slice(0, w), belah, ...kata.slice(w + 1)].join(" "));
      }
    }
    if (kata.length > 1) {
      for (const belah of pecah(kata.join(""))) bentuk.add(belah);
    }
  }

  if (level === "kota") {
    const inti = intiNamaKota(base);
    if (inti) {
      // Nama telanjang: 27 baris di DB memang tersimpan tanpa prefix.
      tambah(inti);
      const keluarga = keluargaKota(base);
      const daftar: KeluargaKota[] = keluarga
        ? [keluarga]
        : ["kota", "kabupaten"];
      for (const k of daftar) {
        for (const p of PREFIX_VARIAN[k]) tambah(`${p} ${inti}`);
      }
    }
  }

  /**
   * Tanda hubung. Dataset wilayah menulis "Wua-Wua"; di DB nama yang sama
   * muncul sebagai "Wua Wua", "Wua - Wua", dan "WuaWua" sekaligus. Ketiganya
   * diturunkan dari bentuk bertanda hubung, jadi cukup satu putaran di sini.
   */
  for (const v of [...bentuk]) {
    if (!v.includes("-")) continue;
    bentuk.add(rapikanSpasi(v.replace(/-/g, " ")));
    bentuk.add(v.replace(/-/g, ""));
    bentuk.add(rapikanSpasi(v.replace(/-/g, " - ")));
  }

  // Spasi nyasar di pinggir. Ditambahkan terakhir supaya setiap ejaan di atas
  // ikut punya pasangan berspasi — `LOWER(kolom) IN (…)` tidak mem-trim kolom.
  const hasil = new Set<string>();
  for (const v of bentuk) {
    if (!v) continue;
    hasil.add(v);
    hasil.add(`${v} `);
    hasil.add(` ${v}`);
  }
  return [...hasil];
}

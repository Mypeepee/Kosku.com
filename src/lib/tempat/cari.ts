import "server-only";

/**
 * Pencarian tempat — mengubah "deket unesa" jadi daftar saran, lalu jadi
 * himpunan aset.
 *
 * ── URUTAN PENCOCOKAN, DAN KENAPA BEGITU ────────────────────────────────────
 * Empat lapis, dari yang paling meyakinkan:
 *
 *   1. SAMA PERSIS      — yang diketik adalah salah satu nama tempat itu.
 *                         Tidak ada yang bisa mengalahkan ini.
 *   2. AWALAN           — orang mengetik dari depan dan belum selesai. Ini
 *                         kasus TERBANYAK di kotak pencarian yang menyarankan
 *                         sambil diketik, dan ia murah (index btree).
 *   3. MENGANDUNG       — "gubeng" di dalam "stasiun surabaya gubeng".
 *   4. MIRIP (trigram)  — "unessa", "tunjungan plasa". Paling mahal dan paling
 *                         mudah salah, jadi paling akhir.
 *
 * Semua dijalankan dalam SATU kueri, bukan empat kueri berurutan yang berhenti
 * di yang pertama berhasil. Alasannya: "unair" cocok PERSIS ke Universitas
 * Airlangga sekaligus MIRIP ke belasan nama lain, dan bertingkat, hasil yang
 * mirip tidak akan pernah terlihat walau kadang justru itu yang dimaksud.
 * Dengan satu kueri berskor, semuanya muncul — hanya urutannya yang berbeda.
 *
 * ── ALIAS AKRONIM DIHUKUM ───────────────────────────────────────────────────
 * Alias bersumber AKRONIM dikurangi skornya. Ia dibangkitkan mesin dari huruf
 * depan, dan huruf depan "Universitas Negeri Surabaya" adalah "uns" — milik
 * kampus lain. Ia boleh ikut mencocokkan (berguna untuk "rsud"), tapi tidak
 * boleh mengalahkan alias yang ditulis manusia.
 */

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { RADIUS_INDEKS } from "./landmark";
import {
  KELAS_TEMPAT,
  RADIUS_JANGKAUAN,
  adalahKelas,
  bacaKueriDekat,
  kelasDariKata,
  normalKota,
  normalNama,
  pisahWilayah,
  tanpaKataJenis,
  type Jangkauan,
  type KelasTempat,
} from "./normalisasi";

// ─────────────────────────────────────────────────────────────────────────────
// BENTUK HASIL
// ─────────────────────────────────────────────────────────────────────────────

export interface SaranTempat {
  /** Nilai untuk param `dekat` di URL. Grup cabang berawalan "brand:". */
  nilai: string;
  nama: string;
  kelas: KelasTempat;
  label: string;
  icon: string;
  warna: string;
  kota: string | null;
  /** Berapa aset tayang ada di dekatnya — ditampilkan, bukan cuma diurut. */
  jumlah: number;
  /** > 1 berarti saran ini mewakili beberapa tempat sekaligus. */
  cabang?: number;
  /**
   * Satuan untuk `jumlah`. "properti" (bawaan) untuk tempat tertentu, nama
   * kelasnya untuk pencarian jenis ("23 kampus").
   *
   * Dua satuan di satu daftar terdengar tidak konsisten, dan memang begitu —
   * tapi menyeragamkannya justru berbohong. Untuk "Semua kampus di Malang",
   * angka properti tidak bisa dihitung tanpa memindai seluruh indeks, dan
   * menjumlahkan `jumlah_listing` tiap kampus akan menghitung ganda aset yang
   * kebetulan dekat dua kampus. Jumlah TEMPAT-nya eksak dan murah, jadi itu
   * yang ditampilkan — dengan satuannya ditulis terang-terangan.
   */
  satuan?: string;
  /** True bila saran ini "jenis tempat", bukan tempat tertentu. */
  kelasSemua?: boolean;
  /**
   * True bila saran ini sengaja MENGABAIKAN wilayah yang diminta user, karena
   * wilayah itu belum ada isinya di kamus.
   *
   * Ditandai supaya dua hal bisa terjadi: daftarnya menjelaskan diri sendiri
   * ("Banten belum ada di kamus"), dan penebak teks-bebas MENOLAK memakainya.
   * Menawarkan alternatif itu ramah; memakainya diam-diam saat user menekan
   * Enter adalah menjawab pertanyaan lain sambil berpura-pura menjawab
   * pertanyaannya.
   */
  gantiWilayah?: boolean;
  /** Wilayah yang tadi diminta user, terisi hanya bila `gantiWilayah`. */
  wilayahDiminta?: string;
  /** Radius bawaan saat saran ini dipilih, meter. */
  radius: number;
  /**
   * Skor pencocokan, 0–1,1. 1,0 berarti yang diketik SAMA PERSIS dengan salah
   * satu nama tempat ini. Dipakai `tebakTempatDariTeks` untuk memutuskan
   * apakah boleh mengubah arti pencarian tanpa diminta.
   */
  skor: number;
}

interface BarisSaran {
  id: bigint;
  slug: string;
  nama: string;
  nama_normal: string;
  kelas: string;
  jangkauan: string;
  kota: string | null;
  brand_normal: string | null;
  jumlah_listing: number;
  skor: number;
}

/** Ambang kemiripan trigram. Di bawah ini hasilnya derau, bukan saran. */
const AMBANG_MIRIP = 0.34;

/**
 * Panjang minimum sebelum pencocokan trigram diaktifkan.
 *
 * Trigram atas kueri dua huruf cocok ke hampir apa pun — "un" ada di dalam
 * ribuan nama. Untuk kueri sependek itu hanya awalan yang masuk akal, dan
 * awalan justru persis yang dimaksud orang yang baru mengetik dua huruf.
 */
const MIN_TRIGRAM = 4;

// ─────────────────────────────────────────────────────────────────────────────
// SARAN (autocomplete)
// ─────────────────────────────────────────────────────────────────────────────

export interface OpsiCari {
  /** Kota yang sedang dilihat user — hasil di kota itu dinaikkan, tidak disaring. */
  kota?: string | null;
  batas?: number;
}

/**
 * Bentuk-bentuk kueri yang layak dicoba, beserta bobotnya.
 *
 * Bentuk kedua lahir dari kegagalan nyata: "dekat kampus ciputra" tidak
 * menemukan Universitas Ciputra Surabaya. Yang diketik orang adalah KATA JENIS
 * versinya sendiri ("kampus"), bukan kata jenis yang tertulis di papan nama
 * ("Universitas") — dan tidak ada kemiripan trigram yang bisa menjembatani itu,
 * karena keduanya kata yang sama sekali berbeda.
 *
 * Perlakuannya harus setangkup dengan sisi penyimpanan: nama tempat sudah
 * disimpan berikut alias tanpa kata jenisnya ("ciputra surabaya"), jadi kueri
 * pun dicoba tanpa kata jenisnya ("ciputra"). Kedua sisi bertemu di tengah.
 *
 * Bobot 0,92 (bukan 1,0) karena bentuk terpotong memang sedikit lebih longgar:
 * yang mengetik nama lengkapnya tetap harus menang atas yang cocok hanya
 * setelah katanya dibuang.
 */
function bentukKueri(inti: string): Array<{ teks: string; bobot: number }> {
  const bentuk = [{ teks: inti, bobot: 1 }];
  const potong = tanpaKataJenis(inti);
  if (potong && potong !== inti) bentuk.push({ teks: potong, bobot: 0.92 });
  return bentuk;
}

/** Ekspresi skor untuk satu alias, mengambil yang terbaik dari semua bentuk. */
function ekspresiSkor(
  bentuk: Array<{ teks: string; bobot: number }>,
  pakaiTrigram: boolean,
): Prisma.Sql {
  const bagian = bentuk.map(({ teks, bobot }) => {
    const mirip = pakaiTrigram && teks.length >= MIN_TRIGRAM
      ? Prisma.sql`similarity(a.alias_normal, ${teks}) * 0.55`
      : Prisma.sql`0`;
    return Prisma.sql`(CASE
      WHEN a.alias_normal = ${teks}            THEN 1.00
      WHEN a.alias_normal LIKE ${`${teks}%`}   THEN 0.80
      WHEN a.alias_normal LIKE ${`%${teks}%`}  THEN 0.62
      ELSE ${mirip}
    END * ${bobot})`;
  });
  return bagian.length === 1
    ? bagian[0]
    : Prisma.sql`GREATEST(${Prisma.join(bagian, ", ")})`;
}

/** Syarat WHERE — sekadar penyaring kasar supaya index terpakai. */
function ekspresiSaring(
  bentuk: Array<{ teks: string; bobot: number }>,
  pakaiTrigram: boolean,
): Prisma.Sql {
  const bagian = bentuk.map(({ teks }) =>
    pakaiTrigram && teks.length >= MIN_TRIGRAM
      ? Prisma.sql`(a.alias_normal LIKE ${`%${teks}%`} OR a.alias_normal % ${teks})`
      : Prisma.sql`a.alias_normal LIKE ${`%${teks}%`}`,
  );
  return Prisma.join(bagian, " OR ");
}

/**
 * Saran "jenis tempat": kampus mana pun, sekolah mana pun, di wilayah tertentu.
 *
 * KENAPA ADA. Sebagian pencari tidak punya tempat tertentu di kepalanya — yang
 * ia punya adalah KAWASAN. Orang yang mencari ruko untuk percetakan tahu
 * usahanya hidup di dekat kampus, kampus mana pun; yang membuka warung makan
 * memikirkan sekolah, sekolah mana pun. Memaksa mereka menyebut satu nama
 * berarti meminta pengetahuan yang justru sedang mereka cari.
 *
 * Wilayahnya ikut karena tanpa itu jawabannya tidak berguna: "dekat sekolah"
 * se-Indonesia praktis berarti seluruh isi database. "dekat sekolah di Banten"
 * adalah pertanyaan yang bisa dijawab.
 */
interface HasilKelas {
  saran: SaranTempat[];
  /** Bentuk ternormalisasi bagian NAMA saja (tanpa "di …"), bila jenis cocok. */
  kueriNama: string | null;
  /** Wilayah yang terbukti ada isinya — dipakai menyaring saran nama juga. */
  wilayahSah: string | null;
}

/**
 * Radius bawaan sebuah jenis tempat.
 *
 * Dibatasi radius yang benar-benar dipakai saat mengisi indeks: sekolah hanya
 * dicatat sampai 2,5 km (lihat RADIUS_INDEKS), jadi menawarkan bawaan 5 km
 * untuk "semua sekolah" berarti menjanjikan cakupan yang barisnya memang tidak
 * pernah ada — tombol 5 km dan 10 km akan memberi hasil yang persis sama, dan
 * itu terbaca sebagai kerusakan.
 */
function radiusKelas(kelas: KelasTempat): number {
  const dasar = RADIUS_JANGKAUAN[KELAS_TEMPAT[kelas].jangkauan];
  const batas = RADIUS_INDEKS[kelas];
  return batas ? Math.min(dasar, batas) : dasar;
}

async function cariKelas(inti: string, opsi: OpsiCari): Promise<HasilKelas> {
  const kosong: HasilKelas = { saran: [], kueriNama: null, wilayahSah: null };

  const { nama, wilayah } = pisahWilayah(inti);
  const kelas = kelasDariKata(normalNama(nama));
  if (!kelas) return kosong;

  const konfig = KELAS_TEMPAT[kelas];
  const labelKecil = konfig.label.toLowerCase();

  /**
   * Wilayah yang ditawarkan, urut dari yang paling sempit.
   *
   * Kalau user menyebut wilayahnya sendiri, hanya itu yang ditawarkan —
   * menambahkan versi se-Indonesia di bawahnya cuma godaan untuk salah klik.
   * Kalau tidak, kota yang sedang dilihat ditawarkan lebih dulu (itu yang
   * hampir selalu dimaksud), dengan versi tanpa batas wilayah sebagai
   * cadangan yang jujur.
   */
  const kandidat: Array<string | null> = wilayah
    ? [normalKota(wilayah)]
    : opsi.kota
      ? [normalKota(opsi.kota), null]
      : [null];

  const hitung = async (w: string | null): Promise<number> => {
    const [baris] = await prisma.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM tempat
      WHERE kelas = ${kelas}
        AND (
          ${w}::text IS NULL
          OR lower(kota)     LIKE '%' || ${w}::text || '%'
          OR lower(provinsi) LIKE '%' || ${w}::text || '%'
        )
    `;
    return Number(baris?.n ?? 0);
  };

  const buat = (
    w: string | null,
    jumlah: number,
    gantiWilayah = false,
    diminta?: string,
  ): SaranTempat => {
    const namaWilayah = w ? rapiNama(w) : null;
    return {
      nilai: `kelas:${kelas}${w ? `@${w.replace(/\s+/g, "-")}` : ""}`,
      nama: namaWilayah
        ? `Semua ${labelKecil} di ${namaWilayah}`
        : `Semua ${labelKecil}`,
      kelas,
      label: konfig.label,
      icon: konfig.icon,
      warna: konfig.warna,
      kota: namaWilayah,
      jumlah,
      satuan: labelKecil,
      cabang: jumlah,
      kelasSemua: true,
      gantiWilayah,
      wilayahDiminta: diminta,
      radius: radiusKelas(kelas),
      // Selalu di puncak: yang mengetik persis sebuah kata jenis memang sedang
      // meminta jenisnya, bukan tempat yang kebetulan bernama mirip.
      skor: 1.1,
    };
  };

  const saran: SaranTempat[] = [];
  let wilayahSah: string | null = null;

  for (const w of kandidat) {
    const jumlah = await hitung(w);
    if (jumlah === 0) continue;
    saran.push(buat(w, jumlah));
    if (w && !wilayahSah) wilayahSah = w;
  }

  /**
   * Wilayah yang diminta ternyata kosong di kamus ("sekolah di Banten" padahal
   * belum ada aset di sana). Ditawarkan versi tanpa batas wilayah sebagai
   * ALTERNATIF BERLABEL — bukan pengganti diam-diam.
   *
   * Tanpa ini, layarnya cuma berkata "tidak ada tempat bernama 'sekolah di
   * banten'", yang salah dua kali: itu bukan nama tempat, dan sekolahnya
   * banyak — yang belum ada justru asetnya di Banten.
   */
  if (wilayah && saran.length === 0) {
    const semua = await hitung(null);
    if (semua > 0) {
      saran.push(buat(null, semua, true, rapiNama(normalKota(wilayah))));
    }
  }

  return { saran, kueriNama: normalNama(nama), wilayahSah };
}

export async function cariTempat(
  kueri: string,
  opsi: OpsiCari = {},
): Promise<SaranTempat[]> {
  const { inti, intiNormal } = bacaKueriDekat(kueri);
  if (intiNormal.length < 2) return [];

  const batas = Math.min(Math.max(opsi.batas ?? 8, 1), 20);
  const kotaNormal = opsi.kota ? normalKota(opsi.kota) : null;

  const kelas = await cariKelas(inti, opsi);

  /**
   * Kueri untuk pencarian NAMA, setelah bagian wilayah dilepas.
   *
   * Ini memperbaiki kebocoran yang halus: "universitas di surabaya" yang
   * dicari apa adanya menjadi "univ surabaya", dan trigram-nya lalu
   * mencocokkan apa saja yang mengandung "surabaya" — Pakuwon Mall, SMA Negeri
   * 13 Surabaya. Daftar sarannya jadi campuran yang tidak menjawab
   * pertanyaannya. Dengan wilayahnya dilepas, yang dicari tinggal
   * "universitas", dan wilayahnya berpindah tugas jadi PENYARING di bawah.
   */
  const kueriNama =
    kelas.saran.length && kelas.kueriNama ? kelas.kueriNama : intiNormal;
  const wilayahSaring = kelas.wilayahSah;

  const bentuk = bentukKueri(kueriNama);
  const pakaiTrigram = kueriNama.length >= MIN_TRIGRAM;
  const skor = ekspresiSkor(bentuk, pakaiTrigram);
  const saring = ekspresiSaring(bentuk, pakaiTrigram);

  try {
    const baris = await prisma.$queryRaw<BarisSaran[]>`
      SELECT
        t.id, t.slug, t.nama, t.nama_normal, t.kelas, t.jangkauan, t.kota,
        t.brand_normal, t.jumlah_listing,
        max(
          ${skor}
          -- Alias buatan mesin tidak boleh mengalahkan alias buatan manusia.
          - CASE WHEN a.sumber = 'AKRONIM' THEN 0.15 ELSE 0 END
          -- Kota yang sedang dilihat dinaikkan, TIDAK disaring: orang Surabaya
          -- yang mengetik "unair" memang memaksudkan yang di Surabaya, tapi
          -- orang yang mengetik "ugm" sambil melihat Surabaya tetap berhak
          -- menemukan Yogyakarta.
          + CASE WHEN ${kotaNormal}::text IS NOT NULL
                  AND lower(t.kota) LIKE '%' || ${kotaNormal}::text || '%'
                 THEN 0.10 ELSE 0 END
        )::float8 AS skor
      FROM tempat_alias a
      JOIN tempat t ON t.id = a.id_tempat
      WHERE (${saring})
        -- Wilayah yang disebut user MENYARING, bukan sekadar menaikkan: yang
        -- menulis "di Surabaya" tidak sedang menyatakan preferensi, ia sedang
        -- membatasi. Hanya berlaku saat wilayahnya sudah terbukti ada isinya.
        AND (
          ${wilayahSaring}::text IS NULL
          OR lower(t.kota)     LIKE '%' || ${wilayahSaring}::text || '%'
          OR lower(t.provinsi) LIKE '%' || ${wilayahSaring}::text || '%'
        )
      GROUP BY t.id
      HAVING max(${skor}) >= ${AMBANG_MIRIP}
      ORDER BY skor DESC, t.jumlah_listing DESC, length(t.nama_normal) ASC
      LIMIT ${batas * 4}
    `;

    // Saran jenis selalu di atas saran nama: yang mengetik "sekolah" meminta
    // kategori, dan menyodorkan "SDN Babatan V" lebih dulu berarti menjawab
    // pertanyaan yang lebih sempit daripada yang diajukan.
    //
    // Grup keluarga dimatikan bila jenisnya sudah ditawarkan: "Semua sekolah"
    // (kelas=SEKOLAH) dan "Sekolah · 3 cabang" (nama diawali "Sekolah")
    // terlihat seperti dua baris yang sama bagi pembaca, padahal artinya
    // berbeda — dan yang berdasarkan kelas selalu lebih tepat.
    const nama = rakitSaran(baris, kueriNama, batas, kelas.saran.length > 0);
    return [...kelas.saran, ...nama].slice(0, batas);
  } catch (e) {
    // Tabel belum dimigrasikan → pencarian tempat mati, sisa situs jalan
    // seperti biasa. Kotak pencarian tetap menerima kata kunci alamat.
    lapor("cari", e);
    return [];
  }
}

/**
 * Panjang minimum sebuah nama boleh dipakai mengumpulkan "keluarga".
 *
 * Tiga huruf terlalu mudah jadi awalan tempat yang tidak berhubungan. Empat
 * sudah cukup jarang untuk aman, dan kebetulan pas untuk kasus nyata yang
 * paling sering ("SPBU", "KFC "…).
 */
const MIN_KELUARGA = 4;

/** True bila `nama` adalah `induk` itu sendiri, atau `induk` + lanjutannya. */
function seKeluarga(nama: string, induk: string): boolean {
  return nama === induk || nama.startsWith(induk + " ");
}

/** "excelso" → "Excelso". Cadangan saat tak ada baris bernama persis itu. */
function rapiNama(teks: string): string {
  return teks.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Gabungkan tempat yang sebenarnya satu hal jadi satu saran.
 *
 * DUA CARA menggabungkan, karena ada dua cara sebuah tempat terpecah:
 *
 *  1. KELUARGA NAMA — nama yang satu adalah awalan nama yang lain.
 *     "Excelso" (Surabaya) dan "Excelso - SDA Hotel Neo" (Sidoarjo) adalah
 *     gerai yang sama-sama Excelso; kamus memisahkannya karena namanya memang
 *     ditulis berbeda oleh dua orang yang berbeda. Tanpa penggabungan ini,
 *     memilih "Excelso" berarti diam-diam membuang gerai yang lain — persis
 *     yang dikeluhkan: "kan Excelso - SDA Hotel juga termasuk Excelso".
 *
 *  2. BRAND — nama jaringan yang sudah dikenali (`brand_normal`). Menangkap
 *     yang tidak punya baris "telanjang": delapan "Mie Gacoan Rungkut",
 *     "Mie Gacoan Manukan", … tanpa satu pun baris bernama "Mie Gacoan" saja.
 *
 * Keduanya menghasilkan saran GRUP di paling atas, dan anggotanya TETAP
 * ditampilkan di bawahnya bila kotanya berbeda — "Excelso Surabaya" dan
 * "Excelso Sidoarjo" adalah dua jawaban yang benar-benar berbeda bagi orang
 * yang sedang mencari di salah satu kota itu.
 */
function rakitSaran(
  baris: BarisSaran[],
  kueri: string,
  batas: number,
  /** Jenis tempat sudah ditawarkan di atas → grup keluarga jadi mubazir. */
  adaSaranKelas = false,
): SaranTempat[] {
  const hasil: SaranTempat[] = [];

  // ── 1. Keluarga nama, dikumpulkan dari KUERI ─────────────────────────────
  // Dipakai kueri, bukan nama baris terpendek, karena kuerilah yang menyatakan
  // maksud pencarinya. Yang mengetik "excelso" meminta semua Excelso; yang
  // mengetik "excelso sda" meminta yang itu saja — dan aturan ini memberi
  // keduanya apa yang diminta tanpa perlu menebak.
  const keluarga =
    !adaSaranKelas && kueri.length >= MIN_KELUARGA
      ? baris.filter((b) => seKeluarga(b.nama_normal, kueri))
      : [];

  const idKeluarga = new Set(keluarga.map((k) => String(k.id)));

  if (keluarga.length >= 2) {
    const induk = keluarga.find((k) => k.nama_normal === kueri) ?? keluarga[0];
    const kotaUnik = new Set(keluarga.map((k) => normalKota(k.kota)).filter(Boolean));
    hasil.push({
      ...keSaran(induk, `cocok:${kueri.replace(/\s+/g, "-")}`),
      nama: induk.nama_normal === kueri ? induk.nama : rapiNama(kueri),
      kota: kotaUnik.size === 1 ? induk.kota : null,
      jumlah: keluarga.reduce((s, k) => s + Number(k.jumlah_listing || 0), 0),
      cabang: keluarga.length,
    });
  }

  // ── 2. Brand ─────────────────────────────────────────────────────────────
  const perBrand = new Map<string, BarisSaran[]>();
  const tunggal: BarisSaran[] = [];

  for (const b of baris) {
    if (b.brand_normal) {
      const g = perBrand.get(b.brand_normal) ?? [];
      g.push(b);
      perBrand.set(b.brand_normal, g);
    } else {
      tunggal.push(b);
    }
  }

  for (const [brand, anggota] of perBrand) {
    // Seluruh anggotanya sudah terwakili grup keluarga di atas → grup brand
    // hanya akan jadi baris kedua yang isinya sama persis.
    if (anggota.every((a) => idKeluarga.has(String(a.id))) && keluarga.length >= 2) {
      for (const a of anggota) hasil.push(keSaran(a, a.slug));
      continue;
    }
    const kotaUnik = new Set(anggota.map((a) => normalKota(a.kota)).filter(Boolean));
    const jumlah = anggota.reduce((s, a) => s + Number(a.jumlah_listing || 0), 0);
    const teratas = anggota[0];

    // Satu cabang saja: tidak ada yang perlu digabung.
    if (anggota.length === 1) {
      hasil.push(keSaran(teratas, teratas.slug));
      continue;
    }

    hasil.push({
      ...keSaran(teratas, `brand:${brand.replace(/\s+/g, "-")}`),
      // Nama brand, bukan nama gerai teratas — "Mie Gacoan", bukan
      // "Mie Gacoan Rungkut" yang kebetulan menang skor.
      nama: namaBrand(anggota, brand),
      kota: kotaUnik.size === 1 ? teratas.kota : null,
      jumlah,
      cabang: anggota.length,
    });

    // Per-kota hanya bila jaringannya tersebar di lebih dari satu kota.
    if (kotaUnik.size > 1) {
      for (const a of anggota.slice(0, 3)) hasil.push(keSaran(a, a.slug));
    }
  }

  for (const b of tunggal) hasil.push(keSaran(b, b.slug));

  // Skor sudah tercermin di urutan `baris`; grup brand disisipkan mengikuti
  // anggota teratasnya, jadi urutan asli dipertahankan lewat indeks.
  const urutanAsli = new Map(baris.map((b, i) => [b.slug, i]));
  hasil.sort((a, b) => {
    const ia = urutanAsli.get(a.nilai) ?? -1;
    const ib = urutanAsli.get(b.nilai) ?? -1;
    if (a.cabang && !b.cabang) return -1;
    if (b.cabang && !a.cabang) return 1;
    if (ia !== ib) return (ia < 0 ? 1e6 : ia) - (ib < 0 ? 1e6 : ib);
    return b.jumlah - a.jumlah;
  });

  return hasil.slice(0, batas);
}

function namaBrand(anggota: BarisSaran[], brand: string): string {
  // Nama terpendek di antara cabang biasanya justru nama jaringannya sendiri
  // ("Mie Gacoan" vs "Mie Gacoan Rungkut Madya").
  const terpendek = anggota
    .map((a) => a.nama)
    .sort((x, y) => x.length - y.length)[0];
  return normalNama(terpendek).length <= brand.length + 2 ? terpendek : rapiNama(brand);
}

function keSaran(b: BarisSaran, nilai: string): SaranTempat {
  const skor = Number(b.skor ?? 0);
  const kelas: KelasTempat = adalahKelas(b.kelas) ? b.kelas : "LAINNYA";
  const konfig = KELAS_TEMPAT[kelas];
  return {
    nilai,
    nama: b.nama,
    kelas,
    label: konfig.label,
    icon: konfig.icon,
    warna: konfig.warna,
    kota: b.kota,
    jumlah: Number(b.jumlah_listing || 0),
    radius: RADIUS_JANGKAUAN[(b.jangkauan as Jangkauan) ?? konfig.jangkauan] ??
      RADIUS_JANGKAUAN[konfig.jangkauan],
    skor,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PENEMUAN — apa yang ditawarkan sebelum orang mengetik apa pun
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Urutan jenis yang ditawarkan lebih dulu.
 *
 * Bukan diurut jumlah. Yang paling banyak isinya di kamus adalah sekolah dan
 * tempat ibadah — keduanya ada di mana-mana justru karena ada di mana-mana,
 * dan karenanya paling lemah sebagai alasan memilih properti. Yang menggerakkan
 * keputusan adalah kampus (kos), rumah sakit (keluarga), mall & pasar
 * (dagang), stasiun & terminal (komuter). Daftar ini urutan kegunaan, dan
 * kegunaan tidak bisa dihitung dari jumlah baris.
 */
const KELAS_UNGGULAN: KelasTempat[] = [
  "KAMPUS",
  "RUMAH_SAKIT",
  "MALL",
  "SEKOLAH",
  "PASAR",
  "STASIUN",
  "TERMINAL",
  "KULINER",
  "MINIMARKET",
];

const MAKS_PINTASAN_KELAS = 4;
const MAKS_TEMPAT_POPULER = 4;

/**
 * Isi panel saran SEBELUM ada yang diketik.
 *
 * KENAPA ADA. Pencarian berbasis tempat tidak berguna kalau tidak ada yang tahu
 * ia ada — dan kotak pencarian yang kosong tidak memberi petunjuk apa pun
 * bahwa "deket kampus" akan berhasil. Menyentuh kolomnya sekarang langsung
 * memperlihatkan apa yang mungkin, lengkap dengan jumlahnya, jadi kemampuan
 * ini ditemukan lewat memakai — bukan lewat membaca panduan yang tidak ada.
 *
 * Isinya SELALU nyata: pintasan jenis hanya muncul untuk kelas yang memang ada
 * isinya, dan tempat populer diurut dari yang asetnya paling banyak. Tidak ada
 * saran yang berujung halaman kosong.
 */
export async function tempatPopuler(opsi: OpsiCari = {}): Promise<SaranTempat[]> {
  const kotaNormal = opsi.kota ? normalKota(opsi.kota) : null;

  try {
    const [perKelas, teratas] = await Promise.all([
      prisma.$queryRaw<Array<{ kelas: string; n: number }>>`
        SELECT kelas, count(*)::int AS n FROM tempat
        WHERE ${kotaNormal}::text IS NULL
           OR lower(kota)     LIKE '%' || ${kotaNormal}::text || '%'
           OR lower(provinsi) LIKE '%' || ${kotaNormal}::text || '%'
        GROUP BY kelas
      `,
      prisma.$queryRaw<BarisSaran[]>`
        SELECT id, slug, nama, nama_normal, kelas, jangkauan, kota,
               brand_normal, jumlah_listing, 1::float8 AS skor
        FROM tempat
        WHERE jumlah_listing > 0
          AND (
            ${kotaNormal}::text IS NULL
            OR lower(kota)     LIKE '%' || ${kotaNormal}::text || '%'
            OR lower(provinsi) LIKE '%' || ${kotaNormal}::text || '%'
          )
        ORDER BY jumlah_listing DESC, length(nama_normal) ASC
        LIMIT ${MAKS_TEMPAT_POPULER}
      `,
    ]);

    const jumlahKelas = new Map(perKelas.map((r) => [r.kelas, Number(r.n)]));
    const namaWilayah = kotaNormal ? rapiNama(kotaNormal) : null;

    const hasil: SaranTempat[] = [];
    for (const kelas of KELAS_UNGGULAN) {
      const n = jumlahKelas.get(kelas) ?? 0;
      if (n === 0) continue;
      const konfig = KELAS_TEMPAT[kelas];
      const labelKecil = konfig.label.toLowerCase();
      hasil.push({
        nilai: `kelas:${kelas}${kotaNormal ? `@${kotaNormal.replace(/\s+/g, "-")}` : ""}`,
        nama: namaWilayah
          ? `Semua ${labelKecil} di ${namaWilayah}`
          : `Semua ${labelKecil}`,
        kelas,
        label: konfig.label,
        icon: konfig.icon,
        warna: konfig.warna,
        kota: namaWilayah,
        jumlah: n,
        satuan: labelKecil,
        cabang: n,
        kelasSemua: true,
        radius: radiusKelas(kelas),
        skor: 1,
      });
      if (hasil.length >= MAKS_PINTASAN_KELAS) break;
    }

    for (const b of teratas) hasil.push(keSaran(b, b.slug));
    return hasil;
  } catch (e) {
    lapor("populer", e);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MENERJEMAHKAN PILIHAN JADI HIMPUNAN ASET
// ─────────────────────────────────────────────────────────────────────────────

export interface TempatTerpilih {
  nilai: string;
  nama: string;
  kelas: KelasTempat;
  label: string;
  icon: string;
  warna: string;
  kota: string | null;
  radius: number;
  cabang: number;
  /**
   * id baris `tempat` yang diwakili pilihan ini (>1 untuk grup cabang).
   * KOSONG bila pilihannya berupa kriteria — lihat `kriteria`.
   */
  ids: bigint[];
  /**
   * Pilihan "jenis tempat" ("kampus mana pun di Malang") disimpan sebagai
   * KRITERIA, bukan daftar id.
   *
   * Bukan sekadar gaya: "semua sekolah" di kota besar bisa berarti ribuan baris
   * kamus, dan `id_tempat IN (…ribuan…)` adalah kueri yang lambat, rapuh, dan
   * diam-diam terpotong begitu daftarnya dibatasi. Sebagai kriteria, ia jadi
   * satu JOIN yang dieksekusi database — dan `count` untuk paginasi ikut benar
   * dengan sendirinya.
   */
  kriteria?: { kelas: KelasTempat; wilayah: string | null };
  /** True bila ini pilihan jenis, bukan tempat tertentu. */
  kelasSemua?: boolean;
}

/**
 * Terjemahkan nilai param `dekat` jadi tempat beserta id-idnya.
 *
 * Menerima tiga bentuk:
 *   "unesa-surabaya"    — satu tempat, dikenali dari slug.
 *   "brand:mie-gacoan"  — seluruh gerai satu jaringan (dari `brand_normal`).
 *   "cocok:excelso"     — seluruh tempat yang namanya "excelso" atau diawali
 *                         "excelso ". Inilah yang membuat memilih "Excelso"
 *                         ikut memuat "Excelso - SDA Hotel Neo": keduanya
 *                         memang gerai yang sama, cuma ditulis berbeda oleh
 *                         dua orang yang berbeda.
 *
 * Slug dipakai (bukan id angka) supaya URL hasil pencarian bisa dibaca dan
 * dibagikan: "?dekat=unesa-surabaya" memberi tahu penerimanya apa yang akan
 * dia lihat sebelum halamannya terbuka.
 */
export async function bacaTempatTerpilih(
  nilai: string | null | undefined,
): Promise<TempatTerpilih | null> {
  const v = String(nilai ?? "").trim().toLowerCase();
  if (!v || v.length > 220) return null;

  try {
    // ── Bentuk "jenis tempat": kelas:KAMPUS atau kelas:KAMPUS@malang ────────
    if (v.startsWith("kelas:")) {
      const isi = v.slice(6);
      const [kelasMentah, wilayahMentah] = isi.split("@");
      const kelas = kelasMentah.toUpperCase();
      if (!adalahKelas(kelas)) return null;

      const wilayah = wilayahMentah
        ? normalKota(wilayahMentah.replace(/-/g, " "))
        : null;
      const konfig = KELAS_TEMPAT[kelas];
      const labelKecil = konfig.label.toLowerCase();

      const [baris] = await prisma.$queryRaw<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM tempat
        WHERE kelas = ${kelas}
          AND (
            ${wilayah}::text IS NULL
            OR lower(kota)     LIKE '%' || ${wilayah}::text || '%'
            OR lower(provinsi) LIKE '%' || ${wilayah}::text || '%'
          )
      `;
      const cabang = Number(baris?.n ?? 0);
      // Tidak ada satu pun tempat jenis itu di wilayah itu — kembalikan null
      // supaya halaman berperilaku seolah filternya tidak ada, bukan
      // menampilkan "0 properti" di bawah judul yang menjanjikan sesuatu.
      if (cabang === 0) return null;

      const namaWilayah = wilayah ? rapiNama(wilayah) : null;
      return {
        nilai: v,
        nama: namaWilayah
          ? `Semua ${labelKecil} di ${namaWilayah}`
          : `Semua ${labelKecil}`,
        kelas,
        label: konfig.label,
        icon: konfig.icon,
        warna: konfig.warna,
        kota: namaWilayah,
        radius: RADIUS_JANGKAUAN[konfig.jangkauan],
        cabang,
        ids: [],
        kriteria: { kelas, wilayah },
        kelasSemua: true,
      };
    }

    const brand = v.startsWith("brand:") ? v.slice(6).replace(/-/g, " ") : null;
    const induk = v.startsWith("cocok:")
      ? normalNama(v.slice(6).replace(/-/g, " "))
      : null;

    // Nama induk yang terlalu pendek tidak boleh mengumpulkan apa pun — lihat
    // MIN_KELUARGA. Tanpa penjagaan ini, "?dekat=cocok:sd" yang diketik tangan
    // akan menyapu setiap tempat yang namanya kebetulan dimulai "sd".
    if (induk !== null && induk.length < MIN_KELUARGA) return null;

    const baris = induk
      ? await prisma.$queryRaw<BarisSaran[]>`
          SELECT id, slug, nama, nama_normal, kelas, jangkauan, kota,
                 brand_normal, jumlah_listing, 1::float8 AS skor
          FROM tempat
          WHERE nama_normal = ${induk} OR nama_normal LIKE ${induk + " %"}
          -- Nama terpendek dulu: ia yang paling mungkin baris "telanjang"
          -- ("Excelso"), dan itulah nama yang pantas tampil di chip.
          ORDER BY length(nama_normal) ASC, jumlah_listing DESC
          LIMIT 200
        `
      : brand
      ? await prisma.$queryRaw<BarisSaran[]>`
          SELECT id, slug, nama, nama_normal, kelas, jangkauan, kota,
                 brand_normal, jumlah_listing, 1::float8 AS skor
          FROM tempat WHERE brand_normal = ${brand}
          ORDER BY jumlah_listing DESC LIMIT 200
        `
      : await prisma.$queryRaw<BarisSaran[]>`
          SELECT id, slug, nama, nama_normal, kelas, jangkauan, kota,
                 brand_normal, jumlah_listing, 1::float8 AS skor
          FROM tempat WHERE slug = ${v} LIMIT 1
        `;

    if (!baris.length) return null;

    const utama = baris[0];
    const kelas: KelasTempat = adalahKelas(utama.kelas) ? utama.kelas : "LAINNYA";
    const konfig = KELAS_TEMPAT[kelas];

    // Nama tampil untuk grup keluarga: baris "telanjang" bila ada
    // ("Excelso"), kalau tidak nama induk yang diketik dirapikan.
    const namaKeluarga = induk
      ? baris.find((b) => b.nama_normal === induk)?.nama ?? rapiNama(induk)
      : null;

    return {
      nilai: v,
      nama: namaKeluarga ?? (brand ? namaBrand(baris, brand) : utama.nama),
      kelas,
      label: konfig.label,
      icon: konfig.icon,
      warna: konfig.warna,
      // Grup lintas-kota tidak punya satu kota — menyebut salah satunya
      // berarti berbohong tentang cakupan hasilnya.
      kota:
        induk || brand
          ? new Set(baris.map((b) => normalKota(b.kota)).filter(Boolean)).size === 1
            ? utama.kota
            : null
          : utama.kota,
      radius:
        RADIUS_JANGKAUAN[(utama.jangkauan as Jangkauan) ?? konfig.jangkauan] ??
        RADIUS_JANGKAUAN[konfig.jangkauan],
      cabang: baris.length,
      ids: baris.map((b) => b.id),
    };
  } catch (e) {
    lapor("baca-terpilih", e);
    return null;
  }
}

/**
 * Cari sendiri tempat yang paling mungkin dimaksud, dari teks bebas.
 *
 * INI YANG MENYELAMATKAN ORANG YANG TIDAK MENGKLIK SARAN. Mereka mengetik
 * "deket unesa" lalu menekan Enter — dan tanpa jalur ini, halaman hasil
 * mencari string "deket unesa" di dalam kolom alamat, tidak menemukan apa pun,
 * lalu berkata "0 properti". Kegagalan yang tampak seperti "tidak ada
 * asetnya", padahal ada puluhan.
 *
 * Hanya dipakai bila user memang menulis kata "dekat"/"sekitar" ATAU kueri itu
 * cocok sangat kuat ke satu tempat. Tanpa syarat itu, orang yang mencari nama
 * jalan "Gubeng" akan diam-diam dialihkan ke Stasiun Gubeng — mengubah
 * pertanyaannya tanpa memberi tahu.
 */
export interface Tebakan {
  tempat: SaranTempat | null;
  /**
   * Penjelasan untuk keadaan yang kalau didiamkan terlihat seperti kerusakan:
   * user jelas-jelas menyebut jenis + wilayah, jenisnya dikenali, tapi
   * wilayahnya belum punya isi. Tanpa kalimat ini halamannya cuma menjawab
   * "0 properti" — dan pembacanya menyimpulkan situsnya rusak atau daerahnya
   * memang tidak punya sekolah.
   */
  catatan: CatatanTempat | null;
}

export interface AksiCatatan {
  label: string;
  /** Param yang di-set. Yang tidak disebut dibiarkan apa adanya. */
  set?: Record<string, string>;
  /** Param yang dihapus. */
  hapus?: string[];
  /** Tombol menonjol. Hanya satu yang pantas. */
  utama?: boolean;
}

export interface CatatanTempat {
  teks: string;
  /** Jalan keluar — pintu buntu tanpa pintu adalah kerusakan, bukan jawaban. */
  aksi: AksiCatatan[];
}

export async function tebakTempatDariTeks(
  teks: string | null | undefined,
  opsi: OpsiCari = {},
): Promise<Tebakan> {
  const kosong: Tebakan = { tempat: null, catatan: null };
  const { niatDekat, inti, intiNormal } = bacaKueriDekat(teks);

  /**
   * Panjang minimum diukur pada teks SEBELUM normalisasi.
   *
   * Diukur setelahnya, "rumah sakit" menjadi "rs" — dua huruf — lalu ditolak
   * sebagai "terlalu pendek untuk ditebak". Itu bug yang tidak terlihat
   * sebagai bug: pemakainya mengetik sebelas huruf yang sangat jelas
   * maksudnya, dan halaman diam-diam memperlakukannya sebagai kata kunci
   * alamat. Aturan peringkasan ejaan (rumah sakit → rs, universitas → univ)
   * memang membuat bentuk normalnya jauh lebih pendek dari yang diketik.
   *
   * Ambangnya diturunkan bila user menulis "dekat"/"sekitar": kata itu sendiri
   * sudah menyatakan maksud, jadi "deket rs" tidak lagi ambigu.
   */
  const minInti = niatDekat ? 2 : 3;
  if (inti.length < minInti || intiNormal.length < 2) return kosong;

  /**
   * Teks ASLI yang dikirim ulang, bukan `intiNormal`.
   *
   * Normalisasi membuang "di" sebagai kata sambung, jadi "universitas di
   * malang" menjadi "univ malang" — dan wilayahnya lenyap sebelum sempat
   * dibaca. `cariTempat` toh menormalkan sendiri; mengirim bentuk yang sudah
   * dinormalkan hanya membuang informasi yang justru dibutuhkannya.
   */
  const saran = await cariTempat(String(teks ?? ""), { ...opsi, batas: 1 });
  if (!saran.length) return kosong;

  const teratas = saran[0];

  // Saran yang sengaja mengabaikan wilayah yang diminta hanya boleh dipilih
  // MANUSIA, tidak pernah otomatis. Yang menulis "sekolah di Banten" lalu
  // menekan Enter tidak sedang menyetujui "sekolah di seluruh Indonesia" —
  // tapi ia berhak tahu KENAPA hasilnya kosong, dan diberi satu klik untuk
  // melanjutkan.
  if (teratas.gantiWilayah) {
    return {
      tempat: null,
      catatan: await catatanWilayahKosong(teratas),
    };
  }

  if (niatDekat) return { tempat: teratas, catatan: null };

  /**
   * Tanpa kata "dekat", hanya kecocokan yang benar-benar utuh yang boleh
   * mengubah arti pencarian.
   *
   * Diukur dari SKOR, bukan dari kesamaan dengan nama tampilnya. Bedanya nyata:
   * mengetik "unesa" adalah kecocokan sempurna terhadap salah satu nama kampus
   * itu, sementara nama tampilnya "Universitas Negeri Surabaya" — membandingkan
   * ke nama tampil akan menolak justru kecocokan yang paling meyakinkan yang
   * bisa ada.
   */
  return teratas.skor >= AMBANG_UTUH ? { tempat: teratas, catatan: null } : kosong;
}

/**
 * Rakit catatan "wilayah itu belum ada isinya", berikut jalan keluarnya.
 *
 * KENAPA HARUS MEMERIKSA DULU. Tombol "Lihat properti di Banten" harus
 * menyetel param yang BENAR, dan "Banten" adalah PROVINSI — menyetelnya sebagai
 * `kota` menghasilkan nol hasil, yaitu persis kebuntuan yang catatan ini ada
 * untuk memecahkannya. Yang menentukan bukan tebakan dari namanya (banyak
 * wilayah Indonesia bernama sama di dua tingkat), melainkan pertanyaan
 * langsung ke data: kolom mana yang benar-benar berisi nama itu.
 *
 * Kalau tidak ada satu pun aset di wilayah itu pada kolom mana pun, tawaran
 * wilayahnya DIHILANGKAN — tombol yang mendarat di halaman kosong lebih buruk
 * daripada tidak ada tombol.
 */
async function catatanWilayahKosong(
  teratas: SaranTempat,
): Promise<CatatanTempat> {
  const jenis = teratas.label.toLowerCase();
  const wilayah = teratas.wilayahDiminta;
  const aksi: AksiCatatan[] = [];

  if (wilayah) {
    const pola = `%${wilayah.toLowerCase()}%`;
    const [hit] = await prisma.$queryRaw<Array<{ n_kota: number; n_prov: number }>>`
      SELECT
        count(*) FILTER (WHERE lower(kota)     LIKE ${pola})::int AS n_kota,
        count(*) FILTER (WHERE lower(provinsi) LIKE ${pola})::int AS n_prov
      FROM listing
      WHERE status_tayang = 'TERSEDIA' AND bukan_properti = FALSE
        AND (lower(kota) LIKE ${pola} OR lower(provinsi) LIKE ${pola})
    `;

    const nKota = Number(hit?.n_kota ?? 0);
    const nProv = Number(hit?.n_prov ?? 0);
    const tingkat = nKota > 0 ? "kota" : nProv > 0 ? "provinsi" : null;
    const jumlah = Math.max(nKota, nProv);

    if (tingkat) {
      /**
       * Dari dua hal yang diminta — jenis tempat dan wilayah — wilayahlah yang
       * hampir selalu tidak bisa ditawar: orang mencari properti di Sidoarjo
       * karena ia memang mau tinggal atau berdagang di Sidoarjo. Jenis
       * tempatnya preferensi. Jadi tawaran utamanya melepas jenis dan menahan
       * wilayah, bukan sebaliknya.
       */
      aksi.push({
        label: `Lihat ${jumlah.toLocaleString("id-ID")} properti di ${wilayah}`,
        set: { [tingkat]: wilayah },
        hapus: ["dekat", "q", "radius"],
        utama: true,
      });
    }
  }

  aksi.push({
    label: `Semua ${jenis}`,
    set: { dekat: teratas.nilai },
    hapus: ["q", "radius"],
    utama: aksi.length === 0,
  });

  return {
    teks: `Belum ada ${jenis} di ${wilayah ?? "wilayah itu"} yang tercatat di sekitar aset kami.`,
    aksi,
  };
}

/**
 * Skor minimum untuk boleh mengubah arti pencarian tanpa diminta.
 *
 * 0,95 berarti "sama persis dengan salah satu namanya" (1,0) masih lolos walau
 * terkena potongan kecil, sementara sekadar awalan (0,80) tidak. Orang yang
 * mengetik "gubeng" sedang mencari sesuatu; menyeretnya ke Stasiun Gubeng
 * tanpa dia memilihnya berarti menjawab pertanyaan yang tidak dia ajukan.
 */
const AMBANG_UTUH = 0.95;

const sudahDilapor = new Set<string>();
function lapor(kunci: string, e: unknown) {
  if (sudahDilapor.has(kunci)) return;
  sudahDilapor.add(kunci);
  console.warn(
    `[kamus-tempat] pencarian ${kunci} gagal — jalankan ` +
      `prisma/migration_tempat_landmark.sql lalu restart proses ini.`,
    e,
  );
}

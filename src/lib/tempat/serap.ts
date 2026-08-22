import "server-only";

/**
 * Penyerap kamus tempat — satu-satunya penulis tabel `tempat`, `tempat_alias`,
 * dan `listing_tempat`.
 *
 * Dipanggil dari dua tempat, dan keduanya adalah kejadian yang MEMANG SUDAH
 * TERJADI, bukan pekerjaan tambahan yang dibuat-buat:
 *
 *   1. Selesai memindai sekitar sebuah aset (nearbyPlaces.server.ts). Di titik
 *      itu, dan hanya di titik itu, kita memegang daftar "aset ini dekat apa
 *      saja" lengkap dengan jaraknya yang sudah terukur.
 *   2. Agent menyimpan patokan di form tambah/edit properti. Itu pengetahuan
 *      manusia yang tidak dimiliki peta mana pun ("5 menit ke UNESA" dari
 *      orang yang benar-benar pernah menempuhnya).
 *
 * TIDAK PERNAH DITUNGGU PEMANGGILNYA. Yang memicu pemindaian adalah pengunjung
 * yang sedang menunggu halaman detail terbuka; ia tidak punya urusan dengan
 * indeks pencarian orang lain, dan tidak boleh menunggu lebih lama karenanya.
 * Karena itu seluruh fungsi di sini menelan kesalahannya sendiri: kamus yang
 * gagal terisi hari ini akan terisi pada pemindaian berikutnya, dan itu jauh
 * lebih baik daripada halaman detail yang gagal karena indeks pencarian.
 */

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { KategoriPOI, TempatTerdekat } from "@/lib/nearbyPlaces";
import type { TempatLandmark } from "@/lib/tempat/landmark";
import {
  adaAliasKuratif,
  aliasKuratif,
  bentangkanAwalan,
  brandDari,
  kanonikDari,
  namaKanonik,
} from "./alias-kuratif";
import {
  KELAS_TEMPAT,
  akronimDari,
  jangkauanKelas,
  jarakPatokanKeMeter,
  kelasTerbaik,
  kunciTempat,
  normalNama,
  slugTempat,
  tanpaKataJenis,
  tebakKelasDariNama,
  type KelasTempat,
} from "./normalisasi";

// ─────────────────────────────────────────────────────────────────────────────
// BENTUK MASUKAN
// ─────────────────────────────────────────────────────────────────────────────

/** Presisi yang BOLEH masuk indeks — lihat catatan `presisi` di skema. */
const PRESISI_SAH = new Set(["TITIK", "ALAMAT", "KELURAHAN", "KECAMATAN", "PATOKAN"]);

export interface WilayahAset {
  kota?: string | null;
  provinsi?: string | null;
}

interface CalonTempat {
  nama: string;
  kelas: KelasTempat;
  lat: number | null;
  lon: number | null;
  jarak: number;
  /** Alias mentah dari sumbernya (tag OSM). */
  aliasSumber: string[];
  sumber: "PINDAI" | "PATOKAN";
  presisi: string;
}

/**
 * Kategori pindaian 800 m → kelas kamus.
 *
 * Pemetaannya kasar di beberapa tempat karena pindaian itu memang tidak
 * membedakan rumah sakit dari apotek (keduanya "health"). Itu tidak apa-apa:
 * sapuan landmark 5 km MEMBEDAKANNYA, dan `kelasTerbaik` memastikan yang lebih
 * spesifik yang bertahan saat keduanya bertemu di baris kamus yang sama.
 */
const KELAS_DARI_KATEGORI: Record<KategoriPOI, KelasTempat> = {
  food: "KULINER",
  mart: "MINIMARKET",
  health: "KLINIK",
  education: "SEKOLAH",
  worship: "IBADAH",
  transport: "HALTE",
  mall: "MALL",
  gym: "GYM",
  hotel: "HOTEL",
  laundry: "LAUNDRY",
};

/**
 * Nama cadangan yang dipakai pemindai saat OSM tidak menyimpan `name`.
 *
 * Di halaman detail, "Tempat makan" jauh lebih baik daripada "?". Di kamus
 * PENCARIAN ia racun: satu baris bernama "Tempat makan" akan mengumpulkan
 * ratusan aset dari seluruh Indonesia di bawah satu nama yang tidak menunjuk
 * apa pun, lalu muncul di autocomplete sebagai saran terpopuler justru karena
 * banyaknya. Ditolak di pintu.
 */
const NAMA_CADANGAN = new Set([
  "tempat makan", "minimarket", "apotek klinik", "sekolah kampus",
  "tempat ibadah", "halte st", "pusat perbelanjaan", "gym", "penginapan",
  "laundry", "apotek", "sekolah", "kampus", "halte", "stasiun", "hotel",
  "mall", "pasar", "rs", "klinik",
]);

/** True bila namanya terlalu umum untuk pernah berguna sebagai patokan. */
function namaTakLayak(nama: string): boolean {
  const n = normalNama(nama);
  return n.length < 3 || NAMA_CADANGAN.has(n) || /^\d+$/.test(n);
}

// ─────────────────────────────────────────────────────────────────────────────
// PINTU MASUK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serap hasil satu pemindaian ke kamus.
 *
 * `landmark` (sapuan 5 km) dan `tempat` (daftar 800 m) diperlakukan berbeda
 * hanya pada kelasnya; keduanya sama-sama layak masuk kamus. Yang 800 m justru
 * yang menjawab permintaan "cari dekat tempat makan tertentu" — Mie Gacoan
 * memang tidak akan pernah muncul di sapuan landmark, dan seharusnya begitu:
 * yang dicari orang saat menyebut warung adalah jarak jalan kaki.
 */
export async function serapKamusDariPindaian(
  idProperty: bigint,
  titik: { lat: number; lng: number; presisi?: string } | null,
  landmark: TempatLandmark[],
  tempat: TempatTerdekat[],
  wilayah?: WilayahAset,
): Promise<void> {
  try {
    const presisi = titik?.presisi;
    // Titik yang cuma tahu "Kota Surabaya" tidak berhak mengklaim jarak ke
    // apa pun. Ia tetap ketemu lewat filter kota — sebatas itu yang memang
    // diketahui tentangnya.
    if (!presisi || !PRESISI_SAH.has(presisi)) return;

    const wil = wilayah ?? (await bacaWilayah(idProperty));
    if (!wil) return;

    const calon: CalonTempat[] = [];

    for (const l of landmark) {
      if (namaTakLayak(l.nama)) continue;
      calon.push({
        nama: l.nama,
        kelas: l.kelas,
        lat: l.lat,
        lon: l.lon,
        jarak: l.jarak,
        aliasSumber: [...(l.alias ?? []), ...(l.brand ? [l.brand] : [])],
        sumber: "PINDAI",
        presisi,
      });
    }

    for (const t of tempat) {
      if (namaTakLayak(t.nama)) continue;
      calon.push({
        nama: t.nama,
        kelas: KELAS_DARI_KATEGORI[t.kategori] ?? "LAINNYA",
        lat: t.lat,
        lon: t.lon,
        jarak: t.jarak,
        aliasSumber: [],
        sumber: "PINDAI",
        presisi,
      });
    }

    await tulisKamus(idProperty, wil, calon, "PINDAI");
  } catch (e) {
    lapor("serap-pindaian", e);
  }
}

/**
 * Serap patokan yang diketik agent (`listing.akses_terdekat`).
 *
 * INI SATU-SATUNYA JALAN MASUK untuk aset yang belum pernah dipindai, dan
 * karena itu ia penting jauh melebihi jumlahnya. Lihat aset di Balas Klumprik:
 * "KAMPUS · UNESA · 4 km" ada di sana sebagai pengetahuan agent berbulan-bulan
 * sebelum pemindai mana pun menemukannya.
 *
 * Titiknya diambil dari tempat yang sudah ada di kamus bila namanya cocok —
 * agent menulis nama, bukan koordinat. Kalau belum ada padanannya, barisnya
 * tetap dibuat tanpa koordinat: ia belum bisa jadi pin di peta, tapi sudah
 * bisa dicari, dan itu yang dimintanya.
 */
export async function serapKamusDariPatokan(
  idProperty: bigint,
  akses: unknown,
  wilayah?: WilayahAset,
): Promise<void> {
  try {
    if (!Array.isArray(akses) || akses.length === 0) return;

    const wil = wilayah ?? (await bacaWilayah(idProperty));
    if (!wil) return;

    const calon: CalonTempat[] = [];
    for (const a of akses) {
      const nama = String((a as any)?.nama ?? "").trim();
      if (!nama || namaTakLayak(nama)) continue;

      const kelas = kelasDariAkses((a as any)?.tipe);
      const jarak = jarakPatokanKeMeter((a as any)?.jarak, (a as any)?.satuan);
      calon.push({
        nama,
        kelas,
        lat: null,
        lon: null,
        // Patokan tanpa angka jarak tetap berharga — yang ia katakan adalah
        // "aset ini DEKAT tempat itu", dan itu inti pertanyaannya. Diberi
        // jarak nominal setingkat jangkauan kelasnya supaya tetap bisa
        // diurutkan, dan ditandai PATOKAN supaya tidak pernah tampil sebagai
        // angka terukur.
        jarak: jarak ?? (jangkauanKelas(kelas) === "LANDMARK" ? 3_000 : 800),
        aliasSumber: [],
        sumber: "PATOKAN",
        presisi: "PATOKAN",
      });
    }

    await tulisKamus(idProperty, wil, calon, "PATOKAN");
  } catch (e) {
    lapor("serap-patokan", e);
  }
}

/** Tipe patokan di form (AksesTipe) → kelas kamus. */
function kelasDariAkses(tipe: unknown): KelasTempat {
  switch (String(tipe ?? "")) {
    case "KAMPUS": return "KAMPUS";
    case "SEKOLAH": return "SEKOLAH";
    case "STASIUN": return "STASIUN";
    case "HALTE": return "HALTE";
    case "BANDARA": return "BANDARA";
    case "MALL": return "MALL";
    case "PASAR": return "PASAR";
    case "RUMAH_SAKIT": return "RUMAH_SAKIT";
    case "PERKANTORAN": return "PERKANTORAN";
    case "MASJID": return "IBADAH";
    case "MINIMARKET": return "MINIMARKET";
    default: return "LAINNYA";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PENULISAN
// ─────────────────────────────────────────────────────────────────────────────

interface BarisSiap {
  kunci: string;
  /**
   * Jenisnya dibaca langsung dari nama ("Bidan Delima" → KLINIK). Menang
   * MUTLAK atas jenis yang tersimpan, tanpa lewat perbandingan bobot.
   *
   * Kalau lewat bobot, sebuah kesalahan sekali tulis jadi permanen: agent
   * salah memilih "Rumah Sakit" untuk Bidan Delima, dan karena RUMAH_SAKIT
   * berbobot lebih tinggi daripada KLINIK, koreksi apa pun sesudahnya akan
   * kalah selamanya. Bobot ada untuk memilih di antara dua TEBAKAN; membaca
   * nama bukan tebakan.
   */
  kelasKuat: boolean;
  slug: string;
  nama: string;
  namaNormal: string;
  kelas: KelasTempat;
  lat: number | null;
  lon: number | null;
  brand: string | null;
  alias: Array<{ alias: string; sumber: string }>;
  jarak: number;
  sumber: string;
  presisi: string;
}

/**
 * Rakit calon menjadi baris kamus: kanonikalisasi nama, kumpulkan alias,
 * gabungkan kembaran dalam satu pemindaian.
 */
function rakit(calon: CalonTempat[], wil: WilayahAset): BarisSiap[] {
  const peta = new Map<string, BarisSiap>();

  for (const c of calon) {
    // Nama kanonik lebih dulu: "UNESA" dan "Universitas Negeri Surabaya" harus
    // mendarat di kunci yang sama SEBELUM sempat jadi dua baris.
    const tampil = namaKanonik(c.nama) ?? bentangkanAwalan(c.nama) ?? c.nama;

    /**
     * NAMANYA IKUT MENENTUKAN JENISNYA.
     *
     * Jenis yang datang dari sumber selalu kasar: agent memilih dari dropdown
     * 12 pilihan, dan pemindai tidak membedakan rumah sakit dari apotek.
     * Akibatnya terukur — "Universitas Sunan Giri" tercatat SEKOLAH,
     * "Terminal Purabaya" tercatat HALTE, dan enam belas restoran tercatat
     * LAINNYA karena itulah pilihan terakhir yang tersedia. Efeknya baru
     * terasa saat orang mencari per JENIS: "dekat rumah makan" tidak
     * menemukan satu pun rumah makan.
     *
     * Dua aturan, dan bedanya disengaja:
     *   KUAT — nama diawali kata jenisnya ("Universitas …"). Menang atas
     *          sumber, karena membaca nama lebih dapat dipercaya daripada
     *          menebak dari dropdown.
     *   LEMAH — kata petunjuk di tengah nama ("Depot Bu Rudy"). Hanya dipakai
     *          bila sumber memang tidak tahu (LAINNYA), supaya tidak pernah
     *          menimpa jenis yang sudah jelas.
     */
    const tebakan = tebakKelasDariNama(tampil);
    const kelasKuat = Boolean(tebakan?.kuat);
    if (tebakan && (tebakan.kuat || c.kelas === "LAINNYA")) {
      c.kelas = tebakan.kelas;
    }
    const namaNormal = kanonikDari(c.nama) ?? normalNama(tampil);
    if (!namaNormal) continue;

    const kunci = kunciTempat(tampil, wil.kota);

    const alias: Array<{ alias: string; sumber: string }> = [];
    for (const a of aliasKuratif(c.nama)) alias.push({ alias: a, sumber: "KURATIF" });
    for (const a of c.aliasSumber) {
      const n = normalNama(a);
      if (n && n.length >= 3) alias.push({ alias: n, sumber: "OSM" });
    }
    // Nama yang dipakai sumbernya sendiri selalu jadi alias — kalau OSM
    // menulis "UNESA" sementara kanoniknya nama panjang, "unesa" harus tetap
    // bisa diketik.
    const asli = normalNama(c.nama);
    if (asli && asli !== namaNormal) {
      alias.push({ alias: asli, sumber: c.sumber === "PATOKAN" ? "PATOKAN" : "OSM" });
    }

    const potong = tanpaKataJenis(tampil);
    if (potong) alias.push({ alias: potong, sumber: "KURATIF" });

    // Akronim DIMATIKAN bila sudah ada entri kuratif: huruf depan "Universitas
    // Negeri Surabaya" adalah "uns", dan "uns" milik kampus lain. Membiarkan
    // keduanya hidup berarti sengaja menanam tabrakan yang sudah diketahui.
    if (!adaAliasKuratif(c.nama)) {
      const ak = akronimDari(tampil);
      if (ak) alias.push({ alias: ak, sumber: "AKRONIM" });
    }

    const lama = peta.get(kunci);
    if (lama) {
      // Bacaan nama menang; di antara sesama tebakan, yang lebih spesifik.
      if (kelasKuat && !lama.kelasKuat) {
        lama.kelas = c.kelas;
        lama.kelasKuat = true;
      } else if (!kelasKuat || lama.kelasKuat) {
        lama.kelas = kelasTerbaik(lama.kelas, c.kelas);
      }
      lama.jarak = Math.min(lama.jarak, c.jarak);
      lama.lat = lama.lat ?? c.lat;
      lama.lon = lama.lon ?? c.lon;
      lama.alias.push(...alias);
      // Jarak terukur mengalahkan klaim agent; itu satu-satunya urutan yang
      // masuk akal saat keduanya bicara tentang tempat yang sama.
      if (c.sumber === "PINDAI") {
        lama.sumber = "PINDAI";
        lama.presisi = c.presisi;
      }
      continue;
    }

    peta.set(kunci, {
      kunci,
      slug: slugTempat(tampil, wil.kota),
      nama: tampil.slice(0, 200),
      namaNormal: namaNormal.slice(0, 200),
      kelas: c.kelas,
      kelasKuat,
      lat: c.lat,
      lon: c.lon,
      brand: brandDari(tampil),
      alias,
      jarak: c.jarak,
      sumber: c.sumber,
      presisi: c.presisi,
    });
  }

  return [...peta.values()];
}

async function tulisKamus(
  idProperty: bigint,
  wil: WilayahAset,
  calon: CalonTempat[],
  /** Jalur yang sedang menulis — menentukan baris mana yang boleh dibersihkan. */
  sumberPass: "PINDAI" | "PATOKAN",
): Promise<void> {
  const baris = rakit(calon, wil);
  if (baris.length === 0) return;

  const kota = (wil.kota ?? "").slice(0, 120) || null;
  const provinsi = (wil.provinsi ?? "").slice(0, 120) || null;

  // ── 1. Kelas yang sudah tersimpan, supaya yang lebih spesifik tidak
  //       ditimpa yang lebih kasar. Diselesaikan di JS, bukan di SQL: aturan
  //       "yang lebih spesifik menang" hidup di satu tempat (kelasTerbaik),
  //       dan menyalinnya jadi CASE WHEN raksasa adalah cara membuat dua
  //       aturan yang perlahan berbeda.
  const kunciSemua = baris.map((b) => b.kunci);
  const adaSebelumnya = (await prisma.$queryRaw<
    Array<{ kunci: string; kelas: string; slug: string }>
  >`SELECT kunci, kelas, slug FROM tempat WHERE kunci IN (${Prisma.join(kunciSemua)})`) ?? [];

  const kelasLama = new Map(adaSebelumnya.map((r) => [r.kunci, r.kelas]));
  const slugLama = new Map(adaSebelumnya.map((r) => [r.kunci, r.slug]));

  for (const b of baris) {
    const lama = kelasLama.get(b.kunci);
    // Jenis hasil membaca nama tidak pernah dibandingkan bobot — lihat
    // catatan `kelasKuat`.
    if (!b.kelasKuat && lama && lama in KELAS_TEMPAT) {
      b.kelas = kelasTerbaik(b.kelas, lama as KelasTempat);
    }
    // Slug yang sudah pernah dibagikan tidak boleh berubah — tautan hasil
    // pencarian tersebar lewat WhatsApp dan tidak bisa ditarik kembali.
    const slugTersimpan = slugLama.get(b.kunci);
    if (slugTersimpan) b.slug = slugTersimpan;
  }

  await pastikanSlugUnik(baris);

  // ── 2. Upsert tempat, ambil idnya kembali.
  const nilaiTempat = baris.map(
    (b) => Prisma.sql`(
      ${b.kunci}, ${b.slug}, ${b.nama}, ${b.namaNormal}, ${b.kelas},
      ${jangkauanKelas(b.kelas)}, ${b.lat}, ${b.lon}, ${kota}, ${provinsi},
      ${b.brand}, ${b.sumber === "PATOKAN" ? "PATOKAN" : "PINDAI"}
    )`,
  );

  const tersimpan = await prisma.$queryRaw<Array<{ id: bigint; kunci: string }>>`
    INSERT INTO tempat (
      kunci, slug, nama, nama_normal, kelas, jangkauan,
      latitude, longitude, kota, provinsi, brand_normal, sumber
    )
    VALUES ${Prisma.join(nilaiTempat)}
    ON CONFLICT (kunci) DO UPDATE SET
      kelas           = EXCLUDED.kelas,
      jangkauan       = EXCLUDED.jangkauan,
      nama            = EXCLUDED.nama,
      nama_normal     = EXCLUDED.nama_normal,
      -- Koordinat hanya DIISI, tidak pernah ditimpa: baris yang sudah punya
      -- titik dari pemindaian nyata tidak boleh dikosongkan oleh patokan agent
      -- yang memang tidak membawa koordinat.
      latitude        = COALESCE(tempat.latitude, EXCLUDED.latitude),
      longitude       = COALESCE(tempat.longitude, EXCLUDED.longitude),
      brand_normal    = COALESCE(tempat.brand_normal, EXCLUDED.brand_normal),
      disegarkan_pada = now()
    RETURNING id, kunci
  `;

  const idPerKunci = new Map(tersimpan.map((r) => [r.kunci, r.id]));

  // ── 3. Alias. ON CONFLICT DO NOTHING: alias yang sudah ada tidak perlu
  //       ditulis ulang, dan sumbernya yang lebih dulu tercatat justru yang
  //       lebih layak dipercaya.
  const nilaiAlias: Prisma.Sql[] = [];
  for (const b of baris) {
    const id = idPerKunci.get(b.kunci);
    if (!id) continue;
    const unik = new Map<string, string>();
    unik.set(b.namaNormal, "KURATIF");
    for (const a of b.alias) {
      const n = a.alias.slice(0, 200);
      if (n && !unik.has(n)) unik.set(n, a.sumber);
    }
    for (const [alias, sumber] of unik) {
      nilaiAlias.push(Prisma.sql`(${id}, ${alias}, ${alias}, ${sumber})`);
    }
  }
  if (nilaiAlias.length) {
    await prisma.$executeRaw`
      INSERT INTO tempat_alias (id_tempat, alias, alias_normal, sumber)
      VALUES ${Prisma.join(nilaiAlias)}
      ON CONFLICT (id_tempat, alias_normal) DO NOTHING
    `;
  }

  // ── 4. Indeks terbalik.
  const nilaiIndeks = baris
    .map((b) => {
      const id = idPerKunci.get(b.kunci);
      return id
        ? Prisma.sql`(${idProperty}, ${id}, ${Math.max(0, Math.round(b.jarak))}, ${b.sumber}, ${b.presisi})`
        : null;
    })
    .filter(Boolean) as Prisma.Sql[];

  if (nilaiIndeks.length) {
    await prisma.$executeRaw`
      INSERT INTO listing_tempat (id_property, id_tempat, jarak_meter, sumber, presisi)
      VALUES ${Prisma.join(nilaiIndeks)}
      ON CONFLICT (id_property, id_tempat) DO UPDATE SET
        -- Jarak TERUKUR selalu menang atas klaim agent, berapa pun angkanya.
        -- Di antara sesama hasil ukur, yang terkecil yang benar: ia berarti
        -- pemindaian menemukan cabang/pintu yang lebih dekat.
        jarak_meter = CASE
          WHEN listing_tempat.sumber = 'PATOKAN' AND EXCLUDED.sumber = 'PINDAI'
            THEN EXCLUDED.jarak_meter
          WHEN EXCLUDED.sumber = 'PATOKAN' AND listing_tempat.sumber = 'PINDAI'
            THEN listing_tempat.jarak_meter
          ELSE LEAST(listing_tempat.jarak_meter, EXCLUDED.jarak_meter)
        END,
        sumber  = CASE WHEN EXCLUDED.sumber = 'PINDAI' THEN 'PINDAI' ELSE listing_tempat.sumber END,
        presisi = CASE WHEN EXCLUDED.sumber = 'PINDAI' THEN EXCLUDED.presisi ELSE listing_tempat.presisi END
    `;
  }

  /**
   * ── 5. Buang baris indeks LAMA yang tidak lagi dihasilkan pass ini.
   *
   * Tanpa langkah ini indeks hanya bisa bertambah, tidak pernah berkurang, dan
   * dua hal membusuk diam-diam: patokan yang dihapus agent tetap menyeret
   * asetnya ke hasil pencarian selamanya, dan setiap perubahan aturan nama
   * (alias baru, singkatan yang dibentangkan) meninggalkan baris yatim yang
   * masih tampil sebagai tempat yang bisa dipilih.
   *
   * Dibatasi `sumber` yang sama: jalur pindai dan jalur patokan menulis untuk
   * aset yang sama pada waktu yang berbeda, dan yang satu tidak boleh
   * menghapus hasil kerja yang lain.
   */
  const idSentuh = [...idPerKunci.values()];
  if (idSentuh.length) {
    await prisma.$executeRaw`
      DELETE FROM listing_tempat
      WHERE id_property = ${idProperty}
        AND sumber = ${sumberPass}
        AND id_tempat NOT IN (${Prisma.join(idSentuh)})
    `;
  }

  // ── 6. Segarkan penghitung peringkat, hanya untuk tempat yang tersentuh.
  if (idSentuh.length) {
    await prisma.$executeRaw`
      UPDATE tempat t SET jumlah_listing = (
        SELECT count(*) FROM listing_tempat lt
        JOIN listing l ON l.id_property = lt.id_property
        WHERE lt.id_tempat = t.id
          AND l.status_tayang = 'TERSEDIA'
          AND l.bukan_properti = FALSE
      )
      WHERE t.id IN (${Prisma.join(idSentuh)})
    `;
  }
}

/**
 * Pastikan slug tidak bentrok dengan baris lain.
 *
 * Bentrok jarang tapi mungkin: dua tempat berbeda di kota yang sama bisa
 * menghasilkan slug identik setelah tanda bacanya dibuang. Dibiarkan, INSERT-nya
 * gagal karena batasan unik dan SELURUH penyerapan batal — satu tabrakan nama
 * membuang seluruh hasil pemindaian. Suffix angka jauh lebih murah daripada itu.
 */
async function pastikanSlugUnik(baris: BarisSiap[]): Promise<void> {
  const slugSemua = baris.map((b) => b.slug);
  const bentrok = await prisma.$queryRaw<Array<{ slug: string; kunci: string }>>`
    SELECT slug, kunci FROM tempat WHERE slug IN (${Prisma.join(slugSemua)})
  `;
  const pemilik = new Map(bentrok.map((r) => [r.slug, r.kunci]));

  const dipakai = new Set<string>();
  for (const b of baris) {
    let s = b.slug;
    let n = 2;
    while ((pemilik.has(s) && pemilik.get(s) !== b.kunci) || dipakai.has(s)) {
      s = `${b.slug}-${n++}`;
    }
    b.slug = s.slice(0, 200);
    dipakai.add(b.slug);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BANTU
// ─────────────────────────────────────────────────────────────────────────────

async function bacaWilayah(idProperty: bigint): Promise<WilayahAset | null> {
  const l = await prisma.listing.findUnique({
    where: { id_property: idProperty },
    select: { kota: true, provinsi: true },
  });
  return l ? { kota: l.kota, provinsi: l.provinsi } : null;
}

const sudahDilapor = new Set<string>();
function lapor(kunci: string, e: unknown) {
  if (sudahDilapor.has(kunci)) return;
  sudahDilapor.add(kunci);
  console.warn(
    `[kamus-tempat] ${kunci} gagal — jalankan prisma/migration_tempat_landmark.sql ` +
      `lalu \`npx prisma generate\` dan RESTART proses ini.`,
    e,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PERAWATAN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Segarkan seluruh penghitung, lalu buang tempat yang sudah tidak punya aset.
 *
 * Dijalankan sekali di akhir `npm run kamus:tempat`. Yang dibersihkannya nyata:
 * aturan nama berubah ("Unair Kampus A" kini dibentangkan jadi "Universitas
 * Airlangga Kampus A"), dan baris lamanya tetap duduk di kamus sebagai pilihan
 * yang bisa diklik padahal tidak ada aset di baliknya lagi.
 *
 * Baris KURATIF dikecualikan — ia sengaja ditanam, bukan hasil serapan.
 */
export async function bersihkanKamus(): Promise<{ disegarkan: number; dibuang: number }> {
  const disegarkan = await prisma.$executeRaw`
    UPDATE tempat t
    SET jumlah_listing = COALESCE(h.n, 0)
    FROM tempat t2
    LEFT JOIN (
      SELECT lt.id_tempat, count(*)::int AS n
      FROM listing_tempat lt
      JOIN listing l ON l.id_property = lt.id_property
      WHERE l.status_tayang = 'TERSEDIA' AND l.bukan_properti = FALSE
      GROUP BY lt.id_tempat
    ) h ON h.id_tempat = t2.id
    WHERE t2.id = t.id
      AND t.jumlah_listing IS DISTINCT FROM COALESCE(h.n, 0)
  `;

  const dibuang = await prisma.$executeRaw`
    DELETE FROM tempat
    WHERE jumlah_listing = 0 AND sumber <> 'KURATIF'
  `;

  return { disegarkan, dibuang };
}

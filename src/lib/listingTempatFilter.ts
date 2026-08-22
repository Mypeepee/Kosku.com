import "server-only";

/**
 * Filter "dekat X" untuk query Listing — pasangan `listingLocationFilter.ts`
 * yang menjawab pertanyaan berbeda.
 *
 * Filter lokasi menjawab "di wilayah administratif mana". Filter ini menjawab
 * "dekat apa" — dan itu pertanyaan yang benar-benar diajukan orang. Pendatang
 * yang baru diterima di UNESA tidak tahu (dan tidak perlu tahu) bahwa
 * kelurahan di sekitarnya bernama Lidah Wetan, Lidah Kulon, dan Jeruk. Yang ia
 * tahu cuma "UNESA".
 *
 * Keduanya bisa dipakai bersamaan dan saling mempersempit — "dekat Mie Gacoan"
 * + "Kota Surabaya" adalah kombinasi yang wajar dan bekerja apa adanya.
 */

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  bacaTempatTerpilih,
  tebakTempatDariTeks,
  type CatatanTempat,
  type TempatTerpilih,
} from "@/lib/tempat/cari";
import { formatJarak } from "@/lib/nearbyPlaces";
import { normalNama } from "@/lib/tempat/normalisasi";
import type { TempatDipilih } from "@/lib/searchTabs";

export type { TempatTerpilih };

/**
 * Batas atas jumlah aset yang boleh diurut per jarak dalam satu pencarian.
 *
 * Pengurutan terdekat perlu memegang seluruh himpunan hasilnya sekaligus
 * (lihat `urutkanTerdekat`), dan tanpa batas, sebuah brand dengan ribuan gerai
 * bisa menarik puluhan ribu baris ke memori untuk menampilkan 12 kartu. Lima
 * ribu jauh melampaui apa pun yang akan benar-benar dijelajahi manusia —
 * halaman ke-417 tidak pernah dibuka siapa pun.
 */
const MAKS_URUT = 5_000;

/** Radius yang boleh dipilih user, meter. */
export const RADIUS_PILIHAN = [1_000, 3_000, 5_000, 10_000] as const;

/**
 * Baca param `dekat` (+ `radius` opsional) jadi tempat terpilih.
 *
 * `radius` sengaja bisa ditimpa user: bawaannya mengikuti kelas tempat (kampus
 * 5 km, warung 1,2 km) karena itu tebakan terbaik tanpa bertanya, tapi tebakan
 * terbaik tetap tebakan — yang mencari kos memang mau 1 km dari kampus, dan ia
 * berhak mengecilkannya.
 */
export async function bacaTempatDariParams(searchParams: {
  [key: string]: string | string[] | undefined;
}): Promise<TempatTerpilih | null> {
  const mentah = searchParams.dekat;
  const nilai = Array.isArray(mentah) ? mentah[0] : mentah;
  if (!nilai) return null;

  const tempat = await bacaTempatTerpilih(nilai);
  if (!tempat) return null;

  const rMentah = searchParams.radius;
  const r = Number(Array.isArray(rMentah) ? rMentah[0] : rMentah);
  if (Number.isFinite(r) && r >= 200 && r <= 20_000) {
    return { ...tempat, radius: Math.round(r) };
  }
  return tempat;
}

/**
 * Potongan `where` Prisma untuk "aset ini dekat tempat itu".
 *
 * Memakai relasi `some`, bukan daftar id yang sudah dihitung lebih dulu.
 * Bedanya bukan gaya: `some` menjadi EXISTS di SQL, jadi ia menyatu dengan
 * seluruh filter lain (harga, tipe, kota) dalam SATU rencana kueri, dan
 * `count` untuk paginasi ikut benar dengan sendirinya. Daftar id yang dirakit
 * di aplikasi harus dibatasi jumlahnya, dan batas itu akan diam-diam membuat
 * jumlah hasilnya salah.
 */
export function buildTempatWhere(
  tempat: TempatTerpilih | null,
): Prisma.ListingWhereInput | undefined {
  if (!tempat) return undefined;

  /**
   * Pilihan "jenis tempat" ("kampus mana pun di Malang") disaring lewat
   * relasi bertingkat, BUKAN daftar id.
   *
   * "Semua sekolah di Jakarta" bisa berarti ribuan baris kamus. Merakit
   * daftar id sepanjang itu di aplikasi berarti kueri raksasa yang lambat —
   * dan lebih buruk, daftar itu harus dibatasi jumlahnya, sehingga sebagian
   * sekolah diam-diam tidak ikut disaring tanpa ada yang tahu. Sebagai relasi
   * bertingkat, seleksinya dikerjakan database dan `count` untuk paginasi
   * otomatis benar.
   */
  if (tempat.kriteria) {
    const w = tempat.kriteria.wilayah;
    return {
      tempatDekat: {
        some: {
          jarak_meter: { lte: tempat.radius },
          tempat: {
            kelas: tempat.kriteria.kelas,
            ...(w
              ? {
                  OR: [
                    { kota: { contains: w, mode: "insensitive" } },
                    { provinsi: { contains: w, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
        },
      },
    };
  }

  if (tempat.ids.length === 0) return undefined;
  return {
    tempatDekat: {
      some: {
        id_tempat: { in: tempat.ids },
        jarak_meter: { lte: tempat.radius },
      },
    },
  };
}

/**
 * Syarat "baris indeks ini termasuk tempat yang dipilih", untuk SQL mentah.
 *
 * Dipakai kueri jarak & pengurutan yang memang tidak bisa lewat Prisma.
 * Mengembalikan `null` bila pilihannya tidak menyeleksi apa pun — pemanggil
 * yang memutuskan artinya, karena "tidak ada syarat" dan "tidak ada hasil"
 * adalah dua hal yang sangat berbeda.
 *
 * Alias yang diasumsikan: `lt` = listing_tempat, `tp` = tempat.
 */
function syaratTempatSql(tempat: TempatTerpilih): Prisma.Sql | null {
  if (tempat.kriteria) {
    const w = tempat.kriteria.wilayah;
    return w
      ? Prisma.sql`tp.kelas = ${tempat.kriteria.kelas}
          AND (lower(tp.kota) LIKE ${"%" + w + "%"}
            OR lower(tp.provinsi) LIKE ${"%" + w + "%"})`
      : Prisma.sql`tp.kelas = ${tempat.kriteria.kelas}`;
  }
  if (tempat.ids.length === 0) return null;
  return Prisma.sql`lt.id_tempat IN (${Prisma.join(tempat.ids)})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// JARAK UNTUK DITAMPILKAN
// ─────────────────────────────────────────────────────────────────────────────

export interface TempatDekatKartu {
  /** Nama tempatnya — "Universitas Ciputra", bukan "Semua kampus". */
  nama: string;
  meter: number;
  /** Sudah diformat: "1,2 km", "< 50 m". */
  teks: string;
  /**
   * True bila angkanya tidak boleh dibaca sebagai jarak terukur — titik
   * asetnya kasar, atau angkanya klaim agent. Kartu menambahkan "±".
   */
  perkiraan: boolean;
}

export interface JarakKeTempat {
  /**
   * Tempat yang cocok dengan pencarian, TERDEKAT DULU, dibatasi MAKS_CHIP.
   *
   * Sengaja daftar, bukan satu angka. Saat yang dicari adalah JENIS ("semua
   * kampus"), kartu yang menulis "152 m dari Semua kampus" membuang justru
   * jawabannya: yang ingin diketahui pembaca adalah kampus MANA. Dan sebuah
   * aset sering dekat ke beberapa sekaligus — kos di Dharmahusada dekat ke
   * Unair maupun ke Universitas Ciputra, dan keduanya alasan yang berbeda
   * untuk memilihnya.
   */
  daftar: TempatDekatKartu[];
}

/**
 * Batas tempat yang dicetak di satu kartu.
 *
 * Tiga cukup untuk memperlihatkan bahwa asetnya berada di kawasan itu (bukan
 * kebetulan dekat satu titik), dan masih terbaca dalam satu baris berjalan.
 * Lebih dari itu barisnya jadi terlalu panjang untuk selesai dibaca sebelum
 * mata pindah ke kartu berikutnya.
 */
const MAKS_CHIP = 3;

/**
 * Diambil lebih banyak dari yang dicetak, karena sebagian akan dilebur.
 */
const AMBIL_CHIP = 8;

/**
 * Dua nama dianggap tempat yang sama bila awalannya berimpit sepanjang ini,
 * DAN seberapa besar bagiannya terhadap nama yang lebih pendek.
 *
 * Ada karena satu tempat sering terpecah di peta: "Politeknik Kesehatan A",
 * "Politeknik Kesehatan B", dan "Politeknik Kesehatan Kementerian Kesehatan
 * Surabaya" adalah tiga gedung dari satu kampus. Dicetak apa adanya, kartu
 * memakai seluruh ruangnya untuk mengatakan hal yang sama tiga kali, dan
 * tempat kedua yang benar-benar berbeda tidak kebagian tempat.
 *
 * Ambangnya sengaja tinggi. "Universitas Negeri Surabaya" dan "Universitas
 * Ciputra Surabaya" berbagi awalan "univ " saja — 25% dari yang terpendek —
 * jadi keduanya tetap berdiri sendiri, sebagaimana seharusnya.
 */
const MIN_AWALAN_SERUPA = 12;
const RASIO_SERUPA = 0.6;

function tempatSerupa(a: string, b: string): boolean {
  const x = normalNama(a);
  const y = normalNama(b);
  const n = Math.min(x.length, y.length);
  if (n === 0) return false;
  let i = 0;
  while (i < n && x[i] === y[i]) i++;
  return i >= MIN_AWALAN_SERUPA && i / n >= RASIO_SERUPA;
}

/**
 * Jarak tiap aset ke tempat terpilih, untuk dicetak di kartu hasil.
 *
 * Diambil sekali untuk seluruh kartu di halaman itu — bukan satu kueri per
 * kartu. Dua belas kartu berarti satu kueri, bukan dua belas.
 */
export async function ambilJarakKeTempat(
  tempat: TempatTerpilih | null,
  idListing: Array<bigint | number | string>,
): Promise<Map<string, JarakKeTempat>> {
  const hasil = new Map<string, JarakKeTempat>();
  if (!tempat || idListing.length === 0) return hasil;

  const syarat = syaratTempatSql(tempat);
  if (!syarat) return hasil;

  const ids = idListing.map((v) => BigInt(v as any));

  try {
    /**
     * Ambil beberapa tempat terdekat PER ASET lewat `row_number()`.
     *
     * `DISTINCT ON` hanya bisa mengembalikan satu baris per aset, dan satu
     * baris berarti kartu tidak pernah bisa menyebut kampus kedua. Window
     * function memberi tiga teratas dengan satu kali baca indeks yang sama.
     */
    const baris = await prisma.$queryRaw<
      Array<{
        id_property: bigint;
        jarak: number;
        sumber: string;
        presisi: string;
        nama: string;
      }>
    >`
      SELECT id_property, jarak, sumber, presisi, nama FROM (
        SELECT lt.id_property, lt.jarak_meter AS jarak, lt.sumber, lt.presisi,
               tp.nama,
               row_number() OVER (
                 PARTITION BY lt.id_property ORDER BY lt.jarak_meter ASC, tp.nama ASC
               ) AS urutan
        FROM listing_tempat lt
        JOIN tempat tp ON tp.id = lt.id_tempat
        WHERE lt.id_property IN (${Prisma.join(ids)})
          AND lt.jarak_meter <= ${tempat.radius}
          AND (${syarat})
      ) x
      WHERE urutan <= ${AMBIL_CHIP}
      ORDER BY id_property, jarak ASC
    `;

    for (const b of baris) {
      const sumber = b.sumber === "PATOKAN" ? "PATOKAN" : "PINDAI";
      // Titik setingkat kecamatan bisa meleset kilometer; menampilkan
      // "1,2 km" dari titik seperti itu adalah ketepatan yang dikarang.
      const perkiraan =
        sumber === "PATOKAN" || b.presisi === "KECAMATAN" || b.presisi === "PATOKAN";

      const kunci = String(b.id_property);
      const sudah = hasil.get(kunci);
      const item: TempatDekatKartu = {
        nama: b.nama,
        meter: b.jarak,
        teks: formatJarak(b.jarak),
        perkiraan,
      };

      if (!sudah) {
        hasil.set(kunci, { daftar: [item] });
        continue;
      }
      if (sudah.daftar.length >= MAKS_CHIP) continue;
      // Barisnya sudah terurut dari yang terdekat, jadi wakil yang lebih dekat
      // selalu yang bertahan saat dua nama ternyata tempat yang sama.
      if (sudah.daftar.some((t) => tempatSerupa(t.nama, item.nama))) continue;
      sudah.daftar.push(item);
    }
  } catch {
    // Kartu tetap tampil tanpa label jarak — kehilangan hiasan, bukan hasil.
  }

  return hasil;
}

// ─────────────────────────────────────────────────────────────────────────────
// URUT TERDEKAT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Id aset untuk satu halaman, terurut dari yang paling dekat.
 *
 * KENAPA TIDAK LEWAT `orderBy` PRISMA. Yang perlu diurut adalah jarak
 * TERKECIL di antara beberapa baris relasi (sebuah aset bisa dekat ke tiga
 * gerai jaringan yang sama), dan Prisma tidak bisa mengurutkan berdasarkan
 * agregat relasi to-many. Menaruh jaraknya sebagai kolom di `listing` juga
 * bukan jawaban — nilainya berbeda untuk setiap tempat yang dicari.
 *
 * Maka: himpunan hasil yang sudah tersaring diambil id-nya (dibatasi
 * MAKS_URUT), diurutkan memakai peta jarak dari satu kueri terindeks, lalu
 * dipotong per halaman. Aman karena pencarian "dekat X" memang sempit —
 * batasnya radius, bukan seluruh basis data.
 */
export async function urutkanTerdekat(
  tempat: TempatTerpilih,
  where: Prisma.ListingWhereInput,
  halaman: number,
  perHalaman: number,
): Promise<{ ids: bigint[]; total: number } | null> {
  try {
    const cocok = await prisma.listing.findMany({
      where,
      select: { id_property: true },
      take: MAKS_URUT,
    });
    if (cocok.length === 0) return { ids: [], total: 0 };

    const syarat = syaratTempatSql(tempat);
    if (!syarat) return { ids: [], total: 0 };

    const idSemua = cocok.map((c) => c.id_property);
    const jarak = await prisma.$queryRaw<
      Array<{ id_property: bigint; jarak: number }>
    >`
      SELECT lt.id_property, min(lt.jarak_meter) AS jarak
      FROM listing_tempat lt
      JOIN tempat tp ON tp.id = lt.id_tempat
      WHERE lt.id_property IN (${Prisma.join(idSemua)})
        AND lt.jarak_meter <= ${tempat.radius}
        AND (${syarat})
      GROUP BY lt.id_property
    `;

    const peta = new Map(jarak.map((j) => [String(j.id_property), Number(j.jarak)]));
    const urut = idSemua
      .filter((id) => peta.has(String(id)))
      .sort((a, b) => {
        const da = peta.get(String(a))!;
        const db = peta.get(String(b))!;
        // Pemecah seri wajib: tanpa urutan total, aset berjarak sama bisa
        // muncul dua kali di halaman 1 dan 2 — atau hilang sama sekali.
        return da !== db ? da - db : Number(b - a);
      });

    const mulai = Math.max(0, (halaman - 1) * perHalaman);
    return { ids: urut.slice(mulai, mulai + perHalaman), total: urut.length };
  } catch {
    return null;
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// PINTU MASUK HALAMAN
// ─────────────────────────────────────────────────────────────────────────────

export interface SiapTempat {
  tempat: TempatTerpilih | null;
  /**
   * Kata kunci yang MASIH layak dicari sebagai alamat.
   *
   * Kosong ketika teksnya ternyata nama tempat: mencari string "deket unesa"
   * di dalam kolom `alamat_lengkap` dijamin nol hasil, dan menahannya di
   * filter berarti pencarian yang sudah benar dibatalkan oleh sisa kalimatnya
   * sendiri.
   */
  q: string | undefined;
  /** Bentuk ringkas untuk chip di search bar & bilah filter. */
  chip: TempatDipilih | null;
  /** True bila tempatnya DITEBAK server, bukan dipilih user dari saran. */
  ditebak: boolean;
  /**
   * Penjelasan untuk hasil kosong yang punya sebab yang bisa dikatakan —
   * mis. "Belum ada sekolah di Banten dalam data kami", berikut satu tautan
   * jalan keluar. Ditampilkan halaman di atas daftar hasil.
   */
  catatan: CatatanTempat | null;
}

/**
 * Satu panggilan yang mengurus seluruh urusan "dekat X" di sisi halaman.
 *
 * Menangani dua jalan masuk yang harus bermuara sama:
 *
 *   1. User MENGKLIK saran → `?dekat=unesa-surabaya`. Jelas, tidak ambigu.
 *   2. User MENGETIK "deket unesa" lalu menekan Enter → `?q=deket+unesa`.
 *      Inilah jalan yang dulu berakhir di "0 properti", dan yang paling
 *      sering ditempuh: menekan Enter lebih cepat daripada mengarahkan tetikus
 *      ke sebuah baris saran.
 *
 * Jalan kedua ditebak di SERVER, bukan di browser, karena tebakannya harus
 * berlaku juga untuk tautan yang dibagikan, hasil mesin pencari, dan pengunjung
 * yang JavaScript-nya belum termuat.
 */
export async function siapkanTempat(
  searchParams: { [key: string]: string | string[] | undefined },
  opsi: { q?: string; kota?: string | null } = {},
): Promise<SiapTempat> {
  const dipilih = await bacaTempatDariParams(searchParams);
  if (dipilih) {
    return {
      tempat: dipilih,
      q: opsi.q,
      chip: keChip(dipilih),
      ditebak: false,
      catatan: null,
    };
  }

  const teks = (opsi.q ?? "").trim();
  const kosong: SiapTempat = {
    tempat: null,
    q: undefined,
    chip: null,
    ditebak: false,
    catatan: null,
  };
  if (!teks) return kosong;

  const tebakan = await tebakTempatDariTeks(teks, { kota: opsi.kota });

  // Kata kunci DIPERTAHANKAN saat tebakannya gagal. Hasilnya memang akan
  // kosong, dan itu benar: yang mengetik "sekolah di Banten" belum tentu mau
  // melihat seluruh Indonesia. Yang berubah adalah halamannya kini bisa
  // menjelaskan kenapa, dan menawarkan satu klik untuk melanjutkan.
  if (!tebakan.tempat) {
    return { ...kosong, q: teks, catatan: tebakan.catatan };
  }

  const tempat = await bacaTempatTerpilih(tebakan.tempat.nilai);
  if (!tempat) return { ...kosong, q: teks };

  return {
    tempat,
    q: undefined,
    chip: keChip(tempat),
    ditebak: true,
    catatan: null,
  };
}

function keChip(t: TempatTerpilih): TempatDipilih {
  return {
    nilai: t.nilai,
    nama: t.nama,
    label: t.label,
    icon: t.icon,
    warna: t.warna,
    kota: t.kota,
    radius: t.radius,
    cabang: t.cabang,
    kelasSemua: t.kelasSemua,
  };
}

// src/lib/klienMatch.ts
// ---------------------------------------------------------------------------
// MESIN PENCOCOKAN PREFERENSI KLIEN — satu-satunya tempat aturannya ditulis.
//
// Dipakai tiga pemanggil: modal "Listing yang Cocok" di CRM, ringkasan
// rekomendasi di kartu klien, dan cron asisten follow-up. Ketiganya HARUS
// memberi jawaban yang sama untuk klien yang sama; begitu aturannya disalin ke
// tempat kedua, ketiganya akan menyimpang perlahan dan tidak ada yang sadar
// sampai seorang agent mengirim aset sewa kepada orang yang mau beli.
//
// ── PRINSIP: PENCOCOKAN KETAT ──────────────────────────────────────────────
// Tidak ada pelonggaran diam-diam. Aset yang Rp 1 di atas plafon TIDAK muncul.
// Alasannya: rekomendasi yang "kira-kira cocok" memaksa agent memeriksa ulang
// tiap baris, dan daftar yang harus diperiksa ulang tidak menghemat apa pun.
//
// Harga kelonggaran itu — klien berkriteria sempit tidak pernah dapat kiriman
// — dibayar di tempat lain: `diagnosaKosong()`. Saat hasilnya nol, mesin
// menghitung gerbang mana yang membuang paling banyak kandidat dan
// melaporkannya ("plafon +10% → 4 aset", "seluruh kota → 12 aset"). Agent
// tetap menerima kriteria persis, tapi tidak pernah menghadapi layar kosong
// tanpa tahu apa yang harus digeser.
// ---------------------------------------------------------------------------

import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  jenis_transaksi_enum,
  kategori_properti_enum,
  maksud_preferensi_enum,
  sertifikat_enum,
} from "@prisma/client";

/* ── Maksud → jenis transaksi ──────────────────────────────────────────────
   Gerbang paling keras di seluruh mesin. Rumah yang sama bisa terdaftar dua
   kali — satu dijual, satu disewakan — dan mengirim yang salah adalah
   kesalahan yang langsung terlihat bodoh di mata klien. */

export const TRANSAKSI_BELI: jenis_transaksi_enum[] = ["PRIMARY", "SECONDARY", "LELANG", "CESSIE"];
export const TRANSAKSI_SEWA: jenis_transaksi_enum[] = ["SEWA"];

/** Jenis transaksi yang boleh dilihat sebuah preferensi.
 *  Bila preferensi menyebut jenis transaksi tertentu, itu yang dipakai — TAPI
 *  tetap disaring lewat maksudnya, supaya data lama yang menyimpang (mis.
 *  maksud SEWA dengan jenis LELANG, yang kini dicegah CHECK di database) tidak
 *  bisa menembus mesin ini. */
export function transaksiUntuk(
  maksud: maksud_preferensi_enum,
  jenis: jenis_transaksi_enum | null,
): jenis_transaksi_enum[] {
  const diizinkan = maksud === "SEWA" ? TRANSAKSI_SEWA : TRANSAKSI_BELI;
  if (!jenis) return diizinkan;
  return diizinkan.includes(jenis) ? [jenis] : diizinkan;
}

/** Turunkan maksud dari isian form. Dipakai SAAT MENULIS preferensi (POST &
 *  PUT) supaya kolom `maksud` tidak pernah bergantung pada agent mengingat
 *  mengisinya. KOS ikut SEWA tanpa syarat — kategori itu memang hanya pernah
 *  ada sebagai sewa. */
export function turunkanMaksud(
  jenis: jenis_transaksi_enum | null | undefined,
  tipe: kategori_properti_enum | null | undefined,
  eksplisit?: maksud_preferensi_enum | null,
): maksud_preferensi_enum {
  if (eksplisit === "BELI" || eksplisit === "SEWA") return eksplisit;
  if (jenis === "SEWA") return "SEWA";
  if (tipe === "KOS") return "SEWA";
  return "BELI";
}

/* ── Bentuk preferensi yang dibaca mesin ───────────────────────────────── */

export type KriteriaMatch = {
  id_preferensi?: bigint | number;
  maksud: maksud_preferensi_enum;
  /** null = SEMUA tipe. Klien menyebut daerah & anggaran jauh lebih dulu
   *  daripada menyebut rumah atau ruko, jadi ini bawaan yang sering benar. */
  tipe_properti: kategori_properti_enum | null;
  jenis_transaksi: jenis_transaksi_enum | null;
  loc_provinsi: string | null;
  loc_kota: string | null;
  loc_kecamatan: string | null;
  loc_kelurahan: string | null;
  budget_min: Prisma.Decimal | number | null;
  budget_max: Prisma.Decimal | number | null;
  luas_min: Prisma.Decimal | number | null;
  luas_max: Prisma.Decimal | number | null;
  /** Sertifikat yang diminta. null/undefined = klien tidak mempermasalahkan —
   *  itu keadaan bawaan dan yang paling sering benar. */
  legalitas?: sertifikat_enum | null;
  /** Kriteria "dekat X", SUDAH diterjemahkan dari token `dekat_nilai`.
   *
   *  Sengaja sudah jadi, bukan token mentah: menerjemahkannya butuh query ke
   *  kamus `tempat`, dan berkas ini harus tetap bisa memutuskan tanpa I/O —
   *  itulah yang membuat pemindai terbalik di cron bisa mengadu ribuan
   *  preferensi di memori. Penerjemahannya dilakukan pemanggil, sekali per
   *  preferensi, lewat `siapkanDekat()` di src/lib/klienDekat.ts. */
  dekat?: KriteriaDekat | null;
  /** Patokan berupa teks alamat — nama jalan / perumahan yang tidak ada di
   *  kamus tempat. Dicocokkan apa adanya ke `alamat_lengkap`. */
  alamat_teks?: string | null;
};

/** Presisi titik yang boleh dipakai MENGKLAIM JARAK.
 *
 *  Bukan kehati-hatian berlebihan — ini diukur pada data yang ada. Tiga listing
 *  berbeda sama-sama tercatat "186 m dari Masjid Syuhada", dan satu tercatat
 *  "0 m dari Waru": tanda tangan titik pusat KECAMATAN yang dipakai bersama.
 *  Titik seperti itu meleset sampai ±5 km, jadi angka jaraknya fiksi.
 *
 *  Klien yang meminta "dalam 500 m dari UNESA" lalu menerima rumah yang
 *  sebenarnya 4 km jauhnya bukan sekadar kecewa — ia berhenti percaya pada
 *  seluruh rekomendasi berikutnya, dan agent yang mengirimnya tidak punya cara
 *  tahu bahwa angkanya salah.
 *
 *  PATOKAN ikut dipercaya: itu jarak yang DIKETIK agent sendiri ("5 menit dari
 *  UNESA"), jadi ia klaim manusia, bukan tebakan geocoder. */
const PRESISI_LAYAK = ["TITIK", "ALAMAT", "PATOKAN"];

/** Bentuk "dekat X" yang sudah siap dipakai mesin pencocokan. */
export type KriteriaDekat = {
  /** id baris `tempat` yang diwakili pilihan ini. Kosong bila berupa kriteria. */
  ids: bigint[];
  /** Pilihan "jenis tempat" ("hotel mana pun di Surabaya"). */
  kriteria?: { kelas: string; wilayah: string | null } | null;
  radius: number;
  /** Untuk ditampilkan di label & chip alasan. */
  label: string;
};

const angka = (v: Prisma.Decimal | number | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);

/* ── Lokasi ────────────────────────────────────────────────────────────────
   Preferensi menyimpan empat tingkat, dan yang mengikat adalah yang PALING
   SPESIFIK yang terisi. Orang yang menulis "Kecamatan Driyorejo" sudah
   menjawab pertanyaan kotanya; mencocokkan keduanya sekaligus cuma menambah
   cara untuk gagal saat ejaan kota di listing berbeda tipis. */

export type TingkatLokasi = "kelurahan" | "kecamatan" | "kota" | "provinsi" | "bebas";

export function tingkatLokasi(k: KriteriaMatch): { tingkat: TingkatLokasi; nilai: string | null } {
  if (k.loc_kelurahan) return { tingkat: "kelurahan", nilai: k.loc_kelurahan };
  if (k.loc_kecamatan) return { tingkat: "kecamatan", nilai: k.loc_kecamatan };
  if (k.loc_kota)      return { tingkat: "kota",      nilai: k.loc_kota };
  if (k.loc_provinsi)  return { tingkat: "provinsi",  nilai: k.loc_provinsi };
  return { tingkat: "bebas", nilai: null };
}

/* ── LUAS: SATU ANGKA, DAN IA BERARTI LUAS TANAH ───────────────────────────
   Formulir preferensi hanya punya SATU pasang kolom luas, dan agent yang
   mengetik "500" untuk gudang bermaksud LUAS TANAH. Aturan lama menerima
   `luas_tanah ATAU luas_bangunan` — "paling murah hati", supaya apartemen
   (tanpa tanah) dan tanah (tanpa bangunan) sama-sama terlayani satu kolom.

   Kemurahan hati itu BOCOR ke arah yang salah, dan terukur: rumah dengan
   LT 72 / LB 90 lolos untuk klien yang meminta minimal 80 m² tanah — lewat
   luas BANGUNANnya. Agent membaca kartunya, melihat "LT 72", dan menyimpulkan
   pencariannya rusak. Pada gudang & pabrik selisihnya jauh lebih besar:
   LT 100 dengan bangunan bertingkat bisa lolos syarat "minimal 500 m²".

   Aturan sekarang: bangunan HANYA dipakai ketika tanah tidak ada angkanya
   sama sekali. Ia tidak pernah bisa MENYELAMATKAN baris yang luas tanahnya
   sudah terisi dan tidak memenuhi syarat — di situlah letak seluruh bocornya.

   APARTEMEN dibalik, dan bukan karena selera: apartemen tidak punya tanah.
   Yang penting, arah cadangannya juga dibalik. Pada basis data ini hanya
   SATU dari 1.325 apartemen yang punya `luas_bangunan`; 1.324 sisanya menaruh
   luas unitnya di `luas_tanah` (begitulah lot lelang menuliskannya). Aturan
   lama memaksa apartemen dibandingkan dengan `luas_bangunan` saja, jadi SETIAP
   pencarian apartemen yang menyebut luas mengembalikan NOL — pemadaman total,
   tanpa satu pun galat. Diuji: 29 apartemen di Jawa Timur, 0 begitu luas
   minimum diisi. */

/** Luas yang MENGIKAT untuk sebuah listing, menurut tipe yang diminta klien.
 *  Mengembalikan 0 bila tidak ada angka yang bisa dipakai — dan 0 selalu
 *  gagal memenuhi syarat minimum, bukan lolos diam-diam. */
export function luasMengikat(
  l: { luas_tanah?: Prisma.Decimal | number | null; luas_bangunan?: Prisma.Decimal | number | null },
  tipe: kategori_properti_enum | null,
): number {
  const lt = l.luas_tanah ? Number(l.luas_tanah) : 0;
  const lb = l.luas_bangunan ? Number(l.luas_bangunan) : 0;
  // Apartemen tidak punya tanah: angka mana pun yang terisi adalah luas unitnya.
  if (tipe === "APARTEMEN") return lb > 0 ? lb : lt;
  // Tanah tidak punya bangunan: tidak ada cadangan yang masuk akal.
  if (tipe === "TANAH") return lt;
  // Sisanya: tanah dulu. Bangunan hanya bila tanahnya memang tak berangka.
  return lt > 0 ? lt : lb;
}

/* ── BENTUK ASET: TANAH KOSONG vs TERBANGUN ────────────────────────────────
   Gerbang kategori memakai kolom `kategori`, dan pada data lelang kolom itu
   adalah EMBER TEMPAT LOT ITU DIAMBIL — bukan jenis asetnya. `bukan_properti`
   sudah membuang lot yang bukan properti sama sekali; yang tersisa adalah
   kesalahan yang lebih halus: lot yang memang properti tapi bentuknya bukan
   yang diminta. Di basis data ini 2.467 lot di ember TANAH sebenarnya
   "berikut bangunan", dan 238 lot di ember RUMAH sebenarnya tanah kosong —
   termasuk 76 hektar kebun yang dikirim ke orang yang mencari rumah tinggal.

   `listing.ada_bangunan` (trigger, prisma/migration_listing_ada_bangunan.sql)
   menjawab satu bit itu. NULL = tidak diketahui, dan NULL TIDAK PERNAH
   dibuang: yang dibuang hanya nilai yang bertentangan dengan permintaan. */

/** Bentuk yang dituntut sebuah kategori, atau null bila kategori itu tidak
 *  menuntut apa pun (KOS bisa berupa gedung maupun kamar dalam rumah, dan
 *  "semua tipe" jelas tidak menuntut apa-apa). */
export function bentukDiminta(tipe: kategori_properti_enum | null): boolean | null {
  if (!tipe) return null;
  if (tipe === "TANAH") return false;
  if (tipe === "APARTEMEN") return true;
  if (tipe === "KOS") return null;
  // RUMAH, RUKO, GUDANG, PABRIK, TOKO, HOTEL_DAN_VILLA — semuanya bangunan.
  return true;
}

/* ── NORMALISASI LOKASI ────────────────────────────────────────────────────
   Diselamatkan dari src/lib/preferenceMatch.ts (mesin pendahulu berkas ini),
   dan ini bagian yang paling mudah dilewatkan saat menulis ulang.

   Lokasi listing datang dari geocoding dan dari tiga sumber input berbeda,
   jadi satu tempat yang sama tersimpan sebagai "Kota Surabaya", "SURABAYA",
   dan "Surabaya"; kecamatan tersimpan sebagai "Kec. Driyorejo" maupun
   "Driyorejo". Perbandingan `equals` — bahkan yang buta huruf besar-kecil —
   akan menyatakan ketiganya berbeda dan MEMBUANG hasil yang benar tanpa
   sedikit pun jejak galat. Gejalanya: "tidak ada aset yang cocok" pada kota
   yang jelas-jelas penuh listing.

   Karena normalisasi ini tidak bisa dilakukan di SQL tanpa index ekspresi,
   pencocokan dikerjakan dua tahap: SQL menyempitkan kolam secara KASAR
   (superset yang aman), JavaScript menyaringnya secara KETAT. */

export function normLok(s?: string | null): string {
  return (s ?? "")
    .toString()
    .toLowerCase()
    .replace(/^(kota|kab\.?|kabupaten|kotamadya|kec\.?|kecamatan|kel\.?|kelurahan|desa)\s+/, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/** Inti nama wilayah untuk `contains` di SQL — masih mengandung spasi supaya
 *  "dolat rayat" tetap cocok dengan "Kecamatan Dolat Rayat". Sengaja longgar:
 *  tugasnya hanya memperkecil kolam, bukan memutuskan. */
function teksCari(s?: string | null): string {
  return (s ?? "")
    .toString()
    .toLowerCase()
    .replace(/^(kota|kab\.?|kabupaten|kotamadya|kec\.?|kecamatan|kel\.?|kelurahan|desa|prov\.?|provinsi)\s+/i, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

/** Foto pertama sebuah listing, siap dipasang di <img>.
 *  Sebagian `gambar` menyimpan URL penuh, sebagian hanya file-id Google Drive.
 *  Mengembalikan file-id mentah ke browser menghasilkan gambar rusak di
 *  seluruh daftar rekomendasi. */
export function fotoPertama(raw?: string | null): string {
  const daftar = (raw || "")
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
  const f = daftar[0];
  if (!f) return "";
  if (f.startsWith("http://") || f.startsWith("https://") || f.startsWith("/")) return f;
  return `https://drive.google.com/thumbnail?id=${f}`;
}

/** Harga yang dipakai membandingkan dengan budget.
 *  `harga_efektif` adalah kolom turunan yang diisi trigger dan sudah benar
 *  untuk semua jenis transaksi (termasuk lelang, lihat
 *  migration_lelang_harga_efektif.sql) — tapi baris yang dibuat SEBELUM
 *  triggernya ada bisa saja masih NULL, dan baris seperti itu tidak boleh
 *  lenyap dari pencarian tanpa suara. Karena itu ada jalur cadangan. */
export function hargaEfektif(l: {
  harga_efektif?: Prisma.Decimal | null;
  harga: Prisma.Decimal | number;
  harga_promo?: Prisma.Decimal | null;
  nilai_limit_lelang?: Prisma.Decimal | null;
  jenis_transaksi?: string;
}): number {
  if (l.harga_efektif != null) return Number(l.harga_efektif);
  if (String(l.jenis_transaksi).toUpperCase() === "LELANG" && l.nilai_limit_lelang != null)
    return Number(l.nilai_limit_lelang);
  const h = Number(l.harga);
  const p = l.harga_promo != null ? Number(l.harga_promo) : 0;
  return p > 0 && p < h ? p : h;
}

/* ── Penyusun WHERE ────────────────────────────────────────────────────── */

export type OpsiMatch = {
  /** id_property yang tidak boleh muncul: sudah pernah dikirim ke klien ini,
   *  atau justru aset milik klien itu sendiri (titip jual). */
  kecuali?: bigint[];
  /** Longgarkan satu gerbang. HANYA dipakai diagnosaKosong() untuk menjelaskan
   *  kenapa hasilnya nol — jalur normal tidak pernah memakainya. */
  longgar?: "budget" | "lokasi" | "luas" | "bentuk" | null;
};

/** TAHAP 1 — penyempit kolam di SQL. Sengaja LEBIH LONGGAR dari kriteria
 *  sebenarnya: apa pun yang lolos di sini masih akan diperiksa ulang oleh
 *  `lolosKetat()`. Yang HARAM di sini adalah membuang baris yang seharusnya
 *  cocok, karena tidak ada tahap berikutnya yang bisa mengembalikannya. */
export function whereKasar(k: KriteriaMatch, opsi: OpsiMatch = {}): Prisma.ListingWhereInput {
  const { kecuali = [], longgar = null } = opsi;

  /* Syarat yang butuh OR dikumpulkan di sini lalu dipasang sebagai `AND`.
     Bukan gaya penulisan: `where.OR` hanya ADA SATU. Versi sebelumnya memakai
     `where.OR` untuk budget; menambahkan gerbang ber-OR kedua langsung di
     `where.OR` akan MENIMPA gerbang budget tanpa satu pun galat — plafon
     harga klien hilang diam-diam dan hasilnya terlihat "cuma agak longgar". */
  const dan: Prisma.ListingWhereInput[] = [];

  const where: Prisma.ListingWhereInput = {
    // Gerbang keras 1: aset yang tidak tersedia bukan rekomendasi, ia kabar buruk.
    status_tayang: "TERSEDIA",
    /* Gerbang keras 2: BUKAN PROPERTI.
       Harus mendahului gerbang kategori, karena justru kategorilah yang tidak
       bisa dipercaya di sini. Pada data hasil scraping lelang, `kategori`
       adalah EMBER TEMPAT LOT ITU DIAMBIL, bukan jenis asetnya — scraper
       dijalankan `--kategori Rumah` dan seluruh lot di putaran itu ditulis
       RUMAH, termasuk sepeda motor, ekskavator, sapi potong, dan batubara.
       Tanpa baris ini, klien yang mencari rumah ≤ 250 jt di Gresik menerima
       lelang sepeda motor — dan gerbang kategori di bawah tidak akan pernah
       menangkapnya, karena motor itu memang tercatat sebagai RUMAH.
       Kolomnya diisi trigger; aturannya di prisma/migration_listing_bukan_properti.sql. */
    bukan_properti: false,
    /* Gerbang keras 3: kategori persis — DILEWATI bila null.
       null berarti "semua tipe", dan memasang `kategori: null` di sini akan
       mencari listing yang kategorinya NULL (tidak ada satu pun), bukan
       melonggarkan saringannya. Diam-diam nol hasil. */
    ...(k.tipe_properti ? { kategori: k.tipe_properti } : {}),
    // Gerbang keras 4: maksud — BELI tidak pernah melihat listing SEWA.
    jenis_transaksi: { in: transaksiUntuk(k.maksud, k.jenis_transaksi) },
  };

  /* Gerbang legalitas. Disaring di SQL karena enum tidak punya masalah ejaan —
     tidak seperti lokasi, tidak ada yang perlu dinormalisasi. Hanya dipasang
     bila klien memang memintanya; NULL berarti tidak mempermasalahkan, dan
     memperlakukannya sebagai "harus NULL juga" akan mengosongkan hasil untuk
     hampir semua klien. */
  if (k.legalitas) where.legalitas = k.legalitas;

  /* Gerbang keras 5: BENTUK ASET (tanah kosong vs terbangun).
     Lapis kedua atas kebohongan kolom `kategori`, lihat catatan di
     bentukDiminta(). `null` pada listing berarti "tidak diketahui" dan HARUS
     ikut lolos — kalau tidak, seluruh listing yang diinput agent sendiri
     (judulnya bebas, jadi sering tak terdeteksi) lenyap dari rekomendasi. */
  const bentuk = longgar === "bentuk" ? null : bentukDiminta(k.tipe_properti);
  if (bentuk !== null) {
    /* Ditulis sebagai OR eksplisit, BUKAN `{ not: !bentuk }`: perlakuan Prisma
       atas NULL di dalam `not` berbeda antar versi, dan gerbang yang diam-diam
       berubah arti saat naik versi adalah persis jenis kerusakan yang tidak
       akan ada yang lihat sampai seorang klien menerima aset yang salah. */
    dan.push({ OR: [{ ada_bangunan: bentuk }, { ada_bangunan: null }] });
  }

  /* Patokan teks alamat. Murah karena `alamat_lengkap` sudah ber-index
     trigram (5 ms pada 120 ribu baris) — tanpa index itu ini akan jadi
     pemindaian penuh seperti bug kecamatan sebelumnya. */
  const alamatCari = (k.alamat_teks || "").trim();
  if (alamatCari.length >= 3 && longgar !== "lokasi") {
    where.alamat_lengkap = { contains: alamatCari, mode: "insensitive" };
  }

  /* Gerbang "dekat X". Memakai relasi `some`, bukan daftar id_property yang
     dihitung lebih dulu: `some` menjadi EXISTS di SQL sehingga menyatu dengan
     seluruh penyaring lain dalam SATU rencana kueri — dan yang lebih penting,
     ia tidak punya batas jumlah yang diam-diam memotong hasil.

     Dua bentuk pilihan ditangani berbeda dan itu disengaja: tempat tertentu
     jadi `id_tempat IN (…)`, sedangkan "jenis tempat" jadi penyaring bertingkat
     ke kamusnya — "semua sekolah di Jakarta" bisa berarti ribuan baris kamus,
     dan merakit daftar id sepanjang itu di aplikasi menghasilkan kueri yang
     lambat sekaligus rapuh. */
  if (k.dekat && longgar !== "lokasi") {
    const d = k.dekat;
    if (d.kriteria) {
      const w = d.kriteria.wilayah;
      where.tempatDekat = {
        some: {
          jarak_meter: { lte: d.radius },
          presisi: { in: PRESISI_LAYAK },
          tempat: {
            kelas: d.kriteria.kelas,
            ...(w
              ? { OR: [{ kota: { contains: w, mode: "insensitive" } },
                       { provinsi: { contains: w, mode: "insensitive" } }] }
              : {}),
          },
        },
      };
    } else if (d.ids.length > 0) {
      where.tempatDekat = {
        some: { id_tempat: { in: d.ids }, jarak_meter: { lte: d.radius }, presisi: { in: PRESISI_LAYAK } },
      };
    } else {
      /* Token yang tidak menerjemahkan ke apa pun (tempatnya dihapus dari
         kamus). Dibiarkan TANPA penyaring akan menghasilkan daftar yang
         mengabaikan kriteria diam-diam — jauh lebih menyesatkan daripada nol
         hasil, karena agent mengira asetnya memang dekat. */
      dan.push({ id_property: { in: [] } });
    }
  }

  /* `kecuali` MENYATU dengan penyaring id yang mungkin sudah dipasang cabang
     "dekat X" di atas, bukan menimpanya. Versi sebelumnya menugaskan ulang
     `where.id_property`, dan itu menghapus gerbang `{ in: [] }` yang menandai
     "patokan tempatnya tidak bisa diterjemahkan" — sehingga preferensi dengan
     patokan yatim diam-diam mengabaikan patokannya, TAPI hanya untuk klien yang
     pernah dikirimi sesuatu. Bug yang berbeda perilakunya per klien adalah bug
     yang tidak pernah bisa direproduksi.

     Penyatuannya lewat `dan`, bukan dengan membaca-lalu-menulis ulang
     `where.id_property`: keduanya memperbaiki bug yang sama, tapi array `AND`
     sudah menampung gerbang budget, luas, dan bentuk — menaruh gerbang keempat
     di sana berarti tidak ada yang perlu tahu urutan penulisannya. Yang
     membaca-lalu-menulis hanya benar selama cabang di atasnya kebetulan
     dijalankan lebih dulu. */
  if (kecuali.length) dan.push({ id_property: { notIn: kecuali } });

  /* ── LOKASI DISARING DI TINGKAT YANG MENGIKAT ───────────────────────────
     Versi lama hanya menyaring KOTA di SQL, dan menyerahkan kecamatan serta
     kelurahan sepenuhnya ke tahap kedua. Alasannya masuk akal — di tingkat
     itulah ejaan paling beragam — tapi akibatnya fatal dan senyap:

     Kalau yang mengikat adalah kecamatan sementara kotanya kosong, SQL tidak
     menyaring lokasi SAMA SEKALI. Ia menarik 600 baris TERBARU dari 78 ribu
     rumah yang tersedia, lalu JavaScript menyaringnya jadi "Tandes". Diuji
     pada database ini: ada 20 rumah di Tandes dalam rentang harga itu, dan
     NOL di antaranya berada di dalam 600 baris terbaru. Agent melihat 2 aset
     di layar preferensi sementara pencarian biasa menemukan 23 — tanpa satu
     pun galat, karena secara teknis semuanya "berhasil".

     Sekarang tingkat yang MENGIKAT itulah yang disaring, dengan teknik yang
     sama persis yang sudah dipakai kota: `contains` atas inti namanya. Itu
     tetap superset yang aman — "Wiyung" ikut menarik "Wiyung Utara" — karena
     yang MEMUTUSKAN tetap `lolosKetat()` dengan perbandingan ternormalisasi
     di tahap kedua. Yang berubah cuma satu: kolamnya kini berisi kandidat
     yang relevan, bukan yang kebetulan terbaru. */
  if (longgar !== "lokasi") {
    const lok = tingkatLokasi(k);
    const inti = teksCari(lok.nilai);
    /* Istilah sangat pendek dilewati: `contains` dua huruf menarik terlalu
       banyak yang tidak relevan dan tidak menghemat apa pun. */
    if (inti.length >= 3) {
      const cocok = { contains: inti, mode: "insensitive" as const };
      if (lok.tingkat === "kelurahan") where.kelurahan = cocok;
      else if (lok.tingkat === "kecamatan") where.kecamatan = cocok;
      else if (lok.tingkat === "kota") where.kota = cocok;
      else if (lok.tingkat === "provinsi") where.provinsi = cocok;
    }
  }

  /* Budget disaring di SQL karena angka tidak punya masalah ejaan — TAPI
     baris ber-harga_efektif NULL sengaja diloloskan; tahap kedua menghitung
     harganya lewat jalur cadangan. Tanpa cabang OR ini, listing lama akan
     lenyap dari seluruh rekomendasi tanpa satu pun pesan galat. */
  const bmin = angka(k.budget_min);
  const bmaxAsli = angka(k.budget_max);
  const bmax = longgar === "budget" && bmaxAsli ? bmaxAsli * 1.1 : bmaxAsli;
  if (bmin !== null || bmax !== null) {
    dan.push({
      OR: [
        {
          harga_efektif: {
            ...(bmin !== null ? { gte: new Prisma.Decimal(bmin) } : {}),
            ...(bmax !== null ? { lte: new Prisma.Decimal(bmax) } : {}),
          },
        },
        { harga_efektif: null },
      ],
    });
  }

  /* ── LUAS DISARING DI SQL, BUKAN CUMA DI JAVASCRIPT ─────────────────────
     Dulu luas sepenuhnya diserahkan ke tahap kedua, dan itu bug yang sama
     bentuknya dengan bug lokasi di atas — hanya lebih sulit dilihat.

     Kolamnya dibatasi (KOLAM = 1.200 baris, dan panel "Siap dikirim" bahkan
     memakai 80) dan diurutkan menurut TANGGAL, bukan menurut luas. Untuk
     kriteria seperti "gudang di Jawa Timur minimal 500 m²", 1.200 baris
     TERBARU bisa saja hampir seluruhnya berluas kecil: aset yang benar
     tersaring keluar sebelum sempat dinilai, dan agent melihat sepuluh hasil
     padahal ada ratusan. Tidak ada galat, tidak ada tanda.

     Ditulis sebagai OR agar tetap SUPERSET yang aman dari `luasMengikat()`:
     cabang kedua menangkap baris yang kolom utamanya kosong sehingga
     cadangannya yang berlaku. Keputusan akhirnya tetap di `lolosKetat()`. */
  const lmin = longgar === "luas" ? null : angka(k.luas_min);
  const lmax = longgar === "luas" ? null : angka(k.luas_max);
  if (lmin !== null || lmax !== null) {
    const rentang = {
      ...(lmin !== null ? { gte: new Prisma.Decimal(lmin) } : {}),
      ...(lmax !== null ? { lte: new Prisma.Decimal(lmax) } : {}),
    };
    const utama = k.tipe_properti === "APARTEMEN" ? "luas_bangunan" : "luas_tanah";
    const cadangan = utama === "luas_bangunan" ? "luas_tanah" : "luas_bangunan";
    const cocok = (kolom: string): Prisma.ListingWhereInput => ({ [kolom]: rentang });
    const takBerangka = (kolom: string): Prisma.ListingWhereInput => ({
      OR: [{ [kolom]: null }, { [kolom]: { lte: new Prisma.Decimal(0) } }],
    });
    dan.push(
      k.tipe_properti === "TANAH"
        // Tanah tidak punya bangunan — tidak ada cadangan yang masuk akal.
        ? cocok("luas_tanah")
        : { OR: [cocok(utama), { AND: [takBerangka(utama), cocok(cadangan)] }] },
    );
  }

  if (dan.length) where.AND = dan;

  return where;
}

/** TAHAP 2 — keputusan sebenarnya, di JavaScript.
 *  Di sinilah lokasi dinormalisasi dan luas diperlakukan sesuai kategori. */
export function lolosKetat(l: ListingRingkas & {
  kota?: string | null; kecamatan?: string | null; kelurahan?: string | null; provinsi?: string | null;
  jenis_transaksi?: string; nilai_limit_lelang?: Prisma.Decimal | null;
}, k: KriteriaMatch, opsi: OpsiMatch = {}): boolean {
  const { longgar = null } = opsi;

  // ── Lokasi: hanya tingkat TERDALAM yang diisi yang mengikat ──
  if (longgar !== "lokasi") {
    const kel = normLok(k.loc_kelurahan);
    const kec = normLok(k.loc_kecamatan);
    const kot = normLok(k.loc_kota);
    const prov = normLok(k.loc_provinsi);
    if (kel) { if (normLok(l.kelurahan) !== kel) return false; }
    else if (kec) { if (normLok(l.kecamatan) !== kec) return false; }
    else if (kot) { if (normLok(l.kota) !== kot) return false; }
    else if (prov) { if (normLok(l.provinsi) !== prov) return false; }
  }

  // ── Budget ──
  const harga = hargaEfektif(l);
  const bmin = angka(k.budget_min);
  const bmaxAsli = angka(k.budget_max);
  const bmax = longgar === "budget" && bmaxAsli ? bmaxAsli * 1.1 : bmaxAsli;
  if (bmin !== null && harga < bmin) return false;
  if (bmax !== null && harga > bmax) return false;

  // ── Luas ──
  if (longgar !== "luas") {
    const lmin = angka(k.luas_min);
    const lmax = angka(k.luas_max);
    if (lmin !== null || lmax !== null) {
      /* SATU angka yang mengikat, dipilih menurut tipe — bukan "salah satu
         dari dua dimensi boleh masuk". Aturan lama meloloskan rumah LT 72
         untuk klien yang minta minimal 80 m² tanah, lewat luas BANGUNANnya;
         pada gudang & pabrik selisihnya jadi LT 100 melawan syarat 500 m².
         Lihat catatan panjang di luasMengikat(). */
      const v = luasMengikat(l, k.tipe_properti);
      if (!(v > 0)) return false;
      if (lmin !== null && v < lmin) return false;
      if (lmax !== null && v > lmax) return false;
    }
  }

  return true;
}

/* Kolam maksimum yang ditarik ke memori sebelum penyaringan ketat. Tanpa
   batas ini, satu preferensi selebar "rumah di Jawa Timur" menyeret puluhan
   ribu baris hanya untuk menampilkan dua puluh.

   Batas ini jauh lebih jinak sejak lokasi disaring di tingkat yang mengikat:
   dulu ia memotong 78 ribu baris jadi 600 yang kebetulan terbaru — sekarang ia
   memotong kandidat yang memang sudah relevan. Dinaikkan ke 1.200 supaya
   preferensi selebar satu kota pun jarang menyentuhnya. */
const KOLAM = 1200;

export type HasilCocok<T> = { item: T; skor: number; alasan: string[] };

/** Pencarian lengkap dua tahap. INI yang dipakai semua pemanggil — endpoint
 *  match maupun cron. Tidak ada yang boleh memakai whereKasar() sendirian:
 *  hasilnya adalah superset yang belum tersaring. */
export async function cariCocok<T extends Parameters<typeof lolosKetat>[0]>(
  prisma: PrismaClient,
  k: KriteriaMatch,
  opsi: OpsiMatch & { select?: any; tambahanWhere?: Prisma.ListingWhereInput; maks?: number } = {},
): Promise<T[]> {
  /* Digabung lewat `AND`, BUKAN dengan menyebar dua objek jadi satu.
     `whereKasar()` memakai `AND` untuk menampung gerbang-gerbang ber-OR
     (budget, luas, bentuk), dan penyebaran objek akan MENIMPA seluruh isinya
     begitu `tambahanWhere` kebetulan juga punya `AND` — plafon harga, batas
     luas, dan syarat bentuk hilang sekaligus, tanpa satu pun galat. */
  const tambahan = opsi.tambahanWhere;
  const where: Prisma.ListingWhereInput = tambahan
    ? { AND: [whereKasar(k, opsi), tambahan] }
    : whereKasar(k, opsi);
  const kolam = (await prisma.listing.findMany({
    where,
    take: Math.min(opsi.maks ?? KOLAM, KOLAM),
    orderBy: [{ is_hot_deal: "desc" }, { tanggal_dibuat: "desc" }],
    ...(opsi.select ? { select: opsi.select } : {}),
  })) as unknown as T[];

  /* Dibuang di SINI, bukan di tiap pemanggil. Tiga permukaan memakai fungsi
     ini — layar Asisten Aset, panel ringkasan, dan cron email — dan kembaran
     yang lolos di salah satunya akan terbaca sebagai kerusakan di situ saja,
     lalu dikejar sebagai bug yang berbeda. */
  return buangKembar(kolam.filter(l => lolosKetat(l, k, opsi)) as any) as unknown as T[];
}

/** SELURUH gerbang, dijalankan di JavaScript — tanpa satu pun query.
 *
 *  Ini pasangan lengkap dari `whereKasar()` + `lolosKetat()`: yang pertama
 *  menyempitkan di SQL, yang kedua memutuskan. Fungsi ini melakukan keduanya
 *  di memori, dan keberadaannya membalik arah pencocokan.
 *
 *  ── KENAPA ARAHNYA DIBALIK ───────────────────────────────────────────────
 *  Cara lama bertanya, untuk SETIAP preferensi: "listing mana yang cocok?" —
 *  satu query per preferensi, masing-masing menarik sampai 600 baris. Dengan
 *  500 klien × 3 kriteria, itu 1.500 query terhadap tabel 120 ribu baris,
 *  setiap dua jam. Biayanya tumbuh mengikuti jumlah KLIEN, padahal yang
 *  benar-benar berubah tiap putaran cuma segelintir listing baru.
 *
 *  Cara ini bertanya sebaliknya: "listing baru ini cocok dengan preferensi
 *  siapa saja?" Preferensi dimuat SEKALI (barisnya kecil dan sedikit), lalu
 *  tiap listing baru diadu dengannya di memori. Seratus listing baru × 1.500
 *  preferensi = 150 ribu perbandingan JavaScript — hitungan mikrodetik — dan
 *  hanya DUA query untuk seluruh putaran.
 *
 *  Konsekuensi yang harus dijaga: fungsi ini WAJIB memutuskan sama persis
 *  dengan jalur SQL. Kalau salah satunya berubah sendirian, cron dan layar CRM
 *  akan memberi jawaban berbeda untuk klien yang sama — dan tidak ada yang
 *  akan tahu sampai seorang agent mengirim aset yang tidak diminta.
 */
export function lolosSemuaGerbang(
  l: ListingRingkas & {
    status_tayang?: string;
    bukan_properti?: boolean;
    ada_bangunan?: boolean | null;
    legalitas?: string | null;
    alamat_lengkap?: string | null;
    tempatDekat?: { id_tempat: bigint; jarak_meter: number; presisi: string }[];
    kategori?: string;
    jenis_transaksi?: string;
    kota?: string | null; kecamatan?: string | null; kelurahan?: string | null; provinsi?: string | null;
    nilai_limit_lelang?: Prisma.Decimal | null;
  },
  k: KriteriaMatch,
): boolean {
  // Gerbang 1 — tersedia. Aset yang tidak tersedia bukan rekomendasi, ia kabar buruk.
  if (l.status_tayang !== undefined && l.status_tayang !== "TERSEDIA") return false;
  // Gerbang 2 — bukan properti. Mendahului kategori, karena justru kategori
  // yang tidak bisa dipercaya pada data lelang (lihat whereKasar).
  if (l.bukan_properti === true) return false;
  // Gerbang 3 — kategori persis, dilewati bila kriteria tidak menyebut tipe.
  if (k.tipe_properti && l.kategori !== undefined && l.kategori !== k.tipe_properti) return false;
  // Gerbang 4 — maksud. BELI tidak pernah melihat listing SEWA.
  if (
    l.jenis_transaksi !== undefined &&
    !transaksiUntuk(k.maksud, k.jenis_transaksi).includes(l.jenis_transaksi as jenis_transaksi_enum)
  ) return false;
  /* Gerbang 4a — BENTUK ASET. Kembaran gerbang `ada_bangunan` di whereKasar.
     Sama seperti gerbang di atasnya, ia hanya menghakimi bila kolomnya ikut
     ter-select; kolom yang tidak diambil TIDAK boleh diam-diam meloloskan
     baris, jadi pemanggil wajib memasukkan `ada_bangunan` ke select-nya
     (lihat SELECT_ASET_BARU di cron). NULL = tidak diketahui = lolos. */
  const bentuk = bentukDiminta(k.tipe_properti);
  if (
    bentuk !== null &&
    (l as any).ada_bangunan !== undefined &&
    (l as any).ada_bangunan !== null &&
    (l as any).ada_bangunan !== bentuk
  ) return false;

  // Gerbang 4b — patokan teks alamat.
  const teksAlamat = (k.alamat_teks || "").trim().toLowerCase();
  if (teksAlamat.length >= 3) {
    const punya = ((l as any).alamat_lengkap || "").toLowerCase();
    if (!punya.includes(teksAlamat)) return false;
  }

  // Gerbang 5 — legalitas, bila diminta.
  if (k.legalitas && (l as any).legalitas !== k.legalitas) return false;

  /* Gerbang 5b — "dekat X". Butuh relasi `tempatDekat` ikut ter-select; kalau
     tidak ada, kriteria ini TIDAK bisa dinilai di memori. Yang dilakukan:
     menolak, bukan meloloskan. Meloloskan berarti mengirim aset yang belum
     tentu dekat ke klien yang secara tegas memintanya dekat — dan agent tidak
     punya cara tahu. Pemanggil yang butuh gerbang ini wajib ikut mengambil
     relasinya (lihat SELECT_ASET_BARU di cron). */
  if (k.dekat) {
    const rel = (l as any).tempatDekat as { id_tempat: bigint; jarak_meter: number; presisi: string }[] | undefined;
    if (!Array.isArray(rel)) return false;
    const d = k.dekat;
    const cocok = rel.some(r =>
      r.jarak_meter <= d.radius
      && PRESISI_LAYAK.includes(r.presisi)
      && (d.ids.length === 0 || d.ids.some(i => i === r.id_tempat)),
    );
    if (!cocok) return false;
  }
  // Gerbang 6–8 — lokasi, budget, luas.
  return lolosKetat(l, k);
}

/* ── ASET KEMBAR ───────────────────────────────────────────────────────────
   Satu properti fisik bisa punya BEBERAPA baris listing. Bukan kesalahan
   scraper: lelang yang tidak laku DILELANG ULANG, dan tiap penjadwalan adalah
   lot baru di lelang.go.id dengan id, tanggal, foto, dan teks alamat yang
   berbeda. Di database ini ada 9.048 kelompok seperti itu — 12.681 baris
   berlebih, sekitar 10% dari seluruh persediaan.

   Yang dilihat agent: dua kartu identik berturut-turut, harga sama persis,
   foto rumah yang sama. Ia akan menyimpulkan pencariannya bermasalah — dan
   kalau tidak sadar, ia mengirim rumah yang sama dua kali ke satu klien. */

/** Sidik satu aset FISIK.
 *
 *  Foto sengaja TIDAK dipakai meski terasa paling meyakinkan: lelang ulang
 *  mengunggah ulang fotonya, jadi berkasnya berbeda untuk rumah yang sama —
 *  sudah diperiksa pada pasangan nyata di database ini.
 *
 *  Yang dipakai: kategori, kedua luas, harga efektif, kelurahan, dan kota.
 *  Harga yang sama SAMPAI RUPIAH pada luas dan kelurahan yang sama praktis
 *  tidak mungkin kebetulan.
 *
 *  Mengembalikan null bila datanya tidak cukup untuk menyimpulkan apa pun —
 *  dan pemanggil memperlakukan null sebagai "unik". Menebak dengan data
 *  setengah berarti menggabungkan aset yang berbeda, dan aset yang HILANG dari
 *  daftar jauh lebih merugikan daripada satu kembaran yang lolos. */
export function sidikAset(l: {
  id_property: bigint;
  kategori?: string;
  luas_tanah?: Prisma.Decimal | null;
  luas_bangunan?: Prisma.Decimal | null;
  harga_efektif?: Prisma.Decimal | null;
  harga?: Prisma.Decimal | number;
  kelurahan?: string | null;
  kota?: string | null;
}): string | null {
  if (l.kategori === undefined || l.kota === undefined) return null;
  const harga = l.harga_efektif != null ? Number(l.harga_efektif) : Number(l.harga ?? 0);
  if (!harga) return null;
  const lt = l.luas_tanah ? Number(l.luas_tanah) : 0;
  const lb = l.luas_bangunan ? Number(l.luas_bangunan) : 0;
  if (lt === 0 && lb === 0) return null;
  return [l.kategori, lt, lb, harga, normLok(l.kelurahan), normLok(l.kota)].join("|");
}

/** Dari tiap kelompok kembar, sisakan SATU — yang paling berguna hari ini.
 *
 *  Urutan pemilihannya bukan selera:
 *    1. lelang yang tanggalnya BELUM lewat mengalahkan yang sudah — hanya itu
 *       yang benar-benar bisa diikuti klien;
 *    2. di antara sesama, tanggal lelang TERBARU menang (penjadwalan ulang
 *       terakhir adalah yang berlaku);
 *    3. lalu yang fotonya lebih banyak — itu yang bisa ditawarkan lewat WhatsApp;
 *    4. terakhir id terbesar, semata supaya hasilnya tetap sama tiap kali
 *       dijalankan. Tanpa pemecah seri yang tegas, daftar akan berubah-ubah
 *       sendiri antar pemuatan dan terbaca seperti kerusakan. */
export function buangKembar<T extends Parameters<typeof sidikAset>[0] & {
  tanggal_lelang?: Date | null; gambar?: string | null;
}>(daftar: T[]): T[] {
  const sekarang = Date.now();
  const nilai = (l: T): [number, number, number, number] => [
    l.tanggal_lelang && l.tanggal_lelang.getTime() >= sekarang ? 1 : 0,
    l.tanggal_lelang ? l.tanggal_lelang.getTime() : 0,
    (l.gambar || "").split(",").filter(x => x.trim()).length,
    Number(l.id_property),
  ];
  const terbaik = new Map<string, T>();
  const unik: T[] = [];

  for (const l of daftar) {
    const sidik = sidikAset(l);
    if (!sidik) { unik.push(l); continue; }
    const ada = terbaik.get(sidik);
    if (!ada) { terbaik.set(sidik, l); continue; }
    const a = nilai(l), b = nilai(ada);
    for (let i = 0; i < a.length; i++) {
      if (a[i] === b[i]) continue;
      if (a[i] > b[i]) terbaik.set(sidik, l);
      break;
    }
  }
  return [...unik, ...terbaik.values()];
}

/* ── Peringkat ─────────────────────────────────────────────────────────────
   Semua hasil sudah lolos gerbang yang sama, jadi peringkat TIDAK mengukur
   "seberapa cocok" — semuanya cocok. Yang diukur: mana yang paling layak
   dikirim lebih dulu. Urutannya sengaja mendahulukan hal-hal yang menentukan
   apakah sebuah aset bisa ditawarkan sama sekali. */

export type ListingRingkas = {
  id_property: bigint;
  jenis_transaksi?: string;
  tanggal_lelang?: Date | null;
  gambar: string | null;
  harga_efektif: Prisma.Decimal | null;
  harga: Prisma.Decimal;
  harga_promo: Prisma.Decimal | null;
  luas_tanah: Prisma.Decimal | null;
  luas_bangunan: Prisma.Decimal | null;
  kamar_tidur: number | null;
  is_hot_deal: boolean;
  tanggal_dibuat: Date | null;
};

const HARI_MS = 86_400_000;

export function skorListing(l: ListingRingkas, k: KriteriaMatch): number {
  let skor = 0;

  // 40 — ADA FOTO. Bobot terbesar dan bukan karena estetika: aset tanpa foto
  // praktis tidak bisa ditawarkan lewat WhatsApp, jadi ia selalu kalah dari
  // aset apa pun yang punya foto.
  const jumlahFoto = (l.gambar || "").split(",").map(s => s.trim()).filter(Boolean).length;
  if (jumlahFoto > 0) skor += 30;
  if (jumlahFoto >= 3) skor += 10;

  // 20 — KECOCOKAN ANGGARAN, berbentuk KURVA, bukan garis lurus.
  //
  // Versi pertama memberi nilai "makin murah makin bagus" secara linear, dan
  // itu keliru dengan cara yang mahal: aset seharga 1% plafon klien meraih
  // nilai penuh. Digabung dengan data lelang yang kotor, hasilnya sepeda motor
  // Rp 16 jt mencetak skor 59 — MENGALAHKAN rumah sungguhan di kota yang sama.
  // Barang termurah selalu naik ke puncak daftar, persis tempat agent melihat.
  //
  // Yang sebenarnya dicari agent bukan "semurah mungkin", melainkan "masuk
  // anggaran, dengan ruang tawar yang nyata". Aset di 60% plafon adalah kabar
  // baik; aset di 5% plafon hampir selalu berarti salah satu dari dua hal —
  // barangnya bukan yang dibayangkan klien, atau anggarannya salah tercatat.
  //
  // Pita terbawah tetap diberi nilai kecil, bukan nol, dan itu disengaja:
  // di pasar lelang Jawa Timur ADA rumah asli seharga Rp 40 jt terhadap plafon
  // Rp 250 jt (rasio 0,16). Menyaringnya keras akan membuang persediaan yang
  // benar-benar ada; menurunkan peringkatnya sudah cukup, karena aset seperti
  // itu tetap unggul lewat foto dan kelengkapan datanya.
  const bmax = angka(k.budget_max);
  const harga = Number(l.harga_efektif ?? l.harga);
  if (bmax && harga > 0) {
    const rasio = harga / bmax;
    skor +=
      rasio >= 0.85 ? 12 :  // pas plafon — ruang tawarnya tipis
      rasio >= 0.55 ? 20 :  // titik terbaik: masuk anggaran + ruang nego nyata
      rasio >= 0.35 ? 14 :
      rasio >= 0.20 ? 7  :
                      2;    // curiga: biasanya kelas aset yang berbeda
  }

  // 15 — KESEGARAN. Aset yang baru masuk adalah kabar yang benar-benar baru
  // bagi klien; yang sudah setahun menganggur sudah pernah dilihat orang.
  if (l.tanggal_dibuat) {
    const umurHari = (Date.now() - l.tanggal_dibuat.getTime()) / HARI_MS;
    if (umurHari <= 7) skor += 15;
    else if (umurHari <= 30) skor += 10;
    else if (umurHari <= 90) skor += 5;
  }

  // 10 — KELENGKAPAN DATA. Klien selalu menanyakan luas dan kamar; aset yang
  // datanya kosong memaksa agent menelepon rekan dulu sebelum bisa menjawab.
  // Luas diberi bobot lebih besar daripada kamar karena ia sekaligus sinyal
  // terkuat bahwa barisnya memang properti — lot lelang yang bukan properti
  // hampir selalu datang tanpa luas sama sekali.
  if (l.luas_tanah || l.luas_bangunan) skor += 6;
  if (l.kamar_tidur) skor += 4;

  // −25 — LELANG YANG TANGGALNYA SUDAH LEWAT.
  // Aset seperti ini tidak bisa diikuti klien: jadwalnya sudah berlalu, dan
  // yang tersisa hanyalah catatan. Mengirimkannya membuat agent terlihat tidak
  // memeriksa apa yang ia kirim.
  //
  // Diturunkan peringkatnya, BUKAN disaring — dan itu keputusan yang berat:
  // di database ini 120.359 dari 120.387 lelang sudah lewat tanggalnya, jadi
  // menyaringnya keras akan menyisakan 27 aset dan mematikan seluruh fitur.
  // Akar masalahnya ada di kesegaran data lelang, bukan di mesin ini; yang bisa
  // dilakukan mesin adalah menaruhnya di urutan bawah dan MENGATAKANNYA lewat
  // alasanCocok(), supaya agent tidak pernah mengirimnya tanpa sadar.
  if (String(l.jenis_transaksi).toUpperCase() === "LELANG" && l.tanggal_lelang) {
    if (l.tanggal_lelang.getTime() < Date.now()) skor -= 25;
  }

  // 10 — diskon sah & penanda hot deal.
  if (l.harga_promo && Number(l.harga_promo) < Number(l.harga)) skor += 6;
  if (l.is_hot_deal) skor += 4;

  return skor;
}

/** Kalimat "kenapa aset ini muncul", untuk ditampilkan apa adanya di UI.
 *  Rekomendasi tanpa alasan menuntut kepercayaan buta; agent yang tidak tahu
 *  kenapa sesuatu muncul akan berhenti memakainya setelah satu hasil aneh. */
export function alasanCocok(l: ListingRingkas, k: KriteriaMatch): string[] {
  const out: string[] = [];
  const lok = tingkatLokasi(k);
  if (lok.nilai) {
    /* "Kelurahan Manukan Kulon", bukan "kelurahan Manukan Kulon". Chip ini
       berdiri sendiri di kartu, jadi ia awal kalimat — huruf kecil di situ
       terbaca seperti kelalaian, bukan gaya. */
    const awalan = lok.tingkat === "kota" || lok.tingkat === "bebas"
      ? ""
      : lok.tingkat.charAt(0).toUpperCase() + lok.tingkat.slice(1) + " ";
    out.push(`${awalan}${lok.nilai}`.trim());
  }

  const bmax = angka(k.budget_max);
  const harga = Number(l.harga_efektif ?? l.harga);
  if (bmax && harga > 0 && harga <= bmax) {
    const selisih = bmax - harga;
    if (selisih > 0) out.push(`${ringkasRupiah(selisih)} di bawah plafon`);
    else out.push("pas di plafon");
  }

  if (l.tanggal_dibuat) {
    const umur = Math.floor((Date.now() - l.tanggal_dibuat.getTime()) / HARI_MS);
    if (umur <= 7) out.push(umur <= 1 ? "baru masuk hari ini" : `baru masuk ${umur} hari lalu`);
  }
  /* Peringatan didahulukan — ditaruh di depan supaya terbaca lebih dulu
     daripada "Rp 149 jt di bawah plafon" yang terdengar seperti kabar baik
     padahal asetnya sudah tidak bisa diikuti. */
  if (String(l.jenis_transaksi).toUpperCase() === "LELANG" && l.tanggal_lelang) {
    const selisih = Math.floor((Date.now() - l.tanggal_lelang.getTime()) / HARI_MS);
    if (selisih > 0) {
      out.unshift(
        selisih < 30 ? `⚠ lelang lewat ${selisih} hari lalu`
        : selisih < 365 ? `⚠ lelang lewat ${Math.floor(selisih / 30)} bulan lalu`
        : "⚠ lelang lewat > 1 tahun",
      );
    }
  }

  if (l.harga_promo && Number(l.harga_promo) < Number(l.harga)) out.push("sedang diskon");
  return out;
}

function ringkasRupiah(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `Rp ${(n / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(".", ",")} M`;
  if (a >= 1e6) return `Rp ${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".", ",")} jt`;
  if (a >= 1e3) return `Rp ${Math.round(n / 1e3).toLocaleString("id-ID")} rb`;
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

/* ── Diagnosa hasil kosong ─────────────────────────────────────────────────
   Ini bayaran atas keputusan mencocokkan secara ketat. Layar kosong tanpa
   penjelasan membuat agent menyimpulkan "fiturnya rusak"; layar kosong yang
   memberi tahu gerbang mana yang menghalangi membuatnya membuka preferensi
   dan memperbaikinya. Tiga hitungan murah, hanya dijalankan saat nol hasil. */

export type Diagnosa = {
  totalTanpaFilterLunak: number;
  jikaBudgetNaik10: number;
  jikaLokasiDiperluas: number;
  jikaLuasDiabaikan: number;
  /** Berapa yang muncul kalau syarat BENTUK aset (tanah kosong vs terbangun)
   *  dilepas. Tanpa angka ini, klien yang mencari TANAH bisa melihat layar
   *  kosong sementara ada 40 lot "tanah berikut bangunan" di daerah itu —
   *  dan tidak ada satu pun petunjuk bahwa itulah yang menahannya. */
  jikaBentukDiabaikan: number;
  tingkatLokasi: TingkatLokasi;
  adaBudget: boolean;
  adaLuas: boolean;
  adaBentuk: boolean;
};

export async function diagnosaKosong(
  prisma: PrismaClient,
  k: KriteriaMatch,
  opsi: OpsiMatch = {},
): Promise<Diagnosa> {
  const dasar: Prisma.ListingWhereInput = {
    status_tayang: "TERSEDIA",
    /* Gerbang yang sama dengan whereKasar(). Kalau diagnosa memakai kolam yang
       lebih longgar, ia akan menjanjikan "12 aset kalau lokasi diperluas" yang
       sebagiannya sepeda motor — saran yang bohong lebih buruk daripada tidak
       ada saran sama sekali. */
    bukan_properti: false,
    ...(k.legalitas ? { legalitas: k.legalitas } : {}),
    ...(k.tipe_properti ? { kategori: k.tipe_properti } : {}),
    jenis_transaksi: { in: transaksiUntuk(k.maksud, k.jenis_transaksi) },
    ...(opsi.kecuali?.length ? { id_property: { notIn: opsi.kecuali } } : {}),
    /* Gerbang bentuk ikut, alasan yang sama: kolam dasar yang lebih longgar
       daripada jalur sungguhan membuat seluruh angka diagnosa membesar. */
    ...(bentukDiminta(k.tipe_properti) !== null
      ? { OR: [{ ada_bangunan: bentukDiminta(k.tipe_properti) }, { ada_bangunan: null }] }
      : {}),
  };

  const adaBudget = angka(k.budget_max) !== null || angka(k.budget_min) !== null;
  const adaLuas = angka(k.luas_min) !== null || angka(k.luas_max) !== null;
  const adaBentuk = bentukDiminta(k.tipe_properti) !== null;
  const lok = tingkatLokasi(k);

  /* Tiap pelonggaran dijalankan lewat cariCocok() yang sama, bukan lewat
     COUNT di SQL: hitungan yang tidak melewati penyaringan ketat akan
     menjanjikan "4 aset kalau plafon dinaikkan" padahal setelah normalisasi
     lokasi hasilnya nol — dan saran yang bohong lebih buruk daripada tidak
     ada saran. */
  const [total, budget, lokasi, luas, bentuk] = await Promise.all([
    prisma.listing.count({ where: dasar }),
    adaBudget ? cariCocok(prisma, k, { ...opsi, longgar: "budget" }).then(r => r.length) : Promise.resolve(0),
    lok.nilai ? cariCocok(prisma, k, { ...opsi, longgar: "lokasi" }).then(r => r.length) : Promise.resolve(0),
    adaLuas ? cariCocok(prisma, k, { ...opsi, longgar: "luas" }).then(r => r.length) : Promise.resolve(0),
    adaBentuk ? cariCocok(prisma, k, { ...opsi, longgar: "bentuk" }).then(r => r.length) : Promise.resolve(0),
  ]);

  return {
    totalTanpaFilterLunak: total,
    jikaBudgetNaik10: budget,
    jikaLokasiDiperluas: lokasi,
    jikaLuasDiabaikan: luas,
    jikaBentukDiabaikan: bentuk,
    tingkatLokasi: lok.tingkat,
    adaBudget,
    adaLuas,
    adaBentuk,
  };
}

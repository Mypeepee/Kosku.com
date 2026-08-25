// src/app/api/cron/rekomendasi-klien/route.ts
// ---------------------------------------------------------------------------
// ASISTEN PREFERENSI KLIEN — cron
//
// Tiga pekerjaan, dipisahkan karena harganya sangat berbeda:
//
//   ?jenis=perubahan  (MURAH — dijadwalkan tiap 15 menit)
//     Memindai aset yang SUDAH dikirim ke klien dan membandingkannya dengan
//     harga yang terakhir diketahui klien. Satu JOIN, tanpa satu pun aturan
//     pencocokan — ia hanya membandingkan angka.
//
//   ?jenis=asetbaru   (SEDANG — dijadwalkan tiap 2 jam, jam kerja)
//     DUA pemindai, hasilnya digabung jadi SATU email per agent:
//
//     (a) PEMINDAI TERBALIK — listing yang belum diproses (menurut tanda air,
//         bukan jendela geser) diadu dengan SELURUH preferensi di memori.
//         Arahnya sengaja dibalik: bertanya "listing baru ini cocok dengan
//         preferensi siapa?" berbiaya dua query untuk seluruh putaran, apa pun
//         jumlah kliennya. Arah sebaliknya berbiaya satu query PER preferensi
//         — 1.500 query tiap dua jam pada 500 klien.
//
//     (b) KRITERIA BARU — preferensi yang belum pernah diadu dengan persediaan
//         yang SUDAH ADA (terakhir_dipindai IS NULL). Tanpa ini, klien yang
//         kriterianya dibuat hari ini tidak akan pernah dikabari soal 100 aset
//         cocok yang sudah lama ada di database — karena aset itu tidak baru,
//         dan tidak akan pernah jadi baru lagi.
//
//   ?jenis=harian     (MAHAL — sekali sehari, pagi)
//     (a) Aset baru (sama dengan di atas).
//     (b) Klien yang terlalu lama tidak disentuh.
//     Bagian (a) menjalankan satu query per preferensi supaya aturannya tetap
//     dibaca dari src/lib/klienMatch.ts. Menyalin aturan itu ke SQL akan
//     membuat cron dan layar CRM perlahan memberi jawaban berbeda untuk klien
//     yang sama — bug yang tak seorang pun akan temukan sampai seorang agent
//     mengirim aset sewa kepada orang yang mau beli. Harga kebenarannya:
//     dibayar sekali sehari, bukan 96 kali.
//
//   ?jenis=semua      keduanya (dipakai saat uji coba)
//
// Otomatisasi: scheduler in-process di server.js. Bisa juga manual:
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//        "https://solusindoaset.com/api/cron/rekomendasi-klien?jenis=perubahan"
//
// Opsi:
//   ?dryRun=1            laporkan tanpa menulis apa pun
//   ?email=0             pindai & laporkan, tapi jangan menyentuh keadaan kirim
//   ?test=a@b.com        kirim SATU email contoh dari data nyata, lalu berhenti
//   ?diagnosa=1          jelaskan KENAPA tidak ada email (semua klien)
//   ?diagnosa=KL00002    idem, untuk satu klien
//   ?secret=XXX          alternatif header Authorization
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  cariCocok, skorListing, alasanCocok, hargaEfektif, lolosSemuaGerbang,
  type KriteriaMatch,
} from "@/lib/klienMatch";
import { ringkasGrup, kunciGrup, rapikanAlamat, saringAlasan } from "@/lib/klienRingkas";
import { siapkanDekat, dekatUntuk, type PrefDekat } from "@/lib/klienDekat";
import { muatPengecualian, gabung } from "@/lib/klienPengecualian";
import { urlListing, rupiah } from "@/lib/klienPesan";
import { buatTiket } from "@/lib/asistenToken";
import { sendAsistenAsetEmail, isMailConfigured, type AsistenAsetKlien } from "@/lib/mailer";
import { SITE_URL, URL_PUBLIK } from "@/lib/site";
import { siapkanFotoInline } from "@/lib/fotoListing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ── Ambang & rem ──────────────────────────────────────────────────────────
   Angka-angka di sini adalah selisih antara asisten dan pengganggu. */

/** Perubahan harga di bawah 1% tidak dilaporkan. Pembulatan, koreksi ketik,
 *  dan penyesuaian kecil bukan kabar — dan kabar yang bukan kabar adalah cara
 *  tercepat membuat agent berhenti membaca notifikasinya. */
const AMBANG_PERSEN = 1;

/** Lelang dianggap "dekat" pada H-3. Lebih pendek dari itu tidak menyisakan
 *  waktu menyiapkan uang jaminan, jadi pengingatnya sia-sia. */
const HARI_LELANG_DEKAT = 3;

/** Klien tanpa kontak selama ini dianggap didiamkan. */
const HARI_SEPI = 14;

/** Berapa klien terdiam yang diproses per putaran harian. Yang paling lama
 *  didiamkan dilayani lebih dulu, jadi batas ini menunda — bukan membuang. */
const MAKS_KLIEN_SEPI = 500;

/** Plafon tugas otomatis per agent per putaran. Asisten yang menaruh empat
 *  puluh tugas dalam satu pagi tidak membantu siapa pun; ia memindahkan
 *  pekerjaan memilah dari agent ke agent. */
const MAKS_TUGAS_PER_AGENT = 12;

/** Batas preferensi yang dimuat per putaran — rem pengaman supaya pertumbuhan
 *  data tidak diam-diam mengubah cron ini jadi beban berjam-jam. Barisnya kecil
 *  dan dimuat SEKALI per putaran (bukan sekali per listing), jadi batas ini
 *  sangat longgar dengan sengaja. Kalau tersentuh, jumlahnya dilaporkan di
 *  respons — batas yang tersentuh diam-diam adalah klien yang tidak pernah
 *  dipindai tanpa ada yang tahu. */
const MAKS_PREFERENSI = 5000;

/** Berapa listing yang diproses satu putaran. Sisanya menunggu putaran
 *  berikutnya — dan TIDAK hilang, karena tanda airnya cuma maju sampai baris
 *  terakhir yang benar-benar diproses. Impor borongan 50 ribu listing akan
 *  dicerna bertahap alih-alih menghabiskan memori dalam satu tarikan. */
const MAKS_LISTING_PER_PUTARAN = 2000;

/** Kriteria baru yang diadu dengan seluruh persediaan per putaran. Kecil,
 *  karena tiap satu berarti satu query penuh terhadap tabel 120 ribu baris —
 *  dan kriteria yang menunggu pemindaian pertama memang selalu sedikit. */
const MAKS_PREFERENSI_BARU = 40;

/** Berapa baris yang ditarik saat mengadu kriteria baru dengan persediaan lama.
 *  Yang dibutuhkan cuma beberapa aset TERBAIK untuk satu email; menarik enam
 *  ratus demi menampilkan tiga adalah biaya yang tidak pernah terbaca. */
const KOLAM_PREFERENSI_BARU = 120;

/** Berapa banyak query pencocokan berjalan bersamaan. Pool kecil dengan
 *  sengaja: cron ini berbagi kolam koneksi dengan lalu lintas pengguna, dan
 *  pekerjaan latar tidak pernah boleh memperlambat halaman yang sedang dibuka
 *  orang. */
const PARALEL = 6;

/** Berapa baris pantauan perubahan diproses per putaran. Diurutkan menurut
 *  kepentingan lebih dulu, jadi batas ini menunda kabar kecil — bukan
 *  membuangnya. */
const MAKS_PANTAU_PERUBAHAN = 2000;

/* ── Rem email ────────────────────────────────────────────────────────────
   Pemindaian aset baru berjalan tiap dua jam supaya kabarnya sampai selagi
   masih kabar. Email TIDAK boleh mengikuti irama itu: email tiap dua jam
   berhenti dibaca dalam tiga hari, dan sesudah itu tidak ada email apa pun
   yang berguna lagi. Angka-angka di bawah inilah yang memisahkan asisten dari
   pengganggu. Penegakannya di database — lihat prisma/migration_email_asisten.sql. */

/** Jarak minimum antar email untuk SATU agent, dalam jam. Enam → paling banyak
 *  dua email sehari di dalam jam kerja. */
const JEDA_EMAIL_JAM = 6;

/** Jam kirim (WIB). Di luar rentang ini kabarnya tetap masuk ke CRM dan daftar
 *  tugas — hanya emailnya yang menunggu pagi. */
const JAM_EMAIL_MULAI = 7;
const JAM_EMAIL_SELESAI = 21;

/** Berapa klien yang muat dalam satu email. Delapan sudah membuat email yang
 *  panjang; sisanya menunggu di CRM, yang memang tempat yang lebih baik untuk
 *  membaca daftar panjang. */
const MAKS_KLIEN_EMAIL = 8;

/** Aset yang DITAMPILKAN per klien di email — sekaligus yang akan tercatat
 *  bila tombol satu-ketukan ditekan. Tiga, sama dengan jumlah yang otomatis
 *  tercentang di layar Asisten Aset: agent yang mengetuk dari email dan agent
 *  yang mengetuk dari dashboard harus mengirim hal yang sama. */
const ASET_PER_KLIEN_EMAIL = 3;

/** Berapa foto yang ikut DI DALAM surat. Tiap foto ±11 KB sesudah dikecilkan,
 *  jadi dua belas ≈ 130 KB — masih ringan untuk kotak masuk mana pun, dan cukup
 *  untuk empat klien penuh. Sisanya jatuh ke tautan proxy, bukan hilang. */
const MAKS_FOTO_INLINE = 12;

const HARI_MS = 86_400_000;

/* ── Otorisasi ─────────────────────────────────────────────────────────── */

/** Hasil pemeriksaan izin. Alasannya dibawa keluar, bukan cuma boolean:
 *  versi lama mengembalikan `false` saat CRON_SECRET belum di-set, sehingga
 *  seluruh cron ini MATI TOTAL di lingkungan yang lupa mengisinya — dan
 *  matinya tanpa suara, karena scheduler cuma menerima 401 lalu diam. Yang
 *  terlihat: "kok tidak ada email sama sekali?", tanpa satu pun petunjuk. */
type Izin = { boleh: true } | { boleh: false; sebab: string };

function sahkan(req: NextRequest): Izin {
  const rahasia = process.env.CRON_SECRET;

  if (!rahasia) {
    /* Belum diatur. Di produksi ini menutup pintu — endpoint yang menulis ke
       database dan mengirim email tidak boleh terbuka untuk siapa saja. Di
       pengembangan justru dibuka, supaya menguji lokal tidak menuntut ritual
       tambahan. Dua-duanya BERSUARA: yang mematikan fitur diam-diam adalah
       kombinasi "tertutup" + "tanpa log". */
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[rekomendasi-klien] CRON_SECRET belum di-set — asisten klien TIDAK AKAN " +
        "berjalan sama sekali. Isi CRON_SECRET di environment lalu restart.",
      );
      return { boleh: false, sebab: "CRON_SECRET belum diatur di server" };
    }
    console.warn("[rekomendasi-klien] CRON_SECRET kosong — diizinkan karena mode pengembangan.");
    return { boleh: true };
  }

  const url = new URL(req.url);
  const dariQuery = url.searchParams.get("secret");
  const auth = req.headers.get("authorization") || "";
  const dariHeader = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

  if (dariQuery === rahasia || dariHeader === rahasia) return { boleh: true };

  /* Pesannya menyebut APA yang kurang, bukan cuma "ditolak". Penyebab paling
     sering bukan penyusup, melainkan `$CRON_SECRET` yang kosong di shell
     penguji — variabelnya ada di .env, tapi .env tidak otomatis masuk ke
     terminal. Menyebutkannya menghemat setengah jam menebak. */
  return {
    boleh: false,
    sebab: dariHeader || dariQuery
      ? "Secret tidak cocok"
      : "Secret tidak disertakan. Pakai ?secret=… atau header Authorization: Bearer …. " +
        "Kalau menguji dari terminal, ingat $CRON_SECRET tidak otomatis terisi dari .env " +
        "(jalankan `set -a; . ./.env; set +a` lebih dulu).",
  };
}

/* ── Baris mentah dari pemindaian perubahan ────────────────────────────── */

type BarisPantau = {
  id_kiriman: bigint;
  id_klien: string;
  id_agent: string;
  nama_klien: string;
  harga_diketahui: Prisma.Decimal;
  id_property: bigint;
  judul: string;
  harga_kini: Prisma.Decimal;
  status_tayang: string;
  jenis_transaksi: string;
  tanggal_lelang: Date | null;
};

type JenisPerubahan = "HARGA_TURUN" | "HARGA_NAIK" | "TERJUAL" | "DITARIK" | "LELANG_DEKAT";

/** Terjemahkan satu baris pantauan jadi kabar — atau tidak sama sekali.
 *  Urutannya penting: aset yang sudah laku tidak perlu dilaporkan turun harga. */
function bacaPerubahan(b: BarisPantau): { jenis: JenisPerubahan; persen: number } | null {
  if (b.status_tayang === "TERJUAL") return { jenis: "TERJUAL", persen: 0 };
  if (b.status_tayang === "TARIK_LISTING") return { jenis: "DITARIK", persen: 0 };

  const lama = Number(b.harga_diketahui);
  const kini = Number(b.harga_kini);
  if (lama > 0 && kini > 0) {
    const persen = ((kini - lama) / lama) * 100;
    if (Math.abs(persen) >= AMBANG_PERSEN) {
      return { jenis: persen < 0 ? "HARGA_TURUN" : "HARGA_NAIK", persen: Number(persen.toFixed(2)) };
    }
  }

  if (b.jenis_transaksi === "LELANG" && b.tanggal_lelang) {
    const sisa = (b.tanggal_lelang.getTime() - Date.now()) / HARI_MS;
    if (sisa >= 0 && sisa <= HARI_LELANG_DEKAT) return { jenis: "LELANG_DEKAT", persen: 0 };
  }
  return null;
}

function judulTugas(j: JenisPerubahan, nama: string, judulAset: string, persen: number): string {
  const aset = judulAset.length > 60 ? `${judulAset.slice(0, 57)}…` : judulAset;
  switch (j) {
    case "HARGA_TURUN":  return `Kabari ${nama}: harga ${aset} turun ${Math.abs(persen).toFixed(1).replace(".", ",")}%`;
    case "HARGA_NAIK":   return `Kabari ${nama}: harga ${aset} naik ${Math.abs(persen).toFixed(1).replace(".", ",")}%`;
    case "TERJUAL":      return `Kabari ${nama}: ${aset} sudah laku — siapkan gantinya`;
    case "DITARIK":      return `Kabari ${nama}: ${aset} ditarik pemiliknya`;
    case "LELANG_DEKAT": return `Ingatkan ${nama}: lelang ${aset} sudah dekat`;
  }
}

const tanggalKunci = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* ── 1. PEMINDAI PERUBAHAN ─────────────────────────────────────────────── */

async function pindaiPerubahan(dryRun: boolean) {
  /* Batas lelang dihitung di JavaScript, bukan dirangkai jadi interval di SQL.
     `${HARI_LELANG_DEKAT} || ' days'` terlihat wajar tapi ditolak Postgres:
     Prisma mengirim angka sebagai parameter bertipe integer, dan tidak ada
     operator `integer || text`. Melewatkan Date sebagai parameter menghindari
     seluruh persoalan tipe itu. */
  const batasLelang = new Date(Date.now() + HARI_LELANG_DEKAT * HARI_MS);

  /* Satu JOIN, disaring di database. Yang dibandingkan adalah harga_efektif
     (angka yang benar-benar dibaca klien di kartu) terhadap harga_diketahui
     (angka yang terakhir kali BENAR-BENAR sampai ke klien) — bukan terhadap
     harga saat kiriman pertama, kalau tidak aset yang turun tiga kali akan
     dilaporkan tiga kali dengan selisih yang sama. */
  const baris = await prisma.$queryRaw<BarisPantau[]>`
    SELECT kr.id_kiriman,
           kr.id_klien,
           kr.id_agent,
           k.nama                                AS nama_klien,
           kr.harga_diketahui,
           l.id_property,
           l.judul,
           COALESCE(l.harga_efektif, l.harga)    AS harga_kini,
           l.status_tayang::text                 AS status_tayang,
           l.jenis_transaksi::text               AS jenis_transaksi,
           l.tanggal_lelang
    FROM kiriman_rekomendasi kr
    JOIN listing l ON l.id_property = kr.id_property
    JOIN klien   k ON k.id_klien    = kr.id_klien
    WHERE kr.tanggapan <> 'TIDAK_COCOK'
      AND k.status NOT IN ('lost_iseng')
      AND (
            l.status_tayang <> 'TERSEDIA'
         OR abs(COALESCE(l.harga_efektif, l.harga) - kr.harga_diketahui)
              >= kr.harga_diketahui * ${AMBANG_PERSEN / 100}
         OR (l.jenis_transaksi = 'LELANG'
             AND l.tanggal_lelang BETWEEN now() AND ${batasLelang})
      )
    LIMIT 2000
  `;

  const kabar = baris
    .map(b => ({ b, p: bacaPerubahan(b) }))
    .filter((x): x is { b: BarisPantau; p: { jenis: JenisPerubahan; persen: number } } => x.p !== null);

  if (kabar.length === 0) return { dipindai: baris.length, baru: 0, tugas: 0, perAgent: new Map<string, number>() };

  /* Peredam: kabar yang SAMA dan masih menganggur tidak ditulis dua kali.
     Tanpa ini, aset yang turun harga hari Senin akan melahirkan satu baris
     baru tiap 15 menit sampai agent membukanya. */
  const idKiriman = [...new Set(kabar.map(x => x.b.id_kiriman))];
  const tertunda = await prisma.perubahanKiriman.findMany({
    where: { id_kiriman: { in: idKiriman }, diteruskan_pada: null, diabaikan_pada: null },
    select: { id_kiriman: true, jenis: true },
  });
  const sudahAda = new Set(tertunda.map(t => `${t.id_kiriman}:${t.jenis}`));

  const perlu = kabar.filter(x => !sudahAda.has(`${x.b.id_kiriman}:${x.p.jenis}`));
  if (perlu.length === 0) return { dipindai: baris.length, baru: 0, tugas: 0, perAgent: new Map<string, number>() };

  const perAgent = new Map<string, number>();
  for (const x of perlu) perAgent.set(x.b.id_agent, (perAgent.get(x.b.id_agent) ?? 0) + 1);

  if (dryRun) return { dipindai: baris.length, baru: perlu.length, tugas: 0, perAgent };

  /* Menulis perubahan lebih dulu, baru tugasnya — tugas menyandang id
     perubahan di kunci anti-dobelnya, jadi urutannya tidak bisa dibalik. */
  const dibuat = await prisma.$transaction(
    perlu.map(x =>
      prisma.perubahanKiriman.create({
        data: {
          id_kiriman: x.b.id_kiriman,
          jenis: x.p.jenis,
          harga_lama: x.p.jenis.startsWith("HARGA") ? x.b.harga_diketahui : null,
          harga_baru: x.p.jenis.startsWith("HARGA") ? x.b.harga_kini : null,
          selisih_persen: x.p.persen || null,
        },
        select: { id: true },
      }),
    ),
  );

  const tugas = perlu.map((x, i) => ({
    id_agent: x.b.id_agent,
    id_klien: x.b.id_klien,
    id_listing: x.b.id_property,
    judul: judulTugas(x.p.jenis, x.b.nama_klien, x.b.judul, x.p.persen),
    catatan: "Dibuat otomatis oleh asisten preferensi klien. Buka kartu klien untuk melihat draf pesannya.",
    kategori: "FOLLOWUP" as const,
    prioritas: (x.p.jenis === "HARGA_TURUN" || x.p.jenis === "LELANG_DEKAT" ? "TINGGI" : "SEDANG") as "TINGGI" | "SEDANG",
    is_auto_generated: true,
    kunci_otomatis: `PERUBAHAN:${dibuat[i].id}`,
    tanggal_selesai: new Date(Date.now() + 2 * HARI_MS),
  }));

  const hasil = await prisma.tugas.createMany({ data: tugas, skipDuplicates: true });
  return { dipindai: baris.length, baru: perlu.length, tugas: hasil.count, perAgent };
}

/* ── 2. ASET BARU YANG COCOK ───────────────────────────────────────────── */

type AsetCocok = {
  id_property: bigint;
  slug: string;
  judul: string;
  kota: string | null;
  kecamatan: string | null;
  alamat_lengkap: string | null;
  jenis_transaksi: string;
  kategori: string;
  gambar: string | null;
  luas_tanah: Prisma.Decimal | null;
  luas_bangunan: Prisma.Decimal | null;
  kamar_tidur: number | null;
  kamar_mandi: number | null;
  harga: Prisma.Decimal;
  harga_promo: Prisma.Decimal | null;
  harga_efektif: Prisma.Decimal | null;
  nilai_limit_lelang: Prisma.Decimal | null;
  is_hot_deal: boolean;
  tanggal_dibuat: Date | null;
  tanggal_lelang: Date | null;
};

type PrefBaris = Parameters<typeof ringkasGrup>[0][number];

type TemuanKlien = {
  id_klien: string;
  id_agent: string;
  nama: string;
  /** id_property → aset, sekaligus penjaga keunikan. Satu aset yang cocok
   *  dengan DUA preferensi klien yang sama harus dihitung sekali. */
  aset: Map<string, AsetCocok>;
  /** id_property → id_preferensi yang mencocokinya (skor tertinggi). Dibawa
   *  sampai ke tiket email supaya kirimannya tercatat di bawah kriteria yang
   *  benar-benar menghasilkan. */
  asal: Map<string, string>;
  /** Baris preferensi yang MENGHASILKAN, dikelompokkan dengan aturan yang sama
   *  dengan layar (kunciGrup). Disimpan sebagai baris, bukan sebagai teks jadi:
   *  labelnya baru bisa disusun setelah seluruh baris satu grup terkumpul.
   *
   *  Ini bukan kerapian. Formulir menyimpan "Gudang/Rumah/Tanah/Toko di Manukan
   *  Kulon" sebagai EMPAT baris. Memberi label per baris membuat email menulis
   *  "Gudang · Manukan Kulon · ≤500jt / Rumah · Manukan Kulon · ≤500jt +2",
   *  sementara layar CRM menulis "Gudang / Rumah +2 · Manukan Kulon · ≤500jt"
   *  untuk kriteria yang sama persis — dan agent tidak punya cara tahu bahwa
   *  keduanya benda yang sama. */
  grup: Map<string, PrefBaris[]>;
  /** Skor terbaik tiap aset — dipakai memilih tiga yang ditampilkan di email. */
  skor: Map<string, number>;
  /** KENAPA tiap aset cocok, dari kriteria yang memberi skor tertinggi. */
  alasan: Map<string, string[]>;
  /** Kapan klien ini terakhir dihubungi — null bila belum pernah. */
  kontakTerakhir: Date | null;
  /** id_property yang datang dari pemindaian KRITERIA BARU, bukan dari listing
   *  baru. Wajib dibedakan: aset ini sengaja LAMA — itu memang seluruh
   *  gunanya — sementara penyaring "sudah pernah dikabari" di kabariAsetBaru()
   *  membuang aset yang lebih tua dari email terakhir. Tanpa penanda ini,
   *  agent yang pernah menerima satu email asisten tidak akan PERNAH menerima
   *  kabar kriteria barunya, karena seluruh 120 aset itu lebih tua dari
   *  emailnya. Bug yang hanya muncul pada agent lama — yaitu semua orang,
   *  sebulan setelah fitur ini hidup. */
  backfill: Set<string>;
};

const SELECT_ASET_BARU = {
  id_property: true, slug: true, judul: true,
  kota: true, provinsi: true, kecamatan: true, kelurahan: true, alamat_lengkap: true,
  jenis_transaksi: true, kategori: true,
  gambar: true, luas_tanah: true, luas_bangunan: true,
  kamar_tidur: true, kamar_mandi: true,
  harga: true, harga_promo: true, harga_efektif: true, nilai_limit_lelang: true,
  is_hot_deal: true, tanggal_dibuat: true, tanggal_lelang: true,
  legalitas: true,
  /* WAJIB ikut, alasan yang sama dengan `tempatDekat` di bawah: pemindai
     terbalik menilai gerbang BENTUK ASET (tanah kosong vs terbangun) di
     memori, dan kolom yang tidak ter-select membuat gerbang itu diam. Tanpa
     ini cron mengirimi klien "cari tanah" lot yang berikut bangunan,
     sementara layar CRM — yang menyaringnya di SQL — tidak. */
  ada_bangunan: true,
  /* WAJIB ikut. Pemindai terbalik menilai gerbang "dekat X" DI MEMORI, dan
     `lolosSemuaGerbang()` MENOLAK aset yang relasinya tidak ter-select —
     meloloskannya berarti mengirim aset yang belum tentu dekat ke klien yang
     tegas memintanya dekat. Hanya dua kolom, jadi murah. */
  tempatDekat: { select: { id_tempat: true, jarak_meter: true, presisi: true } },
} as const;

/* ── Tanda air ────────────────────────────────────────────────────────────
   Menggantikan jendela geser `now() - 26 jam`. Jendela geser bekerja selama
   cron-nya hidup terus; begitu prosesnya mati tiga jam, listing yang masuk di
   jam-jam itu berada DI LUAR jendela pada putaran berikutnya dan tidak akan
   pernah masuk jendela mana pun lagi. Hilang, tanpa satu baris log. */

/* DUA tanda air, bukan satu — dan ini bukan kerapian.

   Pemindai harus menangkap dua hal berbeda: listing yang BARU DIBUAT, dan
   listing lama yang BARU BERUBAH (harganya turun ke dalam anggaran klien).
   Godaannya adalah satu query dengan `OR` pada dua kolom, lalu memajukan tanda
   airnya ke `max(tanggal_dibuat)`. Itu RUSAK, dan rusaknya besar:

   Di database ini ada 4.624 baris yang dibuat tahun lalu tapi baru di-update
   kemarin. Satu putaran yang kebetulan hanya berisi baris seperti itu akan
   memajukan tanda air ke `max(tanggal_dibuat)` — yaitu TAHUN LALU. Tanda
   airnya MUNDUR, putaran berikutnya menganggap seluruh 120 ribu listing belum
   diproses, dan setiap agent menerima email raksasa berisi aset yang sudah
   mereka kenal. Lalu berulang, karena keadaannya tidak pernah membaik.

   Dipisah, tiap tanda air hanya mengurus satu kolom: penyaringnya, urutannya,
   dan angka majunya semua memakai kolom yang sama. Tidak ada cara ia mundur. */

const KUNCI_AIR = {
  dibuat: "asisten:aset_baru",   // kunci lama — sengaja dipertahankan
  diubah: "asisten:aset_ubah",
} as const;

type Kolom = "tanggal_dibuat" | "tanggal_diupdate";

/** Sejauh mana kolom ini sudah diproses. Kalau barisnya belum ada — pemasangan
 *  baru — dimulai dari SEKARANG, bukan dari nol. Mulai dari nol berarti
 *  memperlakukan seluruh 120 ribu listing lama sebagai "baru" dan mengirimi
 *  tiap agent email raksasa berisi aset yang sudah mereka kenal bertahun-tahun. */
async function bacaTandaAir(kunci: string): Promise<Date> {
  const w = await prisma.cronWatermark.findUnique({ where: { kunci } });
  if (w) return w.waktu;
  const sekarang = new Date();
  await prisma.cronWatermark.create({
    data: { kunci, waktu: sekarang, catatan: "dibuat otomatis oleh cron" },
  });
  return sekarang;
}

/** Maju HANYA sesudah putaran berhasil, dan HANYA ke depan.
 *  Penjaga `waktu <= lama` adalah sabuk pengaman terakhir: seandainya ada jalur
 *  yang salah hitung, yang terjadi paling buruk adalah satu putaran tidak maju
 *  — bukan seluruh database dipindai ulang. */
async function majukanTandaAir(kunci: string, waktu: Date, idTerakhir: bigint | null) {
  const lama = await prisma.cronWatermark.findUnique({ where: { kunci } });
  if (lama && waktu <= lama.waktu) return;
  await prisma.cronWatermark.upsert({
    where: { kunci },
    create: { kunci, waktu, id_terakhir: idTerakhir },
    update: { waktu, id_terakhir: idTerakhir, diperbarui_pada: new Date() },
  });
}

type BarisListing = AsetCocok & { tanggal_diupdate: Date | null };

/** Ambil listing yang belum diproses menurut SATU kolom waktu.
 *  Penyaring, urutan, dan angka majunya memakai kolom yang sama — itulah yang
 *  membuat tanda airnya tidak bisa mundur. */
async function ambilBelumDiproses(kolom: Kolom, sejak: Date): Promise<BarisListing[]> {
  return prisma.listing.findMany({
    where: {
      status_tayang: "TERSEDIA",
      bukan_properti: false,
      [kolom]: { gt: sejak },
    },
    orderBy: [{ [kolom]: "asc" }, { id_property: "asc" }],
    take: MAKS_LISTING_PER_PUTARAN,
    select: { ...SELECT_ASET_BARU, tanggal_diupdate: true },
  }) as unknown as Promise<BarisListing[]>;
}

const puncak = (rows: BarisListing[], kolom: Kolom): Date =>
  rows.reduce<Date>((m, r) => {
    const v = kolom === "tanggal_dibuat" ? r.tanggal_dibuat : r.tanggal_diupdate;
    return v && v > m ? v : m;
  }, new Date(0));

const idPuncak = (rows: BarisListing[]): bigint | null =>
  rows.length === 0 ? null : rows.reduce<bigint>((m, r) => (r.id_property > m ? r.id_property : m), BigInt(0));

/* ── Muatan bersama kedua pemindai ────────────────────────────────────── */

type BarisPref = Awaited<ReturnType<typeof muatPreferensi>>[number];

/** Seluruh preferensi aktif, dimuat SEKALI per putaran.
 *
 *  Diurutkan tegas berdasarkan id. Versi lama memakai `take` tanpa `orderBy`,
 *  dan urutan tanpa ORDER BY di Postgres tidak dijamin — artinya begitu jumlah
 *  preferensi melewati batas, klien MANA yang dibuang berubah-ubah tiap
 *  putaran, dan sebagian klien tidak pernah dipindai tanpa ada yang tahu.
 *  Dengan urutan tetap, yang terbuang selalu ekor yang sama dan jumlahnya
 *  dilaporkan di respons. */
async function muatPreferensi() {
  return prisma.preferensiKlien.findMany({
    where: { klien: { status: { notIn: ["closing", "lost_iseng"] } } },
    orderBy: { id_preferensi: "asc" },
    take: MAKS_PREFERENSI,
    include: {
      klien: {
        select: {
          id_klien: true, id_agent: true, nama: true, id_properti_asal: true,
          tanggal_kontak_terakhir: true, tanggal_masuk: true,
        },
      },
    },
  });
}

/** Peta token→kriteria untuk putaran yang sedang berjalan. Disetel di awal
 *  tiap pemindai; `keKriteria()` membacanya tanpa perlu menerima parameter
 *  tambahan di setiap pemanggil. */
let petaDekatPutaran = new Map<string, import("@/lib/klienMatch").KriteriaDekat>();

function keKriteria(p: BarisPref): KriteriaMatch {
  return {
    id_preferensi: p.id_preferensi,
    maksud: p.maksud,
    tipe_properti: p.tipe_properti,
    jenis_transaksi: p.jenis_transaksi,
    loc_provinsi: p.loc_provinsi,
    loc_kota: p.loc_kota,
    loc_kecamatan: p.loc_kecamatan,
    loc_kelurahan: p.loc_kelurahan,
    budget_min: p.budget_min,
    budget_max: p.budget_max,
    luas_min: p.luas_min,
    luas_max: p.luas_max,
    legalitas: p.legalitas,
    dekat: dekatUntuk(p as PrefDekat, petaDekatPutaran),
    alamat_teks: p.alamat_teks,
  };
}

/** Aset yang sudah pernah dikirim, per klien. Satu query untuk semua. */
/* Dulu hanya membaca `kiriman_rekomendasi`. Sekarang lewat
   `muatPengecualian()` supaya penyingkiran manual agent ikut berlaku di sini
   juga — kalau tidak, agent membuang sebuah aset di layar CRM lalu MENERIMA
   ASET ITU LAGI lewat email dua jam kemudian, dan tidak ada cara menduga
   kenapa. Nama lamanya sengaja diganti: fungsi bernama `muatTerkirim` yang
   diam-diam juga memuat penyingkiran adalah jebakan untuk pembaca berikutnya. */
const muatDikecualikan = (idKlien: string[]) => muatPengecualian(prisma, idKlien);

function temuanBaru(p: BarisPref): TemuanKlien {
  return {
    id_klien: p.id_klien,
    id_agent: p.klien.id_agent,
    nama: p.klien.nama,
    aset: new Map(), asal: new Map(), grup: new Map(), skor: new Map(), alasan: new Map(),
    backfill: new Set(),
    /* Kalau belum pernah dihubungi sama sekali, tanggal masuknya yang dipakai —
       justru klien seperti itulah yang paling sering hilang. */
    kontakTerakhir: p.klien.tanggal_kontak_terakhir ?? p.klien.tanggal_masuk ?? null,
  };
}

/** Catat satu kecocokan ke dalam temuan klien. */
function catatCocok(t: TemuanKlien, p: BarisPref, k: KriteriaMatch, l: AsetCocok) {
  const kunci = kunciGrup(p);
  t.grup.set(kunci, [...(t.grup.get(kunci) ?? []), p as unknown as PrefBaris]);
  const id = l.id_property.toString();
  const s = skorListing(l as any, k);
  t.aset.set(id, l);
  /* Preferensi asal = yang memberi skor tertinggi. Aset yang cocok dengan dua
     kriteria dicatat di bawah yang paling menjelaskan kenapa ia layak dikirim. */
  if (!t.skor.has(id) || s > (t.skor.get(id) as number)) {
    t.skor.set(id, s);
    t.asal.set(id, p.id_preferensi.toString());
    t.alasan.set(id, alasanCocok(l as any, k));
  }
}

/* ── 2a. PEMINDAI TERBALIK: listing baru → preferensi siapa? ───────────── */

async function pindaiAsetBaru(dryRun: boolean) {
  const kosong = {
    listingBaru: 0, preferensi: 0, preferensiTerpotong: 0,
    klienDapat: 0, tugas: 0,
    perAgent: new Map<string, number>(), temuan: [] as TemuanKlien[],
  };

  /* DUA pengambilan terpisah, hasilnya digabung. Yang pertama menangkap
     listing yang baru masuk; yang kedua menangkap listing lama yang berubah —
     terutama yang harganya baru turun ke dalam anggaran seorang klien. Aset
     seperti itu sebelumnya tidak muncul di mana pun: ia tidak baru, dan karena
     belum pernah dikirim, pengawas perubahan harga pun tidak melihatnya. */
  const [airDibuat, airDiubah] = await Promise.all([
    bacaTandaAir(KUNCI_AIR.dibuat),
    bacaTandaAir(KUNCI_AIR.diubah),
  ]);
  const [rowsDibuat, rowsDiubah] = await Promise.all([
    ambilBelumDiproses("tanggal_dibuat", airDibuat),
    ambilBelumDiproses("tanggal_diupdate", airDiubah),
  ]);

  /* Satu listing bisa muncul di keduanya (baru dibuat DAN langsung disunting).
     Digabung lewat Map supaya ia hanya diadu sekali. */
  const petaBaru = new Map<string, BarisListing>();
  for (const l of [...rowsDibuat, ...rowsDiubah]) petaBaru.set(l.id_property.toString(), l);
  const baru = [...petaBaru.values()];

  /** Majukan KEDUA tanda air. Dipanggil di beberapa jalur keluar, jadi
   *  dijadikan satu fungsi — jalur keluar yang lupa memajukannya akan membuat
   *  listing yang sama dipindai ulang tiap dua jam selamanya. */
  const majukanKeduanya = async () => {
    await Promise.all([
      rowsDibuat.length ? majukanTandaAir(KUNCI_AIR.dibuat, puncak(rowsDibuat, "tanggal_dibuat"), idPuncak(rowsDibuat)) : Promise.resolve(),
      rowsDiubah.length ? majukanTandaAir(KUNCI_AIR.diubah, puncak(rowsDiubah, "tanggal_diupdate"), idPuncak(rowsDiubah)) : Promise.resolve(),
    ]);
  };

  if (baru.length === 0) return kosong;

  const prefs = await muatPreferensi();
  petaDekatPutaran = await siapkanDekat(prefs);
  if (prefs.length === 0) {
    /* Tidak ada preferensi sama sekali → tetap majukan tanda airnya. Kalau
       tidak, listing yang sama akan dipindai ulang tiap dua jam selamanya. */
    if (!dryRun) await majukanKeduanya();
    return { ...kosong, listingBaru: baru.length };
  }

  const petaDikecualikan = await muatDikecualikan([...new Set(prefs.map(p => p.id_klien))]);

  /* INTI: tiap listing baru diadu dengan seluruh preferensi DI MEMORI.
     Dua query untuk seluruh putaran, apa pun jumlah kliennya. */
  const perKlien = new Map<string, TemuanKlien>();
  const kriteriaCache = prefs.map(keKriteria);

  for (let i = 0; i < prefs.length; i++) {
    const p = prefs[i];
    const k = kriteriaCache[i];
    const sudah = petaDikecualikan.get(p.id_klien);
    const asal = p.klien.id_properti_asal?.toString();

    for (const l of baru as AsetCocok[]) {
      const id = l.id_property.toString();
      if (sudah?.has(id)) continue;      // sudah dikirim ATAU disingkirkan agent
      if (asal && asal === id) continue; // aset milik klien itu sendiri
      if (!lolosSemuaGerbang(l as any, k)) continue;

      let t = perKlien.get(p.id_klien);
      if (!t) { t = temuanBaru(p); perKlien.set(p.id_klien, t); }
      catatCocok(t, p, k, l);
    }
  }

  const temuan = [...perKlien.values()];
  const perAgent = new Map<string, number>();
  const hari = tanggalKunci();
  const tugas = temuan.map(t => {
    perAgent.set(t.id_agent, (perAgent.get(t.id_agent) ?? 0) + 1);
    return {
      id_agent: t.id_agent,
      id_klien: t.id_klien,
      judul: `${t.aset.size} aset baru cocok untuk ${t.nama}`,
      catatan: "Dibuat otomatis oleh asisten preferensi klien. Buka kartu klien → Cari aset.",
      kategori: "PIPELINE" as const,
      prioritas: "SEDANG" as const,
      is_auto_generated: true,
      kunci_otomatis: `ASETBARU:${t.id_klien}:${hari}`,
      tanggal_selesai: new Date(Date.now() + 2 * HARI_MS),
    };
  });

  const hasil = { listingBaru: baru.length, preferensi: prefs.length,
    preferensiTerpotong: prefs.length >= MAKS_PREFERENSI ? 1 : 0,
    klienDapat: temuan.length, tugas: 0, perAgent, temuan };

  if (dryRun) return hasil;

  if (tugas.length > 0) {
    const t = await prisma.tugas.createMany({ data: tugas, skipDuplicates: true });
    hasil.tugas = t.count;
  }
  /* Tanda air maju paling akhir, sesudah tugasnya benar-benar tertulis. */
  await majukanKeduanya();
  return hasil;
}

/* ── 2c. KRITERIA YANG BELUM PERNAH DIADU DENGAN PERSEDIAAN LAMA ───────── */

/**
 * Menjawab kasus yang paling sering terjadi dan paling mudah terlewat:
 * agent baru saja memasukkan klien yang mencari "gudang minimal 1.000 m²", dan
 * di database sudah ADA 100 gudang yang cocok — semuanya masuk bulan lalu.
 *
 * Pemindai aset baru tidak akan pernah melihatnya: seratus gudang itu tidak
 * baru, dan tidak akan pernah jadi baru lagi. Tanpa pemindai ini, agent hanya
 * mengetahuinya kalau ia kebetulan membuka CRM — dan seluruh janji "sistem
 * yang mengingatkan" runtuh persis pada momen yang paling menentukan, yaitu
 * hari pertama sebuah kriteria dibuat.
 *
 * Di sini query PER PREFERENSI memang dipakai (bukan pemindaian terbalik), dan
 * itu pilihan sadar: kriteria yang menunggu pemindaian pertama selalu sedikit —
 * hanya yang dibuat sejak putaran terakhir — sementara kolam yang harus digeledah
 * adalah SELURUH persediaan. Untuk bentuk soal itu, arah yang lama justru yang
 * benar.
 */
async function pindaiPreferensiBaru(dryRun: boolean) {
  const kosong = { preferensi: 0, klienDapat: 0, tugas: 0,
    perAgent: new Map<string, number>(), temuan: [] as TemuanKlien[] };

  const prefs = await prisma.preferensiKlien.findMany({
    where: {
      terakhir_dipindai: null,
      klien: { status: { notIn: ["closing", "lost_iseng"] } },
    },
    orderBy: { id_preferensi: "asc" },
    take: MAKS_PREFERENSI_BARU,
    include: {
      klien: {
        select: {
          id_klien: true, id_agent: true, nama: true, id_properti_asal: true,
          tanggal_kontak_terakhir: true, tanggal_masuk: true,
        },
      },
    },
  });
  if (prefs.length === 0) return kosong;
  petaDekatPutaran = await siapkanDekat(prefs);

  const petaDikecualikan = await muatDikecualikan([...new Set(prefs.map(p => p.id_klien))]);
  const perKlien = new Map<string, TemuanKlien>();

  for (let i = 0; i < prefs.length; i += PARALEL) {
    const potongan = prefs.slice(i, i + PARALEL);
    const hasil = await Promise.all(
      potongan.map(p => {
        const k = keKriteria(p);
        const kecuali = gabung(petaDikecualikan, p.id_klien, p.klien.id_properti_asal);
        /* `maks` dibatasi: yang dibutuhkan cuma beberapa aset TERBAIK untuk
           satu email. Menarik enam ratus baris demi menampilkan tiga adalah
           biaya yang dibayar berulang kali tanpa ada yang membacanya. */
        return cariCocok<any>(prisma, k, { kecuali, select: SELECT_ASET_BARU, maks: KOLAM_PREFERENSI_BARU })
          .then(r => ({ p, k, daftar: r as AsetCocok[] }));
      }),
    );
    for (const { p, k, daftar } of hasil) {
      if (daftar.length === 0) continue;
      let t = perKlien.get(p.id_klien);
      if (!t) { t = temuanBaru(p); perKlien.set(p.id_klien, t); }
      for (const l of daftar) {
        catatCocok(t, p, k, l);
        t.backfill.add(l.id_property.toString());
      }
    }
  }

  const temuan = [...perKlien.values()];
  const perAgent = new Map<string, number>();
  for (const t of temuan) perAgent.set(t.id_agent, (perAgent.get(t.id_agent) ?? 0) + 1);

  if (dryRun) return { preferensi: prefs.length, klienDapat: temuan.length, tugas: 0, perAgent, temuan };

  const hari = tanggalKunci();
  const hasilTugas = await prisma.tugas.createMany({
    data: temuan.map(t => ({
      id_agent: t.id_agent,
      id_klien: t.id_klien,
      judul: `${t.aset.size} aset cocok untuk ${t.nama} — kriteria baru`,
      catatan: "Kriteria baru diadu dengan seluruh persediaan. Buka kartu klien → Cari aset.",
      kategori: "PIPELINE" as const,
      prioritas: "TINGGI" as const,
      is_auto_generated: true,
      kunci_otomatis: `PREFBARU:${t.id_klien}:${hari}`,
      tanggal_selesai: new Date(Date.now() + 2 * HARI_MS),
    })),
    skipDuplicates: true,
  });

  /* Ditandai SESUDAH tugasnya tertulis. Kalau ditandai lebih dulu dan
     penulisannya gagal, kriteria itu tidak akan pernah dipindai lagi —
     kehilangan permanen demi menghemat satu putaran. */
  await prisma.preferensiKlien.updateMany({
    where: { id_preferensi: { in: prefs.map(p => p.id_preferensi) } },
    data: { terakhir_dipindai: new Date() },
  });

  return { preferensi: prefs.length, klienDapat: temuan.length, tugas: hasilTugas.count, perAgent, temuan };
}

/** Gabungkan temuan dari kedua pemindai per klien.
 *
 *  Satu klien bisa muncul di keduanya: kriterianya baru dibuat pagi ini (jadi
 *  diadu dengan seluruh persediaan) DAN ada listing baru yang masuk siang ini.
 *  Tanpa penggabungan, agent menerima dua blok untuk orang yang sama di email
 *  yang sama — atau lebih buruk, dua email. */
function gabungTemuan(a: TemuanKlien[], b: TemuanKlien[]): TemuanKlien[] {
  const peta = new Map<string, TemuanKlien>();
  for (const t of [...a, ...b]) {
    const ada = peta.get(t.id_klien);
    if (!ada) { peta.set(t.id_klien, t); continue; }
    for (const [id, l] of t.aset) {
      const skorBaru = t.skor.get(id) ?? 0;
      if (!ada.aset.has(id) || skorBaru > (ada.skor.get(id) ?? 0)) {
        ada.aset.set(id, l);
        ada.skor.set(id, skorBaru);
        const asal = t.asal.get(id); if (asal) ada.asal.set(id, asal);
        const alasan = t.alasan.get(id); if (alasan) ada.alasan.set(id, alasan);
      }
    }
    for (const id of t.backfill) ada.backfill.add(id);
    for (const [k, rows] of t.grup) if (!ada.grup.has(k)) ada.grup.set(k, rows);
  }
  return [...peta.values()];
}

/* ── 2b. EMAIL ASET BARU ───────────────────────────────────────────────────
   Bagian yang mengubah pemberitahuan jadi tindakan. Lihat alasan bentuk
   emailnya di src/lib/mailer.ts (asistenAsetEmailHtml). */

/** Jam WIB sekarang, apa pun zona waktu server. Server cPanel dan server lokal
   tidak selalu sepakat soal ini, dan "jangan kirim email tengah malam" yang
   dihitung dari zona waktu yang salah akan mengirim email tengah malam. */
function jamWib(d = new Date()): { tanggal: string; jam: number } {
  const wib = new Date(d.getTime() + 7 * 3_600_000);
  const tgl = `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, "0")}-${String(wib.getUTCDate()).padStart(2, "0")}`;
  return { tanggal: tgl, jam: wib.getUTCHours() };
}

/** "3 hari lalu", "kemarin", "hari ini". Ditulis relatif, bukan sebagai
 *  tanggal: agent membaca email ini untuk memutuskan siapa yang dikejar lebih
 *  dulu, dan "17 Agustus" menuntutnya menghitung sendiri. */
function labelKontak(d: Date | null): string | null {
  if (!d) return null;
  const hari = Math.floor((Date.now() - d.getTime()) / HARI_MS);
  if (hari <= 0) return "hari ini";
  if (hari === 1) return "kemarin";
  if (hari < 30) return `${hari} hari lalu`;
  const bulan = Math.floor(hari / 30);
  return bulan === 1 ? "sebulan lalu" : `${bulan} bulan lalu`;
}

function badgeAset(l: AsetCocok): string {
  const t = String(l.jenis_transaksi).toUpperCase();
  if (t === "SEWA") return "Disewakan";
  if (t === "LELANG") return "Lelang";
  return String(l.kategori);
}

function spesifikasiAset(l: AsetCocok): string {
  const b: string[] = [];
  if (l.luas_tanah && Number(l.luas_tanah) > 0) b.push(`LT ${Number(l.luas_tanah)} m²`);
  if (l.luas_bangunan && Number(l.luas_bangunan) > 0) b.push(`LB ${Number(l.luas_bangunan)} m²`);
  if (l.kamar_tidur) b.push(`${l.kamar_tidur} KT`);
  if (l.kamar_mandi) b.push(`${l.kamar_mandi} KM`);
  return b.join(" · ");
}

/**
 * Satu klien → satu blok di dalam email.
 *
 * Diekstrak supaya jalur NYATA dan mode UJI (?test=) memakai kode yang sama.
 * Kalau mode uji menyusun blok sendiri, ia akan berhenti mewakili email yang
 * sebenarnya dikirim — dan pengujian yang tidak mewakili produksi lebih buruk
 * daripada tidak menguji: ia memberi rasa aman yang keliru.
 */
function bangunBlokKlien(
  t: TemuanKlien,
  idAgent: string,
  inline?: Map<string, { cid: string; content: Buffer }>,
): AsistenAsetKlien {
  const urut = [...t.aset.entries()]
    .sort((x, y) => (t.skor.get(y[0]) ?? 0) - (t.skor.get(x[0]) ?? 0));
  const tampil = urut.slice(0, ASET_PER_KLIEN_EMAIL);
  const idsTiket = tampil.map(([id]) => id);

  const tiket = buatTiket({
    a: idAgent,
    k: t.id_klien,
    p: idsTiket,
    r: idsTiket.map(id => t.asal.get(id) ?? null),
  });

  /* Satu label per GRUP, bukan per baris — sama dengan pill di layar. */
  const label = [...t.grup.values()].map(rows => ringkasGrup(rows));
  const kriteria = label.length <= 2
    ? label.join("  /  ")
    : `${label.slice(0, 2).join("  /  ")} +${label.length - 2}`;

  return {
    nama: t.nama,
    kriteria,
    total: t.aset.size,
    kontakTerakhir: labelKontak(t.kontakTerakhir),
    aset: tampil.map(([id, l]) => {
      const lokasi = [rapikanAlamat(l.kecamatan), rapikanAlamat(l.kota)].filter(Boolean).join(", ");
      return {
        alasan: saringAlasan(t.alasan.get(id), `${lokasi} ${l.alamat_lengkap ?? ""}`),
        judul: l.judul,
        /* Alamat lengkap kalau ada, kalau tidak jatuh ke kecamatan+kota.
           Keduanya lewat perapi yang sama: 26% baris lelang datang HURUF
           BESAR SEMUA. */
        alamat: rapikanAlamat(l.alamat_lengkap) || lokasi,
        /* Kode agent penerima email ditempelkan: kalau ia meneruskan tautan
           ini ke klien, tombol hubungi tetap kembali kepadanya. */
        url: urlListing(
          { slug: l.slug, id_property: l.id_property.toString(), jenis_transaksi: l.jenis_transaksi },
          idAgent,
        ),
        /* Lewat proxy domain sendiri, BUKAN URL aslinya. Klien email mem-proxy
           gambar lewat server mereka tanpa mengirim `Referer`, dan 120.007 dari
           120.393 foto ada di file.lelang.go.id yang memblokir hotlink — <img>
           langsung ke sana akan kosong di hampir setiap email.
           236 = 2× lebar kartu (118px), supaya tajam di layar retina. */
        /* `cid:` bila fotonya ikut di dalam surat — itu satu-satunya bentuk
           yang tidak bisa gagal. Kalau tidak muat, jatuh ke proxy domain
           sendiri (JANGAN URL aslinya: klien email mem-proxy gambar tanpa
           mengirim Referer, dan file.lelang.go.id memblokir hotlink). */
        gambar: inline?.has(id)
          ? `cid:${inline.get(id)!.cid}`
          : `${URL_PUBLIK}/api/foto/${l.id_property}?w=236`,
        hargaTampil: rupiah(hargaEfektif(l as any)),
        lokasi,
        spesifikasi: spesifikasiAset(l),
        badge: badgeAset(l),
      };
    }),
    /* Menunjuk ke HALAMAN, bukan ke endpoint yang menulis. Tautan di dalam
       email diambil otomatis oleh gerbang keamanan email; kalau ia menunjuk ke
       jalur yang mencatat, tiap pemindaian melahirkan kiriman palsu. */
    kirimUrl: `${SITE_URL}/asisten/kirim?t=${encodeURIComponent(tiket)}`,
    bukaUrl: `${SITE_URL}/dashboard/crm?klien=${encodeURIComponent(t.id_klien)}`,
  };
}

/**
 * Kirim satu email digest per agent — dengan rem yang ditegakkan database.
 *
 * Remnya bekerja terbalik dari yang biasa: barisnya DITULIS DULU, dan INSERT
 * yang berhasil itulah izin mengirim. Pemeriksaan "sudah pernah dikirim
 * belum?" yang mendahului penulisan akan bocor begitu dua putaran cron
 * berjalan bersamaan — dan itu bukan kemungkinan teoretis, scheduler bisa
 * menembak persis saat seseorang memanggil endpointnya manual.
 */
async function kabariAsetBaru(temuan: TemuanKlien[], dryRun: boolean, tanpaEmail: boolean) {
  if (temuan.length === 0) return { agent: 0, email: 0, notifikasi: 0, dilewati: 0 };

  const { tanggal, jam } = jamWib();

  /* Jam tenang. Email properti yang tiba pukul 03.00 tidak dibaca lebih cepat;
     ia hanya membuat agent mematikan notifikasinya. */
  if (jam < JAM_EMAIL_MULAI || jam >= JAM_EMAIL_SELESAI) {
    return { agent: 0, email: 0, notifikasi: 0, dilewati: temuan.length, alasan: "jam tenang" as const };
  }

  const slot = Math.floor(jam / JEDA_EMAIL_JAM);
  const kunci = `ASETBARU:${tanggal}:${slot}`;

  const perAgent = new Map<string, TemuanKlien[]>();
  for (const t of temuan) {
    const arr = perAgent.get(t.id_agent) ?? [];
    arr.push(t);
    perAgent.set(t.id_agent, arr);
  }

  if (dryRun) return { agent: perAgent.size, email: 0, notifikasi: 0, dilewati: 0 };

  const agents = await prisma.agent.findMany({
    where: { id_agent: { in: [...perAgent.keys()] } },
    select: {
      id_agent: true,
      id_pengguna: true,
      pengguna: { select: { nama_lengkap: true, email: true } },
    },
  });

  /* Kapan tiap agent TERAKHIR benar-benar menerima email asisten. Inilah garis
     batas "sudah pernah dikabari" yang sesungguhnya — bukan lebar jendela
     pemindaian, yang antar putaran selalu tumpang tindih. Tanpa garis ini,
     aset yang masuk pukul 06.30 akan muncul di email pukul 07.30 DAN di email
     pukul 12.00, dan agent belajar bahwa isi email ini tidak bisa dipercaya
     sebagai "baru".

     Hanya baris `terkirim: true` yang dihitung: slot yang terlanjur diklaim
     tapi emailnya gagal terkirim bukan kabar yang pernah sampai ke siapa pun,
     dan memperlakukannya sebagai sudah-dikabari akan menelan aset itu
     selamanya. */
  const emailTerakhir = new Map<string, Date>();
  const riwayat = await prisma.emailAsisten.findMany({
    where: { id_agent: { in: [...perAgent.keys()] }, terkirim: true },
    select: { id_agent: true, dikirim_pada: true },
    orderBy: { dikirim_pada: "desc" },
  });
  for (const r of riwayat) {
    if (!emailTerakhir.has(r.id_agent)) emailTerakhir.set(r.id_agent, r.dikirim_pada);
  }

  let terkirim = 0;
  let bel = 0;
  let dilewati = 0;

  for (const a of agents) {
    /* Buang aset yang sudah masuk email sebelumnya untuk agent INI. Aset tanpa
       tanggal_dibuat dianggap baru — kehilangan satu kabar lebih buruk
       daripada satu pengulangan, dan barisnya memang seharusnya selalu ada.

       Aset dari pemindaian KRITERIA BARU dikecualikan dari penyaring ini.
       Aset itu memang lama — itu seluruh gunanya — dan menyaringnya dengan
       umur akan membuang semuanya untuk setiap agent yang pernah menerima satu
       email asisten. Yang menjaganya tidak berulang bukan umur, melainkan
       `terakhir_dipindai`: satu kriteria hanya pernah di-backfill SEKALI. */
    const batas = emailTerakhir.get(a.id_agent);
    const daftar = (perAgent.get(a.id_agent) ?? [])
      .map(t => {
        if (!batas) return t;
        const aset = new Map(
          [...t.aset].filter(([id, l]) =>
            t.backfill.has(id) || !l.tanggal_dibuat || l.tanggal_dibuat > batas,
          ),
        );
        return { ...t, aset };
      })
      .filter(t => t.aset.size > 0)
      .sort((x, y) => y.aset.size - x.aset.size)
      .slice(0, MAKS_KLIEN_EMAIL);

    /* Tidak ada yang benar-benar baru bagi agent ini → jangan klaim slotnya.
       Mengklaim slot untuk email yang tidak jadi dikirim akan membakar jatah
       enam jam ke depan, dan aset yang masuk sepuluh menit lagi harus menunggu
       tanpa alasan. */
    if (daftar.length === 0) continue;

    /* `?email=0` berhenti SEBELUM klaim slot. Sebelumnya ia tetap mengklaim
       dan tetap membuat notifikasi — artinya satu pengujian membakar jatah
       kirim agent selama enam jam, dan putaran sungguhan sesudahnya diam.
       Bendera untuk menguji tidak boleh mengubah keadaan produksi. */
    if (tanpaEmail) { dilewati++; continue; }

    /* Klaim slotnya. Ditolak = agent ini sudah dapat email di jendela waktu
       yang sama; kabarnya tetap ada di CRM dan di daftar tugas. */
    const klaim = await prisma.emailAsisten.createMany({
      data: [{
        id_agent: a.id_agent,
        kunci,
        jumlah_klien: daftar.length,
        jumlah_aset: daftar.reduce((n, t) => n + t.aset.size, 0),
      }],
      skipDuplicates: true,
    });
    if (klaim.count === 0) { dilewati++; continue; }

    /* Foto disiapkan SEKALI untuk seluruh surat, dari aset yang benar-benar
       akan ditampilkan — bukan dari seluruh temuan. Mengambil foto aset yang
       tidak masuk kartu adalah pekerjaan jaringan yang dibuang. */
    const asetTampil = daftar.flatMap(t =>
      [...t.aset.entries()]
        .sort((x, y) => (t.skor.get(y[0]) ?? 0) - (t.skor.get(x[0]) ?? 0))
        .slice(0, ASET_PER_KLIEN_EMAIL)
        .map(([, l]) => ({ id_property: l.id_property, gambar: l.gambar })),
    );
    const inline = await siapkanFotoInline(asetTampil, MAKS_FOTO_INLINE);

    const blokKlien = daftar.map(t => bangunBlokKlien(t, a.id_agent, inline));
    const totalAset = daftar.reduce((n, t) => n + t.aset.size, 0);

    /* Lonceng di dalam aplikasi ikut memakai rem yang sama. Kalau ia berdiri
       sendiri, putaran tiap dua jam akan menumpuk notifikasi sepanjang hari —
       dan lonceng yang selalu penuh adalah lonceng yang berhenti dilihat.
       Yang tetap seketika adalah daftar TUGAS, yang memang tempatnya. */
    if (a.id_pengguna) {
      await prisma.notifikasi.create({
        data: {
          id_pengguna: a.id_pengguna,
          tipe: "REKOMENDASI_ASET",
          judul: "Aset baru untuk klien Anda",
          pesan: daftar.length === 1
            ? `${totalAset} aset baru cocok untuk ${daftar[0].nama}.`
            : `${totalAset} aset baru cocok untuk ${daftar.length} klien Anda.`,
          /* Diarahkan ke CRM, bukan ke daftar Tugas: di CRM ada panel "Siap
             dikirim" yang membuat kabarnya bisa langsung ditindaklanjuti dalam
             dua ketukan. */
          link: "/dashboard/crm",
          id_agent_ref: a.id_agent,
        },
      });
      bel++;
    }

    /* Alamat email diperiksa DI SINI, bukan di awal. Diperiksa lebih dulu, ia
       akan ikut membatalkan loncengnya juga — dan agent yang alamat emailnya
       kosong justru yang paling butuh loncengnya. */
    const email = (a.pengguna?.email || "").trim();
    if (!email) { dilewati++; continue; }

    const hasil = await sendAsistenAsetEmail(email, {
      agentName: a.pengguna?.nama_lengkap ?? null,
      klien: blokKlien,
      totalAset,
      lampiran: [...inline.values()],
    });

    if (hasil.delivered) {
      terkirim++;
      await prisma.emailAsisten.updateMany({
        where: { id_agent: a.id_agent, kunci },
        data: { terkirim: true },
      });
    }
    /* Gagal kirim TIDAK menghapus klaimnya. Menghapusnya berarti putaran
       berikutnya mencoba lagi 15 menit kemudian, dan SMTP yang sedang mati
       akan melahirkan percobaan tanpa henti. Kabarnya tetap utuh di CRM;
       yang hilang cuma satu email, dan `terkirim = false` mencatat itu. */
  }

  return { agent: agents.length, email: terkirim, notifikasi: bel, dilewati };
}

/* ── 3. KLIEN YANG DIDIAMKAN ───────────────────────────────────────────── */

async function pindaiKlienSepi(dryRun: boolean) {
  const batas = new Date(Date.now() - HARI_SEPI * HARI_MS);

  const sepi = await prisma.klien.findMany({
    where: {
      status: { notIn: ["closing", "lost_iseng"] },
      OR: [
        { tanggal_kontak_terakhir: { lt: batas } },
        /* Klien yang BELUM PERNAH dihubungi sama sekali dihitung dari tanggal
           masuknya. Justru merekalah yang paling sering hilang — tidak ada
           kontak terakhir yang bisa kedaluwarsa, jadi tanpa cabang ini mereka
           tak pernah muncul di daftar mana pun. */
        { tanggal_kontak_terakhir: null, tanggal_masuk: { lt: batas } },
      ],
    },
    select: { id_klien: true, id_agent: true, nama: true, tanggal_kontak_terakhir: true, tanggal_masuk: true },
    /* Urutan WAJIB ada. `take` tanpa ORDER BY membuat Postgres bebas memilih
       500 baris mana pun, dan pilihannya berubah tiap putaran — sebagian klien
       terdiam tidak akan pernah muncul di daftar tugas siapa pun, tanpa satu
       pun tanda.

       Urutannya juga bermakna, bukan sekadar tetap: yang PALING LAMA didiamkan
       dilayani lebih dulu, dan klien yang belum pernah dihubungi sama sekali
       (NULL) berada paling depan — justru merekalah yang paling sering hilang,
       karena tidak ada kontak terakhir yang bisa kedaluwarsa. */
    orderBy: { tanggal_kontak_terakhir: { sort: "asc", nulls: "first" } },
    take: MAKS_KLIEN_SEPI,
  });
  if (sepi.length === 0) return { klien: 0, tugas: 0, perAgent: new Map<string, number>() };

  const hari = tanggalKunci();
  const perAgent = new Map<string, number>();
  const tugas = sepi.map(k => {
    perAgent.set(k.id_agent, (perAgent.get(k.id_agent) ?? 0) + 1);
    const acuan = k.tanggal_kontak_terakhir ?? k.tanggal_masuk;
    const hariSepi = Math.floor((Date.now() - new Date(acuan).getTime()) / HARI_MS);
    return {
      id_agent: k.id_agent,
      id_klien: k.id_klien,
      judul: `Follow-up ${k.nama} — ${hariSepi} hari tanpa kontak`,
      catatan: "Dibuat otomatis oleh asisten preferensi klien.",
      kategori: "FOLLOWUP" as const,
      prioritas: (hariSepi >= 30 ? "TINGGI" : "SEDANG") as "TINGGI" | "SEDANG",
      is_auto_generated: true,
      kunci_otomatis: `SEPI:${k.id_klien}:${hari}`,
      tanggal_selesai: new Date(Date.now() + HARI_MS),
    };
  });

  if (dryRun) return { klien: sepi.length, tugas: 0, perAgent };
  const hasil = await prisma.tugas.createMany({ data: tugas, skipDuplicates: true });
  return { klien: sepi.length, tugas: hasil.count, perAgent };
}

/* ── Notifikasi ────────────────────────────────────────────────────────── */

/** SATU notifikasi per agent per putaran, berisi ringkasan. Notifikasi per
 *  kejadian akan mengubur lonceng dan membuat agent membiasakan diri
 *  mengabaikannya — setelah itu tidak ada notifikasi apa pun yang berguna
 *  lagi, termasuk yang benar-benar penting. */
async function beriTahuAgent(perAgent: Map<string, number>, jenis: "PERUBAHAN_ASET" | "REKOMENDASI_ASET", dryRun: boolean) {
  if (perAgent.size === 0 || dryRun) return 0;

  const agents = await prisma.agent.findMany({
    where: { id_agent: { in: [...perAgent.keys()] } },
    select: { id_agent: true, id_pengguna: true },
  });

  const data = agents.map(a => {
    const n = Math.min(perAgent.get(a.id_agent) ?? 0, MAKS_TUGAS_PER_AGENT);
    return {
      id_pengguna: a.id_pengguna,
      tipe: jenis,
      judul: jenis === "PERUBAHAN_ASET" ? "Aset yang Anda kirim berubah" : "Aset baru untuk klien Anda",
      pesan:
        jenis === "PERUBAHAN_ASET"
          ? `${n} aset yang pernah Anda kirim ke klien berubah harga atau statusnya. Kabari mereka sebelum mereka bertanya.`
          : `${n} klien Anda punya aset baru yang cocok dengan kriterianya.`,
      /* Diarahkan ke CRM, bukan ke daftar Tugas: di CRM ada panel "Siap
         dikirim" yang membuat kabarnya bisa langsung ditindaklanjuti dalam dua
         ketukan. Notifikasi yang mendarat di daftar tugas hanya memindahkan
         pekerjaan mencari, tidak menghapusnya. */
      link: "/dashboard/crm",
      id_agent_ref: a.id_agent,
    };
  });

  const hasil = await prisma.notifikasi.createMany({ data });
  return hasil.count;
}

/* ── Mode diagnosa ─────────────────────────────────────────────────────────
   "Saya sudah menambah aset yang cocok, kenapa tidak ada email?"

   Pertanyaan itu punya sebelas jawaban yang mungkin, dan sepuluh di antaranya
   tidak meninggalkan jejak apa pun: klien berstatus closing, agent tanpa
   alamat email, jam tenang, jatah kirim yang belum habis masa remnya, tanda
   air yang sudah melewati listingnya, penjadwal yang memang tidak hidup di
   mode pengembangan. Semuanya "berhasil" — tidak ada galat, tidak ada log,
   hanya sunyi.

   Sistem yang matang bukan yang tidak pernah diam; ia yang bisa MENJELASKAN
   diamnya. Mode ini menelusuri tiap gerbang dengan urutan yang sama persis
   dengan jalur sungguhan, lalu melaporkan gerbang mana yang menahan. */

type Gerbang = { lolos: boolean; nama: string; sebab: string };

async function diagnosa(idKlienDicari: string | null) {
  const { tanggal, jam } = jamWib();
  const catatan: Gerbang[] = [];

  /* ── Lapis 1: apakah ada bahan bakarnya sama sekali ── */
  const [airDibuat, airDiubah] = await Promise.all([
    bacaTandaAir(KUNCI_AIR.dibuat),
    bacaTandaAir(KUNCI_AIR.diubah),
  ]);
  const terbaru = await prisma.listing.aggregate({ _max: { tanggal_dibuat: true } });
  const belumDiproses = await prisma.listing.count({
    where: {
      status_tayang: "TERSEDIA", bukan_properti: false,
      OR: [{ tanggal_dibuat: { gt: airDibuat } }, { tanggal_diupdate: { gt: airDiubah } }],
    },
  });

  catatan.push({
    lolos: belumDiproses > 0,
    nama: "Ada listing yang belum diproses",
    sebab: belumDiproses > 0
      ? `${belumDiproses} listing menunggu diproses.`
      : `Tidak ada. Listing terbaru dibuat ${terbaru._max.tanggal_dibuat?.toISOString() ?? "—"}, ` +
        `sementara tanda air sudah di ${airDibuat.toISOString()}. ` +
        `Kalau Anda baru saja menambah properti, PERIKSA apakah ia benar-benar tersimpan.`,
  });

  catatan.push({
    lolos: process.env.NODE_ENV === "production",
    nama: "Penjadwal otomatis hidup",
    sebab: process.env.NODE_ENV === "production"
      ? "Mode produksi — penjadwal di server.js aktif (aset baru tiap 2 jam, 08–20 WIB)."
      : "TIDAK di mode pengembangan. Penjadwalnya ada di server.js, yang hanya dijalankan " +
        "`node server.js` (produksi/cPanel) — `next dev` tidak pernah menjalankannya. " +
        "Di dev, panggil endpoint ini manual untuk memicunya.",
  });

  catatan.push({
    lolos: jam >= JAM_EMAIL_MULAI && jam < JAM_EMAIL_SELESAI,
    nama: "Di dalam jam kirim",
    sebab: jam >= JAM_EMAIL_MULAI && jam < JAM_EMAIL_SELESAI
      ? `Sekarang ${jam}:00 WIB, di dalam jendela ${JAM_EMAIL_MULAI}–${JAM_EMAIL_SELESAI}.`
      : `Sekarang ${jam}:00 WIB, DI LUAR jendela ${JAM_EMAIL_MULAI}–${JAM_EMAIL_SELESAI}. ` +
        `Pemindaian tetap jalan dan tugas tetap dibuat; hanya emailnya menunggu pagi.`,
  });

  catatan.push({
    lolos: isMailConfigured(),
    nama: "SMTP terkonfigurasi",
    sebab: isMailConfigured()
      ? "GMAIL_USER & GMAIL_APP_PASSWORD terisi."
      : "GMAIL_USER / GMAIL_APP_PASSWORD kosong — email hanya dicatat di console.",
  });

  /* ── Lapis 2: per klien ── */
  const klienSemua = await prisma.klien.findMany({
    where: idKlienDicari ? { id_klien: idKlienDicari } : {},
    orderBy: { id_klien: "asc" },
    take: idKlienDicari ? 1 : 25,
    select: {
      id_klien: true, nama: true, status: true, id_agent: true, id_properti_asal: true,
      preferensi: { select: { id_preferensi: true, terakhir_dipindai: true } },
      agent: { select: { pengguna: { select: { email: true } } } },
    },
  });

  const slotKunci = `ASETBARU:${tanggal}:${Math.floor(jam / JEDA_EMAIL_JAM)}`;
  const perKlien = [];

  for (const k of klienSemua) {
    const gerbang: Gerbang[] = [];

    const statusOk = !["closing", "lost_iseng"].includes(k.status);
    gerbang.push({
      lolos: statusOk, nama: "Status klien",
      sebab: statusOk ? `"${k.status}" — ikut dipindai.`
        : `"${k.status}" — SENGAJA diabaikan: klien yang menuju akad atau sudah hangus tidak dikirimi tawaran baru.`,
    });

    const punyaPref = k.preferensi.length > 0;
    gerbang.push({
      lolos: punyaPref, nama: "Punya preferensi",
      sebab: punyaPref ? `${k.preferensi.length} baris kriteria.`
        : "Belum ada kriteria sama sekali — tidak ada yang bisa dicocokkan. Tambahkan lewat kartu klien.",
    });

    const email = (k.agent?.pengguna?.email || "").trim();
    gerbang.push({
      lolos: !!email, nama: "Agent punya alamat email",
      sebab: email ? email : "Kosong — lonceng tetap muncul, tapi email tidak bisa dikirim.",
    });

    const slot = await prisma.emailAsisten.findFirst({
      where: { id_agent: k.id_agent, kunci: slotKunci },
      select: { dikirim_pada: true, terkirim: true },
    });
    gerbang.push({
      lolos: !slot, nama: "Jatah kirim belum terpakai",
      sebab: slot
        ? `Sudah terpakai pada ${slot.dikirim_pada.toISOString()} (terkirim=${slot.terkirim}). ` +
          `Satu agent maksimal satu email per ${JEDA_EMAIL_JAM} jam.`
        : `Belum terpakai untuk slot ${slotKunci}.`,
    });

    /* Hitung kecocokan sungguhan — hanya kalau gerbang sebelumnya lolos, supaya
       diagnosa tidak menjalankan query mahal untuk klien yang jelas tertahan. */
    let cocok: number | null = null;
    if (statusOk && punyaPref) {
      /* Lewat pintu yang sama dengan jalur sungguhan. Diagnosa yang memakai
         pengecualian lebih longgar akan melaporkan "12 aset cocok" untuk klien
         yang sebenarnya tidak akan menerima satu pun — dan urutan gerbang
         diagnosa memang WAJIB sama persis dengan jalur sungguhan. */
      const kecuali = gabung(
        await muatDikecualikan([k.id_klien]), k.id_klien, k.id_properti_asal,
      );
      const prefs = await prisma.preferensiKlien.findMany({ where: { id_klien: k.id_klien } });
      const set = new Set<string>();
      for (const p of prefs) {
        const r = await cariCocok<any>(prisma, keKriteria(p as any), {
          kecuali, select: SELECT_ASET_BARU, maks: KOLAM_PREFERENSI_BARU,
        });
        for (const l of r) set.add(l.id_property.toString());
      }
      cocok = set.size;
    }

    perKlien.push({
      id_klien: k.id_klien,
      nama: k.nama,
      status: k.status,
      preferensi: k.preferensi.length,
      menungguBackfill: k.preferensi.filter(p => p.terakhir_dipindai === null).length,
      asetCocokSekarang: cocok,
      akanDikabari: gerbang.every(g => g.lolos) && (cocok ?? 0) > 0,
      gerbang,
    });
  }

  return {
    ok: true as const,
    mode: "diagnosa" as const,
    waktuWib: `${tanggal} ${String(jam).padStart(2, "0")}:00`,
    sistem: catatan,
    tandaAir: { dibuat: airDibuat.toISOString(), diubah: airDiubah.toISOString() },
    klien: perKlien,
    saran: perKlien.some(k => k.akanDikabari)
      ? "Ada klien yang memenuhi semua gerbang. Jalankan `?jenis=asetbaru` untuk memicunya sekarang."
      : "Tidak ada klien yang lolos seluruh gerbang. Lihat `gerbang` per klien untuk sebabnya.",
  };
}

/* ── Mode uji ──────────────────────────────────────────────────────────── */

async function kirimEmailUji(tujuan: string) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(tujuan)) {
    return { ok: false as const, mode: "test" as const, error: "Alamat email tidak sah" };
  }

  /* Cari klien nyata yang PUNYA kecocokan, apa pun statusnya — mode uji tidak
     terikat aturan "closing/lost_iseng diabaikan", karena tujuannya melihat
     bentuk emailnya, bukan menentukan siapa yang layak dikabari. */
  const kandidat = await prisma.preferensiKlien.findMany({
    orderBy: { id_preferensi: "asc" },
    take: 12,
    include: {
      klien: {
        select: {
          id_klien: true, id_agent: true, nama: true, id_properti_asal: true,
          tanggal_kontak_terakhir: true, tanggal_masuk: true,
        },
      },
    },
  });
  if (kandidat.length === 0) {
    return { ok: false as const, mode: "test" as const, error: "Belum ada preferensi klien untuk dijadikan contoh" };
  }

  const petaDikecualikan = await muatDikecualikan([...new Set(kandidat.map(p => p.id_klien))]);
  const perKlien = new Map<string, TemuanKlien>();

  for (const p of kandidat) {
    if (perKlien.size >= 2) break; // dua blok sudah cukup mewakili
    const k = keKriteria(p);
    const kecuali = gabung(petaDikecualikan, p.id_klien, p.klien.id_properti_asal);
    const daftar = await cariCocok<any>(prisma, k, {
      kecuali, select: SELECT_ASET_BARU, maks: KOLAM_PREFERENSI_BARU,
    }) as AsetCocok[];
    if (daftar.length === 0) continue;
    let t = perKlien.get(p.id_klien);
    if (!t) { t = temuanBaru(p); perKlien.set(p.id_klien, t); }
    for (const l of daftar) catatCocok(t, p, k, l);
  }

  const temuan = [...perKlien.values()];
  if (temuan.length === 0) {
    return { ok: false as const, mode: "test" as const, error: "Tidak ada aset yang cocok untuk dijadikan contoh" };
  }

  const idAgent = temuan[0].id_agent;
  const agent = await prisma.agent.findUnique({
    where: { id_agent: idAgent },
    select: { pengguna: { select: { nama_lengkap: true } } },
  });

  const asetTampil = temuan.flatMap(t =>
    [...t.aset.entries()]
      .sort((x, y) => (t.skor.get(y[0]) ?? 0) - (t.skor.get(x[0]) ?? 0))
      .slice(0, ASET_PER_KLIEN_EMAIL)
      .map(([, l]) => ({ id_property: l.id_property, gambar: l.gambar })),
  );
  const inline = await siapkanFotoInline(asetTampil, MAKS_FOTO_INLINE);

  const blok = temuan.map(t => bangunBlokKlien(t, idAgent, inline));
  const totalAset = temuan.reduce((n, t) => n + t.aset.size, 0);
  const hasil = await sendAsistenAsetEmail(tujuan, {
    agentName: agent?.pengguna?.nama_lengkap ?? null,
    klien: blok,
    totalAset,
    lampiran: [...inline.values()],
  });

  return {
    ok: true as const,
    mode: "test" as const,
    tujuan,
    terkirim: hasil.delivered,
    catatan: hasil.delivered
      ? "Email contoh terkirim. Periksa tampilannya di klien email sungguhan, lalu ketuk tombolnya — ia akan mendarat di halaman konfirmasi, bukan langsung mencatat."
      : hasil.reason ?? "Tidak terkirim",
    blokKlien: blok.map(b => ({ nama: b.nama, kriteria: b.kriteria, total: b.total, aset: b.aset.length })),
    totalAset,
  };
}

/* ── Handler ───────────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  const izin = sahkan(req);
  if (!izin.boleh) return NextResponse.json({ ok: false, message: izin.sebab }, { status: 401 });

  const url = new URL(req.url);
  const jenis = (url.searchParams.get("jenis") || "perubahan").toLowerCase();
  const dryRun = url.searchParams.get("dryRun") === "1";
  /* ?email=0 mematikan pengirimannya tanpa mematikan pemindaiannya — dipakai
     saat menguji di staging, di mana alamat email agent-nya nyata. */
  const tanpaEmail = url.searchParams.get("email") === "0";

  /* ── MODE UJI ──────────────────────────────────────────────────────────
     `?test=alamat@email.com` mengirim SATU email contoh ke alamat itu dan
     berhenti. Tidak mengklaim slot, tidak membuat notifikasi, tidak menyentuh
     tanda air, tidak menandai preferensi.

     Ada karena tiga hal hanya bisa dibuktikan dengan email sungguhan: SMTP
     benar-benar tersambung, tampilannya benar di Gmail/Outlook (bukan cuma
     valid secara HTML), dan tombolnya benar-benar membuka WhatsApp. Ketiganya
     tidak bisa diuji dari kode, dan menunggu email produksi pertama untuk
     menemukan bahwa salah satunya rusak adalah cara yang mahal.

     Isinya disusun dari DATA NYATA lewat bangunBlokKlien() yang sama dengan
     jalur produksi — email contoh yang disusun terpisah akan berhenti mewakili
     email yang sebenarnya dikirim, dan pengujian yang tidak mewakili produksi
     memberi rasa aman yang keliru. */
  /* ?diagnosa=1 atau ?diagnosa=KL00002 — menjelaskan kenapa tidak ada email. */
  const mintaDiagnosa = url.searchParams.get("diagnosa");
  if (mintaDiagnosa) {
    try {
      return NextResponse.json(await diagnosa(mintaDiagnosa === "1" ? null : mintaDiagnosa));
    } catch (e: any) {
      console.error("[rekomendasi-klien:diagnosa] gagal:", e?.message || e);
      return NextResponse.json({ ok: false, mode: "diagnosa", error: String(e?.message || e) }, { status: 200 });
    }
  }

  const tujuanUji = url.searchParams.get("test");
  if (tujuanUji) {
    try {
      return NextResponse.json(await kirimEmailUji(tujuanUji));
    } catch (e: any) {
      console.error("[rekomendasi-klien:test] gagal:", e?.message || e);
      return NextResponse.json({ ok: false, mode: "test", error: String(e?.message || e) }, { status: 200 });
    }
  }

  const mulai = Date.now();
  const laporan: Record<string, unknown> = { ok: true, jenis, dryRun };

  try {
    if (jenis === "perubahan" || jenis === "semua") {
      const r = await pindaiPerubahan(dryRun);
      laporan.perubahan = { dipindai: r.dipindai, kabarBaru: r.baru, tugasDibuat: r.tugas };
      laporan.notifikasiPerubahan = await beriTahuAgent(r.perAgent, "PERUBAHAN_ASET", dryRun);
    }

    /* Aset baru dipisahkan dari "harian" supaya bisa berjalan tiap dua jam.
       Yang mahal di putaran harian adalah pemindaian klien sepi, bukan ini —
       pemindaian aset baru berhenti pada satu query bila tanda airnya sudah
       menyusul, dan di kantor yang sepi itulah yang terjadi hampir selalu. */
    if (jenis === "asetbaru" || jenis === "harian" || jenis === "semua") {
      const baru = await pindaiAsetBaru(dryRun);
      const kriteriaBaru = await pindaiPreferensiBaru(dryRun);

      laporan.asetBaru = {
        listingDiproses: baru.listingBaru,
        preferensiDipindai: baru.preferensi,
        preferensiTerpotong: baru.preferensiTerpotong > 0,
        klienDapat: baru.klienDapat,
        tugasDibuat: baru.tugas,
      };
      laporan.kriteriaBaru = {
        preferensiDipindai: kriteriaBaru.preferensi,
        klienDapat: kriteriaBaru.klienDapat,
        tugasDibuat: kriteriaBaru.tugas,
      };

      /* SATU email per agent untuk KEDUA sumber. Dua email berturut-turut —
         "3 aset baru" lalu "100 aset untuk kriteria baru" — adalah dua kali
         gangguan untuk satu kali pekerjaan, dan yang kedua akan dibaca sebagai
         pengulangan lalu diabaikan. Temuan digabung per klien lebih dulu. */
      laporan.kabarAsetBaru = await kabariAsetBaru(
        gabungTemuan(baru.temuan, kriteriaBaru.temuan), dryRun, tanpaEmail,
      );
    }

    if (jenis === "harian" || jenis === "semua") {
      const sepi = await pindaiKlienSepi(dryRun);
      laporan.klienSepi = { klien: sepi.klien, tugasDibuat: sepi.tugas };
    }
  } catch (e: any) {
    /* Cron yang melempar 500 akan dicoba ulang scheduler dan gagal lagi dengan
       cara yang sama. Lebih berguna melaporkan apa yang gagal dengan status
       200 supaya log scheduler memuat sebabnya, bukan cuma kodenya. */
    console.error("[rekomendasi-klien] gagal:", e?.message || e);
    return NextResponse.json({ ok: false, jenis, error: String(e?.message || e) }, { status: 200 });
  }

  laporan.durasiMs = Date.now() - mulai;
  return NextResponse.json(laporan);
}

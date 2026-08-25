// src/lib/klienRingkas.ts
// ---------------------------------------------------------------------------
// Satu preferensi → satu baris yang bisa dibaca manusia.
//
// Terpisah dari klienMatch.ts dengan sengaja: berkas itu MEMUTUSKAN, berkas
// ini MENJELASKAN. Dipakai di tiga tempat yang harus mengucapkan hal yang
// sama — chip preferensi di layar Asisten Aset, judul blok di email aset baru,
// dan judul tugas otomatis. Begitu kalimatnya disalin ke salah satunya, agent
// akan membaca "Rumah · Gresik" di layar dan "Rumah Gresik ≤ 500 jt" di email
// untuk kriteria yang sama, lalu ragu apakah keduanya benda yang sama.
// ---------------------------------------------------------------------------

import type { Prisma } from "@prisma/client";

/* Seluruh nilai `kategori_properti_enum`, tidak kurang satu pun. Versi pertama
   memuat VILLA/HOTEL/KANTOR yang TIDAK ADA di enum, sementara TOKO dan
   HOTEL_DAN_VILLA yang benar-benar dipakai justru hilang — akibatnya pill di
   layar menulis "TOKO" dan "HOTEL_DAN_VILLA" mentah-mentah di tengah label
   yang rapi. Kalau enumnya bertambah, daftar ini ikut. */
const TIPE_LABEL: Record<string, string> = {
  RUMAH: "Rumah",
  APARTEMEN: "Apartemen",
  RUKO: "Ruko",
  TANAH: "Tanah",
  GUDANG: "Gudang",
  HOTEL_DAN_VILLA: "Hotel & Villa",
  TOKO: "Toko",
  PABRIK: "Pabrik",
  KOS: "Kos",
};

const angka = (v: Prisma.Decimal | number | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);

/* ── DIMENSI LUAS ──────────────────────────────────────────────────────────
   Preferensi hanya punya SATU pasang kolom luas, dan mesin pencocokan
   (`luasMengikat()` di klienMatch.ts) membandingkannya dengan LUAS TANAH —
   kecuali untuk apartemen, yang memang tidak punya tanah.

   Label WAJIB mengatakan yang mana. Kolom bertuliskan "Luas Min" adalah
   sumber bug yang baru saja diperbaiki: agent mengetik 500 untuk gudang,
   bermaksud luas tanah, sementara mesin menerima luas bangunan juga. Kalau
   layarnya sendiri tidak menyebut dimensinya, agent tidak punya cara menduga
   angka mana yang sedang dibandingkan — dan ia akan menyalahkan hasilnya,
   bukan isiannya. */

/** Dimensi yang mengikat untuk sekumpulan tipe yang dipilih bersamaan.
 *  Apartemen hanya jadi "bangunan" bila ia SATU-SATUNYA tipe: "apartemen atau
 *  ruko, minimal 100 m²" tetap diukur dari tanah, sama seperti mesinnya
 *  (baris ruko memakai luas tanah, baris apartemen memakai luas unit). */
export function dimensiLuas(tipes: (string | null | undefined)[]): "TANAH" | "BANGUNAN" {
  const t = tipes.filter(Boolean) as string[];
  return t.length > 0 && t.every(x => x === "APARTEMEN") ? "BANGUNAN" : "TANAH";
}

/** "Luas tanah" / "Luas bangunan" — untuk label formulir. */
export function labelLuas(tipes: (string | null | undefined)[]): string {
  return dimensiLuas(tipes) === "BANGUNAN" ? "Luas bangunan" : "Luas tanah";
}

/** "LT" / "LB" — untuk chip & label ringkas yang ruangnya sempit. */
export function singkatanLuas(tipes: (string | null | undefined)[]): string {
  return dimensiLuas(tipes) === "BANGUNAN" ? "LB" : "LT";
}

/** Rupiah sependek mungkin tanpa jadi ambigu. "Rp 1,5 M" bukan pemanisan:
 *  chip preferensi dan subjek email keduanya punya ruang yang sangat sempit,
 *  dan "Rp 1.500.000.000" memakan seluruhnya. */
export function rupiahPendek(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(".", ",").replace(",0", "")} M`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".", ",").replace(",0", "")} jt`;
  if (a >= 1e3) return `${Math.round(n / 1e3).toLocaleString("id-ID")} rb`;
  return Math.round(n).toLocaleString("id-ID");
}

export type PrefRingkas = {
  /** null = semua tipe. */
  tipe_properti: string | null;
  legalitas?: string | null;
  dekat_nilai?: string | null;
  alamat_teks?: string | null;
  maksud?: string | null;
  jenis_transaksi?: string | null;
  lokasi_dicari?: string | null;
  loc_kelurahan?: string | null;
  loc_kecamatan?: string | null;
  loc_kota?: string | null;
  loc_provinsi?: string | null;
  budget_min?: Prisma.Decimal | number | null;
  budget_max?: Prisma.Decimal | number | null;
};

/** Lokasi paling spesifik yang terisi — sama dengan yang MENGIKAT di mesin
 *  pencocokan. Menampilkan kotanya padahal yang mengikat kecamatannya akan
 *  membuat agent mengira mesinnya salah saat hasilnya lebih sedikit dari
 *  dugaannya. */
export function lokasiRingkas(p: PrefRingkas): string | null {
  return p.loc_kelurahan || p.loc_kecamatan || p.loc_kota || p.loc_provinsi || p.lokasi_dicari || null;
}

/** Label satu baris, mis. "Rumah · Gresik · ≤ 500 jt" atau "Kos · Sewa · Surabaya". */
/** Token tempat → teks yang bisa dibaca. Token menyimpan bentuk mesin
 *  ("brand:mie-gacoan", "kelas:HOTEL:surabaya"); yang perlu dilihat agent cuma
 *  namanya. Sengaja tanpa query kamus: label ini dipakai di pill, judul tugas,
 *  dan email — tiga tempat yang tidak boleh menunggu database hanya untuk
 *  merapikan satu kata. */
export function labelTempat(token: string): string {
  const t = token.trim();
  const isi = t.replace(/^(brand|cocok|kelas):/i, "").split(":")[0];
  return isi.replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function ringkasKriteria(p: PrefRingkas): string {
  const bagian: string[] = [p.tipe_properti ? (TIPE_LABEL[p.tipe_properti] ?? p.tipe_properti) : "Semua tipe"];

  /* Kata "Sewa" hanya ditulis untuk preferensi SEWA. BELI adalah keadaan
     normal dan menuliskannya di setiap chip cuma menambah panjang tanpa
     menambah arti — yang perlu menonjol justru yang menyimpang dari normal. */
  if ((p.maksud ?? "").toUpperCase() === "SEWA") bagian.push("Sewa");

  const lok = lokasiRingkas(p);
  if (lok) bagian.push(lok);
  if (p.legalitas) bagian.push(p.legalitas);
  if (p.dekat_nilai) bagian.push(`dekat ${labelTempat(p.dekat_nilai)}`);
  else if (p.alamat_teks) bagian.push(`alamat "${p.alamat_teks}"`);

  const bmin = angka(p.budget_min);
  const bmax = angka(p.budget_max);
  if (bmin && bmax) bagian.push(`${rupiahPendek(bmin)}–${rupiahPendek(bmax)}`);
  else if (bmax) bagian.push(`≤ ${rupiahPendek(bmax)}`);
  else if (bmin) bagian.push(`≥ ${rupiahPendek(bmin)}`);

  return bagian.join(" · ");
}

/* ── PENGELOMPOKAN PREFERENSI ──────────────────────────────────────────────
   Satu "preferensi" di mata agent BUKAN satu baris `preferensi_klien`.

   Formulirnya menerima beberapa tipe properti dan beberapa lokasi sekaligus,
   lalu menyimpannya sebagai perkalian keduanya: "Gudang di Surabaya, Sidoarjo,
   dan Gresik" menjadi TIGA baris. Agent yang mengisinya merasa membuat SATU
   kriteria, dan memang begitu — yang dibagi cuma penyimpanannya.

   Akibatnya kalau pengelompokan ini tidak ada: layar menampilkan empat pill
   untuk klien yang merasa punya dua kriteria, dan tidak ada penjelasan apa pun
   soal kenapa. Fungsi di bawah ini HARUS memberi hasil yang sama dengan
   pengelompokan di kartu klien (KlienDetailDrawer) — dua tempat yang
   mengelompokkan dengan aturan berbeda akan membuat agent melihat "2
   preferensi" di satu layar dan "4" di layar sebelahnya. */

/** Tanda tangan grup: SEMUA yang bukan tipe properti dan bukan lokasi.
 *  Tipe & lokasi sengaja dikeluarkan — justru merekalah yang dikalikan jadi
 *  banyak baris oleh formulir. */
export function kunciGrup(p: {
  jenis_transaksi?: string | null;
  budget_min?: Prisma.Decimal | number | null;
  budget_max?: Prisma.Decimal | number | null;
  luas_min?: Prisma.Decimal | number | null;
  luas_max?: Prisma.Decimal | number | null;
  tujuan_beli?: string | null;
  catatan?: string | null;
}): string {
  const n = (v: Prisma.Decimal | number | null | undefined) =>
    v === null || v === undefined ? "" : String(Number(v));
  return JSON.stringify([
    p.jenis_transaksi ?? "",
    n(p.budget_min), n(p.budget_max), n(p.luas_min), n(p.luas_max),
    p.tujuan_beli ?? "", p.catatan ?? "",
  ]);
}

const TIPE_URUT = (a: string, b: string) => a.localeCompare(b);

/** Label satu grup, mis. "Rumah · Gresik · ≤ 250 jt" atau
 *  "Gudang · Surabaya +2 · ≥ 1.000 m²".
 *
 *  Lokasi dipotong di dua, bukan ditulis semua: pill ini berdiri di baris yang
 *  bisa digulir, dan label sepanjang satu kalimat membuat pill berikutnya
 *  tidak pernah terlihat. */
export function ringkasGrup(rows: PrefRingkas[]): string {
  if (rows.length === 0) return "";

  /* Baris ber-tipe null berarti "semua tipe". Kalau SATU baris saja begitu,
     seluruh grup memang mencari semua tipe — menyebutkan tipe-tipe lain di
     sampingnya akan membaca seperti daftar yang membatasi, padahal tidak. */
  const semuaTipe = rows.some(r => !r.tipe_properti);
  const tipe = semuaTipe
    ? ["Semua tipe"]
    : [...new Set(rows.map(r => TIPE_LABEL[r.tipe_properti!] ?? r.tipe_properti!))].sort(TIPE_URUT);
  const lok = [...new Set(rows.map(lokasiRingkas).filter(Boolean) as string[])];

  /* Tipe dipotong di dua, sama seperti lokasi. Klien yang mencari "Gudang /
     Rumah / Tanah / Toko" menghasilkan pill sepanjang satu kalimat, dan pill
     berikutnya tidak pernah terlihat di baris yang bisa digulir — padahal
     justru MEMBANDINGKAN antar pill yang jadi gunanya. */
  const tipeTeks = tipe.length <= 2 ? tipe.join(" / ") : `${tipe.slice(0, 2).join(" / ")} +${tipe.length - 2}`;

  const bagian: string[] = [tipeTeks];
  if ((rows[0].maksud ?? "").toUpperCase() === "SEWA") bagian.push("Sewa");

  if (lok.length === 1) bagian.push(lok[0]);
  else if (lok.length > 1) bagian.push(`${lok[0]} +${lok.length - 1}`);

  const bmin = rows[0].budget_min == null ? null : Number(rows[0].budget_min);
  const bmax = rows[0].budget_max == null ? null : Number(rows[0].budget_max);
  if (bmin && bmax) bagian.push(`${rupiahPendek(bmin)}–${rupiahPendek(bmax)}`);
  else if (bmax) bagian.push(`≤ ${rupiahPendek(bmax)}`);
  else if (bmin) bagian.push(`≥ ${rupiahPendek(bmin)}`);

  /* Luas ikut ditulis hanya di label GRUP, tidak di label baris tunggal.
     Untuk klien yang mencari gudang tanpa plafon harga, luas minimum itulah
     satu-satunya angka yang membedakan satu kriteria dari yang lain — tanpa
     ditulis, dua pill bisa terbaca persis sama. */
  if (rows[0].legalitas) bagian.push(String(rows[0].legalitas));
  if (rows[0].dekat_nilai) bagian.push(`dekat ${labelTempat(rows[0].dekat_nilai)}`);
  else if (rows[0].alamat_teks) bagian.push(`alamat "${rows[0].alamat_teks}"`);

  const lmin = (rows[0] as any).luas_min == null ? null : Number((rows[0] as any).luas_min);
  const lmax = (rows[0] as any).luas_max == null ? null : Number((rows[0] as any).luas_max);
  /* "LT ≥ 500 m²", bukan "≥ 500 m²". Dua huruf, dan mereka yang menjawab
     pertanyaan pertama agent saat melihat hasil: 500 itu tanahnya atau
     bangunannya? */
  const dim = singkatanLuas(rows.map(r => r.tipe_properti));
  if (lmin && lmax) bagian.push(`${dim} ${lmin.toLocaleString("id-ID")}–${lmax.toLocaleString("id-ID")} m²`);
  else if (lmin) bagian.push(`${dim} ≥ ${lmin.toLocaleString("id-ID")} m²`);
  else if (lmax) bagian.push(`${dim} ≤ ${lmax.toLocaleString("id-ID")} m²`);

  return bagian.join(" · ");
}

/**
 * Bagi `limit` slot ke beberapa grup secara adil.
 *
 * INI YANG MEMPERBAIKI PILL KOSONG. Sebelumnya daftar dipotong "24 teratas"
 * secara global, dan skor antar kriteria tidak sebanding: rumah di Gresik
 * mencetak 66 sementara gudang mencetak 46, jadi 24 slot itu HABIS diisi
 * rumah. Pill "Gudang · 34" tetap menjanjikan 34 aset — dan begitu diketuk,
 * layarnya kosong. Angka yang benar di samping daftar yang kosong lebih buruk
 * daripada tidak ada angka sama sekali: ia membuat agent menyimpulkan
 * sistemnya rusak, dan ia benar.
 *
 * Pembagian rata saja tidak cukup: grup yang cuma punya 1 kecocokan tidak
 * boleh memegang 12 slot. Jadi tiap putaran membagi sisa slot ke sisa grup,
 * dibatasi persediaan masing-masing, dan kelebihannya mengalir ke grup lain.
 */
export function bagiSlot(tersedia: number[], limit: number): number[] {
  const jatah = new Array(tersedia.length).fill(0);
  let sisaSlot = limit;
  /* Grup dengan persediaan paling sedikit dilayani lebih dulu — merekalah yang
     jatahnya akan tersisa, dan sisanya harus sempat mengalir ke grup besar. */
  const urut = tersedia.map((n, i) => ({ n, i })).sort((a, b) => a.n - b.n);

  urut.forEach(({ n, i }, ke) => {
    const sisaGrup = urut.length - ke;
    const bagian = Math.min(n, Math.max(1, Math.floor(sisaSlot / sisaGrup)));
    jatah[i] = bagian;
    sisaSlot -= bagian;
  });

  /* Putaran kedua: slot yang belum terpakai diberikan ke grup yang masih punya
     persediaan, dari yang terbanyak. */
  if (sisaSlot > 0) {
    for (const { n, i } of [...urut].reverse()) {
      if (sisaSlot <= 0) break;
      const tambah = Math.min(sisaSlot, n - jatah[i]);
      jatah[i] += tambah;
      sisaSlot -= tambah;
    }
  }
  return jatah;
}

/* ── ALAMAT ────────────────────────────────────────────────────────────────
   `alamat_lengkap` terisi pada 100% listing dan jauh lebih berguna daripada
   rangkaian kelurahan/kecamatan/kota: di situlah nama jalan, komplek, blok,
   dan nomor kavling berada — hal-hal yang membuat agent tahu persis di mana
   asetnya tanpa membuka detailnya. Sebagian baris bahkan punya alamat lengkap
   sementara kolom kelurahan & kecamatannya kosong.

   Persoalannya bentuknya. 31.137 dari 120.393 baris (26%) TERTULIS SELURUHNYA
   HURUF BESAR, karena begitulah datang dari lelang.go.id. Menampilkannya apa
   adanya membuat seperempat kartu berteriak, dan teks yang berteriak justru
   lebih lambat dibaca. */

/** Kata yang HARUS tetap huruf besar sesudah dirapikan. Tanpa daftar ini,
 *  "RT 03 RW 05" berubah jadi "Rt 03 Rw 05" — terbaca seperti salah ketik.
 *  "NO" sengaja TIDAK di sini: "No. 12" memang bentuk lazimnya. */
const SINGKATAN_ALAMAT = new Set(["RT", "RW", "KM", "PT", "CV", "UD"]);

/** Kata yang SESUDAHNYA adalah kode, bukan nama. "Blok AE" yang dirapikan jadi
 *  "Blok Ae" kehilangan artinya sebagai kode blok, dan agent yang mencocokkan
 *  alamat dengan berkas lelang akan ragu apakah itu blok yang sama. */
const PENANDA_KODE = new Set(["BLOK", "KAV", "KAVLING", "LOT", "TIPE", "TYPE", "UNIT", "NO", "NOMOR"]);

export function rapikanAlamat(raw?: string | null): string {
  const t = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";

  /* Hanya baris yang benar-benar tanpa huruf kecil yang disentuh. Alamat yang
     sudah bercampur besar-kecil ditulis manusia dan sudah sebagaimana
     dimaksudkannya — merapikannya justru merusak nama diri seperti
     "Perum GKGA" atau "Ruko CitraLand". */
  if (/[a-z]/.test(t)) return t;

  const kata = t.split(" ");
  return kata
    .map((k, i) => {
      const bersih = k.replace(/[^A-Za-z]/g, "");
      if (SINGKATAN_ALAMAT.has(bersih)) return k;
      // Angka dibiarkan apa adanya ("51", "12A").
      if (/\d/.test(k)) return k;
      if (bersih.length <= 1) return k;
      /* Kode sesudah penanda: "Blok AE", "Kav C", "Lot D01". Dilihat dari kata
         SEBELUMNYA, bukan dari bentuk katanya sendiri — kalau tidak, "DAN" dan
         "DKK" ikut terselamatkan sebagai kode. */
      const sblm = (kata[i - 1] ?? "").replace(/[^A-Za-z]/g, "").toUpperCase();
      if (PENANDA_KODE.has(sblm) && bersih.length <= 4) return k;
      /* Huruf pertama tiap penggalan, bukan cuma huruf pertama kata:
         "DESA/KELURAHAN" harus jadi "Desa/Kelurahan", bukan "Desa/kelurahan". */
      return k.toLowerCase().replace(/(^|[\/\-.'])([a-z])/g, (_, pemisah, huruf) => pemisah + huruf.toUpperCase());
    })
    .join(" ");
}

/**
 * Buang alasan yang sudah terbaca dari baris lokasi.
 *
 * `alasanCocok()` selalu menyertakan kriteria lokasi ("Kabupaten Gresik") —
 * berguna di tempat yang tidak menampilkan lokasi, tapi di kartu dan di email
 * ia berdiri tepat di bawah "Driyorejo, Kab. Gresik". Chip yang mengulang
 * baris di atasnya bukan sekadar boros ruang: ia melatih mata untuk melewati
 * seluruh baris chip, termasuk "Rp 48 jt di bawah plafon" yang justru
 * satu-satunya angka yang menentukan apakah aset ini layak dikirim.
 *
 * Perbandingannya sengaja LONGGAR dan hanya untuk tampilan — sama sekali tidak
 * dipakai memutuskan kecocokan. Normalisasi yang sungguhan ada di
 * `normLok()` (src/lib/klienMatch.ts) dan tidak diimpor ke sini dengan sengaja:
 * berkas itu memuat impor nilai `Prisma`, dan menariknya ke komponen browser
 * berarti menyeret seluruh klien Prisma ke dalam bundel halaman.
 */
export function saringAlasan(alasan: string[] | undefined, lokasiTampil: string): string[] {
  if (!alasan || alasan.length === 0) return [];
  const sederhana = (x: string) =>
    x.toLowerCase()
      .replace(/\b(kota|kab|kabupaten|kecamatan|kelurahan|desa|provinsi)\b/g, "")
      .replace(/[^a-z0-9]/g, "");
  const lok = sederhana(lokasiTampil);
  if (!lok) return alasan;
  return alasan.filter(a => {
    const s = sederhana(a);
    return s.length > 0 && !lok.includes(s);
  });
}

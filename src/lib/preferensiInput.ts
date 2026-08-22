// src/lib/preferensiInput.ts
// ---------------------------------------------------------------------------
// SATU pintu masuk untuk menulis preferensi klien, dan satu pintu keluar untuk
// membacanya.
//
// KENAPA ADA. Sampai berkas ini dibuat, preferensi bisa lahir dari DUA jalur
// yang menulis kolom BERBEDA:
//
//   - POST /api/dashboard/klien              (preferensi ikut saat klien dibuat)
//   - POST /api/dashboard/klien/[id]/preferensi
//
// Jalur pertama diam-diam membuang `legalitas`, `dekat_nilai`, `dekat_radius`,
// dan `alamat_teks`, serta TIDAK PERNAH menurunkan `maksud` — sehingga klien
// yang mencari SEWA tersimpan sebagai BELI dan menerima kiriman aset jual.
// Jalur pertama juga tidak mewajibkan lokasi, sehingga formulir "Tambah Klien"
// bisa menyimpan kriteria tanpa wilayah: pencarian lalu menyapu 120 ribu aset
// se-Indonesia, dan agent melihat daftar yang jelas-jelas bukan yang ia minta.
//
// Dua jalur tulis yang berbeda untuk satu tabel akan SELALU menyimpang. Di
// sini keduanya dipaksa lewat `bacaPreferensi()`.
//
// `serialisasiPreferensi()` menutup masalah kembarannya di arah sebaliknya:
// Prisma mengembalikan Decimal, dan `NextResponse.json` mengubahnya jadi
// STRING. Baris hasil POST karena itu tidak pernah sebangun dengan baris hasil
// GET (yang sudah dikonversi ke number), dan layar CRM — yang mengelompokkan
// kartu preferensi dengan sidik jari JSON — membaca "500000000" dan 500000000
// sebagai dua kriteria berbeda. Akibatnya satu kartu pecah jadi dua tepat
// sesudah disunting.
// ---------------------------------------------------------------------------

import { turunkanMaksud } from "@/lib/klienMatch";

/** Rentang radius yang sama dengan CHECK di database. */
const RADIUS_MIN = 200;
const RADIUS_MAX = 20_000;

export type PreferensiTertulis = {
  tipe_properti: string | null;
  jenis_transaksi: string | null;
  maksud: string;
  lokasi_dicari: string | null;
  loc_provinsi: string | null;
  loc_kota: string | null;
  loc_kecamatan: string | null;
  loc_kelurahan: string | null;
  budget_min: number | null;
  budget_max: number | null;
  luas_min: number | null;
  luas_max: number | null;
  legalitas: string | null;
  dekat_nilai: string | null;
  dekat_radius: number | null;
  alamat_teks: string | null;
  tujuan_beli: string | null;
  catatan: string | null;
};

export type HasilBaca =
  | { ok: true; data: PreferensiTertulis }
  | { ok: false; message: string };

const teks = (v: unknown, maks: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, maks) : null;
};

/** Angka yang boleh "kosong". Nol DIPERLAKUKAN SEBAGAI KOSONG dengan sengaja:
 *  budget 0 dan luas 0 bukan kriteria, itu kolom yang tidak diisi — dan
 *  memperlakukannya sebagai batas nyata membuat `luas_min: 0` membuang setiap
 *  aset yang luasnya tidak tercatat. */
const angka = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Baca satu payload preferensi dari HTTP menjadi baris yang siap ditulis.
 *
 * Memvalidasi DI SERVER, bukan hanya di formulir. Formulir bisa dilewati, dan
 * baris cacat yang terlanjur masuk tidak menimbulkan galat apa pun — ia hanya
 * menghasilkan daftar aset yang salah, berbulan-bulan, tanpa siapa pun tahu
 * dari mana asalnya.
 */
export function bacaPreferensi(body: any): HasilBaca {
  /* -- LOKASI WAJIB ---------------------------------------------------------
     Yang wajib adalah LOKASI, bukan tipe. Tipe kosong berarti "semua tipe" —
     bawaan yang paling sering benar, karena klien menyebut daerah dan anggaran
     jauh lebih dulu daripada menyebut rumah atau ruko. Preferensi tanpa
     wilayah, sebaliknya, tidak pernah menghasilkan daftar yang berguna. */
  const loc_provinsi  = teks(body?.loc_provinsi, 150);
  const loc_kota      = teks(body?.loc_kota, 150);
  const loc_kecamatan = teks(body?.loc_kecamatan, 150);
  const loc_kelurahan = teks(body?.loc_kelurahan, 150);
  if (!loc_provinsi && !loc_kota && !loc_kecamatan && !loc_kelurahan) {
    return { ok: false, message: "Lokasi wajib diisi — minimal provinsi." };
  }

  const budget_min = angka(body?.budget_min);
  const budget_max = angka(body?.budget_max);
  const luas_min   = angka(body?.luas_min);
  const luas_max   = angka(body?.luas_max);

  /* Rentang terbalik DITOLAK, bukan ditukar diam-diam. "Rp 2 M sampai Rp 500
     jt" adalah salah ketik yang harus dilihat agent; menukarnya otomatis
     menyembunyikan kesalahan yang akan ia ulangi. */
  if (budget_min !== null && budget_max !== null && budget_min > budget_max) {
    return { ok: false, message: "Budget minimum lebih besar dari maksimum." };
  }
  if (luas_min !== null && luas_max !== null && luas_min > luas_max) {
    return { ok: false, message: "Luas minimum lebih besar dari maksimum." };
  }

  const tipe_properti   = teks(body?.tipe_properti, 40);
  const jenis_transaksi = teks(body?.jenis_transaksi, 20);

  /* Patokan tempat dan patokan alamat SALING MENIADAKAN. Memasang keduanya
     sekaligus berarti dua penyaring berjalan bersamaan — hampir selalu nol
     hasil, dan agent tidak akan menduga sebabnya. Yang menang adalah tempat:
     ia pilihan eksplisit dari kamus, sementara teks alamat cuma sisa ketikan. */
  const dekat_nilai  = teks(body?.dekat_nilai, 220);
  const alamatMentah = teks(body?.alamat_teks, 160);
  const alamat_teks  = dekat_nilai
    ? null
    : (alamatMentah && alamatMentah.length >= 3 ? alamatMentah : null);

  /* Radius di luar rentang wajar dijinakkan DI SINI juga, bukan diserahkan ke
     CHECK database: galat constraint muncul sebagai 500 yang tidak bisa dibaca
     agent, sementara mengabaikannya menghasilkan radius bawaan yang masuk akal. */
  const radiusMentah = Number(body?.dekat_radius);
  const dekat_radius =
    dekat_nilai &&
    Number.isFinite(radiusMentah) &&
    radiusMentah >= RADIUS_MIN &&
    radiusMentah <= RADIUS_MAX
      ? Math.round(radiusMentah)
      : null;

  /* Label lokasi dirakit ulang di server kalau pemanggil tidak mengirimnya.
     Kolom ini yang dibaca ringkasan, email, dan judul tugas — dibiarkan null,
     kriteria yang wilayahnya jelas ada akan terbaca "tanpa lokasi". */
  const induk = loc_kelurahan
    ? loc_kecamatan
    : loc_kecamatan
      ? loc_kota
      : loc_kota
        ? loc_provinsi
        : null;
  const lokasi_dicari =
    teks(body?.lokasi_dicari, 255) ??
    ([loc_kelurahan || loc_kecamatan || loc_kota || loc_provinsi, induk]
      .filter(Boolean)
      .join(", ") || null);

  return {
    ok: true,
    data: {
      tipe_properti,
      jenis_transaksi,
      /* Maksud diturunkan di server, tidak pernah dipercayakan pada form.
         Mesin pencocokan memakainya sebagai gerbang paling keras (BELI tidak
         pernah melihat listing SEWA), jadi ia tidak boleh bergantung pada satu
         pun pemanggil mengingat mengirimkannya. */
      maksud: turunkanMaksud(jenis_transaksi as any, tipe_properti as any, body?.maksud ?? null),
      lokasi_dicari,
      loc_provinsi,
      loc_kota,
      loc_kecamatan,
      loc_kelurahan,
      budget_min,
      budget_max,
      luas_min,
      luas_max,
      /* Enum: nilai asing ditolak database, jadi tidak perlu daftar putih di
         sini. Yang perlu dijaga cuma "" menjadi null — string kosong bukan
         nilai enum yang sah dan akan melempar galat, sementara maksudnya
         justru "tidak mempermasalahkan". */
      legalitas: teks(body?.legalitas, 20),
      dekat_nilai,
      dekat_radius,
      alamat_teks,
      tujuan_beli: teks(body?.tujuan_beli, 20),
      catatan: teks(body?.catatan, 500),
    },
  };
}

/** Baca SEKUMPULAN payload. Gagal pada baris mana pun menggagalkan semuanya —
 *  menyimpan sebagian dari kriteria yang agent anggap satu kesatuan adalah
 *  keadaan yang tidak bisa ia lihat maupun perbaiki. */
export function bacaBanyakPreferensi(
  rows: unknown,
): { ok: true; data: PreferensiTertulis[] } | { ok: false; message: string } {
  if (!Array.isArray(rows)) return { ok: true, data: [] };
  const hasil: PreferensiTertulis[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = bacaPreferensi(rows[i]);
    if (!r.ok) return { ok: false, message: `Preferensi #${i + 1}: ${r.message}` };
    hasil.push(r.data);
  }
  return { ok: true, data: hasil };
}

/** Baris preferensi menjadi JSON yang bentuknya SAMA dari endpoint mana pun.
 *  BigInt jadi string, Decimal jadi number. */
export function serialisasiPreferensi(p: any) {
  return {
    ...p,
    id_preferensi: String(p.id_preferensi),
    budget_min: p.budget_min == null ? null : Number(p.budget_min),
    budget_max: p.budget_max == null ? null : Number(p.budget_max),
    luas_min:   p.luas_min   == null ? null : Number(p.luas_min),
    luas_max:   p.luas_max   == null ? null : Number(p.luas_max),
  };
}

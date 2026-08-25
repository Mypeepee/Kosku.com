// src/lib/listingSortRuntime.ts
//
// ══════════════════════════════════════════════════════════════════════════
// LAPIS SISI-SERVER MESIN URUT — memilih kolom harga yang BENAR-BENAR terisi
// ══════════════════════════════════════════════════════════════════════════
//
// MASALAH YANG DIPECAHKAN
// `src/lib/listingSort.ts` murni: ia menyusun `orderBy` tanpa menyentuh
// database, karena berkas itu ikut dimuat komponen klien (SortSelect). Yang
// tidak bisa ia ketahui adalah apakah kolom yang ia sebut benar-benar berisi
// sesuatu DI DATABASE INI.
//
// Dan itu bukan kekhawatiran teoretis. `harga_efektif` adalah kolom TURUNAN:
// `prisma db push` membuat kolomnya (ada di schema.prisma), tapi yang mengisi
// adalah trigger + backfill di prisma/migration_harga_efektif.sql — SQL yang
// dijalankan manual per environment. Satu server yang terlewat menghasilkan
// kegagalan paling jahat yang bisa dibuat sebuah fitur:
//
//   • tidak ada exception — Postgres senang hati mengurutkan kolom NULL,
//   • tidak ada baris log,
//   • halaman tampil normal, jumlah hasil normal,
//   • "termurah" dan "termahal" mengembalikan daftar yang sama persis,
//   • dan filter harga min/maks (kolom yang sama) diam-diam nol hasil.
//
// Gejalanya: DI LOKAL BENAR, DI PRODUKSI TIDAK TERJADI APA-APA. Tidak ada satu
// pun tempat untuk mulai mencari, karena tidak ada yang tampak rusak.
//
// APA YANG DIKERJAKAN BERKAS INI
// Sekali per proses (dengan masa berlaku), ia bertanya ke database: pada tiap
// konteks halaman, apakah `harga_efektif` punya lebih dari satu nilai berbeda?
// Kalau ya — jalan normal, tidak ada biaya tambahan. Kalau tidak, ia jatuh ke
// kolom lain yang masih membawa informasi harga (`nilai_limit_lelang` untuk
// lelang, kalau tidak `harga`) dan MENERIAKKANNYA ke log dengan perintah yang
// harus dijalankan.
//
// Cadangannya bukan pengganti migrasi — `harga_efektif` tetap satu-satunya
// kolom yang mengerti harga promo, dan hanya ia yang punya index. Tapi
// "urutannya sedikit kurang tepat sambil berteriak di log" jauh lebih baik
// daripada "tombolnya tidak melakukan apa-apa dan tidak ada yang tahu kenapa".
//
// Periksa manual kapan saja:
//   node scripts/periksa-urut.mjs           (atau: npm run db:urut)
//   GET /api/diagnostik/urut?secret=$CRON_SECRET
// ══════════════════════════════════════════════════════════════════════════

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { buildOrderBy, type KonteksListing, type SortKey } from "@/lib/listingSort";

/** Kolom yang boleh dipakai untuk mengurut & memfilter harga, sesuai prioritas. */
export type KolomHarga = "harga_efektif" | "nilai_limit_lelang" | "harga";

const JENIS_PER_KONTEKS: Record<KonteksListing, string[]> = {
  JUAL: ["PRIMARY", "SECONDARY"],
  LELANG: ["LELANG"],
  SEWA: ["SEWA"],
  SEMUA: ["PRIMARY", "SECONDARY", "LELANG", "SEWA"],
};

/**
 * Berapa lama hasil pemeriksaan dipegang.
 *
 * Dua angka, karena dua keadaan yang sangat berbeda:
 *  • Sehat → 30 menit. Kolom yang sehat tidak tiba-tiba rusak (trigger yang
 *    menjaganya ikut diperiksa), jadi tidak ada gunanya bertanya lagi.
 *  • Rusak → 1 menit. Ini keadaan yang sedang seseorang perbaiki dengan
 *    menjalankan migrasinya. Begitu selesai, situs harus segera kembali ke
 *    jalur normal tanpa perlu me-restart proses.
 */
const BERLAKU_SEHAT_MS = 30 * 60_000;
const BERLAKU_RUSAK_MS = 60_000;

type Catatan = { kolom: KolomHarga; sampai: number };

const cache = new Map<KonteksListing, Catatan>();
// Permintaan pertama sesudah restart bisa datang berbarengan (bot, prefetch).
// Tanpa penampung ini, sepuluh permintaan menembakkan sepuluh pemeriksaan yang
// sama sekaligus.
const sedangPeriksa = new Map<KonteksListing, Promise<KolomHarga>>();
const sudahDiteriakkan = new Set<string>();

function teriakSekali(kunci: string, pesan: string) {
  if (sudahDiteriakkan.has(kunci)) return;
  sudahDiteriakkan.add(kunci);
  console.error(pesan);
}

/**
 * Kolom harga yang benar-benar bisa dipakai pada konteks ini.
 *
 * Tidak pernah melempar: kalau pemeriksaannya sendiri gagal (koneksi putus,
 * hak akses), jawabannya adalah jalur normal — halaman daftar tidak boleh mati
 * gara-gara pemeriksaan kesehatan yang gagal.
 */
export async function kolomHargaListing(konteks: KonteksListing): Promise<KolomHarga> {
  const tersimpan = cache.get(konteks);
  if (tersimpan && tersimpan.sampai > Date.now()) return tersimpan.kolom;

  const berjalan = sedangPeriksa.get(konteks);
  if (berjalan) return berjalan;

  const tugas = periksa(konteks)
    .catch(() => "harga_efektif" as KolomHarga)
    .then((kolom) => {
      const sehat = kolom === "harga_efektif";
      cache.set(konteks, {
        kolom,
        sampai: Date.now() + (sehat ? BERLAKU_SEHAT_MS : BERLAKU_RUSAK_MS),
      });
      sedangPeriksa.delete(konteks);
      return kolom;
    });

  sedangPeriksa.set(konteks, tugas);
  return tugas;
}

async function periksa(konteks: KonteksListing): Promise<KolomHarga> {
  const jenis = JENIS_PER_KONTEKS[konteks].map((j) => `'${j}'`).join(", ");

  // Contoh, bukan seluruh tabel: `LIMIT 2000` berhenti begitu cukup baris
  // terkumpul, jadi biayanya milidetik walau tabelnya 122 ribu baris. Yang
  // ditanya bukan "berapa nilainya" melainkan "apakah kolom ini membedakan
  // apa pun" — satu nilai berbeda saja (atau nol, artinya semuanya NULL)
  // berarti ORDER BY di atasnya tidak mengurutkan apa-apa.
  const baris = await prisma.$queryRawUnsafe<
    { ragam_efektif: number; ragam_limit: number; ragam_harga: number }[]
  >(
    `SELECT count(DISTINCT harga_efektif)::int      AS ragam_efektif,
            count(DISTINCT nilai_limit_lelang)::int AS ragam_limit,
            count(DISTINCT harga)::int              AS ragam_harga
       FROM (
         SELECT harga_efektif, nilai_limit_lelang, harga
           FROM listing
          WHERE jenis_transaksi IN (${jenis})
            AND status_tayang IN ('TERSEDIA', 'TERJUAL')
          LIMIT 2000
       ) contoh`,
  );

  const r = baris[0];
  // Tabel kosong / stok konteks ini kurang dari dua listing: tidak ada yang
  // bisa disimpulkan, dan tidak ada pula yang perlu diurutkan.
  if (!r || (r.ragam_efektif <= 1 && r.ragam_limit <= 1 && r.ragam_harga <= 1)) {
    return "harga_efektif";
  }
  if (r.ragam_efektif > 1) return "harga_efektif";

  const cadangan: KolomHarga =
    konteks === "LELANG" && r.ragam_limit > 1 ? "nilai_limit_lelang" : "harga";

  teriakSekali(
    konteks,
    `\n[urut] listing.harga_efektif TIDAK TERISI untuk ${konteks} — ` +
      `"urutkan termurah/termahal" dan filter harga akan salah.\n` +
      `[urut] Sementara memakai kolom "${cadangan}" sebagai cadangan (tanpa index, dan buta harga promo).\n` +
      `[urut] Perbaiki di server ini:\n` +
      `[urut]   npx prisma db execute --file prisma/migration_harga_efektif.sql --schema prisma/schema.prisma\n` +
      `[urut] Periksa: node scripts/periksa-urut.mjs\n`,
  );
  return cadangan;
}

/** Tulis ulang bagian `harga_efektif` sebuah orderBy memakai kolom cadangan. */
function gantiKolom(
  orderBy: Prisma.ListingOrderByWithRelationInput[],
  kolom: KolomHarga,
): Prisma.ListingOrderByWithRelationInput[] {
  if (kolom === "harga_efektif") return orderBy;
  return orderBy.map((bagian) => {
    const arah = (bagian as Record<string, unknown>).harga_efektif;
    if (arah !== "asc" && arah !== "desc") return bagian;
    // `nilai_limit_lelang` boleh NULL — tanpa NULLS LAST, arah turun menaruh
    // baris tanpa nilai di paling depan (lihat catatan nullsLast di
    // listingSort.ts). `harga` NOT NULL, jadi tidak perlu.
    return kolom === "nilai_limit_lelang"
      ? { nilai_limit_lelang: { sort: arah, nulls: "last" } }
      : { harga: arah };
  });
}

/**
 * `buildOrderBy` versi sisi-server: urutan yang sama, tapi kolom harganya
 * dipastikan ada isinya di database ini. Ini yang dipakai halaman daftar.
 */
export async function orderByListing(
  sort: SortKey,
  konteks: KonteksListing,
): Promise<Prisma.ListingOrderByWithRelationInput[]> {
  const dasar = buildOrderBy(sort, konteks);
  if (sort !== "termurah" && sort !== "termahal") return dasar;
  return gantiKolom(dasar, await kolomHargaListing(konteks));
}

/**
 * Versi untuk pemanggil yang SUDAH punya `orderBy` jadi.
 *
 * Ada karena dasbor menyusun urutannya di berkas yang ikut dimuat komponen
 * klien (src/app/dashboard/listings/lib/filters.ts), jadi berkas itu tidak
 * boleh mengimpor Prisma. Ia menyerahkan hasilnya ke sini, di server.
 */
export async function sesuaikanKolomHarga(
  orderBy: Prisma.ListingOrderByWithRelationInput[],
  konteks: KonteksListing,
): Promise<Prisma.ListingOrderByWithRelationInput[]> {
  const pakaiHarga = orderBy.some(
    (bagian) => (bagian as Record<string, unknown>).harga_efektif !== undefined,
  );
  if (!pakaiHarga) return orderBy;
  return gantiKolom(orderBy, await kolomHargaListing(konteks));
}

/**
 * Filter harga min/maks pada kolom yang SAMA dengan yang diurut.
 *
 * Wajib satu kolom dengan urutannya: kalau filter memakai `harga_efektif`
 * sementara urutan jatuh ke cadangan, sebuah listing bisa lolos filter lalu
 * muncul di posisi yang tidak masuk akal — atau, ketika kolomnya NULL,
 * seluruh filter harga mengembalikan nol hasil tanpa sebab yang terlihat.
 */
export async function whereHargaListing(
  konteks: KonteksListing,
  min: number | undefined,
  max: number | undefined,
): Promise<Prisma.ListingWhereInput | undefined> {
  if (min === undefined && max === undefined) return undefined;
  const kolom = await kolomHargaListing(konteks);
  const rentang = {
    ...(min !== undefined && { gte: min }),
    ...(max !== undefined && { lte: max }),
  };
  return { [kolom]: rentang } as Prisma.ListingWhereInput;
}

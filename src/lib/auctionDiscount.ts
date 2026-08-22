/**
 * "Aset ini sudah pernah dilelang lebih mahal" — untuk card daftar.
 *
 * MASALAHNYA
 * Satu aset yang tidak laku dilelang ulang dengan limit lebih rendah, dan tiap
 * event jadi baris `listing` BARU dengan id berbeda. Pada data sekarang: 31.227
 * listing punya riwayat, 23.177 di antaranya limitnya TURUN dari lelang
 * sebelumnya, rata-rata −29,7%. Tanpa penanda, semua itu tampil sebagai angka
 * datar dan calon peminat tidak pernah tahu bahwa harganya sudah jatuh jauh.
 *
 * KENAPA TIDAK PAKAI getAuctionHistory()
 * Mesin riwayat di auctionHistory.ts bekerja PER LISTING dan memakai 2 query
 * tiap panggilan. Untuk satu halaman berisi 12 card itu 24 query — persis
 * beban yang harus dihindari di halaman daftar.
 *
 * Modul ini memakai aturan pencocokan yang SAMA (scoreAssetMatch), tapi
 * mengambil kandidatnya SEKALI untuk seluruh halaman: satu query terindeks
 * untuk semua nomor sertifikat di halaman itu, lalu penilaian di memori.
 * Terukur di data lokal (121.821 baris lelang): 2,5 ms untuk 12 listing,
 * memakai idx_listing_riwayat_lelang_certkeys — lihat
 * prisma/migration_riwayat_lelang_index.sql, WAJIB ada di tiap environment.
 * Tanpa index itu query ini jadi seq scan dan halaman akan terasa berat.
 *
 * Nomor sertifikat diperlakukan sebagai HIMPUNAN, sama seperti di mesin
 * riwayat: satu lot bisa memuat beberapa bidang ("123,456") dan urutannya
 * tidak stabil antar event, jadi kandidat diambil lewat irisan himpunan dan
 * dikelompokkan ke SEMUA nomornya — bukan hanya nomor pertama.
 */

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  CERT_KEYS_EXPR,
  certNumbers,
  filterKotaSql,
  parseKota,
  scoreAssetMatch,
  type AssetFingerprint,
} from "@/lib/auctionHistory";

/** Bentuk minimal yang dibutuhkan — sengaja longgar supaya tiap halaman bisa
 *  mengirim baris Prisma-nya apa adanya tanpa memetakan ulang. */
export type BarisLelang = AssetFingerprint & {
  jenis_transaksi?: string | null;
  tanggal_lelang?: Date | string | null;
  nilai_limit_lelang?: unknown;
  harga?: unknown;
};

/**
 * Batas pengaman, sama semangatnya dengan MAKS_KANDIDAT di mesin riwayat.
 * Diurutkan `id_property` supaya, kalau batas ini tersentuh, hasilnya tetap
 * sama tiap kali halaman dimuat (bukan "kadang ada badge kadang tidak").
 */
const MAKS_KANDIDAT_HALAMAN = 3000;

const angka = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const waktu = (v?: Date | string | null): number | null => {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
};

type KandidatRow = {
  id_property: bigint;
  legalitas: string | null;
  nomor_legalitas: string | null;
  kelurahan: string | null;
  kecamatan: string | null;
  kota: string | null;
  alamat_lengkap: string | null;
  luas_tanah: Prisma.Decimal | null;
  luas_bangunan: Prisma.Decimal | null;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
  nilai_limit_lelang: Prisma.Decimal | null;
  tanggal_lelang: Date | null;
};

/**
 * Limit lelang TERTINGGI dari event yang lebih lama untuk aset yang sama.
 *
 * Kunci Map = String(id_property). Listing yang tidak punya riwayat, atau yang
 * riwayatnya justru lebih murah, TIDAK masuk Map sama sekali — pemanggil cukup
 * memeriksa keberadaan kuncinya.
 *
 * Hanya event yang tanggalnya LEBIH LAMA yang dihitung. Tanpa syarat itu, dua
 * baris hasil scrape kembar (tanggal sama) bisa saling mengklaim "turun dari"
 * satu sama lain, dan card menampilkan diskon yang tidak pernah terjadi.
 */
export async function ambilLimitLelangSebelumnya(
  listings: BarisLelang[],
): Promise<Map<string, number>> {
  const hasil = new Map<string, number>();

  // Hanya listing lelang yang punya sertifikat yang bisa dicocokkan. Kalau
  // pemanggil mengirim halaman campuran (mis. halaman "Semua"), sisanya
  // disaring di sini supaya query tidak membawa nomor yang tidak relevan.
  const acuan = listings.filter(
    (l) =>
      (l.jenis_transaksi ?? "LELANG").toUpperCase() === "LELANG" &&
      certNumbers(l.nomor_legalitas).length > 0,
  );
  if (acuan.length === 0) return hasil;

  const nomorSet = Array.from(
    new Set(acuan.flatMap((l) => certNumbers(l.nomor_legalitas))),
  );
  if (nomorSet.length === 0) return hasil;

  let kandidat: KandidatRow[] = [];
  try {
    kandidat = await prisma.$queryRaw<KandidatRow[]>`
      SELECT id_property, legalitas, nomor_legalitas,
             kelurahan, kecamatan, kota, alamat_lengkap,
             luas_tanah, luas_bangunan, latitude, longitude,
             nilai_limit_lelang, tanggal_lelang
      FROM listing
      WHERE jenis_transaksi = 'LELANG'
        AND status_tayang <> 'TARIK_LISTING'
        AND ${CERT_KEYS_EXPR} && ARRAY[${Prisma.join(nomorSet)}]::text[]
        AND ${filterKotaSql(acuan.map((l) => parseKota(l.kota).core))}
      ORDER BY id_property
      LIMIT ${MAKS_KANDIDAT_HALAMAN}
    `;
  } catch (err) {
    // Penanda diskon adalah nilai tambah, bukan syarat halaman bisa tampil.
    // Kalau query gagal, card tetap dirender tanpa penandanya.
    console.error("ambilLimitLelangSebelumnya:", err);
    return hasil;
  }

  // Dikelompokkan per nomor sertifikat supaya pencocokan tidak O(acuan ×
  // kandidat). Satu kandidat masuk ke SEMUA ember nomornya — aset multi-bidang
  // harus tetap ketemu lewat nomor mana pun yang beririsan. Jenis sertifikat
  // sengaja bukan bagian kunci: paket campuran bisa tercatat dengan jenis
  // berbeda antar event, dan scoreAssetMatch() yang memutuskan.
  const ember = new Map<string, KandidatRow[]>();
  for (const k of kandidat) {
    for (const nomor of certNumbers(k.nomor_legalitas)) {
      const daftar = ember.get(nomor);
      if (daftar) daftar.push(k);
      else ember.set(nomor, [k]);
    }
  }

  for (const a of acuan) {
    const idA = String(a.id_property);
    const waktuA = waktu(a.tanggal_lelang);
    const limitA = angka(a.nilai_limit_lelang) ?? angka(a.harga);

    let tertinggi = 0;
    // Kandidat yang punya beberapa nomor beririsan muncul di beberapa ember —
    // dinilai sekali saja.
    const sudahDinilai = new Set<string>();
    for (const nomor of certNumbers(a.nomor_legalitas)) {
      for (const k of ember.get(nomor) ?? []) {
        const idK = String(k.id_property);
        if (idK === idA || sudahDinilai.has(idK)) continue;
        sudahDinilai.add(idK);

        const waktuK = waktu(k.tanggal_lelang);
        // Butuh kedua tanggal: tanpa urutan waktu yang pasti kita tidak bisa
        // menyebut satu event "sebelumnya", dan klaim turun harga jadi tebakan.
        if (waktuA === null || waktuK === null || waktuK >= waktuA) continue;

        const limitK = angka(k.nilai_limit_lelang);
        if (!limitK || limitK <= tertinggi) continue;

        // Aturan pencocokan yang sama dengan halaman riwayat — konservatif ke
        // arah "jangan mengarang riwayat". Hanya event dengan bidang yang SAMA
        // PERSIS yang boleh jadi pembanding harga: limit paket 3 bidang bukan
        // "harga sebelumnya" untuk satu bidang saja.
        const verdict = scoreAssetMatch(a, k);
        if (!verdict.cocok || verdict.cakupan !== "SAMA") continue;

        tertinggi = limitK;
      }
    }

    if (limitA && tertinggi > limitA) hasil.set(idA, tertinggi);
  }

  return hasil;
}

// src/lib/nomorLegalitas.ts
//
// Kolom `listing.nomor_legalitas` menyimpan SEMUA nomor sertifikat satu lot
// dalam satu string ("123,456"). File ini satu-satunya tempat string itu
// dipecah — dipakai dua sisi sekaligus:
//
//   • mesin riwayat lelang (server, src/lib/auctionHistory.ts) → butuh nomor
//     KANONIK untuk mencocokkan aset lintas event lelang;
//   • halaman detail (client) → butuh teks APA ADANYA untuk ditampilkan.
//
// Dulu keduanya tinggal di auctionHistory.ts. Masalahnya file itu mengimpor
// Prisma, jadi komponen client tidak bisa menyentuhnya sama sekali tanpa
// menarik klien database ke bundle browser. Dipisah ke sini supaya aturan
// pemisahnya tetap SATU, bukan disalin lalu berbeda diam-diam.

/**
 * Pemisah antar nomor sertifikat dalam satu kolom. Scraper memakai koma, tapi
 * input manual agent memakai apa saja ("121 dan 14", "123/456").
 * HARUS identik dengan kelas pemisah di `certKeysSql()` (auctionHistory.ts).
 */
export const PEMISAH_NOMOR = /[,;/|+&]|\bDAN\b/i;

/** Satu potongan → nomor kanonik, atau null bila potongannya bukan nomor. */
function kanonik(bagian: string): string | null {
  const kunci = bagian
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/^0+/, "");
  return kunci && /[0-9]/.test(kunci) ? kunci : null;
}

/**
 * Nomor sertifikat → himpunan nomor kanonik, urut & unik.
 *
 * Satu lot bisa mencakup >1 bidang. Leading zero dibuang karena sumber tidak
 * konsisten mem-pad. Potongan tanpa angka sama sekali DIBUANG: nomor sertifikat
 * kerap ditulis "0087/Desa Sukajadi", dan tanpa aturan ini "DESASUKAJADI" jadi
 * kunci pencocokan yang akan menyatukan aset-aset yang cuma sedesa.
 *
 * "00003729" → ["3729"] · "123, 0456" → ["123","456"] · "0000" → []
 * "121 dan 14" → ["14","121"] · "0087/Desa Sukajadi" → ["87"]
 */
export function certNumbers(v?: string | null): string[] {
  if (!v) return [];
  const out = new Set<string>();
  for (const bagian of v.split(PEMISAH_NOMOR)) {
    const kunci = kanonik(bagian);
    if (kunci) out.add(kunci);
  }
  return Array.from(out).sort();
}

/** Satu bidang tanah dalam satu lot lelang. */
export interface BidangSertifikat {
  /** Teks apa adanya dari sumber, mis. "0087 / Desa Sukajadi". */
  teks: string;
  /** Nomor kanonik untuk dedup & pencocokan, mis. "87". */
  nomor: string;
}

/**
 * Nomor sertifikat → daftar bidang SIAP TAMPIL.
 *
 * Bedanya dengan `certNumbers()`: yang ini mempertahankan tulisan aslinya.
 * Agent membacakan nomor ini ke notaris & kantor lelang, jadi "00003729" tidak
 * boleh berubah jadi "3729" di layar — leading zero dibuang hanya untuk
 * MENCOCOKKAN, bukan untuk dibaca.
 *
 * Potongan tanpa angka bukan bidang baru melainkan keterangan wilayah dari
 * penulisan "0087/Desa Sukajadi" — ditempelkan kembali ke bidang sebelumnya
 * supaya tidak muncul sebagai baris kosong bernomor. Duplikat (mis. "123" dan
 * "0123" di kolom yang sama) disaring memakai nomor kanoniknya.
 */
export function daftarBidang(v?: string | null): BidangSertifikat[] {
  if (!v) return [];

  const out: BidangSertifikat[] = [];
  for (const bagian of v.split(PEMISAH_NOMOR)) {
    const teks = bagian.trim().replace(/\s+/g, " ");
    if (!teks) continue;

    const nomor = kanonik(teks);
    if (!nomor) {
      if (out.length > 0) out[out.length - 1].teks += ` / ${teks}`;
      continue;
    }

    if (out.some((b) => b.nomor === nomor)) continue;
    out.push({ teks, nomor });
  }

  return out;
}

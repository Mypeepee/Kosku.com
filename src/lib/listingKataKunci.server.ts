import "server-only";

/**
 * Penghitung kata kunci — bagian `listingKataKunci` yang butuh database.
 *
 * Dipisah dari berkas induknya karena aturan `buildKataKunciWhere` ikut dipakai
 * client component (lewat listingFilters.ts → FilterCommandBar), sementara
 * yang ini tidak boleh ikut ke browser. Polanya sama dengan
 * nearbyPlaces.ts / nearbyPlaces.server.ts.
 */

import prisma from "@/lib/prisma";
import {
  TRANSAKSI,
  buildKataKunciWhere,
  type KonteksTransaksi,
} from "@/lib/listingKataKunci";

/**
 * Ambang untuk MENGHITUNG, bukan untuk menyaring — dan bedanya penting.
 *
 * Penghitung jalan pada setiap ketukan, jadi ia berhak menolak kueri yang
 * terlalu pendek untuk berarti apa pun (dua huruf cocok ke puluhan ribu baris
 * dengan biaya penuh). Tapi PENYARING dijalankan sekali, atas permintaan
 * pemakainya sendiri — memakai ambang yang sama di sana berarti kata kunci dua
 * huruf yang dulu berfungsi mendadak diabaikan diam-diam, dan halaman
 * menampilkan seluruh isi database seolah itu hasil pencariannya.
 */
const MIN_KATA_HITUNG = 3;

/**
 * Berapa properti yang cocok dengan kata kunci ini.
 *
 * Dipanggil dari kotak pencarian sambil user mengetik, jadi ia harus murah
 * DAN jujur: `status_tayang` & `bukan_properti` disaring sama persis seperti
 * halaman hasil, kalau tidak angkanya menjanjikan lebih dari yang akan
 * ditampilkan.
 */
export async function hitungKataKunci(
  q: string | null | undefined,
  konteks: KonteksTransaksi = "semua",
): Promise<number | null> {
  const teks = String(q ?? "").trim();
  if (teks.length < MIN_KATA_HITUNG) return null;

  const where = buildKataKunciWhere(teks);
  if (!where) return null;

  try {
    return await prisma.listing.count({
      where: {
        status_tayang: "TERSEDIA",
        bukan_properti: false,
        ...TRANSAKSI[konteks],
        ...where,
      },
    });
  } catch {
    // Kotak pencarian tetap menawarkan pencarian alamat, hanya tanpa angka.
    return null;
  }
}

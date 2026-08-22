// src/lib/klienDekat.ts
// ---------------------------------------------------------------------------
// Menerjemahkan token "dekat X" pada preferensi klien jadi kriteria yang siap
// dipakai mesin pencocokan.
//
// KENAPA TERPISAH DARI klienMatch.ts. Berkas itu harus bisa memutuskan TANPA
// menyentuh database — itulah yang membuat pemindai terbalik di cron sanggup
// mengadu ribuan preferensi dengan listing baru di memori (150 ribu
// perbandingan, 77 ms). Penerjemahan token butuh query ke kamus `tempat`, jadi
// ia dikerjakan SEKALI di sini, di depan, lalu hasilnya dititipkan ke
// `KriteriaMatch.dekat`.
//
// KENAPA BATCH. Satu klien bisa punya empat preferensi dan seluruh kantor bisa
// punya ribuan; menerjemahkan token satu per satu saat dibutuhkan berarti satu
// query per preferensi. Di sini token yang sama diterjemahkan sekali saja —
// dan token yang sama memang sering: "dekat UNESA" adalah kriteria yang
// dipakai banyak klien sekaligus.
// ---------------------------------------------------------------------------

import "server-only";
import { bacaTempatTerpilih } from "@/lib/tempat/cari";
import type { KriteriaDekat } from "@/lib/klienMatch";

/** Bentuk minimum baris preferensi yang dibutuhkan penerjemah. */
export type PrefDekat = { dekat_nilai?: string | null; dekat_radius?: number | null };

/**
 * Terjemahkan sekumpulan preferensi → peta token → kriteria siap pakai.
 *
 * Token yang tidak dikenali (tempatnya dihapus dari kamus) TIDAK dimasukkan ke
 * peta. Pemanggil memperlakukan ketiadaan itu sebagai "kriteria tidak bisa
 * dipenuhi", bukan "tidak ada kriteria" — lihat cabang `id_property: { in: [] }`
 * di whereKasar(). Keduanya terlihat mirip dan artinya berlawanan.
 */
export async function siapkanDekat(prefs: PrefDekat[]): Promise<Map<string, KriteriaDekat>> {
  const peta = new Map<string, KriteriaDekat>();
  const token = [...new Set(prefs.map(p => (p.dekat_nilai || "").trim()).filter(Boolean))];
  if (token.length === 0) return peta;

  /* Berurutan, bukan Promise.all. Jumlah token unik selalu kecil (satu kantor
     jarang punya lebih dari selusin patokan yang berbeda), dan menembakkan
     semuanya sekaligus ke kamus tidak menghemat apa pun yang terasa sambil
     menambah beban ke kolam koneksi yang dipakai halaman. */
  for (const t of token) {
    const tempat = await bacaTempatTerpilih(t);
    if (!tempat) continue;
    peta.set(t, {
      ids: tempat.ids,
      kriteria: tempat.kriteria ?? null,
      radius: tempat.radius,
      label: tempat.kelasSemua ? `sekitar ${tempat.label}` : `sekitar ${tempat.nama}`,
    });
  }
  return peta;
}

/**
 * Ambil kriteria untuk satu preferensi.
 *
 * Radius pilihan agent menang atas bawaan kelas tempat — itulah gunanya kolom
 * `dekat_radius`. Dibatasi ke rentang yang sama dengan CHECK di database,
 * supaya nilai aneh dari data lama tidak menghasilkan pencarian yang mustahil.
 */
export function dekatUntuk(
  p: PrefDekat,
  peta: Map<string, KriteriaDekat>,
): KriteriaDekat | null | undefined {
  const t = (p.dekat_nilai || "").trim();
  if (!t) return null;                    // memang tanpa kriteria tempat
  const dasar = peta.get(t);
  if (!dasar) return { ids: [], kriteria: null, radius: 0, label: t }; // tak dikenali → tak terpenuhi
  const r = p.dekat_radius;
  if (r && r >= 200 && r <= 20_000) return { ...dasar, radius: r };
  return dasar;
}

// src/lib/klienPengecualian.ts
// ---------------------------------------------------------------------------
// SATU PINTU untuk pertanyaan "aset apa yang TIDAK boleh muncul untuk klien ini".
//
// Ada tiga jawaban, dan ketiganya harus berlaku di lima permukaan sekaligus:
// layar Asisten Aset, panel "Siap dikirim" di puncak CRM, endpoint match per
// preferensi, cron email aset baru, dan diagnosanya. Sebelum berkas ini,
// masing-masing merakit daftarnya sendiri dari `kirimanRekomendasi` — dan
// begitu sumber keempat ditambahkan (penyingkiran manual oleh agent), yang
// lupa memakainya akan MENGIRIM ULANG aset yang baru saja dibuang agent,
// lewat email, tanpa satu pun galat.
//
// Aturannya: jangan pernah merakit `kecuali` di tempat lain. Kalau ada sumber
// pengecualian baru, ia masuk ke sini.
// ---------------------------------------------------------------------------

import type { PrismaClient } from "@prisma/client";

/** Sumber pengecualian, dan kenapa masing-masing ada:
 *
 *  1. `kiriman_rekomendasi` — sudah pernah ditawarkan. Mengirim ulang membuat
 *     agent terlihat tidak ingat apa yang ia kerjakan minggu lalu.
 *  2. `rekomendasi_disingkirkan` — agent menilai aset ini tidak cocok karena
 *     alasan yang tidak punya kolom di preferensi.
 *  3. `klien.id_properti_asal` — aset milik klien itu sendiri (titip jual).
 *     Menawarkan rumahnya sendiri kepada pemiliknya adalah kesalahan yang
 *     langsung terlihat bodoh.
 */
export type Pengecualian = Map<string, Set<string>>;

/** Kumpulkan pengecualian untuk sekumpulan klien sekaligus.
 *
 *  DUA query untuk berapa pun jumlah kliennya — bukan dua query per klien.
 *  Panel ringkasan memindai sampai 14 klien dalam satu permintaan, dan versi
 *  per-klien membuat panel itu menahan halaman Client selama beberapa detik
 *  demi sebuah lencana angka.
 *
 *  `id_properti_asal` TIDAK diambil di sini: ia sudah ada di baris klien yang
 *  sudah dimuat pemanggil, dan menariknya ulang berarti query ketiga untuk
 *  data yang sedang dipegang. Pemanggil menambahkannya lewat `gabung()`. */
export async function muatPengecualian(
  prisma: PrismaClient,
  idKlien: string[],
): Promise<Pengecualian> {
  const peta: Pengecualian = new Map();
  if (idKlien.length === 0) return peta;

  const tambah = (id_klien: string, id_property: bigint) => {
    let set = peta.get(id_klien);
    if (!set) { set = new Set<string>(); peta.set(id_klien, set); }
    set.add(id_property.toString());
  };

  const [kiriman, disingkirkan] = await Promise.all([
    prisma.kirimanRekomendasi.findMany({
      where: { id_klien: { in: idKlien } },
      select: { id_klien: true, id_property: true },
    }),
    prisma.rekomendasiDisingkirkan.findMany({
      where: { id_klien: { in: idKlien } },
      select: { id_klien: true, id_property: true },
    }),
  ]);

  for (const r of kiriman) tambah(r.id_klien, r.id_property);
  for (const r of disingkirkan) tambah(r.id_klien, r.id_property);
  return peta;
}

/** Bentuk yang diminta `cariCocok({ kecuali })`: daftar BigInt untuk satu klien,
 *  sudah termasuk aset asal klien itu sendiri.
 *
 *  Dipisahkan dari `muatPengecualian()` karena pemanggil yang bekerja di memori
 *  (pemindai terbalik di cron) butuh `Set<string>` untuk perbandingan cepat,
 *  sementara pemanggil SQL butuh `bigint[]`. Menyatukan keduanya jadi satu
 *  bentuk memaksa salah satunya mengonversi ribuan kali per putaran. */
export function gabung(
  peta: Pengecualian,
  idKlien: string,
  idPropertiAsal?: bigint | null,
): bigint[] {
  const out = [...(peta.get(idKlien) ?? [])].map(BigInt);
  if (idPropertiAsal) out.push(idPropertiAsal);
  return out;
}

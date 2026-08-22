// src/lib/kirimRekomendasi.ts
// ---------------------------------------------------------------------------
// PENCATATAN KIRIMAN — satu-satunya tempat "aset dikirim ke klien" ditulis.
//
// Ada DUA jalan menuju tindakan yang sama, dan itulah alasan berkas ini ada:
//   • agent menekan Kirim di layar Asisten Aset  → POST …/rekomendasi/kirim
//   • agent menekan satu tombol di dalam EMAIL   → GET  /api/asisten/kirim
//
// Keduanya harus menghasilkan catatan yang identik. Kalau jalur email menulis
// barisnya sendiri, cepat atau lambat ia akan lupa satu hal — menyegarkan
// `harga_diketahui`, atau memajukan `tanggal_kontak_terakhir` — dan akibatnya
// tidak terlihat sebagai galat: cron perubahan harga akan membandingkan dengan
// angka yang salah, atau klien yang baru saja dikirimi lima rumah tetap muncul
// di daftar "sepi 14 hari" besok pagi. Bug yang tidak pernah dilaporkan
// siapa pun, karena tidak ada yang tampak rusak.
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import { hargaEfektif } from "@/lib/klienMatch";
import { pesanRekomendasi, tautanWa, type AsetPesan } from "@/lib/klienPesan";

/** Sekali kirim maksimal sekian aset. Bukan batas teknis — batas sopan santun:
 *  pesan WhatsApp berisi dua belas properti tidak dibaca siapa pun, dan agent
 *  yang mengirimkannya sedang membuang seluruh isinya sekaligus. */
export const MAKS_SEKALI_KIRIM = 6;

/** Berapa hari ke depan follow-up dijadwalkan setelah mengirim aset.
 *  Tiga hari: cukup lama untuk klien sempat melihat dan berdiskusi di rumah,
 *  cukup pendek supaya percakapannya belum dingin. */
export const JEDA_FOLLOW_UP_HARI = 3;

export type HasilKirim =
  | { ok: false; status: number; message: string }
  | {
      ok: true;
      dicatat: number;
      baru: number;
      ulang: number;
      pesan: string;
      waUrl: string | null;
      followUpDijadwalkan: string;
      nama: string;
    };

/**
 * Catat niat mengirim, susun drafnya, kembalikan tautan WhatsApp-nya.
 *
 * TIDAK mengirim apa pun. Pengirimannya tetap satu ketukan agent pada tautan
 * wa.me — lihat alasannya di src/lib/klienPesan.ts.
 *
 * @param prefMap  id_property → id_preferensi. Peta, bukan satu nilai: satu
 *   pesan bisa memuat aset dari kriteria yang berbeda (klien yang mencari
 *   "rumah Gresik ≤500jt" DAN "ruko Surabaya ≤1M" menerima keduanya sekaligus),
 *   dan mencatat semuanya di bawah satu preferensi akan membuat laporan
 *   "preferensi mana yang paling menghasilkan closing" bohong sejak hari
 *   pertama.
 */
export async function catatKiriman(opsi: {
  idKlien: string;
  agentId: string;
  ids: string[];
  prefMap?: Record<string, string | null | undefined>;
  kanal?: "WHATSAPP" | "EMAIL";
  namaAgent?: string | null;
}): Promise<HasilKirim> {
  const { idKlien, agentId, prefMap = {}, namaAgent } = opsi;
  const kanal = opsi.kanal === "EMAIL" ? "EMAIL" : "WHATSAPP";

  const klien = await prisma.klien.findFirst({
    where: { id_klien: idKlien, id_agent: agentId },
    select: { id_klien: true, nama: true, nomor_whatsapp: true, tanggal_follow_up: true },
  });
  if (!klien) return { ok: false, status: 404, message: "Klien tidak ditemukan" };

  const ids = [...new Set(opsi.ids.map(String))].slice(0, MAKS_SEKALI_KIRIM);
  if (ids.length === 0)
    return { ok: false, status: 400, message: "Tidak ada aset yang dipilih" };

  /* Aset diambil ulang dari database, tidak dipercayakan pada payload.
     Harga yang disimpan sebagai snapshot HARUS harga yang berlaku detik ini —
     kalau ia datang dari browser yang membuka halaman sejam lalu (atau dari
     email yang dibuka besok pagi), seluruh deteksi perubahan harga akan
     berdiri di atas angka yang sudah basi. */
  const aset = await prisma.listing.findMany({
    where: { id_property: { in: ids.map(BigInt) }, status_tayang: "TERSEDIA" },
    select: {
      id_property: true, slug: true, judul: true, jenis_transaksi: true, kategori: true,
      harga: true, harga_promo: true, harga_efektif: true, nilai_limit_lelang: true, status_tayang: true,
      kota: true, kecamatan: true, luas_tanah: true, luas_bangunan: true,
      kamar_tidur: true, kamar_mandi: true,
    },
  });
  if (aset.length === 0)
    return { ok: false, status: 404, message: "Aset tidak ditemukan atau sudah tidak tersedia" };

  const sekarang = new Date();

  /* Satu transaksi. Kalau ada satu baris gagal, tidak boleh ada separuh
     kiriman yang tercatat — pesannya terlanjur utuh, jadi catatannya harus
     utuh juga, kalau tidak anti-dobel bocor untuk aset yang tidak tercatat. */
  const hasil = await prisma.$transaction(async (tx) => {
    let baru = 0;
    let ulang = 0;

    for (const l of aset) {
      /* Lewat hargaEfektif(), bukan `harga_efektif ?? harga`: baris lama bisa
         punya harga_efektif NULL, dan snapshot yang salah membuat SELURUH
         deteksi perubahan berdiri di atas angka yang bukan harga sebenarnya. */
      const harga = hargaEfektif(l);
      const idPrefMentah = prefMap[l.id_property.toString()];
      const idPref = idPrefMentah ? BigInt(String(idPrefMentah)) : null;

      /* upsert, bukan create: mengirim ulang aset yang sama adalah tindakan
         SAH (harganya turun, klien minta diingatkan). Yang tidak boleh adalah
         barisnya bertambah — unik (id_klien, id_property) menjaganya di
         database, dan cabang update ini yang membuat pengiriman ulang tetap
         punya arti: hitungannya naik dan harga_diketahui ikut disegarkan. */
      const ada = await tx.kirimanRekomendasi.findUnique({
        where: { id_klien_id_property: { id_klien: klien.id_klien, id_property: l.id_property } },
        select: { id_kiriman: true },
      });

      if (ada) {
        await tx.kirimanRekomendasi.update({
          where: { id_kiriman: ada.id_kiriman },
          data: {
            jumlah_kirim: { increment: 1 },
            terakhir_dikirim: sekarang,
            harga_diketahui: harga,
            id_preferensi: idPref ?? undefined,
            kanal,
          },
        });
        ulang++;
      } else {
        await tx.kirimanRekomendasi.create({
          data: {
            id_klien: klien.id_klien,
            id_property: l.id_property,
            id_agent: agentId,
            id_preferensi: idPref,
            kanal,
            harga_saat_kirim: harga,
            harga_diketahui: harga,
            status_saat_kirim: l.status_tayang,
            pertama_dikirim: sekarang,
            terakhir_dikirim: sekarang,
          },
        });
        baru++;
      }
    }

    /* Mengirim aset ADALAH kontak. Tanpa baris ini, klien yang baru saja
       dikirimi lima rumah tetap muncul di daftar "sepi 14 hari" besok pagi,
       dan asistennya langsung kehilangan kepercayaan. */
    const followUpBaru =
      !klien.tanggal_follow_up || klien.tanggal_follow_up < sekarang
        ? new Date(sekarang.getTime() + JEDA_FOLLOW_UP_HARI * 86_400_000)
        : klien.tanggal_follow_up;

    await tx.klien.update({
      where: { id_klien: klien.id_klien },
      data: { tanggal_kontak_terakhir: sekarang, tanggal_follow_up: followUpBaru },
    });

    return { baru, ulang, followUpBaru };
  });

  /* Draf pesan disusun dari aset dalam URUTAN yang diminta agent, bukan urutan
     hasil query — agent memilihnya dengan urutan tertentu di layar dan pesan
     yang mengacaknya terasa bukan buatannya. */
  const urut = new Map(ids.map((v, i) => [v, i]));
  const asetPesan: AsetPesan[] = [...aset]
    .sort((a, b) => (urut.get(a.id_property.toString()) ?? 0) - (urut.get(b.id_property.toString()) ?? 0))
    .map(l => ({
      id_property: l.id_property.toString(),
      slug: l.slug,
      judul: l.judul,
      jenis_transaksi: l.jenis_transaksi,
      kategori: l.kategori,
      harga: hargaEfektif(l),
      kota: l.kota ?? "",
      kecamatan: l.kecamatan,
      luas_tanah: l.luas_tanah ? Number(l.luas_tanah) : null,
      luas_bangunan: l.luas_bangunan ? Number(l.luas_bangunan) : null,
      kamar_tidur: l.kamar_tidur,
      kamar_mandi: l.kamar_mandi,
    }));

  const maksud = asetPesan.every(a => a.jenis_transaksi === "SEWA") ? "SEWA" : "BELI";
  const pesan = pesanRekomendasi({
    namaKlien: klien.nama,
    namaAgent: namaAgent ?? undefined,
    /* Kode agent PENGIRIM, bukan pemilik listing. Inilah yang membuat agent
       bisa menawarkan seluruh persediaan kantor tanpa kehilangan kliennya:
       tombol "hubungi agent" di halaman detail kembali kepadanya. */
    idAgent: agentId,
    aset: asetPesan,
    maksud,
  });

  return {
    ok: true,
    dicatat: hasil.baru + hasil.ulang,
    baru: hasil.baru,
    ulang: hasil.ulang,
    pesan,
    waUrl: klien.nomor_whatsapp ? tautanWa(klien.nomor_whatsapp, pesan) : null,
    followUpDijadwalkan: hasil.followUpBaru.toISOString(),
    nama: klien.nama,
  };
}

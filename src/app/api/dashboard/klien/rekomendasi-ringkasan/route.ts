// GET /api/dashboard/klien/rekomendasi-ringkasan
// ---------------------------------------------------------------------------
// "Siapa yang bisa saya kirimi aset SEKARANG?"
//
// Inilah yang mengubah rekomendasi dari sesuatu yang harus DICARI agent
// menjadi sesuatu yang MENUNGGU agent begitu halaman terbuka. Sebelum ini,
// menemukan satu rekomendasi butuh lima ketukan — buka CRM, cari klien, buka
// kartunya, pilih preferensi, tekan cari — dan empat di antaranya adalah
// pekerjaan mencari, bukan pekerjaan menjual.
//
// ── BATAS BIAYA ────────────────────────────────────────────────────────────
// Endpoint ini menjalankan pencocokan nyata (bukan tebakan dari cache), jadi
// ia harus dibatasi keras atau akan jadi query paling mahal di seluruh
// dashboard. Tiga rem: hanya N klien teratas, kolam pencarian dipangkas, dan
// pemindaian berhenti begitu cukup klien yang punya hasil.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";
import { cariCocok, type KriteriaMatch } from "@/lib/klienMatch";
import { siapkanDekat, dekatUntuk } from "@/lib/klienDekat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Klien yang diperiksa per permintaan. */
const MAKS_KLIEN_DIPINDAI = 14;
/** Klien ber-hasil yang cukup untuk mengisi panel. */
const CUKUP = 8;
/** Kolam pencarian dipangkas: panel ini butuh ANGKA, bukan daftar. */
const KOLAM_RINGKAS = 80;

const SELECT_TIPIS = {
  /* `kategori` & `tanggal_lelang` ikut meski panel ini hanya menampilkan
     angka: keduanya bahan sidik aset kembar dan penurunan peringkat lelang
     kedaluwarsa di klienMatch. Tanpa mereka, sidiknya mengembalikan null dan
     kembaran ikut terhitung — angka di panel jadi lebih besar daripada jumlah
     kartu yang benar-benar muncul saat dibuka. */
  id_property: true, kategori: true, kota: true, provinsi: true, kecamatan: true, kelurahan: true,
  jenis_transaksi: true, tanggal_lelang: true, harga: true, harga_promo: true, harga_efektif: true,
  nilai_limit_lelang: true, luas_tanah: true, luas_bangunan: true,
  gambar: true, kamar_tidur: true, is_hot_deal: true, tanggal_dibuat: true,
} as const;

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const agentId = (session.user as any).agentId as string | undefined;
  if (!agentId) return NextResponse.json({ ok: false }, { status: 403 });

  /* Urutan pemeriksaan = urutan kepentingan. Klien yang follow-up-nya sudah
     lewat diperiksa lebih dulu: merekalah yang paling butuh alasan untuk
     dihubungi hari ini, dan aset baru adalah alasan terbaik yang ada. */
  const kandidat = await prisma.klien.findMany({
    where: {
      id_agent: agentId,
      status: { notIn: ["closing", "lost_iseng"] },
      preferensi: { some: {} },
    },
    orderBy: [{ tanggal_follow_up: "asc" }, { tanggal_masuk: "desc" }],
    take: MAKS_KLIEN_DIPINDAI,
    select: {
      id_klien: true, nama: true, status: true, nomor_whatsapp: true,
      tanggal_follow_up: true, id_properti_asal: true,
      preferensi: true,
    },
  });
  if (kandidat.length === 0) return NextResponse.json({ ok: true, items: [], dipindai: 0 });

  const terkirim = await prisma.kirimanRekomendasi.findMany({
    where: { id_klien: { in: kandidat.map(k => k.id_klien) } },
    select: { id_klien: true, id_property: true },
  });
  const petaTerkirim = new Map<string, bigint[]>();
  for (const t of terkirim) {
    const a = petaTerkirim.get(t.id_klien) ?? [];
    a.push(t.id_property);
    petaTerkirim.set(t.id_klien, a);
  }

  const items: { id_klien: string; nama: string; status: string; jumlah: number; punyaWa: boolean; telat: boolean }[] = [];

  /* ── DIPERIKSA PER GELOMBANG, BUKAN SATU-SATU ─────────────────────────────
     Versi lama memeriksa klien satu per satu supaya rem "cukup" benar-benar
     menghentikan pekerjaan. Niatnya benar, tapi harganya baru terlihat setelah
     diukur: tiap klien memakan ~100 ms, jadi empat belas klien membuat panel
     ini menahan halaman Client hampir tiga detik — untuk sebuah lencana angka.

     Sekarang dikerjakan per gelombang kecil: beberapa klien berbarengan, lalu
     rem "cukup" diperiksa di antara gelombang. Early-exit-nya tetap hidup —
     yang hilang paling banyak sisa satu gelombang, bukan seluruh penghematan —
     sementara waktunya turun sepersekian.

     Ukuran gelombang sengaja kecil. Panel ini berbagi kolam koneksi dengan
     seluruh dashboard, dan empat belas query serentak demi satu lencana adalah
     cara yang bagus untuk memperlambat halaman yang sedang dibuka orang lain. */
  const GELOMBANG = 4;

  const petaDekat = await siapkanDekat(kandidat.flatMap(k => k.preferensi));

  const periksaSatu = async (k: (typeof kandidat)[number]) => {
    const kecuali = [...(petaTerkirim.get(k.id_klien) ?? [])];
    if (k.id_properti_asal) kecuali.push(k.id_properti_asal);

    const ditemukan = new Set<string>();
    for (const p of k.preferensi) {
      const kriteria: KriteriaMatch = {
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
        dekat: dekatUntuk(p, petaDekat),
        alamat_teks: p.alamat_teks,
      };
      const hasil = await cariCocok<any>(prisma, kriteria, {
        kecuali, select: SELECT_TIPIS, maks: KOLAM_RINGKAS,
      });
      for (const l of hasil) ditemukan.add(l.id_property.toString());
      // Sepuluh sudah lebih dari cukup untuk sebuah lencana angka.
      if (ditemukan.size >= 10) break;
    }
    return { k, jumlah: ditemukan.size };
  };

  for (let i = 0; i < kandidat.length && items.length < CUKUP; i += GELOMBANG) {
    const hasil = await Promise.all(kandidat.slice(i, i + GELOMBANG).map(periksaSatu));
    for (const { k, jumlah } of hasil) {
      if (items.length >= CUKUP) break;
      if (jumlah === 0) continue;
      items.push({
        id_klien: k.id_klien,
        nama: k.nama,
        status: k.status,
        jumlah,
        punyaWa: !!k.nomor_whatsapp,
        telat: !!k.tanggal_follow_up && k.tanggal_follow_up < new Date(),
      });
    }
  }

  return NextResponse.json({ ok: true, items, dipindai: kandidat.length });
}

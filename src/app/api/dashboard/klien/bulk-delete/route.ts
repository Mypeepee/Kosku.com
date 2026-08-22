import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";
import { kunciProspek } from "@/lib/prospek";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Batas atas jumlah id dalam satu permintaan. Daftar CRM memuat 50 baris
   sekaligus, jadi "pilih semua" tidak akan pernah melewatinya — angka ini
   hanya menahan permintaan yang dibuat-buat di luar layar. */
const MAKS_SEKALI = 200;

/**
 * Hapus BANYAK klien dalam satu permintaan.
 *
 * KENAPA BUKAN 50 KALI DELETE /klien/[id]. Menghapus satu per satu dari
 * browser berarti 50 putaran jaringan, 50 transaksi, dan — yang paling
 * merusak — kemungkinan berhenti di tengah jalan: sebagian terhapus, sebagian
 * tidak, tanpa ada yang tahu mana. Di sini seluruhnya satu transaksi: nisannya
 * terpasang untuk semua, lalu barisnya hilang untuk semua, atau tidak sama
 * sekali.
 *
 * POST, bukan DELETE: badan permintaan pada DELETE tidak dijamin sampai di
 * semua perantara (proxy, CDN), dan daftar id inilah seluruh isi permintaan.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const agentId = (session.user as any).agentId as string | undefined;
  if (!agentId) return NextResponse.json({ ok: false }, { status: 403 });

  const body = await req.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids)
    ? Array.from(new Set(body.ids.filter((x: unknown) => typeof x === "string" && x.trim()).map((x: string) => x.trim())))
    : [];

  if (ids.length === 0)
    return NextResponse.json({ ok: false, message: "Tidak ada klien yang dipilih" }, { status: 400 });
  if (ids.length > MAKS_SEKALI)
    return NextResponse.json({ ok: false, message: `Maksimal ${MAKS_SEKALI} klien sekali hapus` }, { status: 400 });

  /* Disaring ulang lewat id_agent — daftar id datang dari browser, jadi
     memercayainya berarti seorang agent bisa menghapus kartu klien milik
     agent lain hanya dengan menebak nomornya. */
  const milik = await prisma.klien.findMany({
    where: { id_klien: { in: ids }, id_agent: agentId },
    select: { id_klien: true, nama: true, nomor_whatsapp: true, id_lead_asal: true },
  });

  if (milik.length === 0)
    return NextResponse.json({ ok: false, message: "Klien tidak ditemukan" }, { status: 404 });

  const idSah = milik.map(k => k.id_klien);

  /* NISAN dulu, baru hapus — alasan lengkapnya ada di DELETE /klien/[id].
     Ringkasnya: menghapus kartu klien tidak menghapus sumbernya (lead, titip
     jual, penawaran), jadi tanpa nisan ini putaran sinkron berikutnya akan
     mengimpor semuanya kembali beberapa detik kemudian. */
  const nisan = milik.flatMap(k =>
    kunciProspek(k).map(kunci => ({
      id_agent: agentId,
      kunci,
      nama_terakhir: k.nama,
      diabaikan_pada: new Date(),
    })),
  );

  await prisma.$transaction(async tx => {
    if (nisan.length) {
      await tx.prospekDiabaikan.createMany({ data: nisan, skipDuplicates: true });
      /* Nisan yang SUDAH ada didiamkan oleh skipDuplicates, jadi stempelnya
         disegarkan di sini; kalau tidak, nisan lama tetap lebih tua dari lead
         barunya dan orang itu akan terus kembali. */
      await tx.prospekDiabaikan.updateMany({
        where: { id_agent: agentId, kunci: { in: nisan.map(n => n.kunci) } },
        data: { diabaikan_pada: new Date() },
      });
    }
    await tx.klien.deleteMany({ where: { id_klien: { in: idSah }, id_agent: agentId } });
  });

  /* `deleted` adalah id yang BENAR-BENAR hilang, bukan id yang diminta.
     Browser memakainya untuk membuang baris — mengembalikan `ids` mentah akan
     membuat baris milik orang lain (atau yang sudah terhapus lebih dulu)
     lenyap dari layar padahal masih ada di basis data. */
  return NextResponse.json({ ok: true, deleted: idSah, jumlah: idSah.length });
}

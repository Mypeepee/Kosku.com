// /api/dashboard/klien/[id]/rekomendasi/singkirkan
// ---------------------------------------------------------------------------
// Agent membuang sebuah aset dari daftar rekomendasi seorang klien, dan
// memulihkannya kembali.
//
// KENAPA INI ADA.
// Mesin pencocokan hanya tahu apa yang ada kolomnya. Alasan sebenarnya sebuah
// aset tidak cocok sering tidak punya kolom: bangunannya menghadap makam,
// sertifikatnya bersengketa, klien sudah pernah melihatnya tahun lalu. Tanpa
// tempat menyimpan penilaian itu, aset yang sama naik ke puncak daftar setiap
// kali layar dibuka — dan agent berhenti membaca daftarnya.
//
// POST   { id_property, alasan? } → singkirkan
// DELETE ?id=123                  → pulihkan
// GET                             → daftar yang sedang disingkirkan
//
// ── KENAPA POST/DELETE, BUKAN SATU TOMBOL SAKELAR ─────────────────────────
// Sakelar ("balik keadaannya") berarti dua ketukan cepat dari jaringan yang
// lambat bisa berakhir di keadaan mana pun. Dua kata kerja yang menyebut
// TUJUANNYA selalu mendarat di tempat yang sama berapa kali pun diulang —
// dan tombol "Urungkan" di layar memang dirancang untuk diketuk terburu-buru.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";
import { fotoPertama, hargaEfektif } from "@/lib/klienMatch";
import { rapikanAlamat } from "@/lib/klienRingkas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/** Klien ini benar-benar milik agent yang sedang login?
 *
 *  Diperiksa dengan `findFirst` ber-`id_agent`, BUKAN `findUnique` lalu
 *  membandingkan di aplikasi: keduanya benar, tapi yang kedua mudah ditulis
 *  setengah (mengambil kliennya, lupa membandingkannya) dan hasilnya adalah
 *  siapa pun bisa menyingkirkan aset dari daftar klien orang lain dengan
 *  menebak id-nya. */
async function pastikanMilikAgent(idKlien: string, idAgent: string) {
  return prisma.klien.findFirst({
    where: { id_klien: idKlien, id_agent: idAgent },
    select: { id_klien: true },
  });
}

/** Kode agent yang sedang login, atau respons galat yang siap dikembalikan.
 *  Mengembalikan `NextResponse` (bukan melempar) supaya setiap kata kerja di
 *  berkas ini menuliskan gerbangnya sendiri secara terlihat — gerbang yang
 *  tersembunyi di dalam middleware adalah gerbang yang lupa dipasang. */
async function agentDariSesi(): Promise<string | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const agentId = (session.user as any).agentId as string | undefined;
  if (!agentId) return NextResponse.json({ ok: false }, { status: 403 });
  return agentId;
}

/* ── Daftar yang sedang disingkirkan ─────────────────────────────────────
   Dipakai tab "Disingkirkan" di layar Asisten Aset. Tab itu bukan hiasan:
   tindakan yang tidak bisa dilihat lagi setelah toast "Urungkan" hilang
   adalah tindakan yang menakutkan, dan agent yang takut salah buang akan
   berhenti memakai tombolnya sama sekali. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const agentId = await agentDariSesi();
  if (agentId instanceof NextResponse) return agentId;
  if (!(await pastikanMilikAgent(params.id, agentId)))
    return NextResponse.json({ ok: false }, { status: 404 });

  const rows = await prisma.rekomendasiDisingkirkan.findMany({
    where: { id_klien: params.id },
    orderBy: { dibuat_pada: "desc" },
    select: {
      id_property: true, alasan: true, dibuat_pada: true,
      listing: {
        select: {
          id_property: true, slug: true, judul: true, kategori: true, jenis_transaksi: true,
          kota: true, kecamatan: true, kelurahan: true, alamat_lengkap: true,
          harga: true, harga_promo: true, harga_efektif: true, nilai_limit_lelang: true,
          gambar: true, luas_tanah: true, luas_bangunan: true, status_tayang: true,
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    items: rows.map(r => ({
      id_property: r.id_property.toString(),
      alasan: r.alasan,
      disingkirkan_pada: r.dibuat_pada.toISOString(),
      slug: r.listing.slug,
      judul: r.listing.judul,
      kategori: r.listing.kategori,
      jenis_transaksi: r.listing.jenis_transaksi,
      /* Alamat lengkap, dirapikan — 26% baris lelang datang HURUF BESAR SEMUA
         dan teks yang berteriak justru lebih lambat dibaca. */
      alamat_lengkap: rapikanAlamat(r.listing.alamat_lengkap ?? "") ||
        [r.listing.kelurahan, r.listing.kecamatan, r.listing.kota].filter(Boolean).join(", "),
      harga: hargaEfektif(r.listing),
      gambar: fotoPertama(r.listing.gambar),
      luas_tanah: r.listing.luas_tanah ? Number(r.listing.luas_tanah) : 0,
      luas_bangunan: r.listing.luas_bangunan ? Number(r.listing.luas_bangunan) : 0,
      /* Aset yang sudah tidak tersedia tidak akan kembali ke daftar "Cocok"
         walau dipulihkan. Dikatakan di layar, supaya tombol "Pulihkan" yang
         seolah tidak berefek tidak terbaca sebagai kerusakan. */
      masih_tersedia: r.listing.status_tayang === "TERSEDIA",
    })),
  });
}

/* ── Singkirkan ─────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest, { params }: Ctx) {
  const agentId = await agentDariSesi();
  if (agentId instanceof NextResponse) return agentId;
  if (!(await pastikanMilikAgent(params.id, agentId)))
    return NextResponse.json({ ok: false }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  /* DAFTAR, bukan satu id. Layarnya memang menyingkirkan satu per satu hari
     ini, tapi bentuk jamak membuat "singkirkan semua yang tersisa" tidak
     butuh endpoint kedua — dan endpoint kedua yang menulis tabel yang sama
     adalah cara paling andal membuat keduanya menyimpang. */
  const ids: bigint[] = [];
  for (const raw of Array.isArray(body.ids) ? body.ids : [body.id_property]) {
    const n = String(raw ?? "").trim();
    if (/^\d+$/.test(n)) ids.push(BigInt(n));
  }
  if (ids.length === 0)
    return NextResponse.json({ ok: false, message: "id_property tidak sah" }, { status: 400 });

  const alasan = typeof body.alasan === "string" && body.alasan.trim()
    ? body.alasan.trim().slice(0, 500)
    : null;

  /* `skipDuplicates` — tombolnya bisa diketuk dua kali pada jaringan lambat,
     dan ketukan kedua tidak boleh berakhir sebagai 500 di layar agent. */
  const hasil = await prisma.rekomendasiDisingkirkan.createMany({
    data: ids.map(id_property => ({
      id_klien: params.id, id_property, id_agent: agentId, alasan,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({ ok: true, ditulis: hasil.count, ids: ids.map(String) });
}

/* ── Pulihkan ───────────────────────────────────────────────────────────── */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const agentId = await agentDariSesi();
  if (agentId instanceof NextResponse) return agentId;
  if (!(await pastikanMilikAgent(params.id, agentId)))
    return NextResponse.json({ ok: false }, { status: 404 });

  const url = new URL(req.url);
  const ids = (url.searchParams.get("id") || "")
    .split(",").map(s => s.trim()).filter(s => /^\d+$/.test(s)).map(BigInt);
  if (ids.length === 0)
    return NextResponse.json({ ok: false, message: "id tidak sah" }, { status: 400 });

  await prisma.rekomendasiDisingkirkan.deleteMany({
    where: { id_klien: params.id, id_property: { in: ids } },
  });

  return NextResponse.json({ ok: true, ids: ids.map(String) });
}

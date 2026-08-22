// POST /api/dashboard/klien/[id]/preferensi   → tambah SATU baris preferensi
// PUT  /api/dashboard/klien/[id]/preferensi   → ganti sekelompok baris, ATOMIK
// ---------------------------------------------------------------------------
// Aturan isian tidak ada di sini — seluruhnya di src/lib/preferensiInput.ts,
// yang juga dipakai jalur "preferensi ikut saat klien dibuat". Berkas ini
// mengurus tiga hal yang memang milik lapisan HTTP: siapa yang boleh menulis,
// apa yang terjadi kalau di tengah jalan gagal, dan bentuk JSON yang keluar.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";
import {
  bacaPreferensi,
  bacaBanyakPreferensi,
  serialisasiPreferensi,
} from "@/lib/preferensiInput";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

async function agentPemilik(idKlien: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { status: 401 as const };
  const agentId = (session.user as any).agentId as string | undefined;
  if (!agentId) return { status: 403 as const };
  const owned = await prisma.klien.findFirst({
    where: { id_klien: idKlien, id_agent: agentId },
    select: { id_klien: true },
  });
  if (!owned) return { status: 404 as const };
  return { status: 200 as const, agentId };
}

export async function POST(req: Request, { params }: Ctx) {
  const izin = await agentPemilik(params.id);
  if (izin.status !== 200) return NextResponse.json({ ok: false }, { status: izin.status });

  const dibaca = bacaPreferensi(await req.json());
  if (!dibaca.ok) return NextResponse.json({ ok: false, message: dibaca.message }, { status: 400 });

  const pref = await prisma.preferensiKlien.create({
    data: { id_klien: params.id, ...(dibaca.data as any) },
  });

  return NextResponse.json({ ok: true, data: serialisasiPreferensi(pref) }, { status: 201 });
}

/**
 * Ganti preferensi dalam SATU transaksi.
 *
 * ── KENAPA INI ADA ────────────────────────────────────────────────────────
 * Menyunting sebuah kriteria berarti menulis ulang barisnya: satu kartu di
 * layar ("Gudang atau Pabrik di Surabaya dan Gresik") tersimpan sebagai
 * perkalian tipe × lokasi, jadi mengubah satu wilayah mengubah jumlah barisnya.
 * Dulu itu dikerjakan browser sebagai rentetan permintaan terpisah — beberapa
 * DELETE, lalu beberapa POST — tanpa satu pun pemeriksaan hasil. Tiga cara
 * gagalnya semuanya senyap:
 *
 *   1. DELETE berhasil, POST ditolak (mis. lokasinya kosong) → kriteria klien
 *      LENYAP, dan agent melihat formulir tertutup seolah tersimpan.
 *   2. DELETE gagal, POST berhasil → baris lama tertinggal sebagai HANTU.
 *      Layar menampilkan kriteria baru (browser sudah membuang yang lama dari
 *      state-nya), tapi pencarian aset tetap memakai keduanya — persis gejala
 *      "sudah saya ganti wilayahnya, hasilnya tidak berubah".
 *   3. Tab tertutup di tengah rentetan → separuh kriteria hilang selamanya.
 *
 * Di sini keduanya jadi satu transaksi: berhasil semua, atau tidak
 * mengubah apa pun sama sekali.
 *
 * Body:
 *   { ganti?: string[], preferensi: PayloadPreferensi[] }
 *
 *   ganti  — id baris yang digantikan. Dihilangkan = GANTI SELURUHNYA (dipakai
 *            formulir "Edit Klien", yang memang memegang seluruh kriteria).
 *            Daftar kosong = tidak mengganti apa pun, hanya menambah.
 */
export async function PUT(req: Request, { params }: Ctx) {
  const izin = await agentPemilik(params.id);
  if (izin.status !== 200) return NextResponse.json({ ok: false }, { status: izin.status });

  const body = await req.json();

  const dibaca = bacaBanyakPreferensi(body?.preferensi);
  if (!dibaca.ok) return NextResponse.json({ ok: false, message: dibaca.message }, { status: 400 });

  /* Id dari HTTP tidak pernah dipercaya apa adanya: `ganti` ikut disaring ke
     id_klien ini di klausa where, jadi id milik klien lain yang diselipkan ke
     body tidak bisa terhapus. */
  const gantiSemua = body?.ganti === undefined || body?.ganti === null;
  const idGanti: bigint[] = Array.isArray(body?.ganti)
    ? body.ganti
        .map((v: unknown) => {
          try { return BigInt(String(v)); } catch { return null; }
        })
        .filter((v: bigint | null): v is bigint => v !== null)
    : [];

  try {
    const hasil = await prisma.$transaction(async (tx) => {
      if (gantiSemua) {
        await tx.preferensiKlien.deleteMany({ where: { id_klien: params.id } });
      } else if (idGanti.length) {
        await tx.preferensiKlien.deleteMany({
          where: { id_klien: params.id, id_preferensi: { in: idGanti } },
        });
      }

      /* createMany() lebih cepat tapi tidak mengembalikan barisnya, dan layar
         butuh id barunya untuk menggambar ulang kartu tanpa memuat ulang
         seluruh klien. Jumlahnya kecil (satu kartu jarang mekar jadi lebih
         dari selusin baris), jadi harga create satu-satu terbayar. */
      for (const row of dibaca.data) {
        await tx.preferensiKlien.create({ data: { id_klien: params.id, ...(row as any) } });
      }

      return tx.preferensiKlien.findMany({
        where: { id_klien: params.id },
        orderBy: { dibuat_pada: "asc" },
      });
    });

    /* SELURUH daftar dikembalikan, bukan hanya yang baru dibuat. Layar tidak
       perlu menebak-nebak baris mana yang bertahan, dan tidak ada keadaan
       tengah yang bisa dibaca salah. */
    return NextResponse.json({ ok: true, data: hasil.map(serialisasiPreferensi) });
  } catch (e) {
    console.error("[preferensi PUT] gagal:", e);
    return NextResponse.json(
      { ok: false, message: "Gagal menyimpan preferensi. Tidak ada yang diubah." },
      { status: 500 },
    );
  }
}

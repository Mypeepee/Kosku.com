import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";
import { turunkanMaksud } from "@/lib/klienMatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function POST(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const agentId = (session.user as any).agentId as string | undefined;
  if (!agentId) return NextResponse.json({ ok: false }, { status: 403 });

  const owned = await prisma.klien.findFirst({
    where: { id_klien: params.id, id_agent: agentId },
    select: { id_klien: true },
  });
  if (!owned) return NextResponse.json({ ok: false }, { status: 404 });

  const body = await req.json();

  /* ── YANG WAJIB SEKARANG LOKASI, BUKAN TIPE ─────────────────────────────
     Tipe kosong berarti SEMUA tipe — bawaan yang paling sering benar. Yang
     tidak boleh kosong adalah lokasi: preferensi tanpa wilayah menyaring 120
     ribu aset se-Indonesia dan tidak pernah menghasilkan daftar yang berguna.

     Diperiksa di sini, bukan hanya di formulir: formulir bisa dilewati, dan
     baris tanpa lokasi yang terlanjur masuk akan membanjiri panel "Siap
     dikirim" milik agent yang bahkan tidak membuatnya. */
  const adaLokasi = Boolean(
    body.loc_provinsi || body.loc_kota || body.loc_kecamatan || body.loc_kelurahan,
  );
  if (!adaLokasi) {
    return NextResponse.json(
      { ok: false, message: "Lokasi wajib diisi — minimal provinsi." },
      { status: 400 },
    );
  }

  const pref = await prisma.preferensiKlien.create({
    data: {
      id_klien:       params.id,
      tipe_properti:  body.tipe_properti || null,
      jenis_transaksi: body.jenis_transaksi || null,
      /* Maksud diturunkan di server, bukan dipercayakan pada form. Mesin
         pencocokan memakai kolom ini sebagai gerbang paling keras (BELI tidak
         pernah melihat listing SEWA), jadi ia tidak boleh bergantung pada
         satu pun pemanggil mengingat mengirimkannya. */
      maksud:         turunkanMaksud(body.jenis_transaksi || null, body.tipe_properti, body.maksud),
      lokasi_dicari:  body.lokasi_dicari || null,
      loc_provinsi:   body.loc_provinsi || null,
      loc_kota:       body.loc_kota || null,
      loc_kecamatan:  body.loc_kecamatan || null,
      loc_kelurahan:  body.loc_kelurahan || null,
      budget_min:     body.budget_min ? Number(body.budget_min) : null,
      budget_max:     body.budget_max ? Number(body.budget_max) : null,
      luas_min:       body.luas_min   ? Number(body.luas_min)   : null,
      luas_max:       body.luas_max   ? Number(body.luas_max)   : null,
      /* Enum, jadi nilai asing ditolak database — tidak perlu daftar putih di
         sini. Yang perlu dijaga cuma "" → null: string kosong bukan nilai enum
         yang sah dan akan melempar galat, sementara maksudnya justru "tidak
         mempermasalahkan". */
      legalitas:      body.legalitas || null,
      alamat_teks:    (typeof body.alamat_teks === "string" && body.alamat_teks.trim().length >= 3)
                        ? body.alamat_teks.trim().slice(0, 160) : null,
      dekat_nilai:    body.dekat_nilai || null,
      /* Radius di luar rentang wajar ditolak DI SINI juga, bukan hanya oleh
         CHECK database — galat constraint muncul sebagai 500 yang tidak bisa
         dibaca agent, sementara mengabaikannya menghasilkan radius bawaan yang
         masuk akal. */
      dekat_radius:   (typeof body.dekat_radius === "number"
                        && body.dekat_radius >= 200 && body.dekat_radius <= 20000)
                        ? Math.round(body.dekat_radius) : null,
      tujuan_beli:    body.tujuan_beli || null,
      catatan:        body.catatan || null,
    },
  });

  return NextResponse.json({
    ok: true,
    data: { ...pref, id_preferensi: String(pref.id_preferensi) },
  }, { status: 201 });
}

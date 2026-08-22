// POST /api/dashboard/klien/[id]/rekomendasi/kirim
// ---------------------------------------------------------------------------
// Catat aset yang dikirim ke seorang klien, dan kembalikan draf pesannya.
//
// Endpoint ini TIDAK mengirim apa pun. Ia mencatat niat mengirim dan menyusun
// teksnya; pengirimannya dilakukan agent dengan satu ketukan pada tautan wa.me
// yang dikembalikan. Lihat alasannya di src/lib/klienPesan.ts.
//
// Seluruh isinya ada di src/lib/kirimRekomendasi.ts — dibagi dengan jalur
// SATU KETUKAN dari email (/api/asisten/kirim), yang harus menghasilkan
// catatan yang persis sama.
//
// Body: {
//   ids: string[],
//   pref_map?: { [id_property]: id_preferensi },   ← peta, bukan satu nilai
//   id_preferensi?: string,                        ← jalur lama, jadi cadangan
//   kanal?: "WHATSAPP" | "EMAIL"
// }
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { catatKiriman } from "@/lib/kirimRekomendasi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function POST(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const agentId = (session.user as any).agentId as string | undefined;
  if (!agentId) return NextResponse.json({ ok: false }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.map(String) : [];

  /* Peta per-aset lebih dulu, nilai tunggal sebagai cadangan. Satu pesan bisa
     memuat aset dari kriteria yang berbeda — klien yang mencari "rumah Gresik
     ≤500jt" DAN "ruko Surabaya ≤1M" menerima keduanya dalam satu kiriman —
     dan mencatat semuanya di bawah satu preferensi membuat laporan "kriteria
     mana yang menghasilkan closing" bohong sejak baris pertama. */
  const prefMap: Record<string, string | null> = {};
  const tunggal = body?.id_preferensi ? String(body.id_preferensi) : null;
  for (const id of ids) prefMap[id] = tunggal;
  if (body?.pref_map && typeof body.pref_map === "object") {
    for (const [k, v] of Object.entries(body.pref_map as Record<string, unknown>)) {
      if (v != null) prefMap[String(k)] = String(v);
    }
  }

  const hasil = await catatKiriman({
    idKlien: params.id,
    agentId,
    ids,
    prefMap,
    kanal: body?.kanal === "EMAIL" ? "EMAIL" : "WHATSAPP",
    namaAgent: (session.user as any).name ?? null,
  });

  if (!hasil.ok) {
    return NextResponse.json({ ok: false, message: hasil.message }, { status: hasil.status });
  }

  const { nama: _nama, ...sisanya } = hasil;
  return NextResponse.json(sisanya);
}

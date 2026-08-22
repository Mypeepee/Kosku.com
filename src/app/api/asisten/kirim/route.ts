// /api/asisten/kirim
// ---------------------------------------------------------------------------
// Mencatat kiriman dari tombol di dalam email, lalu mengalihkan ke WhatsApp.
//
// ── GET vs POST — DAN KENAPA BEDANYA PENTING ─────────────────────────────
// POST  → mencatat, lalu 303 ke wa.me. Ini jalur yang sesungguhnya, dan hanya
//         bisa dipicu manusia yang menekan tombol di /asisten/kirim.
// GET   → TIDAK menulis apa pun. Ia hanya mengalihkan ke halaman konfirmasi.
//
// Pemisahan itu bukan formalitas. Gerbang keamanan email — Outlook Safe Links,
// Proofpoint, Mimecast, hampir semua gateway korporat — MENGAMBIL setiap tautan
// di dalam email untuk dipindai, tanpa ada manusia yang mengetuk apa pun. Waktu
// GET masih mencatat, tiap pemindaian melahirkan kiriman palsu; aset yang
// tercatat terkirim lenyap dari daftar "Cocok", dan agent tidak akan pernah
// benar-benar mengirimkannya. Rusak tanpa suara.
//
// GET tetap dilayani (bukan ditolak) supaya email yang TERLANJUR terkirim
// dengan tautan lama tidak mati — ia mendarat di halaman konfirmasi seperti
// email baru.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bacaTiket, petaPreferensi } from "@/lib/asistenToken";
import { catatKiriman } from "@/lib/kirimRekomendasi";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Halaman jatuh saat tiketnya tidak bisa dipakai. Selalu CRM dengan klien
 *  terbuka bila kita masih tahu siapa kliennya — agent yang mengetuk tombol di
 *  email sedang ingin menindaklanjuti seseorang, dan mendaratkannya di halaman
 *  galat kosong membuang niat itu. */
function jatuhKe(idKlien?: string | null): string {
  return idKlien
    ? `${SITE_URL}/dashboard/crm?klien=${encodeURIComponent(idKlien)}`
    : `${SITE_URL}/dashboard/crm`;
}

/** GET tidak menulis apa pun — lihat catatan di atas. */
export async function GET(req: NextRequest) {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  return NextResponse.redirect(`${SITE_URL}/asisten/kirim?t=${encodeURIComponent(t)}`, 302);
}

export async function POST(req: NextRequest) {
  /* Tiketnya datang dari formulir (application/x-www-form-urlencoded), tapi
     query string tetap diterima sebagai cadangan supaya pemanggilan manual
     saat menguji tidak perlu menyusun formulir. */
  let token = new URL(req.url).searchParams.get("t");
  if (!token) {
    const form = await req.formData().catch(() => null);
    token = (form?.get("t") as string | null) ?? null;
  }

  const isi = bacaTiket(token);
  if (!isi) return NextResponse.redirect(`${SITE_URL}/asisten/kirim?t=`, 303);

  /* Nama agent untuk tanda tangan di dalam draf. Sekaligus memastikan agent-nya
     masih ada — tiket berumur seminggu bisa mengalami agent yang dinonaktifkan. */
  const agent = await prisma.agent.findUnique({
    where: { id_agent: isi.a },
    select: { id_agent: true, pengguna: { select: { nama_lengkap: true } } },
  });
  if (!agent) return NextResponse.redirect(jatuhKe(isi.k), 303);

  const hasil = await catatKiriman({
    idKlien: isi.k,
    agentId: isi.a,
    ids: isi.p,
    prefMap: petaPreferensi(isi),
    namaAgent: agent.pengguna?.nama_lengkap ?? null,
  });

  /* Gagal mencatat (aset keburu terjual, klien dihapus) → dorong ke layar
     Asisten Aset klien itu, yang menampilkan daftar TERBARU. Aset yang hilang
     antara email terkirim dan tombol diketuk bukan kejadian langka; yang tidak
     boleh terjadi adalah agent mengira sistemnya rusak. */
  if (!hasil.ok || !hasil.waUrl) return NextResponse.redirect(jatuhKe(isi.k), 303);

  /* 303, bukan 307. Sesudah POST, 307 menyuruh peramban MENGULANG POST-nya ke
     wa.me — permintaan yang tidak masuk akal dan ditolak. 303 mengubahnya jadi
     GET, yang memang perilaku yang benar sesudah formulir dikirim. */
  return NextResponse.redirect(hasil.waUrl, 303);
}

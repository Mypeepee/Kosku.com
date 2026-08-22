import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";
import { kunciProspek } from "@/lib/prospek";
import { syncFollowUpAcara } from "../_syncFollowUp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

// CRM status → lead status (kebalikan LEAD_TO_KLIEN_STATUS di from-lead).
// Dipakai untuk sinkron dua-arah: ubah status di CRM Pipeline → lead Hot Leads ikut.
const KLIEN_TO_LEAD_STATUS: Record<string, string> = {
  lead_baru:      "new",
  sudah_dikontak: "contacted",
  hot_buyer:      "hot",
  closing:        "closing",
  lost_iseng:     "cold",
};

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const agentId = (session.user as any).agentId as string | undefined;
  if (!agentId) return NextResponse.json({ ok: false }, { status: 403 });

  const klien = await prisma.klien.findFirst({
    where: { id_klien: params.id, id_agent: agentId },
    include: {
      preferensi: { orderBy: { dibuat_pada: "asc" } },
      propertiAsal: { select: { id_property: true, judul: true, slug: true, kota: true, kategori: true, alamat_lengkap: true, jenis_transaksi: true } },
    },
  });

  if (!klien) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, data: serializeKlien(klien) });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const agentId = (session.user as any).agentId as string | undefined;
  if (!agentId) return NextResponse.json({ ok: false }, { status: 403 });

  const existing = await prisma.klien.findFirst({
    where: { id_klien: params.id, id_agent: agentId },
  });
  if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

  const body = await req.json();

  const data: any = {};
  if (body.nama             !== undefined) data.nama             = body.nama.trim();
  if (body.nomor_whatsapp   !== undefined) data.nomor_whatsapp   = body.nomor_whatsapp || null;
  if (body.email            !== undefined) data.email            = body.email || null;
  if (body.sumber           !== undefined) data.sumber           = body.sumber;
  if (body.status           !== undefined) data.status           = body.status;
  if (body.catatan          !== undefined) data.catatan          = body.catatan || null;
  if (body.metode_pembayaran !== undefined) data.metode_pembayaran = body.metode_pembayaran || null;
  if (body.bank_kpr         !== undefined) data.bank_kpr         = body.bank_kpr || null;
  if (body.tenor_kpr        !== undefined) data.tenor_kpr        = body.tenor_kpr ? Number(body.tenor_kpr) : null;
  const followUpChanged = body.tanggal_follow_up !== undefined;
  if (followUpChanged)
    data.tanggal_follow_up = body.tanggal_follow_up ? new Date(body.tanggal_follow_up) : null;
  if (body.tanggal_kontak_terakhir !== undefined)
    data.tanggal_kontak_terakhir = body.tanggal_kontak_terakhir
      ? new Date(body.tanggal_kontak_terakhir) : null;

  if (Object.keys(data).length === 0)
    return NextResponse.json({ ok: false, message: "Tidak ada data yang diubah" }, { status: 400 });

  data.diperbarui_pada = new Date();

  const updated = await prisma.klien.update({
    where: { id_klien: params.id },
    data,
    include: {
      preferensi: { orderBy: { dibuat_pada: "asc" } },
      propertiAsal: { select: { id_property: true, judul: true, slug: true, kota: true, kategori: true, alamat_lengkap: true, jenis_transaksi: true } },
    },
  });

  // Sinkron dua-arah: kalau klien ini berasal dari lead, perbarui status,
  // nama & nomor lead-nya juga supaya kartu Hot Leads tetap konsisten.
  if (existing.id_lead_asal) {
    const leadData: any = {};
    if (body.status !== undefined) {
      const leadStatus = KLIEN_TO_LEAD_STATUS[body.status as string];
      if (leadStatus) leadData.status = leadStatus;
    }
    if (body.nama !== undefined)           leadData.client_name  = body.nama.trim() || null;
    if (body.nomor_whatsapp !== undefined) leadData.client_phone = body.nomor_whatsapp || null;

    if (Object.keys(leadData).length > 0) {
      leadData.last_activity = new Date();
      try {
        await prisma.lead.updateMany({
          where: { id_lead: existing.id_lead_asal, id_agent: agentId },
          data: leadData,
        });
      } catch (e) {
        // Jangan gagalkan update klien hanya karena sinkron lead bermasalah.
        console.warn("[klien PATCH] gagal sinkron ke lead:", e);
      }
    }
  }

  // Sinkron follow-up ke kalender acara jika tanggal follow up berubah
  if (followUpChanged) {
    const newFollowUp = data.tanggal_follow_up as Date | null | undefined;
    syncFollowUpAcara(
      agentId,
      params.id,
      updated.nama,
      newFollowUp ?? null,
    ).catch(() => {});
  }

  return NextResponse.json({ ok: true, data: serializeKlien(updated) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const agentId = (session.user as any).agentId as string | undefined;
  if (!agentId) return NextResponse.json({ ok: false }, { status: 403 });

  const existing = await prisma.klien.findFirst({
    where: { id_klien: params.id, id_agent: agentId },
  });
  if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

  /* NISAN dulu, baru hapus.
     Sinkron prospek membandingkan sumber (Lead, Titip Jual, Penawaran, Site
     Visit) dengan klien yang SEDANG ADA. Menghapus kartu klien tidak menghapus
     sumbernya, jadi tanpa nisan ini putaran sinkron berikutnya — yang berjalan
     otomatis beberapa detik kemudian — akan mengimpornya kembali, dan
     penghapusannya terlihat membatalkan dirinya sendiri.

     Urutannya sengaja: nisan lebih dulu. Kalau penghapusan gagal, yang tersisa
     cuma nisan tak terpakai yang tidak merugikan siapa pun; kalau terbalik dan
     nisannya yang gagal, kliennya hilang lalu hidup lagi — persis bug yang
     sedang diperbaiki. */
  const kunci = kunciProspek(existing);
  if (kunci.length) {
    await prisma.prospekDiabaikan.createMany({
      data: kunci.map(k => ({
        id_agent: agentId,
        kunci: k,
        nama_terakhir: existing.nama,
        diabaikan_pada: new Date(),
      })),
      skipDuplicates: true,
    });
    /* Prospek yang dihapus DUA KALI (masuk lagi lewat aktivitas baru, dibuang
       lagi) harus memakai waktu pembuangan TERAKHIR. skipDuplicates di atas
       diam saja pada baris yang sudah ada, jadi stempelnya disegarkan di sini —
       kalau tidak, nisan lama tetap lebih tua dari lead barunya dan orang itu
       akan terus kembali. */
    await prisma.prospekDiabaikan.updateMany({
      where: { id_agent: agentId, kunci: { in: kunci } },
      data: { diabaikan_pada: new Date(), nama_terakhir: existing.nama },
    });
  }

  await prisma.klien.delete({ where: { id_klien: params.id } });
  return NextResponse.json({ ok: true });
}

function serializeKlien(k: any) {
  return {
    ...k,
    id_lead_asal:     k.id_lead_asal     ? String(k.id_lead_asal)     : null,
    id_properti_asal: k.id_properti_asal ? String(k.id_properti_asal) : null,
    propertiAsal: k.propertiAsal
      ? { ...k.propertiAsal, id_property: String(k.propertiAsal.id_property) }
      : null,
    preferensi: (k.preferensi || []).map((p: any) => ({
      ...p,
      id_preferensi: String(p.id_preferensi),
      budget_min: p.budget_min ? Number(p.budget_min) : null,
      budget_max: p.budget_max ? Number(p.budget_max) : null,
      luas_min:   p.luas_min   ? Number(p.luas_min)   : null,
      luas_max:   p.luas_max   ? Number(p.luas_max)   : null,
    })),
  };
}

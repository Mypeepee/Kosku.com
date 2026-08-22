import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";
import { normPhone } from "@/lib/prospek";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/dashboard/klien/sync-prospek
 *
 * Auto-import semua "calon klien" milik agent ke tabel Klien, dedup by nomor
 * telepon ternormalisasi (1 nomor = 1 klien). Sumber:
 *   1. Titip jual   → PropertyTitip (diklaim agent)
 *   2. WA organik    → Lead (source whatsapp / telepon / form_inquiry / cobroke)
 *   3. Penawaran     → Lead yang punya penawaran (status → Hot Buyer)
 *   4. Site visit    → Lead source survei + BookingSurvei (follow-up = tgl survei)
 *
 * Idempotent: aman dipanggil berkali-kali. Klien yang sudah ada tidak
 * dibuat ulang; status hanya dinaikkan (tidak pernah diturunkan), dan
 * nama/catatan yang sudah diisi agent tidak ditimpa.
 */

// Urutan status — index lebih tinggi = lebih maju
const STATUS_RANK: Record<string, number> = {
  lost_iseng: 0, lead_baru: 1, sudah_dikontak: 2, hot_buyer: 3, closing: 4,
};

const LEAD_TO_KLIEN_STATUS: Record<string, string> = {
  new: "lead_baru", contacted: "sudah_dikontak", hot: "hot_buyer",
  closing: "closing", cold: "lost_iseng",
};

function rpShort(n: number | null | undefined): string | null {
  if (!n) return null;
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1).replace(".0", "")} M`;
  if (n >= 1_000_000)     return `Rp ${Math.round(n / 1_000_000)} jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

const TIPE_LABEL: Record<string, string> = {
  RUMAH: "Rumah", APARTEMEN: "Apartemen", RUKO: "Ruko", TANAH: "Tanah",
  GUDANG: "Gudang", PABRIK: "Pabrik", HOTEL_DAN_VILLA: "Hotel & Villa", TOKO: "Toko",
};

type Candidate = {
  key: string;            // dedup key: phone || lead:<id>
  phone: string | null;
  id_lead: bigint | null;
  id_property: bigint | null;
  nama: string;
  status: string;
  sumber: string;
  catatan: string;
  follow_up: Date | null;
  kontak_at: Date | null;
};

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    const agentId = (session.user as any).agentId as string | undefined;
    if (!agentId)
      return NextResponse.json({ ok: false, message: "Bukan akun agent" }, { status: 403 });

    // ── Tarik data dari semua sumber ──────────────────────────────────────
    const [leads, titips, surveis, existingKlien] = await Promise.all([
      prisma.lead.findMany({
        where: { id_agent: agentId },
        select: {
          id_lead: true, id_property: true, source: true, status: true,
          client_name: true, client_phone: true,
          penawaran: true, status_penawaran: true,
          last_activity: true, created_at: true,
        },
        orderBy: { created_at: "desc" },
        take: 1000,
      }),
      prisma.propertyTitip.findMany({
        where: { diklaim_oleh_agent: agentId, status: "terklaim" },
        select: {
          id_titip: true, jenis_properti: true, kota: true, estimasi_harga: true,
          pengirim_nama: true, pengirim_phone: true, diklaim_pada: true, dibuat_pada: true,
        },
        orderBy: { dibuat_pada: "desc" },
        take: 1000,
      }),
      prisma.bookingSurvei.findMany({
        where: { id_agent: agentId },
        select: {
          nama_klien: true, nomor_telepon: true, tanggal_survei: true,
          status: true, tanggal_dibuat: true,
        },
        orderBy: { tanggal_survei: "desc" },
        take: 1000,
      }),
      prisma.klien.findMany({
        where: { id_agent: agentId },
        select: { id_klien: true, nomor_whatsapp: true, status: true, id_lead_asal: true, nama: true, catatan: true },
      }),
    ]);

    // ── Susun kandidat dari tiap sumber ───────────────────────────────────
    const candidates: Candidate[] = [];

    for (const l of leads) {
      const phone = normPhone(l.client_phone);
      const id_lead = l.id_lead;
      const key = phone ?? `lead:${id_lead}`;
      const penawaranNum = l.penawaran ? Number(l.penawaran) : null;
      const isPenawaran = l.source === "penawaran" || penawaranNum;

      let status = LEAD_TO_KLIEN_STATUS[l.status] ?? "lead_baru";
      let sumber = "wa_organik";
      let catatan = "Auto-import · WA Organik";
      let follow_up: Date | null = null;

      if (l.source === "titip_jual") { sumber = "titip_jual"; catatan = "Auto-import · Titip Jual"; }
      else if (l.source === "form_inquiry") { sumber = "website"; catatan = "Auto-import · Form Website"; }
      else if (l.source === "survei") { catatan = "Auto-import · Site Visit"; if (STATUS_RANK[status] < 2) status = "sudah_dikontak"; }

      if (isPenawaran) {
        sumber = "wa_organik";
        catatan = `Auto-import · Penawaran${rpShort(penawaranNum) ? ` ${rpShort(penawaranNum)}` : ""}${l.status_penawaran ? ` (${l.status_penawaran})` : ""}`;
        if (STATUS_RANK[status] < 3) status = "hot_buyer";
      }

      candidates.push({
        key, phone, id_lead, id_property: l.id_property,
        nama: l.client_name?.trim() || "Prospek WA",
        status, sumber, catatan, follow_up,
        kontak_at: l.last_activity ?? l.created_at,
      });
    }

    for (const t of titips) {
      const phone = normPhone(t.pengirim_phone);
      if (!phone) continue;
      const est = t.estimasi_harga ? Number(t.estimasi_harga) : null;
      const detail = [TIPE_LABEL[t.jenis_properti] ?? t.jenis_properti, t.kota].filter(Boolean).join(" · ");
      candidates.push({
        key: phone, phone, id_lead: null, id_property: null,
        nama: t.pengirim_nama?.trim() || "Pemilik Titip Jual",
        status: "lead_baru", sumber: "titip_jual",
        catatan: `Auto-import · Titip Jual${detail ? ` — ${detail}` : ""}${rpShort(est) ? ` · est. ${rpShort(est)}` : ""}`,
        follow_up: null,
        kontak_at: t.diklaim_pada ?? t.dibuat_pada,
      });
    }

    for (const s of surveis) {
      const phone = normPhone(s.nomor_telepon);
      if (!phone) continue;
      const future = s.tanggal_survei && s.tanggal_survei.getTime() > Date.now();
      candidates.push({
        key: phone, phone, id_lead: null, id_property: null,
        nama: s.nama_klien?.trim() || "Prospek Site Visit",
        status: "sudah_dikontak", sumber: "wa_organik",
        catatan: `Auto-import · Site Visit ${s.tanggal_survei.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`,
        follow_up: future ? s.tanggal_survei : null,
        kontak_at: s.tanggal_dibuat,
      });
    }

    // ── Dedup antar kandidat: status paling maju & kontak terbaru menang ──
    candidates.sort((a, b) => {
      const r = (STATUS_RANK[b.status] ?? 0) - (STATUS_RANK[a.status] ?? 0);
      if (r !== 0) return r;
      return (b.kontak_at?.getTime() ?? 0) - (a.kontak_at?.getTime() ?? 0);
    });

    // ── Index klien yang sudah ada ────────────────────────────────────────
    const byPhone = new Map<string, typeof existingKlien[number]>();
    const byLead  = new Map<string, typeof existingKlien[number]>();
    for (const k of existingKlien) {
      const p = normPhone(k.nomor_whatsapp);
      if (p && !byPhone.has(p)) byPhone.set(p, k);
      if (k.id_lead_asal != null) byLead.set(String(k.id_lead_asal), k);
    }

    /* ── NISAN: prospek yang SENGAJA dibuang agent ──
       Dibaca sebagai peta kunci → waktu pembuangan. Kandidat dilewati hanya
       bila aktivitas sumbernya TIDAK LEBIH BARU dari nisannya; lead yang datang
       sesudah pembuangan berarti orang itu menghubungi lagi, dan itu bukan
       sampah lama. Kandidat tanpa waktu kontak diperlakukan sebagai lama —
       menerbitkan ulang sesuatu yang tak bertanggal akan membuat penghapusan
       terasa tidak pernah bekerja. */
    const nisanRows = await prisma.prospekDiabaikan.findMany({
      where: { id_agent: agentId },
      select: { kunci: true, diabaikan_pada: true },
    });
    const nisan = new Map(nisanRows.map(n => [n.kunci, n.diabaikan_pada]));

    const diabaikan = (c: Candidate): boolean => {
      if (nisan.size === 0) return false;
      const kunci = [c.phone, c.id_lead != null ? `lead:${c.id_lead}` : null].filter(Boolean) as string[];
      for (const k of kunci) {
        const pada = nisan.get(k);
        if (!pada) continue;
        if (!c.kontak_at || c.kontak_at <= pada) return true;
      }
      return false;
    };

    const seen = new Set<string>();
    const creates: any[] = [];
    const updates: { id_klien: string; data: any }[] = [];
    const usedLeadIds = new Set<string>(); // hindari konflik unique id_lead_asal

    let dilewati = 0;
    for (const c of candidates) {
      if (seen.has(c.key)) continue;
      seen.add(c.key);

      /* Nisan hanya menghalangi PEMBUATAN. Kalau kartu kliennya ternyata ada
         (agent membuatnya sendiri secara manual sesudah membuang prospeknya),
         pembaruan tetap jalan — nisan itu menolak impor, bukan menolak orangnya. */
      if (diabaikan(c) && !(c.phone && byPhone.has(c.phone)) && !(c.id_lead != null && byLead.has(String(c.id_lead)))) {
        dilewati++;
        continue;
      }

      const existing =
        (c.phone ? byPhone.get(c.phone) : undefined) ??
        (c.id_lead != null ? byLead.get(String(c.id_lead)) : undefined);

      if (existing) {
        const data: any = {};
        const curRank = STATUS_RANK[existing.status] ?? 0;
        const newRank = STATUS_RANK[c.status] ?? 0;
        if (newRank > curRank) data.status = c.status;
        if (c.kontak_at) data.tanggal_kontak_terakhir = c.kontak_at;
        if (c.follow_up) data.tanggal_follow_up = c.follow_up;
        if ((!existing.nama || existing.nama.startsWith("Prospek") || existing.nama.startsWith("Klien dari")) && c.nama)
          data.nama = c.nama;
        if (!existing.id_lead_asal && c.id_lead != null && !byLead.has(String(c.id_lead))) {
          data.id_lead_asal = c.id_lead;
          if (c.id_property != null) data.id_properti_asal = c.id_property;
          byLead.set(String(c.id_lead), existing);
        }
        if (Object.keys(data).length) {
          data.diperbarui_pada = new Date();
          updates.push({ id_klien: existing.id_klien, data });
        }
        continue;
      }

      // ── Buat baru ──
      const createData: any = {
        id_agent: agentId,
        nama: c.nama,
        nomor_whatsapp: c.phone,
        sumber: c.sumber,
        status: c.status,
        catatan: c.catatan,
        tanggal_kontak_terakhir: c.kontak_at,
        tanggal_follow_up: c.follow_up,
      };
      if (c.id_lead != null && !byLead.has(String(c.id_lead)) && !usedLeadIds.has(String(c.id_lead))) {
        createData.id_lead_asal = c.id_lead;
        if (c.id_property != null) createData.id_properti_asal = c.id_property;
        usedLeadIds.add(String(c.id_lead));
      }
      creates.push(createData);
    }

    // ── Tulis ke DB ───────────────────────────────────────────────────────
    let created = 0;
    if (creates.length) {
      const res = await prisma.klien.createMany({ data: creates, skipDuplicates: true });
      created = res.count;
    }
    if (updates.length) {
      await prisma.$transaction(
        updates.map(u => prisma.klien.update({ where: { id_klien: u.id_klien }, data: u.data })),
      );
    }

    return NextResponse.json({
      ok: true,
      created,
      updated: updates.length,
      scanned: candidates.length,
      dilewati,
    });
  } catch (e: any) {
    console.error("[sync-prospek]", e);
    return NextResponse.json({ ok: false, message: e?.message ?? "Server error" }, { status: 500 });
  }
}

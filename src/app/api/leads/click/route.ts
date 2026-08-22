// app/api/leads/click/route.ts
// Capture lead saat klien klik tombol WhatsApp / Telepon / Survei
// di halaman detail listing properti.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher-server";
import { notifyCobrokeSubmission } from "@/lib/notifications";

// "form_inquiry" = pengajuan sewa dari panel pemesanan /Sewa. Nilainya sudah
// ada di enum `lead_source_enum` sejak awal dan sudah dikenali hilir (dashboard
// menampilkannya sebagai "Form", sync-prospek memetakannya ke sumber "website"),
// jadi tidak ada migrasi maupun perubahan dashboard yang perlu menyertainya.
type ClickSource =
  | "whatsapp"
  | "telepon"
  | "survei"
  | "penawaran"
  | "cobroke"
  | "form_inquiry";

interface ClickBody {
  id_property: string | number;
  id_agent: string;
  source: ClickSource;
  session_id?: string;
  referrer?: string;
  client_name?: string;
  client_phone?: string;
  client_email?: string;
  offer_amount?: number;
  discount_pct?: number;
  payment_method?: "cash" | "kpr";
  notes?: string;
}

function detectDeviceType(ua: string): string {
  if (/mobile/i.test(ua)) return "mobile";
  if (/tablet|ipad/i.test(ua)) return "tablet";
  return "desktop";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ClickBody;

    if (!body.id_property || !body.id_agent || !body.source) {
      return NextResponse.json(
        { ok: false, error: "id_property, id_agent, source wajib diisi" },
        { status: 400 },
      );
    }

    if (
      !["whatsapp", "telepon", "survei", "penawaran", "cobroke", "form_inquiry"].includes(
        body.source,
      )
    ) {
      return NextResponse.json(
        { ok: false, error: "source tidak valid" },
        { status: 400 },
      );
    }

    // Cara bayar (cash/kpr) diperiksa SETELAH listingnya dibaca — lihat catatan
    // di bawah, tepat sesudah `findUnique`. Aturannya bergantung pada jenis
    // transaksi listing, dan jenis itu belum diketahui di sini.

    // Penawaran harga wajib login — anti klien nakal/ghoib.
    let pengguna: { id_pengguna: string; nama_lengkap: string; nomor_telepon: string | null; email: string | null } | null = null;
    if (body.source === "penawaran") {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json(
          { ok: false, error: "Unauthorized. Silakan login terlebih dahulu." },
          { status: 401 },
        );
      }
      pengguna = await prisma.pengguna.findUnique({
        where: { id_pengguna: String(session.user.id) },
        select: { id_pengguna: true, nama_lengkap: true, nomor_telepon: true, email: true },
      });
      if (!pengguna) {
        return NextResponse.json(
          { ok: false, error: "Akun tidak ditemukan" },
          { status: 404 },
        );
      }
    }

    // Co-broke hanya bisa diajukan oleh agent yang login, dengan data klien sendiri.
    let cobrokeAgent: { id_agent: string; id_pengguna: string; nama_kantor: string; pengguna: { nama_lengkap: string } } | null = null;
    if (body.source === "cobroke") {
      const session = await getServerSession(authOptions);
      const agentId = (session?.user as any)?.agentId as string | undefined;
      if (!session?.user?.id || !agentId) {
        return NextResponse.json(
          { ok: false, error: "Unauthorized. Hanya agent yang bisa mengajukan co-broke." },
          { status: 401 },
        );
      }
      if (!body.client_name?.trim() || !body.client_phone?.trim()) {
        return NextResponse.json(
          { ok: false, error: "Nama dan nomor WhatsApp klien wajib diisi" },
          { status: 400 },
        );
      }
      cobrokeAgent = await prisma.agent.findUnique({
        where: { id_agent: agentId },
        select: { id_agent: true, id_pengguna: true, nama_kantor: true, pengguna: { select: { nama_lengkap: true } } },
      });
      if (!cobrokeAgent) {
        return NextResponse.json(
          { ok: false, error: "Akun agent tidak ditemukan" },
          { status: 404 },
        );
      }
    }

    const id_property = BigInt(body.id_property);

    // Validasi listing & agent
    const listing = await prisma.listing.findUnique({
      where: { id_property },
      select: { id_property: true, id_agent: true, jenis_transaksi: true },
    });

    if (!listing) {
      return NextResponse.json(
        { ok: false, error: "Properti tidak ditemukan" },
        { status: 404 },
      );
    }

    /**
     * Cara bayar wajib untuk penawaran JUAL/LELANG, tidak untuk SEWA.
     *
     * "Cash atau KPR" adalah pertanyaan pembelian. Menyewa gudang tidak dibayar
     * dengan KPR, dan memaksa penyewa memilih salah satunya hanya menghasilkan
     * satu hal: kolom `pembayaran` di tabel lead terisi angka yang tidak pernah
     * berarti apa-apa, lalu ikut terbaca di dashboard agent sebagai fakta.
     * Lebih baik kosong daripada terisi keterangan yang tidak benar.
     */
    const penawaranSewa =
      body.source === "penawaran" && listing.jenis_transaksi === "SEWA";

    if (
      body.source === "penawaran" &&
      !penawaranSewa &&
      !["cash", "kpr"].includes(body.payment_method || "")
    ) {
      return NextResponse.json(
        { ok: false, error: "Cara bayar wajib diisi (cash/kpr)" },
        { status: 400 },
      );
    }

    // Gunakan id_agent dari listing (lebih akurat daripada dari client)
    const id_agent = listing.id_agent;

    // Tidak bisa co-broke listing sendiri
    if (body.source === "cobroke" && cobrokeAgent!.id_agent === id_agent) {
      return NextResponse.json(
        { ok: false, error: "Tidak bisa mengajukan co-broke untuk listing milik sendiri" },
        { status: 400 },
      );
    }

    // Tolak klaim co-broke baru jika agent ini masih punya klaim pending di properti ini
    if (body.source === "cobroke") {
      const existingPending = await prisma.lead.findFirst({
        where: {
          id_agent_cobroke: cobrokeAgent!.id_agent,
          id_property,
          source: "cobroke",
          status_penawaran: "pending",
        },
        select: { id_lead: true, created_at: true },
      });

      if (existingPending) {
        return NextResponse.json(
          {
            ok: false,
            error: "PENDING_COBROKE_EXISTS",
            existing: {
              id_lead: existingPending.id_lead.toString(),
              penawaran: null,
              created_at: existingPending.created_at.toISOString(),
            },
          },
          { status: 409 },
        );
      }
    }

    // Tolak penawaran baru jika user masih punya penawaran pending di properti ini
    if (body.source === "penawaran") {
      const existingPending = await prisma.lead.findFirst({
        where: {
          id_pengguna: pengguna!.id_pengguna,
          id_property,
          source: "penawaran",
          status_penawaran: "pending",
        },
        select: { id_lead: true, penawaran: true, created_at: true },
      });

      if (existingPending) {
        return NextResponse.json(
          {
            ok: false,
            error: "PENDING_OFFER_EXISTS",
            existing: {
              id_lead: existingPending.id_lead.toString(),
              penawaran: existingPending.penawaran ? Number(existingPending.penawaran) : null,
              created_at: existingPending.created_at.toISOString(),
            },
          },
          { status: 409 },
        );
      }
    }

    // Tracking metadata
    const userAgent = req.headers.get("user-agent") || "";
    const forwardedFor = req.headers.get("x-forwarded-for") || "";
    const realIp = req.headers.get("x-real-ip") || "";
    const ip = forwardedFor.split(",")[0]?.trim() || realIp || null;
    const referrer = body.referrer || req.headers.get("referer") || null;
    const deviceType = detectDeviceType(userAgent);

    // Untuk penawaran, identitas klien diambil dari akun (bukan input client)
    // supaya tidak bisa dipalsukan.
    const clientName = pengguna?.nama_lengkap || body.client_name?.trim() || null;
    const clientPhone = pengguna?.nomor_telepon || body.client_phone?.trim() || null;
    const clientEmail = pengguna?.email || body.client_email?.trim() || null;
    const offerAmount =
      body.source === "penawaran" && body.offer_amount
        ? BigInt(Math.round(body.offer_amount))
        : null;
    // Sumber yang memang membawa keterangan dari pengirimnya. Klik WA/telepon
    // tidak: catatan yang datang bersamanya hanya bisa berasal dari pemanggil
    // yang mengarang isinya.
    //
    // Dipotong 1000 karakter mengikuti lebar kolom `catatan` — tanpa ini,
    // catatan panjang membuat seluruh penyimpanan lead gagal, dan yang hilang
    // bukan cuma catatannya melainkan leadnya.
    const notes =
      body.source === "penawaran" ||
      body.source === "cobroke" ||
      body.source === "form_inquiry"
        ? body.notes?.trim().slice(0, 1000) || null
        : null;
    const diskon = body.source === "penawaran" ? body.discount_pct ?? null : null;
    const pembayaran =
      body.source === "penawaran" && !penawaranSewa
        ? body.payment_method ?? null
        : null;

    // Anti-spam ringan: jangan buat lead duplikat dalam 5 menit
    // untuk session+property+source yang sama.
    // Tidak berlaku untuk penawaran/cobroke — guard pending di atas sudah cukup,
    // dan dedup ini bisa menimpa lead yang sudah diputuskan.
    if (body.session_id && body.source !== "penawaran" && body.source !== "cobroke") {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recent = await prisma.lead.findFirst({
        where: {
          session_id: body.session_id,
          id_property,
          source: body.source,
          created_at: { gte: fiveMinAgo },
        },
        select: { id_lead: true, client_name: true, client_phone: true },
      });

      if (recent) {
        // Lengkapi data klien kalau sebelumnya belum ada
        await prisma.lead
          .update({
            where: { id_lead: recent.id_lead },
            data: {
              client_name: !recent.client_name ? clientName || undefined : undefined,
              client_phone: !recent.client_phone ? clientPhone || undefined : undefined,
              client_email: clientEmail || undefined,
              penawaran: offerAmount ?? undefined,
              diskon: diskon ?? undefined,
              pembayaran: pembayaran ?? undefined,
              catatan: notes || undefined,
              id_pengguna: pengguna?.id_pengguna || undefined,
              last_activity: new Date(),
            },
          })
          .catch(() => null);

        return NextResponse.json({
          ok: true,
          id_lead: recent.id_lead.toString(),
          deduped: true,
        });
      }
    }

    const lead = await prisma.lead.create({
      data: {
        id_property,
        id_agent,
        source: body.source,
        status: "new",
        ip_address: ip,
        user_agent: userAgent || null,
        device_type: deviceType,
        referrer,
        session_id: body.session_id || null,
        client_name: clientName,
        client_phone: clientPhone,
        client_email: clientEmail,
        penawaran: offerAmount,
        diskon,
        pembayaran,
        catatan: notes,
        status_penawaran:
          body.source === "penawaran" || body.source === "cobroke" ? "pending" : undefined,
        id_pengguna: pengguna?.id_pengguna || null,
        id_agent_cobroke: cobrokeAgent?.id_agent || null,
        last_activity: new Date(),
      },
      select: {
        id_lead: true,
      },
    });

    // Notifikasi real-time ke agent saat ada penawaran baru
    if (body.source === "penawaran") {
      pusherServer
        .trigger(`lead-agent-${id_agent}`, "penawaran:new", {
          id_lead: lead.id_lead.toString(),
          client_name: clientName,
          offer_amount: offerAmount ? offerAmount.toString() : null,
        })
        .catch((e) => console.warn("pusher trigger penawaran:new failed:", e));
    }

    // Notifikasi real-time ke agent pemilik listing saat ada klaim co-broke baru
    if (body.source === "cobroke" && cobrokeAgent) {
      pusherServer
        .trigger(`lead-agent-${id_agent}`, "cobroke:new", {
          id_lead: lead.id_lead.toString(),
          client_name: clientName,
          claimer_name: cobrokeAgent.pengguna.nama_lengkap,
          claimer_office: cobrokeAgent.nama_kantor,
        })
        .catch((e) => console.warn("pusher trigger cobroke:new failed:", e));

      const listingFull = await prisma.listing.findUnique({
        where: { id_property },
        select: { judul: true },
      });

      await notifyCobrokeSubmission({
        id_agent_owner: id_agent,
        id_property,
        id_lead: lead.id_lead,
        judul_listing: listingFull?.judul || "",
        claimer_name: cobrokeAgent.pengguna.nama_lengkap,
        claimer_office: cobrokeAgent.nama_kantor,
      }).catch((e) => console.warn("notifyCobrokeSubmission failed:", e));
    }

    // Tambah counter di listing (kolom wa_click_count sudah ada)
    if (body.source === "whatsapp") {
      await prisma.listing
        .update({
          where: { id_property },
          data: { wa_click_count: { increment: 1 } },
        })
        .catch(() => null);
    }

    return NextResponse.json({
      ok: true,
      id_lead: lead.id_lead.toString(),
    });
  } catch (error) {
    console.error("❌ /api/leads/click error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}

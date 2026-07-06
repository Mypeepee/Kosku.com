// src/app/api/cron/acara-reminder/route.ts
// ---------------------------------------------------------------------------
// CRON: PENGINGAT ACARA (H-3 jam)
//
// Memindai acara yang akan MULAI dalam <= 3 jam ke depan dan belum pernah
// dikirimi pengingat (reminder_sent = false), lalu mengirim email pengingat
// ke:
//   • PEMBUAT acara (agent pemilik), dan
//   • SEMUA PESERTA yang diundang (relasi undangan).
// Setelah minimal satu email terkirim, reminder_sent di-set true supaya tidak
// dobel — jadi cron ini aman dipanggil berulang (mis. tiap 15 menit).
//
// Otomatisasi: dipanggil oleh scheduler in-process di server.js (produksi).
// Bisa juga dipanggil manual / lewat cron cPanel:
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//        "https://solusindoaset.com/api/cron/acara-reminder"
//
// Opsi query:
//   ?secret=XXX   → alternatif Authorization header (memudahkan tes manual)
//   ?dryRun=1     → hanya laporkan acara + calon penerima, TANPA kirim email
//   ?hours=3      → override jendela H-x jam (default 3)
//   ?test=a@b.com → kirim SATU email contoh ke alamat ini (tanpa sentuh DB)
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { status_acara_enum } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendAgentEventReminderEmail } from "@/lib/mailer";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REMINDER_LEAD_HOURS = 3; // kirim H-3 jam sebelum acara mulai

// Label ramah untuk tiap tipe acara — SAMA persis dengan pilihan di modal
// "Tambah Acara" (modal-acara.tsx) supaya bahasa di email konsisten.
const TIPE_ACARA_LABEL: Record<string, string> = {
  BUYER_MEETING: "Meeting Buyer",
  SITE_VISIT: "Site Visit",
  CLOSING: "Closing",
  FOLLOW_UP: "Follow Up",
  OPEN_HOUSE: "Open House",
  INTERNAL_MEETING: "Meeting Internal",
  TRAINING: "Training",
  PEMILU: "Event PEMILU",
  LAINNYA: "Lainnya",
};

// Ubah teks lokasi bebas menjadi link pencarian Google Maps (bila ada).
function mapsUrl(lokasi?: string | null): string | null {
  const q = (lokasi || "").trim();
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Kalau CRON_SECRET belum di-set (dev), izinkan supaya mudah dites lokal.
  if (!secret) return true;
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const qs = new URL(req.url).searchParams.get("secret") || "";
  return bearer === secret || qs === secret;
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const leadHours = Number(url.searchParams.get("hours")) || REMINDER_LEAD_HOURS;
  const testTo = url.searchParams.get("test");

  const now = new Date();

  // ── Mode TES: kirim satu email contoh ke alamat tertentu (tanpa DB) ───────
  if (testTo) {
    const start = new Date(now.getTime() + leadHours * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const loc = "Jl. Bukit Darmo Golf No. 12, Surabaya";
    const res = await sendAgentEventReminderEmail(testTo, {
      agentName: "Bapak/Ibu",
      eventTitle: "Open House — Cluster Graha Family",
      startAt: start,
      endAt: end,
      category: "Open House",
      location: loc,
      locationUrl: mapsUrl(loc),
      notes: "Ini email CONTOH untuk menguji tampilan pengingat acara.",
      detailUrl: `${SITE_URL}/dashboard#kalender`,
      now,
    });
    return NextResponse.json({
      mode: "test",
      to: testTo,
      delivered: res.delivered,
      note: res.delivered
        ? "Email contoh terkirim."
        : "SMTP belum dikonfigurasi (GMAIL_USER / GMAIL_APP_PASSWORD). Email tidak terkirim.",
    });
  }

  // ── Mode CRON: pindai acara yang jatuh dalam jendela H-x jam ──────────────
  const windowEnd = new Date(now.getTime() + leadHours * 60 * 60 * 1000);

  const due = await prisma.acara.findMany({
    where: {
      reminder_sent: false,
      status_acara: {
        notIn: [status_acara_enum.CANCELLED, status_acara_enum.COMPLETED],
      },
      // Belum mulai, tapi akan mulai dalam <= leadHours jam ke depan.
      tanggal_mulai: { gt: now, lte: windowEnd },
    },
    include: {
      agent: {
        select: {
          id_agent: true,
          pengguna: { select: { nama_lengkap: true, email: true } },
        },
      },
      undangan: {
        select: {
          id_agent: true,
          agent: {
            select: {
              id_agent: true,
              pengguna: { select: { nama_lengkap: true, email: true } },
            },
          },
        },
      },
    },
    orderBy: { tanggal_mulai: "asc" },
  });

  type Row = {
    id_acara: string;
    judul: string;
    mulai: string;
    penerima: number;
    terkirim: number;
    status: "sent" | "failed" | "skipped" | "dryRun";
    to?: string[];
  };
  const results: Row[] = [];

  let emailsSent = 0;
  let eventsFailed = 0;
  let eventsSkipped = 0;

  for (const a of due) {
    // Kumpulkan penerima unik: PEMBUAT + semua PESERTA yang diundang.
    type Rcpt = { email: string; name: string | null; role: "Pembuat" | "Peserta" };
    const recipients: Rcpt[] = [];
    const seen = new Set<string>();
    const add = (
      email: string | null | undefined,
      name: string | null | undefined,
      role: Rcpt["role"],
    ) => {
      const e = (email || "").trim().toLowerCase();
      if (!e || seen.has(e)) return;
      seen.add(e);
      recipients.push({ email: e, name: name ?? null, role });
    };

    add(a.agent?.pengguna?.email, a.agent?.pengguna?.nama_lengkap, "Pembuat");
    for (const u of a.undangan) {
      add(u.agent?.pengguna?.email, u.agent?.pengguna?.nama_lengkap, "Peserta");
    }

    const base = {
      id_acara: a.id_acara.toString(),
      judul: a.judul_acara,
      mulai: a.tanggal_mulai.toISOString(),
    };

    // Data email yang sama untuk semua penerima acara ini (nama di-personalisasi).
    const opts = {
      eventTitle: a.judul_acara,
      startAt: a.tanggal_mulai,
      endAt: a.tanggal_selesai,
      category: TIPE_ACARA_LABEL[a.tipe_acara] ?? a.tipe_acara,
      location: a.lokasi,
      locationUrl: mapsUrl(a.lokasi),
      notes: a.deskripsi,
      detailUrl: `${SITE_URL}/dashboard#kalender`,
      now,
    };

    // Tidak ada email valid → tandai processed supaya tak di-query ulang terus.
    if (recipients.length === 0) {
      if (!dryRun) {
        await prisma.acara.update({
          where: { id_acara: a.id_acara },
          data: { reminder_sent: true },
        });
      }
      eventsSkipped++;
      results.push({ ...base, penerima: 0, terkirim: 0, status: "skipped" });
      continue;
    }

    if (dryRun) {
      results.push({
        ...base,
        penerima: recipients.length,
        terkirim: 0,
        status: "dryRun",
        to: recipients.map((r) => `${r.email} (${r.role})`),
      });
      continue;
    }

    let delivered = 0;
    for (const r of recipients) {
      const res = await sendAgentEventReminderEmail(r.email, {
        ...opts,
        agentName: r.name,
      });
      if (res.delivered) delivered++;
    }

    if (delivered > 0) {
      // Hanya diset kalau BENAR ada yang terkirim, jadi kalau SMTP gagal
      // total, acara akan dicoba lagi di tick berikutnya.
      await prisma.acara.update({
        where: { id_acara: a.id_acara },
        data: { reminder_sent: true },
      });
      emailsSent += delivered;
      results.push({
        ...base,
        penerima: recipients.length,
        terkirim: delivered,
        status: "sent",
      });
    } else {
      eventsFailed++;
      results.push({
        ...base,
        penerima: recipients.length,
        terkirim: 0,
        status: "failed",
      });
    }
  }

  return NextResponse.json({
    message: "Pengingat acara selesai diproses",
    timestamp: now.toISOString(),
    leadHours,
    dryRun,
    totalAcara: due.length,
    emailsSent,
    eventsFailed,
    eventsSkipped,
    results,
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

// src/app/api/dashboard/agent/target/route.ts
// Target komisi bulanan per agent.
//
// GET  → returns last 7 months (incl current) + actuals from detail_transaksi
//        + can_edit flag (true kalau current user = agent itu sendiri ATAU OWNER)
// POST → upsert target untuk 1 bulan tertentu. Body:
//          { tahun, bulan, target_komisi, id_agent? }
//        Tanpa id_agent berarti diri sendiri.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
const WINDOW_SIZE = 7; // jumlah bulan yang ditampilkan (akhir = bulan ini)

interface AuthCtx {
  agentId: string;
  isOwner: boolean;
}

/**
 * Wewenang di sini menentukan siapa yang boleh membaca DAN menulis target agent
 * lain, jadi `jabatan` dibaca langsung dari DB — bukan dari session.
 *
 * Dua alasan. Pertama, `session.user.role` yang dipakai sebelumnya isinya
 * `peran_enum` (USER|AGENT), sehingga `role === "OWNER"` tidak pernah benar dan
 * owner diam-diam ditolak saat membuka target agent lain. Kedua, JWT baru
 * disegarkan tiap 5 menit — untuk endpoint yang menulis, jendela lima menit itu
 * berarti wewenang yang baru dicabut masih bisa dipakai.
 *
 * Satu query tambahan lewat unique index `id_pengguna`, dan sekaligus
 * menggantikan pencarian id_agent yang memang sudah dilakukan di sini.
 */
async function resolveAuth(): Promise<AuthCtx | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { agentId?: string; id?: string };
  const agentRow = user.id
    ? await prisma.agent.findUnique({
        where: { id_pengguna: user.id },
        select: { id_agent: true, jabatan: true },
      })
    : null;

  const agentId = agentRow?.id_agent ?? user.agentId;
  if (!agentId) {
    return NextResponse.json(
      { ok: false, error: "Akun ini bukan agent" },
      { status: 403 },
    );
  }

  return { agentId, isOwner: agentRow?.jabatan === "OWNER" };
}

/** Bangun list (year, month) terakhir untuk window N bulan, akhir = current. */
function buildWindow(now: Date) {
  const list: { year: number; month: number; label: string }[] = [];
  for (let i = WINDOW_SIZE - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    list.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: MONTHS_ID[d.getMonth()]!,
    });
  }
  return list;
}

/** Aktual komisi per (year,month) dari detail_transaksi. */
async function loadActualByMonth(
  id_agent: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<Map<string, number>> {
  // Grup di SQL agar tidak narik semua row. Pakai $queryRaw karena Prisma
  // groupBy belum support date_trunc/extract langsung di scalar field.
  // Hasil: { year, month, total }
  const rows = await prisma.$queryRaw<
    Array<{ y: number; m: number; total: bigint | number | string }>
  >`
    SELECT
      EXTRACT(YEAR  FROM t.tanggal_transaksi)::int AS y,
      EXTRACT(MONTH FROM t.tanggal_transaksi)::int AS m,
      COALESCE(SUM(dt.pendapatan), 0) AS total
    FROM detail_transaksi dt
    JOIN transaksi t ON t.id_transaksi = dt.id_transaksi
    WHERE dt.id_agent = ${id_agent}
      AND t.tanggal_transaksi >= ${windowStart}
      AND t.tanggal_transaksi <  ${windowEnd}
    GROUP BY y, m
  `;

  const out = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.y}-${r.m}`;
    out.set(key, Number(r.total));
  }
  return out;
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveAuth();
    if (ctx instanceof NextResponse) return ctx;

    const url = new URL(req.url);
    const queryAgentId = url.searchParams.get("agentId");
    // Default: data milik agent yang login. Owner boleh request agent lain.
    const targetAgentId = queryAgentId || ctx.agentId;
    if (queryAgentId && queryAgentId !== ctx.agentId && !ctx.isOwner) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const now = new Date();
    const months = buildWindow(now);
    const first = months[0]!;
    const last = months[months.length - 1]!;
    const windowStart = new Date(first.year, first.month - 1, 1);
    const windowEnd = new Date(last.year, last.month, 1); // exclusive

    const [targetRows, actualMap] = await Promise.all([
      prisma.targetAgent.findMany({
        where: {
          id_agent: targetAgentId,
          OR: months.map((m) => ({ tahun: m.year, bulan: m.month })),
        },
        select: {
          tahun: true,
          bulan: true,
          target_komisi: true,
        },
      }),
      loadActualByMonth(targetAgentId, windowStart, windowEnd),
    ]);

    const targetMap = new Map<string, number>();
    for (const t of targetRows) {
      targetMap.set(`${t.tahun}-${t.bulan}`, Number(t.target_komisi));
    }

    const target = months.map(
      (m) => targetMap.get(`${m.year}-${m.month}`) ?? 0,
    );
    const actual = months.map(
      (m) => actualMap.get(`${m.year}-${m.month}`) ?? 0,
    );

    const target_ytd = target.reduce((a, b) => a + b, 0);
    const actual_ytd = actual.reduce((a, b) => a + b, 0);

    return NextResponse.json({
      ok: true,
      agent_id: targetAgentId,
      can_edit: ctx.isOwner || targetAgentId === ctx.agentId,
      months,
      target,
      actual,
      summary: {
        target_window: target_ytd,
        actual_window: actual_ytd,
        achievement_pct:
          target_ytd > 0 ? Math.round((actual_ytd / target_ytd) * 1000) / 10 : null,
      },
    });
  } catch (e) {
    console.error("GET /api/dashboard/agent/target error:", e);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await resolveAuth();
    if (ctx instanceof NextResponse) return ctx;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Body invalid" },
        { status: 400 },
      );
    }

    const tahun = Number(body.tahun);
    const bulan = Number(body.bulan);
    const target_komisi = Number(body.target_komisi);
    const id_agent: string = body.id_agent || ctx.agentId;

    if (!Number.isInteger(tahun) || tahun < 2020 || tahun > 2100) {
      return NextResponse.json(
        { ok: false, error: "Tahun tidak valid" },
        { status: 400 },
      );
    }
    if (!Number.isInteger(bulan) || bulan < 1 || bulan > 12) {
      return NextResponse.json(
        { ok: false, error: "Bulan harus 1–12" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(target_komisi) || target_komisi < 0) {
      return NextResponse.json(
        { ok: false, error: "Target komisi harus angka ≥ 0" },
        { status: 400 },
      );
    }
    if (id_agent !== ctx.agentId && !ctx.isOwner) {
      return NextResponse.json(
        { ok: false, error: "Hanya bisa set target untuk diri sendiri" },
        { status: 403 },
      );
    }

    await prisma.targetAgent.upsert({
      where: {
        id_agent_tahun_bulan: { id_agent, tahun, bulan },
      },
      update: {
        target_komisi,
        diperbarui_pada: new Date(),
      },
      create: {
        id_agent,
        tahun,
        bulan,
        target_komisi,
        dibuat_oleh: ctx.agentId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/dashboard/agent/target error:", e);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}

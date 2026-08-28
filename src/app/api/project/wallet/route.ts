import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const globalForPg = globalThis as typeof globalThis & {
  __projectWalletPool?: Pool;
};

const pool =
  globalForPg.__projectWalletPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (!globalForPg.__projectWalletPool) {
  globalForPg.__projectWalletPool = pool;
}

type WalletSummaryRow = {
  total_dana: string | number | null;
  total_lunas: string | number | null;
  total_pending: string | number | null;
  project_aktif: string | number | null;
  jumlah_property_didanai: string | number | null;
  pending_payment_count: string | number | null;
  pending_project_count: string | number | null;
  realized_profit: string | number | null;
};

function toNumber(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

export async function GET(request: NextRequest) {
  const idAgent = request.nextUrl.searchParams.get("id_agent")?.trim();

  if (!idAgent) {
    return NextResponse.json(
      {
        success: false,
        message: "id_agent wajib dikirim.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await pool.query<WalletSummaryRow>(
      `
        SELECT
          inv.total_dana,
          inv.total_lunas,
          inv.total_pending,
          inv.project_aktif,
          inv.jumlah_property_didanai,
          inv.pending_payment_count,
          inv.pending_project_count,
          prof.realized_profit
        FROM (
          -- Uang yang SUDAH masuk vs yang baru dijanjikan dibedakan dari
          -- NOMINALNYA (komitmen vs terbayar), bukan dari kolom status —
          -- status bisa basi kalau komitmen diubah setelah ditandai lunas.
          SELECT
            COALESCE(SUM(pi.nominal_komitmen), 0) AS total_dana,
            COALESCE(SUM(pi.nominal_terbayar), 0) AS total_lunas,
            COALESCE(
              SUM(GREATEST(pi.nominal_komitmen - pi.nominal_terbayar, 0)),
              0
            ) AS total_pending,
            -- "Project aktif" = yang masih berjalan (bukan terjual/dibatalkan),
            -- sedangkan "property didanai" dihitung per ASET (id_listing).
            -- Sebelumnya keduanya COUNT(DISTINCT id_project) yang sama persis,
            -- jadi dua label berbeda selalu menampilkan angka identik.
            COUNT(DISTINCT pi.id_project) FILTER (
              WHERE p.status NOT IN ('terjual', 'dibatalkan')
            )::int AS project_aktif,
            COUNT(DISTINCT p.id_listing)::int AS jumlah_property_didanai,
            COUNT(*) FILTER (
              WHERE pi.nominal_komitmen > pi.nominal_terbayar
            )::int AS pending_payment_count,
            COUNT(DISTINCT CASE
              WHEN pi.nominal_komitmen > pi.nominal_terbayar THEN pi.id_project
              ELSE NULL
            END)::int AS pending_project_count
          FROM public.project_investor pi
          INNER JOIN public.project p
            ON p.id_project = pi.id_project
          WHERE pi.id_agent = $1
        ) inv
        CROSS JOIN (
          SELECT
            COALESCE(SUM(psi.profit), 0) AS realized_profit
          FROM public.project_selesai_investor psi
          WHERE psi.id_agent = $1
        ) prof
      `,
      [idAgent]
    );

    const row = result.rows[0] ?? {
      total_dana: 0,
      total_lunas: 0,
      total_pending: 0,
      project_aktif: 0,
      jumlah_property_didanai: 0,
      pending_payment_count: 0,
      pending_project_count: 0,
      realized_profit: 0,
    };

    const totalDana = toNumber(row.total_dana);
    const totalDanaLunas = toNumber(row.total_lunas);
    const totalDanaPending = toNumber(row.total_pending);
    const projectAktif = toNumber(row.project_aktif);
    const jumlahPropertyDidanai = toNumber(row.jumlah_property_didanai);
    const pendingPaymentCount = toNumber(row.pending_payment_count);
    const pendingProjectCount = toNumber(row.pending_project_count);
    const realizedProfit = toNumber(row.realized_profit);

    return NextResponse.json({
      success: true,
      data: {
        idAgent,
        totalDana,
        totalDanaLunas,
        totalDanaPending,
        projectAktif,
        jumlahPropertyDidanai,
        pendingPaymentCount,
        pendingProjectCount,
        hasPendingPayment: pendingPaymentCount > 0,
        realizedProfit,
      },
    });
  } catch (error) {
    console.error("[GET_PROJECT_WALLET_SUMMARY_ERROR]", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil ringkasan wallet investor.",
      },
      { status: 500 }
    );
  }
}
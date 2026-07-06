import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const globalForPg = globalThis as typeof globalThis & {
  __pgPool?: Pool;
};

const pool =
  globalForPg.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (!globalForPg.__pgPool) {
  globalForPg.__pgPool = pool;
}

type RouteContext = {
  params: {
    id_project: string;
  };
};

function toNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  const idProject = params?.id_project?.trim();

  if (!idProject) {
    return NextResponse.json(
      { success: false, message: "ID project tidak valid." },
      { status: 400 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Body tidak valid." },
      { status: 400 }
    );
  }

  const allowed = [
    "nama_project",
    "deskripsi_project",
    "status",
    "mulai_tanggal",
    "estimasi_selesai",
    "estimasi_bulan",
    "harga_pembelian",
    "estimasi_harga_jual",
    "estimasi_profit_bersih",
    "target_pendanaan",
    "nilai_limit_lelang",
    "spare_bidding",
    "biaya_eksekusi",
    "biaya_renov",
    "biaya_balik_nama",
    "dana_cadangan",
  ] as const;

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const field of allowed) {
    if (!(field in body)) continue;
    const raw = body[field];

    const numericFields = [
      "estimasi_bulan",
      "harga_pembelian",
      "estimasi_harga_jual",
      "estimasi_profit_bersih",
      "target_pendanaan",
      "nilai_limit_lelang",
      "spare_bidding",
      "biaya_eksekusi",
      "biaya_renov",
      "biaya_balik_nama",
      "dana_cadangan",
    ];

    if (numericFields.includes(field)) {
      const num = toNum(raw);
      if (num === null) continue;
      setClauses.push(`${field} = $${idx++}`);
      values.push(num);
    } else {
      setClauses.push(`${field} = $${idx++}`);
      values.push(raw === "" ? null : raw);
    }
  }

  if (setClauses.length === 0) {
    return NextResponse.json(
      { success: false, message: "Tidak ada field yang diupdate." },
      { status: 400 }
    );
  }

  setClauses.push(`diupdate_tanggal = NOW()`);
  values.push(idProject);

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE public.project SET ${setClauses.join(", ")} WHERE id_project = $${idx} RETURNING id_project, nama_project`,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, message: "Project tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("[PATCH_PROJECT_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengupdate project." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
) {
  const idProject = params?.id_project?.trim();

  if (!idProject) {
    return NextResponse.json(
      {
        success: false,
        message: "ID project tidak valid.",
      },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const projectCheck = await client.query<{
      id_project: string;
      nama_project: string;
    }>(
      `
        SELECT id_project, nama_project
        FROM public.project
        WHERE id_project = $1
        LIMIT 1
      `,
      [idProject]
    );

    if (projectCheck.rowCount === 0) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message: `Project ${idProject} tidak ditemukan.`,
        },
        { status: 404 }
      );
    }

    const deletedProject = await client.query<{
      id_project: string;
      nama_project: string;
    }>(
      `
        DELETE FROM public.project
        WHERE id_project = $1
        RETURNING id_project, nama_project
      `,
      [idProject]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: `Project ${deletedProject.rows[0].id_project} berhasil dihapus total.`,
      data: {
        id_project: deletedProject.rows[0].id_project,
        nama_project: deletedProject.rows[0].nama_project,
        deleted_children: [
          "project_cma",
          "project_investor",
          "project_arus_kas",
        ],
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("[DELETE_PROJECT_ERROR]", error);

    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan saat menghapus project.",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
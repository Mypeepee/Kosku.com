import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { pool } from "@/lib/db"; // sesuaikan dengan koneksi Postgres-mu

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { nama_bank, nomor_rekening, atas_nama_rekening } = body as {
    nama_bank?: string;
    nomor_rekening?: string;
    atas_nama_rekening?: string;
  };

  if (!nama_bank || !nomor_rekening || !atas_nama_rekening) {
    return NextResponse.json(
      { message: "Data rekening tidak lengkap" },
      { status: 400 }
    );
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        UPDATE public.agent
        SET nama_bank = $1,
            nomor_rekening = $2,
            atas_nama_rekening = $3,
            diperbarui_pada = CURRENT_TIMESTAMP
        WHERE id_pengguna = $4
        RETURNING id_agent, nama_bank, nomor_rekening, atas_nama_rekening;
        `,
        [nama_bank, nomor_rekening, atas_nama_rekening, session.user.id]
      );

      if (result.rowCount === 0) {
        return NextResponse.json(
          { message: "Agent tidak ditemukan" },
          { status: 404 }
        );
      }

      return NextResponse.json({ agent: result.rows[0] });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { message: "Gagal memperbarui rekening agent" },
      { status: 500 }
    );
  }
}

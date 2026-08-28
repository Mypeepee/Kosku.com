import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher-server";
import { loadFundState } from "@/lib/project-kas-server";

const ALLOWED_STATUSES = new Set(["menunggu_pembayaran", "lunas"]);

function toDecimal(value: unknown) {
  if (value instanceof Prisma.Decimal) return value;
  if (typeof value === "number" || typeof value === "string") {
    return new Prisma.Decimal(value);
  }
  return new Prisma.Decimal(0);
}

/**
 * Refresh cache persentase_kepemilikan = modal_disetor / max(target, Σsetor).
 * Kepemilikan ditampilkan live, cache dijaga konsisten. Lihat
 * src/lib/investor-ownership.ts.
 */
async function recalcOwnershipCache(
  tx: Prisma.TransactionClient,
  idProject: string,
  targetPendanaan: Prisma.Decimal
) {
  const investors = await tx.projectInvestor.findMany({
    where: { id_project: idProject },
    select: { id_project_investor: true, nominal_terbayar: true },
  });

  const totalPaid = investors.reduce(
    (sum, i) => sum.plus(toDecimal(i.nominal_terbayar)),
    new Prisma.Decimal(0)
  );
  const denom = totalPaid.gt(targetPendanaan) ? totalPaid : targetPendanaan;

  if (investors.length === 0) return;

  if (denom.gt(0)) {
    const cases = investors.map((i) => {
      const percent = toDecimal(i.nominal_terbayar)
        .div(denom)
        .mul(100)
        .toDecimalPlaces(6);
      return Prisma.sql`WHEN id_project_investor = ${i.id_project_investor} THEN ${percent}::numeric`;
    });
    await tx.$executeRaw(Prisma.sql`
      UPDATE project_investor
      SET persentase_kepemilikan = CASE ${Prisma.join(cases, " ")} ELSE persentase_kepemilikan END
      WHERE id_project = ${idProject}
    `);
  } else {
    await tx.$executeRaw(Prisma.sql`
      UPDATE project_investor SET persentase_kepemilikan = 0 WHERE id_project = ${idProject}
    `);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    const currentAgentId =
      typeof token?.agentId === "string"
        ? token.agentId
        : typeof token?.id_agent === "string"
        ? token.id_agent
        : null;

    if (!currentAgentId) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized. Agent tidak ditemukan di session.",
        },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);

    const investorIdRaw = body?.id_project_investor;
    const nextStatus = String(body?.status ?? "").trim();

    if (investorIdRaw == null || investorIdRaw === "") {
      return NextResponse.json(
        {
          success: false,
          message: "id_project_investor wajib diisi.",
        },
        { status: 400 }
      );
    }

    let investorId: bigint;

    try {
      investorId = BigInt(investorIdRaw);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "id_project_investor tidak valid.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_STATUSES.has(nextStatus)) {
      return NextResponse.json(
        {
          success: false,
          message: "Status pembayaran tidak valid.",
        },
        { status: 400 }
      );
    }

    const investor = await prisma.projectInvestor.findUnique({
      where: {
        id_project_investor: investorId,
      },
      select: {
        id_project_investor: true,
        id_agent: true,
        status: true,
        nominal_komitmen: true,
        nominal_terbayar: true,
        project: {
          select: {
            id_project: true,
            dibuat_oleh: true,
            target_pendanaan: true,
          },
        },
      },
    });

    if (!investor) {
      return NextResponse.json(
        {
          success: false,
          message: "Data investor project tidak ditemukan.",
        },
        { status: 404 }
      );
    }

    if (investor.project.dibuat_oleh !== currentAgentId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Hanya penyelenggara project yang boleh mengubah status pembayaran.",
        },
        { status: 403 }
      );
    }

    // Lunas → modal disetor = komitmen; kembali menunggu → disetor = 0.
    // Ini yang menggerakkan kas riil & kepemilikan. Recompute cache atomik.
    const nominalTerbayar =
      nextStatus === "lunas"
        ? toDecimal(investor.nominal_komitmen)
        : new Prisma.Decimal(0);

    // ── Anti-minus: menarik kembali modal yang SUDAH terpakai itu mustahil ──
    // Membatalkan status lunas menghapus modal disetor investor dari kas. Kalau
    // uangnya sudah dibelanjakan, kas jadi minus → tolak, bukan diam-diam
    // membuat pembukuan bohong.
    if (nextStatus !== "lunas") {
      const terbayarSekarang = toDecimal(investor.nominal_terbayar);

      if (terbayarSekarang.gt(0)) {
        const fundState = await loadFundState(
          prisma,
          investor.project.id_project
        );

        const kasSetelah = fundState
          ? fundState.sisaKas - Number(terbayarSekarang.toString())
          : 0;

        if (kasSetelah < 0) {
          const kurang = `Rp ${Math.round(Math.abs(kasSetelah)).toLocaleString(
            "id-ID"
          )}`;

          return NextResponse.json(
            {
              success: false,
              message: `Modal investor ini sudah terpakai untuk pengeluaran project. Membatalkan status lunas akan membuat kas proyek minus ${kurang}. Hapus atau sesuaikan pengeluarannya lebih dulu.`,
            },
            { status: 400 }
          );
        }
      }

      // Talangan & setoran penutup kekurangan menaikkan modal disetor lewat
      // alur arus kas. Mereset status pembayaran akan membuat baris-baris itu
      // menggantung (modal hilang, tapi transaksinya masih tercatat).
      const penutupCount = await prisma.projectArusKas.count({
        where: {
          id_project_investor: investorId,
          kategori_transaksi: { in: ["talangan_investor", "setoran_modal"] },
          status_transaksi: { not: "dibatalkan" },
        },
      });

      if (penutupCount > 0) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Investor ini pernah menutup kekurangan dana project, jadi status lunasnya tidak bisa dibatalkan. Hapus transaksi yang ditanggungnya lebih dulu.",
          },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.projectInvestor.update({
        where: { id_project_investor: investorId },
        data: {
          status: nextStatus as "menunggu_pembayaran" | "lunas",
          nominal_terbayar: nominalTerbayar,
        },
        select: {
          id_project_investor: true,
          status: true,
          diupdate_tanggal: true,
        },
      });

      await recalcOwnershipCache(
        tx,
        investor.project.id_project,
        toDecimal(investor.project.target_pendanaan)
      );

      return row;
    });

    // Real-time: beri tahu investor langsung jika statusnya berubah ke lunas
    if (nextStatus === "lunas" && investor.id_agent) {
      pusherServer
        .trigger(`project-investor-${investor.id_agent}`, "pembayaran:lunas", {
          id_project: investor.project.id_project,
        })
        .catch(() => {});
    }

    return NextResponse.json({
      success: true,
      message: "Status pembayaran berhasil diperbarui.",
      data: {
        id_project_investor: updated.id_project_investor.toString(),
        status: updated.status,
        diupdate_tanggal: updated.diupdate_tanggal.toISOString(),
      },
    });
  } catch (error) {
    console.error("[UPDATE_STATUS_PEMBAYARAN_ERROR]", error);

    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan server.",
      },
      { status: 500 }
    );
  }
}
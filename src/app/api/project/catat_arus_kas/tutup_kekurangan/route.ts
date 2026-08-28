import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";
import { loadFundState } from "@/lib/project-kas-server";
import { isWalletKey, WALLET_LABELS } from "@/lib/project-kas";
import { refreshOwnershipCache } from "../_lib/cash";

/**
 * ── TUTUP KEKURANGAN POS ───────────────────────────────────────────────────
 *
 * Untuk pos yang sudah terlanjur minus (data lama, sebelum aturan talangan
 * berlaku) atau kas proyek yang minus. Investor penanggung menutup seluruh
 * kekurangan sekaligus:
 *
 *   • dicatat sebagai baris `talangan_investor` pada pos tersebut,
 *   • menambah modal disetor & komitmen penanggung,
 *   • porsi kepemilikan seluruh investor dihitung ulang.
 *
 * Besaran talangan dihitung SERVER dari keadaan dana terkini — client tidak
 * bisa menentukan nominalnya.
 */

function toDecimal(value: unknown) {
  if (value instanceof Prisma.Decimal) return value;
  if (typeof value === "number" || typeof value === "string") {
    return new Prisma.Decimal(value);
  }
  return new Prisma.Decimal(0);
}

function parseBigInt(value: unknown): bigint | null {
  const normalized = String(value ?? "").trim();
  if (!/^\d+$/.test(normalized)) return null;

  try {
    return BigInt(normalized);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const currentAgentId =
      typeof (session?.user as { agentId?: unknown } | undefined)?.agentId ===
      "string"
        ? (session!.user as { agentId: string }).agentId
        : null;

    if (!currentAgentId) {
      return NextResponse.json(
        { message: "Unauthorized. Silakan masuk kembali." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);

    const idProject =
      typeof body?.id_project === "string" ? body.id_project.trim() : "";
    const walletKey = body?.wallet_key;

    if (!idProject) {
      return NextResponse.json(
        { message: "id_project wajib diisi." },
        { status: 400 }
      );
    }

    if (!isWalletKey(walletKey)) {
      return NextResponse.json(
        { message: "wallet_key tidak valid." },
        { status: 400 }
      );
    }

    const investorIdInput = parseBigInt(body?.id_project_investor);

    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: { id_project: idProject },
        select: { dibuat_oleh: true, target_pendanaan: true },
      });

      if (!project) {
        return { error: { message: "Project tidak ditemukan.", status: 404 } };
      }

      if (project.dibuat_oleh !== currentAgentId) {
        return {
          error: {
            message:
              "Hanya penyelenggara project yang boleh menutup kekurangan dana.",
            status: 403,
          },
        };
      }

      const fundState = await loadFundState(tx, idProject);

      if (!fundState) {
        return { error: { message: "Project tidak ditemukan.", status: 404 } };
      }

      const pos = fundState.pos.find((item) => item.walletKey === walletKey);

      // Dua jenis kekurangan, dicatat terpisah supaya anggaran tidak melar:
      //   • kekurangan anggaran pos → talangan (anggaran pos & kas naik)
      //   • sisa kekurangan kas     → setoran modal (hanya kas yang naik)
      const tambahanAnggaran = pos?.kekurangan ?? 0;
      const tambahanKas = Math.max(
        0,
        -(fundState.sisaKas + tambahanAnggaran)
      );
      const nominal = tambahanAnggaran + tambahanKas;

      if (nominal <= 0) {
        return {
          error: {
            message: `Pos ${WALLET_LABELS[walletKey]} tidak sedang kekurangan dana.`,
            status: 400,
          },
        };
      }

      // Investor penanggung: dipilih user, atau otomatis bila hanya ada satu.
      let investorId = investorIdInput;

      if (!investorId) {
        const kandidat = await tx.projectInvestor.findMany({
          where: { id_project: idProject },
          select: { id_project_investor: true },
          take: 2,
        });

        if (kandidat.length === 1) {
          investorId = kandidat[0].id_project_investor;
        } else if (kandidat.length === 0) {
          return {
            error: {
              message:
                "Project ini belum punya investor, jadi kekurangan dana belum bisa ditalangi.",
              status: 400,
            },
          };
        } else {
          return {
            error: {
              message: "Pilih investor yang menanggung kekurangan ini.",
              status: 400,
            },
          };
        }
      }

      const investor = await tx.projectInvestor.findFirst({
        where: { id_project_investor: investorId, id_project: idProject },
        select: {
          id_project_investor: true,
          id_agent: true,
          nominal_komitmen: true,
          nominal_terbayar: true,
          status: true,
          agent: { select: { pengguna: { select: { nama_lengkap: true } } } },
        },
      });

      if (!investor) {
        return {
          error: {
            message: "Investor penanggung tidak ditemukan di project ini.",
            status: 404,
          },
        };
      }

      const nama =
        investor.agent?.pengguna?.nama_lengkap?.trim() || investor.id_agent;
      const talangan = new Prisma.Decimal(nominal.toFixed(2));

      const now = new Date();
      const tanggal = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      );

      const dibuat: bigint[] = [];

      if (tambahanAnggaran > 0) {
        const row = await tx.projectArusKas.create({
          data: {
            id_project: idProject,
            wallet_key: walletKey,
            tanggal_transaksi: tanggal,
            jenis_transaksi: "pemasukan",
            kategori_transaksi: "talangan_investor",
            judul_transaksi: `Talangan ${nama} — kekurangan ${WALLET_LABELS[walletKey]}`,
            nominal: new Prisma.Decimal(tambahanAnggaran.toFixed(2)),
            status_transaksi: "tercatat",
            catatan: `Menambah anggaran pos ${WALLET_LABELS[walletKey]} yang terlanjur terlampaui.`,
            id_project_investor: investor.id_project_investor,
          },
          select: { id_project_arus_kas: true },
        });
        dibuat.push(row.id_project_arus_kas);
      }

      if (tambahanKas > 0) {
        const row = await tx.projectArusKas.create({
          data: {
            id_project: idProject,
            wallet_key: walletKey,
            tanggal_transaksi: tanggal,
            jenis_transaksi: "pemasukan",
            kategori_transaksi: "setoran_modal",
            judul_transaksi: `Setoran modal ${nama} — menutup kas proyek`,
            nominal: new Prisma.Decimal(tambahanKas.toFixed(2)),
            status_transaksi: "tercatat",
            catatan: "Menutup kas proyek yang terlanjur minus.",
            id_project_investor: investor.id_project_investor,
          },
          select: { id_project_arus_kas: true },
        });
        dibuat.push(row.id_project_arus_kas);
      }

      const terbayarSebelum = toDecimal(investor.nominal_terbayar);
      const terbayarSesudah = terbayarSebelum.plus(talangan);

      await tx.projectInvestor.update({
        where: { id_project_investor: investor.id_project_investor },
        data: {
          nominal_terbayar: terbayarSesudah,
          nominal_komitmen: toDecimal(investor.nominal_komitmen).plus(talangan),
          // Uangnya benar-benar masuk → statusnya tidak boleh tertinggal
          // "menunggu pembayaran".
          status: "lunas",
        },
      });

      const targetPendanaan = toDecimal(project.target_pendanaan);
      await refreshOwnershipCache(tx, idProject, targetPendanaan);

      const komitmenAgg = await tx.projectInvestor.aggregate({
        where: { id_project: idProject },
        _sum: { nominal_komitmen: true },
      });

      await tx.project.update({
        where: { id_project: idProject },
        data: {
          total_pendanaan: toDecimal(komitmenAgg._sum.nominal_komitmen ?? 0),
        },
      });

      return {
        data: {
          id_arus_kas: dibuat.map((id) => id.toString()),
          wallet_key: walletKey,
          nominal: Number(talangan.toString()),
          tambahan_anggaran_pos: tambahanAnggaran,
          tambahan_kas: tambahanKas,
          investor: {
            id_project_investor: investor.id_project_investor.toString(),
            id_agent: investor.id_agent,
            nama,
            terbayar_sebelum: Number(terbayarSebelum.toString()),
            terbayar_sesudah: Number(terbayarSesudah.toString()),
          },
        },
      };
    });

    if ("error" in result && result.error) {
      return NextResponse.json(
        { message: result.error.message },
        { status: result.error.status }
      );
    }

    return NextResponse.json(
      {
        message: "Kekurangan dana berhasil ditutup investor.",
        data: (result as { data: unknown }).data,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[TUTUP_KEKURANGAN_POST_ERROR]", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan saat menutup kekurangan dana." },
      { status: 500 }
    );
  }
}

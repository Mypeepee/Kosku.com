import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeRealizedExpense } from "../../catat_arus_kas/_lib/cash";
import {
  buildDistribution,
  computeUnitCost,
  getSaleContext,
  round2,
  round6,
  toNum,
} from "../_lib/sale-units";

/**
 * Simpan realisasi penjualan.
 * - Project DENGAN unit: wajib kirim id_project_unit; satu unit satu penjualan.
 *   Biaya akuisisi unit dihitung server (bobot% × totalBiaya, unit terakhir =
 *   sisa). Saat unit terakhir laku, status project otomatis 'terjual'.
 * - Project TANPA unit: penjualan utuh (perilaku lama, bisa dikoreksi ulang).
 * Semua angka uang (biaya, fee, profit, ROI, distribusi) dihitung ULANG di
 * server — payload client hanya dipercaya untuk harga jual, tanggal, dan
 * persentase fee.
 */

type SimpanPayload = {
  id_project?: string;
  id_project_unit?: string | number | null;
  tanggal_terjual: string | null;
  harga_jual: number;
  total_biaya_akuisisi?: number;
  pph_percent: number;
  ajb_percent: number;
  agent_fee_percent: number;
  // Nominal fee eksplisit (opsional) — dipakai bila nilai akta ≠ harga riil
  // (mis. PPh/AJB dihitung dari nilai akta 700jt padahal laku 950jt).
  pph_nominal?: number;
  ajb_nominal?: number;
  agent_fee_nominal?: number;
};

function isValidDateOnly(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function diffDaysDateOnly(start: Date | string | null, endYmd: string): number {
  if (!start) return 0;
  const startYmd =
    start instanceof Date
      ? start.toISOString().slice(0, 10)
      : String(start).slice(0, 10);
  const startMs = Date.parse(`${startYmd}T00:00:00Z`);
  const endMs = Date.parse(`${endYmd}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  return Math.max(0, Math.floor((endMs - startMs) / 86_400_000));
}

function normalizeFeePercent(raw: unknown): number {
  const num = toNum(raw);
  if (!Number.isFinite(num) || num < 0) return 0;
  if (num > 100) return 100;
  return round6(num);
}

/**
 * Nominal fee = SUMBER KEBENARAN. Jika client mengirim nominal eksplisit
 * (nilai akta bisa ≠ harga riil), pakai itu; percent disimpan sebagai
 * referensi turunan (nominal/harga, clamp ke kapasitas kolom 999.99).
 * Tanpa nominal → hitung dari percent (perilaku lama).
 */
function resolveFee(
  nominalRaw: unknown,
  percentRaw: unknown,
  hargaJual: number
): { nominal: number; percent: number } {
  const nominalNum = toNum(nominalRaw);
  const hasNominal =
    nominalRaw !== undefined &&
    nominalRaw !== null &&
    Number.isFinite(nominalNum) &&
    nominalNum >= 0;

  if (hasNominal) {
    const nominal = round2(nominalNum);
    const percent =
      hargaJual > 0
        ? Math.min(999.99, round6((nominal / hargaJual) * 100))
        : 0;
    return { nominal, percent };
  }

  const percent = normalizeFeePercent(percentRaw);
  return { nominal: round2((percent / 100) * hargaJual), percent };
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id_project: string }> }
) {
  try {
    const { id_project: idProjectParam } = await context.params;
    const body = (await req.json().catch(() => null)) as SimpanPayload | null;

    const id_project = String(body?.id_project || idProjectParam || "").trim();
    const tanggal_terjual = body?.tanggal_terjual;

    if (!id_project) {
      return NextResponse.json(
        { success: false, message: "id_project wajib ada." },
        { status: 400 }
      );
    }

    if (!isValidDateOnly(tanggal_terjual)) {
      return NextResponse.json(
        { success: false, message: "tanggal_terjual wajib format YYYY-MM-DD." },
        { status: 400 }
      );
    }

    const harga_jual = round2(toNum(body?.harga_jual));
    if (harga_jual <= 0) {
      return NextResponse.json(
        { success: false, message: "Harga jual harus lebih dari 0." },
        { status: 400 }
      );
    }

    const pphFee = resolveFee(body?.pph_nominal, body?.pph_percent, harga_jual);
    const ajbFee = resolveFee(body?.ajb_nominal, body?.ajb_percent, harga_jual);
    const agentFee = resolveFee(
      body?.agent_fee_nominal,
      body?.agent_fee_percent,
      harga_jual
    );

    const unitIdRaw = body?.id_project_unit;
    const unitId =
      unitIdRaw !== null && unitIdRaw !== undefined && String(unitIdRaw).trim()
        ? BigInt(String(unitIdRaw).trim())
        : null;

    const result = await prisma.$transaction(async (tx) => {
      // Serialisasi seluruh operasi penjualan per project (anti-race).
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`sale:${id_project}`}))`
      );

      const ctx = await getSaleContext(tx, id_project);
      if (!ctx) {
        return { status: 404 as const, message: "Project tidak ditemukan." };
      }

      const investorRows = await tx.projectInvestor.findMany({
        where: { id_project },
        orderBy: { id_project_investor: "asc" },
        select: {
          id_agent: true,
          nominal_komitmen: true,
          nominal_terbayar: true,
        },
      });

      if (!investorRows.length) {
        return {
          status: 400 as const,
          message: "Data investor project tidak ditemukan.",
        };
      }

      const investors = investorRows.map((row) => ({
        id_agent: row.id_agent,
        nominal_komitmen: toNum(row.nominal_komitmen),
        nominal_terbayar: toNum(row.nominal_terbayar),
      }));

      const hasUnits = ctx.units.length > 0;

      // ── Tentukan mode + basis biaya (server-authoritative) ──
      let biayaAkuisisi: number;
      let bobotPersen: number;
      let isFinalSale: boolean;
      let replaceSaleId: bigint | null = null;
      let unitLabel: string | null = null;

      if (hasUnits) {
        if (unitId === null) {
          return {
            status: 400 as const,
            message:
              "Project ini dijual per unit — pilih unit yang terjual terlebih dahulu.",
          };
        }
        if (ctx.legacySale) {
          return {
            status: 409 as const,
            message:
              "Project ini sudah punya penjualan utuh — pembagian unit tidak berlaku.",
          };
        }

        const unit = ctx.units.find((u) => u.id_project_unit === unitId);
        if (!unit) {
          return {
            status: 404 as const,
            message: "Unit tidak ditemukan pada project ini.",
          };
        }

        // Unit sudah terjual → mode KOREKSI: baris lama di-update, distribusi
        // ditulis ulang. Biaya dihitung seolah unit ini belum terjual (baris
        // lamanya dikeluarkan dari himpunan "terjual").
        if (unit.sale) {
          replaceSaleId = unit.sale.id_project_selesai;
        }
        const ctxForCost = unit.sale
          ? {
              ...ctx,
              units: ctx.units.map((u) =>
                u.id_project_unit === unitId ? { ...u, sale: null } : u
              ),
            }
          : ctx;

        biayaAkuisisi = computeUnitCost(ctxForCost, unitId);
        bobotPersen = unit.bobot_persen;
        isFinalSale =
          ctxForCost.units.filter((u) => !u.sale).length === 1;
        unitLabel = unit.nama_unit;
      } else {
        if (unitId !== null) {
          return {
            status: 400 as const,
            message: "Project ini belum punya pembagian unit.",
          };
        }

        // Legacy/1 unit: rencana boleh dari client (field form), realisasi
        // tetap lantai minimal — over-budget tak bisa disembunyikan.
        const rencanaClient = round2(
          Math.max(0, toNum(body?.total_biaya_akuisisi))
        );
        const realisasi = round2(
          toNum(await computeRealizedExpense(tx, id_project))
        );
        biayaAkuisisi = Math.max(rencanaClient, realisasi);
        bobotPersen = 100;
        isFinalSale = true;
        replaceSaleId = ctx.legacySale?.id_project_selesai ?? null;
      }

      // ── Hitung ulang finansial (nominal fee = sumber kebenaran) ──
      const total_biaya_transaksi = round2(
        pphFee.nominal + ajbFee.nominal + agentFee.nominal
      );
      const profit_kotor = round2(harga_jual - biayaAkuisisi);
      const profit_bersih = round2(profit_kotor - total_biaya_transaksi);
      const roi_bersih =
        biayaAkuisisi > 0
          ? round6((profit_bersih / biayaAkuisisi) * 100)
          : 0;
      const durasi_hari = diffDaysDateOnly(
        ctx.project.mulai_tanggal,
        tanggal_terjual
      );

      // Modal yang sudah dikembalikan pada penjualan SEBELUMNYA (kecuali baris
      // yang sedang dikoreksi ulang pada mode legacy).
      const priorRows = await tx.projectSelesaiInvestor.findMany({
        where: {
          id_project,
          ...(replaceSaleId !== null
            ? { id_project_selesai: { not: replaceSaleId } }
            : {}),
        },
        select: { id_agent: true, modal: true },
      });
      const priorReturnedByAgent = new Map<string, number>();
      for (const row of priorRows) {
        priorReturnedByAgent.set(
          row.id_agent,
          round2((priorReturnedByAgent.get(row.id_agent) ?? 0) + toNum(row.modal))
        );
      }

      const distribusi = buildDistribution({
        investors,
        profitBersih: profit_bersih,
        bobotPersen,
        isFinal: isFinalSale,
        priorReturnedByAgent,
      });

      if (!distribusi.length) {
        return {
          status: 400 as const,
          message: "Distribusi investor tidak bisa dihitung (modal disetor 0).",
        };
      }

      const saleData = {
        id_project,
        id_project_unit: unitId,
        id_listing: ctx.project.id_listing,
        tanggal_pembelian: ctx.project.mulai_tanggal,
        tanggal_terjual: new Date(`${tanggal_terjual}T00:00:00Z`),
        durasi_hari,
        harga_jual: new Prisma.Decimal(harga_jual),
        total_biaya_akuisisi: new Prisma.Decimal(biayaAkuisisi),
        profit_kotor: new Prisma.Decimal(profit_kotor),
        pph_percent: new Prisma.Decimal(pphFee.percent),
        ajb_percent: new Prisma.Decimal(ajbFee.percent),
        agent_fee_percent: new Prisma.Decimal(agentFee.percent),
        pph_nominal: new Prisma.Decimal(pphFee.nominal),
        ajb_nominal: new Prisma.Decimal(ajbFee.nominal),
        agent_fee_nominal: new Prisma.Decimal(agentFee.nominal),
        total_biaya_transaksi: new Prisma.Decimal(total_biaya_transaksi),
        profit_bersih: new Prisma.Decimal(profit_bersih),
        roi_bersih: new Prisma.Decimal(roi_bersih),
      };

      let saleId: bigint;
      if (replaceSaleId !== null) {
        const updated = await tx.projectSelesai.update({
          where: { id_project_selesai: replaceSaleId },
          data: saleData,
          select: { id_project_selesai: true },
        });
        saleId = updated.id_project_selesai;
        await tx.projectSelesaiInvestor.deleteMany({
          where: { id_project_selesai: saleId },
        });
      } else {
        const created = await tx.projectSelesai.create({
          data: saleData,
          select: { id_project_selesai: true },
        });
        saleId = created.id_project_selesai;
      }

      await tx.projectSelesaiInvestor.createMany({
        data: distribusi.map((item) => ({
          id_project_selesai: saleId,
          id_project,
          id_agent: item.id_agent,
          modal: new Prisma.Decimal(item.modal),
          porsi_percent: new Prisma.Decimal(item.porsi_percent),
          profit: new Prisma.Decimal(item.profit),
          total_diterima: new Prisma.Decimal(item.total_diterima),
        })),
      });

      // Semua unit laku (atau penjualan utuh) → status project 'terjual'.
      const allSold = isFinalSale;
      if (allSold && ctx.project.status !== "terjual") {
        await tx.project.update({
          where: { id_project },
          data: { status: "terjual", diupdate_tanggal: new Date() },
        });
      }

      return {
        status: 200 as const,
        data: {
          id_project_selesai: String(saleId),
          unit: unitLabel,
          diperbarui: replaceSaleId !== null,
          semua_terjual: allSold,
          biaya_akuisisi: biayaAkuisisi,
          profit_kotor,
          profit_bersih,
          roi_bersih,
          distribusi,
        },
      };
    });

    if (result.status !== 200) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.data.unit
        ? `Penjualan unit "${result.data.unit}" ${
            result.data.diperbarui ? "diperbarui" : "tersimpan"
          }.`
        : "Data project selesai dan distribusi investor berhasil disimpan.",
      data: result.data,
    });
  } catch (error) {
    // Unique constraint id_project_unit → unit keburu terjual di request lain.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { success: false, message: "Unit ini sudah tercatat terjual." },
        { status: 409 }
      );
    }

    console.error("POST /api/project/[id_project]/simpan error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Gagal menyimpan data project selesai.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

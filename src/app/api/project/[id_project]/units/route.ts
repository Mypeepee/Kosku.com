import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  computeUnitCost,
  getSaleContext,
  round2,
  round6,
  toNum,
} from "../_lib/sale-units";

/**
 * GET  → daftar unit jual + status terjual + preview biaya per unit + agregat.
 * POST → setup/ganti pembagian unit. Terkunci begitu ada penjualan tercatat.
 */

const MAX_UNITS = 12;

function serializeSale(sale: {
  id_project_selesai: bigint;
  id_project_unit: bigint | null;
  tanggal_pembelian: Date | null;
  tanggal_terjual: Date;
  durasi_hari: number;
  harga_jual: number;
  total_biaya_akuisisi: number;
  profit_kotor: number;
  pph_percent: number;
  ajb_percent: number;
  agent_fee_percent: number;
  total_biaya_transaksi: number;
  profit_bersih: number;
  roi_bersih: number;
}) {
  return {
    id_project_selesai: String(sale.id_project_selesai),
    tanggal_pembelian: sale.tanggal_pembelian
      ? sale.tanggal_pembelian.toISOString().slice(0, 10)
      : null,
    tanggal_terjual: sale.tanggal_terjual.toISOString().slice(0, 10),
    durasi_hari: sale.durasi_hari,
    harga_jual: sale.harga_jual,
    total_biaya_akuisisi: sale.total_biaya_akuisisi,
    profit_kotor: sale.profit_kotor,
    pph_percent: sale.pph_percent,
    ajb_percent: sale.ajb_percent,
    agent_fee_percent: sale.agent_fee_percent,
    total_biaya_transaksi: sale.total_biaya_transaksi,
    profit_bersih: sale.profit_bersih,
    roi_bersih: sale.roi_bersih,
  };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id_project: string }> }
) {
  try {
    const { id_project } = await context.params;

    const ctx = await getSaleContext(prisma, id_project);
    if (!ctx) {
      return NextResponse.json(
        { success: false, message: "Project tidak ditemukan." },
        { status: 404 }
      );
    }

    // Distribusi tersimpan per penjualan (untuk tampilan riwayat/read-only).
    const saleIds = [
      ...ctx.units.filter((u) => u.sale).map((u) => u.sale!.id_project_selesai),
      ...(ctx.legacySale ? [ctx.legacySale.id_project_selesai] : []),
    ];

    const distribusiRows = saleIds.length
      ? await prisma.projectSelesaiInvestor.findMany({
          where: { id_project_selesai: { in: saleIds } },
          select: {
            id_project_selesai: true,
            id_agent: true,
            modal: true,
            porsi_percent: true,
            profit: true,
            total_diterima: true,
          },
        })
      : [];

    const distribusiBySale = new Map<string, Array<Record<string, unknown>>>();
    for (const row of distribusiRows) {
      const key = String(row.id_project_selesai);
      const list = distribusiBySale.get(key) ?? [];
      list.push({
        id_agent: row.id_agent,
        modal: toNum(row.modal),
        porsi_percent: toNum(row.porsi_percent),
        profit: toNum(row.profit),
        total_diterima: toNum(row.total_diterima),
      });
      distribusiBySale.set(key, list);
    }

    const estimasiJual = ctx.project.estimasi_harga_jual;

    const units = ctx.units.map((unit) => {
      const sale = unit.sale ? serializeSale(unit.sale) : null;
      return {
        id_project_unit: String(unit.id_project_unit),
        nama_unit: unit.nama_unit,
        bobot_persen: unit.bobot_persen,
        urutan: unit.urutan,
        terjual: Boolean(unit.sale),
        // Basis biaya jika unit ini dijual SEKARANG (server-authoritative).
        biaya_unit: computeUnitCost(ctx, unit.id_project_unit),
        estimasi_harga_unit: round2((unit.bobot_persen / 100) * estimasiJual),
        sale,
        distribusi: sale
          ? distribusiBySale.get(sale.id_project_selesai) ?? []
          : [],
      };
    });

    const soldSales = ctx.units
      .filter((u) => u.sale)
      .map((u) => u.sale!)
      .concat(ctx.legacySale ? [ctx.legacySale] : []);

    const aggregate = soldSales.length
      ? {
          jumlah_penjualan: soldSales.length,
          harga_jual: round2(soldSales.reduce((s, x) => s + x.harga_jual, 0)),
          total_biaya_akuisisi: round2(
            soldSales.reduce((s, x) => s + x.total_biaya_akuisisi, 0)
          ),
          total_biaya_transaksi: round2(
            soldSales.reduce((s, x) => s + x.total_biaya_transaksi, 0)
          ),
          profit_kotor: round2(soldSales.reduce((s, x) => s + x.profit_kotor, 0)),
          profit_bersih: round2(
            soldSales.reduce((s, x) => s + x.profit_bersih, 0)
          ),
          tanggal_terjual_terakhir: soldSales
            .map((x) => x.tanggal_terjual.toISOString().slice(0, 10))
            .sort()
            .at(-1),
        }
      : null;

    return NextResponse.json({
      success: true,
      data: {
        id_project: ctx.project.id_project,
        status: ctx.project.status,
        mulai_tanggal: ctx.project.mulai_tanggal
          ? ctx.project.mulai_tanggal.toISOString().slice(0, 10)
          : null,
        has_units: units.length > 0,
        unit_count: units.length,
        sold_count: ctx.soldCount,
        semua_terjual:
          units.length > 0
            ? ctx.soldCount === units.length
            : Boolean(ctx.legacySale),
        // Setup unit terkunci begitu ADA penjualan apa pun (per unit / utuh).
        locked: ctx.soldCount > 0 || Boolean(ctx.legacySale),
        total_biaya_project: ctx.totalBiaya,
        estimasi_harga_jual: estimasiJual,
        units,
        legacy_sale: ctx.legacySale
          ? {
              ...serializeSale(ctx.legacySale),
              distribusi:
                distribusiBySale.get(
                  String(ctx.legacySale.id_project_selesai)
                ) ?? [],
            }
          : null,
        aggregate,
      },
    });
  } catch (error) {
    console.error("GET /api/project/[id_project]/units error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal memuat data unit." },
      { status: 500 }
    );
  }
}

type SetupUnitsPayload = {
  units?: Array<{ nama_unit?: string; bobot_persen?: number | string }>;
};

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id_project: string }> }
) {
  try {
    const { id_project } = await context.params;
    const body = (await req.json().catch(() => null)) as SetupUnitsPayload | null;

    const rawUnits = Array.isArray(body?.units) ? body!.units! : [];

    if (rawUnits.length < 2 || rawUnits.length > MAX_UNITS) {
      return NextResponse.json(
        {
          success: false,
          message: `Jumlah unit harus 2 sampai ${MAX_UNITS}. Project 1 unit tidak perlu setup — langsung input penjualan.`,
        },
        { status: 400 }
      );
    }

    const cleaned = rawUnits.map((item, index) => ({
      nama_unit: String(item?.nama_unit ?? "").trim(),
      bobot_persen: round6(toNum(item?.bobot_persen)),
      urutan: index,
    }));

    for (const unit of cleaned) {
      if (!unit.nama_unit || unit.nama_unit.length > 120) {
        return NextResponse.json(
          { success: false, message: "Nama unit wajib diisi (maks 120 karakter)." },
          { status: 400 }
        );
      }
      if (!(unit.bobot_persen > 0) || unit.bobot_persen >= 100) {
        return NextResponse.json(
          {
            success: false,
            message: `Bobot unit "${unit.nama_unit}" harus di antara 0 dan 100 persen.`,
          },
          { status: 400 }
        );
      }
    }

    const lowerNames = cleaned.map((u) => u.nama_unit.toLowerCase());
    if (new Set(lowerNames).size !== lowerNames.length) {
      return NextResponse.json(
        { success: false, message: "Nama unit tidak boleh kembar." },
        { status: 400 }
      );
    }

    const totalBobot = cleaned.reduce((sum, u) => sum + u.bobot_persen, 0);
    if (Math.abs(totalBobot - 100) > 0.05) {
      return NextResponse.json(
        {
          success: false,
          message: `Total bobot harus 100% (sekarang ${round2(totalBobot)}%).`,
        },
        { status: 400 }
      );
    }

    // Normalisasi eksak: unit terakhir = 100 − Σ lainnya (hilangkan sisa 0.01).
    const others = cleaned
      .slice(0, -1)
      .reduce((sum, u) => sum + u.bobot_persen, 0);
    cleaned[cleaned.length - 1].bobot_persen = round6(100 - others);

    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: { id_project },
        select: { id_project: true },
      });
      if (!project) {
        return { status: 404 as const, message: "Project tidak ditemukan." };
      }

      const saleCount = await tx.projectSelesai.count({
        where: { id_project },
      });
      if (saleCount > 0) {
        return {
          status: 409 as const,
          message:
            "Pembagian unit terkunci karena sudah ada penjualan tercatat.",
        };
      }

      await tx.projectUnit.deleteMany({ where: { id_project } });
      await tx.projectUnit.createMany({
        data: cleaned.map((unit) => ({
          id_project,
          nama_unit: unit.nama_unit,
          bobot_persen: unit.bobot_persen,
          urutan: unit.urutan,
        })),
      });

      return { status: 200 as const };
    });

    if (result.status !== 200) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Pembagian unit tersimpan.",
      data: { unit_count: cleaned.length },
    });
  } catch (error) {
    console.error("POST /api/project/[id_project]/units error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal menyimpan pembagian unit." },
      { status: 500 }
    );
  }
}

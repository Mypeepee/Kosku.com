import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  cashEffect,
  computeSisaKas,
  refreshOwnershipCache,
} from "../_lib/cash";

function formatIDR(value: Prisma.Decimal) {
  return `Rp ${Math.round(Number(value.toString())).toLocaleString("id-ID")}`;
}

function toDecimal(value: unknown) {
  if (value instanceof Prisma.Decimal) return value;
  if (typeof value === "number" || typeof value === "string") {
    return new Prisma.Decimal(value);
  }
  return new Prisma.Decimal(0);
}

/** Adakah baris talangan yang dibuat untuk menutup pengeluaran ini? */
async function hasLinkedTalangan(expenseId: bigint) {
  const count = await prisma.projectArusKas.count({
    where: {
      id_arus_kas_terkait: expenseId,
      kategori_transaksi: "talangan_investor",
      status_transaksi: { not: "dibatalkan" },
    },
  });
  return count > 0;
}

const WALLET_KEYS = [
  "utama",
  "dokumen",
  "eksekusi",
  "renovasi",
  "cadangan",
] as const;

const JENIS_ARUS_KAS = ["pemasukan", "pengeluaran"] as const;

const KATEGORI_ARUS_KAS = [
  "setoran_modal",
  "hasil_penjualan",
  "refund",
  "pemasukan_lain",
  "pembelian_aset",
  "biaya_spare_bidding",
  "biaya_dokumen_balik_nama",
  "biaya_eksekusi_pengosongan",
  "biaya_renovasi",
  "penggunaan_dana_cadangan",
  "pengeluaran_lain",
] as const;

const STATUS_ARUS_KAS = ["tercatat", "dibatalkan"] as const;

type WalletKey = (typeof WALLET_KEYS)[number];
type JenisArusKas = (typeof JENIS_ARUS_KAS)[number];
type KategoriArusKas = (typeof KATEGORI_ARUS_KAS)[number];
type StatusArusKas = (typeof STATUS_ARUS_KAS)[number];

class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function isWalletKey(value: unknown): value is WalletKey {
  return typeof value === "string" && WALLET_KEYS.includes(value as WalletKey);
}

function isJenisArusKas(value: unknown): value is JenisArusKas {
  return (
    typeof value === "string" && JENIS_ARUS_KAS.includes(value as JenisArusKas)
  );
}

function isKategoriArusKas(value: unknown): value is KategoriArusKas {
  return (
    typeof value === "string" &&
    KATEGORI_ARUS_KAS.includes(value as KategoriArusKas)
  );
}

function isStatusArusKas(value: unknown): value is StatusArusKas {
  return (
    typeof value === "string" &&
    STATUS_ARUS_KAS.includes(value as StatusArusKas)
  );
}

function normalizeJenis(value: unknown): JenisArusKas {
  if (value === "masuk") return "pemasukan";
  if (value === "keluar") return "pengeluaran";
  if (isJenisArusKas(value)) return value;
  return "pengeluaran";
}

function normalizeStatusArusKas(value: unknown): StatusArusKas {
  if (isStatusArusKas(value)) return value;
  return "tercatat";
}

function inferKategori(
  walletKey: WalletKey,
  jenisTransaksi: JenisArusKas,
  requested?: unknown
): KategoriArusKas {
  if (isKategoriArusKas(requested)) {
    return requested;
  }

  if (jenisTransaksi === "pemasukan") {
    return "pemasukan_lain";
  }

  switch (walletKey) {
    case "dokumen":
      return "biaya_dokumen_balik_nama";
    case "eksekusi":
      return "biaya_eksekusi_pengosongan";
    case "renovasi":
      return "biaya_renovasi";
    case "cadangan":
      return "penggunaan_dana_cadangan";
    case "utama":
    default:
      return "pengeluaran_lain";
  }
}

function normalizeTanggal(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const raw = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-").map(Number);
    // Simpan sebagai UTC midnight supaya kolom @db.Date menyimpan tanggal
    // kalender yang sama persis dengan input user, apa pun timezone server.
    const date = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseNominal(value: unknown): Prisma.Decimal | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    return new Prisma.Decimal(value);
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]/g, "");
    if (!cleaned) return null;

    try {
      const decimal = new Prisma.Decimal(cleaned);
      if (decimal.lte(0)) return null;
      return decimal;
    } catch {
      return null;
    }
  }

  return null;
}

function parseRouteId(rawId: string): bigint {
  const normalized = String(rawId ?? "").trim();

  if (!/^\d+$/.test(normalized)) {
    throw new HttpError("ID transaksi tidak valid.", 400);
  }

  try {
    return BigInt(normalized);
  } catch {
    throw new HttpError("ID transaksi tidak valid.", 400);
  }
}

function serializeArusKasRecord(
  record: Record<string, unknown> | null | undefined
) {
  if (!record) return null;

  return {
    ...record,
    id_project_arus_kas:
      typeof record.id_project_arus_kas === "bigint"
        ? record.id_project_arus_kas.toString()
        : record.id_project_arus_kas,
    nominal:
      record.nominal instanceof Prisma.Decimal
        ? Number(record.nominal.toString())
        : record.nominal,
    tanggal_transaksi:
      record.tanggal_transaksi instanceof Date
        ? record.tanggal_transaksi.toISOString()
        : record.tanggal_transaksi,
    dibuat_tanggal:
      record.dibuat_tanggal instanceof Date
        ? record.dibuat_tanggal.toISOString()
        : record.dibuat_tanggal,
    diupdate_tanggal:
      record.diupdate_tanggal instanceof Date
        ? record.diupdate_tanggal.toISOString()
        : record.diupdate_tanggal,
  };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const transactionId = parseRouteId(id);
    const body = await request.json();

    if (body.auto_cover_deficit === true) {
      return NextResponse.json(
        {
          message:
            "Edit transaksi yang memakai auto cover investor belum didukung. Hapus transaksi lama lalu buat ulang transaksi baru.",
        },
        { status: 400 }
      );
    }

    const existing = await prisma.projectArusKas.findUnique({
      where: {
        id_project_arus_kas: transactionId,
      },
      select: {
        id_project_arus_kas: true,
        id_project: true,
        wallet_key: true,
        tanggal_transaksi: true,
        jenis_transaksi: true,
        kategori_transaksi: true,
        judul_transaksi: true,
        nominal: true,
        status_transaksi: true,
        catatan: true,
        dibuat_tanggal: true,
        diupdate_tanggal: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Transaksi tidak ditemukan." },
        { status: 404 }
      );
    }

    const walletKey =
      body.wallet_key !== undefined ? body.wallet_key : existing.wallet_key;

    if (!isWalletKey(walletKey)) {
      return NextResponse.json(
        { message: "wallet_key tidak valid." },
        { status: 400 }
      );
    }

    const judulTransaksi =
      body.judul_transaksi !== undefined
        ? typeof body.judul_transaksi === "string"
          ? body.judul_transaksi.trim()
          : ""
        : existing.judul_transaksi ?? "";

    if (!judulTransaksi) {
      return NextResponse.json(
        { message: "judul_transaksi wajib diisi." },
        { status: 400 }
      );
    }

    const tanggalTransaksi =
      body.tanggal_transaksi !== undefined
        ? normalizeTanggal(body.tanggal_transaksi)
        : existing.tanggal_transaksi;

    if (!tanggalTransaksi) {
      return NextResponse.json(
        { message: "tanggal_transaksi tidak valid." },
        { status: 400 }
      );
    }

    const nominal =
      body.nominal !== undefined
        ? parseNominal(body.nominal)
        : existing.nominal instanceof Prisma.Decimal
          ? existing.nominal
          : new Prisma.Decimal(existing.nominal as any);

    if (!nominal) {
      return NextResponse.json(
        { message: "nominal harus lebih besar dari 0." },
        { status: 400 }
      );
    }

    const jenisTransaksi =
      body.jenis_transaksi !== undefined
        ? normalizeJenis(body.jenis_transaksi)
        : normalizeJenis(existing.jenis_transaksi);

    const statusTransaksi =
      body.status_transaksi !== undefined
        ? normalizeStatusArusKas(body.status_transaksi)
        : normalizeStatusArusKas(existing.status_transaksi);

    const kategoriTransaksi = inferKategori(
      walletKey,
      jenisTransaksi,
      body.kategori_transaksi ?? existing.kategori_transaksi
    );

    const catatan =
      body.catatan !== undefined
        ? typeof body.catatan === "string" && body.catatan.trim()
          ? body.catatan.trim()
          : null
        : existing.catatan ?? null;

    // Baris talangan dibuat otomatis oleh sistem (mengubah modal & kepemilikan).
    // Tidak boleh diedit manual agar invarian kas & porsi tetap konsisten.
    if (existing.kategori_transaksi === "talangan_investor") {
      return NextResponse.json(
        {
          message:
            "Baris talangan dibuat otomatis dan tidak bisa diedit. Sesuaikan atau hapus pengeluaran terkait.",
        },
        { status: 400 }
      );
    }

    // Pengeluaran yang DITALANGI investor: mengubah nominal/jenis-nya akan
    // membuat talangan tidak sinkron. Minta hapus lalu buat ulang agar
    // reversal talangan + kepemilikan terjaga.
    if (await hasLinkedTalangan(transactionId)) {
      return NextResponse.json(
        {
          message:
            "Pengeluaran ini ditalangi investor. Hapus transaksinya (talangan akan otomatis dibatalkan) lalu buat ulang.",
        },
        { status: 400 }
      );
    }

    // Guard anti-minus: kas proyek tidak boleh jadi negatif setelah edit.
    const sisaKas = await computeSisaKas(prisma, existing.id_project);
    const effectOld = cashEffect(existing);
    const effectNew = cashEffect({
      jenis_transaksi: jenisTransaksi,
      kategori_transaksi: kategoriTransaksi,
      status_transaksi: statusTransaksi,
      nominal,
    });
    const sisaKasAfter = sisaKas.minus(effectOld).plus(effectNew);

    if (sisaKasAfter.lt(0)) {
      return NextResponse.json(
        {
          message: `Perubahan ini membuat kas proyek minus ${formatIDR(
            sisaKasAfter.abs()
          )}. Kurangi nominal atau catat talangan investor lebih dulu.`,
        },
        { status: 400 }
      );
    }

    const updated = await prisma.projectArusKas.update({
      where: {
        id_project_arus_kas: transactionId,
      },
      data: {
        wallet_key: walletKey,
        tanggal_transaksi: tanggalTransaksi,
        jenis_transaksi: jenisTransaksi,
        kategori_transaksi: kategoriTransaksi,
        judul_transaksi: judulTransaksi,
        nominal,
        status_transaksi: statusTransaksi,
        catatan,
      },
      select: {
        id_project_arus_kas: true,
        id_project: true,
        wallet_key: true,
        tanggal_transaksi: true,
        jenis_transaksi: true,
        kategori_transaksi: true,
        judul_transaksi: true,
        nominal: true,
        status_transaksi: true,
        catatan: true,
        dibuat_tanggal: true,
        diupdate_tanggal: true,
      },
    });

    return NextResponse.json(
      {
        message: "Transaksi berhasil diperbarui.",
        data: serializeArusKasRecord(
          updated as unknown as Record<string, unknown>
        ),
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status }
      );
    }

    console.error("[CATAT_ARUS_KAS_PATCH_ERROR]", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan saat memperbarui arus kas." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const transactionId = parseRouteId(id);

    const existing = await prisma.projectArusKas.findUnique({
      where: {
        id_project_arus_kas: transactionId,
      },
      select: {
        id_project_arus_kas: true,
        id_project: true,
        judul_transaksi: true,
        jenis_transaksi: true,
        kategori_transaksi: true,
        status_transaksi: true,
        nominal: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Transaksi tidak ditemukan." },
        { status: 404 }
      );
    }

    // Baris talangan menaikkan modal disetor & kepemilikan penanggung; menghapus
    // barisnya saja akan membuat data tidak konsisten. Hapus lewat pengeluaran
    // terkait (yang otomatis membatalkan talangan-nya juga).
    if (existing.kategori_transaksi === "talangan_investor") {
      return NextResponse.json(
        {
          message:
            "Baris talangan tidak bisa dihapus manual karena sudah menambah kepemilikan investor. Hapus pengeluaran terkait untuk membatalkan talangan otomatis.",
        },
        { status: 400 }
      );
    }

    // Talangan yang dibuat untuk MENUTUP pengeluaran ini (kalau ada). Menghapus
    // pengeluaran harus MEMBATALKAN talangan-nya: turunkan modal disetor
    // penanggung & hitung ulang kepemilikan.
    const linkedTalangan = await prisma.projectArusKas.findMany({
      where: {
        id_arus_kas_terkait: transactionId,
        kategori_transaksi: "talangan_investor",
        status_transaksi: { not: "dibatalkan" },
      },
      select: {
        id_project_arus_kas: true,
        id_project_investor: true,
        nominal: true,
      },
    });

    if (linkedTalangan.length === 0) {
      // Tanpa talangan tertaut: cukup guard anti-minus biasa.
      const sisaKas = await computeSisaKas(prisma, existing.id_project);
      const sisaKasAfter = sisaKas.minus(cashEffect(existing));

      if (sisaKasAfter.lt(0)) {
        return NextResponse.json(
          {
            message: `Menghapus transaksi ini membuat kas proyek minus ${formatIDR(
              sisaKasAfter.abs()
            )}. Catat talangan investor lebih dulu atau hapus pengeluaran terkait.`,
          },
          { status: 400 }
        );
      }

      await prisma.projectArusKas.delete({
        where: { id_project_arus_kas: transactionId },
      });

      return NextResponse.json(
        {
          message: "Transaksi berhasil dihapus.",
          data: {
            id_project_arus_kas: existing.id_project_arus_kas.toString(),
            id_project: existing.id_project,
            judul_transaksi: existing.judul_transaksi,
          },
        },
        { status: 200 }
      );
    }

    // Ada talangan tertaut → batalkan bersama (atomik). Kas dijamin kembali ke
    // kondisi sebelum operasi talangan+pengeluaran, jadi tak mungkin minus.
    const projectRow = await prisma.project.findUnique({
      where: { id_project: existing.id_project },
      select: { target_pendanaan: true },
    });
    const targetPendanaan = toDecimal(projectRow?.target_pendanaan);

    await prisma.$transaction(async (tx) => {
      for (const t of linkedTalangan) {
        // Turunkan modal disetor & komitmen penanggung (clamp ≥ 0).
        if (t.id_project_investor != null) {
          const inv = await tx.projectInvestor.findUnique({
            where: { id_project_investor: t.id_project_investor },
            select: { nominal_terbayar: true, nominal_komitmen: true },
          });
          if (inv) {
            const dec = toDecimal(t.nominal);
            const terbayar = toDecimal(inv.nominal_terbayar).minus(dec);
            const komitmen = toDecimal(inv.nominal_komitmen).minus(dec);
            await tx.projectInvestor.update({
              where: { id_project_investor: t.id_project_investor },
              data: {
                nominal_terbayar: terbayar.lt(0)
                  ? new Prisma.Decimal(0)
                  : terbayar,
                nominal_komitmen: komitmen.lt(0)
                  ? new Prisma.Decimal(0)
                  : komitmen,
              },
            });
          }
        }
        await tx.projectArusKas.delete({
          where: { id_project_arus_kas: t.id_project_arus_kas },
        });
      }

      // Hitung ulang kepemilikan + sinkron total_pendanaan (Σ komitmen).
      await refreshOwnershipCache(tx, existing.id_project, targetPendanaan);
      const komitmenAgg = await tx.projectInvestor.aggregate({
        where: { id_project: existing.id_project },
        _sum: { nominal_komitmen: true },
      });
      await tx.project.update({
        where: { id_project: existing.id_project },
        data: {
          total_pendanaan: toDecimal(komitmenAgg._sum.nominal_komitmen ?? 0),
        },
      });

      // Hapus pengeluaran-nya.
      await tx.projectArusKas.delete({
        where: { id_project_arus_kas: transactionId },
      });
    });

    return NextResponse.json(
      {
        message:
          "Transaksi dihapus dan talangan investor terkait dibatalkan otomatis.",
        data: {
          id_project_arus_kas: existing.id_project_arus_kas.toString(),
          id_project: existing.id_project,
          judul_transaksi: existing.judul_transaksi,
          talangan_dibatalkan: linkedTalangan.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status }
      );
    }

    console.error("[CATAT_ARUS_KAS_DELETE_ERROR]", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan saat menghapus arus kas." },
      { status: 500 }
    );
  }
}
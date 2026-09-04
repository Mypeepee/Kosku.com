import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { readFileSync } from "fs";
import path from "path";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";
import { docxToPdf } from "@/lib/server/docxToPdf";

export const runtime  = "nodejs";
export const maxDuration = 60;

const BULAN_ID = [
  "JANUARI","FEBRUARI","MARET","APRIL","MEI","JUNI",
  "JULI","AGUSTUS","SEPTEMBER","OKTOBER","NOVEMBER","DESEMBER",
];
const BULAN_PANJANG = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember",
];

function toNum(v: unknown): number {
  if (v == null) return 0;
  return Number(typeof v === "object" ? String(v) : v) || 0;
}

function fmtRp(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function formatTanggal(d: Date): string {
  return `${d.getDate()} ${BULAN_PANJANG[d.getMonth()]} ${d.getFullYear()}`;
}

function composeNomor(idTrx: string, d: Date): string {
  const digits = idTrx.match(/\d+/)?.[0] ?? "1";
  const seq = digits.padStart(3, "0");
  return `${seq}/MOU/SPT-SBY/${BULAN_ID[d.getMonth()]}/${d.getFullYear()}`;
}

async function fillDocx(templatePath: string, data: Record<string, string>): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PizZip       = require("pizzip");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Docxtemplater = require("docxtemplater");

  const content = readFileSync(templatePath, "binary");
  const zip     = new PizZip(content);
  const doc     = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks:    true,
    delimiters:    { start: "{{", end: "}}" },
    nullGetter:    () => "",
  });
  doc.render(data);
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id_transaksi } = await req.json() as { id_transaksi?: string };
    if (!id_transaksi) {
      return NextResponse.json({ error: "id_transaksi wajib diisi" }, { status: 400 });
    }

    // Ambil data lengkap dari MOU
    const isNumeric = /^\d+$/.test(id_transaksi);
    const mou = await prisma.mou.findFirst({
      where: isNumeric ? { id: BigInt(id_transaksi) } : { id_transaksi },
      select: {
        id:                true,
        id_transaksi:      true,
        tipe_komisi:       true,
        nama_lengkap_klien: true,
        alamat_klien:      true,
        harga_deal:        true,
        harga_limit:       true,
        listing: {
          select: {
            alamat_lengkap:    true,
            nilai_limit_lelang: true,
          },
        },
        agent: {
          select: {
            nama_kantor: true,
            kota_area:   true,
            pengguna: { select: { nama_lengkap: true } },
          },
        },
      },
    });

    if (!mou) return NextResponse.json({ error: "MOU tidak ditemukan" }, { status: 404 });

    const isPersen = mou.tipe_komisi.toUpperCase() === "PERSENTASE";

    // 10% dari harga_limit (persentase) atau harga_deal (selisih)
    const baseNum = isPersen
      ? toNum(mou.harga_limit) || toNum((mou.listing as any).nilai_limit_lelang)
      : toNum(mou.harga_deal);
    const nilaiNum = Math.round(baseNum * 0.1);

    const now          = new Date();
    const idTrxStr     = mou.id_transaksi ?? String(mou.id);
    const nomor_invoice = composeNomor(idTrxStr, now);
    const tanggal      = formatTanggal(now);

    const nama_agent   = mou.agent.pengguna.nama_lengkap ?? "";
    const nama_pembeli = mou.nama_lengkap_klien ?? "";
    const alamat_lengkap = mou.listing.alamat_lengkap ?? "";
    const keterangan   = "Uang Tanda Minat";

    const templatePath = path.join(
      process.cwd(),
      "src/app/dashboard/surat/components/templates/Invoice_Solusindo_Premier_Final.docx",
    );

    const docxBuffer = await fillDocx(templatePath, {
      nomor_invoice,
      tanggal,
      nama_pembeli,
      nama_agent,
      alamat_lengkap,
      keterangan,
      nilai:       fmtRp(nilaiNum),
      total_nilai: fmtRp(nilaiNum),
    });

    const pdfBuffer = await docxToPdf(docxBuffer);

    // Pastikan Transaksi record ada (FK requirement)
    // Jika belum ada, buat minimal dengan status uang_tanda_jaminan
    if (idTrxStr) {
      const trxExists = await prisma.transaksi.findUnique({
        where: { id_transaksi: idTrxStr },
        select: { id_transaksi: true },
      }).catch(() => null);

      if (!trxExists) {
        await prisma.transaksi.create({
          data: {
            id_transaksi:            idTrxStr,
            tanggal_transaksi:       now,
            status_transaksi:        "uang_tanda_jaminan" as any,
          },
          select: { id_transaksi: true },
        });
      }

      // Simpan invoice — hanya sekali (idempoten: cek by id_invoice karena itu unique key)
      const alreadySaved = await prisma.invoice.findUnique({
        where:  { id_invoice: nomor_invoice },
        select: { id_invoice: true },
      }).catch(() => null);

      if (!alreadySaved) {
        await prisma.invoice.create({
          data: {
            id_invoice:      nomor_invoice,
            id_transaksi:    idTrxStr,
            ditagihkan_ke:   nama_pembeli,
            keterangan,
            nominal:         BigInt(nilaiNum),
            tanggal_invoice: now,
          },
          select: { id_invoice: true },
        });
      }
    }

    const safeNomor = nomor_invoice.replace(/[^a-zA-Z0-9]/g, "_");
    const filename  = `Invoice_UTM_${safeNomor}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: unknown) {
    console.error("[generate-invoice-utm]", e);
    const msg = e instanceof Error ? e.message : "Gagal generate Invoice UTM.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

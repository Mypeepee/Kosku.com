import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { readFileSync } from "fs";
import path from "path";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";
import { docxToPdf } from "@/lib/server/docxToPdf";

export const runtime = "nodejs";
export const maxDuration = 60;

const BULAN_ID = [
  "JANUARI","FEBRUARI","MARET","APRIL","MEI","JUNI",
  "JULI","AGUSTUS","SEPTEMBER","OKTOBER","NOVEMBER","DESEMBER",
];
const BULAN_PANJANG = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember",
];

function formatTanggal(d: Date): string {
  return `${d.getDate()} ${BULAN_PANJANG[d.getMonth()]} ${d.getFullYear()}`;
}

function composeNomorKuitansi(seq: number, d: Date): string {
  return `${String(seq).padStart(3, "0")}/KWT/SP-SBY/${BULAN_ID[d.getMonth()]}/${d.getFullYear()}`;
}

// ─── Terbilang Indonesia ──────────────────────────────────────────────────────
// Konversi angka ke kata-kata bahasa Indonesia + "Rupiah" suffix.
// Contoh: 100023000 → "Seratus juta dua puluh tiga ribu Rupiah"

const SATUAN = [
  "", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan",
  "sepuluh", "sebelas", "dua belas", "tiga belas", "empat belas", "lima belas",
  "enam belas", "tujuh belas", "delapan belas", "sembilan belas",
];
const PULUHAN = [
  "", "", "dua puluh", "tiga puluh", "empat puluh", "lima puluh",
  "enam puluh", "tujuh puluh", "delapan puluh", "sembilan puluh",
];

function terbilangRatus(n: number): string {
  if (n < 20) return SATUAN[n];
  if (n < 100) return PULUHAN[Math.floor(n / 10)] + (n % 10 ? " " + SATUAN[n % 10] : "");
  const r = Math.floor(n / 100);
  const s = n % 100;
  return (r === 1 ? "seratus" : SATUAN[r] + " ratus") + (s ? " " + terbilangRatus(s) : "");
}

function terbilang(n: number): string {
  if (n === 0) return "Nol Rupiah";
  const parts: string[] = [];
  const triliun = Math.floor(n / 1_000_000_000_000);
  const miliar  = Math.floor((n % 1_000_000_000_000) / 1_000_000_000);
  const juta    = Math.floor((n % 1_000_000_000) / 1_000_000);
  const ribu    = Math.floor((n % 1_000_000) / 1_000);
  const sisa    = n % 1_000;

  if (triliun) parts.push(terbilangRatus(triliun) + " triliun");
  if (miliar)  parts.push(terbilangRatus(miliar) + " miliar");
  if (juta)    parts.push(terbilangRatus(juta) + " juta");
  if (ribu)    parts.push(ribu === 1 ? "seribu" : terbilangRatus(ribu) + " ribu");
  if (sisa)    parts.push(terbilangRatus(sisa));

  const result = parts.join(" ").trim();
  return result.charAt(0).toUpperCase() + result.slice(1) + " Rupiah";
}

async function fillDocx(templatePath: string, data: Record<string, string>): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PizZip = require("pizzip");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Docxtemplater = require("docxtemplater");

  const content = readFileSync(templatePath, "binary");
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
    nullGetter: () => "",
  });
  doc.render(data);
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json() as { id_invoice: string };
    const { id_invoice } = body;

    if (!id_invoice) {
      return NextResponse.json({ detail: "id_invoice wajib diisi." }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id_invoice },
      include: {
        transaksi: {
          include: {
            listing: { select: { alamat_lengkap: true, judul: true, kota: true } },
            agent: {
              include: {
                pengguna: { select: { nama_lengkap: true } },
              },
            },
          },
        },
      },
    });
    if (!invoice) {
      return NextResponse.json({ detail: "Invoice tidak ditemukan." }, { status: 404 });
    }

    const alamat    = invoice.transaksi.listing.alamat_lengkap ?? invoice.transaksi.listing.kota ?? "";
    const namaAgent = invoice.transaksi.agent_luar_nama ?? invoice.transaksi.agent.pengguna.nama_lengkap;

    const now = new Date();

    // Generate nomor kuitansi — hitung per bulan
    const bulanIni   = new Date(now.getFullYear(), now.getMonth(), 1);
    const bulanDepan = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const countBulanIni = await prisma.invoice.count({
      where: {
        id_kuitansi:      { not: null },
        tanggal_kuitansi: { gte: bulanIni, lt: bulanDepan },
      },
    });
    const nomor_kuitansi = composeNomorKuitansi(countBulanIni + 1, now);

    const nominalNum       = Number(invoice.nominal);
    const nominalFormatted = `Rp ${nominalNum.toLocaleString("id-ID")}`;
    const terbilangText    = terbilang(nominalNum);

    const templatePath = path.join(
      process.cwd(),
      "src/app/dashboard/surat/components/templates/Kuitansi_Solusindo_Premier.docx",
    );

    // Prefill — mirror invoice's field naming + tambah field khusus kuitansi
    const docxBuffer = await fillDocx(templatePath, {
      // identitas kuitansi
      nomor_kuitansi,
      tanggal:               formatTanggal(now),
      kota:                  "Surabaya",
      // identitas pembayar (dari invoice.ditagihkan_ke)
      nama_pembayar:         invoice.ditagihkan_ke,
      nama_pembeli:          invoice.ditagihkan_ke,
      // nominal
      nilai:                 nominalFormatted,
      total_nilai:           nominalFormatted,
      nominal:               nominalFormatted,
      nominal_angka:         nominalNum.toLocaleString("id-ID"),
      // terbilang — ini yang penting
      terbilang:             terbilangText,
      terbilang_total_nilai: terbilangText,
      terbilang_nilai:       terbilangText,
      // keperluan
      keterangan:            invoice.keterangan,
      perihal:               invoice.keterangan,
      // alamat property & agent
      alamat_lengkap:        alamat,
      alamat_property:       alamat,
      alamat:                alamat,
      nama_agent:            namaAgent,
      agent:                 namaAgent,
      // referensi ke invoice
      nomor_invoice:         invoice.id_invoice,
      id_invoice:            invoice.id_invoice,
      catatan:               `Referensi Invoice: ${invoice.id_invoice}`,
    });

    const pdfBuffer = await docxToPdf(docxBuffer);

    // Update invoice: isi id_kuitansi dan tanggal_kuitansi
    await prisma.invoice.update({
      where: { id_invoice },
      data: {
        id_kuitansi:      nomor_kuitansi,
        tanggal_kuitansi: now,
      },
    });

    const safeNomor = nomor_kuitansi.replace(/[^a-zA-Z0-9]/g, "_");
    const filename  = `Kuitansi_${safeNomor}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: unknown) {
    console.error("[generate-kuitansi]", e);
    const msg = e instanceof Error ? e.message : "Gagal generate kuitansi.";
    return NextResponse.json({ detail: msg }, { status: 500 });
  }
}

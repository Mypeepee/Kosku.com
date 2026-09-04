import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { readFileSync } from "fs";
import path from "path";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";
import { docxToPdf } from "@/lib/server/docxToPdf";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── Format tanggal Indonesia ─────────────────────────────────────────────────
const BULAN_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

function formatTanggalIndonesia(date: Date): string {
  return `${date.getDate()} ${BULAN_ID[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Terima tanggal dalam format "YYYY-MM-DD" (dari <input type=date>) atau string
 * bebas. Kembalikan tanggal Indonesia yang rapi. Kosong → hari ini.
 */
function normalizeTanggalTtd(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return formatTanggalIndonesia(new Date());

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (!Number.isNaN(d.getTime())) return formatTanggalIndonesia(d);
  }
  // Sudah dalam bentuk teks (mis. "7 Juli 2026") → pakai apa adanya
  return value;
}

/** Nomor tanda terima default: NNN/TT/SP-SBY/ROMAWI/TAHUN */
function composeNomorTandaTerima(seq: number, d: Date): string {
  return `${String(seq).padStart(3, "0")}/TT/SP-SBY/${ROMAWI[d.getMonth()]}/${d.getFullYear()}`;
}

// ── Isi DOCX ─────────────────────────────────────────────────────────────────
async function fillDocxTemplate(templatePath: string, data: Record<string, string>): Promise<Buffer> {
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

function sanitizeFilename(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 50) || "TandaTerima";
}

// ── Route Handler ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Record<string, string>;

    const namaPemilik = (body.nama_pemilik ?? "").trim();
    const nikPemilik = (body.nik_pemilik ?? "").trim();
    const alamatPemilik = (body.alamat_pemilik ?? "").trim();
    const alamatProperti = (body.alamat_properti ?? "").trim();

    if (!namaPemilik) {
      return NextResponse.json({ detail: "Nama penerima wajib diisi." }, { status: 400 });
    }
    if (!alamatProperti) {
      return NextResponse.json({ detail: "Alamat properti wajib diisi." }, { status: 400 });
    }

    // ── Identitas agent: dari body (bisa di-override) atau session ──────────
    const sessionUser = session.user as { agentId?: string | null; name?: string | null };
    let namaAgent = (body.nama_agent ?? "").trim();
    let noAgent = (body.no_agent ?? "").trim();

    if ((!namaAgent || !noAgent) && sessionUser.agentId) {
      const agent = await prisma.agent.findUnique({
        where: { id_agent: sessionUser.agentId },
        select: {
          id_agent: true,
          nomor_whatsapp: true,
          pengguna: { select: { nama_lengkap: true } },
        },
      });
      if (!namaAgent) namaAgent = agent?.pengguna.nama_lengkap ?? sessionUser.name ?? "";
      if (!noAgent) noAgent = agent?.nomor_whatsapp ?? agent?.id_agent ?? "";
    }
    if (!namaAgent) namaAgent = sessionUser.name ?? "";

    // ── Tanggal & nomor ────────────────────────────────────────────────────
    const tanggalTtd = normalizeTanggalTtd(body.tanggal_ttd);
    const nomor = (body.id_tanda_terima ?? "").trim() || composeNomorTandaTerima(1, new Date());

    // ── Map ke placeholder template ────────────────────────────────────────
    const templateData: Record<string, string> = {
      id_tanda_terima: nomor,
      nama_pemilik: namaPemilik,
      nik_pemilik: nikPemilik,
      alamat_pemilik: alamatPemilik,
      tanggal_ttd: tanggalTtd,
      alamat_properti: alamatProperti,
      nama_agent: namaAgent,
      no_agent: noAgent,
      // No. identitas penerima di blok tanda tangan = NIK penerima
      no_identitas: nikPemilik ? `NIK. ${nikPemilik}` : "",
    };

    const templatePath = path.join(
      process.cwd(),
      "src/app/dashboard/surat/components/templates/TandaTerima_Solusindo.docx",
    );

    const filledDocx = await fillDocxTemplate(templatePath, templateData);
    const pdf = await docxToPdf(filledDocx);

    const filename = `TandaTerima_${sanitizeFilename(namaPemilik)}.pdf`;

    return new NextResponse(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdf.length),
      },
    });
  } catch (err) {
    const msg = (err as Error).message ?? "Gagal generate tanda terima";
    console.error("[generate-tanda-terima]", err);
    return NextResponse.json({ detail: msg }, { status: 500 });
  }
}

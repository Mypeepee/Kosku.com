import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { writeFile, readFile, unlink } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";
import { join } from "path";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 60;

const execFileAsync = promisify(execFile);

// ── LibreOffice path (macOS / Linux fallback) ────────────────────────────────
function findSoffice(): string {
  const candidates = [
    process.env.SOFFICE_PATH,
    // Windows (lokasi default installer) — pakai soffice.com dulu agar konversi
    // headless berjalan sinkron (soffice.exe bisa detach & PDF belum siap).
    "C:/Program Files/LibreOffice/program/soffice.com",
    "C:/Program Files (x86)/LibreOffice/program/soffice.com",
    "C:/Program Files/LibreOffice/program/soffice.exe",
    "C:/Program Files (x86)/LibreOffice/program/soffice.exe",
    // macOS / Linux
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "/usr/bin/soffice",
    "/usr/local/bin/soffice",
    "/opt/libreoffice/program/soffice",
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    try { if (existsSync(p)) return p; } catch { /* try next */ }
  }
  throw new Error("LibreOffice (soffice) tidak ditemukan. Install LibreOffice atau set SOFFICE_PATH di .env");
}

// ── Format tanggal ────────────────────────────────────────────────────────────
const BULAN_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function formatTanggalIndonesia(date: Date): string {
  return `${date.getDate()} ${BULAN_ID[date.getMonth()]} ${date.getFullYear()}`;
}

// ── Fill DOCX template ────────────────────────────────────────────────────────
async function fillDocxTemplate(
  templatePath: string,
  data: Record<string, string>,
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PizZip      = require("pizzip");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Docxtemplater = require("docxtemplater");

  const content = readFileSync(templatePath, "binary");
  const zip     = new PizZip(content);
  const doc     = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks:    true,
    delimiters:    { start: "{{", end: "}}" },  // template pakai {{...}}
    nullGetter:    () => "",
  });

  doc.render(data);

  const buf = doc.getZip().generate({
    type:        "nodebuffer",
    compression: "DEFLATE",
  });

  return buf as Buffer;
}

// ── Convert DOCX → PDF via LibreOffice ───────────────────────────────────────
async function docxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  const id      = `akta_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const docxPath = join(tmpdir(), `${id}.docx`);
  const pdfPath  = join(tmpdir(), `${id}.pdf`);
  const soffice  = findSoffice();

  try {
    await writeFile(docxPath, docxBuffer);

    await execFileAsync(soffice, [
      "--headless",
      "--norestore",
      "--convert-to", "pdf",
      "--outdir", tmpdir(),
      docxPath,
    ]);

    return await readFile(pdfPath);
  } finally {
    await unlink(docxPath).catch(() => {});
    await unlink(pdfPath).catch(() => {});
  }
}

// ── Extract halaman tertentu dari PDF (pakai pdf-lib) ─────────────────────────
async function extractPages(pdfBuffer: Buffer, pageIndices: number[]): Promise<Buffer> {
  const { PDFDocument } = await import("pdf-lib");

  const src  = await PDFDocument.load(pdfBuffer);
  const dest = await PDFDocument.create();

  const copied = await dest.copyPages(src, pageIndices);
  for (const page of copied) dest.addPage(page);

  const bytes = await dest.save();
  return Buffer.from(bytes);
}

// ── Sanitize filename ─────────────────────────────────────────────────────────
function sanitizeFilename(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 50);
}

// ── Route Handler ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, string>;

    const isKuasa     = body.bertindakSebagai === "kuasa";
    const namaPemohon = body.nama_pemohon || "Pemohon";

    // ── Map form values → template placeholders ─────────────────────────
    const today = new Date();
    const templateData: Record<string, string> = {
      // Tanggal surat hari ini
      tanggal: formatTanggalIndonesia(today),

      // KTP Pemohon
      nama_pemohon:         body.nama_pemohon         || "",
      NIK_pemohon:          body.nik_pemohon           || "",
      tempatlahir_pemohon:  body.tempatlahir_pemohon   || "",
      tanggallahir_pemohon: body.tanggallahir_pemohon  || "",
      alamat_pemohon:       body.alamat_pemohon        || "",

      // KTP Kuasa
      nama_kuasa:           body.nama_kuasa            || "",
      NIK_kuasa:            body.nik_kuasa             || "",
      tempatlahir_kuasa:    body.tempatlahir_kuasa      || "",
      tanggallahir_kuasa:   body.tanggallahir_kuasa     || "",
      alamat_kuasa:         body.alamat_kuasa           || "",

      // Risalah Lelang
      nomor_risalahlelang:  body.nomor_risalah         || "",
      tanggal_risalahlelang: body.tanggal_risalah      || "",
      jamlelang:            body.pukul_lelang           || "",
      pejabat_lelang:       body.pejabat_lelang        || "",
      NIP:                  body.nip_pejabat            || "",
    };

    // ── Isi template ────────────────────────────────────────────────────
    const templatePath = path.join(
      process.cwd(),
      "src/app/dashboard/surat/components/templates/TemplatePermohonan_Akta_Grosse_Final.docx",
    );

    const filledDocx = await fillDocxTemplate(templatePath, templateData);

    // ── Konversi ke PDF ─────────────────────────────────────────────────
    const fullPdf = await docxToPdf(filledDocx);

    // ── Pilih halaman ───────────────────────────────────────────────────
    // Kuasa  → 2 halaman (index 0 dan 1)
    // Sendiri → halaman 1 saja (index 0)
    const finalPdf = isKuasa
      ? await extractPages(fullPdf, [0, 1])  // kedua halaman
      : await extractPages(fullPdf, [0]);    // halaman pertama saja

    // ── Nama file ───────────────────────────────────────────────────────
    const suffix   = isKuasa ? "Kuasa" : "Sendiri";
    const safeName = sanitizeFilename(namaPemohon);
    const filename = `Permohonan_AktaGrosse_${safeName}_${suffix}.pdf`;

    return new NextResponse(finalPdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length":      String(finalPdf.length),
      },
    });
  } catch (err) {
    const msg = (err as Error).message ?? "Gagal generate surat";
    console.error("Generate Akta Grosse error:", err);
    return NextResponse.json({ detail: msg }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { readFileSync, existsSync } from "fs";
import { writeFile, readFile, unlink } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";
import { join } from "path";
import path from "path";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

const execFileAsync = promisify(execFile);

// ── Terbilang ────────────────────────────────────────────────────────────────

const SATUAN = [
  "", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan",
  "sepuluh", "sebelas", "dua belas", "tiga belas", "empat belas", "lima belas",
  "enam belas", "tujuh belas", "delapan belas", "sembilan belas",
];

function terbilang(n: number): string {
  if (n === 0) return "nol";
  if (n < 0) return "minus " + terbilang(-n);
  if (n < 20) return SATUAN[n];
  if (n < 100) {
    const p = Math.floor(n / 10), s = n % 10;
    const pStr = SATUAN[p] + " puluh";
    return s ? pStr + " " + SATUAN[s] : pStr;
  }
  if (n < 200) { const s = n % 100; return "seratus" + (s ? " " + terbilang(s) : ""); }
  if (n < 1_000) { const r = Math.floor(n / 100), s = n % 100; return SATUAN[r] + " ratus" + (s ? " " + terbilang(s) : ""); }
  if (n < 2_000) { const s = n % 1_000; return "seribu" + (s ? " " + terbilang(s) : ""); }
  if (n < 1_000_000) { const k = Math.floor(n / 1_000), s = n % 1_000; return terbilang(k) + " ribu" + (s ? " " + terbilang(s) : ""); }
  if (n < 1_000_000_000) { const m = Math.floor(n / 1_000_000), s = n % 1_000_000; return terbilang(m) + " juta" + (s ? " " + terbilang(s) : ""); }
  if (n < 1_000_000_000_000) { const b = Math.floor(n / 1_000_000_000), s = n % 1_000_000_000; return terbilang(b) + " miliar" + (s ? " " + terbilang(s) : ""); }
  const t = Math.floor(n / 1_000_000_000_000), s = n % 1_000_000_000_000;
  return terbilang(t) + " triliun" + (s ? " " + terbilang(s) : "");
}

// ── Tanggal helpers ─────────────────────────────────────────────────────────

const BULAN_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const HARI_ID  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];

function parseISO(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function parseDMY(raw: string): Date | null {
  const m = raw.match(/^(\d{1,2})-(\d{1,2,})-(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function fromISO(iso: string) {
  const d = parseISO(iso);
  if (!d) return { hari: "", tanggal: "", terbilang: "" };
  return {
    hari:      HARI_ID[d.getDay()],
    tanggal:   `${d.getDate()} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`,
    terbilang: `${terbilang(d.getDate())} ${BULAN_ID[d.getMonth()]} ${terbilang(d.getFullYear())}`,
  };
}

function fromDMY(raw: string) {
  const d = parseDMY(raw) ?? parseISO(raw);
  if (!d) return { tanggal: raw, terbilang: "" };
  return {
    tanggal:   `${d.getDate()} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`,
    terbilang: `${terbilang(d.getDate())} ${BULAN_ID[d.getMonth()]} ${terbilang(d.getFullYear())}`,
  };
}

function fmtRupiah(n: number): string {
  return "Rp. " + n.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toInt(raw: string | undefined): number {
  return parseInt((raw ?? "").replace(/\D/g, "") || "0", 10);
}

const ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

function pad2(n: number): string { return String(n).padStart(2, "0"); }

/** "" / whitespace → null, selain itu string yang sudah di-trim. */
function nn(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t ? t : null;
}

/** "YYYY-MM-DD" → Date (UTC midnight, agar kolom DATE tidak bergeser TZ). */
function toDateOnly(iso: string | undefined): Date | null {
  const m = (iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

// ── LibreOffice ──────────────────────────────────────────────────────────────

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

async function docxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  const id = `akb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const docxPath = join(tmpdir(), `${id}.docx`);
  const pdfPath  = join(tmpdir(), `${id}.pdf`);
  const soffice  = findSoffice();
  try {
    await writeFile(docxPath, docxBuffer);
    await execFileAsync(soffice, [
      "--headless", "--norestore",
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

// ── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as Record<string, string>;

    if (!body.p1_nama?.trim()) return NextResponse.json({ detail: "Nama Pihak Pertama wajib diisi." }, { status: 400 });
    if (!body.p2_nama?.trim()) return NextResponse.json({ detail: "Nama Pihak Kedua wajib diisi." }, { status: 400 });
    if (!toInt(body.kompensasi_total)) return NextResponse.json({ detail: "Nominal kompensasi wajib diisi." }, { status: 400 });

    const kompensasiTotal = toInt(body.kompensasi_total);
    const tahap1Jumlah   = toInt(body.tahap1_jumlah);
    const tahap2Jumlah   = kompensasiTotal - tahap1Jumlah;
    const luasNum        = toInt(body.luas);

    const tanggalAkta = body.tanggal_akta || new Date().toISOString().split("T")[0];
    const aktaDate    = fromISO(tanggalAkta);
    const p1Lahir     = fromDMY(body.p1_tgl_lahir ?? "");
    const p2Lahir     = fromDMY(body.p2_tgl_lahir ?? "");
    const risalahDate = fromISO(body.risalah_tanggal ?? "");
    const batasDate   = fromISO(body.batas_tanggal ?? "");
    const t1Date      = fromISO(body.tahap1_tanggal ?? "");
    const ttdDate     = fromISO(body.tanggal_ttd || tanggalAkta);

    // ── Reservasi nomor akta (auto-urut server) + simpan ke DB ────────────────
    // Nomor: NN/AKB/[romawi]/[tahun], urut reset per bulan+tahun. Insert baris
    // dulu agar nomor terkunci secara atomik; kalau bentrok (P2002) coba lagi.
    const aktaDateObj = parseISO(tanggalAkta) ?? new Date();
    const bulan = aktaDateObj.getMonth() + 1;
    const tahun = aktaDateObj.getFullYear();
    const idAgent = (session.user as { agentId?: string | null }).agentId ?? null;

    const dbBase = {
      bulan, tahun,
      tanggal_akta:         toDateOnly(tanggalAkta) ?? new Date(),
      pukul:                body.pukul?.trim() || "10.00",
      p1_nama:              body.p1_nama.trim(),
      p1_nik:               nn(body.p1_nik),
      p1_tempat_lahir:      nn(body.p1_tempat_lahir),
      p1_tgl_lahir:         nn(body.p1_tgl_lahir),
      p1_warga_negara:      body.p1_warga_negara?.trim() || "Indonesia",
      p1_pekerjaan:         nn(body.p1_pekerjaan),
      p1_alamat:            nn(body.p1_alamat),
      p2_nama:              body.p2_nama.trim(),
      p2_nik:               nn(body.p2_nik),
      p2_tempat_lahir:      nn(body.p2_tempat_lahir),
      p2_tgl_lahir:         nn(body.p2_tgl_lahir),
      p2_warga_negara:      body.p2_warga_negara?.trim() || "Indonesia",
      p2_pekerjaan:         nn(body.p2_pekerjaan),
      p2_alamat:            nn(body.p2_alamat),
      risalah_nomor:        nn(body.risalah_nomor),
      risalah_tanggal:      nn(body.risalah_tanggal),
      kantor_lelang:        nn(body.kantor_lelang),
      jenis_hak:            nn(body.jenis_hak),
      nib:                  nn(body.nib),
      luas:                 nn(body.luas),
      alamat_obyek:         nn(body.alamat_obyek),
      alamat_obyek_lengkap: nn(body.alamat_obyek_lengkap) ?? nn(body.alamat_obyek),
      obyek_provinsi:       nn(body.obyek_provinsi),
      obyek_kabupaten:      nn(body.obyek_kabupaten),
      obyek_kecamatan:      nn(body.obyek_kecamatan),
      obyek_kelurahan:      nn(body.obyek_kelurahan),
      kompensasi_total:     kompensasiTotal,
      tahap1_jumlah:        tahap1Jumlah,
      tahap2_jumlah:        tahap2Jumlah,
      tahap1_tanggal:       toDateOnly(body.tahap1_tanggal),
      batas_tanggal:        toDateOnly(body.batas_tanggal),
      pengadilan:           nn(body.pengadilan),
      kota_ttd:             body.kota_ttd?.trim() || "Surabaya",
      tanggal_ttd:          toDateOnly(body.tanggal_ttd) ?? toDateOnly(tanggalAkta),
      id_agent:             idAgent,
    };

    let nomor = "";
    let recordId: bigint | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const last = await prisma.aktaKesepakatanBersama.findFirst({
        where: { tahun, bulan },
        orderBy: { nomor_urut: "desc" },
        select: { nomor_urut: true },
      });
      const urut = (last?.nomor_urut ?? 0) + 1;
      const candidate = `${pad2(urut)}/AKB/${ROMAWI[bulan - 1]}/${tahun}`;
      try {
        const rec = await prisma.aktaKesepakatanBersama.create({
          data: { ...dbBase, nomor: candidate, nomor_urut: urut },
          select: { id: true },
        });
        nomor = candidate;
        recordId = rec.id;
        break;
      } catch (e) {
        if ((e as { code?: string }).code === "P2002" && attempt < 5) continue;
        throw e;
      }
    }

    const templateData: Record<string, string> = {
      nomor:             nomor,
      hari:              aktaDate.hari,
      tanggal:           aktaDate.tanggal,
      tanggal_terbilang: aktaDate.terbilang,
      pukul:             body.pukul?.trim() || "10.00",

      p1_nama:                body.p1_nama?.trim() || "",
      p1_tempat_lahir:        body.p1_tempat_lahir?.trim() || "",
      p1_tgl_lahir:           p1Lahir.tanggal,
      p1_tgl_lahir_terbilang: p1Lahir.terbilang,
      p1_warga_negara:        body.p1_warga_negara?.trim() || "Indonesia",
      p1_pekerjaan:           body.p1_pekerjaan?.trim() || "",
      p1_alamat:              body.p1_alamat?.trim() || "",
      p1_nik:                 body.p1_nik?.trim() || "",

      p2_nama:                body.p2_nama?.trim() || "",
      p2_tempat_lahir:        body.p2_tempat_lahir?.trim() || "",
      p2_tgl_lahir:           p2Lahir.tanggal,
      p2_tgl_lahir_terbilang: p2Lahir.terbilang,
      p2_warga_negara:        body.p2_warga_negara?.trim() || "Indonesia",
      p2_pekerjaan:           body.p2_pekerjaan?.trim() || "",
      p2_alamat:              body.p2_alamat?.trim() || "",
      p2_nik:                 body.p2_nik?.trim() || "",

      jenis_hak:       body.jenis_hak?.trim() || "",
      nib:             body.nib?.trim() || "",
      luas:            body.luas?.trim() || "",
      luas_terbilang:  luasNum ? terbilang(luasNum) : "",
      obyek_provinsi:  body.obyek_provinsi?.trim() || "",
      obyek_kabupaten: body.obyek_kabupaten?.trim() || "",
      obyek_kecamatan: body.obyek_kecamatan?.trim() || "",
      obyek_kelurahan: body.obyek_kelurahan?.trim() || "",
      pemegang_hak:    body.pemegang_hak?.trim() || "",
      alamat_obyek:    body.alamat_obyek?.trim() || "",
      alamat_obyek_lengkap: (body.alamat_obyek_lengkap || body.alamat_obyek || "").trim(),

      risalah_nomor:              body.risalah_nomor?.trim() || "",
      risalah_tanggal:            risalahDate.tanggal,
      risalah_tanggal_terbilang:  risalahDate.terbilang,
      kantor_lelang:              body.kantor_lelang?.trim() || "",

      kompensasi_total:           fmtRupiah(kompensasiTotal),
      kompensasi_total_terbilang: terbilang(kompensasiTotal) + " rupiah",
      tahap1_jumlah:              fmtRupiah(tahap1Jumlah),
      tahap1_terbilang:           terbilang(tahap1Jumlah) + " rupiah",
      tahap1_tanggal:             t1Date.tanggal,
      tahap1_tanggal_terbilang:   t1Date.terbilang,
      tahap2_jumlah:              fmtRupiah(tahap2Jumlah),
      tahap2_terbilang:           terbilang(tahap2Jumlah) + " rupiah",

      batas_tanggal:            batasDate.tanggal,
      batas_tanggal_terbilang:  batasDate.terbilang,
      pemberitahuan_minggu:     body.pemberitahuan_minggu?.trim() || "2",

      pengadilan:  body.pengadilan?.trim() || "",
      kota_ttd:    body.kota_ttd?.trim() || "Surabaya",
      tanggal_ttd: ttdDate.tanggal,
    };

    const templatePath = path.join(
      process.cwd(),
      "src/app/dashboard/surat/components/templates/Akta_kesepakatan_bersama_TemplateSolusindo.docx",
    );

    let pdf: Buffer;
    try {
      const filledDocx = await fillDocxTemplate(templatePath, templateData);
      pdf = await docxToPdf(filledDocx);
    } catch (genErr) {
      // PDF gagal setelah baris DB dibuat → batalkan supaya nomor tidak "hangus".
      if (recordId != null) {
        await prisma.aktaKesepakatanBersama.delete({ where: { id: recordId } }).catch(() => {});
      }
      throw genErr;
    }

    const safeName = (body.p2_nama?.trim() || "Pihak2")
      .replace(/[^a-zA-Z0-9 _-]/g, "").replace(/\s+/g, "_").slice(0, 40);
    const safeNomor = nomor.replace(/\//g, "-");
    const filename = `AktaKesepakatan_${safeNomor}_${safeName}.pdf`;

    return new NextResponse(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length":      String(pdf.length),
        "X-Akta-Nomor":        nomor,
      },
    });
  } catch (err) {
    console.error("[generate-akta-kesepakatan]", err);
    return NextResponse.json({ detail: (err as Error).message ?? "Gagal generate dokumen" }, { status: 500 });
  }
}

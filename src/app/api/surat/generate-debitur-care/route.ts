/**
 * POST /api/surat/generate-debitur-care
 *
 * Menghasilkan satu PDF berisi DUA dokumen berurutan — Surat Kuasa lalu
 * Perjanjian Jasa Hukum — dari `public/templates/TEMPLATE_DEBITURCARE.docx`.
 *
 * NOMOR SURAT DIPESAN DI SINI, BUKAN DIKETIK DI FORM.
 * Formatnya NNN/PJH-[inisial debitur]/[romawi bulan]/[tahun] dan urutnya
 * di-reset tiap ganti bulan. Yang menentukan urutan adalah BARIS DI TABEL,
 * bukan hitungan di memori: baris di-INSERT lebih dulu supaya nomornya
 * terkunci secara atomik, dan kalau dua request berebut angka yang sama,
 * indeks unik (tahun, bulan, nomor_urut) menolak yang kalah dan kita coba
 * lagi. Menghitung dulu lalu menulis belakangan akan menerbitkan dua
 * perjanjian bernomor kembar pada hari sibuk.
 *
 * KALAU PDF GAGAL, BARISNYA DIHAPUS. Nomor yang sudah terpesan tapi tidak
 * pernah jadi surat akan meninggalkan lubang di urutan register — dan lubang
 * di register nomor perjanjian selalu jadi pertanyaan yang tak enak dijawab.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { readFileSync } from "fs";
import path from "path";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";
import { docxToPdf } from "@/lib/server/docxToPdf";
import { inisialNama, rakitNomorPjh } from "@/lib/suratNomor";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── Tanggal & nomor ──────────────────────────────────────────────────────────

const BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HARI_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** "YYYY-MM-DD" → Date lokal. Sengaja bukan `new Date(iso)`: itu UTC. */
function dariIso(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** "YYYY-MM-DD" → Date tengah-malam UTC, agar kolom DATE tidak bergeser zona. */
function keTanggalSaja(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
}

// ── Isi template ─────────────────────────────────────────────────────────────

function isiTemplate(templatePath: string, data: Record<string, string>): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PizZip = require("pizzip");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Docxtemplater = require("docxtemplater");

  const zip = new PizZip(readFileSync(templatePath, "binary"));
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
    nullGetter: () => "",
  });
  doc.render(data);
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}

/** "" / spasi → null, selain itu string ter-trim. */
function nn(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t ? t : null;
}

function amankanNama(raw: string): string {
  return raw.trim().replace(/[^a-zA-Z0-9 _-]/g, "").replace(/\s+/g, "_").slice(0, 40);
}

// ── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as Record<string, string>;

    // ── Yang benar-benar wajib ada di surat ────────────────────────────────
    const nama = (body.nama ?? "").trim();
    if (!nama) {
      return NextResponse.json({ detail: "Nama debitur wajib diisi." }, { status: 400 });
    }
    const alamatLengkap = (body.alamat_lengkap ?? "").trim();
    if (!alamatLengkap) {
      return NextResponse.json(
        { detail: "Alamat lengkap wajib diisi — dipakai di Pasal 1 sebagai objek pengosongan." },
        { status: 400 },
      );
    }
    const jenisSertifikat = (body.jenis_sertifikat ?? "").trim();
    const nomorSertifikat = (body.nomor_sertifikat ?? "").trim();
    if (!jenisSertifikat || !nomorSertifikat) {
      return NextResponse.json(
        { detail: "Jenis dan nomor sertifikat wajib diisi." },
        { status: 400 },
      );
    }

    const isoSurat = body.tanggal_surat || new Date().toISOString().slice(0, 10);
    const tglSurat = dariIso(isoSurat) ?? new Date();
    const bulan = tglSurat.getMonth() + 1;
    const tahun = tglSurat.getFullYear();
    const inisial = (body.inisial ?? "").trim().toUpperCase() || inisialNama(nama);
    const idAgent = (session.user as { agentId?: string | null }).agentId ?? null;

    const barisDasar = {
      inisial, bulan, tahun,
      tanggal_surat: keTanggalSaja(isoSurat) ?? new Date(),
      nama,
      nik: nn(body.nik),
      tempat_lahir: nn(body.tempat_lahir),
      tanggal_lahir: nn(body.tanggal_lahir),
      tempat_tanggal_lahir: nn(body.tempat_tanggal_lahir),
      jenis_kelamin: nn(body.jenis_kelamin),
      gol_darah: nn(body.gol_darah),
      agama: nn(body.agama),
      status_kawin: nn(body.status_kawin),
      pekerjaan: nn(body.pekerjaan),
      warga_negara: body.warga_negara?.trim() || "Indonesia",
      alamat: nn(body.alamat),
      rt_rw: nn(body.rt_rw),
      kelurahan: nn(body.kelurahan),
      kecamatan: nn(body.kecamatan),
      kota: nn(body.kota),
      jenis_kota: nn(body.jenis_kota),
      provinsi: nn(body.provinsi),
      alamat_lengkap: alamatLengkap,
      jenis_sertifikat: jenisSertifikat,
      nomor_sertifikat: nomorSertifikat,
      sumber_ocr: nn(body.sumber_ocr),
      skor_ocr: body.skor_ocr ? Number(body.skor_ocr) || null : null,
      id_agent: idAgent,
    };

    // ── Pesan nomor: INSERT dulu, hitung ulang kalau kalah balapan ──────────
    let nomor = "";
    let idBaris: bigint | null = null;
    for (let percobaan = 0; percobaan < 6; percobaan++) {
      const terakhir = await prisma.suratDebiturCare.findFirst({
        where: { tahun, bulan },
        orderBy: { nomor_urut: "desc" },
        select: { nomor_urut: true },
      });
      const urut = (terakhir?.nomor_urut ?? 0) + 1;
      const kandidat = rakitNomorPjh(urut, inisial, bulan, tahun);
      try {
        const baris = await prisma.suratDebiturCare.create({
          data: { ...barisDasar, nomor: kandidat, nomor_urut: urut },
          select: { id: true },
        });
        nomor = kandidat;
        idBaris = baris.id;
        break;
      } catch (e) {
        if ((e as { code?: string }).code === "P2002" && percobaan < 5) continue;
        throw e;
      }
    }
    if (!nomor) {
      return NextResponse.json(
        { detail: "Gagal memesan nomor surat — terlalu banyak permintaan bersamaan. Coba lagi." },
        { status: 503 },
      );
    }

    // ── Isi template & konversi ────────────────────────────────────────────
    const dataTemplate: Record<string, string> = {
      nomor_surat: nomor,
      hari: HARI_ID[tglSurat.getDay()],
      tanggal: `${tglSurat.getDate()} ${BULAN_ID[tglSurat.getMonth()]} ${tahun}`,

      nama_debitur: nama,
      NIK: body.nik?.trim() || "",
      tempat_tanggal_lahir: body.tempat_tanggal_lahir?.trim() || "",
      kelamin: body.jenis_kelamin?.trim() || "",
      warga_negara: body.warga_negara?.trim() || "Indonesia",
      pekerjaan: body.pekerjaan?.trim() || "",
      status_kawin: body.status_kawin?.trim() || "",
      alamat_lengkap: alamatLengkap,
      jenis_sertifikat: jenisSertifikat,
      nomor_sertifikat: nomorSertifikat,
    };

    const templatePath = path.join(process.cwd(), "public/templates/TEMPLATE_DEBITURCARE.docx");

    let pdf: Buffer;
    try {
      pdf = await docxToPdf(isiTemplate(templatePath, dataTemplate), "debiturcare");
    } catch (gagal) {
      // Nomor tidak boleh hangus: tanpa ini register punya lubang yang tak
      // bisa dijelaskan ke siapa pun yang mengauditnya.
      if (idBaris != null) {
        await prisma.suratDebiturCare.delete({ where: { id: idBaris } }).catch(() => {});
      }
      throw gagal;
    }

    const namaBerkas = `DebiturCare_${nomor.replace(/\//g, "-")}_${amankanNama(nama)}.pdf`;

    return new NextResponse(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${namaBerkas}"`,
        "Content-Length": String(pdf.length),
        // Modal memakai ini untuk menampilkan nomor yang benar-benar terpakai.
        "X-Surat-Nomor": nomor,
      },
    });
  } catch (err) {
    console.error("[generate-debitur-care]", err);
    return NextResponse.json(
      { detail: (err as Error).message ?? "Gagal generate surat" },
      { status: 500 },
    );
  }
}

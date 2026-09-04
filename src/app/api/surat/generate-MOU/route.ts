import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { readFileSync } from "fs";
import path from "path";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";
import { docxToPdf } from "@/lib/server/docxToPdf";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── Helpers ───────────────────────────────────────────────────────────────────

const HARI_ID = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
const BULAN_PANJANG = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

const SATUAN = ["","satu","dua","tiga","empat","lima","enam","tujuh","delapan","sembilan","sepuluh","sebelas"];

function terbilangRatusan(n: number): string {
  if (n < 12) return SATUAN[n];
  if (n < 20) return SATUAN[n - 10] + " belas";
  if (n < 100) return SATUAN[Math.floor(n / 10)] + " puluh" + (n % 10 ? " " + SATUAN[n % 10] : "");
  if (n < 200) return "seratus" + (n % 100 ? " " + terbilangRatusan(n % 100) : "");
  return SATUAN[Math.floor(n / 100)] + " ratus" + (n % 100 ? " " + terbilangRatusan(n % 100) : "");
}

function terbilang(n: number): string {
  if (n === 0) return "nol";
  if (n < 0) return "minus " + terbilang(-n);

  const triliunan = Math.floor(n / 1_000_000_000_000);
  const miliaranSisa = n % 1_000_000_000_000;
  const miliaran = Math.floor(miliaranSisa / 1_000_000_000);
  const jutaanSisa = miliaranSisa % 1_000_000_000;
  const jutaan = Math.floor(jutaanSisa / 1_000_000);
  const ribuanSisa = jutaanSisa % 1_000_000;
  const ribuan = Math.floor(ribuanSisa / 1_000);
  const sisa = ribuanSisa % 1_000;

  let hasil = "";
  if (triliunan) hasil += (triliunan === 1 ? "satu" : terbilangRatusan(triliunan)) + " triliun ";
  if (miliaran)  hasil += (miliaran  === 1 ? "satu" : terbilangRatusan(miliaran))  + " miliar ";
  if (jutaan)    hasil += (jutaan    === 1 ? "satu" : terbilangRatusan(jutaan))    + " juta ";
  if (ribuan)    hasil += (ribuan    === 1 ? "seribu" : terbilangRatusan(ribuan) + " ribu") + " ";
  if (sisa)      hasil += terbilangRatusan(sisa);

  return hasil.trim() + " rupiah";
}

function toNum(v: unknown): number {
  if (v == null) return 0;
  return Number(typeof v === "object" ? String(v) : v) || 0;
}

function fmtRp(n: number): string {
  return n.toLocaleString("id-ID");
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

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json() as Record<string, string>;
    const { id_transaksi } = body;
    if (!id_transaksi) return NextResponse.json({ error: "id_transaksi wajib diisi" }, { status: 400 });

    // Ambil data transaksi lengkap
    // Cari MOU berdasarkan id (bigint) atau id_transaksi (string code)
    const isNumeric = /^\d+$/.test(id_transaksi);
    const trx = await prisma.mou.findFirst({
      where: isNumeric ? { id: BigInt(id_transaksi) } : { id_transaksi },
      select: {
        id: true,
        id_transaksi: true,
        tipe_komisi: true,
        nama_lengkap_klien: true,
        nik_klien: true,
        alamat_klien: true,
        harga_deal: true,
        harga_limit: true,
        persentase_komisi: true,
        biaya_baliknama: true,
        biaya_pengosongan: true,
        termasuk_baliknama: true,
        termasuk_pengosongan: true,
        maksimum_bidding: true,
        listing: {
          select: {
            alamat_lengkap: true,
            luas_tanah: true,
            legalitas: true,
            nomor_legalitas: true,
            uang_jaminan: true,
            nilai_limit_lelang: true,
          },
        },
        agent: {
          select: { pengguna: { select: { nama_lengkap: true } } },
        },
      },
    });

    if (!trx) return NextResponse.json({ error: "MOU tidak ditemukan" }, { status: 404 });

    const isPersen  = trx.tipe_komisi.toUpperCase() === "PERSENTASE";
    const now       = new Date();
    const hari      = HARI_ID[now.getDay()];
    const tanggal   = `${now.getDate()} ${BULAN_PANJANG[now.getMonth()]} ${now.getFullYear()}`;

    // Override dari body jika ada (manual input)
    const get = (key: string, fallback: string) => (body[key]?.trim() || fallback);

    const nama_klien  = get("nama_klien",  trx.nama_lengkap_klien ?? "");
    const nik_klien   = get("nik_klien",   trx.nik_klien ?? "");
    const alamat_klien = get("alamat_klien", trx.alamat_klien ?? "");

    const alamat_lengkap  = trx.listing.alamat_lengkap ?? "";
    const luas_tanah      = trx.listing.luas_tanah ? `${Number(trx.listing.luas_tanah)} m²` : "";
    const legalitas       = trx.listing.legalitas ?? "";
    const nomor_legalitas = trx.listing.nomor_legalitas ?? "";

    const uang_jaminan_num = toNum(trx.listing.uang_jaminan);
    const uang_jaminan     = fmtRp(uang_jaminan_num);
    const terbilang_uang_jaminan = terbilang(uang_jaminan_num);

    const biaya_baliknama_num = toNum(trx.biaya_baliknama);

    let templateFile: string;
    let data: Record<string, string | boolean>;

    if (isPersen) {
      const harga_limit_num      = toNum(trx.harga_limit) || toNum((trx.listing as any).nilai_limit_lelang);
      const max_bid_num          = toNum(trx.maksimum_bidding);
      const biaya_pengosongan_num = toNum(trx.biaya_pengosongan);
      const komisi_pct           = toNum(trx.persentase_komisi) * 100;

      data = {
        id_transaksi:                trx.id_transaksi ?? String(trx.id),
        hari, tanggal,
        nama_klien, nik_klien, alamat_klien,
        alamat_lengkap, legalitas, nomor_legalitas, luas_tanah,
        harga_limit:                 fmtRp(harga_limit_num),
        terbilang_harga_limit:       terbilang(harga_limit_num),
        maksimum_bidding:            fmtRp(max_bid_num),
        terbilang_maksimum_bidding:  terbilang(max_bid_num),
        komisi_persen:               `${komisi_pct}`,
        biaya_baliknama:             fmtRp(biaya_baliknama_num),
        terbilang_baliknama:         terbilang(biaya_baliknama_num),
        biaya_pengosongan:           fmtRp(biaya_pengosongan_num),
        terbilang_biaya_pengosongan: terbilang(biaya_pengosongan_num),
        uang_jaminan, terbilang_uang_jaminan,
        termasuk_pengosongan: biaya_pengosongan_num > 0,
        termasuk_baliknama:   biaya_baliknama_num > 0,
      };
      templateFile = "MOU_Template_persentase_final.docx";
    } else {
      const harga_deal_num        = toNum(trx.harga_deal);
      const biaya_pengosongan_num = toNum(trx.biaya_pengosongan);
      const harga_aset_num        = harga_deal_num - biaya_pengosongan_num - biaya_baliknama_num;
      // titipan biaya = 10% dari harga deal
      const titipan_biaya_num     = Math.round(harga_deal_num * 0.10);
      // pelunasan = harga deal - titipan biaya - uang deposit jaminan lelang
      const pelunasan_num         = harga_deal_num - titipan_biaya_num - uang_jaminan_num;

      data = {
        id_transaksi:                trx.id_transaksi ?? String(trx.id),
        hari, tanggal,
        nama_klien, nik_klien, alamat_klien,
        alamat_lengkap, legalitas, nomor_legalitas, luas_tanah,
        harga_deal:                  fmtRp(harga_deal_num),
        terbilang_harga_deal:        terbilang(harga_deal_num),
        biaya_pengosongan:           fmtRp(biaya_pengosongan_num),
        terbilang_biaya_pengosongan: terbilang(biaya_pengosongan_num),
        biaya_baliknama:             fmtRp(biaya_baliknama_num),
        terbilang_biaya_baliknama:   terbilang(biaya_baliknama_num),
        harga_aset:                  fmtRp(Math.max(0, harga_aset_num)),
        titipan_biaya:               fmtRp(titipan_biaya_num),
        terbilang_titipan_biaya:     terbilang(titipan_biaya_num),
        uang_jaminan, terbilang_uang_jaminan,
        pelunasan:                   fmtRp(Math.max(0, pelunasan_num)),
        terbilang_pelunasan:         terbilang(Math.max(0, pelunasan_num)),
        termasuk_pengosongan: toNum(trx.biaya_pengosongan) > 0,
        termasuk_baliknama:   biaya_baliknama_num > 0,
      };
      templateFile = "template_mou_selisihharga.docx";
    }

    const templatePath = path.join(
      process.cwd(),
      "src/app/dashboard/surat/components/templates",
      templateFile,
    );

    const docxBuffer = await fillDocx(templatePath, data);
    const pdfBuffer  = await docxToPdf(docxBuffer, "mou");

    const safe = (trx.id_transaksi ?? String(trx.id)).replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `MOU_${safe}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: unknown) {
    console.error("[generate-mou]", e);
    const msg = e instanceof Error ? e.message : "Gagal generate MOU.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

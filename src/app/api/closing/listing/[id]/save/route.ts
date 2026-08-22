import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";
import { cariIdAsetSama } from "@/lib/auctionMatch";

function toBigInt(v: number | null | undefined): bigint {
  if (v == null || !Number.isFinite(v)) return 0n;
  return BigInt(Math.round(v));
}

function toDecimal(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return null;
  return v;
}

const BULAN_ID = ["JAN","FEB","MAR","APR","MEI","JUN","JUL","AGU","SEP","OKT","NOV","DES"];

async function generateIdTransaksi(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
): Promise<string> {
  const now = new Date();
  const bulan = BULAN_ID[now.getMonth()];
  const tahun = now.getFullYear();

  const startOfMonth = new Date(tahun, now.getMonth(), 1);
  const endOfMonth   = new Date(tahun, now.getMonth() + 1, 0, 23, 59, 59, 999);

  const count = await tx.mou.count({
    where: { dibuat_pada: { gte: startOfMonth, lte: endOfMonth } },
  });

  const nomor = String(count + 1).padStart(3, "0");
  return `${nomor}/MOU/SPT-SBY/${bulan}/${tahun}`;
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const sessionAgentId = (session?.user as any)?.agentId as string | undefined;

    const id_listing = BigInt(params.id);
    const body = await req.json();

    const {
      skema,
      agentId: agentIdRaw,
      deal,
      bidding,
      limit,
      komisiPct,
      balikNama,
      eksekusi,
      cobroke,
      komisiAgent,
      pendapatanBersihKantor,
      hargaBidding,
      jenis_transaksi,
      rows,
      agentLuarNama,
      agentLuarKantor,
      agentLuarTelepon,
      id_klien,
      nama_lengkap_klien,
      nik_klien,
      alamat_klien,
      termasuk_balik_nama,
      termasuk_biaya_eksekusi,
      maksimum_bidding,
      gambar_ktp_klien,
    } = body;

    const isAgentLuar = agentIdRaw === "COBROKE";
    const agentId = isAgentLuar ? (sessionAgentId ?? agentIdRaw) : agentIdRaw;

    if (!agentId) {
      return NextResponse.json({ ok: false, error: "agentId wajib diisi" }, { status: 400 });
    }

    const isPersen = skema === "PERSENTASE";

    const result = await prisma.$transaction(async (tx) => {
      // Cek apakah MOU sudah ada untuk listing + agent ini
      const existing = await tx.mou.findFirst({
        where: { id_listing, id_agent: agentId },
        orderBy: { dibuat_pada: "desc" },
      });

      const mouData = {
        id_listing,
        id_agent: agentId,
        jenis_transaksi: jenis_transaksi as any,
        tipe_komisi: isPersen ? "PERSENTASE" : "SELISIH",
        gambar_ktp_klien: gambar_ktp_klien ?? null,
        id_klien: id_klien ?? null,
        nama_lengkap_klien: nama_lengkap_klien ?? null,
        nik_klien: nik_klien ?? null,
        alamat_klien: alamat_klien ?? null,
        harga_deal: isPersen ? null : toBigInt(deal),
        harga_limit: toDecimal(limit > 0 ? limit : null),
        persentase_komisi: isPersen ? toDecimal(komisiPct / 100) : null,
        biaya_baliknama: toBigInt(balikNama),
        biaya_pengosongan: toBigInt(eksekusi),
        termasuk_baliknama: termasuk_balik_nama === true,
        termasuk_pengosongan: termasuk_biaya_eksekusi === true,
        maksimum_bidding: isPersen && maksimum_bidding > 0 ? toDecimal(maksimum_bidding) : null,
        agent_luar_nama: isAgentLuar ? (agentLuarNama ?? null) : null,
        agent_luar_kantor: isAgentLuar ? (agentLuarKantor ?? null) : null,
        agent_luar_telepon: isAgentLuar ? (agentLuarTelepon ?? null) : null,
      };

      let mou;

      if (existing) {
        // Update MOU — preserve status
        mou = await tx.mou.update({
          where: { id: existing.id },
          data: { ...mouData, diperbarui_pada: new Date() },
        });
      } else {
        // Buat MOU baru
        mou = await tx.mou.create({
          data: {
            ...mouData,
            id_transaksi: await generateIdTransaksi(tx),
            status: "proses" as any,
          },
        });
      }

      // Ambil data listing + agent untuk acara dan marking TERJUAL
      const currentListing = await tx.listing.findUnique({
        where: { id_property: id_listing },
        select: {
          legalitas: true,
          nomor_legalitas: true,
          kelurahan: true,
          kecamatan: true,
          kota: true,
          tanggal_lelang: true,
          jenis_transaksi: true,
          alamat_lengkap: true,
        },
      });

      const agentInfo = await tx.agent.findUnique({
        where: { id_agent: agentId },
        select: { pengguna: { select: { nama_lengkap: true } } },
      });
      const namaAgent = agentInfo?.pengguna?.nama_lengkap ?? agentId;

      const LOKASI_KANTOR =
        "Solitaire Property\nJusticia Law Firm\nKantor Pemasaran dan Layanan Hukum\nSantorini Town Square\nJl. Ronggolawe No.2A, DR. Soetomo\nKec. Tegalsari, Surabaya, Jawa Timur 60160";

      // Set tanggal_transaksi dari tanggal_lelang listing
      if (currentListing?.tanggal_lelang) {
        const tgl = currentListing.tanggal_lelang;
        const tglMulai = new Date(tgl);
        tglMulai.setHours(9, 0, 0, 0);
        const tglSelesai = new Date(tgl);
        tglSelesai.setHours(17, 0, 0, 0);

        await tx.mou.update({
          where: { id: mou.id },
          data: { tanggal_transaksi: tgl },
        });

        // Upsert acara kalender — cek berdasarkan id_property + tipe CLOSING di tanggal sama
        const existingAcara = await tx.acara.findFirst({
          where: {
            id_property: id_listing,
            tipe_acara: "CLOSING",
            tanggal_mulai: { gte: new Date(tgl.toISOString().slice(0, 10)), lt: new Date(new Date(tgl).setDate(new Date(tgl).getDate() + 1)) },
          },
          select: { id_acara: true },
        });

        const kota = currentListing.kota ?? "Surabaya";
        const jenis = currentListing.jenis_transaksi ?? "LELANG";
        const alamat = currentListing.alamat_lengkap ?? kota;
        const judul = `Closing Aset ${kota}`;
        const deskripsi = `Transaksi ${jenis} oleh ${namaAgent}, aset ${alamat}`;

        if (existingAcara) {
          await tx.acara.update({
            where: { id_acara: existingAcara.id_acara },
            data: { judul_acara: judul, deskripsi, tanggal_mulai: tglMulai, tanggal_selesai: tglSelesai, tanggal_diupdate: new Date() },
          });
        } else {
          await tx.acara.create({
            data: {
              id_agent: agentId,
              id_property: id_listing,
              judul_acara: judul,
              deskripsi,
              tipe_acara: "CLOSING",
              tanggal_mulai: tglMulai,
              tanggal_selesai: tglSelesai,
              lokasi: LOKASI_KANTOR,
              status_acara: "SCHEDULED",
              reminder_sent: false,
            },
          });
        }
      }

      // Tandai TERJUAL: listing ini + semua listing yang merupakan aset yang sama
      // persis (jenis + HIMPUNAN nomor sertifikat + wilayah, lihat
      // @/lib/auctionMatch). WAJIB cocok sampai kelurahan supaya aset lain dengan
      // nomor sertifikat kebetulan sama di kelurahan berbeda tidak ikut tertandai
      // terjual, dan himpunannya harus sama persis supaya paket multi-bidang
      // tidak menandai lot satuan di dalamnya.
      const idAsetSama = currentListing
        ? await cariIdAsetSama(tx, currentListing)
        : [];
      const idTerjual = Array.from(new Set([id_listing, ...idAsetSama]));
      await tx.listing.updateMany({
        where: { id_property: { in: idTerjual } },
        data: { status_tayang: "TERJUAL" },
      });

      // ── Transaksi ────────────────────────────────────────────
      const idTransaksi = mou.id_transaksi;
      if (idTransaksi) {
        const isSelisihLocal = skema === "SELISIH";
        const hargaBiddingNum = Number(hargaBidding) || 0;
        const limitNum = Number(limit) || 0;

        // selisih bersih (SELISIH: deal − bidding − biaya; PERSENTASE: pendapatan kotor)
        const selisihVal = isSelisihLocal
          ? Math.max(0, (Number(deal) || 0) - hargaBiddingNum
              - (termasuk_balik_nama ? (Number(balikNama) || 0) : 0)
              - (termasuk_biaya_eksekusi ? (Number(eksekusi) || 0) : 0))
          : Math.round(((Number(bidding) || 0) * (Number(komisiPct) || 0)) / 100);

        const pembanding = isSelisihLocal
          ? (hargaBiddingNum > 0 ? hargaBiddingNum : (Number(deal) || 0))
          : (Number(bidding) || 0);
        const kenaikan = limitNum > 0 && pembanding > 0
          ? (pembanding - limitNum) / limitNum
          : 0;

        const tanggalTrx = currentListing?.tanggal_lelang ?? new Date();

        const trxData = {
          harga_bidding: hargaBiddingNum > 0 ? toDecimal(hargaBiddingNum) : null,
          selisih: toBigInt(selisihVal),
          kenaikan_dari_limit: toDecimal(kenaikan),
          biaya_baliknama: toBigInt(Number(balikNama) || 0),
          biaya_pengosongan: toBigInt(Number(eksekusi) || 0),
          cobroke_fee: toBigInt(Number(cobroke) || 0),
          pendapatan_bersih_kantor: toBigInt(Number(pendapatanBersihKantor) || 0),
          tanggal_transaksi: tanggalTrx,
          diperbarui_pada: new Date(),
        };

        const existingTrx = await tx.transaksi.findUnique({
          where: { id_transaksi: idTransaksi },
          select: { id_transaksi: true },
        });

        if (existingTrx) {
          await tx.transaksi.update({
            where: { id_transaksi: idTransaksi },
            data: trxData,
          });
        } else {
          await tx.transaksi.create({
            data: { id_transaksi: idTransaksi, ...trxData, status_transaksi: "closing" as any },
          });
        }

        // ── Detail Transaksi ──────────────────────────────────
        if (Array.isArray(rows) && rows.length > 0) {
          await tx.detailTransaksi.deleteMany({ where: { id_transaksi: idTransaksi } });

          const validRows = rows.filter(
            (r: any) => r.agentId && r.agentId !== "COBROKE" && Number(r.nominal) > 0
          );
          if (validRows.length > 0) {
            await tx.detailTransaksi.createMany({
              data: validRows.map((r: any) => ({
                id_transaksi: idTransaksi,
                id_agent: String(r.agentId),
                role: String(r.code ?? r.label ?? "agent"),
                pendapatan: toBigInt(Number(r.nominal)),
              })),
              skipDuplicates: true,
            });
          }
        }
      }

      return { mou, idTransaksi: mou.id_transaksi };
    });

    return NextResponse.json({
      ok: true,
      id: result.idTransaksi ?? result.mou.id.toString(),
      kode: result.idTransaksi ?? result.mou.id_transaksi,
    });
  } catch (e: any) {
    console.error("[closing/save]", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

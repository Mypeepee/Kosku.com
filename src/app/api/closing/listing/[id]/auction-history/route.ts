import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuctionHistory } from "@/lib/auctionHistory";

export const dynamic = "force-dynamic";

/**
 * Riwayat lelang untuk modul closing. Pencocokan asetnya memakai mesin yang
 * sama dengan halaman detail publik (@/lib/auctionHistory) supaya angka yang
 * dilihat agent di closing tidak pernah berbeda dari yang dilihat klien.
 * Bentuk respons dipertahankan demi RiwayatLelangModal di ClosingShell.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const hasil = await getAuctionHistory(params.id);
    if (!hasil) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const current = hasil.items.find((i) => i.is_current) ?? hasil.items[0];

    // Listing non-lelang tidak punya riwayat lelang — pertahankan perilaku lama
    // (rows kosong) supaya modal closing tidak menampilkan dirinya sendiri.
    if (current && current.jenis_transaksi !== "LELANG") {
      return NextResponse.json({
        current: {
          id_property: current.id_property,
          jenis_transaksi: current.jenis_transaksi,
          kelurahan: current.kelurahan,
          kecamatan: current.kecamatan,
          kota: current.kota,
          legalitas: current.legalitas,
          nomor_legalitas: current.nomor_legalitas,
        },
        rows: [],
        matchCriteria: null,
      });
    }

    // Nama agent penayang tiap event — jumlah baris kecil, satu query cukup.
    const agentIds = Array.from(
      new Set(hasil.items.map((i) => i.id_agent).filter(Boolean) as string[])
    );
    const agents = agentIds.length
      ? await prisma.agent.findMany({
          where: { id_agent: { in: agentIds } },
          select: {
            id_agent: true,
            nama_kantor: true,
            pengguna: { select: { nama_lengkap: true } },
          },
        })
      : [];
    const namaAgent = new Map(
      agents.map((a) => [
        a.id_agent,
        a.pengguna?.nama_lengkap ?? a.nama_kantor ?? a.id_agent,
      ])
    );

    const rows = hasil.items.map((i) => ({
      id_property: i.id_property,
      tanggal_lelang: i.tanggal_lelang,
      tanggal_dibuat: i.tanggal_dibuat,
      nilai_limit_lelang:
        i.nilai_limit_lelang != null ? String(i.nilai_limit_lelang) : null,
      uang_jaminan: i.uang_jaminan != null ? String(i.uang_jaminan) : null,
      link: i.link,
      gambar: i.gambar_list.join(",") || null,
      gambar_list: i.gambar_list,
      imageUrl: i.gambar_utama ?? "/placeholder.jpg",
      kelurahan: i.kelurahan,
      kecamatan: i.kecamatan,
      kota: i.kota,
      legalitas: i.legalitas,
      nomor_legalitas: i.nomor_legalitas,
      nomor_legalitas_list: i.nomor_legalitas_list,
      nomor_cocok: i.nomor_cocok,
      // Lot dengan cakupan bidang berbeda ikut ditampilkan (agent perlu tahu
      // lotnya ada), tapi limitnya TIDAK sebanding dengan listing ini —
      // lihat @/lib/auctionHistory.
      cakupan: i.cakupan,
      alamat_lengkap: i.alamat_lengkap,
      id_agent: i.id_agent,
      agent_nama:
        (i.id_agent && namaAgent.get(i.id_agent)) || i.id_agent || "-",
      confidence: i.confidence,
      duplikat_ids: i.duplikat_ids,
    }));

    return NextResponse.json({
      current: {
        id_property: current?.id_property ?? String(params.id),
        jenis_transaksi: "LELANG",
        kelurahan: current?.kelurahan ?? null,
        kecamatan: current?.kecamatan ?? null,
        kota: current?.kota ?? null,
        legalitas: current?.legalitas ?? null,
        nomor_legalitas: current?.nomor_legalitas ?? null,
      },
      rows,
      total_sebidang: hasil.total_sebidang,
      total_lot_terkait: hasil.total_lot_terkait,
      matchCriteria: hasil.match
        ? {
            wilayah_level: hasil.match.wilayah_level,
            kelurahan: hasil.match.kelurahan,
            kecamatan: hasil.match.kecamatan,
            kota: hasil.match.kota,
            legalitas: hasil.match.legalitas,
            nomor_legalitas: hasil.match.nomor_legalitas,
            nomor_normal: hasil.match.nomor_normal,
          }
        : null,
    });
  } catch (e: any) {
    console.error("❌ Gagal mengambil riwayat lelang (closing):", e);
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

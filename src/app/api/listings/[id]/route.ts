import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Helper untuk konversi BigInt → string
function serializeBigInt<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid listing ID' },
        { status: 400 }
      );
    }

    const listing = await prisma.listing.findUnique({
      where: { id_property: id },
      include: {
        agent: {
          include: {
            pengguna: {
              select: {
                nama_lengkap: true,
                email: true,
                nomor_telepon: true,
              },
            },
          },
        },
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Increment view count
    await prisma.listing.update({
      where: { id_property: id },
      data: { dilihat: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      data: serializeBigInt(listing),
    });
  } catch (error) {
    console.error('Error fetching listing:', error);
    return NextResponse.json(
      { error: 'Failed to fetch listing' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const body = await request.json();

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid listing ID' },
        { status: 400 }
      );
    }

    // Check if listing exists
    const existing = await prisma.listing.findUnique({
      where: { id_property: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    // TENTUKAN harga sesuai jenis_transaksi (tidak boleh null)
    const jenisTransaksi = body.jenis_transaksi as
      | 'PRIMARY'
      | 'SECONDARY'
      | 'LELANG'
      | 'SEWA';

    let harga: number;

    if (jenisTransaksi === 'LELANG') {
      // Untuk lelang, harga = nilai_limit_lelang
      harga = Number(body.nilai_limit_lelang || 0);
    } else {
      harga = Number(body.harga || 0);
    }

    if (!harga || harga <= 0) {
      return NextResponse.json(
        {
          error:
            jenisTransaksi === 'LELANG'
              ? 'Nilai limit lelang wajib diisi dan > 0'
              : 'Harga wajib diisi dan > 0',
        },
        { status: 400 }
      );
    }

    // Update listing + pilih field yang dibutuhkan untuk redirect
    const updated = await prisma.listing.update({
      where: { id_property: id },
      data: {
        judul: body.judul,
        slug: body.slug,
        deskripsi: body.deskripsi,
        jenis_transaksi: jenisTransaksi,
        kategori: body.kategori,
        vendor: body.vendor,
        status_tayang: body.status_tayang,
        harga,
        harga_promo: body.harga_promo,
        tanggal_lelang: body.tanggal_lelang
          ? new Date(body.tanggal_lelang)
          : null,
        uang_jaminan: body.uang_jaminan,
        nilai_limit_lelang: body.nilai_limit_lelang,
        link: body.link,
        alamat_lengkap: body.alamat_lengkap,
        provinsi: body.provinsi,
        kota: body.kota,
        kecamatan: body.kecamatan,
        kelurahan: body.kelurahan,
        latitude: body.latitude,
        longitude: body.longitude,
        luas_tanah: body.luas_tanah,
        luas_bangunan: body.luas_bangunan,
        jumlah_lantai: body.jumlah_lantai,
        kamar_tidur: body.kamar_tidur,
        kamar_mandi: body.kamar_mandi,
        daya_listrik: body.daya_listrik,
        sumber_air: body.sumber_air,
        hadap_bangunan: body.hadap_bangunan,
        kondisi_interior: body.kondisi_interior,
        legalitas: body.legalitas,
        nomor_legalitas: body.nomor_legalitas,
        gambar: body.gambar,
        lampiran: body.lampiran,
        is_hot_deal: body.is_hot_deal,
        tanggal_diupdate: new Date(),
      },
      select: {
        id_property: true,
        slug: true,
        jenis_transaksi: true,
        id_agent: true,
        // kalau perlu field lain bisa tambahkan di sini
      },
    });

    return NextResponse.json({
      success: true,
      data: serializeBigInt(updated),
      message: 'Listing berhasil diupdate',
    });
  } catch (error) {
    console.error('Error updating listing:', error);
    return NextResponse.json(
      { error: 'Failed to update listing' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid listing ID' },
        { status: 400 }
      );
    }

    // Check if listing exists
    const existing = await prisma.listing.findUnique({
      where: { id_property: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Delete listing
    await prisma.listing.delete({
      where: { id_property: id },
    });

    return NextResponse.json({
      success: true,
      message: 'Listing berhasil dihapus',
    });
  } catch (error) {
    console.error('Error deleting listing:', error);
    return NextResponse.json(
      { error: 'Failed to delete listing', },
      { status: 500 }
    );
  }
}
